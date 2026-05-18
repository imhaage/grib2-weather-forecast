import chroma from "chroma-js";

export const LOG_SCALE_FLOOR = 0.1;

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

export function makeScale(paletteName) {
  const entry = CUSTOM_SCALES[paletteName];
  if (entry?.colors) {
    return chroma.scale(entry.colors).domain(entry.domain);
  }
  const scale = chroma.scale(entry ?? chroma.brewer[paletteName]);
  return INVERTED_PALETTES.has(paletteName) ? scale.domain([1, 0]) : scale;
}

export function buildLUT(paletteName) {
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
