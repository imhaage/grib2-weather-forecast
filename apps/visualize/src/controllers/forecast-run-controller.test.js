// @vitest-environment jsdom
import { describe, expect, test, vi } from "vitest";
import { createForecastRunController } from "./forecast-run-controller.js";

function createElement(tagName = "div") {
  return document.createElement(tagName);
}

function createDom() {
  return {
    cacheWarmup: createElement(),
    cacheWarmupBar: createElement(),
    cacheWarmupCount: createElement(),
    cacheWarmupLabel: createElement(),
    dataStatusSummary: createElement(),
    forecastDownloadBars: createElement(),
    forecastDownloadFileList: createElement(),
    forecastDownloadStatus: createElement(),
    forecastHourLabel: createElement(),
    forecastSlider: Object.assign(createElement("input"), {
      max: "0",
      value: "0",
    }),
    forecastVarSelect: createElement("select"),
  };
}

function createController(overrides = {}) {
  const dom = createDom();
  const mapPresentation = {
    clearStats: vi.fn(),
    hideColorScale: vi.fn(),
    hideUnavailable: vi.fn(),
    setColorScaleGradient: vi.fn(),
    setForecastValidTime: vi.fn(),
    showColorScale: vi.fn(),
    showUnavailable: vi.fn(),
    updateLevelInfo: vi.fn(),
    updateParamInfo: vi.fn(),
    updateStats: vi.fn(),
  };
  const mapRenderer = {
    clearIsobars: vi.fn(),
    clearLayer: vi.fn(),
    drawBitmap: vi.fn(),
    ensureHeatCanvas: vi.fn(),
    fitBounds: vi.fn(),
    hasLayer: vi.fn(),
    setLayer: vi.fn(),
    setVisible: vi.fn(),
    triggerRepaint: vi.fn(),
    updateIsobars: vi.fn(),
  };
  const state = {
    currentPalette: "Plasma",
    gridState: null,
  };
  const controller = createForecastRunController({
    document,
    window,
    dom,
    mapRenderer,
    mapPresentation,
    missingValue: -9999,
    timedDecode: vi.fn(),
    makeRenderParams: vi.fn(),
    makeGridState: vi.fn(),
    gridCorners: vi.fn(),
    initMap: vi.fn(),
    fetchImpl: vi.fn(async () => ({
      ok: true,
      json: async () => ({ resources: [] }),
    })),
    getCurrentPalette: () => state.currentPalette,
    getGridState: () => state.gridState,
    setCurrentPalette: (palette) => {
      state.currentPalette = palette;
    },
    setGridState: (gridState) => {
      state.gridState = gridState;
    },
    setRendering: vi.fn(),
    updateDiagnostics: vi.fn(),
    updateStorageWarningSizeIfOpen: vi.fn(),
    ...overrides,
  });
  return { controller, dom, mapPresentation, mapRenderer, state };
}

describe("forecast run controller", () => {
  test("initializes package state and grouped variable controls", async () => {
    const { controller, dom, mapPresentation, mapRenderer, state } = createController();

    await controller.startDownload("AROME_SP2");

    expect(controller.getPackageKey()).toBe("AROME_SP2");
    expect(controller.getModelState().variable).toBe("cape");
    expect(state.currentPalette).toBe("CAPE");
    expect(mapRenderer.setVisible).toHaveBeenCalledWith(false);
    expect(mapPresentation.updateLevelInfo).toHaveBeenCalled();
    expect([...dom.forecastVarSelect.children].map((child) => child.label)).toEqual([
      "Weather maps",
      "Component fields",
    ]);
  });

  test("reset clears forecast state and download DOM", async () => {
    const { controller, dom, state } = createController();
    dom.forecastDownloadBars.append(createElement());
    dom.forecastDownloadFileList.append(createElement());

    await controller.startDownload("AROME_SP1");
    controller.resetModelState();

    expect(controller.getModelState()).toBeNull();
    expect(state.gridState).toBeNull();
    expect(dom.forecastDownloadBars.children).toHaveLength(0);
    expect(dom.forecastDownloadFileList.children).toHaveLength(0);
  });
});
