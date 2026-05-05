import { MISSING_VALUE } from '../byte-helpers.js';

export function parseParams(_data, _t) {
    return {};
}

export async function decode(_data, _dataStart, _dataLen, _s5, totalPoints, _bitmap) {
    return new Float64Array(totalPoints).fill(MISSING_VALUE);
}
