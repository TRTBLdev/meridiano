function seconds(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.round(parsed) : 0;
}

export function createModuleResult(module, durationSeconds, metadata = {}) {
  return {
    version: 1,
    module,
    durationSeconds: seconds(durationSeconds),
    ...metadata
  };
}

export function createCompoundSessionResult(blocks, results, startedAt, completedAt) {
  const blockLogs = blocks.map((block, index) => {
    const result = results[index] || null;
    return {
      module: block.module,
      name: block.nameOverride,
      presetId: block.presetId,
      plannedDurationSeconds: seconds(block.duration),
      actualDurationSeconds: result ? seconds(result.durationSeconds) : null,
      result
    };
  });
  const activeDurationSeconds = blockLogs.reduce(
    (total, block) => total + (block.actualDurationSeconds || 0),
    0
  );
  const elapsedDurationSeconds = Math.max(
    0,
    Math.round((Number(completedAt) - Number(startedAt)) / 1000)
  );

  return {
    version: 1,
    activeDurationSeconds,
    elapsedDurationSeconds,
    blocks: blockLogs
  };
}

export function formatDurationSeconds(value) {
  const total = seconds(value);
  const minutes = Math.floor(total / 60);
  return `${String(minutes).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
