import { PACKAGES } from "../domain/model-packages.js";

export function createForecastResourceUpdateService({
  isRefreshActive,
  loadPackageResources,
  packages = PACKAGES,
  prepareSession,
  refreshBlocksToLatest,
  refreshStatus,
  setStatus,
}) {
  async function refreshCurrentResourcesToLatest(downloadKey) {
    if (!isRefreshActive(downloadKey)) return null;
    const packageKey = downloadKey.state.packageKey;
    const pkg = packages[packageKey];
    const previousResources = downloadKey.state.resources;

    const resources = await loadPackageResources({
      packageKey,
      downloadKey,
      loadingStatus: "Checking latest files…",
    });
    if (!isRefreshActive(downloadKey) || !resources) return null;

    const session = prepareSession({
      packageKey,
      pkg,
      resources,
      downloadKey,
    });
    setStatus(refreshStatus(session));
    const latestReady = await refreshBlocksToLatest(session, {
      previousResources,
    });
    return latestReady ? session : null;
  }

  return {
    refreshCurrentResourcesToLatest,
  };
}
