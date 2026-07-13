/**
 * Motor de síntesis de audio para MERIDIANO (Web Audio API).
 * Provee la factory function para crear instancias independientes del sintetizador
 * y funciones utilitarias de efectos de sonido temporales.
 */

export function createSynthEngine() {
  let audioCtx = null;
  let oscLeft = null;
  let oscRight = null;
  let lfo = null;
  let lfoGain = null;
  let mainGain = null;
  let isAudioActive = false;
  
  let currentBaseFreq = 432;
  let currentDiffFreq = 6.0;
  let currentAudioMode = 'binaural';

  function start(baseFreq, diffFreq, mode) {
    if (baseFreq !== undefined) currentBaseFreq = baseFreq;
    if (diffFreq !== undefined) currentDiffFreq = diffFreq;
    if (mode !== undefined) currentAudioMode = mode;

    try {
      if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }

      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }

      stopOscillatorsOnly();

      // Crear ganancia principal (suave)
      mainGain = audioCtx.createGain();
      mainGain.gain.setValueAtTime(0.0001, audioCtx.currentTime); // Iniciar en 0 para fade-in suave
      mainGain.gain.linearRampToValueAtTime(0.06, audioCtx.currentTime + 1.5); // Rampa a 0.06 en 1.5s

      if (currentAudioMode === 'binaural') {
        // Canal Izquierdo: Frecuencia Base
        oscLeft = audioCtx.createOscillator();
        oscLeft.type = 'sine';
        oscLeft.frequency.value = currentBaseFreq;

        // Canal Derecho: Frecuencia Base + Diferencial
        oscRight = audioCtx.createOscillator();
        oscRight.type = 'sine';
        oscRight.frequency.value = currentBaseFreq + currentDiffFreq;

        // Panoramización Estéreo
        const pannerLeft = audioCtx.createStereoPanner();
        const pannerRight = audioCtx.createStereoPanner();
        pannerLeft.pan.value = -1;
        pannerRight.pan.value = 1;

        oscLeft.connect(pannerLeft).connect(mainGain);
        oscRight.connect(pannerRight).connect(mainGain);
      } else {
        // Modo Isocrónico: Un único tono modulado en volumen mediante un LFO
        oscLeft = audioCtx.createOscillator();
        oscLeft.type = 'sine';
        oscLeft.frequency.value = currentBaseFreq;

        // Generar LFO (Oscilador de Baja Frecuencia) para modular el volumen
        lfo = audioCtx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = currentDiffFreq;

        // Ganancia de modulación del LFO
        lfoGain = audioCtx.createGain();
        lfoGain.gain.value = 0.04;

        lfo.connect(lfoGain).connect(mainGain.gain);
        oscLeft.connect(mainGain);

        lfo.start();
      }

      mainGain.connect(audioCtx.destination);
      oscLeft.start();
      if (oscRight) oscRight.start();

      isAudioActive = true;
      console.log(`[Audio] Synth instance running: Mode=${currentAudioMode}, Base=${currentBaseFreq}Hz, Diff=${currentDiffFreq}Hz`);
    } catch (err) {
      console.error('[Audio] Error starting synth instance:', err);
    }
  }

  function stopOscillatorsOnly() {
    if (oscLeft) {
      try { oscLeft.stop(); } catch (e) {}
      oscLeft = null;
    }
    if (oscRight) {
      try { oscRight.stop(); } catch (e) {}
      oscRight = null;
    }
    if (lfo) {
      try { lfo.stop(); } catch (e) {}
      lfo = null;
    }
    if (lfoGain) {
      lfoGain.disconnect();
      lfoGain = null;
    }
  }

  function stop() {
    if (mainGain && audioCtx) {
      const currentGain = mainGain.gain.value;
      mainGain.gain.setValueAtTime(currentGain, audioCtx.currentTime);
      mainGain.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + 1.5); // Rampa a 0 en 1.5s
      
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
    console.log('[Audio] Synth instance stopped with Fade out.');
  }

  function update(baseFreq, diffFreq) {
    if (baseFreq !== undefined) currentBaseFreq = baseFreq;
    if (diffFreq !== undefined) currentDiffFreq = diffFreq;

    if (isAudioActive && oscLeft) {
      if (currentAudioMode === 'binaural') {
        oscLeft.frequency.setValueAtTime(currentBaseFreq, audioCtx.currentTime);
        if (oscRight) oscRight.frequency.setValueAtTime(currentBaseFreq + currentDiffFreq, audioCtx.currentTime);
      } else {
        oscLeft.frequency.setValueAtTime(currentBaseFreq, audioCtx.currentTime);
        if (lfo) lfo.frequency.setValueAtTime(currentDiffFreq, audioCtx.currentTime);
      }
    }
  }

  function getState() {
    return {
      baseFreq: currentBaseFreq,
      diffFreq: currentDiffFreq,
      audioMode: currentAudioMode,
      isAudioActive: isAudioActive
    };
  }

  function destroy() {
    stop();
    if (audioCtx) {
      const ctx = audioCtx;
      setTimeout(() => {
        try {
          if (ctx && ctx.state !== 'closed') {
            ctx.close();
          }
        } catch (e) {}
      }, 1800);
      audioCtx = null;
    }
  }

  return {
    start,
    stop,
    update,
    getState,
    destroy
  };
}

/**
 * Genera el timbre armónico de un cuenco tibetano / de cuarzo de forma autónoma.
 */
export function playQuartzBowlRing(base = 432, duration = 3.5) {
  try {
    const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
    
    const osc1 = tempCtx.createOscillator();
    const osc2 = tempCtx.createOscillator();
    const osc3 = tempCtx.createOscillator();
    
    const gainNode = tempCtx.createGain();

    osc1.frequency.value = base;
    osc2.frequency.value = base * 1.5; // Quinta
    osc3.frequency.value = base * 2.0; // Octava

    osc1.type = 'sine';
    osc2.type = 'sine';
    osc3.type = 'sine';

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
