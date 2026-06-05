import {
  formatForecastValidTimeLabel as formatPackageForecastValidTimeLabel,
  formatModelPackageSubtitle as formatPackageModelSubtitle,
} from "../domain/forecast-package-labels.js";
import { buildHourList, createModelState, markBlockAvailable } from "../domain/forecast-state.js";
import { MODEL_INFO, PACKAGES } from "../domain/model-packages.js";
import { formatRunSummary } from "../domain/resources.js";
import { defaultPaletteFor } from "../domain/variable-metadata.js";
import { BLOCK_STATUS } from "../ui/data-status-summary.js";
import { createForecastAnimationCacheBuildUseCase } from "../use-cases/forecast/build-animation-cache";
import { createForecastLegendInitializerUseCase } from "../use-cases/forecast/initialize-legend";
import { createForecastResourceLoadUseCase } from "../use-cases/forecast/load-resources";
import { createForecastDownloadPreparationUseCase } from "../use-cases/forecast/prepare-download-session";
import { createForecastResourceRefreshUseCase } from "../use-cases/forecast/resource-refresh";
import { createForecastVariableSelectionUseCase } from "../use-cases/forecast/select-variable";
import { createForecastInitialDownloadUseCase } from "../use-cases/forecast/start-initial-download";
import { createForecastResourceUpdateUseCase } from "../use-cases/forecast/update-resources";
import { createDownloadWorkerClient as createDefaultDownloadWorkerClient } from "../workers/download-worker-client.js";
import { createDataGouvResourceService } from "./data-gouv-resource-service.js";
import { createForecastAnimationService } from "./forecast-animation-service.js";
import { createForecastAvailableBlockService } from "./forecast-available-block-service.js";
import { createForecastBlockRefreshService } from "./forecast-block-refresh-service.js";
import { createForecastDownloadSessionService } from "./forecast-download-session-service.js";
import { createForecastMapPresentationService } from "./forecast-map-presentation-service.js";
import { createForecastPackageResourceService } from "./forecast-package-resource-service.js";
import { createForecastPresentationQueueService } from "./forecast-presentation-queue-service.js";
import { createForecastRuntime } from "./forecast-runtime.js";
import {
  deleteObsoleteCachedGribBlocks,
  readCachedGribBlock,
  readLatestCachedGribBlock,
  writeCachedGribBlock,
} from "./grib-cache-service.js";
import { createModelBlockService } from "./model-block-service.js";

const PROXY = "https://grib2-cors-proxy.imh.workers.dev";
const MAX_PARALLEL_DOWNLOADS = 6;

