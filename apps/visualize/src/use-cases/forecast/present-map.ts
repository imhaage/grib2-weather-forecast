import { fmtRefTime, fmtValidTime } from "grib2-decoder";
import type { MessageHeader, ProductDefinition } from "../../domain/field-types";
import { blockForHour } from "../../domain/forecast-state.js";
import type {
  ForecastRunState,
  ForecastVariable,
  RemoteResource,
} from "../../domain/forecast-types";
import { findPackageVariable } from "../../domain/model-packages.js";
import { gradientStopsFor } from "../../domain/palettes.js";
import { parameterDescriptionFor } from "../../domain/variable-metadata.js";
import type { ForecastDownloadSession, ForecastRefreshKey } from "./contracts";
import type {
  ForecastMapEntry,
  ForecastMapPresentationPort,
  ForecastMapRendererPort,
  MapCorner,
  ViewportBounds,
} from "./map-contracts";
import { createForecastIsobarOverlayUseCase } from "./update-isobar-overlay";
import { createForecastWindSymbolOverlayUseCase } from "./update-wind-symbol-overlay";

function defaultFormatModelPackageSubtitle(packageKey: string) {
  return packageKey;
}

function defaultFormatForecastValidTimeLabel(timeLabel: string) {
  return timeLabel;
}

export interface CreateForecastMapPresentationUseCaseOptions {
  formatForecastValidTimeLabel?: (label: string) => string;
  formatModelPackageSubtitle?: (packageKey: string) => string;
  formatRefTime?: (header: MessageHeader) => string;
  formatValidTime?: (header: MessageHeader, product: ProductDefinition) => string;
  getCurrentPalette: () => string;
  getMapBounds?: () => ViewportBounds | null;
  getMapZoom?: () => number;
  getModelState: () => ForecastRunState | null;
  gridCorners: (grid: ForecastMapEntry["grid"]) => MapCorner[];
  initMap: () => Promise<unknown>;
  makeGridState: (entry: ForecastMapEntry, values: Float32Array | null) => unknown;
  mapPresentation: ForecastMapPresentationPort;
  mapRenderer: ForecastMapRendererPort;
  missingValue: number;
  onMapViewportSettled?: (callback: () => void) => void;
  setGridState: (gridState: unknown) => void;
}

