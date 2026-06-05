// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import {
  readCachedGribBlock,
  readLatestCachedGribBlock,
  writeCachedGribBlock,
} from "../services/grib-cache-service.js";
import { createForecastRunController } from "./forecast-run-controller.js";

vi.mock("grib2-decoder", async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...actual,
    fmtRefTime: () => "2026-05-04 06:00 UTC",
    fmtValidTime: () => "2026-05-04 07:00 UTC",
    iterateGRIB2Messages: () => [
      {
        header: {},
        product: {
          shortName: "cape",
          name: "CAPE (near-surface)",
          units: "J kg-1",
          pdtNumber: 0,
        },
      },
    ],
  };
});

vi.mock("../services/grib-cache-service.js", () => ({
  deleteObsoleteCachedGribBlocks: vi.fn(async () => true),
  readCachedGribBlock: vi.fn(async () => null),
  readLatestCachedGribBlock: vi.fn(async () => null),
  writeCachedGribBlock: vi.fn(async () => true),
}));

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
    forecastWindDirectionControl: createElement("label"),
    forecastWindDirectionToggle: Object.assign(createElement("input"), {
      type: "checkbox",
    }),
  };
}

function createFakeBitmap() {
  return { close: vi.fn() };
}

function createFakeRenderResult(overrides = {}) {
  return {
    bitmap: createFakeBitmap(),
    dataMin: 1,
    dataMax: 4,
    dataMean: 2.5,
    dataCount: 4,
    unitTransform: null,
    renderMin: 0,
    range: 10,
    staticScale: { min: 0, max: 10 },
    isLog: false,
    displayUnits: "J kg-1",
    isFallback: false,
    isobars: null,
    grid: {
      ni: 2,
      nj: 2,
      dj: 1,
      latitudeOfFirstPoint: 2,
      longitudeOfFirstPoint: 0,
      latitudeOfLastPoint: 1,
      longitudeOfLastPoint: 1,
    },
    product: {
      shortName: "cape",
      name: "CAPE (near-surface)",
      units: "J kg-1",
      pdtNumber: 0,
    },
    header: {},
    values: new Float32Array([1, 2, 3, 4]),
    ...overrides,
  };
}

function createDownloadWorkerClient(events = []) {
  return {
    async post({ url }, _transfer = [], options = {}) {
      const blockKey = url.match(/__(\d+)H__/)?.[1] ?? "unknown";
      events.push(`download:${blockKey}H`);
      options.onProgress?.({ loaded: 1, total: 2 });
      return {
        buffer: new Uint8Array([Number(blockKey)]).buffer,
      };
    },
  };
}

function createResources(hours) {
  return hours.map((hour) => ({
    format: "grib2",
    filesize: hour,
    title: `arome__001__SP2__${String(hour).padStart(2, "0")}H__2026-05-04T06_00_00Z.grib2`,
    url: `https://example.test/arome__001__SP2__${String(hour).padStart(2, "0")}H__2026-05-04T06_00_00Z.grib2`,
  }));
}

