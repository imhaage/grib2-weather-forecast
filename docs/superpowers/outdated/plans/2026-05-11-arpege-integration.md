# ARPEGE Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add ARPEGE 0.1° (Météo-France, global) as a second model source alongside AROME in the visualizer, using the same data.gouv.fr infrastructure and DRT 42 decoder.

**Architecture:** ARPEGE files bundle 12 forecast hours per GRIB2 file (vs 1h/file for AROME). The fetch layer is generalized to handle both patterns; a new `messageIndex` per block maps `${forecastHour}_${shortName}` → message buffer, enabling hour-level navigation within blocks. The slider iterates over an expanded `hourList` built from the block resources. AROME codepath is unchanged — single-hour blocks use the same indexing logic with one message per block.

**Tech Stack:** Vanilla JS (ES modules), data.gouv.fr REST API, existing `iterateGRIB2Messages` + `decodeGRIB2` from `grib2-decoder`, MapLibre GL, chroma-js.

---

## File Map

| File | Change |
|------|--------|
| `apps/visualize/index.js` | All JS changes: PACKAGES, fetch, state, indexBlock, showHour, UI generation, routing |
| `apps/visualize/index.html` | Replace hardcoded `btn-sp1`/`btn-sp2` with dynamic `<div id="model-list">` |
| `docs/frontend.md` | Update aromeState → modelState reference, PACKAGES structure section |

No new files. No changes to decoder, tests, or CLI tools.

---

## Task 1: Discover ARPEGE SP1 variable list

**Files:** none (discovery only)

- [ ] **Step 1: Fetch the first ARPEGE SP1 URL from data.gouv.fr**

```bash
curl -s "https://www.data.gouv.fr/api/1/datasets/65bd13b2eb9e79ab309f6e63/" \
  | node -e "
    const d = JSON.parse(require('fs').readFileSync('/dev/stdin','utf8'));
    const r = d.resources.find(r => r.format === 'grib2' && r.title?.includes('__SP1__'));
    console.log(r?.url, r?.title, r?.filesize);
  "
```

- [ ] **Step 2: Download the SP1 block (first 12 hours, ~78 MB)**

```bash
# Set URL from Step 1 output, then:
curl -L -o /tmp/arpege_sp1_block.grib2 "<URL_FROM_STEP_1>"
```

- [ ] **Step 3: Inspect variables with grib2-info**

```bash
npm run info -- /tmp/arpege_sp1_block.grib2 2>&1 | grep -E "shortName|Parameter|Level"
```

- [ ] **Step 4: List unique shortNames across all messages**

```bash
node -e "
  import { readFileSync } from 'fs';
  import { iterateGRIB2Messages } from './packages/grib2-decoder/src/index.js';
  const buf = readFileSync('/tmp/arpege_sp1_block.grib2');
  const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  const seen = new Set();
  for (const msg of iterateGRIB2Messages(data)) {
    const k = \`\${msg.product.shortName} | \${msg.product.name} | \${msg.product.units} | \${msg.product.forecastTime}h\`;
    if (!seen.has(msg.product.shortName)) { seen.add(msg.product.shortName); console.log(k); }
  }
" --input-type=module
```

Expected: list like `t | Temperature | K | 0`, `r | Relative humidity | % | 0`, etc.

Note the `forecastTime` values to confirm they are 0–12 integers in hours (timeUnit=1).

- [ ] **Step 5: Record the variable list for Task 2**

Write down each `{ shortName, name, units }` found. The `level` string can be filled from the AROME equivalent for matching shortNames.

---

## Task 2: Restructure PACKAGES in index.js

**Files:** Modify `apps/visualize/index.js` lines 24–122

- [ ] **Step 1: Replace the PACKAGES constant**

Replace the entire `PACKAGES` block (lines 24–122) with the generalized structure below. Fill in `ARPEGE_SP1.variables` from Task 1 discoveries. The AROME variables list is unchanged — copy it verbatim.

