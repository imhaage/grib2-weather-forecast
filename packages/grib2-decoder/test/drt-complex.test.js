import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const MISSING_VALUE = -1e100;

describe('drt-complex — DRT 2 basic decode (no missing values)', () => {
    it('decodes 4 values from 1 group', async () => {
        // 1 group, bitsPerValue=6 (gref bits), W=6, L=4
        // gref[0]=0, values=[10,20,30,40] packed as 6-bit unsigned offsets
        // WMO requires byte-boundary between each array section:
        //   gref: 000000 (6 bits) + 00 padding → byte boundary
        //   X2:   001010 010100 011110 101000 (24 bits, 4 values × 6 bits)
        // Bytes: 0x00, 0x29, 0x47, 0xA8
        const { decode } = await import('../src/templates/drt-complex.js');
        const data = new Uint8Array([0x00, 0x29, 0x47, 0xA8]);
        const s5 = {
            templateNumber: 2,
            numberOfPackedValues: 4,
            referenceValue: 0,
            binaryScaleFactor: 0,
            decimalScaleFactor: 0,
            bitsPerValue: 6,
            missingValueManagement: 0,
            numberOfGroups: 1,
            groupWidthRef: 6,
            nBitsGroupWidth: 0,
            groupLengthRef: 4,
            lengthIncrement: 1,
            lastGroupLength: 4,
            nBitsGroupLength: 0,
        };
        const values = await decode(data, 0, 4, s5, 4, null);
        assert.deepEqual([...values], [10, 20, 30, 40]);
    });
});

describe('drt-complex — DRT 2 primary missing values', () => {
    it('emits MISSING_VALUE at sentinel positions', async () => {
        // 1 group, bitsPerValue=4, W=4, L=4, missingValueManagement=1
        // gref[0]=5, values: X2=[3, 7, 15(missing), 2]
        // ifld = [8, 12, missing, 7]
        // WMO requires byte-boundary: gref(4 bits) + 4 padding bits → byte boundary
        //   byte 0: 0101_0000 = 0x50 (gref=5=0101, padding=0000)
        //   byte 1: 0011_0111 = 0x37 (raw[0]=3, raw[1]=7)
        //   byte 2: 1111_0010 = 0xF2 (raw[2]=15=missing, raw[3]=2)
        const { decode } = await import('../src/templates/drt-complex.js');
        const data = new Uint8Array([0x50, 0x37, 0xF2]);
        const s5 = {
            templateNumber: 2, numberOfPackedValues: 4,
            referenceValue: 0, binaryScaleFactor: 0, decimalScaleFactor: 0,
            bitsPerValue: 4, missingValueManagement: 1,
            numberOfGroups: 1, groupWidthRef: 4, nBitsGroupWidth: 0,
            groupLengthRef: 4, lengthIncrement: 1, lastGroupLength: 4,
            nBitsGroupLength: 0,
        };
        const values = await decode(data, 0, 3, s5, 4, null);
        assert.equal(values[0], 8);
        assert.equal(values[1], 12);
        assert.equal(values[2], MISSING_VALUE);
        assert.equal(values[3], 7);
    });
});

describe('drt-complex — DRT 3 first-order spatial differencing', () => {
    it('reconstructs [1,2,3,4] from constant differences', async () => {
        // ww=1, ival1=1, GMIN=1 (sign=0, mag=1)
        // 1 group, bitsPerValue=4, W=4, L=4, all X2=0
        // Bitstream: [0x01, 0x01, 0x00, 0x00, 0x00]
        //   byte0: ival1=1
        //   byte1: sign(0)+mag(1) = GMIN=+1
        //   bytes2-4: gref(0000) + X2(0000,0000,0000,0000) + padding
        const { decode } = await import('../src/templates/drt-complex.js');
        const data = new Uint8Array([0x01, 0x01, 0x00, 0x00, 0x00]);
        const s5 = {
            templateNumber: 3, numberOfPackedValues: 4,
            referenceValue: 0, binaryScaleFactor: 0, decimalScaleFactor: 0,
            bitsPerValue: 4, missingValueManagement: 0,
            numberOfGroups: 1, groupWidthRef: 4, nBitsGroupWidth: 0,
            groupLengthRef: 4, lengthIncrement: 1, lastGroupLength: 4,
            nBitsGroupLength: 0,
            orderOfSpatialDiff: 1, nExtraDescriptorOctets: 1,
        };
        const values = await decode(data, 0, 5, s5, 4, null);
        assert.deepEqual([...values], [1, 2, 3, 4]);
    });
});

