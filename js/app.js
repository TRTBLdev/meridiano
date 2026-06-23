import { openDB, seedDatabase, addData } from './db.js';
import { renderLogin } from './components/login.js';
import { renderDashboard } from './components/dashboard.js';
import { renderDotMatrix } from './utils/dotmatrix.js';
import { renderAcupunctureScreen } from './components/acupuncture.js';
import { renderSyllabusScreen } from './components/syllabus.js';
import { renderBreathworkScreen } from './components/breathwork.js';
import { renderMeditationScreen } from './components/meditation.js';
import { renderYogaScreen } from './components/yoga.js';
import { renderConfigScreen } from './components/config.js';


// Estado global de la aplicación
const state = {
  db: null,
  session: null
};

// Parámetros de audio global
let audioCtx = null;
let oscLeft = null;
let oscRight = null;
let lfo = null;
let lfoGain = null;
let mainGain = null;
let isAudioActive = false;

// Ajustes por defecto de sintonizador
let baseFreq = 432;      // Solfeggio Armónico
let diffFreq = 6.0;      // Theta
let audioMode = 'binaural'; // binaural o isocronico


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

// Significado y nombres de las frecuencias Solfeggio en español
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

// Contenedor principal de montaje
const appContainer = document.getElementById('app');

/**
 * Inicializa la aplicación, el Service Worker y el audio global.
 */
async function init() {
  console.log('[App] Inicializando MERIDIANO (Braun Look & Feel)...');
  registerServiceWorker();

  // Aplicar tema (oscuro por defecto)
  const savedTheme = localStorage.getItem('meridiano_theme');
  if (savedTheme !== 'light') {
    document.body.classList.add('dark-theme');
    if (!savedTheme) {
      localStorage.setItem('meridiano_theme', 'dark');
    }
  } else {
    document.body.classList.remove('dark-theme');
  }

  try {
    state.db = await openDB();
    await seedDatabase();
  } catch (error) {
    console.error('[App] Error al iniciar la base de datos:', error);
  }

  checkSession();
  navigate();

  // Escuchar eventos globales de sonido
  window.addEventListener('toggle-sound-tuner', toggleSoundTunerOverlay);
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => console.log('[PWA] Service Worker activo:', reg.scope))
        .catch((err) => console.error('[PWA] Error en Service Worker:', err));
    });
  }
}

function checkSession() {
  const sessionData = localStorage.getItem('meridiano_session');
  if (sessionData) {
    state.session = JSON.parse(sessionData);
  } else {
    state.session = null;
  }
}

function navigate() {
  // Asegurar que el audio sigue corriendo si está activo (no pararlo al cambiar de página)
  // Pero limpiar el DOM de overlays globales previos
  removeGlobalTunerMarkup();

  if (!state.session) {
    stopGlobalAudio();
    renderLogin(appContainer, handleLoginSuccess);
  } else {
    // Renderizar dashboard
    renderDashboard(appContainer, state.session, state.db, handleNavigation);
    // Inyectar el botón y panel flotante del sintonizador de sonido global
    injectGlobalTunerMarkup();
  }
}

function handleLoginSuccess(session) {
  state.session = session;
  localStorage.setItem('meridiano_session', JSON.stringify(session));
  navigate();
}

