import test from 'node:test';
import assert from 'node:assert/strict';
import {
  renderStrengthCompletion,
  renderStrengthPhase,
  renderStrengthTimerShell
} from '../js/components/strengthTimerUi.js';

const repsPhase = {
  type: 'exercise',
  round: 0,
  exerciseIndex: 0,
  mode: 'reps',
  reps: 12,
  exercise: {
    name: 'Sentadilla asistida',
    focus: 'Piernas',
    preparation: 'Preparar pelota.',
    execution: 'Flexionar rodillas.'
  }
};

test('el shell del timer usa clases propias y no clases visuales de Acupuntura', () => {
  const html = renderStrengthTimerShell({ circuitName: 'Circuito A', totalRounds: 3, totalExercises: 4 });
  assert.match(html, /class="strength-timer/);
  assert.match(html, /id="strength-session-elapsed"/);
  assert.match(html, /TIEMPO TOTAL/);
  assert.doesNotMatch(html, /class="acu-/);
});

test('la fase de repeticiones expone entrada directa, stepper y acción explícita', () => {
  const html = renderStrengthPhase({ phase: repsPhase, totalExercises: 3, totalRounds: 3, started: true });
  assert.match(html, /id="strength-actual-reps"/);
  assert.match(html, /id="btn-strength-rep-minus"/);
  assert.match(html, /id="btn-strength-rep-plus"/);
  assert.match(html, /id="strength-actual-weight"/);
  assert.match(html, /id="btn-strength-weight-minus"/);
  assert.match(html, /id="btn-strength-weight-plus"/);
  assert.match(html, /id="strength-weight-hint"/);
  assert.match(html, /id="strength-phase-elapsed"/);
  assert.match(html, /TIEMPO DEL EJERCICIO/);
  assert.match(html, /REGISTRAR Y CONTINUAR/);
  assert.match(html, /SALTAR EJERCICIO/);
  assert.doesNotMatch(html, /style=/);
});

test('el descanso finalizado espera el inicio explícito de la siguiente ronda', () => {
  const html = renderStrengthPhase({
    phase: { type: 'rest-round', round: 0, nextRound: 1, duration: 45 },
    totalExercises: 3,
    totalRounds: 3,
    started: true,
    waitingForRound: true
  });
  assert.match(html, /INICIAR SIGUIENTE RONDA/);
});

test('el resumen distingue repeticiones y ejercicios omitidos', () => {
  const html = renderStrengthCompletion({
    circuitName: 'Circuito A',
    summary: { roundsCompleted: 3, totalReps: 82, skippedExercises: 1, durationSeconds: 658 },
    continueLabel: 'VOLVER A FUERZA'
  });
  assert.match(html, /82/);
  assert.match(html, /Omitidos/);
  assert.match(html, /10:58/);
});

test('el resumen renderiza opciones de vitalidad cuando showVitality es true', () => {
  const html = renderStrengthCompletion({
    circuitName: 'Circuito A',
    summary: { roundsCompleted: 1, totalReps: 10, skippedExercises: 0, durationSeconds: 300 },
    continueLabel: 'VOLVER A FUERZA',
    showVitality: true
  });
  assert.match(html, /btn-vitality-option/);
  assert.match(html, /data-vitality="calm"/);
  assert.match(html, /data-vitality="vital"/);
  assert.match(html, /data-vitality="fatigued"/);
});

