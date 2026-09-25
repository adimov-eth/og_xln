# account-tx: og per-transaction Account transitions vs pure/xln.ts

Tests: `pure/diff/account-tx.test.ts` (run from `pure/`: `bun test diff/account-tx.test.ts` → 26 pass). Each `DIVERGES:` test calls the og handler and the rewrite `applyAccountBody` on the same input and passes only when the difference is present.

## Catalog mapping (from ast-grep of `core/account/tx/mutation.ts:196-240` switch vs `xln.ts:1176-1281` `applyArm`)

| og tx (catalog.ts:4-26) | rewrite arm | status |
|---|---|---|
| add_delta | add_delta (1178) | MATCH |
| set_credit_limit | set_credit_limit (1179) | MATCH |
| direct_payment | payment (1180), wire `direct_payment` (1564) | DIVERGES (bounds) / MISSING (route, trusted gateway) |
| htlc_lock | htlc_lock (1181) | DIVERGES |
| htlc_resolve (secret / error) | htlc_resolve (1188) + htlc_timeout (1195) | DIVERGES |
| swap_offer | swap_offer (1202) | DIVERGES |
| swap_cancel_request | swap_cancel (1209) | DIVERGES |
| swap_resolve | swap_resolve (1213) | DIVERGES |
| settle_transition (upsert/submit/clear/hanko) | settle_transition (hanko only, 1280) | DIVERGES / MISSING |
| j_event_claim | j_event_claim → claimJ (1166) | DIVERGES |
| cross_pull_lock / cross_pull_close | refused as hole `cross_open` (1277-1278) | MISSING |
| request_collateral / rebalance_refund / rebalance_policy | different vocabulary: set_rebalance_policy, rebalance_request/quote/accept, deposit_collateral (1229-1259) | MISSING (og) + EXTRA (rewrite) |
| lending_* (6 kinds) | not account txs (entity-level pool, xln.ts:2376+) | MISSING |
| — | deposit_to_custody / withdraw_from_custody / hub_custody_debit (1226-1228) | EXTRA |
| — | subcontract_* (1260-1276) | EXTRA |

## Findings

