# BrainVault native source and research backends

Reproducible comparison for the frozen BrainVault V1 shard parameters:

- Argon2id v19
- 256 MiB per shard
- time cost 1
- parallelism 1
- 32-byte output
- 1,000 shards, factor 4
- 8 outer workers unless explicitly noted
- inputs `benchmark-user` / `benchmark-password`
- Apple M3 Ultra, Bun 1.4.0, macOS arm64

Every full backend run produced this identical master root:

```text
dc2090d65af300c74384ca36adf16ff993c43f4947ee9a0f09e8055f009c3485
```

## Results

| Backend | 1,000-shard time | Shards/s | Notes |
| --- | ---: | ---: | --- |
| Existing production CLI/native baseline | 15.335 s | 65.21 | Original path, 8 workers |
| Existing native worker via common harness | 16.629 s | 60.14 | Apples-to-apples harness |
| Official C Argon2 through SSE2NEON | 15.992 s | 62.53 | Reused 256 MiB arena per worker |
| TypeScript/WASM (`hash-wasm`) | 28.430 s | 35.18 | Browser-compatible parity path |

The normal CLI now defaults to all hardware cores allowed by RAM. On this
32-core machine the same 1,000-shard derivation completed in 6.336 seconds,
2.42x faster than the original 8-worker baseline. That result is concurrency
scaling, not a same-core algorithmic speedup.

## 32-worker results

All options were also run with 32 workers on the same 1,000-shard input. Every
run produced the same master root shown above.

| Backend | 1,000-shard time | Shards/s | Speedup vs original 8-worker CLI |
| --- | ---: | ---: | ---: |
| C/NEON, reused arena and final wipe | **5.212 s** | **191.87** | **2.94x** |
| Existing native worker via common harness | 6.265 s | 159.61 | 2.45x |
| TypeScript/WASM (`hash-wasm`) | 13.096 s | 76.36 | 1.17x |

The C final-wipe process does not leave a long-lived dirty arena: each worker
reuses its arena only while processing its assigned shards, then securely wipes
the full 256 MiB before the subprocess exits. On macOS that final erase uses the
non-elidable, libc-vectorized C11 `memset_s`; other platforms retain the portable
volatile fallback. The source variants and comparison
modes remain under `src/native/source/`; the publishable CLI selects a verified
C/NEON release build as its fast Apple Silicon default when eligible, otherwise
the portable native binding. Selection happens before derivation; a runtime
engine failure is fatal and never silently switches. Both paths automatically
use all CPU cores allowed by RAM.

## Apple GPU research

`metal/` contains the dependency-free native Metal backend for the exact
V1 Argon2id shard. GPU-private arenas, a compact 64-bit segmented permutation,
and multi-process scheduling raised the M3 Ultra result from the original
49.11-shard/s pure GPU prototype to **2.478 seconds / 403.62 shards/s** in the
latest full sequential 11-engine run for the complete 1,000-shard CPU/GPU
derivation. The frozen root remained
`dc2090d65af300c74384ca36adf16ff993c43f4947ee9a0f09e8055f009c3485`.
That run was **2.22x** faster than its 5.497-second C/NEON baseline. The current V1-specialized profile uses 640 Metal / 360 CPU
shards, eight Metal processes with 40 workers each, 32 CPU workers, and about
88 GiB of live arenas. A separate alternating sweep measured a 2.374-second
median and 2.340-second best for this profile. It is the automatic wallet engine
only on the measured 80-GPU-core, 512-GiB M3 Ultra class. Other Macs retain the
C/NEON default until a real-device release matrix exists.

The exact 10,000-shard user default has its own measured Metal plan rather than
scaling the 1,000-shard ratio. A 3+3 alternating comparison moved from 6,400
GPU / 3,600 CPU shards at a 20.169-second median to 8,000 GPU / 2,000 CPU at a
14.064-second median, a 30.27% improvement with the same 88 GiB active-arena
budget and frozen root. See the source-only
`docs/evidence/audits/m3-ultra-re-audit-2026-09-03.md`; release evidence is
kept in the source repository and is not nested in the npm artifact.

## Run

```bash
# Existing native binding
bun src/native/source/benchmark.ts --backend=baseline --shards=1000 --workers=8

# Browser-compatible TypeScript/WASM
bun src/native/source/benchmark.ts --backend=wasm --shards=1000 --workers=8

# Build and run C/NEON
make -C src/native/source/c
bun src/native/source/benchmark.ts --backend=c-neon --shards=1000 --workers=8
```

Raw run output and prior model-review notes are source-only under
`docs/evidence/`; they are not part of the npm artifact. The aborted
100,000-shard log records the initially requested run before the benchmark size
was corrected to 1,000.
