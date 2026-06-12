# Visualize React Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `apps/visualize` with a smaller React application organized around `forecast`, `upload`, and shared `map` features without losing user-facing functionality.

**Architecture:** Build a functional core in `domain/` and a thin imperative shell made of React hooks and feature-local runtimes. Use one hash-routed React application, unmount route state on navigation, keep MapLibre inside the shared map feature, and retain the legacy application as a parity reference until the replacement passes all gates.

**Tech Stack:** React, React DOM, TypeScript 6, Vite, Vitest, React Testing Library, jsdom, MapLibre GL, Web Workers, IndexedDB, Biome.

---

## Execution Rules

- Create and execute this work on an isolated `codex/` branch and worktree.
- Keep all generated code, comments, tests, UI text, documentation, and commit messages in English.
- Read every file listed by a task completely before editing it.
- Before modifying existing code in a task, report concrete DRY violations found in those files and
  wait for confirmation before introducing the proposed abstraction.
- Do not remove a user-facing capability unless the parity matrix marks it
  `removed by explicit decision`.
- Follow test-driven development: failing test, minimal implementation, passing test, commit.
- Use React Testing Library for feature behavior, not component implementation details.
- Keep reducers and domain functions pure.
- Keep runtime cleanup idempotent and test it.
- Do not add a global state library, dependency-injection framework, generic port layer, generic
  async hook, or speculative shared component.
- Prefer feature-local code. Move code to `shared/` only after two real consumers exist.
- Keep existing CSS layers and pragmatic BEM naming.
- Update this plan's checkboxes as steps complete.

## Target Ownership

```text
apps/visualize/src/
  app/
    App.tsx                    # shell, navigation, lazy route mounting
    ErrorBoundary.tsx          # unexpected React rendering failures
    router.tsx                 # hash parsing and navigation

  features/
    map/
      WeatherMap.tsx           # shared visualization surface
      MapControls.tsx          # palette, units, layer controls
      MapLegend.tsx            # scale and visible-layer legend
      mapReducer.ts            # pure map UI state
      mapRuntime.ts            # narrow MapLibre imperative boundary
      mapTypes.ts              # display model and callbacks
      map.test.tsx             # shared map behavior
      mapRuntime.test.ts       # MapLibre contract and cleanup

    upload/
      UploadPage.tsx           # upload route composition
      UploadInspector.tsx      # file summary and message selection
      useUploadedField.ts      # upload orchestration
      uploadReducer.ts         # pure upload workflow state
      uploadRuntime.ts         # file read, decode, render lifecycle
      upload.test.tsx          # route behavior

    forecast/
      ForecastPage.tsx         # forecast route composition
      ForecastControls.tsx     # model, variable, time, animation controls
      ForecastStatus.tsx       # download/cache/warmup feedback
      useForecast.ts           # forecast orchestration
      forecastReducer.ts       # pure forecast workflow state
      forecastRuntime.ts       # network, cache, worker, animation lifecycle
      forecast.test.tsx        # route behavior

  domain/
    fields.ts                  # decoded fields and display-field derivation
    forecast.ts                # packages, resources, hours, state derivations
    palettes.ts                # palette definitions and scales
    units.ts                   # unit conversions and labels
    vectors.ts                 # wind/vector calculations and symbols

  infrastructure/
    network/
      dataGouv.ts              # remote resource discovery
    storage/
      gribCache.ts             # IndexedDB cache
    workers/
      downloadWorker.ts        # download worker client
      modelBlockWorker.ts      # forecast decode/render worker client
      renderWorker.ts          # uploaded-field render worker client

  shared/
    ui/                        # only proven shared React primitives
```

The list is a target map, not a requirement to create empty files. A file may remain larger when
its responsibility is cohesive.

### Task 1: Create The Functional Parity Matrix

**Files:**

- Create: `apps/visualize/docs/functional-parity.md`
- Read: `apps/visualize/index.html`
- Read: `apps/visualize/src/bootstrap.ts`
- Read: `apps/visualize/src/ui/*.js`
- Read: `apps/visualize/src/controllers/*`
- Read: `apps/visualize/src/use-cases/forecast/*`
- Read: `apps/visualize/src/use-cases/upload-inspector/*`
- Read: `apps/visualize/src/adapters/*`
- Read: `apps/visualize/src/workers/*`
- Read: `apps/visualize/README.md`
- Read: `docs/archive/visualize/*`

- [x] **Step 1: Inventory current behavior**

Read the listed files completely and create `apps/visualize/docs/functional-parity.md` with this
structure:

```markdown
# Visualize Functional Parity

| Area | Capability | Current evidence | Target status | Replacement test |
| --- | --- | --- | --- | --- |
| Shell | Switch between forecast and upload routes | `src/ui/app-router.js` | preserved | `src/app/App.test.tsx` |
| Upload | Select or drop a GRIB2 file | `src/ui/upload-inspector-events.js` | preserved | `src/features/upload/upload.test.tsx` |
| Upload | Inspect file metadata and messages | `src/use-cases/upload-inspector/inspect-uploaded-file.ts` | preserved | `src/features/upload/upload.test.tsx` |
| Map | Change palette and update legend | `src/ui/map-toolbar-controller.js` | preserved | `src/features/map/map.test.tsx` |
| Forecast | Select model package and download resources | `src/controllers/forecast-run-controller.ts` | preserved | `src/features/forecast/forecast.test.tsx` |
| Forecast | Select variable and forecast hour | `src/use-cases/forecast/select-variable.ts` | preserved | `src/features/forecast/forecast.test.tsx` |
| Forecast | Play, pause, reset, and warm animation cache | `src/use-cases/forecast/manage-animation.ts` | preserved | `src/features/forecast/forecast.test.tsx` |
```

Add every observable capability found in the current code, including:

- canonical route behavior and invalid-route fallback;
- storage usage warning and cache clearing;
- file picker, drag-and-drop, keyboard activation, metadata, variables, and errors;
- map bounds, raster, tooltip, statistics, legend, palettes, units, unavailable state, and back
  navigation;
