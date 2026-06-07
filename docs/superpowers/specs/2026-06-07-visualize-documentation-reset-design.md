# Visualize Documentation Reset Design

## Context

`apps/visualize` has changed substantially since its current documentation was written. Several
documents describe removed services, old global state, obsolete file paths, completed migrations,
and superseded test suites.

The application is intentionally separate from the decoder implementation. It consumes the
published `grib2-decoder` package output and must not document decoder internals. Decoder design,
formats, algorithms, and CLI behavior remain repository-level concerns outside this reset.

## Goal

Replace the fragmented active documentation for `apps/visualize` with one short, clear, current
entry point:

```text
apps/visualize/README.md
```

Historical documents remain available for context, but are moved out of active documentation so
they cannot be mistaken for current instructions.

## Active Documentation

`apps/visualize/README.md` becomes the single source of truth for the application.

It targets both users and contributors, with contributor details kept concise. It contains:

1. application purpose and current capabilities;
2. local installation and startup;
3. application-specific npm commands;
4. a brief source architecture overview;
5. the decoder boundary;
6. the main runtime data flow;
7. tests and quality checks;
8. known operational constraints.

The README documents stable concepts and current boundaries. It avoids inventories of every
function, state property, variable, test file, or migration step because those details become stale
quickly.

## Decoder Boundary

The application treats `grib2-decoder` as an opaque dependency.

The README may explain that:

- the dependency is imported through the package export;
- the application uses it to inspect message metadata and decode selected fields;
- decoder output includes message metadata, grid information, values, and missing-value data.

The README must not explain:

- GRIB2 section layouts;
- data representation templates;
- CCSDS or JPEG 2000 internals;
- decoder source modules;
- decoder build or CLI implementation.

Those topics remain in repository-level decoder documentation.

## Architecture Overview

The architecture section presents only the current responsibilities:

```text
src/domain/        pure forecast and visualization logic
src/use-cases/     application workflows and ports
src/adapters/      browser, storage, network, worker, and MapLibre integrations
src/controllers/   entry points connecting UI events to use cases
src/ui/            passive DOM views, routing, and event binding
src/workers/       background download, decode, and rendering work
src/composition/   runtime dependency wiring
```

The transitional `services/` directory is not presented as an architectural layer. If it is empty
when the reset is implemented, it should be removed.

## Runtime Data Flow

The README describes the runtime at a conceptual level:

```text
data.gouv.fr resources
  -> Cloudflare proxy
  -> download worker
  -> IndexedDB and in-memory runtime state
  -> decoder package
  -> render/model workers
  -> MapLibre raster, isobar, and wind-symbol layers
```

It also explains the independent uploaded-file flow:

```text
local GRIB2 file
  -> browser file adapter
  -> message inspection
  -> selected-message decoding
  -> worker rendering
  -> MapLibre
```

Implementation-level queue, cache, and state-machine details are omitted unless needed to explain
a user-visible constraint.

## Archive Structure

Historical application documentation moves to:

```text
docs/archive/visualize/
├── README.md
├── frontend.md
├── frontend-modernization.md
├── mobile-performance.md
├── architecture-migration-todo.md
├── visualize-test-audit.md
├── plans/
└── specs/
```

The archive README states clearly that archived files:

- describe earlier implementation states or completed work;
- may contain invalid paths, commands, assumptions, and architecture;
- must not be used as current contributor instructions;
- are retained only for design and project history.

All existing `apps/visualize` plans and specs in `docs/superpowers/plans/` and
`docs/superpowers/specs/` move into the archive once this reset is implemented. The reset design and
its implementation plan also become historical after completion.

The following remain outside this archive:

- decoder and CLI documentation;
- reference-data and cross-validation documents;
- repository-wide external resources;
- explicitly paused future work under `docs/superpowers/paused/`.

Existing documents already under `docs/superpowers/outdated/` remain where they are. They are
already clearly marked as historical, so moving them again would add churn without improving
clarity.

## Repository Entry Point

The root `README.md` remains repository-level documentation. This reset does not rewrite it.

It should receive only a small link to `apps/visualize/README.md` if no clear application link
exists when implementation begins. Broader root README cleanup is a separate task.

## Validation

Documentation validation consists of:

- checking every documented path and command against the current repository;
- running the documented test, typecheck, check, build, and development commands where practical;
- searching active documentation for references to removed `src/services` modules and obsolete
  functions such as the old global `showHour()` flow;
- confirming that active Superpowers plan/spec indexes no longer list archived work as current;
- confirming all Markdown links resolve locally.

No application behavior or production code changes are part of this reset.

## Success Criteria

The reset is complete when:

- `apps/visualize/README.md` is sufficient to understand, run, test, and navigate the application;
- application documentation contains no decoder implementation details;
- obsolete application documents and completed plans/specs are clearly archived;
- paused future work remains discoverable and unchanged;
- active documentation no longer contradicts the current source layout;
- contributors have one obvious documentation entry point for `apps/visualize`.
