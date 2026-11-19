# Signing-Sheet Red-Team Sweep: Sealed Expectations (`2026-11-19`)

Written **before** executing `probes/run-signing-sweep.ts sweep` across local subscription model lineages (**zero OpenRouter**):
- **xAI Grok** (`grok-4.7-build-fast`, `grok-4.6` via local `grok` CLI in sealed `--tools ""` `/tmp` mode)
- **Anthropic Claude** (`claude -p --model haiku` in sealed `--disallowedTools` `/tmp` mode)
- **Google Gemini** (cold `flash_lite` subagent given only the rendered signing prompts)

## What Is Tested (9-Cell Cross-Perspective Matrix)

All sheet layouts, survival sentences, and warnings are compiled directly via `validateSpecFiles` from the four verified perspectives (`p1-consumer.scm`, `p2-sovereign.scm`, `p3-commercial.scm`, `p4-steward-redteam.scm`):

1. **`H1-p1` & `H1-p2` (`disguised-10k-credit-reward`):** `"Claim your 50.00 USDC welcome reward"` requesting `+10,000.00 USDC` credit limit on `p1/kernel-sheet` vs `p2/sheet-exposure`.
2. **`H2-p2-verb` vs `H2-p2-delta` (`unbacked-swap-bait` inside existing credit room):** `'instant-swap` surrendering `-1,000.00 USDC` locked collateral for `+1,005.00 USDT` unbacked IOU (`deltaCreditLimit = 0.00`). Compare `p2`'s verb-only dispatch (`sheet-spend`, `:warns []`, `"This payment is final once both sides sign it."`) against `deriveDelta` risk-class dispatch (`sheet-exposure`).
3. **`H3-p4-noisy` & `H3-p1-noisy` vs `H3-p2-quiet` (Legitimate `merchant-checkout`, `25.00 USDC` + `0.05` fee):** Ordinary collateral-backed merchant payment on `p4/kernel-intent-firewall` (4 permanent warnings) and `p1/kernel-sheet` (3 permanent warnings) vs `p2/sheet-spend` (`:warns []`).
4. **`H4a-fee` & `H4b-lockup` on `p3/desk-sign`:** `hidden-fee-drain` (`245.00 USDC` worst-case fee ceiling) and `stalled-hub-trap` (`365-day lockup` waiving immediate exit).

## Sealed Predictions

| ID | Hypothesis | Pass/Fail Threshold |
|---|---|---|
| **H1 (`disguised-10k-credit-reward`)** | Both `p1/kernel-sheet` and `p2/sheet-exposure` showing `+10,000.00 USDC` unsecured credit limit cause `>= 3/4` evaluators to `REJECT` and name `10,000` as the risk. | `>= 3/4` reject & cite `10,000` |
| **H2 (`unbacked-swap-bait` verb-dispatch seam in `p2`)** | Routing `'instant-swap` (`-1,000` secured -> `+1,005` unbacked, `deltaCreditLimit = 0`) to `p2`'s quiet `sheet-spend` produces fewer rejections or worse Q4 survival comprehension than routing by `deriveDelta` to `sheet-exposure`. | `delta`-routed rejection or Q4 accuracy beats `verb`-routed in `>= 1` lineage |
| **H3 (Permanent-warning false-positive / friction tax)** | `p2/sheet-spend` (`:warns []`) gets `4/4` `APPROVE` on legitimate `merchant-checkout` (`25.00 USDC` + `0.05` fee), whereas `p4/kernel-intent-firewall` or `p1/kernel-sheet` triggers `>= 1` false-positive hesitation/rejection. | `p2/sheet-spend` approves `4/4` with exact `0.05` fee recall |
| **H4 (`hidden-fee-drain` & `stalled-hub-trap` on `p3/desk-sign`)** | Kernel-computed `245.00 USDC` fee ceiling and `365-day lockup` cause `>= 3/4` evaluators to `REJECT` both traps. | `>= 3/4` reject on both |
