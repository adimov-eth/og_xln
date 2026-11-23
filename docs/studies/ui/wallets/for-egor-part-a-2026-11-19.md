# Seven decisions only you can settle

- **Date:** 2026-11-19
- **From:** adimov, with claude-fable-5-2 drafting
- **Status:** questions. Nothing here changes a file of yours. Nothing is committed.
- **Where it comes from:** a from-scratch wallet design written as Scheme in [`docs/studies/ui/wallets/`](./README.md). It holds decisions and the argument about them, bound only to the protocol and to committed rules. adimov has settled 28 of 134 decisions. These seven are the ones that wait on you and block his the most. There are others; they are not in this note.

## How to answer

Reply with the decision id and one of: the option name, `as leaned`, or `no, because …`. The spec records it as settled by you. Each id is searchable in [`kernel.scm`](./kernel.scm) and `surfaces/`.

Each rests on a fact about the protocol or a rule you committed, and a model cannot know what you would choose. Where a decision cites code, the spec says what it read there. I could not verify all of it. Please correct anything that is wrong about your own code.

The "blocks" figure counts open decisions that wait behind each: first adimov's, then all.

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

**Is an institution surface the idea you rejected?** `docs/rejected-ideas.md` says: "Selling provable payment authorization to corporate treasuries as the angle | Rejected by owner." `AGENTS.md` says never to re-propose a listed idea without new evidence.

On 2026-11-18 adimov said: "Private person wallet isn't the same app as professional trader's, hub operators or institution." The design now has four surfaces, one for an institution. That sentence is the only new evidence; whether it is enough is your call.

**The institution surface as drafted** (models' guesses, seen by no organisation): the person who runs the money of a small organisation, with two to four colleagues who must approve payments and an outside auditor. Its screens ask what is waiting for one of us to decide, what a run would pay and at most at what cost, how much we could lose and with whom, and what we agreed and who agreed to it.

| Option | Meaning |
| --- | --- |
| **surface-not-angle** (leaning) | The surface exists for organisations that use xln. It is never presented or sold as proof of payment authorisation, and its record is for the organisation's own auditor. The board voting before money moves is how the protocol already works for any entity with several signers. |
| drop-surface | The rejection covers it. No institution surface; an organisation with a board uses whatever surface serves an entity with several signers. |
| reopen | It is close enough that you reopen the rejected idea, with adimov's naming of an institution as the new evidence. |

**The argument against the leaning.** Without two runtime changes nobody has scheduled, the surface ships with every account showing as not covered and with no audit flow. Those changes are a board appointing the watching service, and the runtime keeping the board's record. Its remaining features are the ones the rejected treasury pitch sold.

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