- forecast packages, resources, cache status, progress, file details, variables, hours, animation,
  warmup, wind direction, isobars, wind symbols, stale-result handling, and diagnostics;
- responsive and accessibility behavior that is explicitly implemented.

Every row must start as `preserved` unless the user explicitly approves `improved` or
`removed by explicit decision`.

- [x] **Step 2: Verify the inventory contains no unresolved statuses**

Run:

```bash
! rg -n "TBD|TODO|unknown|to decide" apps/visualize/docs/functional-parity.md
rg -n "preserved|improved|removed by explicit decision" apps/visualize/docs/functional-parity.md
```

Expected: the first command exits 0 and every capability row has an allowed status.

- [x] **Step 3: Commit**

```bash
git add apps/visualize/docs/functional-parity.md
git commit -m "docs: inventory visualize functional parity"
```

### Task 2: Install React And Establish The Test Harness

**Files:**

- Modify: `apps/visualize/package.json`
- Modify: `package-lock.json`
- Modify: `apps/visualize/tsconfig.json`
- Create: `apps/visualize/src/test/setup.ts`
- Create: `apps/visualize/src/test/setup.test.tsx`

- [ ] **Step 1: Install React and test dependencies**

Run:

```bash
npm install -w visualize react react-dom
npm install -D -w visualize @types/react @types/react-dom @testing-library/react \
  @testing-library/user-event @testing-library/jest-dom
```

Expected: `apps/visualize/package.json` lists React runtime dependencies and Testing Library
development dependencies.

- [ ] **Step 2: Configure JSX and test setup**

Update `apps/visualize/tsconfig.json`:

```json
{
  "compilerOptions": {
    "allowJs": true,
    "checkJs": false,
    "jsx": "react-jsx",
    "lib": ["ESNext", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "noEmit": true,
    "strict": true,
    "target": "ES2022",
    "types": ["vite/client", "node", "@testing-library/jest-dom"]
  },
  "include": ["*.js", "*.ts", "*.tsx", "src/**/*.js", "src/**/*.ts", "src/**/*.tsx"],
  "exclude": ["dist", "node_modules"]
}
```

Create `apps/visualize/src/test/setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

Add the Vitest setup to `apps/visualize/vite.config.ts`:

```ts
test: {
  environment: "jsdom",
  setupFiles: ["./src/test/setup.ts"],
},
```

- [ ] **Step 3: Write the test-harness smoke test**

Create `apps/visualize/src/test/setup.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";

describe("test setup", () => {
  test("provides jsdom and Testing Library matchers", () => {
    render(<p>Ready</p>);

    expect(screen.getByText("Ready")).toBeVisible();
  });
});
```

- [ ] **Step 4: Run the test and verify the harness passes**

Run:

```bash
npm test -w visualize -- src/test/setup.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit the harness**

```bash
git add apps/visualize/package.json apps/visualize/tsconfig.json \
  apps/visualize/vite.config.ts apps/visualize/src/test/setup.ts \
  apps/visualize/src/test/setup.test.tsx package-lock.json
git commit -m "test: prepare visualize React harness"
```

### Task 3: Build The Hash-Routed React Shell

**Files:**

- Create: `apps/visualize/src/app/router.tsx`
- Create: `apps/visualize/src/app/router.test.tsx`
- Create: `apps/visualize/src/app/ErrorBoundary.tsx`
- Create: `apps/visualize/src/app/ErrorBoundary.test.tsx`
- Create: `apps/visualize/src/app/App.tsx`
- Create: `apps/visualize/src/app/App.test.tsx`

- [ ] **Step 1: Write the shell smoke test**

Create `apps/visualize/src/app/App.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test } from "vitest";
import { App } from "./App";

describe("App", () => {
  test("renders navigation for the two application routes", () => {
    render(<App />);

    expect(screen.getByRole("link", { name: "Forecast" })).toBeVisible();
    expect(screen.getByRole("link", { name: "Upload" })).toBeVisible();
  });
});
```

- [ ] **Step 2: Write router behavior tests**

Create `apps/visualize/src/app/router.test.tsx`:

```tsx
import { act, renderHook } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { parseRoute, useHashRoute } from "./router";

describe("router", () => {
  test.each([
    ["", "forecast"],
    ["#/forecast", "forecast"],
    ["#/upload", "upload"],
    ["#/unsupported", "forecast"],
  ] as const)("maps %s to %s", (hash, expected) => {
    expect(parseRoute(hash)).toBe(expected);
  });

  test("updates when the hash changes", () => {
    window.location.hash = "#/forecast";
    const { result } = renderHook(() => useHashRoute());

    act(() => {
      window.location.hash = "#/upload";
      window.dispatchEvent(new HashChangeEvent("hashchange"));
    });

    expect(result.current).toBe("upload");
  });
});
```

- [ ] **Step 3: Write route unmount behavior**

Extend `App.test.tsx`:

```tsx
test("unmounts the previous route when navigation changes", async () => {
  window.location.hash = "#/forecast";
  render(<App />);

  expect(await screen.findByTestId("forecast-page")).toBeVisible();

  await userEvent.click(screen.getByRole("link", { name: "Upload" }));

  expect(await screen.findByTestId("upload-page")).toBeVisible();
  expect(screen.queryByTestId("forecast-page")).not.toBeInTheDocument();
});
```

- [ ] **Step 4: Write unexpected-render-error behavior**

Create `apps/visualize/src/app/ErrorBoundary.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { describe, expect, test } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

function BrokenView(): never {
  throw new Error("broken");
}

describe("ErrorBoundary", () => {
  test("shows a shell-level recovery message", () => {
    render(
      <ErrorBoundary>
        <BrokenView />
      </ErrorBoundary>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "The application could not render this view.",
    );
  });
});
```

- [ ] **Step 5: Run shell tests and verify they fail**

Run:

