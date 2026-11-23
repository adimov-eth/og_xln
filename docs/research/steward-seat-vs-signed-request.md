# Steward: a seat on the board, or a signed request

Decision record, not a spec. The goal is "agents propose, the person signs": a steward agent drafts a
financial change and only the person's signature makes it happen. xln at `ec1a47a59` supports two
shapes. They differ in what they cost and in what they record. Read, not run, unless marked [run].

## Shape A: the steward holds a seat on the Entity board

The steward is a validator with its own key. It signs an `entityCommand` containing `propose`
(`core/entity/command/command-codec.ts:104` binds `propose.proposer` to the signer). The proposal
stores the exact batch (`core/entity/types.ts:187-198`). The person's `vote` yes executes it in the
same frame through the normal handlers; a `no` deletes it (`core/entity/tx/handlers/system/basic.ts:149-224`).

What it records: the proposal, who drafted it, and the person's yes or no are Entity state that
every replica agrees on.

What it costs today:

- **A new wallet.** A wallet Entity is lazy: its id is the hash of its board
  (`core/entity/factory.ts:177-185`). Adding a seat makes a different Entity; Accounts, reserves
  and collateral do not move, and no migration exists. Changing a board in place works only for
  registered (numbered) Entities through EntityProvider with a one-day delay, which is in the
  Companies/custody scope `AGENTS.md:35-36` keeps out of launch.
- **A commit-rule change.** The board that keeps the person in control is person 2, steward 1,
  threshold 2: the person pays alone, the steward can only propose and cannot veto. That board
  stalls today: only a single-signer proposer commits locally
  (`core/entity/consensus/proposal/start.ts:668-673`), and the steward treats the person's frame as
  a commit notification and sends no precommit (`core/entity/consensus/input/consensus.ts:57-128`).
  The untracked scenario `core/scenarios/consensus/steward.ts:14-18` records the stall. Fixing it is
  a new protocol choice, which `AGENTS.md:203` reserves for explicit maintainer authorization.
- **The 1:1 board instead** works today [run in that scenario] but is worse: every frame needs both
  signatures, so the person cannot pay or even receive while the steward is offline, and the
  steward's single `no` vetoes the person.
- **No revocation.** On a lazy board the steward cannot be removed without a new Entity.
  `docs/clerk-boundary.md` asks for a lease and suspend-on-restore for any clerk; none exists.
- **Single-validator assumptions** break: cross-J local commands
  (`core/entity/consensus/input/ingress.ts:89-90`), the BrowserVM restore binding
  (`core/runtime/recovery/restore-adapters.ts:47`), the Rust engine (single-signer only), and wallet
  id derivation as `generateLazyEntityId([signer], 1n)` in both wallets.
- **Known limits even after the fix:** one pending proposal per proposer
  (`core/entity/tx/processing/proposals.ts:56-63`), no expiry and no withdraw.

## Shape B: the steward signs a typed request; the person sends it

The steward has its own key but no seat. It produces a typed request (the exact EntityTx batch, a
note, its signature). The wallet verifies the signature against a steward key the person pinned,
renders the batch as typed facts, and on Sign sends it as the person's own 1-of-1 transaction. This
is the shape `ExternalRequestSheet` already uses for `/#pay/…` requests in both wallets.

What it records: only the person's transaction. The steward's draft and a decline are not Entity
state; they live in the wallet (and could be logged).

What it costs: no protocol change, no new Entity, revocation is unpinning the key. It needs a
request format and a transport. `clerk-boundary.md` says "no proposal event format exists" and a
chat adapter is out of launch scope.

Open question for B: `clerk-boundary.md:129` asks that a proposal be "a typed object signed by an
Entity signer". A pinned steward key is not an Entity signer. Either the rule is read as "signed,
typed, rendered from the transition" (B fits) or literally (only A fits).

## What both shapes need, and what can be built now

Independent of the choice, and needing no protocol change:

1. Typed rendering of a batch: today only `htlcPayment` is projected
   (`frontend/src/lib/components/Entity/core/entity-consensus-payment-view.ts:116-123`).
   `directPayment`, `extendCredit` (set_credit_limit), `openAccount`, `r2r` show only a type name.
2. A selector for proposals awaiting the person (proposer is not me, I have not voted, board hash
   and epoch still match) and a `vote` builder. Proposals already reach both wallets in the view
   frame (`core/api/runtime-adapter/read/compact-view.ts:416`, last 20).
3. A sign sheet in Pro, off by default (`docs/studies/ui/surfaces/BRIEF.md:17-18` keeps steward tools
   out of Everyday), rendering facts from the batch and the proposer's text as labelled, untrusted.

## Recommendation

Build 1–3 now. They serve any multi-signer Entity today and both shapes later.

Shape A is the one that matches "me and my agents are one Entity", and the only one where a decline
is a shared fact. It needs the maintainer to authorize the commit-rule change for a person-majority
board, and accepts that a steward wallet is a new Entity. Shape B ships without protocol work and is
revocable, but records less. They are not exclusive: B can come first and A later for wallets that
want the shared record.