```js
// ── Model packages ────────────────────────────────────────────────────────────
const PACKAGES = {
  AROME_SP1: {
    key: 'AROME_SP1',
    model: 'AROME',
    label: 'AROME SP1 0.01° — France',
    provider: 'data-gouv',
    datasetId: '65bd1247a6238f16e864fa80',
    titlePattern: '__SP1__',
    bounds: [[-12, 37.5], [16, 55.4]],
    variables: [
      { shortName: 't',     name: 'Temperature',                      units: '°C',   level: '2 m above ground' },
      { shortName: 'r',     name: 'Relative humidity',                units: '%',    level: '2 m above ground' },
      { shortName: 'u',     name: 'U-component of wind',              units: 'm s-1',level: '10 m above ground' },
      { shortName: 'v',     name: 'V-component of wind',              units: 'm s-1',level: '10 m above ground' },
      { shortName: 'ugust', name: 'U-component of wind (gust)',       units: 'm s-1',level: '10 m above ground' },
      { shortName: 'vgust', name: 'V-component of wind (gust)',       units: 'm s-1',level: '10 m above ground' },
    ],
  },
  AROME_SP2: {
    key: 'AROME_SP2',
    model: 'AROME',
    label: 'AROME SP2 0.01° — France',
    provider: 'data-gouv',
    datasetId: '65bd1247a6238f16e864fa80',
    titlePattern: '__SP2__',
    bounds: [[-12, 37.5], [16, 55.4]],
    variables: [
      { shortName: 'p',     name: 'Pressure',                                      units: 'hPa',   level: 'Ground surface' },
      { shortName: 'cape',  name: 'Convective available potential energy',          units: 'J kg-1',level: 'Ground surface' },
      { shortName: 'lcc',   name: 'Low cloud cover',                               units: '%',     level: 'Ground surface' },
      { shortName: 'mcc',   name: 'Medium cloud cover',                            units: '%',     level: 'Ground surface' },
      { shortName: 'hcc',   name: 'High cloud cover',                              units: '%',     level: 'Ground surface' },
      { shortName: 'tgrp',  name: 'Graupel (snow pellets) precipitation',          units: 'mm/h',  level: 'Ground surface' },
      { shortName: 'rrate', name: 'Rain precipitation',                            units: 'mm/h',  level: 'Ground surface' },
      { shortName: 'srate', name: 'Snow precipitation',                            units: 'mm/h',  level: 'Ground surface' },
    ],
  },
  ARPEGE_SP1: {
    key: 'ARPEGE_SP1',
    model: 'ARPEGE',
    label: 'ARPEGE SP1 0.1° — Monde',
    provider: 'data-gouv',
    datasetId: '65bd13b2eb9e79ab309f6e63',
    titlePattern: '__SP1__',
    bounds: [[-180, -90], [180, 90]],
    variables: [
      // Fill from Task 1 Step 5. Example (verify against actual file):
      { shortName: 't', name: 'Temperature', units: '°C', level: '2 m above ground' },
      // ... add remaining variables
    ],
  },
};
```

- [ ] **Step 2: Remove the `AROME_BOUNDS` constant (line 145–148)**

It is replaced by `pkg.bounds` in each package entry.

- [ ] **Step 3: Verify the file still loads**

```bash
npm run serve
# Open http://localhost:3000/apps/visualize/ — page should load without JS errors in console
```

---

## Task 3: Update HTML — replace hardcoded buttons with dynamic container

**Files:** Modify `apps/visualize/index.html`

- [ ] **Step 1: Find and replace the AROME shortcut section**

Find the block (around line 24–35):
```html
<div id="arome-shortcut">
  <button id="btn-sp1" class="btn-primary">
  ...
  <button id="btn-sp2" class="btn-primary">
  ...
</div>
```

Replace with:
```html
<div id="model-list"></div>
```

- [ ] **Step 2: Verify HTML is valid**

