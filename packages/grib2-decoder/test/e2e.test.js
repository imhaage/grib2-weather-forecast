/**
 * End-to-end tests for the GRIB2 decoder using the real AROME file.
 *
 * Covers the full pipeline: walkSections → parseSection* → CCSDS WASM decode
 * → physical value reconstruction.
 *
 * Expected values are derived from independent inspection of the binary file
 * and cross-checked against the eccodes template definitions.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeGRIB2, parseGRIB2Header } from '../src/decoder.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GRIB2_FILE = new URL('../test/arome__001__SP1__01H__2026-04-25T03_00_00Z.grib2', import.meta.url);

function approx(actual, expected, tolerance, label = '') {
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `${label ? label + ': ' : ''}${actual} should be ≈ ${expected} (±${tolerance})`
    );
}

function statsOf(values) {
    let min = Infinity, max = -Infinity, count = 0, sum = 0;
    for (const v of values) {
        if (v > -1e99) { min = Math.min(min, v); max = Math.max(max, v); sum += v; count++; }
    }
    return { min, max, count, mean: sum / count };
}

// ─── Shared fixture ───────────────────────────────────────────────────────────

let result;      // decodeGRIB2 output
let header;      // result.header
let grid;        // result.grid
let values;      // result.values (Float64Array)
let bitmap;      // result.bitmap (Uint8Array)

before(async () => {
    const buf = readFileSync(GRIB2_FILE);
    const ab  = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    result = await decodeGRIB2(ab);
    ({ header, grid, values, bitmap } = result);
});

// ─── Header ───────────────────────────────────────────────────────────────────

describe('decodeGRIB2 — header (Section 1)', () => {
    it('centre is 85 (Météo-France)', () => assert.equal(header.centre, 85));
    it('year is 2026',  () => assert.equal(header.year, 2026));
    it('month is 4',    () => assert.equal(header.month, 4));
    it('day is 25',     () => assert.equal(header.day, 25));
    it('hour is 3',     () => assert.equal(header.hour, 3));
    it('minute is 0',   () => assert.equal(header.minute, 0));
    it('discipline is 0 (meteorological)', () => assert.equal(header.discipline, 0));
    it('typeOfData is 1 (forecast)', () => assert.equal(header.typeOfData, 1));
    it('messageLength is 5158751',   () => assert.equal(header.messageLength, 5158751));
});

// ─── Grid ─────────────────────────────────────────────────────────────────────

describe('decodeGRIB2 — grid (Section 3)', () => {
    it('Ni = 2801', () => assert.equal(grid.ni, 2801));
    it('Nj = 1791', () => assert.equal(grid.nj, 1791));
    it('totalPoints = Ni × Nj = 5016591', () => assert.equal(grid.totalPoints, 5016591));
    it('resolution Di = 0.01°', () => approx(grid.di, 0.01, 1e-7));
    it('resolution Dj = 0.01°', () => approx(grid.dj, 0.01, 1e-7));
    it('La1 ≈ 55.4°N',  () => approx(grid.latitudeOfFirstPoint,  55.4,  0.001));
    it('Lo1 = -12°E',   () => approx(grid.longitudeOfFirstPoint, -12.0, 0.001));
    it('La2 = 37.5°N',  () => approx(grid.latitudeOfLastPoint,   37.5,  0.001));
    it('Lo2 ≈ 16°E',    () => approx(grid.longitudeOfLastPoint,  16.0,  0.001));
    it('scanning mode 0 (W→E, N→S)', () => assert.equal(grid.scanningMode, 0));
});

// ─── Values array ─────────────────────────────────────────────────────────────

describe('decodeGRIB2 — values array shape', () => {
    it('values is a Float64Array', () => assert.ok(values instanceof Float64Array));
    it('values.length equals totalPoints (5016591)', () =>
        assert.equal(values.length, 5016591));
});

// ─── Bitmap ───────────────────────────────────────────────────────────────────

describe('decodeGRIB2 — bitmap', () => {
    it('bitmap is present (Uint8Array)', () => assert.ok(bitmap instanceof Uint8Array));
    it('bitmap length equals totalPoints', () => assert.equal(bitmap.length, 5016591));
    it('4160519 valid grid points (bitmap=1)', () => {
        let count = 0;
        for (const b of bitmap) count += b;
        assert.equal(count, 4160519);
    });
    // Missing count (856072) is implied: totalPoints - setBits = 5016591 - 4160519.
    it('values at bitmap=0 positions are sentinel -1e100', () => {
        // Spot-check: the first missing value must be -1e100
        const firstMissing = bitmap.indexOf(0);
        assert.ok(firstMissing >= 0, 'no missing point found');
        assert.equal(values[firstMissing], -1e100);
    });
    it('values at bitmap=1 positions are not sentinel', () => {
        const firstValid = bitmap.indexOf(1);
        assert.ok(firstValid >= 0, 'no valid point found');
        assert.ok(values[firstValid] > -1e99, 'valid point has sentinel value');
    });
});

// ─── Physical values ──────────────────────────────────────────────────────────

describe('decodeGRIB2 — physical values (temperature in K)', () => {
    let stats;
    before(() => { stats = statsOf(values); });

    it('valid value count matches numberOfPackedValues', () =>
        assert.equal(stats.count, 4160519));

    it('min ≈ 254.426 K (reference value — first packed integer is 0)',
        () => approx(stats.min, 254.426, 0.001));

    it('max < 320 K (physically plausible surface temperature)',
        () => assert.ok(stats.max < 320, `max ${stats.max} K should be < 320 K`));

    it('max > 280 K (non-trivial range)',
        () => assert.ok(stats.max > 280, `max ${stats.max} K should be > 280 K`));

    it('mean is within typical surface temperature range [255, 295] K', () =>
        assert.ok(stats.mean >= 255 && stats.mean <= 295,
            `mean ${stats.mean.toFixed(2)} K outside [255, 295]`));

    it('value resolution is ~2^-10 ≈ 9.77e-4 K (binary scale -10)', () => {
        // Consecutive valid values should differ by multiples of 2^-10
        const step = Math.pow(2, -10);
        let violations = 0;
        let checked = 0;
        for (let i = 0; i < values.length - 1 && checked < 10000; i++) {
            if (values[i] > -1e99 && values[i + 1] > -1e99) {
                const diff = Math.abs(values[i + 1] - values[i]);
                // diff must be a multiple of step (within floating-point rounding)
                const remainder = diff % step;
                if (remainder > step * 0.01 && remainder < step * 0.99) violations++;
                checked++;
            }
        }
        assert.ok(violations === 0,
            `${violations}/${checked} consecutive value differences are not multiples of 2^-10`);
    });
});

// ─── Unpacking formula ────────────────────────────────────────────────────────

describe('decodeGRIB2 — CCSDS unpacking formula Y = (R + X × 2^E) × 10^(-D)', () => {
    // R=254.42592, E=-10, D=0 → Y = 254.42592 + X / 1024
    // X=0   → Y = R exactly (minimum)
    // X=max → Y ≈ 254.42592 + 65535/1024 ≈ 318.42 K
    const R  = 254.42591857910156;  // float32 parsed value
    const E  = -10;
    const D  = 0;
    const bScale = Math.pow(2, E);
    const dScale = Math.pow(10, -D);

    it('minimum value equals R (X=0 → Y=R × 10^0)', () =>
        approx(statsOf(values).min, R * dScale, 0.001));

    it('maximum value is consistent with 16-bit packed range', () => {
        const maxX  = Math.pow(2, 16) - 1; // 65535
        const maxY  = (R + maxX * bScale) * dScale;
        assert.ok(statsOf(values).max <= maxY + 0.001,
            `max ${statsOf(values).max} > theoretical max ${maxY}`);
    });
});

// ─── parseGRIB2Header (fast path) ────────────────────────────────────────────

describe('parseGRIB2Header', () => {
    let h;
    before(() => {
        const buf = readFileSync(GRIB2_FILE);
        const ab  = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        h = parseGRIB2Header(ab);
    });

    it('returns header with correct centre', () => assert.equal(h.header.centre, 85));
    it('returns header with correct year',   () => assert.equal(h.header.year, 2026));
    it('returns grid with correct Ni',       () => assert.equal(h.grid.ni, 2801));
    it('returns grid with correct Nj',       () => assert.equal(h.grid.nj, 1791));
    it('dataOffset points into Section 7 data', () => {
        // Section 7 starts at 627248, data (after 5-byte header) at 627253
        assert.equal(h.dataOffset, 627253);
    });
    it('dataLength is Section 7 data size (4531494 bytes)', () =>
        assert.equal(h.dataLength, 4531494));
    // "does not decode values" test removed — the assertions (header !== undefined,
    // grid !== undefined, dataOffset > 0) were already covered by the preceding tests.
});

// ─── ICON-D2 (DRT 3) End-to-End ──────────────────────────────────────────────

import { existsSync } from 'node:fs';
import { iterateGRIB2Messages } from '../src/index.js';

const ICON_FILE = new URL('../test/icon_d2_t2m.grib2', import.meta.url);

describe('DRT 3 — ICON-D2 real file', { skip: !existsSync(ICON_FILE) }, () => {
    let result;

    before(async () => {
        const buf  = readFileSync(ICON_FILE);
        const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
        for (const msg of iterateGRIB2Messages(data)) {
            result = await decodeGRIB2(msg.buffer);
            break;
        }
    });

    it('decodes without error', () => assert.ok(result));
    it('values array has expected length', () =>
        assert.equal(result.values.length, result.grid.totalPoints));
    it('values are physically plausible for temperature (200K–330K)', () => {
        let min = Infinity, max = -Infinity;
        for (const v of result.values) {
            if (v > -1e99) { if (v < min) min = v; if (v > max) max = v; }
        }
        assert.ok(min > 200 && max < 330,
            `Temperature out of range: min=${min.toFixed(2)}, max=${max.toFixed(2)}`);
    });
});

// ─── GFS (DRT 3) End-to-End ───────────────────────────────────────────────────

const GFS_FILE = new URL('../test/gfs_sample.grib2', import.meta.url);

describe('DRT 3 — GFS real file', { skip: !existsSync(GFS_FILE) }, () => {
    let result;

    before(async () => {
        const buf  = readFileSync(GFS_FILE);
        const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
        for (const msg of iterateGRIB2Messages(data)) {
            result = await decodeGRIB2(msg.buffer);
            break;
        }
    });

    it('decodes without error', () => assert.ok(result));
    it('values array has expected length', () =>
        assert.equal(result.values.length, result.grid.totalPoints));
    it('has at least some valid values', () => {
        const valid = result.values.filter(v => v > -1e99);
        assert.ok(valid.length > 0, 'No valid values decoded');
    });
});
