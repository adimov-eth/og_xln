# `xln` Multi-POV Wallet & Programs Design Room (Arrival Scheme v2)

Executable Arrival Scheme specification and multi-model design room for `xln`'s **Wallet Kernel**, **Universal Signing Sheet**, **Surfaces**, and **XLN Programs (`xln-app`)**—grounded against `origin/main` (`bdc53c7b` -> `8f8a4a6a`).

## Room Files

| Path | Role |
|---|---|
| [`BRIEF.md`](./BRIEF.md) | Cold-entry architectural brief & anti-priming rules. |
| [`AS-IS.md`](./AS-IS.md) & [`AS-IS-SCREENS.md`](./AS-IS-SCREENS.md) | Live + source-verified inventory of shipped React (`ui/`) and Svelte (`frontend/`) wallets on `8f8a4a6a`. |
| [`base.scm`](./base.scm) | Canonical AST-verified `figure`s (with `:term`), `verb`s, and `16/16` `ui/src/screens/*.tsx` map. |
| [`dsl.ts`](./dsl.ts) & [`check.ts`](./check.ts) | Frozen v2 Arrival `EnvCapability` (`signing-sheet`, `surface`, `xln-app`, `story`, `fork`, `critique`) + validator, `--perspective` checker, `--pack` prompt bundler, and `--emit` TS generator. |
| [`packs/`](./packs/) | Self-contained Round-1 cold prompt bundles (`p1-consumer`, `p2-sovereign`, `p3-commercial`, `p4-steward-redteam`). |
| [`perspectives/`](./perspectives/) | Isolated Round-1 `.scm` blueprints from Grok, Claude, and Gemini. |
| [`probes/run-signing-sweep.ts`](./probes/run-signing-sweep.ts) | Round-2 subscription-CLI sweep (xAI Grok, Claude, Gemini; zero OpenRouter) pitting hostile & legitimate `xln-app` requests against candidate `signing-sheet`s. |
| [`CHAT.md`](./CHAT.md) & [`rounds/`](./rounds/) | Round-2 append-only dialogue (`<= 15` lines/turn) and `.scm` critiques/scope cuts. |

## Commands

```bash
export PATH="$HOME/.bun/bin:/opt/homebrew/bin:$PATH"

# 1. Generate/refresh self-contained cold prompt packs for Grok, Claude, Gemini
bun docs/studies/ui/surfaces/check.ts --pack all

# 2. Validate an individual Round-1 cold perspective against base.scm
bun docs/studies/ui/surfaces/check.ts --perspective docs/studies/ui/surfaces/perspectives/p1-consumer.scm

# 3. Preview or run the Round-2 signing-sheet red-team sweep (subscription CLIs, zero OpenRouter)
bun docs/studies/ui/surfaces/probes/run-signing-sweep.ts dry
bun docs/studies/ui/surfaces/probes/run-signing-sweep.ts sweep

# 4. Validate the merged canonical spec & emit zero-dependency TypeScript
bun docs/studies/ui/surfaces/check.ts --emit docs/studies/ui/surfaces/surfaces.generated.ts
bun test docs/studies/ui/surfaces/surfaces.test.ts
```
