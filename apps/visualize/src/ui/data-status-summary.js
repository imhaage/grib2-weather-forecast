export const BLOCK_STATUS = Object.freeze({
  MISSING: "missing",
  LOADED_FROM_CACHE: "loaded-from-cache",
  DOWNLOADING: "downloading",
  READY: "ready",
});

export const BLOCK_STATUS_LABELS = Object.freeze({
  [BLOCK_STATUS.MISSING]: "missing",
  [BLOCK_STATUS.LOADED_FROM_CACHE]: "loaded from cache",
  [BLOCK_STATUS.DOWNLOADING]: "updating",
  [BLOCK_STATUS.READY]: "loaded from network",
});

export const BLOCK_STATUS_CLASSES = [...Object.values(BLOCK_STATUS), "done", "cached"];

const DATA_STATUS_SUMMARY_ORDER = [
  BLOCK_STATUS.LOADED_FROM_CACHE,
  BLOCK_STATUS.READY,
  BLOCK_STATUS.DOWNLOADING,
  BLOCK_STATUS.MISSING,
];

export function countBlockStatuses(blocks) {
  const counts = Object.fromEntries(Object.values(BLOCK_STATUS).map((status) => [status, 0]));
  for (const block of blocks) {
    const status = block.status ?? BLOCK_STATUS.MISSING;
    counts[status] ??= 0;
    counts[status]++;
  }
  return counts;
}

export function createDataStatusSummaryNodes(document, blocks) {
  const counts = countBlockStatuses(blocks);
  return DATA_STATUS_SUMMARY_ORDER.flatMap((status, index) => {
    const item = document.createElement("span");
    item.className = `data-status-count ${status}`;
    item.textContent = `${counts[status]} ${BLOCK_STATUS_LABELS[status]}`;
    return index === 0 ? [item] : [document.createTextNode(" · "), item];
  });
}
