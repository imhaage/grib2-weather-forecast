# Wind Flow Particles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a derived `Wind flow (10m)` AROME SP1 weather map with a Viridis wind-speed heatmap and animated wind particles.

**Architecture:** `Wind flow (10m)` is a derived variable backed by SP1 `u` and `v` messages for the current forecast hour. The model-block worker decodes both fields and renders the derived speed heatmap; the main thread owns MapLibre integration, tooltip formatting, and the particle layer lifecycle. The first prototype intentionally skips bitmap animation cache generation for this derived field and disables timeline playback.

**Tech Stack:** Vanilla JS modules, Vitest, Biome, MapLibre GL JS custom layer, existing model block worker, existing GRIB2 decoder.

---

## File Map

- `docs/superpowers/specs/2026-05-28-wind-particles-design.md`
  - Source of truth for product/UX decisions.
- `apps/visualize/src/domain/model-packages.js`
  - Add `Wind flow (10m)` to `AROME_SP1` `Weather maps`.
- `apps/visualize/src/domain/variable-metadata.js`
  - Add metadata, default palette, and static scale for the derived variable.
- `apps/visualize/src/domain/wind-flow-derived-field.js`
  - New pure module for speed, direction, cardinal, arrow, and tooltip formatting.
- `apps/visualize/src/domain/wind-flow-derived-field.test.js`
  - Unit tests for derived wind math.
- `apps/visualize/model-block-worker.js`
  - Add worker path for decoding `u` + `v`, computing derived speed, and rendering the bitmap.
- `apps/visualize/src/services/model-block-service.js`
  - Add a typed client method for derived wind-flow rendering.
- `apps/visualize/src/domain/wind-particle-state.js`
  - New pure module for particle arrays, respawn, aging, and step updates.
- `apps/visualize/src/domain/wind-particle-state.test.js`
  - Unit tests for deterministic particle state updates.
- `apps/visualize/src/domain/wind-field-sampler.js`
  - New pure module for grid sampling, initially nearest-neighbor, with an isolated bilinear upgrade path.
- `apps/visualize/src/domain/wind-field-sampler.test.js`
  - Unit tests for grid sampling and missing-data behavior.
- `apps/visualize/src/services/wind-particle-layer-service.js`
  - New MapLibre custom layer service.
- `apps/visualize/src/services/map-renderer-service.js`
  - Mount/unmount/pause/reset the particle layer beside existing map layers.
- `apps/visualize/map-tooltip.js`
  - Let grid state provide a custom tooltip formatter.
- `apps/visualize/index.js`
  - Wire derived variable selection, current-hour loading, disabled Play behavior, slider loading/reset, and particle layer updates.
- `apps/visualize/src/ui/*`
  - Add targeted tests where behavior is already extracted enough; avoid brittle style assertions.

---

## Progress

- [x] **Task 0: Group home parameters**
  - Commit: `5fb10a2 feat: group home parameters`
  - Outcome: home package cards now display `Weather maps` before `Component fields`, with HP1 condensed lines preserved.

- [ ] **Task 1: Commit updated spec and this plan**
- [ ] **Task 2: Add derived wind-flow metadata**
- [ ] **Task 3: Add pure wind-flow math helpers**
- [ ] **Task 4: Add worker rendering for current-hour wind flow**
- [ ] **Task 5: Add rich tooltip support for derived wind flow**
- [ ] **Task 6: Disable timeline playback and animation cache for wind flow**
- [ ] **Task 7: Add wind field sampler and particle state modules**
- [ ] **Task 8: Add MapLibre custom particle layer service**
- [ ] **Task 9: Wire particles into map renderer and forecast route**
- [ ] **Task 10: Manual browser verification and tuning**

---

### Task 1: Commit Updated Spec And Plan

**Files:**
- Modify: `docs/superpowers/specs/2026-05-28-wind-particles-design.md`
- Create: `docs/superpowers/plans/2026-05-28-wind-flow-particles.md`

- [ ] **Step 1: Review docs diff**

Run:

```bash
git diff -- docs/superpowers/specs/2026-05-28-wind-particles-design.md docs/superpowers/plans/2026-05-28-wind-flow-particles.md
```

