import { BLOCK_STATUS, BLOCK_STATUS_CLASSES, BLOCK_STATUS_LABELS } from "./data-status-summary.js";

export function createForecastDownloadView({
  document,
  barsEl,
  fileListEl,
  statusEl,
  formatRunSummary,
  formatSize,
}) {
  function downloadBarForBlock(block) {
    return [...barsEl.children].find((item) => item.id === `dl-${block.key}`);
  }

  function downloadFileItemForBlock(block) {
    return [...fileListEl.children].find((item) => item.id === `dl-file-${block.key}`);
  }

  function clear() {
    barsEl.innerHTML = "";
    fileListEl.innerHTML = "";
  }

  function setStatus(message) {
    statusEl.textContent = message;
  }

  function renderItems(resources) {
    clear();
    for (const resource of resources) {
      const item = document.createElement("div");
      item.className = `forecast-download-bar ${BLOCK_STATUS.MISSING}`;
      item.id = `dl-${resource.key}`;
      item.textContent = resource.key;
      item.title = formatRunSummary([resource]);
      barsEl.appendChild(item);

      const li = document.createElement("li");
      li.id = `dl-file-${resource.key}`;
      li.className = `forecast-download-file ${BLOCK_STATUS.MISSING}`;
      const fileLabel = document.createElement("span");
      fileLabel.textContent = `${resource.url.split("/").pop()} · ${formatSize(resource.filesize)}`;
      const statusLabel = document.createElement("span");
      statusLabel.className = "forecast-download-file__status";
      statusLabel.textContent = BLOCK_STATUS_LABELS[BLOCK_STATUS.MISSING];
      li.append(fileLabel, statusLabel);
      fileListEl.appendChild(li);
    }
  }

  function setBlockStatus(block, status) {
    const item = downloadBarForBlock(block);
    if (item) {
      item.classList.remove(...BLOCK_STATUS_CLASSES);
      item.classList.add(status);
      if (status === BLOCK_STATUS.READY) item.classList.add("done");
      item.title = `${formatRunSummary([block])} · ${status}`;
    }
    const fileItem = downloadFileItemForBlock(block);
    if (fileItem) {
      fileItem.classList.remove(...BLOCK_STATUS_CLASSES);
      fileItem.classList.add(status);
      if (status === BLOCK_STATUS.READY) fileItem.classList.add("done");
      fileItem.querySelector(".forecast-download-file__status").textContent =
        BLOCK_STATUS_LABELS[status] ?? status;
    }
  }

  function setBlockDownloadProgress(block, pct) {
    downloadBarForBlock(block)?.style.setProperty("--pct", pct);
  }

  function resetBlockDownloadProgress(block) {
    setBlockDownloadProgress(block, "0%");
  }

  return {
    clear,
    renderItems,
    resetBlockDownloadProgress,
    setBlockDownloadProgress,
    setBlockStatus,
    setStatus,
  };
}
