// Behavioural diff: og Account admission timing (core/account/input/local-tx-admission.ts) and the hub order book inside
// entity consensus (core/entity/consensus/frame/application.ts) vs pure/xln.ts. Every test is MATCH and runs og live.
import { describe, expect, test } from "bun:test";

// ---- og ----
import { applyAccountEnqueue } from "../../core/account/input/local-tx-admission.ts";
import { computeAccountStateRoot } from "../../core/account/commitment/state-root.ts";
import { createEmptyAccountJClaimAccumulator } from "../../core/account/j-claims/j-claim-accumulator.ts";
import { PersistentAccountStateMap } from "../../core/account/state/persistent-state-map.ts";
import { createEmptyEnv } from "../../core/runtime.ts";
import { createAccountConsensusContext } from "../../core/entity/account/account-consensus-context.ts";
import { assertProposeAccountsNowMatchesState } from "../../core/entity/consensus/account/propose-accounts-now-validation.ts";
import { handleProposeAccountsNowEntityTx } from "../../core/entity/tx/handlers/account/propose-accounts-now.ts";
import type { AccountReplica as OgReplica, AccountTx as OgTx } from "../../core/types/account.ts";

// ---- rewrite ----
import { admit, admitAt, applyEntityInput, createEntity, pendingAccountInput, replicaId, tokenId, wireTx, type AccountReplica, type EntityId, type EntityTx, type WireAccountTx } from "../xln.ts";
import { ALICE, BOB, CAROL, NOW, TERMS, aliceAddr, bobAddr, genesisAB, partyIn, unwrap, verifiers } from "../xln_run.ts";

const prng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rng = prng(0xb00c_ad);
const ri = (n: number) => Math.floor(rng() * n);
const pick = <X,>(xs: readonly X[]): X => xs[ri(xs.length)] as X;
const W = (b: string) => `0x${b.repeat(32)}`;
const T = (n: number) => unwrap(tokenId(String(n)));
const LEFT = partyIn(genesisAB(), ALICE).left ? ALICE : BOB, RIGHT = LEFT === ALICE ? BOB : ALICE;

// ============ og fixture (as diff/account-consensus.test.ts, with the rewrite's pair as its entities) ============
const ogDomain = { chainId: 31_337, depositoryAddress: `0x${"44".repeat(20)}` };
const ogAccount = (local: string, peer: string, lastFinalizedJHeight = 0): OgReplica => {
  const a = {
    state: {
      leftEntity: local < peer ? local : peer, rightEntity: local < peer ? peer : local, domain: { ...ogDomain }, watchSeed: W("33"),
      deltas: PersistentAccountStateMap.empty("deltas"), locks: PersistentAccountStateMap.empty("locks"), swapOffers: PersistentAccountStateMap.empty("swapOffers"),
      pulls: PersistentAccountStateMap.empty("pulls"), leftPendingJClaims: createEmptyAccountJClaimAccumulator(), rightPendingJClaims: createEmptyAccountJClaimAccumulator(),
      lastFinalizedJHeight, disputeConfig: { leftResponseSeconds: 10, rightResponseSeconds: 10 }, jNonce: 0,
      requestedRebalance: PersistentAccountStateMap.empty("requestedRebalance"), requestedRebalanceFeeState: PersistentAccountStateMap.empty("requestedRebalanceFeeState"),
    },
    status: "active", mempool: [],
    currentFrame: { height: 0, timestamp: 0, jHeight: 0, accountTxs: [], prevFrameHash: "", accountStateRoot: "", deltas: [], stateHash: "", byLeft: local < peer },
    currentHeight: 0, rollbackCount: 0, proofHeader: { fromEntity: local, toEntity: peer, nextProofNonce: 1 },
    pendingWithdrawals: PersistentAccountStateMap.empty("pendingWithdrawals"),
    shadow: { rebalance: { policy: PersistentAccountStateMap.empty("rebalanceShadowPolicy"), submittedAtByToken: PersistentAccountStateMap.empty("rebalanceShadowSubmitted") } },
  } as unknown as OgReplica;
  a.currentFrame.accountStateRoot = computeAccountStateRoot(a.state);
  return a;
};
const env = createEmptyEnv("book-admission");
env.quietRuntimeLogs = true;
const store = createAccountConsensusContext(env).jClaimNodeStore;
type OgRun = { readonly ok: true; readonly mempool: readonly unknown[] } | { readonly ok: false };
const ogEnqueue = (a: OgReplica, txs: readonly OgTx[]): OgRun => {
  try {
    const r = applyAccountEnqueue(a, { kind: "enqueue", txs: [...txs] }, store);
    return r.ok ? { ok: true, mempool: a.mempool } : { ok: false };
  } catch { return { ok: false }; }
};

