#!/usr/bin/env node
/**
 * grib2-export.js — Decode a GRIB2 file and export data values as CSV.
 *
 * Usage:
 *   node grib2-export.js <file.grib2>
 *       List all variables (messages) in the file.
 *
 *   node grib2-export.js <file.grib2> --variable <shortName>
 *       Decode and show stats for a specific variable.
 *
 *   node grib2-export.js <file.grib2> --variable <shortName> output.csv
 *       Decode and export a specific variable as CSV.
 *
 * CSV format (one row per valid grid point):
 *   lat,lon,value
 *   55.400000,-12.000000,281.148590
 *   ...
 *
 * Missing values (bitmap=0) are omitted from the output.
 */

import { createWriteStream } from 'node:fs';
import { readFileSync }      from 'node:fs';
import { basename }          from 'node:path';
import { pipeline }          from 'node:stream/promises';
import { Readable }          from 'node:stream';
import { decodeGRIB2, iterateGRIB2Messages, MISSING_VALUE } from './src/decoder.js';
import { computeStats } from './src/stats.js';
import { fmtRefTime, fmtValidTime } from './src/wmo-tables.js';

// ─── Args ─────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
    const args = argv.slice(2);
    let inputPath  = null;
    let outputPath = null;
    let variable   = null;

    for (let i = 0; i < args.length; i++) {
        if ((args[i] === '--variable' || args[i] === '-v') && i + 1 < args.length) {
            variable = args[++i];
        } else if (!inputPath) {
            inputPath = args[i];
        } else if (!outputPath) {
            outputPath = args[i];
        }
    }
    return { inputPath, outputPath, variable };
}

const { inputPath, outputPath, variable } = parseArgs(process.argv);

