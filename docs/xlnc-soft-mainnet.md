# xlnc: four networks and limited launch

Date: 2026-09-05. Investigated SHA: `b97c454d605e750a08da7ff6baab645330175468`.
Status: proposal, no change to consensus, network configuration, or capital limits.
The owner chose Ethereum, TRON, Base, and experimental XLNC; H1–H3 and MM are ours first.
Initial capital: $1 000 total. Name: **"limited mainnet / soft mainnet."**
This is a designation of risk scale, not proof of readiness or security.

## Decision

- XLNC must fulfill the role of J: Entity registration/authority, reserves, collateral, settlement, disputes, and the needed evidence.
- Payments, routing, credit, and swaps remain in R/E/A. Do not record every payment on the global chain.
- Full local verification of XLNC is a useful goal. It does not mean full local verification of Ethereum, TRON, and Base.
- Reuse a mature consensus mechanism and contract execution; do not create new consensus mechanics now.
- A genuine "XLN-only" is a block-validation rule enforced by all nodes. RPC restriction or the honesty of our validator does not provide this.

## What already exists

| Boundary     | Observation in code                                                                                                  | Consequence                                                                                   |
| ----------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------- |
| J → Entity  | [Canonical architecture](core/rjea-architecture.md), [J machine](runtime/jurisdiction.md)                        | External RPC does not become the reducer's authority; observations go through canonical validation     |
| Adapter     | [JAdapter](../core/jurisdiction/adapter/types.ts): `rpc`, `tron`, `anvil`, `browservm`                             | XLNC does not require a new Account/Entity financial path                                      |
| Finality | [rpc-finality.ts](../core/jurisdiction/adapter/rpc/rpc-finality.ts): Ethereum 12 blocks, other EVM 2 by default | These numbers do not prove consensus finality; Base/XLNC must not be connected with an implicit default   |
| Dev networks    | [chain-ids.ts](../core/jurisdiction/adapter/chain-ids.ts): 31337/31338 enable dev behavior                      | XLNC gets its own chain ID, genesis hash, and release manifest; it is not a renamed Anvil |
| Capital     | [Current policy](../ops/capped-testnet-policy.json): `riskCapUsd: null`, enforcement absent                   | $1 000 is currently an owner decision, not a programmatically enforced limit                            |

The verified production files contain no runnable XLNC validator/fullnode. The old `Xlnomy` types with EVM-engine names do not prove a network implementation.

## Minimal path: specialization without a new financial engine

| Option                                                            | What we get                                                          | Limitation                                                             |
| ------------------------------------------------------------------ | --------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Off-the-shelf EVM client + our contracts + operator policy              | Fast experimental rig with the existing JAdapter               | The chain is technically general-purpose; it does not satisfy the strict XLN-only goal |
| Off-the-shelf consensus/execution core + XLN admission verifiable by all | The desired specialized J-network; contract semantics are preserved | Requires a proven validation hook/minimal fork and a protocol choice  |
| New native J interpreter + new consensus                       | Maximum freedom                                                  | Two new critical components; pushes mainnet and MML further away                |

Recommendation: the second option as the target specification; the first only as an explicitly labeled rig, if it speeds up verification.
The first option must not be quietly shipped under the promise of the second. Implementation of the target network starts after the validation boundary is chosen.
XLN admission needs to cover the whole execution graph: direct calls, internal calls, contract creation, upgrades, and incoming native transfers.
A single allowlist of `to`/selector is not enough if the allowed contract can create/call arbitrary code.
Allowed bytecode hashes, operations, and the upgrade path must be verified by a full node; shipping a new set is an explicit protocol change.

