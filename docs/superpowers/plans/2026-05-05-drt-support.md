# DRT 2/3/40 Support Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add decoding support for DRT 2 (complex packing), DRT 3 (complex packing + spatial differencing, ICON-D2/EU/global), and DRT 40 (JPEG 2000, GFS) by refactoring the decoder into a modular per-template system.

**Architecture:** Each data representation template lives in `src/templates/drt-*.js` with a uniform `parseParams(data, t)` + `async decode(data, dataStart, dataLen, s5, totalPoints, bitmap)` interface. A registry maps template numbers to modules. `decoder.js` becomes a thin orchestrator.

**Tech Stack:** Node.js ESM, node:test, rolldown (build), OpenJPEG Emscripten WASM (DRT 40 only)

---

## File Map

**New files:**
- `src/byte-helpers.js` — shared bit/byte readers (extracted from decoder.js)
- `src/templates/registry.js` — maps templateNumber → module
- `src/templates/drt-constant.js` — DRT 255 (all missing)
- `src/templates/drt-simple.js` — DRT 0 (simple packing)
- `src/templates/drt-ccsds.js` — DRT 42 (CCSDS, wraps existing WASM loader)
- `src/templates/drt-ieee754.js` — DRT 254 (IEEE 754 floats)
- `src/templates/drt-complex.js` — DRT 2/3 (complex packing + spatial differencing)
- `src/templates/drt-jpeg2000.js` — DRT 40 (JPEG 2000, wraps OpenJPEG WASM)
- `src/wasm/jpeg2000-loader.js` — lazy WASM loader for OpenJPEG
- `src/wasm/jpeg2000/jpeg2000.js` + `jpeg2000.wasm` — pre-built Emscripten artifact
- `test/drt-complex.test.js` — unit tests for DRT 2/3
- `test/drt-jpeg2000.test.js` — unit tests for DRT 40

**Modified files:**
- `src/decoder.js` — delegates to registry; `parseSection5` preserved with same signature
- `src/wmo-tables.js` — fix DRT 40 label
- `rolldown.config.js` — add jpeg2000.js/wasm to copy-wasm-assets plugin

---

## Key reference: byte offsets in Section 5

All template modules receive `t = dataStart + 6` (6 bytes past the generic Section 5 header).
At `t`, the layout is: R(+0..3), E(+4..5), D(+6..7), bitsPerValue(+8), typeOfField(+9).
DRT 2/3 fields continue from `t+10`:

```
t+10: groupSplittingMethod (1 byte, ignored in decode)
t+11: missingValueManagement (1 byte)  0=none 1=primary 2=primary+secondary
t+12..15: primaryMissingValue (4 bytes, float32 or int32)
t+16..19: secondaryMissingValue (4 bytes)
t+20..23: NG — number of groups (uint32 BE)
t+24: Wref — group widths reference (uint8)
t+25: nBitsW — bits per group width (uint8)
t+26..29: Lref — group lengths reference (uint32 BE)
t+30: ΔL — length increment (uint8)
t+31..34: lastGroupLength (uint32 BE)
t+35: nBitsL — bits per scaled group length (uint8)
t+36: orderOfSpatialDiff (uint8, DRT 3 only)
t+37: nExtraDescriptorOctets / ww (uint8, DRT 3 only)
```

---

## Task 1: Extract shared byte helpers

**Files:**
- Create: `src/byte-helpers.js`

- [ ] **Write `src/byte-helpers.js`**

`MISSING_VALUE` lives here (not in decoder.js) to avoid circular imports: template modules
import from byte-helpers.js; decoder.js also re-exports it for backward compatibility.

```js
/** Sentinel value for missing / bitmap-masked grid points. */
export const MISSING_VALUE = -1e100;

export const u8  = (d, i) => d[i];
export const u16 = (d, i) => (d[i] << 8) | d[i + 1];
export const u32 = (d, i) => (((d[i] << 24) | (d[i+1] << 16) | (d[i+2] << 8) | d[i+3]) >>> 0);
// Sign-magnitude 16-bit (GRIB2 scale factors: bit 15 = sign, bits 14-0 = magnitude)
export const sm16 = (d, i) => { const r = u16(d, i); return (r & 0x8000) ? -(r & 0x7FFF) : r; };
// IEEE 754 float32 big-endian
export const f32be = (d, i) => new DataView(d.buffer, d.byteOffset + i, 4).getFloat32(0, false);

/**
 * Read nBits bits from data starting at bitPos[0] (MSB first).
 * bitPos is a single-element array used as a mutable reference.
 */
export function readBits(data, bitPos, nBits) {
    let value = 0;
    for (let i = 0; i < nBits; i++) {
        const byteIdx = bitPos[0] >>> 3;
        const bitIdx  = 7 - (bitPos[0] & 7);
        value = (value << 1) | ((data[byteIdx] >> bitIdx) & 1);
        bitPos[0]++;
    }
    return value >>> 0;
}
```

- [ ] **Update `src/decoder.js` to import from byte-helpers**

`MISSING_VALUE` moves to `byte-helpers.js` to avoid circular imports (template modules
import byte-helpers; decoder.js re-exports `MISSING_VALUE` for backward compat via
`export { MISSING_VALUE } from './byte-helpers.js'`).

Replace the four inline helper definitions at the top of decoder.js:

