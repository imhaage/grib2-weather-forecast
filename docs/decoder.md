# Décodeur GRIB2 — modules src/

## Structure des fichiers

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
    ├── decoder.js       — parsers de sections + API publique
    ├── parameters.js    — table de paramètres WMO (discipline:catégorie:numéro → shortName)
    │                      Disciplines 0 (météo) et 2 (surface terrestre) — AROME SP/HP/IP + ARPEGE
    ├── stats.js         — computeStats(values) : min/max/mean/stddev/count
    ├── wmo-tables.js    — tables WMO (CENTRES, TIME_UNIT, TYPE_OF_LEVEL…) + helpers de formatage
    ├── index.js         — re-exporte tous les symboles publics
    ├── templates/
    │   ├── drt-complex.js   — DRT 2/3 decoder (complex packing + spatial differencing)
    │   └── drt-jpeg2000.js  — DRT 40 decoder (JPEG 2000 via OpenJPEG WASM)
    └── wasm/
        ├── ccsds-loader.js  — chargement lazy du module WASM CCSDS
        ├── ccsds.js / .wasm — module Emscripten compilé depuis libaec
        ├── jpeg2000/
        │   ├── openjpegwasm_decode.js   — module Emscripten OpenJPEG (ESM, browser)
        │   ├── openjpegwasm_decode.cjs  — same module as CJS (Node.js via createRequire)
        │   └── openjpegwasm_decode.wasm
        └── ccsds_wrapper.c  — wrapper C autour de libaec
```

La source C de libaec est dans `libaec/` à la racine (dépôt : github.com/MathisRosenhauer/libaec).

---

## Format GRIB2

Un message GRIB2 est une séquence de sections :

| Section | Contenu |
|---------|---------|
| 0 | Indicateur : signature "GRIB", édition, discipline, longueur totale |
| 1 | Identification : centre, sous-centre, date/heure de référence |
| 2 | Usage local (optionnel, ignoré) |
| 3 | Définition de grille : Ni, Nj, lat/lon, résolution, scanning mode |
| 4 | Définition du produit : paramètre, niveau, temps de prévision |
| 5 | Représentation des données : type de packing, R, E, D, bitsPerValue |
| 6 | Bitmap (1 bit par point de grille) |
| 7 | Données compressées |
| 8 | Fin de message "7777" |

Les sections 2 et 8 ne sont pas parsées. Plusieurs messages peuvent se suivre dans un même fichier.

## Templates supportés

- **Section 3 :** template 0 (grille lat/lon régulière)
- **Section 4 :** template 0 (analyse/prévision de surface)
- **Section 5 :** template 0 (simple packing), 2 (complex packing), 3 (complex packing + spatial
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

## API publique (`src/index.js`)

```js
import { decodeGRIB2, iterateGRIB2Messages, parseGRIB2Header,
         MISSING_VALUE, computeStats,
         CENTRES, TIME_UNIT, TYPE_OF_LEVEL, GENERATING_PROCESS,
         fmtLevel, fmtValidTime, fmtRefTime, fmtScanMode,
         lookupParameter } from 'grib2-decoder';
```

### `decodeGRIB2(buffer)` — async
Décode un message GRIB2 complet (Uint8Array ou ArrayBuffer).
Invoque le WASM pour CCSDS. Retourne `{ header, product, grid, values, bitmap }`.
- `values` : Float64Array, longueur = `grid.totalPoints`
- Points manquants (bitmap=0) encodés comme `MISSING_VALUE` (-1e100)

### `iterateGRIB2Messages(buffer)` — générateur synchrone
Itère les messages d'un fichier multi-messages sans décoder les valeurs.
Chaque message : `{ index, header, product, grid, buffer }`.
Utilisé pour afficher la liste des variables sans déclencher le WASM.

### `parseGRIB2Header(buffer)` — synchrone
Parse uniquement les sections 0–5 (pas de WASM, pas de valeurs).
Retourne `{ header, product, grid, dataOffset, dataLength }`.

### `computeStats(values)`
Calcule min/max/mean/stddev/count sur un Float64Array en ignorant `MISSING_VALUE`.

### `MISSING_VALUE`
Constante sentinelle pour les points manquants : `-1e100`.

## Tables WMO (`src/wmo-tables.js`)

Exportées et utilisables dans les deux environnements (navigateur + Node.js) :
`CENTRES`, `DISCIPLINES`, `REF_TIME_SIGNIFICANCE`, `TYPE_OF_DATA`, `TYPE_OF_LEVEL`,
`TIME_UNIT`, `GENERATING_PROCESS`, `DATA_REPR_TEMPLATES`, `SCAN_MODE_BITS`.

Helpers de formatage : `fmtRefTime(header)`, `fmtValidTime(header, product)`,
`fmtLevel(product)`, `fmtScanMode(mode)`.

## Tests

```bash
npm test   # node --test (5 test files, via packages/grib2-decoder)
```

115 tests couvrant : walkSections, parseSection1/3/5/6, decodeGRIB2 (valeurs physiques,
bitmap, formule de décompression CCSDS), parseGRIB2Header, lookupParameter (régressions
sur les indices WMO : cape/cin, LW radiation, slhf/sshf), validation croisée JS vs eccodes,
DRT 2/3 (complex packing: no missing, primary missing, DRT 3 first-order/second-order/negative
GMIN spatial differencing), DRT 40 (JPEG 2000 constant field + real EWAM file), DRT 3 real-file
tests (ICON-D2, GFS).

Test files: `decoder.test.js`, `e2e.test.js`, `cross-decode.test.js`, `drt-complex.test.js`,
`drt-jpeg2000.test.js`.
