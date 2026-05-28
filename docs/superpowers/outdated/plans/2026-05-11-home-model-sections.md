# Home Model Sections Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the flat model button list on the home page with two informative sections (AROME / ARPEGE), each showing a description, metadata grid, and inline package variables, and fix the incorrect ARPEGE bounds.

**Architecture:** Add a `MODEL_INFO` constant with per-model static metadata (description, resolution, domain, horizon, file structure). Update `buildModelList()` to generate full section DOM (title + desc + metadata grid + package buttons + variable list) instead of bare buttons. No new files — changes are confined to `index.js` and `style.css`.

**Tech Stack:** Vanilla JS (ES modules), CSS custom properties already defined in `:root`.

---

## File Map

| File | Change |
|------|--------|
| `apps/visualize/index.js` | Add `MODEL_INFO` constant after `PACKAGES`; fix ARPEGE bounds; replace `buildModelList()` |
| `apps/visualize/style.css` | Update `#model-list` layout; replace `.model-group` rules; add `.model-section`, `.model-meta`, `.model-packages`, `.model-package-vars` |

---

## Task 1: Add MODEL_INFO and fix ARPEGE bounds

**Files:** Modify `apps/visualize/index.js`

- [ ] **Step 1: Add `MODEL_INFO` constant after the closing `};` of `PACKAGES` (currently line 78), before `const PARAM_DESCRIPTIONS`**

```js
const MODEL_INFO = {
  AROME: {
    description: "Modèle haute résolution de Météo-France, limité à la France métropolitaine et ses façades maritimes.",
    resolution: "0.01° (~1 km)",
    domain: "12°W – 16°E · 37°N – 55°N",
    domainDesc: "France métropolitaine et façades Atlantique, Manche, Méditerranée",
    horizon: "H+01 à H+51",
    filesInfo: "1 heure par fichier (51 fichiers)",
  },
  ARPEGE: {
    description: "Modèle à aire limitée de Météo-France couvrant l'Europe, l'Atlantique nord-est et le Moyen-Orient.",
    resolution: "0.1° (~11 km)",
    domain: "32°W – 42°E · 20°N – 72°N",
    domainDesc: "Europe occidentale à centrale, Sahara à mer de Norvège",
    horizon: "H+000 à H+102",
    filesInfo: "12 heures par fichier (9 fichiers)",
  },
};
```

- [ ] **Step 2: Fix ARPEGE_SP1 bounds (currently line ~66)**

```js
// Before:
bounds: [[-180, -90], [180, 90]],

// After:
bounds: [[-32, 20], [42, 72]],
```

The actual ARPEGE SP1 0.1° grid covers 32°W–42°E · 20°N–72°N (verified from GRIB2 header: 741×521 pts, la1=72, lo1=-32, la2=20, lo2=42).

- [ ] **Step 3: Verify no JS errors**

```bash
npm run serve
# Open http://localhost:3000/apps/visualize/ — console should be error-free
# Click ARPEGE SP1 → map should now center on Europe/North Africa instead of the full globe
```

- [ ] **Step 4: Commit**

```bash
git add apps/visualize/index.js
git commit -m "fix: correct ARPEGE SP1 bounds and add MODEL_INFO constant"
```

---

## Task 2: Replace buildModelList()

**Files:** Modify `apps/visualize/index.js` — replace the IIFE at line ~1101

- [ ] **Step 1: Replace the entire `buildModelList` IIFE**

