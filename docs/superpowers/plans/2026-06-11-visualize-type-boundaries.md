# Visualize Type Boundaries Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the `apps/visualize` architecture compiler-enforced by giving shared concepts canonical types, strictly typing use-case ports and composition, and extracting the uploaded-file workflow from the legacy bootstrap.

**Architecture:** Pure forecast and field types live in `domain/`; workflow state and capability ports live beside use cases; browser, worker, canvas, and MapLibre types stay in adapters. Migration is incremental: each task removes one set of loose contracts, keeps behavior unchanged, runs focused tests, and commits before the next slice.

**Tech Stack:** TypeScript 6, JavaScript ES modules, Vitest, Biome, Vite, MapLibre GL, Web Workers.

---

## Execution Rules

- Keep all generated code, comments, tests, and commit messages in English.
- Read every file listed by a task completely before editing it.
- Preserve current user-visible behavior.
- Use test-first development for behavior or contract changes.
- Do not enable `checkJs`; migrate boundary files to `.ts` instead.
- Do not add `any`.
- Do not use open index signatures for known application contracts.
- After each task, run its focused tests, `npm run typecheck:visualize`, and
  `npm run check:visualize`.
- Update this plan's checkboxes as steps complete.

## Target File Ownership

**Domain**

- `src/domain/forecast-types.ts`: packages, variables, resources, run state, statuses.
- `src/domain/field-types.ts`: pure grid, product, header, decoded-field, and numeric value types.

**Forecast application**

- `src/use-cases/forecast/contracts.ts`: refresh keys, download sessions, runtime state, cached frame
  metadata.
- `src/use-cases/forecast/ports.ts`: capability interfaces only.

**External contracts**

- `src/workers/model-block-worker-contracts.ts`: worker requests and responses.
- Adapter-local interfaces for MapLibre, IndexedDB, data.gouv, DOM, canvas, and worker clients.

**Composition**

- `src/composition/forecast-runtime-factory.ts`
- `src/controllers/forecast-run-controller.ts`
- `src/controllers/uploaded-field-controller.ts`
- `src/bootstrap.ts`

### Task 1: Create Canonical Pure Forecast Types

**Files:**

- Create: `apps/visualize/src/domain/forecast-types.ts`
- Create: `apps/visualize/src/domain/forecast-types.test.ts`
- Rename: `apps/visualize/src/domain/model-packages.js` to
  `apps/visualize/src/domain/model-packages.ts`
- Rename: `apps/visualize/src/domain/forecast-state.js` to
  `apps/visualize/src/domain/forecast-state.ts`
- Modify: `apps/visualize/src/domain/types.ts`

- [x] **Step 1: Add type-level fixtures for forecast contracts**

Create `apps/visualize/src/domain/forecast-types.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import {
  BLOCK_STATUS,
  type ForecastPackage,
  type ForecastRunState,
  type RemoteResource,
} from "./forecast-types";

describe("forecast type contracts", () => {
  test("exposes canonical block status values", () => {
    expect(BLOCK_STATUS).toEqual({
      MISSING: "missing",
      LOADED_FROM_CACHE: "loaded-from-cache",
      DOWNLOADING: "downloading",
      READY: "ready",
    });
  });

  test("accepts the package, resource, and run-state shapes used by the application", () => {
    const resource = {
      startHour: 1,
      endHour: 1,
      key: "01H",
      runId: "20260611T00",
      title: "forecast",
      url: "https://example.test/forecast.grib2",
      status: BLOCK_STATUS.MISSING,
    } satisfies RemoteResource;
    const pkg = {
      model: "AROME",
      label: "AROME SP1",
      provider: "data-gouv",
      datasetId: "dataset",
      titlePattern: "__SP1__",
      bounds: [
        [-12, 37.5],
        [16, 55.4],
      ],
      variables: [],
    } satisfies ForecastPackage;
    const state = {
      packageKey: "AROME_SP1",
      resourceRefreshId: 0,
      resources: [resource],
      availableBlocks: new Set<string>(),
      hourList: [1],
      blockStatus: new Map(),
      variable: null,
      currentHour: null,
      lastRunInfo: null,
      animationCacheStatus: "waiting",
      showWindDirection: true,
    } satisfies ForecastRunState;

    expect(pkg.model).toBe("AROME");
    expect(state.resources).toEqual([resource]);
  });
});
```

- [x] **Step 2: Run the fixture and verify it fails**

Run:

```bash
npm test -w visualize -- src/domain/forecast-types.test.ts
```

Expected: FAIL because `forecast-types.ts` does not exist.

- [x] **Step 3: Create canonical forecast types**

Create `apps/visualize/src/domain/forecast-types.ts` with:

```ts
export const BLOCK_STATUS = {
  MISSING: "missing",
  LOADED_FROM_CACHE: "loaded-from-cache",
  DOWNLOADING: "downloading",
  READY: "ready",
} as const;

export type BlockStatus = (typeof BLOCK_STATUS)[keyof typeof BLOCK_STATUS];
export type AnimationCacheStatus = "waiting" | "building" | "ready";
export type CacheLoadStatus = "current" | "stale" | "missing";
export type PackageKey = string;
export type ModelName = "AROME" | "ARPEGE" | string;

export interface ForecastVariable {
  shortName: string;
  varKey?: string;
  levelValue?: number;
  name: string;
  units: string;
  level: string;
  group?: string;
}

export interface ForecastPackage {
  model: ModelName;
  label: string;
  provider: string;
  datasetId: string;
  titlePattern: string;
  skipHour0?: boolean;
  bounds: [[number, number], [number, number]];
  variables: ForecastVariable[];
  homeVariableGroups?: Array<{
    group: string;
    names: string[];
  }>;
}

export interface RemoteResource {
  startHour: number;
  endHour: number;
  key: string;
  runId: string;
  title: string;
  url: string;
  filesize?: number | null;
  status?: BlockStatus;
}

export interface ForecastRunState {
  packageKey: PackageKey;
  resourceRefreshId: number;
  resources: RemoteResource[];
  availableBlocks: Set<string>;
  hourList: number[];
  blockStatus: Map<string, BlockStatus>;
  variable: string | null;
  currentHour: number | null;
  lastRunInfo: string | null;
  animationCacheStatus: AnimationCacheStatus;
  showWindDirection: boolean;
}
```

