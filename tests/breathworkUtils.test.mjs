import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createSingleBreathworkTiming,
  createSequentialBreathworkTiming
} from '../js/utils/breathworkUtils.js';

test('inicializa el tiempo orquestado antes del primer tick', () => {
  const timing = createSingleBreathworkTiming(300);

  assert.deepEqual(timing, {
    minutes: 5,
    seconds: 0,
    totalDuration: 300,
    timeLeft: 300,
    blockBoundaries: []
  });
});

test('normaliza una duración orquestada inválida al valor seguro', () => {
  const timing = createSingleBreathworkTiming(undefined, 300);
  assert.equal(timing.totalDuration, 300);
  assert.equal(timing.timeLeft, 300);
});

test('calcula duración y límites para una secuencia manual', () => {
  const timing = createSequentialBreathworkTiming([
    { mins: 1, secs: 30 },
    { mins: 0, secs: 45 }
  ]);

  assert.equal(timing.totalDuration, 135);
  assert.equal(timing.timeLeft, 135);
  assert.deepEqual(timing.blockBoundaries, [90, 135]);
});
