# Visualize Type Boundaries Design

## Context

`apps/visualize` now has a clear source layout, but several important boundaries remain weak:

- `strict` TypeScript does not check the JavaScript composition and controller files;
- forecast use cases rely heavily on `unknown`, index signatures, and `*Like` interfaces;
- the same forecast state, resource, package, session, and animation concepts are declared in
  several files;
- `domain/types.ts` contains browser and UI types such as `ImageBitmap`, `ImageData`, and
  `HTMLInputElement`;
- composition imports application status values from a UI module;
- `index.js` still owns the uploaded-file decode and render workflow as well as application
  bootstrap.

The next refactor should make existing architectural boundaries explicit and compiler-enforced
without changing behavior.

## Goal

Give every shared concept one clear owner, make TypeScript verify the contracts between use cases
and adapters, and reduce `index.js` to application composition and event wiring.

## Ownership Rules

### Domain

`src/domain/` owns pure forecast and visualization concepts:

- forecast packages and variables;
- remote forecast resources;
- forecast run state;
- grid and product metadata used by pure calculations;
- value arrays, scales, cache statuses, and other browser-independent values.

Domain types must not reference DOM elements, `ImageBitmap`, `ImageData`, MapLibre objects, workers,
browser storage, or fetch responses.

### Use Cases

`src/use-cases/<feature>/` owns application workflow contracts:

- use-case request and result types;
- session state that coordinates workflows;
- capability-based ports for cache, network, workers, map presentation, controls, scheduling, and
  status reporting;
- application status constants used by workflows.

Ports must describe the minimum capability required by a use case. They must not use open index
signatures merely to avoid declaring required properties.

### Adapters

`src/adapters/` and `src/workers/` own external runtime types:

- MapLibre map, source, layer, bounds, and controls;
- `ImageBitmap`, `ImageData`, canvas, and transferable worker payloads;
- IndexedDB records and browser storage;
- data.gouv API response shapes;
- worker client protocols.

Adapters translate external types into domain or use-case contracts.

### Controllers And Composition

Controllers connect DOM views and events to use-case APIs. Composition wires concrete adapters to
typed ports. Both become TypeScript so contract drift fails during `npm run typecheck:visualize`.

## Canonical Forecast Contracts

The existing reusable types in `src/domain/types.ts` become the starting point, but the file is
split by responsibility:

```text
src/domain/forecast-types.ts
src/domain/field-types.ts
src/use-cases/forecast/contracts.ts
src/use-cases/forecast/ports.ts
```

`forecast-types.ts` contains packages, variables, remote resources, run state, and status unions.
`field-types.ts` contains browser-independent grid, product, header, decoded-field, and rendering
parameter types.

`contracts.ts` contains refresh keys, download sessions, runtime state, bitmap-cache metadata, and
use-case result types. It must not contain DOM elements or concrete adapter classes.

`ports.ts` imports those canonical contracts and defines only capabilities. Generic names such as
`ForecastPackageLike`, `ForecastResourceLike`, and `ForecastDownloadSessionLike` are removed.

## Forecast Status Ownership

Block statuses move out of `ui/data-status-summary.js`. The canonical values belong to the forecast
application contracts:

```ts
export const BLOCK_STATUS = {
  MISSING: "missing",
  LOADED_FROM_CACHE: "loaded-from-cache",
  DOWNLOADING: "downloading",
  READY: "ready",
} as const;
```

UI modules import the status type or receive statuses through their inputs. Composition no longer
imports application constants from UI.

## Incremental Migration

The refactor proceeds through narrow, independently verified slices:

1. canonical pure forecast and field types;
2. resource refresh and download-session contracts;
3. model-block worker and render-result contracts;
4. map presentation and overlay contracts;
5. animation/runtime contracts;
6. typed composition and forecast controller;
7. uploaded-file inspection and rendering workflow;
8. typed bootstrap and final cleanup.

Existing focused tests remain the behavioral safety net. Each slice adds compile-time contract tests
or focused unit tests before replacing loose types.

## Uploaded-File Workflow

The local-file path currently split across `index.js`, the upload inspector controller, the render
worker client, and map presentation becomes a cohesive feature:

```text
src/use-cases/upload-inspector/present-uploaded-field.ts
src/controllers/uploaded-field-controller.ts
```

The use case coordinates:

- resolving the selected message;
- decoding through a decoder port;
- creating render parameters;
- rendering through a worker port;
- returning a presentation result or a typed failure.

The controller owns navigation, DOM-visible errors, palette selection, map visibility, and calls to
the map presentation adapter.

`index.js` no longer contains `showMapView()`, uploaded-field rerendering, or uploaded-field render
state transitions.

## Bootstrap Target

After the workflow extraction, the Vite entry imports a typed bootstrap:

```text
src/main.js
  -> src/bootstrap.ts
```

`bootstrap.ts` may depend on browser globals and concrete adapters because it is the composition
root. It should:

- collect DOM references;
- instantiate controllers and adapters;
- bind routes and events;
- start the router;
- initialize shell-level UI.

It should not contain forecast or uploaded-field workflow algorithms.

## TypeScript Policy

- New and migrated boundary files use `.ts`.
- `checkJs` remains disabled during migration to avoid a repository-wide conversion.
- Every JavaScript boundary removed from type checking is converted before the refactor completes.
- `unknown` remains acceptable only at narrow external parsing boundaries and inside explicit error
  handling.
- Casts through `unknown` require a comment identifying the external contract they bridge, or are
  removed.
- No `any` is introduced.

## Testing And Verification

Each migration slice must run its focused Vitest suites and:

```bash
npm run typecheck:visualize
npm run check:visualize
```

The completed refactor must also run:

```bash
npm run test:visualize
npm run build:visualize
npm test
```

Tests should assert behavior through use-case and controller APIs. Type-only regression fixtures
may use `satisfies` and `@ts-expect-error` to prove required properties and reject invalid
contracts.

## Success Criteria

The refactor is complete when:

- forecast packages, resources, states, sessions, and worker results each have one canonical type;
- `ForecastPackageLike`, `ForecastResourceLike`, and `ForecastDownloadSessionLike` no longer exist;
- use-case ports do not use open index signatures for known application contracts;
- domain types contain no DOM, canvas, worker, or MapLibre types;
- composition no longer imports application constants from UI;
- forecast composition and controllers are TypeScript and pass strict type checking;
- uploaded-field decoding and rendering no longer live in `index.js`;
- the bootstrap contains wiring rather than workflow logic;
- the full test, typecheck, check, decoder-test, and build commands pass.
