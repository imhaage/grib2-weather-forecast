# AROME Parameter Info Display — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display the parameter's long name, unit, and active package (SP1/SP2) in the AROME player interface, and fix the variable select showing shortNames instead of full names.

**Architecture:** Two files are touched. `src/parameters.js` gains one entry (`tgrp`, `0:1:75`). `index.html` gets three changes: a one-line fix in `discoverVariables`, a DOM restructure moving `#gv-meta` before both toolbars so it is shared, and three new lines in `aromeShowHour` that write the same `gv-badge`/`gv-name`/`gv-sub` elements already used by the file-upload path.

**Tech Stack:** Vanilla JS (ES modules), MapLibre GL, Node.js test runner (`node --test`).

---

### Task 1: Add `tgrp` (graupel) to the parameter table

**Files:**
- Modify: `src/parameters.js` (after line 54, in Category 1 — Moisture block)
- Modify: `test/decoder.test.js` (in the `lookupParameter` describe block, ~line 212)

- [ ] **Step 1: Write the failing test**

  Open `test/decoder.test.js`. Inside the `'HP/IP parameters resolve correctly'` test (around line 212), add one assertion:

  ```js
  it('HP/IP parameters resolve correctly', () => {
      assert.equal(lookupParameter(0, 1, 83).shortName, 'clwc');
      assert.equal(lookupParameter(0, 1, 84).shortName, 'ciwc');
      assert.equal(lookupParameter(0, 3, 18).shortName, 'blh');
      assert.equal(lookupParameter(0, 14, 0).shortName, 'toz');
      // SP2 graupel precipitation (0:1:75, eccodes shortName.def)
      assert.equal(lookupParameter(0, 1, 75).shortName, 'tgrp');
      assert.equal(lookupParameter(0, 1, 75).units, 'kg m-2');
  });
  ```

- [ ] **Step 2: Run tests to confirm the new assertion fails**

  ```bash
  npm test 2>&1 | grep -A 3 "tgrp\|0, 1, 75"
  ```

  Expected: one failing assertion — `AssertionError: 'par_d0_c1_n75' !== 'tgrp'`.

- [ ] **Step 3: Add the entry to `src/parameters.js`**

  After line 54 (`'0:1:70': ...`), insert:

  ```js
  '0:1:75': { shortName: 'tgrp',   name: 'Graupel (snow pellets) precipitation',  units: 'kg m-2'      },
  ```

  The surrounding context in `parameters.js` looks like this (keep the existing lines, just insert between them):

  ```js
  '0:1:70': { shortName: 'tciw',   name: 'Total column integrated cloud ice',     units: 'kg m-2'      },
  // ← insert here
  '0:1:83': { shortName: 'clwc',   name: 'Specific cloud liquid water content',   units: 'kg kg-1'     },
  ```

- [ ] **Step 4: Run tests — all 93 (+1) must pass**

  ```bash
  npm test
  ```

  Expected: `pass 94` (or the test runner equivalent), no failures.

- [ ] **Step 5: Commit**

  ```bash
  git add src/parameters.js test/decoder.test.js
  git commit -m "feat: add tgrp (graupel 0:1:75) to parameter table"
  ```

---

### Task 2: Fix `discoverVariables` — show full name in variable select

**Files:**
- Modify: `index.html` (~line 1351)

- [ ] **Step 1: Locate and fix the bug**

  Find this block in `discoverVariables` (~line 1344):

  ```js
  function discoverVariables(buffer) {
      const seen = new Map();
      for (const msg of iterateGRIB2Messages(buffer)) {
        const { shortName, units } = msg.product;
        if (!seen.has(shortName)) {
          seen.set(shortName, {
            shortName,
            name: shortName,       // ← BUG: shows "t" instead of "Temperature"
            units: units ?? "",
            level: fmtLevel(msg.product),
          });
        }
      }
      return [...seen.values()];
  }
  ```

  Change `name: shortName,` to `name: msg.product.name,`:

  ```js
  function discoverVariables(buffer) {
      const seen = new Map();
      for (const msg of iterateGRIB2Messages(buffer)) {
        const { shortName, units } = msg.product;
        if (!seen.has(shortName)) {
          seen.set(shortName, {
            shortName,
            name: msg.product.name,  // ← "Temperature", "Relative humidity", …
            units: units ?? "",
            level: fmtLevel(msg.product),
          });
        }
      }
      return [...seen.values()];
  }
  ```

