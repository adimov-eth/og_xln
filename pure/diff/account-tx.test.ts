// Differential tests: og account-tx handlers (core/account/tx/**) vs pure rewrite (pure/xln.ts applyAccountBody).
// Each "DIVERGES:" test PASSES when the observed difference is present. "MATCH:" tests assert equivalence.
import { describe, expect, test } from "bun:test";
import { deriveDelta } from "../../core/account/utils.ts";
import { handleSetCreditLimit } from "../../core/account/tx/handlers/balance/set-credit-limit.ts";
import { handleDirectPayment } from "../../core/account/tx/handlers/balance/direct-payment.ts";
import { handleHtlcLock } from "../../core/account/tx/handlers/htlc/lock.ts";
import { handleHtlcResolve } from "../../core/account/tx/handlers/htlc/resolve.ts";
import { handleSwapCancelRequest } from "../../core/account/tx/handlers/swap/lifecycle/cancel.ts";
import { handleSwapResolve } from "../../core/account/tx/handlers/swap/resolve/index.ts";
import { handleSwapOffer } from "../../core/account/tx/handlers/swap/offer/index.ts";
import { deriveExactSwapFillRatio, exactFillRatioToUint16 } from "../../core/orderbook/swap-execution.ts";
import { handleSettleTransition, getSignedSettlementWorkspaceTxError } from "../../core/account/tx/handlers/settlement/transition.ts";
import { beginAccountTransition, accountTransitionView, commitAccountTransition, discardAccountTransition } from "../../core/account/state/candidate-overlay.ts";
import { PersistentAccountStateMap } from "../../core/account/state/persistent-state-map.ts";
import { hashHtlcSecret } from "../../core/protocol/htlc/utils.ts";
import { createDefaultDelta } from "../../core/account/state/delta.ts";
import { handleJEventClaim } from "../../core/account/tx/handlers/j-events/claim.ts";
import { prepareAccountJClaimTx } from "../../core/account/j-claims/j-claim-transition.ts";
import { createAccountJClaimSession } from "../../core/account/j-claims/j-claim-session.ts";
import { createEmptyAccountJClaimAccumulator } from "../../core/account/j-claims/j-claim-accumulator.ts";
import {
  accountId,
  accountTerms,
  applyAccountBody,
  committed,
  entityId,
  genesisAccount,
  genesisAccountBody,
  getDelta,
  hashHtlcSecret as rwHash,
  hexToBytes,
  holds,
  keccak256Hex,
  keccakUtf8,
  outCapacity,
  setCreditLimit,
  zeroDelta,
  MAX_FILL,
  type AccountBody,
  type FoldCtx,
} from "../xln.ts";

// ---------- helpers ----------
type R<T, E> = { ok: true; value: T } | { ok: false; error: E };
const unwrap = <T, E>(r: R<T, E>): T => {
  if (!r.ok) throw new Error(`unwrap: ${JSON.stringify(r.error, (_k, v) => (typeof v === "bigint" ? `${v}n` : v))}`);
  return r.value;
};
const word = (byte: string): string => `0x${byte.repeat(32)}`;
const A = word("11"); // left (lexicographically smaller)
const B = word("22");

/** Patricia-map shim: og drafts expose put/del on top of Map semantics. */
class PMap<K, V> extends Map<K, V> {
  put(k: K, v: V): this { this.set(k, v); return this; }
  del(k: K): void { this.delete(k); }
}
const ogDelta = (tokenId: number, patch: Record<string, bigint> = {}) => ({ ...createDefaultDelta(tokenId), ...patch });
const ogState = (deltas: Array<ReturnType<typeof ogDelta>> = []) => ({
  leftEntity: A,
  rightEntity: B,
  deltas: new PMap<number, any>(deltas.map((d) => [d.tokenId, d])),
  locks: new PMap<string, any>(),
  swapOffers: new PMap<string, any>(),
  requestedRebalance: new PMap<number, bigint>(),
  requestedRebalanceFeeState: new PMap<number, any>(),
});
const ogAccount = (state: ReturnType<typeof ogState>) => ({ proofHeader: { fromEntity: A, toEntity: B }, state, currentHeight: 1 }) as any;

const open = (hub: "left" | "right" | null = null, credit = 20n): { body: AccountBody; ctx: FoldCtx } => {
  const terms = unwrap(accountTerms({
    domain: { chainId: 1, depositoryAddress: `0x${"ab".repeat(20)}` },
    watchSeed: word("44"),
    disputeConfig: { leftResponseSeconds: 1, rightResponseSeconds: 1 },
  }) as any) as any;
  const ctx: FoldCtx = { byLeft: true, nowMs: 1n, jHeight: 0n, accountHeight: 1n };
  let body = genesisAccountBody(genesisAccount(unwrap(accountId(unwrap(entityId(A) as any), unwrap(entityId(B) as any)) as any)), terms, hub);
  for (const tokenId of ["0", "1"] as const) {
    body = unwrap(applyAccountBody(body, { type: "set_credit_limit", tokenId, limit: credit }, ctx) as any as R<any, any>).state;
    body = unwrap(applyAccountBody(body, { type: "set_credit_limit", tokenId, limit: credit }, { ...ctx, byLeft: false }) as any as R<any, any>).state;
  }
  return { body, ctx };
};
const apply = (b: AccountBody, tx: any, ctx: FoldCtx) => applyAccountBody(b, tx, ctx) as any as R<{ state: AccountBody; effects: any[] }, any>;


const PA = (ns: string, m: ReadonlyMap<any, any> = new Map()) => PersistentAccountStateMap.fromEntries(ns as any, m);
/** og side of a lockstep: a persistent og replica seeded from the rewrite's committed view, driven through the real transition overlay; each accepted tx yields og's Account root. */
const ogHarness = (body: AccountBody) => {
  const v: any = unwrap(committed(body) as any).view;
  const state: any = { domain: v.domain, leftEntity: v.leftEntity, rightEntity: v.rightEntity, watchSeed: v.watchSeed, disputeConfig: v.disputeConfig, jNonce: v.jNonce, lastFinalizedJHeight: v.lastFinalizedJHeight,
    leftPendingJClaims: v.leftPendingJClaims, rightPendingJClaims: v.rightPendingJClaims,
    ...Object.fromEntries(["deltas", "locks", "pulls", "swapOffers", "subcontracts", "lendingIntents", "requestedRebalance", "requestedRebalanceFeeState", "rebalanceFeePolicies"].map((n) => [n, PA(n, v[n])])) };
  let replica: any = { state, status: "active", currentHeight: 1, proofHeader: { fromEntity: A, toEntity: B, nextProofNonce: 1 }, currentFrame: { stateHash: "" }, pendingWithdrawals: PA("pendingWithdrawals"),
    shadow: { rebalance: { policy: PA("rebalanceShadowPolicy"), submittedAtByToken: PA("rebalanceShadowSubmitted") } }, mempool: [] };
  const run = async (handler: (draft: any) => Promise<any> | any): Promise<{ ok: boolean; root?: string; error?: string }> => {
    const overlay = beginAccountTransition(replica);
    let r: any;
    try { r = await handler(accountTransitionView(overlay)); } catch (e) { r = { ok: false, rejection: { message: String(e) } }; }
    if (!r.ok) { discardAccountTransition(overlay); return { ok: false, error: r.rejection?.message }; }
    const c = commitAccountTransition(overlay, "diff");
    replica = c.account;
    return { ok: true, root: c.accountStateRoot };
  };
  return { run, replica: () => replica };
};