// ============ random txs: rewrite shape, og wire via the rewrite's own og projection ============
const offer = (i: number): WireAccountTx => ({ type: "swap_offer", offerId: `o${i}`, giveTokenId: T(1), giveTokenDecimals: 18, giveAmount: BigInt(ri(5)) * 10n ** 15n, wantTokenId: T(pick([1, 2])), wantTokenDecimals: 18,
  wantAmount: BigInt(1 + ri(9)) * 10n ** 15n, maxFee: 0n, minNetReceive: BigInt(ri(3)), ...(ri(2) === 0 ? { priceTicks: BigInt(ri(99_999)) } : {}) }) as WireAccountTx;
const randomTx = (i: number): WireAccountTx => pick<() => WireAccountTx>([
  () => ({ type: "payment", tokenId: T(1 + ri(2)), amount: BigInt(ri(4)) * 10n ** 18n, route: [pick([LEFT, RIGHT])] }) as WireAccountTx,
  () => ({ type: "set_credit_limit", tokenId: T(1 + ri(2)), limit: BigInt(ri(3)) }) as WireAccountTx,
  () => ({ type: "add_delta", tokenId: T(1 + ri(3)) }) as WireAccountTx,
  () => offer(ri(3)),
  () => ({ type: "swap_cancel_request", offerId: `o${ri(3)}` }) as WireAccountTx,
  () => ({ type: "swap_resolve", offerId: `o${ri(3)}`, fillRatio: ri(70_000), cancelRemainder: ri(2) === 0 }) as WireAccountTx,
  () => ({ type: "htlc_lock", lockId: `l${ri(2)}`, hashlock: W("ab"), timelock: BigInt(ri(3)), revealBeforeHeight: BigInt(ri(3)), amount: BigInt(ri(3)), tokenId: T(1) }) as WireAccountTx,
  () => ({ type: "rebalance_policy", tokenId: T(1), policyVersion: pick([0, 1, 2, -1, 1.5]), baseFee: 0n, liquidityFeeBps: 0n, gasFee: 0n }) as WireAccountTx,
])();
const ogOf = (r: AccountReplica, self: EntityId, tx: WireAccountTx): OgTx => unwrap(wireTx(tx, replicaId(r), partyIn(r, self).left)) as unknown as OgTx;

