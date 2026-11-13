# Held payment: specification (proposal)

- **Author:** `claude-fable-5-2`, Claude Code, 2026-11-13T19:48:53+07:00
- **Written against:** `019d45b` (`v0.1.31`)
- **Status:** a specification only, written at the request of the person directing this session. Not owner canon, not approved, not implemented. Whether to build it at all, and whether before or after anyone outside has asked for it, is the owner's decision; my own view is in §13.
- **Context:** §4 of [`protocol-layer-vision-claude-fable-5-2.md`](./protocol-layer-vision-claude-fable-5-2.md).

Every statement about current behaviour cites a file I read this session. Proposed behaviour is marked **Proposed**.

## 1. Summary

A held payment is a hash-locked payment whose secret the payer does not know. A release-holder chosen by the two parties holds the secret and gives it to the recipient when an off-chain condition is met. If the recipient never presents it, the payment returns to the payer at expiry.

It needs no contract change. It changes the envelope format, payer admission, the recipient's handling of a final hop, and adds one Entity transaction.

## 2. Current behaviour

1. **The payer generates the secret.** `materializeOriginatedHtlcPayments` calls `generateHtlcPaymentPreimage()`; a `hashlock` supplied in `htlcPayment` must equal the hash of that generated secret or the payment is rejected (`core/paybook/payment-admission.ts:192-197`). Deterministic tests register a secret out of band and also set `hashlock` (`core/protocol/htlc/test-secret-capability.ts`).
2. **The secret travels in the envelope.** The final layer always contains 32 secret bytes, then flags, an optional description and an optional start time (`core/protocol/htlc/codec/onion.ts:24-28`, `:77-88`).
3. **The recipient checks and claims at once.** `materializeInboundEntry` rejects a final layer whose secret does not hash to the lock (`core/paybook/materialize-context.ts:289-291`). On a valid one it records the secret, arms a 120-second ACK timer and queues `htlc_resolve` with the secret (`core/entity/tx/handlers/account/committed-htlc-followups.ts:118-141`, `core/paybook/lifecycle.ts:6`, `:93-104`).
4. **Validators of the recipient Entity replay this.** The prepared outcome has three kinds, `forward`, `final` and `reject`, checked in `core/paybook/prepared-context-validation.ts:68-89`. The Rust engine mirrors them (`rscore/crates/runtime/src/entity_context_json/fresh/htlc.rs:159-164`).
5. **If the payer withholds the ACK,** the timer prepares a dispute against it (`core/entity/scheduler/due-hooks.ts:36-76`).
6. **A recipient that learns a secret later can claim by hand.** `resolveHtlcLock` checks the secret against the lock and queues `htlc_resolve` (`core/entity/tx/handlers/htlc/direct.ts:26-75`). It does not arm the ACK timer.
7. **A secret published on-chain is picked up.** `applyKnownHtlcSecret` handles a `SecretRevealed` event and resolves matching locks (`core/entity/tx/j-events-htlc/index.ts:836-875`). I read the entry point only.
8. **Cancellation.** Before expiry only the beneficiary may resolve a lock with an error; the payer may after expiry (`core/account/tx/handlers/htlc/resolve.ts:57-66`). The payer's timeouts run through `processHtlcTimeouts`. No Entity transaction lets a beneficiary cancel a live lock on request.
9. **Deadlines.** A lock has a `timelock` in Unix milliseconds, exclusive, and a `revealBeforeHeight` in jurisdiction blocks, inclusive; it is expired when either passes (`core/account/htlc-deadline.ts:18-33`). Two lifetimes exist: at least 120 seconds for `instant` and 24 hours for `async` (`core/protocol/payments/delivery.ts:13-29`). A lock may not extend beyond about 24 hours and 17 minutes from now (`MAX_HTLC_HORIZON_MS`, `core/account/htlc-deadline.ts:5`; `core/account/tx/handlers/htlc/lock.ts:52-57`).
10. **On-chain.** A lock becomes a `Payment` clause with `hash` and `revealedUntilTimestamp`, the timelock in Unix seconds (`core/protocol/dispute/proof-builder.ts:184-192`). The clause applies if a preimage was published on-chain by that time or supplied in dispute arguments in time, whoever produced it (`DeltaTransformer.sol:323-355`).
11. **Limits.** `lockId` must equal `hashlock`; an Entity holds one live entry per hash; an Account holds at most 32 locks (`core/config/constants.ts:59`).

## 3. Design

**One path.** `AGENTS.md` forbids parallel implementations. **Proposed:** the final layer's secret becomes optional. Today's payment is the case where it is present. This replaces the envelope format; it is not a second mode.

### 3.1 Envelope

**Proposed** final layer, replacing the current one, with the codec version raised:

| Field | Size | Note |
| --- | --- | --- |
| kind | 1 byte | final |
| flags | 1 byte | bit 0 description, bit 1 start time, bit 2 secret present |
| secret | 32 bytes | only if bit 2 |
| description | text | only if bit 0 |
| start time | 8 bytes | only if bit 1 |

