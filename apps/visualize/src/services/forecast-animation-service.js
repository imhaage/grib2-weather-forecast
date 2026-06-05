import { isVectorCompositeVariable } from "../domain/wind-composite-variable.js";
import { createAnimationCacheService } from "./animation-cache-service.js";
import { resolveAnimationWarmupProgress } from "./forecast-animation-warmup-progress-service.js";
import { createForecastRenderRequest } from "./forecast-render-request-service.js";

function fmtHourLabel(hour) {
  return `+${String(hour).padStart(2, "0")}H`;
}

export function makeBitmapCacheEntryFromWorker(renderEntry, { keepValues = false } = {}) {
  return {
    bitmap: renderEntry.bitmap,
    values: keepValues ? renderEntry.values : undefined,
    vectorComposite: renderEntry.vectorComposite,
    vectorUValues: renderEntry.vectorUValues,
    vectorVValues: renderEntry.vectorVValues,
    dataMin: renderEntry.dataMin,
    dataMax: renderEntry.dataMax,
    mean: renderEntry.dataMean,
    count: renderEntry.dataCount,
    unitTransform: renderEntry.unitTransform,
    renderMin: renderEntry.renderMin,
    range: renderEntry.range,
    staticScale: renderEntry.staticScale,
    isLog: renderEntry.isLog,
    displayUnits: renderEntry.displayUnits,
    isFallback: renderEntry.isFallback,
    isobars: renderEntry.isobars,
    grid: renderEntry.grid,
    product: renderEntry.product,
    header: renderEntry.header,
  };
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
  let isDecoding = false;
  let pendingHourIdx = null;
  let currentRenderGeneration = 0;
  let tooltipHydrateTimer = null;
  let tooltipHydrateToken = 0;
  const animationCache = createAnimationCacheService();
  const perfStats = {
    lastRenderMs: null,
    lastDecodeMs: null,
  };

  function currentState() {
    return getModelState();
  }

  function invalidateBitmapCache() {
    const modelState = currentState();
    if (modelState) modelState.animationCacheStatus = "waiting";
    animationCache.clear();
    tooltipHydrateToken++;
    if (tooltipHydrateTimer !== null) clearTimeout(tooltipHydrateTimer);
    tooltipHydrateTimer = null;
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

  function modelWorkerRequestForHour(idx, hour, { includeValues = false } = {}) {
    const modelState = currentState();
    const shouldKeepValues = isVectorCompositeVariable(modelState?.variable);
    return createForecastRenderRequest({
      state: modelState,
      hourIndex: idx,
      hour,
      renderGeneration: currentRenderGeneration,
      paletteName: getCurrentPalette(),
      missingValue,
      includeValues: includeValues || shouldKeepValues,
    });
  }

  function shouldKeepValuesForCurrentVariable() {
    return isVectorCompositeVariable(currentState()?.variable);
  }

  async function renderModelHourViaWorker(idx, { includeValues = false } = {}) {
    const modelState = currentState();
    const hour = modelState.hourList[idx];
    const request = modelWorkerRequestForHour(idx, hour, { includeValues });
    if (!request) return null;

    const startedAt = perfDebug ? performanceApi.now() : 0;
    const result = await getModelBlockService().renderHour(request);
    if (!result) return null;
    if (perfDebug) {
      perfStats.lastRenderMs = performanceApi.now() - startedAt;
      notifyDiagnostics();
    }
    if (currentRenderGeneration !== request.renderGeneration) {
      result.bitmap?.close();
      return null;
    }
    return result;
  }

  async function decodeModelHourValuesViaWorker(idx, hour) {
    const request = modelWorkerRequestForHour(idx, hour, {
      includeValues: false,
    });
    if (!request) return null;
    const result = await getModelBlockService().decodeValues(request);
    if (!result?.values || currentRenderGeneration !== request.renderGeneration) return null;
    return result;
  }

  async function hydrateTooltipValues(idx, hour, token, capturedState, capturedRenderGeneration) {
    const data = await decodeModelHourValuesViaWorker(idx, hour);
    if (
      !data ||
      currentState() !== capturedState ||
      currentRenderGeneration !== capturedRenderGeneration ||
      tooltipHydrateToken !== token ||
      capturedState.currentHour !== hour
    ) {
      return;
    }

    const cachedEntry = animationCache.getHour(hour);
    if (cachedEntry) {
      const hydratedEntry = {
        ...cachedEntry,
        vectorComposite: data.vectorComposite ?? cachedEntry.vectorComposite,
        vectorUValues: data.vectorUValues ?? cachedEntry.vectorUValues,
        vectorVValues: data.vectorVValues ?? cachedEntry.vectorVValues,
      };
      setGridState(makeGridState(hydratedEntry, data.values));
      updateIsobarOverlay(cachedEntry, data.values);
    }
  }

  function queueTooltipValueHydration(idx, hour) {
    tooltipHydrateToken++;
    if (tooltipHydrateTimer !== null) clearTimeout(tooltipHydrateTimer);
    tooltipHydrateTimer = null;
    if (isPlayerPlaying()) return;

    const token = tooltipHydrateToken;
    const capturedState = currentState();
    const capturedRenderGeneration = currentRenderGeneration;
    tooltipHydrateTimer = setTimeout(() => {
      tooltipHydrateTimer = null;
      if (isPlayerPlaying()) return;
      hydrateTooltipValues(idx, hour, token, capturedState, capturedRenderGeneration).catch(
        (error) => console.error("hydrateTooltipValues:", error),
      );
    }, 140);
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
    if (isDecoding) {
      pendingHourIdx = idx;
      return;
    }
    isDecoding = true;
    pendingHourIdx = null;
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
      const renderEntry = await renderModelHourViaWorker(idx, {
        includeValues: true,
      });
      if (!renderEntry) {
        showUnavailableHour(hour);
        return;
      }

      const entry = makeBitmapCacheEntryFromWorker(renderEntry, {
        keepValues: shouldKeepValuesForCurrentVariable(),
      });
      animationCache.setHour(hour, entry);
      updateWarmupProgress();
      await presentBitmapEntry(hour, entry, { values: renderEntry.values });
    } catch (error) {
      console.error("showHour:", error);
      showUnavailableHour(currentState()?.hourList[idx] ?? idx);
    } finally {
      isDecoding = false;
      if (pendingHourIdx !== null) {
        const next = pendingHourIdx;
        pendingHourIdx = null;
        showHour(next);
      }
    }
  }

  async function prerenderBlock(blockKey) {
    const capturedState = currentState();
    const capturedRenderGeneration = currentRenderGeneration;
    const block = capturedState.resources.find((resource) => resource.key === blockKey);
    if (!block) return;

    for (let hour = block.startHour; hour <= block.endHour; hour++) {
      if (currentState() !== capturedState || currentRenderGeneration !== capturedRenderGeneration)
        return;

      const idx = capturedState.hourList.indexOf(hour);
      if (idx === -1 || animationCache.hasHour(hour)) continue;

      const entry = await renderModelHourViaWorker(idx);
      if (!entry) return;

      if (
        currentState() === capturedState &&
        currentRenderGeneration === capturedRenderGeneration
      ) {
        if (animationCache.hasHour(hour)) {
          entry.bitmap.close();
        } else {
          animationCache.setHour(
            hour,
            makeBitmapCacheEntryFromWorker(entry, {
              keepValues: shouldKeepValuesForCurrentVariable(),
            }),
          );
          updateWarmupProgress();
        }
      } else {
        entry.bitmap.close();
        return;
      }
    }
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
    if (!animationCache.beginDrain()) return;
    notifyDiagnostics();
    try {
      let job = animationCache.nextJob();
      while (job) {
        notifyDiagnostics();
        if (currentState() === job.state && currentRenderGeneration === job.renderGeneration) {
          await prerenderBlock(job.blockKey);
        }
        animationCache.completeJob(job);
        notifyDiagnostics();
        job = animationCache.nextJob();
      }
    } finally {
      animationCache.endDrain();
      notifyDiagnostics();
      if (animationCache.queueLength > 0) {
        drainPrerenderQueue();
      }
    }
  }

  function resetDecoding() {
    isDecoding = false;
    pendingHourIdx = null;
  }

  function getDiagnostics() {
    const modelState = currentState();
    const totalBitmaps = modelState?.hourList.length ?? 0;
    const readyBitmaps = totalBitmaps ? bitmapCacheReadyCount() : animationCache.size;
    return {
      lastRenderMs: perfStats.lastRenderMs,
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