- [ ] **Step 2: Verify manually in browser**

  ```bash
  npm run serve
  ```

  Open the app, click **AROME SP1**. Wait for the first file to download. Check that the `<select>` options now read:
  - "Temperature · 2m above ground (K)"  ← was "t · 2m above ground (K)"
  - "Relative humidity · 2m above ground (%)" ← was "r · …"
  - etc.

- [ ] **Step 3: Commit**

  ```bash
  git add index.html
  git commit -m "fix: discoverVariables — show full parameter name in AROME variable select"
  ```

---

### Task 3: Share `#gv-meta` across both toolbar modes

**Files:**
- Modify: `index.html` — HTML structure, CSS, `aromeShowHour` function

#### 3a — Move `#gv-meta` in the DOM

- [ ] **Step 1: Extract `#gv-meta` from `#grid-toolbar`**

  The current HTML around line 586:

  ```html
  <div id="grid-toolbar">
    <button class="btn-back" id="back-btn">← Variables</button>
    <div id="gv-meta">
      <span class="badge" id="gv-badge"></span>
      <div>
        <div id="gv-name"></div>
        <div id="gv-sub"></div>
      </div>
    </div>
    <div id="grid-stats">
  ```

  Replace it with `#gv-meta` as a sibling *before* `#grid-toolbar`:

  ```html
  <div id="gv-meta">
    <span class="badge" id="gv-badge"></span>
    <div>
      <div id="gv-name"></div>
      <div id="gv-sub"></div>
    </div>
  </div>
  <div id="grid-toolbar">
    <button class="btn-back" id="back-btn">← Variables</button>
    <div id="grid-stats">
  ```

  (`#gv-meta` is now outside the flex container — it needs its own spacing, handled in the next step.)

#### 3b — Fix CSS spacing

- [ ] **Step 2: Add `margin-bottom` to `#gv-meta`**

  Find the existing `#gv-meta` CSS rule (~line 274):

  ```css
  #gv-meta {
      display: flex;
      align-items: center;
      gap: 10px;
  }
  ```

  Add `margin-bottom: 12px;`:

  ```css
  #gv-meta {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
  }
  ```

#### 3c — Update `aromeShowHour` to populate `#gv-meta`

- [ ] **Step 3: Add meta writes in `aromeShowHour`**

  Find the line in `aromeShowHour` (~line 1266):

  ```js
  gridState = { values, min, range, grid, product };
  ```

  Add three lines immediately after it:

  ```js
  gridState = { values, min, range, grid, product };

  document.getElementById('gv-badge').textContent = product.shortName;
  document.getElementById('gv-name').textContent  = product.name;
  document.getElementById('gv-sub').textContent   =
    `${aromeState.packageKey} · ${fmtLevel(product)} · run ${fmtRefTime(header)}`;
  ```

  Both `fmtLevel` and `fmtRefTime` are already imported at the top of the `<script>` block.

- [ ] **Step 4: Verify in browser**

  ```bash
  npm run serve
  ```

  1. **File-upload mode** — drop `test/arome__001__SP1__01H__2026-04-25T03_00_00Z.grib2`, click "View grid" on Temperature. Confirm the toolbar still shows: badge `t` · name "Temperature" · sub "2m above ground · 2026-04-25T04:00:00Z".

  2. **AROME player mode** — click SP1. Once the first file loads and the map renders, confirm the shared meta block shows: badge `t` · name "Temperature" · sub "SP1 · 2m above ground · run 2026-04-25T03:00:00Z".

  3. **Change variable** — switch the select to "Relative humidity". Confirm the meta updates to: badge `r` · name "Relative humidity" · sub "SP1 · 2m above ground · run …".

  4. **SP2** — click SP2 (or navigate `#arome/SP2`). Confirm the sub shows "SP2 · …".

- [ ] **Step 5: Commit**

  ```bash
  git add index.html
  git commit -m "feat: show parameter name and package in AROME player toolbar"
  ```
