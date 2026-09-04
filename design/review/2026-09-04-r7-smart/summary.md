# Design review summary

Reviewers: openrouter/anthropic/claude-sonnet-5, openrouter/moonshotai/kimi-k3

| screen | hierarchy | premium | typography | color | data_legibility | layout | visceral_value | responsive | consistency | trust | total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| desktop-dark/01-home.png | 780 | 740 | 755 | 760 | 675 | 670 | 375 | 660 | 720 | 675 | **681** |
| desktop-dark/04-receive.png | 780 | 760 | 720 | 720 | 690 | 750 | 450 | 720 | 745 | 710 | **705** |
| desktop-dark/05-swap.png | 700 | 605 | 660 | 700 | 580 | 700 | 300 | 700 | 710 | 530 | **619** |
| desktop-dark/06-account.png | 640 | 710 | 740 | 740 | 590 | 650 | 250 | 635 | 735 | 700 | **639** |
| desktop-dark/07-activity.png | 720 | 725 | 720 | 740 | 730 | 680 | 525 | 700 | 770 | 790 | **710** |
| desktop-dark/08-activity-detail.png | 720 | 725 | 720 | 740 | 730 | 680 | 525 | 700 | 770 | 790 | **710** |
| desktop-dark/09-settings.png | 675 | 660 | 730 | 625 | 730 | 630 | 760 | 665 | 710 | 695 | **688** |
| desktop-dark/10-move.png | 770 | 730 | 740 | 740 | 740 | 760 | 535 | 730 | 750 | 740 | **724** |
| desktop-dark/11-manage.png | 740 | 760 | 730 | 750 | 690 | 680 | 400 | 670 | 770 | 710 | **690** |
| desktop-dark/12-assets.png | 700 | 680 | 740 | 670 | 720 | 730 | 360 | 710 | 740 | 720 | **677** |
| desktop-dark/13-lend.png | 700 | 715 | 700 | 700 | 730 | 690 | 335 | 710 | 735 | 655 | **667** |
| desktop-dark/14-ownership.png | 715 | 750 | 740 | 740 | 690 | 650 | 550 | 650 | 745 | 750 | **698** |
| desktop-dark/15-sovereignty.png | 810 | 760 | 760 | 760 | 740 | 760 | 540 | 735 | 790 | 850 | **751** |
| desktop-dark/16-desk.png | 750 | 650 | 670 | 680 | 630 | 595 | 580 | 600 | 690 | 610 | **646** |
| desktop-dark/17-palette.png | 790 | 790 | 760 | 760 | 700 | 770 | 500 | 740 | 760 | 700 | **727** |
| mobile-dark/01-home.png | 740 | 720 | 750 | 705 | 670 | 650 | 425 | 680 | 720 | 685 | **675** |
| mobile-dark/04-receive-bottom.png | 675 | 690 | 700 | 710 | 675 | 660 | 350 | 680 | 710 | 680 | **653** |
| mobile-dark/04-receive.png | 720 | 710 | 720 | 720 | 700 | 690 | 325 | 720 | 710 | 690 | **671** |
| mobile-dark/05-swap.png | 665 | 605 | 680 | 610 | 600 | 655 | 300 | 680 | 635 | 485 | **592** |
| mobile-dark/06-account.png | 650 | 715 | 730 | 710 | 650 | 650 | 275 | 680 | 705 | 700 | **647** |
| mobile-dark/07-activity.png | 690 | 700 | 700 | 685 | 700 | 625 | 400 | 650 | 710 | 690 | **655** |
| mobile-dark/08-activity-detail.png | 755 | 765 | 755 | 730 | 755 | 725 | 450 | 735 | 730 | 810 | **721** |
| mobile-dark/10-move-bottom.png | 665 | 650 | 690 | 650 | 630 | 625 | 350 | 650 | 655 | 655 | **622** |
| mobile-dark/10-move.png | 675 | 660 | 700 | 650 | 640 | 645 | 350 | 680 | 655 | 665 | **632** |
| mobile-dark/11-manage.png | 720 | 745 | 730 | 710 | 690 | 735 | 350 | 735 | 730 | 700 | **685** |
| mobile-dark/12-assets-bottom.png | 650 | 630 | 700 | 605 | 690 | 660 | 300 | 670 | 650 | 635 | **619** |
| mobile-dark/12-assets.png | 690 | 675 | 710 | 640 | 700 | 650 | 325 | 685 | 665 | 680 | **642** |
| mobile-dark/13-lend-bottom.png | 670 | 670 | 690 | 675 | 655 | 650 | 275 | 670 | 670 | 640 | **627** |
| mobile-dark/13-lend.png | 670 | 675 | 695 | 680 | 660 | 645 | 275 | 685 | 675 | 645 | **631** |
| mobile-dark/14-ownership.png | 710 | 735 | 720 | 710 | 700 | 710 | 325 | 710 | 715 | 715 | **675** |
| mobile-dark/15-sovereignty-bottom.png | 725 | 740 | 725 | 695 | 700 | 710 | 500 | 710 | 720 | 820 | **705** |
| mobile-dark/15-sovereignty.png | 760 | 755 | 750 | 705 | 730 | 730 | 525 | 730 | 720 | 835 | **724** |

**Overall: 672 / 1000** (mean of screen totals across reviewers)

## Priority fixes by reviewer

### openrouter/anthropic/claude-sonnet-5 · mobile-dark · 674

The mobile-dark app has strong typographic and layout discipline with genuinely excellent trust/provenance moments (activity receipt, sovereignty), but the flagship 'visceral value' one-scale-bar concept is nearly invisible across the flows that should showcase it most (Home, Move, Lending) — mostly because the demo data is all zero and bars render as imperceptible hairlines. A leaked debug string on Swap and inconsistent indigo usage on testnet faucet buttons are the two clearest trust/brand violations to fix first.

- Force a minimum-visible bar fill (4px) even at $0 balances across Home, Move, Lending, Sovereignty so the one-scale-bar concept reads even in empty/demo states.
- Remove the raw 'MARKET_WIRE_JSON_REQUIRED' debug string from Swap's order book empty state and replace with a human message.
- Reserve indigo fill strictly for money-moving CTAs; recolor the four Assets faucet buttons to neutral outline style.
- Add the two-half send/receive account bar to the Account detail screen (06), which currently has zero balance visualization despite being the account's dedicated page.
- Fix truncated/clipped critical trust copy on Sovereignty ('...they answer in 1 d') and the Receive sheet's bottom-cut Entity ID card.

### openrouter/anthropic/claude-sonnet-5 · desktop-dark · 719

The design system is calm, consistent, and typographically confident, with genuinely strong dedicated screens for trust language (Sovereignty) and money movement (Move), but it systematically fails to deliver the rubric's core differentiator: the single-scale visceral bar. Almost every money screen (Home, Account, Assets, Lending, Swap) substitutes colored dots and numbers for the promised comparable horizontal bars, and a few screens ship visible bugs (placeholder debug string on Swap, clipped table on Desk, duplicate Activity screenshots).

- Implement the actual two-half bilateral account bar (send|receive, hatched holds, zero notch) on Account and Desk — currently absent everywhere it matters most.
- Render real balance bars at the global px/$ scale on Home, Assets and Lending instead of text-only rows, even at $0 as ghost/ticked outlines.
- Remove the leaked debug string 'MARKET_WIRE_JSON_REQUIRED' on Swap and add a proper empty-state for the order book.
- Fix Desk's clipped right-hand swap panel and reconcile the account table's column labels with the data actually rendered.
- Unify color/label vocabulary for account-state terms (secured/collateral, at risk/trust only) across Sovereignty and Desk, and ship distinct list vs. detail states for Activity (07/08 are currently identical).

### openrouter/moonshotai/kimi-k3 · mobile-dark · 645

A calm, coherent dark shell with genuinely good bones — restrained palette, strong hero numerals, letterspaced eyebrows, and a best-in-class trust story on Sovereignty and the receipt sheet. But the product's defining feature, the one-scale bilateral bar, is missing from Home, Account, Assets, Lending and Sovereignty, and shipping defects (raw MARKET_WIRE_JSON_REQUIRED error, content sliding under the tab bar, four indigo faucet CTAs, '1 movements') keep it well short of premium.

- Draw the canonical bars everywhere value is shown: stacked total bar on Home, two-half bilateral bar with notch on the H1 Account screen, per-token bars on Assets, utilization bar on Lending — all at the declared 1 px = $N scale; today the core differentiator exists only as a caption.
- Kill the Swap book's 'MARKET_WIRE_JSON_REQUIRED' raw constant; render a human empty-book state and route wire errors to logs.
- Fix scroll safe areas globally: content (Home RECENT, Assets faucets, Lending pool, Move header) must never render under or be clipped by the bottom tab bar.
- Enforce one indigo action per screen: demote three of the four faucet buttons, and give disabled primaries (Swap, Move, Lending) a non-indigo surface style plus an inline reason.
- Polish the details that break trust at reading distance: pluralize '1 movement(s)', stop truncating deadlines and filter chips, resolve the '0 of 1' rows into tappable deep links, and rename jargon ('lanes', 'Lazy (hash of its board)') into user language.

