# Web application — apps/visualize/index.html

## Architecture

Single-file SPA with no framework. Two usage modes:
- **Local file**: drag-and-drop or file input → GRIB2 messages parsed locally.
- **AROME online**: download GRIB2 packages from a CDN (Météo-France data) with time animation.

Served statically from the repository root (`npm run serve` → `http://localhost:3000/apps/visualize/`).

```
#             → home view  (#view-home)
#grid/<name>  → grid view  (#view-grid)
```

### In-memory state

```js
let fileState      = null; // { messages: Array } — parsed messages without WASM decoding
let gridState      = null; // { values, min, range, grid, product [, displayUnits, staticScale] }
let aromeState     = null; // { packageKey, resources, buffers, decoded, decodedOrder, variable, currentHour }
let currentPalette = 'Plasma';
let map            = null; // MapLibre instance (created once, reused)
let heatCanvas     = null; // offscreen canvas for heatmap rendering
let isDecoding     = false;
let pendingHourIdx = null;
```

`gridState` is kept so the palette can be changed without re-running WASM.
`staticScale` is set for parameters with a fixed scale (e.g. CAPE); otherwise the scale is computed dynamically from min/max.

`aromeState` is replaced entirely on each new download; progress callbacks check reference identity
(`downloadKey = aromeState`) to ignore responses from a cancelled download.

---

## Home view — Local file

- Drag-and-drop / file input → `processFile(file)`
- `iterateGRIB2Messages(buffer)` (synchronous, no WASM) to list variables
- Metadata banner: file, size, centre, reference date
- Card grid (one card per variable): parameter, level, forecast time, grid

---

## Home view — AROME online

### Available packages

```js
const PACKAGES = {
  SP1: { label: "AROME SP1 0.01°", variables: [...] },  // t, r, u, v, ugust, vgust
  SP2: { label: "AROME SP2 0.01°", variables: [...] },  // p, cape, lcc, mcc, hcc, tgrp, rrate, srate
};
```

Each package defines a list of variables (`shortName`, `name`, `units`, `level`) and a base URL for GRIB2 files per time step.

### Download flow

`startAromeDownload(packageKey)`:
1. Initialises `aromeState` (resets previous state) and sets `downloadKey = aromeState`
2. Displays the list of files to download with individual progress bars
3. Launches `Promise.all(...)` over all time steps; each progress callback checks `aromeState !== downloadKey` before updating the DOM — prevents race conditions if a new download starts mid-flight
4. As buffers arrive, stores them in `aromeState.buffers` and triggers decoding via `aromeShowHour()`

### Time animation

`aromeShowHour(hour)`:
- Decodes the GRIB2 buffer for the requested time step (`decodeGRIB2`) if not already cached in `aromeState.decoded`
- Updates `gridState` and re-runs `renderHeatmap()`
- `isDecoding` / `pendingHourIdx` prevent concurrent decoding (the slider can advance while a decode is in progress)

---

## Grid view

### Decoding
`showGridView(shortName)` → `decodeGRIB2(msg.buffer)` (WASM CCSDS/JPEG2000).
Result stored in `gridState`.

### Canvas rendering
Offscreen canvas (`heatCanvas`) at full resolution (e.g. 2801×1791 for AROME), copied to the visible canvas.

```js
function buildLUT(paletteName)  // 256 RGB entries, avoids N chroma calls per pixel
function renderHeatmap()         // reads gridState + currentPalette, repaints the canvas
function computeOutHeight(grid)  // output height in pixels to preserve Mercator ratio
```

Missing points (≤ MISSING_VALUE) → semi-transparent grey (180, 180, 180, α=100).

Rendering supports both vertical scan directions:
- **N→S** (`la1 > la2`, standard scanning mode): `row = rowFromNorth`
- **S→N** (`la2 > la1`, scanning mode 0x40): `row = nj - 1 - rowFromNorth`

### Mercator projection

`computeOutHeight` and the pixel→latitude mapping use the Mercator projection:

```js
const mercatorY    = lat => Math.log(Math.tan(Math.PI/4 + lat * Math.PI/360));
const invMercatorY = y   => (Math.atan(Math.exp(y)) - Math.PI/4) * 360/Math.PI;
```

Output height is computed to preserve the geographic ratio `spanY / spanX` in Mercator projection.

### MapLibre GL map

The GRIB2 canvas is overlaid on a base map via MapLibre GL:

```js
import maplibregl from 'https://esm.sh/maplibre-gl@4';
```

The canvas is registered as a `type: "canvas"` source with the grid corner coordinates:

```js
function gridCorners(grid)
// returns [[west,north],[east,north],[east,south],[west,south]]
// handles all orientations (N→S/S→N, E→W/W→E) via Math.min/max
```

A `mousemove` listener reads raw values from `gridState` and shows a `lat/lon/value` tooltip.

### Color palettes (chroma-js)
Loaded via ESM CDN: `https://esm.sh/chroma-js@2.4.2`

11 palettes in 3 groups (`<select>` in the toolbar):
- **Perceptually uniform**: Plasma, Viridis, Magma, Inferno
- **Diverging**: Spectral, RdBu, RdYlBu
- **Sequential**: YlOrRd, OrRd, Blues, YlGnBu

`Viridis` and ColorBrewer scales are in `chroma.brewer`.
`Plasma`, `Magma`, `Inferno` are absent from the ESM build → defined as hex arrays
in `CUSTOM_SCALES` and passed directly to `chroma.scale([...])`.

Palette change → `renderHeatmap()` only (no WASM re-decode).

### CSS design tokens

All colours, spacing, radii and transitions are defined as custom properties in `:root`:

- `--color-*` — colour palette (text, surface, bg, border, accent, error, success…)
- `--space-xs/sm/md/lg/xl` — spacing scale (4/8/16/24/32 px)
- `--radius-sm/md/lg` — border radii (6/8/10 px)
- `--transition-fast/base/slow` — transition durations (0.12/0.15/0.2 s)

### DOM helpers

```js
function updateParamInfo(name, desc, sub)            // updates #gv-name, #gv-desc, #gv-sub
function updateStats(min, max, mean, count, units)   // updates #gv-min, #gv-max, #gv-mean, #gv-valid
```

### Colour scale legend
CSS gradient generated from the current scale (8 stops via `sc(i/7).css()`),
applied to `#cs-bar`. Min/max displayed with the parameter unit.

---

## JS imports

```html
<link rel="stylesheet" href="https://unpkg.com/maplibre-gl@4/dist/maplibre-gl.css" />

<script type="importmap">
  { "imports": { "grib2-decoder": "/packages/grib2-decoder/dist/grib2-decoder.js" } }
</script>
```

```js
import maplibregl from 'https://esm.sh/maplibre-gl@4';
import chroma     from 'https://esm.sh/chroma-js@2.4.2';
import {
  iterateGRIB2Messages, decodeGRIB2, MISSING_VALUE,
  computeStats,
  CENTRES, GENERATING_PROCESS, fmtRefTime, fmtLevel, fmtValidTime,
} from 'grib2-decoder';
```

The import map must precede the `<script type="module">`. The server is started from the repository root, making the absolute path `/packages/...` resolvable.