```js
// Remove these lines (they currently appear around line 38-49):
const u8  = (d, i) => d[i];
const u16 = (d, i) => (d[i] << 8) | d[i + 1];
const u32 = (d, i) => (((d[i] << 24) | (d[i + 1] << 16) | (d[i + 2] << 8) | d[i + 3]) >>> 0);
const i32 = (d, i) => { const v = u32(d, i); return v >= 0x80000000 ? v - 0x100000000 : v; };
const sm16 = (d, i) => { ... };
const f32be = (d, i) => ...;

// Add at the top (after the first import line):
import { u8, u16, u32, sm16, f32be, readBits } from './byte-helpers.js';
```

Note: `i32` is only used inside decoder.js (not needed elsewhere) — keep it local or inline where used. Check with `grep -n 'i32(' src/decoder.js`.

Also remove the local `readBits` function definition (around line 434-443) since it is now imported.

- [ ] **Run tests to confirm no regression**

```bash
cd packages/grib2-decoder && npm test
```
Expected: 98 passing tests.

- [ ] **Commit**

```bash
git add packages/grib2-decoder/src/byte-helpers.js packages/grib2-decoder/src/decoder.js
git commit -m "refactor: extract byte helpers to src/byte-helpers.js"
```

---

## Task 2: Create template registry and drt-constant

**Files:**
- Create: `src/templates/registry.js`
- Create: `src/templates/drt-constant.js`

- [ ] **Write `src/templates/drt-constant.js`**

```js
import { MISSING_VALUE } from '../byte-helpers.js';

export function parseParams(_data, _t) {
    return {};
}

export async function decode(_data, _dataStart, _dataLen, _s5, totalPoints, _bitmap) {
    return new Float64Array(totalPoints).fill(MISSING_VALUE);
}
```

- [ ] **Write `src/templates/registry.js`** (stubs for now — modules will be added in later tasks)

```js
import * as drtConstant from './drt-constant.js';

const TEMPLATES = {
    255: drtConstant,
};

export function getTemplate(n) {
    const t = TEMPLATES[n];
    if (!t) throw new Error(`Unsupported Data Representation Template: ${n}`);
    return t;
}

export function registerTemplate(n, module) {
    TEMPLATES[n] = module;
}
```

- [ ] **Run tests**

```bash
cd packages/grib2-decoder && npm test
```
Expected: 98 passing (registry not yet used by decoder.js).

- [ ] **Commit**

```bash
git add packages/grib2-decoder/src/templates/
git commit -m "feat: add template registry and drt-constant module"
```

---

## Task 3: Extract DRT 0 → drt-simple.js

**Files:**
- Create: `src/templates/drt-simple.js`
- Modify: `src/templates/registry.js`

- [ ] **Write `src/templates/drt-simple.js`**

```js
import { f32be, sm16, u8, readBits } from '../byte-helpers.js';
import { MISSING_VALUE } from '../byte-helpers.js';

export function parseParams(data, t) {
    if (t + 10 > data.length) return {};
    return {
        referenceValue:     f32be(data, t),
        binaryScaleFactor:  sm16(data, t + 4),
        decimalScaleFactor: sm16(data, t + 6),
        bitsPerValue:       u8(data, t + 8),
    };
}

export async function decode(data, dataStart, _dataLen, s5, totalPoints, bitmap) {
    const values = new Float64Array(totalPoints).fill(MISSING_VALUE);
    if (s5.bitsPerValue === 0) {
        for (let i = 0; i < totalPoints; i++)
            if (!bitmap || bitmap[i] !== 0) values[i] = s5.referenceValue;
        return values;
    }
    const R      = s5.referenceValue;
    const bScale = Math.pow(2, s5.binaryScaleFactor);
    const dScale = Math.pow(10, -s5.decimalScaleFactor);
    const bitPos = [dataStart * 8];
    let valIdx = 0;
    for (let i = 0; i < totalPoints; i++) {
        if (bitmap && bitmap[i] === 0) continue;
        if (valIdx >= s5.numberOfPackedValues) break;
        const coded = readBits(data, bitPos, s5.bitsPerValue);
        values[i]   = (R + coded * bScale) * dScale;
        valIdx++;
    }
    return values;
}
```

- [ ] **Register DRT 0 in `src/templates/registry.js`**

Add at the top: `import * as drtSimple from './drt-simple.js';`
Add to TEMPLATES: `0: drtSimple,`

- [ ] **Run tests**

```bash
cd packages/grib2-decoder && npm test
```
Expected: 98 passing.

- [ ] **Commit**

```bash
git add packages/grib2-decoder/src/templates/
git commit -m "feat: add drt-simple module (DRT 0)"
```

---

## Task 4: Extract DRT 42 → drt-ccsds.js and DRT 254 → drt-ieee754.js

**Files:**
- Create: `src/templates/drt-ccsds.js`
- Create: `src/templates/drt-ieee754.js`
- Modify: `src/templates/registry.js`

- [ ] **Write `src/templates/drt-ccsds.js`**

