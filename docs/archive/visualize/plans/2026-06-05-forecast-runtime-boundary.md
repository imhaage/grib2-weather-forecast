# Forecast Runtime Boundary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `forecast-run-controller.js` a thin adapter by moving forecast runtime state, service wiring, and use-cases into dedicated runtime modules.

**Architecture:** Keep `createForecastRunController` as the public adapter. Add `createForecastRuntimeFactory` for service composition and `createForecastRuntime` for runtime state and forecast use-cases. Runtime code remains DOM-free and talks to UI through explicit view ports created by the controller.

**Tech Stack:** JavaScript ES modules, Vitest, jsdom, Vite app under `apps/visualize`.

---

## File Structure

- Create: `apps/visualize/src/services/forecast-runtime.js`
  - Owns `runtimeState`.
  - Exposes the forecast controller API methods.
  - Contains use-case orchestration currently implemented inside `forecast-run-controller.js`.

- Create: `apps/visualize/src/services/forecast-runtime-factory.js`
  - Imports and wires forecast services.
  - Creates `createForecastRuntime`.
  - Owns service composition currently implemented inside `forecast-run-controller.js`.

- Modify: `apps/visualize/src/controllers/forecast-run-controller.js`
  - Keep DOM-backed view creation.
  - Create the runtime through `createForecastRuntimeFactory`.
  - Return runtime API unchanged.

- Modify: `apps/visualize/src/controllers/forecast-run-controller.test.js`
  - Keep integration tests covering public behavior.
  - Update expectations only if import paths or internals move without behavior change.

- Create if needed: `apps/visualize/src/services/forecast-runtime.test.js`
  - Add focused tests only for runtime behavior not clearly protected by controller integration tests.

## DRY and Boundary Notes Before Editing

The controller currently repeats adapter patterns around model state and status updates:

- `getModelState: () => modelState`
- `isRefreshActive: isModelResourceRefreshActive`
- status ports wrapping `forecastDownloadView`
- presentation ports wrapping `showHour`, `selectedIndex`, and refresh checks
- worker lazy initialization

The abstraction is not another tiny helper for each repeated pattern. The chosen abstraction is the runtime boundary:

- `forecast-runtime-factory.js` centralizes wiring.
- `forecast-runtime.js` centralizes runtime state and use-cases.

This avoids a controller split that only moves repeated closures into many small files.

---

### Task 1: Introduce the Runtime Module

**Files:**
- Create: `apps/visualize/src/services/forecast-runtime.js`
- Modify: `apps/visualize/src/controllers/forecast-run-controller.js`
- Test: `apps/visualize/src/controllers/forecast-run-controller.test.js`

- [ ] **Step 1: Create the runtime file with the public API shape**

Add `apps/visualize/src/services/forecast-runtime.js`:

