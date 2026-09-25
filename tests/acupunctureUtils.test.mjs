import test from 'node:test';
import assert from 'node:assert/strict';
import { createAcupunctureTiming } from '../js/utils/acupunctureUtils.js';

test('inicializa el primer paso de una secuencia orquestada', () => {
  const timing = createAcupunctureTiming({
    points: [
      { duration: 90, transitionAfter: 15 },
      { duration: 60, transitionAfter: 0 }
    ]
  });

  assert.deepEqual(timing, {
    activeSessionDuration: 165,
    activeTimeLeft: 90,
    activeStepDuration: 90
  });
});

test('una secuencia sin puntos produce un estado seguro no ejecutable', () => {
  assert.deepEqual(createAcupunctureTiming({ points: [] }), {
    activeSessionDuration: 0,
    activeTimeLeft: 0,
    activeStepDuration: 0
  });
});
