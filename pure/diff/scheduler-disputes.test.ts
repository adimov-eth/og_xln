// Behavioural diff: og Entity scheduler (core/entity/scheduler, runtime/mempool/scheduled-wake.ts), scheduledWake, disputeFinalize vs pure/xln.ts.
// "MATCH:" tests run og live on the same inputs and assert the same accept / reject, state and bytes.
import { describe, expect, test } from "bun:test";
import { ethers } from "ethers";
import {
  createEntity, derivedDeadlines, dueWakeJobs, entityRootOf, executeCrontab, foldTxs, initCrontab, prioritizeWake, scheduleHook, withCrontab, crontabOf, wireEntityTx, genesisHost, localProof, committedView, ZERO_WORD,
  type AccountReplica, type ActiveDispute, type Binary, type Crontab, type EntityError, type EntityId, type EntityState, type EntityTx, type PaybookEntry, type ScheduledHook, type ScheduledWakeJob,
} from "../xln.ts";
import { ALICE, BOB, CAROL, NOW, TERMS, aliceAddr, bobAddr, carolAddr, genesisAB, hankoVerify, unwrap } from "../xln_run.ts";
import { assertScheduledWakeFrameOrder, assertScheduledWakeMatchesState } from "../../core/entity/scheduler/wake/scheduled-wake-validation.ts";
import { prioritizeScheduledWakeTransactions } from "../../core/entity/consensus/input/merge.ts";
import { collectDerivedDeadlines } from "../../core/entity/scheduler/derived-deadlines.ts";
import { collectDueScheduledWakeJobs } from "../../core/runtime/mempool/scheduled-wake.ts";
import { executeCrontab as ogExecuteCrontab, initCrontab as ogInitCrontab } from "../../core/entity/scheduler/index.ts";
import { applyBookIntentProgram, createBookIntentProgram } from "../../core/entity/books/book-intents.ts";
import { handleDisputeFinalize } from "../../core/entity/tx/handlers/dispute/finalize.ts";
import { buildAccountProofBodyFromJurisdictions } from "../../core/account/consensus/helpers.ts";
import { createDisputeProofHashWithNonce } from "../../core/protocol/dispute/proof-builder.ts";
import { readEntityFrameEvents } from "../../core/entity/frame-events.ts";
import { computeCanonicalEntityConsensusStateHash, computeEntityAccountValueHash } from "../../core/entity/consensus/state-root.ts";
import { PersistentEntityCollectionMap } from "../../core/entity/state/persistent-collection-map.ts";
import { PersistentAccountStateMap } from "../../core/account/state/persistent-state-map.ts";
import { EntityAccountCandidateMap, PersistentEntityAccountMap } from "../../core/entity/state/persistent-account-map.ts";
import { initJBatch as ogInitJBatch } from "../../core/jurisdiction/machine/batch/index.ts";

let seed = 11;
const rng = (): number => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const ri = (n: number): number => Math.floor(rng() * n);
const pick = <T>(xs: readonly T[]): T => xs[ri(xs.length)] as T;
const env = { quietRuntimeLogs: true } as never;
const JUR = TERMS.domain;
const JCONF = { entityProviderAddress: `0x${"ee".repeat(20)}`, registrationBlock: 7, blockTimeMs: 1000 };
const reasonOf = (e: EntityError): string => (e._tag === "entity_invariant" ? e.reason : e._tag);
const ogThrows = <T>(f: () => T): { ok: true; value: T } | { ok: false; reason: string } => { try { return { ok: true, value: f() }; } catch (e) { return { ok: false, reason: String((e as Error).message) }; } };
const word = (n: number): string => `0x${n.toString(16).padStart(64, "0")}`;
type Replicas = ReadonlyMap<EntityId, AccountReplica>;

const entity = (members: readonly string[], withJ = false, committed: Record<string, unknown> = {}): EntityState =>
  unwrap(createEntity({ id: ALICE, jurisdiction: JUR, threshold: 1n, members: new Map(members.map((a) => [a as never, { shares: 1n }])), committed: committed as never, ...(withJ ? { jurisdictionConfig: JCONF } : {}) })).state;
