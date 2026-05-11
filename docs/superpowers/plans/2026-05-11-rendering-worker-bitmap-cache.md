# Rendering Worker + Bitmap Cache Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the heatmap pixel loop to a Web Worker and cache rendered `ImageBitmap` objects per forecast hour so animation playback is O(1) drawImage calls instead of O(pixels) blocking renders.

**Architecture:** A classic Web Worker (`render-worker.js`) owns the pixel loop. The main thread sends decoded values + LUT + grid params via `postMessage` and receives an `ImageBitmap`. A `Map<hour, ImageBitmap>` on the main thread caches results per variable; the cache is cleared on variable/palette/package change. After each block downloads, `prerenderBlock()` fills the cache in the background.

**Tech Stack:** Vanilla JS ES modules, Web Worker API (classic), `createImageBitmap`, `ImageBitmap.close()`. No new npm dependencies.

---

## File Map

| File | Change |
|------|--------|
| `apps/visualize/render-worker.js` | **New** — pixel loop only, no DOM, no imports |
| `apps/visualize/index.js` | Add worker infra, bitmap cache, `computeRenderParams`, update `showHour`, add `prerenderBlock`, wire invalidation |

---

## Task 1: Create `render-worker.js`

**Files:**
- Create: `apps/visualize/render-worker.js`

- [ ] **Step 1: Create the worker file**

```js
// apps/visualize/render-worker.js
// Pixel loop for heatmap rendering — runs in a Web Worker.
// Receives decoded values + LUT + grid params, returns an ImageBitmap.
self.onmessage = async ({ data }) => {
  const {
    callId, gen,
    values, lut,
    missingValue,
    min, range,
    isLog, logFloor, logDenom,
    zeroThreshold,
    outW, outH,
    ni, nj, dj, isStoN,
    northLat, southLat, myNorth, mySpan,
  } = data;

  const img = new ImageData(outW, outH);
  const px = img.data;

  for (let py = 0; py < outH; py++) {
    const myY = myNorth - (py / outH) * mySpan;
    const lat = (2 * Math.atan(Math.exp(myY)) - Math.PI / 2) * 180 / Math.PI;
    if (lat > northLat || lat < southLat) continue;

    const rowFromNorth = Math.min(Math.max(Math.round((northLat - lat) / dj), 0), nj - 1);
    const row = isStoN ? nj - 1 - rowFromNorth : rowFromNorth;
    const rowOff = row * ni;
    const imgRow = py * outW;

    for (let col = 0; col < outW; col++) {
      const v = values[rowOff + col];
      if (v <= missingValue || (zeroThreshold > 0 && v <= zeroThreshold)) continue;

      let t;
      if (isLog) {
        t = Math.max(0, Math.min(1, Math.log(Math.max(v, logFloor) / logFloor) / logDenom));
      } else {
        t = Math.max(0, Math.min(1, (v - min) / range));
      }
      const li = Math.min(Math.round(t * 255), 255) * 3;
      const off = (imgRow + col) * 4;
      px[off]     = lut[li];
      px[off + 1] = lut[li + 1];
      px[off + 2] = lut[li + 2];
      px[off + 3] = 255;
    }
  }

  const bitmap = await createImageBitmap(img);
  self.postMessage({ callId, gen, bitmap }, [bitmap]);
};
```

- [ ] **Step 2: Verify the file is served**

```bash
npm run serve
# Open http://localhost:3000/apps/visualize/render-worker.js in the browser
# Expected: the worker source JS is displayed (no 404)
```

---

## Task 2: Add worker infrastructure to `index.js`

**Files:**
- Modify: `apps/visualize/index.js`

The goal of this task is to add the `renderWorker`, `bitmapCache`, and `renderViaWorker` plumbing — no change to showHour yet.

- [ ] **Step 1: Add state variables**

Find the state section (around line 141, after `let playerInterval = null;`). Add three lines:

```js
let renderWorker = null;
let renderGen = 0;
let nextCallId = 0;
let bitmapCache = new Map(); // hour (number) → ImageBitmap, scoped to current variable+palette
```

- [ ] **Step 2: Add `initRenderWorker`**

Add this function after the state block, before `const fmtNum`:

```js
function initRenderWorker() {
  if (renderWorker) return;
  renderWorker = new Worker(new URL("./render-worker.js", import.meta.url));
}
```

