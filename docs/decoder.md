# Décodeur GRIB2 — modules src/

## Structure des fichiers

```
packages/grib2-decoder/
├── package.json         — name: "grib2-decoder", exports → dist/grib2-decoder.js
├── rolldown.config.js   — builds src/ → dist/ (ESM bundle + WASM assets)
├── dist/                — committed; no build step required after clone
│   ├── grib2-decoder.js — bundle
│   ├── ccsds.js         — Emscripten glue (dynamically imported at runtime)
│   └── ccsds.wasm       — compiled WASM
└── src/
    ├── decoder.js       — parsers de sections + API publique
    ├── parameters.js    — table de paramètres WMO (discipline:catégorie:numéro → shortName)
    │                      Disciplines 0 (météo) et 2 (surface terrestre) — AROME SP/HP/IP + ARPEGE
    ├── stats.js         — computeStats(values) : min/max/mean/stddev/count
    ├── wmo-tables.js    — tables WMO (CENTRES, TIME_UNIT, TYPE_OF_LEVEL…) + helpers de formatage
    ├── index.js         — re-exporte tous les symboles publics
    └── wasm/
        ├── ccsds-loader.js  — chargement lazy du module WASM
        ├── ccsds.js / .wasm — module Emscripten compilé depuis libaec
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
- **Section 5 :** template 42 (CCSDS), 0 (simple packing), 254 (IEEE 754 big-endian), 255 (missing)

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
npm test   # node --test decoder.test.js e2e.test.js cross-decode.test.js (via packages/grib2-decoder)
```

98 tests couvrant : walkSections, parseSection1/3/5/6, decodeGRIB2 (valeurs physiques,
bitmap, formule de décompression CCSDS), parseGRIB2Header, lookupParameter (régressions
sur les indices WMO : cape/cin, LW radiation, slhf/sshf), validation croisée JS vs eccodes.
