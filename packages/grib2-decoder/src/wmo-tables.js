/**
 * WMO FM-92 GRIB2 code tables — browser and Node.js compatible.
 */

export const CENTRES = {
    7: 'NCEP', 54: 'Canadian Met Centre', 74: 'Met Office (UK)',
    84: 'Toulouse', 85: 'Météo-France', 96: 'ECMWF',
    98: 'ECMWF', 255: 'Missing',
};

export const DISCIPLINES = {
    0: 'Meteorological', 1: 'Hydrological', 2: 'Land surface',
    3: 'Space', 4: 'Space weather', 10: 'Oceanographic',
};

export const REF_TIME_SIGNIFICANCE = {
    0: 'Analysis', 1: 'Start of forecast', 2: 'Verifying time of forecast',
    3: 'Observation time',
};

export const TYPE_OF_DATA = {
    0: 'Analysis', 1: 'Forecast', 2: 'Analysis and forecast',
    3: 'Control forecast', 4: 'Perturbed forecast',
    5: 'Control and perturbed forecast', 6: 'Processed satellite observations',
    7: 'Processed radar observations', 192: 'Experimental products',
};

export const TYPE_OF_LEVEL = {
    1: 'Ground surface', 2: 'Cloud base', 3: 'Cloud top',
    6: 'Maximum wind', 7: 'Tropopause', 8: 'Top of atmosphere',
    10: 'Sea surface',
    100: 'Isobaric surface (Pa)', 101: 'Mean sea level',
    102: 'Specific altitude above MSL (m)', 103: 'Specific height above ground (m)',
    104: 'Sigma level', 105: 'Hybrid level', 106: 'Depth below land surface (m)',
    107: 'Isentropic level (K)', 108: 'Pressure difference from ground (Pa)',
    200: 'Entire atmosphere', 204: 'Highest tropospheric freezing level',
};

export const TIME_UNIT = { 0: 'min', 1: 'h', 2: 'd', 10: '3h', 11: '6h', 12: '12h', 13: 's' };

const TIME_UNIT_SECONDS = { 0: 60, 1: 3600, 2: 86400, 10: 10800, 11: 21600, 12: 43200, 13: 1 };

export const GENERATING_PROCESS = {
    0: 'Analysis', 1: 'Initialization', 2: 'Forecast',
    3: 'Bias-corrected forecast', 4: 'Ensemble forecast',
};

export const DATA_REPR_TEMPLATES = {
    0: 'Simple packing', 2: 'Complex packing', 3: 'Complex packing with spatial differencing',
    40: 'JPEG 2000 code stream format', 41: 'PNG code stream', 42: 'CCSDS recommended lossless compression',
    254: 'Grid point data – IEEE 754 floats', 255: 'All values missing',
};

export const SCAN_MODE_BITS = {
    0x80: 'i scans negatively (E→W)',
    0x40: 'j scans positively (S→N)',
    0x20: 'adjacent points in j direction',
    0x10: 'rows scan alternately (boustrophedon)',
};

// ─── Formatting helpers ───────────────────────────────────────────────────────

const _pad = n => String(n).padStart(2, '0');

// Format a UTC Date as "Mon DD, YYYY HH:MM UTC" (e.g. "May 4, 2026 07:00 UTC").
function _fmtUTC(d) {
    const mon  = d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
    const day  = d.getUTCDate();
    const year = d.getUTCFullYear();
    const hh   = _pad(d.getUTCHours());
    const mm   = _pad(d.getUTCMinutes());
    return `${mon} ${day}, ${year} ${hh}:${mm} UTC`;
}

/**
 * Format the reference datetime from a Section 1 header object.
 * Returns a human-readable US date string (e.g. "Apr 25, 2026 03:00 UTC").
 */
export function fmtRefTime(h) {
    return _fmtUTC(new Date(Date.UTC(h.year, h.month - 1, h.day,
                                     h.hour, h.minute, h.second ?? 0)));
}

/**
 * Format the level description from a product object.
 */
export function fmtLevel(p) {
    if (p.typeOfFirstFixedSurface === 103) return `${p.levelValue} m above ground`;
    if (p.typeOfFirstFixedSurface === 100) return `${p.levelValue} Pa`;
    if (p.typeOfFirstFixedSurface === 1)   return 'Ground surface';
    if (p.typeOfFirstFixedSurface === 10)  return 'Sea surface';
    const lbl = TYPE_OF_LEVEL[p.typeOfFirstFixedSurface] ?? `type ${p.typeOfFirstFixedSurface}`;
    return `${lbl}${p.levelValue ? ' · ' + p.levelValue : ''}`;
}

/**
 * Compute and format the valid time (reference time + forecast offset).
 * Returns a human-readable US date string (e.g. "Apr 25, 2026 04:00 UTC").
 */
export function fmtValidTime(header, product) {
    const refMs = Date.UTC(header.year, header.month - 1, header.day,
                           header.hour, header.minute, header.second ?? 0);
    const secs  = (TIME_UNIT_SECONDS[product.timeUnit] ?? 3600) * product.forecastTime;
    return _fmtUTC(new Date(refMs + secs * 1000));
}

/**
 * Format the scanning mode byte as a human-readable string.
 */
export function fmtScanMode(mode) {
    if (mode === 0) return '0 (i W→E, j N→S, rows left-to-right)';
    const flags = Object.entries(SCAN_MODE_BITS)
        .filter(([bit]) => mode & Number(bit))
        .map(([, desc]) => desc);
    return `0x${mode.toString(16).padStart(2, '0')} (${flags.join('; ') || 'default'})`;
}
