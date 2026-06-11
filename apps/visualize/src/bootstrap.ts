import {
  CENTRES,
  decodeGRIB2,
  fmtLevel,
  fmtRefTime,
  fmtValidTime,
  GENERATING_PROCESS,
  iterateGRIB2Messages,
  MISSING_VALUE,
} from "grib2-decoder";
import { createAnimationPlayer } from "../animation-player.js";
import { clearGribCache } from "./adapters/forecast/grib-cache-adapter";
import { createMapLibreMapRendererAdapter } from "./adapters/forecast/maplibre-map-renderer-adapter";
import { createForecastRunController } from "./controllers/forecast-run-controller.js";
import { createMapPresentationController } from "./controllers/map-presentation-controller.js";
import { createUploadInspectorController } from "./controllers/upload-inspector-controller.js";
import { createUploadedFieldController } from "./controllers/uploaded-field-controller";
import type { DecodedField, GridDefinition } from "./domain/field-types";
import { createRenderParams } from "./domain/forecast-field.js";
import { MODEL_INFO, PACKAGES } from "./domain/model-packages.js";
import { buildLUT, gradientStopsFor, LOG_SCALE_FLOOR, legendTicksFor } from "./domain/palettes.js";
import {
  displayUnitsFor,
  formatValueForUnits,
  unitFnFor,
  unitTransformFor,
} from "./domain/unit-transforms.js";
import {
  defaultPaletteFor,
  parameterDescriptionFor,
  staticScaleFor,
} from "./domain/variable-metadata.js";
import {
  gridCorners,
  mercatorCanvasHeight,
  renderProjectionForGrid,
} from "./domain/web-mercator.js";
import { bindAppEvents } from "./ui/app-events.js";
import { createAppRouter } from "./ui/app-router.js";
import { createDom } from "./ui/dom.js";
import {
  createForecastHomeHash,
  createForecastPackageHash,
  createInspectHomeHash,
  createInspectMessageHash,
  createInspectVariableHash,
} from "./ui/forecast-route.js";
import { bindHomeEvents } from "./ui/home-events.js";
import { prepareFileInputForPick, setHomeTab } from "./ui/home-tabs.js";
import { resolveMapBackHash } from "./ui/map-back-action.js";
import { setMapToolbarMode } from "./ui/map-toolbar-controller.js";
import { renderModelList } from "./ui/model-list-view.js";
import { createStorageWarningController, formatStorageEstimate } from "./ui/storage-warning.js";
import { bindUploadInspectorEvents } from "./ui/upload-inspector-events.js";
import { renderUploadedMessageCard } from "./ui/upload-inspector-view.js";
import type {
  ForecastBounds,
  ForecastMapEntry,
  MapCorner,
} from "./use-cases/forecast/map-contracts";
import type { ForecastRuntimeApi } from "./use-cases/forecast/runtime-contracts";
import type {
  UploadedFieldRenderParams,
  UploadedFieldRenderRequest,
} from "./use-cases/upload-inspector/ports";
import { createPresentUploadedFieldUseCase } from "./use-cases/upload-inspector/present-uploaded-field";
import type { RenderWorkerResult } from "./workers/render-types";
import { createRenderWorkerClient } from "./workers/render-worker-client.js";

const defaultDependencies = {
  bindAppEvents,
  bindHomeEvents,
  bindUploadInspectorEvents,
  clearGribCache,
  createAnimationPlayer,
  createAppRouter,
  createForecastRunController,
  createMapLibreMapRendererAdapter,
  createMapPresentationController,
  createPresentUploadedFieldUseCase,
  createRenderWorkerClient,
  createStorageWarningController,
  createUploadInspectorController,
  createUploadedFieldController,
  renderModelList,
};

export type BootstrapDependencies = typeof defaultDependencies;

export interface BrowserEnvironment {
  document: Document;
  localStorage: Storage;
  location: Location;
  navigator: Navigator;
  performance: Performance;
  window: Window;
}

interface BootstrapOptions {
  dependencies?: Partial<BootstrapDependencies>;
  environment?: BrowserEnvironment;
}

function defaultBrowserEnvironment(): BrowserEnvironment {
  return {
    document,
    localStorage,
    location,
    navigator,
    performance,
    window,
  };
}

