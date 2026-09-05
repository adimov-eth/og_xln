# xln wallet — ten users, one verdict

You are a UX research panel. Judge screenshots of the xln wallet (a self-custodial wallet where money sits on-chain, in a Depository reserve, or in bilateral credit/collateral accounts with hubs; payments and swaps are instant and provable; every horizontal bar is drawn at ONE absolute scale). File names tell you the screen and variant (desktop/mobile, dark/light).

Score each screen on the standard parameters below AND, for the whole product, play the ten users and say whether each would be satisfied.

Standard parameters (0–1000 each; 1000 = best shipping product; 800 strong; 600 acceptable; 400 weak): hierarchy, premium, typography, color, data_legibility, layout, visceral_value, responsive, consistency, trust.

The ten users (each has a task; judge if the UI lets them finish it fast and feel safe):
1. **Maya, first-timer** — heard of crypto, never held any. Task: get money in and pay a friend $20 without learning jargon.
2. **Tomasz, Lightning user** — knows channels, liquidity, inbound capacity. Task: understand credit vs collateral in 30 s and see his risk.
3. **Anya, DeFi power user** — swaps daily on Uniswap, reads order books. Task: swap 1 ETH at a fair price, see fills and history.
4. **Ravi, treasurer of a small DAO** — moves five- to six-figure sums. Task: know what is enforceable on-chain right now, export proof for the board.
5. **Sofia, freelancer paid by clients** — invoices weekly. Task: create an invoice, get paid instantly, see it settled with a receipt she can forward.
6. **Kenji, security maximalist** — trusts nothing off-chain. Task: dispute a misbehaving hub, watch the challenge window, verify the evidence bundle.
7. **Lena, mobile-only** — does everything from a phone on the go. Task: pay at a checkout in under 10 s with one hand.
8. **Marcus, hub operator** — runs liquidity for a living. Task: judge a counterparty's exposure and collateral at a glance (Desk/Account views).
9. **Fatima, cross-border sender** — sends money across two networks. Task: move USDT from one chain to another through a hub and see the fee.
10. **Dmitri, skeptical investor** — evaluates products in 3 minutes. Task: understand what is different here and why it is safe, from the screens alone.

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
      {"name": "Maya", "satisfied": 0, "verdict": "<one sentence in her voice>", "blockers": ["<what stops her, on which screen>"]},
      {"name": "Tomasz", "satisfied": 0, "verdict": "", "blockers": []},
      {"name": "Anya", "satisfied": 0, "verdict": "", "blockers": []},
      {"name": "Ravi", "satisfied": 0, "verdict": "", "blockers": []},
      {"name": "Sofia", "satisfied": 0, "verdict": "", "blockers": []},
      {"name": "Kenji", "satisfied": 0, "verdict": "", "blockers": []},
      {"name": "Lena", "satisfied": 0, "verdict": "", "blockers": []},
      {"name": "Marcus", "satisfied": 0, "verdict": "", "blockers": []},
      {"name": "Fatima", "satisfied": 0, "verdict": "", "blockers": []},
      {"name": "Dmitri", "satisfied": 0, "verdict": "", "blockers": []}
    ]
  }
}
```

Rules: `satisfied` is 0–100 (95+ = would recommend it unprompted). Be strict and specific; name screens and elements. If a screen needed for a task is missing from the set, say so in that persona's blockers. total = mean of the ten parameter scores.
