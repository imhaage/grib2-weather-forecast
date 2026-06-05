# Visualize Simple Hexagonal Architecture Design

## Context

The `apps/visualize` codebase is moving toward a simple hexagonal architecture. The goal is not to introduce architectural ceremony, but to make the frontend easier to reason about, test, and change.

The current `domain/` folder is already a strong foundation: it contains pure forecast, variable, grid, palette, vector, and resource logic without dependencies on UI, services, controllers, or workers. Recent work also made the forecast run controller thinner by extracting runtime orchestration and wiring.

The remaining issue is that `services/` mixes several responsibilities:

- application use cases and workflow orchestration;
- browser, storage, worker, HTTP, canvas, and MapLibre integrations;
- presentation coordination;
- composition-root wiring.

This makes long-term boundaries harder to understand. The `services/` folder should disappear progressively as files move to clearer layers.

## Target Structure

Use a global, simple structure under `apps/visualize/src`:

```txt
domain/
use-cases/
adapters/
controllers/
ui/
workers/
```

Layer responsibilities:

- `domain/`: pure business and forecast rules, calculations, model metadata, unit transforms, palette logic, vector field logic, resource parsing, and other deterministic code. It must not depend on UI, browser APIs, workers, storage, HTTP, MapLibre, or use-case ports.
- `use-cases/`: application workflows. Use cases orchestrate domain logic through explicit ports. New use-case boundaries must be TypeScript and strict.
- `adapters/`: concrete implementations of use-case ports. Adapters may depend on browser APIs, DOM views, MapLibre, IndexedDB, localStorage, workers, network fetch, canvas, and third-party libraries.
- `controllers/`: thin entry adapters that connect UI events, routing, and concrete adapters to use cases. Controllers keep public APIs stable where existing code depends on them.
- `ui/`: DOM views, view helpers, route helpers, shell behavior, event binding, and simple visual components. UI modules should stay passive and avoid use-case orchestration.
- `workers/`: low-level worker scripts and worker clients. Workers can be used by adapters or domain-like worker cores where appropriate.

## Ports

Ports belong to the internal side of the application, but not usually to `domain/`.

Default location:

```txt
use-cases/<feature>/ports.ts
```

Ports should be defined around capabilities, not around implementation classes. Prefer names such as `fileReader`, `messageIterator`, `forecastMap`, `forecastCache`, or `downloadProgress` over names that mirror a concrete service class.

Create a port only when at least one of these is true:

- the use case would otherwise depend on DOM, MapLibre, workers, fetch, browser storage, canvas, or another external mechanism;
- the behavior needs to be tested without a browser or third-party runtime;
- the dependency includes meaningful translation, orchestration, retry, lifecycle, or state;
- several use cases consume the same capability;
- the port name expresses a clear application capability.

Do not create a port when:

- the code is pure deterministic logic that belongs in `domain/`;
- the abstraction would duplicate the concrete implementation shape without adding meaning;
- the dependency is only a local implementation detail inside an adapter;
- understanding the feature would require unnecessary navigation across many tiny files.

## TypeScript Policy

New boundaries in `use-cases/` and `adapters/` must be TypeScript with strict typing.

Migration rules:

- new files in `use-cases/` and `adapters/` use `.ts`;
- files moved from `services/` into `use-cases/` or `adapters/` should become `.ts`;
- ports are typed explicitly;
- avoid `any`; use it only when unavoidable and local to an external integration boundary;
- existing JavaScript files can remain during the migration through `allowJs`;
- tests can remain JavaScript initially, but important new ports and use cases need focused test coverage.

## Upload Inspector First Slice

The first migration slice is `upload-inspector`, because it is small enough to validate the architecture without changing a large forecast workflow.

Target files:

```txt
use-cases/upload-inspector/
  ports.ts
  inspect-uploaded-file.ts

adapters/upload-inspector/
  browser-file-reader-adapter.ts
```

The existing `createUploadInspectorController` public API stays stable:

```txt
processFile(file)
getSelectedMessage(route)
hasFile()
reset()
```

The controller becomes a thin adapter:

- it calls the upload inspection use case;
- it receives use-case events;
- it maps events to existing UI view updates and user-facing text;
- it stores the currently inspected messages so routing can still resolve selected messages.

The use case is event-driven and does not know DOM or UI text:

```ts
type UploadInspectionEvent =
  | { type: "reading" }
  | { type: "empty" }
  | { type: "ready"; result: UploadInspectionResult }
  | { type: "error"; error: Error };
```

The use case is responsible for:

- emitting `reading`;
- reading the file through a `FileReaderPort`;
- parsing GRIB2 messages through a message iterator port;
- returning a typed result for the ready state;
- emitting `empty` when no GRIB2 messages are found;
- emitting `error` for technical failures.

The controller or presentation adapter is responsible for mapping those states to UI text such as:

- `Reading file...`
- `No GRIB2 messages found.`
- `Error: ...`

## Forecast Migration Direction

After the upload inspector slice validates the shape, forecast code should migrate progressively:

- orchestration currently in `services/forecast-runtime.js` and related application workflow services moves to `use-cases/forecast/`;
- concrete integrations currently in services move to `adapters/forecast/`;
- `forecast-runtime-factory` should shrink toward a composition root, not a workflow container;
- MapLibre, canvas, wind symbol, isobar layer, storage, network, and worker integrations stay behind use-case ports;
- `ui/` remains in place for passive DOM views and event helpers.

## Success Criteria

This migration is successful if:

- `services/` shrinks over time and eventually disappears;
- use cases can be tested without DOM, MapLibre, fetch, storage, or real workers;
- adapters are feature-oriented but remain bound to explicit ports;
- `domain/` stays pure and dependency-free from application and infrastructure layers;
- controllers remain small and stable;
- TypeScript catches contract drift at the boundaries;
- the architecture improves clarity without increasing ceremony.
