# Visualize Documentation Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fragmented active documentation for `apps/visualize` with one concise, current README and move historical application documents into a clearly labelled archive.

**Architecture:** `apps/visualize/README.md` becomes the only active application documentation. Historical guides, completed plans, and completed specs move under `docs/archive/visualize/`, while decoder documentation and paused future work remain untouched.

**Tech Stack:** Markdown, npm workspace scripts, Git.

---

## File Map

**Create**

- `apps/visualize/README.md`: current user and contributor entry point.
- `docs/archive/visualize/README.md`: archive warning and contents.
- `docs/archive/visualize/plans/`: completed and superseded application plans.
- `docs/archive/visualize/specs/`: completed and superseded application design specs.

**Move**

- `docs/frontend.md`
- `docs/frontend-modernization.md`
- `docs/mobile-performance.md`
- `docs/architecture-migration-todo.md`
- `docs/visualize-test-audit.md`
- all dated Markdown files currently in `docs/superpowers/plans/`
- all dated Markdown files currently in `docs/superpowers/specs/`

**Modify**

- `README.md`: add a small link to the application README.
- `docs/superpowers/plans/README.md`: retain only the active-directory policy.
- `docs/superpowers/specs/README.md`: retain only the active-directory policy.

**Delete if empty**

- `apps/visualize/src/services/`

**Do not modify**

- decoder, CLI, reference-data, cross-validation, or external-resource documentation;
- `docs/superpowers/paused/`;
- `docs/superpowers/outdated/`.

### Task 1: Create The Historical Archive

**Files:**

- Create: `docs/archive/visualize/README.md`
- Move: `docs/frontend.md`
- Move: `docs/frontend-modernization.md`
- Move: `docs/mobile-performance.md`
- Move: `docs/architecture-migration-todo.md`
- Move: `docs/visualize-test-audit.md`
- Move: `docs/superpowers/plans/*.md` except `README.md`
- Move: `docs/superpowers/specs/*.md` except `README.md`

- [ ] **Step 1: Create the archive directories**

Run:

```bash
mkdir -p docs/archive/visualize/plans docs/archive/visualize/specs
```

Expected: the three archive directories exist.

- [ ] **Step 2: Move the five historical application documents**

Run:

```bash
git mv docs/frontend.md docs/archive/visualize/frontend.md
git mv docs/frontend-modernization.md docs/archive/visualize/frontend-modernization.md
git mv docs/mobile-performance.md docs/archive/visualize/mobile-performance.md
git mv docs/architecture-migration-todo.md docs/archive/visualize/architecture-migration-todo.md
git mv docs/visualize-test-audit.md docs/archive/visualize/visualize-test-audit.md
```

Expected: Git records five renames and no copies remain in `docs/`.

- [ ] **Step 3: Move existing dated plans**

Run:

```bash
find docs/superpowers/plans -maxdepth 1 -type f -name '20*.md' -exec git mv {} docs/archive/visualize/plans/ \;
```

Expected: `docs/superpowers/plans/` contains only `README.md`.

- [ ] **Step 4: Move existing dated specs**

Run:

```bash
find docs/superpowers/specs -maxdepth 1 -type f -name '20*.md' -exec git mv {} docs/archive/visualize/specs/ \;
```

Expected: `docs/superpowers/specs/` contains only `README.md`.

- [ ] **Step 5: Add the archive warning**

Create `docs/archive/visualize/README.md` with:

```markdown
# Visualize Documentation Archive

This directory contains historical documentation for `apps/visualize`.

These files describe earlier implementation states, completed migrations, or superseded plans.
They may contain invalid paths, commands, assumptions, and architecture. Do not use them as current
contributor instructions.

Current application documentation lives in
[`apps/visualize/README.md`](../../../apps/visualize/README.md).

Paused future work remains in [`docs/superpowers/paused/`](../../superpowers/paused/).
```

- [ ] **Step 6: Verify archive boundaries**

Run:

```bash
find docs/archive/visualize -maxdepth 2 -type f | sort
find docs/superpowers/plans docs/superpowers/specs docs/superpowers/paused -maxdepth 1 -type f | sort
```

Expected:

- the five historical guides and all dated plans/specs are under `docs/archive/visualize/`;
- active plan/spec directories contain only their `README.md` files;
- paused documents remain unchanged.

- [ ] **Step 7: Commit the archive move**

```bash
git add docs/archive docs/superpowers/plans docs/superpowers/specs
git commit -m "docs: archive visualize documentation"
```

### Task 2: Write The Application README

**Files:**

- Create: `apps/visualize/README.md`

- [ ] **Step 1: Read current application configuration and boundaries**

Run:

```bash
sed -n '1,220p' apps/visualize/package.json
sed -n '1,340p' apps/visualize/src/domain/model-packages.js
find apps/visualize/src -maxdepth 2 -type d | sort
sed -n '1,180p' apps/visualize/src/main.js
sed -n '1,180p' apps/visualize/src/composition/forecast-runtime-factory.js
sed -n '1,140p' apps/visualize/src/adapters/forecast/data-gouv-resource-adapter.ts
```

Expected: commands, packages, source layers, entry point, runtime composition, and proxy behavior are confirmed before writing.

- [ ] **Step 2: Create the README**

Create `apps/visualize/README.md` using this structure and content:

````markdown
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
````

- [ ] **Step 3: Check that the README stays inside the application boundary**

Run:

```bash
rg -n "Section [0-9]|DRT|CCSDS|JPEG 2000|libaec|decoder/src|templates/" apps/visualize/README.md
```

Expected: no matches.

- [ ] **Step 4: Check documented paths and commands**

Run:

