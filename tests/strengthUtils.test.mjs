import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStrengthPhaseList,
  createStrengthResult,
  finalizeStrengthResult,
  getCircuitValidation,
  recordStrengthResultEntry,
  summarizeStrengthResult
} from '../js/utils/strengthUtils.js';

const exercises = [
  { id: 'squat', name: 'Sentadilla', mode: 'reps' },
  { id: 'plank', name: 'Plancha', mode: 'time' }
];

const circuit = {
  id: 'test-circuit',
  name: 'Circuito de prueba',
  rounds: 2,
  restBetweenExercises: 15,
  restBetweenRounds: 45,
  exercises: [
    { exerciseId: 'squat', repsOverride: 12, durationOverride: null },
    { exerciseId: 'plank', repsOverride: null, durationOverride: 30 }
  ]
};

test('construye ejercicios y descansos en el orden esperado', () => {
  const phases = buildStrengthPhaseList(circuit, exercises);
  assert.deepEqual(phases.map(phase => phase.type), [
    'exercise', 'rest-exercise', 'exercise', 'rest-round',
    'exercise', 'rest-exercise', 'exercise'
  ]);
  assert.equal(phases[0].reps, 12);
  assert.equal(phases[2].duration, 30);
  assert.equal(phases[3].duration, 45);
});

test('acepta un circuito temporizado aunque sus familias de ejercicio sean de repeticiones', () => {
  const adaptedCircuit = {
    id: 'adapted-mobility',
    trackingMode: 'duration',
    rounds: 4,
    restBetweenExercises: 0,
    restBetweenRounds: 0,
    exercises: [
      { exerciseId: 'squat', repsOverride: null, durationOverride: 90 },
      { exerciseId: 'squat', repsOverride: null, durationOverride: 90 }
    ]
  };
  assert.equal(getCircuitValidation(adaptedCircuit, exercises).isValid, true);
  const phases = buildStrengthPhaseList(adaptedCircuit, exercises);
  assert.equal(phases[0].type, 'exercise');
  assert.equal(phases[0].duration, 90);
  assert.equal(phases[0].reps, null);
});

test('antepone los pasos de calentamiento definidos por el circuito', () => {
  const phases = buildStrengthPhaseList({
    ...circuit,
    warmupSteps: [{ id: 'warmup-1', name: 'Movilidad', duration: 90 }]
  }, exercises);
  assert.equal(phases[0].type, 'warmup');
  assert.equal(phases[0].name, 'Movilidad');
  assert.equal(phases[0].duration, 90);
  assert.equal(phases[1].type, 'exercise');
});

test('expande segmentos de calentamiento sin codificar su contenido', () => {
  const phases = buildStrengthPhaseList({
    ...circuit,
    warmupSteps: [{
      id: 'warmup-segmented',
      name: 'Movilidad',
      duration: 180,
      segments: [
        { id: 'one', name: 'Hombros', duration: 90, execution: 'Primer segmento.' },
        { id: 'two', name: 'Muñecas', duration: 90, execution: 'Segundo segmento.' }
      ]
    }]
  }, exercises);
  assert.deepEqual(phases.slice(0, 2).map(phase => [phase.type, phase.name, phase.duration]), [
    ['warmup', 'Hombros', 90],
    ['warmup', 'Muñecas', 90]
  ]);
  assert.equal(phases[0].warmupSegmentCount, 2);
  assert.equal(phases[1].execution, 'Segundo segmento.');
  assert.equal(phases[2].type, 'exercise');
});

test('registra repeticiones reales sin modificar el objetivo', () => {
  const phase = buildStrengthPhaseList(circuit, exercises)[0];
  const result = recordStrengthResultEntry(createStrengthResult(circuit), phase, {
    actualValue: 10,
    elapsedSeconds: 58,
    status: 'completed'
  });

  assert.equal(result.entries[0].targetValue, 12);
  assert.equal(result.entries[0].actualValue, 10);
  assert.equal(result.entries[0].elapsedSeconds, 58);
  assert.equal(circuit.exercises[0].repsOverride, 12);
});

test('reemplaza un registro al confirmar de nuevo la misma fase', () => {
  const phase = buildStrengthPhaseList(circuit, exercises)[0];
  let result = recordStrengthResultEntry(createStrengthResult(circuit), phase, { actualValue: 10, elapsedSeconds: 30 });
  result = recordStrengthResultEntry(result, phase, { actualValue: 12, elapsedSeconds: 35 });
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].actualValue, 12);
});

