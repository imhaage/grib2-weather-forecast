import maplibregl from "https://esm.sh/maplibre-gl@4";

const PROXY = "https://grib2-cors-proxy.imh.workers.dev";
import chroma from "https://esm.sh/chroma-js@2.4.2";
import {
  displayUnitsFor,
  unitFnFor,
  unitTransformFor,
} from "./unit-transforms.js";
import {
  defaultPaletteFor,
  parameterDescriptionFor,
  staticScaleFor,
  variableKeyFor,
} from "./variable-metadata.js";
import { createAnimationPlayer } from "./animation-player.js";
import { setupMapTooltip } from "./map-tooltip.js";
import {
  iterateGRIB2Messages,
  decodeGRIB2,
  MISSING_VALUE,
  CENTRES,
  GENERATING_PROCESS,
  fmtRefTime,
  fmtLevel,
  fmtValidTime,
} from "grib2-decoder";

const byId = (id) => document.getElementById(id);
const STAT_VALUE_IDS = [
  "gv-min",
  "gv-max",
  "gv-mean",
  "gv-valid",
];
const BLOCK_STATUS = Object.freeze({
  MISSING: "missing",
  LOADED_FROM_CACHE: "loaded-from-cache",
  DOWNLOADING: "downloading",
  READY: "ready",
});
const BLOCK_STATUS_LABELS = Object.freeze({
  [BLOCK_STATUS.MISSING]: "missing",
  [BLOCK_STATUS.LOADED_FROM_CACHE]: "loaded from cache",
  [BLOCK_STATUS.DOWNLOADING]: "updating",
  [BLOCK_STATUS.READY]: "ready",
});
const BLOCK_STATUS_CLASSES = [
  ...Object.values(BLOCK_STATUS),
  "done",
  "cached",
];
const CACHE_LOAD_RESULT = Object.freeze({
  CURRENT: "current",
  STALE: "stale",
  MISSING: "missing",
});
const dom = {
  get aromeDownloadBars() { return byId("arome-dl-bars"); },
  get aromeDownloadFileList() { return byId("arome-dl-file-list"); },
  get aromeDownloadStatus() { return byId("arome-dl-status"); },
  get aromeSlider() { return byId("arome-slider"); },
  get aromeVarSelect() { return byId("arome-var-select"); },
  get cacheWarmup() { return byId("cache-warmup"); },
  get dataStatusPanel() { return byId("data-status-panel"); },
  get dataStatusSummary() { return byId("data-status-summary"); },
  get mapScene() { return byId("map-scene"); },
  get paletteOptions() { return byId("palette-options"); },
  get paletteSelect() { return byId("palette-select"); },
  get paletteSelectArome() { return byId("palette-select-arome"); },
};

function setPaletteSelectValues(palette) {
  dom.paletteSelect.value = palette;
  dom.paletteSelectArome.value = palette;
}

// Populate all palette selects from the shared template
for (const sel of [dom.paletteSelect, dom.paletteSelectArome]) {
  const paletteTemplate = dom.paletteOptions;
  sel.appendChild(paletteTemplate.content.cloneNode(true));
  sel.value = "Plasma";
}

// ── Model packages ────────────────────────────────────────────────────────────
const PACKAGES = {
  AROME_SP1: {
    model: "AROME",
    label: "AROME SP1 0.01°",
    provider: "data-gouv",
    datasetId: "65bd1247a6238f16e864fa80",
    titlePattern: "__SP1__",
    skipHour0: true,
    bounds: [[-12, 37.5], [16, 55.4]],
    variables: [
      { shortName: "t",     name: "Temperature",                units: "°C",    level: "2 m above ground" },
      { shortName: "r",     name: "Relative humidity",          units: "%",     level: "2 m above ground" },
      { shortName: "u",     name: "U-component of wind",        units: "m s-1", level: "10 m above ground" },
      { shortName: "v",     name: "V-component of wind",        units: "m s-1", level: "10 m above ground" },
      { shortName: "ugust", name: "U-component of wind (gust)", units: "m s-1", level: "10 m above ground" },
      { shortName: "vgust", name: "V-component of wind (gust)", units: "m s-1", level: "10 m above ground" },
    ],
  },
  AROME_SP2: {
    model: "AROME",
    label: "AROME SP2 0.01°",
    provider: "data-gouv",
    datasetId: "65bd1247a6238f16e864fa80",
    titlePattern: "__SP2__",
    skipHour0: true,
    bounds: [[-12, 37.5], [16, 55.4]],
    variables: [
      { shortName: "p",     name: "Pressure",                             units: "hPa",    level: "Ground surface" },
      { shortName: "cape",  name: "Convective available potential energy", units: "J kg-1", level: "Ground surface" },
      { shortName: "lcc",   name: "Low cloud cover",                      units: "%",      level: "Ground surface" },
      { shortName: "mcc",   name: "Medium cloud cover",                   units: "%",      level: "Ground surface" },
      { shortName: "hcc",   name: "High cloud cover",                     units: "%",      level: "Ground surface" },
      { shortName: "tgrp",  name: "Graupel (snow pellets) precipitation", units: "mm/h",   level: "Ground surface" },
      { shortName: "rrate", name: "Rain precipitation",                   units: "mm/h",   level: "Ground surface" },
      { shortName: "srate", name: "Snow precipitation",                   units: "mm/h",   level: "Ground surface" },
    ],
  },
  AROME_HP1: {
    model: "AROME",
    label: "AROME HP1 0.01°",
    provider: "data-gouv",
    datasetId: "65bd1247a6238f16e864fa80",
    titlePattern: "__HP1__",
    skipHour0: true,
    bounds: [[-12, 37.5], [16, 55.4]],
    variables: [
      { shortName: "wspd", varKey: "wspd_10",  levelValue: 10,  name: "Wind speed",      level: "10 m above ground",  units: "km/h" },
      { shortName: "wspd", varKey: "wspd_20",  levelValue: 20,  name: "Wind speed",      level: "20 m above ground",  units: "km/h" },
      { shortName: "wspd", varKey: "wspd_50",  levelValue: 50,  name: "Wind speed",      level: "50 m above ground",  units: "km/h" },
      { shortName: "wdir", varKey: "wdir_10",  levelValue: 10,  name: "Wind direction",  level: "10 m above ground",  units: "°" },
      { shortName: "wdir", varKey: "wdir_20",  levelValue: 20,  name: "Wind direction",  level: "20 m above ground",  units: "°" },
      { shortName: "wdir", varKey: "wdir_50",  levelValue: 50,  name: "Wind direction",  level: "50 m above ground",  units: "°" },
      { shortName: "wdir", varKey: "wdir_100", levelValue: 100, name: "Wind direction",  level: "100 m above ground", units: "°" },
    ],
  },
  ARPEGE_SP1: {
    model: "ARPEGE",
    label: "ARPEGE SP1 0.1°",
    provider: "data-gouv",
    datasetId: "65bd13b2eb9e79ab309f6e63",
    titlePattern: "__SP1__",
    bounds: [[-32, 20], [42, 72]],
    variables: [
      { shortName: "t",    name: "Temperature",            units: "°C",    level: "2 m above ground" },
      { shortName: "r",    name: "Relative humidity",      units: "%",     level: "2 m above ground" },
      { shortName: "u",    name: "U-component of wind",    units: "m s-1", level: "10 m above ground" },
      { shortName: "v",    name: "V-component of wind",    units: "m s-1", level: "10 m above ground" },
      { shortName: "msl",  name: "Pressure reduced to MSL",units: "hPa",   level: "Mean sea level" },
      { shortName: "tcc",  name: "Total cloud cover",      units: "%",     level: "Ground surface" },
      { shortName: "wspd", name: "Wind speed",             units: "km/h",  level: "10 m above ground" },
      { shortName: "wdir", name: "Wind direction",         units: "°",     level: "10 m above ground" },
    ],
  },
};

const MODEL_INFO = {
  AROME: {
    description: "High-resolution model from Météo-France, covering metropolitan France and its Atlantic, English Channel, and Mediterranean seaboards.",
    resolution: "0.01° (~1 km)",
    domain: "12°W – 16°E · 37°N – 55°N",
    domainDesc: "Metropolitan France and its Atlantic, English Channel, and Mediterranean seaboards",
    horizon: "H+01 to H+51",
    filesInfo: "1 hour per file (51 files)",
  },
  ARPEGE: {
    description: "Limited-area model from Météo-France covering Europe, the northeast Atlantic, and the Middle East.",
    resolution: "0.1° (~11 km)",
    domain: "32°W – 42°E · 20°N – 72°N",
    domainDesc: "Western to central Europe, from the Sahara to the Norwegian Sea",
    horizon: "H+000 to H+102",
    filesInfo: "12 hours per file (9 files)",
  },
};

function findPackageVariable(packageKey, key) {
  return PACKAGES[packageKey]?.variables.find(
    (v) => variableKeyFor(v) === key,
  ) ?? null;
}


// ── State ─────────────────────────────────────────────────────────────────────
let fileState = null; // { messages: Array }
let gridState = null; // { values, min, range, grid, product }
let currentPalette = "Plasma";
let map = null; // MapLibre instance (created once, reused)
let heatCanvas = null; // offscreen canvas for heatmap rendering
let modelState = null; // { packageKey, resources, buffers, messageIndex, hourList, decoded, decodedOrder, variable, currentHour, lastRunInfo }
let isDecoding = false;
let pendingHourIdx = null;
let renderWorker = null;
let modelBlockWorker = null;
let renderGen = 0;
let nextCallId = 0;
let bitmapCache = new Map(); // cacheKey → {bitmap, dataMin, dataMax, mean, count}
let prerenderQueue = [];
let queuedPrerenderKeys = new Set();
let isPrerendering = false;
let tooltipHydrateTimer = null;
let tooltipHydrateToken = 0;
let prerenderIdleResolvers = [];
const MAX_PARALLEL_DOWNLOADS = 6;
const GRIB_CACHE_DB_NAME = "grib2-visualizer-cache";
const GRIB_CACHE_DB_VERSION = 2;
const GRIB_BLOCK_STORE = "gribBlocks";
const PERF_DEBUG = new URLSearchParams(window.location.search).get("debug") === "perf";
const perfStats = {
  lastRenderMs: null,
  lastDecodeMs: null,
};
let gribCacheDbPromise = null;
// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtPerfMs(value) {
  return value == null ? "—" : `${Math.round(value)} ms`;
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let nextIndex = 0;
  const workerCount = Math.min(limit, items.length);

  async function runNext() {
    const index = nextIndex++;
    if (index >= items.length) return;
    results[index] = await worker(items[index], index);
    await runNext();
  }

  await Promise.all(Array.from({ length: workerCount }, runNext));
  return results;
}