const ogConfig = (s: EntityState, withJ = false): any => {
  if (s.quorum._tag !== "teaching") throw new Error("teaching");
  const members = [...s.quorum.members];
  return { mode: "proposer-based", threshold: s.quorum.threshold, validators: members.map(([a]) => a.toLowerCase()), shares: Object.fromEntries(members.map(([a, m]) => [a.toLowerCase(), m.shares])),
    ...(withJ ? { jurisdiction: { name: "local", address: "http://127.0.0.1:8545", chainId: JUR.chainId, depositoryAddress: JUR.depositoryAddress, ...JCONF } } : {}) };
};
type Wake = Extract<EntityTx, { type: "scheduledWake" }>;
const wakeOf = (proposerSignerId: string, dueAt: number, jobs: readonly ScheduledWakeJob[], version = 1): Wake => ({ type: "scheduledWake", data: { version: version as 1, proposerSignerId, dueAt, jobs } });
const compareJobs = (a: ScheduledWakeJob, b: ScheduledWakeJob): number => a.dueAt - b.dueAt || (a.kind < b.kind ? -1 : a.kind > b.kind ? 1 : 0) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

describe("scheduler-disputes: scheduledWake validation (og scheduler/wake/scheduled-wake-validation.ts, consensus/input/merge.ts)", () => {
  test("MATCH: 400 random wakes -- same accept / SCHEDULED_WAKE_PROPOSER_MISMATCH / SCHEDULED_WAKE_INVALID_PAYLOAD (with og's job text) as og assertScheduledWakeMatchesState", () => {
    const seen = new Map<string, number>();
    for (let i = 0; i < 400; i++) {
      const members = [aliceAddr, bobAddr, carolAddr].slice(0, 1 + ri(3)), state = entity(members), ts = 10_000 + ri(5_000);
      const jobs: ScheduledWakeJob[] = Array.from({ length: pick([0, 1, 1, 2, 3, 1_001].slice(0, rng() < 0.02 ? 6 : 5)) }, () => ({
        kind: pick(["hook", "hook", "task", "cron"] as const) as "hook", id: pick(["a", "b", "htlc-timeout:0x1", "", "x".repeat(257), "x".repeat(256)]), dueAt: pick([ri(ts + 1), ri(ts + 1), ts, ts + 1, -1, 1.5]),
      }));
      const ordered = rng() < 0.7 ? [...jobs].sort(compareJobs) : jobs;
      const withDup = rng() < 0.08 && ordered.length > 0 ? [ordered[0] as ScheduledWakeJob, ...ordered] : ordered;
      const proposer = pick([members[0] as string, (members[0] as string).toLowerCase(), (members[0] as string).toUpperCase().replace("0X", "0x"), pick([aliceAddr, bobAddr, carolAddr])]);
      const dueAt = rng() < 0.85 ? withDup[0]?.dueAt ?? ri(ts) : pick([ri(ts), ts + 3, -2, 0.5]);
      const wake = wakeOf(proposer, dueAt, withDup, rng() < 0.03 ? 2 : 1);
      const og = ogThrows(() => assertScheduledWakeMatchesState({ entityId: state.id, config: ogConfig(state), timestamp: ts } as never, wake as never));
      const rw = foldTxs(state, new Map(), [wake], { verify: hankoVerify, timestamp: BigInt(ts) });
      const key = og.ok ? "ok" : og.reason.split(":")[0] as string;
      seen.set(key, (seen.get(key) ?? 0) + 1);
      if (og.ok) expect(rw.ok ? "ok" : reasonOf(rw.error)).toBe("ok");
      else expect(rw.ok ? "ok" : reasonOf(rw.error)).toBe(og.reason);
    }
    expect([...seen.keys()].sort()).toEqual(["SCHEDULED_WAKE_INVALID_PAYLOAD", "SCHEDULED_WAKE_PROPOSER_MISMATCH", "ok"]);
    expect(Math.min(...seen.values())).toBeGreaterThan(20);
  });
  test("MATCH: 200 random frames -- og assertScheduledWakeFrameOrder (a wake is the unique first tx) and og prioritizeScheduledWakeTransactions", () => {
    const state = entity([aliceAddr]), ts = 50_000;
    const wakeA = wakeOf(aliceAddr, ts - 5, [{ kind: "hook", id: "h", dueAt: ts - 5 }]), wakeB = wakeOf(aliceAddr, ts - 4, [{ kind: "hook", id: "h", dueAt: ts - 4 }]);
    const chat: EntityTx = { type: "chat", data: { from: aliceAddr, message: "hi" } };
    let refused = 0, conflicting = 0;
    for (let i = 0; i < 200; i++) {
      const txs = Array.from({ length: 1 + ri(4) }, () => pick<EntityTx>([chat, chat, wakeA, wakeA, wakeB]));
      const og = ogThrows(() => assertScheduledWakeFrameOrder(txs.map(wireEntityTx) as never));
      const rw = foldTxs(state, new Map(), txs, { verify: hankoVerify, timestamp: BigInt(ts) });
      if (!og.ok) { refused++; expect(rw.ok ? "ok" : reasonOf(rw.error)).toBe(og.reason); }
      else expect(rw.ok).toBe(true);
      const ogP = ogThrows(() => prioritizeScheduledWakeTransactions(txs.map(wireEntityTx) as never));
      const rwP = prioritizeWake(txs);
      if (!ogP.ok) { conflicting++; expect(rwP.ok ? "ok" : reasonOf(rwP.error)).toBe(ogP.reason); }
      else expect(unwrap(rwP).map(wireEntityTx)).toEqual(ogP.value as never);
    }
    expect([refused > 30, conflicting > 10]).toEqual([true, true]);
  });
});

