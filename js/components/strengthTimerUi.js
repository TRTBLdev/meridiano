import { escapeAttribute, escapeHTML } from '../utils/sanitize.js';

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
  return `
    <details class="strength-timer__instructions">
      <summary>VER TÉCNICA</summary>
      <div>
        <section><h2>Preparación</h2><p>${escapeHTML(exercise.preparation || 'Sin indicaciones de preparación.')}</p></section>
        <section><h2>Ejecución</h2><p>${escapeHTML(exercise.execution || 'Sin indicaciones de ejecución.')}</p></section>
      </div>
    </details>`;
}

export function renderStrengthSkipConfirmation(exerciseName) {
  return `
    <p>¿SALTAR ${escapeHTML(exerciseName)}?</p>
    <div>
      <button class="strength-timer__quiet-action" id="btn-strength-cancel-skip" type="button">CANCELAR</button>
      <button class="strength-timer__text-action" id="btn-strength-confirm-skip" type="button">SALTAR EJERCICIO</button>
    </div>`;
}

export function renderStrengthCompletion({ circuitName, summary, continueLabel }) {
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
      <button class="strength-timer__text-action" id="btn-strength-completion-continue" type="button">${escapeHTML(continueLabel)}</button>
    </section>`;
}

export function renderStrengthFlowControl({ started, paused }) {
  if (!started) return { icon: renderIcon('play'), label: 'INICIAR', ariaLabel: 'Iniciar circuito' };
  if (paused) return { icon: renderIcon('play'), label: 'REANUDAR', ariaLabel: 'Reanudar circuito' };
  return { icon: renderIcon('pause'), label: 'PAUSAR', ariaLabel: 'Pausar circuito' };
}
