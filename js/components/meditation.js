import { addData } from '../db.js';
import { renderDotMatrix } from '../utils/dotmatrix.js';
import {
  bindSynthPanel,
  bindWakeLockPreference,
  createTimerShell,
  createWakeLockController,
  freqToValue,
  getFreqLabel,
  getWaveStateName,
  populateTimerDots,
  renderSynthPanel,
  renderWakeLockPreference,
  valueToFreq
} from './timerShell.js';

export async function renderMeditationScreen(container, db, onNavigate, appController) {
  let activeView = 'lobby';

  let durationMins = 5;
  let durationSecs = 0;
  let bellMins = 0;
  let bellSecs = 0;
  let intervalType = 'equidistant';
  let randomBellsCount = 3;
  let blocks = [
    { name: 'Fase Inicial', mins: 5, secs: 0 },
    { name: 'Fase Profunda', mins: 5, secs: 0 }
  ];

  let randomTimes = [];
  let blockBoundaries = [];
  let localFreq = 6.0;
  let localBaseFreq = 432;
  let localAudioMode = 'binaural';
  let localAudioActive = false;

  let timerInterval = null;
  let timeLeft = 0;
  let totalDuration = 0;
  let elapsedSeconds = 0;
  let isPaused = false;
  const wakeLockController = createWakeLockController();

  const syncWithGlobalTuner = () => {
    if (!appController || typeof appController.getAudioState !== 'function') return;
    const tunerState = appController.getAudioState();
    localBaseFreq = tunerState.baseFreq;
    localFreq = tunerState.diffFreq;
    localAudioMode = tunerState.audioMode;
    localAudioActive = tunerState.isAudioActive;
  };

  const render = () => {
    container.innerHTML = '';
    if (activeView === 'timer') renderTimer();
    else renderLobby();
  };

  function renderLobby() {
    syncWithGlobalTuner();
    const lobbyEl = document.createElement('div');
    lobbyEl.className = 'dashboard-layout fade-in';
    lobbyEl.innerHTML = `
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

      <main class="main-viewport meditation-lobby-viewport">
        <div class="glass-panel meditation-lobby-panel">
          <h2 class="module-lobby-title" style="margin-bottom: 24px;">MEDITACIÓN</h2>

          <div class="timer-config-group">
            <label>TIPO DE INTERVALO</label>
            <div class="segmented-control">
              <button type="button" class="segment-btn ${intervalType === 'equidistant' ? 'active' : ''}" data-type="equidistant">Fijos</button>
              <button type="button" class="segment-btn ${intervalType === 'random' ? 'active' : ''}" data-type="random">Aleatorios</button>
              <button type="button" class="segment-btn ${intervalType === 'sequential' ? 'active' : ''}" data-type="sequential">Secuencias</button>
            </div>
          </div>

          <div id="interval-settings-container" class="meditation-interval-settings"></div>

          ${renderWakeLockPreference()}

          <div style="display: flex; justify-content: flex-end; margin-top: 24px;">
            <button id="btn-med-start" class="btn-play-header" title="Iniciar Meditación" style="width: 54px; height: 54px; display: flex; align-items: center; justify-content: center; background: var(--color-text-main); color: var(--color-bg-base); border-radius: 50%; border: none;">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style="margin-left: 2px;">
                <polygon points="6 4 19 12 6 20 6 4"></polygon>
              </svg>
            </button>
          </div>
        </div>
      </main>
    `;

    container.appendChild(lobbyEl);
    bindWakeLockPreference(lobbyEl);

    const intervalContainer = lobbyEl.querySelector('#interval-settings-container');

    const renderIntervalSettings = () => {
      if (intervalType === 'sequential') {
        const totalSeconds = blocks.reduce((sum, block) => sum + block.mins * 60 + block.secs, 0);
        const totalLabel = `${Math.floor(totalSeconds / 60)}m ${totalSeconds % 60}s`;
        intervalContainer.innerHTML = `
          <div class="timer-config-group">
            <div class="timer-config-heading">
              <label>SECUENCIA DE BLOQUES</label>
              <span style="font-family: var(--font-digital); color: var(--color-text-muted); font-size: 0.75rem;">TOTAL: ${totalLabel}</span>
            </div>
            <div class="meditation-block-list">
              ${blocks.map((block, index) => `
                <div class="meditation-block-row" data-index="${index}" style="display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 12px 0; border-bottom: 1px dashed rgba(46,43,40,0.1);">
                  <input type="text" class="block-name-input acu-input-flat" value="${block.name || 'Bloque ' + (index+1)}" style="flex: 1; min-width: 100px; font-size: 0.8rem; padding: 4px; background: transparent; border: none; border-bottom: 1px solid rgba(46,43,40,0.2);">
                  <div style="display: flex; gap: 4px; align-items: center;">
                    <input type="number" class="block-mins-input acu-step-num-input" min="0" max="60" value="${block.mins}" style="width: 45px; padding: 4px;">
                    <span style="font-size: 0.75rem;">m</span>
                    <input type="number" class="block-secs-input acu-step-num-input" min="0" max="59" value="${block.secs}" style="width: 45px; padding: 4px;">
                    <span style="font-size: 0.75rem;">s</span>
                  </div>
                  <button type="button" class="btn-delete-block" title="Eliminar bloque" style="background: transparent; border: none; color: var(--color-accent-red); cursor: pointer; font-size: 1.2rem; padding: 0 4px;">×</button>
                </div>
              `).join('')}
            </div>
            <button type="button" id="btn-add-block" class="btn-block-action" style="margin-top: 16px; background: transparent; border: 1px solid rgba(46,43,40,0.2); border-radius: 4px; padding: 8px; width: 100%; font-size: 0.8rem; cursor: pointer;" ${blocks.length >= 7 ? 'disabled' : ''}>+ Añadir Bloque (${blocks.length}/7)</button>
          </div>
        `;

        intervalContainer.querySelectorAll('.meditation-block-row').forEach(row => {
          const index = parseInt(row.dataset.index);
          row.querySelector('.block-name-input').addEventListener('change', (event) => {
            blocks[index].name = event.target.value;
          });
          row.querySelector('.block-mins-input').addEventListener('input', (event) => {
            blocks[index].mins = Math.max(0, parseInt(event.target.value) || 0);
            renderIntervalSettings();
          });
          row.querySelector('.block-secs-input').addEventListener('input', (event) => {
            blocks[index].secs = Math.max(0, Math.min(59, parseInt(event.target.value) || 0));
            renderIntervalSettings();
          });
          row.querySelector('.btn-delete-block').addEventListener('click', () => {
            if (blocks.length <= 1) {
              alert('La sesión debe contener al menos un bloque.');
              return;
            }
            blocks.splice(index, 1);
            renderIntervalSettings();
          });
        });

        const addBlock = intervalContainer.querySelector('#btn-add-block');
        if (addBlock) {
          addBlock.addEventListener('click', () => {
            if (blocks.length >= 7) {
              alert('Se ha alcanzado el límite máximo de 7 bloques por sesión.');
              return;
            }
            blocks.push({ name: `Bloque ${blocks.length + 1}`, mins: 5, secs: 0 });
            renderIntervalSettings();
          });
        }
        return;
      }

      intervalContainer.innerHTML = `
        <div class="timer-config-group">
          <label>DURACIÓN DE MEDITACIÓN</label>
          <div class="timer-time-row">
            <input type="number" id="lobby-med-mins" class="acu-step-num-input" min="0" max="180" value="${durationMins}">
            <span>min</span>
            <input type="number" id="lobby-med-secs" class="acu-step-num-input" min="0" max="59" value="${durationSecs}">
            <span>seg</span>
          </div>
        </div>

        ${intervalType === 'equidistant' ? `
          <div class="timer-config-group is-separated">
            <label>CAMPANAS DE INTERVALO</label>
            <div class="timer-time-row">
              <input type="number" id="lobby-bell-mins" class="acu-step-num-input" min="0" max="59" value="${bellMins}">
              <span>min</span>
              <input type="number" id="lobby-bell-secs" class="acu-step-num-input" min="0" max="59" value="${bellSecs}">
              <span>seg</span>
            </div>
            <p>Sonidos equidistantes durante la meditación.</p>
          </div>
        ` : `
          <div class="timer-config-group is-separated">
            <label>CANTIDAD DE CAMPANAS</label>
            <select id="lobby-random-bells" class="acu-step-num-input meditation-select">
              ${[1, 2, 3, 4, 5, 6, 7, 8].map(n => `<option value="${n}" ${n === randomBellsCount ? 'selected' : ''}>${n} campanas</option>`).join('')}
            </select>
            <p>Las campanas sonarán a intervalos aleatorios e impredecibles.</p>
          </div>
        `}
      `;

      intervalContainer.querySelector('#lobby-med-mins').addEventListener('input', (event) => {
        durationMins = Math.max(0, parseInt(event.target.value) || 0);
      });
      intervalContainer.querySelector('#lobby-med-secs').addEventListener('input', (event) => {
        durationSecs = Math.max(0, Math.min(59, parseInt(event.target.value) || 0));
      });

      if (intervalType === 'equidistant') {
        intervalContainer.querySelector('#lobby-bell-mins').addEventListener('input', (event) => {
          bellMins = Math.max(0, parseInt(event.target.value) || 0);
        });
        intervalContainer.querySelector('#lobby-bell-secs').addEventListener('input', (event) => {
          bellSecs = Math.max(0, Math.min(59, parseInt(event.target.value) || 0));
        });
      } else {
        intervalContainer.querySelector('#lobby-random-bells').addEventListener('change', (event) => {
          randomBellsCount = parseInt(event.target.value) || 3;
        });
      }
    };

    lobbyEl.querySelectorAll('.segment-btn').forEach(button => {
      button.addEventListener('click', () => {
        intervalType = button.dataset.type;
        lobbyEl.querySelectorAll('.segment-btn').forEach(item => item.classList.remove('active'));
        button.classList.add('active');
        renderIntervalSettings();
      });
    });

    lobbyEl.querySelector('#btn-back-home').addEventListener('click', () => onNavigate('inicio'));
    lobbyEl.querySelector('#btn-med-start').addEventListener('click', startMeditation);
    renderIntervalSettings();
  }

  function startMeditation() {
    randomTimes = [];
    blockBoundaries = [];

    if (intervalType === 'sequential') {
      totalDuration = blocks.reduce((sum, block) => sum + block.mins * 60 + block.secs, 0);
      let boundary = 0;
      blocks.forEach(block => {
        boundary += block.mins * 60 + block.secs;
        blockBoundaries.push(boundary);
      });
    } else {
      totalDuration = durationMins * 60 + durationSecs;
      if (intervalType === 'random' && totalDuration > 60) {
        const minGap = 45;
        let attempts = 0;
        while (randomTimes.length < randomBellsCount && attempts < 200) {
          const randomSecond = Math.floor(Math.random() * (totalDuration - 60)) + 30;
          if (!randomTimes.some(time => Math.abs(time - randomSecond) < minGap)) {
            randomTimes.push(randomSecond);
          }
          attempts++;
        }
        randomTimes.sort((a, b) => a - b);
      }
    }

    if (totalDuration <= 0) {
      alert('Por favor, indica una duración mayor a 0 segundos.');
      return;
    }

    timeLeft = totalDuration;
    elapsedSeconds = 0;
    isPaused = false;
    activeView = 'timer';
    render();
  }

  function renderTimer() {
    let gridAnimFrame = null;
    let phaseStartTime = Date.now();
    let phaseElapsedBeforePause = 0;
    const totalDotsCount = 5184;
    const bellIntervalSeconds = bellMins * 60 + bellSecs;
    const canSkip = intervalType === 'sequential' && blocks.length > 1;

    const timerEl = createTimerShell({
      gridId: 'meditation-dots-grid',
      className: 'meditation-active-timer',
      content: `
        <div id="med-countdown-matrix" class="acu-timer-dot-display yoga-timer-dot-display meditation-timer-clock"></div>
        <div id="med-subtle-readout" class="timer-subtle-readout"></div>

        <div id="med-timer-controls" class="timer-minimal-controls">
          ${renderSynthPanel({
            idPrefix: 'med-active',
            baseFreq: localBaseFreq,
            diffFreq: localFreq,
            audioMode: localAudioMode,
            isAudioActive: localAudioActive,
            statusWithWave: false,
            compact: true,
            dark: true,
            optionClass: 'timer-dropdown-option'
          })}

          <div class="timer-icon-controls">
            <div class="timer-icon-control-group">
              <button class="btn-acu-icon btn-acu-active" id="btn-med-flow" title="Pausar" style="width:48px; height:48px; display:flex; align-items:center; justify-content:center; pointer-events:auto; cursor:pointer;">
                <svg id="svg-med-flow-icon" viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <rect x="6" y="4" width="3" height="16" rx="1"></rect>
                  <rect x="15" y="4" width="3" height="16" rx="1"></rect>
                </svg>
              </button>
              <span id="lbl-med-flow">Pausar</span>
            </div>

            <div class="timer-icon-control-group">
              <button class="btn-acu-icon" id="btn-med-skip" title="Saltar bloque" ${canSkip ? '' : 'disabled'} style="width:48px; height:48px; display:flex; align-items:center; justify-content:center; pointer-events:auto; cursor:pointer; ${canSkip ? '' : 'opacity:0.35; pointer-events:none;'}">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="4 3 13 12 4 21 4 3" fill="currentColor"></polygon>
                  <line x1="17" y1="4" x2="17" y2="20"></line>
                </svg>
              </button>
              <span>Saltar</span>
            </div>

            <div class="timer-icon-control-group">
              <button class="btn-acu-icon btn-acu-danger" id="btn-med-stop" title="Detener" style="width:48px; height:48px; display:flex; align-items:center; justify-content:center; pointer-events:auto; cursor:pointer;">
                <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                  <rect x="5" y="5" width="14" height="14" rx="1"></rect>
                </svg>
              </button>
              <span>Detener</span>
            </div>
          </div>
        </div>
      `
    });

    container.appendChild(timerEl);
    const dots = populateTimerDots(timerEl.querySelector('#meditation-dots-grid'), totalDotsCount);
    const countdownMatrix = timerEl.querySelector('#med-countdown-matrix');
    const subtleReadout = timerEl.querySelector('#med-subtle-readout');
    const controls = timerEl.querySelector('#med-timer-controls');
    const btnFlow = timerEl.querySelector('#btn-med-flow');
    const btnSkip = timerEl.querySelector('#btn-med-skip');
    const btnStop = timerEl.querySelector('#btn-med-stop');
    const flowIcon = timerEl.querySelector('#svg-med-flow-icon');
    const flowLabel = timerEl.querySelector('#lbl-med-flow');

    const getAudioState = () => ({
      baseFreq: localBaseFreq,
      diffFreq: localFreq,
      audioMode: localAudioMode,
      isAudioActive: localAudioActive
    });

    const setAudioState = (next) => {
      if (next.baseFreq !== undefined) localBaseFreq = next.baseFreq;
      if (next.diffFreq !== undefined) localFreq = next.diffFreq;
      if (next.audioMode !== undefined) localAudioMode = next.audioMode;
      if (next.isAudioActive !== undefined) localAudioActive = next.isAudioActive;
    };

    const getElapsedMs = () => (
      isPaused ? phaseElapsedBeforePause : phaseElapsedBeforePause + (Date.now() - phaseStartTime)
    );

    const getSequentialIndex = () => {
      const activeBlockIndex = blockBoundaries.findIndex(boundary => elapsedSeconds < boundary);
      return activeBlockIndex === -1 ? blockBoundaries.length - 1 : activeBlockIndex;
    };

    const updateDisplay = () => {
      const mins = Math.floor(Math.max(0, timeLeft) / 60);
      const secs = Math.max(0, timeLeft) % 60;
      renderDotMatrix(countdownMatrix, `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`);

      let readout = '';
      if (intervalType === 'sequential') {
        const safeBlockIndex = getSequentialIndex();
        const blockStart = safeBlockIndex === 0 ? 0 : blockBoundaries[safeBlockIndex - 1];
        const blockEnd = blockBoundaries[safeBlockIndex] || totalDuration;
        const blockTimeLeft = Math.max(0, blockEnd - elapsedSeconds);
        const blockName = blocks[safeBlockIndex]?.name || `Bloque ${safeBlockIndex + 1}`;
        readout = `${blockName} - ${String(Math.floor(blockTimeLeft / 60)).padStart(2, '0')}:${String(blockTimeLeft % 60).padStart(2, '0')}`;
      }
      subtleReadout.textContent = readout;
      subtleReadout.hidden = !readout;
    };

    const synthController = bindSynthPanel({
      root: timerEl,
      idPrefix: 'med-active',
      appController,
      statusWithWave: false,
      getState: getAudioState,
      setState: setAudioState,
      onChange: updateDisplay
    });

    const updateGrid = () => {
      const safeElapsed = Math.min(Math.max(getElapsedMs() / 1000, 0), totalDuration);
      const activeDotsLimit = Math.min(totalDotsCount, Math.floor((safeElapsed / totalDuration) * totalDotsCount));
      dots.forEach((dot, index) => {
        if (index < activeDotsLimit) {
          dot.style.setProperty('--dot-color', '#E8E6E3');
          dot.style.setProperty('--dot-glow', 'rgba(232, 230, 227, 0.55)');
          dot.classList.add('dot-on');
        } else if (dot.classList.contains('dot-on')) {
          dot.style.removeProperty('--dot-color');
          dot.style.removeProperty('--dot-glow');
          dot.classList.remove('dot-on');
        }
      });
    };

    const startAnimationLoop = () => {
      if (gridAnimFrame) return;
      const loop = () => {
        updateGrid();
        gridAnimFrame = requestAnimationFrame(loop);
      };
      gridAnimFrame = requestAnimationFrame(loop);
    };

    const stopAnimationLoop = () => {
      if (!gridAnimFrame) return;
      cancelAnimationFrame(gridAnimFrame);
      gridAnimFrame = null;
    };

    const setPaused = (paused) => {
      isPaused = paused;
      btnFlow.classList.toggle('btn-acu-active', !isPaused);
      btnFlow.title = isPaused ? 'Reanudar' : 'Pausar';
      flowLabel.textContent = isPaused ? 'Reanudar' : 'Pausar';
      flowIcon.innerHTML = isPaused
        ? '<polygon points="6 4 19 12 6 20 6 4"></polygon>'
        : '<rect x="6" y="4" width="3" height="16" rx="1"></rect><rect x="15" y="4" width="3" height="16" rx="1"></rect>';

      if (isPaused) {
        phaseElapsedBeforePause += Date.now() - phaseStartTime;
        stopAnimationLoop();
      } else {
        phaseStartTime = Date.now();
        startAnimationLoop();
      }
    };

    const cleanupTimer = async () => {
      clearInterval(timerInterval);
      stopAnimationLoop();
      if (localAudioActive && appController) appController.stopAudio();
      await wakeLockController.release();
    };

    const finishMeditation = async () => {
      await cleanupTimer();
      if (appController.playQuartzBowl) {
        appController.playQuartzBowl(432, 4.5);
        setTimeout(() => appController.playQuartzBowl(432, 4.0), 2000);
      }

      const durationMin = Math.max(1, Math.round(totalDuration / 60));
      const details = intervalType === 'equidistant'
        ? `Fijos: campanas cada ${bellMins}m ${bellSecs}s`
        : intervalType === 'random'
          ? `Aleatorios: ${randomBellsCount} campanas`
          : `Secuenciales: ${blocks.length} bloques`;

      try {
        await addData(db, 'sessions_log', {
          type: 'meditation',
          date: new Date().toISOString(),
          duration: durationMin,
          notes: `Meditacion silenciosa completada (${durationMin} min).`,
          details
        });
      } catch (err) {
        console.error('[Meditation] Error saving session log:', err);
      }

      alert('Sesion de meditacion completada.');
      activeView = 'lobby';
      render();
    };

    const ringIfNeeded = () => {
      if (timeLeft <= 0 || !appController.playQuartzBowl) return;
      const shouldRing = (
        (intervalType === 'equidistant' && bellIntervalSeconds > 0 && elapsedSeconds % bellIntervalSeconds === 0) ||
        (intervalType === 'random' && randomTimes.includes(elapsedSeconds)) ||
        (intervalType === 'sequential' && blockBoundaries.slice(0, -1).includes(elapsedSeconds))
      );
      if (shouldRing) appController.playQuartzBowl(648, 3.0);
    };

    timerInterval = setInterval(() => {
      if (isPaused) return;
      timeLeft--;
      elapsedSeconds++;
      updateDisplay();
      ringIfNeeded();
      if (timeLeft <= 0) finishMeditation();
    }, 1000);

    btnFlow.addEventListener('click', () => setPaused(!isPaused));

    btnSkip.addEventListener('click', () => {
      if (!canSkip) return;
      const currentIndex = getSequentialIndex();
      const nextBoundary = blockBoundaries[currentIndex] || totalDuration;
      elapsedSeconds = Math.min(nextBoundary, totalDuration);
      timeLeft = Math.max(0, totalDuration - elapsedSeconds);
      phaseStartTime = Date.now();
      phaseElapsedBeforePause = elapsedSeconds * 1000;
      if (appController.playQuartzBowl && timeLeft > 0) appController.playQuartzBowl(648, 2.4);
      updateDisplay();
      updateGrid();
      if (timeLeft <= 0) finishMeditation();
    });

    btnStop.addEventListener('click', async () => {
      const wasPaused = isPaused;
      if (!isPaused) setPaused(true);
      if (confirm('Deseas detener y cancelar la sesion actual? No se guardara en el historial.')) {
        await cleanupTimer();
        activeView = 'lobby';
        render();
      } else if (!wasPaused) {
        setPaused(false);
      }
    });

    controls.addEventListener('mousemove', () => {
      controls.style.opacity = '1';
    });

    if (appController.playQuartzBowl) appController.playQuartzBowl(432, 4.0);
    wakeLockController.request();
    updateDisplay();
    synthController.sync();
    startAnimationLoop();
  }
  const getAudioState = () => ({
    baseFreq: localBaseFreq,
    diffFreq: localFreq,
    audioMode: localAudioMode,
    isAudioActive: localAudioActive
  });

  const setAudioState = (next) => {
    if (next.baseFreq !== undefined) localBaseFreq = next.baseFreq;
    if (next.diffFreq !== undefined) localFreq = next.diffFreq;
    if (next.audioMode !== undefined) localAudioMode = next.audioMode;
    if (next.isAudioActive !== undefined) localAudioActive = next.isAudioActive;
  };

  render();
}
