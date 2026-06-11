import {
  type CreateForecastRuntimeFactoryOptions,
  createForecastRuntimeFactory,
} from "../composition/forecast-runtime-factory.js";
import { formatRunSummary } from "../domain/resources.js";
import { createDataStatusSummaryView } from "../ui/data-status-summary.js";
import { createForecastDownloadView } from "../ui/forecast-download-view.js";
import { createForecastHourControlView } from "../ui/forecast-hour-control-view.js";
import {
  createForecastVariableControlsView,
  defaultVariableForPackage,
} from "../ui/forecast-variable-select.js";
import { createForecastWarmupView } from "../ui/forecast-warmup-view.js";
import type { ForecastRuntimeApi } from "../use-cases/forecast/runtime-contracts";

function fmtSize(bytes: number | null | undefined) {
  const size = bytes ?? 0;

  return size >= 1e6 ? `${(size / 1e6).toFixed(1)} MB` : `${(size / 1e3).toFixed(0)} KB`;
}

export interface ForecastRunDom {
  cacheWarmup: HTMLElement;
  cacheWarmupBar: HTMLElement;
  cacheWarmupCount: HTMLElement;
  cacheWarmupLabel: HTMLElement;
  dataStatusSummary: HTMLElement | null;
  forecastDownloadBars: HTMLElement;
  forecastDownloadFileList: HTMLElement;
  forecastDownloadStatus: HTMLElement;
  forecastHourLabel: HTMLElement | null;
  forecastSlider: HTMLInputElement;
  forecastVarSelect: HTMLSelectElement;
  forecastWindDirectionControl: HTMLElement | null;
  forecastWindDirectionToggle: HTMLInputElement | null;
}

export interface CreateForecastRunControllerOptions
  extends Omit<CreateForecastRuntimeFactoryOptions, "variableControls" | "views"> {
  document: Document;
  dom: ForecastRunDom;
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
}: CreateForecastRunControllerOptions): ForecastRuntimeApi {
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
      forecastWarmupView,
    },
    variableControls: {
      defaultVariableForPackage,
      renderVariableOptions: forecastVariableControlsView.renderVariableOptions,
      renderWindDirectionToggle: forecastVariableControlsView.renderWindDirectionToggle,
    },
  });
}
