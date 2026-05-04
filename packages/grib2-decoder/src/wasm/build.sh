#!/usr/bin/env bash
# build.sh — Compile libaec + wrapper to WebAssembly using Emscripten via Docker.
#
# Usage: bash src/wasm/build.sh
# Output: src/wasm/ccsds.wasm  +  src/wasm/ccsds.js  (ES module glue)
#
# Requires: Docker, libaec/ clone at project root (git clone libaec in root).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
LIBAEC_SRC="$PROJECT_ROOT/libaec/src"
LIBAEC_INC="$PROJECT_ROOT/libaec/include"
OUT_DIR="$SCRIPT_DIR"

echo "Building CCSDS WASM module..."
echo "  libaec sources : $LIBAEC_SRC"
echo "  output dir     : $OUT_DIR"

docker run --rm \
  -v "$PROJECT_ROOT":/src \
  -w /src \
  emscripten/emsdk:latest \
  emcc -O2 \
    "libaec/src/decode.c" \
    "libaec/src/vector.c" \
    "src/wasm/ccsds_wrapper.c" \
    -I "src/wasm/libaec" \
    -I "libaec/include" \
    -DLIBAEC_DLL_EXPORTED= \
    -s WASM=1 \
    -s MODULARIZE=1 \
    -s EXPORT_NAME='createCCSDSModule' \
    -s EXPORTED_FUNCTIONS='["_ccsds_decode_buffer","_ccsds_malloc","_ccsds_free","_malloc","_free"]' \
    -s EXPORTED_RUNTIME_METHODS='["getValue","HEAPU8"]' \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s ENVIRONMENT='web,worker,node' \
    -s SINGLE_FILE=0 \
    -s EXPORT_ES6=1 \
    --no-entry \
    -o "src/wasm/ccsds.js"

echo "Done. Output:"
ls -lh "$OUT_DIR/ccsds.wasm" "$OUT_DIR/ccsds.js"
