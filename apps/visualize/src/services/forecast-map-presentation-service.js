import { fmtRefTime, fmtValidTime } from "grib2-decoder";
import { blockForHour } from "../domain/forecast-state.js";
import { generateIsobars, supportsIsobars } from "../domain/isobars.js";
import { findPackageVariable } from "../domain/model-packages.js";
import { gradientStopsFor } from "../domain/palettes.js";
import { parameterDescriptionFor } from "../domain/variable-metadata.js";
import { isVectorCompositeVariable } from "../domain/wind-composite-variable.js";
import { buildWindSymbolFeatures } from "../domain/wind-symbol-sampler.js";

function defaultFormatModelPackageSubtitle(packageKey) {
  return packageKey;
}

function defaultFormatForecastValidTimeLabel(timeLabel) {
  return timeLabel;
}

const WIND_SYMBOL_SAMPLING = Object.freeze({
  referenceZoom: 6,
  matrixStride: 16,
});

export function createForecastMapPresentationService({
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
}) {
  let viewportRefreshRegistered = false;
  let lastPresentedEntry = null;
  let lastPresentedValues = null;

  function mapBoundsForSymbols() {
    if (getMapBounds) return getMapBounds();
    return mapRenderer.getViewportBounds?.() ?? null;
  }

  function mapZoomForSymbols() {
    return getMapZoom ? getMapZoom() : (mapRenderer.getZoom?.() ?? 0);
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

  function selectedVariableDefinition(product) {
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

  function fmtUnavailableValidTime(hour) {
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

  function showUnavailableHour(hour) {
    clearMapLayer();
    clearStats();
    mapPresentation.setForecastValidTime(
      formatForecastValidTimeLabel(fmtUnavailableValidTime(hour)),
    );
    showMapUnavailable();
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

  function updateWindSymbolOverlay(entry, values) {
    const modelState = getModelState();
    if (
      !isVectorCompositeVariable(modelState?.variable) ||
      modelState?.showWindDirection === false ||
      !values ||
      !entry.vectorUValues ||
      !entry.vectorVValues ||
      !mapRenderer.updateWindSymbols
    ) {
      mapRenderer.clearWindSymbols?.();
      return;
    }

    const bounds = mapBoundsForSymbols();
    if (!bounds) {
      mapRenderer.clearWindSymbols?.();
      return;
    }

    const zoom = mapZoomForSymbols();
    mapRenderer.updateWindSymbols(
      buildWindSymbolFeatures({
        grid: entry.grid,
        vectorUValues: entry.vectorUValues,
        vectorVValues: entry.vectorVValues,
        missingValue,
        bounds,
        zoom,
        sampling: WIND_SYMBOL_SAMPLING,
      }),
    );
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

  async function presentBitmapEntry(hour, entry, { values } = {}) {
    const modelState = getModelState();
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
    block,
    session,
    { isRefreshActive, selectedHourIndex, showHour },
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
