# AGENTS.md — GRIB2 Decoder

## Project

Pure JavaScript GRIB2 (edition 2) decoder, compatible with both browser and Node.js.
Based on the WMO FM-92 GRIB Edition 2 spec. CCSDS decompression via WebAssembly (libaec).

**Test file:** `packages/grib2-decoder/test/arome__001__SP1__01H__2026-04-25T03_00_00Z.grib2` (~24 MB, AROME, Météo-France)

**Status:** Fully functional — all tests pass, CCSDS/JPEG2000 decoding validated on real data.
Supports DRT 0 (simple packing), DRT 2/3 (complex packing + spatial differencing, ICON-D2/GFS),
DRT 4/254 (IEEE 754), DRT 40 (JPEG 2000, OpenJPEG WASM, EWAM), DRT 42 (CCSDS, AROME/ARPEGE),
DRT 255 (constant field).

### CSS

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
