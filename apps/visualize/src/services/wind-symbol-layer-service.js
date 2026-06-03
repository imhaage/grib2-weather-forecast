const WIND_SYMBOL_SOURCE_ID = "wind-symbols";
const WIND_ARROW_LAYER_ID = "wind-arrows";
const WIND_CALM_LAYER_ID = "wind-calm";
const WIND_ARROW_ICON_ID = "wind-arrow";

function createArrowIconCanvas() {
  if (typeof document === "undefined") return null;
  const canvas = document.createElement("canvas");
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#111827";
  ctx.strokeStyle = "rgba(255, 255, 255, 0.9)";
  ctx.lineWidth = 2;
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(16, 3);
  ctx.lineTo(25, 23);
  ctx.lineTo(16, 18);
  ctx.lineTo(7, 23);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  return canvas;
}

function ensureArrowIcon(map) {
  if (!map.hasImage || !map.addImage || map.hasImage(WIND_ARROW_ICON_ID)) return;
  const icon = createArrowIconCanvas();
  if (icon) map.addImage(WIND_ARROW_ICON_ID, icon);
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