```bash
npm test -w visualize -- src/app
```

Expected: FAIL because the router, boundary, and application shell are incomplete.

- [ ] **Step 6: Implement the minimal router**

Create `router.tsx`:

```tsx
import { useEffect, useState } from "react";

export type AppRoute = "forecast" | "upload";

export function parseRoute(hash: string): AppRoute {
  return hash === "#/upload" ? "upload" : "forecast";
}

export function useHashRoute(): AppRoute {
  const [route, setRoute] = useState(() => parseRoute(window.location.hash));

  useEffect(() => {
    const handleHashChange = () => setRoute(parseRoute(window.location.hash));

    window.addEventListener("hashchange", handleHashChange);

    return () => window.removeEventListener("hashchange", handleHashChange);
  }, []);

  return route;
}
```

- [ ] **Step 7: Implement the boundary and shell**

Create `ErrorBoundary.tsx` as a React class error boundary with this fallback:

```tsx
<main>
  <p role="alert">The application could not render this view.</p>
  <a href="#/forecast">Return to forecast</a>
</main>
```

Create `App.tsx` with lazy route modules:

```tsx
import { lazy, Suspense } from "react";
import { ErrorBoundary } from "./ErrorBoundary";
import { useHashRoute } from "./router";

const ForecastPage = lazy(() => import("../features/forecast/ForecastPage"));
const UploadPage = lazy(() => import("../features/upload/UploadPage"));

export function App() {
  const route = useHashRoute();

  return (
    <ErrorBoundary>
      <header className="topbar">
        <nav aria-label="Application">
          <a href="#/forecast">Forecast</a>
          <a href="#/upload">Upload</a>
        </nav>
      </header>

      <Suspense fallback={<p role="status">Loading view...</p>}>
        {route === "upload" ? <UploadPage /> : <ForecastPage />}
      </Suspense>
    </ErrorBoundary>
  );
}
```

Create temporary route components that render only their named `data-testid`. They will be replaced
by feature tasks.

- [ ] **Step 8: Run shell tests and checks**

Run:

```bash
npm test -w visualize -- src/app
npm run typecheck:visualize
npm run check:visualize
```

Expected: all commands pass.

- [ ] **Step 9: Commit**

```bash
git add apps/visualize/src/app apps/visualize/src/features
git commit -m "feat: add visualize React shell"
```

### Task 4: Consolidate The Pure Domain Core

**Files:**

- Create: `apps/visualize/src/domain/fields.ts`
- Create: `apps/visualize/src/domain/fields.test.ts`
- Create: `apps/visualize/src/domain/forecast.ts`
- Create: `apps/visualize/src/domain/forecast.test.ts`
- Create: `apps/visualize/src/domain/palettes.ts`
- Create: `apps/visualize/src/domain/palettes.test.ts`
- Create: `apps/visualize/src/domain/units.ts`
- Create: `apps/visualize/src/domain/units.test.ts`
- Create: `apps/visualize/src/domain/vectors.ts`
- Create: `apps/visualize/src/domain/vectors.test.ts`
- Read and migrate: existing files under `apps/visualize/src/domain/`

- [ ] **Step 1: Identify domain duplication before migration**

Read every current domain file and test completely. Report:

- repeated field/grid/product types;
- repeated palette or scale derivations;
- repeated unit labels/conversions;
- repeated vector/wind derivations;
- repeated forecast package/resource/hour derivations.

Propose consolidation into the five target modules and wait for confirmation before moving code.

- [ ] **Step 2: Write public behavior tests for the consolidated modules**

Use existing tests as the source of truth. Add focused imports such as:

```ts
import { describe, expect, test } from "vitest";
import { createDisplayField } from "./fields";
import { resolvePaletteScale } from "./palettes";
import { convertValue, formatUnit } from "./units";
import { createVectorField } from "./vectors";

test("creates a browser-independent display field", () => {
  const field = createDisplayField({
    values: new Float32Array([273.15, 274.15]),
    grid: {
      ni: 2,
      nj: 1,
      dj: 1,
      latitudeOfFirstPoint: 1,
      longitudeOfFirstPoint: 0,
      latitudeOfLastPoint: 1,
      longitudeOfLastPoint: 1,
    },
    product: { shortName: "t", units: "K" },
    header: {},
  });

  expect(field.values).toEqual(new Float32Array([273.15, 274.15]));
  expect(field.product.shortName).toBe("t");
});
```

Preserve every relevant current domain test case. Do not rewrite established expected values.

- [ ] **Step 3: Run new tests and verify missing exports fail**

Run:

```bash
npm test -w visualize -- \
  src/domain/fields.test.ts \
  src/domain/forecast.test.ts \
  src/domain/palettes.test.ts \
  src/domain/units.test.ts \
  src/domain/vectors.test.ts
```

Expected: FAIL because the consolidated modules do not exist.

- [ ] **Step 4: Move pure logic into the target modules**

Move existing pure implementations without browser dependencies. Export narrow types and
functions. Example boundary:

```ts
export interface DisplayField {
  values: Float32Array | Float64Array;
  grid: GridDefinition;
  product: ProductDefinition;
  statistics: {
    min: number;
    max: number;
    mean: number;
    validCount: number;
  };
}
```

Keep Web Mercator calculations in `fields.ts` only if they are used solely to locate field values;
otherwise retain a focused `webMercator.ts` domain file rather than forcing an artificial merge.

- [ ] **Step 5: Update imports and remove replaced domain files**

Replace imports throughout the existing application only where necessary to keep tests compiling.
Delete a legacy domain file only after:

```bash
rg -n "legacy-module-name" apps/visualize/src
```

returns no imports and its tests are represented in the new module tests.

- [ ] **Step 6: Run domain and static checks**

Run:

```bash
npm test -w visualize -- src/domain
npm run typecheck:visualize
npm run check:visualize
! rg -n "document|window|HTMLElement|ImageBitmap|ImageData|Worker|maplibre|indexedDB|fetch" \
  apps/visualize/src/domain
```

