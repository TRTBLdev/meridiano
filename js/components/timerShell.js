const TUNER_PRESETS = [
  { value: 7.83, label: '7.83 Hz', description: 'Resonancia Schumann' },
  { value: 174, label: '174 Hz', description: 'Alivio del dolor' },
  { value: 285, label: '285 Hz', description: 'Regeneracion de tejidos' },
  { value: 396, label: '396 Hz', description: 'Liberar miedo y culpa' },
  { value: 417, label: '417 Hz', description: 'Facilitar el cambio' },
  { value: 432, label: '432 Hz', description: 'Calma y armonia natural' },
  { value: 528, label: '528 Hz', description: 'Transformacion y milagro' },
  { value: 639, label: '639 Hz', description: 'Conexion y relaciones' },
  { value: 741, label: '741 Hz', description: 'Desintoxicacion (Limpieza)' },
  { value: 852, label: '852 Hz', description: 'Despertar de la intuicion' },
  { value: 963, label: '963 Hz', description: 'Conexion universal / Unidad' }
];

const FREQ_DESCRIPTIONS = {
  174: '174 Hz - Alivio del dolor',
  285: '285 Hz - Regeneracion de tejidos',
  396: '396 Hz - Liberar miedo y culpa',
  417: '417 Hz - Facilitar el cambio',
  432: '432 Hz - Calma y armonia natural',
  528: '528 Hz - Transformacion y milagro',
  639: '639 Hz - Conexion y relaciones',
  741: '741 Hz - Despertar de la intuicion',
  852: '852 Hz - Retorno al orden espiritual',
  963: '963 Hz - Conexion universal / Unidad'
};

export function getFreqLabel(freq) {
  const freqNum = parseFloat(freq);
  for (const key of Object.keys(FREQ_DESCRIPTIONS)) {
    if (Math.abs(parseFloat(key) - freqNum) < 0.05) return FREQ_DESCRIPTIONS[key];
  }
  const displayVal = freqNum % 1 === 0 ? freqNum.toFixed(0) : freqNum.toFixed(1);
  return `${displayVal} Hz`;
}

export function getWaveStateName(freq) {
  if (freq <= 4.0) return 'DELTA';
  if (freq <= 8.0) return 'THETA';
  if (freq <= 12.0) return 'ALPHA';
  return 'BETA';
}

export function valueToFreq(v) {
  if (v <= 25) return 0.5 + (v / 25) * 3.5;
  if (v <= 50) return 4.0 + ((v - 25) / 25) * 4.0;
  if (v <= 75) return 8.0 + ((v - 50) / 25) * 4.0;
  return 12.0 + ((v - 75) / 25) * 18.0;
}

export function freqToValue(f) {
  if (f <= 4.0) return ((f - 0.5) / 3.5) * 25;
  if (f <= 8.0) return 25 + ((f - 4.0) / 4.0) * 25;
  if (f <= 12.0) return 50 + ((f - 8.0) / 4.0) * 25;
  return 75 + ((f - 12.0) / 18.0) * 25;
}

export function createWakeLockController() {
  let wakeLock = null;

  return {
    async request() {
      const isEnabled = localStorage.getItem('meridiano_wakelock') !== 'false';
      if (!isEnabled || !('wakeLock' in navigator)) return;
      try {
        wakeLock = await navigator.wakeLock.request('screen');
      } catch (err) {}
    },
    async release() {
      if (!wakeLock) return;
      try {
        await wakeLock.release();
      } catch (err) {}
      wakeLock = null;
    }
  };
}

export function bindWakeLockPreference(root) {
  const switchEl = root.querySelector('#pref-wakelock-switch');
  if (!switchEl) return;
  switchEl.addEventListener('change', (event) => {
    localStorage.setItem('meridiano_wakelock', event.target.checked ? 'true' : 'false');
  });
}

export function renderWakeLockPreference(id = 'pref-wakelock-switch') {
  return `
    <div class="timer-wakelock-setting">
      <span>MANTENER PANTALLA ACTIVA</span>
      <label class="braun-switch">
        <input type="checkbox" id="${id}" ${localStorage.getItem('meridiano_wakelock') !== 'false' ? 'checked' : ''}>
        <span class="braun-switch-slider"></span>
      </label>
    </div>
  `;
}

export function populateTimerDots(gridContainer, count = 5184) {
  gridContainer.innerHTML = '';
  const fragment = document.createDocumentFragment();
  for (let i = 0; i < count; i++) {
    const dot = document.createElement('div');
    dot.className = 'acu-dot';
    fragment.appendChild(dot);
  }
  gridContainer.appendChild(fragment);
  return gridContainer.querySelectorAll('.acu-dot');
}

