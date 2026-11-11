import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

function javascriptFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? javascriptFiles(path) : path.endsWith('.js') ? [path] : [];
  });
}

test('todos los módulos de la aplicación tienen sintaxis válida', () => {
  for (const file of javascriptFiles('js')) {
    const result = spawnSync(process.execPath, ['--check', file], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${file}: ${result.stderr || result.error}`);
  }
});

test('el punto de entrada carga sus dependencias y presenta el acceso', async () => {
  const elements = new Map();
  const container = {
    innerHTML: '',
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, { addEventListener() {} });
      return elements.get(selector);
    }
  };
  globalThis.document = { getElementById: () => container, body: { classList: { add() {}, remove() {} } } };
  globalThis.localStorage = { getItem: () => null, setItem() {} };
  globalThis.indexedDB = { open() { const request = {}; queueMicrotask(() => request.onerror({ target: { error: new Error('Base simulada') } })); return request; } };
  const originalError = console.error;
  console.error = () => {};
  try {
    await import('../js/app.js');
    await new Promise(resolve => setImmediate(resolve));
    assert.match(container.innerHTML, /id="login-form"/);
  } finally {
    console.error = originalError;
    delete globalThis.document;
    delete globalThis.localStorage;
    delete globalThis.indexedDB;
  }
});