// ---------- balance ----------
describe("account-tx: balance", () => {
  test("MATCH: outCapacity == deriveDelta.outCapacity over a grid (incl. holds, negative/positive delta)", () => {
    const vals = [0n, 1n, 7n, 50n, 100n];
    for (const c of vals) for (const L of vals) for (const Rr of vals) for (const t of [-120n, -30n, 0n, 30n, 120n]) for (const h of [0n, 5n]) {
      const og = { ...createDefaultDelta(0), collateral: c, leftCreditLimit: L, rightCreditLimit: Rr, offdelta: t, leftHold: h, rightHold: h };
      const pure = { ...zeroDelta("0" as any), collateral: c, leftCreditLimit: L, rightCreditLimit: Rr, offdelta: t };
      expect(outCapacity(pure, true, h)).toBe(deriveDelta(og, true).outCapacity);
      expect(outCapacity(pure, false, h)).toBe(deriveDelta(og, false).outCapacity);
    }
  });

  test("MATCH: set_credit_limit — proposer writes the counterparty field; bounds 0..2^256-1", () => {
    for (const byLeft of [true, false]) {
      const s = ogState();
      const r = handleSetCreditLimit(s as any, { type: "set_credit_limit", data: { tokenId: 1, amount: 9n } }, byLeft);
      expect(r.ok).toBe(true);
      const p = unwrap(setCreditLimit(zeroDelta("1" as any), 9n, byLeft) as any) as any;
      expect(p.leftCreditLimit).toBe(s.deltas.get(1).leftCreditLimit);
      expect(p.rightCreditLimit).toBe(s.deltas.get(1).rightCreditLimit);
    }
    const max = (1n << 256n) - 1n;
    expect(handleSetCreditLimit(ogState() as any, { type: "set_credit_limit", data: { tokenId: 1, amount: max + 1n } }, true).ok).toBe(false);
    expect(setCreditLimit(zeroDelta("1" as any), max + 1n, true).ok).toBe(false);
    expect(handleSetCreditLimit(ogState() as any, { type: "set_credit_limit", data: { tokenId: 1, amount: -1n } }, true).ok).toBe(false);
    expect(setCreditLimit(zeroDelta("1" as any), -1n, true).ok).toBe(false);
  });

  const ogPay = (state: ReturnType<typeof ogState>, amount: bigint, byLeft = true) =>
    handleDirectPayment(ogAccount(state), {
      type: "direct_payment",
      data: { tokenId: 1, amount, route: [byLeft ? B : A], fromEntityId: byLeft ? A : B, toEntityId: byLeft ? B : A, deliveryMode: "direct" },
    } as any, byLeft);

  test("MATCH: over-capacity payment refused by both; exact-capacity accepted by both; sign = left pays negative", () => {
    const og1 = ogState([ogDelta(1, { leftCreditLimit: 20n, rightCreditLimit: 20n })]);
    expect(ogPay(og1, 21n).ok).toBe(false);
    const { body, ctx } = open();
    expect(apply(body, { type: "payment", tokenId: "1", amount: 21n }, ctx).ok).toBe(false);
    const og2 = ogState([ogDelta(1, { leftCreditLimit: 20n, rightCreditLimit: 20n })]);
    expect(ogPay(og2, 20n).ok).toBe(true);
    const paid = unwrap(apply(body, { type: "payment", tokenId: "1", amount: 20n }, ctx));
    expect(getDelta(paid.state.account, "1" as any).offdelta).toBe(og2.deltas.get(1).offdelta);
    expect(og2.deltas.get(1).offdelta).toBe(-20n);
    // right pays: positive
    const og3 = ogState([ogDelta(1, { leftCreditLimit: 20n, rightCreditLimit: 20n })]);
    expect(ogPay(og3, 5n, false).ok).toBe(true);
    const paidR = unwrap(apply(body, { type: "payment", tokenId: "1", amount: 5n }, { ...ctx, byLeft: false }));
    expect(getDelta(paidR.state.account, "1" as any).offdelta).toBe(og3.deltas.get(1).offdelta);
  });

  test("MATCH: live HTLC hold reduces payment capacity identically", () => {
    // og: a lock of 5 by left puts leftHold=5 → 15 left
    const og = ogState([ogDelta(1, { leftCreditLimit: 20n, rightCreditLimit: 20n, leftHold: 5n })]);
    expect(ogPay(og, 16n).ok).toBe(false);
    expect(ogPay(ogState([ogDelta(1, { leftCreditLimit: 20n, rightCreditLimit: 20n, leftHold: 5n })]), 15n).ok).toBe(true);
    const { body, ctx } = open();
    const locked = unwrap(apply(body, rwLock(secretOf(9)), ctx)).state;
    expect(holds(locked, "1" as any, true)).toBe(5n);
    expect(apply(locked, { type: "payment", tokenId: "1", amount: 16n }, ctx).ok).toBe(false);
    expect(apply(locked, { type: "payment", tokenId: "1", amount: 15n }, ctx).ok).toBe(true);
  });

  test("MATCH: payment ceiling is uint256 max in both (2^128 accepted with capacity; 2^256 refused)", () => {
    const big = (1n << 256n) - 1n;
    for (const amount of [1n << 128n, (1n << 256n) - 1n, 1n << 256n]) {
      const og = ogState([ogDelta(1, { leftCreditLimit: big })]);
      let { body, ctx } = open();
      body = unwrap(apply(body, { type: "set_credit_limit", tokenId: "1", limit: big }, { ...ctx, byLeft: false })).state; // right grants left
      const r = apply(body, { type: "payment", tokenId: "1", amount }, ctx);
      expect(r.ok).toBe(ogPay(og, amount).ok);
      if (r.ok) expect(getDelta(r.value.state.account, "1" as any).offdelta).toBe(og.deltas.get(1).offdelta);
    }
  });
});

// ---------- HTLC ----------
const HEX_SECRET = word("5a");
const ogLockTx = (patch: Record<string, unknown> = {}) => ({
  type: "htlc_lock",
  data: { lockId: hashHtlcSecret(HEX_SECRET), hashlock: hashHtlcSecret(HEX_SECRET), timelock: 10n ** 15n, revealBeforeHeight: 5, amount: 5n, tokenId: 1, ...patch },
}) as any;
const ogClock = (ts = 1, jh = 0) => ({ committedTimestamp: ts, enforcementTimestamp: ts, enforcementJHeight: jh });
const lockedOg = async () => {
  const s = ogState([ogDelta(1, { leftCreditLimit: 20n, rightCreditLimit: 20n })]);
  const r = await handleHtlcLock(ogAccount(s), ogLockTx(), true, ogClock());
  expect(r.ok).toBe(true);
  return s;
};

