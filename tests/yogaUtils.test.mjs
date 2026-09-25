import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultSequences } from '../js/seeds/yoga_seeds.js';
import {
  resolveYogaSequence,
  startResolvedYogaSequence
} from '../js/utils/yogaUtils.js';

test('resuelve el preset de Yoga recibido por la sesión compuesta', () => {
  const sequence = resolveYogaSequence(defaultSequences, 'seq-yin-miercoles');
  assert.equal(sequence?.id, 'seq-yin-miercoles');
});

test('no intenta iniciar Yoga antes de que exista un catálogo cargado', () => {
  assert.equal(resolveYogaSequence([], 'seq-yin-miercoles'), null);
});

test('la entrada orquestada inicia la secuencia resuelta y no solo la carga', () => {
  let startedId = null;
  const started = startResolvedYogaSequence(
    defaultSequences,
    'seq-yin-domingo',
    sequence => { startedId = sequence.id; }
  );

  assert.equal(started, true);
  assert.equal(startedId, 'seq-yin-domingo');
});
