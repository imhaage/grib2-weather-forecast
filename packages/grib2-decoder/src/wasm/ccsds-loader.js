/**
 * ccsds-loader.js
 *
 * Lightweight wrapper around the Emscripten-compiled libaec WASM module.
 * Provides a single async function: ccsdsDecodeBuffer().
 *
 * AEC flag constants (from libaec.h):
 *   AEC_DATA_SIGNED     = 1   (samples are signed)
 *   AEC_DATA_3BYTE      = 2   (3-byte aligned samples)
 *   AEC_DATA_MSB        = 4   (MSB-first / big-endian samples)
 *   AEC_DATA_PREPROCESS = 8   (apply prediction preprocessor)
 */

// AEC flags that the eccodes encoder used when writing this file, adjusted for
// a little-endian decode environment (which is always the case for WASM/JS):
//   - Original ccsdsFlags from Template 5.42 = 0x0E (3BYTE | MSB | PREPROCESS)
//   - Remove 3BYTE (eccodes ECC-1602 always strips it)
//   - Remove MSB   (we are on a little-endian machine)
//   → final flags = AEC_DATA_PREPROCESS = 8
export const AEC_FLAGS_LE = 8;

// Cache the in-flight Promise so concurrent callers share one instantiation.
let _modulePromise = null;

/**
 * Load and initialise the WASM module. Safe to call multiple times —
 * returns the same cached module.
 *
 * @param {string|URL} [wasmUrl] - Optional explicit URL to ccsds.wasm.
 *   If omitted, the module tries to locate ccsds.wasm relative to this file.
 * @returns {Promise<object>} Emscripten module instance.
 */
export async function loadCCSDSModule(wasmUrl) {
    if (!_modulePromise) {
        // Dynamic import of the Emscripten glue (CJS-compatible via .cjs rename or
        // direct import when bundled).  The glue file sets up the WASM binary.
        const { default: createCCSDSModule } = await import('./ccsds.js');

        const opts = {};
        if (wasmUrl) {
            // Allow caller to override the WASM binary URL (e.g. from a CDN or
            // asset pipeline).
            opts.locateFile = (filename) =>
                filename.endsWith('.wasm') ? wasmUrl.toString() : filename;
        }

        _modulePromise = createCCSDSModule(opts);
    }
    return _modulePromise;
}

/**
 * Decode a CCSDS-compressed data block into an array of unsigned integers.
 *
 * @param {Uint8Array}  compressed      - Raw compressed bytes (Section 7 data)
 * @param {number}      nValues         - Number of values to decode
 * @param {number}      bitsPerSample   - Bits per decoded sample (e.g. 16)
 * @param {number}      blockSize       - AEC block size (e.g. 32)
 * @param {number}      rsi             - Reference Sample Interval (e.g. 128)
 * @param {number}      [flags]         - LibAEC flags (default: AEC_FLAGS_LE = 8)
 * @returns {Promise<Uint8Array|Uint16Array|Uint32Array>} decoded integer samples
 */
export async function ccsdsDecodeBuffer(
    compressed,
    nValues,
    bitsPerSample,
    blockSize,
    rsi,
    flags = AEC_FLAGS_LE
) {
    const mod = await loadCCSDSModule();

    // bytes_per_sample: libaec uses native word sizes (1, 2, or 4 bytes).
    // 3-byte samples are promoted to 4 by eccodes (AEC_DATA_3BYTE stripped).
    let bytesPerSample;
    if (bitsPerSample <= 8)       bytesPerSample = 1;
    else if (bitsPerSample <= 16) bytesPerSample = 2;
    else                          bytesPerSample = 4;

    const inLen  = compressed.length;
    const outLen = nValues * bytesPerSample;

    // Allocate WASM heap buffers
    const inPtr  = mod._ccsds_malloc(inLen);
    const outPtr = mod._ccsds_malloc(outLen);

    if (!inPtr || !outPtr) {
        if (inPtr)  mod._ccsds_free(inPtr);
        if (outPtr) mod._ccsds_free(outPtr);
        throw new Error('CCSDS: WASM malloc failed');
    }

    try {
        // Copy compressed input into WASM heap
        mod.HEAPU8.set(compressed, inPtr);

        // Decode
        const rc = mod._ccsds_decode_buffer(
            inPtr, inLen,
            outPtr, outLen,
            bitsPerSample,
            blockSize,
            rsi,
            flags
        );

        if (rc !== 0) {
            throw new Error(`CCSDS: aec_buffer_decode failed with code ${rc}`);
        }

        // Copy decoded output back to JS (typed array matching bytes_per_sample)
        let result;
        if (bytesPerSample === 1) {
            result = new Uint8Array(mod.HEAPU8.buffer, outPtr, nValues).slice();
        } else if (bytesPerSample === 2) {
            // WASM memory may not be 2-byte aligned at arbitrary pointers;
            // use HEAPU8 slice then reinterpret.
            const raw = mod.HEAPU8.slice(outPtr, outPtr + outLen);
            result = new Uint16Array(raw.buffer);
        } else {
            const raw = mod.HEAPU8.slice(outPtr, outPtr + outLen);
            result = new Uint32Array(raw.buffer);
        }

        return result;
    } finally {
        mod._ccsds_free(inPtr);
        mod._ccsds_free(outPtr);
    }
}
