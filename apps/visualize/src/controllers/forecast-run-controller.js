import {
  formatForecastValidTimeLabel as formatPackageForecastValidTimeLabel,
  formatModelPackageSubtitle as formatPackageModelSubtitle,
} from "../domain/forecast-package-labels.js";
import { buildHourList, createModelState, markBlockAvailable } from "../domain/forecast-state.js";
import { MODEL_INFO, PACKAGES } from "../domain/model-packages.js";
import { formatRunSummary } from "../domain/resources.js";
import { defaultPaletteFor } from "../domain/variable-metadata.js";
import { createDataGouvResourceService } from "../services/data-gouv-resource-service.js";
import { createForecastAnimationService } from "../services/forecast-animation-service.js";
import { createForecastAvailableBlockService } from "../services/forecast-available-block-service.js";
import { createForecastBlockRefreshService } from "../services/forecast-block-refresh-service.js";
import { createForecastDownloadSessionService } from "../services/forecast-download-session-service.js";
import { createForecastLegendInitializerService } from "../services/forecast-legend-initializer-service.js";
import { createForecastMapPresentationService } from "../services/forecast-map-presentation-service.js";
import { createForecastPresentationQueueService } from "../services/forecast-presentation-queue-service.js";
import { createForecastResourceRefreshService } from "../services/forecast-resource-refresh-service.js";
import { createForecastVariableSelectionService } from "../services/forecast-variable-selection-service.js";
import {
  deleteObsoleteCachedGribBlocks,
  readCachedGribBlock,
  readLatestCachedGribBlock,
  writeCachedGribBlock,
} from "../services/grib-cache-service.js";
import { createModelBlockService } from "../services/model-block-service.js";
import { BLOCK_STATUS, createDataStatusSummaryView } from "../ui/data-status-summary.js";
import { createForecastDownloadView } from "../ui/forecast-download-view.js";
import { createForecastHourControlView } from "../ui/forecast-hour-control-view.js";
import {
  createForecastVariableControlsView,
  defaultVariableForPackage,
} from "../ui/forecast-variable-select.js";
import { createForecastWarmupView } from "../ui/forecast-warmup-view.js";
import { createDownloadWorkerClient as createDefaultDownloadWorkerClient } from "../workers/download-worker-client.js";

const PROXY = "https://grib2-cors-proxy.imh.workers.dev";
const MAX_PARALLEL_DOWNLOADS = 6;

