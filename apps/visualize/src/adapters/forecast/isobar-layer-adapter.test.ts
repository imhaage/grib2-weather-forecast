import { describe, expect, test, vi } from "vitest";
import { createIsobarLayerService } from "./isobar-layer-adapter";

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

describe("isobar layer adapter", () => {
  test("adds source and line and label layers when features are available", () => {
    const map = createMap();
    const service = createIsobarLayerService({ getMap: () => map });
    const geojson = { type: "FeatureCollection", features: [{ type: "Feature" }] };

    service.update(geojson);

    expect(map.addSource).toHaveBeenCalledWith("isobars", { type: "geojson", data: geojson });
    expect(map.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: "isobars-line" }));
    expect(map.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: "isobars-label" }));
  });

  test("updates existing source data", () => {
    const map = createMap();
    const source = { setData: vi.fn() };
    const service = createIsobarLayerService({ getMap: () => map });
    const first = { type: "FeatureCollection", features: [{ type: "Feature" }] };
    const second = { type: "FeatureCollection", features: [{ type: "Feature" }] };

    service.update(first);
    map.getSource = vi.fn(() => source);
    service.update(second);

    expect(source.setData).toHaveBeenCalledWith(second);
  });

  test("removes layers and source when feature collection is empty", () => {
    const map = createMap();
    const service = createIsobarLayerService({ getMap: () => map });

    service.update({ type: "FeatureCollection", features: [{ type: "Feature" }] });
    service.update({ type: "FeatureCollection", features: [] });

    expect(map.removeLayer).toHaveBeenCalledWith("isobars-label");
    expect(map.removeLayer).toHaveBeenCalledWith("isobars-line");
    expect(map.removeSource).toHaveBeenCalledWith("isobars");
  });
});