```bash
npm run serve
# Open http://localhost:3000/apps/visualize/ — page loads, no visible broken layout yet (model-list is empty until JS runs)
```

---

## Task 4: Generate model group UI dynamically

**Files:** Modify `apps/visualize/index.js` — add after the PACKAGES constant

- [ ] **Step 1: Add model group generation after the PACKAGES constant**

Add this block immediately after the closing `};` of PACKAGES (before `const PARAM_DESCRIPTIONS`):

```js
// ── Generate model group buttons ───────────────────────────────────────────────
(function buildModelList() {
  const container = document.getElementById('model-list');
  // Group packages by model name
  const groups = {};
  for (const pkg of Object.values(PACKAGES)) {
    if (!groups[pkg.model]) groups[pkg.model] = [];
    groups[pkg.model].push(pkg);
  }
  for (const [modelName, pkgs] of Object.entries(groups)) {
    const group = document.createElement('div');
    group.className = 'model-group';
    const heading = document.createElement('p');
    heading.className = 'model-group-label';
    heading.textContent = modelName;
    group.appendChild(heading);
    for (const pkg of pkgs) {
      const btn = document.createElement('button');
      btn.id = `btn-${pkg.key.toLowerCase()}`;
      btn.className = 'btn-primary';
      btn.textContent = pkg.label;
      group.appendChild(btn);
    }
    container.appendChild(group);
  }
})();
```

- [ ] **Step 2: Update event wiring at the bottom of index.js**

Find the existing block (around line 1173–1177):
```js
for (const key of Object.keys(PACKAGES)) {
  document.getElementById(`btn-${key.toLowerCase()}`).addEventListener('click', () => {
    location.hash = `#arome/${key}`;
  });
}
```

This loop already generates event listeners using `btn-${key.toLowerCase()}`. Since we now generate buttons with that same ID pattern, **this block works unchanged**. Verify it's still present.

- [ ] **Step 3: Verify buttons appear in browser**

```bash
npm run serve
```

Open `http://localhost:3000/apps/visualize/`. Expected: two groups — AROME (2 buttons) and ARPEGE (1 button). Clicking any button should navigate to `#arome/AROME_SP1` etc. (may 404 in route for now — will fix in Task 10).

---

## Task 5: Generalize fetchAromeResources → fetchDataGouvResources

**Files:** Modify `apps/visualize/index.js` — replace `fetchAromeResources` (lines 759–782)

- [ ] **Step 1: Replace the function**

```js
async function fetchDataGouvResources(datasetId, titlePattern) {
  const resp = await fetch(`https://www.data.gouv.fr/api/1/datasets/${datasetId}/`);
  if (!resp.ok) throw new Error(`API ${resp.status}`);
  const data = await resp.json();
  return data.resources
    .filter(r => r.format === 'grib2' && r.title?.includes(titlePattern))
    .map(r => {
      const single = r.title.match(/__(\d+)H__/);
      const range  = r.title.match(/__(\d+)H(\d+)H__/);
      if (single) {
        const h = parseInt(single[1], 10);
        return { startHour: h, endHour: h, key: single[0].replace(/__/g, ''), url: r.url, filesize: r.filesize };
      }
      if (range) {
        return { startHour: parseInt(range[1], 10), endHour: parseInt(range[2], 10), key: range[0].replace(/__/g, ''), url: r.url, filesize: r.filesize };
      }
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => a.startHour - b.startHour);
}
```

- [ ] **Step 2: Write a quick unit test for the URL parsing logic**

Create a temporary file `/tmp/test-fetch-parse.mjs` and run it:

```js
// /tmp/test-fetch-parse.mjs
function parseTitle(title) {
  const single = title.match(/__(\d+)H__/);
  const range  = title.match(/__(\d+)H(\d+)H__/);
  if (single) { const h = parseInt(single[1], 10); return { startHour: h, endHour: h }; }
  if (range)  return { startHour: parseInt(range[1], 10), endHour: parseInt(range[2], 10) };
  return null;
}

