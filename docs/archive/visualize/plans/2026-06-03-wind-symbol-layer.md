# Wind Symbol Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static composite wind map where wind speed is rendered as the existing raster layer and wind direction is rendered as fixed-size MapLibre symbols over the visible viewport.

**Architecture:** Add pure domain modules for composite wind resolution, direction formatting, and viewport-aware symbol sampling. Keep MapLibre integration in a dedicated service and wire it through the existing map renderer and forecast presentation services. Do not implement animated particles and do not introduce a new worker in this milestone.

**Tech Stack:** JavaScript modules, Vitest, MapLibre GL, existing model block Comlink worker, existing raster rendering pipeline.

---

## File Structure

- Create `apps/visualize/src/domain/wind-composite-variable.js`: resolve `wind_*` composite variables to their `wspd_*` and `wdir_*` component fields.
- Create `apps/visualize/src/domain/wind-composite-variable.test.js`: test composite keys, component keys, selected variable metadata, and non-wind fallback behavior.
- Create `apps/visualize/src/domain/wind-direction-format.js`: normalize degrees and format cardinal directions.
- Create `apps/visualize/src/domain/wind-direction-format.test.js`: test degree normalization and cardinal labels.
- Create `apps/visualize/src/domain/wind-symbol-sampler.js`: generate viewport-bounded GeoJSON features from speed and direction grids.
- Create `apps/visualize/src/domain/wind-symbol-sampler.test.js`: test visible bounds, zoom density, calm marker selection, and feature properties.
- Create `apps/visualize/src/services/wind-symbol-layer-service.js`: manage MapLibre source and layers for wind symbols.
- Create `apps/visualize/src/services/wind-symbol-layer-service.test.js`: test source/layer lifecycle with a fake MapLibre map.
- Modify `apps/visualize/src/domain/model-packages.js`: add composite wind variables and move `wspd_*` / `wdir_*` entries to `Component fields`; extract small level factories to avoid more repeated blocks.
- Modify `apps/visualize/src/domain/model-packages.test.js`: assert the new user-facing wind entries and component grouping.
- Modify `apps/visualize/src/domain/variable-metadata.js`: add metadata lookup for `wind_*` composite keys through `wspd_*` rendering metadata.
- Modify `apps/visualize/src/domain/variable-metadata.test.js`: assert composite wind palette and static scale.
- Modify `apps/visualize/src/services/forecast-render-request-service.js`: allow render requests to rasterize the speed component when the selected variable is composite wind.
- Modify `apps/visualize/src/services/forecast-render-request-service.test.js`: assert composite wind render requests target `wspd_*`.
- Modify `apps/visualize/model-block-worker.js`: support decoding a secondary component field for direction values in the same block/hour.
- Modify `apps/visualize/src/workers/model-block-worker-client.test.js`: assert the client keeps routing render requests without a new message type.
- Modify `apps/visualize/src/services/forecast-animation-service.js`: store and hydrate direction values for composite wind entries.
- Modify `apps/visualize/src/services/forecast-map-presentation-service.js`: update wind symbol GeoJSON after raster presentation.
- Modify `apps/visualize/src/services/forecast-map-presentation-service.test.js`: assert symbol updates and clearing.
- Modify `apps/visualize/src/services/map-renderer-service.js`: own wind symbol layer lifecycle through the new service.
- Modify `apps/visualize/map-tooltip.js`: format composite wind tooltips with speed and direction.
- Create `apps/visualize/map-tooltip.test.js`: test composite wind tooltip formatting.

---

### Task 1: Composite Wind Domain

**Files:**
- Create: `apps/visualize/src/domain/wind-composite-variable.js`
- Create: `apps/visualize/src/domain/wind-composite-variable.test.js`
- Modify: `apps/visualize/src/domain/variable-metadata.js`
- Modify: `apps/visualize/src/domain/variable-metadata.test.js`

- [ ] **Step 1: Write failing composite variable tests**

