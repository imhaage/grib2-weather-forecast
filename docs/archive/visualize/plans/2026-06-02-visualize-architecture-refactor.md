# Visualize Architecture Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reduce long-term maintenance risk in `apps/visualize` by extracting duplicated rendering/domain logic, clarifying forecast state contracts, and moving DOM/workers/provider concerns into focused testable modules.

**Architecture:** Keep `apps/visualize/index.js` as a thin composition root that wires controllers, views, services, and workers. Move pure calculations into `src/domain`, browser-side integrations into `src/services` or `src/workers`, and DOM mutation into `src/ui` view modules. Each task preserves behavior and adds tests before production changes.

**Tech Stack:** Vite, plain JavaScript ES modules, Vitest, jsdom, MapLibre GL, Web Workers, IndexedDB, GRIB2 decoder.

---

## File Structure

- Create `apps/visualize/src/domain/projection.js`: Web Mercator projection helpers shared by main thread and workers.
- Create `apps/visualize/src/domain/projection.test.js`: Unit tests for projection calculations and grid corner ordering.
- Create `apps/visualize/src/domain/render-params.js`: Pure render scale, display value, accumulation diff, and worker request helpers.
- Create `apps/visualize/src/domain/render-params.test.js`: Unit tests for static scale, log scale, accumulation diff, and display unit fallback.
- Create `apps/visualize/src/services/data-gouv-resource-service.js`: Fetch and parse data.gouv GRIB resources.
- Create `apps/visualize/src/services/data-gouv-resource-service.test.js`: Unit tests using injected `fetch`.
- Create `apps/visualize/src/domain/forecast-state.js`: Forecast state factory and block lookup helpers with an explicit `availableBlocks` contract.
- Create `apps/visualize/src/domain/forecast-state.test.js`: Tests for state defaults, hour list building, and block availability.
- Create `apps/visualize/src/workers/worker-rpc-client.js`: Shared `callId` request/response wrapper for worker clients.
- Create `apps/visualize/src/workers/worker-rpc-client.test.js`: Tests with a fake worker event target.
- Create `apps/visualize/src/ui/forecast-download-view.js`: DOM rendering and status updates for forecast download blocks.
- Create `apps/visualize/src/ui/forecast-download-view.test.js`: jsdom tests for download item rendering, status classes, progress, and summary updates.
- Move CSS from `apps/visualize/style/modules.css` into `apps/visualize/style/modules/forecast-download.css`.
- Modify `apps/visualize/style.css`: import the new CSS module in the existing `modules` layer.
- Modify `apps/visualize/index.js`: progressively replace local helpers with imported modules and keep only composition/orchestration.
- Modify `apps/visualize/model-block-worker.js`: use shared projection and render helpers.
- Modify `apps/visualize/render-worker.js`: use shared rasterization helpers where feasible after render helper extraction.
- Modify `apps/visualize/src/services/map-renderer-service.js`: import projection helper through dependency or direct module after Task 1.
- Modify `apps/visualize/src/workers/model-block-worker-client.js`: delegate request tracking to `createWorkerRpcClient`.
- Modify `apps/visualize/src/workers/download-worker-client.js`: return an RPC-ready worker factory or use `createWorkerRpcClient`.

---

### Task 1: Extract Shared Projection Helpers

**Files:**
- Create: `apps/visualize/src/domain/projection.js`
- Create: `apps/visualize/src/domain/projection.test.js`
- Modify: `apps/visualize/index.js`
- Modify: `apps/visualize/model-block-worker.js`

- [ ] **Step 1: Write failing projection tests**

Create `apps/visualize/src/domain/projection.test.js`:

```js
import { describe, expect, it } from "vitest";

import {
  gridCorners,
  mercatorCanvasHeight,
  mercatorY,
  renderProjectionForGrid,
} from "./projection.js";

describe("projection helpers", () => {
  it("computes a stable Web Mercator Y coordinate", () => {
    expect(mercatorY(0)).toBeCloseTo(0, 12);
    expect(mercatorY(45)).toBeGreaterThan(mercatorY(10));
  });

  it("computes a Mercator-proportional canvas height", () => {
    const grid = {
      ni: 100,
      latitudeOfFirstPoint: 50,
      latitudeOfLastPoint: 40,
      longitudeOfFirstPoint: -5,
      longitudeOfLastPoint: 5,
    };

    expect(mercatorCanvasHeight(grid)).toBe(131);
  });

  it("returns map corners in north/east/south/west order", () => {
    const grid = {
      latitudeOfFirstPoint: 40,
      longitudeOfFirstPoint: 5,
      latitudeOfLastPoint: 50,
      longitudeOfLastPoint: -5,
    };

    expect(gridCorners(grid)).toEqual([
      [-5, 50],
      [5, 50],
      [5, 40],
      [-5, 40],
    ]);
  });

  it("builds render projection values for workers", () => {
    const projection = renderProjectionForGrid({
      latitudeOfFirstPoint: 40,
      latitudeOfLastPoint: 50,
    });

    expect(projection.northLat).toBe(50);
    expect(projection.southLat).toBe(40);
    expect(projection.isStoN).toBe(true);
    expect(projection.mySpan).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run the projection test and verify it fails**

Run:

```bash
npm test -- src/domain/projection.test.js
```

Expected: FAIL because `./projection.js` does not exist.

- [ ] **Step 3: Implement projection helpers**

Create `apps/visualize/src/domain/projection.js`:

```js
export function mercatorY(lat) {
  return Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
}

export function invMercatorY(my) {
  return ((2 * Math.atan(Math.exp(my)) - Math.PI / 2) * 180) / Math.PI;
}

export function mercatorCanvasHeight(grid) {
  const spanY = Math.abs(
    mercatorY(grid.latitudeOfFirstPoint) - mercatorY(grid.latitudeOfLastPoint),
  );
  const spanX = Math.abs(
    ((grid.longitudeOfLastPoint - grid.longitudeOfFirstPoint) * Math.PI) / 180,
  );
  return Math.round((grid.ni * spanY) / spanX);
}

