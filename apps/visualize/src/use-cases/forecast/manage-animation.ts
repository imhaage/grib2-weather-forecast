import type { ForecastRunState, RemoteResource } from "../../domain/forecast-types";
import { makeBitmapCacheEntryFromWorker } from "./create-bitmap-cache-entry";
import { createForecastPrerenderQueueDrainService } from "./drain-prerender-queue";
import { createForecastTooltipHydrationService } from "./hydrate-tooltip-values";
import { createAnimationCacheService } from "./manage-animation-cache";
import { createForecastHourRenderQueueService } from "./manage-hour-render-queue";
import { createForecastPrerenderBlockService } from "./prerender-block";
import { createForecastHourWorkerRenderService } from "./render-hour-with-worker";
import { resolveAnimationWarmupProgress } from "./resolve-animation-warmup-progress";
import type {
  ForecastAnimationPort,
  ForecastBitmapCacheEntry,
  ForecastModelBlockPort,
  ForecastWarmupProgress,
} from "./runtime-contracts";

function fmtHourLabel(hour: number) {
  return `+${String(hour).padStart(2, "0")}H`;
}

interface PerformanceApi {
  now: () => number;
}

export interface CreateForecastAnimationUseCaseOptions {
  getCurrentPalette: () => string;
  getGridState: () => { values?: Float32Array | null } | null | undefined;
  getSelectedHourIndex: () => number;
  getModelBlockService: () => ForecastModelBlockPort;
  getModelState: () => ForecastRunState | null;
  isPlayerPlaying: () => boolean;
  makeGridState: (entry: ForecastBitmapCacheEntry, values?: Float32Array | null) => unknown;
  missingValue: number;
  notifyDiagnostics: () => void;
  perfDebug?: boolean;
  performanceApi?: PerformanceApi;
  presentBitmapEntry: (
    hour: number,
    entry: ForecastBitmapCacheEntry,
    options?: { values?: Float32Array },
  ) => Promise<unknown>;
  renderForecastHourLabel: (label: string) => void;
  renderWarmupProgress?: (progress: ForecastWarmupProgress) => void;
  setGridState: (gridState: unknown) => void;
  showUnavailableHour: (hour: number) => void;
  syncPlayButtonAvailability: () => void;
  updateIsobarOverlay: (entry: ForecastBitmapCacheEntry, values?: Float32Array) => void;
}

export function createForecastAnimationUseCase({
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
}: CreateForecastAnimationUseCaseOptions): ForecastAnimationPort {
  let currentRenderGeneration = 0;
  const animationCache = createAnimationCacheService();
  const hourRenderQueue = createForecastHourRenderQueueService();
  const perfStats = {
    lastDecodeMs: null,
  };

  function currentState() {
    return getModelState();
  }

  function requiredCurrentState() {
    const modelState = currentState();

    if (!modelState) {
      throw new Error("Forecast model state is required");
    }

    return modelState;
  }

  const hourWorkerRenderService = createForecastHourWorkerRenderService({
    getCurrentPalette,
    getCurrentRenderGeneration: () => currentRenderGeneration,
    getModelBlockService,
    getModelState: requiredCurrentState,
    missingValue,
    notifyDiagnostics,
    perfDebug,
    performanceApi,
  });
  const tooltipHydrationService = createForecastTooltipHydrationService({
    clearTimer: clearTimeout,
    decodeValues: hourWorkerRenderService.decodeValues,
    getCachedEntry: animationCache.getHour,
    getCurrentRenderGeneration: () => currentRenderGeneration,
    getCurrentState: requiredCurrentState,
    isPlayerPlaying,
    makeGridState,
    setGridState,
    setTimer: setTimeout,
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

  function invalidateBitmapCache() {
    const modelState = currentState();

    if (modelState) {
      modelState.animationCacheStatus = "waiting";
    }

    animationCache.clear();
    tooltipHydrationService.invalidate();
    currentRenderGeneration += 1;
    updateWarmupProgress();
    notifyDiagnostics();
  }

  function invalidateBlockRenderCache(block: RemoteResource | null | undefined) {
    if (!block) {
      return;
    }

    for (let hour = block.startHour; hour <= block.endHour; hour += 1) {
      animationCache.removeHour(hour);
    }

    updateWarmupProgress();
  }

  function bitmapCacheReadyCount() {
    const modelState = currentState();

    if (!modelState) {
      return 0;
    }

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

  function queueTooltipValueHydration(idx: number, hour: number) {
    tooltipHydrationService.queue({
      hour,
      hourIndex: idx,
      renderGeneration: currentRenderGeneration,
    });
  }

  function queueCurrentTooltipValueHydration() {
    const modelState = currentState();
    const currentGridState = getGridState();

    if (!modelState || currentGridState?.values) {
      return;
    }

    const idx = getSelectedHourIndex();
    const hour = modelState.hourList[idx];

    if (animationCache.hasHour(hour)) {
      queueTooltipValueHydration(idx, hour);
    }
  }

  async function showHour(idx: number) {
    const modelState = requiredCurrentState();

    if (!hourRenderQueue.requestRender(idx).shouldRender) {
      return;
    }

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

      if (next !== null) {
        showHour(next);
      }
    }
  }

  async function prerenderBlock(blockKey: string) {
    const state = currentState();

    if (!state) {
      return;
    }

    await prerenderBlockService.prerenderBlock(blockKey, {
      renderGeneration: currentRenderGeneration,
      state,
    });
  }

  function queuePrerenderBlock(blockKey: string) {
    const modelState = currentState();

    if (!modelState?.availableBlocks.has(blockKey)) {
      return;
    }

    const renderGeneration = currentRenderGeneration;
    const state = modelState;
    const queued = animationCache.enqueueBlock(blockKey, renderGeneration, state);

    if (!queued) {
      return;
    }

    notifyDiagnostics();
    drainPrerenderQueue();
  }

  function queuePrerenderForAllBlocks() {
    const modelState = currentState();

    if (!modelState) {
      return;
    }

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
