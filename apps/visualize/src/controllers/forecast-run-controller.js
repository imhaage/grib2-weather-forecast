import { fmtRefTime, fmtValidTime, iterateGRIB2Messages } from "grib2-decoder";
import { createRenderScaleParams } from "../domain/forecast-field.js";
import {
  buildHourList,
  createModelState,
  blockForHour as findBlockForHour,
  markBlockAvailable,
} from "../domain/forecast-state.js";
import { generateIsobars, supportsIsobars } from "../domain/isobars.js";
import { findPackageVariable, MODEL_INFO, PACKAGES } from "../domain/model-packages.js";
import { buildLUT, gradientStopsFor, LOG_SCALE_FLOOR } from "../domain/palettes.js";
import { formatRunSummary, runTimeValue } from "../domain/resources.js";
import { displayUnitsFor, unitTransformFor } from "../domain/unit-transforms.js";
import {
  defaultPaletteFor,
  parameterDescriptionFor,
  staticScaleFor,
  variableKeyFor,
} from "../domain/variable-metadata.js";
import { createAnimationCacheService } from "../services/animation-cache-service.js";
import { createDataGouvResourceService } from "../services/data-gouv-resource-service.js";
import { createForecastBlockRefreshService } from "../services/forecast-block-refresh-service.js";
import {
  deleteObsoleteCachedGribBlocks,
  readCachedGribBlock,
  readLatestCachedGribBlock,
  writeCachedGribBlock,
} from "../services/grib-cache-service.js";
import { createModelBlockService } from "../services/model-block-service.js";
import { BLOCK_STATUS, createDataStatusSummaryNodes } from "../ui/data-status-summary.js";
import { createForecastDownloadView } from "../ui/forecast-download-view.js";
import { createDownloadWorkerClient as createDefaultDownloadWorkerClient } from "../workers/download-worker-client.js";

const PROXY = "https://grib2-cors-proxy.imh.workers.dev";
const VARIABLE_GROUP_ORDER = ["Weather maps", "Component fields"];
const MAX_PARALLEL_DOWNLOADS = 6;

function fmtHourLabel(hour) {
  return `+${String(hour).padStart(2, "0")}H`;
}