if (!inputPath) {
    console.error('Usage: node grib2-export.js <file.grib2> [--variable <shortName>] [output.csv]');
    process.exit(1);
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function indexToLatLon(idx, grid) {
    const row = Math.floor(idx / grid.ni);
    const col = idx % grid.ni;
    return {
        lat: (grid.latitudeOfFirstPoint  - row * grid.dj).toFixed(6),
        lon: (grid.longitudeOfFirstPoint + col * grid.di).toFixed(6),
    };
}

// ─── Read file ────────────────────────────────────────────────────────────────

process.stderr.write(`Reading  ${basename(inputPath)} …\n`);
const nodeBuf = readFileSync(inputPath);
// Keep as Uint8Array (zero-copy view over the Node Buffer)
const fileData = new Uint8Array(nodeBuf.buffer, nodeBuf.byteOffset, nodeBuf.byteLength);

// ─── Mode: list variables ─────────────────────────────────────────────────────

if (!variable) {
    console.log();
    console.log(`GRIB2 variables in ${basename(inputPath)}:`);
    console.log();

    const COL = { idx: 3, sn: 10, name: 38, units: 14, level: 20 };
    const hdr = [
        '#'.padEnd(COL.idx),
        'shortName'.padEnd(COL.sn),
        'name'.padEnd(COL.name),
        'units'.padEnd(COL.units),
        'level'.padEnd(COL.level),
        'forecastTime (UTC)',
    ].join('  ');
    console.log(hdr);
    console.log('─'.repeat(hdr.length));

    for (const msg of iterateGRIB2Messages(fileData)) {
        const p = msg.product;
        const lvl = `${p.levelValue} (typeOfSurface=${p.typeOfFirstFixedSurface})`;
        console.log([
            String(msg.index).padEnd(COL.idx),
            p.shortName.padEnd(COL.sn),
            p.name.slice(0, COL.name - 1).padEnd(COL.name),
            p.units.slice(0, COL.units - 1).padEnd(COL.units),
            lvl.slice(0, COL.level - 1).padEnd(COL.level),
            fmtValidTime(msg.header, p),
        ].join('  '));
    }
    console.log();
    console.log('Use --variable <shortName> to export a specific variable.');
    process.exit(0);
}

// ─── Find the requested variable ──────────────────────────────────────────────

let matchedMsg = null;
for (const msg of iterateGRIB2Messages(fileData)) {
    if (msg.product.shortName === variable) {
        matchedMsg = msg;
        break;
    }
}

if (!matchedMsg) {
    console.error(`Variable '${variable}' not found in ${basename(inputPath)}.`);
    console.error('Run without --variable to list available variables.');
    process.exit(1);
}

// ─── Decode ───────────────────────────────────────────────────────────────────

const p = matchedMsg.product;
process.stderr.write(`Variable  ${p.shortName}  ${p.name}  [${p.units}]\n`);
process.stderr.write('Decoding (CCSDS WASM) …\n');
const t0 = Date.now();
const { header, product, grid, values, bitmap } = await decodeGRIB2(matchedMsg.buffer);
const decodeMs = Date.now() - t0;

// ─── Stats ────────────────────────────────────────────────────────────────────

const { min, max, mean, stddev, count } = computeStats(values);

// ─── Terminal report ──────────────────────────────────────────────────────────

const lbl = (n) => n.padEnd(22, '.') + ' ';

console.log();
console.log('╔══════════════════════════════════════════════════╗');
console.log('║             GRIB2 DATA EXPORT REPORT            ║');
console.log('╚══════════════════════════════════════════════════╝');
console.log();
console.log(lbl('File')             + basename(inputPath));
console.log(lbl('Decode time')      + `${decodeMs} ms`);
console.log();
console.log('── Variable ─────────────────────────────────────────');
console.log(lbl('Short name')       + product.shortName);
console.log(lbl('Name')             + product.name);
console.log(lbl('Units')            + product.units);
console.log(lbl('Level type')       + product.typeOfFirstFixedSurface);
console.log(lbl('Level value')      + product.levelValue);
console.log(lbl('Forecast time (UTC)') + fmtValidTime(header, product));
console.log();
console.log('── Identification ───────────────────────────────────');
console.log(lbl('Centre')           + header.centre);
console.log(lbl('Reference time')   + fmtRefTime(header));
console.log();
console.log('── Grid ─────────────────────────────────────────────');
console.log(lbl('Dimensions')       + `${grid.ni} × ${grid.nj} = ${grid.totalPoints.toLocaleString()} pts`);
console.log(lbl('Bounding box')     + `${grid.latitudeOfLastPoint}°N–${grid.latitudeOfFirstPoint}°N`
                                    + `, ${grid.longitudeOfFirstPoint}°E–${grid.longitudeOfLastPoint}°E`);
console.log(lbl('Resolution')       + `${grid.di}° × ${grid.dj}°`);
console.log();
console.log('── Values ───────────────────────────────────────────');
console.log(lbl('Valid points')     + count.toLocaleString());
console.log(lbl('Missing points')   + (grid.totalPoints - count).toLocaleString());
console.log(lbl('Min')              + min.toFixed(6));
console.log(lbl('Max')              + max.toFixed(6));
console.log(lbl('Mean')             + mean.toFixed(6));
console.log(lbl('Std dev')          + stddev.toFixed(6));
console.log();

// Preview: first 10 valid values with their coordinates
console.log('── Preview (first 10 valid values) ──────────────────');
console.log(`${'lat'.padStart(11)} ${'lon'.padStart(11)} ${'value'.padStart(14)}`);
console.log(`${'─'.repeat(11)} ${'─'.repeat(11)} ${'─'.repeat(14)}`);
let shown = 0;
for (let idx = 0; idx < values.length && shown < 10; idx++) {
    if (values[idx] <= MISSING_VALUE) continue;
    const { lat, lon } = indexToLatLon(idx, grid);
    console.log(`${lat.padStart(11)} ${lon.padStart(11)} ${values[idx].toFixed(6).padStart(14)}`);
    shown++;
}
console.log();

if (!outputPath) {
    console.log('(no output file specified — pass a .csv path to export all values)');
    process.exit(0);
}

// ─── CSV streaming write ──────────────────────────────────────────────────────

const CHUNK = 64 * 1024; // 64 KB write buffer

process.stderr.write(`Writing  ${outputPath} …\n`);
const t1  = Date.now();
const out = createWriteStream(outputPath);

const rowStream = new Readable({ read() {} });

// Header row
rowStream.push('lat,lon,value\n');

// Batch rows into 64 KB chunks
let buf64   = '';
let written = 0;

for (let idx = 0; idx < values.length; idx++) {
    if (values[idx] <= MISSING_VALUE) continue;

    const { lat, lon } = indexToLatLon(idx, grid);
    buf64 += `${lat},${lon},${values[idx].toFixed(6)}\n`;
    written++;

    if (buf64.length >= CHUNK) {
        rowStream.push(buf64);
        buf64 = '';
    }
}
if (buf64.length > 0) rowStream.push(buf64);
rowStream.push(null); // EOF

await pipeline(rowStream, out);

const writeMs = Date.now() - t1;
const bytes   = out.bytesWritten;

console.log(`Wrote ${written.toLocaleString()} rows → ${outputPath}`);
console.log(`File size: ${(bytes / 1024 / 1024).toFixed(1)} MB  (${writeMs} ms)`);
