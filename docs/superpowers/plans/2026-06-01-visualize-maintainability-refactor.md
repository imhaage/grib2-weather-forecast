# Visualize Maintainability Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `apps/visualize` easier to understand, test, and evolve by reducing `index.js` responsibilities and moving duplicated logic behind clear module boundaries.

**Architecture:** Start with low-risk DOM registry cleanup, then extract isolated controllers and shared domain/rendering logic. Keep the current vanilla JS architecture and user-visible behavior unchanged during the refactor.

**Tech Stack:** Vite, vanilla JavaScript, Web Workers, MapLibre GL, IndexedDB, Vitest, Biome, TypeScript types where useful.

---

## Current DRY And Maintainability Issues

- `apps/visualize/index.js` still owns too many responsibilities: global app state, route reactions, forecast download/cache orchestration, map rendering, upload inspection, animation cache, DOM updates, and worker calls.
- DOM access is inconsistent: `createDom()` exists, but `index.js` still uses many direct `document.getElementById()` calls.
- Raster rendering logic is duplicated between `apps/visualize/render-worker.js` and `apps/visualize/model-block-worker.js`.
- Web Mercator projection helpers are duplicated in `index.js` and `model-block-worker.js`, and should be replaced by a reputable GIS/web-mapping utility where practical.
- Forecast field rules are duplicated between main thread and worker: effective forecast time, accumulation handling, variable lookup, and render parameter construction.
- Some UI strings and grouping constants are repeated across modules.

---

## Checklist

### Task 1: Complete DOM Registry Boundaries First

**Reason:** This is safe to do first. It reduces hidden coupling before larger controller extraction and makes future moves easier to review.

**Files:**
- Modify: `apps/visualize/src/ui/dom.js`
- Modify: `apps/visualize/index.js`
- Test: `apps/visualize/src/ui/dom.test.js`

- [x] Add missing DOM groups to `createDom()`: performance diagnostics, cache warmup internals, color scale, map info, upload summary, map unavailable, view containers.
- [x] Replace direct `document.getElementById()` calls in `index.js` with `domRefs` / `dom`.
- [x] Keep dynamic ID lookups for download block rows if needed, or isolate them behind helper functions.
- [x] Run `npm run check:visualize`.
- [x] Run `npm run test:visualize`.
- [x] Commit: `refactor: complete visualize dom registry`.

### Task 2: Extract Upload Inspector Controller

**Reason:** Upload inspection is independent from forecast runs and should not live in the same orchestration module.

**Files:**
- Create: `apps/visualize/src/controllers/upload-inspector-controller.js`
- Modify: `apps/visualize/index.js`
- Test: `apps/visualize/src/controllers/upload-inspector-controller.test.js`

- [x] Move `fileState`, `processFile`, `setStatus`, `buildCard`, `findUploadedMessage`, and uploaded-file map lookup behavior into the controller.
- [x] Expose a small API: `processFile(file)`, `getSelectedMessage(route)`, `reset()`, `hasFile()`.
- [x] Keep route decisions in the router/app shell, not inside the controller.
- [x] Add tests for multi-message rendering count, reset behavior, and message-index lookup.
- [x] Run `npm run test:visualize`.
- [x] Commit: `refactor: extract upload inspector controller`.

### Task 3: Extract Map Presentation Helpers

**Reason:** `index.js` currently mixes domain data, render output, MapLibre state, stats, legend, and metadata updates.

**Files:**
- Create: `apps/visualize/src/controllers/map-presentation-controller.js`
- Modify: `apps/visualize/index.js`
- Test: `apps/visualize/src/controllers/map-presentation-controller.test.js`

- [x] Move map metadata updates: parameter title, description, subtitle, level info, valid time.
- [x] Move color scale updates and stats rendering.
- [x] Move unavailable-map state rendering.
- [x] Keep `map-renderer-service` focused on MapLibre/canvas operations.
- [x] Add tests around legend/static scale labels and unavailable state.
- [x] Run `npm run test:visualize`.
- [x] Commit: `refactor: extract map presentation controller`.

### Task 4: Extract Shared Forecast Field Domain Logic

**Reason:** Forecast-time and accumulation rules must be single-source-of-truth before worker cleanup.

**Files:**
- Create: `apps/visualize/src/domain/forecast-field.js`
- Modify: `apps/visualize/index.js`
- Modify: `apps/visualize/model-block-worker.js`
- Test: `apps/visualize/src/domain/forecast-field.test.js`

- [x] Extract `effectiveForecastTime(product, block)`.
- [x] Extract message key construction for `shortName` and optional `levelValue`.
- [x] Extract accumulation-diff calculation for PDT 4.8.
- [x] Extract render-scale parameter creation where it can be shared safely.
- [x] Add tests for single-hour accumulation, level-specific variable lookup, missing previous hour fallback, and regular fields.
- [x] Run `npm run test:visualize`.
- [x] Commit: `refactor: share forecast field logic`.

### Task 5: Deduplicate Raster Rendering Core And Web Mercator Projection