const cases = [
  ['arome__001__SP1__01H__2026-05-11T00:00:00Z.grib2',          { startHour: 1,  endHour: 1  }],
  ['arome__001__SP1__60H__2026-05-11T00:00:00Z.grib2',          { startHour: 60, endHour: 60 }],
  ['arpege__01__SP1__000H012H__2026-05-11T00:00:00Z.grib2',     { startHour: 0,  endHour: 12 }],
  ['arpege__01__SP1__013H024H__2026-05-11T00:00:00Z.grib2',     { startHour: 13, endHour: 24 }],
  ['arpege__01__SP1__097H102H__2026-05-11T00:00:00Z.grib2',     { startHour: 97, endHour: 102}],
];

let ok = true;
for (const [title, expected] of cases) {
  const r = parseTitle(title);
  const pass = r?.startHour === expected.startHour && r?.endHour === expected.endHour;
  console.log(pass ? '✓' : '✗', title);
  if (!pass) { console.error('  got:', r, 'expected:', expected); ok = false; }
}
process.exit(ok ? 0 : 1);
```

```bash
node /tmp/test-fetch-parse.mjs
```

Expected: 5 lines starting with `✓`.

---

## Task 6: Update aromeState → modelState structure

**Files:** Modify `apps/visualize/index.js`

- [ ] **Step 1: Rename the state variable declaration (line 156)**

```js
// Before:
let aromeState = null; // { resources, buffers, decoded, decodedOrder, variable }

