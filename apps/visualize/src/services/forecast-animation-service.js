import { createAnimationCacheService } from "./animation-cache-service.js";
import { resolveAnimationWarmupProgress } from "./forecast-animation-warmup-progress-service.js";
import { makeBitmapCacheEntryFromWorker } from "./forecast-bitmap-cache-entry-service.js";
import { createForecastHourRenderQueueService } from "./forecast-hour-render-queue-service.js";
import { createForecastHourWorkerRenderService } from "./forecast-hour-worker-render-service.js";
import { createForecastPrerenderBlockService } from "./forecast-prerender-block-service.js";
import { createForecastPrerenderQueueDrainService } from "./forecast-prerender-queue-drain-service.js";
import { createForecastTooltipHydrationService } from "./forecast-tooltip-hydration-service.js";

function fmtHourLabel(hour) {
  return `+${String(hour).padStart(2, "0")}H`;
}

export function createForecastAnimationService({
  getCurrentPalette,
  getGridState,
  getSelectedHourIndex,
  getModelBlockService,
  getModelState,
  isPlayerPlaying,
  makeGridState,
  missingValue,
  notifyDiagnostics,
  perfDebug = false,
  performanceApi = globalThis.performance,
  presentBitmapEntry,
  renderForecastHourLabel,
  renderWarmupProgress = () => {},
  setGridState,
  showUnavailableHour,
  syncPlayButtonAvailability,
  updateIsobarOverlay,
}) {
  let currentRenderGeneration = 0;
  const animationCache = createAnimationCacheService();
  const hourRenderQueue = createForecastHourRenderQueueService();
  const perfStats = {
    lastDecodeMs: null,
  };
  const hourWorkerRenderService = createForecastHourWorkerRenderService({
    getCurrentPalette,
    getCurrentRenderGeneration: () => currentRenderGeneration,
    getModelBlockService,
    getModelState: currentState,
    missingValue,
    notifyDiagnostics,
    perfDebug,
    performanceApi,
  });
  const tooltipHydrationService = createForecastTooltipHydrationService({
    decodeValues: hourWorkerRenderService.decodeValues,
    getCachedEntry: animationCache.getHour,
    getCurrentRenderGeneration: () => currentRenderGeneration,
    getCurrentState: currentState,
    isPlayerPlaying,
    makeGridState,
    setGridState,
    updateIsobarOverlay,
  });
  const prerenderQueueDrainService = createForecastPrerenderQueueDrainService({
    getCurrentRenderGeneration: () => currentRenderGeneration,
    getCurrentState: currentState,
    notifyDiagnostics,
    prerenderBlock,
    queue: animationCache,
  });
  const prerenderBlockService = createForecastPrerenderBlockService({
    cache: animationCache,
    getCurrentRenderGeneration: () => currentRenderGeneration,
    getCurrentState: currentState,
    keepValuesForCurrentVariable: hourWorkerRenderService.shouldKeepValuesForCurrentVariable,
    mapWorkerEntry: makeBitmapCacheEntryFromWorker,
    renderHour: hourWorkerRenderService.renderHour,
    updateWarmupProgress,
  });

  function currentState() {
    return getModelState();
  }

  function invalidateBitmapCache() {
    const modelState = currentState();
    if (modelState) modelState.animationCacheStatus = "waiting";
    animationCache.clear();
    tooltipHydrationService.invalidate();
    currentRenderGeneration++;
    updateWarmupProgress();
    notifyDiagnostics();
  }

  function invalidateBlockRenderCache(block) {
    if (!block) return;
    for (let hour = block.startHour; hour <= block.endHour; hour++) {
      animationCache.removeHour(hour);
    }
    updateWarmupProgress();
  }

  function bitmapCacheReadyCount() {
    const modelState = currentState();
    if (!modelState) return 0;
    return animationCache.readyCount(modelState.hourList);
  }

  function isBitmapCacheComplete() {
    return animationCache.isComplete(currentState()?.hourList ?? []);
  }

  function isAnimationCacheReadyForPlayback() {
    const modelState = currentState();
    return Boolean(
      modelState && modelState.animationCacheStatus === "ready" && isBitmapCacheComplete(),
    );
  }

  function updateWarmupProgress() {
    const modelState = currentState();
    if (!modelState?.hourList.length) {
      const { progress } = resolveAnimationWarmupProgress({ modelState, ready: 0 });
      renderWarmupProgress(progress);
      syncPlayButtonAvailability();
      return;
    }

    const ready = bitmapCacheReadyCount();
    const { cacheStatus, progress } = resolveAnimationWarmupProgress({ modelState, ready });
    modelState.animationCacheStatus = cacheStatus;

    renderWarmupProgress(progress);
    syncPlayButtonAvailability();
    notifyDiagnostics();
  }

  function queueTooltipValueHydration(idx, hour) {
    tooltipHydrationService.queue({
      hour,
      hourIndex: idx,
      renderGeneration: currentRenderGeneration,
    });
  }

  function queueCurrentTooltipValueHydration() {
    const modelState = currentState();
    const currentGridState = getGridState();
    if (!modelState || currentGridState?.values) return;
    const idx = getSelectedHourIndex();
    const hour = modelState.hourList[idx];
    if (animationCache.hasHour(hour)) queueTooltipValueHydration(idx, hour);
  }

  async function showHour(idx) {
    const modelState = currentState();
    if (!hourRenderQueue.requestRender(idx).shouldRender) return;
    try {
      const hour = modelState.hourList[idx];
      renderForecastHourLabel(fmtHourLabel(hour));

      const cachedEntry = animationCache.getHour(hour);
      if (cachedEntry) {
        modelState.currentHour = hour;
        await presentBitmapEntry(hour, cachedEntry);
        queueTooltipValueHydration(idx, hour);
        return;
      }

      modelState.currentHour = hour;
      const renderEntry = await hourWorkerRenderService.renderHour(idx, {
        includeValues: true,
      });
      if (!renderEntry) {
        showUnavailableHour(hour);
        return;
      }

      const entry = makeBitmapCacheEntryFromWorker(renderEntry, {
        keepValues: hourWorkerRenderService.shouldKeepValuesForCurrentVariable(),
      });
      animationCache.setHour(hour, entry);
      updateWarmupProgress();
      await presentBitmapEntry(hour, entry, { values: renderEntry.values });
    } catch (error) {
      console.error("showHour:", error);
      showUnavailableHour(currentState()?.hourList[idx] ?? idx);
    } finally {
      const next = hourRenderQueue.completeRender();
      if (next !== null) showHour(next);
    }
  }

  async function prerenderBlock(blockKey) {
    await prerenderBlockService.prerenderBlock(blockKey, {
      renderGeneration: currentRenderGeneration,
      state: currentState(),
    });
  }

  function queuePrerenderBlock(blockKey) {
    const modelState = currentState();
    if (!modelState?.availableBlocks.has(blockKey)) return;
    const renderGeneration = currentRenderGeneration;
    const state = modelState;
    const queued = animationCache.enqueueBlock(blockKey, renderGeneration, state);
    if (!queued) return;
    notifyDiagnostics();
    drainPrerenderQueue();
  }

  function queuePrerenderForAllBlocks() {
    const modelState = currentState();
    if (!modelState) return;
    updateWarmupProgress();
    for (const blockKey of modelState.availableBlocks) {
      queuePrerenderBlock(blockKey);
    }
  }

  function waitForPrerenderIdle() {
    return animationCache.waitForIdle();
  }

  async function drainPrerenderQueue() {
    await prerenderQueueDrainService.drain();
  }

  function resetDecoding() {
    hourRenderQueue.reset();
  }

  function getDiagnostics() {
    const modelState = currentState();
    const totalBitmaps = modelState?.hourList.length ?? 0;
    const readyBitmaps = totalBitmaps ? bitmapCacheReadyCount() : animationCache.size;
    return {
      lastRenderMs: hourWorkerRenderService.getLastRenderMs(),
      lastDecodeMs: perfStats.lastDecodeMs,
      queueLength: animationCache.queueLength,
      isPrerendering: animationCache.isPrerendering,
      readyBitmaps,
      totalBitmaps,
      currentRenderGeneration,
    };
  }

  return {
    get currentRenderGeneration() {
      return currentRenderGeneration;
    },
    bitmapCacheReadyCount,
    getDiagnostics,
    invalidateBitmapCache,
    invalidateBlockRenderCache,
    isAnimationCacheReadyForPlayback,
    isBitmapCacheComplete,
    queueCurrentTooltipValueHydration,
    queuePrerenderBlock,
    queuePrerenderForAllBlocks,
    resetDecoding,
    showHour,
    updateWarmupProgress,
    waitForPrerenderIdle,
  };
}
