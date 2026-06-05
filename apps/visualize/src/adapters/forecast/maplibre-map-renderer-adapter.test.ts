import { beforeEach, describe, expect, test, vi } from "vitest";

const mapInstances: FakeMap[] = [];

class FakeMap {
  addControl = vi.fn();
  addLayer = vi.fn();
  addSource = vi.fn();
  canvas = { style: {} };
  fitBounds = vi.fn();
  getBounds = vi.fn(() => ({
    getEast: () => 5,
    getNorth: () => 53,
    getSouth: () => 49,
    getWest: () => 0,
  }));
  getLayer = vi.fn(() => false);
  getSource = vi.fn(() => null);
  getZoom = vi.fn(() => 8);
  on = vi.fn();
  removeLayer = vi.fn();
  removeSource = vi.fn();
  resize = vi.fn();
  triggerRepaint = vi.fn();

  constructor() {
    mapInstances.push(this);
  }

  once(_event: string, callback: () => void) {
    callback();
  }

  getCanvas() {
    return this.canvas;
  }
}

vi.mock("maplibre-gl", () => ({
  default: {
    FullscreenControl: vi.fn(),
    Map: FakeMap,
  },
}));

function createService(overrides = {}) {
  return createMapLibreMapRendererAdapter({
    canvasHeightForGrid: () => 1,
    getGridState: () => null,
    getMapScene: () => ({ hidden: false }),
    missingValue: -1e100,
    rasterOpacity: 0.8,
    tooltipEl: { hidden: true, style: {} },
    wrapEl: { getBoundingClientRect: () => ({ left: 0, top: 0 }) },
    ...overrides,
  });
}

let createMapLibreMapRendererAdapter: typeof import("./maplibre-map-renderer-adapter").createMapLibreMapRendererAdapter;

beforeEach(async () => {
  mapInstances.length = 0;
  ({ createMapLibreMapRendererAdapter } = await import("./maplibre-map-renderer-adapter"));
});

describe("MapLibre map renderer adapter", () => {
  test("registers viewport settled callbacks on moveend and zoomend", async () => {
    const service = createService();
    const callback = vi.fn();

    await service.init();
    service.onViewportSettled(callback);

    expect(mapInstances[0].on).toHaveBeenCalledWith("moveend", callback);
    expect(mapInstances[0].on).toHaveBeenCalledWith("zoomend", callback);
  });

  test("exposes normalized viewport bounds and zoom", async () => {
    const service = createService();

    await service.init();

    expect(service.getViewportBounds()).toEqual({ west: 0, south: 49, east: 5, north: 53 });
    expect(service.getZoom()).toBe(8);
  });
});
