// @vitest-environment jsdom

import { describe, expect, test, vi } from "vitest";
import { type BootstrapDependencies, bootstrap } from "./bootstrap";

function renderBootstrapDom() {
  document.body.innerHTML = `
    <section id="view-home"><main></main></section>
    <section id="view-map"><main></main></section>
    <div id="model-list"></div>
    <button class="tab-btn" data-tab="model"></button>
    <div id="forecast-dl-bars"></div>
    <div id="forecast-dl-file-list"></div>
    <div id="forecast-dl-status"></div>
    <input id="forecast-slider">
    <select id="forecast-var-select"></select>
    <div id="forecast-wind-direction-control"></div>
    <input id="forecast-wind-direction-toggle" type="checkbox">
    <div id="forecast-hour-label"></div>
    <div id="forecast-valid-time"></div>
    <button id="player-play"></button>
    <button id="player-reset"></button>
    <span id="icon-play"></span>
    <span id="icon-pause"></span>
    <div id="cache-warmup"></div>
    <div id="cache-warmup-bar"></div>
    <div id="cache-warmup-count"></div>
    <div id="cache-warmup-label"></div>
    <div id="perf-debug"></div>
    <div id="perf-debug-render"></div>
    <div id="perf-debug-decode"></div>
    <div id="perf-debug-queue"></div>
    <div id="perf-debug-cache"></div>
    <div id="perf-debug-decoded"></div>
    <div id="perf-debug-generation"></div>
    <div id="data-status-panel"></div>
    <div id="data-status-summary"></div>
    <div id="map-scene"></div>
    <div id="map-wrap"></div>
    <div id="map"></div>
    <div id="map-tooltip"></div>
    <div id="map-unavailable">Data not available yet</div>
    <button id="map-back-btn"></button>
    <div id="gv-sub"></div>
    <div id="gv-name"></div>
    <div id="gv-desc"></div>
    <div id="gv-level"></div>
    <div id="gv-min"></div>
    <div id="gv-max"></div>
    <div id="gv-mean"></div>
    <div id="gv-valid"></div>
    <div id="colorscale"></div>
    <div id="cs-bar"></div>
    <div id="cs-ticks"></div>
    <template id="palette-options"><option value="Plasma">Plasma</option></template>
    <select id="palette-select"></select>
    <select id="palette-select-forecast"></select>
    <div id="drop-zone"></div>
    <input id="file-input" type="file">
    <div id="file-summary"></div>
    <div id="s-name"></div>
    <div id="s-size"></div>
    <div id="s-count"></div>
    <div id="s-centre"></div>
    <div id="s-reftime"></div>
    <div id="results"></div>
    <div id="cards"></div>
    <div id="status"></div>
    <button id="clear-grib-cache"></button>
    <div id="storage-warning"></div>
    <button id="storage-warning-close"></button>
    <button id="storage-warning-button" aria-expanded="false"></button>
    <div id="storage-warning-size"></div>
  `;
}

