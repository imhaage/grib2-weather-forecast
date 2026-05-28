# Design — Broadened Data Representation Template Support

**Date:** 2026-05-05  
**Status:** Approved  
**Trigger:** ICON-D2 GRIB2 files fail with "Unsupported Data Representation Template: 3"

---

## Problem

The decoder currently supports DRT 0 (simple packing), DRT 42 (CCSDS), DRT 254 (IEEE 754), and
DRT 255 (all missing). DRT 40 (JPEG 2000) exists in code but is incorrectly treated as a constant
field for all inputs. Models that use DRT 2/3 (ICON family from DWD) and DRT 40 (GFS from NOAA)
cannot be decoded.

Current operational NWP models and their templates:

| Template | Models | Status |
|----------|--------|--------|
| DRT 0 | GFS (partial), ERA5, ARPEGE | supported |
| DRT 2 | GFS (partial), GEM Canada | missing |
| DRT 3 | ICON-D2, ICON-EU, ICON-global (DWD) | missing |
| DRT 40 | GFS (NOAA) — heavily used | broken |
| DRT 42 | AROME, ARPEGE (Météo-France) | supported |
| DRT 254 | Various | supported |

---

## Approach

**Modular template system (Approach B):** extract each packing algorithm into its own module
under `src/templates/`. `decoder.js` becomes a thin orchestrator. New templates slot in without
touching existing logic. Each module is independently testable.

---

## Architecture

```
src/
├── decoder.js                  — orchestrator (simplified)
├── templates/
│   ├── registry.js             — { templateNumber → module }
│   ├── drt-simple.js           — DRT 0   (extracted from decoder.js)
│   ├── drt-complex.js          — DRT 2/3 (new)
│   ├── drt-jpeg2000.js         — DRT 40  (new, wraps OpenJPEG WASM)
│   ├── drt-ccsds.js            — DRT 42  (extracted from decoder.js)
│   ├── drt-ieee754.js          — DRT 254 (extracted from decoder.js)
│   └── drt-constant.js         — DRT 255 (all missing); bitsPerValue=0 handled per-module
├── wasm/
│   ├── ccsds-loader.js / ccsds.js / .wasm   — unchanged
│   └── jpeg2000-loader.js / jpeg2000.js / .wasm  — new (OpenJPEG/Emscripten pre-built)
└── index.js / parameters.js / stats.js / wmo-tables.js  — unchanged
```

---

## Template Module Interface

Each module under `src/templates/` exports:

```js
// Reads template-specific fields from Section 5
// t = dataStart + 6 (after the generic 6-byte header)
parseParams(data, t) → Object

// Decodes Section 7 into physical values
// s5 = { templateNumber, numberOfPackedValues, ...parseParams result }
async decode(data, dataStart, dataLen, s5, totalPoints, bitmap) → Float64Array
// Missing values encoded as MISSING_VALUE (-1e100)
```

`registry.js` maps template numbers to modules. DRT 2 and DRT 3 share `drt-complex.js`.
For DRT 2, `parseParams` does not read `orderOfSpatialDiff` or `ww` (those fields are absent
from Section 5); the spatial differencing step in `decode` is skipped entirely.

```js
const TEMPLATES = {
  0: drtSimple, 2: drtComplex, 3: drtComplex,
  40: drtJpeg2000, 42: drtCcsds, 254: drtIeee754, 255: drtConstant,
}
export function getTemplate(n) {
  const t = TEMPLATES[n]
  if (!t) throw new Error(`Unsupported Data Representation Template: ${n}`)
  return t
}
```

`parseSection5` in `decoder.js` is preserved with its current signature (public API).
It reads the generic header then calls `tmpl.parseParams()` and merges the result.

---

## DRT 2/3 Algorithm (Complex Packing + Spatial Differencing)

