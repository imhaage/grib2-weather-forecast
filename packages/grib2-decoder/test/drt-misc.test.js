import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const MISSING_VALUE = -1e100;

// ─── DRT 0 — simple packing ───────────────────────────────────────────────────

describe('drt-simple — DRT 0 non-trivial packing', () => {
    it('decodes 2 values with bitsPerValue=8', async () => {
        // R=100.0, E=0, D=0 → Y = 100 + X * 1 * 1
        // X[0]=10 → Y=110, X[1]=50 → Y=150
        // Float32 BE for 100.0: 0x42C80000
        // Bitstream: 0x0A (10), 0x32 (50)
        const { decode } = await import('../src/templates/drt-simple.js');
        const data = new Uint8Array([0x0A, 0x32]);
        const s5 = {
            referenceValue: 100.0,
            binaryScaleFactor: 0,
            decimalScaleFactor: 0,
            bitsPerValue: 8,
            numberOfPackedValues: 2,
        };
        const values = await decode(data, 0, 2, s5, 2, null);
        assert.ok(Math.abs(values[0] - 110) < 0.001, `values[0]=${values[0]} ≠ 110`);
        assert.ok(Math.abs(values[1] - 150) < 0.001, `values[1]=${values[1]} ≠ 150`);
    });

    it('decodes constant field (bitsPerValue=0) using referenceValue', async () => {
        const { decode } = await import('../src/templates/drt-simple.js');
        const s5 = {
            referenceValue: 273.15,
            binaryScaleFactor: 0,
            decimalScaleFactor: 0,
            bitsPerValue: 0,
            numberOfPackedValues: 0,
        };
        const values = await decode(new Uint8Array(0), 0, 0, s5, 3, null);
        assert.ok(Math.abs(values[0] - 273.15) < 0.001);
        assert.ok(Math.abs(values[1] - 273.15) < 0.001);
        assert.ok(Math.abs(values[2] - 273.15) < 0.001);
    });

    it('respects bitmap: bitmap=0 positions keep MISSING_VALUE', async () => {
        const { decode } = await import('../src/templates/drt-simple.js');
        const data = new Uint8Array([0x0A]);
        const s5 = {
            referenceValue: 0,
            binaryScaleFactor: 0,
            decimalScaleFactor: 0,
            bitsPerValue: 8,
            numberOfPackedValues: 1,
        };
        const bitmap = new Uint8Array([0, 1]);
        const values = await decode(data, 0, 1, s5, 2, bitmap);
        assert.equal(values[0], MISSING_VALUE);
        assert.equal(values[1], 10);
    });
});

// ─── DRT 254 — IEEE 754 float32 (local-use slot) ─────────────────────────────

describe('drt-ieee754 — DRT 254 float32 decoding', () => {
    it('decodes 2 big-endian float32 values correctly', async () => {
        // 273.15 in IEEE 754 BE: 0x43889999 (≈273.1500)
        // 300.00 in IEEE 754 BE: 0x43960000
        const { decode } = await import('../src/templates/drt-ieee754.js');
        const view = new DataView(new ArrayBuffer(8));
        view.setFloat32(0, 273.15, false);
        view.setFloat32(4, 300.0,  false);
        const data = new Uint8Array(view.buffer);
        const s5 = { numberOfPackedValues: 2 };
        const values = await decode(data, 0, 8, s5, 2, null);
        assert.ok(Math.abs(values[0] - 273.15) < 0.001, `values[0]=${values[0]}`);
        assert.ok(Math.abs(values[1] - 300.0)  < 0.001, `values[1]=${values[1]}`);
    });

    it('truncates gracefully when data is shorter than numberOfPackedValues', async () => {
        const { decode } = await import('../src/templates/drt-ieee754.js');
        const view = new DataView(new ArrayBuffer(4));
        view.setFloat32(0, 42.0, false);
        const data = new Uint8Array(view.buffer);
        const s5 = { numberOfPackedValues: 3 };
        const values = await decode(data, 0, 4, s5, 3, null);
        assert.ok(Math.abs(values[0] - 42.0) < 0.001);
        assert.equal(values[1], MISSING_VALUE);
        assert.equal(values[2], MISSING_VALUE);
    });
});

// ─── DRT 255 — constant / no packing ─────────────────────────────────────────

describe('drt-constant — DRT 255 always returns MISSING_VALUE', () => {
    it('fills all output slots with MISSING_VALUE regardless of input', async () => {
        const { decode } = await import('../src/templates/drt-constant.js');
        const values = await decode(new Uint8Array([0xFF, 0xFF, 0xFF]), 0, 3, {}, 4, null);
        assert.equal(values.length, 4);
        for (const v of values) assert.equal(v, MISSING_VALUE);
    });
});
