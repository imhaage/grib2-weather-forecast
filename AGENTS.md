# AGENTS.md — GRIB2 Decoder

## Project

Pure JavaScript GRIB2 (edition 2) decoder, compatible with both browser and Node.js.
Based on the WMO FM-92 GRIB Edition 2 spec. CCSDS decompression via WebAssembly (libaec).

**Test file:** `packages/grib2-decoder/test/arome__001__SP1__01H__2026-04-25T03_00_00Z.grib2` (~24 MB, AROME, Météo-France)

**Status:** Fully functional — all tests pass, CCSDS/JPEG2000 decoding validated on real data.
Supports DRT 0 (simple packing), DRT 2/3 (complex packing + spatial differencing, ICON-D2/GFS),
DRT 4/254 (IEEE 754), DRT 40 (JPEG 2000, OpenJPEG WASM, EWAM), DRT 42 (CCSDS, AROME/ARPEGE),
DRT 255 (constant field).

## Code style — Blank lines and curly braces

### Goal

Make logical phases inside any function visually distinct at a glance.
A blank line signals a boundary: either between two blocks, or between two logical phases.

---

### Rule 1 — Systematic (always apply)

**Always use curly braces** on every control flow block — no braceless single-line statements.

**Always add a blank line between two blocks** (`if`, `for`, `while`, `try`, etc.), regardless of what they do.

These two rules are mechanical and have no exceptions.

```ts
// ✅ Good
if (!layer) {
  return null;
}

if (!options.enabled) {
  return null;
}

for (const item of items) {
  process(item);
}
```

```ts
// ❌ Bad — missing braces, missing blank lines
if (!layer) return null;
if (!options.enabled) return null;
for (const item of items) process(item);
```

---

### Rule 2 — Logical phases (apply with judgment)

Inside a function, group statements into **phases**: a phase is a set of statements
that serve the same logical purpose. Separate phases with a blank line.
Do not add blank lines within a phase.

Typical phases, in order:

1. **Side effects / hooks** — `useX()`, `await`, subscriptions
2. **Initial derivations** — `const`/`let` derived directly from inputs, props, or args
3. **Transformations** — loops, `map`, `filter`, `reduce`
4. **Final derivations** — values that depend on previous phases
5. **Return**
Guard clauses (`if … return`) each form their own block and follow Rule 1:
one blank line between each guard, and one blank line before the first phase.

---

### Examples

#### Utility function

```ts
// ✅ Good
function buildLayerConfig(source: Source, options: Options) {
  const { type, id } = source;
  const isVisible = options.visible ?? true;

  const filteredLayers = source.layers.filter(l => l.active);
  const mapped = filteredLayers.map(l => ({ ...l, sourceId: id }));

  const baseConfig = getBaseConfig(type);
  const result = mergeConfig(baseConfig, mapped, { visible: isVisible });

  return result;
}
```

```ts
// ❌ Bad — no phase separation, logic is blurred
function buildLayerConfig(source: Source, options: Options) {
  const { type, id } = source;
  const isVisible = options.visible ?? true;
  const filteredLayers = source.layers.filter(l => l.active);
  const mapped = filteredLayers.map(l => ({ ...l, sourceId: id }));
  const baseConfig = getBaseConfig(type);
  const result = mergeConfig(baseConfig, mapped, { visible: isVisible });
  return result;
}
```

---

#### Function with guard clauses

```ts
// ✅ Good
function processLayer(layer: Layer | null, options: Options) {
  if (!layer) {
    return null;
  }

  if (!options.enabled) {
    return null;
  }

  const { id, type } = layer;
  const isVisible = options.visible ?? true;

  const filtered = layer.sublayers.filter(s => s.active);

  const config = buildConfig(id, type, filtered, { isVisible });

  return config;
}
```

```ts
// ❌ Bad — guards blurred with logic, missing braces, missing blank lines
function processLayer(layer: Layer | null, options: Options) {
  if (!layer) return null;
  if (!options.enabled) return null;
  const { id, type } = layer;
  const isVisible = options.visible ?? true;
  const filtered = layer.sublayers.filter(s => s.active);
  const config = buildConfig(id, type, filtered, { isVisible });
  return config;
}
```

---

#### React component

```tsx
// ✅ Good
function WeatherLayer({ sourceId, options }: Props) {
  const config = useLayerConfig(sourceId);
  const { isVisible, opacity } = useLayerOptions(options);

  const activeLayers = config.layers.filter(l => l.enabled);
  const hasData = activeLayers.length > 0;

  const layerProps = buildLayerProps(activeLayers, { opacity });

  return (
    <MapLayer visible={isVisible && hasData} {...layerProps} />
  );
}
```

```tsx
// ❌ Bad — all statements collapsed, no visual structure
function WeatherLayer({ sourceId, options }: Props) {
  const config = useLayerConfig(sourceId);
  const { isVisible, opacity } = useLayerOptions(options);
  const activeLayers = config.layers.filter(l => l.enabled);
  const hasData = activeLayers.length > 0;
  const layerProps = buildLayerProps(activeLayers, { opacity });
  return <MapLayer visible={isVisible && hasData} {...layerProps} />;
}
```

---

#### Async function