describe("book-admission: og applyAccountEnqueue timing (local-tx-admission.ts)", () => {
  test("MATCH: 300 random batches (unfunded payments, malformed swaps, expired HTLCs, repeated lifecycle txs): og queues without validation, dedups lifecycle payloads against mempool, keeps payment multiplicity, refuses the whole batch only on policyVersion", () => {
    let refused = 0, deduped = 0;
    for (let n = 0; n < 300; n++) {
      const self = pick([ALICE, BOB]), peer = self === ALICE ? BOB : ALICE;
      const og = ogAccount(self, peer);
      let rw: AccountReplica = genesisAB();
      for (let b = 0; b < 3; b++) {
        const batch = Array.from({ length: 1 + ri(4) }, (_, i) => randomTx(i));
        const o = ogEnqueue(og, batch.map((tx) => ogOf(rw, self, tx)));
        const r = admit(rw, batch, self);
        expect(r.ok).toBe(o.ok);
        if (!o.ok || !r.ok) { refused++; continue; }
        if (r.value.mempool.length - rw.mempool.length < batch.length) deduped++;
        rw = r.value;
        expect(rw.mempool.map((tx) => ogOf(rw, self, tx))).toEqual(o.mempool as never);
      }
    }
    expect(refused).toBeGreaterThan(20);
    expect(deduped).toBeGreaterThan(20);
  });

  test("MATCH: the Entity lane (admitAt) queues the same bytes; a frozen Account silently takes nothing (og shouldSuppressReturnedAccountTx)", () => {
    for (let n = 0; n < 60; n++) {
      const batch = Array.from({ length: 1 + ri(3) }, (_, i) => randomTx(i)).filter((tx) => tx.type !== "rebalance_policy");
      const og = ogAccount(ALICE, BOB), rw = genesisAB();
      const o = ogEnqueue(og, batch.map((tx) => ogOf(rw, ALICE, tx)));
      const r = unwrap(admitAt(rw, batch, ALICE));
      expect(o.ok).toBe(true);
      if (o.ok) expect(r.mempool.map((tx) => ogOf(rw, ALICE, tx))).toEqual(o.mempool as never);
    }
    const frozen = { ...genesisAB(), _tag: "disputed" } as unknown as AccountReplica;
    expect(unwrap(admitAt(frozen, [randomTx(0)], ALICE))).toBe(frozen);
    expect(admitAt(genesisAB(), [randomTx(0)], CAROL).ok).toBe(false);
  });

  test("MATCH: j_event_claim admission (og planAccountJClaimLocalAdmission): at or below the finalized height is a duplicate, the same queued claim is a duplicate, a different queued claim at that height is a row conflict; malformed events refuse the batch", () => {
    const claimRw = (h: number, blk: string, nonce: number, tokens: readonly number[]): WireAccountTx => ({ type: "j_event_claim", jHeight: BigInt(h), jBlockHash: blk, observedAt: 1n, events: tokens.length === 0 ? [] : [{ left: LEFT, right: RIGHT, nonce: BigInt(nonce),
      tokens: tokens.map((t, i) => ({ tokenId: BigInt(t), leftReserve: 0n, rightReserve: 0n, collateral: BigInt(t * 3), ondelta: 1n, ...(tokens.length > 1 ? { eventIndex: tokens.length - 1 - i } : {}) })) }] }) as unknown as WireAccountTx;
    const claimOg = (h: number, blk: string, nonce: number, tokens: readonly number[]): OgTx => ({ type: "j_event_claim", data: { jHeight: h, jBlockHash: blk, events: tokens.map((t, i) => ({ ...(tokens.length > 1 ? { eventIndex: tokens.length - 1 - i } : {}), type: "AccountSettled",
      data: { leftEntity: LEFT, rightEntity: RIGHT, tokenId: t, leftReserve: "0", rightReserve: "0", collateral: String(t * 3), ondelta: "1", nonce } })) } }) as unknown as OgTx;
    let conflicts = 0, dups = 0, bad = 0;
    for (let n = 0; n < 200; n++) {
      const self = pick([ALICE, BOB]), peer = self === ALICE ? BOB : ALICE, fin = ri(2);
      const og = ogAccount(self, peer, fin);
      let rw: AccountReplica = genesisAB();
      rw = { ...rw, state: { ...rw.state, finalizedJHeight: BigInt(fin) } } as AccountReplica;
      for (let b = 0; b < 2; b++) {
        const cases = Array.from({ length: 1 + ri(3) }, () => ({ h: 1 + ri(3), blk: W(pick(["0a", "0b"])), nonce: ri(2), tokens: ri(12) === 0 ? [] : [1 + ri(2)] }));
        const o = ogEnqueue(og, cases.map((c) => claimOg(c.h, c.blk, c.nonce, c.tokens)));
        const r = admit(rw, cases.map((c) => claimRw(c.h, c.blk, c.nonce, c.tokens)), self);
        expect(r.ok).toBe(o.ok);
        if (!o.ok || !r.ok) { bad++; continue; }
        const added = r.value.mempool.length - rw.mempool.length;
        if (added < cases.length) (cases.some((c) => c.h <= fin) ? dups++ : conflicts++);
        rw = r.value;
        expect(rw.mempool.map((tx) => (tx.type === "j_event_claim" ? [Number(tx.jHeight), tx.jBlockHash] : []))).toEqual(o.mempool.map((tx) => [(tx as { data: { jHeight: number } }).data.jHeight, (tx as { data: { jBlockHash: string } }).data.jBlockHash]));
      }
    }
    expect(conflicts).toBeGreaterThan(10);
    expect(dups).toBeGreaterThan(10);
    expect(bad).toBeGreaterThan(5);
  });
});

