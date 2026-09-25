import { escapeAttribute, escapeHTML } from '../utils/sanitize.js';
import { renderTechniqueDetails } from './techniqueDetails.js';

const ICONS = {
  play: '<polygon points="6 4 19 12 6 20 6 4"></polygon>',
  pause: '<rect x="6" y="4" width="3" height="16"></rect><rect x="15" y="4" width="3" height="16"></rect>',
  stop: '<rect x="5" y="5" width="14" height="14"></rect>'
};

function renderIcon(name) {
  return `<svg viewBox="0 0 24 24" aria-hidden="true" fill="currentColor">${ICONS[name]}</svg>`;
}

export function renderStrengthTimerShell({ circuitName, totalRounds, totalExercises }) {
  return `
    <main class="strength-timer fade-in" aria-label="Circuito ${escapeAttribute(circuitName)}">
      <div class="strength-timer__grid" id="strength-dots-grid" aria-hidden="true"></div>
      <div class="strength-timer__ambient" aria-hidden="true"></div>
      <section class="strength-timer__instrument">
        <header class="strength-timer__header">
          <span class="strength-timer__circuit">${escapeHTML(circuitName)}</span>
          <div class="strength-timer__header-data">
            <span class="strength-timer__scope">${Number(totalRounds)} RONDAS · ${Number(totalExercises)} EJERCICIOS</span>
            <span class="strength-timer__total-time">TIEMPO TOTAL <output id="strength-session-elapsed">00:00</output></span>
          </div>
        </header>
        <div class="strength-timer__phase" id="strength-phase-content"></div>
        <div class="strength-timer__skip-confirm" id="strength-skip-confirm" hidden></div>
        <footer class="strength-timer__global-controls">
          <button class="strength-timer__icon-action" id="btn-strength-flow" type="button" aria-label="Iniciar circuito" title="Iniciar circuito">
            <span id="strength-flow-icon">${renderIcon('play')}</span>
            <span id="strength-flow-label">INICIAR</span>
          </button>
          <button class="strength-timer__icon-action strength-timer__icon-action--danger" id="btn-strength-exit" type="button" aria-label="Detener circuito" title="Detener circuito">
            ${renderIcon('stop')}
            <span>DETENER</span>
          </button>
        </footer>
      </section>
    </main>`;
}

