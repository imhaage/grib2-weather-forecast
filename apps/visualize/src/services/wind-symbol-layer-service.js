const WIND_SYMBOL_SOURCE_ID = "wind-symbols";
const WIND_ARROW_LAYER_ID = "wind-arrows";
const WIND_CALM_LAYER_ID = "wind-calm";
const WIND_ARROW_ICON_ID = "wind-arrow";
const WIND_ARROW_ICON_SIZE = 32;
const WIND_ARROW_VIEWBOX_SIZE = 24;
const WIND_ARROW_SVG_PATH = "M12 2 L21 22 L13.2 18.2 L12 17.6 L10.8 18.2 L3 22 Z";

function createArrowIconImageData() {
  const canvas = document.createElement("canvas");
  canvas.width = WIND_ARROW_ICON_SIZE;
  canvas.height = WIND_ARROW_ICON_SIZE;
  const ctx = canvas.getContext("2d");
  ctx.scale(
    WIND_ARROW_ICON_SIZE / WIND_ARROW_VIEWBOX_SIZE,
    WIND_ARROW_ICON_SIZE / WIND_ARROW_VIEWBOX_SIZE,
  );
  ctx.fillStyle = "#111827";
  ctx.fill(new Path2D(WIND_ARROW_SVG_PATH));
  const image = ctx.getImageData(0, 0, WIND_ARROW_ICON_SIZE, WIND_ARROW_ICON_SIZE);
  return { width: image.width, height: image.height, data: image.data };
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
      "icon-size": 0.4,
      "icon-allow-overlap": true,
      "icon-ignore-placement": true,
      "icon-rotate": ["get", "directionDegrees"],
      "icon-rotation-alignment": "map",
    },
    paint: {
      "icon-opacity": 0.5,
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
      "circle-opacity": 0,
      "circle-stroke-width": 1.5,
      "circle-stroke-opacity": 0.5,
      "circle-stroke-color": "#111827",
      "circle-color": "rgba(17, 24, 39, 0)",
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