Reference: [NCEP g2clib `comunpack.c`](https://github.com/NOAA-EMC/NCEPLIBS-g2c)  
Spec: [Template 5.2](https://www.nco.ncep.noaa.gov/pmb/docs/grib2/grib2_doc/grib2_temp5-2.shtml),
[Template 5.3](https://www.nco.ncep.noaa.gov/pmb/docs/grib2/grib2_doc/grib2_temp5-3.shtml)

### Section 5 parameters (after the 10-byte common header)

| Offset | Size | Field |
|--------|------|-------|
| +0 | 2 | group splitting method |
| +2 | 1 | missing value management: 0=none, 1=primary, 2=primary+secondary |
| +3 | 4 | primary missing value substitute |
| +7 | 4 | secondary missing value substitute |
| +11 | 4 | NG — number of groups |
| +15 | 1 | Wref — reference for group widths |
| +16 | 1 | nBitsW — bits per encoded group width |
| +17 | 4 | Lref — reference for group lengths |
| +21 | 1 | ΔL — length increment |
| +22 | 4 | true length of last group |
| +26 | 1 | nBitsL — bits per scaled group length |
| +27 *(DRT 3)* | 1 | order of spatial differencing (1 or 2) |
| +28 *(DRT 3)* | 1 | ww — extra descriptor bytes in Section 7 |

### Section 7 bitstream layout

```
[DRT 3 only]
  ww×8 bits        : ival1  (first original integer value, unsigned)
  ww×8 bits        : ival2  (if order = 2)
  1 bit            : sign of GMIN
  ww×8 − 1 bits   : magnitude of GMIN

[DRT 2 and 3]
  NG × bitsPerValue bits : gref[g]   — group reference values
  NG × nBitsW bits       : gwidth[g] — W[g] = Wref + gwidth[g]
  NG × nBitsL bits       : glen[g]   — L[g] = Lref + glen[g] × ΔL
                            (last group uses true last group length from Section 5)
  For each group g:
    L[g] × W[g] bits : X2[i]   — packed offsets (unsigned)
```

### Decoding algorithm

```
1. Integer value:  ifld[i] = X2[i] + gref[g]

   Missing value detection (before adding gref):
     W[g] > 0 and X2[i] = 2^W[g] - 1  → primary missing
     W[g] > 0 and X2[i] = 2^W[g] - 2  → secondary missing (if management = 2)
     W[g] = 0: all values = gref[g]; check gref[g] for all-ones sentinel

2. Spatial differencing (DRT 3, non-missing values only):
   ifld[0] = ival1
   Order 1:  for n = 1..N-1:  ifld[n] = ifld[n] + GMIN + ifld[n-1]
   Order 2:  ifld[1] = ival2
             for n = 2..N-1:  ifld[n] = ifld[n] + GMIN + 2×ifld[n-1] − ifld[n-2]

3. Physical value:  Y[i] = (R + ifld[i] × 2^E) × 10^(-D)
```

**Key implementation notes:**
- GMIN is stored as sign bit + magnitude, can be negative.
- Sentinel for missing uses `W[g]` (per-group bit width), not `bitsPerValue`.
- Spatial differencing is applied only on the non-missing subsequence.

---

## DRT 40 — JPEG 2000

Reference: [NCEP g2clib `jpcunpack.c`](https://github.com/NOAA-EMC/NCEPLIBS-g2c)  
Spec: [Template 5.40](https://www.nco.ncep.noaa.gov/pmb/docs/grib2/grib2_doc/grib2_temp5-40.shtml)

### Section 5 parameters

| Octets | Field | Notes |
|--------|-------|-------|
| +0..3 | R (float32 BE) | |
| +4..5 | E (sign-magnitude int16) | |
| +6..7 | D (sign-magnitude int16) | |
| +8 | bitsPerValue | 0 = constant field, all values = R |
| +9 | typeOfOriginalFieldValues | ignored for decoding |
| +10 | typeOfCompressionUsed | 0=lossless, 1=lossy — handled by OpenJPEG |
| +11 | targetCompressionRatio | ignored for decoding |

### Decoding

```
1. If bitsPerValue = 0: constant field, Y[i] = R. Done.
2. Section 7 is a raw J2C codestream (JPEG 2000 Part-1).
   Decode with OpenJPEG WASM → integer array ifld[].
3. Y[i] = (R + ifld[i] × 2^E) × 10^(-D)
```

**WASM strategy:** Use a pre-built Emscripten build of OpenJPEG (same pattern as libaec/CCSDS).
Loaded lazily via `jpeg2000-loader.js`. The build artifact (~500 KB) is committed to
`src/wasm/jpeg2000/` alongside the generated JS glue code.

**Existing bug fixed:** Current code forces `bitsPerValue = 0` for all DRT 40 data (constant field
treatment). `DATA_REPR_TEMPLATES[40]` label corrected from `'Constant field'` to
`'JPEG 2000 code stream format'`.

---

## Backward Compatibility

- `parseSection5` public signature preserved.
- `decodeGRIB2` public signature preserved.
- Error message for unknown templates preserved (thrown from `registry.js`).
- `bitsPerValue === 0` constant-field shortcut removed from `decodeGRIB2`; each template
  module handles it internally.
- 98 existing tests pass without modification.

---

## Testing

**Unit tests (synthetic GRIB2 buffers):**
- `drt-complex.test.js`: DRT 2 and DRT 3 decode with hand-crafted buffers. Cases: no missing
  values, primary missing, secondary missing, first-order differencing, second-order differencing.
- `drt-jpeg2000.test.js`: DRT 40 decode — constant field (bitsPerValue=0) + real J2C codestream.
- All existing `parseSection5` tests continue to pass via the preserved wrapper.

**End-to-end (real GRIB2 files):**
- ICON-D2 fixture (DRT 3): one message extracted from a DWD open-data file.
- GFS fixture (DRT 40): one message extracted from a NOAA open-data file.
- Values cross-validated against `eccodes grib_get_double_array`.

**Non-regression:** `npm test` (all 98 existing tests) must pass throughout.
