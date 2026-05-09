# GRIB2 Decoder — src/ modules

## File structure

```
packages/grib2-decoder/
├── package.json         — name: "grib2-decoder", exports → dist/grib2-decoder.js
├── rolldown.config.js   — builds src/ → dist/ (ESM bundle + WASM assets)
├── dist/                — committed; no build step required after clone
│   ├── grib2-decoder.js         — bundle
│   ├── ccsds.js                 — CCSDS Emscripten glue (dynamically imported)
│   ├── ccsds.wasm               — compiled WASM
│   ├── openjpegwasm_decode.js   — OpenJPEG Emscripten glue (browser, ESM dynamic import)
│   ├── openjpegwasm_decode.cjs  — same module as CJS (Node.js, loaded via createRequire)
│   └── openjpegwasm_decode.wasm — compiled WASM
└── src/
    ├── decoder.js       — section parsers + public API
    ├── parameters.js    — WMO parameter table (discipline:category:number → shortName)
    │                      Disciplines 0 (meteorology) and 2 (land surface) — AROME SP/HP/IP + ARPEGE
    ├── stats.js         — computeStats(values): min/max/mean/stddev/count
    ├── wmo-tables.js    — WMO lookup tables (CENTRES, TIME_UNIT, TYPE_OF_LEVEL…) + format helpers
    ├── index.js         — re-exports all public symbols
    ├── templates/
    │   ├── drt-complex.js   — DRT 2/3 decoder (complex packing + spatial differencing)
    │   └── drt-jpeg2000.js  — DRT 40 decoder (JPEG 2000 via OpenJPEG WASM)
    └── wasm/
        ├── ccsds-loader.js  — lazy loader for the CCSDS WASM module
        ├── ccsds.js / .wasm — Emscripten module compiled from libaec
        ├── jpeg2000/
        │   ├── openjpegwasm_decode.js   — OpenJPEG Emscripten module (ESM, browser)
        │   ├── openjpegwasm_decode.cjs  — same module as CJS (Node.js via createRequire)
        │   └── openjpegwasm_decode.wasm
        └── ccsds_wrapper.c  — C wrapper around libaec
```

The libaec C source is in `libaec/` at the repository root (repo: github.com/MathisRosenhauer/libaec).

---

## GRIB2 format

A GRIB2 message is a sequence of sections:

| Section | Content |
|---------|---------|
| 0 | Indicator: "GRIB" signature, edition, discipline, total length |
| 1 | Identification: centre, sub-centre, reference date/time |
| 2 | Local use (optional, ignored) |
| 3 | Grid definition: Ni, Nj, lat/lon, resolution, scanning mode |
| 4 | Product definition: parameter, level, forecast time |
| 5 | Data representation: packing type, R, E, D, bitsPerValue |
| 6 | Bitmap (1 bit per grid point) |
| 7 | Compressed data |
| 8 | End-of-message "7777" |

Sections 2 and 8 are not parsed. Multiple messages may follow one another in the same file.

## Supported templates

- **Section 3:** template 0 (regular lat/lon grid)
- **Section 4:** template 0 (surface analysis/forecast)
- **Section 5:** template 0 (simple packing), 2 (complex packing), 3 (complex packing + spatial
  differencing), 40 (JPEG 2000), 42 (CCSDS), 254 (IEEE 754 big-endian), 255 (constant field)

---

## Data Representation Templates — Algorithm Reference

### DRT 0 — Simple packing

Physical value: `Y = (R + X × 2^E) × 10^(-D)` where X is the packed unsigned integer (bitsPerValue bits).

### DRT 2 — Complex packing
### DRT 3 — Complex packing with spatial differencing