function createController(overrides = {}) {
  const dom = createDom();
  const events = overrides.events ?? [];
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
  const heatCanvas = createElement("canvas");
  const mapRenderer = {
    clearIsobars: vi.fn(),
    clearLayer: vi.fn(),
    drawBitmap: vi.fn(),
    ensureHeatCanvas: vi.fn(() => ({
      canvas: heatCanvas,
      canvasChanged: true,
      outH: 2,
      outW: 2,
    })),
    fitBounds: vi.fn(),
    hasLayer: vi.fn(() => false),
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
    makeGridState: vi.fn((entry, values = entry.values) => ({
      ...entry,
      values,
    })),
    gridCorners: vi.fn(() => [
      [0, 2],
      [1, 2],
      [1, 1],
      [0, 1],
    ]),
    initMap: vi.fn(),
    createDownloadWorkerClient: vi.fn(() => createDownloadWorkerClient(events)),
    createModelBlockServiceClient: vi.fn(() => ({
      decodeValues: vi.fn(async () => ({
        values: new Float32Array([1, 2, 3, 4]),
      })),
      renderHour: vi.fn(async (request) => {
        events.push(`render:${String(request.hour).padStart(2, "0")}H`);
        if (overrides.missingRenderHours?.includes(request.hour)) return null;
        return createFakeRenderResult();
      }),
      storeBlock: vi.fn(async (block, buffer) => {
        const source = buffer[0] >= 100 ? "cache" : "network";
        events.push(`store:${block.key}:${source}:${buffer[0]}`);
        return true;
      }),
    })),
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
    ...Object.fromEntries(
      Object.entries(overrides).filter(([key]) => !["events", "missingRenderHours"].includes(key)),
    ),
  });
  return { controller, dom, mapPresentation, mapRenderer, state };
}

async function createControllerWithMockedFactory(api = { startDownload: vi.fn() }) {
  vi.resetModules();
  const createForecastRuntimeFactory = vi.fn(() => api);
  vi.doMock("../services/forecast-runtime-factory.js", () => ({
    createForecastRuntimeFactory,
  }));
  const { createForecastRunController: createControllerWithFactory } = await import(
    "./forecast-run-controller.js"
  );
  const dom = createDom();
  const mapPresentation = {
    showColorScale: vi.fn(),
  };
  const controller = createControllerWithFactory({
    document,
    window,
    dom,
    mapRenderer: { setVisible: vi.fn() },
    mapPresentation,
    missingValue: -9999,
    makeGridState: vi.fn(),
    gridCorners: vi.fn(),
    initMap: vi.fn(),
    getCurrentPalette: vi.fn(),
    getGridState: vi.fn(),
    setCurrentPalette: vi.fn(),
    setGridState: vi.fn(),
    setRendering: vi.fn(),
  });
  vi.doUnmock("../services/forecast-runtime-factory.js");
  return { controller, createForecastRuntimeFactory };
}

