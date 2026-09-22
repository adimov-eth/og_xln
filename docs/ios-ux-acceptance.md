# Native iPhone UX acceptance

Target: iPhone 17 Pro, native SwiftUI, automatic English/Russian and system
light/dark appearance. This is a product acceptance rubric, not a measured
industry ranking. Target 95/100; current score **not established**.

## Scoring before release

Twenty criteria, five points each. Score each 0–5 with an artifact, build hash,
device/OS, locale and appearance. Unknown stays **unverified**, never a pass.
Five means the stated acceptance behavior is demonstrated; three means a usable
flow with documented friction; zero means blocked or misleading. Intermediate
scores require a written reason. Do not renormalize around missing checks.

| Area | Five-point criteria |
| --- | --- |
| Task completion and financial clarity · 35 | Create/open without configuration detours; receive request with explicit asset/network; QR → recipient/amount review; exact payment fee/debit/receipt; swap minimum/fee/fill/balances; distinguish ownership from available credit; cancellation/retry cannot duplicate or imply success |
| Accessibility · 25 | Named controls and meaningful VoiceOver order; usable touch targets; light/dark text contrast; largest Dynamic Type without lost content/actions; English/Russian without clipping or confusing amounts |
| Visual hierarchy · 20 | Balance and primary action readable at first glance; typography/spacing consistent; native navigation and restrained glass; concise useful copy and intentional empty/error/loading states |
| Response and recovery · 20 | Immediate feedback and measured device animation behavior; keyboard/focus/back preserve intended input; interruption/reconnection preserves truthful transaction state; lock/reopen and recovery without secret exposure |

Visual criteria are explicitly reviewer judgments. Record disagreements, do not
average model praise into a pass. A Quorum text review is not a screenshot review.
An automated accessibility audit is not a full VoiceOver usability test.

## Non-negotiable gates

95/100 requires all 20 criteria evaluated, no critical/high usability failure,
no hidden or clipped financial confirmation, and no inaccessible primary action.
Wrong amount/recipient/fee, false confirmation, duplicate submission, secret
exposure or inability to recover blocks release regardless of total score.
Camera QR, real-device response, public-testnet health/payment and signing must
be demonstrated separately before claiming the requested iPhone demo ready.
Simulator results do not satisfy those physical/public gates.

## Repeatable procedure

1. Run the smallest failing screen or interaction first. Use XCTest screenshots
   and `performAccessibilityAudit()` with no blanket issue suppression.
2. Fix that failure and rerun it. Cover light/dark, English/Russian, default and
   accessibility text sizes. Inspect screenshots; a green script is insufficient.
3. Run real local-hub payment/swap acceptance and retain videos and exact receipts.
   Keep the current stand lock. No financial mocks, no screenshots of substitutes.
4. On the physical device, verify camera QR, VoiceOver task completion, default
   BrainVault latency, interruptions and response under an instrumented run.
5. Run `bun run check`; report evidence, unresolved checks and reviewer scores.
   When changing quote models, also compile/run the existing Foundation-only
   `scripts/native/tests/quote-expiry.swift` with `WalletQuote.swift`; the app
   build alone can hide unwanted UI dependencies in that model.

