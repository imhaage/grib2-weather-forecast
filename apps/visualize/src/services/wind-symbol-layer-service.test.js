import { describe, expect, test, vi } from "vitest";
import { createWindSymbolLayerService } from "./wind-symbol-layer-service.js";

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

describe("wind symbol layer service", () => {
  test("adds source and layers on first update", () => {
    const map = createMap();
    const service = createWindSymbolLayerService({ getMap: () => map });
    const geojson = { type: "FeatureCollection", features: [] };

    service.update(geojson);

    expect(map.addSource).toHaveBeenCalledWith("wind-symbols", {
      type: "geojson",
      data: geojson,
    });
    expect(map.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: "wind-arrows" }));
    expect(map.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: "wind-calm" }));
  });

  test("updates existing source data", () => {
    const map = createMap();
    const source = { setData: vi.fn() };
    const service = createWindSymbolLayerService({ getMap: () => map });
    const first = { type: "FeatureCollection", features: [] };
    const second = { type: "FeatureCollection", features: [] };

    service.update(first);
    map.getSource = vi.fn(() => source);
    service.update(second);

    expect(source.setData).toHaveBeenCalledWith(second);
  });

  test("removes layers before source", () => {
    const map = createMap();
    const service = createWindSymbolLayerService({ getMap: () => map });

    service.update({ type: "FeatureCollection", features: [] });
    service.remove();

    expect(map.removeLayer).toHaveBeenCalledWith("wind-arrows");
    expect(map.removeLayer).toHaveBeenCalledWith("wind-calm");
    expect(map.removeSource).toHaveBeenCalledWith("wind-symbols");
  });
});