export function renderStrengthPhase({ phase, totalExercises, totalRounds, started, waitingForRound = false }) {
  if (phase.type === 'exercise') {
    const isReps = phase.mode === 'reps';
    const target = isReps ? phase.reps : phase.duration;
    const currentWeight = Number.isFinite(Number(phase.weightKg))
      ? Number(phase.weightKg)
      : (Number.isFinite(Number(phase.exercise?.defaultWeight)) ? Number(phase.exercise.defaultWeight) : 0);

    return `
      <div class="strength-timer__phase-meta">
        <span>EJERCICIO ${phase.exerciseIndex + 1}/${totalExercises}</span>
        <span>RONDA ${phase.round + 1}/${totalRounds}</span>
      </div>
      <progress class="strength-timer__progress" max="100" value="${((phase.round * totalExercises + phase.exerciseIndex) / (totalRounds * totalExercises)) * 100}" aria-label="Progreso del circuito"></progress>
      <h1 class="strength-timer__title">${escapeHTML(phase.exercise.name)}</h1>
      <p class="strength-timer__focus">${escapeHTML(phase.exercise.focus || '')}</p>
      ${isReps ? `
        <div class="strength-timer__measurements">
          <div class="strength-timer__metrics-group">
            <div class="strength-timer__rep-metric" aria-label="Repeticiones realizadas frente al objetivo">
              <button type="button" id="btn-strength-rep-minus" aria-label="Restar una repetición" ${started ? '' : 'disabled'}>−</button>
              <label>
                <span>REALIZADAS</span>
                <input id="strength-actual-reps" type="number" inputmode="numeric" min="1" step="1" value="${Number(target)}" ${started ? '' : 'disabled'}>
              </label>
              <span class="strength-timer__rep-divider">/</span>
              <span class="strength-timer__rep-target"><small>OBJETIVO</small>${Number(target)}</span>
              <button type="button" id="btn-strength-rep-plus" aria-label="Sumar una repetición" ${started ? '' : 'disabled'}>+</button>
            </div>
            <div class="strength-timer__weight-metric" aria-label="Carga o peso adicional en kilogramos">
              <button type="button" id="btn-strength-weight-minus" aria-label="Restar carga" ${started ? '' : 'disabled'}>−</button>
              <label>
                <span>CARGA</span>
                <div class="strength-timer__weight-val-wrap">
                  <input id="strength-actual-weight" type="number" inputmode="decimal" min="0" step="0.5" value="${currentWeight}" ${started ? '' : 'disabled'}>
                  <span class="strength-timer__weight-unit" id="strength-weight-hint">${currentWeight === 0 ? 'CORP' : 'KG'}</span>
                </div>
              </label>
              <button type="button" id="btn-strength-weight-plus" aria-label="Sumar carga" ${started ? '' : 'disabled'}>+</button>
            </div>
          </div>
          <div class="strength-timer__exercise-time">
            <span>TIEMPO DEL EJERCICIO</span>
            <output id="strength-phase-elapsed">00:00</output>
          </div>
        </div>
        <p class="strength-timer__metric-note">REGISTRO SIN CONFIRMAR</p>` : `
        <div class="strength-timer__matrix" id="strength-countdown-matrix" aria-label="Tiempo restante"></div>
        <p class="strength-timer__metric-note">OBJETIVO · ${Number(target)} SEGUNDOS</p>`}
      ${renderInstructions(phase.exercise)}
      <div class="strength-timer__phase-actions">
        ${isReps ? `<button class="strength-timer__text-action" id="btn-strength-register" type="button" ${started ? '' : 'disabled'}>REGISTRAR Y CONTINUAR</button>` : ''}
        <button class="strength-timer__quiet-action" id="btn-strength-skip" type="button" ${started ? '' : 'disabled'}>SALTAR EJERCICIO</button>
      </div>`;
  }

  const isRoundRest = phase.type === 'rest-round';
  const nextLabel = isRoundRest
    ? `Ronda ${phase.nextRound + 1}`
    : phase.nextExercise?.name || 'Siguiente ejercicio';
  return `
    <div class="strength-timer__phase-meta">
      <span>${isRoundRest ? 'DESCANSO ENTRE RONDAS' : 'TRANSICIÓN'}</span>
      <span>RONDA ${phase.round + 1}/${totalRounds}</span>
    </div>
    <progress class="strength-timer__progress" max="100" value="${((phase.round + (isRoundRest ? 1 : 0)) / totalRounds) * 100}" aria-label="Progreso del circuito"></progress>
    <h1 class="strength-timer__title">${waitingForRound ? 'Descanso completado' : (isRoundRest ? `Ronda ${phase.round + 1} completada` : 'Cambio de ejercicio')}</h1>
    <p class="strength-timer__focus">SIGUIENTE · ${escapeHTML(nextLabel)}</p>
    ${waitingForRound ? `
      <div class="strength-timer__ready-mark" aria-hidden="true">00:00</div>
      <div class="strength-timer__phase-actions">
        <button class="strength-timer__text-action" id="btn-strength-next-round" type="button">INICIAR SIGUIENTE RONDA</button>
      </div>` : `
      <div class="strength-timer__matrix" id="strength-countdown-matrix" aria-label="Tiempo de descanso restante"></div>
      <p class="strength-timer__metric-note">RECUPERA EL ALIENTO · PREPARA LA SIGUIENTE FASE</p>`}`;
}

function renderInstructions(exercise) {
  return renderTechniqueDetails({
    className: 'strength-timer__instructions',
    sections: [
      {
        key: 'preparation',
        title: 'Preparación',
        content: exercise.preparation || 'Sin indicaciones de preparación.'
      },
      {
        key: 'execution',
        title: 'Ejecución',
        content: exercise.execution || 'Sin indicaciones de ejecución.'
      }
    ]
  });
}

