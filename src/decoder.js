/**
 * GRIB2 Decoder — browser-compatible pure JavaScript implementation.
 *
 * Based on the WMO FM-92 GRIB Edition 2 specification and the eccodes C source.
 *
 * Supported data representation templates:
 *   0   – Simple packing
 *   40  – Constant field (all values equal)
 *   42  – CCSDS lossless compression (Golomb-Rice via libaec WASM)
 *   254 – Grid IEEE 754 (32-bit floats, big-endian)
 *   255 – All values missing
 *
 * GRIB2 message structure (per WMO FM-92):
 *   Section 0  (16 bytes) : "GRIB" + reserved + discipline + edition + 8-byte length
 *   Section 1  (variable) : Identification (centre, time, discipline …)
 *   Section 2  (optional) : Local Use
 *   Section 3  (variable) : Grid Definition Template
 *   Section 4  (variable) : Product Definition Template
 *   Section 5  (variable) : Data Representation Template (packing parameters)
 *   Section 6  (variable) : Bitmap (1 bit per grid point, or absent)
 *   Section 7  (variable) : Packed / compressed data values
 *   Section 8  (4 bytes)  : "7777" end marker
 *
 * Each section 1–7 header:
 *   [0-3] 4 bytes — total section length in octets (including this header)
 *   [4]   1 byte  — section number (1–7)
 *   [5…]          — section-specific content
 */

import { ccsdsDecodeBuffer, AEC_FLAGS_LE } from './wasm/ccsds-loader.js';
import { lookupParameter } from './parameters.js';

/** Sentinel written into the values array for missing / bitmap-masked grid points. */
export const MISSING_VALUE = -1e100;

// ─── Byte helpers ─────────────────────────────────────────────────────────────

const u8  = (d, i) => d[i];
const u16 = (d, i) => (d[i] << 8) | d[i + 1];
const u32 = (d, i) => (((d[i] << 24) | (d[i + 1] << 16) | (d[i + 2] << 8) | d[i + 3]) >>> 0);
const i32 = (d, i) => { const v = u32(d, i); return v >= 0x80000000 ? v - 0x100000000 : v; };
// Signed 16-bit using "sign-magnitude" encoding (GRIB2 scale factors):
// bit 15 = sign, bits 14-0 = magnitude.
const sm16 = (d, i) => {
    const raw = u16(d, i);
    return (raw & 0x8000) ? -(raw & 0x7FFF) : raw;
};
// IEEE 754 single-precision big-endian
const f32be = (d, i) => new DataView(d.buffer, d.byteOffset + i, 4).getFloat32(0, false);

// ─── Section walker ───────────────────────────────────────────────────────────

/**
 * Parse Section 0 and walk Sections 1–7, returning their byte boundaries.
 *
 * Section 0 layout (16 bytes):
 *   [0-3]  = "GRIB"
 *   [4-5]  = Reserved (ignore; Météo-France writes 0xFF 0xFF)
 *   [6]    = Discipline
 *   [7]    = Edition (must be 2)
 *   [8-15] = Total message length (8 bytes big-endian)
 *
 * Section 1–7 header (5 bytes):
 *   [0-3]  = Total section length (4 bytes big-endian)
 *   [4]    = Section number
 */
function walkSections(data) {
    if (data.length < 16) throw new Error('Buffer too short for GRIB2 Section 0');

    const sig = String.fromCharCode(data[0], data[1], data[2], data[3]);
    if (sig !== 'GRIB') throw new Error('Invalid GRIB signature');

    // Edition is at byte 7 (bytes 4-5 are reserved, byte 6 is discipline)
    const edition = data[7];
    if (edition !== 2) throw new Error(`Expected GRIB edition 2, got ${edition}`);

    const discipline = data[6];

    // Message length: 8-byte big-endian at bytes 8-15.
    // JavaScript can safely handle files up to 2^53 bytes; use the lower 32 bits
    // for sizes that fit (upper 32 bits should be 0 for files < 4 GB).
    const msgLenHi = u32(data, 8);
    const msgLenLo = u32(data, 12);
    const messageLength = msgLenHi * 0x100000000 + msgLenLo;

    // Walk sections starting after Section 0
    const sections = {};
    let offset = 16;

    while (offset + 5 <= data.length) {
        const secLen = u32(data, offset);
        const secNum = data[offset + 4];

        if (secLen < 5) throw new Error(`Invalid section length ${secLen} at offset ${offset}`);

        // dataStart: byte after the 5-byte header
        sections[secNum] = {
            number:    secNum,
            offset,
            secLen,
            dataStart: offset + 5,
        };

        if (secNum === 7) break;
        offset += secLen;
    }

    return { edition, discipline, messageLength, sections };
}

