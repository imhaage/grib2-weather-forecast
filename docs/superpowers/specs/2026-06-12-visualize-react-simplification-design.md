# Visualize React Simplification Design

## Context

`apps/visualize` is functionally mature and well tested, but its current hexagonal structure has
become expensive to navigate. Features are split across domain modules, use cases, ports, adapters,
controllers, UI helpers, workers, composition factories, and a large bootstrap. Many of these
boundaries are individually reasonable, but their combined cost is disproportionate for a
standalone browser application.

The application remains independent from the decoder internals. It consumes only the built
decoder from `packages/grib2-decoder/dist/`.

## Goal

Rewrite `apps/visualize` as a smaller React application that preserves its current user-facing
capabilities while improving locality, explicitness, testability, and ease of change.

The design uses:

- vertical feature modules;
- a functional core and imperative shell;
- local React state with `useReducer`;
- behavior-focused tests;
- extraction into shared modules only when reuse is demonstrated.

Simplification applies to the implementation and redundant interactions. It must not silently
remove user-facing functionality.

## Chosen Approach

The rewrite will be developed on a dedicated branch as a replacement for the current application.
Stable pure domain logic, workers, and external integrations may be reused when they fit the new
boundaries. Existing architectural layers are not preserved merely to reduce the apparent size of
the rewrite.

Two alternatives were rejected:

- adding React on top of the current hexagonal architecture would retain most of the structural
  overhead;
- rewriting every algorithm and integration from scratch would add regression risk without a
  corresponding design benefit.

## Architecture

The target is one React application with two independently mounted routes:

- `forecast` visualizes remote forecast runs;
- `upload` inspects and visualizes a local GRIB2 file.

The application continues to use hash-based navigation initially so direct navigation remains
compatible with static hosting. The canonical routes are `#/forecast` and `#/upload`.

Changing routes unmounts the feature being left. Feature state is not retained between routes.
This keeps lifecycle and ownership simple. Persistence can be introduced later for selected state
without changing the pure domain model.

The source layout is directional rather than a list of mandatory files:

```text
src/
  app/
    App.tsx
    router.tsx
    ErrorBoundary.tsx

  features/
    forecast/
      ForecastPage.tsx
      ForecastControls.tsx
      useForecast.ts
      forecastReducer.ts
      forecastRuntime.ts
      forecast.test.tsx

    upload/
      UploadPage.tsx
      UploadInspector.tsx
      useUploadedField.ts
      uploadReducer.ts
      uploadRuntime.ts
      upload.test.tsx

    map/
      WeatherMap.tsx
      MapControls.tsx
      MapLegend.tsx
      useMapLibre.ts
      mapRuntime.ts
      mapTypes.ts
      map.test.tsx

  domain/
    forecast.ts
    fields.ts
    palettes.ts
    units.ts
    vectors.ts

  infrastructure/
    workers/
    storage/
    network/

  shared/
    ui/
    hooks/
```

Files and directories are created only when they own a concrete responsibility. There is no
default `providers.tsx`, generic async abstraction, port directory, or one-file-per-concept rule.
A coherent file in the approximate 200 to 500 line range is preferable to several trivial files.

## Dependency Rules

`domain/` is the functional core. It contains browser-independent values and pure operations for
forecast data, fields, grids, palettes, units, vectors, resources, derived display values, and
state transitions. It must not import React, DOM APIs, MapLibre, workers, storage, or network code.

`features/` owns user workflows and their interfaces. Each route feature owns its reducer, React
orchestration, expected errors, and runtime lifecycle.

`infrastructure/` contains mechanisms shared outside a single feature, including workers,
IndexedDB, browser storage, and remote data access.

`shared/` remains intentionally small. Code moves there only after at least two real consumers
demonstrate the same responsibility.

Dependencies point inward toward pure logic:

```text
app -> route feature -> domain
                    -> infrastructure
                    -> map -> mapRuntime -> MapLibre
```

`forecast` and `upload` do not import each other or communicate through global state.

## Shared Map Feature

`features/map/` is a first-class shared feature consumed by both route features. It owns:

- the `WeatherMap` React component;
- MapLibre creation, updates, event binding, and destruction;
- weather sources and layers;
- map interactions and tooltips;
- the visible layer legend;
- palette selection and display;
- displayed units and related controls;
- map-specific expected errors.

It does not own:

- forecast downloads or package selection;
- local file decoding and inspection;
- forecast time selection or animation workflow;
- state reducers belonging to `forecast` or `upload`.

Route features pass a typed, display-ready model to `map` and receive typed interaction callbacks.
The MapLibre integration remains local to the feature in `mapRuntime.ts`. That file provides a
narrow imperative boundary that can be extracted into `infrastructure/maplibre/` later if a second
independent MapLibre consumer appears.