Expected: diff only contains the spec update from HP1 speed/direction to SP1 U/V `Wind flow`, plus this plan.

- [ ] **Step 2: Commit docs**

Run:

```bash
git add docs/superpowers/specs/2026-05-28-wind-particles-design.md docs/superpowers/plans/2026-05-28-wind-flow-particles.md
git commit -m "docs: plan wind flow particles"
```

Expected: one docs commit, no app code included.

---

### Task 2: Add Derived Wind-Flow Metadata

**Files:**
- Modify: `apps/visualize/src/domain/model-packages.js`
- Modify: `apps/visualize/src/domain/model-packages.test.js`
- Modify: `apps/visualize/src/domain/variable-metadata.js`
- Modify: `apps/visualize/src/domain/variable-metadata.test.js`

- [ ] **Step 1: Write failing package metadata test**

In `apps/visualize/src/domain/model-packages.test.js`, update the AROME SP1 expected list so `Wind flow (10m)` appears after `Relative humidity (2m)` in `Weather maps`:

```js
{ name: "Wind flow (10m)", group: "Weather maps" },
```

Expected AROME SP1 order:

```js
[
  { name: "Temperature (2m)", group: "Weather maps" },
  { name: "Relative humidity (2m)", group: "Weather maps" },
  { name: "Wind flow (10m)", group: "Weather maps" },
  { name: "U (wind, 10m)", group: "Component fields" },
  { name: "V (wind, 10m)", group: "Component fields" },
  { name: "U (wind gust, 10m)", group: "Component fields" },
  { name: "V (wind gust, 10m)", group: "Component fields" },
]
```

- [ ] **Step 2: Write failing variable metadata test**

In `apps/visualize/src/domain/variable-metadata.test.js`, add expectations:

```js
expect(defaultPaletteFor("wind_flow_10")).toBe("Viridis");
expect(staticScaleFor("wind_flow_10")).toEqual({ min: 0, max: 160 });
expect(parameterDescriptionFor("wind_flow_10")).toMatch(/particles show the flow direction/);
```

- [ ] **Step 3: Run tests and verify red**

Run:

```bash
npm run test:domain -w visualize -- model-packages.test.js variable-metadata.test.js
```

Expected: fail because `Wind flow (10m)` and `wind_flow_10` metadata do not exist yet.

- [ ] **Step 4: Add derived variable config**

In `apps/visualize/src/domain/model-packages.js`, add this variable after relative humidity in `AROME_SP1.variables`:

```js
{
  shortName: "wind_flow_10",
  varKey: "wind_flow_10",
  name: "Wind flow (10m)",
  units: "km/h",
  level: "10 m above ground",
  group: "Weather maps",
  derived: {
    type: "windFlow",
    u: { shortName: "u", levelValue: null },
    v: { shortName: "v", levelValue: null },
  },
},
```

In `apps/visualize/src/domain/variable-metadata.js`, add:

```js
wind_flow_10: {
  description:
    "Derived 10 m wind map computed from U and V components. The heatmap shows wind speed in km/h; particles show the flow direction.",
  defaultPalette: "Viridis",
  staticScale: { min: 0, max: 160 },
},
```

- [ ] **Step 5: Run tests and check**

Run:

```bash
npm run test:domain -w visualize -- model-packages.test.js variable-metadata.test.js
npm run check -w visualize
```

Expected: tests and Biome pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/visualize/src/domain/model-packages.js apps/visualize/src/domain/model-packages.test.js apps/visualize/src/domain/variable-metadata.js apps/visualize/src/domain/variable-metadata.test.js
git commit -m "feat: add wind flow metadata"
```

---

### Task 3: Add Pure Wind-Flow Math Helpers

**Files:**
- Create: `apps/visualize/src/domain/wind-flow-derived-field.js`
- Create: `apps/visualize/src/domain/wind-flow-derived-field.test.js`

- [ ] **Step 1: Write failing tests**

Create `apps/visualize/src/domain/wind-flow-derived-field.test.js`:

```js
import { describe, expect, test } from "vitest";
import {
  cardinal8ForDegrees,
  directionDegreesFromUV,
  directionSymbolForDegrees,
  formatWindFlowTooltip,
  windSpeedKmhFromUV,
} from "./wind-flow-derived-field.js";