```js
import { describe, expect, test } from "vitest";
import {
  componentVariableKeyForWind,
  isWindCompositeVariable,
  windCompositeLevelFor,
  windCompositeVariableForLevel,
} from "./wind-composite-variable.js";

describe("wind composite variables", () => {
  test("recognizes composite wind variables by key", () => {
    expect(isWindCompositeVariable("wind_10")).toBe(true);
    expect(isWindCompositeVariable("wind_100")).toBe(true);
    expect(isWindCompositeVariable("wspd_10")).toBe(false);
    expect(isWindCompositeVariable("wdir_10")).toBe(false);
  });

  test("maps wind composites to speed and direction components", () => {
    expect(componentVariableKeyForWind("wind_50", "speed")).toBe("wspd_50");
    expect(componentVariableKeyForWind("wind_50", "direction")).toBe("wdir_50");
    expect(componentVariableKeyForWind("t", "speed")).toBe(null);
  });

  test("creates display variable definitions for wind levels", () => {
    expect(windCompositeVariableForLevel(20)).toMatchObject({
      shortName: "wind",
      varKey: "wind_20",
      levelValue: 20,
      name: "Wind (20m)",
      level: "20 m above ground",
      units: "km/h",
      group: "Weather maps",
    });
  });

  test("extracts wind composite levels", () => {
    expect(windCompositeLevelFor("wind_10")).toBe(10);
    expect(windCompositeLevelFor("wind_100")).toBe(100);
    expect(windCompositeLevelFor("wind")).toBe(null);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -w visualize -- src/domain/wind-composite-variable.test.js`

Expected: FAIL because `wind-composite-variable.js` does not exist.

- [ ] **Step 3: Implement the composite variable helpers**

```js
const WIND_LEVELS = Object.freeze([10, 20, 50, 100]);
const WIND_COMPOSITE_PATTERN = /^wind_(\d+)$/;

export function isWindCompositeVariable(variableKey) {
  return WIND_COMPOSITE_PATTERN.test(variableKey);
}

export function windCompositeLevelFor(variableKey) {
  const match = WIND_COMPOSITE_PATTERN.exec(variableKey);
  return match ? Number(match[1]) : null;
}

export function componentVariableKeyForWind(variableKey, component) {
  const level = windCompositeLevelFor(variableKey);
  if (level == null) return null;
  if (component === "speed") return `wspd_${level}`;
  if (component === "direction") return `wdir_${level}`;
  return null;
}

export function windCompositeVariableForLevel(level) {
  return {
    shortName: "wind",
    varKey: `wind_${level}`,
    levelValue: level,
    name: `Wind (${level}m)`,
    level: `${level} m above ground`,
    units: "km/h",
    group: "Weather maps",
  };
}

export function windCompositeVariablesForLevels(levels = WIND_LEVELS) {
  return levels.map((level) => windCompositeVariableForLevel(level));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test -w visualize -- src/domain/wind-composite-variable.test.js`

Expected: PASS.

- [ ] **Step 5: Write failing metadata tests for composite wind**

Add to `apps/visualize/src/domain/variable-metadata.test.js`:

```js
test("reuses speed rendering metadata for composite wind variables", () => {
  expect(defaultPaletteFor("wind_100")).toBe("Viridis");
  expect(staticScaleFor("wind_100")).toEqual({ min: 0, max: 200 });
});
```

- [ ] **Step 6: Run metadata test to verify it fails**

Run: `npm test -w visualize -- src/domain/variable-metadata.test.js`

Expected: FAIL because `wind_100` has no metadata.

- [ ] **Step 7: Implement composite metadata fallback**

In `apps/visualize/src/domain/variable-metadata.js`, import `componentVariableKeyForWind` and change `variableMetadataFor` to:

```js
export function variableMetadataFor(shortName) {
  const directMetadata = VARIABLE_METADATA[shortName];
  if (directMetadata) return directMetadata;
  const speedKey = componentVariableKeyForWind(shortName, "speed");
  return speedKey ? VARIABLE_METADATA[speedKey] ?? {} : {};
}
```

- [ ] **Step 8: Run domain tests**

