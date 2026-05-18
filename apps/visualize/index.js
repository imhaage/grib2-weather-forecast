const PROXY = "https://grib2-cors-proxy.imh.workers.dev";
import {
  displayUnitsFor,
  unitFnFor,
  unitTransformFor,
} from "./src/domain/unit-transforms.js";
import { buildLUT, LOG_SCALE_FLOOR, makeScale } from "./src/domain/palettes.js";
import {
  extractRunId,
  formatRunId,
  formatRunSummary,
  runTimeValue,
} from "./src/domain/resources.js";
import {
  defaultPaletteFor,
  parameterDescriptionFor,
  staticScaleFor,
  variableKeyFor,
} from "./src/domain/variable-metadata.js";
import {
  findPackageVariable,
  MODEL_INFO,
  PACKAGES,
} from "./src/domain/model-packages.js";
import { createAnimationPlayer } from "./animation-player.js";
import { createDownloadWorker } from "./src/workers/download-worker-client.js";
import { createAnimationCacheService } from "./src/services/animation-cache-service.js";
import { createMapRendererService } from "./src/services/map-renderer-service.js";
import { createModelBlockService } from "./src/services/model-block-service.js";
import {
  clearGribCache,
  deleteObsoleteCachedGribBlocks,
  readCachedGribBlock,
  readLatestCachedGribBlock,
  writeCachedGribBlock,
} from "./src/services/grib-cache-service.js";
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
const DECODED_CACHE_SIZE = 2;
const RASTER_OPACITY = 0.8;
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

// ── State ─────────────────────────────────────────────────────────────────────
let fileState = null; // { messages: Array }
let gridState = null; // { values, min, range, grid, product }
let currentPalette = "Plasma";
let modelState = null; // { packageKey, resources, buffers, messageIndex, hourList, decoded, decodedOrder, variable, currentHour, lastRunInfo }
let isDecoding = false;
let pendingHourIdx = null;
let renderWorker = null;
let modelBlockService = null;
let downloadWorker = null;
let renderGen = 0;
let nextCallId = 0;
const animationCache = createAnimationCacheService();
let tooltipHydrateTimer = null;
let tooltipHydrateToken = 0;
const MAX_PARALLEL_DOWNLOADS = 6;
const PERF_DEBUG = new URLSearchParams(window.location.search).get("debug") === "perf";
const perfStats = {
  lastRenderMs: null,
  lastDecodeMs: null,
};
const mapRenderer = createMapRendererService({
  canvasHeightForGrid: mercatorCanvasHeight,
  getGridState: () => gridState,
  getMapScene: () => dom.mapScene,
  missingValue: MISSING_VALUE,
  rasterOpacity: RASTER_OPACITY,
  tooltipEl: document.getElementById("map-tooltip"),
  wrapEl: document.getElementById("map-wrap"),
});
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

function updatePerfDiagnostics() {
  if (!PERF_DEBUG) return;
  const panel = document.getElementById("perf-debug");
  if (!panel) return;

  const totalBitmaps = modelState?.hourList.length ?? 0;
  const readyBitmaps = totalBitmaps ? bitmapCacheReadyCount() : animationCache.size;
  const decodedSize = modelState?.decoded?.size ?? 0;

  panel.hidden = false;
  document.getElementById("perf-debug-render").textContent =
    `render ${fmtPerfMs(perfStats.lastRenderMs)}`;
  document.getElementById("perf-debug-decode").textContent =
    `decode ${fmtPerfMs(perfStats.lastDecodeMs)}`;
  document.getElementById("perf-debug-queue").textContent =
    `queue ${animationCache.queueLength}${animationCache.isPrerendering ? " + active" : ""}`;
  document.getElementById("perf-debug-cache").textContent =
    `cache ${readyBitmaps} / ${totalBitmaps || animationCache.size}`;
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
  mapRenderer.setVisible(visible);
}