// ---- og EntityState fixtures for the scheduler: Accounts with locks and disputes, paybook entries, crontab, J batch ----
const PA = (name: string) => PersistentAccountStateMap.empty(name as never);
const lowerId = (s: string): string => s.toLowerCase();
const STATUS = { open: "active", preparing: "dispute_preparing", disputed: "disputed" } as const;
type Lock = { readonly lockId: string; readonly hashlock: string; readonly timelock: bigint };
type Spec = { readonly peer: EntityId; readonly tag: "open" | "preparing" | "disputed"; readonly locks: readonly Lock[]; readonly active?: ActiveDispute | Record<string, unknown> | undefined; readonly queued?: boolean };
const ogAccountOf = (s: Spec): any => ({
  state: { leftEntity: lowerId(ALICE), rightEntity: lowerId(s.peer), domain: { ...TERMS.domain }, watchSeed: TERMS.watchSeed, disputeConfig: { ...TERMS.disputeConfig }, jNonce: 0,
    deltas: PA("deltas"), locks: PersistentAccountStateMap.fromEntries("locks" as never, s.locks.map((l) => [l.lockId, l] as const) as never), swapOffers: PA("swapOffers"), pulls: PA("pulls"), requestedRebalance: PA("requestedRebalance"), requestedRebalanceFeeState: PA("requestedRebalanceFeeState"), rebalanceFeePolicies: PA("rebalanceFeePolicies") },
  status: STATUS[s.tag], mempool: [], currentHeight: 0, proofHeader: { fromEntity: lowerId(ALICE), toEntity: s.peer, nextProofNonce: 1 }, pendingWithdrawals: PA("pendingWithdrawals"),
  shadow: { rebalance: { policy: PA("rebalanceShadowPolicy"), submittedAtByToken: PA("rebalanceShadowSubmitted") } }, ...(s.active === undefined ? {} : { activeDispute: { ...s.active } }),
});
const rwAccountOf = (s: Spec): AccountReplica => {
  const base = genesisAB();
  const state = { ...base.state, locks: new Map(s.locks.map((l) => [l.lockId, l])) } as never;
  if (s.tag === "open") return { ...base, state } as AccountReplica;
  if (s.tag === "preparing") return { ...base, _tag: "preparing", state, mempool: [], unready: { _tag: "not_attempted" } } as unknown as AccountReplica;
  return { ...base, _tag: "disputed", state, mempool: [], ...(s.active === undefined ? {} : s.queued ? { queued: s.active } : { active: s.active }) } as unknown as AccountReplica;
};
const ogAccounts = (specs: readonly Spec[]): any => new EntityAccountCandidateMap(PersistentEntityAccountMap.fromEntries(specs.map((s) => [s.peer, ogAccountOf(s)]), ALICE, () => ZERO_WORD as never));
const randomLocks = (): Lock[] => [...new Set(Array.from({ length: ri(3) }, () => word(1 + ri(6))))].map((h) => ({ lockId: h, hashlock: h, timelock: pick([0n, -5n, BigInt(900 + ri(400)), BigInt(900 + ri(400)), 2n ** 60n]) }));
const randomPaybook = (peers: readonly EntityId[]): Map<string, PaybookEntry> => new Map(Array.from({ length: ri(4) }, (): [string, PaybookEntry] => {
  const h = word(1 + ri(6)), started = pick([900, 1_000, 1.5, Number.NaN]);
  return [h, { hashlock: h, createdTimestamp: 1, ...(rng() < 0.9 ? { inboundEntity: pick(peers) } : {}), ...(rng() < 0.85 ? { secret: word(99) } : {}), ...(rng() < 0.85 ? { secretAckPending: rng() < 0.9 } : {}),
    secretAckStartedAt: started, secretAckDeadlineAt: pick([900 + ri(400), 900 + ri(400), 800, 2.5]) }];
}));

