import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTechniqueDetails } from '../js/components/techniqueDetails.js';

test('renderiza la técnica como secciones independientes y sin estilos inline', () => {
  const html = renderTechniqueDetails({
    id: 'yoga-technique',
    sections: [
      { key: 'focus', title: 'Enfoque', content: 'Meridiano de Vejiga', wide: true },
      { key: 'preparation', title: 'Preparación', content: 'Acostarse boca arriba' },
      { key: 'execution', title: 'Ejecución', content: 'Girar con suavidad' }
    ]
  });

  assert.match(html, /<details/);
  assert.match(html, /data-technique-section="focus"/);
  assert.match(html, /data-technique-section="preparation"/);
  assert.match(html, /data-technique-section="execution"/);
  assert.doesNotMatch(html, /style=/);
});

test('escapa el contenido clínico antes de renderizarlo', () => {
  const html = renderTechniqueDetails({
    sections: [{ title: 'Ejecución', content: '<script>alert(1)</script>' }]
  });
  assert.doesNotMatch(html, /<script>/);
  assert.match(html, /&lt;script&gt;/);
});