function scheduleLowPriorityWork() {
  if ("requestIdleCallback" in window) {
    return new Promise((resolve) => {
      window.requestIdleCallback(resolve, { timeout: 300 });
    });
  }
  return new Promise((resolve) => requestAnimationFrame(() => resolve()));
}

function idbRequest(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function idbTransactionDone(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error);
    transaction.onerror = () => reject(transaction.error);
  });
}

function openGribCacheDb() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (gribCacheDbPromise) return gribCacheDbPromise;

  gribCacheDbPromise = new Promise((resolve) => {
    const request = indexedDB.open(GRIB_CACHE_DB_NAME, GRIB_CACHE_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      const store = db.objectStoreNames.contains(GRIB_BLOCK_STORE)
        ? request.transaction.objectStore(GRIB_BLOCK_STORE)
        : db.createObjectStore(GRIB_BLOCK_STORE, { keyPath: "id" });
      if (!store.indexNames.contains("byPackageBlock")) {
        store.createIndex("byPackageBlock", ["packageKey", "blockKey"]);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => {
      console.warn("IndexedDB cache unavailable:", request.error);
      gribCacheDbPromise = null;
      resolve(null);
    };
    request.onblocked = () => {
      console.warn("IndexedDB cache upgrade is blocked by another tab.");
    };
  });

  return gribCacheDbPromise;
}

function extractRunId(text) {
  const match = text.match(/(\d{4}-\d{2}-\d{2}T\d{2}[:_]\d{2}[:_]\d{2}Z)/);
  return match ? match[1].replaceAll("_", ":") : "unknown-run";
}

function formatRunId(runId) {
  const match = runId.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})Z$/);
  if (!match) return runId;
  return `${match[1]} ${match[2]}:${match[3]} UTC`;
}

function formatRunSummary(resources) {
  const runIds = [...new Set(resources.map((r) => r.runId))];
  if (runIds.length === 0) return "no run";
  if (runIds.length === 1) return `run ${formatRunId(runIds[0])}`;
  return `mixed runs: ${runIds.map(formatRunId).join(", ")}`;
}

function gribBlockCacheKey(packageKey, block) {
  return [
    "grib2",
    packageKey,
    block.key,
    block.runId,
    block.filesize ?? "unknown-size",
    block.url,
  ].join(":");
}

function cachedGribBlockBuffer(record) {
  return record?.buffer ? new Uint8Array(record.buffer) : null;
}

function runTimeValue(runId) {
  const time = Date.parse(runId);
  return Number.isFinite(time) ? time : -Infinity;
}

function hasCompatibleCachedGribBlockSize(record, block) {
  return (
    record.filesize == null ||
    block.filesize == null ||
    record.filesize === block.filesize
  );
}

function isUsableCachedGribBlock(record, block) {
  return runTimeValue(record.runId) >= runTimeValue(block.runId) &&
    hasCompatibleCachedGribBlockSize(record, block);
}

function isOlderCachedGribBlock(record, block) {
  return runTimeValue(record.runId) < runTimeValue(block.runId);
}

async function findCachedGribBlock(packageKey, block, predicate) {
  const db = await openGribCacheDb();
  if (!db) return null;
  const transaction = db.transaction(GRIB_BLOCK_STORE, "readonly");
  const index = transaction.objectStore(GRIB_BLOCK_STORE).index("byPackageBlock");
  const range = IDBKeyRange.only([packageKey, block.key]);
  let match = null;
  await new Promise((resolve, reject) => {
    const request = index.openCursor(range);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        resolve();
        return;
      }
      const record = cursor.value;
      if (predicate(record) && (!match || String(record.savedAt) > String(match.savedAt))) {
        match = record;
      }
      cursor.continue();
    };
    request.onerror = () => reject(request.error);
  });
  return match;
}

async function readCachedGribBlock(packageKey, block) {
  try {
    const db = await openGribCacheDb();
    if (!db) return null;
    const transaction = db.transaction(GRIB_BLOCK_STORE, "readonly");
    const record = await idbRequest(
      transaction.objectStore(GRIB_BLOCK_STORE).get(gribBlockCacheKey(packageKey, block)),
    );
    const exactBuffer = cachedGribBlockBuffer(record);
    if (exactBuffer) return exactBuffer;

    const runRecord = await findCachedGribBlock(
      packageKey,
      block,
      (record) => isUsableCachedGribBlock(record, block),
    );
    return cachedGribBlockBuffer(runRecord);
  } catch (error) {
    console.warn("IndexedDB cache read failed:", error);
    return null;
  }
}

async function readLatestCachedGribBlock(packageKey, block) {
  try {
    const currentId = gribBlockCacheKey(packageKey, block);
    const latest = await findCachedGribBlock(
      packageKey,
      block,
      (record) => record.id !== currentId && isOlderCachedGribBlock(record, block),
    );
    const buffer = cachedGribBlockBuffer(latest);
    return buffer ? { ...latest, buffer } : null;
  } catch (error) {
    console.warn("IndexedDB stale cache read failed:", error);
    return null;
  }
}

async function writeCachedGribBlock(packageKey, block, buffer) {
  try {
    const db = await openGribCacheDb();
    if (!db) return false;
    const transaction = db.transaction(GRIB_BLOCK_STORE, "readwrite");
    const record = {
      id: gribBlockCacheKey(packageKey, block),
      packageKey,
      blockKey: block.key,
      runId: block.runId,
      url: block.url,
      filesize: block.filesize ?? null,
      savedAt: new Date().toISOString(),
      buffer: buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    };
    transaction.objectStore(GRIB_BLOCK_STORE).put(record);
    await idbTransactionDone(transaction);
    return true;
  } catch (error) {
    console.warn("IndexedDB cache write failed:", error);
    return false;
  }
}

async function deleteObsoleteCachedGribBlocks(packageKey, block) {
  try {
    const db = await openGribCacheDb();
    if (!db) return;
    const currentId = gribBlockCacheKey(packageKey, block);
    const transaction = db.transaction(GRIB_BLOCK_STORE, "readwrite");
    const index = transaction.objectStore(GRIB_BLOCK_STORE).index("byPackageBlock");
    const range = IDBKeyRange.only([packageKey, block.key]);
    await new Promise((resolve, reject) => {
      const request = index.openCursor(range);
      request.onsuccess = () => {
        const cursor = request.result;
        if (!cursor) {
          resolve();
          return;
        }
        if (cursor.value.id !== currentId) cursor.delete();
        cursor.continue();
      };
      request.onerror = () => reject(request.error);
    });
    await idbTransactionDone(transaction);
  } catch (error) {
    console.warn("IndexedDB obsolete cache cleanup failed:", error);
  }
}

async function clearGribCache() {
  try {
    const db = await openGribCacheDb();
    if (!db) return;
    const transaction = db.transaction(GRIB_BLOCK_STORE, "readwrite");
    transaction.objectStore(GRIB_BLOCK_STORE).clear();
    await idbTransactionDone(transaction);
  } catch (error) {
    console.warn("IndexedDB cache clear failed:", error);
  }
}

function updatePerfDiagnostics() {
  if (!PERF_DEBUG) return;
  const panel = document.getElementById("perf-debug");
  if (!panel) return;

  const totalBitmaps = modelState?.hourList.length ?? 0;
  const readyBitmaps = totalBitmaps ? bitmapCacheReadyCount() : bitmapCache.size;
  const decodedSize = modelState?.decoded?.size ?? 0;

  panel.hidden = false;
  document.getElementById("perf-debug-render").textContent =
    `render ${fmtPerfMs(perfStats.lastRenderMs)}`;
  document.getElementById("perf-debug-decode").textContent =
    `decode ${fmtPerfMs(perfStats.lastDecodeMs)}`;
  document.getElementById("perf-debug-queue").textContent =
    `queue ${prerenderQueue.length}${isPrerendering ? " + active" : ""}`;
  document.getElementById("perf-debug-cache").textContent =
    `cache ${readyBitmaps} / ${totalBitmaps || bitmapCache.size}`;
  document.getElementById("perf-debug-decoded").textContent =
    `decoded ${decodedSize}`;
  document.getElementById("perf-debug-gen").textContent =
    `gen ${renderGen}`;
}

function setRendering(on) {
  dom.mapScene.classList.toggle("rendering", on);
  updatePerfDiagnostics();
}

function setMapSceneVisible(visible) {
  const scene = dom.mapScene;
  scene.hidden = !visible;
  if (visible && map) map.resize();
}

function initRenderWorker() {
  if (renderWorker) return;
  renderWorker = new Worker(
    new URL("./render-worker.js", import.meta.url),
    { type: "module" },
  );
}

function initModelBlockWorker() {
  if (modelBlockWorker) return;
  modelBlockWorker = new Worker(
    new URL("./model-block-worker.js", import.meta.url),
    { type: "module" },
  );
}

