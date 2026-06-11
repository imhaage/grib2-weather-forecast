import { describe, expect, test, vi } from "vitest";
import type { ForecastRunState } from "../../domain/forecast-types";
import {
  makeForecastDownloadSession,
  makeForecastRunState,
  makeRemoteResource,
} from "./forecast-test-fixtures";
import type { ForecastMapRendererPort, ViewportBounds } from "./map-contracts";
import { makeForecastMapEntry, makeGridDefinition } from "./map-test-fixtures";
import {
  type CreateForecastMapPresentationUseCaseOptions,
  createForecastMapPresentationUseCase,
} from "./present-map";

function createUseCase(overrides = {}) {
  const modelState = makeForecastRunState({
    packageKey: "AROME_SP1",
    variable: "t",
  });
  const canvas = {};
  const mapRenderer = {
    clearWindSymbols: vi.fn(),
    clearIsobars: vi.fn(),
    clearLayer: vi.fn(),
    drawBitmap: vi.fn(),
    ensureHeatCanvas: vi.fn(() => ({ canvas, canvasChanged: true })),
    fitBounds: vi.fn(),
    getViewportBounds: vi.fn((): ViewportBounds | null => null),
    getZoom: vi.fn(() => 0),
    hasLayer: vi.fn(() => false),
    setVisible: vi.fn(),
    setLayer: vi.fn(),
    triggerRepaint: vi.fn(),
    updateIsobars: vi.fn(),
    updateWindSymbols: vi.fn(),
  } satisfies ForecastMapRendererPort;
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
    getModelState: () => modelState as ForecastRunState,
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

  return { canvas, mapPresentation, mapRenderer, modelState, useCase, state };
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
    const { canvas, mapPresentation, mapRenderer, modelState, useCase, state } = createUseCase();
    const entry = makeForecastMapEntry();

    await useCase.presentBitmapEntry(1, entry, { values: new Float32Array([1, 2]) });

    expect(state.gridState).toEqual({ entry, values: new Float32Array([1, 2]) });
    expect(mapRenderer.drawBitmap).toHaveBeenCalledWith(entry.bitmap);
    expect(mapRenderer.setLayer).toHaveBeenCalledWith(canvas, [
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
    const entry = makeForecastMapEntry({
      displayUnits: "km/h",
      product: { name: "U-component of wind", shortName: "u", pdtNumber: 0 },
      vectorUValues: new Float32Array([0, 0, 0, 0]),
      vectorVValues: new Float32Array([-4, -4, -4, -4]),
      grid: makeGridDefinition(),
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
    const entry = makeForecastMapEntry({
      vectorUValues: new Float32Array([0, 0, 0, 0]),
      vectorVValues: new Float32Array([-4, -4, -4, -4]),
      grid: makeGridDefinition(),
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
    const entry = makeForecastMapEntry({
      vectorUValues: new Float32Array([0, 0, 0, 0]),
      vectorVValues: new Float32Array([-4, -4, -4, -4]),
      grid: makeGridDefinition(),
    });

    await useCase.presentBitmapEntry(1, entry, { values: new Float32Array([4, 4, 4, 4]) });

    expect(mapRenderer.updateWindSymbols).not.toHaveBeenCalled();
    expect(mapRenderer.clearWindSymbols).toHaveBeenCalled();
  });

  test("refreshes wind symbols when the map viewport settles", async () => {
    const { mapRenderer, modelState, useCase, state } = createUseCase();
    modelState.variable = "wind";
    const entry = makeForecastMapEntry({
      displayUnits: "km/h",
      values: new Float32Array([4, 4, 4, 4]),
      vectorUValues: new Float32Array([0, 0, 0, 0]),
      vectorVValues: new Float32Array([-4, -4, -4, -4]),
      grid: makeGridDefinition(),
    });

    await useCase.presentBitmapEntry(1, entry);
    state.viewportSettledCallback?.();

    expect(mapRenderer.updateWindSymbols).toHaveBeenCalledTimes(2);
  });

  test("presents the first available forecast block by showing and fitting the map", async () => {
    const { mapRenderer, modelState, useCase } = createUseCase();
    modelState.hourList = [1, 2];
    modelState.resources = [makeRemoteResource()];
    const showHour = vi.fn(async () => {});

    await useCase.presentAvailableBlock(
      makeRemoteResource(),
      makeForecastDownloadSession({
        availableCount: 1,
        pkg: {
          model: "AROME",
          label: "AROME SP1",
          provider: "data-gouv",
          datasetId: "dataset",
          titlePattern: "__SP1__",
          bounds: [
            [-5, 41],
            [9, 51],
          ],
          variables: [],
        },
      }),
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
      makeRemoteResource(),
      makeRemoteResource({ key: "02H", startHour: 2, endHour: 2 }),
    ];
    const showHour = vi.fn(async () => {});

    await useCase.presentAvailableBlock(
      makeRemoteResource({ key: "02H", startHour: 2, endHour: 2 }),
      makeForecastDownloadSession({ availableCount: 2 }),
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
