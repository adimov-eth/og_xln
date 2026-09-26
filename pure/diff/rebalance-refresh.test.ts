// Behavioural diff: og hub rebalance (core/entity/scheduler/rebalance.ts behind the crontab hubRebalance task), og board Hanko refresh
// (entity/tx/state-effects/board-rotation-hanko-refresh.ts, scheduler/board-hanko-refresh-hook.ts, tx/j-events-board.ts) and og's
// lending_overdue deadline (scheduler/derived-deadlines.ts, tx/handlers/account/committed-lending-close.ts) vs pure/xln.ts.
// "MATCH:" tests run og live on the same inputs and assert the same accept / reject, outputs and state.
import { describe, expect, test } from "bun:test";
import {
  accountId, createEntity, crontabTaskHasPendingWork, executeCrontab, genesisReplica, initCrontab, rebalanceAccountIds, tokenId, withCrontab, crontabOf, ZERO_WORD,
  type AccountReplica, type Binary, type Crontab, type EntityError, type EntityId, type EntityState, type SettlementWorkspace,
} from "../xln.ts";
import { ALICE, BOB, CAROL, TERMS, aliceAddr, bobAddr, unwrap } from "../xln_run.ts";
import { executeCrontab as ogExecuteCrontab, crontabTaskHasPendingWork as ogHasPendingWork } from "../../core/entity/scheduler/index.ts";
import { getRebalanceAccountIds } from "../../core/entity/consensus/account/work-index.ts";
import { initJBatch as ogInitJBatch } from "../../core/jurisdiction/machine/batch/index.ts";
import { PersistentAccountStateMap } from "../../core/account/state/persistent-state-map.ts";
import { EntityAccountCandidateMap, PersistentEntityAccountMap } from "../../core/entity/state/persistent-account-map.ts";
import { createBookIntentProgram } from "../../core/entity/books/book-intents.ts";

let seed = 29;
const rng = (): number => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const ri = (n: number): number => Math.floor(rng() * n);
const pick = <T>(xs: readonly T[]): T => xs[ri(xs.length)] as T;
const reasonOf = (e: EntityError): string => (e._tag === "entity_invariant" ? e.reason : e._tag);
const PA = (name: string, entries: readonly (readonly [unknown, unknown])[] = []) => (entries.length === 0 ? PersistentAccountStateMap.empty(name as never) : PersistentAccountStateMap.fromEntries(name as never, entries as never));
const JUR = TERMS.domain;
const ogConfigOf = (validators: readonly string[]): any => ({ mode: "proposer-based", threshold: 1n, validators: validators.map((v) => v.toLowerCase()), shares: Object.fromEntries(validators.map((v) => [v.toLowerCase(), 1n])) });
const U = 10n ** 6n; // tokens 1 and 3 carry 6 decimals; the default soft limit is 500 whole tokens

type Tok = { readonly tokenId: number; readonly collateral: bigint; readonly ondelta: bigint; readonly offdelta: bigint; readonly hold: bigint; readonly holdLeft: boolean;
  readonly requested: bigint; readonly fee?: { readonly feePaidUpfront: bigint; readonly policyVersion: number; readonly requestedAt: number; readonly refund: boolean } | undefined; readonly submittedAt: number };
type Acct = { readonly peer: EntityId; readonly toks: readonly Tok[]; readonly workspace?: SettlementWorkspace | undefined; readonly settlePending: boolean };