Reference implementations: [NCEP g2clib `comunpack.c`](https://github.com/NOAA-EMC/NCEPLIBS-g2c),
[ecCodes `DataG22OrderPacking.cc`](https://github.com/ecmwf/eccodes/blob/develop/src/eccodes/accessor/DataG22OrderPacking.cc).
Spec: [NCEP Template 5.2](https://www.nco.ncep.noaa.gov/pmb/docs/grib2/grib2_doc/grib2_temp5-2.shtml),
[NCEP Template 5.3](https://www.nco.ncep.noaa.gov/pmb/docs/grib2/grib2_doc/grib2_temp5-3.shtml).

#### Section 5 parameters (after the 10-byte common header)

| Offset | Size | Field |
|--------|------|-------|
| +0 | 2 | group splitting method (Code Table 5.4) |
| +2 | 1 | missing value management: 0=none, 1=primary, 2=primary+secondary |
| +3 | 4 | primary missing value substitute (float32 or int32) |
| +7 | 4 | secondary missing value substitute |
| +11 | 4 | NG — number of groups |
| +15 | 1 | Wref — reference for group widths |
| +16 | 1 | nBitsW — bits used for each group width |
| +17 | 4 | Lref — reference for group lengths |
| +21 | 1 | ΔL — length increment |
| +22 | 4 | true length of last group |
| +26 | 1 | nBitsL — bits used for scaled group lengths |
| +27 *(DRT 3 only)* | 1 | order of spatial differencing (1=first, 2=second) — Code Table 5.6 |
| +28 *(DRT 3 only)* | 1 | ww — number of extra descriptor bytes in Section 7 |

#### Section 7 bitstream layout

```
[DRT 3 only — spatial differencing extra descriptors]
  ww×8 bits   : ival1  (first original integer value, unsigned)
  ww×8 bits   : ival2  (second, only if order = 2)
  1 bit        : sign of GMIN  (0 = positive, 1 = negative)
  ww×8−1 bits : magnitude of GMIN

[Common — DRT 2 and 3]
  NG × bitsPerValue bits : group reference values gref[g]  (unsigned)
  NG × nBitsW bits       : group width offsets;  W[g] = Wref + offset[g]
  NG × nBitsL bits       : group length offsets; L[g] = Lref + offset[g] × ΔL
                           (last group uses "true last group length" from Section 5)
  For each group g (0..NG-1):
    L[g] × W[g] bits : packed offsets X2[i]  (unsigned)
```

#### Decoding algorithm

```
1. Integer value within group g:
     ifld[i] = X2[i] + gref[g]
   Missing value detection (before adding gref):
     W[g] > 0 and X2[i] = 2^W[g] - 1  → primary missing
     W[g] > 0 and X2[i] = 2^W[g] - 2  → secondary missing (if missVal management = 2)
     W[g] = 0: all L[g] values equal gref[g] (check gref[g] against all-ones sentinel)

2. Spatial differencing recovery (DRT 3 only, applied on non-missing values):
     ifld[0] = ival1
     First order (order = 1):
       for n = 1..N-1:  ifld[n] = ifld[n] + GMIN + ifld[n-1]
     Second order (order = 2):
       ifld[1] = ival2
       for n = 2..N-1:  ifld[n] = ifld[n] + GMIN + 2×ifld[n-1] − ifld[n-2]

3. Physical value:
     Y[i] = (R + ifld[i] × 2^E) × 10^(-D)
```

> **Note:** GMIN can be negative (stored as sign + magnitude). The sentinel check for missing
> values uses `W[g]` (the per-group bit width), not the global `bitsPerValue`. When `W[g] = 0`
> all values in the group share the same reference `gref[g]`; check `gref[g]` against
> `2^bitsPerValue - 1` for missing.

### DRT 40 — JPEG 2000 code stream

Reference implementation: [NCEP g2clib `jpcunpack.c`](https://github.com/NOAA-EMC/NCEPLIBS-g2c).
Spec: [NCEP Template 5.40](https://www.nco.ncep.noaa.gov/pmb/docs/grib2/grib2_doc/grib2_temp5-40.shtml).

#### Section 5 parameters (after the 6-byte generic header)

| Octets | Field | Notes |
|--------|-------|-------|
| +0..3 | R — reference value (float32 BE) | |
| +4..5 | E — binary scale factor (sign-magnitude int16) | |
| +6..7 | D — decimal scale factor (sign-magnitude int16) | |
| +8 | bitsPerValue | 0 = constant field (all values = R) |
| +9 | typeOfOriginalFieldValues | Code Table 5.1, ignored for decoding |
| +10 | typeOfCompressionUsed | Code Table 5.40: 0=lossless, 1=lossy |
| +11 | targetCompressionRatio | Lossy only; 255 = missing (lossless) |

#### Decoding algorithm

```
1. If bitsPerValue = 0: constant field, all values = R. Done.
2. Otherwise: Section 7 is a raw J2C codestream (JPEG 2000 Part-1, ISO/IEC 15444-1).
   Pass the entire Section 7 blob to OpenJPEG; output is an integer array ifld[].
   OpenJPEG handles lossless and lossy internally — typeOfCompressionUsed is not needed.
3. Physical value: Y[i] = (R + ifld[i] × 2^E) × 10^(-D)   (identical to DRT 0)
```

Used by: GFS (NOAA operational NWP), ICON-D2 EWAM (DWD ocean wave model).

### DRT 42 — CCSDS lossless compression

Section 5 adds three CCSDS-specific parameters after the common 10 bytes: flags (uint8, strip
bits 1 and 2 for little-endian environments per eccodes `modify_aec_flags`), block size (uint8),
reference sample interval RSI (uint16 BE). Decompression via libaec compiled to WebAssembly.

Used by: AROME, ARPEGE (Météo-France).

### DRT 254 — IEEE 754 float32

Section 7 contains bitsPerValue/8-byte big-endian float32 values. No scaling applied.

---

## Public API (`src/index.js`)

```js
import {
  // Core decode
  decodeGRIB2, iterateGRIB2Messages, parseGRIB2Header,
  MISSING_VALUE, computeStats,
  // Low-level section parsers
  walkSections, parseSection1, parseSection3, parseSection4, parseSection5, parseSection6,
  // Parameter lookup
  lookupParameter, PARAMETERS,
  // WMO lookup tables
  CENTRES, DISCIPLINES, REF_TIME_SIGNIFICANCE, TYPE_OF_DATA,
  TYPE_OF_LEVEL, TIME_UNIT, GENERATING_PROCESS,
  DATA_REPR_TEMPLATES, SCAN_MODE_BITS,
  // Format helpers
  fmtRefTime, fmtValidTime, fmtLevel, fmtScanMode,
} from 'grib2-decoder';
```

### `decodeGRIB2(buffer)` — async
Decodes a complete GRIB2 message (Uint8Array or ArrayBuffer).
Invokes WASM for CCSDS. Returns `{ header, product, grid, values, bitmap }`.
- `values`: Float64Array, length = `grid.totalPoints`
- Missing points (bitmap=0) encoded as `MISSING_VALUE` (-1e100)

### `iterateGRIB2Messages(buffer)` — synchronous generator
Iterates messages in a multi-message file without decoding values.
Each message: `{ index, header, product, grid, buffer }`.
Used to list variables without triggering WASM.

### `parseGRIB2Header(buffer)` — synchronous
Parses sections 0–5 only (no WASM, no values).
Returns `{ header, product, grid, dataOffset, dataLength }`.

### `computeStats(values)`
Computes min/max/mean/stddev/count on a Float64Array, ignoring `MISSING_VALUE`.

### `MISSING_VALUE`
Sentinel constant for missing grid points: `-1e100`.

## WMO tables (`src/wmo-tables.js`)

Exported and usable in both environments (browser + Node.js):
`CENTRES`, `DISCIPLINES`, `REF_TIME_SIGNIFICANCE`, `TYPE_OF_DATA`, `TYPE_OF_LEVEL`,
`TIME_UNIT`, `GENERATING_PROCESS`, `DATA_REPR_TEMPLATES`, `SCAN_MODE_BITS`.

Format helpers: `fmtRefTime(header)`, `fmtValidTime(header, product)`,
`fmtLevel(product)`, `fmtScanMode(mode)`.

## Tests

```bash
npm test   # node --test (5 test files, via packages/grib2-decoder)
```

115 tests covering: walkSections, parseSection1/3/5/6, decodeGRIB2 (physical values,
bitmap, CCSDS decompression formula), parseGRIB2Header, lookupParameter (WMO index regressions:
cape/cin, LW radiation, slhf/sshf), JS vs eccodes cross-validation, DRT 2/3 (complex packing:
no missing, primary missing, DRT 3 first-order/second-order/negative GMIN spatial differencing),
DRT 40 (JPEG 2000 constant field + real EWAM file), DRT 3 real-file tests (ICON-D2, GFS).

Test files: `decoder.test.js`, `e2e.test.js`, `cross-decode.test.js`, `drt-complex.test.js`,
`drt-jpeg2000.test.js`.
