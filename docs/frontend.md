# Web application — apps/visualize/index.html

## Architecture

Single-file SPA with no framework. Two usage modes:
- **Local file**: drag-and-drop or file input → GRIB2 messages parsed locally.
- **Model online**: download GRIB2 packages from data.gouv.fr (Météo-France) with time animation.

Served statically from the repository root (`npm run serve` → `http://localhost:3000/apps/visualize/`).

```
#             → home view  (#view-home)
#grid/<name>  → grid view  (#view-grid)
#arome/<key>  → player     (#view-grid in arome toolbar mode)
```

### In-memory state

```js
let fileState      = null; // { messages: Array } — parsed messages without WASM decoding
let gridState      = null; // { values, min, range, grid, product [, displayUnits, staticScale] }
let modelState     = null; // { packageKey, resources, buffers, messageIndex, hourList,
                           //   decoded, decodedOrder, variable, currentHour, lastRunInfo }
let currentPalette = 'Plasma';
let map            = null; // MapLibre instance (created once, reused)
let heatCanvas     = null; // offscreen canvas for heatmap rendering
let isDecoding     = false;
let pendingHourIdx = null;
```

`gridState` is kept so the palette can be changed without re-running WASM.
`staticScale` is set for parameters with a fixed scale (e.g. CAPE); otherwise the scale is computed dynamically from min/max.

`modelState` is replaced entirely on each new download; progress callbacks check reference identity
(`downloadKey = modelState`) to ignore responses from a cancelled download.

---

## Home view — Local file

- Drag-and-drop / file input → `processFile(file)`
- `iterateGRIB2Messages(buffer)` (synchronous, no WASM) to list variables
- Metadata banner: file, size, centre, reference date
- Card grid (one card per variable): parameter, level, forecast time, grid

---

## Home view — Multi-model online player

### Available packages

```js
const PACKAGES = {
  AROME_SP1: {
    model: "AROME", label: "AROME SP1 0.01°",
    provider: "data-gouv", datasetId: "65bd1247a6238f16e864fa80",
    titlePattern: "__SP1__",
    bounds: [[-12, 37.5], [16, 55.4]],
    variables: [...],  // t, r, u, v, ugust, vgust
  },
  AROME_SP2: {
    model: "AROME", label: "AROME SP2 0.01°",
    provider: "data-gouv", datasetId: "65bd1247a6238f16e864fa80",
    titlePattern: "__SP2__",
    bounds: [[-12, 37.5], [16, 55.4]],
    variables: [...],  // p, cape, lcc, mcc, hcc, tgrp, rrate, srate
  },
  ARPEGE_SP1: {
    model: "ARPEGE", label: "ARPEGE SP1 0.1°",
    provider: "data-gouv", datasetId: "65bd13b2eb9e79ab309f6e63",
    titlePattern: "__SP1__",
    bounds: [[-180, -90], [180, 90]],
    variables: [...],  // t, r, u, v, msl, tcc, wspd, wdir
  },
};
```

Each package defines: `model` (group label), `provider`, `datasetId`, `titlePattern` (used to filter
resources from the API), `bounds` (MapLibre fitBounds target), and `variables` array with
`{ shortName, name, units, level }`.

The home page model buttons are generated dynamically by `buildModelList()` — an IIFE that groups
`PACKAGES` entries by `model` and appends `<button>` elements into `#model-list`. No button IDs
are used; click handlers set `location.hash = #arome/${key}`.

### File naming conventions

data.gouv.fr files follow two patterns parsed by `fetchDataGouvResources`:

| Pattern | Example | Match | Result |
|---------|---------|-------|--------|
| Single hour | `__01H__` | `/__(\d+)H__/` | `startHour=1, endHour=1, key="01H"` |
| Hour range | `__000H012H__` | `/__(\d+)H(\d+)H__/` | `startHour=0, endHour=12, key="000H012H"` |

AROME uses single-hour files (one per forecast hour). ARPEGE uses 12-hour range blocks (e.g. 9
blocks for a 102-hour run).

### Download flow

`startDownload(packageKey)`:
1. Initialises `modelState` (resets previous state) and sets `downloadKey = modelState`
2. Calls `fetchDataGouvResources(pkg.datasetId, pkg.titlePattern)` to list available blocks
3. Builds `hourList`: expands each block's `[startHour..endHour]` range into a flat array of all
   forecast hours — e.g. `[0, 1, ..., 12, 13, ..., 24, ...]` for ARPEGE or `[0, 1, ..., 51]`
   for AROME
4. Sets `slider.max = hourList.length - 1`
5. Renders one progress bar per block (labelled with `H+${startHour}`)
6. Launches block downloads through `runWithConcurrency(..., MAX_PARALLEL_DOWNLOADS, ...)`,
   currently capped at 6 active fetches. Each callback checks `modelState !== downloadKey` to
   handle cancellation. On block arrival: stores in `modelState.buffers` (keyed by block key string),
   optionally initialises the legend, and triggers the first render only after all files are
   downloaded

### Block indexing

`indexBlock(blockKey)` is called lazily on first access to a block's data:
- Iterates all messages in the block via `iterateGRIB2Messages(buffer)`
- Builds a `Map<"${forecastTime}_${shortName}", Uint8Array>` for O(1) message lookup
- Stores the index in `modelState.messageIndex.get(blockKey)`

For AROME (single-hour files), the index has one entry per variable at that hour.
For ARPEGE (12-hour blocks), the index has 13 hours × N variables entries.

### Time animation

`showHour(idx)` (slider index):
- `const hour = modelState.hourList[idx]` — maps slider position to forecast hour
- Calls `getCachedDecode(hour)` which finds the block containing `hour`, calls `indexBlock` if
  needed, looks up `"${hour}_${variable}"` in the index, then calls `decodeGRIB2(msgBuffer)`
- LRU decode cache (`DECODED_CACHE_SIZE = 5`) keyed by forecast hour
- Updates `gridState` and re-runs `renderHeatmap()`
- `isDecoding` / `pendingHourIdx` prevent concurrent decoding

Unit conversions applied in `showHour`:
- `t` (temperature): K → °C (`v - 273.15`)
- `p` or `msl` (pressure): Pa → hPa (`v / 100`)
- `tcc` (total cloud cover): fraction → % (`v * 100`)
- Accumulation variables (PDT 4.8): hourly increment computed as `H[n] − H[n-1]`

Map bounds (`pkg.bounds`) passed to `initMap` / `map.fitBounds` on each package start,
so the view recentres to the model's domain (France for AROME, global for ARPEGE).

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
