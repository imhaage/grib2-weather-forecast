# Mobile Performance Notes

## Optimization Checklist

- [x] Hide `#map-scene` until all files are downloaded.
- [x] Replace global block pre-rendering with a single render queue.
- [x] Reduce decoded value retention (`DECODED_CACHE_SIZE = 2`).
- [x] Stop keeping copied message buffers in `messageIndex`.
- [ ] Bound the `ImageBitmap` cache.
- [ ] Pre-render a sliding window instead of the full run.
- [ ] Avoid worker `values.slice()` when ownership is clear.
- [ ] Consider `Float32Array` for display values.
- [ ] Move stats and transforms to one owned pipeline.
- [ ] Add lightweight runtime diagnostics.

## Context

This project is an experiment and a technical showcase: a browser-native GRIB2
decoder and weather visualizer built by AI coding agents. It is not currently a
consumer product. The main expected users are curious developers, weather data
users, and scientists who want to inspect GRIB2 files quickly before using more
specialized tools.

The target is not low-end phone support. The near-term goal is a smooth enough
experience on mid-range mobile devices while preserving accurate data and a
responsive interface.

## Current Symptom

The first selected parameter usually renders correctly once the relevant files
are available. The failure appears when changing the selected parameter or the
color scale on mobile: the UI can remain on the spinner indefinitely.

This points to memory pressure, stalled work, or stale async render state rather
than a basic decode failure. Desktop machines with large unified memory can hide
the problem, but mobile browsers are much less forgiving.

## Current Rendering Model

The online player downloads GRIB2 blocks, decodes selected messages with
`decodeGRIB2()`, renders heatmaps in `apps/visualize/render-worker.js`, and
caches rendered `ImageBitmap` entries in `bitmapCache`.

Keeping an `ImageBitmap` cache is still a good direction because cache hits make
animation cheap: the visible frame becomes a `drawImage()` call instead of a
full pixel loop. The problem is the cache policy and the surrounding memory
costs.

Approximate AROME memory costs:

- One decoded field as `Float64Array`: about 40 MB.
- One full-resolution RGBA bitmap: about 19 MB.
- 51 cached AROME bitmaps: about 970 MB.
- Downloaded GRIB2 buffers, copied message buffers, worker transfer copies, and
  temporary `ImageData` objects add more pressure.

## UX Adjustment

For now, hide `#map-scene` while the model files are still downloading. Show it
only when all files for the selected package have been downloaded.

This keeps the experience simpler and avoids showing a map that may be only
partially interactive. It also gives us a cleaner performance baseline: first
download, then decode and render.

## Suspected Hot Spots

1. Unbounded `ImageBitmap` cache

   `bitmapCache` can grow to all forecast hours for the current variable and
   palette. This is probably the largest memory issue.

2. Parallel pre-rendering after variable or palette changes

   The app currently starts `prerenderBlock()` for all downloaded blocks with
   `Promise.all(...)`. Each block renders sequentially internally, but several
   blocks can render at the same time. That can multiply decode, worker, bitmap,
   and temporary buffer pressure.

3. Message copies in `iterateGRIB2Messages()`

   The iterator yields non-copying message views plus message offsets. The web
   app stores `{ blockKey, offset, length }` in `messageIndex`, while the
   original downloaded block buffer remains the single owner of the bytes.

4. Decoded value cache

   `DECODED_CACHE_SIZE = 2` can retain two large `Float64Array` objects.
   This improves decode reuse, but it competes directly with the bitmap cache.

5. Worker input copies

   `renderViaWorker()` calls `values.slice()` before transferring to the worker.
   This preserves the decode cache entry, but briefly doubles the values memory
   for each render.

6. Duplicate value transforms and render paths

   Unit conversion and render logic are split between the main thread and the
   worker. This makes it harder to reason about memory ownership and stale
   render cancellation.

## Incremental Optimization Plan

Apply and test these changes one by one. Stop when the mobile experience is good
enough, rather than chasing a perfect architecture.

### 1. Hide `#map-scene` until all files are downloaded

Goal: remove partial-render edge cases during download and make the loading
state easier to reason about.

Expected effect: better UX consistency, not a major memory reduction.

Validation:

- Start AROME and ARPEGE packages.
- Confirm `#map-scene` appears only after all package files are downloaded.
- Confirm the first selected parameter renders after download completion.

### 2. Replace global block pre-rendering with a single render queue

Goal: guarantee at most one expensive render job at a time across the whole
player.

Approach:

- Replace `Promise.all([...buffers].map(prerenderBlock))` with one queue.
- Prioritize the current hour.
- Then render nearby hours around the current slider position.
- Drop queued jobs when `renderGen` changes.

Expected effect: lower CPU spikes and lower temporary memory pressure.

