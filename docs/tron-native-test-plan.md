# Native Tron execution and parity

2026-09-05. Solidity source baseline: `b97c454d605e750a08da7ff6baab645330175468`.
Durable evidence: [`evidence/tron-native-20260905/manifest.json`](evidence/tron-native-20260905/manifest.json).
Prepared native database, scripts and full logs: `/tmp/xln-tron-native-20260905`. Working-tree work, not a release claim.

## Executed boundary

**Stock java-tron 4.8.2.1, native ARM64 Java 17, actual TVM, private genesis.** Docker and TRE were unnecessary. The existing xln JAdapter and deployment graph are reused; no Anvil emulation, Solidity fork, debug execution mode or funded public transaction was used.

| Actual artifact                               | Evidence                                                                                                          |
| --------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| ERC20Mock deployed, solidified block 9        | `deploy-probe.json`; 440,320 Energy; decimals 6; supply 1,000,000,000,000 base units                              |
| Six linked libraries deployed                 | Solidified block 22; `prepared-transactions.json` and `graph-resume.log`                                          |
| EntityProvider deployed                       | Solidified block 25; tx `f8884178ffab0c191f8c798f8d424f6f191eee28305e471d6cdfad0085120b1b`                        |
| Depository deployed                           | Solidified block 28; tx `543ecff6d3aea5522a26d33ee6cbcd126478b4e9717325c7ebd23ce9ccd8a16b`                        |
| Native SolidityNode read through core adapter | `hanko-diagnose.log`: head 36, solid 35, core safe block 35                                                       |
| Foundation action domain and signer           | `hanko-diagnosis.json`: client hash equals contract hash; canonical Hanko verifies Foundation 1                   |
| Native token listing and reserve round trip   | `deployed-graph.json`, `economic.json`: reserve 0 → 1,000,000 → 0; external balance exactly restored; nonce 1 → 2 |

The local token is the repository's existing ERC20Mock. The deployment graph stores it in its existing `USDT` slot, but **it is not real USDT**. Eight successful production-contract deployments prove these exact constructors execute on this configured TVM. They do not prove every contract operation, cross-J parity, public consensus, mainnet readiness or TPS.

## First failures and canonical fixes

1. **Private Tron identity selected EVM finality.** Existing code used a public chain-ID list to choose receipt/finality behavior. Explicit `mode: 'tron'` now selects native semantics consistently in the adapter and watcher. Chain identity remains independently checked. Twelve focused finality vectors cover this boundary.
2. **Separate SolidityNode HTTP port.** Stock native APIs use full-node port 19090 and SolidityNode port 19091 in this fixture. `tronSolidityHost` now reaches the native signer and solidified-head reader. No proxy or fabricated head is required.
3. **Deep Solidity ABI rejected before TVM.** Native JSON broadcast rejected nesting depth 21 over its limit 20. `tron-broadcast.ts` now serializes the exact signed Protobuf transaction and uses native `broadcasthex`. It checks raw payload, transaction hash and signatures before conversion; there is one broadcast path and no JSON fallback. The unchanged bytecode then deployed successfully.
4. **Stale deployment Hanko envelope.** `foundation-hanko.cjs` copied the retired three-field ABI and omitted `memberSignatures`. Native `computeFoundationActionHash` matched the client exactly; the old envelope reverted, while the current four-field core envelope verified. The deployment helper now calls canonical `buildSingleSignerHanko`; the duplicate encoder was deleted. The smallest regression failed before the fix and passed after it.

5. **Pending JSON-RPC quantities are empty hex.** A genuine approval broadcast exposed `blockNumber`, `transactionIndex` and `gasPrice` as `"0x"` before inclusion. Ethers correctly rejected it. The signer now first observes a native inclusion receipt, checks transaction identity/height, then returns the genuine mined ethers response at the same height. It never replaces those fields with invented zeros or swallows formatter errors. The regression failed before this fix and passed after it.

