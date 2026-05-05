import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('drt-jpeg2000 — constant field (bitsPerValue=0)', () => {
    it('fills all points with referenceValue', async () => {
        const { decode } = await import('../src/templates/drt-jpeg2000.js');
        const data = new Uint8Array(0);
        const s5 = {
            templateNumber: 40, numberOfPackedValues: 4,
            referenceValue: 273.15, binaryScaleFactor: 0, decimalScaleFactor: 0,
            bitsPerValue: 0,
        };
        const values = await decode(data, 0, 0, s5, 4, null);
        for (const v of values) assert.equal(v, 273.15);
    });
});