function postModelBlockWorker(message, transfer = []) {
  initModelBlockWorker();
  const callId = ++nextCallId;
  return new Promise((resolve) => {
    function onMsg({ data }) {
      if (data.callId !== callId) return;
      modelBlockWorker.removeEventListener("message", onMsg);
      modelBlockWorker.removeEventListener("error", onErr);
      if (data.error) {
        console.error("model-block-worker error:", data.error);
        resolve(null);
        return;
      }
      resolve(data);
    }
    function onErr(error) {
      modelBlockWorker.removeEventListener("message", onMsg);
      modelBlockWorker.removeEventListener("error", onErr);
      console.error("model-block-worker crash:", error);
      resolve(null);
    }
    modelBlockWorker.addEventListener("message", onMsg);
    modelBlockWorker.addEventListener("error", onErr);
    modelBlockWorker.postMessage({ ...message, callId }, transfer);
  });
}

async function timedDecodeGRIB2(buffer) {
  const startedAt = PERF_DEBUG ? performance.now() : 0;
  const decoded = await decodeGRIB2(buffer);
  if (PERF_DEBUG) {
    perfStats.lastDecodeMs = performance.now() - startedAt;
    updatePerfDiagnostics();
  }
  return decoded;
}

// Sends raw values to the worker, returns Promise<{bitmap,dataMin,dataMax,mean,count}|null>.
// Returns null if renderGen changed before the worker responds (stale result).
// By default values are copied so the main thread keeps ownership for tooltips.
function renderViaWorker(values, renderParams, outW, outH, { transferValues = false } = {}) {
  initRenderWorker();
  const myGen = renderGen;
  const myCallId = ++nextCallId;
  const startedAt = PERF_DEBUG ? performance.now() : 0;

  const { grid } = renderParams;
  const northLat = Math.max(grid.latitudeOfFirstPoint, grid.latitudeOfLastPoint);
  const southLat = Math.min(grid.latitudeOfFirstPoint, grid.latitudeOfLastPoint);
  const isStoN = grid.latitudeOfLastPoint > grid.latitudeOfFirstPoint;
  const myNorth = mercatorY(northLat);
  const mySpan = myNorth - mercatorY(southLat);

  return new Promise((resolve) => {
    function onMsg({ data }) {
      if (data.callId !== myCallId) return;
      renderWorker.removeEventListener("message", onMsg);
      renderWorker.removeEventListener("error", onErr);
      if (data.error) { console.error("render-worker error:", data.error); resolve(null); return; }
      if (PERF_DEBUG) {
        perfStats.lastRenderMs = performance.now() - startedAt;
        updatePerfDiagnostics();
      }
      if (renderGen !== myGen) { data.bitmap?.close(); resolve(null); return; }
      resolve({ bitmap: data.bitmap, dataMin: data.dataMin, dataMax: data.dataMax, mean: data.dataMean, count: data.dataCount });
    }
    function onErr(e) {
      renderWorker.removeEventListener("message", onMsg);
      renderWorker.removeEventListener("error", onErr);
      console.error("render-worker crash:", e);
      resolve(null);
    }
    renderWorker.addEventListener("message", onMsg);
    renderWorker.addEventListener("error", onErr);

    const workerValues = transferValues ? values : values.slice();
    const lut = buildLUT(currentPalette);
    renderWorker.postMessage({
      callId: myCallId,
      gen: myGen,
      values: workerValues,
      unitTransform: renderParams.unitTransform,
      lut,
      missingValue: MISSING_VALUE,
      min: renderParams.renderMin,
      range: renderParams.range,
      isLog: renderParams.isLog,
      logFloor: LOG_SCALE_FLOOR,
      logDenom: renderParams.logDenom,
      zeroThreshold: renderParams.zeroThreshold,
      outW,
      outH,
      ni: grid.ni,
      nj: grid.nj,
      dj: grid.dj,
      isStoN,
      northLat,
      southLat,
      myNorth,
      mySpan,
    }, [workerValues.buffer]);
  });
}

function invalidateBitmapCache() {
  if (modelState) modelState.animationCachePrimed = false;
  for (const entry of bitmapCache.values()) entry.bitmap.close();
  bitmapCache = new Map();
  prerenderQueue = [];
  queuedPrerenderKeys = new Set();
  resolvePrerenderIdle();
  tooltipHydrateToken++;
  if (tooltipHydrateTimer !== null) clearTimeout(tooltipHydrateTimer);
  tooltipHydrateTimer = null;
  renderGen++;
  updateWarmupProgress();
  updatePerfDiagnostics();
}

function invalidateBlockRenderCache(block) {
  if (!block) return;
  for (let hour = block.startHour; hour <= block.endHour; hour++) {
    const entry = bitmapCache.get(bitmapCacheKey(hour));
    entry?.bitmap.close();
    bitmapCache.delete(bitmapCacheKey(hour));
    evictDecodedHour(hour);
  }
  updateWarmupProgress();
}

function bitmapCacheKey(hour) {
  return `${hour}`;
}

function bitmapCacheReadyCount() {
  if (!modelState) return 0;
  let count = 0;
  for (const hour of modelState.hourList) {
    if (bitmapCache.has(bitmapCacheKey(hour))) count++;
  }
  return count;
}

function isBitmapCacheComplete() {
  return Boolean(modelState?.hourList.length) &&
    bitmapCacheReadyCount() === modelState.hourList.length;
}

function isAnimationCacheReadyForPlayback() {
  return Boolean(modelState && (modelState.animationCachePrimed || isBitmapCacheComplete()));
}

function updateWarmupProgress({ preparing = false } = {}) {
  const container = dom.cacheWarmup;
  if (!container || !modelState?.hourList.length) {
    if (container) container.hidden = true;
    syncPlayButtonAvailability();
    return;
  }

  const total = modelState.hourList.length;
  const ready = bitmapCacheReadyCount();
  const complete = ready === total;
  if (complete) modelState.animationCachePrimed = true;
  const visibleReady = modelState.animationCachePrimed ? total : ready;
  const pct = total ? Math.round((visibleReady / total) * 100) : 0;

  container.hidden = false;
  container.classList.toggle("ready", modelState.animationCachePrimed);
  document.getElementById("cache-warmup-bar").style.width = `${pct}%`;
  document.getElementById("cache-warmup-count").textContent = `${visibleReady} / ${total}`;
  document.getElementById("cache-warmup-label").textContent = modelState.animationCachePrimed
    ? "Animation ready"
    : preparing
      ? "Preparing animation"
      : "Animation cache";
  syncPlayButtonAvailability();
  updatePerfDiagnostics();
}

function makeBitmapCacheEntry(renderEntry, renderParams) {
  return {
    ...renderEntry,
    unitTransform: renderParams.unitTransform,
    renderMin: renderParams.renderMin,
    range: renderParams.range,
    staticScale: renderParams.staticScale,
    displayUnits: renderParams.displayUnits,
    isFallback: renderParams.isFallback,
    grid: renderParams.grid,
    product: renderParams.product,
    header: renderParams.header,
  };
}

function makeBitmapCacheEntryFromWorker(renderEntry) {
  return {
    bitmap: renderEntry.bitmap,
    dataMin: renderEntry.dataMin,
    dataMax: renderEntry.dataMax,
    mean: renderEntry.dataMean,
    count: renderEntry.dataCount,
    unitTransform: renderEntry.unitTransform,
    renderMin: renderEntry.renderMin,
    range: renderEntry.range,
    staticScale: renderEntry.staticScale,
    displayUnits: renderEntry.displayUnits,
    isFallback: renderEntry.isFallback,
    grid: renderEntry.grid,
    product: renderEntry.product,
    header: renderEntry.header,
  };
}

function makeGridState(renderParams, values = renderParams.values) {
  return {
    ...renderParams,
    values,
    unitFn: unitFnFor(renderParams.unitTransform),
    min: renderParams.renderMin,
    range: renderParams.range,
  };
}

const fmtNum = (v, d = 4) => v.toFixed(d);
const fmtHourLabel = (h) => `+${String(h).padStart(2, "0")}H`;

function fmtSize(b) {
  return b >= 1e6
    ? (b / 1e6).toFixed(1) + " MB"
    : (b / 1e3).toFixed(0) + " KB";
}
function fmtGrid(g) {
  return (
    `${g.ni} × ${g.nj} pts · ` +
    `${g.latitudeOfLastPoint}°–${g.latitudeOfFirstPoint}°N · ` +
    `${g.longitudeOfFirstPoint}°–${g.longitudeOfLastPoint}°E`
  );
}
function code(table, v) {
  return table[v] ? `${table[v]} (${v})` : String(v);
}

// ── Colormap (chroma-js) ──────────────────────────────────────────────────────

const CUSTOM_SCALES = {
  Plasma: ["#0d0887", "#7e03a8", "#cb4679", "#f89441", "#f0f921"],
  Magma: ["#000004", "#51127c", "#b73779", "#fc8961", "#fcfdbf"],
  Inferno: ["#000004", "#420a68", "#932667", "#dd513a", "#fcffa4"],
  // Custom temperature palette: white at 0°C (t=0.333 on the -25…50 scale).
  // Stops are positioned non-uniformly to balance the cold (33%) / warm (67%) ranges.
  // T°C → t: (T + 25) / 75
  TempC: {
    colors: [
      "#08306b", // t=0.000 → -25°C  deep navy
      "#2166ac", // t=0.133 → -15°C  medium blue
      "#92c5de", // t=0.267 →  -5°C  light blue
      "#ffffff", // t=0.333 →   0°C  white (freezing)
      "#ffc800", // t=0.567 →  17°C  warm amber yellow
      "#ff6600", // t=0.733 →  30°C  orange
      "#cc1100", // t=0.867 →  40°C  red
      "#67000d", // t=1.000 →  50°C  dark red
    ],
    domain: [0.0, 0.133, 0.267, 0.333, 0.567, 0.733, 0.867, 1.0],
  },
};

const INVERTED_PALETTES = new Set([
  "Plasma",
  "Viridis",
  "Magma",
  "Inferno",
  "Spectral",
  "RdBu",
  "RdYlBu",
]);

