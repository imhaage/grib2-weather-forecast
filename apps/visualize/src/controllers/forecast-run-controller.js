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