function initRenderWorker() {
  if (renderWorker) return;
  renderWorker = new Worker(
    new URL("./render-worker.js", import.meta.url),
    { type: "module" },
  );
}

function initDownloadWorker() {
  if (downloadWorker) return;
  downloadWorker = createDownloadWorker();
}

function downloadFileInWorker(url, filesize, onProgress) {
  initDownloadWorker();
  const callId = ++nextCallId;
  return new Promise((resolve, reject) => {
    function onMsg({ data }) {
      if (data.callId !== callId) return;
      if (data.progress) {
        onProgress(data.loaded, data.total);
        return;
      }
      downloadWorker.removeEventListener("message", onMsg);
      downloadWorker.removeEventListener("error", onErr);
      if (data.error) {
        reject(new Error(data.error));
        return;
      }
      resolve(new Uint8Array(data.buffer));
    }
    function onErr(error) {
      downloadWorker.removeEventListener("message", onMsg);
      downloadWorker.removeEventListener("error", onErr);
      reject(error);
    }
    downloadWorker.addEventListener("message", onMsg);
    downloadWorker.addEventListener("error", onErr);
    downloadWorker.postMessage({ callId, url, filesize });
  });
}

function getModelBlockService() {
  if (!modelBlockService) modelBlockService = createModelBlockService();
  return modelBlockService;
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
  if (modelState) modelState.animationCacheStatus = "waiting";
  animationCache.clear();
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
    animationCache.removeHour(hour);
    evictDecodedHour(hour);
  }
  updateWarmupProgress();
}

function bitmapCacheKey(hour) {
  return animationCache.keyForHour(hour);
}

function bitmapCacheReadyCount() {
  if (!modelState) return 0;
  return animationCache.readyCount(modelState.hourList);
}

function isBitmapCacheComplete() {
  return animationCache.isComplete(modelState?.hourList ?? []);
}

function isAnimationCacheReadyForPlayback() {
  return Boolean(modelState && modelState.animationCacheStatus === "ready" && isBitmapCacheComplete());
}

