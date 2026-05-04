/**
 * Grid statistics helpers — browser and Node.js compatible.
 */

import { MISSING_VALUE } from './decoder.js';

/**
 * Compute statistics over a decoded values array.
 *
 * @param {Float64Array} values - Physical values as returned by decodeGRIB2().
 *   Missing grid points are encoded as MISSING_VALUE (-1e100).
 * @returns {{ min: number, max: number, mean: number, stddev: number, count: number }}
 */
export function computeStats(values) {
    let min = Infinity, max = -Infinity, sum = 0, sum2 = 0, count = 0;
    for (const v of values) {
        if (v > MISSING_VALUE) {
            if (v < min) min = v;
            if (v > max) max = v;
            sum  += v;
            sum2 += v * v;
            count++;
        }
    }
    const mean   = count ? sum / count : NaN;
    const stddev = count ? Math.sqrt(sum2 / count - mean * mean) : NaN;
    return { min, max, mean, stddev, count };
}
