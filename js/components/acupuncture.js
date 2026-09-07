import { getAllData, putData, deleteData, addData } from '../db.js';
import { renderDotMatrix } from '../utils/dotmatrix.js';
import { escapeAttribute, escapeHTML } from '../utils/sanitize.js';
import { renderTechnicalTitle } from './ui.js';
import { renderLobbyAction, renderLobbyShell } from './lobbyUi.js';
import {
  createWakeLockController,
  populateTimerDots,
  renderSynthPanel,
  bindSynthPanel
} from './timerShell.js';
import { createSynthEngine, playQuartzBowlRing } from '../utils/synth.js';
import { getFreqLabel, valueToFreq, freqToValue } from '../utils/freqUtils.js';
import { createAcupunctureTiming } from '../utils/acupunctureUtils.js';
import { createModuleResult } from '../utils/sessionResults.js';


/**
 * Componente modular para el módulo de acupuntura TENS con Electro Pen.
 * Maneja el Lobby, Constructor de Secuencias con formulario inline y el Timer Fullscreen.
 * 
 * @param {HTMLElement} container Contenedor principal de la SPA
 * @param {IDBDatabase} db Conexión a IndexedDB
 * @param {Function} onNavigate Navegación global
 * @param {Object} appController Enlace para controlar el sintonizador de sonido global
 */