function handleNavigation(target) {
  if (target === 'logout') {
    state.session = null;
    localStorage.removeItem('meridiano_session');
    navigate();
    return;
  }

  if (target === 'inicio') {
    navigate();
    return;
  }

  // Cargar pantallas de módulos específicos
  if (target === 'meditation') {
    renderMeditationScreen(appContainer, state.db, handleNavigation, {
      getAudioState: () => ({ baseFreq, diffFreq, audioMode, isAudioActive }),
      startAudio: (base, diff, mode) => {
        if (base !== undefined) baseFreq = base;
        if (diff !== undefined) diffFreq = diff;
        if (mode !== undefined) audioMode = mode;
        startGlobalAudio();
        syncGlobalTunerUI();
      },
      stopAudio: () => {
        stopGlobalAudio();
        syncGlobalTunerUI();
      },
      updateAudioFreqs: (base, diff) => {
        if (base !== undefined) baseFreq = base;
        if (diff !== undefined) diffFreq = diff;
        updateGlobalFrequencies();
        syncGlobalTunerUI();
      },
      playQuartzBowl: (baseFreqValue, durationVal) => {
        playQuartzBowlRing(baseFreqValue, durationVal);
      }
    });
  } else if (target === 'acupuncture') {
    renderAcupunctureScreen(appContainer, state.db, handleNavigation, {
      getAudioState: () => ({ baseFreq, diffFreq, audioMode, isAudioActive }),
      startAudio: (base, diff, mode) => {
        if (base !== undefined) baseFreq = base;
        if (diff !== undefined) diffFreq = diff;
        if (mode !== undefined) audioMode = mode;
        startGlobalAudio();
        syncGlobalTunerUI();
      },
      stopAudio: () => {
        stopGlobalAudio();
        syncGlobalTunerUI();
      },
      updateAudioFreqs: (base, diff) => {
        if (base !== undefined) baseFreq = base;
        if (diff !== undefined) diffFreq = diff;
        updateGlobalFrequencies();
        syncGlobalTunerUI();
      },
      playCompletionBell: () => {
        playQuartzBowlRing();
      },
      saveSession: async (duration, notes) => {
        await saveSessionToDB('acupuncture', duration, notes);
      }
    });
  } else if (target === 'breathwork') {
    renderBreathworkScreen(appContainer, state.db, handleNavigation, {
      getAudioState: () => ({ baseFreq, diffFreq, audioMode, isAudioActive }),
      startAudio: (base, diff, mode) => {
        if (base !== undefined) baseFreq = base;
        if (diff !== undefined) diffFreq = diff;
        if (mode !== undefined) audioMode = mode;
        startGlobalAudio();
        syncGlobalTunerUI();
      },
      stopAudio: () => {
        stopGlobalAudio();
        syncGlobalTunerUI();
      },
      updateAudioFreqs: (base, diff) => {
        if (base !== undefined) baseFreq = base;
        if (diff !== undefined) diffFreq = diff;
        updateGlobalFrequencies();
        syncGlobalTunerUI();
      }
    });
  } else if (target === 'yoga') {
    renderYogaScreen(appContainer, state.db, handleNavigation, {
      getAudioState: () => ({ baseFreq, diffFreq, audioMode, isAudioActive }),
      startAudio: (base, diff, mode) => {
        if (base !== undefined) baseFreq = base;
        if (diff !== undefined) diffFreq = diff;
        if (mode !== undefined) audioMode = mode;
        startGlobalAudio();
        syncGlobalTunerUI();
      },
      stopAudio: () => {
        stopGlobalAudio();
        syncGlobalTunerUI();
      },
      updateAudioFreqs: (base, diff) => {
        if (base !== undefined) baseFreq = base;
        if (diff !== undefined) diffFreq = diff;
        updateGlobalFrequencies();
        syncGlobalTunerUI();
      },
      playCompletionBell: () => {
        playQuartzBowlRing(432, 3.5);
      },
      playQuartzBowl: (baseFreqValue, durationVal) => {
        playQuartzBowlRing(baseFreqValue, durationVal);
      }
    });

  } else if (target === 'syllabus') {
    renderSyllabusScreen(appContainer, state.db, handleNavigation);
  } else if (target === 'config') {
    renderConfigScreen(appContainer, state.db, handleNavigation);
  }
}

