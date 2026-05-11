# Rendering Worker + Bitmap Cache — Design

**Date:** 2026-05-11

## Problem

`renderHeatmap()` runs on the main thread and iterates ~5 million pixels (AROME: 2801×1791) per forecast hour. On mobile this blocks the UI for several hundred milliseconds per frame, making animation laggy. On desktop (M4 Pro) it is imperceptible.

## Goal

Make animation fluid on mobile without reducing resolution. Each `showHour()` call for a cached frame must be essentially free (a single `drawImage` call). Rendering work moves off the main thread and is done proactively after each file download.

---

## Architecture

### Worker (`apps/visualize/render-worker.js`)

A dedicated Web Worker that owns the pixel loop. It receives all inputs needed to produce pixels, runs `renderHeatmap` logic, and returns an `ImageBitmap`.

**Message in (main → worker):**
```js
{
  gen: number,           // generation counter for stale-response detection
  values: Float64Array,  // transferred (zero-copy), not copied
  grid: { ni, nj, latitudeOfFirstPoint, longitudeOfFirstPoint, di, dj, jScansPositively },
  lut: Uint8Array,       // 256×3 RGB LUT, copied (small)
  min: number,
  max: number,
  logScale: boolean,
  logFloor: number,      // only relevant when logScale=true
  outW: number,          // canvas width  = grid.ni
  outH: number,          // canvas height = mercatorCanvasHeight(grid)
  zeroThreshold: number,
}
```

**Message out (worker → main):**
```js
{ gen: number, bitmap: ImageBitmap }
```

The worker calls `self.postMessage({ gen, bitmap }, [bitmap])` — `ImageBitmap` is transferable.

### Bitmap cache (main thread)

```js
let bitmapCache = new Map(); // hour (number) → ImageBitmap
let renderGen = 0;           // incremented on every variable/package change
```

The cache is **unbounded** — it grows as hours are visited or pre-rendered. It is cleared (and `renderGen` incremented) whenever:
- The user changes the variable (`arome-var-select`)
- The user changes the palette
- `resetModelState()` is called (package change, back button)

### Pre-rendering pipeline

After each file block is decoded, the main thread dispatches a background render for each hour in that block at the current variable:

```js
async function prerenderBlock(blockKey) {
  const hours = hoursInBlock(blockKey);
  for (const hour of hours) {
    if (bitmapCache.has(hour)) continue;
    const bitmap = await renderViaWorker(hour);  // awaits worker response
    if (bitmap) bitmapCache.set(hour, bitmap);
  }
}
```

Renders are sequential (one at a time) to avoid saturating mobile CPU. The `renderGen` guard inside `renderViaWorker` drops stale responses silently.

### showHour (updated)

```js
async function showHour(hour) {
  // ... existing decode/download logic ...

  if (bitmapCache.has(hour)) {
    ctx.drawImage(bitmapCache.get(hour), 0, 0);
    map.triggerRepaint();
    return;
  }

  // On-demand render (frame not yet pre-rendered)
  const bitmap = await renderViaWorker(hour);
  if (!bitmap) return; // stale generation, abort
  bitmapCache.set(hour, bitmap);
  ctx.drawImage(bitmap, 0, 0);
  map.triggerRepaint();
}
```

### renderViaWorker (main thread helper)

```js
function renderViaWorker(hour) {
  return new Promise((resolve) => {
    const myGen = renderGen;
    const { values, grid } = getCachedDecode(currentBlockKey(hour), hour, currentVarKey());
    if (!values) { resolve(null); return; }

    const lut = buildLUT(...);  // existing function
    const outW = grid.ni;
    const outH = mercatorCanvasHeight(grid);

    // Use a one-shot message listener keyed by gen to avoid conflicts between
    // concurrent pre-render and on-demand renders.
    function onMsg({ data }) {
      if (data.gen !== myGen) return; // not our response, leave for another listener
      worker.removeEventListener("message", onMsg);
      if (data.gen !== renderGen) { data.bitmap?.close(); resolve(null); return; }
      resolve(data.bitmap);
    }
    worker.addEventListener("message", onMsg);

    // Copy values into a new buffer for the worker — keeps the decode cache intact.
    // A Float64Array memcpy (~40 MB for AROME) is orders of magnitude cheaper than the render itself.
    const valuesCopy = values.slice();
    worker.postMessage({ gen: myGen, values: valuesCopy, grid, lut, min, max, ... }, [valuesCopy.buffer]);
  });
}
```

**Buffer strategy:** values are **copied** (`.slice()`) before posting to the worker, so the decode cache entry remains valid. The copy cost (~40 MB memcpy for AROME) is negligible compared to the pixel loop it replaces on the main thread.

---

## Files

| File | Change |
|------|--------|
| `apps/visualize/render-worker.js` | New file — contains the pixel loop (extracted from `renderHeatmap`) |
| `apps/visualize/index.js` | Worker setup, `renderViaWorker`, `prerenderBlock`, updated `showHour`, cache invalidation |

---

## Stale response handling

`renderGen` is a module-level integer, incremented on every state reset. Each render job captures `myGen` at dispatch time. When the worker responds, `data.gen !== renderGen` means the variable or package changed while the render was in flight — the bitmap is closed (freeing GPU memory) and the promise resolves `null`.

---

## Memory

- Each AROME bitmap: 2801 × 1791 × 4 bytes ≈ 19 MB (GPU VRAM / unified memory)
- All 51 AROME hours pre-rendered: ≈ 970 MB — acceptable trade-off for full fluidity
- Cache is cleared on variable/palette/package change, freeing all bitmaps

## Commit strategy

All changes are in a single atomic commit so the feature can be reverted cleanly with `git revert` if memory pressure causes issues on specific devices.
