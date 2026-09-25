import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateSequenceDuration,
  validateMeditationSequence,
  formatSequenceBlocksSummary,
  sanitizeMeditationSequence
} from '../js/utils/meditationUtils.js';

test('calculateSequenceDuration: calcula la duración correcta en segundos', () => {
  const blocks = [
    { mins: 5, secs: 0 },
    { mins: 2, secs: 30 },
    { mins: 0, secs: 45 }
  ];
  assert.equal(calculateSequenceDuration(blocks), 300 + 150 + 45);
});

test('calculateSequenceDuration: maneja listas vacías o valores nulos', () => {
  assert.equal(calculateSequenceDuration([]), 0);
  assert.equal(calculateSequenceDuration(null), 0);
  assert.equal(calculateSequenceDuration([{ mins: -5, secs: -10 }]), 0);
});

test('validateMeditationSequence: valida secuencias correctas', () => {
  const seq = {
    name: 'Vipassana 3 Fases',
    blocks: [
      { name: 'Anapana', mins: 5, secs: 0 },
      { name: 'Observación', mins: 10, secs: 0 },
      { name: 'Metta', mins: 3, secs: 0 }
    ]
  };
  const result = validateMeditationSequence(seq);
  assert.equal(result.isValid, true);
  assert.equal(result.reason, '');
});

test('validateMeditationSequence: rechaza nombre vacío o bloques vacíos', () => {
  assert.equal(validateMeditationSequence({ name: '', blocks: [{ name: 'A', mins: 1, secs: 0 }] }).isValid, false);
  assert.equal(validateMeditationSequence({ name: 'Test', blocks: [] }).isValid, false);
});

test('validateMeditationSequence: rechaza secuencias con más de 7 bloques', () => {
  const blocks = Array.from({ length: 8 }, (_, i) => ({ name: `B${i}`, mins: 1, secs: 0 }));
  const result = validateMeditationSequence({ name: 'Demasiados bloques', blocks });
  assert.equal(result.isValid, false);
  assert.match(result.reason, /límite de 7 bloques/i);
});

test('validateMeditationSequence: rechaza bloques con duración 0', () => {
  const seq = {
    name: 'Test Cero',
    blocks: [
      { name: 'Válido', mins: 5, secs: 0 },
      { name: 'Inválido', mins: 0, secs: 0 }
    ]
  };
  const result = validateMeditationSequence(seq);
  assert.equal(result.isValid, false);
  assert.match(result.reason, /duración mayor a 0/i);
});

test('formatSequenceBlocksSummary: genera formato conciso legible', () => {
  const blocks = [
    { name: 'Fase Inicial', mins: 5, secs: 0 },
    { name: 'Profundización', mins: 10, secs: 30 }
  ];
  const summary = formatSequenceBlocksSummary(blocks);
  assert.equal(summary, 'Fase Inicial (5m) · Profundización (10m 30s)');
});

test('sanitizeMeditationSequence: normaliza datos y calcula totalDuration', () => {
  const raw = {
    name: '  Secuencia Zen  ',
    description: '  Enfoque mental  ',
    blocks: [
      { name: '  Paso 1  ', mins: '5', secs: '0' },
      { name: '', mins: 2, secs: 15 }
    ]
  };
  const sanitized = sanitizeMeditationSequence(raw);
  assert.equal(sanitized.name, 'Secuencia Zen');
  assert.equal(sanitized.description, 'Enfoque mental');
  assert.equal(sanitized.blocks.length, 2);
  assert.equal(sanitized.blocks[0].name, 'Paso 1');
  assert.equal(sanitized.blocks[0].mins, 5);
  assert.equal(sanitized.blocks[1].name, 'Bloque 2');
  assert.equal(sanitized.totalDuration, 300 + 135);
  assert.ok(sanitized.id.startsWith('med-seq-'));
});