// ─── Section 1: Identification ────────────────────────────────────────────────

/**
 * Parse Section 1 (Identification Section).
 *
 * Data layout (0-indexed from dataStart, i.e. after the 5-byte section header):
 *   [0-1]  Centre (Uint16 BE) — WMO code table 0.1 (85 = Météo-France)
 *   [2-3]  Sub-centre (Uint16 BE)
 *   [4]    Master tables version number
 *   [5]    Local tables version number
 *   [6]    Significance of reference time (code table 1.2)
 *   [7-8]  Year (Uint16 BE)
 *   [9]    Month
 *   [10]   Day
 *   [11]   Hour
 *   [12]   Minute
 *   [13]   Second
 *   [14]   Production status (code table 1.3)
 *   [15]   Type of processed data (code table 1.4)
 */
function parseSection1(data, dataStart) {
    if (dataStart + 16 > data.length) return {};
    const d = dataStart;
    return {
        centre:                u16(data, d),
        subCentre:             u16(data, d + 2),
        masterTablesVersion:   u8(data, d + 4),
        localTablesVersion:    u8(data, d + 5),
        referenceTimeSignificance: u8(data, d + 6),
        year:                  u16(data, d + 7),
        month:                 u8(data, d + 9),
        day:                   u8(data, d + 10),
        hour:                  u8(data, d + 11),
        minute:                u8(data, d + 12),
        second:                u8(data, d + 13),
        productionStatus:      u8(data, d + 14),
        typeOfData:            u8(data, d + 15),
    };
}

// ─── Section 3: Grid Definition ───────────────────────────────────────────────

/**
 * Parse Section 3, Template 3.0 (Latitude/Longitude grid).
 *
 * Generic Section 3 header (9 bytes from dataStart):
 *   [0]    Source of grid definition (0 = WMO table 3.0)
 *   [1-4]  Number of data points (Ni × Nj, Uint32 BE)
 *   [5]    Number of octets for optional list
 *   [6]    Interpretation of optional list
 *   [7-8]  Grid Definition Template Number (Uint16 BE)
 *
 * Template 3.0 data (from dataStart + 9):
 *   [0]    Shape of Earth (code table 3.2)
 *   [1]    Scale factor of radius of spherical Earth
 *   [2-5]  Scaled value of radius
 *   [6]    Scale factor of Earth major axis
 *   [7-10] Scaled value of major axis
 *   [11]   Scale factor of Earth minor axis
 *   [12-15]Scaled value of minor axis
 *   [16-19] Ni (Uint32 BE)
 *   [20-23] Nj (Uint32 BE)
 *   [24-27] Basic angle (Uint32 BE; 0 → unit = 10^-6 degrees)
 *   [28-31] Subdivisions of basic angle
 *   [32-35] La1: latitude of first point (Int32 BE, 10^-6 degrees)
 *   [36-39] Lo1: longitude of first point (Int32 BE, 10^-6 degrees, 0..360×10^6)
 *   [40]    Resolution and component flags
 *   [41-44] La2: latitude of last point (Int32 BE)
 *   [45-48] Lo2: longitude of last point (Int32 BE)
 *   [49-52] Di: i-direction increment (Uint32 BE, 10^-6 degrees)
 *   [53-56] Dj: j-direction increment (Uint32 BE, 10^-6 degrees)
 *   [57]    Scanning mode flags
 */