export function createForecastRuntimeFactory({
  window,
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
  views,
  variableControls,
}) {
  const {
    dataStatusSummaryView,
    forecastDownloadView,
    forecastHourControlView,
    forecastWarmupView,
  } = views;

  let runtime = null;

  function getModelState() {
    return runtime?.api.getModelState() ?? null;
  }

  function getModelBlockService() {
    return runtime.runtimePorts.getModelBlockService();
  }

  function scheduleLowPriorityWork() {
    if ("requestIdleCallback" in window) {
      return new Promise((resolve) => {
        window.requestIdleCallback(resolve, { timeout: 300 });
      });
    }
    return new Promise((resolve) => window.requestAnimationFrame(resolve));
  }

  function waitForNextFrame() {
    return new Promise((resolve) => window.requestAnimationFrame(resolve));
  }

  function notifyDiagnostics() {
    updateDiagnostics?.();
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
      getModelState()?.packageKey ?? null,
      timeLabel,
    );
  }

  const forecastResourceRefreshUseCase = createForecastResourceRefreshUseCase();

  function beginModelResourceRefresh() {
    return forecastResourceRefreshUseCase.begin(getModelState());
  }

  function isModelResourceRefreshActive(downloadKey) {
    return forecastResourceRefreshUseCase.isActive(getModelState(), downloadKey);
  }

  function updateDataStatusSummary() {
    const modelState = getModelState();
    if (!modelState?.resources.length) return;
    dataStatusSummaryView.render(modelState.resources);
  }

  function setBlockStatus(block, status) {
    block.status = status;
    getModelState()?.blockStatus?.set(block.key, status);
    forecastDownloadView.setBlockStatus(block, status);
    updateDataStatusSummary();
  }

  function setBlockDownloadProgress(block, pct) {
    forecastDownloadView.setBlockDownloadProgress(block, pct);
  }

  function resetBlockDownloadProgress(block) {
    forecastDownloadView.resetBlockDownloadProgress(block);
  }

  function applyModelResources(resources) {
    const modelState = getModelState();
    modelState.resources = resources;
    modelState.hourList = buildHourList(resources);
    forecastHourControlView.renderHourList(modelState.hourList);
  }

  const mapPresenter = createForecastMapPresentationService({
    formatForecastValidTimeLabel,
    formatModelPackageSubtitle,
    getCurrentPalette,
    getModelState,
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

  const forecastLegendInitializerUseCase = createForecastLegendInitializerUseCase({
    applyDefaultPalette,
    formatModelPackageSubtitle,
    showColorScale: mapPresentation.showColorScale,
    updateLevelInfo,
    updateParamInfo,
  });

  const forecastVariableSelectionUseCase = createForecastVariableSelectionUseCase({
    applyDefaultPalette,
    formatModelPackageSubtitle,
    updateLevelInfo,
    updateParamInfo,
  });

  function configureModelVariableControls(pkg) {
    const firstVar = variableControls.defaultVariableForPackage(pkg);
    const selectedVariable = forecastVariableSelectionUseCase.selectInitialVariable(
      getModelState(),
      firstVar,
    );
    variableControls.renderVariableOptions({
      variables: pkg.variables,
      selectedVariable,
    });
    syncWindDirectionControl();
  }

  function syncWindDirectionControl() {
    variableControls.renderWindDirectionToggle(
      forecastVariableSelectionUseCase.windDirectionControlState(getModelState()),
    );
  }

  function selectVariable(varKey) {
    forecastVariableSelectionUseCase.selectVariable(getModelState(), varKey);
  }

  const animationService = createForecastAnimationService({
    getCurrentPalette,
    getGridState,
    getSelectedHourIndex: forecastHourControlView.selectedIndex,
    getModelBlockService,
    getModelState,
    isPlayerPlaying: () => runtime.runtimePorts.isPlayerPlaying(),
    makeGridState,
    missingValue,
    notifyDiagnostics,
    perfDebug,
    presentBitmapEntry,
    renderForecastHourLabel: forecastHourControlView.renderHourLabel,
    renderWarmupProgress: forecastWarmupView.render,
    setGridState,
    showUnavailableHour,
    syncPlayButtonAvailability: () => runtime.runtimePorts.syncPlayButtonAvailability(),
    updateIsobarOverlay,
  });

  const forecastAnimationCacheBuildUseCase = createForecastAnimationCacheBuildUseCase({
    getModelState,
    isBitmapCacheComplete: animationService.isBitmapCacheComplete,
    isRefreshActive: isModelResourceRefreshActive,
    queuePrerenderForAllBlocks: animationService.queuePrerenderForAllBlocks,
    updateWarmupProgress: animationService.updateWarmupProgress,
    waitForPrerenderIdle: animationService.waitForPrerenderIdle,
  });

  const forecastDownloadSessionService = createForecastDownloadSessionService({
    missingStatus: BLOCK_STATUS.MISSING,
  });

  function resetResourceStatuses(resources) {
    forecastDownloadSessionService.resetResourceStatuses(resources, getModelState());
    updateDataStatusSummary();
  }

  function isModelBlockInMemoryCurrent(block, previousBlock) {
    return forecastDownloadSessionService.isBlockInMemoryCurrent(getModelState(), {
      block,
      previousBlock,
    });
  }

  function isModelBlockInMemoryStale(block, previousBlock) {
    return forecastDownloadSessionService.isBlockInMemoryStale(getModelState(), {
      block,
      previousBlock,
    });
  }

  function updateAvailableFileCount(session) {
    forecastDownloadView.setStatus(forecastDownloadSessionService.fileCountStatus(session));
  }

  function completeModelDownloadIfReady(session) {
    if (session.availableCount !== session.resources.length) return;
    updateAvailableFileCount(session);
  }

  const forecastAvailableBlockService = createForecastAvailableBlockService({
    incrementAvailableCount: forecastDownloadSessionService.incrementAvailableCount,
    invalidateBlockRenderCache: animationService.invalidateBlockRenderCache,
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
      state: getModelState(),
      status,
    });
    if (!storedInWorker) return;

    setBlockDownloadProgress(block, "100%");
    updateAvailableFileCount(session);
  }

  async function presentAvailableModelBlock(block, buffer, status, session) {
    if (!isModelResourceRefreshActive(session.downloadKey)) return;
    forecastLegendInitializerUseCase.initializeFromBlock(buffer, {
      modelState: getModelState(),
      session,
    });
    await storeAvailableModelBlock(block, buffer, status, session);
    if (!isModelResourceRefreshActive(session.downloadKey)) return;
    await presentAvailableMapBlock(block, session, {
      isRefreshActive: isModelResourceRefreshActive,
      selectedHourIndex: forecastHourControlView.selectedIndex,
      showHour: animationService.showHour,
    });
    completeModelDownloadIfReady(session);
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
      downloadFile: (...args) => runtime.runtimePorts.downloadFileWithProgress(...args),
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
  const forecastPackageResourceService = createForecastPackageResourceService({
    fetchResources: dataGouvResourceService.fetchResources,
    isRefreshActive: isModelResourceRefreshActive,
  });
  const forecastResourceLoadUseCase = createForecastResourceLoadUseCase({
    fetchPackageResources: forecastPackageResourceService.fetchPackageResources,
    isRefreshActive: isModelResourceRefreshActive,
    setStatus: forecastDownloadView.setStatus,
  });
  const forecastDownloadPreparationUseCase = createForecastDownloadPreparationUseCase({
    applyResources: applyModelResources,
    createSession: forecastDownloadSessionService.createSession,
    formatRunSummary,
    renderItems: forecastDownloadView.renderItems,
    resetResourceStatuses,
  });
  const forecastResourceUpdateUseCase = createForecastResourceUpdateUseCase({
    isRefreshActive: isModelResourceRefreshActive,
    loadPackageResources: forecastResourceLoadUseCase.loadPackageResources,
    prepareSession: forecastDownloadPreparationUseCase.prepareSession,
    refreshBlocksToLatest: forecastBlockRefreshService.refreshBlocksToLatest,
    refreshStatus: forecastDownloadSessionService.refreshStatus,
    setStatus: forecastDownloadView.setStatus,
  });
  const forecastInitialDownloadUseCase = createForecastInitialDownloadUseCase({
    downloadStatus: forecastDownloadSessionService.downloadStatus,
    isRefreshActive: isModelResourceRefreshActive,
    loadPackageResources: forecastResourceLoadUseCase.loadPackageResources,
    prepareSession: forecastDownloadPreparationUseCase.prepareSession,
    refreshBlocksToLatest: forecastBlockRefreshService.refreshBlocksToLatest,
    setStatus: forecastDownloadView.setStatus,
  });

  runtime = createForecastRuntime({
    animationService,
    beginResourceRefresh: beginModelResourceRefresh,
    buildAnimationCacheAfterNetworkSettles:
      forecastAnimationCacheBuildUseCase.buildAfterNetworkSettles,
    configureModelVariableControls,
    createDownloadWorkerClient,
    createModelBlockServiceClient,
    createModelState,
    downloadInitialForecast: forecastInitialDownloadUseCase.startInitialDownload,
    downloadWorkerProxyUrl: dataGouvResourceService.proxyResourceUrl,
    getSelectedHourIndex: forecastHourControlView.selectedIndex,
    getPackage: (packageKey) => PACKAGES[packageKey],
    isResourceRefreshActive: isModelResourceRefreshActive,
    mapRenderer,
    refreshCurrentResourcesToLatest: forecastResourceUpdateUseCase.refreshCurrentResourcesToLatest,
    refreshWindSymbolOverlay,
    resetDownloadView: forecastDownloadView.clear,
    resetForecastHourControl: forecastHourControlView.reset,
    resetRuntimePresentation: () => {},
    selectVariable,
    setGridState,
    setRendering,
    syncWindDirectionControl,
    waitForNextFrame,
  });

  return runtime.api;
}
