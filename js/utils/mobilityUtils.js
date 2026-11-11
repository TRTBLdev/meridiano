export const MOBILITY_MODES = ['duration', 'repetitions', 'hold'];
export const MOBILITY_SIDES = ['none', 'left', 'right', 'bilateral', 'alternating'];
export const MOBILITY_CATEGORIES = ['joint_mobility', 'decompression', 'neurodynamic', 'motor_control', 'other'];
export const MOBILITY_MODE_LABELS = { duration: 'Tiempo', repetitions: 'Repeticiones', hold: 'Mantenimiento' };
export const MOBILITY_SIDE_LABELS = { none: 'Sin lado', left: 'Izquierda', right: 'Derecha', bilateral: 'Bilateral', alternating: 'Alternado' };
export const MOBILITY_CATEGORY_LABELS = { joint_mobility: 'Movilidad articular', decompression: 'Descompresión', neurodynamic: 'Neurodinamia', motor_control: 'Control motor', other: 'Otro' };

export function validateMobilityRoutine(routine, exercises) {
  if (typeof routine?.name !== 'string' || !routine.name.trim()) return 'Falta el nombre';
  if (!Array.isArray(routine.steps) || !routine.steps.length) return 'Sin pasos';
  const ids = new Set((exercises || []).map(exercise => exercise.id));
  for (const step of routine.steps) {
    if (!ids.has(step.exerciseId)) return 'Contiene ejercicios no disponibles';
    if (!MOBILITY_MODES.includes(step.mode) || !MOBILITY_SIDES.includes(step.side) || !Number.isInteger(Number(step.targetValue)) || Number(step.targetValue) <= 0 || !Number.isFinite(Number(step.transitionAfter)) || Number(step.transitionAfter) < 0) return 'Prescripción inválida';
  }
  return '';
}

export function buildMobilityPhases(routine, exercises) {
  const byId = new Map((exercises || []).map(exercise => [exercise.id, exercise]));
  const phases = [];
  (routine?.steps || []).forEach((step, index) => {
    const exercise = byId.get(step.exerciseId);
    if (!exercise) return;
    phases.push({ type: 'exercise', index, step, exercise });
    if (index < routine.steps.length - 1 && Number(step.transitionAfter) > 0) phases.push({ type: 'transition', index, duration: Number(step.transitionAfter) });
  });
  return phases;
}

export function estimateMobilityDuration(routine) {
  return (routine?.steps || []).reduce((total, step, index, steps) => total + (Number(step.targetValue) || 0) * (step.mode === 'repetitions' ? 4 : 1) + (index < steps.length - 1 ? Number(step.transitionAfter) || 0 : 0), 0);
}

export function recordMobilityEntry(entries, phase, status, elapsedSeconds) {
  const entry = { stepIndex: phase.index, exerciseId: phase.exercise.id, exerciseName: phase.exercise.name, mode: phase.step.mode, targetValue: Number(phase.step.targetValue), side: phase.step.side, status, elapsedSeconds: Math.max(0, Math.round(elapsedSeconds)) };
  return [...entries.filter(item => item.stepIndex !== phase.index), entry];
}