- [x] **Step 4: Convert the existing domain producers to TypeScript**

Use `git mv`:

```bash
git mv apps/visualize/src/domain/model-packages.js \
  apps/visualize/src/domain/model-packages.ts
git mv apps/visualize/src/domain/forecast-state.js \
  apps/visualize/src/domain/forecast-state.ts
```

Type the package helpers, package registry, state helpers, and their parameters directly:

```ts
export const PACKAGES = {
  // existing package definitions
} satisfies Record<string, ForecastPackage>;

export function createModelState(packageKey: PackageKey): ForecastRunState {
  return {
    // existing state
    showWindDirection: true,
  };
}
```

Keep `.js` import specifiers where required by the current ESM convention. Update existing tests
that currently expect the state without `showWindDirection`.

- [x] **Step 5: Remove duplicated forecast types from `domain/types.ts`**

Delete `PackageKey`, `ModelName`, `BlockStatus`, `CacheLoadStatus`, `AnimationCacheStatus`,
`ForecastVariable`, `ForecastPackage`, `RemoteResource`, and `ForecastRunState` from
`domain/types.ts`.

Replace imports from `domain/types.ts` with imports from `domain/forecast-types.ts`.

- [x] **Step 6: Run focused and static checks**

Run:

```bash
npm test -w visualize -- src/domain/forecast-types.test.ts src/domain/forecast-state.test.js src/domain/model-packages.test.js
npm run typecheck:visualize
npm run check:visualize
```

Expected: all commands pass.

- [x] **Step 7: Commit**

```bash
git add apps/visualize/src/domain
git commit -m "refactor: centralize forecast domain types"
```

### Task 2: Separate Pure Field Types From Browser Types

**Files:**

- Create: `apps/visualize/src/domain/field-types.ts`
- Create: `apps/visualize/src/domain/field-types.test.ts`
- Modify: `apps/visualize/src/domain/types.ts`
- Modify: files importing grid, product, header, decoded-field, scale, or numeric-value types

- [ ] **Step 1: Add a pure field contract test**

Create `apps/visualize/src/domain/field-types.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import type {
  DecodedField,
  GridDefinition,
  NumericFieldValues,
  ProductDefinition,
} from "./field-types";

describe("field type contracts", () => {
  test("represents decoded fields without browser rendering objects", () => {
    const grid = {
      ni: 2,
      nj: 2,
      dj: 1,
      latitudeOfFirstPoint: 2,
      longitudeOfFirstPoint: 0,
      latitudeOfLastPoint: 1,
      longitudeOfLastPoint: 1,
    } satisfies GridDefinition;
    const product = {
      shortName: "t",
      name: "Temperature",
      units: "K",
    } satisfies ProductDefinition;
    const values: NumericFieldValues = new Float32Array([1, 2, 3, 4]);
    const field = {
      values,
      grid,
      product,
      header: {},
    } satisfies DecodedField;

    expect(field.values).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Verify the new test fails**

Run:

```bash
npm test -w visualize -- src/domain/field-types.test.ts
```

Expected: FAIL because `field-types.ts` does not exist.

- [ ] **Step 3: Create the pure field type module**

Move these definitions from `domain/types.ts` into `domain/field-types.ts`:

```ts
export type NumericFieldValues = Float32Array | Float64Array;
export type UnitTransformKey = "t" | "wspd" | "p" | "msl" | "tcc" | null;

export interface StaticScale {
  min: number;
  max: number;
  log?: boolean;
  zeroThreshold?: number;
}

export interface GridDefinition {
  ni: number;
  nj: number;
  di?: number;
  dj: number;
  latitudeOfFirstPoint: number;
  longitudeOfFirstPoint: number;
  latitudeOfLastPoint: number;
  longitudeOfLastPoint: number;
}

export interface ProductDefinition {
  shortName: string;
  name?: string;
  units?: string;
  level?: string;
  levelValue?: number;
  forecastTime?: number;
  timeUnit?: number;
  pdtNumber?: number;
}

export interface MessageHeader {
  centre?: number;
  refTime?: string | Date;
}