Expected: all commands pass and the dependency assertion finds no browser mechanisms in domain.

- [ ] **Step 7: Commit**

```bash
git add apps/visualize/src/domain apps/visualize/src
git commit -m "refactor: consolidate visualize domain core"
```

### Task 5: Create Shared Infrastructure Modules

**Files:**

- Create: `apps/visualize/src/infrastructure/network/dataGouv.ts`
- Create: `apps/visualize/src/infrastructure/network/dataGouv.test.ts`
- Create: `apps/visualize/src/infrastructure/storage/gribCache.ts`
- Create: `apps/visualize/src/infrastructure/storage/gribCache.test.ts`
- Create: `apps/visualize/src/infrastructure/workers/downloadWorker.ts`
- Create: `apps/visualize/src/infrastructure/workers/downloadWorker.test.ts`
- Create: `apps/visualize/src/infrastructure/workers/modelBlockWorker.ts`
- Create: `apps/visualize/src/infrastructure/workers/modelBlockWorker.test.ts`
- Create: `apps/visualize/src/infrastructure/workers/renderWorker.ts`
- Create: `apps/visualize/src/infrastructure/workers/renderWorker.test.ts`
- Read and migrate: current adapters and worker clients

- [ ] **Step 1: Report repeated integration contracts**

Read the current network, cache, and worker files completely. Report duplicated request/result
shapes and lifecycle code, propose one canonical owner for each, and wait for confirmation before
extracting shared helpers.

- [ ] **Step 2: Write contract tests**

Cover the critical guarantees:

```ts
test("dataGouv translates API resources into domain resources")
test("gribCache returns current, stale, and missing entries")
test("worker clients ignore results after dispose")
test("worker clients transfer buffers without changing domain contracts")
test("dispose is idempotent")
```

Use injected `fetch`, IndexedDB fakes already used by the current tests, and fake Worker objects.

- [ ] **Step 3: Run the tests and verify they fail**

Run:

```bash
npm test -w visualize -- src/infrastructure
```

Expected: FAIL because the infrastructure modules do not exist.

- [ ] **Step 4: Implement narrow factories**

Use small factory APIs:

```ts
export interface Disposable {
  dispose(): void;
}

export function createDataGouvClient(options: {
  fetch: typeof globalThis.fetch;
}): {
  listResources(datasetId: string): Promise<RemoteResource[]>;
}

export function createGribCache(options: {
  databaseName: string;
}): {
  get(key: string): Promise<CachedGrib | null>;
  put(entry: CachedGrib): Promise<void>;
  clear(): Promise<void>;
  getUsage(): Promise<number>;
}
```

Worker clients expose only feature-required methods plus idempotent `dispose()`. Reuse current
worker scripts and protocols when their behavior remains valid.

- [ ] **Step 5: Run contract and existing adapter tests**

Run:

```bash
npm test -w visualize -- src/infrastructure src/adapters src/workers
npm run typecheck:visualize
npm run check:visualize
```

Expected: all commands pass.

- [ ] **Step 6: Commit**

```bash
git add apps/visualize/src/infrastructure apps/visualize/src/adapters \
  apps/visualize/src/workers
git commit -m "refactor: establish visualize infrastructure"
```

### Task 6: Define The Shared Map Display Contract

**Files:**

- Create: `apps/visualize/src/features/map/mapTypes.ts`
- Create: `apps/visualize/src/features/map/mapReducer.ts`
- Create: `apps/visualize/src/features/map/mapReducer.test.ts`
- Create: `apps/visualize/src/features/map/mapFixtures.ts`

- [ ] **Step 1: Write reducer and display-model tests**

Create tests covering:

```ts
test("changes palette without changing the displayed field")
test("changes displayed units through a pure state transition")
test("records a recoverable map error")
test("clears tooltip state when the pointer leaves the field")
```

Use this public model:

```ts
export interface MapDisplayModel {
  field: DisplayField;
  bounds: [[number, number], [number, number]];
  palette: string;
  units: string;
  title: string;
  description?: string;
  validTime?: string;
  overlays?: {
    isobars?: IsobarFeatureCollection;
    windSymbols?: WindSymbolCollection;
  };
}

export interface MapInteractionCallbacks {
  onPaletteChange(palette: string): void;
  onUnitsChange(units: string): void;
  onPointerValue?(value: number | null): void;
}
```

- [ ] **Step 2: Run tests and verify they fail**

Run:

```bash
npm test -w visualize -- src/features/map/mapReducer.test.ts
```

Expected: FAIL because the map contracts do not exist.

- [ ] **Step 3: Implement pure map state**

Create a discriminated `MapAction` and pure `mapReducer`. Do not import React or MapLibre.

- [ ] **Step 4: Run tests and checks**

Run:

```bash
npm test -w visualize -- src/features/map/mapReducer.test.ts
npm run typecheck:visualize
npm run check:visualize
```

Expected: all commands pass.

- [ ] **Step 5: Commit**

```bash
git add apps/visualize/src/features/map
git commit -m "feat: define shared map state"
```

### Task 7: Build And Contract-Test The MapLibre Runtime

**Files:**

- Create: `apps/visualize/src/features/map/mapRuntime.ts`
- Create: `apps/visualize/src/features/map/mapRuntime.test.ts`
- Read and migrate:
  `apps/visualize/src/adapters/forecast/maplibre-map-renderer-adapter.ts`
- Read and migrate:
  `apps/visualize/src/adapters/forecast/isobar-layer-adapter.ts`
- Read and migrate:
  `apps/visualize/src/adapters/forecast/wind-symbol-layer-adapter.ts`
- Read and migrate:
  `apps/visualize/src/controllers/map-presentation-controller.ts`

- [ ] **Step 1: Report duplicated MapLibre operations**

Read the listed files completely. Report repeated source/layer lookup, add/update/remove, bounds,
event-binding, and cleanup patterns. Propose private helpers inside `mapRuntime.ts` and wait for
confirmation before consolidating them.