Run: `npm test -w visualize -- src/domain/wind-composite-variable.test.js src/domain/variable-metadata.test.js`

Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/visualize/src/domain/wind-composite-variable.js apps/visualize/src/domain/wind-composite-variable.test.js apps/visualize/src/domain/variable-metadata.js apps/visualize/src/domain/variable-metadata.test.js
git commit -m "Add composite wind variable domain"
```

---

### Task 2: Package Catalog Entries

**Files:**
- Modify: `apps/visualize/src/domain/model-packages.js`
- Modify: `apps/visualize/src/domain/model-packages.test.js`

- [ ] **Step 1: Write failing package grouping tests**

Update the AROME HP1 test expectations so `Weather maps` starts with:

```js
[
  { name: "Wind (10m)", group: "Weather maps" },
  { name: "Wind (20m)", group: "Weather maps" },
  { name: "Wind (50m)", group: "Weather maps" },
  { name: "Wind (100m)", group: "Weather maps" },
  { name: "Relative humidity (10m)", group: "Weather maps" },
  { name: "Relative humidity (20m)", group: "Weather maps" },
  { name: "Relative humidity (50m)", group: "Weather maps" },
  { name: "Relative humidity (100m)", group: "Weather maps" },
  { name: "Wind speed (10m)", group: "Component fields" },
  { name: "Wind speed (20m)", group: "Component fields" },
  { name: "Wind speed (50m)", group: "Component fields" },
  { name: "Wind speed (100m)", group: "Component fields" },
  { name: "Wind direction (10m)", group: "Component fields" },
  { name: "Wind direction (20m)", group: "Component fields" },
  { name: "Wind direction (50m)", group: "Component fields" },
  { name: "Wind direction (100m)", group: "Component fields" },
  { name: "U (wind, 10m)", group: "Component fields" },
  { name: "U (wind, 20m)", group: "Component fields" },
  { name: "U (wind, 50m)", group: "Component fields" },
  { name: "U (wind, 100m)", group: "Component fields" },
  { name: "V (wind, 10m)", group: "Component fields" },
  { name: "V (wind, 20m)", group: "Component fields" },
  { name: "V (wind, 50m)", group: "Component fields" },
  { name: "V (wind, 100m)", group: "Component fields" },
]
```

Update `homeVariableGroups` so HP1 weather maps include `"Wind (10m, 20m, 50m, 100m)"` and component fields include wind speed, wind direction, U, and V.

- [ ] **Step 2: Run package tests to verify failure**

Run: `npm test -w visualize -- src/domain/model-packages.test.js`

Expected: FAIL because package entries are still speed/direction weather maps.

- [ ] **Step 3: Extract level factories and add composites**

In `apps/visualize/src/domain/model-packages.js`, import `windCompositeVariablesForLevels`, add:

```js
const WIND_LEVELS = Object.freeze([10, 20, 50, 100]);

function levelVariable({ shortName, varKeyPrefix, level, nameForLevel, units, group }) {
  return {
    shortName,
    varKey: `${varKeyPrefix}_${level}`,
    levelValue: level,
    name: nameForLevel(level),
    level: `${level} m above ground`,
    units,
    group,
  };
}

function levelVariables(config) {
  return WIND_LEVELS.map((level) => levelVariable({ ...config, level }));
}
```

Use the factories in `AROME_HP1.variables`:

```js
variables: [
  ...windCompositeVariablesForLevels(WIND_LEVELS),
  ...levelVariables({
    shortName: "r",
    varKeyPrefix: "r",
    nameForLevel: (level) => `Relative humidity (${level}m)`,
    units: "%",
    group: "Weather maps",
  }),
  ...levelVariables({
    shortName: "wspd",
    varKeyPrefix: "wspd",
    nameForLevel: (level) => `Wind speed (${level}m)`,
    units: "km/h",
    group: "Component fields",
  }),
  ...levelVariables({
    shortName: "wdir",
    varKeyPrefix: "wdir",
    nameForLevel: (level) => `Wind direction (${level}m)`,
    units: "°",
    group: "Component fields",
  }),
  ...levelVariables({
    shortName: "u",
    varKeyPrefix: "u",
    nameForLevel: (level) => `U (wind, ${level}m)`,
    units: "m s-1",
    group: "Component fields",
  }),
  ...levelVariables({
    shortName: "v",
    varKeyPrefix: "v",
    nameForLevel: (level) => `V (wind, ${level}m)`,
    units: "m s-1",
    group: "Component fields",
  }),
]
```

Keep one helper and avoid duplicating four near-identical blocks per variable family.

- [ ] **Step 4: Run package tests**

Run: `npm test -w visualize -- src/domain/model-packages.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/visualize/src/domain/model-packages.js apps/visualize/src/domain/model-packages.test.js
git commit -m "Expose composite wind package entries"
```

---

### Task 3: Direction Formatting And Symbol Sampling

**Files:**
- Create: `apps/visualize/src/domain/wind-direction-format.js`
- Create: `apps/visualize/src/domain/wind-direction-format.test.js`
- Create: `apps/visualize/src/domain/wind-symbol-sampler.js`
- Create: `apps/visualize/src/domain/wind-symbol-sampler.test.js`

- [ ] **Step 1: Write failing direction formatting tests**

```js
import { describe, expect, test } from "vitest";
import { cardinalDirectionForDegrees, normalizeDegrees } from "./wind-direction-format.js";