export interface DecodedField {
  values: NumericFieldValues;
  grid: GridDefinition;
  product: ProductDefinition;
  header: MessageHeader;
}
```

Keep variable metadata types in their existing domain module or move them only if they are already
shared by multiple modules.

- [ ] **Step 4: Move browser-only render types out of `domain/types.ts`**

Do not recreate `RenderFieldResult`, `RenderWorkerResult`, `ModelBlockRenderResult`, or
`ForecastDownloadSession` in the domain. These move in later tasks to worker or use-case contracts.

Delete `domain/types.ts` when no imports remain. If variable metadata types remain, rename the file
to `variable-metadata-types.ts` and update imports.

- [ ] **Step 5: Run focused and static checks**

Run:

```bash
npm test -w visualize -- src/domain/field-types.test.ts src/domain/forecast-field.test.js src/workers/render-field-core.test.js
npm run typecheck:visualize
npm run check:visualize
```

Expected: all commands pass and `rg "ImageBitmap|ImageData|HTMLInputElement" apps/visualize/src/domain`
returns no matches.

- [ ] **Step 6: Commit**

```bash
git add apps/visualize/src/domain apps/visualize/src/workers
git commit -m "refactor: isolate pure field types"
```

### Task 3: Define Strict Forecast Workflow Contracts

**Files:**

- Create: `apps/visualize/src/use-cases/forecast/contracts.ts`
- Create: `apps/visualize/src/use-cases/forecast/contracts.test.ts`
- Modify: `apps/visualize/src/use-cases/forecast/ports.ts`
- Modify: `apps/visualize/src/use-cases/forecast/resource-refresh.ts`
- Modify: `apps/visualize/src/use-cases/forecast/manage-download-session.ts`
- Modify: `apps/visualize/src/use-cases/forecast/prepare-download-session.ts`
- Modify: `apps/visualize/src/use-cases/forecast/start-initial-download.ts`
- Modify: `apps/visualize/src/use-cases/forecast/load-resources.ts`
- Modify: `apps/visualize/src/use-cases/forecast/update-resources.ts`

- [ ] **Step 1: Add contract fixtures**

Create `contracts.test.ts` with valid `ForecastRefreshKey` and `ForecastDownloadSession` fixtures:

```ts
import { describe, expect, test } from "vitest";
import {
  BLOCK_STATUS,
  type ForecastPackage,
  type ForecastRunState,
  type ForecastVariable,
} from "../../domain/forecast-types";
import type { ForecastDownloadSession, ForecastRefreshKey } from "./contracts";

describe("forecast workflow contracts", () => {
  test("models refresh identity and download session without DOM elements", () => {
    const state = {
      packageKey: "AROME_SP1",
      resourceRefreshId: 1,
      resources: [],
      availableBlocks: new Set<string>(),
      hourList: [],
      blockStatus: new Map(),
      variable: null,
      currentHour: null,
      lastRunInfo: null,
      animationCacheStatus: "waiting",
      showWindDirection: true,
    } satisfies ForecastRunState;
    const pkg = {
      model: "AROME",
      label: "AROME SP1",
      provider: "data-gouv",
      datasetId: "dataset",
      titlePattern: "__SP1__",
      bounds: [
        [-12, 37.5],
        [16, 55.4],
      ],
      variables: [],
    } satisfies ForecastPackage;
    const refreshKey = { state, refreshId: 1 } satisfies ForecastRefreshKey;
    const session = {
      packageKey: "AROME_SP1",
      pkg,
      pkgVars: [] satisfies ForecastVariable[],
      resources: [],
      runSummary: "2026-06-11 00:00 UTC",
      downloadKey: refreshKey,
      availableCount: 0,
      legendInitialized: false,
    } satisfies ForecastDownloadSession;

    expect(session.downloadKey.state.blockStatus.size).toBe(0);
    expect(BLOCK_STATUS.READY).toBe("ready");
  });
});
```

- [ ] **Step 2: Verify the fixture fails**

Run:

```bash
npm test -w visualize -- src/use-cases/forecast/contracts.test.ts
```

Expected: FAIL because `contracts.ts` does not exist.

- [ ] **Step 3: Create strict workflow contracts**

Create `contracts.ts`:

```ts
import type {
  ForecastPackage,
  ForecastRunState,
  ForecastVariable,
  PackageKey,
  RemoteResource,
} from "../../domain/forecast-types";

export interface ForecastRefreshKey {
  state: ForecastRunState;
  refreshId: number;
}

export interface ForecastDownloadSession {
  packageKey: PackageKey;
  pkg: ForecastPackage;
  pkgVars: ForecastVariable[];
  resources: RemoteResource[];
  runSummary: string;
  downloadKey: ForecastRefreshKey;
  availableCount: number;
  legendInitialized: boolean;
}
```

Do not add a slider, DOM element, or presentation-queue implementation state to the session.

- [ ] **Step 4: Replace generic `*Like` contracts**

Update `ports.ts` to import canonical types and remove:

```ts
ForecastPackageLike
ForecastResourceLike
ForecastDownloadSessionLike
ForecastBlockLike
```

Use `ForecastPackage`, `RemoteResource`, `ForecastRunState`, `ForecastRefreshKey`, and
`ForecastDownloadSession` directly. Keep a single `ports.ts` during this migration and do not
duplicate canonical models in it.

- [ ] **Step 5: Align resource/download use cases**

Update the listed use cases to use exact request, state, and return types. Replace `unknown`
download keys with `ForecastRefreshKey`, except at an adapter boundary that genuinely accepts an
opaque token.

Remove local duplicate interfaces from `manage-download-session.ts`.

- [ ] **Step 6: Run focused and static checks**

Run:

```bash
npm test -w visualize -- \
  src/use-cases/forecast/contracts.test.ts \
  src/use-cases/forecast/resource-refresh.test.ts \
  src/use-cases/forecast/manage-download-session.test.ts \
  src/use-cases/forecast/prepare-download-session.test.ts \
  src/use-cases/forecast/start-initial-download.test.ts \
  src/use-cases/forecast/load-resources.test.ts \
  src/use-cases/forecast/update-resources.test.ts
npm run typecheck:visualize
npm run check:visualize
```

Expected: all commands pass.

- [ ] **Step 7: Verify generic contracts are gone from this slice**

Run:

```bash
rg "ForecastPackageLike|ForecastResourceLike|ForecastDownloadSessionLike|ForecastBlockLike" \
  apps/visualize/src/use-cases/forecast
