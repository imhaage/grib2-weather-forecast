import maplibregl from "https://esm.sh/maplibre-gl@4";

const PROXY = "https://grib2-cors-proxy.imh.workers.dev";
import chroma from "https://esm.sh/chroma-js@2.4.2";
import {
  iterateGRIB2Messages,
  decodeGRIB2,
  MISSING_VALUE,
  computeStats,
  CENTRES,
  GENERATING_PROCESS,
  fmtRefTime,
  fmtLevel,
  fmtValidTime,
} from "grib2-decoder";

// Populate all palette selects from the shared template
const paletteTemplate = document.getElementById("palette-options");
for (const sel of document.querySelectorAll(
  "#palette-select, #palette-select-arome",
)) {
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

const PARAM_DESCRIPTIONS = {
  t: "Air temperature measured 2m above ground. The standard reference for what people feel outdoors. Key for assessing frost risk, heatwaves, and thermal comfort.",
  r: "Moisture content of the air relative to its saturation point, at 2m above ground. Values above 80% indicate damp, foggy, or precipitation-prone conditions. Below 30%, the air is dry — increasing wildfire risk and discomfort.",
  u: "East–west component of wind speed at 10m above ground. Positive = blowing eastward, negative = blowing westward. Combined with the V component, you can derive actual wind speed and direction.",
  v: "North–south component of wind speed at 10m above ground. Positive = blowing northward, negative = southward. Combined with the U component, you can derive actual wind speed and direction.",
  ugust:
    "East–west component of the maximum wind gust at 10m. Gusts are brief, intense bursts significantly stronger than the average wind. Combined with vgust, reveals the direction and peak intensity — critical for storm safety assessments.",
  vgust:
    "North–south component of the maximum wind gust at 10m. Combined with ugust, reveals the direction and peak intensity — critical for storm safety assessments.",
  p: "Atmospheric pressure at ground level, in hPa. High pressure (>1013 hPa) is typically associated with fair weather; low pressure signals approaching fronts or storms. Useful for tracking large-scale weather systems.",
  cape: "A measure of the atmosphere's fuel for thunderstorm development. Values above 500 J/kg suggest moderate storm potential; above 2500 J/kg, severe weather with large hail and strong winds becomes likely.",
  lcc: "Fraction of the sky covered by low-altitude clouds (below ~2km), such as stratus and fog layers. Directly affects visibility, sunlight at ground level, and daytime heating.",
  mcc: "Fraction of the sky covered by mid-level clouds (~2–6km), often associated with frontal systems and stratiform precipitation.",
  hcc: "Fraction of the sky covered by high-altitude clouds (above ~6km), such as cirrus. These thin ice clouds rarely produce rain directly but can indicate an approaching weather system.",
  tgrp: "Rate of falling graupel (soft hail / snow pellets), in mm/h. Graupel forms inside convective clouds and is often a precursor to larger hail or intense thunderstorms.",
  rrate:
    "Intensity of liquid precipitation at a given moment, in mm/h. Below 1 mm/h is light rain; 1–10 mm/h is moderate; above 10 mm/h is heavy. Key for flash flood risk and outdoor planning.",
  srate:
    "Intensity of snowfall (liquid equivalent), in mm/h. Even modest values can rapidly create dangerous road conditions and reduce visibility, especially at temperatures well below 0°C.",
};


// ── State ─────────────────────────────────────────────────────────────────────
let fileState = null; // { messages: Array }
let gridState = null; // { values, min, range, grid, product }
let currentPalette = "Plasma";
let map = null; // MapLibre instance (created once, reused)
let heatCanvas = null; // offscreen canvas for heatmap rendering
let modelState = null; // { packageKey, resources, buffers, messageIndex, hourList, decoded, decodedOrder, variable, currentHour, lastRunInfo }
let isDecoding = false;
let pendingHourIdx = null;
let playerInterval = null;
let renderWorker = null;
let renderGen = 0;
let nextCallId = 0;
let bitmapCache = new Map(); // cacheKey → {bitmap, dataMin, dataMax, mean, count}
// ── Helpers ───────────────────────────────────────────────────────────────────

function setRendering(on) {
  document.getElementById("map-scene").classList.toggle("rendering", on);
}

function initRenderWorker() {
  if (renderWorker) return;
  renderWorker = new Worker(new URL("./render-worker.js", import.meta.url));
}

// Sends raw values to the worker, returns Promise<{bitmap,dataMin,dataMax,mean,count}|null>.
// Returns null if renderGen changed before the worker responds (stale result).
// Values are copied (slice) so the decode cache entry remains valid.
function renderViaWorker(values, renderParams, outW, outH) {
  initRenderWorker();
  const myGen = renderGen;
  const myCallId = ++nextCallId;

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

    const valuesCopy = values.slice();
    const lut = buildLUT(currentPalette);
    renderWorker.postMessage({
      callId: myCallId,
      gen: myGen,
      values: valuesCopy,
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
    }, [valuesCopy.buffer]);
  });
}

