#!/usr/bin/env node
/**
 * Génère test/fixtures/arome_t_ref.json à partir de grib_get_data (eccodes).
 *
 * Usage (une seule fois) :
 *   node test/generate-fixture.js test/arome__001__SP1__01H__2026-04-25T03_00_00Z.grib2
 *
 * Le fichier produit est commité dans le dépôt ; eccodes n'est pas requis
 * pour exécuter les tests, seulement pour régénérer ce fixture.
 *
 * Requiert : brew install eccodes
 */

import { execSync }                    from 'node:child_process';
import { writeFileSync, mkdirSync,
         readFileSync }                from 'node:fs';
import { parseGRIB2Header }            from '../src/decoder.js';

const file = process.argv[2];
if (!file) {
    console.error('Usage: node test/generate-fixture.js <file.grib2>');
    process.exit(1);
}

// ── Paramètres de grille depuis notre propre décodeur ─────────────────────────
// grib_get_data saute les points manquants → le numéro de ligne ne correspond
// pas à l'index flat. On recompute l'index à partir de (lat, lon).

const nodeBuf = readFileSync(file);
const data    = new Uint8Array(nodeBuf.buffer, nodeBuf.byteOffset, nodeBuf.byteLength);
const { grid } = parseGRIB2Header(data);
const { ni, latitudeOfFirstPoint: la1, longitudeOfFirstPoint: lo1, di, dj } = grid;

console.log(`Grid: ${ni}×${grid.nj}, La1=${la1}, Lo1=${lo1}, Di=${di}, Dj=${dj}`);

// ── Valeurs eccodes ───────────────────────────────────────────────────────────
// eccodes utilise shortName=T (majuscule) pour la température.
// Sortie : "Latitude Longitude Value\n  55.390  0.530  2.8114857483e+02\n ..."

const N = 500;

// On limite à N+1 lignes via head pour éviter de bufferiser 100 MB de sortie.
const raw = execSync(
    `grib_get_data -w shortName=T "${file}" | head -n ${N + 1}`,
    { encoding: 'utf8' },
);

const points = [];

for (const line of raw.split('\n').slice(1)) {   // skip header
    const parts = line.trim().split(/\s+/);
    if (parts.length < 3) continue;

    const lat = parseFloat(parts[0]);
    const lon = parseFloat(parts[1]);
    const val = parseFloat(parts[2]);
    if (!isFinite(val)) continue;

    // Index flat dans la grille (scan N→S, W→E)
    const row = Math.round((la1 - lat) / dj);
    const col = Math.round((lon  - lo1) / di);
    const idx = row * ni + col;

    points.push({ idx, lat, lon, val });
    if (points.length >= N) break;
}

mkdirSync('test/fixtures', { recursive: true });
writeFileSync('test/fixtures/arome_t_ref.json', JSON.stringify(points, null, 2));
console.log(`Wrote ${points.length} reference points → test/fixtures/arome_t_ref.json`);
