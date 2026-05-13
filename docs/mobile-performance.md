# Mobile Performance Notes

## Optimization Checklist

- [x] Show `#map-scene` when the first file is available.
- [x] Replace global block pre-rendering with a single render queue.
- [x] Reduce decoded value retention (`DECODED_CACHE_SIZE = 2`).
- [x] Stop keeping copied message buffers in `messageIndex`.
- [x] Keep the full `ImageBitmap` cache when the device can hold it.
- [x] Drop sliding-window pre-rendering while the full cache works well.
- [x] Avoid worker `values.slice()` when ownership is clear.
- [x] Consider `Float32Array` for display values.
- [x] Use cached `ImageBitmap` entries before decoding values.
- [x] Lazy-decode tooltip values after cached bitmap display.
- [x] Warm the full bitmap cache before starting animation playback.
- [x] Move stats and transforms to one owned pipeline.
- [x] Add lightweight runtime diagnostics.
- [x] Limit model file downloads to 6 parallel fetches.
- [x] Cache downloaded GRIB2 blocks in IndexedDB by file run.
- [x] Display stale cached files while newer files download.

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

The online player downloads GRIB2 blocks with at most 6 parallel fetches,
caches downloaded block bytes in IndexedDB by file run, decodes selected
messages with `decodeGRIB2()`, renders heatmaps in
`apps/visualize/render-worker.js`, and caches rendered `ImageBitmap` entries in
`bitmapCache`.

IndexedDB is currently used to avoid re-downloading the same remote files after
a refresh and to display the latest cached version of each logical file while a
newer remote version downloads. It does not yet reduce in-session RAM usage
because cache hits still fill `modelState.buffers` before rendering.

Keeping an `ImageBitmap` cache is still a good direction because cache hits make
animation cheap: the visible frame becomes a `drawImage()` call instead of a
full pixel loop. The problem is the cache policy and the surrounding memory
costs.

For now, the player intentionally keeps the full `ImageBitmap` cache instead of
using an LRU limit. If the device can hold the cache, every timestamp can be
shown instantly during animation or manual slider movement, and the code stays
much simpler.

Cache hits must be checked before decoding values. Otherwise playback can still
decode and downcast fields even when the rendered bitmap already exists, which
keeps slider and animation interactions expensive. Tooltip values are hydrated
after cached bitmap display, and skipped during playback to keep animation
smooth.

Animation playback now waits for the full bitmap cache to be warm before it
starts. A small progress bar between the slider and map shows `bitmapCache`
readiness, which makes the first playback predictable and helps debug cache
generation on mobile devices.

Approximate AROME memory costs:

- One decoded field as `Float64Array`: about 40 MB.
- One full-resolution RGBA bitmap: about 19 MB.
- 51 cached AROME bitmaps: about 970 MB.
- Downloaded GRIB2 buffers, copied message buffers, worker transfer copies, and
  temporary `ImageData` objects add more pressure.

## UX Adjustment

For now, hide `#map-scene` only while no model file is available. Show it as
soon as at least one block is available from exact cache, stale cache, or
network download.

The slider keeps the full known forecast range. If the selected hour has no
available block, clear the heatmap and show a `Data not available yet` state
instead of keeping the previous frame visible. A collapsible data status panel
tracks file states: missing, loaded from cache, downloading, and ready.

## Suspected Hot Spots

1. Full `ImageBitmap` cache

   `bitmapCache` can grow to all forecast hours for the current variable and
   palette. This is intentionally accepted for now because it gives instant
   replay when the browser can hold the bitmaps. Revisit this only if real
   devices still crash or evict aggressively.

2. Cache warm-up after variable or palette changes

   The app uses a single render queue, but the cache can still be incomplete
   when the user first presses Play. Playback now waits for the queue to finish
   and shows progress before starting the animation.

3. Message copies in `iterateGRIB2Messages()`

   The iterator yields non-copying message views plus message offsets. The web
   app stores `{ blockKey, offset, length }` in `messageIndex`, while the
   original downloaded block buffer remains the single owner of the bytes.

4. Decoded value cache

   `DECODED_CACHE_SIZE = 2` can retain two large `Float64Array` objects.
   This improves decode reuse, but it competes directly with the bitmap cache.

5. Worker input copies

   `renderViaWorker()` copies values by default to preserve current-field
   tooltip ownership, but background pre-rendering can transfer owned values
   directly when they are safe to detach.

6. Duplicate value transforms

   Heatmap unit transforms, stats, and bitmap generation now run through the
   worker for both model data and uploaded files. Unit conversion still exists
   on the main thread for tooltip display, so `unitFnFor()` and worker
   `applyUnit()` should eventually share metadata or a helper.

## Incremental Optimization Plan

