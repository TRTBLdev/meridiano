import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createCompoundSessionResult,
  createModuleResult,
  formatDurationSeconds
} from '../js/utils/sessionResults.js';

test('crea un resultado uniforme para cada módulo', () => {
  assert.deepEqual(createModuleResult('yoga', 778.6, { sequenceId: 'yin-1' }), {
    version: 1,
    module: 'yoga',
    durationSeconds: 779,
    sequenceId: 'yin-1'
  });
});

test('distingue tiempo activo, total transcurrido y plan por bloque', () => {
  const blocks = [
    { module: 'breathwork', presetId: 'breath-1', nameOverride: 'Respiración', duration: 300 },
    { module: 'strength', presetId: 'strength-1', nameOverride: 'Fuerza', duration: 900 }
  ];
  const results = [
    createModuleResult('breathwork', 280),
    createModuleResult('strength', 760)
  ];
  const result = createCompoundSessionResult(blocks, results, 1_000, 1_201_000);

  assert.equal(result.activeDurationSeconds, 1040);
  assert.equal(result.elapsedDurationSeconds, 1200);
  assert.equal(result.blocks[0].plannedDurationSeconds, 300);
  assert.equal(result.blocks[0].actualDurationSeconds, 280);
});

test('formatea segundos reales como reloj', () => {
  assert.equal(formatDurationSeconds(0), '00:00');
  assert.equal(formatDurationSeconds(658), '10:58');
});
