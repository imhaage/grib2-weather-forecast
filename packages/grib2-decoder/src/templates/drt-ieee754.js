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