describe("scheduler-disputes: derived deadlines and due wake jobs (og scheduler/derived-deadlines.ts, runtime/mempool/scheduled-wake.ts)", () => {
  test("MATCH: 300 random Entities (Account locks by status, paybook secret-ack entries, stored hooks, the hubRebalance task) -- og collectDerivedDeadlines and collectDueScheduledWakeJobs", () => {
    let deadlines = 0, jobs = 0;
    for (let i = 0; i < 300; i++) {
      const peers = [BOB, CAROL].slice(0, 1 + ri(2)) as EntityId[];
      const specs: Spec[] = peers.map((peer) => ({ peer, tag: pick(["open", "open", "preparing", "disputed"] as const), locks: randomLocks() }));
      const entries = randomPaybook(peers), now = pick([undefined, 1_000 + ri(400)]);
      const hooks: ScheduledHook[] = Array.from({ length: ri(3) }, (_, j) => ({ id: `hub-kick:${j}`, triggerAt: 900 + ri(500), type: "hub_rebalance_kick", data: { reason: "r", counterpartyId: BOB } }));
      const lastRun = pick([0, 500, 1_200]), config = rng() < 0.4 ? { disputeAutoFinalizeMode: "auto" } : undefined, sent = rng() < 0.5;
      const crontab: Crontab = hooks.reduce(scheduleHook, { ...initCrontab(), tasks: new Map([["hubRebalance", { method: "hubRebalance", intervalMs: 1000, lastRun, enabled: rng() < 0.9, params: {} }]]) });
      const jBatch = { ...ogInitJBatch(), ...(sent ? { sentBatch: { batch: ogInitJBatch().batch, entityNonce: 3 } } : {}) };
      const state = { ...withCrontab(entity([aliceAddr], false, { jBatchState: jBatch, ...(config ? { hubRebalanceConfig: config } : {}) }), crontab), paybook: { entries, feesEarned: 0n } };
      const replicas: Replicas = new Map(specs.map((s) => [s.peer, rwAccountOf(s)]));
      const og: any = { entityId: ALICE, timestamp: 0, config: ogConfig(state), accounts: ogAccounts(specs), paybook: { entries, feesEarned: 0n }, crontabState: { tasks: crontab.tasks, hooks: new Map(crontab.hooks) }, jBatchState: jBatch, ...(config ? { hubRebalanceConfig: config } : {}) };
      const d = derivedDeadlines(state, replicas, now);
      expect(d).toEqual(collectDerivedDeadlines(og, now) as never);
      deadlines += d.length;
      const at = now ?? 1_300, periodic = rng() < 0.7;
      const rwJobs = dueWakeJobs(state, replicas, unwrap(crontabOf(state)), at, periodic);
      expect(rwJobs).toEqual(collectDueScheduledWakeJobs(og, at, periodic) as never);
      jobs += rwJobs.length;
    }
    expect([deadlines > 100, jobs > 150]).toEqual([true, true]);
  });
  test("MATCH: 40 random stored hook sets -- the crontab hooks commit as og's Entity collection commitment inside computeCanonicalEntityConsensusStateHash", () => {
    for (let i = 0; i < 40; i++) {
      const hooks: ScheduledHook[] = Array.from({ length: ri(5) }, (_, j) => pick<ScheduledHook>([
        { id: `dispute-deadline:${lowerId(BOB)}`, triggerAt: 1_000 + ri(9_000), type: "dispute_deadline", data: { accountId: BOB } },
        { id: `hub-kick:${j}`, triggerAt: ri(9_000), type: "hub_rebalance_kick", data: { reason: `r${j}`, counterpartyId: CAROL } },
        { id: `sweep:${j}`, triggerAt: ri(9_000), type: "cross_j_orderbook_sweep", data: { reason: "cross-j-orderbook-sweep" } },
      ]));
      const lastRun = ri(5_000), crontab = hooks.reduce(scheduleHook, initCrontab());
      const tasks = new Map([["hubRebalance", { method: "hubRebalance", intervalMs: 1000, lastRun, enabled: true, params: {} }]]) as Crontab["tasks"];
      const state = withCrontab(entity([aliceAddr]), { ...crontab, tasks });
      const ogHooks = hooks.reduce((m, h) => m.updated(h.id, h), PersistentEntityCollectionMap.empty<unknown>());
      const og = { entityId: state.id, height: Number(state.height), timestamp: Number(state.timestamp), config: ogConfig(state), accounts: PersistentEntityAccountMap.fromEntries([], state.id, computeEntityAccountValueHash),
        paybook: { entries: PersistentEntityCollectionMap.empty("paybookHashlock"), feesEarned: 0n }, crontabState: { tasks, hooks: ogHooks } };
      expect(unwrap(entityRootOf(state, new Map()))).toBe(computeCanonicalEntityConsensusStateHash(og as never));
    }
    // og initCrontab: the hubRebalance task at the 1s cadence, no hooks
    expect({ tasks: [...initCrontab().tasks], hooks: initCrontab().hooks.size }).toEqual({ tasks: [...ogInitCrontab().tasks] as never, hooks: ogInitCrontab().hooks.size });
  });
});

