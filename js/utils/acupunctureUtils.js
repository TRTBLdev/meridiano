function seconds(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

export function createAcupunctureTiming(sequence) {
  const points = Array.isArray(sequence?.points) ? sequence.points : [];
  const firstDuration = seconds(points[0]?.duration);
  const totalDuration = points.reduce((sum, point) => (
    sum + seconds(point.duration) + seconds(point.transitionAfter)
  ), 0);

  return {
    activeSessionDuration: totalDuration,
    activeTimeLeft: firstDuration,
    activeStepDuration: firstDuration
  };
}
