import { describe, expect, test } from "bun:test";
import {
  createEntity, foldTxs, initJBatch, setRebalanceSubmittedAt, batchOfOg, encodeBatch,
  type AccountReplica, type EntityId, type EntityState, type EntityTx,
} from "../xln.ts";
import { ALICE, BOB, CAROL, TERMS, aliceAddr, genesisAB, unwrap, verifiers } from "../xln_run.ts";
import { handleR2R } from "../../core/entity/tx/handlers/j-batch/r2r.ts";
import { handleR2E } from "../../core/entity/tx/handlers/j-batch/r2e.ts";
import { handleE2R } from "../../core/entity/tx/handlers/j-batch/e2r.ts";
import { handleR2C } from "../../core/entity/tx/handlers/j-batch/r2c.ts";
import { handleJBroadcast } from "../../core/entity/tx/handlers/j-batch/j-broadcast.ts";
import { handleJRebroadcast } from "../../core/entity/tx/handlers/j-batch/j-rebroadcast.ts";
import { handleJAbortSentBatch } from "../../core/entity/tx/handlers/j-batch/j-abort-sent-batch.ts";
import { handleJClearBatch } from "../../core/entity/tx/handlers/j-batch/j-clear-batch.ts";
import { handleMintReserves } from "../../core/entity/tx/handlers/j-batch/mint-reserves.ts";
import { encodeJBatch as ogEncodeJBatch } from "../../core/jurisdiction/machine/batch/index.ts";
import { readEntityFrameEvents } from "../../core/entity/frame-events.ts";
import { EntityAccountCandidateMap } from "../../core/entity/state/persistent-account-map.ts";
import { PersistentAccountStateMap } from "../../core/account/state/persistent-state-map.ts";

const prng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rng = prng(0xe7_1a);
const ri = (n: number) => Math.floor(rng() * n);
const pick = <X,>(xs: readonly X[]): X => xs[ri(xs.length)] as X;
const DEP = TERMS.domain.depositoryAddress, EP = "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512", OTHER = `0x${"aa".repeat(32)}`, EXT = `0x${"00".repeat(12)}${"bb".repeat(20)}`;
const TOKEN_CONTRACT = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
const OG_J = { name: "j", chainId: TERMS.domain.chainId, depositoryAddress: DEP, entityProviderAddress: EP };
const env: any = { quietRuntimeLogs: true, state: { jReplicas: new Map([["j", { name: "j", chainId: OG_J.chainId, contracts: { depository: DEP, entityProvider: EP }, rpcs: [] }]]) } };

/** ALICE's Entity (one validator) with an Account to BOB and random reserves; `named` puts the J replica name in its config. */
const aliceEntity = (reserves: ReadonlyMap<number, bigint>, named = true): EntityState => unwrap(createEntity({
  id: ALICE, jurisdiction: TERMS.domain, threshold: 1n, members: new Map([[aliceAddr, { shares: 1n }]]),
  jurisdictionConfig: { ...(named ? { name: "j" } : {}), entityProviderAddress: EP }, committed: { reserves: new Map(reserves) as never },
})).state;
/** og EntityState around the rewrite's committed jBatchState and reserves, with its Accounts behind a candidate-map shell. */
const ogState = (s: EntityState, replicas: ReadonlyMap<EntityId, AccountReplica>, timestamp: number): any => {
  const accounts = new Map([...replicas].map(([peer, c]) => [peer as string, {
    status: c._tag === "disputed" ? "disputed" : "active", state: { jNonce: c.state.jNonce },
    shadow: { rebalance: { submittedAtByToken: PersistentAccountStateMap.fromEntries("rebalanceShadowSubmitted", [...(c.state.submittedAt ?? new Map<number, number>())].map(([t, at]) => [t, at] as const)) } },
  }]));
  const shell = Object.assign(Object.create(EntityAccountCandidateMap.prototype), { get: (id: string) => accounts.get(id), getForWrite: (id: string) => accounts.get(id), has: (id: string) => accounts.has(id), keys: () => accounts.keys() });
  const jb = s.committed["jBatchState"];
  return {
    entityId: s.id, timestamp, config: { mode: "proposer-based", threshold: 1n, validators: [aliceAddr.toLowerCase()], shares: { [aliceAddr.toLowerCase()]: 1n }, jurisdiction: s.jurisdictionConfig?.name === undefined ? { ...OG_J, name: undefined } : OG_J },
    reserves: new Map(s.committed["reserves"] as never), outDebtsByToken: new Map(), accounts: shell, ...(jb === undefined ? {} : { jBatchState: structuredClone(jb) }),
  };
};
const messages = (state: any): string[] => readEntityFrameEvents(state).map((e: any) => e.message);
const ogRun = async (f: () => Promise<any>): Promise<{ ok: true; value: any } | { ok: false; code: string }> => { try { return { ok: true, value: await f() }; } catch (e) { return { ok: false, code: (e as Error).message }; } };