**Reason:** The pixel loop is performance-sensitive and should not exist in two different implementations.
Projection math should also rely on a proven GIS/web-mapping utility instead of hand-rolled formulas when the dependency cost is acceptable.

**Files:**
- Create: `apps/visualize/src/workers/render-field-core.js`
- Create: `apps/visualize/src/domain/web-mercator.js`
- Modify: `apps/visualize/render-worker.js`
- Modify: `apps/visualize/model-block-worker.js`
- Modify: `apps/visualize/package.json`
- Test: `apps/visualize/src/workers/render-field-core.test.js`
- Test: `apps/visualize/src/domain/web-mercator.test.js`

- [x] Evaluate `@math.gl/web-mercator` as the preferred shared Web Mercator dependency because it is worker-friendly and aligned with the web mapping ecosystem.
- [x] Add the dependency only if bundle/worker compatibility is acceptable; otherwise document why the local fallback remains.
- [x] Extract projection and canvas-height calculation behind `src/domain/web-mercator.js`, so main thread and workers use the same API.
- [x] Extract the pixel loop into a pure function that returns `ImageData` plus stats.
- [x] Use the shared core from both workers.
- [x] Preserve transfer behavior for `ImageBitmap` and optional values.
- [x] Add tests for projection consistency, stats, missing values, zero threshold, linear scale, and log scale.
- [x] Run `npm run test:visualize`.
- [x] Run `npm run build:visualize`.
- [x] Commit: `refactor: share raster rendering core`.

### Task 6: Extract Forecast Run Controller

**Reason:** This is the largest move. It should happen after DOM and shared-domain cleanup to reduce risk.

**Files:**
- Create: `apps/visualize/src/controllers/forecast-run-controller.js`
- Modify: `apps/visualize/index.js`
- Test: `apps/visualize/src/controllers/forecast-run-controller.test.js`

- [ ] Move `modelState` creation and lifecycle.
- [ ] Move package resource fetching, session creation, download/cache refresh orchestration.
- [ ] Move `showHour`, prerender queue coordination, tooltip hydration, and animation cache state.
- [ ] Keep router and top-level app event wiring in `index.js`.
- [ ] Inject services instead of importing browser globals directly where practical.
- [ ] Add controller tests for cached blocks, missing blocks, stale refresh, variable change, palette change, and slider hour display.
- [ ] Run `npm run test:visualize`.
- [ ] Run `npm run build:visualize`.
- [ ] Commit: `refactor: extract forecast run controller`.

### Task 7: Simplify Forecast Block Refresh Service Ports

**Reason:** The service API currently exposes too many callbacks, which makes the boundary hard to reason about.

**Files:**
- Modify: `apps/visualize/src/services/forecast-block-refresh-service.js`
- Modify: `apps/visualize/src/services/forecast-block-refresh-service.test.js`
- Modify: `apps/visualize/src/controllers/forecast-run-controller.js`

- [ ] Replace the long callback list with grouped ports: `cache`, `network`, `status`, `presentation`, `lifecycle`.
- [ ] Keep refresh ordering unchanged: cache first, missing network fetch second, stale updates third.
- [ ] Preserve all existing tests and add one test that verifies stale updates still happen after missing files.
- [ ] Run `npm run test:visualize`.
- [ ] Commit: `refactor: simplify forecast refresh ports`.

### Task 8: Type The Main Contracts

**Reason:** TypeScript should secure module boundaries once they exist, not force a risky rewrite first.

**Files:**
- Modify: `apps/visualize/src/domain/types.ts`
- Add JSDoc typedef imports or convert small modules to `.ts`
- Modify: `apps/visualize/tsconfig.json`

- [ ] Add types for render worker requests/results.
- [ ] Add types for forecast run state and download session.
- [ ] Add types for uploaded file state and selected message route.
- [ ] Enable `checkJs: true` only for selected modules if the whole app is not ready.
- [ ] Run `npm run typecheck:visualize`.
- [ ] Run `npm run test:visualize`.
- [ ] Commit: `refactor: type visualize contracts`.

### Task 9: Shrink `index.js` To App Composition

**Reason:** The final architecture target is that `index.js` wires modules together but does not implement feature behavior.

**Files:**
- Modify: `apps/visualize/index.js`
- Possibly modify extracted controllers if integration gaps appear.

- [ ] Keep imports, service/controller creation, router creation, and event binding in `index.js`.
- [ ] Remove feature-level helper functions that now belong to controllers or domain modules.
- [ ] Confirm `index.js` is mostly composition code and significantly smaller.
- [ ] Run `npm run check:visualize`.
- [ ] Run `npm run test:visualize`.
- [ ] Run `npm run build:visualize`.
- [ ] Commit: `refactor: simplify visualize app composition`.

---

## Execution Notes

- Start with Task 1 even though it was originally review point 5. This is low risk and makes every later extraction easier.
- Keep behavior identical after every task.
- Commit after each task only when checks pass.
- Do not push unless explicitly requested.
- Prefer small, reviewable diffs over broad rewrites.
- If a task reveals unclear ownership, stop and clarify the boundary before coding further.
