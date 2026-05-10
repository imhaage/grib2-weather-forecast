import maplibregl from "https://esm.sh/maplibre-gl@4";
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

// ── AROME packages ────────────────────────────────────────────────────────────
const PACKAGES = {
  SP1: {
    key: "SP1",
    label: "AROME SP1 0.01°",
    variables: [
      {
        shortName: "t",
        name: "Temperature",
        units: "°C",
        level: "2 m above ground",
      },
      {
        shortName: "r",
        name: "Relative humidity",
        units: "%",
        level: "2 m above ground",
      },
      {
        shortName: "u",
        name: "U-component of wind",
        units: "m s-1",
        level: "10 m above ground",
      },
      {
        shortName: "v",
        name: "V-component of wind",
        units: "m s-1",
        level: "10 m above ground",
      },
      {
        shortName: "ugust",
        name: "U-component of wind (gust)",
        units: "m s-1",
        level: "10 m above ground",
      },
      {
        shortName: "vgust",
        name: "V-component of wind (gust)",
        units: "m s-1",
        level: "10 m above ground",
      },
    ],
  },
  SP2: {
    key: "SP2",
    label: "AROME SP2 0.01°",
    variables: [
      {
        shortName: "p",
        name: "Pressure",
        units: "hPa",
        level: "Ground surface",
      },
      {
        shortName: "cape",
        name: "Convective available potential energy",
        units: "J kg-1",
        level: "Ground surface",
      },
      {
        shortName: "lcc",
        name: "Low cloud cover",
        units: "%",
        level: "Ground surface",
      },
      {
        shortName: "mcc",
        name: "Medium cloud cover",
        units: "%",
        level: "Ground surface",
      },
      {
        shortName: "hcc",
        name: "High cloud cover",
        units: "%",
        level: "Ground surface",
      },
      {
        shortName: "tgrp",
        name: "Graupel (snow pellets) precipitation",
        units: "mm/h",
        level: "Ground surface",
      },
      {
        shortName: "rrate",
        name: "Rain precipitation",
        units: "mm/h",
        level: "Ground surface",
      },
      {
        shortName: "srate",
        name: "Snow precipitation",
        units: "mm/h",
        level: "Ground surface",
      },
    ],
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

const AROME_BOUNDS = [
  [-12, 37.5],
  [16, 55.4],
];

// ── State ─────────────────────────────────────────────────────────────────────
let fileState = null; // { messages: Array }
let gridState = null; // { values, min, range, grid, product }
let currentPalette = "Plasma";
let map = null; // MapLibre instance (created once, reused)
let heatCanvas = null; // offscreen canvas for heatmap rendering
let aromeState = null; // { resources, buffers, decoded, decodedOrder, variable }
let isDecoding = false;
let pendingHourIdx = null;

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  p: "Spectral",
  cape: "Spectral",
  lcc: "Viridis",
  mcc: "Viridis",
  hcc: "Viridis",
  rrate: "Spectral",
  srate: "Spectral",
  tgrp: "Spectral",
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
  cape: { min: 0, max: 4000 },
  lcc: { min: 0, max: 100, zeroThreshold: 0.005 },
  mcc: { min: 0, max: 100, zeroThreshold: 0.005 },
  hcc: { min: 0, max: 100, zeroThreshold: 0.005 },
  rrate: { min: 0, max: 150, log: true, zeroThreshold: 0.005 },
  srate: { min: 0, max: 20, log: true, zeroThreshold: 0.005 },
  tgrp: { min: 0, max: 15, log: true, zeroThreshold: 0.005 },
};

function displayUnitsFor(shortName, rawUnits) {
  if (shortName === "t") return "°C";
  if (shortName === "p") return "hPa";
  return rawUnits;
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
    const val =
      idx >= 0 && idx < values.length ? values[idx] : MISSING_VALUE;

    if (val <= MISSING_VALUE) {
      tooltip.hidden = true;
      mapCanvas.style.cursor = "default";
      return;
    }

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

// Remove the grib2 map layer/source and reset grid display state.
function clearMapLayer() {
  if (map?.getSource("grib2")) {
    map.removeLayer("grib2-layer");
    map.removeSource("grib2");
  }
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
  if (map.getSource("grib2")) {
    map.removeLayer("grib2-layer");
    map.removeSource("grib2");
  }
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
      container: document.getElementById("map-wrap"),
    }),
  );
  setupHoverTooltip();
}

