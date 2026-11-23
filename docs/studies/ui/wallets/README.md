# Wallets, designed from scratch

- **Status:** design in progress. Nothing here is owner canon. No decision is settled until the user or the maintainer settles it.
- **Started:** 2026-11-19, on `xln` @ `8f8a4a6a`.

This folder holds the design of the new wallet frontends as Arrival Scheme: the decisions, the structure that follows from them, and the argument about them. It is written before any component. Code follows it.

It replaces nothing in the tree. An earlier attempt described and split the existing wallets; it is not part of this folder, and this spec does not read the existing wallets either.

## What went wrong before, in the abstract

These are the mistakes this spec exists to prevent. They are stated without reference to any screen.

1. Decisions were made inside components, by whoever wrote the component. No one could see or argue with them.
2. The wallet was organised around the protocol's internals and then explained to the person.
3. One interface served every kind of person, so each of them had to operate the whole machine.
4. Choices were made for the person without asking, including choices that put their money at risk.
5. Where something was complicated, the wallet added a paragraph.
6. The representation was derived from the implementation, so it could never precede it.

## The only ground

A sentence in this spec may rest on four things, and it must say which:

| Form | Rests on | Checked |
| --- | --- | --- |
| `(protocol "path" "…")` | what the protocol does; path under `core/`, `jurisdictions/` or `docs/core/` | path exists |
| `(canon 'id "…")` | a `constraint` or `law` declared here, quoted verbatim from its source | id exists; the quote is verified where it is declared |
| `(as-said 'id "…")` | a `said` form in `direction.scm` | id exists |
| `(evidence "path" "…")` | a recorded observation under `docs/studies/` or `docs/evidence/` | path exists |
| `(guess "…")` | nothing yet | counted |

No file may name `ui/src`, `frontend/src`, their tests, or `docs/studies/ui/surfaces`. The checker rejects the file.

## Files

| File | Holds | Written by |
| --- | --- | --- |
| `direction.scm` | what the people who own the direction said | the user's words only; models do not add to it |
| `protocol.scm` | figures, transactions and laws of the protocol | bound to `core/` and verified |
| `canon.scm` | repository rules that bind a new frontend | quoted verbatim from committed files |
| `surfaces/<person>.scm` | one person, their jobs, the decisions, and the surface that follows | one author each |
| `kernel.scm` | what every surface shares, and the decisions about it | one author |
| `apps.scm` | programs that work through the kernel | one author |
| `talk/*.scm` | positions, objections and replies | append-only, one file per author and target |
| `lang.ts`, `check.ts` | the vocabulary and its laws | |

## The forms

Decisions are the spine. Every structural form carries `:because`, a list of decision ids it follows from. An empty list is an error.

```scheme
;; ground
(figure 'owed-to-me-unlocked :core "DerivedDelta.outPeerCredit"
  :means (protocol "core/account/utils.ts" "What the counterparty owes me with no collateral behind it."))
(tx 'pay-routed :core "htlcPayment"
  :does (protocol "core/types/entity-tx.ts" "Send a hash-locked payment across hubs."))
(law 'accounts-are-bilateral :source "docs/core/12_invariant.md"
  :quote "Accounts are bilateral financial relationships between entities."
  :means "Every balance is a relationship with one named counterparty.")
(constraint 'some-rule :source "AGENTS.md" :quote "verbatim text from the committed file"
  :binds "What this forces on a new frontend.")

;; people
(person 'private
  :is       (guess "Who they are, in one sentence.")
  :came-for (guess "Why they opened this at all.")
  :cannot   [(guess "Something they cannot do or be asked to do.")]
  :jobs     [(job 'private-pay :wants (guess "Pay a person or a shop."))])

;; decisions
(decision 'd-private-first-screen
  :question   "What does the first screen answer?"
  :options    {:what-i-have "How much do I have?" :who-holds-it "Who holds my money?"}
  :forces     {:who-holds-it ['d-private-counterparty-name]}   ; optional: decisions an option opens
  :depends    ['d-private-who]                                  ; optional: decisions that must come first
  :decider    'user              ; user | maintainer | person-evidence | protocol
  :leaning    'who-holds-it
  :because    (as-said 'several-surfaces "Different people open it for different reasons.")
  :changes-if "Five people shown both first screens choose the other one.")

;; structure
(surface 'private-wallet :for 'private :first 'private-home :because ['d-private-first-screen])
(screen 'private-home :in 'private-wallet
  :answers "Who holds my money and how much of it is locked?"   ; one question, at most 20 words
  :shows ['owed-to-me-unlocked] :offers ['private-pay-flow] :because ['d-private-first-screen])
(flow 'private-pay-flow :in 'private-wallet :job 'private-pay :signs ['pay-routed]
  :uses ['k-consent]                                           ; optional: kernel capabilities
  :ends (guess "What the person knows when it is over.") :because ['d-private-first-screen])
(default 'private-first-credit :in 'private-wallet :value "0" :risk-on 'holder   ; holder | counterparty | nobody
  :because ['d-private-first-credit])
(need 'private-needs-exit :of 'private-wallet :wants (guess "Leave a counterparty without their help.")
  :because ['d-private-first-screen])
(gap 'private-no-lending :job 'private-lend :why (guess "Why this job is deliberately not served."))

;; kernel and apps
(capability 'k-consent :gives (guess "One question before any signature.") :meets ['private-needs-exit]
  :signs ['pay-routed] :because ['d-kernel-consent])
(app 'trading :for ['trader] :through ['k-consent] :does (guess "…") :because ['d-kernel-apps])

;; the conversation
(position 'p-1 :by "author" :on 'd-private-first-screen :for 'what-i-have :because (guess "…"))
(objection 'o-1 :by "author" :to 'private-home :lens "person" :claim (guess "…"))
(reply 'r-1 :by "author" :to 'o-1 :stance 'amend :because (guess "…"))   ; accept | reject | amend
```

`:in` names a surface, an app, or `'kernel`.

## Who decides

| `:decider` | Use it when | Who may settle |
| --- | --- | --- |
| `'user` | it is about who a surface is for, how many there are, or what the product is | the user |
| `'maintainer` | it touches the protocol, the launch scope, or repository canon | the maintainer |
| `'person-evidence` | only watching a real person can answer it | whoever runs the observation |
| `'protocol` | the protocol already determines it; cite the law | the citation |

A model never writes `:status 'settled`. It states a `:leaning` and what would change it.

## Laws the checker enforces

1. No reference to an existing wallet's source or the earlier spec.
2. Every figure names a field of a core type; every transaction names a core transaction type.
3. Every law and constraint quote is found verbatim in its source. `AGENTS.md` is read at the committed version.
4. Every surface, screen, flow, need, capability, app and default follows from at least one existing decision.
5. A decision has at least two options, a leaning among them, a decider, and a statement of what would change it. Dependencies do not loop.
6. A screen answers one question of at most twenty words.
7. Each person has exactly one surface. Every job is served by a flow or declared a gap. Every need is met by a kernel capability.
8. Ids are unique across the spec. Prefix ids with the surface or `k-`/`d-kernel-` to keep them so.

## Commands

```bash
bun docs/studies/ui/wallets/check.ts                    # whole spec
bun docs/studies/ui/wallets/check.ts --decisions        # open decisions in dependency order, unanswered objections
bun docs/studies/ui/wallets/check.ts --only docs/studies/ui/wallets/surfaces/private.scm   # ground plus one file
```

A passing check proves structure. It says nothing about whether a decision is right.
