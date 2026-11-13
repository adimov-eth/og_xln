# XLN as a protocol layer: vision

- **Author:** `claude-fable-5-2`, Claude Code, 2026-11-13T19:34:35+07:00
- **Written against:** `019d45b` (`v0.1.31`)
- **Status:** one model's recommendation, written at the request of the person directing this session. Not owner canon.
- **Relation to my earlier files.** My first vision named a fallback if no first counterparty appeared: present XLN as a reference implementation. D016 established that no counterparty exists. This document is that fallback made concrete, and it is my current position. The [synthesis](./synthesis-claude-fable-5-2.md) remains as a worked hypothetical and a record of code findings. The [P2P desk vision](./p2p-desk-vision-claude-fable-5-2.md) is cited here only as one service a third party might build; I shelved it as a recommendation in D022.
- **Nothing here is evidence of demand.** No builder has been asked.

Tags: `[exists]` read in the code this session; `[documented]` read in repository docs only; `[build]`; `[decision]` owner's call; `[hypothesis]` unverified.

## 1. The position in one paragraph

XLN is the layer that keeps two-party accounts: collateral, bounded credit, conditional payments, and exit without the other side's consent. Services with an off-chain leg, such as a fiat desk, an escrow agent or a delivery validator, are separate businesses run by other people under their own name and licence. The owner's job is to make the layer something a stranger can lawfully deploy, run and build on, and to add one general primitive that those services need: a payment that a chosen third party releases. The owner does not run the services.

## 2. Three layers

| Layer | What it is | Who runs it |
| --- | --- | --- |
| Protocol | contracts, the account state machine, payment and dispute rules, the wallet | published by the owner; run by anyone |
| Infrastructure | a hub, a watchtower, a contract deployment with its token list | anyone, including the owner for a reference instance with no off-chain leg |
| Service | tickets, checks on bank payments or deliveries, identity, dispute staff, client relationships | a third party; never the owner |

The split is real only if a third party can do the second and third rows without the owner. Today it cannot. §3 is the list of why.

## 3. What a builder needs, and its state

| Need | State |
| --- | --- |
| read the source | `[exists]`. The repository is public on GitHub (`xlnfinance/xln`) |
| a licence to deploy the contracts | **unclear.** The root `LICENSE` is AGPL-3.0; ten of sixteen contract files, including `Depository.sol`, `Account.sol` and `EntityProvider.sol`, carry an UNLICENSED header; GitHub reports the licence as "Other". The signals conflict and only the owner can resolve them. `[decision]` |
| a licence to run and modify the runtime in a closed service | AGPL-3.0. A service must publish its changes or obtain other terms. `[decision]`; see §7 |
| an installable package | missing. `package.json` is `private: true`; there is no SDK package. `[build]` |
| a programmatic API | partly `[exists]`. `core/api/public/runtime-public.ts` exports runtime adapters, route finding, capacity planning, watchtower and dispute helpers. It is an internal module, undocumented for outsiders |
| deploy their own contract stack | scripts `[exists]` (`jurisdictions/scripts/deploy-stack.cjs`, `deploy-chain-matrix.cjs`). The runtime checks deployed bytecode against its own artifacts and not who deployed it (`assertCanonicalRpcContractStack`), so a third party's deployment of the same bytecode should be accepted. I did not run it. The deployer's address becomes that stack's Foundation (§5) |
| run a hub | `[documented]`. `docs/deployment/deployment.md` and `ops-runbook.md` describe the owner's own stand; they are not written for a stranger |
| run a watchtower | `[documented]` as a standalone daemon (`docs/watchtower-services.md`) |
| a payment a third party releases | `[build]`; §4 |
| restrict who may deposit into their deployment | missing, and a contract change; §5 |
| an external security review | missing. `[decision]`; canon makes it optional |
| a mainnet deployment to point at | missing. `jurisdictions.json` has local chains, TRON Nile and Sepolia |

## 4. The one primitive to add: a held payment

**What it is.** A hash-locked payment whose secret the payer does not hold. A release-holder named by the two parties gives the secret to the recipient when an off-chain condition is met. If it does not, the payment returns to the payer at expiry.

**One path, not two.** `AGENTS.md` forbids parallel implementations. Today's payment is the special case in which the payer generates the secret and includes it in the final layer of the envelope. The change makes the secret's presence in that layer optional and lets the payer supply a hash. `[decision]` whether the owner accepts that generalisation.

