import { getAllData, putData, deleteData, addData } from '../db.js';
import { escapeHTML, escapeAttribute } from '../utils/sanitize.js';
import { createWakeLockController, createTimerShell, requestTimerExitConfirmation, renderTimerIcon } from './timerShell.js';
import { renderTechniqueDetails } from './techniqueDetails.js';
import { renderLobbyAction, renderLobbyShell, renderPracticeRow } from './lobbyUi.js';
import { renderTechnicalTitle } from './ui.js';
import { renderDotMatrix } from '../utils/dotmatrix.js';
import { playQuartzBowlRing } from '../utils/synth.js';
import { createModuleResult, formatDurationSeconds } from '../utils/sessionResults.js';
import { MOBILITY_MODES, MOBILITY_MODE_LABELS, MOBILITY_SIDES, MOBILITY_SIDE_LABELS, validateMobilityRoutine, buildMobilityPhases, estimateMobilityDuration, recordMobilityEntry } from '../utils/mobilityUtils.js';

const playIcon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><polygon points="5 3 19 12 5 21"></polygon></svg>';
const pauseIcon = '<svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" aria-hidden="true"><rect x="6" y="4" width="3" height="16" rx="1"></rect><rect x="15" y="4" width="3" height="16" rx="1"></rect></svg>';

export function renderMobilityTimerContent() {
  return `<div class="mobility-timer-panel"><button class="mobility-timer__exit" id="mobility-exit" type="button" aria-label="Salir sin guardar" title="Salir sin guardar">×</button><div id="mobility-phase"></div><div id="mobility-clock" class="mobility-clock acu-timer-dot-display" role="timer" aria-label="Tiempo del paso"></div><div id="mobility-technique"></div><div class="timer-icon-controls mobility-controls"><button class="btn-acu-icon" id="mobility-prev" type="button" aria-label="Paso anterior" title="Paso anterior">${renderTimerIcon('previous')}</button><button class="btn-acu-icon btn-acu-active" id="mobility-play" type="button" aria-label="Iniciar" title="Iniciar">${playIcon}</button><button class="btn-acu-icon" id="mobility-skip" type="button" aria-label="Saltar fase" title="Saltar fase">${renderTimerIcon('next')}</button><button class="btn-acu-icon" id="mobility-restart" type="button" aria-label="Reiniciar paso" title="Reiniciar paso">${renderTimerIcon('restart')}</button></div><button class="strength-manager__text-action mobility-complete" id="mobility-complete" type="button">Completar paso</button></div>`;
}

