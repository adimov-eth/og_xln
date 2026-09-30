import { describe, expect, test } from "bun:test";
import {
  EMPTY_DEBTS, applyJ, liveJBatch, createEntity, emptyQueuedBatch, foldTxs, initJBatch, jBroadcast, queueR2R, sentOf,
  type DebtEntry, type DebtLedger, type EntityId, type EntityState, type JBatch, type JState, type JSubmission, type QueuedBatch, type QueuedDeposit,
  type QueuedExternalDeposit, type QueuedSettlement, type QueuedTransfer,
} from "../xln.ts";
import { ALICE, BOB, TERMS, aliceAddr, genesisAB, signedTxs, unwrap, verifiers } from "../xln_run.ts";
import type { AccountReplica } from "../xln.ts";

// R-FUNDED (coordinator rule, 2026-09-30, from the Quint review F14): the planner signs a reserve payment only if the
// reserve covers it at the moment it signs, in every situation, oldest first, skipping a payment that does not fit.
// A payment signed unfunded fails on the chain, takes its nonce and is signed again every round.
// Companion R2C-DEBT-FIRST: spendable reserve is net of all outstanding debt.

const W = (b: string) => `0x${b.repeat(32 / (b.length / 2))}`;
const ENTITY = W("e1"), OTHER = W("aa"), THIRD = W("bb"), DEP = "0x5FbDB2315678afecb367f032d93F642f64180aa3", SIGNER = `0x${"5a".repeat(20)}`;
const TOKEN = 1;

const pay = (receivingEntity: string, amount: bigint): QueuedTransfer => ({ receivingEntity, tokenId: TOKEN, amount });
const draftOf = (r2r: readonly QueuedTransfer[], rest: Partial<QueuedBatch> = {}): JBatch =>
  ({ ...initJBatch(), draft: { ...emptyQueuedBatch(), reserveToReserve: r2r, ...rest } });
const reservesOf = (n: bigint): ReadonlyMap<number, bigint> => new Map([[TOKEN, n]]);
const owing = (amount: bigint): DebtLedger => {
  const entry: DebtEntry = {
    debtId: "d1", tokenId: TOKEN, debtor: ENTITY, creditor: THIRD, counterparty: THIRD, direction: "out",
    createdAmount: amount, paidAmount: 0n, remainingAmount: amount, createdDebtIndex: 0, currentDebtIndex: 0,
    status: "open", createdAtBlock: 1, createdTxHash: W("01"), lastUpdatedBlock: 1, lastUpdatedTxHash: W("01"),
    lastEventType: "DebtCreated",
  };
  return { out: new Map([[TOKEN, new Map([["d1", entry]])]]), in: new Map() };
};
const seal = (j: JBatch, reserve: bigint, debts: DebtLedger = EMPTY_DEBTS) =>
  unwrap(jBroadcast(j, {
    entityId: ENTITY, chainId: 31337, depository: DEP, signerId: SIGNER, timestamp: 5,
    treasury: { reserves: reservesOf(reserve), debts },
  }));
const amounts = (ops: readonly { readonly amount: bigint }[]): readonly bigint[] => ops.map((o) => o.amount);
const live = (j: JSubmission): JBatch => liveJBatch(j);
const signedPayments = (b: { readonly jBatch: JSubmission }): readonly bigint[] => amounts(sentOf(b.jBatch)?.batch.reserveToReserve ?? []);
const waiting = (b: { readonly jBatch: JSubmission }): readonly bigint[] => amounts(live(b.jBatch).draft.reserveToReserve);

