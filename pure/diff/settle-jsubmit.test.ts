import { describe, expect, test } from "bun:test";
import { decodeJBatch, encodeJBatch } from "../../core/jurisdiction/machine/batch/index.ts";
import { handleJRebroadcast } from "../../core/entity/tx/handlers/j-batch/j-rebroadcast.ts";
import { handleJAbortSentBatch } from "../../core/entity/tx/handlers/j-batch/j-abort-sent-batch.ts";
import { handleJClearBatch } from "../../core/entity/tx/handlers/j-batch/j-clear-batch.ts";
import { handleMintReserves } from "../../core/entity/tx/handlers/j-batch/mint-reserves.ts";
import { applyHankoBatchProcessedEvent } from "../../core/entity/tx/j-events-batch.ts";
import { readEntityFrameEvents } from "../../core/entity/frame-events.ts";
import { EntityAccountCandidateMap } from "../../core/entity/state/persistent-account-map.ts";
import { PersistentAccountStateMap } from "../../core/account/state/persistent-state-map.ts";
import {
  encodeBatch, emptyBatch, initJBatch, queueR2R, jBroadcast, jRebroadcast, jAbortSentBatch, jClearBatch, mintReservesTx, genesisHost, applyHost, setRebalanceSubmittedAt, EMPTY_DEBTS,
  type Batch, type JBatchState, type JEntity,
} from "../xln.ts";
import { ALICE, BOB, genesisAB, hankoVerify, unwrap } from "../xln_run.ts";

const prng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rng = prng(0x5e77_1e);
const ri = (n: number) => Math.floor(rng() * n);
const pick = <X,>(xs: readonly X[]): X => xs[ri(xs.length)] as X;
const W = (b: string) => `0x${b.repeat(32 / (b.length / 2))}`;
const ENTITY = W("e1"), PEER = W("0f"), OTHER = W("aa"), DEP = "0x5FbDB2315678afecb367f032d93F642f64180aa3", EP = `0x${"c1".repeat(20)}`, SIGNER = `0x${"5a".repeat(20)}`;
const ogDecoded = (b: Batch): any => decodeJBatch(encodeBatch(b));
const toOg = (j: JBatchState): any => ({ ...j, batch: ogDecoded(j.batch), ...(j.sentBatch === undefined ? {} : { sentBatch: { ...j.sentBatch, batch: ogDecoded(j.sentBatch.batch) } }), ...(j.recoveryBatches === undefined ? {} : { recoveryBatches: j.recoveryBatches.map(ogDecoded) }) });
const env: any = { state: { jReplicas: new Map([["j", { name: "j", chainId: 31337, contracts: { depository: DEP, entityProvider: EP }, rpcs: [] }]]) } };
const jurisdiction = { name: "j", chainId: 31337, depositoryAddress: DEP, entityProviderAddress: EP, address: "jreplica://j" };
/** og Entity state around a jBatchState, with accounts behind a candidate-map shell (og getEntityAccountForWrite). */
const ogEntity = (j: JBatchState | undefined, accounts: ReadonlyMap<string, any> = new Map()): any => {
  const shell = Object.assign(Object.create(EntityAccountCandidateMap.prototype), { get: (id: string) => accounts.get(id), getForWrite: (id: string) => accounts.get(id), has: (id: string) => accounts.has(id), keys: () => accounts.keys() });
  return { entityId: ENTITY, timestamp: 900, config: { validators: [SIGNER], threshold: 1n, shares: { [SIGNER]: 1n }, mode: "proposer-based", jurisdiction }, accounts: shell, ...(j === undefined ? {} : { jBatchState: toOg(j) }) };
};
const messages = (state: any): string[] => readEntityFrameEvents(state).map((e: any) => e.message);
const sameJBatch = (rw: JBatchState | undefined, og: any): void => {
  expect(rw === undefined).toBe(og === undefined);
  if (rw === undefined) return;
  expect(encodeBatch(rw.batch)).toBe(encodeJBatch(og.batch));
  expect(rw.status).toBe(og.status);
  expect(rw.broadcastCount).toBe(og.broadcastCount);
  expect(rw.lastBroadcast).toBe(og.lastBroadcast);
  expect(rw.entityNonce).toBe(og.entityNonce);
  expect(rw.autoBroadcastDraft).toBe(og.autoBroadcastDraft);
  expect((rw.recoveryBatches ?? []).map(encodeBatch)).toEqual((og.recoveryBatches ?? []).map(encodeJBatch));
  expect(rw.sentBatch === undefined).toBe(og.sentBatch === undefined);
  if (rw.sentBatch === undefined) return;
  const { batch: rb, ...rs } = rw.sentBatch, { batch: ob, ...os } = og.sentBatch;
  expect(encodeBatch(rb)).toBe(encodeJBatch(ob));
  expect(rs).toEqual(os);
};