const RASTER_OPACITY = 0.8;
export function bootstrap({
  dependencies: dependencyOverrides = {},
  environment = defaultBrowserEnvironment(),
}: BootstrapOptions = {}) {
  const dependencies = { ...defaultDependencies, ...dependencyOverrides };
  const {
    bindAppEvents,
    bindHomeEvents,
    bindUploadInspectorEvents,
    clearGribCache,
    createAnimationPlayer,
    createAppRouter,
    createForecastRunController,
    createMapLibreMapRendererAdapter,
    createMapPresentationController,
    createPresentUploadedFieldUseCase,
    createRenderWorkerClient,
    createStorageWarningController,
    createUploadInspectorController,
    createUploadedFieldController,
    renderModelList,
  } = dependencies;
  const { document, localStorage, location, navigator, performance, window } = environment;
  const domRefs = createDom(document);
  const dom = {
    viewsHome: domRefs.views.home,
    viewsMap: domRefs.views.map,
    forecastDownloadBars: domRefs.forecastDownload.bars,
    forecastDownloadFileList: domRefs.forecastDownload.fileList,
    forecastDownloadStatus: domRefs.forecastDownload.status,
    forecastHourLabel: domRefs.forecast.hourLabel,
    forecastSlider: domRefs.forecast.slider,
    forecastVarSelect: domRefs.forecast.variableSelect,
    forecastWindDirectionControl: domRefs.forecast.windDirectionControl,
    forecastWindDirectionToggle: domRefs.forecast.windDirectionToggle,
    playerPlayButton: domRefs.player.playButton,
    cacheWarmup: domRefs.cacheWarmup.root,
    cacheWarmupBar: domRefs.cacheWarmup.bar,
    cacheWarmupCount: domRefs.cacheWarmup.count,
    cacheWarmupLabel: domRefs.cacheWarmup.label,
    dataStatusPanel: domRefs.dataStatus.panel,
    dataStatusSummary: domRefs.dataStatus.summary,
    mapScene: domRefs.map.scene,
    mapCanvas: domRefs.map.canvas,
    mapTooltip: domRefs.map.tooltip,
    mapWrap: domRefs.map.wrap,
    mapBackButton: domRefs.map.backButton,
    paletteOptions: domRefs.palette.options,
    paletteSelect: domRefs.palette.uploadSelect,
    paletteSelectForecast: domRefs.palette.forecastSelect,
    uploadSummary: domRefs.upload.summary,
    uploadName: domRefs.upload.name,
    uploadSize: domRefs.upload.size,
    uploadCount: domRefs.upload.count,
    uploadCentre: domRefs.upload.centre,
    uploadReferenceTime: domRefs.upload.referenceTime,
    uploadResults: domRefs.upload.results,
    uploadCards: domRefs.upload.cards,
    uploadStatus: domRefs.upload.status,
    clearGribCacheButton: domRefs.storage.clearCacheButton,
    storageWarning: domRefs.storage.warning,
    storageWarningCloseButton: domRefs.storage.warningCloseButton,
    storageWarningButton: domRefs.storage.warningButton,
    storageWarningSize: domRefs.storage.warningSize,
    perfDebugPanel: domRefs.perfDebug.panel,
    perfDebugRender: domRefs.perfDebug.render,
    perfDebugDecode: domRefs.perfDebug.decode,
    perfDebugQueue: domRefs.perfDebug.queue,
    perfDebugCache: domRefs.perfDebug.cache,
    perfDebugDecoded: domRefs.perfDebug.decoded,
    perfDebugGeneration: domRefs.perfDebug.generation,
  };

  function setPaletteSelectValues(palette: string) {
    dom.paletteSelect.value = palette;
    dom.paletteSelectForecast.value = palette;
  }

  // Populate all palette selects from the shared template
  for (const sel of [dom.paletteSelect, dom.paletteSelectForecast]) {
    const paletteTemplate = dom.paletteOptions;
    sel.appendChild(paletteTemplate.content.cloneNode(true));
    sel.value = "Plasma";
  }

  // ── State ─────────────────────────────────────────────────────────────────────
  let gridState: { values?: Float32Array | null } | null = null;
  let currentPalette = "Plasma";
  const renderWorkerClient = createRenderWorkerClient();
  let forecastRun: ForecastRuntimeApi;
  let uploadedFieldController: ReturnType<typeof createUploadedFieldController>;
  const PERF_DEBUG = new URLSearchParams(window.location.search).get("debug") === "perf";
  const perfStats: {
    lastDecodeMs: number | null;
    lastRenderMs: number | null;
  } = {
    lastRenderMs: null,
    lastDecodeMs: null,
  };

  function setGridState(state: unknown) {
    gridState = state as { values?: Float32Array | null } | null;
  }

  const storageWarningController = createStorageWarningController({
    dom: domRefs.storage,
    storage: localStorage,
    updateStorageSize: updateStorageWarningSize,
  });
  const mapRenderer = createMapLibreMapRendererAdapter({
    canvasHeightForGrid: mercatorCanvasHeight,
    getGridState: () => gridState,
    getMapScene: () => dom.mapScene,
    missingValue: MISSING_VALUE,
    rasterOpacity: RASTER_OPACITY,
    tooltipEl: dom.mapTooltip,
    wrapEl: dom.mapWrap,
  });
  const uploadInspector = createUploadInspectorController({
    centres: CENTRES,
    dom: domRefs.upload,
    formatRefTime: fmtRefTime,
    formatSize: fmtSize,
    iterateMessages: iterateGRIB2Messages,
    readFileAsArrayBuffer: undefined,
    renderCard: buildCard,
  });
  const mapPresentation = createMapPresentationController({
    dom: domRefs,
    formatValueForUnits,
    getCurrentPalette: () => currentPalette,
    legendTicksFor,
  });
  const uploadedFieldPresenter = createPresentUploadedFieldUseCase({
    buildRenderParams: makeRenderParams,
    decoder: {
      decode: timedDecodeGRIB2,
    },
    getCurrentRenderGeneration: () => uploadedFieldController?.getRenderGeneration() ?? 0,
    render: {
      render: renderUploadedField,
    },
  });
  uploadedFieldController = createUploadedFieldController({
    applyPalette: (palette) => {
      currentPalette = palette;
      setPaletteSelectValues(palette);
    },
    defaultPaletteFor,
    displayUnitsFor,
    formatLevel: fmtLevel,
    formatValidTime: fmtValidTime,
    getCurrentPalette: () => currentPalette,
    gradientStopsFor,
    gridCorners: (grid) => gridCorners(grid) as MapCorner[],
    makeGridState,
    mapPresentation,
    mapRenderer,
    navigation: {
      redirectHome: () => {
        location.hash = "";
      },
      showMapView: () => {
        showView("view-map");
      },
    },
    parameterDescriptionFor,
    presenter: uploadedFieldPresenter,
    setGridState,
    source: uploadInspector,
  });
  forecastRun = createForecastRunController({
    document,
    window,
    dom,
    mapRenderer,
    mapPresentation,
    perfDebug: PERF_DEBUG,
    missingValue: MISSING_VALUE,
    makeGridState,
    gridCorners: (grid) => gridCorners(grid) as MapCorner[],
    initMap,
    getCurrentPalette: () => currentPalette,
    getGridState: () => gridState,
    setCurrentPalette: (palette) => {
      currentPalette = palette;
      setPaletteSelectValues(palette);
    },
    setGridState,
    setRendering,
    updateDiagnostics: updatePerfDiagnostics,
    updateStorageWarningSizeIfOpen,
  });
  // ── Helpers ───────────────────────────────────────────────────────────────────

  function fmtPerfMs(value: number | null | undefined) {
    return value == null ? "—" : `${Math.round(value)} ms`;
  }

  function updatePerfDiagnostics() {
    if (!PERF_DEBUG) {
      return;
    }

    const panel = dom.perfDebugPanel;

    if (!panel) {
      return;
    }

    const diagnostics = forecastRun?.getDiagnostics();
    const totalBitmaps = diagnostics?.totalBitmaps ?? 0;
    const readyBitmaps = diagnostics?.readyBitmaps ?? 0;
    const queueLength = diagnostics?.queueLength ?? 0;
    const isPrerendering = diagnostics?.isPrerendering ?? false;

    panel.hidden = false;
    dom.perfDebugRender.textContent = `render ${fmtPerfMs(diagnostics?.lastRenderMs ?? perfStats.lastRenderMs)}`;
    dom.perfDebugDecode.textContent = `decode ${fmtPerfMs(diagnostics?.lastDecodeMs ?? perfStats.lastDecodeMs)}`;
    dom.perfDebugQueue.textContent = `queue ${queueLength}${isPrerendering ? " + active" : ""}`;
    dom.perfDebugCache.textContent = `cache ${readyBitmaps} / ${totalBitmaps || readyBitmaps}`;
    dom.perfDebugDecoded.textContent = "decoded worker";
    dom.perfDebugGeneration.textContent = `generation ${diagnostics?.currentRenderGeneration ?? uploadedFieldController.getRenderGeneration()}`;
  }

  function setRendering(on: boolean) {
    dom.mapScene.classList.toggle("rendering", on);
    updatePerfDiagnostics();
  }

  async function timedDecodeGRIB2(buffer: Uint8Array): Promise<DecodedField> {
    const startedAt = PERF_DEBUG ? performance.now() : 0;
    const ownedBuffer = buffer.slice().buffer as ArrayBuffer;
    const decoded = (await decodeGRIB2(ownedBuffer)) as DecodedField;

    if (PERF_DEBUG) {
      perfStats.lastDecodeMs = performance.now() - startedAt;
      updatePerfDiagnostics();
    }
    return decoded;
  }

  async function renderUploadedField({
    renderGeneration,
    renderParams,
  }: UploadedFieldRenderRequest) {
    const startedAt = PERF_DEBUG ? performance.now() : 0;
    const { grid } = renderParams;
    const { outH, outW } = mapRenderer.ensureHeatCanvas(grid);
    const projection = renderProjectionForGrid(grid);
    const workerValues = renderParams.values.slice();
    const lut = buildLUT(currentPalette, {
      min: renderParams.renderMin,
      max: renderParams.renderMax,
    });

    const data = (await renderWorkerClient.render(
      {
        renderGeneration,
        values: workerValues,
        unitTransform: renderParams.unitTransform,
        lut,
        missingValue: MISSING_VALUE,
        renderMin: renderParams.renderMin,
        range: renderParams.range,
        isLog: renderParams.isLog,
        logFloor: LOG_SCALE_FLOOR,
        logDenom: renderParams.logDenom,
        zeroThreshold: renderParams.zeroThreshold,
        outW,
        outH,
        ni: grid.ni,
        nj: grid.nj,
        dj: grid.dj,
        ...projection,
      },
      [workerValues.buffer],
    )) as RenderWorkerResult | null;

    if (
      !data?.bitmap ||
      data.dataMin == null ||
      data.dataMax == null ||
      data.dataMean == null ||
      data.dataCount == null
    ) {
      return null;
    }

    if (PERF_DEBUG) {
      perfStats.lastRenderMs = performance.now() - startedAt;
      updatePerfDiagnostics();
    }

    return {
      bitmap: data.bitmap,
      dataMin: data.dataMin,
      dataMax: data.dataMax,
      mean: data.dataMean,
      count: data.dataCount,
    };
  }

  function makeGridState(
    renderParams: ForecastMapEntry | UploadedFieldRenderParams,
    values = renderParams.values,
  ) {
    return {
      ...renderParams,
      values,
      unitFn: unitFnFor(renderParams.unitTransform),
      min: renderParams.renderMin,
      range: renderParams.range,
    };
  }

  function fmtSize(bytes: number) {
    return bytes >= 1e6 ? `${(bytes / 1e6).toFixed(1)} MB` : `${(bytes / 1e3).toFixed(0)} KB`;
  }

  function fmtGrid(grid: GridDefinition) {
    return (
      `${grid.ni} × ${grid.nj} pts · ` +
      `${grid.latitudeOfLastPoint}°–${grid.latitudeOfFirstPoint}°N · ` +
      `${grid.longitudeOfFirstPoint}°–${grid.longitudeOfLastPoint}°E`
    );
  }

  function code(table: Record<number, string>, value: number) {
    return table[value] ? `${table[value]} (${value})` : String(value);
  }

  // ── Card builder ──────────────────────────────────────────────────────────────

  function buildCard(
    ownerDocument: Document,
    message: Parameters<typeof renderUploadedMessageCard>[1],
  ) {
    return renderUploadedMessageCard(ownerDocument, message, {
      code,
      formatGrid: fmtGrid,
      formatLevel: fmtLevel,
      formatValidTime: fmtValidTime,
      generatingProcess: GENERATING_PROCESS,
    });
  }

  function clearMapLayer() {
    mapRenderer.clearLayer();
    gridState = null;
    hideColorScale();
    hideMapUnavailable();
  }

  function clearStats() {
    mapPresentation.clearStats();
  }

  function hideColorScale() {
    mapPresentation.hideColorScale();
  }

  function hideMapUnavailable() {
    mapPresentation.hideUnavailable();
  }

  function makeRenderParams(
    data: DecodedField,
    {
      values = data.values,
      displayUnits = null,
      isFallback = false,
    }: {
      values?: DecodedField["values"];
      displayUnits?: string | null;
      isFallback?: boolean;
    } = {},
  ): UploadedFieldRenderParams {
    const { product } = data;
    const shortName = product.shortName;
    return createRenderParams({
      data,
      values,
      staticScale: staticScaleFor(shortName),
      unitTransform: unitTransformFor(shortName),
      displayUnits: displayUnits ?? displayUnitsFor(shortName, product.units),
      logFloor: LOG_SCALE_FLOOR,
      isFallback,
    });
  }
  // Create the MapLibre map once. fitBoundsArgs is optional [bounds, options].
  async function initMap(
    fitBoundsArgs?: [ForecastBounds, { animate?: boolean; padding?: number }?],
  ) {
    await mapRenderer.init(fitBoundsArgs);
  }

  function resetApp(targetHash = "") {
    uploadInspector.reset();
    forecastRun.resetModelState();
    clearMapLayer();
    dom.dataStatusPanel.hidden = true;
    location.hash = targetHash;
  }

  function closeInspectMapView(targetHash: string) {
    clearMapLayer();
    clearStats();
    setRendering(false);
    location.hash = targetHash;
  }

  function handleMapBack() {
    const targetHash = resolveMapBackHash({
      hasModelState: forecastRun.hasModelState(),
    });
    if (!forecastRun.hasModelState()) {
      closeInspectMapView(targetHash);
      return;
    }
    resetApp(targetHash);
  }

  // ── Router (hash-based) ───────────────────────────────────────────────────────

  function showView(name: string) {
    dom.viewsHome.hidden = name !== "view-home";
    dom.viewsMap.hidden = name !== "view-map";
    mountStorageWarning(name);
  }

  function mountStorageWarning(viewId: string) {
    const warning = dom.storageWarning;
    const main = document.querySelector(`#${viewId} main`);

    if (!warning || !main) {
      return;
    }

    if (warning.parentElement === main && warning === main.firstElementChild) {
      return;
    }

    main.prepend(warning);
  }

  function showTab(name: string) {
    setHomeTab(document, name);
  }

  function setToolbarMode(mode: string) {
    setMapToolbarMode(document, mode);
  }

  const router = createAppRouter({
    getHash: () => location.hash,
    replaceHash: (hash: string) => location.replace(hash),
    setHash: (hash: string) => {
      location.hash = hash;
    },
    addEventListener: (type: "hashchange", listener: () => void) =>
      window.addEventListener(type, listener),
    removeEventListener: (type: "hashchange", listener: () => void) =>
      window.removeEventListener(type, listener),
    isValidPackage: (packageKey: string) => Boolean(PACKAGES[packageKey]),
    getCurrentPackageKey: forecastRun.getPackageKey,
    showView,
    showTab,
    setToolbarMode,
    showMapView: uploadedFieldController.show,
    showDataStatusPanel: () => {
      dom.dataStatusPanel.hidden = false;
    },
    resetModelState: forecastRun.resetModelState,
    startDownload: forecastRun.startDownload,
  });

  renderModelList({
    container: domRefs.home.modelList,
    packages: PACKAGES,
    modelInfo: MODEL_INFO,
  });

  bindHomeEvents({
    dom: domRefs,
    handlers: {
      onHomeTabSelect: (tabName: string) => {
        location.hash = tabName === "upload" ? createInspectHomeHash() : createForecastHomeHash();
      },
      onPackageSelect: (key: string) => {
        location.hash = createForecastPackageHash(key);
      },
    },
  });

  const animationPlayer = createAnimationPlayer({
    playButton: domRefs.player.playButton,
    resetButton: domRefs.player.resetButton,
    slider: dom.forecastSlider,
    iconPlay: domRefs.player.iconPlay,
    iconPause: domRefs.player.iconPause,
    getModelState: forecastRun.getModelState,
    isBitmapCacheComplete: forecastRun.isBitmapCacheComplete,
    isAnimationCacheReadyForPlayback: forecastRun.isAnimationCacheReadyForPlayback,
    queueCurrentTooltipValueHydration: forecastRun.queueCurrentTooltipValueHydration,
    showHour: forecastRun.showHour,
  });
  forecastRun.setAnimationPlayer(animationPlayer);

  router.start();

  // ── Event wiring ──────────────────────────────────────────────────────────────

  bindUploadInspectorEvents({
    dom: domRefs,
    handlers: {
      onFilePickRequest: () => {
        prepareFileInputForPick(domRefs.upload.fileInput);
        domRefs.upload.fileInput.click();
      },
      onFileSelected: uploadInspector.processFile,
      onUploadedVariableOpen: ({
        messageIndex,
        variableShortName,
      }: {
        messageIndex: number | null;
        variableShortName: string;
      }) => {
        location.hash =
          messageIndex == null
            ? createInspectVariableHash(variableShortName)
            : createInspectMessageHash(messageIndex);
      },
    },
  });

  async function onPaletteChange(event: Event) {
    const palette = (event.target as HTMLSelectElement).value;

    if (forecastRun.hasModelState()) {
      currentPalette = palette;
      setPaletteSelectValues(currentPalette);
      await forecastRun.refreshCurrentModelVisuals();
    } else {
      await uploadedFieldController.handlePaletteChange(palette);
    }
  }

  async function onForecastVariableChange(event: Event) {
    await forecastRun.handleVariableChange((event.target as HTMLSelectElement).value);
  }

  function onForecastWindDirectionToggle(event: Event) {
    forecastRun.setWindDirectionVisible((event.target as HTMLInputElement).checked);
  }

  function onForecastSliderInput() {
    forecastRun.onForecastSliderInput();
  }

  async function updateStorageWarningSize() {
    try {
      const estimate = await navigator.storage?.estimate?.();
      dom.storageWarningSize.textContent = formatStorageEstimate(estimate);
    } catch {
      dom.storageWarningSize.textContent = formatStorageEstimate(null);
    }
  }

  function updateStorageWarningSizeIfOpen() {
    if (dom.storageWarningButton.getAttribute("aria-expanded") !== "true") {
      return;
    }

    void updateStorageWarningSize();
  }

  async function onClearCache() {
    await clearGribCache();
    dom.forecastDownloadStatus.textContent = "Download cache cleared.";
    await updateStorageWarningSize();
  }

  function onStorageWarningClose() {
    storageWarningController.close();
  }

  function onStorageWarningToggle() {
    storageWarningController.toggle();
  }

  function onDocumentKeydown(event: KeyboardEvent) {
    if (event.code !== "Space" || !forecastRun.hasModelState()) {
      return;
    }

    const target = event.target as HTMLElement | null;

    if (
      target?.tagName === "INPUT" ||
      target?.tagName === "SELECT" ||
      target?.tagName === "BUTTON"
    ) {
      return;
    }

    event.preventDefault();
    dom.playerPlayButton.click();
  }

  bindAppEvents({
    document,
    dom: domRefs,
    handlers: {
      handleMapBack,
      onPaletteChange,
      onForecastVariableChange,
      onForecastWindDirectionToggle,
      onForecastSliderInput,
      onClearCache,
      onStorageWarningClose,
      onStorageWarningToggle,
      onDocumentKeydown,
    },
  });

  storageWarningController.initialize();
  updatePerfDiagnostics();
}
