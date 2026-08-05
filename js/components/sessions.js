import { getAllData, addData, putData, deleteData } from '../db.js';
import { renderBreathworkScreen } from './breathwork.js';
import { renderStrengthScreen } from './strength.js';
import { renderYogaScreen } from './yoga.js';
import { renderAcupunctureScreen } from './acupuncture.js';
import { escapeHTML } from '../utils/sanitize.js';

export async function renderSessionsScreen(container, db, onNavigate, initialSessionId = null, initialView = 'lobby') {
  let activeView = initialView; // 'lobby' | 'builder' | 'transition'
  let sessionsCatalog = [];
  let currentSession = null;
  let currentBlockIndex = 0;

  // Estado del editor (builder)
  let editingSession = null;
  let presetsCatalog = {
    breathwork: [],
    strength: [],
    yoga: [],
    acupuncture: []
  };

  async function loadData() {
    try {
      sessionsCatalog = await getAllData(db, 'compound_sessions');
      
      const bw = await getAllData(db, 'breathwork_patterns');
      const st = await getAllData(db, 'strength_circuits');
      const yg = await getAllData(db, 'yoga_sequences');
      const ac = await getAllData(db, 'acupuncture_sequences');

      presetsCatalog.breathwork = bw.map(p => ({ id: p.id, name: p.name, defaultDuration: (p.inhale + p.holdIn + p.exhale + p.holdOut) * 10 }));
      presetsCatalog.strength = st.map(c => ({ id: c.id, name: c.name, defaultDuration: (c.workTime + c.restTime) * 6 }));
      presetsCatalog.yoga = yg.map(s => ({ id: s.id, name: s.name, defaultDuration: 600 }));
      presetsCatalog.acupuncture = ac.map(a => ({ id: a.id, name: a.name, defaultDuration: 420 }));

      // Si nos pasaron un sessionId inicial para editar
      if (initialSessionId && !editingSession) {
        const found = sessionsCatalog.find(s => s.id === initialSessionId);
        if (found) {
          editingSession = JSON.parse(JSON.stringify(found));
          activeView = 'builder';
        }
      }
    } catch (err) {
      console.error('[Sessions] Error al cargar datos del sistema:', err);
    }
  }

  async function refresh() {
    await loadData();
    container.innerHTML = '';
    
    if (activeView === 'lobby') {
      renderLobby();
    } else if (activeView === 'builder') {
      renderBuilder();
    }
  }

  function renderLobby() {
    const layout = document.createElement('div');
    layout.className = 'dashboard-layout fade-in';

    layout.innerHTML = `
      <nav class="nav-bar">
        <div class="nav-logo dot-digital">M.</div>
        <ul class="nav-links">
          <li class="nav-item" id="btn-back-home">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Volver</span>
          </li>
        </ul>
      </nav>

      <main class="main-viewport" style="display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 20px; overflow-y: auto;">
        <div class="glass-panel" style="max-width: 650px; width: 100%; padding: 24px; box-sizing: border-box; margin-bottom: 40px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <h2 class="module-lobby-title" style="margin: 0;">SESIONES COMPUESTAS</h2>
            <button id="btn-create-session" class="btn-braun-tab active" style="font-family: var(--font-digital); text-transform: uppercase; padding: 8px 14px; font-size: 0.75rem; cursor: pointer; border-radius: 0;">
              + Crear Sesión
            </button>
          </div>
          <p style="font-size: 0.85rem; color: var(--color-text-muted); margin-bottom: 24px; line-height: 1.4;">
            Rutinas integrales personalizables que encadenan respiración, fuerza, yoga y acupuntura en un solo flujo ininterrumpido.
          </p>

          <div class="syllabus-list" id="sessions-list" style="display: flex; flex-direction: column; gap: 16px;"></div>
        </div>
      </main>
    `;

    container.appendChild(layout);
    layout.querySelector('#btn-back-home').addEventListener('click', () => onNavigate('inicio'));
    layout.querySelector('#btn-create-session').addEventListener('click', () => {
      editingSession = {
        id: 'compound-' + Date.now(),
        name: 'Nueva Sesión Integrada',
        description: 'Descripción breve de la rutina...',
        blocks: [
          { module: 'breathwork', presetId: presetsCatalog.breathwork[0]?.id || 'breath-1', nameOverride: 'Respiración de Conexión', duration: 300 }
        ]
      };
      activeView = 'builder';
      refresh();
    });

    const listContainer = layout.querySelector('#sessions-list');
    
    if (sessionsCatalog.length === 0) {
      listContainer.innerHTML = '<p style="text-align: center; color: var(--color-text-muted); font-size: 0.85rem; padding: 24px;">No hay sesiones disponibles. Haz clic en "+ Crear Sesión" para construir tu primera rutina.</p>';
      return;
    }

    sessionsCatalog.forEach(session => {
      const el = document.createElement('div');
      el.className = 'syllabus-list-item';
      el.style.cssText = `
        padding: 16px;
        border: 1px solid rgba(46,43,40,0.1);
        border-radius: 4px;
        transition: background 0.2s;
      `;
      
      const blocksHtml = session.blocks.map((b, i) => 
        `<div style="font-size: 0.75rem; color: var(--color-text-muted); margin-top: 4px;">
           <span style="font-weight: 600; font-size: 0.65rem; color: var(--color-text-main);">[${b.module.toUpperCase()}]</span> ${escapeHTML(b.nameOverride)} (${b.duration}s)
         </div>`
      ).join('');

      el.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <div>
            <div style="font-weight: 600; font-size: 1rem;">${escapeHTML(session.name)}</div>
            <div style="font-size: 0.85rem; color: var(--color-text-muted); margin-top: 2px;">${escapeHTML(session.description || '')}</div>
          </div>
          <div style="display: flex; gap: 8px;">
            <button class="btn-edit-session" style="background: none; border: none; color: var(--color-text-main); font-size: 0.7rem; font-family: var(--font-digital); cursor: pointer; text-transform: uppercase;">[ EDITAR ]</button>
            <button class="btn-delete-session" style="background: none; border: none; color: var(--color-accent-red); font-size: 0.7rem; font-family: var(--font-digital); cursor: pointer; text-transform: uppercase;">[ BORRAR ]</button>
          </div>
        </div>
        <div style="padding-top: 8px; border-top: 1px dashed rgba(46,43,40,0.1);">
          ${blocksHtml}
        </div>
        <button class="btn-play-session" style="margin-top: 16px; width: 100%; border-radius: 4px; padding: 12px; font-weight: 600; font-size: 0.9rem; border: none; background: var(--color-text-main); color: var(--color-bg-base); cursor: pointer; text-transform: uppercase;">
          INICIAR SESIÓN
        </button>
      `;

      el.querySelector('.btn-edit-session').addEventListener('click', () => {
        editingSession = JSON.parse(JSON.stringify(session));
        activeView = 'builder';
        refresh();
      });

      el.querySelector('.btn-delete-session').addEventListener('click', async () => {
        if (confirm(`¿Seguro que deseas eliminar la sesión "${session.name}"?`)) {
          await deleteData(db, 'compound_sessions', session.id);
          refresh();
        }
      });
      
      el.querySelector('.btn-play-session').addEventListener('click', () => {
        startSession(session);
      });

      listContainer.appendChild(el);
    });
  }

  /* =============================================================
     VISTA 2: CONSTRUCTOR / BUILDER DE SESIONES COMPUESTAS
     ============================================================= */
  function renderBuilder() {
    if (!editingSession) {
      activeView = 'lobby';
      refresh();
      return;
    }

    const layout = document.createElement('div');
    layout.className = 'dashboard-layout fade-in';

    layout.innerHTML = `
      <nav class="nav-bar">
        <div class="nav-logo dot-digital">M.</div>
        <ul class="nav-links">
          <li class="nav-item" id="btn-cancel-builder">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Cancelar</span>
          </li>
        </ul>
      </nav>

      <main class="main-viewport" style="display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 20px; overflow-y: auto;">
        <div class="glass-panel" style="max-width: 650px; width: 100%; padding: 24px; box-sizing: border-box; margin-bottom: 40px;">
          <h2 class="module-lobby-title" style="margin-bottom: 16px; font-family: var(--font-digital); font-size: 1.1rem; text-transform: uppercase;">
            ${sessionsCatalog.some(s => s.id === editingSession.id) ? '[ EDITAR SESIÓN COMPUESTA ]' : '[ CREAR SESIÓN COMPUESTA ]'}
          </h2>

          <form id="form-builder" style="display: flex; flex-direction: column; gap: 16px;">
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 0.65rem; color: var(--color-text-muted); text-transform: uppercase; font-family: var(--font-digital);">Nombre de la Sesión</label>
              <input type="text" id="builder-name" class="acu-input-flat" value="${escapeHTML(editingSession.name)}" style="padding: 8px; font-size: 0.9rem;" required>
            </div>

            <div style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 0.65rem; color: var(--color-text-muted); text-transform: uppercase; font-family: var(--font-digital);">Descripción / Intención Clínica</label>
              <textarea id="builder-desc" class="acu-input-flat" style="padding: 8px; font-size: 0.85rem; min-height: 60px; resize: vertical;" required>${escapeHTML(editingSession.description || '')}</textarea>
            </div>

            <div style="border-top: 1px dashed rgba(46,43,40,0.1); padding-top: 16px; margin-top: 8px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <label style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; font-family: var(--font-digital);">Bloques Secuenciales (${editingSession.blocks.length})</label>
                <button type="button" id="btn-add-block" class="btn-braun-tab active" style="padding: 4px 10px; font-size: 0.7rem; font-family: var(--font-digital); cursor: pointer;">+ Agregar Bloque</button>
              </div>

              <div id="blocks-container" style="display: flex; flex-direction: column; gap: 12px;"></div>
            </div>

            <div style="display: flex; gap: 12px; margin-top: 24px;">
              <button type="submit" style="flex: 1; padding: 12px; background: var(--color-text-main); color: var(--color-bg-base); border: none; font-weight: 600; font-size: 0.85rem; border-radius: 4px; cursor: pointer; text-transform: uppercase;">
                Guardar Sesión Compuesta
              </button>
              <button type="button" id="btn-discard" style="padding: 12px 20px; background: transparent; border: 1px solid rgba(46,43,40,0.2); color: var(--color-text-main); font-size: 0.85rem; border-radius: 4px; cursor: pointer;">
                Cancelar
              </button>
            </div>
          </form>
        </div>
      </main>
    `;

    container.appendChild(layout);

    layout.querySelector('#btn-cancel-builder').addEventListener('click', () => { activeView = 'lobby'; refresh(); });
    layout.querySelector('#btn-discard').addEventListener('click', () => { activeView = 'lobby'; refresh(); });
    layout.querySelector('#btn-add-block').addEventListener('click', () => {
      const defaultMod = 'breathwork';
      const defaultPreset = presetsCatalog.breathwork[0];
      editingSession.blocks.push({
        module: defaultMod,
        presetId: defaultPreset ? defaultPreset.id : 'preset-default',
        nameOverride: defaultPreset ? defaultPreset.name : 'Bloque Nuevo',
        duration: defaultPreset ? defaultPreset.defaultDuration : 300
      });
      renderBlocksList();
    });

    const form = layout.querySelector('#form-builder');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      editingSession.name = layout.querySelector('#builder-name').value.trim();
      editingSession.description = layout.querySelector('#builder-desc').value.trim();

      if (editingSession.blocks.length === 0) {
        alert('Debes incluir al menos un bloque en la sesión compuesta.');
        return;
      }

      try {
        await putData(db, 'compound_sessions', editingSession);
        alert('Sesión compuesta guardada exitosamente.');
        editingSession = null;
        activeView = 'lobby';
        refresh();
      } catch (err) {
        console.error('[Builder] Error al guardar sesión compuesta:', err);
        alert('Error al guardar la sesión compuesta en la base de datos.');
      }
    });

    function renderBlocksList() {
      const blocksContainer = layout.querySelector('#blocks-container');
      blocksContainer.innerHTML = '';

      if (editingSession.blocks.length === 0) {
        blocksContainer.innerHTML = '<p style="font-size:0.75rem; color:var(--color-text-muted); font-style:italic;">No hay bloques agregados. Haz clic en "+ Agregar Bloque".</p>';
        return;
      }

      editingSession.blocks.forEach((block, index) => {
        const blockEl = document.createElement('div');
        blockEl.style.cssText = `
          padding: 12px;
          border: 1px solid rgba(46,43,40,0.12);
          background: rgba(0,0,0,0.015);
          border-radius: 4px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        `;

        const availablePresets = presetsCatalog[block.module] || [];
        const optionsHtml = availablePresets.map(p => 
          `<option value="${p.id}" ${p.id === block.presetId ? 'selected' : ''}>${escapeHTML(p.name)}</option>`
        ).join('');

        blockEl.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px dashed rgba(46,43,40,0.08); padding-bottom: 4px;">
            <span style="font-family: var(--font-digital); font-size: 0.7rem; font-weight: 600; text-transform: uppercase;">
              Bloque ${index + 1}
            </span>
            <div style="display: flex; gap: 4px;">
              <button type="button" class="btn-move-up" style="background:none; border:none; cursor:pointer; font-size:0.7rem;" ${index === 0 ? 'disabled' : ''}>▲</button>
              <button type="button" class="btn-move-down" style="background:none; border:none; cursor:pointer; font-size:0.7rem;" ${index === editingSession.blocks.length - 1 ? 'disabled' : ''}>▼</button>
              <button type="button" class="btn-remove-block" style="background:none; border:none; color:var(--color-accent-red); cursor:pointer; font-size:0.7rem; margin-left:8px;">[ ELIMINAR ]</button>
            </div>
          </div>

          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <div style="width: 120px; display: flex; flex-direction: column; gap: 2px;">
              <label style="font-size:0.55rem; color:var(--color-text-muted); text-transform:uppercase;">Módulo</label>
              <select class="block-module-select acu-select-flat" style="padding: 4px; font-size:0.75rem;">
                <option value="breathwork" ${block.module === 'breathwork' ? 'selected' : ''}>Breathwork</option>
                <option value="strength" ${block.module === 'strength' ? 'selected' : ''}>Fuerza</option>
                <option value="yoga" ${block.module === 'yoga' ? 'selected' : ''}>Yin Yoga</option>
                <option value="acupuncture" ${block.module === 'acupuncture' ? 'selected' : ''}>Acupuntura</option>
              </select>
            </div>

            <div style="flex: 1; min-width: 150px; display: flex; flex-direction: column; gap: 2px;">
              <label style="font-size:0.55rem; color:var(--color-text-muted); text-transform:uppercase;">Preset Clínico / Rutina</label>
              <select class="block-preset-select acu-select-flat" style="padding: 4px; font-size:0.75rem;">
                ${optionsHtml}
              </select>
            </div>
          </div>

          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <div style="flex: 1; min-width: 150px; display: flex; flex-direction: column; gap: 2px;">
              <label style="font-size:0.55rem; color:var(--color-text-muted); text-transform:uppercase;">Nombre del Bloque</label>
              <input type="text" class="block-name-input acu-input-flat" value="${escapeHTML(block.nameOverride || '')}" style="padding: 4px; font-size:0.75rem;" required>
            </div>

            <div style="width: 90px; display: flex; flex-direction: column; gap: 2px;">
              <label style="font-size:0.55rem; color:var(--color-text-muted); text-transform:uppercase;">Duración (s)</label>
              <input type="number" class="block-dur-input acu-input-flat" value="${block.duration}" min="10" style="padding: 4px; font-size:0.75rem;" required>
            </div>
          </div>
        `;

        // Eventos del bloque
        blockEl.querySelector('.btn-move-up').addEventListener('click', () => {
          if (index > 0) {
            const temp = editingSession.blocks[index];
            editingSession.blocks[index] = editingSession.blocks[index - 1];
            editingSession.blocks[index - 1] = temp;
            renderBlocksList();
          }
        });

        blockEl.querySelector('.btn-move-down').addEventListener('click', () => {
          if (index < editingSession.blocks.length - 1) {
            const temp = editingSession.blocks[index];
            editingSession.blocks[index] = editingSession.blocks[index + 1];
            editingSession.blocks[index + 1] = temp;
            renderBlocksList();
          }
        });

        blockEl.querySelector('.btn-remove-block').addEventListener('click', () => {
          editingSession.blocks.splice(index, 1);
          renderBlocksList();
        });

        const modSelect = blockEl.querySelector('.block-module-select');
        const presetSelect = blockEl.querySelector('.block-preset-select');
        const nameInput = blockEl.querySelector('.block-name-input');
        const durInput = blockEl.querySelector('.block-dur-input');

        modSelect.addEventListener('change', (e) => {
          block.module = e.target.value;
          const newPresets = presetsCatalog[block.module] || [];
          if (newPresets.length > 0) {
            block.presetId = newPresets[0].id;
            block.nameOverride = newPresets[0].name;
            block.duration = newPresets[0].defaultDuration;
          }
          renderBlocksList();
        });

        presetSelect.addEventListener('change', (e) => {
          block.presetId = e.target.value;
          const foundPreset = (presetsCatalog[block.module] || []).find(p => p.id === block.presetId);
          if (foundPreset) {
            block.nameOverride = foundPreset.name;
            block.duration = foundPreset.defaultDuration;
            nameInput.value = foundPreset.name;
            durInput.value = foundPreset.defaultDuration;
          }
        });

        nameInput.addEventListener('input', (e) => {
          block.nameOverride = e.target.value;
        });

        durInput.addEventListener('input', (e) => {
          block.duration = parseInt(e.target.value) || 60;
        });

        blocksContainer.appendChild(blockEl);
      });
    }

    renderBlocksList();
  }

  function startSession(session) {
    currentSession = session;
    currentBlockIndex = 0;
    runCurrentBlock();
  }

  function runCurrentBlock() {
    if (!currentSession || currentBlockIndex >= currentSession.blocks.length) {
      finishCompoundSession();
      return;
    }

    const block = currentSession.blocks[currentBlockIndex];
    renderTransitionScreen(block, () => {
      const orchestratorConfig = {
        presetId: block.presetId,
        duration: block.duration,
        onComplete: () => {
          currentBlockIndex++;
          runCurrentBlock();
        }
      };

      container.innerHTML = '';

      if (block.module === 'breathwork') {
        renderBreathworkScreen(container, db, onNavigate, orchestratorConfig);
      } else if (block.module === 'strength') {
        renderStrengthScreen(container, db, onNavigate, orchestratorConfig);
      } else if (block.module === 'yoga') {
        renderYogaScreen(container, db, onNavigate, orchestratorConfig);
      } else if (block.module === 'acupuncture') {
        renderAcupunctureScreen(container, db, onNavigate, orchestratorConfig);
      } else {
        console.warn(`[Sessions] Módulo desconocido: ${block.module}`);
        currentBlockIndex++;
        runCurrentBlock();
      }
    });
  }

  function renderTransitionScreen(block, onReady) {
    activeView = 'transition';
    container.innerHTML = `
      <div class="dashboard-layout" style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background: #0A0A0A; color: #E8E6E3;">
        <h2 style="font-family: var(--font-digital); font-size: 1.5rem; letter-spacing: 0.1em; margin-bottom: 24px; color: var(--color-text-muted);">PREPARANDO SIGUIENTE BLOQUE</h2>
        <div style="font-size: 2rem; font-weight: 300; margin-bottom: 8px;">${block.module.toUpperCase()}</div>
        <div style="font-size: 1.2rem; color: var(--color-text-muted);">${escapeHTML(block.nameOverride)}</div>
        
        <div id="countdown" style="font-size: 4rem; font-weight: 600; margin-top: 40px;">5</div>
        
        <button id="btn-cancel-transition" style="margin-top: 40px; background: transparent; border: 1px solid rgba(255,255,255,0.2); color: #E8E6E3; padding: 12px 24px; border-radius: 4px; cursor: pointer;">
          ABANDONAR SESIÓN
        </button>
      </div>
    `;

    let timeLeft = 5;
    const countEl = container.querySelector('#countdown');
    const interval = setInterval(() => {
      timeLeft--;
      if (timeLeft <= 0) {
        clearInterval(interval);
        onReady();
      } else {
        countEl.textContent = timeLeft;
      }
    }, 1000);

    container.querySelector('#btn-cancel-transition').addEventListener('click', () => {
      clearInterval(interval);
      if (confirm('¿Deseas cancelar la sesión compuesta actual?')) {
        onNavigate('inicio');
      } else {
        onReady();
      }
    });
  }

  async function finishCompoundSession() {
    alert('¡Sesión Integral Completada con éxito!');
    
    try {
      let totalDuration = 0;
      currentSession.blocks.forEach(b => totalDuration += b.duration);
      
      const blocksLog = currentSession.blocks.map(b => ({
        module: b.module,
        name: b.nameOverride,
        duration: b.duration
      }));

      await addData(db, 'sessions_log', {
        type: 'compound',
        date: new Date().toISOString(),
        duration: Math.max(1, Math.round(totalDuration / 60)),
        notes: `Sesión Compuesta Completada: ${currentSession.name}`,
        details: `Compuesta: ${escapeHTML(currentSession.name)}`,
        blocks: blocksLog
      });
    } catch (err) {
      console.error('[Sessions] Error saving compound session log:', err);
    }

    onNavigate('inicio');
  }

  // Inicio
  refresh();
}