export async function renderMobilityScreen(container, db, onNavigate, orchestratorConfig = null) {
  let exercises = await getAllData(db, 'mobility_exercises');
  let routines = await getAllData(db, 'mobility_routines');
  let draft = null;
  const wake = createWakeLockController();
  const options = (values, labels, selected) => values.map(value => `<option value="${value}" ${selected === value ? 'selected' : ''}>${labels[value]}</option>`).join('');
  const shell = (title, body) => `<div class="dashboard-layout fade-in"><nav class="nav-bar"><div class="nav-logo dot-digital">M.</div><button class="nav-item mobility-back" id="mobility-back" type="button" aria-label="Volver">← Volver</button></nav><main class="main-viewport"><div class="viewport-inner mobility-page">${renderTechnicalTitle(title)}${body}</div></main></div>`;

  async function reload() { exercises = await getAllData(db, 'mobility_exercises'); routines = await getAllData(db, 'mobility_routines'); }
  function lobby() {
    container.innerHTML = renderLobbyShell({ title: 'Movilidad', action: renderLobbyAction({ kind: 'text', label: '+ Crear rutina', id: 'mobility-create' }), variant: 'list', content: '<div id="mobility-routines" class="practice-list"></div>' });
    container.querySelector('#btn-back-home').onclick = () => onNavigate('inicio');
    container.querySelector('#mobility-create').onclick = () => { draft = { id: `mobility-routine-${Date.now()}`, name: '', description: '', steps: [] }; builder(); };
    const list = container.querySelector('#mobility-routines');
    if (!routines.length) list.innerHTML = '<p class="lobby-empty">No hay rutinas. Crea ejercicios en Base de Datos y construye una rutina aquí.</p>';
    routines.forEach(routine => {
      const issue = validateMobilityRoutine(routine, exercises);
      const staging = document.createElement('div');
      const actions = renderLobbyAction({ kind: 'icon', icon: 'play', label: 'Iniciar rutina', className: 'play', disabled: Boolean(issue) });
      const details = `<p class="practice-row__description">${escapeHTML(routine.description || '')}</p>${issue ? `<p class="strength-manager__warning">${escapeHTML(issue)}</p>` : ''}<div class="practice-row__actions">${renderLobbyAction({ kind: 'icon', icon: 'edit', label: 'Editar rutina', className: 'edit' })}${renderLobbyAction({ kind: 'icon', icon: 'delete', label: 'Eliminar rutina', className: 'remove' })}</div>`;
      staging.innerHTML = renderPracticeRow({ title: routine.name, metadata: `${routine.steps?.length || 0} pasos`, duration: `${Math.ceil(estimateMobilityDuration(routine) / 60)} min`, details, actions, state: issue ? 'invalid' : '' });
      const row = staging.firstElementChild;
      row.querySelector('.practice-row__expand').onclick = event => { const expanded = row.classList.toggle('is-expanded'); event.currentTarget.setAttribute('aria-expanded', String(expanded)); event.currentTarget.querySelector('.disclosure-mark').textContent = expanded ? '−' : '+'; row.querySelector('.practice-row__details').hidden = !expanded; };
      row.querySelector('.play').onclick = () => timer(routine);
      row.querySelector('.edit').onclick = () => { draft = structuredClone(routine); builder(); };
      row.querySelector('.remove').onclick = async () => {
        const sessions = await getAllData(db, 'compound_sessions');
        const affected = sessions.filter(s => s.blocks?.some(b => b.module === 'mobility' && b.presetId === routine.id));
        if (!confirm(`¿Eliminar “${routine.name}”? Se retirará de ${affected.length} sesión(es) compuesta(s).`)) return;
        for (const session of affected) { session.blocks = session.blocks.filter(b => !(b.module === 'mobility' && b.presetId === routine.id)); await putData(db, 'compound_sessions', session); }
        await deleteData(db, 'mobility_routines', routine.id); await reload(); lobby();
      };
      list.appendChild(row);
    });
  }

  function builder() {
    container.innerHTML = shell('Constructor de movilidad', `<div class="mobility-form"><label class="mobility-wide">Nombre<input id="routine-name" class="acu-input-flat" value="${escapeAttribute(draft.name)}"></label><label class="mobility-wide">Descripción<textarea id="routine-description" class="acu-input-flat">${escapeHTML(draft.description || '')}</textarea></label></div><div id="mobility-steps"></div><div class="mobility-add"><select id="mobility-add-select" class="acu-select-flat"><option value="">Seleccionar ejercicio</option>${exercises.map(e => `<option value="${escapeAttribute(e.id)}">${escapeHTML(e.name)}</option>`).join('')}</select><button class="strength-manager__text-action" id="mobility-add">+ Añadir paso</button></div><p id="mobility-estimate" class="mobility-estimate"></p><button class="strength-manager__text-action" id="mobility-save">Guardar rutina</button>`);
    container.querySelector('#mobility-back').onclick = lobby;
    container.querySelector('#routine-name').oninput = e => { draft.name = e.target.value; };
    container.querySelector('#routine-description').oninput = e => { draft.description = e.target.value; };
    const renderSteps = () => {
      const list = container.querySelector('#mobility-steps'); list.innerHTML = '';
      draft.steps.forEach((step, index) => {
        const exercise = exercises.find(e => e.id === step.exerciseId);
        const row = document.createElement('section'); row.className = 'mobility-step';
        row.innerHTML = `<div class="mobility-step-header"><strong>${index + 1}. ${escapeHTML(exercise?.name || 'Ejercicio no disponible')}</strong><div><button class="mobility-action up" type="button" aria-label="Subir paso" ${index === 0 ? 'disabled' : ''}>↑</button><button class="mobility-action down" type="button" aria-label="Bajar paso" ${index === draft.steps.length - 1 ? 'disabled' : ''}>↓</button>${renderLobbyAction({ kind: 'icon', icon: 'delete', label: 'Quitar paso', className: 'remove' })}</div></div><div class="mobility-form"><label>Modo<select class="acu-select-flat mode">${options(MOBILITY_MODES, MOBILITY_MODE_LABELS, step.mode)}</select></label><label>Objetivo (segundos o repeticiones)<input class="acu-input-flat target" type="number" min="1" step="1" value="${escapeAttribute(step.targetValue)}"></label><label>Lado<select class="acu-select-flat side">${options(MOBILITY_SIDES, MOBILITY_SIDE_LABELS, step.side)}</select></label><label>Transición posterior (s)<input class="acu-input-flat transition" type="number" min="0" step="1" value="${escapeAttribute(step.transitionAfter)}"></label><label class="mobility-wide">Notas<textarea class="acu-input-flat notes" rows="2">${escapeHTML(step.notes || '')}</textarea></label></div>`;
        row.querySelector('.up').onclick = () => { [draft.steps[index - 1], draft.steps[index]] = [draft.steps[index], draft.steps[index - 1]]; renderSteps(); };
        row.querySelector('.down').onclick = () => { [draft.steps[index + 1], draft.steps[index]] = [draft.steps[index], draft.steps[index + 1]]; renderSteps(); };
        row.querySelector('.remove').onclick = () => { draft.steps.splice(index, 1); renderSteps(); };
        for (const [selector, key] of [['mode','mode'],['target','targetValue'],['side','side'],['transition','transitionAfter'],['notes','notes']]) row.querySelector(`.${selector}`).oninput = e => { step[key] = ['targetValue','transitionAfter'].includes(key) ? (e.target.value === '' ? NaN : Number(e.target.value)) : e.target.value; container.querySelector('#mobility-estimate').textContent = `Duración estimada: ${formatDurationSeconds(estimateMobilityDuration(draft))}`; };
        list.appendChild(row);
      });
      container.querySelector('#mobility-estimate').textContent = `Duración estimada: ${formatDurationSeconds(estimateMobilityDuration(draft))}`;
    };
    container.querySelector('#mobility-add').onclick = () => { const exercise = exercises.find(e => e.id === container.querySelector('#mobility-add-select').value); if (!exercise) return; draft.steps.push({ exerciseId: exercise.id, mode: exercise.defaultMode, targetValue: exercise.defaultTarget, side: 'none', transitionAfter: 0 }); renderSteps(); };
    container.querySelector('#mobility-save').onclick = async () => { draft.name = (draft.name || '').trim(); draft.description = (draft.description || '').trim(); const issue = validateMobilityRoutine(draft, exercises); if (issue) { alert(issue); return; } draft.steps.forEach(step => { step.notes = (step.notes || '').trim(); if (!step.notes) delete step.notes; }); await putData(db, 'mobility_routines', draft); await reload(); lobby(); };
    renderSteps();
  }

  function timer(routine) {
    const issue = validateMobilityRoutine(routine, exercises); if (issue) { alert(issue); if (!orchestratorConfig) lobby(); return; }
    const phases = buildMobilityPhases(routine, exercises); let index = 0; let shownIndex = -1; let entries = []; let running = false; let started = false; let elapsed = 0; let phaseElapsed = 0; let lastTick = 0; let interval = null; let finishing = false;
    const root = createTimerShell({ gridId: 'mobility-timer-grid', className: 'mobility-timer', content: renderMobilityTimerContent() });
    container.innerHTML = ''; container.appendChild(root);
    const phaseEl = root.querySelector('#mobility-phase'); const clockEl = root.querySelector('#mobility-clock'); const techniqueEl = root.querySelector('#mobility-technique'); const play = root.querySelector('#mobility-play'); const complete = root.querySelector('#mobility-complete');
    const phaseDuration = phase => phase.type === 'transition' ? phase.duration : phase.step.mode === 'repetitions' ? null : Number(phase.step.targetValue);
    function show() {
      const phase = phases[index]; const duration = phaseDuration(phase);
      if (shownIndex !== index) {
        phaseEl.innerHTML = phase.type === 'transition' ? `<h2>Transición</h2><p>Prepárate para el siguiente paso.</p>` : `<p>Paso ${phase.index + 1} de ${routine.steps.length} · ${escapeHTML(MOBILITY_SIDE_LABELS[phase.step.side])}</p><h2>${escapeHTML(phase.exercise.name)}</h2><p>${escapeHTML(MOBILITY_MODE_LABELS[phase.step.mode])}: ${phase.step.targetValue} ${phase.step.mode === 'repetitions' ? 'repeticiones' : 'segundos'}</p>${phase.step.notes ? `<p class="mobility-note">${escapeHTML(phase.step.notes)}</p>` : ''}`;
        techniqueEl.innerHTML = phase.type === 'exercise' ? renderTechniqueDetails({ open: true, sections: [{ title: 'Enfoque', content: phase.exercise.focus }, { title: 'Preparación', content: phase.exercise.preparation }, { title: 'Ejecución', content: phase.exercise.execution }, { title: 'Precauciones', content: phase.exercise.precautions }] }) : '';
        shownIndex = index;
      }
      const clockValue = formatDurationSeconds(duration === null ? phaseElapsed : Math.max(0, duration - phaseElapsed));
      if (clockEl.dataset.value !== clockValue) { renderDotMatrix(clockEl, clockValue); clockEl.dataset.value = clockValue; clockEl.setAttribute('aria-label', `Tiempo del paso ${clockValue}`); }
      complete.disabled = !started || phase.type !== 'exercise'; root.querySelector('#mobility-skip').disabled = !started; root.querySelector('#mobility-prev').disabled = !started || index === 0; root.querySelector('#mobility-restart').disabled = !started;
      const playLabel = !started ? 'Iniciar' : running ? 'Pausar' : 'Continuar';
      play.innerHTML = running ? pauseIcon : playIcon;
      play.setAttribute('aria-label', playLabel); play.title = playLabel;
    }
    function capture() { if (!running) return; const now = Date.now(); const delta = Math.max(0, (now - lastTick) / 1000); lastTick = now; elapsed += delta; phaseElapsed += delta; }
    async function finish() {
      if (finishing) return; finishing = true; running = false; clearInterval(interval); await wake.release();
      const result = createModuleResult('mobility', elapsed, { routineId: routine.id, routineName: routine.name, entries });
      if (orchestratorConfig?.onComplete) { orchestratorConfig.onComplete(result); return; }
      try { await addData(db, 'sessions_log', { type: 'mobility', sessionId: routine.id, tags: ['mobility'], date: new Date().toISOString(), duration: Math.max(1, Math.round(elapsed / 60)), activeDurationSeconds: Math.round(elapsed), notes: `Rutina de movilidad completada: ${routine.name}.`, details: `Movilidad: ${routine.name}`, mobilityResult: result }); }
      catch (error) { console.error('[Mobility] Error al guardar historial:', error); alert('La rutina terminó, pero no se pudo guardar en el historial.'); }
      container.innerHTML = shell('Rutina completada', `<p class="mobility-estimate">${escapeHTML(routine.name)} · ${formatDurationSeconds(elapsed)}</p><button id="mobility-done" class="strength-manager__text-action">Volver a Movilidad</button>`); container.querySelector('#mobility-back').onclick = lobby; container.querySelector('#mobility-done').onclick = lobby;
    }
    function advance(status = 'completed') {
      const phase = phases[index]; if (phase.type === 'exercise') entries = recordMobilityEntry(entries, phase, status, phaseElapsed);
      if (index === phases.length - 1) { finish(); return; } index++; phaseElapsed = 0; lastTick = Date.now(); playQuartzBowlRing(432, 2); show();
    }
    play.onclick = () => { if (running) { capture(); running = false; clearInterval(interval); wake.release(); } else { started = true; running = true; lastTick = Date.now(); wake.request(); interval = setInterval(() => { capture(); const duration = phaseDuration(phases[index]); if (duration !== null && phaseElapsed >= duration) { advance(); } else show(); }, 250); } show(); };
    complete.onclick = () => { capture(); advance(); };
    root.querySelector('#mobility-skip').onclick = () => { capture(); advance('skipped'); };
    root.querySelector('#mobility-prev').onclick = () => { capture(); index = Math.max(0, index - 1); phaseElapsed = 0; lastTick = Date.now(); show(); };
    root.querySelector('#mobility-restart').onclick = () => { capture(); phaseElapsed = 0; lastTick = Date.now(); show(); };
    root.querySelector('#mobility-exit').onclick = async () => { const wasRunning = running; if (running) { capture(); running = false; clearInterval(interval); } show(); if (await requestTimerExitConfirmation(root)) { await wake.release(); if (orchestratorConfig) onNavigate('sessions'); else lobby(); } else if (wasRunning) { running = true; lastTick = Date.now(); interval = setInterval(() => { capture(); const duration = phaseDuration(phases[index]); if (duration !== null && phaseElapsed >= duration) advance(); else show(); }, 250); show(); } };
    show();
  }
  if (orchestratorConfig) { const routine = routines.find(item => item.id === orchestratorConfig.presetId); if (routine) timer(routine); else { container.innerHTML = shell('Movilidad', '<p>Rutina no disponible.</p>'); container.querySelector('#mobility-back').onclick = () => onNavigate('sessions'); } }
  else lobby();
}
