/**
 * Lazy loader for the OpenJPEG WASM module (@cornerstonejs/codec-openjpeg).
 * Provides jp2DecodeBuffer() — decodes a raw J2C codestream to integer samples.
 *
 * openjpegwasm_decode.js is a CJS/UMD Emscripten build that uses require() and
 * __dirname internally. Strategy:
 *   - Node.js: load via createRequire() so the CJS context is available (require,
 *     __dirname, module.exports). The file then sets up readBinary/readAsync and
 *     finds the WASM relative to its own __dirname — no extra options needed.
 *   - Browser: load via dynamic import() using the export default we added to the
 *     file, and override locateFile so the WASM URL is resolved correctly (the
 *     file sets scriptDirectory="" for ESM dynamic imports where currentScript is null).
 */

// Module-level WASM URL — resolved relative to this loader file.
// rolldown.config.js patches ./jpeg2000/openjpegwasm_decode.wasm → ./openjpegwasm_decode.wasm
// so this resolves correctly next to the bundle in dist/.
const _wasmUrl = new URL('./jpeg2000/openjpegwasm_decode.wasm', import.meta.url);

let _modulePromise = null;

async function loadJP2Module() {
    if (!_modulePromise) {
        let createJP2Module;
        const opts = {};

        if (typeof process !== 'undefined' && process.versions?.node) {
            // Node.js: load the .cjs copy so Node treats it as CommonJS, giving the
            // Emscripten file access to require/__dirname for fs and WASM resolution.
            const { createRequire } = await import('node:module');
            const require = createRequire(import.meta.url);
            createJP2Module = require('./jpeg2000/openjpegwasm_decode.cjs');
        } else {
            // Browser: ESM load via the export default added to the .js file.
            // Provide locateFile so the WASM is fetched from the correct URL
            // (scriptDirectory is "" for ESM dynamic imports in browsers).
            ({ default: createJP2Module } = await import('./jpeg2000/openjpegwasm_decode.js'));
            opts.locateFile = (filename) =>
                filename.endsWith('.wasm') ? _wasmUrl.href : filename;
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
