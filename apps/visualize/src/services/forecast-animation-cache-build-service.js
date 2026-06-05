export function createForecastAnimationCacheBuildService({
  getModelState,
  isBitmapCacheComplete,
  isRefreshActive,
  queuePrerenderForAllBlocks,
  updateWarmupProgress,
  waitForPrerenderIdle,
}) {
  async function buildAfterNetworkSettles(session) {
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
