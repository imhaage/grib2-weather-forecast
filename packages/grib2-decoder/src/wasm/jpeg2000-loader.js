/**
 * Lazy loader for the OpenJPEG WASM module (@cornerstonejs/codec-openjpeg).
 * Provides jp2DecodeBuffer() — decodes a raw J2C codestream to integer samples.
 */

let _modulePromise = null;

async function loadJP2Module(wasmUrl) {
    if (!_modulePromise) {
        const { default: createJP2Module } = await import('./jpeg2000/openjpegwasm_decode.js');
        const opts = {};
        if (wasmUrl) {
            opts.locateFile = (filename) =>
                filename.endsWith('.wasm') ? wasmUrl.toString() : filename;
        }
        _modulePromise = createJP2Module(opts);
    }
    return _modulePromise;
}

/**
 * Decode a raw JPEG 2000 J2C codestream into an array of integer samples.
 *
 * @param {Uint8Array} compressed - Raw J2C codestream bytes (Section 7 data)
 * @returns {Promise<Int32Array>} decoded integer sample values
 */
export async function jp2DecodeBuffer(compressed) {
    const mod = await loadJP2Module();
    const decoder = new mod.J2KDecoder();
    try {
        const encodedBuffer = decoder.getEncodedBuffer(compressed.length);
        encodedBuffer.set(compressed);
        decoder.decode();

        const decodedBuffer = decoder.getDecodedBuffer();
        const { width, height, bitsPerSample } = decoder.getFrameInfo();
        const totalSamples = width * height;

        const result = new Int32Array(totalSamples);
        if (bitsPerSample <= 8) {
            const view = new Uint8Array(decodedBuffer);
            for (let i = 0; i < totalSamples; i++) result[i] = view[i];
        } else if (bitsPerSample <= 16) {
            const raw = new Uint8Array(decodedBuffer);
            const view = new Uint16Array(raw.buffer, raw.byteOffset, totalSamples);
            for (let i = 0; i < totalSamples; i++) result[i] = view[i];
        } else {
            const raw = new Uint8Array(decodedBuffer);
            const view = new Int32Array(raw.buffer, raw.byteOffset, totalSamples);
            for (let i = 0; i < totalSamples; i++) result[i] = view[i];
        }
        return result;
    } finally {
        decoder.delete();
    }
}
