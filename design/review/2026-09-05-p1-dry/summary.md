# Design review summary

Reviewers: openrouter/google/gemini-flash-latest, zai-coding-cn/glm-5.3-flash

| screen | hierarchy | premium | typography | color | data_legibility | layout | visceral_value | responsive | consistency | trust | total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| desktop-dark/01-home.png | 805 | 800 | 805 | 800 | 760 | 780 | 675 | 675 | 835 | 780 | **772** |
| desktop-dark/04-receive.png | 810 | 790 | 800 | 795 | 775 | 795 | 730 | 680 | 815 | 805 | **780** |
| desktop-dark/05-swap.png | 720 | 660 | 720 | 725 | 540 | 700 | 500 | 660 | 755 | 495 | **648** |
| desktop-dark/06-account.png | 750 | 745 | 785 | 770 | 690 | 705 | 605 | 670 | 810 | 750 | **728** |
| desktop-dark/07-activity.png | 790 | 765 | 790 | 780 | 765 | 765 | 635 | 685 | 820 | 795 | **759** |
| desktop-dark/08-activity-detail.png | 790 | 765 | 790 | 780 | 765 | 765 | 625 | 685 | 820 | 795 | **758** |
| desktop-dark/09-settings.png | 835 | 810 | 815 | 810 | 810 | 810 | 745 | 690 | 850 | 820 | **800** |
| desktop-dark/10-move.png | 790 | 765 | 800 | 785 | 760 | 785 | 695 | 690 | 820 | 790 | **768** |
| desktop-dark/11-manage.png | 745 | 730 | 775 | 765 | 710 | 720 | 595 | 675 | 800 | 760 | **728** |
| desktop-dark/12-assets.png | 795 | 740 | 785 | 770 | 760 | 765 | 675 | 680 | 795 | 745 | **751** |
| desktop-dark/13-lend.png | 755 | 730 | 775 | 760 | 710 | 740 | 635 | 680 | 800 | 735 | **732** |
| desktop-dark/14-ownership.png | 740 | 725 | 770 | 750 | 690 | 720 | 590 | 675 | 790 | 755 | **721** |
| desktop-dark/15-sovereignty.png | 830 | 805 | 820 | 820 | 810 | 795 | 745 | 680 | 825 | 860 | **799** |
| desktop-dark/16-desk.png | 790 | 765 | 780 | 770 | 645 | 730 | 675 | 655 | 795 | 765 | **737** |
| desktop-dark/17-palette.png | 830 | 795 | 810 | 805 | 775 | 805 | 700 | 680 | 840 | 800 | **784** |
| mobile-dark/01-home.png | 770 | 735 | 765 | 750 | 725 | 740 | 670 | 740 | 770 | 735 | **740** |
| mobile-dark/04-receive-bottom.png | 720 | 700 | 715 | 725 | 670 | 695 | 645 | 700 | 750 | 700 | **702** |
| mobile-dark/04-receive.png | 760 | 715 | 740 | 720 | 705 | 700 | 660 | 685 | 755 | 715 | **716** |
| mobile-dark/05-swap.png | 710 | 655 | 710 | 685 | 500 | 690 | 505 | 695 | 690 | 480 | **632** |
| mobile-dark/06-account.png | 755 | 725 | 755 | 750 | 670 | 720 | 620 | 720 | 780 | 740 | **724** |
| mobile-dark/07-activity.png | 735 | 705 | 740 | 725 | 680 | 710 | 620 | 705 | 765 | 710 | **710** |
| mobile-dark/08-activity-detail.png | 770 | 745 | 760 | 735 | 750 | 755 | 675 | 740 | 795 | 780 | **751** |
| mobile-dark/10-move-bottom.png | 695 | 680 | 710 | 690 | 615 | 655 | 595 | 655 | 745 | 700 | **674** |
| mobile-dark/10-move.png | 720 | 700 | 730 | 710 | 635 | 680 | 605 | 660 | 755 | 705 | **690** |
| mobile-dark/11-manage.png | 760 | 720 | 750 | 735 | 725 | 740 | 660 | 730 | 775 | 730 | **733** |
| mobile-dark/12-assets-bottom.png | 690 | 650 | 695 | 685 | 655 | 650 | 625 | 670 | 725 | 660 | **671** |
| mobile-dark/12-assets.png | 750 | 710 | 740 | 720 | 720 | 710 | 630 | 700 | 760 | 715 | **716** |
| mobile-dark/13-lend-bottom.png | 710 | 670 | 700 | 695 | 660 | 680 | 610 | 675 | 745 | 680 | **683** |
| mobile-dark/13-lend.png | 715 | 685 | 715 | 695 | 650 | 685 | 615 | 695 | 740 | 665 | **686** |
| mobile-dark/14-ownership.png | 750 | 720 | 740 | 725 | 695 | 715 | 595 | 720 | 765 | 740 | **717** |
| mobile-dark/15-sovereignty-bottom.png | 765 | 735 | 765 | 755 | 740 | 735 | 720 | 720 | 790 | 800 | **753** |
| mobile-dark/15-sovereignty.png | 790 | 770 | 775 | 770 | 765 | 770 | 745 | 740 | 795 | 820 | **774** |

**Overall: 729 / 1000** (mean of screen totals across reviewers)

## Ten users

| user | satisfied | blockers |
|---|---:|---|
| Maya | 27 | Cannot fund with fiat or card anywhere on 01-home or 12-assets; 04-receive blocks instant payments with confusing 'No inbound room yet' error; Cannot easily deposit fiat or funds without encountering jargon on 01-home.png and 04-receive.png. |
| Tomasz | 69 | 06-account shows zero visual credit vs collateral allocation bars when open; 16-desk table is completely unpopulated without live lane capacity; 01-home.png and 06-account.png state 'no tokens' and '0 lanes' instead of showing graphic bilateral channel capacity bars. |
| Anya | 24 | 05-swap displays 'MARKET_WIRE_JSON_REQUIRED' instead of an executable order book; No slippage tolerance or execution route preview; 05-swap.png displays 'MARKET_WIRE_JSON_REQUIRED' and 'syncing' with a disabled Swap button. |
| Ravi | 71 | 15-sovereignty has 'Save evidence bundle' but lacks board-friendly PDF/CSV audit summary export; 14-ownership provides no interactive threshold modification UI for multi-sig; 15-sovereignty.png has 'Save evidence bundle' but does not show a clear audit report preview or board-ready summary. |
| Sofia | 48 | 04-receive requires pre-arranged hub credit line before receiving funds; 07-activity detail has no shareable web receipt or PDF invoice download for clients; 04-receive-bottom.png shows raw entity hashes that would scare off my corporate clients. |
| Kenji | 77 | 15-sovereignty indicates 'Can dispute without asking: 0 of 1' without displaying the unilateral timeout counter or challenge initiation trigger; 15-sovereignty-bottom.png says '0 of 1 can dispute without asking' but lacks a visible interactive dispute trigger button to test the challenge script.; Signer addresses in 12-assets.png lack full un-truncated verification view. |
| Lena | 37 | Desktop-only layout with multiple detached panels; Missing mobile viewport screens in review set; 04-receive.png requires dual-handed scrolling down past a massive QR code to hit copy actions. |
| Marcus | 59 | 16-desk displays an empty account lane table without aggregate credit limits; Order book fails to load market depth; 06-account.png and 11-manage.png only show a single hub (H1) with '0 lanes' and zero liquidity telemetry. |
| Fatima | 36 | 05-swap 'Across networks' tab is disabled/unselected and shows no bridge routing; 10-move only transfers between Wallet, Reserve, and Account within the same jurisdiction; 05-swap.png 'Across networks' toggle is non-functional/unconfigured in the review state. |
| Dmitri | 67 | 05-swap and 16-desk expose raw development error strings; 09-settings design sandbox can be mistaken for real wallet state; 05-swap.png and 12-assets-bottom.png display unpolished raw codes and debug faucet stacks that detract from commercial credibility. |

**Users satisfied (mean): 52 / 100** · target 95 for all ten