describe("wind flow derived field", () => {
  test("computes speed in km/h from U/V m/s components", () => {
    expect(windSpeedKmhFromUV(3, 4)).toBeCloseTo(18, 6);
  });

  test("computes geographic flow direction from U/V components", () => {
    expect(directionDegreesFromUV(0, 1)).toBe(0);
    expect(directionDegreesFromUV(1, 0)).toBe(90);
    expect(directionDegreesFromUV(0, -1)).toBe(180);
    expect(directionDegreesFromUV(-1, 0)).toBe(270);
  });

  test("formats direction as unicode arrow and 8-point cardinal", () => {
    expect(directionSymbolForDegrees(0)).toBe("↑");
    expect(directionSymbolForDegrees(90)).toBe("→");
    expect(directionSymbolForDegrees(225)).toBe("↙");
    expect(cardinal8ForDegrees(225)).toBe("SW");
  });

  test("formats rich wind flow tooltip without degrees", () => {
    expect(formatWindFlowTooltip({ u: -3, v: -3 })).toBe("15.3 km/h ↙ SW");
  });
});
```

- [ ] **Step 2: Run tests and verify red**

Run:

```bash
npm run test:domain -w visualize -- wind-flow-derived-field.test.js
```

Expected: fail because the module does not exist.

- [ ] **Step 3: Implement helpers**

Create `apps/visualize/src/domain/wind-flow-derived-field.js`:

```js
const ARROWS_8 = ["↑", "↗", "→", "↘", "↓", "↙", "←", "↖"];
const CARDINALS_8 = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];

function normalizedDegrees(degrees) {
  return ((degrees % 360) + 360) % 360;
}

function directionIndex8(degrees) {
  return Math.round(normalizedDegrees(degrees) / 45) % 8;
}

export function windSpeedKmhFromUV(u, v) {
  return Math.hypot(u, v) * 3.6;
}

export function directionDegreesFromUV(u, v) {
  if (u === 0 && v === 0) return 0;
  return normalizedDegrees((Math.atan2(u, v) * 180) / Math.PI);
}

export function directionSymbolForDegrees(degrees) {
  return ARROWS_8[directionIndex8(degrees)];
}

export function cardinal8ForDegrees(degrees) {
  return CARDINALS_8[directionIndex8(degrees)];
}