function fmtSize(bytes) {
  return bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${(bytes / 1e3).toFixed(0)} KB`;
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
  let modelBlockService = null;
  let downloadWorkerClient = null;
  let animationPlayer = null;
  const forecastDownloadView = createForecastDownloadView({
    document,
    barsEl: dom.forecastDownloadBars,
    fileListEl: dom.forecastDownloadFileList,
    statusEl: dom.forecastDownloadStatus,
    formatRunSummary,
    formatSize: fmtSize,
  });
  const forecastDownloadSessionService = createForecastDownloadSessionService({
    missingStatus: BLOCK_STATUS.MISSING,
  });
  const forecastResourceRefreshService = createForecastResourceRefreshService();
  const forecastWarmupView = createForecastWarmupView({
    root: dom.cacheWarmup,
    bar: dom.cacheWarmupBar,
    count: dom.cacheWarmupCount,
    label: dom.cacheWarmupLabel,
  });
  const forecastVariableControlsView = createForecastVariableControlsView({
    document,
    variableSelect: dom.forecastVarSelect,
    windDirectionControl: dom.forecastWindDirectionControl,
    windDirectionToggle: dom.forecastWindDirectionToggle,
  });
  const dataStatusSummaryView = createDataStatusSummaryView({
    document,
    container: dom.dataStatusSummary,
  });
  const forecastHourControlView = createForecastHourControlView({
    hourLabel: dom.forecastHourLabel,
    slider: dom.forecastSlider,
  });
  const mapPresenter = createForecastMapPresentationService({
    formatForecastValidTimeLabel,
    formatModelPackageSubtitle,
    getCurrentPalette,
    getModelState: () => modelState,
    gridCorners,
    initMap,
    makeGridState,
    mapPresentation,
    mapRenderer,
    missingValue,
    setGridState,
  });
  const {
    presentAvailableBlock: presentAvailableMapBlock,
    presentBitmapEntry,
    refreshWindSymbolOverlay,
    showUnavailableHour,
    updateIsobarOverlay,
    updateLevelInfo,
    updateParamInfo,
  } = mapPresenter;
  const forecastLegendInitializerService = createForecastLegendInitializerService({
    applyDefaultPalette,
    formatModelPackageSubtitle,
    showColorScale: mapPresentation.showColorScale,
    updateLevelInfo,
    updateParamInfo,
  });
  const forecastVariableSelectionService = createForecastVariableSelectionService({
    applyDefaultPalette,
    formatModelPackageSubtitle,
    updateLevelInfo,
    updateParamInfo,
  });
  const animationService = createForecastAnimationService({
    getCurrentPalette,
    getGridState,
    getSelectedHourIndex: forecastHourControlView.selectedIndex,
    getModelBlockService,
    getModelState: () => modelState,
    isPlayerPlaying,
    makeGridState,
    missingValue,
    notifyDiagnostics,
    perfDebug,
    presentBitmapEntry,
    renderForecastHourLabel: forecastHourControlView.renderHourLabel,
    renderWarmupProgress: forecastWarmupView.render,
    setGridState,
    showUnavailableHour,
    syncPlayButtonAvailability,
    updateIsobarOverlay,
  });
  const {
    invalidateBitmapCache,
    invalidateBlockRenderCache,
    isAnimationCacheReadyForPlayback,
    isBitmapCacheComplete,
    queueCurrentTooltipValueHydration,
    queuePrerenderForAllBlocks,
    showHour,
    updateWarmupProgress,
    waitForPrerenderIdle,
  } = animationService;

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

  function formatModelPackageSubtitle(packageKey) {
    return formatPackageModelSubtitle(PACKAGES, MODEL_INFO, packageKey);
  }

  function formatForecastValidTimeLabel(timeLabel) {
    return formatPackageForecastValidTimeLabel(
      PACKAGES,
      MODEL_INFO,
      modelState?.packageKey ?? null,
      timeLabel,
    );
  }

  function beginModelResourceRefresh() {
    return forecastResourceRefreshService.begin(modelState);
  }

  function isModelResourceRefreshActive(downloadKey) {
    return forecastResourceRefreshService.isActive(modelState, downloadKey);
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
    if (!modelState?.resources.length) return;
    dataStatusSummaryView.render(modelState.resources);
  }

  function configureModelVariableControls(pkg) {
    const firstVar = defaultVariableForPackage(pkg);
    const selectedVariable = forecastVariableSelectionService.selectInitialVariable(
      modelState,
      firstVar,
    );
    forecastVariableControlsView.renderVariableOptions({
      variables: pkg.variables,
      selectedVariable,
    });
    syncWindDirectionControl();
  }

  function syncWindDirectionControl() {
    forecastVariableControlsView.renderWindDirectionToggle(
      forecastVariableSelectionService.windDirectionControlState(modelState),
    );
  }

  function applyModelResources(resources) {
    modelState.resources = resources;
    modelState.hourList = buildHourList(resources);
    forecastHourControlView.renderHourList(modelState.hourList);
  }

  function isModelBlockInMemoryCurrent(block, previousBlock) {
    return forecastDownloadSessionService.isBlockInMemoryCurrent(modelState, {
      block,
      previousBlock,
    });
  }

  function isModelBlockInMemoryStale(block, previousBlock) {
    return forecastDownloadSessionService.isBlockInMemoryStale(modelState, {
      block,
      previousBlock,
    });
  }

  function updateAvailableFileCount(session) {
    forecastDownloadView.setStatus(forecastDownloadSessionService.fileCountStatus(session));
  }

  const forecastAvailableBlockService = createForecastAvailableBlockService({
    incrementAvailableCount: forecastDownloadSessionService.incrementAvailableCount,
    invalidateBlockRenderCache,
    markBlockAvailable,
    setBlockStatus,
    storeBlock: (block, buffer) => getModelBlockService().storeBlock(block, buffer),
  });

  function markInMemoryModelBlockAvailable(block, status, session) {
    setBlockStatus(block, status);
    setBlockDownloadProgress(block, "100%");
    forecastDownloadSessionService.incrementAvailableCount(session);
    updateAvailableFileCount(session);
    completeModelDownloadIfReady(session);
  }

  async function storeAvailableModelBlock(block, buffer, status, session) {
    const storedInWorker = await forecastAvailableBlockService.storeAvailableBlock({
      block,
      buffer,
      session,
      state: modelState,
      status,
    });
    if (!storedInWorker) return;

    setBlockDownloadProgress(block, "100%");
    updateAvailableFileCount(session);
  }

  function completeModelDownloadIfReady(session) {
    if (session.availableCount !== session.resources.length) return;
    updateAvailableFileCount(session);
  }

  async function presentAvailableModelBlock(block, buffer, status, session) {
    if (!isModelResourceRefreshActive(session.downloadKey)) return;
    forecastLegendInitializerService.initializeFromBlock(buffer, { modelState, session });
    await storeAvailableModelBlock(block, buffer, status, session);
    if (!isModelResourceRefreshActive(session.downloadKey)) return;
    await presentAvailableMapBlock(block, session, {
      isRefreshActive: isModelResourceRefreshActive,
      selectedHourIndex: forecastHourControlView.selectedIndex,
      showHour,
    });
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

  async function writeCachedModelBlock(packageKey, block, buffer) {
    const cacheWriteSucceeded = await writeCachedGribBlock(packageKey, block, buffer);
    if (cacheWriteSucceeded) updateStorageWarningSizeIfOpen?.();
    return cacheWriteSucceeded;
  }

  const forecastPresentationQueueService = createForecastPresentationQueueService({
    readyStatus: BLOCK_STATUS.READY,
    isSessionActive: (session) => isModelResourceRefreshActive(session.downloadKey),
    presentAvailableBlock: presentAvailableModelBlock,
    scheduleLowPriorityWork,
  });

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
      isRefreshActive: isModelResourceRefreshActive,
      isBlockInMemoryCurrent: isModelBlockInMemoryCurrent,
      isBlockInMemoryStale: isModelBlockInMemoryStale,
    },
    network: {
      downloadFile: downloadFileProg,
    },
    presentation: {
      enqueueAvailableBlock: forecastPresentationQueueService.enqueueAvailableBlock,
      waitForPresentationIdle: forecastPresentationQueueService.waitForIdle,
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
    forecastDownloadSessionService.resetResourceStatuses(resources, modelState);
    updateDataStatusSummary();
  }

  function prepareModelDownloadSession({ packageKey, pkg, resources, downloadKey }) {
    applyModelResources(resources);
    const runSummary = formatRunSummary(resources);
    forecastDownloadView.renderItems(resources);
    resetResourceStatuses(resources);
    return forecastDownloadSessionService.createSession({
      packageKey,
      pkg,
      resources,
      runSummary,
      downloadKey,
    });
  }

  async function startDownload(packageKey) {
    const pkg = PACKAGES[packageKey];
    modelState = createModelState(packageKey);
    mapRenderer.setVisible(false);
    const downloadKey = beginModelResourceRefresh();

    configureModelVariableControls(pkg);

    forecastHourControlView.reset();

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

    const session = prepareModelDownloadSession({
      packageKey,
      pkg,
      resources,
      downloadKey,
    });
    forecastDownloadView.setStatus(forecastDownloadSessionService.downloadStatus(session));
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

    const session = prepareModelDownloadSession({
      packageKey,
      pkg,
      resources,
      downloadKey,
    });
    forecastDownloadView.setStatus(forecastDownloadSessionService.refreshStatus(session));
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
    const capturedRenderGeneration = animationService.currentRenderGeneration;
    await showHour(forecastHourControlView.selectedIndex());
    const session = await refreshCurrentModelResourcesToLatest(downloadKey);
    if (
      session &&
      animationService.currentRenderGeneration === capturedRenderGeneration &&
      isModelResourceRefreshActive(downloadKey)
    ) {
      await buildAnimationCacheAfterNetworkSettles(session);
    }
  }

  async function handleVariableChange(varKey) {
    if (!modelState) return;
    forecastVariableSelectionService.selectVariable(modelState, varKey);
    syncWindDirectionControl();

    await refreshCurrentModelVisuals();
  }

  function setWindDirectionVisible(visible) {
    if (!modelState) return;
    modelState.showWindDirection = Boolean(visible);
    syncWindDirectionControl();
    refreshWindSymbolOverlay();
  }

  function onForecastSliderInput() {
    if (!modelState) return;
    showHour(forecastHourControlView.selectedIndex());
  }

  function resetModelState() {
    stopPlayer();
    invalidateBitmapCache();
    setRendering(false);
    modelState = null;
    animationService.resetDecoding();
    setGridState(null);
    updateWarmupProgress();
    forecastDownloadView.clear();
  }

  return {
    getDiagnostics() {
      return animationService.getDiagnostics();
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
    setWindDirectionVisible,
    setAnimationPlayer(player) {
      animationPlayer = player;
      updateWarmupProgress();
    },
    showHour,
    startDownload,
  };
}