export async function renderAcupunctureScreen(container, db, onNavigate, orchestratorConfig = null) {
  // Estado local del componente
  const synth = createSynthEngine();
  let catalogPoints = [];
  let sequences = [];
  let activeView = 'lobby'; // 'lobby', 'builder', 'timer'

  // Para edición/creación
  let currentSequence = null;
  let isEditing = false;

  // Para el temporizador activo
  let activeInterval = null;
  let gridAnimFrame = null;
  let phaseStartTime = 0;
  let phaseElapsedBeforePause = 0;
  let lastActiveDotsCount = -1;
  let lastStateType = '';
  let lastActiveColor = '';
  let activeSeqIndex = 0; // índice del paso actual
  let activeState = 'stimulating'; // 'stimulating' o 'transition'
  let activeTimeLeft = 0; // segundos restantes del estado actual
  let activeStepDuration = 0; // duración total del estado actual (para el porcentaje de la matriz)
  let isTimerPaused = false;
  let activeSessionDuration = 0;
  let elapsedSeconds = 0;
  const wakeLockController = createWakeLockController();

  // Frecuencia y modo local del temporizador (sincronizado con appController)
  let localFreq = 6.0;
  let localBaseFreq = 432;
  let localAudioMode = 'binaural';
  let localAudioActive = false;

  let activeMeridianTab = 'LI'; // Código OMS para Intestino Grueso (Hegu)
  let meridiansList = [];

  function initializeSequence(sequence) {
    currentSequence = sequence;
    activeSeqIndex = 0;
    activeState = 'stimulating';
    isTimerPaused = false;

    const timing = createAcupunctureTiming(sequence);
    activeSessionDuration = timing.activeSessionDuration;
    activeTimeLeft = timing.activeTimeLeft;
    activeStepDuration = timing.activeStepDuration;
    elapsedSeconds = 0;

    localBaseFreq = sequence.baseFreq || 432;
    localFreq = sequence.suggestedFreq || 6.0;
    localAudioMode = 'binaural';
    localAudioActive = false;
    phaseStartTime = Date.now();
    phaseElapsedBeforePause = 0;
    lastActiveDotsCount = -1;
    lastStateType = '';
    lastActiveColor = '';
  }



  // Cargar datos iniciales
  async function loadData() {
    try {
      catalogPoints = await getAllData(db, 'acupuncture_points');
      meridiansList = await getAllData(db, 'meridians');
      sequences = await getAllData(db, 'acupuncture_sequences');

      // Orden de circulación fisiológica tradicional de los meridianos
      const meridianOrderMap = {
        'LU': 1, 'LI': 2, 'ST': 3, 'SP': 4, 'HT': 5, 'SI': 6,
        'BL': 7, 'KI': 8, 'PC': 9, 'TE': 10, 'GB': 11, 'LR': 12,
        'CV': 13, 'GV': 14, 'EX': 15, 'AU': 16, 'MS': 17
      };
      meridiansList.sort((a, b) => (meridianOrderMap[a.id] || 99) - (meridianOrderMap[b.id] || 99));

      // Ordenar puntos alfabéticamente por nombre
      catalogPoints.sort((a, b) => a.name.localeCompare(b.name));
    } catch (err) {
      console.error('[Acupuncture] Error cargando datos de DB:', err);
    }
  }

  // Renderizar la pantalla según la vista activa
  async function refresh() {
    await loadData();
    container.innerHTML = '';

    // --- Integración con Orquestador ---
    if (orchestratorConfig && !currentSequence) {
      const seq = sequences.find(s => s.id === orchestratorConfig.presetId) || sequences[0];
      if (seq) {
        initializeSequence(seq);
        activeView = 'timer';
      }
    }

    if (activeView === 'lobby') {
      renderLobby();
    } else if (activeView === 'builder') {
      renderBuilder();
    } else if (activeView === 'timer') {
      renderTimer();
    }
  }

  // Helper para color de meridianos
  function getMeridianColor(meridian) {
    if (!meridian) return '#138D75'; // default muted cyan
    const m = meridian.toLowerCase();
    if (m.includes('estómago')) return '#E67E22'; // Orange
    if (m.includes('intestino grueso')) return '#2980B9'; // Steel Blue
    if (m.includes('pericardio')) return '#1ABC9C'; // Teal
    if (m.includes('hígado')) return '#27AE60'; // Forest Green
    if (m.includes('bazo')) return '#F1C40F'; // Golden Yellow
    if (m.includes('corazón')) return '#C0392B'; // Warm Red
    if (m.includes('vaso concepción')) return '#9B59B6'; // Soft Lavender
    if (m.includes('puntos extra') || m.includes('extra')) return '#34495E'; // Slate Indigo
    return '#34495E';
  }

  /* =============================================================
     VISTA 1: LOBBY PRINCIPAL (PRESETS & CATÁLOGO)
     ============================================================= */
  function renderLobby() {
    const staging = document.createElement('div');
    staging.innerHTML = renderLobbyShell({
      title: 'Acupuntura TENS',
      action: renderLobbyAction({ kind: 'text', label: '+ Crear Secuencia', id: 'btn-lobby-create' }),
      variant: 'list',
      className: 'acupuncture-lobby',
      content: `
        <span class="lobby-section-label">Sesiones y secuencias activas (auto-terapia)</span>
        <div class="practice-list" id="lobby-sequences-list"></div>`
    });
    const layout = staging.firstElementChild;
    container.appendChild(layout);

    // Eventos de Navegación
    layout.querySelector('#btn-back-home').addEventListener('click', () => {
      synth.destroy();
      onNavigate('inicio');
    });

    layout.querySelector('#btn-lobby-create').addEventListener('click', () => {
      isEditing = false;
      currentSequence = {
        id: 'custom-' + Date.now(),
        name: '',
        description: '',
        points: []
      };
      activeView = 'builder';
      refresh();
    });
    // --- RENDERIZAR SECUENCIAS (ACORDEÓN) ---
    const seqList = layout.querySelector('#lobby-sequences-list');
    seqList.innerHTML = '';

    if (sequences.length === 0) {
      seqList.innerHTML = '<p class="lobby-empty">No tienes secuencias guardadas. Crea una nueva secuencia arriba.</p>';
    } else {
      sequences.forEach(seq => {
        // Calcular tiempo total
        let totalSeconds = 0;
        seq.points.forEach(p => {
          totalSeconds += parseInt(p.duration || 0);
          totalSeconds += parseInt(p.transitionAfter || 0);
        });
        const totalMin = Math.ceil(totalSeconds / 60);

        const isCustom = seq.id.startsWith('custom-');

        const accordionItem = document.createElement('div');
        accordionItem.className = 'practice-row acupuncture-practice-row';

        accordionItem.innerHTML = `
          <div class="practice-row__summary" role="button" tabindex="0" aria-expanded="false">
            <div class="practice-row__lead">
              <span class="practice-row__indicator">▶</span>
              <span class="practice-row__title">${escapeHTML(seq.name)}</span>
            </div>
            <div class="practice-row__meta">
              <span class="practice-row__metadata">
                ${isCustom ? 'PERSONALIZADA' : 'PRESET'}
              </span>
              <span class="practice-row__duration">${totalMin} min</span>
              ${renderLobbyAction({ kind: 'icon', icon: 'play', label: 'Iniciar secuencia', className: 'btn-play-header' })}
            </div>
          </div>
          <div class="practice-row__details" style="display: none;">
            <div class="practice-row__description">${escapeHTML(seq.description || 'Secuencia técnica de electroterapia TENS.')}</div>
            
            <span class="practice-row__section-label">Puntos del protocolo</span>
            <div class="practice-timeline">
              ${seq.points.map((step, idx) => {
          const pointData = catalogPoints.find(p => p.id === step.pointId);
          if (!pointData) return '';

          // Formatear minutos y segundos
          const min = Math.floor(step.duration / 60);
          const sec = step.duration % 60;
          const durationLabel = min > 0
            ? `${min}m ${sec > 0 ? `${sec}s` : ''}`
            : `${sec}s`;

          return `
                  <div class="practice-timeline__item">
                    <span class="practice-timeline__index">${idx + 1}</span>
                    <div class="practice-timeline__body">
                      <span class="practice-timeline__title">${escapeHTML(pointData.name)} (${escapeHTML(pointData.code)}${pointData.traditional_code && pointData.traditional_code !== pointData.code ? ` / ${escapeHTML(pointData.traditional_code)}` : ''}) ${step.side ? `[Lado: ${escapeHTML(step.side)}]` : ''}</span>
                      <span class="practice-timeline__meta">${escapeHTML(durationLabel)} estímulo + ${escapeHTML(step.transitionAfter)}s transición (${escapeHTML(pointData.headType)})</span>
                    </div>
                  </div>
                `;
        }).join('')}
            </div>
            
            <div class="practice-row__actions">
              <div style="display: flex; gap: 12px;">
                ${renderLobbyAction({ kind: 'icon', icon: 'edit', label: 'Editar secuencia', className: 'btn-edit' })}
                ${renderLobbyAction({ kind: 'icon', icon: 'delete', label: 'Borrar secuencia', className: 'btn-delete' })}
              </div>
            </div>
          </div>
        `;

        const headerEl = accordionItem.querySelector('.practice-row__summary');
        const contentEl = accordionItem.querySelector('.practice-row__details');
        const playBtn = headerEl.querySelector('.btn-play-header');
        const toggleDetails = () => {
          const isExpanded = accordionItem.classList.toggle('expanded');
          accordionItem.classList.toggle('is-expanded', isExpanded);
          contentEl.style.display = isExpanded ? 'block' : 'none';
          headerEl.setAttribute('aria-expanded', String(isExpanded));
        };

        headerEl.addEventListener('click', (e) => {
          if (e.target.closest('button')) return;
          toggleDetails();
        });
        headerEl.addEventListener('keydown', (e) => {
          if (e.key !== 'Enter' && e.key !== ' ') return;
          e.preventDefault();
          toggleDetails();
        });

        playBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          startSession(seq);
        });

        contentEl.querySelector('.btn-edit').addEventListener('click', () => {
          isEditing = true;
          currentSequence = JSON.parse(JSON.stringify(seq));
          activeView = 'builder';
          refresh();
        });

        contentEl.querySelector('.btn-delete').addEventListener('click', async () => {
          if (confirm(`¿Seguro que deseas eliminar la secuencia "${seq.name}"?`)) {
            await deleteData(db, 'acupuncture_sequences', seq.id);
            refresh();
          }
        });

        seqList.appendChild(accordionItem);
      });
    }
  }

  /* =============================================================
     VISTA 2: CREADOR / EDITOR DE SECUENCIAS
     ============================================================= */
  function renderBuilder() {
    const layout = document.createElement('div');
    layout.className = 'dashboard-layout fade-in';

    layout.innerHTML = `
      <nav class="nav-bar">
        <div class="nav-logo dot-digital">M.</div>
        <ul class="nav-links">
          <li class="nav-item" id="btn-builder-back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Cancelar</span>
          </li>
        </ul>
      </nav>

      <main class="main-viewport">
        <div class="viewport-inner">
          <div class="acu-builder-container">
            <header class="acu-lobby-header">
              ${renderTechnicalTitle(isEditing ? 'Editar Secuencia' : 'Crear Secuencia')}
            </header>

            <div class="acu-builder-input-group">
              <label>Nombre del Protocolo</label>
              <input type="text" id="seq-name" class="acu-input-flat" placeholder="Ej. Alivio Tensión Mandíbula" value="${escapeAttribute(currentSequence?.name || '')}" required>
            </div>

            <div class="acu-builder-input-group">
              <label>Descripción / Objetivo</label>
              <input type="text" id="seq-desc" class="acu-input-flat" style="font-size: 0.9rem;" placeholder="Ej. Alivia la presión mandibular y del entrecejo causada por bruxismo." value="${escapeAttribute(currentSequence?.description || '')}">
            </div>

            <!-- Listado de Pasos Actuales -->
            <div>
              <h3 class="acu-steps-title">Pasos de la Secuencia</h3>
              <div class="acu-builder-steps" id="builder-steps-list" style="margin-bottom: 24px;">
                <!-- Se inyecta dinámicamente -->
              </div>
            </div>

            <!-- Panel para Añadir Pasos (Diseño plano sin rellenos toscos) -->
            <div class="acu-builder-add-step">
              <span class="acu-section-label" style="margin-bottom:8px;">Añadir Paso</span>
              <div class="acu-builder-add-controls" style="display:flex; flex-wrap: wrap; gap: 16px; align-items: flex-end; width:100%;">
                
                <!-- Selector de punto personalizado colapsable y agrupado con búsqueda -->
                <div style="flex: 2; min-width: 200px; display: flex; flex-direction: column; gap: 4px; position: relative;" id="custom-point-dropdown-wrapper">
                  <span style="font-size: 0.6rem; color: var(--color-text-muted); text-transform: uppercase;">Punto de Acupuntura</span>
                  <div id="custom-point-dropdown" class="custom-tuner-dropdown" style="position: relative; width: 100%;">
                    <button type="button" id="custom-point-dropdown-trigger" class="tuner-dropdown-trigger" style="width: 100%; border: 1px solid rgba(46,43,40,0.2); background: transparent; padding: 6px 12px; font-size: 0.85rem; text-align: left; display: flex; justify-content: space-between; align-items: center; cursor: pointer; color: var(--color-text-main);">
                      <span id="selected-point-label">Seleccionar punto...</span>
                      <svg class="dropdown-chevron" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="6 9 12 15 18 9"></polyline>
                      </svg>
                    </button>
                    <div id="custom-point-dropdown-options" class="tuner-dropdown-options glass-panel" style="position: absolute; top: 100%; left: 0; width: 100%; min-width: 280px; z-index: 150; max-height: 320px; overflow: hidden; display: none; padding: 12px; margin-top: 4px; border: 1px solid rgba(46,43,40,0.15); box-shadow: 0 8px 32px rgba(0,0,0,0.08);">
                      <input type="text" id="point-search-input" class="acu-form-input" placeholder="🔍 Buscar por nombre o código..." style="width: 100%; margin-bottom: 8px; font-size: 0.8rem; padding: 4px 0;">
                      <div id="point-groups-container" style="overflow-y: auto; max-height: 220px; display: flex; flex-direction: column; gap: 6px;">
                        <!-- Se inyecta dinámicamente -->
                      </div>
                    </div>
                  </div>
                </div>
                
                <!-- Lateralidad -->
                <div style="width: 100px; display: flex; flex-direction: column; gap: 4px;">
                  <span style="font-size: 0.6rem; color: var(--color-text-muted); text-transform: uppercase;">Lateralidad</span>
                  <select id="add-step-side-select" class="acu-select-flat" style="padding-right:24px;">
                    <option value="none">-</option>
                    <option value="Izquierda">Izquierda</option>
                    <option value="Derecha">Derecha</option>
                  </select>
                </div>
                
                <!-- Estímulo en Rango Deslizador Braun -->
                <div style="flex: 1; min-width: 130px; display: flex; flex-direction: column; gap: 4px;">
                  <div style="display: flex; justify-content: space-between; align-items: baseline;">
                    <span style="font-size: 0.6rem; color: var(--color-text-muted); text-transform: uppercase;">Estímulo</span>
                    <span id="add-step-duration-readout" style="font-family: var(--font-digital); font-size: 0.75rem; font-weight: 600; color: var(--color-accent-red);">02:00</span>
                  </div>
                  <input type="range" id="add-step-duration-slider" min="10" max="600" step="5" value="120" class="tuner-slider" style="margin: 6px 0;">
                </div>
                
                <!-- Transición en Rango Deslizador -->
                <div style="flex: 1; min-width: 100px; display: flex; flex-direction: column; gap: 4px;">
                  <div style="display: flex; justify-content: space-between; align-items: baseline;">
                    <span style="font-size: 0.6rem; color: var(--color-text-muted); text-transform: uppercase;">Transición</span>
                    <span id="add-step-transition-readout" style="font-family: var(--font-digital); font-size: 0.75rem; font-weight: 600; color: var(--color-text-main);">15s</span>
                  </div>
                  <input type="range" id="add-step-transition-slider" min="0" max="60" step="5" value="15" class="tuner-slider" style="margin: 6px 0;">
                </div>
                
                <!-- Botón de agregar paso plano y sin borde -->
                <button type="button" id="btn-add-step-trigger" style="border: none !important; background: transparent; cursor: pointer; font-family: var(--font-main); font-weight: 500; font-size: 0.82rem; padding: 8px 12px; color: var(--color-text-main); margin-bottom: 0;">
                  [ AGREGAR PASO ]
                </button>
              </div>

            </div>

            <!-- Botones Guardar y Salir -->
            <div style="display: flex; gap: 16px; justify-content: center; margin-top: 32px; width: 100%;">
              <button id="btn-builder-cancel" style="padding: 10px 20px; border: none !important; background: transparent; cursor: pointer; font-family: var(--font-main); font-weight: 500; font-size: 0.85rem; color: var(--color-text-main);">[ CANCELAR ]</button>
              <button id="btn-builder-save" style="padding: 10px 20px; border: none !important; background: transparent; cursor: pointer; font-family: var(--font-main); font-weight: 600; font-size: 0.85rem; color: var(--color-text-main);">[ GUARDAR SECUENCIA ]</button>
            </div>
          </div>
        </div>
      </main>
    `;

    container.appendChild(layout);

    const stepsListEl = layout.querySelector('#builder-steps-list');
    const sideSelect = layout.querySelector('#add-step-side-select');

    // Sliders de tiempo
    const durSlider = layout.querySelector('#add-step-duration-slider');
    const durReadout = layout.querySelector('#add-step-duration-readout');
    const transSlider = layout.querySelector('#add-step-transition-slider');
    const transReadout = layout.querySelector('#add-step-transition-readout');

    let selectedPointId = null;

    // Helper para formatear tiempo MM:SS
    function formatTimeMMSS(seconds) {
      const m = Math.floor(seconds / 60);
      const s = seconds % 60;
      return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    }

    // Reactividad de los sliders principales
    durSlider.addEventListener('input', () => {
      durReadout.textContent = formatTimeMMSS(parseInt(durSlider.value));
    });

    transSlider.addEventListener('input', () => {
      transReadout.textContent = `${transSlider.value}s`;
    });

    // Dropdown personalizado
    const dropdownTrigger = layout.querySelector('#custom-point-dropdown-trigger');
    const dropdownOptions = layout.querySelector('#custom-point-dropdown-options');
    const searchInput = layout.querySelector('#point-search-input');
    const groupsContainer = layout.querySelector('#point-groups-container');
    const selectedLabel = layout.querySelector('#selected-point-label');

    // Cerrar dropdown al hacer click afuera
    const onDocClick = (e) => {
      if (!e.target.closest('#custom-point-dropdown')) {
        dropdownOptions.style.display = 'none';
        dropdownTrigger.classList.remove('open');
      }
    };
    document.addEventListener('click', onDocClick);

    // Desvincular evento al salir del builder
    const cleanUpBuilderEvents = () => {
      document.removeEventListener('click', onDocClick);
    };

    dropdownTrigger.addEventListener('click', () => {
      const isVisible = dropdownOptions.style.display === 'block';
      dropdownOptions.style.display = isVisible ? 'none' : 'block';
      dropdownTrigger.classList.toggle('open', !isVisible);
      if (!isVisible) searchInput.focus();
    });

    // Poblado del dropdown
    function populateCustomDropdown() {
      groupsContainer.innerHTML = '';

      meridiansList.forEach(m => {
        const pointsInMeridian = catalogPoints.filter(p => p.meridian_id === m.id);
        if (pointsInMeridian.length === 0) return;

        const groupEl = document.createElement('div');
        groupEl.className = 'dropdown-meridian-group';
        groupEl.style.borderBottom = '1px solid rgba(46,43,40,0.05)';
        groupEl.style.padding = '4px 0';

        groupEl.innerHTML = `
          <div class="dropdown-group-header" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; padding:6px; font-family:var(--font-digital); font-size:0.75rem; text-transform:uppercase; color:var(--color-text-muted);">
            <span>${escapeHTML(m.name)}</span>
            <span class="group-arrow" style="font-size:0.6rem; transition:transform 0.2s;">▶</span>
          </div>
          <div class="dropdown-group-points" style="display:none; flex-direction:column; gap:4px; padding-left:12px;">
            ${pointsInMeridian.map(p => `
              <div class="dropdown-point-item" data-id="${escapeAttribute(p.id)}" style="padding:6px; font-size:0.78rem; cursor:pointer; color:var(--color-text-main); transition:all 0.15s; display:flex; justify-content:space-between; align-items:center;">
                <span>${escapeHTML(p.name)}</span>
                <span style="font-family:var(--font-digital); font-size:0.7rem; color:var(--color-accent-red); opacity:0.85;">
                  ${escapeHTML(p.code)}${p.traditional_code && p.traditional_code !== p.code ? ` / ${escapeHTML(p.traditional_code)}` : ''}
                </span>
              </div>
            `).join('')}
          </div>
        `;

        const headerEl = groupEl.querySelector('.dropdown-group-header');
        const pointsEl = groupEl.querySelector('.dropdown-group-points');
        const arrowEl = groupEl.querySelector('.group-arrow');

        headerEl.addEventListener('click', (e) => {
          e.stopPropagation();
          const isCollapsed = pointsEl.style.display === 'none';
          pointsEl.style.display = isCollapsed ? 'flex' : 'none';
          arrowEl.style.transform = isCollapsed ? 'rotate(90deg)' : 'none';
          arrowEl.style.color = isCollapsed ? 'var(--color-text-main)' : 'var(--color-text-muted)';
        });

        // Agregar click a los items
        groupEl.querySelectorAll('.dropdown-point-item').forEach(item => {
          item.addEventListener('click', (e) => {
            e.stopPropagation();
            const pid = item.getAttribute('data-id');
            selectPoint(pid);
          });
          item.addEventListener('mouseenter', () => {
            item.style.backgroundColor = 'rgba(46,43,40,0.04)';
          });
          item.addEventListener('mouseleave', () => {
            item.style.backgroundColor = 'transparent';
          });
        });

        groupsContainer.appendChild(groupEl);
      });
    }

    function selectPoint(pid) {
      const p = catalogPoints.find(item => item.id === pid);
      if (!p) return;

      selectedPointId = p.id;
      selectedLabel.textContent = `${p.name} (${p.code}${p.traditional_code && p.traditional_code !== p.code ? ` / ${p.traditional_code}` : ''})`;

      // Auto-cargar duración recomendada del punto en el slider
      durSlider.value = p.duration || 120;
      durReadout.textContent = formatTimeMMSS(p.duration || 120);

      // Cerrar dropdown
      dropdownOptions.style.display = 'none';
      dropdownTrigger.classList.remove('open');
    }

    // Inicializar dropdown
    populateCustomDropdown();

    // Seleccionar primer punto por defecto si existe
    if (catalogPoints.length > 0) {
      selectPoint(catalogPoints[0].id);
    }

    // Búsqueda en tiempo real
    searchInput.addEventListener('input', () => {
      const q = searchInput.value.toLowerCase().trim();
      const groups = groupsContainer.querySelectorAll('.dropdown-meridian-group');

      groups.forEach(group => {
        const pointsEl = group.querySelector('.dropdown-group-points');
        const arrowEl = group.querySelector('.group-arrow');
        const items = group.querySelectorAll('.dropdown-point-item');

        let visibleInGroup = 0;

        items.forEach(item => {
          const text = item.textContent.toLowerCase();
          if (text.includes(q)) {
            item.style.display = 'flex';
            visibleInGroup++;
          } else {
            item.style.display = 'none';
          }
        });

        if (visibleInGroup > 0) {
          group.style.display = 'block';
          if (q.length > 0) {
            // Auto expandir grupos con coincidencias
            pointsEl.style.display = 'flex';
            arrowEl.style.transform = 'rotate(90deg)';
          } else {
            // Contraer si se borró la búsqueda
            pointsEl.style.display = 'none';
            arrowEl.style.transform = 'none';
          }
        } else {
          group.style.display = 'none';
        }
      });
    });

    // Renderizar los pasos del builder (Diseño totalmente plano)
    function renderBuilderSteps() {
      stepsListEl.innerHTML = '';

      if (currentSequence.points.length === 0) {
        stepsListEl.innerHTML = `<p style="font-size: 0.75rem; color: var(--color-text-muted); text-align: center; padding: 16px; border: 1px dashed rgba(46, 43, 40, 0.08);">La secuencia no contiene pasos. Añade puntos del catálogo arriba.</p>`;
        return;
      }

      currentSequence.points.forEach((step, index) => {
        const pointData = catalogPoints.find(p => p.id === step.pointId);
        if (!pointData) return;

        const stepEl = document.createElement('div');
        stepEl.className = 'acu-builder-step';

        // Duración inicial formateada
        const initDurLabel = formatTimeMMSS(step.duration);
        const initTransLabel = `${step.transitionAfter}s`;

        stepEl.innerHTML = `
          <!-- Flechas de ordenación -->
          <div class="acu-step-order-btns">
            <button class="btn-step-order btn-move-up" ${index === 0 ? 'disabled style="opacity:0.2;"' : ''}>▲</button>
            <button class="btn-step-order btn-move-down" ${index === currentSequence.points.length - 1 ? 'disabled style="opacity:0.2;"' : ''}>▼</button>
          </div>

          <!-- Detalles del paso -->
          <div class="acu-step-details" style="display:flex; flex-wrap:wrap; gap:16px; width:100%; align-items:center;">
            <div style="flex:2; min-width:140px; display:flex; flex-direction:column; gap:2px;">
              <span class="acu-step-point-title" style="font-size:0.85rem; font-weight:600;">${escapeHTML(pointData.name)} (${escapeHTML(pointData.code)}${pointData.traditional_code && pointData.traditional_code !== pointData.code ? ` / ${escapeHTML(pointData.traditional_code)}` : ''})</span>
              <span style="font-size:0.6rem; color:var(--color-text-muted);">${escapeHTML(pointData.headType)}</span>
            </div>

            <!-- Cambio de lado directo -->
            <div class="acu-step-input-wrap" style="width:90px;">
              <span>Lado</span>
              <select class="acu-select-flat select-side-change" style="font-size:0.75rem; padding: 2px 20px 2px 0;">
                <option value="none" ${!step.side || step.side === 'none' ? 'selected' : ''}>-</option>
                <option value="Izquierda" ${step.side === 'Izquierda' ? 'selected' : ''}>Izquierda</option>
                <option value="Derecha" ${step.side === 'Derecha' ? 'selected' : ''}>Derecha</option>
              </select>
            </div>

            <!-- Slider Duración Estímulo -->
            <div class="acu-step-input-wrap" style="flex: 1.2; min-width: 120px;">
              <div style="display: flex; justify-content: space-between; align-items: baseline;">
                <span>Estímulo</span>
                <span class="step-duration-readout" style="font-family: var(--font-digital); font-size: 0.7rem; color: var(--color-accent-red); font-weight: 600;">${initDurLabel}</span>
              </div>
              <input type="range" class="step-duration-slider tuner-slider" min="10" max="600" step="5" value="${step.duration}" style="margin: 4px 0;">
            </div>

            <!-- Slider Transición -->
            <div class="acu-step-input-wrap" style="flex: 1; min-width: 100px;">
              <div style="display: flex; justify-content: space-between; align-items: baseline;">
                <span>Transición</span>
                <span class="step-transition-readout" style="font-family: var(--font-digital); font-size: 0.7rem; color: var(--color-text-main); font-weight: 600;">${initTransLabel}</span>
              </div>
              <input type="range" class="step-transition-slider tuner-slider" min="0" max="60" step="5" value="${step.transitionAfter}" style="margin: 4px 0;">
            </div>
          </div>

          <!-- Borrar paso (X simple sin bordes) -->
          <button class="btn-step-remove" title="Eliminar este paso" style="background:none; border:none; color:var(--color-text-muted); cursor:pointer; font-family:var(--font-digital); font-size:1rem; padding: 8px 12px; font-weight: 600; transition: color 0.2s;">
            ✕
          </button>
        `;

        // Listeners para este paso
        stepEl.querySelector('.btn-move-up').addEventListener('click', () => {
          if (index > 0) {
            const temp = currentSequence.points[index];
            currentSequence.points[index] = currentSequence.points[index - 1];
            currentSequence.points[index - 1] = temp;
            renderBuilderSteps();
          }
        });

        stepEl.querySelector('.btn-move-down').addEventListener('click', () => {
          if (index < currentSequence.points.length - 1) {
            const temp = currentSequence.points[index];
            currentSequence.points[index] = currentSequence.points[index + 1];
            currentSequence.points[index + 1] = temp;
            renderBuilderSteps();
          }
        });

        stepEl.querySelector('.select-side-change').addEventListener('change', (e) => {
          step.side = e.target.value === 'none' ? null : e.target.value;
        });

        const stepDurSlider = stepEl.querySelector('.step-duration-slider');
        const stepDurReadout = stepEl.querySelector('.step-duration-readout');
        stepDurSlider.addEventListener('input', () => {
          step.duration = parseInt(stepDurSlider.value);
          stepDurReadout.textContent = formatTimeMMSS(step.duration);
        });

        const stepTransSlider = stepEl.querySelector('.step-transition-slider');
        const stepTransReadout = stepEl.querySelector('.step-transition-readout');
        stepTransSlider.addEventListener('input', () => {
          step.transitionAfter = parseInt(stepTransSlider.value);
          stepTransReadout.textContent = `${step.transitionAfter}s`;
        });

        stepEl.querySelector('.btn-step-remove').addEventListener('click', () => {
          currentSequence.points.splice(index, 1);
          renderBuilderSteps();
        });

        stepsListEl.appendChild(stepEl);
      });
    }

    renderBuilderSteps();



    // Agregar paso
    layout.querySelector('#btn-add-step-trigger').addEventListener('click', () => {
      const pointId = selectedPointId;
      const side = sideSelect.value;
      const dur = parseInt(durSlider.value) || 120;
      const trans = parseInt(transSlider.value) || 15;

      if (!pointId) {
        alert('Por favor, selecciona un punto del catálogo.');
        return;
      }

      const pData = catalogPoints.find(p => p.id === pointId);
      if (!pData) return;

      currentSequence.points.push({
        pointId: pointId,
        duration: dur,
        transitionAfter: trans,
        side: side === 'none' ? null : side
      });

      renderBuilderSteps();
    });

    // Botones de salida del constructor
    const goBack = () => {
      cleanUpBuilderEvents();
      activeView = 'lobby';
      refresh();
    };

    layout.querySelector('#btn-builder-back').addEventListener('click', goBack);
    layout.querySelector('#btn-builder-cancel').addEventListener('click', goBack);

    // Guardar secuencia
    layout.querySelector('#btn-builder-save').addEventListener('click', async () => {
      const name = layout.querySelector('#seq-name').value.trim();
      const desc = layout.querySelector('#seq-desc').value.trim();
      
      if (!name) {
        alert('Por favor, indica un nombre para la secuencia.');
        return;
      }

      if (currentSequence.points.length === 0) {
        alert('Por favor, agrega al menos un paso a la secuencia antes de guardar.');
        return;
      }

      currentSequence.name = name;
      currentSequence.description = desc;
      currentSequence.suggestedFreq = currentSequence.suggestedFreq || 6.0; // por defecto Theta
      currentSequence.baseFreq = currentSequence.baseFreq || 432;

      try {
        await putData(db, 'acupuncture_sequences', currentSequence);
        cleanUpBuilderEvents();
        activeView = 'lobby';
        refresh();
      } catch (err) {
        console.error('Error guardando secuencia:', err);
        alert('Ocurrió un error al guardar la secuencia en IndexedDB.');
      }
    });
  }

  /* =============================================================
     VISTA 3: REPRODUCTOR / TIMER SESSIONS (PANTALLA COMPLETA)
     ============================================================= */
  function startSession(sequence) {
    initializeSequence(sequence);
    activeView = 'timer';
    refresh();
  }

  function renderTimer() {
    let isSessionStarted = false;
    const timerScreen = document.createElement('div');
    timerScreen.className = 'acu-timer-fullscreen fade-in';

    // Generar rejilla de puntos fullscreen y panel de control
    timerScreen.innerHTML = `
      <!-- Rejilla de fondo de 96x54 (5184 puntos) -->
      <div class="acu-fullscreen-bg grid-36" id="timer-dots-grid"></div>

      <!-- Contenedor flotante centrado verticalmente -->
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; width: 100%; z-index: 10; position: relative; pointer-events: none;">
        
        <!-- Reloj digital de matriz de puntos (5x7) -->
        <div id="timer-countdown-matrix" class="acu-timer-dot-display" style="margin-bottom: 24px; pointer-events: auto;"></div>
        
        <!-- Frame de información y controles (Difuminado y borderless) -->
        <div class="acu-timer-info-frame" id="timer-info-frame" style="pointer-events: auto;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div class="acu-state-badge stimulating" id="timer-state-badge">Estimulando</div>
            <div class="acu-panel-progress-steps" id="timer-step-progress" style="margin-bottom: 0;">Paso 1 de 4</div>
          </div>
          
          <div>
            <div style="display: flex; align-items: baseline; gap: 8px;">
              <h2 class="acu-panel-point-name" id="timer-point-name" style="margin-bottom:0; font-size:1.2rem;">Hegu</h2>
              <span class="acu-panel-point-code" id="timer-point-code" style="font-size: 1.05rem; font-family:var(--font-digital); color:var(--color-accent-red);">LI 4</span>
            </div>
            <div class="acu-panel-point-meridian" id="timer-point-meridian" style="margin-bottom: 8px; font-size: 0.72rem;">Intestino Grueso</div>
            <div>
              <span class="acu-panel-headtag" id="timer-point-head" style="margin-bottom: 12px; padding: 2px 6px; font-size: 0.65rem;">Cabezal: Esferoidal</span>
            </div>
          </div>
          
          <!-- Detalles de texto -->
          <div class="acu-panel-info-box" style="margin-bottom: 16px; background: none; padding: 8px 0; gap: 8px; border: none; border-top: 1px dashed rgba(46, 43, 40, 0.1);">
            <div>
              <div class="acu-panel-info-label">Ubicación</div>
              <div class="acu-panel-info-text" id="timer-point-location" style="font-size: 0.75rem;">Cargando...</div>
            </div>
            <div style="margin-top: 4px;">
              <div class="acu-panel-info-label">Beneficios</div>
              <div class="acu-panel-info-text" id="timer-point-benefits" style="font-size: 0.75rem;">Cargando...</div>
            </div>
          </div>
          
          <!-- Panel de Sintetizador Incrustado y Colapsable -->
          ${renderSynthPanel({
            idPrefix: 'timer',
            baseFreq: localBaseFreq,
            diffFreq: localFreq,
            audioMode: localAudioMode,
            isAudioActive: localAudioActive,
            compact: true,
            dark: true,
            statusWithWave: false
          })}
          
          <!-- Controles de Timer (Iniciar/Pausar, Saltar, Detener con Iconos SVG) -->
          <div class="timer-icon-controls">
            <div class="timer-icon-control-group">
              <button class="btn-acu-icon btn-acu-active" id="btn-timer-play" title="Iniciar sesion" style="width:48px; height:48px; display:flex; align-items:center; justify-content:center; pointer-events:auto; cursor:pointer;">
                <svg id="svg-play-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3"></polygon>
                </svg>
              </button>
              <span id="lbl-timer-flow">Iniciar</span>
            </div>

            <div class="timer-icon-control-group">
              <button class="btn-acu-icon" id="btn-timer-skip" title="Saltar paso" style="width:48px; height:48px; display:flex; align-items:center; justify-content:center; opacity:0.35; pointer-events:none; cursor:pointer;">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="4 3 13 12 4 21 4 3" fill="currentColor"></polygon>
                  <line x1="17" y1="4" x2="17" y2="20"></line>
                </svg>
              </button>
              <span>Saltar</span>
            </div>

            <div class="timer-icon-control-group">
              <button class="btn-acu-icon btn-acu-danger" id="btn-timer-exit" title="Detener sesion" style="width:48px; height:48px; display:flex; align-items:center; justify-content:center; pointer-events:auto; cursor:pointer;">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <rect x="5" y="5" width="14" height="14" rx="1"></rect>
                </svg>
              </button>
              <span>Detener</span>
            </div>
          </div>
        </div>
      </div>
    `;

    container.appendChild(timerScreen);

    // Inyectar rejilla de puntos densa 96x54 = 5184 puntos
    const dots = populateTimerDots(timerScreen.querySelector('#timer-dots-grid'), 5184);

    // Elementos del panel
    const stateBadge = timerScreen.querySelector('#timer-state-badge');
    const pointCode = timerScreen.querySelector('#timer-point-code');
    const pointName = timerScreen.querySelector('#timer-point-name');
    const pointMeridian = timerScreen.querySelector('#timer-point-meridian');
    const pointHead = timerScreen.querySelector('#timer-point-head');
    const pointLocation = timerScreen.querySelector('#timer-point-location');
    const pointBenefits = timerScreen.querySelector('#timer-point-benefits');
    const countdownMatrix = timerScreen.querySelector('#timer-countdown-matrix');
    const progressEl = timerScreen.querySelector('#timer-step-progress');
    const btnPlay = timerScreen.querySelector('#btn-timer-play');
    const btnSkip = timerScreen.querySelector('#btn-timer-skip');
    const btnExit = timerScreen.querySelector('#btn-timer-exit');
    const lblFlow = timerScreen.querySelector('#lbl-timer-flow');

    // Sincronizar el display del paso actual
    function syncTimerDisplay() {
      const step = currentSequence.points[activeSeqIndex];
      const point = catalogPoints.find(p => p.id === step.pointId);

      const isTransition = activeState === 'transition';

      if (isTransition) {
        stateBadge.textContent = 'Cambio de Punto';
        stateBadge.className = 'acu-state-badge transition';

        // Información del siguiente punto
        const nextIndex = activeSeqIndex + 1;
        const nextStep = currentSequence.points[nextIndex];
        const nextPoint = nextStep ? catalogPoints.find(p => p.id === nextStep.pointId) : null;

        pointCode.textContent = 'REP';
        pointName.textContent = 'Reposicionar Lápiz';
        pointMeridian.textContent = 'Transición y Cambio de Cabezal';

        if (nextPoint) {
          pointHead.textContent = `Siguiente Cabezal: ${nextPoint.headType}`;
          pointLocation.textContent = `Prepárate para colocar el electro-pen en el punto: ${nextPoint.name} (${nextPoint.code}${nextPoint.traditional_code && nextPoint.traditional_code !== nextPoint.code ? ` / ${nextPoint.traditional_code}` : ''}). Ubicado en: ${nextPoint.location}`;
          pointBenefits.textContent = `Limpia la zona y aplica gel conductor en la nueva ubicación. Configura la pluma al nivel 1.`;
        } else {
          pointHead.textContent = 'Finalizando';
          pointLocation.textContent = 'Última transición de relajación. Prepárate para apagar tu dispositivo.';
          pointBenefits.textContent = '';
        }
      } else {
        stateBadge.textContent = 'Estimulando';
        stateBadge.className = 'acu-state-badge stimulating';

        if (point) {
          pointCode.textContent = point.traditional_code && point.traditional_code !== point.code ? `${point.code} / ${point.traditional_code}` : point.code;
          pointName.textContent = `${point.name} ${step.side ? `(${step.side})` : ''}`;
          pointMeridian.textContent = point.meridian || 'Canal Energético';
          pointHead.textContent = `Cabezal Sugerido: ${point.headType}`;
          pointLocation.textContent = point.location;
          pointBenefits.textContent = point.benefits;
        }
      }

      // Progreso
      progressEl.textContent = `Paso ${activeSeqIndex + 1}/${currentSequence.points.length}`;

      // Audio frequency text label in tuner header and slider
      const headerStatus = timerScreen.querySelector('#tuner-header-status');
      const diffReadout = timerScreen.querySelector('#timer-diff-readout');
      const diffSlider = timerScreen.querySelector('#timer-diff-slider');
      if (headerStatus) {
        headerStatus.textContent = localAudioActive ? `${localFreq.toFixed(1)} Hz` : 'Off';
        headerStatus.style.color = localAudioActive ? 'var(--color-accent-green)' : 'var(--color-text-muted)';
      }
      if (diffReadout) {
        diffReadout.textContent = `${localFreq.toFixed(1)} Hz`;
      }
      if (diffSlider) {
        diffSlider.value = freqToValue(localFreq);
      }
    }

    // Actualización visual de la rejilla de puntos fullscreen (96x54 = 5184 puntos)
    function getCompletedSessionSeconds() {
      let seconds = 0;
      for (let i = 0; i < activeSeqIndex; i++) {
        const step = currentSequence.points[i];
        seconds += (parseInt(step.duration) || 0) + (parseInt(step.transitionAfter) || 0);
      }
      if (activeState === 'transition') {
        const currentStep = currentSequence.points[activeSeqIndex];
        seconds += parseInt(currentStep.duration) || 0;
      }
      return seconds;
    }

    function updateGrid(elapsed, duration, stateType) {
      const sessionElapsed = getCompletedSessionSeconds() + elapsed;
      const safeElapsed = (isNaN(sessionElapsed) || sessionElapsed < 0) ? 0 : sessionElapsed;
      const progressRatio = activeSessionDuration > 0 ? safeElapsed / activeSessionDuration : 0;
      const activeDotsCount = Math.min(5184, Math.floor(progressRatio * 5184));

      // Obtener el color del meridiano activo
      let activeColor = '#D35400'; // Transition color
      if (stateType === 'stimulating') {
        const step = currentSequence.points[activeSeqIndex];
        const point = catalogPoints.find(p => p.id === step.pointId);
        if (point) {
          activeColor = getMeridianColor(point.meridian);
        }
      }

      // Evitar actualizaciones de DOM si no hay cambios reales
      if (activeDotsCount === lastActiveDotsCount && stateType === lastStateType && activeColor === lastActiveColor) {
        return;
      }

      lastActiveDotsCount = activeDotsCount;
      lastStateType = stateType;
      lastActiveColor = activeColor;

      dots.forEach((dot, idx) => {
        if (idx < activeDotsCount) {
          dot.style.setProperty('--dot-color', activeColor);
          dot.style.setProperty('--dot-glow', activeColor);
          dot.classList.add('dot-on');
          if (stateType === 'stimulating') {
            dot.classList.add('active-stimulation');
            dot.classList.remove('active-transition');
          } else {
            dot.classList.add('active-transition');
            dot.classList.remove('active-stimulation');
          }
        } else {
          if (dot.classList.contains('dot-on')) {
            dot.style.removeProperty('--dot-color');
            dot.style.removeProperty('--dot-glow');
            dot.classList.remove('dot-on', 'active-stimulation', 'active-transition');
          }
        }
      });
    }

    // Formatear el contador digital usando dotmatrix.js
    function updateCountdownDisplay() {
      const mins = String(Math.floor(activeTimeLeft / 60)).padStart(2, '0');
      const secs = String(activeTimeLeft % 60).padStart(2, '0');
      const timeString = `${mins}:${secs}`;

      // Dibujar usando renderDotMatrix en el contenedor
      renderDotMatrix(countdownMatrix, timeString);
    }

    // Lógica del Reloj
    function tick() {
      if (isTimerPaused) return;

      activeTimeLeft--;
      elapsedSeconds++;
      updateCountdownDisplay();

      if (activeTimeLeft <= 0) {
        // Tocar campana tibetana corta al cambiar de fase
        playQuartzBowlRing();

        const step = currentSequence.points[activeSeqIndex];

        if (activeState === 'stimulating' && step.transitionAfter > 0 && activeSeqIndex < currentSequence.points.length - 1) {
          // Entrar en fase de transición
          activeState = 'transition';
          activeTimeLeft = step.transitionAfter;
          activeStepDuration = step.transitionAfter;
          phaseStartTime = Date.now();
          phaseElapsedBeforePause = 0;
          syncTimerDisplay();
          updateCountdownDisplay();
        } else {
          // Ir al siguiente paso o terminar
          activeSeqIndex++;
          if (activeSeqIndex >= currentSequence.points.length) {
            // Completado con éxito
            finishSequence();
          } else {
            // Cargar siguiente punto
            const nextStep = currentSequence.points[activeSeqIndex];
            activeState = 'stimulating';
            activeTimeLeft = nextStep.duration;
            activeStepDuration = nextStep.duration;
            phaseStartTime = Date.now();
            phaseElapsedBeforePause = 0;
            syncTimerDisplay();
            updateCountdownDisplay();
          }
        }
      }
    }

    const cleanupTimer = async () => {
      if (activeInterval) {
        clearInterval(activeInterval);
        activeInterval = null;
      }
      if (gridAnimFrame) {
        cancelAnimationFrame(gridAnimFrame);
        gridAnimFrame = null;
      }
      synth.stop();
      await wakeLockController.release();
    };

    const finishSequence = async () => {
      await cleanupTimer();
      const result = createModuleResult('acupuncture', elapsedSeconds, {
        sequenceId: currentSequence.id,
        sequenceName: currentSequence.name
      });

      if (!orchestratorConfig) {
        try {
          await addData(db, 'sessions_log', {
            type: 'acupuncture',
            date: new Date().toISOString(),
            duration: Math.max(1, Math.round(elapsedSeconds / 60)),
            activeDurationSeconds: elapsedSeconds,
            notes: `Secuencia: ${currentSequence.name}`,
            details: 'Digitopuntura Hegu'
          });
        } catch (e) {
          console.error('[DB] Error logging session:', e);
        }
      }

      if (orchestratorConfig) {
        orchestratorConfig.onComplete(result);
      } else {
        alert('¡Secuencia de Electroterapia TENS completada con éxito!');
        activeView = 'lobby';
        synth.destroy();
        refresh();
      }
    };

    const requestWakeLock = () => wakeLockController.request();
    const releaseWakeLock = () => wakeLockController.release();

    // Obtener tiempo transcurrido exacto en milisegundos
    function getElapsedMs() {
      if (!isSessionStarted) return 0;
      if (isTimerPaused) {
        return phaseElapsedBeforePause;
      }
      return phaseElapsedBeforePause + (Date.now() - phaseStartTime);
    }

    function animationLoop() {
      if (activeView !== 'timer' || !isSessionStarted) return;
      const elapsedMs = getElapsedMs();
      const elapsedSec = elapsedMs / 1000;
      const clampedElapsedSec = Math.min(elapsedSec, activeStepDuration);
      updateGrid(clampedElapsedSec, activeStepDuration, activeState);
      gridAnimFrame = requestAnimationFrame(animationLoop);
    }

    function startTimerLoop() {
      if (isSessionStarted) return;
      isSessionStarted = true;
      isTimerPaused = false;
      phaseStartTime = Date.now();
      phaseElapsedBeforePause = 0;
      btnSkip.style.opacity = '1';
      btnSkip.style.pointerEvents = 'auto';
      if (lblFlow) lblFlow.textContent = 'Pausar';
      btnPlay.title = 'Pausar sesion';
      btnPlay.innerHTML = `
        <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
          <rect x="6" y="4" width="3" height="16" rx="1"></rect>
          <rect x="15" y="4" width="3" height="16" rx="1"></rect>
        </svg>
      `;
      requestWakeLock();
      activeInterval = setInterval(tick, 1000);
      gridAnimFrame = requestAnimationFrame(animationLoop);
    }

    syncTimerDisplay();
    updateCountdownDisplay();
    // Vincular panel del sintetizador
    const getSynthState = () => ({
      baseFreq: localBaseFreq,
      diffFreq: localFreq,
      audioMode: localAudioMode,
      isAudioActive: localAudioActive
    });
    const setSynthState = (update) => {
      if (update.baseFreq !== undefined) localBaseFreq = update.baseFreq;
      if (update.diffFreq !== undefined) localFreq = update.diffFreq;
      if (update.audioMode !== undefined) localAudioMode = update.audioMode;
      if (update.isAudioActive !== undefined) localAudioActive = update.isAudioActive;
    };

    bindSynthPanel({
      root: timerScreen,
      idPrefix: 'timer',
      getState: getSynthState,
      setState: setSynthState,
      synthEngine: synth
    });

    // Control de Pause / Play (Toggles SVG Icon)
    btnPlay.addEventListener('click', () => {
      if (!isSessionStarted) {
        startTimerLoop();
        return;
      }
      isTimerPaused = !isTimerPaused;
      if (isTimerPaused) {
        // Pausar y congelar el tiempo acumulado de la etapa activa
        phaseElapsedBeforePause += Date.now() - phaseStartTime;
        btnPlay.classList.remove('btn-acu-active');
        if (lblFlow) lblFlow.textContent = 'Reanudar';
        btnPlay.innerHTML = `
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        `;
        btnPlay.title = 'Reanudar sesión';
      } else {
        // Reanudar e iniciar un nuevo intervalo relativo de tiempo
        phaseStartTime = Date.now();
        btnPlay.classList.add('btn-acu-active');
        if (lblFlow) lblFlow.textContent = 'Pausar';
        btnPlay.innerHTML = `
          <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
            <rect x="6" y="4" width="3" height="16" rx="1"></rect>
            <rect x="15" y="4" width="3" height="16" rx="1"></rect>
          </svg>
        `;
        btnPlay.title = 'Pausar sesión';
      }
    });

    // Saltar paso
    btnSkip.addEventListener('click', () => {
      if (!isSessionStarted) return;
      activeTimeLeft = 0;
      tick();
    });

    // Salir voluntariamente (Pausar primero, preguntar y volver a inicio sin guardar)
    btnExit.addEventListener('click', async () => {
      if (!isSessionStarted) {
        if (orchestratorConfig) {
          onNavigate('inicio');
        } else {
          activeView = 'lobby';
          refresh();
        }
        return;
      }
      const wasPaused = isTimerPaused;
      if (!isTimerPaused) {
        btnPlay.click();
      }

      if (confirm('¿Deseas detener y cancelar la sesión actual? (NO se guardará en el historial)')) {
        await cleanupTimer();
        synth.destroy();
        if (orchestratorConfig) {
          onNavigate('inicio');
        } else {
          activeView = 'lobby';
          refresh();
        }
      } else {
        if (!wasPaused) {
          btnPlay.click();
        }
      }
    });

  }

  // Carga inicial y primera pantalla
  await refresh();
}
