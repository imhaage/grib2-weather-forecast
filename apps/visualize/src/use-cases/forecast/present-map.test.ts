import { describe, expect, test, vi } from "vitest";
import {
  type CreateForecastMapPresentationUseCaseOptions,
  createForecastMapPresentationUseCase,
} from "./present-map";

function createEntry(overrides = {}) {
  return {
    bitmap: {},
    dataMin: 1,
    dataMax: 5,
    mean: 3,
    count: 4,
    displayUnits: "K",
    renderMin: 0,
    range: 10,
    staticScale: false,
    isLog: false,
    grid: { id: "grid" },
    product: { name: "Temperature", shortName: "t", pdtNumber: 0 },
    header: {},
    ...overrides,
  };
}

function createUseCase(overrides = {}) {
  const modelState: {
    hourList?: number[];
    lastRunInfo?: string;
    packageKey: string;
    resources: Array<{ endHour?: number; key: string; startHour?: number }>;
    showWindDirection?: boolean;
    variable: string;
  } = {
    packageKey: "AROME_SP1",
    variable: "t",
    resources: [],
  };
  const mapRenderer: {
    clearWindSymbols: ReturnType<typeof vi.fn>;
    clearIsobars: ReturnType<typeof vi.fn>;
    clearLayer: ReturnType<typeof vi.fn>;
    drawBitmap: ReturnType<typeof vi.fn>;
    ensureHeatCanvas: ReturnType<typeof vi.fn>;
    fitBounds: ReturnType<typeof vi.fn>;
    getViewportBounds?: ReturnType<typeof vi.fn>;
    getZoom?: ReturnType<typeof vi.fn>;
    hasLayer: ReturnType<typeof vi.fn>;
    setVisible: ReturnType<typeof vi.fn>;
    setLayer: ReturnType<typeof vi.fn>;
    triggerRepaint: ReturnType<typeof vi.fn>;
    updateIsobars: ReturnType<typeof vi.fn>;
    updateWindSymbols: ReturnType<typeof vi.fn>;
  } = {
    clearWindSymbols: vi.fn(),
    clearIsobars: vi.fn(),
    clearLayer: vi.fn(),
    drawBitmap: vi.fn(),
    ensureHeatCanvas: vi.fn(() => ({ canvas: "canvas", canvasChanged: true })),
    fitBounds: vi.fn(),
    hasLayer: vi.fn(() => false),
    setVisible: vi.fn(),
    setLayer: vi.fn(),
    triggerRepaint: vi.fn(),
    updateIsobars: vi.fn(),
    updateWindSymbols: vi.fn(),
  };
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
  const state: {
    gridState: unknown;
    viewportSettledCallback: (() => void) | null;
  } = {
    gridState: null,
    viewportSettledCallback: null,
  };
  const useCase = createForecastMapPresentationUseCase({
    getCurrentPalette: () => "Temperature",
    formatForecastValidTimeLabel: (label) => label,
    formatModelPackageSubtitle: (packageKey) => packageKey.replace("_", " "),
    formatRefTime: () => "2026-06-01 00:00 UTC",
    formatValidTime: () => "2026-06-01 01:00 UTC",
    getModelState: () => modelState,
    getMapBounds: () => ({ west: 0, south: 49, east: 5, north: 53 }),
    getMapZoom: () => 8,
    gridCorners: () => [
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
    ],
    initMap: vi.fn(async () => {}),
    makeGridState: (entry, values) => ({ entry, values }),
    mapPresentation:
      mapPresentation as unknown as CreateForecastMapPresentationUseCaseOptions["mapPresentation"],
    mapRenderer:
      mapRenderer as unknown as CreateForecastMapPresentationUseCaseOptions["mapRenderer"],
    missingValue: 9999,
    onMapViewportSettled: (callback) => {
      state.viewportSettledCallback = callback;
    },
    setGridState: (gridState) => {
      state.gridState = gridState;
    },
    ...overrides,
  });
  return { mapPresentation, mapRenderer, modelState, useCase, state };
}

