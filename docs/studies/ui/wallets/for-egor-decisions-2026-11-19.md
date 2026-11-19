# Decisions only you can settle, ordered by what they block

- **Date:** 2026-11-19
- **From:** adimov, with claude-fable-5-2 drafting
- **Status:** questions. Nothing here changes a file of yours. Nothing is committed.
- **Companion:** [`for-egor-2026-11-19.md`](./for-egor-2026-11-19.md) asks the institution question and the reserve-and-exposure-dashboard question in more detail. This list repeats the first as a pointer.
- **Where it comes from:** a from-scratch wallet design written as Scheme in [`docs/studies/ui/wallets/`](./README.md). It holds decisions and the argument about them, and is bound only to the protocol and to committed rules. 134 decisions so far; adimov has settled 28. These are the ones that wait on you.

## How to answer

Reply with the decision id and one of: the option name, `as leaned`, or `no, because …`. The spec records it as settled by you. The id is the Scheme name; it is searchable in [`kernel.scm`](./kernel.scm) and `surfaces/`.

Each of these rests on a fact about the protocol or a rule you committed, and a model cannot know what you would choose. Where a decision cites code, the spec says what it read there. I could not verify all of it. Please correct anything that is wrong about your own code.

## A. These block adimov's own decisions

The "blocks" figure counts the open decisions that wait behind each: first adimov's, then all.

### 1. `d-private-receive-room`. Blocks 5 of adimov's decisions, 12 in all

**Before a private person has been paid anything, how is room made for a payment to reach them, and who carries the risk?**

A new account starts with credit zero, so a payment cannot arrive until the hub is allowed to owe the person something with nothing locked behind it.

| Option | Meaning |
| --- | --- |
| **allows-at-joining** (leaning) | When the person joins a company, they are asked once how much it may owe them with nothing locked behind it, stated as the most they could lose with it. |
| allows-when-asking-to-be-paid | When the person asks someone to pay a stated amount, they are asked to let the company owe them that much. |
| allows-at-first-payment | At the first payment that needs it, the person is asked for that amount. |
| company-locks-first | The person pays the company a fee to lock its own money for them before anything arrives; the fee comes out of money already brought into that account. |

**Why it leans that way.** Joining is the one moment the person is always present. At the first payment they are usually not looking and the payment fails before they are asked. Paying the company to lock first works only for someone who has already brought money in.
**What would change it.** Most payments to private people turn out to come against a request with a stated amount; or the fee for a hub to lock a few hundred dollars is below a dollar and holders are seen bringing money in before they are paid.
**Rests on.** The committed rule that credit is chosen by the parties (constraint `credit-is-chosen`). Today a new wallet gets a 10,000 USDC line with no question; this decision is what replaces it.

### 2. `d-kernel-app-door`. Blocks 4, 8 in all

**What may a program outside the wallet ask for?**

| Option | Meaning |
| --- | --- |
| read-or-everything | Read-only, or full authority, as the runtime connection allows today. |
| propose-under-my-rules | A program reads what the person lets it read and proposes actions. Each goes through the same question as the face it works through. |
| **scoped-grants** (leaning) | Each program gets its own grant, set by a fresh yes: which counterparties, which actions, how much in total, until when, never wider than the face's own limits. Inside it a proposal is signed at once; outside it the person is asked. The runtime enforces the grant. A program never holds keys, never changes a standing rule and never sees the copies kept for leaving. |

**Why.** A connection to the runtime is authenticated at one of two levels, read-only or full (`core/api/runtime-adapter/security/auth.ts`), so handing a program the connection hands it leaving and sending money out. The check is logic, so it belongs below the wallet. The spec notes that the repository lists such delegated scopes as work not yet done.
**What would change it.** You refuse to build runtime-enforced grants, or programs need permissions a grant cannot express.
**Cost.** New runtime work.

### 3. `d-institution-angle`. Blocks 3, 20 in all

Whether an institution surface is the idea in `docs/rejected-ideas.md` about selling provable payment authorisation to corporate treasuries. Asked in full in the companion note, question 1. Options: a surface and not the angle (leaning), drop it, reopen.

### 4. `d-kernel-evidence`. Blocks 3, 14 in all

**Who keeps what a person needs to leave a counterparty alone after losing their device, and what are they told about it?**