const rwAccount = (hub: EntityId, a: Acct): AccountReplica => {
  const base = unwrap(genesisReplica(unwrap(accountId(hub, a.peer)), TERMS));
  const tk = (n: number) => unwrap(tokenId(String(n)));
  const locks = new Map(a.toks.filter((t) => t.hold > 0n).map((t) => [`lock-${t.tokenId}`, { lockId: `lock-${t.tokenId}`, hashlock: `0x${"ab".repeat(32)}`, timelock: 10n ** 13n, revealBeforeHeight: 100n, amount: t.hold, tokenId: tk(t.tokenId), senderIsLeft: t.holdLeft, createdHeight: 1n, createdTimestamp: 1n }]));
  const state = {
    ...base.state,
    account: { ...base.state.account, deltas: new Map(a.toks.map((t) => [tk(t.tokenId), { tokenId: tk(t.tokenId), collateral: t.collateral, ondelta: t.ondelta, offdelta: t.offdelta, leftCreditLimit: 0n, rightCreditLimit: 0n }])) },
    locks, requested: new Map(a.toks.filter((t) => t.requested !== 0n).map((t) => [tk(t.tokenId), t.requested])),
    requestFees: new Map(a.toks.flatMap((t) => (t.fee === undefined ? [] : [[tk(t.tokenId), { requestId: `r${t.tokenId}`, feeTokenId: t.tokenId, feePaidUpfront: t.fee.feePaidUpfront, requestedAmount: t.requested, policyVersion: t.fee.policyVersion, requestedAt: t.fee.requestedAt, requestedByLeft: true, ...(t.fee.refund ? { refund: { reason: "manual", refundedAmount: 1n } } : {}) }] as const]))),
    submittedAt: new Map(a.toks.filter((t) => t.submittedAt > 0).map((t) => [t.tokenId, t.submittedAt])),
    ...(a.workspace === undefined ? {} : { settlement: a.workspace }),
  };
  return { ...base, state, mempool: a.settlePending ? [{ type: "settle_transition" } as never] : [] } as AccountReplica;
};
const ogAccount = (hub: EntityId, a: Acct): any => {
  const left = hub < a.peer ? hub : a.peer, right = hub < a.peer ? a.peer : hub;
  return {
    state: {
      leftEntity: left, rightEntity: right, domain: { ...TERMS.domain }, watchSeed: TERMS.watchSeed, disputeConfig: { ...TERMS.disputeConfig }, jNonce: 0,
      deltas: PA("deltas", a.toks.map((t) => [t.tokenId, { tokenId: t.tokenId, collateral: t.collateral, ondelta: t.ondelta, offdelta: t.offdelta, leftCreditLimit: 0n, rightCreditLimit: 0n, leftAllowance: 0n, rightAllowance: 0n,
        leftHold: t.holdLeft ? t.hold : 0n, rightHold: t.holdLeft ? 0n : t.hold }])),
      locks: PA("locks"), swapOffers: PA("swapOffers"), pulls: PA("pulls"),
      requestedRebalance: PA("requestedRebalance", a.toks.filter((t) => t.requested !== 0n).map((t) => [t.tokenId, t.requested])),
      requestedRebalanceFeeState: PA("requestedRebalanceFeeState", a.toks.flatMap((t) => (t.fee === undefined ? [] : [[t.tokenId, { requestId: `r${t.tokenId}`, feeTokenId: t.tokenId, feePaidUpfront: t.fee.feePaidUpfront, requestedAmount: t.requested, policyVersion: t.fee.policyVersion, requestedAt: t.fee.requestedAt, requestedByLeft: true, ...(t.fee.refund ? { refund: { reason: "manual", refundedAmount: 1n } } : {}) }] as const]))),
      rebalanceFeePolicies: PA("rebalanceFeePolicies"),
      ...(a.workspace === undefined ? {} : { settlementWorkspace: structuredClone(a.workspace) }),
    },
    status: "active", mempool: a.settlePending ? [{ type: "settle_transition" }] : [], currentHeight: 1, proofHeader: { fromEntity: hub, toEntity: a.peer, nextProofNonce: 1 }, pendingWithdrawals: PA("pendingWithdrawals"),
    shadow: { rebalance: { policy: PA("rebalanceShadowPolicy"), submittedAtByToken: PA("rebalanceShadowSubmitted", a.toks.filter((t) => t.submittedAt > 0).map((t) => [t.tokenId, t.submittedAt])) } },
  };
};
const amountNear = (): bigint => pick([0n, 0n, 100n * U, 499n * U, 500n * U, 501n * U, 900n * U, 2_000n * U]);
const randomTok = (tokenId: number, hubIsLeft: boolean): Tok => {
  const requested = rng() < 0.6 ? pick([0n, 1n * U, 300n * U, 900n * U, 900n * U, -5n]) : 0n;
  const fee = requested > 0n && rng() < 0.985 ? { feePaidUpfront: pick([0n, 100_000n, 50n * U, 50n * U, 50n * U]), policyVersion: pick([1, 1, 1, 1, 2]), requestedAt: pick([0, 5, 9, 12]), refund: rng() < 0.08 } : undefined;
  return { tokenId, collateral: amountNear(), ondelta: pick([0n, 1n, -1n]) * amountNear(), offdelta: pick([0n, 1n, -1n]) * amountNear(), hold: rng() < 0.2 ? pick([10n * U, 600n * U]) : 0n, holdLeft: rng() < 0.5 ? hubIsLeft : !hubIsLeft,
    requested, fee, submittedAt: rng() < 0.1 ? 77 : 0 };
};
const readyWorkspace = (hubIsLeft: boolean): SettlementWorkspace => ({
  workspaceHash: `0x${"11".repeat(32)}`, ops: [{ type: pick(["c2r", "c2r", "r2c"] as const), tokenId: 1, amount: 5n * U }], lastModifiedByLeft: rng() < 0.85 ? hubIsLeft : !hubIsLeft, executorIsLeft: rng() < 0.85 ? hubIsLeft : !hubIsLeft,
  status: pick(["ready_to_submit", "ready_to_submit", "awaiting_counterparty"] as const), revision: 1, createdAt: 1, lastUpdatedAt: 1,
  ...(rng() < 0.85 ? (hubIsLeft ? { rightHanko: "0xbeef" } : { leftHanko: "0xbeef" }) : {}),
});

