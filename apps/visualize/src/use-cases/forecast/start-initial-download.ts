import type { ForecastInitialDownloadPorts, ForecastInitialDownloadRequest } from "./ports";

export function createForecastInitialDownloadUseCase({
  downloadStatus,
  isRefreshActive,
  loadPackageResources,
  prepareSession,
  refreshBlocksToLatest,
  setStatus,
}: ForecastInitialDownloadPorts) {
  async function startInitialDownload({
    packageKey,
    pkg,
    downloadKey,
  }: ForecastInitialDownloadRequest) {
    const resources = await loadPackageResources({
      packageKey,
      downloadKey,
      loadingStatus: "Fetching file list…",
    });

    if (!isRefreshActive(downloadKey) || !resources) {
      return null;
    }

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
