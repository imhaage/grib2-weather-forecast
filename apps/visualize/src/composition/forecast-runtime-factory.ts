import { createModelBlockWorkerAdapter } from "../adapters/forecast/model-block-worker-adapter";
import { createModelState } from "../domain/forecast-state.js";
import { PACKAGES } from "../domain/model-packages.js";
import type { ForecastRefreshKey } from "../use-cases/forecast/contracts";
import { createForecastRuntimeUseCase } from "../use-cases/forecast/manage-runtime";
import { createForecastResourceRefreshUseCase } from "../use-cases/forecast/resource-refresh";
import type {
  ForecastRuntimeApi,
  ForecastRuntimeResult,
} from "../use-cases/forecast/runtime-contracts";
import { createDownloadWorkerClient as createDefaultDownloadWorkerClient } from "../workers/download-worker-client.js";
import { createForecastDownloadRuntime } from "./create-forecast-download-runtime";
import { createForecastRenderRuntime } from "./create-forecast-render-runtime";
import type { CreateForecastRuntimeFactoryOptions } from "./forecast-runtime-composition-contracts";

export type { CreateForecastRuntimeFactoryOptions } from "./forecast-runtime-composition-contracts";

export function createForecastRuntimeFactory({
  window,
  mapRenderer,
  mapPresentation,
  perfDebug = false,
  missingValue,
  makeGridState,
  gridCorners,
  initMap,
  fetchImpl,
  createDownloadWorkerClient = createDefaultDownloadWorkerClient,
  createModelBlockServiceClient = createModelBlockWorkerAdapter,
  getCurrentPalette,
  getGridState,
  setCurrentPalette,
  setGridState,
  setRendering,
  updateDiagnostics,
  updateStorageWarningSizeIfOpen,
  views,
  variableControls,
}: CreateForecastRuntimeFactoryOptions): ForecastRuntimeApi {
  let runtime: ForecastRuntimeResult | null = null;

  function getModelState() {
    return runtime?.api.getModelState() ?? null;
  }

  function getModelBlockService() {
    if (!runtime) {
      throw new Error("Forecast runtime is required");
    }

    return runtime.runtimePorts.getModelBlockService();
  }

  function isPlayerPlaying() {
    return runtime?.runtimePorts.isPlayerPlaying() ?? false;
  }

  function syncPlayButtonAvailability() {
    runtime?.runtimePorts.syncPlayButtonAvailability();
  }

  function scheduleLowPriorityWork() {
    if (window.requestIdleCallback) {
      return new Promise<void>((resolve) => {
        window.requestIdleCallback?.(() => resolve(), { timeout: 300 });
      });
    }

    return new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  }

  function waitForNextFrame() {
    return new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
  }

  function notifyDiagnostics() {
    updateDiagnostics?.();
  }

  const resourceRefreshUseCase = createForecastResourceRefreshUseCase();

  function beginResourceRefresh() {
    const refreshKey = resourceRefreshUseCase.begin(getModelState());

    if (!refreshKey) {
      throw new Error("Forecast model state is required");
    }

    return refreshKey;
  }

  function isResourceRefreshActive(downloadKey: ForecastRefreshKey) {
    return resourceRefreshUseCase.isActive(getModelState(), downloadKey);
  }

  const renderRuntime = createForecastRenderRuntime({
    getCurrentPalette,
    getGridState,
    getModelBlockService,
    getModelState,
    gridCorners,
    initMap,
    isPlayerPlaying,
    isRefreshActive: isResourceRefreshActive,
    makeGridState,
    mapPresentation,
    mapRenderer,
    missingValue,
    notifyDiagnostics,
    perfDebug,
    setCurrentPalette,
    setGridState,
    syncPlayButtonAvailability,
    variableControls,
    views: {
      forecastHourControlView: views.forecastHourControlView,
      forecastWarmupView: views.forecastWarmupView,
    },
  });
  const downloadRuntime = createForecastDownloadRuntime({
    animationService: renderRuntime.animationService,
    dataStatusSummaryView: views.dataStatusSummaryView,
    downloadFile: (...args) => {
      if (!runtime) {
        throw new Error("Forecast runtime is required");
      }

      return runtime.runtimePorts.downloadFileWithProgress(...args);
    },
    fetchImpl,
    forecastDownloadView: views.forecastDownloadView,
    forecastHourControlView: views.forecastHourControlView,
    getModelBlockService,
    getModelState,
    initializeLegendFromBlock: renderRuntime.initializeLegendFromBlock,
    isRefreshActive: isResourceRefreshActive,
    presentAvailableMapBlock: renderRuntime.presentAvailableMapBlock,
    scheduleLowPriorityWork,
    updateStorageWarningSizeIfOpen,
  });

  runtime = createForecastRuntimeUseCase({
    animationService: renderRuntime.animationService,
    beginResourceRefresh,
    buildAnimationCacheAfterNetworkSettles: renderRuntime.buildAnimationCacheAfterNetworkSettles,
    configureModelVariableControls: renderRuntime.configureModelVariableControls,
    createDownloadWorkerClient,
    createModelBlockServiceClient,
    createModelState,
    downloadInitialForecast: downloadRuntime.downloadInitialForecast,
    downloadWorkerProxyUrl: downloadRuntime.downloadWorkerProxyUrl,
    getSelectedHourIndex: views.forecastHourControlView.selectedIndex,
    getPackage: (packageKey) => PACKAGES[packageKey],
    isResourceRefreshActive,
    mapRenderer,
    refreshCurrentResourcesToLatest: downloadRuntime.refreshCurrentResourcesToLatest,
    refreshWindSymbolOverlay: renderRuntime.refreshWindSymbolOverlay,
    resetDownloadView: views.forecastDownloadView.clear,
    resetForecastHourControl: views.forecastHourControlView.reset,
    resetRuntimePresentation: () => {},
    selectVariable: renderRuntime.selectVariable,
    setGridState,
    setRendering,
    syncWindDirectionControl: renderRuntime.syncWindDirectionControl,
    waitForNextFrame,
  });

  return runtime.api;
}
