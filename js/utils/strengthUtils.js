export function getStrengthExercise(exercises, id) {
  return (exercises || []).find(exercise => exercise.id === id) || null;
}

export function getStrengthTrackingMode(entry, exercise, circuit = null) {
  const explicitMode = entry?.trackingMode || entry?.mode;
  if (explicitMode === 'duration' || explicitMode === 'time') return 'duration';
  if (explicitMode === 'repetitions' || explicitMode === 'reps') return 'repetitions';
  // Un circuito completamente temporizado (por ejemplo, la movilidad adaptada)
  // puede definir el modo a nivel de circuito sin alterar la familia del ejercicio.
  if (circuit?.trackingMode === 'duration' || circuit?.trackingMode === 'time') return 'duration';
  if (exercise?.trackingMode === 'duration' || exercise?.mode === 'time') return 'duration';
  return 'repetitions';
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
    const trackingMode = getStrengthTrackingMode(entry, exercise, circuit);
    const override = trackingMode === 'duration' ? entry.durationOverride : entry.repsOverride;
    return !Number.isFinite(Number(override)) || Number(override) <= 0;
  });
  const rounds = Number(circuit.rounds);
  const exerciseRest = Number(circuit.restBetweenExercises);
  const roundRest = Number(circuit.restBetweenRounds);
  const hasInvalidSettings = !Number.isInteger(rounds) || rounds < 1
    || !Number.isFinite(exerciseRest) || exerciseRest < 0
    || !Number.isFinite(roundRest) || roundRest < 0;
  const warmupSteps = Array.isArray(circuit.warmupSteps) ? circuit.warmupSteps : [];
  const hasInvalidWarmup = warmupSteps.some(step => {
    if (!step?.name) return true;
    const segments = Array.isArray(step.segments) && step.segments.length > 0 ? step.segments : [step];
    return segments.some(segment => !Number.isFinite(Number(segment.duration)) || Number(segment.duration) <= 0);
  });
  if (hasInvalidPrescription || hasInvalidSettings || hasInvalidWarmup) {
    return { isValid: false, isEmpty: false, missingExerciseIds: [], reason: 'Configuración de tiempos o repeticiones inválida' };
  }
  return { isValid: true, isEmpty: false, missingExerciseIds: [], reason: '' };
}

export function getEffectiveStrengthPrescription(entry, exercise, circuit = null) {
  if (getStrengthTrackingMode(entry, exercise, circuit) === 'duration') {
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
  const warmupSteps = Array.isArray(circuit?.warmupSteps) ? circuit.warmupSteps : [];
  let total = warmupSteps.length > 0
    ? warmupSteps.reduce((sum, step) => {
      const segments = Array.isArray(step.segments) && step.segments.length > 0 ? step.segments : [step];
      return sum + segments.reduce((segmentTotal, segment) => segmentTotal + Math.max(0, Number(segment.duration) || 0), 0);
    }, 0)
    : Math.max(0, Number(circuit?.warmupDuration) || 0);

  for (let round = 0; round < rounds; round++) {
    resolved.forEach(({ entry, exercise }, index) => {
      const prescription = getEffectiveStrengthPrescription(entry, exercise, circuit);
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
  const warmupSteps = Array.isArray(circuit?.warmupSteps) ? circuit.warmupSteps : [];

  if (warmupSteps.length > 0) {
    warmupSteps.forEach((step, index) => {
      const segments = Array.isArray(step.segments) && step.segments.length > 0
        ? step.segments
        : [{ id: 'default', name: step.name, duration: step.duration, preparation: step.preparation, execution: step.execution }];
      segments.forEach((segment, segmentIndex) => {
        phases.push({
          type: 'warmup',
          warmupIndex: index,
          warmupSegmentIndex: segmentIndex,
          warmupSegmentCount: segments.length,
          unitId: `warmup:${index}:${segmentIndex}`,
          name: segment.name || step.name,
          stepName: step.name,
          duration: Number(segment.duration),
          preparation: segment.preparation || step.preparation || '',
          execution: segment.execution || segment.instruction || step.execution || '',
          chime: segment.chime !== false
        });
      });
    });
  } else if (Number(circuit?.warmupDuration) > 0) {
    phases.push({
      type: 'warmup',
      warmupIndex: 0,
      unitId: 'warmup:0',
      name: 'Calentamiento',
      duration: Number(circuit.warmupDuration),
      preparation: '',
      execution: ''
    });
  }

  for (let round = 0; round < rounds; round++) {
    resolved.forEach(({ entry, exercise }, index) => {
      const prescription = getEffectiveStrengthPrescription(entry, exercise, circuit);
      const weightKg = Number.isFinite(Number(entry.weightOverride))
        ? Number(entry.weightOverride)
        : (Number.isFinite(Number(exercise.defaultWeight)) ? Number(exercise.defaultWeight) : 0);
      phases.push({
        type: 'exercise',
        unitId: `exercise:${round}:${index}`,
        round,
        exerciseIndex: index,
        exercise,
        weightKg,
        familyId: entry.familyId || exercise.familyId || null,
        levelId: entry.levelId || exercise.levelId || null,
        variantId: entry.variantId || exercise.variantId || null,
        ...prescription
      });
      if (index < resolved.length - 1) {
        phases.push({ type: 'rest-exercise', unitId: `rest-exercise:${round}:${index}`, round, duration: Number(circuit.restBetweenExercises) });
      }
    });
    if (round < rounds - 1) {
      phases.push({
        type: 'rest-round',
        unitId: `rest-round:${round}`,
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
    module: 'strength',
    circuitId: circuit.id,
    circuitName: circuit.name,
    roundsPlanned: Number(circuit.rounds),
    durationSeconds: 0,
    entries: []
  };
}

export function recordStrengthResultEntry(result, phase, {
  actualValue = null,
  actualWeight = null,
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

  const resolvedWeight = actualWeight != null && Number.isFinite(Number(actualWeight))
    ? Math.max(0, Number(actualWeight))
    : (phase.weightKg != null && Number.isFinite(Number(phase.weightKg)) ? Number(phase.weightKg) : (phase.exercise?.defaultWeight ?? 0));

  const entry = {
    phaseId: phase.unitId || `exercise:${phase.round}:${phase.exerciseIndex}`,
    round: Number(phase.round) + 1,
    exerciseId: phase.exercise.id,
    exerciseName: phase.exercise.name,
    mode: phase.mode,
    unit: isReps ? 'reps' : 'seconds',
    targetValue: isReps ? Number(phase.reps) : Number(phase.duration),
    familyId: phase.familyId || phase.exercise?.familyId || null,
    levelId: phase.levelId || phase.exercise?.levelId || null,
    variantId: phase.variantId || phase.exercise?.variantId || null,
    actualValue: status === 'skipped' ? null : normalizedActual,
    weightKg: resolvedWeight,
    elapsedSeconds: Math.max(0, Math.round(Number(elapsedSeconds) || 0)),
    status
  };

  return {
    ...result,
    entries: [...result.entries.filter(item => item.phaseId !== entry.phaseId), entry]
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