export function createTimerShell({
  gridId,
  content,
  className = '',
  style = '',
  gridStyle = ''
}) {
  const timerEl = document.createElement('div');
  timerEl.className = `acu-timer-fullscreen timer-shell fade-in ${className}`.trim();
  if (style) timerEl.style.cssText = style;
  timerEl.innerHTML = `
    <div class="acu-fullscreen-bg grid-36 timer-shell-grid" id="${gridId}" style="${gridStyle}"></div>
    <div class="timer-shell-stage">
      ${content}
    </div>
  `;
  return timerEl;
}

export function renderSynthPanel({
  idPrefix,
  baseFreq,
  diffFreq,
  audioMode,
  isAudioActive,
  accent = 'var(--color-accent-green)',
  label = 'Sintetizador',
  compact = false,
  dark = false,
  statusWithWave = false,
  optionClass = 'timer-dropdown-option',
  headerRightId = ''
}) {
  const status = isAudioActive
    ? `${diffFreq.toFixed(1)} Hz${statusWithWave ? ` (${getWaveStateName(diffFreq)})` : ''}`
    : 'Off';
  const baseLabel = getFreqLabel(baseFreq);
  const optionStyle = dark ? 'color:#E8E6E3;' : '';

  return `
    <div class="acu-tuner-accordion timer-synth-panel ${compact ? 'is-compact' : ''} ${dark ? 'is-dark' : ''}" id="${idPrefix}-tuner-panel">
      <div class="tuner-accordion-header timer-synth-header">
        <div class="timer-synth-title">
          <span class="tuner-arrow">&#9656;</span>
          <span>${label}</span>
        </div>
        <div class="timer-synth-status" ${headerRightId ? `id="${headerRightId}"` : ''} onclick="event.stopPropagation();">
          <span id="${idPrefix}-tuner-status" style="color:${isAudioActive ? accent : 'var(--color-text-muted)'};">${status}</span>
          <label class="braun-switch">
            <input type="checkbox" id="${idPrefix}-audio-switch" ${isAudioActive ? 'checked' : ''}>
            <span class="braun-switch-slider"></span>
          </label>
        </div>
      </div>

      <div id="${idPrefix}-tuner-content" class="timer-synth-content">
        <div class="timer-synth-row">
          <span class="timer-synth-label">Modo de Onda</span>
          <div class="timer-synth-radio-row">
            <label><input type="radio" name="${idPrefix}-audio-mode" value="binaural" ${audioMode === 'binaural' ? 'checked' : ''}> Binaural</label>
            <label><input type="radio" name="${idPrefix}-audio-mode" value="isochronic" ${audioMode === 'isochronic' ? 'checked' : ''}> Isocronico</label>
          </div>
        </div>

        <div class="timer-synth-row">
          <span class="timer-synth-label">Tono Base</span>
          <div class="custom-tuner-dropdown" id="${idPrefix}-base-dropdown-container">
            <button type="button" class="tuner-dropdown-trigger" id="${idPrefix}-base-dropdown-trigger">
              <span id="${idPrefix}-base-selected-text">${baseLabel}</span>
              <svg class="dropdown-chevron" viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </button>
            <div class="tuner-dropdown-options" id="${idPrefix}-base-dropdown-options">
              ${TUNER_PRESETS.map(p => `
                <div class="${optionClass} tuner-dropdown-option" data-value="${p.value}" style="${optionStyle}">
                  <strong>${p.label}</strong> - ${p.description}
                </div>
              `).join('')}
            </div>
          </div>
          <input type="range" id="${idPrefix}-base-slider" class="tuner-slider" min="5" max="1000" step="0.1" value="${baseFreq}">
          <div class="timer-synth-readout" id="${idPrefix}-base-readout">${baseLabel}</div>
        </div>

        <div class="timer-synth-row">
          <div class="timer-synth-meta">
            <span>ESTADO CEREBRAL</span>
            <span id="${idPrefix}-diff-label">${diffFreq.toFixed(1)} Hz</span>
          </div>
          <input type="range" id="${idPrefix}-diff-slider" class="tuner-slider" min="0" max="100" step="1" value="${freqToValue(diffFreq)}">
          <div class="timer-synth-scale">
            <span>DELTA</span>
            <span>THETA</span>
            <span>ALPHA</span>
            <span>BETA</span>
          </div>
        </div>
      </div>
    </div>
  `;
}

