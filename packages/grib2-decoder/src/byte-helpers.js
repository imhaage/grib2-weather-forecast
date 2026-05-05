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