/** A random jBatchState in every lifecycle shape: draft only, sealed, sealed with recovery, quarantined, an empty stale sentBatch. */
const randomJBatch = (): JBatchState => {
  const e: JEntity = { entityId: ENTITY, reserves: new Map([[1, 10_000n], [2, 10_000n]]), debts: EMPTY_DEBTS, accounts: new Set([PEER]) };
  let s: JBatchState = { ...initJBatch(), entityNonce: ri(4), broadcastCount: ri(3) };
  for (let k = ri(4); k > 0; k--) s = unwrap(queueR2R({ ...e, jBatch: s }, pick([OTHER, PEER]), 1 + ri(2), BigInt(1 + ri(9))) as any);
  if (rng() < 0.2) return s;
  if (s.batch.reserveToReserve.length === 0) s = unwrap(queueR2R({ ...e, jBatch: s }, OTHER, 1, 3n) as any);
  const withOps: Batch = {
    ...s.batch,
    collateralToReserve: Array.from({ length: ri(3) }, () => ({ counterparty: pick([PEER, OTHER]), tokenId: 1n, amount: BigInt(1 + ri(5)), nonce: BigInt(1 + ri(4)), sig: "0x12" })),
    disputeFinalizations: [],
    reserveToCollateral: rng() < 0.5 ? [] : [{ tokenId: BigInt(1 + ri(2)), receivingEntity: ENTITY, pairs: [{ entity: pick([PEER, OTHER]), amount: 5n }] }],
  };
  const sealed = unwrap(jBroadcast({ ...s, batch: withOps }, { entityId: ENTITY, chainId: 31337, depository: DEP, signerId: SIGNER, timestamp: 5 }) as any) as any;
  let out: JBatchState = sealed.jBatch;
  if (rng() < 0.3) out = { ...out, batch: unwrap(queueR2R({ ...e, jBatch: { ...out, sentBatch: undefined } }, OTHER, 2, 4n) as any).batch };
  if (rng() < 0.25) out = { ...out, recoveryBatches: [unwrap(queueR2R(e, PEER, 1, 2n) as any).batch] };
  if (rng() < 0.15) out = { ...out, sentBatch: { ...out.sentBatch!, terminalFailure: { message: "J_BATCH_NONCE_CONSUMED_BY_DIFFERENT_HASH:x", failedAt: 3 } } };
  else if (rng() < 0.15) out = { ...out, sentBatch: { ...out.sentBatch!, batch: emptyBatch() } };
  return out;
};