const sortedEntries = (m: ReadonlyMap<string, unknown> | undefined): unknown[] => [...(m ?? new Map())].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
const observed = (nowSec: number, over: Partial<ActiveDispute> = {}): ActiveDispute => ({
  startedByLeft: rng() < 0.5, initialProofbodyHash: word(7), initialNonce: 1, initialProposerIsLeft: true, disputeTimeout: pick([0, nowSec - 1, nowSec, nowSec + 1]), disputeStartTimestamp: nowSec - 100,
  jNonce: 1, starterInitialArguments: "0x", starterCounterArguments: "0x", starterCounterProofCommitment: ZERO_WORD, observedOnChain: true, observedBlockNumber: 7, finalizeQueued: rng() < 0.3, ...over,
});
const queuedStart = (): Record<string, unknown> => ({ startedByLeft: true, initialProofbodyHash: word(7), initialNonce: 1, initialProposerIsLeft: true, disputeTimeout: 0, jNonce: 1, starterInitialArguments: "0x", starterCounterArguments: "0x",
  starterCounterProofCommitment: ZERO_WORD, observedOnChain: false, finalizeQueued: false });

describe("scheduler-disputes: executeCrontab (og scheduler/index.ts, due-hooks.ts, dispute-deadline-hook.ts)", () => {
  test("MATCH: 300 random due sets (HTLC timeouts, secret-ack deadlines, dispute deadlines against the J batch lifecycle, kicks, sweeps, board-refresh deadlines, the hubRebalance task) -- og's outputs, re-armed hooks, latches, paybook and task", async () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 300; i++) {
      const now = 2_000_000 + ri(4_000), nowSec = Math.floor(now / 1000);
      const near = (): bigint => pick([BigInt(now - ri(100)), BigInt(now + 50), 0n]);
      const bobLocks = [...new Set(Array.from({ length: ri(3) }, () => word(1 + ri(5))))].map((h) => ({ lockId: h, hashlock: h, timelock: near() }));
      const carolLocks = [...new Set(Array.from({ length: ri(3) }, () => word(1 + ri(5))))].map((h) => ({ lockId: h, hashlock: h, timelock: near() }));
      const bobTag = pick(["open", "disputed", "disputed", "disputed"] as const), queued = bobTag === "disputed" && rng() < 0.2;
      const specs: Spec[] = [
        { peer: BOB, tag: bobTag, locks: bobLocks, ...(bobTag === "disputed" ? { active: queued ? queuedStart() : observed(nowSec), queued } : {}) },
        { peer: CAROL, tag: "open", locks: carolLocks },
      ];
      const entries = new Map(Array.from({ length: ri(4) }, (): [string, PaybookEntry] => {
        const peer = pick([BOB, CAROL]), pool = peer === BOB ? bobLocks : carolLocks, h = rng() < 0.7 && pool.length > 0 ? pick(pool).hashlock : word(20 + ri(5));
        const invalid = rng() < 0.05;
        return [h, { hashlock: h, createdTimestamp: 1, inboundEntity: peer, secret: word(99), secretAckPending: rng() < 0.9, secretAckStartedAt: now - 200, secretAckDeadlineAt: invalid ? now - 300 : pick([now - 1, now, now + 10]) }];
      }));
      const config = rng() < 0.25 ? { disputeAutoFinalizeMode: pick(["ignore", "auto"]) } : undefined;
      const bobRow = { counterentity: BOB }, other = (n: number) => ({ counterentity: word(500 + n) });
      const draft = { ...ogInitJBatch().batch, disputeFinalizations: rng() < 0.2 ? [bobRow] : [], disputeStarts: Array.from({ length: pick([0, 0, 7, 8]) }, (_, n) => other(n)) };
      const jBatch = { ...ogInitJBatch(), batch: draft,
        ...(rng() < 0.25 ? { sentBatch: { batch: { ...ogInitJBatch().batch, disputeFinalizations: rng() < 0.5 ? [bobRow] : [] }, entityNonce: 4 } } : {}),
        ...(rng() < 0.1 ? { recoveryBatches: [{ ...ogInitJBatch().batch, disputeFinalizations: [bobRow] }] } : {}) };
      const hooks: ScheduledHook[] = [
        ...(rng() < 0.7 ? [{ id: `dispute-deadline:${lowerId(BOB)}`, triggerAt: pick([now - ri(10), now + 100]), type: "dispute_deadline", data: { accountId: BOB } } as const] : []),
        ...(rng() < 0.2 ? [{ id: `dispute-deadline:${lowerId(CAROL)}`, triggerAt: now - 1, type: "dispute_deadline", data: { accountId: CAROL } } as const] : []),
        ...(!config && rng() < 0.2 ? [{ id: "hub-rebalance-kick", triggerAt: now - 5, type: "hub_rebalance_kick", data: { reason: "r", counterpartyId: BOB } } as const] : []),
        ...(rng() < 0.1 ? [{ id: "window", triggerAt: now - 5, type: "settlement_window", data: {} } as const] : []),
        ...(rng() < 0.15 ? [{ id: "cross-j-sweep", triggerAt: now - 2, type: "cross_j_orderbook_sweep", data: { reason: pick(["", "late"]) } } as const] : []),
        ...(rng() < 0.15 ? [{ id: `board-refresh:${lowerId(CAROL)}`, triggerAt: now - 3, type: "counterparty_board_hanko_refresh_deadline", data: { accountId: CAROL, activationJHeight: 5, activationLogIndex: 1 } } as const] : []),
      ];
      const lastRun = config ? now : pick([0, now - 500, now]);
      const task = { method: "hubRebalance" as const, intervalMs: 1000, lastRun, enabled: true, params: {} };
      const crontab: Crontab = hooks.reduce(scheduleHook, { ...initCrontab(), tasks: new Map([["hubRebalance", task]]) });
      const state = { ...withCrontab(entity([aliceAddr], false, { jBatchState: jBatch, ...(config ? { hubRebalanceConfig: config } : {}) }), crontab), paybook: { entries, feesEarned: 0n } };
      const replicas: Replicas = new Map(specs.map((s) => [s.peer, rwAccountOf(s)]));
      const og: any = { entityId: ALICE, timestamp: now, config: ogConfig(state), accounts: ogAccounts(specs), paybook: { entries: new Map(entries), feesEarned: 0n },
        crontabState: { tasks: new Map([["hubRebalance", { ...task }]]), hooks: new Map(hooks.map((h) => [h.id, { ...h }])) }, jBatchState: structuredClone(jBatch), ...(config ? { hubRebalanceConfig: config } : {}) };
      const program = createBookIntentProgram();
      const ctx = { manualBroadcastInInput: false, bookIntentSlot: program.openSlot(), hashesToSign: [], accountChanges: new Set<string>(), candidateEffects: [], accountTxs: [] };
      let ogOut: any[] | undefined, ogErr: string | undefined;
      try { ogOut = await ogExecuteCrontab(env, { entityId: ALICE, state: og } as never, og.crontabState, ctx as never); applyBookIntentProgram(og, program); } catch (e) { ogErr = String((e as Error).message); }
      const rw = executeCrontab(state, replicas, now);
      if (ogErr !== undefined) { counts.set("halt", (counts.get("halt") ?? 0) + 1); expect(rw.ok ? "ok" : reasonOf(rw.error)).toBe(ogErr); continue; }
      const run = unwrap(rw);
      expect(run.outputs).toEqual((ogOut ?? []).map((o) => ({ signerId: o.signerId, txs: o.entityTxs })));
      const after = unwrap(crontabOf(run.state));
      expect(sortedEntries(after.hooks)).toEqual(sortedEntries(og.crontabState.hooks) as never);
      expect(after.tasks.get("hubRebalance")?.lastRun).toBe(og.crontabState.tasks.get("hubRebalance").lastRun);
      const child = run.accountReplicas.get(BOB) as any;
      expect(child?.active ?? child?.queued).toEqual(og.accounts.get(BOB)?.activeDispute);
      expect(sortedEntries(run.state.paybook?.entries)).toEqual(sortedEntries(og.paybook.entries) as never);
      for (const o of run.outputs) for (const tx of o.txs) counts.set(tx.type, (counts.get(tx.type) ?? 0) + 1);
    }
    expect(Object.fromEntries([...counts].filter(([k]) => k !== "halt").map(([k, v]) => [k, v > 3]))).toEqual({ processHtlcTimeouts: true, prepareDispute: true, disputeFinalize: true, j_broadcast: true, orderbookSweepCrossJurisdiction: true });
  }, 60_000);
});