```

Expected: no matches.

- [ ] **Step 8: Commit**

```bash
git add apps/visualize/src/use-cases/forecast
git commit -m "refactor: type forecast workflow contracts"
```

### Task 4: Type Cache And Refresh Capabilities

**Files:**

- Modify: `apps/visualize/src/use-cases/forecast/refresh-blocks.ts`
- Modify: `apps/visualize/src/use-cases/forecast/store-available-block.ts`
- Modify: `apps/visualize/src/use-cases/forecast/manage-presentation-queue.ts`
- Modify: `apps/visualize/src/adapters/forecast/grib-cache-adapter.ts`
- Modify: corresponding tests

- [ ] **Step 1: Add compile-time assertions to refresh tests**

In `refresh-blocks.test.ts`, type the fixtures with `satisfies RemoteResource`,
`satisfies ForecastDownloadSession`, and the exported refresh port type. Add one invalid fixture:

```ts
// @ts-expect-error Remote resources require a URL.
const invalidResource: RemoteResource = { key: "01H" };
```

- [ ] **Step 2: Run typecheck and confirm the current contracts fail**

Run:

```bash
npm run typecheck:visualize
```

Expected: FAIL where loose refresh/session types do not satisfy the canonical contracts.

- [ ] **Step 3: Replace open refresh interfaces**

In `refresh-blocks.ts`:

- replace the local `ForecastBlock` with `RemoteResource`;
- replace the local session with `ForecastDownloadSession`;
- type cache reads and writes with `RemoteResource`;
- return `Promise<void>` for deletion and presentation waiting where values are ignored;
- return `Promise<boolean>` from `refreshBlocksToLatest`;
- use `BlockStatus` for status arguments.

Align `store-available-block.ts`, `manage-presentation-queue.ts`, and the cache adapter.

- [ ] **Step 4: Run focused tests and checks**

Run:

```bash
npm test -w visualize -- \
  src/use-cases/forecast/refresh-blocks.test.ts \
  src/use-cases/forecast/store-available-block.test.ts \
  src/use-cases/forecast/manage-presentation-queue.test.ts \
  src/adapters/forecast/grib-cache-adapter.test.ts
npm run typecheck:visualize
npm run check:visualize
```

Expected: all commands pass.

- [ ] **Step 5: Commit**

```bash
git add apps/visualize/src/use-cases/forecast apps/visualize/src/adapters/forecast/grib-cache-adapter*
git commit -m "refactor: type forecast refresh capabilities"
```

### Task 5: Establish Worker Protocol Contracts

**Files:**

- Create: `apps/visualize/src/workers/model-block-worker-contracts.ts`
- Create: `apps/visualize/src/workers/model-block-worker-contracts.test.ts`
- Modify: `apps/visualize/src/adapters/forecast/model-block-worker-adapter.ts`
- Modify: `apps/visualize/src/workers/model-block-worker-client.js`
- Modify: `apps/visualize/model-block-worker.js`
- Modify: `apps/visualize/src/use-cases/forecast/create-render-request.ts`
- Modify: `apps/visualize/src/use-cases/forecast/render-hour-with-worker.ts`
- Modify: `apps/visualize/src/use-cases/forecast/create-bitmap-cache-entry.ts`
- Modify: corresponding tests

- [ ] **Step 1: Add worker protocol fixtures**

Create `model-block-worker-contracts.test.ts`:

```ts
import { describe, expect, test } from "vitest";
import type {
  ModelBlockRenderRequest,
  ModelBlockRenderResult,
  ModelBlockStoreRequest,
} from "./model-block-worker-contracts";

describe("model block worker contracts", () => {
  test("uses discriminated request types", () => {
    const store = {
      type: "storeBlock",
      blockKey: "01H",
      buffer: new Uint8Array([1]),
    } satisfies ModelBlockStoreRequest;
    const render = {
      type: "renderHour",
      renderGeneration: 1,
      blockKey: "01H",
      hour: 1,
    } as ModelBlockRenderRequest;
    const result = {
      type: "renderHourResult",
      renderGeneration: 1,
      bitmap: {} as ImageBitmap,
      dataMin: 0,
      dataMax: 1,
      dataMean: 0.5,
      dataCount: 4,
    } as ModelBlockRenderResult;

    expect(store.type).toBe("storeBlock");
    expect(render.type).toBe("renderHour");
    expect(result.type).toBe("renderHourResult");
  });
});
```

- [ ] **Step 2: Verify the worker contract test fails**

Run:

```bash
npm test -w visualize -- src/workers/model-block-worker-contracts.test.ts
```

Expected: FAIL because the contract module does not exist.

- [ ] **Step 3: Create discriminated worker contracts**

Move worker requests and results out of `domain/types.ts` into
`model-block-worker-contracts.ts`. Use:

```ts
type ModelBlockWorkerRequest =
  | ModelBlockStoreRequest
  | ModelBlockRenderRequest
  | ModelBlockDecodeValuesRequest;
```

Add discriminants to results where the current worker protocol can support them without behavior
change. Keep `ImageBitmap` and transferable buffers here, not in domain.

- [ ] **Step 4: Type the adapter and use-case ports**

Replace `ModelBlockWorkerMessage`, `RenderHourRequest`, `DecodeValuesRequest`, and casts in
`model-block-worker-adapter.ts` with canonical worker contracts.

Type `create-render-request.ts`, `render-hour-with-worker.ts`, and
`create-bitmap-cache-entry.ts` with exact request/result types. Remove property-by-property
`unknown` declarations.

- [ ] **Step 5: Run focused tests and checks**

Run:

```bash
npm test -w visualize -- \
  src/workers/model-block-worker-contracts.test.ts \
  src/workers/model-block-worker-client.test.js \
  src/adapters/forecast/model-block-worker-adapter.test.ts \
  src/use-cases/forecast/create-render-request.test.ts \
  src/use-cases/forecast/render-hour-with-worker.test.ts \
  src/use-cases/forecast/create-bitmap-cache-entry.test.ts
npm run typecheck:visualize
npm run check:visualize
```

Expected: all commands pass.

- [ ] **Step 6: Commit**

```bash
git add apps/visualize/model-block-worker.js apps/visualize/src/workers \
  apps/visualize/src/adapters/forecast/model-block-worker-adapter* \
  apps/visualize/src/use-cases/forecast
