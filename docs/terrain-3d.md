# 3D Terrain Notes

This document records the first MapLibre 3D terrain attempt for the weather visualizer.

## Goal

Add a terrain mode so users can visually relate forecast fields to topography. The target is not
decorative relief: the terrain should help users understand how mountains, valleys, and coastal
relief can influence weather patterns.

## Attempted Approach

The first attempt used MapLibre native terrain with Mapterhorn DEM tiles:

```js
map.addSource("mapterhorn-dem", {
  type: "raster-dem",
  url: "https://tiles.mapterhorn.com/tilejson.json",
  tileSize: 256,
});

map.setTerrain({
  source: "mapterhorn-dem",
  exaggeration: 1,
});

map.addControl(
  new maplibregl.TerrainControl({
    source: "mapterhorn-dem",
    exaggeration: 1,
  }),
  "top-right",
);
```

The Mapterhorn TileJSON endpoint responded successfully and allowed cross-origin requests.

## What Broke

With terrain enabled, the weather raster layer no longer displayed correctly. The western part of
the forecast overlay disappeared or was clipped, reproduced on both AROME SP1 and AROME SP2.

The current weather layer is a MapLibre `canvas` source:

```js
map.addSource("grib2", {
  type: "canvas",
  canvas,
  coordinates: corners,
  animate: true,
});
```

MapLibre terrain changes how raster-like layers are rendered by draping them on the terrain mesh.
The existing canvas overlay is georeferenced from four corners and appears not to survive that
terrain rendering path correctly for the AROME domain.

## Current Conclusion

Native `setTerrain()` should not be enabled directly on the current map pipeline. It breaks the
main weather data display, which is more important than the terrain effect.

Hillshade was considered but rejected for this product goal. It keeps the map flat and provides
visual topographic context, but it does not let users inspect the weather data in actual 3D terrain.

## Image Source Experiment

A small migration from MapLibre `canvas` source to `image` source was tested:

1. render the worker `ImageBitmap` into the existing internal canvas;
2. convert that canvas to a PNG Blob with `canvas.toBlob()`;
3. create an object URL with `URL.createObjectURL(blob)`;
4. display it as a MapLibre `image` source;
5. update each frame with `source.updateImage()`.

The experiment did not solve the terrain clipping issue. The western part of the overlay still
disappeared with terrain enabled. It also made manual slider movement feel heavier because each
frame required an additional async PNG/blob/object-URL update step.

Result: the app was reverted to the previous `canvas` source pipeline for performance and visual
correctness.

## Direction To Explore

Treat 3D terrain as a dedicated map-rendering architecture task:

- Keep MapLibre terrain as the desired end state.
- Investigate which MapLibre layer/source types are safe over terrain for a full-domain weather
  raster.
- Replace or adapt the current `canvas` source if it cannot be made reliable with terrain.
- Do not pursue a simple `image` source swap further unless new evidence appears.
- Verify whether a tiled raster source, custom WebGL layer, or generated raster tiles are a better
  fit for terrain draping.
- Preserve accurate map coordinates and tooltip lookup with terrain enabled.
- Test terrain on AROME and ARPEGE, desktop and mobile, before making it default.

## Open Questions

- Can MapLibre reliably drape a four-corner `canvas` source on terrain, or is the clipping a known
  limitation/edge case?
- Would an `image` source behave differently from a `canvas` source for the same four-corner
  weather overlay?
- Is a tiled weather raster pipeline needed for robust terrain support?
- How should tooltip coordinate lookup behave when terrain is enabled and the visual surface is no
  longer flat?
