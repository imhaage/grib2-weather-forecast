/* Minimal config.h for WASM build via Emscripten (clang-based).
 * __has_builtin(__builtin_clzll) will return 1 at compile time, so
 * decode.c will use the clang/GCC builtin path without any explicit define. */
#ifndef CONFIG_H
#define CONFIG_H
#endif