export function createForecastMapPresentationUseCase({
  formatForecastValidTimeLabel = defaultFormatForecastValidTimeLabel,
  formatModelPackageSubtitle = defaultFormatModelPackageSubtitle,
  formatRefTime = fmtRefTime,
  formatValidTime = fmtValidTime,
  getCurrentPalette,
  getMapBounds,
  getMapZoom,
  getModelState,
  gridCorners,
  initMap,
  makeGridState,
  mapPresentation,
  mapRenderer,
  missingValue,
  onMapViewportSettled,
  setGridState,
}: CreateForecastMapPresentationUseCaseOptions) {
  let viewportRefreshRegistered = false;
  let lastPresentedEntry: ForecastMapEntry | null = null;
  let lastPresentedValues: Float32Array | null | undefined = null;
  const isobarOverlayService = createForecastIsobarOverlayUseCase({
    missingValue,
    renderer: mapRenderer,
  });
  const windSymbolOverlayService = createForecastWindSymbolOverlayUseCase({
    getBounds: mapBoundsForSymbols,
    getModelState,
    getZoom: mapZoomForSymbols,
    missingValue,
    renderer: mapRenderer,
  });

  function modelStateOrThrow() {
    const modelState = getModelState();

    if (!modelState) {
      throw new Error("Forecast model state is required");
    }

    return modelState;
  }

  function mapBoundsForSymbols() {
    if (getMapBounds) {
      return getMapBounds();
    }

    return mapRenderer.getViewportBounds?.() ?? null;
  }

  function mapZoomForSymbols() {
    return getMapZoom ? getMapZoom() : (mapRenderer.getZoom?.() ?? 0);
  }

  function updateParamInfo(name: string | undefined, description: string | null, subtitle: string) {
    mapPresentation.updateParamInfo(name, description, subtitle);
  }

  function updateLevelInfo(varDef: ForecastVariable | ProductDefinition | undefined) {
    mapPresentation.updateLevelInfo(varDef);
  }

  function updateStatsAndColorScale(entry: ForecastMapEntry) {
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

  function selectedVariableDefinition(product: ProductDefinition) {
    const modelState = getModelState();

    return findPackageVariable(modelState?.packageKey, modelState?.variable) ?? product;
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

  function fmtUnavailableValidTime(hour: number) {
    const modelState = getModelState();
    const block = blockForHour(modelState?.resources ?? [], hour);
    const runId = block?.runId;
    const runTime = runId ? Date.parse(runId) : NaN;

    if (!Number.isNaN(runTime)) {
      const valid = new Date(runTime + hour * 60 * 60 * 1000);

      return `${valid.toISOString().slice(0, 16).replace("T", " ")} UTC`;
    }

    return `+${String(hour).padStart(2, "0")}H`;
  }

  function showUnavailableHour(hour: number) {
    clearMapLayer();
    clearStats();
    mapPresentation.setForecastValidTime(
      formatForecastValidTimeLabel(fmtUnavailableValidTime(hour)),
    );
    showMapUnavailable();
  }

  function updateIsobarOverlay(entry: ForecastMapEntry, values: Float32Array | null | undefined) {
    isobarOverlayService.update(entry, values);
  }

  function updateWindSymbolOverlay(
    entry: ForecastMapEntry,
    values: Float32Array | null | undefined,
  ) {
    windSymbolOverlayService.update(entry, values);
  }

  function refreshWindSymbolOverlayForViewport() {
    if (!lastPresentedEntry) {
      return;
    }

    updateWindSymbolOverlay(lastPresentedEntry, lastPresentedValues);
  }

  function ensureViewportRefreshRegistered() {
    if (viewportRefreshRegistered) {
      return;
    }

    const register = onMapViewportSettled ?? mapRenderer.onViewportSettled;

    if (!register) {
      return;
    }

    register(refreshWindSymbolOverlayForViewport);
    viewportRefreshRegistered = true;
  }

  async function presentBitmapEntry(
    hour: number,
    entry: ForecastMapEntry,
    { values }: { values?: Float32Array | null } = {},
  ) {
    const modelState = modelStateOrThrow();
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
    const paletteStops = gradientStopsFor(getCurrentPalette(), scaleRange) as Array<{
      color: string;
      position: number;
    }>;
    const stops = paletteStops.map((stop) => ({
      color: stop.color,
      position: stop.position,
    }));
    mapPresentation.setColorScaleGradient(stops);

    await initMap();
    ensureViewportRefreshRegistered();
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
    lastPresentedEntry = entry;
    lastPresentedValues = values ?? entry.values ?? null;
    updateWindSymbolOverlay(entry, lastPresentedValues);

    modelState.lastRunInfo = `${modelState.packageKey} · run ${formatRefTime(header)}`;
    const selectedVarDef = selectedVariableDefinition(product);
    updateParamInfo(
      selectedVarDef.name ?? product.name,
      parameterDescriptionFor(selectedVarDef.shortName ?? product.shortName),
      formatModelPackageSubtitle(modelState.packageKey),
    );

    updateStatsAndColorScale(entry);

    const validTimeProduct =
      product.pdtNumber === 8 ? { ...product, forecastTime: hour, timeUnit: 1 } : product;
    mapPresentation.setForecastValidTime(
      formatForecastValidTimeLabel(formatValidTime(header, validTimeProduct)),
    );
  }

  async function presentAvailableBlock(
    block: RemoteResource,
    session: ForecastDownloadSession,
    {
      isRefreshActive,
      selectedHourIndex,
      showHour,
    }: {
      isRefreshActive: (downloadKey: ForecastRefreshKey) => boolean;
      selectedHourIndex: () => number;
      showHour: (index: number) => Promise<unknown>;
    },
  ) {
    const currentIndex = selectedHourIndex();
    const currentHour = getModelState()?.hourList?.[currentIndex];

    if (session.availableCount === 1) {
      mapRenderer.setVisible(true);
      await initMap();

      if (!isRefreshActive(session.downloadKey)) {
        return false;
      }

      mapRenderer.fitBounds(session.pkg.bounds, { padding: 20, animate: false });
      await showHour(currentIndex);

      return true;
    }

    const currentBlock = blockForHour(getModelState()?.resources ?? [], currentHour);

    if (currentBlock?.key !== block.key) {
      return false;
    }

    await showHour(currentIndex);

    return true;
  }

  return {
    clearMapLayer,
    clearStats,
    hideColorScale,
    hideMapUnavailable,
    presentAvailableBlock,
    presentBitmapEntry,
    refreshWindSymbolOverlay: refreshWindSymbolOverlayForViewport,
    showMapUnavailable,
    showUnavailableHour,
    updateIsobarOverlay,
    updateLevelInfo,
    updateParamInfo,
    updateStatsAndColorScale,
  };
}
