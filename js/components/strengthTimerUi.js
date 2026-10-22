import { escapeAttribute, escapeHTML } from '../utils/sanitize.js';
import { renderTechniqueDetails } from './techniqueDetails.js';

const ICONS = {
  play: '<polygon points="6 4 19 12 6 20 6 4"></polygon>',
  pause: '<rect x="6" y="4" width="3" height="16"></rect><rect x="15" y="4" width="3" height="16"></rect>',
  previous: '<path d="M18 5v14L8 12z"></path><rect x="4" y="5" width="2" height="14"></rect>',
  next: '<path d="M6 5v14l10-7z"></path><rect x="18" y="5" width="2" height="14"></rect>',
  restart: '<path d="M3 12a9 9 0 1 0 3-6.7"></path><polyline points="3 4 3 10 9 10"></polyline>',
  confirm: '<path d="m5 12 4 4L19 6"></path>'
};

function renderIcon(name) {
  const outlined = name === 'restart' || name === 'confirm';
  return `<svg viewBox="0 0 24 24" aria-hidden="true" ${outlined ? 'fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"' : 'fill="currentColor"'}>${ICONS[name]}</svg>`;
}

function formatDurationLabel(seconds) {
  const safeSeconds = Math.max(0, Math.round(Number(seconds) || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(remainder).padStart(2, '0')}`;
}

export function renderStrengthTimerShell({ circuitName, totalRounds, totalExercises, warmupStepsCount = 0 }) {
  return `
    <main class="strength-timer fade-in" aria-label="Circuito ${escapeAttribute(circuitName)}">
      <div class="strength-timer__grid" id="strength-dots-grid" aria-hidden="true"></div>
      <div class="strength-timer__ambient" aria-hidden="true"></div>
      <section class="strength-timer__instrument">
        <button class="strength-timer__exit" id="btn-strength-exit" type="button" aria-label="Salir sin guardar" title="Salir sin guardar">×</button>
        <header class="strength-timer__header">
          <span class="strength-timer__circuit">${escapeHTML(circuitName)}</span>
          <div class="strength-timer__header-data">
            <span class="strength-timer__scope">${Number(warmupStepsCount) > 0 ? `${Number(warmupStepsCount)} PASOS INICIALES · ` : ''}${Number(totalRounds)} RONDAS · ${Number(totalExercises)} EJERCICIOS</span>
            <span class="strength-timer__total-time">TIEMPO TOTAL <output id="strength-session-elapsed">00:00</output></span>
          </div>
        </header>
        <div class="strength-timer__phase" id="strength-phase-content"></div>
        <div class="strength-timer__skip-confirm" id="strength-skip-confirm" hidden></div>
        <footer class="strength-timer__global-controls">
          <button class="strength-timer__icon-action" id="btn-strength-prev" type="button" aria-label="Paso anterior" title="Paso anterior">${renderIcon('previous')}</button>
          <button class="strength-timer__icon-action" id="btn-strength-flow" type="button" aria-label="Iniciar circuito" title="Iniciar circuito">
            <span id="strength-flow-icon">${renderIcon('play')}</span>
          </button>
          <button class="strength-timer__icon-action strength-timer__icon-action--confirm" id="btn-strength-confirm" type="button" aria-label="Registrar ejercicio" title="Registrar ejercicio" hidden>${renderIcon('confirm')}</button>
          <button class="strength-timer__icon-action" id="btn-strength-next" type="button" aria-label="Siguiente" title="Siguiente">${renderIcon('next')}</button>
          <button class="strength-timer__icon-action" id="btn-strength-restart" type="button" aria-label="Reiniciar paso" title="Reiniciar paso">${renderIcon('restart')}</button>
        </footer>
      </section>
    </main>`;
}

export function renderStrengthPhase({ phase, totalExercises, totalRounds, warmupStepsCount = 0, started }) {
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
      ${renderInstructions(phase.exercise)}`;
  }

  if (phase.type === 'warmup') {
    const segmentCount = Math.max(1, Number(phase.warmupSegmentCount) || 1);
    const isSegmented = segmentCount > 1;
    const segmentLabel = isSegmented
      ? `SEGMENTO ${Number(phase.warmupSegmentIndex) + 1}/${segmentCount}`
      : `PASO ${Number(phase.warmupIndex) + 1}/${Math.max(1, Number(warmupStepsCount) || 1)}`;
    const durationLabel = isSegmented ? 'TIEMPO DEL SEGMENTO' : 'TIEMPO DEL PASO';
    return `
      <div class="strength-timer__phase-meta"><span>CALENTAMIENTO · ${escapeHTML(phase.stepName || phase.name)}</span><span>${segmentLabel}</span></div>
      <h1 class="strength-timer__title">${escapeHTML(phase.name)}</h1>
      <div class="strength-timer__matrix" id="strength-countdown-matrix" aria-label="Tiempo de calentamiento restante"></div>
      <p class="strength-timer__metric-note">${durationLabel} · ${formatDurationLabel(phase.duration)}</p>
      <p class="strength-timer__flow-note">DESPUÉS · ${Number(totalRounds)} RONDAS × ${Number(totalExercises)} EJERCICIOS</p>
      ${renderInstructions(phase)}`;
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
    <h1 class="strength-timer__title">${isRoundRest ? `Ronda ${phase.round + 1} completada` : 'Cambio de ejercicio'}</h1>
    <p class="strength-timer__focus">SIGUIENTE · ${escapeHTML(nextLabel)}</p>
    <div class="strength-timer__matrix" id="strength-countdown-matrix" aria-label="Tiempo de descanso restante"></div>
    <p class="strength-timer__metric-note">RECUPERA EL ALIENTO · PREPARA LA SIGUIENTE FASE</p>`;
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
      },
      {
        key: 'caution',
        title: 'Precaución',
        content: exercise.caution || ''
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
        <div class="strength-timer__vitality">
          <p>¿Cómo percibes tu energía al cerrar?</p>
          <div class="vitality-options-grid" role="group" aria-label="Vitalidad al terminar">
            <button class="btn-vitality-option" data-vitality="calm" type="button" aria-pressed="false">
              <span class="vitality-option-emoji" aria-hidden="true">🌿</span>
              <span class="vitality-option-text">Calma</span>
            </button>
            <button class="btn-vitality-option" data-vitality="vital" type="button" aria-pressed="false">
              <span class="vitality-option-emoji" aria-hidden="true">⚡</span>
              <span class="vitality-option-text">Vital</span>
            </button>
            <button class="btn-vitality-option" data-vitality="fatigued" type="button" aria-pressed="false">
              <span class="vitality-option-emoji" aria-hidden="true">⏳</span>
              <span class="vitality-option-text">Fatigada</span>
            </button>
          </div>
        </div>
      ` : ''}
      <button class="strength-timer__text-action" id="btn-strength-completion-continue" type="button">${escapeHTML(continueLabel)}</button>
    </section>`;
}

export function renderStrengthFlowControl({ started, paused }) {
  if (!started) return { icon: renderIcon('play'), ariaLabel: 'Iniciar circuito' };
  if (paused) return { icon: renderIcon('play'), ariaLabel: 'Reanudar circuito' };
  return { icon: renderIcon('pause'), ariaLabel: 'Pausar circuito' };
}
