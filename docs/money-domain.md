# Removing arbitrary monetary ceilings

Status: owner approved implementation on 2026-09-06: "yes, remove all the limits in Solidity" (owner quote, translated from Russian).
This authorizes coherent arithmetic/ABI changes to remove arbitrary monetary ceilings;
it does not authorize deleting existing funds, signed states or history.

The owner has already authorized removal of arbitrary transfer and credit ceilings.
The implementation must cover the transformer ABI and migration of signed states.

## Evidence

`Account.prepareSettlementDeltas` adds `ondelta + offdelta` before calling every
signed transformer. The previous transformer accepted and returned `int256[]`;
`MAX_MONEY = 2^200` kept those intermediate calculations representable. The new
Solidity source removes that constant; synchronized runtime deployment is pending.

Concrete counterexample to deleting only the constant: sign `offdelta = 2^255−1`
with `ondelta = 0`, then deposit one unit to the left side. The old signed proof now
requires an absolute transformer input of `2^255`, outside `int256`. Checking only
the state when signing cannot cover this later jurisdiction event.

Moving `ondelta` after transformer execution changes the meaning of arbitrary signed
clauses that inspect their absolute input. A replacement `2^254` ceiling would still
be an arbitrary ceiling and also fails at the inclusive positive endpoint.

## Canonical arithmetic candidate

- Individual signed movements use `SignedAmount { negative:bool, magnitude:uint256 }`.
  Negative zero is rejected. Stored `ondelta` and proof `offdeltas` use two's-complement
  `Int512 { high:int256, low:uint256 }`, representing `high × 2^256 + low`.
  Absolute transformer inputs/outputs, settlement sums and allowance bands use
  `Int768 { high:int256, middle:uint256, low:uint256 }`. A full-width signed proof
  remains executable after subsequent collateral changes; intermediate width is
  larger than proof width. Arbitrary transformer outputs are clamped before narrowing.
- Keep ERC20 amounts, reserves and collateral in their actual `uint256` domain.
  Preserve signature, nonce, ownership, solvency and independent HTLC-outcome checks.
  Removing a policy ceiling never authorizes wrapping, truncation or saturation.
- A debt entry uses unsigned two-word `Uint512`; its aggregate uses `Uint768`.
  `Account` rejects duplicate token diffs in a settlement. Every collateral decrease
  consumes a strictly newer nonce or resets both collateral and allocation on dispute
  completion. With fewer than `2^53` nonce changes, reachable allocation magnitude is
  below `2^310`. Signed proof magnitude plus allocation plus the existing maximum
  32 full-width allowance movements is below `2^512`. A uint256-length debt queue
  therefore fits the three-word aggregate. These are representation proofs, not
  additional transfer policy limits.
- Deploy one canonical ABI atomically, regenerate artifacts/typechain and compare
  EVM/TVM bytecode. Existing arbitrary transformer addresses cannot be silently reused
  with a new selector. Existing accounts require explicit settlement/migration and
  fresh signed proofs; a new Depository also changes the Hanko signing domain.

The owner approved this ABI migration direction. Exact storage and arithmetic changes
still require a reviewed diff and production-equivalent evidence before deployment.
Keeping the old ABI would require restricting previously representable combinations
or signed-clause semantics; it does not fulfill unrestricted cap removal.

## Required evidence for implementation

Use the existing `SettlementDeltasHarness` and named vectors for: signed proof then
left R2C across `INT_MAX`; `abs(INT_MIN)`; independent opposite HTLC outcomes;
sequential allowance bands; exact swap ratio rounding without multiplication overflow;
aggregate debt across the word boundary; cooperative and dispute settlement equivalence.

Then synchronize TS/Rust admission and settlement mirrors, replay exact signed states,
execute native TVM scenarios, review artifact hashes and run the repository checks.
The Solidity public tuples are frozen for TS/Rust integration. Existing contracts,
their addresses and signed histories still use their original ABI. Before switching
the canonical runtime, settle the old deployed graph through its original signed
path; withdraw/redeposit into the new deployment and create fresh signed proofs.
Outstanding old-domain debt requires repayment or explicit bilateral forgiveness;
withdrawal alone cannot retire it. Until resolved, preserve its original deployment,
history and recovery tooling pinned to the old artifact. Never reinterpret an old Hanko, silently mutate its WAL,
or label a replay against the old deployment as validation of the new ABI.

Sources: [Account arithmetic](../jurisdictions/contracts/Account.sol),
[transformer ABI](../jurisdictions/contracts/DeltaTransformer.sol),
[numeric constants](../jurisdictions/contracts/Types.sol),
[existing harness](../jurisdictions/test/foundry/helpers/SettlementDeltasHarness.sol),
[signed clause semantics](counterfactual-transformers.md).