test('registra ejercicios temporizados y omitidos', () => {
  const phases = buildStrengthPhaseList(circuit, exercises);
  let result = createStrengthResult(circuit);
  result = recordStrengthResultEntry(result, phases[2], {
    actualValue: 30,
    elapsedSeconds: 30,
    status: 'completed'
  });
  result = recordStrengthResultEntry(result, phases[4], {
    elapsedSeconds: 6,
    status: 'skipped'
  });

  assert.equal(result.entries[0].unit, 'seconds');
  assert.equal(result.entries[0].actualValue, 30);
  assert.equal(result.entries[1].actualValue, null);
  assert.equal(result.entries[1].status, 'skipped');
});

test('resume rondas, repeticiones, omisiones y duración', () => {
  const phases = buildStrengthPhaseList(circuit, exercises);
  let result = createStrengthResult(circuit);
  result = recordStrengthResultEntry(result, phases[0], { actualValue: 10, elapsedSeconds: 58 });
  result = recordStrengthResultEntry(result, phases[2], { actualValue: 30, elapsedSeconds: 30 });
  result = recordStrengthResultEntry(result, phases[4], { actualValue: 14, elapsedSeconds: 52 });
  result = recordStrengthResultEntry(result, phases[6], { elapsedSeconds: 8, status: 'skipped' });
  result = finalizeStrengthResult(result, 223);

  assert.deepEqual(summarizeStrengthResult(result), {
    roundsCompleted: 2,
    exercisesCompleted: 3,
    skippedExercises: 1,
    totalReps: 24,
    durationSeconds: 223
  });
});

test('rechaza un registro completado con repeticiones inválidas', () => {
  const phase = buildStrengthPhaseList(circuit, exercises)[0];
  assert.throws(() => recordStrengthResultEntry(createStrengthResult(circuit), phase, {
    actualValue: 0,
    elapsedSeconds: 10,
    status: 'completed'
  }), /mayor que cero/);
});

test('propaga y registra weightOverride correctamente en fases y resultados', () => {
  const circuitWithWeight = {
    id: 'circuit-weight',
    name: 'Circuito con sobrecarga',
    rounds: 1,
    restBetweenExercises: 0,
    restBetweenRounds: 0,
    exercises: [
      { exerciseId: 'squat', repsOverride: 10, durationOverride: null, weightOverride: 7.5 }
    ]
  };
  const phases = buildStrengthPhaseList(circuitWithWeight, exercises);
  assert.equal(phases[0].weightKg, 7.5);

  const result = recordStrengthResultEntry(createStrengthResult(circuitWithWeight), phases[0], {
    actualValue: 10,
    elapsedSeconds: 45,
    status: 'completed'
  });
  assert.equal(result.entries[0].weightKg, 7.5);
});

test('utiliza defaultWeight del ejercicio si el circuito no define override', () => {
  const exercisesWithDefaultWeight = [
    { id: 'squat', name: 'Sentadilla', mode: 'reps', defaultWeight: 5 }
  ];
  const standardCircuit = {
    id: 'circuit-std',
    name: 'Circuito Estándar',
    rounds: 1,
    restBetweenExercises: 0,
    restBetweenRounds: 0,
    exercises: [
      { exerciseId: 'squat', repsOverride: 12, durationOverride: null }
    ]
  };
  const phases = buildStrengthPhaseList(standardCircuit, exercisesWithDefaultWeight);
  assert.equal(phases[0].weightKg, 5);
});

test('permite registrar actualWeight modificado en vivo durante el entrenamiento', () => {
  const standardCircuit = {
    id: 'circuit-live',
    name: 'Circuito en vivo',
    rounds: 1,
    restBetweenExercises: 0,
    restBetweenRounds: 0,
    exercises: [
      { exerciseId: 'squat', repsOverride: 10, durationOverride: null }
    ]
  };
  const phases = buildStrengthPhaseList(standardCircuit, exercises);
  assert.equal(phases[0].weightKg, 0); // Corporal por defecto

  const result = recordStrengthResultEntry(createStrengthResult(standardCircuit), phases[0], {
    actualValue: 10,
    actualWeight: 8,
    elapsedSeconds: 50,
    status: 'completed'
  });
  assert.equal(result.entries[0].weightKg, 8);
});