### openrouter/moonshotai/kimi-k3 · desktop-dark · 667

The shell is genuinely premium — calm obsidian surfaces, disciplined type, strong provability cues (committed frames, evidence bundles) and a Settings scale-explainer that proves the team understands the visceral-value idea. But the idea is executed almost nowhere: the bilateral bar is missing from the Account screen itself, zero states draw no scale tracks, raw dev errors leak into money screens, and the single-indigo rule is repeatedly broken (faucets, desk header, copy-link, export).

- Render the two-half bilateral bar (with zero-notch and empty tracks at $0) on the Account detail screen and as mini-bars on Home/Manage/Desk rows — the signature component currently exists only as a legend
- Replace MARKET_WIRE_JSON_REQUIRED and all internal strings in user-facing surfaces (Swap, Desk) with plain-language states; log codes to console
- Enforce one-indigo discipline: demote the four faucet buttons (Assets), two of three Desk header buttons, 'Copy link' (Receive) and 'Save evidence bundle' (Sovereignty) to secondary styles
- Delete the 'Risk color' customization in Settings and the gradient sample bar — semantic colors are fixed by spec, and Settings should teach that, not sell it
- Fix the Desk table overflow clipping its last column, and fill the void lower halves of Account/Manage/Ownership with the state data those screens own

## Issues per screen

### desktop-dark/01-home.png

- (claude-sonnet-5) Home: all values are $0.00 (empty state) so the one-scale bar principle cannot be judged — 'Balances' section shows only an empty-state string, no bar at all, defeating the core visceral_value concept on the flagship screen.
- (claude-sonnet-5) Home: the legend row under total balance (On-chain/Reserve/Secured/At risk) is four colored dots with numbers that duplicate what a bar should show visually; without any bar present this reads as a plain data table, not the promised visceral bar.
- (claude-sonnet-5) Home: right rail 'Accounts' row shows an em-dash for balance and 'no tokens' — ambiguous empty state, unclear if this is an error or a fresh account.
  - fix: Home: even in zero-balance state, render the ghost/outline bar at 0 width with tick marks so the scale mechanic is visible before user has funds.
  - fix: Home: replace the em-dash in Accounts row with an explicit '$0.00' to keep tabular-number alignment consistent with the rest of the screen.
  - fix: Home: move the 1px=$10·auto scale note closer to where a bar will render, currently orphaned above an empty list.
- (kimi-k3) Home desktop: the tier legend under the total (On-chain/Reserve/Secured/At risk) repeats four $0.00 numbers that add nothing at zero state; it reads as noise exactly where the eye lands second
- (kimi-k3) Home desktop: no bar is drawn anywhere, not even a zero-width track at the declared '1 px = $10 · auto' scale, so the one-scale principle is invisible on the very screen that should teach it
- (kimi-k3) Home desktop: the bottom 60% of the viewport is empty while the right rail cards (ACCOUNTS, RECENT) float high; the layout does not use the desktop canvas
- (kimi-k3) Home desktop: Receive and Swap are heavy bordered boxes visually near-equal to Pay; only the indigo fill differentiates the money action
  - fix: Home: collapse the four-tier legend into a single caption line under the total bar ('$0 yours · $0 at risk'), showing the split only when non-zero
  - fix: Home: render the total as a bar track at the pinned scale even at $0 (empty track + notch), so the scale metaphor exists before money does
  - fix: Home: make Receive/Swap ghost buttons (no border box, icon+label), keeping Pay as the sole solid indigo block
  - fix: Home: anchor BALANCES empty state with a sample-scale tick row so the empty area still communicates the px-per-dollar rule

### desktop-dark/04-receive.png

- (claude-sonnet-5) Receive: no bilateral bar showing 'receive up to' capacity anywhere except a small text line ('receive up to 0.00 instantly') — the visceral bar principle from the rubric is absent on a money-receiving screen.
- (claude-sonnet-5) Receive: QR code is stark white square with no border/inset shadow that separates it from the dark card — looks visually heavy and slightly clashes with the otherwise restrained obsidian material.
- (claude-sonnet-5) Receive: entity ID block wraps mid-hex with no copy button — a raw wrapped hex string is low-trust and hard to tap/select precisely.
  - fix: Receive: add a copy icon button next to 'YOUR ENTITY ID' hex string, and truncate to 0x1234…abcd with a tooltip/expand, matching truncation pattern used in Account screen (06).
  - fix: Receive: give the QR white card a 1px hairline border matching card borders elsewhere, and reduce its corner radius to match other cards.
  - fix: Receive: render a small horizontal receive-capacity bar above/below the amount field instead of only text, at the global px-per-$ scale.
- (kimi-k3) Receive desktop: three competing copy affordances (grey 'Copy invoice', indigo 'Copy link', plus a tiny 'Copy xln:// app link' text link) — the indigo accent is spent on a non-money action, violating the one-accent rule
- (kimi-k3) Receive desktop: YOUR ENTITY ID shows the full 40-char hex wrapping mid-string across two lines; ugly and unreadable, when the truncated form is used everywhere else
- (kimi-k3) Receive desktop: the amount placeholder '0.00' in mid-grey is indistinguishable from a typed zero value; a user cannot tell whether an amount is set
- (kimi-k3) Receive desktop: 'receive up to 0.00 instantly' is the right data in the right place but at 0 there is no cue how to raise it except the banner far below
  - fix: Receive: make 'Copy invoice' the single primary (invoice carries amount+note), demote 'Copy link' to a text button, delete the third 'xln://' link
  - fix: Receive: truncate the entity id to 0x25ee…b6ed with a copy-on-click, matching the truncation used on Ownership/Settings
  - fix: Receive: use a true placeholder style (lighter grey, no currency precision) or an empty field with 'Amount' label; never render placeholder as a valid value
  - fix: Receive: inline-link '0.00 instantly' to the Open H1 action so the limit and its fix sit together

### desktop-dark/05-swap.png

- (claude-sonnet-5) Swap: BOOK panel shows a literal placeholder string 'MARKET_WIRE_JSON_REQUIRED' — an internal dev/debug token leaking into shipped UI, breaks trust and premium feel immediately.
- (claude-sonnet-5) Swap: 'PRICE USDC / SIZE WETH' column headers have no rows beneath them, an empty order book with no empty-state message ('no open orders' or similar), reads as broken.
- (claude-sonnet-5) Swap button is rendered in a washed/lighter indigo than the Pay button on other screens (06, 16) — same primary action color should not visibly desaturate when disabled state differs from a hover/press state elsewhere.
  - fix: Swap: remove 'MARKET_WIRE_JSON_REQUIRED' string entirely; replace with 'Order book syncing…' consistent with the syncing dot already shown.
  - fix: Swap: add an explicit empty-state under the book headers, e.g. 'No resting orders yet.'
  - fix: Swap: disabled Swap button should use a fixed disabled-token color (e.g. 40% opacity of indigo) rather than an arbitrary muted purple that reads as a separate color from active Pay elsewhere.
- (kimi-k3) Swap desktop: the book panel shows the raw internal error 'MARKET_WIRE_JSON_REQUIRED' to the user — a dev-facing string in a money UI destroys trust at the exact moment of price discovery
- (kimi-k3) Swap + Desk desktop: '1 tick = 1/10,000 USDC' is protocol jargon exposed as help text; no user can act on it
- (kimi-k3) Swap desktop: the disabled Swap button keeps a washed-out indigo fill with grey label, reading as 'broken primary' rather than 'unavailable'; disabled money actions should go fully neutral
- (kimi-k3) Swap desktop: 'Up to 0.00 with H1' and 'from H1' are good context, but with a syncing book and typed 100 in, the receive side shows a grey 0.00 that looks like a quote of zero — dangerous ambiguity
  - fix: Swap: replace MARKET_WIRE_JSON_REQUIRED with 'Book unavailable — reconnecting to H1' and log the raw code to console only
  - fix: Swap: when the book is not live, show '—' (em dash) in 'You receive' instead of 0.00 so no fake quote is implied
  - fix: Swap: disabled money buttons render as neutral dark surface with muted label; indigo appears only when the action is live
  - fix: Swap: replace the tick footnote with 'Tap a price in the book to fill this ticket'

### desktop-dark/06-account.png

- (claude-sonnet-5) Account: this is exactly where the bilateral two-half bar (send-left/receive-right with zero notch) should anchor the page per rubric, but the page shows only a text card ('THIS ACCOUNT') with rows — no bar at all.
- (claude-sonnet-5) Account: 'Frames signed: 0' sits next to 'Status: Open' with no visual distinction of what 0 frames means for trust (new vs stale) — a first-time user cannot tell if this is expected.
- (claude-sonnet-5) Account: the four action buttons (Pay/Extend credit/Swap/Manage) are equal-weight grey except Pay; 'Extend credit' is arguably as important as Pay for a fresh zero-credit account and gets no visual priority.
  - fix: Account: add the two-half bilateral bar (send | receive, hatched holds, zero notch) directly under the header, per rubric's core deliverable, even at $0 scale as a ghost outline.
  - fix: Account: add a one-line caption near 'Frames signed: 0' such as 'no history yet' to disambiguate zero-state from stale/broken.
  - fix: Account: promote 'Extend credit' with a lighter indigo outline when credit line is zero, since it's the next required action.