- [ ] **Step 2: Write runtime contract tests**

Use a fake MapLibre facade and cover:

```ts
test("creates one map instance for one mounted WeatherMap")
test("updates the raster without recreating the map")
test("updates isobars and wind symbols independently")
test("forwards pointer values through the configured callback")
test("reports a recoverable map error")
test("removes listeners, layers, sources, and the map exactly once on dispose")
```

The constructor contract is:

```ts
export function createMapRuntime(options: {
  container: HTMLElement;
  createMap: MapFactory;
  onPointerValue(value: number | null): void;
  onError(error: Error): void;
}): {
  present(model: MapDisplayModel): void;
  dispose(): void;
}
```

Also export the feature-facing factory type:

```ts
export type MapRuntimeFactory = (
  options: Omit<Parameters<typeof createMapRuntime>[0], "createMap">,
) => ReturnType<typeof createMapRuntime>;
```

The production factory binds the real MapLibre constructor. React components and tests receive the
smaller `MapRuntimeFactory`.

- [ ] **Step 3: Run tests and verify they fail**

Run:

```bash
npm test -w visualize -- src/features/map/mapRuntime.test.ts
```

Expected: FAIL because `createMapRuntime` does not exist.

- [ ] **Step 4: Implement the runtime**

Move the established MapLibre behavior behind `createMapRuntime`. Keep MapLibre-specific types and
helpers in this file. Do not create `infrastructure/maplibre/`.

- [ ] **Step 5: Run runtime and legacy map tests**

Run:

```bash
npm test -w visualize -- \
  src/features/map/mapRuntime.test.ts \
  src/adapters/forecast/maplibre-map-renderer-adapter.test.ts \
  src/adapters/forecast/isobar-layer-adapter.test.ts \
  src/adapters/forecast/wind-symbol-layer-adapter.test.ts \
  src/controllers/map-presentation-controller.test.ts
npm run typecheck:visualize
npm run check:visualize
```

Expected: all commands pass.

- [ ] **Step 6: Commit**

```bash
git add apps/visualize/src/features/map apps/visualize/src/adapters/forecast \
  apps/visualize/src/controllers/map-presentation-controller*
git commit -m "feat: add shared MapLibre runtime"
```

### Task 8: Build The Shared Map React Feature

**Files:**

- Create: `apps/visualize/src/features/map/WeatherMap.tsx`
- Create: `apps/visualize/src/features/map/MapControls.tsx`
- Create: `apps/visualize/src/features/map/MapLegend.tsx`
- Create: `apps/visualize/src/features/map/useMapLibre.ts`
- Create: `apps/visualize/src/features/map/map.test.tsx`
- Modify: `apps/visualize/style/modules.css`
- Modify: `apps/visualize/style/layout.css`

- [ ] **Step 1: Read CSS ownership before editing**

Read all imported CSS files completely. Report repeated map selectors or duplicated palette/legend
rules and wait for confirmation before consolidating them.

- [ ] **Step 2: Write shared map behavior tests**

Cover:

```tsx
test("presents field metadata, statistics, legend, palette, and units")
test("sends palette and unit changes to the owner")
test("shows tooltip values reported by the runtime")
test("shows a local map error without replacing the route")
test("disposes the runtime when the component unmounts")
```

Render `WeatherMap` with a fake runtime factory:

```tsx
render(
  <WeatherMap
    model={createMapDisplayModel()}
    createRuntime={createFakeMapRuntime}
    onPaletteChange={onPaletteChange}
    onUnitsChange={onUnitsChange}
  />,
);
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```bash
npm test -w visualize -- src/features/map/map.test.tsx
```

Expected: FAIL because the React map feature does not exist.

- [ ] **Step 4: Implement the hook and components**

`useMapLibre` owns runtime creation, updates, and cleanup:

```tsx
const runtimeRef = useRef<MapRuntime | null>(null);

useEffect(() => {
  if (!container) {
    return;
  }

  const runtime = createRuntime({
    container,
    onPointerValue,
    onError,
  });

  runtimeRef.current = runtime;

  return () => {
    runtime.dispose();
    runtimeRef.current = null;
  };
}, [container, createRuntime]);

useEffect(() => {
  runtimeRef.current?.present(model);
}, [model]);
```

Use a separate effect for `runtime.present(model)` updates so normal model changes do not recreate
the map. `MapControls` and `MapLegend` remain controlled components.

- [ ] **Step 5: Migrate map CSS within existing layers**

Keep:

- page-level map sizing and `[hidden]` behavior in `layout.css`;
- `.weather-map`, `.map-controls`, `.map-legend`, tooltip, and error states in `modules.css`;
- third-party MapLibre overrides in `overrides.css`.

Do not create a new CSS layer.

- [ ] **Step 6: Run map tests and checks**

Run:

```bash
npm test -w visualize -- src/features/map
npm run typecheck:visualize
npm run check:visualize
```

Expected: all commands pass.

- [ ] **Step 7: Update parity evidence**

Update map rows in `apps/visualize/docs/functional-parity.md` with their replacement tests. Do not
mark final verification complete yet.

- [ ] **Step 8: Commit**

```bash
git add apps/visualize/src/features/map apps/visualize/style \
  apps/visualize/docs/functional-parity.md
