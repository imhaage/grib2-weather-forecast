# GRIB2 Weather Forecast Visualizer

Browser application for exploring weather forecast runs and inspecting local GRIB2 files. Forecast
data is decoded and rendered in the browser; no application server processes GRIB2 data.

## Features

- Browse AROME and ARPEGE forecast packages published on data.gouv.fr.
- Animate forecast hours on a MapLibre map.
- Cache downloaded GRIB2 blocks in IndexedDB.
- Display raster weather fields, isobars, and wind-direction symbols.
- Inspect the messages and metadata in a local GRIB2 file.
- Decode and render a selected local field without uploading the file.

## Run Locally

From the repository root:

```bash
npm install
npm run dev:visualize
```

Vite serves the application on the address printed in the terminal.

The online forecast player fetches data through the configured Cloudflare proxy. Local-file
inspection does not require the proxy.

## Commands

```bash
npm run dev:visualize        # development server
npm run build:visualize      # production build
npm run preview:visualize    # preview the production build
npm run test:visualize       # Vitest suite
npm run typecheck:visualize  # TypeScript checks
npm run check:visualize      # Biome checks
```

## Source Architecture

The application uses a small hexagonal architecture:

```text
src/domain/        pure forecast and visualization logic
src/use-cases/     application workflows and ports
src/adapters/      browser, storage, network, worker, and MapLibre integrations
src/controllers/   entry points connecting UI events to use cases
src/ui/            passive DOM views, routing, and event binding
src/workers/       background download, decode, and rendering work
src/composition/   runtime dependency wiring
```

`src/main.js` is the Vite entry point. `index.js` still contains shared bootstrap and uploaded-field
rendering code while application workflows live behind controllers and use cases.

## Decoder Boundary

The application consumes `grib2-decoder` through its package export. It uses the package to inspect
GRIB2 message metadata and decode selected fields, but does not depend on decoder implementation
details.

Decoder formats, compression algorithms, source modules, builds, and CLI tools are documented at
the repository level.

## Data Flow

Online forecast runs:

```text
data.gouv.fr
  -> Cloudflare proxy
  -> download worker
  -> IndexedDB and in-memory runtime state
  -> grib2-decoder
  -> model/render workers
  -> MapLibre raster, isobar, and wind-symbol layers
```

Local files:

```text
local GRIB2 file
  -> browser file adapter
  -> message inspection
  -> selected-message decoding
  -> render worker
  -> MapLibre
```

## Tests

Run the application checks from the repository root:

```bash
npm run test:visualize
npm run typecheck:visualize
npm run check:visualize
npm run build:visualize
```

Tests are organized beside the domain, use-case, adapter, controller, UI, worker, and composition
modules they cover.

## Constraints

- Forecast files are large and browser storage can grow to several gigabytes.
- Rendering and animation can require substantial memory, especially for high-resolution AROME
  fields.
- Online data availability depends on data.gouv.fr publication and the download proxy.
- The application targets modern browsers with WebAssembly, Web Workers, IndexedDB, and MapLibre
  support.
