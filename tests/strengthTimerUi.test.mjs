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
  const html = renderStrengthTimerShell({ circuitName: 'Circuito A', totalRounds: 3, totalExercises: 4, warmupStepsCount: 2 });
  assert.match(html, /class="strength-timer/);
  assert.match(html, /id="strength-session-elapsed"/);
  assert.match(html, /TIEMPO TOTAL/);
  assert.match(html, /2 PASOS INICIALES/);
  assert.match(html, /id="btn-strength-prev"[^>]*>[\s\S]*M18 5v14L8 12z/);
  assert.match(html, /id="btn-strength-next"[^>]*>[\s\S]*M6 5v14l10-7z/);
  assert.doesNotMatch(html, /strength-timer__exit-confirm/);
  assert.doesNotMatch(html, /class="acu-/);
});

test('el calentamiento explica cuántos pasos quedan antes de las rondas', () => {
  const html = renderStrengthPhase({
    phase: { type: 'warmup', warmupIndex: 1, name: 'Movilidad de hombros', duration: 90 },
    totalExercises: 5,
    totalRounds: 4,
    warmupStepsCount: 2,
    started: true
  });
  assert.match(html, /PASO 2\/2/);
  assert.match(html, /TIEMPO DEL PASO · 01:30/);
  assert.match(html, /DESPUÉS · 4 RONDAS × 5 EJERCICIOS/);
});

test('el calentamiento segmentado muestra el segmento actual y su duración', () => {
  const html = renderStrengthPhase({
    phase: {
      type: 'warmup',
      warmupIndex: 1,
      warmupSegmentIndex: 0,
      warmupSegmentCount: 2,
      stepName: 'Movilidad de hombros y muñecas',
      name: 'Círculos de hombros',
      duration: 90
    },
    totalExercises: 5,
    totalRounds: 4,
    warmupStepsCount: 2,
    started: true
  });
  assert.match(html, /SEGMENTO 1\/2/);
  assert.match(html, /TIEMPO DEL SEGMENTO · 01:30/);
  assert.match(html, /Círculos de hombros/);
});

test('la fase de repeticiones expone entrada directa y stepper sin acciones textuales', () => {
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
  assert.doesNotMatch(html, /REGISTRAR Y CONTINUAR/);
  assert.doesNotMatch(html, /SALTAR EJERCICIO/);
  assert.doesNotMatch(html, /style=/);
});

test('el descanso entre rondas conserva cuenta regresiva sin estado de espera', () => {
  const html = renderStrengthPhase({
    phase: { type: 'rest-round', round: 0, nextRound: 1, duration: 45 },
    totalExercises: 3,
    totalRounds: 3,
    started: true
  });
  assert.match(html, /strength-countdown-matrix/);
  assert.doesNotMatch(html, /EN ESPERA|INICIAR SIGUIENTE RONDA|Descanso completado/);
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
  assert.match(html, /vitality-option-emoji/);
  assert.doesNotMatch(html, /style=/);
});
