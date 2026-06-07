import { PACKAGES } from "../../domain/model-packages.js";
import type { ForecastResourceUpdateKey, ForecastResourceUpdatePorts } from "./ports";

export function createForecastResourceUpdateUseCase({
  isRefreshActive,
  loadPackageResources,
  packages = PACKAGES,
  prepareSession,
  refreshBlocksToLatest,
  refreshStatus,
  setStatus,
}: ForecastResourceUpdatePorts) {
  async function refreshCurrentResourcesToLatest(downloadKey: ForecastResourceUpdateKey) {
    if (!isRefreshActive(downloadKey)) {
      return null;
    }

    const packageKey = downloadKey.state.packageKey;
    const pkg = packages[packageKey];
    const previousResources = downloadKey.state.resources;

    const resources = await loadPackageResources({
      packageKey,
      downloadKey,
      loadingStatus: "Checking latest files…",
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