```js
export function createForecastRuntime({
  animationService,
  buildAnimationCacheAfterNetworkSettles,
  beginResourceRefresh,
  configureModelVariableControls,
  createModelBlockServiceClient,
  createModelState,
  createDownloadWorkerClient,
  downloadInitialForecast,
  downloadWorkerProxyUrl,
  forecastHourControlView,
  getPackage,
  isResourceRefreshActive,
  mapRenderer,
  refreshCurrentResourcesToLatest,
  refreshWindSymbolOverlay,
  resetDownloadView,
  resetRuntimePresentation,
  selectVariable,
  setRendering,
  setGridState,
  syncWindDirectionControl,
  window,
}) {
  const runtimeState = {
    modelState: null,
    modelBlockService: null,
    downloadWorkerClient: null,
    animationPlayer: null,
  };

  function getModelState() {
    return runtimeState.modelState;
  }

  function getModelBlockService() {
    if (!runtimeState.modelBlockService) {
      runtimeState.modelBlockService = createModelBlockServiceClient();
    }
    return runtimeState.modelBlockService;
  }

  function initDownloadWorker() {
    if (runtimeState.downloadWorkerClient) return;
    runtimeState.downloadWorkerClient = createDownloadWorkerClient();
  }

  async function downloadFileInWorker(url, filesize, onProgress) {
    initDownloadWorker();
    const result = await runtimeState.downloadWorkerClient.post({ url, filesize }, [], {
      onProgress: ({ loaded, total }) => onProgress(loaded, total),
    });
    if (!result?.buffer) throw new Error("Download failed");
    return new Uint8Array(result.buffer);
  }

  async function downloadFileProg(url, filesize, onProgress) {
    return downloadFileInWorker(downloadWorkerProxyUrl(url), filesize, onProgress);
  }

  function stopPlayer() {
    runtimeState.animationPlayer?.stopPlayer();
  }

  function syncPlayButtonAvailability() {
    runtimeState.animationPlayer?.syncPlayButtonAvailability();
  }

  function isPlayerPlaying() {
    return Boolean(runtimeState.animationPlayer?.isPlaying());
  }

  async function startDownload(packageKey) {
    const pkg = getPackage(packageKey);
    runtimeState.modelState = createModelState(packageKey);
    mapRenderer.setVisible(false);
    const downloadKey = beginResourceRefresh();

    configureModelVariableControls(pkg);
    forecastHourControlView.reset();

    const session = await downloadInitialForecast({
      packageKey,
      pkg,
      downloadKey,
      downloadFile: downloadFileProg,
      getModelBlockService,
    });
    if (!session) return;
    animationService.updateWarmupProgress();

    await buildAnimationCacheAfterNetworkSettles(session);
  }

  async function refreshCurrentModelVisuals() {
    const downloadKey = beginResourceRefresh();
    stopPlayer();
    await new Promise((resolve) => window.requestAnimationFrame(resolve));
    setRendering(false);
    animationService.invalidateBitmapCache();
    const capturedRenderGeneration = animationService.currentRenderGeneration;
    await animationService.showHour(forecastHourControlView.selectedIndex());
    const session = await refreshCurrentResourcesToLatest({
      downloadKey,
      downloadFile: downloadFileProg,
      getModelBlockService,
    });
    if (
      session &&
      animationService.currentRenderGeneration === capturedRenderGeneration &&
      isResourceRefreshActive(downloadKey)
    ) {
      await buildAnimationCacheAfterNetworkSettles(session);
    }
  }

  async function handleVariableChange(varKey) {
    if (!runtimeState.modelState) return;
    selectVariable(varKey);
    syncWindDirectionControl();
    await refreshCurrentModelVisuals();
  }

  function setWindDirectionVisible(visible) {
    if (!runtimeState.modelState) return;
    runtimeState.modelState.showWindDirection = Boolean(visible);
    syncWindDirectionControl();
    refreshWindSymbolOverlay();
  }

  function onForecastSliderInput() {
    if (!runtimeState.modelState) return;
    animationService.showHour(forecastHourControlView.selectedIndex());
  }

  function resetModelState() {
    stopPlayer();
    animationService.invalidateBitmapCache();
    setRendering(false);
    runtimeState.modelState = null;
    animationService.resetDecoding();
    setGridState(null);
    animationService.updateWarmupProgress();
    resetRuntimePresentation();
    resetDownloadView();
  }

  return {
    downloadFileProg,
    getDiagnostics: animationService.getDiagnostics,
    getModelBlockService,
    getModelState,
    getPackageKey: () => runtimeState.modelState?.packageKey ?? null,
    handleVariableChange,
    hasModelState: () => Boolean(runtimeState.modelState),
    isAnimationCacheReadyForPlayback: animationService.isAnimationCacheReadyForPlayback,
    isBitmapCacheComplete: animationService.isBitmapCacheComplete,
    isPlayerPlaying,
    onForecastSliderInput,
    queueCurrentTooltipValueHydration: animationService.queueCurrentTooltipValueHydration,
    refreshCurrentModelVisuals,
    resetModelState,
    setAnimationPlayer(player) {
      runtimeState.animationPlayer = player;
      animationService.updateWarmupProgress();
    },
    setWindDirectionVisible,
    showHour: animationService.showHour,
    startDownload,
    syncPlayButtonAvailability,
  };
}
```