git commit -m "refactor: define model block worker contracts"
```

### Task 6: Type Map Presentation And Overlay Ports

**Files:**

- Modify: `apps/visualize/src/use-cases/forecast/present-map.ts`
- Modify: `apps/visualize/src/use-cases/forecast/update-isobar-overlay.ts`
- Modify: `apps/visualize/src/use-cases/forecast/update-wind-symbol-overlay.ts`
- Modify: `apps/visualize/src/adapters/forecast/maplibre-map-renderer-adapter.ts`
- Modify: `apps/visualize/src/adapters/forecast/isobar-layer-adapter.ts`
- Modify: `apps/visualize/src/adapters/forecast/wind-symbol-layer-adapter.ts`
- Modify: corresponding tests

- [ ] **Step 1: Define the expected map capability in the use-case test**

In `present-map.test.ts`, define the fake with `satisfies ForecastMapPort`:

```ts
const mapPort = {
  clearIsobars: vi.fn(),
  clearWindSymbols: vi.fn(),
  drawBitmap: vi.fn(),
  ensureHeatCanvas: vi.fn(),
  fitBounds: vi.fn(),
  getViewportBounds: vi.fn(),
  getZoom: vi.fn(),
  hasLayer: vi.fn(),
  onViewportSettled: vi.fn(),
  setLayer: vi.fn(),
  setVisible: vi.fn(),
  updateIsobars: vi.fn(),
  updateWindSymbols: vi.fn(),
} satisfies ForecastMapPort;
```

- [ ] **Step 2: Run typecheck and confirm the missing port fails**

Run:

```bash
npm run typecheck:visualize
```

Expected: FAIL because `ForecastMapPort` is not defined/exported.

- [ ] **Step 3: Define pure presentation contracts**

Add exact types for:

- map corners and viewport bounds;
- rendered frame presentation data;
- isobar GeoJSON;
- wind-symbol GeoJSON;
- map canvas capability.

Define an application-owned opaque raster contract:

```ts
export interface ForecastRaster {
  close(): void;
}
```

Use cases and map ports accept `ForecastRaster`. The worker adapter wraps `ImageBitmap` as a
`ForecastRaster`, and the MapLibre adapter performs the narrow unwrap needed to call canvas APIs.
No `CanvasImageSource`, `ImageBitmap`, or `HTMLCanvasElement` type may appear in use-case contracts.

- [ ] **Step 4: Align MapLibre adapters**

Keep MapLibre-specific map, source, layer, and bounds interfaces local to
`maplibre-map-renderer-adapter.ts`. Replace use-case-facing `unknown` arguments with the exact
forecast map port.

- [ ] **Step 5: Run focused tests and checks**

Run:

```bash
npm test -w visualize -- \
  src/use-cases/forecast/present-map.test.ts \
  src/use-cases/forecast/update-isobar-overlay.test.ts \
  src/use-cases/forecast/update-wind-symbol-overlay.test.ts \
  src/adapters/forecast/maplibre-map-renderer-adapter.test.ts \
  src/adapters/forecast/isobar-layer-adapter.test.ts \
  src/adapters/forecast/wind-symbol-layer-adapter.test.ts
npm run typecheck:visualize
npm run check:visualize
```

Expected: all commands pass.

- [ ] **Step 6: Commit**

```bash
git add apps/visualize/src/use-cases/forecast apps/visualize/src/adapters/forecast
git commit -m "refactor: type forecast map presentation"
```

### Task 7: Type Animation And Runtime Contracts

**Files:**

- Modify: `apps/visualize/src/use-cases/forecast/manage-animation.ts`
- Modify: `apps/visualize/src/use-cases/forecast/manage-animation-cache.ts`
- Modify: `apps/visualize/src/use-cases/forecast/manage-hour-render-queue.ts`
- Modify: `apps/visualize/src/use-cases/forecast/drain-prerender-queue.ts`
- Modify: `apps/visualize/src/use-cases/forecast/prerender-block.ts`
- Modify: `apps/visualize/src/use-cases/forecast/hydrate-tooltip-values.ts`
- Modify: `apps/visualize/src/use-cases/forecast/manage-runtime.ts`
- Modify: corresponding tests

- [ ] **Step 1: Add a typed runtime fixture**

Update `manage-runtime.test.ts` so the `ports` object uses:

```ts
const ports = {
  // existing fake implementations
} satisfies CreateForecastRuntimeUseCaseOptions;
```

Remove implicit compatibility from the test fake.

- [ ] **Step 2: Run typecheck and record contract failures**

Run:

```bash
npm run typecheck:visualize
```

Expected: FAIL on the current `unknown` runtime and animation dependencies.

- [ ] **Step 3: Define runtime and animation capability ports**

Move duplicate local interfaces from `manage-runtime.ts` and `manage-animation.ts` into
`contracts.ts` or focused port files:

- `ForecastAnimationPort`;
- `ForecastAnimationPlayerPort`;
- `ForecastModelBlockPort`;
- `ForecastDownloadWorkerPort`;
- `ForecastRuntimeState`;
- `ForecastRuntimeApi`.

Use canonical `ForecastRunState`, `ForecastPackage`, `ForecastDownloadSession`,
`ForecastRefreshKey`, worker request/results, and map ports.

- [ ] **Step 4: Remove casts through `unknown`**

Refactor the constructor wiring in `manage-animation.ts` so collaborators already satisfy their
interfaces. Remove the existing `as unknown as Parameters<...>` casts.

If two collaborators genuinely expose incompatible shapes, add a small named adapter function
beside the composition code rather than casting.

- [ ] **Step 5: Run focused tests and checks**

Run:

```bash
npm test -w visualize -- \
  src/use-cases/forecast/manage-animation.test.ts \
  src/use-cases/forecast/manage-animation-cache.test.ts \
  src/use-cases/forecast/manage-hour-render-queue.test.ts \
  src/use-cases/forecast/drain-prerender-queue.test.ts \
  src/use-cases/forecast/prerender-block.test.ts \
  src/use-cases/forecast/hydrate-tooltip-values.test.ts \
  src/use-cases/forecast/manage-runtime.test.ts