export function formatWindFlowTooltip({ u, v }) {
  const speed = windSpeedKmhFromUV(u, v);
  const direction = directionDegreesFromUV(u, v);
  return `${speed.toFixed(1)} km/h ${directionSymbolForDegrees(direction)} ${cardinal8ForDegrees(direction)}`;
}
```

- [ ] **Step 4: Run tests and check**

Run:

```bash
npm run test:domain -w visualize -- wind-flow-derived-field.test.js
npm run check -w visualize
```

Expected: tests and Biome pass.

- [ ] **Step 5: Commit**

Run:

```bash
git add apps/visualize/src/domain/wind-flow-derived-field.js apps/visualize/src/domain/wind-flow-derived-field.test.js
git commit -m "feat: add wind flow helpers"
```

---

### Task 4: Add Worker Rendering For Current-Hour Wind Flow

**Files:**
- Modify: `apps/visualize/model-block-worker.js`
- Modify: `apps/visualize/src/services/model-block-service.js`
- Add or modify worker/client tests if a local worker-client test already exists; otherwise cover via domain tests and manual run.

- [ ] **Step 1: Add worker helper functions**

In `apps/visualize/model-block-worker.js`, import:

```js
import { windSpeedKmhFromUV } from "./src/domain/wind-flow-derived-field.js";
```

Add a `decodeMessageValues` helper:

```js
async function decodeMessageValues(blockKey, block, hour, variable) {
  const message = findMessage(blockKey, block, hour, variable);
  if (!message) return null;
  const decoded = await decodeGRIB2(message.buffer);
  return {
    values: toDisplayValues(decoded.values),
    grid: decoded.grid,
    product: decoded.product,
    header: decoded.header,
  };
}
```

- [ ] **Step 2: Add derived speed builder**

In `apps/visualize/model-block-worker.js`, add:

```js
function computeWindFlowValues(uValues, vValues, missingValue) {
  const speedValues = new Float32Array(uValues.length);
  for (let i = 0; i < uValues.length; i++) {
    const u = uValues[i];
    const v = vValues[i];
    speedValues[i] =
      u <= missingValue || v <= missingValue
        ? missingValue
        : windSpeedKmhFromUV(u, v);
  }
  return speedValues;
}
```

- [ ] **Step 3: Add `renderWindFlowHour` worker message**

In `apps/visualize/model-block-worker.js`, add a function shaped like `renderHour(data)` but using decoded `u` and `v`:

```js
async function renderWindFlowHour(data) {
  const {
    blockKey,
    block,
    hour,
    windFlow,
    missingValue,
  } = data;
  const uDecoded = await decodeMessageValues(blockKey, block, hour, windFlow.u);
  const vDecoded = await decodeMessageValues(blockKey, block, hour, windFlow.v);
  if (!uDecoded || !vDecoded) return null;

  const values = computeWindFlowValues(uDecoded.values, vDecoded.values, missingValue);
  return renderDecodedValues({
    ...data,
    decoded: {
      values,
      grid: uDecoded.grid,
      product: {
        ...uDecoded.product,
        shortName: "wind_flow_10",
        name: "Wind flow (10m)",
        units: "km/h",
      },
      header: uDecoded.header,
      displayUnits: "km/h",
      isFallback: false,
    },
    extraTransferValues: {
      windUValues: uDecoded.values,
      windVValues: vDecoded.values,
    },
  });
}
```

Implementation note: this step requires extracting the common bitmap loop from `renderHour(data)` into a shared `renderDecodedValues({ ... })` helper so normal scalar rendering and derived wind-flow rendering stay DRY.

- [ ] **Step 4: Add service method**

In `apps/visualize/src/services/model-block-service.js`, add:

```js
renderWindFlowHour(request) {
  return client.post({
    ...request,
    type: "renderWindFlowHour",
  }, [request.lut.buffer]);
},
```

- [ ] **Step 5: Run tests and check**

Run:

```bash
npm test -w visualize
npm run check -w visualize
```

Expected: tests and Biome pass. If no worker test exists, this task must also be manually checked through the app once Task 6 wires the route.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/visualize/model-block-worker.js apps/visualize/src/services/model-block-service.js
git commit -m "feat: render wind flow in worker"
```

---

### Task 5: Add Rich Tooltip Support For Derived Wind Flow

**Files:**
- Modify: `apps/visualize/map-tooltip.js`
- Modify: `apps/visualize/index.js`
- Test: add focused tests only if tooltip behavior has a test harness; otherwise cover `formatWindFlowTooltip` in Task 3 and verify manually.

- [ ] **Step 1: Update tooltip contract**

In `apps/visualize/map-tooltip.js`, after computing `idx`, before the generic raw value formatting, add:

```js
if (gridState.tooltipValueAt) {
  const text = gridState.tooltipValueAt(idx);
  if (!text) {
    hideTooltip("default");
    return;
  }
  mapCanvas.style.cursor = "crosshair";
  tooltipEl.hidden = false;
  tooltipEl.textContent = text;
  const rect = wrapEl.getBoundingClientRect();
  tooltipEl.style.left = `${e.originalEvent.clientX - rect.left + 14}px`;
  tooltipEl.style.top = `${e.originalEvent.clientY - rect.top - 36}px`;
  return;
}
```

- [ ] **Step 2: Add wind-flow tooltip state**

In `apps/visualize/index.js`, when presenting a wind-flow result, set `gridState.tooltipValueAt` to a function that reads `windUValues[idx]` and `windVValues[idx]` and returns:

```js
formatWindFlowTooltip({ u, v })
```

Return `null` if either value is missing.

- [ ] **Step 3: Run tests and check**

Run:

```bash
npm test -w visualize
npm run check -w visualize
```

Expected: tests and Biome pass.

- [ ] **Step 4: Commit**

Run:

```bash
git add apps/visualize/map-tooltip.js apps/visualize/index.js
git commit -m "feat: format wind flow tooltip"
```

---

### Task 6: Disable Timeline Playback And Animation Cache For Wind Flow

**Files:**
- Modify: `apps/visualize/index.js`
- Modify or add UI tests if playback state is covered in existing tests.