const DECODED_CACHE_SIZE = 2;
const LOG_SCALE_FLOOR = 0.1;
const RASTER_OPACITY = 0.8;

function applyDefaultPalette(shortName) {
  const pal = defaultPaletteFor(shortName);
  if (!pal) return;
  currentPalette = pal;
  setPaletteSelectValues(pal);
}

function makeScale(paletteName) {
  const entry = CUSTOM_SCALES[paletteName];
  if (entry?.colors) {
    // Non-uniform stops: {colors, domain}
    return chroma.scale(entry.colors).domain(entry.domain);
  }
  const scale = chroma.scale(entry ?? chroma.brewer[paletteName]);
  return INVERTED_PALETTES.has(paletteName)
    ? scale.domain([1, 0])
    : scale;
}

function buildLUT(paletteName) {
  const sc = makeScale(paletteName);
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const [r, g, b] = sc(i / 255).rgb();
    lut[i * 3] = r;
    lut[i * 3 + 1] = g;
    lut[i * 3 + 2] = b;
  }
  return lut;
}

// Mercator helpers (latitude in degrees)
const mercatorY = (lat) =>
  Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const invMercatorY = (my) =>
  ((2 * Math.atan(Math.exp(my)) - Math.PI / 2) * 180) / Math.PI;

// Compute the Mercator-proportional canvas height for a given grid.
// The canvas width equals grid.ni; height is chosen so that one pixel ≈ same
// arc-length in both x and y when viewed in Web Mercator.
function mercatorCanvasHeight(grid) {
  const {
    ni,
    latitudeOfFirstPoint: la1,
    latitudeOfLastPoint: la2,
    longitudeOfFirstPoint: lo1,
    longitudeOfLastPoint: lo2,
  } = grid;
  const spanY = Math.abs(mercatorY(la1) - mercatorY(la2));
  const spanX = Math.abs((lo2 - lo1) * Math.PI) / 180;
  return Math.round((ni * spanY) / spanX);
}

// ── Card builder ──────────────────────────────────────────────────────────────

function buildCard(msg) {
  const { index, header, product: p, grid: g } = msg;
  const row = (key, val) => `
    <div class="card-row">
<span class="key">${key}</span>
<span class="val">${val}</span>
    </div>`;
  return `
    <div class="card">
<div class="card-header">
  <span class="badge">${p.shortName}</span>
  <div><div class="card-title">${p.name}</div></div>
</div>
<div class="card-rows">
  ${row("Unit", p.units)}
  ${row("Level", fmtLevel(p))}
  ${row("Forecast time (UTC)", fmtValidTime(header, p))}
  ${row("Process", code(GENERATING_PROCESS, p.typeOfGeneratingProcess))}
  <hr class="card-divider">
  ${row("Grid", fmtGrid(g))}
  ${row("Resolution", `${g.di}° × ${g.dj}°`)}
  ${row("Message #", index)}
</div>
<button class="btn-grid" data-var="${p.shortName}">View grid</button>
    </div>`;
}

// ── Home view: process uploaded file ─────────────────────────────────────────

function processFile(file) {
  setStatus("Reading file…");
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const buffer = e.target.result;
      const messages = [...iterateGRIB2Messages(buffer)];
      if (messages.length === 0) {
        setStatus("No GRIB2 messages found.", true);
        return;
      }

      fileState = { messages };

      const first = messages[0];
      document.getElementById("s-name").textContent = file.name;
      document.getElementById("s-size").textContent = fmtSize(file.size);
      document.getElementById("s-count").textContent = messages.length;
      document.getElementById("s-centre").textContent =
        CENTRES[first.header.centre] ?? `Centre ${first.header.centre}`;
      document.getElementById("s-reftime").textContent = fmtRefTime(
        first.header,
      );
      document.getElementById("file-summary").style.display = "flex";

      document.getElementById("cards").innerHTML = messages
        .map(buildCard)
        .join("");
      document.getElementById("results").style.display = "block";
      setStatus("");
    } catch (err) {
      setStatus("Error: " + err.message, true);
    }
  };
  reader.onerror = () => setStatus("Could not read file.", true);
  reader.readAsArrayBuffer(file);
}

function setStatus(msg, isError = false) {
  const el = document.getElementById("status");
  el.textContent = msg;
  el.className = isError ? "error" : "";
}

function removeMapLayerIfExists() {
  if (map?.getSource("grib2")) {
    map.removeLayer("grib2-layer");
    map.removeSource("grib2");
  }
}

function clearMapLayer() {
  removeMapLayerIfExists();
  gridState = null;
  hideColorScale();
  hideMapUnavailable();
}

function clearStats() {
  for (const id of STAT_VALUE_IDS) {
    byId(id).textContent = "—";
  }
}

function showUnavailableHour(hour) {
  clearMapLayer();
  clearStats();
  document.getElementById("arome-valid-time").textContent =
    `Forecast time: ${fmtUnavailableValidTime(hour)}`;
  showMapUnavailable();
}

function showMapUnavailable() {
  const el = document.getElementById("map-unavailable");
  el.hidden = false;
}

function hideMapUnavailable() {
  const el = document.getElementById("map-unavailable");
  if (el) el.hidden = true;
}

function fmtUnavailableValidTime(hour) {
  const block = blockForHour(hour);
  const runId = block?.runId;
  const runTime = runId ? Date.parse(runId) : NaN;
  if (!Number.isNaN(runTime)) {
    const valid = new Date(runTime + hour * 60 * 60 * 1000);
    return valid.toISOString().slice(0, 16).replace("T", " ") + " UTC";
  }
  return fmtHourLabel(hour);
}

// Populate and show the color scale legend bar.
function showColorScale(min, max, units) {
  document.getElementById("cs-min").textContent = fmtNum(min, 2);
  document.getElementById("cs-max").textContent = fmtNum(max, 2);
  document.getElementById("cs-unit").textContent = units;
  document.getElementById("colorscale").style.display = "flex";
}

function hideColorScale() {
  document.getElementById("colorscale").style.display = "none";
}

function updateLevelInfo(varDef) {
  const parts = [varDef?.level, varDef?.units].filter(Boolean);
  document.getElementById("gv-level").textContent = parts.join(" · ");
}

function updateParamInfo(name, desc, sub) {
  document.getElementById("gv-name").textContent = name;
  document.getElementById("gv-desc").textContent = desc;
  document.getElementById("gv-sub").textContent = sub;
}

function updateStats(min, max, mean, count, units) {
  document.getElementById("gv-min").textContent =
    fmtNum(min, 3) + " " + units;
  document.getElementById("gv-max").textContent =
    fmtNum(max, 3) + " " + units;
  document.getElementById("gv-mean").textContent =
    fmtNum(mean, 3) + " " + units;
  document.getElementById("gv-valid").textContent =
    count.toLocaleString();
}

function toDisplayValues(values) {
  if (values instanceof Float32Array) return values;
  const out = new Float32Array(values.length);
  out.set(values);
  return out;
}

function makeRenderParams(data, {
  values = data.values,
  displayUnits = null,
  isFallback = false,
} = {}) {
  const { grid, product, header } = data;
  const unitTransform = unitTransformFor(product.shortName);
  const staticScale = staticScaleFor(product.shortName);
  const renderMin = staticScale ? staticScale.min : 0;
  const renderMax = staticScale ? staticScale.max : 1;
  const range = renderMax - renderMin || 1;
  const isLog = staticScale?.log ?? false;
  const logDenom = isLog ? Math.log(staticScale.max / LOG_SCALE_FLOOR) : 1;
  const zeroThreshold = staticScale?.zeroThreshold ?? 0;

  return {
    values: toDisplayValues(values),
    unitTransform,
    renderMin, renderMax, range,
    staticScale, isLog, logDenom, zeroThreshold,
    displayUnits: displayUnits ?? displayUnitsFor(product.shortName, product.units),
    isFallback,
    grid, product, header,
  };
}

function gridCorners({
  latitudeOfFirstPoint: la1,
  longitudeOfFirstPoint: lo1,
  latitudeOfLastPoint: la2,
  longitudeOfLastPoint: lo2,
}) {
  const north = Math.max(la1, la2);
  const south = Math.min(la1, la2);
  const west = Math.min(lo1, lo2);
  const east = Math.max(lo1, lo2);
  return [
    [west, north],
    [east, north],
    [east, south],
    [west, south],
  ];
}

function setMapLayer(canvas, corners) {
  removeMapLayerIfExists();
  map.addSource("grib2", {
    type: "canvas",
    canvas,
    coordinates: corners,
    animate: true,
  });
  map.addLayer({
    id: "grib2-layer",
    type: "raster",
    source: "grib2",
    paint: {
      "raster-opacity": RASTER_OPACITY,
      "raster-resampling": "nearest",
    },
  });
}

function ensureHeatCanvas(grid) {
  const needH = mercatorCanvasHeight(grid);
  const canvasChanged = !heatCanvas || heatCanvas.width !== grid.ni || heatCanvas.height !== needH;
  if (canvasChanged) {
    heatCanvas = document.createElement("canvas");
    heatCanvas.width = grid.ni;
    heatCanvas.height = needH;
  }
  return {
    canvas: heatCanvas,
    canvasChanged,
    outW: grid.ni,
    outH: needH,
  };
}

function drawBitmapToHeatCanvas(bitmap) {
  const ctx = heatCanvas.getContext("2d");
  ctx.clearRect(0, 0, heatCanvas.width, heatCanvas.height);
  ctx.drawImage(bitmap, 0, 0);
}

function updateStatsAndColorScale(entry) {
  updateStats(entry.dataMin, entry.dataMax, entry.mean, entry.count, entry.displayUnits);
  const legendMin = entry.staticScale ? entry.renderMin : entry.dataMin;
  const legendMax = entry.staticScale ? entry.renderMin + entry.range : entry.dataMax;
  showColorScale(legendMin, legendMax, entry.displayUnits);
}

