import { defineConfig } from 'rolldown';
import { readFileSync } from 'node:fs';

export default defineConfig({
  input: 'src/index.js',
  external: (id) => id.endsWith('ccsds.js'),
  output: {
    file: 'dist/grib2-decoder.js',
    format: 'es',
    sourcemap: true,
  },
  plugins: [
    {
      name: 'copy-wasm-assets',
      renderChunk(code) {
        // Rolldown rewrites the relative path from src/wasm/ to dist/, turning
        // './ccsds.js' into './wasm/ccsds.js'. Fix it back so it resolves to
        // the asset emitted next to the bundle.
        const patched = code.replaceAll('./wasm/ccsds.js', './ccsds.js');
        if (patched === code)
          throw new Error('renderChunk: ./wasm/ccsds.js not found in output — check Rolldown path rewriting');
        return patched;
      },
      generateBundle() {
        for (const file of ['ccsds.js', 'ccsds.wasm']) {
          let source;
          try {
            source = readFileSync(new URL(`src/wasm/${file}`, import.meta.url));
          } catch {
            throw new Error(`copy-wasm-assets: could not read src/wasm/${file} — ensure libaec WASM is compiled`);
          }
          this.emitFile({ type: 'asset', fileName: file, source });
        }
      },
    },
  ],
});
