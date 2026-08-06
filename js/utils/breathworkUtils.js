function normalizeDuration(value) {
  const duration = Number(value);
  return Number.isFinite(duration) && duration > 0 ? Math.floor(duration) : 0;
}

export function createSingleBreathworkTiming(durationSeconds, fallbackSeconds = 0) {
  const totalDuration = normalizeDuration(durationSeconds) || normalizeDuration(fallbackSeconds);

  return {
    minutes: Math.floor(totalDuration / 60),
    seconds: totalDuration % 60,
    totalDuration,
    timeLeft: totalDuration,
    blockBoundaries: []
  };
}

export function createSequentialBreathworkTiming(blocks = []) {
  let totalDuration = 0;
  const blockBoundaries = blocks.map(block => {
    totalDuration += normalizeDuration((Number(block.mins) || 0) * 60 + (Number(block.secs) || 0));
    return totalDuration;
  });

  return {
    totalDuration,
    timeLeft: totalDuration,
    blockBoundaries
  };
}