// ============ og proposeAccountsNow (entity/tx/handlers/account/propose-accounts-now.ts) ============
describe("book-admission: proposeAccountsNow re-emits og pendingAccountInput bytes", () => {
  const ctx = { ...verifiers, self: ALICE, signerId: aliceAddr };
  const ogState = (accounts: ReadonlyMap<string, unknown>) => ({ entityId: ALICE, height: 0, prevFrameHash: "", config: { validators: [aliceAddr], shares: { [aliceAddr]: 1n }, threshold: 1n, mode: "proposer-based" }, accounts }) as never;
  const marker = (data: object): EntityTx => ({ type: "proposeAccountsNow", data } as EntityTx);
  const alone = () => unwrap(createEntity({ id: ALICE, jurisdiction: TERMS.domain, threshold: 1n, members: new Map([[aliceAddr, { shares: 1n }]]) }));
  test("MATCH: 300 random markers: og assertProposeAccountsNowMatchesState throws iff the rewrite refuses the whole input, with og's code", () => {
    const ids = [BOB, CAROL, W("0d"), W("0e")].map((x) => x.toLowerCase()).sort();
    const opened = unwrap(applyEntityInput(alone(), { kind: "txs", timestamp: NOW, txs: [] }, ctx)).replica;
    let refused = 0, accepted = 0;
    for (let i = 0; i < 300; i++) {
      const n = pick([0, 1, 2, 3, 1001]);
      let cps: unknown[] = n === 1001 ? Array.from({ length: 1001 }, (_, k) => `0x${k.toString(16).padStart(64, "0")}`) : Array.from({ length: n }, () => pick(ids));
      if (n < 1001 && ri(2) === 0) cps = [...new Set(cps as string[])].sort();
      if (ri(10) === 0) cps = cps.map((c) => (typeof c === "string" ? c.toUpperCase().replace("0X", "0x") : c));
      if (ri(15) === 0) cps = [...cps, 7];
      if (ri(15) === 0) cps = ["", ...cps];
      const data = { version: pick([1, 1, 1, 2]), proposerSignerId: pick([aliceAddr, aliceAddr.toUpperCase().replace("0X", "0x"), bobAddr]), counterparties: cps };
      let og: string | undefined;
      try { assertProposeAccountsNowMatchesState(ogState(new Map()), { type: "proposeAccountsNow", data } as never); } catch (e) { og = (e as Error).message; }
      const rw = applyEntityInput(opened, { kind: "txs", timestamp: NOW + 1n, txs: [marker(data)] }, ctx);
      if (og !== undefined) {
        refused++;
        expect(rw.ok).toBe(false);
        if (!rw.ok) expect(rw.error).toEqual({ _tag: "entity_invariant", reason: og } as never);
      } else {
        accepted++;
        expect(rw.ok).toBe(true);
        if (rw.ok) expect(rw.value.outputs).toEqual([]);
      }
    }
    expect(refused).toBeGreaterThan(50);
    expect(accepted).toBeGreaterThan(30);
  });

  test("MATCH: a proposed Account re-emits the exact ack_frame it sent (og cloneIsolatedAccountInput(pendingAccountInput)); an Account without one is owed nothing", () => {
    const openBob: EntityTx = { type: "openAccount", data: { targetEntityId: BOB, accountDomain: TERMS.domain, watchSeed: TERMS.watchSeed, disputeConfig: TERMS.disputeConfig } };
    const first = unwrap(applyEntityInput(alone(), { kind: "txs", timestamp: NOW, txs: [openBob] }, ctx));
    const sent = first.outputs.filter((o) => "tx" in o && o.tx.data.kind === "ack_frame");
    expect(sent.length).toBe(1);
    const child = first.replica.accountReplicas.get(BOB);
    expect(child?._tag).toBe("proposed");
    expect(pendingAccountInput(child as AccountReplica, ALICE)).toEqual((sent[0] as { tx: { data: unknown } }).tx.data as never);
    // og: the handler hands back a clone of the retained bytes for every listed counterparty holding one, in list order
    const ogPending = { kind: "ack_frame", fromEntityId: ALICE, toEntityId: BOB, domain: ogDomain, disputeConfig: { leftResponseSeconds: 10, rightResponseSeconds: 10 }, watchSeed: W("33"),
      proposal: { frame: { height: 1, timestamp: 1, jHeight: 0, accountTxs: [], prevFrameHash: "genesis", accountStateRoot: W("01"), stateHash: W("02") } } };
    const listed = [BOB, CAROL].map((x) => x.toLowerCase()).sort();
    const og = handleProposeAccountsNowEntityTx(ogState(new Map([[BOB.toLowerCase(), { pendingAccountInput: ogPending }], [CAROL.toLowerCase(), {}]])), { type: "proposeAccountsNow", data: { version: 1, proposerSignerId: aliceAddr, counterparties: listed } } as never);
    expect(og.accountInputWorks.map((w) => [w.accountId, w.force, w.response])).toEqual([[BOB.toLowerCase(), true, ogPending]]);
    const again = unwrap(applyEntityInput(first.replica, { kind: "txs", timestamp: NOW + 1n, txs: [marker({ version: 1, proposerSignerId: aliceAddr, counterparties: listed })] }, ctx));
    expect(again.outputs.filter((o) => "tx" in o)).toEqual(sent);
    expect(again.replica.accountReplicas.get(BOB)).toEqual(child);
  });
});