```js
import { f32be, sm16, u8, u16 } from '../byte-helpers.js';
import { MISSING_VALUE } from '../byte-helpers.js';
import { ccsdsDecodeBuffer, AEC_FLAGS_LE } from '../wasm/ccsds-loader.js';

export function parseParams(data, t) {
    if (t + 10 > data.length) return {};
    const result = {
        referenceValue:     f32be(data, t),
        binaryScaleFactor:  sm16(data, t + 4),
        decimalScaleFactor: sm16(data, t + 6),
        bitsPerValue:       u8(data, t + 8),
        ccsdsFlags:         AEC_FLAGS_LE,
        ccsdsBlockSize:     32,
        ccsdsRsi:           128,
    };
    if (t + 14 <= data.length) {
        const rawFlags        = u8(data, t + 10);
        result.ccsdsFlags     = rawFlags & ~0x06;
        result.ccsdsBlockSize = u8(data, t + 11);
        result.ccsdsRsi       = u16(data, t + 12);
    }
    return result;
}

export async function decode(data, dataStart, dataLen, s5, totalPoints, bitmap) {
    const values = new Float64Array(totalPoints).fill(MISSING_VALUE);
    if (s5.bitsPerValue === 0) {
        for (let i = 0; i < totalPoints; i++)
            if (!bitmap || bitmap[i] !== 0) values[i] = s5.referenceValue;
        return values;
    }
    const compressed = data.slice(dataStart, dataStart + dataLen);
    const decoded    = await ccsdsDecodeBuffer(
        compressed, s5.numberOfPackedValues, s5.bitsPerValue,
        s5.ccsdsBlockSize, s5.ccsdsRsi, s5.ccsdsFlags
    );
    const R      = s5.referenceValue;
    const bScale = Math.pow(2, s5.binaryScaleFactor);
    const dScale = Math.pow(10, -s5.decimalScaleFactor);
    let valIdx = 0;
    for (let i = 0; i < totalPoints; i++) {
        if (bitmap && bitmap[i] === 0) continue;
        if (valIdx >= s5.numberOfPackedValues) break;
        values[i] = (R + decoded[valIdx] * bScale) * dScale;
        valIdx++;
    }
    return values;
}
```

- [ ] **Write `src/templates/drt-ieee754.js`**

```js
import { MISSING_VALUE } from '../byte-helpers.js';

export function parseParams(_data, _t) {
    return {};
}

export async function decode(data, dataStart, _dataLen, s5, totalPoints, _bitmap) {
    const values = new Float64Array(totalPoints).fill(MISSING_VALUE);
    const view   = new DataView(data.buffer, data.byteOffset);
    for (let i = 0; i < s5.numberOfPackedValues; i++) {
        const offset = dataStart + i * 4;
        if (offset + 4 <= data.length)
            values[i] = view.getFloat32(offset, false);
    }
    return values;
}
```

- [ ] **Register DRT 42 and 254 in registry.js**

```js
import * as drtCcsds   from './drt-ccsds.js';
import * as drtIeee754 from './drt-ieee754.js';
// add to TEMPLATES:
42:  drtCcsds,
254: drtIeee754,
```

- [ ] **Run tests**

```bash
cd packages/grib2-decoder && npm test
```
Expected: 98 passing.

- [ ] **Commit**

```bash
git add packages/grib2-decoder/src/templates/
git commit -m "feat: add drt-ccsds and drt-ieee754 modules"
```

---

## Task 5: Refactor decoder.js to use the registry

This is the integration step. `decoder.js` delegates all template logic to the registry.

**Files:**
- Modify: `src/decoder.js`

- [ ] **Update imports in decoder.js**

At the top of decoder.js, add:
```js
import { getTemplate } from './templates/registry.js';
```

Remove the import of `ccsdsDecodeBuffer` and `AEC_FLAGS_LE` from `./wasm/ccsds-loader.js`
(these are now used only inside drt-ccsds.js).

- [ ] **Rewrite `parseSection5` to delegate template-specific parsing**

Replace the current `parseSection5` function body with:

```js
function parseSection5(data, dataStart) {
    const d = dataStart;
    if (d + 6 > data.length) return { templateNumber: 0, numberOfPackedValues: 0 };

    const numberOfPackedValues = u32(data, d);
    const templateNumber       = u16(data, d + 4);
    const t = d + 6;

    let tmplParams = {};
    try {
        const mod = getTemplate(templateNumber);
        tmplParams = mod.parseParams(data, t);
    } catch {
        // Unknown template — parseSection5 does not throw, decodeGRIB2 will
    }

    return { templateNumber, numberOfPackedValues, ...tmplParams };
}
```

- [ ] **Rewrite the decode dispatch in `decodeGRIB2`**

Replace the `if (s5.bitsPerValue === 0 || tmpl === 40) { ... } else if (tmpl === 0) { ... }` block with:

```js
const tmplMod = getTemplate(tmpl);
const values  = await tmplMod.decode(data, dataStart, dataLen, s5, totalPoints, bitmap);
```

