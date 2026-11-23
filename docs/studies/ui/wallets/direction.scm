;; direction.scm — what the people who own the direction said, in their words.
;; These outrank every guess in this spec. A model does not add to this file.

(said 'representation-first
  :who "adimov" :on "2026-11-18"
  :quote "the problem is the workflow on wallet design in general — there is no intermediate representation of what wallet should be to discuss and polish vision before implementation into react, so all we observe further are just symptoms"
  :taken-as "Decisions are made and argued in this spec before any component is written. Code follows the spec.")

(said 'from-scratch
  :who "adimov" :on "2026-11-19"
  :quote "the main goal is to have arrival scheme files to to hold the conversation and structural architectural decisions made for new wallets front end, because old one was designed from fundamentally wrong way"
  :taken-as "The spec is designed from scratch. It holds the decisions and the argument about them. It does not describe, split or patch the existing wallets.")

(said 'several-surfaces
  :who "adimov" :on "2026-11-18"
  :quote "Private person wallet isn't the same app as professional trader's, hub operators or institution."
  :taken-as "There are separate surfaces for a private person, a professional trader, a hub operator and an institution. Whether four is the final number is not settled.")

(said 'wallet-over-apps
  :who "adimov" :on "2026-11-18"
  :quote "wallet should operate over the desk as desk just another app wallet capable to work with"
  :taken-as "A common wallet base sits under every surface. Applications work through it. Desk is one such application and is itself out of scope.")

(said 'neat-wallet-first
  :who "adimov, relaying the protocol's author" :on "2026-11-18"
  :quote "Egor wants to build a neat wallet UI as a top priority rn"
  :taken-as "The wallet interface is the current priority of the protocol's author.")