```bash
test -f apps/visualize/src/main.js
test -f apps/visualize/src/composition/forecast-runtime-factory.js
test -d apps/visualize/src/domain
test -d apps/visualize/src/use-cases
test -d apps/visualize/src/adapters
test -d apps/visualize/src/controllers
test -d apps/visualize/src/ui
test -d apps/visualize/src/workers
node -e "const p=require('./package.json'); for (const name of ['dev:visualize','build:visualize','preview:visualize','test:visualize','typecheck:visualize','check:visualize']) if (!p.scripts[name]) throw new Error(name)"
```

Expected: all commands exit successfully.

- [ ] **Step 5: Commit the active README**

```bash
git add apps/visualize/README.md
git commit -m "docs: add visualize application guide"
```

### Task 3: Update Active Entry Points

**Files:**

- Modify: `README.md`
- Modify: `docs/superpowers/plans/README.md`
- Modify: `docs/superpowers/specs/README.md`
- Delete if empty: `apps/visualize/src/services/`

- [ ] **Step 1: Add the application link to the root README**

Add directly after the Goals section:

```markdown
## Applications

- [`apps/visualize`](apps/visualize/README.md) — browser forecast visualizer and local GRIB2 file
  inspector.
```

Do not rewrite the remaining root README in this task.

- [ ] **Step 2: Keep the active plan index generic**

Set `docs/superpowers/plans/README.md` to:

```markdown
# Current Plans

This directory is reserved for active implementation plans.

Move completed, obsolete, or historical plans to the relevant archive so this directory stays
actionable.
```

- [ ] **Step 3: Keep the active spec index generic**

Set `docs/superpowers/specs/README.md` to:

```markdown
# Current Specs

This directory is reserved for active design specs.

Move paused specs to `docs/superpowers/paused/` and completed, obsolete, or historical specs to the
relevant archive.
```

- [ ] **Step 4: Remove the empty transitional services directory**

Run:

```bash
find apps/visualize/src/services -mindepth 1 -print -quit
```

Expected: no output.

Then run:

```bash
rmdir apps/visualize/src/services
```

Expected: the empty directory is removed. Git will record no directory-only change.

- [ ] **Step 5: Verify active documentation references**

Run:

```bash
rg -n "docs/(frontend|frontend-modernization|mobile-performance|architecture-migration-todo|visualize-test-audit)\\.md|src/services|showHour\\(|modelState\\.buffers|DECODED_CACHE_SIZE" README.md apps/visualize/README.md docs/superpowers/plans/README.md docs/superpowers/specs/README.md
```

Expected: no matches.

- [ ] **Step 6: Commit entry-point cleanup**

```bash
git add README.md docs/superpowers/plans/README.md docs/superpowers/specs/README.md
git commit -m "docs: point contributors to visualize guide"
```

### Task 4: Verify Documentation And Application Commands

**Files:**

- Verify: `apps/visualize/README.md`
- Verify: `docs/archive/visualize/`

- [ ] **Step 1: Run the documented test suite**

Run:

```bash
npm run test:visualize
```

Expected: all Vitest files and tests pass.

- [ ] **Step 2: Run TypeScript checks**

Run:

```bash
npm run typecheck:visualize
```

Expected: exit code 0.

- [ ] **Step 3: Run Biome checks**

Run:

```bash
npm run check:visualize
```

Expected: exit code 0.

- [ ] **Step 4: Build the application**

Run:

```bash
npm run build:visualize
```

Expected: Vite completes and writes `apps/visualize/dist/`.

- [ ] **Step 5: Validate local Markdown links**

Run:

```bash
node -e "const fs=require('fs'),path=require('path'); const files=['README.md','apps/visualize/README.md','docs/archive/visualize/README.md','docs/superpowers/plans/README.md','docs/superpowers/specs/README.md']; let bad=[]; for(const file of files){const text=fs.readFileSync(file,'utf8'); for(const m of text.matchAll(/\\[[^\\]]*\\]\\(([^)]+)\\)/g)){const target=m[1]; if(/^(https?:|#|mailto:)/.test(target)) continue; const clean=target.split('#')[0]; if(clean && !fs.existsSync(path.resolve(path.dirname(file),clean))) bad.push(file+' -> '+target);}} if(bad.length){console.error(bad.join('\\n')); process.exit(1)}"
```

Expected: exit code 0 and no missing local links.

- [ ] **Step 6: Inspect final active and archived documentation**

Run:

```bash
find docs -maxdepth 3 -type f -name '*.md' | sort
git status --short
```

Expected:

- application history is under `docs/archive/visualize/`;
- `apps/visualize/README.md` is the only current application guide;
- paused documents remain under `docs/superpowers/paused/`;
- only expected build artifacts or documentation changes appear.

### Task 5: Archive The Completed Reset Records

**Files:**

- Move: `docs/archive/visualize/specs/2026-06-07-visualize-documentation-reset-design.md`
- Move: `docs/archive/visualize/plans/2026-06-07-visualize-documentation-reset.md`

- [ ] **Step 1: Confirm the reset has passed all validation**

Run:

```bash
git status --short
```

Expected: no unexplained source changes and all Task 4 commands have passed.

- [ ] **Step 2: Confirm the reset spec and plan are already archived**

Run:

```bash
test -f docs/archive/visualize/specs/2026-06-07-visualize-documentation-reset-design.md
test -f docs/archive/visualize/plans/2026-06-07-visualize-documentation-reset.md
```

Expected: both commands exit successfully because Task 1 moved every dated spec and plan.

- [ ] **Step 3: Commit final verification changes if needed**

If Task 4 produced no tracked changes, do not create an empty commit. Otherwise:

```bash
git add README.md apps/visualize/README.md docs/archive docs/superpowers
git commit -m "docs: finalize visualize documentation reset"
```

- [ ] **Step 4: Confirm the repository is clean**

Run:

```bash
git status --short
```

Expected: no output.