### 3. Bound the `ImageBitmap` cache

Goal: keep the benefit of bitmap cache hits without keeping every forecast hour
in memory.

Approach:

- Use an LRU cache for `ImageBitmap` entries.
- Start with a small mobile-friendly size such as 8 to 12 bitmaps.
- Optionally use a larger desktop size when memory looks sufficient.
- Always call `bitmap.close()` on eviction.

Expected effect: the largest immediate memory reduction while keeping smooth
animation near the current hour.

### 4. Pre-render a sliding window, not the full run

Goal: make playback smooth where the user is likely to go next.

Approach:

- Render current hour first.
- Then pre-render `idx + 1`, `idx + 2`, `idx - 1`, `idx + 3`, etc.
- When the slider moves, reprioritize the queue.
- Avoid pre-rendering hours far away from the current position.

Expected effect: good perceived performance with bounded memory.

### 5. Stop keeping copied message buffers in `messageIndex` — done

Goal: avoid storing copied GRIB2 messages for every variable and hour.

Approach:

- `iterateGRIB2Messages()` yields message offsets, lengths, and a non-copying
  `subarray()` view.
- `messageIndex` stores `{ blockKey, offset, length }` instead of `msg.buffer`.
- `getCachedDecode()` resolves the reference into a `subarray()` view only when
  decoding is needed.

Expected effect: lower baseline memory after indexing blocks.

Validation:

- `decodeGRIB2()` has a regression test covering non-zero `byteOffset` views.
- `iterateGRIB2Messages()` has a regression test ensuring yielded message
  buffers share the original `ArrayBuffer`.

### 6. Reduce decoded value retention

Goal: let `ImageBitmap` be the main playback cache and keep fewer decoded value
arrays.

Approach:

- Keep `DECODED_CACHE_SIZE` low while bitmap caching is active.
- Consider caching only current and previous decoded fields for accumulation
  variables.
- For non-accumulation variables, release decoded values once the bitmap and
  tooltip strategy are handled.

Expected effect: lower retained `Float64Array` memory.

Open question:

- Tooltips currently need values for the visible field. We need at least the
  current field available, but probably not five fields.

### 7. Avoid worker `values.slice()` when ownership is clear

Goal: remove a large temporary copy per render.

Approach:

- For renders where the decoded values will not be reused, transfer the buffer
  directly to the worker.
- For current-hour tooltip support, keep current values on the main thread.
- For background pre-render jobs, prefer transfer-only ownership.

Expected effect: lower peak memory during pre-rendering.

Risk:

- Transferring detaches the source buffer, so ownership must be explicit.

### 8. Consider `Float32Array` for display values

Goal: halve value memory where full `Float64Array` precision is unnecessary for
display rendering.

Approach:

- Keep decoder output as-is for correctness.
- Convert display/render values to `Float32Array` only after physical decoding
  and unit conversion.
- Keep exact raw values only where needed for tooltip and export-style use cases.

Expected effect: lower display pipeline memory.

Risk:

- Tooltips and scientific inspection may expect accurate values. This should be
  measured before adopting broadly.

### 9. Move stats and transforms to one owned pipeline

Goal: reduce duplicate loops and make cancellation easier.

Approach:

- Let one worker job handle unit transform, stats, and bitmap generation.
- Keep the main thread responsible for UI state and cache policy only.
- Make every worker response keyed by `callId` and `renderGen`.

Expected effect: simpler ownership, fewer repeated loops, fewer stale results.

### 10. Add lightweight runtime diagnostics

Goal: make performance work observable without requiring deep profiling.

Approach:

- Log render queue length, cache size, bitmap count, decoded cache size, and
  render timings in a debug mode.
- Add a visible debug panel only when enabled by a query parameter such as
  `?debug=perf`.

Expected effect: faster iteration on real mobile devices.

## Success Criteria

- Changing parameter or color scale never leaves the app on an infinite spinner.
- On a mid-range mobile device, changing parameter completes without a browser
  tab reload or memory crash.
- Animation is smooth near the current hour after a short warm-up.
- Data values remain precise enough for scientific inspection in the tooltip.
- The `ImageBitmap` cache remains part of the design, but with a bounded and
  observable memory footprint.

## DRY Issues To Address Before Refactoring

- Unit conversion logic is duplicated between `unitFnFor()` in `index.js` and
  `applyUnit()` in `render-worker.js`.
- The Mercator row mapping and pixel normalization logic exist in both
  `renderHeatmap()` and `render-worker.js`.
- Variable metadata is spread across `PACKAGES`, `PARAM_DESCRIPTIONS`,
  `STATIC_SCALES`, and `VARIABLE_PALETTES`.

These are worth cleaning up only when they directly support the mobile
performance work. The immediate priority is reducing memory pressure and making
render cancellation reliable.
