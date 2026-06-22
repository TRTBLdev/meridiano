import { addData, getAllData } from '../db.js';
import { renderDotMatrix } from '../utils/dotmatrix.js';
import {
  bindSynthPanel,
  bindWakeLockPreference,
  createTimerShell,
  createWakeLockController,
  renderSynthPanel,
  renderWakeLockPreference,
  populateTimerDots
} from './timerShell.js';

export async function renderBreathworkScreen(container, db, onNavigate, appController) {
  let activeView = 'lobby';

  // Lobby state
  let mode = 'single'; // 'single' o 'sequential'
  let singlePatternId = 'breath-box';
  let singleMins = 5;
  let singleSecs = 0;
  let blocks = [
    { patternId: 'breath-box', mins: 5, secs: 0 }
  ];

  let patterns = [];
  
  let timerInterval = null;
  let elapsedSeconds = 0;
  let timeLeft = 0;
  let totalDuration = 0;
  let isPaused = false;
  let activeBlockIndex = 0;
  let blockBoundaries = [];

  // Variables de ciclo de respiración
  let cycleTimer = null;
  let currentPhase = 'inhale'; // inhale, holdIn, exhale, holdOut
  let phaseTimeLeft = 0;
  let cycleProgress = 0; // 0 a 1

  let localFreq = 6.0; // Alpha/Theta
  let localBaseFreq = 432;
  let localAudioMode = 'binaural';
  let localAudioActive = false;

  const wakeLockController = createWakeLockController();

  const syncWithGlobalTuner = () => {
    if (!appController || typeof appController.getAudioState !== 'function') return;
    const tunerState = appController.getAudioState();
    localBaseFreq = tunerState.baseFreq;
    localFreq = tunerState.diffFreq;
    localAudioMode = tunerState.audioMode;
    localAudioActive = tunerState.isAudioActive;
  };

  const getAudioState = () => ({
    baseFreq: localBaseFreq,
    diffFreq: localFreq,
    audioMode: localAudioMode,
    isAudioActive: localAudioActive
  });

  const setAudioState = (next) => {
    if (next.baseFreq !== undefined) localBaseFreq = next.baseFreq;
    if (next.diffFreq !== undefined) localFreq = next.diffFreq;
    if (next.audioMode !== undefined) localAudioMode = next.audioMode;
    if (next.isAudioActive !== undefined) localAudioActive = next.isAudioActive;
  };

  // Cargar patrones
  try {
    patterns = await getAllData(db, 'breathwork_patterns');
  } catch (err) {
    console.error('[Breathwork] Error fetching patterns:', err);
    patterns = [
      { id: 'breath-box', name: 'Respiración Cuadrada (Sama Vritti)', description: 'Balancea el sistema nervioso autónomo y reduce la ansiedad.', inhale: 4, holdIn: 4, exhale: 4, holdOut: 4 },
      { id: 'breath-calm', name: 'Respiración Calmante (4-7-8)', description: 'Poderoso somnífero y calmante mental instantáneo.', inhale: 4, holdIn: 7, exhale: 8, holdOut: 0 }
    ];
  }

  const render = () => {
    container.innerHTML = '';
    if (activeView === 'timer') renderTimer();
    else renderLobby();
  };

  function renderLobby() {
    syncWithGlobalTuner();

    const lobbyEl = document.createElement('div');
    lobbyEl.className = 'dashboard-layout fade-in';
    lobbyEl.innerHTML = `
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

      <main class="main-viewport breath-lobby-viewport">
        <div class="glass-panel breath-lobby-panel" style="max-width: 600px; margin: 0 auto;">
          <h2 class="module-lobby-title" style="margin-bottom: 24px;">RESPIRACIÓN</h2>

          <div class="timer-config-group">
            <label>MODO DE PRÁCTICA</label>
            <div class="segmented-control">
              <button type="button" class="segment-btn ${mode === 'single' ? 'active' : ''}" data-type="single">Técnica Única</button>
              <button type="button" class="segment-btn ${mode === 'sequential' ? 'active' : ''}" data-type="sequential">Secuencia</button>
            </div>
          </div>

          <div id="interval-settings-container" class="meditation-interval-settings"></div>

          ${renderWakeLockPreference()}

          <div style="display: flex; justify-content: flex-end; margin-top: 24px;">
            <button id="btn-breath-start" class="btn-play-header" title="Iniciar Ejercicio" style="width: 54px; height: 54px; display: flex; align-items: center; justify-content: center; background: var(--color-text-main); color: var(--color-bg-base); border-radius: 50%; border: none;">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style="margin-left: 2px;">
                <polygon points="6 4 19 12 6 20 6 4"></polygon>
              </svg>
            </button>
          </div>
        </div>
      </main>
    `;

    container.appendChild(lobbyEl);
    bindWakeLockPreference(lobbyEl);

    const intervalContainer = lobbyEl.querySelector('#interval-settings-container');

    const renderIntervalSettings = () => {
      if (mode === 'sequential') {
        const totalSeconds = blocks.reduce((sum, block) => sum + block.mins * 60 + block.secs, 0);
        const totalLabel = `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`;
        intervalContainer.innerHTML = `
          <div class="timer-config-group">
            <div class="timer-config-heading">
              <label>SECUENCIA DE TÉCNICAS</label>
              <span style="font-family: var(--font-digital); color: var(--color-text-muted); font-size: 0.75rem;">TOTAL: ${totalLabel}</span>
            </div>
            <div class="meditation-block-list">
              ${blocks.map((block, index) => `
                <div class="meditation-block-row" data-index="${index}" style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 12px 0; border-bottom: 1px dashed rgba(46,43,40,0.1);">
                  <span style="font-size: 0.7rem; font-weight: 600; min-width: 60px;">PASO ${index + 1}</span>
                  <select class="block-pattern-select acu-select-flat" style="flex: 1; min-width: 150px; font-size: 0.8rem; padding: 4px;">
                    ${patterns.map(p => `<option value="${p.id}" ${p.id === block.patternId ? 'selected' : ''}>${p.name}</option>`).join('')}
                  </select>
                  <div style="display: flex; gap: 4px; align-items: center;">
                    <input type="number" class="block-mins-input acu-step-num-input" min="0" max="60" value="${block.mins}" style="width: 45px; padding: 4px;">
                    <span style="font-size: 0.75rem;">m</span>
                    <input type="number" class="block-secs-input acu-step-num-input" min="0" max="59" value="${block.secs}" style="width: 45px; padding: 4px;">
                    <span style="font-size: 0.75rem;">s</span>
                  </div>
                  <button type="button" class="btn-delete-block" title="Eliminar paso" style="background: transparent; border: none; color: var(--color-accent-red); cursor: pointer; font-size: 1.2rem; padding: 0 4px;">×</button>
                </div>
              `).join('')}
            </div>
            <button type="button" id="btn-add-block" class="btn-block-action" style="margin-top: 16px; background: transparent; border: 1px solid rgba(46,43,40,0.2); border-radius: 4px; padding: 8px; width: 100%; font-size: 0.8rem; cursor: pointer;" ${blocks.length >= 10 ? 'disabled' : ''}>+ Añadir Técnica (${blocks.length}/10)</button>
          </div>
        `;

        intervalContainer.querySelectorAll('.meditation-block-row').forEach(row => {
          const index = parseInt(row.dataset.index);
          row.querySelector('.block-pattern-select').addEventListener('change', (event) => {
            blocks[index].patternId = event.target.value;
          });
          row.querySelector('.block-mins-input').addEventListener('input', (event) => {
            blocks[index].mins = Math.max(0, parseInt(event.target.value) || 0);
            renderIntervalSettings();
          });
          row.querySelector('.block-secs-input').addEventListener('input', (event) => {
            blocks[index].secs = Math.max(0, Math.min(59, parseInt(event.target.value) || 0));
            renderIntervalSettings();
          });
          row.querySelector('.btn-delete-block').addEventListener('click', () => {
            if (blocks.length <= 1) {
              alert('La secuencia debe contener al menos una técnica.');
              return;
            }
            blocks.splice(index, 1);
            renderIntervalSettings();
          });
        });

        const addBlock = intervalContainer.querySelector('#btn-add-block');
        if (addBlock) {
          addBlock.addEventListener('click', () => {
            if (blocks.length >= 10) return;
            blocks.push({ patternId: patterns[0]?.id, mins: 5, secs: 0 });
            renderIntervalSettings();
          });
        }
        return;
      }

      // Single mode
      const currentPattern = patterns.find(p => p.id === singlePatternId) || patterns[0];
      intervalContainer.innerHTML = `
        <div class="timer-config-group" style="margin-bottom: 20px;">
          <label>TÉCNICA DE RESPIRACIÓN</label>
          <select id="breath-pattern-select" class="acu-select-flat" style="margin-top: 8px;">
            ${patterns.map(p => `<option value="${p.id}" ${p.id === singlePatternId ? 'selected' : ''}>${p.name}</option>`).join('')}
          </select>
          <p id="breath-pattern-desc" style="font-size: 0.78rem; color: var(--color-text-muted); margin-top: 8px; line-height: 1.4;">
            ${currentPattern?.description || ''}
          </p>
        </div>

        <div class="timer-config-group" style="margin-bottom: 24px;">
          <label>DURACIÓN</label>
          <div class="timer-time-row" style="display: flex; gap: 8px; align-items: center; margin-top: 8px;">
            <input type="number" id="lobby-breath-mins" class="acu-step-num-input" min="0" max="180" value="${singleMins}" style="width: 60px;">
            <span>min</span>
            <input type="number" id="lobby-breath-secs" class="acu-step-num-input" min="0" max="59" value="${singleSecs}" style="width: 60px;">
            <span>seg</span>
          </div>
        </div>
      `;

      intervalContainer.querySelector('#breath-pattern-select').addEventListener('change', (e) => {
        singlePatternId = e.target.value;
        const pat = patterns.find(p => p.id === singlePatternId);
        const desc = intervalContainer.querySelector('#breath-pattern-desc');
        if (pat && desc) desc.textContent = pat.description;
      });

      intervalContainer.querySelector('#lobby-breath-mins').addEventListener('input', (e) => {
        singleMins = Math.max(0, parseInt(e.target.value) || 0);
      });
      intervalContainer.querySelector('#lobby-breath-secs').addEventListener('input', (e) => {
        singleSecs = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
      });
    };

    lobbyEl.querySelectorAll('.segment-btn').forEach(button => {
      button.addEventListener('click', () => {
        mode = button.dataset.type;
        lobbyEl.querySelectorAll('.segment-btn').forEach(item => item.classList.remove('active'));
        button.classList.add('active');
        renderIntervalSettings();
      });
    });

    renderIntervalSettings();

    lobbyEl.querySelector('#btn-back-home').addEventListener('click', () => onNavigate('inicio'));
    lobbyEl.querySelector('#btn-breath-start').addEventListener('click', startBreathwork);
  }

  function startBreathwork() {
    blockBoundaries = [];
    if (mode === 'sequential') {
      totalDuration = blocks.reduce((sum, block) => sum + block.mins * 60 + block.secs, 0);
      let boundary = 0;
      blocks.forEach(block => {
        boundary += block.mins * 60 + block.secs;
        blockBoundaries.push(boundary);
      });
    } else {
      totalDuration = singleMins * 60 + singleSecs;
    }

    if (totalDuration <= 0) {
      alert('Por favor, indica una duración mayor a 0 segundos.');
      return;
    }

    timeLeft = totalDuration;
    elapsedSeconds = 0;
    isPaused = false;
    activeBlockIndex = 0;
    activeView = 'timer';
    render();
  }

  // Sintetizador de tonos suaves para guiar la respiración (Phase Transition Chimes)
  function playPhaseChime(phase) {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      osc.type = 'sine';
      
      // Diferentes frecuencias para cada fase
      if (phase === 'inhale') {
        osc.frequency.setValueAtTime(440, audioCtx.currentTime); // La
      } else if (phase === 'holdIn') {
        osc.frequency.setValueAtTime(554, audioCtx.currentTime); // Do#
      } else if (phase === 'exhale') {
        osc.frequency.setValueAtTime(330, audioCtx.currentTime); // Mi
      } else if (phase === 'holdOut') {
        osc.frequency.setValueAtTime(277, audioCtx.currentTime); // Do# grave
      }

      gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.08, audioCtx.currentTime + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);

      osc.connect(gain).connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch (e) {
      console.warn('[Audio] Failed to play phase chime:', e);
    }
  }

  function renderTimer() {
    const getCurrentPattern = () => {
      if (mode === 'sequential') {
        const safeIndex = blockBoundaries.findIndex(boundary => elapsedSeconds < boundary);
        const b = blocks[safeIndex === -1 ? blocks.length - 1 : safeIndex];
        return patterns.find(p => p.id === b.patternId) || patterns[0];
      }
      return patterns.find(p => p.id === singlePatternId) || patterns[0];
    };

    let pattern = getCurrentPattern();
    const canSkip = mode === 'sequential' && blocks.length > 1;

    // Inicializar fase
    currentPhase = 'inhale';
    phaseTimeLeft = pattern.inhale;

    const timerEl = createTimerShell({
      gridId: 'breath-dots-grid',
      className: 'breathwork-active-timer',
      content: `
        <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; gap:20px; z-index:10; position:relative; width:100%; height:100%;">
          
          <!-- Orbe de respiración central puro -->
          <div id="breath-visual-container" class="breath-visual-container" style="position:relative; width:300px; height:300px; display:flex; align-items:center; justify-content:center; margin: auto;">
            <div id="breath-orb" class="breath-orb" style="position:absolute; width:100%; height:100%; border-radius:50%; background:radial-gradient(circle, rgba(236, 72, 153, 0.6) 0%, rgba(168, 85, 247, 0.25) 50%, rgba(0,0,0,0) 75%); transition: transform 0.1s linear, background 0.5s ease; transform: scale(0.35); filter: blur(60px);"></div>
            <div style="z-index: 2; display: flex; flex-direction: column; align-items: center; justify-content: center;">
               <div id="breath-phase-text" class="breath-phase-text-display"></div>
               <div id="breath-phase-sec" class="breath-phase-sec-display"></div>
            </div>
          </div>

          <div id="breath-countdown-readout" class="breath-timer-dot-display"></div>
          <div id="breath-subtle-readout" class="timer-subtle-readout" style="font-family:var(--font-digital); font-size:0.85rem; text-transform:uppercase; color:var(--color-text-muted); text-align: center; max-width: 80%;"></div>

          <div id="breath-timer-controls" class="timer-minimal-controls">
            ${renderSynthPanel({
              idPrefix: 'breath-active',
              baseFreq: localBaseFreq,
              diffFreq: localFreq,
              audioMode: localAudioMode,
              isAudioActive: localAudioActive,
              statusWithWave: false,
              compact: true,
              dark: true,
              optionClass: 'timer-dropdown-option'
            })}

            <div class="timer-icon-controls">
              <div class="timer-icon-control-group">
                <button class="btn-acu-icon btn-acu-active" id="btn-breath-flow" title="Pausar" style="width:48px; height:48px; display:flex; align-items:center; justify-content:center; pointer-events:auto; cursor:pointer;">
                  <svg id="svg-breath-flow-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <rect x="6" y="4" width="3" height="16" rx="1"></rect>
                    <rect x="15" y="4" width="3" height="16" rx="1"></rect>
                  </svg>
                </button>
                <span id="lbl-breath-flow">Pausar</span>
              </div>

              <div class="timer-icon-control-group">
                <button class="btn-acu-icon" id="btn-breath-skip" title="Saltar paso" ${canSkip ? '' : 'disabled'} style="width:48px; height:48px; display:flex; align-items:center; justify-content:center; pointer-events:auto; cursor:pointer; ${canSkip ? '' : 'opacity:0.35; pointer-events:none;'}">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                    <polygon points="4 3 13 12 4 21 4 3" fill="currentColor"></polygon>
                    <line x1="17" y1="4" x2="17" y2="20"></line>
                  </svg>
                </button>
                <span>Saltar</span>
              </div>

              <div class="timer-icon-control-group">
                <button class="btn-acu-icon btn-acu-danger" id="btn-breath-stop" title="Detener" style="width:48px; height:48px; display:flex; align-items:center; justify-content:center; pointer-events:auto; cursor:pointer;">
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <rect x="5" y="5" width="14" height="14" rx="1"></rect>
                  </svg>
                </button>
                <span>Detener</span>
              </div>
            </div>
          </div>
        </div>
      `
    });

    container.appendChild(timerEl);
    
    // Iniciar rejilla de puntos
    const totalDotsCount = 5184;
    const dots = populateTimerDots(timerEl.querySelector('#breath-dots-grid'), totalDotsCount);
    const countdownReadout = timerEl.querySelector('#breath-countdown-readout');
    const subtleReadout = timerEl.querySelector('#breath-subtle-readout');
    const phaseText = timerEl.querySelector('#breath-phase-text');
    const phaseSec = timerEl.querySelector('#breath-phase-sec');
    const orb = timerEl.querySelector('#breath-orb');
    const btnFlow = timerEl.querySelector('#btn-breath-flow');
    const btnSkip = timerEl.querySelector('#btn-breath-skip');
    const btnStop = timerEl.querySelector('#btn-breath-stop');
    const flowIcon = timerEl.querySelector('#svg-breath-flow-icon');
    const flowLabel = timerEl.querySelector('#lbl-breath-flow');

    let phaseStartTime = Date.now();
    let phaseElapsedBeforePause = 0;

    const synthController = bindSynthPanel({
      root: timerEl,
      idPrefix: 'breath-active',
      appController,
      statusWithWave: false,
      getState: getAudioState,
      setState: setAudioState,
      onChange: updateDisplay
    });

    function getElapsedMs() {
      return isPaused ? phaseElapsedBeforePause : phaseElapsedBeforePause + (Date.now() - phaseStartTime);
    }

    function updateDisplay() {
      // Checar cambio de bloque en modo secuencial
      const newPattern = getCurrentPattern();
      if (newPattern.id !== pattern.id) {
        pattern = newPattern;
        currentPhase = 'inhale';
        phaseTimeLeft = pattern.inhale;
        cycleProgress = 0;
      }

      const mins = Math.floor(Math.max(0, timeLeft) / 60);
      const secs = Math.max(0, timeLeft) % 60;
      renderDotMatrix(countdownReadout, `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);
      
      let readoutStr = pattern.name;
      if (mode === 'sequential') {
        const safeIndex = blockBoundaries.findIndex(boundary => elapsedSeconds < boundary);
        const idx = safeIndex === -1 ? blockBoundaries.length - 1 : safeIndex;
        readoutStr = `Paso ${idx + 1}/${blocks.length}: ${pattern.name}`;
      }
      subtleReadout.textContent = readoutStr;

      // Mostrar segundos de fase redondeados
      renderDotMatrix(phaseSec, `${Math.ceil(phaseTimeLeft)}`);

      // Mapear fase a texto y aplicar gradiente de color correspondiente
      const phaseNameMap = {
        'inhale': 'INHALAR',
        'holdIn': 'RETENER',
        'exhale': 'EXHALAR',
        'holdOut': 'VACIO'
      };
      const currentPhaseName = phaseNameMap[currentPhase] || 'INHALAR';
      if (phaseText.getAttribute('data-current-phase') !== currentPhaseName) {
        phaseText.setAttribute('data-current-phase', currentPhaseName);
        renderDotMatrix(phaseText, currentPhaseName);
      }

      if (currentPhase === 'inhale') {
        orb.style.background = 'radial-gradient(circle, rgba(236, 72, 153, 0.6) 0%, rgba(244, 63, 94, 0.3) 50%, rgba(0, 0, 0, 0) 75%)';
      } else if (currentPhase === 'holdIn') {
        orb.style.background = 'radial-gradient(circle, rgba(254, 240, 138, 0.75) 0%, rgba(236, 72, 153, 0.45) 40%, rgba(0, 0, 0, 0) 75%)';
      } else if (currentPhase === 'exhale') {
        orb.style.background = 'radial-gradient(circle, rgba(67, 56, 202, 0.65) 0%, rgba(99, 102, 241, 0.3) 50%, rgba(0, 0, 0, 0) 75%)';
      } else if (currentPhase === 'holdOut') {
        orb.style.background = 'radial-gradient(circle, rgba(20, 184, 166, 0.25) 0%, rgba(0, 0, 0, 0) 70%)';
      }
    }

    // Actualiza la escala del orbe en base al progreso de respiración (escala expansiva 0.5 a 3.0)
    function updateOrb() {
      let scale = 0.5;
      
      if (currentPhase === 'inhale') {
        // Expansión lineal de 0.5 a 3.0
        scale = 0.5 + cycleProgress * 2.5;
      } else if (currentPhase === 'holdIn') {
        // Mantener al máximo (3.0)
        scale = 3.0;
      } else if (currentPhase === 'exhale') {
        // Contracción lineal de 3.0 a 0.5
        scale = 3.0 - cycleProgress * 2.5;
      } else if (currentPhase === 'holdOut') {
        // Mantener al mínimo (0.5)
        scale = 0.5;
      }

      orb.style.transform = `scale(${scale})`;
    }

    const setPaused = (paused) => {
      isPaused = paused;
      btnFlow.classList.toggle('btn-acu-active', !isPaused);
      btnFlow.title = isPaused ? 'Reanudar' : 'Pausar';
      flowLabel.textContent = isPaused ? 'Reanudar' : 'Pausar';
      flowIcon.innerHTML = isPaused
        ? '<polygon points="6 4 19 12 6 20 6 4"></polygon>'
        : '<rect x="6" y="4" width="3" height="16" rx="1"></rect><rect x="15" y="4" width="3" height="16" rx="1"></rect>';

      if (isPaused) {
        phaseElapsedBeforePause += Date.now() - phaseStartTime;
      } else {
        phaseStartTime = Date.now();
      }
    };

    const cleanupTimer = async () => {
      clearInterval(timerInterval);
      clearInterval(cycleTimer);
      if (localAudioActive && appController) appController.stopAudio();
      await wakeLockController.release();
    };

    const finishBreathwork = async () => {
      await cleanupTimer();
      if (appController.playQuartzBowl) {
        appController.playQuartzBowl(432, 4.5);
      }

      const durationMin = Math.max(1, Math.round(totalDuration / 60));
      try {
        await addData(db, 'sessions_log', {
          type: 'breathwork',
          date: new Date().toISOString(),
          duration: durationMin,
          notes: `Sesión de respiración completada (${durationMin} min).`,
          details: pattern.name
        });
      } catch (err) {
        console.error('[Breathwork] Error saving session:', err);
      }

      alert('Sesión de respiración completada.');
      activeView = 'lobby';
      render();
    };

    // Temporizador principal de segundos
    timerInterval = setInterval(() => {
      if (isPaused) return;
      timeLeft--;
      elapsedSeconds++;
      
      if (timeLeft <= 0) {
        finishBreathwork();
      }
    }, 1000);

    // Lazo de ciclo de respiración preciso (actualización rápida para fluidez del orbe)
    const updateCycle = () => {
      if (isPaused) return;

      phaseTimeLeft -= 0.1;
      
      let phaseDuration = pattern.inhale;
      if (currentPhase === 'holdIn') phaseDuration = pattern.holdIn;
      else if (currentPhase === 'exhale') phaseDuration = pattern.exhale;
      else if (currentPhase === 'holdOut') phaseDuration = pattern.holdOut;

      cycleProgress = Math.max(0, Math.min(1, (phaseDuration - phaseTimeLeft) / phaseDuration));
      
      updateDisplay();
      updateOrb();

      if (phaseTimeLeft <= 0) {
        // Cambiar fase
        if (currentPhase === 'inhale') {
          if (pattern.holdIn > 0) {
            currentPhase = 'holdIn';
            phaseTimeLeft = pattern.holdIn;
          } else {
            currentPhase = 'exhale';
            phaseTimeLeft = pattern.exhale;
          }
        } else if (currentPhase === 'holdIn') {
          currentPhase = 'exhale';
          phaseTimeLeft = pattern.exhale;
        } else if (currentPhase === 'exhale') {
          if (pattern.holdOut > 0) {
            currentPhase = 'holdOut';
            phaseTimeLeft = pattern.holdOut;
          } else {
            currentPhase = 'inhale';
            phaseTimeLeft = pattern.inhale;
          }
        } else if (currentPhase === 'holdOut') {
          currentPhase = 'inhale';
          phaseTimeLeft = pattern.inhale;
        }
        cycleProgress = 0;
        playPhaseChime(currentPhase);
      }
    };

    cycleTimer = setInterval(updateCycle, 100);

    btnFlow.addEventListener('click', () => setPaused(!isPaused));

    if (btnSkip) {
      btnSkip.addEventListener('click', () => {
        if (!canSkip) return;
        const safeIndex = blockBoundaries.findIndex(boundary => elapsedSeconds < boundary);
        const currentIndex = safeIndex === -1 ? blockBoundaries.length - 1 : safeIndex;
        const nextBoundary = blockBoundaries[currentIndex] || totalDuration;
        elapsedSeconds = Math.min(nextBoundary, totalDuration);
        timeLeft = Math.max(0, totalDuration - elapsedSeconds);
        phaseStartTime = Date.now();
        phaseElapsedBeforePause = elapsedSeconds * 1000;
        
        currentPhase = 'inhale';
        cycleProgress = 0;
        
        if (appController.playQuartzBowl && timeLeft > 0) appController.playQuartzBowl(648, 2.4);
        updateDisplay();
        if (timeLeft <= 0) finishBreathwork();
      });
    }

    btnStop.addEventListener('click', async () => {
      const wasPaused = isPaused;
      if (!isPaused) setPaused(true);
      if (confirm('¿Deseas detener y cancelar el ejercicio actual? No se guardará en el historial.')) {
        await cleanupTimer();
        activeView = 'lobby';
        render();
      } else if (!wasPaused) {
        setPaused(false);
      }
    });

    if (appController.playQuartzBowl) appController.playQuartzBowl(432, 4.0);
    playPhaseChime('inhale');
    wakeLockController.request();
    updateDisplay();
    synthController.sync();
  }

  render();
}
