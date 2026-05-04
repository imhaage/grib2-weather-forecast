# Monorepo — Decoder Library Extraction

**Date:** 2026-05-04
**Status:** Approved

## Goal

Reorganize the project into an npm workspaces monorepo, extracting the GRIB2 decoder into a standalone package consumed by the AROME visualizer via an import map.

## Repo Structure

```
/  (workspace root)
├── package.json                      ← private, workspaces config, passthrough scripts
├── packages/
│   └── grib2-decoder/
│       ├── package.json              ← name: "grib2-decoder", exports → dist/
│       ├── rolldown.config.js        ← builds src/ → dist/
│       ├── src/                      ← moved from current src/
│       ├── test/                     ← moved from current test/
│       ├── grib2-info.js             ← moved from root
│       └── grib2-export.js           ← moved from root
└── apps/
    └── arome-visualizer/
        ├── package.json              ← private, depends on "grib2-decoder": "*"
        └── index.html                ← moved from root, adds import map
```

## Package Configs

### Root `package.json`
- `"private": true`
- `"workspaces": ["packages/*", "apps/*"]`
- Passthrough scripts: `build` (decoder), `test` (decoder), `serve` (root)
- No `type: module` at root level (each workspace declares its own)

### `packages/grib2-decoder/package.json`
- Keeps current name, version, description, license
- `"type": "module"`
- `"exports": { ".": "./dist/grib2-decoder.js" }`
- Scripts: `"build": "rolldown -c"`, `"test": "node --test ..."`
- DevDependency: `rolldown`

### `apps/arome-visualizer/package.json`
- `"private": true`
- `"type": "module"`
- `"dependencies": { "grib2-decoder": "*" }` — npm resolves this to the local workspace package
- Script: `"serve": "npx serve ../../"` (serves from repo root)

## Build — Decoder Package

**Tool:** Rolldown (Rust-based Rollup-compatible bundler)

**Entry:** `src/index.js`
**Output:** `dist/grib2-decoder.js` (ESM format)

**WASM handling:** Two files from `src/wasm/` must land in `dist/` unchanged:
- `ccsds.wasm` — the compiled WASM binary
- `ccsds.js` — the Emscripten glue, dynamically imported at runtime (`await import('./ccsds.js')`); Rolldown keeps dynamic imports as separate chunks, so it resolves to `dist/ccsds.js`

Both are copied to `dist/` via `generateBundle` hooks. Emscripten's default `locateFile` finds `ccsds.wasm` relative to `ccsds.js`, so both being in `dist/` is sufficient — no changes to the loader.

**Build command (from root):**
```bash
npm run build
# equivalent to: npm run build -w packages/grib2-decoder
```

## Browser Resolution — Import Map

The visualizer is a plain HTML file with native ES modules. A `<script type="importmap">` block added to `index.html` maps the bare specifier to the built file:

```html
<script type="importmap">
  { "imports": { "grib2-decoder": "/packages/grib2-decoder/dist/grib2-decoder.js" } }
</script>
```

The server is run from the **repo root** so `/packages/...` paths resolve correctly. The WASM files at `/packages/grib2-decoder/dist/ccsds.js` and `/packages/grib2-decoder/dist/ccsds.wasm` are found automatically.

**Serve command (from root):**
```bash
npm run serve
# visualizer at: http://localhost:3000/apps/arome-visualizer/
```

## Root Scripts (passthrough)

```json
{
  "scripts": {
    "build": "npm run build -w packages/grib2-decoder",
    "test":  "npm test -w packages/grib2-decoder",
    "serve": "npx serve .",
    "info":  "node packages/grib2-decoder/grib2-info.js",
    "export": "node packages/grib2-decoder/grib2-export.js"
  }
}
```

## What Changes in `index.html`

1. Add `<script type="importmap">` before the first `<script type="module">`
2. Replace the three separate `./src/` imports with a single import from `'grib2-decoder'`:
   - `./src/index.js` (decoder + iterateGRIB2Messages etc.)
   - `./src/stats.js` (computeStats — already re-exported by src/index.js)
   - `./src/wmo-tables.js` (fmtRefTime etc. — already re-exported by src/index.js)

   All become: `import { ... } from 'grib2-decoder'`

## What Does Not Change

- All files in `src/` — decoder source is untouched
- All files in `test/` — tests move with the decoder, paths unchanged relative to package root
- The visualizer logic in `index.html` — only imports and the import map change

## `dist/` in Git

Commit `dist/` to the repo. The decoder is not yet published to npm, and committing dist means a fresh clone serves the visualizer without requiring a build step. Revisit when publishing to npm.
