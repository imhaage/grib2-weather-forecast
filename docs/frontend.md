# Application web — apps/arome-visualizer/index.html

## Architecture

SPA sans framework, un seul fichier. Routage par hash (`#grid/<shortName>`).
Servie statiquement depuis la racine du dépôt (`npm run serve` → `http://localhost:3000/apps/arome-visualizer/`).

```
#             → vue home  (#view-home)
#grid/<name>  → vue grille (#view-grid)
```

### État en mémoire

```js
let fileState      = null; // { messages } — messages parsés sans décodage WASM
let gridState      = null; // { values, min, range, grid, product, displayUnits, staticScale }
let currentPalette = 'Plasma';
```

`gridState` est conservé pour permettre de changer la palette sans relancer le WASM.
`staticScale` est présent pour les paramètres avec une échelle fixe (ex. CAPE) ; sinon l'échelle est calculée dynamiquement à partir du min/max.

---

## Vue home

- Zone drag-and-drop / file input → `processFile(file)`
- `iterateGRIB2Messages(buffer)` (synchrone, sans WASM) pour lister les variables
- Bandeau de métadonnées : fichier, taille, centre, date de référence
- Grille de cartes (une par variable) : paramètre, niveau, prévision, grille

---

## Vue grille

### Décodage
`showGridView(shortName)` → `decodeGRIB2(msg.buffer)` (WASM CCSDS).
Le résultat est stocké dans `gridState`.

### Rendu canvas
Canvas pleine résolution (ex : 2801×1791 pour AROME).

```js
function buildLUT(paletteName)  // 256 entrées RGB, évite N appels chroma par pixel
function renderHeatmap()         // lit gridState + currentPalette, repeint le canvas
```

Points manquants (≤ MISSING_VALUE) → gris semi-transparent (180, 180, 180, α=100).

### Carte MapLibre GL

Le canvas GRIB2 est superposé à une carte de fond via MapLibre GL :

```js
import maplibregl from 'https://esm.sh/maplibre-gl@4';
```

Le canvas est enregistré comme source `type: "canvas"` avec les coordonnées des coins de la grille (`corners`), puis affiché sur un calque raster. Un écouteur `mousemove` lit les valeurs brutes depuis `gridState` et affiche un tooltip `lat/lon/valeur`.

### Palette de couleurs (chroma-js)
Chargé via ESM CDN : `https://esm.sh/chroma-js@2.4.2`

11 palettes en 3 groupes (`<select>` dans la toolbar) :
- **Perceptually uniform** : Plasma, Viridis, Magma, Inferno
- **Diverging** : Spectral, RdBu, RdYlBu
- **Sequential** : YlOrRd, OrRd, Blues, YlGnBu

`Viridis` et les échelles ColorBrewer sont dans `chroma.brewer`.
`Plasma`, `Magma`, `Inferno` sont absents du build ESM → définis comme tableaux hex
dans `CUSTOM_SCALES` et passés directement à `chroma.scale([...])`.

Changement de palette → `renderHeatmap()` uniquement (pas de re-décodage WASM).

### CSS design tokens

Toutes les couleurs, espacements, rayons et transitions sont définis comme custom properties dans `:root` :

- `--color-*` — palette de couleurs (text, surface, bg, border, accent, error, success…)
- `--space-xs/sm/md/lg/xl` — échelle d'espacement (4/8/16/24/32 px)
- `--radius-sm/md/lg` — rayons de bordure (6/8/10 px)
- `--transition-fast/base/slow` — durées de transition (0.12/0.15/0.2 s)

### Helpers DOM

```js
function updateParamInfo(name, desc, sub)            // met à jour #gv-name, #gv-desc, #gv-sub
function updateStats(min, max, mean, count, units)   // met à jour #gv-min, #gv-max, #gv-mean, #gv-valid
```

### Légende couleur
Dégradé CSS généré depuis la scale courante (8 stops via `sc(i/7).css()`),
appliqué sur `#cs-bar`. Min/max affichés avec l'unité du paramètre.

---

## Imports JS

```html
<script type="importmap">
  { "imports": { "grib2-decoder": "/packages/grib2-decoder/dist/grib2-decoder.js" } }
</script>
```

```js
import maplibregl from 'https://esm.sh/maplibre-gl@4';
import chroma     from 'https://esm.sh/chroma-js@2.4.2';
import {
  iterateGRIB2Messages, decodeGRIB2, MISSING_VALUE,
  computeStats,
  CENTRES, GENERATING_PROCESS, fmtRefTime, fmtLevel, fmtValidTime,
} from 'grib2-decoder';
```

L'import map doit précéder le `<script type="module">`. Le serveur est lancé depuis la racine du dépôt, ce qui rend le chemin absolu `/packages/...` résolvable.