- (kimi-k3) Account desktop: the signature bilateral bar (send half / receive half / zero notch) is completely absent on the account detail screen — the one screen where the two-half bar is the whole point; visceral_value fails here by omission
- (kimi-k3) Account desktop: no credit line, collateral, or owed numbers appear in the main column at all; 'Frames signed 0' in the side card is the only state, so the screen cannot answer 'what is my position with H1'
- (kimi-k3) Account desktop: four action buttons (Pay / Extend credit / Swap / Manage) occupy the top and the remaining ~70% of the viewport is void
- (kimi-k3) Account desktop: 'Extend credit' carries a '+' icon and equal visual weight to Pay, splitting the money-action emphasis
  - fix: Account: render the full-width bilateral bar directly under the header — left half send-capacity (green secured + violet owed), right half receive room, zero notch, hatched holds — even when all segments are zero-width tracks
  - fix: Account: add a numbers row under the bar: 'you can send $0 · you can receive $0 · collateral $0 · credit line $0' in tabular numerals
  - fix: Account: demote Extend credit/Swap/Manage to a secondary row; Pay alone stays indigo
  - fix: Account: fill the empty lower region with this account's recent frames list (it exists on Home/Activity already)

### desktop-dark/07-activity.png

- (claude-sonnet-5) Activity/08-activity-detail (duplicate frames): the two screenshots (07 and 08) are pixel-identical — same detail card open, same list — so no distinct 'list vs detail' state is actually shown despite being named as different screens.
- (claude-sonnet-5) Activity: filter pills (All/Payments/Swaps/Settlement/Accounts) have no counts and no indication which will have zero results, causing dead-end taps in this near-empty account.
- (claude-sonnet-5) Activity: detail panel duplicates the row's icon+title already visible in the list at 2x size with no added information beyond Frame/Time — low information density for the space given.
  - fix: Activity: differentiate 07 (list view, no selection) from 08 (detail expanded) — currently identical, so ship the actual empty/unselected list state for 07.
  - fix: Activity: grey out or badge-count filter pills for categories with 0 items.
  - fix: Activity: replace the oversized restated title in the detail card with a compact header + a proof/hash line (e.g. signature icons) to add trust-relevant content, matching Sovereignty screen's evidence-bundle pattern.
