import test from 'node:test';
import assert from 'node:assert/strict';
import { defaultCompoundSessions } from '../js/seeds/compound_sessions_seed.js';
import { defaultBreathwork } from '../js/seeds/breathwork_seeds.js';
import {
  defaultStrengthCircuits,
  defaultStrengthExercises
} from '../js/seeds/strength_exercises_seed.js';
import { defaultSequences as defaultYogaSequences } from '../js/seeds/yoga_seeds.js';
import { defaultAcupunctureSequences } from '../js/seeds/acupuncture_sequences_seed.js';
import { createSingleBreathworkTiming } from '../js/utils/breathworkUtils.js';
import { createAcupunctureTiming } from '../js/utils/acupunctureUtils.js';
import { getCircuitValidation } from '../js/utils/strengthUtils.js';

test('las sesiones compuestas iniciales resuelven todos sus bloques en orden', () => {
  const expectedOrder = ['breathwork', 'strength', 'yoga', 'acupuncture'];

  for (const session of defaultCompoundSessions) {
    assert.deepEqual(session.blocks.map(block => block.module), expectedOrder);

    for (const block of session.blocks) {
      if (block.module === 'breathwork') {
        assert.ok(defaultBreathwork.some(pattern => pattern.id === block.presetId));
        assert.ok(createSingleBreathworkTiming(block.duration).timeLeft > 0);
      }

      if (block.module === 'strength') {
        const circuit = defaultStrengthCircuits.find(item => item.id === block.presetId);
        assert.ok(circuit);
        assert.equal(getCircuitValidation(circuit, defaultStrengthExercises).isValid, true);
      }

      if (block.module === 'yoga') {
        const sequence = defaultYogaSequences.find(item => item.id === block.presetId);
        assert.ok(sequence);
        assert.ok(sequence.items.length > 0);
      }

      if (block.module === 'acupuncture') {
        const sequence = defaultAcupunctureSequences.find(item => item.id === block.presetId);
        assert.ok(sequence);
        assert.ok(createAcupunctureTiming(sequence).activeTimeLeft > 0);
      }
    }
  }
});