describe("wind direction formatting", () => {
  test("normalizes degrees into the 0-360 range", () => {
    expect(normalizeDegrees(360)).toBe(0);
    expect(normalizeDegrees(725)).toBe(5);
    expect(normalizeDegrees(-10)).toBe(350);
  });

  test("formats cardinal directions with 16-wind labels", () => {
    expect(cardinalDirectionForDegrees(0)).toBe("N");
    expect(cardinalDirectionForDegrees(45)).toBe("NE");
    expect(cardinalDirectionForDegrees(240)).toBe("WSW");
    expect(cardinalDirectionForDegrees(270)).toBe("W");
  });
});
```

- [ ] **Step 2: Run direction test to verify failure**

Run: `npm test -w visualize -- src/domain/wind-direction-format.test.js`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement direction formatting**

```js
const CARDINAL_DIRECTIONS = Object.freeze([
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
]);

export function normalizeDegrees(degrees) {
  return ((degrees % 360) + 360) % 360;
}

export function cardinalDirectionForDegrees(degrees) {
  const normalized = normalizeDegrees(degrees);
  const index = Math.round(normalized / 22.5) % CARDINAL_DIRECTIONS.length;
  return CARDINAL_DIRECTIONS[index];
}
```

- [ ] **Step 4: Write failing sampler tests**

```js
import { describe, expect, test } from "vitest";
import { buildWindSymbolFeatures } from "./wind-symbol-sampler.js";

const grid = {
  ni: 4,
  nj: 3,
  latitudeOfFirstPoint: 52,
  latitudeOfLastPoint: 50,
  longitudeOfFirstPoint: 1,
  longitudeOfLastPoint: 4,
  di: 1,
  dj: 1,
};

describe("wind symbol sampler", () => {
  test("returns only features inside visible bounds", () => {
    const speedValues = new Float32Array(12).fill(3);
    const directionValues = new Float32Array(12).fill(90);

    const collection = buildWindSymbolFeatures({
      grid,
      speedValues,
      directionValues,
      missingValue: -1e100,
      bounds: { west: 1.5, south: 50.5, east: 3.5, north: 51.5 },
      zoom: 6,
      viewport: { width: 800, height: 600 },
    });

    expect(collection.type).toBe("FeatureCollection");
    expect(collection.features.every((feature) => {
      const [lng, lat] = feature.geometry.coordinates;
      return lng >= 1.5 && lng <= 3.5 && lat >= 50.5 && lat <= 51.5;
    })).toBe(true);
  });

  test("marks calm wind when display speed is below 5 km/h", () => {
    const collection = buildWindSymbolFeatures({
      grid,
      speedValues: new Float32Array(12).fill(1),
      directionValues: new Float32Array(12).fill(180),
      missingValue: -1e100,
      bounds: { west: 0, south: 49, east: 5, north: 53 },
      zoom: 8,
      viewport: { width: 800, height: 600 },
      speedUnitTransform: (value) => value * 3.6,
    });

    expect(collection.features[0].properties.symbol).toBe("calm");
  });

  test("stores fixed-size arrow properties for non-calm wind", () => {
    const collection = buildWindSymbolFeatures({
      grid,
      speedValues: new Float32Array(12).fill(4),
      directionValues: new Float32Array(12).fill(270),
      missingValue: -1e100,
      bounds: { west: 0, south: 49, east: 5, north: 53 },
      zoom: 8,
      viewport: { width: 800, height: 600 },
      speedUnitTransform: (value) => value * 3.6,
    });

    expect(collection.features[0].properties).toMatchObject({
      symbol: "arrow",
      directionDegrees: 270,
      cardinal: "W",
      speedKmh: 14.4,
    });
  });
});
```

- [ ] **Step 5: Run sampler tests to verify failure**

Run: `npm test -w visualize -- src/domain/wind-symbol-sampler.test.js`

Expected: FAIL because the sampler does not exist.

- [ ] **Step 6: Implement the sampler**

Implement `buildWindSymbolFeatures({ grid, speedValues, directionValues, missingValue, bounds, zoom, viewport, speedUnitTransform = (value) => value })`.

Core behavior:

```js
const CALM_WIND_KMH = 5;
const TARGET_SYMBOL_SPACING_PX = 42;

function sampleStrideForViewport(grid, viewport) {
  const approximateColumns = Math.max(1, Math.floor(viewport.width / TARGET_SYMBOL_SPACING_PX));
  return Math.max(1, Math.floor(grid.ni / approximateColumns));
}
```

For each sampled row/column:

```js
const lng = grid.longitudeOfFirstPoint + col * grid.di;
const latFromNorth = northLat - rowFromNorth * grid.dj;
const row = isStoN ? grid.nj - 1 - rowFromNorth : rowFromNorth;
const index = row * grid.ni + col;
```

Skip points outside bounds or with missing speed/direction. Store properties:

```js
{
  symbol: speedKmh < CALM_WIND_KMH ? "calm" : "arrow",
  speedKmh,
  directionDegrees,
  cardinal: cardinalDirectionForDegrees(directionDegrees),
}
```

- [ ] **Step 7: Run new domain tests**

Run: `npm test -w visualize -- src/domain/wind-direction-format.test.js src/domain/wind-symbol-sampler.test.js`

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/visualize/src/domain/wind-direction-format.js apps/visualize/src/domain/wind-direction-format.test.js apps/visualize/src/domain/wind-symbol-sampler.js apps/visualize/src/domain/wind-symbol-sampler.test.js
git commit -m "Add wind symbol sampling domain"
```

