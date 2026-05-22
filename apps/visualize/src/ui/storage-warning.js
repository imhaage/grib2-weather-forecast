function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return null;
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${Math.round(bytes / 1_000_000)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}

export function formatStorageEstimate(estimate) {
  const usage = formatBytes(estimate?.usage);
  const quota = formatBytes(estimate?.quota);
  if (!usage || !quota) return "Storage estimate unavailable";
  return `${usage} used / ${quota} max`;
}
