import type { ForecastResourceLoadPorts, ForecastResourceLoadRequest } from "./ports";

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function createForecastResourceLoadUseCase({
  fetchPackageResources,
  isRefreshActive,
  setStatus,
}: ForecastResourceLoadPorts) {
  async function loadPackageResources({
    packageKey,
    downloadKey,
    loadingStatus,
  }: ForecastResourceLoadRequest) {
    setStatus(loadingStatus);

    try {
      return await fetchPackageResources(packageKey, downloadKey);
    } catch (error) {
      if (isRefreshActive(downloadKey)) {
        setStatus(`API error: ${errorMessage(error)}`);
      }

      return null;
    }
  }

  return {
    loadPackageResources,
  };
}