- [ ] **Step 3: Add `renderViaWorker`**

Add after `initRenderWorker`:

```js
// Sends decoded values to the worker, returns Promise<ImageBitmap|null>.
// Returns null if renderGen changed before the worker responds (stale result).
// Values are copied (slice) so the decode cache entry remains valid.
function renderViaWorker(displayValues, renderParams, outW, outH) {
  initRenderWorker();
  const myGen = renderGen;
  const myCallId = ++nextCallId;

  const { grid } = renderParams;
  const northLat = Math.max(grid.latitudeOfFirstPoint, grid.latitudeOfLastPoint);
  const southLat = Math.min(grid.latitudeOfFirstPoint, grid.latitudeOfLastPoint);
  const isStoN = grid.latitudeOfLastPoint > grid.latitudeOfFirstPoint;
  const myNorth = mercatorY(northLat);
  const mySpan = myNorth - mercatorY(southLat);

  return new Promise((resolve) => {
    function onMsg({ data }) {
      if (data.callId !== myCallId) return;
      renderWorker.removeEventListener("message", onMsg);
      if (renderGen !== myGen) { data.bitmap?.close(); resolve(null); return; }
      resolve(data.bitmap);
    }
    renderWorker.addEventListener("message", onMsg);

    const valuesCopy = displayValues.slice();
    const lut = buildLUT(currentPalette);
    renderWorker.postMessage({
      callId: myCallId,
      gen: myGen,
      values: valuesCopy,
      lut,
      missingValue: MISSING_VALUE,
      min: renderParams.renderMin,
      range: renderParams.range,
      isLog: renderParams.isLog,
      logFloor: LOG_SCALE_FLOOR,
      logDenom: renderParams.logDenom,
      zeroThreshold: renderParams.zeroThreshold,
      outW,
      outH,
      ni: grid.ni,
      nj: grid.nj,
      dj: grid.dj,
      isStoN,
      northLat,
      southLat,
      myNorth,
      mySpan,
    }, [valuesCopy.buffer]);
  });
}
```

- [ ] **Step 4: Add `invalidateBitmapCache`**

Add after `renderViaWorker`:

```js
function invalidateBitmapCache() {
  for (const bitmap of bitmapCache.values()) bitmap.close();
  bitmapCache = new Map();
  renderGen++;
}
```

- [ ] **Step 5: Verify no JS errors**

```bash
npm run serve
# Open http://localhost:3000/apps/visualize/ — console must be error-free
# The app must work identically to before (renderHeatmap still used — no behavior change yet)
```

---

## Task 3: Extract `computeRenderParams` from `showHour`

**Files:**
- Modify: `apps/visualize/index.js`

`computeRenderParams` encapsulates all value transforms (accumulation diff, unit conversions, scale lookup) currently inlined in `showHour`. Both `showHour` and `prerenderBlock` will call it.

- [ ] **Step 1: Add `computeRenderParams` before `showHour`**

Find the line `async function showHour(idx) {` (around line 852). Insert before it:

```js
// Applies all transforms to raw decoded data and returns render-ready params.
// idx is the slider index — needed to compute accumulation diff with previous hour.
async function computeRenderParams(data, idx) {
  const { values, grid, product } = data;
  const isAccumulation = product.pdtNumber === 8;
  let displayValues = values;
  let isFallback = false;

  if (isAccumulation && idx > 0) {
    const prevHour = modelState.hourList[idx - 1];
    const prevData = await getCachedDecode(prevHour);
    if (prevData !== null) {
      const diff = new Float64Array(values.length);
      for (let i = 0; i < values.length; i++) {
        if (values[i] <= MISSING_VALUE || prevData.values[i] <= MISSING_VALUE) {
          diff[i] = MISSING_VALUE;
        } else {
          diff[i] = Math.max(0, values[i] - prevData.values[i]);
        }
      }
      displayValues = diff;
    } else {
      isFallback = true;
    }
  }

  if (product.shortName === "t")    displayValues = applyToValues(displayValues, (v) => v - 273.15);
  else if (product.shortName === "wspd") displayValues = applyToValues(displayValues, (v) => v * 3.6);
  else if (product.shortName === "p")    displayValues = applyToValues(displayValues, (v) => v / 100);
  else if (product.shortName === "msl")  displayValues = applyToValues(displayValues, (v) => v / 100);
  else if (product.shortName === "tcc")  displayValues = applyToValues(displayValues, (v) => v * 100);

  const { min: dataMin, max: dataMax, mean, count } = computeStats(displayValues);
  let displayUnits = displayUnitsFor(product.shortName, product.units);
  if (isAccumulation && !isFallback) displayUnits = "mm/h";

  const staticScale = STATIC_SCALES[product.shortName] ?? null;
  const renderMin = staticScale ? staticScale.min : dataMin;
  const renderMax = staticScale ? staticScale.max : dataMax;
  const range = renderMax - renderMin || 1;
  const isLog = staticScale?.log ?? false;
  const logDenom = isLog ? Math.log(staticScale.max / LOG_SCALE_FLOOR) : 1;
  const zeroThreshold = staticScale?.zeroThreshold ?? 0;

  return {
    displayValues,
    renderMin, renderMax, range,
    staticScale, isLog, logDenom, zeroThreshold,
    dataMin, dataMax, mean, count,
    displayUnits, isFallback,
    grid,
  };
}
```

