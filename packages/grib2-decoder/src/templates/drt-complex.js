import { f32be, sm16, u8, u32, readBits, MISSING_VALUE } from '../byte-helpers.js';

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
    // WMO FM-92 requires byte-boundary padding between each array.
    const gref = new Int32Array(NG);
    for (let g = 0; g < NG; g++) gref[g] = readBits(data, bitPos, bpv);
    bitPos[0] = (bitPos[0] + 7) & ~7; // pad to next octet boundary

    // ── Group widths ───────────────────────────────────────────────────────────
    const gwidth = new Uint8Array(NG);
    for (let g = 0; g < NG; g++)
        gwidth[g] = Wref + (nBitsW > 0 ? readBits(data, bitPos, nBitsW) : 0);
    bitPos[0] = (bitPos[0] + 7) & ~7;

    // ── Group lengths ──────────────────────────────────────────────────────────
    const glen = new Int32Array(NG);
    for (let g = 0; g < NG; g++)
        glen[g] = Lref + (nBitsL > 0 ? readBits(data, bitPos, nBitsL) : 0) * deltaL;
    if (NG > 0) glen[NG - 1] = lastGroupLength;
    bitPos[0] = (bitPos[0] + 7) & ~7;

    // ── Unpack values and detect missing ──────────────────────────────────────
    const N = s5.numberOfPackedValues;
    const ifld     = new Int32Array(N);
    const ifldmiss = new Uint8Array(N);   // 0=valid 1=primary missing 2=secondary missing
    let n = 0;
    // Sentinel for W=0 constant groups with missing value management:
    // use the bpv-level max (same as ecCodes DataG22OrderPacking.cc)
    const bpvMsng1 = (1 << bpv) - 1;
    const bpvMsng2 = bpvMsng1 - 1;

    for (let g = 0; g < NG; g++) {
        const W = gwidth[g];
        const L = glen[g];

        for (let k = 0; k < L && n < N; k++, n++) {
            if (W === 0) {
                // Constant group: value is gref[g]; missing sentinel is at bpv level
                if (missVal >= 1 && gref[g] === bpvMsng1) {
                    ifldmiss[n] = 1;
                } else if (missVal === 2 && gref[g] === bpvMsng2) {
                    ifldmiss[n] = 2;
                } else {
                    ifld[n] = gref[g];
                }
            } else {
                const raw = readBits(data, bitPos, W);
                const msng1 = (1 << W) - 1;
                if (missVal >= 1 && raw === msng1) {
                    ifldmiss[n] = 1;
                } else if (missVal === 2 && raw === msng1 - 1) {
                    ifldmiss[n] = 2;
                } else {
                    ifld[n] = raw + gref[g];
                }
            }
        }
    }

    // ── Spatial differencing (DRT 3 only) ─────────────────────────────────────
    if (templateNumber === 3 && ww > 0) {
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
        valIdx++;
    }

    return values;
}