export function gridCorners({
  latitudeOfFirstPoint: la1,
  longitudeOfFirstPoint: lo1,
  latitudeOfLastPoint: la2,
  longitudeOfLastPoint: lo2,
}) {
  const north = Math.max(la1, la2);
  const south = Math.min(la1, la2);
  const west = Math.min(lo1, lo2);
  const east = Math.max(lo1, lo2);
  return [
    [west, north],
    [east, north],
    [east, south],
    [west, south],
  ];
}

export function renderProjectionForGrid(grid) {
  const northLat = Math.max(grid.latitudeOfFirstPoint, grid.latitudeOfLastPoint);
  const southLat = Math.min(grid.latitudeOfFirstPoint, grid.latitudeOfLastPoint);
  const isStoN = grid.latitudeOfLastPoint > grid.latitudeOfFirstPoint;
  const myNorth = mercatorY(northLat);
  const mySpan = myNorth - mercatorY(southLat);

  return {
    northLat,
    southLat,
    isStoN,
    myNorth,
    mySpan,
  };
}
```

- [ ] **Step 4: Run the projection test and verify it passes**

Run:

```bash
npm test -- src/domain/projection.test.js
```

Expected: PASS.

- [ ] **Step 5: Replace duplicated projection code in main and worker**

Modify `apps/visualize/index.js`:

```js
import {
  gridCorners,
  mercatorCanvasHeight,
  renderProjectionForGrid,
} from "./src/domain/projection.js";
```

Remove the local `mercatorY`, `invMercatorY`, `mercatorCanvasHeight`, and `gridCorners` functions. In `renderViaWorker`, replace the local projection calculations with:

```js
const projection = renderProjectionForGrid(grid);
```

and spread the fields in the worker payload:

```js
...projection,
```

Modify `apps/visualize/model-block-worker.js`:

```js
import {
  mercatorCanvasHeight,
  renderProjectionForGrid,
} from "./src/domain/projection.js";
```

Remove local `mercatorY` and `mercatorCanvasHeight`. In `renderHour`, replace local projection variables with:

```js
const { northLat, southLat, isStoN, myNorth, mySpan } =
  renderProjectionForGrid(grid);
```

- [ ] **Step 6: Run focused and full checks**

Run:

```bash
npm test -- src/domain/projection.test.js
npm test
npm run typecheck
npm run check
```

Expected: all commands pass.

- [ ] **Step 7: Commit**

```bash
git add apps/visualize/src/domain/projection.js apps/visualize/src/domain/projection.test.js apps/visualize/index.js apps/visualize/model-block-worker.js
git commit -m "refactor: share visualize projection helpers"
```

---

### Task 2: Extract Render Parameter and Accumulation Logic

**Files:**
- Create: `apps/visualize/src/domain/render-params.js`
- Create: `apps/visualize/src/domain/render-params.test.js`
- Modify: `apps/visualize/index.js`
- Modify: `apps/visualize/model-block-worker.js`

- [ ] **Step 1: Write failing render parameter tests**

Create `apps/visualize/src/domain/render-params.test.js`:

```js
import { describe, expect, it } from "vitest";

import {
  buildRenderScale,
  computeAccumulationDisplayValues,
  createRenderParams,
  toFloat32Values,
} from "./render-params.js";

const missingValue = 9999;

describe("render params", () => {
  it("converts regular arrays to Float32Array", () => {
    const values = toFloat32Values([1, 2, 3]);
    expect(values).toBeInstanceOf(Float32Array);
    expect([...values]).toEqual([1, 2, 3]);
  });

  it("reuses Float32Array values without copying", () => {
    const values = new Float32Array([1, 2]);
    expect(toFloat32Values(values)).toBe(values);
  });

  it("builds linear render scale from static scale", () => {
    expect(buildRenderScale({ min: -30, max: 50 })).toEqual({
      renderMin: -30,
      renderMax: 50,
      range: 80,
      isLog: false,
      logDenom: 1,
      zeroThreshold: 0,
    });
  });

  it("builds log render scale from static scale", () => {
    const scale = buildRenderScale({ min: 0, max: 150, log: true, zeroThreshold: 0.005 });
    expect(scale.renderMin).toBe(0);
    expect(scale.renderMax).toBe(150);
    expect(scale.range).toBe(150);
    expect(scale.isLog).toBe(true);
    expect(scale.logDenom).toBeGreaterThan(1);
    expect(scale.zeroThreshold).toBe(0.005);
  });

  it("computes positive accumulation differences and preserves missing values", () => {
    const current = new Float32Array([5, 10, missingValue, 3]);
    const previous = new Float32Array([2, 12, 1, missingValue]);

    const result = computeAccumulationDisplayValues({
      current,
      previous,
      missingValue,
    });

    expect([...result]).toEqual([3, 0, missingValue, missingValue]);
  });

  it("creates render params with display units and scale", () => {
    const params = createRenderParams({
      data: {
        values: [1, 2],
        product: { shortName: "t", units: "K" },
        grid: { ni: 2, nj: 1 },
        header: { centre: 85 },
      },
      staticScale: { min: -30, max: 50 },
      unitTransform: "K_TO_C",
      displayUnits: "°C",
    });

    expect(params.values).toBeInstanceOf(Float32Array);
    expect(params.renderMin).toBe(-30);
    expect(params.range).toBe(80);
    expect(params.displayUnits).toBe("°C");
    expect(params.grid).toEqual({ ni: 2, nj: 1 });
  });
});
```

- [ ] **Step 2: Run the render parameter test and verify it fails**

Run:

```bash
npm test -- src/domain/render-params.test.js
```

Expected: FAIL because `./render-params.js` does not exist.

- [ ] **Step 3: Implement render parameter helpers**

Create `apps/visualize/src/domain/render-params.js`:

```js
import { LOG_SCALE_FLOOR } from "./palettes.js";