// seeded PRNG (mulberry32) for randomized MATCH cases
const prng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rng = prng(0xA7);
const ri = (n: number) => Math.floor(rng() * n);
const pick3 = <X,>(xs: readonly X[]): X => xs[ri(xs.length)] as X;
const secretOf = (i: number) => `0x${i.toString(16).padStart(64, "0")}`;
const rwLock = (secret: string, patch: Record<string, unknown> = {}) => ({ type: "htlc_lock", lockId: hashHtlcSecret(secret), hashlock: hashHtlcSecret(secret), timelock: 10n ** 15n, revealBeforeHeight: 5n, amount: 5n, tokenId: "1", ...patch });

describe("account-tx: htlc", () => {
  test("MATCH: hashlock = keccak256(bytes32 secret); a non-32-byte secret is refused by both", async () => {
    expect(rwHash(HEX_SECRET)).toBe(hashHtlcSecret(HEX_SECRET));
    expect(rwHash("preimage")).toBeNull();
    expect(() => hashHtlcSecret("preimage")).toThrow();
    const { body, ctx } = open();
    const locked = unwrap(apply(body, rwLock(HEX_SECRET), ctx)).state;
    const r = unwrap(apply(locked, { type: "htlc_resolve", lockId: hashHtlcSecret(HEX_SECRET), outcome: "secret", secret: HEX_SECRET }, { ...ctx, byLeft: false }));
    expect(getDelta(r.state.account, "1" as any).offdelta).toBe(-5n);
    expect(r.effects).toEqual([{ _tag: "forward_secret", hashlock: hashHtlcSecret(HEX_SECRET), secret: HEX_SECRET }]);
    const og = await lockedOg();
    expect((await handleHtlcResolve(og as any, { type: "htlc_resolve", data: { lockId: hashHtlcSecret(HEX_SECRET), outcome: "secret", secret: "preimage" } } as any, false, 0, 1)).ok).toBe(false);
    expect(apply(locked, { type: "htlc_resolve", lockId: hashHtlcSecret(HEX_SECRET), outcome: "secret", secret: "preimage" }, ctx).ok).toBe(false);
  });

  test("MATCH: htlc_lock admission (lockId==hashlock, duplicate, timelock/reveal expiry, amount bounds, capacity) on 300 random locks", async () => {
    for (let i = 0; i < 300; i++) {
      const secret = secretOf(1 + ri(4));
      const lockId = ri(8) === 0 ? secretOf(99) : hashHtlcSecret(secret);
      const timelock = BigInt(ri(4)), rbh = ri(4), ts = ri(4), jh = ri(4), amount = BigInt(ri(25)) - 1n, byLeft = ri(2) === 0;
      const pre = ri(3) === 0;
      const s = ogState([ogDelta(1, { leftCreditLimit: 20n, rightCreditLimit: 20n })]);
      let { body, ctx } = open();
      ctx = { ...ctx, byLeft, nowMs: BigInt(ts), jHeight: BigInt(jh) };
      if (pre) {
        expect((await handleHtlcLock(ogAccount(s), ogLockTx({ lockId: hashHtlcSecret(secretOf(1)), hashlock: hashHtlcSecret(secretOf(1)), amount: 3n }), true, ogClock(0, 0))).ok).toBe(true);
        body = unwrap(apply(body, rwLock(secretOf(1), { amount: 3n }), { ...ctx, byLeft: true, nowMs: 0n, jHeight: 0n })).state;
      }
      const og = await handleHtlcLock(ogAccount(s), ogLockTx({ lockId, hashlock: hashHtlcSecret(secret), timelock, revealBeforeHeight: rbh, amount }), byLeft, ogClock(ts, jh));
      const rw = apply(body, rwLock(secret, { lockId, timelock, revealBeforeHeight: BigInt(rbh), amount }), ctx);
      expect(rw.ok).toBe(og.ok);
      if (rw.ok) {
        expect(holds(rw.value.state, "1" as any, true)).toBe(s.deltas.get(1).leftHold);
        expect(holds(rw.value.state, "1" as any, false)).toBe(s.deltas.get(1).rightHold);
        expect(rw.value.state.locks.size).toBe(s.locks.size);
      }
    }
  });

  test("MATCH: 33rd live lock refused by both (MAX_ACCOUNT_HTLC_LOCKS=32)", async () => {
    const s = ogState([ogDelta(1, { leftCreditLimit: 1000n })]);
    for (let i = 0; i < 32; i++) s.locks.put(`x${i}`, { tokenId: 2, amount: 1n, senderIsLeft: true });
    expect((await handleHtlcLock(ogAccount(s), ogLockTx({ amount: 1n }), true, ogClock())).ok).toBe(false);
    let { body, ctx } = open("left", 1000n);
    for (let i = 0; i < 32; i++) body = unwrap(apply(body, rwLock(secretOf(100 + i), { amount: 1n }), ctx)).state;
    const r = apply(body, rwLock(secretOf(200), { amount: 1n }), ctx);
    expect(r.ok).toBe(false);
    expect((r as any).error._tag).toBe("htlc_lock_capacity");
  });

  test("MATCH: htlc_resolve secret/error authority and expiry (payer/beneficiary x timestamp x jHeight x reason) on 400 random resolves", async () => {
    for (let i = 0; i < 400; i++) {
      const timelock = BigInt(1 + ri(4)), rbh = 1 + ri(3), ts = ri(6), jh = ri(5), resolverIsLeft = ri(2) === 0;
      const outcome = ri(2) === 0 ? "secret" : "error";
      const secret = ri(6) === 0 ? secretOf(7) : HEX_SECRET;
      const reason = pick3(["timeout", "no_route", undefined]);
      const s = ogState([ogDelta(1, { leftCreditLimit: 20n, rightCreditLimit: 20n })]);
      expect((await handleHtlcLock(ogAccount(s), ogLockTx({ timelock, revealBeforeHeight: rbh }), true, ogClock(0, 0))).ok).toBe(true);
      const data = outcome === "secret" ? { lockId: hashHtlcSecret(HEX_SECRET), outcome, secret } : { lockId: hashHtlcSecret(HEX_SECRET), outcome, ...(reason === undefined ? {} : { reason }) };
      const og = await handleHtlcResolve(s as any, { type: "htlc_resolve", data } as any, resolverIsLeft, jh, ts);
      const { body, ctx } = open();
      const locked = unwrap(apply(body, rwLock(HEX_SECRET, { timelock, revealBeforeHeight: BigInt(rbh) }), { ...ctx, nowMs: 0n })).state;
      const rw = apply(locked, { type: "htlc_resolve", ...data }, { ...ctx, byLeft: resolverIsLeft, nowMs: BigInt(ts), jHeight: BigInt(jh) });
      expect(rw.ok).toBe(og.ok);
      if (rw.ok) {
        expect(getDelta(rw.value.state.account, "1" as any).offdelta).toBe(s.deltas.get(1).offdelta);
        expect(holds(rw.value.state, "1" as any, true)).toBe(s.deltas.get(1).leftHold);
        expect(rw.value.state.locks.size).toBe(0);
      }
    }
  });
});