- [ ] **Step 1: Add derived variable guard**

In `apps/visualize/index.js`, add:

```js
const WIND_FLOW_VARIABLE = "wind_flow_10";

function isWindFlowVariable(variable = modelState?.variable) {
  return variable === WIND_FLOW_VARIABLE;
}
```

- [ ] **Step 2: Disable Play button for Wind flow**

Where forecast variable changes or hour presentation updates controls, set:

```js
dom.playBtn.disabled = isWindFlowVariable();
dom.playBtn.title = isWindFlowVariable()
  ? "Wind flow uses live particles instead of timeline playback"
  : "";
```

If `animationPlayer.isPlaying()` and `Wind flow` is selected, stop playback immediately.

- [ ] **Step 3: Skip animation cache generation for Wind flow**

Guard these paths:

```js
function queuePrerenderForAllBlocks() {
  if (!modelState || isWindFlowVariable()) return;
  ...
}
```

And in `showHour(idx)`, do not read/write `animationCache` for `Wind flow`.

- [ ] **Step 4: Route Wind flow to worker method**

Add a request builder for wind flow:

```js
function windFlowWorkerRequestForHour(idx, hour) {
  const block = blockForHour(hour);
  if (!block || !modelState.buffers.has(block.key)) return null;
  const staticScale = staticScaleFor(WIND_FLOW_VARIABLE);
  return {
    type: "renderWindFlowHour",
    gen: renderGen,
    blockKey: block.key,
    block,
    hour,
    windFlow: {
      u: { shortName: "u", levelValue: null },
      v: { shortName: "v", levelValue: null },
    },
    staticScale,
    renderMin: staticScale.min,
    range: staticScale.max - staticScale.min,
    isLog: false,
    logFloor: LOG_SCALE_FLOOR,
    logDenom: 1,
    zeroThreshold: 0,
    displayUnits: "km/h",
    lut: buildLUT(currentPalette, { min: staticScale.min, max: staticScale.max }),
    missingValue: MISSING_VALUE,
  };
}
```

- [ ] **Step 5: Show loading state on slider changes**

When `Wind flow` hour changes:

- clear the current heatmap layer;
- hide particles;
- show the existing loading/unavailable state until `u/v` are decoded;
- never keep previous-hour data visible under the new valid time.

- [ ] **Step 6: Run tests and check**

Run:

```bash
npm test -w visualize
npm run check -w visualize
```

Expected: tests and Biome pass.

- [ ] **Step 7: Commit**

Run:

```bash
git add apps/visualize/index.js
git commit -m "feat: handle wind flow playback"
```

---

### Task 7: Add Wind Field Sampler And Particle State Modules

**Files:**
- Create: `apps/visualize/src/domain/wind-field-sampler.js`
- Create: `apps/visualize/src/domain/wind-field-sampler.test.js`
- Create: `apps/visualize/src/domain/wind-particle-state.js`
- Create: `apps/visualize/src/domain/wind-particle-state.test.js`

- [ ] **Step 1: Write sampler tests**

Create `apps/visualize/src/domain/wind-field-sampler.test.js`:

```js
import { describe, expect, test } from "vitest";
import { createWindFieldSampler } from "./wind-field-sampler.js";

const grid = {
  ni: 2,
  nj: 2,
  latitudeOfFirstPoint: 1,
  latitudeOfLastPoint: 0,
  longitudeOfFirstPoint: 0,
  longitudeOfLastPoint: 1,
  di: 1,
  dj: 1,
};

describe("wind field sampler", () => {
  test("samples U/V by nearest grid point", () => {
    const sampler = createWindFieldSampler({
      grid,
      uValues: new Float32Array([1, 2, 3, 4]),
      vValues: new Float32Array([5, 6, 7, 8]),
      missingValue: -9999,
    });
    expect(sampler.sample({ lng: 1, lat: 0 })).toEqual({ u: 4, v: 8 });
  });

  test("returns null outside grid or on missing data", () => {
    const sampler = createWindFieldSampler({
      grid,
      uValues: new Float32Array([1, -9999, 3, 4]),
      vValues: new Float32Array([5, 6, 7, 8]),
      missingValue: -9999,
    });
    expect(sampler.sample({ lng: 10, lat: 10 })).toBe(null);
    expect(sampler.sample({ lng: 1, lat: 1 })).toBe(null);
  });
});
```

