# CLAUDE.md — GRIB2 Decoder

## Project

Pure JavaScript GRIB2 (edition 2) decoder, compatible with both browser and Node.js.
Based on the WMO FM-92 GRIB Edition 2 spec. CCSDS decompression via WebAssembly (libaec).

**Test file:** `packages/grib2-decoder/test/arome__001__SP1__01H__2026-04-25T03_00_00Z.grib2` (~24 MB, AROME, Météo-France)

**Status:** Fully functional — 117 tests pass, CCSDS/JPEG2000 decoding validated on real data.
Supports DRT 0 (simple packing), DRT 2/3 (complex packing + spatial differencing, ICON-D2/GFS),
DRT 4/254 (IEEE 754), DRT 40 (JPEG 2000, OpenJPEG WASM, EWAM), DRT 42 (CCSDS, AROME/ARPEGE),
DRT 255 (constant field).

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