## State And Data Flow

Each route feature uses `useReducer` for meaningful workflow state. Reducers and state transition
helpers remain pure. React hooks coordinate effects and connect reducers to runtimes.

A typical flow is:

1. `forecast` downloads a selected model package, or `upload` reads a selected local file.
2. A worker decodes or prepares the relevant data.
3. Pure domain functions normalize the result and derive display metadata.
4. The route feature passes a typed display model to `map`.
5. `map` renders the layer and reports user interactions through callbacks.

No application state library or global business state is introduced. Shell state is limited to
navigation and unexpected-error recovery.

## Imperative Runtime Lifecycle

External effects remain in feature hooks and runtime modules:

- fetch and data.gouv access;
- workers and transferable data;
- IndexedDB and browser storage;
- MapLibre;
- timers, animation scheduling, and browser events.

Every long-lived runtime must expose an idempotent cleanup path. Route unmounting cancels requests,
terminates or releases workers as appropriate, removes subscriptions, stops timers, and destroys
the MapLibre instance. Results from superseded asynchronous operations are ignored.

## Error Handling

Expected and recoverable failures are part of the owning feature state. The interface displays
contextual messages and a retry or recovery action when one is meaningful.

Unexpected React rendering failures are caught by an application-level `ErrorBoundary`.
Map-specific failures remain local to the map area when the surrounding page can continue to
function.

The initial rewrite does not add a global notification framework, logging framework, or universal
error abstraction.

## Functional Parity

Before replacing the current application, the implementation plan must create a parity matrix that
lists every current user-facing capability. Each item receives one status:

- `preserved`;
- `improved`;
- `removed by explicit decision`.

`preserved` and `improved` items must retain the same functional outcome. An interaction may become
simpler, but no capability is removed as an incidental consequence of the rewrite. Any proposed
removal requires explicit approval.

The matrix covers both routes, map behavior, palettes and units, forecast controls and animation,
local file inspection, storage behavior, progress and status feedback, errors, and responsive
behavior.

## Testing Strategy

The test suite prioritizes stable behavior over implementation details.

### Domain Tests

Pure domain rules, reducers, transformations, and algorithms receive focused unit tests. Existing
domain tests are retained or migrated when their behavior remains relevant.

### Feature Tests

`forecast`, `upload`, and `map` receive behavior-level tests with Vitest, jsdom, and React Testing
Library. Tests exercise meaningful user workflows and observable states rather than testing every
component or hook in isolation.

### Contract Tests

Workers, storage, network parsing, and the `mapRuntime` boundary receive a small number of targeted
contract tests for critical guarantees. These tests verify translation and lifecycle behavior
without reproducing third-party library test suites.

End-to-end browser tests are outside the initial scope.

## Styling

The existing CSS ownership rules remain in force during the rewrite. React components use the
current cascade layers and pragmatic BEM naming. CSS is moved or rewritten only when ownership is
clear, and visual parity is protected by the functional parity review.

## Migration Strategy

The rewrite is performed on a dedicated branch and proceeds through verifiable vertical slices:

1. inventory current behavior and create the parity matrix;
2. establish the React shell and route lifecycle;
3. migrate the shared pure domain core;
4. build the shared map feature and its runtime boundary;
5. rebuild the upload route;
6. rebuild the forecast route;
7. migrate shared infrastructure and remove unused legacy layers;
8. verify parity, tests, type checking, formatting, and production build;
9. replace the legacy entry point only after the new routes satisfy the parity matrix.

This is a complete architectural replacement, but verification remains incremental. The legacy
implementation stays available as a behavioral reference until replacement criteria are met.

## Non-Goals

The initial rewrite does not include:

- preserving feature state between route changes;
- a state-management library;
- end-to-end tests;
- a generic dependency-injection or port framework;
- speculative shared components or hooks;
- a separate MapLibre infrastructure package;
- decoder changes;
- intentional functional reduction.

## Success Criteria

The rewrite is complete when:

- `forecast` and `upload` are independent React route features;
- changing routes fully cleans up the feature being left;
- `map` is shared without depending on either route workflow;
- domain code is browser-independent and directly unit tested;
- expected errors are feature-local and unexpected rendering errors reach the shell boundary;
- workers, storage, network, and MapLibre have targeted contract coverage;
- every parity-matrix item is preserved, improved, or explicitly approved for removal;
- obsolete use-case, adapter, controller, composition, and passive DOM UI layers are removed;
- no new abstraction exists solely to satisfy an architectural pattern;
- visualize tests, type checking, Biome checks, and the production build pass;
- decoder tests continue to pass unchanged.