npm run typecheck:visualize
npm run check:visualize
```

Expected: all commands pass.

- [ ] **Step 6: Check the use-case type debt**

Run:

```bash
rg -n "as unknown|interface .*Like|\\[key: string\\]: unknown" apps/visualize/src/use-cases
```

Expected: no matches except narrow external error or decoded-header boundaries documented by a
comment.

- [ ] **Step 7: Commit**

```bash
git add apps/visualize/src/use-cases/forecast
git commit -m "refactor: type forecast runtime contracts"
```

### Task 8: Move Forecast Status Ownership Out Of UI

**Files:**

- Modify: `apps/visualize/src/ui/data-status-summary.js`
- Modify: `apps/visualize/src/ui/data-status-summary.test.js`
- Modify: `apps/visualize/src/composition/forecast-runtime-factory.js`
- Modify: forecast use cases and tests importing `BLOCK_STATUS`

- [ ] **Step 1: Run the existing status-related tests as a baseline**

Run:

```bash
npm test -w visualize -- \
  src/ui/data-status-summary.test.js \
  src/use-cases/forecast/refresh-blocks.test.ts \
  src/controllers/forecast-run-controller.test.js
```

Expected: PASS before the dependency-only refactor.

- [ ] **Step 2: Move status ownership**

Delete `BLOCK_STATUS` from `ui/data-status-summary.js`. Import it from
`domain/forecast-types.ts`.

Update composition and use-case tests to import statuses from the canonical module.

- [ ] **Step 3: Run focused tests and checks**

Run:

```bash
npm test -w visualize -- \
  src/ui/data-status-summary.test.js \
  src/use-cases/forecast/refresh-blocks.test.ts \
  src/controllers/forecast-run-controller.test.js
npm run typecheck:visualize
npm run check:visualize
```

Expected: all commands pass.

- [ ] **Step 4: Verify the dependency direction**

Run:

```bash
rg -n 'from ".*ui/' apps/visualize/src/composition apps/visualize/src/use-cases
```

Expected: no composition or use-case import of application constants from UI. Composition may
still receive concrete view objects from controllers.

- [ ] **Step 5: Commit**

```bash
git add apps/visualize/src/domain apps/visualize/src/ui apps/visualize/src/composition \
  apps/visualize/src/use-cases apps/visualize/src/controllers
git commit -m "refactor: move forecast status ownership"
```

### Task 9: Convert Forecast Composition To TypeScript

**Files:**

- Rename: `apps/visualize/src/composition/forecast-runtime-factory.js` to
  `apps/visualize/src/composition/forecast-runtime-factory.ts`
- Create: `apps/visualize/src/composition/create-forecast-download-runtime.ts`
- Create: `apps/visualize/src/composition/create-forecast-render-runtime.ts`
- Modify: `apps/visualize/src/composition/forecast-runtime-factory.test.ts`
- Modify: imports in controller tests and source files

- [ ] **Step 1: Strengthen the composition test**

Replace the current export smoke test with a typed construction test that supplies fakes using
`satisfies CreateForecastRuntimeFactoryOptions` and asserts the returned API:

```ts
expect(runtime).toMatchObject({
  startDownload: expect.any(Function),
  resetModelState: expect.any(Function),
  handleVariableChange: expect.any(Function),
});
```

- [ ] **Step 2: Run typecheck and confirm the options type is missing**

Run:

```bash
npm run typecheck:visualize
```

Expected: FAIL because `CreateForecastRuntimeFactoryOptions` is not exported.

- [ ] **Step 3: Rename and type the factory**

Use `git mv`:

```bash
git mv apps/visualize/src/composition/forecast-runtime-factory.js \
  apps/visualize/src/composition/forecast-runtime-factory.ts
```

Define exact options for:

- browser scheduler;
- forecast views;
- variable controls;
- map renderer and presentation;
- grid state getters/setters;
- worker factories;
- diagnostics and storage hooks.

Use the canonical forecast, field, session, worker, map, and runtime contracts. Keep adapter
construction in composition.

- [ ] **Step 4: Split the two composition clusters**

Extract:

```text
src/composition/create-forecast-download-runtime.ts
src/composition/create-forecast-render-runtime.ts
```

The download builder owns resource loading, caching, download workers, refresh, and presentation
queue construction. The render builder owns model-block workers, render queues, animation,
overlays, and map presentation. The factory constructs adapters, calls both builders, and exposes
their combined typed API.

- [ ] **Step 5: Run focused tests and checks**

Run:

```bash
npm test -w visualize -- \
  src/composition/forecast-runtime-factory.test.ts \
  src/controllers/forecast-run-controller.test.js
npm run typecheck:visualize
npm run check:visualize
```

Expected: all commands pass without casts through `unknown` in composition.

- [ ] **Step 6: Commit**

```bash
git add apps/visualize/src/composition apps/visualize/src/controllers
git commit -m "refactor: type forecast runtime composition"
```

### Task 10: Convert The Forecast Controller To TypeScript

**Files:**

- Rename: `apps/visualize/src/controllers/forecast-run-controller.js` to
  `apps/visualize/src/controllers/forecast-run-controller.ts`
- Rename: `apps/visualize/src/controllers/forecast-run-controller.test.js` to
  `apps/visualize/src/controllers/forecast-run-controller.test.ts`
- Modify: `apps/visualize/index.js`
- Modify: UI view factories if their return values need exported interfaces

- [ ] **Step 1: Convert test fixtures to satisfy controller options**

Rename the test and update `createController()`:

```ts
const options = {
  // existing dependencies
} satisfies CreateForecastRunControllerOptions;