**What changes, with no Solidity:** payer admission (`core/paybook/payment-admission.ts:192-197`), the envelope's final layer (`core/protocol/htlc/codec/onion.ts:24-28`), and the recipient's check (`core/paybook/materialize-context.ts:289-291`). The repository's rules add Rust wire parity and hash coverage. None of the three files is named in `frozen-core.json`. I have no estimate of size.

**What does not change.** Contracts. A payment clause already settles on any preimage of its hash (`DeltaTransformer.sol:323-355`).

**Limits to state in its documentation:**

- It is not atomic against an uncooperative counterparty. Account frames are signed by both sides, so the payer can refuse to countersign a valid claim. The recipient's remedy is to publish the secret on-chain before the reveal deadline and dispute, which closes the Account (D021).
- Expiry favours the payer. A recipient whose release-holder is slow loses.
- Before expiry only the recipient can cancel (`core/account/tx/handlers/htlc/resolve.ts:57-66`). A recipient who goes silent holds the payer's funds until expiry. A bond is a second held payment in the opposite direction.
- The protocol has no remedy for a release-holder that fails to act. Inaction cannot be proven on-chain, so there is nothing to slash. Any bond on a release-holder is a private arrangement at the service layer.
- A constant sets a 24-hour lifetime for the asynchronous mode (`core/types/finance/payment.ts`). I did not read how that mode behaves on a direct lock.

## 5. Deployments and control

**The Foundation is a controller.** Each contract stack creates Foundation Entity #1 from the deployer's address (`EntityProvider.sol:168-192`). It can list tokens, register Entities and add share depositories (`:101-104`, `:218`, `:265`, `:869`). It also has the lowest-priority lane for proposing a board replacement; and any higher lane cancels it. Anyone may register a numbered Entity without the Foundation (`registerNumberedEntity`, `:378`), and it then receives default articles with a 10-day Foundation lane (`:365-371`, `:836-845`); only the Foundation can register an Entity with other articles (`:869`). An unregistered single-signer Entity is exempt: `proposeBoard` requires a registered board (`:475`). A proposal from the Foundation lane can be cancelled by any higher lane (`:539-560`), so for a registered Entity with an active board it is a recovery backstop, not a takeover key. My earlier statement that the deployer has no power on mainnet was true of the Depository's `admin` and incomplete for the Foundation.

**So a service that wants no dependence on the owner deploys its own stack** and is its own Foundation. `[exists]` as scripts.

**Two deployments on one chain are two jurisdictions.** Identity is chain id plus Depository address (`core/jurisdiction/machine/jurisdiction-runtime/index.ts`). A payment between them is a cross-jurisdiction swap, which is `todo.md` item 2. Separate deployments therefore do not net with each other until that item is done.

**A separate deployment does not keep unwanted funds out.** Deposits are permissionless; `Depository.sol` has no allowlist. Restricting depositors is a contract change and conflicts with "no invite gates" in `AGENTS.md`. `[decision]`

**Why this matters.** All balances in one stack sit at one address, and a stablecoin issuer can freeze an address. I found no documented case of that happening to a pooled protocol contract; the probability is unknown.

## 6. What the owner does and stops doing

| Does | Stops or never starts |
| --- | --- |
| publishes contracts, runtime and wallet under terms others can use | running a service with an off-chain leg |
| ships the held payment | acting as release-holder |
| documents deployment, hub and tower operation for a stranger | being Foundation for other people's deployments |
| pays for an external review of the custody files | taking a fee on other people's flow |
| may run one reference hub and tower with no off-chain leg, on its own deployment | presenting its own hubs as independent operators |

The last row on the left keeps `launch-design.md:45` (the owner operates the first hubs). The last on the right keeps `todo.md:52-54` (those hubs are not independent failure domains). Both can stand if the reference instance is labelled as the owner's.

## 7. How it is paid for

`launch-pilot.md:64-65` records a platform fee of 1 bp per payment and 3 bp per swap. A fee on flow presumes the owner operates or controls the path. In this position there are three sources, all `[decision]`:

- fees on the owner's own reference hub;
- the runtime's AGPL terms: a closed service needs other terms, which the owner can sell;
- paid support and deployment for services.

I have no figure for any of them.

## 8. Services others could build

These are uses, not demand.

- **Pay on delivery for software agents.** A validator is the release-holder. `docs/agent-payments.md` describes an experimental adapter and states its limits: the merchant must enable XLN, and it cannot pay an arbitrary existing endpoint. ERC-8004's identity and reputation registries are reported live; I could not confirm its validation registry. My perspective §1 cites about USD 19M of adjusted x402 volume in total as of 2026-04-21 (Visa and Artemis, via search).
- **A trading desk and its liquidity provider.** Collateral plus a limit in place of prefunding; no off-chain leg. This is the study's original candidate and has no named counterparty.
- **A fiat desk service.** Shelved as my recommendation (D022). If a licensed operator builds it, it is their business on their own deployment.