git commit -m "feat: build shared weather map"
```

### Task 9: Rebuild The Upload Feature

**Files:**

- Create: `apps/visualize/src/features/upload/uploadReducer.ts`
- Create: `apps/visualize/src/features/upload/uploadReducer.test.ts`
- Create: `apps/visualize/src/features/upload/uploadRuntime.ts`
- Create: `apps/visualize/src/features/upload/uploadRuntime.test.ts`
- Create: `apps/visualize/src/features/upload/useUploadedField.ts`
- Create: `apps/visualize/src/features/upload/UploadInspector.tsx`
- Replace: `apps/visualize/src/features/upload/UploadPage.tsx`
- Create: `apps/visualize/src/features/upload/upload.test.tsx`
- Read and migrate: current upload use cases, adapters, controllers, and UI modules
- Modify: existing CSS layer files as ownership requires

- [ ] **Step 1: Report upload workflow duplication**

Read all current upload files completely. Report duplicate selected-message, palette, decode,
render-generation, error, and map-presentation state. Propose the exact reducer state and runtime
ownership, then wait for confirmation before consolidating.

- [ ] **Step 2: Write reducer tests**

Cover:

```ts
test("moves from idle to reading to inspected")
test("selects a message without discarding file metadata")
test("ignores a stale render completion")
test("stores a recoverable read, decode, or render error")
test("returns to idle when the route remounts")
```

Use:

```ts
export type UploadState =
  | { status: "idle"; error: null }
  | { status: "reading"; fileName: string; requestId: number; error: null }
  | { status: "inspected"; inspection: UploadInspection; selectedMessage: number | null; error: null }
  | { status: "presenting"; inspection: UploadInspection; selectedMessage: number; requestId: number; error: null }
  | { status: "ready"; inspection: UploadInspection; selectedMessage: number; map: MapDisplayModel; error: null }
  | { status: "error"; stage: "read" | "decode" | "render"; message: string };
```

- [ ] **Step 3: Write runtime lifecycle tests**

Cover file reading, decoder invocation through `grib2-decoder/dist`, render worker use,
stale-result suppression, and idempotent disposal.

- [ ] **Step 4: Write route behavior tests**

Cover the parity matrix:

```tsx
test("accepts a file from the picker")
test("accepts a dropped GRIB2 file")
test("activates the drop zone from the keyboard")
test("shows file summary and decoded messages")
test("presents a selected field on the shared map")
test("rerenders the field after palette or unit changes")
test("shows contextual errors and allows a retry")
test("disposes pending work when navigating away")
```

- [ ] **Step 5: Run upload tests and verify they fail**

Run:

```bash
npm test -w visualize -- src/features/upload
```

Expected: FAIL because the upload feature is incomplete.

- [ ] **Step 6: Implement the reducer and runtime**

Keep file read, decode, worker rendering, request identity, and cleanup in `uploadRuntime.ts`.
Keep state transitions in `uploadReducer.ts`. The runtime returns domain/display values and never
mutates React state directly.

- [ ] **Step 7: Implement the hook and components**

`useUploadedField` dispatches reducer actions around runtime promises and ignores completion after
cleanup. `UploadPage` composes `UploadInspector` and `WeatherMap`.

- [ ] **Step 8: Migrate upload CSS**

Move no rule between CSS files unless the target layer clearly owns it. Convert incidental IDs to
component classes only as the corresponding React markup is introduced.

- [ ] **Step 9: Run upload, map, and static checks**

Run:

```bash
npm test -w visualize -- src/features/upload src/features/map src/domain
npm run typecheck:visualize
npm run check:visualize
```

Expected: all commands pass.

- [ ] **Step 10: Update parity evidence and commit**

Update every upload row with a replacement test, then:

```bash
git add apps/visualize/src/features/upload apps/visualize/style \
  apps/visualize/docs/functional-parity.md
git commit -m "feat: rebuild uploaded GRIB2 workflow"
```

### Task 10: Rebuild Forecast State And Resource Loading

**Files:**

- Create: `apps/visualize/src/features/forecast/forecastReducer.ts`
- Create: `apps/visualize/src/features/forecast/forecastReducer.test.ts`
- Create: `apps/visualize/src/features/forecast/forecastRuntime.ts`
- Create: `apps/visualize/src/features/forecast/forecastRuntime.test.ts`
- Create: `apps/visualize/src/features/forecast/useForecast.ts`
- Read and migrate: current forecast use cases, composition, adapters, controllers, and workers

- [ ] **Step 1: Report forecast orchestration duplication**

Read every current forecast workflow file completely. Report repeated package/resource/session,
request-generation, block-status, selected-variable/hour, queue, and cleanup state. Propose the
canonical reducer state and private runtime helpers, then wait for confirmation.

- [ ] **Step 2: Write reducer tests**

Cover:

```ts
test("selects a package and starts a fresh loading generation")
test("tracks cache, download, ready, and missing block statuses")
test("selects a variable and preserves available resources")
test("selects an hour and rejects unavailable hours")
test("stores recoverable network, cache, decode, and render errors")
test("ignores actions from an obsolete generation")
test("resets animation state when the variable changes")
```

Define one explicit `ForecastState` and discriminated `ForecastAction`; do not mirror every
imperative runtime detail in React state.

- [ ] **Step 3: Write resource runtime tests**

Cover:

```ts
test("discovers package resources and hydrates current cache entries")
test("downloads only missing or stale blocks")
test("reports progress through typed runtime events")
test("clears cached forecast data")
test("ignores obsolete network and worker completions")
test("aborts requests and disposes workers exactly once")
```

Use injected network, cache, worker, timer, and scheduler dependencies.

- [ ] **Step 4: Run tests and verify they fail**

Run:

```bash
npm test -w visualize -- \
  src/features/forecast/forecastReducer.test.ts \
  src/features/forecast/forecastRuntime.test.ts
```

Expected: FAIL because the reducer and runtime do not exist.

- [ ] **Step 5: Implement reducer and resource lifecycle**

Reuse proven pure functions and worker protocols. `forecastRuntime.ts` owns:

- data.gouv resource loading;
- IndexedDB reads and writes;
- download workers;
- model-block workers;
- generation IDs;
- progress events;
- cleanup.

Expose a small event-driven API:

```ts
export interface ForecastRuntime {
  loadPackage(packageKey: string): Promise<void>;
  selectVariable(variable: string): Promise<void>;
  selectHour(hour: number): Promise<void>;
  clearCache(): Promise<void>;
  subscribe(listener: (event: ForecastRuntimeEvent) => void): () => void;
  dispose(): void;
}
```

- [ ] **Step 6: Implement `useForecast`**

Create the runtime once per mounted route, subscribe to typed events, dispatch reducer actions, and
dispose on unmount. Do not put the runtime in React context.

- [ ] **Step 7: Run focused and static checks**

Run:

```bash
npm test -w visualize -- \
  src/features/forecast/forecastReducer.test.ts \
  src/features/forecast/forecastRuntime.test.ts \
  src/domain/forecast.test.ts \
  src/infrastructure