- Maya (gemini-flash-latest, 18): I have zero crypto and have no idea how to get $20 in or what 'Reserve', 'Inbound room', or 'Depository' mean.
- Maya (gemini-flash-latest, 25): I'm terrified of pressing anything because it talks about entity IDs, hubs, and inbound room instead of just letting me send $20.
- Maya (glm-5.3-flash, 35): It looks serious but every screen says $0.00 and nothing tells me what to do first.
- Maya (glm-5.3-flash, 30): The screens look friendly but everything is $0.00 and I never find a plain 'add money' button.
- Tomasz (gemini-flash-latest, 82): I immediately grasp the credit versus collateral distinction, though I need to see inbound routing capacity bars drawn out visually.
- Tomasz (gemini-flash-latest, 82): I immediately grasp the credit versus collateral distinction, though I need to see my capacity visualised as a proper bar rather than text.
- Tomasz (glm-5.3-flash, 55): The credit/collateral distinction is explained in words but the account screen shows no numbers to assess risk.
- Tomasz (glm-5.3-flash, 55): The instant send/receive limits and green/violet split are right, but the account screen shows no credit/collateral numbers.
- Anya (gemini-flash-latest, 15): I cannot swap anything because the order book crashes on an unparsed wire JSON error and has no price impact data.
- Anya (gemini-flash-latest, 30): The swap page is broken with a raw JSON error code, so I can't check slippage, depth, or execution price for my ETH.
- Anya (glm-5.3-flash, 25): An order book that prints MARKET_WIRE_JSON_REQUIRED with no levels, no price, no quote — I'd leave.
- Anya (glm-5.3-flash, 25): A book with a literal error string and no prices — I can't judge a fair fill, so I'd leave.
- Ravi (gemini-flash-latest, 84): The separation of on-chain reserve from uncollateralized risk is exactly what my DAO board needs, but I need an automated export report.
- Ravi (gemini-flash-latest, 78): The clear separation of on-chain enforceable assets versus bilateral credit is exactly what my DAO board needs, but proof export needs one-click formatting.
- Ravi (glm-5.3-flash, 60): Sovereignty view and 'Save evidence bundle' are exactly what I need — once there is real money to prove.
- Ravi (glm-5.3-flash, 60): Enforceable-now and evidence bundle are exactly what I need, but there's no statement export or signed-proof view beyond one bundle button.
- Sofia (gemini-flash-latest, 40): I can generate an invoice link, but it tells me there is no inbound room so my client won't be able to pay me.
- Sofia (gemini-flash-latest, 52): I can create an invoice and copy a link, but there is no receipt download or client-friendly payment confirmation page.
- Sofia (glm-5.3-flash, 45): Receive with QR and copy-link is close to an invoice flow, but there's no invoice list, amount-link preview, or settled-receipt view.
- Sofia (glm-5.3-flash, 55): Requesting with amount+note and a share link is great, but the receipt can't be forwarded and the instant limit is zero.
- Kenji (gemini-flash-latest, 91): The Sovereignty view is fantastic: dual-signed frames, enforceable Depository escrow, and raw evidence bundles give me total off-chain independence.
- Kenji (gemini-flash-latest, 86): Seeing exact frame heights, co-sign counts, and having an explicit evidence bundle export gives me genuine self-sovereign confidence.
- Kenji (glm-5.3-flash, 65): Evidence bundle, dispute-without-asking and per-frame provenance are the right primitives; I can't verify anything from zeros.
- Kenji (glm-5.3-flash, 65): Evidence bundle, dispute readiness and frame provenance are visible — best-in-show — but the challenge flow itself is missing.
- Lena (gemini-flash-latest, 12): These wide desktop views would be completely unusable on my phone, and there's no single-tap checkout mode visible.
- Lena (gemini-flash-latest, 44): One-handed payments are frustrating when the QR code takes over the whole screen and action buttons are pushed off the bottom.
- Lena (glm-5.3-flash, 30): Only desktop-dark was shown; a dense wide table and command palette don't promise a one-hand phone payment.
- Lena (glm-5.3-flash, 60): Big touch targets and clear Pay button, but with $0.00 balances a checkout payment is impossible, and heavy screens scroll a lot.
- Marcus (gemini-flash-latest, 72): The Desk view has the right mental model for net counterparty exposure, but the unpopulated table and broken order book prevent real desk operation.
- Marcus (gemini-flash-latest, 72): The accounting primitives are sound, but as an operator I cannot see aggregate counterparty exposure or peer rebalancing options at scale.
- Marcus (glm-5.3-flash, 50): Desk is the right concept — one table, all lanes — but it's clipped, jargon-heavy and empty.
- Marcus (glm-5.3-flash, 40): There is no desk view: I can't see exposure, collateral ratios or lane health for a counterparty at a glance.
- Fatima (gemini-flash-latest, 25): I can see testnet faucets for different tokens, but I cannot find how to bridge or route USDT between two networks with transparent fees.
- Fatima (gemini-flash-latest, 35): I see an 'Across networks' tab on the swap page, but everything is disabled and fees across chains are nowhere to be found.
- Fatima (glm-5.3-flash, 35): There's an 'Across networks' toggle on Swap, but no cross-chain quote, route or fee is ever shown.
- Fatima (glm-5.3-flash, 50): The 'Across networks' tab exists but its flow, fees and hub routing are not shown in this set.
- Dmitri (gemini-flash-latest, 78): The mathematical absolute scale and explicit 'Trust only / At risk' accounting prove this isn't standard crypto vaporware, but the broken market feeds raise concerns about production readiness.
- Dmitri (gemini-flash-latest, 76): The sovereignty breakdown between enforceable collateral and trust-only debt is a genuine breakthrough, but the product looks like an engineer's test bench.
- Dmitri (glm-5.3-flash, 45): The layered-money model and evidence bundle are genuinely different, but the screens demonstrate none of it working.
- Dmitri (glm-5.3-flash, 70): The enforceable-vs-trust-only framing is genuinely different and credible, but visible broken strings and all-zero screens undercut the pitch.

## Priority fixes by reviewer

### openrouter/google/gemini-flash-latest · desktop-dark · 790

The xln desktop wallet exhibits a disciplined, dark aesthetic with exceptional cryptographic rigor in the Sovereignty and Settings views. However, persistent unhandled backend errors in the Swap book and stark empty-state voids across desktop views create severe friction for new and non-technical users.

- Eliminate broken debug artifacts ('MARKET_WIRE_JSON_REQUIRED') in Swap and Desk views by providing clean fallbacks or live order book streams.
- Integrate an automated onboarding step on Home and Receive that prompts opening an account and setting inbound credit when balances are zero.
- Replace vast expanses of dead space on wide desktop screens (Home, Account, Manage, Activity) with structured summary cards, liquidity depth, and audit logs.
- Relocate validation errors (e.g. Move screen balance excess) immediately adjacent to input fields rather than detached below disabled buttons.
- Demystify cryptographic jargon ('Lazy board', 'Can dispute without asking: 0 of 1', 'Depository pull') with inline plain-English tooltips and explicit status explanations.

### openrouter/google/gemini-flash-latest · mobile-dark · 734

The xln mobile UI features rigorous deterministic state accounting and honest cryptographic status, but exposes raw protocol mechanics and error strings that alienate ordinary users. While security purists will appreciate the unambiguous enforceability guarantees, navigation and input workflows suffer from awkward vertical density and developer-centric terminology.

- Eliminate raw backend/protocol errors from customer views (e.g. 'MARKET_WIRE_JSON_REQUIRED' on Swap) and replace with human recovery steps.
- Fix scroll overflow and safe-area margins across mobile views so action buttons ('Sign & send', sharing CTAs) are not clipped or hidden behind navigation bars.
- Implement the canonical visual horizontal balance bar on Home, Account, and Sovereignty to visually represent green (on-chain/collateral) versus violet (trust/credit) at 1 absolute scale.
- Streamline multi-step account management and onboarding by turning confusing jargon ('inbound room', 'Lazy board', '0 lanes') into clear actionable flows with guided collateral deposits.
- Consolidate developer tools (faucets, raw JSON evidence dumps, scale markers) into dedicated advanced or testnet settings to declutter the core consumer transaction loops.

### zai-coding-cn/glm-5.3-flash · desktop-dark · 690

A visually disciplined dark fintech UI with one coherent idea (absolute-scale bars, layered money) that is consistently applied — but every screen is shown empty, internal protocol strings leak into user surfaces, and the flagship value (instant provable payments) is never demonstrated. It reads as an excellent developer console wearing a consumer wallet's clothes.

