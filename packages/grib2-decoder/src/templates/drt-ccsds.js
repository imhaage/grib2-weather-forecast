import { f32be, sm16, u8, u16, MISSING_VALUE } from '../byte-helpers.js';
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