Remove the `readBits` local function definition (it's now in byte-helpers.js and imported from there).

- [ ] **Run the full test suite**

```bash
cd packages/grib2-decoder && npm test
```
Expected: **98 passing**. This validates the refactor is a transparent transformation.

- [ ] **Commit**

```bash
git add packages/grib2-decoder/src/decoder.js
git commit -m "refactor: decoder.js delegates to template registry"
```

---

## Task 6: Fix wmo-tables.js

**Files:**
- Modify: `src/wmo-tables.js`

- [ ] **Fix the DRT 40 label**

In `src/wmo-tables.js`, change:
```js
40: 'Constant field',
```
to:
```js
40: 'JPEG 2000 code stream format',
```

- [ ] **Run tests**

```bash
cd packages/grib2-decoder && npm test
```
Expected: 98 passing.

- [ ] **Commit**

```bash
git add packages/grib2-decoder/src/wmo-tables.js
git commit -m "fix: correct DRT 40 label in wmo-tables (was 'Constant field', is JPEG 2000)"
```

---

## Task 7: Implement drt-complex.js — parseParams + DRT 2 decode

**Files:**
- Create: `src/templates/drt-complex.js`
- Create: `test/drt-complex.test.js`
- Modify: `src/templates/registry.js`

### 7a — Write the failing tests for DRT 2 basic decode

- [ ] **Create `test/drt-complex.test.js` with a failing DRT 2 test**

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Import decode directly once the module exists
// We test decode() in isolation — no need for a full GRIB2 buffer.

const MISSING_VALUE = -1e100;

describe('drt-complex — DRT 2 basic decode (no missing values)', () => {
    it('decodes 4 values from 1 group', async () => {
        // 1 group, bitsPerValue=6 (gref bits), W=6, L=4
        // gref[0]=0, values=[10,20,30,40] packed as 6-bit unsigned offsets
        // Bitstream (30 bits → 4 bytes):
        //   gref: 000000 (6 bits)
        //   X2:   001010 010100 011110 101000
        // Bytes: 0x00, 0xA5, 0x1E, 0xA0  (last 2 bits padding)
        const { decode } = await import('../src/templates/drt-complex.js');
        const data = new Uint8Array([0x00, 0xA5, 0x1E, 0xA0]);
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
```

- [ ] **Run the test to confirm it fails (module does not exist yet)**

```bash
cd packages/grib2-decoder && node --test test/drt-complex.test.js
```
Expected: error (Cannot find module or similar).

### 7b — Implement drt-complex.js (DRT 2, no missing values)

- [ ] **Write `src/templates/drt-complex.js`**

```js
import { f32be, sm16, u8, u32, readBits } from '../byte-helpers.js';
import { MISSING_VALUE } from '../byte-helpers.js';

export function parseParams(data, t) {
    if (t + 36 > data.length) return {};
    const params = {
        referenceValue:         f32be(data, t),
        binaryScaleFactor:      sm16(data, t + 4),
        decimalScaleFactor:     sm16(data, t + 6),
        bitsPerValue:           u8(data, t + 8),
        missingValueManagement: u8(data, t + 11),
        numberOfGroups:         u32(data, t + 20),
        groupWidthRef:          u8(data, t + 24),
        nBitsGroupWidth:        u8(data, t + 25),
        groupLengthRef:         u32(data, t + 26),
        lengthIncrement:        u8(data, t + 30),
        lastGroupLength:        u32(data, t + 31),
        nBitsGroupLength:       u8(data, t + 35),
        orderOfSpatialDiff:     0,
        nExtraDescriptorOctets: 0,
    };
    if (t + 38 <= data.length) {
        params.orderOfSpatialDiff     = u8(data, t + 36);
        params.nExtraDescriptorOctets = u8(data, t + 37);
    }
    return params;
}

export async function decode(data, dataStart, _dataLen, s5, totalPoints, bitmap) {
    const values = new Float64Array(totalPoints).fill(MISSING_VALUE);
    const {
        referenceValue: R, binaryScaleFactor: E, decimalScaleFactor: D,
        bitsPerValue: bpv, missingValueManagement: missVal,
        numberOfGroups: NG, groupWidthRef: Wref, nBitsGroupWidth: nBitsW,
        groupLengthRef: Lref, lengthIncrement: deltaL, lastGroupLength,
        nBitsGroupLength: nBitsL,
        templateNumber, orderOfSpatialDiff: order, nExtraDescriptorOctets: ww,
    } = s5;

    const bScale = Math.pow(2, E);
    const dScale = Math.pow(10, -D);
    const bitPos = [dataStart * 8];

    // ── DRT 3 extra descriptors ────────────────────────────────────────────────
    let ival1 = 0, ival2 = 0, gmin = 0;
    if (templateNumber === 3 && ww > 0) {
        const nBitsDesc = ww * 8;
        ival1 = readBits(data, bitPos, nBitsDesc);
        if (order === 2) ival2 = readBits(data, bitPos, nBitsDesc);
        const sign = readBits(data, bitPos, 1);
        const mag  = readBits(data, bitPos, nBitsDesc - 1);
        gmin = sign ? -mag : mag;
    }

    // ── Group references ───────────────────────────────────────────────────────
    const gref = new Int32Array(NG);
    for (let g = 0; g < NG; g++) gref[g] = readBits(data, bitPos, bpv);

    // ── Group widths ───────────────────────────────────────────────────────────
    const gwidth = new Uint8Array(NG);
    for (let g = 0; g < NG; g++)
        gwidth[g] = Wref + (nBitsW > 0 ? readBits(data, bitPos, nBitsW) : 0);

    // ── Group lengths ──────────────────────────────────────────────────────────
    const glen = new Int32Array(NG);
    for (let g = 0; g < NG; g++)
        glen[g] = Lref + (nBitsL > 0 ? readBits(data, bitPos, nBitsL) : 0) * deltaL;
    if (NG > 0) glen[NG - 1] = lastGroupLength;

    // ── Unpack values and detect missing ──────────────────────────────────────
    const N = s5.numberOfPackedValues;
    const ifld     = new Int32Array(N);
    const ifldmiss = new Uint8Array(N);   // 0=valid 1=primary missing 2=secondary missing
    let n = 0;
    for (let g = 0; g < NG; g++) {
        const W = gwidth[g];
        const L = glen[g];
        const msng1 = W > 0 ? (1 << W) - 1 : -1;
        const msng2 = W > 1 ? (1 << W) - 2 : -1;

        for (let k = 0; k < L && n < N; k++, n++) {
            const raw = W > 0 ? readBits(data, bitPos, W) : 0;
            if (missVal >= 1 && raw === msng1) {
                ifldmiss[n] = 1;
            } else if (missVal === 2 && raw === msng2) {
                ifldmiss[n] = 2;
            } else {
                ifld[n] = raw + gref[g];
            }
        }
    }

    // ── Spatial differencing (DRT 3 only) ─────────────────────────────────────
    if (templateNumber === 3 && ww > 0) {
        // Collect non-missing indices for reconstruction
        const nonMiss = [];
        for (let i = 0; i < N; i++) if (ifldmiss[i] === 0) nonMiss.push(i);

        if (nonMiss.length > 0) ifld[nonMiss[0]] = ival1;
        if (order === 2 && nonMiss.length > 1) ifld[nonMiss[1]] = ival2;

        const start = order === 2 ? 2 : 1;
        for (let k = start; k < nonMiss.length; k++) {
            const i = nonMiss[k];
            if (order === 1) {
                ifld[i] = ifld[i] + gmin + ifld[nonMiss[k - 1]];
            } else {
                ifld[i] = ifld[i] + gmin + 2 * ifld[nonMiss[k - 1]] - ifld[nonMiss[k - 2]];
            }
        }
    }

    // ── Physical scaling and bitmap application ────────────────────────────────
    let valIdx = 0;
    for (let i = 0; i < totalPoints; i++) {
        if (bitmap && bitmap[i] === 0) continue;
        if (valIdx >= N) break;
        if (ifldmiss[valIdx] === 0)
            values[i] = (R + ifld[valIdx] * bScale) * dScale;
        // else: MISSING_VALUE already set
        valIdx++;
    }

    return values;
}
```

- [ ] **Register DRT 2 and 3 in registry.js**

```js
import * as drtComplex from './drt-complex.js';
// add to TEMPLATES:
2: drtComplex,
3: drtComplex,
```

- [ ] **Run drt-complex.test.js**

```bash
cd packages/grib2-decoder && node --test test/drt-complex.test.js
```
Expected: 1 passing.

- [ ] **Run full test suite**

```bash
cd packages/grib2-decoder && npm test
```
Expected: 99+ passing.

- [ ] **Commit**

```bash
git add packages/grib2-decoder/src/templates/drt-complex.js \
        packages/grib2-decoder/src/templates/registry.js \
        packages/grib2-decoder/test/drt-complex.test.js
git commit -m "feat: implement DRT 2/3 complex packing decoder"
```

---

## Task 8: DRT 2/3 — Add remaining tests (missing values, spatial differencing)

**Files:**
- Modify: `test/drt-complex.test.js`

- [ ] **Add DRT 2 primary missing value test**

Append to `test/drt-complex.test.js`:

```js
describe('drt-complex — DRT 2 primary missing values', () => {
    it('emits MISSING_VALUE at sentinel positions', async () => {
        // 1 group, bitsPerValue=4, W=4, L=4, missingValueManagement=1
        // gref[0]=5, values: X2=[3, 7, 15(missing), 2]
        // ifld = [8, 12, missing, 7]
        // Bitstream (20 bits):
        //   gref: 0101 (=5)
        //   X2:   0011 0111 1111 0010
        // Bytes: 0x53, 0x7F, 0x20
        const { decode } = await import('../src/templates/drt-complex.js');
        const data = new Uint8Array([0x53, 0x7F, 0x20]);
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
```

- [ ] **Add DRT 3 first-order spatial differencing test**

```js
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
```

- [ ] **Add DRT 3 second-order spatial differencing test**

```js
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
```

- [ ] **Add DRT 3 negative GMIN test**

```js
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
```

- [ ] **Run drt-complex tests**

```bash
cd packages/grib2-decoder && node --test test/drt-complex.test.js
```
Expected: all passing.

- [ ] **Run full suite**

```bash
cd packages/grib2-decoder && npm test
```
Expected: 102+ passing.

- [ ] **Commit**

```bash
git add packages/grib2-decoder/test/drt-complex.test.js
git commit -m "test: add DRT 2/3 unit tests (missing values, 1st/2nd order spatial diff)"
```

---

## Task 9: Acquire OpenJPEG WASM artifact

DRT 40 requires OpenJPEG compiled to WASM. This task finds and integrates the artifact.

**Files:**
- Create: `src/wasm/jpeg2000/jpeg2000.js`
- Create: `src/wasm/jpeg2000/jpeg2000.wasm`
- Create: `src/wasm/jpeg2000/jpeg2000_wrapper.c` (C wrapper source, for reference)

- [ ] **Search for a pre-built OpenJPEG WASM package**

```bash
npm view openjpeg-js 2>/dev/null && echo "found" || echo "not found"
npm view @geooptix/openjpeg 2>/dev/null && echo "found" || echo "not found"
```

If a suitable package is found, install it as a dev dependency and copy its `.js` + `.wasm`
files to `src/wasm/jpeg2000/`. The package must export a function that:
- Takes a `Uint8Array` (raw J2C codestream)
- Returns an `Int32Array` of decoded integer samples

Skip to Task 10 if a ready-to-use package is found.

- [ ] **If no package found: use the OpenJPEG Emscripten SDK build**

Download the official Emscripten build from the OpenJPEG GitHub releases:

```bash
# Check latest release
curl -s https://api.github.com/repos/uclouvain/openjpeg/releases/latest | grep "tag_name"
# Download openjpeg-*-emscripten.zip from the release assets
# Extract jpeg2000.js and jpeg2000.wasm to src/wasm/jpeg2000/
```

Alternatively, build from source using the same Emscripten toolchain as libaec.
See `src/wasm/build.sh` for the pattern to follow. The C wrapper to expose:

```c
// src/wasm/jpeg2000/jpeg2000_wrapper.c
#include "openjpeg.h"
#include <stdlib.h>

typedef struct { uint8_t *data; int len; int pos; } MemStream;

static OPJ_SIZE_T mem_read(void *buf, OPJ_SIZE_T n, void *user) {
    MemStream *s = user;
    OPJ_SIZE_T avail = s->len - s->pos;
    if (avail == 0) return (OPJ_SIZE_T)-1;
    if (n > avail) n = avail;
    memcpy(buf, s->data + s->pos, n);
    s->pos += n;
    return n;
}
static OPJ_OFF_T mem_skip(OPJ_OFF_T n, void *user) {
    MemStream *s = user; s->pos += n; return n;
}
static OPJ_BOOL mem_seek(OPJ_OFF_T pos, void *user) {
    MemStream *s = user; s->pos = pos; return OPJ_TRUE;
}

int *jp2_decode(uint8_t *input, int input_len, int *out_count) {
    MemStream ms = {input, input_len, 0};
    opj_stream_t *stream = opj_stream_create(4096, OPJ_TRUE);
    opj_stream_set_user_data(stream, &ms, NULL);
    opj_stream_set_read_function(stream, mem_read);
    opj_stream_set_skip_function(stream, mem_skip);
    opj_stream_set_seek_function(stream, mem_seek);
    opj_stream_set_user_data_length(stream, input_len);

    opj_codec_t *codec = opj_create_decompress(OPJ_CODEC_J2K);
    opj_dparameters_t params; opj_set_default_decoder_parameters(&params);
    opj_setup_decoder(codec, &params);

    opj_image_t *image = NULL;
    if (!opj_read_header(stream, codec, &image) || !opj_decode(codec, stream, image)) {
        opj_destroy_codec(codec); opj_stream_destroy(stream);
        if (image) opj_image_destroy(image);
        *out_count = 0; return NULL;
    }
    int n = image->comps[0].w * image->comps[0].h;
    int *out = (int *)malloc(n * sizeof(int));
    for (int i = 0; i < n; i++) out[i] = image->comps[0].data[i];
    *out_count = n;
    opj_destroy_codec(codec); opj_stream_destroy(stream); opj_image_destroy(image);
    return out;
}

void jp2_free(int *ptr) { free(ptr); }
```

Build command (after emcc is available):
```bash
emcc jpeg2000_wrapper.c -I/path/to/openjpeg/include \
  /path/to/libopenjp2.a \
  -o jpeg2000.js \
  -s MODULARIZE=1 -s EXPORT_NAME=createJP2Module \
  -s EXPORTED_FUNCTIONS='["_jp2_decode","_jp2_free","_malloc","_free"]' \
  -s EXPORTED_RUNTIME_METHODS='["HEAPU8","HEAP32"]' \
  -s ALLOW_MEMORY_GROWTH=1 -O2
```

- [ ] **Verify the artifact loads and exposes the expected API**

```bash
node -e "
import('./src/wasm/jpeg2000/jpeg2000.js').then(m => m.default({})).then(mod => {
  console.log('exports:', Object.keys(mod).filter(k => k.startsWith('_')));
})
"
```
Expected output includes `_jp2_decode`, `_jp2_free`.

- [ ] **Commit the WASM artifact**

```bash
git add packages/grib2-decoder/src/wasm/jpeg2000/
git commit -m "feat: add OpenJPEG WASM artifact for DRT 40 (JPEG 2000) decoding"
```

---

## Task 10: Implement DRT 40 — jpeg2000-loader.js and drt-jpeg2000.js

**Files:**
- Create: `src/wasm/jpeg2000-loader.js`
- Create: `src/templates/drt-jpeg2000.js`
- Create: `test/drt-jpeg2000.test.js`
- Modify: `src/templates/registry.js`
- Modify: `rolldown.config.js`

- [ ] **Write `src/wasm/jpeg2000-loader.js`** (mirrors ccsds-loader.js structure)

```js
let _modulePromise = null;

export async function loadJP2Module(wasmUrl) {
    if (!_modulePromise) {
        const { default: createJP2Module } = await import('./jpeg2000/jpeg2000.js');
        const opts = {};
        if (wasmUrl) {
            opts.locateFile = (filename) =>
                filename.endsWith('.wasm') ? wasmUrl.toString() : filename;
        }
        _modulePromise = createJP2Module(opts);
    }
    return _modulePromise;
}

export async function jp2DecodeBuffer(compressed) {
    const mod = await loadJP2Module();
    const inLen = compressed.length;
    const inPtr = mod._malloc(inLen);
    if (!inPtr) throw new Error('JP2: malloc failed for input');

    const outCountPtr = mod._malloc(4);
    if (!outCountPtr) { mod._free(inPtr); throw new Error('JP2: malloc failed for count'); }

    try {
        mod.HEAPU8.set(compressed, inPtr);
        const outPtr = mod._jp2_decode(inPtr, inLen, outCountPtr);
        const count  = new Int32Array(mod.HEAPU8.buffer, outCountPtr, 1)[0];

        if (!outPtr || count <= 0) throw new Error('JP2: decode returned no samples');

        const result = new Int32Array(mod.HEAPU8.buffer, outPtr, count).slice();
        mod._jp2_free(outPtr);
        return result;
    } finally {
        mod._free(inPtr);
        mod._free(outCountPtr);
    }
}
```

- [ ] **Write `src/templates/drt-jpeg2000.js`**

```js
import { f32be, sm16, u8 } from '../byte-helpers.js';
import { MISSING_VALUE } from '../byte-helpers.js';
import { jp2DecodeBuffer } from '../wasm/jpeg2000-loader.js';

export function parseParams(data, t) {
    if (t + 10 > data.length) return {};
    return {
        referenceValue:     f32be(data, t),
        binaryScaleFactor:  sm16(data, t + 4),
        decimalScaleFactor: sm16(data, t + 6),
        bitsPerValue:       u8(data, t + 8),
    };
}

export async function decode(data, dataStart, dataLen, s5, totalPoints, bitmap) {
    const values = new Float64Array(totalPoints).fill(MISSING_VALUE);

    if (s5.bitsPerValue === 0) {
        for (let i = 0; i < totalPoints; i++)
            if (!bitmap || bitmap[i] !== 0) values[i] = s5.referenceValue;
        return values;
    }

    const compressed = data.slice(dataStart, dataStart + dataLen);
    const decoded    = await jp2DecodeBuffer(compressed);
    const R          = s5.referenceValue;
    const bScale     = Math.pow(2, s5.binaryScaleFactor);
    const dScale     = Math.pow(10, -s5.decimalScaleFactor);

    let valIdx = 0;
    for (let i = 0; i < totalPoints; i++) {
        if (bitmap && bitmap[i] === 0) continue;
        if (valIdx >= decoded.length) break;
        values[i] = (R + decoded[valIdx] * bScale) * dScale;
        valIdx++;
    }
    return values;
}
```

- [ ] **Write `test/drt-jpeg2000.test.js` — constant field test (no WASM needed)**

```js
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const MISSING_VALUE = -1e100;

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
```

- [ ] **Register DRT 40 in registry.js**

```js
import * as drtJpeg2000 from './drt-jpeg2000.js';
// add to TEMPLATES:
40: drtJpeg2000,
```

- [ ] **Update `rolldown.config.js` to handle jpeg2000 assets**

Three changes needed:

```js
// 1. external: also mark jpeg2000.js as external so rolldown keeps the dynamic import
external: (id) => id.endsWith('ccsds.js') || id.endsWith('jpeg2000.js'),

// 2. renderChunk: patch both paths; drop the throw (jpeg2000 may not appear if
//    DRT 40 is unused, ccsds path must always be present)
renderChunk(code, chunk) {
    if (chunk.fileName !== 'grib2-decoder.js') return null;
    let patched = code.replaceAll('./wasm/ccsds.js', './ccsds.js');
    if (patched === code)
        throw new Error('renderChunk: ./wasm/ccsds.js not found — check Rolldown path rewriting');
    patched = patched.replaceAll('./wasm/jpeg2000/jpeg2000.js', './jpeg2000.js');
    return patched;
},

// 3. generateBundle: copy jpeg2000 files alongside ccsds files
generateBundle() {
    const assets = [
        ['ccsds.js',       'src/wasm/ccsds.js'],
        ['ccsds.wasm',     'src/wasm/ccsds.wasm'],
        ['jpeg2000.js',    'src/wasm/jpeg2000/jpeg2000.js'],
        ['jpeg2000.wasm',  'src/wasm/jpeg2000/jpeg2000.wasm'],
    ];
    for (const [fileName, srcPath] of assets) {
        let source;
        try {
            source = readFileSync(new URL(srcPath, import.meta.url));
        } catch {
            if (fileName.startsWith('ccsds'))
                throw new Error(`copy-wasm-assets: could not read ${srcPath}`);
            continue; // jpeg2000 artifact is optional until Task 9 is complete
        }
        this.emitFile({ type: 'asset', fileName, source });
    }
},
```

- [ ] **Run drt-jpeg2000.test.js (constant field only)**

```bash
cd packages/grib2-decoder && node --test test/drt-jpeg2000.test.js
```
Expected: 1 passing (constant field test does not invoke WASM).

- [ ] **Run full test suite**

```bash
cd packages/grib2-decoder && npm test
```
Expected: all existing tests + new tests passing.

- [ ] **Commit**

```bash
git add packages/grib2-decoder/src/wasm/jpeg2000-loader.js \
        packages/grib2-decoder/src/templates/drt-jpeg2000.js \
        packages/grib2-decoder/test/drt-jpeg2000.test.js \
        packages/grib2-decoder/src/templates/registry.js \
        packages/grib2-decoder/rolldown.config.js
git commit -m "feat: implement DRT 40 (JPEG 2000) decoder via OpenJPEG WASM"
```

---

## Task 11: End-to-end test with a real ICON-D2 file (DRT 3)

**Files:**
- Modify: `test/e2e.test.js` (or add a new `test/icon-d2.test.js` if preferred)

- [ ] **Download a small ICON-D2 GRIB2 file from DWD open data**

DWD provides open-data ICON-D2 GRIB2 files. Download one variable (e.g. temperature at 2m):

```bash
# DWD open-data URL pattern (adjust date/hour/step):
ICON_URL="https://opendata.dwd.de/weather/nwp/icon-d2/grib/00/t_2m/icon-d2_germany_regular-lat-lon_single-level_2026050500_000_T_2M.grib2.bz2"
cd packages/grib2-decoder/test
curl -L "$ICON_URL" | bunzip2 > icon_d2_t2m.grib2
```

If download fails, ask the user to provide an ICON-D2 GRIB2 file and place it at
`packages/grib2-decoder/test/icon_d2_t2m.grib2`.

Verify it uses DRT 3:
```bash
grib_ls -n data packages/grib2-decoder/test/icon_d2_t2m.grib2 | grep dataRepresentationTemplateNumber
```
Expected: `dataRepresentationTemplateNumber = 3`

- [ ] **Write the E2E test**

Add to `test/e2e.test.js` (or new file):

```js
import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { decodeGRIB2, iterateGRIB2Messages } from '../src/index.js';

const ICON_FILE = new URL('../test/icon_d2_t2m.grib2', import.meta.url);

describe('DRT 3 — ICON-D2 real file', { skip: !existsSync(ICON_FILE) }, () => {
    let result;

    before(async () => {
        const buf  = readFileSync(ICON_FILE);
        const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
        // Take just the first message
        for (const msg of iterateGRIB2Messages(data)) {
            result = await decodeGRIB2(msg.buffer);
            break;
        }
    });

    it('decodes without error', () => assert.ok(result));
    it('values array has expected length', () =>
        assert.ok(result.values.length === result.grid.totalPoints));
    it('values are physically plausible for temperature (200K–330K)', () => {
        const valid = [...result.values].filter(v => v > -1e99);
        assert.ok(valid.every(v => v > 200 && v < 330),
            `Out-of-range value found: ${valid.find(v => v <= 200 || v >= 330)}`);
    });
});
```

- [ ] **Cross-validate one message against eccodes** (requires `eccodes` installed)

```bash
# Get the first 10 values via eccodes
grib_get_double_array -p values packages/grib2-decoder/test/icon_d2_t2m.grib2 \
  | head -1 | tr ',' '\n' | head -10

# Then compare with the JS decoder output (add a small assertion script):
node -e "
import { readFileSync } from 'fs';
import { decodeGRIB2, iterateGRIB2Messages } from './src/index.js';
const buf = readFileSync('test/icon_d2_t2m.grib2');
const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
for (const msg of iterateGRIB2Messages(data)) {
    decodeGRIB2(msg.buffer).then(r => {
        const valid = [...r.values].filter(v => v > -1e99).slice(0, 10);
        console.log(valid.join(', '));
    });
    break;
}
" 2>/dev/null
```

- [ ] **Run the test**

```bash
cd packages/grib2-decoder && npm test
```
Expected: all passing, DRT 3 test green (or skipped if file absent).

- [ ] **Add icon_d2_t2m.grib2 to .gitignore if large** (> 1 MB)

```bash
echo "test/icon_d2_t2m.grib2" >> packages/grib2-decoder/.gitignore
```

Or commit a small extracted single-message fixture if it's < 500 KB:

```bash
# Extract just the first message (requires grib_copy):
grib_copy -w count=1 test/icon_d2_t2m.grib2 test/fixtures/icon_d2_t2m_msg1.grib2
```

- [ ] **Commit**

```bash
git add packages/grib2-decoder/test/
git commit -m "test: add ICON-D2 (DRT 3) end-to-end test"
```

---

## Task 12: End-to-end test with a real GFS file (DRT 40)

**Files:**
- Modify: `test/e2e.test.js` (or new `test/gfs.test.js`)

- [ ] **Download a GFS GRIB2 file**

```bash
# NOAA GFS open data (adjust date/cycle/step):
GFS_URL="https://nomads.ncep.noaa.gov/pub/data/nccf/com/gfs/prod/gfs.20260505/00/atmos/gfs.t00z.pgrb2.0p25.f000"
cd packages/grib2-decoder/test
curl -L --range 0-200000 "$GFS_URL" -o gfs_sample.grib2
```

If the download fails or the file has no DRT 40 messages, ask the user to provide a GFS GRIB2
file with JPEG 2000 encoding (DRT 40). Verify:
```bash
grib_ls -n data packages/grib2-decoder/test/gfs_sample.grib2 | grep dataRepresentationTemplateNumber
```

- [ ] **Write the GFS E2E test** (same structure as ICON-D2 test above)

```js
const GFS_FILE = new URL('../test/gfs_sample.grib2', import.meta.url);

describe('DRT 40 — GFS real file', { skip: !existsSync(GFS_FILE) }, () => {
    let result;

    before(async () => {
        const buf  = readFileSync(GFS_FILE);
        const data = new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
        for (const msg of iterateGRIB2Messages(data)) {
            if (msg.header.templateNumber === 40 || true) {
                result = await decodeGRIB2(msg.buffer);
                break;
            }
        }
    });

    it('decodes without error', () => assert.ok(result));
    it('values array has expected length', () =>
        assert.ok(result.values.length === result.grid.totalPoints));
});
```

- [ ] **Run tests**

```bash
cd packages/grib2-decoder && npm test
```
Expected: all passing.

- [ ] **Commit**

```bash
git add packages/grib2-decoder/test/
git commit -m "test: add GFS (DRT 40 JPEG 2000) end-to-end test"
```

---

## Task 13: Build verification

- [ ] **Run the full build**

```bash
cd packages/grib2-decoder && npm run build
```
Expected: no errors. Check that dist/ contains `grib2-decoder.js`, `ccsds.js`, `ccsds.wasm`,
`jpeg2000.js`, `jpeg2000.wasm`.

```bash
ls -lh packages/grib2-decoder/dist/
```

- [ ] **Verify the built bundle loads correctly in Node**

```bash
node --input-type=module <<'EOF'
import { decodeGRIB2, iterateGRIB2Messages } from './packages/grib2-decoder/dist/grib2-decoder.js';
console.log('Import OK');
EOF
```
Expected: `Import OK`.

- [ ] **Run the test suite one final time using the source**

```bash
cd packages/grib2-decoder && npm test
```
Expected: all tests passing.

- [ ] **Final commit**

```bash
git add packages/grib2-decoder/dist/
git commit -m "build: rebuild dist with DRT 2/3/40 support"
```