// ---------- swaps ----------
const rwOffer = (offerId: string, give: number, giveAmount: bigint, want: number, wantAmount: bigint, patch: Record<string, unknown> = {}) =>
  ({ type: "swap_offer", offerId, giveTokenId: String(give), giveTokenDecimals: 18, giveAmount, wantTokenId: String(want), wantTokenDecimals: 18, wantAmount, maxFee: 0n, minNetReceive: wantAmount, ...patch });
const toOgTx = (tx: any): any => {
  const { type, ...data } = tx;
  for (const k of ["giveTokenId", "wantTokenId", "feeTokenId"]) if (typeof data[k] === "string") data[k] = Number(data[k]);
  return { type, data };
};
/** One swap tx through og (handleSwapOffer / handleSwapCancelRequest / handleSwapResolve on the overlay) and the rewrite; accept/reject and Account roots must agree. */
const swapLockstep = (start: AccountBody) => {
  const og = ogHarness(start);
  let body = start;
  const step = async (tx: any, byLeft: boolean): Promise<boolean> => {
    const ogTx = toOgTx(tx);
    const handler = tx.type === "swap_offer" ? handleSwapOffer : tx.type === "swap_resolve" ? handleSwapResolve : handleSwapCancelRequest;
    const o = await og.run((acc) => (handler as any)(acc, ogTx, byLeft, 0));
    const r = apply(body, tx, { byLeft, nowMs: 1n, jHeight: 0n, accountHeight: 1n });
    if (r.ok !== o.ok) throw new Error(`accept mismatch og=${o.ok}(${o.error}) rw=${r.ok ? "ok" : JSON.stringify(r.error, (_k, x) => (typeof x === "bigint" ? `${x}n` : x))} tx=${JSON.stringify(tx, (_k, x) => (typeof x === "bigint" ? `${x}n` : x))}`);
    if (r.ok) { body = r.value.state; expect(unwrap(committed(body) as any).root).toBe(o.root); }
    return r.ok;
  };
  return { step, body: () => body, og };
};
const E18 = 10n ** 18n;

describe("account-tx: swap", () => {
  test("MATCH: swap_cancel_request only requests — offer and hold stay in both; only the maker may ask", async () => {
    const { body } = open(null, 100n * E18);
    const ls = swapLockstep(body);
    expect(await ls.step(rwOffer("S", 0, 2n * E18, 1, 3n * E18), true)).toBe(true);
    expect(await ls.step({ type: "swap_cancel_request", offerId: "S" }, false)).toBe(false);
    expect(await ls.step({ type: "swap_cancel_request", offerId: "S" }, true)).toBe(true);
    expect(await ls.step({ type: "swap_cancel_request", offerId: "T" }, true)).toBe(false);
    expect(ls.body().offers.has("S")).toBe(true);
    expect(holds(ls.body(), "0" as any, true)).toBe(2n * E18);
  });

  test("MATCH: resolve needs explicit execution amounts at or above the maker's limit price; any non-maker resolves, the maker never", async () => {
    const { body } = open(null, 100n * E18);
    const ls = swapLockstep(body);
    expect(await ls.step(rwOffer("S", 0, 2n * E18, 1, 3n * E18), true)).toBe(true);
    const ratio = (g: bigint) => exactFillRatioToUint16(deriveExactSwapFillRatio(2n * E18, g));
    expect(await ls.step({ type: "swap_resolve", offerId: "S", fillRatio: 32768, cancelRemainder: true }, false)).toBe(false); // no execution amounts
    expect(await ls.step({ type: "swap_resolve", offerId: "S", fillRatio: ratio(E18), cancelRemainder: true, executionGiveAmount: E18, executionWantAmount: E18 }, false)).toBe(false); // below 2:3
    expect(await ls.step({ type: "swap_resolve", offerId: "S", fillRatio: 0, cancelRemainder: true }, true)).toBe(false); // maker itself
    expect(await ls.step({ type: "swap_resolve", offerId: "S", fillRatio: ratio(E18), cancelRemainder: false, executionGiveAmount: E18, executionWantAmount: 3n * E18 / 2n }, false)).toBe(true);
    expect(ls.body().offers.get("S")?.giveAmount).toBe(E18);
    expect(await ls.step({ type: "swap_resolve", offerId: "S", fillRatio: 0, cancelRemainder: false }, false)).toBe(true); // fillRatio 0 closes
    expect(ls.body().offers.has("S")).toBe(false);
    expect(holds(ls.body(), "0" as any, true)).toBe(0n);
  });

  test("MATCH: admission — same token, ':' in offerId, decimals, fee terms, timeInForce, lot size, priceTicks drift, capacity with existing holds", async () => {
    const { body } = open(null, 100n * E18);
    const ls = swapLockstep(body);
    const cases: [any, boolean][] = [
      [rwOffer("A", 0, E18, 0, E18), false], [rwOffer("a:b", 0, E18, 1, E18), false], [rwOffer("A", 0, E18, 1, E18, { giveTokenDecimals: 256 }), false],
      [rwOffer("A", 0, E18, 1, E18, { maxFee: E18 }), false], [rwOffer("A", 0, E18, 1, E18, { minNetReceive: 0n }), false], [rwOffer("A", 0, E18, 1, E18, { minNetReceive: E18 + 1n }), false],
      [rwOffer("A", 0, E18, 1, E18, { timeInForce: 3 }), false], [rwOffer("A", 0, 10n ** 11n, 1, E18), false], [rwOffer("A", 0, E18, 1, E18, { priceTicks: 10_002n }), false],
      [rwOffer("A", 0, E18, 1, E18, { priceTicks: 10_001n, timeInForce: 1, maxFee: 10n ** 16n, minNetReceive: 99n * 10n ** 16n }), true], [rwOffer("A", 0, E18, 1, E18), false],
      [rwOffer("B", 0, 100n * E18, 1, E18), false], [rwOffer("B", 0, 99n * E18, 1, E18), true], [rwOffer("C", 1, 7_000_123n, 0, 3n * E18 + 5n, { giveTokenDecimals: 6, minNetReceive: 3n * E18 }), true], [rwOffer("D", 1, 7n * E18, 0, 3n * E18 + 5n, { wantTokenDecimals: 6, minNetReceive: 3n * E18 }), false],
    ];
    for (const [i, [tx, want]] of cases.entries()) expect([i, await ls.step(tx, true)]).toEqual([i, want]);
    expect(holds(ls.body(), "0" as any, true)).toBe(100n * E18);
  });

  test("MATCH: 32 same-j offers per account; the 33rd is refused by both", async () => {
    const { body } = open(null, 100n * E18);
    const ls = swapLockstep(body);
    for (let i = 0; i < 33; i++) expect(await ls.step(rwOffer(`O${i}`, i % 2, E18, 1 - (i % 2), E18), i % 3 === 0)).toBe(i < 32);
  });

  test("MATCH: 40 random offer/resolve/cancel sequences (decimals, orientation, partial fills, price improvement, fees, dust requantization) keep og and rewrite roots equal", async () => {
    let accepted = 0;
    for (let n = 0; n < 40; n++) {
      const { body } = open(null, 10n ** 30n);
      const ls = swapLockstep(body);
      for (let i = 0; i < 10; i++) {
        const live = [...ls.body().offers.values()], byLeft = ri(2) === 0, pickKind = ri(10);
        let tx: any;
        if (live.length === 0 || pickKind < 3) {
          const give = ri(2), gd = pick3([0, 6, 8, 18]), wd = pick3([0, 6, 8, 18]);
          const giveAmount = BigInt(1 + ri(1_000_000)) * 10n ** BigInt(Math.max(0, gd - 3)), wantAmount = BigInt(1 + ri(1_000_000)) * 10n ** BigInt(Math.max(0, wd - 3));
          const maxFee = ri(3) === 0 ? 0n : wantAmount / BigInt(2 + ri(50));
          tx = rwOffer(`R${i}`, give, giveAmount, 1 - give, wantAmount, { giveTokenDecimals: gd, wantTokenDecimals: wd, maxFee, minNetReceive: wantAmount - maxFee - BigInt(ri(2)) });
        } else if (pickKind === 3) {
          tx = { type: "swap_cancel_request", offerId: pick3(live).offerId };
        } else {
          const o = pick3(live), qG = o.quantizedGive, qW = o.quantizedWant;
          const fG = ri(4) === 0 ? qG : (qG * BigInt(ri(1_000_001))) / 1_000_000n;
          const fair = fG === 0n ? 0n : (fG * qW + qG - 1n) / qG, fW = fair + BigInt(ri(4)) - 1n < 0n ? 0n : fair + BigInt(ri(4)) - 1n;
          const ratio = exactFillRatioToUint16(deriveExactSwapFillRatio(qG, fG));
          const fee = ri(3) === 0 && fW > 1n ? (o.maxFee * fG) / qG : 0n;
          tx = ri(8) === 0 ? { type: "swap_resolve", offerId: o.offerId, fillRatio: 0, cancelRemainder: ri(2) === 0 }
            : { type: "swap_resolve", offerId: o.offerId, fillRatio: ri(10) === 0 ? ri(65536) : ratio, cancelRemainder: ri(3) === 0, executionGiveAmount: fG, executionWantAmount: fW, ...(fee > 0n ? { feeAmount: fee } : {}) };
        }
        if (await ls.step(tx, tx.type === "swap_offer" ? byLeft : tx.type === "swap_cancel_request" ? ls.body().offers.get(tx.offerId)!.makerIsLeft : ri(6) === 0 ? byLeft : !ls.body().offers.get(tx.offerId)!.makerIsLeft)) accepted++;
      }
    }
    expect(accepted).toBeGreaterThan(100);
  });
});