- [ ] **Step 2: Remove `decodePrevHourValues` (now dead code)**

Find and delete this function (around line 847):

```js
async function decodePrevHourValues(prevHour) {
  const data = await getCachedDecode(prevHour);
  return data ? data.values : null;
}
```

`computeRenderParams` calls `getCachedDecode` directly — this wrapper is no longer used.

- [ ] **Step 3: Verify no JS errors**

```bash
npm run serve
# Console error-free — computeRenderParams is defined but not yet called
```

---

## Task 4: Update `showHour` to use bitmap cache + worker

**Files:**
- Modify: `apps/visualize/index.js`

Replace the body of `showHour` with a version that checks the bitmap cache and calls `renderViaWorker` on a miss. The existing `renderHeatmap()` is kept intact for the single-file grid view path.

- [ ] **Step 1: Replace `showHour` body**

Find the entire `showHour` function (lines ~852–984). Replace it with:

```js
async function showHour(idx) {
  if (isDecoding) {
    pendingHourIdx = idx;
    return;
  }
  isDecoding = true;
  pendingHourIdx = null;
  try {
    const hour = modelState.hourList[idx];
    document.getElementById("arome-hour-label").textContent = fmtHourLabel(hour);

    const data = await getCachedDecode(hour);
    if (!data) {
      clearMapLayer();
      return;
    }

    modelState.currentHour = hour;
    const { grid, product, header } = data;

    const p = await computeRenderParams(data, idx);

    // Keep gridState in sync so the hover tooltip has current values.
    gridState = {
      values: p.displayValues,
      min: p.renderMin,
      range: p.range,
      grid,
      product,
      displayUnits: p.displayUnits,
      staticScale: p.staticScale,
    };

    // Create/resize offscreen canvas only when the grid dimensions change.
    const needH = mercatorCanvasHeight(grid);
    const canvasChanged = !heatCanvas || heatCanvas.width !== grid.ni || heatCanvas.height !== needH;
    if (canvasChanged) {
      heatCanvas = document.createElement("canvas");
      heatCanvas.width = grid.ni;
      heatCanvas.height = needH;
    }

    const corners = gridCorners(grid);

    if (bitmapCache.has(hour)) {
      // Fast path: bitmap already rendered, just blit it.
      heatCanvas.getContext("2d").drawImage(bitmapCache.get(hour), 0, 0);
    } else {
      // Slow path: render via worker, then cache.
      const bitmap = await renderViaWorker(p.displayValues, p, grid.ni, needH);
      if (!bitmap) return; // renderGen changed while worker was busy — abort
      bitmapCache.set(hour, bitmap);
      heatCanvas.getContext("2d").drawImage(bitmap, 0, 0);
    }

    // Update legend bar gradient.
    const sc = makeScale(currentPalette);
    const stops = Array.from({ length: 8 }, (_, i) => sc(i / 7).css()).join(", ");
    document.getElementById("cs-bar").style.background = `linear-gradient(to right, ${stops})`;

    await initMap();
    const isFirstLayer = !map.getSource("grib2");
    if (isFirstLayer || canvasChanged) {
      setMapLayer(heatCanvas, corners);
      map.fitBounds(
        [[corners[3][0], corners[2][1]], [corners[1][0], corners[0][1]]],
        { padding: 20, animate: false },
      );
    }
    if (map) map.triggerRepaint();

    modelState.lastRunInfo = `${modelState.packageKey} · run ${fmtRefTime(header)}`;
    updateParamInfo(
      product.name,
      PARAM_DESCRIPTIONS[product.shortName] ?? "",
      modelState.lastRunInfo + (p.isFallback ? " · (cumulative — prev not loaded)" : ""),
    );

    updateStats(p.dataMin, p.dataMax, p.mean, p.count, p.displayUnits);
    showColorScale(p.renderMin, p.renderMax, p.displayUnits);

    const validTimeProduct = product.pdtNumber === 8
      ? { ...product, forecastTime: hour, timeUnit: 1 }
      : product;
    document.getElementById("arome-valid-time").textContent =
      `Forecast time: ${fmtValidTime(header, validTimeProduct)}`;

  } catch (err) {
    console.error("showHour:", err);
    clearMapLayer();
  } finally {
    isDecoding = false;
    if (pendingHourIdx !== null) {
      const next = pendingHourIdx;
      pendingHourIdx = null;
      showHour(next);
    }
  }
}

- [ ] **Step 2: Verify animation works**

```bash
npm run serve
# Open http://localhost:3000/apps/visualize/ → click AROME SP1
# Expected:
# - First hour renders correctly
# - Slider + animation work — no visual regression
# - Browser DevTools → Network → check Worker is loaded (render-worker.js, status 200)
# - Console: no errors
```

---

## Task 5: Add `prerenderBlock` and wire to download loop

**Files:**
- Modify: `apps/visualize/index.js`

After each file block downloads, we render all its hours in the background so that animation is bitmap-only by the time the user gets there.

- [ ] **Step 1: Add `prerenderBlock`**

Add after `showHour`:

```js
// Renders all hours in a block into bitmapCache in the background.
// Silently aborts if the variable or package changes (renderGen / modelState guard).
async function prerenderBlock(blockKey) {
  const capturedState = modelState;
  const capturedGen = renderGen;
  const block = capturedState.resources.find((r) => r.key === blockKey);
  if (!block) return;

  for (let hour = block.startHour; hour <= block.endHour; hour++) {
    if (modelState !== capturedState || renderGen !== capturedGen) return;
    if (bitmapCache.has(hour)) continue;

    const data = await getCachedDecode(hour);
    if (!data || modelState !== capturedState || renderGen !== capturedGen) return;

    const idx = capturedState.hourList.indexOf(hour);
    if (idx === -1) continue;

    const p = await computeRenderParams(data, idx);
    if (modelState !== capturedState || renderGen !== capturedGen) return;

    const outW = data.grid.ni;
    const outH = mercatorCanvasHeight(data.grid);
    const bitmap = await renderViaWorker(p.displayValues, p, outW, outH);
    if (!bitmap) continue; // stale gen — renderViaWorker already closed it

    if (modelState === capturedState && renderGen === capturedGen) {
      bitmapCache.set(hour, bitmap);
    } else {
      bitmap.close();
      return;
    }
  }
}
```

- [ ] **Step 2: Call `prerenderBlock` after each block downloads**

In `startDownload`, find this block (around line 1086):

```js
      modelState.buffers.set(block.key, buffer);