- [ ] **Step 2: Write particle state tests**

Create `apps/visualize/src/domain/wind-particle-state.test.js` with deterministic random injection:

```js
import { describe, expect, test } from "vitest";
import { createWindParticleState } from "./wind-particle-state.js";

describe("wind particle state", () => {
  test("stores particles in typed arrays and ages them", () => {
    const state = createWindParticleState({
      count: 2,
      bounds: [[0, 0], [1, 1]],
      maxAge: 10,
      random: () => 0.5,
    });
    state.step(() => ({ u: 1, v: 0 }), 1);
    expect(state.xs).toBeInstanceOf(Float32Array);
    expect(state.ys).toBeInstanceOf(Float32Array);
    expect(state.ages[0]).toBe(1);
  });
});
```

- [ ] **Step 3: Run tests and verify red**

Run:

```bash
npm run test:domain -w visualize -- wind-field-sampler.test.js wind-particle-state.test.js
```

Expected: fail because modules do not exist.

- [ ] **Step 4: Implement modules**

Implement minimal nearest-neighbor sampler and typed-array particle state. Keep movement unit abstract; service tuning will decide `speedFactor`.

- [ ] **Step 5: Run tests and check**

Run:

```bash
npm run test:domain -w visualize -- wind-field-sampler.test.js wind-particle-state.test.js
npm run check -w visualize
```

Expected: tests and Biome pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/visualize/src/domain/wind-field-sampler.js apps/visualize/src/domain/wind-field-sampler.test.js apps/visualize/src/domain/wind-particle-state.js apps/visualize/src/domain/wind-particle-state.test.js
git commit -m "feat: add wind particle domain"
```

---

### Task 8: Add MapLibre Custom Particle Layer Service

**Files:**
- Create: `apps/visualize/src/services/wind-particle-layer-service.js`
- Modify: `apps/visualize/src/services/map-renderer-service.js`

- [ ] **Step 1: Confirm MapLibre custom layer path**

Inspect installed MapLibre docs/types:

```bash
rg -n "CustomLayerInterface|renderingMode|onAdd\\(|render\\(" node_modules/maplibre-gl -g "*.d.ts" -g "*.ts"
```

Expected: custom layers are WebGL-oriented. If a clean Canvas 2D custom path is not supported, implement WebGL lines directly.

- [ ] **Step 2: Create service skeleton**

Create `apps/visualize/src/services/wind-particle-layer-service.js` with:

```js
export function createWindParticleLayerService({ getMap }) {
  let layer = null;
  let field = null;
  let paused = false;

  return {
    setField(nextField) {
      field = nextField;
      layer?.reset?.();
    },
    add() {
      const map = getMap();
      if (!map || layer || !field) return;
      layer = createWindParticleCustomLayer({ field });
      map.addLayer(layer);
    },
    remove() {
      const map = getMap();
      if (map && layer && map.getLayer(layer.id)) map.removeLayer(layer.id);
      layer = null;
    },
    pause() {
      paused = true;
      layer?.setPaused?.(true);
    },
    resume() {
      paused = false;
      layer?.setPaused?.(false);
    },
    reset() {
      layer?.reset?.();
    },
  };
}
```

- [ ] **Step 3: Implement minimal custom layer**

Use a MapLibre custom layer with:

```js
{
  id: "wind-flow-particles",
  type: "custom",
  renderingMode: "2d",
  onAdd(map, gl) { ... },
  render(gl, matrix) { ... }
}
```

Implementation constraints:

- draw thin translucent white line segments;
- low particle count first, around `800`;
- pause during map movement;
- reuse typed arrays;
- request repaint through `map.triggerRepaint()`;
- expose `reset()` and `setPaused(paused)`.

- [ ] **Step 4: Wire service into map renderer**

In `apps/visualize/src/services/map-renderer-service.js`, create the service and expose:

```js
setWindParticleField(field) { ... }
clearWindParticles() { ... }
pauseWindParticles() { ... }
resumeWindParticles() { ... }
resetWindParticles() { ... }
```

Also clear wind particles in `clearLayer()`.

- [ ] **Step 5: Run tests and check**

Run:

```bash
npm test -w visualize
npm run check -w visualize
```

Expected: tests and Biome pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/visualize/src/services/wind-particle-layer-service.js apps/visualize/src/services/map-renderer-service.js
git commit -m "feat: add wind particle layer service"
```