- (kimi-k3) Activity desktop: header reads '1 movements' — ungrammatical pluralization in the top-right summary
- (kimi-k3) Activity + Activity detail desktop: the five filter chips are bordered pills, adding five outlines of visual noise above a single-row list
- (kimi-k3) Activity desktop: the detail card is strong ('From your runtime's committed frames', Frame #7) but the list row's state is a lowercase dot + 'created' while the card uses uppercase 'CREATED' — two vocabularies for one state
- (kimi-k3) Activity desktop: list column ends at ~60% width and the detail card leaves the right quarter empty; two-column balance is off
  - fix: Activity: pluralize the counter ('1 movement' / 'N movements')
  - fix: Activity: convert filter chips to borderless text tabs with an indigo underline on the active one
  - fix: Activity: unify state vocabulary — lowercase 'created' with dot in both row and card, or uppercase eyebrow in both
  - fix: Activity: widen the list to ~55% and let the detail card take the remainder with a fixed gutter

### desktop-dark/08-activity-detail.png

- (claude-sonnet-5) See 07-activity.png: identical screenshot, same issue about missing distinct detail state.
- (claude-sonnet-5) Activity detail: 'From your runtime's committed frames' green dot label is good provability language but is the only trust signal on the card — no hash/signature preview shown despite this being the single most consensus-relevant screen in the set.
  - fix: Activity detail: add the frame hash (truncated) and signer confirmation checkmarks beneath 'Time', reusing the truncated-hex + copy pattern from Receive/Ownership screens.
  - fix: See 07-activity.png fixes.
- (kimi-k3) Activity detail desktop: this file is pixel-identical to 07-activity.png — the detail state is not a distinct view; selection state on the list row is not visibly indicated, so the 'detail' screen cannot be told apart from the list
- (kimi-k3) Activity detail desktop: the detail card leads with a 28px 'Account opened' duplicating the row title, while the provable facts (Frame #7, counterparty id, time) are smaller — hierarchy favors the label over the evidence
- (kimi-k3) Activity detail desktop: same '1 movements' grammar error and bordered filter chips as 07
  - fix: Activity detail: give the selected row a persistent indigo left-edge marker or elevated surface so list↔detail linkage is visible
  - fix: Activity detail: promote Frame #7 and the counterparty id to the card's primary line; demote the title to an eyebrow
  - fix: Activity detail: add the frame hash (truncated, copyable) to the card — the receipt claim ('committed frames') should be inspectable in one click

### desktop-dark/09-settings.png

- (claude-sonnet-5) Settings: page is a single unbroken long scroll mixing scale config, appearance, design tokens, tour, runtime debug info and vault danger-zone actions — seven distinct concern groups with only small caps labels to separate them, weak information architecture for desktop width.
- (claude-sonnet-5) Settings: the 'AT THIS SCALE' reference card on the right (good micro-lesson on the bar principle) is orphaned next to the scale slider only, then the rest of the page (Home toggles, Appearance, Design, Tour, Runtime, Vault) has no matching right-rail content, leaving a huge empty gap for ~70% of the page height.
- (claude-sonnet-5) Settings: 'Forget vault' destructive action sits inline with 'Reveal recovery phrase' and 'Lock' at equal button weight/size, differentiated only by red text — a two-tap destructive account-deletion action needs stronger isolation (confirmation, spacing, or a separate danger section).
  - fix: Settings: split into tabbed or accordioned sections (Scale, Home, Appearance, Design, Runtime, Vault) so desktop width isn't a single 1900px-tall scroll with a mostly-empty right column.
  - fix: Settings: keep the right rail populated per section (e.g. show current theme preview beside Appearance, key fingerprint beside Vault) instead of only for Scale.
  - fix: Settings: separate 'Forget vault' into its own bordered danger zone with a confirming dialog, per trust/error-prevention rubric criterion.
- (kimi-k3) Settings desktop: 'Risk color' offers Violet/Red/Orange customization — the product spec fixes position colors as semantic and immutable; letting users recolor 'what is owed to you at risk' breaks cross-screen color literacy
- (kimi-k3) Settings desktop: the DESIGN sample bar is a green→indigo gradient; the spec's bars are flat semantic segments — the one decorative gradient in the app lives in the screen that defines the design system
- (kimi-k3) Settings desktop: 'AT THIS SCALE' preview card (10px/100px/1,000px/10,000px bars) is the best visceral-scale execution in the whole build — but it sits in Settings instead of being visible where bars actually render
- (kimi-k3) Settings desktop: six segmented controls (Comfort/Desk, Dark/Light, Material, Accent, Numbers, Risk color) plus eight dollar chips make the page read as a control panel, not a calm settings surface
  - fix: Settings: delete the Risk color picker; semantic colors are fixed by spec
  - fix: Settings: replace the gradient sample bar with flat green/violet/grey segments at the current px scale
  - fix: Settings: move the 'AT THIS SCALE' mini-preview next to the Home total (or show it on hover of the '1 px = $10' caption) so the scale is explained in context
  - fix: Settings: group Material/Accent/Numbers into one collapsed 'Design presets' row that expands on click, cutting the segmented-control count on first paint

### desktop-dark/10-move.png

- (claude-sonnet-5) Move: the tiny grey bar slivers at the bottom of each From/To card (Wallet/Reserve/Account) are the only visceral-bar element on the page and are too small/subtle to read as the promised 'one absolute scale' bars — at $0.00 they're indistinguishable decoration.
- (claude-sonnet-5) Move: error text 'Amount exceeds what is available here' appears in red at the bottom after a fully filled, seemingly valid-looking form (250 amount, valid from/to selection) — the error is disconnected from which specific field/card triggered it.
- (claude-sonnet-5) Move: 'Sign & send' primary button is enabled/blue-looking despite the validation error below it being visible — button should be visually disabled while the error is showing.
  - fix: Move: when amount exceeds source balance, add a red ring/border directly on the offending Reserve/Account source card, not just a floating text line below the whole form.
  - fix: Move: disable/grey 'Sign & send' whenever the exceeds-available error is present; currently it reads as clickable/blue.
  - fix: Move: increase the From/To capacity bar height to be legible even near-zero (e.g. minimum 2px stub) so it reads as a bar, not a border artifact.
- (kimi-k3) Move desktop: the six From/To tiles each repeat '0.00 USDC' with a barely-visible bar sliver — six identical numbers of noise; the slivers are too small to read as the one-scale bar system
- (kimi-k3) Move desktop: 'Sign & send' is disabled with no inline reason on the button itself; the red 'Amount exceeds what is available here' sits ~80px below, disconnected from the control it disables
- (kimi-k3) Move desktop: the amount '250' is typed against 'up to 0.00 USDC' — good error prevention, but the field does not visually flag (no red underline/field state), only the detached caption does
- (kimi-k3) Move desktop: 'Add to batch' and 'Sign & send' disabled states are nearly identical greys; the primary action loses its identity entirely when unavailable
  - fix: Move: drop the per-tile balance line in favor of one real scale bar per tile (height 4px, pinned scale), letting length carry the comparison the numbers currently repeat
  - fix: Move: put the failure reason on the disabled button itself ('Sign & send — exceeds available') or as a tooltip on hover
  - fix: Move: add a red field state (1px underline + red 'up to' caption) when amount exceeds available
  - fix: Move: keep a faint indigo outline on the disabled primary so its role survives its state

### desktop-dark/11-manage.png

- (claude-sonnet-5) Manage: this is a pure navigation hub (6 tiles + 1 list) with zero dollar amounts or bars anywhere, missing an opportunity to surface e.g. total on-chain assets or total lending exposure at a glance before drilling in.
- (claude-sonnet-5) Manage: 'NEEDS ATTENTION' card says 'Nothing waiting on you' in the same low-emphasis grey as every other label — a state meant to reassure users of safety gets no distinct positive-state styling (e.g. green check) matching the language used on Sovereignty ('nothing at risk').
  - fix: Manage: add a subtotal line under Assets tile (on-chain total) and Lending tile (active principal) so the hub previews real numbers, not just descriptions.
  - fix: Manage: give 'Nothing waiting on you' a small green check icon consistent with the 'nothing at risk' treatment on Sovereignty (15) for cross-screen consistency.
- (kimi-k3) Manage desktop: the five destination cards (Sovereignty/Move/Assets/Lending/Ownership) end at 40% viewport height; everything below is void — the weakest desktop space use in the set
- (kimi-k3) Manage desktop: the H1 account row reads '0 lanes · 0 frames · open' — three pipe-middot facts, two of which ('lanes', 'frames') are protocol jargon a user never asked for
- (kimi-k3) Manage desktop: 'NEEDS ATTENTION — Nothing waiting on you' is a good honest empty state, but it renders as a bordered empty box, doubling chrome for zero content
  - fix: Manage: render account rows with the bilateral mini-bar (same component as Home/Desk) instead of the 'lanes · frames' string
  - fix: Manage: when NEEDS ATTENTION is empty, render a single quiet text line without the card chrome
  - fix: Manage: move the ACCOUNTS card into the left column as the primary content and demote the five navigation cards to a compact secondary row, filling the viewport with state instead of menu

### desktop-dark/12-assets.png

- (claude-sonnet-5) Assets: token rows (USDC/WETH/USDT) show only numeric balances with no bar at all, despite this being exactly the 'on-chain wallet' money location the rubric requires to be shown at the global px/$ scale alongside Home.
- (claude-sonnet-5) Assets: four faucet action buttons are all filled indigo at equal weight ('Hub pays me...', 'USDC to my wallet', 'Gas to my wallet', 'USDC to my reserve') — indigo is meant to be reserved for the one action that moves real money, but here it's used for four different test-only actions, diluting its meaning.
- (claude-sonnet-5) Assets: 'Depository may pull 0.00' repeated identically on all three token rows is a redundant technical label at full row height; could be tightened to one shared line since the value is currently the same across all tokens.
  - fix: Assets: render each token row's balance bar at the global scale, matching the rest of the app.
  - fix: Assets: demote faucet buttons to outline/secondary style since this is test-only functionality, reserving solid indigo for 'Move into reserve'.
  - fix: Assets: collapse 'Depository may pull X' into a single caption line under the section header when it's identical across rows, rather than repeating per-row.
- (kimi-k3) Assets desktop: the FAUCETS panel stacks four full-width solid indigo buttons ('Hub pays me…', 'USDC to my…', 'Gas (ETH)…', 'USDC straight into…') — the single-action indigo is spent four times on one panel, and on test-money utilities rather than real money movement
- (kimi-k3) Assets desktop: the faucet token picker (USDC/WETH/USDT/TRX/SUN bordered buttons) adds a five-button grid of chrome inside an already button-heavy panel
- (kimi-k3) Assets desktop: 'Depository may pull 0.00' is repeated under all three token rows verbatim; the information is right but the repetition reads as a template bug at zero state
- (kimi-k3) Assets desktop: token rows carry no scale bars, so USDC/WETH/USDT balances cannot be compared at a glance — the one-scale principle stops at Home
  - fix: Assets: collapse the four faucet buttons into one indigo 'Get test tokens' that opens a sheet with the four routes as list options
  - fix: Assets: replace the token button grid with a compact segmented control
  - fix: Assets: at zero balances, show 'Depository may pull —' once as a card-level caption instead of per-row
  - fix: Assets: append the pinned-scale bar to each token row, right-aligned before the number

### desktop-dark/13-lend.png

- (claude-sonnet-5) Lending: no bar visualization for Available/Borrowed/Active principal in the H1 Pool card, though these three numbers are exactly the kind of stacked-bar comparison the rubric's visceral principle calls for.
- (claude-sonnet-5) Lending: '1 day' term button is selected with a blue outline identical to the Hub selector's selected style above it, but 'H1 · 0 lanes' hub selector box uses filled dark-blue background for selection while Term uses only an outline — same selection concept, two different visual treatments on one page.
- (claude-sonnet-5) Lending: '100 = 1.00% per term' basis points helper math is placed to the right of the input at small size, easy to miss; a user could misread 100bps as 100% without noticing the correct conversion.
  - fix: Lending: add a stacked mini-bar in the H1 Pool card showing Available vs Borrowed vs Active at the global scale.
  - fix: Lending: unify selection style — use filled background for selected state consistently for both Hub and Term selectors.
  - fix: Lending: increase size/contrast of the '= 1.00% per term' conversion text, or move it inline directly under the basis-points input.
- (kimi-k3) Lending desktop: the 'Token' row renders as an empty dark field with the Lend/Borrow segmented control floating beneath it — the token is unset with no label of that fact, and the segmented control looks like it belongs to the empty field
- (kimi-k3) Lending desktop: term options render as 1 hour / 1 day on one row and 1 month alone below at a different width — an uneven 2-over-1 grid that reads as a layout accident
- (kimi-k3) Lending desktop: '= 1.00% per term' wraps to two lines inside the interest field's right edge, colliding with the field boundary
- (kimi-k3) Lending desktop: 'Offer to the pool' is disabled with a washed indigo fill and no stated reason (amount is 0.00 — but the UI never says so)
  - fix: Lending: give the Token row a real placeholder ('Select token') or default to USDC; visually detach Lend/Borrow as the form's mode switch above the Hub card
  - fix: Lending: make the three term buttons equal-width in a single row (33/33/33)
  - fix: Lending: move the APR conversion below the field as a caption ('= 1.00% per term') instead of inline-wrapped
  - fix: Lending: disabled state reads 'Offer to the pool — enter an amount' in muted label text

### desktop-dark/14-ownership.png

- (claude-sonnet-5) Ownership: correctly has no bars since there's no money on this screen — good restraint, but 'Threshold: 1 of 1' and 'Kind: Lazy' are dense governance jargon with zero inline explanation beyond one small paragraph at the bottom; a non-technical owner won't parse 'Lazy (hash of its board)' quickly.
- (claude-sonnet-5) Ownership: 'TAKE CONTROL OF ANOTHER ENTITY' card negative-state message ('Nothing to take over...') takes the same visual weight/size as an actionable card elsewhere (e.g. Accounts card on Manage screen), risking users expecting it to be clickable.
  - fix: Ownership: add a tooltip or inline glossary link on 'Lazy' governance kind, one tap away, rather than only the paragraph below the table.
  - fix: Ownership: reduce visual card treatment (remove border/shadow) for the empty 'take control' state so it reads clearly as non-interactive information, not a disabled action card.
- (kimi-k3) Ownership desktop: 'Kind: Lazy (hash of its board)' is raw protocol vocabulary presented as a primary fact; the explainer below does the teaching the label should do
- (kimi-k3) Ownership desktop: content occupies the top ~40% of the viewport; the rest is void — same under-fill problem as Account and Manage
- (kimi-k3) Ownership desktop: TAKE CONTROL empty state is honest but the two cards sit at different heights with no grid relationship, leaving a ragged right edge
  - fix: Ownership: relabel Kind to 'Unregistered entity' with the lazy-hash detail moved into the explainer
  - fix: Ownership: align the two cards to a shared top and equal min-height
  - fix: Ownership: add a board-members section (even if just 'you') to fill the lower space with the data this screen owns

### desktop-dark/15-sovereignty.png

- (claude-sonnet-5) Sovereignty: this screen best executes the green/violet semantic split with an explicit legend right under the total, which is exactly the rubric's intended language — strong screen, but still shows no actual bar, only colored-dot + number pairs, so visceral_value is capped by absence of the promised bar geometry.
- (claude-sonnet-5) Sovereignty: 'PER COUNTERPARTY' H1 row shows 'awaiting their signature · no proof yet · they answer in 1 d, you in 1 d' as one long comma-run string — three distinct facts crammed into a single sentence with no visual separation, hard to scan under time pressure.
- (claude-sonnet-5) Sovereignty: 'Save evidence bundle' primary indigo button sits directly below zero-value ledger stats with no clear reason to click it yet (nothing to save) — button should likely be disabled/secondary until there's a signed frame worth exporting.
  - fix: Sovereignty: render the green/violet totals as a two-segment stacked bar (matching the rubric's bar language) instead of only text+dot legend.
  - fix: Sovereignty: break 'awaiting their signature · no proof yet · they answer in 1 d, you in 1 d' into two stacked lines: status, then the SLA times.
  - fix: Sovereignty: grey out 'Save evidence bundle' when Accounts co-signed = 0, since there's nothing meaningful to export yet.
- (kimi-k3) Sovereignty desktop: the legend row (On-chain/Reserve/Collateral behind what you are owed/Trust only) repeats four $0.00s, and the two full prose paragraphs below re-explain the same semantics — the same lesson is taught three times in one viewport
- (kimi-k3) Sovereignty desktop: 'Save evidence bundle' is a full solid indigo button — a strong trust feature, but it spends the money-action accent on an export
- (kimi-k3) Sovereignty desktop: 'Can dispute without asking: 0 of 1' in amber reads as a warning when it is actually the expected state of a fresh account; the color implies a problem that does not exist
- (kimi-k3) Sovereignty desktop: per-counterparty line 'awaiting their signature · no proof yet · they answer in 1 d, you in 1 d' packs four facts with middots — the most information-dense line in the app at the smallest size
  - fix: Sovereignty: keep the legend, cut the two paragraphs into a single 2-line caption with a 'How this works' expander
  - fix: Sovereignty: restyle 'Save evidence bundle' as a bordered secondary with a shield icon; reserve indigo for money movement
  - fix: Sovereignty: render '0 of 1' dispute coverage in neutral grey until it diverges from the safe default; amber only when a counterparty is actually uncooperative
  - fix: Sovereignty: split the counterparty line into two lines — state ('awaiting their signature') and timing ('answers in 1 d · you in 1 d')

### desktop-dark/16-desk.png

- (claude-sonnet-5) Desk: the swap book panel on the right is clipped mid-column ('WETH/USDC/H1' with left edge cut off, 'FR' column header truncated at the table edge) — content overflow/clipping on the flagship dense desktop layout is a real bug, not a density choice.
- (claude-sonnet-5) Desk: the account table header row (ACCOUNT·LANE / POSITION / SECURED / AT RISK / YOU OWE / SEND·RECEIVE / LINES OUT/IN / FR...) has 8 columns crammed with no visible column widths tuned to content, and the single data row ('Reserve · on-chain') doesn't actually match several headers (e.g. 'LINES OUT/IN' shows a dollar pair, not a line count) — column/data mismatch undermines trust in this dense view.
- (claude-sonnet-5) Desk: legend at bottom (on-chain/reserve/collateral/at risk/you owe/credit room/in flight — 7 colored dash swatches) is small, low-contrast grey text competing with the table just above it for eye attention, and duplicates color meaning already established in Sovereignty's legend with a different label set ('collateral' vs 'secured', 'trust only' vs 'at risk').
  - fix: Desk: fix the swap book panel's clipped right edge so 'H1' hub name and 'FR' (likely 'FRAME') column are fully visible, not cut by the card boundary.
  - fix: Desk: align table column labels to actual data semantics (rename 'LINES OUT/IN' or fix the underlying data render), and set explicit min-widths so numeric columns don't wrap/clip on 1280px viewport.
  - fix: Desk: standardize the legend vocabulary across Desk and Sovereignty (pick one of 'secured'/'collateral' and one of 'at risk'/'trust only') so the same concept has one name everywhere per the consistency rubric parameter.
- (kimi-k3) Desk desktop: the table's last column header is clipped at the right edge ('FR…') — the table overflows its container under the book panel; a dense console that cuts its own columns reads as broken, not dense
- (kimi-k3) Desk desktop: three solid indigo buttons (Pay / Swap / Move) sit side by side in the header — the one-action accent rule is spent three times in the app's densest screen
- (kimi-k3) Desk + Swap desktop: 'MARKET_WIRE_JSON_REQUIRED' raw error appears again in the book panel
- (kimi-k3) Desk desktop: the seven-swatch legend (on-chain/reserve/collateral/at risk/you owe/credit room/in flight) is the correct semantic vocabulary, but three of the swatches are near-identical greens at 10px size — indistinguishable at a glance
  - fix: Desk: fix the table container to the grid column width (or make the table horizontally scrollable with a shadow cue) so FRAMES column is never clipped
  - fix: Desk: keep Pay indigo; restyle Swap and Move as quiet bordered buttons
  - fix: Desk: replace the raw error string with 'Book unavailable — reconnecting' and a retry affordance
  - fix: Desk: differentiate the three greens by luminance steps (on-chain brightest, reserve mid, collateral deep) and verify 3:1 separation at 10px

### desktop-dark/17-palette.png

- (claude-sonnet-5) Palette: command list mixes primary money actions (Pay, Receive, Swap, Move) with navigation destinations (Home, Desk, Activity, Manage, Sovereignty, Assets, Lending) in one flat undifferentiated list with identical row styling — no visual grouping (e.g. a divider or section label) between 'actions' and 'destinations' despite them being conceptually different.
- (claude-sonnet-5) Palette: selected first row 'Pay' has a solid filled highlight while every other row is plain — good default-selection affordance, but the palette overlay's backdrop dimming leaves the underlying Home page fully legible behind it including its own $0.00 numbers, creating visual competition with the palette's own text at the same size.
  - fix: Palette: add a subtle section divider/label ('Actions' vs 'Go to') splitting Pay/Receive/Swap/Move from Home/Desk/Activity/etc.
  - fix: Palette: increase backdrop dimming opacity behind the palette overlay so background numerals don't visually compete with the palette's own row labels.
- (kimi-k3) Palette desktop: right-side hints are cryptic fragments — 'batch, attention, doors' for Manage uses 'doors', an internal metaphor no user can decode; 'dense console' for Desk is a designer's description, not a user's
- (kimi-k3) Palette desktop: Ownership is a navigable screen (from Manage) but has no entry here, so ⌘K cannot reach a real destination
- (kimi-k3) Palette desktop: the list shows eleven static entries with the input empty — no recents, accounts (H1), or actions ('Pay H1 $50') pre-seeded, underselling the palette as a command surface
  - fix: Palette: rewrite hints in user verbs — Manage: 'accounts, batches, approvals'; Desk: 'everything at once'
  - fix: Palette: add Ownership (and Settings) entries so every screen is reachable
  - fix: Palette: seed the empty state with recents and account-scoped actions ('Open H1', 'Pay H1…')

### mobile-dark/01-home.png

- (claude-sonnet-5) Home: no data state means the visceral one-scale bar principle cannot be judged; balance rows show no bars at all under BALANCES, defeating the core value prop on the most-visited screen.
- (claude-sonnet-5) Home: the legend row (On-chain/Reserve/Secured/At risk) repeats four labels with $0.00 each in dense small type, hard to scan; consider one combined green total plus one violet total.
- (claude-sonnet-5) Home: 'Instant: send up to/receive up to' line duplicates info that belongs on the account row itself, adding a fourth stat line before any content loads.
- (claude-sonnet-5) Home: H1 hub account row shows an em-dash and 'no tokens' instead of a zero-value bar with notch — inconsistent empty state vs the promised bar language.
  - fix: Home: render the two-half bar with a visible notch on every account row even at $0, so the mental model registers immediately.
  - fix: Home: collapse the four-item legend into two chips (green total, violet total) directly under the total balance number.
  - fix: Home: move 'send up to / receive up to' into the Pay/Receive button subtext instead of a standalone line.
- (kimi-k3) Home: the RECENT card slides under the bottom tab bar — 'Account opened' row and its icon are cut in half behind the Home/Activity/Manage/Settings bar; content scroll region ignores the tab bar safe area.
- (kimi-k3) Home: five '$0.00' figures (total + 4 legend items + instant line showing two more) dominate the hero in zero state; the legend swatch row repeats numbers that could live as captions under one stacked bar.
- (kimi-k3) Home: the one-scale bar system is announced ('1 px = $10 · auto') but no bar is drawn anywhere on the screen — the BALANCES section is pure text empty state, so the core 'visceral value' promise is invisible on the most important screen.
- (kimi-k3) Home: 'Instant: send up to $0.00, receive up to $0.00' buries the send/receive asymmetry in one prose line; the bilateral two-half framing (sendable vs receivable) that defines the product is lost.
  - fix: Add bottom padding equal to tab bar height + safe area to the Home scroll view so the RECENT card clears the tab bar.
  - fix: Draw the stacked total bar (green on-chain/reserve/secured, violet at-risk, 1 px = $10) directly under the total even at zero — a 1-2 px baseline track with the scale caption — so the scale legend has a referent.
  - fix: Split the instant line into two columns aligned with the legend: 'send up to X' / 'receive up to Y', matching the account bar's two halves.

### mobile-dark/04-receive-bottom.png

- (claude-sonnet-5) Receive sheet: 'No inbound room yet' callout uses the same card style/indigo bolt icon as Share card below, visually competing for the same attention weight — user can't tell which is the primary blocker.
- (claude-sonnet-5) Receive sheet: Entity ID card at the very bottom is truncated by viewport, forcing scroll to reach the most sovereign identifier of the wallet.
  - fix: Receive sheet: give the inbound-room warning a distinct red/amber left border, demote Share card to plain list style with no icon.
  - fix: Receive sheet: pin 'Your entity ID' as a persistent compact row near top, not a full card at the bottom.
- (kimi-k3) Receive (scrolled): a clipped white rounded shape (bottom of the QR card) hangs at the top edge with no fade or header — reads as a rendering glitch rather than scrolled content.
- (kimi-k3) Receive: the YOUR ENTITY ID card shows the full 64-char hex wrapping across two lines with no copy button on the card itself — the one artifact a payer might need manually is the hardest to grab.
- (kimi-k3) Receive: 'No inbound room yet' banner uses the indigo bolt icon plus indigo 'Open H1' link inside a bordered card — three emphasis treatments for one informational notice.
  - fix: Pin a small 'Receive' header (or fade gradient) at the top of the scroll container so clipped cards never touch the viewport edge raw.
  - fix: Add a copy icon button to the entity id card and truncate the id to 0x0eeb…a3803 with tap-to-expand.
  - fix: Drop the card border on the notice; keep icon + text + single link at 80% opacity.

### mobile-dark/04-receive.png

- (claude-sonnet-5) Receive: the QR code sits atop a near-black background at very high contrast (cream on black) creating the single loudest element on the page, more attention-grabbing than the amount or total — fine for scanning but it visually dwarfs the '0.00' amount which is the actual data.
- (claude-sonnet-5) Receive: 'receive up to 0.00 instantly' sits in default grey with same weight as 'Amount · optional' label, both compete; the instant-receive number is more actionable and should be higher emphasis.
  - fix: Receive: reduce QR card corner radius/size ~15% or add a card border matching other cards so it feels integrated, not a foreign white block.
  - fix: Receive: make 'receive up to X instantly' indigo or white-bold since it is the actionable ceiling amount.
- (kimi-k3) Receive: three sharing affordances compete — 'Copy invoice' (secondary button), 'Copy link' (indigo primary), and 'Copy xln:// app link' (text link) — the user cannot tell which one to hand a payer.
- (kimi-k3) Receive: the amount placeholder '0.00' is rendered in the same dim white as a real entered value; combined with 'receive up to 0.00 instantly' top-right, the card reads as already filled.
- (kimi-k3) Receive: 'receive up to 0.00 instantly' is plain text where the product's signature two-half bar (inbound room) should visualize the limit.
- (kimi-k3) Receive: the QR card is unbranded and unlabeled — no amount, no token, no entity hint — so a screenshot of it carries no context.
  - fix: Collapse to one primary 'Share request' (indigo) that opens copy options; keep 'Copy invoice' secondary; delete the tertiary xln:// text link or fold it into the sheet.
  - fix: Render empty amount as a lighter placeholder glyph (e.g. grey '0' at 40% opacity) and only switch to value weight on input.
  - fix: Replace the 'receive up to' text with a thin inbound-room bar (violet portion + grey room) drawn at the global px-per-$ scale.

### mobile-dark/05-swap.png

- (claude-sonnet-5) Swap: raw internal error string 'MARKET_WIRE_JSON_REQUIRED' is shown directly in the order book area — a debug/dev artifact leaking into production UI, destroys trust instantly.
- (claude-sonnet-5) Swap: 'syncing' status uses amber dot but no retry/estimate, leaving user stuck with no actionable next step while book is empty.
- (claude-sonnet-5) Swap: the Swap button is filled indigo but visually muted/darker than the Pay button elsewhere (looks disabled) — ambiguous whether it's actionable or blocked.
  - fix: Swap: replace 'MARKET_WIRE_JSON_REQUIRED' with a human message: 'Order book unavailable — reconnecting.'
  - fix: Swap: use the same solid #6E7CFF fill and full opacity for the primary Swap button regardless of validity state, using label/disabled cursor instead of dimming the whole button.
- (kimi-k3) Swap: the order book renders the raw internal constant 'MARKET_WIRE_JSON_REQUIRED' in place of levels — a shipped screen leaking a developer error string is the single worst trust break in the set.
- (kimi-k3) Swap: 'You pay 100' is entered and 'You receive 0.00', yet the only feedback is the helper text 'Set the amount you want' — the user did set it; the real blocker (book unavailable / no price) is never stated in user language.
- (kimi-k3) Swap: the USDC chip contains a nested 'Testnet' pill inside the token selector — a chip inside a chip, duplicating the network info already implied by context.
- (kimi-k3) Swap: the disabled Swap CTA keeps the indigo fill at low brightness with grey label — from a distance it looks tappable; disabled state is not visually distinct from a dimmed primary.
- (kimi-k3) Swap: 'syncing' status uses amber/yellow, a hue outside the declared semantic palette (green/violet/grey/red + indigo accent).
  - fix: Replace the constant with an empty-book state: 'No orders yet — your order will rest at the top of the book.' and log the wire error to console only.
  - fix: When the book cannot price the order, disable the CTA with reason: 'Book unavailable — try again' under the button.
  - fix: Move 'Testnet' out of the token chip into the screen header or the 'Up to 0.00 with H1' line.
  - fix: Render disabled primaries as surface fill + 40% label, never dimmed indigo.

### mobile-dark/06-account.png

- (claude-sonnet-5) Account detail: 'THIS ACCOUNT' card is entirely metadata (network, frames signed, status) with zero balance/bar — the account's actual credit-line bar (left/right halves) specified in the rubric is completely absent from the account's own detail page.
- (claude-sonnet-5) Account detail: large empty space below the metadata card (roughly 40% of viewport) is wasted with no recent activity or lane summary.
  - fix: Account detail: add the two-half account bar (send/receive) directly under the action buttons, before the metadata card.
  - fix: Account detail: fill empty space with recent account activity list or the credit-limit/collateral breakdown numbers.
- (kimi-k3) Account (H1): the screen's reason to exist — the bilateral bar with own-credit/collateral/owed halves, zero notch, and unused room — is entirely absent; the account with 'no tokens' shows only four action tiles and a metadata table.
- (kimi-k3) Account (H1): the action grid is 3 tiles on row one and a lone 'Manage' tile on row two, leaving a ragged asymmetric block at the top of the screen.
- (kimi-k3) Account (H1): 'Manage' as an account-level action collides with the 'Manage' tab in the bottom bar (same word, different scope).
- (kimi-k3) Account (H1): the lower two-thirds of the viewport is dead black space while key facts (0 frames signed, Open) sit in a sparse table.
  - fix: Add the canonical bilateral bar directly under the header: left half sendable (green/collateral + own credit), right half receivable, notch at zero, hatched holds, drawn at the global scale — even when zero, show the track and limits.
  - fix: Make the action row a 2×2 grid or a single row of 4 compact buttons; no orphan tile.
  - fix: Rename the account action to 'Limits' or 'Settings' to disambiguate from the Manage tab.

### mobile-dark/07-activity.png

- (claude-sonnet-5) Activity: filter pill row ('All, Payments, Swaps, Settlement, Accou...') is cut off at the right edge with no visible scroll affordance (fade/arrow), user may not realize more filters exist.
- (claude-sonnet-5) Activity: '1 movements' header has a grammar error (should be '1 movement') — small but visible on every visit to this screen.
  - fix: Activity: add a right-edge gradient fade or chevron hint to the filter pill scroller.
  - fix: Activity: fix pluralization logic for the movements counter.
- (kimi-k3) Activity: header reads '1 movements' — pluralization bug in the most visible count on the screen.
- (kimi-k3) Activity: the filter chip row is clipped mid-chip ('Accou…') with no fade or scroll indicator, so users cannot discover the hidden filters.
- (kimi-k3) Activity: one row of content leaves ~70% of the viewport empty with no empty-state guidance (e.g. 'Payments you make will appear here with their frame receipts').
- (kimi-k3) Activity: rows show no amount visualization; even a zero-state row could carry the mini directional bar that makes activity scannable.
  - fix: Pluralize: '1 movement' / 'N movements'.
  - fix: Add a right-edge fade + allow horizontal scroll on the chip row, or wrap chips to two rows on narrow widths.
  - fix: Add a quiet empty-state block under TODAY when the day has < 3 entries, explaining receipts come from committed frames.

### mobile-dark/08-activity-detail.png

- (claude-sonnet-5) Activity detail: this is the strongest screen shown — receipt sheet with 'From your runtime's committed frames' provenance line is exactly the trust cue the product needs; keep as the template for other confirmations.
- (claude-sonnet-5) Activity detail: frame number '#7' and time are both right-aligned white/bold at equal weight, making it unclear which is the more important provability anchor (frame > timestamp for this product).
  - fix: Activity detail: give Frame value the accent/mono treatment and dim Time to secondary grey, since frame number is the provable anchor and time is incidental.
- (kimi-k3) Activity detail: the eyebrow 'ACCOUNT · CREATED' and the title 'Account opened' say the same thing twice in adjacent lines.
- (kimi-k3) Activity detail: the receipt shows Frame #7 and time but no frame hash or signature excerpt — for a product whose promise is 'provable from committed frames', the proof artifact itself is not inspectable here.
- (kimi-k3) Activity detail: the sheet's dimmed backdrop still shows the list's clipped filter chips ('Accou…'), compounding the clipping issue from 07.
  - fix: Drop the eyebrow or change it to the counterparty ('WITH H1'); keep one title.
  - fix: Add a mono 'Frame hash 0x…' row with copy, plus 'Verified against your runtime' state, to make the receipt self-proving.
  - fix: Fix the chip-row clipping on the underlying Activity screen (see 07).

### mobile-dark/10-move-bottom.png

- (claude-sonnet-5) Move: 'TO' three-card selector (Wallet/Reserve/Account) all show identical '0.00 USDC' with a barely visible 1px underline bar at $0 — the visceral one-scale bar is present but so faint it reads as a decorative underline, not a meaningful bar.
- (claude-sonnet-5) Move: red error 'Amount exceeds what is available here' appears below the Sign & send / Add to batch buttons instead of above/near the Amount field that caused it, breaking the natural top-to-bottom error-correction flow.
- (claude-sonnet-5) Move: 'Fund you through H1' radio option has no visual indication it's selected vs the unselected state (both look identically dim).
  - fix: Move: move the amount-exceeds error directly under the Amount input field, in red, before the account selector.
  - fix: Move: give selected radio state a filled indigo dot and brighter label, not just an outline circle.
- (kimi-k3) Move (scrolled): the viewport top cuts through the FROM card row and the header pill — no sticky header or fade, so the user loses orientation of which token is being moved.
- (kimi-k3) Move: 'Recipient entity · leave empty for yourself' with placeholder '0x… entity id' is a power-user field presented at equal weight with the main flow, inviting accidental self-sends confusion.
- (kimi-k3) Move: the WHAT HAPPENS radio row ('Fund you through H1') uses a radio affordance for a single non-selectable explainer item — affordance promises a choice that does not exist.
  - fix: Make the token chip + 'Move' header sticky on scroll.
  - fix: Collapse 'Recipient entity' behind an 'Advanced' disclosure; default is self.
  - fix: Replace the radio circle with a plain info icon or numbered step marker.

### mobile-dark/10-move.png

- (claude-sonnet-5) Move: six near-identical cards (3 FROM, 3 TO) each repeating full descriptive subtext ('On-chain, in your signer', 'Depository escrow', 'Bilateral, instant') on every screen visit is heavy reading load for a screen used repeatedly; users memorize this fast and the text becomes noise.
- (claude-sonnet-5) Move: same faint-bar-at-zero issue as bottom variant — six bars all effectively invisible defeats the visceral-value premise entirely on the one screen literally designed to move money between the three canonical pools.
  - fix: Move: after first use, collapse subtext to icon-only with tooltip/long-press, keeping only the account name and amount visible.
  - fix: Move: make the mini progress bar under each card use full accent contrast even near-zero (min 4px visible fill) so it never looks broken.
- (kimi-k3) Move: FROM and TO render six near-identical cards (same titles, same 0.00 balances) — the only difference is an indigo border; at a glance the two rows are indistinguishable and mis-taps are likely.
- (kimi-k3) Move: each card carries a hairline balance bar under the amount, but at 0.00 the bar is invisible — the one-scale principle is technically present yet imperceptible exactly when users learn the UI.
- (kimi-k3) Move: 'Sign & send' (primary action, disabled due to error) is styled identically to the secondary 'Add to batch' — button hierarchy collapses precisely in the error state where guidance matters most.
- (kimi-k3) Move: 'Amount exceeds what is available here' is good prevention, but 'here' is ambiguous when six cards are on screen — which source is short?
  - fix: Differentiate FROM/TO cards: keep the selected card's indigo border but add a persistent 'From'/'To' corner tag on each selected card, and dim unselected cards to 60%.
  - fix: Draw the card bars as visible tracks (grey room) even at zero balance so scale is learnable.
  - fix: Keep 'Sign & send' in primary indigo whenever the form is valid; when invalid, surface style + the specific reason ('Reserve holds 0.00 USDC').

### mobile-dark/11-manage.png

- (claude-sonnet-5) Manage: five entry tiles (Sovereignty, Move, Assets, Lending, Ownership) use plain outline icons at equal visual weight with no hint of which is most commonly used — flat information architecture, no prioritization for a first-time user.
- (claude-sonnet-5) Manage: 'NEEDS ATTENTION — Nothing waiting on you' card sits above the Accounts list with generous padding but contains only one sentence, wasting vertical rhythm relative to its low information density.
  - fix: Manage: shrink the NEEDS ATTENTION empty-state card to a single compact row when there's nothing to show.
  - fix: Manage: visually emphasize Move (most frequent action) with a filled/tinted background versus the outline treatment of the other four tiles.
- (kimi-k3) Manage: the H1 account row's subtitle '0 lanes · 0 frames · open' is protocol jargon — 'lanes' is never explained anywhere in the visible UI.
- (kimi-k3) Manage: tile icons mix metaphors — 'Move' uses a bare arrow '→' while others use outlined icons; the Move tile's subtitle 'Wallet ↔ reserve ↔ accounts' uses a third arrow style.
- (kimi-k3) Manage: 'NEEDS ATTENTION — Nothing waiting on you.' spends a full card on a null state; when empty it could disappear entirely.
  - fix: Replace '0 lanes' with user language ('no capacity yet' / 'credit not set') and keep 'lanes' for a details view.
  - fix: Give every tile an outlined icon of the same family; drop inline arrows from subtitles.
  - fix: Hide the NEEDS ATTENTION card when empty.

### mobile-dark/12-assets-bottom.png

- (claude-sonnet-5) Assets: four faucet action buttons ('Hub pays me USDC over credit', 'USDC to my on-chain wallet', 'Gas (ETH) to my on-chain wallet', 'USDC straight into my reserve') are all identical full-width indigo buttons stacked — this is testnet-only tooling given the same visual priority (accent indigo) as the app's one real money-moving action, undermining the rubric's rule that indigo is reserved for the action that moves real money.
- (claude-sonnet-5) Assets: 'Token' selector pills (USDC/WETH/USDT/TRX/SUN) mix real stablecoins with clearly testnet/joke tickers (TRX, SUN) with no separating label or 'testnet only' marker.
  - fix: Assets: recolor all four faucet buttons to neutral dark-outline style, reserve indigo fill for the eventual real Send/Pay action only.
  - fix: Assets: add a small 'Testnet tokens' caption above the token pill row to disambiguate from mainnet assets shown elsewhere.
- (kimi-k3) Assets / Faucets: four stacked full-width indigo primary buttons ('Hub pays me USDC over credit', 'USDC to my on-chain wallet', 'Gas (ETH)…', 'USDC straight into my reserve') — indigo is supposed to mark THE one money-moving action per screen; here it marks four.
- (kimi-k3) Assets / Faucets: content continues under the bottom tab bar (chips partially visible behind it) — same safe-area bug as Home.
- (kimi-k3) Assets / Faucets: the DEBTS card explains debts with a three-line paragraph in a state where the correct content is nothing at all.
  - fix: Keep one indigo faucet CTA ('Get test USDC') and demote the other three to secondary surface buttons or a single 'Advanced faucet options' disclosure.
  - fix: Apply tab-bar + safe-area bottom padding to the Assets scroll view.
  - fix: Collapse the DEBTS empty state to a single grey line 'No debts' without the explainer card.

### mobile-dark/12-assets.png

- (claude-sonnet-5) Assets: 'Depository may pull 0.00' subtext repeated identically under every token row (USDC, WETH, USDT) is redundant boilerplate that adds no per-row value at zero balance; at low emphasis it still consumes three lines of reading.
- (claude-sonnet-5) Assets: token icon circles (blue $, violet bars, green $) reuse the same color language as the position-semantic system (green=safe, violet=at-risk) purely as brand icons, risking a false read that USDC icon = 'safe money' signal.
  - fix: Assets: only show 'Depository may pull X' when X > 0, otherwise omit the line entirely.
  - fix: Assets: choose token brand icon colors from a palette distinct from the green/violet/grey/red semantic set (e.g., blues/oranges) to avoid collision with position colors.
- (kimi-k3) Assets: the 'Move into reserve' button renders its arrow icon stacked above the label, left-aligned inside a tall card — looks like a broken layout rather than a button.
- (kimi-k3) Assets: token icons use brand colors (green USDT circle) that collide with the semantic system where green = 'yours whatever anyone does'; a green USDT badge on a 0.00 row sends a false ownership signal.
- (kimi-k3) Assets: 'Depository may pull 0.00' repeats identically under all three tokens — triple redundancy that adds noise without information.
- (kimi-k3) Assets: token rows show no balance bars — the one-scale bar is again absent where amounts are listed.
  - fix: Make 'Move into reserve' a standard horizontal button (icon left of label, centered) or a full-width secondary.
  - fix: Render token icons in neutral surface + monochrome glyph; reserve green/violet for position semantics only.
  - fix: Show 'Depository may pull' once as a card-level footnote, or only when the pullable amount is non-zero.
  - fix: Add a thin per-token bar at the global px-per-$ scale under each balance.

### mobile-dark/13-lend-bottom.png

- (claude-sonnet-5) Lending: 'H1 POOL' stats (Available/Borrowed/Active principal) all show 0.00 with no bar at all, breaking the one-scale-bar rule for a screen whose entire purpose is showing pool depth relative to other pools.
- (claude-sonnet-5) Lending: Term selector (1 hour/1 day/1 month) and interest bps input use the same visual weight as the primary lend amount — for a risk-bearing lending action, the term and rate deserve more prominent typographic distinction from a simple text field.
  - fix: Lending: add a horizontal bar under Available/Borrowed/Active principal at the shared $1=Npx scale, matching Home.
  - fix: Lending: increase Term/Interest field size or add a computed 'You lock $X for Y at Z%' summary line above the Offer button.
- (kimi-k3) Lending: the interest field's computed value '= 1.00% per term' wraps to two right-aligned lines while '100' sits left — the most important derived number is the least readable element.
- (kimi-k3) Lending: H1 POOL stats (Available / Borrowed / Active principal, all 0.00) show three identical zeros with no bar or ratio — a pool utilization bar at the global scale would make this glanceable.
- (kimi-k3) Lending (scrolled): bottom content is cut by the tab bar ('Borrowed…0.00' half-visible behind it) — the recurring safe-area defect.
  - fix: Put the computed rate on its own line right-aligned at label size: '100 bps = 1.00% per 1-day term' as one string.
  - fix: Add a thin utilization bar (borrowed vs available) to the pool card at the global scale.
  - fix: Apply the tab-bar bottom padding fix globally.

### mobile-dark/13-lend.png

- (claude-sonnet-5) Lending: 'Hub' selector card 'H1 · 0 lanes' at top uses the same selected-outline style as Term buttons below, but is functionally a different kind of selector (single required counterpart vs multiple term options) — visual language doesn't distinguish selector types.
- (claude-sonnet-5) Lending: page requires scrolling to reach the Offer button and pool stats on a screen with only 3 real inputs (amount, term, rate) — vertical spacing between cards is generous to the point of pushing the CTA below the fold.
  - fix: Lending: tighten vertical margins between Hub/Token/Term/Interest cards from ~24px to ~16px so Offer button and pool stats fit without scroll.
  - fix: Lending: use a chevron-dropdown style for the single-choice Hub selector instead of a bordered card matching multi-choice Term buttons.
- (kimi-k3) Lending: the Token card is an empty bordered box with the 'Lend / Borrow' segmented control floating detached below it — unclear whether the toggle belongs to the token field or the amount; layout implies a broken form.
- (kimi-k3) Lending: the Hub card shows 'H1 — 0 lanes' again using unexplained 'lanes' jargon at the primary selection point of the flow.
- (kimi-k3) Lending: 'Offer to the pool' is disabled-indigo with grey text — same weak disabled treatment as Swap; no inline reason why it is disabled (amount is 0.00).
- (kimi-k3) Lending: no token appears selected while the amount card says 'USDC' — contradictory state (empty Token card, USDC suffix).
  - fix: Move the Lend/Borrow segmented control above the amount card as the flow's mode switch; fill the Token card with the selected token chip.
  - fix: Replace '0 lanes' with 'no credit set'.
  - fix: Show the disabled reason inline: 'Enter an amount to offer'.

### mobile-dark/14-ownership.png

- (claude-sonnet-5) Ownership: this screen is clean and well-scoped, but 'TAKE CONTROL OF ANOTHER ENTITY' card title reads aggressively ('take control') for what is actually a passive discovery feature ('entities where you're listed as a board signer') — tone mismatch with the calm premium voice used elsewhere.
- (claude-sonnet-5) Ownership: large empty space (~50% of viewport) below the two cards with nothing — no recent ownership events, no board history.
  - fix: Ownership: rename card to 'Entities you can manage' or similar neutral phrasing.
  - fix: Ownership: fill empty space with a board-change history list or link to Activity filtered by ownership events.
- (kimi-k3) Ownership: the copy tells the user to 'Register it on the EntityProvider to issue shares or change owners' but offers no button, link, or path to do so — a documented dead end.
- (kimi-k3) Ownership: 'Kind — Lazy (hash of its board)' is internal terminology presented as a primary fact; 'lazy entity' means nothing to a user.
- (kimi-k3) Ownership: two cards of content then ~50% empty viewport; the 'you' chip next to the signer is good but the screen earns no other interaction.
  - fix: Add the primary action the copy promises: 'Register entity' (indigo) that starts the EntityProvider flow.
  - fix: Rename the row to 'Type — Personal (single signer)' and keep 'lazy/hash of board' for a details disclosure.

### mobile-dark/15-sovereignty-bottom.png

- (claude-sonnet-5) Sovereignty: 'PER COUNTERPARTY' H1 row shows 'nothing at risk' in green plus 'awaiting their signature · no proof yet · they answer in 1 d' all crammed on one truncated line ending in '1 d' — the most important trust sentence on the page is clipped by the viewport edge.
- (claude-sonnet-5) Sovereignty: 'Accounts co-signed 0 of 1' and 'Can dispute without asking 0 of 1' use amber/yellow for a zero-risk empty state (0 of 1 signed is expected pre-activity, not a warning) — color implies danger where none exists yet.
  - fix: Sovereignty: wrap the per-counterparty status line onto two lines instead of truncating, or shorten to 'awaiting signature · answers in 1d'.
  - fix: Sovereignty: use neutral grey (not amber) for '0 of 1' counters when the account is simply new, reserve amber for actual pending-risk states.
- (kimi-k3) Sovereignty / PER COUNTERPARTY: the H1 row's subtitle 'awaiting their signature · no proof yet · they answer in 1 d…' is clipped at the right edge — the most decision-relevant fact on the row (response deadline) is truncated.
- (kimi-k3) Sovereignty (scrolled): the viewports top edge cuts the 'Trust only $0.00' legend line mid-row with no sticky summary — scrolling loses the enforceable total context.
- (kimi-k3) Sovereignty: 'nothing at risk' in green is the correct semantic, but it sits on the same row as the truncated grey warning text, mixing reassurance and unresolved state without an ordering.
  - fix: Wrap the counterparty subtitle to two lines instead of truncating; never clip a deadline.
  - fix: Pin a compact summary strip (enforceable $ / at-risk $) under the header when scrolled.
  - fix: Order row content as: counterparty, green status, then grey pending detail on its own line.

### mobile-dark/15-sovereignty.png

- (claude-sonnet-5) Sovereignty: strongest hierarchy in the set — big total, clear green/violet legend, keys/ledger cards — good trade-off example of density vs a fintech dashboard feel without clutter.
- (claude-sonnet-5) Sovereignty: 'Enforceable right now $0.00' legend uses three separate green-dot line items (On-chain/Reserve/Collateral) stacked with the violet 'Trust only' line below at the same indent, but no bar is drawn anywhere on this screen despite it being the canonical home for the green/violet distinction described in the rubric.
  - fix: Sovereignty: draw the single big green/violet split bar directly under the $0.00 total (same scale as Home), replacing or supplementing the dot-legend list.
- (kimi-k3) Sovereignty: 'Accounts co-signed 0 of 1' and 'Can dispute without asking 0 of 1' use amber — a hue outside the green/violet/grey/red + indigo palette — and '0 of 1' never says which account is the laggard (it is H1, but the row cannot be tapped).
- (kimi-k3) Sovereignty: the legend swatches for On-chain / Reserve / Collateral are three identical green squares — correct per the semantic rule, but then the swatch adds nothing the word doesn't; the differentiation should come from the stacked bar, which is absent.
- (kimi-k3) Sovereignty: 'Enforceable right now $0.00' hero has no bar at the 1 px = $N scale even though this screen is the purest expression of the visceral-value thesis.
- (kimi-k3) Trade-off worth noting: the 'Save evidence bundle' indigo CTA with frame-hash explainer is the strongest trust element in the whole set — exactly the right use of the accent.
  - fix: Make the two '0 of 1' rows tappable, deep-linking to the H1 account's signature state; use grey for 'not yet' and reserve amber for nothing (or add amber to the declared palette deliberately).
  - fix: Draw the enforceable-vs-at-risk stacked bar (green segments + violet) under the hero number at the global scale.
  - fix: Replace three identical green swatches with one green swatch labeled 'yours whatever anyone does' spanning the three labels.
