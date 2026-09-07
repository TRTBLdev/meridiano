/**
 * Utilidades para secuencias de bloques de meditación en MERIDIANO.
 */

/**
 * Calcula la duración total en segundos a partir de una lista de bloques.
 * @param {Array<{mins?: number, secs?: number}>} blocks 
 * @returns {number} Duración total en segundos
 */
export function calculateSequenceDuration(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return 0;
  return blocks.reduce((acc, b) => {
    const mins = Math.max(0, Number(b.mins) || 0);
    const secs = Math.max(0, Math.min(59, Number(b.secs) || 0));
    return acc + (mins * 60) + secs;
  }, 0);
}

/**
 * Valida que una secuencia de meditación tenga una estructura y tiempos válidos.
 * @param {Object} sequence 
 * @returns {{ isValid: boolean, reason: string }}
 */
export function validateMeditationSequence(sequence) {
  if (!sequence || typeof sequence !== 'object') {
    return { isValid: false, reason: 'La secuencia no tiene un formato válido.' };
  }

  const name = typeof sequence.name === 'string' ? sequence.name.trim() : '';
  if (!name) {
    return { isValid: false, reason: 'La secuencia debe tener un nombre.' };
  }

  if (!Array.isArray(sequence.blocks) || sequence.blocks.length === 0) {
    return { isValid: false, reason: 'La secuencia debe contener al menos un bloque.' };
  }

  if (sequence.blocks.length > 7) {
    return { isValid: false, reason: 'La secuencia no puede superar el límite de 7 bloques.' };
  }

  for (let i = 0; i < sequence.blocks.length; i++) {
    const b = sequence.blocks[i];
    if (!b || typeof b !== 'object') {
      return { isValid: false, reason: `El bloque ${i + 1} no tiene un formato válido.` };
    }
    const blockName = typeof b.name === 'string' ? b.name.trim() : '';
    if (!blockName) {
      return { isValid: false, reason: `El bloque ${i + 1} debe tener un nombre.` };
    }
    const mins = Math.max(0, Number(b.mins) || 0);
    const secs = Math.max(0, Number(b.secs) || 0);
    if (mins === 0 && secs === 0) {
      return { isValid: false, reason: `El bloque "${blockName}" debe tener una duración mayor a 0.` };
    }
  }

  const total = calculateSequenceDuration(sequence.blocks);
  if (total <= 0) {
    return { isValid: false, reason: 'La duración total de la secuencia debe ser mayor a 0 segundos.' };
  }

  return { isValid: true, reason: '' };
}

/**
 * Genera un texto resumen conciso de los bloques para guardar en el historial (details de sessions_log).
 * Ej: "Fase 1 (5m 0s) · Fase 2 (10m 30s)"
 * @param {Array<{name?: string, mins?: number, secs?: number}>} blocks 
 * @returns {string}
 */
export function formatSequenceBlocksSummary(blocks) {
  if (!Array.isArray(blocks) || blocks.length === 0) return 'Sin bloques';
  return blocks.map((b, idx) => {
    const name = (b.name || `Bloque ${idx + 1}`).trim();
    const mins = Number(b.mins) || 0;
    const secs = Number(b.secs) || 0;
    const timeStr = secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
    return `${name} (${timeStr})`;
  }).join(' · ');
}

/**
 * Normaliza y sanea el objeto de secuencia para almacenamiento en IndexedDB.
 * @param {Object} raw 
 * @returns {Object} Secuencia normalizada
 */
export function sanitizeMeditationSequence(raw) {
  const blocks = (Array.isArray(raw.blocks) ? raw.blocks : []).map((b, idx) => ({
    name: (b.name && String(b.name).trim()) || `Bloque ${idx + 1}`,
    mins: Math.max(0, parseInt(b.mins, 10) || 0),
    secs: Math.max(0, Math.min(59, parseInt(b.secs, 10) || 0))
  }));

  const totalDuration = calculateSequenceDuration(blocks);

  return {
    id: raw.id || `med-seq-${Date.now()}`,
    name: (raw.name && String(raw.name).trim()) || 'Secuencia de Meditación',
    description: (raw.description && String(raw.description).trim()) || '',
    blocks,
    totalDuration
  };
}
