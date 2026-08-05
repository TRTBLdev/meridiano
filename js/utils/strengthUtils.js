export function getStrengthExercise(exercises, id) {
  return (exercises || []).find(exercise => exercise.id === id) || null;
}

export function getCircuitValidation(circuit, exercises) {
  const entries = Array.isArray(circuit?.exercises) ? circuit.exercises : [];
  const missingExerciseIds = entries
    .map(entry => entry.exerciseId)
    .filter(id => !getStrengthExercise(exercises, id));

  if (entries.length === 0) {
    return { isValid: false, isEmpty: true, missingExerciseIds, reason: 'Sin ejercicios' };
  }
  if (missingExerciseIds.length > 0) {
    return { isValid: false, isEmpty: false, missingExerciseIds, reason: 'Contiene ejercicios no disponibles' };
  }
  const hasInvalidPrescription = entries.some(entry => {
    const exercise = getStrengthExercise(exercises, entry.exerciseId);
    const override = exercise?.mode === 'time' ? entry.durationOverride : entry.repsOverride;
    return !Number.isFinite(Number(override)) || Number(override) <= 0;
  });
  const rounds = Number(circuit.rounds);
  const exerciseRest = Number(circuit.restBetweenExercises);
  const roundRest = Number(circuit.restBetweenRounds);
  const hasInvalidSettings = !Number.isInteger(rounds) || rounds < 1
    || !Number.isFinite(exerciseRest) || exerciseRest < 0
    || !Number.isFinite(roundRest) || roundRest < 0;
  if (hasInvalidPrescription || hasInvalidSettings) {
    return { isValid: false, isEmpty: false, missingExerciseIds: [], reason: 'Configuración de tiempos o repeticiones inválida' };
  }
  return { isValid: true, isEmpty: false, missingExerciseIds: [], reason: '' };
}

export function getEffectiveStrengthPrescription(entry, exercise) {
  if (exercise.mode === 'time') {
    return {
      mode: 'time',
      reps: null,
      duration: Number(entry.durationOverride)
    };
  }
  return {
    mode: 'reps',
    reps: Number(entry.repsOverride),
    duration: null
  };
}

export function deriveCircuitEquipment(circuit, exercises) {
  const equipment = [];
  const seen = new Set();
  (circuit?.exercises || []).forEach(entry => {
    const exercise = getStrengthExercise(exercises, entry.exerciseId);
    (exercise?.equipment || []).forEach(item => {
      const normalized = String(item).trim();
      if (normalized && !seen.has(normalized.toLowerCase())) {
        seen.add(normalized.toLowerCase());
        equipment.push(normalized);
      }
    });
  });
  return equipment;
}

export function estimateStrengthCircuitDuration(circuit, exercises) {
  const resolved = (circuit?.exercises || [])
    .map(entry => ({ entry, exercise: getStrengthExercise(exercises, entry.exerciseId) }))
    .filter(item => item.exercise);
  if (resolved.length === 0) return 0;

  const rounds = Math.max(1, Number(circuit.rounds) || 1);
  const restBetweenExercises = Math.max(0, Number(circuit.restBetweenExercises) || 0);
  const restBetweenRounds = Math.max(0, Number(circuit.restBetweenRounds) || 0);
  let total = 0;

  for (let round = 0; round < rounds; round++) {
    resolved.forEach(({ entry, exercise }, index) => {
      const prescription = getEffectiveStrengthPrescription(entry, exercise);
      total += prescription.mode === 'time' ? prescription.duration : prescription.reps * 4;
      if (index < resolved.length - 1) total += restBetweenExercises;
    });
    if (round < rounds - 1) total += restBetweenRounds;
  }
  return total;
}

export function buildStrengthPhaseList(circuit, exercises) {
  const phases = [];
  const resolved = (circuit?.exercises || [])
    .map(entry => ({ entry, exercise: getStrengthExercise(exercises, entry.exerciseId) }))
    .filter(item => item.exercise);
  const rounds = Math.max(1, Number(circuit.rounds) || 1);

  for (let round = 0; round < rounds; round++) {
    resolved.forEach(({ entry, exercise }, index) => {
      const prescription = getEffectiveStrengthPrescription(entry, exercise);
      phases.push({
        type: 'exercise',
        round,
        exerciseIndex: index,
        exercise,
        ...prescription
      });
      if (index < resolved.length - 1) {
        phases.push({ type: 'rest-exercise', round, duration: Number(circuit.restBetweenExercises) });
      }
    });
    if (round < rounds - 1) {
      phases.push({
        type: 'rest-round',
        round,
        nextRound: round + 1,
        duration: Number(circuit.restBetweenRounds)
      });
    }
  }
  return phases;
}

export function createStrengthResult(circuit) {
  return {
    version: 1,
    circuitId: circuit.id,
    circuitName: circuit.name,
    roundsPlanned: Number(circuit.rounds),
    durationSeconds: 0,
    entries: []
  };
}

export function recordStrengthResultEntry(result, phase, {
  actualValue = null,
  elapsedSeconds = 0,
  status = 'completed'
} = {}) {
  if (!phase || phase.type !== 'exercise') {
    throw new TypeError('Solo se pueden registrar fases de ejercicio.');
  }
  if (!['completed', 'skipped'].includes(status)) {
    throw new RangeError('El estado del ejercicio no es válido.');
  }

  const isReps = phase.mode === 'reps';
  const normalizedActual = actualValue == null ? null : Number(actualValue);
  if (status === 'completed' && isReps && (!Number.isInteger(normalizedActual) || normalizedActual < 1)) {
    throw new RangeError('Las repeticiones realizadas deben ser un entero mayor que cero.');
  }

  const entry = {
    round: Number(phase.round) + 1,
    exerciseId: phase.exercise.id,
    exerciseName: phase.exercise.name,
    mode: phase.mode,
    unit: isReps ? 'reps' : 'seconds',
    targetValue: isReps ? Number(phase.reps) : Number(phase.duration),
    actualValue: status === 'skipped' ? null : normalizedActual,
    elapsedSeconds: Math.max(0, Math.round(Number(elapsedSeconds) || 0)),
    status
  };

  return {
    ...result,
    entries: [...result.entries, entry]
  };
}

export function finalizeStrengthResult(result, durationSeconds) {
  return {
    ...result,
    durationSeconds: Math.max(0, Math.round(Number(durationSeconds) || 0))
  };
}

export function summarizeStrengthResult(result) {
  const entries = Array.isArray(result?.entries) ? result.entries : [];
  const completed = entries.filter(entry => entry.status === 'completed');
  const completedRounds = new Set(entries.map(entry => entry.round));

  return {
    roundsCompleted: completedRounds.size,
    exercisesCompleted: completed.length,
    skippedExercises: entries.length - completed.length,
    totalReps: completed
      .filter(entry => entry.unit === 'reps')
      .reduce((sum, entry) => sum + Number(entry.actualValue || 0), 0),
    durationSeconds: Math.max(0, Number(result?.durationSeconds) || 0)
  };
}