| Option | Meaning |
| --- | --- |
| **device-and-one-service** (leaning) | The newest state both sides signed goes, coded, to one watching service after every change. The wallet says per account and per chain whether that copy is current or behind, whether the service last accepted or failed, that it only answers in the last part of the window and never starts anything. Where it cannot act it says "not covered". |
| device-only | Only the device keeps it. |
| several-services | Copies go to several services the person chooses. |

**Why.** The spec reads the appointment as bound to one proof nonce, so each new state makes the held copy stale until the device uploads another; the service may act only in the last fifth of the window; it is authorised by one signer's signature; and it refuses native TRON (`core/watchtower/submission-support.ts`). It says it has not confirmed whether a board's entity can appoint the service at all. Because each side must keep its own evidence (law `keep-evidence`), device-only fails anyone who loses a phone.
**What would change it.** No watching service runs at launch, or the service is made to submit on TRON and accept a board's appointment, which would remove the "not covered" cases.

### 5. `d-kernel-seeded`. Blocks 1, 8 in all

**Opening an account installs settings no one chose: automatic collateral requests, public listing, response time. Does the wallet own those values, or only the duty to state them?**

| Option | Meaning |
| --- | --- |
| **face-sets-kernel-states** (leaning) | The wallet opens with what the protocol requires, sets what the opening allows (listing, response times), and applies each face's own collateral request setting in the next signature. Each face has its own values; the wallet states them in money and hours. |
| one-set-for-all | One set of opening settings for every face. |
| protocol-seed-untouched | Nothing is changed at opening; a face may change settings later as ordinary actions. |

**Why.** Both sides start with the same automatic collateral policy, so it cannot be left out of the opening itself. The faces want different values (a private person keeps the automatic request on; an institution wants it off until a vote). While no credit is granted the automatic request cannot fire (law `balance-bound`), so the second signature is safe if it follows the opening before credit is granted.
**What would change it.** You let an opening carry the collateral request setting, which removes the second signature, or the automatic request can fire before any credit is granted.
**Rests on.** The committed default in `core/account/config/defaults.ts` (law `auto-top-up-default`).

### 6. `d-kernel-keys`. Blocks 1, 2 in all

**Who creates, backs up and restores the keys that make a device act as the owner?**

| Option | Meaning |
| --- | --- |
| **one-phrase-in-kernel** (leaning) | One secret phrase per person. The device identity, the signing key of each entity, and the watching service's appointments all come from it. State kept with the service is restored on a new device from the phrase. A second device is added by entering the same phrase. Losing the phrase loses every entity with no other signer. |
| second-device-as-signer | As above, but a second device becomes a second signer of the entity, so losing one device does not lose the entity. |
| service-keeps-phrase | A service keeps the phrase, or a share of it. |
| each-face-own | Each face designs its own keys and restore. |

**Why.** The spec reads that the device identity and every appointment key derive from one phrase, and both wallets must derive exactly these values (`core/storage/recovery/bundle/seed-identity.ts`). A service keeping the phrase is custody, outside this launch (constraint `out-of-launch-scope`). Not checked: whether two devices can run the same entity at once without signing conflicting states. Until that is known, adding a device by phrase may have to mean moving to it.
**What would change it.** More than one person in ten shown the phrase loses it or keeps it where others can read it; custody comes into scope; or the runtime gains a way to add a second device's key without making a board.

### 7. `d-institution-record`. Blocks 1

**Who keeps the record of what an organisation agreed, who agreed, and what it changed?** Options: rely on the bounded history the runtime keeps now; the runtime keeps the organisation's own signed frames, with every request and vote, as long as it chooses (leaning); the protocol keeps finished requests and votes in the organisation's state; the organisation keeps its own copy outside the wallet. The leaning needs a runtime change. It cites `core/entity/tx/processing/proposals.ts`.

## B. These decide whether the design can be built as drafted

None blocks one of adimov's decisions directly. Each blocks others, or the design itself.

### 8. `d-kernel-two-wallets`. Blocks 6 decisions

**How does a new design live with the rule that the repository keeps two wallets, Svelte and React, both maintained, neither redirected or deleted?**