// Create the MapLibre map once. fitBoundsArgs is optional [bounds, options].
async function initMap(fitBoundsArgs) {
  if (map) return;
  map = new maplibregl.Map({
    container: "map",
    style: "https://tiles.openfreemap.org/styles/positron",
    attributionControl: true,
  });
  await new Promise((r) => map.once("load", r));
  if (fitBoundsArgs) map.fitBounds(...fitBoundsArgs);
  map.addControl(
    new maplibregl.FullscreenControl({
      container: dom.mapScene,
    }),
  );
  setupMapTooltip({
    map,
    maplibregl,
    getGridState: () => gridState,
    missingValue: MISSING_VALUE,
    tooltipEl: document.getElementById("map-tooltip"),
    wrapEl: document.getElementById("map-wrap"),
  });
}

function resetModelState() {
  stopPlayer();
  invalidateBitmapCache();
  setRendering(false);
  modelState = null;
  isDecoding = false;
  pendingHourIdx = null;
  gridState = null;
  updateWarmupProgress();
  dom.aromeDownloadBars.innerHTML = "";
  dom.aromeDownloadFileList.innerHTML = "";
}

function resetApp() {
  fileState = null;
  resetModelState();
  clearMapLayer();
  setStatus("");
  document.getElementById("file-summary").style.display = "none";
  document.getElementById("results").style.display = "none";
  document.getElementById("cards").innerHTML = "";
  dom.dataStatusPanel.style.display = "none";
  location.hash = "";
}

// ── Grid view: decode + render on map ────────────────────────────────────────

async function showGridView(shortName) {
  if (!fileState) {
    location.hash = "";
    return;
  }

  const msg = fileState.messages.find(
    (m) => m.product.shortName === shortName,
  );
  if (!msg) {
    location.hash = "";
    return;
  }

  const product = msg.product;

  // Populate toolbar
  updateParamInfo(
    product.name,
    parameterDescriptionFor(product.shortName),
    fmtValidTime(msg.header, product),
  );

  // Reset stats
  clearStats();
  hideColorScale();

  // Switch view
  document.getElementById("view-home").style.display = "none";
  document.getElementById("view-grid").style.display = "block";
  setMapSceneVisible(true);

  // Decode (WASM)
  let decoded;
  try {
    decoded = await timedDecodeGRIB2(msg.buffer);
  } catch (err) {
    document.getElementById("map").textContent =
      "Decode error: " + err.message;
    return;
  }

  const { grid: gr } = decoded;
  const p = makeRenderParams(decoded);
  gridState = makeGridState(p);

  const { outH } = ensureHeatCanvas(gr);
  const corners = gridCorners(gr);
  const statsEntry = await renderViaWorker(p.values, p, gr.ni, outH);
  if (!statsEntry) return;
  const entry = makeBitmapCacheEntry(statsEntry, p);

  drawBitmapToHeatCanvas(statsEntry.bitmap);
  statsEntry.bitmap.close();

  await initMap();
  setMapLayer(heatCanvas, corners);
  map.fitBounds(
    [
      [corners[3][0], corners[2][1]],
      [corners[1][0], corners[0][1]],
    ],
    { padding: 20, animate: false },
  );

  updateStatsAndColorScale(entry);
}

async function rerenderUploadedGridView() {
  if (!gridState || modelState) return;
  const { grid } = gridState;
  const { outH } = ensureHeatCanvas(grid);

  const statsEntry = await renderViaWorker(gridState.values, gridState, grid.ni, outH);
  if (!statsEntry) return;
  const entry = makeBitmapCacheEntry(statsEntry, gridState);

  drawBitmapToHeatCanvas(statsEntry.bitmap);
  statsEntry.bitmap.close();

  updateStatsAndColorScale(entry);
  if (map) map.triggerRepaint();
}

// ── AROME live data ───────────────────────────────────────────────────────────

function proxyUrl(url) {
  const u = new URL(url);
  return `${PROXY}/${u.hostname}${u.pathname}${u.search}`;
}

async function fetchDataGouvResources(datasetId, titlePattern) {
  const resp = await fetch(`${PROXY}/www.data.gouv.fr/api/1/datasets/${datasetId}/`);
  if (!resp.ok) throw new Error(`API ${resp.status}`);
  const data = await resp.json();
  return data.resources
    .filter((r) => r.format === "grib2" && r.title?.includes(titlePattern))
    .map((r) => {
      const single = r.title.match(/__(\d+)H__/);
      const range  = r.title.match(/__(\d+)H(\d+)H__/);
      const runId = extractRunId(`${r.title} ${r.url}`);
      if (single) return { startHour: +single[1], endHour: +single[1], key: single[0].slice(2, -2), runId, title: r.title, url: r.url, filesize: r.filesize };
      if (range)  return { startHour: +range[1],  endHour: +range[2],  key: range[0].slice(2, -2),  runId, title: r.title, url: r.url, filesize: r.filesize };
      return null;
    })
    .filter(Boolean)
    .sort((a, b) => a.startHour - b.startHour);
}

async function downloadFileProg(url, filesize, onProgress) {
  const resp = await fetch(proxyUrl(url));
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const reader = resp.body.getReader();
  const chunks = [];
  let loaded = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    loaded += value.length;
    onProgress(loaded, filesize || loaded);
  }
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

async function getCachedDecode(hour) {
  const { decoded, decodedOrder, resources, variable } = modelState;
  if (decoded.has(hour)) {
    updatePerfDiagnostics();
    return decoded.get(hour);
  }

  const block = resources.find((r) => hour >= r.startHour && hour <= r.endHour);
  if (!block || !modelState.buffers.has(block.key)) return null;

  if (!modelState.messageIndex.has(block.key)) indexBlock(block.key);

  const varDef = findPackageVariable(modelState.packageKey, variable);
  const lookupKey = varDef?.levelValue != null
    ? `${hour}_${varDef.shortName}_${varDef.levelValue}`
    : `${hour}_${variable}`;
  const msgRef = modelState.messageIndex.get(block.key)?.get(lookupKey);
  const msgBuffer = messageViewFromRef(msgRef);
  if (!msgBuffer) return null;

  if (decodedOrder.length >= DECODED_CACHE_SIZE) decoded.delete(decodedOrder.shift());
  const dec = await timedDecodeGRIB2(msgBuffer);
  const data = { values: dec.values, grid: dec.grid, product: dec.product, header: dec.header };
  decoded.set(hour, data);
  decodedOrder.push(hour);
  return data;
}

function messageViewFromRef(ref) {
  if (!ref) return null;
  const buffer = modelState.buffers.get(ref.blockKey);
  if (!(buffer instanceof Uint8Array)) return null;
  return buffer.subarray(ref.offset, ref.offset + ref.length);
}

function evictDecodedHour(hour) {
  modelState.decoded.delete(hour);
  modelState.decodedOrder = modelState.decodedOrder.filter((h) => h !== hour);
  updatePerfDiagnostics();
}

function indexBlock(blockKey) {
  const buffer = modelState.buffers.get(blockKey);
  if (!(buffer instanceof Uint8Array)) return;
  const block = modelState.resources.find((r) => r.key === blockKey);
  const index = new Map();
  for (const msg of iterateGRIB2Messages(buffer)) {
    const { product } = msg;
    const messageRef = { blockKey, offset: msg.offset, length: msg.length };
    // PDT 4.8 (accumulation) always has forecastTime=0 (start of interval).
    // For single-hour blocks, use the block's hour as the effective forecast time.
    const ft = (product.pdtNumber === 8 && block.startHour === block.endHour)
      ? block.endHour
      : product.forecastTime;
    index.set(`${ft}_${product.shortName}_${product.levelValue}`, messageRef);
    const simpleKey = `${ft}_${product.shortName}`;
    if (!index.has(simpleKey)) index.set(simpleKey, messageRef);
  }
  modelState.messageIndex.set(blockKey, index);
}

// Applies all transforms to raw decoded data and returns render-ready params.
// idx is the slider index — needed to compute accumulation diff with previous hour.
async function computeRenderParams(data, idx) {
  const { values, product } = data;
  const isAccumulation = product.pdtNumber === 8;
  let displayValues = values;
  let isFallback = false;
  let displayUnits = null;

  if (isAccumulation && idx > 0) {
    const prevHour = modelState.hourList[idx - 1];
    const prevData = await getCachedDecode(prevHour);
    if (prevData !== null) {
      const diff = new Float32Array(values.length);
      for (let i = 0; i < values.length; i++) {
        if (values[i] <= MISSING_VALUE || prevData.values[i] <= MISSING_VALUE) {
          diff[i] = MISSING_VALUE;
        } else {
          diff[i] = Math.max(0, values[i] - prevData.values[i]);
        }
      }
      displayValues = diff;
    } else {
      isFallback = true;
    }
  }

  if (isAccumulation && !isFallback && idx > 0) displayUnits = "mm/h";

  return makeRenderParams(data, {
    values: displayValues,
    displayUnits,
    isFallback,
  });
}

function modelWorkerRequestForHour(idx, hour, { includeValues = false } = {}) {
  const block = blockForHour(hour);
  if (!block || !modelState.buffers.has(block.key)) return null;

  const varDef = findPackageVariable(modelState.packageKey, modelState.variable);
  const shortName = varDef?.shortName ?? modelState.variable;
  const staticScale = staticScaleFor(shortName);
  const renderMin = staticScale ? staticScale.min : 0;
  const renderMax = staticScale ? staticScale.max : 1;
  const range = renderMax - renderMin || 1;
  const isLog = staticScale?.log ?? false;
  const prevHour = idx > 0 ? modelState.hourList[idx - 1] : null;
  const previousBlock = prevHour != null ? blockForHour(prevHour) : null;

  return {
    type: "renderHour",
    gen: renderGen,
    blockKey: block.key,
    block,
    hour,
    previousBlockKey: previousBlock?.key ?? null,
    previousBlock,
    previousHour: prevHour,
    variable: {
      shortName,
      levelValue: varDef?.levelValue ?? null,
    },
    unitTransform: unitTransformFor(shortName),
    staticScale,
    renderMin,
    range,
    isLog,
    logFloor: LOG_SCALE_FLOOR,
    logDenom: isLog ? Math.log(staticScale.max / LOG_SCALE_FLOOR) : 1,
    zeroThreshold: staticScale?.zeroThreshold ?? 0,
    displayUnits: displayUnitsFor(shortName, varDef?.units),
    lut: buildLUT(currentPalette),
    missingValue: MISSING_VALUE,
    includeValues,
  };
}

