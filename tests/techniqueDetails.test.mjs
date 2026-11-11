import test from 'node:test';
import assert from 'node:assert/strict';
import { renderTechniqueDetails } from '../js/components/techniqueDetails.js';
import { renderLobbyAction, renderPracticeRow } from '../js/components/lobbyUi.js';
import { renderSynthPanel } from '../js/components/timerShell.js';
import { setAccordionExpanded } from '../js/components/ui.js';
import { renderMobilityTimerContent } from '../js/components/mobility.js';

test('plegar y reabrir conserva el formulario y sincroniza su estado accesible', () => {
  const mark = { textContent: '+' };
  const attrs = {};
  const button = { setAttribute: (key, value) => { attrs[key] = value; }, querySelector: () => mark };
  const body = { hidden: true, draft: { name: 'Borrador', blocks: ['uno', 'dos'] } };
  const draft = body.draft;
  setAccordionExpanded(button, body, true);
  assert.equal(attrs['aria-expanded'], 'true');
  assert.equal(body.hidden, false);
  assert.equal(mark.textContent, '−');
  setAccordionExpanded(button, body, false);
  assert.equal(body.hidden, true);
  assert.equal(mark.textContent, '+');
  setAccordionExpanded(button, body, true);
  assert.equal(body.draft, draft);
  assert.deepEqual(body.draft.blocks, ['uno', 'dos']);
});

test('el timer de movilidad expone iconos accesibles y confirmación de paso', () => {
  const html = renderMobilityTimerContent();
  for (const id of ['prev', 'play', 'skip', 'restart', 'exit']) assert.match(html, new RegExp(`id="mobility-${id}"[^>]*aria-label=`));
  assert.match(html, /id="mobility-clock"[^>]*role="timer"/);
  assert.match(html, /id="mobility-complete"[^>]*>Completar paso/);
  assert.match(html, /<svg/);
});

test('el indicador de expansión es distinto del botón de reproducción', () => {
  const play = renderLobbyAction({ kind: 'icon', icon: 'play', label: 'Iniciar' });
  const row = renderPracticeRow({ title: 'Práctica', actions: play });
  assert.match(row, /aria-expanded="false"/);
  assert.match(row, /class="disclosure-mark" aria-hidden="true">\+<\/span>/);
  assert.match(row, /<polygon points="7 5 19 12 7 19 7 5"/);
  assert.match(renderSynthPanel({ idPrefix: 'test', baseFreq: 432, diffFreq: 6, audioMode: 'binaural', isAudioActive: false }), /class="tuner-arrow disclosure-mark" aria-hidden="true">\+<\/span>/);
});

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