---

### Task 4: Render Requests And Direction Decode

**Files:**
- Modify: `apps/visualize/src/services/forecast-render-request-service.js`
- Modify: `apps/visualize/src/services/forecast-render-request-service.test.js`
- Modify: `apps/visualize/model-block-worker.js`

- [ ] **Step 1: Write failing render request test**

Add to `apps/visualize/src/services/forecast-render-request-service.test.js`:

```js
test("renders composite wind variables with the matching speed field and requests direction values", () => {
  const state = createState({ variable: "wind_10" });
  const request = createForecastRenderRequest({
    state,
    hourIndex: 1,
    hour: 2,
    renderGeneration: 7,
    paletteName: "Viridis",
    missingValue: -1e100,
    includeValues: true,
  });

  expect(request).toMatchObject({
    variable: { shortName: "wspd", levelValue: 10 },
    secondaryVariable: { shortName: "wdir", levelValue: 10 },
    unitTransform: "wspd",
    displayUnits: "km/h",
  });
});
```

- [ ] **Step 2: Run render request test to verify failure**

Run: `npm test -w visualize -- src/services/forecast-render-request-service.test.js`

Expected: FAIL because composite wind is not resolved.

- [ ] **Step 3: Implement composite render request resolution**

In `forecast-render-request-service.js`, resolve selected variable key before building the request:

```js
const selectedVariable = state.variable;
const speedKey = componentVariableKeyForWind(selectedVariable, "speed");
const directionKey = componentVariableKeyForWind(selectedVariable, "direction");
const renderVariableKey = speedKey ?? selectedVariable;
const varDef = findPackageVariable(state.packageKey, renderVariableKey);
const secondaryVarDef = directionKey ? findPackageVariable(state.packageKey, directionKey) : null;
```

Set:

```js
variable: {
  shortName,
  levelValue: varDef?.levelValue ?? null,
},
secondaryVariable: secondaryVarDef
  ? { shortName: secondaryVarDef.shortName, levelValue: secondaryVarDef.levelValue ?? null }
  : null,
```

Use `renderVariableKey` for palette/static scale fallback where appropriate.

- [ ] **Step 4: Run render request tests**

Run: `npm test -w visualize -- src/services/forecast-render-request-service.test.js`

Expected: PASS.

- [ ] **Step 5: Modify the worker to decode secondary values**

In `apps/visualize/model-block-worker.js`, after `const decoded = await decodeDisplayValues(data);`, decode secondary values when `data.secondaryVariable` exists:

```js
async function decodeSecondaryDisplayValues(data) {
  if (!data.secondaryVariable) return null;
  return decodeDisplayValues({
    ...data,
    variable: data.secondaryVariable,
    previousBlockKey: null,
    previousBlock: null,
    previousHour: null,
  });
}
```

In `renderHour`, include:

```js
const secondaryDecoded = await decodeSecondaryDisplayValues(data);
if (data.secondaryVariable && !secondaryDecoded) return null;
```

Add to the worker result:

```js
windDirectionValues: secondaryDecoded?.values ?? null,
windDirectionGrid: secondaryDecoded?.grid ?? null,
windDirectionProduct: secondaryDecoded?.product ?? null,
```

Add `secondaryDecoded.values.buffer` to transferables when present.

- [ ] **Step 6: Run service and worker-client tests**

Run: `npm test -w visualize -- src/services/forecast-render-request-service.test.js src/workers/model-block-worker-client.test.js`

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/visualize/src/services/forecast-render-request-service.js apps/visualize/src/services/forecast-render-request-service.test.js apps/visualize/model-block-worker.js
git commit -m "Decode wind direction with composite renders"
```

---

### Task 5: MapLibre Wind Symbol Layer Service

**Files:**
- Create: `apps/visualize/src/services/wind-symbol-layer-service.js`
- Create: `apps/visualize/src/services/wind-symbol-layer-service.test.js`
- Modify: `apps/visualize/src/services/map-renderer-service.js`

- [ ] **Step 1: Write failing layer service tests**

```js
import { describe, expect, test, vi } from "vitest";
import { createWindSymbolLayerService } from "./wind-symbol-layer-service.js";

