import test from 'node:test';
import assert from 'node:assert/strict';
import { createWakeLockController, renderWakeLockPreference, bindWakeLockPreference } from '../js/components/timerShell.js';

test('renderWakeLockPreference: retorna cadena vacía (switch eliminado de la UI)', () => {
  assert.equal(renderWakeLockPreference(), '');
});

test('bindWakeLockPreference: es una función segura no-op', () => {
  assert.doesNotThrow(() => {
    bindWakeLockPreference({});
    bindWakeLockPreference(null);
  });
});

test('createWakeLockController: retorna métodos request y release', () => {
  const controller = createWakeLockController();
  assert.equal(typeof controller.request, 'function');
  assert.equal(typeof controller.release, 'function');
});

test('createWakeLockController: se ejecuta de forma segura en entornos sin DOM/WakeLock nativo', async () => {
  const controller = createWakeLockController();
  await assert.doesNotReject(async () => {
    await controller.request();
    await controller.release();
  });
});

test('createWakeLockController: utiliza navigator.wakeLock si está disponible y maneja release', async () => {
  let requestedType = null;
  let released = false;
  const mockWakeLockSentinel = {
    addEventListener: () => {},
    release: async () => {
      released = true;
    }
  };

  const originalNavigator = globalThis.navigator;
  globalThis.navigator = {
    wakeLock: {
      request: async (type) => {
        requestedType = type;
        return mockWakeLockSentinel;
      }
    }
  };

  try {
    const controller = createWakeLockController();
    await controller.request();
    assert.equal(requestedType, 'screen');

    await controller.release();
    assert.equal(released, true);
  } finally {
    globalThis.navigator = originalNavigator;
  }
});

test('createWakeLockController: maneja rechazos de navigator.wakeLock sin propagar errores', async () => {
  const originalNavigator = globalThis.navigator;
  globalThis.navigator = {
    wakeLock: {
      request: async () => {
        throw new Error('NotAllowedError: Wake lock rejected by system power saver');
      }
    }
  };

  try {
    const controller = createWakeLockController();
    await assert.doesNotReject(async () => {
      await controller.request();
      await controller.release();
    });
  } finally {
    globalThis.navigator = originalNavigator;
  }
});
