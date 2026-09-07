// Experimental only. Reuses unchanged helpers and all original kernels.
#define argon2id_fill_modern64_v1_segment baseline_v1_segment
#include "../metal/argon2.metal"
#undef argon2id_fill_modern64_v1_segment

inline uint lookahead_reference(
    uint offset, thread RegisterBlock64 &address,
    thread RegisterBlock64 &temporary, thread ulong &input_word, uint thread_index
) {
    uint address_index = offset % WORDS_PER_BLOCK;
    if (address_index == 0u) {
        if (thread_index == 6u) input_word += 1ul;
        register64_next_addresses_modern(address, temporary, input_word, thread_index);
    }
    ulong random = shuffle_ulong(register64_get(address, address_index / 32u), address_index % 32u);
    return reference_index(v1_segment_slice, offset, uint(random), V1_SEGMENT_LENGTH);
}

[[max_total_threads_per_threadgroup(128)]] kernel void argon2id_fill_modern64_v1_segment(
    device ulong *memory [[buffer(0)]],
    constant KernelParams &params [[buffer(1)]],
    uint threadgroup_index [[threadgroup_position_in_grid]],
    uint simdgroup_index [[simdgroup_index_in_threadgroup]],
    uint thread_index [[thread_index_in_simdgroup]],
    uint simd_width [[threads_per_simdgroup]]
) {
    uint shard = (threadgroup_index * params.simdgroups_per_threadgroup) + simdgroup_index;
    if (shard >= params.active_shards || simd_width != 32u) return;
    device ulong *arena = memory + (size_t(shard) * size_t(V1_MEMORY_BLOCKS) * WORDS_PER_BLOCK);
    RegisterBlock64 previous, temporary, address;
    ulong input_word;
    switch (thread_index) {
        case 2u: input_word = v1_segment_slice; break;
        case 3u: input_word = V1_MEMORY_BLOCKS; break;
        case 4u: input_word = 1ul; break;
        case 5u: input_word = 2ul; break;
        default: input_word = 0ul; break;
    }

    uint start = v1_segment_slice == 0u ? 2u : 0u;
    if (v1_segment_slice == 0u) {
        if (thread_index == 6u) input_word = 1ul;
        register64_next_addresses_modern(address, temporary, input_word, thread_index);
    }
    uint current_index = (v1_segment_slice * V1_SEGMENT_LENGTH) + start;
    uint previous_index = current_index - 1u;
    register64_load(previous, arena + (ulong(previous_index) * WORDS_PER_BLOCK), thread_index);
    device ulong *current = arena + (ulong(current_index) * WORDS_PER_BLOCK);

    if (v1_segment_slice < 2u) {
#if LOOKAHEAD_DISTANCE == 2
        RegisterBlock64 loaded, following, next_loaded;
        uint reference = lookahead_reference(start, address, temporary, input_word, thread_index);
        register64_load(loaded, arena + ulong(reference) * WORDS_PER_BLOCK, thread_index);
        reference = lookahead_reference(start + 1u, address, temporary, input_word, thread_index);
        register64_load(following, arena + ulong(reference) * WORDS_PER_BLOCK, thread_index);
        for (uint offset = start; offset < V1_SEGMENT_LENGTH; ++offset) {
            bool forward = false;
            if (offset + 2u < V1_SEGMENT_LENGTH) {
                uint next_reference = lookahead_reference(offset + 2u, address, temporary, input_word, thread_index);
                // Two-ahead may refer to the CURRENT block. Never read it
                // before writing: forward the completed register value below.
                forward = next_reference == v1_segment_slice * V1_SEGMENT_LENGTH + offset;
                if (!forward) register64_load(next_loaded, arena + ulong(next_reference) * WORDS_PER_BLOCK, thread_index);
            }
            register64_xor(previous, loaded);
            temporary = previous;
            register64_permute_modern(previous, thread_index);
            register64_xor(previous, temporary);
            register64_store(current, previous, thread_index);
            if (offset + 1u < V1_SEGMENT_LENGTH) loaded = following;
            if (offset + 2u < V1_SEGMENT_LENGTH) following = forward ? previous : next_loaded;
            current += WORDS_PER_BLOCK;
        }
#else
        // For step i+1 the reference is at most i-1, already written before
        // step i starts. Only data-independent slices permit this lookahead.
        RegisterBlock64 loaded, next_loaded;
        uint reference = lookahead_reference(start, address, temporary, input_word, thread_index);
        register64_load(loaded, arena + ulong(reference) * WORDS_PER_BLOCK, thread_index);
        for (uint offset = start; offset < V1_SEGMENT_LENGTH; ++offset) {
            if (offset + 1u < V1_SEGMENT_LENGTH) {
                uint next_reference = lookahead_reference(offset + 1u, address, temporary, input_word, thread_index);
                register64_load(next_loaded, arena + ulong(next_reference) * WORDS_PER_BLOCK, thread_index);
            }
            register64_xor(previous, loaded);
            temporary = previous;
            register64_permute_modern(previous, thread_index);
            register64_xor(previous, temporary);
            register64_store(current, previous, thread_index);
            if (offset + 1u < V1_SEGMENT_LENGTH) loaded = next_loaded;
            current += WORDS_PER_BLOCK;
        }
#endif
    } else {
        for (uint offset = start; offset < V1_SEGMENT_LENGTH; ++offset) {
            ulong random = shuffle_ulong(previous.a, 0u);
            uint reference = reference_index(v1_segment_slice, offset, uint(random), V1_SEGMENT_LENGTH);
            register64_fill_modern(arena, current, previous, temporary, reference, thread_index);
            current += WORDS_PER_BLOCK;
        }
    }
}