function createDependencies() {
  const router = {
    route: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
  };
  const storageWarningController = {
    close: vi.fn(),
    initialize: vi.fn(),
    toggle: vi.fn(),
  };
  const forecastRun = {
    getDiagnostics: vi.fn(() => ({
      currentRenderGeneration: 0,
      isPrerendering: false,
      lastDecodeMs: null,
      lastRenderMs: null,
      queueLength: 0,
      readyBitmaps: 0,
      totalBitmaps: 0,
    })),
    getModelState: vi.fn(() => null),
    getPackageKey: vi.fn(() => null),
    handleVariableChange: vi.fn(),
    hasModelState: vi.fn(() => false),
    isAnimationCacheReadyForPlayback: vi.fn(() => false),
    isBitmapCacheComplete: vi.fn(() => false),
    onForecastSliderInput: vi.fn(),
    queueCurrentTooltipValueHydration: vi.fn(),
    refreshCurrentModelVisuals: vi.fn(),
    resetModelState: vi.fn(),
    setAnimationPlayer: vi.fn(),
    setWindDirectionVisible: vi.fn(),
    showHour: vi.fn(),
    startDownload: vi.fn(),
  };
  const uploadInspector = {
    getMessages: vi.fn(() => []),
    getSelectedMessage: vi.fn(() => null),
    hasFile: vi.fn(() => false),
    processFile: vi.fn(),
    reset: vi.fn(),
  };
  const uploadedFieldController = {
    getRenderGeneration: vi.fn(() => 0),
    handlePaletteChange: vi.fn(),
    show: vi.fn(),
  };
  const mapRenderer = {
    clearIsobars: vi.fn(),
    clearLayer: vi.fn(),
    clearWindSymbols: vi.fn(),
    drawBitmap: vi.fn(),
    ensureHeatCanvas: vi.fn(() => ({
      canvas: document.createElement("canvas"),
      canvasChanged: true,
      outH: 1,
      outW: 1,
    })),
    fitBounds: vi.fn(),
    getViewportBounds: vi.fn(() => null),
    getZoom: vi.fn(() => 0),
    hasLayer: vi.fn(() => false),
    init: vi.fn(async () => ({})),
    map: null,
    onViewportSettled: vi.fn(),
    setLayer: vi.fn(),
    setVisible: vi.fn(),
    triggerRepaint: vi.fn(),
    updateIsobars: vi.fn(),
    updateWindSymbols: vi.fn(),
  };
  const mapPresentation = {
    clearError: vi.fn(),
    clearStats: vi.fn(),
    hideColorScale: vi.fn(),
    hideUnavailable: vi.fn(),
    setColorScaleGradient: vi.fn(),
    setForecastValidTime: vi.fn(),
    showColorScale: vi.fn(),
    showError: vi.fn(),
    showUnavailable: vi.fn(),
    updateLevelInfo: vi.fn(),
    updateParamInfo: vi.fn(),
    updateStats: vi.fn(),
  };
  const dependencies = {
    bindAppEvents: vi.fn(() => vi.fn()),
    bindHomeEvents: vi.fn(() => vi.fn()),
    bindUploadInspectorEvents: vi.fn(() => vi.fn()),
    clearGribCache: vi.fn(),
    createAnimationPlayer: vi.fn(() => ({
      isPlaying: vi.fn(() => false),
      stopPlayer: vi.fn(),
      syncPlayButtonAvailability: vi.fn(),
    })),
    createAppRouter: vi.fn(() => router),
    createForecastRunController: vi.fn(() => forecastRun),
    createMapLibreMapRendererAdapter: vi.fn(() => mapRenderer),
    createMapPresentationController: vi.fn(() => mapPresentation),
    createPresentUploadedFieldUseCase: vi.fn(() => ({ present: vi.fn() })),
    createRenderWorkerClient: vi.fn(() => ({ render: vi.fn() })),
    createStorageWarningController: vi.fn(() => storageWarningController),
    createUploadInspectorController: vi.fn(() => uploadInspector),
    createUploadedFieldController: vi.fn(() => uploadedFieldController),
    renderModelList: vi.fn(),
  } satisfies Partial<BootstrapDependencies>;

  return {
    dependencies,
    forecastRun,
    router,
    storageWarningController,
  };
}

describe("visualize bootstrap", () => {
  test("wires controllers, starts the router, and initializes shell UI", () => {
    renderBootstrapDom();
    const { dependencies, forecastRun, router, storageWarningController } = createDependencies();

    bootstrap({
      dependencies,
      environment: {
        document,
        localStorage,
        location,
        navigator,
        performance,
        window,
      },
    });

    expect(dependencies.createUploadInspectorController).toHaveBeenCalledOnce();
    expect(dependencies.createForecastRunController).toHaveBeenCalledOnce();
    expect(dependencies.createUploadedFieldController).toHaveBeenCalledOnce();
    expect(dependencies.createAppRouter).toHaveBeenCalledOnce();
    expect(dependencies.renderModelList).toHaveBeenCalledOnce();
    expect(dependencies.bindHomeEvents).toHaveBeenCalledOnce();
    expect(dependencies.bindUploadInspectorEvents).toHaveBeenCalledOnce();
    expect(dependencies.bindAppEvents).toHaveBeenCalledOnce();
    expect(dependencies.createAnimationPlayer).toHaveBeenCalledOnce();
    expect(forecastRun.setAnimationPlayer).toHaveBeenCalledOnce();
    expect(router.start).toHaveBeenCalledOnce();
    expect(storageWarningController.initialize).toHaveBeenCalledOnce();
  });
});
