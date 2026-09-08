# Frontend and ui coverage

Updated 2026-09-09. Keep both interfaces, as requested by the owner. Full feature parity and release readiness remain unproven.

## Verified on the live stand

- Fresh wallet on a long chain, account opening, payment and persistence after reload.
- Home faucet: one click credits exactly 100 USDC to the Account, surviving reload.
- Tutorial: faucet, 25 USDC payment, executed swap, history. Two E2Es start before and after funding; each issues exactly one faucet request, without acknowledgement clicks.
- Repeat H3 payment after 90 seconds idle: 100 to 75 to 50 USDC. Originated HTLC deadlines use the candidate frame clock and preceding certified J range, rather than the old parent clock.
- Same-jurisdiction swap: actual amounts and fees match canonical calculations.
- Move reserve to collateral: both Account sides conserve exactly 100 USDC.
- Clean tower restore: matching canonical Runtime roots, Account state and balances; existing local storage is preserved.
- Protection appointment: tower receipt acceptance and fields, signed evidence export. Automatic execution remains unverified.
- Watcher: authenticated header progress is recorded promptly for payment safety. Header observations may create Runtime WAL frames, but never empty Entity financial frames. The earlier 100-block recording throttle was unsafe for 50-block HTLC deadlines and has been removed.

## Implemented with incomplete acceptance

- Activity: filters, dates, cursors, CSV, both swap legs, on-chain events and Account history execution reads. HTLC recipients use canonical hashlocks; the local intent cache is removed. Equal direct payments are not merged by amount.
- Formation: lazy/numbered entities, board weights and threshold. Ownership exposes actual weights and full identifiers.
- Networks: RPC/contract import validates chain IDs and deployed code.
- Push: shared Web Push registration/revocation with frontend. Push and automatic sweep are disabled on this stand and reported in the UI. Notification delivery remains unverified.
- AccountDetail and Settings are split into components; financial operations remain in canonical APIs.
- Home revamp: a single primary balance, local zero-asset expansion, compact account connections and expandable verification details. Pending and failed payments remain distinct from settled payments.

## Remaining acceptance

1. Cross-jurisdiction swap, clear/cancel, history after restore and page boundaries.
2. Joint-signature settlement, batch, dispute and finalization on an isolated stand.
3. Lending/debt, shares/takeover, Formation and network import: complete user journeys.
4. Entity switching, invoices/receiving and every Move route, each verified separately.
5. Configured tower: automatic dispute response and actual push delivery.

History searches cover a storage window; cursors read older windows. Receipt/UI exports are not full dispute proofs. The short tutorial does not gate every financial feature; dedicated E2Es must cover them.

Outside wallet parity: QA/HLT panels, 3D/VR, marketing, release and administration tools. This does not authorize their removal.