/* =============================================================
   SINTETIZADOR WEB AUDIO API GLOBAL (BINAURAL E ISOCRÓNICO)
============================================================= */
function startGlobalAudio() {
  try {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    // Detener osciladores anteriores antes de recrearlos
    stopOscillatorsOnly();

    // Crear ganancia principal (suave)
    mainGain = audioCtx.createGain();
    mainGain.gain.setValueAtTime(0.0001, audioCtx.currentTime); // Iniciar en 0 para fade-in suave
    mainGain.gain.linearRampToValueAtTime(0.06, audioCtx.currentTime + 1.5); // Rampa linear a volumen 0.06 en 1.5s

    if (audioMode === 'binaural') {
      // Canal Izquierdo: Frecuencia Base
      oscLeft = audioCtx.createOscillator();
      oscLeft.type = 'sine';
      oscLeft.frequency.value = baseFreq;

      // Canal Derecho: Frecuencia Base + Diferencial
      oscRight = audioCtx.createOscillator();
      oscRight.type = 'sine';
      oscRight.frequency.value = baseFreq + diffFreq;

      // Panoramización Estéreo
      const pannerLeft = audioCtx.createStereoPanner();
      const pannerRight = audioCtx.createStereoPanner();
      pannerLeft.pan.value = -1;
      pannerRight.pan.value = 1;

      // Conexión
      oscLeft.connect(pannerLeft).connect(mainGain);
      oscRight.connect(pannerRight).connect(mainGain);
    } else {
      // Modo Isocrónico: Un único tono modulado en volumen mediante un LFO
      oscLeft = audioCtx.createOscillator();
      oscLeft.type = 'sine';
      oscLeft.frequency.value = baseFreq;

      // Generar LFO (Oscilador de Baja Frecuencia) para modular el volumen
      lfo = audioCtx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = diffFreq;

      // Ganancia de modulación del LFO
      lfoGain = audioCtx.createGain();
      lfoGain.gain.value = 0.04; // Nivel de oscilación del volumen

      // El LFO modula la ganancia del oscilador principal
      lfo.connect(lfoGain).connect(mainGain.gain);
      oscLeft.connect(mainGain);

      lfo.start();
    }

    mainGain.connect(audioCtx.destination);
    oscLeft.start();
    if (oscRight) oscRight.start();

    isAudioActive = true;
    console.log(`[Audio] Synthesizer Running: Mode=${audioMode}, Base=${baseFreq}Hz, Diff=${diffFreq}Hz`);
  } catch (err) {
    console.error('[Audio] Error starting synthesizer:', err);
  }
}

function stopOscillatorsOnly() {
  if (oscLeft) {
    try { oscLeft.stop(); } catch(e){}
    oscLeft = null;
  }
  if (oscRight) {
    try { oscRight.stop(); } catch(e){}
    oscRight = null;
  }
  if (lfo) {
    try { lfo.stop(); } catch(e){}
    lfo = null;
  }
  if (lfoGain) {
    lfoGain.disconnect();
    lfoGain = null;
  }
}

function stopGlobalAudio() {
  if (mainGain && audioCtx) {
    const currentGain = mainGain.gain.value;
    mainGain.gain.setValueAtTime(currentGain, audioCtx.currentTime);
    mainGain.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + 1.5); // Rampa linear a 0 en 1.5s
    
    // Capturar nodos para detenerlos tras el desvanecimiento
    const left = oscLeft;
    const right = oscRight;
    const lf = lfo;
    const lfg = lfoGain;
    const mg = mainGain;
    
    setTimeout(() => {
      try {
        if (left) left.stop();
        if (right) right.stop();
        if (lf) lf.stop();
        if (lfg) lfg.disconnect();
        if (mg) mg.disconnect();
      } catch (e) {}
    }, 1600);
  }
  
  oscLeft = null;
  oscRight = null;
  lfo = null;
  lfoGain = null;
  mainGain = null;
  isAudioActive = false;
  console.log('[Audio] Synthesizer Stopped with Fade out.');
}

function updateGlobalFrequencies() {
  if (isAudioActive && oscLeft) {
    if (audioMode === 'binaural') {
      oscLeft.frequency.setValueAtTime(baseFreq, audioCtx.currentTime);
      if (oscRight) oscRight.frequency.setValueAtTime(baseFreq + diffFreq, audioCtx.currentTime);
    } else {
      oscLeft.frequency.setValueAtTime(baseFreq, audioCtx.currentTime);
      if (lfo) lfo.frequency.setValueAtTime(diffFreq, audioCtx.currentTime);
    }
  }
}

