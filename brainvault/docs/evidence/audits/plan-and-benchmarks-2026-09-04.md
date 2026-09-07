# BrainVault: improvement plan and measured candidates

Candidate: `5bdb9b03c5e5b3551c4735d6d39dad2ccddd0a4b`, main, 2026-09-04.
Manual review; no external-model verdicts. No production changes or publication.

## Verdict

Do not declare this checkout release-ready. Its existing manifest does not match
`src/core/index.ts`; npm reports latest 2.1.0 and rejects 2.2.0, which the local
landing recommends. The live landing is not byte-equal to local HTML.

There is a useful performance result: on this M3 Ultra, changing only the
4,000-shard CPU/GPU split reduced experimental median time by **26.25%**.
It does not establish a 26% improvement for Standard (10,000 shards), which
already uses the higher GPU fraction, or for laptops.

## Read scope and limitations

Read the first-party protocol, wallet, CLI, native orchestration, packaging,
Metal host/kernel, C/Rust bridges, benchmark harnesses, main tests and fixtures,
site HTML/CSS/JS/checks, and principal documentation. Also inspected upstream
Argon2 core/fill code and OpenCL orchestration. Existing audit reports were read
as historical claims, not adopted as current approval.

Inventory excluding installed dependencies, build/target directories and git:
325 files / 12,695,869 bytes; 87 source-text files / 14,616 lines outside paths
named vendor; vendor source-text inventory 101 files / 59,501 lines. These are
inventory counts, **not lines independently security-audited**. Not every line
of vendored Rust/SSE2NEON/OpenCL headers or installed npm dependencies was read;
archives/media were not re-audited. A complete dependency audit remains open.
This report does not claim that the entire folder has been exhaustively audited.

## First fixes, in order

1. **P1, observed integrity failure.** `docs/manifest.sha256:19` expects
   `8714ee20623168a5b89aa7d107eb52ce6e80c5466579178b9950fbc40d58a6a9`
   for `src/core/index.ts`; actual is
   `9e7caff7a00c85b0c999b6ce0f596f2c66ff22fd490bfe8b0bce196e4faac67d`.
   The checkout was clean before review. Trace the committed delta and approve
   the actual source before deliberately regenerating release evidence. Never
   regenerate the manifest merely to make authentication pass.
   Proven origin: compared with `706c00e9e`, the only change in this file is
   removal of the public `BRAINVAULT_MAX_SHARD_COUNT` re-export at line 29.
   The old file hashes exactly to the manifest expectation. It also explains
   the 603-to-602 line-count drift. Prefer restoring the intended public export
   if the removal was accidental; do not bless an accidental API deletion by
   changing its checksum. No root-derivation algorithm changed in this delta.
2. **P1, observed release journey mismatch.** `site/index.html:63,69,125`
   recommends 2.2.0; `npm view brainvault@2.2.0 version --json` returns E404;
   `npm view brainvault version --json` returns 2.1.0. Reconcile one reviewed,
   packed, published version with every command and checksum. Add a post-publish
   clean-directory install/launcher gate and then a live-assets equality gate.
   A local HTML substring test is not an installation test.
3. **P2, copied verification is not fail-stop.** The tarball commands at
   `site/index.html:69–72` are separate shell statements: failed checksum does
   not prevent extraction/execution when pasted together. Dependency installation
   is omitted as well; verify that route with no parent node_modules. Prefer
   a short, tested source-install route over an extra broken installation tab.
4. **P2, memory-cleanup gaps require focused regressions.** In
   `src/native/hybrid.ts:165` and `src/cli/index.ts:1033`, Promise.all can reject
   on stderr after stdout has resolved. Destructuring never assigns the output
   buffer, so the catch terminates the child without wiping that resolved buffer.
   This is a source-level ownership gap, not a demonstrated remote disclosure.
   Regress the completed-stdout/failed-progress order before changing cleanup.
   Separately, C `brainvault_argon2.c:152` disables clear_internal_memory globally;
   upstream `core.c` also uses it for stack intermediates, not just arenas.
   The arena is explicitly wiped on worker shutdown; stack erasure is a distinct
   boundary. Review it without silently trading away hygiene for performance.
5. **P2, audit map overstates the fast-path validator.** `docs/audit.md:41,67`
   says every response has a full request fingerprint and Metal goes through
   shard-collector. `hybrid.ts` actually uses fixed positional child ranges,
   bounded output, process status, and ordered concatenation. Document that real
   trust boundary; do not add a redundant validator merely to match the diagram.

### Compatibility decision, not a silent fix

NFKD uses the host Unicode tables (`spec.ts:127`, `kdf.ts:64`, CLI/native paths).
The accepted runtime range does not freeze a Unicode version. On this Bun,
Unicode 17 maps U+A7F1 to ASCII S; the character is absent from Unicode 13 data.
Newly assigned characters therefore need explicit cross-runtime recovery policy.
This is not a claim that ordinary Cyrillic changes between versions. Do not
silently replace V1 normalization or retroactively reinterpret existing inputs.