Apply and test these changes one by one. Stop when the mobile experience is good
enough, rather than chasing a perfect architecture.

### 1. Show `#map-scene` when the first file is available

Goal: avoid a blank app while cached or partially downloaded data is already
usable.

Expected effect: faster perceived startup and a clearer progressive loading
model.

Validation:

- Start AROME and ARPEGE packages.
- Confirm `#map-scene` appears after the first exact cache hit, stale cache hit,
  or network download.
- Confirm selecting an unavailable hour clears the heatmap instead of retaining
  the previous frame.

### 2. Replace global block pre-rendering with a single render queue

Goal: guarantee at most one expensive render job at a time across the whole
player.

Approach:

- Replace `Promise.all([...buffers].map(prerenderBlock))` with one queue.
- Prioritize the current hour.
- Then render nearby hours around the current slider position.
- Drop queued jobs when `renderGen` changes.

Expected effect: lower CPU spikes and lower temporary memory pressure.

### 3. Bound the `ImageBitmap` cache — not planned for now

Decision: do not bound the bitmap cache while the full cache works on target
devices.

Rationale:

- A complete `ImageBitmap` cache makes every timestamp instant after warm-up.
- It keeps animation and manual slider movement simple and predictable.
- It keeps the code much simpler than an LRU or adaptive cache.

Revisit only if real mobile devices still crash, reload the tab, or evict
bitmaps aggressively.

### 4. Pre-render a sliding window, not the full run — dropped

Decision: keep pre-rendering the full run.

Rationale:

- The full cache now works well enough on the target mobile device.
- Playback waits for the full warm-up before starting, so the first animation
  loop is smooth instead of filling cache on demand.
- Manual slider movement benefits from any timestamp being instantly available.

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

### 7. Avoid worker `values.slice()` when ownership is clear — done

Goal: remove a large temporary copy per render.

Approach:

- `renderViaWorker()` accepts `{ transferValues }`.
- Current-hour renders keep copying so tooltip values remain available.
- Background pre-render jobs transfer owned values when they are not the current
  hour and do not break accumulation dependencies.

Expected effect: lower peak memory during pre-rendering.

Risk:

- Transferring detaches the source buffer, so ownership must be explicit.

### 8. Consider `Float32Array` for display values — done

Goal: halve value memory where full `Float64Array` precision is unnecessary for
display rendering.

Approach:

- Keep decoder output as-is for correctness.
- Convert model display/render values to `Float32Array` after physical decoding.
- Allocate accumulation diffs directly as `Float32Array`.
- Keep decoded cache entries as `Float64Array`, so decoder correctness and future
  export-style workflows are not coupled to the display pipeline.

Expected effect: lower display pipeline memory.

Risk:

- Tooltips now read display `Float32Array` values. This is expected to be
  precise enough for map inspection, but should be measured with real scientific
  use cases before adopting more broadly.

### 9. Move stats and transforms to one owned pipeline

Status: done.

Goal: reduce duplicate loops and make cancellation easier.

Approach:

- One worker job handles unit transform, stats, and bitmap generation.
- The main thread prepares render parameters, UI state, cache policy, and
  tooltip state.
- Model data and uploaded files both use the worker render path.
- `renderHeatmap()` was removed from `index.js`.

Expected effect: simpler ownership, fewer repeated loops, fewer stale results.

Validation: confirmed smooth in the current target browser/mobile workflow after
the uploaded-file path was moved to the worker render pipeline.

### 10. Add lightweight runtime diagnostics

Status: done.

Goal: make performance work observable without requiring deep profiling.

Approach:

- Add a visible debug panel only when enabled by `?debug=perf`.
- Show worker render time, decode time, queue length, bitmap cache progress,
  decoded cache size, and render generation.
- Keep the normal UI unchanged when the query parameter is absent.

Expected effect: faster iteration on real mobile devices.

## Success Criteria

- Changing parameter or color scale never leaves the app on an infinite spinner.
- On a mid-range mobile device, changing parameter completes without a browser
  tab reload or memory crash.
- Animation is smooth across the full run after a short warm-up.
- Data values remain precise enough for scientific inspection in the tooltip.
- The full `ImageBitmap` cache remains part of the design and is observable via
  the warm-up progress indicator.

## DRY Issues To Address Before Refactoring

- Unit conversion logic is still duplicated between `unitFnFor()` in `index.js`
  and `applyUnit()` in `render-worker.js`. The main thread currently needs it
  for tooltip display, while the worker needs it for bitmap and stats
  generation.
- Variable metadata is spread across `PACKAGES`, `PARAM_DESCRIPTIONS`,
  `STATIC_SCALES`, and `VARIABLE_PALETTES`.

These are worth cleaning up only when they directly support the mobile
performance work. The immediate priority is reducing memory pressure and making
render cancellation reliable.
