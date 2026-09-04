# Design review summary

Reviewers: openrouter/google/gemini-flash-latest, zai-coding-cn/glm-5.3-flash

| screen | hierarchy | premium | typography | color | data_legibility | layout | visceral_value | responsive | consistency | trust | total |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| desktop-dark/01-home.png | 760 | 740 | 730 | 760 | 700 | 645 | 460 | 585 | 755 | 740 | **688** |
| desktop-dark/04-receive.png | 730 | 735 | 725 | 755 | 710 | 640 | 450 | 590 | 750 | 770 | **686** |
| desktop-dark/05-swap.png | 635 | 600 | 670 | 640 | 540 | 610 | 355 | 595 | 665 | 480 | **579** |
| desktop-dark/06-account.png | 605 | 685 | 700 | 695 | 565 | 500 | 285 | 515 | 720 | 675 | **595** |
| desktop-dark/07-activity.png | 715 | 720 | 715 | 725 | 710 | 580 | 410 | 555 | 765 | 770 | **667** |
| desktop-dark/08-activity-detail.png | 675 | 710 | 695 | 725 | 700 | 590 | 400 | 565 | 765 | 780 | **661** |
| desktop-dark/09-settings.png | 700 | 695 | 710 | 720 | 690 | 640 | 705 | 600 | 745 | 725 | **693** |
| desktop-dark/10-move.png | 705 | 695 | 700 | 690 | 640 | 635 | 430 | 595 | 730 | 625 | **645** |
| desktop-dark/11-manage.png | 655 | 690 | 695 | 715 | 650 | 570 | 330 | 560 | 730 | 700 | **630** |
| desktop-dark/12-assets.png | 650 | 640 | 685 | 615 | 655 | 630 | 380 | 595 | 690 | 625 | **617** |
| desktop-dark/13-lend.png | 675 | 680 | 695 | 685 | 650 | 605 | 340 | 580 | 720 | 665 | **630** |
| desktop-dark/14-ownership.png | 635 | 695 | 680 | 700 | 645 | 540 | 280 | 515 | 720 | 710 | **612** |
| desktop-dark/15-sovereignty.png | 745 | 740 | 720 | 755 | 715 | 650 | 440 | 600 | 755 | 800 | **692** |
| desktop-dark/16-desk.png | 710 | 700 | 715 | 680 | 635 | 680 | 550 | 740 | 740 | 650 | **680** |
| desktop-dark/17-palette.png | 780 | 780 | 740 | 750 | 745 | 695 | 525 | 715 | 775 | 725 | **723** |
| mobile-dark/01-home.png | 760 | 730 | 765 | 740 | 690 | 695 | 470 | 740 | 760 | 770 | **712** |
| mobile-dark/04-receive-bottom.png | 660 | 695 | 710 | 695 | 665 | 610 | 500 | 635 | 710 | 725 | **661** |
| mobile-dark/04-receive.png | 745 | 740 | 725 | 730 | 710 | 680 | 500 | 710 | 720 | 755 | **702** |
| mobile-dark/05-swap.png | 695 | 660 | 720 | 695 | 610 | 655 | 470 | 685 | 700 | 555 | **645** |
| mobile-dark/06-account.png | 705 | 730 | 760 | 765 | 700 | 640 | 430 | 710 | 760 | 790 | **699** |
| mobile-dark/07-activity.png | 740 | 745 | 745 | 760 | 715 | 670 | 505 | 715 | 775 | 795 | **717** |
| mobile-dark/08-activity-detail.png | 775 | 780 | 785 | 795 | 760 | 745 | 505 | 780 | 790 | 850 | **757** |
| mobile-dark/10-move-bottom.png | 665 | 665 | 720 | 690 | 645 | 620 | 470 | 655 | 725 | 695 | **655** |
| mobile-dark/10-move.png | 680 | 675 | 720 | 700 | 645 | 635 | 490 | 675 | 730 | 710 | **666** |
| mobile-dark/11-manage.png | 725 | 730 | 750 | 755 | 720 | 690 | 475 | 740 | 775 | 780 | **714** |
| mobile-dark/12-assets-bottom.png | 600 | 595 | 690 | 620 | 620 | 575 | 400 | 655 | 675 | 625 | **606** |
| mobile-dark/12-assets.png | 700 | 710 | 735 | 710 | 700 | 660 | 425 | 705 | 730 | 740 | **682** |
| mobile-dark/13-lend-bottom.png | 655 | 665 | 715 | 680 | 665 | 630 | 405 | 690 | 710 | 670 | **649** |
| mobile-dark/13-lend.png | 675 | 680 | 720 | 685 | 675 | 645 | 405 | 700 | 715 | 685 | **659** |
| mobile-dark/14-ownership.png | 730 | 740 | 755 | 755 | 730 | 705 | 450 | 745 | 775 | 800 | **719** |
| mobile-dark/15-sovereignty-bottom.png | 705 | 690 | 745 | 705 | 690 | 655 | 430 | 675 | 740 | 780 | **682** |
| mobile-dark/15-sovereignty.png | 740 | 710 | 740 | 715 | 700 | 660 | 440 | 685 | 740 | 800 | **693** |

**Overall: 669 / 1000** (mean of screen totals across reviewers)

## Priority fixes by reviewer

### openrouter/google/gemini-flash-latest · desktop-dark · 711

