import { beforeEach, describe, expect, test, vi } from "vitest";

const mapInstances = [];

class FakeMap {
  constructor() {
    this.canvas = { style: {} };
    this.fitBounds = vi.fn();
    this.addControl = vi.fn();
    this.on = vi.fn();
    mapInstances.push(this);
  }

  once(_event, callback) {
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
  return createMapRendererService({
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

let createMapRendererService;

beforeEach(async () => {
  mapInstances.length = 0;
  ({ createMapRendererService } = await import("./map-renderer-service.js"));
});

describe("map renderer service", () => {
  test("registers viewport settled callbacks on moveend and zoomend", async () => {
    const service = createService();
    const callback = vi.fn();

    await service.init();
    service.onViewportSettled(callback);

    expect(mapInstances[0].on).toHaveBeenCalledWith("moveend", callback);
    expect(mapInstances[0].on).toHaveBeenCalledWith("zoomend", callback);
  });
});