describe('drt-complex — DRT 3 second-order spatial differencing', () => {
    it('reconstructs [1,4,9,16] (squares) from second-order differences', async () => {
        // ww=1, ival1=1, ival2=4, GMIN=2 (sign=0, mag=2)
        // Differences: 9-2*4+1=2, 16-2*9+4=2, GMIN=2 → packed diffs all 0
        // 1 group, bitsPerValue=4, W=4, L=4, all X2=0
        // Bitstream: [0x01, 0x04, 0x02, 0x00, 0x00, 0x00]
        //   byte0: ival1=1
        //   byte1: ival2=4
        //   byte2: sign(0)+mag(2) = GMIN=+2
        //   bytes3-5: gref(0000) + X2*4 + padding
        const { decode } = await import('../src/templates/drt-complex.js');
        const data = new Uint8Array([0x01, 0x04, 0x02, 0x00, 0x00, 0x00]);
        const s5 = {
            templateNumber: 3, numberOfPackedValues: 4,
            referenceValue: 0, binaryScaleFactor: 0, decimalScaleFactor: 0,
            bitsPerValue: 4, missingValueManagement: 0,
            numberOfGroups: 1, groupWidthRef: 4, nBitsGroupWidth: 0,
            groupLengthRef: 4, lengthIncrement: 1, lastGroupLength: 4,
            nBitsGroupLength: 0,
            orderOfSpatialDiff: 2, nExtraDescriptorOctets: 1,
        };
        const values = await decode(data, 0, 6, s5, 4, null);
        assert.deepEqual([...values], [1, 4, 9, 16]);
    });
});

describe('drt-complex — DRT 3 negative GMIN', () => {
    it('handles negative minimum spatial difference', async () => {
        // Values: [10, 8, 6, 4] (decreasing by 2)
        // ival1=10, differences: [-2,-2,-2], GMIN=-2 (sign=1, mag=2)
        // packed = diff - GMIN = -2 - (-2) = 0 for all
        // ww=1, 1 group, bitsPerValue=4, W=4, L=4, all X2=0
        // Bitstream: [0x0A, 0x82, 0x00, 0x00, 0x00]
        //   byte0: ival1=10=0x0A
        //   byte1: sign(1)+mag(2) = 0b1_0000010 = 0x82
        //   bytes2-4: gref(0000) + X2*4 + padding
        const { decode } = await import('../src/templates/drt-complex.js');
        const data = new Uint8Array([0x0A, 0x82, 0x00, 0x00, 0x00]);
        const s5 = {
            templateNumber: 3, numberOfPackedValues: 4,
            referenceValue: 0, binaryScaleFactor: 0, decimalScaleFactor: 0,
            bitsPerValue: 4, missingValueManagement: 0,
            numberOfGroups: 1, groupWidthRef: 4, nBitsGroupWidth: 0,
            groupLengthRef: 4, lengthIncrement: 1, lastGroupLength: 4,
            nBitsGroupLength: 0,
            orderOfSpatialDiff: 1, nExtraDescriptorOctets: 1,
        };
        const values = await decode(data, 0, 5, s5, 4, null);
        assert.deepEqual([...values], [10, 8, 6, 4]);
    });
});
