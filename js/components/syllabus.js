import { getAllData, putData, deleteData, addData } from '../db.js';
import { escapeAttribute, escapeHTML } from '../utils/sanitize.js';
import { renderTechnicalTitle } from './ui.js';
import { renderStrengthManager } from './strengthManager.js';
import {
  calculateSequenceDuration,
  validateMeditationSequence,
  sanitizeMeditationSequence
} from '../utils/meditationUtils.js';

export async function renderSyllabusScreen(container, db, onNavigate) {
  // Estado local de la base de datos
  let catalogPoints = [];
  let meridiansList = [];
  let breathworkPatterns = [];
  let yogaPostures = [];
  let yogaBlocks = [];
  let compoundSessions = [];
  let meditationPresets = [];

  // Estado local de navegación de pestañas
  let activeTab = 'acupuncture'; // 'acupuncture', 'breathwork', 'yoga', 'strength', 'meditation', 'sessions', 'synth'
  let activeAcuSubTab = 'meridians'; // 'meridians', 'points', 'heads'
  let activeYogaSubTab = 'blocks'; // 'blocks', 'postures'
  let activeSynthSubTab = 'brainwaves'; // 'brainwaves', 'solfeggio', 'modes'

  // Estados de edición e inserción
  let editingItem = null; // Guardará el objeto del item que se está editando
  let editingStore = ''; // Almacén activo en edición ('acupuncture_points', 'meridians', 'breathwork_patterns', 'yoga_postures', 'yoga_blocks', 'meditation_presets')
  let isPointFormOpen = false; // Estado del acordeón del formulario para Puntos Extra
  let isBreathFormOpen = false; // Estado del acordeón del formulario para Respiración
  let isAsanaFormOpen = false; // Estado del acordeón del formulario para Asanas
  let isYogaBlockFormOpen = false; // Estado del acordeón del formulario para Bloques de Yoga
  let isMeditationFormOpen = false; // Estado del acordeón para Meditación

  // Estado del buscador
  let pointSearchQuery = '';
  let activeMeridianFilter = 'ALL';

  const layout = document.createElement('div');
  layout.className = 'dashboard-layout fade-in';

  // Cargar todos los datos desde IndexedDB
  async function loadData() {
    try {
      catalogPoints = await getAllData(db, 'acupuncture_points');
      meridiansList = await getAllData(db, 'meridians');
      breathworkPatterns = await getAllData(db, 'breathwork_patterns');
      yogaPostures = await getAllData(db, 'yoga_postures');
      yogaBlocks = await getAllData(db, 'yoga_blocks');
      compoundSessions = await getAllData(db, 'compound_sessions');
      const allMed = await getAllData(db, 'meditation_presets');
      meditationPresets = (allMed || []).filter(item => Array.isArray(item.blocks) && item.blocks.length > 0);
      meditationPresets.sort((a, b) => a.name.localeCompare(b.name, 'es', { sensitivity: 'base' }));

      // Ordenar meridianos tradicionalmente
      const meridianOrderMap = {
        'LU': 1, 'LI': 2, 'ST': 3, 'SP': 4, 'HT': 5, 'SI': 6,
        'BL': 7, 'KI': 8, 'PC': 9, 'TE': 10, 'GB': 11, 'LR': 12,
        'CV': 13, 'GV': 14, 'EX': 15, 'AU': 16, 'MS': 17
      };
      meridiansList.sort((a, b) => (meridianOrderMap[a.id] || 99) - (meridianOrderMap[b.id] || 99));

      // Ordenar puntos alfabéticamente
      catalogPoints.sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true, sensitivity: 'base' }));
    } catch (err) {
      console.error('[Syllabus] Error cargando base de datos:', err);
    }
  }

  // Renderizador principal del componente
  async function refresh() {
    await loadData();

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

      <main class="main-viewport">
        <div class="viewport-inner">
          <div class="acu-lobby-container">
            <header class="acu-lobby-header" style="flex-direction: column; align-items: flex-start; gap: 8px; margin-bottom: 24px;">
              ${renderTechnicalTitle('Gestor de Bases de Datos')}
              <p style="font-size: 0.75rem; color: var(--color-text-muted); margin: 0;">Administra y edita la información en texto de cada módulo clínico local-first.</p>
            </header>

            <!-- Selector de Base de Datos Principal (Estilo Minimalista Plano) -->
            <div style="display: flex; flex-wrap: wrap; background: transparent; border-bottom: 1px solid rgba(46, 43, 40, 0.12); border-radius: 0; padding: 0; margin-bottom: 24px; gap: 4px; width: fit-content; max-width: 100%;">
              <button id="tab-acupuncture" class="btn-braun-tab ${activeTab === 'acupuncture' ? 'active' : ''}">Acupuntura</button>
              <button id="tab-breathwork" class="btn-braun-tab ${activeTab === 'breathwork' ? 'active' : ''}">Respiración</button>
              <button id="tab-yoga" class="btn-braun-tab ${activeTab === 'yoga' ? 'active' : ''}">Yin Yoga</button>
              <button id="tab-strength" class="btn-braun-tab ${activeTab === 'strength' ? 'active' : ''}">Fuerza</button>
              <button id="tab-meditation" class="btn-braun-tab ${activeTab === 'meditation' ? 'active' : ''}">Meditación</button>
              <button id="tab-sessions" class="btn-braun-tab ${activeTab === 'sessions' ? 'active' : ''}">Sesiones</button>
              <button id="tab-synth" class="btn-braun-tab ${activeTab === 'synth' ? 'active' : ''}">Sintetizador</button>
            </div>

            <!-- Contenedor del Editor y Lista Activa -->
            <div id="database-active-content" class="fade-in"></div>
          </div>
        </div>
      </main>
    `;

    // Asignar eventos globales
    layout.querySelector('#btn-back-home').addEventListener('click', () => {
      onNavigate('inicio');
    });

    layout.querySelector('#tab-acupuncture').addEventListener('click', () => { activeTab = 'acupuncture'; editingItem = null; refresh(); });
    layout.querySelector('#tab-breathwork').addEventListener('click', () => { activeTab = 'breathwork'; editingItem = null; refresh(); });
    layout.querySelector('#tab-yoga').addEventListener('click', () => { activeTab = 'yoga'; editingItem = null; refresh(); });
    layout.querySelector('#tab-strength').addEventListener('click', () => { activeTab = 'strength'; editingItem = null; refresh(); });
    layout.querySelector('#tab-meditation').addEventListener('click', () => { activeTab = 'meditation'; editingItem = null; refresh(); });
    layout.querySelector('#tab-sessions').addEventListener('click', () => { activeTab = 'sessions'; editingItem = null; refresh(); });
    layout.querySelector('#tab-synth').addEventListener('click', () => { activeTab = 'synth'; editingItem = null; refresh(); });

    renderActiveTabContent();
  }

  // Renderizar contenido dinámico según pestaña activa
  function renderActiveTabContent() {
    const targetEl = layout.querySelector('#database-active-content');
    targetEl.innerHTML = '';

    if (activeTab === 'acupuncture') {
      renderAcupunctureManager(targetEl);
    } else if (activeTab === 'breathwork') {
      renderBreathworkManager(targetEl);
    } else if (activeTab === 'yoga') {
      renderYogaManager(targetEl);
    } else if (activeTab === 'strength') {
      renderStrengthManager(targetEl, db).catch(error => {
        console.error('[Syllabus] Error al renderizar Fuerza:', error);
        targetEl.innerHTML = '<p class="strength-manager__warning">No se pudo cargar el catálogo de Fuerza.</p>';
      });
    } else if (activeTab === 'meditation') {
      renderMeditationManager(targetEl);
    } else if (activeTab === 'sessions') {
      renderCompoundSessionsManager(targetEl);
    } else if (activeTab === 'synth') {
      renderSynthReference(targetEl);
    }
  }

  /* =========================================================================
     MÓDULO 1: ACUPUNTURA (PUNTOS Y MERIDIANOS)
     ========================================================================= */
  function renderAcupunctureManager(container) {
    container.innerHTML = `
      <div style="display: flex; gap: 8px; border-bottom: 1px solid rgba(46,43,40,0.12); padding-bottom: 0; margin-bottom: 20px;">
        <button id="btn-sub-mer" class="btn-braun-tab ${activeAcuSubTab === 'meridians' ? 'active' : ''}" style="padding:6px 12px 8px 12px; font-size:0.75rem;">Meridianos (Canales)</button>
        <button id="btn-sub-pts" class="btn-braun-tab ${activeAcuSubTab === 'points' ? 'active' : ''}" style="padding:6px 12px 8px 12px; font-size:0.75rem;">Puntos</button>
        <button id="btn-sub-heads" class="btn-braun-tab ${activeAcuSubTab === 'heads' ? 'active' : ''}" style="padding:6px 12px 8px 12px; font-size:0.75rem;">Cabezales</button>
      </div>
      <div id="acupuncture-sub-content"></div>
    `;

    layout.querySelector('#btn-sub-mer').addEventListener('click', () => { activeAcuSubTab = 'meridians'; editingItem = null; refresh(); });
    layout.querySelector('#btn-sub-pts').addEventListener('click', () => { activeAcuSubTab = 'points'; editingItem = null; refresh(); });
    layout.querySelector('#btn-sub-heads').addEventListener('click', () => { activeAcuSubTab = 'heads'; editingItem = null; refresh(); });

    const subContentEl = container.querySelector('#acupuncture-sub-content');

    if (activeAcuSubTab === 'points') {
      if (editingItem && editingStore === 'acupuncture_points') {
        isPointFormOpen = true;
      }

      // --- SUB-PESTAÑA PUNTOS ---
      subContentEl.innerHTML = `
        <!-- Acordeón Formulario para Agregar/Editar Punto Extra -->
        <div style="margin-bottom: 24px;">
          <button id="btn-toggle-point-form" type="button" style="background:transparent; border:none; border-bottom:1px solid rgba(46,43,40,0.12); width:100%; text-align:left; padding:10px 0; font-family:var(--font-digital); font-size:0.78rem; font-weight:600; cursor:pointer; color:var(--color-text-main); display:flex; justify-content:space-between; align-items:center;">
            <span>${editingItem && editingStore === 'acupuncture_points' ? '✏ EDITAR PUNTO EXTRA' : '+ AGREGAR NUEVO PUNTO EXTRA'}</span>
            <span id="point-form-icon" style="font-size:0.65rem; transition:transform 0.2s;">${isPointFormOpen ? '▼' : '▶'}</span>
          </button>

          <div id="point-form-accordion-body" style="display:${isPointFormOpen ? 'block' : 'none'}; padding-top: 16px; border-bottom: 1px solid rgba(46,43,40,0.08); padding-bottom: 16px;">
            <form id="form-acu-point" style="display:flex; flex-direction:column; gap:12px;">
              <div style="display:flex; flex-wrap:wrap; gap:16px;">
                <div style="flex:1; min-width:180px; display:flex; flex-direction:column; gap:4px;">
                  <label style="font-size:0.6rem; color:var(--color-text-muted); text-transform:uppercase;">Nombre del Punto Extra</label>
                  <input type="text" id="acu-p-name" class="acu-input-flat" style="padding: 6px;" placeholder="Ej. Yintang (Palacio del Sello)" required>
                </div>
                <div style="width:120px; display:flex; flex-direction:column; gap:4px;">
                  <label style="font-size:0.6rem; color:var(--color-text-muted); text-transform:uppercase;">Código MTC / OMS</label>
                  <input type="text" id="acu-p-code" class="acu-input-flat" style="padding: 6px;" placeholder="Ej. Ex-HN 3" required>
                </div>
                <div style="width:140px; display:flex; flex-direction:column; gap:4px;">
                  <label style="font-size:0.6rem; color:var(--color-text-muted); text-transform:uppercase;">Código Tradicional / Pinyin</label>
                  <input type="text" id="acu-p-trad-code" class="acu-input-flat" style="padding: 6px;" placeholder="Ej. Yintang" required>
                </div>
                <div style="width:140px; display:flex; flex-direction:column; gap:4px;">
                  <label style="font-size:0.6rem; color:var(--color-text-muted); text-transform:uppercase;">Canal / Meridiano</label>
                  <select id="acu-p-meridian" class="acu-select-flat" style="padding: 6px;" disabled>
                    <option value="EX" selected>Puntos Extra (EX)</option>
                  </select>
                </div>
                <div style="width:140px; display:flex; flex-direction:column; gap:4px;">
                  <label style="font-size:0.6rem; color:var(--color-text-muted); text-transform:uppercase;">Cabezal de Electro Pen</label>
                  <select id="acu-p-head" class="acu-select-flat" style="padding: 6px;">
                    <option value="Esferoidal">Esferoidal (Ball)</option>
                    <option value="Domo">Domo (Plano)</option>
                    <option value="Nodo">Nodo (Sin Cabezal)</option>
                  </select>
                </div>
                <div style="width:100px; display:flex; flex-direction:column; gap:4px;">
                  <label style="font-size:0.6rem; color:var(--color-text-muted); text-transform:uppercase;">Duración (s)</label>
                  <input type="number" id="acu-p-dur" class="acu-input-flat" style="padding: 6px;" min="10" value="120" required>
                </div>
              </div>
              
              <div style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:0.6rem; color:var(--color-text-muted); text-transform:uppercase;">Ubicación Anatómica Descriptiva (Texto)</label>
                <textarea id="acu-p-loc" class="acu-input-flat" style="padding: 8px; font-size:0.8rem; min-height:50px; resize:vertical;" placeholder="Describe detalladamente cómo localizar el punto extra..." required></textarea>
              </div>
              
              <div style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:0.6rem; color:var(--color-text-muted); text-transform:uppercase;">Beneficios Clínicos / Indicaciones</label>
                <input type="text" id="acu-p-benefits" class="acu-input-flat" style="padding: 6px; font-size:0.8rem;" placeholder="Ej. Alivia la ansiedad, cefaleas frontales, insomnio y congestión nasal." required>
              </div>

              <div style="display:flex; gap:12px; justify-content:flex-end; margin-top:8px;">
                ${editingItem && editingStore === 'acupuncture_points' ? `
                  <button type="button" id="btn-cancel-edit" style="background:none; border:none; color:var(--color-text-muted); font-size:0.75rem; cursor:pointer;">[ CANCELAR ]</button>
                  <button type="submit" style="background:none; border:none; color:var(--color-accent-green); font-size:0.75rem; cursor:pointer; font-weight:600;">[ GUARDAR CAMBIOS ]</button>
                ` : `
                  <button type="submit" style="background:none; border:none; color:var(--color-text-main); font-size:0.75rem; cursor:pointer; font-weight:600;">[ AGREGAR PUNTO EXTRA ]</button>
                `}
              </div>
            </form>
          </div>
        </div>

        <!-- Buscador y Filtro por Canal -->
        <div style="display:flex; flex-wrap:wrap; gap:16px; align-items:center; margin-bottom:16px;">
          <input type="text" id="acu-search-input" class="acu-input-flat" style="flex:1; min-width:200px; padding:6px 12px; font-size:0.8rem;" placeholder="Buscar punto por código (estándar o tradicional) o nombre..." value="${escapeAttribute(pointSearchQuery)}">
          
          <select id="acu-meridian-filter" class="acu-select-flat" style="padding:6px; font-size:0.8rem;">
            <option value="ALL" ${activeMeridianFilter === 'ALL' ? 'selected' : ''}>Todos los Canales</option>
            ${meridiansList.map(m => `<option value="${escapeAttribute(m.id)}" ${activeMeridianFilter === m.id ? 'selected' : ''}>${escapeHTML(m.name)} (${escapeHTML(m.id)})</option>`).join('')}
          </select>
        </div>

        <!-- Listado de Puntos -->
        <div class="acu-points-tab-list" id="points-editor-list"></div>
      `;

      // Evento acordeón formulario punto extra
      const toggleBtn = layout.querySelector('#btn-toggle-point-form');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', () => {
          isPointFormOpen = !isPointFormOpen;
          const body = layout.querySelector('#point-form-accordion-body');
          const icon = layout.querySelector('#point-form-icon');
          if (body) body.style.display = isPointFormOpen ? 'block' : 'none';
          if (icon) icon.textContent = isPointFormOpen ? '▼' : '▶';
        });
      }

      // Cargar valores si estamos editando
      if (editingItem && editingStore === 'acupuncture_points') {
        layout.querySelector('#acu-p-name').value = editingItem.name || '';
        layout.querySelector('#acu-p-code').value = editingItem.code || '';
        layout.querySelector('#acu-p-trad-code').value = editingItem.traditional_code || '';
        layout.querySelector('#acu-p-head').value = editingItem.headType || 'Esferoidal';
        layout.querySelector('#acu-p-dur').value = editingItem.duration || 120;
        layout.querySelector('#acu-p-loc').value = editingItem.location || '';
        layout.querySelector('#acu-p-benefits').value = editingItem.benefits || '';

        layout.querySelector('#btn-cancel-edit').addEventListener('click', () => {
          editingItem = null;
          isPointFormOpen = false;
          refresh();
        });
      }

      // Conectar buscador y filtro
      const searchIn = layout.querySelector('#acu-search-input');
      const filterSel = layout.querySelector('#acu-meridian-filter');

      searchIn.addEventListener('input', () => {
        pointSearchQuery = searchIn.value;
        renderFilteredPointsList();
      });

      filterSel.addEventListener('change', () => {
        activeMeridianFilter = filterSel.value;
        renderFilteredPointsList();
      });

      // Guardar / Editar Punto
      layout.querySelector('#form-acu-point').addEventListener('submit', async (e) => {
        e.preventDefault();

        const pointData = {
          id: editingItem && editingStore === 'acupuncture_points' ? editingItem.id : 'point-' + Date.now(),
          name: layout.querySelector('#acu-p-name').value.trim(),
          code: layout.querySelector('#acu-p-code').value.trim(),
          traditional_code: layout.querySelector('#acu-p-trad-code').value.trim(),
          meridian_id: 'EX',
          meridian: 'Puntos Extra',
          headType: layout.querySelector('#acu-p-head').value,
          duration: parseInt(layout.querySelector('#acu-p-dur').value) || 120,
          location: layout.querySelector('#acu-p-loc').value.trim(),
          benefits: layout.querySelector('#acu-p-benefits').value.trim(),
          custom: true
        };

        try {
          await putData(db, 'acupuncture_points', pointData);
          editingItem = null;
          isPointFormOpen = false;
          alert('Punto extra guardado en la base de datos.');
          refresh();
        } catch (err) {
          console.error(err);
          alert('Error al guardar el punto.');
        }
      });

      renderFilteredPointsList();
    } else if (activeAcuSubTab === 'heads') {
      renderHeadsReference(subContentEl);
    } else {
      // --- SUB-PESTAÑA MERIDIANOS (LECTURA ÚNICAMENTE) ---
      subContentEl.innerHTML = `
        <!-- Info Informativa -->
        <div style="font-size: 0.75rem; color: var(--color-text-muted); margin-bottom: 16px; font-family: var(--font-digital); text-transform: uppercase; letter-spacing: 0.05em;">
          Catálogo de Canales Energéticos
        </div>

        <!-- Listado de Meridianos -->
        <div class="acu-points-tab-list" id="meridians-editor-list"></div>
      `;

      renderMeridiansList();
    }
  }

  function renderFilteredPointsList() {
    const listEl = layout.querySelector('#points-editor-list');
    if (!listEl) return;

    listEl.innerHTML = '';

    // Filtrar los puntos
    const query = pointSearchQuery.toLowerCase().trim();
    let filtered = catalogPoints;

    if (activeMeridianFilter !== 'ALL') {
      filtered = filtered.filter(p => p.meridian_id === activeMeridianFilter);
    }
    if (query.length > 0) {
      filtered = filtered.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.code.toLowerCase().includes(query) ||
        (p.traditional_code && p.traditional_code.toLowerCase().includes(query))
      );
    }

    if (filtered.length === 0) {
      listEl.innerHTML = `<p style="font-size:0.8rem; color:var(--color-text-muted); text-align:center; padding:20px;">No se encontraron puntos de acupuntura en este filtro.</p>`;
      return;
    }

    filtered.forEach(p => {
      const card = document.createElement('div');
      card.className = 'acu-point-card';
      card.innerHTML = `
        <div class="acu-point-card-header" style="cursor: pointer; display:flex; justify-content:space-between; align-items:center;">
          <div style="display:flex; align-items:center; gap:8px;">
            <span class="acu-point-card-arrow" style="transition: transform 0.2s;">▶</span>
            <span style="font-weight:600; font-size:0.88rem; color:var(--color-text-main);">${escapeHTML(p.name)}</span>
          </div>
          <div style="display:flex; align-items:center; gap:12px;">
            <span style="font-family:var(--font-mono); color:var(--color-accent-red); font-size:0.75rem; font-weight:600;">
              ${escapeHTML(p.code)}${p.traditional_code && p.traditional_code !== p.code ? ` / ${escapeHTML(p.traditional_code)}` : ''}
            </span>
            <span style="font-size:0.62rem; color:var(--color-text-muted); font-family:var(--font-mono); text-transform:uppercase;">${escapeHTML(p.headType)}</span>
          </div>
        </div>
        <div class="acu-point-card-content" style="display:none; padding:16px 0 0 0; margin-top:12px; border-top:1px dashed rgba(46,43,40,0.06); flex-direction:column; gap:10px;">
          <div>
            <div style="font-size:0.58rem; color:var(--color-text-muted); text-transform:uppercase; font-weight:600;">Ubicación Anatomómica</div>
            <div style="font-size:0.78rem; color:var(--color-text-main); line-height:1.4;">${escapeHTML(p.location)}</div>
          </div>
          <div>
            <div style="font-size:0.58rem; color:var(--color-text-muted); text-transform:uppercase; font-weight:600;">Beneficios Principales</div>
            <div style="font-size:0.78rem; color:var(--color-text-main); line-height:1.4;">${escapeHTML(p.benefits)}</div>
          </div>
          <div style="display:flex; justify-content:space-between; align-items:center; margin-top:8px; border-top:1px dotted rgba(46,43,40,0.05); padding-top:8px;">
            <span style="font-size:0.65rem; color:var(--color-text-muted);">Canal: ${escapeHTML(p.meridian)} (${escapeHTML(p.meridian_id)}) ${p.traditional_code && p.traditional_code !== p.code ? `| Tradicional: ${escapeHTML(p.traditional_code)}` : ''} | Duración: ${escapeHTML(p.duration)}s</span>
            <div style="display:flex; gap:12px;">
              ${p.meridian_id === 'EX' ? `
                <button class="btn-action-icon btn-edit-pt" title="Editar" aria-label="Editar">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
                <button class="btn-action-icon delete-icon btn-delete-pt" title="Eliminar" aria-label="Eliminar">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                    <polyline points="3 6 5 6 21 6"></polyline>
                    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                  </svg>
                </button>
              ` : ''}
            </div>
          </div>
        </div>
      `;

      const header = card.querySelector('.acu-point-card-header');
      const content = card.querySelector('.acu-point-card-content');
      const arrow = card.querySelector('.acu-point-card-arrow');

      header.addEventListener('click', () => {
        const isExpanded = card.classList.toggle('expanded');
        content.style.display = isExpanded ? 'flex' : 'none';
        arrow.style.transform = isExpanded ? 'rotate(90deg)' : 'none';
      });

      const btnEdit = card.querySelector('.btn-edit-pt');
      if (btnEdit) {
        btnEdit.addEventListener('click', (e) => {
          e.stopPropagation();
          editingItem = p;
          editingStore = 'acupuncture_points';
          isPointFormOpen = true;
          refresh();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      }

      const btnDelete = card.querySelector('.btn-delete-pt');
      if (btnDelete) {
        btnDelete.addEventListener('click', async (e) => {
          e.stopPropagation();
          if (confirm(`¿Seguro que deseas eliminar el punto "${p.name}" (${p.code}) de la base de datos?`)) {
            await deleteData(db, 'acupuncture_points', p.id);
            refresh();
          }
        });
      }

      listEl.appendChild(card);
    });
  }

  function renderMeridiansList() {
    const listEl = layout.querySelector('#meridians-editor-list');
    if (!listEl) return;

    listEl.innerHTML = '';

    meridiansList.forEach(m => {
      const card = document.createElement('div');
      card.className = 'acu-point-card';
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; gap: 16px;">
          <div style="flex: 1;">
            <span style="font-weight:600; font-size:0.88rem; color:var(--color-text-main);">${escapeHTML(m.name)} ${m.chinese_pinyin ? `(${escapeHTML(m.chinese_pinyin)})` : ''}</span>
            <span style="font-family:var(--font-mono); font-size:0.75rem; color:var(--color-text-muted); margin-left: 8px;">[Trad: ${escapeHTML(m.pinyin_code || '')}]</span>
            <div style="font-size:0.65rem; color:var(--color-text-muted); margin-top:2px;">Elemento: ${escapeHTML(m.element)} | Energía: ${escapeHTML(m.yin_yang)} | Puntos esperados: ${escapeHTML(m.total_points)}</div>
            <p style="font-size:0.75rem; color:var(--color-text-main); margin: 6px 0 0 0; line-height: 1.4;">${escapeHTML(m.description || 'Sin descripción.')}</p>
          </div>
          <div style="display:flex; align-items:center; gap:16px; flex-shrink: 0;">
            <span style="font-family:var(--font-digital); color:var(--color-accent-red); font-size:0.9rem; font-weight:600;">${escapeHTML(m.id)}</span>
          </div>
        </div>
      `;

      listEl.appendChild(card);
    });
  }


  /* =========================================================================
     MÓDULO 2: RESPIRACIÓN (BREATHWORK)
     ========================================================================= */
  function renderBreathworkManager(container) {
    if (editingItem && editingStore === 'breathwork_patterns') {
      isBreathFormOpen = true;
    }

    container.innerHTML = `
      <!-- Acordeón Formulario para Registrar/Editar Técnica de Respiración -->
      <div style="margin-bottom: 24px;">
        <button id="btn-toggle-breath-form" type="button" style="background:transparent; border:none; border-bottom:1px solid rgba(46,43,40,0.12); width:100%; text-align:left; padding:10px 0; font-family:var(--font-digital); font-size:0.78rem; font-weight:600; cursor:pointer; color:var(--color-text-main); display:flex; justify-content:space-between; align-items:center;">
          <span>${editingItem && editingStore === 'breathwork_patterns' ? '✏ EDITAR TÉCNICA DE RESPIRACIÓN' : '+ REGISTRAR NUEVA TÉCNICA DE RESPIRACIÓN'}</span>
          <span id="breath-form-icon" style="font-size:0.65rem; transition:transform 0.2s;">${isBreathFormOpen ? '▼' : '▶'}</span>
        </button>

        <div id="breath-form-accordion-body" style="display:${isBreathFormOpen ? 'block' : 'none'}; padding-top: 16px; border-bottom: 1px solid rgba(46,43,40,0.08); padding-bottom: 16px;">
          <form id="form-breath" style="display:flex; flex-direction:column; gap:12px;">
            <div style="display:flex; flex-wrap:wrap; gap:16px;">
              <div style="flex:1.5; min-width:180px; display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:0.6rem; color:var(--color-text-muted); text-transform:uppercase;">Nombre de la Técnica</label>
                <input type="text" id="breath-name" class="acu-input-flat" style="padding: 6px;" placeholder="Ej. Respiración de Fuego (Kapalabhati)" required>
              </div>
              <div style="width:120px; display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:0.6rem; color:var(--color-text-muted); text-transform:uppercase;">ID Único</label>
                <input type="text" id="breath-id" class="acu-input-flat" style="padding: 6px;" placeholder="Ej. breath-fire" ${editingItem && editingStore === 'breathwork_patterns' ? 'disabled' : ''} required>
              </div>
            </div>

            <div style="display:flex; flex-wrap:wrap; gap:16px;">
              <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:0.6rem; color:var(--color-text-muted); text-transform:uppercase;">Inhalación (s)</label>
                <input type="number" id="breath-inhale" class="acu-input-flat" style="padding: 6px;" min="0" value="4" required>
              </div>
              <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:0.6rem; color:var(--color-text-muted); text-transform:uppercase;">Retención Lleno (s)</label>
                <input type="number" id="breath-holdin" class="acu-input-flat" style="padding: 6px;" min="0" value="4" required>
              </div>
              <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:0.6rem; color:var(--color-text-muted); text-transform:uppercase;">Exhalación (s)</label>
                <input type="number" id="breath-exhale" class="acu-input-flat" style="padding: 6px;" min="0" value="4" required>
              </div>
              <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:0.6rem; color:var(--color-text-muted); text-transform:uppercase;">Retención Vacío (s)</label>
                <input type="number" id="breath-holdout" class="acu-input-flat" style="padding: 6px;" min="0" value="4" required>
              </div>
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:0.6rem; color:var(--color-text-muted); text-transform:uppercase;">Descripción / Beneficios</label>
              <textarea id="breath-desc" class="acu-input-flat" style="padding: 8px; font-size:0.8rem; min-height:45px; resize:vertical;" placeholder="Describe cómo practicarlo y qué sistema biológico activa..." required></textarea>
            </div>

            <div style="display:flex; gap:12px; justify-content:flex-end; margin-top:8px;">
              ${editingItem && editingStore === 'breathwork_patterns' ? `
                <button type="button" id="btn-cancel-edit" style="background:none; border:none; color:var(--color-text-muted); font-size:0.75rem; cursor:pointer;">[ CANCELAR ]</button>
                <button type="submit" style="background:none; border:none; color:var(--color-accent-green); font-size:0.75rem; cursor:pointer; font-weight:600;">[ GUARDAR CAMBIOS ]</button>
              ` : `
                <button type="submit" style="background:none; border:none; color:var(--color-text-main); font-size:0.75rem; cursor:pointer; font-weight:600;">[ CREAR TÉCNICA ]</button>
              `}
            </div>
          </form>
        </div>
      </div>

      <!-- Listado de Técnicas -->
      <div class="acu-points-tab-list" id="breathwork-editor-list"></div>
    `;

    // Evento acordeón formulario respiración
    const toggleBreathBtn = layout.querySelector('#btn-toggle-breath-form');
    if (toggleBreathBtn) {
      toggleBreathBtn.addEventListener('click', () => {
        isBreathFormOpen = !isBreathFormOpen;
        const body = layout.querySelector('#breath-form-accordion-body');
        const icon = layout.querySelector('#breath-form-icon');
        if (body) body.style.display = isBreathFormOpen ? 'block' : 'none';
        if (icon) icon.textContent = isBreathFormOpen ? '▼' : '▶';
      });
    }

    if (editingItem && editingStore === 'breathwork_patterns') {
      layout.querySelector('#breath-id').value = editingItem.id || '';
      layout.querySelector('#breath-name').value = editingItem.name || '';
      layout.querySelector('#breath-inhale').value = editingItem.inhale || 0;
      layout.querySelector('#breath-holdin').value = editingItem.holdIn || 0;
      layout.querySelector('#breath-exhale').value = editingItem.exhale || 0;
      layout.querySelector('#breath-holdout').value = editingItem.holdOut || 0;
      layout.querySelector('#breath-desc').value = editingItem.description || '';

      layout.querySelector('#btn-cancel-edit').addEventListener('click', () => {
        editingItem = null;
        isBreathFormOpen = false;
        refresh();
      });
    }

    layout.querySelector('#form-breath').addEventListener('submit', async (e) => {
      e.preventDefault();
      const breathData = {
        id: editingItem && editingStore === 'breathwork_patterns' ? editingItem.id : layout.querySelector('#breath-id').value.trim().toLowerCase(),
        name: layout.querySelector('#breath-name').value.trim(),
        inhale: parseInt(layout.querySelector('#breath-inhale').value) || 0,
        holdIn: parseInt(layout.querySelector('#breath-holdin').value) || 0,
        exhale: parseInt(layout.querySelector('#breath-exhale').value) || 0,
        holdOut: parseInt(layout.querySelector('#breath-holdout').value) || 0,
        description: layout.querySelector('#breath-desc').value.trim()
      };

      try {
        await putData(db, 'breathwork_patterns', breathData);
        editingItem = null;
        isBreathFormOpen = false;
        alert('Técnica de respiración guardada con éxito.');
        refresh();
      } catch (err) {
        console.error(err);
        alert('Error al guardar la técnica.');
      }
    });

    renderBreathworkList(container.querySelector('#breathwork-editor-list'));
  }

  function renderBreathworkList(listEl) {
    listEl.innerHTML = '';

    breathworkPatterns.forEach(b => {
      const card = document.createElement('div');
      card.className = 'acu-point-card';
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div style="flex:1;">
            <span style="font-weight:600; font-size:0.88rem; color:var(--color-text-main);">${escapeHTML(b.name)}</span>
            <p style="font-size:0.75rem; color:var(--color-text-muted); margin:4px 0 8px 0; line-height:1.4;">${escapeHTML(b.description)}</p>
            <div style="display:flex; gap:16px; font-family:var(--font-mono); font-size:0.7rem; color:var(--color-accent-red);">
              <span>INHALA: ${escapeHTML(b.inhale)}s</span>
              <span>RET-LLENO: ${escapeHTML(b.holdIn)}s</span>
              <span>EXHALA: ${escapeHTML(b.exhale)}s</span>
              <span>RET-VACÍO: ${escapeHTML(b.holdOut)}s</span>
            </div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
            <span style="font-family:var(--font-mono); font-size:0.65rem; color:var(--color-text-muted); text-transform:uppercase;">${escapeHTML(b.id)}</span>
            <div style="display:flex; gap:4px;">
              <button class="btn-action-icon btn-edit-br" title="Editar" aria-label="Editar">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button class="btn-action-icon delete-icon btn-delete-br" title="Borrar" aria-label="Borrar">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `;

      card.querySelector('.btn-edit-br').addEventListener('click', () => {
        editingItem = b;
        editingStore = 'breathwork_patterns';
        isBreathFormOpen = true;
        refresh();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });

      card.querySelector('.btn-delete-br').addEventListener('click', async () => {
        if (confirm(`¿Seguro que deseas eliminar la técnica "${b.name}" de la base de datos?`)) {
          await deleteData(db, 'breathwork_patterns', b.id);
          refresh();
        }
      });

      listEl.appendChild(card);
    });
  }


  /* =========================================================================
     MÓDULO 3: YOGA (ASANAS Y BLOQUES)
     ========================================================================= */
  function renderYogaManager(container) {
    container.innerHTML = `
      <div style="display: flex; gap: 8px; border-bottom: 1px solid rgba(46,43,40,0.12); padding-bottom: 0; margin-bottom: 20px;">
        <button id="btn-sub-blo" class="btn-braun-tab ${activeYogaSubTab === 'blocks' ? 'active' : ''}" style="padding:6px 12px 8px 12px; font-size:0.75rem;">Bloques de Secuencia</button>
        <button id="btn-sub-asa" class="btn-braun-tab ${activeYogaSubTab === 'postures' ? 'active' : ''}" style="padding:6px 12px 8px 12px; font-size:0.75rem;">Asanas (Posturas)</button>
      </div>
      <div id="yoga-sub-content"></div>
    `;

    layout.querySelector('#btn-sub-blo').addEventListener('click', () => { activeYogaSubTab = 'blocks'; editingItem = null; refresh(); });
    layout.querySelector('#btn-sub-asa').addEventListener('click', () => { activeYogaSubTab = 'postures'; editingItem = null; refresh(); });

    const subContentEl = container.querySelector('#yoga-sub-content');

    if (activeYogaSubTab === 'postures') {
      if (editingItem && editingStore === 'yoga_postures') {
        isAsanaFormOpen = true;
      }

      // --- SUB-PESTAÑA ASANAS ---
      subContentEl.innerHTML = `
        <!-- Acordeón Formulario Asanas -->
        <div style="margin-bottom: 24px;">
          <button id="btn-toggle-asana-form" type="button" style="background:transparent; border:none; border-bottom:1px solid rgba(46,43,40,0.12); width:100%; text-align:left; padding:10px 0; font-family:var(--font-digital); font-size:0.78rem; font-weight:600; cursor:pointer; color:var(--color-text-main); display:flex; justify-content:space-between; align-items:center;">
            <span>${editingItem && editingStore === 'yoga_postures' ? '✏ EDITAR ASANA (POSTURA)' : '+ REGISTRAR NUEVA ASANA DE YIN YOGA'}</span>
            <span id="asana-form-icon" style="font-size:0.65rem; transition:transform 0.2s;">${isAsanaFormOpen ? '▼' : '▶'}</span>
          </button>

          <div id="asana-form-accordion-body" style="display:${isAsanaFormOpen ? 'block' : 'none'}; padding-top: 16px; border-bottom: 1px solid rgba(46,43,40,0.08); padding-bottom: 16px;">
            <form id="form-asana" style="display:flex; flex-direction:column; gap:12px;">
              <div style="display:flex; flex-wrap:wrap; gap:16px;">
                <div style="flex:1.5; min-width:180px; display:flex; flex-direction:column; gap:4px;">
                  <label style="font-size:0.6rem; color:var(--color-text-muted); text-transform:uppercase;">Nombre de la Asana</label>
                  <input type="text" id="asana-name" class="acu-input-flat" style="padding: 6px;" placeholder="Ej. Oruga (Paschimottanasana)" required>
                </div>
                <div style="width:140px; display:flex; flex-direction:column; gap:4px;">
                  <label style="font-size:0.6rem; color:var(--color-text-muted); text-transform:uppercase;">ID / Código Único</label>
                  <input type="text" id="asana-id" class="acu-input-flat" style="padding: 6px;" placeholder="Ej. yin-caterpillar" ${editingItem && editingStore === 'yoga_postures' ? 'disabled' : ''} required>
                </div>
                <div style="width:120px; display:flex; flex-direction:column; gap:4px;">
                  <label style="font-size:0.6rem; color:var(--color-text-muted); text-transform:uppercase;">Estilo</label>
                  <input type="text" id="asana-style" class="acu-input-flat" style="padding: 6px;" placeholder="Ej. Yin" value="Yin" required>
                </div>
              </div>

              <div style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:0.6rem; color:var(--color-text-muted); text-transform:uppercase;">Enfoque (Meridianos, Tejido Conectivo y Beneficios)</label>
                <textarea id="asana-focus" class="acu-input-flat" style="padding: 8px; font-size:0.8rem; min-height:45px; resize:vertical;" placeholder="Ej. Estiramiento profundo de la cadena posterior, estimulación del meridiano de la Vejiga..." required></textarea>
              </div>

              <div style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:0.6rem; color:var(--color-text-muted); text-transform:uppercase;">Preparación (Posición Inicial y Apoyos)</label>
                <textarea id="asana-prep" class="acu-input-flat" style="padding: 8px; font-size:0.8rem; min-height:45px; resize:vertical;" placeholder="Ej. Sentada en el mat con las piernas estiradas hacia adelante. Colocar la pelota sobre las piernas..." required></textarea>
              </div>

              <div style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:0.6rem; color:var(--color-text-muted); text-transform:uppercase;">Ejecución (Respiración, Gravedad y Permanencia)</label>
                <textarea id="asana-exec" class="acu-input-flat" style="padding: 8px; font-size:0.8rem; min-height:55px; resize:vertical;" placeholder="Ej. Inhalar profundo y al exhalar dejarse caer sobre la pelota sin jalar ni forzar..." required></textarea>
              </div>

              <div style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:0.6rem; color:var(--color-text-muted); text-transform:uppercase;">Equipo / Utilería (Opcional)</label>
                <input type="text" id="asana-equipment" class="acu-input-flat" style="padding: 6px;" placeholder="Ej. Pelota grande de yoga, Bloques">
              </div>

              <div style="display:flex; gap:12px; justify-content:flex-end; margin-top:8px;">
                ${editingItem && editingStore === 'yoga_postures' ? `
                  <button type="button" id="btn-cancel-edit" style="background:none; border:none; color:var(--color-text-muted); font-size:0.75rem; cursor:pointer;">[ CANCELAR ]</button>
                  <button type="submit" style="background:none; border:none; color:var(--color-accent-green); font-size:0.75rem; cursor:pointer; font-weight:600;">[ GUARDAR CAMBIOS ]</button>
                ` : `
                  <button type="submit" style="background:none; border:none; color:var(--color-text-main); font-size:0.75rem; cursor:pointer; font-weight:600;">[ CREAR ASANA ]</button>
                `}
              </div>
            </form>
          </div>
        </div>

        <!-- Listado de Asanas -->
        <div class="acu-points-tab-list" id="postures-editor-list"></div>
      `;

      // Evento acordeón formulario asana
      const toggleAsanaBtn = layout.querySelector('#btn-toggle-asana-form');
      if (toggleAsanaBtn) {
        toggleAsanaBtn.addEventListener('click', () => {
          isAsanaFormOpen = !isAsanaFormOpen;
          const body = layout.querySelector('#asana-form-accordion-body');
          const icon = layout.querySelector('#asana-form-icon');
          if (body) body.style.display = isAsanaFormOpen ? 'block' : 'none';
          if (icon) icon.textContent = isAsanaFormOpen ? '▼' : '▶';
        });
      }

      if (editingItem && editingStore === 'yoga_postures') {
        layout.querySelector('#asana-id').value = editingItem.id || '';
        layout.querySelector('#asana-name').value = editingItem.name || '';
        layout.querySelector('#asana-style').value = editingItem.style || 'Yin';
        layout.querySelector('#asana-focus').value = editingItem.focus || editingItem.description || '';
        layout.querySelector('#asana-prep').value = editingItem.preparation || '';
        layout.querySelector('#asana-exec').value = editingItem.execution || '';
        layout.querySelector('#asana-equipment').value = editingItem.equipment || '';

        layout.querySelector('#btn-cancel-edit').addEventListener('click', () => {
          editingItem = null;
          isAsanaFormOpen = false;
          refresh();
        });
      }

      layout.querySelector('#form-asana').addEventListener('submit', async (e) => {
        e.preventDefault();
        const focus = layout.querySelector('#asana-focus').value.trim();
        const prep = layout.querySelector('#asana-prep').value.trim();
        const exec = layout.querySelector('#asana-exec').value.trim();
        const equip = layout.querySelector('#asana-equipment').value.trim();
        const descText = `- Enfoque: ${focus}\n- Preparación: ${prep}\n- Ejecución: ${exec}`;

        const asanaData = {
          id: editingItem && editingStore === 'yoga_postures' ? editingItem.id : layout.querySelector('#asana-id').value.trim().toLowerCase(),
          name: layout.querySelector('#asana-name').value.trim(),
          style: layout.querySelector('#asana-style').value.trim(),
          focus: focus,
          preparation: prep,
          execution: exec,
          equipment: equip,
          description: descText
        };

        try {
          await putData(db, 'yoga_postures', asanaData);
          editingItem = null;
          isAsanaFormOpen = false;
          alert('Asana guardada correctamente.');
          refresh();
        } catch (err) {
          console.error(err);
          alert('Error al guardar la asana.');
        }
      });

      renderPosturesList(subContentEl.querySelector('#postures-editor-list'));
    } else {
      // --- SUB-PESTAÑA BLOQUES ---
      if (editingItem && editingStore === 'yoga_blocks') {
        isYogaBlockFormOpen = true;
      }

      let blockPosturesList = [];
      if (editingItem && editingStore === 'yoga_blocks') {
        blockPosturesList = JSON.parse(JSON.stringify(editingItem.postures || []));
      }

      subContentEl.innerHTML = `
        <!-- Acordeón Formulario Bloques -->
        <div style="margin-bottom: 24px;">
          <button id="btn-toggle-yogablock-form" type="button" style="background:transparent; border:none; border-bottom:1px solid rgba(46,43,40,0.12); width:100%; text-align:left; padding:10px 0; font-family:var(--font-digital); font-size:0.78rem; font-weight:600; cursor:pointer; color:var(--color-text-main); display:flex; justify-content:space-between; align-items:center;">
            <span>${editingItem && editingStore === 'yoga_blocks' ? '✏ EDITAR BLOQUE DE SECUENCIA' : '+ CREAR NUEVO BLOQUE DE YOGA'}</span>
            <span id="yogablock-form-icon" style="font-size:0.65rem; transition:transform 0.2s;">${isYogaBlockFormOpen ? '▼' : '▶'}</span>
          </button>

          <div id="yogablock-form-accordion-body" style="display:${isYogaBlockFormOpen ? 'block' : 'none'}; padding-top: 16px; border-bottom: 1px solid rgba(46,43,40,0.08); padding-bottom: 16px;">
            <form id="form-block" style="display:flex; flex-direction:column; gap:12px;">
              <div style="display:flex; flex-wrap:wrap; gap:16px;">
                <div style="flex:1.5; min-width:180px; display:flex; flex-direction:column; gap:4px;">
                  <label style="font-size:0.6rem; color:var(--color-text-muted); text-transform:uppercase;">Nombre del Bloque</label>
                  <input type="text" id="block-name" class="acu-input-flat" style="padding: 6px;" placeholder="Ej. Apertura de Caderas Yin" required>
                </div>
                <div style="width:120px; display:flex; flex-direction:column; gap:4px;">
                  <label style="font-size:0.6rem; color:var(--color-text-muted); text-transform:uppercase;">ID Único</label>
                  <input type="text" id="block-id" class="acu-input-flat" style="padding: 6px;" placeholder="Ej. block-caderas" ${editingItem && editingStore === 'yoga_blocks' ? 'disabled' : ''} required>
                </div>
              </div>
              
              <div style="display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:0.6rem; color:var(--color-text-muted); text-transform:uppercase;">Descripción / Propósito</label>
                <input type="text" id="block-desc" class="acu-input-flat" style="padding: 6px;" placeholder="Ej. Mini-secuencia enfocada en rotación externa y liberación lumbar." required>
              </div>

              <!-- Listado interactivo de posturas dentro de este bloque -->
              <div style="border:1px solid rgba(46,43,40,0.08); padding:12px; border-radius:0; margin: 6px 0;">
                <span style="font-size:0.65rem; color:var(--color-text-muted); text-transform:uppercase; font-weight:600; display:block; margin-bottom:8px;">Posturas del Bloque</span>
                
                <div id="block-postures-builder" style="display:flex; flex-direction:column; gap:8px; margin-bottom:12px;">
                  <!-- Posturas agregadas temporalmente -->
                </div>

                <!-- Selector para añadir postura -->
                <div style="display:flex; gap:12px; align-items:flex-end; border-top:1px dotted rgba(46,43,40,0.06); padding-top:10px;">
                  <div style="flex:1; display:flex; flex-direction:column; gap:4px;">
                    <span style="font-size:0.55rem; color:var(--color-text-muted); text-transform:uppercase;">Seleccionar Asana</span>
                    <select id="select-asana-to-add" class="acu-select-flat" style="font-size:0.75rem; padding:4px;">
                      ${yogaPostures.map(p => `<option value="${escapeAttribute(p.id)}">${escapeHTML(p.name)}</option>`).join('')}
                    </select>
                  </div>
                  <div style="width:100px; display:flex; flex-direction:column; gap:4px;">
                    <span style="font-size:0.55rem; color:var(--color-text-muted); text-transform:uppercase;">Retención (s)</span>
                    <input type="number" id="input-asana-hold" class="acu-input-flat" style="font-size:0.75rem; padding:4px;" min="10" placeholder="Asignar">
                  </div>
                  <button type="button" id="btn-add-asana-to-block" class="btn-action-icon" title="Agregar Asana al Bloque" aria-label="Agregar Asana al Bloque" style="width:32px; height:32px; color:var(--color-text-main);">
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                      <line x1="12" y1="5" x2="12" y2="19"></line>
                      <line x1="5" y1="12" x2="19" y2="12"></line>
                    </svg>
                  </button>
                </div>
              </div>

              <div style="display:flex; gap:12px; justify-content:flex-end; margin-top:8px;">
                ${editingItem && editingStore === 'yoga_blocks' ? `
                  <button type="button" id="btn-cancel-edit" style="background:none; border:none; color:var(--color-text-muted); font-size:0.75rem; cursor:pointer;">[ CANCELAR ]</button>
                  <button type="submit" style="background:none; border:none; color:var(--color-accent-green); font-size:0.75rem; cursor:pointer; font-weight:600;">[ GUARDAR CAMBIOS ]</button>
                ` : `
                  <button type="submit" style="background:none; border:none; color:var(--color-text-main); font-size:0.75rem; cursor:pointer; font-weight:600;">[ CREAR BLOQUE ]</button>
                `}
              </div>
            </form>
          </div>
        </div>

        <!-- Listado de Bloques -->
        <div class="acu-points-tab-list" id="blocks-editor-list"></div>
      `;

      // Evento acordeón formulario bloques
      const toggleBlockBtn = layout.querySelector('#btn-toggle-yogablock-form');
      if (toggleBlockBtn) {
        toggleBlockBtn.addEventListener('click', () => {
          isYogaBlockFormOpen = !isYogaBlockFormOpen;
          const body = layout.querySelector('#yogablock-form-accordion-body');
          const icon = layout.querySelector('#yogablock-form-icon');
          if (body) body.style.display = isYogaBlockFormOpen ? 'block' : 'none';
          if (icon) icon.textContent = isYogaBlockFormOpen ? '▼' : '▶';
        });
      }

      const blockPosturesBuilderEl = subContentEl.querySelector('#block-postures-builder');

      function renderBlockBuilderPostures() {
        blockPosturesBuilderEl.innerHTML = '';
        if (blockPosturesList.length === 0) {
          blockPosturesBuilderEl.innerHTML = `<span style="font-size:0.7rem; color:var(--color-text-muted); font-style:italic;">No hay posturas en el bloque. Añade algunas abajo.</span>`;
          return;
        }

        blockPosturesList.forEach((bp, index) => {
          const matchedPost = yogaPostures.find(yp => yp.id === bp.postureId);
          const name = matchedPost ? matchedPost.name : 'Postura Desconocida';

          const itemEl = document.createElement('div');
          itemEl.style.cssText = 'display:flex; justify-content:space-between; align-items:center; font-size:0.78rem; padding:4px 8px; background:transparent; border-bottom:1px solid rgba(46,43,40,0.06); border-radius:0;';
          itemEl.innerHTML = `
            <span style="flex:1; min-width:0;">${index + 1}. <strong>${escapeHTML(name)}</strong></span>
            <label style="display:flex; align-items:center; gap:4px; color:var(--color-text-muted); font-size:0.65rem;">
              <input type="number" class="block-posture-hold" min="10" value="${escapeAttribute(bp.holdTime)}" aria-label="Tiempo de retención de ${escapeAttribute(name)}" style="width:64px; background:transparent; border:none; border-bottom:1px solid rgba(46,43,40,0.15); color:var(--color-text-main); text-align:right;"> s
            </label>
            <div style="display:flex; gap:8px;">
              <button type="button" class="btn-builder-up" style="background:none; border:none; cursor:pointer; color:var(--color-text-muted);" ${index === 0 ? 'disabled' : ''}>▲</button>
              <button type="button" class="btn-builder-down" style="background:none; border:none; cursor:pointer; color:var(--color-text-muted);" ${index === blockPosturesList.length - 1 ? 'disabled' : ''}>▼</button>
              <button type="button" class="btn-builder-remove" style="background:none; border:none; cursor:pointer; color:var(--color-accent-red); font-weight:600;">✕</button>
            </div>
          `;

          itemEl.querySelector('.block-posture-hold').addEventListener('change', (event) => {
            const value = Number(event.target.value);
            if (Number.isFinite(value) && value >= 10) bp.holdTime = value;
            else event.target.value = bp.holdTime;
          });

          // Ordenación y borrado en el builder temporal
          itemEl.querySelector('.btn-builder-up').addEventListener('click', () => {
            if (index > 0) {
              const temp = blockPosturesList[index];
              blockPosturesList[index] = blockPosturesList[index - 1];
              blockPosturesList[index - 1] = temp;
              renderBlockBuilderPostures();
            }
          });
          itemEl.querySelector('.btn-builder-down').addEventListener('click', () => {
            if (index < blockPosturesList.length - 1) {
              const temp = blockPosturesList[index];
              blockPosturesList[index] = blockPosturesList[index + 1];
              blockPosturesList[index + 1] = temp;
              renderBlockBuilderPostures();
            }
          });
          itemEl.querySelector('.btn-builder-remove').addEventListener('click', () => {
            blockPosturesList.splice(index, 1);
            renderBlockBuilderPostures();
          });

          blockPosturesBuilderEl.appendChild(itemEl);
        });
      }

      // Conectar botón Agregar Asana al Bloque
      subContentEl.querySelector('#btn-add-asana-to-block').addEventListener('click', () => {
        const asanaId = subContentEl.querySelector('#select-asana-to-add').value;
        const holdTimeInput = subContentEl.querySelector('#input-asana-hold');
        const holdTime = Number(holdTimeInput.value);

        if (!asanaId || !Number.isFinite(holdTime) || holdTime < 10) {
          alert('Selecciona una postura y asigna un tiempo de retención válido.');
          return;
        }
        blockPosturesList.push({ postureId: asanaId, holdTime });
        holdTimeInput.value = '';
        renderBlockBuilderPostures();
      });

      renderBlockBuilderPostures();

      if (editingItem && editingStore === 'yoga_blocks') {
        layout.querySelector('#block-id').value = editingItem.id || '';
        layout.querySelector('#block-name').value = editingItem.name || '';
        layout.querySelector('#block-desc').value = editingItem.description || '';

        layout.querySelector('#btn-cancel-edit').addEventListener('click', () => {
          editingItem = null;
          refresh();
        });
      }

      layout.querySelector('#form-block').addEventListener('submit', async (e) => {
        e.preventDefault();

        if (blockPosturesList.length === 0) {
          alert('Por favor, añade al menos una postura al bloque antes de guardar.');
          return;
        }

        const blockData = {
          id: editingItem && editingStore === 'yoga_blocks' ? editingItem.id : layout.querySelector('#block-id').value.trim().toLowerCase(),
          name: layout.querySelector('#block-name').value.trim(),
          description: layout.querySelector('#block-desc').value.trim(),
          postures: blockPosturesList
        };

        try {
          await putData(db, 'yoga_blocks', blockData);
          editingItem = null;
          alert('Bloque de secuencia guardado correctamente.');
          refresh();
        } catch (err) {
          console.error(err);
          alert('Error al guardar el bloque.');
        }
      });

      renderBlocksList(subContentEl.querySelector('#blocks-editor-list'));
    }
  }

  function renderPosturesList(listEl) {
    listEl.innerHTML = '';

    yogaPostures.forEach(p => {
      const card = document.createElement('div');
      card.className = 'acu-point-card';

      let bodyContentHtml = '';
      if (p.focus || p.preparation || p.execution) {
        bodyContentHtml = `
          <div style="font-size:0.78rem; color:var(--color-text-muted); margin:6px 0 10px 0; line-height:1.45; display:flex; flex-direction:column; gap:6px;">
            ${p.focus ? `<div><span style="color:var(--color-text-main); font-weight:500;">- Enfoque:</span> ${escapeHTML(p.focus)}</div>` : ''}
            ${p.preparation ? `<div><span style="color:var(--color-text-main); font-weight:500;">- Preparación:</span> ${escapeHTML(p.preparation)}</div>` : ''}
            ${p.execution ? `<div><span style="color:var(--color-text-main); font-weight:500;">- Ejecución:</span> ${escapeHTML(p.execution)}</div>` : ''}
          </div>
        `;
      } else {
        bodyContentHtml = `<p style="font-size:0.78rem; color:var(--color-text-muted); margin:4px 0 8px 0; line-height:1.4;">${escapeHTML(p.description || '')}</p>`;
      }

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div style="flex:1; padding-right:16px;">
            <div style="font-weight:600; font-size:0.95rem; color:var(--color-text-main); line-height:1.2;">${escapeHTML(p.name)}</div>
            ${bodyContentHtml}
            <div style="font-family:var(--font-mono); font-size:0.72rem; color:var(--color-text-muted); margin-top:4px;">
              Estilo: <span style="color:var(--color-text-main); font-weight:500;">${escapeHTML(p.style || 'Yin')}</span>
              ${p.equipment ? ` &nbsp;|&nbsp; Equipo: <span style="color:var(--color-text-main);">${escapeHTML(p.equipment)}</span>` : ''}
            </div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
            <span style="font-family:var(--font-mono); font-size:0.65rem; color:var(--color-text-muted); text-transform:uppercase; letter-spacing:0.05em;">${escapeHTML(p.id)}</span>
            <div style="display:flex; gap:4px;">
              <button class="btn-action-icon btn-edit-yp" title="Editar" aria-label="Editar">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button class="btn-action-icon delete-icon btn-delete-yp" title="Borrar" aria-label="Borrar">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `;

      card.querySelector('.btn-edit-yp').addEventListener('click', () => {
        editingItem = p;
        editingStore = 'yoga_postures';
        refresh();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });

      card.querySelector('.btn-delete-yp').addEventListener('click', async () => {
        if (confirm(`¿Seguro que deseas eliminar la asana "${p.name}" de la base de datos?`)) {
          await deleteData(db, 'yoga_postures', p.id);
          refresh();
        }
      });

      listEl.appendChild(card);
    });
  }

  function renderBlocksList(listEl) {
    listEl.innerHTML = '';

    yogaBlocks.forEach(b => {
      // Formatear la lista de posturas contenidas
      const posturesNamesList = b.postures.map(bp => {
        const post = yogaPostures.find(yp => yp.id === bp.postureId);
        return post ? `${escapeHTML(post.name)} (${escapeHTML(bp.holdTime)}s)` : `Asana (${escapeHTML(bp.holdTime)}s)`;
      }).join(' → ');

      const card = document.createElement('div');
      card.className = 'acu-point-card';
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div style="flex:1;">
            <span style="font-weight:600; font-size:0.88rem; color:var(--color-text-main);">${escapeHTML(b.name)}</span>
            <p style="font-size:0.75rem; color:var(--color-text-muted); margin:4px 0 8px 0; line-height:1.4;">${escapeHTML(b.description)}</p>
            <div style="font-size:0.7rem; color:var(--color-accent-red); line-height:1.35; font-family:var(--font-ui);">
              <strong>Flujo:</strong> ${posturesNamesList || 'Sin posturas'}
            </div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
            <span style="font-family:var(--font-mono); font-size:0.65rem; color:var(--color-text-muted); text-transform:uppercase;">${escapeHTML(b.id)}</span>
            <div style="display:flex; gap:4px;">
              <button class="btn-action-icon btn-edit-yb" title="Editar" aria-label="Editar">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button class="btn-action-icon delete-icon btn-delete-yb" title="Borrar" aria-label="Borrar">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `;

      card.querySelector('.btn-edit-yb').addEventListener('click', () => {
        editingItem = b;
        editingStore = 'yoga_blocks';
        refresh();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });

      card.querySelector('.btn-delete-yb').addEventListener('click', async () => {
        if (confirm(`¿Seguro que deseas eliminar el bloque "${b.name}"?`)) {
          await deleteData(db, 'yoga_blocks', b.id);
          refresh();
        }
      });

      listEl.appendChild(card);
    });
  }
  
  /* =========================================================================
     MÓDULO: SESIONES COMPUESTAS
     ========================================================================= */
  function renderCompoundSessionsManager(container) {
    container.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
        <div style="font-size: 0.75rem; color: var(--color-text-muted); font-family: var(--font-digital); text-transform: uppercase; letter-spacing: 0.05em;">
          Gestión de Sesiones Compuestas
        </div>
        <button id="btn-syllabus-add-session" class="btn-braun-tab active" style="font-family: var(--font-digital); text-transform: uppercase; padding: 6px 12px; font-size: 0.7rem; cursor: pointer;">
          + Crear Nueva Sesión
        </button>
      </div>
      <div class="acu-points-tab-list" id="compound-sessions-list"></div>
    `;

    container.querySelector('#btn-syllabus-add-session').addEventListener('click', () => {
      onNavigate('sessions');
    });

    const listEl = container.querySelector('#compound-sessions-list');
    
    if (compoundSessions.length === 0) {
      listEl.innerHTML = '<p style="color:var(--color-text-muted); font-size:0.8rem; padding:16px;">No hay sesiones compuestas registradas. Haz clic en "+ Crear Nueva Sesión".</p>';
      return;
    }

    compoundSessions.forEach(session => {
      const blocksHtml = session.blocks.map((b, i) => {
        return `<div style="font-size:0.75rem; color:var(--color-text-main); margin-bottom:4px;">
          <span style="color:var(--color-accent-red); font-weight:bold;">${i + 1}.</span> 
          [${b.module.toUpperCase()}] ${escapeHTML(b.nameOverride || b.presetId)} (${b.duration}s)
        </div>`;
      }).join('');

      const card = document.createElement('div');
      card.className = 'acu-point-card';
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div style="flex:1;">
            <span style="font-weight:600; font-size:0.88rem; color:var(--color-text-main);">${escapeHTML(session.name)}</span>
            <p style="font-size:0.75rem; color:var(--color-text-muted); margin:4px 0 8px 0; line-height:1.4;">${escapeHTML(session.description)}</p>
            <div style="margin-top:12px; padding:12px; background:rgba(0,0,0,0.02); border-left:2px solid var(--color-accent-red);">
              <div style="font-size:0.65rem; color:var(--color-text-muted); text-transform:uppercase; margin-bottom:8px; font-weight:bold;">Bloques Secuenciales</div>
              ${blocksHtml}
            </div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px; margin-left:16px;">
            <span style="font-family:var(--font-mono); font-size:0.65rem; color:var(--color-text-muted); text-transform:uppercase;">${escapeHTML(session.id)}</span>
            <div style="display:flex; gap:4px;">
              <button class="btn-action-icon btn-edit-cs" title="Editar" aria-label="Editar">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button class="btn-action-icon delete-icon btn-delete-cs" title="Borrar" aria-label="Borrar">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `;

      card.querySelector('.btn-edit-cs').addEventListener('click', () => {
        onNavigate('sessions', session.id);
      });

      card.querySelector('.btn-delete-cs').addEventListener('click', async () => {
        if (confirm(`¿Seguro que deseas eliminar la sesión "${session.name}"?`)) {
          await deleteData(db, 'compound_sessions', session.id);
          refresh();
        }
      });

      listEl.appendChild(card);
    });
  }


  /* =========================================================================
     MÓDULO: MEDITACIÓN (SECUENCIAS DE BLOQUES)
     ========================================================================= */
  function renderMeditationManager(container) {
    const wrapper = document.createElement('div');
    const isEditing = editingItem && editingStore === 'meditation_presets';
    let tempBlocks = isEditing
      ? structuredClone(editingItem.blocks || [])
      : [
          { name: 'Fase Inicial', mins: 5, secs: 0 },
          { name: 'Fase Profunda', mins: 5, secs: 0 }
        ];

    wrapper.innerHTML = `
      <div class="strength-manager__accordion" style="margin-bottom: 24px;">
        <button type="button" class="strength-manager__accordion-trigger" id="btn-toggle-med-form" aria-expanded="${isMeditationFormOpen}">
          <span>${isEditing ? '✎ EDITAR SECUENCIA DE MEDITACIÓN' : '+ REGISTRAR SECUENCIA DE MEDITACIÓN'}</span>
          <span>${isMeditationFormOpen ? '▼' : '▶'}</span>
        </button>
        <div class="strength-manager__accordion-body" style="display:${isMeditationFormOpen ? 'block' : 'none'}">
          <form id="meditation-syllabus-form" class="strength-manager__form">
            <div class="strength-manager__grid">
              <label class="strength-manager__field strength-manager__field--wide">
                <span>Nombre de la Secuencia</span>
                <input id="syllabus-med-name" class="acu-input-flat" placeholder="Ej. Vipassana en 3 Fases" required value="${isEditing ? escapeAttribute(editingItem.name) : ''}">
              </label>
              <label class="strength-manager__field strength-manager__field--full">
                <span>Descripción / Enfoque (Opcional)</span>
                <textarea id="syllabus-med-desc" class="acu-input-flat" placeholder="Ej. Transición gradual de calma respiratoria a presencia abierta...">${isEditing ? escapeHTML(editingItem.description || '') : ''}</textarea>
              </label>
            </div>

            <section class="strength-circuit-builder" style="margin-top: 16px;">
              <div class="strength-circuit-builder__header">
                <strong>Bloques de la Secuencia</strong>
                <span id="syllabus-med-total-time" style="font-family: var(--font-digital); color: var(--color-text-muted); font-size: 0.75rem;"></span>
              </div>
              <div id="syllabus-med-blocks-container" class="meditation-block-list"></div>
              <div style="margin-top: 12px;">
                <button type="button" class="strength-manager__text-action" id="btn-syllabus-med-add-block">+ Añadir Bloque (${tempBlocks.length}/7)</button>
              </div>
            </section>

            <div class="strength-manager__form-actions" style="margin-top: 20px;">
              ${isEditing ? '<button type="button" class="strength-manager__text-action secondary" id="btn-syllabus-med-cancel">Cancelar</button>' : ''}
              <button type="submit" class="strength-manager__text-action">${isEditing ? 'Guardar Cambios' : 'Crear Secuencia'}</button>
            </div>
          </form>
        </div>
      </div>
      <div id="syllabus-meditation-list"></div>
    `;

    container.appendChild(wrapper);

    // Toggle acordeón
    wrapper.querySelector('#btn-toggle-med-form').addEventListener('click', () => {
      isMeditationFormOpen = !isMeditationFormOpen;
      renderMeditationManager(container);
    });

    const blocksContainer = wrapper.querySelector('#syllabus-med-blocks-container');
    const totalTimeLabel = wrapper.querySelector('#syllabus-med-total-time');
    const addBlockBtn = wrapper.querySelector('#btn-syllabus-med-add-block');

    const updateBlocksUI = () => {
      const totalSecs = calculateSequenceDuration(tempBlocks);
      totalTimeLabel.textContent = `TOTAL: ${Math.floor(totalSecs / 60)}m ${totalSecs % 60}s`;
      addBlockBtn.textContent = `+ Añadir Bloque (${tempBlocks.length}/7)`;
      addBlockBtn.disabled = tempBlocks.length >= 7;

      blocksContainer.innerHTML = '';
      tempBlocks.forEach((block, idx) => {
        const row = document.createElement('div');
        row.className = 'meditation-block-row';
        row.style.cssText = 'display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 10px 0; border-bottom: 1px dashed rgba(46,43,40,0.1);';
        row.innerHTML = `
          <span style="font-family: var(--font-digital); font-size: 0.75rem; color: var(--color-text-muted); width: 20px;">${idx + 1}.</span>
          <input type="text" class="block-name-input acu-input-flat" value="${escapeAttribute(block.name || 'Bloque ' + (idx + 1))}" style="flex: 1; min-width: 120px; font-size: 0.8rem; padding: 4px; background: transparent; border: none; border-bottom: 1px solid rgba(46,43,40,0.2);">
          <div style="display: flex; gap: 4px; align-items: center;">
            <input type="number" class="block-mins-input acu-step-num-input" min="0" max="60" value="${block.mins}" style="width: 45px; padding: 4px;">
            <span style="font-size: 0.75rem;">m</span>
            <input type="number" class="block-secs-input acu-step-num-input" min="0" max="59" value="${block.secs}" style="width: 45px; padding: 4px;">
            <span style="font-size: 0.75rem;">s</span>
          </div>
          <div style="display: flex; gap: 2px;">
            <button type="button" class="btn-block-up" aria-label="Subir" style="background:transparent; border:none; cursor:pointer; padding:2px 4px; font-size:0.75rem;" ${idx === 0 ? 'disabled' : ''}>▲</button>
            <button type="button" class="btn-block-down" aria-label="Bajar" style="background:transparent; border:none; cursor:pointer; padding:2px 4px; font-size:0.75rem;" ${idx === tempBlocks.length - 1 ? 'disabled' : ''}>▼</button>
            <button type="button" class="btn-delete-block" title="Eliminar bloque" style="background: transparent; border: none; color: var(--color-accent-red); cursor: pointer; font-size: 1.1rem; padding: 0 4px;">×</button>
          </div>
        `;

        row.querySelector('.block-name-input').addEventListener('input', e => {
          tempBlocks[idx].name = e.target.value;
        });
        row.querySelector('.block-mins-input').addEventListener('input', e => {
          tempBlocks[idx].mins = Math.max(0, parseInt(e.target.value, 10) || 0);
          updateBlocksUI();
        });
        row.querySelector('.block-secs-input').addEventListener('input', e => {
          tempBlocks[idx].secs = Math.max(0, Math.min(59, parseInt(e.target.value, 10) || 0));
          updateBlocksUI();
        });
        row.querySelector('.btn-block-up').addEventListener('click', () => {
          if (idx > 0) {
            [tempBlocks[idx - 1], tempBlocks[idx]] = [tempBlocks[idx], tempBlocks[idx - 1]];
            updateBlocksUI();
          }
        });
        row.querySelector('.btn-block-down').addEventListener('click', () => {
          if (idx < tempBlocks.length - 1) {
            [tempBlocks[idx], tempBlocks[idx + 1]] = [tempBlocks[idx + 1], tempBlocks[idx]];
            updateBlocksUI();
          }
        });
        row.querySelector('.btn-delete-block').addEventListener('click', () => {
          if (tempBlocks.length <= 1) {
            alert('La secuencia debe contener al menos un bloque.');
            return;
          }
          tempBlocks.splice(idx, 1);
          updateBlocksUI();
        });

        blocksContainer.appendChild(row);
      });
    };

    updateBlocksUI();

    addBlockBtn.addEventListener('click', () => {
      if (tempBlocks.length >= 7) {
        alert('Se ha alcanzado el límite máximo de 7 bloques.');
        return;
      }
      tempBlocks.push({ name: `Bloque ${tempBlocks.length + 1}`, mins: 5, secs: 0 });
      updateBlocksUI();
    });

    const cancelBtn = wrapper.querySelector('#btn-syllabus-med-cancel');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        editingItem = null;
        editingStore = '';
        isMeditationFormOpen = false;
        refresh();
      });
    }

    wrapper.querySelector('#meditation-syllabus-form').addEventListener('submit', async e => {
      e.preventDefault();
      const name = wrapper.querySelector('#syllabus-med-name').value.trim();
      const description = wrapper.querySelector('#syllabus-med-desc').value.trim();
      const validation = validateMeditationSequence({ name, blocks: tempBlocks });
      if (!validation.isValid) {
        alert(validation.reason);
        return;
      }
      const data = sanitizeMeditationSequence({
        id: isEditing ? editingItem.id : `med-seq-${Date.now()}`,
        name,
        description,
        blocks: tempBlocks
      });
      await putData(db, 'meditation_presets', data);
      editingItem = null;
      editingStore = '';
      isMeditationFormOpen = false;
      await refresh();
    });

    // Renderizar catálogo de secuencias guardadas
    const listEl = wrapper.querySelector('#syllabus-meditation-list');
    if (meditationPresets.length === 0) {
      listEl.innerHTML = '<p class="strength-manager__empty" style="padding: 24px 0;">No hay secuencias de meditación registradas. Crea tu primera secuencia con el botón superior.</p>';
      return;
    }

    meditationPresets.forEach(preset => {
      const card = document.createElement('div');
      card.className = 'acu-point-card';
      const totalSecs = preset.totalDuration || calculateSequenceDuration(preset.blocks);
      const totalLabel = `${Math.floor(totalSecs / 60)}m ${totalSecs % 60 ? `${totalSecs % 60}s` : ''}`;
      const blocksFlow = (preset.blocks || []).map(b => {
        const time = b.secs > 0 ? `${b.mins}m ${b.secs}s` : `${b.mins}m`;
        return `${escapeHTML(b.name)} (${time})`;
      }).join(' → ');

      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div style="flex:1;">
            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-weight:600; font-size:0.92rem; color:var(--color-text-main);">${escapeHTML(preset.name)}</span>
              <span style="font-family:var(--font-digital); font-size:0.75rem; color:var(--color-accent-red); font-weight:600;">[ ${totalLabel.trim()} ]</span>
            </div>
            ${preset.description ? `<p style="font-size:0.75rem; color:var(--color-text-muted); margin:4px 0 8px 0; line-height:1.4;">${escapeHTML(preset.description)}</p>` : ''}
            <div style="font-size:0.72rem; color:var(--color-text-muted); line-height:1.4; margin-top:6px;">
              <strong style="color:var(--color-text-main);">Fases:</strong> ${blocksFlow || 'Sin bloques'}
            </div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
            <span style="font-family:var(--font-mono); font-size:0.65rem; color:var(--color-text-muted); text-transform:uppercase;">${escapeHTML(preset.id)}</span>
            <div style="display:flex; gap:4px;">
              <button class="btn-action-icon btn-edit-med-preset" title="Editar" aria-label="Editar">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                </svg>
              </button>
              <button class="btn-action-icon delete-icon btn-delete-med-preset" title="Borrar" aria-label="Borrar">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="3 6 5 6 21 6"></polyline>
                  <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                </svg>
              </button>
            </div>
          </div>
        </div>
      `;

      card.querySelector('.btn-edit-med-preset').addEventListener('click', () => {
        editingItem = preset;
        editingStore = 'meditation_presets';
        isMeditationFormOpen = true;
        refresh();
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });

      card.querySelector('.btn-delete-med-preset').addEventListener('click', async () => {
        if (confirm(`¿Seguro que deseas eliminar la secuencia de meditación "${preset.name}"?`)) {
          await deleteData(db, 'meditation_presets', preset.id);
          const lastId = localStorage.getItem('meridiano_last_meditation_preset');
          if (lastId === preset.id) localStorage.removeItem('meridiano_last_meditation_preset');
          refresh();
        }
      });

      listEl.appendChild(card);
    });
  }


  /* =========================================================================
     MÓDULO 4: CABEZALES ELECTRO PEN (REFERENCIA CLÍNICA)
     ========================================================================= */
  function renderHeadsReference(container) {
    container.innerHTML = `
      <div class="glass-panel" style="padding: 20px; overflow-x: auto;">
        <h3 style="font-size:0.9rem; font-weight:600; margin-bottom:14px; text-transform:uppercase; font-family:var(--font-digital); color:var(--color-text-main);">
          Especificaciones de Cabezales (Electro Pen)
        </h3>
        <table class="acu-heads-table">
          <thead>
            <tr>
              <th>Cabezal</th>
              <th>Uso Clínico / Terapéutico</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="acu-head-name-col">Puntero Nodo (Sin Cabezal)</td>
              <td>La punta directa del lápiz (sin cabezal) o accesorio de punta fina, perfecta para puntos muy estrechos, dedos de las manos, de los pies y localizaciones anatómicas de extrema precisión.</td>
            </tr>
            <tr>
              <td class="acu-head-name-col">Cabezal Esferoidal (Ball)</td>
              <td>Punta esférica estándar. Distribuye la estimulación TENS de forma profunda y concéntrica. Idóneo para la búsqueda de puntos gatillo y estímulo de contracción muscular.</td>
            </tr>
            <tr>
              <td class="acu-head-name-col">Cabezal de Domo (Plano)</td>
              <td>El cabezal plano o de cúpula ancha, ideal para dispersar la corriente, suavizar el estímulo en zonas muy sensibles (como la cara, el cuello o el pliegue transversal de la muñeca) y calmar el sistema nervioso de manera gentil.</td>
            </tr>
          </tbody>
        </table>
      </div>
    `;
  }

  /* =========================================================================
     MÓDULO 5: SINTETIZADOR DE AUDIO (ONDAS Y TONOS)
     ========================================================================= */
  function renderSynthReference(container) {
    container.innerHTML = `
      <div style="display: flex; gap: 8px; border-bottom: 1px solid rgba(46,43,40,0.12); padding-bottom: 0; margin-bottom: 20px;">
        <button id="btn-sub-waves" class="btn-braun-tab ${activeSynthSubTab === 'brainwaves' ? 'active' : ''}" style="padding:6px 12px 8px 12px; font-size:0.75rem;">Ondas Cerebrales</button>
        <button id="btn-sub-solfeggio" class="btn-braun-tab ${activeSynthSubTab === 'solfeggio' ? 'active' : ''}" style="padding:6px 12px 8px 12px; font-size:0.75rem;">Tonos Base</button>
        <button id="btn-sub-modes" class="btn-braun-tab ${activeSynthSubTab === 'modes' ? 'active' : ''}" style="padding:6px 12px 8px 12px; font-size:0.75rem;">Modos de Modulación</button>
      </div>
      <div id="synth-sub-content"></div>
    `;

    layout.querySelector('#btn-sub-waves').addEventListener('click', () => { activeSynthSubTab = 'brainwaves'; refresh(); });
    layout.querySelector('#btn-sub-solfeggio').addEventListener('click', () => { activeSynthSubTab = 'solfeggio'; refresh(); });
    layout.querySelector('#btn-sub-modes').addEventListener('click', () => { activeSynthSubTab = 'modes'; refresh(); });

    const subContentEl = container.querySelector('#synth-sub-content');

    if (activeSynthSubTab === 'brainwaves') {
      subContentEl.innerHTML = `
        <div class="glass-panel" style="padding: 20px; overflow-x: auto;">
          <h3 style="font-size:0.9rem; font-weight:600; margin-bottom:14px; text-transform:uppercase; font-family:var(--font-digital); color:var(--color-text-main);">
            Estados de Ondas Cerebrales (Frecuencia Diferencial)
          </h3>
          <table class="acu-heads-table">
            <thead>
              <tr>
                <th>Estado</th>
                <th style="width: 120px;">Frecuencia</th>
                <th>Efectos y Aplicación Clínica</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="acu-head-name-col">Delta</td>
                <td style="font-family: var(--font-digital); font-weight: 600; color: var(--color-accent-red);">0.5 – 4.0 Hz</td>
                <td><strong>Sueño profundo y regeneración:</strong> Induce la desconexión del estado de vigilia. Promueve la restauración física, modulación del dolor, sanación celular y estimulación de hormonas reparadoras de forma local-first.</td>
              </tr>
              <tr>
                <td class="acu-head-name-col">Theta</td>
                <td style="font-family: var(--font-digital); font-weight: 600; color: var(--color-accent-red);">4.0 – 8.0 Hz</td>
                <td><strong>Meditación profunda e hipnosis:</strong> Estado de relajación subconsciente óptimo para la asimilación del yoga y reprogramación emocional. Favorece la visualización activa y la memoria a largo plazo.</td>
              </tr>
              <tr>
                <td class="acu-head-name-col">Alpha</td>
                <td style="font-family: var(--font-digital); font-weight: 600; color: var(--color-accent-red);">8.0 – 12.0 Hz</td>
                <td><strong>Vigilia relajada y enfoque:</strong> Ideal para reducir niveles altos de cortisol y ansiedad. Incrementa el aprendizaje súper-activo, la calma mental e integración del reposo.</td>
              </tr>
              <tr>
                <td class="acu-head-name-col">Beta</td>
                <td style="font-family: var(--font-digital); font-weight: 600; color: var(--color-accent-red);">12.0 – 30.0 Hz</td>
                <td><strong>Atención consciente y cognición:</strong> Estado ordinario de vigilia activa. Recomendado para tareas analíticas, toma de decisiones rápidas y concentración lógica de alta demanda mental.</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    } else if (activeSynthSubTab === 'solfeggio') {
      subContentEl.innerHTML = `
        <div class="glass-panel" style="padding: 20px; overflow-x: auto;">
          <h3 style="font-size:0.9rem; font-weight:600; margin-bottom:14px; text-transform:uppercase; font-family:var(--font-digital); color:var(--color-text-main);">
            Frecuencias Portadoras Base (Solfeggio & Schumann)
          </h3>
          <table class="acu-heads-table">
            <thead>
              <tr>
                <th style="width: 140px;">Tono Base</th>
                <th>Frecuencia</th>
                <th>Propósito Terapéutico / Homeostasis</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="acu-head-name-col">Schumann</td>
                <td style="font-family: var(--font-digital); font-weight: 600; color: var(--color-accent-red);">7.83 Hz</td>
                <td><strong>Resonancia terrestre:</strong> Sincronización con el campo electromagnético del planeta. Promueve estabilidad celular, enraizamiento y armonización biológica.</td>
              </tr>
              <tr>
                <td class="acu-head-name-col">Alivio Dolor</td>
                <td style="font-family: var(--font-digital); font-weight: 600; color: var(--color-accent-red);">174.0 Hz</td>
                <td><strong>Anestesia natural:</strong> Favorece la mitigación del dolor físico general, reduce inflamación y calma tensiones acumuladas en la columna y extremidades.</td>
              </tr>
              <tr>
                <td class="acu-head-name-col">Regeneración</td>
                <td style="font-family: var(--font-digital); font-weight: 600; color: var(--color-accent-red);">285.0 Hz</td>
                <td><strong>Sanación de tejidos:</strong> Estimula la curación física de heridas, quemaduras y reestructura el balance de los órganos internos a nivel celular.</td>
              </tr>
              <tr>
                <td class="acu-head-name-col">Liberar Culpa</td>
                <td style="font-family: var(--font-digital); font-weight: 600; color: var(--color-accent-red);">396.0 Hz</td>
                <td><strong>Seguridad emocional:</strong> Ayuda a transmutar la culpa y los miedos irracionales. Ideal para crear una base de enraizamiento sólida para el reposo.</td>
              </tr>
              <tr>
                <td class="acu-head-name-col">Facilitar Cambio</td>
                <td style="font-family: var(--font-digital); font-weight: 600; color: var(--color-accent-red);">417.0 Hz</td>
                <td><strong>Limpieza de bloqueos:</strong> Remoción de influencias energéticas del pasado y patrones subconscientes restrictivos, preparando la mente para nuevas experiencias.</td>
              </tr>
              <tr>
                <td class="acu-head-name-col">Armonía Natural</td>
                <td style="font-family: var(--font-digital); font-weight: 600; color: var(--color-accent-red);">432.0 Hz</td>
                <td><strong>Calma profunda:</strong> Armonización con la vibración biológica natural. Reduce significativamente la frecuencia cardíaca y estimula el sistema parasimpático.</td>
              </tr>
              <tr>
                <td class="acu-head-name-col">Transformación</td>
                <td style="font-family: var(--font-digital); font-weight: 600; color: var(--color-accent-red);">528.0 Hz</td>
                <td><strong>Reparación del ADN:</strong> Frecuencia de la vitalidad y milagros. Fomenta la autocuración orgánica acelerada y aporta claridad mental y bienestar.</td>
              </tr>
              <tr>
                <td class="acu-head-name-col">Conexión</td>
                <td style="font-family: var(--font-digital); font-weight: 600; color: var(--color-accent-red);">639.0 Hz</td>
                <td><strong>Relaciones armónicas:</strong> Desarrolla la empatía, el perdón y la comprensión interpersonal afectuosa. Ayuda a integrar dinámicas grupales o familiares.</td>
              </tr>
              <tr>
                <td class="acu-head-name-col">Desintoxicar</td>
                <td style="font-family: var(--font-digital); font-weight: 600; color: var(--color-accent-red);">741.0 Hz</td>
                <td><strong>Purificación:</strong> Limpieza celular de toxinas físicas e influencias electromagnéticas dañinas. Estimula la libre autoexpresión y la intuición innata.</td>
              </tr>
              <tr>
                <td class="acu-head-name-col">Intuición</td>
                <td style="font-family: var(--font-digital); font-weight: 600; color: var(--color-accent-red);">852.0 Hz</td>
                <td><strong>Claridad espiritual:</strong> Frecuencia para el retorno al orden espiritual. Abre percepciones intuitivas superiores y discernimiento libre de ilusiones.</td>
              </tr>
              <tr>
                <td class="acu-head-name-col">Unidad</td>
                <td style="font-family: var(--font-digital); font-weight: 600; color: var(--color-accent-red);">963.0 Hz</td>
                <td><strong>Trascendencia universal:</strong> Frecuencia de la glándula pineal y el despertar de la corona. Conecta con el estado original de no-dualidad y unidad.</td>
              </tr>
            </tbody>
          </table>
        </div>
      `;
    } else if (activeSynthSubTab === 'modes') {
      subContentEl.innerHTML = `
        <div class="glass-panel" style="padding: 20px;">
          <h3 style="font-size:0.9rem; font-weight:600; margin-bottom:14px; text-transform:uppercase; font-family:var(--font-digital); color:var(--color-text-main);">
            Modos de Modulación y Arrastre Sonoro
          </h3>
          
          <div style="display:flex; flex-direction:column; gap:20px;">
            <div style="border-bottom:1px dashed rgba(46,43,40,0.08); padding-bottom:16px;">
              <h4 style="font-family:var(--font-digital); font-size:0.8rem; text-transform:uppercase; color:var(--color-accent-red); margin-bottom:6px;">
                Tonos Binaurales
              </h4>
              <p style="font-size:0.78rem; line-height:1.4; color:var(--color-text-main);">
                Consiste en enviar dos tonos senoidales puros con frecuencias ligeramente desalineadas a cada oído de forma independiente. Por ejemplo, al reproducir <span style="font-family:var(--font-digital); font-weight:600;">432 Hz</span> en el canal izquierdo y <span style="font-family:var(--font-digital); font-weight:600;">438 Hz</span> en el derecho, el cerebro crea la ilusión de un tercer tono fluctuante de <span style="font-family:var(--font-digital); font-weight:600;">6 Hz</span> en el tronco encefálico.
              </p>
              <p style="font-size:0.75rem; color:var(--color-text-muted); margin-top:8px; font-style:italic;">
                ➔ Requisito: Uso obligatorio de auriculares estéreo para que la integración ocurra y no se mezclen en el aire de forma física.
              </p>
            </div>
            
            <div>
              <h4 style="font-family:var(--font-digital); font-size:0.8rem; text-transform:uppercase; color:var(--color-accent-red); margin-bottom:6px;">
                Tonos Isocrónicos
              </h4>
              <p style="font-size:0.78rem; line-height:1.4; color:var(--color-text-main);">
                Un único tono portador base que se enciende y apaga a una velocidad específica mediante pulsos rítmicos de volumen completo (modulación mediante un LFO o compuerta de amplitud). Por ejemplo, emitir un tono senoidal de <span style="font-family:var(--font-digital); font-weight:600;">432 Hz</span> modulado en amplitud 4 veces por segundo para inducir un estado de ondas Delta de <span style="font-family:var(--font-digital); font-weight:600;">4 Hz</span>.
              </p>
              <p style="font-size:0.75rem; color:var(--color-text-muted); margin-top:8px; font-style:italic;">
                ➔ Ventaja: Funciona perfectamente sin auriculares y a través de altavoces comunes, haciéndolos ideales para sesiones colectivas o salas de terapias integrales.
              </p>
            </div>
          </div>
        </div>
      `;
    }
  }

  // Carga inicial
  await refresh();
  container.innerHTML = '';
  container.appendChild(layout);
}
