const WIND_SYMBOL_SOURCE_ID = "wind-symbols";
const WIND_ARROW_LAYER_ID = "wind-arrows";
const WIND_CALM_LAYER_ID = "wind-calm";
const WIND_ARROW_ICON_ID = "wind-arrow";

function isInsideArrowShape(x, y) {
  const centerOffset = Math.abs(x - 16);
  const shaft = y >= 11 && y <= 25 && centerOffset <= 2;
  const head = y >= 4 && y <= 17 && centerOffset <= (y - 4) * 0.65 + 1;
  return shaft || head;
}

function isInsideArrowStroke(x, y) {
  const centerOffset = Math.abs(x - 16);
  const shaftStroke = y >= 10 && y <= 26 && centerOffset <= 3;
  const headStroke = y >= 3 && y <= 18 && centerOffset <= (y - 3) * 0.68 + 2;
  return shaftStroke || headStroke;
}

function setPixel(data, x, y, [red, green, blue, alpha]) {
  const index = (y * 32 + x) * 4;
  data[index] = red;
  data[index + 1] = green;
  data[index + 2] = blue;
  data[index + 3] = alpha;
}

function createArrowIconImageData() {
  const data = new Uint8ClampedArray(32 * 32 * 4);
  for (let y = 0; y < 32; y++) {
    for (let x = 0; x < 32; x++) {
      if (isInsideArrowStroke(x, y)) {
        setPixel(data, x, y, [255, 255, 255, 230]);
      }
      if (isInsideArrowShape(x, y)) {
        setPixel(data, x, y, [17, 24, 39, 255]);
      }
    }
  }
  return { width: 32, height: 32, data };
}

function ensureArrowIcon(map) {
  if (!map.hasImage || !map.addImage || map.hasImage(WIND_ARROW_ICON_ID)) return;
  map.addImage(WIND_ARROW_ICON_ID, createArrowIconImageData());
}

function addWindSymbolSource(map, geojson) {
  map.addSource(WIND_SYMBOL_SOURCE_ID, {
    type: "geojson",
    data: geojson,
  });
}

function addWindArrowLayer(map) {
  map.addLayer({
    id: WIND_ARROW_LAYER_ID,
    type: "symbol",
    source: WIND_SYMBOL_SOURCE_ID,
    filter: ["==", ["get", "symbol"], "arrow"],
    layout: {
      "icon-image": WIND_ARROW_ICON_ID,
      "icon-size": 0.8,
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "icon-rotate": ["get", "directionDegrees"],
      "icon-rotation-alignment": "map",
    },
  });
}

function addWindCalmLayer(map) {
  map.addLayer({
    id: WIND_CALM_LAYER_ID,
    type: "circle",
    source: WIND_SYMBOL_SOURCE_ID,
    filter: ["==", ["get", "symbol"], "calm"],
    paint: {
      "circle-radius": 3,
      "circle-stroke-width": 1.5,
      "circle-stroke-color": "#111827",
      "circle-color": "rgba(255, 255, 255, 0.85)",
    },
  });
}

function removeLayerIfExists(map, layerId) {
  if (map.getLayer(layerId)) map.removeLayer(layerId);
}

export function createWindSymbolLayerService({ getMap }) {
  function ensureLayers(map, geojson) {
    if (!map.getSource(WIND_SYMBOL_SOURCE_ID)) {
      addWindSymbolSource(map, geojson);
    }
    ensureArrowIcon(map);
    if (!map.getLayer(WIND_ARROW_LAYER_ID)) addWindArrowLayer(map);
    if (!map.getLayer(WIND_CALM_LAYER_ID)) addWindCalmLayer(map);
  }

  return {
    update(geojson) {
      const map = getMap();
      if (!map) return;
      const source = map.getSource(WIND_SYMBOL_SOURCE_ID);
      if (source?.setData) {
        source.setData(geojson);
      } else {
        ensureLayers(map, geojson);
      }
    },

    remove() {
      const map = getMap();
      if (!map) return;
      removeLayerIfExists(map, WIND_ARROW_LAYER_ID);
      removeLayerIfExists(map, WIND_CALM_LAYER_ID);
      if (map.getSource(WIND_SYMBOL_SOURCE_ID)) map.removeSource(WIND_SYMBOL_SOURCE_ID);
    },
  };
}
