import type { ForecastAnimationCacheBuildPorts, ForecastRefreshSession } from "./ports";

export function createForecastAnimationCacheBuildUseCase({
  getModelState,
  isBitmapCacheComplete,
  isRefreshActive,
  queuePrerenderForAllBlocks,
  updateWarmupProgress,
  waitForPrerenderIdle,
}: ForecastAnimationCacheBuildPorts) {
  async function buildAfterNetworkSettles(session: ForecastRefreshSession): Promise<void> {
    if (!isRefreshActive(session.downloadKey)) return;
    const modelState = getModelState();
    modelState.animationCacheStatus = "building";
    updateWarmupProgress();
    queuePrerenderForAllBlocks();
    await waitForPrerenderIdle();
    if (!isRefreshActive(session.downloadKey)) return;
    modelState.animationCacheStatus = isBitmapCacheComplete() ? "ready" : "waiting";
    updateWarmupProgress();
  }

  return {
    buildAfterNetworkSettles,
  };
}
