import test from 'node:test';
import assert from 'node:assert/strict';
import { createAcupunctureTiming, ACUPUNCTURE_HEAD_TYPES, resolveAcupunctureHead, cleanAcupunctureStep, getAcupunctureControls, nextAcupuncturePhase } from '../js/utils/acupunctureUtils.js';
import { renderTimerIcon, getTimerElapsedMs } from '../js/components/timerShell.js';

test('los controles respetan el inicio y el primer paso', () => {
  assert.deepEqual(getAcupunctureControls(false, 0), { previous: false, next: false, restart: false });
  assert.deepEqual(getAcupunctureControls(true, 0), { previous: false, next: true, restart: true });
  assert.deepEqual(getAcupunctureControls(true, 1), { previous: true, next: true, restart: true });
  assert.notEqual(renderTimerIcon('previous'), renderTimerIcon('next'));
});

test('la navegación respeta transiciones y final de secuencia', () => {
  const sequence = { points: [{ duration: 90, transitionAfter: 15 }, { duration: 60, transitionAfter: 0 }] };
  assert.deepEqual(nextAcupuncturePhase(sequence, 0, 'stimulating'), { index: 0, state: 'transition', duration: 15 });
  assert.deepEqual(nextAcupuncturePhase(sequence, 0, 'transition'), { index: 1, state: 'stimulating', duration: 60 });
  assert.equal(nextAcupuncturePhase(sequence, 1, 'stimulating'), null);
  assert.deepEqual(nextAcupuncturePhase({ points: [{ duration: 10, transitionAfter: 0 }, { duration: 20, transitionAfter: 0 }] }, 0, 'stimulating'), { index: 1, state: 'stimulating', duration: 20 });
});

test('el cálculo compartido conserva el tiempo al pausar y reanudar', () => {
  assert.equal(getTimerElapsedMs(1000, 200, false, 1600), 800);
  assert.equal(getTimerElapsedMs(1000, 800, true, 9000), 800);
  assert.equal(getTimerElapsedMs(9000, 800, false, 9500), 1300);
});

test('resuelve cabezales heredados y conserva notas limpias', () => {
  const point = { headType: 'Domo' };
  assert.equal(resolveAcupunctureHead({ headTypeOverride: 'Rodillo' }, point), 'Rodillo');
  for (const headTypeOverride of [null, '', undefined, 'inválido']) assert.equal(resolveAcupunctureHead({ headTypeOverride }, point), 'Plano');
  assert.deepEqual(ACUPUNCTURE_HEAD_TYPES, ['Esferoidal', 'Plano', 'Espátula', 'Rodillo', 'Nodo']);
  assert.equal(resolveAcupunctureHead({ headTypeOverride: 'Punta' }, point), 'Nodo');
  assert.equal(resolveAcupunctureHead({ headTypeOverride: 'Plano' }, point), 'Plano');
  assert.equal(cleanAcupunctureStep({ headTypeOverride: 'Punta' }).headTypeOverride, 'Nodo');
  assert.deepEqual(cleanAcupunctureStep({ pointId: 'acu-gb21', headTypeOverride: 'Rodillo', notes: '  Barrido hacia el acromion  ' }), { pointId: 'acu-gb21', headTypeOverride: 'Rodillo', notes: 'Barrido hacia el acromion' });
  assert.deepEqual(cleanAcupunctureStep({ pointId: 'acu-gb21', headTypeOverride: null, notes: '  ' }), { pointId: 'acu-gb21' });
});

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
