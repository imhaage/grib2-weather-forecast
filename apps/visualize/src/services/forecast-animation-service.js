import { createAnimationCacheService } from "./animation-cache-service.js";
import { createForecastRenderRequest } from "./forecast-render-request-service.js";

function fmtHourLabel(hour) {
  return `+${String(hour).padStart(2, "0")}H`;
}

export function makeBitmapCacheEntryFromWorker(renderEntry) {
  return {
    bitmap: renderEntry.bitmap,
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
  dom,
  getCurrentPalette,
  getGridState,
  getModelBlockService,
  getModelState,
  isPlayerPlaying,
  makeGridState,
  missingValue,
  notifyDiagnostics,
  perfDebug = false,
  performanceApi = globalThis.performance,
  presentBitmapEntry,
  setGridState,
  showUnavailableHour,
  syncPlayButtonAvailability,
  updateIsobarOverlay,
}) {
  let isDecoding = false;
  let pendingHourIdx = null;
  let renderGen = 0;
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
    renderGen++;
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
    const container = dom.cacheWarmup;
    if (!container || !modelState?.hourList.length) {
      if (container) container.hidden = true;
      syncPlayButtonAvailability();
      return;
    }

    const total = modelState.hourList.length;
    const ready = bitmapCacheReadyCount();
    const complete = ready === total;
    if (modelState.animationCacheStatus === "building" && complete) {
      modelState.animationCacheStatus = "ready";
    }
    const isWaiting = modelState.animationCacheStatus === "waiting";
    const isReady = modelState.animationCacheStatus === "ready";
    const pct = total ? Math.round((ready / total) * 100) : 0;

    container.hidden = isReady;
    container.classList.toggle("waiting", isWaiting);
    container.classList.toggle("ready", isReady);
    dom.cacheWarmupBar.style.width = `${pct}%`;
    dom.cacheWarmupCount.textContent = `${ready} / ${total}`;
    dom.cacheWarmupLabel.textContent = isWaiting
      ? "Preparing animation cache"
      : isReady
        ? "Animation ready"
        : "Animation cache";
    syncPlayButtonAvailability();
    notifyDiagnostics();
  }

  function modelWorkerRequestForHour(idx, hour, { includeValues = false } = {}) {
    return createForecastRenderRequest({
      state: currentState(),
      hourIndex: idx,
      hour,
      renderGen,
      paletteName: getCurrentPalette(),
      missingValue,
      includeValues,
    });
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
    if (renderGen !== request.gen) {
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
    if (!result?.values || renderGen !== request.gen) return null;
    return result;
  }

  async function hydrateTooltipValues(idx, hour, token, capturedState, capturedGen) {
    const data = await decodeModelHourValuesViaWorker(idx, hour);
    if (
      !data ||
      currentState() !== capturedState ||
      renderGen !== capturedGen ||
      tooltipHydrateToken !== token ||
      capturedState.currentHour !== hour
    ) {
      return;
    }

    const cachedEntry = animationCache.getHour(hour);
    if (cachedEntry) {
      setGridState(makeGridState(cachedEntry, data.values));
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
    const capturedGen = renderGen;
    tooltipHydrateTimer = setTimeout(() => {
      tooltipHydrateTimer = null;
      if (isPlayerPlaying()) return;
      hydrateTooltipValues(idx, hour, token, capturedState, capturedGen).catch((error) =>
        console.error("hydrateTooltipValues:", error),
      );
    }, 140);
  }

  function queueCurrentTooltipValueHydration() {
    const modelState = currentState();
    const currentGridState = getGridState();
    if (!modelState || currentGridState?.values) return;
    const idx = Number.parseInt(dom.forecastSlider.value, 10);
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
      dom.forecastHourLabel.textContent = fmtHourLabel(hour);

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

      const entry = makeBitmapCacheEntryFromWorker(renderEntry);
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
    const capturedGen = renderGen;
    const block = capturedState.resources.find((resource) => resource.key === blockKey);
    if (!block) return;

    for (let hour = block.startHour; hour <= block.endHour; hour++) {
      if (currentState() !== capturedState || renderGen !== capturedGen) return;

      const idx = capturedState.hourList.indexOf(hour);
      if (idx === -1 || animationCache.hasHour(hour)) continue;

      const entry = await renderModelHourViaWorker(idx);
      if (!entry) return;

      if (currentState() === capturedState && renderGen === capturedGen) {
        if (animationCache.hasHour(hour)) {
          entry.bitmap.close();
        } else {
          animationCache.setHour(hour, makeBitmapCacheEntryFromWorker(entry));
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
    const gen = renderGen;
    const state = modelState;
    const queued = animationCache.enqueueBlock(blockKey, gen, state);
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
        if (currentState() === job.state && renderGen === job.gen) {
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
      renderGen,
    };
  }

  return {
    get renderGen() {
      return renderGen;
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
