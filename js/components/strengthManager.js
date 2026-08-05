import {
  deleteStrengthCircuitAndDetach,
  deleteStrengthExerciseAndDetach,
  getAllData,
  putData
} from '../db.js';
import { escapeAttribute, escapeHTML } from '../utils/sanitize.js';
import {
  deriveCircuitEquipment,
  estimateStrengthCircuitDuration,
  getCircuitValidation,
  getStrengthExercise
} from '../utils/strengthUtils.js';

const editIcon = `
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
  </svg>`;

const deleteIcon = `
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
    <polyline points="3 6 5 6 21 6"></polyline>
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
  </svg>`;

function parseList(value) {
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

function formatAffected(items) {
  return items.map(item => `• ${item.name}${item.becomesEmpty ? ' (quedará vacío)' : ''}`).join('\n');
}

export async function renderStrengthManager(container, db) {
  let exercises = [];
  let circuits = [];
  let activeSubTab = 'exercises';
  let editingExercise = null;
  let editingCircuit = null;
  let exerciseFormOpen = false;
  let circuitFormOpen = false;
  let circuitEntries = [];

  async function loadData() {
    [exercises, circuits] = await Promise.all([
      getAllData(db, 'strength_exercises'),
      getAllData(db, 'strength_circuits')
    ]);
    exercises.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
    circuits.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));
  }

  async function refresh() {
    await loadData();
    render();
  }

  function render() {
    container.innerHTML = `
      <section class="strength-manager">
        <div class="strength-manager__tabs">
          <button type="button" class="btn-braun-tab ${activeSubTab === 'exercises' ? 'active' : ''}" id="strength-tab-exercises">Ejercicios</button>
          <button type="button" class="btn-braun-tab ${activeSubTab === 'circuits' ? 'active' : ''}" id="strength-tab-circuits">Circuitos</button>
        </div>
        <div id="strength-manager-content"></div>
      </section>
    `;

    container.querySelector('#strength-tab-exercises').addEventListener('click', () => {
      activeSubTab = 'exercises';
      editingCircuit = null;
      render();
    });
    container.querySelector('#strength-tab-circuits').addEventListener('click', () => {
      activeSubTab = 'circuits';
      editingExercise = null;
      render();
    });

    if (activeSubTab === 'exercises') renderExercises();
    else renderCircuits();
  }

  function renderExercises() {
    const target = container.querySelector('#strength-manager-content');
    target.innerHTML = `
      <div class="strength-manager__accordion">
        <button type="button" class="strength-manager__accordion-trigger" id="strength-toggle-exercise-form" aria-expanded="${exerciseFormOpen}">
          <span>${editingExercise ? '✎ EDITAR EJERCICIO' : '+ REGISTRAR EJERCICIO'}</span>
          <span>${exerciseFormOpen ? '▼' : '▶'}</span>
        </button>
        <div class="strength-manager__accordion-body" style="display:${exerciseFormOpen ? 'block' : 'none'}">
          <form id="strength-exercise-form" class="strength-manager__form">
            <div class="strength-manager__grid strength-manager__grid--exercise">
              <label class="strength-manager__field strength-manager__field--wide"><span>Nombre</span><input id="strength-ex-name" class="acu-input-flat" required></label>
              <label class="strength-manager__field"><span>Foco corporal</span><input id="strength-ex-focus" class="acu-input-flat" required></label>
              <label class="strength-manager__field"><span>Modo</span><select id="strength-ex-mode" class="acu-select-flat"><option value="reps">Repeticiones</option><option value="time">Tiempo</option></select></label>
              <label class="strength-manager__field strength-manager__field--full"><span>Preparación</span><textarea id="strength-ex-preparation" class="acu-input-flat" required></textarea></label>
              <label class="strength-manager__field strength-manager__field--full"><span>Ejecución</span><textarea id="strength-ex-execution" class="acu-input-flat" required></textarea></label>
              <label class="strength-manager__field strength-manager__field--full"><span>Equipo — separado por comas</span><input id="strength-ex-equipment" class="acu-input-flat" placeholder="Mat de yoga, Pelota grande"></label>
              <label class="strength-manager__field strength-manager__field--full"><span>Etiquetas — separadas por comas</span><input id="strength-ex-tags" class="acu-input-flat" placeholder="core, estabilidad, piernas"></label>
            </div>
            <div class="strength-manager__form-actions">
              ${editingExercise ? '<button type="button" class="strength-manager__text-action secondary" id="strength-cancel-exercise">Cancelar</button>' : ''}
              <button type="submit" class="strength-manager__text-action">${editingExercise ? 'Guardar cambios' : 'Crear ejercicio'}</button>
            </div>
          </form>
        </div>
      </div>
      <div class="strength-manager__list" id="strength-exercises-list"></div>
    `;

    target.querySelector('#strength-toggle-exercise-form').addEventListener('click', () => {
      exerciseFormOpen = !exerciseFormOpen;
      renderExercises();
    });

    const modeSelect = target.querySelector('#strength-ex-mode');
    if (editingExercise) {
      target.querySelector('#strength-ex-name').value = editingExercise.name || '';
      target.querySelector('#strength-ex-focus').value = editingExercise.focus || '';
      modeSelect.value = editingExercise.mode || 'reps';
      target.querySelector('#strength-ex-preparation').value = editingExercise.preparation || '';
      target.querySelector('#strength-ex-execution').value = editingExercise.execution || '';
      target.querySelector('#strength-ex-equipment').value = (editingExercise.equipment || []).join(', ');
      target.querySelector('#strength-ex-tags').value = (editingExercise.tags || []).join(', ');
      target.querySelector('#strength-cancel-exercise').addEventListener('click', () => {
        editingExercise = null;
        exerciseFormOpen = false;
        renderExercises();
      });
    }
    target.querySelector('#strength-exercise-form').addEventListener('submit', async event => {
      event.preventDefault();
      const mode = modeSelect.value;
      const data = {
        id: editingExercise?.id || `strength-exercise-${Date.now()}`,
        name: target.querySelector('#strength-ex-name').value.trim(),
        focus: target.querySelector('#strength-ex-focus').value.trim(),
        mode,
        preparation: target.querySelector('#strength-ex-preparation').value.trim(),
        execution: target.querySelector('#strength-ex-execution').value.trim(),
        equipment: parseList(target.querySelector('#strength-ex-equipment').value),
        tags: parseList(target.querySelector('#strength-ex-tags').value)
      };
      await putData(db, 'strength_exercises', data);
      editingExercise = null;
      exerciseFormOpen = false;
      await refresh();
    });

    const list = target.querySelector('#strength-exercises-list');
    if (exercises.length === 0) {
      list.innerHTML = '<p class="strength-manager__empty">No hay ejercicios. Registra el primero para construir circuitos.</p>';
      return;
    }
    exercises.forEach(exercise => {
      const dependencies = circuits.filter(circuit => (circuit.exercises || []).some(entry => entry.exerciseId === exercise.id));
      const item = document.createElement('article');
      item.className = 'strength-manager__item';
      item.innerHTML = `
        <div class="strength-manager__item-main">
          <strong>${escapeHTML(exercise.name)}</strong>
          <span>${escapeHTML(exercise.focus || '')}</span>
          <small>${exercise.mode === 'time' ? 'Prescripción por tiempo' : 'Prescripción por repeticiones'} · ${(exercise.equipment || []).map(escapeHTML).join(', ') || 'Sin equipo'}</small>
          ${dependencies.length ? `<small>Usado en ${dependencies.length} circuito${dependencies.length === 1 ? '' : 's'}</small>` : ''}
        </div>
        <div class="strength-manager__item-actions">
          <button class="btn-action-icon strength-edit-exercise" title="Editar" aria-label="Editar">${editIcon}</button>
          <button class="btn-action-icon delete-icon strength-delete-exercise" title="Eliminar" aria-label="Eliminar">${deleteIcon}</button>
        </div>`;
      item.querySelector('.strength-edit-exercise').addEventListener('click', () => {
        editingExercise = structuredClone(exercise);
        exerciseFormOpen = true;
        renderExercises();
      });
      item.querySelector('.strength-delete-exercise').addEventListener('click', async () => {
        const warning = dependencies.length
          ? `Se retirará de estos circuitos:\n${formatAffected(dependencies.map(circuit => ({ ...circuit, becomesEmpty: circuit.exercises.length === 1 })))}\n\n`
          : '';
        if (!confirm(`${warning}¿Eliminar el ejercicio "${exercise.name}"?`)) return;
        const affected = await deleteStrengthExerciseAndDetach(db, exercise.id);
        alert(affected.length ? `Ejercicio eliminado. Circuitos actualizados:\n${formatAffected(affected)}` : 'Ejercicio eliminado.');
        await refresh();
      });
      list.appendChild(item);
    });
  }

  function renderCircuits() {
    const target = container.querySelector('#strength-manager-content');
    target.innerHTML = `
      <div class="strength-manager__accordion">
        <button type="button" class="strength-manager__accordion-trigger" id="strength-toggle-circuit-form" aria-expanded="${circuitFormOpen}">
          <span>${editingCircuit ? '✎ EDITAR CIRCUITO' : '+ CREAR CIRCUITO'}</span>
          <span>${circuitFormOpen ? '▼' : '▶'}</span>
        </button>
        <div class="strength-manager__accordion-body" style="display:${circuitFormOpen ? 'block' : 'none'}">
          <form id="strength-circuit-form" class="strength-manager__form">
            <div class="strength-manager__grid">
              <label class="strength-manager__field strength-manager__field--wide"><span>Nombre</span><input id="strength-circuit-name" class="acu-input-flat" required></label>
              <label class="strength-manager__field"><span>Rondas</span><input type="number" id="strength-circuit-rounds" class="acu-input-flat" min="1" value="3" required></label>
              <label class="strength-manager__field"><span>Descanso entre ejercicios (s)</span><input type="number" id="strength-circuit-rest-ex" class="acu-input-flat" min="0" value="18" required></label>
              <label class="strength-manager__field"><span>Descanso entre rondas (s)</span><input type="number" id="strength-circuit-rest-round" class="acu-input-flat" min="0" value="60" required></label>
              <label class="strength-manager__field strength-manager__field--full"><span>Descripción</span><textarea id="strength-circuit-description" class="acu-input-flat" required></textarea></label>
            </div>
            <section class="strength-circuit-builder">
              <div class="strength-circuit-builder__header"><strong>Ejercicios del circuito</strong><span id="strength-circuit-equipment"></span></div>
              <div id="strength-circuit-entries"></div>
              <div class="strength-circuit-builder__add">
                <select id="strength-circuit-add-select" class="acu-select-flat">
                  <option value="">Seleccionar ejercicio</option>
                  ${exercises.map(exercise => `<option value="${escapeAttribute(exercise.id)}">${escapeHTML(exercise.name)}</option>`).join('')}
                </select>
                <button type="button" class="strength-manager__text-action" id="strength-circuit-add">+ Agregar</button>
              </div>
            </section>
            <div class="strength-manager__form-actions">
              ${editingCircuit ? '<button type="button" class="strength-manager__text-action secondary" id="strength-cancel-circuit">Cancelar</button>' : ''}
              <button type="submit" class="strength-manager__text-action">${editingCircuit ? 'Guardar cambios' : 'Crear circuito'}</button>
            </div>
          </form>
        </div>
      </div>
      <div class="strength-manager__list" id="strength-circuits-list"></div>`;

    target.querySelector('#strength-toggle-circuit-form').addEventListener('click', () => {
      circuitFormOpen = !circuitFormOpen;
      renderCircuits();
    });

    if (editingCircuit) {
      target.querySelector('#strength-circuit-name').value = editingCircuit.name || '';
      target.querySelector('#strength-circuit-rounds').value = editingCircuit.rounds || 1;
      target.querySelector('#strength-circuit-rest-ex').value = editingCircuit.restBetweenExercises ?? 0;
      target.querySelector('#strength-circuit-rest-round').value = editingCircuit.restBetweenRounds ?? 0;
      target.querySelector('#strength-circuit-description').value = editingCircuit.description || '';
      target.querySelector('#strength-cancel-circuit').addEventListener('click', () => {
        editingCircuit = null;
        circuitEntries = [];
        circuitFormOpen = false;
        renderCircuits();
      });
    }

    const renderEntries = () => {
      const entriesContainer = target.querySelector('#strength-circuit-entries');
      entriesContainer.innerHTML = '';
      if (circuitEntries.length === 0) {
        entriesContainer.innerHTML = '<p class="strength-manager__empty">Añade al menos un ejercicio.</p>';
      }
      circuitEntries.forEach((entry, index) => {
        const exercise = getStrengthExercise(exercises, entry.exerciseId);
        const row = document.createElement('div');
        row.className = `strength-circuit-entry ${exercise ? '' : 'invalid'}`;
        const override = exercise?.mode === 'time' ? entry.durationOverride : entry.repsOverride;
        row.innerHTML = `
          <span class="strength-circuit-entry__index">${index + 1}</span>
          <div class="strength-circuit-entry__main"><strong>${escapeHTML(exercise?.name || 'Ejercicio no disponible')}</strong><small>${exercise ? (exercise.mode === 'time' ? 'Asignar tiempo en este circuito' : 'Asignar repeticiones en este circuito') : escapeHTML(entry.exerciseId)}</small></div>
          ${exercise ? `<label class="strength-circuit-entry__override"><span>${exercise.mode === 'time' ? 'Tiempo (s)' : 'Repeticiones'}</span><input type="number" class="acu-input-flat" min="1" value="${override ?? ''}" placeholder="Asignar" required></label>` : ''}
          <div class="strength-circuit-entry__actions">
            <button type="button" class="strength-entry-up" aria-label="Subir" ${index === 0 ? 'disabled' : ''}>▲</button>
            <button type="button" class="strength-entry-down" aria-label="Bajar" ${index === circuitEntries.length - 1 ? 'disabled' : ''}>▼</button>
            <button type="button" class="btn-action-icon delete-icon strength-entry-remove" aria-label="Retirar">${deleteIcon}</button>
          </div>`;
        row.querySelector('.strength-entry-up').addEventListener('click', () => {
          [circuitEntries[index - 1], circuitEntries[index]] = [circuitEntries[index], circuitEntries[index - 1]];
          renderEntries();
        });
        row.querySelector('.strength-entry-down').addEventListener('click', () => {
          [circuitEntries[index], circuitEntries[index + 1]] = [circuitEntries[index + 1], circuitEntries[index]];
          renderEntries();
        });
        row.querySelector('.strength-entry-remove').addEventListener('click', () => {
          circuitEntries.splice(index, 1);
          renderEntries();
        });
        const overrideInput = row.querySelector('input');
        if (overrideInput && exercise) {
          overrideInput.addEventListener('input', () => {
            const value = overrideInput.value ? Number(overrideInput.value) : null;
            entry.repsOverride = exercise.mode === 'reps' ? value : null;
            entry.durationOverride = exercise.mode === 'time' ? value : null;
          });
        }
        entriesContainer.appendChild(row);
      });
      const equipment = deriveCircuitEquipment({ exercises: circuitEntries }, exercises);
      target.querySelector('#strength-circuit-equipment').textContent = equipment.length ? `Equipo: ${equipment.join(', ')}` : 'Sin equipo calculado';
    };

    target.querySelector('#strength-circuit-add').addEventListener('click', () => {
      const select = target.querySelector('#strength-circuit-add-select');
      if (!select.value) return;
      circuitEntries.push({ exerciseId: select.value, repsOverride: null, durationOverride: null });
      select.value = '';
      renderEntries();
    });
    renderEntries();

    target.querySelector('#strength-circuit-form').addEventListener('submit', async event => {
      event.preventDefault();
      const hasInvalidEntry = circuitEntries.some(entry => {
        const exercise = getStrengthExercise(exercises, entry.exerciseId);
        const value = exercise?.mode === 'time' ? entry.durationOverride : entry.repsOverride;
        return !exercise || !Number.isFinite(Number(value)) || Number(value) <= 0;
      });
      if (circuitEntries.length === 0 || hasInvalidEntry) {
        alert('Cada ejercicio del circuito debe tener un tiempo o número de repeticiones asignado.');
        return;
      }
      const data = {
        id: editingCircuit?.id || `strength-circuit-${Date.now()}`,
        name: target.querySelector('#strength-circuit-name').value.trim(),
        description: target.querySelector('#strength-circuit-description').value.trim(),
        rounds: Number(target.querySelector('#strength-circuit-rounds').value),
        restBetweenExercises: Number(target.querySelector('#strength-circuit-rest-ex').value),
        restBetweenRounds: Number(target.querySelector('#strength-circuit-rest-round').value),
        exercises: structuredClone(circuitEntries)
      };
      await putData(db, 'strength_circuits', data);
      editingCircuit = null;
      circuitEntries = [];
      circuitFormOpen = false;
      await refresh();
    });

    const list = target.querySelector('#strength-circuits-list');
    if (circuits.length === 0) {
      list.innerHTML = '<p class="strength-manager__empty">No hay circuitos. Crea uno desde el catálogo de ejercicios.</p>';
      return;
    }
    circuits.forEach(circuit => {
      const validation = getCircuitValidation(circuit, exercises);
      const equipment = deriveCircuitEquipment(circuit, exercises);
      const duration = estimateStrengthCircuitDuration(circuit, exercises);
      const dependencies = [];
      const item = document.createElement('article');
      item.className = `strength-manager__item ${validation.isValid ? '' : 'invalid'}`;
      item.innerHTML = `
        <div class="strength-manager__item-main">
          <strong>${escapeHTML(circuit.name)}</strong>
          <span>${escapeHTML(circuit.description || '')}</span>
          <small>${circuit.rounds || 1} rondas · ${(circuit.exercises || []).length} ejercicios · ${Math.ceil(duration / 60)} min</small>
          <small>Descansos: ${circuit.restBetweenExercises ?? 0}s entre ejercicios · ${circuit.restBetweenRounds ?? 0}s entre rondas</small>
          <small>${equipment.length ? `Equipo: ${equipment.map(escapeHTML).join(', ')}` : 'Sin equipo'}</small>
          ${validation.isValid ? '' : `<small class="strength-manager__warning">${escapeHTML(validation.reason)}</small>`}
        </div>
        <div class="strength-manager__item-actions">
          <button class="btn-action-icon strength-edit-circuit" title="Editar" aria-label="Editar">${editIcon}</button>
          <button class="btn-action-icon delete-icon strength-delete-circuit" title="Eliminar" aria-label="Eliminar">${deleteIcon}</button>
        </div>`;
      item.querySelector('.strength-edit-circuit').addEventListener('click', () => {
        editingCircuit = structuredClone(circuit);
        circuitEntries = structuredClone(circuit.exercises || []);
        circuitFormOpen = true;
        renderCircuits();
      });
      item.querySelector('.strength-delete-circuit').addEventListener('click', async () => {
        const sessions = await getAllData(db, 'compound_sessions');
        dependencies.push(...sessions.filter(session => (session.blocks || []).some(block => block.module === 'strength' && block.presetId === circuit.id)));
        const warning = dependencies.length ? `Se retirará de estas sesiones compuestas:\n${dependencies.map(session => `• ${session.name}`).join('\n')}\n\n` : '';
        if (!confirm(`${warning}¿Eliminar el circuito "${circuit.name}"?`)) return;
        const affected = await deleteStrengthCircuitAndDetach(db, circuit.id);
        alert(affected.length ? `Circuito eliminado. Sesiones actualizadas:\n${formatAffected(affected)}` : 'Circuito eliminado.');
        await refresh();
      });
      list.appendChild(item);
    });
  }

  await refresh();
}
