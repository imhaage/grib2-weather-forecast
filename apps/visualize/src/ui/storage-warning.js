function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return null;
  if (bytes >= 1_000_000_000) return `${(bytes / 1_000_000_000).toFixed(1)} GB`;
  if (bytes >= 1_000_000) return `${Math.round(bytes / 1_000_000)} MB`;
  if (bytes >= 1_000) return `${Math.round(bytes / 1_000)} KB`;
  return `${bytes} B`;
}

export function formatStorageEstimate(estimate) {
  const usage = formatBytes(estimate?.usage);

  if (!usage) {
    return "Storage estimate unavailable";
  }

  return `${usage} used`;
}

const STORAGE_WARNING_KEY = "showStorageWarning";

function readStorageValue(storage, key) {
  try {
    return storage.getItem ? storage.getItem(key) : storage.get(key);
  } catch {
    return null;
  }
}

function writeStorageValue(storage, key, value) {
  try {
    if (storage.setItem) storage.setItem(key, value);
    else storage.set(key, value);
  } catch {
    // Ignore unavailable storage, such as private browsing restrictions.
  }
}

export function readStorageWarningPreference(storage = localStorage) {
  return readStorageValue(storage, STORAGE_WARNING_KEY) !== "0";
}

export function writeStorageWarningPreference(storage = localStorage, shouldShow) {
  writeStorageValue(storage, STORAGE_WARNING_KEY, shouldShow ? "1" : "0");
}

export function createStorageWarningController({ dom, storage = localStorage, updateStorageSize }) {
  function setVisible(visible, { persist = false } = {}) {
    dom.warning.hidden = !visible;
    dom.warningButton.setAttribute("aria-expanded", String(visible));
    if (persist) writeStorageWarningPreference(storage, visible);
    if (visible) updateStorageSize();
  }

  return {
    initialize() {
      setVisible(readStorageWarningPreference(storage));
    },
    close() {
      setVisible(false, { persist: true });
    },
    toggle() {
      const isVisible = dom.warningButton.getAttribute("aria-expanded") === "true";
      setVisible(!isVisible, { persist: true });
    },
  };
}
