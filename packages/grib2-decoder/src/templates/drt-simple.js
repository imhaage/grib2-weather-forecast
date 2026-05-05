import { f32be, sm16, u8, readBits, MISSING_VALUE } from '../byte-helpers.js';

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
