export function createForecastInitialDownloadService({
  downloadStatus,
  isRefreshActive,
  loadPackageResources,
  prepareSession,
  refreshBlocksToLatest,
  setStatus,
}) {
  async function startInitialDownload({ packageKey, pkg, downloadKey }) {
    const resources = await loadPackageResources({
      packageKey,
      downloadKey,
      loadingStatus: "Fetching file list…",
    });
    if (!isRefreshActive(downloadKey) || !resources) return null;

    const session = prepareSession({
      packageKey,
      pkg,
      resources,
      downloadKey,
    });
    setStatus(downloadStatus(session));
    const latestReady = await refreshBlocksToLatest(session);
    return latestReady ? session : null;
  }

  return {
    startInitialDownload,
  };
}
