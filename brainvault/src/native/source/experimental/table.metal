// Experimental only. Reuses unchanged helpers and all original kernels.
#define argon2id_fill_modern64_v1_segment baseline_v1_segment
#include "../metal/argon2.metal"
#undef argon2id_fill_modern64_v1_segment

[[max_total_threads_per_threadgroup(128)]] kernel void argon2id_fill_modern64_v1_segment(
    device ulong *memory [[buffer(0)]],
    constant KernelParams &params [[buffer(1)]],
    device const uint *references [[buffer(2)]],
    uint threadgroup_index [[threadgroup_position_in_grid]],
    uint simdgroup_index [[simdgroup_index_in_threadgroup]],
    uint thread_index [[thread_index_in_simdgroup]],
    uint simd_width [[threads_per_simdgroup]]
) {
    uint shard = (threadgroup_index * params.simdgroups_per_threadgroup) + simdgroup_index;
    if (shard >= params.active_shards || simd_width != 32u) return;
    device ulong *arena = memory + (size_t(shard) * size_t(V1_MEMORY_BLOCKS) * WORDS_PER_BLOCK);
    RegisterBlock64 previous, temporary;
    uint start = v1_segment_slice == 0u ? 2u : 0u;
    uint current_index = (v1_segment_slice * V1_SEGMENT_LENGTH) + start;
    uint previous_index = current_index - 1u;
    register64_load(previous, arena + (ulong(previous_index) * WORDS_PER_BLOCK), thread_index);
    device ulong *current = arena + (ulong(current_index) * WORDS_PER_BLOCK);

    if (v1_segment_slice < 2u) {
        // For step i+1 the reference is at most i-1, already written before
        // step i starts. Only data-independent slices permit this lookahead.
        RegisterBlock64 loaded, next_loaded;
        uint reference = references[v1_segment_slice * V1_SEGMENT_LENGTH + start];
        register64_load(loaded, arena + ulong(reference) * WORDS_PER_BLOCK, thread_index);
        for (uint offset = start; offset < V1_SEGMENT_LENGTH; ++offset) {
            if (offset + 1u < V1_SEGMENT_LENGTH) {
                uint next_reference = references[v1_segment_slice * V1_SEGMENT_LENGTH + offset + 1u];
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
    } else {
        for (uint offset = start; offset < V1_SEGMENT_LENGTH; ++offset) {
            ulong random = shuffle_ulong(previous.a, 0u);
            uint reference = reference_index(v1_segment_slice, offset, uint(random), V1_SEGMENT_LENGTH);
            register64_fill_modern(arena, current, previous, temporary, reference, thread_index);
            current += WORDS_PER_BLOCK;
        }
    }
}

 // Public address schedule: identical across salts/passwords. One SIMD group
 // builds one 128-entry address block directly from the frozen parameters.
kernel void build_reference_table(
    device uint *references [[buffer(0)]],
    uint group [[threadgroup_position_in_grid]],
    uint lane [[thread_index_in_simdgroup]]
) {
    uint slice = group / 512u;
    uint block_index = group % 512u;
    ulong word = 0ul;
    if (lane == 2u) word = slice;
    if (lane == 3u) word = V1_MEMORY_BLOCKS;
    if (lane == 4u) word = 1ul;
    if (lane == 5u) word = 2ul;
    if (lane == 6u) word = block_index + 1u;
    RegisterBlock64 address, temporary;
    register64_next_addresses_modern(address, temporary, word, lane);
    for (uint index = 0u; index < 4u; ++index) {
        uint offset = block_index * 128u + index * 32u + lane;
        references[slice * V1_SEGMENT_LENGTH + offset] = slice == 0u && offset < 2u
            ? 0u : reference_index(slice, offset, uint(register64_get(address, index)), V1_SEGMENT_LENGTH);
    }
}