- [ ] **Step 2: Run the controller test to verify the new file is not wired yet**

Run:

```bash
npm test -- apps/visualize/src/controllers/forecast-run-controller.test.js
```

Expected: PASS. The new file is unused, so this verifies the baseline still works.

- [ ] **Step 3: Commit nothing yet**

Do not commit after Task 1. The runtime module is only useful once the factory wires it.

---

### Task 2: Introduce the Runtime Factory and Move Wiring

**Files:**
- Create: `apps/visualize/src/services/forecast-runtime-factory.js`
- Modify: `apps/visualize/src/controllers/forecast-run-controller.js`
- Modify: `apps/visualize/src/services/forecast-runtime.js`
- Test: `apps/visualize/src/controllers/forecast-run-controller.test.js`

- [ ] **Step 1: Create the runtime factory imports**

Add `apps/visualize/src/services/forecast-runtime-factory.js` with these imports:

```js
import {
  formatForecastValidTimeLabel as formatPackageForecastValidTimeLabel,
  formatModelPackageSubtitle as formatPackageModelSubtitle,
} from "../domain/forecast-package-labels.js";
import { buildHourList, createModelState, markBlockAvailable } from "../domain/forecast-state.js";
import { MODEL_INFO, PACKAGES } from "../domain/model-packages.js";
import { formatRunSummary } from "../domain/resources.js";
import { defaultPaletteFor } from "../domain/variable-metadata.js";
import { createDataGouvResourceService } from "./data-gouv-resource-service.js";
import { createForecastAnimationCacheBuildService } from "./forecast-animation-cache-build-service.js";
import { createForecastAnimationService } from "./forecast-animation-service.js";
import { createForecastAvailableBlockService } from "./forecast-available-block-service.js";
import { createForecastBlockRefreshService } from "./forecast-block-refresh-service.js";
import { createForecastDownloadPreparationService } from "./forecast-download-preparation-service.js";
import { createForecastDownloadSessionService } from "./forecast-download-session-service.js";
import { createForecastInitialDownloadService } from "./forecast-initial-download-service.js";
import { createForecastLegendInitializerService } from "./forecast-legend-initializer-service.js";
import { createForecastMapPresentationService } from "./forecast-map-presentation-service.js";
import { createForecastPackageResourceService } from "./forecast-package-resource-service.js";
import { createForecastPresentationQueueService } from "./forecast-presentation-queue-service.js";
import { createForecastResourceLoadService } from "./forecast-resource-load-service.js";
import { createForecastResourceRefreshService } from "./forecast-resource-refresh-service.js";
import { createForecastResourceUpdateService } from "./forecast-resource-update-service.js";
import { createForecastVariableSelectionService } from "./forecast-variable-selection-service.js";
import {
  deleteObsoleteCachedGribBlocks,
  readCachedGribBlock,
  readLatestCachedGribBlock,
  writeCachedGribBlock,
} from "./grib-cache-service.js";
import { createModelBlockService } from "./model-block-service.js";
import { BLOCK_STATUS } from "../ui/data-status-summary.js";
import { createDownloadWorkerClient as createDefaultDownloadWorkerClient } from "../workers/download-worker-client.js";
import { createForecastRuntime } from "./forecast-runtime.js";

const PROXY = "https://grib2-cors-proxy.imh.workers.dev";
const MAX_PARALLEL_DOWNLOADS = 6;
```

- [ ] **Step 2: Implement `createForecastRuntimeFactory` by moving existing controller wiring**

Add the factory body. The implementation should be a direct move from
`forecast-run-controller.js` with the controller-local view instances passed in:

```js
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
}) {
  const {
    dataStatusSummaryView,
    forecastDownloadView,
    forecastHourControlView,
    forecastVariableControlsView,
    forecastWarmupView,
  } = views;

  function scheduleLowPriorityWork() {
    if ("requestIdleCallback" in window) {
      return new Promise((resolve) => {
        window.requestIdleCallback(resolve, { timeout: 300 });
      });
    }
    return new Promise((resolve) => window.requestAnimationFrame(resolve));
  }

  function applyDefaultPalette(shortName) {
    const palette = defaultPaletteFor(shortName);
    if (!palette) return;
    setCurrentPalette(palette);
  }

  function formatModelPackageSubtitle(packageKey) {
    return formatPackageModelSubtitle(PACKAGES, MODEL_INFO, packageKey);
  }

  let runtime = null;

  function getModelState() {
    return runtime?.getModelState() ?? null;
  }

  function getModelBlockService() {
    return runtime.getModelBlockService();
  }

  function formatForecastValidTimeLabel(timeLabel) {
    return formatPackageForecastValidTimeLabel(
      PACKAGES,
      MODEL_INFO,
      getModelState()?.packageKey ?? null,
      timeLabel,
    );
  }

  const forecastResourceRefreshService = createForecastResourceRefreshService();

  function beginModelResourceRefresh() {
    return forecastResourceRefreshService.begin(getModelState());
  }

  function isModelResourceRefreshActive(downloadKey) {
    return forecastResourceRefreshService.isActive(getModelState(), downloadKey);
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

  function configureModelVariableControls(pkg) {
    const firstVar = forecastVariableControlsView.defaultVariableForPackage(pkg);
    const selectedVariable = forecastVariableSelectionService.selectInitialVariable(
      getModelState(),
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
      forecastVariableSelectionService.windDirectionControlState(getModelState()),
    );
  }

  function selectVariable(varKey) {
    forecastVariableSelectionService.selectVariable(getModelState(), varKey);
  }

  const animationService = createForecastAnimationService({
    getCurrentPalette,
    getGridState,
    getSelectedHourIndex: forecastHourControlView.selectedIndex,
    getModelBlockService,
    getModelState,
    isPlayerPlaying: () => runtime.isPlayerPlaying(),
    makeGridState,
    missingValue,
    notifyDiagnostics: () => updateDiagnostics?.(),
    perfDebug,
    presentBitmapEntry,
    renderForecastHourLabel: forecastHourControlView.renderHourLabel,
    renderWarmupProgress: forecastWarmupView.render,
    setGridState,
    showUnavailableHour,
    syncPlayButtonAvailability: () => runtime.syncPlayButtonAvailability(),
    updateIsobarOverlay,
  });

  const forecastAnimationCacheBuildService = createForecastAnimationCacheBuildService({
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
    forecastLegendInitializerService.initializeFromBlock(buffer, {
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
      downloadFile: (...args) => runtime.downloadFileProg(...args),
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
  const forecastResourceLoadService = createForecastResourceLoadService({
    fetchPackageResources: forecastPackageResourceService.fetchPackageResources,
    isRefreshActive: isModelResourceRefreshActive,
    setStatus: forecastDownloadView.setStatus,
  });
  const forecastDownloadPreparationService = createForecastDownloadPreparationService({
    applyResources: applyModelResources,
    createSession: forecastDownloadSessionService.createSession,
    formatRunSummary,
    renderItems: forecastDownloadView.renderItems,
    resetResourceStatuses,
  });
  const forecastResourceUpdateService = createForecastResourceUpdateService({
    isRefreshActive: isModelResourceRefreshActive,
    loadPackageResources: forecastResourceLoadService.loadPackageResources,
    prepareSession: forecastDownloadPreparationService.prepareSession,
    refreshBlocksToLatest: forecastBlockRefreshService.refreshBlocksToLatest,
    refreshStatus: forecastDownloadSessionService.refreshStatus,
    setStatus: forecastDownloadView.setStatus,
  });
  const forecastInitialDownloadService = createForecastInitialDownloadService({
    downloadStatus: forecastDownloadSessionService.downloadStatus,
    isRefreshActive: isModelResourceRefreshActive,
    loadPackageResources: forecastResourceLoadService.loadPackageResources,
    prepareSession: forecastDownloadPreparationService.prepareSession,
    refreshBlocksToLatest: forecastBlockRefreshService.refreshBlocksToLatest,
    setStatus: forecastDownloadView.setStatus,
  });

  runtime = createForecastRuntime({
    animationService,
    beginResourceRefresh: beginModelResourceRefresh,
    buildAnimationCacheAfterNetworkSettles:
      forecastAnimationCacheBuildService.buildAfterNetworkSettles,
    configureModelVariableControls,
    createDownloadWorkerClient,
    createModelBlockServiceClient,
    createModelState,
    downloadInitialForecast: forecastInitialDownloadService.startInitialDownload,
    downloadWorkerProxyUrl: dataGouvResourceService.proxyResourceUrl,
    forecastHourControlView,
    getPackage: (packageKey) => PACKAGES[packageKey],
    isResourceRefreshActive: isModelResourceRefreshActive,
    mapRenderer,
    refreshCurrentResourcesToLatest:
      forecastResourceUpdateService.refreshCurrentResourcesToLatest,
    refreshWindSymbolOverlay,
    resetDownloadView: forecastDownloadView.clear,
    resetRuntimePresentation: () => {},
    selectVariable,
    setGridState,
    setRendering,
    syncWindDirectionControl,
    window,
  });

  return runtime;
}
```