describe("settle-jsubmit: the J submit lifecycle (og entity/tx/handlers/j-batch/{j-rebroadcast,j-abort-sent-batch,j-clear-batch,mint-reserves}.ts)", () => {
  test("MATCH: 150 random j_rebroadcast calls -- same refusal, same resealed sentBatch, generation, jTx (with gas bump) and jBatch hash to sign as og handleJRebroadcast", async () => {
    const outcomes = new Set<string>();
    for (let n = 0; n < 150; n++) {
      const s = rng() < 0.1 ? undefined : randomJBatch(), bump = pick([undefined, 0, 1250, -5, 30_000, 12.7, Number.NaN]);
      const og = ogEntity(s);
      let ogOut: any, ogErr: string | undefined;
      try { ogOut = await handleJRebroadcast(og, { type: "j_rebroadcast", data: { ...(bump === undefined ? {} : { gasBumpBps: bump }) } } as any, env, true); } catch (e) { ogErr = (e as Error).message; }
      const rw = jRebroadcast(s, { entityId: ENTITY, chainId: 31337, depository: DEP, signerId: SIGNER, timestamp: 900, gasBumpBps: bump });
      expect(rw.ok).toBe(ogErr === undefined);
      if (!rw.ok) { expect((rw.error as any).reason).toBe(ogErr); outcomes.add("refused"); continue; }
      const msgs = messages(og);
      expect(rw.value.note).toBe(msgs[msgs.length - 1]);
      if (s !== undefined) sameJBatch(rw.value.jBatch, og.jBatchState);
      const ogTx = ogOut.jOutputs[0]?.jTxs[0];
      expect(rw.value.jTx === undefined).toBe(ogTx === undefined);
      if (ogTx !== undefined) {
        const { batch: rb, ...rd } = rw.value.jTx!.data, { batch: ob, ...od } = ogTx.data;
        expect(encodeBatch(rb)).toBe(encodeJBatch(ob));
        expect(rd).toEqual(od);
        expect(rw.value.jTx!.timestamp).toBe(ogTx.timestamp);
        expect(ogOut.jOutputs[0].jurisdictionName).toBe("j");
        expect([rw.value.hashToSign]).toEqual(ogOut.hashesToSign);
      }
      outcomes.add(ogTx === undefined ? "note" : "resent");
    }
    expect(outcomes).toEqual(new Set(["refused", "note", "resent"]));
  }, 60_000);

  const accountsFor = (jNonce: number, submitted: readonly number[]): Map<string, any> =>
    new Map([[PEER, { status: "active", state: { jNonce }, shadow: { rebalance: { submittedAtByToken: PersistentAccountStateMap.fromEntries("rebalanceShadowSubmitted", submitted.map((t) => [t, 77] as const)) } } }]]);
  const submittedOf = (accounts: Map<string, any>): number[] => [...accounts.get(PEER).shadow.rebalance.submittedAtByToken.keys()].sort((a: number, b: number) => a - b);

  test("MATCH: 150 random j_abort_sent_batch calls (requeue / drop, stale C2R by Account jNonce, R2C submitted markers) change the jBatchState and the Account latches like og handleJAbortSentBatch", async () => {
    const outcomes = new Set<string>();
    for (let n = 0; n < 150; n++) {
      const s = rng() < 0.1 ? undefined : randomJBatch(), jNonce = ri(5), submitted = [1, 2].filter(() => rng() < 0.6);
      const requeue = pick([undefined, true, false]), reason = pick([undefined, "", "stuck"]);
      const accounts = accountsFor(jNonce, submitted), og = ogEntity(s, accounts);
      await handleJAbortSentBatch(og, { type: "j_abort_sent_batch", data: { ...(requeue === undefined ? {} : { requeueToCurrent: requeue }), ...(reason === undefined ? {} : { reason }) } } as any, env, true);
      const rw = jAbortSentBatch(s, { requeueToCurrent: requeue, reason }, (c) => (c === PEER ? jNonce : 0));
      expect(rw.note).toBe(messages(og).at(-1));
      sameJBatch(rw.jBatch, og.jBatchState);
      const body = rw.release.submitted.filter((r) => r.accountId === PEER).reduce((b, r) => setRebalanceSubmittedAt(b, r.tokenId, undefined), { submittedAt: new Map(submitted.map((t) => [t, 77])) } as any);
      expect([...body.submittedAt.keys()].sort()).toEqual(submittedOf(accounts));
      outcomes.add(s?.sentBatch === undefined ? "none" : requeue === false ? "dropped" : "requeued");
    }
    expect(outcomes).toEqual(new Set(["none", "dropped", "requeued"]));
  }, 60_000);

  test("MATCH: 100 random j_clear_batch calls empty the draft, sentBatch and recovery batches and reset every submitted marker like og handleJClearBatch", async () => {
    for (let n = 0; n < 100; n++) {
      const s = rng() < 0.1 ? undefined : randomJBatch(), submitted = [1, 2, 3].filter(() => rng() < 0.5), reason = pick([undefined, "manual"]);
      const accounts = accountsFor(0, submitted), og = ogEntity(s, accounts);
      await handleJClearBatch(og, { type: "j_clear_batch", data: { ...(reason === undefined ? {} : { reason }) } } as any, env, true);
      const rw = jClearBatch(s, { reason }, new Map([[PEER, submitted]]));
      expect(rw.note).toBe(messages(og).at(-1));
      sameJBatch(rw.jBatch, og.jBatchState);
      if (s !== undefined) expect(submittedOf(accounts)).toEqual([]);
      expect(rw.release.submitted.map((r) => r.tokenId)).toEqual(s === undefined ? [] : [...submitted].sort((a, b) => a - b));
    }
  });

  test("MATCH: mintReserves emits og's direct `mint` JTx (outside the batch) with the Entity timestamp", async () => {
    for (const [tokenId, amount] of [[1, 5n], [3, 0n], [2, 10n ** 30n]] as const) {
      const og = ogEntity(undefined), out = await handleMintReserves(og, { type: "mintReserves", data: { tokenId, amount } } as any, env, true);
      const rw = mintReservesTx(ENTITY, tokenId, amount, 900);
      expect(rw.jTx).toEqual(out.jOutputs[0]!.jTxs[0] as any);
      expect(rw.note).toBe(messages(og).at(-1));
    }
  });

  test("MATCH: the Host surfaces og's J outputs as effects -- j_broadcast / j_rebroadcast / mintReserves a j_submit (jTx + jBatch hash), a finalized batch with parked work a j_broadcast_request (og finalizePendingBatch self input)", async () => {
    const host0 = unwrap(genesisHost(ALICE, genesisAB()) as any) as any, ctx = { timestamp: 9n, jHeight: 0n };
    const funded = unwrap(applyHost(host0, { layer: "j", tx: { type: "j_event", blockNumber: 1, event: { type: "ReserveUpdated", entity: ALICE, tokenId: 1n, newBalance: 50n } } } as any, ctx, hankoVerify) as any) as any;
    const q1 = unwrap(applyHost(funded.state, { layer: "j", tx: { type: "r2r", toEntity: BOB, tokenId: "1", amount: 20n } } as any, ctx, hankoVerify) as any) as any;
    const sealed = unwrap(applyHost(q1.state, { layer: "j", tx: { type: "j_broadcast", chainId: 31337, depository: DEP, signerId: SIGNER } } as any, ctx, hankoVerify) as any) as any;
    const sent = sealed.state.j.jBatch.sentBatch;
    expect(sealed.effects).toEqual([{ _tag: "j_submit", jTx: expect.objectContaining({ type: "batch", entityId: ALICE }), hashToSign: { hash: sent.batchHash, type: "jBatch", context: `jBatch:${ALICE.slice(-4)}:nonce:1` } }]);
    const parked = unwrap(applyHost(sealed.state, { layer: "j", tx: { type: "r2r", toEntity: BOB, tokenId: "1", amount: 5n } } as any, ctx, hankoVerify) as any) as any;
    const resent = unwrap(applyHost(parked.state, { layer: "j", tx: { type: "j_rebroadcast", chainId: 31337, depository: DEP, signerId: SIGNER, gasBumpBps: 500 } } as any, ctx, hankoVerify) as any) as any;
    expect(resent.effects[0].jTx.data.feeOverrides).toEqual({ gasBumpBps: 500 });
    expect(resent.effects[0].hashToSign.context).toBe(`jBatch:${ALICE.slice(-4)}:nonce:1:rebroadcast`);
    const auto = { ...resent.state.j.jBatch, autoBroadcastDraft: true };
    const event = { type: "HankoBatchProcessed", entityId: ALICE, batchHash: sent.batchHash, nonce: 1n };
    const done = unwrap(applyHost({ ...resent.state, j: { ...resent.state.j, jBatch: auto } }, { layer: "j", tx: { type: "j_event", blockNumber: 2, event } } as any, ctx, hankoVerify) as any) as any;
    const og: any = { entityId: ALICE, timestamp: 9, config: { validators: [SIGNER] }, jBatchState: toOg(auto) }, outputs: any[] = [];
    await applyHankoBatchProcessedEvent({ newState: og, event: { type: "HankoBatchProcessed", data: { entityId: ALICE, batchHash: sent.batchHash, nonce: 1 } } as any, blockNumber: 2, outputs });
    expect(outputs).toEqual([{ entityId: ALICE, signerId: SIGNER, entityTxs: [{ type: "j_broadcast", data: {} }] }]);
    expect(done.effects).toEqual([{ _tag: "j_broadcast_request", entityId: ALICE }]);
    const mint = unwrap(applyHost(done.state, { layer: "j", tx: { type: "mintReserves", tokenId: 1, amount: 7n } } as any, ctx, hankoVerify) as any) as any;
    expect(mint.effects).toEqual([{ _tag: "j_submit", jTx: { type: "mint", entityId: ALICE, data: { entityId: ALICE, tokenId: 1, amount: 7n }, timestamp: 9 } }]);
  });
});