- Eliminate all raw error/internal strings shown to users (MARKET_WIRE_JSON_REQUIRED on 05-swap and 16-desk; 'lazy hash of its board' on 14-ownership; 'lanes', 'frames', 'runtime's committed frames') — single biggest trust kill
- Fix the 16-desk table clipping/truncation so no header or column is ever cut off
- Fill the empty state: first-run checklist on Home (get funds → open account → pay) and demo/live data so zero-value screens stop dominating
- Show derived financial figures wherever a task needs them: swap quote + fee (05), credit/collateral exposure on account (06), projected interest on lending (13), available-max validation on Move (10)
- Safety hygiene on Settings: separate destructive 'Forget vault' with confirmation, and fix the '1 movements' pluralization

### zai-coding-cn/glm-5.3-flash · mobile-dark · 683

A visually coherent, premium-feeling dark wallet with unusually honest framing of on-chain vs credit-only money, but it is a protocol console wearing a consumer shell: jargon (frames, lanes, lazy entity, depository), raw error strings, and all-zero states undermine trust and block first-time tasks. The swap/order book and move flow are the weakest paths; Sovereignty is the strongest screen and should set the standard.

- Replace every raw developer string ('MARKET_WIRE_JSON_REQUIRED', '1 px = $10 · auto', frame/lanes/wire) with user language or info-revealed tooltips across swap, home, account, activity
- Design the zero/empty state system: hero balance replaced by funding CTA, pool/token/faucet empty states with explanation instead of rows of 0.00
- Add inline validation and primary-button gating to Move and Swap (cap input at available, error beside the field, disabled reason)
- Surface the risk model consistently on Account and Lending (credit vs collateral, APY/utilization, exposure) reusing the Sovereignty green/violet legend
- Fix layout defects: clipped cards at bottom edges, overflowing 'Move into reserve' tile, orphaned grid tiles, truncating chips and counterparty rows

## Issues per screen

### desktop-dark/01-home.png

- (gemini-flash-latest) Empty state leaves over 65% of the viewport completely blank below primary actions, dampening visceral product appeal.
- (gemini-flash-latest) Color breakdown dots (On-chain, Reserve, Secured, At risk) all display '$0.00' without visual hierarchy or explanation of what 'Secured' vs 'At risk' means to a newcomer.
- (gemini-flash-latest) The micro-label '1 px = $10 · auto' appears floating on the right of BALANCES with zero introductory context for users unfamiliar with the absolute bar scale.
  - fix: Add a guided first-action card or interactive deposit onboarding flow directly in the empty BALANCES canvas area.
  - fix: Include an inline tooltip or subtle descriptor under balance categories distinguishing on-chain escrow from counterparty credit risk.
  - fix: Relocate the scale indicator '1 px = $10' adjacent to an explicit inactive ruler preview bar.
- (glm-5.3-flash) Empty-state hero: total balance $0.00 with four $0.00 bucket chips and 'Instant: send up to $0.00' — the whole first screen communicates zero, no onboarding path beyond a muted one-liner
- (glm-5.3-flash) '1 px = $10 · auto' label near 'Move' is unexplained jargon on the main screen; nothing tells a new user what the absolute-scale bars mean
- (glm-5.3-flash) ACCOUNTS card shows 'H1 USDC —' with 'no tokens' in faint gray; relationship between H1, USDC and the buckets is opaque
- (glm-5.3-flash) Left rail has two visually identical list icons (3rd and 4th) with no labels — destination unclear
  - fix: Add a first-run checklist card under the balance: '1. Get test funds 2. Open an account 3. Pay someone' with buttons
  - fix: Label the rail icons or show tooltips; differentiate the two list glyphs
  - fix: Explain '1 px = $10' inline: 'bar scale' with link to Settings

### desktop-dark/04-receive.png

- (gemini-flash-latest) The prominent QR code sits in high-contrast solid white against dark slate without rounded corners or padding, creating severe visual harshness.
- (gemini-flash-latest) Warning banner 'No inbound room yet. Extend a credit line to a hub...' appears at the very bottom in low contrast, despite being a hard operational blocker for receiving funds.
- (gemini-flash-latest) The Entity ID string in 'YOUR ENTITY ID' card is a raw 66-character hex string with small monospace text that is difficult to visually verify.
  - fix: Style the QR code container with softened rounded inner corners and a subtle muted border to integrate into desktop-dark.
  - fix: Elevate the 'No inbound room yet' warning state directly beneath the Amount input or provide an immediate 1-click CTA button to open inbound credit.
  - fix: Format the Entity ID with visual 4-character chunking and an explicit copy feedback badge.
- (glm-5.3-flash) QR is rendered as dark modules on cream — inverted contrast against the dark theme, reads as a pasted-in asset
- (glm-5.3-flash) 'receive up to 0.00 instantly' inside the amount field is easy to miss and phrased as a limit without explaining why it is zero
- (glm-5.3-flash) Raw 64-char entity ID in monospace fills two lines with no copy affordance next to it
- (glm-5.3-flash) Warning 'No inbound room yet' is good copy but the 'Open H1' link competes with the panel border and looks like body text
  - fix: Render QR in dark-on-light card consistent with theme, or white modules on the indigo surface with quiet zone
  - fix: Add a copy button beside the entity ID; truncate with reveal
  - fix: Promote 'Open H1' to a button

### desktop-dark/05-swap.png

- (gemini-flash-latest) Unrendered raw development string 'MARKET_WIRE_JSON_REQUIRED' in the order book card destroys user trust and looks broken.
- (gemini-flash-latest) Order book status shows yellow 'syncing' indefinitely without a skeleton loader, ticker depth chart, or last trade price.
- (gemini-flash-latest) No exchange rate, slippage tolerance, routing path, or estimated fee breakdown is shown between paying 100 USDC and receiving WETH.
  - fix: Replace raw debug text 'MARKET_WIRE_JSON_REQUIRED' with empty state placeholder rows or animated tabular book skeleton.
  - fix: Render an explicit exchange rate line (e.g. '1 WETH ≈ 3,420 USDC') and execution price impact preview before the Swap button.
  - fix: Disable the primary 'Swap' button with an explanatory disabled tooltip when order book feeds are disconnected or unsynced.
- (glm-5.3-flash) Literal error string 'MARKET_WIRE_JSON_REQUIRED' printed in the order book panel — a raw internal error shown to users; kills trust instantly
- (glm-5.3-flash) Order book is otherwise empty: no price levels, no spread, no last price; 'syncing' dot only
- (glm-5.3-flash) 'You receive 0.00' stays at 0.00 with 100 USDC entered and no rate, no fee, no minimum — the core swap value is missing
- (glm-5.3-flash) 'Testnet' chip inside the token selector is easy to read as the token network but the top toggle says 'Same network' — confusing
  - fix: Replace MARKET_WIRE_JSON_REQUIRED with human copy ('Book unavailable — waiting for hub feed') and a retry action
  - fix: Show mid price, spread and estimated receive amount plus fee before submit
  - fix: Disable Swap until a quote exists; show why it is disabled

### desktop-dark/06-account.png

- (gemini-flash-latest) Extreme negative space occupying roughly 70% of the screen below the 4 top action buttons and sidebar summary card.
- (gemini-flash-latest) The bilateral channel details show 'Frames signed: 0' and 'Status: Open', but fail to display current credit limit, collateral posted, or directional balances.
- (gemini-flash-latest) The explanation paragraph inside 'THIS ACCOUNT' is dense, unformatted small text that blends into the background.
  - fix: Display a visual bilateral balance bar (Local balance, Remote balance, Credit line, Enforceable reserve) across the center view.
  - fix: Break the account parameters into structured data tiles: Your Collateral, Hub Collateral, Credit In, Credit Out.
  - fix: Fill the lower body with an account-specific frame timeline or audit history log.
- (glm-5.3-flash) No financial state shown: no credit line, collateral, balance or exposure numbers — 'Frames signed 0' is the only metric and it means nothing to users
- (glm-5.3-flash) Only the footnote explains credit vs collateral; the numbers it describes are absent
- (glm-5.3-flash) Action grid is unbalanced (Pay, Extend credit, Swap / Manage alone), leaving a hole in the layout
- (glm-5.3-flash) Counterparty 'Hub' and Network 'Testnet' rows are near-constant filler
  - fix: Add an exposure summary: credit line, collateral, secured/at-risk split with the standard scale bars
  - fix: Add inbound/outbound capacity rows; drop or merge constant rows

### desktop-dark/07-activity.png

- (gemini-flash-latest) Master-detail arrangement on wide screen leaves massive empty black canvas between the item list and detail panel.
- (gemini-flash-latest) Detail drawer header displays 'Account opened' with full hub hex '0x23d8a3...21b7' concatenated tightly next to the label 'H1'.
- (gemini-flash-latest) Lack of actionability on selected receipt (no raw JSON export, no shareable proof link, no dispute initiation trigger).
  - fix: Constrain list and detail split-pane widths to a unified centered container to eliminate dead black canvas.
  - fix: Format counterparty addresses cleanly with an icon, tag, and dedicated copy button.
  - fix: Add 'Export proof bundle' and 'Verify frame signature' CTA buttons directly into the detail pane.
- (glm-5.3-flash) '1 movements' — grammar bug in the header
- (glm-5.3-flash) Only one event exists and it is 'Account opened'; no payment, swap or settlement example, so the list's value is unproven
- (glm-5.3-flash) Filter pills (Payments/Swaps/Settlement/Accounts) imply volume the empty account cannot show
- (glm-5.3-flash) Green footnote 'From your runtime's committed frames' is internal jargon on a consumer screen
  - fix: Fix pluralization ('1 movement')
  - fix: Rephrase provenance line: 'Signed and verifiable — export proof'

### desktop-dark/08-activity-detail.png

- (gemini-flash-latest) Duplicate screen state to 07-activity without additional interaction states, demonstrating repetitive empty viewports.
- (gemini-flash-latest) The frame metadata displays '#7' and timestamp without hash or cryptographic commitment root visible to auditing users.
- (gemini-flash-latest) No visual state indicator for on-chain anchoring vs off-chain bilateral settlement.
  - fix: Provide expandable cryptographic proof section showing state Merkle root and dual signatures.
  - fix: Include quick deep-link to the exact counterparty account inspect page from the activity detail view.
  - fix: Offer download of signed EIP-712 / frame envelope as JSON.
- (glm-5.3-flash) Detail panel duplicates the list row exactly — no hashes, signatures, or export affordance for a 'created' event
- (glm-5.3-flash) 'Frame #7' is raw internals without a link to the frame or explanation
- (glm-5.3-flash) Identical to 07-activity.png; if a distinct detail view was intended it is missing
- (glm-5.3-flash) Green provenance line again uses 'runtime's committed frames' jargon
  - fix: Give each event type a real detail body: amounts, counterparties, frame hash, copy/export evidence
  - fix: Differentiate selected-row detail from the list

### desktop-dark/09-settings.png

- (gemini-flash-latest) Page length requires deep scrolling with high cognitive density mixing mathematical bar scale settings, design theme tokens, and cryptographic keys.
- (gemini-flash-latest) The preview widget for '$1,284,500.00' is static and non-interactive, which can mislead users into thinking it reflects real balance.
- (gemini-flash-latest) 'Forget vault' is placed directly beside 'Lock' and 'Reveal recovery phrase' with minimal safety buffer.
  - fix: Segment settings into tabbed navigation: Display & Scale, Channels & Appearance, Security & Vault.
  - fix: Add explicit 'PREVIEW ONLY' watermark or badge over the balance customization card.
  - fix: Isolate destructive action 'Forget vault' into a distinct red-bordered Danger Zone at the page base.
- (glm-5.3-flash) Very long single column; RUNTIME and VAULT blocks sit far below the fold with no section nav
- (glm-5.3-flash) 'Reveal recovery phrase', 'Lock', 'Forget vault' are equal-weight buttons in one row — destructive action needs separation and confirmation styling
- (glm-5.3-flash) Dollars-per-pixel scale concept is well explained but the 'AT THIS SCALE' example overlaps the left column visually at this width
- (glm-5.3-flash) Risk color choices (Violet/Red/Orange) without preview of what 'at risk' looks like in context
  - fix: Add a sticky section index or tabs for Scale/Home/Appearance/Design/Runtime/Vault
  - fix: Move 'Forget vault' to a separate danger zone with typed confirmation
  - fix: Show live mini-previews for accent and risk-color choices

### desktop-dark/10-move.png

- (gemini-flash-latest) The 3x2 matrix of source (Wallet, Reserve, Account) and target (Wallet, Reserve, Account) tiles is abstract; the flow direction requires deciphering tiny borders.
- (gemini-flash-latest) Validation error 'Amount exceeds what is available here' is placed below disabled buttons at the bottom edge instead of under the Amount input field.
- (gemini-flash-latest) Side explanation 'Fund you through H1' in WHAT HAPPENS does not explain fees or on-chain transaction gas costs required for the Reserve-to-Account transition.
  - fix: Add explicit directional arrows connecting the active Source card directly to the Destination card.
  - fix: Render the error message 'Amount exceeds what is available here' directly under the Amount input container in red text.
  - fix: Add estimated L1 gas fee and settlement time in the 'WHAT HAPPENS' card.
- (glm-5.3-flash) All six source/target cards show 0.00 USDC — the user cannot see why '250' fails beyond the red line 'Amount exceeds what is available here'
- (glm-5.3-flash) Error appears below the buttons with no field highlighting; buttons remain ambiguous gray
- (glm-5.3-flash) 'Recipient entity · leave empty for yourself' with raw 0x… placeholder is developer vocabulary
- (glm-5.3-flash) The 'WHAT HAPPENS' explainer is good but shows only one step ('Fund you through H1') with an empty radio circle
  - fix: Show available max per card and pre-validate the amount field with inline red border
  - fix: Replace 'entity id' placeholder with 'Their wallet address (optional)'
  - fix: Disable Sign & send with a reason until the form is valid

### desktop-dark/11-manage.png

- (gemini-flash-latest) Six card buttons of uneven conceptual hierarchy (Sovereignty, Move, Assets, Lending, Ownership, Needs Attention) arranged in a sparse 2-column grid.
- (gemini-flash-latest) Right-hand 'ACCOUNTS' pane shows 'H1 hub: 0 lanes · 0 frames · open' with zero financial metrics (liquidity, credit, balance).
- (gemini-flash-latest) Over 60% of lower screen real estate is completely blank.
  - fix: Reorganize cards into functional groups: Capital Operations (Move, Assets, Lending) and Governance/Security (Sovereignty, Ownership).
  - fix: Enrich the Accounts summary item with total collateral held and available routing capacity.
  - fix: Collapse dead vertical space by adopting a structured dashboard grid.
- (glm-5.3-flash) Six feature doors with one-line descriptions but no state data (balances, alerts) — a launcher where a console was expected
- (glm-5.3-flash) '0 lanes · 0 frames · open' in the accounts card is unexplained jargon ('lanes')
- (glm-5.3-flash) 'NEEDS ATTENTION — Nothing waiting on you' is fine but occupies prime space doing nothing
- (glm-5.3-flash) Two adjacent rail icons map to Manage/Desk ambiguously; Manage itself links to five sub-screens not shown
  - fix: Surface live exposure and pending actions inside each door card
  - fix: Rename 'lanes' or add a tooltip; collapse empty NEEDS ATTENTION

### desktop-dark/12-assets.png

- (gemini-flash-latest) Prominent FAUCETS panel occupies half the screen with four stacked blue primary buttons, giving the UI a test-harness prototype appearance rather than fintech-grade production.
- (gemini-flash-latest) Asset rows repeat 'Depository may pull 0.00' without explaining smart contract approvals or allowance state.
- (gemini-flash-latest) Zero token contract addresses, decimal standards, or direct links to block explorers.
  - fix: Move testnet Faucets into an expandable drawer or bottom utility section, prioritizing actual On-Chain & Depository holdings.
  - fix: Add explicit 'Approve Depository' toggle/status badge alongside token balances.
  - fix: Provide external explorer links and contract hashes next to Signer and Depository addresses.
- (glm-5.3-flash) All balances 0.00 with 'Depository may pull 0.00' repeated three times — the allowance phrase is unexplained and alarming
- (glm-5.3-flash) Faucet buttons are four heavy indigo fills stacked — visual weight suggests four equal primary actions
- (glm-5.3-flash) 'Move into reserve' button icon (arrow) with label below is low-contrast and cramped
- (glm-5.3-flash) Debts explainer is good copy but detached from any number
  - fix: Explain allowance inline ('what the Depository contract can move without asking')
  - fix: Restyle faucet actions as a list with a single 'Get test funds' primary
  - fix: Show debts as a row with amount, always present

### desktop-dark/13-lend.png

- (gemini-flash-latest) H1 POOL on the right displays 'Available 0.00, Borrowed 0.00, Active principal 0.00' with zero context on historical yield or default protection.
- (gemini-flash-latest) Token selection input is an empty blank card with no placeholder or selectable dropdown.
- (gemini-flash-latest) Basis point math '= 1.00% per term' lacks annualized APY calculation (e.g. 1% per 1 day vs 1% per 1 month).
  - fix: Populate Token selector with selectable assets (e.g., USDC, USDT) and available wallet balances.
  - fix: Calculate and display effective APY alongside the nominal basis points per term.
  - fix: Add explicit liquidation and counterparty default guarantees or collateral coverage ratio in the pool summary.
- (glm-5.3-flash) No APY/rate market context: user sets basis points (100 = 1.00%/term) with zero reference to what the pool pays or what others ask
- (glm-5.3-flash) H1 POOL shows Available/Borrowed/Active principal all 0.00 — no reason to lend here
- (glm-5.3-flash) '0 lanes' again unexplained; Hub selector duplicates the only hub
- (glm-5.3-flash) Term buttons uneven widths (1 hour / 1 day / 1 month) look unintentional
  - fix: Show projected interest for the chosen amount/term next to the input
  - fix: Equalize term buttons; explain lanes or drop the term
  - fix: Add pool utilization and history once nonzero

### desktop-dark/14-ownership.png

- (gemini-flash-latest) Cryptic terminology 'Kind: Lazy (hash of its board)' confuses users without deep internal protocol knowledge.
- (gemini-flash-latest) The 'TAKE CONTROL OF ANOTHER ENTITY' card is purely passive text with no input field to import or claim an entity.
- (gemini-flash-latest) The screen lacks governance actions: no button to propose new signers, adjust threshold (currently 1 of 1), or register on EntityProvider.
  - fix: Add explanatory subtitle for entity types and an active CTA: 'Register on EntityProvider to enable multi-sig'.
  - fix: Add interactive input for Entity address claim or takeover transfer under the right-hand panel.
  - fix: Provide explicit 'Add Signer' and 'Change Threshold' action modals.
- (glm-5.3-flash) 'Kind: Lazy (hash of its board)' and 'Register it on the EntityProvider' are pure protocol internals — meaningless to any of the ten users
- (glm-5.3-flash) No shares, members, or board table shown; the screen promises 'Board, shares, takeovers' and delivers four rows
- (glm-5.3-flash) 'TAKE CONTROL OF ANOTHER ENTITY' reads menacing as a headline for a standard governance action
- (glm-5.3-flash) Whole screen is nearly empty; no actions available
  - fix: Rewrite kind as 'Single signer' vs 'Multi-signer (m of n)'; move 'lazy/hash' detail behind an advanced disclosure
  - fix: Rename takeover card to 'Add an entity you sign for'

### desktop-dark/15-sovereignty.png

- (gemini-flash-latest) Dispute parameters show 'Can dispute without asking: 0 of 1' without clear next steps or explanation of why co-signing is required or blocked.
- (gemini-flash-latest) 'Save evidence bundle' button lacks a visual indicator of bundle size, hash, or format (.json / .zip).
- (gemini-flash-latest) Per-counterparty card displays 'awaiting their signature · no proof yet' in faint text with no manual ping/re-request button.
  - fix: Provide a concrete diagnostic state explaining why dispute readiness is 0/1 and what is needed to unlock unilateral dispute.
  - fix: Display the SHA-256 hash of the evidence bundle directly adjacent to the 'Save evidence bundle' CTA.
  - fix: Add a 'Request Co-signature' or 'Sync State' action to the counterparty card.
- (glm-5.3-flash) Best trust screen, but all figures are $0.00/0 of 1 so the enforceability story is unproven
- (glm-5.3-flash) 'awaiting their signature · no proof yet · they answer in 1d, you in 1d' is a dense run-on in the counterparty card
- (glm-5.3-flash) 'Can dispute without asking 0 of 1' needs one clarifying line about what asking means
- (glm-5.3-flash) 'Save evidence bundle' is exactly right for Kenji/Ravi but appears before any money exists — no example of its output
  - fix: Break the counterparty status into stacked lines with icons and countdown
  - fix: Add a tooltip linking 'dispute without asking' to the challenge-window doc

### desktop-dark/16-desk.png

- (gemini-flash-latest) Raw error text 'MARKET_WIRE_JSON_REQUIRED' appears again in the right-side order book widget.
- (gemini-flash-latest) Table row contains 'No accounts yet. Open one from Home.' leaving all header columns (POSITION, SECURED, AT RISK, YOU OWE, SEND/RECEIVE, LINES) empty.
- (gemini-flash-latest) Top status shows 'frame #7 · 1 px = $10' without an explanation of whether the table scales visually row by row.
  - fix: Fix the market data feed ingestion so the order book displays live bid/ask ladders or clean offline message.
  - fix: Render populated sample account rows or a comprehensive empty state explaining table columns.
  - fix: Provide a table toggle to switch between absolute proportional visual bar mode and raw numeric tabular mode.
- (glm-5.3-flash) Table header truncated ('FR…' cut at right edge) and the book card overlaps the table's right column — data is clipped, worst legibility failure in the set
- (glm-5.3-flash) Seven color-coded columns (Position/Secured/At Risk/You Owe/Send·Receive/Lines) plus a seven-item legend strip, all $0.00 — dense without data
- (glm-5.3-flash) 'Reserve · on-chain' row mixes two layers in one label while the columns above assume accounts
- (glm-5.3-flash) 'MARKET_WIRE_JSON_REQUIRED' leaks here too
  - fix: Fit the table to its container or allow horizontal scroll with a visible affordance; never truncate the last header
  - fix: Show the legend as column tooltips instead of a color strip
  - fix: Fix the book error string as on 05-swap

### desktop-dark/17-palette.png

- (gemini-flash-latest) Action shortcuts in the command palette have low-contrast shortcut hints ('send money', 'invoice, QR', 'book at the hub') that blend into dark grey background.
- (gemini-flash-latest) No category grouping (Actions, Navigation, System) in the command palette list.
- (gemini-flash-latest) Selecting entries that require open accounts (e.g., 'Swap', 'Move') lacks status badges indicating readiness.
  - fix: Group command palette items into distinct sections: 'Quick Actions', 'Navigation', and 'Security'.
  - fix: Increase contrast ratio of right-aligned descriptive subtitles to WCAG AA compliance.
  - fix: Add subtle keyboard navigation shortcuts (e.g. 'P', 'R', 'S') alongside commands.
- (glm-5.3-flash) Command palette is clean, but descriptions like 'batch, attention, doors' are cryptic
- (glm-5.3-flash) No keyboard hint per item (only ⌘K in the input) and no recent/frequent grouping
- (glm-5.3-flash) 'keys, proofs, exposure' jargon will not help Maya or Fatima
- (glm-5.3-flash) Overlay dims content that includes the same clipped table problem from 16-desk behind it
  - fix: Write task-outcome descriptions ('See what is enforceable on-chain', 'Move money between layers')
  - fix: Add a Recents section and per-item shortcut hints

### mobile-dark/01-home.png

- (gemini-flash-latest) Empty state typography and hierarchy feel sparse; '1 px = $10 · auto' is cryptic calibration text exposed to end consumers without explanation.
- (gemini-flash-latest) Bottom activity snippet is awkwardly clipped behind the bottom navigation bar with bad z-index overlap ('Recent / Account opened').
- (gemini-flash-latest) Primary action row gives equal visual weight to 'Pay' via solid fill while leaving Receive/Swap outlined, causing unbalanced visual tension.
  - fix: Hide '1 px = $10 · auto' scale indicator or place it inside an explicit visual bar legend when balances exist.
  - fix: Add explicit safe-area padding-bottom (pb-24) to the scroll container to prevent content from bleeding under bottom navigation.
  - fix: Rebalance primary action row with uniform high-contrast surface styling and clear iconography.
- (glm-5.3-flash) Zero-state dominates: '$0.00' everywhere including the hero makes the first impression 'empty product', top of 01-home
- (glm-5.3-flash) Legend row 'On-chain / Reserve / Secured / At risk' uses four colored dots with no amounts context and wraps awkwardly ('At risk' drops to second line), upper-middle
- (glm-5.3-flash) '1 px = $10 · auto' scale caption is developer telemetry, meaningless to a user, right of BALANCES header
- (glm-5.3-flash) 'no tokens' + em-dash in H1 account card reads as broken state rather than an explained zero, ACCOUNTS card
  - fix: When total is zero, replace the $0.00 hero with a 'Fund your wallet' action card; show the number only once funded
  - fix: Give the balance legend a single line with dot+label+amount in a fixed 2x2 grid, or drop zero categories entirely
  - fix: Move '1 px = $10 · auto' into a tooltip behind an info icon
  - fix: Replace 'no tokens' with 'Open an account to hold USDC instantly' as a call to action

### mobile-dark/04-receive-bottom.png

- (gemini-flash-latest) Hex entity ID in 'YOUR ENTITY ID' block is unformatted and wraps awkwardly across two lines with low contrast (#525866).
- (gemini-flash-latest) Duplicate action triggers ('Copy invoice', 'Copy link', text link 'Copy xln:// app link') confuse user choice without explaining protocol difference.
- (gemini-flash-latest) Top of screen is clipped without header context, indicating excessive vertical scrolling needed for a simple payment request.
  - fix: Format entity ID with monospace font and middle truncation (0x0eeb...3803) with dedicated copy button.
  - fix: Consolidate sharing actions into a primary 'Share Invoice' button and secondary icon-only link copy.
  - fix: Group invoice configuration and share buttons into a sticky bottom drawer or consolidated view.
- (glm-5.3-flash) This bottom half duplicates the amount/note/limit cards already seen in 04-receive — scrolling reveals repetition, not new value, top of 04-receive-bottom
- (glm-5.3-flash) 'The invoice is the same request as text, for any xln wallet' is implementation detail, SHARE card
- (glm-5.3-flash) 'Copy xln:// app link' as a third copy option creates choice overload with near-identical semantics, below Copy invoice/Copy link
- (glm-5.3-flash) Full entity id again exposed as a text block, YOUR ENTITY ID card
  - fix: Deduplicate: keep amount/note once, and let SHARE stick to the bottom as a sheet
  - fix: Rewrite share explainer to user outcome: 'Anyone can pay this from any xln wallet'
  - fix: Collapse the three copy options into one primary 'Share' button opening a native share sheet
  - fix: Truncate the id with tap-to-copy as in the main receive fix

### mobile-dark/04-receive.png

- (gemini-flash-latest) Oversized QR container forces essential invoice generation controls and share triggers far below the fold.
- (gemini-flash-latest) Warning banner 'No inbound room yet' provides an actionable link 'Open H1' but doesn't explain that the invoice will fail if shared as-is.
- (gemini-flash-latest) Dense high-density QR code on harsh pure white background card clashes with the dark container palette.
  - fix: Reduce QR card dimensions to 200x200px or make QR collapsible when entering amount and note.
  - fix: Style the 'No inbound room' alert as an amber blocking alert with direct inline resolution action.
  - fix: Soften QR container background from harsh #FFFFFF to a warm off-white (#EAEBED) with rounded 16px corner framing.
- (glm-5.3-flash) QR is enormous and pushes the share actions below the fold on a tall phone, top half of 04-receive
- (glm-5.3-flash) 'receive up to 0.00 instantly' caption sits opposite the amount field and reads as an error for new users, amount card
- (glm-5.3-flash) 'No inbound room yet. Extend a credit line to a hub' requires channel knowledge on the primary receive path, third card
- (glm-5.3-flash) Raw 52-char entity id is shown in full with copy affordance buried in a later card, YOUR ENTITY ID section
  - fix: Cap QR height (~40% viewport) and surface Copy link/Copy invoice above the fold
  - fix: Rewrite caption to 'Instant receive limit: $0.00 — open an account to raise it', and hide it when zero
  - fix: Move the credit-line explainer behind a collapsible 'Why is my instant limit 0?' link
  - fix: Show truncated id (0x0eeb…3803) with a copy button inline; full id only on tap

### mobile-dark/05-swap.png

- (gemini-flash-latest) Raw backend error code 'MARKET_WIRE_JSON_REQUIRED' printed directly in the order book card breaks trust immediately.
- (gemini-flash-latest) Swap button is disabled and muted (#3b4268) with no helper hint explaining whether the block is lack of liquidity or market wire failure.
- (gemini-flash-latest) Network toggle ('Same network' vs 'Across networks') at the top lacks visual affordance and state clarity.
  - fix: Replace raw error 'MARKET_WIRE_JSON_REQUIRED' with human-friendly empty state: 'No active liquidity pool on H1'.
  - fix: Add explicit validation state under Swap CTA ('Insufficient H1 balance to execute swap').
  - fix: Redesign network segmented control with a pill background and active sliding indicator.
- (glm-5.3-flash) Raw placeholder string 'MARKET_WIRE_JSON_REQUIRED' rendered in the BOOK card — a broken developer message in production UI, order book section
- (glm-5.3-flash) Book shows headers PRICE USDC / SIZE WETH and 'syncing' but no data and no spread/last price; Anya cannot judge fairness at all
- (glm-5.3-flash) 'Up to 0.00 with H1' on the pay side conflicts with the entered 100 — no visible error or disable, top card
- (glm-5.3-flash) No fee, no route, no price-impact line anywhere on the ticket
  - fix: Replace the wire error with an empty-state 'Book is loading — no levels yet'; never surface wire keys
  - fix: Show last price, best bid/ask and depth even when syncing; disable Swap and cap input at 'Up to 0.00 with H1'
  - fix: Add a quote summary row: rate, fee, min received, before the Swap button
  - fix: Fill flow 'Tap a level to fill the ticket' is good — keep it once real levels render

### mobile-dark/06-account.png

- (gemini-flash-latest) Top action button grid has asymmetrical styling: 'Pay' has filled violet background, while 'Extend credit', 'Swap', and 'Manage' are ghost buttons.
- (gemini-flash-latest) Account status 'Open' is rendered in green without showing actual credit limit, balance bar, or collateral utilization metrics.
- (gemini-flash-latest) Educational explainer paragraph at the bottom is small, dense low-contrast text that blends into the background.
  - fix: Display numeric limits immediately: show credit line cap, available collateral, and current net balance before status metadata.
  - fix: Standardize top button grid with uniform surface elevation and consistent outline/fill styling.
  - fix: Format the credit vs collateral explainer into structured key-value indicator pills.
- (glm-5.3-flash) No balances at all: credit line, collateral, utilisation, at-risk — the numbers Tomasz and Marcus need are absent, THIS ACCOUNT card
- (glm-5.3-flash) 'Frames signed 0' is protocol plumbing with no interpretation of whether 0 is good, detail rows
- (glm-5.3-flash) Two-row action grid (4 buttons in 3+1) leaves an orphaned 'Manage' tile and dead space, action area
- (glm-5.3-flash) Large empty region below the single card makes the screen feel unfinished, bottom two-thirds
  - fix: Add a balance block: credit line given/taken, collateral, available instant, exposure — with the green/violet color coding from Sovereignty
  - fix: Replace 'Frames signed 0' with 'Co-signed history: none yet' plus an info link
  - fix: Lay the four actions in one 4-up or 2x2 grid
  - fix: Add recent account activity (frames, payments with this hub) below the detail card

### mobile-dark/07-activity.png

- (gemini-flash-latest) Filter pills row is horizontally scrollable and cuts off 'Accou...' awkwardly at the right edge without scroll fade.
- (gemini-flash-latest) '1 movements' contains a grammatical error ('1 movements' instead of '1 movement') right under header.
- (gemini-flash-latest) Empty dark void dominates screen with only one historical event and no visual timeline anchor.
  - fix: Correct pluralization logic in counter ('1 movement' / 'N movements').
  - fix: Add horizontal gradient mask at edge of filter container to signify scrollability.
  - fix: Add friendly empty-state prompt below the single item indicating when transactions will appear.
- (glm-5.3-flash) '1 movements' is grammatically wrong and counts in the header instead of amounts, top right
- (glm-5.3-flash) Filter chips truncate mid-word ('Accou…') with no scroll affordance hint, chip row
- (glm-5.3-flash) Single row 'Account opened · created' has no timestamp, amount, or provable status icon — the list cannot answer 'did it settle'
- (glm-5.3-flash) Vast empty area below one entry; no guidance to first payment
  - fix: Fix pluralization ('1 movement') or drop the count
  - fix: Make the chip row horizontally scrollable with a fade edge, and shorten 'Account' to 'Accounts'
  - fix: Add time, hub id and a settled/pending badge to each row; tap opens the receipt sheet
  - fix: In zero-activity hours, show 'Payments land here instantly — share your address' CTA

### mobile-dark/08-activity-detail.png

- (gemini-flash-latest) Bottom sheet modal leaves massive empty vertical dark gap between header and sheet contents.
- (gemini-flash-latest) Missing cryptographic hash or exportable proof button on the receipt modal despite indicating 'From your runtime's committed frames'.
- (gemini-flash-latest) Dismiss hit targets ('X' icon and pull bar) are small for mobile touch targets.
  - fix: Add an explicit 'Export Signed Frame' or 'Copy Frame Proof' action button at the bottom of the modal.
  - fix: Show exact frame hash with middle truncation and copy icon next to 'Frame #7'.
  - fix: Increase modal touch padding and provide a visible bottom action bar.
- (glm-5.3-flash) Receipt for 'Account opened' exposes 'Frame #7' and 'runtime's committed frames' — internal consensus vocabulary, receipt sheet
- (glm-5.3-flash) No share/export or copy-receipt action on the receipt; Sofia cannot forward it, receipt sheet bottom
- (glm-5.3-flash) No hash or signature preview, so 'provable' is asserted ('From your runtime's committed frames') not shown
- (glm-5.3-flash) Dimmed background list shows the same '1 movements' pluralization bug, top of screen
  - fix: Translate to user terms: 'Opened account with H1 · confirmed 19:39:39' and link Frame #7 to an explorer-style view
  - fix: Add 'Share receipt' / 'Save PDF' buttons to every receipt
  - fix: Show truncated tx/frame hash with copy and verify actions
  - fix: Fix the pluralization upstream

### mobile-dark/10-move-bottom.png

- (gemini-flash-latest) 'Sign & send' button is disabled with low contrast (#2c304d) while error text sits orphaned below button row.
- (gemini-flash-latest) 'Add to batch' action is present without showing current batch queue count or status.
- (gemini-flash-latest) Explanation box 'WHAT HAPPENS' contains radio button icon styling that suggests an unselected option rather than an informational card.
  - fix: Place validation error directly above primary action button, clearly stating prerequisite action ('Deposit to Reserve first').
  - fix: Remove radio circle from 'Fund you through H1' and replace with clear informational badge or flow diagram.
  - fix: Add batch item badge counter next to 'Add to batch'.
- (glm-5.3-flash) Error text sits between the action buttons and the explanation, visually an orphan, mid-screen of 10-move-bottom
- (glm-5.3-flash) 'WHAT HAPPENS: Fund you through H1' explains the mechanism but not the cost or the failure mode if H1 is offline, bottom card
- (glm-5.3-flash) 'Add to batch' is unexplained — batching semantics are never described anywhere, action row
- (glm-5.3-flash) Screen cut mid-card ('WHAT HAPPAINS' header clipped at bottom edge) — bottom padding insufficient
  - fix: Bind the error to the amount field and remove the orphan gap
  - fix: Extend WHAT HAPPENS with fee and 'what if the hub doesn't respond' one-liner
  - fix: Either remove 'Add to batch' from v1 or add a one-line explainer with a badge showing queued items
  - fix: Add bottom scroll padding so cards never clip against the nav bar

### mobile-dark/10-move.png

- (gemini-flash-latest) 3x3 source and destination selection cards ('Wallet', 'Reserve', 'Account') look identical and crowd mobile width, causing text clipping.
- (gemini-flash-latest) Validation error 'Amount exceeds what is available here' appears at the bottom rather than inline adjacent to the amount input.
- (gemini-flash-latest) Screen scrolls heavily, pushing 'Sign & send' CTA below the fold when keyboard opens.
  - fix: Replace bulky 3-card matrix with an intuitive segmented tab or step toggle (From [Wallet] -> To [Account]).
  - fix: Position balance error message immediately beneath the numeric input field in red with shake animation.
  - fix: Anchor 'Sign & send' button to sticky bottom bar above navigation.
- (glm-5.3-flash) FROM/TO each repeat three tall cards with identical labels and all $0.00 — six cards before the amount, top half of 10-move
- (glm-5.3-flash) Selected FROM=Reserve and TO=Account but every balance reads 0.00 and the 250 input is accepted until a red error far below, amount card + error line
- (glm-5.3-flash) 'Amount exceeds what is available here' appears after the action buttons, disconnected from the field it invalidates
- (glm-5.3-flash) 'Recipient entity · leave empty for yourself' and 'Ox… entity id' jargon on a consumer path, recipient card
  - fix: Collapse FROM/TO into two compact segmented rows with balance inline; only show unselected options on tap
  - fix: Validate inline: cap the amount field and disable 'Sign & send' when funds are insufficient
  - fix: Place the error directly under the amount input
  - fix: Rewrite recipient helper: 'Send to someone else? Paste their xln id (optional)'

### mobile-dark/11-manage.png

- (gemini-flash-latest) 2-column grid cards ('Sovereignty', 'Move', 'Assets', 'Lending', 'Ownership') have uneven descriptions, creating ragged visual rhythm.
- (gemini-flash-latest) Card borders and elevations are uniform, giving dangerous operational settings (Sovereignty/Disputes) the exact same emphasis as Lending or Move.
- (gemini-flash-latest) Accounts list at bottom shows '0 lanes · 0 frames · open' which looks like unparsed debug telemetry.
  - fix: Group navigation items by intent: Operational funds (Move, Assets), Financial (Lending), and Protocol Security (Sovereignty, Ownership).
  - fix: Translate '0 lanes · 0 frames · open' into human status ('Idle · Ready to transact').
  - fix: Standardize card heights or use list cell patterns with disclosure chevrons.
- (glm-5.3-flash) Two tiles use the identical shield icon (Sovereignty, Ownership) — icon no longer communicates, tile grid
- (glm-5.3-flash) Five feature tiles with one-line blurbs but no live data (no balances, no pending items) — a launcher, not a dashboard
- (glm-5.3-flash) 'NEEDS ATTENTION: Nothing waiting on you.' spends a whole card to say nothing; could be a badge-free single line, attention card
- (glm-5.3-flash) '0 lanes · 0 frames · open' in the H1 row is unexplained jargon, ACCOUNTS card
  - fix: Differentiate Ownership with a people/key icon
  - fix: Surface one live figure per tile (e.g. Lending: pool size; Move: total available)
  - fix: Render 'needs attention' only when non-empty; otherwise omit the card
  - fix: Translate the account row to 'Instant balance $0.00 · open'

### mobile-dark/12-assets-bottom.png

- (gemini-flash-latest) Faucet trigger buttons stack into 4 nearly identical solid purple full-width buttons, looking unpolished and like debug developer UI.
- (gemini-flash-latest) Debts section description is verbose wall of text without structured debt ledger representation.
- (gemini-flash-latest) Token selection row ('USDC', 'WETH', 'USDT', 'TRX', 'SUN') uses inconsistent chip grid with orphan item on bottom row.
  - fix: Nest faucet actions into a single dropdown menu or segmented action selector ('Request Testnet Funds').
  - fix: Align token selection into an even grid or horizontal scroll chip bar.
  - fix: Move developer faucet section into a dedicated 'Developer / Testnet' submenu under Settings.
- (glm-5.3-flash) Four stacked full-width violet buttons ('Hub pays me USDC over credit', etc.) have equal weight — no hierarchy among four different faucets, FAUCETS card
- (glm-5.3-flash) 'Hub pays me USDC over credit' is incomprehensible to anyone but Tomasz; test-money plumbing on a primary list, first button
- (glm-5.3-flash) Token selector (USDC/WETH/USDT/TRX/SUN) applied implicitly to all four buttons — the relationship is not visually stated, token grid
- (glm-5.3-flash) SUN token with no logo or explanation among well-known assets, token grid
  - fix: Convert faucets to a single 'Get test funds' flow with a two-step pick (what → where)
  - fix: Label the credit faucet 'Instant USDC via H1 (credit line)' with an info link
  - fix: Wrap token grid and buttons in one visually grouped card labeled '1. Choose token → 2. Choose destination'
  - fix: Add a 'test token' tag to SUN or remove it

### mobile-dark/12-assets.png

- (gemini-flash-latest) 'Move into reserve' button is placed inside the token list card in an awkward standalone square tile.
- (gemini-flash-latest) Signer and Depository contract addresses are rendered in low-contrast grey (#585e72) with middle ellipsis, making verification tedious.
- (gemini-flash-latest) 'Depository may pull 0.00' explanation line confuses users about allowance permissions.
  - fix: Convert 'Move into reserve' into a full-width action button anchored to bottom or top of card.
  - fix: Add copy buttons next to Signer and Depository addresses for frictionless on-chain verification.
  - fix: Clarify allowance label: 'Approved for Depository: $0.00' with an inline 'Approve' link.
- (glm-5.3-flash) 'Depository may pull 0.00' under every token is allowance jargon repeated three times, token rows
- (glm-5.3-flash) 'Move into reserve' button is half-clipped at the card edge and its label overflows the tile, bottom of ON-CHAIN WALLET card
- (glm-5.3-flash) Gas 0.0000 ETH with no top-up action or fiat value; all amounts lack $ equivalents, wallet card
- (glm-5.3-flash) 'A debt appears when a settlement or dispute closes with more owed than there was collateral' is a protocol paragraph, DEBTS card
  - fix: Replace per-row allowance text with a single 'Depository allowance: $0.00 · Manage' footer line
  - fix: Fix the 'Move into reserve' tile size and text fit
  - fix: Add fiat equivalents and a 'Get gas' action when gas < threshold
  - fix: Rewrite DEBTS empty state to 'No debts. You owe nothing on-chain.'

### mobile-dark/13-lend-bottom.png

- (gemini-flash-latest) H1 Pool statistics ('Available', 'Borrowed', 'Active principal') show raw 0.00 without asset denomination tags.
- (gemini-flash-latest) Explanatory paragraph between CTA and pool card is dense text with low scannability.
- (gemini-flash-latest) Top of screen cuts off the Token input field entirely upon scrolling.
  - fix: Append token currency symbols to pool figures (e.g., '0.00 USDC').
  - fix: Format pool metrics with visual mini-bars showing pool utilization percentage.
  - fix: Shorten explainer to a one-line tooltip under the CTA.
- (glm-5.3-flash) Term selector '1 hour / 1 day / 1 month' in a 2+1 grid leaves an orphan tile and implies missing options, term card
- (glm-5.3-flash) No shown outcome: '0.00 USDC → interest ≈ 0.00' preview is missing before committing, above the button
- (glm-5.3-flash) 'H1 POOL: Available 0.00 / Borrowed 0.00 / Active principal 0.00' — three zeros with no empty-state interpretation, pool card
- (glm-5.3-flash) Clipped card at bottom edge ('Refresh' row cut), pool card
  - fix: Lay terms in one 3-up row
  - fix: Add live preview 'You lend 100 USDC for 1 day at 1% → receive 101 USDC'
  - fix: Replace the zero pool with 'Pool is empty — your offer will be the first' plus risk note
  - fix: Fix bottom clipping with scroll padding

### mobile-dark/13-lend.png

- (gemini-flash-latest) Token input field is an empty box with placeholder text 'Token' but no selector or dropdown chevron visible.
- (gemini-flash-latest) Term options ('1 hour', '1 day', '1 month') are arranged as an awkward asymmetric grid (2 stacked, 1 floating).
- (gemini-flash-latest) 'Offer to the pool' button is disabled with low contrast and no helper text explaining missing fields.
  - fix: Make token selector an explicit dropdown button populated with supported lending assets (e.g., 'Select Token: USDC').
  - fix: Arrange Term buttons in a single horizontal 3-column row with uniform aspect ratios.
  - fix: Add dynamic yield projection (e.g., 'Est. Return: +0.01 USDC') next to basis points calculation.
- (glm-5.3-flash) Hub card shows 'H1 · 0 lanes' — pool health, APY and utilization are absent, so lenders cannot judge risk, top card
- (glm-5.3-flash) Token card is an empty gray box with only placeholder text 'Token' — looks broken, second card
- (glm-5.3-flash) 'Interest you ask · basis points' with 100 prefilled and '= 1.00% per term' — no market reference rate to know if 100 is fair, interest card
- (glm-5.3-flash) 'Offer to the pool' button is disabled-looking (muted violet) with no reason shown, action button
  - fix: Add pool stats to the hub card: APY, utilization, active lenders, collateral coverage
  - fix: Populate the token selector (default USDC) instead of an empty box
  - fix: Show pool average rate next to the input ('pool average 80 bps')
  - fix: Enable/disable with an explicit reason line ('Enter an amount to offer')

### mobile-dark/14-ownership.png

- (gemini-flash-latest) Classification 'Lazy (hash of its board)' uses internal engineering taxonomy that confuses non-technical owners.
- (gemini-flash-latest) No interactive CTA or path provided to 'Register it on the EntityProvider to issue shares'.
- (gemini-flash-latest) Signer row badge 'you' lacks contrast and clear delineation from hash address.
  - fix: Replace 'Lazy' with consumer terminology: 'Unregistered (Local Hash)' with info popover.
  - fix: Add a primary button: 'Register Entity On-Chain' to initiate DAO/corporate registry.
  - fix: Style 'you' badge as an accented pill with distinct border.
- (glm-5.3-flash) 'Kind: Lazy (hash of its board)' and 'Register it on the EntityProvider' are raw protocol concepts, BOARD card
- (glm-5.3-flash) 'TAKE CONTROL OF ANOTHER ENTITY' as a section headline sounds adversarial to any skeptic, second card
- (glm-5.3-flash) Screen is two cards then 60% empty; no shares list, no signers beyond one, no actions available, whole screen
- (glm-5.3-flash) No link from Ownership to Sovereignty despite overlapping subject matter
  - fix: Rewrite to 'Wallet type: single owner (1 of 1). Advanced: multi-owner board.'
  - fix: Rename section 'Entities you can control' with an empty state 'None yet'
  - fix: Add a signers/shares list with an 'Invite co-owner' action to fill the screen
  - fix: Cross-link: 'Recovery and proofs live in Sovereignty'

### mobile-dark/15-sovereignty-bottom.png

- (gemini-flash-latest) Subtext 'awaiting their signature · no proof yet · they answer in 1 d' is low-contrast and packed on a single wrapping line.
- (gemini-flash-latest) Lack of direct 'Initiate Dispute' or 'Force Close' button if counterparty is uncooperative.
- (gemini-flash-latest) Top ledger metrics are cut off, requiring awkward mid-card scroll.
  - fix: Structure counterparty status into key metrics: Status, Timeout Timer, and Available Recourse.
  - fix: Add secondary action 'Review Dispute Terms / Challenge Window'.
  - fix: Ensure card padding prevents overlapping text on narrow viewports.
- (glm-5.3-flash) Screen opens mid-sentence ('Trust only $0.00' legend split across screenshots) — poor scroll anchoring, top of 15-sovereignty-bottom
- (glm-5.3-flash) 'Save evidence bundle' is the most important Kenji-facing action but its consequences ('any runtime can open a dispute from it') are only below the button, LEDGER card
- (glm-5.3-flash) 'awaiting their signature · no proof yet · they answer in 1 d' is a dense triple clause with truncation, PER COUNTERPARTY row
- (glm-5.3-flash) No challenge-window countdown or dispute entry point visible for the existing account
  - fix: Anchor section headers so legends don't split at fold boundaries
  - fix: Move the evidence-bundle explanation above the button; keep 'Save evidence bundle' as the primary CTA
  - fix: Break the counterparty status into badge + one line: 'No proof yet · hub responds in 1 day'
  - fix: Add a 'Dispute H1' action with an explicit challenge-window countdown on the counterparty card

### mobile-dark/15-sovereignty.png

- (gemini-flash-latest) Color key in text ('Green is yours... Violet is what a counterparty owes you') relies on reading paragraphs rather than an instant visual balance bar.
- (gemini-flash-latest) '0 of 1' counterparty co-signed status in amber creates immediate anxiety without explaining the pending protocol step.
- (gemini-flash-latest) Primary action 'Save evidence bundle' is shown as normal button without indicating file format, size, or cryptographic significance.
  - fix: Render the canonical horizontal balance bar partitioned into Green (Enforceable) and Violet (Credit/Risk) sections.
  - fix: Provide explicit status text for 0 of 1: 'Awaiting H1 counter-signature on Frame #8'.
  - fix: Add subtitle to evidence button: 'Export JSON proof & signatures for on-chain dispute'.
- (glm-5.3-flash) 'Can dispute without asking 0 of 1' — ambiguous whether 0 is bad or just nothing pending, LEDGER card
- (glm-5.3-flash) 'in this page · 0x6343a3…6ba1' for Runtime reveals the ephemeral browser runtime as a fact without reassuring about persistence, LEDGER card
- (glm-5.3-flash) Per-counterparty row clipped at the fold with 'they answer in 1 d' truncated, bottom of 15-sovereignty
- (glm-5.3-flash) Green/violet legend is excellent but appears only after scrolling past the hero on some variants — keep it adjacent to the number
  - fix: Rewrite to 'Disputes ready: none open' with an info link on the 0-of-1 logic
  - fix: Explain runtime persistence: 'Runs in this page; recover anytime with your phrase'
  - fix: Fix bottom clipping of the per-counterparty card
  - fix: Pin the green/violet legend directly under the Enforceable figure on all scroll positions
