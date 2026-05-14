import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const source = readFileSync(new URL("./index.js", import.meta.url), "utf8");
const html = readFileSync(new URL("./index.html", import.meta.url), "utf8");
const css = readFileSync(new URL("./style.css", import.meta.url), "utf8");
const animationPlayer = readFileSync(new URL("./animation-player.js", import.meta.url), "utf8");
const mapTooltip = readFileSync(new URL("./map-tooltip.js", import.meta.url), "utf8");
const renderWorker = readFileSync(new URL("./render-worker.js", import.meta.url), "utf8");
const modelBlockWorker = readFileSync(new URL("./model-block-worker.js", import.meta.url), "utf8");
const downloadWorker = readFileSync(new URL("./download-worker.js", import.meta.url), "utf8");
const unitTransforms = readFileSync(new URL("./unit-transforms.js", import.meta.url), "utf8");
const variableMetadata = readFileSync(new URL("./variable-metadata.js", import.meta.url), "utf8");

function sourceFunctionBody(name) {
  const match = source.match(new RegExp(`function ${name}\\([^)]*\\) \\{[\\s\\S]*?\\n\\}`));
  return match?.[0] ?? "";
}

test("app header exposes the project title and GitHub link", () => {
  assert.match(
    html,
    /<title>GRIB2 Weather forecast<\/title>/,
    "expected the browser title to use the current app name",
  );
  assert.match(
    html,
    /<h1>GRIB2 Weather forecast<\/h1>/,
    "expected the visible app title to use the current app name",
  );
  assert.doesNotMatch(
    html,
    /GRIB2 files decoded in the browser/,
    "expected the redundant app subtitle to be removed",
  );
  assert.match(
    html,
    /<a[\s\S]*class="github-link"[\s\S]*href="https:\/\/github\.com\/imhaage\/arome-forecast-visualizer"[\s\S]*aria-label="Open project repository on GitHub"[\s\S]*<svg/,
    "expected an icon-only GitHub repository link in the title bar",
  );
});

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
  assert.match(
    source,
    /get aromeDownloadStatus\(\) \{ return byId\("arome-dl-status"\); \}/,
    "expected model download status DOM access to be centralized",
  );
  assert.match(
    source,
    /get aromeVarSelect\(\) \{ return byId\("arome-var-select"\); \}/,
    "expected model variable select DOM access to be centralized",
  );
  assert.doesNotMatch(
    source,
    /document\.getElementById\("(arome-dl-status|arome-dl-bars|arome-dl-file-list|data-status-summary|arome-var-select)"\)/,
    "expected model download DOM ids to be accessed through dom getters",
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
    /async function loadCachedModelBlock\(packageKey, block, downloadKey, onAvailable\)/,
    "expected per-block cache loading to be isolated from startDownload",
  );
  assert.match(
    source,
    /async function refreshModelBlockFromNetwork\(packageKey, block, downloadKey, onAvailable\)/,
    "expected per-block network refreshes to be isolated from cache presentation",
  );
  assert.match(
    source,
    /async function loadCachedModelBlock\(packageKey, block, downloadKey, onAvailable\) \{[\s\S]*readCachedGribBlock\(packageKey, block\)[\s\S]*readLatestCachedGribBlock\(packageKey, block\)[\s\S]*CACHE_LOAD_RESULT\.MISSING/,
    "expected cache loading to present exact or stale cache before marking missing blocks for network download",
  );
  assert.match(
    source,
    /async function refreshModelBlockFromNetwork\(packageKey, block, downloadKey, onAvailable\) \{[\s\S]*setBlockStatus\(block, BLOCK_STATUS\.DOWNLOADING\)[\s\S]*downloadFileProg\(/,
    "expected network refreshes to start only in the network helper",
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
    /await enqueueAvailableModelBlockPresentation\(block, buffer, status, session\);/,
    "expected startDownload to delegate available block presentation through the integration queue",
  );
  assert.match(
    source,
    /function createModelDownloadSession\(\{ packageKey, pkg, resources, runSummary, downloadKey \}\) \{[\s\S]*availableCount: 0,[\s\S]*legendInitialized: false,/,
    "expected availability counters and legend state to live on the session object",
  );
});

test("model block availability presentation delegates focused responsibilities", () => {
  const completeDownloadFunction = sourceFunctionBody("completeModelDownloadIfReady");

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
    "expected download completion UI to be isolated",
  );
  assert.match(
    source,
    /async function presentAvailableModelBlock\(block, buffer, status, session\) \{[\s\S]*initializeModelLegendFromBlock\(buffer, session\);[\s\S]*await storeAvailableModelBlock\(block, buffer, status, session\);[\s\S]*await refreshMapForAvailableModelBlock\(block, session\);[\s\S]*completeModelDownloadIfReady\(session\);/,
    "expected available block presentation to read as orchestration",
  );
  assert.doesNotMatch(
    completeDownloadFunction,
    /queuePrerenderForAllBlocks\(\);/,
    "expected download completion not to start animation cache generation early",
  );
  assert.doesNotMatch(
    source,
    /function queueUpdatedBlockPrerender\(block, status\)/,
    "expected per-file network updates not to pre-render animation frames while downloads are still running",
  );
});

test("network block presentation is integrated one block at a time", () => {
  assert.match(
    source,
    /function scheduleLowPriorityWork\(/,
    "expected a helper for yielding to the browser before heavy block integration",
  );
  assert.match(
    source,
    /async function enqueueAvailableModelBlockPresentation\(block, buffer, status, session\)/,
    "expected downloaded blocks to enter a serialized integration queue",
  );
  assert.match(
    source,
    /while \(session\.presentationQueue\.length > 0\)[\s\S]*await scheduleLowPriorityWork\(\);[\s\S]*await presentAvailableModelBlock\(job\.block, job\.buffer, job\.status, job\.session\);/,
    "expected queued blocks to yield between each presentation",
  );
  assert.match(
    source,
    /presentationQueue: \[\],[\s\S]*isPresentingQueuedBlock: false,/,
    "expected presentation queue state to live on the download session",
  );
  assert.match(
    source,
    /refreshModelBlockFromNetwork\(packageKey, block, downloadKey, async \(block, buffer, status\) => \{[\s\S]*await enqueueAvailableModelBlockPresentation\(block, buffer, status, session\);/,
    "expected network refreshes to avoid presenting completed files immediately in parallel",
  );
});

test("model forecast block decoding and rendering runs in a dedicated worker", () => {
  assert.match(
    modelBlockWorker,
    /import \{[\s\S]*iterateGRIB2Messages,[\s\S]*decodeGRIB2,[\s\S]*\} from "\/packages\/grib2-decoder\/dist\/grib2-decoder\.js";/,
    "expected the model worker to import the decoder directly",
  );
  assert.match(
    modelBlockWorker,
    /const blockBuffers = new Map\(\);/,
    "expected model GRIB buffers to be owned by the model worker",
  );
  assert.match(
    modelBlockWorker,
    /case "storeBlock":[\s\S]*blockBuffers\.set\(blockKey, buffer\);/,
    "expected downloaded blocks to be transferred into worker storage",
  );
  assert.match(
    modelBlockWorker,
    /function renderHour\(data\)[\s\S]*decodeDisplayValues\(data\)[\s\S]*createImageBitmap[\s\S]*case "renderHour":[\s\S]*await renderHour\(data\);/,
    "expected model hour decode and bitmap generation to happen in the worker",
  );
  assert.match(
    source,
    /new Worker\(\s*new URL\("\.\/model-block-worker\.js", import\.meta\.url\),[\s\S]*\{ type: "module" \},/,
    "expected index.js to create the model block worker as a module worker",
  );
  assert.match(
    source,
    /async function storeModelBlockInWorker\(block, buffer\)[\s\S]*postModelBlockWorker\([\s\S]*type: "storeBlock"[\s\S]*buffer,[\s\S]*\],/,
    "expected model buffers to be transferred to the model worker after download/cache read",
  );
  assert.match(
    source,
    /function modelWorkerRequestForHour\(idx, hour, \{ includeValues = false \} = \{\}\)[\s\S]*type: "renderHour"[\s\S]*includeValues,[\s\S]*async function renderModelHourViaWorker\(idx, \{ includeValues = false \} = \{\}\)[\s\S]*postModelBlockWorker\(request,/,
    "expected model hour rendering to use the model worker pipeline",
  );
  assert.match(
    source,
    /async function prerenderBlock\(blockKey\)[\s\S]*await renderModelHourViaWorker\(idx\);[\s\S]*bitmapCache\.set\(cacheKey, makeBitmapCacheEntryFromWorker\(entry\)\);/,
    "expected background animation cache rendering to avoid main-thread GRIB decode",
  );
});

test("network file assembly runs in a dedicated download worker", () => {
  assert.match(
    downloadWorker,
    /const chunks = \[\];[\s\S]*const out = new Uint8Array\(total\);[\s\S]*self\.postMessage\(\{ callId, buffer: out\.buffer \}, \[out\.buffer\]\);/,
    "expected downloaded chunks to be assembled off the main thread and transferred back",
  );
  assert.match(
    source,
    /new Worker\(\s*new URL\("\.\/download-worker\.js", import\.meta\.url\),[\s\S]*\{ type: "module" \},/,
    "expected index.js to create a dedicated download worker",
  );
  assert.match(
    source,
    /async function downloadFileProg\(url, filesize, onProgress\)[\s\S]*downloadFileInWorker\(proxyUrl\(url\), filesize, onProgress\)/,
    "expected downloadFileProg to delegate network assembly to the worker",
  );
  assert.doesNotMatch(
    source,
    /async function downloadFileProg\(url, filesize, onProgress\)[\s\S]*const chunks = \[\];[\s\S]*new Uint8Array\(total\)/,
    "expected main-thread download code not to assemble chunk arrays",
  );
  assert.match(
    source,
    /const cacheBuffer = buffer\.byteOffset === 0 && buffer\.byteLength === buffer\.buffer\.byteLength[\s\S]*\? buffer\.buffer[\s\S]*: buffer\.buffer\.slice/,
    "expected IndexedDB writes to avoid an extra ArrayBuffer slice when the downloaded buffer is already exact",
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
  assert.doesNotMatch(
    source,
    /function queueUpdatedBlockPrerender\(block, status\)/,
    "expected fresh network updates not to schedule animation frames while downloads are still running",
  );
  assert.doesNotMatch(
    source,
    /async function presentAvailableModelBlock\(block, buffer, status, session\) \{[\s\S]*queueUpdatedBlockPrerender\(block, status\);/,
    "expected block presentation not to refresh animation cache one file at a time",
  );
  assert.match(
    source,
    /async function buildAnimationCacheAfterNetworkSettles\(session\)[\s\S]*queuePrerenderForAllBlocks\(\);[\s\S]*await waitForPrerenderIdle\(\);/,
    "expected animation cache generation to start after missing and stale network work has settled",
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
    variableMetadata,
    /export const VARIABLE_METADATA = Object\.freeze\(\{/,
    "expected shared variable metadata to have one pure module source of truth",
  );
  assert.match(
    source,
    /import \{[\s\S]*variableKeyFor,[\s\S]*\} from "\.\/variable-metadata\.js";/,
    "expected variable key resolution to be imported from the pure metadata module",
  );
  assert.match(
    source,
    /function findPackageVariable\(packageKey, key\)/,
    "expected package variable lookup to be centralized",
  );
  assert.match(
    variableMetadata,
    /function parameterDescriptionFor\(shortName\)/,
    "expected parameter description fallback to be centralized",
  );
  assert.match(
    variableMetadata,
    /function defaultPaletteFor\(shortName\)/,
    "expected default palette lookup to be centralized",
  );
  assert.match(
    variableMetadata,
    /function staticScaleFor\(shortName\)/,
    "expected static scale lookup to be centralized",
  );
  assert.doesNotMatch(
    source,
    /\(v\) => \(v\.varKey \?\? v\.shortName\) ===/,
    "expected repeated inline variable-key comparisons to be replaced",
  );
  assert.doesNotMatch(
    source,
    /const PARAM_DESCRIPTIONS = \{/,
    "expected parameter descriptions to move into VARIABLE_METADATA",
  );
  assert.doesNotMatch(
    source,
    /const VARIABLE_PALETTES = \{/,
    "expected variable palettes to move into VARIABLE_METADATA",
  );
  assert.doesNotMatch(
    source,
    /const STATIC_SCALES = \{/,
    "expected static scales to move into VARIABLE_METADATA",
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

test("uploaded-file worker rendering can transfer owned values without cloning", () => {
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
    /postModelBlockWorker\([\s\S]*type: "storeBlock"[\s\S]*\[buffer\.buffer\]/,
    "expected model rendering to transfer whole GRIB blocks to the model worker instead",
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
    /const cachedEntry = bitmapCache\.get\(cacheKey\);[\s\S]*if \(cachedEntry\) \{[\s\S]*return;[\s\S]*await renderModelHourViaWorker\(idx, \{ includeValues: true \}\);/,
    "expected showHour to use cached bitmaps before asking the model worker to render values",
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
    /if \(animationPlayer\.isPlaying\(\)\) return;/,
    "expected animation playback not to trigger tooltip value decoding",
  );
  assert.match(
    source,
    /function queueCurrentTooltipValueHydration\(\)/,
    "expected a helper to hydrate the visible frame after playback stops",
  );
  assert.match(
    animationPlayer,
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

test("player stays disabled until the deferred animation cache is generated", () => {
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
    animationPlayer,
    /playButton\.disabled = !isAnimationCacheReady;/,
    "expected Play to stay disabled until the animation cache is ready",
  );
  assert.match(
    animationPlayer,
    /const label = isAnimationCacheReady[\s\S]*: "Preparing animation cache";[\s\S]*playButton\.title = label;/,
    "expected disabled Play to explain that the animation cache is being prepared",
  );
  assert.doesNotMatch(
    animationPlayer,
    /warmUpBitmapCacheForAnimation/,
    "expected Play clicks not to trigger cache generation anymore",
  );
  assert.match(
    animationPlayer,
    /function syncPlayButtonAvailability\(\)[\s\S]*const isAnimationCacheReady = !modelState \|\| isAnimationCacheReadyForPlayback\(\);[\s\S]*const label = isAnimationCacheReady[\s\S]*\? playerInterval !== null[\s\S]*\? "Pause"[\s\S]*: "Play"/,
    "expected Play label to use the latched animation cache readiness state",
  );
  assert.match(
    source,
    /animationCacheStatus: "waiting",/,
    "expected model state to track the deferred animation cache phase",
  );
  assert.match(
    source,
    /function isAnimationCacheReadyForPlayback\(\)[\s\S]*modelState\.animationCacheStatus === "ready" && isBitmapCacheComplete\(\)/,
    "expected playback readiness only after the deferred cache generation is complete",
  );
  assert.match(
    source,
    /function updateWarmupProgress\([\s\S]*modelState\.animationCacheStatus === "waiting"[\s\S]*Preparing animation cache/,
    "expected the warm-up area to show a message before generation begins",
  );
  assert.match(
    source,
    /function updateWarmupProgress\([\s\S]*syncPlayButtonAvailability\(\);/,
    "expected cache progress updates to sync the Play button",
  );
  assert.match(
    source,
    /import \{ createAnimationPlayer \} from "\.\/animation-player\.js";/,
    "expected animation player behavior to live outside index.js",
  );
  assert.match(
    source,
    /const animationPlayer = createAnimationPlayer\(/,
    "expected index.js to wire an animation player controller",
  );
  assert.match(css, /#player-play:disabled/, "expected disabled Play to have lighter styling");
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
    /dom\.aromeVarSelect[\s\S]*\.addEventListener\("change", async \(e\) => \{[\s\S]*await refreshCurrentModelVisuals\(\{ clearDecoded: true \}\);/,
    "expected variable changes to use the shared refresh path",
  );
});

test("map clicks show a thin cross marker for mobile tooltip location", () => {
  assert.match(
    mapTooltip,
    /let mapClickMarker = null;/,
    "expected the clicked location to be tracked with a MapLibre marker",
  );
  assert.match(
    mapTooltip,
    /new maplibregl\.Marker\(\{ element, anchor: "center" \}\)/,
    "expected the click marker to stay anchored to clicked map coordinates",
  );
  assert.match(
    mapTooltip,
    /function shouldShowMapClickMarker\(event\)/,
    "expected click markers to be limited to touch-style interactions",
  );
  assert.match(
    mapTooltip,
    /event\.pointerType === "touch"[\s\S]*matchMedia\("\(pointer: coarse\)"\)\.matches/,
    "expected touch pointers and coarse pointers to request a click marker",
  );
  assert.match(
    mapTooltip,
    /map\.on\("click", \(e\) => \{[\s\S]*if \(shouldShowMapClickMarker\(e\.originalEvent\)\) showMapClickMarker\(e\.lngLat\);[\s\S]*showTooltipForMapEvent\(e\);[\s\S]*\}\);/,
    "expected map clicks to place the marker only when the input needs it",
  );
  assert.match(
    source,
    /import \{ setupMapTooltip \} from "\.\/map-tooltip\.js";/,
    "expected tooltip behavior to live outside index.js",
  );
  assert.match(
    source,
    /setupMapTooltip\(\{[\s\S]*getGridState: \(\) => gridState,[\s\S]*missingValue: MISSING_VALUE,/,
    "expected index.js to wire the map tooltip controller",
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
    /const GRIB_CACHE_DB_VERSION = 2;/,
    "expected IndexedDB schema upgrades to create the package/block lookup index for existing caches",
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
    /async function loadCachedModelBlock\(packageKey, block, downloadKey, onAvailable\)/,
    "expected cached model block loading to be isolated from network refreshes",
  );
  assert.match(
    source,
    /const cacheResults = await runWithConcurrency\([\s\S]*loadCachedModelBlock\(packageKey, block, downloadKey,[\s\S]*const missingBlocks = cacheResults[\s\S]*const blocksNeedingRefresh = cacheResults[\s\S]*await runWithConcurrency\(\s*missingBlocks,[\s\S]*await runWithConcurrency\(\s*blocksNeedingRefresh,[\s\S]*await buildAnimationCacheAfterNetworkSettles\(session\);/,
    "expected cached blocks to stay navigable while missing and stale network work finishes before animation generation",
  );
  assert.match(
    source,
    /function runTimeValue\(runId\)[\s\S]*Date\.parse\(runId\)/,
    "expected cache freshness to compare run dates explicitly",
  );
  assert.match(
    source,
    /function isUsableCachedGribBlock\(record, block\)[\s\S]*runTimeValue\(record\.runId\) >= runTimeValue\(block\.runId\)[\s\S]*hasCompatibleCachedGribBlockSize\(record, block\)/,
    "expected package/hour cache hits to be accepted only when the cached run is not older than remote",
  );
  assert.match(
    source,
    /findCachedGribBlock\([\s\S]*\(record\) => isUsableCachedGribBlock\(record, block\),/,
    "expected cache lookup to use package/hour freshness rather than URL identity",
  );
  assert.match(
    source,
    /if \(cachedBuffer\) \{[\s\S]*await onAvailable\(block, cachedBuffer, BLOCK_STATUS\.LOADED_FROM_CACHE\);[\s\S]*return \{ status: CACHE_LOAD_RESULT\.CURRENT, block \};/,
    "expected exact cache hits to count as loaded from cache in the data status summary",
  );
  assert.match(
    source,
    /const cacheWriteSucceeded = await writeCachedGribBlock\(packageKey, block, buffer\);/,
    "expected downloaded misses to report whether IndexedDB replacement is safe",
  );
  assert.match(
    source,
    /await onAvailable\(block, buffer, BLOCK_STATUS\.READY\);[\s\S]*if \(cacheWriteSucceeded\) await deleteObsoleteCachedGribBlocks\(packageKey, block\);/,
    "expected old cached files to be deleted only after the new block is available in memory",
  );
  assert.match(
    source,
    /async function deleteObsoleteCachedGribBlocks\(packageKey, block\)[\s\S]*cursor\.value\.id !== currentId[\s\S]*cursor\.delete\(\)/,
    "expected old runs for the same package/block to be removed after safe replacement",
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
    /function isOlderCachedGribBlock\(record, block\)[\s\S]*runTimeValue\(record\.runId\) < runTimeValue\(block\.runId\)[\s\S]*const staleCachedBlock = await readLatestCachedGribBlock\(packageKey, block\);[\s\S]*await onAvailable\(block, staleCachedBlock\.buffer, BLOCK_STATUS\.LOADED_FROM_CACHE\);/,
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

test("missing cached files are downloaded before stale cached files refresh", () => {
  assert.match(
    source,
    /const CACHE_LOAD_RESULT = Object\.freeze\(\{[\s\S]*CURRENT: "current"[\s\S]*STALE: "stale"[\s\S]*MISSING: "missing"[\s\S]*\}\);/,
    "expected cache loading to distinguish current, stale, and missing blocks",
  );
  assert.match(
    source,
    /const cacheResults = await runWithConcurrency\([\s\S]*loadCachedModelBlock\(packageKey, block, downloadKey,[\s\S]*\);/,
    "expected startDownload to gather typed cache load results before network work",
  );
  assert.match(
    source,
    /const missingBlocks = cacheResults[\s\S]*filter\(\(result\) => result\?\.status === CACHE_LOAD_RESULT\.MISSING\)[\s\S]*map\(\(result\) => result\.block\);/,
    "expected missing blocks to be separated from stale cached refreshes",
  );
  assert.match(
    source,
    /const blocksNeedingRefresh = cacheResults[\s\S]*filter\(\(result\) => result\?\.status === CACHE_LOAD_RESULT\.STALE\)[\s\S]*map\(\(result\) => result\.block\);/,
    "expected stale cached blocks to refresh only after missing downloads",
  );
  assert.match(
    source,
    /await runWithConcurrency\(\s*missingBlocks,\s*MAX_PARALLEL_DOWNLOADS,[\s\S]*refreshModelBlockFromNetwork[\s\S]*\);[\s\S]*await runWithConcurrency\(\s*blocksNeedingRefresh,\s*MAX_PARALLEL_DOWNLOADS,[\s\S]*refreshModelBlockFromNetwork[\s\S]*\);[\s\S]*await buildAnimationCacheAfterNetworkSettles\(session\);/,
    "expected missing files and stale refreshes to finish before animation cache generation starts",
  );
});
