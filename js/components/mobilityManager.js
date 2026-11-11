import { getAllData, putData, deleteData } from '../db.js';
import { escapeHTML, escapeAttribute } from '../utils/sanitize.js';
import { MOBILITY_MODES, MOBILITY_MODE_LABELS, MOBILITY_CATEGORIES, MOBILITY_CATEGORY_LABELS } from '../utils/mobilityUtils.js';

export async function renderMobilityManager(container, db) {
  let editing = null;
  async function render() {
    const exercises = await getAllData(db, 'mobility_exercises');
    const routines = await getAllData(db, 'mobility_routines');
    container.innerHTML = `<div class="mobility-manager"><h3>Catálogo de movilidad</h3><form id="mobility-ex-form" class="mobility-form">
      <label>Nombre<input class="acu-input-flat" name="name" required value="${escapeAttribute(editing?.name || '')}"></label>
      <label>Categoría<select class="acu-select-flat" name="category">${MOBILITY_CATEGORIES.map(c => `<option value="${c}" ${editing?.category === c ? 'selected' : ''}>${MOBILITY_CATEGORY_LABELS[c]}</option>`).join('')}</select></label>
      <label>Modo habitual<select class="acu-select-flat" name="mode">${MOBILITY_MODES.map(m => `<option value="${m}" ${editing?.defaultMode === m ? 'selected' : ''}>${MOBILITY_MODE_LABELS[m]}</option>`).join('')}</select></label>
      <label>Objetivo habitual (segundos o repeticiones)<input class="acu-input-flat" type="number" name="target" min="1" step="1" required value="${editing?.defaultTarget || 60}"></label>
      ${[['focus','Enfoque'],['preparation','Preparación'],['execution','Ejecución'],['precautions','Precauciones']].map(([key,label]) => `<label class="mobility-wide">${label}<textarea class="acu-input-flat" name="${key}" rows="2">${escapeHTML(editing?.[key] || '')}</textarea></label>`).join('')}
      <label>Equipo (separado por comas)<input class="acu-input-flat" name="equipment" value="${escapeAttribute((editing?.equipment || []).join(', '))}"></label>
      <label>Familia de movimiento (ID opcional)<input class="acu-input-flat" name="familyId" value="${escapeAttribute(editing?.familyId || '')}"></label>
      <div class="mobility-wide"><button class="mobility-action" type="submit">${editing ? 'Guardar cambios' : 'Crear ejercicio'}</button>${editing ? '<button class="mobility-action" type="button" id="mobility-cancel">Cancelar</button>' : ''}</div></form>
      <div id="mobility-ex-list"></div></div>`;
    container.querySelector('#mobility-cancel')?.addEventListener('click', () => { editing = null; render(); });
    container.querySelector('form').addEventListener('submit', async event => {
      event.preventDefault(); const data = new FormData(event.currentTarget);
      const exercise = { ...editing, id: editing?.id || `mobility-ex-${Date.now()}`, name: data.get('name').trim(), category: data.get('category'), defaultMode: data.get('mode'), defaultTarget: Number(data.get('target')), focus: data.get('focus').trim(), preparation: data.get('preparation').trim(), execution: data.get('execution').trim(), precautions: data.get('precautions').trim(), equipment: data.get('equipment').split(',').map(item => item.trim()).filter(Boolean), familyId: data.get('familyId').trim() || null };
      if (!exercise.name || !Number.isInteger(exercise.defaultTarget) || exercise.defaultTarget < 1) return;
      await putData(db, 'mobility_exercises', exercise); editing = null; await render();
    });
    const list = container.querySelector('#mobility-ex-list');
    if (!exercises.length) list.innerHTML = '<p>No hay ejercicios de movilidad. Crea uno para construir rutinas.</p>';
    exercises.forEach(exercise => {
      const item = document.createElement('article'); item.className = 'mobility-list-item';
      item.innerHTML = `<div><strong>${escapeHTML(exercise.name)}</strong><p>${escapeHTML(MOBILITY_CATEGORY_LABELS[exercise.category] || '')} · ${escapeHTML(exercise.focus || '')}</p></div><div><button class="mobility-action edit">Editar</button><button class="mobility-action remove">Eliminar</button></div>`;
      item.querySelector('.edit').onclick = () => { editing = exercise; render(); };
      item.querySelector('.remove').onclick = async () => {
        const affected = routines.filter(r => r.steps?.some(s => s.exerciseId === exercise.id));
        if (!confirm(`¿Eliminar “${exercise.name}”? Se retirará de ${affected.length} rutina(s).`)) return;
        for (const routine of affected) { routine.steps = routine.steps.filter(s => s.exerciseId !== exercise.id); await putData(db, 'mobility_routines', routine); }
        await deleteData(db, 'mobility_exercises', exercise.id); editing = null; await render();
      };
      list.appendChild(item);
    });
  }
  await render();
}
