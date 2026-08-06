import { addData } from '../db.js';
import { renderDotMatrix } from '../utils/dotmatrix.js';
import { escapeHTML } from '../utils/sanitize.js';
import {
  bindWakeLockPreference,
  createWakeLockController,
  populateTimerDots,
  renderSynthPanel,
  bindSynthPanel,
  renderWakeLockPreference
} from './timerShell.js';
import { createSynthEngine, playQuartzBowlRing } from '../utils/synth.js';
import { startResolvedYogaSequence } from '../utils/yogaUtils.js';
import { createModuleResult } from '../utils/sessionResults.js';
import { getFreqLabel, valueToFreq, freqToValue } from '../utils/freqUtils.js';
import { renderTechnicalTitle } from './ui.js';
import { renderLobbyAction, renderLobbyShell } from './lobbyUi.js';
import { renderTechniqueDetails } from './techniqueDetails.js';

// Datos estáticos de respaldo por si falla la base de datos o está vacía
const FALLBACK_POSTURES = [
  { id: 'yin-butterfly', name: 'Mariposa (Baddha Konasana)' },
  { id: 'yin-sphinx', name: 'Esfinge (Salamba Bhujangasana)' },
  { id: 'yin-caterpillar', name: 'Oruga (Paschimottanasana)' },
  { id: 'yin-seal', name: 'Foca (Variación de Esfinge)' },
  { id: 'yin-child', name: 'Niño (Balasana)' }
];

const FALLBACK_BLOCKS = [
  {
    id: 'block-sun-salute-yin',
    name: 'Transición de la Tierra (Mini-bloque)',
    postures: [
      { postureId: 'yin-child', holdTime: 60 },
      { postureId: 'yin-sphinx', holdTime: 90 },
      { postureId: 'yin-child', holdTime: 60 }
    ]
  }
];

const FALLBACK_SEQUENCES = [
  {
    id: 'seq-yin-deep-release',
    name: 'Liberación Profunda de Tensión',
    description: 'Una sesión de Yin Yoga enfocada en caderas y columna lumbar.',
    items: [
      { type: 'posture', id: 'yin-butterfly', customHoldTime: 180 },
      { type: 'block', id: 'block-sun-salute-yin' },
      { type: 'posture', id: 'yin-caterpillar', customHoldTime: 240 }
    ]
  }
];

/**
 * Componente modular para Yin Yoga.
 * Constructor y editor de secuencias, intervalos de rebote,
 * aviso sonoro de asimetría, visualización gigante a distancia y
 * panel integrado de sintonización de sonido.
 * 
 * @param {HTMLElement} container Contenedor de montaje
 * @param {IDBDatabase} db Conexión a IndexedDB
 * @param {Function} onNavigate Función para navegar
 * @param {Object} appController Enlace para interactuar con el sintetizador global
 */
