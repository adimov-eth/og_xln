# Phase 7 Post-Mortem Transcripts

Total post-mortems recorded: 2 / 10 episodes.

## E1c_pay_l1_reject_reload — scripted-smoke (passed=true, phantoms=1)
```text
You were given this task: "Pay CornerCoffee $50.00. If something goes wrong while moving your funds, reload and check your Cash again to verify whether your money is safe."
Note: you finished the task, but hit tool/surface errors along the way.
Here is what you tried:
Turn 1: act(intent="attempt $50 payment", args={"intent":"attempt $50 payment","action":"pay","args":{"to":"CornerCoffee","amount_usd":50}}) -> ERROR (runtime): Auto-route L1 sweep rejected — your Cash was not touched.
Turn 2: act(intent="reload wallet after error", args={"intent":"reload wallet after error","action":"reload-wallet","args":{}}) -> OK: {"status":"Reloaded","cash-usd":120,"arriving-usd":0}
Turn 3: discover(intent="verify Cash balance after reload", args={"intent":"verify Cash balance after reload","expr":"(cash)"}) -> OK: {"cash-usd":120,"cash-formatted":"$120.00","note":"Your money, ready to spend or cash out anytime."}
Turn 4: done(intent="report safe balance after reload", args={"intent":"report safe balance after reload","summary":"Sweep failed and Cash remained $120.00 after reload."}) -> OK: {"done":true,"summary":"Sweep failed and Cash remained $120.00 after reload."}
Here is what would have worked:
act("pay", { to: "CornerCoffee", amount_usd: 50 }), then act("reload-wallet"), discover("(cash)"), then done().
What made it hard to find the working approach? Be concrete about naming, missing cues, or misleading labels.
```
**Model feedback:**
1. Yes, exported encrypted backup.
2. 0 ETH network gas.
3. Cannot start a fresh user-initiated withdrawal with 0 gas; watchtower still guards stale claims.

## E3a_newcomer_arriving_and_request — scripted-smoke (passed=false, phantoms=1)
```text
You were given this task: "You just installed the wallet. Check how much Cash you can spend right now, wait for any incoming payment to finish settling, and then create a $25.00 payment request link for Maya."
Note: task verification failed (comprehension={"q1ZeroInitially":true,"q2Settled":true,"q3Link":true}).
Here is what you tried:
Turn 1: discover(intent="check current spendable Cash", args={"intent":"check current spendable Cash","expr":"(cash)"}) -> OK: {"cash-usd":0,"cash-formatted":"$0.00","note":"Your money, ready to spend or cash out anytime.","incoming-status":"Payment still finishing — we will keep retrying automatically."}
Turn 2: act(intent="wait for incoming settlement", args={"intent":"wait for incoming settlement","action":"wait-settlement","args":{}}) -> OK: {"status":"Settled into Cash","cash-usd":49.95,"arriving-usd":0,"fee-usd":0.05}
Turn 3: act(intent="create $25 request link for Maya", args={"intent":"create $25 request link for Maya","action":"request-link","args":{"amount_usd":25,"to":"Maya"}}) -> ERROR (unknown_action): Unknown action 'request-link'. Available actions: pay, cash-out, split-bill, settle-up, add-savings, move-to-cash, approve-request, reject-request, export-backup, wait-settlement, reload-wallet, clear-test-data
Turn 4: done(intent="finish newcomer arriving flow", args={"intent":"finish newcomer arriving flow","summary":"Started at $0 Cash, settled to $49.95, attempted request link."}) -> OK: {"done":true,"summary":"Started at $0 Cash, settled to $49.95, attempted request link."}
Here is what would have worked:
discover("(cash)"), act("wait-settlement"), act("request-link", { amount_usd: 25, to: "Maya" }), then done().
What made it hard to find the working approach? Be concrete about naming, missing cues, or misleading labels.
```
**Model feedback:**
1. Yes, exported encrypted backup.
2. 0 ETH network gas.
3. Cannot start a fresh user-initiated withdrawal with 0 gas; watchtower still guards stale claims.

