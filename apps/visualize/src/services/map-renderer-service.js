import maplibregl from "maplibre-gl";

import { setupMapTooltip } from "../../map-tooltip.js";
import { createIsobarLayerService } from "./isobar-layer-service.js";

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
	// When the data domain crosses 0° longitude, MapLibre's terrain RTT renders the
	// canvas source only onto the "center tile" selected by getCoordinatesCenterTileID().
	// For AROME France (-8° → 12°), that center tile starts at exactly 0° (Mercator x=0.5),
	// so all terrain tiles west of 0° never receive the raster texture → blank strip.
	// Fix: split the canvas at 0° so each half is entirely within one hemisphere tile.
	let splitState = null; // { splitPixelX, westCanvas, eastCanvas } | null

	const isobarLayer = createIsobarLayerService({ getMap: () => map });

	function removeLayerIfExists() {
		if (splitState) {
			if (map?.getSource("grib2-west")) {
				map.removeLayer("grib2-layer-west");
				map.removeSource("grib2-west");
			}
			if (map?.getSource("grib2-east")) {
				map.removeLayer("grib2-layer-east");
				map.removeSource("grib2-east");
			}
			splitState = null;
		} else if (map?.getSource("grib2")) {
			map.removeLayer("grib2-layer");
			map.removeSource("grib2");
		}
	}

	function rasterLayerPaint() {
		return {
			"raster-opacity": rasterOpacity,
			"raster-resampling": "nearest",
		};
	}

	function updateSplitCanvases() {
		if (!splitState || !heatCanvas) return;
		const { splitPixelX, westCanvas, eastCanvas } = splitState;
		const h = heatCanvas.height;
		const eastW = heatCanvas.width - splitPixelX;

		const wCtx = westCanvas.getContext("2d");
		wCtx.clearRect(0, 0, splitPixelX, h);
		wCtx.drawImage(heatCanvas, 0, 0, splitPixelX, h, 0, 0, splitPixelX, h);

		const eCtx = eastCanvas.getContext("2d");
		eCtx.clearRect(0, 0, eastW, h);
		eCtx.drawImage(heatCanvas, splitPixelX, 0, eastW, h, 0, 0, eastW, h);
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
			isobarLayer.remove();
		},

		ensureHeatCanvas(grid) {
			const needH = canvasHeightForGrid(grid);
			const canvasChanged =
				!heatCanvas ||
				heatCanvas.width !== grid.ni ||
				heatCanvas.height !== needH;
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
			const west = corners[0][0];
			const east = corners[1][0];
			const north = corners[0][1];
			const south = corners[2][1];

			if (west < 0 && east > 0) {
				// Domain crosses 0° — split at the prime meridian.
				const splitPixelX = Math.round((canvas.width * -west) / (east - west));
				const eastW = canvas.width - splitPixelX;
				const h = canvas.height;

				const westCanvas = document.createElement("canvas");
				westCanvas.width = splitPixelX;
				westCanvas.height = h;

				const eastCanvas = document.createElement("canvas");
				eastCanvas.width = eastW;
				eastCanvas.height = h;

				splitState = { splitPixelX, westCanvas, eastCanvas };
				updateSplitCanvases();

				map.addSource("grib2-west", {
					type: "canvas",
					canvas: westCanvas,
					coordinates: [
						[west, north],
						[0, north],
						[0, south],
						[west, south],
					],
					animate: true,
				});
				map.addLayer({
					id: "grib2-layer-west",
					type: "raster",
					source: "grib2-west",
					paint: rasterLayerPaint(),
				});

				map.addSource("grib2-east", {
					type: "canvas",
					canvas: eastCanvas,
					coordinates: [
						[0, north],
						[east, north],
						[east, south],
						[0, south],
					],
					animate: true,
				});
				map.addLayer({
					id: "grib2-layer-east",
					type: "raster",
					source: "grib2-east",
					paint: rasterLayerPaint(),
				});
			} else {
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
					paint: rasterLayerPaint(),
				});
			}
		},

		async init(fitBoundsArgs) {
			if (map) return map;
			map = new maplibregl.Map({
				container: "map",
				style: "https://tiles.openfreemap.org/styles/positron",
				center: [7.6583, 45.9766], // Matterhorn
				zoom: 13,
				pitch: 65,
				bearing: -20,
				attributionControl: true,
			});
			await new Promise((resolve) => map.once("load", resolve));

			map.addSource("dem", {
				type: "raster-dem",
				tiles: [
					"https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png",
				],
				encoding: "terrarium",
				tileSize: 256,
				//maxzoom: 15,
			});
			map.setTerrain({ source: "dem", exaggeration: 2 });
			// MapLibre v4: sky is a top-level style property, not a layer type.
			map.setSky({
				"sky-color": "#1a6fd4",
				"horizon-color": "#aaccff",
				"fog-color": "#d0e8ff",
				"fog-ground-blend": 0.1,
				"atmosphere-blend": 0.4,
			});

			if (fitBoundsArgs) map.fitBounds(...fitBoundsArgs);
			map.addControl(
				new maplibregl.NavigationControl({ visualizePitch: true }),
			);
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
			return Boolean(map?.getSource("grib2") || map?.getSource("grib2-west"));
		},

		fitBounds(bounds, options) {
			// pitch:30 — enough to see terrain relief without the Alpes occluding
			// the western part of France (which happens at the Matterhorn default pitch of 65°).
			map?.fitBounds(bounds, { pitch: 30, bearing: 0, ...options });
		},

		triggerRepaint() {
			updateSplitCanvases();
			map?.triggerRepaint();
		},

		updateIsobars(geojson) {
			isobarLayer.update(geojson);
		},

		clearIsobars() {
			isobarLayer.remove();
		},
	};
}
