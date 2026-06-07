import maplibregl from "maplibre-gl";

import { setupMapTooltip } from "../../../map-tooltip.js";
import { createIsobarLayerService } from "./isobar-layer-adapter";
import { createWindSymbolLayerService } from "./wind-symbol-layer-adapter";

interface GridLike {
  ni: number;
}

interface BoundsLike {
  getEast: () => number;
  getNorth: () => number;
  getSouth: () => number;
  getWest: () => number;
}

interface MapLibreLike {
  addControl: (control: unknown) => void;
  addImage?: (
    id: string,
    image: { width: number; height: number; data: Uint8ClampedArray },
  ) => void;
  addLayer: (layer: Record<string, unknown>) => void;
  addSource: (id: string, source: Record<string, unknown>) => void;
  fitBounds: (bounds: unknown, options?: unknown) => void;
  getBounds?: () => BoundsLike;
  getLayer: (id: string) => unknown;
  getSource: (id: string) => { setData?: (data: unknown) => void } | null | undefined;
  getZoom?: () => number;
  hasImage?: (id: string) => boolean;
  once: (event: "load", callback: () => void) => void;
  on: (event: "moveend" | "zoomend", callback: () => void) => void;
  removeLayer: (id: string) => void;
  removeSource: (id: string) => void;
  resize: () => void;
  triggerRepaint: () => void;
}

interface MapRendererOptions {
  canvasHeightForGrid: (grid: GridLike) => number;
  getGridState: () => unknown;
  getMapScene: () => HTMLElement | { hidden: boolean };
  missingValue: number;
  rasterOpacity: number;
  tooltipEl: HTMLElement | { hidden: boolean; style: Record<string, unknown> };
  wrapEl: HTMLElement | { getBoundingClientRect: () => { left: number; top: number } };
}

type FitBoundsArgs = [bounds: unknown, options?: unknown];

interface FeatureCollectionLike {
  features?: unknown[];
  [key: string]: unknown;
}

function createMapLibreMap() {
  return new maplibregl.Map({
    container: "map",
    style: "https://tiles.openfreemap.org/styles/positron",
  }) as unknown as MapLibreLike;
}

export function createMapLibreMapRendererAdapter({
  canvasHeightForGrid,
  getGridState,
  getMapScene,
  missingValue,
  rasterOpacity,
  tooltipEl,
  wrapEl,
}: MapRendererOptions) {
  let map: MapLibreLike | null = null;
  let heatCanvas: HTMLCanvasElement | null = null;
  const isobarLayer = createIsobarLayerService({ getMap: () => map });
  const windSymbolLayer = createWindSymbolLayerService({ getMap: () => map });

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

    setVisible(visible: boolean) {
      const scene = getMapScene();
      scene.hidden = !visible;

      if (visible && map) {
        map.resize();
      }
    },

    clearLayer() {
      removeLayerIfExists();
      isobarLayer.remove();
      windSymbolLayer.remove();
    },

    ensureHeatCanvas(grid: GridLike) {
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

    drawBitmap(bitmap: CanvasImageSource) {
      const ctx = heatCanvas?.getContext("2d");

      if (!heatCanvas || !ctx) {
        return;
      }

      ctx.clearRect(0, 0, heatCanvas.width, heatCanvas.height);
      ctx.drawImage(bitmap, 0, 0);
    },

    setLayer(canvas: HTMLCanvasElement, corners: unknown) {
      removeLayerIfExists();
      map?.addSource("grib2", {
        type: "canvas",
        canvas,
        coordinates: corners,
        animate: true,
      });
      map?.addLayer({
        id: "grib2-layer",
        type: "raster",
        source: "grib2",
        paint: {
          "raster-opacity": rasterOpacity,
          "raster-resampling": "nearest",
        },
      });
    },

    async init(fitBoundsArgs?: FitBoundsArgs) {
      if (map) {
        return map;
      }

      map = createMapLibreMap();
      await new Promise<void>((resolve) => map?.once("load", resolve));

      if (fitBoundsArgs) {
        map.fitBounds(...fitBoundsArgs);
      }

      map.addControl(
        new maplibregl.FullscreenControl({
          container: getMapScene() as HTMLElement,
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

    getViewportBounds() {
      const bounds = map?.getBounds?.();

      if (!bounds) {
        return null;
      }

      return {
        west: bounds.getWest(),
        south: bounds.getSouth(),
        east: bounds.getEast(),
        north: bounds.getNorth(),
      };
    },

    getZoom() {
      return map?.getZoom?.() ?? 0;
    },

    fitBounds(bounds: unknown, options?: unknown) {
      map?.fitBounds(bounds, options);
    },

    triggerRepaint() {
      map?.triggerRepaint();
    },

    updateIsobars(geojson: FeatureCollectionLike | null | undefined) {
      isobarLayer.update(geojson);
    },

    clearIsobars() {
      isobarLayer.remove();
    },

    updateWindSymbols(geojson: unknown) {
      windSymbolLayer.update(geojson);
    },

    clearWindSymbols() {
      windSymbolLayer.remove();
    },

    onViewportSettled(callback: () => void) {
      if (!map) {
        return;
      }

      map.on("moveend", callback);
      map.on("zoomend", callback);
    },
  };
}