async function renderModelHourViaWorker(idx, { includeValues = false } = {}) {
  const hour = modelState.hourList[idx];
  const request = modelWorkerRequestForHour(idx, hour, { includeValues });
  if (!request) return null;

  const startedAt = PERF_DEBUG ? performance.now() : 0;
  const result = await postModelBlockWorker(request, [request.lut.buffer]);
  if (!result) return null;
  if (PERF_DEBUG) {
    perfStats.lastRenderMs = performance.now() - startedAt;
    updatePerfDiagnostics();
  }
  if (renderGen !== request.gen) {
    result.bitmap?.close();
    return null;
  }
  return result;
}

async function decodeModelHourValuesViaWorker(idx, hour) {
  const request = modelWorkerRequestForHour(idx, hour, { includeValues: false });
  if (!request) return null;
  const result = await postModelBlockWorker({
    ...request,
    type: "decodeValues",
  });
  if (!result?.values || renderGen !== request.gen) return null;
  return result;
}

async function presentBitmapEntry(hour, entry, { values } = {}) {
  const { grid, product, header } = entry;
  hideMapUnavailable();

  gridState = makeGridState(entry, values ?? null);

  const { canvasChanged } = ensureHeatCanvas(grid);
  const corners = gridCorners(grid);
  drawBitmapToHeatCanvas(entry.bitmap);

  const sc = makeScale(currentPalette);
  const stops = Array.from({ length: 8 }, (_, i) => sc(i / 7).css()).join(", ");
  document.getElementById("cs-bar").style.background = `linear-gradient(to right, ${stops})`;

  await initMap();
  const isFirstLayer = !map.getSource("grib2");
  if (isFirstLayer || canvasChanged) {
    setMapLayer(heatCanvas, corners);
    map.fitBounds(
      [[corners[3][0], corners[2][1]], [corners[1][0], corners[0][1]]],
      { padding: 20, animate: false },
    );
  }
  if (map) map.triggerRepaint();

  modelState.lastRunInfo = `${modelState.packageKey} · run ${fmtRefTime(header)}`;
  updateParamInfo(
    product.name,
    parameterDescriptionFor(product.shortName),
    modelState.lastRunInfo + (entry.isFallback ? " · (cumulative — prev not loaded)" : ""),
  );

  updateStatsAndColorScale(entry);

  const validTimeProduct = product.pdtNumber === 8
    ? { ...product, forecastTime: hour, timeUnit: 1 }
    : product;
  document.getElementById("arome-valid-time").textContent =
    `Forecast time: ${fmtValidTime(header, validTimeProduct)}`;
}

async function hydrateTooltipValues(idx, hour, token, capturedState, capturedGen) {
  const data = await decodeModelHourValuesViaWorker(idx, hour);
  if (
    !data ||
    modelState !== capturedState ||
    renderGen !== capturedGen ||
    tooltipHydrateToken !== token ||
    capturedState.currentHour !== hour
  ) return;

  if (
    modelState !== capturedState ||
    renderGen !== capturedGen ||
    tooltipHydrateToken !== token ||
    capturedState.currentHour !== hour
  ) return;

  const cachedEntry = bitmapCache.get(bitmapCacheKey(hour));
  if (cachedEntry) gridState = makeGridState(cachedEntry, data.values);
}

function queueTooltipValueHydration(idx, hour) {
  tooltipHydrateToken++;
  if (tooltipHydrateTimer !== null) clearTimeout(tooltipHydrateTimer);
  tooltipHydrateTimer = null;
  if (animationPlayer.isPlaying()) return;

  const token = tooltipHydrateToken;
  const capturedState = modelState;
  const capturedGen = renderGen;
  tooltipHydrateTimer = setTimeout(() => {
    tooltipHydrateTimer = null;
    if (animationPlayer.isPlaying()) return;
    hydrateTooltipValues(idx, hour, token, capturedState, capturedGen)
      .catch((err) => console.error("hydrateTooltipValues:", err));
  }, 140);
}

function queueCurrentTooltipValueHydration() {
  if (!modelState || gridState?.values) return;
  const slider = dom.aromeSlider;
  const idx = parseInt(slider.value, 10);
  const hour = modelState.hourList[idx];
  if (bitmapCache.has(bitmapCacheKey(hour))) queueTooltipValueHydration(idx, hour);
}

async function showHour(idx) {
  if (isDecoding) {
    pendingHourIdx = idx;
    return;
  }
  isDecoding = true;
  pendingHourIdx = null;
  try {
    const hour = modelState.hourList[idx];
    document.getElementById("arome-hour-label").textContent = fmtHourLabel(hour);

    const cacheKey = bitmapCacheKey(hour);
    const cachedEntry = bitmapCache.get(cacheKey);
    if (cachedEntry) {
      modelState.currentHour = hour;
      await presentBitmapEntry(hour, cachedEntry);
      queueTooltipValueHydration(idx, hour);
      return;
    }

    modelState.currentHour = hour;
    const renderEntry = await renderModelHourViaWorker(idx, { includeValues: true });
    if (!renderEntry) {
      showUnavailableHour(hour);
      return;
    }

    const entry = makeBitmapCacheEntryFromWorker(renderEntry);
    bitmapCache.set(cacheKey, entry);
    updateWarmupProgress();
    await presentBitmapEntry(hour, entry, { values: renderEntry.values });

  } catch (err) {
    console.error("showHour:", err);
    showUnavailableHour(modelState?.hourList[idx] ?? idx);
  } finally {
    isDecoding = false;
    if (pendingHourIdx !== null) {
      const next = pendingHourIdx;
      pendingHourIdx = null;
      showHour(next);
    }
  }
}

// Renders all hours in a block into bitmapCache in the background.
// Silently aborts if the variable or package changes (renderGen / modelState guard).
async function prerenderBlock(blockKey) {
  const capturedState = modelState;
  const capturedGen = renderGen;
  const block = capturedState.resources.find((r) => r.key === blockKey);
  if (!block) return;

  for (let hour = block.startHour; hour <= block.endHour; hour++) {
    if (modelState !== capturedState || renderGen !== capturedGen) return;

    const idx = capturedState.hourList.indexOf(hour);
    if (idx === -1) continue;

    const cacheKey = bitmapCacheKey(hour);
    if (bitmapCache.has(cacheKey)) continue; // already rendered (e.g. by showHour)

    const entry = await renderModelHourViaWorker(idx);
    if (!entry) return; // worker stale or crashed — abort this block

    if (modelState === capturedState && renderGen === capturedGen) {
      if (bitmapCache.has(cacheKey)) {
        entry.bitmap.close(); // showHour raced and cached it while we were rendering
      } else {
        bitmapCache.set(cacheKey, makeBitmapCacheEntryFromWorker(entry));
        updateWarmupProgress();
      }
    } else {
      entry.bitmap.close();
      return;
    }
  }
}

function queuePrerenderBlock(blockKey) {
  if (!modelState || !modelState.buffers.has(blockKey)) return;
  const gen = renderGen;
  const state = modelState;
  const queueKey = `${gen}:${blockKey}`;
  if (queuedPrerenderKeys.has(queueKey)) return;
  queuedPrerenderKeys.add(queueKey);
  prerenderQueue.push({ blockKey, gen, state, queueKey });
  updatePerfDiagnostics();
  drainPrerenderQueue();
}

function queuePrerenderForAllBlocks() {
  if (!modelState) return;
  updateWarmupProgress();
  for (const blockKey of modelState.buffers.keys()) {
    queuePrerenderBlock(blockKey);
  }
}

function resolvePrerenderIdle() {
  if (isPrerendering || prerenderQueue.length > 0) return;
  const resolvers = prerenderIdleResolvers;
  prerenderIdleResolvers = [];
  for (const resolve of resolvers) resolve();
}

function waitForPrerenderIdle() {
  if (!isPrerendering && prerenderQueue.length === 0) return Promise.resolve();
  return new Promise((resolve) => prerenderIdleResolvers.push(resolve));
}

async function drainPrerenderQueue() {
  if (isPrerendering) return;
  isPrerendering = true;
  updatePerfDiagnostics();
  try {
    while (prerenderQueue.length > 0) {
      const job = prerenderQueue.shift();
      updatePerfDiagnostics();
      if (modelState === job.state && renderGen === job.gen) {
        await prerenderBlock(job.blockKey);
      }
      queuedPrerenderKeys.delete(job.queueKey);
      updatePerfDiagnostics();
    }
  } finally {
    isPrerendering = false;
    updatePerfDiagnostics();
    if (prerenderQueue.length > 0) {
      drainPrerenderQueue();
    } else {
      resolvePrerenderIdle();
    }
  }
}

function setBlockStatus(block, status) {
  block.status = status;
  modelState?.blockStatus?.set(block.key, status);
  const item = document.getElementById(`dl-${block.key}`);
  if (item) {
    item.classList.remove(...BLOCK_STATUS_CLASSES);
    item.classList.add(status);
    if (status === BLOCK_STATUS.READY) item.classList.add("done");
    item.title = `${formatRunSummary([block])} · ${status}`;
  }
  updateDataStatusSummary();
}

function setBlockDownloadProgress(block, pct) {
  document.getElementById(`dl-${block.key}`)?.style.setProperty("--pct", pct);
}

function resetBlockDownloadProgress(block) {
  setBlockDownloadProgress(block, "0%");
}