// After:
let modelState = null; // { packageKey, resources, hourList, buffers, messageIndex, decoded, decodedOrder, variable, lastRunInfo }
```

- [ ] **Step 2: Rename all occurrences of `aromeState` → `modelState` throughout the file**

```bash
# In apps/visualize/index.js, replace every occurrence:
sed -i '' 's/aromeState/modelState/g' apps/visualize/index.js
```

Verify the change didn't corrupt anything:

```bash
grep -n "modelState\|aromeState" apps/visualize/index.js | head -20
# Should show only "modelState", no "aromeState"
```

- [ ] **Step 3: Rename `resetAromeState` → `resetModelState` (lines 659–666)**

```js
function resetModelState() {
  modelState = null;
  isDecoding = false;
  pendingHourIdx = null;
  gridState = null;
  document.getElementById('arome-dl-bars').innerHTML = '';
  document.getElementById('arome-dl-file-list').innerHTML = '';
}
```

Update the two call sites (in `resetApp` and `route`):
```js
// Before: resetAromeState();
// After:  resetModelState();
```

- [ ] **Step 4: Verify the page still loads**

```bash
npm run serve
# Check browser console: no undefined errors
```

---

## Task 7: Implement indexBlock()

**Files:** Modify `apps/visualize/index.js` — add after `decodeVariableFromBuffer`

The function indexes all messages in a downloaded block into `modelState.messageIndex`.
The cache key is `${forecastHour}_${shortName}`.

- [ ] **Step 1: Add the function after `decodeVariableFromBuffer` (currently around line 638)**

```js
function indexBlock(blockKey) {
  const buffer = modelState.buffers.get(blockKey);
  const index = new Map(); // `${forecastHour}_${shortName}` → msg.buffer (Uint8Array)
  for (const msg of iterateGRIB2Messages(buffer)) {
    const hour = msg.product.forecastTime; // uint32, hours (timeUnit=1 for ARPEGE/AROME)
    const name = msg.product.shortName;
    index.set(`${hour}_${name}`, msg.buffer);
  }
  modelState.messageIndex.set(blockKey, index);
}
```

---

## Task 8: Update getCachedDecode to use block/message index

**Files:** Modify `apps/visualize/index.js` — replace `getCachedDecode` (lines 807–819)

The new version:
1. Finds the block containing the requested `hour`
2. Downloads it if missing (triggers download, returns null — caller retries when block arrives)
3. Indexes it if not yet indexed
4. Decodes the specific `${hour}_${variable}` message

- [ ] **Step 1: Replace getCachedDecode**

```js
async function getCachedDecode(hour) {
  const { decoded, decodedOrder, messageIndex, buffers, variable } = modelState;
  const cacheKey = `${hour}_${variable}`;

  if (decoded.has(cacheKey)) return decoded.get(cacheKey);

  // Find the block that contains this hour
  const block = modelState.resources.find(r => hour >= r.startHour && hour <= r.endHour);
  if (!block) return null;

  const buffer = buffers.get(block.key);
  if (!buffer) return null; // block not yet downloaded

  // Index the block on first access
  if (!messageIndex.has(block.key)) indexBlock(block.key);

  const msgBuffer = messageIndex.get(block.key).get(cacheKey);
  if (!msgBuffer) return null; // variable not found in block

  if (decodedOrder.length >= DECODED_CACHE_SIZE) decoded.delete(decodedOrder.shift());

  const dec = await decodeGRIB2(msgBuffer);
  const result = { values: dec.values, grid: dec.grid, product: dec.product, header: dec.header };
  decoded.set(cacheKey, result);
  decodedOrder.push(cacheKey);
  return result;
}
```

- [ ] **Step 2: Remove `decodePrevHourValues` — it used the old cache key**

Find `decodePrevHourValues` (lines 821–824) and update it:

```js
async function decodePrevHourValues(prevHour) {
  const data = await getCachedDecode(prevHour);
  return data ? data.values : null;
}
```

This function signature is unchanged — it already delegates to `getCachedDecode`. No edit needed if the body was already this.

---

## Task 9: Update startAromeDownload → startDownload

**Files:** Modify `apps/visualize/index.js` — replace `startAromeDownload` (lines 949–1078)

Key changes:
- Use `fetchDataGouvResources(pkg.datasetId, pkg.titlePattern)` instead of `fetchAromeResources`
- Build `hourList` from resources (expanded per-hour list for slider)
- State uses `buffers: Map<blockKey, Uint8Array>` (not `Map<hour, Uint8Array>`)
- Add `messageIndex: new Map()` to state
- Fit map bounds from `pkg.bounds` instead of `AROME_BOUNDS`
- Progress bars keyed by `block.key` instead of `hour`

- [ ] **Step 1: Replace the function**

```js
async function startDownload(packageKey) {
  const pkg = PACKAGES[packageKey];

  modelState = {
    packageKey,
    resources: [],
    hourList: [],
    buffers: new Map(),
    messageIndex: new Map(),
    decoded: new Map(),
    decodedOrder: [],
    variable: null,
    lastRunInfo: null,
  };

  const varSelect = document.getElementById('arome-var-select');
  varSelect.innerHTML = '';
  const pkgVars = pkg.variables;
  modelState.variable = pkgVars[0].shortName;
  applyDefaultPalette(pkgVars[0].shortName);
  varSelect.innerHTML = pkgVars
    .map(v => `<option value="${v.shortName}">${v.name}${v.level ? ' · ' + v.level : ''}${v.units ? ' (' + v.units + ')' : ''}</option>`)
    .join('');
  varSelect.value = modelState.variable;

  const slider = document.getElementById('arome-slider');
  slider.value = 0;

  await initMap();
  map.fitBounds(pkg.bounds, { padding: 20, animate: false });

  document.getElementById('arome-dl-status').textContent = 'Fetching file list…';

  let resources;
  try {
    resources = await fetchDataGouvResources(pkg.datasetId, pkg.titlePattern);
  } catch (e) {
    document.getElementById('arome-dl-status').textContent = 'API error: ' + e.message;
    return;
  }

  modelState.resources = resources;

  // Expand blocks into a per-hour list for the slider
  const hourList = [];
  for (const block of resources) {
    for (let h = block.startHour; h <= block.endHour; h++) hourList.push(h);
  }
  modelState.hourList = hourList;
  slider.max = hourList.length - 1;

  document.getElementById('arome-dl-status').textContent =
    `Downloading ${resources.length} block(s)… (${hourList.length} forecast hours)`;

  const barsEl = document.getElementById('arome-dl-bars');
  const fileListEl = document.getElementById('arome-dl-file-list');
  barsEl.innerHTML = '';
  fileListEl.innerHTML = '';
  for (const block of resources) {
    const item = document.createElement('div');
    item.className = 'arome-dl-item';
    item.id = `dl-${block.key}`;
    item.textContent = block.startHour === block.endHour
      ? `${String(block.startHour).padStart(2, '0')}H`
      : `H+${block.startHour}–${block.endHour}`;
    barsEl.appendChild(item);

    const li = document.createElement('li');
    li.textContent = block.url.split('/').pop();
    fileListEl.appendChild(li);
  }

  const downloadKey = modelState;
  let doneCount = 0;
  let legendInitialized = false;
  await Promise.all(
    resources.map(async (block) => {
      const buffer = await downloadFileProg(block.url, block.filesize, (loaded, total) => {
        if (modelState !== downloadKey) return;
        document.getElementById(`dl-${block.key}`)
          ?.style.setProperty('--pct', Math.round((loaded / total) * 100) + '%');
      });
      if (modelState !== downloadKey) return;
      modelState.buffers.set(block.key, buffer);

      document.getElementById(`dl-${block.key}`)?.classList.add('done');
      doneCount++;
      document.getElementById('arome-dl-status').textContent =
        `Downloading… ${doneCount} / ${resources.length} blocks`;

      if (!legendInitialized) {
        legendInitialized = true;
        for (const msg of iterateGRIB2Messages(buffer)) {
          if (msg.product?.shortName === modelState.variable) {
            modelState.lastRunInfo = `${packageKey} · run ${fmtRefTime(msg.header)}`;
            applyDefaultPalette(modelState.variable);
            updateParamInfo(msg.product.name, PARAM_DESCRIPTIONS[modelState.variable] ?? '', modelState.lastRunInfo);
            const staticScale = STATIC_SCALES[modelState.variable];
            const varDef = pkgVars.find(v => v.shortName === modelState.variable);
            if (staticScale && varDef) showColorScale(staticScale.min, staticScale.max, displayUnitsFor(modelState.variable, varDef.units));
            break;
          }
        }
      }

      // Render map on first block arrival if the slider points into this block
      const currentIdx = parseInt(slider.value, 10);
      const currentHour = modelState.hourList[currentIdx];
      if (currentHour !== undefined && currentHour >= block.startHour && currentHour <= block.endHour && !gridState) {
        showHour(currentIdx);
      }
    }),
  );
}
```

- [ ] **Step 2: Update the call site in `route()` (line ~1113)**

```js
// Before: startAromeDownload(packageKey)
// After:  startDownload(packageKey)
```

Also update the guard condition:
```js
// Before: if (aromeState?.packageKey !== packageKey)
// After:  if (modelState?.packageKey !== packageKey)
```

---

## Task 10: Update aromeShowHour → showHour

**Files:** Modify `apps/visualize/index.js` — update `aromeShowHour` (lines 826–947)

Key changes:
- Function renamed to `showHour`
- `const { hour } = resources[idx]` → `const hour = modelState.hourList[idx]`
- Map bounds from `pkg.bounds`
- `aromeState.currentHour` → `modelState.currentHour`
- `aromeState.lastRunInfo` / `aromeState.packageKey` etc. → `modelState.*`

- [ ] **Step 1: Rename function and update hour lookup**

```js
async function showHour(idx) {
  if (isDecoding) { pendingHourIdx = idx; return; }
  isDecoding = true;
  pendingHourIdx = null;
  try {
    const hour = modelState.hourList[idx];
    document.getElementById('arome-hour-label').textContent = fmtHourLabel(hour);

    const data = await getCachedDecode(hour);
    if (!data) { clearMapLayer(); return; }

    modelState.currentHour = hour;
    const { values, grid, product, header } = data;

    const isAccumulation = product.pdtNumber === 8;
    let displayValues = values;
    let isFallback = false;

    if (isAccumulation && idx > 0) {
      const prevHour = modelState.hourList[idx - 1];
      const prevValues = await decodePrevHourValues(prevHour);
      if (prevValues !== null) {
        const diff = new Float64Array(values.length);
        for (let i = 0; i < values.length; i++) {
          diff[i] = (values[i] <= MISSING_VALUE || prevValues[i] <= MISSING_VALUE)
            ? MISSING_VALUE
            : Math.max(0, values[i] - prevValues[i]);
        }
        displayValues = diff;
      } else {
        isFallback = true;
      }
    }

    if (product.shortName === 't') displayValues = applyToValues(displayValues, v => v - 273.15);
    else if (product.shortName === 'p') displayValues = applyToValues(displayValues, v => v / 100);

    const { min: dataMin, max: dataMax, mean, count } = computeStats(displayValues);
    let displayUnits = displayUnitsFor(product.shortName, product.units);
    if (isAccumulation && !isFallback) displayUnits = 'mm/h';
    const staticScale = STATIC_SCALES[product.shortName] ?? null;
    const renderMin = staticScale ? staticScale.min : dataMin;
    const renderMax = staticScale ? staticScale.max : dataMax;
    const range = renderMax - renderMin || 1;
    gridState = { values: displayValues, min: renderMin, range, grid, product, displayUnits, staticScale };

    const pkg = PACKAGES[modelState.packageKey];
    modelState.lastRunInfo = `${modelState.packageKey} · run ${fmtRefTime(header)}`;
    updateParamInfo(
      product.name,
      PARAM_DESCRIPTIONS[product.shortName] ?? '',
      modelState.lastRunInfo + (isFallback ? ' · (cumulative — prev not loaded)' : ''),
    );

    const needH = mercatorCanvasHeight(grid);
    const canvasChanged = !heatCanvas || heatCanvas.width !== grid.ni || heatCanvas.height !== needH;
    if (canvasChanged) {
      heatCanvas = document.createElement('canvas');
      heatCanvas.width = grid.ni;
      heatCanvas.height = needH;
    }
    renderHeatmap();

    const corners = gridCorners(grid);
    await initMap([pkg.bounds, { padding: 20, animate: false }]);
    if (!map.getSource('grib2') || canvasChanged) setMapLayer(heatCanvas, corners);
    updateStats(dataMin, dataMax, mean, count, displayUnits);
    showColorScale(renderMin, renderMax, displayUnits);
    const validTimeProduct = isAccumulation ? { ...product, forecastTime: hour, timeUnit: 1 } : product;
    document.getElementById('arome-valid-time').textContent = `Forecast time: ${fmtValidTime(header, validTimeProduct)}`;
  } catch (err) {
    console.error('showHour:', err);
    clearMapLayer();
  } finally {
    isDecoding = false;
    if (pendingHourIdx !== null) {
      const next = pendingHourIdx;
      pendingHourIdx = null;
      showHour(next);
    }
  }
}
```

- [ ] **Step 2: Update the two call sites that used `aromeShowHour`**

In `startDownload` (Task 9, already updated to `showHour`). ✓

In the var-change event listener (lines ~1205–1206):
```js
// Before: aromeShowHour(idx);
// After:  showHour(idx);
```

In the slider event listener (lines ~1212):
```js
// Before: aromeShowHour(parseInt(aromeSlider.value, 10));
// After:  showHour(parseInt(aromeSlider.value, 10));
```

---

## Task 11: Update route() and var-change event

**Files:** Modify `apps/visualize/index.js`

- [ ] **Step 1: Update route() hash handling**

The route already reads `const packageKey = hash.slice(7)` from `#arome/AROME_SP1`. The PACKAGES keys are now `AROME_SP1`, `AROME_SP2`, `ARPEGE_SP1`. The guard `if (!PACKAGES[packageKey])` already handles unknown keys correctly.

