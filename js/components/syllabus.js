import { getAllData, putData, deleteData, addData } from '../db.js';
import { escapeAttribute, escapeHTML } from '../utils/sanitize.js';

export async function renderSyllabusScreen(container, db, onNavigate) {
  // Estado local de la base de datos
  let catalogPoints = [];
  let meridiansList = [];
  let breathworkPatterns = [];
  let yogaPostures = [];
  let yogaBlocks = [];

  // Estado local de navegación de pestañas
  let activeTab = 'acupuncture'; // 'acupuncture', 'breathwork', 'yoga', 'heads', 'synth'
  let activeAcuSubTab = 'points'; // 'points', 'meridians'
  let activeYogaSubTab = 'postures'; // 'postures', 'blocks'
  let activeSynthSubTab = 'brainwaves'; // 'brainwaves', 'solfeggio', 'modes'

  // Estados de edición e inserción
  let editingItem = null; // Guardará el objeto del item que se está editando
  let editingStore = ''; // Almacén activo en edición ('acupuncture_points', 'meridians', 'breathwork_patterns', 'yoga_postures', 'yoga_blocks')

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
              <h2 class="acu-lobby-title" style="margin:0;">Gestor de Bases de Datos</h2>
              <p style="font-size: 0.75rem; color: var(--color-text-muted); margin: 0;">Administra y edita la información en texto de cada módulo clínico local-first.</p>
            </header>

            <!-- Selector de Base de Datos Principal (Estilo Braun) -->
            <div style="display: flex; flex-wrap: wrap; background: rgba(46, 43, 40, 0.04); border: 1px solid rgba(46, 43, 40, 0.08); border-radius: 4px; padding: 2px; margin-bottom: 24px; gap: 2px; width: fit-content; max-width: 100%;">
              <button id="tab-acupuncture" class="btn-braun-tab ${activeTab === 'acupuncture' ? 'active' : ''}">Acupuntura</button>
              <button id="tab-breathwork" class="btn-braun-tab ${activeTab === 'breathwork' ? 'active' : ''}">Respiración</button>
              <button id="tab-yoga" class="btn-braun-tab ${activeTab === 'yoga' ? 'active' : ''}">Yin Yoga</button>
              <button id="tab-heads" class="btn-braun-tab ${activeTab === 'heads' ? 'active' : ''}">Cabezales</button>
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
    layout.querySelector('#tab-heads').addEventListener('click', () => { activeTab = 'heads'; editingItem = null; refresh(); });
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
    } else if (activeTab === 'heads') {
      renderHeadsReference(targetEl);
    } else if (activeTab === 'synth') {
      renderSynthReference(targetEl);
    }
  }

  /* =========================================================================
     MÓDULO 1: ACUPUNTURA (PUNTOS Y MERIDIANOS)
     ========================================================================= */
  function renderAcupunctureManager(container) {
    container.innerHTML = `
      <div style="display: flex; gap: 8px; border-bottom: 1px solid rgba(46,43,40,0.06); padding-bottom: 8px; margin-bottom: 20px;">
        <button id="btn-sub-pts" class="btn-braun-tab ${activeAcuSubTab === 'points' ? 'active' : ''}" style="padding:4px 12px; font-size:0.75rem;">Puntos</button>
        <button id="btn-sub-mer" class="btn-braun-tab ${activeAcuSubTab === 'meridians' ? 'active' : ''}" style="padding:4px 12px; font-size:0.75rem;">Meridianos (Canales)</button>
      </div>
      <div id="acupuncture-sub-content"></div>
    `;

    layout.querySelector('#btn-sub-pts').addEventListener('click', () => { activeAcuSubTab = 'points'; editingItem = null; refresh(); });
    layout.querySelector('#btn-sub-mer').addEventListener('click', () => { activeAcuSubTab = 'meridians'; editingItem = null; refresh(); });

    const subContentEl = container.querySelector('#acupuncture-sub-content');

    if (activeAcuSubTab === 'points') {
      // --- SUB-PESTAÑA PUNTOS ---
      subContentEl.innerHTML = `
        <!-- Formulario de Inserción / Edición -->
        <div class="glass-panel" style="padding: 20px; margin-bottom: 24px;">
          <h3 style="font-size:0.9rem; font-weight:600; margin-bottom:14px; text-transform:uppercase; font-family:var(--font-digital); color:var(--color-text-main);">
            ${editingItem && editingStore === 'acupuncture_points' ? 'Editar Punto Extra' : 'Agregar Nuevo Punto Extra al Catálogo'}
          </h3>
          <form id="form-acu-point" style="display:flex; flex-direction:column; gap:12px;">
            <div style="display:flex; flex-wrap:wrap; gap:16px;">
              <div style="flex:1; min-width:180px; display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:0.6rem; color:var(--color-text-muted); text-transform:uppercase;">Nombre del Punto</label>
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
              <textarea id="acu-p-loc" class="acu-input-flat" style="padding: 8px; font-size:0.8rem; min-height:50px; resize:vertical;" placeholder="Describe detalladamente cómo localizar el punto..." required></textarea>
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
          alert('Punto extra guardado en la base de datos.');
          refresh();
        } catch (err) {
          console.error(err);
          alert('Error al guardar el punto.');
        }
      });

      renderFilteredPointsList();
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
                <button class="btn-edit-pt" style="background:none; border:none; color:var(--color-text-main); font-size:0.62rem; cursor:pointer;">[ EDITAR ]</button>
                <button class="btn-delete-pt" style="background:none; border:none; color:var(--color-accent-red); font-size:0.62rem; cursor:pointer;">[ ELIMINAR ]</button>
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
    container.innerHTML = `
      <!-- Formulario respiración -->
      <div class="glass-panel" style="padding: 20px; margin-bottom: 24px;">
        <h3 style="font-size:0.9rem; font-weight:600; margin-bottom:14px; text-transform:uppercase; font-family:var(--font-digital); color:var(--color-text-main);">
          ${editingItem && editingStore === 'breathwork_patterns' ? 'Editar Técnica de Respiración' : 'Registrar Nueva Técnica de Respiración'}
        </h3>
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

      <!-- Listado de Técnicas -->
      <div class="acu-points-tab-list" id="breathwork-editor-list"></div>
    `;

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
            <div style="display:flex; gap:8px;">
              <button class="btn-edit-br" style="background:none; border:none; color:var(--color-text-main); font-size:0.62rem; cursor:pointer;">[ EDITAR ]</button>
              <button class="btn-delete-br" style="background:none; border:none; color:var(--color-accent-red); font-size:0.62rem; cursor:pointer;">[ BORRAR ]</button>
            </div>
          </div>
        </div>
      `;

      card.querySelector('.btn-edit-br').addEventListener('click', () => {
        editingItem = b;
        editingStore = 'breathwork_patterns';
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
      <div style="display: flex; gap: 8px; border-bottom: 1px solid rgba(46,43,40,0.06); padding-bottom: 8px; margin-bottom: 20px;">
        <button id="btn-sub-asa" class="btn-braun-tab ${activeYogaSubTab === 'postures' ? 'active' : ''}" style="padding:4px 12px; font-size:0.75rem;">Asanas (Posturas)</button>
        <button id="btn-sub-blo" class="btn-braun-tab ${activeYogaSubTab === 'blocks' ? 'active' : ''}" style="padding:4px 12px; font-size:0.75rem;">Bloques de Secuencia</button>
      </div>
      <div id="yoga-sub-content"></div>
    `;

    layout.querySelector('#btn-sub-asa').addEventListener('click', () => { activeYogaSubTab = 'postures'; editingItem = null; refresh(); });
    layout.querySelector('#btn-sub-blo').addEventListener('click', () => { activeYogaSubTab = 'blocks'; editingItem = null; refresh(); });

    const subContentEl = container.querySelector('#yoga-sub-content');

    if (activeYogaSubTab === 'postures') {
      // --- SUB-PESTAÑA ASANAS ---
      subContentEl.innerHTML = `
        <!-- Formulario asanas -->
        <div class="glass-panel" style="padding: 20px; margin-bottom: 24px;">
          <h3 style="font-size:0.9rem; font-weight:600; margin-bottom:14px; text-transform:uppercase; font-family:var(--font-digital); color:var(--color-text-main);">
            ${editingItem && editingStore === 'yoga_postures' ? 'Editar Postura (Asana)' : 'Registrar Nueva Asana de Yin Yoga'}
          </h3>
          <form id="form-asana" style="display:flex; flex-direction:column; gap:12px;">
            <div style="display:flex; flex-wrap:wrap; gap:16px;">
              <div style="flex:1.5; min-width:180px; display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:0.6rem; color:var(--color-text-muted); text-transform:uppercase;">Nombre de la Asana</label>
                <input type="text" id="asana-name" class="acu-input-flat" style="padding: 6px;" placeholder="Ej. Dragón Alado (Anjaneyasana)" required>
              </div>
              <div style="width:120px; display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:0.6rem; color:var(--color-text-muted); text-transform:uppercase;">ID Único</label>
                <input type="text" id="asana-id" class="acu-input-flat" style="padding: 6px;" placeholder="Ej. yin-dragon" ${editingItem && editingStore === 'yoga_postures' ? 'disabled' : ''} required>
              </div>
              <div style="width:120px; display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:0.6rem; color:var(--color-text-muted); text-transform:uppercase;">Estilo</label>
                <input type="text" id="asana-style" class="acu-input-flat" style="padding: 6px;" placeholder="Ej. Yin" value="Yin" required>
              </div>
              <div style="width:100px; display:flex; flex-direction:column; gap:4px;">
                <label style="font-size:0.6rem; color:var(--color-text-muted); text-transform:uppercase;">Duración (s)</label>
                <input type="number" id="asana-duration" class="acu-input-flat" style="padding: 6px;" min="10" value="180" required>
              </div>
            </div>

            <div style="display:flex; flex-direction:column; gap:4px;">
              <label style="font-size:0.6rem; color:var(--color-text-muted); text-transform:uppercase;">Indicaciones de Alineación y Beneficios</label>
              <textarea id="asana-desc" class="acu-input-flat" style="padding: 8px; font-size:0.8rem; min-height:45px; resize:vertical;" placeholder="Describe la tracción del tejido conectivo, meridianos estimulados y precauciones..." required></textarea>
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

        <!-- Listado de Asanas -->
        <div class="acu-points-tab-list" id="postures-editor-list"></div>
      `;

      if (editingItem && editingStore === 'yoga_postures') {
        layout.querySelector('#asana-id').value = editingItem.id || '';
        layout.querySelector('#asana-name').value = editingItem.name || '';
        layout.querySelector('#asana-style').value = editingItem.style || 'Yin';
        layout.querySelector('#asana-duration').value = editingItem.duration || 180;
        layout.querySelector('#asana-desc').value = editingItem.description || '';

        layout.querySelector('#btn-cancel-edit').addEventListener('click', () => {
          editingItem = null;
          refresh();
        });
      }

      layout.querySelector('#form-asana').addEventListener('submit', async (e) => {
        e.preventDefault();
        const asanaData = {
          id: editingItem && editingStore === 'yoga_postures' ? editingItem.id : layout.querySelector('#asana-id').value.trim().toLowerCase(),
          name: layout.querySelector('#asana-name').value.trim(),
          style: layout.querySelector('#asana-style').value.trim(),
          duration: parseInt(layout.querySelector('#asana-duration').value) || 180,
          description: layout.querySelector('#asana-desc').value.trim()
        };

        try {
          await putData(db, 'yoga_postures', asanaData);
          editingItem = null;
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
      // Si estamos editando o creando un bloque, manejamos una lista temporal de posturas en el bloque
      let blockPosturesList = [];
      if (editingItem && editingStore === 'yoga_blocks') {
        blockPosturesList = JSON.parse(JSON.stringify(editingItem.postures || []));
      }

      subContentEl.innerHTML = `
        <!-- Formulario bloques -->
        <div class="glass-panel" style="padding: 20px; margin-bottom: 24px;">
          <h3 style="font-size:0.9rem; font-weight:600; margin-bottom:14px; text-transform:uppercase; font-family:var(--font-digital); color:var(--color-text-main);">
            ${editingItem && editingStore === 'yoga_blocks' ? 'Editar Bloque de Secuencia' : 'Crear Nuevo Bloque de Yoga'}
          </h3>
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
            <div style="border:1px solid rgba(46,43,40,0.08); padding:12px; border-radius:6px; margin: 6px 0;">
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
                  <input type="number" id="input-asana-hold" class="acu-input-flat" style="font-size:0.75rem; padding:4px;" min="10" value="120">
                </div>
                <button type="button" id="btn-add-asana-to-block" style="background:none; border:none; color:var(--color-text-main); font-size:0.7rem; cursor:pointer; font-weight:600;">[ AGREGAR ASANA ]</button>
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

        <!-- Listado de Bloques -->
        <div class="acu-points-tab-list" id="blocks-editor-list"></div>
      `;

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
          itemEl.style.cssText = 'display:flex; justify-content:space-between; align-items:center; font-size:0.78rem; padding:4px 8px; background:rgba(0,0,0,0.02); border-radius:3px;';
          itemEl.innerHTML = `
            <span>${index + 1}. <strong>${escapeHTML(name)}</strong> (${escapeHTML(bp.holdTime)}s)</span>
            <div style="display:flex; gap:8px;">
              <button type="button" class="btn-builder-up" style="background:none; border:none; cursor:pointer; color:var(--color-text-muted);" ${index === 0 ? 'disabled' : ''}>▲</button>
              <button type="button" class="btn-builder-down" style="background:none; border:none; cursor:pointer; color:var(--color-text-muted);" ${index === blockPosturesList.length - 1 ? 'disabled' : ''}>▼</button>
              <button type="button" class="btn-builder-remove" style="background:none; border:none; cursor:pointer; color:var(--color-accent-red); font-weight:600;">✕</button>
            </div>
          `;

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
        const holdTime = parseInt(subContentEl.querySelector('#input-asana-hold').value) || 120;

        if (asanaId) {
          blockPosturesList.push({ postureId: asanaId, holdTime });
          renderBlockBuilderPostures();
        }
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
      card.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div style="flex:1;">
            <span style="font-weight:600; font-size:0.88rem; color:var(--color-text-main);">${escapeHTML(p.name)}</span>
            <p style="font-size:0.75rem; color:var(--color-text-muted); margin:4px 0 8px 0; line-height:1.4;">${escapeHTML(p.description)}</p>
            <div style="font-family:var(--font-mono); font-size:0.7rem; color:var(--color-text-muted);">
              Estilo: ${escapeHTML(p.style)} | Duración recomendada: ${escapeHTML(p.duration)}s
            </div>
          </div>
          <div style="display:flex; flex-direction:column; align-items:flex-end; gap:8px;">
            <span style="font-family:var(--font-mono); font-size:0.65rem; color:var(--color-text-muted); text-transform:uppercase;">${escapeHTML(p.id)}</span>
            <div style="display:flex; gap:8px;">
              <button class="btn-edit-yp" style="background:none; border:none; color:var(--color-text-main); font-size:0.62rem; cursor:pointer;">[ EDITAR ]</button>
              <button class="btn-delete-yp" style="background:none; border:none; color:var(--color-accent-red); font-size:0.62rem; cursor:pointer;">[ BORRAR ]</button>
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
            <div style="display:flex; gap:8px;">
              <button class="btn-edit-yb" style="background:none; border:none; color:var(--color-text-main); font-size:0.62rem; cursor:pointer;">[ EDITAR ]</button>
              <button class="btn-delete-yb" style="background:none; border:none; color:var(--color-accent-red); font-size:0.62rem; cursor:pointer;">[ BORRAR ]</button>
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
      <div style="display: flex; gap: 8px; border-bottom: 1px solid rgba(46,43,40,0.06); padding-bottom: 8px; margin-bottom: 20px;">
        <button id="btn-sub-waves" class="btn-braun-tab ${activeSynthSubTab === 'brainwaves' ? 'active' : ''}" style="padding:4px 12px; font-size:0.75rem;">Ondas Cerebrales</button>
        <button id="btn-sub-solfeggio" class="btn-braun-tab ${activeSynthSubTab === 'solfeggio' ? 'active' : ''}" style="padding:4px 12px; font-size:0.75rem;">Tonos Base</button>
        <button id="btn-sub-modes" class="btn-braun-tab ${activeSynthSubTab === 'modes' ? 'active' : ''}" style="padding:4px 12px; font-size:0.75rem;">Modos de Modulación</button>
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
