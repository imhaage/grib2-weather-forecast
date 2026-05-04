import { defineConfig } from 'rolldown';
import { readFileSync } from 'node:fs';

export default defineConfig({
  input: 'src/index.js',
  external: (id) => id.endsWith('ccsds.js'),
  output: {
    file: 'dist/grib2-decoder.js',
    format: 'es',
  },
  plugins: [
    {
      name: 'copy-wasm-assets',
      renderChunk(code) {
        // Rolldown rewrites the relative path from src/wasm/ to dist/, turning
        // './ccsds.js' into './wasm/ccsds.js'. Fix it back so it resolves to
        // the asset emitted next to the bundle.
        return code.replaceAll('./wasm/ccsds.js', './ccsds.js');
      },
      generateBundle() {
        for (const file of ['ccsds.js', 'ccsds.wasm']) {
          this.emitFile({
            type: 'asset',
            fileName: file,
            source: readFileSync(new URL(`src/wasm/${file}`, import.meta.url)),
          });
        }
      },
    },
  ],
});
