import { getAllData, addData, putData, deleteData } from '../db.js';
import { renderBreathworkScreen } from './breathwork.js';
import { renderStrengthScreen } from './strength.js';
import { renderYogaScreen } from './yoga.js';
import { renderAcupunctureScreen } from './acupuncture.js';
import { escapeHTML } from '../utils/sanitize.js';
import { renderTechnicalTitle } from './ui.js';
import { renderLobbyAction, renderLobbyShell } from './lobbyUi.js';
import { renderCompoundAction, renderCompoundSessionBlock, renderCompoundSessionCard } from './sessionsUi.js';
import { estimateStrengthCircuitDuration, getCircuitValidation } from '../utils/strengthUtils.js';

export async function renderSessionsScreen(container, db, onNavigate, initialSessionId = null, initialView = 'lobby') {
  let activeView = initialView; // 'lobby' | 'builder' | 'transition'
  let sessionsCatalog = [];
  let currentSession = null;
  let currentBlockIndex = 0;
  let currentBlockResults = [];
  let strengthCircuits = [];
  let strengthExercises = [];

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
      const strengthExerciseCatalog = await getAllData(db, 'strength_exercises');
      const yg = await getAllData(db, 'yoga_sequences');
      const ac = await getAllData(db, 'acupuncture_sequences');

      presetsCatalog.breathwork = bw.map(p => ({ id: p.id, name: p.name, defaultDuration: (p.inhale + p.holdIn + p.exhale + p.holdOut) * 10 }));
      strengthCircuits = st;
      strengthExercises = strengthExerciseCatalog;
      presetsCatalog.strength = st
        .filter(circuit => getCircuitValidation(circuit, strengthExercises).isValid)
        .map(circuit => ({
          id: circuit.id,
          name: circuit.name,
          defaultDuration: estimateStrengthCircuitDuration(circuit, strengthExercises)
        }));
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

  function getStrengthBlockIssue(block) {
    if (block.module !== 'strength') return '';
    const circuit = strengthCircuits.find(item => item.id === block.presetId);
    if (!circuit) return 'Circuito de fuerza no disponible';
    return getCircuitValidation(circuit, strengthExercises).reason;
  }

  function getSessionIssue(session) {
    if (!Array.isArray(session.blocks) || session.blocks.length === 0) return 'Borrador sin bloques';
    const invalidStrengthBlock = session.blocks.find(block => getStrengthBlockIssue(block));
    return invalidStrengthBlock ? getStrengthBlockIssue(invalidStrengthBlock) : '';
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
    const staging = document.createElement('div');
    staging.innerHTML = renderLobbyShell({
      title: 'Sesiones Compuestas',
      description: 'Rutinas integrales personalizables que encadenan respiración, fuerza, yoga y acupuntura en un solo flujo ininterrumpido.',
      action: renderLobbyAction({ kind: 'text', label: '+ Crear Sesión', id: 'btn-create-session' }),
      variant: 'list',
      className: 'compound-sessions-lobby',
      content: '<div class="compound-sessions-list" id="sessions-list"></div>'
    });
    const layout = staging.firstElementChild;

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
      listContainer.innerHTML = '<p class="compound-sessions-empty">No hay sesiones disponibles. Haz clic en "+ Crear Sesión" para construir tu primera rutina.</p>';
      return;
    }

    sessionsCatalog.forEach(session => {
      const el = document.createElement('div');
      const invalidReason = getSessionIssue(session);
      el.className = `compound-session-card${invalidReason ? ' compound-session-card--invalid' : ''}`;
      
      el.innerHTML = renderCompoundSessionCard(session, { invalidReason });

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
      
      const playButton = el.querySelector('.btn-play-session');
      if (!invalidReason) {
        playButton.addEventListener('click', () => startSession(session));
      }

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
        <div class="glass-panel compound-sessions-panel compound-sessions-builder">
          ${renderTechnicalTitle(sessionsCatalog.some(s => s.id === editingSession.id) ? 'Editar Sesión Compuesta' : 'Crear Sesión Compuesta', { style: 'margin-bottom: 16px;' })}

          <form id="form-builder" class="compound-builder-form">
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 0.65rem; color: var(--color-text-muted); text-transform: uppercase; font-family: var(--font-digital);">Nombre de la Sesión</label>
              <input type="text" id="builder-name" class="acu-input-flat" value="${escapeHTML(editingSession.name)}" style="padding: 8px; font-size: 0.9rem;" required>
            </div>

            <div style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-size: 0.65rem; color: var(--color-text-muted); text-transform: uppercase; font-family: var(--font-digital);">Descripción / Intención Clínica</label>
              <textarea id="builder-desc" class="acu-input-flat" style="padding: 8px; font-size: 0.85rem; min-height: 60px; resize: vertical;" required>${escapeHTML(editingSession.description || '')}</textarea>
            </div>

            <div class="compound-builder-blocks">
              <div class="compound-builder-blocks__header">
                <label style="font-size: 0.75rem; font-weight: 600; text-transform: uppercase; font-family: var(--font-digital);">Bloques Secuenciales (${editingSession.blocks.length})</label>
                ${renderCompoundAction('+ Agregar Bloque', { id: 'btn-add-block' })}
              </div>

              <div id="blocks-container" class="compound-blocks-container"></div>
            </div>

            <div class="compound-builder-actions">
              ${renderCompoundAction('Guardar Sesión Compuesta', { type: 'submit', className: 'compound-primary-action' })}
              ${renderCompoundAction('Cancelar', { id: 'btn-discard', className: 'compound-secondary-action' })}
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

      const sessionIssue = getSessionIssue(editingSession);
      if (sessionIssue) {
        alert(`No puedes guardar una sesión inválida: ${sessionIssue}. Repara o elimina el bloque afectado.`);
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
        const invalidReason = getStrengthBlockIssue(block);
        blockEl.className = `compound-block${invalidReason ? ' compound-block--invalid' : ''}`;

        blockEl.innerHTML = renderCompoundSessionBlock(
          block,
          index,
          editingSession.blocks.length,
          presetsCatalog,
          { invalidReason }
        );

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
          } else {
            block.presetId = '';
            block.nameOverride = 'Sin preset disponible';
            block.duration = 10;
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
    const invalidReason = getSessionIssue(session);
    if (invalidReason) {
      alert(`Esta sesión no puede iniciarse: ${invalidReason}. Edítala para reparar el flujo.`);
      return;
    }
    currentSession = session;
    currentBlockIndex = 0;
    currentBlockResults = [];
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
        onComplete: result => {
          if (result) currentBlockResults[currentBlockIndex] = result;
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
        ${renderTechnicalTitle('Preparando Siguiente Bloque', { style: 'font-size: 1.5rem; margin-bottom: 24px; color: var(--color-text-muted);' })}
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
      
      const blocksLog = currentSession.blocks.map((b, index) => ({
        module: b.module,
        name: b.nameOverride,
        duration: b.duration,
        ...(b.module === 'strength' && currentBlockResults[index]
          ? { strengthResult: currentBlockResults[index] }
          : {})
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
