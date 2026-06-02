import { describe, expect, test, vi } from "vitest";
import { createForecastMapPresentationService } from "./forecast-map-presentation-service.js";

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

function createService(overrides = {}) {
  const modelState = {
    packageKey: "AROME_SP1",
    resources: [],
  };
  const mapRenderer = {
    clearIsobars: vi.fn(),
    clearLayer: vi.fn(),
    drawBitmap: vi.fn(),
    ensureHeatCanvas: vi.fn(() => ({ canvas: "canvas", canvasChanged: true })),
    fitBounds: vi.fn(),
    hasLayer: vi.fn(() => false),
    setLayer: vi.fn(),
    triggerRepaint: vi.fn(),
    updateIsobars: vi.fn(),
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
  const state = {
    gridState: null,
  };
  const service = createForecastMapPresentationService({
    getCurrentPalette: () => "Temperature",
    formatForecastValidTimeLabel: (label) => label,
    formatModelPackageSubtitle: (packageKey) => packageKey.replace("_", " "),
    formatRefTime: () => "2026-06-01 00:00 UTC",
    formatValidTime: () => "2026-06-01 01:00 UTC",
    getModelState: () => modelState,
    gridCorners: () => [
      [1, 2],
      [3, 4],
      [5, 6],
      [7, 8],
    ],
    initMap: vi.fn(async () => {}),
    makeGridState: (entry, values) => ({ entry, values }),
    mapPresentation,
    mapRenderer,
    missingValue: 9999,
    setGridState: (gridState) => {
      state.gridState = gridState;
    },
    ...overrides,
  });
  return { mapPresentation, mapRenderer, modelState, service, state };
}

describe("forecast map presentation service", () => {
  test("clears the map layer and associated presentation state", () => {
    const { mapPresentation, mapRenderer, service, state } = createService();

    service.clearMapLayer();

    expect(mapRenderer.clearLayer).toHaveBeenCalled();
    expect(state.gridState).toBeNull();
    expect(mapPresentation.hideColorScale).toHaveBeenCalled();
    expect(mapPresentation.hideUnavailable).toHaveBeenCalled();
  });

  test("presents a bitmap entry on the map and updates metadata", async () => {
    const { mapPresentation, mapRenderer, modelState, service, state } = createService();
    const entry = createEntry();

    await service.presentBitmapEntry(1, entry, { values: new Float32Array([1, 2]) });

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
      "Temperature",
      expect.any(String),
      "AROME SP1",
    );
    expect(modelState.lastRunInfo).toContain("AROME_SP1");
  });
});