export function toFloat32Values(values) {
  if (values instanceof Float32Array) return values;
  const out = new Float32Array(values.length);
  out.set(values);
  return out;
}

export function buildRenderScale(staticScale) {
  const renderMin = staticScale ? staticScale.min : 0;
  const renderMax = staticScale ? staticScale.max : 1;
  const range = renderMax - renderMin || 1;
  const isLog = staticScale?.log ?? false;
  return {
    renderMin,
    renderMax,
    range,
    isLog,
    logDenom: isLog ? Math.log(staticScale.max / LOG_SCALE_FLOOR) : 1,
    zeroThreshold: staticScale?.zeroThreshold ?? 0,
  };
}

export function computeAccumulationDisplayValues({
  current,
  previous,
  missingValue,
}) {
  const diff = new Float32Array(current.length);
  for (let i = 0; i < current.length; i++) {
    if (current[i] >= missingValue || previous[i] >= missingValue) {
      diff[i] = missingValue;
    } else {
      diff[i] = Math.max(0, current[i] - previous[i]);
    }
  }
  return diff;
}

export function createRenderParams({
  data,
  values = data.values,
  staticScale,
  unitTransform,
  displayUnits,
  isFallback = false,
}) {
  const scale = buildRenderScale(staticScale);
  return {
    values: toFloat32Values(values),
    unitTransform,
    staticScale,
    ...scale,
    displayUnits,
    isFallback,
    grid: data.grid,
    product: data.product,
    header: data.header,
  };
}
```

- [ ] **Step 4: Run the render parameter test and verify it passes**

Run:

```bash
npm test -- src/domain/render-params.test.js
```

Expected: PASS.

- [ ] **Step 5: Replace duplicated main-thread render parameter code**

Modify `apps/visualize/index.js` imports:

```js
import {
  buildRenderScale,
  computeAccumulationDisplayValues,
  createRenderParams,
  toFloat32Values,
} from "./src/domain/render-params.js";
```

Replace `toDisplayValues` with `toFloat32Values`. Replace the body of `makeRenderParams` with:

```js
function makeRenderParams(
  data,
  { values = data.values, displayUnits = null, isFallback = false } = {},
) {
  const { product } = data;
  const shortName = product.shortName;
  return createRenderParams({
    data,
    values,
    staticScale: staticScaleFor(shortName),
    unitTransform: unitTransformFor(shortName),
    displayUnits: displayUnits ?? displayUnitsFor(shortName, product.units),
    isFallback,
  });
}
```

In `computeRenderParams`, replace the manual diff loop with:

```js
displayValues = computeAccumulationDisplayValues({
  current: values,
  previous: prevData.values,
  missingValue: MISSING_VALUE,
});
```

In `modelWorkerRequestForHour`, replace repeated static scale fields with:

```js
const scale = buildRenderScale(staticScale);
```

and spread:

```js
...scale,
```

- [ ] **Step 6: Replace duplicated worker accumulation helpers**

Modify `apps/visualize/model-block-worker.js` imports:

```js
import {
  computeAccumulationDisplayValues,
  toFloat32Values,
} from "./src/domain/render-params.js";
```

Replace local `toDisplayValues` with `toFloat32Values`. Replace the manual accumulation diff loop with:

```js
values = computeAccumulationDisplayValues({
  current: current.values,
  previous: previous.values,
  missingValue,
});
```

- [ ] **Step 7: Run focused and full checks**

Run:

```bash
npm test -- src/domain/render-params.test.js
npm test
npm run typecheck
npm run check
npm run build
```

Expected: all commands pass. `npm run build` may still print existing decoder/browser compatibility warnings, but must exit with code 0.

- [ ] **Step 8: Commit**

```bash
git add apps/visualize/src/domain/render-params.js apps/visualize/src/domain/render-params.test.js apps/visualize/index.js apps/visualize/model-block-worker.js
git commit -m "refactor: extract visualize render parameters"
```

---

### Task 3: Extract Data.gouv Resource Provider

**Files:**
- Create: `apps/visualize/src/services/data-gouv-resource-service.js`
- Create: `apps/visualize/src/services/data-gouv-resource-service.test.js`
- Modify: `apps/visualize/index.js`

- [ ] **Step 1: Write failing provider tests**

Create `apps/visualize/src/services/data-gouv-resource-service.test.js`:

```js
import { describe, expect, it, vi } from "vitest";

import {
  createDataGouvResourceService,
  parseDataGouvResources,
  proxyDataGouvUrl,
  proxyResourceUrl,
} from "./data-gouv-resource-service.js";