function updateDataStatusSummary() {
  const summary = dom.dataStatusSummary;
  if (!summary || !modelState?.resources.length) return;
  const counts = Object.fromEntries(
    Object.values(BLOCK_STATUS).map((status) => [status, 0]),
  );
  for (const block of modelState.resources) {
    const status = block.status ?? BLOCK_STATUS.MISSING;
    counts[status] ??= 0;
    counts[status]++;
  }
  summary.textContent = [
    `${counts[BLOCK_STATUS.READY]} ${BLOCK_STATUS_LABELS[BLOCK_STATUS.READY]}`,
    `${counts[BLOCK_STATUS.LOADED_FROM_CACHE]} ${BLOCK_STATUS_LABELS[BLOCK_STATUS.LOADED_FROM_CACHE]}`,
    `${counts[BLOCK_STATUS.DOWNLOADING]} ${BLOCK_STATUS_LABELS[BLOCK_STATUS.DOWNLOADING]}`,
    `${counts[BLOCK_STATUS.MISSING]} ${BLOCK_STATUS_LABELS[BLOCK_STATUS.MISSING]}`,
    formatRunSummary(modelState.resources),
  ].join(" · ");
}

function blockForHour(hour) {
  return modelState?.resources.find((r) => hour >= r.startHour && hour <= r.endHour) ?? null;
}

function createModelState(packageKey) {
  return {
    packageKey,
    resources: [],
    buffers: new Map(),
    messageIndex: new Map(),
    hourList: [],
    decoded: new Map(),
    decodedOrder: [],
    blockStatus: new Map(),
    variable: null,
    currentHour: null,
    lastRunInfo: null,
    animationCachePrimed: false,
  };
}

function configureModelVariableControls(pkg) {
  const varSelect = dom.aromeVarSelect;
  varSelect.innerHTML = "";

  const pkgVars = pkg.variables;
  const firstVar = pkgVars[0];
  modelState.variable = variableKeyFor(firstVar);
  applyDefaultPalette(variableKeyFor(firstVar));
  varSelect.innerHTML = pkgVars
    .map(
      (v) =>
        `<option value="${variableKeyFor(v)}">${v.name}</option>`,
    )
    .join("");
  varSelect.value = modelState.variable;
  updateLevelInfo(firstVar);
}

function buildHourList(resources) {
  const hourList = [];
  for (const r of resources) {
    for (let h = r.startHour; h <= r.endHour; h++) hourList.push(h);
  }
  return hourList;
}

function renderDownloadItems(resources) {
  const barsEl = dom.aromeDownloadBars;
  const fileListEl = dom.aromeDownloadFileList;
  barsEl.innerHTML = "";
  fileListEl.innerHTML = "";
  for (const r of resources) {
    setBlockStatus(r, BLOCK_STATUS.MISSING);
    const item = document.createElement("div");
    item.className = `arome-dl-item ${BLOCK_STATUS.MISSING}`;
    item.id = `dl-${r.key}`;
    item.textContent = r.key;
    item.title = formatRunSummary([r]);
    barsEl.appendChild(item);

    const li = document.createElement("li");
    li.textContent = `${r.url.split("/").pop()} · ${formatRunId(r.runId)}`;
    fileListEl.appendChild(li);
  }
}

async function loadCachedModelBlock(packageKey, block, downloadKey, onAvailable) {
  const cachedBuffer = await readCachedGribBlock(packageKey, block);
  if (modelState !== downloadKey) return;
  if (cachedBuffer) {
    await onAvailable(block, cachedBuffer, BLOCK_STATUS.LOADED_FROM_CACHE);
    return { status: CACHE_LOAD_RESULT.CURRENT, block };
  }

  const staleCachedBlock = await readLatestCachedGribBlock(packageKey, block);
  if (modelState !== downloadKey) return;
  if (staleCachedBlock) {
    await onAvailable(block, staleCachedBlock.buffer, BLOCK_STATUS.LOADED_FROM_CACHE);
    return { status: CACHE_LOAD_RESULT.STALE, block };
  }

  return { status: CACHE_LOAD_RESULT.MISSING, block };
}

async function refreshModelBlockFromNetwork(packageKey, block, downloadKey, onAvailable) {
  if (modelState !== downloadKey) return;
  setBlockStatus(block, BLOCK_STATUS.DOWNLOADING);
  resetBlockDownloadProgress(block);
  const buffer = await downloadFileProg(
    block.url,
    block.filesize,
    (loaded, total) => {
      if (modelState !== downloadKey) return;
      setBlockDownloadProgress(block, Math.round((loaded / total) * 100) + "%");
    },
  );
  const cacheWriteSucceeded = await writeCachedGribBlock(packageKey, block, buffer);
  if (modelState !== downloadKey) return;
  await onAvailable(block, buffer, BLOCK_STATUS.READY);
  if (cacheWriteSucceeded) await deleteObsoleteCachedGribBlocks(packageKey, block);
}

function createModelDownloadSession({ packageKey, pkg, resources, runSummary, downloadKey }) {
  return {
    packageKey,
    pkg,
    pkgVars: pkg.variables,
    resources,
    runSummary,
    downloadKey,
    slider: dom.aromeSlider,
    availableCount: 0,
    legendInitialized: false,
    presentationQueue: [],
    isPresentingQueuedBlock: false,
  };
}

async function storeModelBlockInWorker(block, buffer) {
  const result = await postModelBlockWorker(
    {
      type: "storeBlock",
      blockKey: block.key,
      buffer,
    },
    [buffer.buffer],
  );
  return Boolean(result?.ok);
}

async function storeAvailableModelBlock(block, buffer, status, session) {
  const hadBuffer = modelState.buffers.has(block.key);
  if (hadBuffer) {
    modelState.messageIndex.delete(block.key);
    invalidateBlockRenderCache(block);
  }
  const storedInWorker = await storeModelBlockInWorker(block, buffer);
  if (!storedInWorker) return;
  modelState.buffers.set(block.key, true);
  setBlockStatus(block, status);
  if (!hadBuffer) session.availableCount++;

  setBlockDownloadProgress(block, "100%");
  dom.aromeDownloadStatus.textContent =
    `Available… ${session.availableCount} / ${session.resources.length} files (${session.runSummary})`;
}

function initializeModelLegendFromBlock(buffer, session) {
  // On first arrival: populate legend/info from header (no CCSDS decode)
  if (session.legendInitialized) return;
  session.legendInitialized = true;
  const curVarDef = findPackageVariable(session.packageKey, modelState.variable);
  const curShortName = curVarDef?.shortName ?? modelState.variable;
  for (const msg of iterateGRIB2Messages(buffer)) {
    const p = msg.product;
    if (!p || p.shortName !== curShortName) continue;
    if (curVarDef?.levelValue != null && p.levelValue !== curVarDef.levelValue) continue;
    modelState.lastRunInfo = `${session.packageKey} · run ${fmtRefTime(msg.header)}`;
    applyDefaultPalette(modelState.variable);
    updateParamInfo(
        p.name,
        parameterDescriptionFor(curShortName),
        modelState.lastRunInfo,
      );
    updateLevelInfo(curVarDef);
    const staticScale = staticScaleFor(curShortName);
    if (staticScale && curVarDef) {
      showColorScale(
        staticScale.min,
        staticScale.max,
        displayUnitsFor(curShortName, curVarDef.units),
      );
    }
    break;
  }
}

async function refreshMapForAvailableModelBlock(block, session) {
  const currentIdx = parseInt(session.slider.value, 10);
  const currentHour = modelState.hourList[currentIdx];
  if (session.availableCount === 1) {
    setMapSceneVisible(true);
    await initMap();
    if (modelState !== session.downloadKey) return;
    map.fitBounds(session.pkg.bounds, { padding: 20, animate: false });
    await showHour(currentIdx);
  } else if (blockForHour(currentHour)?.key === block.key) {
    await showHour(currentIdx);
  }
}

function completeModelDownloadIfReady(session) {
  if (session.availableCount !== session.resources.length) return;
  dom.aromeDownloadStatus.textContent =
    `Available ${session.resources.length} / ${session.resources.length} files (${session.runSummary})`;
  queuePrerenderForAllBlocks();
}

function queueUpdatedBlockPrerender(block, status) {
  if (status !== BLOCK_STATUS.READY) return;
  queuePrerenderBlock(block.key);
}

async function presentAvailableModelBlock(block, buffer, status, session) {
  if (modelState !== session.downloadKey) return;
  initializeModelLegendFromBlock(buffer, session);
  await storeAvailableModelBlock(block, buffer, status, session);
  if (modelState !== session.downloadKey) return;
  await refreshMapForAvailableModelBlock(block, session);
  queueUpdatedBlockPrerender(block, status);
  completeModelDownloadIfReady(session);
}

async function enqueueAvailableModelBlockPresentation(block, buffer, status, session) {
  if (status !== BLOCK_STATUS.READY) {
    await presentAvailableModelBlock(block, buffer, status, session);
    return;
  }

  session.presentationQueue.push({ block, buffer, status, session });
  if (session.isPresentingQueuedBlock) return;

  session.isPresentingQueuedBlock = true;
  try {
    while (session.presentationQueue.length > 0) {
      const job = session.presentationQueue.shift();
      await scheduleLowPriorityWork();
      if (modelState !== session.downloadKey) return;
      await presentAvailableModelBlock(job.block, job.buffer, job.status, job.session);
    }
  } finally {
    session.isPresentingQueuedBlock = false;
  }
}

