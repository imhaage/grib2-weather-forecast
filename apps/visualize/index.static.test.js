import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const source = readFileSync(new URL("./index.js", import.meta.url), "utf8");
const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const renderWorker = readFileSync(new URL("./render-worker.js", import.meta.url), "utf8");
const unitTransforms = readFileSync(new URL("./unit-transforms.js", import.meta.url), "utf8");

test("visualizer DOM references and repeated UI ids are centralized", () => {
  assert.match(
    source,
    /const dom = \{/,
    "expected shared DOM references to have a single home before larger UI refactors",
  );
  assert.match(
    source,
    /const STAT_VALUE_IDS = \[\s*"gv-min",\s*"gv-max",\s*"gv-mean",\s*"gv-valid",\s*\];/,
    "expected repeated stat ids to be centralized",
  );
  assert.match(
    source,
    /function setPaletteSelectValues\(palette\)/,
    "expected palette select synchronization to be handled by one helper",
  );
});

test("model block statuses are centralized and use clear cache wording", () => {
  assert.match(
    source,
    /const BLOCK_STATUS = Object\.freeze\(\{[\s\S]*LOADED_FROM_CACHE: "loaded-from-cache"[\s\S]*\}\);/,
    "expected block status strings to be centralized with loaded-from-cache wording",
  );
  assert.doesNotMatch(
    source,
    /cached-stale/,
    "expected stale cache wording not to leak into state names or CSS classes",
  );
  assert.match(
    source,
    /BLOCK_STATUS_LABELS\[BLOCK_STATUS\.LOADED_FROM_CACHE\]/,
    "expected UI text to be driven by status labels",
  );
});

test("map rendering pipeline has shared frame helpers", () => {
  assert.match(
    source,
    /function ensureHeatCanvas\(grid\)/,
    "expected canvas sizing to be shared across uploaded and model rendering",
  );
  assert.match(
    source,
    /function drawBitmapToHeatCanvas\(bitmap\)/,
    "expected bitmap drawing to be shared instead of duplicated per view",
  );
  assert.match(
    source,
    /function updateStatsAndColorScale\(entry\)/,
    "expected stats and legend updates to use one shared helper",
  );
});

test("model download startup is split into focused helpers", () => {
  assert.match(
    source,
    /function createModelState\(packageKey\)/,
    "expected model state creation to be isolated from download orchestration",
  );
  assert.match(
    source,
    /function configureModelVariableControls\(pkg\)/,
    "expected variable select setup to be isolated from download orchestration",
  );
  assert.match(
    source,
    /function buildHourList\(resources\)/,
    "expected hour-list expansion to be isolated from download orchestration",
  );
  assert.match(
    source,
    /function renderDownloadItems\(resources\)/,
    "expected download item DOM rendering to be isolated from download orchestration",
  );
  assert.match(
    source,
    /async function startDownload\(packageKey\) \{[\s\S]*modelState = createModelState\(packageKey\);[\s\S]*configureModelVariableControls\(pkg\);[\s\S]*modelState\.hourList = buildHourList\(resources\);[\s\S]*renderDownloadItems\(resources\);/,
    "expected startDownload to orchestrate the extracted startup helpers",
  );
});

test("model block loading through cache and network is isolated", () => {
  assert.match(
    source,
    /async function loadModelBlockWithCache\(packageKey, block, downloadKey, onAvailable\)/,
    "expected per-block cache/network loading to be isolated from startDownload",
  );
  assert.match(
    source,
    /await loadModelBlockWithCache\(packageKey, block, downloadKey, async \(block, buffer, status\) => \{[\s\S]*await presentAvailableModelBlock\(block, buffer, status, session\);[\s\S]*\}\);/,
    "expected startDownload concurrency worker to delegate per-block loading",
  );
  assert.match(
    source,
    /async function loadModelBlockWithCache\(packageKey, block, downloadKey, onAvailable\) \{[\s\S]*readCachedGribBlock\(packageKey, block\)[\s\S]*readLatestCachedGribBlock\(packageKey, block\)[\s\S]*downloadFileProg\(/,
    "expected the helper to keep exact cache, older cache, and network fallback in one flow",
  );
});

test("model block availability presentation is isolated", () => {
  assert.match(
    source,
    /function createModelDownloadSession\(\{ packageKey, pkg, resources, runSummary, downloadKey \}\)/,
    "expected model download presentation dependencies to be grouped in a session object",
  );
  assert.match(
    source,
    /async function presentAvailableModelBlock\(block, buffer, status, session\)/,
    "expected available block presentation to be isolated from startDownload",
  );
  assert.match(
    source,
    /await presentAvailableModelBlock\(block, buffer, status, session\);/,
    "expected startDownload to delegate available block presentation",
  );
  assert.match(
    source,
    /function createModelDownloadSession\(\{ packageKey, pkg, resources, runSummary, downloadKey \}\) \{[\s\S]*availableCount: 0,[\s\S]*legendInitialized: false,/,
    "expected availability counters and legend state to live on the session object",
  );
});

test("model block availability presentation delegates focused responsibilities", () => {
  assert.match(
    source,
    /function storeAvailableModelBlock\(block, buffer, status, session\)/,
    "expected model buffer registration and cache invalidation to be isolated",
  );
  assert.match(
    source,
    /function initializeModelLegendFromBlock\(buffer, session\)/,
    "expected first-block legend initialization to be isolated",
  );
  assert.match(
    source,
    /async function refreshMapForAvailableModelBlock\(block, session\)/,
    "expected first/visible block map refresh to be isolated",
  );
  assert.match(
    source,
    /function completeModelDownloadIfReady\(session\)/,
    "expected download completion UI and pre-render scheduling to be isolated",
  );
  assert.match(
    source,
    /async function presentAvailableModelBlock\(block, buffer, status, session\) \{[\s\S]*storeAvailableModelBlock\(block, buffer, status, session\);[\s\S]*initializeModelLegendFromBlock\(buffer, session\);[\s\S]*await refreshMapForAvailableModelBlock\(block, session\);[\s\S]*completeModelDownloadIfReady\(session\);/,
    "expected available block presentation to read as orchestration",
  );
});

test("cached block updates reset download progress and refresh the changed bitmap cache", () => {
  assert.match(
    source,
    /function resetBlockDownloadProgress\(block\)/,
    "expected block download progress reset to be isolated",
  );
  assert.match(
    source,
    /setBlockStatus\(block, BLOCK_STATUS\.DOWNLOADING\);[\s\S]*resetBlockDownloadProgress\(block\);[\s\S]*const buffer = await downloadFileProg/,
    "expected stale cached blocks to switch from 100% violet to a fresh blue progress bar",
  );
  assert.match(
    source,
    /function queueUpdatedBlockPrerender\(block, status\)/,
    "expected fresh network updates to schedule only the changed block for bitmap refresh",
  );
  assert.match(
    source,
    /async function presentAvailableModelBlock\(block, buffer, status, session\) \{[\s\S]*await refreshMapForAvailableModelBlock\(block, session\);[\s\S]*queueUpdatedBlockPrerender\(block, status\);/,
    "expected new downloaded blocks to update visible map first, then refresh animation cache for that block",
  );
});

test("model map scene appears after the first available downloaded or cached file", () => {
  assert.match(
    source,
    /function setMapSceneVisible\(/,
    "expected a dedicated map scene visibility helper",
  );
  assert.match(
    source,
    /setMapSceneVisible\(false\)[\s\S]*const downloadKey = modelState/,
    "expected startDownload to hide the map scene before download work begins",
  );
  assert.match(
    source,
    /availableCount: 0,/,
    "expected progressive availability to be tracked independently from download completion",
  );
  assert.match(
    source,
    /async function presentAvailableModelBlock\(block, buffer, status, session\)/,
    "expected one shared path for cached and downloaded blocks becoming available",
  );
  assert.match(
    source,
    /if \(session\.availableCount === 1\) \{[\s\S]*setMapSceneVisible\(true\)/,
    "expected the map scene to appear as soon as the first block is available",
  );
  assert.match(
    source,
    /showUnavailableHour\(hour\)/,
    "expected unavailable slider hours to clear the heatmap instead of keeping stale pixels",
  );
  assert.match(
    html,
    /id="map-unavailable" hidden[\s\S]*Data not available yet/,
    "expected unavailable data to be shown as an overlay above the map",
  );
  assert.match(
    source,
    /function fmtUnavailableValidTime\(hour\)/,
    "expected unavailable hours to still display a forecast date and time",
  );
  assert.match(
    source,
    /document\.getElementById\("arome-valid-time"\)\.textContent =\s*`Forecast time: \$\{fmtUnavailableValidTime\(hour\)\}`;/,
    "expected unavailable state not to replace the forecast time with the warning text",
  );
});

test("model pre-rendering is scheduled through a single queue", () => {
  assert.match(
    source,
    /let prerenderQueue = \[\];/,
    "expected explicit queue state",
  );
  assert.match(
    source,
    /async function drainPrerenderQueue\(/,
    "expected a single queue drain loop",
  );
  assert.doesNotMatch(
    source,
    /Promise\.all\(\s*\[\.\.\.modelState\.buffers\.keys\(\)\]\.map\(k => prerenderBlock\(k\)\)\s*\)/,
    "expected no global parallel pre-render after palette or variable changes",
  );
  assert.match(
    source,
    /queuePrerenderForAllBlocks\(\);/,
    "expected callers to enqueue all blocks instead of rendering them directly",
  );
});

test("model visual refresh after palette or variable changes is shared", () => {
  assert.match(
    source,
    /async function refreshCurrentModelVisuals\(\{ clearDecoded = false \} = \{\}\)/,
    "expected palette and variable changes to share the same expensive refresh path",
  );
  assert.match(
    source,
    /if \(clearDecoded\) \{[\s\S]*modelState\.decoded\.clear\(\);[\s\S]*modelState\.decodedOrder = \[\];[\s\S]*\}/,
    "expected decoded cache clearing to be explicit and optional",
  );
  assert.match(
    source,
    /async function onPaletteChange\(e\) \{[\s\S]*await refreshCurrentModelVisuals\(\);/,
    "expected palette changes to use the shared model refresh helper",
  );
  assert.match(
    source,
    /addEventListener\("change", async \(e\) => \{[\s\S]*await refreshCurrentModelVisuals\(\{ clearDecoded: true \}\);/,
    "expected variable changes to use the shared model refresh helper and clear decoded values",
  );
});

test("unit conversion rules are shared between the main thread and render worker", () => {
  assert.match(
    source,
    /import \{[\s\S]*displayUnitsFor,[\s\S]*unitFnFor,[\s\S]*unitTransformFor,[\s\S]*\} from "\.\/unit-transforms\.js";/,
    "expected main thread unit conversion helpers to come from the shared module",
  );
  assert.match(
    source,
    /new Worker\(\s*new URL\("\.\/render-worker\.js", import\.meta\.url\),\s*\{ type: "module" \},\s*\)/,
    "expected render worker to load as a module so it can share unit transforms",
  );
  assert.match(
    renderWorker,
    /import \{ applyUnitTransform \} from "\.\/unit-transforms\.js";/,
    "expected render worker unit conversion to come from the shared module",
  );
  assert.match(
    unitTransforms,
    /const UNIT_TRANSFORMS = Object\.freeze\(\{[\s\S]*displayUnits: "°C"[\s\S]*apply: \(value\) => value - 273\.15[\s\S]*displayUnits: "km\/h"[\s\S]*apply: \(value\) => value \* 3\.6/,
    "expected shared unit transform definitions to include display units and conversion logic",
  );
});

test("home model list rendering is split into focused builders", () => {
  assert.match(
    source,
    /function groupPackagesByModel\(packages\)/,
    "expected model package grouping to be isolated",
  );
  assert.match(
    source,
    /function createModelMetaElement\(info\)/,
    "expected model metadata DOM creation to be isolated",
  );
  assert.match(
    source,
    /function createModelPackageElement\(key, pkg\)/,
    "expected model package DOM creation to be isolated",
  );
  assert.match(
    source,
    /function renderModelList\(\)/,
    "expected model list rendering to have a named entry point",
  );
  assert.match(
    source,
    /renderModelList\(\);[\s\S]*window\.addEventListener\("hashchange", route\);/,
    "expected startup to call the named model list renderer",
  );
});

test("variable metadata access uses shared helpers", () => {
  assert.match(
    source,
    /function variableKeyFor\(varDef\)/,
    "expected variable key resolution to be centralized",
  );
  assert.match(
    source,
    /function findPackageVariable\(packageKey, key\)/,
    "expected package variable lookup to be centralized",
  );
  assert.match(
    source,
    /function parameterDescriptionFor\(shortName\)/,
    "expected parameter description fallback to be centralized",
  );
  assert.doesNotMatch(
    source,
    /\(v\) => \(v\.varKey \?\? v\.shortName\) ===/,
    "expected repeated inline variable-key comparisons to be replaced",
  );
});

test("decoded value cache is limited to current and adjacent working fields", () => {
  assert.match(
    source,
    /const DECODED_CACHE_SIZE = 2;/,
    "expected decoded Float64Array cache to stay small while bitmap cache handles playback",
  );
});

test("message index stores block offsets instead of copied message buffers", () => {
  assert.match(
    source,
    /function messageViewFromRef\(/,
    "expected message references to be resolved into views only at decode time",
  );
  assert.match(
    source,
    /index\.set\(`\$\{ft\}_\$\{product\.shortName\}_\$\{product\.levelValue\}`, messageRef\);/,
    "expected indexed messages to store a lightweight reference",
  );
  assert.doesNotMatch(
    source,
    /index\.set\([^;]+msg\.buffer\)/,
    "expected messageIndex not to retain message buffer copies",
  );
});

test("worker rendering can transfer owned values without cloning", () => {
  assert.match(
    source,
    /function renderViaWorker\(values, renderParams, outW, outH, \{ transferValues = false \} = \{\}\)/,
    "expected renderViaWorker to expose explicit transfer ownership",
  );
  assert.match(
    source,
    /const workerValues = transferValues \? values : values\.slice\(\);/,
    "expected values.slice() only when ownership is not transferred",
  );
  assert.match(
    source,
    /transferValues: canTransferValues/,
    "expected background pre-rendering to opt into transfer when safe",
  );
});

test("model display values use Float32Array instead of retaining Float64Array precision", () => {
  assert.match(
    source,
    /function toDisplayValues\(values\)/,
    "expected a dedicated display-value conversion helper",
  );
  assert.match(
    source,
    /const out = new Float32Array\(values\.length\);/,
    "expected model display values to be downcast to Float32Array",
  );
  assert.match(
    source,
    /const diff = new Float32Array\(values\.length\);/,
    "expected accumulation diffs to be allocated as Float32Array",
  );
  assert.match(
    source,
    /values: toDisplayValues\(values\),/,
    "expected render params to expose Float32Array display values",
  );
});

test("cached bitmaps are shown before decoding values for the same hour", () => {
  assert.match(
    source,
    /function bitmapCacheKey\(hour\)/,
    "expected a stable cache key helper independent from decoded render params",
  );
  assert.match(
    source,
    /const cachedEntry = bitmapCache\.get\(cacheKey\);[\s\S]*if \(cachedEntry\) \{[\s\S]*return;[\s\S]*const data = await getCachedDecode\(hour\);/,
    "expected showHour to use cached bitmaps before decoding values",
  );
  assert.match(
    source,
    /makeGridState\(entry, values \?\? null\)/,
    "expected cached bitmap hits to avoid retaining decoded values for tooltips",
  );
});

test("cached bitmap hits hydrate tooltip values lazily after presentation", () => {
  assert.match(
    source,
    /let tooltipHydrateTimer = null;/,
    "expected tooltip hydration to be debounced independently from rendering",
  );
  assert.match(
    source,
    /function queueTooltipValueHydration\(idx, hour\)/,
    "expected cached frames to schedule tooltip values separately",
  );
  assert.match(
    source,
    /await presentBitmapEntry\(hour, cachedEntry\);[\s\S]*queueTooltipValueHydration\(idx, hour\);[\s\S]*return;/,
    "expected cached frames to paint before scheduling tooltip value decode",
  );
  assert.match(
    source,
    /if \(playerInterval !== null\) return;/,
    "expected animation playback not to trigger tooltip value decoding",
  );
  assert.match(
    source,
    /function queueCurrentTooltipValueHydration\(\)/,
    "expected a helper to hydrate the visible frame after playback stops",
  );
  assert.match(
    source,
    /setPlaying\(false\);[\s\S]*queueCurrentTooltipValueHydration\(\);/,
    "expected stopping playback to restore tooltip values for the visible frame",
  );
});

test("CAPE keeps zero values visible in the static color scale", () => {
  assert.doesNotMatch(
    source,
    /cape:\s*\{[^}]*zeroThreshold/,
    "expected CAPE zero values to remain visible instead of transparent",
  );
});

test("player warms the bitmap cache before starting animation", () => {
  assert.match(
    html,
    /id="arome-slider-wrap"[\s\S]*id="cache-warmup"[\s\S]*id="map-wrap"/,
    "expected a visible cache warm-up indicator between the slider and map",
  );
  assert.match(
    source,
    /function updateWarmupProgress\(/,
    "expected warm-up progress to be rendered from bitmap cache state",
  );
  assert.match(
    source,
    /async function warmUpBitmapCacheForAnimation\(/,
    "expected Play to warm the bitmap cache before animation",
  );
  assert.match(
    source,
    /queuePrerenderForAllBlocks\(\);[\s\S]*await waitForPrerenderIdle\(\);/,
    "expected warm-up to wait for the pre-render queue",
  );
  assert.match(
    source,
    /await warmUpBitmapCacheForAnimation\(\);[\s\S]*startPlayer\(\);/,
    "expected Play to start only after cache warm-up completes",
  );
});

test("palette and variable changes stop playback before invalidating bitmap cache", () => {
  assert.match(
    source,
    /async function refreshCurrentModelVisuals\(\{ clearDecoded = false \} = \{\}\) \{[\s\S]*stopPlayer\(\);[\s\S]*invalidateBitmapCache\(\);/,
    "expected shared model visual refresh to stop animation before cache invalidation",
  );
  assert.match(
    source,
    /async function onPaletteChange\(e\) \{[\s\S]*await refreshCurrentModelVisuals\(\);/,
    "expected palette changes to use the shared refresh path",
  );
  assert.match(
    source,
    /\.getElementById\("arome-var-select"\)[\s\S]*\.addEventListener\("change", async \(e\) => \{[\s\S]*await refreshCurrentModelVisuals\(\{ clearDecoded: true \}\);/,
    "expected variable changes to use the shared refresh path",
  );
});

test("map clicks show a thin cross marker for mobile tooltip location", () => {
  assert.match(
    source,
    /let mapClickMarker = null;/,
    "expected the clicked location to be tracked with a MapLibre marker",
  );
  assert.match(
    source,
    /new maplibregl\.Marker\(\{ element, anchor: "center" \}\)/,
    "expected the click marker to stay anchored to clicked map coordinates",
  );
  assert.match(
    source,
    /function shouldShowMapClickMarker\(event\)/,
    "expected click markers to be limited to touch-style interactions",
  );
  assert.match(
    source,
    /event\.pointerType === "touch"[\s\S]*matchMedia\("\(pointer: coarse\)"\)\.matches/,
    "expected touch pointers and coarse pointers to request a click marker",
  );
  assert.match(
    source,
    /map\.on\("click", \(e\) => \{[\s\S]*if \(shouldShowMapClickMarker\(e\.originalEvent\)\) showMapClickMarker\(e\.lngLat\);[\s\S]*showTooltipForMapEvent\(e\);[\s\S]*\}\);/,
    "expected map clicks to place the marker only when the input needs it",
  );
});

test("uploaded file view uses the worker render pipeline for stats and bitmap", () => {
  assert.match(
    source,
    /async function showGridView\(shortName\) \{[\s\S]*const p = makeRenderParams\(decoded\);[\s\S]*const \{ outH \} = ensureHeatCanvas\(gr\);[\s\S]*const statsEntry = await renderViaWorker\(p\.values, p, gr\.ni, outH\);/,
    "expected uploaded-file rendering to use renderViaWorker",
  );
  assert.doesNotMatch(
    source,
    /async function showGridView\(shortName\) \{[\s\S]*computeStats\(values\);/,
    "expected uploaded-file stats to come from the worker",
  );
  assert.doesNotMatch(
    source,
    /async function showGridView\(shortName\) \{[\s\S]*renderHeatmap\(\);/,
    "expected uploaded-file bitmap rendering to come from the worker",
  );
});

test("perf diagnostics are available only through the debug query flag", () => {
  assert.match(
    html,
    /id="perf-debug" hidden[\s\S]*id="perf-debug-render"[\s\S]*id="perf-debug-decode"[\s\S]*id="perf-debug-queue"/,
    "expected a hidden perf diagnostics panel in the map scene",
  );
  assert.match(
    source,
    /const PERF_DEBUG = new URLSearchParams\(window\.location\.search\)\.get\("debug"\) === "perf";/,
    "expected perf diagnostics to be gated by ?debug=perf",
  );
  assert.match(
    source,
    /function updatePerfDiagnostics\(/,
    "expected a central diagnostics renderer",
  );
  assert.match(
    source,
    /bitmapCache\.size[\s\S]*modelState\?\.decoded\?\.size[\s\S]*prerenderQueue\.length/,
    "expected diagnostics to include bitmap, decoded, and queue sizes",
  );
  assert.match(
    source,
    /performance\.now\(\)[\s\S]*lastRenderMs/,
    "expected worker render timing to be measured",
  );
  assert.match(
    source,
    /performance\.now\(\)[\s\S]*lastDecodeMs/,
    "expected decode timing to be measured",
  );
});

test("model file downloads are limited to six parallel fetches", () => {
  assert.match(
    source,
    /const MAX_PARALLEL_DOWNLOADS = 6;/,
    "expected model downloads to declare the current concurrency limit",
  );
  assert.match(
    source,
    /async function runWithConcurrency\(items, limit, worker\)/,
    "expected a reusable concurrency helper",
  );
  assert.match(
    source,
    /await runWithConcurrency\(\s*resources,\s*MAX_PARALLEL_DOWNLOADS,\s*async \(block\) =>/,
    "expected startDownload to use the concurrency-limited queue",
  );
  assert.doesNotMatch(
    source,
    /await Promise\.all\(\s*resources\.map\(async \(block\) =>/,
    "expected startDownload not to fetch all resources in parallel",
  );
});

test("downloaded GRIB2 blocks are cached in IndexedDB by file run", () => {
  assert.match(
    source,
    /const GRIB_BLOCK_STORE = "gribBlocks";/,
    "expected a dedicated IndexedDB store for downloaded GRIB2 blocks",
  );
  assert.match(
    source,
    /function extractRunId\(/,
    "expected each remote resource to expose its run id",
  );
  assert.match(
    source,
    /const runId = extractRunId\(`\$\{r\.title\} \$\{r\.url\}`\);/,
    "expected data.gouv resources to carry a per-file run id",
  );
  assert.match(
    source,
    /function gribBlockCacheKey\(packageKey, block\)/,
    "expected cache keys to be derived from package, block, and run metadata",
  );
  assert.match(
    source,
    /createIndex\("byPackageBlock", \["packageKey", "blockKey"\]\)/,
    "expected an index for deleting obsolete versions of one logical file",
  );
  assert.match(
    source,
    /const cachedBuffer = await readCachedGribBlock\(packageKey, block\);[\s\S]*if \(cachedBuffer\) \{[\s\S]*return;[\s\S]*const buffer = await downloadFileProg/,
    "expected IndexedDB reads before falling back to network",
  );
  assert.match(
    source,
    /if \(cachedBuffer\) \{[\s\S]*await onAvailable\(block, cachedBuffer, BLOCK_STATUS\.LOADED_FROM_CACHE\);[\s\S]*return;/,
    "expected exact cache hits to count as loaded from cache in the data status summary",
  );
  assert.match(
    source,
    /await writeCachedGribBlock\(packageKey, block, buffer\);/,
    "expected downloaded misses to be written to IndexedDB",
  );
  assert.match(
    source,
    /async function deleteObsoleteCachedGribBlocks\(db, packageKey, block\)[\s\S]*cursor\.value\.id !== currentId[\s\S]*cursor\.delete\(\)/,
    "expected old runs for the same package/block to be removed after replacement",
  );
  assert.match(
    source,
    /formatRunSummary\(resources\)/,
    "expected the UI to expose whether the listed files come from one run or mixed runs",
  );
});

test("stale cached files can be displayed while newer remote files download", () => {
  assert.match(
    source,
    /async function readLatestCachedGribBlock\(packageKey, block\)/,
    "expected a fallback lookup for older cached versions of the same logical file",
  );
  assert.match(
    source,
    /const staleCachedBlock = await readLatestCachedGribBlock\(packageKey, block\);[\s\S]*await onAvailable\(block, staleCachedBlock\.buffer, BLOCK_STATUS\.LOADED_FROM_CACHE\);[\s\S]*const buffer = await downloadFileProg/,
    "expected stale cache to be presented before downloading the latest file",
  );
  assert.match(
    source,
    /onAvailable\(block, staleCachedBlock\.buffer, BLOCK_STATUS\.LOADED_FROM_CACHE\)/,
    "expected cache-loaded status to be visible in the data status panel",
  );
  assert.match(
    source,
    /setBlockStatus\(block, BLOCK_STATUS\.DOWNLOADING\)/,
    "expected newer downloads to remain visible while stale data is displayed",
  );
  assert.match(
    source,
    /onAvailable\(block, buffer, BLOCK_STATUS\.READY\)/,
    "expected freshly downloaded files to replace stale status",
  );
  assert.match(
    html,
    /id="data-status-panel"[\s\S]*id="data-status-summary"[\s\S]*id="clear-grib-cache"/,
    "expected a collapsible data/cache status panel with cache controls",
  );
});