describe("R-FUNDED: the planner signs only the payments the reserve covers", () => {
  test("a payment the reserve does not cover is not signed; the later ones that fit are, oldest first", () => {
    const sealed = seal(draftOf([pay(OTHER, 60n), pay(OTHER, 50n), pay(OTHER, 30n)]), 100n);
    expect(signedPayments(sealed)).toEqual([60n, 30n]);
    expect(waiting(sealed)).toEqual([50n]);
    expect(sealed.jTx?.data.batchSize).toBe(2);
  });

  test("the payment that did not fit is signed once the reserve is back", () => {
    const first = seal(draftOf([pay(OTHER, 60n), pay(OTHER, 50n)]), 100n);
    const idle = { ...first.jBatch, phase: { _tag: "idle", accumulating: false } } as JBatch;
    const second = seal(idle, 100n);
    expect(signedPayments(second)).toEqual([50n]);
    expect(waiting(second)).toEqual([]);
  });

  test("when nothing fits nothing is sealed: no J tx, no nonce taken, the draft as it was", () => {
    const j = draftOf([pay(OTHER, 60n), pay(OTHER, 50n)]);
    const sealed = seal(j, 10n);
    expect(sealed.jTx).toBeUndefined();
    expect(sealed.hashToSign).toBeUndefined();
    expect(sealed.jBatch).toEqual(j);
    expect(sealed.note).toContain("reserve");
  });

  test("a batch every payment of which is covered is sealed whole, as before", () => {
    const sealed = seal(draftOf([pay(OTHER, 40n), pay(THIRD, 60n)]), 100n);
    expect(signedPayments(sealed)).toEqual([40n, 60n]);
    expect(waiting(sealed)).toEqual([]);
  });

  test("R2C-DEBT-FIRST: spendable reserve is net of all outstanding debt", () => {
    const sealed = seal(draftOf([pay(OTHER, 50n), pay(OTHER, 20n)]), 100n, owing(70n));
    expect(signedPayments(sealed)).toEqual([20n]);
    expect(waiting(sealed)).toEqual([50n]);
  });

  test("an entity with debt gets no flash credit: a payment beyond spendable is not signed", () => {
    const sealed = seal(draftOf([pay(OTHER, 31n)]), 100n, owing(70n));
    expect(sealed.jTx).toBeUndefined();
  });

  test("a deposit ahead of the payments in the same batch counts as reserve", () => {
    const deposit: QueuedExternalDeposit = {
      entity: ENTITY, contractAddress: `0x${"cc".repeat(20)}`, externalTokenId: 0n, tokenType: 0, internalTokenId: TOKEN, amount: 40n,
    };
    const sealed = seal(draftOf([pay(OTHER, 130n)], { externalTokenToReserve: [deposit] }), 100n);
    expect(signedPayments(sealed)).toEqual([130n]);
    expect(sentOf(sealed.jBatch)?.batch.externalTokenToReserve).toEqual([deposit]);
  });

  test("a collateral deposit is held back too when the payments before it leave too little reserve", () => {
    const r2c = (amount: bigint): QueuedDeposit => ({ tokenId: TOKEN, receivingEntity: ENTITY, pairs: [{ entity: OTHER, amount }] });
    const sealed = seal(draftOf([pay(THIRD, 30n)], { reserveToCollateral: [r2c(80n)] }), 100n);
    expect(signedPayments(sealed)).toEqual([30n]);
    expect(sentOf(sealed.jBatch)?.batch.reserveToCollateral).toEqual([]);
    expect(live(sealed.jBatch).draft.reserveToCollateral).toEqual([r2c(80n)]);
  });

  test("a recovered batch is checked against the reserve of the day it is sealed", () => {
    const stale = { ...initJBatch(), recovery: [{ ...emptyQueuedBatch(), reserveToReserve: [pay(OTHER, 90n)] }] } as JBatch;
    const sealed = seal(stale, 20n);
    expect(sealed.jTx).toBeUndefined();
    expect(live(sealed.jBatch).recovery[0]?.reserveToReserve).toEqual([pay(OTHER, 90n)]);
  });

  const settling = (left: string, right: string, leftDiff: bigint, rightDiff: bigint): QueuedSettlement => ({
    leftEntity: left, rightEntity: right, sig: "0x12", nonce: 1, forgiveDebtsInTokenIds: [],
    diffs: [{ tokenId: TOKEN, leftDiff, rightDiff, collateralDiff: 0n, ondeltaDiff: 0n }],
  });

  test("a settlement that is not ours to fund passes through untouched", () => {
    const foreign = settling(OTHER, THIRD, -80n, 80n);
    const sealed = seal(draftOf([], { settlements: [foreign] }), 0n);
    expect(sentOf(sealed.jBatch)?.batch.settlements).toEqual([foreign]);
  });

  test("a settlement that takes more of our reserve than is left is held back like any other outflow", () => {
    const ours = settling(ENTITY, OTHER, -80n, 80n);
    const sealed = seal(draftOf([pay(THIRD, 30n)], { settlements: [ours] }), 100n);
    expect(signedPayments(sealed)).toEqual([30n]);
    expect(sentOf(sealed.jBatch)?.batch.settlements).toEqual([]);
    expect(live(sealed.jBatch).draft.settlements).toEqual([ours]);
  });
});