const controller = createForecastRunController(options);
```

- [ ] **Step 2: Run typecheck and confirm option mismatches**

Run:

```bash
npm run typecheck:visualize
```

Expected: FAIL until the controller exports and enforces its options.

- [ ] **Step 3: Rename and type the controller**

Use `git mv`, then define:

- a focused `ForecastRunDom` interface;
- typed view factory outputs;
- typed map renderer/presentation dependencies;
- typed state and callback functions;
- a typed return API matching the forecast runtime API.

Keep DOM creation in the controller and workflow construction in composition.

- [ ] **Step 4: Run focused tests and checks**

Run:

```bash
npm test -w visualize -- src/controllers/forecast-run-controller.test.ts
npm run typecheck:visualize
npm run check:visualize
```

Expected: all commands pass.

- [ ] **Step 5: Commit**

```bash
git add apps/visualize/src/controllers apps/visualize/index.js apps/visualize/src/ui
git commit -m "refactor: type forecast run controller"
```

### Task 11: Extract The Uploaded-Field Use Case

**Files:**

- Create: `apps/visualize/src/use-cases/upload-inspector/present-uploaded-field.ts`
- Create: `apps/visualize/src/use-cases/upload-inspector/present-uploaded-field.test.ts`
- Modify: `apps/visualize/src/use-cases/upload-inspector/ports.ts`
- Modify: `apps/visualize/src/domain/field-types.ts`

- [ ] **Step 1: Write the uploaded-field workflow tests**

Cover these scenarios:

```ts
test("returns not-found when no uploaded message matches the route")
test("decodes and renders the selected uploaded field")
test("returns decode-failed when the decoder rejects")
test("returns stale when render generation changes before worker completion")
```

Use fake ports and assert returned typed results rather than DOM mutations.

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npm test -w visualize -- src/use-cases/upload-inspector/present-uploaded-field.test.ts
```

Expected: FAIL because the use case does not exist.

- [ ] **Step 3: Define uploaded-field ports**

Add exact capabilities:

```ts
export interface UploadedFieldDecoderPort {
  decode(buffer: Uint8Array): Promise<DecodedField>;
}

export interface UploadedFieldRenderPort {
  render(request: UploadedFieldRenderRequest): Promise<UploadedFieldRenderResult | null>;
}
```

Define route resolution, render request, success, not-found, decode-failed, and stale result types.

- [ ] **Step 4: Implement the use case**

The use case must:

- receive the selected `UploadedMessage`;
- decode through the decoder port;
- build render parameters through an injected pure function;
- call the render port;
- close no bitmap and mutate no DOM;
- return a typed result for the controller.

- [ ] **Step 5: Run focused tests and checks**

Run:

```bash
npm test -w visualize -- \
  src/use-cases/upload-inspector/inspect-uploaded-file.test.ts \
  src/use-cases/upload-inspector/present-uploaded-field.test.ts
npm run typecheck:visualize
npm run check:visualize
```

Expected: all commands pass.

- [ ] **Step 6: Commit**

```bash
git add apps/visualize/src/use-cases/upload-inspector apps/visualize/src/domain/field-types.ts
git commit -m "refactor: extract uploaded field use case"
```

### Task 12: Create The Uploaded-Field Controller

**Files:**

- Create: `apps/visualize/src/controllers/uploaded-field-controller.ts`
- Create: `apps/visualize/src/controllers/uploaded-field-controller.test.ts`
- Modify: `apps/visualize/src/controllers/map-presentation-controller.js`
- Modify: `apps/visualize/src/adapters/forecast/maplibre-map-renderer-adapter.ts`

- [ ] **Step 1: Write controller tests**

Cover:

```ts
test("redirects home when no uploaded file is available")
test("presents decoded field metadata, raster, bounds, stats, and legend")
test("shows a decode error without leaving stale rendering state")
test("rerenders the current uploaded field after palette changes")
test("closes returned bitmaps after drawing")
```

Use typed fake ports and jsdom only for user-visible controller behavior.

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npm test -w visualize -- src/controllers/uploaded-field-controller.test.ts
```

Expected: FAIL because the controller does not exist.

- [ ] **Step 3: Implement the controller**

Move these responsibilities from `index.js`:

- selected-message routing;
- default palette selection;
- uploaded-field metadata presentation;
- map scene visibility;
- decode/render failure text;
- canvas drawing and fit bounds;
- stats and color scale updates;
- uploaded-grid palette rerendering.

The controller calls the uploaded-field use case and concrete map/presentation ports. It does not
decode or rasterize directly.

- [ ] **Step 4: Run focused tests and checks**

Run:

```bash
npm test -w visualize -- \
  src/controllers/uploaded-field-controller.test.ts \
  src/controllers/map-presentation-controller.test.js \
  src/adapters/forecast/maplibre-map-renderer-adapter.test.ts
npm run typecheck:visualize
npm run check:visualize
```

Expected: all commands pass.

- [ ] **Step 5: Commit**

```bash
git add apps/visualize/src/controllers apps/visualize/src/adapters/forecast \
  apps/visualize/src/controllers/map-presentation-controller.js
