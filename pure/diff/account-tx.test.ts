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
import { validateSwapOfferAdmission } from "../../core/account/tx/handlers/swap/offer/admission.ts";
import { handleSettleTransition } from "../../core/account/tx/handlers/settlement/transition.ts";
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
const ogOffer = (patch: Record<string, unknown> = {}) => ({
  offerId: "S", giveTokenId: 1, giveTokenDecimals: 18, giveAmount: 2n, wantTokenId: 2, wantTokenDecimals: 18, wantAmount: 3n,
  maxFee: 0n, minNetReceive: 1n, priceTicks: 15_000n, makerIsLeft: true, createdHeight: 0, quantizedGive: 2n, quantizedWant: 3n, ...patch,
});
const ogSwapState = () => {
  const s = ogState([ogDelta(1, { leftCreditLimit: 100n, rightCreditLimit: 100n, leftHold: 2n }), ogDelta(2, { leftCreditLimit: 100n, rightCreditLimit: 100n })]);
  s.swapOffers.put("S", ogOffer());
  return s;
};

describe("account-tx: swap", () => {
  test("DIVERGES: swap_cancel — og only emits a cancel *request* (offer + hold kept), rewrite deletes the offer and frees the hold at once", async () => {
    const s = ogSwapState();
    const r = await handleSwapCancelRequest(ogAccount(s), { type: "swap_cancel_request", data: { offerId: "S" } } as any, true, 0);
    expect(r.ok).toBe(true);
    expect(s.swapOffers.has("S")).toBe(true);
    expect(s.deltas.get(1).leftHold).toBe(2n);
    const { body, ctx } = open("right");
    const offered = unwrap(apply(body, { type: "swap_offer", offerId: "S", giveTokenId: "0", giveAmount: 2n, wantTokenId: "1", wantAmount: 3n, minFillRatio: 0, expiresAtHeight: 100n }, ctx)).state;
    const cancelled = unwrap(apply(offered, { type: "swap_cancel", offerId: "S" }, ctx)).state;
    expect(cancelled.offers.has("S")).toBe(false);
    expect(holds(cancelled, "0" as any, true)).toBe(0n);
  });

  test("DIVERGES: fill below maker limit price — rewrite floors both legs by ratio (gives 1 for 1 on a 2:3 offer); og rejects that execution", async () => {
    // rewrite: maker(left) offers 2 of token0 for 3 of token1; hub(right) fills at ratio 32768 (~1/2)
    const { body, ctx } = open("right");
    const offered = unwrap(apply(body, { type: "swap_offer", offerId: "S", giveTokenId: "0", giveAmount: 2n, wantTokenId: "1", wantAmount: 3n, minFillRatio: 0, expiresAtHeight: 100n }, ctx)).state;
    const filled = unwrap(apply(offered, { type: "swap_resolve", offerId: "S", fillRatio: 32768, cancelRemainder: true }, { ...ctx, byLeft: false })).state;
    const gave = -getDelta(filled.account, "0" as any).offdelta; // left paid give
    const got = getDelta(filled.account, "1" as any).offdelta * -1n * -1n; // right paid want (positive = right pays)
    expect(gave).toBe(1n);
    expect(got).toBe(1n);
    expect(got * 2n < gave * 3n).toBe(true); // below maker price 3/2
    // og: same economic execution (give 1, want 1) on the same offer is refused.
    const s = ogSwapState();
    const r = await handleSwapResolve(ogAccount(s), { type: "swap_resolve", data: { offerId: "S", fillRatio: 32768, cancelRemainder: true, executionGiveAmount: 1n, executionWantAmount: 1n } } as any, false, 0);
    expect(r.ok).toBe(false);
    expect(JSON.stringify((r as any).rejection ?? r, (_k, v) => (typeof v === "bigint" ? String(v) : v))).toContain("maker limit");
  });

  test("DIVERGES: og requires explicit execution amounts for any non-zero fillRatio; rewrite derives fills from the ratio alone", async () => {
    const s = ogSwapState();
    const r = await handleSwapResolve(ogAccount(s), { type: "swap_resolve", data: { offerId: "S", fillRatio: MAX_FILL, cancelRemainder: true } } as any, false, 0);
    expect(r.ok).toBe(false);
    const { body, ctx } = open("right");
    const offered = unwrap(apply(body, { type: "swap_offer", offerId: "S", giveTokenId: "0", giveAmount: 2n, wantTokenId: "1", wantAmount: 3n, minFillRatio: 0, expiresAtHeight: 100n }, ctx)).state;
    expect(apply(offered, { type: "swap_resolve", offerId: "S", fillRatio: MAX_FILL, cancelRemainder: true }, { ...ctx, byLeft: false }).ok).toBe(true);
  });

  test("DIVERGES: fillRatio=0 with cancelRemainder=false — og closes the offer (effectiveCancelRemainder), rewrite keeps it open", async () => {
    const s = ogSwapState();
    const r = await handleSwapResolve(ogAccount(s), { type: "swap_resolve", data: { offerId: "S", fillRatio: 0, cancelRemainder: false } } as any, false, 0);
    expect(r.ok).toBe(true);
    expect(s.swapOffers.has("S")).toBe(false);
    expect(s.deltas.get(1).leftHold).toBe(0n);
    const { body, ctx } = open("right");
    const offered = unwrap(apply(body, { type: "swap_offer", offerId: "S", giveTokenId: "0", giveAmount: 2n, wantTokenId: "1", wantAmount: 3n, minFillRatio: 0, expiresAtHeight: 100n }, ctx)).state;
    const after = unwrap(apply(offered, { type: "swap_resolve", offerId: "S", fillRatio: 0, cancelRemainder: false }, { ...ctx, byLeft: false })).state;
    expect(after.offers.has("S")).toBe(true);
  });

  test("DIVERGES: resolver authority — og: any non-maker counterparty; rewrite: only the designated hub (hub=null account can never resolve)", async () => {
    const s = ogSwapState();
    expect((await handleSwapResolve(ogAccount(s), { type: "swap_resolve", data: { offerId: "S", fillRatio: 0, cancelRemainder: true } } as any, false, 0)).ok).toBe(true);
    const s2 = ogSwapState();
    expect((await handleSwapResolve(ogAccount(s2), { type: "swap_resolve", data: { offerId: "S", fillRatio: 0, cancelRemainder: true } } as any, true, 0)).ok).toBe(false); // maker itself
    const { body, ctx } = open(null);
    const offered = unwrap(apply(body, { type: "swap_offer", offerId: "S", giveTokenId: "0", giveAmount: 2n, wantTokenId: "1", wantAmount: 3n, minFillRatio: 0, expiresAtHeight: 100n }, ctx)).state;
    const r = apply(offered, { type: "swap_resolve", offerId: "S", fillRatio: 0, cancelRemainder: true }, { ...ctx, byLeft: false });
    expect(r.ok).toBe(false);
    expect((r as any).error._tag).toBe("not_hub");
    // and a hub that is itself the maker may resolve its own offer in the rewrite
    const hubMaker = open("left");
    const own = unwrap(apply(hubMaker.body, { type: "swap_offer", offerId: "S", giveTokenId: "0", giveAmount: 2n, wantTokenId: "1", wantAmount: 3n, minFillRatio: 0, expiresAtHeight: 100n }, hubMaker.ctx)).state;
    expect(apply(own, { type: "swap_resolve", offerId: "S", fillRatio: 0, cancelRemainder: true }, hubMaker.ctx).ok).toBe(true);
  });

  test("DIVERGES: same-token swap offer — og refuses 'Cannot swap same token', rewrite accepts", () => {
    const s = ogState();
    const tx = { type: "swap_offer", data: { offerId: "S", giveTokenId: 1, giveTokenDecimals: 18, giveAmount: 10n ** 18n, wantTokenId: 1, wantTokenDecimals: 18, wantAmount: 10n ** 18n, maxFee: 0n, minNetReceive: 10n ** 18n } } as any;
    const r = validateSwapOfferAdmission(s as any, tx, true);
    expect(r.ok).toBe(false);
    expect((r as any).message).toContain("same token");
    const { body, ctx } = open();
    expect(apply(body, { type: "swap_offer", offerId: "S", giveTokenId: "0", giveAmount: 2n, wantTokenId: "0", wantAmount: 2n, minFillRatio: 0, expiresAtHeight: 100n }, ctx).ok).toBe(true);
  });

  test("DIVERGES: offerId containing ':' — og refuses, rewrite accepts", () => {
    const tx = { type: "swap_offer", data: { offerId: "a:b", giveTokenId: 1, giveTokenDecimals: 18, giveAmount: 10n ** 18n, wantTokenId: 2, wantTokenDecimals: 18, wantAmount: 10n ** 18n, maxFee: 0n, minNetReceive: 10n ** 18n } } as any;
    expect(validateSwapOfferAdmission(ogState() as any, tx, true).ok).toBe(false);
    const { body, ctx } = open();
    expect(apply(body, { type: "swap_offer", offerId: "a:b", giveTokenId: "0", giveAmount: 2n, wantTokenId: "1", wantAmount: 2n, minFillRatio: 0, expiresAtHeight: 100n }, ctx).ok).toBe(true);
  });

  test("MATCH: swap_offer capacity check includes existing holds on the give token", () => {
    const { body, ctx } = open("right"); // left can pay 20 on token0
    const locked = unwrap(apply(body, rwLock(secretOf(9), { amount: 15n, tokenId: "0" }), ctx)).state;
    expect(apply(locked, { type: "swap_offer", offerId: "S", giveTokenId: "0", giveAmount: 6n, wantTokenId: "1", wantAmount: 3n, minFillRatio: 0, expiresAtHeight: 100n }, ctx).ok).toBe(false);
    expect(apply(locked, { type: "swap_offer", offerId: "S", giveTokenId: "0", giveAmount: 5n, wantTokenId: "1", wantAmount: 3n, minFillRatio: 0, expiresAtHeight: 100n }, ctx).ok).toBe(true);
    // og commit.ts:208 uses deriveDelta(delta, makerIsLeft).outCapacity, which subtracts leftHold
    expect(deriveDelta(ogDelta(0, { leftCreditLimit: 20n, rightCreditLimit: 20n, leftHold: 15n }), true).outCapacity).toBe(5n);
  });
});

// ---------- settlement / j-events ----------
describe("account-tx: settlement + j_event_claim", () => {
  test("DIVERGES: settle_transition(hanko) with no workspace — og rejects, rewrite accepts and commits settlementHash", async () => {
    const tx = {
      type: "settle_transition",
      data: { kind: "hanko", revision: 1, workspaceHash: word("61"), settlementNonce: 2, settlementHash: word("62"), settlementHanko: "0x01", postProof: { nonce: 3, proposerIsLeft: true, proofBodyHash: word("63"), disputeHash: word("64"), hanko: "0x02" } },
    } as any;
    const r = await handleSettleTransition(ogAccount(ogState()), tx, true, 1, {} as any);
    expect(r.ok).toBe(false);
    expect(JSON.stringify((r as any).rejection)).toContain("SETTLEMENT_WORKSPACE_MISSING");
    const { body, ctx } = open();
    const applied = apply(body, { type: "settle_transition", ...tx.data }, ctx);
    expect(applied.ok).toBe(true);
    expect((applied as any).value.state.settlement.settlementHash).toBe(word("62"));
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
