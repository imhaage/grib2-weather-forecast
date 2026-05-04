# Monorepo — Decoder Library Extraction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reorganize the project into an npm workspaces monorepo, extracting the GRIB2 decoder into `packages/grib2-decoder` (with a Rolldown build) and moving the AROME visualizer into `apps/arome-visualizer` (importing via import map).

**Architecture:** The root `package.json` declares workspaces and exposes passthrough scripts. The decoder is a standalone package with its own `package.json` and Rolldown build that outputs `dist/grib2-decoder.js` + the Emscripten WASM files. The visualizer is a plain HTML app that resolves `'grib2-decoder'` via an `<script type="importmap">` pointing at the decoder's dist output, served from the repo root.

**Tech Stack:** npm workspaces, Rolldown (ESM library bundler), native ES modules, browser import maps.

---

## File Map

| Action | From | To |
|--------|------|----|
| Overwrite | `package.json` | root workspace config |
| git mv | `src/` | `packages/grib2-decoder/src/` |
| git mv | `test/` | `packages/grib2-decoder/test/` |
| git mv | `grib2-info.js` | `packages/grib2-decoder/grib2-info.js` |
| git mv | `grib2-export.js` | `packages/grib2-decoder/grib2-export.js` |
| git mv | `index.html` | `apps/arome-visualizer/index.html` |
| Create | — | `packages/grib2-decoder/package.json` |
| Create | — | `packages/grib2-decoder/rolldown.config.js` |
| Create | — | `apps/arome-visualizer/package.json` |
| Modify | — | `apps/arome-visualizer/index.html` |
| Modify | — | `.gitignore` |
| Modify | — | `netlify.toml` |
| Modify | — | `CLAUDE.md` |
| Generated + committed | — | `packages/grib2-decoder/dist/` |

---

## Task 1: Scaffold Monorepo Root

**Files:**
- Overwrite: `package.json`
- Modify: `.gitignore`

- [ ] **Step 1: Overwrite root `package.json`**

Replace the entire file with the workspace root config. The old devDependency `jest` is unused (tests run with `node --test`), so it is dropped here.

```json
{
  "name": "grib2-monorepo",
  "private": true,
  "workspaces": [
    "packages/*",
    "apps/*"
  ],
  "scripts": {
    "build":  "npm run build -w packages/grib2-decoder",
    "test":   "npm test -w packages/grib2-decoder",
    "serve":  "npx serve .",
    "info":   "node packages/grib2-decoder/grib2-info.js",
    "export": "node packages/grib2-decoder/grib2-export.js"
  }
}
```

- [ ] **Step 2: Update `.gitignore`**

The current `.gitignore` ignores `node_modules/` and `package-lock.json` at root. Add an explicit un-ignore for `dist/` so the decoder build output is committed (no npm publish yet — dist is needed for a fresh-clone to work without a build step).

Append to `.gitignore`:
```
# Decoder build output — committed until npm publish is set up
!packages/grib2-decoder/dist/
```

- [ ] **Step 3: Commit**

```bash
git add package.json .gitignore
git commit -m "chore: scaffold npm workspaces monorepo root"
```

---

## Task 2: Extract Decoder Package

**Files:**
- Create dir: `packages/grib2-decoder/`
- git mv: `src/` → `packages/grib2-decoder/src/`
- git mv: `test/` → `packages/grib2-decoder/test/`
- git mv: `grib2-info.js`, `grib2-export.js` → `packages/grib2-decoder/`
- Create: `packages/grib2-decoder/package.json`

- [ ] **Step 1: Create package directory and move files**

```bash
mkdir -p packages/grib2-decoder
git mv src packages/grib2-decoder/src
git mv test packages/grib2-decoder/test
git mv grib2-info.js packages/grib2-decoder/grib2-info.js
git mv grib2-export.js packages/grib2-decoder/grib2-export.js
```

- [ ] **Step 2: Create `packages/grib2-decoder/package.json`**

```json
{
  "name": "grib2-decoder",
  "version": "0.1.0",
  "description": "Browser-compatible GRIB2 decoder (edition 2) supporting simple & complex packing",
  "type": "module",
  "exports": {
    ".": "./dist/grib2-decoder.js"
  },
  "scripts": {
    "build":        "rolldown -c",
    "test":         "node --test test/decoder.test.js test/e2e.test.js test/cross-decode.test.js",
    "make-fixture": "node test/generate-fixture.js test/arome__001__SP1__01H__2026-04-25T03_00_00Z.grib2"
  },
  "license": "Apache-2.0",
  "devDependencies": {
    "rolldown": "latest"
  }
}
```

