# External resources

## GRIB2 specifications

- **WMO FM-92 GRIB Edition 2** — official format specification
- **ECMWF** — https://codes.ecmwf.int/grib/format/grib2/
- **WMO online tables** — https://codes.ecmwf.int/grib/format/grib2/ctables/

## CCSDS / AEC compression

- **libaec** (Adaptive Entropy Coding) — https://github.com/MathisRosenhauer/libaec
  C source in `libaec/`, compiled to WASM via Emscripten (`src/wasm/build.sh`).
- **CCSDS 121.0-B** — lossless compression standard used by template 5.42

## Test file

`packages/grib2-decoder/test/arome__001__SP1__01H__2026-04-25T03_00_00Z.grib2`
- AROME model, Météo-France (centre 85)
- ~24 MB, 4 messages, CCSDS compression (template 5.42)
- Lat/lon grid 2801×1791, 0.01° resolution
- Domain: 37.5°–55.4°N, -12°–16°E