function resetApp() {
  fileState = null;
  aromeState = null;
  isDecoding = false;
  pendingHourIdx = null;
  clearMapLayer();
  setStatus("");
  document.getElementById("file-summary").style.display = "none";
  document.getElementById("results").style.display = "none";
  document.getElementById("cards").innerHTML = "";
  document.getElementById("arome-dl-bars").innerHTML = "";
  document.getElementById("arome-dl-file-list").innerHTML = "";
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

async function fetchAromeResources(packageKey) {
  const resp = await fetch(
    "https://www.data.gouv.fr/api/1/datasets/65bd1247a6238f16e864fa80/",
  );
  if (!resp.ok) throw new Error(`API ${resp.status}`);
  const data = await resp.json();
  return data.resources
    .filter(
      (r) =>
        r.format === "grib2" &&
        r.title &&
        r.title.includes(`__${packageKey}__`),
    )
    .map((r) => {
      const m = r.title.match(/__(\d+)H__/);
      return {
        hour: m ? parseInt(m[1], 10) : -1,
        url: r.url,
        filesize: r.filesize,
      };
    })
    .filter((r) => r.hour >= 1)
    .sort((a, b) => a.hour - b.hour);
}

async function downloadFileProg(url, filesize, onProgress) {
  const resp = await fetch(url);
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
  const { decoded, decodedOrder, buffers, variable } = aromeState;
  if (decoded.has(hour)) return decoded.get(hour);
  const buffer = buffers.get(hour);
  if (!buffer) return null;
  if (decodedOrder.length >= DECODED_CACHE_SIZE)
    decoded.delete(decodedOrder.shift());
  const data = await decodeVariableFromBuffer(buffer, variable);
  if (!data) return null;
  decoded.set(hour, data);
  decodedOrder.push(hour);
  return data;
}

async function decodePrevHourValues(prevHour) {
  const data = await getCachedDecode(prevHour);
  return data ? data.values : null;
}

async function aromeShowHour(idx) {
  if (isDecoding) {
    pendingHourIdx = idx;
    return;
  }
  isDecoding = true;
  pendingHourIdx = null;
  try {
    const { resources } = aromeState;
    const { hour } = resources[idx];
    document.getElementById("arome-hour-label").textContent =
      fmtHourLabel(hour);

    const data = await getCachedDecode(hour);
    if (!data) {
      clearMapLayer();
      return;
    }

    aromeState.currentHour = hour;
    const { values, grid, product, header } = data;

    // Precipitation variables (PDT 4.8) are cumulative since H+00 — show hourly increment.
    const isAccumulation = product.pdtNumber === 8;
    let displayValues = values;
    let isFallback = false;

    if (isAccumulation && idx > 0) {
      const prevHour = resources[idx - 1].hour;
      const prevValues = await decodePrevHourValues(prevHour);
      if (prevValues !== null) {
        const diff = new Float64Array(values.length);
        for (let i = 0; i < values.length; i++) {
          if (
            values[i] <= MISSING_VALUE ||
            prevValues[i] <= MISSING_VALUE
          ) {
            diff[i] = MISSING_VALUE;
          } else {
            diff[i] = Math.max(0, values[i] - prevValues[i]);
          }
        }
        displayValues = diff;
      } else {
        isFallback = true;
      }
    }
    // idx === 0 (01H): raw cumulative value equals the 1H increment (model accumulates from 0 at run start).

    if (product.shortName === "t")
      displayValues = applyToValues(displayValues, (v) => v - 273.15);
    else if (product.shortName === "p")
      displayValues = applyToValues(displayValues, (v) => v / 100);

    const {
      min: dataMin,
      max: dataMax,
      mean,
      count,
    } = computeStats(displayValues);
    let displayUnits = displayUnitsFor(product.shortName, product.units);
    if (isAccumulation && !isFallback) displayUnits = "mm/h";
    const staticScale = STATIC_SCALES[product.shortName] ?? null;
    const renderMin = staticScale ? staticScale.min : dataMin;
    const renderMax = staticScale ? staticScale.max : dataMax;
    const range = renderMax - renderMin || 1;
    gridState = {
      values: displayValues,
      min: renderMin,
      range,
      grid,
      product,
      displayUnits,
      staticScale,
    };

    updateParamInfo(
      product.name,
      PARAM_DESCRIPTIONS[product.shortName] ?? "",
      `${aromeState.packageKey} · run ${fmtRefTime(header)}` +
        (isFallback ? " · (cumulative — prev not loaded)" : ""),
    );

    // Create/resize offscreen canvas only when needed
    const needH = mercatorCanvasHeight(grid);
    const canvasChanged =
      !heatCanvas ||
      heatCanvas.width !== grid.ni ||
      heatCanvas.height !== needH;
    if (canvasChanged) {
      heatCanvas = document.createElement("canvas");
      heatCanvas.width = grid.ni;
      heatCanvas.height = needH;
    }
    renderHeatmap();

    const corners = gridCorners(grid);
    await initMap([AROME_BOUNDS, { padding: 20, animate: false }]);
    if (!map.getSource("grib2") || canvasChanged)
      setMapLayer(heatCanvas, corners);
    // Update stats + colorscale + valid time
    updateStats(dataMin, dataMax, mean, count, displayUnits);
    showColorScale(renderMin, renderMax, displayUnits);
    // PDT 4.8 accumulations always have forecastTime=0 (start of interval);
    // use the file's hour offset as the end-of-interval valid time instead.
    const validTimeProduct = isAccumulation
      ? { ...product, forecastTime: hour, timeUnit: 1 }
      : product;
    document.getElementById("arome-valid-time").textContent =
      `Forecast time: ${fmtValidTime(header, validTimeProduct)}`;
  } catch (err) {
    console.error("aromeShowHour:", err);
    clearMapLayer();
  } finally {
    isDecoding = false;
    if (pendingHourIdx !== null) {
      const next = pendingHourIdx;
      pendingHourIdx = null;
      aromeShowHour(next);
    }
  }
}

async function startAromeDownload(packageKey) {
  // Init state + UI before fetch
  aromeState = {
    packageKey,
    resources: [],
    buffers: new Map(),
    decoded: new Map(),
    decodedOrder: [],
    variable: null,
  };

  const varSelect = document.getElementById("arome-var-select");
  varSelect.innerHTML = "";

  const pkgVars = PACKAGES[packageKey].variables;
  aromeState.variable = pkgVars[0].shortName;
  applyDefaultPalette(pkgVars[0].shortName);
  varSelect.innerHTML = pkgVars
    .map(
      (v) =>
        `<option value="${v.shortName}">${v.name}${v.level ? " · " + v.level : ""}${v.units ? " (" + v.units + ")" : ""}</option>`,
    )
    .join("");
  varSelect.value = aromeState.variable;

  const slider = document.getElementById("arome-slider");
  slider.value = 0;

  // Show base map, zoomed to AROME domain
  await initMap();
  map.fitBounds(AROME_BOUNDS, { padding: 20, animate: false });

  document.getElementById("arome-dl-status").textContent =
    "Fetching file list…";

  let resources;
  try {
    resources = await fetchAromeResources(packageKey);
  } catch (e) {
    document.getElementById("arome-dl-status").textContent =
      "API error: " + e.message;
    return;
  }

  aromeState.resources = resources;
  slider.max = resources.length - 1;
  document.getElementById("arome-dl-status").textContent =
    `Downloading ${resources.length} ${packageKey} files…`;

  // Build progress indicators and file list
  const barsEl = document.getElementById("arome-dl-bars");
  const fileListEl = document.getElementById("arome-dl-file-list");
  barsEl.innerHTML = "";
  fileListEl.innerHTML = "";
  for (const { hour, url } of resources) {
    const item = document.createElement("div");
    item.className = "arome-dl-item";
    item.id = `dl-${hour}`;
    item.textContent = `${String(hour).padStart(2, "0")}H`;
    barsEl.appendChild(item);

    const li = document.createElement("li");
    li.textContent = url.split("/").pop();
    fileListEl.appendChild(li);
  }

  const downloadKey = aromeState;
  let doneCount = 0;
  let legendInitialized = false;
  await Promise.all(
    resources.map(async ({ hour, url, filesize }) => {
      const buffer = await downloadFileProg(
        url,
        filesize,
        (loaded, total) => {
          if (aromeState !== downloadKey) return;
          document
            .getElementById(`dl-${hour}`)
            ?.style.setProperty(
              "--pct",
              Math.round((loaded / total) * 100) + "%",
            );
        },
      );
      if (aromeState !== downloadKey) return;
      aromeState.buffers.set(hour, buffer);

      document.getElementById(`dl-${hour}`)?.classList.add("done");
      doneCount++;
      document.getElementById("arome-dl-status").textContent =
        `Downloading… ${doneCount} / ${resources.length} files`;

      // On first arrival: populate legend/info from header (no CCSDS decode)
      if (!legendInitialized) {
        legendInitialized = true;
        const data = new Uint8Array(buffer);
        for (const msg of iterateGRIB2Messages(data)) {
          if (msg.product?.shortName === aromeState.variable) {
            applyDefaultPalette(aromeState.variable);
            updateParamInfo(
              msg.product.name,
              PARAM_DESCRIPTIONS[aromeState.variable] ?? "",
              `${packageKey} · run ${fmtRefTime(msg.header)}`,
            );
            const staticScale = STATIC_SCALES[aromeState.variable];
            const varDef = pkgVars.find(
              (v) => v.shortName === aromeState.variable,
            );
            if (staticScale && varDef) {
              showColorScale(
                staticScale.min,
                staticScale.max,
                displayUnitsFor(aromeState.variable, varDef.units),
              );
            }
            break;
          }
        }
      }

      // Render map only when the file matching the slider arrives
      const currentIdx = parseInt(slider.value, 10);
      if (resources[currentIdx]?.hour === hour && !gridState) {
        aromeShowHour(currentIdx);
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
    if (aromeState?.packageKey !== packageKey) {
      aromeState = null;
      isDecoding = false;
      pendingHourIdx = null;
      gridState = null;
      document.getElementById("arome-dl-bars").innerHTML = "";
      document.getElementById("arome-dl-file-list").innerHTML = "";
      startAromeDownload(packageKey);
    }
  } else {
    showView("view-home");
  }
}

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

function onPaletteChange(e) {
  currentPalette = e.target.value;
  document.getElementById("palette-select").value = currentPalette;
  document.getElementById("palette-select-arome").value = currentPalette;
  if (gridState) renderHeatmap();
}
document
  .getElementById("palette-select")
  .addEventListener("change", onPaletteChange);
document
  .getElementById("palette-select-arome")
  .addEventListener("change", onPaletteChange);

// ── AROME events ──────────────────────────────────────────────────────────────

document.getElementById("btn-sp1").addEventListener("click", () => {
  location.hash = "#arome/SP1";
});

document.getElementById("btn-sp2").addEventListener("click", () => {
  location.hash = "#arome/SP2";
});

document
  .getElementById("arome-back-btn")
  .addEventListener("click", resetApp);

document
  .getElementById("arome-var-select")
  .addEventListener("change", (e) => {
    if (!aromeState) return;
    aromeState.variable = e.target.value;
    applyDefaultPalette(e.target.value);
    aromeState.decoded.clear();
    aromeState.decodedOrder = [];
    const idx = parseInt(
      document.getElementById("arome-slider").value,
      10,
    );
    aromeShowHour(idx);
  });

const aromeSlider = document.getElementById("arome-slider");
aromeSlider.addEventListener("input", () => {
  if (!aromeState) return;
  aromeShowHour(parseInt(aromeSlider.value, 10));
});