function parseSection3(data, dataStart) {
    const result = {
        templateNumber: 0,
        totalPoints: 0,
        ni: 0, nj: 0,
        latitudeOfFirstPoint: 0, longitudeOfFirstPoint: 0,
        latitudeOfLastPoint: 0,  longitudeOfLastPoint: 0,
        di: 0, dj: 0,
        scanningMode: 0,
    };

    const d = dataStart;
    if (d + 9 > data.length) return result;

    result.templateNumber = u16(data, d + 7);
    result.totalPoints    = u32(data, d + 1);

    if (result.templateNumber !== 0) {
        // Only Template 3.0 (regular lat/lon) is fully parsed here
        return result;
    }

    const t = d + 9; // template-specific data start
    if (t + 58 > data.length) return result;

    result.ni = u32(data, t + 16);
    result.nj = u32(data, t + 20);
    if (result.totalPoints === 0) result.totalPoints = result.ni * result.nj;

    // Longitude range in GRIB2 is [0, 360×10^6]; convert to [-180, 180] for convenience
    const lo1raw = i32(data, t + 36);
    const lo2raw = i32(data, t + 45);

    result.latitudeOfFirstPoint  = i32(data, t + 32) / 1e6;
    result.longitudeOfFirstPoint = lo1raw > 180e6 ? (lo1raw - 360e6) / 1e6 : lo1raw / 1e6;
    result.latitudeOfLastPoint   = i32(data, t + 41) / 1e6;
    result.longitudeOfLastPoint  = lo2raw > 180e6 ? (lo2raw - 360e6) / 1e6 : lo2raw / 1e6;
    result.di                    = u32(data, t + 49) / 1e6;
    result.dj                    = u32(data, t + 53) / 1e6;
    result.scanningMode          = u8(data, t + 57);

    return result;
}

// ─── Section 4: Product Definition ───────────────────────────────────────────

/**
 * Parse Section 4 (Product Definition Section).
 *
 * Generic Section 4 header (4 bytes from dataStart):
 *   [0-1]  Number of coordinate values after template (Uint16 BE)
 *   [2-3]  Product Definition Template Number (Uint16 BE) — code table 4.0
 *
 * Template 4.0 and 4.8 share the same first 19 octets of template data
 * (starting at dataStart + 4):
 *   [0]    parameterCategory
 *   [1]    parameterNumber
 *   [2]    typeOfGeneratingProcess
 *   [3]    backgroundGeneratingProcessIdentifier
 *   [4]    analysisOrForecastGeneratingProcessIdentifier
 *   [5-6]  hoursAfterDataCutoff (Uint16 BE)
 *   [7]    minutesAfterDataCutoff
 *   [8]    indicatorOfUnitOfTimeRange (code table 4.4)
 *   [9-12] forecastTime (Uint32 BE; units per byte [8])
 *   [13]   typeOfFirstFixedSurface (code table 4.5)
 *   [14]   scaleFactorOfFirstFixedSurface
 *   [15-18] scaledValueOfFirstFixedSurface (Uint32 BE)
 *
 * @param {Uint8Array} data
 * @param {number} dataStart - byte offset of the first post-header byte
 * @param {number} discipline - discipline byte from Section 0
 * @returns {{
 *   pdtNumber:               number,
 *   parameterCategory:       number,
 *   parameterNumber:         number,
 *   typeOfGeneratingProcess: number,
 *   timeUnit:                number,
 *   forecastTime:            number,
 *   typeOfFirstFixedSurface: number,
 *   levelScaleFactor:        number,
 *   levelScaledValue:        number,
 *   levelValue:              number,
 *   name:                    string,
 *   shortName:               string,
 *   units:                   string,
 * }}
 */
export function parseSection4(data, dataStart, discipline) {
    const result = {
        pdtNumber:               0,
        parameterCategory:       255,
        parameterNumber:         255,
        typeOfGeneratingProcess: 255,
        timeUnit:                255,
        forecastTime:            0,
        typeOfFirstFixedSurface: 255,
        levelScaleFactor:        0,
        levelScaledValue:        0,
        levelValue:              0,
        name:                    'Unknown',
        shortName:               'unknown',
        units:                   'unknown',
    };

    if (dataStart + 4 > data.length) return result;

    const d = dataStart;
    result.pdtNumber = u16(data, d + 2);

    // Template data starts at d + 4 (after numCoordValues and pdtNumber)
    const t = d + 4;
    if (t + 19 > data.length) return result;

    result.parameterCategory       = u8(data, t);
    result.parameterNumber         = u8(data, t + 1);
    result.typeOfGeneratingProcess = u8(data, t + 2);
    result.timeUnit                = u8(data, t + 8);
    result.forecastTime            = u32(data, t + 9);
    result.typeOfFirstFixedSurface = u8(data, t + 13);
    result.levelScaleFactor        = u8(data, t + 14);
    result.levelScaledValue        = u32(data, t + 15);

    // Compute physical level value: scaledValue × 10^(-scaleFactor)
    // 0xFF (255) means "not applicable" per WMO — treat as 0
    result.levelValue = (result.levelScaleFactor === 0 || result.levelScaleFactor === 255)
        ? result.levelScaledValue
        : result.levelScaledValue * Math.pow(10, -result.levelScaleFactor);

    const param      = lookupParameter(discipline, result.parameterCategory, result.parameterNumber);
    result.name      = param.name;
    result.shortName = param.shortName;
    result.units     = param.units;

    return result;
}

