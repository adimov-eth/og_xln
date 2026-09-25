

import { secp256k1 } from "@noble/curves/secp256k1";
import { x25519 } from "@noble/curves/ed25519";
import { hkdf } from "@noble/hashes/hkdf";
import { sha256 } from "@noble/hashes/sha2";
import { keccak_256 } from "@noble/hashes/sha3";
import { bytesToHex as nobleHex } from "@noble/hashes/utils";
import { Packr, addExtension } from "msgpackr";


declare const __brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [__brand]: { readonly [K in B]: B } };
export type Flat<T> = { readonly [K in keyof T]: T[K] } & {};
export type Tagged<Tag extends string, Extra extends object = {}> = Tag extends unknown ? Flat<{ readonly _tag: Tag } & Extra> : never;
export type Of<T extends { readonly _tag: string }, K extends T["_tag"]> = Extract<T, { readonly _tag: K }>;
export type Eq<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
export const tag = <T extends string>(_tag: T) => <X extends object = {}>(x: X = {} as X): Tagged<T, X> => ({ _tag, ...x }) as Tagged<T, X>;
/** `{k: v}` when defined, `{}` otherwise — absence and undefined are one value (§4.2). */
export const opt = <K extends string, V>(k: K, v: V | undefined): { readonly [P in K]?: V } =>
  (v === undefined ? {} : { [k]: v }) as { readonly [P in K]?: V };


export type Result<T, E> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };
export const ok = <T>(value: T): Result<T, never> => ({ ok: true, value });
export const err = <E>(error: E): Result<never, E> => ({ ok: false, error });
export const assertNever = (x: never): never => { throw new Error(`unreachable: ${String(x)}`); };
export const map = <T, U, E>(r: Result<T, E>, f: (t: T) => U): Result<U, E> => (r.ok ? ok(f(r.value)) : r);
export const chain = <T, U, E, F>(r: Result<T, E>, f: (t: T) => Result<U, F>): Result<U, E | F> => (r.ok ? f(r.value) : r);
export const mapErr = <T, E, F>(r: Result<T, E>, f: (e: E) => F): Result<T, F> => (r.ok ? r : err(f(r.error)));
export const guard = <E>(pass: boolean, e: E): Result<void, E> => (pass ? ok(undefined) : err(e));
export const unwrapOr = <T, E>(r: Result<T, E>, f: (e: E) => T): T => (r.ok ? r.value : f(r.error));
export const foldResult = <S, X, E>(xs: Iterable<X>, init: S, f: (s: S, x: X, i: number) => Result<S, E>): Result<S, E> => {
  let s = init, i = 0;
  for (const x of xs) { const n = f(s, x, i++); if (!n.ok) return n; s = n.value; }
  return ok(s);
};
export const mapAccumResult = <S, X, Y, E>(xs: Iterable<X>, init: S, f: (s: S, x: X, i: number) => Result<readonly [S, Y], E>): Result<readonly [S, readonly Y[]], E> =>
  foldResult<readonly [S, readonly Y[]], X, E>(xs, [init, []], ([s, ys], x, i) => map(f(s, x, i), ([n, y]) => [n, [...ys, y]] as const));
export const mapAccum = <S, X, Y>(xs: Iterable<X>, init: S, f: (s: S, x: X, i: number) => readonly [S, Y]): readonly [S, readonly Y[]] =>
  unwrapOr(mapAccumResult(xs, init, (s, x, i) => ok(f(s, x, i))), assertNever);
export const traverse = <X, Y, E>(xs: Iterable<X>, f: (x: X, i: number) => Result<Y, E>): Result<readonly Y[], E> =>
  map(mapAccumResult(xs, undefined, (_, x, i) => map(f(x, i), (y) => [undefined, y] as const)), ([, ys]) => ys);
/** First refusal among eagerly evaluated checks, in order. */
export const checks = <E>(...rs: readonly Result<unknown, E>[]): Result<void, E> => foldResult(rs, undefined as void, (_, r) => map(r, () => undefined));
type Values<R> = { readonly [K in keyof R]: R[K] extends Result<infer V, unknown> ? V : never };
type Errors<R> = R[keyof R] extends Result<unknown, infer E> ? E : never;
export const all = <R extends Record<string, Result<unknown, unknown>>>(cs: R): Result<Values<R>, Errors<R>> =>
  foldResult(Object.entries(cs), {} as Record<string, unknown>, (acc, [k, r]) => map(r as Result<unknown, Errors<R>>, (v) => ({ ...acc, [k]: v }))) as Result<Values<R>, Errors<R>>;


export const arm = <A extends object, K extends keyof A>(arms: A, k: K): A[K] => (Object.hasOwn(arms, k) ? arms[k] : assertNever(k as never));
export const matchBy = <Key extends string, T extends Record<Key, PropertyKey>, R>(
  key: Key, value: T, arms: { [K in T[Key]]: (v: Extract<T, Record<Key, K>>) => R },
): R => arm(arms, value[key] as T[Key])(value as never);
export const match = <T extends { readonly _tag: string }, R>(value: T, arms: { [K in T["_tag"]]: (v: Of<T, K>) => R }): R => matchBy("_tag", value, arms);
export const total = <K extends string, F>(names: readonly K[], f: F): { readonly [P in K]: F } => Object.fromEntries(names.map((n) => [n, f])) as { readonly [P in K]: F };
export type Kinds<K extends string, Row> = { readonly [T in K]: Row };


type Table = { readonly [event: string]: { readonly [phase: string]: readonly string[] } };
export type Grammar = { readonly table: Table; readonly replica: Tagged<string>; readonly input: { readonly kind: string }; readonly ctx: { readonly [e: string]: unknown }; readonly output: unknown; readonly error: unknown };
export type Phase<G extends Grammar> = G["replica"]["_tag"];
export type Event<G extends Grammar> = keyof G["table"] & string;
export type At<G extends Grammar, P extends string> = Of<G["replica"], P>;
export type InputFor<G extends Grammar, E extends string> = Extract<G["input"], { readonly kind: E }>;
export type Next<G extends Grammar, P extends Phase<G>, E extends Event<G>> = P extends keyof G["table"][E] ? Extract<G["table"][E][P], readonly Phase<G>[]>[number] : never;
export type Apply<R, O> = { readonly replica: R; readonly outputs: readonly O[] };
export type Handler<G extends Grammar, E extends Event<G>, P extends Phase<G>> =
  (replica: At<G, P>, input: InputFor<G, E>, ctx: G["ctx"][E]) => Result<Apply<At<G, Next<G, P, E>>, G["output"]>, G["error"]>;
export type Cases<G extends Grammar, E extends Event<G>> = { readonly [P in Phase<G>]: P extends keyof G["table"][E] ? Handler<G, E, P> : G["error"] };
export const grammar = <G extends Grammar>(_table: G["table"]) => <E extends Event<G>, C extends Cases<G, E>>(_event: E, cases: C) =>
  (replica: G["replica"], input: InputFor<G, E>, ctx: G["ctx"][E]): Result<Apply<G["replica"], G["output"]>, G["error"]> => {
    const branch = arm(cases, replica._tag as keyof C) as unknown;
    return typeof branch === "function" ? branch(replica, input, ctx) : err(branch as G["error"]);
  };
export const done = <R, O>(replica: R, outputs: readonly O[] = []): Apply<R, O> => ({ replica, outputs });

export const AccountTransition = {
  propose: { open: ["open", "proposed"] },
  ack: { open: ["open"], proposed: ["open", "proposed"], received: ["open", "received"], preparing: ["preparing"], disputed: ["disputed"] },
  ack_frame: { open: ["open", "received"], proposed: ["open", "proposed", "received"], received: ["received"], preparing: ["preparing"], disputed: ["disputed"] },
  freeze: { open: ["preparing", "disputed"], proposed: ["preparing", "disputed"], received: ["preparing", "disputed"], preparing: ["preparing", "disputed"], disputed: ["disputed"] },
  dispute: { open: ["open"], proposed: ["proposed"], received: ["received"], preparing: ["preparing"], disputed: ["disputed"] },
  board_hanko_refresh: { open: ["open"], proposed: ["proposed"], received: ["received"], preparing: ["preparing"], disputed: ["disputed"] },
  resume: { preparing: ["open"] },
  external_finality: { open: ["disputed"], proposed: ["disputed"], received: ["disputed"], preparing: ["disputed"], disputed: ["disputed"] },
} as const;
export const EntityTransition = {
  txs: { open: ["open", "proposed"], proposed: ["open", "proposed"], locked: ["open", "locked"] },
  proposal: { open: ["open", "locked"], proposed: ["open", "proposed"], locked: ["open", "locked"] },
  precommit: { open: ["open"], proposed: ["open", "proposed"], locked: ["open", "locked"] },
  leaderTimeoutVote: { open: ["open", "proposed", "locked"], proposed: ["open", "proposed"], locked: ["open", "proposed", "locked"] },
} as const;


export const AccountTxNames = ["add_delta", "set_credit_limit", "payment", "htlc_lock", "htlc_resolve", "swap_offer", "swap_cancel_request", "swap_resolve", "settle_transition",
  "j_event_claim", "cross_pull_lock", "cross_pull_close", "request_collateral", "rebalance_refund",
  "rebalance_policy", "lending_fund", "lending_borrow_request", "lending_repay", "lending_credit", "lending_close_request", "lending_close_payout"] as const;
export const LendingTxNames = ["lendingOffer", "lendingBorrow", "lendingRepay", "lendingClosePosition"] as const;
export const EntityTxNames = ["directPayment", "placeSwapOffer", "htlcPayment", "prepareCrossJurisdictionSwap", "registerCrossJurisdictionSwap"] as const;
export const AccountInputKinds = ["dispute", "board_hanko_refresh"] as const;
export const EntityInputKinds = ["leaderTimeoutVote"] as const;
export const HoleNames = ["cross_open", "reveal_before_height", "quote_last_ms", "onion"] as const;
export type Hole = (typeof HoleNames)[number];


export type Step<S, Eff> = { readonly state: S; readonly effects: readonly Eff[] };
export const step = <S, Eff = never>(state: S, effects: readonly Eff[] = []): Step<S, Eff> => ({ state, effects });
export type Layer<S, X, C, Eff, E> = (s: S, x: X, c: C) => Result<Step<S, Eff>, E>;
/** Strict fold: one refusal refuses the frame. */
export const strictFold = <S, X, C, Eff, E>(apply: Layer<S, X, C, Eff, E>) => (s: S, xs: Iterable<X>, c: C): Result<Step<S, Eff>, E> =>
  map(mapAccumResult(xs, s, (cur, x) => map(apply(cur, x, c), (r) => [r.state, r.effects] as const)), ([state, effects]) => step(state, effects.flat()));
export type Lenient<S, X, Eff, E> = Step<S, Eff> & { readonly included: readonly X[]; readonly refused: readonly { readonly index: number; readonly error: E }[] };
type LenientItem<X, Eff, E> =
  | { readonly _tag: "folded"; readonly x: X; readonly effects: readonly Eff[] }
  | { readonly _tag: "refused"; readonly index: number; readonly error: E };
/** Lenient fold: a refused item is skipped, the rest go on. */
export const lenientFold = <S, X, C, Eff, E>(apply: Layer<S, X, C, Eff, E>) => (s: S, xs: Iterable<X>, c: C): Lenient<S, X, Eff, E> => {
  const [state, outs] = mapAccum(xs, s, (cur, x, index): readonly [S, LenientItem<X, Eff, E>] => {
    const r = apply(cur, x, c);
    return r.ok ? [r.value.state, tag("folded")({ x, effects: r.value.effects })] : [cur, tag("refused")({ index, error: r.error })];
  });
  const folded = outs.flatMap((o) => (o._tag === "folded" ? [o] : []));
  return { state, effects: folded.flatMap((f) => f.effects), included: folded.map((f) => f.x), refused: outs.flatMap((o) => (o._tag === "refused" ? [{ index: o.index, error: o.error }] : [])) };
};


export const mapSet = <K, V>(m: ReadonlyMap<K, V>, k: K, v: V): ReadonlyMap<K, V> => new Map(m).set(k, v);
export const mapDelete = <K, V>(m: ReadonlyMap<K, V>, k: K): ReadonlyMap<K, V> => { const n = new Map(m); n.delete(k); return n; };
export const bump = <K>(m: ReadonlyMap<K, bigint>, k: K, d: bigint): ReadonlyMap<K, bigint> => { const v = (m.get(k) ?? 0n) + d; return v === 0n ? mapDelete(m, k) : mapSet(m, k, v); };
export const firstBy = <X, K>(xs: Iterable<X>, key: (x: X) => K | undefined, taken: Iterable<K> = []): readonly X[] => {
  const seen = new Set(taken), kept: X[] = [];
  for (const x of xs) { const k = key(x); if (k !== undefined && seen.has(k)) continue; if (k !== undefined) seen.add(k); kept.push(x); }
  return kept;
};
export type StoreStep<K, V, Y> = { readonly writes: readonly (readonly [K, V])[]; readonly out: Y; readonly stop: boolean };
export const foldStore = <K, V, X, Y>(store: ReadonlyMap<K, V>, xs: Iterable<X>, f: (read: (k: K) => V | undefined, x: X) => StoreStep<K, V, Y>): { readonly store: ReadonlyMap<K, V>; readonly outs: readonly Y[] } => {
  const copy = new Map(store), outs: Y[] = [];
  for (const x of xs) { const { writes, out, stop } = f((k) => copy.get(k), x); for (const [k, v] of writes) copy.set(k, v); outs.push(out); if (stop) break; }
  return { store: copy, outs };
};


export const asc = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
const sortedBy = <X>(xs: readonly X[], key: (x: X) => string): readonly X[] => xs.map((x) => [key(x), x] as const).sort(([a], [b]) => asc(a, b)).map(([, x]) => x);
const len = (t: string, body: string): string => `${t}${body.length}:${body}`;
export const canon = (v: unknown): string => {
  if (v === undefined) return "u";
  if (v === null) return "n";
  if (typeof v === "boolean") return v ? "T" : "F";
  if (typeof v === "bigint") return len("i", v.toString());
  if (typeof v === "string") return len("s", v);
  if (typeof v === "number") return len("d", String(v));
  if (v instanceof Map) { const rows = sortedBy([...v].map(([k, x]) => [canon(k), x] as const), ([k]) => k); return `m${len("d", String(rows.length))}${rows.map(([k, x]) => k + canon(x)).join("")}`; }
  if (Array.isArray(v)) return `a${len("d", String(v.length))}${v.map(canon).join("")}`;
  if (v instanceof Set) { const rows = [...v].map(canon).sort(asc); return `S${len("d", String(rows.length))}${rows.join("")}`; }
  if (v instanceof Uint8Array) return len("b", nobleHex(v));
  if (typeof v === "object") { const r = v as Record<string, unknown>, keys = Object.keys(r).filter((k) => r[k] !== undefined).sort(); return `o${len("d", String(keys.length))}${keys.map((k) => len("s", k) + canon(r[k])).join("")}`; }
  return "u";
};


const nib = (c: number): number => (c >= 48 && c <= 57 ? c - 48 : (c | 32) >= 97 && (c | 32) <= 102 ? (c | 32) - 87 : -1);
export const hexBody = (h: string): string => (/^0[xX]/.test(h) ? h.slice(2) : h);
export const hexToBytes = (hex: string): Uint8Array => {
  const body = hexBody(hex);
  if (body.length % 2 !== 0) throw new Error(`odd hex length ${body.length}`);
  const out = new Uint8Array(body.length / 2);
  for (let i = 0; i < out.length; i++) { const hi = nib(body.charCodeAt(2 * i)), lo = nib(body.charCodeAt(2 * i + 1)); if (hi < 0 || lo < 0) throw new Error(`bad hex at ${i}`); out[i] = (hi << 4) | lo; }
  return out;
};
export const bytesToHex = (b: Uint8Array): string => `0x${nobleHex(b)}`;
export const parseHex = (h: string): Uint8Array | null => { const b = hexBody(h); return b.length % 2 === 0 && /^[0-9a-fA-F]*$/.test(b) ? hexToBytes(h) : null; };
export const joinHex = (parts: readonly string[]): string => `0x${parts.map(hexBody).join("")}`;
export const concat = (parts: readonly Uint8Array[]): Uint8Array => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
export const utf8 = (s: string): Uint8Array => new TextEncoder().encode(s);
export const keccak256 = (b: Uint8Array): Uint8Array => keccak_256(b);
export const keccak256Hex = (b: Uint8Array): string => bytesToHex(keccak256(b));
export const wordOf = (n: bigint): Uint8Array => {
  if (n < 0n || n >= 1n << 256n) throw new Error("uint256 out of range");
  const out = new Uint8Array(32); for (let i = 31, r = n; i >= 0; i--, r >>= 8n) out[i] = Number(r & 0xffn);
  return out;
};
const INT256_MIN = -(1n << 255n), INT256_MAX = (1n << 255n) - 1n;
export const wordOfSigned = (n: bigint): Uint8Array => { if (n < INT256_MIN || n > INT256_MAX) throw new Error("int256 out of range"); return wordOf(n < 0n ? (1n << 256n) + n : n); };
export const wordAt = (buf: Uint8Array, at: number): bigint => { let n = 0n; for (let i = 0; i < 32; i++) n = (n << 8n) | BigInt(buf[at + i] ?? 0); return n; };
const sized = (n: number) => (hex: string): Uint8Array => { const b = hexToBytes(hex); if (b.length !== n) throw new Error(`${n}-byte value is ${b.length} bytes`); return b; };
const addressBytes = sized(20);
export const bytes32 = sized(32);
export const addressWord = (a: string): Uint8Array => { const out = new Uint8Array(32); out.set(addressBytes(a), 12); return out; };
const uint32Bytes = (n: number): Uint8Array => { if (!Number.isInteger(n) || n < 0 || n > 0xffff_ffff) throw new Error("uint32 out of range"); return Uint8Array.of(n >>> 24, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff); };

export type Abi = Tagged<"uint" | "int", { value: bigint }> | Tagged<"bool", { value: boolean }> | Tagged<"address" | "bytes32" | "bytes", { value: string }> | Tagged<"array" | "tuple", { value: readonly Abi[] }>;
export const A = {
  uint: (value: bigint): Abi => ({ _tag: "uint", value }), int: (value: bigint): Abi => ({ _tag: "int", value }), bool: (value: boolean): Abi => ({ _tag: "bool", value }),
  address: (value: string): Abi => ({ _tag: "address", value }), b32: (value: string): Abi => ({ _tag: "bytes32", value }), bytes: (value: string): Abi => ({ _tag: "bytes", value }),
  array: (value: readonly Abi[]): Abi => ({ _tag: "array", value }), tuple: (value: readonly Abi[]): Abi => ({ _tag: "tuple", value }),
} as const;
const arr = <X>(xs: readonly X[], f: (x: X) => Abi): Abi => A.array(xs.map((x) => f(x)));
const dynamic = (v: Abi): boolean => match(v, { uint: () => false, int: () => false, bool: () => false, address: () => false, bytes32: () => false, bytes: () => true, array: () => true, tuple: (t) => t.value.some(dynamic) });
const padRight = (b: Uint8Array): Uint8Array => { const n = Math.ceil(b.length / 32) * 32; if (n === b.length) return b; const out = new Uint8Array(n); out.set(b); return out; };
const encodeValue = (v: Abi): string => match(v, {
  uint: (x) => nobleHex(wordOf(x.value)), int: (x) => nobleHex(wordOfSigned(x.value)), bool: (x) => nobleHex(wordOf(x.value ? 1n : 0n)), address: (x) => nobleHex(addressWord(x.value)),
  bytes32: (x) => (bytes32(x.value), hexBody(x.value).toLowerCase()),
  bytes: (x) => { const b = hexToBytes(x.value); return nobleHex(wordOf(BigInt(b.length))) + nobleHex(padRight(b)); },
  array: (x) => nobleHex(wordOf(BigInt(x.value.length))) + encodeSequence(x.value), tuple: (x) => encodeSequence(x.value),
});
const encodeSequence = (vs: readonly Abi[]): string => {
  const parts = vs.map((v) => ({ dyn: dynamic(v), hex: encodeValue(v) }));
  let tail = parts.reduce((n, p) => n + (p.dyn ? 32 : p.hex.length / 2), 0);
  const heads: string[] = [], tails: string[] = [];
  for (const p of parts) { if (!p.dyn) { heads.push(p.hex); continue; } heads.push(nobleHex(wordOf(BigInt(tail)))); tails.push(p.hex); tail += p.hex.length / 2; }
  return [...heads, ...tails].join("");
};
export const abiEncodeHex = (vs: readonly Abi[]): string => `0x${encodeSequence(vs)}`;
export const abiEncode = (vs: readonly Abi[]): Uint8Array => hexToBytes(abiEncodeHex(vs));
export type Packed = Tagged<"uint256", { value: bigint }> | Tagged<"uint32", { value: number }> | Tagged<"bool", { value: boolean }> | Tagged<"address" | "bytes32" | "bytes", { value: string }>;
export const encodePacked = (parts: readonly Packed[]): Uint8Array => concat(parts.map((p) => match(p, {
  uint256: (x) => wordOf(x.value), uint32: (x) => uint32Bytes(x.value), bool: (x) => Uint8Array.of(x.value ? 1 : 0), address: (x) => addressBytes(x.value), bytes32: (x) => bytes32(x.value), bytes: (x) => hexToBytes(x.value),
})));

export type AbiTuple = Brand<number, "AbiTuple">;
export type AbiLength = Brand<number, "AbiLength">;
const T = (n: number): AbiTuple => n as AbiTuple, L = (n: number): AbiLength => n as AbiLength;
export const abiRoot = (): AbiTuple => T(0);
export const abiCursorOk = (h: AbiTuple): boolean => Number.isFinite(h) && h >= 0;
export const abiTupleRef = (buf: Uint8Array, h: AbiTuple, slot: number): AbiTuple => T(h + Number(wordAt(buf, h + slot)));
export const abiLengthRef = (buf: Uint8Array, h: AbiTuple, slot: number): AbiLength => L(h + Number(wordAt(buf, h + slot)));
export const abiWord = (buf: Uint8Array, h: AbiTuple, slot: number): bigint => wordAt(buf, h + slot);
export const abiTupleBytes = (buf: Uint8Array, h: AbiTuple, slot: number): Uint8Array => buf.subarray(h + slot, h + slot + 32);
export const abiLengthWord = (buf: Uint8Array, l: AbiLength): bigint => wordAt(buf, l);
export const abiBytes = (buf: Uint8Array, l: AbiLength): Uint8Array => buf.subarray(l + 32, l + 32 + Number(wordAt(buf, l)));
export const abiFits = (buf: Uint8Array, l: AbiLength, count: bigint, stride: number): boolean => {
  if (!Number.isFinite(l) || l < 0) return false;
  const start = l + 32;
  return start > buf.length ? count === 0n : count * BigInt(stride) <= BigInt(buf.length - start);
};
export const abiBytesElement = (buf: Uint8Array, l: AbiLength, i: number): AbiLength => L(l + 32 + Number(wordAt(buf, l + 32 + i * 32)));
export const abiTupleElement = (buf: Uint8Array, l: AbiLength, i: number): AbiTuple => T(l + 32 + Number(wordAt(buf, l + 32 + i * 32)));
export const abiInlineTuple = (l: AbiLength, i: number, stride: number): AbiTuple => T(l + 32 + i * stride);
export const abiStaticWord = (buf: Uint8Array, l: AbiLength, i: number): bigint => wordAt(buf, l + 32 + i * 32);
export const abiStaticBytes = (buf: Uint8Array, l: AbiLength, i: number): Uint8Array => buf.subarray(l + 32 + i * 32, l + 64 + i * 32);


export const signRaw = (h: Uint8Array, privateKey: Uint8Array): { readonly r: bigint; readonly s: bigint; readonly recovery: number; readonly publicKey: Uint8Array } => {
  const s = secp256k1.sign(h, privateKey, { prehash: false, lowS: true });
  return { r: s.r, s: s.s, recovery: s.recovery, publicKey: s.recoverPublicKey(h).toRawBytes(false) };
};
export const recoverPublicKey = (h: Uint8Array, r: Uint8Array, s: Uint8Array, bit: number): Uint8Array | null => {

  try { return secp256k1.Signature.fromCompact(concat([r, s])).addRecoveryBit(bit).recoverPublicKey(h).toRawBytes(false); } catch { return null; }
};
export type EntityId = Brand<string, "EntityId">;
export type TokenId = Brand<string, "TokenId">;
export type Address = Brand<string, "Address">;
export type Hash = Brand<string, "Hash">;
export type Signature = Brand<string, "Signature">;
export type HostRoot = Brand<Hash, "HostRoot">;
export type RuntimeFrameHash = Brand<Hash, "RuntimeFrameHash">;
export type EntityStateHash = Brand<Hash, "EntityStateHash">;
export type EntityFrameHash = Brand<Hash, "EntityFrameHash">;
export type AccountId = Brand<{ readonly left: EntityId; readonly right: EntityId }, "AccountId">;
const branded = <T extends string, E extends string>(s: string, e: E): Result<T, E> => (s.length === 0 || /[|;=,]/.test(s) ? err(e) : ok(s as T));
export const entityId = (s: string): Result<EntityId, "invalid_entity_id"> => branded(s, "invalid_entity_id");
export const address = (s: string): Result<Address, "invalid_address"> => branded(s, "invalid_address");
export const tokenId = (s: unknown): Result<TokenId, "invalid_token_id"> => (typeof s === "string" && /^(0|[1-9][0-9]{0,4})$/.test(s) && Number(s) <= 65_535 ? ok(s as TokenId) : err("invalid_token_id"));
export const hash = (s: string): Result<Hash, "invalid_hash"> => (/^[0-9a-f]{64}$/.test(s) ? ok(s as Hash) : err("invalid_hash"));
export const signature = (s: string): Result<Signature, "invalid_signature"> => (/^[0-9a-f]+$/.test(s) && s.length >= 2 && s.length % 2 === 0 && !/^0+$/.test(s) ? ok(s as Signature) : err("invalid_signature"));
export const ZERO_HASH = "0".repeat(64) as Hash;
export const ZERO_WORD = `0x${ZERO_HASH}`;
export const WORD = /^0x[0-9a-fA-F]{64}$/;
export const keccakUtf8 = (s: string): Hash => nobleHex(keccak_256(utf8(s))) as Hash;
export const sameHex = (a: string | undefined, b: string | undefined): boolean => a !== undefined && b !== undefined && a.toLowerCase() === b.toLowerCase();
/** Lowercase, and pad a short hex word to 32 bytes. Equal-length hex then compares as an integer. */
const normalizeId = (id: string): string => {
  const raw = id.toLowerCase();
  if (!raw.startsWith("0x")) return raw;
  const hex = raw.slice(2);
  if (!/^[0-9a-f]*$/.test(hex) || hex.length >= 64) return raw;
  return `0x${hex.padStart(64, "0")}`;
};
const before = (a: string, b: string): boolean => normalizeId(a) < normalizeId(b);
const sameId = (a: string, b: string): boolean => normalizeId(a) === normalizeId(b);
export const accountId = (a: EntityId, b: EntityId): Result<AccountId, Tagged<"same_entity">> =>
  sameId(a, b) ? err({ _tag: "same_entity" }) : ok((before(a, b) ? { left: a, right: b } : { left: b, right: a }) as AccountId);
export const isLeft = (party: EntityId, id: AccountId): boolean => party === id.left;
export const at = <T>(left: T, right: T, onLeft: boolean): T => (onLeft ? left : right);
export const other = (onLeft: boolean): boolean => !onLeft;
export type Party = { readonly self: EntityId; readonly peer: EntityId; readonly left: boolean };
export const counterpartyOf = (id: AccountId, self: EntityId): EntityId | undefined => (self === id.left ? id.right : self === id.right ? id.left : undefined);
export const partyOf = (id: AccountId, self: EntityId): Result<Party, Tagged<"unknown_signer", { entity: EntityId }>> => {
  const peer = counterpartyOf(id, self);
  return peer === undefined ? err({ _tag: "unknown_signer", entity: self }) : ok({ self, peer, left: isLeft(self, id) });
};
export const proposerIsLeft = (held: { readonly _tag: "proposed" | "received" }, party: Party): boolean => matchBy("_tag", held, { proposed: () => party.left, received: () => other(party.left) });


export type CanonicalValueError = Tagged<"non_finite_number" | "unsupported_type" | "invalid_utf8">;
type Rlp = Uint8Array | readonly Rlp[];
const magnitude = (v: bigint): Uint8Array => { const h = v.toString(16); return hexToBytes(h.length % 2 === 0 ? h : `0${h}`); };
const payload = (body: Uint8Array, list: boolean): Uint8Array => {
  if (!list && body.length === 1 && (body[0] ?? 0x80) < 0x80) return body;
  if (body.length <= 55) return concat([Uint8Array.of((list ? 0xc0 : 0x80) + body.length), body]);
  const size = magnitude(BigInt(body.length));
  return concat([Uint8Array.of((list ? 0xf7 : 0xb7) + size.length), size, body]);
};
const rlp = (n: Rlp): Uint8Array => (n instanceof Uint8Array ? payload(n, false) : payload(concat(n.map(rlp)), true));
const text = (v: string): Result<Uint8Array, CanonicalValueError> =>
  /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(v) ? err({ _tag: "invalid_utf8" }) : ok(utf8(v));
const cnode = (v: unknown): Result<Rlp, CanonicalValueError> => {
  if (v === null) return ok([utf8("null")]);
  if (typeof v === "boolean") return ok([utf8("bool"), Uint8Array.of(v ? 1 : 0)]);
  if (typeof v === "number") return Number.isFinite(v) ? ok([utf8("number"), utf8(String(v))]) : err({ _tag: "non_finite_number" });
  if (typeof v === "bigint") return ok([utf8("bigint"), Uint8Array.of(v < 0n ? 1 : 0), magnitude(v < 0n ? -v : v)]);
  if (typeof v === "string") return map(text(v), (b) => [utf8("string"), b]);
  if (Array.isArray(v)) return map(traverse(v, cnode), (ns) => [utf8("array"), ...ns]);
  if (v instanceof Map) return map(traverse(v, ([k, x]) => traverse([k, x], cnode)), (rows) => [utf8("map"), ...sortedBy(rows, (r) => bytesToHex(rlp(r[0] ?? [])))]);
  if (v instanceof Set) return map(traverse(v, cnode), (ns) => [utf8("set"), ...sortedBy(ns, (n) => bytesToHex(rlp(n)))]);
  if (typeof v === "object") {
    const r = v as Record<string, unknown>;
    return map(traverse(Object.keys(r).sort(asc).filter((k) => r[k] !== undefined), (k) => chain(text(k), (name) => map(cnode(r[k]), (n): Rlp => [name, n]))), (rows) => [utf8("object"), ...rows]);
  }
  return err({ _tag: "unsupported_type" });
};
export const encodeCanonicalValue = (v: unknown): Result<Uint8Array, CanonicalValueError> => map(cnode(v), rlp);
/** His flat integrity digest (state-root.ts:133-161): the frame hash and the state commitment are both this, under two namespaces. */
export const flatDigest = (namespace: string, sections: readonly (readonly [string, unknown])[]): Result<string, CanonicalValueError> =>
  map(traverse(sections, ([path, value]) => map(encodeCanonicalValue(value), (enc) => { const key = sha256(utf8(`xln.${namespace}.${path}`)); return { key, hex: bytesToHex(key), digest: sha256(enc) }; })),
    (leaves) => bytesToHex(sha256(concat([utf8("xln.flat-digest.v1"), ...sortedBy(leaves, (l) => l.hex).flatMap((l) => [l.key, l.digest])]))));


export type CommittedDelta = { readonly tokenId: number; readonly collateral: bigint; readonly ondelta: bigint; readonly offdelta: bigint; readonly leftCreditLimit: bigint; readonly rightCreditLimit: bigint; readonly leftAllowance: bigint; readonly rightAllowance: bigint; readonly leftHold: bigint; readonly rightHold: bigint };
export type JClaimAccumulator = { readonly version: 1; readonly root: string; readonly count: bigint };
export type CommittedMap = ReadonlyMap<number | string, unknown>;
export type Domain = { readonly chainId: number; readonly depositoryAddress: string };
export type DisputeConfig = { readonly leftResponseSeconds: number; readonly rightResponseSeconds: number };
export type CommittedAccountState = {
  readonly domain: Domain; readonly leftEntity: string; readonly rightEntity: string; readonly watchSeed: string; readonly disputeConfig: DisputeConfig;
  readonly jNonce: number; readonly lastFinalizedJHeight: number; readonly leftPendingJClaims: JClaimAccumulator; readonly rightPendingJClaims: JClaimAccumulator;
  readonly deltas: ReadonlyMap<number, CommittedDelta>; readonly locks: CommittedMap; readonly pulls: CommittedMap; readonly swapOffers: CommittedMap; readonly subcontracts: CommittedMap;
  readonly lendingIntents: CommittedMap; readonly requestedRebalance: CommittedMap; readonly requestedRebalanceFeeState: CommittedMap; readonly rebalanceFeePolicies: CommittedMap;
  readonly settlementWorkspace?: SettlementWorkspace | undefined;
};
export type CommitmentError = CanonicalValueError | Tagged<"bad_domain" | "bad_j_claims" | "bad_key" | "key_prefix_collision" | "nested_collection" | "leaf_too_large">;
const u16 = (n: number): Uint8Array => Uint8Array.of((n >> 8) & 0xff, n & 0xff);
const prefixed = (t: string): Uint8Array => concat([u16(utf8(t).length), utf8(t)]);
const LEAF = prefixed("xln.storage.merkle.leaf.v1"), BRANCH = prefixed("xln.storage.merkle.branch.v1"), EXTENSION = prefixed("xln.storage.merkle.extension.v1"), RADIX_16 = Uint8Array.of(0x10);
export const EMPTY_J_ROOT = bytesToHex(keccak256(utf8("xln.account-j-claim.empty.v1")));
const keyBytes = (key: number | string): Result<Uint8Array, CommitmentError> => {
  if (typeof key === "number") return Number.isSafeInteger(key) && key >= 0 ? ok(wordOf(BigInt(key))) : err({ _tag: "bad_key" });
  const body = utf8(key);
  return body.length > 0xffff ? err({ _tag: "bad_key" }) : ok(concat([u16(body.length), body]));
};
export type PreparedLeaf = { readonly key: Uint8Array; readonly value: Uint8Array };
type Leaf = { readonly nibbles: readonly number[]; readonly key: Uint8Array; readonly digest: Uint8Array };
type MNode = Tagged<"leaf", { leaf: Leaf }> | Tagged<"branch", { path: readonly number[]; children: ReadonlyMap<number, MNode> }>;
const nibblesOf = (b: Uint8Array): number[] => [...b].flatMap((x) => [x >> 4, x & 0x0f]);
const build = (leaves: readonly Leaf[], depth: number): MNode => {
  const [first] = leaves;
  if (first === undefined) throw new Error("unreachable: build is called with at least one leaf");
  if (leaves.length === 1) return { _tag: "leaf", leaf: first };
  let common = depth;
  while (leaves.every((l) => l.nibbles[common] === first.nibbles[common])) common++;
  const groups = new Map<number, Leaf[]>();
  for (const l of leaves) { const slot = l.nibbles[common] ?? 0; groups.set(slot, [...(groups.get(slot) ?? []), l]); }
  return { _tag: "branch", path: first.nibbles.slice(0, common), children: new Map([...groups].map(([slot, g]) => [slot, build(g, common + 1)])) };
};
const pack = (ns: readonly number[]): Uint8Array => { const out = new Uint8Array(Math.ceil(ns.length / 2)); ns.forEach((n, i) => { out[i >> 1] = (out[i >> 1] ?? 0) | (i % 2 === 0 ? n << 4 : n); }); return out; };
const nodeHash = (node: MNode): Uint8Array => match(node, {
  leaf: ({ leaf }) => sha256(concat([LEAF, leaf.key, leaf.digest])),
  branch: (b) => sha256(concat([BRANCH, RADIX_16, ...[...b.children].sort(([x], [y]) => x - y).flatMap(([slot, child]) => [Uint8Array.of(slot), edgeHash(b.path, child)])])),
});
const edgeHash = (parentPath: readonly number[], child: MNode): Uint8Array => match(child, {
  leaf: () => nodeHash(child),
  branch: (b) => { const gap = b.path.slice(parentPath.length + 1); return gap.length === 0 ? nodeHash(child) : sha256(concat([EXTENSION, RADIX_16, u16(gap.length), pack(gap), nodeHash(child)])); },
});
const holdsCollection = (v: unknown): boolean =>
  v instanceof Map || v instanceof Set || (Array.isArray(v) ? v.some(holdsCollection) : v !== null && typeof v === "object" && Object.values(v).some(holdsCollection));
const isPrefix = (short: Uint8Array, long: Uint8Array): boolean => short.length <= long.length && short.every((b, i) => b === long[i]);
const MAX_LEAF_BYTES = 10_000;
export const prepareLeaf = (key: number | string, value: unknown): Result<PreparedLeaf, CommitmentError> =>
  chain(keyBytes(key), (k): Result<PreparedLeaf, CommitmentError> => holdsCollection(value) ? err({ _tag: "nested_collection" }) : chain(encodeCanonicalValue(value), (v): Result<PreparedLeaf, CommitmentError> => v.length > MAX_LEAF_BYTES ? err({ _tag: "leaf_too_large" }) : ok({ key: k, value: v })));
export type PreparedMap = readonly PreparedLeaf[];
export const prepareMap = (m: CommittedMap): Result<PreparedMap, CommitmentError> =>
  chain(traverse(m, ([k, v]) => prepareLeaf(k, v)), (ls) => {
    const leaves = sortedBy([...new Map(ls.map((l) => [nobleHex(l.key), l])).values()], (l) => nobleHex(l.key));

    return leaves.some((cur, i) => i > 0 && isPrefix(leaves[i - 1]?.key ?? cur.key, cur.key)) ? err({ _tag: "key_prefix_collision" }) : ok(leaves);
  });
const sealRadix = (leaves: readonly Leaf[]): string => {
  if (leaves.length === 0) return ZERO_WORD;
  const top = build(leaves, 0);
  const lift = (slot: number): MNode => ({ _tag: "branch", path: [], children: new Map([[slot, top]]) });
  return bytesToHex(nodeHash(match(top, { leaf: ({ leaf }) => lift(leaf.nibbles[0] ?? 0), branch: (b) => (b.path.length === 0 ? top : lift(b.path[0] ?? 0)) })));
};
const preparedMapRoot = (m: PreparedMap): string => sealRadix(m.map((leaf) => ({ nibbles: nibblesOf(leaf.key), key: leaf.key, digest: sha256(leaf.value) })));
export const mapRoot = (m: CommittedMap): Result<string, CommitmentError> => map(prepareMap(m), preparedMapRoot);
export const domainOf = (d: Domain): Result<Domain, CommitmentError> => {
  const { chainId, depositoryAddress: a } = d;
  if (!Number.isSafeInteger(chainId) || chainId <= 0 || !/^0x[0-9a-fA-F]{40}$/.test(a)) return err({ _tag: "bad_domain" });
  const body = a.slice(2);
  if (/[a-f]/.test(body) && /[A-F]/.test(body) && checksum(a) !== a) return err({ _tag: "bad_domain" });
  return ok({ chainId, depositoryAddress: `0x${body.toLowerCase()}` });
};
const jClaims = (c: JClaimAccumulator): Result<JClaimAccumulator, CommitmentError> => {
  const root = c.root.trim().toLowerCase();
  const shaped = /^0x[0-9a-f]{64}$/.test(root) && c.count >= 0n && c.count < 1n << 64n && (root === EMPTY_J_ROOT) === (c.count === 0n);
  return shaped ? ok({ version: 1, root, count: c.count }) : err({ _tag: "bad_j_claims" });
};
const MAP_NAMES = ["deltas", "locks", "pulls", "swapOffers", "subcontracts", "lendingIntents", "requestedRebalance", "requestedRebalanceFeeState", "rebalanceFeePolicies"] as const;
type MapName = (typeof MAP_NAMES)[number];
export type PreparedCommitment = { readonly state: CommittedAccountState; readonly domain: Domain; readonly left: JClaimAccumulator; readonly right: JClaimAccumulator; readonly maps: { readonly [K in MapName]: PreparedMap } };
export const prepareState = (state: CommittedAccountState): Result<PreparedCommitment, CommitmentError> =>
  map(all({ domain: domainOf(state.domain), left: jClaims(state.leftPendingJClaims), right: jClaims(state.rightPendingJClaims), ...Object.fromEntries(MAP_NAMES.map((n) => [n, prepareMap(state[n])])) as { [K in MapName]: Result<PreparedMap, CommitmentError> } }),
    ({ domain, left, right, ...maps }) => ({ state, domain, left, right, maps }));
export const preparedRoot = ({ state, domain, left, right, maps }: PreparedCommitment): Result<string, CommitmentError> => {
  const root = (n: MapName): string => preparedMapRoot(maps[n]);
  return flatDigest("account.state", [
    ["identity", { chainId: domain.chainId, depositoryAddress: domain.depositoryAddress, leftEntity: state.leftEntity.toLowerCase(), rightEntity: state.rightEntity.toLowerCase(), watchSeed: state.watchSeed.toLowerCase() }],
    ["financial", { deltasRoot: root("deltas"), jNonce: state.jNonce, disputeConfig: state.disputeConfig }],
    ["commitments", { locksRoot: root("locks"), pullsRoot: root("pulls"), swapOffersRoot: root("swapOffers"), subcontractsRoot: root("subcontracts"), lendingIntentsRoot: root("lendingIntents"), settlementWorkspace: workspaceWithoutHankos(state.settlementWorkspace) }],
    ["jurisdiction", { lastFinalizedJHeight: state.lastFinalizedJHeight, leftPendingJClaims: left, rightPendingJClaims: right }],
    ["rebalance", { requestedRebalanceRoot: root("requestedRebalance"), requestedRebalanceFeeStateRoot: root("requestedRebalanceFeeState"), rebalanceFeePoliciesRoot: root("rebalanceFeePolicies") }],
  ]);
};
const sameValue = (a: unknown, b: unknown): boolean => {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (a instanceof Map || a instanceof Set || b instanceof Map || b instanceof Set || Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a), kb = Object.keys(b);
  return ka.length === kb.length && ka.every((k) => Object.hasOwn(b, k) && sameValue(Reflect.get(a, k), Reflect.get(b, k)));
};
const oneKeyKind = (m: CommittedMap): boolean => new Set([...m.keys()].map((k) => typeof k)).size <= 1;
const prepareMapChanges = (before: CommittedMap, after: CommittedMap): Result<void, CommitmentError> => {
  if (before === after) return ok(undefined);
  const changed = [...after].filter(([k, v]) => { const was = before.get(k); return was === undefined || !sameValue(was, v); });
  return chain(traverse(changed, ([k, v]) => prepareLeaf(k, v)), () => (changed.every(([k]) => before.has(k)) || oneKeyKind(after) ? ok(undefined) : map(prepareMap(after), () => undefined)));
};
export const prepareChanges = (before: CommittedAccountState, after: CommittedAccountState): Result<void, CommitmentError> => checks(
  sameValue(before.domain, after.domain) ? ok(undefined) : domainOf(after.domain),
  ...(["leftPendingJClaims", "rightPendingJClaims"] as const).map((side) => (sameValue(before[side], after[side]) ? ok(undefined) : jClaims(after[side]))),
  ...MAP_NAMES.map((n) => prepareMapChanges(before[n], after[n])),
);
export const accountStateCommitment = (state: CommittedAccountState): Result<string, CommitmentError> => chain(prepareState(state), preparedRoot);


export type WireTx = { readonly type: string; readonly data: unknown };
export type AccountFrameInputs = { readonly height: number; readonly timestamp: number; readonly jHeight: number; readonly prevFrameHash: string; readonly accountStateRoot: string; readonly accountTxs: readonly WireTx[] };
export type FrameHashError = CanonicalValueError | Tagged<"tx_unported", { type: string }> | Tagged<"policy_version" | "settle_witness_shape"> | ClaimError;
const fieldOf = (data: unknown, name: string): unknown => (data !== null && typeof data === "object" && Object.hasOwn(data, name) ? (data as Record<string, unknown>)[name] : undefined);
const withoutHankoWitness = (tx: WireTx): WireTx => {
  if (tx.type !== "settle_transition" || fieldOf(tx.data, "kind") !== "hanko" || tx.data === null || typeof tx.data !== "object") return tx;
  const { settlementHanko: _settlementHanko, ...rest } = tx.data as Record<string, unknown>;
  const post = rest.postProof;
  if (post === null || typeof post !== "object" || Array.isArray(post)) return { type: tx.type, data: rest };
  const { hanko: _hanko, ...postRest } = post as Record<string, unknown>;
  return { type: tx.type, data: { ...rest, postProof: postRest } };
};
const projectionRefusal = (tx: WireTx): Result<void, FrameHashError> => {
  if (tx.type === "rebalance_policy") { const v = fieldOf(tx.data, "policyVersion"); if (typeof v !== "number" || !Number.isSafeInteger(v) || v < 0) return err({ _tag: "policy_version" }); }
  // og accountTxWithoutPostCommitHankos (witness-projection.ts:53) dereferences `data.kind` and, for kind hanko, `data.postProof.hanko`.
  if (tx.type === "settle_transition" && (tx.data === null || tx.data === undefined || (fieldOf(tx.data, "kind") === "hanko" && (fieldOf(tx.data, "postProof") ?? null) === null))) return err({ _tag: "settle_witness_shape" });
  return ok(undefined);
};
export const ownWire = (tx: { readonly type: string }): WireTx => { const { type, ...data } = tx; return { type, data }; };
export const txRefusal = (own: { readonly type: string }): Result<void, FrameHashError> => { const tx = ownWire(own); return chain(projectionRefusal(tx), () => map(encodeCanonicalValue(tx), () => undefined)); };
export const accountFrameHash = (f: AccountFrameInputs): Result<string, FrameHashError> => chain(traverse(f.accountTxs, projectionRefusal), () => flatDigest("account.frame", [
  ["transition", { height: f.height, timestamp: f.timestamp, jHeight: f.jHeight, prevFrameHash: f.prevFrameHash }],
  ["transactions", f.accountTxs.map(withoutHankoWitness)],
  ["accountStateRoot", f.accountStateRoot],
]));
export const encodeFrameHash = (f: Omit<AccountFrameInputs, "accountTxs"> & { readonly accountTxs: readonly { readonly type: string; readonly data: { readonly tokenId: number; readonly amount: string } }[] }): string =>
  unwrapOr(accountFrameHash({ ...f, accountTxs: f.accountTxs.map((tx) => ({ type: tx.type, data: { tokenId: tx.data.tokenId, amount: BigInt(tx.data.amount) } })) }), (e) => { throw new Error(`frame hash cannot encode: ${e._tag}`); });


export type JAllowance = { readonly deltaIndex: bigint; readonly rightAllowance: bigint; readonly leftAllowance: bigint };
export type TransformerClause = { readonly transformerAddress: string; readonly encodedBatch: string; readonly allowances: readonly JAllowance[] };
export type ProofBody = { readonly watchSeed: string; readonly leftResponseSeconds: bigint; readonly rightResponseSeconds: bigint; readonly offdeltas: readonly bigint[]; readonly tokenIds: readonly bigint[]; readonly transformers: readonly TransformerClause[] };
export type SettlementDiff = { readonly tokenId: bigint; readonly leftDiff: bigint; readonly rightDiff: bigint; readonly collateralDiff: bigint; readonly ondeltaDiff: bigint };
export type Settlement = { readonly leftEntity: string; readonly rightEntity: string; readonly diffs: readonly SettlementDiff[]; readonly forgiveDebtsInTokenIds: readonly bigint[]; readonly sig: string; readonly nonce: bigint };
export type DisputeStart = { readonly counterentity: string; readonly nonce: bigint; readonly proposerIsLeft: boolean; readonly proofbodyHash: string; readonly initialProofbody: ProofBody; readonly watchSeed: string; readonly sig: string; readonly starterInitialArguments: string; readonly starterCounterArguments: string; readonly starterCounterProofCommitment: string };
export type CounterDispute = { readonly counterentity: string; readonly initialNonce: bigint; readonly initialProofbodyHash: string; readonly counterNonce: bigint; readonly proposerIsLeft: boolean; readonly counterProofbody: ProofBody; readonly sig: string };
export type DisputeFinalization = { readonly counterentity: string; readonly initialNonce: bigint; readonly finalNonce: bigint; readonly proposerIsLeft: boolean; readonly initialProofbodyHash: string; readonly finalProofbody: ProofBody; readonly starterArguments: string; readonly otherArguments: string; readonly sig: string; readonly startedByLeft: boolean; readonly cooperative: boolean };
export type HashLadderWitness = { readonly fillRatio: bigint; readonly fullSecret: string; readonly reveals: readonly [string, string, string, string] };
export type Batch = {
  readonly reserveToReserve: readonly { readonly receivingEntity: string; readonly tokenId: bigint; readonly amount: bigint }[];
  readonly reserveToCollateral: readonly { readonly tokenId: bigint; readonly receivingEntity: string; readonly pairs: readonly { readonly entity: string; readonly amount: bigint }[] }[];
  readonly collateralToReserve: readonly { readonly counterparty: string; readonly tokenId: bigint; readonly amount: bigint; readonly nonce: bigint; readonly sig: string }[];
  readonly settlements: readonly Settlement[]; readonly disputeStarts: readonly DisputeStart[]; readonly counterDisputes: readonly CounterDispute[]; readonly disputeFinalizations: readonly DisputeFinalization[];
  readonly externalTokenToReserve: readonly { readonly entity: string; readonly contractAddress: string; readonly externalTokenId: bigint; readonly tokenType: bigint; readonly internalTokenId: bigint; readonly amount: bigint }[];
  readonly reserveToExternalToken: readonly { readonly receivingEntity: string; readonly tokenId: bigint; readonly amount: bigint }[];
  readonly revealSecrets: readonly { readonly transformer: string; readonly secret: string }[];
  readonly hashLadderRegistrations: readonly { readonly counterpartyEntity: string; readonly targetRole: boolean; readonly fullHash: string; readonly partialRoot: string; readonly witness: HashLadderWitness }[];
};
export const BATCH_FIELDS = ["reserveToReserve", "reserveToCollateral", "collateralToReserve", "settlements", "disputeStarts", "counterDisputes", "disputeFinalizations", "externalTokenToReserve", "reserveToExternalToken", "revealSecrets", "hashLadderRegistrations"] as const;
export const emptyBatch = (): Batch => total(BATCH_FIELDS, [] as never) as Batch;
const t = A.tuple;
const allowanceAbi = (r: JAllowance): Abi => t([A.uint(r.deltaIndex), A.uint(r.rightAllowance), A.uint(r.leftAllowance)]);
const transformerAbi = (c: TransformerClause): Abi => t([A.address(c.transformerAddress), A.bytes(c.encodedBatch), arr(c.allowances, allowanceAbi)]);
/** Types.sol `Int512{int256 high; uint256 low}` (abi-money.ts encodeInt512): high is the arithmetic shift, so a value outside int512 fails the int256 word. */
const int512Abi = (n: bigint): Abi => t([A.int(n >> 256n), A.uint(n & ((1n << 256n) - 1n))]);
/** Types.sol `SignedAmount{bool negative; uint256 magnitude}` (encodeSignedAmount): ±(2^256-1), zero is never negative. */
const signedAmountAbi = (n: bigint): Abi => t([A.bool(n < 0n), A.uint(n < 0n ? -n : n)]);
const proofBodyAbi = (b: ProofBody): Abi => t([A.b32(b.watchSeed), A.uint(b.leftResponseSeconds), A.uint(b.rightResponseSeconds), arr(b.offdeltas, int512Abi), arr(b.tokenIds, A.uint), arr(b.transformers, transformerAbi)]);
const diffAbi = (d: SettlementDiff): Abi => t([A.uint(d.tokenId), signedAmountAbi(d.leftDiff), signedAmountAbi(d.rightDiff), signedAmountAbi(d.collateralDiff), signedAmountAbi(d.ondeltaDiff)]);
const witnessAbi = (w: HashLadderWitness): Abi => t([A.uint(w.fillRatio), A.b32(w.fullSecret), ...w.reveals.map((r) => A.b32(r))]);
const batchAbi = (b: Batch): Abi => t([
  arr(b.reserveToReserve, (r) => t([A.b32(r.receivingEntity), A.uint(r.tokenId), A.uint(r.amount)])),
  arr(b.reserveToCollateral, (r) => t([A.uint(r.tokenId), A.b32(r.receivingEntity), arr(r.pairs, (p) => t([A.b32(p.entity), A.uint(p.amount)]))])),
  arr(b.collateralToReserve, (r) => t([A.b32(r.counterparty), A.uint(r.tokenId), A.uint(r.amount), A.uint(r.nonce), A.bytes(r.sig)])),
  arr(b.settlements, (r) => t([A.b32(r.leftEntity), A.b32(r.rightEntity), arr(r.diffs, diffAbi), arr(r.forgiveDebtsInTokenIds, A.uint), A.bytes(r.sig), A.uint(r.nonce)])),
  arr(b.disputeStarts, (r) => t([A.b32(r.counterentity), A.uint(r.nonce), A.bool(r.proposerIsLeft), A.b32(r.proofbodyHash), proofBodyAbi(r.initialProofbody), A.b32(r.watchSeed), A.bytes(r.sig), A.bytes(r.starterInitialArguments), A.bytes(r.starterCounterArguments), A.b32(r.starterCounterProofCommitment)])),
  arr(b.counterDisputes, (r) => t([A.b32(r.counterentity), A.uint(r.initialNonce), A.b32(r.initialProofbodyHash), A.uint(r.counterNonce), A.bool(r.proposerIsLeft), proofBodyAbi(r.counterProofbody), A.bytes(r.sig)])),
  arr(b.disputeFinalizations, (r) => t([A.b32(r.counterentity), A.uint(r.initialNonce), A.uint(r.finalNonce), A.bool(r.proposerIsLeft), A.b32(r.initialProofbodyHash), proofBodyAbi(r.finalProofbody), A.bytes(r.starterArguments), A.bytes(r.otherArguments), A.bytes(r.sig), A.bool(r.startedByLeft), A.bool(r.cooperative)])),
  arr(b.externalTokenToReserve, (r) => t([A.b32(r.entity), A.address(r.contractAddress), A.uint(r.externalTokenId), A.uint(r.tokenType), A.uint(r.internalTokenId), A.uint(r.amount)])),
  arr(b.reserveToExternalToken, (r) => t([A.b32(r.receivingEntity), A.uint(r.tokenId), A.uint(r.amount)])),
  arr(b.revealSecrets, (r) => t([A.address(r.transformer), A.b32(r.secret)])),
  arr(b.hashLadderRegistrations, (r) => t([A.b32(r.counterpartyEntity), A.bool(r.targetRole), A.b32(r.fullHash), A.b32(r.partialRoot), witnessAbi(r.witness)])),
]);
export const encodeBatch = (b: Batch): string => abiEncodeHex([batchAbi(b)]);
export const encodeProofBodyBytes = (b: ProofBody): string => abiEncodeHex([proofBodyAbi(b)]);
export const J_EVENT_SIGNATURES = {
  HankoBatchProcessed: "HankoBatchProcessed(bytes32,bytes32,uint256)",
  ReserveUpdated: "ReserveUpdated(bytes32,uint256,uint256)",
  AccountSettled: "AccountSettled((bytes32,bytes32,(uint256,uint256,uint256,uint256,(int256,uint256))[],uint256)[])",
  DisputeStarted: "DisputeStarted(bytes32,bytes32,uint256,bool,bytes32,bytes32,bytes,bytes,bytes32,uint256,uint256,uint32,uint32)",
  DisputeFinalized: "DisputeFinalized(bytes32,bytes32,uint256,bytes32,bytes32)",
  SecretRevealed: "SecretRevealed(bytes32,bytes32,bytes32)",
  CounterDisputeRegistered: "CounterDisputeRegistered(bytes32,bytes32,uint256,bool,bytes32)",
  HashLadderRevealRegistered: "HashLadderRevealRegistered(bytes32,bytes32,bytes32,uint16,bytes32,bytes32[4],bool,uint256)",
  DebtCreated: "DebtCreated(bytes32,bytes32,uint256,(uint256,uint256),uint256)",
  DebtEnforced: "DebtEnforced(bytes32,bytes32,uint256,uint256,(uint256,uint256),uint256)",
  DebtForgiven: "DebtForgiven(bytes32,bytes32,uint256,(uint256,uint256),uint256)",
  FoundationBootstrapped: "FoundationBootstrapped(address,bytes32,uint256,uint256)",
  EntityRegistered: "EntityRegistered(bytes32,uint256,bytes32)",
  BoardActivated: "BoardActivated(bytes32,bytes32,bytes32,uint256)",
  EntityProviderActionExecuted: "EntityProviderActionExecuted(bytes32,uint256,bytes32,uint8)",
  EntityProviderActionCancelled: "EntityProviderActionCancelled(bytes32,uint256,bytes32,uint8,bytes32)",
} as const;
export type JEventName = keyof typeof J_EVENT_SIGNATURES;
const eventTopics = Object.fromEntries(Object.entries(J_EVENT_SIGNATURES).map(([n, s]) => [n, keccak256Hex(utf8(s))])) as Readonly<Record<JEventName, string>>;
export const jEventTopic = (n: JEventName): string => eventTopics[n];
/** og JEventMetadata (types/jurisdiction-events.ts): the EVM log position; a token row's `eventIndex` orders the rows one AccountSettled log expands into for one Entity. */
export type JEventMeta = { readonly blockNumber?: number | undefined; readonly blockHash?: string | undefined; readonly transactionHash?: string | undefined; readonly logIndex?: number | undefined };
export type TokenSettlement = { readonly tokenId: bigint; readonly leftReserve: bigint; readonly rightReserve: bigint; readonly collateral: bigint; readonly ondelta: bigint; readonly eventIndex?: number | undefined };
export type AccountSettlement = { readonly left: string; readonly right: string; readonly tokens: readonly TokenSettlement[]; readonly nonce: bigint; readonly meta?: JEventMeta | undefined };
/** og DisputeFinalizationEvidence: the reducer sidecar decoded from the finalizing transaction's calldata. */
export type DisputeFinalizationEvidence = {
  readonly sender: string; readonly counterentity: string; readonly initialNonce: bigint; readonly finalNonce: bigint; readonly initialProofbodyHash: string; readonly finalProofbodyHash: string;
  readonly proposerIsLeft: boolean; readonly leftArguments: string; readonly rightArguments: string; readonly startedByLeft: boolean; readonly sig: string;
};
export type JEventClaimBody =
  | { readonly type: "HankoBatchProcessed"; readonly entityId: string; readonly batchHash: string; readonly nonce: bigint }
  | { readonly type: "ReserveUpdated"; readonly entity: string; readonly tokenId: bigint; readonly newBalance: bigint }
  | { readonly type: "AccountSettled"; readonly settled: readonly AccountSettlement[] }
  | { readonly type: "DisputeStarted"; readonly sender: string; readonly counterentity: string; readonly nonce: bigint; readonly proposerIsLeft: boolean; readonly proofbodyHash: string; readonly watchSeed: string; readonly starterInitialArguments: string; readonly starterCounterArguments: string; readonly starterCounterProofCommitment: string; readonly disputeTimeout: bigint; readonly disputeStartTimestamp: bigint; readonly leftResponseSeconds: bigint; readonly rightResponseSeconds: bigint; readonly initialProofbody?: ProofBody | undefined; readonly batchNonce?: number | undefined }
  | { readonly type: "DisputeFinalized"; readonly sender: string; readonly counterentity: string; readonly nonce: bigint; readonly finalProofbodyHash: string; readonly finalizationEvidenceHash: string; readonly finalProofbody?: ProofBody | undefined; readonly initialProofbodyHash?: string | undefined; readonly evidence?: DisputeFinalizationEvidence | undefined; readonly batchNonce?: number | undefined }
  | { readonly type: "SecretRevealed"; readonly hashlock: string; readonly revealer: string; readonly secret: string }
  | { readonly type: "CounterDisputeRegistered"; readonly sender: string; readonly counterentity: string; readonly nonce: bigint; readonly proposerIsLeft: boolean; readonly proofbodyHash: string; readonly counterProofbody?: ProofBody | undefined }
  | { readonly type: "HashLadderRevealRegistered"; readonly entity: string; readonly counterpartyEntity: string; readonly ladderHash: string; readonly fillRatio: number; readonly fullSecret: string; readonly reveals: readonly [string, string, string, string]; readonly targetRole: boolean; readonly revealedAt: bigint }
  | { readonly type: "DebtCreated"; readonly debtor: string; readonly creditor: string; readonly tokenId: bigint; readonly amount: bigint; readonly debtIndex: bigint }
  | { readonly type: "DebtEnforced"; readonly debtor: string; readonly creditor: string; readonly tokenId: bigint; readonly amountPaid: bigint; readonly remainingAmount: bigint; readonly newDebtIndex: bigint }
  | { readonly type: "DebtForgiven"; readonly debtor: string; readonly creditor: string; readonly tokenId: bigint; readonly amountForgiven: bigint; readonly debtIndex: bigint }
  | { readonly type: "FoundationBootstrapped"; readonly recipient: string; readonly boardHash: string; readonly controlTokenId: bigint; readonly dividendTokenId: bigint }
  | { readonly type: "EntityRegistered"; readonly entityId: string; readonly entityNumber: bigint; readonly boardHash: string }
  | { readonly type: "BoardActivated"; readonly entityId: string; readonly previousBoardHash: string; readonly newBoardHash: string; readonly previousBoardValidUntil: bigint }
  | { readonly type: "EntityProviderActionExecuted"; readonly entityId: string; readonly actionNonce: bigint; readonly actionHash: string; readonly actionKind: 0 | 1 }
  | { readonly type: "EntityProviderActionCancelled"; readonly entityId: string; readonly actionNonce: bigint; readonly cancelledActionHash: string; readonly cancelledActionKind: 0 | 1; readonly cancelHash: string };
/** A decoded canonical log with its chain coordinates when the transport supplied them. */
export type JEvent = JEventClaimBody & { readonly meta?: JEventMeta | undefined };
export type ChainLog = { readonly topics: readonly string[]; readonly data: string } & JEventMeta;
const wordHex = (topic: string): string => `0x${hexBody(topic).toLowerCase().padStart(64, "0")}`;
const signedWord = (n: bigint): bigint => (n >= 1n << 255n ? n - (1n << 256n) : n);
const topicsOf = (log: ChainLog, n: number, name: string): readonly string[] => {
  const got = log.topics.slice(1, 1 + n);
  if (got.length < n) throw new Error(`${name} log is missing an indexed topic`);
  return got;
};
const readSettled = (buf: Uint8Array): readonly AccountSettlement[] => {
  if (buf.length < 64) return [];
  const countOf = (h: AbiLength, stride: number): number => { const c = abiLengthWord(buf, h); if (!abiFits(buf, h, c, stride)) throw new Error("AccountSettled log count does not fit"); return Number(c); };
  const rows = abiLengthRef(buf, abiRoot(), 0);
  return Array.from({ length: countOf(rows, 32) }, (_, i) => {
    const row = abiTupleElement(buf, rows, i), tokensAt = abiLengthRef(buf, row, 64);
    const tokens = Array.from({ length: countOf(tokensAt, 192) }, (_, k): TokenSettlement => {
      const at = abiInlineTuple(tokensAt, k, 192);
      return { tokenId: abiWord(buf, at, 0), leftReserve: abiWord(buf, at, 32), rightReserve: abiWord(buf, at, 64), collateral: abiWord(buf, at, 96), ondelta: (signedWord(abiWord(buf, at, 128)) << 256n) + abiWord(buf, at, 160) };
    });
    return { left: wordHex(bytesToHex(abiTupleBytes(buf, row, 0))), right: wordHex(bytesToHex(abiTupleBytes(buf, row, 32))), tokens, nonce: abiWord(buf, row, 96) };
  });
};
const SAFE_INT = BigInt(Number.MAX_SAFE_INTEGER);
/** og event-normalizers.ts: a normalizer returning null makes og ingress (rawEventToJEvents) throw J_EVENT_CANONICAL_PAYLOAD_INVALID. */
const invalidPayload = (name: JEventName): never => { throw new Error(`J_EVENT_CANONICAL_PAYLOAD_INVALID:${name}`); };
/** og normalizeInt: a safe integer (the ABI word is unsigned). */
const safeWord = (name: JEventName, n: bigint, min = 0n): bigint => (n >= min && n <= SAFE_INT ? n : invalidPayload(name));
/** ethers AddressCoder: toBeHex(word, 20) refuses a word wider than 20 bytes. */
const addressFromWord = (n: bigint): string => { if (n >> 160n !== 0n) throw new Error("address word exceeds 20 bytes"); return `0x${n.toString(16).padStart(40, "0")}`; };
const readOne = (log: ChainLog): JEventClaimBody | undefined => {
  const topic = log.topics[0]?.toLowerCase(), buf = hexToBytes(log.data), head = abiRoot();
  const is = (n: JEventName): boolean => topic === jEventTopic(n).toLowerCase();
  // ethers coders: uintN masks the word to N bits, bool is any non-zero word.
  const w = (i: number): bigint => abiWord(buf, head, 32 * i), h = (i: number): string => wordHex(bytesToHex(abiTupleBytes(buf, head, 32 * i))), flag = (i: number): boolean => w(i) !== 0n;
  const topics = (name: JEventName, n: number): readonly string[] => topicsOf(log, n, name).map(wordHex);
  if (topic === undefined) return undefined;
  if (is("HankoBatchProcessed")) { const [entityId = "", batchHash = ""] = topics("HankoBatchProcessed", 2); return { type: "HankoBatchProcessed", entityId, batchHash, nonce: safeWord("HankoBatchProcessed", w(0), 1n) }; }
  if (is("ReserveUpdated")) { const [entity = "", token = "0x0"] = topics("ReserveUpdated", 2); return { type: "ReserveUpdated", entity, tokenId: safeWord("ReserveUpdated", BigInt(token)), newBalance: w(0) }; }
  if (is("AccountSettled")) return { type: "AccountSettled", settled: readSettled(buf) };
  if (is("DisputeStarted")) {
    const [sender = "", counterentity = "", nonce = "0x0"] = topics("DisputeStarted", 3);
    const timeout = w(6), start = w(7), left = w(8) & 0xffff_ffffn, right = w(9) & 0xffff_ffffn;
    // og j-event-payloads.ts assertRawEventSpecificFields: a positive safe-integer clock whose timeout is exactly start + both response windows.
    if (timeout <= 0n || timeout > SAFE_INT || start <= 0n || start > SAFE_INT || timeout < start || timeout !== start + left + right) throw new Error(`J_EVENT_DISPUTE_CLOCK_INVALID:${start}:${timeout}:${left}:${right}`);
    return {
      type: "DisputeStarted", sender, counterentity, nonce: BigInt(nonce), proposerIsLeft: flag(0), proofbodyHash: h(1), watchSeed: h(2),
      starterInitialArguments: bytesToHex(abiBytes(buf, abiLengthRef(buf, head, 96))), starterCounterArguments: bytesToHex(abiBytes(buf, abiLengthRef(buf, head, 128))),
      starterCounterProofCommitment: h(5), disputeTimeout: timeout, disputeStartTimestamp: start, leftResponseSeconds: left, rightResponseSeconds: right,
    };
  }
  if (is("DisputeFinalized")) {
    const [sender = "", counterentity = "", nonce = "0x0"] = topics("DisputeFinalized", 3);
    return { type: "DisputeFinalized", sender, counterentity, nonce: BigInt(nonce), finalProofbodyHash: h(0), finalizationEvidenceHash: h(1) };
  }
  if (is("SecretRevealed")) { const [hashlock = "", revealer = ""] = topics("SecretRevealed", 2); return { type: "SecretRevealed", hashlock, revealer, secret: h(0) }; }
  if (is("CounterDisputeRegistered")) {
    const [sender = "", counterentity = "", nonce = "0x0"] = topics("CounterDisputeRegistered", 3);
    return { type: "CounterDisputeRegistered", sender, counterentity, nonce: safeWord("CounterDisputeRegistered", BigInt(nonce)), proposerIsLeft: flag(0), proofbodyHash: h(1) };
  }
  if (is("HashLadderRevealRegistered")) {
    const [entity = "", counterpartyEntity = ""] = topics("HashLadderRevealRegistered", 2), fillRatio = w(1) & 0xffffn;
    // og hashLadderRevealRegistered: a non-zero uint16 ratio and a positive safe-integer reveal time.
    if (fillRatio === 0n) return invalidPayload("HashLadderRevealRegistered");
    return { type: "HashLadderRevealRegistered", entity, counterpartyEntity, ladderHash: h(0), fillRatio: Number(fillRatio), fullSecret: h(2), reveals: [h(3), h(4), h(5), h(6)], targetRole: flag(7), revealedAt: safeWord("HashLadderRevealRegistered", w(8), 1n) };
  }
  if (is("DebtCreated")) {
    const [debtor = "", creditor = "", token = "0x0"] = topics("DebtCreated", 3);
    return { type: "DebtCreated", debtor, creditor, tokenId: safeWord("DebtCreated", BigInt(token)), amount: (w(0) << 256n) + w(1), debtIndex: safeWord("DebtCreated", w(2)) };
  }
  if (is("DebtEnforced")) {
    const [debtor = "", creditor = "", token = "0x0"] = topics("DebtEnforced", 3);
    return { type: "DebtEnforced", debtor, creditor, tokenId: safeWord("DebtEnforced", BigInt(token)), amountPaid: w(0), remainingAmount: (w(1) << 256n) + w(2), newDebtIndex: safeWord("DebtEnforced", w(3)) };
  }
  if (is("DebtForgiven")) {
    const [debtor = "", creditor = "", token = "0x0"] = topics("DebtForgiven", 3);
    return { type: "DebtForgiven", debtor, creditor, tokenId: safeWord("DebtForgiven", BigInt(token)), amountForgiven: (w(0) << 256n) + w(1), debtIndex: safeWord("DebtForgiven", w(2)) };
  }
  if (is("FoundationBootstrapped")) {
    const [recipient = "0x0", boardHash = ""] = topics("FoundationBootstrapped", 2);
    return { type: "FoundationBootstrapped", recipient: addressFromWord(BigInt(recipient)), boardHash, controlTokenId: w(0), dividendTokenId: w(1) };
  }
  if (is("EntityRegistered")) { const [entityId = "", entityNumber = "0x0"] = topics("EntityRegistered", 2); return { type: "EntityRegistered", entityId, entityNumber: BigInt(entityNumber), boardHash: h(0) }; }
  if (is("BoardActivated")) {
    const [entityId = ""] = topics("BoardActivated", 1), until = w(2);
    // og boardActivated: the previous board keeps an exclusive, non-zero validity boundary.
    return until > 0n ? { type: "BoardActivated", entityId, previousBoardHash: h(0), newBoardHash: h(1), previousBoardValidUntil: until } : invalidPayload("BoardActivated");
  }
  const actionKind = (name: JEventName, n: bigint): 0 | 1 => { const k = n & 0xffn; return k === 0n ? 0 : k === 1n ? 1 : invalidPayload(name); };
  if (is("EntityProviderActionExecuted")) {
    const [entityId = "", actionNonce = "0x0", actionHash = ""] = topics("EntityProviderActionExecuted", 3), nonce = BigInt(actionNonce);
    return nonce >= 1n ? { type: "EntityProviderActionExecuted", entityId, actionNonce: nonce, actionHash, actionKind: actionKind("EntityProviderActionExecuted", w(0)) } : invalidPayload("EntityProviderActionExecuted");
  }
  if (is("EntityProviderActionCancelled")) {
    const [entityId = "", actionNonce = "0x0", cancelledActionHash = ""] = topics("EntityProviderActionCancelled", 3), nonce = BigInt(actionNonce);
    return nonce >= 1n ? { type: "EntityProviderActionCancelled", entityId, actionNonce: nonce, cancelledActionHash, cancelledActionKind: actionKind("EntityProviderActionCancelled", w(0)), cancelHash: h(1) } : invalidPayload("EntityProviderActionCancelled");
  }
  return undefined;
};
const logMeta = (l: ChainLog): JEventMeta | undefined => {
  const meta: JEventMeta = { ...opt("blockNumber", l.blockNumber), ...opt("blockHash", l.blockHash), ...opt("transactionHash", l.transactionHash), ...opt("logIndex", l.logIndex) };
  return Object.keys(meta).length === 0 ? undefined : meta;
};
/** og decodeJEventLog + event-normalizers.ts for the Depository and EntityProvider consensus events; an unknown topic is ignored, a malformed canonical payload throws. */
export const readJEvents = (logs: readonly ChainLog[]): readonly JEvent[] => logs.flatMap((l): JEvent[] => { const r = readOne(l); if (r === undefined) return []; const meta = logMeta(l); return [meta === undefined ? r : { ...r, meta }]; });
export const readJEventVector = (inputs: { readonly logs: readonly ChainLog[] }): unknown => JSON.parse(JSON.stringify(readJEvents(inputs.logs), (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v)));
export const encodeAccountSettledData = (settled: readonly AccountSettlement[]): string => abiEncodeHex([arr(settled, (r) =>
  t([A.b32(r.left), A.b32(r.right), arr(r.tokens, (x) => t([A.uint(x.tokenId), A.uint(x.leftReserve), A.uint(x.rightReserve), A.uint(x.collateral), int512Abi(x.ondelta)])), A.uint(r.nonce)]))]);

/** A schema-driven ABI reader (ethers semantics: uint words as-is, bool any non-zero word, address refuses high bits, a pointer or length past the buffer throws). */
type AbiType = "uint" | "u8" | "u16" | "u32" | "int" | "bool" | "address" | "b32" | "bytes" | { readonly array: AbiType } | { readonly tuple: readonly AbiType[] };
type AbiValue = bigint | boolean | string | readonly AbiValue[];
const abiDyn = (ty: AbiType): boolean => (typeof ty === "string" ? ty === "bytes" : "array" in ty ? true : ty.tuple.some(abiDyn));
const abiHead = (ty: AbiType): number => (typeof ty !== "string" && "tuple" in ty && !abiDyn(ty) ? ty.tuple.reduce((n, c) => n + abiHead(c), 0) : 32);
const NARROW = { u8: 8n, u16: 16n, u32: 32n } as const;
const abiSig = (ty: AbiType): string => (typeof ty === "string" ? (ty === "b32" ? "bytes32" : ty === "uint" ? "uint256" : ty === "int" ? "int256" : ty === "u8" || ty === "u16" || ty === "u32" ? `uint${NARROW[ty]}` : ty) : "array" in ty ? `${abiSig(ty.array)}[]` : `(${ty.tuple.map(abiSig).join(",")})`);
const abiRead = (buf: Uint8Array, at: number): bigint => { if (!Number.isSafeInteger(at) || at < 0 || at + 32 > buf.length) throw new Error("ABI_DECODE_OVERRUN"); return wordAt(buf, at); };
const abiDecodeAt = (buf: Uint8Array, ty: AbiType, at: number): AbiValue => {
  if (ty === "uint") return abiRead(buf, at);
  if (ty === "u8" || ty === "u16" || ty === "u32") return abiRead(buf, at) & ((1n << NARROW[ty]) - 1n);
  if (ty === "int") return signedWord(abiRead(buf, at));
  if (ty === "bool") return abiRead(buf, at) !== 0n;
  if (ty === "address") return addressFromWord(abiRead(buf, at));
  if (ty === "b32") { abiRead(buf, at); return bytesToHex(buf.subarray(at, at + 32)); }
  if (ty === "bytes") { const n = abiRead(buf, at); if (n > BigInt(buf.length - at - 32)) throw new Error("ABI_DECODE_OVERRUN"); return bytesToHex(buf.subarray(at + 32, at + 32 + Number(n))); }
  if ("array" in ty) { const n = abiRead(buf, at); if (n * 32n > BigInt(buf.length - at - 32)) throw new Error("ABI_DECODE_OVERRUN"); return abiSequence(buf, Array.from({ length: Number(n) }, () => ty.array), at + 32); }
  return abiSequence(buf, ty.tuple, at);
};
const abiSequence = (buf: Uint8Array, tys: readonly AbiType[], base: number): readonly AbiValue[] => {
  let off = base;
  return tys.map((ty) => { const v = abiDyn(ty) ? abiDecodeAt(buf, ty, base + Number(abiRead(buf, off))) : abiDecodeAt(buf, ty, off); off += abiHead(ty); return v; });
};
const S_PROOF: AbiType = { tuple: ["b32", "u32", "u32", { array: { tuple: ["int", "uint"] } }, { array: "uint" }, { array: { tuple: ["address", "bytes", { array: { tuple: ["uint", "uint", "uint"] } }] } }] };
const S_SIGNED: AbiType = { tuple: ["bool", "uint"] };
const S_FINAL: AbiType = { tuple: ["b32", "uint", "uint", "bool", "b32", S_PROOF, "bytes", "bytes", "bytes", "bool", "bool"] };
const S_BATCH: AbiType = { tuple: [
  { array: { tuple: ["b32", "uint", "uint"] } }, { array: { tuple: ["uint", "b32", { array: { tuple: ["b32", "uint"] } }] } }, { array: { tuple: ["b32", "uint", "uint", "uint", "bytes"] } },
  { array: { tuple: ["b32", "b32", { array: { tuple: ["uint", S_SIGNED, S_SIGNED, S_SIGNED, S_SIGNED] } }, { array: "uint" }, "bytes", "uint"] } },
  { array: { tuple: ["b32", "uint", "bool", "b32", S_PROOF, "b32", "bytes", "bytes", "bytes", "b32"] } }, { array: { tuple: ["b32", "uint", "b32", "uint", "bool", S_PROOF, "bytes"] } }, { array: S_FINAL },
  { array: { tuple: ["b32", "address", "uint", "u8", "uint", "uint"] } }, { array: { tuple: ["b32", "uint", "uint"] } }, { array: { tuple: ["address", "b32"] } },
  { array: { tuple: ["b32", "bool", "b32", "b32", { tuple: ["u16", "b32", "b32", "b32", "b32", "b32"] }] } },
] };
type Row = readonly AbiValue[];
const rows = (v: AbiValue): readonly Row[] => v as readonly Row[];
const big = (v: AbiValue | undefined): bigint => v as bigint, str = (v: AbiValue | undefined): string => v as string, yes = (v: AbiValue | undefined): boolean => v as boolean;
/** og validateJBatch `integer`: token ids, nonces, windows and ratios are safe integers. */
const int = (v: AbiValue | undefined): bigint => { const n = big(v); if (n > SAFE_INT) throw new Error("J_BATCH_ABI_RESULT_INTEGER"); return n; };
/** og decodeSignedAmount: a negative zero is not a SignedAmount. */
const signedOf = (v: AbiValue | undefined): bigint => { const [neg, mag] = v as Row; if (neg === true && mag === 0n) throw new Error("ABI_MONEY_NEGATIVE_ZERO"); return neg === true ? -big(mag) : big(mag); };
const proofOf_ = (v: AbiValue | undefined): ProofBody => {
  const [watchSeed, l, r, offdeltas, tokenIds, transformers] = v as Row;
  return {
    watchSeed: str(watchSeed), leftResponseSeconds: int(l), rightResponseSeconds: int(r), offdeltas: rows(offdeltas ?? []).map(([hi, lo]) => (big(hi) << 256n) + big(lo)), tokenIds: (tokenIds as readonly bigint[]),
    transformers: rows(transformers ?? []).map(([a, e, al]) => ({ transformerAddress: str(a), encodedBatch: str(e), allowances: rows(al ?? []).map(([d, ra, la]) => ({ deltaIndex: big(d), rightAllowance: big(ra), leftAllowance: big(la) })) })),
  };
};
const finalOf = (v: Row): DisputeFinalization => {
  const [counterentity, initialNonce, finalNonce, proposerIsLeft, initialProofbodyHash, finalProofbody, starterArguments, otherArguments, sig, startedByLeft, cooperative] = v;
  return { counterentity: str(counterentity), initialNonce: int(initialNonce), finalNonce: int(finalNonce), proposerIsLeft: yes(proposerIsLeft), initialProofbodyHash: str(initialProofbodyHash), finalProofbody: proofOf_(finalProofbody), starterArguments: str(starterArguments), otherArguments: str(otherArguments), sig: str(sig), startedByLeft: yes(startedByLeft), cooperative: yes(cooperative) };
};
/** og decodeJBatch: the Depository Types.Batch tuple, SignedAmount diffs and Int512 offdeltas decoded to integers. */
export const decodeBatch = (encoded: string): Batch => {
  const [r2r, r2c, c2r, settlements, starts, counters, finals, e2r, r2e, reveals, ladders] = abiSequence(hexToBytes(encoded), [S_BATCH], 0)[0] as Row;
  return {
    reserveToReserve: rows(r2r ?? []).map(([e, tk, n]) => ({ receivingEntity: str(e), tokenId: int(tk), amount: big(n) })),
    reserveToCollateral: rows(r2c ?? []).map(([tk, e, pairs]) => ({ tokenId: int(tk), receivingEntity: str(e), pairs: rows(pairs ?? []).map(([p, n]) => ({ entity: str(p), amount: big(n) })) })),
    collateralToReserve: rows(c2r ?? []).map(([c, tk, n, nonce, sig]) => ({ counterparty: str(c), tokenId: int(tk), amount: big(n), nonce: int(nonce), sig: str(sig) })),
    settlements: rows(settlements ?? []).map(([l, r, diffs, forgive, sig, nonce]) => ({
      leftEntity: str(l), rightEntity: str(r), diffs: rows(diffs ?? []).map(([tk, ld, rd, cd, od]) => ({ tokenId: int(tk), leftDiff: signedOf(ld), rightDiff: signedOf(rd), collateralDiff: signedOf(cd), ondeltaDiff: signedOf(od) })),
      forgiveDebtsInTokenIds: (forgive as readonly AbiValue[]).map(int), sig: str(sig), nonce: int(nonce),
    })),
    disputeStarts: rows(starts ?? []).map(([c, nonce, left, hash, body, seed, sig, ia, ca, commit]) => ({ counterentity: str(c), nonce: int(nonce), proposerIsLeft: yes(left), proofbodyHash: str(hash), initialProofbody: proofOf_(body), watchSeed: str(seed), sig: str(sig), starterInitialArguments: str(ia), starterCounterArguments: str(ca), starterCounterProofCommitment: str(commit) })),
    counterDisputes: rows(counters ?? []).map(([c, initialNonce, initialHash, counterNonce, left, body, sig]) => ({ counterentity: str(c), initialNonce: int(initialNonce), initialProofbodyHash: str(initialHash), counterNonce: int(counterNonce), proposerIsLeft: yes(left), counterProofbody: proofOf_(body), sig: str(sig) })),
    disputeFinalizations: rows(finals ?? []).map(finalOf),
    externalTokenToReserve: rows(e2r ?? []).map(([e, a, x, ty, tk, n]) => ({ entity: str(e), contractAddress: str(a), externalTokenId: big(x), tokenType: int(ty), internalTokenId: int(tk), amount: big(n) })),
    reserveToExternalToken: rows(r2e ?? []).map(([e, tk, n]) => ({ receivingEntity: str(e), tokenId: int(tk), amount: big(n) })),
    revealSecrets: rows(reveals ?? []).map(([a, s]) => ({ transformer: str(a), secret: str(s) })),
    hashLadderRegistrations: rows(ladders ?? []).map(([c, role, full, partial, wit]) => {
      const [fillRatio, fullSecret, r0, r1, r2, r3] = wit as Row;
      return { counterpartyEntity: str(c), targetRole: yes(role), fullHash: str(full), partialRoot: str(partial), witness: { fillRatio: int(fillRatio), fullSecret: str(fullSecret), reveals: [str(r0), str(r1), str(r2), str(r3)] as const } };
    }),
  };
};
const selectorOf = (sig: string): string => keccak256Hex(utf8(sig)).slice(0, 10);
const PROCESS_BATCH = ["bytes", "bytes", "uint"] as const, WATCHTOWER_COUNTER: readonly AbiType[] = ["b32", S_FINAL, "uint", "uint", "bytes"];
export const PROCESS_BATCH_SELECTOR = selectorOf("processBatch(bytes,bytes,uint256)");
export const WATCHTOWER_COUNTER_DISPUTE_SELECTOR = selectorOf(`watchtowerCounterDispute(${WATCHTOWER_COUNTER.map(abiSig).join(",")})`);
type DisputeCall = Tagged<"batch", { batch: Batch }> | Tagged<"watchtower", { proof: DisputeFinalization }>;
/** og depositoryTransactionInterface.parseTransaction over the two dispute-carrying Depository calls. */
const disputeCall = (calldata: string, code: string): DisputeCall => {
  const selector = calldata.slice(0, 10).toLowerCase(), args = hexToBytes(`0x${calldata.slice(10)}`);
  try {
    if (selector === PROCESS_BATCH_SELECTOR) {
      const encoded = str(abiSequence(args, PROCESS_BATCH, 0)[0]);
      if (encoded === "0x") throw new Error(`${code}_BATCH_CALLDATA_MISSING`);
      return { _tag: "batch", batch: decodeBatch(encoded) };
    }
    if (selector === WATCHTOWER_COUNTER_DISPUTE_SELECTOR) return { _tag: "watchtower", proof: finalOf(abiSequence(args, WATCHTOWER_COUNTER, 0)[1] as Row) };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    throw new Error(message.startsWith(code) ? message : `${code}_CALLDATA_DECODE_FAILED:${message}`);
  }
  throw new Error(`${code}_CALLDATA_DECODE_FAILED:${code}_CALLDATA_UNKNOWN`);
};
export type DisputeProofEvidence = {
  readonly eventName: "DisputeStarted" | "CounterDisputeRegistered" | "DisputeFinalized"; readonly counterentity: string; readonly nonce: bigint; readonly proposerIsLeft: boolean; readonly proofbodyHash: string;
  readonly initialNonce?: bigint | undefined; readonly initialProofbodyHash?: string | undefined; readonly proofbody: ProofBody;
};
/** og decodeDisputeProofBodyEvidenceCalldata: every signed ProofBody a dispute transaction carries (a start keeps its declared hash, the others are recomputed). */
export const disputeProofEvidence = (calldata: string): readonly DisputeProofEvidence[] => {
  const call = disputeCall(calldata, "J_DISPUTE_PROOFBODY");
  const finalized = (f: DisputeFinalization): DisputeProofEvidence => ({ eventName: "DisputeFinalized", counterentity: f.counterentity.toLowerCase(), nonce: f.finalNonce, proposerIsLeft: f.proposerIsLeft, proofbodyHash: proofBodyHash(f.finalProofbody), initialNonce: f.initialNonce, initialProofbodyHash: f.initialProofbodyHash.toLowerCase(), proofbody: f.finalProofbody });
  return match(call, {
    batch: ({ batch }): readonly DisputeProofEvidence[] => [
      ...batch.disputeStarts.map((s): DisputeProofEvidence => ({ eventName: "DisputeStarted", counterentity: s.counterentity.toLowerCase(), nonce: s.nonce, proposerIsLeft: s.proposerIsLeft, proofbodyHash: s.proofbodyHash.toLowerCase(), proofbody: s.initialProofbody })),
      ...batch.counterDisputes.map((c): DisputeProofEvidence => ({ eventName: "CounterDisputeRegistered", counterentity: c.counterentity.toLowerCase(), nonce: c.counterNonce, proposerIsLeft: c.proposerIsLeft, proofbodyHash: proofBodyHash(c.counterProofbody), proofbody: c.counterProofbody })),
      ...batch.disputeFinalizations.map(finalized),
    ],
    watchtower: ({ proof }): readonly DisputeProofEvidence[] => { const f = finalized(proof); return [{ ...f, eventName: "CounterDisputeRegistered" }, f]; },
  });
};
export type TxFinalizationEvidence = Omit<DisputeFinalizationEvidence, "sender" | "finalProofbodyHash">;
/** og decodeDisputeFinalizationEvidenceCalldata. */
export const finalizationEvidence = (calldata: string): readonly TxFinalizationEvidence[] => {
  const one = (f: DisputeFinalization): TxFinalizationEvidence => ({
    counterentity: f.counterentity.toLowerCase(), initialNonce: f.initialNonce, finalNonce: f.finalNonce, initialProofbodyHash: f.initialProofbodyHash.toLowerCase(), proposerIsLeft: f.proposerIsLeft,
    leftArguments: (f.startedByLeft ? f.starterArguments : f.otherArguments).toLowerCase(), rightArguments: (f.startedByLeft ? f.otherArguments : f.starterArguments).toLowerCase(), startedByLeft: f.startedByLeft, sig: f.sig.toLowerCase(),
  });
  return match(disputeCall(calldata, "J_DISPUTE_FINALIZATION"), { batch: ({ batch }) => batch.disputeFinalizations.map(one), watchtower: ({ proof }) => [one(proof)] });
};
/** og hashFinalizationEvidence: the commitment DisputeFinalized logs as finalizationEvidenceHash. */
export const finalizationEvidenceHash = (c: TxFinalizationEvidence): string => {
  const starter = c.startedByLeft ? c.leftArguments : c.rightArguments, other = c.startedByLeft ? c.rightArguments : c.leftArguments, k = (h: string): string => keccak256Hex(hexToBytes(h));
  return keccak256Hex(abiEncode([A.b32(c.initialProofbodyHash), A.uint(c.finalNonce), A.bool(c.proposerIsLeft), A.bool(c.startedByLeft), A.b32(k(starter)), A.b32(k(other)), A.b32(k(c.sig))]));
};
/** og decodeCanonicalContractEvent: a dispute event takes its ProofBody (and a finalization its reducer evidence) from the emitting transaction's calldata; missing evidence throws. */
export const withDisputeCalldata = (event: JEvent, calldata: string): JEvent => {
  if (event.type !== "DisputeStarted" && event.type !== "CounterDisputeRegistered" && event.type !== "DisputeFinalized") return event;
  const counter = event.counterentity.toLowerCase(), declared = (event.type === "DisputeFinalized" ? event.finalProofbodyHash : event.proofbodyHash).toLowerCase();
  const found = disputeProofEvidence(calldata).find((c) => c.eventName === event.type && c.counterentity === counter && (event.type === "DisputeFinalized" ? c.initialNonce : c.nonce) === event.nonce
    && c.proofbodyHash.toLowerCase() === declared && (event.type === "DisputeFinalized" || c.proposerIsLeft === event.proposerIsLeft));
  if (found === undefined) throw new Error(`J_DISPUTE_PROOFBODY_EVIDENCE_NOT_FOUND:${event.type}:${event.nonce}`);
  if (event.type === "DisputeStarted") return { ...event, initialProofbody: found.proofbody };
  if (event.type === "CounterDisputeRegistered") return { ...event, counterProofbody: found.proofbody };
  const candidates = finalizationEvidence(calldata), tx = event.meta?.transactionHash?.toLowerCase() ?? "";
  if (candidates.length === 0) throw new Error(`J_DISPUTE_FINALIZATION_EVIDENCE_EMPTY:${tx}`);
  const matched = candidates.find((c) => c.counterentity === counter && c.initialNonce === event.nonce && finalizationEvidenceHash(c) === event.finalizationEvidenceHash.toLowerCase());
  if (matched === undefined) throw new Error(`J_DISPUTE_FINALIZATION_EVIDENCE_NOT_FOUND:${tx}`);
  return { ...event, finalProofbody: found.proofbody, initialProofbodyHash: matched.initialProofbodyHash, evidence: { sender: event.sender.toLowerCase(), ...matched, finalProofbodyHash: event.finalProofbodyHash.toLowerCase() } };
};

// ---- og entity j-events (core/entity/tx/j-events*.ts, j-events-observations/*): what one Entity derives from finalized J events ----
/** og event-observation.ts enrichDisputeBatchNonces: a dispute event takes the HankoBatchProcessed nonce its sender's batch logged in the same transaction. */
export const withBatchNonces = (events: readonly JEvent[]): readonly JEvent[] => {
  const nonces = new Map<string, bigint>();
  for (const e of events) if (e.type === "HankoBatchProcessed" && (e.meta?.transactionHash ?? "") !== "" && e.entityId !== "") nonces.set(`${(e.meta?.transactionHash ?? "").toLowerCase()}:${e.entityId.toLowerCase()}`, e.nonce);
  return events.map((e): JEvent => {
    if (e.type !== "DisputeStarted" && e.type !== "DisputeFinalized") return e;
    const n = nonces.get(`${(e.meta?.transactionHash ?? "").toLowerCase()}:${e.sender.toLowerCase()}`);
    return n === undefined ? e : { ...e, batchNonce: Number(n) };
  });
};
/** og j-event-payloads.ts expandAccountSettled + withTransportMetadata: one AccountSettled per (settlement naming the Entity, token); eventIndex only when the log yields several. */
export const entityJEvents = (events: readonly JEvent[], entity: string): readonly JEvent[] => events.flatMap((e): JEvent[] => {
  if (e.type !== "AccountSettled") return [e];
  const me = entity.toLowerCase(), rows = e.settled.filter((s) => s.left.toLowerCase() === me || s.right.toLowerCase() === me).flatMap((s) => s.tokens.map((t) => ({ s, t })));
  if (rows.length === 0) throw new Error("J_EVENT_CANONICAL_PAYLOAD_EMPTY:AccountSettled");
  return rows.map(({ s, t }, i): JEvent => ({ type: "AccountSettled", settled: [{ left: s.left, right: s.right, nonce: s.nonce, tokens: [{ ...t, ...(rows.length > 1 ? { eventIndex: i } : {}) }], ...opt("meta", e.meta) }], ...opt("meta", e.meta) }));
});
/** og types/finance/debt.ts DebtEntry (an open debt; retired entries leave the ledger). */
export type DebtEntry = {
  readonly debtId: string; readonly tokenId: number; readonly debtor: string; readonly creditor: string; readonly counterparty: string; readonly direction: "out" | "in";
  readonly createdAmount: bigint; readonly paidAmount: bigint; readonly remainingAmount: bigint; readonly createdDebtIndex: number; readonly currentDebtIndex: number; readonly status: "open";
  readonly createdAtBlock: number; readonly createdTxHash: string; readonly lastUpdatedBlock: number; readonly lastUpdatedTxHash: string; readonly lastEventType: "DebtCreated" | "DebtEnforced";
};
type DebtBook = ReadonlyMap<number, ReadonlyMap<string, DebtEntry>>;
/** og EntityState outDebtsByToken / inDebtsByToken. */
export type DebtLedger = { readonly out: DebtBook; readonly in: DebtBook };
export const EMPTY_DEBTS: DebtLedger = { out: new Map(), in: new Map() };
export type JObserveError = Tagged<"j_observe", { reason: string }>;
const observeErr = (reason: string): Result<never, JObserveError> => err({ _tag: "j_observe", reason });
const debtSide = (me: string, debtor: string, creditor: string): "out" | "in" | undefined => (me === debtor.toLowerCase() ? "out" : me === creditor.toLowerCase() ? "in" : undefined);
const putDebt = (l: DebtLedger, d: DebtEntry): DebtLedger => ({ ...l, [d.direction]: mapSet(l[d.direction], d.tokenId, mapSet(l[d.direction].get(d.tokenId) ?? new Map<string, DebtEntry>(), d.debtId, d)) });
const retireDebt = (l: DebtLedger, d: DebtEntry): DebtLedger => {
  const bucket = mapDelete(l[d.direction].get(d.tokenId) ?? new Map<string, DebtEntry>(), d.debtId);
  return { ...l, [d.direction]: bucket.size === 0 ? mapDelete(l[d.direction], d.tokenId) : mapSet(l[d.direction], d.tokenId, bucket) };
};
/** og debt.ts findEarliestOutstandingDebt: the open debt of this pair at `preferred` index, else the oldest by (created index, block, id). */
const earliestDebt = (l: DebtLedger, dir: "out" | "in", tokenId: number, debtor: string, creditor: string, preferred?: number): DebtEntry | undefined => {
  const open = [...(l[dir].get(tokenId)?.values() ?? [])].filter((d) => d.status === "open" && d.debtor.toLowerCase() === debtor.toLowerCase() && d.creditor.toLowerCase() === creditor.toLowerCase());
  if (preferred !== undefined) return open.find((d) => d.currentDebtIndex === preferred);
  return [...open].sort((x, y) => x.createdDebtIndex - y.createdDebtIndex || x.createdAtBlock - y.createdAtBlock || stableText(x.debtId, y.debtId))[0];
};
/** og j-events-observations/debt.ts applyDebtCreated / applyDebtEnforced / applyDebtForgiven for the observing Entity. */
export const applyDebtEvent = (l: DebtLedger, entity: string, e: Extract<JEvent, { readonly type: "DebtCreated" }> | Extract<JEvent, { readonly type: "DebtEnforced" }> | Extract<JEvent, { readonly type: "DebtForgiven" }>): Result<DebtLedger, JObserveError> => {
  const me = entity.toLowerCase(), tokenId = Number(e.tokenId), block = e.meta?.blockNumber ?? 0, txHash = e.meta?.transactionHash ?? "";
  if (e.type === "DebtCreated") {
    if (e.amount <= 0n) return observeErr("DEBT_CREATED_AMOUNT_INVALID");
    const index = Number(e.debtIndex), debtId = `${e.debtor.toLowerCase()}:${tokenId}:${index}:${block}:${txHash.toLowerCase()}`, dir = debtSide(me, e.debtor, e.creditor);
    if (dir === undefined) return ok(l);
    const held = l[dir].get(tokenId)?.get(debtId);
    if (held !== undefined) return held.lastEventType === "DebtCreated" && held.createdAmount === e.amount && held.remainingAmount === e.amount && held.paidAmount === 0n ? ok(l) : observeErr("DEBT_CREATED_ID_CONFLICT");
    return ok(putDebt(l, { debtId, tokenId, debtor: e.debtor, creditor: e.creditor, counterparty: dir === "out" ? e.creditor : e.debtor, direction: dir, createdAmount: e.amount, paidAmount: 0n, remainingAmount: e.amount,
      createdDebtIndex: index, currentDebtIndex: index, status: "open", createdAtBlock: block, createdTxHash: txHash, lastUpdatedBlock: block, lastUpdatedTxHash: txHash, lastEventType: "DebtCreated" }));
  }
  const dir = debtSide(me, e.debtor, e.creditor);
  if (dir === undefined) return ok(l);
  if (e.type === "DebtForgiven") {
    const d = earliestDebt(l, dir, tokenId, e.debtor, e.creditor, Number(e.debtIndex));
    if (d === undefined) return observeErr("DEBT_LEDGER_DIVERGENCE:DebtForgiven");
    return e.amountForgiven !== d.remainingAmount ? observeErr("DEBT_FORGIVEN_AMOUNT_MISMATCH") : ok(retireDebt(l, d));
  }
  const d = earliestDebt(l, dir, tokenId, e.debtor, e.creditor);
  if (d === undefined) return observeErr("DEBT_LEDGER_DIVERGENCE:DebtEnforced");
  if (e.amountPaid <= 0n || e.remainingAmount < 0n || e.amountPaid + e.remainingAmount !== d.remainingAmount) return observeErr("DEBT_ENFORCED_AMOUNT_MISMATCH");
  if (Number(e.newDebtIndex) !== (e.remainingAmount === 0n ? d.currentDebtIndex + 1 : d.currentDebtIndex)) return observeErr("DEBT_ENFORCED_INDEX_MISMATCH");
  if (e.remainingAmount === 0n) return ok(retireDebt(l, d));
  return ok(putDebt(l, { ...d, paidAmount: d.paidAmount + e.amountPaid, remainingAmount: e.remainingAmount, currentDebtIndex: Number(e.newDebtIndex), lastUpdatedBlock: block, lastUpdatedTxHash: txHash, lastEventType: "DebtEnforced" }));
};
/** The Entity-side view og's J handlers read: reserves, the debt ledger, and which counterparties hold an active Account (og AccountReplica.status). */
export type JObserver = { readonly entityId: string; readonly reserves: ReadonlyMap<number, bigint>; readonly debts: DebtLedger; readonly accounts: ReadonlyMap<string, { readonly active: boolean }> };
export type JClaimOp = { readonly accountId: string; readonly tx: TxOf<"j_event_claim"> };
export type JObservation = { readonly observer: JObserver; readonly claims: readonly JClaimOp[] };
export type JBlock = { readonly blockNumber: number; readonly events: readonly JEvent[] };
const settledRow = (row: AccountSettlement): Result<SettledEvent, JObserveError> => {
  const token = row.tokens[0];
  return token === undefined ? observeErr("J_EVENT_CANONICAL_PAYLOAD_INVALID:AccountSettled") : mapErr(settledEvent(row, token), () => ({ _tag: "j_observe", reason: "J_EVENT_CANONICAL_PAYLOAD_INVALID:AccountSettled" }));
};
/** og j-events-account.ts mergeJEventClaimOps: one claim per (account, jHeight, block) at its first position, events in canonical order, claims ordered by account, height, block. */
export const mergeClaimOps = (ops: readonly JClaimOp[]): Result<readonly JClaimOp[], JObserveError> => {
  const merged: JClaimOp[] = [], at = new Map<string, number>();
  for (const op of ops) {
    const key = `${op.accountId.toLowerCase()}:${op.tx.jHeight}:${op.tx.jBlockHash.toLowerCase()}`, i = at.get(key), target = i === undefined ? undefined : merged[i];
    if (i === undefined || target === undefined) { at.set(key, merged.length); merged.push(op); continue; }
    merged[i] = { ...target, tx: { ...target.tx, events: [...target.tx.events, ...op.tx.events] } };
  }
  return map(traverse(merged, (op) => chain(traverse(op.tx.events.flatMap((row) => row.tokens.map((t) => ({ ...row, tokens: [t] }))), (row) => map(settledRow(row), (event) => ({ row, event }))), (rows): Result<JClaimOp, JObserveError> => {
    const sorted = [...rows].sort((x, y) => compareSettled(x.event, y.event)), keys = sorted.map((r) => settledKey(r.event));
    return new Set(keys).size !== keys.length ? observeErr("ACCOUNT_J_CLAIM_EVENT_DUPLICATE") : ok({ ...op, tx: { ...op.tx, events: sorted.map((r) => r.row) } });
  })), (claims) => [...claims].sort((x, y) => stableText(x.accountId, y.accountId) || Number(x.tx.jHeight - y.tx.jHeight) || stableText(x.tx.jBlockHash, y.tx.jBlockHash)));
};
/** og applyJRangeBlocks over the reserve, settlement and debt handlers (j-events-observations/index.ts, j-events-account-settled.ts): own reserves and debts update; an AccountSettled with an active Account queues a j_event_claim for Account consensus. */
export const observeJBlocks = (o: JObserver, blocks: readonly JBlock[]): Result<JObservation, JObserveError> => {
  const me = o.entityId.toLowerCase();
  return chain(foldResult(blocks.flatMap((b) => b.events.map((e) => ({ b, e }))), { observer: o, claims: [] as readonly JClaimOp[] }, (acc, { b, e }): Result<JObservation, JObserveError> => {
    const s = acc.observer;
    if (e.type === "ReserveUpdated") return ok(e.entity.toLowerCase() === me ? { ...acc, observer: { ...s, reserves: mapSet(s.reserves, Number(e.tokenId), e.newBalance) } } : acc);
    if (e.type === "DebtCreated" || e.type === "DebtEnforced" || e.type === "DebtForgiven") return map(applyDebtEvent(s.debts, o.entityId, e), (debts) => ({ ...acc, observer: { ...s, debts } }));
    if (e.type !== "AccountSettled") return ok(acc);
    return foldResult(e.settled.flatMap((row) => row.tokens.map((t) => ({ row, t }))), acc, (a, { row, t }): Result<JObservation, JObserveError> => {
      const isLeft = row.left.toLowerCase() === me, isRight = row.right.toLowerCase() === me;
      if (!isLeft && !isRight) return ok(a);
      const counterparty = isLeft ? row.right : row.left, reserves = mapSet(a.observer.reserves, Number(t.tokenId), isLeft ? t.leftReserve : t.rightReserve), observer = { ...a.observer, reserves };
      const account = observer.accounts.get(counterparty);
      if (account === undefined || !account.active) return ok({ ...a, observer });
      const jHeight = BigInt(row.meta?.blockNumber ?? e.meta?.blockNumber ?? b.blockNumber), meta = row.meta ?? e.meta;
      const claim: TxOf<"j_event_claim"> = { type: "j_event_claim", jHeight, jBlockHash: (meta?.blockHash ?? "") as Hash, events: [{ ...row, tokens: [t], ...opt("meta", meta) }], observedAt: jHeight };
      return ok({ observer, claims: [...a.claims, { accountId: counterparty, tx: claim }] });
    });
  }), (seen) => map(mergeClaimOps(seen.claims), (claims) => ({ observer: seen.observer, claims })));
};
const SAFE_UINT = BigInt(Number.MAX_SAFE_INTEGER);
const boundaryUint = (n: bigint, code: string): Result<number, JObserveError> => (n >= 0n && n <= SAFE_UINT ? ok(Number(n)) : observeErr(code));
/** og requireFrozenAccountProofBody: the calldata ProofBody hashes to the logged hash and is the Account's frozen proof body. */
const frozenProofBody = (body: ProofBody | undefined, logged: string, frozenHash: string): Result<ProofBody, JObserveError> => {
  const want = logged.trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(want)) return observeErr("J_EVENT_DISPUTE_FINAL_PROOFBODY_HASH_INVALID");
  if (body === undefined) return observeErr("J_EVENT_DISPUTE_FINAL_PROOFBODY_INVALID");
  if (proofBodyHash(body).toLowerCase() !== want) return observeErr("J_EVENT_DISPUTE_FINAL_PROOFBODY_HASH_MISMATCH");
  return frozenHash.toLowerCase() !== want ? observeErr("DISPUTE_FROZEN_ACCOUNT_STATE_MISMATCH") : ok(body);
};
/** og applyStartedDisputeAccountInput: the Account's dispute_started finality (jNonce = the logged nonce). */
export const disputeStartedInput = (e: Extract<JEvent, { readonly type: "DisputeStarted" }> & { readonly batchNonce?: number | undefined }, observedBlockNumber: number, frozenHash: string): Result<DisputeStartedFinality, JObserveError> =>
  chain(frozenProofBody(e.initialProofbody, e.proofbodyHash, frozenHash), () => chain(boundaryUint(e.nonce, "J_EVENT_DISPUTE_NONCE_INVALID"), (initialNonce) => chain(boundaryUint(e.leftResponseSeconds, "J_EVENT_DISPUTE_LEFT_RESPONSE_SECONDS_INVALID"), (left) =>
    map(boundaryUint(e.rightResponseSeconds, "J_EVENT_DISPUTE_RIGHT_RESPONSE_SECONDS_INVALID"), (right): DisputeStartedFinality => ({
      kind: "dispute_started", starterEntityId: e.sender.toLowerCase(), initialProofbodyHash: e.proofbodyHash, initialNonce, initialProposerIsLeft: e.proposerIsLeft, disputeTimeout: Number(e.disputeTimeout), disputeStartTimestamp: Number(e.disputeStartTimestamp),
      leftResponseSeconds: left, rightResponseSeconds: right, jNonce: initialNonce, starterInitialArguments: e.starterInitialArguments || "0x", starterCounterArguments: e.starterCounterArguments || "0x", starterCounterProofCommitment: e.starterCounterProofCommitment,
      observedBlockNumber, ...opt("batchNonce", e.batchNonce),
    })))));
/** The Account dispute context og's resolveFinalizationEvidence reads (activeDispute and its selected counter-proof, when one was registered). */
export type FinalizingDispute = { readonly jNonce: number; readonly initialProposerIsLeft?: boolean | undefined; readonly selectedCounter?: { readonly nonce: number; readonly proposerIsLeft: boolean; readonly proofbodyHash: string } | undefined };
/** og applyDisputeFinalizedJEvent + resolveFinalizationEvidence: finalizedJNonce from the reducer evidence (an exact unsigned initial unilateral, or no evidence on the initial body, spends one more nonce); tokenIds from the finalized body. */
export const disputeFinalizedInput = (e: Extract<JEvent, { readonly type: "DisputeFinalized" }>, d: FinalizingDispute, frozenHash: string): Result<Extract<AccountFinality, { kind: "dispute_finalized" }>, JObserveError> =>
  chain(frozenProofBody(e.finalProofbody, e.finalProofbodyHash, frozenHash), (body) => chain(boundaryUint(e.nonce, "J_EVENT_DISPUTE_INITIAL_NONCE_INVALID"), (initialNonce) => {
    const final = e.finalProofbodyHash.trim().toLowerCase(), initialHash = (e.initialProofbodyHash ?? "").toLowerCase(), sender = e.sender.toLowerCase(), counter = e.counterentity.toLowerCase();
    const ev = e.evidence !== undefined && e.evidence.sender.toLowerCase() === sender && e.evidence.counterentity.toLowerCase() === counter && e.evidence.initialNonce === e.nonce
      && e.evidence.initialProofbodyHash.toLowerCase() === initialHash && e.evidence.finalProofbodyHash.toLowerCase() === final ? e.evidence : undefined;
    const onInitial = final === initialHash, bump = (n: number): Result<number, JObserveError> => (n >= Number.MAX_SAFE_INTEGER ? observeErr("J_EVENT_DISPUTE_FINAL_NONCE_OVERFLOW") : ok(n + 1));
    const eventNonce: Result<number, JObserveError> = ev === undefined ? (onInitial ? bump(initialNonce) : ok(initialNonce)) : chain(boundaryUint(ev.finalNonce, "J_EVENT_DISPUTE_FINAL_NONCE_INVALID"), (finalNonce) => {
      const sel = d.selectedCounter, selected = sel !== undefined && sel.nonce === finalNonce && sel.proposerIsLeft === ev.proposerIsLeft && sel.proofbodyHash.toLowerCase() === final;
      const unsigned = ev.sig.toLowerCase() === "" || ev.sig.toLowerCase() === "0x";
      return unsigned && !selected && finalNonce === initialNonce && ev.proposerIsLeft === d.initialProposerIsLeft && onInitial ? bump(initialNonce) : ok(finalNonce);
    });
    return map(eventNonce, (n) => ({ kind: "dispute_finalized", finalizedJNonce: Math.max(d.jNonce, n), finalizedTokenIds: body.tokenIds.map(Number) }));
  }));

// ---- og jBatchState (core/jurisdiction/machine/batch/{index,reserve-simulation}.ts, entity/tx/handlers/j-batch/*, j-events-batch.ts) ----
export type SentJBatch = {
  readonly batch: Batch; readonly batchHash: string; readonly encodedBatch: string; readonly entityNonce: number; readonly firstSubmittedAt: number; readonly lastSubmittedAt: number; readonly submitAttempts: number;
  readonly terminalFailure?: { readonly message: string; readonly failedAt: number } | undefined;
};
/** og JBatchState: the editable draft, the one in-flight sent batch, recovered work that broadcasts first, and the last chain-observed entity nonce. */
export type JBatchState = {
  readonly batch: Batch; readonly jurisdiction: null; readonly lastBroadcast: number; readonly broadcastCount: number; readonly failedAttempts: number; readonly status: "empty" | "accumulating" | "sent" | "failed";
  readonly sentBatch?: SentJBatch | undefined; readonly recoveryBatches?: readonly Batch[] | undefined; readonly autoBroadcastDraft?: boolean | undefined; readonly entityNonce?: number | undefined;
};
export const initJBatch = (): JBatchState => ({ batch: emptyBatch(), jurisdiction: null, lastBroadcast: 0, broadcastCount: 0, failedAttempts: 0, status: "empty" });
export const J_BATCH_LIMITS = { maxTotalOps: 50, maxSettlements: 32, maxSettlementDiffs: 32, maxSettlementForgivenessIds: 32, maxDisputeStarts: 8, maxCounterDisputes: 8, maxDisputeFinalizations: 1, maxReserveToCollateralPairs: 64, maxReserveToCollateralPairsTotal: 256, maxSecretReveals: 32, maxHashLadderRegistrations: 32 } as const;
export const batchOpCount = (b: Batch): number => BATCH_FIELDS.reduce((n, f) => n + b[f].length, 0);
const batchEmpty = (b: Batch): boolean => batchOpCount(b) === 0;
export const hasJBatchWork = (s: JBatchState): boolean => (s.recoveryBatches ?? []).some((b) => !batchEmpty(b)) || !batchEmpty(s.batch);
export type JBatchError = Tagged<"j_batch", { reason: string }>;
const batchErr = (reason: string): Result<never, JBatchError> => err({ _tag: "j_batch", reason });
const pairCount = (b: Batch): number => b.reserveToCollateral.reduce((n, op) => n + op.pairs.length, 0);
/** og getJBatchContractLimitIssue. */
export const jBatchLimitIssue = (b: Batch): string | undefined => {
  const L = J_BATCH_LIMITS, over = ([name, n, max]: readonly [string, number, number]): string | undefined => (n > max ? `${name} ${n}/${max}` : undefined);
  const first = [["total ops", batchOpCount(b), L.maxTotalOps], ["settlements", b.settlements.length, L.maxSettlements], ["disputeStarts", b.disputeStarts.length, L.maxDisputeStarts], ["counterDisputes", b.counterDisputes.length, L.maxCounterDisputes],
    ["disputeFinalizations", b.disputeFinalizations.length, L.maxDisputeFinalizations], ["revealSecrets", b.revealSecrets.length, L.maxSecretReveals], ["hashLadderRegistrations", b.hashLadderRegistrations.length, L.maxHashLadderRegistrations]] as const;
  for (const row of first) { const issue = over(row); if (issue !== undefined) return issue; }
  for (const [i, op] of b.reserveToCollateral.entries()) {
    if (op.tokenId <= 0n || op.tokenId > SAFE_UINT) return `reserveToCollateral[${i}].tokenId must be a positive safe integer`;
    if (op.pairs.length === 0) return `reserveToCollateral[${i}].pairs must not be empty`;
    if (op.pairs.some((p) => p.amount <= 0n)) return `reserveToCollateral[${i}].pairs amounts must be positive`;
    if (op.pairs.length > L.maxReserveToCollateralPairs) return `reserveToCollateral[${i}].pairs ${op.pairs.length}/${L.maxReserveToCollateralPairs}`;
  }
  if (pairCount(b) > L.maxReserveToCollateralPairsTotal) return `reserveToCollateral.pairs total ${pairCount(b)}/${L.maxReserveToCollateralPairsTotal}`;
  for (const [i, s] of b.settlements.entries()) {
    if (s.diffs.length > L.maxSettlementDiffs) return `settlements[${i}].diffs ${s.diffs.length}/${L.maxSettlementDiffs}`;
    if (s.forgiveDebtsInTokenIds.length > L.maxSettlementForgivenessIds) return `settlements[${i}].forgiveDebtsInTokenIds ${s.forgiveDebtsInTokenIds.length}/${L.maxSettlementForgivenessIds}`;
  }
  return undefined;
};
export type ReserveOpType = "reserveToReserve" | "settlement" | "reserveToCollateral" | "reserveToExternalToken";
/** og DraftBatchReserveIssue: the op whose outflow reverts the whole batch on chain. */
export type ReserveIssue = {
  readonly tokenId: number; readonly opType: ReserveOpType; readonly opIndex: number; readonly failureMode: "batchRevert"; readonly requiredAmount: bigint;
  readonly availableAfterDebt: bigint; readonly debtClaimPaid: bigint; readonly remainingDebtAfterSweep: bigint; readonly unrepaidDeficit: bigint;
};
export type ReserveSimulation = { readonly issues: readonly ReserveIssue[]; readonly reservesByToken: ReadonlyMap<number, bigint>; readonly outgoingDebtByToken: ReadonlyMap<number, bigint>; readonly deficitByToken: ReadonlyMap<number, bigint> };
/** og getOpenOutgoingDebtTotals: the open outgoing debt per token. */
export const openOutgoingDebtTotals = (book: DebtBook): ReadonlyMap<number, bigint> =>
  new Map([...book].flatMap(([tk, bucket]) => { const total = [...bucket.values()].reduce((n, d) => (d.status === "open" ? n + d.remainingAmount : n), 0n); return total > 0n ? [[tk, total] as const] : []; }));
type DebtSweep = { readonly availableAfterDebt: bigint; readonly debtClaimPaid: bigint; readonly remainingDebtAfterSweep: bigint };
/** og simulateDraftBatchReserveAvailability: Depository._processBatch for the initiator's own reserves: FIFO debt sweeps before every outflow, the implicit flash deficit a debt-free initiator may open, and a revert unless every deficit is repaid. */
export const simulateBatchReserves = (entity: string, reserves: ReadonlyMap<number, bigint>, batch: Batch, outgoingDebt: ReadonlyMap<number, bigint>): ReserveSimulation => {
  const me = entity.toLowerCase(), res = new Map(reserves), debt = new Map(outgoingDebt), deficit = new Map<number, bigint>(), issues: ReserveIssue[] = [];
  const origins = new Map<number, DebtSweep & { readonly opType: ReserveOpType; readonly opIndex: number; readonly requiredAmount: bigint }>();
  const read = (m: ReadonlyMap<number, bigint>, t: number): bigint => m.get(t) ?? 0n;
  const write = (m: Map<number, bigint>, t: number, a: bigint): void => { if (a === 0n) m.delete(t); else m.set(t, a); };
  const credit = (t: number, a: bigint): void => {
    if (a <= 0n) return;
    const owed = read(deficit, t), repaid = a < owed ? a : owed;
    write(deficit, t, owed - repaid);
    if (a - repaid > 0n) write(res, t, read(res, t) + (a - repaid));
  };
  const debit = (t: number, a: bigint, remainingDebt: bigint): "spent" | "deficit" | "rejected" => {
    const reserve = read(res, t);
    if (reserve >= a) { write(res, t, reserve - a); return "spent"; }
    if (remainingDebt !== 0n) return "rejected";
    write(deficit, t, read(deficit, t) + (a - reserve)); write(res, t, 0n);
    return "deficit";
  };
  const sweep = (t: number): DebtSweep => {
    const reserve = read(res, t), owed = read(debt, t), paid = reserve < owed ? reserve : owed;
    write(res, t, reserve - paid); write(debt, t, owed - paid);
    return { availableAfterDebt: reserve - paid, debtClaimPaid: paid, remainingDebtAfterSweep: owed - paid };
  };
  const origin = (t: number, s: DebtSweep, opType: ReserveOpType, opIndex: number, requiredAmount: bigint): void => { if (!origins.has(t)) origins.set(t, { ...s, opType, opIndex, requiredAmount }); };
  const revert = (s: DebtSweep, tokenId: number, opType: ReserveOpType, opIndex: number, requiredAmount: bigint, unrepaidDeficit: bigint): void => { issues.push({ tokenId, opType, opIndex, failureMode: "batchRevert", requiredAmount, ...s, unrepaidDeficit }); };
  const spend = (t: number, a: bigint, opType: ReserveOpType, i: number): boolean => {
    const s = sweep(t), outcome = debit(t, a, s.remainingDebtAfterSweep);
    if (outcome === "rejected") { revert(s, t, opType, i, a, 0n); return false; }
    if (outcome === "deficit") origin(t, s, opType, i, a);
    return true;
  };
  for (const op of batch.externalTokenToReserve) if ((op.entity === "" ? me : op.entity.toLowerCase()) === me) credit(Number(op.internalTokenId), op.amount);
  for (const [i, op] of batch.reserveToReserve.entries()) if (spend(Number(op.tokenId), op.amount, "reserveToReserve", i) && op.receivingEntity.toLowerCase() === me) credit(Number(op.tokenId), op.amount);
  for (const op of batch.collateralToReserve) credit(Number(op.tokenId), op.amount);
  const own = (s: Settlement, d: SettlementDiff): bigint => (s.leftEntity.toLowerCase() === me ? d.leftDiff : s.rightEntity.toLowerCase() === me ? d.rightDiff : 0n);
  const sweeps = new Map<number, DebtSweep>();
  for (const s of batch.settlements) for (const d of s.diffs) {
    if (own(s, d) >= 0n) continue;
    const t = Number(d.tokenId), swept = sweep(t), prior = sweeps.get(t);
    sweeps.set(t, { availableAfterDebt: swept.availableAfterDebt, debtClaimPaid: (prior?.debtClaimPaid ?? 0n) + swept.debtClaimPaid, remainingDebtAfterSweep: swept.remainingDebtAfterSweep });
  }
  for (const [i, s] of batch.settlements.entries()) {
    if (s.leftEntity.toLowerCase() !== me && s.rightEntity.toLowerCase() !== me) continue;
    const blocked = s.diffs.find((d) => { const o = own(s, d), t = Number(d.tokenId), have = read(res, t) > read(debt, t) ? read(res, t) - read(debt, t) : 0n; return o < 0n && have < -o && read(debt, t) !== 0n; });
    if (blocked !== undefined) {
      const t = Number(blocked.tokenId), have = read(res, t) > read(debt, t) ? read(res, t) - read(debt, t) : 0n;
      revert({ availableAfterDebt: have, debtClaimPaid: sweeps.get(t)?.debtClaimPaid ?? 0n, remainingDebtAfterSweep: read(debt, t) }, t, "settlement", i, -own(s, blocked), 0n);
      continue;
    }
    for (const d of s.diffs) {
      const o = own(s, d), t = Number(d.tokenId);
      if (o >= 0n) { credit(t, o); continue; }
      const snap: DebtSweep = { availableAfterDebt: read(res, t), debtClaimPaid: sweeps.get(t)?.debtClaimPaid ?? 0n, remainingDebtAfterSweep: read(debt, t) };
      if (debit(t, -o, snap.remainingDebtAfterSweep) === "deficit") origin(t, snap, "settlement", i, -o);
    }
  }
  for (const [i, op] of batch.reserveToCollateral.entries()) spend(Number(op.tokenId), op.pairs.reduce((n, p) => n + p.amount, 0n), "reserveToCollateral", i);
  for (const [i, op] of batch.reserveToExternalToken.entries()) spend(Number(op.tokenId), op.amount, "reserveToExternalToken", i);
  const open = [...deficit].find(([, d]) => d !== 0n);
  if (open !== undefined) {
    const o = origins.get(open[0]);
    if (o === undefined) throw new Error(`DRAFT_BATCH_DEFICIT_WITHOUT_ORIGIN:${open[0]}`);
    const { opType, opIndex, requiredAmount, ...s } = o;
    revert(s, open[0], opType, opIndex, requiredAmount, open[1]);
  }
  return issues.length > 0 ? { issues, reservesByToken: new Map(reserves), outgoingDebtByToken: new Map(outgoingDebt), deficitByToken: new Map() } : { issues, reservesByToken: res, outgoingDebtByToken: debt, deficitByToken: deficit };
};
export type ReserveCandidate =
  | { readonly type: "reserveToReserve"; readonly receivingEntity: string; readonly tokenId: number; readonly amount: bigint }
  | { readonly type: "reserveToCollateral"; readonly receivingEntity: string; readonly counterparty: string; readonly tokenId: number; readonly amount: bigint }
  | { readonly type: "reserveToExternalToken"; readonly receivingEntity: string; readonly tokenId: number; readonly amount: bigint };
/** og j-batch-reserve-admission.ts appendCandidate: an R2C joins the (receivingEntity, tokenId) entry, adding to or opening its pair. */
const appendCandidate = (b: Batch, c: ReserveCandidate): { readonly batch: Batch; readonly index: number } => {
  if (c.type !== "reserveToCollateral") return { batch: { ...b, [c.type]: [...b[c.type], { receivingEntity: c.receivingEntity, tokenId: BigInt(c.tokenId), amount: c.amount }] }, index: b[c.type].length };
  const at = b.reserveToCollateral.findIndex((op) => op.receivingEntity === c.receivingEntity && op.tokenId === BigInt(c.tokenId));
  if (at < 0) return { batch: { ...b, reserveToCollateral: [...b.reserveToCollateral, { tokenId: BigInt(c.tokenId), receivingEntity: c.receivingEntity, pairs: [{ entity: c.counterparty, amount: c.amount }] }] }, index: b.reserveToCollateral.length };
  const op = b.reserveToCollateral[at]!, has = op.pairs.some((p) => p.entity === c.counterparty);
  const pairs = has ? op.pairs.map((p) => (p.entity === c.counterparty ? { ...p, amount: p.amount + c.amount } : p)) : [...op.pairs, { entity: c.counterparty, amount: c.amount }];
  return { batch: { ...b, reserveToCollateral: b.reserveToCollateral.map((x, i) => (i === at ? { ...x, pairs } : x)) }, index: at };
};
/** The Entity-side view og's j-batch handlers read. */
export type JEntity = { readonly entityId: string; readonly reserves: ReadonlyMap<number, bigint>; readonly debts: DebtLedger; readonly jBatch?: JBatchState | undefined; readonly accounts: ReadonlySet<string> };
/** og getReserveCandidateIssue: simulate the draft with the candidate appended; the candidate's own issue, else the draft's first. */
export const reserveCandidateIssue = (e: JEntity, c: ReserveCandidate): ReserveIssue | undefined => {
  const { batch, index } = appendCandidate(e.jBatch?.batch ?? emptyBatch(), c), sim = simulateBatchReserves(e.entityId, e.reserves, batch, openOutgoingDebtTotals(e.debts.out));
  return sim.issues.find((i) => i.opType === c.type && i.opIndex === index) ?? sim.issues[0];
};
const accumulating = (s: JBatchState, batch: Batch): JBatchState => ({ ...s, batch, status: s.status === "empty" ? "accumulating" : s.status });
const batchRoom = (b: Batch, op: string): Result<void, JBatchError> => guard(batchOpCount(b) + 1 <= J_BATCH_LIMITS.maxTotalOps, { _tag: "j_batch", reason: `J_BATCH_LIMIT_EXCEEDED: ${op}` });
/** og batchAddReserveToReserve / batchAddReserveToExternal / batchAddExternalTokenToReserve: one appended op within the 50-op contract limit. */
const addOp = <F extends "reserveToReserve" | "reserveToExternalToken" | "externalTokenToReserve">(s: JBatchState, field: F, op: Batch[F][number], label: string): Result<JBatchState, JBatchError> =>
  map(batchRoom(s.batch, label), () => accumulating(s, { ...s.batch, [field]: [...s.batch[field], op] }));
/** og batchAddReserveToCollateral: aggregate into the (receivingEntity, tokenId) entry within the pair limits. */
export const addReserveToCollateral = (s: JBatchState, entity: string, counterparty: string, tokenId: number, amount: bigint): Result<JBatchState, JBatchError> => {
  if (amount <= 0n) return batchErr("R2C_AMOUNT_MUST_BE_POSITIVE");
  if (!Number.isSafeInteger(tokenId) || tokenId <= 0) return batchErr("R2C_TOKEN_ID_INVALID");
  if (entity === "" || counterparty === "" || entity === counterparty) return batchErr("R2C_ACCOUNT_PARTIES_INVALID");
  const existing = s.batch.reserveToCollateral.find((op) => op.receivingEntity === entity && op.tokenId === BigInt(tokenId)), total = pairCount(s.batch);
  if (existing !== undefined && existing.pairs.some((p) => p.entity === counterparty)) return ok(accumulating(s, appendCandidate(s.batch, { type: "reserveToCollateral", receivingEntity: entity, counterparty, tokenId, amount }).batch));
  if (existing === undefined && batchOpCount(s.batch) + 1 > J_BATCH_LIMITS.maxTotalOps) return batchErr("J_BATCH_LIMIT_EXCEEDED: reserveToCollateral");
  if (total + 1 > J_BATCH_LIMITS.maxReserveToCollateralPairsTotal) return batchErr("J_BATCH_LIMIT_EXCEEDED: reserveToCollateral.pairs total");
  if (existing !== undefined && existing.pairs.length + 1 > J_BATCH_LIMITS.maxReserveToCollateralPairs) return batchErr("J_BATCH_LIMIT_EXCEEDED: reserveToCollateral.pairs");
  return ok(accumulating(s, appendCandidate(s.batch, { type: "reserveToCollateral", receivingEntity: entity, counterparty, tokenId, amount }).batch));
};
/** `note`: og's addMessage text when the handler refuses without throwing (r2c leaves the Entity unchanged). */
export type JQueued = { readonly jBatch: JBatchState; readonly note?: string | undefined };
const insufficient = (issue: ReserveIssue, amount: bigint, tokenId: number): string => `Insufficient spendable reserve: have ${issue.availableAfterDebt}, need ${amount} token ${tokenId}`;
/** og handleR2R: debt-aware reserve admission, then queue (reserves move only when the batch's J events finalize). */
export const queueR2R = (e: JEntity, to: string, tokenId: number, amount: bigint): Result<JBatchState, JBatchError> => {
  const issue = reserveCandidateIssue(e, { type: "reserveToReserve", receivingEntity: to, tokenId, amount });
  return issue !== undefined ? batchErr(insufficient(issue, amount, tokenId)) : addOp(e.jBatch ?? initJBatch(), "reserveToReserve", { receivingEntity: to, tokenId: BigInt(tokenId), amount }, "reserveToReserve");
};
/** og handleR2E. */
export const queueR2E = (e: JEntity, receivingEntity: string, tokenId: number, amount: bigint): Result<JBatchState, JBatchError> => {
  const issue = reserveCandidateIssue(e, { type: "reserveToExternalToken", receivingEntity, tokenId, amount });
  return issue !== undefined ? batchErr(insufficient(issue, amount, tokenId)) : addOp(e.jBatch ?? initJBatch(), "reserveToExternalToken", { receivingEntity, tokenId: BigInt(tokenId), amount }, "reserveToExternalToken");
};
/** og handleE2R: a non-zero token contract and a positive amount, credited to this Entity when the batch executes. */
export const queueE2R = (e: JEntity, x: { readonly contractAddress: string; readonly amount: bigint; readonly tokenType?: number | undefined; readonly externalTokenId?: bigint | undefined; readonly internalTokenId?: number | undefined }): Result<JBatchState, JBatchError> => {
  if (!/^0x[0-9a-fA-F]{40}$/.test(x.contractAddress) || /^0x0{40}$/.test(x.contractAddress)) return batchErr(`Invalid external token contract: ${x.contractAddress}`);
  if (x.amount <= 0n) return batchErr("External → Reserve amount must be positive");
  return addOp(e.jBatch ?? initJBatch(), "externalTokenToReserve", { entity: e.entityId, contractAddress: x.contractAddress, externalTokenId: x.externalTokenId ?? 0n, tokenType: BigInt(x.tokenType ?? 0), internalTokenId: BigInt(x.internalTokenId ?? 0), amount: x.amount }, "externalTokenToReserve");
};
/** og handleR2C (no rebalance quote): admission, debt-aware reserve and local-account checks refuse with a note and leave the draft unchanged. */
export const queueR2C = (e: JEntity, counterparty: string, tokenId: number, amount: bigint, receivingEntityId?: string): Result<JQueued, JBatchError> => {
  const receiving = (receivingEntityId ?? e.entityId).trim().toLowerCase(), local = receiving === e.entityId.trim().toLowerCase(), unchanged = e.jBatch ?? initJBatch();
  if (amount <= 0n || !Number.isSafeInteger(tokenId) || tokenId <= 0) return ok({ jBatch: unchanged, note: "Collateral deposit requires a positive amount and registered tokenId" });
  if (receiving === "" || receiving === counterparty.toLowerCase()) return ok({ jBatch: unchanged, note: "Collateral deposit requires two distinct non-empty entities" });
  const issue = reserveCandidateIssue(e, { type: "reserveToCollateral", receivingEntity: receiving, counterparty, tokenId, amount });
  if (issue !== undefined) return ok({ jBatch: unchanged, note: `Insufficient spendable reserve for collateral deposit: have ${issue.availableAfterDebt}, need ${amount} token ${tokenId}` });
  if (local && !e.accounts.has(counterparty)) return ok({ jBatch: unchanged, note: "Cannot deposit collateral: no account" });
  return map(addReserveToCollateral(unchanged, receiving, counterparty, tokenId, amount), (jBatch) => ({ jBatch }));
};
/** og takeBroadcastBatch: dispute work broadcasts first (one finalization at a time; registrations with starts); everything else waits in the remainder. */
export const takeBroadcastBatch = (b: Batch): { readonly selected: Batch; readonly remainder: Batch; readonly disputePriority: boolean } => {
  if (b.disputeStarts.length === 0 && b.counterDisputes.length === 0 && b.disputeFinalizations.length === 0) return { selected: b, remainder: emptyBatch(), disputePriority: false };
  const base = { disputeStarts: b.disputeStarts, counterDisputes: b.counterDisputes, revealSecrets: b.revealSecrets };
  if (b.hashLadderRegistrations.length > 0) return { selected: { ...emptyBatch(), ...base, hashLadderRegistrations: b.hashLadderRegistrations }, remainder: { ...b, disputeStarts: [], counterDisputes: [], hashLadderRegistrations: [], revealSecrets: [] }, disputePriority: true };
  return { selected: { ...emptyBatch(), ...base, disputeFinalizations: b.disputeFinalizations.slice(0, 1) }, remainder: { ...b, disputeStarts: [], counterDisputes: [], disputeFinalizations: b.disputeFinalizations.slice(1), revealSecrets: [] }, disputePriority: true };
};
/** og JTx `batch` (types/jurisdiction-runtime.ts) as j_broadcast emits it, before the quorum Hanko is attached. */
export type JBatchTx = { readonly type: "batch"; readonly entityId: string; readonly data: { readonly batch: Batch; readonly batchHash: string; readonly encodedBatch: string; readonly entityNonce: number; readonly batchGeneration: number; readonly batchSize: number; readonly signerId: string }; readonly timestamp: number };
/** og HashToSign of type "jBatch" (the Entity quorum signs the batch hash for Hanko). */
export type JBatchHashToSign = { readonly hash: string; readonly type: "jBatch"; readonly context: string };
export type Broadcast = { readonly jBatch: JBatchState; readonly jTx?: JBatchTx | undefined; readonly hashToSign?: JBatchHashToSign | undefined; readonly note?: string | undefined };
/** og handleJBroadcast: refuse while a batch is in flight; skip an empty draft; seal the next batch (recovery first) at entityNonce + 1, park the rest, and hand its batch hash to the quorum. */
export const jBroadcast = (s: JBatchState | undefined, ctx: { readonly entityId: string; readonly chainId: number; readonly depository: string; readonly signerId: string; readonly timestamp: number }): Result<Broadcast, JBatchError> => {
  if (s === undefined) return batchErr("No jBatchState found for j_broadcast");
  if (s.sentBatch !== undefined) return batchErr(`Cannot broadcast: sentBatch pending nonce=${s.sentBatch.entityNonce} attempts=${s.sentBatch.submitAttempts}`);
  if (!hasJBatchWork(s)) return ok({ jBatch: s, note: "j_broadcast skipped: jBatch is empty" });
  if (ctx.chainId === 0) return ok({ jBatch: s, note: "Missing chainId" });
  if (ctx.signerId === "") return ok({ jBatch: s, note: "No signerId available" });
  const recovery = s.recoveryBatches?.[0], fromRecovery = recovery !== undefined && !batchEmpty(recovery), { selected, remainder } = takeBroadcastBatch(fromRecovery ? recovery : s.batch);
  if (!domainOf({ chainId: ctx.chainId, depositoryAddress: ctx.depository }).ok || /^0x0{40}$/.test(ctx.depository)) return batchErr(`INVALID_HANKO_DOMAIN:${ctx.chainId}:${ctx.depository}`);
  const limit = jBatchLimitIssue(selected);
  if (limit !== undefined) return batchErr(`J_BATCH_LIMIT_EXCEEDED: j_broadcast: ${limit}`);
  const nonce = (s.entityNonce ?? 0) + 1, encodedBatch = encodeBatch(selected), batchHash = encodeBatchHash({ chainId: ctx.chainId, depository: ctx.depository, encodedBatch, nonce: String(nonce) }), generation = s.broadcastCount + 1;
  const queue = fromRecovery ? (batchEmpty(remainder) ? (s.recoveryBatches ?? []).slice(1) : [remainder, ...(s.recoveryBatches ?? []).slice(1)]) : s.recoveryBatches;
  const { recoveryBatches: _r, autoBroadcastDraft: _a, ...rest } = s;
  const parked: JBatchState = { ...rest, batch: fromRecovery ? s.batch : remainder, ...(queue === undefined || queue.length === 0 ? {} : { recoveryBatches: queue }) };
  const jBatch: JBatchState = { ...parked, ...(hasJBatchWork(parked) ? { autoBroadcastDraft: true } : {}), sentBatch: { batch: selected, batchHash, encodedBatch, entityNonce: nonce, firstSubmittedAt: ctx.timestamp, lastSubmittedAt: 0, submitAttempts: 0 }, broadcastCount: generation, lastBroadcast: ctx.timestamp, status: "sent" };
  return ok({ jBatch, jTx: { type: "batch", entityId: ctx.entityId, data: { batch: selected, batchHash, encodedBatch, entityNonce: nonce, batchGeneration: generation, batchSize: batchOpCount(selected), signerId: ctx.signerId }, timestamp: ctx.timestamp },
    hashToSign: { hash: batchHash, type: "jBatch", context: `jBatch:${ctx.entityId.slice(-4)}:nonce:${nonce}` } });
};
/** og j-events-batch.ts applyHankoBatchProcessedEvent: the chain nonce is authoritative; the exact pending (nonce, hash) finalizes, a different hash at or past it quarantines the pending batch.
 *  `autoBroadcast`: og finalizePendingBatch queues a follow-up j_broadcast when the sealed batch parked work behind it. */
export type BatchProcessed = { readonly jBatch: JBatchState | undefined; readonly autoBroadcast: boolean };
export const applyHankoBatchProcessed = (s: JBatchState | undefined, entity: string, e: Extract<JEvent, { readonly type: "HankoBatchProcessed" }>, timestamp: number): Result<BatchProcessed, JBatchError> => {
  if (e.entityId.toLowerCase() !== entity.toLowerCase()) return ok({ jBatch: s, autoBroadcast: false });
  const hash = e.batchHash.trim().toLowerCase();
  if (!/^0x[0-9a-f]{64}$/.test(hash)) return batchErr("J_BATCH_EVENT_BATCH_HASH_INVALID");
  if (e.nonce < 1n || e.nonce > SAFE_UINT) return batchErr("J_BATCH_EVENT_NONCE_INVALID");
  const cur = s ?? initJBatch(), nonce = Number(e.nonce), synced = Math.max(cur.entityNonce ?? 0, nonce), sent = cur.sentBatch;
  if (sent !== undefined && sent.entityNonce === nonce && sent.batchHash.toLowerCase() === hash) {
    const { sentBatch: _s, ...rest } = cur;
    const jBatch: JBatchState = { ...rest, status: hasJBatchWork(cur) ? "accumulating" : "empty", entityNonce: synced };
    return ok({ jBatch, autoBroadcast: jBatch.autoBroadcastDraft === true && hasJBatchWork(jBatch) });
  }
  if (sent === undefined || nonce < sent.entityNonce) return ok({ jBatch: { ...cur, entityNonce: synced }, autoBroadcast: false });
  return ok({ autoBroadcast: false, jBatch: { ...cur, entityNonce: synced, status: "failed", sentBatch: { ...sent, terminalFailure: { message: `J_BATCH_NONCE_CONSUMED_BY_DIFFERENT_HASH:${hash}:pending=${sent.batchHash.toLowerCase()}:pendingNonce=${sent.entityNonce}:finalizedNonce=${nonce}`, failedAt: timestamp } } } });
};

type Word = string;
/** og computeAccountKey (contract-codec.ts:6): two bytes32 words, ordered and packed lowercase. */
export const encodeAccountKey = ({ e1, e2 }: { readonly e1: Word; readonly e2: Word }): { readonly lesserThenGreater: string; readonly greaterThenLesser: string } => {
  const [a, b] = [e1, e2].map((e) => { if (!/^0[xX][0-9a-fA-F]{64}$/.test(e)) throw new Error(`account key entity is not bytes32: ${e}`); return e.toLowerCase(); }) as [string, string];
  const [lesser, greater] = a < b ? [a, b] : [b, a];
  return { lesserThenGreater: joinHex([lesser, greater]), greaterThenLesser: joinHex([greater, lesser]) };
};
type ProofBodyText = { readonly watchSeed: Word; readonly leftResponseSeconds: number; readonly rightResponseSeconds: number; readonly offdeltas: readonly string[]; readonly tokenIds: readonly string[]; readonly transformers: readonly { readonly transformerAddress: string; readonly encodedBatch: string; readonly allowances: readonly { readonly deltaIndex: string; readonly rightAllowance: string; readonly leftAllowance: string }[] }[] };
const proofBodyOfText = (b: ProofBodyText): ProofBody => ({
  watchSeed: b.watchSeed, leftResponseSeconds: BigInt(b.leftResponseSeconds), rightResponseSeconds: BigInt(b.rightResponseSeconds), offdeltas: b.offdeltas.map((x) => BigInt(x)), tokenIds: b.tokenIds.map((x) => BigInt(x)),
  transformers: b.transformers.map((c) => ({ transformerAddress: c.transformerAddress, encodedBatch: c.encodedBatch, allowances: c.allowances.map((a) => ({ deltaIndex: BigInt(a.deltaIndex), rightAllowance: BigInt(a.rightAllowance), leftAllowance: BigInt(a.leftAllowance) })) })),
});
export const encodeProofBody = (inputs: { readonly proofBody: ProofBodyText }): string => keccak256Hex(hexToBytes(encodeProofBodyBytes(proofBodyOfText(inputs.proofBody))));
/** og requireDepositoryDomain (onchain-domain.ts:139): chainId > 0 and a valid, non-zero depository address, or the digest is refused. */
const depositoryDomain = (chainId: number, depository: string): bigint => {
  if (!domainOf({ chainId, depositoryAddress: depository }).ok || /^0x0{40}$/.test(depository)) throw new Error(`INVALID_HANKO_DOMAIN:${chainId}:${depository}`);
  return BigInt(chainId);
};
export const DEPOSITORY_BATCH_HANKO_DOMAIN = keccak256Hex(utf8("XLN_DEPOSITORY_HANKO_V1"));
export const encodeDisputeProofHash = (i: { readonly messageType: number; readonly chainId: number; readonly contractAddress: string; readonly accountKey: string; readonly nonce: string; readonly proposerIsLeft: boolean; readonly proofbodyHash: Word; readonly watchSeed: Word }): string =>
  keccak256Hex(abiEncode([A.uint(BigInt(i.messageType)), A.uint(depositoryDomain(i.chainId, i.contractAddress)), A.address(i.contractAddress), A.bytes(i.accountKey), A.uint(BigInt(i.nonce)), A.bool(i.proposerIsLeft), A.b32(i.proofbodyHash), A.b32(i.watchSeed)]));
type DiffText = { readonly tokenId: string; readonly leftDiff: string; readonly rightDiff: string; readonly collateralDiff: string; readonly ondeltaDiff: string };
export const encodeCooperativeUpdateHash = (i: { readonly messageType: number; readonly chainId: number; readonly contractAddress: string; readonly accountKey: string; readonly nonce: string; readonly diffs: readonly DiffText[]; readonly forgiveDebtsInTokenIds: readonly string[] }): string =>
  keccak256Hex(abiEncode([A.uint(BigInt(i.messageType)), A.uint(depositoryDomain(i.chainId, i.contractAddress)), A.address(i.contractAddress), A.bytes(i.accountKey), A.uint(BigInt(i.nonce)),
    arr(i.diffs, (d) => diffAbi({ tokenId: BigInt(d.tokenId), leftDiff: BigInt(d.leftDiff), rightDiff: BigInt(d.rightDiff), collateralDiff: BigInt(d.collateralDiff), ondeltaDiff: BigInt(d.ondeltaDiff) })), arr(i.forgiveDebtsInTokenIds, (id) => A.uint(BigInt(id)))]));
export const encodeBatchHash = (i: { readonly chainId: number; readonly depository: string; readonly encodedBatch: string; readonly nonce: string }): string =>
  keccak256Hex(encodePacked([{ _tag: "bytes32", value: DEPOSITORY_BATCH_HANKO_DOMAIN }, { _tag: "uint256", value: depositoryDomain(i.chainId, i.depository) }, { _tag: "address", value: i.depository }, { _tag: "bytes", value: i.encodedBatch }, { _tag: "uint256", value: BigInt(i.nonce) }]));
type DisputeCase = { readonly nonce: string; readonly startedByLeft: boolean; readonly initialProposerIsLeft: boolean; readonly timeout: string; readonly leftResponseSeconds: number; readonly rightResponseSeconds: number; readonly proofbodyHash: Word; readonly disputeStartTimestamp: string; readonly starterInitialArguments: string; readonly starterCounterArguments: string; readonly starterCounterProofCommitment: Word };
export const encodeDisputeHash = ({ cases }: { readonly cases: readonly DisputeCase[] }): readonly string[] => cases.map((c) => {
  const commitment = (args: string): string => keccak256Hex(abiEncode([A.bytes(args), A.bool(c.startedByLeft), A.uint(BigInt(c.disputeStartTimestamp))]));
  return keccak256Hex(encodePacked([
    { _tag: "uint256", value: BigInt(c.nonce) }, { _tag: "bool", value: c.startedByLeft }, { _tag: "bool", value: c.initialProposerIsLeft }, { _tag: "uint256", value: BigInt(c.timeout) },
    { _tag: "uint32", value: c.leftResponseSeconds }, { _tag: "uint32", value: c.rightResponseSeconds }, { _tag: "bytes32", value: c.proofbodyHash }, { _tag: "uint256", value: BigInt(c.disputeStartTimestamp) },
    { _tag: "bytes32", value: commitment(c.starterInitialArguments) }, { _tag: "bytes32", value: commitment(c.starterCounterArguments) }, { _tag: "bytes32", value: c.starterCounterProofCommitment },
    { _tag: "uint256", value: 0n }, { _tag: "bytes32", value: ZERO_WORD }, { _tag: "bool", value: false },
  ]));
});


const HALF_ORDER = secp256k1.CURVE.n >> 1n;
export type Board = { readonly votingThreshold: number; readonly entityIds: readonly string[]; readonly votingPowers: readonly number[]; readonly boardChangeDelay: number; readonly controlChangeDelay: number; readonly dividendChangeDelay: number };
type Verdict = { readonly entityId: string; readonly valid: boolean };
const INVALID: Verdict = { entityId: ZERO_WORD, valid: false };
export type HankoError = Tagged<"duplicate_signer" | "duplicate_entity_index" | "duplicate_claim_entity" | "claim_order" | "weight" | "threshold" | "unused_signature" | "unused_placeholder" | "unused_claim" | "packed" | "decode">;
export type HankoClaimInput = { readonly entityId: string; readonly entityIndexes: readonly number[]; readonly weights: readonly number[]; readonly threshold: number; readonly boardChangeDelay: number; readonly controlChangeDelay: number; readonly dividendChangeDelay: number };
export type HankoEnvelope = { readonly placeholders: readonly string[]; readonly packedSignatures: Uint8Array; readonly claims: readonly HankoClaimInput[]; readonly memberSignatures: readonly string[] };
type HankoClaim = { readonly entityId: string; readonly entityIndexes: readonly bigint[]; readonly weights: readonly bigint[]; readonly threshold: bigint; readonly boardChangeDelay: bigint; readonly controlChangeDelay: bigint; readonly dividendChangeDelay: bigint };
type HankoBytes = { readonly placeholders: readonly string[]; readonly packedSignatures: Uint8Array; readonly claims: readonly HankoClaim[]; readonly memberSignatures: readonly Uint8Array[] };
export type RawSig = { readonly r: Uint8Array; readonly s: Uint8Array; readonly v: number };
const boardAbi = (b: Board): Abi => t([A.uint(BigInt(b.votingThreshold)), arr(b.entityIds, A.b32), arr(b.votingPowers, (p) => A.uint(BigInt(p))), A.uint(BigInt(b.boardChangeDelay)), A.uint(BigInt(b.controlChangeDelay)), A.uint(BigInt(b.dividendChangeDelay))]);
const boardHashOf = (b: Board): string => keccak256Hex(abiEncode([boardAbi(b)]));
const boardOf = (threshold: bigint, ids: readonly string[], powers: readonly number[], c: { readonly boardChangeDelay: bigint; readonly controlChangeDelay: bigint; readonly dividendChangeDelay: bigint }): string =>
  boardHashOf({ votingThreshold: Number(threshold), entityIds: ids, votingPowers: powers, boardChangeDelay: Number(c.boardChangeDelay), controlChangeDelay: Number(c.controlChangeDelay), dividendChangeDelay: Number(c.dividendChangeDelay) });
const addressAsId = (a: string): string => bytesToHex(addressWord(a));
export const checksum = (a: string): string => {
  const hex = a.slice(2).toLowerCase(), h = keccak256(utf8(hex));
  return `0x${[...hex].map((c, i) => ((((h[i >> 1] ?? 0) >> (i % 2 === 0 ? 4 : 0)) & 0xf) >= 8 ? c.toUpperCase() : c)).join("")}`;
};
export const addressOf = (publicKey: Uint8Array): string => checksum(bytesToHex(keccak256(publicKey.slice(1)).slice(12)));
export const encodeLazyEntityId = ({ signer }: { readonly signer: string }): string => boardHashOf({ votingThreshold: 1, entityIds: [addressAsId(signer)], votingPowers: [1], boardChangeDelay: 0, controlChangeDelay: 0, dividendChangeDelay: 0 });
export const encodeBoardHash = ({ board }: { readonly board: Board }): string => boardHashOf(board);
export const encodeBoardBytes = (board: Board): string => abiEncodeHex([boardAbi(board)]);
const claimAbi = (c: HankoClaim): Abi => t([A.b32(c.entityId), arr(c.entityIndexes, A.uint), arr(c.weights, A.uint), A.uint(c.threshold), A.uint(c.boardChangeDelay), A.uint(c.controlChangeDelay), A.uint(c.dividendChangeDelay)]);
const claimWords = (c: HankoClaimInput): HankoClaim => ({ entityId: c.entityId, entityIndexes: c.entityIndexes.map((x) => BigInt(x)), weights: c.weights.map((x) => BigInt(x)), threshold: BigInt(c.threshold), boardChangeDelay: BigInt(c.boardChangeDelay), controlChangeDelay: BigInt(c.controlChangeDelay), dividendChangeDelay: BigInt(c.dividendChangeDelay) });
const envelopeHex = (h: HankoBytes): string => abiEncodeHex([t([arr(h.placeholders, A.b32), A.bytes(bytesToHex(h.packedSignatures)), arr(h.claims, claimAbi), arr(h.memberSignatures, (s) => A.bytes(bytesToHex(s)))])]);
export const encodeHankoEnvelope = (h: HankoEnvelope): string => envelopeHex({ placeholders: h.placeholders, packedSignatures: h.packedSignatures, claims: h.claims.map(claimWords), memberSignatures: h.memberSignatures.map((s) => hexToBytes(s)) });
/** og assertCanonicalSignature (codec.ts:277): 32-byte r and s, v in {27,28}, non-zero r and s, low s. */
const canonicalSig = (sig: RawSig): boolean => sig.r.length === 32 && sig.s.length === 32 && (sig.v === 27 || sig.v === 28) && !isZeroWord(sig.r) && !isZeroWord(sig.s) && wordAt(sig.s, 0) <= HALF_ORDER;
export const packSignatures = (sigs: readonly RawSig[]): Uint8Array => {
  if (sigs.length === 0) return new Uint8Array();
  sigs.forEach((sig, i) => { if (!canonicalSig(sig)) throw new Error(`HANKO_SIGNATURE_NON_CANONICAL:${i}`); });
  const bits = new Uint8Array(Math.ceil(sigs.length / 8));
  sigs.forEach((sig, i) => { if (sig.v === 28) bits[i >> 3] = (bits[i >> 3] ?? 0) | (1 << (i & 7)); });
  return concat([...sigs.flatMap((sig) => [sig.r, sig.s]), bits]);
};
const packedCount = (byteLength: number): number | null => {
  if (byteLength === 0) return 0;
  const count = Math.floor((byteLength * 8) / 513);
  return count === 0 || count * 64 + Math.ceil(count / 8) !== byteLength ? null : count;
};
const packedPaddingClear = (packed: Uint8Array, count: number): boolean => count % 8 === 0 || ((packed[packed.length - 1] ?? 0) >> (count % 8)) === 0;
const packedAt = (packed: Uint8Array, count: number, i: number): { readonly r: Uint8Array; readonly s: Uint8Array; readonly bit: number } =>
  ({ r: packed.subarray(i * 64, i * 64 + 32), s: packed.subarray(i * 64 + 32, i * 64 + 64), bit: ((packed[count * 64 + (i >> 3)] ?? 0) >> (i & 7)) & 1 });
const chainV = (v: number): number => (v < 27 ? v + 27 : v);
export const recoverRawSigner = (hashHex: string, signatureHex: string): string | null => {
  const raw = parseHex(signatureHex), h = parseHex(hashHex);
  if (raw === null || h === null || raw.length !== 65 || h.length !== 32) return null;
  const s = raw.subarray(32, 64), v = chainV(raw[64] ?? 0);
  if ((v !== 27 && v !== 28) || wordAt(s, 0) > HALF_ORDER) return null;
  const key = recoverPublicKey(h, raw.subarray(0, 32), s, v - 27);
  return key === null ? null : addressOf(key);
};
export const encodeHanko65 = (i: { readonly hash: string; readonly hanko: string; readonly registration: null }): Verdict => {
  const signer = recoverRawSigner(i.hash, i.hanko);
  return signer === null ? INVALID : { entityId: encodeLazyEntityId({ signer }), valid: true };
};
export type Registration = { readonly encodedBoard: string; readonly entityId: string };
/** og verifyCanonicalHanko: with a registration the target is the registered entity and its board is the registered one; without, og has no expected target. */
export const verifyHankoLocal = (hankoHex: string, hashHex: string, registration: Registration | null): Result<Verdict, HankoError> => {
  const encodedBoard = registration === null ? null : parseHex(registration.encodedBoard);
  if (registration !== null && encodedBoard === null) return err({ _tag: "decode" });
  const verified = verifyAccountHanko(hankoHex, hashHex, registration?.entityId ?? "", encodedBoard === null ? undefined : keccak256Hex(encodedBoard));
  return ok(verified.ok ? { entityId: verified.value.entityId, valid: true } : INVALID);
};
const verdictOf = (r: Result<Verdict, HankoError>): Verdict => unwrapOr(r, () => INVALID);
export const encodeHankoBytes = (i: { readonly encodedBoard: string; readonly entityId: string; readonly hash: string; readonly twoOfThree: string; readonly oneOfThree: string }): { readonly twoOfThree: Verdict; readonly oneOfThree: Verdict } =>
  ({ twoOfThree: verdictOf(verifyHankoLocal(i.twoOfThree, i.hash, i)), oneOfThree: verdictOf(verifyHankoLocal(i.oneOfThree, i.hash, i)) });
const signatureFor = (signedBy: ReadonlyMap<string, string>, entityWord: string): RawSig | null => {
  const addr = bytesToHex(hexToBytes(entityWord).subarray(12));

  const found = [...signedBy].reduce<string | undefined>((last, [signer, sig]) => (sameHex(signer, addr) ? sig : last), undefined);
  if (found === undefined) return null;
  const raw = hexToBytes(found.startsWith("0x") ? found : `0x${found}`);
  const sig = raw.length !== 65 ? null : { r: raw.subarray(0, 32), s: raw.subarray(32, 64), v: chainV(raw[64] ?? 0) };
  return sig !== null && canonicalSig(sig) ? sig : null;
};
export const encodeBoardHanko = (board: Board & { readonly entityId: string }, signedBy: ReadonlyMap<string, string>): string => {
  const slots = board.entityIds.map((id) => ({ id, sig: signatureFor(signedBy, id) }));
  const placeholders = slots.flatMap((s) => (s.sig === null ? [s.id] : [])), sigs = slots.flatMap((s) => (s.sig === null ? [] : [s.sig]));

  const entityIndexes = slots.map((slot, i) => { const before = slots.slice(0, i).filter((b) => (b.sig === null) === (slot.sig === null)).length; return slot.sig === null ? before : placeholders.length + before; });
  return encodeHankoEnvelope({ placeholders, packedSignatures: packSignatures(sigs), memberSignatures: [], claims: [{ entityId: board.entityId, entityIndexes, weights: board.votingPowers, threshold: board.votingThreshold, boardChangeDelay: board.boardChangeDelay, controlChangeDelay: board.controlChangeDelay, dividendChangeDelay: board.dividendChangeDelay }] });
};
export const boardVotingPower = (board: Board, signedBy: ReadonlyMap<string, string>): number => board.entityIds.reduce((sum, id, i) => sum + (signatureFor(signedBy, id) === null ? 0 : board.votingPowers[i] ?? 0), 0);
const listOf = <X>(buf: Uint8Array, at: AbiLength, read: (i: number) => X): Result<X[], HankoError> => {
  const count = abiLengthWord(buf, at);
  return abiFits(buf, at, count, 32) ? ok(Array.from({ length: Number(count) }, (_, i) => read(i))) : err({ _tag: "decode" });
};
const decodeClaim = (buf: Uint8Array, at: AbiTuple): Result<HankoClaim, HankoError> | null => abiCursorOk(at)
  ? chain(listOf(buf, abiLengthRef(buf, at, 32), (i) => abiStaticWord(buf, abiLengthRef(buf, at, 32), i)), (entityIndexes) =>
    map(listOf(buf, abiLengthRef(buf, at, 64), (i) => abiStaticWord(buf, abiLengthRef(buf, at, 64), i)), (weights): HankoClaim => ({
      entityId: bytesToHex(abiTupleBytes(buf, at, 0)), entityIndexes, weights, threshold: abiWord(buf, at, 96), boardChangeDelay: abiWord(buf, at, 128), controlChangeDelay: abiWord(buf, at, 160), dividendChangeDelay: abiWord(buf, at, 192),
    })))
  : null;
const NO_HANKO: HankoBytes = { placeholders: [], packedSignatures: new Uint8Array(), claims: [], memberSignatures: [] };
const decodeHanko = (buf: Uint8Array): Result<HankoBytes, HankoError> => {
  const body = abiTupleRef(buf, abiRoot(), 0);
  if (!abiCursorOk(body)) return ok(NO_HANKO);
  const placeholdersAt = abiLengthRef(buf, body, 0), signaturesAt = abiLengthRef(buf, body, 32), claimsAt = abiLengthRef(buf, body, 64), membersAt = abiLengthRef(buf, body, 96);
  return chain(listOf(buf, placeholdersAt, (i) => bytesToHex(abiStaticBytes(buf, placeholdersAt, i))), (placeholders) =>
    chain(listOf(buf, claimsAt, (i) => decodeClaim(buf, abiTupleElement(buf, claimsAt, i))), (decoded) => {
      const claims: HankoClaim[] = [];
      for (const c of decoded) { if (c === null) return ok(NO_HANKO); if (!c.ok) return c; claims.push(c.value); }
      return map(listOf(buf, membersAt, (i) => abiBytes(buf, abiBytesElement(buf, membersAt, i))), (memberSignatures): HankoBytes => ({ placeholders, packedSignatures: abiBytes(buf, signaturesAt), claims, memberSignatures }));
    }));
};
export type AccountHankoTag =
  | "expected_entity" | "digest" | "decode" | "too_large" | "member_signatures_shape" | "packed_length" | "claim_shape" | "non_canonical" | "claim_required" | "member_signature"
  | "duplicate_placeholder" | "duplicate_claim_entity" | "packed_padding" | "signature_non_canonical" | "recovery_failed" | "duplicate_signer" | "signature_required" | "placeholder_signer"
  | "threshold" | "entity_index" | "duplicate_entity_index" | "weight" | "placeholder_claim" | "claim_order" | "first_member" | "duplicate_member" | "threshold_power" | "quorum"
  | "unused_claim" | "unused_placeholder" | "unused_signature" | "authority" | "target";
export type AccountHankoError = { readonly _tag: AccountHankoTag };
export type AccountHankoVerdict = { readonly entityId: string; readonly signers: readonly string[] };
const ACCOUNT_HANKO_MAX_BYTES = 64 * 1024, MAX_ENTITIES = 256, MAX_CLAIMS = 64, MAX_MEMBERS_PER_CLAIM = 256, MAX_TOTAL_MEMBERS = 1024, MAX_MEMBER_SIGNATURES = 8;
const MAX_POWER = 0xffffn, MAX_DELAY = 0xffff_ffffn, MAX_SAFE_INDEX = BigInt(Number.MAX_SAFE_INTEGER), ADDRESS_MAX = (1n << 160n) - 1n;
const hankoRefuse = (_tag: AccountHankoTag): Result<never, AccountHankoError> => err({ _tag });
/** og asHankoBytes32 (codec.ts:83): exactly `0x` + 64 hex, lowercased. */
const bytes32Of = (text: string): string | null => (/^0x[0-9a-f]{64}$/i.test(text) ? text.toLowerCase() : null);
const unique = (xs: readonly string[]): boolean => new Set(xs).size === xs.length;
const isZeroWord = (w: Uint8Array): boolean => w.every((b) => b === 0);
export const isAddressId = (id: string): boolean => { const v = BigInt(id); return v > 0n && v <= ADDRESS_MAX; };
const contractShape = (h: HankoBytes): Result<void, AccountHankoError> => {
  const members = h.memberSignatures, signatures = packedCount(h.packedSignatures.length);
  if (members.length !== 0 && members.length !== h.placeholders.length) return hankoRefuse("member_signatures_shape");
  if (members.filter((s) => s.length > 0).length > MAX_MEMBER_SIGNATURES) return hankoRefuse("too_large");
  if (signatures === null) return hankoRefuse("packed_length");
  if (h.claims.length > MAX_CLAIMS || h.placeholders.length + signatures + h.claims.length > MAX_ENTITIES || h.placeholders.length > MAX_ENTITIES || signatures > MAX_ENTITIES) return hankoRefuse("too_large");
  let totalMembers = 0;
  for (const c of h.claims) {
    const n = c.entityIndexes.length;
    if (n === 0 || n !== c.weights.length || n > MAX_MEMBERS_PER_CLAIM) return hankoRefuse("claim_shape");
    if ((totalMembers += n) > MAX_TOTAL_MEMBERS) return hankoRefuse("too_large");
  }
  return ok(undefined);
};
const canonicalHanko = (h: HankoBytes, bytes: Uint8Array): boolean =>
  h.claims.every((c) => c.entityId.length === 66 && c.boardChangeDelay <= MAX_DELAY && c.controlChangeDelay <= MAX_DELAY && c.dividendChangeDelay <= MAX_DELAY) && envelopeHex(h) === bytesToHex(bytes);
const recoverAccountSigners = (digest: Uint8Array, packed: Uint8Array): Result<readonly string[], AccountHankoError> => {
  const count = packedCount(packed.length) ?? 0;
  if (!packedPaddingClear(packed, count)) return hankoRefuse("packed_padding");
  const parts = Array.from({ length: count }, (_, i) => packedAt(packed, count, i));
  if (parts.some(({ r, s }) => isZeroWord(r) || isZeroWord(s) || wordAt(s, 0) > HALF_ORDER)) return hankoRefuse("signature_non_canonical");
  return foldResult(parts, [] as readonly string[], (signers, { r, s, bit }) => {
    const key = recoverPublicKey(digest, r, s, bit);
    if (key === null) return hankoRefuse("recovery_failed");
    const signer = addressOf(key).toLowerCase();
    return signers.includes(signer) ? hankoRefuse("duplicate_signer") : ok([...signers, signer]);
  });
};
type ResolvedClaim = { readonly entityId: string; readonly boardHash: string; readonly threshold: bigint; readonly votingPower: bigint; readonly referenced: readonly number[]; readonly used: readonly number[] };
const resolveAccountClaim = (h: HankoBytes, signerIds: readonly string[], claimIndex: number): Result<ResolvedClaim, AccountHankoError> => {
  const claim = h.claims[claimIndex];
  if (claim === undefined) return hankoRefuse("claim_shape");
  if (claim.threshold <= 0n || claim.threshold > MAX_POWER) return hankoRefuse("threshold");
  const pc = h.placeholders.length, firstClaim = pc + signerIds.length, totalCount = BigInt(firstClaim + h.claims.length);
  if (claim.entityIndexes.some((i) => i > MAX_SAFE_INDEX || i >= totalCount)) return hankoRefuse("entity_index");
  const indexes = claim.entityIndexes.map(Number);
  if (!unique(indexes.map(String))) return hankoRefuse("duplicate_entity_index");
  const ids: string[] = [], powers: number[] = [], referenced: number[] = [];
  let votingPower = 0n;
  for (let m = 0; m < indexes.length; m++) {
    const index = indexes[m] ?? 0, weight = claim.weights[m] ?? 0n;
    if (weight <= 0n || weight > MAX_POWER) return hankoRefuse("weight");
    let id: string;
    if (index < pc) { id = h.placeholders[index] ?? ""; if (h.claims.slice(0, claimIndex).some((e) => e.entityId === id)) return hankoRefuse("placeholder_claim"); }
    else if (index < firstClaim) { id = signerIds[index - pc] ?? ""; votingPower += weight; }
    else { const nested = index - firstClaim; if (nested >= claimIndex) return hankoRefuse("claim_order"); id = h.claims[nested]?.entityId ?? ""; votingPower += weight; referenced.push(nested); }
    if (m === 0 && (index >= firstClaim || !isAddressId(id))) return hankoRefuse("first_member");
    ids.push(id); powers.push(Number(weight));
  }
  if (!unique(ids)) return hankoRefuse("duplicate_member");
  if (claim.threshold > claim.weights.reduce((sum, w) => sum + w, 0n)) return hankoRefuse("threshold_power");
  return ok({ entityId: claim.entityId, boardHash: boardOf(claim.threshold, ids, powers, claim), threshold: claim.threshold, votingPower, referenced, used: indexes });
};
const accountReachability = (pc: number, sc: number, claims: readonly ResolvedClaim[]): Result<void, AccountHankoError> => {
  const reachable = new Set<number>([claims.length - 1]);
  for (let i = claims.length - 1; i >= 0; i--) if (reachable.has(i)) for (const child of claims[i]?.referenced ?? []) reachable.add(child);
  const used = new Set(claims.flatMap((c) => c.used));
  if (reachable.size !== claims.length) return hankoRefuse("unused_claim");
  if (Array.from({ length: pc }, (_, i) => i).some((i) => !used.has(i))) return hankoRefuse("unused_placeholder");
  if (Array.from({ length: sc }, (_, i) => pc + i).some((i) => !used.has(i))) return hankoRefuse("unused_signature");
  return ok(undefined);
};
/** og verifyCanonicalHanko. An empty expected entity is og's absent `expectedTargetEntityId`: the last claim is the target and only self-hashed boards authorize. */
export const verifyAccountHanko = (hanko: string, digest: string, expectedEntityId: string, registeredBoardHash?: string): Result<AccountHankoVerdict, AccountHankoError> => {
  const target = expectedEntityId === "" ? undefined : bytes32Of(expectedEntityId);
  if (target === null) return hankoRefuse("expected_entity");
  if (!/^0[xX][0-9a-fA-F]{64}$/.test(digest)) return hankoRefuse("digest");
  if (!/^0[xX](?:[0-9a-fA-F]{2})*$/.test(hanko)) return hankoRefuse("decode");
  const bytes = hexToBytes(hanko);
  if (bytes.length > ACCOUNT_HANKO_MAX_BYTES) return hankoRefuse("too_large");
  const decoded = decodeHanko(bytes);
  if (!decoded.ok) return hankoRefuse("non_canonical");
  const env = decoded.value, shape = contractShape(env);
  if (!shape.ok) return shape;
  if (!canonicalHanko(env, bytes)) return hankoRefuse("non_canonical");
  if (env.claims.length === 0) return hankoRefuse("claim_required");
  if (env.memberSignatures.some((s) => s.length > 0)) return hankoRefuse("member_signature");
  if (!unique(env.placeholders)) return hankoRefuse("duplicate_placeholder");
  if (!unique(env.claims.map((c) => c.entityId))) return hankoRefuse("duplicate_claim_entity");
  return chain(recoverAccountSigners(hexToBytes(digest), env.packedSignatures), (signers) => {
    if (signers.length === 0) return hankoRefuse("signature_required");
    const signerIds = signers.map(addressAsId);
    if (env.placeholders.some((p) => signerIds.includes(p))) return hankoRefuse("placeholder_signer");
    return chain(traverse(env.claims, (_, i) => resolveAccountClaim(env, signerIds, i)), (claims) => {
      if (claims.some((c) => c.votingPower < c.threshold)) return hankoRefuse("quorum");
      const registered = registeredBoardHash?.trim().toLowerCase(), last = claims[claims.length - 1];
      const authorized = (c: ResolvedClaim): boolean => c.entityId === c.boardHash || (c.entityId === target && c.boardHash === registered);
      return chain(accountReachability(env.placeholders.length, signerIds.length, claims), () =>
        !claims.every(authorized) ? hankoRefuse("authority") : last === undefined || (target !== undefined && last.entityId !== target) ? hankoRefuse("target") : ok({ entityId: last.entityId, signers }));
    });
  });
};
export const encodeLazyAccountHanko = (entityIdText: string, sig: string): Result<string, AccountHankoError> => {
  const id = bytes32Of(entityIdText), raw = parseHex(sig);
  if (id === null) return hankoRefuse("expected_entity");
  if (raw === null || raw.length !== 65) return hankoRefuse("decode");
  const v = raw[64] ?? 0, bit = v === 0 || v === 27 ? 0 : v === 1 || v === 28 ? 1 : null, r = raw.subarray(0, 32), s = raw.subarray(32, 64);
  if (bit === null || isZeroWord(r) || isZeroWord(s) || wordAt(s, 0) > HALF_ORDER) return hankoRefuse("signature_non_canonical");
  return ok(envelopeHex({ placeholders: [], packedSignatures: packSignatures([{ r, s, v: 27 + bit }]), memberSignatures: [], claims: [{ entityId: id, entityIndexes: [0n], weights: [1n], threshold: 1n, boardChangeDelay: 0n, controlChangeDelay: 0n, dividendChangeDelay: 0n }] }));
};


export const MAX_FILL = 65535;
export type RatioError = Tagged<"bad_ratio" | "e12" | "ratio_mismatch" | "leg_mismatch" | "hub_authorship">;
export type RatioRecord = { readonly fillRatio: number; readonly revealedAt: bigint };
export const validRatio = (r: number): boolean => Number.isInteger(r) && r >= 0 && r <= MAX_FILL;
export const floorRatio = (amount: bigint, r: number): Result<bigint, RatioError> => (validRatio(r) ? ok((amount * BigInt(r)) / BigInt(MAX_FILL)) : err({ _tag: "bad_ratio" }));
export const inRevealWindow = (revealedAt: bigint, s: bigint, w: bigint): boolean => revealedAt >= s && revealedAt <= s + w;
export const timelyRatio = (record: RatioRecord | undefined, s: bigint, w: bigint): number => (record !== undefined && inRevealWindow(record.revealedAt, s, w) ? record.fillRatio : 0);
export const effectiveRatio = (claimed: number, timely: number): Result<number, RatioError> => (validRatio(claimed) && validRatio(timely) ? ok(Math.max(claimed, timely)) : err({ _tag: "bad_ratio" }));
export const deltaMove = (amount: bigint, effective: number, already: bigint): Result<bigint, RatioError> => map(floorRatio(amount, effective), (filled) => filled - already);
export const revealSlot = (prev: RatioRecord | undefined, next: { readonly fillRatio: number; readonly revealedAt: bigint; readonly targetRole: boolean }): Result<RatioRecord, RatioError> => {
  if (!validRatio(next.fillRatio)) return err({ _tag: "bad_ratio" });
  const fresh: RatioRecord = { fillRatio: next.fillRatio, revealedAt: next.revealedAt };
  if (!next.targetRole) return prev === undefined ? ok(fresh) : prev.fillRatio === next.fillRatio ? ok(prev) : err({ _tag: "e12" });
  return prev !== undefined && next.fillRatio < prev.fillRatio ? err({ _tag: "e12" }) : ok(fresh);
};
export const uncollateralizedCredit = (hubDebtToUser: bigint, collateral: bigint): bigint => (hubDebtToUser > collateral ? hubDebtToUser - collateral : 0n);
// ---- cross-jurisdiction kernel: og protocol/htlc/hash-ladder.ts, extensions/cross-j/{index,market,status,prepared-route}.ts ----
export type CrossError = Tagged<"cross_j", { reason: string }>;
const crossErr = (reason: string): Result<never, CrossError> => err({ _tag: "cross_j", reason });
/** og protocol/serialization safeStringify: sorted keys, undefined dropped, bigint tagged, arrays keep holes as null. */
const jsonNode = (v: unknown): unknown => {
  if (v === undefined || typeof v === "function" || typeof v === "symbol") return undefined;
  if (v === null || typeof v === "string" || typeof v === "number" || typeof v === "boolean") return v;
  if (typeof v === "bigint") return { __xlnType: "BigInt", value: v.toString() };
  if (Array.isArray(v)) return v.map((x) => jsonNode(x) ?? null);
  const r = v as Record<string, unknown>;
  return Object.fromEntries(Object.keys(r).sort(asc).flatMap((k) => { const x = jsonNode(r[k]); return x === undefined ? [] : [[k, x]]; }));
};
export const stableJson = (v: unknown): string => JSON.stringify(jsonNode(v) ?? null);
const HEX32 = /^0x[0-9a-fA-F]{64}$/;
const LADDER_NIBBLE_MAX = 15;
const ladderHash = (node: string): string => keccak256Hex(hexToBytes(node));
const ladderSteps = (node: string, steps: number): string => { let r = node; for (let i = 0; i < Math.max(0, Math.floor(steps)); i++) r = ladderHash(r); return r; };
const clampRatio = (v: unknown): number => Math.max(0, Math.min(MAX_FILL, Math.floor(Number(v) || 0)));
const ladderDigits = (ratio: number): readonly [number, number, number, number] => { const r = clampRatio(ratio); return [(r >> 12) & 0x0f, (r >> 8) & 0x0f, (r >> 4) & 0x0f, r & 0x0f]; };
const ladderRoot = (roots: readonly string[]): string => keccak256Hex(concat(roots.map(hexToBytes)));
export type Reveals = readonly [string, string, string, string];
export type HashLadderCommitment = { readonly fullHash: string; readonly partialRoot: string };
export type HashLadderProof = HashLadderCommitment & { readonly fullSecret: string; readonly nibbleBases: Reveals };
export type HashLadderReveal = { readonly fillRatio: number; readonly binary: string; readonly fullSecret?: string; readonly reveals?: Reveals };
export type DecodedLadder = { readonly fillRatio: number; readonly fullSecret?: string; readonly reveals?: Reveals };
/** og buildHashLadderProof: keccak(`${seed}:full|n0..n3`); fullHash = keccak(full), partialRoot = keccak(packed 15-step roots). */
export const buildHashLadderProof = (seed: string): HashLadderProof => {
  const secretFor = (suffix: string): string => keccak256Hex(utf8(`${seed}:${suffix}`));
  const fullSecret = secretFor("full"), nibbleBases: Reveals = [secretFor("n0"), secretFor("n1"), secretFor("n2"), secretFor("n3")];
  return { fullSecret, nibbleBases, fullHash: ladderHash(fullSecret), partialRoot: ladderRoot(nibbleBases.map((b) => ladderSteps(b, LADDER_NIBBLE_MAX))) };
};
/** og revealHashLadder: 0 → `0x`, 65535 → the full secret, else uint16 ratio ‖ four nibble reveals. */
export const revealHashLadder = (p: HashLadderProof, fillRatio: number): HashLadderReveal => {
  const ratio = clampRatio(fillRatio);
  if (ratio === 0) return { fillRatio: 0, binary: "0x" };
  if (ratio === MAX_FILL) return { fillRatio: ratio, binary: p.fullSecret, fullSecret: p.fullSecret };
  const digits = ladderDigits(ratio), reveals = p.nibbleBases.map((b, i) => ladderSteps(b, LADDER_NIBBLE_MAX - (digits[i] ?? 0))) as unknown as Reveals;
  return { fillRatio: ratio, binary: `0x${ratio.toString(16).padStart(4, "0")}${reveals.map((r) => r.slice(2)).join("")}`, reveals };
};
/** og decodeHashLadderBinary. */
export const decodeHashLadderBinary = (binary?: string): Result<DecodedLadder, CrossError> => {
  const value = String(binary || "0x").toLowerCase();
  if (value === "0x") return ok({ fillRatio: 0 });
  if (!value.startsWith("0x") || value.length % 2 !== 0) return crossErr("HASHLADDER_BINARY_INVALID_HEX");
  const size = (value.length - 2) / 2;
  if (size === 32) return HEX32.test(value) ? ok({ fillRatio: MAX_FILL, fullSecret: value }) : crossErr("HASHLADDER_FULL_BINARY_INVALID");
  if (size !== 130) return crossErr("HASHLADDER_BINARY_INVALID_LENGTH");
  const fillRatio = Number.parseInt(value.slice(2, 6), 16);
  if (!Number.isInteger(fillRatio) || fillRatio <= 0 || fillRatio >= MAX_FILL) return crossErr("HASHLADDER_PARTIAL_BINARY_RATIO_INVALID");
  const reveals = [0, 1, 2, 3].map((i) => `0x${value.slice(6 + i * 64, 70 + i * 64)}`) as unknown as Reveals;
  return reveals.every((r) => HEX32.test(r)) ? ok({ fillRatio, reveals }) : crossErr("HASHLADDER_PARTIAL_BINARY_REVEALS_INVALID");
};
const ladderRevealOk = (c: HashLadderCommitment, d: DecodedLadder): boolean => {
  const ratio = clampRatio(d.fillRatio);
  if (ratio === 0) return true;
  if (ratio === MAX_FILL) return d.fullSecret !== undefined && HEX32.test(d.fullSecret) && ladderHash(d.fullSecret).toLowerCase() === c.fullHash.toLowerCase();
  const reveals = d.reveals, digits = ladderDigits(ratio);
  return reveals !== undefined && reveals.length === 4 && ladderRoot(reveals.map((r, i) => ladderSteps(r, digits[i] ?? 0))).toLowerCase() === c.partialRoot.toLowerCase();
};
/** og verifyHashLadderBinary: decode, then the reveal must open the commitment at exactly its ratio. */
export const verifyHashLadderBinary = (c: HashLadderCommitment, binary?: string): Result<DecodedLadder, CrossError> =>
  chain(decodeHashLadderBinary(binary), (d) => (ladderRevealOk(c, d) ? ok(d) : crossErr("HASHLADDER_BINARY_VERIFY_FAILED")));

export const CROSS_STATUSES = ["intent", "target_prepared", "resting", "partially_filled", "clear_requested", "clearing", "settled", "cancelled", "expired"] as const;
export type CrossStatus = (typeof CROSS_STATUSES)[number];
export type CrossLeg = { readonly jurisdiction: string; readonly entityId: string; readonly counterpartyEntityId: string; readonly tokenId: number; readonly amount: bigint };
export type CrossPullLeg = { readonly pullId: string; readonly tokenId: number; readonly amount: bigint; readonly signedAmount: bigint; readonly fullHash: string; readonly partialRoot: string };
export type CrossCloseProof = {
  readonly orderId: string; readonly routeHash: string; readonly sourcePullId: string; readonly targetPullId: string; readonly fillRatio: number;
  readonly cumulativeSourceAmount: bigint; readonly cumulativeTargetAmount: bigint; readonly binaryHash: string; readonly closeMode: "full" | "partial_cancel_remainder" | "pure_cancel";
};
export type CrossRouteDomain = {
  readonly protocol: "xln-cross-j"; readonly hashSchema: "route-domain"; readonly sourceStackId: string; readonly targetStackId: string;
  readonly sourceEntityProviderAddress?: string; readonly targetEntityProviderAddress?: string; readonly sourceDeltaTransformerAddress?: string; readonly targetDeltaTransformerAddress?: string;
  readonly sourceAssetRef: string; readonly targetAssetRef: string;
};
export type CrossTimePolicy = { readonly runtimeClock: "unix_ms"; readonly settlementClock: "unix_seconds"; readonly deadlineConversion: "floor_ms_to_unix_seconds"; readonly runtimeExpiresAtMs: number; readonly finalityPolicy: "independent_beneficiary_windows_pull_sum_finality" };
export type CrossPullBinding = { readonly orderId: string; readonly routeHash: string; readonly leg: "source" | "target"; readonly status?: CrossStatus };
type CrossRecord = { readonly fillRatio: number; readonly revealedAt: number };
type CrossPendingReveal = { readonly fillRatio: number; readonly fullSecret: string; readonly reveals: Reveals };
/** og types/cross-jurisdiction.ts CrossJurisdictionSwapRoute, field for field. */
export type CrossRoute = {
  readonly orderId: string; readonly routeHash?: string; readonly bookOwnerEntityId?: string; readonly venueId?: string;
  readonly sourceSignerId?: string; readonly sourceHubSignerId?: string; readonly targetHubSignerId?: string; readonly targetSignerId?: string; readonly bookHubSignerId?: string;
  readonly makerEntityId: string; readonly hubEntityId: string; readonly source: CrossLeg; readonly target: CrossLeg; readonly sourceDisputeConfig: DisputeConfig; readonly targetDisputeConfig: DisputeConfig;
  readonly sourcePull?: CrossPullLeg; readonly targetPull?: CrossPullLeg; readonly sourceCloseProof?: CrossCloseProof; readonly targetCloseProof?: CrossCloseProof;
  readonly priceTicks?: bigint; readonly fillSeq?: number; readonly cumulativeFillRatio?: number; readonly fillNumerator?: bigint; readonly fillDenominator?: bigint;
  readonly filledSourceAmount?: bigint; readonly filledTargetAmount?: bigint; readonly pendingClearRequestedAt?: number; readonly domain?: CrossRouteDomain; readonly timePolicy?: CrossTimePolicy;
  readonly clearingPolicy?: "manual" | "full_fill" | "cancel_and_clear"; readonly riskMode?: "fully_collateralized" | "partially_collateralized" | "credit_line" | "unsecured_internalized";
  readonly claimedRatio?: number; readonly sourceRegistryFillRatio?: number; readonly targetRegistryFillRatio?: number; readonly sourceRegistryRecord?: CrossRecord; readonly targetRegistryRecord?: CrossRecord;
  readonly pendingSourceRegistryReveal?: CrossPendingReveal; readonly pendingTargetRegistryReveal?: CrossPendingReveal;
  readonly sourceClaimed?: bigint; readonly targetClaimed?: bigint; readonly status: CrossStatus; readonly createdAt: number; readonly updatedAt: number;
  readonly expiresAt?: number; readonly settledAt?: number; readonly error?: string; readonly memo?: string;
};
type MutableRoute = { -readonly [K in keyof CrossRoute]: CrossRoute[K] };
const CROSS_RANK: Readonly<Record<CrossStatus, number>> = { intent: 10, target_prepared: 20, resting: 40, partially_filled: 50, clear_requested: 60, clearing: 70, settled: 120, cancelled: 120, expired: 120 };
const CROSS_NEXT: Readonly<Record<CrossStatus, readonly CrossStatus[]>> = {
  intent: ["intent", "target_prepared", "resting", "cancelled", "expired"], target_prepared: ["target_prepared", "resting", "clearing", "cancelled", "expired"],
  resting: ["resting", "partially_filled", "clear_requested", "clearing", "cancelled", "expired"], partially_filled: ["partially_filled", "clear_requested", "clearing", "cancelled", "expired"],
  clear_requested: ["clear_requested", "clearing", "cancelled", "expired"], clearing: ["clearing", "settled", "cancelled", "expired"], settled: ["settled"], cancelled: ["cancelled"], expired: ["expired"],
};
export const isCrossStatus = (v: unknown): v is CrossStatus => (CROSS_STATUSES as readonly unknown[]).includes(v);
export const isCrossTerminal = (s: CrossStatus | undefined): boolean => s === "settled" || s === "cancelled" || s === "expired";
export const compareCrossStatus = (current: CrossStatus | undefined, next: CrossStatus | undefined): number => (CROSS_RANK[next || "intent"] ?? 0) - (CROSS_RANK[current || "intent"] ?? 0);
export const crossTransitionAllowed = (current: CrossStatus | undefined, next: CrossStatus | undefined): boolean => !current || !next || (CROSS_NEXT[current]?.includes(next) ?? false);
export const transitionCrossStatus = (r: CrossRoute, next: CrossStatus, updatedAt: number): Result<CrossRoute, CrossError> =>
  crossTransitionAllowed(r.status, next) ? ok({ ...r, status: next, updatedAt }) : crossErr("CROSS_J_ROUTE_TRANSITION_INVALID");
export const isCrossExpired = (r: CrossRoute, now: number): boolean => { const at = Number(r.expiresAt || 0); return Number.isFinite(at) && at > 0 && at <= now; };
// og market.ts: stack identities, canonical base/quote, venue and book owner.
const lowerText = (v: unknown): string => String(v || "").toLowerCase();
const trimLower = (v: unknown): string => String(v ?? "").trim().toLowerCase();
const stackOf = (j: unknown): { readonly chainId: number; readonly depositoryAddress: string } | undefined => {
  if (typeof j !== "string") return undefined;
  const m = /^stack:(\d+):(0x[0-9a-fA-F]{40})$/.exec(j.trim()), chainId = Number(m?.[1]);
  return m === null || !Number.isSafeInteger(chainId) || chainId <= 0 ? undefined : { chainId, depositoryAddress: (m[2] ?? "").toLowerCase() };
};
/** og getJurisdictionStackId: the `stack:<chainId>:<depository>` label of an Account domain. */
export const stackIdOf = (d: { readonly chainId?: unknown; readonly depositoryAddress?: unknown }): string => {
  const dep = typeof d.depositoryAddress === "string" ? d.depositoryAddress.trim().toLowerCase() : "", chainId = Number(d.chainId);
  return dep === "" ? "" : Number.isSafeInteger(chainId) && chainId > 0 ? `stack:${chainId}:${dep}` : `stack:${dep}`;
};
const assetKey = (j: string, tokenId: number): Result<string, CrossError> => { const s = stackOf(j); return s === undefined ? crossErr("CROSS_J_MARKET_JURISDICTION_INVALID") : ok(`stack:${s.chainId}:${s.depositoryAddress}:${Math.floor(Number(tokenId) || 0)}`); };
export type CrossMarket = { readonly sourceKey: string; readonly targetKey: string; readonly baseKey: string; readonly quoteKey: string; readonly sourceIsBase: boolean; readonly venueId: string };
export const crossMarketForLegs = (sj: string, st: number, tj: string, tt: number): Result<CrossMarket, CrossError> => chain(assetKey(sj, st), (sourceKey) => map(assetKey(tj, tt), (targetKey): CrossMarket => {
  const sl = REFERENCE_STABLES.has(st), tl = REFERENCE_STABLES.has(tt), sourceIsBase = sl !== tl ? !sl : sourceKey <= targetKey;
  const baseKey = sourceIsBase ? sourceKey : targetKey, quoteKey = sourceIsBase ? targetKey : sourceKey;
  return { sourceKey, targetKey, baseKey, quoteKey, sourceIsBase, venueId: `cross:${baseKey}/${quoteKey}` };
}));
export const crossMarket = (r: Pick<CrossRoute, "source" | "target">): Result<CrossMarket, CrossError> => crossMarketForLegs(r.source.jurisdiction, r.source.tokenId, r.target.jurisdiction, r.target.tokenId);
export const crossBookOwnerForLegs = (sj: string, sourceHub: string, tj: string, targetHub: string): Result<string, CrossError> => {
  const s = stackOf(sj), t = stackOf(tj);
  if (s === undefined || t === undefined) return crossErr("CROSS_J_BOOK_JURISDICTION_INVALID");
  if (s.chainId === t.chainId && s.depositoryAddress === t.depositoryAddress) return crossErr("CROSS_J_REQUIRES_DISTINCT_STACKS");
  return ok(lowerText(s.chainId < t.chainId || (s.chainId === t.chainId && s.depositoryAddress < t.depositoryAddress) ? sourceHub : targetHub));
};
export const crossBookOwner = (r: Pick<CrossRoute, "source" | "target">): Result<string, CrossError> => crossBookOwnerForLegs(r.source.jurisdiction, r.source.counterpartyEntityId, r.target.jurisdiction, r.target.entityId);
/** og canonicalAccountDisputeConfig: Number-coerced uint32 windows, total at most one year. */
const canonDisputeConfig = (c: unknown): Result<DisputeConfig, CrossError> => {
  if (!c || typeof c !== "object") return crossErr("ACCOUNT_DISPUTE_CONFIG_INVALID");
  const secs = (v: unknown): number | undefined => { const n = Number(v); return Number.isSafeInteger(n) && n >= 0 && n <= MAX_UINT32 ? n : undefined; };
  const l = secs((c as DisputeConfig).leftResponseSeconds), r = secs((c as DisputeConfig).rightResponseSeconds);
  if (l === undefined || r === undefined) return crossErr("ACCOUNT_DISPUTE_RESPONSE_SECONDS_INVALID");
  return l + r > MAX_DISPUTE_SECONDS ? crossErr("ACCOUNT_DISPUTE_RESPONSE_TOTAL_EXCEEDED") : ok({ leftResponseSeconds: l, rightResponseSeconds: r });
};
const optAddress = (v: unknown): string | undefined => { const t = trimLower(v); return /^0x[0-9a-f]{40}$/.test(t) ? t : undefined; };
const routeDomain = (r: CrossRoute): CrossRouteDomain => {
  const d = r.domain, asset = (j: string, tk: number): string => `${trimLower(j)}:${Math.floor(Number(tk))}`;
  return {
    protocol: "xln-cross-j", hashSchema: "route-domain", sourceStackId: trimLower(d?.sourceStackId || r.source.jurisdiction), targetStackId: trimLower(d?.targetStackId || r.target.jurisdiction),
    ...opt("sourceEntityProviderAddress", optAddress(d?.sourceEntityProviderAddress)), ...opt("targetEntityProviderAddress", optAddress(d?.targetEntityProviderAddress)),
    ...opt("sourceDeltaTransformerAddress", optAddress(d?.sourceDeltaTransformerAddress)), ...opt("targetDeltaTransformerAddress", optAddress(d?.targetDeltaTransformerAddress)),
    sourceAssetRef: String(d?.sourceAssetRef || asset(r.source.jurisdiction, r.source.tokenId)).trim().toLowerCase(), targetAssetRef: String(d?.targetAssetRef || asset(r.target.jurisdiction, r.target.tokenId)).trim().toLowerCase(),
  };
};
const routeTimePolicy = (r: CrossRoute): Result<CrossTimePolicy, CrossError> => {
  const at = Math.floor(Number(r.timePolicy?.runtimeExpiresAtMs ?? r.expiresAt ?? 0));
  return !Number.isFinite(at) || at < 0 ? crossErr("CROSS_J_TIME_POLICY_EXPIRES_INVALID")
    : ok({ runtimeClock: "unix_ms", settlementClock: "unix_seconds", deadlineConversion: "floor_ms_to_unix_seconds", runtimeExpiresAtMs: at, finalityPolicy: "independent_beneficiary_windows_pull_sum_finality" });
};
/** og withCrossJurisdictionPolicyDefaults. */
const policyDefaults = (r: CrossRoute): Result<CrossRoute, CrossError> =>
  chain(canonDisputeConfig(r.sourceDisputeConfig), (sourceDisputeConfig) => chain(canonDisputeConfig(r.targetDisputeConfig), (targetDisputeConfig) => map(routeTimePolicy(r), (timePolicy) =>
    ({ ...r, sourceDisputeConfig, targetDisputeConfig, riskMode: r.riskMode || "fully_collateralized", domain: routeDomain(r), timePolicy }))));
const abiText = (s: string): Abi => { if (/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(s)) throw new Error("ABI_ENCODE_INVALID_VALUE:utf8"); return A.bytes(bytesToHex(utf8(s))); };
const abiUint = (v: bigint, bits: number): Abi => { if (v < 0n || v >= 1n << BigInt(bits)) throw new Error("ABI_ENCODE_INVALID_VALUE:uint-range"); return A.uint(v); };
/** og deriveCrossJurisdictionRouteHash: keccak of the 43-field ABI tuple over the policy-defaulted route. */
export const crossRouteHash = (route: CrossRoute): Result<string, CrossError> => chain(policyDefaults(route), (r): Result<string, CrossError> => {
  const d = r.domain as CrossRouteDomain, tp = r.timePolicy as CrossTimePolicy, s = (v: unknown): Abi => abiText(String(v)), e = (v: unknown): Abi => abiText(lowerText(v));
  const u = (v: unknown): Abi => abiUint(BigInt(v as bigint), 256), u32 = (v: number): Abi => abiUint(BigInt(v), 32);
  try {
    return ok(keccak256Hex(abiEncode([
      s(r.orderId || ""), e(r.bookOwnerEntityId || r.source.counterpartyEntityId || r.hubEntityId), s(r.venueId || ""), e(r.makerEntityId), e(r.hubEntityId),
      e(r.sourceSignerId || ""), e(r.sourceHubSignerId || ""), e(r.targetHubSignerId || ""), e(r.targetSignerId || ""), e(r.bookHubSignerId || ""),
      s(trimLower(r.source.jurisdiction || "")), e(r.source.entityId), e(r.source.counterpartyEntityId), u(BigInt(String(Math.floor(Number(r.source.tokenId))))), u(r.source.amount),
      s(trimLower(r.target.jurisdiction || "")), e(r.target.entityId), e(r.target.counterpartyEntityId), u(BigInt(String(Math.floor(Number(r.target.tokenId))))), u(r.target.amount),
      A.bool(r.priceTicks !== undefined), ((v: bigint): Abi => { if (v < -(1n << 255n) || v >= 1n << 255n) throw new Error("ABI_ENCODE_INVALID_VALUE:int-range"); return A.int(v); })(BigInt(r.priceTicks ?? 0n)),
      u(Math.floor(Number(r.expiresAt ?? 0))), s(String(r.riskMode || "")),
      s(d.protocol), s(d.hashSchema), s(d.sourceStackId), s(d.targetStackId), s(d.sourceEntityProviderAddress || ""), s(d.targetEntityProviderAddress || ""),
      s(d.sourceDeltaTransformerAddress || ""), s(d.targetDeltaTransformerAddress || ""), s(d.sourceAssetRef), s(d.targetAssetRef),
      s(tp.runtimeClock), s(tp.settlementClock), s(tp.deadlineConversion), u(tp.runtimeExpiresAtMs), s(tp.finalityPolicy),
      u32(r.sourceDisputeConfig.leftResponseSeconds), u32(r.sourceDisputeConfig.rightResponseSeconds), u32(r.targetDisputeConfig.leftResponseSeconds), u32(r.targetDisputeConfig.rightResponseSeconds),
    ])));
  } catch { return crossErr("CROSS_J_ROUTE_HASH_ENCODING"); }
});
/** og withCanonicalCrossJurisdictionRouteHash: venue defaults (book owner, venue, hub), policy defaults, fully collateralized only, then the hash (a supplied one must agree). */
export const canonicalCrossRoute = (route: CrossRoute): Result<CrossRoute, CrossError> =>
  chain(route.bookOwnerEntityId ? ok(route.bookOwnerEntityId) : crossBookOwner(route), (owner) => chain(route.venueId ? ok(route.venueId) : map(crossMarket(route), (m) => m.venueId), (venueId) => {
    const bookOwnerEntityId = lowerText(owner);
    return chain(policyDefaults({ ...route, bookOwnerEntityId, venueId, hubEntityId: route.hubEntityId || bookOwnerEntityId }), (r) =>
      (r.riskMode || "fully_collateralized") !== "fully_collateralized" ? crossErr("CROSS_J_RISK_MODE_UNSUPPORTED")
      : chain(crossRouteHash(r), (routeHash) => (r.routeHash && String(r.routeHash).toLowerCase() !== routeHash.toLowerCase() ? crossErr("CROSS_J_ROUTE_HASH_MISMATCH") : ok({ ...r, routeHash }))));
  }));
const hashOrDerive = (r: CrossRoute): Result<string, CrossError> => (r.routeHash ? ok(r.routeHash) : crossRouteHash(r));
/** og deriveCrossJurisdictionPullId. */
export const crossPullId = (r: CrossRoute, leg: "source" | "target"): Result<string, CrossError> => map(hashOrDerive(r), (h) => keccak256Hex(utf8(`xln:cross-j:pull-id:v1:${h}:${leg}`)));
/** og deriveCrossJurisdictionPrivateSeed: the hash-ladder seed is private to the runtime seed and bound to the route hash. */
export const crossPrivateSeed = (runtimeSeed: string | undefined, r: CrossRoute): Result<string, CrossError> => {
  const seed = String(runtimeSeed || "").trim();
  return seed === "" ? crossErr("CRYPTO_DETERMINISM_VIOLATION") : map(hashOrDerive(r), (h) => keccak256Hex(utf8(`xln:cross-j:hashladder-private-seed:v1:${seed}:${h}`)));
};
/** og signedCrossJurisdictionAmountForBeneficiary: positive when the beneficiary is the left entity. */
export const crossSignedAmount = (beneficiary: string, counterparty: string, amount: bigint): bigint => (before(lowerText(beneficiary), lowerText(counterparty)) ? amount : -amount);
const cloneLeg = (l: CrossLeg): CrossLeg => ({ jurisdiction: String(l.jurisdiction || ""), entityId: String(l.entityId || ""), counterpartyEntityId: String(l.counterpartyEntityId || ""), tokenId: Number(l.tokenId), amount: BigInt(l.amount) });
const clonePull = (p: CrossPullLeg | undefined): CrossPullLeg | undefined => p === undefined ? undefined
  : { pullId: String(p.pullId || ""), tokenId: Number(p.tokenId), amount: BigInt(p.amount), signedAmount: BigInt(p.signedAmount), fullHash: String(p.fullHash || ""), partialRoot: String(p.partialRoot || "") };
const CLOSE_MODES: readonly unknown[] = ["full", "partial_cancel_remainder", "pure_cancel"];
/** og cloneCrossJurisdictionCloseProof: exact uint16 ratio and a known close mode. */
export const cloneCloseProof = (p: CrossCloseProof): Result<CrossCloseProof, CrossError> => {
  const fillRatio = Number(p.fillRatio);
  if (!Number.isSafeInteger(fillRatio) || fillRatio < 0 || fillRatio > MAX_FILL) return crossErr("CROSS_J_CLOSE_PROOF_FILL_RATIO_INVALID");
  if (!CLOSE_MODES.includes(p.closeMode)) return crossErr("CROSS_J_CLOSE_PROOF_MODE_INVALID");
  return ok({ orderId: String(p.orderId || ""), routeHash: String(p.routeHash || ""), sourcePullId: String(p.sourcePullId || ""), targetPullId: String(p.targetPullId || ""), fillRatio,
    cumulativeSourceAmount: BigInt(p.cumulativeSourceAmount ?? 0n), cumulativeTargetAmount: BigInt(p.cumulativeTargetAmount ?? 0n), binaryHash: String(p.binaryHash || ""), closeMode: p.closeMode });
};
const optText = (v: unknown): string | undefined => { const t = String(v ?? "").trim(); return t === "" ? undefined : t; };
const optNum = (v: unknown): number | undefined => (v === undefined || v === null ? undefined : Number(v));
const optBig = (v: unknown): bigint | undefined => (v === undefined || v === null ? undefined : BigInt(v as bigint));
/** og cloneCrossJurisdictionRoute: the public route with every field normalized and blanks dropped. */
export const cloneCrossRoute = (r: CrossRoute): Result<CrossRoute, CrossError> => {
  if (!isCrossStatus(r.status)) return crossErr("CROSS_J_ROUTE_STATUS_INVALID");
  const proof = (p: CrossCloseProof | undefined): Result<CrossCloseProof | undefined, CrossError> => (p ? cloneCloseProof(p) : ok(undefined));
  return chain(proof(r.sourceCloseProof), (sourceCloseProof) => chain(proof(r.targetCloseProof), (targetCloseProof): Result<CrossRoute, CrossError> => {
    const d = r.domain, tp = r.timePolicy, reveal = (x: CrossPendingReveal | undefined): CrossPendingReveal | undefined => (x ? { fillRatio: x.fillRatio, fullSecret: x.fullSecret, reveals: [...x.reveals] as unknown as Reveals } : undefined);
    const clone: MutableRoute = {
      orderId: String(r.orderId || ""), makerEntityId: String(r.makerEntityId || ""), hubEntityId: String(r.hubEntityId || ""), source: cloneLeg(r.source), target: cloneLeg(r.target),
      sourceDisputeConfig: { leftResponseSeconds: Number(r.sourceDisputeConfig.leftResponseSeconds), rightResponseSeconds: Number(r.sourceDisputeConfig.rightResponseSeconds) },
      targetDisputeConfig: { leftResponseSeconds: Number(r.targetDisputeConfig.leftResponseSeconds), rightResponseSeconds: Number(r.targetDisputeConfig.rightResponseSeconds) },
      status: r.status, createdAt: Number(r.createdAt || 0), updatedAt: Number(r.updatedAt || 0),
      ...opt("routeHash", optText(r.routeHash)), ...opt("bookOwnerEntityId", optText(r.bookOwnerEntityId)), ...opt("venueId", optText(r.venueId)), ...opt("sourceSignerId", optText(r.sourceSignerId)),
      ...opt("sourceHubSignerId", optText(r.sourceHubSignerId)), ...opt("targetHubSignerId", optText(r.targetHubSignerId)), ...opt("targetSignerId", optText(r.targetSignerId)), ...opt("bookHubSignerId", optText(r.bookHubSignerId)),
      ...opt("sourcePull", clonePull(r.sourcePull)), ...opt("targetPull", clonePull(r.targetPull)), ...opt("sourceCloseProof", sourceCloseProof), ...opt("targetCloseProof", targetCloseProof),
      ...opt("priceTicks", optBig(r.priceTicks)), ...opt("fillSeq", optNum(r.fillSeq)), ...opt("cumulativeFillRatio", optNum(r.cumulativeFillRatio)), ...opt("fillNumerator", optBig(r.fillNumerator)),
      ...opt("fillDenominator", optBig(r.fillDenominator)), ...opt("filledSourceAmount", optBig(r.filledSourceAmount)), ...opt("filledTargetAmount", optBig(r.filledTargetAmount)),
      ...opt("pendingClearRequestedAt", optNum(r.pendingClearRequestedAt)),
      ...(d ? { domain: {
        protocol: "xln-cross-j", hashSchema: "route-domain", sourceStackId: String(d.sourceStackId || ""), targetStackId: String(d.targetStackId || ""),
        ...(d.sourceEntityProviderAddress ? { sourceEntityProviderAddress: String(d.sourceEntityProviderAddress) } : {}), ...(d.targetEntityProviderAddress ? { targetEntityProviderAddress: String(d.targetEntityProviderAddress) } : {}),
        ...(d.sourceDeltaTransformerAddress ? { sourceDeltaTransformerAddress: String(d.sourceDeltaTransformerAddress) } : {}), ...(d.targetDeltaTransformerAddress ? { targetDeltaTransformerAddress: String(d.targetDeltaTransformerAddress) } : {}),
        sourceAssetRef: String(d.sourceAssetRef || ""), targetAssetRef: String(d.targetAssetRef || ""),
      } } : {}),
      ...(tp ? { timePolicy: { runtimeClock: "unix_ms", settlementClock: "unix_seconds", deadlineConversion: "floor_ms_to_unix_seconds", runtimeExpiresAtMs: Number(tp.runtimeExpiresAtMs || 0), finalityPolicy: "independent_beneficiary_windows_pull_sum_finality" } } : {}),
      ...(r.clearingPolicy ? { clearingPolicy: r.clearingPolicy } : {}), ...(r.riskMode ? { riskMode: r.riskMode } : {}),
      ...opt("claimedRatio", optNum(r.claimedRatio)), ...opt("sourceRegistryFillRatio", optNum(r.sourceRegistryFillRatio)), ...opt("targetRegistryFillRatio", optNum(r.targetRegistryFillRatio)),
      ...(r.sourceRegistryRecord ? { sourceRegistryRecord: { fillRatio: r.sourceRegistryRecord.fillRatio, revealedAt: r.sourceRegistryRecord.revealedAt } } : {}),
      ...(r.targetRegistryRecord ? { targetRegistryRecord: { fillRatio: r.targetRegistryRecord.fillRatio, revealedAt: r.targetRegistryRecord.revealedAt } } : {}),
      ...opt("pendingSourceRegistryReveal", reveal(r.pendingSourceRegistryReveal)), ...opt("pendingTargetRegistryReveal", reveal(r.pendingTargetRegistryReveal)),
      ...opt("sourceClaimed", optBig(r.sourceClaimed)), ...opt("targetClaimed", optBig(r.targetClaimed)), ...opt("expiresAt", optNum(r.expiresAt)), ...opt("settledAt", optNum(r.settledAt)),
      ...opt("error", optText(r.error)), ...opt("memo", optText(r.memo)),
    };
    return ok(clone);
  }));
};
/** og cloneCrossJurisdictionPullBinding. */
export const cloneCrossBinding = (b: CrossPullBinding): Result<CrossPullBinding, CrossError> =>
  b.status !== undefined && !isCrossStatus(b.status) ? crossErr("CROSS_J_ROUTE_STATUS_INVALID")
  : ok({ orderId: String(b.orderId || ""), routeHash: String(b.routeHash || ""), leg: b.leg, ...opt("status", b.status) });
/** og buildCrossJurisdictionPullBinding: the opening binding of one leg to the canonical route. */
export const crossPullBinding = (route: CrossRoute, leg: "source" | "target"): Result<CrossPullBinding, CrossError> =>
  chain(canonicalCrossRoute(route), (c) => chain(hashOrDerive(c), (routeHash) => cloneCrossBinding({ orderId: c.orderId, routeHash, leg, status: c.status })));
/** og hashCrossJurisdictionCloseBinary: keccak of the ladder reveal bytes. */
export const crossCloseBinaryHash = (binary: string): Result<string, CrossError> => { const b = parseHex(String(binary || "0x")); return b === null || !String(binary || "0x").startsWith("0x") ? crossErr("CROSS_J_CLOSE_BINARY_INVALID") : ok(keccak256Hex(b)); };
// og exact fill progress: cumulative amounts are exact n/d scalings; the uint16 ratio is only the dispute projection.
type ExactRatio = { readonly numerator: bigint; readonly denominator: bigint };
const readExactRatio = (x: { readonly fillNumerator?: bigint | undefined; readonly fillDenominator?: bigint | undefined }): Result<ExactRatio | undefined, CrossError> => {
  if (x.fillNumerator === undefined && x.fillDenominator === undefined) return ok(undefined);
  if (x.fillNumerator === undefined || x.fillDenominator === undefined) return crossErr("CROSS_J_EXACT_FILL_RATIO_INCOMPLETE");
  return x.fillDenominator <= 0n || x.fillNumerator < 0n || x.fillNumerator > x.fillDenominator ? crossErr("CROSS_J_EXACT_FILL_RATIO_INVALID") : ok({ numerator: x.fillNumerator, denominator: x.fillDenominator });
};
const scaleExact = (total: bigint, r: ExactRatio): bigint => (r.numerator >= r.denominator ? total : (total * r.numerator) / r.denominator);
type ProofRatioInput = { readonly cumulativeFillRatio?: number | undefined; readonly claimedRatio?: number | undefined; readonly fillNumerator?: bigint | undefined; readonly fillDenominator?: bigint | undefined };
/** og getCrossJurisdictionCommittedProofRatio: the uint16 projection of the exact ratio; coarse fields must agree with it. */
export const crossProofRatio = (x: ProofRatioInput): Result<number, CrossError> => chain(readExactRatio(x), (exact): Result<number, CrossError> => {
  if (exact === undefined) return Math.max(clampRatio(x.cumulativeFillRatio), clampRatio(x.claimedRatio)) > 0 ? crossErr("CROSS_J_EXACT_FILL_RATIO_REQUIRED") : ok(0);
  const derived = fillRatioOf({ n: exact.numerator, d: exact.denominator });
  return [x.cumulativeFillRatio, x.claimedRatio].some((v) => v !== undefined && clampRatio(v) !== derived) ? crossErr("CROSS_J_COARSE_EXACT_RATIO_MISMATCH") : ok(derived);
});
export type CrossFillAmounts = { readonly sourceTotal: bigint; readonly targetTotal: bigint; readonly filledSourceAmount: bigint; readonly filledTargetAmount: bigint; readonly fillRatio: number };
/** og getCrossJurisdictionCommittedFillAmounts. */
export const crossFillAmounts = (r: CrossRoute): Result<CrossFillAmounts, CrossError> => chain(readExactRatio(r), (exact) => {
  const sourceTotal = BigInt(r.source.amount), targetTotal = BigInt(r.target.amount);
  if (exact === undefined && [r.filledSourceAmount, r.filledTargetAmount, r.sourceClaimed, r.targetClaimed].some((v) => v !== undefined && v !== 0n)) return crossErr("CROSS_J_EXACT_FILL_RATIO_REQUIRED");
  const src = exact ? scaleExact(sourceTotal, exact) : 0n, tgt = exact ? scaleExact(targetTotal, exact) : 0n;
  return chain(crossProofRatio(r), (fillRatio) => ([[r.filledSourceAmount, src], [r.filledTargetAmount, tgt], [r.sourceClaimed, src], [r.targetClaimed, tgt]] as const).some(([have, want]) => have !== undefined && have !== want)
    ? crossErr("CROSS_J_COMMITTED_AMOUNT_MISMATCH") : ok({ sourceTotal, targetTotal, filledSourceAmount: src, filledTargetAmount: tgt, fillRatio }));
});
export const hasCrossCommittedFill = (r: CrossRoute): Result<boolean, CrossError> => map(crossFillAmounts(r), (c) => c.fillRatio > 0 || c.filledSourceAmount > 0n || c.filledTargetAmount > 0n);
export const isCrossFillTerminal = (r: CrossRoute, x: { readonly nextRatio: number; readonly cancelRemainder?: boolean | undefined }): Result<boolean, CrossError> =>
  map(crossFillAmounts(r), (c) => x.nextRatio >= MAX_FILL || c.filledSourceAmount >= BigInt(r.source.amount) || c.filledTargetAmount >= BigInt(r.target.amount) || Boolean(x.cancelRemainder));
export type CrossFillInput = ProofRatioInput & { readonly fillSeq?: number | undefined; readonly cumulativeFillRatio: number; readonly incrementalSourceAmount?: bigint | undefined; readonly incrementalTargetAmount?: bigint | undefined; readonly cumulativeSourceAmount?: bigint | undefined; readonly cumulativeTargetAmount?: bigint | undefined };
export type CrossFillProgress = {
  readonly fillSeq: number; readonly previousRatio: number; readonly nextRatio: number; readonly fillNumerator: bigint; readonly fillDenominator: bigint; readonly previousSourceAmount: bigint; readonly previousTargetAmount: bigint;
  readonly cumulativeSourceAmount: bigint; readonly cumulativeTargetAmount: bigint; readonly incrementalSourceAmount: bigint; readonly incrementalTargetAmount: bigint;
};
/** og validateCrossJurisdictionFillProgress: next sequence, exact ratio strictly increasing, positive increments, echoed amounts must agree. */
export const crossFillProgress = (r: CrossRoute, x: CrossFillInput): Result<CrossFillProgress, CrossError> => {
  const prevSeq = Math.max(0, Math.floor(Number(r.fillSeq ?? 0) || 0)), nextSeq = x.fillSeq === undefined ? prevSeq + 1 : Math.floor(Number(x.fillSeq));
  if (!Number.isInteger(nextSeq) || nextSeq !== prevSeq + 1) return crossErr("CROSS_J_FILL_SEQ");
  return chain(readExactRatio(x), (exact) => exact === undefined ? crossErr("CROSS_J_EXACT_FILL_RATIO_REQUIRED") : chain(crossProofRatio(r), (previousRatio) =>
    chain(crossProofRatio({ cumulativeFillRatio: x.cumulativeFillRatio, fillNumerator: x.fillNumerator, fillDenominator: x.fillDenominator }), (nextRatio): Result<CrossFillProgress, CrossError> => {
      if (nextRatio <= previousRatio) return crossErr("CROSS_J_FILL_NON_MONOTONIC");
      const sourceTotal = BigInt(r.source.amount), targetTotal = BigInt(r.target.amount);
      if (sourceTotal <= 0n || targetTotal <= 0n) return crossErr("CROSS_J_FILL_ROUTE_AMOUNT");
      return chain(crossFillAmounts(r), (c): Result<CrossFillProgress, CrossError> => {
        const cs = scaleExact(sourceTotal, exact), ct = scaleExact(targetTotal, exact), is = cs - c.filledSourceAmount, it = ct - c.filledTargetAmount;
        if (is <= 0n || it <= 0n) return crossErr("CROSS_J_FILL_NO_INCREMENT");
        if ((x.cumulativeSourceAmount !== undefined && x.cumulativeSourceAmount !== cs) || (x.cumulativeTargetAmount !== undefined && x.cumulativeTargetAmount !== ct)
          || (x.incrementalSourceAmount !== undefined && x.incrementalSourceAmount !== is) || (x.incrementalTargetAmount !== undefined && x.incrementalTargetAmount !== it)) return crossErr("CROSS_J_FILL_AMOUNT_MISMATCH");
        return ok({ fillSeq: nextSeq, previousRatio, nextRatio, fillNumerator: exact.numerator, fillDenominator: exact.denominator, previousSourceAmount: c.filledSourceAmount, previousTargetAmount: c.filledTargetAmount,
          cumulativeSourceAmount: cs, cumulativeTargetAmount: ct, incrementalSourceAmount: is, incrementalTargetAmount: it });
      });
    })));
};
/** og applyCrossJurisdictionFillProgress: the validated progress written onto the route. */
export const applyCrossFill = (r: CrossRoute, x: CrossFillInput, updatedAt: number): Result<CrossRoute, CrossError> => map(crossFillProgress(r, x), (f) => ({
  ...r, fillSeq: f.fillSeq, cumulativeFillRatio: f.nextRatio, fillNumerator: f.fillNumerator, fillDenominator: f.fillDenominator, claimedRatio: f.nextRatio,
  filledSourceAmount: f.cumulativeSourceAmount, filledTargetAmount: f.cumulativeTargetAmount, sourceClaimed: f.cumulativeSourceAmount, targetClaimed: f.cumulativeTargetAmount,
  status: f.nextRatio >= MAX_FILL ? "clear_requested" : "partially_filled", updatedAt,
}));
/** og withCrossJurisdictionCloseProofProgress. */
export const withCloseProofProgress = (r: CrossRoute, p: CrossCloseProof, updatedAt: number): CrossRoute => ({
  ...r, cumulativeFillRatio: p.fillRatio, fillNumerator: BigInt(p.fillRatio), fillDenominator: BigInt(MAX_FILL), claimedRatio: p.fillRatio,
  filledSourceAmount: p.cumulativeSourceAmount, filledTargetAmount: p.cumulativeTargetAmount, sourceClaimed: p.cumulativeSourceAmount, targetClaimed: p.cumulativeTargetAmount, updatedAt,
});
/** og buildCrossJurisdictionCloseProof: the Hub's exact source+target close cohort at the committed ratio. */
export const buildCrossCloseProof = (route: CrossRoute, binary: string): Result<CrossCloseProof, CrossError> => chain(canonicalCrossRoute(route), (c) => {
  if (!c.sourcePull || !c.targetPull) return crossErr("CROSS_J_CLOSE_PROOF_PULLS_MISSING");
  const { sourcePull, targetPull } = c;
  return chain(crossFillAmounts(c), (f) => chain(hashOrDerive(c), (routeHash) => chain(crossCloseBinaryHash(binary), (binaryHash) => cloneCloseProof({
    orderId: c.orderId, routeHash, sourcePullId: sourcePull.pullId, targetPullId: targetPull.pullId, fillRatio: f.fillRatio, cumulativeSourceAmount: f.filledSourceAmount, cumulativeTargetAmount: f.filledTargetAmount,
    binaryHash, closeMode: f.fillRatio >= MAX_FILL ? "full" : f.fillRatio <= 0 ? "pure_cancel" : "partial_cancel_remainder",
  }))));
});
const CROSS_DEFAULT_BOOK_TTL_MS = 60_000;
/** og buildPreparedCrossJurisdictionRoute: book TTL, canonical hash, a useful asset route, both pulls from the private ladder. */
export const prepareCrossRoute = (route: CrossRoute, o: { readonly runtimeSeed?: string | undefined; readonly now: number }): Result<CrossRoute, CrossError> => {
  const now = Math.floor(Number(o.now || 0));
  if (!Number.isFinite(now) || now <= 0) return crossErr("CROSS_J_NOW_INVALID");
  const expiresAt = Math.floor(Number(route.expiresAt ?? now + CROSS_DEFAULT_BOOK_TTL_MS));
  if (!Number.isFinite(expiresAt) || expiresAt <= now) return crossErr("CROSS_J_EXPIRES_AT_INVALID");
  return chain(canonicalCrossRoute({ ...route, expiresAt }), (c) => {
    if (trimLower(c.source.jurisdiction) === trimLower(c.target.jurisdiction) && Number(c.source.tokenId) === Number(c.target.tokenId)) return crossErr("CROSS_J_SAME_JURISDICTION_TOKEN_INVALID");
    return chain(crossPrivateSeed(o.runtimeSeed, c), (seed) => chain(crossPullId(c, "source"), (sourcePullId) => map(crossPullId(c, "target"), (targetPullId): CrossRoute => {
      const ladder = buildHashLadderProof(seed), sa = BigInt(c.source.amount), ta = BigInt(c.target.amount);
      return {
        ...c,
        sourcePull: { pullId: sourcePullId, tokenId: Number(route.source.tokenId), amount: sa, signedAmount: crossSignedAmount(route.source.counterpartyEntityId, route.source.entityId, sa), fullHash: ladder.fullHash, partialRoot: ladder.partialRoot },
        targetPull: { pullId: targetPullId, tokenId: Number(route.target.tokenId), amount: ta, signedAmount: crossSignedAmount(route.target.counterpartyEntityId, route.target.entityId, ta), fullHash: ladder.fullHash, partialRoot: ladder.partialRoot },
        status: "target_prepared", updatedAt: now, expiresAt,
      };
    })));
  });
};
/** og buildCrossJurisdictionPullReveal: the ladder reveal at a ratio, from the route's private seed. */
export const crossPullReveal = (fillRatio: number, privateSeed: string): Result<HashLadderReveal, CrossError> =>
  String(privateSeed || "").trim() === "" ? crossErr("CROSS_J_HASHLADDER_PRIVATE_SEED_MISSING") : ok(revealHashLadder(buildHashLadderProof(String(privateSeed).trim()), fillRatio));
// ---- pull registry settlement: og account/pull-registry-settlement.ts ----
export type SignedProofBodyPull = { readonly amount: bigint; readonly claimedRatio: number; readonly targetRole: boolean; readonly fullHash: string; readonly partialRoot: string };
export type HashLadderRegistryRecord = { readonly fillRatio: number; readonly revealedAt: number };
/**
 * The DeltaTransformer batch `(payment[], swap[], pull[])` decoded as ethers' AbiCoder does: offsets and counts are
 * safe-integer indices, a count needs a word of data per item, element reads past the end overrun; uint16 masks, bools are nonzero.
 * A bad payment/swap count ethers keeps as an unread error value; a bad pull section rejects because its pulls are read.
 */
const decodeBatchPulls = (hex: string): Result<readonly SignedProofBodyPull[], CrossError> => {
  const bad = crossErr("CROSS_J_FINAL_DELTA_BATCH_INVALID");
  const data = /^0x([0-9a-fA-F]{2})*$/.test(hex) ? parseHex(hex) : null;
  if (data === null) return bad;
  const word = (b: Uint8Array, at: number): bigint | undefined => (at + 32 > b.length ? undefined : BigInt(bytesToHex(b.subarray(at, at + 32))));
  type Index = { readonly overrun: true } | { readonly overrun: false; readonly value?: number };
  const index = (b: Uint8Array, at: number): Index => { const w = word(b, at); return w === undefined ? { overrun: true } : { overrun: false, ...(w <= BigInt(Number.MAX_SAFE_INTEGER) ? { value: Number(w) } : {}) }; };
  const top = index(data, 0);
  if (top.overrun || top.value === undefined) return bad;
  const tuple = data.subarray(top.value);
  const arrays: Array<{ readonly items?: Uint8Array; readonly count?: number }> = [];
  for (const [slot, size] of [[0, 5], [1, 5], [2, 7]] as const) {
    const off = index(tuple, slot * 32);
    if (off.overrun || off.value === undefined) return bad;
    const arr = tuple.subarray(off.value), count = index(arr, 0);
    if (count.overrun) return bad;
    if (count.value === undefined) { arrays.push({}); continue; }
    if (count.value * 32 > arr.length || 32 + count.value * size * 32 > arr.length) return bad;
    arrays.push({ items: arr.subarray(32, 32 + count.value * size * 32), count: count.value });
  }
  const pulls = arrays[2];
  if (pulls?.items === undefined || pulls.count === undefined) return bad;
  const items = pulls.items, out: SignedProofBodyPull[] = [];
  for (let i = 0; i < pulls.count; i++) {
    const at = i * 7 * 32, w = (k: number): bigint => word(items, at + k * 32) ?? 0n, h = (k: number): string => bytesToHex(items.subarray(at + k * 32, at + k * 32 + 32));
    const negative = w(1) !== 0n, magnitude = w(2);
    if (negative && magnitude === 0n) return crossErr("ABI_MONEY_NEGATIVE_ZERO");
    out.push({ amount: negative ? -magnitude : magnitude, claimedRatio: Number(w(3) & 0xffffn), fullHash: h(4).toLowerCase(), partialRoot: h(5).toLowerCase(), targetRole: w(6) !== 0n });
  }
  return ok(out);
};
/** ethers isAddress over a hex address: 0x optional; a mixed-case spelling must be its EIP-55 checksum. */
const isAddressText = (a: string): boolean => {
  if (!/^(0x)?[0-9a-fA-F]{40}$/.test(a)) return false;
  const body = a.startsWith("0x") ? a.slice(2) : a;
  return !(/[a-f]/.test(body) && /[A-F]/.test(body)) || checksum(`0x${body}`) === `0x${body}`;
};
const signedProofBodyPulls = (proofbody: Pick<ProofBody, "transformers">, transformerAddress: string): Result<readonly SignedProofBodyPull[], CrossError> => {
  if (!isAddressText(transformerAddress)) return crossErr("CROSS_J_FINAL_DELTA_TRANSFORMER_ADDRESS_INVALID");
  const canonical = transformerAddress.toLowerCase(), clauses = proofbody.transformers.filter((t) => String(t.transformerAddress).toLowerCase() === canonical);
  return clauses.length === 0 ? crossErr("CROSS_J_FINAL_DELTA_TRANSFORMER_MISSING") : map(traverse(clauses, (t) => decodeBatchPulls(t.encodedBatch)), (rows) => rows.flat());
};
/** og findExactSignedProofBodyPull: the one signed pull with this role, hash material and signed amount; two is ambiguous. */
export const findSignedProofBodyPull = (proofbody: Pick<ProofBody, "transformers">, expected: CrossPullLeg, targetRole: boolean, transformerAddress: string): Result<SignedProofBodyPull | undefined, CrossError> =>
  chain(signedProofBodyPulls(proofbody, transformerAddress), (pulls) => {
    const hits = pulls.filter((p) => p.targetRole === targetRole && p.fullHash === expected.fullHash.toLowerCase() && p.partialRoot === expected.partialRoot.toLowerCase() && p.amount === expected.signedAmount);
    return hits.length > 1 ? crossErr("CROSS_J_FINAL_PULL_AMBIGUOUS") : ok(hits[0]);
  });
const safeUintOf = (v: unknown, max: number): number | undefined => { const n = Number(v); return Number.isSafeInteger(n) && n >= 0 && n <= max ? n : undefined; };
/** og resolveFinalizedCrossJurisdictionRouteLeg: the leg whose unordered pair is this Account and whose stack is this Account's stack. */
export const finalizedRouteLeg = (x: { readonly route: Pick<CrossRoute, "orderId" | "source" | "target">; readonly self: string; readonly counterparty: string; readonly localStack?: string | undefined }): Result<"source" | "target" | undefined, CrossError> => {
  const self = x.self.toLowerCase(), peer = x.counterparty.toLowerCase();
  const pair = (l: CrossLeg): boolean => { const e = l.entityId.toLowerCase(), c = l.counterpartyEntityId.toLowerCase(); return (e === self && c === peer) || (e === peer && c === self); };
  const candidates = (["source", "target"] as const).filter((role) => pair(x.route[role]));
  if (candidates.length === 0) return ok(undefined);
  if (!x.localStack) return crossErr("CROSS_J_FINALITY_JURISDICTION_MISSING");
  const stack = x.localStack.toLowerCase(), exact = candidates.filter((role) => x.route[role].jurisdiction.toLowerCase() === stack);
  return exact.length === 1 && exact[0] !== undefined ? ok(exact[0]) : crossErr(exact.length === 0 ? "CROSS_J_FINALITY_LEG_MISSING" : "CROSS_J_FINALITY_LEG_AMBIGUOUS");
};
/**
 * og resolveFinalizedPullFillRatio (DeltaTransformer.applyPull): the signed claimedRatio, raised by a registry record revealed
 * within the beneficiary's own window of the active dispute (timeout must be start + left + right).
 */
export const finalizedPullFillRatio = (x: {
  readonly active?: { readonly disputeStartTimestamp?: unknown; readonly disputeTimeout?: unknown } | undefined; readonly proofbody: Pick<ProofBody, "transformers" | "leftResponseSeconds" | "rightResponseSeconds">;
  readonly transformerAddress: string; readonly expectedPull: CrossPullLeg; readonly targetRole: boolean; readonly record?: HashLadderRegistryRecord | undefined;
}): Result<number, CrossError> => chain(findSignedProofBodyPull(x.proofbody, x.expectedPull, x.targetRole, x.transformerAddress), (pull): Result<number, CrossError> => {
  if (pull === undefined) return crossErr("CROSS_J_FINAL_PULL_MISSING");
  const left = safeUintOf(x.proofbody.leftResponseSeconds, 0xffff_ffff), right = safeUintOf(x.proofbody.rightResponseSeconds, 0xffff_ffff);
  const start = safeUintOf(x.active?.disputeStartTimestamp, Number.MAX_SAFE_INTEGER), timeout = safeUintOf(x.active?.disputeTimeout, Number.MAX_SAFE_INTEGER);
  if (left === undefined || right === undefined || start === undefined || timeout === undefined) return crossErr("CROSS_J_FINAL_WINDOW_INVALID");
  if (timeout !== start + left + right) return crossErr("CROSS_J_FINAL_CLOCK_MISMATCH");
  const window = pull.amount > 0n ? left : right;
  if (x.record === undefined) return ok(pull.claimedRatio);
  const ratio = safeUintOf(x.record.fillRatio, MAX_FILL), revealedAt = safeUintOf(x.record.revealedAt, Number.MAX_SAFE_INTEGER);
  if (ratio === undefined || revealedAt === undefined) return crossErr("CROSS_J_REGISTRY_RECORD_INVALID");
  return ok(revealedAt >= start && revealedAt <= start + window && ratio > pull.claimedRatio ? ratio : pull.claimedRatio);
});


export type Delta = { readonly tokenId: TokenId; readonly collateral: bigint; readonly ondelta: bigint; readonly offdelta: bigint; readonly leftCreditLimit: bigint; readonly rightCreditLimit: bigint };
export type AccountState = { readonly id: AccountId; readonly deltas: ReadonlyMap<TokenId, Delta> };
export type AccountError = Tagged<"insufficient_capacity", { available: bigint; requested: bigint }> | Tagged<"negative_collateral" | "negative_credit_limit" | "negative_transfer" | "credit_limit_too_large" | "payment_too_large" | "non_positive_payment">;
/** og direct-payment.ts:30, lock.ts:49: either sender moves up to the full uint256 magnitude of SignedAmount. */
export const MAX_PAYMENT_AMOUNT = (1n << 256n) - 1n;
export const INT512_MIN = -(1n << 511n), INT512_MAX = (1n << 511n) - 1n;
export const MAX_CREDIT_LIMIT = (1n << 256n) - 1n;
const floor0 = (n: bigint): bigint => (n > 0n ? n : 0n);
export const zeroDelta = (tokenId: TokenId): Delta => ({ tokenId, collateral: 0n, ondelta: 0n, offdelta: 0n, leftCreditLimit: 0n, rightCreditLimit: 0n });
export const genesisAccount = (id: AccountId): AccountState => ({ id, deltas: new Map() });
export const getDelta = (s: AccountState, tk: TokenId): Delta => s.deltas.get(tk) ?? zeroDelta(tk);
export const setDelta = (s: AccountState, d: Delta): AccountState => ({ ...s, deltas: mapSet(s.deltas, d.tokenId, d) });
export const updateDelta = <E>(s: AccountState, tk: TokenId, f: (d: Delta) => Result<Delta, E>): Result<AccountState, E> => map(f(getDelta(s, tk)), (d) => setDelta(s, d));
export const totalDelta = (d: Delta): bigint => d.ondelta + d.offdelta;
export const leftCanPay = (d: Delta): bigint => floor0(totalDelta(d) + d.leftCreditLimit);
export const rightCanPay = (d: Delta): bigint => floor0(d.collateral + d.rightCreditLimit - totalDelta(d));
export const outCapacity = (d: Delta, payerIsLeft: boolean, held: bigint): bigint => floor0(at(leftCanPay, rightCanPay, payerIsLeft)(d) - held);
/** A negative diff is a hold of its magnitude. A reserve into collateral is not checked against outgoing capacity. */
export const chargeSettlement = (
  d: Delta,
  diff: { readonly leftDiff: bigint; readonly rightDiff: bigint; readonly collateralDiff: bigint },
  held: { readonly left: bigint; readonly right: bigint },
): Result<{ readonly left: bigint; readonly right: bigint }, AccountError> => {
  const left = diff.leftDiff < 0n ? -diff.leftDiff : 0n;
  const right = diff.rightDiff < 0n ? -diff.rightDiff : 0n;
  const leftRoom = outCapacity(d, true, held.left);
  const rightRoom = outCapacity(d, false, held.right);
  if (!(diff.leftDiff < 0n && diff.collateralDiff > 0n) && left > leftRoom) return err({ _tag: "insufficient_capacity", available: leftRoom, requested: left });
  if (!(diff.rightDiff < 0n && diff.collateralDiff > 0n) && right > rightRoom) return err({ _tag: "insufficient_capacity", available: rightRoom, requested: right });
  return ok({ left, right });
};
/** Left pays negative, right pays positive. Zero stays zero. A negative amount is refused. */
export const offdeltaChange = (payerIsLeft: boolean, amount: bigint): Result<bigint, AccountError> =>
  amount < 0n ? err({ _tag: "negative_transfer" }) : ok(payerIsLeft ? -amount : amount);
/** Unchecked move: releases of prior holds (htlc resolve, swap give). */
export const shift = (d: Delta, by: bigint): Delta => ({ ...d, offdelta: d.offdelta + by });
/** Checked move: `offdeltaChange` picks the sign; holds reduce room. */
export const move = (d: Delta, by: bigint, held: bigint): Result<Delta, AccountError> => {
  if (by === 0n) return ok(d);
  const payerIsLeft = by < 0n, amount = payerIsLeft ? -by : by, available = outCapacity(d, payerIsLeft, held);
  if (amount > MAX_PAYMENT_AMOUNT) return err({ _tag: "payment_too_large" });
  return amount > available ? err({ _tag: "insufficient_capacity", available, requested: amount }) : ok(shift(d, by));
};
export const settle = (d: Delta, collateral: bigint, ondelta: bigint): Delta => ({ ...d, collateral, ondelta });
export const setCreditLimit = (d: Delta, limit: bigint, byLeft: boolean): Result<Delta, AccountError> =>
  limit < 0n ? err({ _tag: "negative_credit_limit" }) : limit > MAX_CREDIT_LIMIT ? err({ _tag: "credit_limit_too_large" }) : ok(other(byLeft) ? { ...d, leftCreditLimit: limit } : { ...d, rightCreditLimit: limit });
export const addCollateral = (d: Delta, amount: bigint): Result<Delta, AccountError> => (amount < 0n ? err({ _tag: "negative_collateral" }) : ok(settle(d, d.collateral + amount, d.ondelta)));
export const applyCollateralFixture = (s: AccountState, tk: TokenId, amount: bigint): Result<AccountState, AccountError> => updateDelta(s, tk, (d) => addCollateral(d, amount));
const signableDelta = (d: Delta): Pick<Delta, "tokenId" | "offdelta" | "leftCreditLimit" | "rightCreditLimit"> => ({ tokenId: d.tokenId, offdelta: d.offdelta, leftCreditLimit: d.leftCreditLimit, rightCreditLimit: d.rightCreditLimit });
export const signableAccount = (s: AccountState): { readonly id: AccountId; readonly deltas: ReadonlyMap<TokenId, ReturnType<typeof signableDelta>> } => ({ id: s.id, deltas: new Map([...s.deltas].map(([k, d]) => [k, signableDelta(d)])) });
export const hashAccountState = (s: AccountState): Hash => keccakUtf8(canon(signableAccount(s)));


export type AccountTerms = { readonly domain: Domain; readonly watchSeed: string; readonly disputeConfig: DisputeConfig };
export type TermsError = Tagged<"bad_domain" | "bad_watch_seed" | "bad_dispute_config">;
const MAX_UINT32 = 0xffff_ffff, MAX_DISPUTE_SECONDS = 365 * 24 * 60 * 60;
export const disputeConfigOf = (config: unknown): Result<DisputeConfig, TermsError> => {
  if (typeof config !== "object" || config === null) return err({ _tag: "bad_dispute_config" });
  const { leftResponseSeconds: left, rightResponseSeconds: right } = config as { readonly [k: string]: unknown };
  const window = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 0 && n <= MAX_UINT32;
  return window(left) && window(right) && left + right <= MAX_DISPUTE_SECONDS ? ok({ leftResponseSeconds: left, rightResponseSeconds: right }) : err({ _tag: "bad_dispute_config" });
};
export const isWatchSeed = (seed: unknown): seed is string => typeof seed === "string" && WORD.test(seed);
export const accountTerms = (terms: AccountTerms): Result<AccountTerms, TermsError> =>
  chain(mapErr(domainOf(terms.domain), (): TermsError => ({ _tag: "bad_domain" })), (domain) => !isWatchSeed(terms.watchSeed) ? err({ _tag: "bad_watch_seed" })
    : map(disputeConfigOf(terms.disputeConfig), (disputeConfig) => ({ domain, watchSeed: terms.watchSeed.toLowerCase(), disputeConfig })));
export type Delivery = Tagged<"local"> | Tagged<"received", { from: EntityId }>;
export type AccountEnvelope = { readonly fromEntityId: EntityId; readonly toEntityId: EntityId; readonly domain: Domain; readonly disputeConfig: DisputeConfig; readonly watchSeed?: string | undefined };
export type EnvelopeError = Tagged<"domain_invalid" | "dispute_config_invalid" | "dispute_config_mismatch" | "party_mismatch" | "domain_mismatch" | "watch_seed_invalid" | "watch_seed_mismatch">;
export const envelopeOf = (terms: AccountTerms, party: Party): AccountEnvelope => ({ fromEntityId: party.self, toEntityId: party.peer, domain: terms.domain, disputeConfig: terms.disputeConfig, watchSeed: terms.watchSeed });
export const namesEntity = (v: unknown, entity: EntityId): boolean => typeof v === "string" && sameHex(v, entity);
type Check = Result<void, EnvelopeError>;
const PARTY_MISMATCH: Check = err({ _tag: "party_mismatch" });
export const deliveredBy = (e: AccountEnvelope, self: EntityId, delivery: Delivery): Check => match(delivery, {
  local: (): Check => (namesEntity(e.fromEntityId, self) ? ok(undefined) : PARTY_MISMATCH),
  received: ({ from }): Check => (namesEntity(e.fromEntityId, from) && !namesEntity(e.fromEntityId, self) && namesEntity(e.toEntityId, self) ? ok(undefined) : PARTY_MISMATCH),
});
export const localOnly = (delivery: Delivery): Check => match(delivery, { local: (): Check => ok(undefined), received: (): Check => PARTY_MISMATCH });
export const checkEnvelope = (id: AccountId, terms: AccountTerms, e: AccountEnvelope): Result<EntityId, EnvelopeError> => {
  const d = e.domain as unknown;
  if (typeof d !== "object" || d === null || !Number.isSafeInteger((d as { chainId?: unknown }).chainId) || typeof (d as { depositoryAddress?: unknown }).depositoryAddress !== "string") return err({ _tag: "domain_invalid" });
  const config = disputeConfigOf(e.disputeConfig);
  if (!config.ok) return err({ _tag: "dispute_config_invalid" });
  const held = terms.disputeConfig;
  if (config.value.leftResponseSeconds !== held.leftResponseSeconds || config.value.rightResponseSeconds !== held.rightResponseSeconds) return err({ _tag: "dispute_config_mismatch" });
  const leftToRight = namesEntity(e.fromEntityId, id.left) && namesEntity(e.toEntityId, id.right), rightToLeft = namesEntity(e.fromEntityId, id.right) && namesEntity(e.toEntityId, id.left);
  if (!leftToRight && !rightToLeft) return err({ _tag: "party_mismatch" });
  if (e.domain.chainId !== terms.domain.chainId || !sameHex(e.domain.depositoryAddress, terms.domain.depositoryAddress)) return err({ _tag: "domain_mismatch" });
  if (e.watchSeed !== undefined) { if (!isWatchSeed(e.watchSeed)) return err({ _tag: "watch_seed_invalid" }); if (!sameHex(e.watchSeed, terms.watchSeed)) return err({ _tag: "watch_seed_mismatch" }); }
  return ok(leftToRight ? id.left : id.right);
};


export type ClaimError = Tagged<"claim_height" | "claim_events" | "claim_block" | "claim_entity" | "claim_conflict" | "claim_proof">;
/** og SettlementHankoNonceRejection: `account` = the derived minimum safe nonce, `workspace` = the nonce pinned at first signature. */
export type SettlementNonceMismatch = { readonly supplied: number; readonly required: number; readonly basis: "account" | "workspace" };
export type BodyError =
  | AccountError | RatioError | Uncommitted | ClaimError
  | Tagged<"settlement_frozen" | "settled_pair" | "settled_nonce" | "lock_id" | "htlc_envelope" | "htlc_expired" | "htlc_lock_capacity" | "hold_overflow" | "offdelta_range" | "duplicate" | "missing" | "not_maker" | "before_deadline" | "preimage" | "not_counterparty" | "index" | "too_many_rows">
  | Tagged<"token_id", { tokenId: string }>
  | Tagged<"settlement", { reason: string; nonce?: SettlementNonceMismatch | undefined }>
  | Tagged<"swap", { reason: string }>
  | Tagged<"rebalance", { reason: string }>
  | Tagged<"lending", { reason: string }>
  | Tagged<"payment_route", { reason: string }>
  | CrossError
  | Tagged<"unchosen", { hole: Hole }>;
/** `settlement` is the replica's settlement authority: its Hanko verifier and the dispute-proof nonce floor (max of nextProofNonce, current+1, counterparty+1). og passes both through AccountConsensusContext. */
export type SettlementCtx = { readonly verify: Verify; readonly proofNonceFloor: number };
export type FoldCtx = { readonly byLeft: boolean; readonly nowMs: bigint; readonly jHeight: bigint; readonly accountHeight: bigint; readonly settlement?: SettlementCtx | undefined };
/**
 * Account outputs to the parent Entity (og apply-result outcomes and AccountOutput candidate effects), perspective-free:
 * the consumer adds its own side (og fills entityId/accountId from proofHeader, and only the gateway forwards a trusted payment).
 */
export type Effect =
  | Tagged<"forward_secret", { hashlock: string; secret: string }>
  | Tagged<"htlc_error", { lockId: string; hashlock: string; tokenId: number; amount: bigint; reason?: string }>
  | Tagged<"swap_cancel_requested", { offerId: string }>
  | Tagged<"swap_cancelled", { offerId: string; makerId: string }>
  | Tagged<"request_collateral_committed", { tokenId: number; requestedAmount: bigint; prepaidFee: bigint; requestedAt: number }>
  | Tagged<"direct_payment_forward", { tokenId: number; amount: bigint; route: readonly string[]; description?: string; trustedGatewayEntityId: string }>;
const MAX_ROWS = 128;
export type HtlcLock = { readonly lockId: string; readonly hashlock: string; readonly timelock: bigint; readonly revealBeforeHeight: bigint; readonly amount: bigint; readonly tokenId: TokenId; readonly senderIsLeft: boolean; readonly createdHeight: bigint; readonly createdTimestamp: bigint; readonly envelopeHash?: string | undefined };
/** og protocol/htlc/multi-recipient.ts OpaqueHtlcCiphertext: exactly {version, ciphertext}, canonical padded base64 of ephemeralKey(32) || AES-GCM body || tag(16). */
export type HtlcEnvelope = { readonly version: "xln:htlc-opaque:aes-gcm"; readonly ciphertext: string };
const HTLC_ENVELOPE_VERSION = "xln:htlc-opaque:aes-gcm";
const MAX_HTLC_BINARY_LAYER_BYTES = Math.floor(((100_000_000 - 1_000_000) * 3) / 4);
const MAX_HTLC_PACKED_BYTES = 32 + MAX_HTLC_BINARY_LAYER_BYTES + 16;
const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
/** og serialization/base64.ts decodeBase64Bytes: padded RFC 4648 only; any non-canonical spelling is refused. */
export const decodeBase64 = (text: string): Uint8Array | null => {
  if (text.length % 4 !== 0 || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(text)) return null;
  const out: number[] = [];
  let acc = 0, bits = 0;
  for (const ch of text.replace(/=+$/, "")) {
    acc = ((acc << 6) | B64.indexOf(ch)) & 0xffff; bits += 6;
    if (bits >= 8) { bits -= 8; out.push((acc >> bits) & 0xff); }
  }
  const bytes = Uint8Array.from(out);
  return encodeBase64(bytes) === text ? bytes : null;
};
export const encodeBase64 = (bytes: Uint8Array): string => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i] ?? 0, b = bytes[i + 1], c = bytes[i + 2], n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0);
    s += (B64[(n >> 18) & 63] ?? "") + (B64[(n >> 12) & 63] ?? "") + (b === undefined ? "=" : B64[(n >> 6) & 63] ?? "") + (c === undefined ? "=" : B64[n & 63] ?? "");
  }
  return s;
};
/** og assertOpaqueHtlcCiphertext + hashOpaqueHtlcCiphertext: the committed envelopeHash is sha256 of the decoded packed bytes. */
export const htlcEnvelopeHash = (v: unknown): string | null => {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const rec = v as Record<string, unknown>, keys = Object.keys(rec), ct = rec["ciphertext"];
  if (keys.length !== 2 || !keys.includes("ciphertext") || !keys.includes("version") || rec["version"] !== HTLC_ENVELOPE_VERSION || typeof ct !== "string" || ct.length === 0 || ct.length > Math.ceil(MAX_HTLC_PACKED_BYTES / 3) * 4) return null;
  const packed = decodeBase64(ct);
  return packed === null || packed.length < 48 || packed.length > MAX_HTLC_PACKED_BYTES ? null : bytesToHex(sha256(packed));
};
/** og types/account.ts SwapOffer (same-jurisdiction): quantized amounts, canonical price and the maker's signed fee authority. */
export type SwapOffer = {
  readonly offerId: string; readonly giveTokenId: TokenId; readonly giveTokenDecimals: number; readonly giveAmount: bigint; readonly wantTokenId: TokenId; readonly wantTokenDecimals: number; readonly wantAmount: bigint;
  readonly maxFee: bigint; readonly minNetReceive: bigint; readonly priceTicks: bigint; readonly timeInForce?: number | undefined; readonly makerIsLeft: boolean; readonly createdHeight: number; readonly quantizedGive: bigint; readonly quantizedWant: bigint; readonly crossJurisdiction?: CrossRoute | undefined;
};
/** og types/account.ts PullCommitment: a cross-j pull's committed row; its |amount| is held on the loser (payer) side until cross_pull_close. */
export type PullRow = {
  readonly pullId: string; readonly tokenId: number; readonly amount: bigint; readonly claimedRatio: number; readonly claimedAmount: bigint; readonly fullHash: string; readonly partialRoot: string;
  readonly crossJurisdiction: CrossPullBinding; readonly createdHeight: number; readonly createdTimestamp: number;
};
/** og AccountTx swap_offer data (same-jurisdiction). */
export type SwapOfferTerms = {
  readonly offerId: string; readonly giveTokenId: TokenId; readonly giveTokenDecimals: number; readonly giveAmount: bigint; readonly wantTokenId: TokenId; readonly wantTokenDecimals: number; readonly wantAmount: bigint;
  readonly maxFee: bigint; readonly minNetReceive: bigint; readonly priceTicks?: bigint | undefined; readonly timeInForce?: number | undefined; readonly crossJurisdiction?: CrossRoute | undefined;
};
/** og AccountTx swap_resolve data. */
export type SwapResolveTerms = {
  readonly offerId: string; readonly fillRatio: number; readonly cancelRemainder: boolean; readonly fillNumerator?: bigint | undefined; readonly fillDenominator?: bigint | undefined;
  readonly feeTokenId?: TokenId | undefined; readonly feeAmount?: bigint | undefined; readonly executionGiveAmount?: bigint | undefined; readonly executionWantAmount?: bigint | undefined;
  readonly restingPriceTicks?: bigint | undefined; readonly restingGiveAmount?: bigint | undefined; readonly restingWantAmount?: bigint | undefined; readonly restingQuantizedGive?: bigint | undefined; readonly restingQuantizedWant?: bigint | undefined;
};
/** og types/finance/rebalance.ts: one side's committed fee terms, the bilateral register, and a prepaid request_collateral's fee state. */
export type RebalanceFeeSnapshot = { readonly policyVersion: number; readonly baseFee: bigint; readonly liquidityFeeBps: bigint; readonly gasFee: bigint; readonly updatedAt: number };
export type BilateralFeePolicy = { readonly left?: RebalanceFeeSnapshot; readonly right?: RebalanceFeeSnapshot };
/** og types/account.ts AccountLendingIntentKind: the committed replay guard of each Account-level lending intent. */
export type LendingIntentKind = "fund" | "borrow" | "repay" | "credit-grant" | "credit-revoke" | "close-request" | "close-payout";
export type RefundReason = "policy_mismatch" | "timeout" | "fee_too_low" | "manual";
export type RebalanceRequestFeeState = {
  readonly requestId: string; readonly feeTokenId: number; readonly feePaidUpfront: bigint; readonly requestedAmount: bigint; readonly policyVersion: number; readonly requestedAt: number; readonly requestedByLeft: boolean;
  readonly refund?: { readonly reason: RefundReason; readonly refundedAmount: bigint };
};
/** og types/finance/account-j-claims.ts AccountJClaimRecord / AccountJClaimNode / AccountJClaimProof (root-to-terminal-leaf path; empty for the EMPTY root). */
export type JClaimRecord = { readonly version: 1; readonly accountKey: string; readonly side: "left" | "right"; readonly jHeight: number; readonly jBlockHash: string; readonly eventsHash: string };
export type JClaimNode = { readonly version: 1; readonly type: "leaf"; readonly key: string; readonly record: JClaimRecord } | { readonly version: 1; readonly type: "branch"; readonly bit: number; readonly left: string; readonly right: string };
export type JClaimProof = { readonly version: 1; readonly nodes: readonly JClaimNode[] };
export type ClaimRow = { readonly onLeft: boolean; readonly jHeight: bigint; readonly jBlockHash: string; readonly eventsHash: string };
/** og types/account.ts SettlementOp / SettlementWorkspace, field for field: the workspace (minus Hankos) is committed in the Account root. */
export type SettlementOp =
  | { readonly type: "r2c" | "c2r" | "r2r"; readonly tokenId: number; readonly amount: bigint }
  | { readonly type: "forgive"; readonly tokenId: number }
  | { readonly type: "rawDiff"; readonly tokenId: number; readonly leftDiff: bigint; readonly rightDiff: bigint; readonly collateralDiff: bigint; readonly ondeltaDiff: bigint };
export type WorkspaceDiff = { readonly tokenId: number; readonly leftDiff: bigint; readonly rightDiff: bigint; readonly collateralDiff: bigint; readonly ondeltaDiff: bigint };
export type PostSettlementProof = { readonly leftHanko?: string | undefined; readonly rightHanko?: string | undefined; readonly disputeHash: string; readonly proofBodyHash: string; readonly nonce: number; readonly proposerIsLeft: boolean };
export type SettlementWorkspace = {
  readonly workspaceHash: string; readonly ops: readonly SettlementOp[]; readonly compiledDiffs?: readonly WorkspaceDiff[] | undefined; readonly compiledForgiveTokenIds?: readonly number[] | undefined;
  readonly leftHanko?: string | undefined; readonly rightHanko?: string | undefined; readonly settlementHash?: string | undefined; readonly lastModifiedByLeft: boolean;
  readonly status: "draft" | "awaiting_counterparty" | "ready_to_submit" | "submitted"; readonly memo?: string | undefined; readonly revision: number; readonly createdAt: number; readonly lastUpdatedAt: number;
  readonly executorIsLeft: boolean; readonly nonceAtSign?: number | undefined; readonly postSettlementDisputeProof?: PostSettlementProof | undefined;
};
export type AccountBody = {
  readonly account: AccountState; readonly terms: AccountTerms; readonly locks: ReadonlyMap<string, HtlcLock>; readonly offers: ReadonlyMap<string, SwapOffer>;
  readonly requested: ReadonlyMap<TokenId, bigint>; readonly requestFees: ReadonlyMap<TokenId, RebalanceRequestFeeState>; readonly feePolicies: ReadonlyMap<TokenId, BilateralFeePolicy>;
  readonly lendingIntents: ReadonlyMap<string, LendingIntentKind>; readonly claimRows?: readonly ClaimRow[] | undefined; readonly finalizedJHeight: bigint; readonly jNonce: number;
  readonly settlement?: SettlementWorkspace | undefined; readonly pulls?: ReadonlyMap<string, PullRow> | undefined;
  /** og replica shadow.rebalance.submittedAtByToken: local J-batch submission marker per token; outside the Account state root, committed in the Entity's account leaf. */
  readonly submittedAt?: ReadonlyMap<number, number> | undefined;
};
/** og envelope/entity-update.ts setRebalanceSubmittedAt: set, or (undefined) clear, one token's submission marker. */
export const setRebalanceSubmittedAt = (a: AccountBody, tokenId: number, submittedAt: number | undefined): AccountBody =>
  ({ ...a, submittedAt: submittedAt === undefined ? mapDelete(a.submittedAt ?? new Map<number, number>(), tokenId) : mapSet(a.submittedAt ?? new Map<number, number>(), tokenId, submittedAt) });
const clearSubmittedAt = (a: AccountBody, tk: TokenId): AccountBody => (a.submittedAt?.has(Number(tk)) ? { ...a, submittedAt: mapDelete(a.submittedAt, Number(tk)) } : a);
/** og state-root.ts submittedAtByTokenRoot: the shadow map's root, as the Entity account leaf commits it. */
export const submittedAtRoot = (a: AccountBody): Result<string, CommitmentError> => mapRoot(a.submittedAt ?? new Map<number, number>());
export type AccountStep<E extends Effect = Effect> = Step<AccountBody, E>;
type BodyStep<E extends Effect = never> = Result<AccountStep<E>, BodyError>;
export type AccountTx =
  | { readonly type: "add_delta"; readonly tokenId: TokenId }
  | { readonly type: "set_credit_limit"; readonly tokenId: TokenId; readonly limit: bigint }
  | { readonly type: "payment"; readonly tokenId: TokenId; readonly amount: bigint; readonly route?: readonly string[] | undefined; readonly description?: string | undefined; readonly fromEntityId?: string | undefined; readonly toEntityId?: string | undefined; readonly deliveryMode?: "direct" | "trusted" | undefined; readonly trustedGatewayEntityId?: string | undefined }
  | { readonly type: "htlc_lock"; readonly lockId: string; readonly hashlock: string; readonly timelock: bigint; readonly revealBeforeHeight: bigint; readonly amount: bigint; readonly tokenId: TokenId; readonly deliveryMode?: "instant" | "async" | undefined; readonly envelope?: HtlcEnvelope | undefined }
  | { readonly type: "htlc_resolve"; readonly lockId: string; readonly outcome: "secret"; readonly secret: string }
  | { readonly type: "htlc_resolve"; readonly lockId: string; readonly outcome: "error"; readonly reason?: string | undefined }
  | ({ readonly type: "swap_offer" } & SwapOfferTerms)
  | { readonly type: "swap_cancel_request"; readonly offerId: string }
  | ({ readonly type: "swap_resolve" } & SwapResolveTerms)
  | { readonly type: "request_collateral"; readonly tokenId: TokenId; readonly amount: bigint; readonly feeTokenId?: TokenId | undefined; readonly feeAmount: bigint; readonly policyVersion: number }
  | { readonly type: "rebalance_refund"; readonly requestId: string; readonly requestTokenId: TokenId; readonly amount: bigint; readonly reason: RefundReason }
  | { readonly type: "rebalance_policy"; readonly tokenId: TokenId; readonly policyVersion: number; readonly baseFee: bigint; readonly liquidityFeeBps: bigint; readonly gasFee: bigint }
  | { readonly type: "lending_fund"; readonly positionId: string; readonly hubEntityId: string; readonly lenderEntityId: string; readonly tokenId: TokenId; readonly amount: bigint; readonly termId: string; readonly interestBps: number }
  | { readonly type: "lending_borrow_request"; readonly requestId: string; readonly hubEntityId: string; readonly borrowerEntityId: string; readonly tokenId: TokenId; readonly amount: bigint; readonly termId: string; readonly maxInterestBps: number }
  | { readonly type: "lending_repay"; readonly loanId: string; readonly hubEntityId: string; readonly borrowerEntityId: string; readonly tokenId: TokenId; readonly amount: bigint }
  | { readonly type: "lending_credit"; readonly action: "grant" | "revoke"; readonly loanId: string; readonly hubEntityId: string; readonly borrowerEntityId: string; readonly tokenId: TokenId; readonly creditLimit: bigint }
  | { readonly type: "lending_close_request"; readonly positionId: string; readonly hubEntityId: string; readonly lenderEntityId: string }
  | { readonly type: "lending_close_payout"; readonly positionId: string; readonly hubEntityId: string; readonly lenderEntityId: string; readonly tokenId: TokenId; readonly amount: bigint }
  | { readonly type: "cross_pull_lock"; readonly pullId: string; readonly tokenId: TokenId; readonly amount: bigint; readonly fullHash: string; readonly partialRoot: string; readonly crossJurisdiction: CrossPullBinding; readonly crossJurisdictionRoute: CrossRoute }
  | { readonly type: "cross_pull_close"; readonly pullId: string; readonly binary: string; readonly proof: CrossCloseProof }
  | { readonly type: "j_event_claim"; readonly jHeight: bigint; readonly jBlockHash: Hash; readonly events: readonly AccountSettlement[]; readonly observedAt: bigint; readonly leftProof?: JClaimProof | undefined; readonly rightProof?: JClaimProof | undefined }
  | { readonly type: "settle_transition"; readonly kind: "upsert"; readonly revision: number; readonly previousWorkspaceHash?: string | undefined; readonly ops: readonly SettlementOp[]; readonly executorIsLeft: boolean; readonly memo?: string | undefined }
  | { readonly type: "settle_transition"; readonly kind: "submit" | "clear"; readonly revision: number; readonly workspaceHash: string }
  | { readonly type: "settle_transition"; readonly kind: "hanko"; readonly revision: number; readonly workspaceHash: string; readonly settlementNonce: number; readonly settlementHash: string; readonly settlementHanko?: string | undefined; readonly postProof: { readonly nonce: number; readonly proposerIsLeft: boolean; readonly proofBodyHash: string; readonly disputeHash: string; readonly hanko?: string | undefined } };
export type TxOf<K extends AccountTx["type"]> = Extract<AccountTx, { readonly type: K }>;
export type WireAccountTx = AccountTx;
type WireTxOf<K extends AccountTx["type"]> = Extract<WireAccountTx, { readonly type: K }>;
const OG_TOKEN_FIELDS = ["tokenId", "giveTokenId", "wantTokenId", "feeTokenId", "requestTokenId"] as const;
/** og wire AccountTx fields: token ids (and htlc revealBeforeHeight) are JS numbers, never the rewrite's decimal strings. */
export const wireOf = (tx: WireAccountTx): { readonly type: string } => {
  const out: Record<string, unknown> = { ...tx };
  for (const k of OG_TOKEN_FIELDS) if (typeof out[k] === "string") out[k] = Number(out[k]);
  if (tx.type === "htlc_lock") out["revealBeforeHeight"] = Number(tx.revealBeforeHeight);
  return out as { readonly type: string };
};
type Author = "bilateral" | "unchosen";
export type KindRow = { readonly author: Author; readonly l0: boolean; readonly repeatable: boolean; readonly effects: readonly Effect["_tag"][] };
const kind = <R extends KindRow>(author: Author, l0: boolean, repeatable: boolean, effects: readonly Effect["_tag"][] = []): R => ({ author, l0, repeatable, effects }) as R;
export const AccountKinds = {
  add_delta: kind("bilateral", true, false), set_credit_limit: kind("bilateral", true, false), payment: kind("bilateral", true, true, ["direct_payment_forward"]),
  htlc_lock: kind("bilateral", false, false), htlc_resolve: kind("bilateral", false, false, ["forward_secret", "htlc_error"]),
  swap_offer: kind("bilateral", false, false), swap_cancel_request: kind("bilateral", false, false, ["swap_cancel_requested"]), swap_resolve: kind("bilateral", false, false, ["swap_cancelled"]),
  settle_transition: kind("bilateral", false, false),
  request_collateral: kind("bilateral", false, false, ["request_collateral_committed"]), rebalance_refund: kind("bilateral", false, false), rebalance_policy: kind("bilateral", false, false),
  lending_fund: kind("bilateral", false, false), lending_borrow_request: kind("bilateral", false, false), lending_repay: kind("bilateral", false, false), lending_credit: kind("bilateral", false, false),
  lending_close_request: kind("bilateral", false, false), lending_close_payout: kind("bilateral", false, false),
  cross_pull_lock: kind("bilateral", false, false), cross_pull_close: kind("bilateral", false, false),
  j_event_claim: kind("bilateral", false, false),
} as const satisfies Kinds<AccountTx["type"], KindRow>;
export type L0Tx = TxOf<"add_delta" | "set_credit_limit" | "payment">;
export type EffectOf<K extends AccountTx["type"]> = K extends "htlc_resolve" ? Of<Effect, "forward_secret" | "htlc_error"> : K extends "swap_cancel_request" ? Of<Effect, "swap_cancel_requested">
  : K extends "swap_resolve" ? Of<Effect, "swap_cancelled"> : K extends "request_collateral" ? Of<Effect, "request_collateral_committed"> : K extends "payment" ? Of<Effect, "direct_payment_forward"> : never;
export const isL0Tx = (tx: WireAccountTx): tx is L0Tx => arm(AccountKinds, tx.type).l0;
export const genesisAccountBody = (account: AccountState, terms: AccountTerms): AccountBody => ({ account, terms, locks: new Map(), offers: new Map(), requested: new Map(), requestFees: new Map(), feePolicies: new Map(), lendingIntents: new Map(), finalizedJHeight: 0n, jNonce: 0 });
const putState = (a: AccountBody, account: AccountState): AccountBody => ({ ...a, account });
export const holds = (a: AccountBody, tk: TokenId, byLeft: boolean): bigint => { const s = sideTotals(a, tk); return at(s.leftHold + s.leftAllowance, s.rightHold + s.rightAllowance, byLeft); };
const ensureRoom = (a: AccountBody, tk: TokenId, amount: bigint, byLeft: boolean): Result<void, BodyError> => {
  const available = outCapacity(getDelta(a.account, tk), byLeft, holds(a, tk, byLeft));
  return amount > available ? err({ _tag: "insufficient_capacity", available, requested: amount }) : ok(undefined);
};
const positive = (amount: bigint): Result<void, BodyError> => guard(amount > 0n, { _tag: "non_positive_payment" });
const spend = (a: AccountBody, tk: TokenId, amount: bigint, byLeft: boolean): Result<AccountBody, BodyError> =>
  chain(positive(amount), () => chain(offdeltaChange(byLeft, amount), (by) => chain(move(getDelta(a.account, tk), by, holds(a, tk, byLeft)), (d) => map(representable(a, d), () => putState(a, setDelta(a.account, d))))));
/** og protocol/htlc/utils.ts:73: keccak256 of the 32-byte secret (abi.encode(bytes32)); anything else is not a secret. */
export const hashHtlcSecret = (secret: string): string | null => (/^0x[0-9a-fA-F]{64}$/.test(secret) ? keccak256Hex(hexToBytes(secret)) : null);
/** og htlc-deadline.ts: expired once jHeight passes revealBeforeHeight or the timestamp reaches timelock. */
export const htlcExpired = (l: Pick<HtlcLock, "timelock" | "revealBeforeHeight">, ctx: Pick<FoldCtx, "nowMs" | "jHeight">): boolean => ctx.jHeight > l.revealBeforeHeight || ctx.nowMs >= l.timelock;
export const MAX_ACCOUNT_HTLC_LOCKS = 32;
/** og delta-utils.ts getOffdeltaRepresentationError: offdelta plus every live lock movement, each alone, stays in int512. */
const representable = (a: AccountBody, d: Delta, added?: { readonly senderIsLeft: boolean; readonly amount: bigint }): Result<void, BodyError> => {
  let lower = d.offdelta, upper = d.offdelta;
  const include = (senderIsLeft: boolean, amount: bigint): void => { if (senderIsLeft) lower -= amount; else upper += amount; };
  for (const l of a.locks.values()) if (l.tokenId === d.tokenId) include(l.senderIsLeft, l.amount);
  if (added !== undefined) include(added.senderIsLeft, added.amount);
  return guard(lower >= INT512_MIN && upper <= INT512_MAX, { _tag: "offdelta_range" });
};
const MISSING: Result<never, BodyError> = err({ _tag: "missing" });
const sameAccount = (row: AccountSettlement, id: AccountId): boolean => row.left === id.left && row.right === id.right;
const CLAIM_UINT64 = (1n << 64n) - 1n;
const claimHeight = (h: bigint): Result<bigint, ClaimError> => (h >= 1n && h <= CLAIM_UINT64 && h <= BigInt(Number.MAX_SAFE_INTEGER) ? ok(h) : err({ _tag: "claim_height" }));
const claimBlock = (h: string): Result<string, ClaimError> => (WORD.test(h) ? ok(h.toLowerCase()) : err({ _tag: "claim_block" }));
type SettledData = { readonly leftEntity: string; readonly rightEntity: string; readonly tokenId: number; readonly leftReserve: string; readonly rightReserve: string; readonly collateral: string; readonly ondelta: string; readonly nonce: number };
/** og JurisdictionEvent AccountSettled with normalizeMetadata's EVM position (hashes kept as given; the key lowercases them). */
type SettledEvent = { readonly blockNumber?: number; readonly blockHash?: string; readonly transactionHash?: string; readonly logIndex?: number; readonly eventIndex?: number; readonly type: "AccountSettled"; readonly data: SettledData };
const settledPayload = (d: SettledData): string => ["AccountSettled", d.leftEntity, d.rightEntity, d.tokenId, d.leftReserve, d.rightReserve, d.collateral, d.ondelta, d.nonce].join(":");
/** og event-normalization.ts canonicalJurisdictionEventKey. */
const settledKey = (e: SettledEvent): string => JSON.stringify([e.blockNumber ?? null, e.blockHash?.toLowerCase() ?? null, e.transactionHash?.toLowerCase() ?? null, e.logIndex ?? null, e.eventIndex ?? null, settledPayload(e.data)]);
const optIndex = (x: number | undefined, y: number | undefined): number => (x !== undefined && y !== undefined ? x - y : x !== undefined ? -1 : y !== undefined ? 1 : 0);
const stableText = (x: string, y: string): number => (x < y ? -1 : x > y ? 1 : 0);
/** og compareCanonicalJurisdictionEvents: EVM execution order first; the payload only orders synthetic ties. */
const compareSettled = (x: SettledEvent, y: SettledEvent): number =>
  optIndex(x.blockNumber, y.blockNumber) || optIndex(x.logIndex, y.logIndex) || optIndex(x.eventIndex, y.eventIndex) || stableText(x.transactionHash?.toLowerCase() ?? "", y.transactionHash?.toLowerCase() ?? "") || stableText(settledPayload(x.data), settledPayload(y.data));
/** og normalizeMetadata: integer block/log/event positions (log/event non-negative) and non-blank hashes. */
const settledMeta = (m: JEventMeta | undefined, eventIndex: number | undefined): Omit<SettledEvent, "type" | "data"> => ({
  ...(m?.blockNumber !== undefined && Number.isInteger(m.blockNumber) ? { blockNumber: m.blockNumber } : {}),
  ...(typeof m?.blockHash === "string" && m.blockHash.trim() !== "" ? { blockHash: m.blockHash } : {}),
  ...(typeof m?.transactionHash === "string" && m.transactionHash.trim() !== "" ? { transactionHash: m.transactionHash } : {}),
  ...(m?.logIndex !== undefined && Number.isInteger(m.logIndex) && m.logIndex >= 0 ? { logIndex: m.logIndex } : {}),
  ...(eventIndex !== undefined && Number.isInteger(eventIndex) && eventIndex >= 0 ? { eventIndex } : {}),
});
const settledEvent = (row: AccountSettlement, token: TokenSettlement): Result<SettledEvent, ClaimError> => {
  if (row.nonce < 0n || row.nonce > BigInt(Number.MAX_SAFE_INTEGER)) return err({ _tag: "claim_events" });
  const data = { leftEntity: row.left.toLowerCase(), rightEntity: row.right.toLowerCase(), tokenId: Number(token.tokenId), leftReserve: token.leftReserve.toString(), rightReserve: token.rightReserve.toString(), collateral: token.collateral.toString(), ondelta: token.ondelta.toString(), nonce: Number(row.nonce) };
  return ok({ ...settledMeta(row.meta, token.eventIndex), type: "AccountSettled", data });
};
/** og j-claim-transition.ts canonicalEvents + canonicalJurisdictionEventsHash: sorted, duplicate-free, keccak of the key list. */
const claimEvidence = (events: readonly AccountSettlement[]): Result<{ readonly eventsHash: string; readonly events: readonly SettledEvent[] }, ClaimError> => {
  const rows = events.flatMap((row) => row.tokens.map((token) => ({ row, token })));
  if (rows.length === 0) return err({ _tag: "claim_events" });
  return chain(traverse(rows, ({ row, token }) => settledEvent(row, token)), (built) => {
    const sorted = [...built].sort(compareSettled), keys = sorted.map(settledKey);
    return new Set(keys).size !== keys.length ? err({ _tag: "claim_events" }) : ok({ eventsHash: keccak256Hex(utf8(JSON.stringify(keys))), events: sorted });
  });
};
const claimFrame = (tx: TxOf<"j_event_claim">): Result<{ readonly version: "xln:account-j-event-claim-frame:v1"; readonly jHeight: number; readonly jBlockHash: string; readonly eventsHash: string; readonly events: readonly SettledEvent[] }, ClaimError> =>
  chain(claimHeight(tx.jHeight), (jHeight) => chain(claimBlock(tx.jBlockHash), (jBlockHash) => map(claimEvidence(tx.events), ({ eventsHash, events }) => ({ version: "xln:account-j-event-claim-frame:v1", jHeight: Number(jHeight), jBlockHash, eventsHash, events }))));
const claimRowOf = (tx: TxOf<"j_event_claim">, onLeft: boolean): Result<ClaimRow, ClaimError> =>
  chain(claimHeight(tx.jHeight), (jHeight) => chain(claimBlock(tx.jBlockHash), (jBlockHash) => map(claimEvidence(tx.events), ({ eventsHash }) => ({ onLeft, jHeight, jBlockHash, eventsHash }))));
/** og types/account.ts HtlcLock as committed: numeric token/height/timestamp fields, and envelopeHash only when the lock carried an encrypted envelope. */
const ogLockRow = (l: HtlcLock): Record<string, unknown> => {
  const { envelopeHash, ...rest } = l;
  return { ...rest, revealBeforeHeight: Number(l.revealBeforeHeight), tokenId: Number(l.tokenId), createdHeight: Number(l.createdHeight), createdTimestamp: Number(l.createdTimestamp), ...(envelopeHash === undefined ? {} : { envelopeHash }) };
};
const sameEvidence = (x: ClaimRow, y: ClaimRow): boolean => x.jBlockHash === y.jBlockHash && x.eventsHash === y.eventsHash;
const pruneThrough = (rows: readonly ClaimRow[], height: bigint): readonly ClaimRow[] | undefined => { const kept = rows.filter((r) => r.jHeight > height); return kept.length === 0 ? undefined : kept; };
/** og j-events/finality.ts: every AccountSettled names this pair, nonces never regress below jNonce, and each token row takes the chain's collateral/ondelta. */
const finalizeSettled = (a: AccountBody, events: readonly SettledEvent[]): Result<AccountBody, BodyError> => {
  const left = a.account.id.left.toLowerCase(), right = a.account.id.right.toLowerCase();
  return chain(foldResult(events, a.jNonce, (prev, e): Result<number, BodyError> =>
    e.data.leftEntity !== left || e.data.rightEntity !== right ? err({ _tag: "settled_pair" }) : e.data.nonce < prev ? err({ _tag: "settled_nonce" }) : ok(e.data.nonce)), (jNonce) =>
    chain(foldResult(events, a, (b, e): Result<AccountBody, BodyError> => chain(mapErr(tokenId(String(e.data.tokenId)), (): BodyError => ({ _tag: "index" })), (tk) => {
      const fresh = !b.account.deltas.has(tk);
      if (fresh && (e.data.tokenId === 0 || b.account.deltas.size + 1 > MAX_ROWS)) return err(e.data.tokenId === 0 ? { _tag: "index" } : { _tag: "too_many_rows" });
      const was = getDelta(b.account, tk), now = settle(was, BigInt(e.data.collateral), BigInt(e.data.ondelta)), increase = floor0(now.collateral - was.collateral);
      const settled = putState(b, setDelta(b.account, now)), requested = b.requested.get(tk) ?? 0n;
      if (requested <= 0n || increase <= 0n) return ok(settled);
      // og finality.ts: a collateral increase against a pending request also clears the shadow submission marker.
      return ok(clearSubmittedAt(requested > increase ? { ...settled, requested: mapSet(settled.requested, tk, requested - increase) } : { ...settled, requested: mapDelete(settled.requested, tk), requestFees: mapDelete(settled.requestFees, tk) }, tk));
    })), (b) => map(activateWorkspace(b, jNonce), (c) => ({ ...c, jNonce }))));
};
type ClaimCursor = { readonly claimRows?: readonly ClaimRow[] | undefined; readonly finalizedJHeight: bigint };
type ClaimStep = { readonly claimRows: readonly ClaimRow[] | undefined; readonly finalizedJHeight: bigint; readonly finalizes: boolean };
/** og j-claim-transition.ts applyAccountJClaimTransition on the pending rows: conflict on either side refuses; stale prunes; the first side waits; the peer's matching record at any pending height finalizes. */
const claimStep = (c: ClaimCursor, own: ClaimRow): Result<ClaimStep, ClaimError> => {
  const held = c.claimRows ?? [], peer: ClaimRow = { ...own, onLeft: !own.onLeft };
  const member = (r: ClaimRow): ClaimRow | undefined => held.find((h) => h.onLeft === r.onLeft && h.jHeight === r.jHeight);
  const ownHeld = member(own), peerHeld = member(peer);
  if ((ownHeld !== undefined && !sameEvidence(ownHeld, own)) || (peerHeld !== undefined && !sameEvidence(peerHeld, peer))) return err({ _tag: "claim_conflict" });
  if (own.jHeight <= c.finalizedJHeight) return ok({ claimRows: pruneThrough(held, c.finalizedJHeight), finalizedJHeight: c.finalizedJHeight, finalizes: false });
  if (peerHeld === undefined) return ok({ claimRows: ownHeld !== undefined ? c.claimRows : [...held, own], finalizedJHeight: c.finalizedJHeight, finalizes: false });
  return ok({ claimRows: pruneThrough(held, own.jHeight), finalizedJHeight: own.jHeight, finalizes: true });
};
const claimJ = (a: AccountBody, tx: TxOf<"j_event_claim">, ctx: FoldCtx): BodyStep => chain(claimRowOf(tx, ctx.byLeft), (own) => chain(claimStep(a, own), (s) => {
  if (!s.finalizes) return ok(step(s.claimRows === a.claimRows ? a : { ...a, claimRows: s.claimRows }));
  return chain(claimEvidence(tx.events), ({ events }) => map(finalizeSettled(a, events), (b) => step({ ...b, claimRows: s.claimRows, finalizedJHeight: s.finalizedJHeight })));
}));
const settleErr = (reason: string): Result<never, BodyError> => err({ _tag: "settlement", reason });
const settlementToken = (t: unknown): t is number => typeof t === "number" && Number.isSafeInteger(t) && t >= 0 && t <= 65_535;
const MAX_SETTLEMENT_DIFFS = 32;
type MutableDiff = { -readonly [K in keyof WorkspaceDiff]: WorkspaceDiff[K] };
/** og protocol/settlement/operations.ts compileOps: ops merge per token in first-seen order; every diff conserves and fits SignedAmount. */
export const compileOps = (ops: readonly SettlementOp[], proposerIsLeft: boolean): Result<{ readonly diffs: readonly WorkspaceDiff[]; readonly forgive: readonly number[] }, BodyError> => {
  const diffs = new Map<number, MutableDiff>(), forgive: number[] = [];
  for (const op of ops) {
    if (!settlementToken(op.tokenId)) return settleErr("SETTLEMENT_TOKEN_INVALID");
    if (op.type === "forgive") { if (forgive.includes(op.tokenId)) return settleErr("SETTLEMENT_DUPLICATE_FORGIVENESS_TOKEN"); forgive.push(op.tokenId); continue; }
    if (!["rawDiff", "r2c", "c2r", "r2r"].includes(op.type)) return settleErr("SETTLEMENT_UNKNOWN_OP_TYPE");
    const d = diffs.get(op.tokenId) ?? { tokenId: op.tokenId, leftDiff: 0n, rightDiff: 0n, collateralDiff: 0n, ondeltaDiff: 0n };
    diffs.set(op.tokenId, d);
    if (op.type === "rawDiff") { d.leftDiff += op.leftDiff; d.rightDiff += op.rightDiff; d.collateralDiff += op.collateralDiff; d.ondeltaDiff += op.ondeltaDiff; continue; }
    const n = op.amount;
    if (op.type === "r2c") { if (proposerIsLeft) { d.leftDiff -= n; d.collateralDiff += n; d.ondeltaDiff += n; } else { d.rightDiff -= n; d.collateralDiff += n; } }
    else if (op.type === "c2r") { d.collateralDiff -= n; if (proposerIsLeft) { d.leftDiff += n; d.ondeltaDiff -= n; } else d.rightDiff += n; }
    else if (proposerIsLeft) { d.leftDiff -= n; d.rightDiff += n; } else { d.rightDiff -= n; d.leftDiff += n; }
  }
  const out = [...diffs.values()];
  const wide = (v: bigint): boolean => v < -MAX_PAYMENT_AMOUNT || v > MAX_PAYMENT_AMOUNT;
  if (out.some((d) => wide(d.leftDiff) || wide(d.rightDiff) || wide(d.collateralDiff) || wide(d.ondeltaDiff))) return settleErr("SETTLEMENT_SIGNED_AMOUNT_RANGE");
  if (out.some((d) => d.leftDiff + d.rightDiff + d.collateralDiff !== 0n)) return settleErr("SETTLEMENT_INVARIANT_VIOLATION");
  if (out.length > MAX_SETTLEMENT_DIFFS) return settleErr("SETTLEMENT_DIFF_LIMIT_EXCEEDED");
  return forgive.length > MAX_SETTLEMENT_DIFFS ? settleErr("SETTLEMENT_FORGIVENESS_LIMIT_EXCEEDED") : ok({ diffs: out, forgive });
};
const checkOps = (ops: readonly SettlementOp[]): Result<void, BodyError> => {
  if (!Array.isArray(ops) || ops.length === 0) return settleErr("SETTLEMENT_WORKSPACE_OPS_EMPTY");
  for (const op of ops) {
    if (!settlementToken(op.tokenId)) return settleErr("SETTLEMENT_TOKEN_INVALID");
    if (op.type === "r2c" || op.type === "c2r" || op.type === "r2r") { if (typeof op.amount !== "bigint" || op.amount <= 0n) return settleErr("SETTLEMENT_WORKSPACE_AMOUNT_INVALID"); continue; }
    if (op.type === "rawDiff") { if ([op.leftDiff, op.rightDiff, op.collateralDiff, op.ondeltaDiff].some((v) => typeof v !== "bigint")) return settleErr("SETTLEMENT_WORKSPACE_RAW_DIFF_INVALID"); continue; }
    if (op.type !== "forgive") return settleErr("SETTLEMENT_WORKSPACE_OP_INVALID");
  }
  return ok(undefined);
};
const WORKSPACE_LEAF_KEY = keccak256(utf8("xln.settlement.workspace.body"));
/** og transition.ts createSettlementWorkspaceHash: the one-leaf keccak radix root of the canonical body under `xln.settlement.workspace.body`. */
export const workspaceHashOf = (id: AccountId, w: Pick<SettlementWorkspace, "revision" | "ops" | "lastModifiedByLeft" | "executorIsLeft" | "memo">): Result<string, BodyError> => map(
  mapErr(encodeCanonicalValue({ domain: "xln:settlement-workspace:v1", leftEntity: id.left.toLowerCase(), rightEntity: id.right.toLowerCase(), revision: w.revision, ops: w.ops, lastModifiedByLeft: w.lastModifiedByLeft, executorIsLeft: w.executorIsLeft, memo: w.memo }), (): BodyError => ({ _tag: "settlement", reason: "SETTLEMENT_WORKSPACE_ENCODING" })),
  (enc) => keccak256Hex(concat([LEAF, WORKSPACE_LEAF_KEY, enc])));
/** og witness-projection.ts: the committed workspace keeps every decision and target, never the Hanko bytes. */
export const workspaceWithoutHankos = (w: SettlementWorkspace | undefined): unknown => {
  if (w === undefined) return undefined;
  const { leftHanko: _l, rightHanko: _r, postSettlementDisputeProof: post, ...rest } = w;
  if (post === undefined) return rest;
  const { leftHanko: _pl, rightHanko: _pr, ...postRest } = post;
  return { ...rest, postSettlementDisputeProof: postRest };
};
const signedWorkspace = (w: SettlementWorkspace): boolean => w.settlementHash !== undefined || w.leftHanko !== undefined || w.rightHanko !== undefined || w.postSettlementDisputeProof !== undefined;
const workspaceDiffs = (w: SettlementWorkspace): readonly WorkspaceDiff[] => unwrapOr(map(compileOps(w.ops, w.lastModifiedByLeft), (c) => c.diffs), () => []);
/** og transition.ts:640 getSignedSettlementWorkspaceTxError: a signed workspace freezes the Account except j claims and settlement hanko/submit. */
const settlementFreeze = (a: AccountBody, tx: WireAccountTx): Result<void, BodyError> => {
  const w = a.settlement;
  if (w === undefined || !signedWorkspace(w) || tx.type === "j_event_claim" || (tx.type === "settle_transition" && (tx.kind === "hanko" || tx.kind === "submit"))) return ok(undefined);
  return err({ _tag: "settlement_frozen" });
};
/** og planWorkspaceHoldAdd: a negative side diff is a hold on an existing row, checked against capacity unless it funds collateral from reserve. */
const workspaceRoom = (a: AccountBody, diffs: readonly WorkspaceDiff[]): Result<void, BodyError> => foldResult(diffs, undefined as void, (_, diff): Result<void, BodyError> => {
  if (diff.leftDiff >= 0n && diff.rightDiff >= 0n) return ok(undefined);
  const tk = String(diff.tokenId) as TokenId, d = a.account.deltas.get(tk);
  if (d === undefined) return settleErr("SETTLEMENT_HOLD_DELTA_MISSING");
  const t = sideTotals(a, tk);
  return chain(chargeSettlement(d, diff, { left: holds(a, tk, true), right: holds(a, tk, false) }), (plan) =>
    t.leftHold + plan.left > MAX_PAYMENT_AMOUNT || t.rightHold + plan.right > MAX_PAYMENT_AMOUNT ? settleErr("HOLD_ADD_OVERFLOW") : ok(undefined));
});
const WORKSPACE_HASH = /^0x[0-9a-fA-F]{64}$/;
const currentWorkspace = (a: AccountBody, revision: number, hash: string): Result<SettlementWorkspace, BodyError> => {
  if (!Number.isSafeInteger(revision) || revision < 1) return settleErr("SETTLEMENT_WORKSPACE_VERSION_INVALID");
  const w = a.settlement;
  if (w === undefined) return settleErr("SETTLEMENT_WORKSPACE_MISSING");
  if (typeof hash !== "string" || !WORKSPACE_HASH.test(hash)) return settleErr("SETTLEMENT_WORKSPACE_TARGET_HASH_INVALID");
  if (w.revision !== revision) return settleErr("SETTLEMENT_WORKSPACE_VERSION_MISMATCH");
  return w.workspaceHash.toLowerCase() !== hash.toLowerCase() ? settleErr("SETTLEMENT_WORKSPACE_TARGET_HASH_MISMATCH") : ok(w);
};
const upsertWorkspace = (a: AccountBody, x: Extract<AccountTx, { type: "settle_transition"; kind: "upsert" }>, ctx: FoldCtx): BodyStep => {
  if (!Number.isSafeInteger(x.revision) || x.revision < 1) return settleErr("SETTLEMENT_WORKSPACE_VERSION_INVALID");
  return chain(checkOps(x.ops), () => typeof x.executorIsLeft !== "boolean" ? settleErr("SETTLEMENT_WORKSPACE_EXECUTOR_INVALID") : chain(compileOps(x.ops, ctx.byLeft), ({ diffs }) => {
    const cur = a.settlement, prev = x.previousWorkspaceHash;
    const linked: Result<void, BodyError> = x.revision === 1
      ? (cur !== undefined ? settleErr("SETTLEMENT_WORKSPACE_ALREADY_EXISTS") : prev !== undefined ? settleErr("SETTLEMENT_WORKSPACE_PREVIOUS_HASH_UNEXPECTED") : ok(undefined))
      : cur === undefined ? settleErr("SETTLEMENT_WORKSPACE_PREVIOUS_MISSING")
      : cur.leftHanko !== undefined || cur.rightHanko !== undefined ? settleErr("SETTLEMENT_WORKSPACE_SIGNED_UPDATE_FORBIDDEN")
      : cur.revision + 1 !== x.revision ? settleErr("SETTLEMENT_WORKSPACE_NON_CONTIGUOUS_VERSION")
      : prev === undefined || !WORKSPACE_HASH.test(prev) ? settleErr("SETTLEMENT_WORKSPACE_PREVIOUS_HASH_INVALID")
      : cur.workspaceHash.toLowerCase() !== prev.toLowerCase() ? settleErr("SETTLEMENT_WORKSPACE_PREVIOUS_HASH_MISMATCH") : ok(undefined);
    const now = Number(ctx.nowMs);
    const body = { ops: x.ops.map((op) => ({ ...op })), lastModifiedByLeft: ctx.byLeft, status: "awaiting_counterparty" as const, memo: x.memo, revision: x.revision, createdAt: cur?.createdAt ?? now, lastUpdatedAt: now, executorIsLeft: x.executorIsLeft };
    return chain(linked, () => chain(workspaceHashOf(a.account.id, body), (workspaceHash) => map(workspaceRoom({ ...a, settlement: undefined }, diffs), () => step({ ...a, settlement: { workspaceHash, ...body } }))));
  }));
};
/** og settlement-projection.ts: the post-settlement rows the dispute proof at nonce N+1 commits to. */
const projectedProofHash = (a: AccountBody, diffs: readonly WorkspaceDiff[], forgive: readonly number[]): Result<string, BodyError> =>
  chain(mapErr(committedView(a), uncommitted), (view) => {
    const rows = new Map(view.deltas);
    const row = (tokenId: number): Result<CommittedDelta, BodyError> => {
      const held = rows.get(tokenId);
      if (held !== undefined) return ok(held);
      if (tokenId === 0) return settleErr("TOKEN_ID_INVALID");
      if (rows.size + 1 > MAX_ROWS) return settleErr("ACCOUNT_DELTA_ROW_LIMIT_EXCEEDED");
      const fresh: CommittedDelta = { tokenId, collateral: 0n, ondelta: 0n, offdelta: 0n, leftCreditLimit: 0n, rightCreditLimit: 0n, leftAllowance: 0n, rightAllowance: 0n, leftHold: 0n, rightHold: 0n };
      rows.set(tokenId, fresh);
      return ok(fresh);
    };
    return chain(foldResult(diffs, undefined as void, (_, diff) => chain(row(diff.tokenId), (d): Result<void, BodyError> => {
      const collateral = d.collateral + diff.collateralDiff, ondelta = d.ondelta + diff.ondeltaDiff;
      if (collateral < 0n || collateral > MAX_PAYMENT_AMOUNT) return settleErr("SETTLEMENT_PROJECTED_COLLATERAL_RANGE");
      if (ondelta < INT512_MIN || ondelta > INT512_MAX) return settleErr("SETTLEMENT_PROJECTED_ONDELTA_RANGE");
      rows.set(diff.tokenId, { ...d, collateral, ondelta });
      return ok(undefined);
    })), () => chain(traverse(forgive, row), () => map(mapErr(accountProofBody({ ...view, deltas: rows }), (e): BodyError => ({ _tag: "settlement", reason: e._tag })), proofBodyHash)));
  });
const settlementHashOf = (a: AccountBody, diffs: readonly WorkspaceDiff[], forgive: readonly number[], nonce: number): Result<string, BodyError> => {
  const { domain } = a.terms, { left, right } = a.account.id;
  if (/^0x0{40}$/i.test(domain.depositoryAddress) || !WORD.test(left) || !WORD.test(right)) return settleErr("SETTLEMENT_HASH_DOMAIN");
  const text = (v: bigint): string => v.toString();
  try {
    return ok(encodeCooperativeUpdateHash({ messageType: 0, chainId: domain.chainId, contractAddress: domain.depositoryAddress, accountKey: joinHex([left, right]), nonce: String(nonce),
      diffs: diffs.map((d) => ({ tokenId: String(d.tokenId), leftDiff: text(d.leftDiff), rightDiff: text(d.rightDiff), collateralDiff: text(d.collateralDiff), ondeltaDiff: text(d.ondeltaDiff) })), forgiveDebtsInTokenIds: forgive.map(String) }));
  } catch { return settleErr("SETTLEMENT_HASH_ENCODING"); }
};
const exactHanko = (h: string | undefined): h is string => typeof h === "string" && h !== "0x" && /^0x(?:[0-9a-fA-F]{2})*$/.test(h);
/** og transition.ts prepare/verify/commitSettlementHanko: exact workspace, exact nonce, recomputed targets, both authorities, then one write. */
const hankoWorkspace = (a: AccountBody, x: Extract<AccountTx, { type: "settle_transition"; kind: "hanko" }>, ctx: FoldCtx): BodyStep => {
  const auth = ctx.settlement;
  if (auth === undefined) return settleErr("SETTLEMENT_HANKO_CONTEXT_MISSING");
  return chain(currentWorkspace(a, x.revision, x.workspaceHash), (w) => {
    if (w.status === "submitted") return settleErr("SETTLEMENT_HANKO_SUBMITTED_FORBIDDEN");
    const nonce = x.settlementNonce;
    if (!Number.isSafeInteger(nonce) || nonce < 1) return settleErr("SETTLEMENT_HANKO_NONCE_INVALID");
    const floor = Math.max(a.jNonce + 1, auth.proofNonceFloor);
    if (floor >= Number.MAX_SAFE_INTEGER) return settleErr("SETTLEMENT_NONCE_EXHAUSTED");
    if (nonce !== (w.nonceAtSign ?? floor)) return err({ _tag: "settlement", reason: "SETTLEMENT_HANKO_NONCE_MISMATCH", nonce: { supplied: nonce, required: w.nonceAtSign ?? floor, basis: w.nonceAtSign === undefined ? "account" : "workspace" } });
    return chain(compileOps(w.ops, w.lastModifiedByLeft), ({ diffs, forgive }) => chain(settlementHashOf(a, diffs, forgive, nonce), (settlementHash) => {
      if (typeof x.settlementHash !== "string" || !WORKSPACE_HASH.test(x.settlementHash)) return settleErr("SETTLEMENT_HANKO_HASH_INVALID");
      if (x.settlementHash.toLowerCase() !== settlementHash.toLowerCase()) return settleErr("SETTLEMENT_HANKO_HASH_MISMATCH");
      if (w.settlementHash !== undefined && w.settlementHash.toLowerCase() !== settlementHash.toLowerCase()) return settleErr("SETTLEMENT_HANKO_PINNED_HASH_MISMATCH");
      const post = x.postProof, postNonce = post.nonce;
      if (!Number.isSafeInteger(postNonce) || postNonce < 1) return settleErr("POST_SETTLEMENT_PROOF_NONCE_INVALID");
      if (postNonce !== nonce + 1) return settleErr("POST_SETTLEMENT_PROOF_NONCE_MISMATCH");
      return chain(projectedProofHash(a, diffs, forgive), (bodyHash) => {
        if (post.proofBodyHash.toLowerCase() !== bodyHash.toLowerCase()) return settleErr("POST_SETTLEMENT_PROOF_BODY_HASH_MISMATCH");
        return chain(chain(mapErr(committedView(a), uncommitted), (view) => mapErr(accountDisputeHash(view, bodyHash, postNonce, post.proposerIsLeft), (e): BodyError => ({ _tag: "settlement", reason: e._tag }))), (disputeHash) => {
          if (post.disputeHash.toLowerCase() !== disputeHash.toLowerCase()) return settleErr("POST_SETTLEMENT_DISPUTE_HASH_MISMATCH");
          const pinned = w.postSettlementDisputeProof;
          if (pinned !== undefined && (pinned.nonce !== postNonce || pinned.proofBodyHash.toLowerCase() !== bodyHash.toLowerCase() || pinned.disputeHash.toLowerCase() !== disputeHash.toLowerCase() || pinned.proposerIsLeft !== post.proposerIsLeft)) return settleErr("POST_SETTLEMENT_PROOF_PIN_MISMATCH");
          const source = (ctx.byLeft ? a.account.id.left : a.account.id.right) as EntityId;
          if (!exactHanko(post.hanko)) return settleErr("POST_SETTLEMENT_PROOF_HANKO_MISSING");
          if (!auth.verify(disputeHash, post.hanko, source)) return settleErr("POST_SETTLEMENT_PROOF_HANKO_INVALID");
          const executor = w.executorIsLeft === ctx.byLeft, settlementHanko = x.settlementHanko;
          if (executor && settlementHanko !== undefined) return settleErr("SETTLEMENT_EXECUTOR_HANKO_FORBIDDEN");
          if (!executor && !exactHanko(settlementHanko)) return settleErr("SETTLEMENT_NONEXECUTOR_HANKO_MISSING");
          if (!executor && settlementHanko !== undefined && !auth.verify(settlementHash, settlementHanko, source)) return settleErr("SETTLEMENT_NONEXECUTOR_HANKO_INVALID");
          const pinnedOwn = ctx.byLeft ? pinned?.leftHanko : pinned?.rightHanko, ownSettlement = ctx.byLeft ? w.leftHanko : w.rightHanko;
          if (pinnedOwn !== undefined && pinnedOwn.toLowerCase() !== post.hanko.toLowerCase()) return settleErr("POST_SETTLEMENT_PROOF_EQUIVOCATION");
          if (settlementHanko !== undefined && ownSettlement !== undefined && ownSettlement.toLowerCase() !== settlementHanko.toLowerCase()) return settleErr("SETTLEMENT_HANKO_EQUIVOCATION");
          const proof: PostSettlementProof = { disputeHash, proofBodyHash: bodyHash, nonce: postNonce, proposerIsLeft: post.proposerIsLeft, leftHanko: ctx.byLeft ? post.hanko : pinned?.leftHanko, rightHanko: ctx.byLeft ? pinned?.rightHanko : post.hanko };
          const leftHanko = ctx.byLeft && settlementHanko !== undefined ? settlementHanko : w.leftHanko, rightHanko = !ctx.byLeft && settlementHanko !== undefined ? settlementHanko : w.rightHanko;
          const ready = (w.executorIsLeft ? rightHanko : leftHanko) !== undefined && proof.leftHanko !== undefined && proof.rightHanko !== undefined;
          return ok(step({ ...a, settlement: { ...w, compiledDiffs: diffs, compiledForgiveTokenIds: forgive, nonceAtSign: nonce, settlementHash, postSettlementDisputeProof: proof, leftHanko, rightHanko, status: ready ? "ready_to_submit" : "awaiting_counterparty", lastUpdatedAt: Number(ctx.nowMs) } }));
        });
      });
    }));
  });
};
const unsignedWorkspace = (w: SettlementWorkspace): boolean => (w.status === "draft" || w.status === "awaiting_counterparty") && w.compiledDiffs === undefined && w.compiledForgiveTokenIds === undefined && !signedWorkspace(w) && w.nonceAtSign === undefined;
const settleTransition = (a: AccountBody, x: TxOf<"settle_transition">, ctx: FoldCtx): BodyStep => {
  if (x.kind === "upsert") return upsertWorkspace(a, x, ctx);
  if (x.kind === "hanko") return hankoWorkspace(a, x, ctx);
  return chain(currentWorkspace(a, x.revision, x.workspaceHash), (w): BodyStep => {
    if (x.kind === "submit") {
      if (w.status === "submitted") return settleErr("SETTLEMENT_WORKSPACE_ALREADY_SUBMITTED");
      if (ctx.byLeft !== w.executorIsLeft) return settleErr("SETTLEMENT_SUBMIT_EXECUTOR_MISMATCH");
      if ((ctx.byLeft ? w.rightHanko : w.leftHanko) === undefined) return settleErr("SETTLEMENT_SUBMIT_COUNTERPARTY_HANKO_MISSING");
      if (w.status !== "ready_to_submit" || w.postSettlementDisputeProof?.leftHanko === undefined || w.postSettlementDisputeProof.rightHanko === undefined) return settleErr("SETTLEMENT_SUBMIT_POST_PROOF_INCOMPLETE");
      return ok(step({ ...a, settlement: { ...w, status: "submitted", lastUpdatedAt: Number(ctx.nowMs) } }));
    }
    if (w.status === "submitted") return settleErr("SETTLEMENT_CLEAR_SUBMITTED_FORBIDDEN");
    return unsignedWorkspace(w) ? ok(step({ ...a, settlement: undefined })) : settleErr("SETTLEMENT_CLEAR_SIGNED_FORBIDDEN");
  });
};
/** og finality.ts activatePostSettlementProof, body side: an unsigned workspace clears; a signed one clears once its nonce is final, after its N+1 proof checks out. */
const activateWorkspace = (b: AccountBody, finalizedNonce: number): Result<AccountBody, BodyError> => {
  const w = b.settlement;
  if (w === undefined) return ok(b);
  if (!signedWorkspace(w)) return ok({ ...b, settlement: undefined });
  const signed = w.nonceAtSign;
  if (signed === undefined || !Number.isSafeInteger(signed) || signed < 1) return settleErr("SETTLEMENT_SIGNED_NONCE_MISSING");
  if (finalizedNonce < signed) return ok(b);
  if (finalizedNonce > signed) return ok({ ...b, settlement: undefined });
  const p = w.postSettlementDisputeProof;
  if (p === undefined) return settleErr("POST_SETTLEMENT_PROOF_MISSING");
  if (p.nonce !== signed + 1) return settleErr("POST_SETTLEMENT_PROOF_NONCE_MISMATCH");
  if (p.leftHanko === undefined || p.rightHanko === undefined || p.leftHanko === "" || p.rightHanko === "") return settleErr("POST_SETTLEMENT_PROOF_HANKO_MISSING");
  if (p.disputeHash === "" || p.proofBodyHash === "") return settleErr("POST_SETTLEMENT_DISPUTE_HASH_MISSING");
  return chain(projectedProofHash(b, [], []), (h) => h.toLowerCase() !== p.proofBodyHash.toLowerCase() ? settleErr("POST_SETTLEMENT_FINALIZED_PROOF_BODY_MISMATCH") : ok({ ...b, settlement: undefined }));
};
// ---- swaps: og handlers/swap/{offer,resolve}, account/swap/swap-net-authorization.ts, orderbook/types.ts quantization ----
const swapErr = (reason: string): Result<never, BodyError> => err({ _tag: "swap", reason });
const PRICE_SCALE = 10_000n;
const MAX_ACCOUNT_SWAP_OFFERS = 50, MAX_ACCOUNT_SAME_J_SWAP_OFFERS = 32, MAX_SWAP_OFFERS_PER_SIDE_PER_MARKET = 32;
/** og account/utils.ts REFERENCE_STABLE_TOKEN_IDS (USDC, USDT): always the quote of a pair. */
const REFERENCE_STABLES: ReadonlySet<number> = new Set([1, 3]);
/** og getSwapPairOrientation + deriveSide: 1 when the give token is the pair's base. */
export const swapSide = (give: number, want: number): 0 | 1 => {
  const g = REFERENCE_STABLES.has(give), w = REFERENCE_STABLES.has(want);
  return give === (g && !w ? want : !g && w ? give : Math.min(give, want)) ? 1 : 0;
};
const pow10 = (d: number): bigint => 10n ** BigInt(d);
const lotScale = (baseDecimals: number): bigint => pow10(Math.max(0, baseDecimals - 6));
const gcd = (x: bigint, y: bigint): bigint => { let [p, q] = [x, y]; while (q !== 0n) [p, q] = [q, p % q]; return p; };
const ceilDiv = (n: bigint, d: bigint): bigint => (n + d - 1n) / d;
const quoteAt = (bd: number, qd: number, base: bigint, price: bigint): bigint => (base <= 0n || price <= 0n ? 0n : (base * price * pow10(qd)) / (PRICE_SCALE * pow10(bd)));
const exactQuoteLots = (bd: number, qd: number, price: bigint): bigint => { const den = PRICE_SCALE * pow10(bd); return den / gcd(lotScale(bd) * price * pow10(qd), den); };
type SwapDims = { readonly side: 0 | 1; readonly bd: number; readonly qd: number };
const swapDims = (o: Pick<SwapOffer, "giveTokenId" | "wantTokenId" | "giveTokenDecimals" | "wantTokenDecimals">): SwapDims => {
  const side = swapSide(Number(o.giveTokenId), Number(o.wantTokenId));
  return side === 1 ? { side, bd: o.giveTokenDecimals, qd: o.wantTokenDecimals } : { side, bd: o.wantTokenDecimals, qd: o.giveTokenDecimals };
};
/** og computePriceTicksForBaseQuoteDecimals under the one-tick step every og pair policy uses: bids round up, asks down. */
const priceTicksOf = (d: SwapDims, base: bigint, quote: bigint): bigint => {
  if (base <= 0n || quote <= 0n) return 0n;
  const n = quote * pow10(d.bd) * PRICE_SCALE, den = base * pow10(d.qd), p = n / den + (d.side === 1 && n % den > 0n ? 1n : 0n);
  return p > 0n ? p : 0n;
};
/** og prepareSwapOrderWithDimensions: the canonical price, or undefined when the order quantizes to nothing. */
const preparedPrice = (d: SwapDims, base: bigint, quote: bigint): bigint | undefined => {
  const lot = lotScale(d.bd);
  if (base < lot || quote <= 0n) return undefined;
  const price = priceTicksOf(d, base, quote);
  if (price <= 0n) return undefined;
  const unit = lot * exactQuoteLots(d.bd, d.qd, price), qb = (base / unit) * unit;
  return qb <= 0n || quoteAt(d.bd, d.qd, qb, price) <= 0n ? undefined : price;
};
/** og requantizeRemainingSwapBaseAtPriceForDimensions. */
const requantizeRemaining = (d: SwapDims, base: bigint, price: bigint): { readonly give: bigint; readonly want: bigint } | undefined => {
  if (base <= 0n || price <= 0n) return undefined;
  const unit = lotScale(d.bd) * exactQuoteLots(d.bd, d.qd, price), qb = (base / unit) * unit;
  if (qb <= 0n) return undefined;
  const qq = quoteAt(d.bd, d.qd, qb, price);
  return qq <= 0n ? undefined : d.side === 1 ? { give: qb, want: qq } : { give: qq, want: qb };
};
type NetAuth = { readonly maxFee: bigint; readonly minNetReceive: bigint };
type Authorized = NetAuth & { readonly giveAmount: bigint; readonly wantAmount: bigint };
const offerAuthError = (o: Authorized): string | undefined =>
  typeof o.giveAmount !== "bigint" || typeof o.wantAmount !== "bigint" || o.giveAmount <= 0n || o.wantAmount <= 0n ? "SWAP_NET_AUTH_OFFER_AMOUNT_INVALID"
  : typeof o.maxFee !== "bigint" || o.maxFee < 0n || o.maxFee > o.wantAmount ? "SWAP_NET_AUTH_MAX_FEE_INVALID"
  : typeof o.minNetReceive !== "bigint" || o.minNetReceive < 0n || o.minNetReceive > o.wantAmount ? "SWAP_NET_AUTH_MIN_RECEIVE_INVALID" : undefined;
/** og assertSwapNetAuthorization: fee and net receive stay inside the maker's pro-rata authority; a terminal fill may use want progress. */
const netAuthError = (o: Authorized, fG: bigint, fW: bigint, fee: bigint, closes: boolean): string | undefined => {
  const bad = offerAuthError(o);
  if (bad !== undefined) return bad;
  if (fG < 0n || fG > o.giveAmount) return "SWAP_NET_AUTH_FILL_GIVE_INVALID";
  if (fW < 0n || fee < 0n || fee > fW || (fW > 0n && fee >= fW)) return "SWAP_NET_AUTH_FILL_WANT_INVALID";
  let num = fG, den = o.giveAmount;
  if (closes) { const capped = fW < o.wantAmount ? fW : o.wantAmount; if (capped * den > num * o.wantAmount) { num = capped; den = o.wantAmount; } }
  return fee > (o.maxFee * num) / den ? "SWAP_NET_AUTH_MAX_FEE_EXCEEDED" : fW - fee < ceilDiv(o.minNetReceive * num, den) ? "SWAP_NET_AUTH_MIN_RECEIVE_NOT_MET" : undefined;
};
/** og requantizeSwapNetAuthorization: the removed give share takes its pro-rata fee and receive authority with it. */
const requantizeAuth = (o: Authorized, give: bigint, want: bigint): Result<NetAuth, BodyError> => {
  const bad = offerAuthError(o);
  if (bad !== undefined) return swapErr(bad);
  if (give <= 0n || give > o.giveAmount || want <= 0n) return swapErr("SWAP_NET_AUTH_REMAINDER_INVALID");
  const removed = o.giveAmount - give;
  const auth: NetAuth = { maxFee: o.maxFee - (o.maxFee * removed) / o.giveAmount, minNetReceive: o.minNetReceive - ceilDiv(o.minNetReceive * removed, o.giveAmount) };
  const after = offerAuthError({ giveAmount: give, wantAmount: want, ...auth });
  return after === undefined ? ok(auth) : swapErr(after);
};
const decimalsOk = (d: number): boolean => Number.isSafeInteger(d) && d >= 0 && d <= 255;
/** og swap/offer: admission (limits, shape, market cap), quantization, capacity, hold. */
/** og swap-limits.ts accountSwapMarketKey: same-j offers by token direction, cross-j offers by canonical venue and side. */
const offerMarketKey = (o: { readonly giveTokenId: TokenId; readonly wantTokenId: TokenId; readonly crossJurisdiction?: CrossRoute | undefined }): Result<string, BodyError> =>
  o.crossJurisdiction === undefined ? ok(`same:${Number(o.giveTokenId)}>${Number(o.wantTokenId)}`) : map(noteErr(crossMarket(o.crossJurisdiction)), (m) => `${m.venueId}:${m.sourceIsBase ? "base>quote" : "quote>base"}`);
const swapOffer = (a: AccountBody, x: TxOf<"swap_offer">, ctx: FoldCtx): BodyStep => {
  const route = x.crossJurisdiction;
  if (x.offerId.includes(":")) return swapErr("SWAP_OFFER_ID_COLON");
  if (a.offers.has(x.offerId)) return err({ _tag: "duplicate" });
  if (a.offers.size >= MAX_ACCOUNT_SWAP_OFFERS) return swapErr("SWAP_OFFER_LIMIT");
  const sameJ = [...a.offers.values()].filter((o) => o.crossJurisdiction === undefined).length;
  if (route === undefined && sameJ >= MAX_ACCOUNT_SAME_J_SWAP_OFFERS) return swapErr("SWAP_SAME_J_OFFER_LIMIT");
  if (route !== undefined && a.offers.size - sameJ >= MAX_ACCOUNT_CROSS_J_SWAP_OFFERS) return swapErr("SWAP_CROSS_J_OFFER_LIMIT");
  if (!decimalsOk(x.giveTokenDecimals) || !decimalsOk(x.wantTokenDecimals)) return swapErr("SWAP_TOKEN_DECIMALS_INVALID");
  if (x.giveAmount < 1n || x.giveAmount > MAX_PAYMENT_AMOUNT || x.wantAmount < 1n || x.wantAmount > MAX_PAYMENT_AMOUNT) return swapErr("SWAP_OFFER_AMOUNT_INVALID");
  if (x.maxFee >= x.wantAmount || x.minNetReceive <= 0n) return swapErr("SWAP_NET_AUTH_INITIAL_TERMS_INVALID");
  const initial = netAuthError(x, 0n, 0n, 0n, false);
  if (initial !== undefined) return swapErr(initial);
  // og admission.ts: cross-j settles gross through its paired pulls, so no fee authority, and the route must already be prepared and resting.
  if (route !== undefined && (x.maxFee !== 0n || x.minNetReceive !== x.wantAmount)) return swapErr("CROSS_J_SWAP_NET_AUTH_INVALID");
  if (route === undefined && x.giveTokenId === x.wantTokenId) return swapErr("SWAP_SAME_TOKEN");
  if (route !== undefined && (route.status !== "resting" || !route.sourcePull || !route.targetPull)) return swapErr("CROSS_J_SWAP_NOT_PREPARED");
  if (x.timeInForce !== undefined && ![0, 1, 2].includes(x.timeInForce)) return swapErr("SWAP_TIME_IN_FORCE_INVALID");
  const { left, right } = a.account.id, proposer = (ctx.byLeft ? left : right).toLowerCase();
  const makerIsLeft = route === undefined ? ctx.byLeft : route.makerEntityId.toLowerCase() === left.toLowerCase();
  if (route !== undefined && (route.makerEntityId.toLowerCase() !== (makerIsLeft ? left : right).toLowerCase() || ![route.makerEntityId, route.source.counterpartyEntityId].some((e) => e.toLowerCase() === proposer)))
    return swapErr("CROSS_J_SWAP_PROPOSER");
  return chain(offerMarketKey(x), (key) => chain(traverse([...a.offers.values()].filter((o) => o.makerIsLeft === makerIsLeft), offerMarketKey), (keys) =>
    keys.filter((k) => k === key).length >= MAX_SWAP_OFFERS_PER_SIDE_PER_MARKET ? swapErr("SWAP_MARKET_OFFER_LIMIT") : route === undefined ? sameJOffer(a, x, ctx, makerIsLeft) : crossJOffer(a, x, route, ctx, makerIsLeft)));
};
/** og quantization.ts + cross-j-binding.ts + commit.ts for a cross-j offer: exact route amounts on the canonical side, lot-aligned base, the paired source pull, no second hold. */
const crossJOffer = (a: AccountBody, x: TxOf<"swap_offer">, route: CrossRoute, ctx: FoldCtx, makerIsLeft: boolean): BodyStep => chain(noteErr(crossMarket(route)), (m) => {
  const side = m.sourceIsBase ? 1 : 0, base = side === 1 ? x.giveAmount : x.wantAmount, quote = side === 1 ? x.wantAmount : x.giveAmount;
  const d: SwapDims = side === 1 ? { side, bd: x.giveTokenDecimals, qd: x.wantTokenDecimals } : { side, bd: x.wantTokenDecimals, qd: x.giveTokenDecimals }, lot = lotScale(d.bd);
  if (base < lot) return swapErr("SWAP_ORDER_BELOW_LOT");
  if (base % lot !== 0n) return swapErr("CROSS_J_SWAP_LOT_ALIGNMENT");
  const priceTicks = priceTicksOf(d, base, quote);
  if (priceTicks <= 0n) return swapErr("SWAP_PRICE_INVALID");
  if (x.giveAmount !== BigInt(route.source.amount) || x.wantAmount !== BigInt(route.target.amount)) return swapErr("CROSS_J_SWAP_AMOUNT_CHANGED");
  return chain(noteErr(canonicalCrossRoute(route)), (canonical): BodyStep => {
    const sp = route.sourcePull, paired = sp === undefined ? undefined : a.pulls?.get(sp.pullId);
    if (sp === undefined || paired === undefined) return swapErr("CROSS_J_SWAP_SOURCE_PULL_MISSING");
    if (paired.tokenId !== sp.tokenId || paired.tokenId !== Number(x.giveTokenId) || paired.amount !== sp.signedAmount
      || (paired.fullHash || "").toLowerCase() !== sp.fullHash.toLowerCase() || (paired.partialRoot || "").toLowerCase() !== sp.partialRoot.toLowerCase()) return swapErr("CROSS_J_SWAP_SOURCE_PULL_MISMATCH");
    const b = paired.crossJurisdiction;
    if (!b || b.leg !== "source" || b.orderId !== canonical.orderId || (b.routeHash || "").toLowerCase() !== (canonical.routeHash || "").toLowerCase()) return swapErr("CROSS_J_SWAP_SOURCE_BINDING_MISMATCH");
    return chain(requantizeAuth(x, x.giveAmount, x.wantAmount), (auth) => map(noteErr(cloneCrossRoute(route)), (publicRoute) => {
      const offer: SwapOffer = {
        offerId: x.offerId, giveTokenId: x.giveTokenId, giveTokenDecimals: x.giveTokenDecimals, giveAmount: x.giveAmount, wantTokenId: x.wantTokenId, wantTokenDecimals: x.wantTokenDecimals, wantAmount: x.wantAmount,
        maxFee: auth.maxFee, minNetReceive: auth.minNetReceive, priceTicks, ...(x.timeInForce !== undefined ? { timeInForce: x.timeInForce } : {}), makerIsLeft,
        createdHeight: Number(ctx.jHeight), quantizedGive: x.giveAmount, quantizedWant: x.wantAmount, crossJurisdiction: publicRoute,
      };
      return step({ ...a, offers: mapSet(a.offers, x.offerId, offer) });
    }));
  });
});
/** og same-j quantization and commit: canonical price, lot-quantized amounts, capacity, and the maker's give hold. */
const sameJOffer = (a: AccountBody, x: TxOf<"swap_offer">, ctx: FoldCtx, makerIsLeft: boolean): BodyStep => {
  const d = swapDims(x), base = d.side === 1 ? x.giveAmount : x.wantAmount, quote = d.side === 1 ? x.wantAmount : x.giveAmount, lot = lotScale(d.bd);
  if (base < lot) return swapErr("SWAP_ORDER_BELOW_LOT");
  const prepared = preparedPrice(d, base, quote);
  if (prepared === undefined) return swapErr("SWAP_PRICE_INVALID");
  const input = x.priceTicks;
  if (input !== undefined && input <= 0n) return swapErr("SWAP_PRICE_TICKS_INVALID");
  if (input !== undefined && (input > prepared ? input - prepared : prepared - input) > 1n) return swapErr("SWAP_PRICE_TICKS_MISMATCH");
  const priceTicks = input ?? prepared, qb = (base / lot) * lot, qq = quoteAt(d.bd, d.qd, qb, priceTicks);
  const give = d.side === 1 ? qb : qq, want = d.side === 1 ? qq : qb;
  if (give < 1n || give > MAX_PAYMENT_AMOUNT || want < 1n || want > MAX_PAYMENT_AMOUNT) return swapErr("SWAP_QUANTIZED_AMOUNT_INVALID");
  return chain(requantizeAuth(x, give, want), (auth) => chain(ensureRoom(a, x.giveTokenId, give, makerIsLeft), (): BodyStep => {
    const totals = sideTotals(a, x.giveTokenId);
    if ((makerIsLeft ? totals.leftHold : totals.rightHold) + give > MAX_PAYMENT_AMOUNT) return err({ _tag: "hold_overflow" });
    const offer: SwapOffer = {
      offerId: x.offerId, giveTokenId: x.giveTokenId, giveTokenDecimals: x.giveTokenDecimals, giveAmount: give, wantTokenId: x.wantTokenId, wantTokenDecimals: x.wantTokenDecimals, wantAmount: want,
      maxFee: auth.maxFee, minNetReceive: auth.minNetReceive, priceTicks, ...(x.timeInForce !== undefined ? { timeInForce: x.timeInForce } : {}), makerIsLeft,
      // og mutation.ts passes the frame's jHeight as the swap handlers' currentHeight.
      createdHeight: Number(ctx.jHeight), quantizedGive: give, quantizedWant: want,
    };
    return ok(step({ ...a, offers: mapSet(a.offers, x.offerId, offer) }));
  }));
};
/** og orderbook/swap-execution.ts deriveExactSwapFillRatio + exactFillRatioToUint16. */
const exactFillRatio = (qG: bigint, fG: bigint): { readonly n: bigint; readonly d: bigint } => {
  if (qG <= 0n || fG <= 0n) return { n: 0n, d: 1n };
  if (fG >= qG) return { n: 1n, d: 1n };
  const g = gcd(fG, qG);
  return { n: fG / g, d: qG / g };
};
const fillRatioOf = (r: { readonly n: bigint; readonly d: bigint }): number => {
  if (r.n <= 0n) return 0;
  if (r.n >= r.d) return MAX_FILL;
  const max = BigInt(MAX_FILL);
  let c = Math.min(MAX_FILL, Math.max(0, Number((r.n * max + r.d - 1n) / r.d)));
  while (c > 0 && (r.d * BigInt(c - 1)) / max >= r.n) c--;
  while (c < MAX_FILL && (r.d * BigInt(c)) / max < r.n) c++;
  return c;
};
/** og swap/resolve: canonical offer, explicit execution at or above the maker's limit, fee authority, counterparty capacity, requantized remainder. */
const swapResolve = (a: AccountBody, x: TxOf<"swap_resolve">, ctx: FoldCtx): BodyStep<Of<Effect, "swap_cancelled">> => {
  const offer = a.offers.get(x.offerId);
  if (offer === undefined) return MISSING;
  if (offer.crossJurisdiction !== undefined) return swapErr("SWAP_RESOLVE_CROSS_J");
  if ((x.restingGiveAmount !== undefined && x.restingGiveAmount !== offer.giveAmount) || (x.restingWantAmount !== undefined && x.restingWantAmount !== offer.wantAmount)
    || (x.restingQuantizedGive !== undefined && x.restingQuantizedGive !== offer.quantizedGive) || (x.restingQuantizedWant !== undefined && x.restingQuantizedWant !== offer.quantizedWant)
    || (x.restingPriceTicks !== undefined && x.restingPriceTicks !== offer.priceTicks)) return swapErr("SWAP_RESTING_TERMS_MISMATCH");
  if (ctx.byLeft === offer.makerIsLeft) return err({ _tag: "not_counterparty" });
  if (!Number.isInteger(x.fillRatio) || x.fillRatio < 0 || x.fillRatio > MAX_FILL) return err({ _tag: "bad_ratio" });
  const provided = x.executionGiveAmount !== undefined || x.executionWantAmount !== undefined;
  if (provided && (x.executionGiveAmount === undefined || x.executionWantAmount === undefined)) return swapErr("SWAP_EXECUTION_PARTIAL");
  if (x.fillRatio > 0 && !provided) return swapErr("SWAP_EXECUTION_REQUIRED");
  const qG = offer.quantizedGive, qW = offer.quantizedWant, limitGive = (qG * BigInt(x.fillRatio)) / BigInt(MAX_FILL);
  const fG = x.executionGiveAmount ?? limitGive, fW = x.executionWantAmount ?? ceilDiv(limitGive * qW, qG);
  const canonical = provided ? fillRatioOf(exactFillRatio(qG, fG)) : x.fillRatio;
  const exact = x.fillNumerator !== undefined || x.fillDenominator !== undefined;
  if (exact) {
    const n = x.fillNumerator, dd = x.fillDenominator;
    if (n === undefined || dd === undefined) return swapErr("SWAP_EXACT_RATIO_PARTIAL");
    if (dd <= 0n || n < 0n || n > dd) return swapErr("SWAP_EXACT_RATIO_RANGE");
    if (n * qG !== fG * dd) return swapErr("SWAP_EXACT_RATIO_MISMATCH");
  }
  const fee = x.feeAmount ?? 0n;
  if (fee < 0n || (fee > 0n && fG <= 0n) || (fee > 0n && (x.feeTokenId ?? offer.wantTokenId) !== offer.wantTokenId) || (fee >= fW && fW > 0n)) return swapErr("SWAP_FEE_INVALID");
  const auth = netAuthError(offer, fG, fW, fee, x.cancelRemainder);
  if (auth !== undefined) return swapErr(auth);
  const hasFill = fG > 0n || fW > 0n;
  if (provided && hasFill && (fG <= 0n || fW <= 0n)) return swapErr("SWAP_EXECUTION_NOT_POSITIVE");
  if (provided && x.fillRatio !== canonical) return swapErr("SWAP_FILL_RATIO_MISMATCH");
  if (provided && hasFill && fG > qG) return swapErr("SWAP_EXECUTION_ABOVE_OFFER");
  if (provided && hasFill && fW * qG < fG * qW) return swapErr("SWAP_MAKER_LIMIT_PRICE");
  if (canonical > 0 && (fG < 1n || fG > MAX_PAYMENT_AMOUNT || fW < 1n || fW > MAX_PAYMENT_AMOUNT)) return swapErr("SWAP_FILL_AMOUNT_BOUNDS");
  // Holds are derived from live offers: dropping or replacing the offer releases the filled give and any requantization dust.
  const closed: AccountBody = { ...a, offers: mapDelete(a.offers, offer.offerId) };
  const byMaker = (n: bigint): bigint => (offer.makerIsLeft ? -n : n);
  return chain(fW > 0n ? chain(ensureRoom(a, offer.wantTokenId, fW, !offer.makerIsLeft), () => ok(undefined)) : ok(undefined), () => {
    const giveRow = shift(getDelta(a.account, offer.giveTokenId), fG > 0n ? byMaker(fG) : 0n);
    const wantRow = shift(getDelta(a.account, offer.wantTokenId), (fG > 0n ? -byMaker(fW) : 0n) + (fee > 0n ? byMaker(fee) : 0n));
    return chain(representable(a, giveRow), () => chain(representable(a, wantRow), (): BodyStep<Of<Effect, "swap_cancelled">> => {
      const moved = putState(closed, setDelta(setDelta(a.account, giveRow), wantRow));
      // og remainder.ts closeSwapOffer: every removal of the resting offer reports swap_cancelled with the maker's entity.
      const removed = ok(step(moved, [{ _tag: "swap_cancelled" as const, offerId: offer.offerId, makerId: offer.makerIsLeft ? a.account.id.left : a.account.id.right }]));
      if (x.cancelRemainder || x.fillRatio === 0 || canonical === MAX_FILL) return removed;
      const d = swapDims(offer), remaining = d.side === 1 ? qG - fG : qW - fW, next = requantizeRemaining(d, remaining, offer.priceTicks);
      if (next === undefined) return removed;
      if (qG - fG - next.give < 0n) return swapErr("SWAP_REMAINDER_EXCEEDS_HOLD");
      return map(requantizeAuth(offer, next.give, next.want), (na) => step({ ...moved, offers: mapSet(moved.offers, offer.offerId, { ...offer, giveAmount: next.give, wantAmount: next.want, maxFee: na.maxFee, minNetReceive: na.minNetReceive, quantizedGive: next.give, quantizedWant: next.want }) }));
    }));
  });
};
// ---- rebalance: og handlers/rebalance/{request-collateral,refund,policy}.ts ----
const rebalanceErr = (reason: string): Result<never, BodyError> => err({ _tag: "rebalance", reason });
/** og request-collateral.ts: the requester prepays the fee now; one immutable request per token until finality or full refund. */
const requestCollateral = (a: AccountBody, x: TxOf<"request_collateral">, ctx: FoldCtx): BodyStep<Of<Effect, "request_collateral_committed">> => {
  if (x.amount <= 0n) return rebalanceErr("REQUEST_COLLATERAL_AMOUNT");
  if (x.feeAmount < 0n) return rebalanceErr("REQUEST_COLLATERAL_FEE");
  if (!Number.isFinite(x.policyVersion) || x.policyVersion < 1) return rebalanceErr("REQUEST_COLLATERAL_POLICY_VERSION");
  if (!a.account.deltas.has(x.tokenId)) return rebalanceErr("REQUEST_COLLATERAL_NO_DELTA");
  if ((a.requested.get(x.tokenId) ?? 0n) > 0n) return ok(step(a));
  if (x.feeAmount <= 0n) return rebalanceErr("REQUEST_COLLATERAL_FEE_ZERO");
  const feeToken = x.feeTokenId ?? x.tokenId;
  if (!a.account.deltas.has(feeToken)) return rebalanceErr("REQUEST_COLLATERAL_NO_FEE_DELTA");
  const amount = feeToken !== x.tokenId ? x.amount : x.amount > x.feeAmount ? x.amount - x.feeAmount : 0n;
  if (amount <= 0n) return ok(step(a));
  // og mutation.ts applyCollateralRequest: a freshly created request reports request_collateral_committed.
  return map(spend(a, feeToken, x.feeAmount, ctx.byLeft), (paid) => step<AccountBody, Of<Effect, "request_collateral_committed">>({
    ...paid, requested: mapSet(paid.requested, x.tokenId, amount),
    requestFees: mapSet(paid.requestFees, x.tokenId, { requestId: `rebalance:${ctx.byLeft ? "left" : "right"}:${Number(x.tokenId)}:${ctx.accountHeight}`, feeTokenId: Number(feeToken), feePaidUpfront: x.feeAmount, requestedAmount: amount, policyVersion: x.policyVersion, requestedAt: Number(ctx.nowMs), requestedByLeft: ctx.byLeft }),
  }, [{ _tag: "request_collateral_committed", tokenId: Number(x.tokenId), requestedAmount: amount, prepaidFee: x.feeAmount, requestedAt: Number(ctx.nowMs) }]));
};
/** og refund.ts: the counterparty returns prepaid fee, partially or in full; a full refund clears the request. */
const rebalanceRefund = (a: AccountBody, x: TxOf<"rebalance_refund">, ctx: FoldCtx): BodyStep => {
  if (!x.requestId || x.amount <= 0n) return rebalanceErr("REBALANCE_REFUND_INPUT");
  const fees = a.requestFees.get(x.requestTokenId);
  if (fees === undefined || (a.requested.get(x.requestTokenId) ?? 0n) <= 0n || fees.requestId !== x.requestId) return rebalanceErr("REBALANCE_REFUND_NOT_FOUND");
  if (ctx.byLeft === fees.requestedByLeft) return rebalanceErr("REBALANCE_REFUND_SELF");
  if (fees.refund !== undefined && fees.refund.reason !== x.reason) return rebalanceErr("REBALANCE_REFUND_REASON");
  const refunded = fees.refund?.refundedAmount ?? 0n, outstanding = fees.feePaidUpfront - refunded;
  if (outstanding <= 0n || x.amount > outstanding) return rebalanceErr("REBALANCE_REFUND_OUTSTANDING");
  const feeToken = String(fees.feeTokenId) as TokenId;
  if (!a.account.deltas.has(feeToken)) return rebalanceErr("REBALANCE_REFUND_NO_FEE_DELTA");
  return map(spend(a, feeToken, x.amount, ctx.byLeft), (paid) => {
    const next = refunded + x.amount;
    // og refund.ts: a full refund clears the request and its shadow submission marker, so a new request for the token may enter a J-batch.
    return step(next === fees.feePaidUpfront
      ? clearSubmittedAt({ ...paid, requested: mapDelete(paid.requested, x.requestTokenId), requestFees: mapDelete(paid.requestFees, x.requestTokenId) }, x.requestTokenId)
      : { ...paid, requestFees: mapSet(paid.requestFees, x.requestTokenId, { ...fees, refund: { reason: x.reason, refundedAmount: next } }) });
  });
};
/** og policy.ts: each side publishes versioned fee terms; older versions are ignored, a same-version change is equivocation. */
const rebalancePolicy = (a: AccountBody, x: TxOf<"rebalance_policy">, ctx: FoldCtx): BodyStep => {
  const token = Number(x.tokenId), ts = Number(ctx.nowMs);
  if (!Number.isSafeInteger(token) || token <= 0 || token > 65_535) return rebalanceErr("REBALANCE_POLICY_TOKEN");
  if (!Number.isSafeInteger(x.policyVersion) || x.policyVersion <= 0) return rebalanceErr("REBALANCE_POLICY_VERSION");
  if (typeof x.baseFee !== "bigint" || typeof x.liquidityFeeBps !== "bigint" || typeof x.gasFee !== "bigint") return rebalanceErr("REBALANCE_POLICY_FEE_TYPES");
  if (!Number.isSafeInteger(ts) || ts <= 0) return rebalanceErr("REBALANCE_POLICY_TIMESTAMP");
  if (x.baseFee < 0n || x.liquidityFeeBps < 0n || x.liquidityFeeBps > 10_000n || x.gasFee < 0n) return rebalanceErr("REBALANCE_POLICY_FEE_TERMS");
  if (!a.account.deltas.has(x.tokenId)) return rebalanceErr("REBALANCE_POLICY_NO_DELTA");
  const held = a.feePolicies.get(x.tokenId), current = ctx.byLeft ? held?.left : held?.right;
  if (current !== undefined && x.policyVersion < current.policyVersion) return ok(step(a));
  if (current !== undefined && x.policyVersion === current.policyVersion) {
    return current.baseFee === x.baseFee && current.liquidityFeeBps === x.liquidityFeeBps && current.gasFee === x.gasFee ? ok(step(a)) : rebalanceErr("REBALANCE_POLICY_EQUIVOCATION");
  }
  const next: RebalanceFeeSnapshot = { policyVersion: x.policyVersion, baseFee: x.baseFee, liquidityFeeBps: x.liquidityFeeBps, gasFee: x.gasFee, updatedAt: ts };
  return ok(step({ ...a, feePolicies: mapSet(a.feePolicies, x.tokenId, { ...held, ...(ctx.byLeft ? { left: next } : { right: next }) }) }));
};
// ---- Account-level lending: og handlers/balance/lending.ts ----
const lendingErr = (reason: string): Result<never, BodyError> => err({ _tag: "lending", reason });
const LENDING_ENTITY = /^0x[0-9a-f]{64}$/, LENDING_INTENT = /^(?:lend|borrow|loan)-[0-9a-f]{16}$/;
const lower = (v: unknown): string => String(v || "").trim().toLowerCase();
type AccountLendingTx = TxOf<"lending_fund" | "lending_borrow_request" | "lending_repay" | "lending_credit" | "lending_close_request" | "lending_close_payout">;
/** og deriveDelta outOwnCredit: the proposer's own credit line it has not drawn yet. */
const ownCreditLeft = (d: Delta, isLeft: boolean): bigint => {
  const t = d.ondelta + d.offdelta;
  return isLeft ? floor0(d.leftCreditLimit - floor0(-t)) : floor0(d.rightCreditLimit - floor0(t - d.collateral));
};
/** og requireIntentId, requireRole (the claimed actor is the frame proposer) and requireCounterparty. */
const lendingParties = (a: AccountBody, byLeft: boolean, id: string, prefix: "lend" | "borrow" | "loan", actor: string, counterparty: string): Result<void, BodyError> => {
  const intent = lower(id);
  if (!LENDING_INTENT.test(intent) || !intent.startsWith(`${prefix}-`)) return lendingErr("LENDING_INTENT_ID_INVALID");
  const claimed = lower(actor), left = lower(a.account.id.left), right = lower(a.account.id.right), proposer = byLeft ? left : right;
  if (!LENDING_ENTITY.test(claimed)) return lendingErr("LENDING_ROLE_INVALID");
  if (claimed !== proposer) return lendingErr("LENDING_ROLE_NOT_PROPOSER");
  return lower(counterparty) !== (proposer === left ? right : left) ? lendingErr("LENDING_COUNTERPARTY_INVALID") : ok(undefined);
};
const LENDING_TERMS: ReadonlySet<unknown> = new Set(["1h", "1d", "1m"]);
const interestOk = (v: unknown): boolean => { const n = Math.floor(Number(v)); return Number.isFinite(n) && n >= 0 && n <= 10_000; };
const lending = (a: AccountBody, x: AccountLendingTx, ctx: FoldCtx): BodyStep => {
  const record = (b: AccountBody, key: string, kind: LendingIntentKind): BodyStep => (b.lendingIntents.has(key) ? lendingErr("LENDING_INTENT_REPLAY") : ok(step({ ...b, lendingIntents: mapSet(b.lendingIntents, key, kind) })));
  const unused = (key: string): Result<void, BodyError> => (a.lendingIntents.has(key) ? lendingErr("LENDING_INTENT_REPLAY") : ok(undefined));
  const pay = (tk: TokenId, amount: bigint, key: string, kind: LendingIntentKind): BodyStep => chain(unused(key), () => chain(spend(a, tk, amount, ctx.byLeft), (b) => record(b, key, kind)));
  const positive = (v: bigint): Result<void, BodyError> => (v <= 0n ? lendingErr("LENDING_AMOUNT_MUST_BE_POSITIVE") : ok(undefined));
  switch (x.type) {
    case "lending_fund": return chain(lendingParties(a, ctx.byLeft, x.positionId, "lend", x.lenderEntityId, x.hubEntityId), () => chain(positive(x.amount), (): BodyStep => {
      if (!LENDING_TERMS.has(x.termId)) return lendingErr("LENDING_INVALID_TERM");
      if (!interestOk(x.interestBps)) return lendingErr("LENDING_INVALID_INTEREST_BPS");
      const key = `fund:${lower(x.positionId)}`;
      return chain(unused(key), () => {
        // Only owned funds may fund the pool: unused own credit does not count (outCapacity already excludes holds and allowances).
        const d = a.account.deltas.get(x.tokenId);
        if (d === undefined || x.amount + ownCreditLeft(d, ctx.byLeft) > outCapacity(d, ctx.byLeft, holds(a, x.tokenId, ctx.byLeft))) return lendingErr("LENDING_FUND_OWNED_BALANCE_INSUFFICIENT");
        return pay(x.tokenId, x.amount, key, "fund");
      });
    }));
    case "lending_borrow_request": return chain(lendingParties(a, ctx.byLeft, x.requestId, "borrow", x.borrowerEntityId, x.hubEntityId), () => chain(positive(x.amount), (): BodyStep =>
      !LENDING_TERMS.has(x.termId) ? lendingErr("LENDING_INVALID_TERM") : !interestOk(x.maxInterestBps) ? lendingErr("LENDING_INVALID_INTEREST_BPS") : record(a, `borrow:${lower(x.requestId)}`, "borrow")));
    case "lending_repay": return chain(lendingParties(a, ctx.byLeft, x.loanId, "loan", x.borrowerEntityId, x.hubEntityId), () => chain(positive(x.amount), () => pay(x.tokenId, x.amount, `repay:${lower(x.loanId)}`, "repay")));
    case "lending_credit": return chain(lendingParties(a, ctx.byLeft, x.loanId, "loan", x.hubEntityId, x.borrowerEntityId), (): BodyStep => {
      if (x.creditLimit < 0n) return lendingErr("LENDING_CREDIT_LIMIT_NEGATIVE");
      return chain(updateDelta(a.account, x.tokenId, (d) => setCreditLimit(d, x.creditLimit, ctx.byLeft)), (s) =>
        record(putState(a, s), `${x.action === "grant" ? "grant" : "revoke"}:${lower(x.loanId)}`, x.action === "grant" ? "credit-grant" : "credit-revoke"));
    });
    case "lending_close_request": return chain(lendingParties(a, ctx.byLeft, x.positionId, "lend", x.lenderEntityId, x.hubEntityId), () => record(a, `close:${lower(x.positionId)}`, "close-request"));
    case "lending_close_payout": return chain(lendingParties(a, ctx.byLeft, x.positionId, "lend", x.hubEntityId, x.lenderEntityId), () => chain(positive(x.amount), () => pay(x.tokenId, x.amount, `payout:${lower(x.positionId)}`, "close-payout")));
  }
};
// ---- direct payment envelope: og handlers/balance/direct-payment.ts validatePaymentEnvelope/resolvePaymentParties/validatePaymentRoute ----
const MAX_ROUTE_HOPS = 100;
/** Absent route/deliveryMode is the rewrite's own bilateral payment: route [recipient], direct. */
const paymentRoute = (a: AccountBody, x: TxOf<"payment">, byLeft: boolean): Result<void, BodyError> => {
  const bad = (reason: string): Result<never, BodyError> => err({ _tag: "payment_route", reason });
  const from = (byLeft ? a.account.id.left : a.account.id.right).toLowerCase(), to = (byLeft ? a.account.id.right : a.account.id.left).toLowerCase();
  const route = x.route ?? [to], mode = x.deliveryMode ?? "direct", gateway = x.trustedGatewayEntityId;
  if (x.amount < 1n || x.amount > MAX_PAYMENT_AMOUNT) return err({ _tag: "non_positive_payment" });
  if (route.length === 0 || route.length > MAX_ROUTE_HOPS) return bad("ROUTE_LENGTH");
  if (mode !== "direct" && mode !== "trusted") return bad("DELIVERY_MODE");
  if (mode === "direct" && gateway !== undefined) return bad("DIRECT_WITH_GATEWAY");
  if (mode === "trusted" && !gateway) return bad("TRUSTED_WITHOUT_GATEWAY");
  if ((x.fromEntityId && x.fromEntityId.toLowerCase() !== from) || (x.toEntityId && x.toEntityId.toLowerCase() !== to)) return bad("DIRECTION");
  const is = (v: string | undefined, e: string): boolean => String(v || "").toLowerCase() === e;
  const onlyRecipient = route.length === 1 && is(route[0], to);
  if (mode === "direct") return onlyRecipient ? ok(undefined) : bad("DIRECT_ROUTE");
  const g = String(gateway).toLowerCase();
  if (from === g) return onlyRecipient ? ok(undefined) : bad("GATEWAY_FINAL_LEG");
  const final = String(route[1] || "").toLowerCase();
  return to === g && route.length === 2 && is(route[0], to) && final !== "" && final !== g && final !== from ? ok(undefined) : bad("TRUSTED_ROUTE");
};
// ---- cross-j pulls: og handlers/settlement/pull.ts ----
const MAX_ACCOUNT_CROSS_J_SWAP_OFFERS = 18;
const absBig = (v: bigint): bigint => (v < 0n ? -v : v);
const crossReject = (reason: string): Result<never, BodyError> => err({ _tag: "cross_j", reason });
const noteErr = <T,>(r: Result<T, CrossError>): Result<T, BodyError> => r;
/** og validateCrossJurisdictionPullRoute: a canonical, zero-progress resting route whose binding, pull terms, endpoints and stack match this Account. */
const pullRouteError = (a: AccountBody, x: TxOf<"cross_pull_lock">): Result<void, BodyError> => {
  const binding = x.crossJurisdiction, supplied = x.crossJurisdictionRoute;
  if (!binding || !supplied) return crossReject("CROSS_J_PULL_ROUTE_REQUIRED");
  const canonical = canonicalCrossRoute(supplied);
  if (!canonical.ok) return crossReject("CROSS_J_PULL_ROUTE_INVALID");
  const route = canonical.value;
  if (stableJson(route) !== stableJson(supplied)) return crossReject("CROSS_J_PULL_ROUTE_NOT_CANONICAL");
  const progressed = [route.sourceCloseProof, route.targetCloseProof, route.fillSeq, route.cumulativeFillRatio, route.fillNumerator, route.fillDenominator, route.filledSourceAmount, route.filledTargetAmount,
    route.pendingClearRequestedAt, route.claimedRatio, route.sourceClaimed, route.targetClaimed, route.settledAt].some((v) => v !== undefined);
  if (route.status !== "resting" || binding.status !== "resting" || progressed) return crossReject("CROSS_J_PULL_NOT_RESTING");
  if (binding.leg !== "source" && binding.leg !== "target") return crossReject("CROSS_J_PULL_LEG_INVALID");
  const expected = crossPullBinding(route, binding.leg);
  if (!expected.ok || stableJson(binding) !== stableJson(expected.value)) return crossReject("CROSS_J_PULL_BINDING_MISMATCH");
  const leg = binding.leg === "source" ? route.source : route.target, pull = binding.leg === "source" ? route.sourcePull : route.targetPull;
  if (pull === undefined || x.pullId !== pull.pullId || Number(x.tokenId) !== pull.tokenId || x.amount !== pull.signedAmount
    || x.fullHash.toLowerCase() !== pull.fullHash.toLowerCase() || x.partialRoot.toLowerCase() !== pull.partialRoot.toLowerCase()) return crossReject("CROSS_J_PULL_TERMS_MISMATCH");
  const ends = new Set([a.account.id.left.toLowerCase(), a.account.id.right.toLowerCase()]);
  if (!ends.has(leg.entityId.toLowerCase()) || !ends.has(leg.counterpartyEntityId.toLowerCase())) return crossReject("CROSS_J_PULL_ENDPOINTS");
  return stackIdOf(a.terms.domain) === leg.jurisdiction.toLowerCase() ? ok(undefined) : crossReject("CROSS_J_PULL_JURISDICTION");
};
/** og getPullLockAdmissionError: route, slot (id, uniqueness, 50 total, 18 cross-j), hash material, token, amount, payer capacity. */
const pullAdmission = (a: AccountBody, x: TxOf<"cross_pull_lock">): Result<void, BodyError> => chain(pullRouteError(a, x), (): Result<void, BodyError> => {
  const pulls = a.pulls ?? new Map<string, PullRow>();
  if (!x.pullId || x.pullId.includes(":")) return crossReject("CROSS_J_PULL_ID_INVALID");
  if (pulls.has(x.pullId)) return err({ _tag: "duplicate" });
  if (pulls.size >= MAX_ACCOUNT_SWAP_OFFERS) return crossReject("CROSS_J_PULL_LIMIT");
  if (x.crossJurisdiction && [...pulls.values()].filter((p) => p.crossJurisdiction).length >= MAX_ACCOUNT_CROSS_J_SWAP_OFFERS) return crossReject("CROSS_J_PULL_CROSS_LIMIT");
  if (!HEX32.test(x.fullHash) || !HEX32.test(x.partialRoot)) return crossReject("CROSS_J_PULL_HASH_INVALID");
  const orderId = String(x.crossJurisdiction?.orderId || "").trim(), fh = x.fullHash.toLowerCase(), pr = x.partialRoot.toLowerCase();
  for (const p of pulls.values()) {
    const other = String(p.crossJurisdiction?.orderId || "").trim();
    if (other && orderId && other === orderId) continue;
    if (p.fullHash.toLowerCase() === fh || p.partialRoot.toLowerCase() === pr) return crossReject("CROSS_J_PULL_HASH_COLLISION");
  }
  const tk = Number(x.tokenId);
  if (!Number.isSafeInteger(tk) || tk < 0 || tk > 65_535) return crossReject("CROSS_J_PULL_TOKEN_INVALID");
  if (x.amount === 0n) return crossReject("CROSS_J_PULL_AMOUNT_ZERO");
  const amount = absBig(x.amount);
  return amount > MAX_PAYMENT_AMOUNT ? crossReject("CROSS_J_PULL_AMOUNT_RANGE") : ensureRoom(a, x.tokenId, amount, x.amount < 0n);
});
/** og handlePullLock: admission, the payer-side hold (uint256), and the committed PullCommitment at the frame's jHeight. */
const crossPullLock = (a: AccountBody, x: TxOf<"cross_pull_lock">, ctx: FoldCtx): BodyStep => chain(pullAdmission(a, x), (): BodyStep => {
  const amount = absBig(x.amount), loserIsLeft = x.amount < 0n, totals = sideTotals(a, x.tokenId);
  if ((loserIsLeft ? totals.leftHold : totals.rightHold) + amount > MAX_PAYMENT_AMOUNT) return err({ _tag: "hold_overflow" });
  return map(noteErr(cloneCrossBinding(x.crossJurisdiction)), (crossJurisdiction) => {
    const row: PullRow = { pullId: x.pullId, tokenId: Number(x.tokenId), amount: x.amount, claimedRatio: 0, claimedAmount: 0n, fullHash: x.fullHash, partialRoot: x.partialRoot, crossJurisdiction, createdHeight: Number(ctx.jHeight), createdTimestamp: Number(ctx.nowMs) };
    return step({ ...a, pulls: mapSet(a.pulls ?? new Map<string, PullRow>(), x.pullId, row) });
  });
});
/** og validateCrossPullCloseEvidence: uint16 ratio, close mode, proof bound to this pull (chain-proportional leg amount), binary hash, and the hash-ladder reveal at exactly that ratio. */
const closeEvidence = (pull: PullRow, binding: CrossPullBinding, x: TxOf<"cross_pull_close">): Result<number, BodyError> => {
  const { binary, proof } = x;
  if (!Number.isSafeInteger(proof.fillRatio) || proof.fillRatio < 0 || proof.fillRatio > MAX_FILL) return crossReject("CROSS_J_CLOSE_RATIO_RANGE");
  if (proof.closeMode !== "full" && proof.closeMode !== "partial_cancel_remainder" && proof.closeMode !== "pure_cancel") return crossReject("CROSS_J_CLOSE_MODE_INVALID");
  if (proof.orderId !== binding.orderId || (proof.routeHash || "").toLowerCase() !== (binding.routeHash || "").toLowerCase()) return crossReject("CROSS_J_CLOSE_PROOF_MISMATCH");
  if ((binding.leg === "source" ? proof.sourcePullId : proof.targetPullId) !== pull.pullId) return crossReject("CROSS_J_CLOSE_PROOF_MISMATCH");
  const total = absBig(pull.amount), expected = proof.fillRatio >= MAX_FILL ? total : (total * BigInt(proof.fillRatio)) / BigInt(MAX_FILL);
  if ((binding.leg === "source" ? proof.cumulativeSourceAmount : proof.cumulativeTargetAmount) !== expected) return crossReject("CROSS_J_CLOSE_PROOF_MISMATCH");
  return chain(noteErr(crossCloseBinaryHash(binary)), (h) => h.toLowerCase() !== String(proof.binaryHash).toLowerCase() ? crossReject("CROSS_J_CLOSE_BINARY_HASH")
    : chain(noteErr(verifyHashLadderBinary({ fullHash: pull.fullHash, partialRoot: pull.partialRoot }, binary)), (d) => d.fillRatio === proof.fillRatio ? ok(proof.fillRatio) : crossReject("CROSS_J_CLOSE_RATIO_MISMATCH")));
};
/** og handleCrossPullClose: only the leg's Hub closes; the whole hold is released, the claimed part moves, and the source close retires its cross-j offer. */
const crossPullClose = (a: AccountBody, x: TxOf<"cross_pull_close">, ctx: FoldCtx): BodyStep => {
  const pull = a.pulls?.get(x.pullId);
  if (pull === undefined) return MISSING;
  const binding = pull.crossJurisdiction;
  if (!binding) return crossReject("CROSS_J_CLOSE_BINDING_MISSING");
  return chain(closeEvidence(pull, binding, x), (): BodyStep => {
    const beneficiaryIsLeft = pull.amount > 0n, hubIsLeft = binding.leg === "source" ? beneficiaryIsLeft : !beneficiaryIsLeft;
    if (ctx.byLeft !== hubIsLeft) return crossReject("CROSS_J_CLOSE_NOT_HUB");
    const tk = String(pull.tokenId) as TokenId, applied = binding.leg === "source" ? x.proof.cumulativeSourceAmount : x.proof.cumulativeTargetAmount;
    const released: AccountBody = { ...a, pulls: mapDelete(a.pulls ?? new Map<string, PullRow>(), x.pullId) };
    const moved = applied > 0n ? shift(getDelta(a.account, tk), beneficiaryIsLeft ? applied : -applied) : getDelta(a.account, tk);
    return map(representable(released, moved), () => {
      const next = putState(released, setDelta(a.account, moved)), offer = binding.leg === "source" ? next.offers.get(binding.orderId) : undefined;
      return step(offer?.crossJurisdiction !== undefined ? { ...next, offers: mapDelete(next.offers, binding.orderId) } : next);
    });
  });
};
/** og direct-payment.ts buildPaymentForward: a trusted payer->gateway leg (route [gateway, final]) asks the gateway, and only it, to forward to the final recipient. */
const paymentForward = (x: TxOf<"payment">): readonly Of<Effect, "direct_payment_forward">[] =>
  x.route === undefined || x.route.length <= 1 || x.trustedGatewayEntityId === undefined ? []
  : [{ _tag: "direct_payment_forward", tokenId: Number(x.tokenId), amount: x.amount, route: [...x.route], ...(x.description ? { description: x.description } : {}), trustedGatewayEntityId: x.trustedGatewayEntityId }];
type Arms = { readonly [K in AccountTx["type"]]: (tx: WireTxOf<K>) => BodyStep<EffectOf<K>> };
const applyArm = (a: AccountBody, tx: WireAccountTx, ctx: FoldCtx): BodyStep<Effect> => matchBy<"type", WireAccountTx, BodyStep<Effect>>("type", tx, {

  add_delta: (x) => ok(step(a.account.deltas.has(x.tokenId) ? a : putState(a, setDelta(a.account, zeroDelta(x.tokenId))))),
  set_credit_limit: (x) => map(updateDelta(a.account, x.tokenId, (d) => setCreditLimit(d, x.limit, ctx.byLeft)), (s) => step(putState(a, s))),
  payment: (x) => chain(paymentRoute(a, x, ctx.byLeft), () => map(spend(a, x.tokenId, x.amount, ctx.byLeft), (b) => step(b, paymentForward(x)))),
  htlc_lock: (x) => {
    // og handlers/htlc/lock.ts:32-52,71-81,95-116 in order: identity, expiry, amount, 32-lock cap, capacity, int512 range, uint256 hold.
    if (x.lockId !== x.hashlock) return err({ _tag: "lock_id" });
    if (a.locks.has(x.lockId)) return err({ _tag: "duplicate" });
    if (ctx.nowMs >= x.timelock || x.revealBeforeHeight <= ctx.jHeight) return err({ _tag: "htlc_expired" });
    if (x.amount < 1n || x.amount > MAX_PAYMENT_AMOUNT) return err({ _tag: "non_positive_payment" });
    if (a.locks.size >= MAX_ACCOUNT_HTLC_LOCKS) return err({ _tag: "htlc_lock_capacity" });
    // og lock.ts: an envelope must be an opaque encrypted layer; the Account commits only its hash.
    const envelopeHash = x.envelope === undefined ? undefined : htlcEnvelopeHash(x.envelope);
    if (envelopeHash === null) return err({ _tag: "htlc_envelope" });
    const totals = sideTotals(a, x.tokenId), held = ctx.byLeft ? totals.leftHold : totals.rightHold;
    return chain(ensureRoom(a, x.tokenId, x.amount, ctx.byLeft), () => chain(representable(a, getDelta(a.account, x.tokenId), { senderIsLeft: ctx.byLeft, amount: x.amount }), () =>
      held + x.amount > MAX_PAYMENT_AMOUNT ? err({ _tag: "hold_overflow" }) : ok(step({ ...a, locks: mapSet(a.locks, x.lockId, {
        lockId: x.lockId, hashlock: x.hashlock, timelock: x.timelock, revealBeforeHeight: x.revealBeforeHeight, amount: x.amount, tokenId: x.tokenId,
        senderIsLeft: ctx.byLeft, createdHeight: floor0(ctx.accountHeight - 1n), createdTimestamp: ctx.nowMs, ...opt("envelopeHash", envelopeHash),
      }) }))));
  },
  htlc_resolve: (x) => {
    // og handlers/htlc/resolve.ts: a secret pays only before expiry; an error refund is the beneficiary's any time, the payer's after expiry.
    const live = a.locks.get(x.lockId);
    if (live === undefined || !a.account.deltas.has(live.tokenId)) return MISSING;
    const expired = htlcExpired(live, ctx);
    if (x.outcome === "error") {
      const beneficiary = ctx.byLeft !== live.senderIsLeft;
      if (!beneficiary && !expired) return err({ _tag: "before_deadline" });
      return x.reason === "timeout" && !expired ? err({ _tag: "before_deadline" })
        : ok(step({ ...a, locks: mapDelete(a.locks, x.lockId) }, [{ _tag: "htlc_error", lockId: live.lockId, hashlock: live.hashlock, tokenId: Number(live.tokenId), amount: live.amount, ...opt("reason", x.reason) }]));
    }
    if (expired) return err({ _tag: "htlc_expired" });
    if (hashHtlcSecret(x.secret) !== live.hashlock) return err({ _tag: "preimage" });
    return chain(offdeltaChange(live.senderIsLeft, live.amount), (by) => {
      const released: AccountBody = { ...a, locks: mapDelete(a.locks, x.lockId) }, moved = shift(getDelta(a.account, live.tokenId), by);
      return map(representable(released, moved), () => step(putState(released, setDelta(a.account, moved)), [{ _tag: "forward_secret", hashlock: live.hashlock, secret: x.secret }]));
    });
  },
  swap_offer: (x) => swapOffer(a, x, ctx),
  swap_cancel_request: (x) => {
    // og lifecycle/cancel.ts: the maker only requests; the offer and its hold stay until the counterparty's swap_resolve.
    const offer = a.offers.get(x.offerId);
    return offer === undefined ? MISSING : ctx.byLeft !== offer.makerIsLeft ? err({ _tag: "not_maker" }) : ok(step(a, [{ _tag: "swap_cancel_requested", offerId: x.offerId }]));
  },
  swap_resolve: (x) => swapResolve(a, x, ctx),
  request_collateral: (x) => requestCollateral(a, x, ctx),
  rebalance_refund: (x) => rebalanceRefund(a, x, ctx),
  rebalance_policy: (x) => rebalancePolicy(a, x, ctx),
  lending_fund: (x) => lending(a, x, ctx), lending_borrow_request: (x) => lending(a, x, ctx), lending_repay: (x) => lending(a, x, ctx),
  lending_credit: (x) => lending(a, x, ctx), lending_close_request: (x) => lending(a, x, ctx), lending_close_payout: (x) => lending(a, x, ctx),
  cross_pull_lock: (x) => crossPullLock(a, x, ctx),
  cross_pull_close: (x) => crossPullClose(a, x, ctx),
  j_event_claim: (x) => claimJ(a, x, ctx),
  settle_transition: (x) => settleTransition(a, x, ctx),
} satisfies Arms);
const one = (x: { readonly tokenId: TokenId }): readonly string[] => [x.tokenId], none = (): readonly string[] => [];
const namedTokens = (tx: WireAccountTx): readonly string[] => matchBy("type", tx, {
  add_delta: one, set_credit_limit: one, payment: one, htlc_lock: one, htlc_resolve: none, swap_offer: (x) => [x.giveTokenId, x.wantTokenId], swap_cancel_request: none, swap_resolve: (x) => (x.feeTokenId === undefined ? [] : [x.feeTokenId]),
  request_collateral: (x) => (x.feeTokenId === undefined ? [x.tokenId] : [x.tokenId, x.feeTokenId]), rebalance_refund: (x) => [x.requestTokenId], rebalance_policy: one,
  lending_fund: one, lending_borrow_request: one, lending_repay: one, lending_credit: one, lending_close_request: none, lending_close_payout: one,
  cross_pull_lock: one, cross_pull_close: none, j_event_claim: (x) => x.events.flatMap((row) => row.tokens.map((tk) => tk.tokenId.toString())), settle_transition: none,
});
const commits = (before: AccountBody, tx: WireAccountTx, next: AccountStep): BodyStep<Effect> =>
  chain(mapErr(prepareStep(before, next.state), uncommitted), () => map(mapErr(isL0Tx(tx) ? ok(undefined) : txRefusal(wireOf(tx)), uncommitted), () => next));
export const applyAccountBody: Layer<AccountBody, WireAccountTx, FoldCtx, Effect, BodyError> = (a, tx, ctx) => {
  const frozen = settlementFreeze(a, tx);
  if (!frozen.ok) return frozen;
  const unfit = namedTokens(tx).find((n) => !tokenId(n).ok);
  if (unfit !== undefined) return err({ _tag: "token_id", tokenId: unfit });
  return chain(applyArm(a, tx, ctx), (next) => (next.state.account.deltas.size > MAX_ROWS ? err({ _tag: "too_many_rows" }) : commits(a, tx, next)));
};
export const accountSnapshot = (a: AccountBody): Required<Omit<AccountBody, "account">> & { readonly state: Hash } =>
  ({ state: hashAccountState(a.account), terms: a.terms, locks: a.locks, offers: a.offers, requested: a.requested, requestFees: a.requestFees, feePolicies: a.feePolicies, lendingIntents: a.lendingIntents, claimRows: a.claimRows, jNonce: a.jNonce, settlement: a.settlement, finalizedJHeight: a.finalizedJHeight, pulls: a.pulls, submittedAt: a.submittedAt });


export type ViewError = CommitmentError | Tagged<"token_id", { tokenId: TokenId }> | ClaimError;
export type UncommittedReason = ViewError | FrameHashError | Tagged<"unsafe_number">;
export type Uncommitted = Tagged<"uncommitted", { reason: UncommittedReason }>;
export const uncommitted = (reason: UncommittedReason): Uncommitted => ({ _tag: "uncommitted", reason });
export const tokenNumber = (id: TokenId): Result<number, ViewError> => (tokenId(id).ok ? ok(Number(id)) : err({ _tag: "token_id", tokenId: id }));
export const tokenOrder = (b: AccountBody): readonly TokenId[] => [...b.account.deltas.keys()].sort((x, y) => Number(x) - Number(y));
const EMPTY_J_CLAIMS: JClaimAccumulator = { version: 1, root: EMPTY_J_ROOT, count: 0n };
const CLAIM_ACCOUNT = keccak256Hex(utf8("xln.account-j-claim.account.v1")), CLAIM_KEY = keccak256Hex(utf8("xln.account-j-claim.key.v1")), CLAIM_RECORD = keccak256Hex(utf8("xln.account-j-claim.record.v1")), CLAIM_LEAF = keccak256Hex(utf8("xln.account-j-claim.leaf.v1")), CLAIM_BRANCH = keccak256Hex(utf8("xln.account-j-claim.branch.v1"));
type ClaimLeaf = { readonly key: string; readonly record: string; readonly rec: JClaimRecord };
type ClaimNode = Tagged<"leaf", ClaimLeaf> | Tagged<"branch", { bit: number; left: ClaimNode; right: ClaimNode }>;
const claimBit = (key: string, index: number): 0 | 1 => ((Number.parseInt(key.slice(2 + (index >> 3) * 2, 4 + (index >> 3) * 2), 16) >> (7 - (index & 7))) & 1) === 0 ? 0 : 1;
const claimAccountKey = (domain: Domain, left: string, right: string): string => keccak256Hex(abiEncode([A.b32(CLAIM_ACCOUNT), A.uint(BigInt(domain.chainId)), A.address(domain.depositoryAddress), A.b32(left), A.b32(right)]));
const claimLeaf = (accountKey: string, row: ClaimRow): ClaimLeaf => {
  const side = row.onLeft ? 0n : 1n;
  return {
    key: keccak256Hex(abiEncode([A.b32(CLAIM_KEY), A.b32(accountKey), A.uint(side), A.uint(row.jHeight)])), record: keccak256Hex(abiEncode([A.b32(CLAIM_RECORD), A.b32(accountKey), A.uint(side), A.uint(row.jHeight), A.b32(row.jBlockHash), A.b32(row.eventsHash)])),
    rec: { version: 1, accountKey: accountKey.toLowerCase(), side: row.onLeft ? "left" : "right", jHeight: Number(row.jHeight), jBlockHash: row.jBlockHash, eventsHash: row.eventsHash },
  };
};
const claimNodeHash = (node: ClaimNode): string => match(node, {
  leaf: ({ key, record }) => keccak256Hex(abiEncode([A.b32(CLAIM_LEAF), A.uint(1n), A.b32(key), A.b32(record)])),
  branch: ({ bit, left, right }) => keccak256Hex(abiEncode([A.b32(CLAIM_BRANCH), A.uint(1n), A.uint(BigInt(bit)), A.b32(claimNodeHash(left)), A.b32(claimNodeHash(right))])),
});
const claimTerminal = (node: ClaimNode, key: string): Of<ClaimNode, "leaf"> => match(node, { leaf: (leaf) => leaf, branch: (b) => claimTerminal(claimBit(key, b.bit) === 0 ? b.left : b.right, key) });
const claimPlace = (diff: number, key: string, leaf: Of<ClaimNode, "leaf">, other: ClaimNode): ClaimNode =>
  ({ _tag: "branch", bit: diff, left: claimBit(key, diff) === 0 ? leaf : other, right: claimBit(key, diff) === 1 ? leaf : other });
const claimInsertAt = (node: ClaimNode, key: string, leaf: Of<ClaimNode, "leaf">, diff: number): ClaimNode => match(node, {
  leaf: () => claimPlace(diff, key, leaf, node),
  branch: (b) => (b.bit >= diff ? claimPlace(diff, key, leaf, node) : { ...b, ...(claimBit(key, b.bit) === 0 ? { left: claimInsertAt(b.left, key, leaf, diff) } : { right: claimInsertAt(b.right, key, leaf, diff) }) }),
});
const insertClaim = (node: ClaimNode, leaf: ClaimLeaf): Result<ClaimNode, ClaimError> => {
  const term = claimTerminal(node, leaf.key);
  if (term.key === leaf.key) return term.record === leaf.record ? ok(node) : err({ _tag: "claim_conflict" });
  let diff = -1;
  for (let i = 0; i < 256; i++) if (claimBit(leaf.key, i) !== claimBit(term.key, i)) { diff = i; break; }
  return diff < 0 ? err({ _tag: "claim_conflict" }) : ok(claimInsertAt(node, leaf.key, { _tag: "leaf", ...leaf }, diff));
};
/** og's crit-bit Patricia trie is canonical in its key set, so any insertion order rebuilds the committed node structure. */
const claimTree = (accountKey: string, rows: readonly ClaimRow[]): Result<ClaimNode | undefined, ClaimError> => foldResult<ClaimNode | undefined, ClaimRow, ClaimError>(rows, undefined, (node, row) => {
  const leaf = claimLeaf(accountKey, row);
  return node === undefined ? ok({ _tag: "leaf", ...leaf }) : insertClaim(node, leaf);
});
const claimAccumulator = (accountKey: string, rows: readonly ClaimRow[]): Result<JClaimAccumulator, ClaimError> =>
  map(claimTree(accountKey, rows), (node) => (node === undefined ? EMPTY_J_CLAIMS : { version: 1, root: claimNodeHash(node), count: BigInt(rows.length) }));
/** og j-claim-proof.ts createAccountJClaimProof: every node from the root down the key's bit path to the terminal leaf. */
const claimPath = (node: ClaimNode, key: string): readonly JClaimNode[] => match(node, {
  leaf: ({ key: k, rec }): readonly JClaimNode[] => [{ version: 1, type: "leaf", key: k, record: rec }],
  branch: ({ bit, left, right }): readonly JClaimNode[] => [{ version: 1, type: "branch", bit, left: claimNodeHash(left), right: claimNodeHash(right) }, ...claimPath(claimBit(key, bit) === 0 ? left : right, key)],
});
const claimKeyOf = (b: Pick<AccountBody, "account" | "terms">): Result<string, ViewError> => {
  const { left, right } = b.account.id;
  if (!WORD.test(left) || !WORD.test(right)) return err({ _tag: "claim_entity" });
  return map(domainOf(b.terms.domain), (domain) => claimAccountKey(domain, left.toLowerCase(), right.toLowerCase()));
};
const pendingOn = (b: AccountBody, onLeft: boolean): Result<JClaimAccumulator, ViewError> => {
  const rows = (b.claimRows ?? []).filter((r) => r.onLeft === onLeft);
  if (rows.length === 0) return ok(EMPTY_J_CLAIMS);
  return chain(claimKeyOf(b), (accountKey) => claimAccumulator(accountKey, rows));
};
export type SideTotals = { readonly leftHold: bigint; readonly rightHold: bigint; readonly leftAllowance: bigint; readonly rightAllowance: bigint };
const NO_TOTALS: SideTotals = { leftHold: 0n, rightHold: 0n, leftAllowance: 0n, rightAllowance: 0n };
const totalsOn = (b: AccountBody, counted: (id: TokenId) => boolean): ReadonlyMap<TokenId, SideTotals> => {
  const totals = new Map<TokenId, { -readonly [K in keyof SideTotals]: bigint }>();
  const on = (id: TokenId) => { const held = totals.get(id); if (held !== undefined) return held; const fresh = { ...NO_TOTALS }; totals.set(id, fresh); return fresh; };
  const holdOn = (id: TokenId, onLeft: boolean, n: bigint): void => { const s = on(id); if (onLeft) s.leftHold += n; else s.rightHold += n; };
  for (const l of b.locks.values()) if (counted(l.tokenId)) holdOn(l.tokenId, l.senderIsLeft, l.amount);
  // og commit.ts: a cross-j offer adds no hold (its source pull already owns the lock); a pull holds |amount| on the payer side.
  for (const o of b.offers.values()) if (o.crossJurisdiction === undefined && counted(o.giveTokenId)) holdOn(o.giveTokenId, o.makerIsLeft, o.giveAmount);
  for (const p of b.pulls?.values() ?? []) { const id = String(p.tokenId) as TokenId; if (counted(id)) holdOn(id, p.amount < 0n, p.amount < 0n ? -p.amount : p.amount); }
  if (b.settlement !== undefined && b.settlement.status !== "submitted") for (const d of workspaceDiffs(b.settlement)) {
    const id = String(d.tokenId) as TokenId;
    if (!counted(id)) continue;
    if (d.leftDiff < 0n) holdOn(id, true, -d.leftDiff);
    if (d.rightDiff < 0n) holdOn(id, false, -d.rightDiff);
  }
  return totals;
};
export const sideTotals = (b: AccountBody, tk: TokenId): SideTotals => totalsOn(b, (id) => id === tk).get(tk) ?? NO_TOTALS;
const byToken = <V>(rows: Iterable<readonly [TokenId, V]>): ReadonlyMap<number, V> => new Map([...rows].map(([id, v]) => [Number(id), v]));
const committedDeltas = (b: AccountBody): ReadonlyMap<number, CommittedDelta> => {
  const totals = totalsOn(b, () => true);
  return byToken([...b.account.deltas.values()].map((d): readonly [TokenId, CommittedDelta] => {
    const s = totals.get(d.tokenId) ?? NO_TOTALS;
    return [d.tokenId, { tokenId: Number(d.tokenId), collateral: d.collateral, ondelta: d.ondelta, offdelta: d.offdelta, leftCreditLimit: d.leftCreditLimit, rightCreditLimit: d.rightCreditLimit, leftAllowance: s.leftAllowance, rightAllowance: s.rightAllowance, leftHold: s.leftHold, rightHold: s.rightHold }];
  }));
};
const project = (b: AccountBody): Result<CommittedAccountState, ViewError> => {
  const height = b.finalizedJHeight;
  if (height < 0n || height > BigInt(Number.MAX_SAFE_INTEGER)) return err({ _tag: "bad_j_claims" });
  const keys = [...b.account.deltas.keys(), ...b.requested.keys(), ...b.requestFees.keys(), ...b.feePolicies.keys()];
  return chain(traverse(keys, tokenNumber), () => chain(all({ left: pendingOn(b, true), right: pendingOn(b, false) }), ({ left, right }) => {
    const { terms } = b;
    return ok({
      domain: terms.domain, leftEntity: b.account.id.left, rightEntity: b.account.id.right, watchSeed: terms.watchSeed, disputeConfig: terms.disputeConfig,
      jNonce: b.jNonce, lastFinalizedJHeight: Number(height), leftPendingJClaims: left, rightPendingJClaims: right,
      deltas: committedDeltas(b), locks: new Map([...b.locks].map(([id, l]) => [id, ogLockRow(l)])), pulls: b.pulls ?? new Map(), swapOffers: new Map([...b.offers].map(([id, o]) => [id, { ...o, giveTokenId: Number(o.giveTokenId), wantTokenId: Number(o.wantTokenId) }])), subcontracts: new Map(), lendingIntents: b.lendingIntents,
      requestedRebalance: byToken(b.requested), requestedRebalanceFeeState: byToken(b.requestFees), rebalanceFeePolicies: byToken(b.feePolicies), settlementWorkspace: b.settlement,
    });
  }));
};
const views = new WeakMap<AccountBody, Result<CommittedAccountState, ViewError>>();
const preparedBodies = new WeakSet<AccountBody>();
export const committedView = (b: AccountBody): Result<CommittedAccountState, ViewError> => { const held = views.get(b); if (held !== undefined) return held; const v = project(b); views.set(b, v); return v; };
export const prepareCommitment = (b: AccountBody): Result<PreparedCommitment, ViewError> => chain(committedView(b), (v) => map(prepareState(v), (p) => { preparedBodies.add(b); return p; }));
export const prepareStep = (before: AccountBody, after: AccountBody): Result<void, ViewError> => chain(committedView(after), (next) => {
  const was = preparedBodies.has(before) ? committedView(before) : undefined;
  return map(was?.ok === true ? prepareChanges(was.value, next) : map(prepareState(next), () => undefined), () => { preparedBodies.add(after); });
});
export type Committed = { readonly view: CommittedAccountState; readonly root: string };
export const committed = (b: AccountBody): Result<Committed, ViewError> => chain(prepareCommitment(b), (p) => map(preparedRoot(p), (root) => ({ view: p.state, root })));
export const committedRoot = (b: AccountBody): Result<string, ViewError> => map(committed(b), (c) => c.root);


export type ProofError = Tagged<"transformers_unported" | "bad_watch_seed" | "bad_dispute_config" | "offdelta_beyond_money" | "final_delta_overflow" | "final_delta_int256_min" | "too_many_tokens" | "bad_domain" | "bad_entity" | "bad_nonce" | "bad_hash">;
const MAX_MONEY = 1n << 200n, MAX_PROOF_TOKENS = 128;
const inInt256 = (n: bigint): boolean => n >= INT256_MIN && n <= INT256_MAX;
export const accountProofBody = (s: CommittedAccountState): Result<ProofBody, ProofError> => {
  if ([s.locks, s.pulls, s.swapOffers, s.subcontracts].some((m) => m.size > 0)) return err({ _tag: "transformers_unported" });
  if (!WORD.test(s.watchSeed)) return err({ _tag: "bad_watch_seed" });
  const { leftResponseSeconds: left, rightResponseSeconds: right } = s.disputeConfig;
  const uint32 = (n: number): boolean => Number.isInteger(n) && n >= 0 && n <= 0xffff_ffff;
  if (!uint32(left) || !uint32(right)) return err({ _tag: "bad_dispute_config" });
  const rows = [...s.deltas.values()].sort((x, y) => x.tokenId - y.tokenId);
  for (const r of rows) {
    if (!inInt256(r.ondelta) || !inInt256(r.offdelta)) return err({ _tag: "final_delta_overflow" });
    if (r.offdelta > MAX_MONEY || r.offdelta < -MAX_MONEY) return err({ _tag: "offdelta_beyond_money" });
    const final = r.ondelta + r.offdelta;
    if (!inInt256(final)) return err({ _tag: "final_delta_overflow" });
    if (final === INT256_MIN) return err({ _tag: "final_delta_int256_min" });
  }
  if (rows.length > MAX_PROOF_TOKENS) return err({ _tag: "too_many_tokens" });
  return ok({ watchSeed: s.watchSeed.toLowerCase(), leftResponseSeconds: BigInt(left), rightResponseSeconds: BigInt(right), offdeltas: rows.map((r) => r.offdelta), tokenIds: rows.map((r) => BigInt(r.tokenId)), transformers: [] });
};
export const proofBodyHash = (b: ProofBody): string => keccak256Hex(hexToBytes(encodeProofBodyBytes(b)));
const BYTES32 = /^0[xX][0-9a-fA-F]{64}$/;
export const accountDisputeHash = (s: CommittedAccountState, bodyHash: string, nonce: number, proposerIsLeftFlag: boolean): Result<string, ProofError> => {
  const domain = domainOf(s.domain);
  if (!domain.ok || /^0x0{40}$/.test(domain.value.depositoryAddress)) return err({ _tag: "bad_domain" });
  if (!BYTES32.test(s.leftEntity) || !BYTES32.test(s.rightEntity)) return err({ _tag: "bad_entity" });
  if (!Number.isSafeInteger(nonce) || nonce < 0) return err({ _tag: "bad_nonce" });
  if (!BYTES32.test(bodyHash)) return err({ _tag: "bad_hash" });
  if (!BYTES32.test(s.watchSeed)) return err({ _tag: "bad_watch_seed" });
  return ok(encodeDisputeProofHash({
    messageType: 1, chainId: domain.value.chainId, contractAddress: domain.value.depositoryAddress, accountKey: encodeAccountKey({ e1: s.leftEntity.toLowerCase(), e2: s.rightEntity.toLowerCase() }).lesserThenGreater,
    nonce: String(nonce), proposerIsLeft: proposerIsLeftFlag, proofbodyHash: bodyHash.toLowerCase(), watchSeed: s.watchSeed.toLowerCase(),
  }));
};
export type DisputeHanko = { readonly hanko: string; readonly hash: string; readonly proofBodyHash: string; readonly proofNonce: number; readonly proposerIsLeft: boolean };
export type DisputeDraft = Omit<DisputeHanko, "hanko">;
export type DisputeWitnesses = { readonly nextProofNonce: number; readonly current?: DisputeHanko | undefined; readonly counterparty?: DisputeHanko | undefined };
export const genesisWitnesses = (): DisputeWitnesses => ({ nextProofNonce: 1 });
/** og operations.ts getMinimumSafeSettlementNonce, replica cursors: every locally known signed proof nonce is spent (the body adds jNonce + 1). */
export const proofNonceFloor = (w: DisputeWitnesses): number => Math.max(w.nextProofNonce, (w.current?.proofNonce ?? 0) + 1, (w.counterparty?.proofNonce ?? 0) + 1);
export const settlementOf = (w: DisputeWitnesses, verify: Verify): SettlementCtx => ({ verify, proofNonceFloor: proofNonceFloor(w) });
export type DisputePlan = Tagged<"sign", { draft: DisputeDraft }> | Tagged<"resend", { disputeHanko: DisputeHanko }> | Tagged<"none">;
export type DisputeReason = "hanko_missing" | "shape" | "hash_mismatch" | "hanko_invalid" | "unexpected" | "nonce_finalized" | "nonce_regression" | "nonce_reuse" | "body_mismatch" | "required" | "draft_mismatch";
export type DisputeError = Tagged<"dispute_hanko", { reason: DisputeReason }> | Tagged<"dispute_proof", { error: ProofError | ViewError }>;
const refuseDispute = (reason: DisputeReason): DisputeError => ({ _tag: "dispute_hanko", reason });
const asProof = <X>(r: Result<X, ProofError | ViewError>): Result<X, DisputeError> => mapErr(r, (error): DisputeError => ({ _tag: "dispute_proof", error }));
/** og securityContext.verifyHanko authority: `allowPreviousBoard` admits the immediately previous board within its grace window (ACK and replay paths only, never a fresh proposal); `registeredBoardHash` pins the certified board. */
export type HankoAuthority = { readonly allowPreviousBoard: boolean; readonly registeredBoardHash?: string | undefined };
export type Verify = (digest: string, hanko: string, entity: EntityId, authority?: HankoAuthority) => boolean;
export type Omission = Tagged<"locks" | "pulls" | "swapOffers" | "subcontracts", { count: number }>;
export type Omitted = readonly [Omission, ...Omission[]];
export type LocalProof = Tagged<"complete", { body: ProofBody; bodyHash: string; jNonce: number }> | Tagged<"partial", { bodyHash: string; jNonce: number; omitted: Omitted }>;
export type CompleteProof = Of<LocalProof, "complete">;
const ENCUMBRANCES = ["locks", "pulls", "swapOffers", "subcontracts"] as const;
const proofOf = (view: CommittedAccountState): Result<LocalProof, ProofError> => {
  const [first, ...rest] = ENCUMBRANCES.flatMap((_tag): Omission[] => (view[_tag].size > 0 ? [{ _tag, count: view[_tag].size }] : []));
  const none = new Map<number | string, unknown>();
  return map(accountProofBody(first === undefined ? view : { ...view, locks: none, pulls: none, swapOffers: none, subcontracts: none }), (body): LocalProof => {
    const bodyHash = proofBodyHash(body), { jNonce } = view;
    return first === undefined ? { _tag: "complete", body, bodyHash, jNonce } : { _tag: "partial", bodyHash, jNonce, omitted: [first, ...rest] };
  });
};
export const localProof = (view: CommittedAccountState): Result<LocalProof, DisputeError> => asProof(proofOf(view));
export type StartRefusal = Tagged<"no_witness" | "body_mismatch" | "nonce_stale" | "hash_mismatch" | "hanko_invalid"> | Tagged<"omits", { omitted: Omitted }> | Tagged<"proof", { error: ProofError | ViewError }>;
export const disputeStart = (view: CommittedAccountState, proof: CompleteProof, w: DisputeHanko, peer: EntityId, verify: Verify): Result<DisputeStart, StartRefusal> => {
  if (!sameHex(proof.bodyHash, w.proofBodyHash)) return err({ _tag: "body_mismatch" });
  if (w.proofNonce <= 0 || w.proofNonce <= proof.jNonce) return err({ _tag: "nonce_stale" });
  return chain(mapErr(accountDisputeHash(view, w.proofBodyHash, w.proofNonce, w.proposerIsLeft), (error): StartRefusal => ({ _tag: "proof", error })), (h): Result<DisputeStart, StartRefusal> =>
    !sameHex(h, w.hash) ? err({ _tag: "hash_mismatch" }) : !verify(h, w.hanko, peer) ? err({ _tag: "hanko_invalid" }) : ok({
      counterentity: peer, nonce: BigInt(w.proofNonce), proposerIsLeft: w.proposerIsLeft, proofbodyHash: w.proofBodyHash, initialProofbody: proof.body, watchSeed: proof.body.watchSeed, sig: w.hanko,
      starterInitialArguments: "0x", starterCounterArguments: "0x", starterCounterProofCommitment: ZERO_WORD,
    }));
};
export const startOf = (body: AccountBody, witnesses: DisputeWitnesses, peer: EntityId, verify: Verify): Result<DisputeStart, StartRefusal> => {
  const w = witnesses.counterparty;
  if (w === undefined) return err({ _tag: "no_witness" });
  const asRefusal = <X>(r: Result<X, ProofError | ViewError>): Result<X, StartRefusal> => mapErr(r, (error): StartRefusal => ({ _tag: "proof", error }));
  return chain(asRefusal(committedView(body)), (view) => chain(asRefusal(proofOf(view)), (proof) => match(proof, {
    partial: ({ omitted }): Result<DisputeStart, StartRefusal> => err({ _tag: "omits", omitted }), complete: (c): Result<DisputeStart, StartRefusal> => disputeStart(view, c, w, peer, verify),
  })));
};
const draftPlan = (view: CommittedAccountState, bodyHash: string, nonce: number, proposerIsLeftFlag: boolean): Result<DisputePlan, DisputeError> =>
  map(asProof(accountDisputeHash(view, bodyHash, nonce, proposerIsLeftFlag)), (h) => ({ _tag: "sign", draft: { hash: h, proofBodyHash: bodyHash, proofNonce: nonce, proposerIsLeft: proposerIsLeftFlag } }));
export const proposalPlan = (view: CommittedAccountState, proof: LocalProof, witnesses: DisputeWitnesses, proposerIsLeftFlag: boolean): Result<DisputePlan, DisputeError> => {
  const { bodyHash, jNonce } = proof, { current } = witnesses;
  if (!sameHex(bodyHash, current?.proofBodyHash) || (current?.proofNonce ?? 0) <= jNonce) return draftPlan(view, bodyHash, Math.max(witnesses.nextProofNonce, jNonce + 1), proposerIsLeftFlag);

  return ok(current !== undefined && current.proposerIsLeft === proposerIsLeftFlag ? { _tag: "resend", disputeHanko: current } : { _tag: "none" });
};
type AckedFrame = { readonly candidate: { readonly draft: { readonly state: AccountBody }; readonly frameProof: LocalProof }; readonly dispute: DisputeWitnesses };
export const ackPlan = (held: AckedFrame, proposerIsLeftFlag: boolean): Result<DisputePlan, DisputeError> => {
  const { candidate: { draft, frameProof: { bodyHash, jNonce } }, dispute: witnesses } = held, { current } = witnesses;
  const changed = !sameHex(bodyHash, current?.proofBodyHash) || current?.proposerIsLeft !== proposerIsLeftFlag || (current?.proofNonce ?? 0) <= jNonce;
  if (!changed && current !== undefined) return ok({ _tag: "resend", disputeHanko: current });
  return chain(asProof(committedView(draft.state)), (view) => draftPlan(view, bodyHash, Math.max(witnesses.nextProofNonce, jNonce + 1), proposerIsLeftFlag));
};
const sameDraft = (a: DisputeDraft, b: DisputeDraft): boolean => a.hash === b.hash && a.proofBodyHash === b.proofBodyHash && a.proofNonce === b.proofNonce && a.proposerIsLeft === b.proposerIsLeft;
export type Settled = { readonly carried: DisputeHanko | undefined; readonly witnesses: DisputeWitnesses };
export const settleLocal = (plan: DisputePlan, given: DisputeHanko | undefined, witnesses: DisputeWitnesses, self: EntityId, verify: Verify): Result<Settled, DisputeError> => match(plan, {
  sign: ({ draft }): Result<Settled, DisputeError> => {
    if (given === undefined) return err(refuseDispute("required"));
    if (!sameDraft(given, draft)) return err(refuseDispute("draft_mismatch"));
    if (!verify(draft.hash, given.hanko, self)) return err(refuseDispute("hanko_invalid"));
    const signed: DisputeHanko = { ...draft, hanko: given.hanko };
    return ok({ carried: signed, witnesses: { ...witnesses, current: signed, nextProofNonce: draft.proofNonce + 1 } });
  },
  resend: ({ disputeHanko }): Result<Settled, DisputeError> =>
    given === undefined ? err(refuseDispute("required")) : given.hanko === disputeHanko.hanko && sameDraft(given, disputeHanko) ? ok({ carried: disputeHanko, witnesses }) : err(refuseDispute("draft_mismatch")),
  none: (): Result<Settled, DisputeError> => (given === undefined ? ok({ carried: undefined, witnesses }) : err(refuseDispute("unexpected"))),
});
/** og finality.ts activatePostSettlementProof, replica side: the frame whose J claim finalizes the signed settlement nonce promotes both N+1 hankos
 * into the dispute witnesses (an equal nonce must be the same proof) and moves the proof cursor past everything spent.
 * `finalized` lists each finalizing claim's reached nonce in frame order: the first to reach the signed nonce decides, even when a later claim of the same frame finalizes past it. */
export const promoteSettled = (w: DisputeWitnesses, pre: AccountBody, post: AccountBody, localIsLeft: boolean, finalized: readonly number[] = post.jNonce !== pre.jNonce ? [post.jNonce] : []): Result<DisputeWitnesses, DisputeError> => {
  const ws = pre.settlement, p = ws?.postSettlementDisputeProof, signed = ws?.nonceAtSign, reached = signed === undefined ? undefined : finalized.find((n) => n >= signed);
  if (ws === undefined || !signedWorkspace(ws) || p === undefined || signed === undefined || pre.jNonce >= signed || reached !== signed || p.leftHanko === undefined || p.rightHanko === undefined) return ok(w);
  const side = (held: DisputeHanko | undefined, hanko: string): Result<DisputeHanko | undefined, DisputeError> => {
    const n = held?.proofNonce ?? 0;
    if (n > p.nonce) return ok(held);
    if (n < p.nonce) return ok({ hanko, hash: p.disputeHash, proofBodyHash: p.proofBodyHash, proofNonce: p.nonce, proposerIsLeft: p.proposerIsLeft });
    return held !== undefined && sameHex(held.proofBodyHash, p.proofBodyHash) && held.proposerIsLeft === p.proposerIsLeft && sameHex(held.hash, p.disputeHash) ? ok(held) : err(refuseDispute("nonce_reuse"));
  };
  const own = localIsLeft ? p.leftHanko : p.rightHanko, peer = localIsLeft ? p.rightHanko : p.leftHanko;
  return chain(side(w.current, own), (current) => map(side(w.counterparty, peer), (counterparty): DisputeWitnesses => ({
    ...opt("current", current), ...opt("counterparty", counterparty),
    nextProofNonce: Math.max(w.nextProofNonce, p.nonce + 1, (current?.proofNonce ?? 0) + 1, (counterparty?.proofNonce ?? 0) + 1, signed + 1),
  })));
};
export const validateCounterparty = (body: AccountBody, given: DisputeHanko, from: EntityId, verify: Verify, authority: HankoAuthority = { allowPreviousBoard: true }): Result<DisputeHanko, DisputeError> => {
  if (given.hanko.length === 0) return err(refuseDispute("hanko_missing"));
  const shaped = WORD.test(given.hash) && WORD.test(given.proofBodyHash) && Number.isSafeInteger(given.proofNonce) && given.proofNonce >= 0 && typeof given.proposerIsLeft === "boolean";
  if (!shaped) return err(refuseDispute("shape"));
  return chain(asProof(committedView(body)), (view) => chain(asProof(accountDisputeHash(view, given.proofBodyHash, given.proofNonce, given.proposerIsLeft)), (expected) =>
    !sameHex(given.hash, expected) ? err(refuseDispute("hash_mismatch")) : !verify(expected, given.hanko, from, authority) ? err(refuseDispute("hanko_invalid")) : ok({ ...given, hash: expected })));
};
export const disputeRequirement = (expectedBody: string | undefined, previousBody: string | undefined, previousNonce: number | undefined, jNonce: number, received: { readonly proofNonce: number; readonly proofBodyHash: string } | undefined): DisputeReason | undefined => {
  if (expectedBody === undefined) return received === undefined ? undefined : "unexpected";
  if (received !== undefined) {
    if (received.proofNonce <= jNonce) return "nonce_finalized";
    if (previousNonce !== undefined && received.proofNonce < previousNonce) return "nonce_regression";
    if (previousNonce !== undefined && received.proofNonce === previousNonce && previousBody !== undefined && !sameHex(received.proofBodyHash, previousBody)) return "nonce_reuse";
    if (!sameHex(received.proofBodyHash, expectedBody)) return "body_mismatch";
  }
  return (!sameHex(expectedBody, previousBody) || (previousNonce ?? 0) <= jNonce) && received === undefined ? "required" : undefined;
};
export const requireDispute = (proof: LocalProof, witnesses: DisputeWitnesses, received: DisputeHanko | undefined): Result<void, DisputeError> => {
  const { counterparty } = witnesses, reason = disputeRequirement(proof.bodyHash, counterparty?.proofBodyHash, counterparty?.proofNonce, proof.jNonce, received);
  return reason === undefined ? ok(undefined) : err(refuseDispute(reason));
};
export const storeCounterparty = (witnesses: DisputeWitnesses, validated: DisputeHanko | undefined): DisputeWitnesses => (validated === undefined ? witnesses : { ...witnesses, counterparty: validated });
const evenHex = (h: unknown): boolean => { if (typeof h !== "string") return false; const b = hexBody(h); return b.length > 0 && b.length % 2 === 0; };
export const disputeShapes = (carried: readonly (DisputeHanko | undefined)[]): Result<void, DisputeError> => guard(carried.every((d) => d === undefined || evenHex(d.hanko)), refuseDispute("shape"));


export const ACCOUNT_NETWORK_ALLOWANCE_MS = 30_000n;
export const ACCOUNT_MEMPOOL_SIZE = 10_000;
export type FrameClock = { readonly timestamp: bigint; readonly jHeight: bigint };
export type FoldAt = FrameClock & { readonly height: bigint };
export type AccountFrame = FoldAt & { readonly prevFrameHash: string; readonly txs: readonly WireAccountTx[]; readonly accountStateRoot: string; readonly stateHash: string };
const EMPTY_CLAIM_PROOF: JClaimProof = { version: 1, nodes: [] };
/** `finalized`: the settled nonce each finalizing claim reaches, in frame order (og collectSettledEvents: max of jNonce and the claim's nonces). */
export type StampedClaims = { readonly txs: readonly WireAccountTx[]; readonly finalized: readonly number[] };
const claimProofOn = (accountKey: () => Result<string, ClaimError>, rows: readonly ClaimRow[], record: ClaimRow): Result<JClaimProof, ClaimError> =>
  rows.length === 0 ? ok(EMPTY_CLAIM_PROOF) : chain(accountKey(), (k) => map(claimTree(k, rows), (node): JClaimProof => (node === undefined ? EMPTY_CLAIM_PROOF : { version: 1, nodes: claimPath(node, claimLeaf(k, record).key) })));
type StampAcc = { readonly cursor: ClaimCursor; readonly jNonce: number; readonly txs: readonly WireAccountTx[]; readonly finalized: readonly number[] };
/** og proposal/transactions.ts prepareAccountJClaimTx inside the fold: each claim carries both side witnesses against the pending tries as the frame's earlier claims left them. */
const stampClaims = (txs: readonly WireAccountTx[], b: AccountBody, byLeft: boolean): Result<StampedClaims, ClaimError> => {
  const accountKey = (): Result<string, ClaimError> => mapErr(claimKeyOf(b), (): ClaimError => ({ _tag: "claim_entity" }));
  return map(foldResult<StampAcc, WireAccountTx, ClaimError>(txs, { cursor: b, jNonce: b.jNonce, txs: [], finalized: [] }, (acc, tx) => {
    if (tx.type !== "j_event_claim") return ok({ ...acc, txs: [...acc.txs, tx] });
    return chain(claimRowOf(tx, byLeft), (own) => {
      const held = acc.cursor.claimRows ?? [], side = (onLeft: boolean): Result<JClaimProof, ClaimError> => claimProofOn(accountKey, held.filter((r) => r.onLeft === onLeft), { ...own, onLeft });
      return chain(side(true), (leftProof) => chain(side(false), (rightProof) => chain(claimStep(acc.cursor, own), (s) => map(claimEvidence(tx.events), ({ events }): StampAcc => {
        const reached = s.finalizes ? Math.max(acc.jNonce, ...events.map((e) => e.data.nonce)) : acc.jNonce;
        return { cursor: s, jNonce: reached, txs: [...acc.txs, { ...tx, leftProof, rightProof }], finalized: s.finalizes ? [...acc.finalized, reached] : acc.finalized };
      }))));
    });
  }), ({ txs: stamped, finalized }) => ({ txs: stamped, finalized }));
};
const lowerHexDeep = (v: unknown): unknown =>
  typeof v === "string" ? (/^0x/i.test(v.trim()) ? v.trim().toLowerCase() : v) : Array.isArray(v) ? v.map(lowerHexDeep) : v !== null && typeof v === "object" ? Object.fromEntries(Object.entries(v).map(([k, x]) => [k, lowerHexDeep(x)])) : v;
/** og verifyAccountJClaimProof: a root admits exactly one valid path per key, so a received witness verifies iff it is the regenerated one. */
const claimProofsMatch = (given: readonly WireAccountTx[], stamped: readonly WireAccountTx[]): boolean => given.every((tx, i) => {
  const s = stamped[i];
  return tx.type !== "j_event_claim" || (s?.type === "j_event_claim" && tx.leftProof !== undefined && tx.rightProof !== undefined && canon(lowerHexDeep(tx.leftProof)) === canon(s.leftProof) && canon(lowerHexDeep(tx.rightProof)) === canon(s.rightProof));
});
const claimWire = (tx: TxOf<"j_event_claim">): Result<WireTx, ClaimError> => {
  const { leftProof, rightProof } = tx;
  if (leftProof === undefined || rightProof === undefined) return err({ _tag: "claim_proof" });
  return map(claimFrame(tx), (data) => ({ type: tx.type, data: { ...data, leftProof, rightProof } }));
};
export const wireTx = (tx: WireAccountTx, id: AccountId, byLeft: boolean): Result<WireTx, Uncommitted> => {
  if (tx.type === "j_event_claim") return mapErr(claimWire(tx), uncommitted);
  if (!isL0Tx(tx)) return ok(ownWire(wireOf(tx)));
  const payer = at(id.left, id.right, byLeft), payee = at(id.left, id.right, other(byLeft));
  return map(mapErr(tokenNumber(tx.tokenId), uncommitted), (tk) => matchBy("type", tx, {
    add_delta: (): WireTx => ({ type: "add_delta", data: { tokenId: tk } }),
    set_credit_limit: (c): WireTx => ({ type: "set_credit_limit", data: { tokenId: tk, amount: c.limit } }),
    payment: (p): WireTx => ({ type: "direct_payment", data: { tokenId: tk, amount: p.amount, route: p.route ?? [payee], ...(p.description === undefined ? {} : { description: p.description }), fromEntityId: payer, toEntityId: payee, deliveryMode: p.deliveryMode ?? "direct", ...(p.trustedGatewayEntityId === undefined ? {} : { trustedGatewayEntityId: p.trustedGatewayEntityId }) } }),
  }));
};
const safe = (n: bigint): Result<number, Uncommitted> => (n >= 0n && n <= BigInt(Number.MAX_SAFE_INTEGER) ? ok(Number(n)) : err(uncommitted({ _tag: "unsafe_number" })));
export const frameStateHash = (f: Omit<AccountFrame, "stateHash">, id: AccountId, byLeft: boolean): Result<string, Uncommitted> =>
  chain(all({ height: safe(f.height), timestamp: safe(f.timestamp), jHeight: safe(f.jHeight), accountTxs: traverse(f.txs, (tx) => wireTx(tx, id, byLeft)) }),
    (wire) => mapErr(accountFrameHash({ ...wire, prevFrameHash: f.prevFrameHash, accountStateRoot: f.accountStateRoot }), uncommitted));
const acceptFrame = (frame: AccountFrame, id: AccountId, onLeft: boolean): Result<void, Uncommitted | Tagged<"frame_hash_mismatch">> =>
  chain(frameStateHash(frame, id, onLeft), (recomputed) => guard(recomputed === frame.stateHash, { _tag: "frame_hash_mismatch" }));
export const commit = (s: AccountBody): Result<Committed, Uncommitted> => mapErr(committed(s), uncommitted);
export const accountStateRoot = (s: AccountBody): Result<string, Uncommitted> => map(commit(s), (c) => c.root);
export const foldCtx = (at: FoldAt, byLeft: boolean, settlement?: SettlementCtx): FoldCtx => ({ byLeft, nowMs: at.timestamp, jHeight: at.jHeight, accountHeight: at.height, ...opt("settlement", settlement) });
export type FrameFold = Step<AccountBody, Effect>;
export const foldAccountTxs = strictFold(applyAccountBody);
export const foldFrame = (s: AccountBody, f: AccountFrame, byLeft: boolean, settlement?: SettlementCtx): Result<FrameFold, BodyError> => foldAccountTxs(s, f.txs, foldCtx(f, byLeft, settlement));
export const proposalFold = lenientFold(applyAccountBody);
export type ProposalFold = Lenient<AccountBody, WireAccountTx, Effect, BodyError>;

export type Hanko = string;
export const GENESIS_LINK = "genesis";
export type HeadCertificate = { readonly parent: string; readonly left: Hanko; readonly right: Hanko };
/** `timestamp` is the last committed frame's clock (og `currentFrame.timestamp`, 0 at genesis). */
export type AccountHead = Tagged<"genesis", { height: 0n; prevFrameHash: typeof GENESIS_LINK; timestamp: 0n }> | Tagged<"installed", { height: bigint; prevFrameHash: string; timestamp: bigint; certificate: HeadCertificate }>;
export type InstalledHead = Of<AccountHead, "installed">;
export const genesisAccountHead = (): AccountHead => ({ _tag: "genesis", height: 0n, prevFrameHash: GENESIS_LINK, timestamp: 0n });
export type AccountAck = { readonly height: bigint; readonly frameHash: string; readonly frameHanko: Hanko; readonly disputeHanko?: DisputeHanko | undefined };
export const certifiedBy = (c: HeadCertificate, party: Party): { readonly own: Hanko; readonly peer: Hanko } => ({ own: at(c.left, c.right, party.left), peer: at(c.left, c.right, other(party.left)) });
export type FrameEvidence = { readonly cause: AccountReplicaError; readonly frame: AccountFrame; readonly frameHanko: Hanko };
export type AccountInput =
  /** `selected`: og `selectedMempoolTxs`, a sub-multiset of the mempool proposed instead of the whole mempool. */
  | ({ readonly kind: "propose"; readonly frameHanko?: Hanko | undefined; readonly disputeHanko?: DisputeHanko | undefined; readonly selected?: readonly WireAccountTx[] | undefined } & FrameClock)
  | { readonly kind: "freeze"; readonly evidence?: FrameEvidence | undefined }
  | { readonly kind: "resume" }
  | ({ readonly kind: "ack" } & AccountAck & AccountEnvelope)
  | ({ readonly kind: "ack_frame"; readonly ack: AccountAck | null; readonly frame: AccountFrame; readonly frameHanko: Hanko; readonly disputeHanko?: DisputeHanko | undefined } & AccountEnvelope)
  /** og `kind: 'dispute'`: a standalone peer dispute-Hanko witness, sequenced by its proof nonce rather than a frame height. */
  | ({ readonly kind: "dispute"; readonly disputeHanko: DisputeHanko } & AccountEnvelope)
  /** og `kind: 'board_hanko_refresh'` (AccountBoardHankoRefresh): the peer re-Hankos our committed frame (and dispute proof) under its newly activated board. */
  | ({ readonly kind: "board_hanko_refresh"; readonly boardActivationJHeight: number; readonly boardActivationLogIndex: number } & AccountAck & AccountEnvelope)
  /** og AccountFinality: an authenticated Depository dispute event routed by the owning Entity; applied unilaterally, never ACKed. */
  | ({ readonly kind: "external_finality"; readonly finality: AccountFinality } & AccountEnvelope);
/** og types/account.ts AccountFinality['finality']. */
export type DisputeStartedFinality = {
  readonly kind: "dispute_started"; readonly starterEntityId: string; readonly initialProofbodyHash: string; readonly initialNonce: number; readonly initialProposerIsLeft: boolean;
  readonly disputeTimeout: number; readonly disputeStartTimestamp: number; readonly leftResponseSeconds: number; readonly rightResponseSeconds: number; readonly jNonce: number;
  readonly starterInitialArguments: string; readonly starterCounterArguments: string; readonly starterCounterProofCommitment: string; readonly observedBlockNumber: number; readonly batchNonce?: number | undefined;
};
export type AccountFinality = DisputeStartedFinality | { readonly kind: "dispute_finalized"; readonly finalizedJNonce: number; readonly finalizedTokenIds: readonly number[] };
/** og AccountReplica.activeDispute as applyAccountDisputeStarted writes it (field order is og's). */
export type ActiveDispute = {
  readonly startedByLeft: boolean; readonly initialProofbodyHash: string; readonly initialNonce: number; readonly initialProposerIsLeft: boolean; readonly disputeTimeout: number; readonly disputeStartTimestamp: number;
  readonly jNonce: number; readonly starterInitialArguments: string; readonly starterCounterArguments: string; readonly starterCounterProofCommitment: string; readonly observedOnChain: true; readonly observedBlockNumber: number;
  readonly batchNonce?: number | undefined; readonly finalizeQueued: false;
};
export type AccountMessage = Extract<AccountInput, { readonly kind: "ack" | "ack_frame" }>;
/** Every peer-originated input (og routes `dispute` through the same Entity accountInput lane). */
export type AccountPeerInput = Extract<AccountInput, { readonly kind: "ack" | "ack_frame" | "dispute" | "board_hanko_refresh" }>;
export type AccountOutput = AccountMessage | { readonly kind: "effect"; readonly effect: Effect } | { readonly kind: "start_dispute"; readonly start: DisputeStart };
export type AccountPhase = "open" | "proposed" | "received" | "preparing" | "disputed";
export type AccountEvent = AccountInput["kind"];
/** A frame under consideration: its hanko, its local proof and the fold it makes. */
export class Candidate {
  protected declare readonly established: true;
  /** `floor`: the settlement proof-nonce floor the frame's txs folded under (og reads the pre-frame replica cursors). */
  constructor(readonly frame: AccountFrame, readonly frameHanko: Hanko, readonly frameProof: LocalProof, readonly draft: FrameFold, readonly floor: number) {}
}
type AccountEnv = { readonly state: AccountBody; readonly head: AccountHead; readonly mempool: readonly WireAccountTx[]; readonly acknowledged?: AccountAck | undefined; readonly dispute: DisputeWitnesses; readonly boardRefresh?: BoardRefresh | undefined; readonly publicPinned?: true | undefined };
/** Entity-side Account envelope fields every phase keeps (og counterpartyBoardHankoRefresh, publicPinned). */
const envMeta = (r: Pick<AccountEnv, "boardRefresh" | "publicPinned">): Pick<AccountEnv, "boardRefresh" | "publicPinned"> => ({ ...opt("boardRefresh", r.boardRefresh), ...opt("publicPinned", r.publicPinned) });
type Held = AccountEnv & { readonly candidate: Candidate };
type Frozen = Omit<AccountEnv, "mempool"> & { readonly evidence?: FrameEvidence | undefined };
export interface OpenAccount extends Tagged<"open", AccountEnv> {}
export interface ProposedAccount extends Tagged<"proposed", Held> {}
export interface ReceivedAccount extends Tagged<"received", Held & { disputeHanko: DisputeHanko | undefined }> {}
/** og `dispute_preparing` keeps deferred J claims and dispute evidence queued (dispute/policy.ts); `disputed` keeps nothing. */
export interface PreparingAccount extends Tagged<"preparing", Frozen & { mempool: readonly WireAccountTx[]; unready: StartRefusal }> {}
/** og admits local txs into a disputed Account's mempool too (local-tx-admission.ts has no status gate); nothing ever proposes them. */
/** `start`: our own dispute start, when we froze with a complete witness. `active`: og activeDispute, the on-chain dispute observed through external finality. */
export interface DisputedAccount extends Tagged<"disputed", Frozen & { mempool: readonly WireAccountTx[]; start?: DisputeStart | undefined; active?: ActiveDispute | undefined }> {}
export type FrozenAccount = PreparingAccount | DisputedAccount;
export type AccountReplica = OpenAccount | ProposedAccount | ReceivedAccount | FrozenAccount;
export const certifies = (verify: Verify, digest: string, hanko: Hanko, entity: EntityId, authority?: HankoAuthority): Result<void, Tagged<"invalid_hanko", { entity: EntityId }>> => guard(verify(digest, hanko, entity, authority), { _tag: "invalid_hanko", entity });
/** og securityContext.counterpartyCertifiedBoard: the peer's certified board and the ordered EVM log position that activated it. */
export type CertifiedBoard = { readonly boardHash: string; readonly activatedAtJHeight: number; readonly logIndex: number };
/** og AccountReplica.counterpartyBoardHankoRefresh: the last board activation the peer re-Hanko'd our committed frame under. */
export type BoardRefresh = { readonly activationJHeight: number; readonly activationLogIndex: number; readonly frameHeight: number; readonly frameHash: string };
/** `finalizedJHeight`: the owning Entity's finalized J height (og securityContext); defaults to the Account's own. `counterpartyBoard`: og counterpartyCertifiedBoard. */
export type DoorContext = { readonly verify: Verify; readonly self: EntityId; readonly now: bigint; readonly finalizedJHeight?: bigint | undefined; readonly counterpartyBoard?: CertifiedBoard | undefined };
export type AccountContext = { readonly verify: Verify; readonly party: Party; readonly counterpartyBoard?: CertifiedBoard | undefined };
/** og verifyHanko authority for a peer Hanko: the certified board when known, and whether its predecessor's grace window applies. */
const peerAuthority = (ctx: AccountContext, allowPreviousBoard: boolean): HankoAuthority => ({ ...opt("registeredBoardHash", ctx.counterpartyBoard?.boardHash), allowPreviousBoard });
export type AckContext = AccountContext & { readonly delivery: Delivery };
export type ReceivedContext = AccountContext & { readonly from: EntityId };
export type InboundAccountContext = ReceivedContext & { readonly now: bigint; readonly finalizedJHeight: bigint };
export type CtxFor<I extends AccountInput> = I extends { kind: "ack_frame" } ? InboundAccountContext : I extends { kind: "ack" } ? AckContext : I extends { kind: "dispute" | "board_hanko_refresh" } ? ReceivedContext : AccountContext;
export type AccountInputFor<E extends AccountEvent> = Extract<AccountInput, { readonly kind: E }>;
export type AccountGrammar = { readonly table: typeof AccountTransition; readonly replica: AccountReplica; readonly input: AccountInput; readonly ctx: { readonly [E in AccountEvent]: CtxFor<AccountInputFor<E>> }; readonly output: AccountOutput; readonly error: AccountReplicaError };
export type NextAccountPhase<S extends AccountPhase, E extends AccountEvent> = Next<AccountGrammar, S, E>;
export type AccountCases<E extends AccountEvent> = Cases<AccountGrammar, E>;
export type AccountApply<R extends AccountReplica = AccountReplica> = Apply<R, AccountOutput>;
export interface DisputeRequired extends Tagged<"dispute_required", FrameEvidence> {}
/** A refusal after the bundled ACK already committed: `committed` is the Account-level post-state og keeps (its Entity then evicts the whole input). */
export interface RejectedAfterAck extends Tagged<"rejected_after_ack", { cause: AccountReplicaError; committed: AccountApply }> {}
export type AccountReplicaError =
  | BodyError | DisputeError | EnvelopeError | DisputeRequired | RejectedAfterAck
  | Tagged<"proposal_selection", { reason: "empty" | "too_large" | "not_in_mempool" }>
  | Tagged<"finality", { reason: "initial_nonce" | "j_nonce" | "observed_block" | "timeout" | "clock_mismatch" | "finalized_nonce" | "token_id" }>
  | Tagged<"board_hanko_refresh", { reason: BoardRefreshRefusal }>
  | Tagged<"already_proposed" | "empty_mempool" | "not_proposed" | "height_mismatch" | "hash_mismatch" | "frame_hash_mismatch" | "state_root_mismatch" | "ack_unmatched" | "not_preparing">
  | Tagged<"frame_structure", { field: "timestamp" | "jHeight" | "txs" | "accountStateRoot" | "future_timestamp" }> | DeadlineViolation["error"] | Tagged<"stale_settlement_hanko", { cause: Of<BodyError, "settlement"> }>
  | Tagged<"invalid_hanko", { entity: EntityId }> | Tagged<"unknown_signer", { entity: EntityId }>
  | Tagged<"bad_account", { reason: "entity_id" | "same_entity" | TermsError["_tag"] }>
  | Tagged<"ack_conflict", { field: "frameHash" | "frameHanko" | "disputeHanko" | "height" }>
  | Tagged<"halt_runtime", { reason: "state_hash_after_verify" }> | Tagged<"proposal_halt", { txType: WireAccountTx["type"]; cause: BodyError }> | Tagged<"mempool_full", { limit: number }> | Tagged<"frozen", { phase: FrozenAccount["_tag"] }>;
export const evidenceOf = (e: AccountReplicaError): FrameEvidence | null => {

  if (e._tag !== "dispute_required") return null;
  const { cause, frame, frameHanko } = e;
  return { cause, frame, frameHanko };
};
export const replicaId = (r: AccountReplica): AccountId => r.state.account.id;
export const sentBy = (r: AccountReplica, party: Party): AccountEnvelope => envelopeOf(r.state.terms, party);
export const ackOf = (m: Extract<AccountInput, { readonly kind: "ack" }>): AccountAck => ({ height: m.height, frameHash: m.frameHash, frameHanko: m.frameHanko, ...opt("disputeHanko", m.disputeHanko) });
export const lifecycleKey = (tx: WireAccountTx): string | undefined => (arm(AccountKinds, tx.type).repeatable ? undefined : canon(wireOf(tx)));
export const unqueued = (txs: readonly WireAccountTx[], queued: readonly WireAccountTx[]): readonly WireAccountTx[] => firstBy(txs, lifecycleKey, queued.flatMap((tx) => lifecycleKey(tx) ?? []));
const frozenError = (phase: FrozenAccount["_tag"]): AccountReplicaError => ({ _tag: "frozen", phase });

/** `deferred`: the mempool after proposing: unselected txs plus refused txs that stay queued for retry (og proposal/transactions.ts `retry`); every other refused or included tx leaves it. */
export type Preview = { readonly frame: AccountFrame; readonly draft: FrameFold; readonly frameProof: LocalProof; readonly dispute: DisputePlan; readonly deferred: readonly WireAccountTx[]; readonly witnesses: DisputeWitnesses; readonly floor: number };
export type ProposalPlan = Tagged<"frame", { preview: Preview }> | Tagged<"idle", { refused: AccountReplicaError; deferred: readonly WireAccountTx[] }>;
// og proposal/transactions.ts: a refused matcher/settlement-owned tx halts; capacity and signed-settlement-freeze refusals are retried.
const PROPOSAL_HALTS: readonly WireAccountTx["type"][] = ["settle_transition", "swap_resolve", "cross_pull_lock", "cross_pull_close"];
const DEFERRED_REFUSALS: readonly string[] = ["htlc_lock_capacity", "settlement_frozen"];
const deferredRefusal = (e: BodyError): boolean => DEFERRED_REFUSALS.includes(e._tag);
/** A settle hanko refused only for an `account`-basis nonce against an unsigned workspace it targets exactly (og isRefreshableStaleSettlementHanko / isRefreshableStaleIncomingSettlementHanko). */
const staleHankoNonce = (s: AccountBody, tx: WireAccountTx, e: BodyError): SettlementNonceMismatch | undefined => {
  const ws = s.settlement, n = e._tag === "settlement" ? e.nonce : undefined;
  if (tx.type !== "settle_transition" || tx.kind !== "hanko" || n === undefined || n.basis !== "account" || ws === undefined || ws.nonceAtSign !== undefined) return undefined;
  return tx.revision === ws.revision && typeof tx.workspaceHash === "string" && tx.workspaceHash.toLowerCase() === ws.workspaceHash.toLowerCase() && n.supplied === tx.settlementNonce ? n : undefined;
};
/** og getMinimumSafeSettlementNonce (== getNextSettlementNonce) on the committed replica. */
const minimumSafeNonce = (s: AccountBody, w: DisputeWitnesses): number => Math.max(s.jNonce + 1, proofNonceFloor(w));
type Refusals = ProposalFold["refused"];
/** `retry`: og proposalFailureDisposition's extra `retry` cases beyond the capacity/freeze refusals. */
const proposalRefusals = (mempool: readonly WireAccountTx[], refused: Refusals, retry: (tx: WireAccountTx, e: BodyError) => boolean = () => false): Result<readonly WireAccountTx[], AccountReplicaError> => {
  const txAt = (i: number): WireAccountTx => mempool[i] ?? assertNever(i as never);
  const retried = (index: number, error: BodyError): boolean => deferredRefusal(error) || retry(txAt(index), error);
  const halted = refused.find(({ index, error }) => !retried(index, error) && PROPOSAL_HALTS.includes(txAt(index).type));
  if (halted !== undefined) return err({ _tag: "proposal_halt", txType: txAt(halted.index).type, cause: halted.error });
  return ok(refused.flatMap(({ index, error }) => (retried(index, error) ? [txAt(index)] : [])));
};
/** `verify` present: settle_transition hankos fold with og's settlement context (verifyHanko + minimum safe nonce); absent, they refuse as context-missing. */
/** og tx-multiset.ts removeCommittedTxsFromMempool: drop each removed tx once, by exact bytes, keeping mempool order. */
const withoutAccountTxs = (mempool: readonly WireAccountTx[], removed: readonly WireAccountTx[]): readonly WireAccountTx[] => {
  const left = new Map<string, number>();
  for (const tx of removed) left.set(canon(tx), (left.get(canon(tx)) ?? 0) + 1);
  return mempool.filter((tx) => { const k = canon(tx), n = left.get(k) ?? 0; if (n > 0) left.set(k, n - 1); return n === 0; });
};
/** og admission.ts selectProposalWindow: the whole mempool, or a non-empty, bounded sub-multiset of it. */
export const proposalWindow = (mempool: readonly WireAccountTx[], selected?: readonly WireAccountTx[]): Result<readonly WireAccountTx[], AccountReplicaError> => {
  const source = selected ?? mempool;
  if (source.length === 0) return err({ _tag: "proposal_selection", reason: "empty" });
  if (source.length > ACCOUNT_MEMPOOL_SIZE) return err({ _tag: "proposal_selection", reason: "too_large" });
  return selected !== undefined && withoutAccountTxs(mempool, selected).length !== mempool.length - selected.length ? err({ _tag: "proposal_selection", reason: "not_in_mempool" }) : ok(source);
};
export const planOpen = (r: OpenAccount, party: Party, entityClock: FrameClock, verify?: Verify, selected?: readonly WireAccountTx[]): Result<ProposalPlan, AccountReplicaError> => {
  if (r.mempool.length === 0) return err({ _tag: "empty_mempool" });
  return chain(proposalWindow(r.mempool, selected), (window) => planWindow(r, window, party, entityClock, verify));
};
const planWindow = (r: OpenAccount, window: readonly WireAccountTx[], party: Party, entityClock: FrameClock, verify: Verify | undefined): Result<ProposalPlan, AccountReplicaError> => {
  // og admission.ts: a lagging proposer never mints a frame behind the committed watermark.
  const clock: FrameClock = { ...entityClock, timestamp: entityClock.timestamp > r.head.timestamp ? entityClock.timestamp : r.head.timestamp };
  const height = r.head.height + 1n, floor = proofNonceFloor(r.dispute), folded = proposalFold(r.state, window, foldCtx({ height, ...clock }, party.left, verify === undefined ? undefined : { verify, proofNonceFloor: floor })), firstRefusal = folded.refused[0];
  const required = minimumSafeNonce(r.state, r.dispute), stale = (tx: WireAccountTx, e: BodyError): boolean => { const n = staleHankoNonce(r.state, tx, e); return n !== undefined && n.required === required && n.supplied !== required; };
  return chain(map(proposalRefusals(window, folded.refused, stale), (retried) => withoutAccountTxs(r.mempool, withoutAccountTxs(window, retried))), (deferred) => {
    if (folded.included.length === 0 && firstRefusal !== undefined) return ok({ _tag: "idle", refused: firstRefusal.error, deferred });
    return chain(commit(folded.state), ({ view, root }) => chain(stampClaims(folded.included, r.state, party.left), ({ txs, finalized }) => {
      const unhashed = { height, timestamp: clock.timestamp, jHeight: clock.jHeight, prevFrameHash: r.head.prevFrameHash, txs, accountStateRoot: root };
      return chain(frameStateHash(unhashed, replicaId(r), party.left), (stateHash) => chain(localProof(view), (frameProof) => chain(promoteSettled(r.dispute, r.state, folded.state, party.left, finalized), (witnesses) => map(proposalPlan(view, frameProof, witnesses, party.left), (dispute): ProposalPlan =>
        ({ _tag: "frame", preview: { frame: { ...unhashed, stateHash }, draft: { state: folded.state, effects: folded.effects }, frameProof, dispute, deferred, witnesses, floor } })))));
    }));
  });
};
export const planAccountProposal = (r: AccountReplica, self: EntityId, clock: FrameClock, verify?: Verify, selected?: readonly WireAccountTx[]): Result<ProposalPlan, AccountReplicaError> => chain(partyOf(replicaId(r), self), (party) => match(r, {
  open: (o) => planOpen(o, party, clock, verify, selected), proposed: () => err({ _tag: "already_proposed" }), received: () => err({ _tag: "already_proposed" }), preparing: () => err(frozenError("preparing")), disputed: () => err(frozenError("disputed")),
}));
const previewOf = (planned: Result<ProposalPlan, AccountReplicaError>): Result<Preview, AccountReplicaError> => chain(planned, (p) => match(p, { frame: ({ preview }): Result<Preview, AccountReplicaError> => ok(preview), idle: ({ refused }): Result<Preview, AccountReplicaError> => err(refused) }));
export const previewOpen = (r: OpenAccount, self: EntityId, clock: FrameClock, verify?: Verify): Result<Preview, AccountReplicaError> => previewOf(planAccountProposal(r, self, clock, verify));
export const previewAccountProposal = (r: AccountReplica, self: EntityId, clock: FrameClock, verify?: Verify): Result<Preview, AccountReplicaError> => previewOf(planAccountProposal(r, self, clock, verify));
export const previewAccountFrame = (r: AccountReplica, self: EntityId, clock: FrameClock, verify?: Verify): Result<AccountFrame, AccountReplicaError> => map(previewAccountProposal(r, self, clock, verify), (p) => p.frame);
export type AckPreview = { readonly height: bigint; readonly frameHash: string; readonly dispute: DisputePlan };
export const previewAck = (r: AccountReplica, self: EntityId): Result<AckPreview, AccountReplicaError> => chain(partyOf(replicaId(r), self), (party) => match(r, {
  open: (): Result<AckPreview, AccountReplicaError> => err({ _tag: "not_proposed" }), proposed: (): Result<AckPreview, AccountReplicaError> => err({ _tag: "already_proposed" }),
  received: (h): Result<AckPreview, AccountReplicaError> => map(ackPlan(h, proposerIsLeft(h, party)), (dispute) => ({ height: h.candidate.frame.height, frameHash: h.candidate.frame.stateHash, dispute })),
  preparing: (): Result<AckPreview, AccountReplicaError> => err(frozenError("preparing")), disputed: (): Result<AckPreview, AccountReplicaError> => err(frozenError("disputed")),
}));


type Propose = AccountInputFor<"propose">;
type Ack = AccountInputFor<"ack">;
type AckFrame = AccountInputFor<"ack_frame">;
type Freeze = AccountInputFor<"freeze">;
type PeerDispute = AccountInputFor<"dispute">;
type Verb<R extends AccountReplica> = Result<AccountApply<R>, AccountReplicaError>;
const reopen = (r: AccountReplica, next: { readonly state: AccountBody; readonly head: AccountHead; readonly mempool: readonly WireAccountTx[]; readonly acknowledged?: AccountAck | undefined; readonly dispute?: DisputeWitnesses | undefined }): OpenAccount =>
  ({ _tag: "open", state: next.state, head: next.head, mempool: next.mempool, acknowledged: next.acknowledged ?? r.acknowledged, dispute: next.dispute ?? r.dispute, ...envMeta(r) });
const effectsOut = (effects: readonly Effect[]): readonly AccountOutput[] => effects.map((effect) => ({ kind: "effect", effect }));
type Replayed = { readonly draft: FrameFold; readonly view: CommittedAccountState; readonly finalized: readonly number[] };
const replay = (s: AccountBody, f: AccountFrame, byLeft: boolean, settlement: SettlementCtx): Result<Replayed, AccountReplicaError> =>
  chain(foldFrame(s, f, byLeft, settlement), (draft) => chain(stampClaims(f.txs, s, byLeft), (stamped): Result<Replayed, AccountReplicaError> => !claimProofsMatch(f.txs, stamped.txs) ? err({ _tag: "claim_proof" }) :
    chain(commit(draft.state), ({ view, root }) => (root === f.accountStateRoot ? ok({ draft, view, finalized: stamped.finalized }) : err({ _tag: "state_root_mismatch" })))));
const frameStructure = (f: AccountFrame): Result<void, AccountReplicaError> => {
  const field = f.timestamp < 0n ? "timestamp" : f.jHeight < 0n ? "jHeight" : f.txs.length > ACCOUNT_MEMPOOL_SIZE ? "txs" : !BYTES32.test(f.accountStateRoot) ? "accountStateRoot" : null;
  return field === null ? ok(undefined) : err({ _tag: "frame_structure", field });
};
export const receiverClock = (f: AccountFrame, now: bigint): Result<void, AccountReplicaError> => guard(f.timestamp - now <= ACCOUNT_NETWORK_ALLOWANCE_MS, { _tag: "frame_structure", field: "future_timestamp" });
/** First refusal among checks run in order; a later check never runs after an earlier refusal. */
const lazyChecks = <E>(...gs: readonly (() => Result<unknown, E>)[]): Result<void, E> => foldResult(gs, undefined as void, (_, g) => map(g(), () => undefined));
export const HTLC_ENFORCEMENT_RESERVE_MS = ACCOUNT_NETWORK_ALLOWANCE_MS;
export type DeadlineReason = "lock_window" | "secret_window" | "secret_frame_expired" | "payer_cancel_early" | "timeout_not_expired";
export type DeadlineViolation = { readonly error: Tagged<"frame_deadline", { reason: DeadlineReason; lockId: string }>; readonly dispute: boolean };
type DeadlineLock = Pick<HtlcLock, "hashlock" | "timelock" | "revealBeforeHeight" | "senderIsLeft">;
type Clock = { readonly timestamp: bigint; readonly jHeight: bigint };
// og htlc-deadline.ts: the time bound is exclusive, the J-height bound inclusive.
const deadlinePassed = (l: DeadlineLock, c: Clock): boolean => c.jHeight > l.revealBeforeHeight || c.timestamp >= l.timelock;
// og validHtlcSecret: the htlc_resolve arm's 32-byte preimage check.
const opensLock = (l: DeadlineLock, secret: string): boolean => hashHtlcSecret(secret) === l.hashlock;
/** og dispute/deadline-policy.ts getIncomingAccountDeadlineViolation: a speculative HTLC scan of a peer frame against our local clock. */
export const incomingDeadline = (s: AccountBody, f: AccountFrame, proposerIsLeft: boolean, ctx: { readonly now: bigint; readonly finalizedJHeight: bigint }): Result<void, DeadlineViolation> => {
  const local: Clock = { timestamp: ctx.now, jHeight: ctx.finalizedJHeight };
  const violation = (reason: DeadlineReason, lockId: string, dispute = false): Result<ReadonlyMap<string, DeadlineLock>, DeadlineViolation> => err({ error: { _tag: "frame_deadline", reason, lockId }, dispute });
  const scanned = foldResult(f.txs, s.locks as ReadonlyMap<string, DeadlineLock>, (locks, tx): Result<ReadonlyMap<string, DeadlineLock>, DeadlineViolation> => {
    if (tx.type === "htlc_lock") {
      if (locks.has(tx.lockId)) return ok(locks);
      const unsafe = tx.timelock <= ctx.now + HTLC_ENFORCEMENT_RESERVE_MS || tx.revealBeforeHeight <= ctx.finalizedJHeight || f.timestamp >= tx.timelock || tx.revealBeforeHeight <= f.jHeight;
      return unsafe ? violation("lock_window", tx.lockId) : ok(mapSet(locks, tx.lockId, { hashlock: tx.hashlock, timelock: tx.timelock, revealBeforeHeight: tx.revealBeforeHeight, senderIsLeft: proposerIsLeft }));
    }
    if (tx.type !== "htlc_resolve") return ok(locks);
    const lock = locks.get(tx.lockId);
    if (lock === undefined) return ok(locks);
    if (tx.outcome === "secret") {
      if (!opensLock(lock, tx.secret)) return ok(locks);
      if (deadlinePassed(lock, { timestamp: local.timestamp + HTLC_ENFORCEMENT_RESERVE_MS, jHeight: local.jHeight })) return violation("secret_window", tx.lockId, true);
      return deadlinePassed(lock, f) ? violation("secret_frame_expired", tx.lockId) : ok(mapDelete(locks, tx.lockId));
    }
    // og `outcome: 'error'`: a payer cancel waits for local expiry; a payer cancel or a `timeout` needs an expired frame clock.
    const payer = proposerIsLeft === lock.senderIsLeft, locallyExpired = deadlinePassed(lock, local);
    if (payer && !locallyExpired) return violation("payer_cancel_early", tx.lockId);
    if ((payer || tx.reason === "timeout") && !deadlinePassed(lock, f)) return violation("timeout_not_expired", tx.lockId);
    return ok(locallyExpired || (!payer && tx.reason !== "timeout") ? mapDelete(locks, tx.lockId) : locks);
  });
  return map(scanned, () => undefined);
};
type SignedPair = { readonly left: Hanko; readonly right: Hanko };
const signedBy = (party: Party, ours: Hanko, theirs: Hanko): SignedPair => ({ left: at(ours, theirs, party.left), right: at(ours, theirs, other(party.left)) });
const install = (r: ProposedAccount | ReceivedAccount, signed: SignedPair, after: { readonly dispute: DisputeWitnesses; readonly acknowledged?: AccountAck | undefined }): Step<OpenAccount, Effect> => {
  const { frame, draft } = r.candidate;
  return step(reopen(r, { state: draft.state, head: { _tag: "installed", height: frame.height, prevFrameHash: frame.stateHash, timestamp: frame.timestamp, certificate: { parent: frame.prevFrameHash, ...signed } }, mempool: r.mempool, acknowledged: after.acknowledged, dispute: after.dispute }), draft.effects);
};
const residentAck = (r: OpenAccount): AccountAck | null => (r.acknowledged !== undefined && r.acknowledged.height === r.head.height ? r.acknowledged : null);
export const proposeOpen = (r: OpenAccount, input: Propose, ctx: AccountContext): Verb<OpenAccount | ProposedAccount> => chain(planOpen(r, ctx.party, { timestamp: input.timestamp, jHeight: input.jHeight }, ctx.verify, input.selected), (planned) => match(planned, {
  idle: ({ refused, deferred }): Verb<OpenAccount | ProposedAccount> => (input.frameHanko === undefined && input.disputeHanko === undefined ? ok(done({ ...r, mempool: deferred })) : err(refused)),
  frame: ({ preview: { frame, draft, frameProof, dispute, deferred, witnesses: promoted, floor } }): Verb<OpenAccount | ProposedAccount> => {
    const frameHanko = input.frameHanko;
    if (frameHanko === undefined) return err({ _tag: "invalid_hanko", entity: ctx.party.self });

    return chain(checks(frameStructure(frame), certifies(ctx.verify, frame.stateHash, frameHanko, ctx.party.self)), () => map(settleLocal(dispute, input.disputeHanko, promoted, ctx.party.self, ctx.verify), ({ carried, witnesses }) => {
      const proposed: ProposedAccount = { ...r, _tag: "proposed", mempool: deferred, candidate: new Candidate(frame, frameHanko, frameProof, draft, floor), dispute: witnesses };
      return done<OpenAccount | ProposedAccount, AccountOutput>(proposed, [{ kind: "ack_frame", ...sentBy(r, ctx.party), ack: residentAck(r), frame, frameHanko, ...opt("disputeHanko", carried) }]);
    }));
  },
}));
const receivedDispute = (r: AccountReplica, d: DisputeHanko | undefined, from: EntityId, verify: Verify): Result<DisputeHanko | undefined, AccountReplicaError> => (d === undefined ? ok(undefined) : validateCounterparty(r.state, d, from, verify));
const sameWitness = (a: DisputeHanko, b: DisputeHanko | undefined): boolean => b !== undefined && sameHex(a.hanko, b.hanko) && sameHex(a.hash, b.hash) && sameHex(a.proofBodyHash, b.proofBodyHash) && a.proofNonce === b.proofNonce && a.proposerIsLeft === b.proposerIsLeft;
const conflict = (field: "frameHash" | "frameHanko" | "disputeHanko" | "height"): AccountReplicaError => ({ _tag: "ack_conflict", field });
const predecessorAck = (r: AccountReplica, a: AccountAck, from: EntityId, verify: Verify, authority: HankoAuthority): Result<void, AccountReplicaError> => match(r.head, {
  genesis: (): Result<void, AccountReplicaError> => err(conflict("frameHash")),
  installed: ({ certificate: { parent } }): Result<void, AccountReplicaError> => (sameHex(a.frameHash, parent) ? certifies(verify, parent, a.frameHanko, from, authority) : err(conflict("frameHash"))),
});
const repeatedAck = (r: AccountReplica, a: AccountAck, validated: DisputeHanko | undefined, ctx: ReceivedContext): Result<void, AccountReplicaError> => match(r.head, {
  genesis: (): Result<void, AccountReplicaError> => err(conflict("frameHash")),
  installed: ({ prevFrameHash: h, certificate }): Result<void, AccountReplicaError> => {
    if (!sameHex(a.frameHash, h)) return err(conflict("frameHash"));
    if (a.frameHanko.length === 0 || !sameHex(a.frameHanko, certifiedBy(certificate, ctx.party).peer)) return err(conflict("frameHanko"));
    if (validated !== undefined && !sameWitness(validated, r.dispute.counterparty)) return err(conflict("disputeHanko"));
    return certifies(ctx.verify, h, a.frameHanko, ctx.from, peerAuthority(ctx, true));
  },
});
type HeadAck = Tagged<"identity"> | Tagged<"advance", { target: bigint; validated: DisputeHanko | undefined }>;
const IDENTITY: HeadAck = { _tag: "identity" };
const headAck = (r: AccountReplica, a: AccountAck, ctx: ReceivedContext, riding: bigint | undefined, target: bigint): Result<HeadAck, AccountReplicaError> => chain(receivedDispute(r, a.disputeHanko, ctx.from, ctx.verify), (validated): Result<HeadAck, AccountReplicaError> => {
  const height = r.head.height;
  if (riding === undefined && height > 1n && a.height === height - 1n) return map(predecessorAck(r, a, ctx.from, ctx.verify, peerAuthority(ctx, true)), () => IDENTITY);
  if (target < height - 1n) return ok(IDENTITY);
  if (target === height && height > 0n) return map(repeatedAck(r, a, validated, ctx), () => IDENTITY);
  return ok({ _tag: "advance", target, validated });
});
const commitOwn = (r: ProposedAccount, a: AccountAck, validated: DisputeHanko | undefined, ctx: ReceivedContext): Verb<OpenAccount> => {
  const { frame, frameHanko, frameProof } = r.candidate;
  return chain(requireDispute(frameProof, r.dispute, validated), (): Verb<OpenAccount> => {
    if (!sameHex(a.frameHash, frame.stateHash)) return err({ _tag: "hash_mismatch" });
    return map(certifies(ctx.verify, frame.stateHash, a.frameHanko, ctx.from, peerAuthority(ctx, true)), () => {
      const installed = install(r, signedBy(ctx.party, frameHanko, a.frameHanko), { dispute: storeCounterparty(r.dispute, validated) });
      return done(installed.state, effectsOut(installed.effects));
    });
  });
};
type Gate<R extends AccountReplica, X extends object = {}> = Tagged<"answered", { result: Verb<R> }> | Tagged<"continue", X>;
const answered = <R extends AccountReplica>(result: Verb<R>): Gate<R, never> => ({ _tag: "answered", result });
const ownAck = <R extends ProposedAccount | ReceivedAccount>(r: R, input: Ack, ctx: AccountContext): Gate<R> => {
  const shaped = disputeShapes([input.disputeHanko]);
  if (!shaped.ok) return answered(shaped);
  if (input.height <= r.head.height) return answered(ok(done(r)));
  const { frame } = r.candidate;
  if (input.height !== frame.height) return answered(err({ _tag: "height_mismatch" }));
  if (!sameHex(input.frameHash, frame.stateHash)) return answered(err({ _tag: "hash_mismatch" }));
  const certified = certifies(ctx.verify, frame.stateHash, input.frameHanko, ctx.party.self);
  return certified.ok ? { _tag: "continue" } : answered(certified);
};
const createAck = (r: ReceivedAccount, input: Ack, ctx: AccountContext): Verb<OpenAccount | ReceivedAccount> => match(ownAck(r, input, ctx), {
  answered: ({ result }): Verb<OpenAccount | ReceivedAccount> => result,
  continue: (): Verb<OpenAccount | ReceivedAccount> => {
    const { frame, frameHanko } = r.candidate;
    return chain(ackPlan(r, proposerIsLeft(r, ctx.party)), (plan) => map(settleLocal(plan, input.disputeHanko, r.dispute, ctx.party.self, ctx.verify), ({ carried, witnesses }) => {
      const ackOut: AccountAck = { height: frame.height, frameHash: frame.stateHash, frameHanko: input.frameHanko, ...opt("disputeHanko", carried) };
      const installed = install(r, signedBy(ctx.party, input.frameHanko, frameHanko), { dispute: storeCounterparty(witnesses, r.disputeHanko), acknowledged: ackOut });
      return done<OpenAccount | ReceivedAccount, AccountOutput>(installed.state, [{ kind: "ack", ...sentBy(r, ctx.party), ...ackOut }, ...effectsOut(installed.effects)]);
    }));
  },
});
const receiveAck = (r: AccountReplica, input: Ack, ctx: ReceivedContext): Result<HeadAck, AccountReplicaError> => {
  if (ctx.from !== ctx.party.peer) return err({ _tag: "unknown_signer", entity: ctx.from });
  return chain(disputeShapes([input.disputeHanko]), () => headAck(r, input, ctx, undefined, input.height));
};
const unmatched = <R extends AccountReplica>(r: R, head: Result<HeadAck, AccountReplicaError>): Verb<R> => chain(head, (h) => match(h, { identity: (): Verb<R> => ok(done(r)), advance: (): Verb<R> => err({ _tag: "ack_unmatched" }) }));
export const ackProposed = (r: ProposedAccount, input: Ack, ctx: AckContext): Verb<OpenAccount | ProposedAccount> => match(ctx.delivery, {
  local: () => match(ownAck(r, input, ctx), {
    answered: ({ result }): Verb<OpenAccount | ProposedAccount> => result,
    continue: (): Verb<OpenAccount | ProposedAccount> => input.disputeHanko === undefined
      ? ok(done({ ...r, candidate: new Candidate(r.candidate.frame, input.frameHanko, r.candidate.frameProof, r.candidate.draft, r.candidate.floor) }))
      : err(refuseDispute("unexpected")),
  }),
  received: ({ from }) => {
    const received = { ...ctx, from };
    return chain(receiveAck(r, input, received), (h) => match(h, {
      identity: (): Verb<OpenAccount | ProposedAccount> => ok(done(r)),
      advance: ({ target, validated }): Verb<OpenAccount | ProposedAccount> => (target === r.candidate.frame.height ? commitOwn(r, input, validated, received) : err({ _tag: "ack_unmatched" })),
    }));
  },
});
export const ackReceived = (r: ReceivedAccount, input: Ack, ctx: AckContext): Verb<OpenAccount | ReceivedAccount> =>
  match(ctx.delivery, { local: () => createAck(r, input, ctx), received: ({ from }) => unmatched(r, receiveAck(r, input, { ...ctx, from })) });
export const ackOpen = (r: OpenAccount, input: Ack, ctx: AckContext): Verb<OpenAccount> => match(ctx.delivery, {
  local: (): Verb<OpenAccount> => chain(disputeShapes([input.disputeHanko]), () => (input.height <= r.head.height ? ok(done(r)) : err({ _tag: "not_proposed" }))),
  received: ({ from }) => unmatched(r, receiveAck(r, input, { ...ctx, from })),
});
const restore = (r: ProposedAccount): OpenAccount => reopen(r, { state: r.state, head: r.head, mempool: [...unqueued(r.candidate.frame.txs, r.mempool), ...r.mempool] });
const duplicateOfHead = <R extends AccountReplica>(r: R, head: InstalledHead, input: AckFrame, ctx: InboundAccountContext): Verb<R> => {
  const { frame } = input, height = head.height;
  return chain(acceptFrame(frame, replicaId(r), other(ctx.party.left)), () => {
    const certified = certifiedBy(head.certificate, ctx.party);
    if (!sameHex(input.frameHanko, certified.peer)) return err(conflict("frameHanko"));
    const ack = input.ack;
    const priorAck: Result<void, AccountReplicaError> = ack === null ? ok(undefined)
      : height <= 1n || ack.height !== height - 1n ? err(conflict("height"))
      : chain(receivedDispute(r, ack.disputeHanko, ctx.from, ctx.verify), () => predecessorAck(r, ack, ctx.from, ctx.verify, peerAuthority(ctx, true)));
    return chain(priorAck, () => {
      const sent = r.acknowledged;
      if (sent !== undefined && sent.height === height) return ok(done<R, AccountOutput>(r, [{ kind: "ack", ...sentBy(r, ctx.party), ...sent }]));
      // og replay.ts reusableCertifiedAckHanko: only a witness above the finalized jNonce is reusable.
      return map(asProof(committedView(r.state)), ({ jNonce }) => {
        const current = r.dispute.current;
        const rebuilt: AccountAck = { height, frameHash: head.prevFrameHash, frameHanko: certified.own, ...opt("disputeHanko", current !== undefined && current.proofNonce > jNonce ? current : undefined) };
        return done<R, AccountOutput>({ ...r, acknowledged: rebuilt }, [{ kind: "ack", ...sentBy(r, ctx.party), ...rebuilt }]);
      });
    });
  });
};
const replayGate = <R extends AccountReplica>(r: R, input: AckFrame, ctx: InboundAccountContext): Gate<R> => {
  const { frame } = input;
  const stale = (): Gate<R> => (input.ack === null && frame.height < r.head.height ? answered(ok(done(r))) : { _tag: "continue" });
  return match(r.head, { genesis: stale, installed: (head): Gate<R> => (frame.height === head.height && sameHex(frame.stateHash, head.prevFrameHash) ? answered(duplicateOfHead(r, head, input, ctx)) : stale()) });
};
const receipt = <R extends AccountReplica>(r: R, input: AckFrame, ctx: InboundAccountContext): Gate<R, { validated: DisputeHanko | undefined }> => {
  const { frame } = input, validated = receivedDispute(r, input.disputeHanko, ctx.from, ctx.verify);
  if (!validated.ok) return answered(validated);
  if (frame.height < r.head.height) return answered(ok(done(r)));
  // og incoming/preflight.ts order: structure, chain, tx profile, then (only then) the Hanko, then HTLC deadlines.
  const byLeft = other(ctx.party.left);
  const gates = lazyChecks<AccountReplicaError>(() => frameStructure(frame), () => receiverClock(frame, ctx.now),
    () => guard(frame.prevFrameHash === r.head.prevFrameHash, { _tag: "hash_mismatch" }), () => guard(frame.height === r.head.height + 1n, { _tag: "height_mismatch" }),
    () => traverse(frame.txs, (tx) => wireTx(tx, replicaId(r), byLeft)), () => certifies(ctx.verify, frame.stateHash, input.frameHanko, ctx.from, peerAuthority(ctx, false)),
    () => mapErr(incomingDeadline(r.state, frame, byLeft, ctx), (v): AccountReplicaError => (v.dispute ? { _tag: "dispute_required", cause: v.error, frame, frameHanko: input.frameHanko } : v.error)));
  return gates.ok ? { _tag: "continue", validated: validated.value } : answered(gates);
};
const admitPeerFrame = (cur: OpenAccount, input: AckFrame, party: Party, validated: DisputeHanko | undefined, verify: Verify): Verb<ReceivedAccount> => {
  const { frame } = input, onLeft = other(party.left), floor = proofNonceFloor(cur.dispute);
  const evidence = (cause: AccountReplicaError): AccountReplicaError => ({ _tag: "dispute_required", cause, frame, frameHanko: input.frameHanko });
  // og consensus/index.ts classifyIncomingValidationFailure: a stale account-basis hanko for the one unsigned workspace is a plain refusal, not dispute evidence.
  const required = minimumSafeNonce(cur.state, cur.dispute), replayed = (cause: AccountReplicaError): AccountReplicaError => {
    const stale = cause._tag === "settlement" ? frame.txs.filter((tx) => { const n = staleHankoNonce(cur.state, tx, cause); return n !== undefined && n.supplied < n.required && n.required === required; }) : [];
    return cause._tag === "settlement" && stale.length === 1 ? { _tag: "stale_settlement_hanko", cause } : evidence(cause);
  };
  return chain(acceptFrame(frame, replicaId(cur), onLeft), () => chain(mapErr(replay(cur.state, frame, onLeft, { verify, proofNonceFloor: floor }), replayed), ({ draft, view, finalized }) => chain(localProof(view), (frameProof) =>
    chain(mapErr(promoteSettled(cur.dispute, cur.state, draft.state, party.left, finalized), evidence), (witnesses) =>
      map(mapErr(requireDispute(frameProof, witnesses, validated), evidence), () => done<ReceivedAccount, AccountOutput>({ ...cur, _tag: "received", candidate: new Candidate(frame, input.frameHanko, frameProof, draft, floor), disputeHanko: validated, dispute: witnesses }))))));
};
const proposalOnOpen = (r: OpenAccount, input: AckFrame, ctx: InboundAccountContext): Verb<OpenAccount | ReceivedAccount> =>
  match(receipt(r, input, ctx), { answered: ({ result }): Verb<OpenAccount | ReceivedAccount> => result, continue: ({ validated }): Verb<OpenAccount | ReceivedAccount> => admitPeerFrame(r, input, ctx.party, validated, ctx.verify) });
const proposalOnProposed = (r: ProposedAccount, input: AckFrame, ctx: InboundAccountContext): Verb<OpenAccount | ProposedAccount | ReceivedAccount> => match(receipt(r, input, ctx), {
  answered: ({ result }): Verb<OpenAccount | ProposedAccount | ReceivedAccount> => result,
  continue: ({ validated }): Verb<OpenAccount | ProposedAccount | ReceivedAccount> => (ctx.party.left ? ok(done(r)) : admitPeerFrame(restore(r), input, ctx.party, validated, ctx.verify)),
});
const proposalOnReceived = (r: ReceivedAccount, input: AckFrame, ctx: InboundAccountContext): Verb<ReceivedAccount> => match(receipt(r, input, ctx), {
  answered: ({ result }): Verb<ReceivedAccount> => result,
  continue: (): Verb<ReceivedAccount> => (sameHex(input.frame.stateHash, r.candidate.frame.stateHash) ? ok(done(r)) : err({ _tag: "already_proposed" })),
});
export const restoreCandidate = (held: ProposedAccount | ReceivedAccount, party: Party, verify: Verify): Result<Candidate, AccountReplicaError> => {
  const { frame, frameHanko } = held.candidate, byLeft = proposerIsLeft(held, party);
  return chain(acceptFrame(frame, replicaId(held), byLeft), () =>
    chain(certifies(verify, frame.stateHash, frameHanko, at(party.self, party.peer, byLeft === party.left), { allowPreviousBoard: true }), () =>
      chain(replay(held.state, frame, byLeft, { verify, proofNonceFloor: held.candidate.floor }), ({ draft, view }) => map(localProof(view), (frameProof) => new Candidate(frame, frameHanko, frameProof, draft, held.candidate.floor)))));
};
export const dropFrozen = <R extends FrozenAccount>(r: R): Verb<R> => ok(done(r));
// og freezeAccountForDispute: J claims survive while preparation can still return to active; matcher evidence survives preparation only.
const isDeferredClaim = (tx: WireAccountTx): boolean => tx.type === "j_event_claim";
const isDisputeEvidence = (tx: WireAccountTx): boolean => tx.type === "swap_resolve";
const retainedThroughFreeze = (r: AccountReplica, keep: (tx: WireAccountTx) => boolean): readonly WireAccountTx[] => {
  const queued = r.mempool.filter(keep), pending = r._tag === "proposed" ? r.candidate.frame.txs.filter(keep) : [];
  return [...unqueued(pending, queued), ...queued];
};
const freeze = (r: AccountReplica, evidence: FrameEvidence | undefined, ctx: AccountContext): Verb<PreparingAccount | DisputedAccount> => {
  const { state, head, dispute: witnesses, acknowledged } = r, frozen = { state, head, dispute: witnesses, acknowledged, evidence, ...envMeta(r) };
  const start = startOf(state, witnesses, ctx.party.peer, ctx.verify);
  if (!start.ok) return ok(done<PreparingAccount, AccountOutput>({ _tag: "preparing", ...frozen, mempool: retainedThroughFreeze(r, (tx) => isDeferredClaim(tx) || isDisputeEvidence(tx)), unready: start.error }));
  return ok(done<DisputedAccount, AccountOutput>({ _tag: "disputed", ...frozen, mempool: [], start: start.value }, [{ kind: "start_dispute", start: start.value }]));
};
/** og returnPreparedAccountToActive: only a preparing Account reopens, keeping its deferred J claims. */
export const resumePreparing = (r: PreparingAccount): Verb<OpenAccount> => ok(done(reopen(r, { state: r.state, head: r.head, mempool: retainedThroughFreeze(r, isDeferredClaim) })));
export const disputeLive = (r: OpenAccount | ProposedAccount | ReceivedAccount, input: Freeze, ctx: AccountContext): Verb<PreparingAccount | DisputedAccount> => freeze(r, input.evidence, ctx);
export const disputePreparing = (r: PreparingAccount, _input: Freeze, ctx: AccountContext): Verb<PreparingAccount | DisputedAccount> => freeze(r, r.evidence, ctx);
export const disputeDisputed = (r: DisputedAccount): Verb<DisputedAccount> => ok(done(r));
/** og index.ts handleStandaloneDispute: shape, validate against the committed state, then the requirement ladder against our own current draft (og `currentDisputeProofBodyHash`), then store. */
export const peerWitness = <R extends LiveAccount>(r: R, input: PeerDispute, ctx: ReceivedContext): Verb<R> => {
  if (ctx.from !== ctx.party.peer) return err({ _tag: "unknown_signer", entity: ctx.from });
  const { current, counterparty } = r.dispute;
  return chain(disputeShapes([input.disputeHanko]), () => chain(validateCounterparty(r.state, input.disputeHanko, ctx.from, ctx.verify), (validated) => chain(asProof(committedView(r.state)), (view): Verb<R> => {
    const reason = disputeRequirement(current?.proofBodyHash, counterparty?.proofBodyHash, counterparty?.proofNonce, view.jNonce, validated);
    return reason !== undefined ? err(refuseDispute(reason)) : ok(done<R, AccountOutput>({ ...r, dispute: storeCounterparty(r.dispute, validated) }));
  })));
};
export type BoardRefreshRefusal = "party_mismatch" | "activation_height" | "activation_log_index" | "certified_board_missing" | "activation_mismatch" | "activation_order" | "height_mismatch" | "frame_hash_mismatch"
  | "frame_hanko_missing" | "frame_hanko_invalid" | "dispute_mismatch";
const refuseRefresh = (reason: BoardRefreshRefusal): Result<never, AccountReplicaError> => err({ _tag: "board_hanko_refresh", reason });
/** og currentHeight/currentFrame: the committed head, or a received frame (og commits it on receipt; the rewrite holds it until the Entity answers). */
const currentFrameOf = (r: AccountReplica): { readonly height: bigint; readonly hash: string } =>
  r._tag === "received" ? { height: r.candidate.frame.height, hash: r.candidate.frame.stateHash } : match(r.head, { genesis: () => ({ height: 0n, hash: "" }), installed: (h) => ({ height: h.height, hash: h.prevFrameHash }) });
/** og incoming/board-hanko-refresh.ts handleBoardHankoRefresh: party, activation against the certified board, activation order (an exact retry passes), the current frame, then the
 * frame Hanko and optional dispute Hanko under the current board only (allowPreviousBoard false). Installs the Hankos and the refresh record; money and nonces never change. */
export const refreshBoardHanko = <R extends AccountReplica>(r: R, input: AccountInputFor<"board_hanko_refresh">, ctx: ReceivedContext): Verb<R> => {
  if (ctx.from !== ctx.party.peer) return refuseRefresh("party_mismatch");
  const aH = input.boardActivationJHeight, aL = input.boardActivationLogIndex, board = ctx.counterpartyBoard;
  if (!Number.isSafeInteger(aH) || aH < 1) return refuseRefresh("activation_height");
  if (!Number.isSafeInteger(aL) || aL < 0) return refuseRefresh("activation_log_index");
  if (board === undefined) return refuseRefresh("certified_board_missing");
  if (aH !== board.activatedAtJHeight || aL !== board.logIndex) return refuseRefresh("activation_mismatch");
  const prev = r.boardRefresh, hash = input.frameHash.toLowerCase(), height = input.height;
  const notNewer = prev !== undefined && (aH < prev.activationJHeight || (aH === prev.activationJHeight && aL <= prev.activationLogIndex));
  const exactRetry = prev !== undefined && aH === prev.activationJHeight && aL === prev.activationLogIndex && height === BigInt(prev.frameHeight) && hash === prev.frameHash;
  if (notNewer && !exactRetry) return refuseRefresh("activation_order");
  const current = currentFrameOf(r), currentHash = current.hash.toLowerCase();
  if (height < 1n || height > BigInt(Number.MAX_SAFE_INTEGER) || height !== current.height) return refuseRefresh("height_mismatch");
  if (!/^0x[0-9a-f]{64}$/.test(hash) || hash !== currentHash) return refuseRefresh("frame_hash_mismatch");
  if (input.frameHanko.length === 0) return refuseRefresh("frame_hanko_missing");
  const fresh = peerAuthority(ctx, false);
  if (!ctx.verify(currentHash, input.frameHanko, ctx.from, fresh)) return refuseRefresh("frame_hanko_invalid");
  const d = input.disputeHanko, held = r.dispute.counterparty;
  const dispute: Result<DisputeHanko | undefined, AccountReplicaError> = d === undefined ? ok(undefined)
    : held === undefined || !sameHex(d.hash, held.hash) || !sameHex(d.proofBodyHash, held.proofBodyHash) || d.proofNonce !== held.proofNonce || d.proposerIsLeft !== held.proposerIsLeft ? refuseRefresh("dispute_mismatch")
    : validateCounterparty(r.state, d, ctx.from, ctx.verify, fresh);
  return map(dispute, (verified) => {
    const peerSide = (c: HeadCertificate): HeadCertificate => (ctx.party.left ? { ...c, right: input.frameHanko } : { ...c, left: input.frameHanko });
    const head: AccountHead = r._tag !== "received" && r.head._tag === "installed" ? { ...r.head, certificate: peerSide(r.head.certificate) } : r.head;
    const refreshed = {
      ...r, head, dispute: verified === undefined ? r.dispute : { ...r.dispute, counterparty: { ...(held as DisputeHanko), hanko: verified.hanko } },
      boardRefresh: { activationJHeight: aH, activationLogIndex: aL, frameHeight: Number(height), frameHash: currentHash },
      ...(r._tag === "received" ? { candidate: new Candidate(r.candidate.frame, input.frameHanko, r.candidate.frameProof, r.candidate.draft, r.candidate.floor) } : {}),
    } as R;
    return done<R, AccountOutput>(refreshed);
  });
};
const checkAckFrame = (input: AckFrame, ctx: InboundAccountContext): Result<void, AccountReplicaError> =>
  ctx.from !== ctx.party.peer ? err({ _tag: "unknown_signer", entity: ctx.from }) : disputeShapes([input.disputeHanko, input.ack?.disputeHanko]);
const carriedWithoutFrame = (r: OpenAccount | ReceivedAccount, input: AckFrame, ctx: InboundAccountContext): Result<void, AccountReplicaError> =>
  input.ack === null ? ok(undefined) : map(headAck(r, input.ack, ctx, input.frame.height, input.ack.height), () => undefined);
const pastGates = <R extends AccountReplica, S extends AccountReplica>(r: R, input: AckFrame, ctx: InboundAccountContext, rest: () => Verb<S>): Verb<R | S> =>
  chain(checkAckFrame(input, ctx), () => match(replayGate(r, input, ctx), { answered: ({ result }): Verb<R | S> => result, continue: (): Verb<R | S> => rest() }));
/** og index.ts: the ACK phase commits before the proposal phase runs, so a refused successor frame leaves the ACK installed. */
const thenProposal = (acked: Verb<OpenAccount | ProposedAccount>, input: AckFrame, ctx: InboundAccountContext): Verb<OpenAccount | ProposedAccount | ReceivedAccount> => chain(acked, (a) => {
  const next = match(a.replica, { open: (o): Verb<OpenAccount | ProposedAccount | ReceivedAccount> => proposalOnOpen(o, input, ctx), proposed: (p): Verb<OpenAccount | ProposedAccount | ReceivedAccount> => proposalOnProposed(p, input, ctx) });
  if (!next.ok && a.replica._tag === "open") return err({ _tag: "rejected_after_ack", cause: next.error, committed: a });
  return map(next, (p) => ({ replica: p.replica, outputs: [...a.outputs, ...p.outputs] }));
});
const carriedAck = (r: ProposedAccount, a: AccountAck, head: HeadAck, input: AckFrame, ctx: InboundAccountContext): Verb<OpenAccount | ProposedAccount> => match(head, {
  identity: (): Verb<OpenAccount | ProposedAccount> => ok(done(r)),
  advance: ({ target, validated }): Verb<OpenAccount | ProposedAccount> => {
    const held = r.candidate.frame.height;
    if (target === held) return commitOwn(r, a, validated, ctx);
    return input.frame.height === held && a.height === held - 1n ? ok(done(r)) : err({ _tag: "ack_unmatched" });
  },
});
export const ackFrameOpen = (r: OpenAccount, input: AckFrame, ctx: InboundAccountContext): Verb<OpenAccount | ReceivedAccount> =>
  pastGates(r, input, ctx, (): Verb<OpenAccount | ReceivedAccount> => chain(carriedWithoutFrame(r, input, ctx), () => proposalOnOpen(r, input, ctx)));
export const ackFrameProposed = (r: ProposedAccount, input: AckFrame, ctx: InboundAccountContext): Verb<OpenAccount | ProposedAccount | ReceivedAccount> => pastGates(r, input, ctx, (): Verb<OpenAccount | ProposedAccount | ReceivedAccount> => {
  const a = input.ack;
  if (a === null) return thenProposal(ok(done(r)), input, ctx);

  const held = r.candidate.frame.height, target = input.frame.height === held + 1n ? held : a.height;
  return chain(headAck(r, a, ctx, input.frame.height, target), (h) => thenProposal(carriedAck(r, a, h, input, ctx), input, ctx));
});
export const ackFrameReceived = (r: ReceivedAccount, input: AckFrame, ctx: InboundAccountContext): Verb<ReceivedAccount> =>
  pastGates(r, input, ctx, (): Verb<ReceivedAccount> => chain(carriedWithoutFrame(r, input, ctx), () => proposalOnReceived(r, input, ctx)));
const accountVerb = grammar<AccountGrammar>(AccountTransition);
export const propose = accountVerb("propose", { open: proposeOpen, proposed: { _tag: "already_proposed" }, received: { _tag: "already_proposed" }, preparing: frozenError("preparing"), disputed: frozenError("disputed") });
export const ack = accountVerb("ack", { open: ackOpen, proposed: ackProposed, received: ackReceived, preparing: dropFrozen, disputed: dropFrozen });
export const ackFrame = accountVerb("ack_frame", { open: ackFrameOpen, proposed: ackFrameProposed, received: ackFrameReceived, preparing: dropFrozen, disputed: dropFrozen });
export const freezeAccount = accountVerb("freeze", { open: disputeLive, proposed: disputeLive, received: disputeLive, preparing: disputePreparing, disputed: disputeDisputed });
export const dispute = accountVerb("dispute", { open: peerWitness, proposed: peerWitness, received: peerWitness, preparing: dropFrozen, disputed: dropFrozen });
export const boardHankoRefresh = accountVerb("board_hanko_refresh", { open: refreshBoardHanko, proposed: refreshBoardHanko, received: refreshBoardHanko, preparing: refreshBoardHanko, disputed: refreshBoardHanko });
const finalityErr = (reason: Of<AccountReplicaError, "finality">["reason"]): Result<never, AccountReplicaError> => err({ _tag: "finality", reason });
const safeNonce = (n: number): boolean => Number.isSafeInteger(n) && n >= 0;
/** og j-finality.ts applyAccountDisputeStarted: validate nonces and the dispute clock, freeze keeping evidence, record activeDispute, raise jNonce. */
const disputeStarted = (r: AccountReplica, f: DisputeStartedFinality): Verb<DisputedAccount> => {
  if (!safeNonce(f.initialNonce)) return finalityErr("initial_nonce");
  if (!safeNonce(f.jNonce)) return finalityErr("j_nonce");
  if (!safeNonce(f.observedBlockNumber)) return finalityErr("observed_block");
  if (!Number.isSafeInteger(f.disputeTimeout) || !Number.isSafeInteger(f.disputeStartTimestamp) || f.disputeStartTimestamp <= 0 || f.disputeTimeout < f.disputeStartTimestamp) return finalityErr("timeout");
  const clock = r.state.terms.disputeConfig;
  if (f.leftResponseSeconds !== clock.leftResponseSeconds || f.rightResponseSeconds !== clock.rightResponseSeconds || f.disputeTimeout !== f.disputeStartTimestamp + f.leftResponseSeconds + f.rightResponseSeconds) return finalityErr("clock_mismatch");
  const id = replicaId(r), starter = f.starterEntityId.toLowerCase();
  const active: ActiveDispute = {
    startedByLeft: starter === id.left.toLowerCase(), initialProofbodyHash: f.initialProofbodyHash, initialNonce: f.initialNonce, initialProposerIsLeft: f.initialProposerIsLeft,
    disputeTimeout: f.disputeTimeout, disputeStartTimestamp: f.disputeStartTimestamp, jNonce: f.jNonce, starterInitialArguments: f.starterInitialArguments, starterCounterArguments: f.starterCounterArguments,
    starterCounterProofCommitment: f.starterCounterProofCommitment, observedOnChain: true, observedBlockNumber: f.observedBlockNumber, ...opt("batchNonce", f.batchNonce), finalizeQueued: false,
  };
  // og sets status 'disputed' before freezeAccountForDispute(account, true): deferred claims are dropped, dispute evidence (queued or in our pending frame) is kept.
  const { head, dispute: witnesses, acknowledged } = r, evidence = r._tag === "preparing" || r._tag === "disputed" ? r.evidence : undefined, start = r._tag === "disputed" ? r.start : undefined;
  return ok(done<DisputedAccount, AccountOutput>({ _tag: "disputed", state: { ...r.state, jNonce: Math.max(r.state.jNonce, f.jNonce) }, head, dispute: witnesses, acknowledged, evidence, mempool: retainedThroughFreeze(r, isDisputeEvidence), ...opt("start", start), active, ...envMeta(r) }));
};
/** og j-finality.ts applyAccountDisputeFinality: the winning proof's nonce becomes jNonce; off-chain economics, holds and encumbrances are retired; the peer witness tuple is dropped. */
const disputeFinalized = (r: AccountReplica, f: Extract<AccountFinality, { kind: "dispute_finalized" }>): Verb<DisputedAccount> => {
  if (!safeNonce(f.finalizedJNonce)) return finalityErr("finalized_nonce");
  if (!f.finalizedTokenIds.every((t) => Number.isSafeInteger(t) && t >= 0)) return finalityErr("token_id");
  const finalized = new Set(f.finalizedTokenIds.map((t) => String(t)));
  const deltas = new Map([...r.state.account.deltas].map(([tk, d]): readonly [TokenId, Delta] => [tk, { ...d, ...(finalized.has(String(tk)) ? { collateral: 0n, ondelta: 0n } : {}), offdelta: 0n }]));
  const state: AccountBody = { ...r.state, settlement: undefined, jNonce: f.finalizedJNonce, account: { ...r.state.account, deltas }, locks: new Map(), offers: new Map() };
  const { current, nextProofNonce } = r.dispute, evidence = r._tag === "preparing" || r._tag === "disputed" ? r.evidence : undefined, start = r._tag === "disputed" ? r.start : undefined;
  const witnesses: DisputeWitnesses = { ...opt("current", current), nextProofNonce: nextProofNonce <= f.finalizedJNonce ? f.finalizedJNonce + 1 : nextProofNonce };
  return ok(done<DisputedAccount, AccountOutput>({ _tag: "disputed", state, head: r.head, dispute: witnesses, acknowledged: r.acknowledged, evidence, mempool: [], ...opt("start", start), ...envMeta(r) }));
};
export const applyFinality = (r: AccountReplica, input: AccountInputFor<"external_finality">): Verb<DisputedAccount> =>
  input.finality.kind === "dispute_started" ? disputeStarted(r, input.finality) : disputeFinalized(r, input.finality);
export const externalFinality = accountVerb("external_finality", { open: applyFinality, proposed: applyFinality, received: applyFinality, preparing: applyFinality, disputed: applyFinality });
export const resume = accountVerb("resume", { open: { _tag: "not_preparing" }, proposed: { _tag: "not_preparing" }, received: { _tag: "not_preparing" }, preparing: resumePreparing, disputed: frozenError("disputed") });


export const admissionFold = (mempool: readonly WireAccountTx[], added: number, s: AccountBody, self: EntityId, at: FoldAt, settlement?: SettlementCtx): Result<void, AccountReplicaError> => chain(partyOf(s.account.id, self), (party) => {
  const first = proposalFold(s, mempool, foldCtx(at, party.left, settlement)).refused.find((x) => x.index >= mempool.length - added);
  return first === undefined ? ok(undefined) : err(first.error);
});
const ENTITY_WORD = /^0x[0-9a-f]{64}$/;
export const genesisReplica = (id: AccountId, terms: AccountTerms): Result<OpenAccount, AccountReplicaError> => {
  if (!ENTITY_WORD.test(id.left) || !ENTITY_WORD.test(id.right)) return err({ _tag: "bad_account", reason: "entity_id" });
  if (id.left === id.right) return err({ _tag: "bad_account", reason: "same_entity" });
  return map(mapErr(accountTerms(terms), (e): AccountReplicaError => ({ _tag: "bad_account", reason: e._tag })), (normalized): OpenAccount =>
    ({ _tag: "open", state: genesisAccountBody(genesisAccount(id), normalized), head: genesisAccountHead(), mempool: [], dispute: genesisWitnesses() }));
};
export type LiveAccount = OpenAccount | ProposedAccount | ReceivedAccount;
type Queued<R extends AccountReplica = AccountReplica> = { readonly replica: R; readonly queued: readonly WireAccountTx[] };
/** og local-tx-admission.ts: dedupe against mempool + own pending frame; the limit counts both (mempool.ts). A received frame is committed in og, so it pends nothing. og has no status gate: a frozen Account queues too. */
const queueOn = <R extends AccountReplica>(r: R, pending: readonly WireAccountTx[], txs: readonly WireAccountTx[]): Result<Queued<R>, AccountReplicaError> => {
  const queued = unqueued(txs, [...r.mempool, ...pending]);
  return r.mempool.length + pending.length + queued.length > ACCOUNT_MEMPOOL_SIZE ? err({ _tag: "mempool_full", limit: ACCOUNT_MEMPOOL_SIZE }) : ok({ replica: { ...r, mempool: [...r.mempool, ...queued] }, queued });
};
const enqueue = (r: AccountReplica, txs: readonly WireAccountTx[]): Result<Queued, AccountReplicaError> => match(r, {
  open: (o) => queueOn<AccountReplica>(o, [], txs), proposed: (p) => queueOn<AccountReplica>(p, p.candidate.frame.txs, txs), received: (h) => queueOn<AccountReplica>(h, [], txs),
  preparing: (f) => queueOn<AccountReplica>(f, [], txs), disputed: (f) => queueOn<AccountReplica>(f, [], txs),
});
const isLive = (r: AccountReplica): r is LiveAccount => r._tag === "open" || r._tag === "proposed" || r._tag === "received";
/** The state and height the next proposal builds on: a held candidate is about to commit. */
const nextBase = (r: LiveAccount): { readonly state: AccountBody; readonly height: bigint } => (r._tag === "open" ? { state: r.state, height: r.head.height } : { state: r.candidate.draft.state, height: r.candidate.frame.height });
/** og applyAccountEnqueue: the Account-level lane admits in every status. */
export const admit = (r: AccountReplica, txs: readonly WireAccountTx[]): Result<AccountReplica, AccountReplicaError> => map(enqueue(r, txs), (q) => q.replica);
/** Entity-owned admission. og tx-effects.ts shouldSuppressReturnedAccountTx: a frozen Account silently takes no new work. */
export const admitAt = (r: AccountReplica, txs: readonly WireAccountTx[], self: EntityId, clock: FrameClock, verify?: Verify): Result<AccountReplica, AccountReplicaError> => chain(partyOf(replicaId(r), self), () => !isLive(r) ? ok(r)
  : chain(enqueue(r, txs), ({ replica, queued }): Result<AccountReplica, AccountReplicaError> => { if (!isLive(replica)) return ok(replica); const base = nextBase(replica); return map(admissionFold(replica.mempool, queued.length, base.state, self, { height: base.height + 1n, ...clock }, verify === undefined ? undefined : settlementOf(replica.dispute, verify)), () => replica); }));
const accountContext = (r: AccountReplica, ctx: DoorContext): Result<AccountContext, AccountReplicaError> => map(partyOf(replicaId(r), ctx.self), (party) => ({ verify: ctx.verify, party, ...opt("counterpartyBoard", ctx.counterpartyBoard) }));
export const applyAccountInput = (r: AccountReplica, input: AccountInput, ctx: DoorContext): Result<AccountApply, AccountReplicaError> => chain(accountContext(r, ctx), (c) => matchBy("kind", input, {
  propose: (i) => propose(r, i, c), freeze: (i) => freezeAccount(r, i, c), resume: (i) => resume(r, i, c),
  dispute: (i) => chain(checkEnvelope(replicaId(r), r.state.terms, i), (sender) => dispute(r, i, { ...c, from: sender })),
  board_hanko_refresh: (i) => chain(checkEnvelope(replicaId(r), r.state.terms, i), (sender) => boardHankoRefresh(r, i, { ...c, from: sender })),
  external_finality: (i) => chain(checkEnvelope(replicaId(r), r.state.terms, i), () => externalFinality(r, i, c)),
  ack: (i) => chain(checkEnvelope(replicaId(r), r.state.terms, i), (sender) => ack(r, i, { ...c, delivery: sender === c.party.self ? { _tag: "local" } : { _tag: "received", from: sender } })),
  ack_frame: (i) => chain(checkEnvelope(replicaId(r), r.state.terms, i), (sender) => ackFrame(r, i, { ...c, now: ctx.now, finalizedJHeight: ctx.finalizedJHeight ?? r.state.finalizedJHeight, from: sender })),
}));
export const applyDelivered = (r: AccountReplica, input: AccountInput, delivery: Delivery, ctx: DoorContext): Result<AccountApply, AccountReplicaError> =>
  chain(matchBy("kind", input, {
    propose: (): Result<void, AccountReplicaError> => localOnly(delivery),
    freeze: (): Result<void, AccountReplicaError> => localOnly(delivery), resume: (): Result<void, AccountReplicaError> => localOnly(delivery),
    external_finality: (): Result<void, AccountReplicaError> => localOnly(delivery),
    dispute: (m): Result<void, AccountReplicaError> => deliveredBy(m, ctx.self, delivery),
    board_hanko_refresh: (m): Result<void, AccountReplicaError> => deliveredBy(m, ctx.self, delivery),
    ack: (m): Result<void, AccountReplicaError> => deliveredBy(m, ctx.self, delivery),
    ack_frame: (m): Result<void, AccountReplicaError> => deliveredBy(m, ctx.self, delivery),
  }), () => applyAccountInput(r, input, ctx));
export const disputeUnsafe = (r: AccountReplica, applied: Result<AccountApply, AccountReplicaError>, ctx: DoorContext): Result<AccountApply, AccountReplicaError> => {
  if (applied.ok) return applied;
  const after = applied.error._tag === "rejected_after_ack" ? applied.error : undefined;
  const evidence = evidenceOf(after?.cause ?? applied.error);
  if (evidence === null) return applied;
  return map(applyAccountInput(after?.committed.replica ?? r, { kind: "freeze", evidence }, ctx), (d) => ({ replica: d.replica, outputs: [...(after?.committed.outputs ?? []), ...d.outputs] }));
};
export const restoreAccount = (r: AccountReplica, self: EntityId, verify: Verify): Result<AccountReplica, AccountReplicaError> => chain(partyOf(replicaId(r), self), (party) => {
  const restored = <R extends ProposedAccount | ReceivedAccount>(held: R): Result<AccountReplica, AccountReplicaError> => map(restoreCandidate(held, party, verify), (candidate) => ({ ...held, candidate }));
  const kept = (x: AccountReplica): Result<AccountReplica, AccountReplicaError> => ok(x);
  return match(r, { open: kept, proposed: restored, received: restored, preparing: kept, disputed: kept });
});


export type Head = { readonly height: bigint; readonly prevFrameHash: EntityFrameHash };
export const genesisHead = (): Head => ({ height: 0n, prevFrameHash: ZERO_HASH as EntityFrameHash });
export type MemberVerify = (h: Hash, sig: Signature, addr: Address) => boolean;
/** The replica's own signer key (og `signAccountFrame(env, signerId, hash)`), one signature per manifest entry. */
export type MemberSign = (h: Hash, addr: Address) => Result<Signature, unknown>;
type Members = ReadonlyMap<Address, { readonly shares: bigint }>;
type TeachingQuorum = { readonly threshold: bigint; readonly members: Members };
type BoardQuorum = { readonly board: Board; readonly entityId: string };
export type Authority = Tagged<"teaching", TeachingQuorum> | Tagged<"board", BoardQuorum>;
/** `proposer` is og's CEO leader: `validators[0]` in stored (positional) order (og leader/index.ts getEntityLeaderOrder). */
export type Quorum = Authority & { readonly proposer: Address };
/** og `config.jurisdiction` beyond the account Domain; committed inside the root's config section when present. */
export type JurisdictionConfig = {
  readonly entityProviderAddress: string; readonly registrationBlock?: number | undefined; readonly entityProviderDeploymentBlock?: number | undefined; readonly blockTimeMs?: number | undefined;
  readonly rebalancePolicyUsd?: { readonly r2cRequestSoftLimit: bigint; readonly hardLimit: bigint; readonly maxFee: bigint } | undefined;
};
/** og EntityState root fields the rewrite carries without interpreting (nonces, reserves, profile, crontabState, ...), by og field name; collection fields in committed radix form. */
export type EntityCommitted = { readonly [field: string]: Binary };
/** og EntityLeaderState: absent until the first frame; every proposal state carries it (og buildProposalState). */
export type LeaderState = { readonly activeValidatorId: string; readonly view: number; readonly changedAtHeight: number };
export type EntityState = {
  readonly id: EntityId; readonly quorum: Quorum; readonly jurisdiction: Domain; readonly accounts: ReadonlyMap<EntityId, AccountState>;
  readonly height: bigint; readonly timestamp: bigint; readonly jurisdictionConfig?: JurisdictionConfig | undefined; readonly committed: EntityCommitted;
  readonly leaderState?: LeaderState | undefined;
};
/** og EntityLeaderTimeoutVoteBody (leader/index.ts buildEntityLeaderVoteBody). */
export type LeaderVoteBody = { readonly entityId: string; readonly targetHeight: number; readonly previousFrameHash: string; readonly fromView: number; readonly toView: number; readonly previousLeaderId: string; readonly nextLeaderId: string };
/** og vote.preparedFrame: the voter's exact locked frame with every precommit bundle it holds (og collectedSigs). */
export type PreparedFrame = { readonly frame: EntityFrame; readonly signatures: Precommits };
export type LeaderVote = LeaderVoteBody & { readonly voterId: string; readonly signature: string; readonly preparedFrame?: PreparedFrame | undefined };
/** og EntityLeaderCertificate: compact `votes` unless some vote carried prepared evidence (`preparedVotes`). */
export type LeaderCertificate = LeaderVoteBody & { readonly votes: ReadonlyMap<string, string>; readonly preparedVotes?: ReadonlyMap<string, LeaderVote> | undefined; readonly preparedFrameHash?: string | undefined };
/** og EntityFrame.leader: not in the frame hash; bound through the committed leaderState in stateRoot/authorityRoot. */
export type FrameLeader = { readonly proposerSignerId: string; readonly view: number; readonly certificate?: LeaderCertificate | undefined; readonly relayCertificate?: LeaderCertificate | undefined };
/** og `core/types/entity-tx.ts` wire shape `{type, data}`. Account frames are proposed by the Entity frame itself (og proposePendingAccountFrames). */
export type EntityTx =
  | { readonly type: "openAccount"; readonly data: { readonly targetEntityId: EntityId; readonly disputeConfig: DisputeConfig; readonly accountDomain: Domain; readonly watchSeed: string; readonly creditAmount?: bigint | undefined; readonly tokenId?: TokenId | undefined; readonly pinPublic?: boolean | undefined } }
  | { readonly type: "accountInput"; readonly data: AccountPeerInput }
  | { readonly type: "extendCredit"; readonly data: { readonly counterpartyEntityId: EntityId; readonly tokenId: TokenId; readonly amount: bigint } }
  | { readonly type: "directPayment"; readonly data: { readonly targetEntityId: EntityId; readonly tokenId: TokenId; readonly amount: bigint; readonly route: readonly EntityId[]; readonly description?: string | undefined; readonly deliveryMode: "direct" | "trusted"; readonly trustedGatewayEntityId?: EntityId | undefined } }
  /** og chat / chatMessage: frame-local messages, never part of the committed state. */
  | { readonly type: "chat"; readonly data: { readonly from: string; readonly message: string } }
  | { readonly type: "chatMessage"; readonly data: { readonly message: string; readonly timestamp: number; readonly metadata?: Readonly<Record<string, unknown>> | undefined } }
  | { readonly type: "requestCollateral"; readonly data: { readonly counterpartyEntityId: EntityId; readonly tokenId: TokenId; readonly amount: bigint; readonly feeTokenId?: TokenId | undefined; readonly feeAmount: bigint; readonly policyVersion: number } }
  | { readonly type: "profile-update"; readonly data: { readonly profile: ProfileUpdate } }
  /** og entityCommand: one board member's signed individual command (og command/command-codec.ts SignedEntityCommandV1). */
  | { readonly type: "entityCommand"; readonly data: EntityCommand }
  /** og governance (system/basic.ts): a board proposal and a vote on it; both reach the reducer only inside an entityCommand. */
  | { readonly type: "propose"; readonly data: { readonly action: ProposalAction; readonly proposer: string } }
  | { readonly type: "vote"; readonly data: { readonly proposalId: string; readonly voter: string; readonly choice: "yes" | "no"; readonly comment?: string | undefined } }
  | LendingEntityTx;
/** og SignedEntityCommandV1: `signature` is og's `0x` compact signature (recovery 0/1) over hashEntityCommand. */
export type EntityCommand = {
  readonly version: 1; readonly entityId: string; readonly stackKey: string; readonly boardHash: string; readonly boardEpoch: number;
  readonly authorSignerId: string; readonly authorSigner: string; readonly nonce: bigint; readonly txsHash: string; readonly txs: readonly EntityTx[]; readonly signature: string;
};
/** og ProposalAction (entity/types.ts). */
export type ProposalAction =
  | { readonly type: "collective_message"; readonly data: { readonly message: string } }
  | { readonly type: "entity_transaction"; readonly data: { readonly version: 1; readonly actionHash: string; readonly txs: readonly EntityTx[] } };
/** og EntityFrameEvent (frame-events.ts): certified in the frame hash (`events`), never durable state. */
export type FrameEvent = { readonly type: "status"; readonly message: string } | { readonly type: "text"; readonly validatorId: string; readonly message: string };
/** og types/entity-tx.ts lendingOffer/Borrow/Repay/ClosePosition: each queues one Account lending tx on the hub Account. */
export type LendingEntityTx =
  | { readonly type: "lendingOffer"; readonly data: { readonly positionId: string; readonly hubEntityId: string; readonly tokenId: TokenId; readonly amount: bigint; readonly termId: string; readonly interestBps: number } }
  | { readonly type: "lendingBorrow"; readonly data: { readonly requestId: string; readonly hubEntityId: string; readonly tokenId: TokenId; readonly amount: bigint; readonly termId: string; readonly maxInterestBps?: number | undefined } }
  | { readonly type: "lendingRepay"; readonly data: { readonly hubEntityId: string; readonly loanId: string; readonly tokenId: TokenId; readonly amount: bigint } }
  | { readonly type: "lendingClosePosition"; readonly data: { readonly hubEntityId: string; readonly positionId: string } };
/** og ProfileUpdateTx & { entityId }. */
export type ProfileUpdate = { readonly entityId: string; readonly name?: string | undefined; readonly entityKind?: string | null | undefined; readonly sectors?: readonly string[] | undefined; readonly avatar?: string | undefined; readonly bio?: string | undefined; readonly website?: string | undefined };
export type HashToSign = { readonly hash: string; readonly type: "entityFrame" | "accountFrame" | "dispute"; readonly context: string };
export type EntityFrame = Head & {
  readonly timestamp: bigint; readonly txs: readonly EntityTx[]; readonly events: readonly Binary[]; readonly stateRoot: string; readonly authorityRoot: string;
  readonly entityContext: EntityInfraContext; readonly hashesToSign: readonly HashToSign[]; readonly leader: FrameLeader;
};
/** og `hashPrecommits`/`collectedSigs`: lowercase signer id to one signature per `hashesToSign` entry. */
export type Precommits = ReadonlyMap<string, readonly Signature[]>;
export type OutputTx = Extract<EntityTx, { readonly type: "accountInput" }>;
/** An Account message for a peer entity's leader, or an og consensus input for one validator replica of this entity. */
export type EntityOutput = { readonly to: EntityId; readonly tx: OutputTx } | { readonly to: EntityId; readonly signerId: Address; readonly input: EntityInput };
/** og EntityInput lanes: `entityTxs`, `proposedFrame` (+`collectedSigs`), `hashPrecommitFrame` + `hashPrecommits`. */
export type EntityInput =
  | { readonly kind: "txs"; readonly timestamp: bigint; readonly txs: readonly EntityTx[] }
  | { readonly kind: "proposal"; readonly frame: EntityFrame; readonly signatures: Precommits }
  | { readonly kind: "precommit"; readonly height: bigint; readonly frameHash: EntityFrameHash; readonly signatures: Precommits }
  /** og `leaderTimeoutVote` lane. `local` is og's process-local marker: the scheduler's unsigned intent for this replica's own signer, never set on an output. */
  | { readonly kind: "leaderTimeoutVote"; readonly timestamp: bigint; readonly vote: LeaderVote; readonly local?: boolean | undefined };
export type EntityPhase = "open" | "proposed" | "locked";
export type EntityEvent = EntityInput["kind"];
export type Folded = { readonly state: EntityState; readonly accountReplicas: ReadonlyMap<EntityId, AccountReplica> };
/** `events`: og frame events the folded txs emitted (og addMessage / addTextMessage), in order. */
export type Draft = Folded & { readonly outputs: readonly EntityOutput[]; readonly events?: readonly FrameEvent[] | undefined; readonly touched?: readonly EntityId[] | undefined };
/** og replica `leaderVotes` (one collection key at a time) and `pendingLeaderCertificate`. */
type LeaderLane = { readonly leaderVotes?: ReadonlyMap<string, LeaderVote> | undefined; readonly pendingLeaderCertificate?: LeaderCertificate | undefined };
type EntityEnv = Folded & LeaderLane & { readonly signerId: Address; readonly head: Head; readonly mempool: readonly EntityTx[] };
type EntityCandidate = { readonly frame: EntityFrame; readonly signatures: Precommits; readonly draft: Draft };
export interface OpenEntity extends Tagged<"open", EntityEnv> {}
/** og `proposal`: this replica proposed `frame` and collects precommits. */
export interface ProposedEntity extends Tagged<"proposed", EntityEnv & EntityCandidate> {}
/** og `lockedFrame`: this validator replayed and signed `frame`. */
export interface LockedEntity extends Tagged<"locked", EntityEnv & EntityCandidate> {}
export type EntityReplica = OpenEntity | ProposedEntity | LockedEntity;
export type EntityContext = { readonly verify: Verify; readonly verifyMember: MemberVerify; readonly sign: MemberSign; readonly self: EntityId; readonly signerId: Address; readonly from?: EntityId | undefined };
export type EntityFrameHashError = BinaryError | Tagged<"frame_clock", { readonly value: bigint }> | Tagged<"frame_root", { readonly value: string }> | Tagged<"frame_too_large">;
export type EntityError =
  | AccountReplicaError | EntityRootError | EntityFrameHashError
  | Tagged<"account_exists" | "no_such_account" | "create_ack_required" | "account_envelope", { target: EntityId }>
  | Tagged<"self_account" | "wrong_entity" | "bad_quorum" | "bad_jurisdiction" | "from_not_converted" | "not_l0" | "mempool_full" | "sign_failed" | "payment_route" | "secondary_hash_duplicate">
  | Tagged<"frame_timestamp_invalid" | "frame_timestamp_regression", { timestamp: bigint }>
  | Tagged<"lending_entity", { reason: string }>
  /** og EntityCommandRejectionError (a MalformedEntityFrameInputError): the outermost frame tx is evicted. */
  | Tagged<"entity_command", { reason: string }>
  /** og plain Error from an entity-tx reducer: not a reject disposition, so the whole input is refused. */
  | Tagged<"entity_invariant", { reason: string }>
  | Tagged<"proposal_digest" | "proposal_parent" | "proposal_leader" | "proposal_hash" | "proposal_manifest" | "proposal_signature" | "proposal_conflict" | "proposal_wait" | "local_manifest_mismatch" | "local_precommit_conflict">
  | Tagged<"precommit_frame_mismatch" | "precommit_not_active" | "precommit_signer_equivocation" | "commit_conflict" | "commit_wait">
  | Tagged<"leader_vote_invalid" | "leader_vote_equivocation" | "leader_prepared_rejected" | "proposal_superseded" | "hanko_build">
  | Tagged<"profile_update", { reason: "entity" | "entity_kind" | "sectors_invalid" | "sectors_noncanonical" }>
  | Tagged<"unknown_member" | "duplicate_member" | "not_proposer" | "invalid_signature" | "wrong_replica", { address: string }>;
export type EntityGrammar = { readonly table: typeof EntityTransition; readonly replica: EntityReplica; readonly input: EntityInput; readonly ctx: { readonly [E in EntityEvent]: EntityContext }; readonly output: EntityOutput; readonly error: EntityError };
export type NextEntityPhase<S extends EntityPhase, E extends EntityEvent> = Next<EntityGrammar, S, E>;
type EntityApply<R extends EntityReplica = EntityReplica> = Apply<R, EntityOutput>;
export const encodeEntityTx = (tx: EntityTx): string => `${tx.type}|${canon(tx.data)}`;
export const encodeEntityState = (s: EntityState): string => canon({
  id: s.id,
  quorum: match(s.quorum, { teaching: (q) => ({ threshold: q.threshold, members: q.members }), board: (q) => ({ board: encodeBoardHash({ board: q.board }), entityId: q.entityId }) }),
  jurisdiction: s.jurisdiction, accounts: new Map([...s.accounts].map(([peer, a]) => [peer, hashAccountState(a)])),
  height: s.height, timestamp: s.timestamp, jurisdictionConfig: s.jurisdictionConfig, committed: s.committed, leaderState: s.leaderState,
} satisfies Record<keyof EntityState, unknown>);
export const hashEntityState = (s: EntityState): EntityStateHash => keccakUtf8(encodeEntityState(s)) as EntityStateHash;
const HEX_EXT = 0x48;
const hexBytes = (value: string): Uint8Array => {
  const count = (value.length - 2) >> 1;
  const out = new Uint8Array(count);
  for (let i = 0; i < count; i++) {
    const high = value.charCodeAt(2 + (i << 1));
    const low = value.charCodeAt(3 + (i << 1));
    out[i] = ((high <= 57 ? high - 48 : high - 87) << 4) | (low <= 57 ? low - 48 : low - 87);
  }
  return out;
};
/** msgpackr registers one class for the process. `hexBytes` is the conversion. */
class HexPack { readonly bytes: Uint8Array; constructor(value: string) { this.bytes = hexBytes(value); } }
addExtension({ Class: HexPack, type: HEX_EXT, pack: (value: HexPack) => value.bytes, unpack: (bytes: Uint8Array) => bytesToHex(bytes) });
const binaryPack = new Packr({ mapsAsObjects: false, moreTypes: true });
export type Binary =
  | null | boolean | number | bigint | string
  | readonly Binary[]
  | ReadonlyMap<Binary, Binary>
  | { readonly [key: string]: Binary };
export type BinaryError = Tagged<"binary">;
const compareBytes = (left: Uint8Array, right: Uint8Array): number => {
  for (let i = 0; i < Math.min(left.length, right.length); i++) if (left[i] !== right[i]) return (left[i] ?? 0) - (right[i] ?? 0);
  return left.length - right.length;
};
const packedHex = (value: string): HexPack | string =>
  value.length >= 34 && value.startsWith("0x") && value.length % 2 === 0 && /^0x[0-9a-f]+$/.test(value) ? new HexPack(value) : value;
const walkBinary = (value: Binary): Result<Binary | HexPack, BinaryError> => {
  if (value === null || typeof value === "boolean" || typeof value === "bigint") return ok(value);
  // og binary-codec.ts canonicalize: no non-finite, unsafe-integer or negative-zero numbers.
  if (typeof value === "number") return !Number.isFinite(value) || (Number.isInteger(value) && !Number.isSafeInteger(value)) || Object.is(value, -0) ? err({ _tag: "binary" }) : ok(value);
  if (typeof value === "string") return ok(packedHex(value));
  if (Array.isArray(value)) {
    const items: (Binary | HexPack)[] = [];
    for (const item of value) {
      const walked = walkBinary(item);
      if (!walked.ok) return walked;
      items.push(walked.value);
    }
    return ok(items as Binary);
  }
  if (value instanceof Map) {
    /** og canonicalize: entries ordered by the packed bytes of the key, then of the value. */
    const rows: { readonly key: Binary | HexPack; readonly value: Binary | HexPack; readonly bytes: Uint8Array }[] = [];
    for (const [key, item] of value as ReadonlyMap<Binary, Binary>) {
      const k = walkBinary(key), v = walkBinary(item);
      if (!k.ok) return k;
      if (!v.ok) return v;
      rows.push({ key: k.value, value: v.value, bytes: packBinary(k.value) });
    }
    rows.sort((a, b) => compareBytes(a.bytes, b.bytes) || compareBytes(packBinary(a.value), packBinary(b.value)));
    return ok(new Map(rows.map((r) => [r.key, r.value])) as unknown as Binary);
  }
  if (typeof value !== "object") return err({ _tag: "binary" });
  const out = Object.create(null) as Record<string, Binary | HexPack>;
  for (const key of Object.keys(value).sort()) {
    const walked = walkBinary((value as Record<string, Binary>)[key] as Binary);
    if (!walked.ok) return walked;
    out[key] = walked.value;
  }
  return ok(out as Binary);
};
const packBinary = (value: unknown): Uint8Array => binaryPack.pack(value) as Uint8Array;
const encodeBinary = (value: Binary): Result<Uint8Array, BinaryError> => map(walkBinary(value), (walked) => {
  const body = packBinary(walked);
  const out = new Uint8Array(1 + body.byteLength);
  out[0] = 0x03;
  out.set(body, 1);
  return out;
});
const encodeConsensus = (value: Binary): Result<Uint8Array, BinaryError> => map(walkBinary(value), packBinary);
const integrity = (bytes: Uint8Array): string => bytesToHex(sha256(bytes));
export type EntityRootJurisdiction = { readonly chainId?: number | undefined; readonly depositoryAddress: string } & JurisdictionConfig;
export type EntityRootConfig = {
  readonly mode: "proposer-based" | "gossip-based";
  readonly threshold: bigint;
  readonly validators: readonly string[];
  readonly shares: Readonly<Record<string, bigint>>;
  readonly jurisdiction?: EntityRootJurisdiction | undefined;
};
export type EntityRootAccount = {
  readonly fromEntity: string;
  readonly toEntity: string;
  readonly state: CommittedAccountState;
  readonly status: "active" | "dispute_preparing" | "disputed";
  readonly currentHeight: number;
  readonly nextProofNonce: number;
  /** og commits `currentFrame.stateHash` only when the replica has a current frame. */
  readonly currentFrameHash?: string | undefined;
  readonly pendingWithdrawals: string;
  readonly policyRoot: string;
  readonly submittedAtByTokenRoot: string;
  /** og ACCOUNT_ENTITY_COMMITTED_FIELDS that are committed only when present (state-root.ts:184); the three counterparty Hankos are committed as their integrity digest. */
  readonly committed?: Partial<Readonly<Record<EntityLeafOptional, unknown>>> | undefined;
  /** og counterpartySettlementHankos(settlementWorkspace, localIsLeft), when present. */
  readonly counterpartySettlementHankos?: unknown;
  readonly activeQuote?: unknown; readonly pendingRequest?: unknown;
  readonly rejectedFrameEvidence?: { readonly reason: unknown; readonly frameHash: unknown; readonly frameHanko: unknown } | undefined;
};
export const ENTITY_LEAF_OPTIONAL = ["publicPinned", "boardHankoRefreshMigration", "counterpartyBoardHankoRefresh", "counterpartyFrameHanko", "counterpartyDisputeProofHanko", "counterpartySettlementHanko",
  "currentDisputeProofNonce", "currentDisputeProofProposerIsLeft", "currentDisputeProofBodyHash", "currentDisputeHash", "counterpartyDisputeProofNonce", "counterpartyDisputeProofProposerIsLeft",
  "counterpartyDisputeProofBodyHash", "counterpartyDisputeHash", "disputePrepare", "activeDispute"] as const;
export type EntityLeafOptional = (typeof ENTITY_LEAF_OPTIONAL)[number];
const LEAF_HANKO_FIELDS: ReadonlySet<string> = new Set(["counterpartyFrameHanko", "counterpartyDisputeProofHanko", "counterpartySettlementHanko"]);
type EntityPaybook = {
  readonly entries: { readonly radix: 16; readonly leafCount: number; readonly root: string };
  readonly feesEarned: bigint;
};
const EMPTY_ENTITY_PAYBOOK = { entries: { radix: 16 as const, leafCount: 0, root: ZERO_WORD }, feesEarned: 0n } satisfies EntityPaybook;
export type EntityRootError = BinaryError | CommitmentError | Tagged<"bad_config" | "account_key" | "account_owner" | "duplicate_account">;
const signerId = (raw: string): string => raw.trim().toLowerCase();
const consensusConfig = (config: EntityRootConfig): Result<Binary, Tagged<"bad_config">> => {
  const shares: Record<string, bigint> = {};
  for (const [raw, share] of Object.entries(config.shares)) {
    const id = signerId(raw);
    if (id.length === 0 || Object.hasOwn(shares, id)) return err({ _tag: "bad_config" });
    shares[id] = share;
  }
  const validators = config.validators.map(signerId), j = config.jurisdiction;
  if (validators.some((id) => id.length === 0)) return err({ _tag: "bad_config" });
  if (j === undefined) return ok({ mode: config.mode, threshold: config.threshold, validators, shares });
  const depositoryAddress = j.depositoryAddress.trim().toLowerCase(), entityProviderAddress = j.entityProviderAddress.trim().toLowerCase();
  if (depositoryAddress === "" || entityProviderAddress === "") return err({ _tag: "bad_config" });
  const policy = j.rebalancePolicyUsd;
  return ok({ mode: config.mode, threshold: config.threshold, validators, shares, jurisdiction: {
    ...opt("chainId", j.chainId), depositoryAddress, entityProviderAddress, ...opt("registrationBlock", j.registrationBlock),
    ...opt("entityProviderDeploymentBlock", j.entityProviderDeploymentBlock), ...opt("blockTimeMs", j.blockTimeMs),
    ...(policy === undefined ? {} : { rebalancePolicyUsd: { r2cRequestSoftLimit: policy.r2cRequestSoftLimit, hardLimit: policy.hardLimit, maxFee: policy.maxFee } }),
  } });
};
const accountKey = (id: string): Result<Uint8Array, Tagged<"account_key">> => {
  const norm = signerId(id);
  const bytes = parseHex(norm);
  return bytes !== null && norm.startsWith("0x") && bytes.length === 32 ? ok(bytes) : err({ _tag: "account_key" });
};
const ACCOUNT_LEAF = utf8("xln.entity.account-leaf.v3");
const accountLeaf = (account: EntityRootAccount): Result<readonly [Uint8Array, Uint8Array], EntityRootError> => {
  const owner = signerId(account.fromEntity);
  if (owner !== signerId(account.state.leftEntity) && owner !== signerId(account.state.rightEntity)) return err({ _tag: "account_owner" });
  const optional = Object.fromEntries(ENTITY_LEAF_OPTIONAL.flatMap((field) => {
    const value = account.committed?.[field];
    return value === undefined ? [] : [[field, LEAF_HANKO_FIELDS.has(field) && typeof value === "string" ? integrity(utf8(value)) : value]];
  }));
  return chain(accountKey(account.toEntity), (key) => chain(accountStateCommitment(account.state), (accountStateRoot) => chain(encodeCanonicalValue({
    ...optional, status: account.status, currentHeight: account.currentHeight,
    proofHeader: { fromEntity: account.fromEntity, toEntity: account.toEntity, nextProofNonce: account.nextProofNonce },
    accountStateRoot, ...opt("currentFrameHash", account.currentFrameHash), ...opt("counterpartySettlementHankos", account.counterpartySettlementHankos), pendingWithdrawals: account.pendingWithdrawals,
    shadow: {
      rebalance: { policyRoot: account.policyRoot, submittedAtByTokenRoot: account.submittedAtByTokenRoot, ...opt("activeQuote", account.activeQuote), ...opt("pendingRequest", account.pendingRequest) },
      ...opt("rejectedFrameEvidence", account.rejectedFrameEvidence),
    },
  }), (encoded) => ok([key, sha256(concat([ACCOUNT_LEAF, encoded]))] as const))));
};
const sectionDigest = (value: Binary): Result<string, BinaryError> => map(encodeConsensus(value), integrity);
/** og ENTITY_STATE_ROOT_FIELDS (state-root.ts:50). Every present field is one root section. */
export const ENTITY_STATE_ROOT_FIELDS = ["entityId", "height", "timestamp", "nonces", "entityCommandNonces", "proposals", "config", "leaderState", "reserves", "accounts", "externalWallet",
  "deferredAccountProposals", "settlementContinuations", "lastFinalizedJHeight", "jHistoryFinality", "certifiedBoardState", "crontabState", "jBatchState", "entityProviderActionState",
  "entityEncryptionPublicKey", "profile", "paybook", "outDebtsByToken", "inDebtsByToken", "orderbookExt", "swapTradingPairs", "crossJurisdictionSwaps", "crossJurisdictionAuthorizations",
  "crossJurisdictionBookAdmissions", "hubRebalanceConfig", "lending"] as const;
/** Derived by the rewrite itself; never taken from `committed`. `leaderState` is the replica's og leader failover state. */
const DERIVED_ROOT_FIELDS: ReadonlySet<string> = new Set(["entityId", "height", "timestamp", "config", "accounts", "leaderState"]);
export type EntityRootInput = {
  readonly config: EntityRootConfig; readonly accounts: readonly EntityRootAccount[];
  readonly entityId?: string | undefined; readonly height?: number | undefined; readonly timestamp?: number | undefined; readonly committed?: EntityCommitted | undefined;
  readonly leaderState?: LeaderState | undefined;
};
export const entityStateRoot = (input: EntityRootInput): Result<string, EntityRootError> =>
  chain(consensusConfig(input.config), (config) => chain(traverse(input.accounts, accountLeaf), (leaves): Result<string, EntityRootError> => {
    const seen = new Set<string>();
    for (const [key] of leaves) { const id = bytesToHex(key); if (seen.has(id)) return err({ _tag: "duplicate_account" }); seen.add(id); }
    const root = sealRadix(leaves.map(([key, digest]) => ({ nibbles: nibblesOf(key), key, digest })));
    const committed = Object.entries(input.committed ?? {}).filter(([field]) => (ENTITY_STATE_ROOT_FIELDS as readonly string[]).includes(field) && !DERIVED_ROOT_FIELDS.has(field));
    const sections: readonly (readonly [string, Binary])[] = [
      ["accounts", { domain: "xln.entity.accounts.radix-merkle:binary", radix: 16, hashAlgorithm: "integrity", leafCount: leaves.length, root }],
      ["config", config],
      ...(committed.some(([field]) => field === "paybook") ? [] : [["paybook", EMPTY_ENTITY_PAYBOOK] as const]),
      ...(input.entityId === undefined ? [] : [["entityId", input.entityId] as const]),
      ...(input.height === undefined ? [] : [["height", input.height] as const]),
      ...(input.timestamp === undefined ? [] : [["timestamp", input.timestamp] as const]),
      ...(input.leaderState === undefined ? [] : [["leaderState", { ...input.leaderState }] as const]),
      ...committed,
    ];
    return chain(traverse([...sections].sort(([left], [right]) => asc(left, right)), ([field, value]) => map(sectionDigest(value), (digest) => ({ field, digest }))),
      (committed) => map(encodeConsensus({ domain: "xln.entity.consensus-state.sections:binary", sections: committed }), (bytes) => bytesToHex(keccak_256(bytes))));
  }));
const accountInputCommitment = (value: Binary): Result<{ readonly domain: string; readonly inputDigest: string }, BinaryError> => {
  const body = encodeConsensus(value);
  if (!body.ok) return body;
  const domain = "xln:account-input-commitment:v1", mark = utf8(domain), preimage = new Uint8Array(mark.byteLength + body.value.byteLength);
  preimage.set(mark, 0); preimage.set(body.value, mark.byteLength);
  return ok({ domain, inputDigest: integrity(preimage) });
};
const entityTxForHash = (tx: EntityFrameTx): Result<{ readonly type: string; readonly data: unknown }, BinaryError> =>
  tx.type === "accountInput" ? map(accountInputCommitment(tx.data), (data) => ({ type: tx.type, data })) : ok(tx);
const entityTxDigest = (txs: readonly EntityFrameTx[]): Result<{ readonly digest: string; readonly bytes: number }, BinaryError> => {
  const encoded: Uint8Array[] = [];
  for (const tx of txs) {
    const hashed = entityTxForHash(tx);
    if (!hashed.ok) return hashed;
    const bytes = encodeBinary(hashed.value as Binary);
    if (!bytes.ok) return bytes;
    encoded.push(bytes.value);
  }
  const domain = utf8("xln:entity-frame-txs:binary");
  const preimage = new Uint8Array(domain.byteLength + encoded.reduce((n, bytes) => n + 4 + bytes.byteLength, 0));
  preimage.set(domain, 0);
  const view = new DataView(preimage.buffer);
  let offset = domain.byteLength;
  for (const bytes of encoded) { view.setUint32(offset, bytes.byteLength); preimage.set(bytes, offset + 4); offset += 4 + bytes.byteLength; }
  return ok({ digest: integrity(preimage), bytes: offset - domain.byteLength });
};
export type EntityInfraContext = {
  readonly version: number; readonly proposerReplicaId: string; readonly entityId: string; readonly proposerSignerId: string;
  readonly parentFrameHash: string; readonly height: number;
  readonly gossipProfiles: readonly Binary[]; readonly peerAssertions: readonly Binary[];
  readonly htlc: { readonly version: number; readonly entries: readonly Binary[]; readonly originated: readonly Binary[] };
};
export type EntityFrameTx = { readonly type: string; readonly data: Binary };
export type EntityFrameHashInput = {
  readonly prevFrameHash: string; readonly height: number; readonly timestamp: number;
  readonly txs: readonly EntityFrameTx[]; readonly events: readonly Binary[];
  readonly entityId: string; readonly stateRoot: string; readonly authorityRoot: string; readonly entityContext: EntityInfraContext;
  readonly jPrefixCertificate?: Binary | null;
};
/** og LIMITS.MAX_FRAME_SIZE_BYTES: the event budget and the whole frame (header + context + length-prefixed txs). */
const MAX_FRAME_SIZE_BYTES = 100_000_000;
/** og createEntityFrameHashFromStateRoot (frame.ts:393): event budget, canonical lowercase roots, then the total wire budget. */
export const entityFrameHash = (input: EntityFrameHashInput): Result<string, EntityFrameHashError> => {
  const events = input.events.length === 0 ? ok(new Uint8Array()) : encodeBinary(input.events);
  if (!events.ok) return events;
  if (events.value.byteLength > MAX_FRAME_SIZE_BYTES) return err({ _tag: "frame_too_large" });
  for (const root of [input.stateRoot, input.authorityRoot]) if (!/^0x[0-9a-f]{64}$/.test(root)) return err({ _tag: "frame_root", value: root });
  const txs = entityTxDigest(input.txs);
  if (!txs.ok) return txs;
  const context = encodeBinary(input.entityContext);
  if (!context.ok) return context;
  const header = encodeBinary({
    domain: "xln:entity-frame:binary-context-digest",
    prevFrameHash: input.prevFrameHash, height: input.height, timestamp: input.timestamp, txCount: input.txs.length, txsDigest: txs.value.digest,
    events: input.events, entityId: input.entityId, stateRoot: input.stateRoot.toLowerCase(), authorityRoot: input.authorityRoot.toLowerCase(),
    entityContextDigest: integrity(context.value), jPrefixCertificate: input.jPrefixCertificate ?? null,
  });
  if (!header.ok) return header;
  return header.value.byteLength + context.value.byteLength + txs.value.bytes > MAX_FRAME_SIZE_BYTES ? err({ _tag: "frame_too_large" }) : ok(bytesToHex(keccak_256(header.value)));
};

/** og getPrevFrameHash: height 0 links to the literal "genesis". */
const frameWord = (value: string): string => value === "genesis" ? value : value.startsWith("0x") ? value.toLowerCase() : `0x${value.toLowerCase()}`;
const frameNumber = (value: bigint): Result<number, EntityFrameHashError> =>
  value >= 0n && value <= BigInt(Number.MAX_SAFE_INTEGER) ? ok(Number(value)) : err({ _tag: "frame_clock", value });
const binaryBody = (value: unknown): Result<Binary, BinaryError> => {
  if (value === null || typeof value === "boolean" || typeof value === "bigint" || typeof value === "number" || typeof value === "string") return ok(value);
  if (Array.isArray(value)) return traverse(value, binaryBody);
  if (typeof value !== "object" || ArrayBuffer.isView(value) || value instanceof Map || value instanceof Set) return err({ _tag: "binary" });
  const proto = Object.getPrototypeOf(value);
  if (proto !== Object.prototype && proto !== null) return err({ _tag: "binary" });
  const out: Record<string, Binary> = {};
  for (const key of Object.keys(value)) {
    const item = (value as Record<string, unknown>)[key];
    if (item === undefined) continue;
    const walked = binaryBody(item);
    if (!walked.ok) return walked;
    out[key] = walked.value;
  }
  return ok(out);
};
/** og wire: token ids are numbers inside entity tx data. */
const wireData = (tx: EntityTx): unknown => {
  if (tx.type === "entityCommand") return { ...tx.data, txs: tx.data.txs.map(wireEntityTx) };
  if (tx.type === "propose") return { ...tx.data, action: wireAction(tx.data.action) };
  if (tx.type === "requestCollateral") return { ...tx.data, tokenId: Number(tx.data.tokenId), ...(tx.data.feeTokenId === undefined ? {} : { feeTokenId: Number(tx.data.feeTokenId) }) };
  return tx.type !== "accountInput" && "tokenId" in tx.data && tx.data.tokenId !== undefined ? { ...tx.data, tokenId: Number(tx.data.tokenId) } : tx.data;
};
/** og EntityTx wire object `{type, data}` (numeric token ids, nested command / proposal txs in wire form). */
export const wireEntityTx = (tx: EntityTx): { readonly type: string; readonly data: unknown } => ({ type: tx.type, data: wireData(tx) });
const wireAction = (a: ProposalAction): unknown => (a.type === "entity_transaction" ? { type: a.type, data: { ...a.data, txs: a.data.txs.map(wireEntityTx) } } : a);
/** Inverse of wireData for the collective txs a stored proposal carries: token ids back to the rewrite's TokenId strings. */
const unwireEntityTx = (w: { readonly type: string; readonly data: unknown }): EntityTx => {
  const data = { ...(w.data as Record<string, unknown>) };
  for (const k of ["tokenId", "feeTokenId"]) if (typeof data[k] === "number") data[k] = String(data[k]);
  return { type: w.type, data } as EntityTx;
};
const entityFrameTx =(tx: EntityTx): Result<EntityFrameTx, BinaryError> => map(binaryBody(wireData(tx)), (data) => ({ type: tx.type, data }));
export const hashEntityFrame = (f: EntityFrame): Result<EntityFrameHash, EntityFrameHashError> =>
  chain(frameNumber(f.height), (height) => chain(frameNumber(f.timestamp), (timestamp) => chain(traverse(f.txs, entityFrameTx), (txs) => map(entityFrameHash({
    prevFrameHash: frameWord(f.prevFrameHash), height, timestamp, txs, events: f.events, entityId: f.entityContext.entityId,
    stateRoot: f.stateRoot, authorityRoot: f.authorityRoot, entityContext: f.entityContext,
  }), (digest) => digest as EntityFrameHash))));
/** og getEntityLeaderState without a view change: the CEO `validators[0]`. */
export const allowedProposer = (q: Quorum): Address => q.proposer;
const boardMembers = (board: Board): Members => new Map(board.entityIds.map((id, i) => [checksum(`0x${id.slice(-40)}`) as Address, { shares: BigInt(board.votingPowers[i] ?? 0) }]));
const membersOf = (a: Authority): Members => match(a, { teaching: (x) => x.members, board: (b) => boardMembers(b.board) });
const thresholdOf = (a: Authority): bigint => match(a, { teaching: (x) => x.threshold, board: (b) => BigInt(b.board.votingThreshold) });
/** og normalizes every signer id with trim + lowercase (replica-validation.ts, certificates.ts). */
const memberId = (a: Authority, id: string): Address | undefined => [...membersOf(a).keys()].find((m) => signerId(m) === signerId(id));
const sharesOf = (a: Authority, id: string): bigint => { const m = memberId(a, id); return m === undefined ? 0n : membersOf(a).get(m)?.shares ?? 0n; };
/** og isSingleSignerBoard: exactly one validator whose share alone reaches the threshold. */
export const isSingleSigner = (a: Authority): boolean => { const [only, ...rest] = membersOf(a).keys(); return only !== undefined && rest.length === 0 && sharesOf(a, only) >= thresholdOf(a); };
const boardShaped = (a: Authority): boolean => match(a, {
  teaching: () => true,
  board: ({ board, entityId }) => WORD.test(entityId) && Number.isSafeInteger(board.votingThreshold) && board.entityIds.length === board.votingPowers.length
    && board.entityIds.every((id) => WORD.test(id) && isAddressId(id)) && board.votingPowers.every(Number.isSafeInteger) && boardMembers(board).size === board.entityIds.length,
});
const UINT16 = 0xffffn;
/** og validateConsensusConfig: unique (case-insensitive) validators, uint16 threshold and shares, 1 <= threshold <= total power. */
const admitQuorum = (a: Authority): Result<Quorum, EntityError> => {
  if (!boardShaped(a)) return err({ _tag: "bad_quorum" });
  const members = membersOf(a), ids = [...members.keys()].map(signerId), shares = [...members.values()].map((m) => m.shares), threshold = thresholdOf(a), [proposer] = members.keys();
  if (proposer === undefined || ids.some((id) => id.length === 0) || new Set(ids).size !== ids.length || threshold < 1n || threshold > UINT16
    || shares.some((n) => n < 1n || n > UINT16) || threshold > shares.reduce((sum, n) => sum + n, 0n)) return err({ _tag: "bad_quorum" });
  return ok({ ...a, proposer });
};
const openEntity = (signer: Address, state: EntityState, head: Head, mempool: readonly EntityTx[], accountReplicas: ReadonlyMap<EntityId, AccountReplica>): OpenEntity =>
  ({ _tag: "open", signerId: signer, state, head, mempool, accountReplicas });
type EntitySeed = {
  readonly id: EntityId; readonly jurisdiction: Domain; readonly signerId?: Address | undefined; readonly timestamp?: bigint | undefined;
  readonly jurisdictionConfig?: JurisdictionConfig | undefined; readonly committed?: EntityCommitted | undefined;
} & (TeachingQuorum | { readonly board: Board & { readonly entityId: string } });
/** One validator replica (og `eReplicas` key `entityId:signerId`); `signerId` defaults to the proposer. */
export const createEntity = (p: EntitySeed): Result<OpenEntity, EntityError> => {
  const authority: Authority = "board" in p ? (({ entityId, ...board }) => ({ _tag: "board", board, entityId }))(p.board) : { _tag: "teaching", threshold: p.threshold, members: p.members };
  return chain(admitQuorum(authority), (quorum) => chain(mapErr(domainOf(p.jurisdiction), (): EntityError => ({ _tag: "bad_jurisdiction" })), (jurisdiction): Result<OpenEntity, EntityError> => {
    const signer = p.signerId === undefined ? quorum.proposer : memberId(quorum, p.signerId);
    if (signer === undefined) return err({ _tag: "unknown_member", address: p.signerId ?? "" });
    const state: EntityState = { id: p.id, quorum, jurisdiction, accounts: new Map(), height: 0n, timestamp: p.timestamp ?? 0n, ...opt("jurisdictionConfig", p.jurisdictionConfig), committed: p.committed ?? {} };
    return ok(openEntity(signer, state, genesisHead(), [], new Map()));
  }));
};
const memberSigned = (q: Quorum, h: string, sig: Signature, addr: Address, ctx: EntityContext): boolean =>
  match(q, { teaching: () => ctx.verifyMember(h as Hash, sig, addr), board: () => sameHex(recoverRawSigner(h, sig) ?? undefined, addr) });
/** og calculateQuorumPower over normalized signer ids. */
const quorumPower = (q: Quorum, sigs: Precommits): bigint => [...sigs.keys()].reduce((n, id) => n + sharesOf(q, id), 0n);
/** og normalizePrecommitBundles: trim+lowercase keys, validators only, no duplicate after normalization. */
const normalizeBundles = (q: Quorum, bundles: Precommits): Result<Precommits, EntityError> =>
  foldResult(bundles, new Map<string, readonly Signature[]>() as Precommits, (acc, [raw, sigs]): Result<Precommits, EntityError> => {
    const id = signerId(raw);
    if (memberId(q, id) === undefined) return err({ _tag: "unknown_member", address: raw });
    return acc.has(id) ? err({ _tag: "duplicate_member", address: raw }) : ok(mapSet(acc, id, sigs));
  });
/** og verifyHashPrecommitSignatures: one valid signature per manifest entry, in order. */
const bundleValid = (q: Quorum, hashes: readonly HashToSign[], id: string, sigs: readonly Signature[], ctx: EntityContext): boolean => {
  const addr = memberId(q, id);
  return addr !== undefined && hashes.length > 0 && sigs.length === hashes.length && hashes.every((h, i) => { const sig = sigs[i]; return sig !== undefined && memberSigned(q, h.hash, sig, addr, ctx); });
};
const signManifest = (hashes: readonly HashToSign[], signer: Address, ctx: EntityContext): Result<readonly Signature[], EntityError> =>
  traverse(hashes, (h) => mapErr(ctx.sign(h.hash as Hash, signer), (): EntityError => ({ _tag: "sign_failed" })));
const sameSigs = (a: readonly Signature[], b: readonly Signature[]): boolean => a.length === b.length && a.every((sig, i) => sig === b[i]);

// ---- leader failover: og leader/{index,certificates,timeout-input}.ts ----
const LEADER_TIMEOUT_BASE_MS = 10_000, LEADER_TIMEOUT_MAX_MS = 60_000;
/** og getEntityLeaderOrder: the CEO `validators[0]`, then successors by shares descending, then position. */
export const leaderOrder = (q: Quorum): readonly string[] => {
  const validators = [...membersOf(q).keys()].map(signerId), [ceo] = validators;
  if (ceo === undefined) return [];
  return [ceo, ...validators.slice(1).sort((l, r) => { const a = sharesOf(q, l), b = sharesOf(q, r); return a !== b ? (a > b ? -1 : 1) : validators.indexOf(l) - validators.indexOf(r) || asc(l, r); })];
};
/** og getEntityLeaderState: the committed leader, defaulting to the CEO at view 0. */
export const leaderStateOf = (state: EntityState): LeaderState =>
  ({ activeValidatorId: signerId(state.leaderState?.activeValidatorId ?? leaderOrder(state.quorum)[0] ?? ""), view: state.leaderState?.view ?? 0, changedAtHeight: state.leaderState?.changedAtHeight ?? 0 });
/** og getNextEntityFailoverLeader: rotate through the successors, never back to the CEO. */
export const nextFailoverLeader = (state: EntityState): string => {
  const order = leaderOrder(state.quorum);
  if (order.length < 2) return order[0] ?? "";
  const active = order.indexOf(leaderStateOf(state).activeValidatorId);
  return (active <= 0 ? order[1] : order[1 + (active % (order.length - 1))]) ?? "";
};
/** og getEntityLeaderTimeoutMs. */
export const leaderTimeoutMs = (nextView: number): number => Math.min(LEADER_TIMEOUT_MAX_MS, LEADER_TIMEOUT_BASE_MS * Math.max(1, Math.floor(nextView)));
const parentOf = (head: Head): string => (head.height === 0n ? GENESIS_PARENT : frameWord(head.prevFrameHash));
/** og buildEntityLeaderVoteBody over the committed state. */
export const leaderVoteBody = (state: EntityState, head: Head): LeaderVoteBody => {
  const l = leaderStateOf(state);
  return { entityId: signerId(state.id), targetHeight: Number(head.height) + 1, previousFrameHash: parentOf(head), fromView: l.view, toView: l.view + 1, previousLeaderId: l.activeValidatorId, nextLeaderId: nextFailoverLeader(state) };
};
const voteFields = (v: LeaderVoteBody): LeaderVoteBody => ({
  entityId: signerId(v.entityId), targetHeight: v.targetHeight, previousFrameHash: v.previousFrameHash, fromView: v.fromView, toView: v.toView, previousLeaderId: signerId(v.previousLeaderId), nextLeaderId: signerId(v.nextLeaderId),
});
/** og signatures are `0x`-prefixed lowercase hex; the rewrite's Signature is bare hex. Both parse. */
const ogSig = (s: string): string => (s.startsWith("0x") ? s.toLowerCase() : `0x${s}`);
const sigOf = (s: string): Signature | undefined => unwrapOr(signature(s.startsWith("0x") ? s.slice(2).toLowerCase() : s), () => undefined);
const precommitsBinary = (sigs: Precommits): Binary => new Map([...sigs].map(([k, v]) => [k, v.map(ogSig)]));
const certificateBinary = (c: LeaderCertificate): Result<Binary, EntityError> => {
  const prepared = c.preparedVotes;
  return map(prepared === undefined ? ok(undefined) : traverse([...prepared], ([k, v]) => map(voteBinary(v), (b) => [k, b] as const)), (rows): Binary => ({
    ...voteFields(c), votes: new Map([...c.votes].map(([k, s]) => [k, ogSig(s)])), ...(rows === undefined ? {} : { preparedVotes: new Map(rows) }), ...opt("preparedFrameHash", c.preparedFrameHash),
  }));
};
const leaderBinary = (l: FrameLeader, evidence: boolean): Result<Binary, EntityError> =>
  chain(l.certificate === undefined ? ok(undefined) : certificateBinary(l.certificate), (certificate) => map(evidence || l.relayCertificate === undefined ? ok(undefined) : certificateBinary(l.relayCertificate), (relayCertificate): Binary =>
    ({ proposerSignerId: l.proposerSignerId, view: l.view, ...opt("certificate", certificate), ...opt("relayCertificate", relayCertificate) })));
/** og EntityFrame wire shape (height, parentFrameHash, roots, txs, hash, leader, manifest, collectedSigs); `evidence` is og buildPreparedFrameEvidence (no relay certificate, no hankos). */
const frameBinary = (f: EntityFrame, signatures: Precommits | undefined, evidence: boolean): Result<Binary, EntityError> =>
  chain(hashEntityFrame(f), (hash) => chain(traverse(f.txs, entityFrameTx), (txs) => chain(frameNumber(f.height), (height) => chain(frameNumber(f.timestamp), (timestamp) => map(leaderBinary(f.leader, evidence), (leader): Binary => ({
    height, parentFrameHash: f.prevFrameHash, stateRoot: f.stateRoot, authorityRoot: f.authorityRoot, timestamp, entityContext: f.entityContext as unknown as Binary, txs: txs as unknown as Binary, events: f.events,
    hash, leader, hashesToSign: f.hashesToSign as unknown as Binary, ...(signatures === undefined ? {} : { collectedSigs: precommitsBinary(signatures) }),
  }))))));
const voteBinary = (v: LeaderVote): Result<Binary, EntityError> =>
  map(v.preparedFrame === undefined ? ok(undefined) : frameBinary(v.preparedFrame.frame, v.preparedFrame.signatures, true), (preparedFrame): Binary =>
    ({ ...voteFields(v), voterId: signerId(v.voterId), signature: ogSig(v.signature), ...opt("preparedFrame", preparedFrame) }));
const bytesKeccak = (value: Binary): Result<string, EntityError> => map(encodeConsensus(value), (bytes) => bytesToHex(keccak_256(bytes)));
/** og hashEntityLeaderVoteBody: domain, normalized body fields, prepared evidence or null. */
export const hashLeaderVote = (v: LeaderVoteBody & { readonly preparedFrame?: PreparedFrame | undefined }): Result<string, EntityError> =>
  chain(v.preparedFrame === undefined ? ok(null) : frameBinary(v.preparedFrame.frame, v.preparedFrame.signatures, true), (preparedFrame) => bytesKeccak({ domain: "xln.entity.leader-timeout.v1", ...voteFields(v), preparedFrame }));
const collectionKey = (v: LeaderVoteBody): Result<string, EntityError> => hashLeaderVote(voteFields(v));
const voteMatchesState = (state: EntityState, head: Head, v: LeaderVoteBody): boolean => canon(voteFields(v)) === canon(leaderVoteBody(state, head));
/** og buildEntityLeaderCertificate: votes sorted by normalized signer; per-voter votes only when some carried prepared evidence. */
export const buildLeaderCertificate = (body: LeaderVoteBody, votes: ReadonlyMap<string, LeaderVote>): LeaderCertificate => {
  const rows = [...votes].map(([k, v]) => [signerId(k), v] as const).sort(([a], [b]) => asc(a, b));
  const prepared = rows.some(([, v]) => v.preparedFrame !== undefined)
    ? new Map(rows.map(([k, v]): readonly [string, LeaderVote] => [k, { ...voteFields(v), voterId: signerId(v.voterId), signature: v.signature, ...opt("preparedFrame", v.preparedFrame) }])) : undefined;
  return { ...voteFields(body), votes: new Map(rows.map(([k, v]) => [k, v.signature])), ...opt("preparedVotes", prepared) };
};
/** og getCertificateSignedVotes. */
const certificateVotes = (c: LeaderCertificate): Result<ReadonlyMap<string, LeaderVote>, EntityError> => {
  const bad: EntityError = { _tag: "leader_vote_invalid" }, compact = new Map<string, string>();
  for (const [raw, sig] of c.votes) { const id = signerId(raw); if (compact.has(id)) return err(bad); compact.set(id, sig); }
  if (c.preparedVotes === undefined) return ok(new Map([...compact].map(([id, signature]) => [id, { ...voteFields(c), voterId: id, signature }])));
  const prepared = new Map<string, LeaderVote>();
  for (const [raw, vote] of c.preparedVotes) {
    const id = signerId(raw);
    if (prepared.has(id) || signerId(vote.voterId) !== id || compact.get(id) !== vote.signature) return err(bad);
    prepared.set(id, vote);
  }
  return prepared.size === compact.size ? ok(prepared) : err(bad);
};
type LeaderView = { readonly state: EntityState; readonly head: Head };
/** og verifyEntityLeaderCertificate: no certificate means the committed leader at the committed view; otherwise a quorum of signed timeout votes for this exact view change. */
const verifyLeaderCertificate = (at: LeaderView, leader: FrameLeader, ctx: EntityContext): boolean => {
  const committed = leaderStateOf(at.state), proposed = signerId(leader.proposerSignerId), c = leader.certificate, q = at.state.quorum;
  if (c === undefined) return proposed === committed.activeValidatorId && leader.view === committed.view;
  if (!voteMatchesState(at.state, at.head, c) || proposed !== signerId(c.nextLeaderId) || leader.view !== c.toView) return false;
  const signed = certificateVotes(c), key = collectionKey(c);
  if (!signed.ok || !key.ok) return false;
  const valid: string[] = [];
  for (const [id, vote] of signed.value) {
    const addr = memberId(q, id), h = hashLeaderVote(vote), k = collectionKey(vote);
    const sig = sigOf(vote.signature);
    if (addr === undefined || signerId(vote.voterId) !== id || !k.ok || k.value !== key.value || !h.ok || sig === undefined || !memberSigned(q, h.value, sig, addr, ctx)) return false;
    valid.push(id);
  }
  return valid.reduce((n, id) => n + sharesOf(q, id), 0n) >= thresholdOf(q);
};
/** og hasVerifiedPreparedQuorum: a canonical manifest, every bundle valid (else refused), at least the threshold. */
const preparedQuorum = (q: Quorum, frame: EntityFrame, sigs: Precommits, ctx: EntityContext): Result<boolean, EntityError> => chain(hashEntityFrame(frame), (hash) => {
  const head = frame.hashesToSign[0];
  if (head === undefined || head.type !== "entityFrame" || head.hash !== hash) return err({ _tag: "leader_prepared_rejected" });
  return chain(normalizeBundles(q, sigs), (bundles) => ([...bundles].some(([id, s]) => !bundleValid(q, frame.hashesToSign, id, s, ctx)) ? err({ _tag: "leader_prepared_rejected" }) : ok(quorumPower(q, bundles) >= thresholdOf(q))));
});
/** og validatePreparedFrameEvidence. */
const preparedEvidence = (at: LeaderView, c: LeaderCertificate, pf: PreparedFrame, ctx: EntityContext): Result<Precommits, EntityError> => {
  const f = pf.frame, rejected: EntityError = { _tag: "leader_prepared_rejected" };
  if (f.height !== BigInt(c.targetHeight) || f.prevFrameHash !== parentOf(at.head) || f.leader.relayCertificate !== undefined || !verifyLeaderCertificate(at, f.leader, ctx)) return err(rejected);
  return chain(preparedQuorum(at.state.quorum, f, pf.signatures, ctx), () => normalizeBundles(at.state.quorum, pf.signatures));
};
/** og selectPreparedFrameFromCertificate: group valid evidence by frame hash, keep quorum groups, the highest view must be unique. */
const selectPrepared = (at: LeaderView, c: LeaderCertificate, ctx: EntityContext): Result<PreparedFrame | null, EntityError> => chain(certificateVotes(c), (votes) => {
  type Group = { readonly frame: EntityFrame; readonly body: string; readonly signatures: Precommits };
  const groups = new Map<string, Group>(), rejected: EntityError = { _tag: "leader_prepared_rejected" };
  for (const vote of votes.values()) {
    const pf = vote.preparedFrame;
    if (pf === undefined) continue;
    const merged = chain(preparedEvidence(at, c, pf, ctx), (sigs) => chain(hashEntityFrame(pf.frame), (hash) => chain(frameBinary(pf.frame, undefined, true), (bodyValue) => chain(encodeConsensus(bodyValue), (bytes): Result<void, EntityError> => {
      const body = bytesToHex(bytes), group = groups.get(hash) ?? { frame: pf.frame, body, signatures: new Map() };
      if (group.body !== body) return err(rejected);
      let signatures = group.signatures;
      for (const [id, s] of sigs) { const held = signatures.get(id); if (held !== undefined && !sameSigs(held, s)) return err(rejected); signatures = mapSet(signatures, id, s); }
      groups.set(hash, { ...group, signatures });
      return ok(undefined);
    }))));
    if (!merged.ok) return merged;
  }
  const prepared = [...groups.values()].filter((g) => quorumPower(at.state.quorum, g.signatures) >= thresholdOf(at.state.quorum));
  if (prepared.length === 0) return ok(null);
  const view = Math.max(...prepared.map((g) => g.frame.leader.view)), highest = prepared.filter((g) => g.frame.leader.view === view);
  const [only] = highest;
  return highest.length !== 1 || only === undefined ? err(rejected) : ok({ frame: only.frame, signatures: new Map([...only.signatures].sort(([a], [b]) => asc(a, b))) });
});
/** og verifyEntityRelayCertificate: a relayed frame is exactly the prepared frame its relay certificate selects. */
const verifyRelayCertificate = (at: LeaderView, frame: EntityFrame, frameHash: string, ctx: EntityContext): boolean => {
  const relay = frame.leader.relayCertificate;
  if (relay === undefined) return true;
  if (!verifyLeaderCertificate(at, { proposerSignerId: relay.nextLeaderId, view: relay.toView, certificate: relay }, ctx)) return false;
  const selected = selectPrepared(at, relay, ctx);
  return selected.ok && selected.value !== null && unwrapOr(hashEntityFrame(selected.value.frame), () => "") === frameHash && relay.preparedFrameHash === frameHash;
};
/** og expectedCommittedLeaderState: a certified view change installs the next leader at this height. */
const committedLeaderFor = (state: EntityState, frame: EntityFrame): LeaderState => {
  const c = frame.leader.certificate;
  return c === undefined ? leaderStateOf(state) : { activeValidatorId: signerId(c.nextLeaderId), view: c.toView, changedAtHeight: Number(frame.height) };
};
/** og getReplicaProposalLeader: a pending certificate for the next height names the leader, else the committed one. */
export const proposalLeader = (r: EntityEnv): LeaderState => {
  const c = r.pendingLeaderCertificate;
  return c === undefined || c.targetHeight !== Number(r.head.height) + 1 ? leaderStateOf(r.state) : { activeValidatorId: signerId(c.nextLeaderId), view: c.toView, changedAtHeight: c.targetHeight };
};
const isProposalLeader = (r: EntityEnv): boolean => proposalLeader(r).activeValidatorId === signerId(r.signerId);
export const isActiveLeader = (r: EntityReplica): boolean => leaderStateOf(r.state).activeValidatorId === signerId(r.signerId);
/** og hasEntityLeaderWork (without J-prefix rounds): queued txs, a frame in flight, a pending certificate or queued Account work. */
export const hasLeaderWork = (r: EntityReplica): boolean => r.mempool.length > 0 || r._tag !== "open" || r.pendingLeaderCertificate !== undefined || hasProposableAccount(r);
/** og nextReplicaDeadline (non-leader branch): when this validator's timeout vote falls due, given its last consensus progress. */
export const leaderTimeoutDue = (r: EntityReplica, lastProgressAt: bigint): bigint | undefined => {
  if (isActiveLeader(r) || !hasLeaderWork(r)) return undefined;
  const body = leaderVoteBody(r.state, r.head), mine = r.leaderVotes?.get(signerId(r.signerId));
  if (mine !== undefined && canon(voteFields(mine)) === canon(voteFields(body))) return undefined;
  return lastProgressAt + BigInt(leaderTimeoutMs(body.toView));
};
/** og createDueScheduledWakeInputs (non-leader branch): the local unsigned vote carrying this replica's lock as prepared evidence. */
export const localTimeoutVote = (r: EntityReplica, timestamp: bigint): EntityInput | undefined => {
  if (isActiveLeader(r) || !hasLeaderWork(r)) return undefined;
  const lock = r._tag === "locked" ? { frame: r.frame, signatures: r.signatures } : undefined;
  return { kind: "leaderTimeoutVote", timestamp, local: true, vote: { ...leaderVoteBody(r.state, r.head), voterId: signerId(r.signerId), signature: "", ...opt("preparedFrame", lock) } };
};

type FoldContext = { readonly verify: Verify; readonly timestamp: bigint };
type Replicas = ReadonlyMap<EntityId, AccountReplica>;
/** Who the tx is about: og routes accountInput by its envelope, the rest by an explicit counterparty. */
const peerOf = (tx: EntityTx, self: EntityId): EntityId => matchBy("type", tx, {
  openAccount: (x) => x.data.targetEntityId, accountInput: (x) => (namesEntity(x.data.fromEntityId, self) ? x.data.toEntityId : x.data.fromEntityId),
  extendCredit: (x) => x.data.counterpartyEntityId, directPayment: (x) => x.data.route[1] ?? x.data.targetEntityId,
  requestCollateral: (x) => x.data.counterpartyEntityId, chat: () => self, chatMessage: () => self, "profile-update": () => self, entityCommand: () => self, propose: () => self, vote: () => self,
  lendingOffer: (x) => lower(x.data.hubEntityId) as EntityId, lendingBorrow: (x) => lower(x.data.hubEntityId) as EntityId,
  lendingRepay: (x) => lower(x.data.hubEntityId) as EntityId, lendingClosePosition: (x) => lower(x.data.hubEntityId) as EntityId,
});
/** A peer's Account message names its sender in its envelope; everything else is this entity's own command. */
const originOf = (tx: EntityTx, self: EntityId): Delivery => (tx.type === "accountInput" && !namesEntity(tx.data.fromEntityId, self) ? { _tag: "received", from: tx.data.fromEntityId } : { _tag: "local" });
const putChild = (state: EntityState, replicas: Replicas, peer: EntityId, child: AccountReplica): Folded => ({ state: { ...state, accounts: mapSet(state.accounts, peer, child.state.account) }, accountReplicas: mapSet(replicas, peer, child) });
const withChild = (replicas: Replicas, target: EntityId, f: (child: AccountReplica) => Result<Draft, EntityError>): Result<Draft, EntityError> => { const child = replicas.get(target); return child === undefined ? err({ _tag: "no_such_account", target }) : f(child); };
const routed = (state: EntityState, replicas: Replicas, target: EntityId, applied: Result<AccountApply, AccountReplicaError>): Result<Draft, EntityError> => chain(applied, (a) =>
  chain(traverse(a.outputs, (o): Result<readonly AccountMessage[], EntityError> => matchBy("kind", o, { effect: (e) => (e.effect._tag === "direct_payment_forward" ? ok([]) : err({ _tag: "not_l0" })), ack: (m) => ok([m]), ack_frame: (m) => ok([m]), start_dispute: () => ok([]) })),
    (messages) => {
      const base: Draft = { ...putChild(state, replicas, target, a.replica), outputs: messages.flat().map((data): EntityOutput => ({ to: target, tx: { type: "accountInput", data } })) };
      const forwards = a.outputs.flatMap((o) => (o.kind === "effect" && o.effect._tag === "direct_payment_forward" && sameHex(o.effect.route[0], state.id) ? [o.effect] : []));
      return foldResult<Draft, Of<Effect, "direct_payment_forward">, EntityError>(forwards, base, forwardPayment);
    }));
/** og applyDirectPaymentForwardFollowups: the gateway queues the next leg on its Account with route[1] (a missing Account refuses the input). */
const forwardPayment = (d: Draft, f: Of<Effect, "direct_payment_forward">): Result<Draft, EntityError> => {
  const self = d.state.id, next = f.route[1] as EntityId | undefined, child = next === undefined ? undefined : d.accountReplicas.get(next);
  if (next === undefined || child === undefined) return err({ _tag: "no_such_account", target: (next ?? "") as EntityId });
  const leg: AccountTx = { type: "payment", tokenId: String(f.tokenId) as TokenId, amount: f.amount, route: f.route.slice(1), description: f.description || "Forwarded payment", fromEntityId: self, toEntityId: next, deliveryMode: "trusted", trustedGatewayEntityId: f.trustedGatewayEntityId };
  return map(admitAt(child, [leg], self, L0_CLOCK), (admitted) => ({ ...putChild(d.state, d.accountReplicas, next, admitted), outputs: d.outputs }));
};
const L0_CLOCK = { timestamp: 0n, jHeight: 0n } as const;
/** og DEFAULT_ACCOUNT_TOKEN_IDS (account/config/defaults.ts). */
const DEFAULT_ACCOUNT_TOKEN_IDS = ["1", "3", "2"] as const;
/** og processingTrigger / direct-payment wake: an empty input to `validators[0]`. */
const wake = (state: EntityState, timestamp: bigint): EntityOutput => ({ to: state.id, signerId: state.quorum.proposer, input: { kind: "txs", timestamp, txs: [] } });
const sameDomain = (a: Domain, b: Domain): boolean => a.chainId === b.chainId && sameHex(a.depositoryAddress, b.depositoryAddress);
/** og handleOpenAccountEntityTx: no output (the peer learns from the first Account frame); seeds add_delta for tokenId + defaults and an optional credit line. */
const openChild = (state: EntityState, replicas: Replicas, tx: Extract<EntityTx, { type: "openAccount" }>): Result<Draft, EntityError> => {
  const { targetEntityId: target, accountDomain, watchSeed, disputeConfig, creditAmount, tokenId } = tx.data;
  const id = accountId(state.id, target);
  if (!id.ok) return err({ _tag: "self_account" });
  return chain(genesisReplica(id.value, { domain: accountDomain, watchSeed, disputeConfig }), (opened): Result<Draft, EntityError> => {
    if (!sameDomain(opened.state.terms.domain, state.jurisdiction)) return err({ _tag: "domain_mismatch" });
    if (replicas.has(target)) return err({ _tag: "account_exists", target });
    const credit = tokenId ?? "1", tokens = [...new Set([credit, ...DEFAULT_ACCOUNT_TOKEN_IDS])].filter((t) => Number(t) > 0) as TokenId[];
    const seeded: readonly AccountTx[] = [...tokens.map((t): AccountTx => ({ type: "add_delta", tokenId: t })), ...(creditAmount !== undefined && creditAmount > 0n ? [{ type: "set_credit_limit", tokenId: credit as TokenId, limit: creditAmount } as AccountTx] : [])];
    // og resolveOpenAccountPublicPin: the opener pins unless `pinPublic: false` or MAX_PROFILE_ADVERTISED_ACCOUNTS (100) are already pinned
    const pinned = tx.data.pinPublic !== false && [...replicas.values()].filter((c) => c.publicPinned === true).length < 100;
    return map(admitAt(pinned ? { ...opened, publicPinned: true } : opened, seeded, state.id, L0_CLOCK), (admitted) => ({ ...putChild(state, replicas, target, admitted), outputs: [] }));
  });
};
/** og createInboundAccountState: an unknown peer's first proposal (height 1) opens the Account from its envelope. */
const inboundChild = (state: EntityState, replicas: Replicas, from: EntityId, m: Extract<AccountMessage, { kind: "ack_frame" }>): Result<Folded, EntityError> => {
  if (m.frame.height !== 1n || m.watchSeed === undefined) return err({ _tag: "no_such_account", target: from });
  if (!sameDomain(m.domain, state.jurisdiction)) return err({ _tag: "domain_mismatch" });
  return chain(mapErr(accountId(state.id, from), (): EntityError => ({ _tag: "self_account" })), (id) =>
    map(genesisReplica(id, { domain: m.domain, watchSeed: m.watchSeed ?? "", disputeConfig: m.disputeConfig }), (opened) => putChild(state, replicas, from, opened)));
};
const UINT256_MAX = (1n << 256n) - 1n;
/**
 * og payments/lending.ts: validate the hub Account, intent id, amount, term and interest, then queue one Account lending tx on the hub
 * Account with this entity (lowercased) as the actor, plus the processing wake to `validators[0]`. Every refusal is a plain Error in og.
 */
const lendingEntityErr = (reason: string): Result<never, EntityError> => err({ _tag: "lending_entity", reason });
const entityLending = (state: EntityState, replicas: Replicas, tx: LendingEntityTx, queue: (hub: EntityId, accountTx: AccountTx) => Result<Draft, EntityError>): Result<Draft, EntityError> => {
  const hub = lower(tx.data.hubEntityId), self = lower(state.id), key = [...replicas.keys()].find((k) => lower(k) === hub);
  const child = key === undefined ? undefined : replicas.get(key);
  if (hub === "" || key === undefined || child === undefined) return lendingEntityErr("LENDING_HUB_ACCOUNT_MISSING");
  const intent = (value: string, prefix: "lend" | "borrow" | "loan"): Result<string, EntityError> => { const id = lower(value); return LENDING_INTENT.test(id) && id.startsWith(`${prefix}-`) ? ok(id) : lendingEntityErr("LENDING_INTENT_ID_INVALID"); };
  const positive = (amount: bigint, context: string): Result<void, EntityError> => (amount <= 0n ? lendingEntityErr(`${context}_AMOUNT_MUST_BE_POSITIVE`) : ok(undefined));
  const term = (v: string): Result<string, EntityError> => (LENDING_TERMS.has(v) ? ok(v) : lendingEntityErr("LENDING_INVALID_TERM"));
  const bps = (v: number): Result<number, EntityError> => (interestOk(v) ? ok(Math.floor(Number(v))) : lendingEntityErr("LENDING_INVALID_INTEREST_BPS"));
  switch (tx.type) {
    case "lendingOffer": { const x = tx.data; return chain(intent(x.positionId, "lend"), (positionId) => chain(positive(x.amount, "LENDING_FUND"), () => chain(term(x.termId), (termId) => chain(bps(x.interestBps), (interestBps) =>
      !child.state.account.deltas.has(x.tokenId) ? lendingEntityErr("LENDING_TOKEN_NOT_ENABLED") : queue(key, { type: "lending_fund", positionId, hubEntityId: hub, lenderEntityId: self, tokenId: x.tokenId, amount: x.amount, termId, interestBps }))))); }
    case "lendingBorrow": { const x = tx.data; return chain(intent(x.requestId, "borrow"), (requestId) => chain(positive(x.amount, "LENDING_BORROW"), () => chain(term(x.termId), (termId) => chain(bps(x.maxInterestBps ?? 10_000), (maxInterestBps) =>
      queue(key, { type: "lending_borrow_request", requestId, hubEntityId: hub, borrowerEntityId: self, tokenId: x.tokenId, amount: x.amount, termId, maxInterestBps }))))); }
    case "lendingRepay": { const x = tx.data; return chain(intent(x.loanId, "loan"), (loanId) => chain(positive(x.amount, "LENDING_REPAY"), () =>
      queue(key, { type: "lending_repay", loanId, hubEntityId: hub, borrowerEntityId: self, tokenId: x.tokenId, amount: x.amount }))); }
    case "lendingClosePosition": return chain(intent(tx.data.positionId, "lend"), (positionId) => queue(key, { type: "lending_close_request", positionId, hubEntityId: hub, lenderEntityId: self }));
  }
};
// ---- Account Hankos through the Entity manifest: og accountInput response + proposePendingAccountFrames, hanko-witness.ts, hanko/signing.ts ----
/**
 * og signs Account frames, ACKs and dispute proofs as secondary `hashesToSign` of the Entity frame and attaches the quorum Hanko only after the
 * frame certifies. While the frame folds, this Entity's own Hanko on digest `d` is the placeholder `pendingHanko(d)`; `installFrame` replaces it
 * with og's quorum Hanko. Own Hankos never enter the Entity state root (only the peer's do), so the placeholder never reaches a hash.
 */
const pendingHanko = (digest: string): Hanko => `0xfe${hexBody(digest).toLowerCase()}`;
const pendingVerify = (verify: Verify, self: EntityId): Verify => (d, h, e) => (h === pendingHanko(d) && sameHex(e, self)) || verify(d, h, e);
const pendingDispute = (plan: DisputePlan): DisputeHanko | undefined => match(plan, { sign: ({ draft }): DisputeHanko | undefined => ({ ...draft, hanko: pendingHanko(draft.hash) }), resend: ({ disputeHanko }) => disputeHanko, none: () => undefined });
/** og accountHasProposableMempool (without the settlement-freeze and HTLC-cap refinements): an active Account with no frame in flight and queued txs. */
const proposableChild = (c: AccountReplica | undefined): c is OpenAccount => c !== undefined && c._tag === "open" && c.mempool.length > 0;
const hasProposableAccount = (r: Folded): boolean => [...r.accountReplicas.values()].some(proposableChild);
/** og commits a received Account frame and answers it in the same Entity frame (the forced ACK response), signed through the manifest. */
const answerFrame = (d: Draft, peer: EntityId, ctx: FoldContext): Result<Draft, EntityError> => {
  const child = d.accountReplicas.get(peer), self = d.state.id;
  if (child === undefined || child._tag !== "received") return ok(d);
  return chain(partyOf(replicaId(child), self), (party) => chain(previewAck(child, self), (p) => {
    const ack: AccountInput = { kind: "ack", ...sentBy(child, party), height: p.height, frameHash: p.frameHash, frameHanko: pendingHanko(p.frameHash), ...opt("disputeHanko", pendingDispute(p.dispute)) };
    return map(routed(d.state, d.accountReplicas, peer, applyAccountInput(child, ack, { verify: pendingVerify(ctx.verify, self), self, now: ctx.timestamp })), (acked) => ({ ...acked, outputs: [...d.outputs, ...acked.outputs] }));
  }));
};
const entityJHeight = (state: EntityState): bigint => { const h = state.committed["lastFinalizedJHeight"]; return typeof h === "number" && Number.isSafeInteger(h) && h >= 0 ? BigInt(h) : 0n; };
/** og proposePendingAccountFrames: every proposable Account in worklist order proposes one frame at the Entity clock; a refused proposal is not a frame. */
const proposeAccounts = (d: Draft, order: readonly EntityId[], ctx: FoldContext): { readonly draft: Draft; readonly frames: number } => {
  const self = d.state.id, clock: FrameClock = { timestamp: ctx.timestamp, jHeight: entityJHeight(d.state) };
  let draft = d, frames = 0;
  for (const peer of order) {
    const child = draft.accountReplicas.get(peer);
    if (!proposableChild(child)) continue;
    const plan = planAccountProposal(child, self, clock, ctx.verify), party = partyOf(replicaId(child), self);
    if (!plan.ok || !party.ok) continue;
    const input: AccountInput = match(plan.value, {
      frame: ({ preview }): AccountInput => ({ kind: "propose", frameHanko: pendingHanko(preview.frame.stateHash), ...opt("disputeHanko", pendingDispute(preview.dispute)), ...clock }),
      idle: (): AccountInput => ({ kind: "propose", ...clock }),
    });
    const next = routed(draft.state, draft.accountReplicas, peer, propose(child, input as Propose, { verify: pendingVerify(ctx.verify, self), party: party.value }));
    if (!next.ok) continue;
    if (plan.value._tag === "frame") frames += 1;
    draft = { ...next.value, outputs: [...draft.outputs, ...next.value.outputs] };
  }
  // og sends one final Account input per Account: an ACK already riding on that Account's new frame is not sent again.
  const carried = new Set(draft.outputs.flatMap((o) => ("tx" in o && o.tx.data.kind === "ack_frame" && o.tx.data.ack !== null ? [`${o.to}|${canon(o.tx.data.ack)}`] : [])));
  return { draft: { ...draft, outputs: draft.outputs.filter((o) => !("tx" in o && o.tx.data.kind === "ack" && carried.has(`${o.to}|${canon(ackOf(o.tx.data))}`))) }, frames };
};
/** og buildQuorumHanko (single signer: encodeSingleSignerEntityHankos): canonical 0/1-recovery signatures by the named validators, signers then placeholders sorted by address. */
export const quorumHanko = (state: EntityState, digest: string, sigs: ReadonlyMap<string, Signature>): Result<Hanko, EntityError> => {
  const q = state.quorum, bad: EntityError = { _tag: "hanko_build" };
  const validators = [...membersOf(q)].map(([addr, m]) => ({ key: signerId(addr), share: m.shares }));
  const packed = new Map<string, RawSig>();
  for (const [raw, sig] of sigs) {
    const key = signerId(raw), v = validators.find((x) => x.key === key), bytes = parseHex(sig);
    if (v === undefined || packed.has(key) || bytes === null || bytes.length !== 65) return err(bad);
    const recovery = bytes[64] ?? 0, r = bytes.subarray(0, 32), s = bytes.subarray(32, 64);
    if ((recovery !== 0 && recovery !== 1) || isZeroWord(s) || wordAt(s, 0) > HALF_ORDER || !sameHex(recoverRawSigner(digest, sig) ?? undefined, key)) return err(bad);
    packed.set(key, { r, s, v: 27 + recovery });
  }
  if (validators.reduce((n, v) => n + (packed.has(v.key) ? v.share : 0n), 0n) < thresholdOf(q)) return err(bad);
  const entityWord = `0x${BigInt(state.id).toString(16).padStart(64, "0")}`, zero = { boardChangeDelay: 0, controlChangeDelay: 0, dividendChangeDelay: 0 };
  if (isSingleSigner(q)) return ok(encodeHankoEnvelope({ placeholders: [], packedSignatures: packSignatures([...packed.values()]), memberSignatures: [], claims: [{ entityId: entityWord, entityIndexes: [0], weights: [1], threshold: 1, ...zero }] }));
  const delays = match<Authority, typeof zero>(q, { teaching: () => zero, board: ({ board }) => ({ boardChangeDelay: board.boardChangeDelay, controlChangeDelay: board.controlChangeDelay, dividendChangeDelay: board.dividendChangeDelay }) });
  const signing = validators.filter((v) => packed.has(v.key)).sort((a, b) => asc(a.key, b.key)), idle = validators.filter((v) => !packed.has(v.key)).sort((a, b) => asc(a.key, b.key));
  const entityIndexes = validators.map((v) => { const i = signing.indexOf(v); return i < 0 ? idle.indexOf(v) : idle.length + i; });
  return ok(encodeHankoEnvelope({
    placeholders: idle.map((v) => `0x${hexBody(v.key).padStart(64, "0")}`), packedSignatures: packSignatures(signing.map((v) => packed.get(v.key) as RawSig)), memberSignatures: [],
    claims: [{ entityId: entityWord, entityIndexes, weights: validators.map((v) => Number(v.share)), threshold: Number(thresholdOf(q)), ...delays }],
  }));
};
/** og attachHankoWitnessToOutputs/State: each secondary manifest entry's quorum Hanko replaces its placeholder in the Account replicas and outputs. */
const fillHankos = (d: Draft, frame: EntityFrame, signatures: Precommits): Result<Draft, EntityError> => {
  const table = new Map<string, Hanko>();
  for (const [i, h] of frame.hashesToSign.entries()) {
    if (i === 0) continue;
    const sigs = new Map([...signatures].flatMap(([id, bundle]) => { const s = bundle[i]; return s === undefined ? [] : [[id, s] as const]; }));
    const built = quorumHanko(d.state, h.hash, sigs);
    if (!built.ok) return built;
    table.set(pendingHanko(h.hash), built.value);
  }
  if (table.size === 0) return ok(d);
  const f = (h: Hanko): Hanko => table.get(h) ?? h, fd = (x: DisputeHanko | undefined): DisputeHanko | undefined => (x === undefined ? undefined : { ...x, hanko: f(x.hanko) });
  const fa = (a: AccountAck): AccountAck => ({ ...a, frameHanko: f(a.frameHanko), ...opt("disputeHanko", fd(a.disputeHanko)) });
  const replica = (c: AccountReplica): AccountReplica => {
    const head: AccountHead = c.head._tag === "installed" ? { ...c.head, certificate: { ...c.head.certificate, left: f(c.head.certificate.left), right: f(c.head.certificate.right) } } : c.head;
    const dispute: DisputeWitnesses = { ...c.dispute, ...opt("current", fd(c.dispute.current)) };
    const base = { ...c, head, dispute, ...(c.acknowledged === undefined ? {} : { acknowledged: fa(c.acknowledged) }) };
    return "candidate" in c ? ({ ...base, candidate: new Candidate(c.candidate.frame, f(c.candidate.frameHanko), c.candidate.frameProof, c.candidate.draft, c.candidate.floor) } as AccountReplica) : (base as AccountReplica);
  };
  const message = (m: AccountPeerInput): AccountPeerInput => matchBy("kind", m, {
    ack: (a): AccountPeerInput => ({ ...a, frameHanko: f(a.frameHanko), ...opt("disputeHanko", fd(a.disputeHanko)) }),
    ack_frame: (a): AccountPeerInput => ({ ...a, ack: a.ack === null ? null : fa(a.ack), frameHanko: f(a.frameHanko), ...opt("disputeHanko", fd(a.disputeHanko)) }),
    dispute: (a): AccountPeerInput => ({ ...a, disputeHanko: { ...a.disputeHanko, hanko: f(a.disputeHanko.hanko) } }),
    board_hanko_refresh: (a): AccountPeerInput => ({ ...a, frameHanko: f(a.frameHanko), ...opt("disputeHanko", fd(a.disputeHanko)) }),
  });
  return ok({ ...d, accountReplicas: new Map([...d.accountReplicas].map(([k, c]) => [k, replica(c)])), outputs: d.outputs.map((o) => ("tx" in o ? { to: o.to, tx: { type: "accountInput" as const, data: message(o.tx.data) } } : o)) });
};
const PROFILE_ENTITY_KINDS: ReadonlySet<string> = new Set(["company", "foundation", "government", "nonprofit", "person", "protocol"]);
const PROFILE_ENTITY_SECTORS: ReadonlySet<string> = new Set(["commerce", "education", "energy", "finance", "healthcare", "infrastructure", "media", "professional-services", "public-sector", "real-estate", "technology"]);
/** og system/basic.ts handleProfileUpdateEntityTx: the committed profile with og's defaults, kind and canonical sector rules; `isHub` is never taken from the update. */
const profileUpdate = (state: EntityState, p: ProfileUpdate): Result<Binary, EntityError> => {
  const bad = (reason: Of<EntityError, "profile_update">["reason"]): Result<never, EntityError> => err({ _tag: "profile_update", reason });
  if (p.entityId !== state.id) return bad("entity");
  const prev = (state.committed["profile"] ?? {}) as { readonly [k: string]: unknown };
  const text = (k: string): string => { const v = prev[k]; return typeof v === "string" ? v : ""; };
  const entityKind = p.entityKind === undefined ? (typeof prev["entityKind"] === "string" ? prev["entityKind"] : undefined) : p.entityKind === null ? undefined : p.entityKind;
  if (entityKind !== undefined && !PROFILE_ENTITY_KINDS.has(entityKind)) return bad("entity_kind");
  const sectors = p.sectors ?? (Array.isArray(prev["sectors"]) ? (prev["sectors"] as readonly string[]) : []);
  if (!Array.isArray(sectors) || sectors.length > 4 || sectors.some((s) => !PROFILE_ENTITY_SECTORS.has(s))) return bad("sectors_invalid");
  const canonical = [...sectors].sort(asc);
  if (new Set(sectors).size !== sectors.length || canonical.some((s, i) => s !== sectors[i])) return bad("sectors_noncanonical");
  const rawName = p.name ?? prev["name"], name = typeof rawName === "string" && rawName.trim().length > 0 ? rawName.trim() : `Entity ${state.id.slice(-4)}`;
  return ok({
    name, ...(prev["isHub"] === undefined ? {} : { isHub: prev["isHub"] as Binary }), ...(entityKind ? { entityKind } : {}), ...(canonical.length > 0 ? { sectors: canonical } : {}),
    avatar: typeof p.avatar === "string" ? p.avatar : text("avatar"), bio: typeof p.bio === "string" ? p.bio : text("bio"), website: typeof p.website === "string" ? p.website : text("website"),
  });
};
// ---- og entity/command (command-codec.ts, index.ts), auth/authorization.ts, tx/processing/proposals.ts, system/basic.ts propose/vote ----
/** og applyEntityTxsInOrder authorization lanes: top-level frame txs, a signed command's individual txs, an approved proposal's collective txs. */
type TxLane = "top" | "command" | "collective";
/** A tx that changes nothing but the Entity state: no outputs, no events, no Account touched. */
const idle = (state: EntityState, replicas: Replicas): Draft => ({ state, accountReplicas: replicas, outputs: [], touched: [] });
const status = (message: string): FrameEvent => ({ type: "status", message });
const lendingMessage = (tx: LendingEntityTx): string => {
  switch (tx.type) {
    case "lendingOffer": return `Lending pool funding requested: ${tx.data.amount} token=${Number(tx.data.tokenId)}`;
    case "lendingBorrow": return `Loan requested: ${tx.data.amount} token=${Number(tx.data.tokenId)}`;
    case "lendingRepay": return `Loan repayment requested: ${tx.data.loanId}`;
    case "lendingClosePosition": return `Lending position close requested: ${tx.data.positionId}`;
  }
};
const invariant = (reason: string): Result<never, EntityError> => err({ _tag: "entity_invariant", reason });
const rejectCommand = (reason: string): Result<never, EntityError> => err({ _tag: "entity_command", reason });
/** og isEntityProtocolTx / isIndividualEntityCommandTx / isCollectiveEntityActionTx over the rewrite's tx types. */
const PROTOCOL_TXS: ReadonlySet<string> = new Set(["boardHandover", "entityCommand", "runtimeOutput", "scheduledWake", "proposeAccountsNow", "j_event", "accountInput"]);
const INDIVIDUAL_TXS: ReadonlySet<string> = new Set(["chat", "materializeCrossJurisdictionClear", "materializeCrossJurisdictionSwap", "propose", "vote"]);
const isProtocolTx = (tx: EntityTx): boolean => PROTOCOL_TXS.has(tx.type);
const isIndividualTx = (tx: EntityTx): boolean => INDIVIDUAL_TXS.has(tx.type);
const isCollectiveTx = (tx: EntityTx): boolean => !isProtocolTx(tx) && !isIndividualTx(tx);
/**
 * og assertEntityTxAuthorization. A signed command applies only individual txs and an approved proposal only collective ones. og refuses every
 * other top-level tx with ENTITY_COMMAND_REQUIRED; the rewrite's top-level `txs` lane stays the trusted local lane for the txs it already carried,
 * and refuses the governance txs og only accepts inside a command.
 */
const laneRefusal = (tx: EntityTx, lane: TxLane): EntityError | undefined => {
  if (isProtocolTx(tx)) return undefined;
  if (lane === "command" && !isIndividualTx(tx)) return { _tag: "entity_invariant", reason: `ENTITY_COMMAND_COLLECTIVE_ACTION_REQUIRES_PROPOSAL:${tx.type}` };
  if (lane === "collective" && !isCollectiveTx(tx)) return { _tag: "entity_invariant", reason: `ENTITY_COLLECTIVE_ACTION_TX_FORBIDDEN:${tx.type}` };
  if (lane === "top" && (tx.type === "propose" || tx.type === "vote")) return { _tag: "entity_invariant", reason: `ENTITY_COMMAND_REQUIRED:${tx.type}` };
  return undefined;
};
/** og plain Errors (openAccount, lending, governance invariants) refuse the whole input; a reject disposition evicts only the outermost tx. */
const fatalTx = (tx: EntityTx, e: EntityError): boolean => tx.type === "openAccount" || e._tag === "lending_entity" || e._tag === "entity_invariant";
/** og applyEntityTxsInOrder for a nested lane: every tx in order, atomically; a fatal child makes the whole outer tx fatal. */
const foldNested = (state: EntityState, replicas: Replicas, txs: readonly EntityTx[], ctx: FoldContext, lane: TxLane): Result<Draft, EntityError> =>
  foldResult<Draft, EntityTx, EntityError>(txs, { state, accountReplicas: replicas, outputs: [], events: [] }, (acc, tx) => {
    const r = foldTx(acc.state, acc.accountReplicas, tx, ctx, lane);
    if (!r.ok) return fatalTx(tx, r.error) && r.error._tag !== "entity_invariant" ? invariant(`${tx.type}:${r.error._tag}`) : r;
    return ok({ ...r.value, outputs: [...acc.outputs, ...r.value.outputs], events: [...(acc.events ?? []), ...(r.value.events ?? [])], touched: [...(acc.touched ?? []), ...(r.value.touched ?? [peerOf(tx, state.id)])] });
  });
const WORD32 = /^0x[0-9a-f]{64}$/, EOA = /^0x[0-9a-f]{40}$/;
const COMMAND_DOMAIN = "xln:entity-command:binary", PROPOSAL_ACTION_DOMAIN = "xln:entity-proposal-action:v1";
const MAX_PENDING_PROPOSALS = 100;
/** og UNREGISTERED_ENTITY_COMMAND_STACK_KEY = ethers.id('xln:entity-command:unregistered-stack:v1'). */
const UNREGISTERED_STACK_KEY = keccak256Hex(utf8("xln:entity-command:unregistered-stack:v1"));
/** og getCertifiedBoardStackKey: keccak(abi.encode(STACK_DOMAIN, chainId, depository, entityProvider)). */
export const certifiedBoardStackKey = (j: { readonly chainId: number; readonly depositoryAddress: string; readonly entityProviderAddress: string }): string =>
  keccak256Hex(abiEncode([A.b32(keccak256Hex(utf8("xln.certified-board.stack.v1"))), A.uint(BigInt(j.chainId)), A.address(j.depositoryAddress.toLowerCase()), A.address(j.entityProviderAddress.toLowerCase())]));
const commandStackKey = (state: EntityState): string => (state.jurisdictionConfig === undefined ? UNREGISTERED_STACK_KEY
  : certifiedBoardStackKey({ chainId: state.jurisdiction.chainId, depositoryAddress: state.jurisdiction.depositoryAddress, entityProviderAddress: state.jurisdictionConfig.entityProviderAddress }));
type BoardMember = { readonly signerId: string; readonly signer: string; readonly share: bigint };
type CommandBoard = { readonly boardHash: string; readonly boardEpoch: number; readonly members: readonly BoardMember[] };
/** og hashBoard(encodeBoard(config)): the config's positional validators as zero-padded EOAs, uint16 powers, no delays. */
export const configBoardHash = (q: Authority): string => {
  const members = [...membersOf(q)];
  return boardHashOf({ votingThreshold: Number(thresholdOf(q)), entityIds: members.map(([a]) => addressAsId(a)), votingPowers: members.map(([, m]) => Number(m.shares)), boardChangeDelay: 0, controlChangeDelay: 0, dividendChangeDelay: 0 }).toLowerCase();
};
/**
 * og resolveEntityCommandBoard: a lazy Entity (id == its config board hash) is at epoch 0; any other Entity needs its certified board record.
 * The rewrite carries no certified board registry, so such an Entity refuses like og with an empty registry.
 */
const commandBoard = (state: EntityState): Result<CommandBoard, EntityError> => {
  const members = [...membersOf(state.quorum)].map(([a, m]): BoardMember => ({ signerId: signerId(a), signer: signerId(a), share: m.shares }));
  const boardHash = configBoardHash(state.quorum), entity = signerId(state.id);
  return entity === boardHash ? ok({ boardHash, boardEpoch: 0, members }) : invariant(`ENTITY_COMMAND_CERTIFIED_BOARD_REQUIRED:${entity}`);
};
const consensusHash = (value: unknown): Result<string, EntityError> => chain(binaryBody(value), (b) => map(encodeConsensus(b), (bytes) => bytesToHex(keccak_256(bytes))));
/** og hashEntityCommandTxs. */
export const hashCommandTxs = (txs: readonly EntityTx[]): Result<string, EntityError> => consensusHash({ version: COMMAND_DOMAIN, txs: txs.map(wireEntityTx) });
type CommandBody = Omit<EntityCommand, "signature">;
/** og hashEntityCommand over the normalized body (txs enter through txsHash only). */
export const hashCommand = (c: CommandBody): Result<string, EntityError> => consensusHash({
  domain: COMMAND_DOMAIN, version: c.version, entityId: c.entityId, stackKey: c.stackKey, boardHash: c.boardHash, boardEpoch: c.boardEpoch,
  authorSignerId: c.authorSignerId, authorSigner: c.authorSigner, nonce: c.nonce, txsHash: c.txsHash,
});
/** og hashCollectiveEntityActionTxs. */
const hashCollectiveTxs = (txs: readonly EntityTx[]): Result<string, EntityError> => {
  if (txs.length === 0 || txs.length > ENTITY_MEMPOOL_SIZE) return invariant(`ENTITY_COLLECTIVE_ACTION_TX_COUNT_INVALID:${txs.length}`);
  const forbidden = txs.find((tx) => !isCollectiveTx(tx));
  return forbidden !== undefined ? invariant(`ENTITY_COLLECTIVE_ACTION_TX_FORBIDDEN:${forbidden.type}`) : consensusHash({ domain: PROPOSAL_ACTION_DOMAIN, version: 1, txs: txs.map(wireEntityTx) });
};
/** og buildEntityTransactionProposalAction. */
export const entityTransactionAction = (txs: readonly EntityTx[]): Result<ProposalAction, EntityError> => map(hashCollectiveTxs(txs), (actionHash) => ({ type: "entity_transaction", data: { version: 1, actionHash, txs } }));
/** og assertEntityProposalAction: the recomputed collective action hash must equal the carried one. */
const checkAction = (a: ProposalAction): Result<ProposalAction, EntityError> => {
  if (a.type === "collective_message") return typeof a.data.message === "string" ? ok({ type: a.type, data: { message: a.data.message } }) : invariant("ENTITY_PROPOSAL_MESSAGE_DATA_INVALID");
  if (a.type !== "entity_transaction") return invariant(`ENTITY_PROPOSAL_ACTION_TYPE_INVALID:${String((a as { type?: unknown }).type)}`);
  if (a.data.version !== 1) return invariant("ENTITY_PROPOSAL_TRANSACTION_DATA_INVALID");
  const carried = lower(a.data.actionHash);
  return chain(hashCollectiveTxs(a.data.txs), (computed) => (carried !== computed ? invariant(`ENTITY_PROPOSAL_ACTION_HASH_MISMATCH:${carried || "missing"}:${computed}`) : ok({ type: a.type, data: { version: 1, actionHash: carried, txs: a.data.txs } })));
};
/** og hashEntityProposalAction. */
export const hashProposalAction = (a: ProposalAction): Result<string, EntityError> => chain(checkAction(a), (checked) => consensusHash({ domain: PROPOSAL_ACTION_DOMAIN, action: wireAction(checked) }));
type NonceSlot = { readonly nonce: bigint; readonly commandHash: string };
/** og canonicalCommandNonceState: the committed fence for the current board, empty after a board rotation. */
const nonceSlots = (state: EntityState, board: CommandBoard): ReadonlyMap<string, NonceSlot> => {
  const stored = state.committed["entityCommandNonces"] as { readonly boardHash?: string; readonly boardEpoch?: number; readonly bySigner?: ReadonlyMap<string, NonceSlot> } | undefined;
  return stored?.bySigner !== undefined && stored.boardHash === board.boardHash && stored.boardEpoch === board.boardEpoch ? stored.bySigner : new Map();
};
const nonceBinary = (board: CommandBoard, slots: ReadonlyMap<string, NonceSlot>): Binary =>
  ({ version: 1, boardHash: board.boardHash, boardEpoch: board.boardEpoch, bySigner: new Map([...slots].map(([k, v]) => [k, { nonce: v.nonce, commandHash: v.commandHash }])) });
type Disposition = "next" | "retry" | "cancel";
/** og getEntityCommandDisposition: nonces only grow; an exact byte retry is idempotent, an older or rewritten slot is cancelled, a gap is refused. */
const disposition = (slots: ReadonlyMap<string, NonceSlot>, c: EntityCommand, commandHash: string): Result<Disposition, EntityError> => {
  const latest = slots.get(c.authorSignerId);
  if (latest === undefined) return c.nonce !== 1n ? rejectCommand(`ENTITY_COMMAND_NONCE_MISMATCH:${c.nonce}:1`) : ok("next");
  if (c.nonce === latest.nonce) return ok(commandHash === latest.commandHash ? "retry" : "cancel");
  if (c.nonce < latest.nonce) return ok("cancel");
  return c.nonce !== latest.nonce + 1n ? rejectCommand(`ENTITY_COMMAND_NONCE_MISMATCH:${c.nonce}:${latest.nonce + 1n}`) : ok("next");
};
/** og isCanonicalCompactSignatureHex: 0x + r,s + recovery 0/1, low-s, nonzero. */
const canonicalCompactSig = (sig: string): boolean => {
  if (!/^0x[0-9a-f]{130}$/.test(sig)) return false;
  const bytes = hexToBytes(sig), r = wordAt(bytes, 0), sv = wordAt(bytes, 32), rec = bytes[64];
  return (rec === 0 || rec === 1) && r !== 0n && sv !== 0n && r < secp256k1.CURVE.n && sv <= HALF_ORDER;
};
/** og assertEntityCommandTxs + normalizeEntityCommandBody + normalizeSignedEntityCommand. */
const normalizeCommand = (c: EntityCommand): Result<EntityCommand, EntityError> => {
  const bad = (code: string, v: unknown): Result<never, EntityError> => invariant(`${code}:${lower(v) || "missing"}`);
  const commandTxs = (): Result<void, EntityError> => {
    if (!Array.isArray(c.txs) || c.txs.length === 0 || c.txs.length > ENTITY_MEMPOOL_SIZE) return invariant(`ENTITY_COMMAND_TX_COUNT_INVALID:${Array.isArray(c.txs) ? c.txs.length : "not-array"}`);
    const protocol = c.txs.find(isProtocolTx);
    return protocol !== undefined ? invariant(`ENTITY_COMMAND_PROTOCOL_TX_FORBIDDEN:${protocol.type}`) : ok(undefined);
  };
  return chain(commandTxs(), () => {
    if (c.version !== 1) return invariant(`ENTITY_COMMAND_VERSION_INVALID:${String(c.version)}`);
    if (typeof c.nonce !== "bigint" || c.nonce < 1n) return invariant(`ENTITY_COMMAND_NONCE_INVALID:${String(c.nonce)}`);
    const entityId = lower(c.entityId), stackKey = lower(c.stackKey), boardHash = lower(c.boardHash), authorSignerId = lower(c.authorSignerId), authorSigner = lower(c.authorSigner), txsHash = lower(c.txsHash);
    if (!WORD32.test(entityId)) return bad("ENTITY_COMMAND_ENTITY_ID_INVALID", c.entityId);
    if (!WORD32.test(stackKey)) return bad("ENTITY_COMMAND_STACK_KEY_INVALID", c.stackKey);
    if (!WORD32.test(boardHash)) return bad("ENTITY_COMMAND_BOARD_HASH_INVALID", c.boardHash);
    if (typeof c.boardEpoch !== "number" || !Number.isSafeInteger(c.boardEpoch) || c.boardEpoch < 0) return invariant(`ENTITY_COMMAND_BOARD_EPOCH_INVALID:${String(c.boardEpoch)}`);
    if (authorSignerId === "") return invariant("ENTITY_COMMAND_AUTHOR_SIGNER_ID_REQUIRED");
    if (!EOA.test(authorSigner)) return bad("ENTITY_COMMAND_AUTHOR_SIGNER_INVALID", c.authorSigner);
    if (!WORD32.test(txsHash)) return bad("ENTITY_COMMAND_TXS_HASH_INVALID", c.txsHash);
    return chain(hashCommandTxs(c.txs), (computed): Result<EntityCommand, EntityError> => {
      if (txsHash !== computed) return invariant(`ENTITY_COMMAND_TXS_HASH_MISMATCH:${txsHash}:${computed}`);
      const signature = lower(c.signature);
      return canonicalCompactSig(signature) ? ok({ version: 1, entityId, stackKey, boardHash, boardEpoch: c.boardEpoch, authorSignerId, authorSigner, nonce: c.nonce, txsHash, txs: c.txs, signature }) : rejectCommand("ENTITY_COMMAND_SIGNATURE_INVALID");
    });
  });
};
/** og assertEntityCommandAuthorBindings: fields that claim an individual board identity must equal the author. */
const authorBindings = (author: string, txs: readonly EntityTx[]): Result<void, EntityError> => {
  for (const tx of txs) {
    const [field, claimed] = tx.type === "chat" ? ["chat.from", tx.data.from] : tx.type === "propose" ? ["propose.proposer", tx.data.proposer] : tx.type === "vote" ? ["vote.voter", tx.data.voter] : [undefined, undefined];
    if (field !== undefined && lower(claimed) !== author) return rejectCommand(`ENTITY_COMMAND_AUTHOR_FIELD_MISMATCH:${field}:${lower(claimed) || "missing"}:${author}`);
  }
  return ok(undefined);
};
/** og assertIndividualEntityCommandTxs. */
const individualOnly = (txs: readonly EntityTx[]): Result<void, EntityError> => foldResult(txs, undefined as void, (_, tx): Result<void, EntityError> =>
  !isIndividualTx(tx) ? rejectCommand(`ENTITY_COMMAND_COLLECTIVE_ACTION_REQUIRES_PROPOSAL:${tx.type}`) : tx.type === "propose" ? map(checkAction(tx.data.action), () => undefined) : ok(undefined));
type CheckedCommand = { readonly command: EntityCommand; readonly board: CommandBoard; readonly commandHash: string; readonly disposition: Disposition };
/** og assertSignedEntityCommand: entity, stack, board and epoch, author and its EOA, author bindings, individual txs, signature, nonce disposition. */
export const checkCommand = (state: EntityState, raw: EntityCommand): Result<CheckedCommand, EntityError> => chain(normalizeCommand(raw), (c) => {
  const entityId = lower(state.id), stackKey = commandStackKey(state);
  if (c.entityId !== entityId) return rejectCommand(`ENTITY_COMMAND_ENTITY_MISMATCH:${c.entityId}:${entityId}`);
  if (c.stackKey !== stackKey) return rejectCommand(`ENTITY_COMMAND_STACK_MISMATCH:${c.stackKey}:${stackKey}`);
  return chain(commandBoard(state), (board) => {
    if (c.boardHash !== board.boardHash) return rejectCommand(`ENTITY_COMMAND_BOARD_MISMATCH:${c.boardHash}:${board.boardHash}`);
    if (c.boardEpoch !== board.boardEpoch) return rejectCommand(`ENTITY_COMMAND_EPOCH_MISMATCH:${c.boardEpoch}:${board.boardEpoch}`);
    const author = board.members.find((m) => m.signerId === c.authorSignerId);
    if (author === undefined) return rejectCommand(`ENTITY_COMMAND_AUTHOR_NOT_ON_BOARD:${c.authorSignerId}`);
    if (c.authorSigner !== author.signer) return rejectCommand(`ENTITY_COMMAND_AUTHOR_EOA_MISMATCH:${c.authorSigner}:${author.signer}`);
    return chain(authorBindings(c.authorSignerId, c.txs), () => chain(individualOnly(c.txs), () => chain(hashCommand(c), (commandHash) => {
      if (!sameHex(recoverRawSigner(commandHash, c.signature) ?? undefined, author.signer)) return rejectCommand(`ENTITY_COMMAND_SIGNATURE_MISMATCH:${author.signerId}:${author.signer}`);
      return map(disposition(nonceSlots(state, board), c, commandHash), (d): CheckedCommand => ({ command: c, board, commandHash, disposition: d }));
    })));
  });
});
/** og applyNestedEntityTx: a non-next command (exact retry or cancelled slot) is a no-op; otherwise its txs apply in order, then the nonce advances. */
const foldCommand = (state: EntityState, replicas: Replicas, raw: EntityCommand, ctx: FoldContext): Result<Draft, EntityError> => chain(checkCommand(state, raw), ({ command, board, commandHash, disposition: d }) => {
  if (d !== "next") return ok(idle(state, replicas));
  return map(foldNested(state, replicas, command.txs, ctx, "command"), (applied) => {
    const slots = new Map(nonceSlots(applied.state, board)).set(command.authorSignerId, { nonce: command.nonce, commandHash });
    return { ...applied, state: { ...applied.state, committed: { ...applied.state.committed, entityCommandNonces: nonceBinary(board, slots) } } };
  });
});
/** og nextEntityCommandNonce. */
export const nextCommandNonce = (state: EntityState, author: string): Result<bigint, EntityError> => map(commandBoard(state), (board) => (nonceSlots(state, board).get(lower(author))?.nonce ?? 0n) + 1n);
/** og board shares keyed by canonical signer id. */
const boardShares = (state: EntityState): { readonly bySigner: ReadonlyMap<string, bigint>; readonly total: bigint } => {
  const bySigner = new Map([...membersOf(state.quorum)].map(([a, m]) => [signerId(a), m.shares] as const));
  return { bySigner, total: [...bySigner.values()].reduce((a, b) => a + b, 0n) };
};
type StoredVote = "yes" | "no" | { readonly choice: "yes" | "no"; readonly comment: string };
type StoredProposal = { readonly id: string; readonly proposer: string; readonly boardHash: string; readonly boardEpoch: number; readonly action: Binary; readonly actionHash: string; readonly votes: ReadonlyMap<string, StoredVote>; readonly created: number };
const proposalsOf = (state: EntityState): ReadonlyMap<string, StoredProposal> => (state.committed["proposals"] as ReadonlyMap<string, StoredProposal> | undefined) ?? new Map();
const withProposals = (state: EntityState, proposals: ReadonlyMap<string, StoredProposal>): EntityState =>
  ({ ...state, committed: { ...state.committed, proposals: proposals as unknown as Binary } });
/** og generateProposalId: sha256 of safeStringify({actionHash, proposer, boardHash, boardEpoch, commandNonce}) with og's sorted keys and tagged bigint. */
export const proposalId = (actionHash: string, proposer: string, board: { readonly boardHash: string; readonly boardEpoch: number }, commandNonce: bigint): string =>
  `prop_${nobleHex(sha256(utf8(JSON.stringify({ actionHash, boardEpoch: board.boardEpoch, boardHash: board.boardHash, commandNonce: { __xlnType: "BigInt", value: commandNonce.toString() }, proposer }))))}`;
/** og executeProposal (+ approvedEntityTxs): a collective message is a status event; an entity transaction applies its txs on the collective lane. */
const executeProposal = (state: EntityState, replicas: Replicas, action: ProposalAction, ctx: FoldContext, prior: readonly FrameEvent[]): Result<Draft, EntityError> =>
  action.type === "collective_message"
    ? ok({ state, accountReplicas: replicas, outputs: [], events: [...prior, status(`[COLLECTIVE] ${action.data.message}`)], touched: [] })
    : map(foldNested(state, replicas, action.data.txs, ctx, "collective"), (d) => ({ ...d, events: [...prior, ...(d.events ?? [])] }));
/** og handleProposeEntityTx: board member, action, capacity, id; a proposer holding the threshold executes at once, otherwise the proposal waits for votes. */
const foldPropose = (state: EntityState, replicas: Replicas, x: Extract<EntityTx, { type: "propose" }>["data"], ctx: FoldContext): Result<Draft, EntityError> => {
  const proposer = lower(x.proposer), power = boardShares(state).bySigner.get(proposer);
  if (power === undefined) return invariant(`ENTITY_PROPOSAL_PROPOSER_UNKNOWN:${proposer}`);
  return chain(commandBoard(state), (board) => chain(checkAction(x.action), (action) => {
    const proposals = proposalsOf(state);
    if (proposals.size >= MAX_PENDING_PROPOSALS) return invariant(`ENTITY_PROPOSAL_PENDING_LIMIT_EXCEEDED:${proposals.size}:${MAX_PENDING_PROPOSALS}`);
    const pending = [...proposals.values()].find((p) => lower(p.proposer) === proposer);
    if (pending !== undefined) return invariant(`ENTITY_PROPOSAL_PROPOSER_PENDING_LIMIT:${proposer}:${pending.id}`);
    return chain(hashProposalAction(action), (actionHash) => chain(binaryBody(wireAction(action)), (wired) => {
      const id = proposalId(actionHash, proposer, board, (nonceSlots(state, board).get(proposer)?.nonce ?? 0n) + 1n);
      if (proposals.has(id)) return invariant(`ENTITY_PROPOSAL_DUPLICATE:${id}`);
      if (power >= thresholdOf(state.quorum)) return executeProposal(state, replicas, action, ctx, []);
      const proposal: StoredProposal = { id, proposer, boardHash: board.boardHash, boardEpoch: board.boardEpoch, action: wired, actionHash, votes: new Map([[proposer, "yes"]]), created: Number(ctx.timestamp) };
      return ok(idle(withProposals(state, new Map(proposals).set(id, proposal)), replicas));
    }));
  }));
};
/** og handleVoteEntityTx: same board and epoch, one vote per member; yes power reaching the threshold executes, no power that makes it unreachable drops it. */
const foldVote = (state: EntityState, replicas: Replicas, x: Extract<EntityTx, { type: "vote" }>["data"], ctx: FoldContext): Result<Draft, EntityError> => {
  const voter = lower(x.voter), proposals = proposalsOf(state), proposal = proposals.get(x.proposalId), shares = boardShares(state);
  if (proposal === undefined) return invariant(`ENTITY_PROPOSAL_VOTE_TARGET_MISSING:${x.proposalId}`);
  if (!shares.bySigner.has(voter)) return invariant(`ENTITY_PROPOSAL_VOTER_UNKNOWN:${voter}`);
  return chain(commandBoard(state), (board) => {
    if (proposal.boardHash.toLowerCase() !== board.boardHash) return invariant(`ENTITY_PROPOSAL_BOARD_MISMATCH:${x.proposalId}:${proposal.boardHash}:${board.boardHash}`);
    if (proposal.boardEpoch !== board.boardEpoch) return invariant(`ENTITY_PROPOSAL_EPOCH_MISMATCH:${x.proposalId}:${proposal.boardEpoch}:${board.boardEpoch}`);
    if (proposal.votes.has(voter)) return invariant(`ENTITY_PROPOSAL_DUPLICATE_VOTE:${x.proposalId}:${voter}`);
    const votes = new Map(proposal.votes).set(voter, x.comment !== undefined ? { choice: x.choice, comment: x.comment } : x.choice);
    const power = (choice: "yes" | "no"): bigint => [...votes].reduce((n, [id, v]) => ((typeof v === "object" ? v.choice : v) === choice ? n + (shares.bySigner.get(id) ?? 0n) : n), 0n);
    const threshold = thresholdOf(state.quorum), rest = new Map(proposals);
    rest.delete(x.proposalId);
    if (power("yes") >= threshold) return executeProposal(withProposals(state, rest), replicas, actionOf(proposal.action), ctx, []);
    if (power("no") >= shares.total - threshold + 1n) return ok(idle(withProposals(state, rest), replicas));
    return ok(idle(withProposals(state, new Map(proposals).set(x.proposalId, { ...proposal, votes })), replicas));
  });
};
const actionOf = (wired: Binary): ProposalAction => {
  const a = wired as { readonly type: string; readonly data: { readonly message?: string; readonly version?: 1; readonly actionHash?: string; readonly txs?: readonly { readonly type: string; readonly data: unknown }[] } };
  return a.type === "collective_message" ? { type: "collective_message", data: { message: a.data.message ?? "" } }
    : { type: "entity_transaction", data: { version: 1, actionHash: a.data.actionHash ?? "", txs: (a.data.txs ?? []).map(unwireEntityTx) } };
};
/** og normalizeEntityProposalBoard + normalizeEntityCommandNonceBoard at frame start: work from another board or epoch is dropped. */
const normalizeGovernance = (state: EntityState): Result<EntityState, EntityError> => {
  const proposals = proposalsOf(state), nonces = state.committed["entityCommandNonces"] as { readonly boardHash?: string; readonly boardEpoch?: number } | undefined;
  if (proposals.size === 0 && nonces === undefined) return ok(state);
  return map(commandBoard(state), (board) => {
    const kept = new Map([...proposals].filter(([, p]) => p.boardHash.toLowerCase() === board.boardHash && p.boardEpoch === board.boardEpoch));
    const next = kept.size === proposals.size ? state : withProposals(state, kept);
    return nonces === undefined || (nonces.boardHash === board.boardHash && nonces.boardEpoch === board.boardEpoch) ? next
      : { ...next, committed: { ...next.committed, entityCommandNonces: nonceBinary(board, new Map()) } };
  });
};
/**
 * og prepareLocallyAuthoredEntityTxs (without its openAccount/directPayment materialization): protocol txs pass through, a signed command is
 * re-checked against the running cursor (a stale one is dropped), runs of individual txs become one command and runs of collective txs one
 * command carrying a `propose` of them. `sign` is the author's key on a 32-byte digest.
 */
export const authorEntityTxs = (state: EntityState, author: string, txs: readonly EntityTx[], sign: (digest: Hash) => Result<Signature, unknown>): Result<readonly EntityTx[], EntityError> => {
  let cursor = state, run: EntityTx[] = [], kind: "individual" | "collective" | undefined;
  const out: EntityTx[] = [], seen = new Map<string, string>();
  const advance = (c: CheckedCommand): void => {
    const slots = new Map(nonceSlots(cursor, c.board)).set(c.command.authorSignerId, { nonce: c.command.nonce, commandHash: c.commandHash });
    cursor = { ...cursor, committed: { ...cursor.committed, entityCommandNonces: nonceBinary(c.board, slots) } };
  };
  const flush = (): Result<void, EntityError> => {
    if (run.length === 0) return ok(undefined);
    const batch = run, collective = kind === "collective";
    run = []; kind = undefined;
    const commandTxs = collective ? map(entityTransactionAction(batch), (action): readonly EntityTx[] => [{ type: "propose", data: { proposer: lower(author), action } }]) : ok(batch);
    return chain(commandTxs, (ctxs) => chain(buildCommand(cursor, author, ctxs, sign), (command) => map(checkCommand(cursor, command), (checked) => { out.push({ type: "entityCommand", data: checked.command }); advance(checked); })));
  };
  for (const tx of txs) {
    if (tx.type === "entityCommand") {
      const slot = [tx.data.entityId, tx.data.stackKey, tx.data.boardHash, tx.data.boardEpoch, lower(tx.data.authorSignerId), tx.data.nonce].map(String).join("|"), identity = canon(wireEntityTx(tx));
      if (seen.has(slot)) continue;
      seen.set(slot, identity);
      const flushed = flush();
      if (!flushed.ok) return flushed;
      const checked = checkCommand(cursor, tx.data);
      if (!checked.ok) { if (checked.error._tag === "entity_command") continue; return checked; }
      if (checked.value.disposition !== "next") continue;
      out.push({ type: "entityCommand", data: checked.value.command });
      advance(checked.value);
      continue;
    }
    if (isProtocolTx(tx)) { const flushed = flush(); if (!flushed.ok) return flushed; out.push(tx); continue; }
    const k = isIndividualTx(tx) ? "individual" : "collective";
    if (kind !== undefined && kind !== k) { const flushed = flush(); if (!flushed.ok) return flushed; }
    kind = k;
    run.push(tx);
  }
  return map(flush(), () => out);
};
/** og buildSignedEntityCommand. */
export const buildCommand = (state: EntityState, author: string, txs: readonly EntityTx[], sign: (digest: Hash) => Result<Signature, unknown>): Result<EntityCommand, EntityError> => {
  const signer = lower(author);
  if (txs.length === 0 || txs.length > ENTITY_MEMPOOL_SIZE) return invariant(`ENTITY_COMMAND_TX_COUNT_INVALID:${txs.length}`);
  const protocol = txs.find(isProtocolTx);
  if (protocol !== undefined) return invariant(`ENTITY_COMMAND_PROTOCOL_TX_FORBIDDEN:${protocol.type}`);
  return chain(commandBoard(state), (board) => {
    const member = board.members.find((m) => m.signerId === signer);
    if (member === undefined) return rejectCommand(`ENTITY_COMMAND_AUTHOR_NOT_ON_BOARD:${signer}`);
    return chain(authorBindings(signer, txs), () => chain(individualOnly(txs), () => chain(hashCommandTxs(txs), (txsHash) => {
      const body: CommandBody = { version: 1, entityId: lower(state.id), stackKey: commandStackKey(state), boardHash: board.boardHash, boardEpoch: board.boardEpoch, authorSignerId: signer, authorSigner: member.signer, nonce: (nonceSlots(state, board).get(signer)?.nonce ?? 0n) + 1n, txsHash, txs };
      return chain(hashCommand(body), (h) => map(mapErr(sign(h as Hash), (): EntityError => ({ _tag: "sign_failed" })), (sig): EntityCommand => ({ ...body, signature: `0x${hexBody(sig).toLowerCase()}` })));
    })));
  });
};
const foldTx = (state: EntityState, replicas: Replicas, tx: EntityTx, ctx: FoldContext, lane: TxLane = "top"): Result<Draft, EntityError> => {
  const origin = originOf(tx, state.id), peer = peerOf(tx, state.id);
  const authorized = laneRefusal(tx, lane);
  if (authorized !== undefined) return err(authorized);
  const say = (d: Draft, ...messages: readonly string[]): Draft => ({ ...d, events: [...(d.events ?? []), ...messages.map(status)] });
  const enqueue = (target: EntityId, accountTxs: readonly AccountTx[], outputs: readonly EntityOutput[]): Result<Draft, EntityError> =>
    withChild(replicas, target, (child) => map(admitAt(child, accountTxs, state.id, L0_CLOCK, ctx.verify), (admitted) => ({ ...putChild(state, replicas, target, admitted), outputs })));
  const skip: Draft = { state, accountReplicas: replicas, outputs: [] };
  return matchBy("type", tx, {
    // og open-account.ts: the two status events around the insert
    openAccount: (x) => map(openChild(state, replicas, x), (d) => say(d, `💳 Opening account with Entity ${x.data.targetEntityId}...`, `✅ Account opening request sent to Entity ${lower(x.data.targetEntityId)}`)),
    extendCredit: (x) => (replicas.has(x.data.counterpartyEntityId) ? map(enqueue(x.data.counterpartyEntityId, [{ type: "set_credit_limit", tokenId: x.data.tokenId, limit: x.data.amount }], [wake(state, ctx.timestamp)]), (d) => say(d, `💳 Extended credit of ${x.data.amount} to ${x.data.counterpartyEntityId.slice(-4)}`)) : ok(skip)),
    directPayment: (x) => {
      const { route, targetEntityId, amount, deliveryMode, trustedGatewayEntityId, tokenId, description } = x.data;
      if (route.length === 0 || route.length > 100 || route[0] !== state.id || route[route.length - 1] !== targetEntityId) return err({ _tag: "payment_route" });
      if (deliveryMode !== "direct" && deliveryMode !== "trusted") return err({ _tag: "payment_route" });
      if (amount < 1n || amount > UINT256_MAX) return ok(say(skip, "❌ Payment failed: amount out of bounds"));
      // og requireTrustedPaymentGateway: exactly [source, gateway, target] with the declared gateway distinct from both ends
      if (deliveryMode === "trusted" ? route.length !== 3 || route[1] !== trustedGatewayEntityId || route[1] === route[0] || route[1] === targetEntityId : trustedGatewayEntityId !== undefined || route.length !== 2) return err({ _tag: "payment_route" });
      const next = route[1] as EntityId;
      // og buildNextHopPayment: the first leg carries the remaining route, the default description and the delivery mode
      const leg: AccountTx = { type: "payment", tokenId, amount, route: route.slice(1), description: description || `Payment to ${targetEntityId}`, fromEntityId: state.id, toEntityId: next, deliveryMode, ...opt("trustedGatewayEntityId", trustedGatewayEntityId) };
      return replicas.has(next) ? map(enqueue(next, [leg], [wake(state, ctx.timestamp)]), (d) => say(d, `💸 Sending ${amount} (token ${Number(tokenId)}) to ${targetEntityId} via ${route.length - 1} hops`)) : err({ _tag: "no_such_account", target: next });
    },
    lendingOffer: (x) => entityLending(state, replicas, x, (hub, accountTx) => map(enqueue(hub, [accountTx], [wake(state, ctx.timestamp)]), (d) => say(d, lendingMessage(x)))),
    lendingBorrow: (x) => entityLending(state, replicas, x, (hub, accountTx) => map(enqueue(hub, [accountTx], [wake(state, ctx.timestamp)]), (d) => say(d, lendingMessage(x)))),
    lendingRepay: (x) => entityLending(state, replicas, x, (hub, accountTx) => map(enqueue(hub, [accountTx], [wake(state, ctx.timestamp)]), (d) => say(d, lendingMessage(x)))),
    lendingClosePosition: (x) => entityLending(state, replicas, x, (hub, accountTx) => map(enqueue(hub, [accountTx], [wake(state, ctx.timestamp)]), (d) => say(d, lendingMessage(x)))),
    // og system/basic.ts: chat messages are frame events (certified in the frame hash, never in the state root); an invalid chat message is a silent no-op
    chat: (x) => ok(typeof x.data.message === "string" && x.data.message.length > 0 && x.data.message.length <= 1000 ? { ...skip, events: [{ type: "text", validatorId: lower(x.data.from), message: x.data.message }] } : skip),
    chatMessage: (x) => ok(say(skip, x.data.message)),
    entityCommand: (x) => foldCommand(state, replicas, x.data, ctx),
    propose: (x) => foldPropose(state, replicas, x.data, ctx),
    vote: (x) => foldVote(state, replicas, x.data, ctx),
    // og admin.ts handleRequestCollateralEntityTx: a missing Account is a no-op; otherwise queue request_collateral and wake validators[0]
    requestCollateral: (x) => {
      const { counterpartyEntityId: to, tokenId, amount, feeTokenId, feeAmount, policyVersion } = x.data;
      return replicas.has(to) ? enqueue(to, [{ type: "request_collateral", tokenId, amount, ...opt("feeTokenId", feeTokenId), feeAmount, policyVersion }], [wake(state, ctx.timestamp)]) : ok(skip);
    },
    "profile-update": (x) => map(profileUpdate(state, x.data.profile), (profile) => ({ ...skip, state: { ...state, committed: { ...state.committed, profile } } })),
    accountInput: (x) => chain(deliveredBy(x.data, state.id, origin), () => {
      const door: DoorContext = { verify: ctx.verify, self: state.id, now: ctx.timestamp };
      const apply = (at: Folded): Result<Draft, EntityError> => withChild(at.accountReplicas, peer, (child) => routed(at.state, at.accountReplicas, peer, disputeUnsafe(child, applyAccountInput(child, x.data, door), door)));
      const held: Folded = { state, accountReplicas: replicas };
      return matchBy("kind", x.data, {
        ack: () => apply(held),
        // og routes the standalone peer dispute witness through the same accountInput lane; an unknown Account has no genesis for it (og ACCOUNT_GENESIS_FRAME_REQUIRED).
        dispute: () => apply(held),
        // og board-hanko-refresh.ts: the Entity supplies counterpartyCertifiedBoard; the rewrite has no certified board registry, so the Account refuses it (certified_board_missing)
        board_hanko_refresh: () => apply(held),
        ack_frame: (i) => match(origin, {
          local: (): Result<Draft, EntityError> => err({ _tag: "from_not_converted" }),
          received: ({ from }) => chain(!i.frame.txs.every(isL0Tx) ? err({ _tag: "not_l0" }) : replicas.has(from) ? apply(held) : chain(inboundChild(state, replicas, from, i), apply), (d) => answerFrame(d, from, ctx)),
        }),
      });
    }),
  });
};
export type FoldedTxs = { readonly draft: Draft; readonly included: readonly EntityTx[]; readonly evicted: readonly EntityTx[] };
/**
 * og buildEntityProposalEvictingRejected: a refused tx is evicted and the rest still fold. An openAccount refusal is a plain
 * Error in og (not a reject disposition), so it refuses the whole input, as does an og lending entity-tx refusal; so does a frame whose every tx was refused.
 */
export const foldTxs = (state: EntityState, replicas: Replicas, txs: readonly EntityTx[], ctx: FoldContext): Result<FoldedTxs, EntityError> => {
  type Acc = FoldedTxs & { readonly first?: EntityError | undefined };
  // og proposePendingAccountFrames worklist: Accounts proposable before the frame (sorted), then the Accounts the included txs touched, in order.
  const primed = [...replicas].filter(([, c]) => proposableChild(c)).map(([peer]) => peer).sort(asc);
  return chain(normalizeGovernance(state), (normalized) => chain(foldResult<Acc, EntityTx, EntityError>(txs, { draft: { state: normalized, accountReplicas: replicas, outputs: [], events: [], touched: [] }, included: [], evicted: [] }, (acc, tx) => {
    const r = foldTx(acc.draft.state, acc.draft.accountReplicas, tx, ctx);
    if (r.ok) return ok({ ...acc, included: [...acc.included, tx], draft: { ...r.value, outputs: [...acc.draft.outputs, ...r.value.outputs], events: [...(acc.draft.events ?? []), ...(r.value.events ?? [])], touched: [...(acc.draft.touched ?? []), ...(r.value.touched ?? [peerOf(tx, state.id)])] } });
    return fatalTx(tx, r.error) ? r : ok({ ...acc, evicted: [...acc.evicted, tx], first: acc.first ?? r.error });
  }), ({ first, ...folded }) => {
    if (folded.included.length === 0 && first !== undefined) return err(first);
    // Accounts that received follow-up work (a gateway's forwarded leg) join after the directly touched ones.
    const followups = [...folded.draft.accountReplicas].filter(([, c]) => proposableChild(c)).map(([peer]) => peer).sort(asc);
    const order = [...new Set([...primed, ...(folded.draft.touched ?? []), ...followups])];
    return ok({ ...folded, draft: proposeAccounts(folded.draft, order, ctx).draft });
  }));
};
const EMPTY_COLLECTION = { radix: 16, leafCount: 0, root: ZERO_WORD } as const;
/** og applyEntityFrame `state.crontabState ??= initCrontab()`: the hubRebalance task at the 1s cadence, no hooks. */
const DEFAULT_CRONTAB: Binary = { tasks: new Map([["hubRebalance", { method: "hubRebalance", intervalMs: 1000, lastRun: 0, enabled: true, params: {} }]]), hooks: EMPTY_COLLECTION };
const rootConfig = (state: EntityState): EntityRootConfig => {
  const members = [...membersOf(state.quorum)].map(([id, member]) => [signerId(id), member.shares] as const), j = state.jurisdictionConfig;
  return {
    mode: "proposer-based", threshold: thresholdOf(state.quorum), validators: members.map(([id]) => id), shares: Object.fromEntries(members),
    ...(j === undefined ? {} : { jurisdiction: { chainId: state.jurisdiction.chainId, depositoryAddress: state.jurisdiction.depositoryAddress, ...j } }),
  };
};
/** og AccountReplica dispute fields (dispute/hanko.ts replaceLocalDisputeDraft, storeCounterpartyDisputeHanko): our unsigned draft tuple, the peer's full witness. */
const disputeLeafFields = (w: DisputeWitnesses): Partial<Record<EntityLeafOptional, unknown>> => ({
  ...(w.current === undefined ? {} : { currentDisputeHash: w.current.hash, currentDisputeProofBodyHash: w.current.proofBodyHash, currentDisputeProofNonce: w.current.proofNonce, currentDisputeProofProposerIsLeft: w.current.proposerIsLeft }),
  ...(w.counterparty === undefined ? {} : { counterpartyDisputeProofHanko: w.counterparty.hanko, counterpartyDisputeHash: w.counterparty.hash, counterpartyDisputeProofBodyHash: w.counterparty.proofBodyHash, counterpartyDisputeProofNonce: w.counterparty.proofNonce, counterpartyDisputeProofProposerIsLeft: w.counterparty.proposerIsLeft }),
});
/** og witness-projection.ts counterpartySettlementHankos: the peer's settlement and post-proof Hankos, when any. */
const peerSettlementHankos = (w: SettlementWorkspace | undefined, localIsLeft: boolean): unknown => {
  if (w === undefined) return undefined;
  const settlementHanko = localIsLeft ? w.rightHanko : w.leftHanko, postProofHanko = localIsLeft ? w.postSettlementDisputeProof?.rightHanko : w.postSettlementDisputeProof?.leftHanko;
  return settlementHanko === undefined && postProofHanko === undefined ? undefined : { ...opt("settlementHanko", settlementHanko), ...opt("postProofHanko", postProofHanko) };
};
/**
 * og projectAccountConsensusState for one Account replica. og's genesis replica carries `currentFrame.stateHash = ""` (open-account.ts, inbound-account.ts), so H=0 commits the empty frame hash.
 * `counterpartyFrameHanko` is the peer's Hanko on the committed head (ack-commit.ts, index.ts). Rebalance requests, fee state and fee policies are committed Account state; the local shadow is not part of the body.
 */
export const installedAccount = (self: EntityId, peer: EntityId, child: AccountReplica): Result<EntityRootAccount, EntityError> => {
  const body = child.state;
  const status: EntityRootAccount["status"] = match(child, { open: () => "active", proposed: () => "active", received: () => "active", preparing: () => "dispute_preparing", disputed: () => "disputed" });
  const localIsLeft = isLeft(self, replicaId(child));
  const linked: Result<{ readonly height: number; readonly frame: string; readonly peerHanko?: string | undefined }, EntityFrameHashError> = match(child.head, {
    genesis: () => ok({ height: 0, frame: "" }),
    installed: (head) => map(frameNumber(head.height), (height) => ({ height, frame: head.prevFrameHash, peerHanko: at(head.certificate.right, head.certificate.left, localIsLeft) })),
  });
  return chain(linked, (link): Result<EntityRootAccount, EntityError> => chain(mapErr(committedView(body), (): EntityError => ({ _tag: "account_envelope", target: peer })), (state): Result<EntityRootAccount, EntityError> => ok({
    fromEntity: self, toEntity: peer, status, currentHeight: link.height, nextProofNonce: child.dispute.nextProofNonce, currentFrameHash: link.frame,
    pendingWithdrawals: ZERO_WORD, policyRoot: ZERO_WORD, submittedAtByTokenRoot: unwrapOr(submittedAtRoot(body), () => ZERO_WORD), state,
    committed: { ...opt("publicPinned", child.publicPinned), ...opt("counterpartyBoardHankoRefresh", child.boardRefresh), ...opt("counterpartyFrameHanko", link.peerHanko), ...disputeLeafFields(child.dispute), ...(child._tag === "disputed" ? opt("activeDispute", child.active) : {}) },
    ...opt("counterpartySettlementHankos", peerSettlementHankos(body.settlement, localIsLeft)),
  })));
};
/** og computeCanonicalEntityConsensusStateHash over the draft: entityId, height, timestamp, config, accounts and every committed section. */
export const entityRootOf = (state: EntityState, replicas: Replicas): Result<string, EntityError> =>
  chain(frameNumber(state.height), (height) => chain(frameNumber(state.timestamp), (timestamp) => chain(traverse([...replicas], ([peer, child]) => installedAccount(state.id, peer, child)),
    (accounts) => entityStateRoot({ config: rootConfig(state), accounts, entityId: state.id, height, timestamp, committed: state.committed, leaderState: state.leaderState }))));
/** og computeEntityFrameAuthorityRoot(buildEntityFrameAuthority(state)): config + normalizeAuthorityLeader(leaderState). */
const authorityRoot = (state: EntityState): Result<string, EntityRootError> => {
  const config = rootConfig(state), leader = signerId(state.leaderState?.activeValidatorId ?? config.validators[0] ?? "");
  if (leader.length === 0) return err({ _tag: "bad_config" });
  return chain(consensusConfig(config), (normalized) => map(encodeConsensus({
    domain: "xln.entity.frame-authority:binary",
    authority: { config: normalized, leaderState: { activeValidatorId: leader, view: state.leaderState?.view ?? 0, changedAtHeight: state.leaderState?.changedAtHeight ?? 0 } },
  }), (bytes) => bytesToHex(keccak_256(bytes))));
};
/** og account/consensus hashesToSign: the Account frames and dispute proofs this frame signs for, as secondary manifest entries. */
const messageHashes = (peer: EntityId, m: AccountPeerInput): readonly HashToSign[] => {
  const tail = peer.slice(-8);
  const acked = (a: AccountAck): readonly HashToSign[] => [
    { hash: a.frameHash, type: "accountFrame", context: `account:${tail}:ack:${a.height}` },
    ...(a.disputeHanko === undefined ? [] : [{ hash: a.disputeHanko.hash, type: "dispute", context: `account:${tail}:ack-dispute` } as const]),
  ];
  return matchBy("kind", m, {
    ack: (a) => acked(a),
    ack_frame: (f) => [...(f.ack === null ? [] : acked(f.ack)), { hash: f.frame.stateHash, type: "accountFrame", context: `account:${tail}:frame:${f.frame.height}` },
      ...(f.disputeHanko === undefined ? [] : [{ hash: f.disputeHanko.hash, type: "dispute", context: `account:${tail}:dispute` } as const])],
    dispute: (d) => [{ hash: d.disputeHanko.hash, type: "dispute", context: `account:${tail}:dispute` }],
    // og: a refresh re-Hankos an already committed frame; this Entity never originates one (the board-rotation flush is not ported)
    board_hanko_refresh: () => [],
  });
};
/** og buildEntityHashesToSign: the frame hash first, then the secondary hashes sorted, a duplicate is fatal. */
const hashesToSignOf = (entityId: EntityId, height: bigint, frameHash: string, outputs: readonly EntityOutput[]): Result<readonly HashToSign[], EntityError> => {
  const secondary = outputs.flatMap((o) => ("tx" in o ? messageHashes(o.to, o.tx.data) : []));
  const hashes = [frameHash, ...secondary.map((h) => h.hash)];
  if (new Set(hashes).size !== hashes.length) return err({ _tag: "secondary_hash_duplicate" });
  return ok([{ hash: frameHash, type: "entityFrame", context: `entity:${entityId.slice(-4)}:frame:${height}` }, ...[...secondary].sort((a, b) => asc(a.hash, b.hash))]);
};
const GENESIS_PARENT = "genesis";
/** og certifyEntityProposal: the proposal state takes height+1 and the frame timestamp, then state root, authority root, frame hash, manifest. */
const buildFrame = (r: EntityEnv, leader: FrameLeader, leaderState: LeaderState, timestamp: bigint, txs: readonly EntityTx[], folded: Draft): Result<EntityCandidate, EntityError> => {
  const height = r.head.height + 1n, parent = parentOf(r.head), signer = signerId(leader.proposerSignerId);
  const committed: EntityCommitted = "crontabState" in folded.state.committed ? folded.state.committed : { ...folded.state.committed, crontabState: DEFAULT_CRONTAB };
  const draft: Draft = { ...folded, state: { ...folded.state, height, timestamp, committed, leaderState } };
  return chain(frameNumber(height), (heightNo) => chain(entityRootOf(draft.state, draft.accountReplicas), (stateRoot) => chain(authorityRoot(draft.state), (root) => {
    const body = {
      height, prevFrameHash: parent as EntityFrameHash, timestamp, txs, events: (folded.events ?? []).map((e): Binary => ({ ...e })), stateRoot, authorityRoot: root, leader,
      entityContext: { version: 1, proposerReplicaId: `${draft.state.id}:${signer}`, entityId: draft.state.id, proposerSignerId: signer, parentFrameHash: parent, height: heightNo, gossipProfiles: [], peerAssertions: [], htlc: { version: 1, entries: [], originated: [] } },
    };
    return chain(hashEntityFrame({ ...body, hashesToSign: [] }), (frameHash) =>
      map(hashesToSignOf(draft.state.id, height, frameHash, draft.outputs), (hashesToSign): EntityCandidate => ({ frame: { ...body, hashesToSign }, signatures: new Map(), draft })));
  })));
};
const frameKey = (tx: EntityTx): string => encodeEntityTx(tx);
/** og removeCommittedTxsFromMempool: drop one mempool entry per committed (or evicted) tx. */
const withoutTxs = (mempool: readonly EntityTx[], gone: readonly EntityTx[]): readonly EntityTx[] => {
  const left = new Map<string, number>();
  for (const tx of gone) left.set(frameKey(tx), (left.get(frameKey(tx)) ?? 0) + 1);
  return mempool.filter((tx) => { const k = frameKey(tx), n = left.get(k) ?? 0; if (n === 0) return true; left.set(k, n - 1); return false; });
};
const ENTITY_MEMPOOL_SIZE = 10_000;
/** og appendEntityMempoolTransactions: exact Account-input retries collapse, every other tx keeps order and multiplicity. */
const appendMempool = (mempool: readonly EntityTx[], admitted: readonly EntityTx[]): readonly EntityTx[] => {
  const accountKey = (tx: EntityTx): string | undefined => (tx.type === "accountInput" ? frameKey(tx) : undefined);
  return [...mempool, ...firstBy(admitted, accountKey, mempool.flatMap((tx) => { const k = accountKey(tx); return k === undefined ? [] : [k]; }))];
};
/** og finalizeCommitNotification: install the candidate, emit its Account outputs, optionally broadcast the certified frame to the other validators. */
const installFrame = (r: EntityEnv & EntityCandidate, frameHash: EntityFrameHash, signatures: Precommits, broadcast: boolean): Result<EntityApply<OpenEntity>, EntityError> => chain(fillHankos(r.draft, r.frame, signatures), (draft) => {
  const others = broadcast ? [...membersOf(draft.state.quorum).keys()].filter((v) => signerId(v) !== signerId(r.signerId)) : [];
  // og finalizeCommitNotification: votes reset; a relay certificate for exactly this frame stays pending.
  const relay = r.frame.leader.relayCertificate, pending = relay !== undefined && relay.preparedFrameHash === frameHash ? relay : undefined;
  const opened: OpenEntity = { ...openEntity(r.signerId, draft.state, { height: r.frame.height, prevFrameHash: frameHash }, withoutTxs(r.mempool, r.frame.txs), draft.accountReplicas), leaderVotes: new Map(), ...opt("pendingLeaderCertificate", pending) };
  return ok(done(opened, [...draft.outputs, ...others.map((v): EntityOutput => ({ to: r.state.id, signerId: v, input: { kind: "proposal", frame: r.frame, signatures } }))]));
});
/** og admitEntityTransactions + startEntityProposalIfReady: queue, forward a non-leader mempool to the leader, or propose from the mempool. */
const admitTxs = <R extends EntityReplica>(r: R, input: Extract<EntityInput, { kind: "txs" }>, ctx: EntityContext): Result<R, EntityError> => {
  if (input.timestamp < 0n || input.timestamp > BigInt(Number.MAX_SAFE_INTEGER)) return err({ _tag: "frame_timestamp_invalid", timestamp: input.timestamp });
  const from = ctx.from;
  if (from !== undefined && (from === ctx.self || !input.txs.every((tx) => tx.type === "accountInput" && namesEntity(tx.data.fromEntityId, from) && namesEntity(tx.data.toEntityId, ctx.self)))) return err({ _tag: "from_not_converted" });
  if (input.txs.length > ENTITY_MEMPOOL_SIZE || r.mempool.length + input.txs.length > ENTITY_MEMPOOL_SIZE) return err({ _tag: "mempool_full" });
  return ok({ ...r, mempool: appendMempool(r.mempool, input.txs) });
};
/** og admission: a replica that is not the proposal leader forwards its mempool to that leader. */
const forwarded = (r: EntityEnv, timestamp: bigint): readonly EntityOutput[] => {
  const leader = proposalLeader(r).activeValidatorId, to = memberId(r.state.quorum, leader);
  return isProposalLeader(r) || r.mempool.length === 0 || to === undefined ? [] : [{ to: r.state.id, signerId: to, input: { kind: "txs", timestamp, txs: r.mempool } }];
};
/** og shouldStartProposal: a certified view change (without a prepared frame to relay) proposes even an empty frame. */
const certifiedTransition = (r: EntityEnv): boolean => { const c = r.pendingLeaderCertificate; return c !== undefined && c.targetHeight === Number(r.head.height) + 1 && c.preparedFrameHash === undefined; };
/** og startEntityProposalIfReady + certifyEntityProposal: fold the mempool, commit the proposal leader's view, self-sign, commit alone or broadcast. */
const startProposal = (queued: OpenEntity, runtimeTimestamp: bigint, ctx: EntityContext): Result<EntityApply<OpenEntity | ProposedEntity>, EntityError> => {
  if (!isProposalLeader(queued) || (queued.mempool.length === 0 && !certifiedTransition(queued) && !hasProposableAccount(queued))) return ok(done(queued, forwarded(queued, runtimeTimestamp)));
  /** og resolveEntityProposalTimestamp: never behind the committed clock. */
  const timestamp = runtimeTimestamp > queued.state.timestamp ? runtimeTimestamp : queued.state.timestamp;
  const view = proposalLeader(queued).view, self = signerId(queued.signerId), pending = queued.pendingLeaderCertificate;
  const leader: FrameLeader = { proposerSignerId: self, view, ...opt("certificate", pending) };
  const leaderState: LeaderState = { activeValidatorId: self, view, changedAtHeight: pending !== undefined ? Number(queued.head.height) + 1 : queued.state.leaderState?.changedAtHeight ?? 0 };
  return chain(foldTxs(queued.state, queued.accountReplicas, queued.mempool, { verify: ctx.verify, timestamp }), ({ draft, included, evicted }) => {
    const pool = withoutTxs(queued.mempool, evicted);
    return chain(buildFrame(queued, leader, leaderState, timestamp, included, draft), (candidate) => chain(signManifest(candidate.frame.hashesToSign, queued.signerId, ctx), (own) => chain(hashEntityFrame(candidate.frame), (frameHash): Result<EntityApply<OpenEntity | ProposedEntity>, EntityError> => {
      const proposed: ProposedEntity = { ...queued, _tag: "proposed", mempool: pool, ...candidate, signatures: new Map([[self, own]]) };
      if (isSingleSigner(queued.state.quorum)) return installFrame(proposed, frameHash, proposed.signatures, false);
      const others = [...membersOf(queued.state.quorum).keys()].filter((v) => signerId(v) !== self);
      return ok(done<OpenEntity | ProposedEntity, EntityOutput>(proposed, others.map((v): EntityOutput => ({ to: queued.state.id, signerId: v, input: { kind: "proposal", frame: candidate.frame, signatures: proposed.signatures } }))));
    })));
  });
};
export const applyTxsOpen = (r: OpenEntity, input: Extract<EntityInput, { kind: "txs" }>, ctx: EntityContext): Result<EntityApply<OpenEntity | ProposedEntity>, EntityError> =>
  chain(admitTxs(r, input, ctx), (queued) => startProposal(queued, input.timestamp, ctx));
/** og runs handleHashPrecommits on every input: a held frame whose collected signatures already reach quorum installs now. */
const heldQuorum = <R extends ProposedEntity | LockedEntity>(r: R, before: readonly EntityOutput[]): Result<EntityApply<OpenEntity | R>, EntityError> =>
  quorumPower(r.state.quorum, r.signatures) < thresholdOf(r.state.quorum) ? ok(done<OpenEntity | R, EntityOutput>(r, before))
    : chain(hashEntityFrame(r.frame), (frameHash) => map(installFrame(r, frameHash, r.signatures, true), (c) => done<OpenEntity | R, EntityOutput>(c.replica, [...before, ...c.outputs])));
const queueOnly = <R extends ProposedEntity | LockedEntity>(r: R, input: Extract<EntityInput, { kind: "txs" }>, ctx: EntityContext): Result<EntityApply<OpenEntity | R>, EntityError> =>
  chain(admitTxs(r, input, ctx), (queued) => heldQuorum(queued, forwarded(queued, input.timestamp)));
/** og preauthenticateEntityProposal: canonical digests, parent, leader, recomputed hash, manifest head, the proposer's frame signature. */
const DIGEST = /^0x[0-9a-f]{64}$/;
const preauthenticate = (r: EntityEnv, frame: EntityFrame, signatures: Precommits, ctx: EntityContext): Result<EntityFrameHash, EntityError> => chain(hashEntityFrame(frame), (frameHash): Result<EntityFrameHash, EntityError> => {
  if (!DIGEST.test(frame.stateRoot) || !DIGEST.test(frame.authorityRoot)) return err({ _tag: "proposal_digest" });
  if (frame.prevFrameHash !== parentOf(r.head)) return err({ _tag: "proposal_parent" });
  // og validateProposedFrameLeader: the leader certificate (or the committed leader and view) and any relay certificate.
  const proposer = frame.leader.proposerSignerId;
  if (!verifyLeaderCertificate(r, frame.leader, ctx) || !verifyRelayCertificate(r, frame, frameHash, ctx) || frame.entityContext.entityId !== r.state.id) return err({ _tag: "proposal_leader" });
  const head = frame.hashesToSign[0];
  if (head === undefined || head.hash !== frameHash || head.type !== "entityFrame" || head.context !== `entity:${r.state.id.slice(-4)}:frame:${frame.height}`) return err({ _tag: "proposal_manifest" });
  const own = [...signatures].filter(([id]) => signerId(id) === signerId(proposer)), sig = own.length === 1 ? own[0]?.[1][0] : undefined, addr = memberId(r.state.quorum, proposer);
  return sig === undefined || addr === undefined || !memberSigned(r.state.quorum, frameHash, sig, addr, ctx) ? err({ _tag: "proposal_signature" }) : ok(frameHash);
});
/** og replayProposedEntityFrame: a validator folds the frame's txs itself; any difference in the manifest refuses the proposal. */
const replayFrame = (r: EntityEnv, frame: EntityFrame, frameHash: EntityFrameHash, ctx: EntityContext): Result<EntityCandidate, EntityError> => {
  if (frame.timestamp < r.state.timestamp) return err({ _tag: "frame_timestamp_regression", timestamp: frame.timestamp });
  return chain(foldTxs(r.state, r.accountReplicas, frame.txs, { verify: ctx.verify, timestamp: frame.timestamp }), ({ draft, evicted }) => {
    if (evicted.length > 0) return err({ _tag: "local_manifest_mismatch" });
    return chain(buildFrame(r, frame.leader, committedLeaderFor(r.state, frame), frame.timestamp, frame.txs, draft), (candidate) => chain(hashEntityFrame(candidate.frame), (local) =>
      local !== frameHash || canon(candidate.frame.hashesToSign) !== canon(frame.hashesToSign) ? err({ _tag: "local_manifest_mismatch" }) : ok({ ...candidate, frame })));
  });
};
const heldFrame = (r: EntityReplica): (EntityEnv & EntityCandidate) | undefined => match(r, { open: () => undefined, proposed: (p): (EntityEnv & EntityCandidate) | undefined => p, locked: (l): (EntityEnv & EntityCandidate) | undefined => l });
/** og handleCommitNotification: a frame carrying a quorum certificate installs (after replay unless already locked on it). */
const commitNotification = <R extends EntityReplica>(r: R, frame: EntityFrame, bundles: Precommits, ctx: EntityContext): Result<EntityApply<OpenEntity | R>, EntityError> | undefined => {
  if (bundles.size === 0) return undefined;
  const normalized = normalizeBundles(r.state.quorum, bundles);
  if (normalized.ok && quorumPower(r.state.quorum, normalized.value) < thresholdOf(r.state.quorum)) return undefined;
  if (!DIGEST.test(frame.stateRoot) || !DIGEST.test(frame.authorityRoot)) return err({ _tag: "proposal_digest" });
  if (frame.height > r.head.height + 1n) return err({ _tag: "commit_wait" });
  if (frame.height < r.head.height) return ok(done<OpenEntity | R, EntityOutput>(r));
  return chain(hashEntityFrame(frame), (frameHash): Result<EntityApply<OpenEntity | R>, EntityError> => {
    if (frame.height === r.head.height) return frameHash === r.head.prevFrameHash ? ok(done<OpenEntity | R, EntityOutput>(r)) : err({ _tag: "commit_conflict" });
    return chain(preauthenticate(r, frame, bundles, ctx), () => chain(normalized, (sigs): Result<EntityApply<OpenEntity | R>, EntityError> => {
      if ([...sigs].some(([id, s]) => !bundleValid(r.state.quorum, frame.hashesToSign, id, s, ctx))) return err({ _tag: "invalid_signature", address: "" });
      const held = heldFrame(r);
      if (held !== undefined) return unwrapOr(hashEntityFrame(held.frame), () => "") === frameHash ? installFrame(held, frameHash, sigs, false) : err({ _tag: "commit_conflict" });
      return chain(replayFrame(r, frame, frameHash, ctx), (candidate) => installFrame({ ...r, ...candidate }, frameHash, sigs, false));
    }));
  });
};
/** og handleProposedFramePrecommit then handleHashPrecommits: replay, sign the manifest, lock, send the precommit to every other validator; commit when the lock already holds a quorum. */
const signProposal = (r: OpenEntity, frame: EntityFrame, bundles: Precommits, ctx: EntityContext): Result<EntityApply<OpenEntity | LockedEntity>, EntityError> => {
  if (frame.height < r.head.height) return ok(done<OpenEntity | LockedEntity, EntityOutput>(r));
  return chain(hashEntityFrame(frame), (frameHash): Result<EntityApply<OpenEntity | LockedEntity>, EntityError> => {
    if (frame.height === r.head.height) return frameHash === r.head.prevFrameHash ? ok(done<OpenEntity | LockedEntity, EntityOutput>(r)) : err({ _tag: "proposal_conflict" });
    if (frame.height !== r.head.height + 1n) return err({ _tag: "proposal_wait" });
    return chain(preauthenticate(r, frame, bundles, ctx), () => chain(notSuperseded(r, frame), () => chain(replayFrame(r, frame, frameHash, ctx), (candidate) => chain(signManifest(candidate.frame.hashesToSign, r.signerId, ctx), (own) =>
      chain(normalizeBundles(r.state.quorum, bundles), (sigs): Result<EntityApply<OpenEntity | LockedEntity>, EntityError> => {
        if ([...sigs].some(([id, s]) => !bundleValid(r.state.quorum, frame.hashesToSign, id, s, ctx))) return err({ _tag: "invalid_signature", address: "" });
        const self = signerId(r.signerId), mine = sigs.get(self);
        if (mine !== undefined && !sameSigs(mine, own)) return err({ _tag: "local_precommit_conflict" });
        const locked: LockedEntity = { ...r, _tag: "locked", ...candidate, signatures: mapSet(sigs, self, own) };
        const precommits = [...membersOf(r.state.quorum).keys()].filter((v) => signerId(v) !== self)
          .map((v): EntityOutput => ({ to: r.state.id, signerId: v, input: { kind: "precommit", height: frame.height, frameHash, signatures: new Map([[self, own]]) } }));
        if (quorumPower(r.state.quorum, locked.signatures) < thresholdOf(r.state.quorum)) return ok(done<OpenEntity | LockedEntity, EntityOutput>(locked, precommits));
        return map(installFrame(locked, frameHash, locked.signatures, true), (committed) => done<OpenEntity | LockedEntity, EntityOutput>(committed.replica, [...precommits, ...committed.outputs]));
      })))));
  });
};
/** og validateProposalViewAndJRange: a view this validator already voted past (or holds a certificate for) supersedes the proposal. */
const notSuperseded = (r: EntityEnv, frame: EntityFrame): Result<void, EntityError> => {
  const height = Number(frame.height), self = signerId(r.signerId);
  const effective = Math.max(frame.leader.view, frame.leader.certificate?.toView ?? -1, frame.leader.relayCertificate?.toView ?? -1);
  const voted = Math.max(-1, ...[...(r.leaderVotes?.values() ?? [])].filter((v) => signerId(v.voterId) === self && v.targetHeight === height && v.signature.length > 0).map((v) => v.toView));
  const certified = r.pendingLeaderCertificate?.targetHeight === height ? r.pendingLeaderCertificate.toView : -1;
  return guard(Math.max(voted, certified) <= effective, { _tag: "proposal_superseded" });
};
/** og respondToActiveDuplicate: the same proposal again re-sends this validator's precommit. */
const resendPrecommit = (r: LockedEntity, frame: EntityFrame): Result<EntityApply<LockedEntity>, EntityError> => chain(hashEntityFrame(r.frame), (held) => chain(hashEntityFrame(frame), (frameHash): Result<EntityApply<LockedEntity>, EntityError> => {
  if (frame.height < r.head.height || (frame.height === r.head.height && frameHash === r.head.prevFrameHash)) return ok(done(r));
  if (frameHash !== held) return frame.height > r.frame.height ? err({ _tag: "proposal_wait" }) : err({ _tag: "proposal_conflict" });
  const self = signerId(r.signerId), own = r.signatures.get(self) ?? [];
  return ok(done(r, [...membersOf(r.state.quorum).keys()].filter((v) => signerId(v) !== self)
    .map((v): EntityOutput => ({ to: r.state.id, signerId: v, input: { kind: "precommit", height: frame.height, frameHash, signatures: new Map([[self, own]]) } }))));
}));
type ProposalInput = Extract<EntityInput, { kind: "proposal" }>;
const proposalOpen = (r: OpenEntity, input: ProposalInput, ctx: EntityContext): Result<EntityApply<OpenEntity | LockedEntity>, EntityError> =>
  commitNotification(r, input.frame, input.signatures, ctx) ?? signProposal(r, input.frame, input.signatures, ctx);
const proposalLocked = (r: LockedEntity, input: ProposalInput, ctx: EntityContext): Result<EntityApply<OpenEntity | LockedEntity>, EntityError> =>
  commitNotification(r, input.frame, input.signatures, ctx) ?? resendPrecommit(r, input.frame);
const proposalProposed = (r: ProposedEntity, input: ProposalInput, ctx: EntityContext): Result<EntityApply<OpenEntity | ProposedEntity>, EntityError> =>
  commitNotification(r, input.frame, input.signatures, ctx) ?? chain(hashEntityFrame(r.frame), (held) => chain(hashEntityFrame(input.frame), (frameHash): Result<EntityApply<OpenEntity | ProposedEntity>, EntityError> =>
    input.frame.height < r.head.height || (input.frame.height === r.head.height && frameHash === r.head.prevFrameHash) || frameHash === held ? heldQuorum(r, [])
      : input.frame.height > r.frame.height ? err({ _tag: "proposal_wait" }) : err({ _tag: "proposal_conflict" })));
/** og handleHashPrecommits: verify each signer's bundle against the held manifest, refuse equivocation, commit and broadcast at quorum. */
export const applyPrecommitHeld = <R extends ProposedEntity | LockedEntity>(r: R, input: Extract<EntityInput, { kind: "precommit" }>, ctx: EntityContext): Result<EntityApply<OpenEntity | R>, EntityError> =>
  chain(hashEntityFrame(r.frame), (frameHash) => {
    if (input.signatures.size > 0 && (input.height !== r.frame.height || !sameHex(input.frameHash, frameHash))) return err({ _tag: "precommit_frame_mismatch" });
    return chain(normalizeBundles(r.state.quorum, input.signatures), (incoming) => chain(foldResult(incoming, r.signatures, (held, [id, sigs]): Result<Precommits, EntityError> => {
      if (!bundleValid(r.state.quorum, r.frame.hashesToSign, id, sigs, ctx)) return err({ _tag: "invalid_signature", address: id });
      const existing = held.get(id);
      return existing !== undefined && !sameSigs(existing, sigs) ? err({ _tag: "precommit_signer_equivocation" }) : ok(mapSet(held, id, sigs));
    }), (signatures) => heldQuorum<R>({ ...r, signatures }, [])));
  });
/** og: no active frame; a precommit for a height already committed is a no-op so reliable ingress can terminalize it. */
const precommitOpen = (r: OpenEntity, input: Extract<EntityInput, { kind: "precommit" }>): Result<EntityApply<OpenEntity>, EntityError> =>
  input.signatures.size === 0 || r.head.height > input.height ? ok(done(r)) : err({ _tag: "precommit_not_active" });
type VoteInput = Extract<EntityInput, { kind: "leaderTimeoutVote" }>;
/** og handleLeaderTimeoutVote: the vote must be for exactly this view change from a validator; a local intent is signed here and broadcast. */
const acceptVote = (r: EntityReplica, input: VoteInput, ctx: EntityContext): Result<{ readonly vote: LeaderVote; readonly outputs: readonly EntityOutput[] }, EntityError> => {
  const incoming = input.vote, q = r.state.quorum, voter = signerId(incoming.voterId), invalid: EntityError = { _tag: "leader_vote_invalid" }, addr = memberId(q, voter);
  if (!voteMatchesState(r.state, r.head, incoming) || addr === undefined) return err(invalid);
  return chain(hashLeaderVote(incoming), (h): Result<{ readonly vote: LeaderVote; readonly outputs: readonly EntityOutput[] }, EntityError> => {
    if (input.local !== true) { const sig = sigOf(incoming.signature); return sig !== undefined && memberSigned(q, h, sig, addr, ctx) ? ok({ vote: incoming, outputs: [] }) : err(invalid); }
    if (voter !== signerId(r.signerId) || incoming.signature !== "") return err(invalid);
    return map(mapErr(ctx.sign(h as Hash, r.signerId), (): EntityError => ({ _tag: "sign_failed" })), (sig) => {
      const vote: LeaderVote = { ...incoming, signature: sig };
      return { vote, outputs: [...membersOf(q).keys()].filter((v) => signerId(v) !== voter).map((v): EntityOutput => ({ to: r.state.id, signerId: v, input: { kind: "leaderTimeoutVote", timestamp: input.timestamp, vote } })) };
    });
  });
};
/** og: votes are collected under one collection key (a newer view change resets them); a different second vote from a voter is equivocation, an identical one a no-op. */
const addVote = (r: EntityEnv, vote: LeaderVote): Result<{ readonly votes: ReadonlyMap<string, LeaderVote>; readonly fresh: boolean }, EntityError> => chain(collectionKey(vote), (key) => {
  const [first] = r.leaderVotes?.values() ?? [], voter = signerId(vote.voterId);
  const votes = first === undefined || unwrapOr(collectionKey(first), () => "") === key ? r.leaderVotes ?? new Map<string, LeaderVote>() : new Map<string, LeaderVote>();
  const prev = votes.get(voter);
  if (prev === undefined) return ok({ votes: mapSet(votes, voter, vote), fresh: true as boolean });
  const bytes = (v: LeaderVote): Result<string, EntityError> => chain(voteBinary(v), (b) => map(encodeConsensus(b), bytesToHex));
  return chain(bytes(prev), (a) => chain(bytes(vote), (b) => (a === b ? ok({ votes, fresh: false as boolean }) : err({ _tag: "leader_vote_equivocation" }))));
});
/** og installLeaderCertificate + selectPreparedFrame: at quorum, certify the view change; a prepared quorum frame becomes this replica's lock, a sub-quorum lock is dropped. */
const certify = (r: EntityReplica, vote: LeaderVote, votes: ReadonlyMap<string, LeaderVote>, ctx: EntityContext): Result<EntityReplica, EntityError> => {
  const q = r.state.quorum, base: EntityReplica = { ...r, leaderVotes: votes };
  if ([...votes.keys()].reduce((n, id) => n + sharesOf(q, id), 0n) < thresholdOf(q)) return ok(base);
  const cert = buildLeaderCertificate(vote, votes), lock = r._tag === "locked" ? r : undefined, rejected: EntityError = { _tag: "leader_prepared_rejected" };
  return chain(lock === undefined ? ok(false) : preparedQuorum(q, lock.frame, lock.signatures, ctx), (lockQuorum) => chain(selectPrepared(r, cert, ctx), (prepared): Result<EntityReplica, EntityError> => {
    if (prepared === null) {
      if (lockQuorum) return err(rejected);
      return ok(lock === undefined ? { ...base, pendingLeaderCertificate: cert } : { ...openEntity(lock.signerId, lock.state, lock.head, lock.mempool, lock.accountReplicas), leaderVotes: votes, pendingLeaderCertificate: cert });
    }
    return chain(hashEntityFrame(prepared.frame), (hash): Result<EntityReplica, EntityError> => {
      const lockHash = lock === undefined ? undefined : unwrapOr(hashEntityFrame(lock.frame), () => "");
      if (lock !== undefined && lockQuorum && lockHash !== hash && lock.frame.leader.view >= prepared.frame.leader.view) return err(rejected);
      const pending: LeaderCertificate = { ...cert, preparedFrameHash: hash }, frame: EntityFrame = { ...prepared.frame, leader: { ...prepared.frame.leader, relayCertificate: pending } };
      if (r._tag === "proposed") return ok({ ...base, pendingLeaderCertificate: pending });
      if (lock !== undefined && lockHash === hash) return ok({ ...lock, leaderVotes: votes, pendingLeaderCertificate: pending, frame, signatures: prepared.signatures });
      return map(replayFrame(r, prepared.frame, hash as EntityFrameHash, ctx), (candidate): EntityReplica =>
        ({ ...openEntity(r.signerId, r.state, r.head, r.mempool, r.accountReplicas), ...candidate, _tag: "locked", frame, signatures: prepared.signatures, leaderVotes: votes, pendingLeaderCertificate: pending }));
    });
  }));
};
/** og relayPreparedFrameIfReady: the certified leader re-proposes exactly the prepared frame with its relay certificate. */
const relayPrepared = (l: LockedEntity): Result<EntityApply<LockedEntity | ProposedEntity>, EntityError> | undefined => {
  const c = l.pendingLeaderCertificate;
  if (!isProposalLeader(l) || isSingleSigner(l.state.quorum) || c === undefined || c.targetHeight !== Number(l.head.height) + 1 || c.preparedFrameHash === undefined) return undefined;
  return chain(hashEntityFrame(l.frame), (hash): Result<EntityApply<LockedEntity | ProposedEntity>, EntityError> => {
    if (hash !== c.preparedFrameHash) return err({ _tag: "leader_prepared_rejected" });
    const frame: EntityFrame = { ...l.frame, leader: { ...l.frame.leader, relayCertificate: c } }, self = signerId(l.signerId);
    return ok(done<LockedEntity | ProposedEntity, EntityOutput>({ ...l, _tag: "proposed", frame }, [...membersOf(l.state.quorum).keys()].filter((v) => signerId(v) !== self)
      .map((v): EntityOutput => ({ to: l.state.id, signerId: v, input: { kind: "proposal", frame, signatures: l.signatures } }))));
  });
};
/** og applyEntityInput with a `leaderTimeoutVote` lane: vote, maybe certify, then the ordinary proposal step (relay, a certified empty frame, or a held quorum). */
const leaderVote = (r: EntityReplica, input: VoteInput, ctx: EntityContext): Result<EntityApply<EntityReplica>, EntityError> => chain(acceptVote(r, input, ctx), ({ vote, outputs }) =>
  chain(addVote(r, vote), ({ votes, fresh }) => chain(fresh ? certify(r, vote, votes, ctx) : ok(r), (next): Result<EntityApply<EntityReplica>, EntityError> => {
    const after = match(next, {
      open: (o): Result<EntityApply<EntityReplica>, EntityError> => startProposal(o, input.timestamp, ctx),
      proposed: (p): Result<EntityApply<EntityReplica>, EntityError> => heldQuorum(p, []),
      locked: (l): Result<EntityApply<EntityReplica>, EntityError> => relayPrepared(l) ?? heldQuorum(l, []),
    });
    return map(after, (a) => done(a.replica, [...outputs, ...a.outputs]));
  })));
const entityVerb = grammar<EntityGrammar>(EntityTransition);
const applyTxs = entityVerb("txs", { open: applyTxsOpen, proposed: (r: ProposedEntity, i, c) => queueOnly(r, i, c), locked: (r: LockedEntity, i, c) => queueOnly(r, i, c) });
const applyProposal = entityVerb("proposal", { open: proposalOpen, proposed: proposalProposed, locked: proposalLocked });
const applyPrecommit = entityVerb("precommit", { open: precommitOpen, proposed: (r: ProposedEntity, i, c) => applyPrecommitHeld(r, i, c), locked: (r: LockedEntity, i, c) => applyPrecommitHeld(r, i, c) });
/** A proposed replica keeps its own proposal (og never replaces `proposal` on a view change), so it only ever leaves as open or proposed. */
const applyLeaderVote = entityVerb("leaderTimeoutVote", {
  open: (r: OpenEntity, i, c) => leaderVote(r, i, c), locked: (r: LockedEntity, i, c) => leaderVote(r, i, c),
  proposed: (r: ProposedEntity, i, c) => leaderVote(r, i, c) as Result<EntityApply<OpenEntity | ProposedEntity>, EntityError>,
});
/** One input to one validator replica (og applyEntityInput); `ctx.signerId` must name this replica. */
export const applyEntityInput = (r: EntityReplica, input: EntityInput, ctx: EntityContext): Result<EntityApply, EntityError> => {
  if (ctx.self !== r.state.id) return err({ _tag: "wrong_entity" });
  if (signerId(ctx.signerId) !== signerId(r.signerId)) return err({ _tag: "wrong_replica", address: ctx.signerId });
  return matchBy("kind", input, { txs: (i) => applyTxs(r, i, ctx), proposal: (i) => applyProposal(r, i, ctx), precommit: (i) => applyPrecommit(r, i, ctx), leaderTimeoutVote: (i) => applyLeaderVote(r, i, ctx) });
};

/** og runtime/types.ts JInput: one deterministic child-machine input for a J replica; the rewrite carries the J txs uninterpreted (J area). */
export type JInput = { readonly jurisdictionName: string; readonly jTxs: readonly Binary[] };
/** og RoutedEntityInput: an EntityInput addressed to one validator replica; `from` is the source Runtime (absent for local work). */
export type RoutedEntityInput = { readonly entityId: EntityId; readonly signerId: string; readonly input: EntityInput; readonly from?: string | undefined };
/** og ConsensusConfig as carried by importReplica. */
export type ImportConfig = EntityRootConfig & { readonly jurisdiction?: (EntityRootJurisdiction & { readonly name?: string | undefined }) | undefined };
type RuntimeData = { readonly [field: string]: Binary };
/** og runtime/types.ts RuntimeTx: every kind with og's field names. */
export type RuntimeTx =
  | { readonly type: "checkpointBarrier"; readonly data: Record<string, never> }
  | { readonly type: "recordRuntimeAdapterCommand"; readonly data: { readonly laneId: string; readonly sequence: number; readonly commandId: string; readonly inputHash: string; readonly expiresAtMs: number | null } }
  | { readonly type: "recordNumberedRegistrationIntent"; readonly data: RuntimeData }
  | { readonly type: "resolveNumberedRegistrationIntent"; readonly data: RuntimeData }
  | { readonly type: "recordAuthenticatedJAuthority"; readonly data: RuntimeData }
  | { readonly type: "importReplica"; readonly entityId: string; readonly signerId: string; readonly data: { readonly config: ImportConfig; readonly isProposer: boolean; readonly entitySeed: string; readonly profileName?: string | undefined; readonly position?: { readonly x: number; readonly y: number; readonly z: number; readonly jurisdiction?: string | undefined } | undefined } }
  | { readonly type: "observeJRange"; readonly data: { readonly entityId: string; readonly signerId: string; readonly jurisdictionRef: string; readonly scannedThroughHeight: number; readonly tipBlockHash: string; readonly headers?: readonly Binary[] | undefined; readonly blocks: readonly Binary[] } }
  | { readonly type: "advanceJWatcherCursor"; readonly data: { readonly depositoryAddress: string; readonly chainId: number; readonly blockNumber: number } }
  | { readonly type: "rewindJHistory"; readonly data: { readonly entityId: string; readonly signerId: string; readonly jurisdictionRef: string; readonly conflictingHeight: number; readonly conflictingBlockHash: string } }
  | { readonly type: "retryJSubmit"; readonly data: { readonly entityId: string; readonly signerId: string; readonly jurisdictionName: string; readonly batchHash: string; readonly entityNonce: number; readonly batchGeneration: number; readonly feeOverrides?: Binary | undefined } }
  | { readonly type: "recordJSubmitResult"; readonly data: RuntimeData }
  | { readonly type: "retryEntityProviderAction"; readonly data: RuntimeData }
  | { readonly type: "recordEntityProviderActionSubmitResult"; readonly data: RuntimeData }
  | { readonly type: "recordGovernanceJSubmitResult"; readonly data: RuntimeData }
  | { readonly type: "importJ"; readonly data: RuntimeData }
  | { readonly type: "completeImportJ"; readonly data: RuntimeData };
export type RuntimeTxType = RuntimeTx["type"];
/** og RuntimeInput: runtime txs first, then entity inputs, then J inputs (queued to the J mempool). `timestamp` is the ingress seed. */
export type RuntimeInput = { readonly runtimeTxs: readonly RuntimeTx[]; readonly entityInputs: readonly RoutedEntityInput[]; readonly jInputs?: readonly JInput[] | undefined; readonly timestamp?: bigint | undefined };
/** og infrastructure.runtimeAdapterCommandFrontiers row. */
export type AdapterFrontier = { readonly lastContiguousSequence: number; readonly lastInputHash: string; readonly lastCommandId: string; readonly observedHeight: number; readonly expiresAtMs: number | null };
/**
 * og RuntimeReplica: `entities` is `eReplicas` (one replica per `entityId:signerId`, signer lowercased); `height`/`timestamp` are RuntimeState;
 * `jurisdictions` names the J replicas; `adapterFrontiers` and `encryptionSeeds` are og infrastructure maps; `frameHash` is the WAL head.
 */
export type Runtime = {
  readonly entities: ReadonlyMap<string, EntityReplica>; readonly height: bigint; readonly timestamp: bigint; readonly jurisdictions: ReadonlySet<string>;
  readonly adapterFrontiers: ReadonlyMap<string, AdapterFrontier>; readonly encryptionSeeds: ReadonlyMap<string, string>; readonly frameHash: string;
};
/** A whole-frame refusal carries og's error code (og throws out of the Runtime reducer, so nothing of the frame applies). */
export type RuntimeError = EntityError | Tagged<"no_such_entity", { id: EntityId }> | Tagged<"runtime_frame" | "runtime_tx" | "runtime_tx_unsupported", { code: string }>;
export type Verifiers = { readonly verify: Verify; readonly verifyMember: MemberVerify; readonly sign: MemberSign };
/** og capability markers: `local` holds the exact RuntimeTx objects this process authorized (og's Symbol tags); replay trusts the WAL. */
export type RuntimeCtx = Verifiers & { readonly replay?: boolean | undefined; readonly local?: ReadonlySet<RuntimeTx> | undefined };
export const ZERO_FRAME_HASH = `0x${"00".repeat(32)}`;
export const replicaKey = (entity: EntityId, signer: string): string => `${entity}:${signerId(signer)}`;
export const createRuntime = (jurisdictions: Iterable<string> = []): Runtime =>
  ({ entities: new Map(), height: 0n, timestamp: 0n, jurisdictions: new Set(jurisdictions), adapterFrontiers: new Map(), encryptionSeeds: new Map(), frameHash: ZERO_FRAME_HASH });
export const spawn = (rt: Runtime, r: EntityReplica): Runtime => ({ ...rt, entities: mapSet(rt.entities, replicaKey(r.state.id, r.signerId), r) });
/** og resolveEntityProposerId: an Account message goes to the receiver's active leader (the CEO `validators[0]` until a view change); a consensus input to the named validator. */
export const convertOutput = (rt: Runtime, item: EntityOutput, from: EntityId, timestamp: bigint): Result<RoutedEntityInput, RuntimeError> => {
  if ("input" in item) return ok({ entityId: item.to, signerId: item.signerId, input: item.input });
  const receiver = [...rt.entities.values()].find((r) => r.state.id === item.to);
  if (receiver === undefined) return err({ _tag: "no_such_entity", id: item.to });
  const leader = memberId(receiver.state.quorum, leaderStateOf(receiver.state).activeValidatorId) ?? allowedProposer(receiver.state.quorum);
  return ok({ entityId: item.to, from, signerId: leader, input: { kind: "txs", timestamp, txs: [item.tx] } });
};

// ---- og runtime/frame/intake: shape limits, capabilities, merge ----
const MAX_RUNTIME_INPUT_RUNTIME_TXS = 10_000, MAX_RUNTIME_INPUT_ENTITY_INPUTS = 10_000, MAX_RUNTIME_J_INPUTS = 256, MAX_RUNTIME_J_TXS = 1_024, MAX_RUNTIME_J_TXS_PER_JURISDICTION = 512;
const frameErr = (code: string): Result<never, RuntimeError> => err({ _tag: "runtime_frame", code });
/** og validateRuntimeInputShapeAndLimits + collectJOutbox: a checkpoint barrier stands alone; bounded counts; every J input names a known J replica. */
export const validateRuntimeInput = (rt: Runtime, input: RuntimeInput): Result<readonly JInput[], RuntimeError> => {
  const barriers = input.runtimeTxs.filter((tx) => tx.type === "checkpointBarrier").length, jInputs = input.jInputs ?? [];
  if (barriers > 0 && (barriers !== 1 || input.runtimeTxs.length !== 1 || input.entityInputs.length !== 0 || jInputs.length !== 0)) return frameErr("CHECKPOINT_BARRIER_NOT_ALONE");
  if (input.jInputs !== undefined) {
    if (jInputs.length > MAX_RUNTIME_J_INPUTS) return frameErr("RUNTIME_J_INPUTS_MAX");
    let total = 0;
    const perJ = new Map<string, number>();
    for (const j of jInputs) {
      if (!rt.jurisdictions.has(j.jurisdictionName)) return frameErr("RUNTIME_J_UNKNOWN_JURISDICTION");
      total += j.jTxs.length;
      if (total > MAX_RUNTIME_J_TXS) return frameErr("RUNTIME_J_TXS_MAX");
      const n = (perJ.get(j.jurisdictionName) ?? 0) + j.jTxs.length;
      if (n > MAX_RUNTIME_J_TXS_PER_JURISDICTION) return frameErr("RUNTIME_J_TXS_PER_JURISDICTION_MAX");
      perJ.set(j.jurisdictionName, n);
    }
  }
  if (input.runtimeTxs.length > MAX_RUNTIME_INPUT_RUNTIME_TXS) return frameErr("RUNTIME_TXS_MAX");
  return input.entityInputs.length > MAX_RUNTIME_INPUT_ENTITY_INPUTS ? frameErr("RUNTIME_ENTITY_INPUTS_MAX") : ok(jInputs);
};
/** og internal-tx-auth.ts: every RuntimeTx except importReplica/importJ needs a local capability, or replay. */
const CAPABILITY_CODES: { readonly [T in RuntimeTxType]: string | null } = {
  checkpointBarrier: "CHECKPOINT_BARRIER_EXTERNAL_RUNTIME_TX_REJECTED", recordRuntimeAdapterCommand: "RADAPTER_COMMAND_RUNTIME_TX_UNAUTHORIZED",
  recordNumberedRegistrationIntent: "NUMBERED_REGISTRATION_EXTERNAL_RUNTIME_TX_REJECTED", resolveNumberedRegistrationIntent: "NUMBERED_REGISTRATION_EXTERNAL_RUNTIME_TX_REJECTED",
  recordAuthenticatedJAuthority: "J_AUTHORITY_RUNTIME_TX_EXTERNAL_INGRESS_REJECTED", observeJRange: "J_AUTHORITY_RUNTIME_TX_EXTERNAL_INGRESS_REJECTED",
  advanceJWatcherCursor: "J_AUTHORITY_RUNTIME_TX_EXTERNAL_INGRESS_REJECTED", rewindJHistory: "J_AUTHORITY_RUNTIME_TX_EXTERNAL_INGRESS_REJECTED",
  retryJSubmit: "J_SUBMIT_RUNTIME_TX_EXTERNAL_INGRESS_REJECTED", recordJSubmitResult: "J_SUBMIT_RUNTIME_TX_EXTERNAL_INGRESS_REJECTED",
  retryEntityProviderAction: "ENTITY_PROVIDER_ACTION_RUNTIME_TX_EXTERNAL_INGRESS_REJECTED", recordEntityProviderActionSubmitResult: "ENTITY_PROVIDER_ACTION_RUNTIME_TX_EXTERNAL_INGRESS_REJECTED",
  recordGovernanceJSubmitResult: "GOVERNANCE_SUBMIT_RESULT_EXTERNAL_INGRESS_REJECTED", completeImportJ: "J_IMPORT_RESULT_EXTERNAL_INGRESS_REJECTED",
  importReplica: null, importJ: null,
};
export const runtimeTxAuthorized = (tx: RuntimeTx, ctx: Pick<RuntimeCtx, "replay" | "local">): Result<void, RuntimeError> => {
  const code = CAPABILITY_CODES[tx.type];
  return code === null || ctx.replay === true || ctx.local?.has(tx) === true ? ok(undefined) : err({ _tag: "runtime_tx", code });
};
const inputFingerprint = (tx: EntityTx): string => encodeEntityTx(tx);
const frameIdOf = (frame: EntityFrame): string => { const h = hashEntityFrame(frame); return h.ok ? h.value : canon(frame); };
type Lane = { readonly entityId: EntityId; readonly signerId: string; readonly from?: string | undefined; readonly timestamp: bigint; readonly txs?: readonly EntityTx[] | undefined; readonly proposal?: Extract<EntityInput, { kind: "proposal" }> | undefined; readonly precommit?: Extract<EntityInput, { kind: "precommit" }> | undefined; readonly vote?: VoteInput | undefined };
const laneOf = (i: RoutedEntityInput): Lane => matchBy("kind", i.input, {
  txs: (x): Lane => ({ entityId: i.entityId, signerId: i.signerId, from: i.from, timestamp: x.timestamp, txs: x.txs }),
  proposal: (x): Lane => ({ entityId: i.entityId, signerId: i.signerId, from: i.from, timestamp: x.frame.timestamp, proposal: x }),
  precommit: (x): Lane => ({ entityId: i.entityId, signerId: i.signerId, from: i.from, timestamp: 0n, precommit: x }),
  leaderTimeoutVote: (x): Lane => ({ entityId: i.entityId, signerId: i.signerId, from: i.from, timestamp: x.timestamp, vote: x }),
});
/** og entityInputMergeKey (without runtimeOutput / cross-j / J-prefix lanes, which the rewrite does not carry); each timeout vote is its own lane. */
const mergeKey = (l: Lane): string => {
  const base = `${lower(l.entityId)}:${lower(l.signerId)}`;
  if (l.vote !== undefined) return `${base}:leader:${l.vote.vote.targetHeight}:${lower(l.vote.vote.voterId)}:${unwrapOr(hashLeaderVote(l.vote.vote), () => canon(l.vote?.vote))}`;
  if (l.precommit !== undefined) return `${base}:precommit:${l.precommit.height}:${lower(l.precommit.frameHash)}`;
  return l.txs !== undefined && l.txs.length > 0 ? `${base}:tx-origin:${lower(l.from)}` : base;
};
/** og mergePrecommitBundles: signer ids trimmed/lowercased; a second different bundle from one signer is equivocation. */
const mergeBundles = (existing: Precommits, incoming: Precommits): Result<Precommits, RuntimeError> => {
  const normalize = (m: Precommits, source: string): Result<Map<string, readonly Signature[]>, RuntimeError> => {
    const out = new Map<string, readonly Signature[]>();
    for (const [raw, sigs] of m) { const id = signerId(raw); if (out.has(id)) return frameErr(`ENTITY_INPUT_PRECOMMIT_DUPLICATE_SIGNER:${source}`); out.set(id, sigs); }
    return ok(out);
  };
  return chain(normalize(existing, "existing"), (merged) => chain(normalize(incoming, "incoming"), (next) => {
    for (const [id, sigs] of next) {
      const previous = merged.get(id);
      if (previous === undefined) merged.set(id, sigs);
      else if (!sameSigs(previous, sigs)) return frameErr("ENTITY_INPUT_PRECOMMIT_EQUIVOCATION");
    }
    return ok(merged);
  }));
};
/** og isExactTransactionReplay: the same origin re-delivering the exact same tx list is one input. */
const exactReplay = (a: Lane, b: Lane): boolean => lower(a.from) === lower(b.from) && canon((a.txs ?? []).map(inputFingerprint)) === canon((b.txs ?? []).map(inputFingerprint));
/** og mergeExactAccountInputReplays: an exact duplicate accountInput inside one lane is dropped. */
const dedupAccountInputs = (txs: readonly EntityTx[]): readonly EntityTx[] => firstBy(txs, (tx) => (tx.type === "accountInput" ? inputFingerprint(tx) : undefined));
/**
 * og mergeEntityInputs: inputs for one replica lane collapse into one, in first-arrival order; a second different proposal for the lane
 * is kept as a conflict after every merged input; a precommit equivocation refuses the whole Runtime frame.
 */
export const mergeEntityInputs = (inputs: readonly RoutedEntityInput[]): Result<readonly RoutedEntityInput[], RuntimeError> => {
  const merged = new Map<string, Lane>(), conflicts: Lane[] = [];
  for (const input of inputs) {
    const lane = laneOf(input), key = mergeKey(lane), existing = merged.get(key);
    if (existing === undefined) { merged.set(key, lane); continue; }
    if (existing.proposal !== undefined && lane.proposal !== undefined && (frameIdOf(existing.proposal.frame) !== frameIdOf(lane.proposal.frame) || existing.proposal.frame.height !== lane.proposal.frame.height)) { conflicts.push(lane); continue; }
    if ((lane.vote !== undefined || existing.vote !== undefined) && canon(lane.vote?.vote) !== canon(existing.vote?.vote)) return frameErr(`ENTITY_LEADER_VOTE_EQUIVOCATION:${lane.vote?.vote.voterId ?? "missing"}`);
    let next: Lane = existing;
    if (lane.txs !== undefined && !exactReplay(existing, lane)) next = { ...next, txs: [...(existing.txs ?? []), ...lane.txs] };
    if (lane.precommit !== undefined && existing.precommit !== undefined) {
      const bundles = mergeBundles(existing.precommit.signatures, lane.precommit.signatures);
      if (!bundles.ok) return bundles;
      next = { ...next, precommit: { ...existing.precommit, signatures: bundles.value } };
    }
    if (lane.proposal !== undefined && existing.proposal === undefined) next = { ...next, proposal: lane.proposal };
    merged.set(key, next);
  }
  return ok([...merged.values(), ...conflicts].map((l): RoutedEntityInput => {
    const input: EntityInput = l.vote ?? l.proposal ?? l.precommit ?? { kind: "txs", timestamp: l.timestamp, txs: dedupAccountInputs(l.txs ?? []) };
    return { entityId: l.entityId, signerId: l.signerId, input, ...opt("from", l.from) };
  }));
};

// ---- og runtime/tx/tx-handlers.ts ----
const HASH_32 = /^0x[0-9a-f]{64}$/, COMMAND_ID = /^[A-Za-z0-9._:-]{16,128}$/, MAX_ACTIVE_RUNTIME_ADAPTER_COMMAND_LANES = 1_024;
const txErr = (code: string): Result<never, RuntimeError> => err({ _tag: "runtime_tx", code });
/** og applyRuntimeAdapterCommandMarker: validate, prune other expired lanes, require the next contiguous sequence, record the frontier. */
const adapterCommand = (rt: Runtime, raw: Extract<RuntimeTx, { type: "recordRuntimeAdapterCommand" }>["data"]): Result<Runtime, RuntimeError> => {
  const laneId = lower(raw.laneId), commandId = String(raw.commandId || "").trim(), inputHash = lower(raw.inputHash), sequence = Number(raw.sequence);
  const expiresAtMs = raw.expiresAtMs === null ? null : Number(raw.expiresAtMs);
  if (!Number.isSafeInteger(sequence) || sequence <= 0) return txErr("RADAPTER_COMMAND_SEQUENCE_INVALID");
  if (!HASH_32.test(laneId)) return txErr("RADAPTER_COMMAND_LANE_INVALID");
  if (!COMMAND_ID.test(commandId)) return txErr("RADAPTER_COMMAND_ID_INVALID");
  if (!HASH_32.test(inputHash)) return txErr("RADAPTER_COMMAND_INPUT_HASH_INVALID");
  if (expiresAtMs !== null && (!Number.isSafeInteger(expiresAtMs) || expiresAtMs <= 0)) return txErr("RADAPTER_COMMAND_EXPIRY_INVALID");
  const nowMs = rt.timestamp < 0n ? 0 : Number(rt.timestamp);
  const kept = new Map([...rt.adapterFrontiers].filter(([id, f]) => id === laneId || f.expiresAtMs === null || f.expiresAtMs > nowMs));
  const prior = kept.get(laneId);
  if (sequence !== (prior?.lastContiguousSequence ?? 0) + 1) return txErr("RADAPTER_COMMAND_FRONTIER_NONCONTIGUOUS");
  if (prior === undefined && kept.size >= MAX_ACTIVE_RUNTIME_ADAPTER_COMMAND_LANES) return txErr("RADAPTER_COMMAND_FRONTIER_CAPACITY_EXCEEDED");
  kept.set(laneId, { lastContiguousSequence: sequence, lastInputHash: inputHash, lastCommandId: commandId, observedHeight: Number(rt.height) + 1, expiresAtMs });
  return ok({ ...rt, adapterFrontiers: kept });
};
/** og registration/entity-creation/crypto.ts + entity/auth/crypto.ts: HKDF-SHA256(seed, salt=entityId, info) then X25519. */
export const entityEncryptionPublicKey = (seed: string, entity: string): string => {
  const priv = hkdf(sha256, hexToBytes(seed), utf8(lower(entity)), utf8("xln:entity-encryption:v1"), 32);
  return bytesToHex(x25519.getPublicKey(priv)).toLowerCase();
};
const MAX_NUMBERED_ENTITY = 1_000_000n;
/** Called only on a 0x-prefixed 32-byte hex id (checked first), so the BigInt parse cannot fail. */
const isNumberedEntity = (id: string): boolean => { const n = BigInt(id); return n > 0n && n < MAX_NUMBERED_ENTITY; };
/** og ethers.getAddress: a mixed-case address must carry its EIP-55 checksum. */
const checksumValid = (a: string): boolean => { const body = a.slice(2); return body === body.toLowerCase() || body === body.toUpperCase() || checksum(a) === a; };
/** og ethers.computeAddress over a 33/65-byte secp256k1 public key; an off-curve key is refused (og throws). */
const pubkeyAddress = (key: string): string | null => {
  try { return bytesToHex(keccak256(secp256k1.ProjectivePoint.fromHex(hexBody(key)).toRawBytes(false).slice(1)).slice(12)); } catch { return null; }
};
/** og toBoardEntityId + resolveValidatorAddress: a bytes32 id as is, an EOA (or public key) as its zero-padded address. */
const boardValidatorId = (v: string): Result<string, RuntimeError> => {
  if (/^0x[0-9a-f]{64}$/i.test(v)) return ok(v.toLowerCase());
  if (v.startsWith("0x") && v.length === 42) return /^0x[0-9a-fA-F]{40}$/.test(v) && checksumValid(v) ? ok(addressAsId(v)) : txErr("BOARD_VALIDATOR_ADDRESS_INVALID");
  if (v.startsWith("0x") && (v.length === 68 || v.length === 132)) { const a = pubkeyAddress(v); return a === null ? txErr("BOARD_VALIDATOR_PUBLIC_KEY_INVALID") : ok(addressAsId(a)); }
  return txErr("BOARD_VALIDATOR_ADDRESS_REQUIRED");
};
/** og factory.ts encodeBoard -> hashBoard: the lazy Entity id of a board config (validators positional, shares as uint16 powers, zero delays). */
export const lazyBoardEntityId = (config: EntityRootConfig): Result<string, RuntimeError> => {
  if (config.validators.length === 0) return txErr("BOARD_EMPTY");
  const seen = new Set<string>();
  for (const v of config.validators) { const id = lower(v); if (id === "" || seen.has(id)) return txErr("BOARD_VALIDATOR_DUPLICATE_OR_EMPTY"); seen.add(id); }
  const proposer = config.validators[0] ?? "";
  if (!/^0x[0-9a-f]{40}$/i.test(proposer)) return txErr("BOARD_PROPOSER_EOA_REQUIRED");
  if (!checksumValid(proposer)) return txErr("BOARD_VALIDATOR_ADDRESS_INVALID");
  const shares = new Map<string, bigint>();
  for (const [raw, share] of Object.entries(config.shares)) {
    const id = lower(raw);
    if (id === "" || shares.has(id)) return txErr("BOARD_SHARE_DUPLICATE_OR_EMPTY");
    if (!seen.has(id)) return txErr("BOARD_SHARE_NOT_VALIDATOR");
    if (typeof share !== "bigint" || share <= 0n) return txErr("BOARD_VOTING_POWER_NOT_POSITIVE");
    shares.set(id, share);
  }
  return chain(traverse(config.validators, boardValidatorId), (ids): Result<string, RuntimeError> => {
    const powers: number[] = [];
    for (const v of config.validators) { const s = shares.get(lower(v)); if (s === undefined) return txErr("BOARD_VOTING_POWER_MISSING"); if (s > 0xffffn) return txErr("BOARD_WEIGHT_OUT_OF_RANGE"); powers.push(Number(s)); }
    if (config.threshold <= 0n) return txErr("BOARD_THRESHOLD_NOT_POSITIVE");
    if (config.threshold > 0xffffn) return txErr("BOARD_THRESHOLD_OUT_OF_RANGE");
    if (config.threshold > powers.reduce((t, p) => t + BigInt(p), 0n)) return txErr("BOARD_THRESHOLD_EXCEEDS_POWER");
    return ok(boardHashOf({ votingThreshold: Number(config.threshold), entityIds: ids, votingPowers: powers, boardChangeDelay: 0, controlChangeDelay: 0, dividendChangeDelay: 0 }));
  });
};
const sameJurisdictionStack = (a: Domain, b: Domain): boolean => a.chainId === b.chainId && lower(a.depositoryAddress) === lower(b.depositoryAddress);
const quorumOf = (config: ImportConfig): Result<Authority, RuntimeError> => {
  const members = new Map<Address, { readonly shares: bigint }>();
  for (const v of config.validators) {
    const a = address(v), share = Object.entries(config.shares).find(([k]) => lower(k) === lower(v))?.[1];
    if (!a.ok || share === undefined) return txErr("IMPORT_REPLICA_VALIDATOR_NOT_EOA");
    members.set(a.value, { shares: share });
  }
  return ok({ _tag: "teaching", threshold: config.threshold, members });
};
/**
 * og importReplicaRuntimeTx: normalize the identity, bind the jurisdiction, prove board authority (signer on board, proposer flag = board index 0,
 * lazy id = hashBoard(encodeBoard(config)); a numbered Entity needs certified registration evidence), check the seed-derived encryption key
 * against siblings and the retained seed, then reuse / checkpoint-import / create the genesis replica.
 */
const importReplica = (rt: Runtime, tx: Extract<RuntimeTx, { type: "importReplica" }>): Result<Runtime, RuntimeError> => {
  const entity = lower(tx.entityId), signer = lower(tx.signerId), { config, isProposer, entitySeed } = tx.data;
  if (entity === "" || signer === "") return txErr("IMPORT_REPLICA_INVALID_ID");
  const key = `${entity}:${signer}`, existing = [...rt.entities].find(([k]) => lower(k) === key);
  const j = config.jurisdiction;
  if (j === undefined || (j.name ?? "") === "") return txErr("ENTITY_JURISDICTION_MISSING");
  if (!rt.jurisdictions.has(j.name ?? "")) return txErr("ENTITY_JURISDICTION_RESOLVE_FAILED");
  if (j.depositoryAddress === "" || j.entityProviderAddress === "" || j.chainId === undefined || j.chainId === 0) return txErr("ENTITY_JURISDICTION_INCOMPLETE");
  const domain: Domain = { chainId: j.chainId, depositoryAddress: j.depositoryAddress };
  const siblings = [...rt.entities.values()].filter((r) => lower(r.state.id) === entity);
  if (siblings.some((r) => !sameJurisdictionStack(r.state.jurisdiction, domain))) return txErr("ENTITY_JURISDICTION_CONFLICT");
  const boardIndex = config.validators.findIndex((v) => lower(v) === signer);
  if (boardIndex < 0) return txErr("IMPORT_REPLICA_SIGNER_NOT_ON_BOARD");
  if (isProposer !== (boardIndex === 0)) return txErr("IMPORT_REPLICA_PROPOSER_FLAG_INVALID");
  if (!/^0x[0-9a-f]{64}$/i.test(entity)) return txErr("FINTECH_SAFETY_INVALID_ENTITY_ID");
  if (isNumberedEntity(entity)) return txErr("NUMBERED_REPLICA_REGISTRATION_EVIDENCE_MISSING");
  return chain(lazyBoardEntityId(config), (boardId): Result<Runtime, RuntimeError> => {
    if (lower(boardId) !== entity) return txErr("IMPORT_REPLICA_LAZY_BOARD_ID_MISMATCH");
    if (!/^0x[0-9a-f]{128}$/.test(entitySeed)) return txErr("IMPORT_REPLICA_ENTITY_SEED_INVALID");
    const publicKey = entityEncryptionPublicKey(entitySeed, entity);
    if (siblings.some((r) => r.state.committed["entityEncryptionPublicKey"] !== publicKey)) return txErr("IMPORT_REPLICA_ENTITY_ENCRYPTION_PUBLIC_KEY_MISMATCH");
    const retained = rt.encryptionSeeds.get(entity);
    if (retained !== undefined && retained !== entitySeed) return txErr("ENTITY_ENCRYPTION_SEED_CONFLICT");
    const finish = (r: EntityReplica, drop?: string): Runtime => ({
      ...rt, entities: mapSet(drop === undefined ? rt.entities : mapDelete(rt.entities, drop), key, r), encryptionSeeds: mapSet(rt.encryptionSeeds, entity, entitySeed),
    });
    return chain(quorumOf(config), (authority) => chain(admitQuorum(authority), (quorum): Result<Runtime, RuntimeError> => {
      const certified = siblings.reduce<EntityReplica | undefined>((best, r) => (best === undefined || r.head.height > best.head.height ? r : best), undefined);
      const sameAuthority = (from: EntityReplica): Result<void, RuntimeError> => chain(authorityRoot({ ...from.state, quorum }), (supplied) =>
        chain(authorityRoot(from.state), (held) => (supplied === held ? ok(undefined) : txErr("IMPORT_REPLICA_CONFIG_CHECKPOINT_MISMATCH"))));
      const at = (from: EntityReplica, state: EntityState, mempool: readonly EntityTx[]): OpenEntity => openEntity(memberId(quorum, signer as Address) ?? (signer as Address), state, from.head, mempool, from.accountReplicas);
      if (existing !== undefined) {
        const [oldKey, replica] = existing;
        // A certified Entity keeps its state: re-import changes validator-local routing only (og reuseExistingReplica).
        if (replica.head.height > 0n || siblings.some((r) => r.head.height > 0n)) return map(sameAuthority(replica), () => finish(replica, oldKey === key ? undefined : oldKey));
        return ok(finish(at(replica, { ...replica.state, quorum, jurisdiction: domain }, replica.mempool), oldKey === key ? undefined : oldKey));
      }
      if (certified !== undefined) return map(sameAuthority(certified), () => finish(at(certified, certified.state, [])));
      const committed: EntityCommitted = { entityEncryptionPublicKey: publicKey };
      return map(mapErr(createEntity({ id: entity as EntityId, jurisdiction: domain, threshold: config.threshold, members: (authority as Extract<Authority, { _tag: "teaching" }>).members, signerId: signer as Address, timestamp: rt.timestamp, committed }), (e): RuntimeError => e), (r) => finish(r));
    }));
  });
};
/** og applyRuntimeTx. The J watcher / J history, J submit, registration evidence, EntityProvider action, governance and J import subsystems are not in the rewrite. */
export const applyRuntimeTx = (rt: Runtime, tx: RuntimeTx, ctx: Pick<RuntimeCtx, "replay" | "local">): Result<Runtime, RuntimeError> => chain(runtimeTxAuthorized(tx, ctx), (): Result<Runtime, RuntimeError> => {
  switch (tx.type) {
    case "checkpointBarrier": return ok(rt);
    case "recordRuntimeAdapterCommand": return adapterCommand(rt, tx.data);
    case "importReplica": return importReplica(rt, tx);
    default: return err({ _tag: "runtime_tx_unsupported", code: tx.type });
  }
});

/** One applied Runtime frame: `outbox` is positional (merged input order, then each input's outputs); `jOutbox` carries the ingress J inputs. */
export type RuntimeStep = { readonly runtime: Runtime; readonly applied: RuntimeInput; readonly outbox: readonly EntityOutput[]; readonly jOutbox: readonly JInput[]; readonly rejected: readonly RuntimeError[]; readonly advanced: boolean };
/**
 * og createRuntimeInputReducer: validate shape/limits, apply every RuntimeTx in order (any failure refuses the whole frame), merge the entity inputs,
 * discard inputs whose replica is unknown (og drop policy for unroutable ingress), apply the rest, and advance the Runtime height only when the frame
 * did work (og advanceAppliedRuntimeFrame). The frame timestamp is max(previous, ingress seed) and stamps every txs input (og env.state.timestamp).
 */
export const applyRuntime = (rt: Runtime, input: RuntimeInput, ctx: RuntimeCtx): Result<RuntimeStep, RuntimeError> => chain(validateRuntimeInput(rt, input), (jOutbox) => {
  const seeds = input.entityInputs.flatMap((i) => (i.input.kind === "txs" ? [i.input.timestamp] : []));
  const timestamp = [input.timestamp ?? rt.timestamp, ...(input.timestamp === undefined ? seeds : [])].reduce((a, b) => (b > a ? b : a), rt.timestamp);
  return chain(foldResult(input.runtimeTxs, { ...rt, timestamp }, (at, tx) => applyRuntimeTx(at, tx, ctx)), (afterTxs) => chain(mergeEntityInputs(input.entityInputs), (merged) => {
    type Out = { readonly outputs: readonly EntityOutput[]; readonly rejected: readonly RuntimeError[]; readonly applied: readonly RoutedEntityInput[]; readonly committed: boolean };
    const refused = (error: RuntimeError): StoreStep<string, EntityReplica, Out> => ({ writes: [], out: { outputs: [], rejected: [error], applied: [], committed: false }, stop: false });
    const { store, outs } = foldStore(afterTxs.entities, merged, (read, routed): StoreStep<string, EntityReplica, Out> => {
      const key = replicaKey(routed.entityId, routed.signerId), r = read(key);
      if (r === undefined) return refused({ _tag: "no_such_entity", id: routed.entityId });
      const stamped: RoutedEntityInput = routed.input.kind === "txs" ? { ...routed, input: { ...routed.input, timestamp } } : routed;
      const applied = applyEntityInput(r, stamped.input, { self: routed.entityId, signerId: routed.signerId as Address, ...ctx });
      if (!applied.ok) return refused(applied.error);
      return { writes: [[key, applied.value.replica]], out: { outputs: applied.value.outputs, rejected: [], applied: [stamped], committed: applied.value.replica.head.height > r.head.height }, stop: false };
    });
    const applied = outs.flatMap((o) => o.applied), outbox = outs.flatMap((o) => o.outputs);
    const meaningful = applied.filter((i) => i.input.kind !== "txs" || i.input.txs.length > 0).length;
    const entityInputCount = outs.some((o) => o.committed) ? Math.max(meaningful, applied.length) : meaningful;
    const advanced = input.runtimeTxs.length > 0 || entityInputCount > 0 || outbox.length > 0 || jOutbox.length > 0;
    const runtime: Runtime = { ...afterTxs, entities: store, height: advanced ? afterTxs.height + 1n : afterTxs.height };
    const appliedInput: RuntimeInput = { runtimeTxs: input.runtimeTxs, entityInputs: applied, ...(jOutbox.length > 0 ? { jInputs: jOutbox } : {}) };
    return ok({ runtime, applied: appliedInput, outbox, jOutbox, rejected: outs.flatMap((o) => o.rejected), advanced });
  }));
});

// ---- og storage/hashes.ts, canonical-hash.ts, replica-meta-digest.ts, wal/outbox-payload.ts: Runtime WAL commitments ----
/** og computeIntegrityDigest(encodeBinaryPayload(value)): 0x-sha256 over the 0x03-framed canonical msgpack. */
const hashStable = (value: Binary): Result<string, BinaryError> => map(encodeBinary(value), integrity);
export type StorageFrameEntityHash = { readonly entityId: string; readonly hash: string; readonly cellCount: number };
const sortedEntityHashes = (rows: readonly StorageFrameEntityHash[]): readonly StorageFrameEntityHash[] =>
  rows.map((r) => ({ entityId: r.entityId.toLowerCase(), hash: r.hash, cellCount: r.cellCount })).sort((a, b) => asc(a.entityId, b.entityId));
/** og RuntimeFrame (storage/types.ts): the WAL row. `runtimeInput` is the applied input; optional og fields are absent when empty. */
export type StorageFrame = {
  readonly height: number; readonly timestamp: number; readonly prevFrameHash?: string | undefined; readonly frameHash?: string | undefined;
  readonly replicaMetaDigest: string; readonly postStateHash: string; readonly materializedState: boolean;
  readonly canonicalStateHash?: string | undefined; readonly canonicalEntityHashes?: readonly StorageFrameEntityHash[] | undefined;
  readonly runtimeInput: Binary; readonly runtimeOutputCount: number; readonly runtimeOutputsDigest: string;
  readonly touchedEntities: readonly string[]; readonly touchedAccounts: readonly { readonly entityId: string; readonly counterpartyId: string }[]; readonly touchedBookEntities: readonly string[];
  readonly [extra: string]: Binary | undefined;
};
const definedFields = (record: { readonly [field: string]: Binary | undefined }): { readonly [field: string]: Binary } =>
  Object.fromEntries(Object.entries(record).filter((e): e is [string, Binary] => e[1] !== undefined));
/** og computeStorageFrameHash: the frame without `frameHash`, under domain `xln.storage.frame`, canonical Entity hashes normalized and sorted. */
export const storageFrameHash = (record: StorageFrame): Result<string, BinaryError> => {
  const { frameHash: _, ...rest } = record;
  return hashStable({ kind: "xln.storage.frame", ...definedFields(rest), canonicalEntityHashes: sortedEntityHashes(record.canonicalEntityHashes ?? []) });
};
/** og computeCanonicalRuntimeStateHash: keccak of the JSON text {kind, height, timestamp, entities}. */
export const canonicalRuntimeStateHash = (height: number, timestamp: number, entities: readonly StorageFrameEntityHash[]): string =>
  `0x${keccakUtf8(JSON.stringify({ kind: "xln.storage.canonicalRuntimeHash.v2", height, timestamp, entities: sortedEntityHashes(entities) }))}`;
export type ComponentDigest = { readonly key: string; readonly valueHash: string };
/** og computeRuntimePostStateComponentDigests: one integrity hash per Runtime component, keys sorted. */
export const runtimeComponentDigests = (view: { readonly [key: string]: Binary }): Result<readonly ComponentDigest[], BinaryError> =>
  traverse(Object.keys(view).sort(asc), (key) => map(hashStable(view[key] as Binary), (valueHash) => ({ key, valueHash })));
/** og computeStoragePostStateHash: the per-frame replay oracle. */
export const storagePostStateHash = (i: { readonly height: number; readonly timestamp: number; readonly replicaMetaDigest: string; readonly runtimeComponentDigests: readonly ComponentDigest[]; readonly runtimeOutputCount: number; readonly runtimeOutputsDigest: string }): Result<string, BinaryError> =>
  hashStable({ kind: "xln.storage.postState", height: i.height, timestamp: i.timestamp, replicaMetaDigest: i.replicaMetaDigest, runtimeComponentDigests: i.runtimeComponentDigests, runtimeOutputCount: i.runtimeOutputCount, runtimeOutputsDigest: i.runtimeOutputsDigest });
/** og computeStorageReplicaMetaDigest: rows sorted by hex key then value hash; values hashed independently. */
export const replicaMetaDigest = (rows: readonly { readonly key: Uint8Array; readonly value: Uint8Array }[]): Result<string, BinaryError> =>
  hashStable({ kind: "xln.storage.replicaMeta.v1", entries: rows.map((r) => ({ key: bytesToHex(r.key).toLowerCase(), valueHash: integrity(r.value) })).sort((a, b) => asc(a.key, b.key) || asc(a.valueHash, b.valueHash)) });
const MAX_RUNTIME_OUTPUT_ROWS = 10_000;
const u32 = (n: number): Uint8Array => Uint8Array.of((n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff);
/** og computeRuntimeOutputsDigest: sha256("xln.runtime.outbox.v1" | u32 count | (u32 len | row)*), rows in `(height, index)` order. */
export const runtimeOutputsDigest = (rows: readonly Uint8Array[]): Result<string, RuntimeError> =>
  rows.length > MAX_RUNTIME_OUTPUT_ROWS ? frameErr("STORAGE_RUNTIME_OUTPUT_COUNT_MAX") : ok(bytesToHex(sha256(concat([utf8("xln.runtime.outbox.v1"), u32(rows.length), ...rows.flatMap((r) => [u32(r.byteLength), r])]))));

/** Rewrite values as og binary payload: optional fields the rewrite leaves `undefined` are absent (og builders spread them in only when set). */
const binaryOf = (v: unknown): Binary => {
  if (v === null || typeof v !== "object") return v as Binary;
  if (Array.isArray(v)) return v.map(binaryOf);
  if (v instanceof Map) return new Map([...v].map(([k, x]) => [binaryOf(k), binaryOf(x)]));
  return Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => [k, binaryOf(x)]));
};
/** og buildCertifiedEntityHeadPlan: one replica per Entity, the one with the highest certified height (first on a tie). */
const certifiedHeads = (rt: Runtime): readonly EntityReplica[] => {
  const heads = new Map<string, EntityReplica>();
  for (const r of rt.entities.values()) { const id = lower(r.state.id), held = heads.get(id); if (held === undefined || r.head.height > held.head.height) heads.set(id, r); }
  return [...heads.values()];
};
/** og computeCanonicalEntityHash: the Entity consensus state root of the certified head, one cell. */
export const canonicalEntityHashes = (rt: Runtime): Result<readonly StorageFrameEntityHash[], RuntimeError> =>
  map(traverse(certifiedHeads(rt), (r) => map(entityRootOf(r.state, r.accountReplicas), (hash) => ({ entityId: lower(r.state.id), hash, cellCount: 1 }))), sortedEntityHashes);
const KEY_LIVE_REPLICA_META = 0x26;
/** og buildStorageLiveReplicaMetaCommitment row for the fields the rewrite replica carries (no certified lineage link, leader votes or J submit state). */
const replicaMetaRows = (rt: Runtime): Result<readonly { readonly key: Uint8Array; readonly value: Uint8Array }[], RuntimeError> =>
  traverse([...rt.entities], ([key, r]) => {
    const entity = lower(r.state.id), signer = signerId(r.signerId);
    const rowKey = concat([Uint8Array.of(KEY_LIVE_REPLICA_META), hexToBytes(entity), new Uint8Array(12), hexToBytes(signer)]);
    return chain(frameNumber(r.state.height), (height) => chain(frameNumber(r.state.timestamp), (timestamp) => map(encodeBinary({
      replicaKey: key.toLowerCase(), entityId: entity, signerId: signer, isProposer: signerId(r.state.quorum.proposer) === signer,
      entityHead: { entityId: entity, height, timestamp, frameHash: r.head.height === 0n ? "" : frameWord(r.head.prevFrameHash) },
    }), (value) => ({ key: rowKey, value }))));
  });
/** The Runtime components the rewrite holds (og buildReplayVerifiableRuntimePostStateView: infrastructure + J replicas). */
const runtimeView = (rt: Runtime): { readonly [key: string]: Binary } => ({
  infrastructure: binaryOf({ runtimeAdapterCommandFrontiers: rt.adapterFrontiers, entityEncryptionSeeds: rt.encryptionSeeds }),
  jReplicas: [...rt.jurisdictions].sort(asc),
});
export type RuntimeFrameCommit = { readonly runtime: Runtime; readonly frame: StorageFrame; readonly applied: RuntimeInput; readonly outbox: readonly EntityOutput[]; readonly jOutbox: readonly JInput[]; readonly rejected: readonly RuntimeError[] };
const outputRows = (outbox: readonly EntityOutput[]): Result<readonly Uint8Array[], RuntimeError> => traverse(outbox, (o) => encodeBinary(binaryOf(o)));
const sealFrame = (rt: Runtime, step: RuntimeStep): Result<RuntimeFrameCommit, RuntimeError> => {
  const after = step.runtime;
  return chain(frameNumber(after.height), (height) => chain(frameNumber(after.timestamp), (timestamp) => chain(outputRows(step.outbox), (rows) => chain(runtimeOutputsDigest(rows), (outputsDigest) =>
    chain(replicaMetaRows(after), (metaRows) => chain(replicaMetaDigest(metaRows), (metaDigest) => chain(runtimeComponentDigests(runtimeView(after)), (components) =>
      chain(storagePostStateHash({ height, timestamp, replicaMetaDigest: metaDigest, runtimeComponentDigests: components, runtimeOutputCount: rows.length, runtimeOutputsDigest: outputsDigest }), (postStateHash) =>
        chain(canonicalEntityHashes(after), (entityHashes) => {
          const touched = [...new Set([...step.applied.entityInputs.map((i) => lower(i.entityId)), ...step.applied.runtimeTxs.flatMap((tx) => (tx.type === "importReplica" ? [lower(tx.entityId)] : []))])].sort(asc);
          const body: StorageFrame = {
            height, timestamp, prevFrameHash: rt.frameHash, replicaMetaDigest: metaDigest, postStateHash, materializedState: false,
            canonicalStateHash: canonicalRuntimeStateHash(height, timestamp, entityHashes), canonicalEntityHashes: entityHashes,
            runtimeInput: binaryOf(step.applied), runtimeOutputCount: rows.length, runtimeOutputsDigest: outputsDigest, touchedEntities: touched, touchedAccounts: [], touchedBookEntities: [],
          };
          return map(storageFrameHash(body), (frameHash) => ({ runtime: { ...after, frameHash }, frame: { ...body, frameHash }, applied: step.applied, outbox: step.outbox, jOutbox: step.jOutbox, rejected: step.rejected }));
        })))))))));
};
/**
 * og process + saveRuntimeFrame: apply one Runtime input and, when the frame advanced, seal its WAL row (prev hash chain from ZERO_FRAME_HASH,
 * canonical state hash, post-state oracle, ordered outbox digest). A frame that did no work writes no row.
 */
export const commitRuntimeFrame = (rt: Runtime, input: RuntimeInput, ctx: RuntimeCtx): Result<RuntimeFrameCommit | null, RuntimeError> =>
  chain(applyRuntime(rt, input, ctx), (step) => (step.advanced ? sealFrame(rt, step) : ok(null)));
export type RuntimeRecovery = { readonly runtime: Runtime; readonly outbox: readonly EntityOutput[] };
/**
 * og verifyStorageTailIntegrity + replay: every row continues the chain (height+1, prevFrameHash), its canonical state hash recomputes from its own
 * coordinates, and its frame hash recomputes; replaying its applied input (with replay capabilities) must reproduce the row byte-for-byte.
 * The recovered outbox is every replayed frame's ordered outputs (nothing is terminal without a receipt) and must equal the persisted rows positionally.
 */
export const recoverRuntime = (checkpoint: Runtime, frames: readonly StorageFrame[], inputs: readonly RuntimeInput[], outbox: readonly EntityOutput[], ctx: Verifiers): Result<RuntimeRecovery, RuntimeError> => {
  if (frames.length !== inputs.length) return frameErr("STORAGE_VERIFY_FRAME_INPUT_MISSING");
  type Replayed = { readonly runtime: Runtime; readonly outbox: readonly EntityOutput[] };
  return chain(foldResult(frames.map((f, i) => [f, inputs[i] as RuntimeInput] as const), { runtime: checkpoint, outbox: [] } as Replayed, ({ runtime, outbox: pending }, [frame, input]): Result<Replayed, RuntimeError> => {
    if (BigInt(frame.height) !== runtime.height + 1n) return frameErr("STORAGE_VERIFY_FRAME_HEIGHT_MISMATCH");
    if (frame.prevFrameHash !== runtime.frameHash) return frameErr("STORAGE_VERIFY_FRAME_CHAIN_BROKEN");
    if (frame.canonicalStateHash !== undefined && frame.canonicalStateHash !== canonicalRuntimeStateHash(frame.height, frame.timestamp, frame.canonicalEntityHashes ?? [])) return frameErr("STORAGE_VERIFY_CANONICAL_HASH_MISMATCH");
    const own = storageFrameHash(frame);
    if (!own.ok || own.value !== frame.frameHash) return frameErr("STORAGE_VERIFY_FRAME_HASH_MISMATCH");
    return chain(commitRuntimeFrame(runtime, { ...input, timestamp: BigInt(frame.timestamp) }, { ...ctx, replay: true }), (replayed): Result<Replayed, RuntimeError> =>
      replayed === null || replayed.frame.frameHash !== frame.frameHash ? frameErr("STORAGE_REPLAY_POST_STATE_MISMATCH") : ok({ runtime: replayed.runtime, outbox: [...pending, ...replayed.outbox] }));
  }), (done) => (canon(done.outbox) !== canon(outbox) ? frameErr("STORAGE_RECOVERY_OUTBOX_MISMATCH") : ok(done)));
};


/** og entity j-batch txs (r2r / r2c / r2e / e2r queue into jBatchState; j_broadcast seals it) and the finalized J events that move reserves (entity-runtime ER-16). */
export type JOp =
  | { readonly type: "r2r"; readonly toEntity: EntityId; readonly tokenId: TokenId; readonly amount: bigint }
  | { readonly type: "r2c"; readonly counterparty: EntityId; readonly tokenId: TokenId; readonly amount: bigint; readonly receivingEntity?: EntityId | undefined }
  | { readonly type: "et2r"; readonly tokenAddress: string; readonly amount: bigint; readonly internalTokenId: TokenId }
  | { readonly type: "r2et"; readonly recipient: EntityId; readonly tokenId: TokenId; readonly amount: bigint }
  | { readonly type: "j_broadcast"; readonly chainId: number; readonly depository: string; readonly signerId: string }
  | { readonly type: "j_event"; readonly blockNumber: number; readonly event: JEvent };
/** og EntityState reserves / outDebtsByToken / inDebtsByToken / jBatchState: reserves change only through finalized J events. */
export type JState = { readonly reserves: ReadonlyMap<number, bigint>; readonly debts: DebtLedger; readonly jBatch?: JBatchState | undefined };
export type LadderTx = { readonly type: "ladder_reveal"; readonly revealer: EntityId; readonly counter: EntityId; readonly ladderHash: Hash; readonly targetRole: boolean; readonly fillRatio: number; readonly revealedAt: bigint };
export type EntityRouteTx =
  | { readonly type: "directPayment"; readonly recipient: EntityId; readonly tokenId: TokenId; readonly amount: bigint; readonly description?: string | undefined; readonly invoiceId?: string | undefined }
  | ({ readonly type: "placeSwapOffer" } & SwapOfferTerms)
  | { readonly type: "htlcPayment"; readonly route: readonly EntityId[]; readonly finalRecipient: EntityId; readonly tokenId: TokenId; readonly amount: bigint; readonly description?: string | undefined }
  | { readonly type: "prepareCrossJurisdictionSwap" }
  | { readonly type: "registerCrossJurisdictionSwap" };
export type HostInput = { readonly kind: "dispute" };
export type HostCtx = { readonly timestamp: bigint; readonly jHeight: bigint; readonly from?: EntityId | undefined };
export type HostEffect = Effect | Tagged<"start_dispute", { start: DisputeStart }> | Tagged<"send", { message: AccountPeerInput }>;
export type OutboxEntry = { readonly id: Hash; readonly effect: HostEffect };
export type HostTx =
  | { readonly layer: "account"; readonly tx: WireAccountTx } | { readonly layer: "frame"; readonly input: AccountInput } | { readonly layer: "j"; readonly tx: JOp }
  | { readonly layer: "ladder"; readonly tx: LadderTx } | { readonly layer: "entity"; readonly tx: EntityRouteTx } | { readonly layer: "input"; readonly input: HostInput } | { readonly layer: "receipt"; readonly id: Hash };
export type Host = { readonly self: EntityId; readonly account: AccountReplica; readonly j: JState; readonly ladder: ReadonlyMap<string, RatioRecord>; readonly height: bigint; readonly frameHash: RuntimeFrameHash; readonly outbox: readonly OutboxEntry[] };
export type Stamped = { readonly tx: HostTx; readonly ctx: HostCtx };
export type HostError = BodyError | Tagged<"unsigned" | "chain" | "root" | "version" | "reserve" | "status" | "recipient"> | Tagged<"candidate", { cause: AccountReplicaError }> | JBatchError | JObserveError;
export type HostStep = Step<Host, HostEffect>;
export const genesisHost = (self: EntityId, account: AccountReplica): Result<Host, AccountReplicaError> =>
  map(partyOf(replicaId(account), self), () => ({ self, account, j: { reserves: new Map(), debts: EMPTY_DEBTS }, ladder: new Map(), height: 0n, frameHash: ZERO_HASH as RuntimeFrameHash, outbox: [] }));
const jEntityOf = (j: JState, self: EntityId, peer: string): JEntity => ({ entityId: self, reserves: j.reserves, debts: j.debts, jBatch: j.jBatch, accounts: new Set([peer]) });
/** og handleR2R / handleR2C / handleR2E / handleE2R / handleJBroadcast and the Entity's reserve, debt and HankoBatchProcessed J-event handlers, for the Host's one Account. */
export const applyJ = (j: JState, op: JOp, self: EntityId, peer: string, ctx: HostCtx): Result<JState, HostError> => {
  const e = jEntityOf(j, self, peer), queued = (r: Result<JBatchState, JBatchError>): Result<JState, HostError> => map(r, (jBatch) => ({ ...j, jBatch }));
  return matchBy("type", op, {
    r2r: (x) => queued(queueR2R(e, x.toEntity, Number(x.tokenId), x.amount)),
    r2c: (x) => map(queueR2C(e, x.counterparty, Number(x.tokenId), x.amount, x.receivingEntity), (q) => (q.note === undefined ? { ...j, jBatch: q.jBatch } : j)),
    r2et: (x) => queued(queueR2E(e, x.recipient, Number(x.tokenId), x.amount)),
    et2r: (x) => queued(queueE2R(e, { contractAddress: x.tokenAddress, amount: x.amount, internalTokenId: Number(x.internalTokenId) })),
    j_broadcast: (x) => map(jBroadcast(j.jBatch, { entityId: self, chainId: x.chainId, depository: x.depository, signerId: x.signerId, timestamp: Number(ctx.timestamp) }), (b) => ({ ...j, jBatch: b.jBatch })),
    j_event: (x) => x.event.type === "HankoBatchProcessed"
      ? map(applyHankoBatchProcessed(j.jBatch, self, x.event, Number(ctx.timestamp)), (b) => ({ ...j, jBatch: b.jBatch }))
      : map(observeJBlocks({ entityId: self, reserves: j.reserves, debts: j.debts, accounts: new Map() }, [{ blockNumber: x.blockNumber, events: [x.event] }]), (o) => ({ ...j, reserves: o.observer.reserves, debts: o.observer.debts })),
  });
};
const ladderKey = (tx: LadderTx): string => `${tx.revealer}|${tx.counter}|${tx.ladderHash}|${tx.targetRole ? "t" : "s"}`;
const admitTx = (host: Host, tx: WireAccountTx, ctx: HostCtx, verify: Verify): Result<HostStep, AccountReplicaError> => map(admitAt(host.account, [tx], host.self, { timestamp: ctx.timestamp, jHeight: ctx.jHeight }, verify), (account) => step({ ...host, account }));
const accountStep = (host: Host, applied: Result<AccountApply, AccountReplicaError>): Result<HostStep, AccountReplicaError> => map(applied, (a) => {
  const send = (message: AccountMessage): HostEffect => ({ _tag: "send", message });
  return step({ ...host, account: a.replica }, a.outputs.map((o): HostEffect => matchBy("kind", o, { effect: (e) => e.effect, ack: send, ack_frame: send, start_dispute: ({ start }) => ({ _tag: "start_dispute", start }) })));
});
const routeEntity = (tx: EntityRouteTx, self: EntityId, id: AccountId): Result<AccountTx, HostError> => matchBy("type", tx, {
  directPayment: (x) => {
    const party = partyOf(id, self);
    return !party.ok || x.recipient !== party.value.peer ? err({ _tag: "recipient" }) : ok({ type: "payment", tokenId: x.tokenId, amount: x.amount });
  },
  placeSwapOffer: ({ type: _, ...offer }) => ok({ type: "swap_offer", ...offer }),
  htlcPayment: () => err({ _tag: "unchosen", hole: "onion" }), prepareCrossJurisdictionSwap: () => err({ _tag: "unchosen", hole: "cross_open" }), registerCrossJurisdictionSwap: () => err({ _tag: "unchosen", hole: "cross_open" }),
});
export const applyHost = (host: Host, tx: HostTx, ctx: HostCtx, verify: Verify): Result<HostStep, AccountReplicaError | HostError> => matchBy("layer", tx, {
  account: (i) => admitTx(host, i.tx, ctx, verify),
  frame: (i) => {
    const delivery: Delivery = ctx.from === undefined ? { _tag: "local" } : { _tag: "received", from: ctx.from }, door: DoorContext = { verify, self: host.self, now: ctx.timestamp };
    return accountStep(host, disputeUnsafe(host.account, applyDelivered(host.account, i.input, delivery, door), door));
  },
  j: (i) => chain(partyOf(replicaId(host.account), host.self), (party) => map(applyJ(host.j, i.tx, host.self, party.peer, ctx), (j) => step({ ...host, j }))),
  ladder: (i) => { const key = ladderKey(i.tx); return map(revealSlot(host.ladder.get(key), i.tx), (slot) => step({ ...host, ladder: mapSet(host.ladder, key, slot) })); },
  entity: (i) => chain(routeEntity(i.tx, host.self, replicaId(host.account)), (routed) => admitTx(host, routed, ctx, verify)),
  input: (i) => matchBy("kind", i.input, {
    dispute: () => accountStep(host, applyAccountInput(host.account, { kind: "freeze" }, { verify, self: host.self, now: ctx.timestamp })),
  }),

  receipt: (i) => ok(step({ ...host, outbox: host.outbox.filter((e) => e.id !== i.id) })),
});

export type TowerReceiptV1 = { readonly type: "tower_receipt"; readonly towerId: string; readonly lookupKey: string; readonly slot: bigint; readonly height: bigint; readonly bundleHash: Hash; readonly storedAt: bigint; readonly expiresAt: bigint; readonly towerSignature?: string | undefined };
export type AccountRecoveryBundleV1 = {
  readonly account: { readonly accountId: string; readonly jurisdictionId: string; readonly left: string; readonly right: string; readonly owner: string; readonly counterparty: string };
  readonly latestCommitted: { readonly height: bigint; readonly frameHash: Hash; readonly ownerFrameHanko: string; readonly counterpartyFrameHanko: string };
  readonly dispute: { readonly proofBodyHash: Hash; readonly nonce: bigint }; readonly bundleHash: Hash;
};
export type TowerMode = "blind_backup" | "delayed_last_resort";
export type LastResortPayload = { readonly triggerHint: string; readonly encryptedRemedy: string; readonly actionKind: "counter_dispute_only"; readonly appointmentSequence: bigint; readonly proofNonce: bigint; readonly proofBodyHash: Hash; readonly responseMode: "last_resort"; readonly lastResortWindowSeconds: bigint; readonly safetyMarginSeconds: bigint; readonly maxFeeToken?: TokenId | undefined; readonly feeBudget?: bigint | undefined };
export type TowerAppointmentV1 = { readonly type: "tower_appointment"; readonly towerMode: TowerMode; readonly lookupKey: string; readonly slot: bigint; readonly height: bigint; readonly bundleHash: Hash; readonly encryptedBundle: string; readonly ownerEntityId: string; readonly ownerHanko: string; readonly lastResortPayload?: LastResortPayload | undefined };
/** og watchtower decode `text()`: a required string is non-empty after trim. */
const whenSigned = <X>(x: X, ...hankos: readonly string[]): Result<X, HostError> => (hankos.every((h) => h.trim().length > 0) ? ok(x) : err({ _tag: "unsigned" }));
/** og decodeReceipt: `towerSignature` is optional; when present it is non-empty text. */
export const acceptReceipt = (r: TowerReceiptV1): Result<TowerReceiptV1, HostError> => whenSigned(r, r.towerId, r.lookupKey, r.bundleHash, ...(r.towerSignature === undefined ? [] : [r.towerSignature]));
export const acceptBundle = (b: AccountRecoveryBundleV1): Result<AccountRecoveryBundleV1, HostError> => whenSigned(b, b.latestCommitted.ownerFrameHanko, b.latestCommitted.counterpartyFrameHanko);
export const acceptAppointment = (a: TowerAppointmentV1): Result<TowerAppointmentV1, HostError> => whenSigned(a, a.ownerHanko);