Apple references: [automated audits](https://developer.apple.com/documentation/accessibility/performing-accessibility-audits-for-your-app),
[manual accessibility testing](https://developer.apple.com/documentation/accessibility/performing-accessibility-testing-for-your-app).

## Reflection loop

Every ten minutes: intended user outcome → artifact/evidence since last review
→ first remaining failure → one useful next action. Two attempts without new
evidence require a changed hypothesis or method. An external blocker permits
independent work toward the same outcome, not unrelated feature expansion.
Use one bounded Quorum question for an actual uncertainty, never every tick.
Hourly reports contain verified results, completed/total checks and blockers.

Initial independent review: `ios-ux-20260918-01`, GLM-5.3 low via the existing
Quorum subscription dispatcher, one response/no retry. Its useful warning is
that English happy-path tests cannot certify accessibility, recovery or device
smoothness. Its suggested German locale is outside the requested EN/RU scope;
its suggestion to hide test credit with DEBUG would conflate build type with
network identity and is not adopted. The current target is explicitly testnet.
The response is provisional, not a product rating. USD 0.25 remains reserved;
actual cash cost is unknown.

## First simulator iteration · 2026-09-18

Partial-history disclosure fixed (09:09 UTC): native history now preserves the
canonical API availability status. SwiftUI shows Earlier history unavailable
when partial, and suppresses No activity on this page. EN/RU strings included;
English warning visually inspected on a newly created iPhone17Pro/iOS26.5.
Two disclosure assertions pass2/2 after real post-payment backup/fresh restore;
98.999998 USDC remains exact. Backup test passes100.192 s, but original Sent
history assertion still fails39.980 s. Full recovery remains1/2; no weakened
history acceptance. Actual rebuilt native WebKit/SwiftUI path exercised, not a
mock. Source checks39/39 (33.468 s). Screenshots/video/logs in
`history-disclosure/` evidence/output folders. No new storage or financial logic.

Fresh second-device recovery (08:51 UTC): **1/2 tests pass; milestone fails**.
Post-payment encrypted backup verifies snapshot157 (43 KB displayed),103.543 s.
Brand-new iPhone17Pro / iOS26.5 simulator with no prior XLN install restores
98.999998 USDC using remembered credentials, but its Activity has no Sent
record; strict history assertion fails after38.754 s. Current snapshot backup
contains current state plus the tip journal, not older history. The API exposes
partial history availability; native projection currently loses that metadata.
Do not count balances-only restore as full financial-history recovery or hide
the failing assertion. Local services remain healthy; post-restore recipient
check is not reached due to UI failure. Evidence, full backup/restore videos and
missing-history frame in `tower-restore/` folders. Source checks39/39 pass;
source validity does not clear this acceptance failure.

Native payment reopen (08:33 UTC):1/1 passes in117.716 s, iPhone17Pro /
iOS26.5, en_US/light/normal text, default100-shard BrainVault. After payment,
background lock, actual app termination and relaunch, the wallet remains locked.
Remembered name/password restores98.999998 USDC and exactly one confirmed
1.000001-USDC payment. Recipient custody independently confirms that exact credit
after reopening. Local stand stays healthy. Nine screenshots and normal-speed
68.974 s video retained in `payment-reopen/`; demo removes52 s setup. Initial
green run's balance screenshot caught dismissal animation; the test now waits
for the unlock sheet to disappear, and the final balance/history captures were
visually checked. Source checks39/39 in31.269 s. This proves same-installation
persistence/reopen, not fresh-install tower recovery or physical camera behavior.

Native orderbook limit buy (08:13 UTC):1/1 passes in105.177 s, iPhone17Pro /
iOS26.5, en_US/light/normal text, shipped default100-shard BrainVault. Market
ask2500.5 USDC reaches the native price field unchanged; buy0.009 WETH fills
with22.5045 USDC debit,0.0000009 WETH fee,0.0089991 WETH net and77.4955
remaining USDC. Exact receipt/balance assertions reused from Home swap; prior
Home coverage retained. Seven screenshots exported; book, review, receipt and
balances visually inspected. Normal-speed55.454 s demo removes54 s setup.
Source checks39/39 (31.133 s); local stand health passes. Evidence/video in
`orderbook/` under existing folders. No product bug fix needed. This marketable
limit fill does not prove resting-order, partial-fill or cancellation behavior.

Russian swap acceptance (07:54 UTC): 1/1 passes in91.467 s on iPhone17Pro /
iOS26.5, ru_RU, light, normal text. Uses shipped factor3/100-shard BrainVault;
financial tests now share this default creation path without custom settings.
Exact debit24.999999 USDC, gross0.009998 WETH, fee0.0000009998 WETH,
net0.0099970002 WETH, remaining75.000001 USDC; WETH headline selection passes.
Russian receipt values are parsed using ru_RU and reconciled without rounding.
Six screenshots retained, review/receipt visually inspected. Normal-speed
43.043 s demo removes52 s of setup. BrainVault submit helper to ready11.0140 s
includes automated waits, network and polling; not a device/KDF benchmark.
Source checks39/39 in32.421 s; healthy real local stand. Evidence/video under
`russian-swap/` in the existing directories. Public-testnet/camera/device gates
remain open; no product behavior was changed for this acceptance run.

Russian payment acceptance (07:33 UTC): actual native flow passes1/1 in95.387 s,
iPhone17Pro simulator / iOS26.5, ru_RU, light, normal text. Review assertions
require maximum1,000002 USDC, recipient1,000001, fee0,000001; independent custody
receipt confirms1.000001, sender balance98,999998. Russian Activity labels and
background lock pass. Seven screenshots inspected/exported and normal-speed
video retained in `output/ios-ux-2026-09-18/russian-payment/`; demo removes62 s
of setup. Logs/receipt in `docs/evidence/ios-ux-20260918/russian-payment/`.
This uses the custom six-shard test wallet and typed invoice, not camera capture.

Default BrainVault creation (07:37 UTC): separate native test never opens work
settings. The shipped factor3/100-shard path reaches the actual joined wallet;
video progress reads52/100. One sample:10.9897 s from the test's submit helper
start to wallet visibility, including about2.3 s of automated pre-tap waits,
network/backup and polling; full test34.148 s. Approximate tap-dispatch-to-ready
interval8.65 s from logs. This is not isolated KDF time or physical iPhone speed.
Security defaults unchanged. Evidence in corresponding `default-brainvault/`
folders; full36.28 s video retained. Both local stands finish with healthy services.
These runs add acceptance evidence; neither required a product behavior change.

Latest maximum-text swap acceptance (07:02 UTC): 1/1 full native test passes in
130.325 s on iPhone 17 Pro / iOS 26.5, English/light,
`accessibility-extra-extra-extra-large`. Exact debit 24.999999 USDC, gross
0.009998 WETH, fee 0.0000009998 WETH, net 0.0099970002 WETH; remaining USDC
75.000001. Local service health remains green afterward. These are real isolated
local services, not public-testnet or camera acceptance. BrainVault uses the
existing custom six-shard test setting, not a default-performance measurement.

The run exposed a test-only skipped consent step when its lazy control was
off-screen; the fresh-wallet path now explicitly scrolls to consent. A subsequent
green financial run still showed a WETH number wrapping between digits. Review
and receipt amount rows now scale exact quantities to one line. Their original
native accessibility representation is preserved: the test caught and verified
the fix for an intermediate combined-label regression. Final screenshot review
confirms unbroken amounts; this is not a full VoiceOver task evaluation.

Evidence: `docs/evidence/ios-ux-20260918/large-swap/final.log`, candidate hashes
alongside; seven final screenshots in `output/ios-ux-2026-09-18/large-swap/final/`.
`final-demo.mp4` removes 78 seconds of setup at original playback speed;
`final-full.mp4` retains the entire run. Source checks pass 39/39 (32.222 s source
stage). Simulator font is restored to normal; no public deployment or install.

- Actual native onboarding, iPhone 17 Pro / iOS 26.5: initial full audit reported
  12 findings across welcome/create. After targeted changes: four in light mode
  (three contrast, one text clipping); one in dark mode (text clipping).
  The test deliberately retains failures and does not suppress issues.
- Fixed evidence: eye/recovery settings hit regions, unreadable decorative icon,
  redundant clipped name placeholder, primary button contrast, and several
  supporting-label contrast reports. The shared accent now follows the existing
  frontend/BrainVault light violet and dark gold palette.
- Remaining contrast reports include visually black text on pale backgrounds.
  Screenshots do not establish why Apple's audit rejects those nodes. Do not
  repeatedly darken colors or declare false positives without isolating them.
- The dark run requested the largest simulator content size, but its captured
  typography looks like the default size after the audit. **Largest-text layout
  acceptance is unproven**; next isolate it in a run without the automated audit,
  verify the effective size, then check scroll/focus/actions in English/Russian.
- Native build passes. `bun run check`: 39 source gates, 45.549 seconds.
  Password entry/show/hide, mismatch rejection, back navigation and background
  secret clearing regression passes: 1 test, zero failures, 29.777 seconds.
  No new payment/public-testnet claim. Artifacts are under
  `docs/evidence/ios-ux-20260918` and `output/ios-ux-2026-09-18`.

## Direct large-text verification · 2026-09-18 05:21 UTC

Changed the method: a separate XCTest launches at normal and largest accessibility
text size and requires the rendered welcome heading height to grow by more than
30%. It then reaches the create action, enters name/password and advances to
confirmation. Both English and Russian pass. This tests real native views with
no accessibility-audit call to alter the observation. Eight screenshots are in
`output/ios-ux-2026-09-18/large-text/`; the underlying logs are in
`docs/evidence/ios-ux-20260918/large-text.log`.

Visual inspection caught a broken-word English Continue label despite a green
interaction test. The decorative arrow is now omitted at accessibility sizes so
the text has the full button width. Both language tests pass again; the English
label fits in one line. Russian's longer label still wraps at the largest size;
it is operable, but not counted as ideal visual polish. Largest-text payment and
swap screens, VoiceOver and physical-device smoothness remain unverified.

Native build and all 39 source gates pass on this candidate (46.129 seconds).

## Largest-text payment follow-up · 2026-09-18

Real iOS 26.5 simulator payment testing at accessibility-extra-extra-extra-large
found two presentation issues. Recovery settings opened at half height with
only explanatory text visible; it now opens at full height for accessibility
sizes. Payment review retained the previous form's bottom scroll position, so
Confirm appeared before the amounts. Each new quote now gives the Form a fresh
identity and starts at the amounts. The existing payment XCTest asserts that
the maximum-payment heading is visible before continuing. Before/after images:
`output/ios-ux-2026-09-18/large-payment/`.

The UI test also needed scroll-aware handling of lazily created Form rows and
consent switches. XCTest's hittable flag can be true for a partly visible label
while the switch's coordinate is outside the viewport. The test now verifies
that coordinate before tapping; it does not inject consent or financial results.
Full largest-text payment now passes: one XCTest / zero failures / 114.954 s,
independent custody credit 1.000001 USDC, displayed sender balance 98.999998 USDC,
confirmed Activity and background locking. Real local hubs; invoice entered in
the input, not scanned by a camera. The final run is
`docs/evidence/ios-ux-20260918/large-payment/payment.log`; receipt alongside it.
Seven screenshots and the original-speed video are under
`output/ios-ux-2026-09-18/large-payment/`. The short video omits the first 88 s
of setup; the full recording is retained. `bun run check` passes all 39 source
gates in 31.803 s. Its first attempt timed out because the canonical-payment
scan decoded generated videos/screenshots as source; output media is now Git
ignored, retained on disk, and the unchanged seven-test gate passes in 1.64 s
alone / 1.76 s within the complete check. No timeout or assertion was relaxed.

The first swap regression attempt on this candidate was **blocked before UI launch**: the real
market maker emitted `TS_ACCOUNT_WORKER_UNMATCHED_RESPONSE:4:undefined` then
Bun 1.4.0 crashed with SIGSEGV in a Worker (299 process threads). The full log,
orchestrator receipt and macOS crash summary are in the same evidence directory.
This is a second native Bun crash, distinct from the earlier H1 breakpoint;
shared cause is unproven. A new instrumented run at 06:34 UTC passes the actual
native swap in 100.510 s, with real isolated local services healthy afterward.
Receipt: 24.999999 USDC debit, 0.009998 WETH gross, 0.0000009998 WETH fee;
balances reconcile to 75.000001 USDC and 0.0099970002 WETH. Review starts with
amounts visible; receipt and review screenshots were inspected. Current video
and seven screenshots: `output/ios-ux-2026-09-18/swap-current/`; full log:
`docs/evidence/ios-ux-20260918/worker-startup/swap.log`. The short clip trims
60 seconds of setup only. This swap uses normal text size, not maximum text.
The crash remains unresolved. Isolated production worker parity passes 20/20;
384 empty real-worker lifecycles also pass, which does not establish a cause.
The only runtime change adds envelope field/type evidence to the existing
unmatched-response fail-stop; no worker fallback or rejection suppression.
This establishes payment task completion at maximum
text size in English; it does not establish perfect layout, Russian financial
flows, VoiceOver or a release score.

Fresh payment recheck: actual SwiftUI test passed in 91.155 seconds against an
isolated real local hub/custody stack. Independent custody activity is finalized,
amount 1.000001 USDC, frame 27; sender final balance 98.999998 USDC and maximum
fee 0.000001 USDC. Background lock also passes. Raw video:
`output/ios-ux-2026-09-18/payment/full.mp4`; independent receipt:
`docs/evidence/ios-ux-20260918/custody-receipt.json`.
The invoice was entered through the payment-request field. This is not camera
scanning or a public-testnet payment; no substitute UI or mock funds were used.

Fresh native swap recheck passes in 97.785 seconds: requested 25 USDC, actual
debit 24.999999 USDC; gross 0.009998 WETH minus 0.0000009998 WETH fee equals
0.0099970002 WETH. Final USDC balance 75.000001. The test reconciles the receipt
with both displayed balances and switches the Home headline to WETH. Raw video
and screenshots: `output/ios-ux-2026-09-18/swap/`. Demo clips remove setup time
only; playback speed is unchanged and full recordings remain available.

Reflection at 05:26 UTC: direct layout tests resolved the ineffective large-text
observation; screenshots found a defect despite passing interaction checks.
Both financial flows were rerun after the visual change. Do not repeat these
unchanged normal-size happy paths next. First remaining useful boundary is
largest-text financial confirmation, followed by the unresolved audit reports.
Camera, VoiceOver and physical/public acceptance remain separate open gates.

Recovery update at 11:16 UTC: actual SwiftUI payment+backup and clean-second-
simulator restoration pass2/2 (103.291s +33.181s); balance98.999998USDC and exactly
one confirmed1.000001USDC payment restored, with independent recipient credit.
Videos: output/ios-ux-2026-09-18/tower-archive/. Subsequent native WebKit acceptance
passes6/6: restored wallet pays/swaps, reopens, restores an updated archive,
retries prepublication interruption and rejects overwriting existing data.
Exact receipts/fees and partial-history disclosure retained. Tower quota rejection
preserves the previous backup and permits a later valid upload. Evidence:
docs/evidence/ios-ux-20260918/backup-failures/. These checks do not establish
hardware camera, VoiceOver, power-loss durability or public-testnet readiness.