/* =============================================================
   INYECTAR MAQUETACIÓN DEL SINTONIZADOR DE AUDIO GLOBAL (EJE Z)
============================================================= */
function injectGlobalTunerMarkup() {
  // Evitar duplicados del panel
  if (document.getElementById('sound-tuner-overlay')) return;
 
  // Panel Flotante Sintonizador (Overlay de Vidrio Esmerilado)
  const overlayPanel = document.createElement('div');
  overlayPanel.className = 'sound-tuner-overlay glass-panel';
  overlayPanel.id = 'sound-tuner-overlay';
  overlayPanel.innerHTML = `
    <!-- Cabecera de Sintonizador con Cerrado -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <h3 class="dot-digital" style="font-size: 0.85rem; letter-spacing: 0.1em; color: var(--color-text-main); margin: 0;">SINTETIZADOR</h3>
      <button id="global-tuner-close-btn" style="background: none; border: none; cursor: pointer; color: var(--color-text-muted); padding: 4px; display: flex; align-items: center; justify-content: center;" title="Cerrar Sintetizador">
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
          <line x1="18" y1="6" x2="6" y2="18"></line>
          <line x1="6" y1="6" x2="18" y2="18"></line>
        </svg>
      </button>
    </div>
    
    <!-- Selector de Modo de Audio -->
    <div style="margin-bottom: 20px;">
      <div class="tuner-label-group"><span>MODO DE ONDA</span></div>
      <div style="display: flex; gap: 16px; font-size: 0.8rem;">
        <label style="cursor: pointer; display: flex; align-items: center; gap: 6px;">
          <input type="radio" name="audio-mode" value="binaural" ${audioMode === 'binaural' ? 'checked' : ''} style="accent-color: var(--color-accent-red);">
          Binaural
        </label>
        <label style="cursor: pointer; display: flex; align-items: center; gap: 6px;">
          <input type="radio" name="audio-mode" value="isochronic" ${audioMode === 'isochronic' ? 'checked' : ''} style="accent-color: var(--color-accent-red);">
          Isocrónico
        </label>
      </div>
    </div>
 
    <!-- Selector de Tono Personalizado -->
    <div class="tuner-slider-container">
      <div class="tuner-label-group" style="margin-bottom: 8px;">
        <span>SELECCIÓN DE TONO</span>
      </div>
      
      <div class="custom-tuner-dropdown" id="tuner-dropdown-container">
        <button type="button" class="tuner-dropdown-trigger" id="tuner-dropdown-trigger">
          <span id="tuner-dropdown-selected-text">${getFreqLabel(baseFreq)}</span>
          <svg class="dropdown-chevron" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </button>
        <div class="tuner-dropdown-options" id="tuner-dropdown-options">
          <div class="tuner-dropdown-option" data-value="7.83"><strong>7.83 Hz</strong> — Resonancia Schumann</div>
          <div class="tuner-dropdown-option" data-value="40"><strong>40 Hz</strong> — Sincronización Cerebral / Foco</div>
          <div class="tuner-dropdown-option" data-value="111"><strong>111 Hz</strong> — Regeneración Celular</div>
          <div class="tuner-dropdown-option" data-value="136.1"><strong>136.1 Hz</strong> — Frecuencia Om (Tierra)</div>
          <div class="tuner-dropdown-option" data-value="174"><strong>174 Hz</strong> — Alivio del dolor</div>
          <div class="tuner-dropdown-option" data-value="285"><strong>285 Hz</strong> — Regeneración de tejidos</div>
          <div class="tuner-dropdown-option" data-value="396"><strong>396 Hz</strong> — Liberar miedo y culpa</div>
          <div class="tuner-dropdown-option" data-value="417"><strong>417 Hz</strong> — Facilitar el cambio</div>
          <div class="tuner-dropdown-option" data-value="432"><strong>432 Hz</strong> — Calma y armonía natural</div>
          <div class="tuner-dropdown-option" data-value="528"><strong>528 Hz</strong> — Transformación y milagro</div>
          <div class="tuner-dropdown-option" data-value="639"><strong>639 Hz</strong> — Conexión y relaciones</div>
          <div class="tuner-dropdown-option" data-value="741"><strong>741 Hz</strong> — Desintoxicación (Limpieza)</div>
          <div class="tuner-dropdown-option" data-value="852"><strong>852 Hz</strong> — Despertar de la intuición</div>
          <div class="tuner-dropdown-option" data-value="963"><strong>963 Hz</strong> — Conexión universal / Unidad</div>
        </div>
      </div>
      
      <input type="range" id="global-base-slider" class="tuner-slider" min="5" max="1000" step="0.1" value="${baseFreq}">
    </div>
 
    <!-- Frecuencia Diferencial -->
    <div class="tuner-slider-container" style="margin-top: 24px;">
      <div class="tuner-label-group">
        <span>ESTADO CEREBRAL</span>
        <span id="global-diff-label" class="dot-digital">${diffFreq.toFixed(1)} Hz</span>
      </div>
      <input type="range" id="global-diff-slider" class="tuner-slider" min="0" max="100" step="1" value="${freqToValue(diffFreq)}">
      <div style="display: flex; justify-content: space-between; font-size: 0.6rem; color: var(--color-text-muted); margin-top: 4px;">
        <span>DELTA (Sueño)</span>
        <span>THETA</span>
        <span>ALPHA</span>
        <span>BETA</span>
      </div>
    </div>
 
    <!-- Interruptor Deslizable de Encendido con Etiquetas APAGADO / ENCENDIDO -->
    <div style="display: flex; align-items: center; justify-content: center; gap: 16px; margin-top: 28px; padding-top: 18px; border-top: 1px dashed rgba(46, 43, 40, 0.08);">
      <span id="tuner-power-off-label" class="dot-digital" style="font-size: 0.7rem; letter-spacing: 0.1em; color: var(--color-text-main); transition: all 0.2s ease; cursor: default;">APAGADO</span>
      <label class="braun-switch">
        <input type="checkbox" id="tuner-power-checkbox" ${isAudioActive ? 'checked' : ''}>
        <span class="braun-switch-slider"></span>
      </label>
      <span id="tuner-power-on-label" class="dot-digital" style="font-size: 0.7rem; letter-spacing: 0.1em; color: var(--color-text-muted); opacity: 0.4; transition: all 0.2s ease; cursor: default;">ENCENDIDO</span>
    </div>
  `;
  document.body.appendChild(overlayPanel);
 
  // Escuchar el evento de cerrado
  document.getElementById('global-tuner-close-btn').addEventListener('click', toggleSoundTunerOverlay);
 
  const baseSlider = document.getElementById('global-base-slider');
  const diffSlider = document.getElementById('global-diff-slider');
  const diffLabel = document.getElementById('global-diff-label');
  const powerCheckbox = document.getElementById('tuner-power-checkbox');
  const modeRadios = document.getElementsByName('audio-mode');
  
  // Selectores para el Dropdown personalizado
  const dropdownTrigger = document.getElementById('tuner-dropdown-trigger');
  const dropdownOptionsContainer = document.getElementById('tuner-dropdown-options');
  const dropdownOptions = document.querySelectorAll('.tuner-dropdown-option');
 
  // Cambiar modo (binaural o isocrónico)
  modeRadios.forEach(radio => {
    radio.addEventListener('change', (e) => {
      audioMode = e.target.value;
      if (isAudioActive) startGlobalAudio();
    });
  });
 
  const syncUI = () => {
    // Actualizar el texto del botón trigger
    const selectedTextSpan = document.getElementById('tuner-dropdown-selected-text');
    if (selectedTextSpan) {
      selectedTextSpan.textContent = getFreqLabel(baseFreq);
    }
    
    let waveState = 'THETA';
    if (diffFreq <= 4) waveState = 'DELTA';
    else if (diffFreq <= 8) waveState = 'THETA';
    else if (diffFreq <= 12) waveState = 'ALPHA';
    else waveState = 'BETA';
 
    diffLabel.textContent = `${diffFreq.toFixed(1)} Hz (${waveState})`;
    
    if (isAudioActive) {
      updateGlobalFrequencies();
    }
 
    // Actualizar clase activa en las opciones del dropdown
    dropdownOptions.forEach(opt => {
      const val = parseFloat(opt.getAttribute('data-value'));
      if (Math.abs(val - baseFreq) < 0.05) {
        opt.classList.add('active');
      } else {
        opt.classList.remove('active');
      }
    });
  };
 
  // Alternar visibilidad del dropdown
  dropdownTrigger.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = dropdownOptionsContainer.classList.toggle('visible');
    dropdownTrigger.classList.toggle('open', isOpen);
  });
 
  // Cerrar el dropdown si se hace click fuera de su contenedor
  document.addEventListener('click', (e) => {
    const dropdownContainer = document.getElementById('tuner-dropdown-container');
    if (dropdownContainer && !dropdownContainer.contains(e.target)) {
      dropdownOptionsContainer.classList.remove('visible');
      dropdownTrigger.classList.remove('open');
    }
  });
 
  // Seleccionar una opción del dropdown
  dropdownOptions.forEach(opt => {
    opt.addEventListener('click', () => {
      baseFreq = parseFloat(opt.getAttribute('data-value'));
      baseSlider.value = baseFreq;
      syncUI();
      dropdownOptionsContainer.classList.remove('visible');
      dropdownTrigger.classList.remove('open');
    });
  });
 
  baseSlider.addEventListener('input', () => {
    baseFreq = parseInt(baseSlider.value);
    syncUI();
  });
 
  diffSlider.addEventListener('input', () => {
    diffFreq = valueToFreq(parseInt(diffSlider.value));
    syncUI();
  });
 
  const triggerItem = document.querySelector('[data-target="sound-tuner"]');
 
  const updateButtonStates = () => {
    if (powerCheckbox) {
      powerCheckbox.checked = isAudioActive;
    }
    
    // Cambiar dinámicamente el resalto de APAGADO y ENCENDIDO
    const offLabel = document.getElementById('tuner-power-off-label');
    const onLabel = document.getElementById('tuner-power-on-label');
    if (offLabel && onLabel) {
      if (isAudioActive) {
        offLabel.style.color = 'var(--color-text-muted)';
        offLabel.style.opacity = '0.4';
        onLabel.style.color = 'var(--color-accent-green)';
        onLabel.style.opacity = '1';
      } else {
        offLabel.style.color = 'var(--color-text-main)';
        offLabel.style.opacity = '1';
        onLabel.style.color = 'var(--color-text-muted)';
        onLabel.style.opacity = '0.4';
      }
    }
    
    if (isAudioActive) {
      if (triggerItem) triggerItem.classList.add('active');
    } else {
      if (triggerItem) triggerItem.classList.remove('active');
    }
  };
 
  powerCheckbox.addEventListener('change', (e) => {
    if (e.target.checked) {
      startGlobalAudio();
    } else {
      stopGlobalAudio();
    }
    updateButtonStates();
  });
 
  // Sincronizar estado inicial al montar
  syncUI();
  updateButtonStates();
}
 