| id | severity | og file:line | rewrite xln.ts:line | what differs | proven by test? |
|---|---|---|---|---|---|
| AT-1 | critical | core/protocol/htlc/utils.ts:73-79; handlers/htlc/resolve.ts:183 | 1191 | HTLC hashlock: og = keccak256(32-byte secret) (on-chain convention); rewrite = keccak256(utf8 of the secret string). A lock made with an og/on-chain hashlock can never be resolved by the rewrite with the real secret (rejected `preimage`). | yes: "hashlock function" |
| AT-2 | critical | handlers/htlc/resolve.ts:175-180; htlc-deadline.ts:18-23 | 1188-1193 | A secret reveal after expiry (jHeight > revealBeforeHeight or timestamp >= timelock) is refused by og but accepted by the rewrite, so the beneficiary is paid after the upstream hop may already have timed out. Money moves to the wrong party. | yes: "secret reveal after revealBeforeHeight" |
| AT-3 | critical | handlers/swap/resolve/validation.ts:147-149, 203-228, 150-151 | 900, 1219 | Swap fill: the rewrite floors both legs from `fillRatio` on their own (`give=floor(G·r/65535)`, `want=floor(W·r/65535)`). og needs explicit execution amounts for any non-zero ratio and enforces `filledWant·qGive ≥ filledGive·qWant`. Its own limit path rounds want **up**. On an offer of 2 for 3 at r=32768, the rewrite settles 1 for 1, which is below the maker's limit price, and og rejects that execution. | yes: "fill below maker limit price" and "og requires explicit execution amounts" |
| AT-4 | high | handlers/swap/lifecycle/cancel.ts:23-51 | 1209-1212 | og `swap_cancel_request` only emits a request: the offer and its hold stay until the counterparty's `swap_resolve`. The rewrite `swap_cancel` deletes the offer and frees the hold at once. The maker can therefore pull an offer from under a hub fill that is in flight. | yes: "swap_cancel" |
| AT-5 | high | handlers/swap/resolve/validation.ts:128-130 | 1095, 1108-1109 | Resolver authority: og lets any non-maker counterparty resolve and forbids the maker. The rewrite allows only the designated `hub`. So an account with hub=null can never resolve, and a hub that is the maker can resolve its own offer. | yes: "resolver authority" |
| AT-6 | high | handlers/swap/resolve/validation.ts:303 | 1222 | `fillRatio=0` with `cancelRemainder=false`: og treats it as a cancel (effectiveCancelRemainder), closes the offer and releases the hold. The rewrite keeps the offer open. | yes: "fillRatio=0" |
| AT-7 | critical | j-claims/j-claim-transition.ts:214-221; tx/handlers/j-events/finality.ts:166-173 | 1166-1175 | A stale j_event_claim (jHeight ≤ lastFinalizedJHeight) is a no-op in og. The rewrite accepts it and, once both sides submit it, finalizes again: collateral/ondelta roll back to the older values and `finalizedJHeight` goes down. The rewrite also has no AccountSettled nonce-regression check, and jNonce is fixed at 0 (1388). | yes: "stale j_event_claim" |
| AT-8 | high | j-claims/j-claim-transition.ts:229-255 | 1167-1169 | The rewrite remembers only the latest claim per side (`leftJ`/`rightJ`) for matching. A peer claim at an older height that is still pending never finalizes. og finalizes by accumulator membership at any pending height. The rewrite also stores a peer-side conflicting record as pending, where og rejects it (`exactMemberConflict`, :115-116). | yes: "peer claim at an older pending height" (conflict case by code reading) |
| AT-9 | high | tx/handlers/j-events/finality.ts:28-34 | 1171 | An AccountSettled event for a different left/right pair makes og throw `ACCOUNT_SETTLED_PAIR_MISMATCH`. The rewrite filters it out without error and still finalizes the height (`sameAccount` is also case-sensitive, 1139). | yes: "different account pair" |
| AT-10 | high | tx/handlers/settlement/transition.ts:251-262, 324-399, 650-720 | 1280 | settle_transition: og checks the hanko tx against the live workspace (revision, workspaceHash, exact nonce, recomputed settlementHash, postProof nonce = N+1, hanko signatures). The rewrite checks none of these: with no workspace at all it stores `settlementHash`, which changes the committed root. The upsert/submit/clear kinds and their hold add/release (transition.ts:152-229) are MISSING; `chargeSettlement` (935) is never called from the account fold. | yes: "settle_transition(hanko) with no workspace" |
| AT-11 | medium | tx/mutation.ts:188-194; transition.ts:636-648 | — | og freezes an Account once a settlement workspace is signed (`SETTLEMENT_SIGNED_ACCOUNT_FROZEN`), allowing only j_event_claim and settle hanko/submit. The rewrite has no freeze, so payments and locks can move balances under a signed settlement. | code reading |
| AT-12 | medium | handlers/htlc/lock.ts:42-47 | 1181-1187 | og refuses to lock an HTLC whose timelock has already passed (timestamp ≥ timelock) or whose revealBeforeHeight ≤ jHeight. The rewrite accepts both. | yes: "already-expired timelock" |
| AT-13 | medium | handlers/htlc/lock.ts:40 | 1182 | og requires lockId == hashlock. The rewrite accepts any lockId and rejects a duplicate hashlock instead. | yes: "lockId must equal hashlock" |
| AT-14 | medium | handlers/htlc/lock.ts:73-81 (LIMITS.MAX_ACCOUNT_HTLC_LOCKS=32) | 1181-1187 | og caps an account at 32 live HTLCs (a capacity rejection, which is retried). The rewrite has no cap. | yes: "33rd live lock" |
| AT-15 | medium | handlers/htlc/resolve.ts:199-211 | 1195-1201 | og lets the beneficiary cancel (`outcome:error`) before expiry, and the payer after `timestamp >= timelock` even while jHeight ≤ revealBeforeHeight. The rewrite has only `htlc_timeout`, which is jHeight-only, for anyone, and after expiry only. Early refunds and timestamp expiry are impossible. | yes: "beneficiary may cancel" and "timestamp timelock expiry" |
| AT-16 | medium | handlers/balance/direct-payment.ts:134 (UINT256_MAX); lock.ts:49-51 | 922, 957 | Payment ceiling: og accepts amounts up to 2^256-1 when capacity allows. The rewrite `move` refuses anything above 2^128-1 (`payment_too_large`), even with enough capacity. This covers payment and deposit_to_custody; HTLC lock and swap have no upper bound in the rewrite. | yes: "payment above 2^128-1" |
| AT-17 | medium | handlers/swap/offer/admission.ts:115-117, 54-56, 58-69; quantization.ts:354-411 | 1202-1208 | swap_offer admission: og refuses a same-token swap, a ':' in offerId, and more than 50 offers or the per-market caps. It also enforces decimals, lot-size quantization, priceTicks, and maxFee/minNetReceive authorization. The rewrite has none of these. It stores raw amounts and adds `minFillRatio`/`expiresAtHeight` (EXTRA: og SwapOffer, types/account.ts:64-83, has neither). | yes: "same-token", "offerId containing ':'" |
| AT-18 | medium | handlers/swap/resolve/validation.ts:233-257; remainder.ts:400-473 | 1219-1223 | Taker fee (feeAmount/feeTokenId) is MISSING. Partial-fill remainder: og re-quantizes the remainder to lot size at the canonical price and releases the dust hold. The rewrite subtracts the floored legs, so the resting remainder amounts differ. | code reading |
| AT-19 | low | handlers/balance/direct-payment.ts:141-157, 194-226, 245-278 | 1180, 1564 | The route, deliveryMode and trusted-gateway checks and the `directPaymentForward` effect are MISSING. The rewrite payment has no route, and its wire form is always `deliveryMode:'direct'`. | code reading |
| AT-20 | low | j-events/finality.ts:56-66 | 1171-1174 | og reduces `requestedRebalance` by the collateral increase when AccountSettled finalizes. The rewrite leaves `request` untouched. | code reading |
| AT-21 | low | tx/mutation.ts:183-186 | — | The og dispute-status guard (`closedForDisputeRejection`) sits at tx level. In the rewrite it lives only at the replica phase level and is not re-checked per tx. | code reading |
| AT-22 | info | handlers/rebalance/*, handlers/balance/lending.ts, handlers/settlement/pull.ts | 1226-1276 | The rebalance, lending and cross-pull tx kinds are MISSING or replaced by rewrite-specific kinds (custody, quote/accept, subcontract). They cannot interoperate with og peers on the wire. | n/a |

## Coverage (checked, MATCH)

- **deriveDelta outCapacity** (utils.ts:26-61, 135-162) equals `outCapacity` (xln.ts:931-933) for both sides. The test covers a 5×5×5×5×2 grid including negative delta and holds. Right = max(c+R−t,0), left = max(t+L,0), and holds are subtracted with a floor at 0.
- **set_credit_limit** (set-credit-limit.ts:68-99 vs xln.ts:961-962): the proposer writes the counterparty's field (byLeft → rightCreditLimit). Both reject values below 0 and above 2^256-1.
- **Payment capacity refusal** (direct-payment.ts:297-303 vs xln.ts:953-958): an over-capacity payment is refused by both, and exactly-at-capacity is accepted by both. Sign is the same (left pays negative), and holds reduce room identically.
- **HTLC**: secret resolve moves offdelta by the sender's sign and releases the hold (resolve.ts:221-233 vs 1193). A lock's capacity check includes existing holds (lock.ts:96-103 vs 1186). jHeight == revealBeforeHeight is not expired for a timeout in either (the rewrite refuses it as a `reveal_before_height` hole).
- **swap_offer capacity** includes existing holds (commit.ts:207-214 vs 1207).
- **Token-row cap** of 128: `LIMITS.MAX_ACCOUNT_TOKEN_ROWS` (state/delta.ts:62) equals `MAX_ROWS` (1020, 1294). The tokenId range is 0..65535 on both sides (units.ts:452 / xln.ts:258).
- **Maker-only cancel authority** (cancel.ts:454 vs 1211) and **counterparty capacity for the want leg** (settlement.ts:488-503 vs `spend`, 1220).