- [ ] **Step 3: Install dependencies from repo root**

Always run `npm install` from the repo root when working with workspaces — it installs all workspace packages and creates symlinks in root `node_modules/`.

```bash
npm install
```

Expected: creates/updates root `node_modules/`, symlinks `packages/grib2-decoder` and (later) `apps/arome-visualizer` under `node_modules/`.

- [ ] **Step 4: Run tests to verify nothing broke**

```bash
npm test
```

Expected output: 93 tests pass. Test files use `new URL('../test/arome...', import.meta.url)` for GRIB2 fixtures — these paths are relative to the test file location and resolve correctly after the move.

- [ ] **Step 5: Commit**

```bash
git add packages/grib2-decoder/package.json package-lock.json
git commit -m "chore: extract decoder into packages/grib2-decoder"
```

---

## Task 3: Add Rolldown Build

**Files:**
- Create: `packages/grib2-decoder/rolldown.config.js`
- Generated: `packages/grib2-decoder/dist/grib2-decoder.js`
- Generated: `packages/grib2-decoder/dist/ccsds.js`
- Generated: `packages/grib2-decoder/dist/ccsds.wasm`

- [ ] **Step 1: Create `packages/grib2-decoder/rolldown.config.js`**

Key decisions in this config:
- `external: (id) => id.endsWith('ccsds.js')` — the Emscripten glue is dynamically imported at runtime (`await import('./ccsds.js')`); marking it external keeps the dynamic import in the output as `'./ccsds.js'`, which resolves correctly to `dist/ccsds.js` at runtime.
- Both `ccsds.js` and `ccsds.wasm` are copied to `dist/` via the `generateBundle` hook so Emscripten's default `locateFile` finds `ccsds.wasm` next to `ccsds.js`.

```js
import { defineConfig } from 'rolldown';
import { readFileSync } from 'node:fs';

export default defineConfig({
  input: 'src/index.js',
  external: (id) => id.endsWith('ccsds.js'),
  output: {
    file: 'dist/grib2-decoder.js',
    format: 'es',
  },
  plugins: [
    {
      name: 'copy-wasm-assets',
      generateBundle() {
        for (const file of ['ccsds.js', 'ccsds.wasm']) {
          this.emitFile({
            type: 'asset',
            fileName: file,
            source: readFileSync(new URL(`src/wasm/${file}`, import.meta.url)),
          });
        }
      },
    },
  ],
});
```

- [ ] **Step 2: Run the build**

```bash
npm run build
```

Expected: no errors, `packages/grib2-decoder/dist/` is created.

- [ ] **Step 3: Verify dist/ output**

```bash
ls packages/grib2-decoder/dist/
```

Expected output — exactly three files:
```
ccsds.js
ccsds.wasm
grib2-decoder.js
```

If `ccsds.js` or `ccsds.wasm` is missing, check the `generateBundle` hook path — `new URL('src/wasm/ccsds.js', import.meta.url)` is relative to `rolldown.config.js`, so it resolves to `packages/grib2-decoder/src/wasm/ccsds.js`.

- [ ] **Step 4: Spot-check the bundle**

```bash
head -5 packages/grib2-decoder/dist/grib2-decoder.js
grep "import(" packages/grib2-decoder/dist/grib2-decoder.js | head -3
```

Expected: file starts with valid JS, and there is a `import('./ccsds.js')` dynamic import preserved in the output (not inlined).

- [ ] **Step 5: Commit**

```bash
git add packages/grib2-decoder/rolldown.config.js packages/grib2-decoder/dist/
git commit -m "feat: add Rolldown build for grib2-decoder package"
```

---

## Task 4: Set Up Visualizer App

**Files:**
- Create dir: `apps/arome-visualizer/`
- git mv: `index.html` → `apps/arome-visualizer/index.html`
- Create: `apps/arome-visualizer/package.json`
- Modify: `apps/arome-visualizer/index.html`

- [ ] **Step 1: Move index.html**