Update the `resetModelState()` call:
```js
} else if (hash.startsWith('#arome/')) {
  const packageKey = hash.slice(7);
  if (!PACKAGES[packageKey]) { location.hash = ''; return; }
  showView('view-grid');
  setToolbarMode('arome');
  document.getElementById('arome-dl-panel').style.display = 'block';
  if (modelState?.packageKey !== packageKey) {
    resetModelState();
    startDownload(packageKey);
  }
}
```

- [ ] **Step 2: Update var-change event listener**

```js
document.getElementById('arome-var-select').addEventListener('change', (e) => {
  if (!modelState) return;
  const shortName = e.target.value;
  modelState.variable = shortName;
  applyDefaultPalette(shortName);
  modelState.decoded.clear();
  modelState.decodedOrder = [];

  const varDef = PACKAGES[modelState.packageKey].variables.find(v => v.shortName === shortName);
  if (varDef) {
    updateParamInfo(varDef.name, PARAM_DESCRIPTIONS[shortName] ?? '', modelState.lastRunInfo ?? modelState.packageKey);
  }

  const idx = parseInt(document.getElementById('arome-slider').value, 10);
  showHour(idx);
});
```

- [ ] **Step 3: Update arome-back-btn listener**

```js
document.getElementById('arome-back-btn').addEventListener('click', resetApp);
```

