import { defineConfig } from 'rolldown';
import { readFileSync } from 'node:fs';

export default defineConfig({
  input: 'src/index.js',
  external: (id) => id.endsWith('/ccsds.js') || id.endsWith('/openjpegwasm_decode.js'),
  output: {
    file: 'dist/grib2-decoder.js',
    format: 'es',
    sourcemap: true,
  },
  plugins: [
    {
      name: 'copy-wasm-assets',
      renderChunk(code, chunk) {
        if (chunk.fileName !== 'grib2-decoder.js') return null;
        // Rolldown may rewrite dynamic import paths; normalize both loaders
        // so they resolve to assets emitted next to the bundle in dist/.
        let patched = code
          .replaceAll('./wasm/ccsds.js', './ccsds.js')
          .replaceAll('./wasm/jpeg2000/openjpegwasm_decode.js', './openjpegwasm_decode.js')
          .replaceAll('./jpeg2000/openjpegwasm_decode.js', './openjpegwasm_decode.js');
        return patched === code ? null : patched;
      },
      generateBundle() {
        const assets = [
          ['ccsds.js',                'src/wasm/ccsds.js'],
          ['ccsds.wasm',              'src/wasm/ccsds.wasm'],
          ['openjpegwasm_decode.js',  'src/wasm/jpeg2000/openjpegwasm_decode.js'],
          ['openjpegwasm_decode.wasm','src/wasm/jpeg2000/openjpegwasm_decode.wasm'],
        ];
        for (const [fileName, srcPath] of assets) {
          let source;
          try {
            source = readFileSync(new URL(srcPath, import.meta.url));
          } catch {
            if (fileName.startsWith('ccsds'))
              throw new Error(`copy-wasm-assets: could not read ${srcPath}`);
            continue; // jpeg2000 artifact is optional
          }
          this.emitFile({ type: 'asset', fileName, source });
        }
      },
    },
  ],
});
