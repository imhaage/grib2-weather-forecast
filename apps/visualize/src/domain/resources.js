export function extractRunId(text) {
  const match = text.match(/(\d{4}-\d{2}-\d{2}T\d{2}[:_]\d{2}[:_]\d{2}Z)/);
  return match ? match[1].replaceAll("_", ":") : "unknown-run";
}

export function formatRunId(runId) {
  const match = runId.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/);
  if (!match) return runId;
  return `${match[1]} ${match[2]}:${match[3]} UTC`;
}

export function formatRunSummary(resources) {
  const runIds = [...new Set(resources.map((r) => r.runId))];
  if (runIds.length === 0) return "no run";
  if (runIds.length === 1) return `run ${formatRunId(runIds[0])}`;
  return `mixed runs: ${runIds.map(formatRunId).join(", ")}`;
}

export function runTimeValue(runId) {
  const time = Date.parse(runId);
  return Number.isFinite(time) ? time : -Infinity;
}