`resetApp` calls `resetModelState()` — verify it does (Task 6 renamed it).

---

## Task 12: Full manual test

**Files:** none — verification only

- [ ] **Step 1: Start the dev server**

```bash
npm run serve
# http://localhost:3000/apps/visualize/
```

- [ ] **Step 2: AROME non-regression**

- Homepage shows two groups: AROME (SP1, SP2) and ARPEGE (SP1)
- Click AROME SP1 → downloads ~60 files, slider works, temperature renders on France map
- Change variable → re-renders correctly
- Click AROME SP2 → downloads new package, precipitation variables work
- Back button → returns to home, state is reset

- [ ] **Step 3: ARPEGE SP1 test**

- Click ARPEGE SP1 → `#arome/ARPEGE_SP1` in URL
- Status shows "Fetching file list…" then "Downloading N block(s)…"
- Progress bars appear labeled `H+0–12`, `H+13–24`, etc.
- Slider max = `hourList.length - 1` (should be 102 if hours 0–102)
- First block downloads (~78 MB) → first hour renders on world map
- Move slider within first block → renders without re-download
- Move slider to hour 13+ → triggers second block download
- Map is centered on world bounds (not AROME France domain)

- [ ] **Step 4: Commit**

```bash
git add apps/visualize/index.js apps/visualize/index.html
git commit -m "feat: add ARPEGE 0.1° support — generalize model download to multi-hour blocks"
```

---

## Task 13: Update docs/frontend.md

**Files:** Modify `docs/frontend.md`

- [ ] **Step 1: Update the In-memory state section**

Replace `aromeState` with `modelState` and update the comment:

```js
let modelState = null; // { packageKey, resources, hourList, buffers, messageIndex,
                       //   decoded, decodedOrder, variable, currentHour, lastRunInfo }
```

- [ ] **Step 2: Update PACKAGES description**

In the "AROME online" section, update to reflect the new structure: each package now has `model`, `provider`, `datasetId`, `titlePattern`, `bounds`, `variables`. Mention ARPEGE_SP1 as a new package.

- [ ] **Step 3: Update function name references**

`fetchAromeResources` → `fetchDataGouvResources(datasetId, titlePattern)`
`startAromeDownload` → `startDownload`
`aromeShowHour` → `showHour`
`resetAromeState` → `resetModelState`

- [ ] **Step 4: Commit**

```bash
git add docs/frontend.md
git commit -m "docs: update frontend.md for ARPEGE integration and renamed functions"
```