export function renderStrengthSkipConfirmation(exerciseName) {
  return `
    <p>¿SALTAR ${escapeHTML(exerciseName)}?</p>
    <div>
      <button class="strength-timer__quiet-action" id="btn-strength-cancel-skip" type="button">CANCELAR</button>
      <button class="strength-timer__text-action" id="btn-strength-confirm-skip" type="button">SALTAR EJERCICIO</button>
    </div>`;
}

export function renderStrengthCompletion({ circuitName, summary, continueLabel, showVitality = false }) {
  const minutes = Math.floor(summary.durationSeconds / 60);
  const seconds = summary.durationSeconds % 60;
  return `
    <section class="strength-timer__completion" aria-labelledby="strength-completion-title">
      <span class="strength-timer__completion-kicker">CIRCUITO COMPLETADO</span>
      <h1 id="strength-completion-title">${escapeHTML(circuitName)}</h1>
      <dl>
        <div><dt>Rondas</dt><dd>${summary.roundsCompleted}</dd></div>
        <div><dt>Repeticiones</dt><dd>${summary.totalReps}</dd></div>
        <div><dt>Omitidos</dt><dd>${summary.skippedExercises}</dd></div>
        <div><dt>Duración</dt><dd>${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}</dd></div>
      </dl>
      ${showVitality ? `
        <div style="margin: 20px 0 16px; text-align: center;">
          <p style="font-size: 0.75rem; color: var(--color-text-muted); margin-bottom: 10px; font-family: var(--font-digital); text-transform: uppercase; letter-spacing: 0.05em;">¿Cómo percibes tu energía al cerrar?</p>
          <div class="vitality-options-grid" style="display: flex; gap: 8px; justify-content: center;">
            <button class="btn-vitality-option" data-vitality="calm" type="button" style="flex: 1; padding: 10px 8px; background: rgba(46,43,40,0.04); border: 1px solid rgba(46,43,40,0.12); border-radius: 4px; cursor: pointer; color: var(--color-text-main); display: flex; flex-direction: column; align-items: center; gap: 4px;">
              <span class="vitality-option-emoji">🌿</span>
              <span class="vitality-option-text" style="font-size: 0.7rem; font-family: var(--font-digital);">Calma</span>
            </button>
            <button class="btn-vitality-option" data-vitality="vital" type="button" style="flex: 1; padding: 10px 8px; background: rgba(46,43,40,0.04); border: 1px solid rgba(46,43,40,0.12); border-radius: 4px; cursor: pointer; color: var(--color-text-main); display: flex; flex-direction: column; align-items: center; gap: 4px;">
              <span class="vitality-option-emoji">⚡</span>
              <span class="vitality-option-text" style="font-size: 0.7rem; font-family: var(--font-digital);">Vital</span>
            </button>
            <button class="btn-vitality-option" data-vitality="fatigued" type="button" style="flex: 1; padding: 10px 8px; background: rgba(46,43,40,0.04); border: 1px solid rgba(46,43,40,0.12); border-radius: 4px; cursor: pointer; color: var(--color-text-main); display: flex; flex-direction: column; align-items: center; gap: 4px;">
              <span class="vitality-option-emoji">⏳</span>
              <span class="vitality-option-text" style="font-size: 0.7rem; font-family: var(--font-digital);">Fatiga</span>
            </button>
          </div>
        </div>
      ` : ''}
      <button class="strength-timer__text-action" id="btn-strength-completion-continue" type="button">${escapeHTML(continueLabel)}</button>
    </section>`;
}

export function renderStrengthFlowControl({ started, paused }) {
  if (!started) return { icon: renderIcon('play'), label: 'INICIAR', ariaLabel: 'Iniciar circuito' };
  if (paused) return { icon: renderIcon('play'), label: 'REANUDAR', ariaLabel: 'Reanudar circuito' };
  return { icon: renderIcon('pause'), label: 'PAUSAR', ariaLabel: 'Pausar circuito' };
}
