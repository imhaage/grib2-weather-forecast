# Design: Home view tabs

## Overview

Split the `#view-home` home page into two tabs:
- **Visualize a full forecast run** — shows `#model-list`
- **Inspect a GRIB2 file** — shows the drop-zone section

The model tab is active by default. Switching tabs resets the drop-zone state (no persistence).

## Approach

Extend the existing `showView()` pattern with a `showTab(name)` function. Pure JS show/hide, no framework, no URL hash.

## HTML changes — `apps/visualize/index.html`

1. Add a `<nav class="tab-bar">` with two `<button class="tab-btn">` elements inside `#view-home`, before `<main>`:
   - `data-tab="model"` → "Visualize a full forecast run"
   - `data-tab="upload"` → "Inspect a GRIB2 file"
2. Wrap `#model-list` and its `<p class="section-desc">` in `<div id="tab-panel-model">`.
3. Wrap `#drop-zone`, `#status`, `#file-summary`, and `#results` (with its preceding `<p class="section-desc">`) in `<div id="tab-panel-upload">`.
4. Remove the `<hr>` separator between the two sections.

## CSS changes — `apps/visualize/style.css`

Add ~20 lines in the `#view-home` section:

```css
.tab-bar {
  display: flex;
  gap: var(--space-sm);
  padding: var(--space-md) var(--space-md) 0;
  border-bottom: 1px solid var(--color-border);
  max-width: 960px;
  margin: 0 auto;
}

.tab-btn {
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  padding: var(--space-sm) var(--space-md);
  color: var(--color-text-2);
  font-family: inherit;
  font-size: var(--font-md);
  cursor: pointer;
  margin-bottom: -1px;
  transition: color var(--transition-base), border-color var(--transition-base);
}

.tab-btn:hover {
  color: var(--color-text);
}

.tab-btn.active {
  color: var(--color-accent);
  border-bottom-color: var(--color-accent);
}

#tab-panel-model,
#tab-panel-upload {
  display: none;
}

#tab-panel-model.active,
#tab-panel-upload.active {
  display: block;
}
```

## JS changes — `apps/visualize/index.js`

Add `showTab(name)` function alongside `showView()`:

```js
function showTab(name) {
  for (const panel of ["model", "upload"]) {
    document.getElementById(`tab-panel-${panel}`).classList.toggle("active", panel === name);
  }
  for (const btn of document.querySelectorAll(".tab-btn")) {
    btn.classList.toggle("active", btn.dataset.tab === name);
  }
  if (name === "model") resetUploadState();
}

function resetUploadState() {
  document.getElementById("file-summary").style.display = "none";
  document.getElementById("results").style.display = "none";
  document.getElementById("status").textContent = "";
  document.getElementById("status").className = "";
}
```

Wire up tab buttons on init:

```js
for (const btn of document.querySelectorAll(".tab-btn")) {
  btn.addEventListener("click", () => showTab(btn.dataset.tab));
}
showTab("model"); // default
```

## Out of scope

- URL hash persistence
- Remembering last active tab across page reloads
- Animation between tabs