```ts
// ✅ Good
async function fetchRadarData(url: string, options: FetchOptions) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeout);

  const response = await fetch(url, { signal: controller.signal });
  const buffer = await response.arrayBuffer();

  clearTimeout(timeout);

  const decoded = decodeGrib(buffer);
  const normalized = normalizeRadarValues(decoded, options.scale);

  return normalized;
}
```

---

### Edge cases

- A **single-statement function** needs no blank lines.
- A **phase of one line** is still a phase — add blank lines around it if surrounding statements belong to different phases.
- A **comment introducing a phase** belongs to that phase: no blank line between the comment and the code it describes.
```ts
// ✅ Good
const layers = config.layers;
const isVisible = options.visible ?? true;

// transform
const mapped = layers.map(l => ({ ...l, visible: isVisible }));

return mapped;
```

## CSS

The CSS split is a work in progress. Before editing CSS, check which layer/file owns the rule.

**Property order convention:** layout first, then box model, visual styles, typography, interaction states, and animations.

**CSS layers:** CSS rules are organized into multiple CSS layers, one layer per file.

```css
@layer reset, theme, global, layout, modules, overrides;

@import "./style/reset.css" layer(reset);
@import "./style/theme.css" layer(theme);
@import "./style/global.css" layer(global);
@import "./style/layout.css" layer(layout);
@import "./style/modules.css" layer(modules);
@import "./style/overrides.css" layer(overrides);
```

**CSS naming convention:** use pragmatic BEM for module classes.

- Use a clear block class for each meaningful component (`.topbar`, `.storage-warning`, `.file-summary`).
- Use `block__element` for important internal parts that belong to that component.
- Do not force BEM for shared components, utility-like classes, or existing generic UI primitives.
- Prefer shallow nesting only when it improves locality and stays readable.
- Avoid long BEM chains and deeply nested selectors.

Layer responsibilities:

- `reset.css`: normalize browser defaults and define the baseline box model.
- `theme.css`: global design tokens and custom properties reused across files.
- `global.css`: default element styles, typography, links, form defaults, and base page colors.
- `layout.css`: page-level structure, containers, main regions, visibility states such as `[hidden]`, and high-level responsive behavior.
- `modules.css`: component styles, including internal component layout and component-specific states.
- `overrides.css`: third-party library overrides only.

Rules:

- Do not move rules between CSS files unless the target layer clearly owns them.
- Do not create a new CSS layer/file unless there is a repeated need.
- Keep custom properties close to their usage unless they are reused across multiple modules.
- Component-specific states stay with the component rules in `modules.css`.
- Simple visibility states such as `[hidden]` belong in `layout.css`.
- Prefer modern CSS when it improves readability: cascade layers, logical properties, `:where()`, `:is()`, nesting up to two levels, and responsive grid/flex patterns.
- Avoid deep selector nesting and avoid coupling CSS to incidental DOM structure.

## Documentation structure

- `docs/decoder.md` — src/ modules, GRIB2 format, public API
- `docs/frontend.md` — web application (index.html)
- `docs/cli.md` — CLI tools and npm scripts
- `docs/external-resources.md` — WMO specifications and external references

## Architecture

`apps/visualize` follows a simple hexagonal architecture. Keep the structure pragmatic and avoid abstractions that only exist to satisfy a pattern.

Target source layout:

- `domain/`: pure forecast, grid, palette, resource, unit, and vector logic. No DOM, browser storage, workers, fetch, MapLibre, controllers, UI, or use-case ports.
- `use-cases/`: application workflows and orchestration. New boundaries here must be TypeScript with strict, explicit ports.
- `adapters/`: concrete implementations of use-case ports, grouped by feature. Browser APIs, DOM views, MapLibre, IndexedDB/localStorage, workers, network fetch, canvas, and third-party integrations belong here.
- `controllers/`: thin entry adapters connecting UI events, routing, and concrete adapters to use cases.
- `ui/`: passive DOM views, UI helpers, route helpers, shell behavior, and event binding. Keep business workflow orchestration out of UI modules.
- `workers/`: low-level worker scripts and worker clients.

The `services/` folder is transitional and should disappear progressively. Move application workflows to `use-cases/` and concrete integrations to `adapters/`.

Ports belong to the internal side, usually in `use-cases/<feature>/ports.ts`, not in adapters. Put a port in `domain/` only when it expresses a stable domain concept rather than an application or infrastructure need.

Create ports around capabilities, not implementation classes. Add a port when it isolates DOM, MapLibre, workers, fetch, browser storage, canvas, or another external mechanism from a use case; when it improves testability; or when it names a meaningful application capability. Do not add ports for pure functions or one-line abstractions that simply mirror an implementation.

New files in `use-cases/` and `adapters/` should be `.ts`. Files migrated from `services/` into those folders should become `.ts` as part of the move. Avoid `any` except at narrow external integration boundaries.

## Language

All generated content in this project must be in **English**: variable names, function names, comments, UI text, documentation, descriptions, commit messages.

## Useful commands

```bash
npm test                                          # 117 tests (runs in packages/grib2-decoder)
npm run build                                     # build decoder → packages/grib2-decoder/dist/
npm run dev:visualize                             # Vite dev server for the web app
npm run build:visualize                           # build web app → apps/visualize/dist/
npm run preview:visualize                         # preview built web app
npm run info -- <file.grib2>                      # metadata report
npm run export -- <file.grib2> --variable <name>  # CSV export
npm run serve                                     # build and preview web app
```