describe("data.gouv resource service", () => {
  it("builds proxy URLs", () => {
    expect(proxyResourceUrl("https://example.test/path/file.grib2?x=1", "https://proxy.test")).toBe(
      "https://proxy.test/example.test/path/file.grib2?x=1",
    );
    expect(proxyDataGouvUrl("dataset-1", "https://proxy.test")).toBe(
      "https://proxy.test/www.data.gouv.fr/api/1/datasets/dataset-1/",
    );
  });

  it("parses single-hour and ranged GRIB resources", () => {
    const resources = parseDataGouvResources(
      [
        {
          format: "grib2",
          title: "AROME__SP1__01H__2026-04-25T03_00_00Z.grib2",
          url: "https://files.test/AROME__SP1__01H__2026-04-25T03_00_00Z.grib2",
          filesize: 10,
        },
        {
          format: "grib2",
          title: "AROME__SP1__02H03H__2026-04-25T03_00_00Z.grib2",
          url: "https://files.test/AROME__SP1__02H03H__2026-04-25T03_00_00Z.grib2",
          filesize: 20,
        },
        {
          format: "txt",
          title: "ignored__SP1__04H__2026-04-25T03_00_00Z.txt",
          url: "https://files.test/ignored.txt",
          filesize: 1,
        },
      ],
      "__SP1__",
    );

    expect(resources).toEqual([
      expect.objectContaining({ startHour: 1, endHour: 1, key: "01H", filesize: 10 }),
      expect.objectContaining({ startHour: 2, endHour: 3, key: "02H03H", filesize: 20 }),
    ]);
  });

  it("fetches resources through an injected fetch implementation", async () => {
    const fetchImpl = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        resources: [
          {
            format: "grib2",
            title: "AROME__SP2__05H__2026-04-25T03_00_00Z.grib2",
            url: "https://files.test/AROME__SP2__05H__2026-04-25T03_00_00Z.grib2",
            filesize: 30,
          },
        ],
      }),
    }));
    const service = createDataGouvResourceService({
      proxyBaseUrl: "https://proxy.test",
      fetchImpl,
    });

    const resources = await service.fetchResources("dataset-2", "__SP2__");

    expect(fetchImpl).toHaveBeenCalledWith(
      "https://proxy.test/www.data.gouv.fr/api/1/datasets/dataset-2/",
    );
    expect(resources).toHaveLength(1);
    expect(resources[0]).toEqual(expect.objectContaining({ key: "05H" }));
  });

  it("throws a readable API error", async () => {
    const service = createDataGouvResourceService({
      proxyBaseUrl: "https://proxy.test",
      fetchImpl: async () => ({ ok: false, status: 503 }),
    });

    await expect(service.fetchResources("dataset-2", "__SP2__")).rejects.toThrow("API 503");
  });
});
```

- [ ] **Step 2: Run the provider test and verify it fails**

Run:

```bash
npm test -- src/services/data-gouv-resource-service.test.js
```

Expected: FAIL because `./data-gouv-resource-service.js` does not exist.

- [ ] **Step 3: Implement provider service**

Create `apps/visualize/src/services/data-gouv-resource-service.js`:

```js
import { extractRunId } from "../domain/resources.js";

export function proxyResourceUrl(url, proxyBaseUrl) {
  const parsed = new URL(url);
  return `${proxyBaseUrl}/${parsed.hostname}${parsed.pathname}${parsed.search}`;
}

export function proxyDataGouvUrl(datasetId, proxyBaseUrl) {
  return `${proxyBaseUrl}/www.data.gouv.fr/api/1/datasets/${datasetId}/`;
}

function parseResourceTitle(resource) {
  const single = resource.title.match(/__(\d+)H__/);
  const range = resource.title.match(/__(\d+)H(\d+)H__/);
  const runId = extractRunId(`${resource.title} ${resource.url}`);

  if (single) {
    return {
      startHour: Number(single[1]),
      endHour: Number(single[1]),
      key: single[0].slice(2, -2),
      runId,
      title: resource.title,
      url: resource.url,
      filesize: resource.filesize,
    };
  }

  if (range) {
    return {
      startHour: Number(range[1]),
      endHour: Number(range[2]),
      key: range[0].slice(2, -2),
      runId,
      title: resource.title,
      url: resource.url,
      filesize: resource.filesize,
    };
  }

  return null;
}

export function parseDataGouvResources(resources, titlePattern) {
  return resources
    .filter((resource) => resource.format === "grib2" && resource.title?.includes(titlePattern))
    .map(parseResourceTitle)
    .filter(Boolean)
    .sort((a, b) => a.startHour - b.startHour);
}

export function createDataGouvResourceService({
  proxyBaseUrl,
  fetchImpl = fetch,
}) {
  return {
    proxyResourceUrl(url) {
      return proxyResourceUrl(url, proxyBaseUrl);
    },

    async fetchResources(datasetId, titlePattern) {
      const response = await fetchImpl(proxyDataGouvUrl(datasetId, proxyBaseUrl));
      if (!response.ok) throw new Error(`API ${response.status}`);
      const data = await response.json();
      return parseDataGouvResources(data.resources, titlePattern);
    },
  };
}
```

- [ ] **Step 4: Run the provider test and verify it passes**

Run:

```bash
npm test -- src/services/data-gouv-resource-service.test.js
```

Expected: PASS.

- [ ] **Step 5: Wire provider into `index.js`**

Modify imports in `apps/visualize/index.js`:

```js
import { createDataGouvResourceService } from "./src/services/data-gouv-resource-service.js";
```

Create the service after constants:

```js
const dataGouvResourceService = createDataGouvResourceService({
  proxyBaseUrl: PROXY,
});
```

Replace `proxyUrl`:

```js
function proxyUrl(url) {
  return dataGouvResourceService.proxyResourceUrl(url);
}
```

Replace `fetchDataGouvResources` body:

```js
async function fetchDataGouvResources(datasetId, titlePattern) {
  return dataGouvResourceService.fetchResources(datasetId, titlePattern);
}
```

- [ ] **Step 6: Run focused and full checks**

Run:

```bash
npm test -- src/services/data-gouv-resource-service.test.js
npm test
npm run typecheck
npm run check
```

Expected: all commands pass.

- [ ] **Step 7: Commit**

```bash
git add apps/visualize/src/services/data-gouv-resource-service.js apps/visualize/src/services/data-gouv-resource-service.test.js apps/visualize/index.js
git commit -m "refactor: extract data gouv resource service"
```

---

### Task 4: Clarify Forecast State and Remove Stale Main-Thread Decode Path

**Files:**
- Create: `apps/visualize/src/domain/forecast-state.js`
- Create: `apps/visualize/src/domain/forecast-state.test.js`
- Modify: `apps/visualize/index.js`

- [ ] **Step 1: Write failing forecast state tests**

Create `apps/visualize/src/domain/forecast-state.test.js`:

```js
import { describe, expect, it } from "vitest";