git commit -m "refactor: add uploaded field controller"
```

### Task 13: Replace Legacy Bootstrap With Typed Composition

**Files:**

- Create: `apps/visualize/src/bootstrap.ts`
- Create: `apps/visualize/src/bootstrap.test.ts`
- Modify: `apps/visualize/src/main.js`
- Modify: `apps/visualize/index.js`
- Modify: event and router modules only as required for typed bootstrap options

- [ ] **Step 1: Add a bootstrap smoke test**

Create `bootstrap.test.ts` with injected browser ports and assert:

```ts
test("wires controllers, starts the router, and initializes shell UI")
```

The test must not load real MapLibre, workers, IndexedDB, or network.

- [ ] **Step 2: Run the bootstrap test and verify it fails**

Run:

```bash
npm test -w visualize -- src/bootstrap.test.ts
```

Expected: FAIL because `bootstrap.ts` does not exist.

- [ ] **Step 3: Create `bootstrap.ts`**

Move composition and event wiring from `index.js` into a typed `bootstrap()` function:

- DOM lookup;
- adapter/controller construction;
- router construction and start;
- model list rendering;
- event binding;
- animation-player wiring;
- storage-warning initialization;
- performance diagnostics initialization.

Inject browser globals through a small `BrowserEnvironment` interface in tests.

- [ ] **Step 4: Remove uploaded-field workflow code from `index.js`**

Delete the old:

```text
showMapView
rerenderUploadedGridView
uploaded-field decode/render helpers
uploaded-field palette workflow
```

Delegate to `uploadedFieldController`.

- [ ] **Step 5: Reduce the legacy entry**

Prefer deleting `index.js` and changing `src/main.js` to:

```js
import "maplibre-gl/dist/maplibre-gl.css";
import "../style.css";
import { bootstrap } from "./bootstrap";

bootstrap();
```

If a temporary compatibility entry is still required, it may only import and call `bootstrap()`.

- [ ] **Step 6: Run focused tests and checks**

Run:

```bash
npm test -w visualize -- \
  src/bootstrap.test.ts \
  src/ui/app-router.test.js \
  src/ui/app-events.test.js \
  src/ui/home-events.test.js \
  src/ui/upload-inspector-events.test.js \
  src/controllers/uploaded-field-controller.test.ts \
  src/controllers/forecast-run-controller.test.ts
npm run typecheck:visualize
npm run check:visualize
```

Expected: all commands pass.

- [ ] **Step 7: Commit**

```bash
git add apps/visualize/src apps/visualize/index.js
git commit -m "refactor: create typed visualize bootstrap"
```

### Task 14: Remove Remaining Contract Duplication And Loose Types

**Files:**

- Modify: remaining files under `apps/visualize/src`
- Delete: obsolete type modules after imports are migrated

- [ ] **Step 1: Audit remaining loose boundary types**

Run:

```bash
rg -n "interface .*Like|as unknown as|\\[key: string\\]: unknown" apps/visualize/src
rg -n "ImageBitmap|ImageData|HTMLInputElement|MapLibre|maplibre" apps/visualize/src/domain
rg -n 'from ".*ui/' apps/visualize/src/use-cases apps/visualize/src/domain
```

Expected:

- no `*Like` application contracts;
- no double casts through `unknown`;
- no browser or MapLibre types in domain;
- no domain/use-case imports from UI.

- [ ] **Step 2: Remove remaining duplicate declarations**

For every remaining duplicate:

- import the canonical type;
- delete the local interface;
- narrow external `unknown` at the adapter boundary;
- preserve `unknown` only for caught errors or unparsed third-party payloads.

- [ ] **Step 3: Verify TypeScript coverage of boundaries**

Run:

```bash
find apps/visualize/src/composition apps/visualize/src/controllers \
  -type f -name '*.js' -print
```

Expected: no JavaScript boundary files remain except deliberately passive UI helpers documented in
the final commit.

- [ ] **Step 4: Run the complete visualize suite**

Run:

```bash
npm run test:visualize
npm run typecheck:visualize
npm run check:visualize
```

Expected: all commands pass.

- [ ] **Step 5: Commit**

```bash
git add apps/visualize/src
git commit -m "refactor: remove loose visualize contracts"
```

### Task 15: Final Verification And Documentation

**Files:**

- Modify: `apps/visualize/README.md`
- Modify: `docs/superpowers/plans/2026-06-11-visualize-type-boundaries.md`

- [ ] **Step 1: Update the architecture documentation**

Update `apps/visualize/README.md` to state:

- composition and controllers are TypeScript;
- `bootstrap.ts` is the application entry;
- domain types are browser-independent;
- worker and MapLibre contracts live at external boundaries.

Keep the document concise and remove references to the legacy `index.js` workflow.

- [ ] **Step 2: Run full verification**

Run:

```bash
npm run test:visualize
npm run typecheck:visualize
npm run check:visualize
npm run build:visualize
npm test
```

Expected:

- all visualize tests pass;
- TypeScript exits 0;
- Biome exits 0;
- Vite build exits 0;
- all decoder tests pass.

- [ ] **Step 3: Run final architecture assertions**

Run:

```bash
test -f apps/visualize/src/bootstrap.ts
test -f apps/visualize/src/composition/forecast-runtime-factory.ts
test -f apps/visualize/src/controllers/forecast-run-controller.ts
test -f apps/visualize/src/controllers/uploaded-field-controller.ts
test ! -f apps/visualize/index.js
! rg -n "ForecastPackageLike|ForecastResourceLike|ForecastDownloadSessionLike|ForecastBlockLike" \
  apps/visualize/src
! rg -n "as unknown as|\\[key: string\\]: unknown" apps/visualize/src/use-cases
! rg -n "ImageBitmap|ImageData|HTMLInputElement|MapLibre|maplibre" apps/visualize/src/domain
! rg -n 'from ".*ui/' apps/visualize/src/use-cases apps/visualize/src/domain
```

Expected: every assertion exits 0.

- [ ] **Step 4: Mark this plan complete**

Change every completed checkbox in this file from `[ ]` to `[x]`.

- [ ] **Step 5: Commit final documentation**

```bash
git add apps/visualize/README.md docs/superpowers/plans/2026-06-11-visualize-type-boundaries.md
git commit -m "docs: document visualize type boundaries"
```
