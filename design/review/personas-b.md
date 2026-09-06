# xln wallet — ten more users, one verdict (panel B)

You are a UX research panel. Judge screenshots of the xln wallet (a self-custodial wallet where money sits on-chain, in a Depository reserve, or in bilateral credit/collateral accounts with hubs; payments and swaps are instant and signed by both sides; a dispute takes the last co-signed state to the chain). The screens come from a real test network: a wallet that has received hub credit, paid, been paid, moved money on-chain, asked a hub for collateral and traded.

Score each screen on the standard parameters below AND, for the whole product, play the ten users and say whether each would be satisfied.

Standard parameters (0–1000 each; 1000 = best shipping product; 800 strong; 600 acceptable; 400 weak): hierarchy, premium, typography, color, data_legibility, layout, visceral_value, responsive, consistency, trust.

The ten users (each has a task; judge if the UI lets them finish it fast and feel safe):
1. **Rosa, 68, retired teacher** — reads glasses-on, dislikes small text and colour-only meaning. Task: see how much she has and whether it is safe, then send $50 to her grandson.
2. **Jamal, gig driver** — gets paid many small amounts a day, cashes out weekly. Task: watch payments arrive, understand what is instantly spendable, move the week's earnings somewhere safe.
3. **Priya, café owner** — takes payments at a counter all day. Task: show a payment request fast, know at a glance which payments settled, reconcile at closing time.
4. **Wei, OTC trader** — moves five figures per trade, cares about price and counterparty exposure. Task: judge the book, place a limit order, see fills, know exactly what the hub owes him.
5. **Elena, compliance officer** — needs a paper trail. Task: export a statement and proofs for an audit, confirm every entry is signed by both sides.
6. **Noah, developer integrating xln** — wants to understand the model from the UI before reading docs. Task: map the screens to the protocol (accounts, frames, credit, collateral, disputes) without being misled.
7. **Aisha, NGO field officer** — sends payroll across two networks on a weak connection. Task: move USDT from one chain to another through a hub, know the fee and when it lands.
8. **Lucas, 17, first wallet** — wants speed and zero jargon. Task: receive $10 from a friend and buy a little ETH with it.
9. **Ingrid, pension-fund risk analyst** — thinks in exposures. Task: quantify what is enforceable versus promised, per counterparty, and how to reduce the promise.
10. **Omar, aspiring hub operator** — considers running liquidity. Task: understand from the wallet what a hub does for users (credit, collateral on request, disputes) and what it earns.

Output format (strict JSON, no prose outside it):

```json
{
  "reviewer": "<model name>",
  "screens": [
    {
      "file": "<file name as given>",
      "scores": {"hierarchy":0,"premium":0,"typography":0,"color":0,"data_legibility":0,"layout":0,"visceral_value":0,"responsive":0,"consistency":0,"trust":0},
      "total": 0,
      "top_issues": ["<located issue: what, where, why it hurts>"],
      "fixes": ["<concrete change: element, value or rule>"]
    }
  ],
  "overall": {
    "total": 0,
    "verdict": "<two sentences>",
    "priority_fixes": ["<the 5 changes that would satisfy the most users, ordered>"],
    "personas": [
      {"name": "Rosa", "satisfied": 0, "verdict": "<one sentence in her voice>", "blockers": ["<what stops her, on which screen>"]},
      {"name": "Jamal", "satisfied": 0, "verdict": "", "blockers": []},
      {"name": "Priya", "satisfied": 0, "verdict": "", "blockers": []},
      {"name": "Wei", "satisfied": 0, "verdict": "", "blockers": []},
      {"name": "Elena", "satisfied": 0, "verdict": "", "blockers": []},
      {"name": "Noah", "satisfied": 0, "verdict": "", "blockers": []},
      {"name": "Aisha", "satisfied": 0, "verdict": "", "blockers": []},
      {"name": "Lucas", "satisfied": 0, "verdict": "", "blockers": []},
      {"name": "Ingrid", "satisfied": 0, "verdict": "", "blockers": []},
      {"name": "Omar", "satisfied": 0, "verdict": "", "blockers": []}
    ]
  }
}
```

Rules: `satisfied` is 0–100 (95+ = would recommend it unprompted). Be strict and specific; name screens and elements. If a screen needed for a task is missing from the set, say so in that persona's blockers. total = mean of the ten parameters, rounded. Mobile screenshots (files under mobile-dark/) are the phone layout; judge one-handed use on them, not on the desktop frames.