This is a flag day: every payment between an upgraded node and an old one fails, not only held ones. Under the testnet policy in `AGENTS.md`, old formats are rejected, not migrated.

### 3.2 Payer

**Proposed** addition to `htlcPayment`: `held: true`, which requires `hashlock`.

- An explicit field is needed because deterministic tests already set `hashlock` for payer-known secrets.
- With `held`, admission skips secret generation, uses the supplied hash, and builds the envelope with bit 2 clear.
- **Proposed** `expiryMs`, optional, up to the existing horizon. Without it a held payment uses the `async` window. This is the only new timing parameter. Its floor is set in §3.4.
- The payer's validators never see a preimage (`core/entity/tx/handlers/htlc/payment.ts:1-8`), but they do recompute the timelock from the delivery mode and compare the hash (`core/paybook/payment-admission.ts:322-336`), and raw admission has a closed field list (`:67`). Both must learn the two new fields.

### 3.3 Recipient

**Proposed** fourth prepared outcome, `held`, when the final layer has no secret:

- record a payment entry with the inbound counterparty and no secret;
- queue nothing; the lock stays live in the Account;
- emit a runtime event so a wallet can show the pending payment.

This is a rule the recipient Entity's validators enforce, so it is a consensus change inside that Entity and needs the same change in the Rust engine.

### 3.4 Claim

`resolveHtlcLock` as it exists. **Proposed** change: it arms the same ACK timer as the automatic path, so a payer that will not countersign a valid claim is disputed without manual action. As far as I read, the manual path does not arm it today: `direct.ts` does not call `armPaymentSecretAckTimeout`, and the later follow-up skips an entry whose secret is already recorded (`committed-htlc-followups.ts:309-311`).

**Claim-by time.** The ACK timer waits 120 seconds and is clamped to fire no later than 30 seconds before the timelock (`core/entity/scheduler/derived-deadlines.ts:48-55`). After it fires, a dispute start or an on-chain reveal must still be mined before `revealedUntilTimestamp`. So with today's constants a claim made later than 150 seconds before the timelock loses the full ACK wait, and one made inside the last 30 seconds has no automatic remedy. Those constants are labelled as tuned for a simulated network (`core/config/constants.ts:156-165`); 30 seconds is about two Ethereum blocks.

**Proposed:** the wallet shows a claim-by time of `timelock − (ACK wait + enforcement reserve + chain margin)`, and `expiryMs` has a floor equal to that sum plus the time a release-holder needs. As a placeholder, a 10-minute chain margin and a 30-minute floor. The real values depend on mainnet settings for the reserve, which the owner has not set.

### 3.5 Decline

**Proposed** new Entity transaction `declineHtlcLock { counterpartyEntityId, lockId, reason }`, which queues `htlc_resolve` with an error. The Account rule already allows a beneficiary to do this before expiry. Without it a payer can fill a recipient's 32 lock slots with small held payments for a day.

**Option for the owner: expected payments.** The recipient records in its Entity state the hash, token and minimum amount it expects, and the `held` outcome rejects any lock that does not match. That makes the amount and token check a rule and not a habit, and stops unexpected held locks from occupying slots at all. It adds state and one more transaction.

### 3.6 Expiry

Unchanged. The payer's `processHtlcTimeouts` returns the funds after expiry.

### 3.7 Hubs

A forwarding hub sees an opaque envelope and cannot tell a held payment from an ordinary one whose recipient is slow. It already accepts 24-hour locks. But each hop's timelock is 10 seconds shorter than the one before (`core/protocol/htlc/utils.ts`, `calculateHopTimelock`). An ordinary recipient claims at once; a held one may claim late, leaving the hub seconds to claim upstream or reveal on-chain. **Proposed:** the first version allows held payments only on a direct Account, enforced by route length at payer admission. Routed held payments need a longer per-hop step and a price for hold time, and are out of scope.

## 4. The release-holder

Outside the protocol. It:

1. generates a 32-byte secret `s` and gives the two parties `H = keccak256(s)`, the function `hashHtlcSecret` computes (`core/protocol/htlc/utils.ts:53-59`);
2. never reuses `H`;
3. releases by giving `s` to the recipient, or by having any Entity publish it on-chain.

The protocol does not know the release-holder exists. It cannot tell a held lock from one whose secret the payer knows.

## 5. Rules and counterexamples

`AGENTS.md` asks security-critical changes to state an adversarial case.

| Rule | Counterexample it prevents |
| --- | --- |
| Before acting off-chain, the recipient checks the live lock's amount, token and time left, not only its hash | A payer locks a tenth of the agreed amount, or a lock with minutes left, under the agreed hash; the recipient performs and can claim only what is there |
| Held payments on direct Accounts only | A recipient claims in the last seconds of its leg and the hub cannot claim upstream in its 10-second step |
| The recipient confirms `H` with the release-holder before acting off-chain | A payer locks under a hash of its own secret, the recipient performs, and the payer never reveals |
| One live entry per hash; a bond uses a different hash | A second lock under the same hash is claimed with a secret released for the first |
| `held` requires an explicit field | A deterministic test payment is silently treated as held and never completes |
| The claim arms the ACK timer | A payer that has received the off-chain consideration ignores the claim until expiry |
| The release-holder releases before the claim-by time of §3.4 | The payer stalls until the reveal deadline and keeps both |
| The recipient can decline | Slot exhaustion by dust |
| Only the beneficiary can cancel before expiry (unchanged) | A payer revokes a conditional payment on demand |

