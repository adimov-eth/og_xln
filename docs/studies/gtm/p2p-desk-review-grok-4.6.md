# Review: P2P desk vision (claude-fable-5-2)

- **Reviewer:** grok-4.6 · Grok Build CLI · `2026-11-14`
- **Subject:** [`p2p-desk-vision-claude-fable-5-2.md`](./p2p-desk-vision-claude-fable-5-2.md) (revision 2, `019d45b`)
- **Status:** one model's verdict. Not owner canon. Does not edit the subject file.
- **Related (added 2026-11-19):** the subject's companion designs [`held-payment-spec-claude-fable-5-2.md`](./held-payment-spec-claude-fable-5-2.md) (D025) and [`p2p-extension-design-claude-fable-5-2.md`](./p2p-extension-design-claude-fable-5-2.md) (D028) · the same "nuclear switch" finding in [`pure-xln-protocol-critique-2026-11-18.md`](./pure-xln-protocol-critique-2026-11-18.md) §3.2 · filed in [`chat.md`](./chat.md) D031.

---

## Verdict

The document glues two products. A standing Account between desks is XLN. A fiat ticket with a third-party hash lock is OpenPeer / RoboSats, seated on an HTLC this tree was not built to carry. The second product destroys the first at the moment the lock is actually needed.

Keep desk–desk and desk–broker Accounts. Do not build the ticket until (a) failure of one ticket does not close the Account and (b) the release-holder is a repeatable payment check, not a person. Both are a new protocol choice. They are not a small HTLC tweak.

---

## What the code actually matches

The HTLC citations in the subject are mostly right.

- Before expiry, only the beneficiary may cancel (`core/account/tx/handlers/htlc/resolve.ts:63-66`).
- The payer's runtime currently generates the secret (`core/paybook/payment-admission.ts:192-197`). The onion final layer carries it. The recipient rejects a secret that does not match the lock (`core/paybook/materialize-context.ts:289-291`).
- In dispute, `DeltaTransformer` settles a payment clause on any preimage of the hash, with no check on who produced it (`DeltaTransformer.sol:323-355`, `revealSecret` at `:442-454`).
- A dispute closes the Account. Response windows are the sum of the two sides' seconds (`Account.sol:1786-1789`).
- `ASYNC_PAYMENT_EXPIRY_MS` is 24 hours (`core/types/finance/payment.ts`).
- Capacity is per token per Account; collateral is consumed before credit (`core/account/utils.ts:28-55`, `Depository.sol` collaterals).

“Contracts need no change” is true for *reveal*. It is false for the *product*. The product needs a payment whose secret the payer does not know. That is a new kind: both TS ends, wire parity, owner confirmation (`AGENTS.md`). It is not a patch to admission.

---

## The load-bearing break

An Account is a standing line. A dispute is a nuclear switch: the line dies, exit takes a day or more, then the pair opens again.

The ticket is for the case where the seller already holds the fiat and will not countersign the claim. The stated remedy is on-chain reveal plus dispute. One stalled ticket then kills the inventory line between two desks. For the desk–desk relationship the vision puts at the centre, that is the working failure, not an edge.

While the ticket lives only under cooperation, the lock is weaker than Telegram. When cooperation ends, the lock is stronger than Telegram at the price of the whole line. That is not how a P2P desk line is run.

Rung 1 (seller = release-holder) is not a product. The seller can already refuse to release after seeing fiat. The buyer gets “coins are reserved” and the same refusal, plus a window in which the coins are frozen. The author already deleted a no-lock first rung because a desk has no reason to deposit in order to send unlocked payments to someone it already trusts. Seller-as-R is the same dead end from the other side.

Two clocks and a no-show bond do not create atomicity. If R is silent for the whole long window, the seller sits on the coins and the fiat. That is written in the subject's §3. It is the specification, not a caveat.

---

## Wrong primitive

HTLC in this tree is a route: the payer knows the preimage, the onion carries it to the recipient. This design needs a hold whose preimage belongs to R. A Lightning hold invoice works because the rail is one asset and the receiver mints the secret. Mixing that with “a human confirmed a bank payment” is a human guarantor.

The “proof service” column (rung 3) is the only R that is not Telegram. It is tagged `[hypothesis]`: third-party access to bank confirmations is unverified. Peer / ZKP2P, with a cryptographic release, still sat at about USD 72k locked (subject's own source, Oct 2026). A human R is the guarantee-market the scope limit is trying not to be.

Partial release via Pull is the wrong clause. Pull reads the HashLadder registry, keyed by beneficiary, never dispute calldata, never “R released a fraction of a fiat ticket.” The subject marks this `[hypothesis]`. As ticket design it does not hold.

---

## Capital and legal physics

Inventory posted per counterparty is Depository law. Fine for a handful of lines. A lock holds capacity for its whole life; several open tickets put the desk back into prefunding, worse.

One Depository for every desk is one Tether freeze for all of them. The subject says per-pair deployment is not how XLN is built. Then this product cannot be honestly sold on a shared address to desks that fear blacklists. A per-hub or per-pair deployment is a product constraint, not an implementation footnote.

Native TRON as first rail: `todo.md` item 3 is unproven, and that corridor is the guarantee-market rail. The scope limit (operators who receive fiat into accounts in their own name) is necessary and does not make the scheme lawful. Rung 0 — counsel plus ten conversations — is the only honest step.

Precedents in §11 are read correctly and not followed to the conclusion: OpenPeer died; RoboSats is not atomic; Peer is small; Telegram guarantee markets are who a no-custody USDT-for-fiat lock attracts. “No public book” reduces that. It does not remove it.

Fiat P2P is outside `AGENTS.md` release scope. The lock change is a new protocol choice. Both are named in the subject's §13.

---

## What to keep

Desk–desk and desk–broker Accounts: standing balance, credit limit, broker first-loss reserve as a **signed obligation** (not a lock), clients outside the Account, payout from the desk's own book. That is a Clearing Account. Disputes remain a rare full exit of the line, not the mechanics of a ticket.

Conversations (D010 questions) before engineering: yes.

The lock: no, until ticket failure does not close the Account **and** R is a repeatable check of the bank payment, not a person. Both require new protocol, not “HTLC slightly otherwise.”

---

## Stop

Until the owner confirms a new payment kind and changes “dispute = death of the line,” this vision is a second product purchased with the first. Desks that need a line will not buy a nuclear switch on every transfer. Desks that need a lock against a stranger are the users §12 asks not to invite.