function removeGlobalTunerMarkup() {
  const overlay = document.getElementById('sound-tuner-overlay');
  if (overlay) overlay.remove();
}

function toggleSoundTunerOverlay() {
  const overlay = document.getElementById('sound-tuner-overlay');
  if (overlay) {
    overlay.classList.toggle('visible');
  }
}

function syncGlobalTunerUI() {
  const overlay = document.getElementById('sound-tuner-overlay');
  if (!overlay) return;
  const baseSlider = document.getElementById('global-base-slider');
  const diffSlider = document.getElementById('global-diff-slider');
  const diffLabel = document.getElementById('global-diff-label');
  const powerCheckbox = document.getElementById('tuner-power-checkbox');
  const modeRadios = document.getElementsByName('audio-mode');
  const selectedTextSpan = document.getElementById('tuner-dropdown-selected-text');

  if (baseSlider) baseSlider.value = baseFreq;
  if (diffSlider) diffSlider.value = freqToValue(diffFreq);
  if (selectedTextSpan) selectedTextSpan.textContent = getFreqLabel(baseFreq);
  if (powerCheckbox) powerCheckbox.checked = isAudioActive;

  if (diffLabel) {
    let waveState = 'THETA';
    if (diffFreq <= 4) waveState = 'DELTA';
    else if (diffFreq <= 8) waveState = 'THETA';
    else if (diffFreq <= 12) waveState = 'ALPHA';
    else waveState = 'BETA';
    diffLabel.textContent = `${diffFreq.toFixed(1)} Hz (${waveState})`;
  }

  modeRadios.forEach(radio => {
    if (radio.value === audioMode) radio.checked = true;
  });

  const offLabel = document.getElementById('tuner-power-off-label');
  const onLabel = document.getElementById('tuner-power-on-label');
  const triggerItem = document.querySelector('[data-target="sound-tuner"]');

  if (offLabel && onLabel) {
    if (isAudioActive) {
      offLabel.style.color = 'var(--color-text-muted)';
      offLabel.style.opacity = '0.4';
      onLabel.style.color = 'var(--color-accent-green)';
      onLabel.style.opacity = '1';
    } else {
      offLabel.style.color = 'var(--color-text-main)';
      offLabel.style.opacity = '1';
      onLabel.style.color = 'var(--color-text-muted)';
      onLabel.style.opacity = '0.4';
    }
  }

  if (triggerItem) {
    if (isAudioActive) triggerItem.classList.add('active');
    else triggerItem.classList.remove('active');
  }
}

