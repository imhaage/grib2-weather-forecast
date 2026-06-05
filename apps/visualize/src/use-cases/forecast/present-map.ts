import { fmtRefTime, fmtValidTime } from "grib2-decoder";
import { blockForHour } from "../../domain/forecast-state.js";
import { findPackageVariable } from "../../domain/model-packages.js";
import { gradientStopsFor } from "../../domain/palettes.js";
import { parameterDescriptionFor } from "../../domain/variable-metadata.js";
import { createForecastIsobarOverlayUseCase } from "./update-isobar-overlay";
import { createForecastWindSymbolOverlayUseCase } from "./update-wind-symbol-overlay";

function defaultFormatModelPackageSubtitle(packageKey: string) {
  return packageKey;
}

function defaultFormatForecastValidTimeLabel(timeLabel: string) {
  return timeLabel;
}

type MapCorner = [number, number];

interface ForecastProduct {
  forecastTime?: number;
  name?: string;
  pdtNumber?: number;
  shortName: string;
  timeUnit?: number;
  [key: string]: unknown;
}

interface ForecastEntry {
  bitmap: unknown;
  count?: number;
  dataMax: number;
  dataMin: number;
  displayUnits?: string | null;
  grid: unknown;
  header: unknown;
  isLog?: boolean;
  isobars?: Record<string, unknown> | null;
  mean?: number;
  product: ForecastProduct;
  range: number;
  renderMin: number;
  staticScale?: boolean;
  values?: Float32Array | null;
  vectorUValues?: Float32Array | null;
  vectorVValues?: Float32Array | null;
}

interface ForecastBlock {
  key: string;
  startHour?: number;
  endHour?: number;
  runId?: string | null;
  [key: string]: unknown;
}

interface ForecastModelState {
  hourList?: number[];
  lastRunInfo?: string;
  packageKey: string;
  resources?: ForecastBlock[];
  showWindDirection?: boolean;
  variable?: string | null;
}

interface ForecastSession {
  availableCount: number;
  downloadKey: unknown;
  pkg: {
    bounds: unknown;
  };
}

interface MapPresentationPort {
  clearStats: () => void;
  hideColorScale: () => void;
  hideUnavailable: () => void;
  setColorScaleGradient: (stops: Array<{ color: string; position: number }>) => void;
  setForecastValidTime: (label: string) => void;
  showColorScale: (
    min: number,
    max: number,
    units: string | null | undefined,
    options: { isLog?: boolean },
  ) => void;
  showUnavailable: () => void;
  updateLevelInfo: (varDef: unknown) => void;
  updateParamInfo: (name: string | undefined, description: string | null, subtitle: string) => void;
  updateStats: (
    min: number,
    max: number,
    mean: number | undefined,
    count: number | undefined,
    units: string | null | undefined,
  ) => void;
}

interface MapRendererPort {
  clearIsobars: () => void;
  clearLayer: () => void;
  clearWindSymbols?: () => void;
  drawBitmap: (bitmap: unknown) => void;
  ensureHeatCanvas: (grid: unknown) => { canvas: unknown; canvasChanged: boolean };
  fitBounds: (bounds: unknown, options?: unknown) => void;
  getViewportBounds?: () => { east: number; north: number; south: number; west: number } | null;
  getZoom?: () => number;
  hasLayer: () => boolean;
  onViewportSettled?: (callback: () => void) => void;
  setLayer: (canvas: unknown, corners: MapCorner[]) => void;
  setVisible: (visible: boolean) => void;
  triggerRepaint: () => void;
  updateIsobars: (geojson: Record<string, unknown> | null | undefined) => void;
  updateWindSymbols?: (geojson: unknown) => void;
}

export interface CreateForecastMapPresentationUseCaseOptions {
  formatForecastValidTimeLabel?: (label: string) => string;
  formatModelPackageSubtitle?: (packageKey: string) => string;
  formatRefTime?: (header: unknown) => string;
  formatValidTime?: (header: unknown, product: ForecastProduct) => string;
  getCurrentPalette: () => string;
  getMapBounds?: () => { east: number; north: number; south: number; west: number } | null;
  getMapZoom?: () => number;
  getModelState: () => ForecastModelState | null;
  gridCorners: (grid: unknown) => MapCorner[];
  initMap: () => Promise<unknown>;
  makeGridState: (entry: ForecastEntry, values: Float32Array | null) => unknown;
  mapPresentation: MapPresentationPort;
  mapRenderer: MapRendererPort;
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
  let lastPresentedEntry: ForecastEntry | null = null;
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
    if (!modelState) throw new Error("Forecast model state is required");
    return modelState;
  }

  function mapBoundsForSymbols() {
    if (getMapBounds) return getMapBounds();
    return mapRenderer.getViewportBounds?.() ?? null;
  }

  function mapZoomForSymbols() {
    return getMapZoom ? getMapZoom() : (mapRenderer.getZoom?.() ?? 0);
  }

  function updateParamInfo(name: string | undefined, description: string | null, subtitle: string) {
    mapPresentation.updateParamInfo(name, description, subtitle);
  }

  function updateLevelInfo(varDef: unknown) {
    mapPresentation.updateLevelInfo(varDef);
  }

  function updateStatsAndColorScale(entry: ForecastEntry) {
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

  function selectedVariableDefinition(product: ForecastProduct) {
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

  function updateIsobarOverlay(entry: ForecastEntry, values: Float32Array | null | undefined) {
    isobarOverlayService.update(entry, values);
  }

  function updateWindSymbolOverlay(entry: ForecastEntry, values: Float32Array | null | undefined) {
    windSymbolOverlayService.update(entry, values);
  }

  function refreshWindSymbolOverlayForViewport() {
    if (!lastPresentedEntry) return;
    updateWindSymbolOverlay(lastPresentedEntry, lastPresentedValues);
  }

  function ensureViewportRefreshRegistered() {
    if (viewportRefreshRegistered) return;
    const register = onMapViewportSettled ?? mapRenderer.onViewportSettled;
    if (!register) return;
    register(refreshWindSymbolOverlayForViewport);
    viewportRefreshRegistered = true;
  }

  async function presentBitmapEntry(
    hour: number,
    entry: ForecastEntry,
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
    block: ForecastBlock,
    session: ForecastSession,
    {
      isRefreshActive,
      selectedHourIndex,
      showHour,
    }: {
      isRefreshActive: (downloadKey: unknown) => boolean;
      selectedHourIndex: () => number;
      showHour: (index: number) => Promise<unknown>;
    },
  ) {
    const currentIndex = selectedHourIndex();
    const currentHour = getModelState()?.hourList?.[currentIndex];
    if (session.availableCount === 1) {
      mapRenderer.setVisible(true);
      await initMap();
      if (!isRefreshActive(session.downloadKey)) return false;
      mapRenderer.fitBounds(session.pkg.bounds, { padding: 20, animate: false });
      await showHour(currentIndex);
      return true;
    }

    const currentBlock = blockForHour(getModelState()?.resources ?? [], currentHour);
    if (currentBlock?.key !== block.key) return false;
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