function updateWarmupProgress() {
  const container = dom.cacheWarmup;
  if (!container || !modelState?.hourList.length) {
    if (container) container.hidden = true;
    syncPlayButtonAvailability();
    return;
  }

  const total = modelState.hourList.length;
  const ready = bitmapCacheReadyCount();
  const complete = ready === total;
  if (modelState.animationCacheStatus === "building" && complete) {
    modelState.animationCacheStatus = "ready";
  }
  const isWaiting = modelState.animationCacheStatus === "waiting";
  const isReady = modelState.animationCacheStatus === "ready";
  const pct = total ? Math.round((ready / total) * 100) : 0;

  container.hidden = isReady;
  container.classList.toggle("waiting", isWaiting);
  container.classList.toggle("ready", isReady);
  document.getElementById("cache-warmup-bar").style.width = `${pct}%`;
  document.getElementById("cache-warmup-count").textContent = `${ready} / ${total}`;
  document.getElementById("cache-warmup-label").textContent = isWaiting
    ? "Preparing animation cache"
    : isReady
    ? "Animation ready"
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

function applyDefaultPalette(shortName) {
  const pal = defaultPaletteFor(shortName);
  if (!pal) return;
  currentPalette = pal;
  setPaletteSelectValues(pal);
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

function clearMapLayer() {
  mapRenderer.clearLayer();
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
  mapRenderer.setLayer(canvas, corners);
}

function ensureHeatCanvas(grid) {
  return mapRenderer.ensureHeatCanvas(grid);
}

function drawBitmapToHeatCanvas(bitmap) {
  mapRenderer.drawBitmap(bitmap);
}

function updateStatsAndColorScale(entry) {
  updateStats(entry.dataMin, entry.dataMax, entry.mean, entry.count, entry.displayUnits);
  const legendMin = entry.staticScale ? entry.renderMin : entry.dataMin;
  const legendMax = entry.staticScale ? entry.renderMin + entry.range : entry.dataMax;
  showColorScale(legendMin, legendMax, entry.displayUnits);
}

// Create the MapLibre map once. fitBoundsArgs is optional [bounds, options].
async function initMap(fitBoundsArgs) {
  await mapRenderer.init(fitBoundsArgs);
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

  const { canvas, outH } = ensureHeatCanvas(gr);
  const corners = gridCorners(gr);
  const statsEntry = await renderViaWorker(p.values, p, gr.ni, outH);
  if (!statsEntry) return;
  const entry = makeBitmapCacheEntry(statsEntry, p);

  drawBitmapToHeatCanvas(statsEntry.bitmap);
  statsEntry.bitmap.close();

  await initMap();
  setMapLayer(canvas, corners);
  mapRenderer.fitBounds(
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
  mapRenderer.triggerRepaint();
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

async function fetchPackageResources(packageKey, downloadKey) {
  const pkg = PACKAGES[packageKey];
  let resources = await fetchDataGouvResources(pkg.datasetId, pkg.titlePattern);
  if (modelState !== downloadKey) return null;
  if (pkg.skipHour0) resources = resources.filter((r) => r.startHour > 0);
  return resources;
}

async function downloadFileProg(url, filesize, onProgress) {
  return downloadFileInWorker(proxyUrl(url), filesize, onProgress);
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
  const result = await getModelBlockService().renderHour(request);
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
  const result = await getModelBlockService().decodeValues(request);
  if (!result?.values || renderGen !== request.gen) return null;
  return result;
}

async function presentBitmapEntry(hour, entry, { values } = {}) {
  const { grid, product, header } = entry;
  hideMapUnavailable();

  gridState = makeGridState(entry, values ?? null);

  const { canvas, canvasChanged } = ensureHeatCanvas(grid);
  const corners = gridCorners(grid);
  drawBitmapToHeatCanvas(entry.bitmap);

  const sc = makeScale(currentPalette);
  const stops = Array.from({ length: 8 }, (_, i) => sc(i / 7).css()).join(", ");
  document.getElementById("cs-bar").style.background = `linear-gradient(to right, ${stops})`;

  await initMap();
  const isFirstLayer = !mapRenderer.hasLayer();
  if (isFirstLayer || canvasChanged) {
    setMapLayer(canvas, corners);
    mapRenderer.fitBounds(
      [[corners[3][0], corners[2][1]], [corners[1][0], corners[0][1]]],
      { padding: 20, animate: false },
    );
  }
  mapRenderer.triggerRepaint();

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

  const cachedEntry = animationCache.getHour(hour);
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
  if (animationCache.hasHour(hour)) queueTooltipValueHydration(idx, hour);
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

    const cachedEntry = animationCache.getHour(hour);
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
    animationCache.setHour(hour, entry);
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

// Renders all hours in a block into the animation cache in the background.
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

    if (animationCache.hasHour(hour)) continue; // already rendered (e.g. by showHour)

    const entry = await renderModelHourViaWorker(idx);
    if (!entry) return; // worker stale or crashed — abort this block

    if (modelState === capturedState && renderGen === capturedGen) {
      if (animationCache.hasHour(hour)) {
        entry.bitmap.close(); // showHour raced and cached it while we were rendering
      } else {
        animationCache.setHour(hour, makeBitmapCacheEntryFromWorker(entry));
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
  const queued = animationCache.enqueueBlock(blockKey, gen, state);
  if (!queued) return;
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

function waitForPrerenderIdle() {
  return animationCache.waitForIdle();
}

async function drainPrerenderQueue() {
  if (!animationCache.beginDrain()) return;
  updatePerfDiagnostics();
  try {
    let job = animationCache.nextJob();
    while (job) {
      updatePerfDiagnostics();
      if (modelState === job.state && renderGen === job.gen) {
        await prerenderBlock(job.blockKey);
      }
      animationCache.completeJob(job);
      updatePerfDiagnostics();
      job = animationCache.nextJob();
    }
  } finally {
    animationCache.endDrain();
    updatePerfDiagnostics();
    if (animationCache.queueLength > 0) {
      drainPrerenderQueue();
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
    animationCacheStatus: "waiting",
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
    presentationIdleResolvers: [],
    isPresentingQueuedBlock: false,
  };
}

function applyModelResources(resources) {
  modelState.resources = resources;
  modelState.hourList = buildHourList(resources);
  const slider = dom.aromeSlider;
  slider.max = modelState.hourList.length - 1;
  if (Number(slider.value) > Number(slider.max)) slider.value = slider.max;
}

function resourcesByBlockKey(resources) {
  return new Map(resources.map((block) => [block.key, block]));
}

function isModelBlockInMemoryCurrent(block, previousBlock) {
  return Boolean(
    previousBlock &&
    modelState.buffers.has(block.key) &&
    previousBlock.filesize === block.filesize &&
    runTimeValue(previousBlock.runId) >= runTimeValue(block.runId),
  );
}

function isModelBlockInMemoryStale(block, previousBlock) {
  return Boolean(
    previousBlock &&
    modelState.buffers.has(block.key) &&
    runTimeValue(previousBlock.runId) < runTimeValue(block.runId),
  );
}

function markInMemoryModelBlockAvailable(block, status, session) {
  setBlockStatus(block, status);
  setBlockDownloadProgress(block, "100%");
  session.availableCount++;
  dom.aromeDownloadStatus.textContent =
    `Available… ${session.availableCount} / ${session.resources.length} files (${session.runSummary})`;
  completeModelDownloadIfReady(session);
}

async function storeModelBlockInWorker(block, buffer) {
  return getModelBlockService().storeBlock(block, buffer);
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
    mapRenderer.fitBounds(session.pkg.bounds, { padding: 20, animate: false });
    await showHour(currentIdx);
  } else if (blockForHour(currentHour)?.key === block.key) {
    await showHour(currentIdx);
  }
}

function completeModelDownloadIfReady(session) {
  if (session.availableCount !== session.resources.length) return;
  dom.aromeDownloadStatus.textContent =
    `Available ${session.resources.length} / ${session.resources.length} files (${session.runSummary})`;
}

async function presentAvailableModelBlock(block, buffer, status, session) {
  if (modelState !== session.downloadKey) return;
  initializeModelLegendFromBlock(buffer, session);
  await storeAvailableModelBlock(block, buffer, status, session);
  if (modelState !== session.downloadKey) return;
  await refreshMapForAvailableModelBlock(block, session);
  completeModelDownloadIfReady(session);
}

async function buildAnimationCacheAfterNetworkSettles(session) {
  if (modelState !== session.downloadKey) return;
  modelState.animationCacheStatus = "building";
  updateWarmupProgress();
  queuePrerenderForAllBlocks();
  await waitForPrerenderIdle();
  if (modelState !== session.downloadKey) return;
  modelState.animationCacheStatus = isBitmapCacheComplete() ? "ready" : "waiting";
  updateWarmupProgress();
}

function resolvePresentationIdle(session) {
  const resolvers = session.presentationIdleResolvers.splice(0);
  for (const resolve of resolvers) resolve();
}

function waitForPresentationIdle(session) {
  if (!session.isPresentingQueuedBlock && session.presentationQueue.length === 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    session.presentationIdleResolvers.push(resolve);
  });
}

async function refreshModelBlocksToLatest(session, { previousResources = [] } = {}) {
  const previousBlocks = resourcesByBlockKey(previousResources);
  const cacheResults = await runWithConcurrency(
    session.resources,
    MAX_PARALLEL_DOWNLOADS,
    async (block) => {
      const previousBlock = previousBlocks.get(block.key);
      if (isModelBlockInMemoryCurrent(block, previousBlock)) {
        markInMemoryModelBlockAvailable(block, BLOCK_STATUS.LOADED_FROM_CACHE, session);
        return { status: CACHE_LOAD_RESULT.CURRENT, block };
      }
      if (isModelBlockInMemoryStale(block, previousBlock)) {
        markInMemoryModelBlockAvailable(block, BLOCK_STATUS.LOADED_FROM_CACHE, session);
        return { status: CACHE_LOAD_RESULT.STALE, block };
      }
      return loadCachedModelBlock(session.packageKey, block, session.downloadKey, async (block, buffer, status) => {
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

  if (modelState !== session.downloadKey) return false;
  await runWithConcurrency(
    missingBlocks,
    MAX_PARALLEL_DOWNLOADS,
    async (block) => {
      await refreshModelBlockFromNetwork(session.packageKey, block, session.downloadKey, async (block, buffer, status) => {
        await enqueueAvailableModelBlockPresentation(block, buffer, status, session);
      });
    },
  );
  if (modelState !== session.downloadKey) return false;
  await waitForPresentationIdle(session);
  if (modelState !== session.downloadKey) return false;

  await runWithConcurrency(
    blocksNeedingRefresh,
    MAX_PARALLEL_DOWNLOADS,
    async (block) => {
      await refreshModelBlockFromNetwork(session.packageKey, block, session.downloadKey, async (block, buffer, status) => {
        await enqueueAvailableModelBlockPresentation(block, buffer, status, session);
      });
    },
  );
  await waitForPresentationIdle(session);
  return modelState === session.downloadKey;
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
    if (session.presentationQueue.length === 0) resolvePresentationIdle(session);
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
    resources = await fetchPackageResources(packageKey, downloadKey);
    if (modelState !== downloadKey || !resources) return;
  } catch (e) {
    if (modelState !== downloadKey) return;
    dom.aromeDownloadStatus.textContent =
      "API error: " + e.message;
    return;
  }

  applyModelResources(resources);
  const runSummary = formatRunSummary(resources);

  dom.aromeDownloadStatus.textContent =
    `Downloading ${resources.length} ${packageKey} files (${runSummary})…`;
  renderDownloadItems(resources);
  const session = createModelDownloadSession({ packageKey, pkg, resources, runSummary, downloadKey });
  updateWarmupProgress();

  const latestReady = await refreshModelBlocksToLatest(session);
  if (!latestReady) return;

  await buildAnimationCacheAfterNetworkSettles(session);
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
  showHour,
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
  setRendering(false);
  if (clearDecoded) {
    modelState.decoded.clear();
    modelState.decodedOrder = [];
  }
  invalidateBitmapCache();
  const myGen = renderGen;
  await showHour(parseInt(dom.aromeSlider.value, 10));
  const session = await refreshCurrentModelResourcesToLatest();
  if (session && renderGen === myGen) await buildAnimationCacheAfterNetworkSettles(session);
}

async function refreshCurrentModelResourcesToLatest() {
  const downloadKey = modelState;
  const packageKey = modelState.packageKey;
  const pkg = PACKAGES[packageKey];
  const previousResources = modelState.resources;

  dom.aromeDownloadStatus.textContent = "Checking latest files…";
  let resources;
  try {
    resources = await fetchPackageResources(packageKey, downloadKey);
  } catch (e) {
    if (modelState === downloadKey) dom.aromeDownloadStatus.textContent = "API error: " + e.message;
    return null;
  }
  if (modelState !== downloadKey || !resources) return null;

  applyModelResources(resources);
  const runSummary = formatRunSummary(resources);
  dom.aromeDownloadStatus.textContent =
    `Checking ${resources.length} ${packageKey} files (${runSummary})…`;
  renderDownloadItems(resources);

  const session = createModelDownloadSession({ packageKey, pkg, resources, runSummary, downloadKey });
  const latestReady = await refreshModelBlocksToLatest(session, { previousResources });
  return latestReady ? session : null;
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
