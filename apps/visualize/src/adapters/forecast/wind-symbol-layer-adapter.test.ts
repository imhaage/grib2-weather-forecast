import { afterEach, describe, expect, test, vi } from "vitest";
import { makeForecastFeatureCollection } from "../../use-cases/forecast/map-test-fixtures";
import { createWindSymbolLayerService } from "./wind-symbol-layer-adapter";

function createMap() {
  const sources = new Map();
  const layers = new Set();

  return {
    addLayer: vi.fn((layer) => layers.add(layer.id)),
    addSource: vi.fn((id, source) => sources.set(id, source)),
    getLayer: vi.fn((id) => layers.has(id)),
    getSource: vi.fn((id) => sources.get(id) ?? null),
    removeLayer: vi.fn((id) => layers.delete(id)),
    removeSource: vi.fn((id) => sources.delete(id)),
  };
}

function stubSvgRasterization() {
  const imageData = {
    width: 32,
    height: 32,
    data: new Uint8ClampedArray(32 * 32 * 4),
  };
  const context = {
    fill: vi.fn(),
    fillStyle: "",
    getImageData: vi.fn(() => imageData),
    scale: vi.fn(),
  };
  const canvas = {
    height: 0,
    width: 0,
    getContext: vi.fn(() => context),
  };
  vi.stubGlobal("document", {
    createElement: vi.fn(() => canvas),
  });
  vi.stubGlobal("Path2D", vi.fn());

  return { canvas, context };
}

describe("wind symbol layer adapter", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  test("adds source and layers on first update", () => {
    const map = createMap();
    const service = createWindSymbolLayerService({ getMap: () => map });
    const geojson = makeForecastFeatureCollection();

    service.update(geojson);

    expect(map.addSource).toHaveBeenCalledWith("wind-symbols", {
      type: "geojson",
      data: geojson,
    });
    expect(map.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: "wind-arrows" }));
    expect(map.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: "wind-calm" }));
  });

  test("keeps the wider SVG arrow compact enough for dense sampling", () => {
    const map = createMap();
    const service = createWindSymbolLayerService({ getMap: () => map });

    service.update(makeForecastFeatureCollection());

    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "wind-arrows",
        layout: expect.objectContaining({
          "icon-size": 0.36,
        }),
        paint: expect.objectContaining({
          "icon-opacity": 0.42,
        }),
      }),
    );
  });

  test("renders calm markers as an unfilled stroked circle", () => {
    const map = createMap();
    const service = createWindSymbolLayerService({ getMap: () => map });

    service.update(makeForecastFeatureCollection());

    expect(map.addLayer).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "wind-calm",
        paint: expect.objectContaining({
          "circle-color": "rgba(17, 24, 39, 0)",
          "circle-opacity": 0,
          "circle-stroke-opacity": 0.42,
        }),
      }),
    );
  });

  test("rasterizes the configured SVG arrow before registering it", () => {
    const { canvas, context } = stubSvgRasterization();
    const map = {
      ...createMap(),
      addImage: vi.fn(),
      hasImage: vi.fn(() => false),
    };
    const service = createWindSymbolLayerService({ getMap: () => map });

    service.update(makeForecastFeatureCollection());

    expect(canvas.width).toBe(32);
    expect(canvas.height).toBe(32);
    expect(context.scale).toHaveBeenCalledWith(32 / 24, 32 / 24);
    expect(Path2D).toHaveBeenCalledWith(expect.stringContaining("M12 2"));
    expect(context.fill).toHaveBeenCalled();
    expect(map.addImage).toHaveBeenCalledWith("wind-arrow", {
      width: 32,
      height: 32,
      data: expect.any(Uint8ClampedArray),
    });
  });

  test("updates existing source data", () => {
    const map = createMap();
    const source = { setData: vi.fn() };
    const service = createWindSymbolLayerService({ getMap: () => map });
    const first = makeForecastFeatureCollection();
    const second = makeForecastFeatureCollection();

    service.update(first);
    map.getSource = vi.fn(() => source);
    service.update(second);

    expect(source.setData).toHaveBeenCalledWith(second);
  });

  test("removes layers before source", () => {
    const map = createMap();
    const service = createWindSymbolLayerService({ getMap: () => map });

    service.update(makeForecastFeatureCollection());
    service.remove();

    expect(map.removeLayer).toHaveBeenCalledWith("wind-arrows");
    expect(map.removeLayer).toHaveBeenCalledWith("wind-calm");
    expect(map.removeSource).toHaveBeenCalledWith("wind-symbols");
  });
});