- [ ] **Step 3: Adjust `forecast-runtime.js` after wiring reality**

Replace callback signatures that pass `downloadFile` and `getModelBlockService` into services if the moved services already close over those dependencies in the factory.

The expected final calls are:

```js
const session = await downloadInitialForecast({
  packageKey,
  pkg,
  downloadKey,
});
```

and:

```js
const session = await refreshCurrentResourcesToLatest(downloadKey);
```

- [ ] **Step 4: Keep the controller as view adapter**

In `apps/visualize/src/controllers/forecast-run-controller.js`, keep only:

```js
import { formatRunSummary } from "../domain/resources.js";
import { createForecastRuntimeFactory } from "../services/forecast-runtime-factory.js";
import { createDataStatusSummaryView } from "../ui/data-status-summary.js";
import { createForecastDownloadView } from "../ui/forecast-download-view.js";
import { createForecastHourControlView } from "../ui/forecast-hour-control-view.js";
import {
  createForecastVariableControlsView,
  defaultVariableForPackage,
} from "../ui/forecast-variable-select.js";
import { createForecastWarmupView } from "../ui/forecast-warmup-view.js";

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
  createDownloadWorkerClient,
  createModelBlockServiceClient,
  getCurrentPalette,
  getGridState,
  setCurrentPalette,
  setGridState,
  setRendering,
  updateDiagnostics,
  updateStorageWarningSizeIfOpen,
}) {
  const forecastDownloadView = createForecastDownloadView({
    document,
    barsEl: dom.forecastDownloadBars,
    fileListEl: dom.forecastDownloadFileList,
    statusEl: dom.forecastDownloadStatus,
    formatRunSummary,
    formatSize: fmtSize,
  });
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
  forecastVariableControlsView.defaultVariableForPackage = defaultVariableForPackage;
  const dataStatusSummaryView = createDataStatusSummaryView({
    document,
    container: dom.dataStatusSummary,
  });
  const forecastHourControlView = createForecastHourControlView({
    hourLabel: dom.forecastHourLabel,
    slider: dom.forecastSlider,
  });

  return createForecastRuntimeFactory({
    window,
    mapRenderer,
    mapPresentation,
    perfDebug,
    missingValue,
    makeGridState,
    gridCorners,
    initMap,
    fetchImpl,
    createDownloadWorkerClient,
    createModelBlockServiceClient,
    getCurrentPalette,
    getGridState,
    setCurrentPalette,
    setGridState,
    setRendering,
    updateDiagnostics,
    updateStorageWarningSizeIfOpen,
    views: {
      dataStatusSummaryView,
      forecastDownloadView,
      forecastHourControlView,
      forecastVariableControlsView,
      forecastWarmupView,
    },
  });
}
```