// ─── Section 5: Data Representation ──────────────────────────────────────────

/**
 * Parse Section 5.
 *
 * Generic header (6 bytes from dataStart):
 *   [0-3]  Number of packed values (Uint32 BE)
 *   [4-5]  Data Representation Template Number (Uint16 BE)
 *
 * Template 5.0 — Simple Packing (from dataStart + 6):
 *   [0-3]  Reference value R (IEEE 754 float32 big-endian)
 *   [4-5]  Binary scale factor E  (sign-magnitude Int16 BE)
 *   [6-7]  Decimal scale factor D (sign-magnitude Int16 BE)
 *   [8]    Number of bits per value
 *   [9]    Type of original field values
 *
 * Template 5.40 — JPEG 2000 (not implemented)
 *
 * Template 5.42 — CCSDS lossless compression (from dataStart + 6):
 *   [0-3]  Reference value R (IEEE 754 float32 big-endian)
 *   [4-5]  Binary scale factor E  (sign-magnitude Int16 BE)
 *   [6-7]  Decimal scale factor D (sign-magnitude Int16 BE)
 *   [8]    Number of bits per value
 *   [9]    Type of original field values
 *   [10]   CCSDS compression options mask (= LibAEC flags bitmask)
 *   [11]   CCSDS block size
 *   [12-13]CCSDS Reference Sample Interval (Uint16 BE)
 */
function parseSection5(data, dataStart) {
    const result = {
        templateNumber:      0,
        numberOfPackedValues: 0,
        referenceValue:      0,
        binaryScaleFactor:   0,
        decimalScaleFactor:  0,
        bitsPerValue:        8,
        // CCSDS-specific
        ccsdsFlags:     AEC_FLAGS_LE,
        ccsdsBlockSize: 32,
        ccsdsRsi:       128,
    };

    const d = dataStart;
    if (d + 6 > data.length) return result;

    result.numberOfPackedValues = u32(data, d);
    result.templateNumber       = u16(data, d + 4);

    const t = d + 6; // template-specific data

    if (result.templateNumber === 0 || result.templateNumber === 42) {
        if (t + 10 > data.length) return result;
        result.referenceValue    = f32be(data, t);
        result.binaryScaleFactor = sm16(data, t + 4);
        result.decimalScaleFactor= sm16(data, t + 6);
        result.bitsPerValue      = u8(data, t + 8);
    }

    if (result.templateNumber === 42) {
        // CCSDS-specific parameters
        if (t + 14 <= data.length) {
            // Raw ccsdsFlags from template = LibAEC bitmask, but we must
            // strip AEC_DATA_3BYTE (0x02) and AEC_DATA_MSB (0x04) for
            // little-endian JS/WASM environment (mirrors eccodes modify_aec_flags).
            const rawFlags       = u8(data, t + 10);
            result.ccsdsFlags    = rawFlags & ~0x06; // strip 3BYTE and MSB
            result.ccsdsBlockSize= u8(data, t + 11);
            result.ccsdsRsi      = u16(data, t + 12);
        }
    } else if (result.templateNumber === 40) {
        // Constant field (Template 5.0): only a reference value, no scale factors
        if (t + 4 <= data.length) {
            result.referenceValue = f32be(data, t);
        }
        result.bitsPerValue = 0;
    } else if (result.templateNumber === 254) {
        // IEEE 754 32-bit float grid (no scaling needed)
        if (t + 5 <= data.length) result.bitsPerValue = u8(data, t + 4);
    }

    return result;
}

// ─── Section 6: Bitmap ────────────────────────────────────────────────────────

/**
 * Parse Section 6 (Bitmap Section).
 *
 * Data layout (from dataStart):
 *   [0]   Bitmap indicator (code table 6.0)
 *           255 = no bitmap (all values present)
 *           0   = bitmap present
 *   [1…]  Bitmap bytes (one bit per grid point, MSB first)
 */