import {
  blockForHour,
  buildHourList,
  createModelState,
  markBlockAvailable,
} from "./forecast-state.js";

describe("forecast state", () => {
  it("creates explicit forecast state defaults", () => {
    const state = createModelState("AROME_SP1");

    expect(state).toEqual({
      packageKey: "AROME_SP1",
      resourceRefreshId: 0,
      resources: [],
      availableBlocks: expect.any(Set),
      hourList: [],
      blockStatus: expect.any(Map),
      variable: null,
      currentHour: null,
      lastRunInfo: null,
      animationCacheStatus: "waiting",
    });
    expect(state.availableBlocks.size).toBe(0);
  });

  it("builds one hour entry per block hour", () => {
    expect(
      buildHourList([
        { startHour: 1, endHour: 2 },
        { startHour: 4, endHour: 4 },
      ]),
    ).toEqual([1, 2, 4]);
  });

  it("finds the block covering an hour", () => {
    const resources = [
      { key: "01H02H", startHour: 1, endHour: 2 },
      { key: "03H", startHour: 3, endHour: 3 },
    ];

    expect(blockForHour(resources, 2)).toEqual(resources[0]);
    expect(blockForHour(resources, 3)).toEqual(resources[1]);
    expect(blockForHour(resources, 4)).toBeNull();
  });

  it("tracks available blocks by key", () => {
    const state = createModelState("AROME_SP1");

    markBlockAvailable(state, { key: "01H" });

    expect(state.availableBlocks.has("01H")).toBe(true);
  });
});
```

- [ ] **Step 2: Run the forecast state test and verify it fails**

Run:

```bash
npm test -- src/domain/forecast-state.test.js
```

Expected: FAIL because `./forecast-state.js` does not exist.

- [ ] **Step 3: Implement forecast state module**

Create `apps/visualize/src/domain/forecast-state.js`:

```js
export function createModelState(packageKey) {
  return {
    packageKey,
    resourceRefreshId: 0,
    resources: [],
    availableBlocks: new Set(),
    hourList: [],
    blockStatus: new Map(),
    variable: null,
    currentHour: null,
    lastRunInfo: null,
    animationCacheStatus: "waiting",
  };
}

export function buildHourList(resources) {
  const hourList = [];
  for (const resource of resources) {
    for (let hour = resource.startHour; hour <= resource.endHour; hour++) {
      hourList.push(hour);
    }
  }
  return hourList;
}

export function blockForHour(resources, hour) {
  return resources.find((resource) => hour >= resource.startHour && hour <= resource.endHour) ?? null;
}

