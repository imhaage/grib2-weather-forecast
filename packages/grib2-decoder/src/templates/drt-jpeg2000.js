import { f32be, sm16, u8, MISSING_VALUE } from '../byte-helpers.js';
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
