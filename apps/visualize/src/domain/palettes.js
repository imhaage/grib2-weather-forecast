import chroma from "chroma-js";

export const LOG_SCALE_FLOOR = 0.1;

const PALETTE_COLORS = {
  Plasma: ["#f0f921", "#f89441", "#cb4679", "#7e03a8", "#0d0887"],
  Viridis: ["#fee825", "#6cce5a", "#26838f", "#3f4a8a", "#440154"],
  Magma: ["#fcfdbf", "#fc8961", "#b73779", "#51127c", "#000004"],
  Inferno: ["#fcffa4", "#dd513a", "#932667", "#420a68", "#000004"],
  Spectral: ["#5e4fa2", "#66c2a5", "#ffffbf", "#f46d43", "#9e0142"],
  RdBu: ["#053061", "#4393c3", "#f7f7f7", "#d6604d", "#67001f"],
  RdYlBu: ["#313695", "#74add1", "#ffffbf", "#f46d43", "#a50026"],
  Blues: ["#f7fbff", "#c6dbef", "#6baed6", "#2171b5", "#08306b"],
  Temperature: [
    "#08306b",
    "#2166ac",
    "#92c5de",
    "#ffffff",
    "#ffc800",
    "#ff6600",
    "#cc1100",
    "#67000d",
  ],
  CAPE: ["#1f2937", "#2563eb", "#22c55e", "#facc15", "#f97316", "#dc2626", "#7e22ce"],
};

// Custom palettes use real-value stops. They are normalized only when building a LUT.
const PALETTE_DOMAINS = {
  Temperature: [-30, -20, -10, 0, 10, 20, 30, 50],
  CAPE: [0, 100, 500, 1000, 2000, 3000, 4000],
};
const LOG_LEGEND_TICKS = [0, 1, 5, 10, 25, 50, 100, 150];

function normalizedDomain(domain, min, max) {
  const range = max - min || 1;
  return domain.map((value) => (value - min) / range);
}

function roundedPercent(value) {
  return Math.round(value * 100) / 100;
}

function linearPosition(value, min, max) {
  const range = max - min || 1;
  return roundedPercent(Math.min(Math.max(((value - min) / range) * 100, 0), 100));
}

function logPosition(value, max, logFloor = LOG_SCALE_FLOOR) {
  if (value <= logFloor) return 0;
  return roundedPercent(
    Math.min(Math.max((Math.log(value / logFloor) / Math.log(max / logFloor)) * 100, 0), 100),
  );
}

function uniqueSortedValues(values) {
  return [...new Set(values)].sort((a, b) => a - b);
}

function genericLinearTicks(min, max) {
  const range = max - min;
  if (!Number.isFinite(range) || range <= 0) return [min];
  return Array.from({ length: 5 }, (_, index) => min + (range * index) / 4);
}

export function legendTicksFor({ paletteName, min, max, isLog = false }) {
  const domain = PALETTE_DOMAINS[paletteName];
  if (domain) {
    return domain
      .filter((value) => value >= min && value <= max)
      .map((value) => ({ value, position: linearPosition(value, min, max) }));
  }

  if (isLog) {
    const values = uniqueSortedValues([
      ...LOG_LEGEND_TICKS.filter((value) => value >= min && value <= max),
      max,
    ]);
    return values.map((value) => ({ value, position: logPosition(value, max) }));
  }

  return genericLinearTicks(min, max).map((value) => ({
    value,
    position: linearPosition(value, min, max),
  }));
}

export function makeScale(paletteName, { min = 0, max = 1 } = {}) {
  const domain = PALETTE_DOMAINS[paletteName];
  return chroma
    .scale(PALETTE_COLORS[paletteName])
    .domain(domain ? normalizedDomain(domain, min, max) : [0, 1]);
}

export function buildLUT(paletteName, scaleRange) {
  const sc = makeScale(paletteName, scaleRange);
  const lut = new Uint8Array(256 * 3);
  for (let i = 0; i < 256; i++) {
    const [r, g, b] = sc(i / 255).rgb();
    lut[i * 3] = r;
    lut[i * 3 + 1] = g;
    lut[i * 3 + 2] = b;
  }
  return lut;
}