describe("scheduler-disputes: disputeFinalize (og dispute/finalize.ts, finalize-admission.ts, finalize-proof.ts)", () => {
  const ogJ = { jReplicas: new Map([["j", { chainId: JUR.chainId, contracts: { depository: JUR.depositoryAddress, entityProvider: `0x${"55".repeat(20)}`, account: `0x${"66".repeat(20)}`, deltaTransformer: `0x${"77".repeat(20)}` } }]]) };
  const ogEnv = { quietRuntimeLogs: true, state: ogJ } as never;
  const commitmentOf = (nonce: number, left: boolean, hash: string): string => ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(["uint256", "bool", "bytes32"], [nonce, left, hash]));
  test("MATCH: 400 random finalizations (missing / open / queued / observed disputes, counterparty witnesses, selected counter-proofs, starter arguments, timing, J batch lifecycle) -- og's events, J batch row, latch and halts", async () => {
    const good: string = (unwrap(localProof(unwrap(committedView(genesisAB().state)))) as any).bodyHash, bad = word(4242);
    const counts = new Map<string, number>();
    for (let i = 0; i < 400; i++) {
      const now = 5_000_000 + ri(20_000), nowSec = Math.floor(now / 1000), withJ = rng() < 0.8, kind = pick(["missing", "open", "queued", "observed", "observed", "observed", "observed"] as const);
      const initialNonce = pick([0, 1, 1, 2]), initialProposerIsLeft = rng() < 0.5;
      const selected = rng() < 0.2 ? { selectedCounterNonce: pick([2, 3]), ...(rng() < 0.85 ? { selectedCounterProofbodyHash: pick([good, good, bad]) } : {}), ...(rng() < 0.85 ? { selectedCounterProposerIsLeft: rng() < 0.5 } : {}) } : {};
      const wNonce = pick([1, 2, 3]), wLeft = rng() < 0.5, wBody = pick([good, good, bad]);
      const commitment = rng() < 0.5 ? commitmentOf(selected.selectedCounterNonce ?? wNonce, selected.selectedCounterProposerIsLeft ?? wLeft, selected.selectedCounterProofbodyHash ?? wBody) : ZERO_WORD;
      const active = kind === "queued" ? queuedStart() : observed(nowSec, {
        initialNonce, initialProposerIsLeft, initialProofbodyHash: pick([good, good, good, bad]), disputeTimeout: pick([0, nowSec - 1, nowSec, nowSec + 5]), finalizeQueued: rng() < 0.12,
        starterInitialArguments: pick(["0x", "0x", "0xabcd", "0xzz"]), starterCounterArguments: "0x1234", starterCounterProofCommitment: commitment, ...selected,
      });
      const spec: Spec = { peer: BOB, tag: kind === "open" ? "open" : "disputed", locks: [], ...(kind === "queued" || kind === "observed" ? { active, queued: kind === "queued" } : {}) };
      const ogAcc = ogAccountOf(spec);
      expect(buildAccountProofBodyFromJurisdictions(ogJ as never, ogAcc).proofBodyHash).toBe(good);
      const witness = rng() < 0.55 ? { hanko: pick(["0x", `0x${"77".repeat(65)}`, `0x${"77".repeat(65)}`]), proofBodyHash: wBody, proofNonce: wNonce, proposerIsLeft: wLeft,
        hash: rng() < 0.85 ? createDisputeProofHashWithNonce(ogAcc.state, wBody, JUR, wNonce, wLeft) : word(5) } : undefined;
      if (witness) Object.assign(ogAcc, { counterpartyDisputeProofHanko: witness.hanko, counterpartyDisputeHash: witness.hash, counterpartyDisputeProofBodyHash: witness.proofBodyHash, counterpartyDisputeProofNonce: witness.proofNonce, counterpartyDisputeProofProposerIsLeft: witness.proposerIsLeft });
      const rwChild = { ...rwAccountOf(spec), dispute: { nextProofNonce: 1, ...(witness ? { counterparty: witness } : {}) } } as AccountReplica;
      const jb = pick([undefined, "draft", "draft", "sent", "own", "full"] as const);
      const jBatch = jb === undefined ? undefined : { ...ogInitJBatch(), batch: { ...ogInitJBatch().batch, disputeFinalizations: jb === "own" ? [{ counterentity: BOB }] : jb === "full" ? [{ counterentity: CAROL }] : [] },
        ...(jb === "sent" ? { sentBatch: { batch: { ...ogInitJBatch().batch, disputeFinalizations: rng() < 0.5 ? [{ counterentity: BOB }] : [] }, entityNonce: 9 } } : {}) };
      const tx: EntityTx = { type: "disputeFinalize", data: { counterpartyEntityId: BOB, ...(rng() < 0.6 ? { description: pick(["", "auto-finalize-after-timeout"]) } : {}), ...(rng() < 0.5 ? { useOnchainRegistry: true } : {}) } };
      const state = entity([aliceAddr], withJ, jBatch === undefined ? {} : { jBatchState: jBatch });
      const rw = foldTxs(state, kind === "missing" ? new Map() : new Map([[BOB, rwChild]]), [tx], { verify: hankoVerify, timestamp: BigInt(now) });
      const ogState: any = { entityId: ALICE, timestamp: now, config: ogConfig(state, withJ), accounts: new EntityAccountCandidateMap(PersistentEntityAccountMap.fromEntries(kind === "missing" ? [] : [[BOB, ogAcc]], ALICE, () => ZERO_WORD as never)),
        paybook: { entries: new Map(), feesEarned: 0n }, crontabState: ogInitCrontab(), ...(jBatch === undefined ? {} : { jBatchState: structuredClone(jBatch) }) };
      let og: any, ogErr: string | undefined;
      try { og = (await handleDisputeFinalize(ogState, wireEntityTx(tx) as never, ogEnv, true)).newState; } catch (e) { ogErr = String((e as Error).message); }
      if (ogErr !== undefined) { counts.set(ogErr.split(":")[0] as string, (counts.get(ogErr.split(":")[0] as string) ?? 0) + 1); expect(rw.ok ? "ok" : reasonOf(rw.error)).toBe(ogErr); continue; }
      const d = unwrap(rw).draft, events = readEntityFrameEvents(og) as { message: string }[];
      expect(d.events).toEqual(events as never);
      expect(d.state.committed["jBatchState"]).toEqual(og.jBatchState);
      const child = d.accountReplicas.get(BOB) as any;
      expect(child?.active ?? child?.queued).toEqual(og.accounts.get(BOB)?.activeDispute);
      const key = (events.at(-1)?.message ?? "none").slice(0, 12);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const keys = [...counts.keys()];
    expect(["⚖️ Dispute f", "DISPUTE_FROZEN_ACCOUNT_STATE_MISMATCH", "DISPUTE_COUNTER_FINALIZE_HASH_MISMATCH", "J_BATCH_LIMIT_EXCEEDED", "J_DISPUTE_HEX_INVALID"].filter((k) => !keys.includes(k))).toEqual([]);
    expect((counts.get("⚖️ Dispute f") ?? 0) > 20).toBe(true);
  }, 60_000);
});