async function startDownload(packageKey) {
  const pkg = PACKAGES[packageKey];
  modelState = createModelState(packageKey);
  setMapSceneVisible(false);
  const downloadKey = modelState;

  configureModelVariableControls(pkg);

  const slider = dom.aromeSlider;
  slider.value = 0;

  dom.aromeDownloadStatus.textContent =
    "Fetching file list…";

  let resources;
  try {
    resources = await fetchDataGouvResources(pkg.datasetId, pkg.titlePattern);
    if (modelState !== downloadKey) return;
    if (pkg.skipHour0) resources = resources.filter((r) => r.startHour > 0);
  } catch (e) {
    if (modelState !== downloadKey) return;
    dom.aromeDownloadStatus.textContent =
      "API error: " + e.message;
    return;
  }

  modelState.resources = resources;
  modelState.hourList = buildHourList(resources);
  slider.max = modelState.hourList.length - 1;
  const runSummary = formatRunSummary(resources);

  dom.aromeDownloadStatus.textContent =
    `Downloading ${resources.length} ${packageKey} files (${runSummary})…`;
  renderDownloadItems(resources);
  const session = createModelDownloadSession({ packageKey, pkg, resources, runSummary, downloadKey });

  const cacheResults = await runWithConcurrency(
    resources,
    MAX_PARALLEL_DOWNLOADS,
    async (block) => {
      return loadCachedModelBlock(packageKey, block, downloadKey, async (block, buffer, status) => {
        await enqueueAvailableModelBlockPresentation(block, buffer, status, session);
      });
    },
  );
  const missingBlocks = cacheResults
    .filter((result) => result?.status === CACHE_LOAD_RESULT.MISSING)
    .map((result) => result.block);
  const blocksNeedingRefresh = cacheResults
    .filter((result) => result?.status === CACHE_LOAD_RESULT.STALE)
    .map((result) => result.block);

  if (modelState !== downloadKey) return;
  await runWithConcurrency(
    missingBlocks,
    MAX_PARALLEL_DOWNLOADS,
    async (block) => {
      await refreshModelBlockFromNetwork(packageKey, block, downloadKey, async (block, buffer, status) => {
        await enqueueAvailableModelBlockPresentation(block, buffer, status, session);
      });
    },
  );
  if (modelState !== downloadKey) return;

  queuePrerenderForAllBlocks();
  await waitForPrerenderIdle();
  if (modelState !== downloadKey) return;

  await runWithConcurrency(
    blocksNeedingRefresh,
    MAX_PARALLEL_DOWNLOADS,
    async (block) => {
      await refreshModelBlockFromNetwork(packageKey, block, downloadKey, async (block, buffer, status) => {
        await enqueueAvailableModelBlockPresentation(block, buffer, status, session);
      });
    },
  );
}

// ── Router (hash-based) ───────────────────────────────────────────────────────

function showView(name) {
  for (const id of ["view-home", "view-grid"])
    document.getElementById(id).style.display =
      id === name ? "block" : "none";
}

function setToolbarMode(mode) {
  const isGrid = mode === "grid";
  document.getElementById("back-btn").style.display = isGrid ? "block" : "none";
  document.getElementById("arome-back-btn").style.display = isGrid ? "none" : "block";
  document.getElementById("grid-toolbar").style.display = isGrid ? "flex" : "none";
  document.getElementById("arome-player-toolbar").style.display = isGrid ? "none" : "flex";
}

function route() {
  const hash = location.hash;
  if (hash.startsWith("#grid/")) {
    showView("view-grid");
    setToolbarMode("grid");
    showGridView(decodeURIComponent(hash.slice(6)));
  } else if (hash.startsWith("#arome/")) {
    const packageKey = hash.slice(7);
    if (!PACKAGES[packageKey]) {
      location.hash = "";
      return;
    }
    showView("view-grid");
    setToolbarMode("arome");
    dom.dataStatusPanel.style.display = "block";
    if (modelState?.packageKey !== packageKey) {
      resetModelState();
      startDownload(packageKey);
    }
  } else {
    showView("view-home");
  }
}

function groupPackagesByModel(packages) {
  const groups = {};
  for (const [key, pkg] of Object.entries(packages)) {
    if (!groups[pkg.model]) groups[pkg.model] = [];
    groups[pkg.model].push({ key, pkg });
  }
  return groups;
}

function createModelMetaElement(info) {
  const meta = document.createElement("div");
  meta.className = "model-meta";
  for (const [label, value, wide] of [
    ["Resolution", info.resolution],
    ["Forecast horizon", info.horizon],
    ["Files", info.filesInfo],
    ["Coverage", `${info.domain} — ${info.domainDesc}`, true],
  ]) {
    const item = document.createElement("div");
    item.className = wide ? "meta-item meta-item-full" : "meta-item";
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
  return meta;
}

function createModelPackageElement(key, pkg) {
  const pkgEl = document.createElement("div");
  pkgEl.className = "model-package";

  const btn = document.createElement("button");
  btn.className = "btn-primary";
  btn.textContent = key.split("_").pop();
  btn.addEventListener("click", () => { location.hash = `#arome/${key}`; });
  pkgEl.appendChild(btn);

  const vars = document.createElement("ul");
  vars.className = "model-package-vars";
  for (const v of pkg.variables) {
    const li = document.createElement("li");
    li.textContent = v.name;
    vars.appendChild(li);
  }
  pkgEl.appendChild(vars);

  return pkgEl;
}

function createModelSectionElement(modelName, entries) {
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

  section.appendChild(createModelMetaElement(info));

  const pkgsLabel = document.createElement("p");
  pkgsLabel.className = "model-packages-label";
  pkgsLabel.textContent = "Last available run";
  section.appendChild(pkgsLabel);

  const pkgsEl = document.createElement("div");
  pkgsEl.className = "model-packages";
  for (const { key, pkg } of entries) {
    pkgsEl.appendChild(createModelPackageElement(key, pkg));
  }
  section.appendChild(pkgsEl);

  return section;
}

function renderModelList() {
  const container = document.getElementById("model-list");
  const groups = groupPackagesByModel(PACKAGES);
  for (const [modelName, entries] of Object.entries(groups)) {
    container.appendChild(createModelSectionElement(modelName, entries));
  }
}

renderModelList();

const animationPlayer = createAnimationPlayer({
  playButton: document.getElementById("player-play"),
  resetButton: document.getElementById("player-reset"),
  slider: dom.aromeSlider,
  iconPlay: document.getElementById("icon-play"),
  iconPause: document.getElementById("icon-pause"),
  getModelState: () => modelState,
  isBitmapCacheComplete,
  isAnimationCacheReadyForPlayback,
  queueCurrentTooltipValueHydration,
  queuePrerenderForAllBlocks,
  waitForPrerenderIdle,
  showHour,
  updateWarmupProgress,
});

window.addEventListener("hashchange", route);
route();

// ── Event wiring ──────────────────────────────────────────────────────────────

const dropZone = document.getElementById("drop-zone");
const fileInput = document.getElementById("file-input");

dropZone.addEventListener("click", () => fileInput.click());
dropZone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") fileInput.click();
});
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) processFile(fileInput.files[0]);
});
dropZone.addEventListener("dragover", (e) => {
  e.preventDefault();
  dropZone.classList.add("over");
});
dropZone.addEventListener("dragleave", () =>
  dropZone.classList.remove("over"),
);
dropZone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropZone.classList.remove("over");
  if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]);
});

document.getElementById("cards").addEventListener("click", (e) => {
  const btn = e.target.closest(".btn-grid");
  if (btn) location.hash = "#grid/" + encodeURIComponent(btn.dataset.var);
});

document.getElementById("back-btn").addEventListener("click", () => {
  clearMapLayer();
  location.hash = "";
});

async function refreshCurrentModelVisuals({ clearDecoded = false } = {}) {
  stopPlayer();
  await new Promise(r => requestAnimationFrame(r));
  setRendering(true);
  await new Promise(r => setTimeout(r, 0));
  if (clearDecoded) {
    modelState.decoded.clear();
    modelState.decodedOrder = [];
  }
  invalidateBitmapCache();
  const myGen = renderGen;
  showHour(parseInt(dom.aromeSlider.value, 10));
  queuePrerenderForAllBlocks();
  if (renderGen === myGen) setRendering(false);
}

async function onPaletteChange(e) {
  currentPalette = e.target.value;
  setPaletteSelectValues(currentPalette);
  if (!gridState) return;
  if (modelState) {
    await refreshCurrentModelVisuals();
  } else {
    await rerenderUploadedGridView();
  }
}
document
  .getElementById("palette-select")
  .addEventListener("change", onPaletteChange);
document
  .getElementById("palette-select-arome")
  .addEventListener("change", onPaletteChange);

// ── Model player events ───────────────────────────────────────────────────────

document
  .getElementById("arome-back-btn")
  .addEventListener("click", resetApp);

dom.aromeVarSelect
  .addEventListener("change", async (e) => {
    if (!modelState) return;
    const varKey = e.target.value;
    modelState.variable = varKey;
    const varDef = findPackageVariable(modelState.packageKey, varKey);
    const shortName = varDef?.shortName ?? varKey;
    applyDefaultPalette(varKey);

    // Immediately sync gv-meta — the async decode may be delayed or queued.
    if (varDef) {
      updateParamInfo(
        varDef.name,
        parameterDescriptionFor(shortName),
        modelState.lastRunInfo ?? modelState.packageKey,
      );
      updateLevelInfo(varDef);
    }

    await refreshCurrentModelVisuals({ clearDecoded: true });
  });

const aromeSlider = dom.aromeSlider;
aromeSlider.addEventListener("input", () => {
  if (!modelState) return;
  showHour(parseInt(aromeSlider.value, 10));
});

// ── Mini-player ───────────────────────────────────────────────────────────────

function stopPlayer() {
  animationPlayer.stopPlayer();
}

function syncPlayButtonAvailability() {
  animationPlayer.syncPlayButtonAvailability();
}

document.getElementById("clear-grib-cache").addEventListener("click", async () => {
  await clearGribCache();
  dom.aromeDownloadStatus.textContent = "Download cache cleared.";
});

document.addEventListener("keydown", (e) => {
  if (e.code !== "Space" || !modelState) return;
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "BUTTON") return;
  e.preventDefault();
  document.getElementById("player-play").click();
});

updatePerfDiagnostics();
