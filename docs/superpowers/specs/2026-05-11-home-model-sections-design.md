# Home page — model sections design

**Date:** 2026-05-11

## Goal

Replace the current flat list of model buttons on the home page with two distinct, informative sections — one for AROME and one for ARPEGE — each presenting domain metadata and package contents before the user clicks.

## Bug fixed in scope

`PACKAGES.ARPEGE_SP1.bounds` is currently `[[-180, -90], [180, 90]]` (global, incorrect). The actual ARPEGE SP1 0.1° grid covers `32°W – 42°E · 20°N – 72°N`. Fix bounds to `[[-32, 20], [42, 72]]`.

## Layout

Two sections stacked vertically inside `#model-list`, one per model group (AROME, ARPEGE). Each section has a visible border using `var(--color-border-2)` (darker grey, lighter than background — already defined in `:root`).

## Section structure (per model)

### 1. Header

Model name as section title + one-line description.

| Model | Description |
|-------|-------------|
| AROME | Modèle haute résolution de Météo-France, limité à la France métropolitaine et ses façades maritimes. |
| ARPEGE | Modèle à aire limitée de Météo-France couvrant l'Europe, l'Atlantique nord-est et le Moyen-Orient. |

### 2. Metadata grid

Four label/value pairs rendered in the same style as `#file-summary` (existing component on the home page):

| Label | AROME value | ARPEGE value |
|-------|-------------|--------------|
| Résolution | 0.01° (~1 km) | 0.1° (~11 km) |
| Domaine | 32°W – 16°E · 37°N – 55°N — France métropolitaine et façades Atlantique, Manche, Méditerranée | 32°W – 42°E · 20°N – 72°N — Europe occidentale à centrale, Sahara à mer de Norvège |
| Horizon | H+01 à H+51 | H+000 à H+102 |
| Fichiers | 1 heure par fichier (51 fichiers) | 12 heures par fichier (9 fichiers) |

### 3. Packages

One block per package available for the model. Each block contains:
- A `btn-primary` button labelled with the package name (e.g. "SP1 — last available run")
- A line of variable names inline, separated by `·`, in a muted text style

| Package | Variables |
|---------|-----------|
| AROME SP1 | Température · Humidité relative · Vent (u/v) · Rafales (u/v) |
| AROME SP2 | Pression · CAPE · Nébulosité basse / moyenne / haute · Pluie · Neige · Grêle |
| ARPEGE SP1 | Température · Humidité relative · Vent (u/v) · Pression mer · Nébulosité totale · Vitesse vent · Direction vent |

## Implementation

### HTML (`apps/visualize/index.html`)

No changes — `#model-list` container already exists.

### JS (`apps/visualize/index.js`)

Add `description`, `domain`, `horizon`, and `filesInfo` fields to each entry in `PACKAGES`.

Update `buildModelList()` to generate the full section structure (header + metadata grid + packages) instead of bare buttons.

Fix `ARPEGE_SP1.bounds` from `[[-180, -90], [180, 90]]` to `[[-32, 20], [42, 72]]`.

### CSS (`apps/visualize/style.css`)

New rules for:
- `.model-section` — border, padding, border-radius, spacing between sections
- `.model-section-title` — section heading style
- `.model-section-desc` — muted description line
- `.model-meta` — grid for label/value pairs (reuse existing `#file-summary` pattern)
- `.model-packages` — flex row of package blocks
- `.model-package` — individual package block (button + variable list)
- `.model-package-vars` — inline variable list, muted color, small font
