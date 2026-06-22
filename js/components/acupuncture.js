import { getAllData, putData, deleteData, addData } from '../db.js';
import { renderDotMatrix } from '../utils/dotmatrix.js';
import { escapeAttribute, escapeHTML } from '../utils/sanitize.js';
import {
  bindWakeLockPreference,
  createWakeLockController,
  populateTimerDots
} from './timerShell.js';

/**
 * Componente modular para el módulo de acupuntura TENS con Electro Pen.
 * Maneja el Lobby, Constructor de Secuencias con formulario inline y el Timer Fullscreen.
 * 
 * @param {HTMLElement} container Contenedor principal de la SPA
 * @param {IDBDatabase} db Conexión a IndexedDB
 * @param {Function} onNavigate Navegación global
 * @param {Object} appController Enlace para controlar el sintonizador de sonido global
 */
export async function renderAcupunctureScreen(container, db, onNavigate, appController) {
  // Estado local del componente
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
  const wakeLockController = createWakeLockController();

  // Frecuencia y modo local del temporizador (sincronizado con appController)
  let localFreq = 6.0;
  let localBaseFreq = 432;
  let localAudioMode = 'binaural';
  let localAudioActive = false;

  let activeMeridianTab = 'LI'; // Código OMS para Intestino Grueso (Hegu)
  let meridiansList = [];

  const FREQ_DESCRIPTIONS = {
    174: '174 Hz — Alivio del dolor',
    285: '285 Hz — Regeneración de tejidos',
    396: '396 Hz — Liberar miedo y culpa',
    417: '417 Hz — Facilitar el cambio',
    432: '432 Hz — Calma y armonía natural',
    528: '528 Hz — Transformación y milagro',
    639: '639 Hz — Conexión y relaciones',
    741: '741 Hz — Despertar de la intuición',
    852: '852 Hz — Retorno al orden espiritual',
    963: '963 Hz — Conexión universal / Unidad'
  };

  function getFreqLabel(freq) {
    const freqNum = parseFloat(freq);
    for (const key of Object.keys(FREQ_DESCRIPTIONS)) {
      if (Math.abs(parseFloat(key) - freqNum) < 0.05) {
        return FREQ_DESCRIPTIONS[key];
      }
    }
    const displayVal = freqNum % 1 === 0 ? freqNum.toFixed(0) : freqNum.toFixed(1);
    return `${displayVal} Hz`;
  }

  function valueToFreq(v) {
    if (v <= 25) {
      return 0.5 + (v / 25) * 3.5;
    } else if (v <= 50) {
      return 4.0 + ((v - 25) / 25) * 4.0;
    } else if (v <= 75) {
      return 8.0 + ((v - 50) / 25) * 4.0;
    } else {
      return 12.0 + ((v - 75) / 25) * 18.0;
    }
  }

  function freqToValue(f) {
    if (f <= 4.0) {
      return ((f - 0.5) / 3.5) * 25;
    } else if (f <= 8.0) {
      return 25 + ((f - 4.0) / 4.0) * 25;
    } else if (f <= 12.0) {
      return 50 + ((f - 8.0) / 4.0) * 25;
    } else {
      return 75 + ((f - 12.0) / 18.0) * 25;
    }
  }

  function getWaveStateName(freq) {
    if (freq <= 4.0) return 'DELTA';
    if (freq <= 8.0) return 'THETA';
    if (freq <= 12.0) return 'ALPHA';
    return 'BETA';
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

    if (activeView === 'lobby') {
      renderLobby();
    } else if (activeView === 'builder') {
      renderBuilder();
    } else if (activeView === 'timer') {
      renderTimer();
    }
  }

  // Cierra el sintonizador global flotante si está abierto
  function closeGlobalTuner() {
    const overlay = document.getElementById('sound-tuner-overlay');
    if (overlay) {
      overlay.classList.remove('visible');
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
        <div class="glass-panel" style="max-width: 480px; width: 100%; padding: 24px; box-sizing: border-box; margin-bottom: 40px;">
          
          <header style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
            <h2 class="module-lobby-title" style="margin: 0;">ACUPUNTURA TENS</h2>
            
            <button class="btn-braun-create" id="btn-lobby-create">
              <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"></line>
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
              <span>Crear Secuencia</span>
            </button>
          </header>

          <!-- 1. Sección de Secuencias (Presets / Accordion) -->
          <section class="acu-sequences-section">
            <span class="acu-section-label">Sesiones y Secuencias Activas (Auto-Terapia)</span>
            <div class="acu-sequence-list" id="lobby-sequences-list"></div>
          </section>

          <!-- Opción de pantalla encendida / ahorro de batería -->
          <div style="margin: 32px 0 12px; display: flex; align-items: center; justify-content: space-between; font-size: 0.68rem; color: var(--color-text-muted); font-family: var(--font-digital); border-top: 1px dashed rgba(46, 43, 40, 0.08); padding-top: 20px; width: 100%;">
            <span>MANTENER PANTALLA ACTIVA</span>
            <label class="braun-switch" style="margin: 0;">
              <input type="checkbox" id="pref-wakelock-switch" ${localStorage.getItem('meridiano_wakelock') !== 'false' ? 'checked' : ''}>
              <span class="braun-switch-slider"></span>
            </label>
          </div>
        </div>
      </main>
    `;

    container.appendChild(layout);

    // Guardar preferencia de Wake Lock
    bindWakeLockPreference(layout);

    // Eventos de Navegación
    layout.querySelector('#btn-back-home').addEventListener('click', () => {
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
      seqList.innerHTML = `<p style="font-size: 0.8rem; color: var(--color-text-muted); padding: 16px 0;">No tienes secuencias guardadas. Crea una nueva secuencia arriba.</p>`;
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
        accordionItem.className = 'acu-accordion-item';

        accordionItem.innerHTML = `
          <div class="acu-accordion-header" style="pointer-events: auto;">
            <div class="acu-accordion-header-left">
              <span class="acu-accordion-indicator-arrow">▶</span>
              <span class="acu-seq-name" style="font-weight: 500; font-size: 0.95rem;">${escapeHTML(seq.name)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 12px; pointer-events: auto;">
              <span style="font-family: var(--font-digital); font-size: 0.65rem; color: var(--color-text-muted); letter-spacing:0.05em;">
                ${isCustom ? 'PERSONALIZADA' : 'PRESET'}
              </span>
              <span class="acu-seq-duration-badge">${totalMin} min</span>
              
              <!-- Botón Play en la Cabecera (Más estilizado y arriba a la derecha) -->
              <button class="btn-play-header" title="Iniciar Secuencia">
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" style="color: var(--color-text-main); margin-left: 1px;">
                  <polygon points="6 4 19 12 6 20 6 4"></polygon>
                </svg>
              </button>
            </div>
          </div>
          <div class="acu-accordion-content" style="display: none;">
            <div class="acu-seq-desc" style="margin-bottom: 12px; font-size: 0.78rem; line-height: 1.4; color: var(--color-text-muted);">${escapeHTML(seq.description || 'Secuencia técnica de electroterapia TENS.')}</div>
            
            <span class="acu-section-label" style="margin-bottom: 8px; font-size: 0.65rem;">Puntos del Protocolo</span>
            <div class="acu-points-timeline">
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
                  <div class="acu-timeline-point">
                    <span class="acu-timeline-point-number">${idx + 1}</span>
                    <div class="acu-timeline-point-details">
                      <span class="acu-timeline-point-name" style="font-size:0.8rem; font-weight:600;">${escapeHTML(pointData.name)} (${escapeHTML(pointData.code)}) ${step.side ? `[Lado: ${escapeHTML(step.side)}]` : ''}</span>
                      <span class="acu-timeline-point-times" style="font-size:0.7rem; color:var(--color-text-muted);">${escapeHTML(durationLabel)} estímulo + ${escapeHTML(step.transitionAfter)}s transición (${escapeHTML(pointData.headType)})</span>
                    </div>
                  </div>
                `;
        }).join('')}
            </div>
            
            <div class="acu-accordion-actions" style="justify-content: flex-end;">
              <div style="display: flex; gap: 12px;">
                ${isCustom ? `
                  <button class="acu-seq-action btn-edit" style="border: none !important;">[ EDITAR ]</button>
                  <button class="acu-seq-action btn-delete" style="color: var(--color-accent-red); border: none !important;">[ BORRAR ]</button>
                ` : `
                  <button class="acu-seq-action btn-edit" style="border: none !important; display: flex; align-items: center; gap: 4px;">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" style="display: inline-block;">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                    </svg>
                    <span>[ COPIAR Y EDITAR ]</span>
                  </button>
                `}
              </div>
            </div>
          </div>
        `;

        const headerEl = accordionItem.querySelector('.acu-accordion-header');
        const contentEl = accordionItem.querySelector('.acu-accordion-content');
        const playBtn = headerEl.querySelector('.btn-play-header');

        headerEl.addEventListener('click', (e) => {
          // No expandir si hace click en el botón de play
          if (e.target.closest('.btn-play-header')) return;
          const isExpanded = accordionItem.classList.toggle('expanded');
          contentEl.style.display = isExpanded ? 'block' : 'none';
        });

        playBtn.addEventListener('click', (e) => {
          e.stopPropagation(); // Evitar expandir acordeón
          startSession(seq);
        });

        contentEl.querySelector('.btn-edit').addEventListener('click', () => {
          isEditing = true;
          currentSequence = JSON.parse(JSON.stringify(seq));

          // Si es un preset predefinido, lo duplicamos como personalizado para que el usuario pueda guardarlo sin pisar el original
          if (!isCustom) {
            currentSequence.id = 'custom-' + Date.now();
            currentSequence.name = currentSequence.name + ' (Copia)';
          }

          activeView = 'builder';
          refresh();
        });

        if (isCustom) {
          contentEl.querySelector('.btn-delete').addEventListener('click', async () => {
            if (confirm(`¿Seguro que deseas eliminar la secuencia "${seq.name}"?`)) {
              await deleteData(db, 'acupuncture_sequences', seq.id);
              refresh();
            }
          });
        }

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
              <h2 class="acu-lobby-title">${isEditing ? 'Editar Secuencia' : 'Crear Secuencia'}</h2>
            </header>

            <!-- Nombre de la Secuencia -->
            <div class="acu-builder-input-group">
              <label>Nombre del Protocolo</label>
              <input type="text" id="seq-name" class="acu-input-flat" placeholder="Ej. Alivio Tensión Mandíbula" value="${escapeAttribute(currentSequence.name || '')}" required>
            </div>

            <div class="acu-builder-input-group">
              <label>Descripción / Objetivo</label>
              <input type="text" id="seq-desc" class="acu-input-flat" style="font-size: 0.9rem;" placeholder="Ej. Alivia la presión mandibular y del entrecejo causada por bruxismo.">
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

              <!-- Trigger formulario inline plano y sin borde -->
              <button type="button" class="acu-inline-form-trigger" id="btn-toggle-inline-form" style="margin-top:16px; align-self: flex-start; border: none !important; background: transparent; cursor: pointer; font-family: var(--font-main); font-weight: 500; font-size: 0.8rem; padding: 6px 12px; color: var(--color-text-muted);">
                [ NUEVO PUNTO EN CATÁLOGO ]
              </button>

              <!-- Formulario de punto personalizado inline (oculto por defecto) -->
              <div class="acu-inline-form" id="inline-point-form" style="display: none;">
                <div class="acu-form-row">
                  <div class="acu-form-group">
                    <label>Nombre del Punto</label>
                    <input type="text" id="form-point-name" class="acu-form-input" placeholder="Ej. Fengchi">
                  </div>
                  <div class="acu-form-group">
                    <label>Código MTC Internacional</label>
                    <input type="text" id="form-point-code" class="acu-form-input" placeholder="Ej. GB 20">
                  </div>
                </div>
                <div class="acu-form-row">
                  <div class="acu-form-group">
                    <label>Canal / Meridiano</label>
                    <select id="form-point-meridian" class="acu-select-flat" style="font-size: 0.8rem; padding: 2px 0;">
                      <option value="Intestino Grueso">Intestino Grueso</option>
                      <option value="Estómago">Estómago</option>
                      <option value="Bazo">Bazo</option>
                      <option value="Corazón">Corazón</option>
                      <option value="Pericardio">Pericardio</option>
                      <option value="Vesícula Biliar">Vesícula Biliar</option>
                      <option value="Hígado">Hígado</option>
                      <option value="Vaso Concepción">Vaso Concepción</option>
                      <option value="Vaso Gobernador (Du Mai)">Vaso Gobernador (Du Mai)</option>
                    </select>
                  </div>
                  <div class="acu-form-group">
                    <label>Cabezal Recomendado</label>
                    <select id="form-point-head" class="acu-select-flat" style="font-size: 0.8rem; padding: 2px 0;">
                      <option value="Esferoidal">Esferoidal (Punta de bolígrafo)</option>
                      <option value="Nodo">Nodo (Domo / Plano)</option>
                      <option value="Rodillo">Rodillo (Barrido)</option>
                      <option value="Precisión">Precisión (Punta de metal desnudo)</option>
                      <option value="Espátula">Espátula (Gua Sha)</option>
                    </select>
                  </div>
                </div>
                <div class="acu-form-group">
                  <label>Ubicación Anatomómica</label>
                  <input type="text" id="form-point-location" class="acu-form-input" placeholder="Ej. En la base del cráneo, en la depresión posterior...">
                </div>
                <div class="acu-form-group">
                  <label>Beneficios Principales</label>
                  <input type="text" id="form-point-benefits" class="acu-form-input" placeholder="Ej. Libera tensión cervical, disipa cefaleas de estrés.">
                </div>
                <div class="acu-form-row">
                  <div class="acu-form-group">
                    <label>Tiempo Estándar (Segundos)</label>
                    <input type="number" id="form-point-duration" class="acu-form-input" value="120" min="10">
                  </div>
                  <div style="display: flex; align-items: flex-end; justify-content: flex-end;">
                    <button type="button" id="btn-save-inline-point" style="border: none !important; background: transparent; cursor: pointer; font-family: var(--font-main); font-weight: 500; font-size: 0.75rem; padding: 6px 12px; color: var(--color-text-main);">[ GUARDAR Y SELECCIONAR ]</button>
                  </div>
                </div>
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
    const inlineForm = layout.querySelector('#inline-point-form');

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
                <span style="font-family:var(--font-digital); font-size:0.7rem; color:var(--color-accent-red); opacity:0.85;">${escapeHTML(p.code)}</span>
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
      selectedLabel.textContent = `${p.name} (${p.code})`;

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
              <span class="acu-step-point-title" style="font-size:0.85rem; font-weight:600;">${escapeHTML(pointData.name)} (${escapeHTML(pointData.code)})</span>
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

    // Toggle inline form
    layout.querySelector('#btn-toggle-inline-form').addEventListener('click', () => {
      const isVisible = inlineForm.style.display !== 'none';
      inlineForm.style.display = isVisible ? 'none' : 'flex';
    });

    // Guardar punto personalizado inline
    layout.querySelector('#btn-save-inline-point').addEventListener('click', async () => {
      const nameIn = layout.querySelector('#form-point-name').value.trim();
      const codeIn = layout.querySelector('#form-point-code').value.trim();
      const meridianIn = layout.querySelector('#form-point-meridian').value;
      const headIn = layout.querySelector('#form-point-head').value;
      const locationIn = layout.querySelector('#form-point-location').value.trim();
      const benefitsIn = layout.querySelector('#form-point-benefits').value.trim();
      const durationIn = Math.max(10, parseInt(layout.querySelector('#form-point-duration').value) || 120);

      if (!nameIn || !codeIn || !locationIn) {
        alert('Por favor, rellena los campos básicos: Nombre, Código y Ubicación.');
        return;
      }

      const newPointId = 'point-' + Date.now();
      const matchedMeridian = meridiansList.find(m => m.name === meridianIn || m.id === meridianIn);
      const meridianIdVal = matchedMeridian ? matchedMeridian.id : 'EX';

      const newPointObj = {
        id: newPointId,
        name: nameIn,
        code: codeIn,
        meridian_id: meridianIdVal,
        meridian: meridianIn,
        headType: headIn,
        location: locationIn,
        benefits: benefitsIn || 'Estimulación técnica con TENS.',
        duration: durationIn,
        custom: true
      };

      try {
        await addData(db, 'acupuncture_points', newPointObj);

        // Actualizar catálogo local
        await loadData();

        // Repoblar el select y seleccionar el nuevo punto
        populateCustomDropdown();
        selectPoint(newPointId);

        // Limpiar inputs del formulario
        layout.querySelector('#form-point-name').value = '';
        layout.querySelector('#form-point-code').value = '';
        layout.querySelector('#form-point-location').value = '';
        layout.querySelector('#form-point-benefits').value = '';

        // Esconder formulario
        inlineForm.style.display = 'none';
        alert(`Punto "${nameIn}" añadido al catálogo correctamente.`);
      } catch (err) {
        console.error('Error al guardar punto:', err);
        alert('Error al guardar el punto personalizado.');
      }
    });

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
    currentSequence = sequence;
    activeSeqIndex = 0;
    activeState = 'stimulating';
    isTimerPaused = false;
    activeSessionDuration = currentSequence.points.reduce((sum, p) => {
      return sum + (parseInt(p.duration) || 0) + (parseInt(p.transitionAfter) || 0);
    }, 0);

    // Obtener parámetros iniciales del sintonizador o sugeridos
    const tunerState = appController.getAudioState();
    localBaseFreq = currentSequence.baseFreq || tunerState.baseFreq || 432;
    localFreq = currentSequence.suggestedFreq || tunerState.diffFreq || 6.0;
    localAudioMode = tunerState.audioMode || 'binaural';
    localAudioActive = false; // empezamos silenciado por cortesía, pero sugerido al lado

    // Cargar la duración del primer paso
    const firstStep = currentSequence.points[0];
    activeTimeLeft = firstStep.duration;
    activeStepDuration = firstStep.duration;

    phaseStartTime = Date.now();
    phaseElapsedBeforePause = 0;
    lastActiveDotsCount = -1;
    lastStateType = '';
    lastActiveColor = '';

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
          <div class="acu-tuner-accordion" id="meditation-tuner-panel" style="margin-bottom: 20px; width: 100%;">
            <div class="tuner-accordion-header" style="display:flex; justify-content:space-between; align-items:center; cursor:pointer; padding:8px 12px; background:rgba(46,43,40,0.04); border:1px solid rgba(46,43,40,0.08); border-radius:4px;">
              <div style="display:flex; align-items:center; gap:8px;">
                <span class="tuner-arrow" style="font-size:0.65rem; transition: transform 0.2s; display:inline-block;">▶</span>
                <span style="font-family: var(--font-digital); font-size: 0.7rem; font-weight:600; color:var(--color-text-main); text-transform: uppercase; letter-spacing:0.05em;">Sintetizador</span>
              </div>
              <div style="display:flex; align-items:center; gap:12px;" id="tuner-header-right">
                <span id="tuner-header-status" style="font-family: var(--font-digital); font-size: 0.72rem; font-weight:600; color:var(--color-text-muted); margin-right:4px;">Off</span>
                <!-- Switch de audio (detiene el click propagation para no colapsar/expandir) -->
                <label class="braun-switch" style="pointer-events: auto; margin:0;" onclick="event.stopPropagation();">
                  <input type="checkbox" id="timer-audio-switch" ${localAudioActive ? 'checked' : ''}>
                  <span class="braun-switch-slider"></span>
                </label>
              </div>
            </div>
            
            <div id="tuner-accordion-content" style="display:none; padding:16px 12px; border: 1px solid rgba(46,43,40,0.08); border-top:none; background:rgba(255,255,255,0.25); backdrop-filter:blur(8px); -webkit-backdrop-filter:blur(8px); border-bottom-left-radius:4px; border-bottom-right-radius:4px; flex-direction:column; gap:14px; width:100%;">
              <!-- Modo de Onda -->
              <div>
                <span style="font-size: 0.6rem; color: var(--color-text-muted); display:block; margin-bottom:4px; text-transform:uppercase; font-weight:600;">Modo de Onda</span>
                <div style="display: flex; gap: 16px; font-size: 0.75rem;">
                  <label style="cursor: pointer; display: flex; align-items: center; gap: 6px;">
                    <input type="radio" name="timer-audio-mode" value="binaural" ${localAudioMode === 'binaural' ? 'checked' : ''} style="accent-color: var(--color-accent-red);">
                    Binaural
                  </label>
                  <label style="cursor: pointer; display: flex; align-items: center; gap: 6px;">
                    <input type="radio" name="timer-audio-mode" value="isochronic" ${localAudioMode === 'isochronic' ? 'checked' : ''} style="accent-color: var(--color-accent-red);">
                    Isocrónico
                  </label>
                </div>
              </div>

              <!-- Tono Base -->
              <div style="position: relative;">
                <span style="font-size: 0.6rem; color: var(--color-text-muted); display:block; margin-bottom:4px; text-transform:uppercase; font-weight:600;">Tono Base (Frecuencia)</span>
                <div class="custom-tuner-dropdown" id="timer-base-dropdown-container" style="position:relative; width:100%; margin-bottom:6px;">
                  <button type="button" class="tuner-dropdown-trigger" id="timer-base-dropdown-trigger" style="width:100%; text-align:left; display:flex; justify-content:space-between; align-items:center; padding:6px 10px; font-size:0.75rem; background:transparent; border:1px solid rgba(0,0,0,0.12); cursor:pointer; color:var(--color-text-main);">
                    <span id="timer-base-selected-text">${getFreqLabel(localBaseFreq)}</span>
                    <svg class="dropdown-chevron" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                      <polyline points="6 9 12 15 18 9"></polyline>
                    </svg>
                  </button>
                  <div class="tuner-dropdown-options" id="timer-base-dropdown-options" style="position:absolute; bottom:100%; left:0; width:100%; max-height:160px; overflow-y:auto; z-index:1100; display:none; background:var(--color-bg-base); border:1px solid rgba(0,0,0,0.15); box-shadow:0 -4px 16px rgba(0,0,0,0.12); padding:4px 0; border-radius:4px;">
                    <div class="timer-dropdown-option" data-value="7.83" style="padding:6px 10px; font-size:0.75rem; cursor:pointer;"><strong>7.83 Hz</strong> — Resonancia Schumann</div>
                    <div class="timer-dropdown-option" data-value="174" style="padding:6px 10px; font-size:0.75rem; cursor:pointer;"><strong>174 Hz</strong> — Alivio del dolor</div>
                    <div class="timer-dropdown-option" data-value="285" style="padding:6px 10px; font-size:0.75rem; cursor:pointer;"><strong>285 Hz</strong> — Regeneración de tejidos</div>
                    <div class="timer-dropdown-option" data-value="396" style="padding:6px 10px; font-size:0.75rem; cursor:pointer;"><strong>396 Hz</strong> — Liberar miedo y culpa</div>
                    <div class="timer-dropdown-option" data-value="417" style="padding:6px 10px; font-size:0.75rem; cursor:pointer;"><strong>417 Hz</strong> — Facilitar el cambio</div>
                    <div class="timer-dropdown-option" data-value="432" style="padding:6px 10px; font-size:0.75rem; cursor:pointer;"><strong>432 Hz</strong> — Calma y armonía natural</div>
                    <div class="timer-dropdown-option" data-value="528" style="padding:6px 10px; font-size:0.75rem; cursor:pointer;"><strong>528 Hz</strong> — Transformación y milagro</div>
                    <div class="timer-dropdown-option" data-value="639" style="padding:6px 10px; font-size:0.75rem; cursor:pointer;"><strong>639 Hz</strong> — Conexión y relaciones</div>
                    <div class="timer-dropdown-option" data-value="741" style="padding:6px 10px; font-size:0.75rem; cursor:pointer;"><strong>741 Hz</strong> — Desintoxicación (Limpieza)</div>
                    <div class="timer-dropdown-option" data-value="852" style="padding:6px 10px; font-size:0.75rem; cursor:pointer;"><strong>852 Hz</strong> — Despertar de la intuición</div>
                    <div class="timer-dropdown-option" data-value="963" style="padding:6px 10px; font-size:0.75rem; cursor:pointer;"><strong>963 Hz</strong> — Conexión universal / Unidad</div>
                  </div>
                </div>
                <input type="range" id="timer-base-slider" class="tuner-slider" min="5" max="1000" step="0.1" value="${localBaseFreq}">
              </div>

              <!-- Estado Cerebral / Diferencial -->
              <div>
                <div style="display:flex; justify-content:space-between; align-items:baseline; margin-bottom:4px;">
                  <span style="font-size: 0.6rem; color: var(--color-text-muted); text-transform:uppercase; font-weight:600;">Estado Cerebral</span>
                  <span id="timer-diff-readout" style="font-family: var(--font-digital); font-size: 0.75rem; font-weight:600; color:var(--color-accent-red);">${localFreq.toFixed(1)} Hz</span>
                </div>
                <input type="range" id="timer-diff-slider" class="tuner-slider" min="0" max="100" step="1" value="${freqToValue(localFreq)}">
                <div style="display: flex; justify-content: space-between; font-size: 0.55rem; color: var(--color-text-muted); margin-top: 4px;">
                  <span>DELTA (Sueño)</span>
                  <span>THETA</span>
                  <span>ALPHA</span>
                  <span>BETA</span>
                </div>
              </div>
            </div>
          </div>
          
          <!-- Controles de Timer (Iniciar/Pausar, Saltar, Detener con Iconos SVG) -->
          <div class="acu-panel-controls" style="gap: 24px;">
            <button class="btn-acu-icon btn-acu-active" id="btn-timer-play" title="Iniciar sesion" style="width:38px; height:38px;">
              <svg id="svg-play-icon" viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
            </button>

            <button class="btn-acu-icon" id="btn-timer-skip" title="Saltar paso" style="width:38px; height:38px; opacity:0.35; pointer-events:none;">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polygon points="4 3 13 12 4 21 4 3" fill="currentColor"></polygon>
                <line x1="17" y1="4" x2="17" y2="20"></line>
              </svg>
            </button>

            <button class="btn-acu-icon btn-acu-danger" id="btn-timer-exit" title="Detener sesion" style="width:38px; height:38px;">
              <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                <rect x="5" y="5" width="14" height="14" rx="1"></rect>
              </svg>
            </button>
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
    const audioSwitch = timerScreen.querySelector('#timer-audio-switch');
    const btnPlay = timerScreen.querySelector('#btn-timer-play');
    const btnSkip = timerScreen.querySelector('#btn-timer-skip');
    const btnExit = timerScreen.querySelector('#btn-timer-exit');

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
          pointLocation.textContent = `Prepárate para colocar el electro-pen en el punto: ${nextPoint.name} (${nextPoint.code}). Ubicado en: ${nextPoint.location}`;
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
          pointCode.textContent = point.code;
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
      updateCountdownDisplay();

      if (activeTimeLeft <= 0) {
        // Tocar campana tibetana corta al cambiar de fase
        appController.playCompletionBell();

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
            stopTimerLoop();
            finishSession();
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

    function stopTimerLoop() {
      if (activeInterval) {
        clearInterval(activeInterval);
        activeInterval = null;
      }
      if (gridAnimFrame) {
        cancelAnimationFrame(gridAnimFrame);
        gridAnimFrame = null;
      }
      releaseWakeLock();
      // Silenciar sintetizador al salir del temporizador
      if (localAudioActive) {
        appController.stopAudio();
      }
      // Cerrar tuner flotante
      closeGlobalTuner();
    }

    // Guardar sesión y salir
    async function finishSession() {
      // Calcular duración total
      let totalSeconds = 0;
      currentSequence.points.forEach(p => {
        totalSeconds += parseInt(p.duration);
        totalSeconds += parseInt(p.transitionAfter || 0);
      });
      const totalMin = Math.ceil(totalSeconds / 60);

      // Guardar log en IndexedDB
      if (appController.saveSession) {
        await appController.saveSession(totalMin, `Secuencia: ${currentSequence.name}`);
      }

      alert('¡Secuencia de Electroterapia TENS completada con éxito!');
      activeView = 'lobby';
      refresh();
    }

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
      btnPlay.title = 'Pausar sesion';
      btnPlay.innerHTML = `
        <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
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
    const headerStatus = timerScreen.querySelector('#tuner-header-status');

    const syncTunerHeaderStatus = () => {
      if (localAudioActive) {
        headerStatus.textContent = `${localFreq.toFixed(1)} Hz`;
        headerStatus.style.color = 'var(--color-accent-green)';
      } else {
        headerStatus.textContent = 'Off';
        headerStatus.style.color = 'var(--color-text-muted)';
      }
    };

    // Controles de audio interactivos en pantalla (Sintetizador Empotrado)
    audioSwitch.addEventListener('change', (e) => {
      localAudioActive = e.target.checked;
      if (localAudioActive) {
        appController.startAudio(localBaseFreq, localFreq, localAudioMode);
      } else {
        appController.stopAudio();
      }
      syncTunerHeaderStatus();
    });

    // Accordion toggle
    const tunerHeader = timerScreen.querySelector('.tuner-accordion-header');
    const tunerContent = timerScreen.querySelector('#tuner-accordion-content');
    const tunerArrow = timerScreen.querySelector('.tuner-arrow');

    tunerHeader.addEventListener('click', (e) => {
      if (e.target.closest('.braun-switch')) return;
      const isVisible = tunerContent.style.display === 'flex';
      tunerContent.style.display = isVisible ? 'none' : 'flex';
      tunerArrow.style.transform = isVisible ? 'none' : 'rotate(90deg)';
    });

    // Radio buttons for mode (timer-audio-mode)
    const modeRadios = timerScreen.querySelectorAll('input[name="timer-audio-mode"]');
    modeRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        localAudioMode = e.target.value;
        if (localAudioActive) {
          appController.startAudio(localBaseFreq, localFreq, localAudioMode);
        }
      });
    });

    // Base slider and dropdown controls
    const baseSlider = timerScreen.querySelector('#timer-base-slider');
    const baseTrigger = timerScreen.querySelector('#timer-base-dropdown-trigger');
    const baseOptionsContainer = timerScreen.querySelector('#timer-base-dropdown-options');
    const baseOptions = timerScreen.querySelectorAll('.timer-dropdown-option');
    const baseSelectedText = timerScreen.querySelector('#timer-base-selected-text');

    baseTrigger.addEventListener('click', (e) => {
      e.stopPropagation();
      const isVisible = baseOptionsContainer.style.display === 'block';
      baseOptionsContainer.style.display = isVisible ? 'none' : 'block';
      baseTrigger.classList.toggle('open', !isVisible);
    });

    document.addEventListener('click', (e) => {
      if (baseOptionsContainer && !e.target.closest('#timer-base-dropdown-container')) {
        baseOptionsContainer.style.display = 'none';
        baseTrigger.classList.remove('open');
      }
    });

    baseOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        localBaseFreq = parseFloat(opt.getAttribute('data-value'));
        baseSlider.value = localBaseFreq;
        baseSelectedText.textContent = getFreqLabel(localBaseFreq);
        if (localAudioActive) {
          appController.updateAudioFreqs(localBaseFreq, localFreq);
        }
        baseOptionsContainer.style.display = 'none';
        baseTrigger.classList.remove('open');

        baseOptions.forEach(o => {
          if (parseFloat(o.getAttribute('data-value')) === localBaseFreq) o.classList.add('active');
          else o.classList.remove('active');
        });
      });
    });

    baseSlider.addEventListener('input', () => {
      localBaseFreq = parseFloat(baseSlider.value);
      baseSelectedText.textContent = getFreqLabel(localBaseFreq);
      if (localAudioActive) {
        appController.updateAudioFreqs(localBaseFreq, localFreq);
      }
      baseOptions.forEach(o => {
        const val = parseFloat(o.getAttribute('data-value'));
        if (Math.abs(val - localBaseFreq) < 0.05) o.classList.add('active');
        else o.classList.remove('active');
      });
    });

    // Diff/cerebral slider and readout (Mapeo no lineal corregido)
    const diffSlider = timerScreen.querySelector('#timer-diff-slider');
    const diffReadout = timerScreen.querySelector('#timer-diff-readout');

    diffSlider.addEventListener('input', () => {
      const val = parseInt(diffSlider.value);
      localFreq = valueToFreq(val);

      diffReadout.textContent = `${localFreq.toFixed(1)} Hz`;
      syncTunerHeaderStatus();

      if (localAudioActive) {
        appController.updateAudioFreqs(localBaseFreq, localFreq);
      }
    });

    // Sincronizar estado inicial
    syncTunerHeaderStatus();

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
        btnPlay.innerHTML = `
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        `;
        btnPlay.title = 'Reanudar sesión';
      } else {
        // Reanudar e iniciar un nuevo intervalo relativo de tiempo
        phaseStartTime = Date.now();
        btnPlay.classList.add('btn-acu-active');
        btnPlay.innerHTML = `
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
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
    btnExit.addEventListener('click', () => {
      if (!isSessionStarted) {
        activeView = 'lobby';
        refresh();
        return;
      }
      const wasPaused = isTimerPaused;
      if (!isTimerPaused) {
        btnPlay.click();
      }

      if (confirm('¿Deseas detener y cancelar la sesión actual? (NO se guardará en el historial)')) {
        stopTimerLoop();
        onNavigate('inicio');
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
