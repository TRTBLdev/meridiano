export const ACUPUNCTURE_HEAD_TYPES = ['Esferoidal', 'Plano', 'Espátula', 'Rodillo', 'Nodo'];

export function normalizeAcupunctureHead(head) {
  if (head === 'Domo') return 'Plano';
  if (head === 'Punta') return 'Nodo';
  return head || '';
}

export function resolveAcupunctureHead(step, point) {
  const override = normalizeAcupunctureHead(step?.headTypeOverride);
  return ACUPUNCTURE_HEAD_TYPES.includes(override) ? override : normalizeAcupunctureHead(point?.headType);
}

export function cleanAcupunctureStep(step) {
  const result = { ...step };
  const override = normalizeAcupunctureHead(result.headTypeOverride);
  if (ACUPUNCTURE_HEAD_TYPES.includes(override)) result.headTypeOverride = override;
  else delete result.headTypeOverride;
  const notes = typeof result.notes === 'string' ? result.notes.trim() : '';
  if (notes) result.notes = notes;
  else delete result.notes;
  return result;
}

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

export function getAcupunctureControls(started, index) {
  return { previous: Boolean(started && index > 0), next: Boolean(started), restart: Boolean(started) };
}

export function nextAcupuncturePhase(sequence, index, state) {
  const steps = sequence.points;
  if (state === 'stimulating' && Number(steps[index].transitionAfter) > 0 && index < steps.length - 1) {
    return { index, state: 'transition', duration: Number(steps[index].transitionAfter) };
  }
  const nextIndex = index + 1;
  return nextIndex >= steps.length ? null : { index: nextIndex, state: 'stimulating', duration: Number(steps[nextIndex].duration) };
}