## 9. Order of work

**Revised 2026-11-13T19:48:53+07:00.** A review argued that the order below builds, packages and audits before anyone has asked, and that §11's stop condition ("after the licence and documentation exist") comes too late. I agree. Gate zero comes first and needs no new code: the licence decision, then conversations with prospective builders using the existing repository and [`held-payment-spec-claude-fable-5-2.md`](./held-payment-spec-claude-fable-5-2.md) as the brief. Steps 2 to 7 below start only if one of them says they would build. `todo.md` items 4 and 5 are on the owner's queue regardless.

Canon rejects cutting scope. This is an ordering of the existing queue plus four additions, as in D012.

1. `[decision]` Licence terms for contracts and runtime.
2. `todo.md` item 4 (Sepolia disputes and exits on current bytecode) and item 5 (wallet import time).
3. External review of the custody files.
4. The held payment.
5. Package and builder documentation: deploy a stack, run a hub, run a tower, open an Account, send a held payment.
6. `[decision]` `todo.md` item 8 (mainnet operations), for a reference deployment. Canon requires lending and native TRON evidence before real funds; either the reference instance stays on a test network until those pass, or the owner changes that requirement.
7. `todo.md` item 2 (cross-jurisdiction swap), which is what lets separate deployments connect.

Native TRON, pooled lending and the load targets stay on the queue behind these.

**Collisions with canon.**

- `AGENTS.md` release scope requires Pay, both swaps and Lending on EVM and native TRON before launch. Step 6 above conflicts with it unless the reference instance stays on a test network.
- `launch-design.md:45` has the owner operating three hubs and a market maker. This position has one labelled reference hub.
- `launch-pilot.md:64-65` sets a platform fee on flow. §7 replaces it.
- "No invite gates" in `AGENTS.md` conflicts with restricting depositors (§5).
- `rejected-ideas.md` rejects cutting scope. Steps 1, 3, 4 and 5 are additions, not cuts; the reordering is the owner's call.

## 10. The case against this position

It comes from this study's own research and I think it is strong.

- **Hyperliquid and Relay operated first.** Both were the principal in their own venue before anyone built on them. D005 concluded that outside capital follows use that the operator funds.
- **Earlier EVM state-channel frameworks** (Raiden, Celer's channels, Connext Vector, Nitro, Perun) were published for builders. A review states that none produced a lasting third-party business; I could not verify that, and Yellow Network, which runs a broker clearing network on Nitro-derived channels since March 2026, is a live system of this kind. It is operator-run and token-funded, may be built on its own framework, and I found no volume figure, so it supports neither side clearly.
- **The pure-protocol precedent is Lightning.** Public capacity fell 41% from its December 2025 record and the ten largest nodes hold most of it (D005). An open channel protocol without an operator with flow has not grown.
- **A protocol's first user is a builder,** and that sale is harder than a desk: documentation, a licence, an SDK and a reason to choose unaudited infrastructure.
- **Separation may not protect.** If the owner runs the reference hub that services route through, the owner is part of those services in practice. That is a question for counsel.

What I say in reply: every operator-first candidate in this study ended without a named counterparty or inside a business the owner should not run. This position is what remains when that is accepted. It is the most defensible shape and the one with the weakest pull.

## 11. Gate zero and stop conditions

**Gate zero:** one named third party who says it would build a service on XLN, and what it needs from §3 to start. I make no statement about whom the owner knows (D016).

Stop, or return to an operator-first candidate, if:

- no third party is named after the licence is settled and ten prospective builders have seen the brief;
- the owner declines both the licence change and the held payment;
- the first builders are services the owner would have to answer for;
- external review finds a fault in custody or exit.

## 12. Unverified

- Whether the Sepolia contracts are source-verified on an explorer.
- The size of the held-payment change, and how the asynchronous mode behaves on a direct lock.
- Whether anyone wants to build on this.
- The legal effect of running a reference hub.
- Hyperliquid and Lightning figures are from search digests recorded in D005; Relay's history is from the same research and not re-checked.

## Sources

- The repository at `019d45b`: [xlnfinance/xln](https://github.com/xlnfinance/xln).
- [`chat.md`](./chat.md) D005, D016, D021, D022 and my [perspective](./perspectives/claude-fable-5-2.md) §1 for external figures. No new external source was consulted for this document.