The failed old token-listing transaction is `63b4df1d957f38d095b2cb37708be18fde07f6bd6f49a58beb20f5030b446077`, block 34. The corrected listing succeeded. The canonical adapter then deposited 1,000,000 test-token base units in block 42 and withdrew them with a signed batch in block 43. External balance returned exactly to 1,000,000,000,000; reserve returned to zero; nonce advanced from 1 to 2. The solidified complete-receipt reader returned three authentic logs. `economic-inclusion.log` finished with exit 0 under the 60-second stand budget.

## Exact runtime and compiler

| Component               | Pin                                                                                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| java-tron               | [GreatVoyage-v4.8.2.1](https://github.com/tronprotocol/java-tron/releases/tag/GreatVoyage-v4.8.2.1), source `f8b05d40abc949fa588ab64d8fd8fd82845ebeed` |
| ARM JAR SHA-256         | `63f8a5fffe023f20a6b8dc44ef72513e50cb323e130b6235025aa3e6b87e2b4d`                                                                                     |
| Temurin                 | 17.0.20.1+1, ARM64; archive SHA-256 `196d13ba5f10414bef7f6a05a9b3f00edacb18ebacef2b99485db9e2ee18f0e8`                                                 |
| Compiler                | Upstream solc 0.8.25; optimizer runs 1; via-IR; Cancun                                                                                                 |
| Compiled graph          | Account, DepositoryBounds, HashLadderRegistry, NftCustody, DeltaTransformer, HankoVerifier, EntityProvider, Depository, ERC20Mock                      |
| Artifact hashes         | `frozen-artifacts/manifest.json`; exact JSON artifacts retained alongside it                                                                           |
| Native private chain ID | `0x48086ccf`, read from the node and checked against the on-chain action hash                                                                          |

The JAR hash was checked against the official release asset digest. Its detached GPG signature was not verified locally. No claim of local GPG verification is made.

The canonical compiler now accepts `--contracts=...` as standard-json output selection. It emits and validates all nine requested artifacts in **49.820 seconds**. Full `--all` exceeded 60 seconds and remains an unpassed broader gate. Output selection preserves source and semantic assertions; it does not establish coverage for uncompiled contracts.

```sh
cd jurisdictions
bun scripts/compile-tron.cjs --contracts=Account,DepositoryBounds,HashLadderRegistry,NftCustody,DeltaTransformer,HankoVerifier,EntityProvider,Depository,ERC20Mock
```

The current sources required no compiler replacement for the observed native graph. Any future compiler or Solidity change still requires synchronized artifacts/typechain and explicit bytecode/hash review.

## Private-chain fidelity

The node uses the stock release JAR, source-pinned configuration, RocksDB synchronous writes, a public disposable development witness and a separate database. P2P is disabled; one SR produces blocks. HTTP services in this stock JAR bind wildcard addresses, so this fixture is not a loopback-isolated production deployment. Never use production keys or expose the fixture on an untrusted host.

Mainnet parameters were read from the public native API into `mainnet-parameters.json`. Thirteen differences were changed through thirteen real proposals and approvals; receipts are retained in `calibration-vm.json`. This includes execution limit 80 ms, max fee 15 billion SUN, current Energy capacity, bandwidth price, free bandwidth, selfdestruct restriction and Prague/Osaka gates. Existing mainnet-disabled compatibility/resource gates remain disabled.

The temporary bootstrap maintenance/proposal periods were subsequently restored through governance to 6 hours / 3 days. `probe.json` records the resulting native parameters. The private genesis retains its own witness power and ledger; the derived resource totals and consensus population differ from mainnet. Fresh block timestamps are required on restart before commands are sent, preventing expired governance transactions built against a stale head.

Official private-network guidance uses an SR plus a regular validating Fullnode; this first artifact has only the SR. A second node and synchronization are remaining staging evidence. [TRON private-network guide](https://developers.tron.network/docs/tron-private-chain).

Correction to the earlier research draft: this release's JSON-RPC endpoint really is **`/jsonrpc`**, verified in the source and by actual requests. Its three exact fixture endpoints are:

- `http://127.0.0.1:18545/jsonrpc` — Ethereum-compatible reads;
- `http://127.0.0.1:19090` — native full-node API;
- `http://127.0.0.1:19091` — native solidified API.

## Reuse without a false success

Prepared graph transactions are explicit input. Before reusing a deployment, the canonical deployer rebuilds the current creation transaction with the original TAPOS fields and requires byte-for-byte raw payload and transaction-ID equality. It then requires a solidified SUCCESS receipt, deployment height and runtime code, recording the runtime code hash. Existing EntityProvider binding must exactly match the intended Depository. An absent, changed or failed transaction is rejected loudly.

This avoids repeatedly paying/redeploying an already verified prefix after a bounded observation window. It does not blindly trust an old JSON manifest or introduce a second contract-deployment implementation. Constructor/library substitutions remain part of the exact signed payload check.

The current fixture scripts and native database live in the evidence directory. They are a prepared local stand, not yet a portable fresh-machine setup command. Every run owns and terminates its Java child under the shared stand lock:

```sh
bun run stand:status
bun run stand:run --reason tron-native-economic --wait-ms 60000 --timeout-ms 60000 -- bun /tmp/xln-tron-native-20260905/boot.ts --economic
```

Do not rerun graph registration after a successful listing without verifying its current registry/nonce. The separate `--economic` phase reuses the saved, verified graph.

## Native numbered-entity governance and interrupted activation

The current candidate (`0d979aa026ec1c0911631505c9d62cd5ad069f44` plus shared changes) completed
a direct TVM governance scenario on **the same funded Entity 2**. Foundation-authorized registration
in block **49** minted **100,000,000,000 CONTROL and 100,000,000,000 DIVIDEND** into its treasury.
The canonical adapter deposit in block **50** changed reserve **0 → 1,000,000** and entity nonce
**0 → 1**. The existing board committed and proposed its replacement in blocks **51/52**.

The first activation was mined in block **54**, but the fixture stopped before native solidification:
ethers rejected the native block's `stateRoot="0x"` while formatting a full Ethereum block. On restart,
java-tron recovered head **53** and mined an empty replacement block **54** with a different hash.
This was a real rollback of an unsolid tail, not a stale read of the board: the native signer uses
`wallet/triggerconstantcontract` on the full node. The [original failure](evidence/tron-native-20260905/governance-r1-first-red.log),
[failed read-only resume](evidence/tron-native-20260905/governance-r1-resume-first-red.log), and
[native restart lines](evidence/tron-native-20260905/governance-unsolid-rollback.json) remain intact.

Recovery checked the replaced block hash and absent original transaction receipt, the same funded
Entity 2, its saved private fixture key, pending board, proposal nonce **1**, and board epoch **0**.
It only reactivated that existing proposal. Exact-height timestamps are read from raw RPC using the
canonical `parseBlockTimestamp`; no Ethereum state root or authority proof is fabricated. The key
was created with exclusive access, mode `0600`, and file/directory fsync before funding; keys were
not copied into repository evidence.

| Native action | Block | UTC timestamp | Verified result |
| --- | ---: | --- | --- |
| Reactivate existing proposal | 55 | 2026-09-05 04:51:21 | New board active; native solidity awaited |
| Old-board withdrawal | 58 | 2026-09-05 04:51:30 | Mined `REVERT`, exact `E4()` data `de8c50c8`; reserve/nonce/external balance unchanged |
| New-board withdrawal | 59 | 2026-09-05 04:51:33 | Reserve **0**, nonce **2**, original external balance restored; native solidity awaited |

The old board remained valid for historical Hanko evidence and failed current-authority verification;
the new board passed current-authority verification. Both withdrawal attempts used the identical
financial batch, hash and nonce. Final reserve was **0 → 1,000,000 → 0**, nonce
**0 → 1 → 1 → 2**, and external token balance **1,000,000,000,000 → 999,999,000,000 →
1,000,000,000,000**. The solid receipt range **49–59** contained **14 watched logs**.
The completed waits establish native safe-height lower bounds **55** and **59**. Their exact
returned solid heights/hashes were not logged; receipt block hashes are retained separately.

The coordinated recovery exited **0** under the **60-second stand lock**; native boot took
**11.513 s**, the economic resume **20.761 s**, and Java cleanup completed before the stand was
released. These are functional-run timings, not TPS. [Summary](evidence/tron-native-20260905/governance-summary.json),
[complete economic evidence](evidence/tron-native-20260905/governance-economic.json), and
[recovery log](evidence/tron-native-20260905/governance-recovery.log) are recorded in the manifest.
The structured evidence explicitly removes failure metadata accidentally copied from the original
manifest into successful reactivation coordinates; financial values and the raw execution log are unchanged.
The `--resume-governance-r1` command is a completed, state-bound recovery; it must fail if repeated
against the paid-out state. No new registration or deposit was used to conceal the interrupted run.

This proves direct native Solidity execution and the tested board-authority boundary. It does not
resolve `J_AUTHORITY_RECEIPT_MPT_PROOF_MISSING`, complete the remaining native contract scenarios,
or establish Runtime authority ingestion, cross-J replay, or mainnet readiness.

## Parity and remaining gates

- Native reserve deposit and signed withdrawal are green with exact conservation, nonce, events and solidified complete receipts. Production Runtime import now reaches the authority-proof failure below. Resolve that explicit trust choice before replacing one Anvil leg in the full-fill cross-J scenario; follow with close/partial-fill and recovery.
- EVM/TVM semantic comparison checks amounts, authorization, lifecycle and decoded ordered events. Chain IDs, addresses, transaction hashes and domain signatures should differ between distinct chains.
- TS/Rust replay must consume the same real native-observation checkpoint/WAL and compare every R/E/A root and ordered event/effect/outbox digest. Native constructor success is not this replay.
- Remaining adversarial gates: expired TAPOS, general interrupted/ambiguous broadcast reconciliation, fee ceiling, OUT_OF_ENERGY/OUT_OF_TIME, watcher restart and duplicate-delivery rejection. Numbered-entity registration and the concrete unsolid board-activation recovery above are proven; they do not cover every interruption point.
- Complete receipts plus block fencing detect inconsistent responses. A consistent malicious remote provider still requires a validating-node trust boundary; a zero Tron receipts root must never be relabeled an Ethereum proof. Finish second-node synchronization, public Nile staging, current bytecode review and root's full `bun run check` before release claims.

Focused working-tree validation: **30 tests pass, 121 assertions, 759 ms** across finality, signer, native hex encoding and deploy wiring/Hanko. Runtime TS7 typecheck and canonical browser bundle are green. A separate read-only reviewer found no blocker in exact prepared deployment, protobuf conversion and canonical Foundation encoding (3 tests, 9 assertions, 736 ms). Root's full check remains a final gate. Real SDK offline vectors are signing/transport evidence; only the native receipts above prove TVM execution.

## Production native import: first authority boundary

Candidate base SHA: `436835aaf476dfb07a5f8749fe4f3056348aba22`, with the shared working-tree changes.
The next actual production path reached `importJ → native adapter → solidified watcher` and stopped at
`FoundationBootstrapped`, block **25**, log **3**, transaction
`0xf8884178ffab0c191f8c798f8d424f6f191eee28305e471d6cdfad0085120b1b`:

```text
J_EVENT_LOG_DECODE_FAILED:block=25 tx=0xf8884178ffab0c191f8c798f8d424f6f191eee28305e471d6cdfad0085120b1b index=3:
J_AUTHORITY_RECEIPT_MPT_PROOF_MISSING:FoundationBootstrapped:25:3
```

Named evidence: [`runtime-import-boundary.json`](evidence/tron-native-20260905/runtime-import-boundary.json),
[`runtime-import-first-red.log`](evidence/tron-native-20260905/runtime-import-first-red.log).
The watcher retained cursor **24** and exited fatally. No Foundation event was skipped, no receipt
proof was fabricated, and no native authority was admitted under an EVM proof label.

The preceding native economic repetition passed: reserve **0 → 1,000,000 → 0**, external balance
**1,000,000,000,000 → 1,000,000,000,000**, nonce **3 → 4**, deposit/withdraw blocks **46/47**.
Its [separate evidence](evidence/tron-native-20260905/runtime-import-economic.json) proves native
execution through the adapter; it does not prove successful Runtime authority ingestion.

The configured native graph also passed the canonical production stack verifier in **86 ms**
(`deployed=no`). It retained distinct native contract addresses, explicit `mode: 'tron'`, full/solidified
endpoints, and a 3,000 ms block estimate. No native `anvil_reset`, invented chain ID or EVM redeployment
was used. [Provisioning evidence](evidence/tron-native-20260905/native-provision.log).
The selected nine-contract compile took **48.941 s**. All **9/9** creation/runtime bytecode templates
and **9/9** ABIs equal the existing deployed graph; only artifact hex formatting and immutable-reference
metadata changed. [Exact template hashes](evidence/tron-native-20260905/bytecode-metadata-review.json).

### What the pinned native chain actually commits

This conclusion uses official java-tron source pinned to `f8b05d40abc949fa588ab64d8fd8fd82845ebeed`:

- JSON-RPC sets `receiptsRoot` and `logsBloom` to zeros. These are unavailable compatibility fields,
  not usable Ethereum commitments. [BlockResult.java, lines 94–100](https://github.com/tronprotocol/java-tron/blob/f8b05d40abc949fa588ab64d8fd8fd82845ebeed/framework/src/main/java/org/tron/core/services/jsonrpc/types/BlockResult.java#L94-L100).
- The signed block header contains `txTrieRoot` and `accountStateRoot`, but no receipt/log root.
  `TransactionInfo` separately contains logs and returned `contractResult` bytes.
  [Tron.proto, lines 427–487](https://github.com/tronprotocol/java-tron/blob/f8b05d40abc949fa588ab64d8fd8fd82845ebeed/protocol/src/main/protos/core/Tron.proto#L427-L487).
- The transaction Merkle leaf hashes the complete serialized `Transaction`, including its `ret`
  status fields, rather than `TransactionInfo`. The tree therefore does not authenticate the returned
  bytes or emitted logs. An inclusion proof alone cannot certify an Entity board event.
  [TransactionCapsule.java, lines 540–543](https://github.com/tronprotocol/java-tron/blob/f8b05d40abc949fa588ab64d8fd8fd82845ebeed/chainbase/src/main/java/org/tron/core/capsule/TransactionCapsule.java#L540-L543),
  [BlockCapsule.java, lines 201–222](https://github.com/tronprotocol/java-tron/blob/f8b05d40abc949fa588ab64d8fd8fd82845ebeed/chainbase/src/main/java/org/tron/core/capsule/BlockCapsule.java#L201-L222).
- FullNode executes the transaction and builds `TransactionInfo` from that execution. The emitted
  logs come from `ProgramResult`; the status check compares the transaction's `contractRet` to the
  execution result code. Log bytes are obtained by execution, not authenticated by that status field.
  [Manager.java, lines 1458–1492](https://github.com/tronprotocol/java-tron/blob/f8b05d40abc949fa588ab64d8fd8fd82845ebeed/framework/src/main/java/org/tron/core/db/Manager.java#L1458-L1492),
  [TransactionUtil.java, lines 102–115](https://github.com/tronprotocol/java-tron/blob/f8b05d40abc949fa588ab64d8fd8fd82845ebeed/chainbase/src/main/java/org/tron/core/capsule/utils/TransactionUtil.java#L102-L115),
  [TransactionTrace.java, lines 313–325](https://github.com/tronprotocol/java-tron/blob/f8b05d40abc949fa588ab64d8fd8fd82845ebeed/chainbase/src/main/java/org/tron/core/db/TransactionTrace.java#L313-L325).

At the preserved September 5 first-red, `receipt/reader.ts` returned native complete-receipt logs
without an MPT proof while `registration-evidence/index.ts` required that proof, a nonzero root,
and Ethereum RLP/MPT verification.
The existing Runtime witness signature authenticates the observation's author; it does not turn
the observation into an independently verifiable native execution proof. Two agreeing APIs from one
malicious node can still invent the same board event.

### Bounded check: can committed calldata replace the missing receipt?

For **this exact Foundation constructor only**, the event payload is a deterministic consequence of
the authenticated canonical creation bytecode, its `foundationRecipient` argument and committed
successful execution. `EntityProvider.sol:183–218` unconditionally computes the single-signer board,
uses entity 1 and its fixed token IDs, and emits `FoundationBootstrapped`. This is a viable subject for
a narrowly specified native **creation-semantic certificate**, not an existing receipt proof.

It does not recover the present evidence envelope unchanged. A block-global `logIndex` also depends
on earlier transactions' log counts; ERC1155 mint acceptance callbacks can emit additional logs where
the treasury contains code. Neither count is in transaction inclusion evidence. The current adapter
also lacks native header/finality and transaction-Merkle proof verification. A synthetic receipt, root,
or inferred log position would still be false evidence.

More importantly, calldata plus `SUCCESS` is insufficient for the subsequent authority lifecycle:

- `EntityProvider.sol:696–723`: `_registerEntity` assigns `nextNumber++` from storage. Identical
  registration calldata in two valid prior states can produce different `entityId` values. Direct
  calls alone cannot reconstruct the counter because other contracts can invoke registration.
- `EntityProvider.sol:522–544`: `activateBoard(entityId)` reads current and proposed board hashes
  from storage. Two valid histories proposing different boards produce the same activation calldata
  and successful status with different `BoardActivated` payloads.

Therefore the general replacement needs authenticated prior state or native execution, not just
Merkle inclusion and a status bit. No Foundation-only inference path was added: it would introduce
a new authority proof kind while leaving the next numbered-entity/board boundary unresolved.

### Native RPC evidence — owner decision and TS production evidence 2026-09-06

The owner explicitly permits any configured native RPC, owned or external, optionally
with a quorum. A managed local FullNode or portable execution proof is therefore not
an admission prerequisite. The implementation must name this native RPC attestation,
bind chain/stack/block/transaction/log identity and solid finality, and preserve EVM MPT
verification. Agreement among providers is evidence of their agreement, not a proof of
independent execution. A quorum threshold, if configured, must be explicit; an item
number in the owner's answer must not be interpreted as a required threshold of two.

The alternatives below record the earlier proposal and explain its trust distinction;
they are not a current request for owner confirmation.

**Recommended bounded next step: locally validated TVM execution.** The operator explicitly binds
native authority ingestion to its managed, fully validating java-tron node and chain genesis. The node
validates and executes the chain; Runtime observes solidified results from that bound local source.
A distinct native evidence variant must state that trust basis, retain exact block/transaction/log
identity and the Runtime witness signature, and reject arbitrary remote-provider substitution.
`localhost` or an endpoint setting alone cannot prove that the process validates the chain.
Other participants need their own validating execution to independently establish the same result;
a Runtime signature alone proves only who vouched for it.

**Alternative: keep native financial import closed until an independently verifiable execution
proof exists.** A transaction Merkle branch is insufficient. Re-execution or a separately designed
execution-proof system must establish the log outcome from validated prior state and block inputs.
The current stock native API supplies no such portable log proof.

This changes the evidence schema/trust contract, as authorized above. The implementation
must retain EVM MPT verification unchanged.
The native implementation rejects altered signed board/log data, an unconfigured endpoint,
wrong chain/stack, and a range beyond the native solidified head. A consistently dishonest
configured RPC can still attest a false event; this is the explicitly accepted trust boundary.
Native watcher → Entity → batch → receipt and TS/Rust crash replay remain additional gates.

Follow-up configuration validation: **49/49 tests, 88 assertions, 389 ms**; focused real EVM
provisioning **7/7 tests, 46 assertions, 2.41 s**. Runtime TS7 and canonical browser bundle pass;
the dependency scan reports **1,054 files, zero forbidden imports, maximum SCC 1**. These unit tests
exercise the Node async decoder. Root's actual **R10** browser regression then passed against the
canonical 8080 EVM stack: startup **17.970 s**, browser **10.956 s**, **1 test passed** with no
activity-gap, authentication or page errors. Evidence: `/tmp/xln-react-capacity-1788573224783/browser.log`
and `/tmp/xln-react-capacity-run-r10.log`. This proves existing EVM browser compatibility after the
async config change, not browser native financial readiness. Full `bun run check`, native
financial cross-J and TS/Rust parity remain separate release gates.


### Current TS native authority result — R3 WAL and R5 restart

The original `J_AUTHORITY_RECEIPT_MPT_PROOF_MISSING:FoundationBootstrapped:25:3`
is closed on the real java-tron fixture. No contract, receipt root or log position was invented.
The same existing fixture was observed without funding, registering another Entity or replaying
its governance mutations. [Evidence manifest](evidence/tron-native-authority-20260906/manifest.json).

- The Runtime committed `importJ`, `completeImportJ` and two `recordAuthenticatedJAuthority`
  inputs in WAL heights 1–3: Foundation at native block 25 and Entity 2 registration at block 49,
  both observed through solidified block 60. The explicit policy `tron-rpc-attested` belongs
  to the committed J snapshot/root and survives recovery.
- R5 restored that same WAL at height 3, selected the native adapter and started its watcher
  through the existing host lifecycle. The fresh poll committed two new observations at height 4,
  both through native solidified block 68. Claim hashes remained equal; observation signatures
  and hashes changed. Idempotent application retained both original evidence hashes exactly.
  The full log contains zero watcher errors/fatal exits; native boot took **10.268 s**.
  [Accepted poll](evidence/tron-native-authority-20260906/restored-accepted-poll.json).
- The configured endpoint hash is signed observation metadata and is checked against the
  committed RPC list. It is excluded from event claim identity: two configured RPCs reporting
  the same event are idempotent; an unconfigured RPC still rejects before duplicate handling.
  Native policy requires native evidence, and an EVM policy cannot downgrade to RPC attestation.
- Focused regressions: **6/6 tests, 26 assertions, 856 ms**; runtime TS7 passes.
  Against immutable source `744817492d41a9ef854d24459e98d90bd259fc0f`, EVM Foundation evidence
  (**1,859 bytes**), Entity evidence (**1,755 bytes**) and the J snapshot (**273 bytes**) match
  exactly, including witness/evidence/claim hashes and validation in both implementations.
  [EVM byte comparison](evidence/tron-native-authority-20260906/evm-byte-comparison.json).

The observer Runtime has no Entity replicas, so its durable Entity-certified J cursor remains
24; that field is not the watcher scan cursor. Accepted WAL authority observations establish
what was actually read. Three intermediate private-driver failures are preserved under `/tmp`:
R2 used an obsolete economic report path, R3 incorrectly required the observer's Entity-certified
cursor to reach payout height, and R4 asserted watcher startup before the Node host lifecycle
was started. R1 instead exposed a real endpoint-normalization mismatch, now fixed for native RPCs.

This evidence proves TS native import, authority persistence, restored watcher operation and
idempotency. It does not prove a native Entity financial transition, full cross-J, public Tron
consensus, or Rust native authority. The September 5 missing-proof and unsolid rollback evidence
remain immutable; the RPC policy explicitly changes the former admission contract.
