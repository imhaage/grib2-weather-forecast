/**
 * Unit tests for GRIB2 section parsers (walkSections, parseSection1/3/5/6).
 *
 * These tests use the real AROME file and verify each parser independently
 * against known expected values derived from the WMO FM-92 specification
 * and direct inspection of the binary data.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { walkSections, parseSection1, parseSection3, parseSection5, parseSection6 } from '../src/decoder.js';
import { lookupParameter } from '../src/parameters.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GRIB2_FILE = new URL('../test/arome__001__SP1__01H__2026-04-25T03_00_00Z.grib2', import.meta.url);

function approx(actual, expected, tolerance = 1e-9) {
    assert.ok(
        Math.abs(actual - expected) <= tolerance,
        `Expected ${actual} ≈ ${expected} (±${tolerance})`
    );
}

// ─── Shared fixture ───────────────────────────────────────────────────────────

let data;       // Uint8Array of the whole file
let walked;     // result of walkSections
let sections;   // walked.sections

before(() => {
    const buf = readFileSync(GRIB2_FILE);
    data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
    walked   = walkSections(data);
    sections = walked.sections;
});

// ─── Section 0 ────────────────────────────────────────────────────────────────

describe('walkSections — Section 0', () => {
    it('edition is 2', () => assert.equal(walked.edition, 2));
    it('discipline is 0 (meteorological)', () => assert.equal(walked.discipline, 0));
    it('message length matches first message size', () => {
        // First message in the multi-message file
        assert.equal(walked.messageLength, 5158751);
    });
});

// ─── Section boundaries ───────────────────────────────────────────────────────

describe('walkSections — Section boundaries', () => {
    it('finds sections 1, 3, 4, 5, 6, 7', () => {
        for (const n of [1, 3, 4, 5, 6, 7]) {
            assert.ok(sections[n], `Section ${n} not found`);
        }
    });

    it('Section 1 offset is 16 (immediately after Section 0)', () => {
        assert.equal(sections[1].offset, 16);
    });

    it('Section 1 length is 21', () => assert.equal(sections[1].secLen, 21));
    it('Section 3 length is 72', () => assert.equal(sections[3].secLen, 72));
    it('Section 4 length is 34', () => assert.equal(sections[4].secLen, 34));
    it('Section 5 length is 25', () => assert.equal(sections[5].secLen, 25));
    it('Section 6 length is 627080', () => assert.equal(sections[6].secLen, 627080));
    it('Section 7 length is 4531499', () => assert.equal(sections[7].secLen, 4531499));

    it('sections are contiguous (no gap between them)', () => {
        const order = [1, 3, 4, 5, 6, 7];
        for (let i = 0; i < order.length - 1; i++) {
            const current = sections[order[i]];
            const next    = sections[order[i + 1]];
            assert.equal(
                current.offset + current.secLen,
                next.offset,
                `Gap between section ${order[i]} and ${order[i + 1]}`
            );
        }
    });
});

// ─── Section 1: Identification ────────────────────────────────────────────────

describe('parseSection1', () => {
    let s1;
    before(() => { s1 = parseSection1(data, sections[1].dataStart); });

    it('centre is 85 (Météo-France)', () => assert.equal(s1.centre, 85));
    it('sub-centre is 0',             () => assert.equal(s1.subCentre, 0));
    it('year is 2026',                () => assert.equal(s1.year, 2026));
    it('month is 4 (April)',          () => assert.equal(s1.month, 4));
    it('day is 25',                   () => assert.equal(s1.day, 25));
    it('hour is 3',                   () => assert.equal(s1.hour, 3));
    it('minute is 0',                 () => assert.equal(s1.minute, 0));
    it('second is 0',                 () => assert.equal(s1.second, 0));
    it('referenceTimeSignificance is 1 (start of forecast)', () =>
        assert.equal(s1.referenceTimeSignificance, 1));
    it('typeOfData is 1 (forecast)',   () => assert.equal(s1.typeOfData, 1));
});

// ─── Section 3: Grid Definition ───────────────────────────────────────────────

describe('parseSection3', () => {
    let s3;
    before(() => { s3 = parseSection3(data, sections[3].dataStart); });

    it('template number is 0 (regular lat/lon)', () => assert.equal(s3.templateNumber, 0));
    it('Ni is 2801',  () => assert.equal(s3.ni, 2801));
    it('Nj is 1791',  () => assert.equal(s3.nj, 1791));
    it('Ni × Nj equals totalPoints', () =>
        assert.equal(s3.ni * s3.nj, s3.totalPoints));
    it('totalPoints is 5016591', () => assert.equal(s3.totalPoints, 5016591));

    it('La1 ≈ 55.4°N',  () => approx(s3.latitudeOfFirstPoint,  55.4, 0.001));
    it('Lo1 = -12°E',   () => approx(s3.longitudeOfFirstPoint, -12.0, 0.001));
    it('La2 = 37.5°N',  () => approx(s3.latitudeOfLastPoint,   37.5, 0.001));
    it('Lo2 ≈ 16°E',    () => approx(s3.longitudeOfLastPoint,  16.0, 0.001));
    it('Di = 0.01°',    () => approx(s3.di, 0.01, 1e-7));
    it('Dj = 0.01°',    () => approx(s3.dj, 0.01, 1e-7));

    it('scanning mode is 0', () => assert.equal(s3.scanningMode, 0));

    it('longitude span matches Ni × Di', () => {
        // Lo2 may wrap through 0°; compute span correctly
        const lo1 = s3.longitudeOfFirstPoint;  // -12
        const lo2 = s3.longitudeOfLastPoint;   // +16
        const span = lo2 - lo1;                // 28°
        approx(span, (s3.ni - 1) * s3.di, 0.01);
    });

    it('latitude span matches Nj × Dj', () => {
        const span = Math.abs(s3.latitudeOfFirstPoint - s3.latitudeOfLastPoint);
        approx(span, (s3.nj - 1) * s3.dj, 0.01);
    });
});

// ─── Section 5: Data Representation ──────────────────────────────────────────

describe('parseSection5', () => {
    let s5;
    before(() => { s5 = parseSection5(data, sections[5].dataStart); });

    it('template number is 42 (CCSDS)', () => assert.equal(s5.templateNumber, 42));
    it('numberOfPackedValues is 4160519', () => assert.equal(s5.numberOfPackedValues, 4160519));
    it('bitsPerValue is 16',              () => assert.equal(s5.bitsPerValue, 16));
    it('referenceValue ≈ 254.426 K',      () => approx(s5.referenceValue, 254.426, 0.001));
    it('binaryScaleFactor is -10',        () => assert.equal(s5.binaryScaleFactor, -10));
    it('decimalScaleFactor is 0',         () => assert.equal(s5.decimalScaleFactor, 0));
    it('ccsdsBlockSize is 32',            () => assert.equal(s5.ccsdsBlockSize, 32));
    it('ccsdsRsi is 128',                 () => assert.equal(s5.ccsdsRsi, 128));
    it('ccsdsFlags has PREPROCESS bit (0x08) set', () =>
        assert.ok(s5.ccsdsFlags & 0x08, 'AEC_DATA_PREPROCESS should be set'));
    it('ccsdsFlags has MSB bit (0x04) cleared (LE adjustment)', () =>
        assert.equal(s5.ccsdsFlags & 0x04, 0));
    it('ccsdsFlags has 3BYTE bit (0x02) cleared (LE adjustment)', () =>
        assert.equal(s5.ccsdsFlags & 0x02, 0));
});

// ─── Section 6: Bitmap ────────────────────────────────────────────────────────

describe('parseSection6', () => {
    let s6;
    before(() => {
        // totalPoints from section 3
        s6 = parseSection6(data, sections[6].dataStart, 5016591);
    });

    it('bitmap is present (indicator = 0)', () => assert.equal(s6.hasBitmap, true));
    it('bitmap has 5016591 entries', () =>
        assert.equal(s6.bitmap.length, 5016591));
    it('number of set bits equals numberOfPackedValues (4160519)', () => {
        let count = 0;
        for (const bit of s6.bitmap) count += bit;
        assert.equal(count, 4160519);
    });
    it('missing values count is 856072', () => {
        let missing = 0;
        for (const bit of s6.bitmap) if (bit === 0) missing++;
        assert.equal(missing, 856072);
    });
});

// ─── lookupParameter ─────────────────────────────────────────────────────────

describe('lookupParameter', () => {
    it('returns correct entry for standard parameters', () => {
        assert.equal(lookupParameter(0, 0, 0).shortName, 't');
        assert.equal(lookupParameter(0, 1, 1).shortName, 'r');
        assert.equal(lookupParameter(0, 2, 2).shortName, 'u');
        assert.equal(lookupParameter(0, 2, 3).shortName, 'v');
    });

    it('CAPE is at 0:7:6, not 0:7:0 (regression)', () => {
        assert.equal(lookupParameter(0, 7, 6).shortName, 'cape');
        assert.equal(lookupParameter(0, 7, 7).shortName, 'cin');
        assert.notEqual(lookupParameter(0, 7, 0).shortName, 'cape'); // 0:7:0 = pli
    });

    it('LW radiation: Net-surface at 0:5:0, Downward at 0:5:3 (regression)', () => {
        assert.equal(lookupParameter(0, 5, 0).shortName, 'nlwrs');
        assert.equal(lookupParameter(0, 5, 3).shortName, 'dlwrf');
        assert.equal(lookupParameter(0, 5, 4).shortName, 'ulwrf');
    });

    it('slhf/sshf are at 0:0:10/11, not in moisture category (regression)', () => {
        assert.equal(lookupParameter(0, 0, 10).shortName, 'slhf');
        assert.equal(lookupParameter(0, 0, 11).shortName, 'sshf');
    });

    it('HP/IP parameters resolve correctly', () => {
        assert.equal(lookupParameter(0, 1, 83).shortName, 'clwc');
        assert.equal(lookupParameter(0, 1, 84).shortName, 'ciwc');
        assert.equal(lookupParameter(0, 3, 18).shortName, 'blh');
        assert.equal(lookupParameter(0, 14, 0).shortName, 'toz');
        // SP2 graupel precipitation (0:1:75, eccodes shortName.def)
        assert.equal(lookupParameter(0, 1, 75).shortName, 'tgrp');
        assert.equal(lookupParameter(0, 1, 75).units, 'kg m-2');
    });

    it('land surface parameters (discipline 2)', () => {
        assert.equal(lookupParameter(2, 0, 2).shortName, 'stl');
        assert.equal(lookupParameter(2, 0, 9).shortName, 'swvl');
    });

    it('returns unknown placeholder for unregistered parameters', () => {
        const r = lookupParameter(0, 99, 99);
        assert.ok(r.shortName.startsWith('par_'));
        assert.equal(r.units, 'unknown');
    });
});
