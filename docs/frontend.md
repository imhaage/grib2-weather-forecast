# Application web — apps/arome-visualizer/index.html

## Architecture

SPA sans framework, un seul fichier. Deux modes d'utilisation :
- **Fichier local** : drag-and-drop ou file input → messages GRIB2 parsés localement.
- **AROME en ligne** : téléchargement de packages GRIB2 depuis un CDN (données Météo-France) avec animation temporelle.

Servie statiquement depuis la racine du dépôt (`npm run serve` → `http://localhost:3000/apps/arome-visualizer/`).

```
#             → vue home  (#view-home)
#grid/<name>  → vue grille (#view-grid)
```

### État en mémoire

```js
let fileState      = null; // { messages: Array } — messages parsés sans décodage WASM
let gridState      = null; // { values, min, range, grid, product [, displayUnits, staticScale] }
let aromeState     = null; // { packageKey, resources, buffers, decoded, decodedOrder, variable, currentHour }
let currentPalette = 'Plasma';
let map            = null; // instance MapLibre (créée une fois, réutilisée)
let heatCanvas     = null; // canvas offscreen pour le rendu heatmap
let isDecoding     = false;
let pendingHourIdx = null;
```

`gridState` est conservé pour permettre de changer la palette sans relancer le WASM.
`staticScale` est présent pour les paramètres avec une échelle fixe (ex. CAPE) ; sinon l'échelle est calculée dynamiquement à partir du min/max.

`aromeState` est remplacé entièrement lors d'un nouveau téléchargement ; les callbacks de progression vérifient l'identité de référence (`downloadKey = aromeState`) pour ignorer les réponses d'un téléchargement annulé.

---

## Vue home — Fichier local

- Zone drag-and-drop / file input → `processFile(file)`
- `iterateGRIB2Messages(buffer)` (synchrone, sans WASM) pour lister les variables
- Bandeau de métadonnées : fichier, taille, centre, date de référence
- Grille de cartes (une par variable) : paramètre, niveau, prévision, grille

---

## Vue home — AROME en ligne

### Packages disponibles

```js
const PACKAGES = {
  SP1: { label: "AROME SP1 0.01°", variables: [...] },  // t, r, u, v, ugust, vgust
  SP2: { label: "AROME SP2 0.01°", variables: [...] },  // p, cape, lcc, mcc, hcc, tgrp, rrate, srate
};
```

Chaque package définit une liste de variables (`shortName`, `name`, `units`, `level`) et une URL de base pour les fichiers GRIB2 par échéance.

### Flux de téléchargement

`startAromeDownload(packageKey)` :
1. Initialise `aromeState` (réinitialise l'état précédent) et calcule `downloadKey = aromeState`
2. Affiche la liste des fichiers à télécharger avec barres de progression individuelles
3. Lance `Promise.all(...)` sur toutes les échéances ; chaque callback de progression vérifie `aromeState !== downloadKey` avant de mettre à jour le DOM — évite les race conditions si un nouveau téléchargement est lancé entre-temps
4. Au fur et à mesure, stocke les buffers dans `aromeState.buffers` et déclenche le décodage via `aromeShowHour()`

### Animation temporelle

`aromeShowHour(hour)` :
- Décode le buffer GRIB2 pour l'échéance demandée (`decodeGRIB2`) si pas encore en cache dans `aromeState.decoded`
- Met à jour `gridState` et relance `renderHeatmap()`
- `isDecoding` / `pendingHourIdx` évitent les décodages simultanés (le slider peut avancer pendant qu'un décodage est en cours)

---

## Vue grille

### Décodage
`showGridView(shortName)` → `decodeGRIB2(msg.buffer)` (WASM CCSDS/JPEG2000).
Le résultat est stocké dans `gridState`.

### Rendu canvas
Canvas offscreen (`heatCanvas`) pleine résolution (ex : 2801×1791 pour AROME), copié sur le canvas visible.

```js
function buildLUT(paletteName)  // 256 entrées RGB, évite N appels chroma par pixel
function renderHeatmap()         // lit gridState + currentPalette, repeint le canvas
function computeOutHeight(grid)  // hauteur de sortie en pixels pour conserver le ratio Mercator
```

Points manquants (≤ MISSING_VALUE) → gris semi-transparent (180, 180, 180, α=100).

Le rendu supporte les deux sens de balayage vertical :
- **N→S** (`la1 > la2`, scanning mode standard) : `row = rowFromNorth`
- **S→N** (`la2 > la1`, scanning mode 0x40) : `row = nj - 1 - rowFromNorth`

### Projection Mercator

`computeOutHeight` et le mapping pixel→latitude utilisent la projection de Mercator :

```js
const mercatorY    = lat => Math.log(Math.tan(Math.PI/4 + lat * Math.PI/360));
const invMercatorY = y   => (Math.atan(Math.exp(y)) - Math.PI/4) * 360/Math.PI;
```

La hauteur de sortie est calculée pour conserver le ratio géographique `spanY / spanX` en projection Mercator.

### Carte MapLibre GL

Le canvas GRIB2 est superposé à une carte de fond via MapLibre GL :

```js
import maplibregl from 'https://esm.sh/maplibre-gl@4';
```

Le canvas est enregistré comme source `type: "canvas"` avec les coordonnées des coins de la grille :

```js
function gridCorners(grid)
// retourne [[west,north],[east,north],[east,south],[west,south]]
// gère toutes les orientations (N→S/S→N, E→W/W→E) via Math.min/max
```

Un écouteur `mousemove` lit les valeurs brutes depuis `gridState` et affiche un tooltip `lat/lon/valeur`.

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