function parseSection6(data, dataStart, totalPoints) {
    if (dataStart >= data.length) return { hasBitmap: false, bitmap: null };

    const indicator = u8(data, dataStart);
    if (indicator === 255) return { hasBitmap: false, bitmap: null };

    // Bitmap present: one bit per grid point
    const bitmap = new Uint8Array(totalPoints);
    for (let i = 0; i < totalPoints; i++) {
        const byteIdx = dataStart + 1 + (i >>> 3);
        const bitIdx  = 7 - (i & 7);
        if (byteIdx < data.length) {
            bitmap[i] = (data[byteIdx] >> bitIdx) & 1;
        }
    }
    return { hasBitmap: true, bitmap };
}

// ─── Simple packing bitstream reader ─────────────────────────────────────────

function readBits(data, bitPos, nBits) {
    let value = 0;
    for (let i = 0; i < nBits; i++) {
        const byteIdx = bitPos[0] >>> 3;
        const bitIdx  = 7 - (bitPos[0] & 7);
        value = (value << 1) | ((data[byteIdx] >> bitIdx) & 1);
        bitPos[0]++;
    }
    return value >>> 0;
}

// ─── Sections helper ─────────────────────────────────────────────────────────

const MISSING_PRODUCT = {
    shortName: 'unknown', name: 'Unknown', units: 'unknown',
    pdtNumber: 255, parameterCategory: 255, parameterNumber: 255,
};

/**
 * Parse Sections 1, 3 and 4 from an already-walked GRIB2 message.
 * Centralises the repeated ternary pattern used by decodeGRIB2,
 * parseGRIB2Header and iterateGRIB2Messages.
 */
function parseHeaderSections(data, walked) {
    const { sections: secs, discipline } = walked;
    return {
        s1: secs[1] ? parseSection1(data, secs[1].dataStart) : {},
        s3: secs[3] ? parseSection3(data, secs[3].dataStart) : {},
        s4: secs[4] ? parseSection4(data, secs[4].dataStart, discipline) : { ...MISSING_PRODUCT },
    };
}

// ─── Main decode function ─────────────────────────────────────────────────────

/**
 * Decode a GRIB2 message.
 *
 * @param {ArrayBuffer|Buffer} buffer - Raw GRIB2 message bytes
 * @returns {Promise<{ header, product, grid, values, bitmap }>}
 *   header  : parsed Section 1 fields
 *   product : parsed Section 4 fields (parameterCategory, parameterNumber,
 *             name, shortName, units, levelValue, forecastTime…)
 *   grid    : parsed Section 3 fields (Ni, Nj, lat/lon bounds, …)
 *   values  : Float64Array of physical values (length = totalPoints,
 *             missing values = -1e100)
 *   bitmap  : Uint8Array | null (1 = valid value, 0 = missing)
 */