const randomTx = (s: EntityState): EntityTx => {
  const tokenId = pick([1, 2, 3, 0, -1]), amount = pick([1n, 5n, 40n, 400n, 0n, -3n]), sent = (s.committed["jBatchState"] as any)?.sentBatch !== undefined;
  const r = rng();
  if (r < 0.2) return { type: "r2r", data: { toEntityId: pick([BOB, OTHER, CAROL]), tokenId: Math.max(1, tokenId), amount: amount > 0n ? amount : 7n } };
  if (r < 0.3) return { type: "r2e", data: { receivingEntity: EXT, tokenId: Math.max(1, tokenId), amount: amount > 0n ? amount : 3n } };
  if (r < 0.37) return { type: "e2r", data: { contractAddress: pick([TOKEN_CONTRACT, TOKEN_CONTRACT.toLowerCase(), "0x9fe46736679d2D9a65F0992F2272dE9f3c7fa6e0", `0x${"00".repeat(20)}`, "0x12"]), amount, ...(rng() < 0.5 ? { internalTokenId: 1, tokenType: 0, externalTokenId: 0n } : {}) } };
  if (r < 0.55) return { type: "r2c", data: { counterpartyId: pick([BOB, BOB, CAROL, ALICE]), tokenId, amount, ...(rng() < 0.2 ? { receivingEntityId: pick([OTHER, ALICE, ALICE.toUpperCase().replace("0X", "0x")]) } : {}), ...(rng() < 0.1 ? { rebalanceQuoteId: 5, rebalanceFeeAmount: 1n, rebalanceFeeTokenId: 1 } : {}) } };
  if (r < 0.72) return { type: "j_broadcast", data: rng() < 0.2 ? { feeOverrides: { gasBumpBps: 500 } } : {} };
  if (r < 0.8) return { type: "j_rebroadcast", data: rng() < 0.5 ? { gasBumpBps: pick([0, 1250, 30_000, -4]) } : {} };
  if (r < 0.88 && sent) return { type: "j_abort_sent_batch", data: { ...(rng() < 0.6 ? { requeueToCurrent: rng() < 0.6 } : {}), ...(rng() < 0.5 ? { reason: "stuck" } : {}) } };
  if (r < 0.93) return { type: "j_clear_batch", data: rng() < 0.5 ? { reason: "manual" } : {} };
  return { type: "mintReserves", data: { tokenId: Math.max(1, tokenId), amount: amount > 0n ? amount : 9n } };
};
const ogHandler = (tx: EntityTx, st: any): Promise<any> => {
  const t = tx as any;
  switch (tx.type) {
    case "r2r": return handleR2R(st, t, true);
    case "r2e": return handleR2E(st, t, true);
    case "e2r": return handleE2R(st, t, true);
    case "r2c": return handleR2C(env, st, t, true);
    case "j_broadcast": return handleJBroadcast(st, t, env, true);
    case "j_rebroadcast": return handleJRebroadcast(st, t, env, true);
    case "j_abort_sent_batch": return handleJAbortSentBatch(st, t, env, true);
    case "j_clear_batch": return handleJClearBatch(st, t, env, true);
    case "mintReserves": return handleMintReserves(st, t, env, true);
    default: throw new Error(`test: ${tx.type}`);
  }
};
const ogJTxOf = (out: any): any => out.jOutputs?.[0]?.jTxs?.[0];

