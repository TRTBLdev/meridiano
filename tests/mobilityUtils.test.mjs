import test from 'node:test';
import assert from 'node:assert/strict';
import { validateMobilityRoutine, buildMobilityPhases, estimateMobilityDuration, recordMobilityEntry } from '../js/utils/mobilityUtils.js';

const exercises = [{ id: 'a', name: 'Ejercicio A' }, { id: 'b', name: 'Ejercicio B' }];
const routine = { name: 'Rutina', steps: [{ exerciseId: 'a', mode: 'repetitions', targetValue: 10, side: 'left', transitionAfter: 5 }, { exerciseId: 'b', mode: 'hold', targetValue: 30, side: 'bilateral', transitionAfter: 0 }] };
test('valida referencias, prescripciones y lateralidad', () => {
  assert.equal(validateMobilityRoutine(routine, exercises), '');
  assert.ok(validateMobilityRoutine({ name: 'Vacía', steps: [] }, exercises));
  for (const change of [{ exerciseId: 'missing' }, { mode: 'bad' }, { targetValue: 0 }, { side: 'bad' }, { transitionAfter: -1 }]) assert.ok(validateMobilityRoutine({ ...routine, steps: [{ ...routine.steps[0], ...change }] }, exercises));
});
test('construye fases mixtas y estima sin controlar repeticiones', () => {
  const phases = buildMobilityPhases(routine, exercises);
  assert.deepEqual(phases.map(p => p.type), ['exercise', 'transition', 'exercise']);
  assert.equal(estimateMobilityDuration(routine), 75);
  const entry = recordMobilityEntry([], phases[0], 'completed', 12.4)[0];
  assert.equal(entry.elapsedSeconds, 12); assert.equal(entry.targetValue, 10); assert.equal(entry.side, 'left'); assert.equal('actualValue' in entry, false);
  assert.equal(recordMobilityEntry([entry], phases[0], 'skipped', 3).length, 1);
});