/* =============================================================
   MÓDULO DE ACUPUNTURA REMOVEDO E INTEGRADO EN EL NUEVO ARCHIVO
   ============================================================= */



/* =============================================================
   SÍNTESIS DE SONIDOS MICRO-INTERACCIONES (AUDIO API)
============================================================= */
function playQuartzBowlRing(base = 432, duration = 3.5) {
  try {
    const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    // Simular el timbre armónico metálico/cristalino de un cuenco de cuarzo tibetano
    const osc1 = tempCtx.createOscillator();
    const osc2 = tempCtx.createOscillator();
    const osc3 = tempCtx.createOscillator();
    
    const gainNode = tempCtx.createGain();

    // Fundamental de cuenco
    osc1.frequency.value = base; // Tono base
    osc2.frequency.value = base * 1.5; // Armónico de Quinta perfecta (648Hz)
    osc3.frequency.value = base * 2; // Armónico Octava (864Hz)

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc3.type = 'sine';

    // Suave volumen de desvanecimiento lento (envolvente)
    gainNode.gain.setValueAtTime(0.2, tempCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, tempCtx.currentTime + duration);

    osc1.connect(gainNode);
    osc2.connect(gainNode);
    osc3.connect(gainNode);

    gainNode.connect(tempCtx.destination);

    osc1.start();
    osc2.start();
    osc3.start();

    osc1.stop(tempCtx.currentTime + duration + 0.5);
    osc2.stop(tempCtx.currentTime + duration + 0.5);
    osc3.stop(tempCtx.currentTime + duration + 0.5);
  } catch (e) {
    console.warn('[Audio] Failed to synthesise quartz bowl:', e);
  }
}

/* =============================================================
   GUARDAR LOG EN INDEXEDDB
============================================================= */
async function saveSessionToDB(type, duration, notes) {
  if (state.db) {
    try {
      await addData(state.db, 'sessions_log', {
        type,
        date: new Date().toISOString(),
        duration,
        notes,
        details: type === 'yoga' ? 'Secuencia Yin Asimétrica' : 
                 type === 'breathwork' ? 'Respiración de Coherencia' :
                 type === 'acupuncture' ? 'Digitopuntura Hegu' : 'Meditación de Quietud'
      });
    } catch (e) {
      console.error('[DB] Error logging session:', e);
    }
  }
}

// Iniciar aplicación
init();