---

### Task 9: Wire Particles Into Forecast Route

**Files:**
- Modify: `apps/visualize/index.js`
- Modify: `apps/visualize/map-tooltip.js` if Task 5 was deferred.

- [ ] **Step 1: Pass wind field to map renderer**

After a successful `Wind flow` render, call:

```js
mapRenderer.setWindParticleField({
  grid: entry.grid,
  uValues: renderEntry.windUValues,
  vValues: renderEntry.windVValues,
  missingValue: MISSING_VALUE,
  bounds: PACKAGES[modelState.packageKey].bounds,
});
```

- [ ] **Step 2: Reset on hour changes**

In `showHour(idx)`, when `isWindFlowVariable()`:

- clear previous wind layer before loading;
- render current hour through `renderWindFlowHour`;
- set new field;
- reset particles.

- [ ] **Step 3: Pause/reset on map movement**

In `map-renderer-service.js`, attach map listeners after init:

```js
map.on("movestart", () => windParticleLayer.pause());
map.on("moveend", () => {
  windParticleLayer.reset();
  windParticleLayer.resume();
});
```

Use `zoomstart/zoomend` only if `movestart/moveend` does not cover zoom gestures well enough in manual testing.

- [ ] **Step 4: Missing data behavior**

If `u` or `v` is unavailable for the hour:

- show existing `Data not available yet`;
- do not leave old heatmap visible;
- call `mapRenderer.clearWindParticles()`.

- [ ] **Step 5: Run tests and check**

Run:

```bash
npm test -w visualize
npm run check -w visualize
```

Expected: tests and Biome pass.

- [ ] **Step 6: Commit**

Run:

```bash
git add apps/visualize/index.js apps/visualize/src/services/map-renderer-service.js
git commit -m "feat: show wind flow particles"
```

---

### Task 10: Manual Browser Verification And Tuning

**Files:**
- Modify as needed:
  - `apps/visualize/src/services/wind-particle-layer-service.js`
  - `apps/visualize/index.js`
  - `apps/visualize/style.css`

- [ ] **Step 1: Start local app**

Run:

```bash
npm run dev -w visualize
```

Expected: Vite serves the app.

- [ ] **Step 2: Verify AROME SP1 parameter list**

Manual checks:

- `Temperature (2m)` remains default.
- `Wind flow (10m)` appears in `Weather maps`.
- `U/V` remain visible in `Component fields`.

- [ ] **Step 3: Verify Wind flow rendering**

Manual checks:

- selecting `Wind flow (10m)` loads current hour only;
- heatmap uses Viridis and `0..160 km/h`;
- particles render above the heatmap;
- Play button is disabled;
- slider change clears old data, shows short loading, then resets particles;
- tooltip displays e.g. `42.3 km/h ↙ SW`;
- missing data shows `Data not available yet` and no particles.

- [ ] **Step 4: Verify map interactions**

Manual checks:

- particles pause during pan/zoom;
- particles reset and resume after movement;
- no external overlay canvas appears outside MapLibre;
- no old particles remain after switching parameter/package/view.

- [ ] **Step 5: Tune conservative defaults**

Adjust only if needed:

- particle count;
- trail fade;
- line width;
- speed factor.

Keep values conservative and document the chosen numbers in the service constants.

- [ ] **Step 6: Final automated verification**

Run:

```bash
npm test -w visualize
npm run check -w visualize
```

Expected: all tests pass and Biome reports no fixes.

- [ ] **Step 7: Commit tuning**

Run:

```bash
git add apps/visualize
git commit -m "fix: tune wind flow particles"
```

Use `feat:` instead of `fix:` if this is the first commit that makes the visual feature usable.

---

## Final Verification Before Push

- [ ] Run:

```bash
npm test -w visualize
npm run check -w visualize
git status --short
```

- [ ] Confirm only intended files are modified.
- [ ] Push after user approval:

```bash
git push
```
