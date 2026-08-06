export function resolveYogaSequence(sequences, presetId) {
  if (!Array.isArray(sequences) || sequences.length === 0) return null;
  return sequences.find(sequence => sequence.id === presetId) || sequences[0];
}

export function startResolvedYogaSequence(sequences, presetId, startSequence) {
  const sequence = resolveYogaSequence(sequences, presetId);
  if (!sequence) return false;
  startSequence(sequence);
  return true;
}