Sources: [Unicode 17 character data](https://www.unicode.org/Public/17.0.0/ucd/UnicodeData.txt),
[Unicode 13 character data](https://www.unicode.org/Public/13.0.0/ucd/UnicodeData.txt).
Record runtime/Unicode provenance and add a version-boundary vector before
deciding how creation and recovery handle newly assigned characters.

## Landing: three blocks, one job each

1. **Hero and launch.** Keep “Your wallet, mined from memory.” Use a bold,
   full-width sans-serif headline, near-black/off-white, and compact copyable
   command directly below. Borrow the hierarchy of the supplied Herdr reference,
   not its mascot, purple styling, popularity counters or decorative grid.
   Supporting copy: “Remember a strong secret. Recreate your wallet anywhere.”
   Explain the exact username and work settings in the adjacent recovery note.
2. **How it works and the tradeoff.** Three short steps: remember the inputs;
   run memory-hard work; recover the same wallet. One compact comparison, no
   traffic-light scorecard. Keep the useful distinction: no required seed copy,
   deliberately costly guesses, but security still depends on the secret and
   forgetting the inputs can permanently lose access. No “better in every way”,
   “unbreakable for decades”, or numerical AI assurance.
3. **Run and verify.** Tested quick-run and source-review options. Put the
   expert audit prompt, exact Argon parameters, benchmark ranges, build commands
   and evidence links in expandable details or GitHub. Risks remain visible.

Remove repeated terminal demonstrations, duplicated risk paragraphs, giant
installer empty space, and metrics without a user consequence. “256 MiB per
job” is supporting evidence, not the opening sales message. Keep “Source” as
the explicit GitHub link. No redesign of protocol or dependency tree is needed.

Acceptance: installation commands actually run from an empty audited directory;
copy selects only the active command; keyboard tabs work; 375px and desktop
layouts have no horizontal overflow; visible failure/loss caveat; deployed HTML,
CSS and JS match the approved build. No claim that these browser gates ran here.

## Repeated benchmark: top three available GPU paths

Apple M3 Ultra, 32 CPU / 80 GPU cores, 512 GiB unified RAM; macOS 26.6.2
(25G83), Bun 1.4.0, clang 21.0.0, rustc 1.94.1, SDK 26.5. AC power,
low-power mode 0; no thermal warning from pmset. Temperature was not measured.
Initial load averages 3.66/3.75/3.41. Warm machine; not reboot-cold testing.

All runs held the repository stand lock. Engines ran sequentially, with order
changed each round. Another task used the stand between later batches, never
concurrently. Same public benchmark inputs, multiplier 1, Argon2id v0x13,
m=262,144 KiB, t=1, p=1, 32-byte output. No wipe policy was changed.

For 1,000 shards, totalTimeMs includes harness derivation and root folding,
but excludes Bun/import startup and CLI/wallet presentation. Shards/s below
uses that total median, not the harness's slightly different Argon-only rate.

| Engine | n | Best | Median | Worst | Shards/s | vs C median |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Metal generic + C | 5 | 2.368s | 2.416s | 2.528s | 414.0 | 2.157x |
| Production Metal V1 + C | 5 | 2.340s | 2.448s | 2.504s | 408.5 | 2.128x |
| OpenCL + C | 5 | 3.010s | 3.127s | 3.439s | 319.8 | 1.666x |
| C/NEON M3 reference | 3 | 5.081s | 5.210s | 5.443s | 191.9 | 1.000x |

Generic's 1.32% lower median than production is within the observed variability:
do not promote it or claim a meaningful speedup. These are descriptive samples,
not a statistical confidence interval or p95 estimate.

Full root from all 18 table runs:

```text
dc2090d65af300c74384ca36adf16ff993c43f4947ee9a0f09e8055f009c3485
```

Metal plans: CPU 360/32 workers, GPU 640/8 processes/40 workers each.
OpenCL: CPU 504/30 workers, GPU 496/1 process/248 workers.
Calculated live Argon arenas: Metal 88 GiB, OpenCL 69.5 GiB, C 8 GiB;
these exclude process/driver overhead, not measured total resident memory.
One /usr/bin/time sample reported ~8.59 GB maximum RSS for Metal/C and
~8.06 GB for OpenCL; it is not an aggregate GPU/process-tree RAM measurement.
External process wall times in that round were 2.49/2.45/3.07/5.25s
for V1/generic/OpenCL/C respectively.

## More than 10%: demonstrated for the 4,000-shard schedule

`hybrid.ts:69` gives 80% GPU only to exactly 10,000 production Metal shards.
At 4,000 it keeps 64%, leaving a large CPU tail. Test the same native binaries,
8 GPU processes, 40 arenas each, 32 CPU workers, private storage and simdgroups 4:

| Split GPU/CPU | n | Best | Median | Worst | Shards/s |
| --- | ---: | ---: | ---: | ---: | ---: |
| Current 2,560/1,440 | 3 | 8.371s | 8.511s | 8.704s | 470.0 |
| Candidate 3,200/800 | 3 | 6.143s | 6.277s | 6.286s | 637.2 |

Order AB / BA / AB. **26.25% less time; 35.59% more throughput.** Even
candidate worst beats baseline best. Same calculated 88 GiB arena allocation.
The experimental harness times child startup, setup, work, output and wipe,
but excludes salt preparation and final fold. It is not the production
verification/failure-handling boundary; use a production-path A/B before promotion.

Both schedules, and a separate C-only 4,000-shard run, produced:

```text
3fa2d7e0a1dd2eafc57616537e6ef7e4667cbcadb6c7fa32634b7159585e1afe
```

C-only total time was 20.797341s (one parity reference, not a repeated baseline).
Do not use that single sample as a stable performance claim.

## Rejected and deferred experiments

- 1,000 shards, 9 GPU processes/720 GPU shards: ABBAAB medians 2.434s current
  versus 2.287s candidate, only 6.02% less time; candidate tail 3.180s. Reject.
- Increasing 8-process GPU workers from 40 to 44–50 regressed to ~3.5s;
  more workers/RAM is not automatically better. SIMD groups 1/2 gave ~4s.
- One profile of the retained Metal plan: per-child setup 174–419ms, command
  1.40–1.56s, wipe 23–36ms; CPU branch 2.355s versus GPU branch 2.001s.
  Persistent GPU helpers cannot remove that CPU tail. Do not add retained
  cross-request arenas before simpler scheduling has exhausted its benefit.
- Prefer a bounded, measured wave-aware plan over runtime tuning on secrets.
  Next test neighboring shard counts and high presets, then the failure matrix.
  Do not extrapolate 4,000 to every count or claim new 10,000-shard gains.
- No M1/M5 hardware testing here. Keep their conservative CPU defaults until
  memory pressure, thermals, parity, cancellation and repeated timing are measured.

## Exact reproduction and retained samples

From the repository root, check `bun run stand:status` before each invocation:

```sh
bun run stand:run --reason brainvault-top3 -- bun brainvault/src/native/source/benchmark.ts --backend=metal-v1 --shards=1000 --workers=32
bun run stand:run --reason brainvault-split -- bun brainvault/src/native/source/metal/benchmark.ts --mode=hybrid --shards=4000 --cpu-workers=32 --metal-workers=40 --gpu-shards=3200 --kernel=v1special --memory=private --metal-processes=8 --simdgroups=4
```

Substitute backend metal-generic/opencl/c-neon; for A use gpu-shards=2560.
Never run the two commands concurrently. Raw milliseconds, chronological per engine:

```text
Metal V1 total: 2375.932, 2340.435, 2503.820, 2447.932, 2500.028
Generic total: 2368.390, 2409.875, 2425.349, 2415.589, 2528.384
OpenCL total: 3126.624, 3010.049, 3246.421, 3020.623, 3439.026
C total: 5080.971, 5210.152, 5443.192
Excluded labelled V1 warmup: 2355.809
Round order: V1/G/O; O/G/V1/C; G/V1/O; O/V1/G/C; G/V1/O/C
4000 A: 8370.631, 8511.071, 8703.517
4000 B: 6142.907, 6285.723, 6277.040
1000 A (8p/640GPU): 2441.836, 2433.873, 2415.291
1000 B (9p/720GPU): 2234.789, 3180.044, 2287.441
```

## Verification status

- Local site source gate: 21/21 PASS.
- Live site gate: FAIL, deployed HTML differs byte-for-byte from source.
- Registry: latest 2.1.0; requested 2.2.0 E404.
- `bun run check`: **88 pass / 3 fail**, 91 tests, 101,932 assertions, 65.20s.
  Failures: manifest authentication; packed-package gate (its nested audit-size
  test fails); audit-size documentation drift (wallet layer is 602 lines, docs
  claim 603). The latter two share the same stale count, not two distinct
  cryptographic defects. Existing root/vector, terminal and native parity tests
  passed. No manifest or documentation repair was hidden inside this review.
- `git diff --check`: PASS. Only this new report was added by this task.
- Release matrix/reproducible rebuilds were not rerun: this is not a release.
- No source, protocol, defaults, manifest, site or deployed artifacts modified.

Next: resolve integrity/release evidence, add targeted cleanup/Unicode coverage,
then implement the compact landing and validate a narrowly scoped scheduler gain.