```

Add the call immediately after (no `await` — fire and forget):

```js
      modelState.buffers.set(block.key, buffer);
      prerenderBlock(block.key); // background — no await
```

- [ ] **Step 3: Verify pre-rendering in DevTools**

```bash
npm run serve
# Open http://localhost:3000/apps/visualize/ → click AROME SP1
# Open DevTools → Performance tab → record 5 seconds after first render
# Expected: main thread is NOT blocked by pixel loops after the first hour
# (all subsequent hours render in the worker thread — visible as Worker task, not Main)
# Slider animation should become progressively smoother as blocks are pre-rendered
```

---

## Task 6: Wire cache invalidation to variable/palette/package changes

**Files:**
- Modify: `apps/visualize/index.js`

The bitmap cache is only valid for the current variable + palette combination. Any change must clear it.

- [ ] **Step 1: Add `invalidateBitmapCache()` to `resetModelState`**

Find `resetModelState` (around line 662):

```js
function resetModelState() {
  stopPlayer();
  modelState = null;
  isDecoding = false;
  pendingHourIdx = null;
  gridState = null;
  document.getElementById("arome-dl-bars").innerHTML = "";
  document.getElementById("arome-dl-file-list").innerHTML = "";
}
```

Add `invalidateBitmapCache()` as the first line after `stopPlayer()`:

```js
function resetModelState() {
  stopPlayer();
  invalidateBitmapCache();
  modelState = null;
  isDecoding = false;
  pendingHourIdx = null;
  gridState = null;
  document.getElementById("arome-dl-bars").innerHTML = "";
  document.getElementById("arome-dl-file-list").innerHTML = "";
}
```

- [ ] **Step 2: Invalidate on variable change**

Find the `arome-var-select` change handler (around line 1309):

```js
  .addEventListener("change", (e) => {
    if (!modelState) return;
    const varKey = e.target.value;
    modelState.variable = varKey;
    // ...
    modelState.decoded.clear();
    modelState.decodedOrder = [];
```

Add `invalidateBitmapCache()` right after `modelState.decodedOrder = [];`:

```js
    modelState.decoded.clear();
    modelState.decodedOrder = [];
    invalidateBitmapCache();
```

Then trigger pre-rendering of all already-downloaded blocks for the new variable. Add after `invalidateBitmapCache()`:

```js
    for (const blockKey of modelState.buffers.keys()) {
      prerenderBlock(blockKey); // background
    }
```

- [ ] **Step 3: Invalidate on palette change**

Find `onPaletteChange` (around line 1289):

```js
function onPaletteChange(e) {
  currentPalette = e.target.value;
  document.getElementById("palette-select").value = currentPalette;
  document.getElementById("palette-select-arome").value = currentPalette;
  if (gridState) renderHeatmap();
}
```

Replace with:

```js
function onPaletteChange(e) {
  currentPalette = e.target.value;
  document.getElementById("palette-select").value = currentPalette;
  document.getElementById("palette-select-arome").value = currentPalette;
  if (!gridState) return;
  if (modelState) {
    // Model player: invalidate cache, re-render current hour via worker, re-prerender blocks.
    invalidateBitmapCache();
    showHour(parseInt(document.getElementById("arome-slider").value, 10));
    for (const blockKey of modelState.buffers.keys()) {
      prerenderBlock(blockKey); // background
    }
  } else {
    // Single-file grid view: use synchronous renderHeatmap (no model state to cache).
    renderHeatmap();
  }
}
```

- [ ] **Step 4: Verify all invalidation paths**

```bash
npm run serve
# Test 1: AROME SP1 → change variable → map updates correctly, no stale pixels
# Test 2: AROME SP1 → change palette → map updates correctly
# Test 3: AROME SP1 → click Home → click ARPEGE SP1 → works correctly
# Test 4: single-file drop → change palette → still works (renderHeatmap path)
# Console: no errors in any scenario
```

---

## Task 7: Final verification and single commit

**Files:**
- `apps/visualize/render-worker.js` (new)
- `apps/visualize/index.js` (modified)

- [ ] **Step 1: Run the test suite**

```bash
npm test
# Expected: 115 tests pass — decoder package is unaffected
```

- [ ] **Step 2: Manual smoke test**

```bash
npm run serve
# AROME SP1:
#   - First load: first hour renders (via worker, may take ~200ms)
#   - Play animation: first few frames may lag, then become instant as cache fills
#   - After 10 seconds: animation should be fully smooth (all downloaded blocks pre-rendered)
# AROME HP1:
#   - Change variable (wind speed → wind direction): cache clears, re-renders correctly
# ARPEGE SP1:
#   - Each 12-hour block: all 12 frames pre-rendered after block downloads
#   - Animation across block boundaries: instant
# Single-file drop:
#   - Upload the test GRIB2 file → renders correctly (renderHeatmap path still works)
#   - Change palette → re-renders correctly
```

- [ ] **Step 3: Single atomic commit**

```bash
git add apps/visualize/render-worker.js apps/visualize/index.js
git commit -m "perf: offload pixel loop to Web Worker with per-variable bitmap cache

Moves renderHeatmap pixel loop to render-worker.js. showHour checks a
Map<hour, ImageBitmap> before rendering — cache hits are a single
drawImage call. prerenderBlock fills the cache in the background after
each file downloads. Cache is invalidated on variable, palette, or
package change. Revert this commit to restore the synchronous path."
```
