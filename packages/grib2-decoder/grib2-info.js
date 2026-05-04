#!/usr/bin/env node
/**
 * grib2-info.js — Export GRIB2 file metadata to stdout or a .txt file.
 *
 * Usage:
 *   node grib2-info.js <file.grib2>               # stdout
 *   node grib2-info.js <file.grib2> metadata.txt  # write to file
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { basename } from 'node:path';
import {
    walkSections,
    parseSection1,
    parseSection3,
    parseSection5,
} from './src/decoder.js';
import {
    CENTRES, DISCIPLINES, REF_TIME_SIGNIFICANCE, TYPE_OF_DATA,
    DATA_REPR_TEMPLATES,
    fmtRefTime, fmtScanMode,
} from './src/wmo-tables.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const u8  = (d, i) => d[i];
const u16 = (d, i) => (d[i] << 8) | d[i + 1];
const u32 = (d, i) => (((d[i] << 24) | (d[i + 1] << 16) | (d[i + 2] << 8) | d[i + 3]) >>> 0);

function label(name)   { return name.padEnd(30, '.') + ' '; }
function code(v, table) { return table[v] !== undefined ? `${v} (${table[v]})` : `${v}`; }
function padR(s, n)    { return String(s).padStart(n); }

function section(title) {
    const bar = '─'.repeat(60);
    return `\n${bar}\n  ${title}\n${bar}\n`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const [,, inputPath, outputPath] = process.argv;

if (!inputPath) {
    console.error('Usage: node grib2-info.js <file.grib2> [output.txt]');
    process.exit(1);
}

const buf   = readFileSync(inputPath);
const data  = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
const stat  = { size: buf.byteLength };

const walked   = walkSections(data);
const sections = walked.sections;
const s1 = sections[1] ? parseSection1(data, sections[1].dataStart) : {};
const s3 = sections[3] ? parseSection3(data, sections[3].dataStart) : {};
const s5 = sections[5] ? parseSection5(data, sections[5].dataStart) : {};

// Bitmap indicator (just the flag byte, no full iteration)
const bitmapIndicator = sections[6]
    ? u8(data, sections[6].dataStart)
    : null;

// Section 7 data size
const s7DataBytes = sections[7] ? sections[7].secLen - 5 : 0;

// ─── Build report ─────────────────────────────────────────────────────────────

const lines = [];
const w = (s = '') => lines.push(s);

w('╔══════════════════════════════════════════════════════════╗');
w('║               GRIB2 FILE METADATA REPORT                ║');
w('╚══════════════════════════════════════════════════════════╝');
w();
w(label('File') + basename(inputPath));
w(label('File size') + `${stat.size.toLocaleString()} bytes`);
w(label('Generated') + new Date().toISOString());

w(section('SECTION 0 — Indicator'));
w(label('Edition')         + walked.edition);
w(label('Discipline')      + code(walked.discipline, DISCIPLINES));
w(label('Message length')  + `${walked.messageLength.toLocaleString()} bytes`);

w(section('SECTION 1 — Identification'));
w(label('Centre')                    + code(s1.centre, CENTRES));
w(label('Sub-centre')                + s1.subCentre);
w(label('Master tables version')     + s1.masterTablesVersion);
w(label('Local tables version')      + s1.localTablesVersion);
w(label('Reference time')            + code(s1.referenceTimeSignificance, REF_TIME_SIGNIFICANCE));
w(label('Reference datetime')        + fmtRefTime(s1));
w(label('Production status')         + s1.productionStatus);
w(label('Type of data')              + code(s1.typeOfData, TYPE_OF_DATA));

w(section('SECTION 3 — Grid Definition'));
w(label('Template')        + `3.${s3.templateNumber} (Regular lat/lon)`);
w(label('Total points')    + s3.totalPoints.toLocaleString());
w(label('Ni (longitude)')  + s3.ni);
w(label('Nj (latitude)')   + s3.nj);
w(label('La1 (first lat)') + `${s3.latitudeOfFirstPoint.toFixed(6)}°`);
w(label('Lo1 (first lon)') + `${s3.longitudeOfFirstPoint.toFixed(6)}°`);
w(label('La2 (last lat)')  + `${s3.latitudeOfLastPoint.toFixed(6)}°`);
w(label('Lo2 (last lon)')  + `${s3.longitudeOfLastPoint.toFixed(6)}°`);
w(label('Di (Δlon)')       + `${s3.di.toFixed(6)}°`);
w(label('Dj (Δlat)')       + `${s3.dj.toFixed(6)}°`);
w(label('Scanning mode')   + fmtScanMode(s3.scanningMode));

w(section('SECTION 5 — Data Representation'));
w(label('Template')             + code(s5.templateNumber, DATA_REPR_TEMPLATES));
w(label('N packed values')      + s5.numberOfPackedValues.toLocaleString());
w(label('Reference value R')    + s5.referenceValue.toExponential(6));
w(label('Binary scale factor E')+ s5.binaryScaleFactor + `  (× 2^${s5.binaryScaleFactor} = ${Math.pow(2, s5.binaryScaleFactor).toExponential(4)})`);
w(label('Decimal scale factor D')+ s5.decimalScaleFactor + `  (× 10^${-s5.decimalScaleFactor})`);
w(label('Bits per value')       + s5.bitsPerValue);
w(label('Unpacking formula')    + `Y = (R + X × 2^E) × 10^(-D)`);
if (s5.templateNumber === 42) {
    w(label('CCSDS block size')  + s5.ccsdsBlockSize);
    w(label('CCSDS RSI')         + s5.ccsdsRsi);
    w(label('CCSDS flags')       + `0x${(s5.ccsdsFlags | 0x06).toString(16).padStart(2,'0')}`
        + ` → PREPROCESS:${!!(s5.ccsdsFlags & 0x08)?1:0}`
        + ` MSB:${!!(s5.ccsdsFlags & 0x04)?1:0}`
        + ` 3BYTE:${!!(s5.ccsdsFlags & 0x02)?1:0}`
        + ` SIGNED:${!!(s5.ccsdsFlags & 0x01)?1:0}`);
}

w(section('SECTION 6 — Bitmap'));
if (bitmapIndicator === null) {
    w(label('Bitmap') + 'Section absent');
} else if (bitmapIndicator === 255) {
    w(label('Bitmap indicator') + '255 — no bitmap (all values present)');
    w(label('Valid values')     + s5.numberOfPackedValues.toLocaleString());
} else {
    const missing = s3.totalPoints - s5.numberOfPackedValues;
    const pct     = (s5.numberOfPackedValues / s3.totalPoints * 100).toFixed(2);
    w(label('Bitmap indicator') + `${bitmapIndicator} — bitmap present`);
    w(label('Grid points total')   + s3.totalPoints.toLocaleString());
    w(label('Valid values')        + `${s5.numberOfPackedValues.toLocaleString()} (${pct}%)`);
    w(label('Missing values')      + `${missing.toLocaleString()} (${(100 - parseFloat(pct)).toFixed(2)}%)`);
}

w(section('SECTION 7 — Data'));
w(label('Compressed size')  + `${s7DataBytes.toLocaleString()} bytes`);
const uncompressed = s5.numberOfPackedValues * Math.ceil(s5.bitsPerValue / 8);
w(label('Uncompressed size')+ `${uncompressed.toLocaleString()} bytes`);
if (s5.templateNumber === 42 && uncompressed > 0) {
    const ratio = (s7DataBytes / uncompressed * 100).toFixed(1);
    w(label('Compression ratio') + `${ratio}% of uncompressed`);
}

w(section('SECTIONS SUMMARY'));
const secNums = Object.keys(sections).map(Number).sort((a, b) => a - b);
w(`  ${'Sec'.padEnd(5)} ${'Offset'.padStart(10)} ${'Length'.padStart(10)}`);
w(`  ${'---'.padEnd(5)} ${'------'.padStart(10)} ${'------'.padStart(10)}`);
for (const n of secNums) {
    const s = sections[n];
    w(`  ${String(n).padEnd(5)} ${padR(s.offset, 10)} ${padR(s.secLen, 10)}`);
}

w();

// ─── Output ───────────────────────────────────────────────────────────────────

const report = lines.join('\n');

if (outputPath) {
    writeFileSync(outputPath, report + '\n');
    console.error(`Metadata written to ${outputPath}`);
} else {
    process.stdout.write(report + '\n');
}
