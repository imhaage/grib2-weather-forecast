import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeGRIB2, iterateGRIB2Messages } from '../src/decoder.js';

const GRIB_FILE = 'test/arome__001__SP1__01H__2026-04-25T03_00_00Z.grib2';
const FIXTURE   = 'test/fixtures/arome_t_ref.json';

// Le fixture est généré une fois via : npm run make-fixture
// Il est commité dans le dépôt — eccodes n'est pas requis à l'exécution des tests.
const ref = JSON.parse(readFileSync(FIXTURE, 'utf8'));

describe('cross-decode — JS decoder vs eccodes reference', () => {
    let values;

    before(async () => {
        const buf  = readFileSync(GRIB_FILE);
        const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
        let msgBuf;
        for (const msg of iterateGRIB2Messages(data)) {
            if (msg.product.shortName === 't') { msgBuf = msg.buffer; break; }
        }
        ({ values } = await decodeGRIB2(msgBuf));
    });

    it(`matches eccodes on ${ref.length} sample points`, () => {
        let maxDiff = 0;
        for (const { idx, val } of ref) {
            const diff = Math.abs(values[idx] - val);
            if (diff > maxDiff) maxDiff = diff;
            assert.ok(diff < 1e-3,
                `idx=${idx}: JS=${values[idx].toFixed(6)}, eccodes=${val.toFixed(6)}, diff=${diff.toExponential(2)}`);
        }
        console.log(`    max diff vs eccodes: ${maxDiff.toExponential(2)} K`);
    });
});
