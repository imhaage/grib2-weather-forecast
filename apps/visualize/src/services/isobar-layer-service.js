const ISOBAR_SOURCE_ID = "isobars";
const ISOBAR_LINE_LAYER_ID = "isobars-line";
const ISOBAR_LABEL_LAYER_ID = "isobars-label";
const ISOBAR_COLOR = "#111827";

function hasSource(map) {
  return Boolean(map.getSource(ISOBAR_SOURCE_ID));
}

function hasLayer(map, id) {
  return Boolean(map.getLayer(id));
}

export function createIsobarLayerService({ getMap }) {
  function remove() {
    const map = getMap();
    if (!map) return;
    if (hasLayer(map, ISOBAR_LABEL_LAYER_ID)) map.removeLayer(ISOBAR_LABEL_LAYER_ID);
    if (hasLayer(map, ISOBAR_LINE_LAYER_ID)) map.removeLayer(ISOBAR_LINE_LAYER_ID);
    if (hasSource(map)) map.removeSource(ISOBAR_SOURCE_ID);
  }

  function addLayers(map) {
    map.addLayer({
      id: ISOBAR_LINE_LAYER_ID,
      type: "line",
      source: ISOBAR_SOURCE_ID,
      paint: {
        "line-color": ISOBAR_COLOR,
        "line-width": 1,
        "line-opacity": 0.72,
      },
    });
    map.addLayer({
      id: ISOBAR_LABEL_LAYER_ID,
      type: "symbol",
      source: ISOBAR_SOURCE_ID,
      layout: {
        "symbol-placement": "line",
        "symbol-spacing": 280,
        "text-field": ["get", "label"],
        "text-font": ["Noto Sans Regular"],
        "text-size": 11,
      },
      paint: {
        "text-color": ISOBAR_COLOR,
        "text-halo-color": "#ffffff",
        "text-halo-width": 1.2,
      },
    });
  }

  function update(geojson) {
    const map = getMap();
    if (!map) return;
    if (!geojson?.features?.length) {
      remove();
      return;
    }
    if (hasSource(map)) {
      map.getSource(ISOBAR_SOURCE_ID).setData(geojson);
      return;
    }
    map.addSource(ISOBAR_SOURCE_ID, {
      type: "geojson",
      data: geojson,
    });
    addLayers(map);
  }

  return {
    remove,
    update,
  };
}