export function markBlockAvailable(state, block) {
  state.availableBlocks.add(block.key);
}
```

- [ ] **Step 4: Run the forecast state test and verify it passes**

Run:

```bash
npm test -- src/domain/forecast-state.test.js
```

Expected: PASS.

- [ ] **Step 5: Replace forecast state internals in `index.js`**

Modify imports in `apps/visualize/index.js`:

```js
import {
  blockForHour as findBlockForHour,
  buildHourList,
  createModelState,
  markBlockAvailable,
} from "./src/domain/forecast-state.js";
```

Remove local `createModelState` and `buildHourList`.

Replace local `blockForHour` with:

```js
function blockForHour(hour) {
  return findBlockForHour(modelState?.resources ?? [], hour);
}
```

Replace every `modelState.buffers.has(block.key)` check with:

```js
modelState.availableBlocks.has(block.key)
```

Replace:

```js
modelState.buffers.set(block.key, true);
```

with:

```js
markBlockAvailable(modelState, block);
```

Replace:

```js
for (const blockKey of modelState.buffers.keys()) {
```

with:

```js
for (const blockKey of modelState.availableBlocks) {
```

- [ ] **Step 6: Remove stale main-thread forecast decode helpers**

Remove these unused forecast decode helpers from `apps/visualize/index.js`:

```js
async function getCachedDecode(hour) { ... }
function messageViewFromRef(ref) { ... }
function indexBlock(blockKey) { ... }
async function computeRenderParams(data, idx) { ... }
```

Keep `evictDecodedHour` only if it is still called. If only `invalidateBlockRenderCache` calls it, replace that call with no-op removal because decoded values now live in `model-block-worker.js`.

Remove these state fields from main-thread model state usage:

```js
messageIndex
decoded
decodedOrder
```

Update `updatePerfDiagnostics` so decoded count becomes worker-independent:

```js
const decodedSize = 0;
```

or hide the decoded diagnostic when the worker owns decoded state:

```js
document.getElementById("perf-debug-decoded").textContent = "decoded worker";
```

- [ ] **Step 7: Run focused and full checks**

Run:

```bash
npm test -- src/domain/forecast-state.test.js
npm test
npm run typecheck
npm run check
npm run build
```

Expected: all commands pass. `npm run build` may still print existing decoder/browser compatibility warnings, but must exit with code 0.

- [ ] **Step 8: Commit**

```bash
git add apps/visualize/src/domain/forecast-state.js apps/visualize/src/domain/forecast-state.test.js apps/visualize/index.js
git commit -m "refactor: clarify forecast block availability state"
```

---

### Task 5: Extract Shared Worker RPC Client

**Files:**
- Create: `apps/visualize/src/workers/worker-rpc-client.js`
- Create: `apps/visualize/src/workers/worker-rpc-client.test.js`
- Modify: `apps/visualize/src/workers/model-block-worker-client.js`
- Modify: `apps/visualize/src/workers/download-worker-client.js`
- Modify: `apps/visualize/index.js`

- [ ] **Step 1: Write failing worker RPC tests**

Create `apps/visualize/src/workers/worker-rpc-client.test.js`:

```js
import { describe, expect, it, vi } from "vitest";

import { createWorkerRpcClient } from "./worker-rpc-client.js";

class FakeWorker {
  constructor() {
    this.listeners = new Map();
    this.messages = [];
  }

  addEventListener(type, listener) {
    this.listeners.set(type, listener);
  }

  removeEventListener(type) {
    this.listeners.delete(type);
  }

  postMessage(message, transfer) {
    this.messages.push({ message, transfer });
  }

  emitMessage(data) {
    this.listeners.get("message")?.({ data });
  }

  emitError(error) {
    this.listeners.get("error")?.(error);
  }
}

describe("worker RPC client", () => {
  it("adds a callId and resolves matching responses", async () => {
    const worker = new FakeWorker();
    const client = createWorkerRpcClient({ getWorker: () => worker });

    const promise = client.post({ type: "ping" }, ["transfer"]);
    expect(worker.messages[0]).toEqual({
      message: { type: "ping", callId: 1 },
      transfer: ["transfer"],
    });

    worker.emitMessage({ callId: 1, ok: true });

    await expect(promise).resolves.toEqual({ callId: 1, ok: true });
  });

  it("ignores responses for other call IDs", async () => {
    const worker = new FakeWorker();
    const client = createWorkerRpcClient({ getWorker: () => worker });

    const promise = client.post({ type: "ping" });
    worker.emitMessage({ callId: 999, ok: false });
    worker.emitMessage({ callId: 1, ok: true });

    await expect(promise).resolves.toEqual({ callId: 1, ok: true });
  });

  it("maps worker errors through the configured error handler", async () => {
    const onError = vi.fn();
    const worker = new FakeWorker();
    const client = createWorkerRpcClient({
      getWorker: () => worker,
      onError,
    });

    const promise = client.post({ type: "ping" });
    worker.emitMessage({ callId: 1, error: "boom" });

    await expect(promise).resolves.toBeNull();
    expect(onError).toHaveBeenCalledWith("boom");
  });
});
```

- [ ] **Step 2: Run the worker RPC test and verify it fails**

Run:

```bash
npm test -- src/workers/worker-rpc-client.test.js
```

Expected: FAIL because `./worker-rpc-client.js` does not exist.

- [ ] **Step 3: Implement shared worker RPC client**

Create `apps/visualize/src/workers/worker-rpc-client.js`:

```js
export function createWorkerRpcClient({ getWorker, onError = () => {} }) {
  let nextCallId = 0;

  function post(message, transfer = []) {
    const worker = getWorker();
    const callId = ++nextCallId;
    return new Promise((resolve) => {
      function cleanup() {
        worker.removeEventListener("message", onMessage);
        worker.removeEventListener("error", onWorkerError);
      }

      function onMessage({ data }) {
        if (data.callId !== callId) return;
        cleanup();
        if (data.error) {
          onError(data.error);
          resolve(null);
          return;
        }
        resolve(data);
      }

      function onWorkerError(error) {
        cleanup();
        onError(error);
        resolve(null);
      }

      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onWorkerError);
      worker.postMessage({ ...message, callId }, transfer);
    });
  }

  return { post };
}
```

- [ ] **Step 4: Run the worker RPC test and verify it passes**

Run:

```bash
npm test -- src/workers/worker-rpc-client.test.js
```

Expected: PASS.

- [ ] **Step 5: Use RPC client in model block worker client**

Modify `apps/visualize/src/workers/model-block-worker-client.js`:

```js
import { createWorkerRpcClient } from "./worker-rpc-client.js";

export function createModelBlockWorkerClient() {
  let worker = null;

  function ensureWorker() {
    if (worker) return worker;
    worker = new Worker(new URL("../../model-block-worker.js", import.meta.url), {
      type: "module",
    });
    return worker;
  }

  return createWorkerRpcClient({
    getWorker: ensureWorker,
    onError: (error) => console.error("model-block-worker error:", error),
  });
}
```

- [ ] **Step 6: Use RPC client for download worker calls**

Modify `apps/visualize/src/workers/download-worker-client.js`:

```js
import { createWorkerRpcClient } from "./worker-rpc-client.js";

export function createDownloadWorkerClient() {
  let worker = null;

  function ensureWorker() {
    if (worker) return worker;
    worker = new Worker(new URL("./download-worker.js", import.meta.url), {
      type: "module",
    });
    return worker;
  }

  return createWorkerRpcClient({
    getWorker: ensureWorker,
    onError: (error) => console.error("download-worker error:", error),
  });
}
```

Modify `apps/visualize/index.js` import:

```js
import { createDownloadWorkerClient } from "./src/workers/download-worker-client.js";
```

Replace `downloadWorker` with `downloadWorkerClient` and `initDownloadWorker` with:

```js
function getDownloadWorkerClient() {
  if (!downloadWorkerClient) downloadWorkerClient = createDownloadWorkerClient();
  return downloadWorkerClient;
}
```

Keep progress handling in `downloadFileInWorker` by adding a temporary direct listener only if `createWorkerRpcClient` does not support progress. If progress is needed in the shared client, extend `createWorkerRpcClient.post(message, transfer, { onProgress })` and route `data.progress` without resolving:

```js
if (data.progress) {
  onProgress?.(data);
  return;
}
```

- [ ] **Step 7: Run focused and full checks**

Run:

```bash
npm test -- src/workers/worker-rpc-client.test.js
npm test
npm run typecheck
npm run check
npm run build
```

Expected: all commands pass. `npm run build` may still print existing decoder/browser compatibility warnings, but must exit with code 0.

- [ ] **Step 8: Commit**

```bash
git add apps/visualize/src/workers/worker-rpc-client.js apps/visualize/src/workers/worker-rpc-client.test.js apps/visualize/src/workers/model-block-worker-client.js apps/visualize/src/workers/download-worker-client.js apps/visualize/index.js
git commit -m "refactor: share worker rpc client"
```

---

### Task 6: Extract Forecast Download View

**Files:**
- Create: `apps/visualize/src/ui/forecast-download-view.js`
- Create: `apps/visualize/src/ui/forecast-download-view.test.js`
- Modify: `apps/visualize/index.js`

- [ ] **Step 1: Write failing forecast download view tests**

Create `apps/visualize/src/ui/forecast-download-view.test.js`:

```js
import { beforeEach, describe, expect, it } from "vitest";

import { BLOCK_STATUS } from "./data-status-summary.js";
import { createForecastDownloadView } from "./forecast-download-view.js";

describe("forecast download view", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="forecast-dl-status"></div>
      <div id="forecast-dl-bars"></div>
      <ul id="forecast-dl-file-list"></ul>
    `;
  });

  function createView() {
    return createForecastDownloadView({
      document,
      barsEl: document.getElementById("forecast-dl-bars"),
      fileListEl: document.getElementById("forecast-dl-file-list"),
      statusEl: document.getElementById("forecast-dl-status"),
      formatRunSummary: () => "run 2026-04-25 03 UTC",
      formatSize: (size) => `${size} B`,
    });
  }

  it("renders bar and file items", () => {
    const view = createView();

    view.renderItems([
      {
        key: "01H",
        url: "https://files.test/file-01.grib2",
        filesize: 123,
      },
    ]);

    expect(document.getElementById("dl-01H").textContent).toBe("01H");
    expect(document.getElementById("dl-file-01H").textContent).toContain("file-01.grib2 · 123 B");
  });

  it("updates block status classes and labels", () => {
    const view = createView();
    const block = {
      key: "01H",
      url: "https://files.test/file-01.grib2",
      filesize: 123,
    };

    view.renderItems([block]);
    view.setBlockStatus(block, BLOCK_STATUS.READY);

    expect(document.getElementById("dl-01H").classList.contains("done")).toBe(true);
    expect(document.getElementById("dl-file-01H").classList.contains("done")).toBe(true);
    expect(document.querySelector(".forecast-download-file__status").textContent).toBe("ready");
  });

  it("updates progress and status text", () => {
    const view = createView();
    const block = {
      key: "01H",
      url: "https://files.test/file-01.grib2",
      filesize: 123,
    };

    view.renderItems([block]);
    view.setBlockDownloadProgress(block, "42%");
    view.setStatus("1 / 2 files");

    expect(document.getElementById("dl-01H").style.getPropertyValue("--pct")).toBe("42%");
    expect(document.getElementById("forecast-dl-status").textContent).toBe("1 / 2 files");
  });
});
```

- [ ] **Step 2: Run the forecast download view test and verify it fails**

Run:

```bash
npm test -- src/ui/forecast-download-view.test.js
```

Expected: FAIL because `./forecast-download-view.js` does not exist.

- [ ] **Step 3: Implement forecast download view**

Create `apps/visualize/src/ui/forecast-download-view.js`:

```js
import {
  BLOCK_STATUS,
  BLOCK_STATUS_CLASSES,
  BLOCK_STATUS_LABELS,
} from "./data-status-summary.js";

export function createForecastDownloadView({
  document,
  barsEl,
  fileListEl,
  statusEl,
  formatRunSummary,
  formatSize,
}) {
  function setStatus(message) {
    statusEl.textContent = message;
  }

  function setBlockStatus(block, status) {
    block.status = status;

    const item = document.getElementById(`dl-${block.key}`);
    if (item) {
      item.classList.remove(...BLOCK_STATUS_CLASSES);
      item.classList.add(status);
      if (status === BLOCK_STATUS.READY) item.classList.add("done");
      item.title = `${formatRunSummary([block])} · ${status}`;
    }

    const fileItem = document.getElementById(`dl-file-${block.key}`);
    if (fileItem) {
      fileItem.classList.remove(...BLOCK_STATUS_CLASSES);
      fileItem.classList.add(status);
      if (status === BLOCK_STATUS.READY) fileItem.classList.add("done");
      fileItem.querySelector(".forecast-download-file__status").textContent =
        BLOCK_STATUS_LABELS[status] ?? status;
    }
  }

  function setBlockDownloadProgress(block, pct) {
    document.getElementById(`dl-${block.key}`)?.style.setProperty("--pct", pct);
  }

  function renderItems(resources) {
    barsEl.innerHTML = "";
    fileListEl.innerHTML = "";
    for (const resource of resources) {
      setBlockStatus(resource, BLOCK_STATUS.MISSING);

      const item = document.createElement("div");
      item.className = `forecast-download-bar ${BLOCK_STATUS.MISSING}`;
      item.id = `dl-${resource.key}`;
      item.textContent = resource.key;
      item.title = formatRunSummary([resource]);
      barsEl.appendChild(item);

      const li = document.createElement("li");
      li.id = `dl-file-${resource.key}`;
      li.className = `forecast-download-file ${BLOCK_STATUS.MISSING}`;

      const fileLabel = document.createElement("span");
      fileLabel.textContent = `${resource.url.split("/").pop()} · ${formatSize(resource.filesize)}`;

      const statusLabel = document.createElement("span");
      statusLabel.className = "forecast-download-file__status";
      statusLabel.textContent = BLOCK_STATUS_LABELS[BLOCK_STATUS.MISSING];

      li.append(fileLabel, statusLabel);
      fileListEl.appendChild(li);
    }
  }

  function clear() {
    barsEl.innerHTML = "";
    fileListEl.innerHTML = "";
  }

  return {
    clear,
    renderItems,
    setBlockDownloadProgress,
    setBlockStatus,
    setStatus,
  };
}
```

- [ ] **Step 4: Run the forecast download view test and verify it passes**

Run:

```bash
npm test -- src/ui/forecast-download-view.test.js
```

Expected: PASS.

- [ ] **Step 5: Wire forecast download view into `index.js`**

Modify imports:

```js
import { createForecastDownloadView } from "./src/ui/forecast-download-view.js";
```

Create the view after `dom`:

```js
const forecastDownloadView = createForecastDownloadView({
  document,
  barsEl: dom.forecastDownloadBars,
  fileListEl: dom.forecastDownloadFileList,
  statusEl: dom.forecastDownloadStatus,
  formatRunSummary,
  formatSize: fmtSize,
});
```

Replace:

```js
dom.forecastDownloadBars.innerHTML = "";
dom.forecastDownloadFileList.innerHTML = "";
```

with:

```js
forecastDownloadView.clear();
```

Replace local `renderDownloadItems`, `setBlockDownloadProgress`, and DOM mutation parts of `setBlockStatus` with calls to:

```js
forecastDownloadView.renderItems(resources);
forecastDownloadView.setBlockDownloadProgress(block, pct);
forecastDownloadView.setBlockStatus(block, status);
```

Keep model state mutation in `index.js`:

```js
block.status = status;
modelState?.blockStatus?.set(block.key, status);
forecastDownloadView.setBlockStatus(block, status);
updateDataStatusSummary();
```

- [ ] **Step 6: Run focused and full checks**

Run:

```bash
npm test -- src/ui/forecast-download-view.test.js
npm test
npm run typecheck
npm run check
```

Expected: all commands pass.

- [ ] **Step 7: Commit**

```bash
git add apps/visualize/src/ui/forecast-download-view.js apps/visualize/src/ui/forecast-download-view.test.js apps/visualize/index.js
git commit -m "refactor: extract forecast download view"
```

---

### Task 7: Split Forecast Download CSS Module

**Files:**
- Create: `apps/visualize/style/modules/forecast-download.css`
- Modify: `apps/visualize/style.css`
- Modify: `apps/visualize/style/modules.css`

- [ ] **Step 1: Create forecast download CSS module**

Create `apps/visualize/style/modules/forecast-download.css` with the rules currently covering:

```css
@layer modules {
	.data-status-panel { }
	.data-status-summary { }
	.data-status-count.ready { }
	.data-status-count.loaded-from-cache { }
	.data-status-count.downloading { }
	.data-status-count.missing { }
	.forecast-download-status { }
	.forecast-download-details { }
	.forecast-download-file-list { }
	.forecast-download-file { }
	.forecast-download-file__status { }
	.forecast-download-bars { }
	.forecast-download-bar { }
}
```

Move the complete declarations from `apps/visualize/style/modules.css:291-426` without changing selectors or property order.

- [ ] **Step 2: Import the new CSS file**

Modify `apps/visualize/style.css` by adding:

```css
@import "./style/modules/forecast-download.css" layer(modules);
```

Place it with the other module imports.

- [ ] **Step 3: Run CSS and app checks**

Run:

```bash
npm run check
npm run build
```

Expected: both commands pass. `npm run build` may still print existing decoder/browser compatibility warnings, but must exit with code 0.

- [ ] **Step 4: Commit**

```bash
git add apps/visualize/style.css apps/visualize/style/modules.css apps/visualize/style/modules/forecast-download.css
git commit -m "refactor: split forecast download styles"
```

---

### Task 8: Final Verification and Regression Audit

**Files:**
- Modify only files required by failures found during this task.

- [ ] **Step 1: Run full visualize verification**

Run:

```bash
npm test
npm run typecheck
npm run check
npm run build
```

Expected:

- `npm test`: all test files pass.
- `npm run typecheck`: exits with code 0.
- `npm run check`: exits with code 0.
- `npm run build`: exits with code 0. Existing decoder/browser compatibility warnings are acceptable if unchanged.

- [ ] **Step 2: Inspect remaining `index.js` responsibilities**

Run:

```bash
rg -n "^(async )?function |^let |^const " apps/visualize/index.js
```

Expected: remaining functions are composition, routing handlers, and high-level orchestration. Any pure utility, provider parsing, worker request tracking, or download DOM rendering that remains should be moved into a focused module before completion.

- [ ] **Step 3: Inspect duplicate rendering helpers**

Run:

```bash
rg -n "mercatorY|mercatorCanvasHeight|toDisplayValues|computeAccumulationDisplayValues|Math.max\\(0, .* - .*\\)" apps/visualize
```

Expected:

- `mercatorY` and `mercatorCanvasHeight` appear only in `src/domain/projection.js` and imports/tests.
- `toDisplayValues` no longer appears.
- Accumulation diff appears only in `src/domain/render-params.js` and tests.

- [ ] **Step 4: Inspect stale forecast buffer state**

Run:

```bash
rg -n "modelState\\.buffers|messageIndex|decodedOrder|getCachedDecode|indexBlock|messageViewFromRef|computeRenderParams" apps/visualize
```

Expected: no matches in production code. If a diagnostic text contains `decoded`, it should explicitly describe worker-owned decode state.

- [ ] **Step 5: Commit final cleanup if needed**

If Step 2, 3, or 4 required code changes:

```bash
git add apps/visualize
git commit -m "chore: complete visualize refactor cleanup"
```

If no changes were required, do not create an empty commit.

---

## Self-Review

**Spec coverage:** This plan addresses the review findings: monolithic `index.js`, DRY violations in projection/render/accumulation, stale main-thread buffer contract, high-arity refresh service pressure through later UI/provider extraction, scattered DOM IDs for forecast download, worker request duplication, CSS module split, and missing tests around risky behavior.

**Placeholder scan:** The plan contains no deferred implementation placeholders. Each task has concrete files, test content, implementation content, commands, expected results, and commit commands.

**Type consistency:** The plan consistently uses `availableBlocks` as a `Set`, `createModelState(packageKey)`, `blockForHour(resources, hour)`, `createRenderParams`, `buildRenderScale`, `createWorkerRpcClient`, and `createForecastDownloadView`.