describe("entity-j: Entity-level J-batch txs on the committed jBatchState (og entity/tx/handlers/j-batch/*)", () => {
  test("MATCH: 40 random runs of r2r / r2e / e2r / r2c / j_broadcast / j_rebroadcast / j_abort_sent_batch / j_clear_batch / mintReserves give og's verdict, jBatchState, messages, J outputs and jBatch hashes to sign", async () => {
    const seen = new Map<string, number>();
    for (let run = 0; run < 40; run++) {
      let state = aliceEntity(new Map([[1, BigInt(ri(200))], [2, BigInt(ri(60))]]), rng() < 0.9);
      let replicas: ReadonlyMap<EntityId, AccountReplica> = new Map([[BOB, genesisAB() as AccountReplica]]);
      if (rng() < 0.5) replicas = new Map([[BOB, { ...replicas.get(BOB)!, state: setRebalanceSubmittedAt(replicas.get(BOB)!.state, 1, 77) } as AccountReplica]]);
      let t = 1_000;
      for (let step = 0; step < 12; step++) {
        t += 1 + ri(9);
        const tx = randomTx(state), og = ogState(state, replicas, t);
        const ogR = await ogRun(() => ogHandler(tx, og));
        const f = foldTxs(state, replicas, [tx], { verify: verifiers.verify, timestamp: BigInt(t) });
        const key = `${tx.type}:${ogR.ok ? "ok" : "refused"}`;
        seen.set(key, (seen.get(key) ?? 0) + 1);
        expect(f.ok).toBe(ogR.ok);
        if (!ogR.ok || !f.ok) { expect(f.ok ? "" : (f.error as any).reason).toBe(ogR.ok ? "" : ogR.code); continue; }
        const d = f.value.draft, ogOut = ogR.value;
        expect((d.events ?? []).map((e) => e.message)).toEqual(messages(ogOut.newState));
        expect(d.state.committed["jBatchState"]).toEqual(ogOut.newState.jBatchState);
        const ogTx = ogJTxOf(ogOut), myTx: any = d.jOutputs?.[0]?.jTxs[0];
        expect(myTx === undefined).toBe(ogTx === undefined);
        if (ogTx !== undefined) {
          expect(d.jOutputs![0]!.jurisdictionName).toBe(ogOut.jOutputs[0].jurisdictionName);
          expect(myTx).toEqual(ogTx);
          if (myTx.type === "batch") expect(myTx.data.encodedBatch).toBe(ogEncodeJBatch(ogTx.data.batch));
        }
        expect(d.hashes ?? []).toEqual(ogOut.hashesToSign ?? []);
        // Account latches the abort / clear release (og applyEntityAccountEnvelopeUpdate setRebalanceSubmittedAt)
        const ogSubmitted = [...ogOut.newState.accounts.get(BOB).shadow.rebalance.submittedAtByToken.keys()].sort();
        expect([...(d.accountReplicas.get(BOB)!.state.submittedAt ?? new Map()).keys()].sort()).toEqual(ogSubmitted);
        state = d.state;
        replicas = d.accountReplicas;
      }
    }
    for (const k of ["r2r:ok", "r2r:refused", "r2c:ok", "e2r:ok", "e2r:refused", "j_broadcast:ok", "j_broadcast:refused", "j_rebroadcast:ok", "j_abort_sent_batch:ok", "j_clear_batch:ok", "mintReserves:ok"]) expect(seen.get(k) ?? 0).toBeGreaterThan(0);
  }, 120_000);

  test("MATCH: batchOfOg reproduces og encodeJBatch bytes for og-shaped committed batches (numeric rows, Int512 proof bodies)", () => {
    for (let i = 0; i < 60; i++) {
      const body = { watchSeed: `0x${"11".repeat(32)}`, leftResponseSeconds: 86400, rightResponseSeconds: 3600, offdeltas: [{ high: -1n, low: (1n << 256n) - BigInt(1 + ri(50)) }, { high: 0n, low: BigInt(ri(99)) }], tokenIds: [1n, 2n], transformers: [] };
      const b: any = {
        reserveToReserve: [{ receivingEntity: OTHER, tokenId: 1 + ri(3), amount: BigInt(ri(99)) }], reserveToCollateral: rng() < 0.5 ? [] : [{ tokenId: 1, receivingEntity: ALICE, pairs: [{ entity: BOB, amount: 5n }] }],
        collateralToReserve: [{ counterparty: BOB, tokenId: 2, amount: 3n, nonce: 1 + ri(9), sig: "0x12" }], settlements: [{ leftEntity: ALICE, rightEntity: BOB, diffs: [{ tokenId: 1, leftDiff: -3n, rightDiff: 3n, collateralDiff: 0n, ondeltaDiff: -3n }], forgiveDebtsInTokenIds: [2], sig: "0x34", nonce: 4 }],
        disputeStarts: [{ counterentity: BOB, nonce: 2, proposerIsLeft: true, proofbodyHash: `0x${"22".repeat(32)}`, initialProofbody: body, watchSeed: body.watchSeed, sig: "0x56", starterInitialArguments: "0x", starterCounterArguments: "0x", starterCounterProofCommitment: `0x${"00".repeat(32)}` }],
        counterDisputes: [], disputeFinalizations: [{ counterentity: BOB, initialNonce: 2, finalNonce: 3, proposerIsLeft: false, initialProofbodyHash: `0x${"22".repeat(32)}`, finalProofbody: body, starterArguments: "0x", otherArguments: "0x", sig: "0x", startedByLeft: true, cooperative: false, submitNotBeforeTimestamp: 9 }],
        externalTokenToReserve: [{ entity: ALICE, contractAddress: TOKEN_CONTRACT, externalTokenId: 0n, tokenType: 0, internalTokenId: 1, amount: 4n }], reserveToExternalToken: [], revealSecrets: [],
        hashLadderRegistrations: [{ counterpartyEntity: BOB, targetRole: false, fullHash: `0x${"33".repeat(32)}`, partialRoot: `0x${"44".repeat(32)}`, witness: { fillRatio: ri(1000), fullSecret: `0x${"55".repeat(32)}`, reveals: [1, 2, 3, 4].map((n) => `0x${String(n).repeat(64)}`) } }],
      };
      expect(encodeBatch(batchOfOg(b))).toBe(ogEncodeJBatch(b));
    }
  });

  test("MATCH: j_broadcast refusals (no jBatchState, pending sentBatch) and notes (empty, unnamed jurisdiction) are og's", async () => {
    const replicas: ReadonlyMap<EntityId, AccountReplica> = new Map([[BOB, genesisAB() as AccountReplica]]);
    const fresh = aliceEntity(new Map([[1, 100n]]));
    const cases: EntityState[] = [fresh, { ...fresh, committed: { ...fresh.committed, jBatchState: initJBatch() as never } }, aliceEntity(new Map([[1, 100n]]), false)];
    const queued = unwrap(foldTxs(cases[2]!, replicas, [{ type: "r2r", data: { toEntityId: OTHER, tokenId: 1, amount: 5n } }], { verify: verifiers.verify, timestamp: 5n })).draft.state;
    cases.push(queued);
    for (const s of cases) {
      const og = ogState(s, replicas, 9), ogR = await ogRun(() => handleJBroadcast(og, { type: "j_broadcast", data: {} } as any, env, true));
      const f = foldTxs(s, replicas, [{ type: "j_broadcast", data: {} }], { verify: verifiers.verify, timestamp: 9n });
      expect(f.ok).toBe(ogR.ok);
      if (!f.ok || !ogR.ok) { expect((f as any).error.reason).toBe((ogR as any).code); continue; }
      expect((f.value.draft.events ?? []).map((e) => e.message)).toEqual(messages(ogR.value.newState));
    }
  });
});