function createMap() {
  const sources = new Map();
  const layers = new Set();
  return {
    addLayer: vi.fn((layer) => layers.add(layer.id)),
    addSource: vi.fn((id, source) => sources.set(id, source)),
    getLayer: vi.fn((id) => layers.has(id)),
    getSource: vi.fn((id) => sources.get(id) ?? null),
    removeLayer: vi.fn((id) => layers.delete(id)),
    removeSource: vi.fn((id) => sources.delete(id)),
  };
}

describe("wind symbol layer service", () => {
  test("adds source and layers on first update", () => {
    const map = createMap();
    const service = createWindSymbolLayerService({ getMap: () => map });
    const geojson = { type: "FeatureCollection", features: [] };

    service.update(geojson);

    expect(map.addSource).toHaveBeenCalledWith("wind-symbols", {
      type: "geojson",
      data: geojson,
    });
    expect(map.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: "wind-arrows" }));
    expect(map.addLayer).toHaveBeenCalledWith(expect.objectContaining({ id: "wind-calm" }));
  });

  test("updates existing source data", () => {
    const map = createMap();
    const source = { setData: vi.fn() };
    map.addSource = vi.fn((id) => {
      if (id === "wind-symbols") map.getSource = vi.fn(() => source);
    });
    const service = createWindSymbolLayerService({ getMap: () => map });
    const first = { type: "FeatureCollection", features: [] };
    const second = { type: "FeatureCollection", features: [] };

    service.update(first);
    service.update(second);

    expect(source.setData).toHaveBeenCalledWith(second);
  });

  test("removes layers before source", () => {
    const map = createMap();
    const service = createWindSymbolLayerService({ getMap: () => map });

    service.update({ type: "FeatureCollection", features: [] });
    service.remove();

    expect(map.removeLayer).toHaveBeenCalledWith("wind-arrows");
    expect(map.removeLayer).toHaveBeenCalledWith("wind-calm");
    expect(map.removeSource).toHaveBeenCalledWith("wind-symbols");
  });
});
```

- [ ] **Step 2: Run layer service test to verify failure**

Run: `npm test -w visualize -- src/services/wind-symbol-layer-service.test.js`

Expected: FAIL because the service does not exist.

- [ ] **Step 3: Implement the layer service**

Create source id `wind-symbols`, arrow layer id `wind-arrows`, and calm layer id `wind-calm`.

Use an inline arrow image only if no existing icon fits. Prefer MapLibre symbol layout with:

```js
{
  id: "wind-arrows",
  type: "symbol",
  source: "wind-symbols",
  filter: ["==", ["get", "symbol"], "arrow"],
  layout: {
    "icon-image": "wind-arrow",
    "icon-size": 0.8,
    "icon-allow-overlap": true,
    "icon-ignore-placement": true,
    "icon-rotate": ["get", "directionDegrees"],
    "icon-rotation-alignment": "map",
  },
}
```

Use a circle layer for calm markers:

```js
{
  id: "wind-calm",
  type: "circle",
  source: "wind-symbols",
  filter: ["==", ["get", "symbol"], "calm"],
  paint: {
    "circle-radius": 3,
    "circle-stroke-width": 1.5,
    "circle-stroke-color": "#111827",
    "circle-color": "rgba(255, 255, 255, 0.85)",
  },
}
```

- [ ] **Step 4: Wire service into map renderer**

In `map-renderer-service.js`, create the service next to `isobarLayer`:

```js
const windSymbolLayer = createWindSymbolLayerService({ getMap: () => map });
```

Add methods:

```js
updateWindSymbols(geojson) {
  windSymbolLayer.update(geojson);
},