npm run typecheck:visualize
npm run check:visualize
```

Expected: all commands pass.

- [ ] **Step 8: Commit**

```bash
git add apps/visualize/src/features/forecast apps/visualize/src/domain \
  apps/visualize/src/infrastructure
git commit -m "feat: rebuild forecast runtime state"
```

### Task 11: Rebuild Forecast Presentation And Animation

**Files:**

- Create: `apps/visualize/src/features/forecast/ForecastControls.tsx`
- Create: `apps/visualize/src/features/forecast/ForecastStatus.tsx`
- Replace: `apps/visualize/src/features/forecast/ForecastPage.tsx`
- Create: `apps/visualize/src/features/forecast/forecast.test.tsx`
- Modify: `apps/visualize/src/features/forecast/forecastRuntime.ts`
- Modify: `apps/visualize/src/features/forecast/forecastRuntime.test.ts`
- Modify: existing CSS layer files as ownership requires

- [ ] **Step 1: Write forecast route behavior tests**

Cover every preserved forecast row:

```tsx
test("lists the current model packages")
test("loads a selected package and reports cache and download progress")
test("shows file-level download details")
test("selects a variable and displays its first available hour")
test("changes forecast hour and updates the shared map")
test("plays, pauses, and resets the animation")
test("reports animation cache warmup")
test("changes palette and units through the shared map")
test("toggles wind direction symbols")
test("presents isobars when the selected variable supports them")
test("shows unavailable data without discarding the current package")
test("shows recoverable errors and retries the failed operation")
test("disposes animation, requests, subscriptions, and workers on route change")
```

Use fake runtime events and the real reducer. Do not instantiate real MapLibre.

- [ ] **Step 2: Extend runtime tests for rendering and animation**

Cover:

```ts
test("renders the selected hour into a MapDisplayModel")
test("queues rapid hour selections and presents only the latest")
test("warms animation frames without replacing the selected frame")
test("advances animation with the injected scheduler")
test("stops timers and pending renders on dispose")
test("hydrates tooltip values from the current decoded field")
```

- [ ] **Step 3: Run tests and verify they fail**

Run:

```bash
npm test -w visualize -- src/features/forecast
```

Expected: FAIL because presentation and animation are incomplete.

- [ ] **Step 4: Implement rendering and animation in the runtime**

Reuse the proven queue and cache algorithms from current use cases, but keep them as private
cohesive functions unless another real consumer exists. Emit typed events such as:

```ts
type ForecastRuntimeEvent =
  | { type: "resourcesLoaded"; resources: RemoteResource[] }
  | { type: "progressChanged"; progress: ForecastProgress }
  | { type: "mapReady"; model: MapDisplayModel }
  | { type: "animationWarmupChanged"; completed: number; total: number }
  | { type: "failed"; stage: ForecastFailureStage; message: string };
```

- [ ] **Step 5: Implement forecast React components**

`ForecastPage` composes:

- package selection;
- `ForecastStatus`;
- `ForecastControls`;
- shared `WeatherMap`.

Keep variable, hour, animation, wind-direction, palette, and unit controls controlled by reducer
state.

- [ ] **Step 6: Migrate forecast CSS**

Preserve current responsive behavior and status visibility. Keep component rules in `modules.css`
and page structure in `layout.css`.

- [ ] **Step 7: Run forecast, map, domain, and static checks**

Run:

```bash
npm test -w visualize -- \
  src/features/forecast \
  src/features/map \
  src/domain \
  src/infrastructure
npm run typecheck:visualize
npm run check:visualize
```

Expected: all commands pass.

- [ ] **Step 8: Update parity evidence and commit**

Update all forecast rows with replacement tests, then:

```bash
git add apps/visualize/src/features/forecast apps/visualize/style \
  apps/visualize/docs/functional-parity.md
git commit -m "feat: rebuild forecast visualization"
```

### Task 12: Replace The Legacy Entry Point

**Files:**

- Modify: `apps/visualize/index.html`
- Rename: `apps/visualize/src/main.js` to `apps/visualize/src/main.tsx`
- Delete after parity verification:
  `apps/visualize/src/bootstrap.ts`
- Delete after parity verification:
  `apps/visualize/src/composition/`
- Delete after parity verification:
  `apps/visualize/src/controllers/`
- Delete after parity verification:
  `apps/visualize/src/use-cases/`
- Delete replaced files under:
  `apps/visualize/src/adapters/`
- Delete replaced files under:
  `apps/visualize/src/ui/`
- Delete replaced worker clients under:
  `apps/visualize/src/workers/`

- [ ] **Step 1: Verify parity evidence before deleting legacy code**

Run:

```bash
! rg -n "\\| (preserved|improved) \\|[^|]*\\|[[:space:]]*$" \
  apps/visualize/docs/functional-parity.md
npm test -w visualize -- src/app src/features src/domain src/infrastructure
```

Expected: every preserved or improved row names replacement evidence and all replacement tests pass.

- [ ] **Step 2: Write the entry-point smoke test**

Extend `App.test.tsx`:

```tsx
test("defaults invalid hashes to the forecast route", async () => {
  window.location.hash = "#/invalid";
  render(<App />);

  expect(await screen.findByTestId("forecast-page")).toBeVisible();
});
```

- [ ] **Step 3: Replace static application markup**

Reduce `index.html` to the head, font import, and React root:

```html
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
```

Rename and replace `main.js`:

```tsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "maplibre-gl/dist/maplibre-gl.css";
import "../style.css";
import { App } from "./app/App";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Missing #root element");
}

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 4: Remove replaced legacy modules**

