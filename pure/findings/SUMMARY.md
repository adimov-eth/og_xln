# xln.ts vs og core: equivalence summary

Baseline: og = adimov-eth/og_xln @ 566c850 (2026-09-23). Note the rewrite's docs pin xlnfinance/xln @ dc4b000
(2026-09-04), which is not in this repo; some encoding differences (Int512, SignedAmount) may be upstream
changes after that pin. Everything below is against the og code as it is in this repo today.

Verdict: NOT 100% equivalent. 127 differential tests (pure/diff + oracle) pass; each DIVERGES test asserts
the observed difference by running og code and xln.ts on the same input.

## Critical (money, consensus or hash mismatch)
| id | area | og | xln.ts | difference |
|---|---|---|---|---|
| H1 | hash | Types.sol:150, proof-body.ts:127 | :489 | ProofBody offdeltas are Int512 on chain, int256 in rewrite: dispute proof hash differs for any account with a token |
| H2 | hash | Types.sol:97, onchain-domain.ts:159-199 | :490, :589 | SettlementDiff is SignedAmount (bool+uint256), rewrite uses int256: cooperative update hash differs |
| H3 | hash | encodeJBatch | encodeBatch :505 | follows from H1/H2 for batches carrying diffs or proof bodies |
| H4 | hash | Account.sol AccountSettled | :510 | event topic0 differs, readJEvents drops every real AccountSettled log |
| AT-1 | account tx | protocol/htlc/utils.ts:73 | :1191 | HTLC hash of 32-byte secret vs keccak of UTF-8 text |
| AT-2 | account tx | resolve.ts:175-180 | :1188-1193 | expired HTLC secret still pays out |
| AT-3 | account tx | swap validation.ts:147-228 | :1219 | swap fill ignores maker limit price |
| AT-7 | account tx | j-claim-transition.ts:214 | :1166-1175, :1388 | stale j_event_claim re-finalizes and rolls collateral back; jNonce stuck at 0 |
| ER-1 | entity | leader/index.ts:34-60, factory.ts:108 | :2194, :2205 | proposer = validators[0] vs lowest address |
| ER-2 | entity | state-root.ts:347-370 | :2280-2304 | validators sorted before authority root hashing |

## High
AC-1 frame timestamp not clamped to previous frame (frame hash differs); AC-2 local tx during pending frame refused
instead of queued; AT-4 swap_cancel immediate; AT-5 swap resolver rules; AT-6 fillRatio 0; AT-8/AT-9 j-claims;
AT-10 settle_transition unvalidated; H5 settlement workspace missing from account state root; H6 entity state root
commits 3 sections vs all fields; ER-3 output routing signer; ER-4/5/6 precommit shape, proposer self-sign,
no validator replay; ER-7 one bad entity tx rejects whole input.

## Matches (proven)
Capacity/deriveDelta (2,500 cases), credit limits, payment sign, canonical RLP (500), map root (400), account frame
hash (300), entity frame hash (200), Hanko lazy id/65-byte/envelope, verifyAccountHanko (300), collision left-wins,
duplicate ACK idempotency, all six dispute-Hanko checks, threshold >= on weighted shares, positional output order.

## Oracle
- Runs (19/19) but fails tsc: duplicate imports (applyEntityInput, createEntity) and ~25 brand errors.
- Only 3 og functions are called live (deriveDelta, isLeftEntity, deriveTransferOffdeltaChange); the rest are
  constants or rewrite-vs-itself. All hardcoded goldens do come from og functions, but the entity state roots
  0x1a37f4d7/0x72ac0104 use a synthetic state og never produces (H6).
- Its HTLC test passes only because of AT-1 and AT-12 (non-hex secret, timelock 0).
- It imports og from an absolute /Users path and ../src/id.ts from xln-pure; not portable.

Details per area: account-tx.md, account-consensus.md, hashes.md, entity-runtime.md.
