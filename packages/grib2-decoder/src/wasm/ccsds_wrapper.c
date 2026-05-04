/*
 * ccsds_wrapper.c
 *
 * Minimal C wrapper around libaec's aec_buffer_decode for WASM export.
 * Exposed to JavaScript as a single flat function that accepts pointers
 * to pre-allocated WASM heap memory.
 */

#include <stdint.h>
#include <stddef.h>
#include <stdlib.h>
#include <string.h>
#include "libaec.h"

/*
 * Decode a CCSDS-compressed block.
 *
 * Parameters (all sizes in bytes):
 *   in_ptr        : pointer to compressed input data in WASM memory
 *   in_len        : byte length of compressed input
 *   out_ptr       : pointer to pre-allocated output buffer in WASM memory
 *   out_len       : byte length of output buffer (must be n_values * bytes_per_sample)
 *   bits_per_sample : bits per decoded sample (e.g. 16)
 *   block_size    : AEC block size (e.g. 32)
 *   rsi           : Reference Sample Interval (e.g. 128)
 *   flags         : LibAEC flags (AEC_DATA_* bitmask, already adjusted for endianness)
 *
 * Returns AEC_OK (0) on success, negative on error.
 */
int ccsds_decode_buffer(
    const unsigned char *in_ptr,
    size_t in_len,
    unsigned char *out_ptr,
    size_t out_len,
    unsigned int bits_per_sample,
    unsigned int block_size,
    unsigned int rsi,
    unsigned int flags
) {
    struct aec_stream strm;

    strm.next_in       = in_ptr;
    strm.avail_in      = in_len;
    strm.next_out      = out_ptr;
    strm.avail_out     = out_len;
    strm.bits_per_sample = bits_per_sample;
    strm.block_size    = block_size;
    strm.rsi           = rsi;
    strm.flags         = flags;

    return aec_buffer_decode(&strm);
}

/* Convenience allocator: allocate n bytes on the WASM heap. */
unsigned char *ccsds_malloc(size_t n) {
    return (unsigned char *)malloc(n);
}

/* Free a buffer allocated by ccsds_malloc. */
void ccsds_free(unsigned char *ptr) {
    free(ptr);
}