describe("forecast map presentation use case", () => {
  test("clears the map layer and associated presentation state", () => {
    const { mapPresentation, mapRenderer, useCase, state } = createUseCase();

    useCase.clearMapLayer();

    expect(mapRenderer.clearLayer).toHaveBeenCalled();
    expect(state.gridState).toBeNull();
    expect(mapPresentation.hideColorScale).toHaveBeenCalled();
    expect(mapPresentation.hideUnavailable).toHaveBeenCalled();
  });

  test("presents a bitmap entry on the map and updates metadata", async () => {
    const { mapPresentation, mapRenderer, modelState, useCase, state } = createUseCase();
    const entry = createEntry();

    await useCase.presentBitmapEntry(1, entry, { values: new Float32Array([1, 2]) });

    expect(state.gridState).toEqual({ entry, values: new Float32Array([1, 2]) });
    expect(mapRenderer.drawBitmap).toHaveBeenCalledWith(entry.bitmap);
    expect(mapRenderer.setLayer).toHaveBeenCalledWith("canvas", [
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
    ]);
    expect(mapRenderer.fitBounds).toHaveBeenCalledWith(
      [
        [7, 6],
        [3, 2],
      ],
      { padding: 20, animate: false },
    );
    expect(mapPresentation.updateParamInfo).toHaveBeenCalledWith(
      "Temperature (2m)",
      expect.any(String),
      "AROME SP1",
    );
    expect(modelState.lastRunInfo).toContain("AROME_SP1");
  });

  test("updates wind symbols for composite wind entries", async () => {
    const { mapPresentation, mapRenderer, modelState, useCase } = createUseCase();
    modelState.variable = "wind";
    const entry = createEntry({
      displayUnits: "km/h",
      product: { name: "U-component of wind", shortName: "u", pdtNumber: 0 },
      vectorUValues: new Float32Array([0, 0, 0, 0]),
      vectorVValues: new Float32Array([-4, -4, -4, -4]),
      grid: {
        ni: 2,
        nj: 2,
        latitudeOfFirstPoint: 51,
        latitudeOfLastPoint: 50,
        longitudeOfFirstPoint: 1,
        longitudeOfLastPoint: 2,
        di: 1,
        dj: 1,
      },
    });

    await useCase.presentBitmapEntry(1, entry, { values: new Float32Array([4, 4, 4, 4]) });

    expect(mapRenderer.updateWindSymbols).toHaveBeenCalledWith(
      expect.objectContaining({ type: "FeatureCollection" }),
    );
    expect(mapRenderer.clearWindSymbols).not.toHaveBeenCalled();
    expect(mapPresentation.updateParamInfo).toHaveBeenCalledWith(
      "Wind (10m)",
      expect.any(String),
      "AROME SP1",
    );
  });

  test("uses map renderer viewport accessors instead of the raw map instance", async () => {
    const { mapRenderer, modelState, useCase } = createUseCase({
      getMapBounds: undefined,
      getMapZoom: undefined,
    });
    Object.defineProperty(mapRenderer, "map", {
      get() {
        throw new Error("presentation service should not access raw MapLibre map");
      },
    });
    mapRenderer.getViewportBounds = vi.fn(() => ({ west: 0, south: 49, east: 5, north: 53 }));
    mapRenderer.getZoom = vi.fn(() => 8);
    modelState.variable = "wind";
    const entry = createEntry({
      vectorUValues: new Float32Array([0, 0, 0, 0]),
      vectorVValues: new Float32Array([-4, -4, -4, -4]),
      grid: {
        ni: 2,
        nj: 2,
        latitudeOfFirstPoint: 51,
        latitudeOfLastPoint: 50,
        longitudeOfFirstPoint: 1,
        longitudeOfLastPoint: 2,
        di: 1,
        dj: 1,
      },
    });

    await useCase.presentBitmapEntry(1, entry, { values: new Float32Array([4, 4, 4, 4]) });

    expect(mapRenderer.getViewportBounds).toHaveBeenCalled();
    expect(mapRenderer.getZoom).toHaveBeenCalled();
    expect(mapRenderer.updateWindSymbols).toHaveBeenCalled();
  });

  test("clears wind symbols when direction display is disabled", async () => {
    const { mapRenderer, modelState, useCase } = createUseCase();
    modelState.variable = "wind";
    modelState.showWindDirection = false;
    const entry = createEntry({
      vectorUValues: new Float32Array([0, 0, 0, 0]),
      vectorVValues: new Float32Array([-4, -4, -4, -4]),
      grid: {
        ni: 2,
        nj: 2,
        latitudeOfFirstPoint: 51,
        latitudeOfLastPoint: 50,
        longitudeOfFirstPoint: 1,
        longitudeOfLastPoint: 2,
        di: 1,
        dj: 1,
      },
    });

    await useCase.presentBitmapEntry(1, entry, { values: new Float32Array([4, 4, 4, 4]) });

    expect(mapRenderer.updateWindSymbols).not.toHaveBeenCalled();
    expect(mapRenderer.clearWindSymbols).toHaveBeenCalled();
  });

  test("refreshes wind symbols when the map viewport settles", async () => {
    const { mapRenderer, modelState, useCase, state } = createUseCase();
    modelState.variable = "wind";
    const entry = createEntry({
      displayUnits: "km/h",
      values: new Float32Array([4, 4, 4, 4]),
      vectorUValues: new Float32Array([0, 0, 0, 0]),
      vectorVValues: new Float32Array([-4, -4, -4, -4]),
      grid: {
        ni: 2,
        nj: 2,
        latitudeOfFirstPoint: 51,
        latitudeOfLastPoint: 50,
        longitudeOfFirstPoint: 1,
        longitudeOfLastPoint: 2,
        di: 1,
        dj: 1,
      },
    });

    await useCase.presentBitmapEntry(1, entry);
    state.viewportSettledCallback?.();

    expect(mapRenderer.updateWindSymbols).toHaveBeenCalledTimes(2);
  });

  test("presents the first available forecast block by showing and fitting the map", async () => {
    const { mapRenderer, modelState, useCase } = createUseCase();
    modelState.hourList = [1, 2];
    modelState.resources = [{ key: "01H", startHour: 1, endHour: 1 }];
    const showHour = vi.fn(async () => {});

    await useCase.presentAvailableBlock(
      { key: "01H" },
      {
        availableCount: 1,
        downloadKey: { id: 1 },
        pkg: {
          bounds: [
            [-5, 41],
            [9, 51],
          ],
        },
      },
      {
        isRefreshActive: vi.fn(() => true),
        selectedHourIndex: vi.fn(() => 0),
        showHour,
      },
    );

    expect(mapRenderer.setVisible).toHaveBeenCalledWith(true);
    expect(mapRenderer.fitBounds).toHaveBeenCalledWith(
      [
        [-5, 41],
        [9, 51],
      ],
      { padding: 20, animate: false },
    );
    expect(showHour).toHaveBeenCalledWith(0);
  });

  test("presents a later available block only when it matches the selected hour", async () => {
    const { mapRenderer, modelState, useCase } = createUseCase();
    modelState.hourList = [1, 2];
    modelState.resources = [
      { key: "01H", startHour: 1, endHour: 1 },
      { key: "02H", startHour: 2, endHour: 2 },
    ];
    const showHour = vi.fn(async () => {});

    await useCase.presentAvailableBlock(
      { key: "02H" },
      { availableCount: 2, downloadKey: { id: 1 }, pkg: { bounds: [] } },
      {
        isRefreshActive: vi.fn(() => true),
        selectedHourIndex: vi.fn(() => 1),
        showHour,
      },
    );

    expect(mapRenderer.setVisible).not.toHaveBeenCalled();
    expect(showHour).toHaveBeenCalledWith(1);
  });
});