describe("rebalance-refresh: hub rebalance (og scheduler/rebalance.ts hubRebalanceHandler via executeCrontab)", () => {
  test("MATCH: 400 random hubs (R→C requests by strategy / policy / fee / reserve, submitted markers, C→R withdrawals and ready workspaces, sent-batch latch and staleness, manual broadcast, pair limits) -- og's outputs, J batch, markers, task and halts", async () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 400; i++) {
      const hub = pick([ALICE, BOB, CAROL]), peers = [ALICE, BOB, CAROL].filter((p) => p !== hub) as EntityId[];
      const accts: Acct[] = peers.map((peer) => {
        const hubIsLeft = hub < peer, toks = [1, 3].filter(() => rng() < 0.8).map((t) => randomTok(t, hubIsLeft));
        return { peer, toks, ...(rng() < 0.2 ? { workspace: readyWorkspace(hubIsLeft) } : {}), settlePending: rng() < 0.05 };
      });
      const now = 1_000_000 + ri(1_000), runtimeNow = now + ri(3) * 100_000, manual = rng() < 0.15;
      const r2cRows = rng() < 0.2 ? [{ tokenId: 1, receivingEntity: hub, pairs: Array.from({ length: pick([1, 64, 256]) }, (_, n) => ({ entity: n === 0 ? peers[0] as string : `0x${(n + 9).toString(16).padStart(64, "0")}`, amount: 1n })) }] : [];
      const sent = rng() < 0.2 ? { sentBatch: { batch: ogInitJBatch().batch, batchHash: ZERO_WORD, encodedBatch: "0x", entityNonce: 2, firstSubmittedAt: 1, lastSubmittedAt: pick([0, runtimeNow - 1_000, runtimeNow - 200_000]), submitAttempts: 1 }, lastBroadcast: pick([0, runtimeNow - 500]) } : {};
      const jBatch = { ...ogInitJBatch(), ...(r2cRows.length > 0 ? { batch: { ...ogInitJBatch().batch, reserveToCollateral: r2cRows }, status: "accumulating" } : {}), ...sent };
      const config = { matchingStrategy: pick(["amount", "fee", "time", "bogus"]), policyVersion: pick([1, 1, 2, 0]), rebalanceLiquidityFeeBps: pick([0n, 1n, 100n]), disputeAutoFinalizeMode: "auto", ...(rng() < 0.03 ? { c2rWithdrawSoftLimit: 1n } : {}) };
      const reserves = new Map([[1, pick([0n, 100n * U, 5_000n * U, 5_000n * U])], [3, pick([0n, 400n * U, 5_000n * U])]]);
      const task = { method: "hubRebalance" as const, intervalMs: 1000, lastRun: now - 1000 - ri(2), enabled: true, params: {} };
      const crontab: Crontab = { ...initCrontab(), tasks: new Map([["hubRebalance", task]]) };
      const validators = [aliceAddr, bobAddr];
      const state = withCrontab(unwrap(createEntity({ id: hub, jurisdiction: JUR, threshold: 1n, members: new Map(validators.map((a) => [a as never, { shares: 1n }])), committed: { jBatchState: structuredClone(jBatch), hubRebalanceConfig: config, reserves } as never })).state, crontab);
      const replicas = new Map(accts.map((a) => [a.peer, rwAccount(hub, a)]));
      const og: any = { entityId: hub, timestamp: now, config: ogConfigOf(validators), accounts: new EntityAccountCandidateMap(PersistentEntityAccountMap.fromEntries(accts.map((a) => [a.peer, ogAccount(hub, a)]), hub, () => ZERO_WORD as never)),
        reserves: new Map(reserves), jBatchState: structuredClone(jBatch), hubRebalanceConfig: { ...config }, crontabState: { tasks: new Map([["hubRebalance", { ...task }]]), hooks: new Map() }, paybook: { entries: new Map(), feesEarned: 0n } };
      // og's ACCOUNT_WORK_REBALANCE index and crontabTaskHasPendingWork
      const rwIds = rebalanceAccountIds(state, replicas);
      expect(rwIds.ok ? [...rwIds.value] : reasonOf(rwIds.error)).toEqual([...getRebalanceAccountIds(og)].sort() as never);
      expect(crontabTaskHasPendingWork(state, replicas)).toBe(ogHasPendingWork(og, "hubRebalance"));
      const program = createBookIntentProgram();
      const ctx = { manualBroadcastInInput: manual, bookIntentSlot: program.openSlot(), hashesToSign: [], accountChanges: new Set<string>(), candidateEffects: [], accountTxs: [] };
      let ogOut: any[] | undefined, ogErr: string | undefined;
      try { ogOut = await ogExecuteCrontab({ quietRuntimeLogs: true, state: { timestamp: runtimeNow } } as never, { entityId: hub, state: og } as never, og.crontabState, ctx as never); } catch (e) { ogErr = String((e as Error).message); }
      const rw = executeCrontab(state, replicas, now, manual, runtimeNow);
      if (ogErr !== undefined) { counts.set(`halt:${ogErr.split(":")[0]}`, (counts.get(`halt:${ogErr.split(":")[0]}`) ?? 0) + 1); expect(rw.ok ? "ok" : reasonOf(rw.error)).toBe(ogErr); continue; }
      const run = unwrap(rw);
      expect(run.outputs).toEqual((ogOut ?? []).map((o) => ({ signerId: o.signerId, txs: o.entityTxs })));
      expect(run.state.committed["jBatchState"]).toEqual(og.jBatchState);
      expect(unwrap(crontabOf(run.state)).tasks.get("hubRebalance")?.lastRun).toBe(og.crontabState.tasks.get("hubRebalance").lastRun);
      for (const a of accts) expect([...((run.accountReplicas.get(a.peer)?.state.submittedAt ?? new Map()) as ReadonlyMap<number, number>)].sort()).toEqual([...og.accounts.get(a.peer).shadow.rebalance.submittedAtByToken].sort() as never);
      for (const o of run.outputs) for (const tx of o.txs) counts.set(tx.type, (counts.get(tx.type) ?? 0) + 1);
      const r2c = ((run.state.committed["jBatchState"] as any).batch.reserveToCollateral as readonly unknown[]).length > r2cRows.length || JSON.stringify((run.state.committed["jBatchState"] as any).batch.reserveToCollateral, (_, v) => (typeof v === "bigint" ? String(v) : v)) !== JSON.stringify(r2cRows, (_, v) => (typeof v === "bigint" ? String(v) : v));
      if (r2c) counts.set("r2c", (counts.get("r2c") ?? 0) + 1);
    }
    const seen = Object.fromEntries([...counts].map(([k, v]) => [k, v > 3]));
    expect(seen).toMatchObject({ settle_propose: true, settle_execute: true, j_broadcast: true, j_abort_sent_batch: true, r2c: true, "halt:REBALANCE_REQUEST_FEE_STATE_MISSING": true, "halt:HUB_REBALANCE_TOKENLESS_RAW_OVERRIDE_FORBIDDEN": true });
    expect(counts.has("halt:J_BATCH_LIMIT_EXCEEDED")).toBe(true);
  }, 120_000);
});