clearWindSymbols() {
  windSymbolLayer.remove();
},
```

Call `windSymbolLayer.remove()` in `clearLayer()`.

- [ ] **Step 5: Run layer tests**

Run: `npm test -w visualize -- src/services/wind-symbol-layer-service.test.js src/services/forecast-map-presentation-service.test.js`

Expected: PASS after updating existing fakes with `clearWindSymbols` and `updateWindSymbols` no-op spies where needed.

- [ ] **Step 6: Commit**

```bash
git add apps/visualize/src/services/wind-symbol-layer-service.js apps/visualize/src/services/wind-symbol-layer-service.test.js apps/visualize/src/services/map-renderer-service.js apps/visualize/src/services/forecast-map-presentation-service.test.js
git commit -m "Add wind symbol MapLibre layer service"
```

---

### Task 6: Presentation Integration

**Files:**
- Modify: `apps/visualize/src/services/forecast-animation-service.js`
- Modify: `apps/visualize/src/services/forecast-map-presentation-service.js`
- Modify: `apps/visualize/src/services/forecast-map-presentation-service.test.js`

- [ ] **Step 1: Write failing presentation test**

Add a test that creates an entry with `windDirectionValues`, sets model state variable to `wind_10`, and expects `mapRenderer.updateWindSymbols` to be called with a FeatureCollection.

```js
test("updates wind symbols for composite wind entries", async () => {
  const { mapRenderer, modelState, service } = createService({
    getMapViewport: () => ({ width: 800, height: 600 }),
    getMapBounds: () => ({ west: 0, south: 49, east: 5, north: 53 }),
    getMapZoom: () => 8,
  });
  modelState.variable = "wind_10";
  mapRenderer.updateWindSymbols = vi.fn();
  mapRenderer.clearWindSymbols = vi.fn();
  const entry = createEntry({
    displayUnits: "km/h",
    unitTransform: "wspd",
    values: null,
    windDirectionValues: new Float32Array([180, 180, 180, 180]),
    grid: {
      ni: 2,
      nj: 2,
      latitudeOfFirstPoint: 51,
      latitudeOfLastPoint: 50,
      longitudeOfFirstPoint: 1,
      longitudeOfLastPoint: 2,
      di: 1,
      dj: 1,
    },
  });

  await service.presentBitmapEntry(1, entry, { values: new Float32Array([4, 4, 4, 4]) });

  expect(mapRenderer.updateWindSymbols).toHaveBeenCalledWith(
    expect.objectContaining({ type: "FeatureCollection" }),
  );
});
```

- [ ] **Step 2: Run presentation test to verify failure**

Run: `npm test -w visualize -- src/services/forecast-map-presentation-service.test.js`

Expected: FAIL because wind symbols are not updated.

- [ ] **Step 3: Store wind direction values in cache entries**

In `makeBitmapCacheEntryFromWorker`, copy:

```js
windDirectionValues: renderEntry.windDirectionValues,
windDirectionGrid: renderEntry.windDirectionGrid,
windDirectionProduct: renderEntry.windDirectionProduct,
```

When presenting a fresh render, `entry` contains direction values through the cache entry. When presenting a cached render, it can update wind symbols from cached `windDirectionValues`.

- [ ] **Step 4: Build symbols in presentation service**

Inject helpers into `createForecastMapPresentationService`:

```js
getMapBounds,
getMapViewport,
getMapZoom,
```

After raster layer presentation and before stats update:

```js
if (isWindCompositeVariable(modelState.variable) && entry.windDirectionValues) {
  mapRenderer.updateWindSymbols(buildWindSymbolFeatures({
    grid,
    speedValues: values ?? entry.values,
    directionValues: entry.windDirectionValues,
    missingValue,
    bounds: getMapBounds(),
    zoom: getMapZoom(),
    viewport: getMapViewport(),
    speedUnitTransform: unitFnFor(entry.unitTransform) ?? ((value) => value),
  }));
} else {
  mapRenderer.clearWindSymbols();
}
```

If `entry.values` is not currently stored for cached renders, store speed values for composite wind cache entries only. Avoid storing all values for all variables.

- [ ] **Step 5: Run presentation tests**

Run: `npm test -w visualize -- src/services/forecast-map-presentation-service.test.js src/services/forecast-animation-service.test.js`

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/visualize/src/services/forecast-animation-service.js apps/visualize/src/services/forecast-map-presentation-service.js apps/visualize/src/services/forecast-map-presentation-service.test.js
git commit -m "Present wind direction symbols over speed maps"
```

---

### Task 7: Tooltip Integration

**Files:**
- Modify: `apps/visualize/map-tooltip.js`
- Create or modify: `apps/visualize/map-tooltip.test.js`

- [ ] **Step 1: Write failing tooltip formatting test**

If no tooltip test exists, extract the value formatting into an exported helper:

```js
export function formatMapTooltipValue({ rawValue, directionValue, gridState }) {
  const val = gridState.unitFn ? gridState.unitFn(rawValue) : rawValue;
  const units = gridState.displayUnits ?? gridState.product.units;
  if (gridState.windDirectionValues && directionValue != null) {
    return `${formatValueForUnits(val, units, 2)} ${units} · ${Math.round(directionValue)}° ${cardinalDirectionForDegrees(directionValue)}`;
  }
  return `${formatValueForUnits(val, units, 2)} ${units}`;
}
```

Test:

```js
import { describe, expect, test } from "vitest";
import { formatMapTooltipValue } from "./map-tooltip.js";

describe("map tooltip formatting", () => {
  test("formats composite wind speed and direction", () => {
    expect(formatMapTooltipValue({
      rawValue: 12,
      directionValue: 240,
      gridState: {
        unitFn: (value) => value * 3.6,
        displayUnits: "km/h",
        product: { units: "m s-1" },
        windDirectionValues: new Float32Array([240]),
      },
    })).toBe("43.20 km/h · 240° WSW");
  });
});
```

- [ ] **Step 2: Run tooltip test to verify failure**

Run: `npm test -w visualize -- map-tooltip.test.js`

Expected: FAIL until the helper exists and wind direction lookup is wired.

- [ ] **Step 3: Wire direction lookup in tooltip**

In `showTooltipForMapEvent`, after computing `idx`, read:

```js
const directionValue =
  gridState.windDirectionValues && idx >= 0 && idx < gridState.windDirectionValues.length
    ? gridState.windDirectionValues[idx]
    : null;
```

Use `formatMapTooltipValue({ rawValue: rawVal, directionValue, gridState })`.

- [ ] **Step 4: Run tooltip test**

Run: `npm test -w visualize -- map-tooltip.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/visualize/map-tooltip.js apps/visualize/map-tooltip.test.js
git commit -m "Show wind direction in map tooltips"
```

---

### Task 8: Moveend Refresh And Full Verification

**Files:**
- Modify: `apps/visualize/src/services/map-renderer-service.js`
- Modify: `apps/visualize/src/services/forecast-map-presentation-service.js`
- Modify tests touched by the final wiring.

- [ ] **Step 1: Add settled map refresh hook**

Expose a callback registration on `map-renderer-service.js`:

```js
onViewportSettled(callback) {
  map?.on("moveend", callback);
  map?.on("zoomend", callback);
}
```

Register a wind-symbol refresh callback from the presentation layer after `initMap()` is available. The callback should rebuild symbols for the current composite wind cache entry only when the selected variable is composite wind.

- [ ] **Step 2: Run targeted tests**

Run:

```bash
npm test -w visualize -- src/domain/wind-composite-variable.test.js src/domain/wind-direction-format.test.js src/domain/wind-symbol-sampler.test.js src/domain/model-packages.test.js src/domain/variable-metadata.test.js src/services/forecast-render-request-service.test.js src/services/wind-symbol-layer-service.test.js src/services/forecast-map-presentation-service.test.js
```

Expected: PASS.

- [ ] **Step 3: Run full visualize tests**

Run: `npm test -w visualize`

Expected: PASS.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck:visualize`

Expected: PASS.

- [ ] **Step 5: Build visualize app**

Run: `npm run build:visualize`

Expected: PASS.

- [ ] **Step 6: Manual verification in browser**

Run: `npm run dev:visualize`.

Open the app and verify:

- AROME HP1 shows `Wind (10m)`, `Wind (20m)`, `Wind (50m)`, and `Wind (100m)` in `Weather maps`.
- `Wind speed (...)` and `Wind direction (...)` appear in `Component fields`.
- Selecting `Wind (10m)` renders the normal speed raster.
- Direction arrows appear above the raster.
- Calm points below `5 km/h` render as circles.
- The symbol density remains visually stable when zooming.
- The legend shows only speed.
- Tooltips show speed and direction.

- [ ] **Step 7: Commit**

```bash
git add apps/visualize
git commit -m "Refresh wind symbols on map viewport changes"
```

---

## Self-Review

Spec coverage:

- Composite user-facing `Wind` entries are covered by Task 2.
- Speed raster plus direction symbols are covered by Tasks 4, 5, and 6.
- `wspd_*` and `wdir_*` moving to `Component fields` is covered by Task 2.
- Visible-bounds GeoJSON generation and zoom-aware density are covered by Task 3.
- Fixed-size arrows and calm circles below `5 km/h` are covered by Tasks 3 and 5.
- Speed-only legend and statistics stay on the existing raster entry path in Task 6.
- Speed plus direction tooltips are covered by Task 7.
- No animated particles and no new worker are explicitly preserved in the architecture and task boundaries.

Placeholder scan:

- The plan contains no `TBD`, no `TODO`, and no particle implementation steps.

Type consistency:

- Composite variables use `wind_<level>` keys.
- Speed components use `wspd_<level>`.
- Direction components use `wdir_<level>`.
- Worker requests use `secondaryVariable`.
- Worker requests use `secondaryVariable`; worker results, cache entries, presentation state, and tooltip state use `windDirectionValues`.