export async function renderYogaScreen(container, db, onNavigate, orchestratorConfig = null) {
  const synth = createSynthEngine();
  let activeView = 'lobby'; // 'lobby', 'editor' o 'timer'

  // Catálogos cargados de la base de datos
  let posturesCatalog = [];
  let blocksCatalog = [];
  let sequencesCatalog = [];

  // Secuencia cargada activa en el editor
  let currentSequenceItems = [];
  let sequenceName = 'Secuencia Personalizada';
  let sequenceId = 'seq-custom-temp';
  let reboundTime = 60; // en segundos (1 min)
  let savasanaTime = 300; // en segundos (5 min, configurable)

  // Parámetros de Audio Local
  let localFreq = 6.0;
  let localBaseFreq = 432;
  let localAudioMode = 'binaural';
  let localAudioActive = false;

  // Estado del Temporizador Activo
  let timerInterval = null;
  let activePhases = []; // Lista expandida de fases a ejecutar
  let currentPhaseIdx = 0;
  let timeLeft = 0; // tiempo restante en la fase actual (segundos)
  let phaseDuration = 0; // duración total de la fase actual (segundos)
  let elapsedSeconds = 0; // tiempo transcurrido total de la sesión (segundos)
  let totalSessionSeconds = 0; // duración total de la sesión (segundos)
  let isPaused = false;
  const wakeLockController = createWakeLockController();
  let chimePlayedForCurrentPhase = false; // evitar repetición de chime a la mitad


  // Helper para leer almacenes de IndexedDB
  function getStoreData(storeName) {
    return new Promise((resolve) => {
      if (!db) return resolve([]);
      try {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch (err) {
        console.warn(`[Yoga DB] Error en transacción readonly ${storeName}:`, err);
        resolve([]);
      }
    });
  }

  // Helper para guardar una secuencia personalizada en IndexedDB
  function saveSequenceToStore(seq) {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error('Base de datos no disponible'));
      try {
        const tx = db.transaction('yoga_sequences', 'readwrite');
        const store = tx.objectStore('yoga_sequences');
        const req = store.put(seq);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  // Helper para borrar secuencia de IndexedDB
  function deleteSequenceFromStore(id) {
    return new Promise((resolve, reject) => {
      if (!db) return reject(new Error('Base de datos no disponible'));
      try {
        const tx = db.transaction('yoga_sequences', 'readwrite');
        const store = tx.objectStore('yoga_sequences');
        const req = store.delete(id);
        req.onsuccess = () => resolve();
        req.onerror = () => reject(req.error);
      } catch (err) {
        reject(err);
      }
    });
  }

  // Inicializar catálogos
  async function loadData() {
    posturesCatalog = await getStoreData('yoga_postures');
    if (posturesCatalog.length === 0) posturesCatalog = FALLBACK_POSTURES;

    blocksCatalog = await getStoreData('yoga_blocks');
    if (blocksCatalog.length === 0) blocksCatalog = FALLBACK_BLOCKS;

    sequencesCatalog = await getStoreData('yoga_sequences');
    if (sequencesCatalog.length === 0) sequencesCatalog = FALLBACK_SEQUENCES;
  }

  // Carga una secuencia en el constructor/editor
  function loadSequence(seq) {
    if (!seq) return;
    sequenceId = seq.id || `seq-custom-${Date.now()}`;
    sequenceName = seq.name || 'Nueva Secuencia';
    currentSequenceItems = [];

    // Cargar tiempos y parámetros
    reboundTime = seq.reboundTime !== undefined ? seq.reboundTime : 60;
    savasanaTime = seq.savasanaTime !== undefined ? seq.savasanaTime : 300;

    if (Array.isArray(seq.items)) {
      seq.items.forEach(item => {
        if (item.type === 'posture') {
          const post = posturesCatalog.find(p => p.id === item.id);
          if (post) {
            currentSequenceItems.push({
              type: 'posture',
              id: post.id,
              name: post.name,
              holdTime: Number(item.customHoldTime) || 180,
              isAsymmetric: item.isAsymmetric || false
            });
          }
        } else if (item.type === 'block') {
          const blk = blocksCatalog.find(b => b.id === item.id);
          if (blk) {
            currentSequenceItems.push({
              type: 'block',
              id: blk.id,
              name: blk.name,
              postures: blk.postures.map(bp => {
                const subPost = posturesCatalog.find(p => p.id === bp.postureId);
                return {
                  id: bp.postureId,
                  name: subPost ? subPost.name : 'Postura',
                  holdTime: bp.holdTime
                };
              })
            });
          }
        }
      });
    }
    calculateTotalDuration();
  }

  // Recalcular duración total teórica de la sesión
  function calculateTotalDuration() {
    let secs = 0;
    const itemsCount = currentSequenceItems.length;

    currentSequenceItems.forEach((item, idx) => {
      if (item.type === 'posture') {
        secs += item.holdTime;
      } else if (item.type === 'block') {
        item.postures.forEach(bp => {
          secs += bp.holdTime;
        });
      }

      // Añadir rebote tras cada elemento principal (excepto el último)
      if (idx < itemsCount - 1) {
        secs += reboundTime;
      }
    });

    secs += savasanaTime; // Savasana final configurable (si es 0, no añade tiempo)
    totalSessionSeconds = secs;
  }

  // Formatear segundos a texto legible
  function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    if (mins > 0) {
      return `${mins} min ${secs > 0 ? secs + ' seg' : ''}`;
    }
    return `${secs} seg`;
  }

  // Calcular la duración total de una secuencia de IndexedDB
  function getSequenceDuration(seq) {
    let secs = 0;
    const items = seq.items || [];
    const rTime = seq.reboundTime !== undefined ? seq.reboundTime : 60;
    const sTime = seq.savasanaTime !== undefined ? seq.savasanaTime : 300;

    items.forEach((item, idx) => {
      if (item.type === 'posture') {
        secs += Number(item.customHoldTime) || 180;
      } else if (item.type === 'block') {
        const blk = blocksCatalog.find(b => b.id === item.id);
        if (blk) {
          blk.postures.forEach(bp => {
            secs += bp.holdTime;
          });
        }
      }

      if (idx < items.length - 1) {
        secs += rTime;
      }
    });

    secs += sTime;
    return Math.ceil(secs / 60);
  }

  // Lanzar timbre de aviso asimetría (880 Hz)
  function playSideAlertChime() {
    try {
      const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = tempCtx.createOscillator();
      const gainNode = tempCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, tempCtx.currentTime);

      gainNode.gain.setValueAtTime(0.0001, tempCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.12, tempCtx.currentTime + 0.05);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, tempCtx.currentTime + 1.2);

      osc.connect(gainNode);
      gainNode.connect(tempCtx.destination);

      osc.start();
      osc.stop(tempCtx.currentTime + 1.3);
    } catch (e) {
      console.warn('[Audio] Error al generar timbre de cambio de lado:', e);
    }
  }

  // Lanzar sesión activa con una secuencia dada
  function startSequence(seq) {
    // Cargar la secuencia primero
    loadSequence(seq);

    // Expandir fases
    activePhases = [];
    const itemsCount = currentSequenceItems.length;

    currentSequenceItems.forEach((item, idx) => {
      if (item.type === 'posture') {
        const posture = posturesCatalog.find(p => p.id === item.id);
        activePhases.push({
          type: 'posture',
          name: item.name,
          duration: item.holdTime,
          isAsymmetric: item.isAsymmetric,
          focus: posture?.focus || '',
          preparation: posture?.preparation || '',
          execution: posture?.execution || '',
          description: posture?.description || ''
        });
      } else if (item.type === 'block') {
        item.postures.forEach(bp => {
          const posture = posturesCatalog.find(p => p.id === bp.id);
          activePhases.push({
            type: 'posture',
            name: `${bp.name} (${item.name})`,
            duration: bp.holdTime,
            isAsymmetric: false,
            focus: posture?.focus || '',
            preparation: posture?.preparation || '',
            execution: posture?.execution || '',
            description: posture?.description || ''
          });
        });
      }

      if (idx < itemsCount - 1) {
        activePhases.push({
          type: 'rebound',
          name: 'Rebote de Transición',
          duration: reboundTime,
          isAsymmetric: false,
          description: 'Momento de quietud para asimilar el estiramiento y observar las sensaciones corporales.'
        });
      }
    });

    if (savasanaTime > 0) {
      activePhases.push({
        type: 'savasana',
        name: 'Savasana Final',
        duration: savasanaTime,
        isAsymmetric: false,
        description: 'Relajación profunda. Suelta todo el control del cuerpo y de la respiración.'
      });
    }

    // Verificar si la secuencia expandida tiene fases
    if (activePhases.length === 0) {
      alert('Esta secuencia no tiene posturas o fases válidas y no puede iniciarse.');
      return;
    }

    currentPhaseIdx = 0;
    timeLeft = activePhases[currentPhaseIdx].duration;
    phaseDuration = timeLeft;
    elapsedSeconds = 0;
    isPaused = false;
    chimePlayedForCurrentPhase = false;

    // Encender audio si está sintonizado
    if (localAudioActive) {
      synth.start(localBaseFreq, localFreq, localAudioMode);
    }

    activeView = 'timer';
    render();
  }

  // Alternar Vistas
  const render = () => {
    container.innerHTML = '';
    if (activeView === 'lobby') {
      renderLobby();
    } else if (activeView === 'editor') {
      renderEditor();
    } else {
      renderTimer();
    }
  };

  /* =============================================================
     VISTA 1: LOBBY SELECTOR DE SECUENCIAS (ESTILO ACUPUNTURA)
     ============================================================= */
  function renderLobby() {
    const staging = document.createElement('div');
    staging.innerHTML = renderLobbyShell({
      title: 'Yin Yoga',
      action: renderLobbyAction({ kind: 'text', label: '+ Crear Secuencia', id: 'btn-lobby-create' }),
      variant: 'list',
      className: 'yoga-lobby',
      content: `
        <span class="lobby-section-label">Secuencias y prácticas</span>
        <div class="practice-list" id="lobby-sequences-list"></div>`,
      footer: renderWakeLockPreference()
    });
    const lobbyEl = staging.firstElementChild;

    container.appendChild(lobbyEl);

    // Renderizar la lista de secuencias tipo Acordeón
    const seqListContainer = lobbyEl.querySelector('#lobby-sequences-list');
    seqListContainer.innerHTML = '';

    if (sequencesCatalog.length === 0) {
      seqListContainer.innerHTML = '<p class="lobby-empty">No hay secuencias disponibles.</p>';
    }

    sequencesCatalog.forEach(seq => {
      const isCustom = seq.id.startsWith('seq-custom-') || seq.id.startsWith('custom-');
      const totalMin = getSequenceDuration(seq);

      const accordionItem = document.createElement('div');
      accordionItem.className = 'practice-row yoga-practice-row';

      accordionItem.innerHTML = `
        <div class="practice-row__summary" role="button" tabindex="0" aria-expanded="false">
          <div class="practice-row__lead">
            <span class="practice-row__indicator">▶</span>
            <div class="practice-row__title-stack yoga-seq-title-stack">
              <span class="practice-row__title">${escapeHTML(seq.name)}</span>
              <span class="practice-row__kind yoga-seq-kind">${isCustom ? 'PERSONALIZADA' : 'PRESET'}</span>
            </div>
          </div>
          <div class="practice-row__meta">
            <span class="practice-row__duration">${totalMin} min</span>
            ${renderLobbyAction({ kind: 'icon', icon: 'play', label: 'Iniciar secuencia', className: 'btn-play-header' })}
          </div>
        </div>
        <div class="practice-row__details" style="display: none;">
          <div class="practice-row__description">${escapeHTML(seq.description || 'Práctica suave de Yin Yoga.')}</div>
          
          <span class="practice-row__section-label">Asanas de la sesión</span>
          <div class="practice-timeline">
            ${seq.items.map((item, idx) => {
              if (item.type === 'posture') {
                const post = posturesCatalog.find(p => p.id === item.id);
                const hold = Number(item.customHoldTime) || 180;
                return `
                  <div class="practice-timeline__item">
                    <span class="practice-timeline__index">${idx + 1}</span>
                    <div class="practice-timeline__body">
                      <span class="practice-timeline__title">${escapeHTML(post ? post.name : 'Postura')} ${item.isAsymmetric ? '[Asimétrica]' : ''}</span>
                      <span class="practice-timeline__meta">${Math.floor(hold / 60)}m ${hold % 60 > 0 ? (hold % 60) + 's' : ''} de retención</span>
                    </div>
                  </div>
                `;
              } else {
                const blk = blocksCatalog.find(b => b.id === item.id);
                const subPostures = blk ? blk.postures.map(bp => {
                  const sp = posturesCatalog.find(p => p.id === bp.postureId);
                  return `${escapeHTML(sp ? sp.name : 'Postura')} (${Math.floor(bp.holdTime / 60)}m)`;
                }).join(' → ') : '';
                return `
                  <div class="practice-timeline__item">
                    <span class="practice-timeline__index">${idx + 1}</span>
                    <div class="practice-timeline__body">
                      <span class="practice-timeline__title">Bloque: ${escapeHTML(blk ? blk.name : 'Bloque')}</span>
                      <span class="practice-timeline__meta">${subPostures}</span>
                    </div>
                  </div>
                `;
              }
            }).join('')}
          </div>
          
          <div class="practice-row__actions">
            ${renderLobbyAction({ kind: 'icon', icon: 'edit', label: 'Configurar secuencia', className: 'btn-edit' })}
            ${renderLobbyAction({ kind: 'icon', icon: 'delete', label: 'Borrar secuencia', className: 'btn-delete' })}
          </div>
        </div>
      `;

      // Accordion toggle
      const header = accordionItem.querySelector('.practice-row__summary');
      const content = accordionItem.querySelector('.practice-row__details');
      const arrow = accordionItem.querySelector('.practice-row__indicator');
      const toggleDetails = () => {
        const isOpen = content.style.display === 'block';
        content.style.display = isOpen ? 'none' : 'block';
        arrow.style.transform = isOpen ? 'rotate(0deg)' : 'rotate(90deg)';
        accordionItem.classList.toggle('is-expanded', !isOpen);
        header.setAttribute('aria-expanded', String(!isOpen));
      };

      header.addEventListener('click', (e) => {
        if (e.target.closest('button')) return;
        toggleDetails();
      });
      header.addEventListener('keydown', (e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        toggleDetails();
      });

      // Play directo en cabecera
      accordionItem.querySelector('.btn-play-header').addEventListener('click', () => {
        startSequence(seq);
      });

      accordionItem.querySelector('.btn-edit').addEventListener('click', () => {
        loadSequence(seq);
        activeView = 'editor';
        render();
      });

      accordionItem.querySelector('.btn-delete').addEventListener('click', async () => {
        if (confirm(`¿Estás seguro de que deseas eliminar la secuencia "${seq.name}"?`)) {
          try {
            await deleteSequenceFromStore(seq.id);
            await loadData();
            render();
          } catch (err) {
            alert('Error al borrar secuencia.');
          }
        }
      });

      seqListContainer.appendChild(accordionItem);
    });

    // Crear Secuencia Vacía
    lobbyEl.querySelector('#btn-lobby-create').addEventListener('click', () => {
      sequenceId = `seq-custom-${Date.now()}`;
      sequenceName = 'Nueva Secuencia';
      currentSequenceItems = [];
      reboundTime = 60;
      savasanaTime = 300;
      activeView = 'editor';
      render();
    });

    // Volver a inicio
    lobbyEl.querySelector('#btn-back-home').addEventListener('click', () => {
      synth.destroy();
      onNavigate('inicio');
    });

    bindWakeLockPreference(lobbyEl);
  }

  /* =============================================================
     VISTA 2: EDITOR / CONSTRUCTOR DE SECUENCIAS (PASO A PASO)
     ============================================================= */
  function renderEditor() {
    calculateTotalDuration();

    const editorEl = document.createElement('div');
    editorEl.className = 'dashboard-layout fade-in';
    editorEl.innerHTML = `
      <nav class="nav-bar">
        <div class="nav-logo dot-digital">M.</div>
        <ul class="nav-links">
          <li class="nav-item" id="btn-editor-back">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="19" y1="12" x2="5" y2="12"></line>
              <polyline points="12 19 5 12 12 5"></polyline>
            </svg>
            <span>Volver</span>
          </li>
        </ul>
      </nav>

      <main class="main-viewport" style="display: flex; flex-direction: column; align-items: center; justify-content: flex-start; padding: 20px; overflow-y: auto;">
        <div class="glass-panel" style="max-width: 540px; width: 100%; padding: 24px; box-sizing: border-box; margin-bottom: 40px;">
          
          ${renderTechnicalTitle('Constructor de Secuencia', { style: 'margin-bottom: 24px; text-align: center;' })}

          <!-- Formulario Datos de Secuencia -->
          <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 24px;">
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <label style="font-family: var(--font-digital); font-size: 0.65rem; color: var(--color-text-muted);">NOMBRE DE LA SECUENCIA</label>
              <input type="text" id="editor-seq-name" style="background: transparent; border: none; border-bottom: 1px solid rgba(46, 43, 40, 0.15); color: var(--color-text-main); font-family: var(--font-ui); font-size: 0.95rem; padding: 6px 0; width: 100%;" value="${escapeHTML(sequenceName)}" placeholder="Ej. Flexibilidad Lumbar">
            </div>
          </div>

          <!-- LISTA DE ASANAS / BLOQUES AÑADIDOS -->
          <div style="margin-bottom: 24px;">
            <label style="display: block; font-family: var(--font-digital); font-size: 0.65rem; color: var(--color-text-muted); text-transform: uppercase; margin-bottom: 10px;">ASANAS EN LA SECUENCIA</label>
            
            <div id="editor-items-list" style="display: flex; flex-direction: column; gap: 8px; max-height: 280px; overflow-y: auto; padding-right: 4px; margin-bottom: 20px; border: 1px solid rgba(46, 43, 40, 0.05); border-radius: 6px; padding: 8px; background: rgba(0, 0, 0, 0.01);">
              <!-- Se inyecta dinámicamente -->
            </div>

            <!-- Panel de Agregar con botones explícitos + selectores lado a lado -->
            <div style="display: flex; flex-direction: column; gap: 12px; background: rgba(46, 43, 40, 0.02); padding: 12px; border-radius: 6px; border: 1px solid rgba(46, 43, 40, 0.06);">
              <span style="font-family: var(--font-digital); font-size: 0.62rem; color: var(--color-text-muted); text-transform: uppercase;">Añadir elementos a la secuencia</span>
              
              <!-- Añadir Postura -->
              <div style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center;">
                <select id="add-posture-select" style="flex: 1; min-width: 180px; background: transparent; border: 1px solid rgba(46, 43, 40, 0.12); padding: 6px 10px; color: var(--color-text-main); border-radius: 4px; font-size: 0.78rem;">
                  <option value="">-- Selecciona Postura --</option>
                  ${posturesCatalog.map(p => `<option value="${p.id}">${escapeHTML(p.name)}</option>`).join('')}
                </select>
                <input type="number" id="add-posture-hold" min="10" placeholder="Tiempo (s)" aria-label="Tiempo de permanencia en segundos" style="width: 88px; background: transparent; border: none; border-bottom: 1px solid rgba(46, 43, 40, 0.18); padding: 6px 4px; color: var(--color-text-main); font-size: 0.78rem;">
                <button id="btn-add-posture-action" class="btn-primary" style="width: auto; padding: 6px 12px; font-size: 0.75rem; margin: 0; background: var(--color-text-main); color: var(--color-bg-base);">+ Añadir</button>
              </div>

              <!-- Añadir Bloque -->
              <div style="display: flex; gap: 8px; align-items: center;">
                <select id="add-block-select" style="flex: 1; background: transparent; border: 1px solid rgba(46, 43, 40, 0.12); padding: 6px 10px; color: var(--color-text-main); border-radius: 4px; font-size: 0.78rem;">
                  <option value="">-- Selecciona Bloque --</option>
                  ${blocksCatalog.map(b => `<option value="${b.id}">${escapeHTML(b.name)}</option>`).join('')}
                </select>
                <button id="btn-add-block-action" class="btn-primary" style="width: auto; padding: 6px 12px; font-size: 0.75rem; margin: 0; background: var(--color-text-main); color: var(--color-bg-base);">+ Añadir</button>
              </div>
            </div>

          </div>

          <!-- Parámetros Generales de Sesión -->
          <div style="display: flex; flex-direction: column; gap: 12px; padding-top: 16px; border-top: 1px dashed rgba(46,43,40,0.08); margin-bottom: 24px;">
            
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <label for="rebound-time-select" style="font-family: var(--font-digital); font-size: 0.68rem; color: var(--color-text-muted); text-transform: uppercase;">REBOTE ENTRE POSTURAS</label>
              <select id="rebound-time-select" style="background: transparent; border: 1px solid rgba(46, 43, 40, 0.12); padding: 4px 8px; color: var(--color-text-main); border-radius: 4px; font-size: 0.78rem; cursor: pointer;">
                <option value="60" ${reboundTime === 60 ? 'selected' : ''}>1 Minuto</option>
                <option value="120" ${reboundTime === 120 ? 'selected' : ''}>2 Minutos</option>
                <option value="180" ${reboundTime === 180 ? 'selected' : ''}>3 Minutos</option>
              </select>
            </div>

            <div style="display: flex; justify-content: space-between; align-items: center;">
              <label for="savasana-time-select" style="font-family: var(--font-digital); font-size: 0.68rem; color: var(--color-text-muted); text-transform: uppercase;">DURACIÓN DE SAVASANA</label>
              <select id="savasana-time-select" style="background: transparent; border: 1px solid rgba(46, 43, 40, 0.12); padding: 4px 8px; color: var(--color-text-main); border-radius: 4px; font-size: 0.78rem; cursor: pointer;">
                <option value="0" ${savasanaTime === 0 ? 'selected' : ''}>Sin Savasana</option>
                <option value="180" ${savasanaTime === 180 ? 'selected' : ''}>3 Minutos</option>
                <option value="300" ${savasanaTime === 300 ? 'selected' : ''}>5 Minutos</option>
                <option value="600" ${savasanaTime === 600 ? 'selected' : ''}>10 Minutos</option>
              </select>
            </div>

          </div>

          <!-- LECTURA DURACIÓN TOTAL -->
          <div style="background: rgba(46, 43, 40, 0.02); padding: 12px; border-radius: 6px; text-align: center; margin-bottom: 24px; border: 1px dashed rgba(46, 43, 40, 0.08);">
            <span style="font-family: var(--font-digital); font-size: 0.65rem; color: var(--color-text-muted); letter-spacing: 0.05em; display: block; text-transform: uppercase; margin-bottom: 4px;">DURACIÓN TOTAL DE LA PRÁCTICA</span>
            <span id="editor-total-duration" style="font-family: var(--font-ui); font-size: 1.15rem; font-weight: 600; color: var(--color-text-main);">${formatTime(totalSessionSeconds)}</span>
          </div>

          <!-- BOTONES DE ACCIÓN PRINCIPALES -->
          <div style="display: flex; gap: 12px;">
            <button id="btn-editor-cancel" class="btn-primary" style="flex: 1; padding: 12px 0; background: var(--color-text-muted); border: none; font-size: 0.8rem;">Cancelar</button>
            <button id="btn-editor-save" class="btn-primary" style="flex: 1; padding: 12px 0; font-size: 0.8rem;">Guardar Secuencia</button>
            <button id="btn-editor-play" class="btn-primary" style="flex: 1.5; padding: 12px 0; font-size: 0.8rem; background: var(--color-accent-green); color: #FFF; font-weight: 600;">Iniciar Práctica</button>
          </div>

        </div>
      </main>
    </div>
  `;

    container.appendChild(editorEl);

    // Selectores del Editor
    const itemsListContainer = editorEl.querySelector('#editor-items-list');
    const addPostureSelect = editorEl.querySelector('#add-posture-select');
    const addPostureHold = editorEl.querySelector('#add-posture-hold');
    const btnAddPosture = editorEl.querySelector('#btn-add-posture-action');
    const addBlockSelect = editorEl.querySelector('#add-block-select');
    const btnAddBlock = editorEl.querySelector('#btn-add-block-action');
    
    const reboundSelect = editorEl.querySelector('#rebound-time-select');
    const savasanaSelect = editorEl.querySelector('#savasana-time-select');
    const totalDurationLabel = editorEl.querySelector('#editor-total-duration');
    const seqNameInput = editorEl.querySelector('#editor-seq-name');

    // Función para renderizar la lista del constructor
    const renderConstructorList = () => {
      itemsListContainer.innerHTML = '';

      if (currentSequenceItems.length === 0) {
        itemsListContainer.innerHTML = `
          <div style="color: var(--color-text-muted); font-size: 0.78rem; text-align: center; padding: 24px;">
            La secuencia está vacía. Añade posturas o bloques usando los botones inferiores.
          </div>
        `;
        return;
      }

      currentSequenceItems.forEach((item, idx) => {
        const itemRow = document.createElement('div');
        itemRow.style.cssText = `
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 8px 12px;
          border-radius: 6px;
          background: rgba(46, 43, 40, 0.02);
          border: 1px solid rgba(46, 43, 40, 0.06);
          gap: 12px;
        `;

        if (item.type === 'posture') {
          const currentMins = Math.floor(item.holdTime / 60);
          const currentSecs = item.holdTime % 60;

          itemRow.innerHTML = `
            <div style="display: flex; flex-direction: column; flex-grow: 1; min-width: 0;">
              <span style="font-size: 0.82rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHTML(item.name)}</span>
              <span style="font-size: 0.65rem; color: var(--color-text-muted); text-transform: uppercase;">Postura</span>
            </div>
            
            <div style="display: flex; align-items: center; gap: 8px; flex-shrink: 0;">
              <!-- Minutos y Segundos inputs -->
              <div style="display: flex; align-items: center; gap: 2px;">
                <input type="number" class="item-mins" data-idx="${idx}" min="0" max="60" value="${currentMins}" style="width: 32px; background: transparent; border: none; border-bottom: 1px solid rgba(0,0,0,0.15); font-size: 0.8rem; text-align: center; color: var(--color-text-main); font-family: var(--font-digital);">
                <span style="font-size: 0.7rem; color: var(--color-text-muted);">m</span>
                <input type="number" class="item-secs" data-idx="${idx}" min="0" max="59" step="10" value="${currentSecs}" style="width: 32px; background: transparent; border: none; border-bottom: 1px solid rgba(0,0,0,0.15); font-size: 0.8rem; text-align: center; color: var(--color-text-main); font-family: var(--font-digital);">
                <span style="font-size: 0.7rem; color: var(--color-text-muted);">s</span>
              </div>
              
              <!-- Checkbox Asimétrica -->
              <label style="display: flex; align-items: center; gap: 3px; font-size: 0.68rem; color: var(--color-text-muted); cursor: pointer;" title="Divide el tiempo a la mitad para sonar un timbre y cambiar de lado">
                <input type="checkbox" class="item-asymmetric" data-idx="${idx}" ${item.isAsymmetric ? 'checked' : ''} style="cursor: pointer; accent-color: var(--color-accent-green);">
                Asim.
              </label>
            </div>
          `;
        } else if (item.type === 'block') {
          const subText = item.postures.map(bp => `${escapeHTML(bp.name)} (${Math.floor(bp.holdTime / 60)}m)`).join(' → ');
          itemRow.innerHTML = `
            <div style="display: flex; flex-direction: column; flex-grow: 1; min-width: 0;">
              <span style="font-size: 0.82rem; font-weight: 500; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHTML(item.name)}</span>
              <span style="font-size: 0.62rem; color: var(--color-text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${subText}">${subText}</span>
            </div>
            
            <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
              <span style="font-size: 0.65rem; color: var(--color-text-muted); text-transform: uppercase; margin-right: 4px;">Bloque</span>
            </div>
          `;
        }

        // Agregar botones de Reordenar y Eliminar
        const controlsDiv = document.createElement('div');
        controlsDiv.style.cssText = 'display: flex; gap: 4px; align-items: center;';
        
        const btnUp = document.createElement('button');
        btnUp.innerHTML = '▲';
        btnUp.className = 'btn-braun-add';
        btnUp.style.padding = '2px 4px';
        btnUp.style.fontSize = '0.62rem';
        btnUp.disabled = idx === 0;
        btnUp.addEventListener('click', () => {
          const temp = currentSequenceItems[idx];
          currentSequenceItems[idx] = currentSequenceItems[idx - 1];
          currentSequenceItems[idx - 1] = temp;
          renderConstructorList();
          updateTotalDurationDisplay();
        });

        const btnDown = document.createElement('button');
        btnDown.innerHTML = '▼';
        btnDown.className = 'btn-braun-add';
        btnDown.style.padding = '2px 4px';
        btnDown.style.fontSize = '0.62rem';
        btnDown.disabled = idx === currentSequenceItems.length - 1;
        btnDown.addEventListener('click', () => {
          const temp = currentSequenceItems[idx];
          currentSequenceItems[idx] = currentSequenceItems[idx + 1];
          currentSequenceItems[idx + 1] = temp;
          renderConstructorList();
          updateTotalDurationDisplay();
        });

        const btnDelete = document.createElement('button');
        btnDelete.innerHTML = '✕';
        btnDelete.className = 'btn-braun-add';
        btnDelete.style.cssText = 'color: var(--color-accent-red); font-weight: bold; font-size: 0.65rem; padding: 2px 4px;';
        btnDelete.addEventListener('click', () => {
          currentSequenceItems.splice(idx, 1);
          renderConstructorList();
          updateTotalDurationDisplay();
        });

        controlsDiv.appendChild(btnUp);
        controlsDiv.appendChild(btnDown);
        controlsDiv.appendChild(btnDelete);
        itemRow.appendChild(controlsDiv);

        itemsListContainer.appendChild(itemRow);
      });

      // Vincular eventos de cambios en inputs
      itemsListContainer.querySelectorAll('.item-mins').forEach(input => {
        input.addEventListener('change', (e) => {
          const idx = parseInt(e.target.getAttribute('data-idx'));
          const mins = Math.max(0, parseInt(e.target.value) || 0);
          const secs = currentSequenceItems[idx].holdTime % 60;
          currentSequenceItems[idx].holdTime = mins * 60 + secs;
          updateTotalDurationDisplay();
        });
      });

      itemsListContainer.querySelectorAll('.item-secs').forEach(input => {
        input.addEventListener('change', (e) => {
          const idx = parseInt(e.target.getAttribute('data-idx'));
          const mins = Math.floor(currentSequenceItems[idx].holdTime / 60);
          const secs = Math.max(0, Math.min(59, parseInt(e.target.value) || 0));
          currentSequenceItems[idx].holdTime = mins * 60 + secs;
          updateTotalDurationDisplay();
        });
      });

      itemsListContainer.querySelectorAll('.item-asymmetric').forEach(input => {
        input.addEventListener('change', (e) => {
          const idx = parseInt(e.target.getAttribute('data-idx'));
          currentSequenceItems[idx].isAsymmetric = e.target.checked;
        });
      });
    };

    const updateTotalDurationDisplay = () => {
      calculateTotalDuration();
      totalDurationLabel.textContent = formatTime(totalSessionSeconds);
    };

    // Agregar Postura (Botón + Selección)
    btnAddPosture.addEventListener('click', () => {
      const pid = addPostureSelect.value;
      const holdTime = Number(addPostureHold.value);
      if (!pid || !Number.isFinite(holdTime) || holdTime < 10) {
        alert('Selecciona una postura y asigna un tiempo de permanencia válido.');
        return;
      }
      const post = posturesCatalog.find(p => p.id === pid);
      if (post) {
        currentSequenceItems.push({
          type: 'posture',
          id: post.id,
          name: post.name,
          holdTime,
          isAsymmetric: false
        });
        renderConstructorList();
        updateTotalDurationDisplay();
      }
      addPostureSelect.value = ''; // Reset select
      addPostureHold.value = '';
    });

    // Agregar Bloque (Botón + Selección)
    btnAddBlock.addEventListener('click', () => {
      const bid = addBlockSelect.value;
      if (!bid) {
        alert('Selecciona un bloque del catálogo primero.');
        return;
      }
      const blk = blocksCatalog.find(b => b.id === bid);
      if (blk) {
        currentSequenceItems.push({
          type: 'block',
          id: blk.id,
          name: blk.name,
          postures: blk.postures.map(bp => {
            const subPost = posturesCatalog.find(p => p.id === bp.postureId);
            return {
              id: bp.postureId,
              name: subPost ? subPost.name : 'Postura',
              holdTime: bp.holdTime
            };
          })
        });
        renderConstructorList();
        updateTotalDurationDisplay();
      }
      addBlockSelect.value = ''; // Reset select
    });

    // Cambiar Rebote y Savasana
    reboundSelect.addEventListener('change', (e) => {
      reboundTime = parseInt(e.target.value);
      updateTotalDurationDisplay();
    });

    savasanaSelect.addEventListener('change', (e) => {
      savasanaTime = parseInt(e.target.value);
      updateTotalDurationDisplay();
    });

    // Guardar secuencia en base de datos
    editorEl.querySelector('#btn-editor-save').addEventListener('click', async () => {
      const name = seqNameInput.value.trim();
      if (!name) {
        alert('Por favor, indica un nombre para la secuencia.');
        return;
      }

      if (currentSequenceItems.length === 0) {
        alert('Agrega al menos una postura antes de guardar.');
        return;
      }

      const serializedItems = currentSequenceItems.map(item => {
        if (item.type === 'posture') {
          return {
            type: 'posture',
            id: item.id,
            customHoldTime: item.holdTime,
            isAsymmetric: item.isAsymmetric
          };
        } else {
          return {
            type: 'block',
            id: item.id
          };
        }
      });

      const savedSeq = {
        id: sequenceId.startsWith('seq-custom-') ? sequenceId : `seq-custom-${Date.now()}`,
        name: name,
        description: 'Secuencia de yoga guardada por el usuario',
        items: serializedItems,
        reboundTime: reboundTime,
        savasanaTime: savasanaTime
      };

      try {
        await saveSequenceToStore(savedSeq);
        alert(`Secuencia "${name}" guardada con éxito.`);
        await loadData();
        activeView = 'lobby';
        render();
      } catch (err) {
        console.error('[Yoga] Error al guardar secuencia:', err);
        alert('No se pudo guardar la secuencia.');
      }
    });

    // Iniciar práctica directamente desde el editor
    editorEl.querySelector('#btn-editor-play').addEventListener('click', () => {
      if (currentSequenceItems.length === 0) {
        alert('Agrega al menos una postura antes de iniciar.');
        return;
      }
      const serializedItems = currentSequenceItems.map(item => {
        if (item.type === 'posture') {
          return {
            type: 'posture',
            id: item.id,
            customHoldTime: item.holdTime,
            isAsymmetric: item.isAsymmetric
          };
        } else {
          return {
            type: 'block',
            id: item.id
          };
        }
      });

      const tempSeq = {
        id: sequenceId,
        name: seqNameInput.value.trim() || 'Práctica Rápida',
        items: serializedItems,
        reboundTime: reboundTime,
        savasanaTime: savasanaTime
      };
      
      startSequence(tempSeq);
    });

    // Salidas del editor
    const goBack = () => {
      activeView = 'lobby';
      render();
    };

    editorEl.querySelector('#btn-editor-back').addEventListener('click', goBack);
    editorEl.querySelector('#btn-editor-cancel').addEventListener('click', goBack);

    // Primer renderizado
    renderConstructorList();
  }

  /* =============================================================
     VISTA 3: TIMER ACTIVO (PANTALLA COMPLETA INMERSIVA)
     ============================================================= */
  function renderTimer() {
    let isSessionStarted = false;
    let gridAnimFrame = null;
    let phaseStartTime = 0;
    let phaseElapsedBeforePause = 0;
    const initialPhase = activePhases[currentPhaseIdx] || {};

    const timerEl = document.createElement('div');
    timerEl.className = 'acu-timer-fullscreen fade-in';
    timerEl.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background-color: #0A0A0A;
      z-index: 1000;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      transition: background-color 2.0s ease-in-out;
      overflow: hidden;
    `;

    timerEl.innerHTML = `
      <!-- Rejilla de puntos -->
      <div class="acu-fullscreen-bg grid-36" id="yoga-dots-grid" style="opacity: 0.75;"></div>

      <!-- Lectura del Timer -->
      <div class="yoga-timer__stage">
        
        <!-- Nombre de asana/rebote -->
        <h2 id="yoga-active-pose-name" style="font-size: 2.2rem; font-weight: 200; margin: 0 0 4px 0; color: #E8E6E3; text-transform: uppercase; letter-spacing: 0.2em; text-align: center; line-height: 1.2;">CARGANDO...</h2>
        <span id="yoga-pose-subname" style="font-family: var(--font-ui); font-weight: 300; font-size: 0.85rem; color: var(--color-text-muted); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 12px; text-align: center; min-height: 1.2rem; display: block;"></span>

        ${renderTechniqueDetails({
          id: 'yoga-technique',
          className: 'yoga-timer__technique',
          preserveEmpty: true,
          sections: [
            { key: 'focus', title: 'Enfoque', content: initialPhase.focus || initialPhase.description || '', wide: true },
            { key: 'preparation', title: 'Preparación', content: initialPhase.preparation || '' },
            { key: 'execution', title: 'Ejecución', content: initialPhase.execution || '' }
          ]
        })}

        <!-- Gran Reloj Minimalista -->
        <div id="yoga-clock-text" class="acu-timer-dot-display yoga-timer-dot-display" style="margin-bottom: 32px; pointer-events: auto; cursor: default; user-select: none;"></div>

        <!-- Indicador de Fases Dieter Rams -->
        <div style="display: flex; align-items: center; justify-content: center; width: 90%; max-width: 380px; margin: 0 auto 32px auto; font-family: var(--font-digital); font-size: 0.68rem; color: var(--color-text-muted); letter-spacing: 0.1em; text-transform: uppercase;">
          <span>FASE <span id="yoga-step-current">1</span></span>
          <div style="flex-grow: 1; height: 1px; background: rgba(255,255,255,0.08); margin: 0 16px;"></div>
          <span><span id="yoga-step-remaining">8</span> RESTANTES</span>
        </div>

        <!-- Panel de control desvanecible -->
        <div id="yoga-timer-controls" style="pointer-events: auto; width: 90%; max-width: 400px; margin: 0 auto; box-sizing: border-box;">
          
          <!-- Acceso al Sintetizador local -->
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

          <!-- Botones de control -->
          <div style="display: flex; justify-content: space-around; align-items: center; width: 100%; max-width: 380px; margin: 0 auto 32px auto;">
            <!-- Izquierda: Iniciar / Pausar / Reanudar (Flow Control) -->
            <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
              <button class="btn-acu-icon btn-acu-active" id="btn-yoga-flow" style="width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; pointer-events: auto; cursor: pointer;">
                <svg id="svg-flow-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <polygon points="6 4 19 12 6 20 6 4"></polygon>
                </svg>
              </button>
              <span id="lbl-yoga-flow" style="font-family: var(--font-digital); font-size: 0.65rem; color: var(--color-text-muted); letter-spacing: 0.1em; text-transform: uppercase;">Iniciar</span>
            </div>

            <!-- Centro: Saltar (Navigation) -->
            <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
              <button class="btn-acu-icon" id="btn-yoga-skip" style="width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; pointer-events: auto; cursor: pointer; opacity: 0.4; pointer-events: none;">
                <svg id="svg-skip-icon" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="4 3 13 12 4 21 4 3" fill="currentColor"></polygon>
                  <line x1="17" y1="4" x2="17" y2="20"></line>
                </svg>
              </button>
              <span id="lbl-yoga-skip" style="font-family: var(--font-digital); font-size: 0.65rem; color: var(--color-text-muted); letter-spacing: 0.1em; text-transform: uppercase;">Saltar</span>
            </div>

            <!-- Detener -->
            <div style="display: flex; flex-direction: column; align-items: center; gap: 8px;">
              <button class="btn-acu-icon btn-acu-danger" id="btn-yoga-stop" style="width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; pointer-events: auto; cursor: pointer;">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <rect x="5" y="5" width="14" height="14" rx="1"></rect>
                </svg>
              </button>
              <span style="font-family: var(--font-digital); font-size: 0.65rem; color: var(--color-text-muted); letter-spacing: 0.1em; text-transform: uppercase;">Detener</span>
            </div>
          </div>

          <!-- Sin Bottom Label -->
          <div style="height: 10px;"></div>

        </div>

      </div>
    `;

    container.appendChild(timerEl);

    // Inyectar rejilla de puntos física de 96x54 = 5184 puntos
    const totalDotsCount = 5184;
    const dots = populateTimerDots(timerEl.querySelector('#yoga-dots-grid'), totalDotsCount);

    // Selectores
    const activePoseLabel = timerEl.querySelector('#yoga-active-pose-name');
    const poseSubname = timerEl.querySelector('#yoga-pose-subname');
    const clockLabel = timerEl.querySelector('#yoga-clock-text');
    const stepCurrent = timerEl.querySelector('#yoga-step-current');
    const stepRemaining = timerEl.querySelector('#yoga-step-remaining');

    const controlsContainer = timerEl.querySelector('#yoga-timer-controls');

    const btnFlow = timerEl.querySelector('#btn-yoga-flow');
    const svgFlowIcon = timerEl.querySelector('#svg-flow-icon');
    const lblFlow = timerEl.querySelector('#lbl-yoga-flow');

    const btnSkip = timerEl.querySelector('#btn-yoga-skip');
    const svgSkipIcon = timerEl.querySelector('#svg-skip-icon');
    const lblSkip = timerEl.querySelector('#lbl-yoga-skip');

    const btnStop = timerEl.querySelector('#btn-yoga-stop');

    const techniqueDetails = timerEl.querySelector('#yoga-technique');

    // Intentar activar Wake Lock
    const requestWakeLock = () => wakeLockController.request();
    const releaseWakeLock = () => wakeLockController.release();

    // Desvanecimiento de controles (solo activo después de iniciar)
    let inactivityTimeout = null;
    const hideControls = () => {
      if (controlsContainer && !isPaused && activeView === 'timer' && isSessionStarted) {
        controlsContainer.style.opacity = '0.0';
        controlsContainer.style.transform = 'translateY(12px)';
        controlsContainer.style.pointerEvents = 'none';
      }
    };

    const showControls = () => {
      if (controlsContainer) {
        controlsContainer.style.opacity = '1.0';
        controlsContainer.style.transform = 'translateY(0)';
        controlsContainer.style.pointerEvents = 'auto';
      }
      resetInactivityTimer();
    };

    const resetInactivityTimer = () => {
      clearTimeout(inactivityTimeout);
      if (!isPaused && isSessionStarted) {
        inactivityTimeout = setTimeout(hideControls, 3000); // 3 segundos
      }
    };

    techniqueDetails?.addEventListener('toggle', () => {
      timerEl.classList.toggle('yoga-technique-open', techniqueDetails.open);
    });

    timerEl.addEventListener('mousemove', showControls);
    timerEl.addEventListener('touchstart', showControls);

    const updateClockDisplay = () => {
      const clampedTime = Math.max(0, timeLeft);
      const mins = String(Math.floor(clampedTime / 60)).padStart(2, '0');
      const secs = String(clampedTime % 60).padStart(2, '0');
      renderDotMatrix(clockLabel, `${mins}:${secs}`);
    };

    const syncActivePhase = () => {
      const phase = activePhases[currentPhaseIdx];
      if (!phase) return;

      // Separar nombre y subtítulo (ej. "Mariposa (Baddha Konasana)")
      const match = phase.name.match(/^([^(]+)(?:\(([^)]+)\))?/);
      if (match) {
        activePoseLabel.textContent = match[1].trim();
        poseSubname.textContent = match[2] ? `(${match[2].trim()})` : '';
      } else {
        activePoseLabel.textContent = phase.name;
        poseSubname.textContent = '';
      }

      if (techniqueDetails) {
        techniqueDetails.open = false;
        timerEl.classList.remove('yoga-technique-open');
        const techniqueContent = {
          focus: phase.focus || phase.description || '',
          preparation: phase.preparation || '',
          execution: phase.execution || ''
        };
        let visibleSections = 0;

        Object.entries(techniqueContent).forEach(([key, content]) => {
          const section = techniqueDetails.querySelector(`[data-technique-section="${key}"]`);
          const paragraph = techniqueDetails.querySelector(`[data-technique-content="${key}"]`);
          if (!section || !paragraph) return;
          paragraph.textContent = content;
          section.hidden = !content;
          if (content) visibleSections++;
        });
        techniqueDetails.hidden = visibleSections === 0;
      }

      // Actualizar FASE X y RESTANTES
      stepCurrent.textContent = currentPhaseIdx + 1;
      const remainingCount = activePhases.length - (currentPhaseIdx + 1);
      stepRemaining.textContent = remainingCount;

      if (phase.type === 'rebound') {
        timerEl.style.backgroundColor = '#0A1D12';
        poseSubname.textContent = 'REBOTE';
        poseSubname.style.color = 'var(--color-accent-green)';
      } else if (phase.type === 'savasana') {
        timerEl.style.backgroundColor = '#0A0B0E';
        poseSubname.textContent = 'REPOSO FINAL';
        poseSubname.style.color = '#AB47BC';
      } else {
        timerEl.style.backgroundColor = '#0A0A0A';
        poseSubname.style.color = 'var(--color-text-muted)';
        if (phase.isAsymmetric) {
          const half = Math.floor(phase.duration / 2);
          if (timeLeft > half) {
            poseSubname.textContent = '(LADO IZQUIERDO)';
          } else {
            poseSubname.textContent = '(LADO DERECHO)';
          }
          poseSubname.style.color = 'var(--color-accent-red)';
        }
      }

      updateClockDisplay();
    };

    const getElapsedMs = () => {
      if (!isSessionStarted) return 0;
      if (isPaused) {
        return phaseElapsedBeforePause;
      } else {
        return phaseElapsedBeforePause + (Date.now() - phaseStartTime);
      }
    };

    const getCompletedSessionSeconds = () => {
      return activePhases
        .slice(0, currentPhaseIdx)
        .reduce((sum, phase) => sum + (parseInt(phase.duration) || 0), 0);
    };

    // Animación de Rejilla de Puntos
    const updateGrid = () => {
      if (!isSessionStarted) {
        dots.forEach(dot => {
          if (dot.classList.contains('dot-on')) {
            dot.style.removeProperty('--dot-color');
            dot.style.removeProperty('--dot-glow');
            dot.classList.remove('dot-on');
          }
        });
        return;
      }

      const phase = activePhases[currentPhaseIdx];
      if (!phase) return;

      const elapsedMs = getElapsedMs();
      const elapsedInPhase = elapsedMs / 1000;
      const clampedPhaseElapsed = Math.min(elapsedInPhase, phase.duration);
      const sessionElapsed = getCompletedSessionSeconds() + clampedPhaseElapsed;
      const pct = totalSessionSeconds > 0 ? sessionElapsed / totalSessionSeconds : 0;
      const safeElapsed = (isNaN(sessionElapsed) || sessionElapsed < 0) ? 0 : sessionElapsed;
      const progressRatio = totalSessionSeconds > 0 ? safeElapsed / totalSessionSeconds : 0;
      const activeDotsCount = Math.min(totalDotsCount, Math.floor(progressRatio * totalDotsCount));

      // Determinar color
      let color = 'rgba(0, 230, 118, 0.95)'; // verde brillante
      let glow = 'rgba(0, 230, 118, 0.6)';
      
      if (phase.type === 'rebound') {
        color = 'rgba(46, 204, 113, 0.95)'; // verde bosque
        glow = 'rgba(46, 204, 113, 0.6)';
      } else if (phase.type === 'savasana') {
        color = 'rgba(171, 71, 188, 0.95)'; // púrpura
        glow = 'rgba(171, 71, 188, 0.6)';
      }

      dots.forEach((dot, idx) => {
        if (idx < activeDotsCount) {
          dot.style.setProperty('--dot-color', color);
          dot.style.setProperty('--dot-glow', glow);
          dot.classList.add('dot-on');
        } else {
          if (dot.classList.contains('dot-on')) {
            dot.style.removeProperty('--dot-color');
            dot.style.removeProperty('--dot-glow');
            dot.classList.remove('dot-on');
          }
        }
      });
    };

    const startAnimationLoop = () => {
      if (!gridAnimFrame) {
        const loop = () => {
          updateGrid();
          gridAnimFrame = requestAnimationFrame(loop);
        };
        gridAnimFrame = requestAnimationFrame(loop);
      }
    };

    const stopAnimationLoop = () => {
      if (gridAnimFrame) {
        cancelAnimationFrame(gridAnimFrame);
        gridAnimFrame = null;
      }
    };

    const runTimerInterval = () => {
      phaseStartTime = Date.now();
      phaseElapsedBeforePause = 0;
      timerInterval = setInterval(() => {
        if (isPaused) return;

        timeLeft--;
        elapsedSeconds++;
        
        const phase = activePhases[currentPhaseIdx];

        if (phase.type === 'posture' && phase.isAsymmetric) {
          const halfTime = Math.floor(phase.duration / 2);
          if (timeLeft <= halfTime) {
            poseSubname.textContent = '(LADO DERECHO)';
            poseSubname.style.color = 'var(--color-accent-red)';
          }
          if (timeLeft === halfTime && !chimePlayedForCurrentPhase) {
            playSideAlertChime();
            chimePlayedForCurrentPhase = true;
          }
        }

        updateClockDisplay();

        if (timeLeft <= 0) {
          clearInterval(timerInterval);
          stopAnimationLoop();
          playQuartzBowlRing(432, 3.5);

          if (currentPhaseIdx < activePhases.length - 1) {
            currentPhaseIdx++;
            const nextPhase = activePhases[currentPhaseIdx];
            timeLeft = nextPhase.duration;
            phaseDuration = nextPhase.duration;
            chimePlayedForCurrentPhase = false;
            
            syncActivePhase();
            runTimerInterval();
          } else {
            finishSession();
          }
        }
      }, 1000);
      
      startAnimationLoop();
    };

    const cleanupTimer = async () => {
      clearInterval(timerInterval);
      stopAnimationLoop();
      releaseWakeLock();
      synth.destroy();
    };

    // Finalizar sesión (Savasana completado)
    async function finishSession() {
      await cleanupTimer();
      playQuartzBowlRing(432, 4.5);
      const result = createModuleResult('yoga', elapsedSeconds, {
        sequenceId,
        sequenceName
      });
      const durationMin = Math.max(1, Math.round(elapsedSeconds / 60));

      if (!orchestratorConfig) {
        try {
          await addData(db, 'sessions_log', {
            type: 'yoga',
            date: new Date().toISOString(),
            duration: durationMin,
            activeDurationSeconds: elapsedSeconds,
            notes: `Sesión de Yin Yoga completada: ${sequenceName}.`,
            details: `Yin Yoga: ${escapeHTML(sequenceName)}`
          });
        } catch (e) {
          console.error('[Yoga] Error al guardar el historial:', e);
        }
      }

      if (orchestratorConfig) {
        orchestratorConfig.onComplete(result);
      } else {
        alert('Sesión de Yoga completada. Namasté.');
        activeView = 'lobby';
        render();
      }
    }

    // BOTÓN INICIAR / PAUSAR / REANUDAR (IZQUIERDA - CONTROL DE FLUJO)
    btnFlow.addEventListener('click', () => {
      if (!isSessionStarted) {
        // Iniciar la sesión por primera vez
        isSessionStarted = true;
        isPaused = false;
        phaseStartTime = Date.now();
        phaseElapsedBeforePause = 0;
        
        // Cambiar label a Pausar
        lblFlow.textContent = 'Pausar';
        // Icono Pause
        svgFlowIcon.innerHTML = `
          <rect x="6" y="4" width="3" height="16" rx="1"></rect>
          <rect x="15" y="4" width="3" height="16" rx="1"></rect>
        `;
        svgFlowIcon.setAttribute('fill', 'currentColor');
        svgFlowIcon.removeAttribute('stroke');

        // Habilitar botón Saltar
        btnSkip.style.opacity = '1.0';
        btnSkip.style.pointerEvents = 'auto';

        // Iniciar audio local si corresponde
        if (localAudioActive) {
          synth.start(localBaseFreq, localFreq, localAudioMode);
        }

        requestWakeLock();
        resetInactivityTimer();
        runTimerInterval();
      } else {
        // Pausar o Reanudar
        isPaused = !isPaused;
        if (isPaused) {
          lblFlow.textContent = 'Reanudar';
          // Icono Play
          svgFlowIcon.innerHTML = `<polygon points="6 4 19 12 6 20 6 4"></polygon>`;
          svgFlowIcon.setAttribute('fill', 'currentColor');
          svgFlowIcon.removeAttribute('stroke');
          phaseElapsedBeforePause += Date.now() - phaseStartTime;
          stopAnimationLoop();
          clearTimeout(inactivityTimeout);
          showControls();
        } else {
          lblFlow.textContent = 'Pausar';
          // Icono Pause
          svgFlowIcon.innerHTML = `
            <rect x="6" y="4" width="3" height="16" rx="1"></rect>
            <rect x="15" y="4" width="3" height="16" rx="1"></rect>
          `;
          svgFlowIcon.setAttribute('fill', 'currentColor');
          svgFlowIcon.removeAttribute('stroke');
          phaseStartTime = Date.now();
          startAnimationLoop();
          resetInactivityTimer();
        }
      }
    });

    // BOTÓN SALTAR (CENTRO - NAVEGACIÓN)
    btnSkip.addEventListener('click', () => {
      if (!isSessionStarted) return; // Por seguridad, aunque esté deshabilitado

      clearInterval(timerInterval);
      stopAnimationLoop();
      chimePlayedForCurrentPhase = false;

      if (currentPhaseIdx < activePhases.length - 1) {
        currentPhaseIdx++;
        const nextPhase = activePhases[currentPhaseIdx];
        timeLeft = nextPhase.duration;
        phaseDuration = nextPhase.duration;
        syncActivePhase();
        runTimerInterval();
      } else {
        finishSession();
      }
    });

    // BOTÓN DETENER (DERECHA - SALIDA)
    btnStop.addEventListener('click', () => {
      if (!isSessionStarted) {
        // Si no ha iniciado la sesión, vuelve directamente al lobby sin preguntar
        synth.destroy();
        if (orchestratorConfig) {
          onNavigate('inicio');
        } else {
          activeView = 'lobby';
          render();
        }
        return;
      }

      // Si ya inició, pausa y pide confirmación
      const wasPaused = isPaused;
      if (!isPaused) {
        isPaused = true;
        lblFlow.textContent = 'Reanudar';
        svgFlowIcon.innerHTML = `<polygon points="6 4 19 12 6 20 6 4"></polygon>`;
        svgFlowIcon.setAttribute('fill', 'currentColor');
        svgFlowIcon.removeAttribute('stroke');
        phaseElapsedBeforePause += Date.now() - phaseStartTime;
        stopAnimationLoop();
        clearTimeout(inactivityTimeout);
        showControls();
      }

      if (confirm('¿Deseas detener y cancelar la sesión actual? (NO se guardará en el historial)')) {
        clearInterval(timerInterval);
        stopAnimationLoop();
        releaseWakeLock();
        synth.destroy();
        onNavigate('inicio');
      } else {
        if (!wasPaused) {
          isPaused = false;
          lblFlow.textContent = 'Pausar';
          svgFlowIcon.innerHTML = `
            <rect x="6" y="4" width="3" height="16" rx="1"></rect>
            <rect x="15" y="4" width="3" height="16" rx="1"></rect>
          `;
          svgFlowIcon.setAttribute('fill', 'currentColor');
          svgFlowIcon.removeAttribute('stroke');
          phaseStartTime = Date.now();
          startAnimationLoop();
          resetInactivityTimer();
        }
      }
    });

    // Vincular panel del sintonizador
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
      root: timerEl,
      idPrefix: 'timer',
      getState: getSynthState,
      setState: setSynthState,
      synthEngine: synth
    });

    syncActivePhase();
    updateGrid(); // Inicializa la rejilla de puntos vacía
  }

  // Carga inicial y primer montaje del componente
  await loadData();
  if (orchestratorConfig && startResolvedYogaSequence(
    sequencesCatalog,
    orchestratorConfig.presetId,
    startSequence
  )) {
    return;
  }
  render();
}
