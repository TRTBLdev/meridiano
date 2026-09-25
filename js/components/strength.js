import { addData, getAllData } from '../db.js';
import { escapeHTML } from '../utils/sanitize.js';
import { renderDotMatrix } from '../utils/dotmatrix.js';
import {
  buildStrengthPhaseList,
  createStrengthResult,
  deriveCircuitEquipment,
  estimateStrengthCircuitDuration,
  finalizeStrengthResult,
  getCircuitValidation,
  getEffectiveStrengthPrescription,
  getStrengthExercise,
  recordStrengthResultEntry,
  summarizeStrengthResult
} from '../utils/strengthUtils.js';
import { renderLobbyAction, renderLobbyShell, renderPracticeRow } from './lobbyUi.js';
import {
  createWakeLockController
} from './timerShell.js';
import { createStrengthDotField } from './strengthDotField.js';
import {
  renderStrengthCompletion,
  renderStrengthFlowControl,
  renderStrengthPhase,
  renderStrengthSkipConfirmation,
  renderStrengthTimerShell
} from './strengthTimerUi.js';
import { playQuartzBowlRing } from '../utils/synth.js';

export async function renderStrengthScreen(container, db, onNavigate, orchestratorConfig = null) {
  let activeView = 'lobby';
  let exercises = [];
  let circuits = [];
  let currentCircuit = null;
  let timerInterval = null;
  let isPaused = false;
  let isSessionStarted = false;
  let elapsedSeconds = 0;
  let cleanupTimerView = () => {};

  const wakeLockController = createWakeLockController();

  async function loadData() {
    try {
      exercises = await getAllData(db, 'strength_exercises');
      circuits = await getAllData(db, 'strength_circuits');
    } catch (error) {
      console.error('[Strength] Error loading data:', error);
    }
  }

  async function refresh() {
    await loadData();

    if (orchestratorConfig && !currentCircuit) {
      currentCircuit = circuits.find(circuit => circuit.id === orchestratorConfig.presetId) || null;
      if (currentCircuit && !getCircuitValidation(currentCircuit, exercises).isValid) {
        currentCircuit = null;
      }
      if (currentCircuit) {
        activeView = 'timer';
        isSessionStarted = false;
        isPaused = false;
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
    cleanupTimerView();
    cleanupTimerView = () => {};
    await wakeLockController.release();
  }

  function renderLobby() {
    const staging = document.createElement('div');
    staging.innerHTML = renderLobbyShell({
      title: 'Fuerza',
      variant: 'list',
      className: 'strength-lobby',
      content: `
        <span class="lobby-section-label">Circuitos disponibles</span>
        <div class="practice-list" id="lobby-circuits-list"></div>`
    });
    const layout = staging.firstElementChild;

    container.appendChild(layout);
    layout.querySelector('#btn-back-home').addEventListener('click', () => onNavigate('inicio'));

    const circuitsList = layout.querySelector('#lobby-circuits-list');
    if (circuits.length === 0) {
      circuitsList.innerHTML = '<p class="lobby-empty">No hay circuitos disponibles. Crea uno desde Syllabus &gt; Fuerza.</p>';
      return;
    }

    circuits.forEach(circuit => {
      const validation = getCircuitValidation(circuit, exercises);
      const circuitEntries = Array.isArray(circuit.exercises) ? circuit.exercises : [];
      const estimatedMin = Math.ceil(estimateStrengthCircuitDuration(circuit, exercises) / 60);
      const equipmentList = deriveCircuitEquipment(circuit, exercises).join(', ');
      const details = `
        <div class="practice-row__description">${escapeHTML(circuit.description || '')}</div>
        ${validation.isValid ? '' : `<div class="strength-circuit-warning" role="status">${escapeHTML(validation.reason)}. Repáralo desde Syllabus &gt; Fuerza.</div>`}
        ${equipmentList ? `<div style="font-size: 0.68rem; color: var(--color-text-muted); margin-bottom: 12px; font-family: var(--font-digital);">IMPLEMENTOS: ${escapeHTML(equipmentList)}</div>` : ''}
        <span class="practice-row__section-label">Ejercicios del circuito</span>
        <div class="practice-timeline">
          ${circuitEntries.map((entry, index) => {
            const exercise = getStrengthExercise(exercises, entry.exerciseId);
            if (!exercise) return `
              <div class="practice-timeline__item strength-circuit-missing-exercise">
                <span class="practice-timeline__index">${index + 1}</span>
                <div class="practice-timeline__body">
                  <span class="practice-timeline__title">Ejercicio no disponible</span>
                  <span class="practice-timeline__meta">Referencia: ${escapeHTML(entry.exerciseId)}</span>
                </div>
              </div>`;

            const prescription = getEffectiveStrengthPrescription(entry, exercise);
            const modeLabel = prescription.mode === 'time' ? `${prescription.duration}s` : `${prescription.reps} reps`;
            return `
              <div class="practice-timeline__item">
                <span class="practice-timeline__index">${index + 1}</span>
                <div class="practice-timeline__body">
                  <span class="practice-timeline__title">${escapeHTML(exercise.name)}</span>
                  <span class="practice-timeline__meta">${escapeHTML(exercise.focus)} — ${escapeHTML(modeLabel)}</span>
                </div>
              </div>`;
          }).join('')}
        </div>
        <div style="font-size: 0.65rem; color: var(--color-text-muted); font-family: var(--font-digital); margin-top: 8px;">
          DESCANSO ENTRE EJERCICIOS: ${circuit.restBetweenExercises}s · ENTRE RONDAS: ${circuit.restBetweenRounds}s
        </div>`;

      const rowStaging = document.createElement('div');
      rowStaging.innerHTML = renderPracticeRow({
        title: circuit.name,
        metadata: `${circuit.rounds}R × ${circuitEntries.length}E`,
        duration: `${estimatedMin} min`,
        details,
        actions: renderLobbyAction({
          kind: 'icon',
          icon: 'play',
          label: validation.isValid ? 'Iniciar circuito' : validation.reason,
          className: 'btn-play-header',
          disabled: !validation.isValid
        }),
        state: validation.isValid ? '' : 'invalid',
        className: 'strength-practice-row'
      });
      const row = rowStaging.firstElementChild;
      const header = row.querySelector('.practice-row__expand');
      const content = row.querySelector('.practice-row__details');
      const playButton = row.querySelector('.btn-play-header');

      header.addEventListener('click', () => {
        const expanded = row.classList.toggle('is-expanded');
        header.setAttribute('aria-expanded', String(expanded));
        content.hidden = !expanded;
      });
      if (validation.isValid) {
        playButton.addEventListener('click', event => {
          event.stopPropagation();
          startSession(circuit);
        });
      }
      circuitsList.appendChild(row);
    });
  }

  function startSession(circuit) {
    const validation = getCircuitValidation(circuit, exercises);
    if (!validation.isValid) {
      alert(`Este circuito no puede iniciarse: ${validation.reason}. Edítalo desde Syllabus > Fuerza.`);
      return;
    }
    currentCircuit = circuit;
    activeView = 'timer';
    isSessionStarted = false;
    isPaused = false;
    elapsedSeconds = 0;
    refresh();
  }

  function renderTimer() {
    const validation = getCircuitValidation(currentCircuit, exercises);
    if (!validation.isValid) {
      activeView = 'lobby';
      currentCircuit = null;
      renderLobby();
      return;
    }

    const phases = buildStrengthPhaseList(currentCircuit, exercises);
    const totalExercises = currentCircuit.exercises.length;
    const totalRounds = Number(currentCircuit.rounds);
    let currentPhaseIndex = 0;
    let phaseElapsed = 0;
    let phaseTimeLeft = 0;
    let waitingForRound = false;
    let skipResumeState = false;
    let result = createStrengthResult(currentCircuit);
    let finalResult = null;
    let isFinishing = false;

    const timerScreen = document.createElement('div');
    timerScreen.innerHTML = renderStrengthTimerShell({
      circuitName: currentCircuit.name,
      totalRounds,
      totalExercises
    });
    const root = timerScreen.firstElementChild;
    container.appendChild(root);

    const phaseContent = root.querySelector('#strength-phase-content');
    const skipConfirmation = root.querySelector('#strength-skip-confirm');
    const flowButton = root.querySelector('#btn-strength-flow');
    const flowIcon = root.querySelector('#strength-flow-icon');
    const flowLabel = root.querySelector('#strength-flow-label');
    const exitButton = root.querySelector('#btn-strength-exit');
    const sessionElapsed = root.querySelector('#strength-session-elapsed');
    const dotField = createStrengthDotField(root.querySelector('#strength-dots-grid'), {
      getElapsedSeconds: () => elapsedSeconds
    });
    cleanupTimerView = () => dotField.destroy();

    const formatMMSS = seconds => {
      const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
      return `${String(Math.floor(safeSeconds / 60)).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`;
    };

    function currentPhase() {
      return phases[currentPhaseIndex] || null;
    }

    function getNextExercise() {
      return phases.slice(currentPhaseIndex + 1).find(phase => phase.type === 'exercise')?.exercise || null;
    }

    function syncFlowControl() {
      if (waitingForRound || isFinishing) {
        flowButton.disabled = true;
        flowIcon.innerHTML = '';
        flowLabel.textContent = waitingForRound ? 'EN ESPERA' : 'COMPLETADO';
        flowButton.setAttribute('aria-label', flowLabel.textContent);
        return;
      }

      const control = renderStrengthFlowControl({ started: isSessionStarted, paused: isPaused });
      flowButton.disabled = false;
      flowIcon.innerHTML = control.icon;
      flowLabel.textContent = control.label;
      flowButton.setAttribute('aria-label', control.ariaLabel);
      flowButton.title = control.ariaLabel;
      setPhaseControlsEnabled(isSessionStarted && !isPaused);
    }

    function setPhaseControlsEnabled(enabled) {
      phaseContent.querySelectorAll('#strength-actual-reps, #btn-strength-rep-minus, #btn-strength-rep-plus, #strength-actual-weight, #btn-strength-weight-minus, #btn-strength-weight-plus, #btn-strength-register, #btn-strength-skip')
        .forEach(control => { control.disabled = !enabled; });
    }

    function syncTimeOutputs() {
      sessionElapsed.textContent = formatMMSS(elapsedSeconds);
      const phaseElapsedOutput = phaseContent.querySelector('#strength-phase-elapsed');
      if (phaseElapsedOutput) phaseElapsedOutput.textContent = formatMMSS(phaseElapsed);
    }

    function bindPhaseControls() {
      const phase = currentPhase();
      if (!phase) return;
      const boundPhaseIndex = currentPhaseIndex;

      if (phase.type === 'exercise' && phase.mode === 'reps') {
        const input = phaseContent.querySelector('#strength-actual-reps');
        const clampReps = value => Math.max(1, Math.min(999, Math.round(Number(value) || 1)));

        phaseContent.querySelector('#btn-strength-rep-minus').addEventListener('click', () => {
          input.value = clampReps(Number(input.value) - 1);
        });
        phaseContent.querySelector('#btn-strength-rep-plus').addEventListener('click', () => {
          input.value = clampReps(Number(input.value) + 1);
        });
        input.addEventListener('change', () => { input.value = clampReps(input.value); });

        // Controles de sobrecarga / peso utilizado
        const weightInput = phaseContent.querySelector('#strength-actual-weight');
        const weightHint = phaseContent.querySelector('#strength-weight-hint');
        const clampWeight = val => Math.max(0, Math.min(500, Math.round((Number(val) || 0) * 10) / 10));
        const syncHint = () => {
          if (weightHint && weightInput) {
            const val = Number(weightInput.value) || 0;
            weightHint.textContent = val === 0 ? 'CORP' : 'KG';
          }
        };

        const minusWeightBtn = phaseContent.querySelector('#btn-strength-weight-minus');
        const plusWeightBtn = phaseContent.querySelector('#btn-strength-weight-plus');

        if (minusWeightBtn && weightInput) {
          minusWeightBtn.addEventListener('click', () => {
            const cur = Number(weightInput.value) || 0;
            const step = cur > 5 ? 1 : 0.5;
            weightInput.value = clampWeight(Math.max(0, cur - step));
            syncHint();
          });
        }
        if (plusWeightBtn && weightInput) {
          plusWeightBtn.addEventListener('click', () => {
            const cur = Number(weightInput.value) || 0;
            const step = cur >= 5 ? 1 : 0.5;
            weightInput.value = clampWeight(cur + step);
            syncHint();
          });
        }
        if (weightInput) {
          weightInput.addEventListener('input', syncHint);
          weightInput.addEventListener('change', () => {
            weightInput.value = clampWeight(weightInput.value);
            syncHint();
          });
        }

        phaseContent.querySelector('#btn-strength-register').addEventListener('click', () => {
          if (currentPhaseIndex !== boundPhaseIndex) return;
          const actualReps = Number(input.value);
          if (!Number.isInteger(actualReps) || actualReps < 1 || actualReps > 999) {
            input.setCustomValidity('Ingresa un número de repeticiones entre 1 y 999.');
            input.reportValidity();
            return;
          }
          input.setCustomValidity('');
          const actualWeight = weightInput ? (parseFloat(weightInput.value) || 0) : 0;
          if (recordCurrentExercise('completed', actualReps, actualWeight)) advancePhase();
        });
      }

      const skipButton = phaseContent.querySelector('#btn-strength-skip');
      if (skipButton) skipButton.addEventListener('click', showSkipConfirmation);

      const nextRoundButton = phaseContent.querySelector('#btn-strength-next-round');
      if (nextRoundButton) {
        nextRoundButton.addEventListener('click', () => {
          waitingForRound = false;
          isPaused = false;
          advancePhase();
        });
      }
    }

    function renderCurrentPhase() {
      const phase = currentPhase();
      if (!phase) return;
      phaseContent.innerHTML = renderStrengthPhase({
        phase: phase.type.startsWith('rest') ? { ...phase, nextExercise: getNextExercise() } : phase,
        totalExercises,
        totalRounds,
        started: isSessionStarted && !isPaused,
        waitingForRound
      });
      bindPhaseControls();

      const matrix = phaseContent.querySelector('#strength-countdown-matrix');
      if (matrix) renderDotMatrix(matrix, formatMMSS(phaseTimeLeft));
      syncTimeOutputs();
      syncFlowControl();
    }

    function initializeCurrentPhase() {
      const phase = currentPhase();
      phaseElapsed = 0;
      waitingForRound = false;
      if (phase.type === 'exercise' && phase.mode === 'time') phaseTimeLeft = Number(phase.duration);
      else if (phase.type.startsWith('rest')) phaseTimeLeft = Number(phase.duration);
      else phaseTimeLeft = 0;

      if (phase.type === 'rest-round' && phaseTimeLeft <= 0) {
        waitingForRound = true;
        isPaused = true;
      }
      renderCurrentPhase();

      if (phase.type === 'rest-exercise' && phaseTimeLeft <= 0) {
        queueMicrotask(advancePhase);
      }
    }

    function recordCurrentExercise(status, actualValue = null, actualWeight = null) {
      const phase = currentPhase();
      if (!phase || phase.type !== 'exercise') return false;
      result = recordStrengthResultEntry(result, phase, {
        actualValue,
        actualWeight,
        elapsedSeconds: phaseElapsed,
        status
      });
      return true;
    }

    function advancePhase() {
      hideSkipConfirmation();
      currentPhaseIndex += 1;
      if (currentPhaseIndex >= phases.length) {
        finishSession();
        return;
      }

      const phase = currentPhase();
      if (phase.type === 'rest-round') playQuartzBowlRing(432, 3);
      else playQuartzBowlRing(528, 1.5);
      initializeCurrentPhase();
    }

    function showSkipConfirmation() {
      const phase = currentPhase();
      if (!phase || phase.type !== 'exercise') return;
      const confirmationPhaseIndex = currentPhaseIndex;
      skipResumeState = !isPaused;
      isPaused = true;
      skipConfirmation.innerHTML = renderStrengthSkipConfirmation(phase.exercise.name);
      skipConfirmation.hidden = false;
      syncFlowControl();

      skipConfirmation.querySelector('#btn-strength-cancel-skip').addEventListener('click', () => {
        isPaused = !skipResumeState;
        hideSkipConfirmation();
        syncFlowControl();
      });
      skipConfirmation.querySelector('#btn-strength-confirm-skip').addEventListener('click', () => {
        if (currentPhaseIndex !== confirmationPhaseIndex) return;
        if (!recordCurrentExercise('skipped')) return;
        isPaused = false;
        hideSkipConfirmation();
        advancePhase();
      });
      skipConfirmation.querySelector('#btn-strength-cancel-skip').focus();
    }

    function hideSkipConfirmation() {
      skipConfirmation.hidden = true;
      skipConfirmation.innerHTML = '';
    }

    async function finishSession() {
      if (isFinishing) return;
      isFinishing = true;
      await cleanupTimer();
      playQuartzBowlRing(432, 4.5);
      finalResult = finalizeStrengthResult(result, elapsedSeconds);

      let savedLogId = null;
      if (!orchestratorConfig) {
        try {
          savedLogId = await addData(db, 'sessions_log', {
            type: 'strength',
            date: new Date().toISOString(),
            duration: Math.max(1, Math.round(elapsedSeconds / 60)),
            activeDurationSeconds: elapsedSeconds,
            notes: `Circuito completado: ${currentCircuit.name} (${currentCircuit.rounds} rondas).`,
            details: `Fuerza: ${escapeHTML(currentCircuit.name)}`,
            strengthResult: finalResult,
            vitality: null
          });
        } catch (error) {
          console.error('[Strength] Error saving session log:', error);
        }
      }

      root.querySelector('.strength-timer__header').hidden = true;
      root.querySelector('.strength-timer__global-controls').hidden = true;
      skipConfirmation.hidden = true;
      phaseContent.innerHTML = renderStrengthCompletion({
        circuitName: currentCircuit.name,
        summary: summarizeStrengthResult(finalResult),
        continueLabel: orchestratorConfig ? 'CONTINUAR SESIÓN' : 'VOLVER A FUERZA',
        showVitality: !orchestratorConfig
      });

      const vitalityBtns = phaseContent.querySelectorAll('.btn-vitality-option');
      vitalityBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
          vitalityBtns.forEach(b => {
            b.style.borderColor = 'rgba(46,43,40,0.12)';
            b.style.background = 'rgba(46,43,40,0.04)';
          });
          btn.style.borderColor = 'var(--color-accent-green)';
          btn.style.background = 'rgba(0, 230, 118, 0.1)';
          const selectedVitality = btn.getAttribute('data-vitality');

          if (savedLogId && selectedVitality) {
            try {
              const tx = db.transaction('sessions_log', 'readwrite');
              const store = tx.objectStore('sessions_log');
              const req = store.get(savedLogId);
              req.onsuccess = () => {
                const rec = req.result;
                if (rec) {
                  rec.vitality = selectedVitality;
                  store.put(rec);
                }
              };
            } catch (e) {
              console.warn('[Strength] Could not update vitality:', e);
            }
          }
        });
      });

      phaseContent.querySelector('#btn-strength-completion-continue').addEventListener('click', () => {
        if (orchestratorConfig) {
          orchestratorConfig.onComplete(finalResult);
        } else {
          currentCircuit = null;
          activeView = 'lobby';
          refresh();
        }
      });
    }

    function tick() {
      if (!isSessionStarted || isPaused || isFinishing) return;
      const phase = currentPhase();
      if (!phase) return;

      elapsedSeconds += 1;
      if (phase.type === 'exercise') phaseElapsed += 1;
      syncTimeOutputs();
      dotField.sync(elapsedSeconds);

      if (!(phase.type === 'exercise' && phase.mode === 'reps')) {
        phaseTimeLeft = Math.max(0, phaseTimeLeft - 1);
        const matrix = phaseContent.querySelector('#strength-countdown-matrix');
        if (matrix) renderDotMatrix(matrix, formatMMSS(phaseTimeLeft));

        if (phaseTimeLeft === 0) {
          if (phase.type === 'exercise') {
            if (recordCurrentExercise('completed', Number(phase.duration))) advancePhase();
          } else if (phase.type === 'rest-exercise') {
            advancePhase();
          } else if (phase.type === 'rest-round') {
            waitingForRound = true;
            isPaused = true;
            playQuartzBowlRing(432, 2.5);
            renderCurrentPhase();
          }
        }
      }
    }

    flowButton.addEventListener('click', () => {
      if (!isSessionStarted) {
        isSessionStarted = true;
        isPaused = false;
        wakeLockController.request();
        clearInterval(timerInterval);
        timerInterval = setInterval(tick, 1000);
        renderCurrentPhase();
        return;
      }
      isPaused = !isPaused;
      setPhaseControlsEnabled(!isPaused);
      syncFlowControl();
    });

    exitButton.addEventListener('click', async () => {
      if (!isSessionStarted || confirm('¿Deseas detener y cancelar el circuito actual? No se guardará en el historial.')) {
        await cleanupTimer();
        if (orchestratorConfig) onNavigate('inicio');
        else {
          currentCircuit = null;
          activeView = 'lobby';
          refresh();
        }
      }
    });

    initializeCurrentPhase();
  }

  await refresh();
}
