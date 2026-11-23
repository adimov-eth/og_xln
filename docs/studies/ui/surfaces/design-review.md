## Design Document Review: XLN Wallet Signing Sheets, Surface Boundary, and Client XLN Programs

### Summary

approve. `byLeft` is `isLeftEntity(entityId, counterpartyEntityId)` of the two account parties. `toEntityId` accepts only `0x` plus 64 hex, so `openFirstHubAccount`'s runtime id (`hosted.ts:348`) cannot be that argument. A left proposer writes `rightCreditLimit` and a right proposer writes `leftCreditLimit` (`set-credit-limit.ts:31-35`); from either entity that write raises `viewDelta(...).peerCreditLimit`. Sign-time `htlcPayment` copies the current `Delta`. `handleHtlcLock` (`lock.ts:69`) runs only when a prepared `htlc_lock` is already on the submit: it `addHold`s (`lock.ts:140`), commits that delta (`lock.ts:146`), and leaves `offdelta` unchanged. That hold sets neither `holdIncreased` nor `deadlineMs`. C7 stays `spend`: amount `wholeUsdToTokenAmount(tokenId, 25n)`, headroom `usdMicrosToTokenAmount(tokenId, 50_000n)`, finality set, survival null. A missing prepared context is the Pay path. Fee headroom, `secureCause`, the Svelte ingress, Open Product Forks, and Phase A before Phase B are unchanged.

### Strengths

- `handleSetCreditLimit` is called with the same entity pair production already uses (`open-account.ts:205`, `account-work-flags.ts:27`). A2 locks the either-entity `peerCreditLimit` rise and the throw on a `0x` plus 40 hex runtime id. `deriveDelta` (`utils.ts:30-31`, `73-74`) is what makes the counterparty field the viewer's `peerCreditLimit`.
- C7's after-`Delta` is the current `Delta`. `payment.ts:30-37` is where `hashlock`, `timelock`, `revealBeforeHeight`, and `senderLockAmount` appear, on a prepared `htlc_lock`. The coffee row stays `spend` with finality set and survival null.
- The `htlcPayment` fee line is the raw headroom `maxSenderDebit - amount`, labeled "Up to". `directPayment` is `kind: 'none'`. `secureCause` `'self'` is the signer's own `r2c`; `'counterparty'` is `requestCollateral`.
- Svelte consent is inside `submitActiveRuntimeInput`, `submitActiveCrossJurisdictionIntent`, and `dispatchRuntimeInputToRuntimeEnv`, with the presenter mounted from `UserModePanel.svelte` and `EntityPanelWrapper.svelte`. React `authorizeSubmit` runs before the embedded `adapter.send`.
- Five classes, `deriveDelta` exposure ahead of `term` (including instant-swap), separate finality and survival sentences, per-lane lines, and the Hanko short-of-threshold line remain. Fork A is still only `todo.md:82`. Fork B stays open. A1 and A2 merge independently. A3 depends on A2. Phase B follows A3. No frozen-core edit.
