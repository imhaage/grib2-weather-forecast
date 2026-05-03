# Design — Affichage des infos de paramètre dans l'interface AROME

**Date :** 2026-05-02  
**Scope :** `src/parameters.js`, `index.html`

---

## Contexte

L'interface AROME player n'affiche pas le nom long du paramètre sélectionné, et le `<select>` de variables montre le shortName (`t`) au lieu du nom complet (`Temperature`). De plus, le paramètre `tgrp` (graupel, code GRIB2 `0:1:75`) est absent de la table des paramètres.

---

## Changements

### 1. `src/parameters.js` — Ajout de `tgrp`

Nouvelle entrée :

```js
'0:1:75': { shortName: 'tgrp', name: 'Graupel (snow pellets) precipitation', units: 'kg m-2' }
```

Unité `kg m-2` (accumulation) — cohérente avec `typeOfStatisticalProcessing = 1` dans les fichiers AROME SP2.  
Source : eccodes `definitions/grib2/shortName.def`, confirmé dans `definitions/grib2/tables/35/4.2.0.1.table`.

---

### 2. `index.html` — Fix `discoverVariables`

**Avant (ligne ~1351) :**
```js
name: shortName,
```

**Après :**
```js
name: msg.product.name,
```

Les options du `<select>` afficheront "Temperature · 2m above ground (K)" au lieu de "t · 2m above ground (K)".

---

### 3. `index.html` — `#gv-meta` partagé

#### DOM

Extraire `#gv-meta` de `#grid-toolbar` pour en faire un bloc indépendant, **au-dessus des deux toolbars**, toujours visible quand `#view-grid` est actif.

Structure cible :

```html
<div id="view-grid">
  <main>
    <!-- bloc partagé — toujours visible -->
    <div id="gv-meta">
      <span class="badge" id="gv-badge"></span>
      <div>
        <div id="gv-name"></div>
        <div id="gv-sub"></div>
      </div>
    </div>

    <!-- toolbar fichier GRIB2 local -->
    <div id="grid-toolbar">
      <button class="btn-back" id="back-btn">← Variables</button>
      <div id="grid-stats">…</div>
      <div id="palette-ctrl">…</div>
    </div>

    <!-- toolbar AROME player -->
    <div id="arome-player-toolbar" style="display: none">
      <button class="btn-back" id="arome-back-btn">← Home</button>
      <select id="arome-var-select"></select>
      …
    </div>

    <div id="map-wrap">…</div>
    …
  </main>
</div>
```

Les IDs `gv-badge`, `gv-name`, `gv-sub` sont inchangés : le code `showGridView` continue de fonctionner sans modification. En CSS, `#gv-meta` reçoit un `margin-bottom: 12px` (auparavant hérité du gap flex de `#grid-toolbar`).

#### JS — Mise à jour depuis le player AROME

Dans `aromeShowHour`, après calcul du `product`, ajouter :

```js
document.getElementById('gv-badge').textContent = product.shortName;
document.getElementById('gv-name').textContent  = product.name;
document.getElementById('gv-sub').textContent   =
  `${aromeState.packageKey} · ${fmtLevel(product)} · run ${fmtRefTime(header)}`;
```

Le handler `change` du `#arome-var-select` (déjà existant) appelle `aromeShowHour(idx)` — les mises à jour de `#gv-meta` se propagent automatiquement, pas de code supplémentaire dans ce handler.

---

### 4. Badge package dans `#gv-sub`

Le texte de `#gv-sub` en mode AROME suit le format :

```
SP1 · 2m above ground · run 03Z 2026-04-25
```

Pas de badge HTML supplémentaire — le préfixe texte suffit. Le format est cohérent avec le `#gv-sub` existant en mode fichier (`2m above ground · 2026-04-25T04:00Z`).

---

## Fichiers touchés

| Fichier | Changement |
|---|---|
| `src/parameters.js` | +1 entrée `0:1:75` |
| `index.html` | Déplacement DOM `#gv-meta`, fix `discoverVariables`, mise à jour AROME dans `aromeShowHour` + handler `change` |

## Non inclus dans ce scope

- Gestion de `typeOfStatisticalProcessing` (template 4.8) pour renommer `rrate`/`srate` en `tirf`/`tsnowp` selon le contexte accumulation/taux — reporté.
- Panneau d'info détaillé (description longue, heure de référence, résolution) — reporté.
