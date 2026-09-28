# Adversarial review — pure/xln.ts

Pinned SHA: `0d3a097b782b65b08358299fa0419e65498edc57`. Read-only static review; no production mutation or heavy test. Scope: hostile boundary values, codec/certificate authority, fail-soft behavior. Existing held ACK-frame retry and J-history prune findings were excluded.

**Primary-review adjudication:** the wallet-list observation below also holds in the old implementation, `core/jurisdiction/machine/event-normalizers-wallet.ts:30-68`. Its proposed pure-only rejection would break malformed-input parity and is not endorsed as a compatibility-preserving fix. Tightening this boundary is a shared policy decision requiring explicit authorization, a coordinated canonical change, and a named parity/regression vector. Do not change the reference implementation merely to manufacture a passing comparison. The reviewer's original observation is retained below for context.

## Concrete finding

1. **Malformed wallet snapshot arrays are accepted as empty arrays** (P2, lines 32502–32510, 32526–32542, 32632–32639). `decodedEntries` maps `(Array.isArray(v) ? v : [])`, so `tokenBalances: { ... }` or `allowances: "..."` yields `[]` instead of `null`. `walletSnapshot` then omits the empty list and `normalizeJEvent` accepts the `ExternalWalletSnapshot` as a valid event. The strict J-range path uses this same normalizer in `canonicalJEvents` (32787–32800, 33525–33545); hashes certify the normalized event. The event is then applied to external-wallet state by `externalWalletJEvent` (37328–37347). Proposed minimal change: have `decodedEntries` return `null` when `v` is not an array, then add a named malformed-`ExternalWalletSnapshot` vector through the J block boundary. Impact depends on whether a malformed raw wallet event can reach the watcher/peer path; the parser itself accepts it. No fabricated on-chain receipt was demonstrated.

## Additional fail-soft concern (conditional reachability)

2. **A failed Account subroot is replaced by `ZERO_WORD`** (P2 if corrupt policy/submittedAt data is reachable, lines 27007–27008). `installedAccount` returns a successful leaf when `mapRoot(rebalancePolicy)` or `submittedAtRoot(body)` refuses encoding, even though these roots enter `entityRootOf` at line 27074. This can certify an entity root that does not commit the offending Account data. Proposed change: sequence both `Result` roots with `headLink` and `committedView`, propagate an `account_envelope` error, and add a corrupt committed-value vector. Evidence limit: this review did not establish a legal transaction path that creates an unencodable policy or submittedAt value; it is a corruption/recovery fail-stop issue rather than a proven remote exploit.

## Cleared or bounded candidates

- `liveLadder` drops conflicting existing claims (39404), but admission checks new claims via `claimLadder`. I did not show that two conflicting existing claims are reachable under successful canonical admission, so I do not label it an exploit.
- Hanko decoding's `NO_HANKO` fallback is followed by canonical re-encoding and a required nonempty claim in `decodedAccountHanko` (about 3580–3592). No forged certificate acceptance found there.
- The J range checks exact block fields, event order, coordinates, and claimed events hash (33507–33580), and Account Hanko checks signatures, quorum, claim reachability, and board authority (about 3550–3650). These provide useful containment around the noted boundaries.

## Handoff

SHA: `0d3a097b782b65b08358299fa0419e65498edc57`.
Last green (parent): 79 tests / 6687 assertions and pure TypeScript check.
First red (parent): `bun run check` missing `forge-std`; siblings cancelled.
Artifact: `pure/xln.ts`.
Next single command: scoped test of malformed `ExternalWalletSnapshot` at the J block boundary.
Remaining gates: parent independent verification, production path, `bun run check` when environment restored.