export function bindSynthPanel({
  root,
  idPrefix,
  getState,
  setState,
  appController,
  onChange = () => {},
  statusWithWave = false,
  accent = 'var(--color-accent-green)'
}) {
  const header = root.querySelector(`#${idPrefix}-tuner-panel .tuner-accordion-header`);
  const content = root.querySelector(`#${idPrefix}-tuner-content`);
  const arrow = root.querySelector(`#${idPrefix}-tuner-panel .tuner-arrow`);
  const status = root.querySelector(`#${idPrefix}-tuner-status`);
  const audioSwitch = root.querySelector(`#${idPrefix}-audio-switch`);
  const baseSlider = root.querySelector(`#${idPrefix}-base-slider`);
  const baseReadout = root.querySelector(`#${idPrefix}-base-readout`);
  const baseTrigger = root.querySelector(`#${idPrefix}-base-dropdown-trigger`);
  const baseOptionsContainer = root.querySelector(`#${idPrefix}-base-dropdown-options`);
  const baseSelectedText = root.querySelector(`#${idPrefix}-base-selected-text`);
  const baseOptions = root.querySelectorAll(`#${idPrefix}-base-dropdown-options [data-value]`);
  const diffSlider = root.querySelector(`#${idPrefix}-diff-slider`);
  const diffLabel = root.querySelector(`#${idPrefix}-diff-label`);
  const modeRadios = root.querySelectorAll(`input[name="${idPrefix}-audio-mode"]`);

  const sync = () => {
    const state = getState();
    const label = getFreqLabel(state.baseFreq);
    const active = state.isAudioActive;
    if (status) {
      status.textContent = active
        ? `${state.diffFreq.toFixed(1)} Hz${statusWithWave ? ` (${getWaveStateName(state.diffFreq)})` : ''}`
        : 'Off';
      status.style.color = active ? accent : 'var(--color-text-muted)';
    }
    if (audioSwitch) audioSwitch.checked = active;
    if (baseSlider) baseSlider.value = state.baseFreq;
    if (baseSelectedText) baseSelectedText.textContent = label;
    if (baseReadout) baseReadout.textContent = label;
    if (diffSlider) diffSlider.value = freqToValue(state.diffFreq);
    if (diffLabel) diffLabel.textContent = `${state.diffFreq.toFixed(1)} Hz`;
    modeRadios.forEach(radio => {
      radio.checked = radio.value === state.audioMode;
    });
    baseOptions.forEach(option => {
      const optionValue = parseFloat(option.getAttribute('data-value'));
      option.classList.toggle('active', Math.abs(optionValue - state.baseFreq) < 0.05);
    });
  };

  const applyAudio = ({ restart = false } = {}) => {
    const state = getState();
    if (!appController) return;
    if (state.isAudioActive) {
      if (restart) appController.startAudio(state.baseFreq, state.diffFreq, state.audioMode);
      else appController.updateAudioFreqs(state.baseFreq, state.diffFreq);
    }
  };

  if (header && content) {
    header.addEventListener('click', (event) => {
      if (event.target.closest('.braun-switch') || event.target.closest('input')) return;
      const isVisible = content.style.display === 'flex';
      content.style.display = isVisible ? 'none' : 'flex';
      if (arrow) arrow.style.transform = isVisible ? 'rotate(0deg)' : 'rotate(90deg)';
      const panel = header.closest('.acu-tuner-accordion');
      if (panel) {
        panel.classList.toggle('is-expanded', !isVisible);
      }
    });
  }

  if (audioSwitch) {
    audioSwitch.addEventListener('change', (event) => {
      setState({ isAudioActive: event.target.checked });
      const state = getState();
      if (appController) {
        if (state.isAudioActive) appController.startAudio(state.baseFreq, state.diffFreq, state.audioMode);
        else appController.stopAudio();
      }
      sync();
      onChange(state);
    });
  }

  modeRadios.forEach(radio => {
    radio.addEventListener('change', (event) => {
      setState({ audioMode: event.target.value === 'isochronic' ? 'isochronic' : 'binaural' });
      applyAudio({ restart: true });
      sync();
      onChange(getState());
    });
  });

  if (baseSlider) {
    baseSlider.addEventListener('input', () => {
      setState({ baseFreq: parseFloat(baseSlider.value) });
      applyAudio();
      sync();
      onChange(getState());
    });
  }

  if (baseTrigger && baseOptionsContainer) {
    baseTrigger.addEventListener('click', (event) => {
      event.stopPropagation();
      const isVisible = baseOptionsContainer.style.display === 'block';
      baseOptionsContainer.style.display = isVisible ? 'none' : 'block';
      baseTrigger.classList.toggle('open', !isVisible);
    });

    document.addEventListener('click', (event) => {
      if (!event.target.closest(`#${idPrefix}-base-dropdown-container`)) {
        baseOptionsContainer.style.display = 'none';
        baseTrigger.classList.remove('open');
      }
    });
  }

  baseOptions.forEach(option => {
    option.addEventListener('click', () => {
      setState({ baseFreq: parseFloat(option.getAttribute('data-value')) });
      if (baseOptionsContainer) baseOptionsContainer.style.display = 'none';
      if (baseTrigger) baseTrigger.classList.remove('open');
      applyAudio();
      sync();
      onChange(getState());
    });
  });

  if (diffSlider) {
    diffSlider.addEventListener('input', () => {
      setState({ diffFreq: valueToFreq(parseInt(diffSlider.value)) });
      applyAudio();
      sync();
      onChange(getState());
    });
  }

  sync();
  return { sync };
}