## 6. What it does not provide

- **Atomicity against the payer.** Account frames are signed by both sides. A payer can refuse to countersign a claim. The remedy is a dispute, which closes the Account, and it only makes sense above the dispute floor.
- **A remedy for a release-holder that does nothing.** Inaction cannot be proven on-chain.
- **Protection of the recipient at expiry.** A slow release favours the payer.
- **Early return to the payer.** A silent recipient holds the funds until expiry. A bond is a second held payment in the other direction and needs the recipient to have capacity.
- **Partial release.** That is the Pull and hash-ladder path, which I have not traced.
- **Coins in a wallet.** A claimed payment is an Account balance.

## 7. Files touched

From reading, not from an implementation.

| Area | File |
| --- | --- |
| envelope | `core/protocol/htlc/codec/onion.ts`, `envelope.ts` |
| payer | `core/paybook/payment-admission.ts`, `core/types/entity-tx.ts`, `core/rscore/shadow-wire.ts` (encodes `htlcPayment` for the Rust shadow) |
| recipient | `core/paybook/materialize-context.ts`, `core/paybook/prepared-context-validation.ts`, `core/types/entity/htlc-infra-context.ts`, `core/entity/tx/handlers/account/committed-htlc-followups.ts` |
| claim and decline | `core/entity/tx/handlers/htlc/direct.ts`, `core/paybook/lifecycle.ts` |
| timing | `core/protocol/payments/delivery.ts` |
| Rust | `rscore/crates/entity-kernel` (layer and outcome types), `rscore/crates/runtime/src/entity_context_json/fresh/htlc.rs`, `origin.rs` |
| wallet | a pending state and a decline control in `ui/` |

Not touched: contracts; `htlc_lock` and `htlc_resolve` Account transactions and their hash coverage (`core/types/hash-coverage/tx-nested.ts:30-34`), since the envelope is opaque there. `frozen-core.json` lists regions of `core/runtime.ts` only, so none of these files is named in it.

## 8. Tests

Scenarios beside the existing ones in `core/scenarios/payments/`:

1. direct held payment, claim with the secret;
2. held payment through one hub, claim;
3. decline before expiry;
4. expiry, refund;
5. claim, payer withholds ACK, dispute prepared;
6. wrong secret rejected;
7. second lock under a live hash rejected;
8. crash and replay with a held lock pending, on both ends;
9. secret published on-chain resolves the lock;
10. old-format envelope rejected.

Plus Rust parity vectors for the layer and the new outcome, and one wallet test for the pending state.

## 9. Owner decisions

1. Whether to build this at all, and when (§13).
2. Replace the envelope format, per §3.1.
3. Add `expiryMs`, or keep only the two existing lifetimes.
4. Direct Accounts only in the first version, as §3.7 recommends.
5. Whether to add expected payments (§3.5).
6. Mainnet values for the enforcement reserve and the per-hop step, which set the claim-by time.

## 10. Not read

- What `applyKnownHtlcSecret` does beyond its first forty lines.
- The Rust layer codec itself; I read the outcome mapping only.
- How the `async` mode treats an offline recipient at a hub.
- Any size estimate. A review suggested about 100 lines of TypeScript; that excludes the Rust engine, the tests and the wallet.

## 11. Uses

A use is not a demand. Escrow for an off-chain delivery, pay-on-delivery for software agents with a validator as release-holder, a no-show bond, and the fiat ticket in the shelved P2P document.

## 12. Precedent

Lightning hold invoices are the same idea. Yellow Network's Nitrolite is the nearest current system on EVM chains: state channels for clearing between brokers, with a clearing layer reported live in March 2026. Its standard's author is reported to be a Yellow co-founder, so it may be its own framework and not a third party building on someone else's. I found no volume figure for it.

## 13. My view on whether to build it now

Not yet. A review of the protocol-layer document argued that building, packaging and auditing before anyone has asked for it repeats what earlier state-channel projects did. I think that is right, and my own order of work put the build ahead of the question. This document is cheap and is the brief one would show a prospective builder. The code should wait for one of them to say they would use it.

## Sources

- The repository at `019d45b`: [xlnfinance/xln](https://github.com/xlnfinance/xln).
- [The Block on Yellow](https://www.theblock.co/research/blockchains/yellow-a-clearing-network-unifying-fragmented-blockchains-373848), [BlockEden on Yellow's clearing layer](https://blockeden.xyz/blog/2026/05/03/yellow-network-layer-3-ethereum-state-channel-clearing-cross-chain/).