Find the block:
```js
(function buildModelList() {
  const container = document.getElementById("model-list");
  const groups = {};
  for (const [key, pkg] of Object.entries(PACKAGES)) {
    if (!groups[pkg.model]) groups[pkg.model] = [];
    groups[pkg.model].push({ key, pkg });
  }
  for (const [, entries] of Object.entries(groups)) {
    const group = document.createElement("div");
    group.className = "model-group";
    for (const { key, pkg } of entries) {
      const btn = document.createElement("button");
      btn.className = "btn-primary";
      btn.textContent = `${pkg.label} (last available run)`;
      btn.addEventListener("click", () => { location.hash = `#arome/${key}`; });
      group.appendChild(btn);
    }
    container.appendChild(group);
  }
})();
```

Replace with:
```js
(function buildModelList() {
  const container = document.getElementById("model-list");
  const groups = {};
  for (const [key, pkg] of Object.entries(PACKAGES)) {
    if (!groups[pkg.model]) groups[pkg.model] = [];
    groups[pkg.model].push({ key, pkg });
  }
  for (const [modelName, entries] of Object.entries(groups)) {
    const info = MODEL_INFO[modelName];

    const section = document.createElement("div");
    section.className = "model-section";

    const title = document.createElement("h2");
    title.className = "model-section-title";
    title.textContent = modelName;
    section.appendChild(title);

    const desc = document.createElement("p");
    desc.className = "model-section-desc";
    desc.textContent = info.description;
    section.appendChild(desc);

    const meta = document.createElement("div");
    meta.className = "model-meta";
    for (const [label, value] of [
      ["Résolution", info.resolution],
      ["Domaine", `${info.domain} — ${info.domainDesc}`],
      ["Horizon", info.horizon],
      ["Fichiers", info.filesInfo],
    ]) {
      const item = document.createElement("div");
      item.className = "meta-item";
      const lbl = document.createElement("span");
      lbl.className = "meta-label";
      lbl.textContent = label;
      const val = document.createElement("span");
      val.className = "meta-value";
      val.textContent = value;
      item.appendChild(lbl);
      item.appendChild(val);
      meta.appendChild(item);
    }
    section.appendChild(meta);

    const pkgsEl = document.createElement("div");
    pkgsEl.className = "model-packages";
    for (const { key, pkg } of entries) {
      const pkgEl = document.createElement("div");
      pkgEl.className = "model-package";

      const btn = document.createElement("button");
      btn.className = "btn-primary";
      btn.textContent = `${key.split("_").pop()} — last available run`;
      btn.addEventListener("click", () => { location.hash = `#arome/${key}`; });
      pkgEl.appendChild(btn);

      const vars = document.createElement("p");
      vars.className = "model-package-vars";
      vars.textContent = pkg.variables.map((v) => v.name).join(" · ");
      pkgEl.appendChild(vars);

      pkgsEl.appendChild(pkgEl);
    }
    section.appendChild(pkgsEl);
    container.appendChild(section);
  }
})();
```

- [ ] **Step 2: Verify in browser**

```bash
npm run serve
# Open http://localhost:3000/apps/visualize/
# Expected: two sections visible with title, description, 4 metadata pairs, package buttons + variable line
# The layout will be unstyled — that's fine, CSS comes in Task 3
# No JS errors in console
```

- [ ] **Step 3: Commit**

```bash
git add apps/visualize/index.js
git commit -m "feat: replace buildModelList with structured model sections"
```

---

## Task 3: CSS for model sections

**Files:** Modify `apps/visualize/style.css`

- [ ] **Step 1: Update `#model-list` — remove centering, increase gap**

Find:
```css
#model-list {
  margin-top: var(--space-lg);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
}
```

Replace with:
```css
#model-list {
  margin-top: var(--space-lg);
  display: flex;
  flex-direction: column;
  gap: var(--space-md);
}
```

- [ ] **Step 2: Remove dead CSS — `.model-group`, `#model-list small`, `.model-group .btn-primary`**

Find and remove these three blocks:
```css
#model-list small {
  font-size: 0.78rem;
  color: var(--color-text-muted);
}
.model-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-sm);
  width: 100%;
}
.model-group .btn-primary {
  padding: var(--space-sm) var(--space-xl);
  font-size: 0.9rem;
  font-weight: 600;
}
```

- [ ] **Step 3: Add model section styles — insert after the `#model-list` block**

```css
/* ── Model sections ── */
.model-section {
  border: 1px solid var(--color-border-2);
  border-radius: var(--radius-md);
  padding: var(--space-lg);
}

.model-section-title {
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.01em;
  margin-bottom: var(--space-xs);
}

.model-section-desc {
  font-size: 0.85rem;
  color: var(--color-text-2);
  margin-bottom: var(--space-md);
}

.model-meta {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-xs) var(--space-xl);
  padding: var(--space-sm) 0;
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
  margin-bottom: var(--space-md);
}

.model-meta .meta-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.model-meta .meta-value {
  font-size: 0.88rem;
  font-weight: 600;
}

.model-packages {
  display: flex;
  flex-direction: column;
  gap: var(--space-sm);
}

.model-section .btn-primary {
  padding: var(--space-sm) var(--space-lg);
  font-size: 0.88rem;
  font-weight: 600;
}

.model-package-vars {
  font-size: 0.78rem;
  color: var(--color-text-muted);
  margin-top: var(--space-xs);
  line-height: 1.5;
}
```

- [ ] **Step 4: Verify layout in browser**

```bash
npm run serve
# Open http://localhost:3000/apps/visualize/
# Expected:
# - Two bordered sections (AROME above, ARPEGE below)
# - Each section: title, muted description, metadata grid with 4 pairs, package button(s) + variable line
# - Sections fill the full content width (not centered)
# - Border color is subtle dark grey (between --color-border and --color-bg)
# - Clicking SP1 / SP2 buttons navigates correctly
```

- [ ] **Step 5: Commit**

```bash
git add apps/visualize/style.css
git commit -m "style: add model section layout for home page"
```