For each legacy directory, first run:

```bash
rg -n "bootstrap|composition|controllers|use-cases|adapters|ui|workers" \
  apps/visualize/src/app apps/visualize/src/features \
  apps/visualize/src/domain apps/visualize/src/infrastructure
```

Move any still-required implementation to its target owner with its existing tests. Delete only
files with no remaining consumer and behavior represented by the new suite.

- [ ] **Step 5: Update test scripts**

Replace obsolete scripts in `apps/visualize/package.json`:

```json
{
  "scripts": {
    "test": "vitest run src",
    "test:domain": "vitest run src/domain",
    "test:features": "vitest run src/features",
    "test:infrastructure": "vitest run src/infrastructure"
  }
}
```

- [ ] **Step 6: Run complete replacement checks**

Run:

```bash
npm run test:visualize
npm run typecheck:visualize
npm run check:visualize
npm run build:visualize
```

Expected: all commands pass and Vite builds the React entry.

- [ ] **Step 7: Commit**

```bash
git add -A apps/visualize
git commit -m "refactor: replace legacy visualize application"
```

### Task 13: Verify Production Behavior In The Browser

**Files:**

- Modify only if verification exposes a parity defect:
  `apps/visualize/src/app/*`
- Modify only if verification exposes a parity defect:
  `apps/visualize/src/features/*`
- Modify only if verification exposes a parity defect:
  `apps/visualize/style/*`
- Modify: `apps/visualize/docs/functional-parity.md`

- [ ] **Step 1: Start the production preview**

Run:

```bash
npm run build:visualize
npm run preview:visualize
```

Expected: Vite reports a local preview URL and remains running.

- [ ] **Step 2: Verify both routes with the in-app Browser**

Open the preview URL and verify:

- `#/forecast` mounts forecast and exposes package selection;
- `#/upload` mounts upload and removes forecast UI;
- browser back/forward changes routes correctly;
- invalid hashes show forecast;
- navigation releases map instances and ongoing route work;
- map controls, legend, units, tooltip, and error area render;
- responsive layouts remain usable at desktop and narrow viewport widths.

- [ ] **Step 3: Verify representative real workflows**

Use the repository GRIB2 fixture for upload:

```text
packages/grib2-decoder/test/arome__001__SP1__01H__2026-04-25T03_00_00Z.grib2
```

Verify one complete upload inspection and one forecast package load. Record each parity row as
`verified` in an added `Verification` column. Any defect must receive a failing automated test
before its fix.

- [ ] **Step 4: Stop the preview and rerun affected tests**

Run the focused tests for every corrected defect, then:

```bash
npm run test:visualize
npm run typecheck:visualize
npm run check:visualize
npm run build:visualize
```

Expected: all commands pass.

- [ ] **Step 5: Commit verification fixes**

```bash
git add apps/visualize
git commit -m "fix: complete visualize React parity"
```

### Task 14: Update Documentation And Run Final Verification

**Files:**

- Modify: `apps/visualize/README.md`
- Modify: `docs/superpowers/plans/2026-06-12-visualize-react-simplification.md`
- Move after completion:
  `docs/superpowers/specs/2026-06-12-visualize-react-simplification-design.md`
- Move after completion:
  `docs/superpowers/plans/2026-06-12-visualize-react-simplification.md`

- [ ] **Step 1: Update application documentation**

Document:

```text
src/app             React shell and hash routing
src/features/map    shared MapLibre visualization, legend, palettes, units
src/features/upload local GRIB2 inspection workflow
src/features/forecast remote forecast workflow
src/domain          pure browser-independent logic
src/infrastructure  network, storage, and worker mechanisms
```

State that route changes discard feature state and clean up resources. Remove references to the
legacy hexagonal directories and passive DOM bootstrap.

- [ ] **Step 2: Run architecture assertions**

Run:

```bash
test -f apps/visualize/src/main.tsx
test -f apps/visualize/src/app/App.tsx
test -f apps/visualize/src/features/map/mapRuntime.ts
test -f apps/visualize/src/features/upload/uploadRuntime.ts
test -f apps/visualize/src/features/forecast/forecastRuntime.ts
test ! -e apps/visualize/src/bootstrap.ts
test ! -d apps/visualize/src/composition
test ! -d apps/visualize/src/controllers
test ! -d apps/visualize/src/use-cases
! rg -n "document|window|HTMLElement|ImageBitmap|ImageData|Worker|maplibre|indexedDB|fetch" \
  apps/visualize/src/domain
! rg -n "from .*features/(forecast|upload)" apps/visualize/src/features/map
```

Expected: every assertion exits 0.

- [ ] **Step 3: Run full repository verification**

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
- Vite builds production assets;
- decoder tests pass unchanged.

- [ ] **Step 4: Review the final diff**

Run:

```bash
git diff --check origin/main...HEAD
git diff --stat origin/main...HEAD
git status --short
```

Expected: no whitespace errors, only planned changes, and no untracked generated files.

- [ ] **Step 5: Mark the plan complete**

Change all completed plan checkboxes from `[ ]` to `[x]`.

- [ ] **Step 6: Archive completed design documents**

Create `docs/archive/visualize/react-simplification/` and move the completed design and plan there:

```bash
mkdir -p docs/archive/visualize/react-simplification
git mv docs/superpowers/specs/2026-06-12-visualize-react-simplification-design.md \
  docs/archive/visualize/react-simplification/
git mv docs/superpowers/plans/2026-06-12-visualize-react-simplification.md \
  docs/archive/visualize/react-simplification/
```

Update `docs/superpowers/specs/README.md` and `docs/superpowers/plans/README.md` only if they list
the moved files explicitly.

- [ ] **Step 7: Commit final documentation**

```bash
git add apps/visualize/README.md apps/visualize/docs \
  docs/superpowers
git commit -m "docs: document visualize React architecture"
```
