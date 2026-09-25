import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateStrengthGridGeometry,
  getStrengthLitDotCount
} from '../js/components/strengthDotField.js';

test('la rejilla usa el mismo paso horizontal y vertical en una ventana colapsada', () => {
  const geometry = calculateStrengthGridGeometry(837, 800);

  assert.equal(geometry.pitch, 12);
  assert.equal(geometry.columns, 70);
  assert.equal(geometry.rows, 67);
  assert.equal(geometry.count, geometry.columns * geometry.rows);
});

test('el paso responsive permanece entre 12 y 20 px', () => {
  const viewports = [
    [1440, 900],
    [768, 1024],
    [390, 844],
    [1920, 1080]
  ];

  for (const [width, height] of viewports) {
    const geometry = calculateStrengthGridGeometry(width, height);
    assert.ok(geometry.pitch >= 12 && geometry.pitch <= 20);
    assert.equal(geometry.count, geometry.columns * geometry.rows);
  }
});

test('cada segundo activo enciende exactamente un punto y respeta la capacidad', () => {
  assert.equal(getStrengthLitDotCount(0, 100), 0);
  assert.equal(getStrengthLitDotCount(1, 100), 1);
  assert.equal(getStrengthLitDotCount(2, 100), 2);
  assert.equal(getStrengthLitDotCount(10, 100), 10);
  assert.equal(getStrengthLitDotCount(140, 100), 100);
});
