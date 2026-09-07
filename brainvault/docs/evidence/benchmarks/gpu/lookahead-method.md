# M3 Ultra lookahead experiments

Experimental, not selected by the CLI and not included in the npm allowlist.
Use **public benchmark inputs only**: this harness is not the production native
validation/isolation boundary. Existing V1 constants, salts and root fold remain
unchanged. Every measured run here used exactly 10,000 shards, multiplier one.

## Build and run

From the repository root, check `bun run stand:status` before each heavy command.
Always rebuild with `-B`: selecting a different make variable alone does not
invalidate an existing output file. Build outputs are ignored under `build/`.

```sh
bun run stand:run --reason brainvault-build -- make -B -C brainvault/src/native/source/experimental VARIANT=lookahead DISTANCE=1
bun run stand:run --reason brainvault-10k -- bun brainvault/src/native/source/experimental/benchmark.ts --mode=hybrid --shards=10000 --cpu-workers=32 --metal-workers=40 --metal-processes=8 --gpu-shards=8320
```

`VARIANT=paired` tests explicit two-word integer arithmetic with one-step
lookahead. `VARIANT=table` builds a modified host generating a public 512-KiB
address table once per helper. `VARIANT=lookahead DISTANCE=2` tests two-step
lookahead, forwarding the current computed block when a reference points to it.
Only lookahead/paired reuse the exact shipped host executable and its cleanup.
The table variant retains the host cleanup but has additional setup failure paths
that have not been reviewed to production depth.

## Why this preserves the dependency chain

The first two Argon2id segments use data-independent references. A reference for
step `i+1` is at most `i-1`, so a one-step prefetch reads an already completed
block. It does not compute step `i+1` early. Offset 128 advances the address-block
counter exactly once; the final segment offset never prefetches past its end.
The last two segments remain sequential and data-dependent. Two-step lookahead
requires special treatment: its reference can equal the current block, in which
case the register result is forwarded only after computation, never loaded early.

## Evidence and limits

See `lookahead-10000-2026-09-05.json` for raw samples and exact commands.
The A/B sequence is A/B, B/A, A/B; three samples per variant, no confidence
interval claim. Both use this orchestration harness, not full CLI wall time.
Do not compare its totals as if identical to the earlier common benchmark's
`totalTimeMs`, which also includes the final fold.

One-step lookahead plus the tested split reduced median latency from 15.164 s
to 14.261 s (5.95%), with substantial CPU-tail noise. The 12.881-s exploratory
sample is not a stable performance claim. The requested 20% reduction is **not
proven**. Every completed sample matched the previously verified full 10k root.
Two-step lookahead returned 13.850 s in one additional sample; it did not meet
the target and was not selected for the repeated A/B series.

Two read-only in-session peers suggested and inspected the experiments. Their
agreement is not an external security audit or proof of production readiness.
Production promotion still needs independent raw-output/failure testing,
memory-hygiene review, reproducible builds, packaging evidence and stable gains.

The kernel optimization does not branch on total shard count. However, the
8320/1680 split is a tested 10k schedule, not an approved general planner.
No 100k measurements were run; equal percentage gains there are unverified.

## Final package gate

`bun run check` was attempted from the package under the stand supervisor's
30-second budget. It reproduced the existing manifest failure for
`src/core/index.ts` (expected `8714ee20623168a5b89aa7d107eb52ce6e80c5466579178b9950fbc40d58a6a9`,
actual `9e7caff7a00c85b0c999b6ce0f596f2c66ff22fd490bfe8b0bce196e4faac67d`)
and subsequently timed out with exit 124. No full-suite pass count is claimed.
These experiments did not edit that production file or regenerate its manifest.
