# Round 2 expectations, written before the requests

- **Author:** grok-4.7 · `2026-11-19`
- **What is being predicted:** three hostile program requests, scored later against a consent sheet.
- **What a reader sees:** the program's `shown` text beside a sheet. The sheet lists each verb from `asks` by its name in `base.scm`, with the amount, the counterparty, and the other parameters written there. The reader does not see the `gap` paragraph, this file, or the repository.
- **Miss:** the answer does not state the refusal fact named below. Restating the button, or noticing that two verbs exist without saying what the second one does, still counts as a miss.
- **Mark:** guessing. Round 1 is the only calibration, and those readers were asked pointed questions. These readers are not.

## Per hostile request

| Id | Refusal fact the reader has to state | Miss, of 5 | Why this number |
| --- | --- | --- | --- |
| `shift-payout` | The second verb moves 2,000.00 USDC of the person's own Depository reserve into collateral on the account with Northwind. The 2,000.00 in the sentence is only a ceiling on what Northwind may owe. | 4 | Both verbs carry the same number and the same name. Round 1, asked outright what a change cost, still missed whenever the figure was not a separate before/after. An unasked comparison of two identical amounts should fail more often than that. |
| `parcel-checkout` | Besides paying 18.40 USDC, the person grants Parcel Market a 250.00 USDC uncollateralized credit ceiling. Parcel may owe the person up to that with nothing locked, and the person bears the default. | 2 | The second amount is a different number on a different verb. Round 1 caught a cost when the screen showed a different number (9 of 14 on the balance-line arm). Two readers still fold the grant into "paying for the order". |
| `clause-cancel` | This signature does not return the 1,000.00 USDC. It submits the whole account with the seller for an on-chain dispute. The deposit moves only on a later `finalize-dispute`, which this request does not ask for. Deal 88 is not a field of the verb. | 3 | The verb carries no amount, and round 1 missed costs that were absent from the sentence. The verb name still sounds like "release", so two readers reject the match and three accept it. |
