import {
  formatForecastValidTimeLabel as formatPackageForecastValidTimeLabel,
  formatModelPackageSubtitle as formatPackageModelSubtitle,
} from "../domain/forecast-package-labels.js";
import type { ForecastPackage, ForecastRunState } from "../domain/forecast-types";
import { MODEL_INFO, PACKAGES } from "../domain/model-packages.js";
import { defaultPaletteFor } from "../domain/variable-metadata.js";
import { createForecastAnimationCacheBuildUseCase } from "../use-cases/forecast/build-animation-cache";
import type { ForecastRefreshKey } from "../use-cases/forecast/contracts";
import { createForecastLegendInitializerUseCase } from "../use-cases/forecast/initialize-legend";
import {
  type CreateForecastAnimationUseCaseOptions,
  createForecastAnimationUseCase,
} from "../use-cases/forecast/manage-animation";
import type { ForecastMapEntry } from "../use-cases/forecast/map-contracts";
import {
  type CreateForecastMapPresentationUseCaseOptions,
  createForecastMapPresentationUseCase,
} from "../use-cases/forecast/present-map";
import type { ForecastModelBlockPort } from "../use-cases/forecast/runtime-contracts";
import { createForecastVariableSelectionUseCase } from "../use-cases/forecast/select-variable";
import type {
  ForecastHourControlView,
  ForecastVariableControls,
  ForecastWarmupView,
} from "./forecast-runtime-composition-contracts";

interface CreateForecastRenderRuntimeOptions {
  getCurrentPalette: CreateForecastMapPresentationUseCaseOptions["getCurrentPalette"];
  getGridState: CreateForecastAnimationUseCaseOptions["getGridState"];
  getModelBlockService: () => ForecastModelBlockPort;
  getModelState: () => ForecastRunState | null;
  gridCorners: CreateForecastMapPresentationUseCaseOptions["gridCorners"];
  initMap: CreateForecastMapPresentationUseCaseOptions["initMap"];
  isPlayerPlaying: () => boolean;
  isRefreshActive: (downloadKey: ForecastRefreshKey) => boolean;
  makeGridState: (entry: ForecastMapEntry, values?: Float32Array | null) => unknown;
  mapPresentation: CreateForecastMapPresentationUseCaseOptions["mapPresentation"];
  mapRenderer: CreateForecastMapPresentationUseCaseOptions["mapRenderer"];
  missingValue: number;
  notifyDiagnostics: () => void;
  perfDebug: boolean;
  setCurrentPalette: (palette: string) => void;
  setGridState: CreateForecastMapPresentationUseCaseOptions["setGridState"];
  syncPlayButtonAvailability: () => void;
  variableControls: ForecastVariableControls;
  views: {
    forecastHourControlView: ForecastHourControlView;
    forecastWarmupView: ForecastWarmupView;
  };
}

export function createForecastRenderRuntime({
  getCurrentPalette,
  getGridState,
  getModelBlockService,
  getModelState,
  gridCorners,
  initMap,
  isPlayerPlaying,
  isRefreshActive,
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
  views,
}: CreateForecastRenderRuntimeOptions) {
  const { forecastHourControlView, forecastWarmupView } = views;

  function requiredModelState() {
    const modelState = getModelState();

    if (!modelState) {
      throw new Error("Forecast model state is required");
    }

    return modelState;
  }

  function applyDefaultPalette(shortName: string) {
    const palette = defaultPaletteFor(shortName);

    if (!palette) {
      return;
    }

    setCurrentPalette(palette);
  }

  function formatModelPackageSubtitle(packageKey: string | null | undefined) {
    return formatPackageModelSubtitle(PACKAGES, MODEL_INFO, packageKey);
  }

  function formatForecastValidTimeLabel(timeLabel: string) {
    return formatPackageForecastValidTimeLabel(
      PACKAGES,
      MODEL_INFO,
      getModelState()?.packageKey ?? null,
      timeLabel,
    );
  }

  const mapPresenter = createForecastMapPresentationUseCase({
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
    presentAvailableBlock,
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

  function syncWindDirectionControl() {
    variableControls.renderWindDirectionToggle(
      forecastVariableSelectionUseCase.windDirectionControlState(getModelState()),
    );
  }

  function configureModelVariableControls(pkg: ForecastPackage) {
    const firstVariable = variableControls.defaultVariableForPackage(pkg);

    if (!firstVariable) {
      throw new Error(`Forecast package ${pkg.label} has no variables`);
    }

    const selectedVariable = forecastVariableSelectionUseCase.selectInitialVariable(
      requiredModelState(),
      firstVariable,
    );
    variableControls.renderVariableOptions({
      variables: pkg.variables,
      selectedVariable,
    });
    syncWindDirectionControl();
  }

  function selectVariable(variableKey: string) {
    const modelState = getModelState();

    if (!modelState) {
      return;
    }

    forecastVariableSelectionUseCase.selectVariable(modelState, variableKey);
  }

  const animationService = createForecastAnimationUseCase({
    getCurrentPalette,
    getGridState,
    getSelectedHourIndex: forecastHourControlView.selectedIndex,
    getModelBlockService,
    getModelState,
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
  const animationCacheBuildUseCase = createForecastAnimationCacheBuildUseCase({
    getModelState: requiredModelState,
    isBitmapCacheComplete: animationService.isBitmapCacheComplete,
    isRefreshActive,
    queuePrerenderForAllBlocks: animationService.queuePrerenderForAllBlocks,
    updateWarmupProgress: animationService.updateWarmupProgress,
    waitForPrerenderIdle: animationService.waitForPrerenderIdle,
  });

  return {
    animationService,
    buildAnimationCacheAfterNetworkSettles: animationCacheBuildUseCase.buildAfterNetworkSettles,
    configureModelVariableControls,
    initializeLegendFromBlock: forecastLegendInitializerUseCase.initializeFromBlock,
    presentAvailableMapBlock: presentAvailableBlock,
    refreshWindSymbolOverlay,
    selectVariable,
    syncWindDirectionControl,
  };
}