During implementation, avoid adding `defaultVariableForPackage` as a dynamic property if a cleaner port object is clearer:

```js
variableControls: {
  defaultVariableForPackage,
  renderVariableOptions: forecastVariableControlsView.renderVariableOptions,
  renderWindDirectionToggle: forecastVariableControlsView.renderWindDirectionToggle,
}
```

Prefer the cleaner port object if it keeps the factory readable.

- [ ] **Step 5: Run the focused controller test**

Run:

```bash
npm test -- apps/visualize/src/controllers/forecast-run-controller.test.js
```

Expected: PASS.

- [ ] **Step 6: Commit the boundary extraction**

Run:

```bash
git add apps/visualize/src/controllers/forecast-run-controller.js apps/visualize/src/services/forecast-runtime.js apps/visualize/src/services/forecast-runtime-factory.js apps/visualize/src/controllers/forecast-run-controller.test.js
git commit -m "Extract forecast runtime boundary"
```

---

### Task 3: Cleanup Runtime Ports and Add Focused Tests

**Files:**
- Modify: `apps/visualize/src/services/forecast-runtime.js`
- Modify: `apps/visualize/src/services/forecast-runtime-factory.js`
- Create if needed: `apps/visualize/src/services/forecast-runtime.test.js`
- Test: `apps/visualize/src/services/forecast-runtime.test.js`
- Test: `apps/visualize/src/controllers/forecast-run-controller.test.js`

- [ ] **Step 1: Inspect the extracted files for controller leakage**

Run:

```bash
rg "document|dom\\.|querySelector|createElement" apps/visualize/src/services/forecast-runtime.js apps/visualize/src/services/forecast-runtime-factory.js
```

Expected:

- `forecast-runtime.js` has no matches.
- `forecast-runtime-factory.js` has no direct DOM matches.

- [ ] **Step 2: Rename ambiguous ports**

Use these names in `forecast-runtime.js` if the first extraction produced vague callbacks:

```js
beginResourceRefresh
buildAnimationCacheAfterNetworkSettles
configureModelVariableControls
downloadInitialForecast
refreshCurrentResourcesToLatest
refreshWindSymbolOverlay
syncWindDirectionControl
```

Avoid names such as:

```js
doRefresh
run
handler
service
cb
```

- [ ] **Step 3: Add focused runtime test only if controller coverage is too broad**

Create `apps/visualize/src/services/forecast-runtime.test.js` when one of these behaviors cannot be clearly asserted through existing controller tests:

- `setAnimationPlayer` updates warmup progress.
- `setWindDirectionVisible` changes state and refreshes wind overlay.
- `resetModelState` clears runtime state and calls reset ports.

Use this minimum test for `setWindDirectionVisible`:

```js
import { describe, expect, test, vi } from "vitest";
import { createForecastRuntime } from "./forecast-runtime.js";

function createRuntime(overrides = {}) {
  const modelState = { packageKey: "AROME_SP1", showWindDirection: true };
  const animationService = {
    currentRenderGeneration: 0,
    getDiagnostics: vi.fn(() => ({})),
    invalidateBitmapCache: vi.fn(),
    isAnimationCacheReadyForPlayback: vi.fn(() => false),
    isBitmapCacheComplete: vi.fn(() => false),
    queueCurrentTooltipValueHydration: vi.fn(),
    resetDecoding: vi.fn(),
    showHour: vi.fn(),
    updateWarmupProgress: vi.fn(),
    ...overrides.animationService,
  };
  const runtime = createForecastRuntime({
    animationService,
    beginResourceRefresh: vi.fn(() => ({ state: modelState })),
    buildAnimationCacheAfterNetworkSettles: vi.fn(),
    configureModelVariableControls: vi.fn(),
    createDownloadWorkerClient: vi.fn(),
    createModelBlockServiceClient: vi.fn(),
    createModelState: vi.fn(() => modelState),
    downloadInitialForecast: vi.fn(),
    downloadWorkerProxyUrl: (url) => url,
    forecastHourControlView: {
      reset: vi.fn(),
      selectedIndex: vi.fn(() => 0),
    },
    getPackage: vi.fn(() => ({ variables: [] })),
    isResourceRefreshActive: vi.fn(() => true),
    mapRenderer: { setVisible: vi.fn() },
    refreshCurrentResourcesToLatest: vi.fn(),
    refreshWindSymbolOverlay: vi.fn(),
    resetDownloadView: vi.fn(),
    resetRuntimePresentation: vi.fn(),
    selectVariable: vi.fn(),
    setGridState: vi.fn(),
    setRendering: vi.fn(),
    syncWindDirectionControl: vi.fn(),
    window: { requestAnimationFrame: (callback) => callback() },
    ...overrides,
  });
  runtime.startDownload("AROME_SP1");
  return runtime;
}

describe("forecast runtime", () => {
  test("toggles wind direction and refreshes the overlay", async () => {
    const refreshWindSymbolOverlay = vi.fn();
    const syncWindDirectionControl = vi.fn();
    const runtime = createRuntime({
      refreshWindSymbolOverlay,
      syncWindDirectionControl,
    });

    await Promise.resolve();
    runtime.setWindDirectionVisible(false);

    expect(runtime.getModelState().showWindDirection).toBe(false);
    expect(syncWindDirectionControl).toHaveBeenCalled();
    expect(refreshWindSymbolOverlay).toHaveBeenCalled();
  });
});
```

If this test is added, adjust async setup so `startDownload` has completed before assertions:

```js
await runtime.startDownload("AROME_SP1");
```

instead of calling `runtime.startDownload` inside a non-async helper.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm test -- apps/visualize/src/controllers/forecast-run-controller.test.js apps/visualize/src/services/forecast-runtime.test.js
```

Expected: PASS. If `forecast-runtime.test.js` was not added, run only the controller test.

- [ ] **Step 5: Commit cleanup**

Run:

```bash
git add apps/visualize/src/services/forecast-runtime.js apps/visualize/src/services/forecast-runtime-factory.js apps/visualize/src/services/forecast-runtime.test.js apps/visualize/src/controllers/forecast-run-controller.js apps/visualize/src/controllers/forecast-run-controller.test.js
git commit -m "Clean up forecast runtime ports"
```

If `forecast-runtime.test.js` was not created, omit it from `git add`.

---

### Task 4: Full Verification

**Files:**
- Read: `package.json`
- Read: `apps/visualize/package.json` if present

- [ ] **Step 1: Run all available tests**

Run:

```bash
npm test
```

Expected: PASS for the full test suite.

- [ ] **Step 2: Run visualize build if tests do not already cover module bundling**

Run:

```bash
npm run build:visualize
```

Expected: build completes successfully.

- [ ] **Step 3: Inspect final file sizes**

Run:

```bash
wc -l apps/visualize/src/controllers/forecast-run-controller.js apps/visualize/src/services/forecast-runtime.js apps/visualize/src/services/forecast-runtime-factory.js
```

Expected:

- `forecast-run-controller.js` is materially smaller than 551 lines.
- The new runtime files have clear responsibilities.

- [ ] **Step 4: Verify git state**

Run:

```bash
git status --short
```

Expected: no uncommitted changes after both implementation commits.

---

## Self-Review

Spec coverage:

- Thin controller: Task 2.
- Runtime factory: Task 2.
- Explicit runtime state: Task 1.
- UI ports instead of DOM in runtime: Task 2 and Task 3.
- Stable public API: Task 2 and controller integration tests.
- Two-commit strategy: Task 2 and Task 3 commits.
- All tests available: Task 4.

Placeholder scan:

- No open-ended implementation placeholders are intended.
- The only conditional branch is whether focused runtime tests are necessary after extraction; the plan provides exact criteria and exact test content if needed.

Type and naming consistency:

- Public controller methods match the design spec.
- Runtime state uses `runtimeState`.
- Factory and runtime use factory functions to match existing project style.