The desktop dark suite establishes a clean, high-conviction fintech aesthetic with its Obsidian material and disciplined typography, but it suffers from severe desktop space underutilization and incomplete financial bar visualizations. Crucially, the indigo accent (#6E7CFF) is frequently overused on non-movement actions (faucets, exports, secondary nav), diluting the product's core semantic promise.

- Strictly enforce the indigo (#6E7CFF) rule: demote all Faucet, Copy Link, Evidence Bundle, Swap, and Move buttons to neutral dark surfaces (#21262D), reserving indigo solely for the primary money-out flow.
- Implement persistent scale rulers and zero-notch baseline bars across Home, Account, and Sovereignty even in $0.00 empty states to deliver the visceral value promise.
- Fix desktop layout balance by establishing a max-width content container (1120px) or expanding secondary inspection panels to eliminate the vast black voids on wide viewports.
- Remove developer artifacts and wire-state leaks (e.g. 'MARKET_WIRE_JSON_REQUIRED' in Swap and Desk) in favor of deterministic fallback UI.
- Embed the canonical bilateral bar (send room / zero notch / receive room / holds) into Account (06) and Move (10) screens.

### openrouter/google/gemini-flash-latest · mobile-dark · 732

The mobile dark implementation establishes a solid, credible Obsidian aesthetic with clean typography and high-trust cryptographic receipts. However, it severely dilutes its signature features through indiscriminate use of the reserved indigo accent on non-movement buttons, card-stacking clutter, and almost complete absence of the promised 'visceral value' single-scale balance bars.

- Strictly enforce the indigo (#6E7CFF) color invariant: immediately strip indigo from 'Copy link' (Receive), 'Save evidence bundle' (Sovereignty), and Faucet buttons (Assets), restricting it exclusively to irreversible value transfers (Pay, Move, Sign & send).
- Implement the 'Visceral Value' single-scale horizontal bar across all zero and active account views (Home, Account, Move, Sovereignty) with an explicit zero-notch rule and visible 1px = $N scale indicator.
- Eliminate multi-card fatigue on mobile form screens (Receive, Move, Lend) by grouping inputs into unified surfaces separated by subtle 1px dividers rather than stacking 5+ isolated outline boxes.
- Replace raw technical leakages ('MARKET_WIRE_JSON_REQUIRED' in Swap, unwrapped 66-character hex strings in Receive/Ownership) with production-ready status representations and chunked monospace formatting.
- Fix button group grid alignments and hierarchy: resolve asymmetric 3+1 layouts in Account, unbalanced 2x2 grids in Lend term selection, and unify disabled button states across the entire application.

### zai-coding-cn/glm-5.3-flash · desktop-dark · 590

A calm, restrained Obsidian surface with consistently good typography and honest empty states, but the product's defining idea — one absolute-scale bar with semantic halves — is almost never drawn, and internal sentinels (MARKET_WIRE_JSON_REQUIRED), a broken color semantic (amber 'you owe', violet zeros), and ghost money-moving CTAs undercut trust and premium on exactly the screens where money moves.

- Draw the bilateral one-scale bar (send/receive halves, zero notch, hatched holds) on Home, Account, Move and Sovereignty; wire every '1 px = $N' label to a visible bar.
- Replace MARKET_WIRE_JSON_REQUIRED in Swap and Desk with proper empty/syncing states; never render sentinels.
- Enforce the fixed color semantics everywhere: red = you owe (Desk's amber chip is wrong), violet = at-risk only when nonzero, indigo only on the single enabled money-moving action (Assets' five indigo faucet buttons and disabled Swap/Lend ghost-indigo all violate this).
- Attach validation and constraints to their inputs: Move's red error under the amount field with disabled-state reason, Swap's 'up to 0.00' promoted to secondary, Lending's disabled reason inline.
- Fix copy and density details: '1 movements' pluralization, truncated FRAMES header, entity-id truncation-with-copy standard across Receive/Activity/Ownership, and Manage's door grid reduced to a quiet list.

### zai-coding-cn/glm-5.3-flash · mobile-dark · 631

A calm, consistent dark foundation with strong typography and genuine trust cues (committed-frame receipts, evidence bundle), but the flagship visceral-value principle — one-scale comparable bars — is essentially unexecuted: stubs appear without scale, and the account screen where the two-half bar matters most has none. The indigo accent is diluted across copy buttons, selection borders, faucet buttons and export CTAs, and several raw dev states (MARKET_WIRE_JSON_REQUIRED, clipped captions, cut filter pills) ship to users.

- Implement the one-scale bar everywhere money is shown: bilateral two-half bar with zero notch on the account screen, per-token bars on Assets/Home, and a single px=$N caption wherever a bar renders; never show unequal stubs at equal zero values
- Enforce indigo = money movement only: demote Copy link, Save evidence bundle, faucet buttons (one primary + quiet secondaries), 'you' chip, and selection borders; give every money CTA an unambiguous enabled/disabled state (full accent vs 40% + label)
- Ship-kill the raw states: remove MARKET_WIRE_JSON_REQUIRED from Swap, fix '1 movements', truncate the clipped H1 status and activity filter pills, fix the clipped 'Move into reserve' label
- Compress repeated zero-states and explainer prose: collapse the Home tier legend, Assets allowance rows, Move's six duplicated venue cards, and Sovereignty's colour paragraphs into compact shared components
- Unify tier vocabulary across Home and Sovereignty (Secured/At risk vs Collateral/Trust-only) and stop repeating signer/entity hashes without a shared address component with tap-to-copy

## Issues per screen

### desktop-dark/01-home.png

- (gemini-flash-latest) Home desktop: severe dead space across the bottom 55% of the viewport makes the left column feel abandoned rather than intentional.
- (gemini-flash-latest) Home desktop: the legend under the balance shows four zero-value pills ('On-chain $0.00', 'Reserve $0.00', 'Secured $0.00', 'At risk $0.00') without rendering any empty-state representation of the promised absolute bar.
- (gemini-flash-latest) Home desktop: '1 px = $10 auto' is stranded in the balances header row with no scale ruler or baseline container beneath it.
  - fix: Home desktop: anchor the Balances section with a persistent scale track and zero-line marker even when empty, rather than a raw text empty state.
  - fix: Home desktop: reduce top padding and constrain max-width to 1120px centered, or distribute Accounts and Recent modules down the right column with expanded metrics to balance viewport height.
  - fix: Home desktop: set the primary action bar button group to use a strict 12px gap with identical border-radius and unified hover state.
- (glm-5.3-flash) Home desktop: the tier legend row (On-chain / Reserve / Secured / At risk, each $0.00) sits under the total but all four dots are green except At risk — 'Secured' renders green while the rubric's collateral green is fine, yet no bar exists anywhere, so the one-absolute-scale principle is invisible on the primary screen; there is no bar at all against which '1 px = $10 · auto' applies.
- (glm-5.3-flash) Home desktop: the 'BALANCES' header floats above an empty state with a stray 'Move' label mid-column and '1 px = $10 · auto' on the right — three orphaned labels describing nothing; on a wide desktop the balances region collapses to one sentence leaving ~60% of the card empty.
- (glm-5.3-flash) Home desktop: 'Instant: send up to $0.00 · receive up to $0.00' is a third line of zeros stacked under the total and the tier legend — the same zeros are repeated three times before any action.
- (glm-5.3-flash) Accounts card: 'H1 USDC — no tokens' shows an em-dash with no amount and no bar; the account's two-half send/receive bar, the product's signature element, is absent on Home.
  - fix: Home desktop: draw the one-scale bar for each token row under BALANCES (left half send room, right half receive room, notch at zero) so '1 px = $10' governs a visible object.
  - fix: Home desktop: collapse the tier legend into a single caption line attached to the total ('on-chain · reserve · secured · at risk') and delete the third zeros line, folding instant room into the bar halves.
  - fix: Home desktop: remove the floating 'Move' column label; give BALANCES rows real left-aligned columns (asset, bar, amount) filling the card width.

### desktop-dark/04-receive.png

- (gemini-flash-latest) Receive desktop: the pure white, unpadded QR code container visually burns out against the deep Obsidian dark theme and lacks corner containment matching card radii.
- (gemini-flash-latest) Receive desktop: two competing primary-weight buttons ('Copy invoice' outline vs 'Copy link' solid indigo) violate the rule reserving #6E7CFF strictly for actions moving money.
- (gemini-flash-latest) Receive desktop: raw entity ID hex string wrapped arbitrarily without a dedicated monospaced copy block or checksum visualizer.
  - fix: Receive desktop: tint QR quiet zone to #0D1017 with an off-white foreground module (#E6EDF3) or place inside an inner card with 20px padding and 16px radius.
  - fix: Receive desktop: demote 'Copy link' to secondary neutral button; neither button moves money, so neither should use the indigo accent (#6E7CFF).
  - fix: Receive desktop: format Entity ID in JetBrains Mono with 4-character chunks and an inline click-to-copy accessory icon.
- (glm-5.3-flash) Receive desktop: 'receive up to 0.00 instantly' is right-aligned inside the amount field at low contrast while the big amount shows '0.00' — the constraint the user most needs is quieter than the placeholder.
- (glm-5.3-flash) Receive desktop: the QR is rendered on a cream/white card that is the brightest object on screen; it pulls the eye before the wallet identity or amount, fighting hierarchy for the money-relevant elements.
- (glm-5.3-flash) Receive desktop: the entity id is wrapped mid-hash across two lines in mono; truncation with a copy affordance would be more legible than a broken 40-hex string.
- (glm-5.3-flash) Receive desktop: the left column ends at the 'No inbound room yet' note leaving the lower 40% of the viewport empty while the right column holds two stacked cards of unequal height — the two-column grid is unbalanced.
  - fix: Receive desktop: move 'receive up to X instantly' to a caption under the amount field at secondary-emphasis text color, not tertiary.
  - fix: Receive desktop: darken the QR quiet zone to the surface color with white modules and a 1px hairline border instead of the cream card.
  - fix: Receive desktop: truncate the entity id to 0xa25e…b6ed with a copy button, full value on click.

### desktop-dark/05-swap.png

- (gemini-flash-latest) Swap desktop: raw developer error string 'MARKET_WIRE_JSON_REQUIRED' exposed in the Book pane breaks fintech production trust completely.
- (gemini-flash-latest) Swap desktop: Swap primary CTA button is enabled and styled in full-bleed indigo while receiving quote reads '0.00', inviting invalid submissions.
- (gemini-flash-latest) Swap desktop: Book widget top right features an unstyled yellow 'syncing' status dot that clashes with the fixed semantic palette.
  - fix: Swap desktop: replace 'MARKET_WIRE_JSON_REQUIRED' with a structured orderbook skeleton or clean empty state ('No active book on H1').
  - fix: Swap desktop: disable the 'Swap' action button (opacity 0.4, cursor not-allowed, neutral border) until a non-zero quote is resolved.
  - fix: Swap desktop: align order book columns (PRICE USDC, SIZE WETH) with right-aligned tabular JetBrains Mono numerals.
- (glm-5.3-flash) Swap desktop and 16-desk.png: the order book renders the raw error string 'MARKET_WIRE_JSON_REQUIRED' as UI content in an all-caps muted style — a developer sentinel leaking into a shipping surface; it destroys trust exactly where trades are priced.
- (glm-5.3-flash) Swap desktop: 'Up to 0.00 with H1' is tertiary text yet it is the binding constraint on the entered 100; the user can type an unfillable amount with no inline state until submit.
- (glm-5.3-flash) Swap desktop: the Swap CTA is a desaturated indigo with no enabled/disabled logic visible while the book is 'syncing' — the one money-moving accent is spent on an action that cannot succeed.
- (glm-5.3-flash) Swap desktop: empty right-rail space below the BOOK card (over half the viewport height) with the ticket column capped at ~560px; the desktop width is unused.
  - fix: Swap desktop: replace MARKET_WIRE_JSON_REQUIRED with an empty-book state ('No levels yet — syncing with H1') and log the sentinel, never render it.
  - fix: Swap desktop: disable the Swap button (30% indigo, no shadow) until the book has synced and the amount is within room; show 'exceeds room with H1' inline at the amount field.
  - fix: Swap desktop: promote 'Up to 0.00 with H1' to the same size/color as the amount label pair so constraint and input read together.

### desktop-dark/06-account.png

- (gemini-flash-latest) Account desktop: the bilateral account screen lacks the central bilateral capacity bar (send half / receive half with zero notch) entirely.
- (gemini-flash-latest) Account desktop: four primary-row action buttons ('Pay', 'Extend credit', 'Swap', 'Manage') form an awkward 3+1 grid with 70% empty canvas beneath.
- (gemini-flash-latest) Account desktop: hex address under H1 title is truncated without copy affordance or link to the sovereignty explorer.
  - fix: Account desktop: insert the core bilateral bar component directly under H1 header showing available send, holds, zero notch, and inbound credit room.
  - fix: Account desktop: re-layout action buttons into a coherent single row or flex toolbar with 'Pay' as primary and collateral/credit management as secondary outlines.
  - fix: Account desktop: expand 'This account' panel to show counterparty credit limit, our credit limit, and locked collateral values in tabular format.
- (glm-5.3-flash) Account desktop (H1): an account detail screen with zero position visualization — no two-half bar, no notch, no hold hatching, though credit line/collateral/owed are all named in the sidebar text; the core visceral-value object is missing on its canonical screen.
- (glm-5.3-flash) Account desktop: the left 60% is four action buttons and then empty space to the fold; 'Frames signed 0' and balances are deferred to a right card, so the eye lands on Pay before any state.
- (glm-5.3-flash) Account desktop: the explainer paragraph ('Every frame here is signed by both of you…') duplicates what the missing bar should show spatially — prose substituting for the position graphic.
  - fix: Account desktop: add the bilateral one-scale bar as the hero element under the title (left = send room with notch, right = receive room, hatched holds), sized to the left column width.
  - fix: Account desktop: move Counterparty/Network/Frames/Status into a compact meta row and give the freed right card to balances; delete the explainer paragraph or reduce it to a bar caption.

### desktop-dark/07-activity.png

- (gemini-flash-latest) Activity desktop: two-column layout leaves an immense void below the single activity row and the right-hand inspection card.
- (gemini-flash-latest) Activity desktop: '1 movements' counter top right uses incorrect plural grammar and sits disconnected from the filter tabs.
- (gemini-flash-latest) Activity desktop: filter pills ('All', 'Payments', 'Swaps', 'Settlement', 'Accounts') lack clear count badges and active-state contrast.
  - fix: Activity desktop: fix string template to '1 movement' and move it adjacent to the 'Activity' title in text-muted 14px.
  - fix: Activity desktop: give the selected activity row an active left indicator border (#6E7CFF, 2px) to clearly bind it to the detail card on the right.
  - fix: Activity desktop: set maximum container height with a persistent border-split between list and inspection panel rather than floating disconnected cards.
- (glm-5.3-flash) Activity desktop: the amount column is absent — 'Account opened with H1 · created' has no value, and with the type only in a chip-like row the list cannot be scanned for money movement.
- (glm-5.3-flash) Activity desktop: '1 movements' top-right is a pluralization bug and reads as debug telemetry; it is the only count on screen yet styled at the lowest emphasis.
- (glm-5.3-flash) Activity desktop: the list column is ~600px wide with a single 76px row; the remaining height and the two-column split leave both columns mostly empty on a wide desktop.
  - fix: Activity desktop: add right-aligned tabular-amount column (— for non-monetary events) and a signed colored amount for payments/swaps.
  - fix: Activity desktop: fix to '1 movement' and render the count as a list-header caption ('TODAY · 1 movement').

### desktop-dark/08-activity-detail.png

- (gemini-flash-latest) Activity Detail desktop: duplicate screenshot of screen 07; does not display deep transaction inspection (signatures, WAL frame hash, inputs/outputs).
- (gemini-flash-latest) Activity Detail desktop: 'From your runtime's committed frames' green dot is ambiguous—unclear whether it signifies local fsync, counterparty co-sign, or L1 finality.
- (gemini-flash-latest) Activity Detail desktop: counterparty address 'H1 0x23d8a3...21b7' collapses hub name and hex with no separator or copy button.
  - fix: Activity Detail desktop: render full cryptographic receipt drawer showing frame root, both Ed25519 signatures, and exact balance delta bar.
  - fix: Activity Detail desktop: separate hub badge from truncated hex with a bullet divider and provide explicit click-to-copy.
  - fix: Activity Detail desktop: style the proof status line with an explicit shield icon and link to Sovereignty inspection.
- (glm-5.3-flash) Activity detail desktop: 'From your runtime's committed frames' is the provability cue that matters most, yet it is one low-emphasis green line at the card bottom; the frame proof (#7, hash, signatures) is not inspectable here.
- (glm-5.3-flash) Activity detail desktop: 'With  H1 0x23d8a3…21b7' sets the id in the same weight/size as the name in a single token — the copyable identity is not separable and not truncation-consistent with Receive's full-wrap style.
- (glm-5.3-flash) Activity detail desktop: the detail card adds only Frame #7 and Time over the collapsed row; 'Account opened' at display size (34px) for a $0 non-event overstates hierarchy relative to monetary rows that will follow.
  - fix: Activity detail desktop: add a proof block (frame hash, both signatures, copy/export) and promote the committed-frames line to a labeled 'Proof' section.
  - fix: Activity detail desktop: split counterparty into name + truncated id with copy affordance, matching Receive's entity-id treatment.

### desktop-dark/09-settings.png

- (gemini-flash-latest) Settings desktop: page length stretches excessively into a single endless column while right rail only holds the scale preview card.
- (gemini-flash-latest) Settings desktop: 'Forget vault' destructive action sits alongside 'Reveal recovery phrase' and 'Lock' with insufficient visual warning isolation.
- (gemini-flash-latest) Settings desktop: sample balance card under Design mixes interactive preview buttons with inert preview bars, causing cognitive friction.
  - fix: Settings desktop: group settings into sticky horizontal tabs or two balanced desktop columns (Wallet/Scale/Display on left; Keys/Runtime/Danger on right).
  - fix: Settings desktop: isolate 'Forget vault' into an explicit Danger Zone panel with destructive red outline and confirmation step.
  - fix: Settings desktop: mark the Design 'Sample' preview box with a subtle 'Preview only' watermark so the Pay/Receive buttons are unmistakably non-clickable.
- (glm-5.3-flash) Settings desktop: the AT THIS SCALE panel shows '1,000 px' and '10,000 px' bar lengths for $10k/$100k — bars implying 10,000px on a 380px card; the explanatory caption admits overflow instead of the bars being drawable, breaking the one-scale promise inside the screen that defines it.
- (glm-5.3-flash) Settings desktop: the Design section packs scale, layout, theme, material, accent, numbers and risk color into one undifferentiated scroll; the sample card ($1,284,500 with green bar) is the only hierarchy anchor and it sits mid-page.
- (glm-5.3-flash) Settings desktop: 'Risk color' offers Violet/Red/Orange as equal chips — the rubric fixes violet=at-risk semantically; presenting red/orange as user-swappable equals invites misreading of the fixed semantics, and the copy 'Red stays for disputes' is buried at tertiary size.
- (glm-5.3-flash) Settings desktop: the left column of toggles (On-chain/Reserve/Accounts) uses full-width rows with right-edge toggles ~520px from their labels; on this viewport the eye must travel the whole row per control.
  - fix: Settings desktop: in AT THIS SCALE, draw all four bars at true relative length against a shared px ruler, capping at card width with an explicit 'clipped' marker rather than proportional-but-fake lengths.
  - fix: Settings desktop: pin the risk-color chips with a persistent caption 'violet = owed on signature alone' and demote Red/Orange to an advanced group.
  - fix: Settings desktop: constrain toggle rows to a max 560px label-to-control distance by grouping HOME toggles into a narrower column.

### desktop-dark/10-move.png

- (gemini-flash-latest) Move desktop: source ('From') and destination ('To') matrix cards look identical and lack clear directional vector flow.
- (gemini-flash-latest) Move desktop: validation error 'Amount exceeds what is available here' is placed below the submit buttons rather than directly beneath the amount field.
- (gemini-flash-latest) Move desktop: horizontal progress/capacity bars inside the Wallet/Reserve/Account tiles are miniature and lack visceral scale comparison.
  - fix: Move desktop: place an explicit downward connector or arrow between 'From' and 'To' matrix rows to clarify route choreography.
  - fix: Move desktop: attach the balance validation error directly below the numeric input with inline red text and error ring on the input border.
  - fix: Move desktop: render the 3-state financial bar (On-chain, Reserve, Bilateral) at uniform scale inside each selection card.
- (glm-5.3-flash) Move desktop: the red error 'Amount exceeds what is available here' sits at the very bottom, below two buttons, after the user typed 250 against 0.00 balances shown only as tiny 'up to 0.00 USDC' — the constraint and the violation are on opposite ends of a tall form.
- (glm-5.3-flash) Move desktop: all six FROM/TO cards show 0.00 USDC with a small bar stub in the corner; the stubs are not at the shared scale and their meaning (credit room?) is unexplained, so visceral value reads as decoration.
- (glm-5.3-flash) Move desktop: primary 'Sign & send' renders as a grey ghost equal in weight to 'Add to batch' — the money-moving action does not carry the indigo accent, and the disabled reason is the distant red line.
- (glm-5.3-flash) Move desktop: 'Recipient entity · leave empty for yourself' with a 0x placeholder invites pasting an entity id with no validation state or identity resolution shown.
  - fix: Move desktop: show the selected source's available amount next to the Amount label at secondary emphasis and disable Sign & send (indigo at 30%) with the error attached directly beneath the amount field.
  - fix: Move desktop: draw each FROM/TO card's bar at the shared 1px=$ scale with a notch, and label the stub as room or remove it.
  - fix: Move desktop: make Sign & send the filled indigo button and Add to batch the ghost.

### desktop-dark/11-manage.png

- (gemini-flash-latest) Manage desktop: 2x3 navigation tile grid behaves like an intermediate portal/dead-end rather than a functional dashboard.
- (gemini-flash-latest) Manage desktop: massive expanse of empty black canvas occupies the entire bottom half of the wide viewport.
- (gemini-flash-latest) Manage desktop: 'Needs attention' card shows inert text 'Nothing waiting on you' taking up an entire wide container row.
  - fix: Manage desktop: embed live summary metrics (e.g. key quorum status, active debt, pending settlements) directly within the navigation cards.
  - fix: Manage desktop: merge the Accounts list into a dominant table spanning the right half of the screen with bilateral lane metrics.
  - fix: Manage desktop: collapse 'Needs attention' into a badge in the navigation rail when count is zero.
- (glm-5.3-flash) Manage desktop: five feature doors (Sovereignty/Move/Assets/Lending/Ownership) are equal-sized bordered cards with icon+label+caption — a launcher grid, the noisiest pattern in the product, contradicting the minimal-noise intent; none is distinguished by state or content.
- (glm-5.3-flash) Manage desktop: 'NEEDS ATTENTION — Nothing waiting on you.' consumes a full-width card for an empty state at the same visual weight as the doors; an empty attention queue should be one quiet line.
- (glm-5.3-flash) Manage desktop: the Accounts card shows 'H1 · 0 lanes · 0 frames · open' with no balance and no bar — the account appears with less financial data here than on Home.
  - fix: Manage desktop: replace the door grid with a left-aligned text list (label + one-line caption, no borders), and render Needs attention as a single caption line when empty.
  - fix: Manage desktop: surface H1's position summary (secured/at-risk amounts) in the Accounts card with the shared-scale bar.

### desktop-dark/12-assets.png

- (gemini-flash-latest) Assets desktop: right-hand Faucets panel features four stacked full-bleed indigo buttons, completely violating the rule reserving #6E7CFF for money-moving operations.
- (gemini-flash-latest) Assets desktop: 'Depository may pull 0.00' subtitle under each asset is cryptographically confusing and sounds like an unauthorized debit.
- (gemini-flash-latest) Assets desktop: Signer and Depository hex addresses top right are truncated without copy button or verification badge.
  - fix: Assets desktop: convert Faucet action buttons to neutral secondary outlines (#21262D background, muted white text) to protect indigo exclusivity.
  - fix: Assets desktop: rephrase 'Depository may pull 0.00' to 'Depository allowance: $0.00' or omit when zero.
  - fix: Assets desktop: show asset values with absolute-scale mini bars alongside numerals in the On-Chain Wallet list.
- (glm-5.3-flash) Assets desktop: the Faucets panel stacks five full-width filled indigo buttons ('Hub pays me USDC over credit', 'USDC straight into my reserve', …) — indigo is reserved for the one money-moving action, and here five money-movers compete with sentence-length button labels in a test-money panel.
- (glm-5.3-flash) Assets desktop: token rows show 'Depository may pull 0.00' as the subtitle for every asset — an allowance stated in the same visual weight as the balance, doubling zeros and obscuring which number is the user's.
- (glm-5.3-flash) Assets desktop: no bars at the shared scale anywhere on an assets screen; balances are right-aligned numbers only, so relative magnitudes are unreadable.
- (glm-5.3-flash) Assets desktop: 'Move into reserve' is a small bordered button while equivalent transfers on the Faucets side are huge filled indigo — the same operation class has two unrelated treatments.
  - fix: Assets desktop: demote faucet actions to a single token-select + one filled indigo 'Get test USDC' button; delete the four sentence-labeled variants.
  - fix: Assets desktop: rename allowance to tertiary 'allowance 0.00' and add a one-scale bar per token row sized to the on-chain wallet column.

### desktop-dark/13-lend.png

- (gemini-flash-latest) Lending desktop: Hub input is locked in an awkward single-card container ('H1 0 lanes') with no dropdown arrow or clear selector cue.
- (gemini-flash-latest) Lending desktop: Term duration selector ('1 hour', '1 day', '1 month') has broken layout with 1 hour and 1 day sharing row 1 and 1 month orphaned below.
- (gemini-flash-latest) Lending desktop: calculation '= 1.00% per term' is small and easily missed next to the raw basis points field.
  - fix: Lending desktop: format Term options into a unified 3-button segmented control ('1h', '1d', '1m') with equal 33.3% width.
  - fix: Lending desktop: promote the converted APR/APY percentage above the basis points input and compute expected yield in USDC based on amount entered.
  - fix: Lending desktop: visually structure the H1 Pool panel on the right with a bar graphic indicating pool utilization ratio.
- (glm-5.3-flash) Lending desktop: the disabled 'Offer to the pool' is rendered in muted indigo at full size while every upstream field (Token empty, amount 0.00) is unvalidated — the money-moving accent is spent on a permanently unclickable state with no stated reason.
- (glm-5.3-flash) Lending desktop: term options '1 hour / 1 day / 1 month' are three separate bordered boxes in a 2+1 wrap with the third orphaned; selection state (1 day, indigo outline) is the only signal and the wrap breaks scan order.
- (glm-5.3-flash) Lending desktop: 'Interest you ask · basis points 100 = 1.00% per term' places the converted percentage at right-edge tertiary size two lines tall — the number a lender cares about most is the least legible.
- (glm-5.3-flash) Lending desktop: 'Token' field is an empty unlabeled select between Hub and the amount; the flow can be read past with token unknown.
  - fix: Lending desktop: render term as a segmented control (3 equal segments, one row) and show '1.00% per term' at primary numeral size next to the basis-point input.
  - fix: Lending desktop: disable Offer with an inline reason ('choose a token / enter an amount') directly under the button, at 30% indigo.

### desktop-dark/14-ownership.png

- (gemini-flash-latest) Ownership desktop: extreme desert of dead space across 75% of the viewport; looks like an incomplete scaffolding.
- (gemini-flash-latest) Ownership desktop: 'Lazy (hash of its board)' uses internal protocol jargon without plain-language explanation of multisig security.
- (gemini-flash-latest) Ownership desktop: Signer address row has 'you' chip that collides visually with the hex truncation.
  - fix: Ownership desktop: combine Board and Take Control panels into a cohesive governance overview card with a signer quorum progress bar.
  - fix: Ownership desktop: replace 'Lazy (hash of its board)' with 'Off-chain consensus board' and provide a tooltip explaining L1 registration.
  - fix: Ownership desktop: pad signer table rows with explicit columns for Signer Address, Weight, Status, and Action.
- (glm-5.3-flash) Ownership desktop: 'Lazy (hash of its board)' and the sentence 'Register it on the EntityProvider to issue shares or change owners' are protocol internals surfaced as primary content; the user's actionable state (you control this entity, 1 of 1) is a table row.
- (glm-5.3-flash) Ownership desktop: the entire screen is one 600px card plus one empty-state card in a ~1280px viewport — two-thirds empty; 'Board' table and the takeover panel could share one column with room for shares/actions.
- (glm-5.3-flash) Ownership desktop: signer '0xcd2dfe…70a008 [you]' embeds the 'you' chip inline at mono size; identity of the viewer is the key fact and reads as metadata.
  - fix: Ownership desktop: lead with 'You control this entity' as the headline (threshold + signer beneath), move the lazy-entity explainer to a tertiary caption.
  - fix: Ownership desktop: widen the board card to the full column and add an actions row (issue shares, change owners) or an explicit disabled state explaining registration.

### desktop-dark/15-sovereignty.png

- (gemini-flash-latest) Sovereignty desktop: 'Per counterparty' card on the right has overlapping/awkward microcopy ('awaiting their signature · no proof yet · they answer in 1 d, you in 1 d').
- (gemini-flash-latest) Sovereignty desktop: primary CTA button 'Save evidence bundle' consumes the reserved money-movement indigo accent (#6E7CFF).
- (gemini-flash-latest) Sovereignty desktop: four balance categories under '$0.00' lack an empty-state visceral scale bar container.
  - fix: Sovereignty desktop: format dispute challenge timings into an explicit step ladder or timeline graphic instead of a dense run-on text line.
  - fix: Sovereignty desktop: style 'Save evidence bundle' as a high-contrast neutral button (#21262D border/fill with green verified badge) preserving indigo for transfers.
  - fix: Sovereignty desktop: render counterparty dispute exposure with a violet-tinted risk bar indicating un-cosigned balances.
- (glm-5.3-flash) Sovereignty desktop: 'Per counterparty: awaiting their signature · no proof yet · they answer in 1d, you in 1d' is one dense tertiary line in the right card — the at-risk state and the dispute clock, the most trust-critical data on screen, are the quietest text.
- (glm-5.3-flash) Sovereignty desktop: the color legend sentence ('Green is yours whatever anyone does… Violet is what a counterparty owes you…') is a two-line paragraph; per the rubric this repeats what semantic colors must already say and adds reading load under the total.
- (glm-5.3-flash) Sovereignty desktop: $0.00 total with four $0.00 legend items again draws no bar — 'Enforceable right now' is exactly where one absolute-scale bar of on-chain+reserve+collateral vs violet at-risk would land viscerally.
- (glm-5.3-flash) Sovereignty desktop: 'Save evidence bundle' is full-width filled indigo inside the LEDGER card while it is an export, not a money movement; the accent budget is spent off-payment here.
  - fix: Sovereignty desktop: promote per-counterparty risk and response-deadline to labeled rows ('At risk $0.00 · answer due in 1d') at secondary emphasis.
  - fix: Sovereignty desktop: replace the two-sentence legend with a bar caption and draw the enforceable-vs-at-risk bar at the shared scale under the total.
  - fix: Sovereignty desktop: restyle Save evidence bundle as a bordered secondary button; reserve indigo for payment actions.

### desktop-dark/16-desk.png

- (gemini-flash-latest) Desk desktop: top right action bar clusters Pay, Swap, and Move in identical solid indigo pills, diluting the singular primary action focus.
- (gemini-flash-latest) Desk desktop: Book panel shows 'MARKET_WIRE_JSON_REQUIRED' error and inert syncing indicator, degrading an otherwise strong professional console.
- (gemini-flash-latest) Desk desktop: legend under the main table (on-chain, reserve, collateral, at risk, you owe, credit room, in flight) repeats terms without interactive column filtering.
  - fix: Desk desktop: retain indigo exclusively for 'Pay'; switch 'Swap' and 'Move' to dark neutral secondary buttons.
  - fix: Desk desktop: wire the Book component to display resting bids and asks in tabular format with green/red depth bars.
  - fix: Desk desktop: make the color legend items clickable toggles to filter or highlight specific ledger types in the multi-lane table.
- (glm-5.3-flash) Desk desktop and 05-swap.png: 'MARKET_WIRE_JSON_REQUIRED' leaks into the book panel — a raw sentinel as the most prominent text in the right rail.
- (glm-5.3-flash) Desk desktop: the table header truncates its last column to 'FR…' and the legend row below carries seven color chips (on-chain, reserve, collateral, at risk, you owe, credit room, in flight) — the semantics exceed what the empty table demonstrates and the truncation signals overflow at default width.
- (glm-5.3-flash) Desk desktop: 'you owe' legend chip is amber/orange while the rubric fixes red for owed and violet for at-risk; on the Reserve·on-chain row the yellow $0.00 under YOU OWE contradicts the fixed semantic map used elsewhere (Sovereignty uses violet for at-risk).
- (glm-5.3-flash) Desk desktop: four stat cards (NET, YOURS ON-CHAIN, AT RISK, INSTANT SEND·RECEIVE) each display $0.00 with the at-risk value in violet at display size — a loud violet headline zero for a state that does not exist yet; emphasis is spent on emptiness.
  - fix: Desk desktop: replace the sentinel with an empty-book state; widen or drop the FRAMES column so no header truncates.
  - fix: Desk desktop: recolor YOU OWE to red and AT RISK to violet everywhere, matching Sovereignty and the fixed semantic map.
  - fix: Desk desktop: drop AT RISK's violet display-size zero to secondary emphasis when the value is 0.

### desktop-dark/17-palette.png

- (gemini-flash-latest) Command Palette desktop: backdrop blur is too dark/opaque, completely masking the Desk interface behind it and losing spatial positioning.
- (gemini-flash-latest) Command Palette desktop: shortcut badge '(⌘K)' is awkwardly placed inside the input placeholder rather than pinned to the right edge.
- (gemini-flash-latest) Command Palette desktop: icons use inconsistent visual weights (e.g. bold outlined 'Pay' arrow vs fine-line 'Activity' clock).
  - fix: Command Palette desktop: adjust backdrop overlay to rgba(5, 7, 10, 0.65) with 12px blur so context underneath remains subtly perceptible.
  - fix: Command Palette desktop: anchor a dedicated KBD chip '<kbd>ESC</kbd>' to the top right of the palette modal.
  - fix: Command Palette desktop: normalize all command palette SVG icons to a uniform 1.5px stroke and 18x18px bounding box.
- (glm-5.3-flash) Palette (jump overlay) desktop: the modal sits over the Desk screen but the backdrop dims so little that the truncated 'FR…' header and amber YOU OWE chip remain legible behind the list — modal figure/ground separation is weak for a focus-mode surface.
- (glm-5.3-flash) Palette desktop: right-aligned descriptors ('send money', 'batch, attention, doors', 'keys, proofs, exposure') use terse jargon matching internal nav names; they add noise without aiding choice and are inconsistent with the fuller captions used in Manage doors.
- (glm-5.3-flash) Palette desktop: the list ends at Lending with no footer hints (arrow to select, esc to close) and the ⌘K hint lives only in the placeholder text.
  - fix: Palette desktop: increase scrim to ~60% black with a subtle modal shadow so the underlying desk table stops competing.
  - fix: Palette desktop: align descriptors with Manage's door captions verbatim and add a '↑↓ navigate · ↵ open · esc close' footer row at tertiary emphasis.

### mobile-dark/01-home.png

- (gemini-flash-latest) Home mobile: The primary action row gives equal button geometry to 'Pay', 'Receive', and 'Swap', but tints only 'Pay' with indigo (#6E7CFF), breaking button group visual symmetry without establishing why 'Receive' is demoted to a hollow wireframe container.
- (gemini-flash-latest) Home mobile: The zero-state hides the visceral value bar entirely under an empty string ('Nothing here yet...'), forfeiting the opportunity to anchor the scale (1 px = $10) with an idle zero-axis rule and baseline tick.
- (gemini-flash-latest) Home mobile: The four tiny legend dots (On-chain, Reserve, Secured, At risk) stack in two lines below $0.00 with inconsistent horizontal spacing and clutter the top hierarchy before any balances exist.
  - fix: Home mobile: In the top balance breakdown, replace the wrapped multi-line legend dots with a single horizontal segmented rail with fixed slot widths and mono numerical values right-aligned.
  - fix: Home mobile: Render an empty-state visceral baseline bar with a vertical 0-notch and visible subtle grid lines so the user immediately understands '1 px = $10 · auto' before receiving funds.
  - fix: Home mobile: Unify primary action button styles: keep 'Pay' filled indigo (#6E7CFF), but elevate 'Receive' and 'Swap' to solid surface containers (e.g. background rgba(255, 255, 255, 0.06)) instead of thin low-contrast borders.
- (glm-5.3-flash) 01-home.png: the four-tier legend (On-chain/Reserve/Secured/At risk, all $0.00) plus the Instant line stacks five zero-amounts under a $0.00 total — for an empty wallet this is six repeated zeros pushing the action row below the fold of visual attention; collapse zero tiers to a single quiet line
- (glm-5.3-flash) 01-home.png: '1 px = $10 · auto' appears in the BALANCES header with no bar anywhere on screen — the visceral-scale control is exposed before any bar exists; hide it until the first balance row renders
- (glm-5.3-flash) 01-home.png: 'Move' floats mid-header between BALANCES and the scale caption as an orphan text link with no affordance; make it a right-aligned quiet button or move it into the card
- (glm-5.3-flash) 01-home.png: the hub chip 'hub', the 'no tokens' dash state and the em-dash share one row with no hierarchy — the dash for an empty amount is lighter than the 'no tokens' caption, inverting which one explains the other
  - fix: 01-home.png: when all tiers are $0.00 render one line 'On-chain · Reserve · At risk — $0.00 each' at caption size, and show the full legend only once any tier is non-zero
  - fix: 01-home.png: remove '1 px = $10 · auto' from the empty-state header and attach it to the first balance bar as trailing caption
  - fix: 01-home.png: replace the floating 'Move' label with the icon-only ghost button used by the action tiles, aligned right on the BALANCES baseline

### mobile-dark/04-receive-bottom.png

- (gemini-flash-latest) Receive bottom mobile: The screen content is heavily vertically fragmented into five separate rounded card outlines (Amount, Note, Warning banner, Share, Entity ID), creating card fatigue and noisy stacked borders.
- (gemini-flash-latest) Receive bottom mobile: Action buttons 'Copy invoice' and 'Copy link' violate the accent rule: 'Copy link' uses filled primary indigo (#6E7CFF) reserved strictly for actions that move money, while it is only a clipboard string copy.
- (gemini-flash-latest) Receive bottom mobile: The raw 66-character Entity ID hex string wraps across three awkward lines in low contrast with no one-tap copy button or chunked formatting.
  - fix: Receive bottom mobile: Demote 'Copy link' and 'Copy invoice' to secondary ghost or subtle elevated surface buttons (bg #18191E, text #F3F4F6) and remove the #6E7CFF fill.
  - fix: Receive bottom mobile: Merge 'Amount', 'Note', and 'Inbound room status' into a single grouped form container with 1px hairline dividers (#22242D) instead of 5 isolated floating cards.
  - fix: Receive bottom mobile: Truncate the Entity ID with a middle ellipsis (e.g. 0x0eeb…3803) or format it into 4-character monospace clusters, paired with a dedicated trailing inline copy icon.
- (glm-5.3-flash) 04-receive-bottom.png and 04-receive.png: 'Copy link' uses the indigo money-move accent, but copying a link moves no money — per spec indigo is reserved for the one money-moving action; demote to secondary surface style and keep accent on a future confirm
- (glm-5.3-flash) 04-receive-bottom.png: the raw 66-char entity id is shown full-width in two truncated-looking mono lines; it reads as an error; show it as 0xeebd…a3803 with a copy affordance and reveal full on tap
- (glm-5.3-flash) 04-receive-bottom.png: the 'No inbound room yet' card, the SHARE explainer and the entity-id explainer are three consecutive grey cards of near-identical weight — the actual action (Open H1) is the third link inside the first card and competes with body copy
- (glm-5.3-flash) 04-receive-bottom.png: sheet crops the Amount card at top with no handle visible in frame, losing context of what sheet this is
  - fix: 04-receive-bottom.png: restyle 'Copy link' with the same surface/label treatment as 'Copy invoice'; reserve indigo for Sign & send / Pay
  - fix: 04-receive-bottom.png: render entity id as '0xeebd…3803' single mono line with a copy icon; full id on tap or a dedicated details view
  - fix: 04-receive-bottom.png: merge the three cards into one 'Receive instantly' card whose primary row is the Open H1 action; move link/invoice copy into a compact share row

### mobile-dark/04-receive.png

- (gemini-flash-latest) Receive mobile: The oversized pure white QR plate (#FFFFFF container with stark rounded corners) creates jarring contrast glare against the Obsidian canvas, overpowering the screen title and input card.
- (gemini-flash-latest) Receive mobile: Viewport scroll cutting: the Amount card is cut in half at the fold, concealing whether this screen is meant to be an invoice builder or a fixed address dispenser.
- (gemini-flash-latest) Receive mobile: No visceral value feedback exists to visually depict the incoming capacity or maximum channel headroom against existing channels.
  - fix: Receive mobile: Reduce QR code outer card padding from ~32px to 16px, soften the background to an off-white cream or slight zinc (#ECEEF2), and cap QR size at 220x220px to fit Amount inputs above the mobile fold.
  - fix: Receive mobile: Anchor the active Inbound Room indicator (receive up to 0.00 instantly) right under the header as a horizontal capacity bar before the QR container.
  - fix: Receive mobile: Add a direct 'Set Amount' prompt on the QR display so the recipient knows the QR dynamically updates when typing.
- (glm-5.3-flash) 04-receive.png: the QR is white-on-cream, the brightest object on a near-black page — it dominates over the amount field, which is the actual input; consider a dark QR tile or reduced size (~180px)
- (glm-5.3-flash) 04-receive.png and 04-receive-bottom.png: indigo 'Copy link' violates the accent-reserved-for-money rule
- (glm-5.3-flash) 04-receive.png: the page repeats the full amount/note/inbound-room/share stack below the QR, producing a very tall single column with three explainer cards; desktop-grade sections collapsed into one scroll with no compression
- (glm-5.3-flash) 04-receive.png: 'receive up to 0.00 instantly' caption sits right-aligned against 'Amount · optional' label at similar size/weight — the constraint reads as a second label, not a limit
  - fix: 04-receive.png: cap QR at ~200px inside a rounded surface and let the amount field own the dominant type size on the page
  - fix: 04-receive.png: set the instant-limit caption at 13px low-emphasis and prefix with 'limit' so it reads as a constraint
  - fix: 04-receive.png: collapse the inbound-room explainer to a single-line row with inline 'Open H1' action

### mobile-dark/05-swap.png

- (gemini-flash-latest) Swap mobile: Under BOOK section, raw debug string 'MARKET_WIRE_JSON_REQUIRED' is dumped in monospace directly on the production surface, severely degrading trust and polish.
- (gemini-flash-latest) Swap mobile: The primary action button 'Swap' uses a disabled/faded muted indigo (#3E457B) that fails WCAG AA contrast against its white text label while appearing neither clearly active nor clean disabled.
- (gemini-flash-latest) Swap mobile: The network mode pill toggle ('Same network' vs 'Across networks') is positioned high in the header bar with clumsy horizontal padding and weak selected-state contrast.
  - fix: Swap mobile: Replace 'MARKET_WIRE_JSON_REQUIRED' with a polished loading skeleton or an explicit empty state ('Connecting to H1 orderbook…').
  - fix: Swap mobile: Standardize disabled action button state: dark neutral fill (rgba(255, 255, 255, 0.08)), text rgba(255, 255, 255, 0.35), removing washed-out indigo tones entirely until inputs are valid.
  - fix: Swap mobile: Move the network switcher directly above the 'You pay' card as an integrated segmented control with 32px height and distinct active pill indicator.
- (glm-5.3-flash) 05-swap.png: the book renders the literal placeholder string 'MARKET_WIRE_JSON_REQUIRED' as user-facing content — a broken internal state shipped to UI; it destroys trust in a money screen
- (glm-5.3-flash) 05-swap.png: the Swap CTA is a desaturated indigo that reads as disabled while inputs are filled (100 USDC) — ambiguous whether the button is disabled or merely muted; a money CTA must have one unambiguous state
- (glm-5.3-flash) 05-swap.png: 'Up to 0.00 with H1' is the send limit but is styled as an action-tinted link color; and there is no one-scale bar for the pay/receive legs despite the visceral-value principle
- (glm-5.3-flash) 05-swap.png: 'Same network / Across networks' segmented control sits in the header row squeezed next to the back button, truncating 'Across networks' at this width
  - fix: 05-swap.png: replace MARKET_WIRE_JSON_REQUIRED with an empty-state line ('Book is syncing — levels appear here') until real levels exist
  - fix: 05-swap.png: give the Swap CTA full-strength indigo when enabled and a distinct 40% opacity + 'enter amount' label when disabled
  - fix: 05-swap.png: move the network segmented control to its own row below the header and drop the link tint from the limit caption

### mobile-dark/06-account.png

- (gemini-flash-latest) Account mobile: Action buttons grid is asymmetric: three buttons on top ('Pay', 'Extend credit', 'Swap') and a solitary wide 'Manage' button below, leaving an awkward blank hole in the 2x2 grid.
- (gemini-flash-latest) Account mobile: Bilateral account state lacks its core visual deliverable: there is no two-half capacity bar showing own credit line, collateral, or what the counterparty owes.
- (gemini-flash-latest) Account mobile: 'Status: Open' uses green text, but green is strictly reserved for non-custodial / collateralized money; semantic status should be neutral zinc (#9CA3AF) or teal.
  - fix: Account mobile: Refactor action buttons into a balanced 4-column icon-plus-label strip (Pay, Credit, Swap, Manage) with equal square hit targets.
  - fix: Account mobile: Insert the canonical bilateral account split bar directly below the H1 title: left half = send capacity, right half = receive capacity, with a centered zero notch.
  - fix: Account mobile: Change 'Open' status pill color from money-green (#22C55E) to neutral slate badge with a subtle 6px status pip.
- (glm-5.3-flash) 06-account.png: an account detail screen shows zero bars — the two-half send/receive bar with zero-notch and hatching, the core visceral component, is absent where it matters most; '0' numerals replace the spatial model
- (glm-5.3-flash) 06-account.png: the action grid wraps to a second row leaving a large empty cell right of 'Manage' — an unbalanced 3+1 tile layout; use a 2x2 grid or a single row of four compact tiles
- (glm-5.3-flash) 06-account.png: ~60% of the viewport below THIS ACCOUNT is empty black; Frames signed 0 / Status Open could share a row with the summary, letting the explainer and activity anchor the lower half
- (glm-5.3-flash) 06-account.png: 'Hub' as the counterparty value duplicates the 'hub' chip next to H1 in the header — the same fact twice on one screen
  - fix: 06-account.png: add the bilateral two-half bar (left = send room, right = receive room, notch at zero, hatched holds) directly under the header as the hero element
  - fix: 06-account.png: switch the action area to a 2x2 tile grid so Manage does not orphan an empty cell
  - fix: 06-account.png: drop the Counterparty row; the header chip already states it

### mobile-dark/07-activity.png

- (gemini-flash-latest) Activity mobile: Filter pills at top ('All', 'Payments', 'Swaps', 'Settlement', 'Account') run off-screen on the right with no scroll fade affordance or snap alignment.
- (gemini-flash-latest) Activity mobile: The counter '1 movements' has poor grammatical casing/pluralization and sits orphaned at the far right of the page title in faint low-contrast grey.
- (gemini-flash-latest) Activity mobile: The single list item 'Account opened' does not display an execution timestamp or state badge, only an ambiguous grey dot labeled 'created'.
  - fix: Activity mobile: Fix grammatical string interpolation: '1 movement' (singular) and position it beneath the 'Activity' title in text-xs mono zinc (#71717A).
  - fix: Activity mobile: Add a right-edge linear gradient mask (to transparent) on the filter pill row to indicate horizontal scrollability on narrow viewports.
  - fix: Activity mobile: Replace '• created' with timestamp ('19:39') in JetBrains Mono and a distinct state badge indicating settlement finality.
- (glm-5.3-flash) 07-activity.png: filter pills (Payments/Swaps/Settlement/Accou…) overflow the right edge with the last pill cut mid-word and no scroll affordance — a cut chip reads as broken rendering, not scrollable content
- (glm-5.3-flash) 07-activity.png: '1 movements' is ungrammatical; also the count is low-emphasis grey while it is the only summary on the screen
- (glm-5.3-flash) 07-activity.png: a single row then ~80% empty viewport; the Today group has no footer affordance (e.g. 'older activity' hint) so emptiness is unexplained dead space
  - fix: 07-activity.png: make the pill row horizontally scrollable with a right-edge fade gradient, or collapse filters into a single 'Filter' control
  - fix: 07-activity.png: use '1 movement' singularization and raise the count to 14px medium
  - fix: 07-activity.png: add a quiet 'This is all your activity so far' caption at the list end

### mobile-dark/08-activity-detail.png

- (gemini-flash-latest) Activity detail mobile: 'From your runtime's committed frames' uses money-green (#22C55E) for an informational integrity caption; green is strictly reserved for fully collateralized assets.
- (gemini-flash-latest) Activity detail mobile: Modal bottom sheet height leaves massive empty black dead space across the upper 55% of the screen without dimming the background activity row adequately.
- (gemini-flash-latest) Activity detail mobile: Frame '#7' and Time '19:39:39' are rendered right-aligned in normal font size, missing an opportunity to show cryptographic commitment hashes or block depth.
  - fix: Activity detail mobile: Change footer status indicator dot and text from green to subtle violet (#A78BFA) or muted blue-gray (#94A3B8) with a lock icon for cryptographic provability.
  - fix: Activity detail mobile: Increase backdrop scrim opacity from ~0.4 to 0.75 blur to focus the sheet modal and suppress background item distraction.
  - fix: Activity detail mobile: Add a copyable frame commitment digest row (e.g. 'Commitment: 0x7f3a…c9') beneath Frame #7 in 11px JetBrains Mono.
- (glm-5.3-flash) 08-activity-detail.png: the dimmed background duplicates the identical Activity list, so the same row appears twice on one screen; standard sheet pattern, but the scrim is too light to differentiate context
- (glm-5.3-flash) 08-activity-detail.png: 'From your runtime's committed frames' is the key provability line but is small green text at the very bottom edge, flush against the safe area; it deserves a dedicated row with a seal/check icon
- (glm-5.3-flash) 08-activity-detail.png: Frame #7 and 19:39:39 lack a date and a copyable frame hash — for a receipt the content hash is the proof
  - fix: 08-activity-detail.png: darken the scrim to ~60% and round the sheet corners more strongly to separate layers
  - fix: 08-activity-detail.png: promote the committed-frames line into a bordered proof row with a check icon above the grabber-safe padding
  - fix: 08-activity-detail.png: add a 'hash 0x…' mono row with tap-to-copy next to Frame #7

### mobile-dark/10-move-bottom.png

- (gemini-flash-latest) Move bottom mobile: The error message 'Amount exceeds what is available here' is rendered in plain red text floating loosely in negative space below the action buttons rather than attached directly to the Amount input.
- (gemini-flash-latest) Move bottom mobile: Action buttons 'Sign & send' and 'Add to batch' are placed above the error message and above the 'WHAT HAPPENS' explanation card, reversing the natural mental progression (Input -> Preview -> Action).
- (gemini-flash-latest) Move bottom mobile: The destination selector cards at top are cut off horizontally and vertically, confusing the user regarding what source is being transferred.
  - fix: Move bottom mobile: Relocate error notification directly beneath the 'Amount' input card with an error icon and shake animation, clearing it from the button footer.
  - fix: Move bottom mobile: Move 'Sign & send' and 'Add to batch' to a sticky bottom container below 'WHAT HAPPENS' so the user reviews the operational route before executing.
  - fix: Move bottom mobile: Change the error text color from saturated red (#EF4444) to standard warning coral (#F87171) and disable 'Sign & send' explicitly.
- (glm-5.3-flash) 10-move-bottom.png: three destination cards each show '0.00 USDC' above a dark bar stub, but the stubs are unreadable as bars — the one-scale principle is present as decoration with no scale caption and no comparison value
- (glm-5.3-flash) 10-move-bottom.png and 10-move.png: amount 250 entered against 'up to 0.00 USDC' produces a bare red 'Amount exceeds what is available here' floating between buttons and explainer; the Send & send button itself shows no disabled/affordance change
- (glm-5.3-flash) 10-move-bottom.png: 'Sign & send' with a checkmark icon and 'Add to batch' are two quiet tiles of equal weight while Sign & send is the primary money action — no indigo, no hierarchy; the money CTA is weaker than the error text
- (glm-5.3-flash) 10-move-bottom.png: top crop shows the FROM row half-cut with no sheet handle; entering via bottom sheet loses the FROM selection context entirely
  - fix: 10-move-bottom.png: draw the three venue bars at one stated px=$ scale with a caption, using semantic fills (green owned / violet at-risk / grey room)
  - fix: 10-move-bottom.png: make 'Sign & send' the full-width indigo CTA, disabled at 40% with the error as its helper line; keep 'Add to batch' as a quiet secondary
  - fix: 10-move-bottom.png: anchor the error message directly under the amount field it validates, not between the CTAs and WHAT HAPPENS

### mobile-dark/10-move.png

- (gemini-flash-latest) Move mobile: The three-location model (Wallet, Reserve, Account) is duplicated identically into two stacked rows ('FROM' and 'TO') with 6 identical-looking rectangular cards, creating severe visual clutter and cognitive load.
- (gemini-flash-latest) Move mobile: Small horizontal capacity meters at the bottom of each location card (under '0.00 USDC') are too thin (2px) and illegible to communicate capacity or balance ratios.
- (gemini-flash-latest) Move mobile: The token selector in the header ('USDC') is visually disconnected from the amount input field below.
  - fix: Move mobile: Redesign the 'FROM' and 'TO' tier selection into a unified segmented carousel or visual transfer vector diagram (Source -> Arrow -> Destination) saving 140px of vertical height.
  - fix: Move mobile: Thicken the mini position bars inside the location cards from 2px to 4px and apply strict semantic colors (green for Wallet/Reserve, violet for Account).
  - fix: Move mobile: Embed the token picker pill directly inside the 'Amount' input field card right-aligned with the numeral.
- (glm-5.3-flash) 10-move.png and 10-move-bottom.png: FROM/TO selectors duplicate six near-identical cards with the same three labels and three zero amounts twice on one screen — enormous repetition for a form; the selected states (indigo borders) are the only differentiators
- (glm-5.3-flash) 10-move.png: indigo border is used both for selected FROM (Reserve) and selected TO (Account) and for the 'inbound room' link styling elsewhere — selection state and money-accent blur together
- (glm-5.3-flash) 10-move.png: the red validation error is 600+px away from the amount field it refers to when scrolled to this position
- (glm-5.3-flash) 10-move.png: six venue cards show three dark bar stubs each at apparently different widths for identical 0.00 values — stubs must be equal or absent at zero
  - fix: 10-move.png: compress FROM/TO into two compact segmented rows (Wallet · Reserve · Account) with the balance as caption; frees ~400px of vertical space
  - fix: 10-move.png: use indigo fill/border only for selection; style at-risk and room amounts with their semantic colors in the caption instead
  - fix: 10-move.png: at 0.00 render bar stubs at equal minimal width or omit them

### mobile-dark/11-manage.png

- (gemini-flash-latest) Manage mobile: The 2x2+1 grid leaves 'Ownership' as an awkward full-width or single-column orphan card below 'Assets' and 'Lending', breaking the 2-column symmetry.
- (gemini-flash-latest) Manage mobile: Cards mix navigational arrow icons ('-> Move') with descriptive status icons ('Shield', 'Wallet', 'Bank'), creating inconsistent card signifiers.
- (gemini-flash-latest) Manage mobile: 'Accounts' list entry ('H1 hub · 0 lanes · 0 frames · open') is text-heavy and lacks visual indication of counterparty balance or risk tier.
  - fix: Manage mobile: Restructure the top management tiles into an even 2x3 grid or a clean vertical list menu with uniform trailing chevrons and consistent leading icon treatments.
  - fix: Manage mobile: Unify card icon styling: use consistent outlined glyphs inside 32x32 rounded squircle containers with no ad-hoc inline arrow prefixes.
  - fix: Manage mobile: Add a compact bilateral balance bar to the H1 item under ACCOUNTS to preview credit state at a glance.
- (glm-5.3-flash) 11-manage.png: the feature grid wraps 2+2+1 leaving a lone 'Ownership' card and a half-row of dead space; the ragged grid reads unfinished on a fixed-width mobile column
- (glm-5.3-flash) 11-manage.png: Sovereignty and Ownership cards use the identical shield icon — two different destinations, same glyph side by side; pick a distinct glyph for one
- (glm-5.3-flash) 11-manage.png: '0 lanes · 0 frames · open' mixes counts and state in one jargon line; 'lanes' is unexplained domain vocabulary at first contact
- (glm-5.3-flash) 11-manage.png: NEEDS ATTENTION / 'Nothing waiting on you.' occupies a full card for an empty state; a single quiet line would do
  - fix: 11-manage.png: fit the six destinations as a 2x3 grid, or group them into a single list section with rows
  - fix: 11-manage.png: give Ownership a distinct icon (e.g. scale/gavel) separate from Sovereignty's shield
  - fix: 11-manage.png: replace '0 lanes · 0 frames · open' with 'No activity yet · open' and explain lanes inside the account screen

### mobile-dark/12-assets-bottom.png

- (gemini-flash-latest) Assets bottom mobile: The FAUCETS section features a vertical stack of four large bright indigo buttons (#6E7CFF), dominating the entire viewport and violating the rule that indigo is reserved for the ONE action that moves money.
- (gemini-flash-latest) Assets bottom mobile: Faucet token selector buttons ('USDC', 'WETH', 'USDT', 'TRX', 'SUN') form an irregular 2-column grid with a dangling 'SUN' button on row 3.
- (gemini-flash-latest) Assets bottom mobile: Testnet utility tooling is given first-class prominence on an otherwise production-grade fintech screen.
  - fix: Assets bottom mobile: Downgrade all four faucet claim buttons from solid indigo (#6E7CFF) to secondary dark outlined buttons or a single dropdown with one secondary 'Request test funds' button.
  - fix: Assets bottom mobile: Organize token chips into a clean single-row horizontal scrolling chip rail instead of an uneven multi-row grid.
  - fix: Assets bottom mobile: Wrap the entire Faucets panel inside an expandable disclosure accordion ('Developer Faucets · Testnet only') defaulted to collapsed.
- (glm-5.3-flash) 12-assets-bottom.png: four stacked full-width indigo faucet buttons — the money-move accent saturates the screen and violates the one-accent-action rule; four equal indigo CTAs have no hierarchy
- (glm-5.3-flash) 12-assets-bottom.png and 12-assets.png: 'Depository may pull 0.00' appears three times as an allowance row with zero allowance — repeated jargon ('pull') for a zero state; collapse to one line or hide at zero
- (glm-5.3-flash) 12-assets-bottom.png: the token selector (USDC/WETH/USDT/TRX/SUN) is a 2-3 column wrap of bordered chips — chip-grid noise the rubric penalizes; a segmented row or dropdown is calmer
- (glm-5.3-flash) 12-assets-bottom.png: 'Test money from the network…' positions a testnet faucet workflow with production-grade visual weight; it should be visually flagged as test-only
  - fix: 12-assets-bottom.png: render one indigo primary ('Hub pays me USDC over credit') and the other three as quiet secondary buttons
  - fix: 12-assets-bottom.png: hide 'Depository may pull' rows when allowance is zero; show a single 'No allowances' caption
  - fix: 12-assets-bottom.png: add a 'Testnet' badge next to the FAUCETS header and reduce chip borders to the selected state only

### mobile-dark/12-assets.png

- (gemini-flash-latest) Assets mobile: 'Move into reserve' button inside the ON-CHAIN WALLET card is stranded as a clumsy left-aligned box beneath the token rows, disturbing the list flow.
- (gemini-flash-latest) Assets mobile: Token rows (USDC, WETH, USDT) lack asset balance visual weight: the '0.00' balance numeral has the exact same font size and weight as the token symbol title.
- (gemini-flash-latest) Assets mobile: Subtitle 'Depository may pull 0.00' is repeated identically on three lines, creating redundant visual noise without clarifying allowance vs balance.
  - fix: Assets mobile: Move the 'Move into reserve' CTA to the card header beside 'Refresh' as a compact secondary button or an inline row action.
  - fix: Assets mobile: Differentiate token rows with tabular bold numerals (font-medium text-base JetBrains Mono) for amounts and subtle grey (text-xs #71717A) for allowances.
  - fix: Assets mobile: Replace redundant 'Depository may pull 0.00' with a clear status label like 'Approved: $0.00'.
- (glm-5.3-flash) 12-assets.png: token amounts all 0.00 with no bars — on an assets screen the visceral one-scale bar is the whole point; three zero rows render as plain text list
- (glm-5.3-flash) 12-assets.png: 'Move into reserve' button label is clipped by its tile ('Move into reserve' text touches the border, tighter than all other tiles) — inconsistent padding and near-overflow
- (glm-5.3-flash) 12-assets.png and 12-assets-bottom.png: 'Depository may pull 0.00' repeated on every token row
- (glm-5.3-flash) 12-assets.png: Signer/Depository mono hashes right-aligned at small size with no copy affordance; the Depository address is contract-critical
  - fix: 12-assets.png: add a single-scale horizontal bar per token row with the stated px=$ caption in the section header
  - fix: 12-assets.png: match the 'Move into reserve' tile padding to the other buttons (16px inset) or make it full-width secondary
  - fix: 12-assets.png: collapse zero allowance rows to a caption and add tap-to-copy on both hashes

### mobile-dark/13-lend-bottom.png

- (gemini-flash-latest) Lend bottom mobile: Term selector buttons ('1 hour', '1 day', '1 month') are arranged as an awkward 2x2 grid with an empty slot next to '1 month'.
- (gemini-flash-latest) Lend bottom mobile: The screen relies on repetitive stacked outline cards (Token, Lend/Borrow, Amount, Term, Interest, Pool Stats), resulting in cramped vertical scrolling and hidden action triggers.
- (gemini-flash-latest) Lend bottom mobile: 'Offer to the pool' button uses disabled muted purple/indigo with poor contrast against the card background.
  - fix: Lend bottom mobile: Render Term durations as a single 3-column segmented button row with equal flex-1 widths ('1h', '1d', '1mo').
  - fix: Lend bottom mobile: Consolidate Term and Interest basis points into a single composite loan parameters card.
  - fix: Lend bottom mobile: Keep 'Offer to the pool' pinned above the bottom tab bar when scrolled so the user does not have to scroll past H1 POOL metrics to submit.
- (glm-5.3-flash) 13-lend-bottom.png and 13-lend.png: 'Offer to the pool' CTA is a muted indigo that reads disabled with amount 0.00 — same ambiguous-CTA-state problem as Swap; also is offering to a pool a money-move deserving accent? Ambiguous against the one-accent rule
- (glm-5.3-flash) 13-lend-bottom.png: '= 1.00% per term' wraps to two lines right-aligned against '100', splitting a single computed value across lines
- (glm-5.3-flash) 13-lend-bottom.png: Term chips (1 hour / 1 day / 1 month) wrap 2+1 with an orphan '1 month' cell — same ragged-wrap pattern as other screens
- (glm-5.3-flash) 13-lend-bottom.png: the Token card is empty (label only, no control visible in frame) directly above the Lend/Borrow toggle — a form field with no visible value invites mistrust
  - fix: 13-lend-bottom.png: keep 'Offer to the pool' as the sole indigo CTA, full opacity when valid, 40% + 'enter amount' when not
  - fix: 13-lend-bottom.png: shorten to '=1.00% / term' on one line and give it fixed width
  - fix: 13-lend-bottom.png: lay the three term options on one row with equal widths
  - fix: 13-lend-bottom.png: give the Token card the same chip selector treatment used on Receive, or pre-fill USDC

### mobile-dark/13-lend.png

- (gemini-flash-latest) Lend mobile: Top 'Hub' card has an empty right half and an unstyled blue border around 'H1 0 lanes' that looks like an unfinished focus ring.
- (gemini-flash-latest) Lend mobile: 'Lend' and 'Borrow' toggle pills sit detached between the 'Token' card and 'Amount' card with no container bounding box.
- (gemini-flash-latest) Lend mobile: The screen lacks any pool depth or yield visualization to show visceral liquidity distribution across term tiers.
  - fix: Lend mobile: Anchor the 'Lend / Borrow' segment switcher at the very top of the page directly beneath the navigation bar header.
  - fix: Lend mobile: Style the Hub selector as a clean dropdown row with hub identity avatar, balance, and trailing selector arrow.
  - fix: Lend mobile: Add a proportional bar in the pool stats showing available vs borrowed capital at the selected term.
- (glm-5.3-flash) 13-lend.png: 'Hub H1 / 0 lanes' selector and empty Token card are stacked as two large cards for two small facts; 0 lanes should warn that nothing can lend here yet, but no consequence is surfaced
- (glm-5.3-flash) 13-lend.png: Lend/Borrow toggle is a tiny floating segmented control left-aligned mid-form, visually detached from the cards it switches; lowest-affordance control controls the whole screen mode
- (glm-5.3-flash) 13-lend.png and 13-lend-bottom.png: no pool bar or one-scale visualization of Available/Borrowed despite the pool being the mental model
- (glm-5.3-flash) 13-lend.png: with amount 0.00 the muted CTA state is indistinguishable from an enabled calm style
  - fix: 13-lend.png: surface '0 lanes — open the account first' inline warning when lanes are zero and disable the form
  - fix: 13-lend.png: move Lend/Borrow to a full-width segmented control directly under the header
  - fix: 13-lend.png: draw Available vs Borrowed as one stacked single-scale bar in the H1 POOL card

### mobile-dark/14-ownership.png

- (gemini-flash-latest) Ownership mobile: Signer chip 'you' uses low-contrast purple pill that blends into the background hex string.
- (gemini-flash-latest) Ownership mobile: The lower card 'TAKE CONTROL OF ANOTHER ENTITY' gives equal visual card prominence to an empty dead-end state ('Nothing to take over...').
- (gemini-flash-latest) Ownership mobile: The page is purely informational and lacks clear actionable hierarchy for registering on EntityProvider.
  - fix: Ownership mobile: Replace the purple 'you' tag with a distinct high-contrast zinc badge (bg #27272A, text #FAFAFA, border #3F3F46).
  - fix: Ownership mobile: Demote 'Take control of another entity' to a collapsed subtle footer row or text link rather than a full heavyweight container card.
  - fix: Ownership mobile: Convert 'Register it on the EntityProvider to issue shares' into an explicit actionable secondary button or linked chevron item.
- (glm-5.3-flash) 14-ownership.png: 'Lazy (hash of its board)' uses protocol jargon ('lazy entity') as a user-facing Kind value; the explainer below helps but the value row itself is opaque
- (glm-5.3-flash) 14-ownership.png: ~55% empty viewport below two cards with no further action; Ownership offers no primary action (e.g. 'Register on EntityProvider') despite the explainer naming it
- (glm-5.3-flash) 14-ownership.png: 'you' chip on the Signer row is indigo — a non-money use of the accent, diluting the semantic rule used everywhere else
  - fix: 14-ownership.png: reword Kind to 'Derived from board hash' with a one-line definition tooltip
  - fix: 14-ownership.png: add a quiet 'Register entity' secondary button under the BOARD card to resolve the named-but-unactionable next step
  - fix: 14-ownership.png: restyle the 'you' chip as neutral surface with border; reserve indigo fills for money actions

### mobile-dark/15-sovereignty-bottom.png

- (gemini-flash-latest) Sovereignty bottom mobile: The button 'Save evidence bundle' violates the core color principle by using filled primary indigo (#6E7CFF); downloading local cryptographic proof is an archival action, not an action that moves money.
- (gemini-flash-latest) Sovereignty bottom mobile: Warning metrics ('Accounts co-signed: 0 of 1', 'Can dispute without asking: 0 of 1') use bright amber (#F59E0B) numerals with zero explanatory tooltip or remedial action inline.
- (gemini-flash-latest) Sovereignty bottom mobile: Card borders and content are truncated at the bottom of the viewport with ambiguous scrolling bounds above the tab bar.
  - fix: Sovereignty bottom mobile: Recolor 'Save evidence bundle' to a secondary dark glass button (rgba(255, 255, 255, 0.08) with 1px border #27272A) to preserve indigo strictly for funds movement.
  - fix: Sovereignty bottom mobile: Provide an inline tap-to-explain popover or subline explaining why co-signing is 0 of 1 and how to request counterparty signature.
  - fix: Sovereignty bottom mobile: Pad the bottom of the scroll container with 96px safe-area space so the 'PER COUNTERPARTY' card clears the tab bar completely.
- (glm-5.3-flash) 15-sovereignty-bottom.png: the H1 per-counterparty row's status line 'awaiting their signature · no proof yet · they answer in 1 d…' runs off the right edge mid-word with no truncation ellipsis — critical risk information is clipped
- (glm-5.3-flash) 15-sovereignty-bottom.png and 15-sovereignty.png: the three-paragraph colour explainer is long-form prose inside a data screen; on mobile it pushes KEYS/LEDGER below the fold
- (glm-5.3-flash) 15-sovereignty-bottom.png: 'nothing at risk' is green text right-aligned against a clipped caption — two status texts of different importance collide on one line
- (glm-5.3-flash) 15-sovereignty-bottom.png: KEYS/LEDGER cards repeat signer/entity hashes already shown in Assets and Ownership — third appearance of the same ids with no shared component treatment
  - fix: 15-sovereignty-bottom.png: truncate the H1 status to 'awaiting signature · 1 d' with ellipsis and move the full text to the row's detail view
  - fix: 15-sovereignty-bottom.png: compress the colour legend to four two-word rows with dots (the same pattern Home uses) and drop the prose paragraph
  - fix: 15-sovereignty-bottom.png: separate 'nothing at risk' onto its own line above the status caption

### mobile-dark/15-sovereignty.png

- (gemini-flash-latest) Sovereignty mobile: The four balance categories (On-chain, Reserve, Collateral behind what you are owed, Trust only) are presented as a plain bulleted text list with dot pips rather than an integrated visceral bar breakdown.
- (gemini-flash-latest) Sovereignty mobile: Long explanatory prose paragraph ('Green is yours whatever anyone does...') creates heavy visual text density right under the primary balance header.
- (gemini-flash-latest) Sovereignty mobile: The term 'Trust only' uses violet dot, but the header balance claims 'Enforceable right now $0.00' which directly contradicts counterparty risk definitions.
  - fix: Sovereignty mobile: Replace the 4 bullet text items with an interactive stacked horizontal breakdown bar using strict semantic colors (green for enforceable on-chain/reserve/collateral, violet for trust-only).
  - fix: Sovereignty mobile: Move the explanatory risk text into an info sheet modal triggered via an 'ⓘ' icon beside the 'Enforceable right now' headline.
  - fix: Sovereignty mobile: Align terminology: display 'Enforceable ($0.00)' in green and 'At risk / Trust only ($0.00)' in violet as two distinct paired ledger metrics.
- (glm-5.3-flash) 15-sovereignty.png: 'Enforceable right now $0.00' is the hero total but the four-tier legend beneath lists On-chain/Reserve/Collateral/Trust-only — this screen's tier set differs from Home's (On-chain/Reserve/Secured/At risk) for overlapping concepts; inconsistent semantics across screens
- (glm-5.3-flash) 15-sovereignty.png: amber '0 of 1' twice in LEDGER signals warnings for what is just an empty state on testnet; amber should mean degraded, not zero
- (glm-5.3-flash) 15-sovereignty.png: 'Save evidence bundle' is a large indigo CTA — saving an export is not moving money, another accent dilution on a page already dense with meaning
- (glm-5.3-flash) 15-sovereignty.png: the long colour prose paragraph again consumes the width between the hero and KEYS, delaying the actionable Ledger content below the fold
  - fix: 15-sovereignty.png: unify tier vocabulary with Home (rename 'Secured'/'At risk' vs 'Collateral'/'Trust only' to one canonical set)
  - fix: 15-sovereignty.png: render '0 of 1' in neutral gray and reserve amber for actual degraded states (e.g. unanswered dispute past deadline)
  - fix: 15-sovereignty.png: demote 'Save evidence bundle' to a bordered secondary button; keep indigo exclusively for money movement
  - fix: 15-sovereignty.png: replace the prose with the compact dot-legend component shared with Home