describe("forecast run controller", () => {
  beforeEach(() => {
    vi.mocked(readCachedGribBlock).mockResolvedValue(null);
    vi.mocked(readLatestCachedGribBlock).mockResolvedValue(null);
    vi.mocked(writeCachedGribBlock).mockResolvedValue(true);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  test("delegates runtime wiring to the forecast runtime factory", async () => {
    const runtimeApi = {
      startDownload: vi.fn(),
    };
    const { controller, createForecastRuntimeFactory } =
      await createControllerWithMockedFactory(runtimeApi);

    expect(createForecastRuntimeFactory).toHaveBeenCalledOnce();
    expect(controller).toBe(runtimeApi);
  });

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

  test("shows wind direction control for vector packages and syncs the toggle state", async () => {
    const { controller, dom } = createController();

    await controller.startDownload("AROME_SP1");
    await controller.handleVariableChange("wind");

    expect(controller.getModelState().variable).toBe("wind");
    expect(dom.forecastWindDirectionControl.hidden).toBe(false);
    expect(dom.forecastWindDirectionToggle.checked).toBe(true);

    controller.setWindDirectionVisible(false);

    expect(controller.getModelState().showWindDirection).toBe(false);
    expect(dom.forecastWindDirectionToggle.checked).toBe(false);
  });

  test("reset clears forecast state and download DOM", async () => {
    const { controller, dom, state } = createController();
    const player = {
      isPlaying: vi.fn(() => false),
      stopPlayer: vi.fn(),
      syncPlayButtonAvailability: vi.fn(),
    };
    controller.setAnimationPlayer(player);
    dom.forecastDownloadBars.append(createElement());
    dom.forecastDownloadFileList.append(createElement());

    await controller.startDownload("AROME_SP1");
    controller.resetModelState();

    expect(controller.getModelState()).toBeNull();
    expect(player.stopPlayer).toHaveBeenCalled();
    expect(state.gridState).toBeNull();
    expect(dom.forecastDownloadBars.children).toHaveLength(0);
    expect(dom.forecastDownloadFileList.children).toHaveLength(0);
  });

  test("shows cache and network status while loading a forecast run", async () => {
    const events = [];
    vi.mocked(readCachedGribBlock).mockImplementation(async (_packageKey, block) =>
      block.key === "01H" ? new Uint8Array([101]) : null,
    );
    vi.mocked(readLatestCachedGribBlock).mockImplementation(async (_packageKey, block) =>
      block.key === "03H" ? { buffer: new Uint8Array([103]) } : null,
    );
    const { controller, dom } = createController({
      events,
      fetchImpl: vi.fn(async () => ({
        ok: true,
        json: async () => ({ resources: createResources([1, 2, 3]) }),
      })),
    });

    await controller.startDownload("AROME_SP2");

    expect(events).toContain("store:01H:cache:101");
    expect(events).toContain("store:02H:network:2");
    expect(events).toContain("store:03H:cache:103");
    expect(events).toContain("store:03H:network:3");
    expect(events.indexOf("store:02H:network:2")).toBeLessThan(
      events.indexOf("store:03H:network:3"),
    );
    expect(dom.forecastDownloadStatus.textContent).toBe("3 / 3 files");
    expect(
      [...dom.forecastDownloadFileList.querySelectorAll(".forecast-download-file")].map((item) => [
        item.id,
        item.querySelector(".forecast-download-file__status").textContent,
      ]),
    ).toEqual([
      ["dl-file-01H", "loaded from cache"],
      ["dl-file-02H", "loaded from network"],
      ["dl-file-03H", "loaded from network"],
    ]);
    expect([...dom.dataStatusSummary.children].map((item) => item.textContent)).toEqual([
      "1 loaded from cache",
      "0 missing",
      "2 loaded from network",
      "0 updating",
    ]);
  });

  test("changing variable invalidates render cache and applies the new default palette", async () => {
    vi.mocked(readCachedGribBlock).mockResolvedValue(new Uint8Array([101]));
    const { controller, mapRenderer, state } = createController({
      fetchImpl: vi.fn(async () => ({
        ok: true,
        json: async () => ({ resources: createResources([1]) }),
      })),
    });

    await controller.startDownload("AROME_SP2");
    const drawCountBeforeVariableChange = mapRenderer.drawBitmap.mock.calls.length;

    await controller.handleVariableChange("p");

    expect(controller.getModelState().variable).toBe("p");
    expect(controller.getModelState()).not.toHaveProperty("decoded");
    expect(controller.getModelState()).not.toHaveProperty("decodedOrder");
    expect(controller.getDiagnostics()).not.toHaveProperty("decodedSize");
    expect(mapRenderer.drawBitmap.mock.calls.length).toBeGreaterThan(drawCountBeforeVariableChange);
    expect(state.currentPalette).toBe("Plasma");
  });

  test("showing an unavailable hour clears the map while keeping the hour label", async () => {
    vi.mocked(readCachedGribBlock).mockResolvedValue(new Uint8Array([101]));
    const { controller, dom, mapPresentation, mapRenderer } = createController({
      fetchImpl: vi.fn(async () => ({
        ok: true,
        json: async () => ({ resources: createResources([1, 2]) }),
      })),
      missingRenderHours: [2],
    });

    await controller.startDownload("AROME_SP2");
    await controller.showHour(1);

    expect(dom.forecastHourLabel.textContent).toBe("+02H");
    expect(mapRenderer.clearLayer).toHaveBeenCalled();
    expect(mapPresentation.showUnavailable).toHaveBeenCalled();
    expect(mapPresentation.setForecastValidTime).toHaveBeenCalledWith(
      expect.stringContaining("AROME 0.01 - SP2"),
    );
  });
});