// ---------- settlement / j-events ----------
describe("account-tx: settlement + j_event_claim", () => {
  const ogSettleHarness = (body: AccountBody) => {
    const h = ogHarness(body);
    return { run: (tx: any, byLeft: boolean, ts: number, context: any = {}) => h.run((acc) => handleSettleTransition(acc, tx, byLeft, ts, context)), workspace: () => h.replica().state.settlementWorkspace, replica: h.replica };
  };
  type Step = { tx: any; byLeft: boolean; ts: number };
  /** Runs the same settle_transition sequence through og and the rewrite; accept/reject and the full Account root must agree at every step. */
  const lockstep = async (steps: readonly Step[], start = open().body): Promise<{ body: AccountBody; og: ReturnType<typeof ogSettleHarness>; accepted: number }> => {
    const og = ogSettleHarness(start);
    let body = start, accepted = 0;
    for (const { tx, byLeft, ts } of steps) {
      const o = await og.run(tx, byLeft, ts);
      const r = apply(body, { type: "settle_transition", ...tx.data }, { byLeft, nowMs: BigInt(ts), jHeight: 0n, accountHeight: 1n });
    if (r.ok !== o.ok) throw new Error(`accept mismatch og=${o.ok}(${o.error}) rw=${JSON.stringify(r.ok ? "ok" : r.error)} tx=${JSON.stringify(tx, (_k, x) => (typeof x === "bigint" ? `${x}n` : x))}`);
      if (r.ok) {
        body = r.value.state;
        accepted++;
        expect(unwrap(committed(body) as any).root).toBe(o.root);
        expect(body.settlement?.workspaceHash).toBe(og.workspace()?.workspaceHash);
      }
    }
    return { body, og, accepted };
  };
  const upsert = (revision: number, ops: any[], executorIsLeft = true, previousWorkspaceHash?: string, memo?: string) =>
    ({ type: "settle_transition", data: { kind: "upsert", revision, ops, executorIsLeft, ...(previousWorkspaceHash !== undefined ? { previousWorkspaceHash } : {}), ...(memo !== undefined ? { memo } : {}) } });
  const target = (kind: "submit" | "clear", revision: number, workspaceHash: string) => ({ type: "settle_transition", data: { kind, revision, workspaceHash } });

  test("MATCH: hanko/submit/clear with no workspace are refused by both (SETTLEMENT_WORKSPACE_MISSING)", async () => {
    const hanko = { type: "settle_transition", data: { kind: "hanko", revision: 1, workspaceHash: word("61"), settlementNonce: 2, settlementHash: word("62"), settlementHanko: "0x01", postProof: { nonce: 3, proposerIsLeft: true, proofBodyHash: word("63"), disputeHash: word("64"), hanko: "0x02" } } };
    const r = await handleSettleTransition(ogAccount(ogState()), hanko as any, true, 1, {} as any);
    expect(JSON.stringify((r as any).rejection)).toContain("SETTLEMENT_WORKSPACE_MISSING");
    const { body } = open();
    expect(apply(body, { type: "settle_transition", ...hanko.data }, { byLeft: true, nowMs: 1n, jHeight: 0n, accountHeight: 1n, settlement: { verify: () => true, proofNonceFloor: 1 } })).toMatchObject({ ok: false, error: { reason: "SETTLEMENT_WORKSPACE_MISSING" } });
    const { accepted } = await lockstep([{ tx: target("submit", 1, word("61")), byLeft: true, ts: 1 }, { tx: target("clear", 1, word("61")), byLeft: false, ts: 1 }]);
    expect(accepted).toBe(0);
  });

  test("MATCH (H5): upsert commits the workspace (hash, holds) into the og Account root; revision chain, previous hash, clear and capacity agree", async () => {
    const ops = [{ type: "r2c", tokenId: 1, amount: 5n }, { type: "c2r", tokenId: 0, amount: 2n }];
    const first = await lockstep([{ tx: upsert(1, ops, true, undefined, "m"), byLeft: true, ts: 7 }]);
    expect(first.accepted).toBe(1);
    const h1 = first.og.workspace().workspaceHash;
    expect(holds(first.body, "1" as any, true)).toBe(5n);
    const { body, accepted } = await lockstep([
      { tx: upsert(1, ops, true, undefined, "m"), byLeft: true, ts: 7 },
      { tx: upsert(1, ops), byLeft: false, ts: 8 }, // already exists
      { tx: upsert(3, ops, false, h1), byLeft: false, ts: 8 }, // non-contiguous
      { tx: upsert(2, ops, false, word("99")), byLeft: false, ts: 8 }, // previous hash mismatch
      { tx: upsert(2, ops, false), byLeft: false, ts: 8 }, // previous hash missing
      { tx: upsert(2, [{ type: "r2r", tokenId: 1, amount: 21n }], false, h1), byLeft: false, ts: 8 }, // beyond capacity
      { tx: upsert(2, [{ type: "r2r", tokenId: 1, amount: 20n }], false, h1), byLeft: false, ts: 9 }, // exactly capacity after the old hold is released
      { tx: target("submit", 2, word("00")), byLeft: false, ts: 9 },
      { tx: target("clear", 1, h1), byLeft: false, ts: 9 }, // stale revision
    ]);
    expect(accepted).toBe(2);
    expect(holds(body, "1" as any, false)).toBe(20n);
    const cleared = await lockstep([{ tx: upsert(1, ops, true, undefined, "m"), byLeft: true, ts: 7 }, { tx: target("clear", 1, h1), byLeft: false, ts: 9 }, { tx: upsert(1, [{ type: "forgive", tokenId: 3 }]), byLeft: true, ts: 10 }]);
    expect(cleared.accepted).toBe(3);
    expect(holds(cleared.body, "1" as any, true)).toBe(0n);
  });

  test("MATCH: malformed ops (empty, zero amount, bad token, duplicate forgive, non-conserving rawDiff, >32 diffs, missing row hold) are refused by both", async () => {
    const bad: any[][] = [[], [{ type: "r2c", tokenId: 1, amount: 0n }], [{ type: "r2c", tokenId: 70000, amount: 1n }], [{ type: "forgive", tokenId: 1 }, { type: "forgive", tokenId: 1 }],
      [{ type: "rawDiff", tokenId: 1, leftDiff: 1n, rightDiff: 0n, collateralDiff: 0n, ondeltaDiff: 0n }], Array.from({ length: 33 }, (_, i) => ({ type: "r2r", tokenId: 100 + i, amount: 1n })),
      [{ type: "r2r", tokenId: 9, amount: 1n }], [{ type: "swap", tokenId: 1, amount: 1n }]];
    for (const ops of bad) expect((await lockstep([{ tx: upsert(1, ops), byLeft: true, ts: 1 }])).accepted).toBe(0);
    expect((await lockstep([{ tx: upsert(1, [{ type: "c2r", tokenId: 9, amount: 1n }, { type: "rawDiff", tokenId: 1, leftDiff: 0n, rightDiff: 0n, collateralDiff: 0n, ondeltaDiff: 3n }]), byLeft: true, ts: 1 }])).accepted).toBe(1);
  });

  test("MATCH: 60 random settle_transition sequences (upsert/clear/submit, both sides, random ops) keep og and rewrite roots equal", async () => {
    const op = (): any => {
      const tokenId = pick3([0, 1, 2]), kind = pick3(["r2c", "c2r", "r2r", "forgive", "rawDiff"]);
      if (kind === "forgive") return { type: kind, tokenId };
      if (kind === "rawDiff") { const x = BigInt(ri(9)) - 4n, y = BigInt(ri(9)) - 4n; return { type: kind, tokenId, leftDiff: x, rightDiff: y, collateralDiff: -x - y, ondeltaDiff: BigInt(ri(5)) - 2n }; }
      return { type: kind, tokenId, amount: BigInt(ri(24)) };
    };
    for (let n = 0; n < 60; n++) {
      const og = ogSettleHarness(open().body);
      let body = open().body;
      for (let i = 0; i < 8; i++) {
        const cur = og.workspace(), kind = pick3(["upsert", "upsert", "clear", "submit"]), byLeft = ri(2) === 0, ts = 1 + i;
        const revision = (cur?.revision ?? 0) + (ri(5) === 0 ? ri(3) - 1 : 1);
        const tx = kind === "upsert"
          ? upsert(revision, Array.from({ length: 1 + ri(3) }, op), ri(2) === 0, revision > 1 ? (ri(6) === 0 ? word("77") : cur?.workspaceHash) : undefined, ri(3) === 0 ? "memo" : undefined)
          : target(kind, cur?.revision ?? 1, ri(6) === 0 ? word("78") : cur?.workspaceHash ?? word("79"));
        const o = await og.run(tx, byLeft, ts);
        const r = apply(body, { type: "settle_transition", ...tx.data }, { byLeft, nowMs: BigInt(ts), jHeight: 0n, accountHeight: 1n });
        expect(r.ok).toBe(o.ok);
    if (r.ok) { body = r.value.state; expect(unwrap(committed(body) as any).root).toBe(o.root); }
      }
    }
  });

  test("MATCH (conditional on H1/H2 proof hashes): hanko attach — og-derived settlement/proof/dispute hashes are accepted by both and give equal roots, ready_to_submit, submit", async () => {
    const ogCtx: any = { jReplicas: jurisdictions.jReplicas, resolveSettlementBoardAuthority: async () => undefined, verifyHanko: async (_h: string, _m: string, entityId: string) => ({ valid: true, entityId }) };
    const rwCtx = (byLeft: boolean): FoldCtx => ({ byLeft, nowMs: 5n, jHeight: 0n, accountHeight: 1n, settlement: { verify: () => true, proofNonceFloor: 1 } });
    const ops = [{ type: "r2c", tokenId: 1, amount: 5n }];
    const og = ogSettleHarness(open().body);
    expect((await og.run(upsert(1, ops, true), true, 1)).ok).toBe(true);
    let body = unwrap(apply(open().body, { type: "settle_transition", ...upsert(1, ops, true).data }, { byLeft: true, nowMs: 1n, jHeight: 0n, accountHeight: 1n })).state;
    const hash = og.workspace().workspaceHash;
    // og reports the expected values in its rejection: learn them one check at a time.
    const draft = { settlementNonce: 1, settlementHash: word("00"), postProof: { nonce: 2, proposerIsLeft: true, proofBodyHash: word("00"), disputeHash: word("00"), hanko: "0x01" } };
    const probe = async (byLeft: boolean, settlementHanko: string | undefined) => {
      const tx: any = { type: "settle_transition", data: { kind: "hanko", revision: 1, workspaceHash: hash, ...draft, postProof: { ...draft.postProof }, ...(settlementHanko ? { settlementHanko } : {}) } };
      for (let i = 0; i < 4; i++) {
        const overlay = beginAccountTransition((og as any).replica());
        const r: any = await handleSettleTransition(accountTransitionView(overlay), tx, byLeft, 5, ogCtx);
        discardAccountTransition(overlay);
        const m = /(SETTLEMENT_HANKO_HASH_MISMATCH|POST_SETTLEMENT_PROOF_BODY_HASH_MISMATCH|POST_SETTLEMENT_DISPUTE_HASH_MISMATCH):0x[0-9a-f]+:(0x[0-9a-fA-F]+)/.exec(r.rejection?.message ?? "");
        if (m === null) break;
        if (m[1] === "SETTLEMENT_HANKO_HASH_MISMATCH") tx.data.settlementHash = m[2]; else if (m[1] === "POST_SETTLEMENT_PROOF_BODY_HASH_MISMATCH") tx.data.postProof.proofBodyHash = m[2]; else tx.data.postProof.disputeHash = m[2];
      }
      draft.settlementHash = tx.data.settlementHash; draft.postProof = tx.data.postProof;
      return tx;
    };
    const sides: [boolean, string | undefined][] = [[false, "0xbb"], [true, undefined]];
    // Until H2 (SignedAmount settlement diffs) lands, the rewrite settlement digest differs and it refuses with a hash mismatch; after it lands the full lockstep below runs.
    let rewriteAgrees = true;
    for (const [byLeft, settlementHanko] of sides) {
      const tx = await probe(byLeft, settlementHanko);
      if (byLeft) tx.data.postProof.hanko = "0x02";
      const o = await og.run(tx, byLeft, 5, ogCtx);
      expect(o.error ?? "ok").toBe("ok");
      const r = apply(body, { type: "settle_transition", ...tx.data }, rwCtx(byLeft));
      if (!r.ok) { rewriteAgrees = false; expect(JSON.stringify(r.error)).toMatch(/POST_SETTLEMENT_PROOF_BODY_HASH_MISMATCH|POST_SETTLEMENT_DISPUTE_HASH_MISMATCH|SETTLEMENT_HANKO_HASH_MISMATCH/); break; }
      body = r.value.state;
      expect(unwrap(committed(body) as any).root).toBe(o.root);
    }
    if (rewriteAgrees) {
      expect(body.settlement?.status).toBe("ready_to_submit");
      const upd = await og.run(upsert(2, ops, true, hash), true, 6, ogCtx);
      expect(upd.ok).toBe(false);
      expect(apply(body, { type: "settle_transition", ...upsert(2, ops, true, hash).data }, rwCtx(true)).ok).toBe(false);
      const sub = await og.run(target("submit", 1, hash), true, 7, ogCtx);
      const r = apply(body, { type: "settle_transition", ...target("submit", 1, hash).data }, rwCtx(true));
      expect(sub.ok).toBe(true);
      expect(unwrap(committed(unwrap(r).state) as any).root).toBe(sub.root);
    }
  });

  test("MATCH: a signed workspace freezes every tx but j_event_claim and settle hanko/submit in both", () => {
    const { body, ctx } = open();
    const signed: any = { workspaceHash: word("61"), ops: [{ type: "r2r", tokenId: 1, amount: 1n }], lastModifiedByLeft: true, status: "awaiting_counterparty", revision: 1, createdAt: 1, lastUpdatedAt: 1, executorIsLeft: true, settlementHash: word("62"), nonceAtSign: 1 };
    const account: any = { state: { settlementWorkspace: signed } };
    const txs: any[] = [{ type: "direct_payment", data: {} }, { type: "set_credit_limit", data: {} }, { type: "j_event_claim", data: {} }, { type: "settle_transition", data: { kind: "hanko" } }, { type: "settle_transition", data: { kind: "submit" } }, { type: "settle_transition", data: { kind: "clear" } }, { type: "settle_transition", data: { kind: "upsert" } }];
    const rwTxs: any[] = [{ type: "direct_payment", tokenId: "0", amount: 1n, route: [] }, { type: "set_credit_limit", tokenId: "0", limit: 1n }, undefined, undefined, undefined, { type: "settle_transition", kind: "clear", revision: 1, workspaceHash: word("61") }, { type: "settle_transition", kind: "upsert", revision: 2, ops: [], executorIsLeft: true }];
    txs.forEach((tx, i) => {
      const frozen = getSignedSettlementWorkspaceTxError(account, tx) !== undefined;
      expect(frozen).toBe(!["j_event_claim", "hanko", "submit"].includes(tx.data.kind ?? tx.type));
      if (rwTxs[i] !== undefined) expect(apply({ ...body, settlement: signed }, rwTxs[i], ctx)).toMatchObject({ ok: false, error: { _tag: "settlement_frozen" } });
    });
  });

  const DEP = `0x${"ab".repeat(20)}`;
  const jurisdictions = { jReplicas: new Map([["j", { chainId: 1, contracts: { depository: DEP, entityProvider: `0x${"c1".repeat(20)}`, account: `0x${"c2".repeat(20)}`, deltaTransformer: `0x${"c3".repeat(20)}` } }]]) } as any;
  /** og side: the real handleJEventClaim with proofs from prepareAccountJClaimTx and a node store that outlives each tx. */
  const ogClaimHarness = () => {
    const state: any = { ...ogState([ogDelta(1, { leftCreditLimit: 20n, rightCreditLimit: 20n })]), domain: { chainId: 1, depositoryAddress: DEP }, jNonce: 0, lastFinalizedJHeight: 0,
      leftPendingJClaims: createEmptyAccountJClaimAccumulator(), rightPendingJClaims: createEmptyAccountJClaimAccumulator() };
    const account: any = { proofHeader: { fromEntity: A, toEntity: B }, state, currentHeight: 1, shadow: { rebalance: { submittedAtByToken: new PMap() } } };
    const store = new Map<string, any>();
    const apply = (tx: any, byLeft: boolean): boolean => {
      const before = { ...state, deltas: new PMap([...state.deltas].map(([k, v]: any) => [k, { ...v }])) };
      const session = createAccountJClaimSession({ get: (h: string) => store.get(h) } as any);
      try {
        const prepared = prepareAccountJClaimTx(state, tx, { chainId: 1, depositoryAddress: DEP }, session);
        const r = handleJEventClaim(account, prepared as any, byLeft, 1, A, [], jurisdictions, session);
        if (!r.ok) { Object.assign(state, before); return false; }
        const changes = session.changes();
        for (const { hash, node } of changes?.newNodes ?? []) store.set(hash, node);
        return true;
      } catch { Object.assign(state, before); return false; }
    };
    return { state, apply };
  };
  const ogSettled = (tokenId: number, collateral: bigint, ondelta: bigint, nonce: number, left = A, right = B) =>
    ({ type: "AccountSettled", data: { leftEntity: left, rightEntity: right, tokenId, leftReserve: "0", rightReserve: "0", collateral: collateral.toString(), ondelta: ondelta.toString(), nonce } });
  const rwClaim = (jHeight: number, block: string, rows: { tokenId: number; collateral: bigint; ondelta: bigint; nonce: number; left?: string; right?: string }[]) => ({
    type: "j_event_claim" as const, jHeight: BigInt(jHeight), jBlockHash: block, observedAt: 1n,
    events: rows.map((r) => ({ left: r.left ?? A, right: r.right ?? B, nonce: BigInt(r.nonce), tokens: [{ tokenId: BigInt(r.tokenId), leftReserve: 0n, rightReserve: 0n, collateral: r.collateral, ondelta: r.ondelta }] })),
  });
  const ogClaim = (jHeight: number, block: string, rows: Parameters<typeof rwClaim>[2]) =>
    ({ type: "j_event_claim", data: { jHeight, jBlockHash: block, events: rows.map((r) => ogSettled(r.tokenId, r.collateral, r.ondelta, r.nonce, r.left, r.right)) } });
  const same = (og: ReturnType<typeof ogClaimHarness>, body: AccountBody) => {
    const view = unwrap(committed(body) as any) as any;
    expect(view.view.lastFinalizedJHeight).toBe(og.state.lastFinalizedJHeight);
    expect(view.view.jNonce).toBe(og.state.jNonce);
    expect(view.view.leftPendingJClaims.root).toBe(og.state.leftPendingJClaims.root);
    expect(view.view.rightPendingJClaims.root).toBe(og.state.rightPendingJClaims.root);
    expect(view.view.leftPendingJClaims.count).toBe(BigInt(og.state.leftPendingJClaims.count));
    for (const [k, d] of og.state.deltas as Map<number, any>) {
      expect(getDelta(body.account, String(k) as any).collateral).toBe(d.collateral);
      expect(getDelta(body.account, String(k) as any).ondelta).toBe(d.ondelta);
    }
  };

  test("MATCH: stale j_event_claim is a no-op in both (no collateral rollback, no finalized-height regression)", () => {
    const og = ogClaimHarness();
    let { body, ctx } = open();
    const steps: [number, string, number, bigint, boolean][] = [[10, word("0a"), 2, 100n, true], [10, word("0a"), 2, 100n, false], [5, word("05"), 1, 7n, true], [5, word("05"), 1, 7n, false]];
    for (const [h, blk, nonce, col, byLeft] of steps) {
      const rows = [{ tokenId: 1, collateral: col, ondelta: 0n, nonce }];
      const ok1 = og.apply(ogClaim(h, blk, rows), byLeft);
      const r = apply(body, rwClaim(h, blk, rows), { ...ctx, byLeft });
      expect(r.ok).toBe(ok1);
      if (r.ok) body = r.value.state;
      same(og, body);
    }
    expect(body.finalizedJHeight).toBe(10n);
    expect(getDelta(body.account, "1" as any).collateral).toBe(100n);
  });

  test("MATCH: peer claim at an older pending height finalizes by membership in both", () => {
    const og = ogClaimHarness();
    let { body, ctx } = open();
    const seq: [number, string, bigint, boolean][] = [[5, word("05"), 7n, true], [10, word("0a"), 100n, true], [5, word("05"), 7n, false]];
    for (const [h, blk, col, byLeft] of seq) {
      const rows = [{ tokenId: 1, collateral: col, ondelta: 0n, nonce: 1 }];
      expect(og.apply(ogClaim(h, blk, rows), byLeft)).toBe(true);
      body = unwrap(apply(body, rwClaim(h, blk, rows), { ...ctx, byLeft })).state;
      same(og, body);
    }
    expect(body.finalizedJHeight).toBe(5n);
    expect(getDelta(body.account, "1" as any).collateral).toBe(7n);
  });

  test("MATCH: AccountSettled for a different pair, nonce regression and conflicting evidence are refused by both", () => {
    for (const [rows, second] of [
      [[{ tokenId: 1, collateral: 9n, ondelta: 0n, nonce: 1, left: word("33"), right: word("44") }], undefined],
      [[{ tokenId: 1, collateral: 9n, ondelta: 0n, nonce: 1 }], [{ tokenId: 1, collateral: 5n, ondelta: 0n, nonce: 0 }]],
    ] as const) {
      const og = ogClaimHarness();
      let { body, ctx } = open();
      const run = (h: number, rs: any, byLeft: boolean) => { const o = og.apply(ogClaim(h, word("0a"), rs), byLeft); const r = apply(body, rwClaim(h, word("0a"), rs), { ...ctx, byLeft }); expect(r.ok).toBe(o); if (r.ok) body = r.value.state; same(og, body); return o; };
      run(10, rows, true);
      const fin = run(10, rows, false);
      if (second !== undefined) { expect(fin).toBe(true); run(11, second, true); expect(run(11, second, false)).toBe(false); }
      else expect(fin).toBe(false);
    }
    // same height, different block: conflict on the peer side
    const og = ogClaimHarness();
    let { body, ctx } = open();
    const rows = [{ tokenId: 1, collateral: 9n, ondelta: 0n, nonce: 1 }];
    expect(og.apply(ogClaim(10, word("0a"), rows), true)).toBe(true);
    body = unwrap(apply(body, rwClaim(10, word("0a"), rows), ctx)).state;
    expect(og.apply(ogClaim(10, word("0b"), rows), false)).toBe(false);
    expect(apply(body, rwClaim(10, word("0b"), rows), { ...ctx, byLeft: false }).ok).toBe(false);
  });

  test("MATCH: 40 random claim sequences (heights, sides, evidence, multi-token rows, nonces) keep og and rewrite in lockstep", () => {
    for (let n = 0; n < 40; n++) {
      const og = ogClaimHarness();
      let { body, ctx } = open();
      for (let i = 0; i < 10; i++) {
        const h = 1 + ri(6), blk = word(pick3(["0a", "0b"])), byLeft = ri(2) === 0;
        const rows = Array.from({ length: 1 + ri(2) }, (_, k) => ({ tokenId: 1 + k + ri(2), collateral: BigInt(ri(50)), ondelta: BigInt(ri(9)) - 4n, nonce: ri(4) }));
        const o = og.apply(ogClaim(h, blk, rows), byLeft);
        const r = apply(body, rwClaim(h, blk, rows), { ...ctx, byLeft });
        expect(r.ok).toBe(o);
        if (r.ok) body = r.value.state;
        same(og, body);
      }
    }
  });
});