```bash
mkdir -p apps/arome-visualizer
git mv index.html apps/arome-visualizer/index.html
```

- [ ] **Step 2: Create `apps/arome-visualizer/package.json`**

```json
{
  "name": "arome-visualizer",
  "private": true,
  "type": "module",
  "dependencies": {
    "grib2-decoder": "*"
  },
  "scripts": {
    "serve": "npx serve ../../"
  }
}
```

- [ ] **Step 3: Re-run npm install from root to wire up the workspace dependency**

```bash
npm install
```

Expected: npm creates `node_modules/grib2-decoder` as a symlink to `packages/grib2-decoder`.

- [ ] **Step 4: Add the import map to `apps/arome-visualizer/index.html`**

Add this block immediately before the existing `<script type="module">` tag (which is currently around line 720). The import map must appear before any module script.

Old:
```html
    <script type="module">
```

New:
```html
    <script type="importmap">
      {
        "imports": {
          "grib2-decoder": "/packages/grib2-decoder/dist/grib2-decoder.js"
        }
      }
    </script>
    <script type="module">
```

- [ ] **Step 5: Consolidate the three decoder imports into one**

Old (lines ~723–735 in the file):
```js
      import {
        iterateGRIB2Messages,
        decodeGRIB2,
        MISSING_VALUE,
      } from "./src/index.js";
      import { computeStats } from "./src/stats.js";
      import {
        CENTRES,
        GENERATING_PROCESS,
        fmtRefTime,
        fmtLevel,
        fmtValidTime,
      } from "./src/wmo-tables.js";
```

New (single import — all symbols are re-exported by `src/index.js`):
```js
      import {
        iterateGRIB2Messages,
        decodeGRIB2,
        MISSING_VALUE,
        computeStats,
        CENTRES,
        GENERATING_PROCESS,
        fmtRefTime,
        fmtLevel,
        fmtValidTime,
      } from "grib2-decoder";
```

- [ ] **Step 6: Verify the app loads**

```bash
npm run serve
```

Open `http://localhost:3000/apps/arome-visualizer/` in the browser.

Expected: the app loads, the AROME shortcut buttons appear, dropping a GRIB2 file displays the map. Open DevTools → Network and confirm `grib2-decoder.js` and `ccsds.js` are fetched from `/packages/grib2-decoder/dist/`.

- [ ] **Step 7: Commit**

```bash
git add apps/arome-visualizer/ package-lock.json
git commit -m "feat: move visualizer to apps/arome-visualizer, wire import map"
```

---

## Task 5: Update Supporting Files

**Files:**
- Modify: `netlify.toml`
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update `netlify.toml`**

The whole repo is served from root so the absolute import map path `/packages/grib2-decoder/dist/...` resolves correctly on Netlify. Add a redirect so visiting `/` goes to the app.

Old:
```toml
[build]
  publish = "."
```

New:
```toml
[build]
  publish = "."

[[redirects]]
  from = "/"
  to   = "/apps/arome-visualizer/"
  status = 301
```

- [ ] **Step 2: Update `CLAUDE.md`**

Replace the commands block with updated paths:

Old:
```
**Fichier de test :** `test/arome__001__SP1__01H__2026-04-25T03_00_00Z.grib2` (~24 MB, AROME, Météo-France)
```

New:
```
**Fichier de test :** `packages/grib2-decoder/test/arome__001__SP1__01H__2026-04-25T03_00_00Z.grib2` (~24 MB, AROME, Météo-France)
```

Old commands block:
```bash
npm test                                          # 93 tests
npm run info -- <file.grib2>                      # rapport métadonnées
npm run export -- <file.grib2> --variable <name>  # export CSV
npm run serve                                     # serveur local
```

New:
```bash
npm test                                          # 93 tests (runs in packages/grib2-decoder)
npm run build                                     # build decoder → packages/grib2-decoder/dist/
npm run info -- <file.grib2>                      # rapport métadonnées
npm run export -- <file.grib2> --variable <name>  # export CSV
npm run serve                                     # serveur local → http://localhost:3000/apps/arome-visualizer/
```

- [ ] **Step 3: Commit**

```bash
git add netlify.toml CLAUDE.md
git commit -m "chore: update netlify.toml and CLAUDE.md for monorepo layout"
```