function fmtSize(bytes) {
  return bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${(bytes / 1e3).toFixed(0)} KB`;
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(limit, items.length);

  async function runNext() {
    const index = nextIndex++;
    if (index >= items.length) return;
    results[index] = await worker(items[index], index);
    await runNext();
  }

  await Promise.all(Array.from({ length: workerCount }, runNext));
  return results;
}

function createVariableOption(document, varDef) {
  const option = document.createElement("option");
  option.value = variableKeyFor(varDef);
  option.textContent = varDef.name;
  return option;
}

function appendGroupedVariableOptions(document, select, variables) {
  const groups = new Map();
  for (const varDef of variables) {
    const groupName = varDef.group;
    if (!groupName) {
      select.appendChild(createVariableOption(document, varDef));
      continue;
    }
    if (!groups.has(groupName)) {
      const group = document.createElement("optgroup");
      group.label = groupName;
      groups.set(groupName, group);
    }
    groups.get(groupName).appendChild(createVariableOption(document, varDef));
  }
  for (const groupName of VARIABLE_GROUP_ORDER) {
    const group = groups.get(groupName);
    if (group) select.appendChild(group);
  }
  for (const [groupName, group] of groups) {
    if (!VARIABLE_GROUP_ORDER.includes(groupName)) select.appendChild(group);
  }
}

function defaultVariableForPackage(pkg) {
  return pkg.variables.find((variable) => variable.group === "Weather maps") ?? pkg.variables[0];
}

export function createForecastRunController({
  document,
  window,
  dom,
  mapRenderer,
  mapPresentation,
  perfDebug = false,
  missingValue,
  makeGridState,
  gridCorners,
  initMap,
  fetchImpl = fetch,
  createDownloadWorkerClient = createDefaultDownloadWorkerClient,
  createModelBlockServiceClient = createModelBlockService,
  getCurrentPalette,
  getGridState,
  setCurrentPalette,
  setGridState,
  setRendering,
  updateDiagnostics,
  updateStorageWarningSizeIfOpen,
}) {
  let modelState = null;
  let isDecoding = false;
  let pendingHourIdx = null;
  let modelBlockService = null;
  let downloadWorkerClient = null;
  let renderGen = 0;
  let tooltipHydrateTimer = null;
  let tooltipHydrateToken = 0;
  let animationPlayer = null;
  const animationCache = createAnimationCacheService();
  const perfStats = {
    lastRenderMs: null,
    lastDecodeMs: null,
  };
  const forecastDownloadView = createForecastDownloadView({
    document,
    barsEl: dom.forecastDownloadBars,
    fileListEl: dom.forecastDownloadFileList,
    statusEl: dom.forecastDownloadStatus,
    formatRunSummary,
    formatSize: fmtSize,
  });

  function scheduleLowPriorityWork() {
    if ("requestIdleCallback" in window) {
      return new Promise((resolve) => {
        window.requestIdleCallback(resolve, { timeout: 300 });
      });
    }
    return new Promise((resolve) => window.requestAnimationFrame(resolve));
  }

  function notifyDiagnostics() {
    updateDiagnostics?.();
  }

  function stopPlayer() {
    animationPlayer?.stopPlayer();
  }

  function syncPlayButtonAvailability() {
    animationPlayer?.syncPlayButtonAvailability();
  }

  function isPlayerPlaying() {
    return Boolean(animationPlayer?.isPlaying());
  }

  function initDownloadWorker() {
    if (downloadWorkerClient) return;
    downloadWorkerClient = createDownloadWorkerClient();
  }

  async function downloadFileInWorker(url, filesize, onProgress) {
    initDownloadWorker();
    const result = await downloadWorkerClient.post({ url, filesize }, [], {
      onProgress: ({ loaded, total }) => onProgress(loaded, total),
    });
    if (!result?.buffer) throw new Error("Download failed");
    return new Uint8Array(result.buffer);
  }

  function getModelBlockService() {
    if (!modelBlockService) {
      modelBlockService = createModelBlockServiceClient();
    }
    return modelBlockService;
  }

  function applyDefaultPalette(shortName) {
    const palette = defaultPaletteFor(shortName);
    if (!palette) return;
    setCurrentPalette(palette);
  }

  function getModelPackageLabelParts(packageKey) {
    const pkg = PACKAGES[packageKey];
    if (!pkg) return null;
    const modelTitle = MODEL_INFO[pkg.model]?.title ?? pkg.model;
    const packageName = packageKey.replace(`${pkg.model}_`, "");
    return { modelTitle, packageName };
  }

  function formatModelPackageSubtitle(packageKey) {
    const parts = getModelPackageLabelParts(packageKey);
    if (!parts) return packageKey;
    return `${parts.modelTitle} ${parts.packageName}`;
  }

  function formatForecastValidTimeLabel(timeLabel) {
    if (!modelState) return timeLabel;
    const parts = getModelPackageLabelParts(modelState.packageKey);
    if (!parts) return `${modelState.packageKey} : ${timeLabel}`;
    return `${parts.modelTitle} - ${parts.packageName} : ${timeLabel}`;
  }

  function updateParamInfo(name, description, subtitle) {
    mapPresentation.updateParamInfo(name, description, subtitle);
  }

  function updateLevelInfo(varDef) {
    mapPresentation.updateLevelInfo(varDef);
  }

  function updateStatsAndColorScale(entry) {
    mapPresentation.updateStats(
      entry.dataMin,
      entry.dataMax,
      entry.mean,
      entry.count,
      entry.displayUnits,
    );
    const legendMin = entry.staticScale ? entry.renderMin : entry.dataMin;
    const legendMax = entry.staticScale ? entry.renderMin + entry.range : entry.dataMax;
    mapPresentation.showColorScale(legendMin, legendMax, entry.displayUnits, {
      isLog: entry.isLog,
    });
  }

  function clearStats() {
    mapPresentation.clearStats();
  }

  function hideColorScale() {
    mapPresentation.hideColorScale();
  }

  function showMapUnavailable() {
    mapPresentation.showUnavailable();
  }

  function hideMapUnavailable() {
    mapPresentation.hideUnavailable();
  }

  function clearMapLayer() {
    mapRenderer.clearLayer();
    setGridState(null);
    hideColorScale();
    hideMapUnavailable();
  }

  function showUnavailableHour(hour) {
    clearMapLayer();
    clearStats();
    mapPresentation.setForecastValidTime(
      formatForecastValidTimeLabel(fmtUnavailableValidTime(hour)),
    );
    showMapUnavailable();
  }

  function fmtUnavailableValidTime(hour) {
    const block = blockForHour(hour);
    const runId = block?.runId;
    const runTime = runId ? Date.parse(runId) : NaN;
    if (!Number.isNaN(runTime)) {
      const valid = new Date(runTime + hour * 60 * 60 * 1000);
      return `${valid.toISOString().slice(0, 16).replace("T", " ")} UTC`;
    }
    return fmtHourLabel(hour);
  }

  function invalidateBitmapCache() {
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

  function beginModelResourceRefresh() {
    if (!modelState) return null;
    modelState.resourceRefreshId = (modelState.resourceRefreshId ?? 0) + 1;
    return {
      state: modelState,
      refreshId: modelState.resourceRefreshId,
    };
  }

  function isModelResourceRefreshActive(downloadKey) {
    return Boolean(
      downloadKey &&
        modelState === downloadKey.state &&
        modelState.resourceRefreshId === downloadKey.refreshId,
    );
  }

  function bitmapCacheReadyCount() {
    if (!modelState) return 0;
    return animationCache.readyCount(modelState.hourList);
  }

  function isBitmapCacheComplete() {
    return animationCache.isComplete(modelState?.hourList ?? []);
  }

  function isAnimationCacheReadyForPlayback() {
    return Boolean(
      modelState && modelState.animationCacheStatus === "ready" && isBitmapCacheComplete(),
    );
  }

  function updateWarmupProgress() {
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

  function makeBitmapCacheEntryFromWorker(renderEntry) {
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

  function modelWorkerRequestForHour(idx, hour, { includeValues = false } = {}) {
    const block = blockForHour(hour);
    if (!block || !modelState.availableBlocks.has(block.key)) return null;

    const varDef = findPackageVariable(modelState.packageKey, modelState.variable);
    const shortName = varDef?.shortName ?? modelState.variable;
    const staticScale = staticScaleFor(shortName);
    const { renderMin, renderMax, range, isLog, logDenom, zeroThreshold } = createRenderScaleParams(
      staticScale,
      LOG_SCALE_FLOOR,
    );
    const prevHour = idx > 0 ? modelState.hourList[idx - 1] : null;
    const previousBlock = prevHour != null ? blockForHour(prevHour) : null;

    return {
      type: "renderHour",
      gen: renderGen,
      blockKey: block.key,
      block,
      hour,
      previousBlockKey: previousBlock?.key ?? null,
      previousBlock,
      previousHour: prevHour,
      variable: {
        shortName,
        levelValue: varDef?.levelValue ?? null,
      },
      unitTransform: unitTransformFor(shortName),
      staticScale,
      renderMin,
      range,
      isLog,
      logFloor: LOG_SCALE_FLOOR,
      logDenom,
      zeroThreshold,
      displayUnits: displayUnitsFor(shortName, varDef?.units),
      lut: buildLUT(getCurrentPalette(), { min: renderMin, max: renderMax }),
      missingValue,
      includeValues,
    };
  }

  async function renderModelHourViaWorker(idx, { includeValues = false } = {}) {
    const hour = modelState.hourList[idx];
    const request = modelWorkerRequestForHour(idx, hour, { includeValues });
    if (!request) return null;

    const startedAt = perfDebug ? performance.now() : 0;
    const result = await getModelBlockService().renderHour(request);
    if (!result) return null;
    if (perfDebug) {
      perfStats.lastRenderMs = performance.now() - startedAt;
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

  function updateIsobarOverlay(entry, values) {
    if (!supportsIsobars(entry.product.shortName)) {
      mapRenderer.clearIsobars();
      return;
    }
    if (entry.isobars) {
      mapRenderer.updateIsobars(entry.isobars);
      return;
    }
    if (!values) {
      mapRenderer.clearIsobars();
      return;
    }
    entry.isobars = generateIsobars({
      shortName: entry.product.shortName,
      grid: entry.grid,
      values,
      missingValue,
    });
    mapRenderer.updateIsobars(entry.isobars);
  }

  async function presentBitmapEntry(hour, entry, { values } = {}) {
    const { grid, product, header } = entry;
    hideMapUnavailable();

    setGridState(makeGridState(entry, values ?? null));

    const { canvas, canvasChanged } = mapRenderer.ensureHeatCanvas(grid);
    const corners = gridCorners(grid);
    mapRenderer.drawBitmap(entry.bitmap);

    const scaleRange = {
      min: entry.renderMin,
      max: entry.renderMin + entry.range,
    };
    const stops = gradientStopsFor(getCurrentPalette(), scaleRange).map((stop) => ({
      color: stop.color,
      position: stop.position,
    }));
    mapPresentation.setColorScaleGradient(stops);

    await initMap();
    const isFirstLayer = !mapRenderer.hasLayer();
    if (isFirstLayer || canvasChanged) {
      mapRenderer.setLayer(canvas, corners);
      mapRenderer.fitBounds(
        [
          [corners[3][0], corners[2][1]],
          [corners[1][0], corners[0][1]],
        ],
        { padding: 20, animate: false },
      );
    }
    mapRenderer.triggerRepaint();
    updateIsobarOverlay(entry, values);

    modelState.lastRunInfo = `${modelState.packageKey} · run ${fmtRefTime(header)}`;
    updateParamInfo(
      product.name,
      parameterDescriptionFor(product.shortName),
      formatModelPackageSubtitle(modelState.packageKey),
    );

    updateStatsAndColorScale(entry);

    const validTimeProduct =
      product.pdtNumber === 8 ? { ...product, forecastTime: hour, timeUnit: 1 } : product;
    mapPresentation.setForecastValidTime(
      formatForecastValidTimeLabel(fmtValidTime(header, validTimeProduct)),
    );
  }

  async function hydrateTooltipValues(idx, hour, token, capturedState, capturedGen) {
    const data = await decodeModelHourValuesViaWorker(idx, hour);
    if (
      !data ||
      modelState !== capturedState ||
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
    const capturedState = modelState;
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
    const currentGridState = getGridState();
    if (!modelState || currentGridState?.values) return;
    const idx = Number.parseInt(dom.forecastSlider.value, 10);
    const hour = modelState.hourList[idx];
    if (animationCache.hasHour(hour)) queueTooltipValueHydration(idx, hour);
  }

  async function showHour(idx) {
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
      showUnavailableHour(modelState?.hourList[idx] ?? idx);
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
    const capturedState = modelState;
    const capturedGen = renderGen;
    const block = capturedState.resources.find((resource) => resource.key === blockKey);
    if (!block) return;

    for (let hour = block.startHour; hour <= block.endHour; hour++) {
      if (modelState !== capturedState || renderGen !== capturedGen) return;

      const idx = capturedState.hourList.indexOf(hour);
      if (idx === -1 || animationCache.hasHour(hour)) continue;

      const entry = await renderModelHourViaWorker(idx);
      if (!entry) return;

      if (modelState === capturedState && renderGen === capturedGen) {
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
    if (!modelState?.availableBlocks.has(blockKey)) return;
    const gen = renderGen;
    const state = modelState;
    const queued = animationCache.enqueueBlock(blockKey, gen, state);
    if (!queued) return;
    notifyDiagnostics();
    drainPrerenderQueue();
  }

  function queuePrerenderForAllBlocks() {
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
        if (modelState === job.state && renderGen === job.gen) {
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

  function setBlockStatus(block, status) {
    block.status = status;
    modelState?.blockStatus?.set(block.key, status);
    forecastDownloadView.setBlockStatus(block, status);
    updateDataStatusSummary();
  }

  function setBlockDownloadProgress(block, pct) {
    forecastDownloadView.setBlockDownloadProgress(block, pct);
  }

  function resetBlockDownloadProgress(block) {
    forecastDownloadView.resetBlockDownloadProgress(block);
  }

  function updateDataStatusSummary() {
    const summary = dom.dataStatusSummary;
    if (!summary || !modelState?.resources.length) return;
    summary.replaceChildren(...createDataStatusSummaryNodes(document, modelState.resources));
  }

  function blockForHour(hour) {
    return findBlockForHour(modelState?.resources ?? [], hour);
  }

  function configureModelVariableControls(pkg) {
    const varSelect = dom.forecastVarSelect;
    varSelect.innerHTML = "";

    const firstVar = defaultVariableForPackage(pkg);
    modelState.variable = variableKeyFor(firstVar);
    applyDefaultPalette(variableKeyFor(firstVar));
    appendGroupedVariableOptions(document, varSelect, pkg.variables);
    varSelect.value = modelState.variable;
    updateLevelInfo(firstVar);
  }

  function applyModelResources(resources) {
    modelState.resources = resources;
    modelState.hourList = buildHourList(resources);
    const slider = dom.forecastSlider;
    slider.max = modelState.hourList.length - 1;
    if (Number(slider.value) > Number(slider.max)) slider.value = slider.max;
  }

  function isModelBlockInMemoryCurrent(block, previousBlock) {
    return Boolean(
      previousBlock &&
        modelState.availableBlocks.has(block.key) &&
        previousBlock.filesize === block.filesize &&
        runTimeValue(previousBlock.runId) >= runTimeValue(block.runId),
    );
  }

  function isModelBlockInMemoryStale(block, previousBlock) {
    return Boolean(
      previousBlock &&
        modelState.availableBlocks.has(block.key) &&
        runTimeValue(previousBlock.runId) < runTimeValue(block.runId),
    );
  }

  function updateAvailableFileCount(session) {
    forecastDownloadView.setStatus(`${session.availableCount} / ${session.resources.length} files`);
  }

  function markInMemoryModelBlockAvailable(block, status, session) {
    setBlockStatus(block, status);
    setBlockDownloadProgress(block, "100%");
    session.availableCount++;
    updateAvailableFileCount(session);
    completeModelDownloadIfReady(session);
  }

  async function storeModelBlockInWorker(block, buffer) {
    return getModelBlockService().storeBlock(block, buffer);
  }

  async function storeAvailableModelBlock(block, buffer, status, session) {
    const hadBuffer = modelState.availableBlocks.has(block.key);
    if (hadBuffer) {
      invalidateBlockRenderCache(block);
    }
    const storedInWorker = await storeModelBlockInWorker(block, buffer);
    if (!storedInWorker) return;
    markBlockAvailable(modelState, block);
    setBlockStatus(block, status);
    if (!hadBuffer) session.availableCount++;

    setBlockDownloadProgress(block, "100%");
    updateAvailableFileCount(session);
  }

  function initializeModelLegendFromBlock(buffer, session) {
    if (session.legendInitialized) return;
    session.legendInitialized = true;
    const curVarDef = findPackageVariable(session.packageKey, modelState.variable);
    const curShortName = curVarDef?.shortName ?? modelState.variable;
    for (const msg of iterateGRIB2Messages(buffer)) {
      const product = msg.product;
      if (!product || product.shortName !== curShortName) continue;
      if (curVarDef?.levelValue != null && product.levelValue !== curVarDef.levelValue) {
        continue;
      }
      modelState.lastRunInfo = `${session.packageKey} · run ${fmtRefTime(msg.header)}`;
      applyDefaultPalette(modelState.variable);
      updateParamInfo(
        product.name,
        parameterDescriptionFor(curShortName),
        formatModelPackageSubtitle(modelState.packageKey),
      );
      updateLevelInfo(curVarDef);
      const staticScale = staticScaleFor(curShortName);
      if (staticScale && curVarDef) {
        mapPresentation.showColorScale(
          staticScale.min,
          staticScale.max,
          displayUnitsFor(curShortName, curVarDef.units),
          { isLog: staticScale.log ?? false },
        );
      }
      break;
    }
  }

  async function refreshMapForAvailableModelBlock(block, session) {
    const currentIdx = Number.parseInt(session.slider.value, 10);
    const currentHour = modelState.hourList[currentIdx];
    if (session.availableCount === 1) {
      mapRenderer.setVisible(true);
      await initMap();
      if (!isModelResourceRefreshActive(session.downloadKey)) return;
      mapRenderer.fitBounds(session.pkg.bounds, { padding: 20, animate: false });
      await showHour(currentIdx);
    } else if (blockForHour(currentHour)?.key === block.key) {
      await showHour(currentIdx);
    }
  }

  function completeModelDownloadIfReady(session) {
    if (session.availableCount !== session.resources.length) return;
    updateAvailableFileCount(session);
  }

  async function presentAvailableModelBlock(block, buffer, status, session) {
    if (!isModelResourceRefreshActive(session.downloadKey)) return;
    initializeModelLegendFromBlock(buffer, session);
    await storeAvailableModelBlock(block, buffer, status, session);
    if (!isModelResourceRefreshActive(session.downloadKey)) return;
    await refreshMapForAvailableModelBlock(block, session);
    completeModelDownloadIfReady(session);
  }

  async function buildAnimationCacheAfterNetworkSettles(session) {
    if (!isModelResourceRefreshActive(session.downloadKey)) return;
    modelState.animationCacheStatus = "building";
    updateWarmupProgress();
    queuePrerenderForAllBlocks();
    await waitForPrerenderIdle();
    if (!isModelResourceRefreshActive(session.downloadKey)) return;
    modelState.animationCacheStatus = isBitmapCacheComplete() ? "ready" : "waiting";
    updateWarmupProgress();
  }

  function resolvePresentationIdle(session) {
    const resolvers = session.presentationIdleResolvers.splice(0);
    for (const resolve of resolvers) resolve();
  }

  function waitForPresentationIdle(session) {
    if (!session.isPresentingQueuedBlock && session.presentationQueue.length === 0) {
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      session.presentationIdleResolvers.push(resolve);
    });
  }

  async function writeCachedModelBlock(packageKey, block, buffer) {
    const cacheWriteSucceeded = await writeCachedGribBlock(packageKey, block, buffer);
    if (cacheWriteSucceeded) updateStorageWarningSizeIfOpen?.();
    return cacheWriteSucceeded;
  }

  async function enqueueAvailableModelBlockPresentation(block, buffer, status, session) {
    if (status !== BLOCK_STATUS.READY) {
      await presentAvailableModelBlock(block, buffer, status, session);
      return;
    }

    session.presentationQueue.push({ block, buffer, status, session });
    if (session.isPresentingQueuedBlock) return;

    session.isPresentingQueuedBlock = true;
    try {
      while (session.presentationQueue.length > 0) {
        const job = session.presentationQueue.shift();
        await scheduleLowPriorityWork();
        if (!isModelResourceRefreshActive(session.downloadKey)) return;
        await presentAvailableModelBlock(job.block, job.buffer, job.status, job.session);
      }
    } finally {
      session.isPresentingQueuedBlock = false;
      if (session.presentationQueue.length === 0) {
        resolvePresentationIdle(session);
      }
    }
  }

  const forecastBlockRefreshService = createForecastBlockRefreshService({
    statuses: BLOCK_STATUS,
    maxParallelDownloads: MAX_PARALLEL_DOWNLOADS,
    cache: {
      readCachedBlock: readCachedGribBlock,
      readLatestCachedBlock: readLatestCachedGribBlock,
      writeCachedBlock: writeCachedModelBlock,
      deleteObsoleteCachedBlocks: deleteObsoleteCachedGribBlocks,
    },
    lifecycle: {
      runWithConcurrency,
      isRefreshActive: isModelResourceRefreshActive,
      isBlockInMemoryCurrent: isModelBlockInMemoryCurrent,
      isBlockInMemoryStale: isModelBlockInMemoryStale,
    },
    network: {
      downloadFile: downloadFileProg,
    },
    presentation: {
      enqueueAvailableBlock: enqueueAvailableModelBlockPresentation,
      waitForPresentationIdle,
    },
    status: {
      markInMemoryBlockAvailable: markInMemoryModelBlockAvailable,
      setBlockStatus,
      resetBlockDownloadProgress,
      setBlockDownloadProgress,
    },
  });
  const dataGouvResourceService = createDataGouvResourceService({
    proxyBaseUrl: PROXY,
    fetchImpl,
  });

  function proxyUrl(url) {
    return dataGouvResourceService.proxyResourceUrl(url);
  }

  async function fetchDataGouvResources(datasetId, titlePattern) {
    return dataGouvResourceService.fetchResources(datasetId, titlePattern);
  }

  async function fetchPackageResources(packageKey, downloadKey) {
    const pkg = PACKAGES[packageKey];
    let resources = await fetchDataGouvResources(pkg.datasetId, pkg.titlePattern);
    if (!isModelResourceRefreshActive(downloadKey)) return null;
    if (pkg.skipHour0) resources = resources.filter((resource) => resource.startHour > 0);
    return resources;
  }

  async function downloadFileProg(url, filesize, onProgress) {
    return downloadFileInWorker(proxyUrl(url), filesize, onProgress);
  }

  function resetResourceStatuses(resources) {
    for (const resource of resources) {
      resource.status = BLOCK_STATUS.MISSING;
      modelState?.blockStatus?.set(resource.key, BLOCK_STATUS.MISSING);
    }
    updateDataStatusSummary();
  }

  function createModelDownloadSession({ packageKey, pkg, resources, runSummary, downloadKey }) {
    return {
      packageKey,
      pkg,
      pkgVars: pkg.variables,
      resources,
      runSummary,
      downloadKey,
      slider: dom.forecastSlider,
      availableCount: 0,
      legendInitialized: false,
      presentationQueue: [],
      presentationIdleResolvers: [],
      isPresentingQueuedBlock: false,
    };
  }

  async function startDownload(packageKey) {
    const pkg = PACKAGES[packageKey];
    modelState = createModelState(packageKey);
    mapRenderer.setVisible(false);
    const downloadKey = beginModelResourceRefresh();

    configureModelVariableControls(pkg);

    const slider = dom.forecastSlider;
    slider.value = 0;

    forecastDownloadView.setStatus("Fetching file list…");

    let resources;
    try {
      resources = await fetchPackageResources(packageKey, downloadKey);
      if (!isModelResourceRefreshActive(downloadKey) || !resources) return;
    } catch (error) {
      if (!isModelResourceRefreshActive(downloadKey)) return;
      forecastDownloadView.setStatus(`API error: ${error.message}`);
      return;
    }

    applyModelResources(resources);
    const runSummary = formatRunSummary(resources);

    forecastDownloadView.setStatus(
      `Downloading ${resources.length} ${packageKey} files (${runSummary})…`,
    );
    forecastDownloadView.renderItems(resources);
    resetResourceStatuses(resources);
    const session = createModelDownloadSession({
      packageKey,
      pkg,
      resources,
      runSummary,
      downloadKey,
    });
    updateWarmupProgress();

    const latestReady = await forecastBlockRefreshService.refreshBlocksToLatest(session);
    if (!latestReady) return;

    await buildAnimationCacheAfterNetworkSettles(session);
  }

  async function refreshCurrentModelResourcesToLatest(downloadKey) {
    if (!isModelResourceRefreshActive(downloadKey)) return null;
    const packageKey = downloadKey.state.packageKey;
    const pkg = PACKAGES[packageKey];
    const previousResources = downloadKey.state.resources;

    forecastDownloadView.setStatus("Checking latest files…");
    let resources;
    try {
      resources = await fetchPackageResources(packageKey, downloadKey);
    } catch (error) {
      if (isModelResourceRefreshActive(downloadKey)) {
        forecastDownloadView.setStatus(`API error: ${error.message}`);
      }
      return null;
    }
    if (!isModelResourceRefreshActive(downloadKey) || !resources) return null;

    applyModelResources(resources);
    const runSummary = formatRunSummary(resources);
    forecastDownloadView.setStatus(
      `Checking ${resources.length} ${packageKey} files (${runSummary})…`,
    );
    forecastDownloadView.renderItems(resources);
    resetResourceStatuses(resources);

    const session = createModelDownloadSession({
      packageKey,
      pkg,
      resources,
      runSummary,
      downloadKey,
    });
    const latestReady = await forecastBlockRefreshService.refreshBlocksToLatest(session, {
      previousResources,
    });
    return latestReady ? session : null;
  }

  async function refreshCurrentModelVisuals() {
    const downloadKey = beginModelResourceRefresh();
    stopPlayer();
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    setRendering(false);
    invalidateBitmapCache();
    const myGen = renderGen;
    await showHour(Number.parseInt(dom.forecastSlider.value, 10));
    const session = await refreshCurrentModelResourcesToLatest(downloadKey);
    if (session && renderGen === myGen && isModelResourceRefreshActive(downloadKey)) {
      await buildAnimationCacheAfterNetworkSettles(session);
    }
  }

  async function handleVariableChange(varKey) {
    if (!modelState) return;
    modelState.variable = varKey;
    const varDef = findPackageVariable(modelState.packageKey, varKey);
    const shortName = varDef?.shortName ?? varKey;
    applyDefaultPalette(varKey);

    if (varDef) {
      updateParamInfo(
        varDef.name,
        parameterDescriptionFor(shortName),
        formatModelPackageSubtitle(modelState.packageKey),
      );
      updateLevelInfo(varDef);
    }

    await refreshCurrentModelVisuals();
  }

  function onForecastSliderInput() {
    if (!modelState) return;
    showHour(Number.parseInt(dom.forecastSlider.value, 10));
  }

  function resetModelState() {
    stopPlayer();
    invalidateBitmapCache();
    setRendering(false);
    modelState = null;
    isDecoding = false;
    pendingHourIdx = null;
    setGridState(null);
    updateWarmupProgress();
    forecastDownloadView.clear();
  }

  return {
    getDiagnostics() {
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
    },
    getModelState: () => modelState,
    getPackageKey: () => modelState?.packageKey ?? null,
    handleVariableChange,
    hasModelState: () => Boolean(modelState),
    isAnimationCacheReadyForPlayback,
    isBitmapCacheComplete,
    onForecastSliderInput,
    queueCurrentTooltipValueHydration,
    refreshCurrentModelVisuals,
    resetModelState,
    setAnimationPlayer(player) {
      animationPlayer = player;
      updateWarmupProgress();
    },
    showHour,
    startDownload,
  };
}