| Option | Meaning |
| --- | --- |
| **kernel-below-both** (leaning) | Facts and checks are runtime work both wallets read. The shared screens and each face are built in both wallets, with the parity and owning tests the rule requires. The old screens of each wallet are replaced face by face, never left beside the new ones. |
| one-wallet-per-face | Some faces only in Svelte, others only in React. |
| third-wallet | A third wallet beside the two. |

The spec's own reading: a face carrying a launch flow cannot live in one wallet only; a third wallet is the parallel implementation the committed rule forbids. What it cannot answer: **whether replacing a wallet's screens one face at a time is allowed while that wallet keeps working.** That is yours.

### 9. `d-kernel-hub-credit`. Blocks 1

When a customer sends a `credit_request`, the hub's automation answers it by raising the hub's own credit line to the customer to the smaller of the amount requested and a constant cap, 1,000 whole USD per request (`applyCommittedCreditRequestFollowup` in `core/entity/tx/handlers/account/credit-request.ts`, `CREDIT_REQUEST_CAP_USD` in `core/account/config/defaults.ts`). No operator signature is involved. I read this in the code on 2026-11-19; I did not run it. It conflicts with the rule adimov settled today that raising a credit line always needs a fresh yes, unless a standing rule covers it. Please confirm I have read it correctly.

| Option | Meaning |
| --- | --- |
| **real-money-waits** (leaning) | On test money, the wallet says plainly that a hub's credit lines are raised by code without a yes, and what the cap is. No hub takes real money until the runtime lets the operator set the cap, zero included, as a standing rule given by a fresh yes. |
| stated-exception | The floor names the exception for hubs and says it on test and real money alike. |
| redefine-floor | The floor does not count a hub answering credit requests, since it is automation and not a signature. |

**What would change it.** You say the constant cap is a testnet onboarding device removed before real money, or the operator's cap is built before the contract fix lands.

### 10. `d-kernel-held-pay-not-allowed`. Blocks 5

**On a chain where held payments may not yet carry real money, which payments does the wallet sign?** Options: only a payment straight to the counterparty of one of my accounts, with payments through a hub refused and the reason given (leaning); payments through a hub signed without a hold, with the person told the hub could keep the money; no payments at all. Rests on constraint `htlc-constants-are-simnet`. It is different from "no real funds before the dispute fix", which the design already treats as decided by your task list. Changes if you set the held-payment values for every launch chain before launch.

### 11. `d-operator-where-runs`. Blocks 8

**Does a hub run inside the operator's wallet, or does the wallet reach a hub running elsewhere?** Remote (leaning): the hub runs on a server with its automation, and the wallet reads it and sends it the operator's instructions. Inside: it works only while the wallet is open. It cites `core/orchestrator/hub-node.ts`. Changes if launch hubs are operated from a wallet that stays open, or the runtime has no authenticated way for a wallet to reach a server hub as its operator.

## C. Smaller ones. `as leaned` is a fine answer

adimov has settled these eight provisionally at the leaning below, in his own name, so the design can move. Each is yours: a different answer replaces his, and the spec follows.

| Id | Question | Leaning |
| --- | --- | --- |
| `d-kernel-unbuilt` | May a launch flow rest on a wallet capability that is runtime work not yet done? | Not offered until it is built (constraint `no-stubs-in-flows`) |
| `d-operator-launch-flows` | Which launch flows does the operator surface carry, and how are borrowers approved? | Officer-operator limits |
| `d-operator-pause` | Can the operator stop the hub taking on new risk at once, without leaving anyone? | Yes: stop new risk |
| `d-private-pro-toggle` | What may the Pro switch reveal on the private surface? | More detail, never more actions |
| `d-private-listed` | Is a private person's account with a company listed publicly, as opening an account does by default? | Listed, and said so |
| `d-private-exchange` | Does the private surface change money from one kind to another, and in what shape? | Now, and across chains |
| `d-trader-cross-chain` | Does the trader surface carry trades across two chains? | Yes |
| `d-trader-record` | What record does the trader get? | Fills and fees, no profit figure (a profit figure would be a second formula in the frontend) |

## What is not on this list

- **Two decisions that need people watched, not you.** Which words every surface uses for risk, and how a trader is shown who holds their money. Eight of adimov's decisions wait on the second.
- **Whether a locked share that costs more on the chain to collect than it returns is still called "secured".** It is yours, but it waits on the words decision, so it comes after.
- **The reserve-and-exposure question.** It is in the companion note.
