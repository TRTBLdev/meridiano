import { addData, getAllData, putData, deleteData } from '../db.js';
import { escapeHTML } from '../utils/sanitize.js';
import { renderDotMatrix } from '../utils/dotmatrix.js';
import {
  bindWakeLockPreference,
  createWakeLockController,
  populateTimerDots
} from './timerShell.js';
import { playQuartzBowlRing } from '../utils/synth.js';

/**
 * Componente modular para Fuerza / Calistenia.
 * Lobby con lista de circuitos, ejecución con timer ascendente (reps)
 * y descendente (tiempo), transiciones automáticas entre ejercicios
 * y manuales entre rondas.
 *
 * @param {HTMLElement} container Contenedor principal de la SPA
 * @param {IDBDatabase} db Conexión a IndexedDB
 * @param {Function} onNavigate Navegación global
 */
export async function renderStrengthScreen(container, db, onNavigate, orchestratorConfig = null) {
  let activeView = 'lobby'; // 'lobby' | 'timer'

  let exercises = [];
  let circuits = [];

  // Timer state
  let currentCircuit = null;
  let currentRound = 0;
  let currentExerciseIndex = 0;
  let timerInterval = null;
  let isPaused = false;
  let isSessionStarted = false;
  let elapsedSeconds = 0; // total session elapsed

  // Phase state
  let phaseType = 'exercise'; // 'exercise' | 'rest-exercise' | 'rest-round' | 'waiting-round'
  let phaseTimeLeft = 0;    // for countdown modes (time exercises, rest)
  let phaseElapsed = 0;     // for countup modes (rep exercises)
  let phaseDuration = 0;    // total duration of current phase

  // Dot grid animation
  let lastActiveDotsCount = -1;
  let gridAnimFrame = null;
  let phaseStartTime = 0;
  let phaseElapsedBeforePause = 0;

  const wakeLockController = createWakeLockController();

  // Load data
  async function loadData() {
    try {
      exercises = await getAllData(db, 'strength_exercises');
      circuits = await getAllData(db, 'strength_circuits');
    } catch (err) {
      console.error('[Strength] Error loading data:', err);
    }
  }

  async function refresh() {
    await loadData();

    if (orchestratorConfig && !currentCircuit) {
      currentCircuit = circuits.find(c => c.id === orchestratorConfig.presetId) || circuits[0];
      if (currentCircuit) {
        activeView = 'timer';
        currentRound = 0;
        currentExerciseIndex = 0;
        phaseType = 'exercise';
        isSessionStarted = false;
        elapsedSeconds = 0;
      }
    }

    container.innerHTML = '';
    if (activeView === 'timer') renderTimer();
    else renderLobby();
  }

  async function cleanupTimer() {
    clearInterval(timerInterval);
    timerInterval = null;
    cancelAnimationFrame(gridAnimFrame);
    wakeLockController.release();
  }

  function getExerciseById(id) {
    return exercises.find(e => e.id === id);
  }

  /* =============================================================
     HELPER: Build flat phase list for execution
     ============================================================= */
  function buildPhaseList(circuit) {
    const phases = [];
    for (let round = 0; round < circuit.rounds; round++) {
      circuit.exercises.forEach((entry, exIdx) => {
        const exercise = getExerciseById(entry.exerciseId);
        if (!exercise) return;

        const effectiveReps = entry.repsOverride || exercise.reps;
        const effectiveDuration = entry.durationOverride || exercise.duration;
        const mode = effectiveDuration ? 'time' : 'reps';

        phases.push({
          type: 'exercise',
          round,
          exerciseIndex: exIdx,
          exercise,
          mode,
          reps: effectiveReps,
          duration: effectiveDuration
        });

        // Add rest between exercises (not after last exercise in round)
        if (exIdx < circuit.exercises.length - 1) {
          phases.push({
            type: 'rest-exercise',
            round,
            duration: circuit.restBetweenExercises
          });
        }
      });

      // Add rest between rounds (not after last round)
      if (round < circuit.rounds - 1) {
        phases.push({
          type: 'rest-round',
          round,
          nextRound: round + 1,
          duration: circuit.restBetweenRounds
        });
      }
    }
    return phases;
  }

  /* =============================================================
     LOBBY
     ============================================================= */
  function renderLobby() {
    const layout = document.createElement('div');
    layout.className = 'dashboard-layout fade-in';

    layout.innerHTML = `
      <nav class="nav-bar">
        <div class="nav-logo dot-digital">M.</div>
        <ul class="nav-links">
          <li class="nav-item" id="btn-back-home">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Volver</span>
          </li>
        </ul>
      </nav>

      <main class="main-viewport" style="display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 20px; overflow-y: auto;">
        <div class="glass-panel" style="max-width: 480px; width: 100%; padding: 24px; box-sizing: border-box; margin-bottom: 40px;">

          <header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
            <h2 class="module-lobby-title" style="margin: 0;">FUERZA</h2>
          </header>

          <section class="acu-sequences-section">
            <span class="acu-section-label">Circuitos Disponibles</span>
            <div id="lobby-circuits-list"></div>
          </section>

          <div style="margin: 32px 0 12px; display: flex; align-items: center; justify-content: space-between; font-size: 0.68rem; color: var(--color-text-muted); font-family: var(--font-digital); border-top: 1px dashed rgba(46, 43, 40, 0.08); padding-top: 20px; width: 100%;">
            <span>MANTENER PANTALLA ACTIVA</span>
            <label class="braun-switch" style="margin: 0;">
              <input type="checkbox" id="pref-wakelock-switch" ${localStorage.getItem('meridiano_wakelock') !== 'false' ? 'checked' : ''}>
              <span class="braun-switch-slider"></span>
            </label>
          </div>
        </div>
      </main>
    `;

    container.appendChild(layout);
    bindWakeLockPreference(layout);

    layout.querySelector('#btn-back-home').addEventListener('click', () => {
      onNavigate('inicio');
    });

    // Render circuits list
    const circuitsList = layout.querySelector('#lobby-circuits-list');

    if (circuits.length === 0) {
      circuitsList.innerHTML = `<p style="font-size: 0.8rem; color: var(--color-text-muted); padding: 16px 0;">No hay circuitos disponibles. Importa datos desde Ajustes o revisa la base de datos.</p>`;
    } else {
      circuits.forEach(circuit => {
        const totalExercises = circuit.exercises.length;
        const estimatedMin = Math.ceil(estimateCircuitDuration(circuit) / 60);
        const equipmentList = circuit.equipment ? circuit.equipment.join(', ') : '';

        const accordionItem = document.createElement('div');
        accordionItem.className = 'acu-accordion-item';

        accordionItem.innerHTML = `
          <div class="acu-accordion-header" style="pointer-events: auto;">
            <div class="acu-accordion-header-left">
              <span class="acu-accordion-indicator-arrow">▶</span>
              <span class="acu-seq-name" style="font-weight: 500; font-size: 0.95rem;">${escapeHTML(circuit.name)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 12px; pointer-events: auto;">
              <span style="font-family: var(--font-digital); font-size: 0.65rem; color: var(--color-text-muted); letter-spacing:0.05em;">
                ${circuit.rounds}R × ${totalExercises}E
              </span>
              <span class="acu-seq-duration-badge">${estimatedMin} min</span>
              <button class="btn-play-header" title="Iniciar Circuito">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style="color: var(--color-text-main); margin-left: 1px;">
                  <polygon points="6 4 19 12 6 20 6 4"></polygon>
                </svg>
              </button>
            </div>
          </div>
          <div class="acu-accordion-content" style="display: none;">
            <div style="margin-bottom: 12px; font-size: 0.78rem; line-height: 1.4; color: var(--color-text-muted);">${escapeHTML(circuit.description || '')}</div>
            ${equipmentList ? `<div style="font-size: 0.68rem; color: var(--color-text-muted); margin-bottom: 12px; font-family: var(--font-digital);">IMPLEMENTOS: ${escapeHTML(equipmentList)}</div>` : ''}

            <span class="acu-section-label" style="margin-bottom: 8px; font-size: 0.65rem;">Ejercicios del Circuito</span>
            <div class="acu-points-timeline">
              ${circuit.exercises.map((entry, idx) => {
                const ex = getExerciseById(entry.exerciseId);
                if (!ex) return '';
                const effectiveReps = entry.repsOverride || ex.reps;
                const effectiveDuration = entry.durationOverride || ex.duration;
                const modeLabel = effectiveDuration ? `${effectiveDuration}s` : `${effectiveReps} reps`;

                return `
                  <div class="acu-timeline-point">
                    <span class="acu-timeline-point-number">${idx + 1}</span>
                    <div class="acu-timeline-point-details">
                      <span class="acu-timeline-point-name" style="font-size:0.8rem; font-weight:600;">${escapeHTML(ex.name)}</span>
                      <span class="acu-timeline-point-times" style="font-size:0.7rem; color:var(--color-text-muted);">${escapeHTML(ex.focus)} — ${escapeHTML(modeLabel)}</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
            <div style="font-size: 0.65rem; color: var(--color-text-muted); font-family: var(--font-digital); margin-top: 8px;">
              DESCANSO ENTRE EJERCICIOS: ${circuit.restBetweenExercises}s · ENTRE RONDAS: ${circuit.restBetweenRounds}s
            </div>
          </div>
        `;

        const headerEl = accordionItem.querySelector('.acu-accordion-header');
        const contentEl = accordionItem.querySelector('.acu-accordion-content');
        const playBtn = headerEl.querySelector('.btn-play-header');

        headerEl.addEventListener('click', (e) => {
          if (e.target.closest('.btn-play-header')) return;
          const isExpanded = accordionItem.classList.toggle('expanded');
          contentEl.style.display = isExpanded ? 'block' : 'none';
        });

        playBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          startSession(circuit);
        });

        circuitsList.appendChild(accordionItem);
      });
    }
  }

  /* =============================================================
     ESTIMATE CIRCUIT DURATION
     ============================================================= */
  function estimateCircuitDuration(circuit) {
    let total = 0;
    for (let r = 0; r < circuit.rounds; r++) {
      circuit.exercises.forEach((entry, idx) => {
        const ex = getExerciseById(entry.exerciseId);
        if (!ex) return;
        const dur = entry.durationOverride || ex.duration;
        // For reps, estimate ~4 seconds per rep
        if (dur) {
          total += dur;
        } else {
          const reps = entry.repsOverride || ex.reps || 10;
          total += reps * 4;
        }
        // Rest between exercises
        if (idx < circuit.exercises.length - 1) {
          total += circuit.restBetweenExercises;
        }
      });
      // Rest between rounds
      if (r < circuit.rounds - 1) {
        total += circuit.restBetweenRounds;
      }
    }
    return total;
  }

  /* =============================================================
     START SESSION
     ============================================================= */
  function startSession(circuit) {
    currentCircuit = circuit;
    currentRound = 0;
    currentExerciseIndex = 0;
    isSessionStarted = false;
    isPaused = false;
    elapsedSeconds = 0;
    lastActiveDotsCount = -1;

    activeView = 'timer';
    refresh();
  }

  /* =============================================================
     TIMER EXECUTION SCREEN
     ============================================================= */
  function renderTimer() {
    const phases = buildPhaseList(currentCircuit);
    let currentPhaseIdx = 0;

    const totalExercises = currentCircuit.exercises.length;
    const totalRounds = currentCircuit.rounds;
    const estimatedTotal = estimateCircuitDuration(currentCircuit);

    const timerScreen = document.createElement('div');
    timerScreen.className = 'acu-timer-fullscreen fade-in';

    timerScreen.innerHTML = `
      <div class="acu-fullscreen-bg grid-36" id="strength-dots-grid"></div>

      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; width: 100%; z-index: 10; position: relative; pointer-events: none;">

        <!-- Dot matrix display -->
        <div id="strength-countdown-matrix" class="acu-timer-dot-display" style="margin-bottom: 24px; pointer-events: auto;"></div>

        <!-- Info frame -->
        <div class="acu-timer-info-frame" id="strength-info-frame" style="pointer-events: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div class="acu-state-badge stimulating" id="strength-state-badge">Preparación</div>
            <div class="acu-panel-progress-steps" id="strength-progress" style="margin-bottom: 0;">Ronda 1/${totalRounds}</div>
          </div>

          <div>
            <h2 class="acu-panel-point-name" id="strength-exercise-name" style="margin-bottom:0; font-size:1.2rem;">Preparación</h2>
            <div class="acu-panel-point-meridian" id="strength-exercise-focus" style="margin-bottom: 8px; font-size: 0.72rem;">Prepárate para iniciar el circuito</div>
          </div>

          <!-- Mode badge -->
          <div id="strength-mode-badge" style="margin-bottom: 8px;">
            <span class="acu-panel-headtag" style="padding: 2px 6px; font-size: 0.65rem;">REPETICIONES</span>
          </div>

          <!-- Instructions -->
          <div class="acu-panel-info-box" style="margin-bottom: 16px; background: none; padding: 8px 0; gap: 8px; border: none; border-top: 1px dashed rgba(46, 43, 40, 0.1);">
            <div>
              <div class="acu-panel-info-label">Preparación</div>
              <div class="acu-panel-info-text" id="strength-preparation" style="font-size: 0.75rem;">Presiona Iniciar cuando estés lista.</div>
            </div>
            <div style="margin-top: 4px;">
              <div class="acu-panel-info-label">Ejecución</div>
              <div class="acu-panel-info-text" id="strength-execution" style="font-size: 0.75rem;"></div>
            </div>
          </div>

          <!-- Rep / Time display -->
          <div id="strength-rep-display" style="display: none; text-align: center; font-family: var(--font-digital); font-size: 0.8rem; color: var(--color-accent-green); margin-bottom: 12px; letter-spacing: 0.1em;"></div>

          <!-- Controls -->
          <div class="acu-panel-controls" style="gap: 24px;">
            <button class="btn-acu-icon btn-acu-active" id="btn-strength-play" title="Iniciar sesión" style="width:38px; height:38px;">
              <svg id="svg-strength-play-icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </button>

            <button class="btn-acu-icon" id="btn-strength-done" title="Completar ejercicio" style="width:38px; height:38px; opacity:0.35; pointer-events:none;">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="20 6 9 17 4 12"></polyline>
              </svg>
            </button>

            <button class="btn-acu-icon btn-acu-danger" id="btn-strength-exit" title="Detener sesión" style="width:38px; height:38px;">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                <rect x="5" y="5" width="14" height="14" rx="1"></rect>
              </svg>
            </button>
          </div>
        </div>
      </div>
    `;

    container.appendChild(timerScreen);

    // Populate dot grid
    const dots = populateTimerDots(timerScreen.querySelector('#strength-dots-grid'), 5184);

    // DOM refs
    const stateBadge = timerScreen.querySelector('#strength-state-badge');
    const progressEl = timerScreen.querySelector('#strength-progress');
    const exerciseName = timerScreen.querySelector('#strength-exercise-name');
    const exerciseFocus = timerScreen.querySelector('#strength-exercise-focus');
    const modeBadge = timerScreen.querySelector('#strength-mode-badge');
    const preparationEl = timerScreen.querySelector('#strength-preparation');
    const executionEl = timerScreen.querySelector('#strength-execution');
    const repDisplay = timerScreen.querySelector('#strength-rep-display');
    const countdownMatrix = timerScreen.querySelector('#strength-countdown-matrix');
    const btnPlay = timerScreen.querySelector('#btn-strength-play');
    const btnDone = timerScreen.querySelector('#btn-strength-done');
    const btnExit = timerScreen.querySelector('#btn-strength-exit');
    const playIcon = timerScreen.querySelector('#svg-strength-play-icon');

    // Helper: format MM:SS
    function formatMMSS(totalSec) {
      const m = Math.floor(Math.abs(totalSec) / 60);
      const s = Math.abs(totalSec) % 60;
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    // --- SYNC DISPLAY ---
    function syncDisplay() {
      const phase = phases[currentPhaseIdx];
      if (!phase) return;

      if (phase.type === 'exercise') {
        const ex = phase.exercise;
        stateBadge.textContent = `Ejercicio ${phase.exerciseIndex + 1}/${totalExercises}`;
        stateBadge.className = 'acu-state-badge stimulating';
        progressEl.textContent = `Ronda ${phase.round + 1}/${totalRounds}`;
        exerciseName.textContent = ex.name;
        exerciseFocus.textContent = ex.focus;
        preparationEl.textContent = ex.preparation;
        executionEl.textContent = ex.execution;

        if (phase.mode === 'time') {
          modeBadge.innerHTML = `<span class="acu-panel-headtag" style="padding: 2px 6px; font-size: 0.65rem;">TIEMPO: ${phase.duration}s</span>`;
          repDisplay.style.display = 'none';
          btnDone.style.opacity = '0.35';
          btnDone.style.pointerEvents = 'none';
        } else {
          modeBadge.innerHTML = `<span class="acu-panel-headtag" style="padding: 2px 6px; font-size: 0.65rem;">REPETICIONES: ${phase.reps}</span>`;
          repDisplay.style.display = 'block';
          repDisplay.textContent = `${phase.reps} REPETICIONES`;
          btnDone.style.opacity = '1';
          btnDone.style.pointerEvents = 'auto';
        }
      } else if (phase.type === 'rest-exercise') {
        stateBadge.textContent = 'Transición';
        stateBadge.className = 'acu-state-badge transition';

        const nextPhase = phases[currentPhaseIdx + 1];
        if (nextPhase && nextPhase.type === 'exercise') {
          exerciseName.textContent = 'Cambio de posición';
          exerciseFocus.textContent = `Siguiente: ${nextPhase.exercise.name}`;
          preparationEl.textContent = nextPhase.exercise.preparation;
          executionEl.textContent = '';
        }
        modeBadge.innerHTML = `<span class="acu-panel-headtag" style="padding: 2px 6px; font-size: 0.65rem;">DESCANSO: ${phase.duration}s</span>`;
        repDisplay.style.display = 'none';
        btnDone.style.opacity = '0.35';
        btnDone.style.pointerEvents = 'none';
      } else if (phase.type === 'rest-round') {
        stateBadge.textContent = 'Descanso entre rondas';
        stateBadge.className = 'acu-state-badge transition';
        exerciseName.textContent = `Ronda ${phase.round + 1} completada`;
        exerciseFocus.textContent = `Descansa antes de la Ronda ${phase.nextRound + 1}`;
        preparationEl.textContent = 'Recupera el aliento. Hidrátate si es necesario.';
        executionEl.textContent = '';
        modeBadge.innerHTML = `<span class="acu-panel-headtag" style="padding: 2px 6px; font-size: 0.65rem;">DESCANSO: ${phase.duration}s</span>`;
        repDisplay.style.display = 'none';
        // Manual transition: show "Start Next Round" as Done button
        btnDone.style.opacity = '1';
        btnDone.style.pointerEvents = 'auto';
        btnDone.title = `Empezar Ronda ${phase.nextRound + 1}`;
      }
    }

    // --- DOT GRID UPDATE ---
    function updateGrid() {
      const progressRatio = estimatedTotal > 0 ? elapsedSeconds / estimatedTotal : 0;
      const activeDotsCount = Math.min(5184, Math.floor(Math.min(1, progressRatio) * 5184));

      if (activeDotsCount === lastActiveDotsCount) return;
      lastActiveDotsCount = activeDotsCount;

      const phase = phases[currentPhaseIdx];
      let activeColor = '#2E7D32'; // Default green for exercise
      if (phase && (phase.type === 'rest-exercise' || phase.type === 'rest-round')) {
        activeColor = '#D35400'; // Orange for rest
      }

      dots.forEach((dot, idx) => {
        if (idx < activeDotsCount) {
          dot.style.setProperty('--dot-color', activeColor);
          dot.style.setProperty('--dot-glow', activeColor);
          dot.classList.add('active');
        } else {
          dot.classList.remove('active');
          dot.style.removeProperty('--dot-color');
          dot.style.removeProperty('--dot-glow');
        }
      });
    }

    // --- ADVANCE TO NEXT PHASE ---
    function advancePhase() {
      currentPhaseIdx++;
      if (currentPhaseIdx >= phases.length) {
        finishSession();
        return;
      }

      const phase = phases[currentPhaseIdx];

      if (phase.type === 'exercise') {
        if (phase.mode === 'time') {
          phaseTimeLeft = phase.duration;
          phaseDuration = phase.duration;
          phaseElapsed = 0;
        } else {
          // Reps mode: count up
          phaseTimeLeft = 0;
          phaseDuration = 0;
          phaseElapsed = 0;
        }
        playQuartzBowlRing(528, 1.5); // transition chime
      } else if (phase.type === 'rest-exercise') {
        phaseTimeLeft = phase.duration;
        phaseDuration = phase.duration;
        phaseElapsed = 0;
        // Auto countdown for exercise rest
      } else if (phase.type === 'rest-round') {
        phaseTimeLeft = phase.duration;
        phaseDuration = phase.duration;
        phaseElapsed = 0;
        // Pause timer — waiting for manual "Start Round X"
        isPaused = true;
        playQuartzBowlRing(432, 3.0); // round complete chime
        // Update play button to show paused state
        playIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
      }

      phaseStartTime = Date.now();
      phaseElapsedBeforePause = 0;
      syncDisplay();
    }

    // --- FINISH SESSION ---
    async function finishSession() {
      await cleanupTimer();
      playQuartzBowlRing(432, 4.5);

      // Update elapsed
      if (isSessionStarted && !isPaused) {
        elapsedSeconds++;
      }

      // Guardar sesión en base de datos local
      if (!orchestratorConfig) {
        try {
          await addData(db, 'sessions_log', {
            type: 'strength',
            date: new Date().toISOString(),
            duration: Math.max(1, Math.round(elapsedSeconds / 60)),
            notes: `Circuito completado: ${currentCircuit.name} (${currentCircuit.rounds} rondas).`,
            details: `Fuerza: ${escapeHTML(currentCircuit.name)}`
          });
        } catch (e) {
          console.error('[Strength] Error saving session log:', e);
        }
      }

      alert('¡Circuito completado!');
      if (orchestratorConfig) {
        orchestratorConfig.onComplete();
      } else {
        activeView = 'lobby';
        refresh();
      }
    }

    // --- TICK ---
    function tick() {
      if (isPaused) return;

      const phase = phases[currentPhaseIdx];
      if (!phase) return;

      elapsedSeconds++;

      if (phase.type === 'exercise' && phase.mode === 'reps') {
        // Count up for reps
        phaseElapsed++;
        const display = formatMMSS(phaseElapsed);
        renderDotMatrix(countdownMatrix, display);
        repDisplay.textContent = `${phase.reps} REPETICIONES — ${display}`;
      } else if (phase.type === 'exercise' && phase.mode === 'time') {
        // Count down for timed exercises
        phaseTimeLeft--;
        renderDotMatrix(countdownMatrix, formatMMSS(phaseTimeLeft));
        if (phaseTimeLeft <= 0) {
          advancePhase();
        }
      } else if (phase.type === 'rest-exercise') {
        // Auto countdown
        phaseTimeLeft--;
        renderDotMatrix(countdownMatrix, formatMMSS(phaseTimeLeft));
        if (phaseTimeLeft <= 0) {
          advancePhase();
        }
      } else if (phase.type === 'rest-round') {
        // Countdown but paused — user controls via Done button
        // If somehow running (shouldn't be), just count
        phaseTimeLeft--;
        renderDotMatrix(countdownMatrix, formatMMSS(phaseTimeLeft));
      }

      updateGrid();
    }

    // --- ANIMATION LOOP for grid ---
    function startAnimationLoop() {
      const animate = () => {
        updateGrid();
        gridAnimFrame = requestAnimationFrame(animate);
      };
      gridAnimFrame = requestAnimationFrame(animate);
    }

    // --- INITIALIZE DISPLAY ---
    syncDisplay();
    renderDotMatrix(countdownMatrix, '00:00');

    // --- BUTTON HANDLERS ---
    btnPlay.addEventListener('click', () => {
      if (!isSessionStarted) {
        // First start
        isSessionStarted = true;
        isPaused = false;

        const phase = phases[0];
        if (phase.type === 'exercise' && phase.mode === 'time') {
          phaseTimeLeft = phase.duration;
          phaseDuration = phase.duration;
        }
        phaseElapsed = 0;
        phaseStartTime = Date.now();
        phaseElapsedBeforePause = 0;

        syncDisplay();
        wakeLockController.request();

        timerInterval = setInterval(tick, 1000);
        startAnimationLoop();

        playIcon.innerHTML = '<rect x="5" y="4" width="4" height="16" rx="1"></rect><rect x="15" y="4" width="4" height="16" rx="1"></rect>';
        btnDone.style.opacity = phases[0].mode === 'reps' ? '1' : '0.35';
        btnDone.style.pointerEvents = phases[0].mode === 'reps' ? 'auto' : 'none';
      } else if (isPaused) {
        // Resume
        isPaused = false;
        phaseStartTime = Date.now();
        playIcon.innerHTML = '<rect x="5" y="4" width="4" height="16" rx="1"></rect><rect x="15" y="4" width="4" height="16" rx="1"></rect>';
      } else {
        // Pause
        isPaused = true;
        phaseElapsedBeforePause += Date.now() - phaseStartTime;
        playIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
      }
    });

    // Done button: complete reps exercise or start next round
    btnDone.addEventListener('click', () => {
      if (!isSessionStarted) return;
      const phase = phases[currentPhaseIdx];
      if (!phase) return;

      if (phase.type === 'exercise' && phase.mode === 'reps') {
        // Complete the reps exercise
        advancePhase();
      } else if (phase.type === 'rest-round') {
        // Start next round (manual transition)
        isPaused = false;
        advancePhase();
        playIcon.innerHTML = '<rect x="5" y="4" width="4" height="16" rx="1"></rect><rect x="15" y="4" width="4" height="16" rx="1"></rect>';
      }
    });

    // Exit
    btnExit.addEventListener('click', async () => {
      if (confirm('¿Deseas detener y cancelar el circuito actual? No se guardará en el historial.')) {
        await cleanupTimer();
        if (orchestratorConfig) {
          onNavigate('inicio');
        } else {
          activeView = 'lobby';
          refresh();
        }
      }
    });
  }

  // Initialize
  await refresh();
}