function invalidateBitmapCache() {
  for (const entry of bitmapCache.values()) entry.bitmap.close();
  bitmapCache = new Map();
  renderGen++;
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

const VARIABLE_PALETTES = {
  t: "TempC",
  r: "Blues",
  u: "Viridis",
  v: "Viridis",
  ugust: "Viridis",
  vgust: "Viridis",
  p: "RdBu",
  cape: "Spectral",
  lcc: "Viridis",
  mcc: "Viridis",
  hcc: "Viridis",
  rrate: "Spectral",
  srate: "Spectral",
  tgrp: "Spectral",
  msl:  "RdBu",
  tcc:  "Viridis",
  wspd: "Spectral",
  wspd_10: "Plasma", wspd_20: "Plasma", wspd_50: "Plasma", wspd_100: "Plasma",
  wdir: "Plasma",
};

// Static color scale ranges for AROME variables (enables timestep comparison).
const DECODED_CACHE_SIZE = 5;
const LOG_SCALE_FLOOR = 0.1;
const RASTER_OPACITY = 0.8;

// Precipitation uses log:true — values are log-normalized between LOG_SCALE_FLOOR and max.
const STATIC_SCALES = {
  t: { min: -25, max: 50 },
  r: { min: 0, max: 100 },
  u: { min: -30, max: 30 },
  v: { min: -30, max: 30 },
  ugust: { min: 0, max: 40 },
  vgust: { min: 0, max: 40 },
  p: { min: 950, max: 1050 },
  cape: { min: 0, max: 4000, zeroThreshold: 0.5 },
  lcc: { min: 0, max: 100, zeroThreshold: 0.005 },
  mcc: { min: 0, max: 100, zeroThreshold: 0.005 },
  hcc: { min: 0, max: 100, zeroThreshold: 0.005 },
  rrate: { min: 0, max: 150, log: true, zeroThreshold: 0.005 },
  srate: { min: 0, max: 20, log: true, zeroThreshold: 0.005 },
  tgrp: { min: 0, max: 15, log: true, zeroThreshold: 0.005 },
  msl:  { min: 950, max: 1050 },
  tcc:  { min: 0, max: 100, zeroThreshold: 0.005 },
  wspd: { min: 0, max: 200 },
  wdir: { min: 0, max: 360 },
};

function displayUnitsFor(shortName, rawUnits) {
  if (shortName === "t")    return "°C";
  if (shortName === "p")    return "hPa";
  if (shortName === "msl")  return "hPa";
  if (shortName === "wspd") return "km/h";
  return rawUnits;
}

// Returns a unit-conversion function for the given unitTransform key, or null if none.
function unitFnFor(ut) {
  switch (ut) {
    case "t":    return (v) => v - 273.15;
    case "wspd": return (v) => v * 3.6;
    case "p":    return (v) => v / 100;
    case "msl":  return (v) => v / 100;
    case "tcc":  return (v) => v * 100;
    default:     return null;
  }
}

function applyDefaultPalette(shortName) {
  const pal = VARIABLE_PALETTES[shortName];
  if (!pal) return;
  currentPalette = pal;
  document.getElementById("palette-select").value = pal;
  document.getElementById("palette-select-arome").value = pal;
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

// Render heatmap into the offscreen heatCanvas, then notify MapLibre.
// The canvas is pre-warped to Web Mercator: each row is inverse-Mercator'd
// back to latitude so the image aligns perfectly with the basemap.
function renderHeatmap() {
  const { values, min, range, grid } = gridState;
  const {
    ni,
    nj,
    latitudeOfFirstPoint: la1,
    latitudeOfLastPoint: la2,
    dj,
  } = grid;
  const lut = buildLUT(currentPalette);
  const sn = gridState.product?.shortName;
  const isLog = gridState.staticScale?.log ?? false;
  // Log scale: normalize v ∈ [0.1, max] logarithmically → [0, 1]
  const logDenom = isLog
    ? Math.log(gridState.staticScale.max / LOG_SCALE_FLOOR)
    : 1;
  const zeroThreshold = gridState.staticScale?.zeroThreshold ?? 0;
  const isTransparentZero = zeroThreshold > 0;
  const outW = heatCanvas.width; // = ni
  const outH = heatCanvas.height; // Mercator-proportional
  const ctx = heatCanvas.getContext("2d");
  const img = ctx.createImageData(outW, outH);
  const px = img.data;

  // Support both N→S (la1 > la2) and S→N (la1 < la2, scanningMode 0x40) grids.
  const northLat = Math.max(la1, la2);
  const southLat = Math.min(la1, la2);
  const isStoN = la2 > la1;
  const myNorth = mercatorY(northLat);
  const mySpan = myNorth - mercatorY(southLat); // always positive

  for (let py = 0; py < outH; py++) {
    // Map output row → Mercator Y → geographic latitude (north=py0, south=pyMax)
    const lat = invMercatorY(myNorth - (py / outH) * mySpan);
    if (lat > northLat || lat < southLat) continue;

    const rowFromNorth = Math.min(
      Math.max(Math.round((northLat - lat) / dj), 0),
      nj - 1,
    );
    const row = isStoN ? nj - 1 - rowFromNorth : rowFromNorth;
    const rowOff = row * ni;
    const imgRow = py * outW;

    for (let col = 0; col < outW; col++) {
      const off = (imgRow + col) * 4;
      const v = values[rowOff + col];
      if (
        v <= MISSING_VALUE ||
        (isTransparentZero && v <= zeroThreshold)
      ) {
        /* transparent — createImageData initialises to rgba(0,0,0,0) */
      } else {
        let t;
        if (isLog) {
          // log-normalize: v=0.1 → 0, v=max → 1; clamp to [0,1]
          t = Math.max(
            0,
            Math.min(
              1,
              Math.log(Math.max(v, LOG_SCALE_FLOOR) / LOG_SCALE_FLOOR) /
                logDenom,
            ),
          );
        } else {
          t = Math.max(0, Math.min(1, (v - min) / range));
        }
        const li = Math.min(Math.round(t * 255), 255) * 3;
        px[off] = lut[li];
        px[off + 1] = lut[li + 1];
        px[off + 2] = lut[li + 2];
        px[off + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);

  // Update legend bar
  const sc = makeScale(currentPalette);
  const stops = Array.from({ length: 8 }, (_, i) => sc(i / 7).css()).join(
    ", ",
  );
  document.getElementById("cs-bar").style.background =
    `linear-gradient(to right, ${stops})`;

  if (map) map.triggerRepaint();
}

// ── Hover tooltip ─────────────────────────────────────────────────────────────

function setupHoverTooltip() {
  const tooltip = document.getElementById("map-tooltip");
  const mapCanvas = map.getCanvas();

  map.on("mousemove", (e) => {
    if (!gridState) return;
    const { lat, lng } = e.lngLat;
    const { grid, values, product } = gridState;
    const {
      ni,
      latitudeOfFirstPoint: la1,
      longitudeOfFirstPoint: lo1,
      latitudeOfLastPoint: la2,
      longitudeOfLastPoint: lo2,
      di,
      dj,
    } = grid;

    const northLat = Math.max(la1, la2);
    const southLat = Math.min(la1, la2);
    const isStoN = la2 > la1;

    // Outside domain
    if (lat > northLat || lat < southLat || lng < lo1 || lng > lo2) {
      tooltip.hidden = true;
      mapCanvas.style.cursor = "";
      return;
    }

    const rowFromNorth = Math.round((northLat - lat) / dj);
    const row = isStoN ? grid.nj - 1 - rowFromNorth : rowFromNorth;
    const col = Math.round((lng - lo1) / di);
    const idx = row * ni + col;
    const rawVal = idx >= 0 && idx < values.length ? values[idx] : MISSING_VALUE;
    if (rawVal <= MISSING_VALUE) {
      tooltip.hidden = true;
      mapCanvas.style.cursor = "default";
      return;
    }

    const val = gridState.unitFn ? gridState.unitFn(rawVal) : rawVal;
    mapCanvas.style.cursor = "crosshair";
    tooltip.hidden = false;
    tooltip.textContent = `${product.name} : ${val.toFixed(2)} ${gridState.displayUnits ?? product.units}`;
    const wrap = document.getElementById("map-wrap");
    const rect = wrap.getBoundingClientRect();
    tooltip.style.left = e.originalEvent.clientX - rect.left + 14 + "px";
    tooltip.style.top = e.originalEvent.clientY - rect.top - 36 + "px";
  });

  map.on("mouseout", () => {
    tooltip.hidden = true;
    mapCanvas.style.cursor = "";
  });
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

function applyToValues(values, fn) {
  const out = new Float64Array(values.length);
  for (let i = 0; i < values.length; i++)
    out[i] = values[i] <= MISSING_VALUE ? MISSING_VALUE : fn(values[i]);
  return out;
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

async function decodeVariableFromBuffer(buffer, shortName) {
  for (const msg of iterateGRIB2Messages(buffer)) {
    if (msg.product.shortName === shortName) {
      const dec = await decodeGRIB2(msg.buffer);
      return {
        values: dec.values,
        grid: dec.grid,
        product: dec.product,
        header: dec.header,
      };
    }
  }
  return null;
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
      container: document.getElementById("map-scene"),
    }),
  );
  setupHoverTooltip();
}

function resetModelState() {
  stopPlayer();
  invalidateBitmapCache();
  setRendering(false);
  modelState = null;
  isDecoding = false;
  pendingHourIdx = null;
  gridState = null;
  document.getElementById("arome-dl-bars").innerHTML = "";
  document.getElementById("arome-dl-file-list").innerHTML = "";
}

function resetApp() {
  fileState = null;
  resetModelState();
  clearMapLayer();
  setStatus("");
  document.getElementById("file-summary").style.display = "none";
  document.getElementById("results").style.display = "none";
  document.getElementById("cards").innerHTML = "";
  document.getElementById("arome-dl-panel").style.display = "none";
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

  const p = msg.product;

  // Populate toolbar
  updateParamInfo(
    p.name,
    PARAM_DESCRIPTIONS[p.shortName] ?? "",
    fmtValidTime(msg.header, p),
  );

  // Reset stats
  for (const id of ["gv-min", "gv-max", "gv-mean", "gv-valid"]) {
    document.getElementById(id).textContent = "—";
  }
  hideColorScale();

  // Switch view
  document.getElementById("view-home").style.display = "none";
  document.getElementById("view-grid").style.display = "block";

  // Decode (WASM)
  let decoded;
  try {
    decoded = await decodeGRIB2(msg.buffer);
  } catch (err) {
    document.getElementById("map").textContent =
      "Decode error: " + err.message;
    return;
  }

  const { values, grid: gr } = decoded;

  // Stats
  const { min, max, mean, count } = computeStats(values);
  const range = max - min || 1;

  updateStats(min, max, mean, count, p.units);

  // Store state (grid + product needed by hover tooltip)
  gridState = { values, min, range, grid: gr, product: p };

  // Offscreen canvas: full grid width, Mercator-proportional height
  heatCanvas = document.createElement("canvas");
  heatCanvas.width = gr.ni;
  heatCanvas.height = mercatorCanvasHeight(gr);

  const corners = gridCorners(gr);
  renderHeatmap();
  await initMap();
  setMapLayer(heatCanvas, corners);
  map.fitBounds(
    [
      [corners[3][0], corners[2][1]],
      [corners[1][0], corners[0][1]],
    ],
    { padding: 20, animate: false },
  );

  // Show color scale
  showColorScale(min, max, p.units);
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
      if (single) return { startHour: +single[1], endHour: +single[1], key: single[0].slice(2, -2), url: r.url, filesize: r.filesize };
      if (range)  return { startHour: +range[1],  endHour: +range[2],  key: range[0].slice(2, -2),  url: r.url, filesize: r.filesize };
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
  if (decoded.has(hour)) return decoded.get(hour);

  const block = resources.find((r) => hour >= r.startHour && hour <= r.endHour);
  if (!block || !modelState.buffers.has(block.key)) return null;

  if (!modelState.messageIndex.has(block.key)) indexBlock(block.key);

  const varDef = PACKAGES[modelState.packageKey]?.variables.find(
    (v) => (v.varKey ?? v.shortName) === variable,
  );
  const lookupKey = varDef?.levelValue != null
    ? `${hour}_${varDef.shortName}_${varDef.levelValue}`
    : `${hour}_${variable}`;
  const msgBuffer = modelState.messageIndex.get(block.key)?.get(lookupKey);
  if (!msgBuffer) return null;

  if (decodedOrder.length >= DECODED_CACHE_SIZE) decoded.delete(decodedOrder.shift());
  const dec = await decodeGRIB2(msgBuffer);
  const data = { values: dec.values, grid: dec.grid, product: dec.product, header: dec.header };
  decoded.set(hour, data);
  decodedOrder.push(hour);
  return data;
}

function indexBlock(blockKey) {
  const buffer = modelState.buffers.get(blockKey);
  const block = modelState.resources.find((r) => r.key === blockKey);
  const index = new Map();
  for (const msg of iterateGRIB2Messages(buffer)) {
    const { product } = msg;
    // PDT 4.8 (accumulation) always has forecastTime=0 (start of interval).
    // For single-hour blocks, use the block's hour as the effective forecast time.
    const ft = (product.pdtNumber === 8 && block.startHour === block.endHour)
      ? block.endHour
      : product.forecastTime;
    index.set(`${ft}_${product.shortName}_${product.levelValue}`, msg.buffer);
    const simpleKey = `${ft}_${product.shortName}`;
    if (!index.has(simpleKey)) index.set(simpleKey, msg.buffer);
  }
  modelState.messageIndex.set(blockKey, index);
}

// Applies all transforms to raw decoded data and returns render-ready params.
// idx is the slider index — needed to compute accumulation diff with previous hour.
async function computeRenderParams(data, idx) {
  const { values, grid, product, header } = data;
  const isAccumulation = product.pdtNumber === 8;
  let displayValues = values;
  let isFallback = false;

  if (isAccumulation && idx > 0) {
    const prevHour = modelState.hourList[idx - 1];
    const prevData = await getCachedDecode(prevHour);
    if (prevData !== null) {
      const diff = new Float64Array(values.length);
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

  const unitTransform = ["t", "wspd", "p", "msl", "tcc"].includes(product.shortName)
    ? product.shortName
    : null;

  let displayUnits = displayUnitsFor(product.shortName, product.units);
  if (isAccumulation && !isFallback && idx > 0) displayUnits = "mm/h";

  const staticScale = STATIC_SCALES[product.shortName] ?? null;
  // renderMin/renderMax default to 0/1 when no static scale — worker stats provide
  // actual data range for the legend, but renderMin/range are only used for non-static vars.
  const renderMin = staticScale ? staticScale.min : 0;
  const renderMax = staticScale ? staticScale.max : 1;
  const range = renderMax - renderMin || 1;
  const isLog = staticScale?.log ?? false;
  const logDenom = isLog ? Math.log(staticScale.max / LOG_SCALE_FLOOR) : 1;
  const zeroThreshold = staticScale?.zeroThreshold ?? 0;

  return {
    values: displayValues,
    unitTransform,
    renderMin, renderMax, range,
    staticScale, isLog, logDenom, zeroThreshold,
    displayUnits, isFallback,
    grid, product, header,
  };
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

    const data = await getCachedDecode(hour);
    if (!data) {
      clearMapLayer();
      return;
    }

    modelState.currentHour = hour;
    const p = await computeRenderParams(data, idx);
    const { grid, product, header } = p;

    // Keep gridState in sync so the hover tooltip has current values.
    // values are raw (pre-unit-transform); unitFn converts them for display.
    gridState = {
      values: p.values,
      unitFn: unitFnFor(p.unitTransform),
      min: p.renderMin,
      range: p.range,
      grid,
      product,
      displayUnits: p.displayUnits,
      staticScale: p.staticScale,
    };

    // Create/resize offscreen canvas only when the grid dimensions change.
    const needH = mercatorCanvasHeight(grid);
    const canvasChanged = !heatCanvas || heatCanvas.width !== grid.ni || heatCanvas.height !== needH;
    if (canvasChanged) {
      heatCanvas = document.createElement("canvas");
      heatCanvas.width = grid.ni;
      heatCanvas.height = needH;
    }

    const corners = gridCorners(grid);
    const ctx = heatCanvas.getContext("2d");

    const cacheKey = `${hour}_${p.isFallback ? 1 : 0}`;
    let statsEntry;
    if (bitmapCache.has(cacheKey)) {
      // Fast path: bitmap already rendered, just blit it.
      statsEntry = bitmapCache.get(cacheKey);
      ctx.clearRect(0, 0, heatCanvas.width, heatCanvas.height);
      ctx.drawImage(statsEntry.bitmap, 0, 0);
    } else {
      // Slow path: render via worker (pixel loop + stats run off-thread), then cache.
      statsEntry = await renderViaWorker(p.values, p, grid.ni, needH);
      if (!statsEntry) return; // renderGen changed while worker was busy — abort
      bitmapCache.set(cacheKey, statsEntry);
      ctx.clearRect(0, 0, heatCanvas.width, heatCanvas.height);
      ctx.drawImage(statsEntry.bitmap, 0, 0);
    }

    // Update legend bar gradient.
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
      PARAM_DESCRIPTIONS[product.shortName] ?? "",
      modelState.lastRunInfo + (p.isFallback ? " · (cumulative — prev not loaded)" : ""),
    );

    updateStats(statsEntry.dataMin, statsEntry.dataMax, statsEntry.mean, statsEntry.count, p.displayUnits);
    const legendMin = p.staticScale ? p.renderMin : statsEntry.dataMin;
    const legendMax = p.staticScale ? p.renderMax : statsEntry.dataMax;
    showColorScale(legendMin, legendMax, p.displayUnits);

    const validTimeProduct = product.pdtNumber === 8
      ? { ...product, forecastTime: hour, timeUnit: 1 }
      : product;
    document.getElementById("arome-valid-time").textContent =
      `Forecast time: ${fmtValidTime(header, validTimeProduct)}`;

  } catch (err) {
    console.error("showHour:", err);
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

// Renders all hours in a block into bitmapCache in the background.
// Silently aborts if the variable or package changes (renderGen / modelState guard).
async function prerenderBlock(blockKey) {
  const capturedState = modelState;
  const capturedGen = renderGen;
  const block = capturedState.resources.find((r) => r.key === blockKey);
  if (!block) return;

  for (let hour = block.startHour; hour <= block.endHour; hour++) {
    if (modelState !== capturedState || renderGen !== capturedGen) return;

    const data = await getCachedDecode(hour);
    if (!data || modelState !== capturedState || renderGen !== capturedGen) return;

    const idx = capturedState.hourList.indexOf(hour);
    if (idx === -1) continue;

    const p = await computeRenderParams(data, idx);
    if (modelState !== capturedState || renderGen !== capturedGen) return;

    const cacheKey = `${hour}_${p.isFallback ? 1 : 0}`;
    if (bitmapCache.has(cacheKey)) continue; // already rendered (e.g. by showHour)

    const outW = data.grid.ni;
    const outH = mercatorCanvasHeight(data.grid);
    const entry = await renderViaWorker(p.values, p, outW, outH);
    if (!entry) return; // worker stale or crashed — abort this block

    if (modelState === capturedState && renderGen === capturedGen) {
      if (bitmapCache.has(cacheKey)) {
        entry.bitmap.close(); // showHour raced and cached it while we were rendering
      } else {
        bitmapCache.set(cacheKey, entry);
      }
    } else {
      entry.bitmap.close();
      return;
    }
  }
}

async function startDownload(packageKey) {
  const pkg = PACKAGES[packageKey];
  modelState = {
    packageKey,
    resources: [],
    buffers: new Map(),
    messageIndex: new Map(),
    hourList: [],
    decoded: new Map(),
    decodedOrder: [],
    variable: null,
    currentHour: null,
    lastRunInfo: null,
  };
  const downloadKey = modelState;

  const varSelect = document.getElementById("arome-var-select");
  varSelect.innerHTML = "";

  const pkgVars = pkg.variables;
  const firstVar = pkgVars[0];
  modelState.variable = firstVar.varKey ?? firstVar.shortName;
  applyDefaultPalette(firstVar.varKey ?? firstVar.shortName);
  varSelect.innerHTML = pkgVars
    .map(
      (v) =>
        `<option value="${v.varKey ?? v.shortName}">${v.name}</option>`,
    )
    .join("");
  varSelect.value = modelState.variable;
  updateLevelInfo(firstVar);

  const slider = document.getElementById("arome-slider");
  slider.value = 0;

  await initMap();
  if (modelState !== downloadKey) return;
  map.fitBounds(pkg.bounds, { padding: 20, animate: false });

  document.getElementById("arome-dl-status").textContent =
    "Fetching file list…";

  let resources;
  try {
    resources = await fetchDataGouvResources(pkg.datasetId, pkg.titlePattern);
    if (modelState !== downloadKey) return;
    if (pkg.skipHour0) resources = resources.filter((r) => r.startHour > 0);
  } catch (e) {
    if (modelState !== downloadKey) return;
    document.getElementById("arome-dl-status").textContent =
      "API error: " + e.message;
    return;
  }

  modelState.resources = resources;

  // Build hourList: expand each block's [startHour..endHour] range
  const hourList = [];
  for (const r of resources) {
    for (let h = r.startHour; h <= r.endHour; h++) hourList.push(h);
  }
  modelState.hourList = hourList;
  slider.max = hourList.length - 1;

  document.getElementById("arome-dl-status").textContent =
    `Downloading ${resources.length} ${packageKey} files…`;

  const barsEl = document.getElementById("arome-dl-bars");
  const fileListEl = document.getElementById("arome-dl-file-list");
  barsEl.innerHTML = "";
  fileListEl.innerHTML = "";
  for (const r of resources) {
    const item = document.createElement("div");
    item.className = "arome-dl-item";
    item.id = `dl-${r.key}`;
    item.textContent = r.key;
    barsEl.appendChild(item);

    const li = document.createElement("li");
    li.textContent = r.url.split("/").pop();
    fileListEl.appendChild(li);
  }

  let doneCount = 0;
  let legendInitialized = false;
  await Promise.all(
    resources.map(async (block) => {
      const buffer = await downloadFileProg(
        block.url,
        block.filesize,
        (loaded, total) => {
          if (modelState !== downloadKey) return;
          document
            .getElementById(`dl-${block.key}`)
            ?.style.setProperty(
              "--pct",
              Math.round((loaded / total) * 100) + "%",
            );
        },
      );
      if (modelState !== downloadKey) return;
      modelState.buffers.set(block.key, buffer);

      document.getElementById(`dl-${block.key}`)?.classList.add("done");
      doneCount++;
      document.getElementById("arome-dl-status").textContent =
        `Downloading… ${doneCount} / ${resources.length} files`;

      // On first arrival: populate legend/info from header (no CCSDS decode)
      if (!legendInitialized) {
        legendInitialized = true;
        const curVarDef = pkgVars.find(
          (v) => (v.varKey ?? v.shortName) === modelState.variable,
        );
        const curShortName = curVarDef?.shortName ?? modelState.variable;
        for (const msg of iterateGRIB2Messages(buffer)) {
          const p = msg.product;
          if (!p || p.shortName !== curShortName) continue;
          if (curVarDef?.levelValue != null && p.levelValue !== curVarDef.levelValue) continue;
          modelState.lastRunInfo = `${packageKey} · run ${fmtRefTime(msg.header)}`;
          applyDefaultPalette(modelState.variable);
          updateParamInfo(
            p.name,
            PARAM_DESCRIPTIONS[curShortName] ?? "",
            modelState.lastRunInfo,
          );
          updateLevelInfo(curVarDef);
          const staticScale = STATIC_SCALES[curShortName];
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

      // Render map when the block containing the slider's current hour arrives
      const currentIdx = parseInt(slider.value, 10);
      const currentHour = hourList[currentIdx];
      const isFirstDisplay = currentHour >= block.startHour && currentHour <= block.endHour && !gridState;

      if (isFirstDisplay) {
        // 1. Legend/select already visible  2. Hide map  3. Render + prerender
        setRendering(true);
        await new Promise(r => setTimeout(r, 0));
        const myGen = renderGen;
        await showHour(currentIdx);
        await prerenderBlock(block.key);
        if (renderGen === myGen) setRendering(false);
      } else {
        prerenderBlock(block.key); // background pre-render — no await
      }
    }),
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
    document.getElementById("arome-dl-panel").style.display = "block";
    if (modelState?.packageKey !== packageKey) {
      resetModelState();
      startDownload(packageKey);
    }
  } else {
    showView("view-home");
  }
}

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
    section.appendChild(meta);

    const pkgsLabel = document.createElement("p");
    pkgsLabel.className = "model-packages-label";
    pkgsLabel.textContent = "Last available run";
    section.appendChild(pkgsLabel);

    const pkgsEl = document.createElement("div");
    pkgsEl.className = "model-packages";
    for (const { key, pkg } of entries) {
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

      pkgsEl.appendChild(pkgEl);
    }
    section.appendChild(pkgsEl);
    container.appendChild(section);
  }
})();

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

async function onPaletteChange(e) {
  currentPalette = e.target.value;
  document.getElementById("palette-select").value = currentPalette;
  document.getElementById("palette-select-arome").value = currentPalette;
  if (!gridState) return;
  if (modelState) {
    await new Promise(r => requestAnimationFrame(r));
    setRendering(true);
    await new Promise(r => setTimeout(r, 0));
    invalidateBitmapCache();
    const myGen = renderGen;
    showHour(parseInt(document.getElementById("arome-slider").value, 10));
    await Promise.all([...modelState.buffers.keys()].map(k => prerenderBlock(k)));
    if (renderGen === myGen) setRendering(false);
  } else {
    renderHeatmap();
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

document
  .getElementById("arome-var-select")
  .addEventListener("change", async (e) => {
    if (!modelState) return;
    const varKey = e.target.value;
    modelState.variable = varKey;
    const varDef = PACKAGES[modelState.packageKey].variables.find(
      (v) => (v.varKey ?? v.shortName) === varKey,
    );
    const shortName = varDef?.shortName ?? varKey;
    applyDefaultPalette(varKey);

    // Immediately sync gv-meta — the async decode may be delayed or queued.
    if (varDef) {
      updateParamInfo(
        varDef.name,
        PARAM_DESCRIPTIONS[shortName] ?? "",
        modelState.lastRunInfo ?? modelState.packageKey,
      );
      updateLevelInfo(varDef);
    }

    // 1. Yield so the browser paints the new select value before anything else
    await new Promise(r => requestAnimationFrame(r));
    // 2. Hide elements so the freeze is invisible
    setRendering(true);
    await new Promise(r => setTimeout(r, 0));
    // 3. Now run the expensive synchronous work
    modelState.decoded.clear();
    modelState.decodedOrder = [];
    invalidateBitmapCache();
    const myGen = renderGen;
    const idx = parseInt(document.getElementById("arome-slider").value, 10);
    showHour(idx);
    await Promise.all([...modelState.buffers.keys()].map(k => prerenderBlock(k)));
    if (renderGen === myGen) setRendering(false);
  });

const aromeSlider = document.getElementById("arome-slider");
aromeSlider.addEventListener("input", () => {
  if (!modelState) return;
  showHour(parseInt(aromeSlider.value, 10));
});

// ── Mini-player ───────────────────────────────────────────────────────────────

function setPlaying(playing) {
  document.getElementById("icon-play").style.display = playing ? "none" : "";
  document.getElementById("icon-pause").style.display = playing ? "" : "none";
  document.getElementById("player-play").title = playing ? "Pause" : "Play";
  document.getElementById("player-play").setAttribute("aria-label", playing ? "Pause" : "Play");
}

function stopPlayer() {
  if (playerInterval === null) return;
  clearInterval(playerInterval);
  playerInterval = null;
  setPlaying(false);
}

document.getElementById("player-play").addEventListener("click", () => {
  if (!modelState) return;
  if (playerInterval !== null) {
    stopPlayer();
    return;
  }
  setPlaying(true);
  playerInterval = setInterval(() => {
    if (!modelState) { stopPlayer(); return; }
    const max = parseInt(aromeSlider.max, 10);
    const next = (parseInt(aromeSlider.value, 10) + 1) % (max + 1);
    aromeSlider.value = next;
    showHour(next);
  }, 120);
});

document.getElementById("player-reset").addEventListener("click", () => {
  if (!modelState) return;
  stopPlayer();
  aromeSlider.value = 0;
  showHour(0);
});

document.addEventListener("keydown", (e) => {
  if (e.code !== "Space" || !modelState) return;
  if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "BUTTON") return;
  e.preventDefault();
  document.getElementById("player-play").click();
});