export async function decodeGRIB2(buffer) {
    const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

    // 1. Walk sections
    const walked       = walkSections(data);
    const secs         = walked.sections;
    const { s1, s3, s4 } = parseHeaderSections(data, walked);

    // 4. Section 5 — data representation
    if (!secs[5]) throw new Error('Section 5 (Data Representation) not found');
    const s5 = parseSection5(data, secs[5].dataStart);

    // 5. Total grid points
    const totalPoints = s3.totalPoints || s5.numberOfPackedValues;

    // 6. Section 6 — bitmap
    const s6 = secs[6]
        ? parseSection6(data, secs[6].dataStart, totalPoints)
        : { hasBitmap: false, bitmap: null };

    // Output arrays
    const values = new Float64Array(totalPoints).fill(MISSING_VALUE);
    const bitmap = s6.bitmap;

    // Section 7 data boundaries
    if (!secs[7]) throw new Error('Section 7 (Data) not found');
    const dataStart = secs[7].dataStart;
    const dataLen   = secs[7].secLen - 5;

    // 7. Decode values
    const tmpl = s5.templateNumber;

    if (s5.bitsPerValue === 0 || tmpl === 40) {
        // Constant field — respect bitmap: only fill non-missing grid points
        for (let i = 0; i < totalPoints; i++) {
            if (!bitmap || bitmap[i] !== 0) values[i] = s5.referenceValue;
        }

    } else if (tmpl === 0) {
        // Simple packing: Y(i) = (R + X(i) × 2^E) × 10^(-D)
        const bpv    = s5.bitsPerValue;
        const R      = s5.referenceValue;
        const bScale = Math.pow(2, s5.binaryScaleFactor);
        const dScale = Math.pow(10, -s5.decimalScaleFactor);
        const bitPos = [dataStart * 8]; // bit offset from start of data buffer

        let valIdx = 0;
        for (let i = 0; i < totalPoints; i++) {
            if (bitmap && bitmap[i] === 0) continue;
            if (valIdx >= s5.numberOfPackedValues) break;
            const coded  = readBits(data, bitPos, bpv);
            values[i]    = (R + coded * bScale) * dScale;
            valIdx++;
        }

    } else if (tmpl === 42) {
        // CCSDS lossless compression
        const compressed = data.slice(dataStart, dataStart + dataLen);
        const decoded    = await ccsdsDecodeBuffer(
            compressed,
            s5.numberOfPackedValues,
            s5.bitsPerValue,
            s5.ccsdsBlockSize,
            s5.ccsdsRsi,
            s5.ccsdsFlags
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

    } else if (tmpl === 254) {
        // IEEE 754 float32 big-endian
        const view = new DataView(data.buffer);
        for (let i = 0; i < s5.numberOfPackedValues; i++) {
            const offset = dataStart + i * 4;
            if (offset + 4 <= data.length) {
                values[i] = view.getFloat32(offset, false);
            }
        }

    } else if (tmpl === 255) {
        // All values missing — already filled with -1e100

    } else {
        throw new Error(`Unsupported Data Representation Template: ${tmpl}`);
    }

    return {
        header:  { ...s1, discipline: walked.discipline, messageLength: walked.messageLength },
        product: s4,
        grid:    s3,
        values,
        bitmap,
    };
}

/**
 * Parse only Section 0/1/3/4 (fast path — no data decoding).
 *
 * @param {ArrayBuffer|Buffer} buffer
 * @returns {{ header, product, grid, dataOffset, dataLength, messageLength }}
 */
export function parseGRIB2Header(buffer) {
    const data           = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const walked         = walkSections(data);
    const { s1, s3, s4 } = parseHeaderSections(data, walked);
    const s7             = walked.sections[7];

    return {
        header:      { ...s1, discipline: walked.discipline, messageLength: walked.messageLength },
        product:     s4,
        grid:        s3,
        dataOffset:  s7 ? s7.dataStart : 0,
        dataLength:  s7 ? s7.secLen - 5 : 0,
    };
}

// ─── Multi-message iterator ───────────────────────────────────────────────────

/**
 * Iterate over all GRIB2 messages in a concatenated GRIB2 file.
 *
 * A GRIB2 file may contain multiple independent messages concatenated end-to-end.
 * Each message starts with the 4-byte "GRIB" signature and encodes its total
 * length as an 8-byte big-endian integer at bytes 8-15.
 *
 * This generator is synchronous and lightweight — it parses Section 0/1/3/4
 * headers only (no data decoding). Pass the yielded `buffer` to `decodeGRIB2()`
 * when you need the actual values for a specific message.
 *
 * @param {ArrayBuffer|Uint8Array} buffer - Raw bytes of the concatenated file
 * @yields {{
 *   index:   number,     - Zero-based message index
 *   buffer:  Uint8Array, - Self-contained copy of this message (byteOffset = 0)
 *   header:  object,     - Section 1 identification fields + discipline
 *   product: object,     - Section 4 product fields (shortName, name, units…)
 *   grid:    object,     - Section 3 grid definition fields
 * }}
 */
export function* iterateGRIB2Messages(buffer) {
    const data   = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    let offset   = 0;
    let index    = 0;

    while (offset + 16 <= data.length) {
        // Verify "GRIB" signature
        if (data[offset]     !== 0x47 || data[offset + 1] !== 0x52 ||
            data[offset + 2] !== 0x49 || data[offset + 3] !== 0x42) {
            break;
        }

        // 8-byte message length at bytes 8-15 (big-endian)
        const msgLenHi = u32(data, offset + 8);
        const msgLenLo = u32(data, offset + 12);
        const msgLen   = msgLenHi * 0x100000000 + msgLenLo;

        if (msgLen < 16 || offset + msgLen > data.length) break;

        // Use .slice() (not .subarray()) so byteOffset === 0 in the copy —
        // required by the tmpl === 254 DataView path in decodeGRIB2().
        const msgData = data.slice(offset, offset + msgLen);

        const walked         = walkSections(msgData);
        const { s1, s3, s4 } = parseHeaderSections(msgData, walked);

        yield {
            index,
            buffer:  msgData,
            header:  { ...s1, discipline: walked.discipline, messageLength: walked.messageLength },
            product: s4,
            grid:    s3,
        };

        offset += msgLen;
        index++;
    }
}

export { parseSection1, parseSection3, parseSection5, parseSection6, walkSections };
