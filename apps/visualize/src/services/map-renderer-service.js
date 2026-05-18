import maplibregl from "maplibre-gl";

import { setupMapTooltip } from "../../map-tooltip.js";

export function createMapRendererService({
  canvasHeightForGrid,
  getGridState,
  getMapScene,
  missingValue,
  rasterOpacity,
  tooltipEl,
  wrapEl,
}) {
  let map = null;
  let heatCanvas = null;

  function removeLayerIfExists() {
    if (map?.getSource("grib2")) {
      map.removeLayer("grib2-layer");
      map.removeSource("grib2");
    }
  }

  return {
    get map() {
      return map;
    },

    setVisible(visible) {
      const scene = getMapScene();
      scene.hidden = !visible;
      if (visible && map) map.resize();
    },

    clearLayer() {
      removeLayerIfExists();
    },

    ensureHeatCanvas(grid) {
      const needH = canvasHeightForGrid(grid);
      const canvasChanged =
        !heatCanvas || heatCanvas.width !== grid.ni || heatCanvas.height !== needH;
      if (canvasChanged) {
        heatCanvas = document.createElement("canvas");
        heatCanvas.width = grid.ni;
        heatCanvas.height = needH;
      }
      return {
        canvas: heatCanvas,
        canvasChanged,
        outW: grid.ni,
        outH: needH,
      };
    },

    drawBitmap(bitmap) {
      const ctx = heatCanvas.getContext("2d");
      ctx.clearRect(0, 0, heatCanvas.width, heatCanvas.height);
      ctx.drawImage(bitmap, 0, 0);
    },

    setLayer(canvas, corners) {
      removeLayerIfExists();
      map.addSource("grib2", {
        type: "canvas",
        canvas,
        coordinates: corners,
        animate: true,
      });
      map.addLayer({
        id: "grib2-layer",
        type: "raster",
        source: "grib2",
        paint: {
          "raster-opacity": rasterOpacity,
          "raster-resampling": "nearest",
        },
      });
    },

    async init(fitBoundsArgs) {
      if (map) return map;
      map = new maplibregl.Map({
        container: "map",
        style: "https://tiles.openfreemap.org/styles/positron",
        attributionControl: true,
      });
      await new Promise((resolve) => map.once("load", resolve));
      if (fitBoundsArgs) map.fitBounds(...fitBoundsArgs);
      map.addControl(
        new maplibregl.FullscreenControl({
          container: getMapScene(),
        }),
      );
      setupMapTooltip({
        map,
        maplibregl,
        getGridState,
        missingValue,
        tooltipEl,
        wrapEl,
      });
      return map;
    },

    hasLayer() {
      return Boolean(map?.getSource("grib2"));
    },

    fitBounds(bounds, options) {
      map?.fitBounds(bounds, options);
    },

    triggerRepaint() {
      map?.triggerRepaint();
    },
  };
}