describe("R-FUNDED: the two ways a queued payment loses its reserve before it is signed", () => {
  const ctx = { chainId: 31337, depository: DEP, signerId: SIGNER } as const;
  const event = (type: string, fields: Record<string, unknown>) => ({ type: "j_event", blockNumber: 2, event: { type, ...fields } }) as never;
  const host = { timestamp: 9n, jHeight: 2n };

  test("a payment queued behind one in flight is not signed once the first has spent the reserve", () => {
    // queue-time admission reads committed reserves: 100 covers both 100s, because the first has not moved them yet
    const start: JState = { reserves: reservesOf(100n), debts: EMPTY_DEBTS, jBatch: initJBatch() };
    const queued = (j: typeof start, amount: bigint) =>
      unwrap(applyJ(j, { type: "r2r", toEntity: OTHER as EntityId, tokenId: 1 as never, amount }, ENTITY as EntityId, OTHER, host)).j;
    const sealed = (j: typeof start) => unwrap(applyJ(j, { type: "j_broadcast", ...ctx }, ENTITY as EntityId, OTHER, host));
    const first = sealed(queued(start, 100n));
    const second = queued(first.j, 100n);
    const sent = sentOf(second.jBatch)!;
    // the chain runs the first batch: reserve 0, batch processed
    const spent = unwrap(applyJ(second, event("ReserveUpdated", { entity: ENTITY, tokenId: 1n, newBalance: 0n }), ENTITY as EntityId, OTHER, host)).j;
    const done = unwrap(applyJ(spent, event("HankoBatchProcessed", { entityId: ENTITY, batchHash: sent.batchHash, nonce: BigInt(sent.entityNonce) }), ENTITY as EntityId, OTHER, host));
    const next = sealed(done.j);
    expect(next.effects.map((e) => e._tag)).not.toContain("j_submit");
    expect(sentOf(next.j.jBatch)).toBeUndefined();
    expect(next.j.jBatch).toEqual(done.j.jBatch);
  });

  test("the Entity's j_broadcast signs no payment its committed reserve does not cover", () => {
    const state: EntityState = unwrap(createEntity({
      id: ALICE, jurisdiction: TERMS.domain, threshold: 1n, members: new Map([[aliceAddr, { shares: 1n }]]),
      jurisdictionConfig: { name: "j", entityProviderAddress: "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512" }, committed: { reserves: reservesOf(100n) },
    })).state;
    const replicas: ReadonlyMap<EntityId, AccountReplica> = new Map([[BOB, genesisAB() as AccountReplica]]);
    const at = (s: EntityState, txs: readonly unknown[], t: bigint) =>
      unwrap(foldTxs(s, replicas, signedTxs(s, aliceAddr, txs as never), { verify: verifiers.verify, timestamp: t })).draft;
    const queued = at(state, [{ type: "r2r", data: { toEntityId: OTHER, tokenId: 1, amount: 60n } }, { type: "r2r", data: { toEntityId: OTHER, tokenId: 1, amount: 40n } }], 1000n);
    const drained = { ...queued.state, treasury: { ...queued.state.treasury, reserves: reservesOf(50n) } } as EntityState;
    const sealedDraft = at(drained, [{ type: "j_broadcast", data: {} }], 1001n);
    const sent = sentOf(sealedDraft.state.jBatch);
    expect(sent?.batch.reserveToReserve.map((o) => o.amount)).toEqual([40n]);
    expect(live(sealedDraft.state.jBatch).draft.reserveToReserve.map((o) => o.amount)).toEqual([60n]);
  });

  test("queue-time admission is unchanged: one draft, committed reserve, debt netted", () => {
    const e = { entityId: ENTITY, reserves: reservesOf(100n), debts: owing(70n), jBatch: initJBatch(), accounts: new Set<string>() };
    expect(queueR2R(e, OTHER, TOKEN, 31n).ok).toBe(false);
    expect(queueR2R(e, OTHER, TOKEN, 30n).ok).toBe(true);
  });
});