Besu/QBFT is a concrete candidate for the rig: existing PoA and validator-set management. For Byzantine fault tolerance, Besu requires a minimum of four validators. This is not yet the choice of the XLNC engine. [QBFT](https://docs.besu-eth.org/private-networks/how-to/configure/consensus/qbft)
For a mass desktop bundle, Besu has a significant downside: the private-networks documentation states a minimum JVM of about 4 GB depending on the environment. Measure the real budget before choosing; a small J-load does not prove a small client. [Besu requirements](https://docs.besu-eth.org/private-networks/get-started/system-requirements)

## Full node at the user

```text
UI → local xln Runtime → JAdapter → local XLNC verifier → XLNC peers
                                      ↑
                   separate node process; no validator/private-wallet keys
```

- The desktop installer offers and enables the verifier by default, with explicit disk/memory disclosure. The user can stop it; the UI shows the loss of local-verification mode.
- The validator is a separate role with a separate key. A thousand fullnodes do not turn one validator into a thousand independent producers.
- Full verification starts from the published genesis; it is acceptable to delete old intermediate states after verification. Fullnode and archive are different responsibilities. [Full verification](https://ethereum.org/developers/docs/nodes-and-clients/)
- A snapshot speeds up loading only with an explicitly specified verification of its root/history. A snapshot from us without independent verification is a trusted bootstrap, not "everything verified from genesis."
- A browser page does not install a desktop daemon by itself. BrowserVM is not a network XLNC fullnode; a browser-only client needs a separately proven verifier/connection to a local companion. Browser storage has quotas and persistence modes. [Storage Standard](https://storage.spec.whatwg.org/)

Show separately: `local verification`, `verified up to block`, `bootstrap source`, `lag`, `independent operators`.
If the node has fallen behind, do not silently switch financial authority to a remote RPC. Recovery/synchronization are available; new operations wait for the needed J readiness.

## What localhost protects

| Threat                                                | Effect of local full verification                                                                      |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| RPC returns an incorrect balance/log/state                 | The node rejects invalid history given a correct client and a trusted genesis                       |
| A single validator censors settlement/dispute | Does not solve this: a valid block may simply not contain our transaction                                         |
| A validator signs two valid histories          | Can be detected upon receiving both; a single local verification cannot pick a common order for everyone |
| The node is isolated from honest peers                      | Rules are checked, but the currency/availability of the history is not guaranteed                             |
| Malicious update, compromised host, or key     | Does not solve this; bundled monoculture increases the overall blast radius                                         |

Design minimum: loopback-only bind; OS IPC with user permissions where supported; otherwise an authenticated loopback endpoint.
Check Host/Origin and WebSocket Origin, close wildcard CORS, restrict methods and request size/rate; separate out wallet signing and the validator/admin API.
A local port is accessible to other local processes. CORS does not replace authentication. Do not keep an unlocked signing account on an accessible RPC. [Geth RPC](https://geth.ethereum.org/docs/interacting-with-geth/rpc), [Besu RPC authentication](https://docs.besu-eth.org/public-networks/how-to/use-besu-api/authenticate)
Regression goal: a foreign Origin/Host, an unauthorized WS, and an admin method are rejected; the standard UI reads the chain and only submits an already-signed transaction.

## Availability, updates, and decentralization

- A single validator is acceptable as a disclosed centralized experiment: stopping it halts J, including withdrawals/disputes. Key backup and recovery do not provide Byzantine safety; two copies of the signing identity must not be run simultaneously.
- At the start, keep several replicas of full blocks on different machines and verify recovery from them. Different machines of one firm provide availability, not independent governance.
- Next stage: independent operators and a chosen quorum, a shared genesis/rules, and a proven validator-set change and single-party failure. For QBFT, an example is 4 independent validators with tolerance 1; 4 of our own processes do not provide independence. [QBFT](https://docs.besu-eth.org/private-networks/how-to/configure/consensus/qbft)
- Signed releases with fixed hashes, reproducible builds, staged rollout, and local manifest verification reduce supply-chain risk. An independent compatible verifier will later reduce the monoculture; a second consensus implementation is not P0 right now.
- Historical blocks must be available to a new node without a single server. Optional publication of the block hash on an external network proves the existence of a commitment, but by itself does not provide data, forced inclusion, exit, or rollup security.

XLNC stores J-operations and the necessary evidence; private Account frames and every off-chain hop are not published there.
Limit validation cost, block bytes/gas, and state growth. Cheap gas requires protection against disk filling; "free for everyone without limits" is incompatible with a node at every user.
Emergency exit requires an available J and inclusion. Do not promise that a local copy automatically withdraws funds when the single validator has stopped.

## Four networks, one limited exposure

| Network              | Before admitting capital                                                                        |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| Ethereum          | Verified bytecode/address/domain, live J, withdrawal/dispute, explicit finality policy          |
| TRON              | Real TVM/write/receipt/resource paths and solidified head; Anvil is not evidence             |
| Base              | Contract artifacts and separate unsafe/safe/finalized observations; two L2 blocks are not L1-finality |
| XLNC experimental | Genesis/rules/validator manifest, full-node verification, real assets and their issuer/backing   |

Base ties the finalized L2 head to L1-finality. Financial admission requires consciously choosing a risk level, not a "ready in N seconds" timer. [Base derivation](https://docs.base.org/specifications/base-protocol/consensus/derivation)
Four networks give six pairs and twelve directions; Ethereum/Base and our H1–H3/MM are not independent sources of risk.
The first exercise is one minimal real round trip on each new boundary with a withdrawal; the full cross-J matrix remains the final gate.
Include liquidity, gas/resource balances, dispute reserve, and already-spent deployment fees in the total $1 000; the asset limit is separate from the operating-expense limit.
Do not spread capital evenly across the four networks: measure deploy/gas and the mandatory reserve, give the remainder to working liquidity. If costs don't fit — narrow the simultaneous exposure, do not covertly raise the budget.
An XLNC token named USDT does not become Tether USDT. An explicit issuer/redemption/collateral is needed; a bridge and a wrapped asset are additional risk, not a free integration.
Limits must be applied before admitting an obligation, including quotes/lease/credit and crash recovery; a single UI limit is not sufficient. Capital growth only after a measured round trip, reconciliation, and a separate owner decision.

## Next decisions and evidence

1. Pin down a strict XLN-only block-validation boundary and the existing core; do not pass off RPC policy as a consensus rule.
2. Approve the experimental single-validator trust model and a user-available exit on stoppage; if exit is not possible, label it as such explicitly.
3. First XLNC artifact: genesis → 1 producer + 1 verifier → canonical deployment → reserve → Account collateral → payment → settlement → withdrawal → restart → identical roots/logs.
4. Before money: producer failure, a corrupted block, incompatible rules, an invalid snapshot, missing data, and an unavailable RPC produce an explainable halt. No automatic genesis reset.
5. Then four real J-boundaries, a full check, and a limited capital admission; XLNC R&D does not delay resolving the current production recovery divergence.

Measure MML by unique completed economic value over a trailing 12 months: one payment once, one exchange without summing both legs, without our own circular relays and tests.
Share of world GDP is a long-term ambition, not a current success metric: payment turnover and GDP value-added differ methodologically.
The nearest useful numbers: successful withdrawals, losses/discrepancies, cost of a completed operation, capital tied up, recovery time, and the share of clients that actually verify locally.
