

import { secp256k1 } from "@noble/curves/secp256k1";
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
  resume: { preparing: ["open"] },
} as const;
export const EntityTransition = {
  txs: { open: ["open", "proposed"], proposed: ["open", "proposed"], locked: ["open", "locked"] },
  proposal: { open: ["open", "locked"], proposed: ["open", "proposed"], locked: ["open", "locked"] },
  precommit: { open: ["open"], proposed: ["open", "proposed"], locked: ["open", "locked"] },
} as const;


export const AccountTxNames = ["add_delta", "set_credit_limit", "payment", "htlc_lock", "htlc_resolve", "swap_offer", "swap_cancel_request", "swap_resolve", "settle_transition",
  "j_event_claim", "cross_pull_lock", "cross_pull_close", "deposit_to_custody", "withdraw_from_custody", "hub_custody_debit", "request_collateral", "rebalance_refund",
  "rebalance_policy", "lending_fund", "lending_borrow_request", "lending_repay", "lending_credit", "lending_close_request", "lending_close_payout"] as const;
export const LendingTxNames = ["lending_fund", "lending_borrow_request", "lending_repay", "lending_close_request"] as const;
export const EntityTxNames = ["directPayment", "placeSwapOffer", "htlcPayment", "prepareCrossJurisdictionSwap", "registerCrossJurisdictionSwap"] as const;
export const AccountInputKinds = ["dispute", "board_hanko_refresh"] as const;
export const EntityInputKinds = ["leaderTimeoutVote"] as const;
export const HoleNames = ["cross_open", "leader_timeout_vote", "reveal_before_height", "quote_last_ms", "onion", "board_hanko_refresh"] as const;
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
  bytes32: (x) => (bytes32(x.value), hexBody(x.value)),
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
} as const;
export type JEventName = keyof typeof J_EVENT_SIGNATURES;
const eventTopics = Object.fromEntries(Object.entries(J_EVENT_SIGNATURES).map(([n, s]) => [n, keccak256Hex(utf8(s))])) as Readonly<Record<JEventName, string>>;
export const jEventTopic = (n: JEventName): string => eventTopics[n];
export type TokenSettlement = { readonly tokenId: bigint; readonly leftReserve: bigint; readonly rightReserve: bigint; readonly collateral: bigint; readonly ondelta: bigint };
export type AccountSettlement = { readonly left: string; readonly right: string; readonly tokens: readonly TokenSettlement[]; readonly nonce: bigint };
export type JEventClaimBody =
  | { readonly type: "HankoBatchProcessed"; readonly entityId: string; readonly batchHash: string; readonly nonce: bigint }
  | { readonly type: "ReserveUpdated"; readonly entity: string; readonly tokenId: bigint; readonly newBalance: bigint }
  | { readonly type: "AccountSettled"; readonly settled: readonly AccountSettlement[] }
  | { readonly type: "DisputeStarted"; readonly sender: string; readonly counterentity: string; readonly nonce: bigint; readonly proposerIsLeft: boolean; readonly proofbodyHash: string; readonly watchSeed: string; readonly starterInitialArguments: string; readonly starterCounterArguments: string; readonly starterCounterProofCommitment: string; readonly disputeTimeout: bigint; readonly disputeStartTimestamp: bigint; readonly leftResponseSeconds: bigint; readonly rightResponseSeconds: bigint }
  | { readonly type: "DisputeFinalized"; readonly sender: string; readonly counterentity: string; readonly nonce: bigint; readonly finalProofbodyHash: string; readonly finalizationEvidenceHash: string };
export type ChainLog = { readonly topics: readonly string[]; readonly data: string };
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
const readOne = (log: ChainLog): JEventClaimBody | undefined => {
  const topic = log.topics[0]?.toLowerCase(), buf = hexToBytes(log.data), head = abiRoot();
  const is = (n: JEventName): boolean => topic === jEventTopic(n).toLowerCase();
  if (topic === undefined) return undefined;
  if (is("HankoBatchProcessed")) { const [entityId, batchHash] = topicsOf(log, 2, "HankoBatchProcessed"); return { type: "HankoBatchProcessed", entityId: wordHex(entityId ?? ""), batchHash: wordHex(batchHash ?? ""), nonce: wordAt(buf, 0) }; }
  if (is("ReserveUpdated")) { const [entity, token] = topicsOf(log, 2, "ReserveUpdated"); return { type: "ReserveUpdated", entity: wordHex(entity ?? ""), tokenId: BigInt(token ?? "0"), newBalance: wordAt(buf, 0) }; }
  if (is("AccountSettled")) return { type: "AccountSettled", settled: readSettled(buf) };
  if (is("DisputeStarted")) {
    const [sender, counterentity, nonce] = topicsOf(log, 3, "DisputeStarted");
    const timeout = abiWord(buf, head, 192), start = abiWord(buf, head, 224), left = abiWord(buf, head, 256), right = abiWord(buf, head, 288), SAFE = BigInt(Number.MAX_SAFE_INTEGER);
    // og j-event-payloads.ts assertRawEventSpecificFields: a positive safe-integer clock whose timeout is exactly start + both response windows.
    if (timeout <= 0n || timeout > SAFE || start <= 0n || start > SAFE || timeout < start || left > 0xffff_ffffn || right > 0xffff_ffffn || timeout !== start + left + right) throw new Error(`J_EVENT_DISPUTE_CLOCK_INVALID:${start}:${timeout}:${left}:${right}`);
    return {
      type: "DisputeStarted", sender: wordHex(sender ?? ""), counterentity: wordHex(counterentity ?? ""), nonce: BigInt(nonce ?? "0"), proposerIsLeft: abiWord(buf, head, 0) === 1n,
      proofbodyHash: wordHex(bytesToHex(abiTupleBytes(buf, head, 32))), watchSeed: wordHex(bytesToHex(abiTupleBytes(buf, head, 64))),
      starterInitialArguments: bytesToHex(abiBytes(buf, abiLengthRef(buf, head, 96))), starterCounterArguments: bytesToHex(abiBytes(buf, abiLengthRef(buf, head, 128))),
      starterCounterProofCommitment: wordHex(bytesToHex(abiTupleBytes(buf, head, 160))), disputeTimeout: abiWord(buf, head, 192), disputeStartTimestamp: abiWord(buf, head, 224),
      leftResponseSeconds: abiWord(buf, head, 256), rightResponseSeconds: abiWord(buf, head, 288),
    };
  }
  if (is("DisputeFinalized")) {
    const [sender, counterentity, nonce] = topicsOf(log, 3, "DisputeFinalized");
    return { type: "DisputeFinalized", sender: wordHex(sender ?? ""), counterentity: wordHex(counterentity ?? ""), nonce: BigInt(nonce ?? "0"), finalProofbodyHash: wordHex(bytesToHex(buf.subarray(0, 32))), finalizationEvidenceHash: wordHex(bytesToHex(buf.subarray(32, 64))) };
  }
  return undefined;
};
export const readJEvents = (logs: readonly ChainLog[]): readonly JEventClaimBody[] => logs.flatMap((l) => { const r = readOne(l); return r === undefined ? [] : [r]; });
export const readJEventVector = (inputs: { readonly logs: readonly ChainLog[] }): unknown => JSON.parse(JSON.stringify(readJEvents(inputs.logs), (_k, v: unknown) => (typeof v === "bigint" ? v.toString() : v)));
export const encodeAccountSettledData = (settled: readonly AccountSettlement[]): string => abiEncodeHex([arr(settled, (r) =>
  t([A.b32(r.left), A.b32(r.right), arr(r.tokens, (x) => t([A.uint(x.tokenId), A.uint(x.leftReserve), A.uint(x.rightReserve), A.uint(x.collateral), int512Abi(x.ondelta)])), A.uint(r.nonce)]))]);


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
export const checkCrossClose = (p: { readonly amount: bigint; readonly ratio: number; readonly proofRatio: number; readonly leg: bigint; readonly binaryHash: Hash; readonly hubAuthored: boolean }): Result<bigint, RatioError> => {
  if (!p.hubAuthored) return err({ _tag: "hub_authorship" });
  if (p.ratio !== p.proofRatio) return err({ _tag: "ratio_mismatch" });
  return chain(floorRatio(p.amount < 0n ? -p.amount : p.amount, p.ratio), (leg) => (leg !== p.leg ? err({ _tag: "leg_mismatch" }) : ok(p.leg)));
};


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
export type BodyError =
  | AccountError | RatioError | Uncommitted | ClaimError
  | Tagged<"above_custody", { have: bigint; requested: bigint }>
  | Tagged<"not_hub" | "settlement_frozen" | "settled_pair" | "settled_nonce" | "lock_id" | "htlc_expired" | "htlc_lock_capacity" | "hold_overflow" | "offdelta_range" | "duplicate" | "missing" | "not_maker" | "before_deadline" | "preimage" | "not_counterparty" | "index" | "too_many_rows">
  | Tagged<"token_id", { tokenId: string }>
  | Tagged<"settlement", { reason: string }>
  | Tagged<"swap", { reason: string }>
  | Tagged<"rebalance", { reason: string }>
  | Tagged<"lending", { reason: string }>
  | Tagged<"payment_route", { reason: string }>
  | Tagged<"unchosen", { hole: Hole }>;
/** `settlement` is the replica's settlement authority: its Hanko verifier and the dispute-proof nonce floor (max of nextProofNonce, current+1, counterparty+1). og passes both through AccountConsensusContext. */
export type SettlementCtx = { readonly verify: Verify; readonly proofNonceFloor: number };
export type FoldCtx = { readonly byLeft: boolean; readonly nowMs: bigint; readonly jHeight: bigint; readonly accountHeight: bigint; readonly settlement?: SettlementCtx | undefined };
export type HubSide = "left" | "right" | null;
export type Effect = Tagged<"forward_secret", { hashlock: string; secret: string }>;
const MAX_ROWS = 128;
export type HtlcLock = { readonly lockId: string; readonly hashlock: string; readonly timelock: bigint; readonly revealBeforeHeight: bigint; readonly amount: bigint; readonly tokenId: TokenId; readonly senderIsLeft: boolean; readonly createdHeight: bigint; readonly createdTimestamp: bigint; readonly encryptedPackage?: string | undefined };
/** og types/account.ts SwapOffer (same-jurisdiction): quantized amounts, canonical price and the maker's signed fee authority. */
export type SwapOffer = {
  readonly offerId: string; readonly giveTokenId: TokenId; readonly giveTokenDecimals: number; readonly giveAmount: bigint; readonly wantTokenId: TokenId; readonly wantTokenDecimals: number; readonly wantAmount: bigint;
  readonly maxFee: bigint; readonly minNetReceive: bigint; readonly priceTicks: bigint; readonly timeInForce?: number | undefined; readonly makerIsLeft: boolean; readonly createdHeight: number; readonly quantizedGive: bigint; readonly quantizedWant: bigint;
};
/** og AccountTx swap_offer data (same-jurisdiction). */
export type SwapOfferTerms = {
  readonly offerId: string; readonly giveTokenId: TokenId; readonly giveTokenDecimals: number; readonly giveAmount: bigint; readonly wantTokenId: TokenId; readonly wantTokenDecimals: number; readonly wantAmount: bigint;
  readonly maxFee: bigint; readonly minNetReceive: bigint; readonly priceTicks?: bigint | undefined; readonly timeInForce?: number | undefined;
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
export type CustodyDebit = { readonly tokenId: TokenId; readonly amount: bigint; readonly reason: string; readonly referenceId?: string | undefined };
export type JClaimProof = { readonly version: 1; readonly nodes: readonly [] };
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
  readonly account: AccountState; readonly terms: AccountTerms; readonly hub: HubSide; readonly custody: ReadonlyMap<TokenId, bigint>; readonly locks: ReadonlyMap<string, HtlcLock>;
  readonly offers: ReadonlyMap<string, SwapOffer>; readonly debits: readonly CustodyDebit[];
  readonly requested: ReadonlyMap<TokenId, bigint>; readonly requestFees: ReadonlyMap<TokenId, RebalanceRequestFeeState>; readonly feePolicies: ReadonlyMap<TokenId, BilateralFeePolicy>;
  readonly lendingIntents: ReadonlyMap<string, LendingIntentKind>; readonly claimRows?: readonly ClaimRow[] | undefined; readonly finalizedJHeight: bigint; readonly jNonce: number;
  readonly settlement?: SettlementWorkspace | undefined;
};
export type AccountStep<E extends Effect = Effect> = Step<AccountBody, E>;
type BodyStep<E extends Effect = never> = Result<AccountStep<E>, BodyError>;
export type AccountTx =
  | { readonly type: "add_delta"; readonly tokenId: TokenId }
  | { readonly type: "set_credit_limit"; readonly tokenId: TokenId; readonly limit: bigint }
  | { readonly type: "payment"; readonly tokenId: TokenId; readonly amount: bigint; readonly route?: readonly string[] | undefined; readonly description?: string | undefined; readonly fromEntityId?: string | undefined; readonly toEntityId?: string | undefined; readonly deliveryMode?: "direct" | "trusted" | undefined; readonly trustedGatewayEntityId?: string | undefined }
  | { readonly type: "htlc_lock"; readonly lockId: string; readonly hashlock: string; readonly timelock: bigint; readonly revealBeforeHeight: bigint; readonly amount: bigint; readonly tokenId: TokenId; readonly encryptedPackage?: string | undefined }
  | { readonly type: "htlc_resolve"; readonly lockId: string; readonly outcome: "secret"; readonly secret: string }
  | { readonly type: "htlc_resolve"; readonly lockId: string; readonly outcome: "error"; readonly reason?: string | undefined }
  | ({ readonly type: "swap_offer" } & SwapOfferTerms)
  | { readonly type: "swap_cancel_request"; readonly offerId: string }
  | ({ readonly type: "swap_resolve" } & SwapResolveTerms)
  | { readonly type: "deposit_to_custody"; readonly tokenId: TokenId; readonly amount: bigint }
  | { readonly type: "withdraw_from_custody"; readonly tokenId: TokenId; readonly amount: bigint }
  | { readonly type: "hub_custody_debit"; readonly tokenId: TokenId; readonly amount: bigint; readonly reason: string; readonly referenceId?: string | undefined }
  | { readonly type: "request_collateral"; readonly tokenId: TokenId; readonly amount: bigint; readonly feeTokenId?: TokenId | undefined; readonly feeAmount: bigint; readonly policyVersion: number }
  | { readonly type: "rebalance_refund"; readonly requestId: string; readonly requestTokenId: TokenId; readonly amount: bigint; readonly reason: RefundReason }
  | { readonly type: "rebalance_policy"; readonly tokenId: TokenId; readonly policyVersion: number; readonly baseFee: bigint; readonly liquidityFeeBps: bigint; readonly gasFee: bigint }
  | { readonly type: "lending_fund"; readonly positionId: string; readonly hubEntityId: string; readonly lenderEntityId: string; readonly tokenId: TokenId; readonly amount: bigint; readonly termId: string; readonly interestBps: number }
  | { readonly type: "lending_borrow_request"; readonly requestId: string; readonly hubEntityId: string; readonly borrowerEntityId: string; readonly tokenId: TokenId; readonly amount: bigint; readonly termId: string; readonly maxInterestBps: number }
  | { readonly type: "lending_repay"; readonly loanId: string; readonly hubEntityId: string; readonly borrowerEntityId: string; readonly tokenId: TokenId; readonly amount: bigint }
  | { readonly type: "lending_credit"; readonly action: "grant" | "revoke"; readonly loanId: string; readonly hubEntityId: string; readonly borrowerEntityId: string; readonly tokenId: TokenId; readonly creditLimit: bigint }
  | { readonly type: "lending_close_request"; readonly positionId: string; readonly hubEntityId: string; readonly lenderEntityId: string }
  | { readonly type: "lending_close_payout"; readonly positionId: string; readonly hubEntityId: string; readonly lenderEntityId: string; readonly tokenId: TokenId; readonly amount: bigint }
  | { readonly type: "cross_pull_lock" }
  | { readonly type: "cross_pull_close"; readonly orderId: string; readonly amount: bigint; readonly ratio: number; readonly proofRatio: number; readonly leg: bigint; readonly binaryHash: Hash; readonly hubAuthored: boolean }
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
type Author = "bilateral" | "hub" | "unchosen";
export type KindRow = { readonly author: Author; readonly l0: boolean; readonly repeatable: boolean; readonly effects: readonly Effect["_tag"][] };
const kind = <R extends KindRow>(author: Author, l0: boolean, repeatable: boolean, effects: readonly Effect["_tag"][] = []): R => ({ author, l0, repeatable, effects }) as R;
export const AccountKinds = {
  add_delta: kind("bilateral", true, false), set_credit_limit: kind("bilateral", true, false), payment: kind("bilateral", true, true),
  htlc_lock: kind("bilateral", false, false), htlc_resolve: kind("bilateral", false, false, ["forward_secret"]),
  swap_offer: kind("bilateral", false, false), swap_cancel_request: kind("bilateral", false, false), swap_resolve: kind("bilateral", false, false),
  settle_transition: kind("bilateral", false, false),
  deposit_to_custody: kind("bilateral", false, false), withdraw_from_custody: kind("bilateral", false, false), hub_custody_debit: kind("hub", false, false),
  request_collateral: kind("bilateral", false, false), rebalance_refund: kind("bilateral", false, false), rebalance_policy: kind("bilateral", false, false),
  lending_fund: kind("bilateral", false, false), lending_borrow_request: kind("bilateral", false, false), lending_repay: kind("bilateral", false, false), lending_credit: kind("bilateral", false, false),
  lending_close_request: kind("bilateral", false, false), lending_close_payout: kind("bilateral", false, false),
  cross_pull_lock: kind("unchosen", false, false), cross_pull_close: kind("unchosen", false, false),
  j_event_claim: kind("bilateral", false, false),
} as const satisfies Kinds<AccountTx["type"], KindRow>;
export type L0Tx = TxOf<"add_delta" | "set_credit_limit" | "payment">;
export type EffectOf<K extends AccountTx["type"]> = K extends "htlc_resolve" ? Of<Effect, "forward_secret"> : never;
export const isL0Tx = (tx: WireAccountTx): tx is L0Tx => arm(AccountKinds, tx.type).l0;
export const genesisAccountBody = (account: AccountState, terms: AccountTerms, hub: HubSide = null): AccountBody => ({ account, terms, hub, custody: new Map(), locks: new Map(), offers: new Map(), requested: new Map(), requestFees: new Map(), feePolicies: new Map(), lendingIntents: new Map(), debits: [], finalizedJHeight: 0n, jNonce: 0 });
const putState = (a: AccountBody, account: AccountState): AccountBody => ({ ...a, account });
const authorized = (tx: WireAccountTx, hub: HubSide, byLeft: boolean): Result<void, BodyError> =>
  arm(AccountKinds, tx.type).author !== "hub" || (hub !== null && byLeft === (hub === "left")) ? ok(undefined) : err({ _tag: "not_hub" });
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
const shifted = (a: AccountBody, tk: TokenId, by: bigint): AccountBody => putState(a, setDelta(a.account, shift(getDelta(a.account, tk), by)));
const custodyOf = (a: AccountBody, tk: TokenId): bigint => a.custody.get(tk) ?? 0n;
const fromCustody = (a: AccountBody, tk: TokenId, amount: bigint): Result<void, BodyError> => {
  const have = custodyOf(a, tk);
  return chain(positive(amount), () => guard(amount <= have, { _tag: "above_custody", have, requested: amount }));
};
const MISSING: Result<never, BodyError> = err({ _tag: "missing" });
const sameAccount = (row: AccountSettlement, id: AccountId): boolean => row.left === id.left && row.right === id.right;
const CLAIM_UINT64 = (1n << 64n) - 1n;
const claimHeight = (h: bigint): Result<bigint, ClaimError> => (h >= 1n && h <= CLAIM_UINT64 && h <= BigInt(Number.MAX_SAFE_INTEGER) ? ok(h) : err({ _tag: "claim_height" }));
const claimBlock = (h: string): Result<string, ClaimError> => (WORD.test(h) ? ok(h.toLowerCase()) : err({ _tag: "claim_block" }));
type SettledEvent = { readonly type: "AccountSettled"; readonly data: { readonly leftEntity: string; readonly rightEntity: string; readonly tokenId: number; readonly leftReserve: string; readonly rightReserve: string; readonly collateral: string; readonly ondelta: string; readonly nonce: number } };
const settledEvent = (row: AccountSettlement, token: TokenSettlement): Result<{ readonly key: string; readonly event: SettledEvent }, ClaimError> => {
  if (row.nonce < 0n || row.nonce > BigInt(Number.MAX_SAFE_INTEGER)) return err({ _tag: "claim_events" });
  const data = { leftEntity: row.left.toLowerCase(), rightEntity: row.right.toLowerCase(), tokenId: Number(token.tokenId), leftReserve: token.leftReserve.toString(), rightReserve: token.rightReserve.toString(), collateral: token.collateral.toString(), ondelta: token.ondelta.toString(), nonce: Number(row.nonce) };
  const key = JSON.stringify([null, null, null, null, null, ["AccountSettled", data.leftEntity, data.rightEntity, data.tokenId, data.leftReserve, data.rightReserve, data.collateral, data.ondelta, data.nonce].join(":")]);
  return ok({ key, event: { type: "AccountSettled", data } });
};
const claimEvidence = (events: readonly AccountSettlement[]): Result<{ readonly eventsHash: string; readonly events: readonly SettledEvent[] }, ClaimError> => {
  const rows = events.flatMap((row) => row.tokens.map((token) => ({ row, token })));
  if (rows.length === 0) return err({ _tag: "claim_events" });
  return chain(traverse(rows, ({ row, token }) => settledEvent(row, token)), (built) => {
    const sorted = sortedBy(built, (s) => s.key);
    return sorted.some((s, i) => i > 0 && s.key === sorted[i - 1]?.key) ? err({ _tag: "claim_events" }) : ok({ eventsHash: keccak256Hex(utf8(JSON.stringify(sorted.map((s) => s.key)))), events: sorted.map((s) => s.event) });
  });
};
const claimFrame = (tx: TxOf<"j_event_claim">): Result<{ readonly version: "xln:account-j-event-claim-frame:v1"; readonly jHeight: number; readonly jBlockHash: string; readonly eventsHash: string; readonly events: readonly SettledEvent[] }, ClaimError> =>
  chain(claimHeight(tx.jHeight), (jHeight) => chain(claimBlock(tx.jBlockHash), (jBlockHash) => map(claimEvidence(tx.events), ({ eventsHash, events }) => ({ version: "xln:account-j-event-claim-frame:v1", jHeight: Number(jHeight), jBlockHash, eventsHash, events }))));
const claimRowOf = (tx: TxOf<"j_event_claim">, onLeft: boolean): Result<ClaimRow, ClaimError> =>
  chain(claimHeight(tx.jHeight), (jHeight) => chain(claimBlock(tx.jBlockHash), (jBlockHash) => map(claimEvidence(tx.events), ({ eventsHash }) => ({ onLeft, jHeight, jBlockHash, eventsHash }))));
/** og types/account.ts HtlcLock as committed: numeric token/height/timestamp fields; the rewrite-only encryptedPackage is kept only when present (og commits envelopeHash of its onion instead). */
const ogLockRow = (l: HtlcLock): Record<string, unknown> => {
  const { encryptedPackage, ...rest } = l;
  return { ...rest, revealBeforeHeight: Number(l.revealBeforeHeight), tokenId: Number(l.tokenId), createdHeight: Number(l.createdHeight), createdTimestamp: Number(l.createdTimestamp), ...(encryptedPackage === undefined ? {} : { encryptedPackage }) };
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
      return ok(requested > increase ? { ...settled, requested: mapSet(settled.requested, tk, requested - increase) } : { ...settled, requested: mapDelete(settled.requested, tk), requestFees: mapDelete(settled.requestFees, tk) });
    })), (b) => map(activateWorkspace(b, jNonce), (c) => ({ ...c, jNonce }))));
};
/** og j-claim-transition.ts: conflict on either side refuses; stale prunes; the first side waits; the peer's matching record at any pending height finalizes. */
const claimJ = (a: AccountBody, tx: TxOf<"j_event_claim">, ctx: FoldCtx): BodyStep => chain(claimRowOf(tx, ctx.byLeft), (own) => {
  const held = a.claimRows ?? [], peer: ClaimRow = { ...own, onLeft: !own.onLeft };
  const member = (r: ClaimRow): ClaimRow | undefined => held.find((h) => h.onLeft === r.onLeft && h.jHeight === r.jHeight);
  const ownHeld = member(own), peerHeld = member(peer);
  if ((ownHeld !== undefined && !sameEvidence(ownHeld, own)) || (peerHeld !== undefined && !sameEvidence(peerHeld, peer))) return err({ _tag: "claim_conflict" });
  if (own.jHeight <= a.finalizedJHeight) return ok(step({ ...a, claimRows: pruneThrough(held, a.finalizedJHeight) }));
  if (peerHeld === undefined) return ok(step(ownHeld !== undefined ? a : { ...a, claimRows: [...held, own] }));
  return chain(claimEvidence(tx.events), ({ events }) => map(finalizeSettled(a, events), (b) => step({ ...b, claimRows: pruneThrough(held, own.jHeight), finalizedJHeight: own.jHeight })));
});
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
    if (nonce !== (w.nonceAtSign ?? floor)) return settleErr("SETTLEMENT_HANKO_NONCE_MISMATCH");
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
const swapOffer = (a: AccountBody, x: TxOf<"swap_offer">, ctx: FoldCtx): BodyStep => {
  if (x.offerId.includes(":")) return swapErr("SWAP_OFFER_ID_COLON");
  if (a.offers.has(x.offerId)) return err({ _tag: "duplicate" });
  if (a.offers.size >= MAX_ACCOUNT_SWAP_OFFERS) return swapErr("SWAP_OFFER_LIMIT");
  if (a.offers.size >= MAX_ACCOUNT_SAME_J_SWAP_OFFERS) return swapErr("SWAP_SAME_J_OFFER_LIMIT");
  if (!decimalsOk(x.giveTokenDecimals) || !decimalsOk(x.wantTokenDecimals)) return swapErr("SWAP_TOKEN_DECIMALS_INVALID");
  if (x.giveAmount < 1n || x.giveAmount > MAX_PAYMENT_AMOUNT || x.wantAmount < 1n || x.wantAmount > MAX_PAYMENT_AMOUNT) return swapErr("SWAP_OFFER_AMOUNT_INVALID");
  if (x.maxFee >= x.wantAmount || x.minNetReceive <= 0n) return swapErr("SWAP_NET_AUTH_INITIAL_TERMS_INVALID");
  const initial = netAuthError(x, 0n, 0n, 0n, false);
  if (initial !== undefined) return swapErr(initial);
  if (x.giveTokenId === x.wantTokenId) return swapErr("SWAP_SAME_TOKEN");
  if (x.timeInForce !== undefined && ![0, 1, 2].includes(x.timeInForce)) return swapErr("SWAP_TIME_IN_FORCE_INVALID");
  const makerIsLeft = ctx.byLeft;
  let market = 0;
  for (const o of a.offers.values()) if (o.makerIsLeft === makerIsLeft && o.giveTokenId === x.giveTokenId && o.wantTokenId === x.wantTokenId) market++;
  if (market >= MAX_SWAP_OFFERS_PER_SIDE_PER_MARKET) return swapErr("SWAP_MARKET_OFFER_LIMIT");
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
const swapResolve = (a: AccountBody, x: TxOf<"swap_resolve">, ctx: FoldCtx): BodyStep => {
  const offer = a.offers.get(x.offerId);
  if (offer === undefined) return MISSING;
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
    return chain(representable(a, giveRow), () => chain(representable(a, wantRow), (): BodyStep => {
      const moved = putState(closed, setDelta(setDelta(a.account, giveRow), wantRow));
      if (x.cancelRemainder || x.fillRatio === 0 || canonical === MAX_FILL) return ok(step(moved));
      const d = swapDims(offer), remaining = d.side === 1 ? qG - fG : qW - fW, next = requantizeRemaining(d, remaining, offer.priceTicks);
      if (next === undefined) return ok(step(moved));
      if (qG - fG - next.give < 0n) return swapErr("SWAP_REMAINDER_EXCEEDS_HOLD");
      return map(requantizeAuth(offer, next.give, next.want), (na) => step({ ...moved, offers: mapSet(moved.offers, offer.offerId, { ...offer, giveAmount: next.give, wantAmount: next.want, maxFee: na.maxFee, minNetReceive: na.minNetReceive, quantizedGive: next.give, quantizedWant: next.want }) }));
    }));
  });
};
// ---- rebalance: og handlers/rebalance/{request-collateral,refund,policy}.ts ----
const rebalanceErr = (reason: string): Result<never, BodyError> => err({ _tag: "rebalance", reason });
/** og request-collateral.ts: the requester prepays the fee now; one immutable request per token until finality or full refund. */
const requestCollateral = (a: AccountBody, x: TxOf<"request_collateral">, ctx: FoldCtx): BodyStep => {
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
  return map(spend(a, feeToken, x.feeAmount, ctx.byLeft), (paid) => step({
    ...paid, requested: mapSet(paid.requested, x.tokenId, amount),
    requestFees: mapSet(paid.requestFees, x.tokenId, { requestId: `rebalance:${ctx.byLeft ? "left" : "right"}:${Number(x.tokenId)}:${ctx.accountHeight}`, feeTokenId: Number(feeToken), feePaidUpfront: x.feeAmount, requestedAmount: amount, policyVersion: x.policyVersion, requestedAt: Number(ctx.nowMs), requestedByLeft: ctx.byLeft }),
  }));
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
    return step(next === fees.feePaidUpfront
      ? { ...paid, requested: mapDelete(paid.requested, x.requestTokenId), requestFees: mapDelete(paid.requestFees, x.requestTokenId) }
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
type Arms = { readonly [K in AccountTx["type"]]: (tx: WireTxOf<K>) => BodyStep<EffectOf<K>> };
const applyArm = (a: AccountBody, tx: WireAccountTx, ctx: FoldCtx): BodyStep<Effect> => matchBy<"type", WireAccountTx, BodyStep<Effect>>("type", tx, {

  add_delta: (x) => ok(step(a.account.deltas.has(x.tokenId) ? a : putState(a, setDelta(a.account, zeroDelta(x.tokenId))))),
  set_credit_limit: (x) => map(updateDelta(a.account, x.tokenId, (d) => setCreditLimit(d, x.limit, ctx.byLeft)), (s) => step(putState(a, s))),
  payment: (x) => chain(paymentRoute(a, x, ctx.byLeft), () => map(spend(a, x.tokenId, x.amount, ctx.byLeft), (b) => step(b))),
  htlc_lock: (x) => {
    // og handlers/htlc/lock.ts:32-52,71-81,95-116 in order: identity, expiry, amount, 32-lock cap, capacity, int512 range, uint256 hold.
    if (x.lockId !== x.hashlock) return err({ _tag: "lock_id" });
    if (a.locks.has(x.lockId)) return err({ _tag: "duplicate" });
    if (ctx.nowMs >= x.timelock || x.revealBeforeHeight <= ctx.jHeight) return err({ _tag: "htlc_expired" });
    if (x.amount < 1n || x.amount > MAX_PAYMENT_AMOUNT) return err({ _tag: "non_positive_payment" });
    if (a.locks.size >= MAX_ACCOUNT_HTLC_LOCKS) return err({ _tag: "htlc_lock_capacity" });
    const totals = sideTotals(a, x.tokenId), held = ctx.byLeft ? totals.leftHold : totals.rightHold;
    return chain(ensureRoom(a, x.tokenId, x.amount, ctx.byLeft), () => chain(representable(a, getDelta(a.account, x.tokenId), { senderIsLeft: ctx.byLeft, amount: x.amount }), () =>
      held + x.amount > MAX_PAYMENT_AMOUNT ? err({ _tag: "hold_overflow" }) : ok(step({ ...a, locks: mapSet(a.locks, x.lockId, {
        lockId: x.lockId, hashlock: x.hashlock, timelock: x.timelock, revealBeforeHeight: x.revealBeforeHeight, amount: x.amount, tokenId: x.tokenId,
        senderIsLeft: ctx.byLeft, createdHeight: floor0(ctx.accountHeight - 1n), createdTimestamp: ctx.nowMs, encryptedPackage: x.encryptedPackage,
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
      return x.reason === "timeout" && !expired ? err({ _tag: "before_deadline" }) : ok(step({ ...a, locks: mapDelete(a.locks, x.lockId) }));
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
    return offer === undefined ? MISSING : ctx.byLeft !== offer.makerIsLeft ? err({ _tag: "not_maker" }) : ok(step(a));
  },
  swap_resolve: (x) => swapResolve(a, x, ctx),
  deposit_to_custody: (x) => map(spend(a, x.tokenId, x.amount, ctx.byLeft), (b) => step({ ...b, custody: bump(b.custody, x.tokenId, x.amount) })),
  withdraw_from_custody: (x) => chain(fromCustody(a, x.tokenId, x.amount), () => map(offdeltaChange(ctx.byLeft, x.amount), (by) => step({ ...shifted(a, x.tokenId, -by), custody: bump(a.custody, x.tokenId, -x.amount) }))),
  hub_custody_debit: (x) => map(fromCustody(a, x.tokenId, x.amount), () => step({ ...a, custody: bump(a.custody, x.tokenId, -x.amount), debits: [...a.debits, { tokenId: x.tokenId, amount: x.amount, reason: x.reason, referenceId: x.referenceId }] })),
  request_collateral: (x) => requestCollateral(a, x, ctx),
  rebalance_refund: (x) => rebalanceRefund(a, x, ctx),
  rebalance_policy: (x) => rebalancePolicy(a, x, ctx),
  lending_fund: (x) => lending(a, x, ctx), lending_borrow_request: (x) => lending(a, x, ctx), lending_repay: (x) => lending(a, x, ctx),
  lending_credit: (x) => lending(a, x, ctx), lending_close_request: (x) => lending(a, x, ctx), lending_close_payout: (x) => lending(a, x, ctx),
  cross_pull_lock: () => err({ _tag: "unchosen", hole: "cross_open" }),
  cross_pull_close: () => err({ _tag: "unchosen", hole: "cross_open" }),
  j_event_claim: (x) => claimJ(a, x, ctx),
  settle_transition: (x) => settleTransition(a, x, ctx),
} satisfies Arms);
const one = (x: { readonly tokenId: TokenId }): readonly string[] => [x.tokenId], none = (): readonly string[] => [];
const namedTokens = (tx: WireAccountTx): readonly string[] => matchBy("type", tx, {
  add_delta: one, set_credit_limit: one, payment: one, htlc_lock: one, htlc_resolve: none, swap_offer: (x) => [x.giveTokenId, x.wantTokenId], swap_cancel_request: none, swap_resolve: (x) => (x.feeTokenId === undefined ? [] : [x.feeTokenId]),
  deposit_to_custody: one, withdraw_from_custody: one, hub_custody_debit: one, request_collateral: (x) => (x.feeTokenId === undefined ? [x.tokenId] : [x.tokenId, x.feeTokenId]), rebalance_refund: (x) => [x.requestTokenId], rebalance_policy: one,
  lending_fund: one, lending_borrow_request: one, lending_repay: one, lending_credit: one, lending_close_request: none, lending_close_payout: one,
  cross_pull_lock: none, cross_pull_close: none, j_event_claim: (x) => x.events.flatMap((row) => row.tokens.map((tk) => tk.tokenId.toString())), settle_transition: none,
});
const commits = (before: AccountBody, tx: WireAccountTx, next: AccountStep): BodyStep<Effect> =>
  chain(mapErr(prepareStep(before, next.state), uncommitted), () => map(mapErr(isL0Tx(tx) ? ok(undefined) : txRefusal(wireOf(tx)), uncommitted), () => next));
export const applyAccountBody: Layer<AccountBody, WireAccountTx, FoldCtx, Effect, BodyError> = (a, tx, ctx) => {
  const frozen = settlementFreeze(a, tx);
  if (!frozen.ok) return frozen;
  const unfit = namedTokens(tx).find((n) => !tokenId(n).ok);
  if (unfit !== undefined) return err({ _tag: "token_id", tokenId: unfit });
  return chain(authorized(tx, a.hub, ctx.byLeft), () => chain(applyArm(a, tx, ctx), (next) => (next.state.account.deltas.size > MAX_ROWS ? err({ _tag: "too_many_rows" }) : commits(a, tx, next))));
};
export const accountSnapshot = (a: AccountBody): Required<Omit<AccountBody, "account">> & { readonly state: Hash } =>
  ({ state: hashAccountState(a.account), terms: a.terms, hub: a.hub, custody: a.custody, locks: a.locks, offers: a.offers, requested: a.requested, requestFees: a.requestFees, feePolicies: a.feePolicies, lendingIntents: a.lendingIntents, debits: a.debits, claimRows: a.claimRows, jNonce: a.jNonce, settlement: a.settlement, finalizedJHeight: a.finalizedJHeight });


export type ViewError = CommitmentError | Tagged<"token_id", { tokenId: TokenId }> | ClaimError;
export type UncommittedReason = ViewError | FrameHashError | Tagged<"unsafe_number">;
export type Uncommitted = Tagged<"uncommitted", { reason: UncommittedReason }>;
export const uncommitted = (reason: UncommittedReason): Uncommitted => ({ _tag: "uncommitted", reason });
export const tokenNumber = (id: TokenId): Result<number, ViewError> => (tokenId(id).ok ? ok(Number(id)) : err({ _tag: "token_id", tokenId: id }));
export const tokenOrder = (b: AccountBody): readonly TokenId[] => [...b.account.deltas.keys()].sort((x, y) => Number(x) - Number(y));
const EMPTY_J_CLAIMS: JClaimAccumulator = { version: 1, root: EMPTY_J_ROOT, count: 0n };
const CLAIM_ACCOUNT = keccak256Hex(utf8("xln.account-j-claim.account.v1")), CLAIM_KEY = keccak256Hex(utf8("xln.account-j-claim.key.v1")), CLAIM_RECORD = keccak256Hex(utf8("xln.account-j-claim.record.v1")), CLAIM_LEAF = keccak256Hex(utf8("xln.account-j-claim.leaf.v1")), CLAIM_BRANCH = keccak256Hex(utf8("xln.account-j-claim.branch.v1"));
type ClaimNode = Tagged<"leaf", { key: string; record: string }> | Tagged<"branch", { bit: number; left: ClaimNode; right: ClaimNode }>;
const claimBit = (key: string, index: number): 0 | 1 => ((Number.parseInt(key.slice(2 + (index >> 3) * 2, 4 + (index >> 3) * 2), 16) >> (7 - (index & 7))) & 1) === 0 ? 0 : 1;
const claimAccountKey = (domain: Domain, left: string, right: string): string => keccak256Hex(abiEncode([A.b32(CLAIM_ACCOUNT), A.uint(BigInt(domain.chainId)), A.address(domain.depositoryAddress), A.b32(left), A.b32(right)]));
const claimLeaf = (accountKey: string, row: ClaimRow): { readonly key: string; readonly record: string } => {
  const side = row.onLeft ? 0n : 1n;
  return { key: keccak256Hex(abiEncode([A.b32(CLAIM_KEY), A.b32(accountKey), A.uint(side), A.uint(row.jHeight)])), record: keccak256Hex(abiEncode([A.b32(CLAIM_RECORD), A.b32(accountKey), A.uint(side), A.uint(row.jHeight), A.b32(row.jBlockHash), A.b32(row.eventsHash)])) };
};
const claimNodeHash = (node: ClaimNode): string => match(node, {
  leaf: ({ key, record }) => keccak256Hex(abiEncode([A.b32(CLAIM_LEAF), A.uint(1n), A.b32(key), A.b32(record)])),
  branch: ({ bit, left, right }) => keccak256Hex(abiEncode([A.b32(CLAIM_BRANCH), A.uint(1n), A.uint(BigInt(bit)), A.b32(claimNodeHash(left)), A.b32(claimNodeHash(right))])),
});
const claimTerminal = (node: ClaimNode, key: string): Of<ClaimNode, "leaf"> => match(node, { leaf: (leaf) => leaf, branch: (b) => claimTerminal(claimBit(key, b.bit) === 0 ? b.left : b.right, key) });
const claimPlace = (diff: number, key: string, leaf: Of<ClaimNode, "leaf">, other: ClaimNode): ClaimNode => {
  const fresh: ClaimNode = { _tag: "leaf", key: leaf.key, record: leaf.record };
  return { _tag: "branch", bit: diff, left: claimBit(key, diff) === 0 ? fresh : other, right: claimBit(key, diff) === 1 ? fresh : other };
};
const claimInsertAt = (node: ClaimNode, key: string, leaf: Of<ClaimNode, "leaf">, diff: number): ClaimNode => match(node, {
  leaf: () => claimPlace(diff, key, leaf, node),
  branch: (b) => (b.bit >= diff ? claimPlace(diff, key, leaf, node) : { ...b, ...(claimBit(key, b.bit) === 0 ? { left: claimInsertAt(b.left, key, leaf, diff) } : { right: claimInsertAt(b.right, key, leaf, diff) }) }),
});
const insertClaim = (node: ClaimNode, leaf: { readonly key: string; readonly record: string }): Result<ClaimNode, ClaimError> => {
  const term = claimTerminal(node, leaf.key);
  if (term.key === leaf.key) return term.record === leaf.record ? ok(node) : err({ _tag: "claim_conflict" });
  let diff = -1;
  for (let i = 0; i < 256; i++) if (claimBit(leaf.key, i) !== claimBit(term.key, i)) { diff = i; break; }
  return diff < 0 ? err({ _tag: "claim_conflict" }) : ok(claimInsertAt(node, leaf.key, { _tag: "leaf", key: leaf.key, record: leaf.record }, diff));
};
const claimAccumulator = (accountKey: string, rows: readonly ClaimRow[]): Result<JClaimAccumulator, ClaimError> => map(foldResult<ClaimNode | undefined, ClaimRow, ClaimError>(rows, undefined, (node, row) => {
  const leaf = claimLeaf(accountKey, row);
  return node === undefined ? ok({ _tag: "leaf", key: leaf.key, record: leaf.record }) : insertClaim(node, leaf);
}), (node) => (node === undefined ? EMPTY_J_CLAIMS : { version: 1, root: claimNodeHash(node), count: BigInt(rows.length) }));
const pendingOn = (b: AccountBody, onLeft: boolean): Result<JClaimAccumulator, ViewError> => {
  const rows = (b.claimRows ?? []).filter((r) => r.onLeft === onLeft);
  if (rows.length === 0) return ok(EMPTY_J_CLAIMS);
  const { left, right } = b.account.id;
  if (!WORD.test(left) || !WORD.test(right)) return err({ _tag: "claim_entity" });
  return chain(domainOf(b.terms.domain), (domain) => claimAccumulator(claimAccountKey(domain, left.toLowerCase(), right.toLowerCase()), rows));
};
export type SideTotals = { readonly leftHold: bigint; readonly rightHold: bigint; readonly leftAllowance: bigint; readonly rightAllowance: bigint };
const NO_TOTALS: SideTotals = { leftHold: 0n, rightHold: 0n, leftAllowance: 0n, rightAllowance: 0n };
const totalsOn = (b: AccountBody, counted: (id: TokenId) => boolean): ReadonlyMap<TokenId, SideTotals> => {
  const totals = new Map<TokenId, { -readonly [K in keyof SideTotals]: bigint }>();
  const on = (id: TokenId) => { const held = totals.get(id); if (held !== undefined) return held; const fresh = { ...NO_TOTALS }; totals.set(id, fresh); return fresh; };
  const holdOn = (id: TokenId, onLeft: boolean, n: bigint): void => { const s = on(id); if (onLeft) s.leftHold += n; else s.rightHold += n; };
  for (const l of b.locks.values()) if (counted(l.tokenId)) holdOn(l.tokenId, l.senderIsLeft, l.amount);
  for (const o of b.offers.values()) if (counted(o.giveTokenId)) holdOn(o.giveTokenId, o.makerIsLeft, o.giveAmount);
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
    // og lendingIntents first; the rewrite-only custody/debit/hub rows share this committed map (EXTRA, see findings AT-22).
    const { terms } = b, hubRows = new Map<string, unknown>(b.lendingIntents);
    for (const [tk, amount] of b.custody) hubRows.set(`custody:${tk}`, amount);
    b.debits.forEach((debit, i) => hubRows.set(`debit:${i}`, debit));
    if (b.hub !== null) hubRows.set("hub", b.hub);
    return ok({
      domain: terms.domain, leftEntity: b.account.id.left, rightEntity: b.account.id.right, watchSeed: terms.watchSeed, disputeConfig: terms.disputeConfig,
      jNonce: b.jNonce, lastFinalizedJHeight: Number(height), leftPendingJClaims: left, rightPendingJClaims: right,
      deltas: committedDeltas(b), locks: new Map([...b.locks].map(([id, l]) => [id, ogLockRow(l)])), pulls: new Map(), swapOffers: new Map([...b.offers].map(([id, o]) => [id, { ...o, giveTokenId: Number(o.giveTokenId), wantTokenId: Number(o.wantTokenId) }])), subcontracts: new Map(), lendingIntents: hubRows,
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
export type DisputePlan = Tagged<"sign", { draft: DisputeDraft }> | Tagged<"resend", { disputeHanko: DisputeHanko }> | Tagged<"none">;
export type DisputeReason = "hanko_missing" | "shape" | "hash_mismatch" | "hanko_invalid" | "unexpected" | "nonce_finalized" | "nonce_regression" | "nonce_reuse" | "body_mismatch" | "required" | "draft_mismatch";
export type DisputeError = Tagged<"dispute_hanko", { reason: DisputeReason }> | Tagged<"dispute_proof", { error: ProofError | ViewError }>;
const refuseDispute = (reason: DisputeReason): DisputeError => ({ _tag: "dispute_hanko", reason });
const asProof = <X>(r: Result<X, ProofError | ViewError>): Result<X, DisputeError> => mapErr(r, (error): DisputeError => ({ _tag: "dispute_proof", error }));
export type Verify = (digest: string, hanko: string, entity: EntityId) => boolean;
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
export const validateCounterparty = (body: AccountBody, given: DisputeHanko, from: EntityId, verify: Verify): Result<DisputeHanko, DisputeError> => {
  if (given.hanko.length === 0) return err(refuseDispute("hanko_missing"));
  const shaped = WORD.test(given.hash) && WORD.test(given.proofBodyHash) && Number.isSafeInteger(given.proofNonce) && given.proofNonce >= 0 && typeof given.proposerIsLeft === "boolean";
  if (!shaped) return err(refuseDispute("shape"));
  return chain(asProof(committedView(body)), (view) => chain(asProof(accountDisputeHash(view, given.proofBodyHash, given.proofNonce, given.proposerIsLeft)), (expected) =>
    !sameHex(given.hash, expected) ? err(refuseDispute("hash_mismatch")) : !verify(expected, given.hanko, from) ? err(refuseDispute("hanko_invalid")) : ok({ ...given, hash: expected })));
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
// Empty proofs only. A second claim needs the branch witness; that frame is refused.
const stampClaims = (txs: readonly WireAccountTx[], rows: readonly ClaimRow[] | undefined): Result<readonly WireAccountTx[], ClaimError> => {
  const claims = txs.filter((tx) => tx.type === "j_event_claim");
  if (claims.length === 0) return ok(txs);
  if (claims.length > 1 || (rows?.length ?? 0) > 0) return err({ _tag: "claim_proof" });
  return ok(txs.map((tx) => (tx.type === "j_event_claim" ? { ...tx, leftProof: EMPTY_CLAIM_PROOF, rightProof: EMPTY_CLAIM_PROOF } : tx)));
};
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
export const foldCtx = (at: FoldAt, byLeft: boolean): FoldCtx => ({ byLeft, nowMs: at.timestamp, jHeight: at.jHeight, accountHeight: at.height });
export type FrameFold = Step<AccountBody, Effect>;
export const foldAccountTxs = strictFold(applyAccountBody);
export const foldFrame = (s: AccountBody, f: AccountFrame, byLeft: boolean): Result<FrameFold, BodyError> => foldAccountTxs(s, f.txs, foldCtx(f, byLeft));
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
  | ({ readonly kind: "propose"; readonly frameHanko?: Hanko | undefined; readonly disputeHanko?: DisputeHanko | undefined } & FrameClock)
  | { readonly kind: "freeze"; readonly evidence?: FrameEvidence | undefined }
  | { readonly kind: "resume" }
  | ({ readonly kind: "ack" } & AccountAck & AccountEnvelope)
  | ({ readonly kind: "ack_frame"; readonly ack: AccountAck | null; readonly frame: AccountFrame; readonly frameHanko: Hanko; readonly disputeHanko?: DisputeHanko | undefined } & AccountEnvelope)
  /** og `kind: 'dispute'`: a standalone peer dispute-Hanko witness, sequenced by its proof nonce rather than a frame height. */
  | ({ readonly kind: "dispute"; readonly disputeHanko: DisputeHanko } & AccountEnvelope);
export type AccountMessage = Extract<AccountInput, { readonly kind: "ack" | "ack_frame" }>;
/** Every peer-originated input (og routes `dispute` through the same Entity accountInput lane). */
export type AccountPeerInput = Extract<AccountInput, { readonly kind: "ack" | "ack_frame" | "dispute" }>;
export type AccountOutput = AccountMessage | { readonly kind: "effect"; readonly effect: Effect } | { readonly kind: "start_dispute"; readonly start: DisputeStart };
export type AccountPhase = "open" | "proposed" | "received" | "preparing" | "disputed";
export type AccountEvent = AccountInput["kind"];
/** A frame under consideration: its hanko, its local proof and the fold it makes. */
export class Candidate {
  protected declare readonly established: true;
  constructor(readonly frame: AccountFrame, readonly frameHanko: Hanko, readonly frameProof: LocalProof, readonly draft: FrameFold) {}
}
type AccountEnv = { readonly state: AccountBody; readonly head: AccountHead; readonly mempool: readonly WireAccountTx[]; readonly acknowledged?: AccountAck | undefined; readonly dispute: DisputeWitnesses };
type Held = AccountEnv & { readonly candidate: Candidate };
type Frozen = Omit<AccountEnv, "mempool"> & { readonly evidence?: FrameEvidence | undefined };
export interface OpenAccount extends Tagged<"open", AccountEnv> {}
export interface ProposedAccount extends Tagged<"proposed", Held> {}
export interface ReceivedAccount extends Tagged<"received", Held & { disputeHanko: DisputeHanko | undefined }> {}
/** og `dispute_preparing` keeps deferred J claims and dispute evidence queued (dispute/policy.ts); `disputed` keeps nothing. */
export interface PreparingAccount extends Tagged<"preparing", Frozen & { mempool: readonly WireAccountTx[]; unready: StartRefusal }> {}
export interface DisputedAccount extends Tagged<"disputed", Frozen & { mempool: readonly []; start: DisputeStart }> {}
export type FrozenAccount = PreparingAccount | DisputedAccount;
export type AccountReplica = OpenAccount | ProposedAccount | ReceivedAccount | FrozenAccount;
export const certifies = (verify: Verify, digest: string, hanko: Hanko, entity: EntityId): Result<void, Tagged<"invalid_hanko", { entity: EntityId }>> => guard(verify(digest, hanko, entity), { _tag: "invalid_hanko", entity });
/** `finalizedJHeight`: the owning Entity's finalized J height (og securityContext); defaults to the Account's own. */
export type DoorContext = { readonly verify: Verify; readonly self: EntityId; readonly now: bigint; readonly finalizedJHeight?: bigint | undefined };
export type AccountContext = { readonly verify: Verify; readonly party: Party };
export type AckContext = AccountContext & { readonly delivery: Delivery };
export type ReceivedContext = AccountContext & { readonly from: EntityId };
export type InboundAccountContext = ReceivedContext & { readonly now: bigint; readonly finalizedJHeight: bigint };
export type CtxFor<I extends AccountInput> = I extends { kind: "ack_frame" } ? InboundAccountContext : I extends { kind: "ack" } ? AckContext : I extends { kind: "dispute" } ? ReceivedContext : AccountContext;
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
  | Tagged<"already_proposed" | "empty_mempool" | "not_proposed" | "height_mismatch" | "hash_mismatch" | "frame_hash_mismatch" | "state_root_mismatch" | "ack_unmatched" | "not_preparing">
  | Tagged<"frame_structure", { field: "timestamp" | "jHeight" | "txs" | "accountStateRoot" | "future_timestamp" }> | DeadlineViolation["error"]
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

/** `deferred`: refused txs that stay queued for retry (og proposal/transactions.ts `retry`); every other refused tx leaves the mempool. */
export type Preview = { readonly frame: AccountFrame; readonly draft: FrameFold; readonly frameProof: LocalProof; readonly dispute: DisputePlan; readonly deferred: readonly WireAccountTx[] };
export type ProposalPlan = Tagged<"frame", { preview: Preview }> | Tagged<"idle", { refused: AccountReplicaError; deferred: readonly WireAccountTx[] }>;
// og proposal/transactions.ts: a refused matcher/settlement-owned tx halts; capacity and signed-settlement-freeze refusals are retried.
const PROPOSAL_HALTS: readonly WireAccountTx["type"][] = ["settle_transition", "swap_resolve", "cross_pull_lock", "cross_pull_close"];
const DEFERRED_REFUSALS: readonly string[] = ["htlc_lock_capacity", "settlement_frozen"];
const deferredRefusal = (e: BodyError): boolean => DEFERRED_REFUSALS.includes(e._tag);
type Refusals = ProposalFold["refused"];
const proposalRefusals = (mempool: readonly WireAccountTx[], refused: Refusals): Result<readonly WireAccountTx[], AccountReplicaError> => {
  const txAt = (i: number): WireAccountTx => mempool[i] ?? assertNever(i as never);
  const halted = refused.find(({ index, error }) => !deferredRefusal(error) && PROPOSAL_HALTS.includes(txAt(index).type));
  if (halted !== undefined) return err({ _tag: "proposal_halt", txType: txAt(halted.index).type, cause: halted.error });
  return ok(refused.flatMap(({ index, error }) => (deferredRefusal(error) ? [txAt(index)] : [])));
};
export const planOpen = (r: OpenAccount, party: Party, entityClock: FrameClock): Result<ProposalPlan, AccountReplicaError> => {
  if (r.mempool.length === 0) return err({ _tag: "empty_mempool" });
  // og admission.ts: a lagging proposer never mints a frame behind the committed watermark.
  const clock: FrameClock = { ...entityClock, timestamp: entityClock.timestamp > r.head.timestamp ? entityClock.timestamp : r.head.timestamp };
  const height = r.head.height + 1n, folded = proposalFold(r.state, r.mempool, foldCtx({ height, ...clock }, party.left)), firstRefusal = folded.refused[0];
  return chain(proposalRefusals(r.mempool, folded.refused), (deferred) => {
    if (folded.included.length === 0 && firstRefusal !== undefined) return ok({ _tag: "idle", refused: firstRefusal.error, deferred });
    return chain(commit(folded.state), ({ view, root }) => chain(stampClaims(folded.included, r.state.claimRows), (txs) => {
      const unhashed = { height, timestamp: clock.timestamp, jHeight: clock.jHeight, prevFrameHash: r.head.prevFrameHash, txs, accountStateRoot: root };
      return chain(frameStateHash(unhashed, replicaId(r), party.left), (stateHash) => chain(localProof(view), (frameProof) => map(proposalPlan(view, frameProof, r.dispute, party.left), (dispute): ProposalPlan =>
        ({ _tag: "frame", preview: { frame: { ...unhashed, stateHash }, draft: { state: folded.state, effects: folded.effects }, frameProof, dispute, deferred } }))));
    }));
  });
};
export const planAccountProposal = (r: AccountReplica, self: EntityId, clock: FrameClock): Result<ProposalPlan, AccountReplicaError> => chain(partyOf(replicaId(r), self), (party) => match(r, {
  open: (o) => planOpen(o, party, clock), proposed: () => err({ _tag: "already_proposed" }), received: () => err({ _tag: "already_proposed" }), preparing: () => err(frozenError("preparing")), disputed: () => err(frozenError("disputed")),
}));
const previewOf = (planned: Result<ProposalPlan, AccountReplicaError>): Result<Preview, AccountReplicaError> => chain(planned, (p) => match(p, { frame: ({ preview }): Result<Preview, AccountReplicaError> => ok(preview), idle: ({ refused }): Result<Preview, AccountReplicaError> => err(refused) }));
export const previewOpen = (r: OpenAccount, self: EntityId, clock: FrameClock): Result<Preview, AccountReplicaError> => previewOf(planAccountProposal(r, self, clock));
export const previewAccountProposal = (r: AccountReplica, self: EntityId, clock: FrameClock): Result<Preview, AccountReplicaError> => previewOf(planAccountProposal(r, self, clock));
export const previewAccountFrame = (r: AccountReplica, self: EntityId, clock: FrameClock): Result<AccountFrame, AccountReplicaError> => map(previewAccountProposal(r, self, clock), (p) => p.frame);
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
  ({ _tag: "open", state: next.state, head: next.head, mempool: next.mempool, acknowledged: next.acknowledged ?? r.acknowledged, dispute: next.dispute ?? r.dispute });
const effectsOut = (effects: readonly Effect[]): readonly AccountOutput[] => effects.map((effect) => ({ kind: "effect", effect }));
type Replayed = { readonly draft: FrameFold; readonly view: CommittedAccountState };
const replay = (s: AccountBody, f: AccountFrame, byLeft: boolean): Result<Replayed, AccountReplicaError> =>
  chain(foldFrame(s, f, byLeft), (draft) => chain(commit(draft.state), ({ view, root }) => (root === f.accountStateRoot ? ok({ draft, view }) : err({ _tag: "state_root_mismatch" }))));
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
// Mirrors the htlc_resolve arm's preimage check.
const opensLock = (l: DeadlineLock, secret: string): boolean => keccakUtf8(secret) === l.hashlock;
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
    if (tx.type !== "htlc_resolve" && tx.type !== "htlc_timeout") return ok(locks);
    const lock = locks.get(tx.lockId);
    if (lock === undefined) return ok(locks);
    if (tx.type === "htlc_resolve") {
      if (!opensLock(lock, tx.secret)) return ok(locks);
      if (deadlinePassed(lock, { timestamp: local.timestamp + HTLC_ENFORCEMENT_RESERVE_MS, jHeight: local.jHeight })) return violation("secret_window", tx.lockId, true);
      return deadlinePassed(lock, f) ? violation("secret_frame_expired", tx.lockId) : ok(mapDelete(locks, tx.lockId));
    }
    // htlc_timeout is og's `outcome: 'error', reason: 'timeout'`.
    const locallyExpired = deadlinePassed(lock, local);
    if (proposerIsLeft === lock.senderIsLeft && !locallyExpired) return violation("payer_cancel_early", tx.lockId);
    if (!deadlinePassed(lock, f)) return violation("timeout_not_expired", tx.lockId);
    return ok(locallyExpired ? mapDelete(locks, tx.lockId) : locks);
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
export const proposeOpen = (r: OpenAccount, input: Propose, ctx: AccountContext): Verb<OpenAccount | ProposedAccount> => chain(planOpen(r, ctx.party, { timestamp: input.timestamp, jHeight: input.jHeight }), (planned) => match(planned, {
  idle: ({ refused, deferred }): Verb<OpenAccount | ProposedAccount> => (input.frameHanko === undefined && input.disputeHanko === undefined ? ok(done({ ...r, mempool: deferred })) : err(refused)),
  frame: ({ preview: { frame, draft, frameProof, dispute, deferred } }): Verb<OpenAccount | ProposedAccount> => {
    const frameHanko = input.frameHanko;
    if (frameHanko === undefined) return err({ _tag: "invalid_hanko", entity: ctx.party.self });

    return chain(checks(frameStructure(frame), certifies(ctx.verify, frame.stateHash, frameHanko, ctx.party.self)), () => map(settleLocal(dispute, input.disputeHanko, r.dispute, ctx.party.self, ctx.verify), ({ carried, witnesses }) => {
      const proposed: ProposedAccount = { ...r, _tag: "proposed", mempool: deferred, candidate: new Candidate(frame, frameHanko, frameProof, draft), dispute: witnesses };
      return done<OpenAccount | ProposedAccount, AccountOutput>(proposed, [{ kind: "ack_frame", ...sentBy(r, ctx.party), ack: residentAck(r), frame, frameHanko, ...opt("disputeHanko", carried) }]);
    }));
  },
}));
const receivedDispute = (r: AccountReplica, d: DisputeHanko | undefined, from: EntityId, verify: Verify): Result<DisputeHanko | undefined, AccountReplicaError> => (d === undefined ? ok(undefined) : validateCounterparty(r.state, d, from, verify));
const sameWitness = (a: DisputeHanko, b: DisputeHanko | undefined): boolean => b !== undefined && sameHex(a.hanko, b.hanko) && sameHex(a.hash, b.hash) && sameHex(a.proofBodyHash, b.proofBodyHash) && a.proofNonce === b.proofNonce && a.proposerIsLeft === b.proposerIsLeft;
const conflict = (field: "frameHash" | "frameHanko" | "disputeHanko" | "height"): AccountReplicaError => ({ _tag: "ack_conflict", field });
const predecessorAck = (r: AccountReplica, a: AccountAck, from: EntityId, verify: Verify): Result<void, AccountReplicaError> => match(r.head, {
  genesis: (): Result<void, AccountReplicaError> => err(conflict("frameHash")),
  installed: ({ certificate: { parent } }): Result<void, AccountReplicaError> => (sameHex(a.frameHash, parent) ? certifies(verify, parent, a.frameHanko, from) : err(conflict("frameHash"))),
});
const repeatedAck = (r: AccountReplica, a: AccountAck, validated: DisputeHanko | undefined, ctx: ReceivedContext): Result<void, AccountReplicaError> => match(r.head, {
  genesis: (): Result<void, AccountReplicaError> => err(conflict("frameHash")),
  installed: ({ prevFrameHash: h, certificate }): Result<void, AccountReplicaError> => {
    if (!sameHex(a.frameHash, h)) return err(conflict("frameHash"));
    if (a.frameHanko.length === 0 || !sameHex(a.frameHanko, certifiedBy(certificate, ctx.party).peer)) return err(conflict("frameHanko"));
    if (validated !== undefined && !sameWitness(validated, r.dispute.counterparty)) return err(conflict("disputeHanko"));
    return certifies(ctx.verify, h, a.frameHanko, ctx.from);
  },
});
type HeadAck = Tagged<"identity"> | Tagged<"advance", { target: bigint; validated: DisputeHanko | undefined }>;
const IDENTITY: HeadAck = { _tag: "identity" };
const headAck = (r: AccountReplica, a: AccountAck, ctx: ReceivedContext, riding: bigint | undefined, target: bigint): Result<HeadAck, AccountReplicaError> => chain(receivedDispute(r, a.disputeHanko, ctx.from, ctx.verify), (validated): Result<HeadAck, AccountReplicaError> => {
  const height = r.head.height;
  if (riding === undefined && height > 1n && a.height === height - 1n) return map(predecessorAck(r, a, ctx.from, ctx.verify), () => IDENTITY);
  if (target < height - 1n) return ok(IDENTITY);
  if (target === height && height > 0n) return map(repeatedAck(r, a, validated, ctx), () => IDENTITY);
  return ok({ _tag: "advance", target, validated });
});
const commitOwn = (r: ProposedAccount, a: AccountAck, validated: DisputeHanko | undefined, ctx: ReceivedContext): Verb<OpenAccount> => {
  const { frame, frameHanko, frameProof } = r.candidate;
  return chain(requireDispute(frameProof, r.dispute, validated), (): Verb<OpenAccount> => {
    if (!sameHex(a.frameHash, frame.stateHash)) return err({ _tag: "hash_mismatch" });
    return map(certifies(ctx.verify, frame.stateHash, a.frameHanko, ctx.from), () => {
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
      ? ok(done({ ...r, candidate: new Candidate(r.candidate.frame, input.frameHanko, r.candidate.frameProof, r.candidate.draft) }))
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
      : chain(receivedDispute(r, ack.disputeHanko, ctx.from, ctx.verify), () => predecessorAck(r, ack, ctx.from, ctx.verify));
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
    () => traverse(frame.txs, (tx) => wireTx(tx, replicaId(r), byLeft)), () => certifies(ctx.verify, frame.stateHash, input.frameHanko, ctx.from),
    () => mapErr(incomingDeadline(r.state, frame, byLeft, ctx), (v): AccountReplicaError => (v.dispute ? { _tag: "dispute_required", cause: v.error, frame, frameHanko: input.frameHanko } : v.error)));
  return gates.ok ? { _tag: "continue", validated: validated.value } : answered(gates);
};
const admitPeerFrame = (cur: OpenAccount, input: AckFrame, party: Party, validated: DisputeHanko | undefined): Verb<ReceivedAccount> => {
  const { frame } = input, onLeft = other(party.left);
  const evidence = (cause: AccountReplicaError): AccountReplicaError => ({ _tag: "dispute_required", cause, frame, frameHanko: input.frameHanko });
  return chain(acceptFrame(frame, replicaId(cur), onLeft), () => chain(mapErr(replay(cur.state, frame, onLeft), evidence), ({ draft, view }) => chain(localProof(view), (frameProof) =>
    map(mapErr(requireDispute(frameProof, cur.dispute, validated), evidence), () => done<ReceivedAccount, AccountOutput>({ ...cur, _tag: "received", candidate: new Candidate(frame, input.frameHanko, frameProof, draft), disputeHanko: validated })))));
};
const proposalOnOpen = (r: OpenAccount, input: AckFrame, ctx: InboundAccountContext): Verb<OpenAccount | ReceivedAccount> =>
  match(receipt(r, input, ctx), { answered: ({ result }): Verb<OpenAccount | ReceivedAccount> => result, continue: ({ validated }): Verb<OpenAccount | ReceivedAccount> => admitPeerFrame(r, input, ctx.party, validated) });
const proposalOnProposed = (r: ProposedAccount, input: AckFrame, ctx: InboundAccountContext): Verb<OpenAccount | ProposedAccount | ReceivedAccount> => match(receipt(r, input, ctx), {
  answered: ({ result }): Verb<OpenAccount | ProposedAccount | ReceivedAccount> => result,
  continue: ({ validated }): Verb<OpenAccount | ProposedAccount | ReceivedAccount> => (ctx.party.left ? ok(done(r)) : admitPeerFrame(restore(r), input, ctx.party, validated)),
});
const proposalOnReceived = (r: ReceivedAccount, input: AckFrame, ctx: InboundAccountContext): Verb<ReceivedAccount> => match(receipt(r, input, ctx), {
  answered: ({ result }): Verb<ReceivedAccount> => result,
  continue: (): Verb<ReceivedAccount> => (sameHex(input.frame.stateHash, r.candidate.frame.stateHash) ? ok(done(r)) : err({ _tag: "already_proposed" })),
});
export const restoreCandidate = (held: ProposedAccount | ReceivedAccount, party: Party, verify: Verify): Result<Candidate, AccountReplicaError> => {
  const { frame, frameHanko } = held.candidate, byLeft = proposerIsLeft(held, party);
  return chain(acceptFrame(frame, replicaId(held), byLeft), () =>
    chain(certifies(verify, frame.stateHash, frameHanko, at(party.self, party.peer, byLeft === party.left)), () =>
      chain(replay(held.state, frame, byLeft), ({ draft, view }) => map(localProof(view), (frameProof) => new Candidate(frame, frameHanko, frameProof, draft)))));
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
  const { state, head, dispute: witnesses, acknowledged } = r, frozen = { state, head, dispute: witnesses, acknowledged, evidence };
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
export const resume = accountVerb("resume", { open: { _tag: "not_preparing" }, proposed: { _tag: "not_preparing" }, received: { _tag: "not_preparing" }, preparing: resumePreparing, disputed: frozenError("disputed") });


export const admissionFold = (mempool: readonly WireAccountTx[], added: number, s: AccountBody, self: EntityId, at: FoldAt): Result<void, AccountReplicaError> => chain(partyOf(s.account.id, self), (party) => {
  const first = proposalFold(s, mempool, foldCtx(at, party.left)).refused.find((x) => x.index >= mempool.length - added);
  return first === undefined ? ok(undefined) : err(first.error);
});
const ENTITY_WORD = /^0x[0-9a-f]{64}$/;
export const genesisReplica = (id: AccountId, terms: AccountTerms, hub: HubSide = null): Result<OpenAccount, AccountReplicaError> => {
  if (!ENTITY_WORD.test(id.left) || !ENTITY_WORD.test(id.right)) return err({ _tag: "bad_account", reason: "entity_id" });
  if (id.left === id.right) return err({ _tag: "bad_account", reason: "same_entity" });
  return map(mapErr(accountTerms(terms), (e): AccountReplicaError => ({ _tag: "bad_account", reason: e._tag })), (normalized): OpenAccount =>
    ({ _tag: "open", state: genesisAccountBody(genesisAccount(id), normalized, hub), head: genesisAccountHead(), mempool: [], dispute: genesisWitnesses() }));
};
export type LiveAccount = OpenAccount | ProposedAccount | ReceivedAccount;
type Queued = { readonly replica: LiveAccount; readonly queued: readonly WireAccountTx[] };
/** og local-tx-admission.ts: dedupe against mempool + own pending frame; the limit counts both (mempool.ts). A received frame is committed in og, so it pends nothing. */
const queueOn = <R extends LiveAccount>(r: R, pending: readonly WireAccountTx[], txs: readonly WireAccountTx[]): Result<Queued, AccountReplicaError> => {
  const queued = unqueued(txs, [...r.mempool, ...pending]);
  return r.mempool.length + pending.length + queued.length > ACCOUNT_MEMPOOL_SIZE ? err({ _tag: "mempool_full", limit: ACCOUNT_MEMPOOL_SIZE }) : ok({ replica: { ...r, mempool: [...r.mempool, ...queued] }, queued });
};
const enqueue = (r: AccountReplica, txs: readonly WireAccountTx[]): Result<Queued, AccountReplicaError> => match(r, {
  open: (o) => queueOn(o, [], txs), proposed: (p) => queueOn(p, p.candidate.frame.txs, txs), received: (h) => queueOn(h, [], txs),
  preparing: () => err(frozenError("preparing")), disputed: () => err(frozenError("disputed")),
});
/** The state and height the next proposal builds on: a held candidate is about to commit. */
const nextBase = (r: LiveAccount): { readonly state: AccountBody; readonly height: bigint } => (r._tag === "open" ? { state: r.state, height: r.head.height } : { state: r.candidate.draft.state, height: r.candidate.frame.height });
export const admit = (r: AccountReplica, txs: readonly WireAccountTx[]): Result<LiveAccount, AccountReplicaError> => map(enqueue(r, txs), (q) => q.replica);
export const admitAt = (r: AccountReplica, txs: readonly WireAccountTx[], self: EntityId, clock: FrameClock): Result<LiveAccount, AccountReplicaError> => chain(partyOf(replicaId(r), self), () =>
  chain(enqueue(r, txs), ({ replica, queued }) => { const base = nextBase(replica); return map(admissionFold(replica.mempool, queued.length, base.state, self, { height: base.height + 1n, ...clock }), () => replica); }));
const accountContext = (r: AccountReplica, ctx: DoorContext): Result<AccountContext, AccountReplicaError> => map(partyOf(replicaId(r), ctx.self), (party) => ({ verify: ctx.verify, party }));
export const applyAccountInput = (r: AccountReplica, input: AccountInput, ctx: DoorContext): Result<AccountApply, AccountReplicaError> => chain(accountContext(r, ctx), (c) => matchBy("kind", input, {
  propose: (i) => propose(r, i, c), freeze: (i) => freezeAccount(r, i, c), resume: (i) => resume(r, i, c),
  dispute: (i) => chain(checkEnvelope(replicaId(r), r.state.terms, i), (sender) => dispute(r, i, { ...c, from: sender })),
  ack: (i) => chain(checkEnvelope(replicaId(r), r.state.terms, i), (sender) => ack(r, i, { ...c, delivery: sender === c.party.self ? { _tag: "local" } : { _tag: "received", from: sender } })),
  ack_frame: (i) => chain(checkEnvelope(replicaId(r), r.state.terms, i), (sender) => ackFrame(r, i, { ...c, now: ctx.now, finalizedJHeight: ctx.finalizedJHeight ?? r.state.finalizedJHeight, from: sender })),
}));
export const applyDelivered = (r: AccountReplica, input: AccountInput, delivery: Delivery, ctx: DoorContext): Result<AccountApply, AccountReplicaError> =>
  chain(matchBy("kind", input, {
    propose: (): Result<void, AccountReplicaError> => localOnly(delivery),
    freeze: (): Result<void, AccountReplicaError> => localOnly(delivery), resume: (): Result<void, AccountReplicaError> => localOnly(delivery),
    dispute: (m): Result<void, AccountReplicaError> => deliveredBy(m, ctx.self, delivery),
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
export type EntityState = {
  readonly id: EntityId; readonly quorum: Quorum; readonly jurisdiction: Domain; readonly accounts: ReadonlyMap<EntityId, AccountState>;
  readonly height: bigint; readonly timestamp: bigint; readonly jurisdictionConfig?: JurisdictionConfig | undefined; readonly committed: EntityCommitted;
};
/** og `core/types/entity-tx.ts` wire shape `{type, data}`. `proposeAccount` is rewrite-only: og proposes Account frames itself and builds their Hanko from the quorum's precommits. */
export type EntityTx =
  | { readonly type: "openAccount"; readonly data: { readonly targetEntityId: EntityId; readonly disputeConfig: DisputeConfig; readonly accountDomain: Domain; readonly watchSeed: string; readonly creditAmount?: bigint | undefined; readonly tokenId?: TokenId | undefined } }
  | { readonly type: "accountInput"; readonly data: AccountMessage }
  | { readonly type: "extendCredit"; readonly data: { readonly counterpartyEntityId: EntityId; readonly tokenId: TokenId; readonly amount: bigint } }
  | { readonly type: "directPayment"; readonly data: { readonly targetEntityId: EntityId; readonly tokenId: TokenId; readonly amount: bigint; readonly route: readonly EntityId[]; readonly description?: string | undefined; readonly deliveryMode: "direct" | "trusted"; readonly trustedGatewayEntityId?: EntityId | undefined } }
  | { readonly type: "proposeAccount"; readonly data: { readonly counterpartyEntityId: EntityId; readonly frameHanko?: Hanko | undefined; readonly disputeHanko?: DisputeHanko | undefined } & FrameClock };
export type HashToSign = { readonly hash: string; readonly type: "entityFrame" | "accountFrame" | "dispute"; readonly context: string };
export type EntityFrame = Head & {
  readonly timestamp: bigint; readonly txs: readonly EntityTx[]; readonly events: readonly Binary[]; readonly stateRoot: string; readonly authorityRoot: string;
  readonly entityContext: EntityInfraContext; readonly hashesToSign: readonly HashToSign[];
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
  | { readonly kind: "precommit"; readonly height: bigint; readonly frameHash: EntityFrameHash; readonly signatures: Precommits };
export type EntityPhase = "open" | "proposed" | "locked";
export type EntityEvent = EntityInput["kind"];
export type Folded = { readonly state: EntityState; readonly accountReplicas: ReadonlyMap<EntityId, AccountReplica> };
export type Draft = Folded & { readonly outputs: readonly EntityOutput[] };
type EntityEnv = Folded & { readonly signerId: Address; readonly head: Head; readonly mempool: readonly EntityTx[] };
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
  | Tagged<"proposal_digest" | "proposal_parent" | "proposal_leader" | "proposal_hash" | "proposal_manifest" | "proposal_signature" | "proposal_conflict" | "proposal_wait" | "local_manifest_mismatch" | "local_precommit_conflict">
  | Tagged<"precommit_frame_mismatch" | "precommit_not_active" | "precommit_signer_equivocation" | "commit_conflict" | "commit_wait">
  | Tagged<"unknown_member" | "duplicate_member" | "not_proposer" | "invalid_signature" | "wrong_replica", { address: string }>;
export type EntityGrammar = { readonly table: typeof EntityTransition; readonly replica: EntityReplica; readonly input: EntityInput; readonly ctx: { readonly [E in EntityEvent]: EntityContext }; readonly output: EntityOutput; readonly error: EntityError };
export type NextEntityPhase<S extends EntityPhase, E extends EntityEvent> = Next<EntityGrammar, S, E>;
type EntityApply<R extends EntityReplica = EntityReplica> = Apply<R, EntityOutput>;
export const encodeEntityTx = (tx: EntityTx): string => `${tx.type}|${canon(tx.data)}`;
export const encodeEntityState = (s: EntityState): string => canon({
  id: s.id,
  quorum: match(s.quorum, { teaching: (q) => ({ threshold: q.threshold, members: q.members }), board: (q) => ({ board: encodeBoardHash({ board: q.board }), entityId: q.entityId }) }),
  jurisdiction: s.jurisdiction, accounts: new Map([...s.accounts].map(([peer, a]) => [peer, hashAccountState(a)])),
  height: s.height, timestamp: s.timestamp, jurisdictionConfig: s.jurisdictionConfig, committed: s.committed,
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
/** Derived by the rewrite itself; never taken from `committed`. `leaderState` stays absent: no view change (og leader failover). */
const DERIVED_ROOT_FIELDS: ReadonlySet<string> = new Set(["entityId", "height", "timestamp", "config", "accounts", "leaderState"]);
export type EntityRootInput = {
  readonly config: EntityRootConfig; readonly accounts: readonly EntityRootAccount[];
  readonly entityId?: string | undefined; readonly height?: number | undefined; readonly timestamp?: number | undefined; readonly committed?: EntityCommitted | undefined;
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
const wireData = (tx: EntityTx): unknown => (tx.type !== "accountInput" && "tokenId" in tx.data && tx.data.tokenId !== undefined ? { ...tx.data, tokenId: Number(tx.data.tokenId) } : tx.data);
const entityFrameTx = (tx: EntityTx): Result<EntityFrameTx, BinaryError> => map(binaryBody(wireData(tx)), (data) => ({ type: tx.type, data }));
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

type FoldContext = { readonly verify: Verify; readonly timestamp: bigint };
type Replicas = ReadonlyMap<EntityId, AccountReplica>;
/** Who the tx is about: og routes accountInput by its envelope, the rest by an explicit counterparty. */
const peerOf = (tx: EntityTx, self: EntityId): EntityId => matchBy("type", tx, {
  openAccount: (x) => x.data.targetEntityId, accountInput: (x) => (namesEntity(x.data.fromEntityId, self) ? x.data.toEntityId : x.data.fromEntityId),
  extendCredit: (x) => x.data.counterpartyEntityId, directPayment: (x) => x.data.route[1] ?? x.data.targetEntityId, proposeAccount: (x) => x.data.counterpartyEntityId,
});
/** A peer's Account message names its sender in its envelope; everything else is this entity's own command. */
const originOf = (tx: EntityTx, self: EntityId): Delivery => (tx.type === "accountInput" && !namesEntity(tx.data.fromEntityId, self) ? { _tag: "received", from: tx.data.fromEntityId } : { _tag: "local" });
const owesCreateAck = (child: AccountReplica): boolean => match(child, { open: () => false, proposed: () => false, received: () => true, preparing: () => false, disputed: () => false });
const isCreateAck = (tx: EntityTx, origin: Delivery): boolean => tx.type === "accountInput" && origin._tag === "local" && tx.data.kind === "ack";
const putChild = (state: EntityState, replicas: Replicas, peer: EntityId, child: AccountReplica): Folded => ({ state: { ...state, accounts: mapSet(state.accounts, peer, child.state.account) }, accountReplicas: mapSet(replicas, peer, child) });
const withChild = (replicas: Replicas, target: EntityId, f: (child: AccountReplica) => Result<Draft, EntityError>): Result<Draft, EntityError> => { const child = replicas.get(target); return child === undefined ? err({ _tag: "no_such_account", target }) : f(child); };
const routed = (state: EntityState, replicas: Replicas, target: EntityId, applied: Result<AccountApply, AccountReplicaError>): Result<Draft, EntityError> => chain(applied, (a) =>
  map(traverse(a.outputs, (o): Result<readonly AccountMessage[], EntityError> => matchBy("kind", o, { effect: () => err({ _tag: "not_l0" }), ack: (m) => ok([m]), ack_frame: (m) => ok([m]), start_dispute: () => ok([]) })),
    (messages) => ({ ...putChild(state, replicas, target, a.replica), outputs: messages.flat().map((data): EntityOutput => ({ to: target, tx: { type: "accountInput", data } })) })));
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
    return map(admitAt(opened, seeded, state.id, L0_CLOCK), (admitted) => ({ ...putChild(state, replicas, target, admitted), outputs: [] }));
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
const foldTx = (state: EntityState, replicas: Replicas, tx: EntityTx, ctx: FoldContext): Result<Draft, EntityError> => {
  const origin = originOf(tx, state.id), peer = peerOf(tx, state.id), owed = replicas.get(peer);
  if (owed !== undefined && owesCreateAck(owed) && !isCreateAck(tx, origin)) return err({ _tag: "create_ack_required", target: peer });
  const enqueue = (target: EntityId, accountTxs: readonly AccountTx[], outputs: readonly EntityOutput[]): Result<Draft, EntityError> =>
    withChild(replicas, target, (child) => map(admitAt(child, accountTxs, state.id, L0_CLOCK), (admitted) => ({ ...putChild(state, replicas, target, admitted), outputs })));
  const skip: Draft = { state, accountReplicas: replicas, outputs: [] };
  return matchBy("type", tx, {
    openAccount: (x) => openChild(state, replicas, x),
    extendCredit: (x) => (replicas.has(x.data.counterpartyEntityId) ? enqueue(x.data.counterpartyEntityId, [{ type: "set_credit_limit", tokenId: x.data.tokenId, limit: x.data.amount }], [wake(state, ctx.timestamp)]) : ok(skip)),
    directPayment: (x) => {
      const { route, targetEntityId, amount, deliveryMode, trustedGatewayEntityId, tokenId } = x.data;
      if (route.length === 0 || route.length > 100 || route[0] !== state.id || route[route.length - 1] !== targetEntityId) return err({ _tag: "payment_route" });
      if (amount < 1n || amount > UINT256_MAX) return ok(skip);
      if (deliveryMode !== "direct" || trustedGatewayEntityId !== undefined || route.length !== 2) return err({ _tag: "payment_route" });
      return replicas.has(targetEntityId) ? enqueue(targetEntityId, [{ type: "payment", tokenId, amount }], [wake(state, ctx.timestamp)]) : err({ _tag: "no_such_account", target: targetEntityId });
    },
    proposeAccount: (x) => withChild(replicas, x.data.counterpartyEntityId, (child) => chain(partyOf(replicaId(child), state.id), (party) =>
      routed(state, replicas, x.data.counterpartyEntityId, propose(child, { kind: "propose", frameHanko: x.data.frameHanko, disputeHanko: x.data.disputeHanko, timestamp: x.data.timestamp, jHeight: x.data.jHeight }, { verify: ctx.verify, party })))),
    accountInput: (x) => chain(deliveredBy(x.data, state.id, origin), () => {
      const door: DoorContext = { verify: ctx.verify, self: state.id, now: ctx.timestamp };
      const apply = (at: Folded): Result<Draft, EntityError> => withChild(at.accountReplicas, peer, (child) => routed(at.state, at.accountReplicas, peer, disputeUnsafe(child, applyAccountInput(child, x.data, door), door)));
      const held: Folded = { state, accountReplicas: replicas };
      return matchBy("kind", x.data, {
        ack: () => apply(held),
        ack_frame: (i) => match(origin, {
          local: (): Result<Draft, EntityError> => err({ _tag: "from_not_converted" }),
          received: ({ from }) => (!i.frame.txs.every(isL0Tx) ? err({ _tag: "not_l0" }) : replicas.has(from) ? apply(held) : chain(inboundChild(state, replicas, from, i), apply)),
        }),
      });
    }),
  });
};
export type FoldedTxs = { readonly draft: Draft; readonly included: readonly EntityTx[]; readonly evicted: readonly EntityTx[] };
/**
 * og buildEntityProposalEvictingRejected: a refused tx is evicted and the rest still fold. An openAccount refusal is a plain
 * Error in og (not a reject disposition), so it refuses the whole input; so does a frame whose every tx was refused.
 */
export const foldTxs = (state: EntityState, replicas: Replicas, txs: readonly EntityTx[], ctx: FoldContext): Result<FoldedTxs, EntityError> => {
  type Acc = FoldedTxs & { readonly first?: EntityError | undefined };
  return chain(foldResult<Acc, EntityTx, EntityError>(txs, { draft: { state, accountReplicas: replicas, outputs: [] }, included: [], evicted: [] }, (acc, tx) => {
    const r = foldTx(acc.draft.state, acc.draft.accountReplicas, tx, ctx);
    if (r.ok) return ok({ ...acc, draft: { ...r.value, outputs: [...acc.draft.outputs, ...r.value.outputs] }, included: [...acc.included, tx] });
    return tx.type === "openAccount" ? r : ok({ ...acc, evicted: [...acc.evicted, tx], first: acc.first ?? r.error });
  }), ({ first, ...folded }) => (folded.included.length === 0 && first !== undefined ? err(first) : ok(folded)));
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
/** Rebalance requests, fee state and fee policies are committed Account state (og requestedRebalance*, rebalanceFeePolicies); the local shadow is not part of the body. */
const installedAccount = (self: EntityId, peer: EntityId, child: AccountReplica): Result<EntityRootAccount, EntityError> => {
  const body = child.state;
  const status: EntityRootAccount["status"] = match(child, { open: () => "active", proposed: () => "active", received: () => "active", preparing: () => "dispute_preparing", disputed: () => "disputed" });
  const linked: Result<{ readonly height: number; readonly frame: string }, EntityFrameHashError> = match(child.head, { genesis: () => ok({ height: 0, frame: "" }), installed: (head) => map(frameNumber(head.height), (height) => ({ height, frame: head.prevFrameHash })) });
  return chain(linked, (link): Result<EntityRootAccount, EntityError> => chain(mapErr(committedView(body), (): EntityError => ({ _tag: "account_envelope", target: peer })), (state): Result<EntityRootAccount, EntityError> => ok({
    fromEntity: self, toEntity: peer, status, currentHeight: link.height, nextProofNonce: child.dispute.nextProofNonce, currentFrameHash: link.frame,
    pendingWithdrawals: ZERO_WORD, policyRoot: ZERO_WORD, submittedAtByTokenRoot: ZERO_WORD, state,
  })));
};
/** og computeCanonicalEntityConsensusStateHash over the draft: entityId, height, timestamp, config, accounts and every committed section. */
export const entityRootOf = (state: EntityState, replicas: Replicas): Result<string, EntityError> =>
  chain(frameNumber(state.height), (height) => chain(frameNumber(state.timestamp), (timestamp) => chain(traverse([...replicas], ([peer, child]) => installedAccount(state.id, peer, child)),
    (accounts) => entityStateRoot({ config: rootConfig(state), accounts, entityId: state.id, height, timestamp, committed: state.committed }))));
const authorityRoot = (state: EntityState): Result<string, EntityRootError> => {
  const config = rootConfig(state), leader = config.validators[0];
  if (leader === undefined || leader.length === 0) return err({ _tag: "bad_config" });
  return chain(consensusConfig(config), (normalized) => map(encodeConsensus({
    domain: "xln.entity.frame-authority:binary",
    authority: { config: normalized, leaderState: { activeValidatorId: leader, view: 0, changedAtHeight: 0 } },
  }), (bytes) => bytesToHex(keccak_256(bytes))));
};
/** og account/consensus hashesToSign: the Account frames and dispute proofs this frame signs for, as secondary manifest entries. */
const messageHashes = (peer: EntityId, m: AccountMessage): readonly HashToSign[] => {
  const tail = peer.slice(-8);
  const acked = (a: AccountAck): readonly HashToSign[] => [
    { hash: a.frameHash, type: "accountFrame", context: `account:${tail}:ack:${a.height}` },
    ...(a.disputeHanko === undefined ? [] : [{ hash: a.disputeHanko.hash, type: "dispute", context: `account:${tail}:ack-dispute` } as const]),
  ];
  return matchBy("kind", m, {
    ack: (a) => acked(a),
    ack_frame: (f) => [...(f.ack === null ? [] : acked(f.ack)), { hash: f.frame.stateHash, type: "accountFrame", context: `account:${tail}:frame:${f.frame.height}` },
      ...(f.disputeHanko === undefined ? [] : [{ hash: f.disputeHanko.hash, type: "dispute", context: `account:${tail}:dispute` } as const])],
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
const buildFrame = (r: EntityEnv, proposer: Address, timestamp: bigint, txs: readonly EntityTx[], folded: Draft): Result<EntityCandidate, EntityError> => {
  const height = r.head.height + 1n, parent = r.head.height === 0n ? GENESIS_PARENT : frameWord(r.head.prevFrameHash), signer = signerId(proposer);
  const committed: EntityCommitted = "crontabState" in folded.state.committed ? folded.state.committed : { ...folded.state.committed, crontabState: DEFAULT_CRONTAB };
  const draft: Draft = { ...folded, state: { ...folded.state, height, timestamp, committed } };
  return chain(frameNumber(height), (heightNo) => chain(entityRootOf(draft.state, draft.accountReplicas), (stateRoot) => chain(authorityRoot(draft.state), (root) => {
    const body = {
      height, prevFrameHash: parent as EntityFrameHash, timestamp, txs, events: [], stateRoot, authorityRoot: root,
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
const installFrame = (r: EntityEnv & EntityCandidate, frameHash: EntityFrameHash, signatures: Precommits, broadcast: boolean): EntityApply<OpenEntity> => {
  const others = broadcast ? [...membersOf(r.draft.state.quorum).keys()].filter((v) => signerId(v) !== signerId(r.signerId)) : [];
  return done(openEntity(r.signerId, r.draft.state, { height: r.frame.height, prevFrameHash: frameHash }, withoutTxs(r.mempool, r.frame.txs), r.draft.accountReplicas),
    [...r.draft.outputs, ...others.map((v): EntityOutput => ({ to: r.state.id, signerId: v, input: { kind: "proposal", frame: r.frame, signatures } }))]);
};
/** og admitEntityTransactions + startEntityProposalIfReady: queue, forward a non-leader mempool to the leader, or propose from the mempool. */
const admitTxs = <R extends EntityReplica>(r: R, input: Extract<EntityInput, { kind: "txs" }>, ctx: EntityContext): Result<R, EntityError> => {
  if (input.timestamp < 0n || input.timestamp > BigInt(Number.MAX_SAFE_INTEGER)) return err({ _tag: "frame_timestamp_invalid", timestamp: input.timestamp });
  const from = ctx.from;
  if (from !== undefined && (from === ctx.self || !input.txs.every((tx) => tx.type === "accountInput" && namesEntity(tx.data.fromEntityId, from) && namesEntity(tx.data.toEntityId, ctx.self)))) return err({ _tag: "from_not_converted" });
  if (input.txs.length > ENTITY_MEMPOOL_SIZE || r.mempool.length + input.txs.length > ENTITY_MEMPOOL_SIZE) return err({ _tag: "mempool_full" });
  return ok({ ...r, mempool: appendMempool(r.mempool, input.txs) });
};
const forwarded = (r: EntityEnv, timestamp: bigint): readonly EntityOutput[] =>
  signerId(r.signerId) === signerId(r.state.quorum.proposer) || r.mempool.length === 0 ? [] : [{ to: r.state.id, signerId: r.state.quorum.proposer, input: { kind: "txs", timestamp, txs: r.mempool } }];
export const applyTxsOpen = (r: OpenEntity, input: Extract<EntityInput, { kind: "txs" }>, ctx: EntityContext): Result<EntityApply<OpenEntity | ProposedEntity>, EntityError> => chain(admitTxs(r, input, ctx), (queued): Result<EntityApply<OpenEntity | ProposedEntity>, EntityError> => {
  if (signerId(queued.signerId) !== signerId(queued.state.quorum.proposer) || queued.mempool.length === 0) return ok(done(queued, forwarded(queued, input.timestamp)));
  /** og resolveEntityProposalTimestamp: never behind the committed clock. */
  const timestamp = input.timestamp > queued.state.timestamp ? input.timestamp : queued.state.timestamp;
  return chain(foldTxs(queued.state, queued.accountReplicas, queued.mempool, { verify: ctx.verify, timestamp }), ({ draft, included, evicted }) => {
    const pool = withoutTxs(queued.mempool, evicted);
    return chain(buildFrame(queued, queued.signerId, timestamp, included, draft), (candidate) => chain(signManifest(candidate.frame.hashesToSign, queued.signerId, ctx), (own) => chain(hashEntityFrame(candidate.frame), (frameHash): Result<EntityApply<OpenEntity | ProposedEntity>, EntityError> => {
      const proposed: ProposedEntity = { ...queued, _tag: "proposed", mempool: pool, ...candidate, signatures: new Map([[signerId(queued.signerId), own]]) };
      if (isSingleSigner(queued.state.quorum)) return ok(installFrame(proposed, frameHash, proposed.signatures, false));
      const others = [...membersOf(queued.state.quorum).keys()].filter((v) => signerId(v) !== signerId(queued.signerId));
      return ok(done<OpenEntity | ProposedEntity, EntityOutput>(proposed, others.map((v): EntityOutput => ({ to: queued.state.id, signerId: v, input: { kind: "proposal", frame: candidate.frame, signatures: proposed.signatures } }))));
    })));
  });
});
/** og runs handleHashPrecommits on every input: a held frame whose collected signatures already reach quorum installs now. */
const heldQuorum = <R extends ProposedEntity | LockedEntity>(r: R, before: readonly EntityOutput[]): Result<EntityApply<OpenEntity | R>, EntityError> =>
  quorumPower(r.state.quorum, r.signatures) < thresholdOf(r.state.quorum) ? ok(done<OpenEntity | R, EntityOutput>(r, before))
    : map(hashEntityFrame(r.frame), (frameHash) => { const c = installFrame(r, frameHash, r.signatures, true); return done<OpenEntity | R, EntityOutput>(c.replica, [...before, ...c.outputs]); });
const queueOnly = <R extends ProposedEntity | LockedEntity>(r: R, input: Extract<EntityInput, { kind: "txs" }>, ctx: EntityContext): Result<EntityApply<OpenEntity | R>, EntityError> =>
  chain(admitTxs(r, input, ctx), (queued) => heldQuorum(queued, forwarded(queued, input.timestamp)));
/** og preauthenticateEntityProposal: canonical digests, parent, leader, recomputed hash, manifest head, the proposer's frame signature. */
const DIGEST = /^0x[0-9a-f]{64}$/;
const preauthenticate = (r: EntityEnv, frame: EntityFrame, signatures: Precommits, ctx: EntityContext): Result<EntityFrameHash, EntityError> => chain(hashEntityFrame(frame), (frameHash): Result<EntityFrameHash, EntityError> => {
  if (!DIGEST.test(frame.stateRoot) || !DIGEST.test(frame.authorityRoot)) return err({ _tag: "proposal_digest" });
  if (frame.prevFrameHash !== (r.head.height === 0n ? GENESIS_PARENT : frameWord(r.head.prevFrameHash))) return err({ _tag: "proposal_parent" });
  const proposer = frame.entityContext.proposerSignerId;
  if (signerId(proposer) !== signerId(r.state.quorum.proposer) || frame.entityContext.entityId !== r.state.id) return err({ _tag: "proposal_leader" });
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
    return chain(buildFrame(r, r.state.quorum.proposer, frame.timestamp, frame.txs, draft), (candidate) => chain(hashEntityFrame(candidate.frame), (local) =>
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
      if (held !== undefined) return unwrapOr(hashEntityFrame(held.frame), () => "") === frameHash ? ok(installFrame(held, frameHash, sigs, false)) : err({ _tag: "commit_conflict" });
      return map(replayFrame(r, frame, frameHash, ctx), (candidate) => installFrame({ ...r, ...candidate }, frameHash, sigs, false));
    }));
  });
};
/** og handleProposedFramePrecommit then handleHashPrecommits: replay, sign the manifest, lock, send the precommit to every other validator; commit when the lock already holds a quorum. */
const signProposal = (r: OpenEntity, frame: EntityFrame, bundles: Precommits, ctx: EntityContext): Result<EntityApply<OpenEntity | LockedEntity>, EntityError> => {
  if (frame.height < r.head.height) return ok(done<OpenEntity | LockedEntity, EntityOutput>(r));
  return chain(hashEntityFrame(frame), (frameHash): Result<EntityApply<OpenEntity | LockedEntity>, EntityError> => {
    if (frame.height === r.head.height) return frameHash === r.head.prevFrameHash ? ok(done<OpenEntity | LockedEntity, EntityOutput>(r)) : err({ _tag: "proposal_conflict" });
    if (frame.height !== r.head.height + 1n) return err({ _tag: "proposal_wait" });
    return chain(preauthenticate(r, frame, bundles, ctx), () => chain(replayFrame(r, frame, frameHash, ctx), (candidate) => chain(signManifest(candidate.frame.hashesToSign, r.signerId, ctx), (own) =>
      chain(normalizeBundles(r.state.quorum, bundles), (sigs): Result<EntityApply<OpenEntity | LockedEntity>, EntityError> => {
        if ([...sigs].some(([id, s]) => !bundleValid(r.state.quorum, frame.hashesToSign, id, s, ctx))) return err({ _tag: "invalid_signature", address: "" });
        const self = signerId(r.signerId), mine = sigs.get(self);
        if (mine !== undefined && !sameSigs(mine, own)) return err({ _tag: "local_precommit_conflict" });
        const locked: LockedEntity = { ...r, _tag: "locked", ...candidate, signatures: mapSet(sigs, self, own) };
        const precommits = [...membersOf(r.state.quorum).keys()].filter((v) => signerId(v) !== self)
          .map((v): EntityOutput => ({ to: r.state.id, signerId: v, input: { kind: "precommit", height: frame.height, frameHash, signatures: new Map([[self, own]]) } }));
        if (quorumPower(r.state.quorum, locked.signatures) < thresholdOf(r.state.quorum)) return ok(done<OpenEntity | LockedEntity, EntityOutput>(locked, precommits));
        const committed = installFrame(locked, frameHash, locked.signatures, true);
        return ok(done<OpenEntity | LockedEntity, EntityOutput>(committed.replica, [...precommits, ...committed.outputs]));
      }))));
  });
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
const entityVerb = grammar<EntityGrammar>(EntityTransition);
const applyTxs = entityVerb("txs", { open: applyTxsOpen, proposed: (r: ProposedEntity, i, c) => queueOnly(r, i, c), locked: (r: LockedEntity, i, c) => queueOnly(r, i, c) });
const applyProposal = entityVerb("proposal", { open: proposalOpen, proposed: proposalProposed, locked: proposalLocked });
const applyPrecommit = entityVerb("precommit", { open: precommitOpen, proposed: (r: ProposedEntity, i, c) => applyPrecommitHeld(r, i, c), locked: (r: LockedEntity, i, c) => applyPrecommitHeld(r, i, c) });
/** One input to one validator replica (og applyEntityInput); `ctx.signerId` must name this replica. */
export const applyEntityInput = (r: EntityReplica, input: EntityInput, ctx: EntityContext): Result<EntityApply, EntityError> => {
  if (ctx.self !== r.state.id) return err({ _tag: "wrong_entity" });
  if (signerId(ctx.signerId) !== signerId(r.signerId)) return err({ _tag: "wrong_replica", address: ctx.signerId });
  return matchBy("kind", input, { txs: (i) => applyTxs(r, i, ctx), proposal: (i) => applyProposal(r, i, ctx), precommit: (i) => applyPrecommit(r, i, ctx) });
};

/** og `eReplicas`: one replica per `entityId:signerId` (signer lowercased). */
export type Runtime = { readonly entities: ReadonlyMap<string, EntityReplica> };
type RuntimeBase = { readonly entityId: EntityId; readonly signerId: Address; readonly input: EntityInput };
export type RuntimeInput = (RuntimeBase & { readonly kind: "create" }) | (RuntimeBase & { readonly kind: "receive"; readonly from: EntityId });
export type RuntimeError = EntityError | Tagged<"no_such_entity", { id: EntityId }>;
export type Verifiers = { readonly verify: Verify; readonly verifyMember: MemberVerify; readonly sign: MemberSign };
export const replicaKey = (entity: EntityId, signer: string): string => `${entity}:${signerId(signer)}`;
export const createRuntime = (): Runtime => ({ entities: new Map() });
export const spawn = (rt: Runtime, r: EntityReplica): Runtime => ({ entities: mapSet(rt.entities, replicaKey(r.state.id, r.signerId), r) });
/** og resolveEntityProposerId: an Account message goes to the receiver's leader `validators[0]`; a consensus input to the named validator. */
export const convertOutput = (rt: Runtime, item: EntityOutput, from: EntityId, timestamp: bigint): Result<RuntimeInput, RuntimeError> => {
  if ("input" in item) return ok({ kind: "create", entityId: item.to, signerId: item.signerId, input: item.input });
  const receiver = [...rt.entities.values()].find((r) => r.state.id === item.to);
  return receiver === undefined ? err({ _tag: "no_such_entity", id: item.to }) : ok({ kind: "receive", entityId: item.to, from, signerId: allowedProposer(receiver.state.quorum), input: { kind: "txs", timestamp, txs: [item.tx] } });
};
export const applyRuntime = (rt: Runtime, inputs: readonly RuntimeInput[], verifiers: Verifiers): { runtime: Runtime; outbox: readonly EntityOutput[]; rejected: readonly RuntimeError[] } => {
  type Out = { readonly outputs: readonly EntityOutput[]; readonly rejected: readonly RuntimeError[] };
  const refused = (error: RuntimeError): StoreStep<string, EntityReplica, Out> => ({ writes: [], out: { outputs: [], rejected: [error] }, stop: false });
  const { store, outs } = foldStore(rt.entities, inputs, (read, input): StoreStep<string, EntityReplica, Out> => {
    const key = replicaKey(input.entityId, input.signerId), r = read(key);
    if (r === undefined) return refused({ _tag: "no_such_entity", id: input.entityId });
    const applied = applyEntityInput(r, input.input, { self: input.entityId, signerId: input.signerId, ...verifiers, from: matchBy("kind", input, { create: () => undefined, receive: (i) => i.from }) });
    return applied.ok ? { writes: [[key, applied.value.replica]], out: { outputs: applied.value.outputs, rejected: [] }, stop: false } : refused(applied.error);
  });
  return { runtime: { entities: store }, outbox: outs.flatMap((o) => o.outputs), rejected: outs.flatMap((o) => o.rejected) };
};


export type OfferStatus = "open" | "matched" | "cancelled" | "closed";
export type LoanStatus = "active" | "repaid" | "defaulted" | "cancelled";
export type LendingOffer = { readonly id: string; readonly lenderAccountId: string; readonly assetId: TokenId; readonly principal: bigint; readonly termSeconds: bigint; readonly annualRatePpm: bigint; readonly status: OfferStatus };
export type LoanPosition = { readonly id: string; readonly borrowerAccountId: string; readonly lenderAccountId?: string | undefined; readonly hubEntityId: string; readonly assetId: TokenId; readonly principal: bigint; readonly interestDue: bigint; readonly openedAt: bigint; readonly maturesAt: bigint; readonly status: LoanStatus };
export type LendingPool = { readonly assetId: TokenId; readonly jurisdictionId: string; readonly availablePrincipal: bigint; readonly lentPrincipal: bigint; readonly borrowedPrincipal: bigint; readonly accruedInterest: bigint; readonly offers: ReadonlyMap<string, LendingOffer>; readonly loans: ReadonlyMap<string, LoanPosition> };
export type LendingTx =
  | { readonly type: "lending_fund"; readonly id: string; readonly lenderAccountId: string; readonly principal: bigint; readonly termSeconds: bigint; readonly annualRatePpm: bigint }
  | { readonly type: "lending_borrow_request"; readonly offerId: string; readonly loanId: string; readonly borrowerAccountId: string; readonly hubEntityId: string }
  | { readonly type: "lending_repay"; readonly loanId: string } | { readonly type: "lending_close_request"; readonly id: string };
export type JOp =
  | { readonly type: "r2r"; readonly toEntity: EntityId; readonly tokenId: TokenId; readonly amount: bigint }
  | { readonly type: "r2c"; readonly counterparty: EntityId; readonly tokenId: TokenId; readonly amount: bigint }
  | { readonly type: "c2r"; readonly counterparty: EntityId; readonly tokenId: TokenId; readonly amount: bigint }
  | { readonly type: "et2r"; readonly tokenAddress: string; readonly amount: bigint; readonly internalTokenId: TokenId }
  | { readonly type: "r2et"; readonly recipient: EntityId; readonly tokenId: TokenId; readonly amount: bigint };
export type JState = { readonly reserves: ReadonlyMap<EntityId, ReadonlyMap<TokenId, bigint>>; readonly escrow: ReadonlyMap<string, ReadonlyMap<TokenId, bigint>> };
export type LadderTx = { readonly type: "ladder_reveal"; readonly revealer: EntityId; readonly counter: EntityId; readonly ladderHash: Hash; readonly targetRole: boolean; readonly fillRatio: number; readonly revealedAt: bigint };
export type EntityRouteTx =
  | { readonly type: "directPayment"; readonly recipient: EntityId; readonly tokenId: TokenId; readonly amount: bigint; readonly description?: string | undefined; readonly invoiceId?: string | undefined }
  | ({ readonly type: "placeSwapOffer" } & SwapOfferTerms)
  | { readonly type: "htlcPayment"; readonly route: readonly EntityId[]; readonly finalRecipient: EntityId; readonly tokenId: TokenId; readonly amount: bigint; readonly description?: string | undefined }
  | { readonly type: "prepareCrossJurisdictionSwap" }
  | { readonly type: "registerCrossJurisdictionSwap" };
export type HostInput = { readonly kind: "dispute" | "board_hanko_refresh" | "leaderTimeoutVote" };
export type HostCtx = { readonly timestamp: bigint; readonly jHeight: bigint; readonly from?: EntityId | undefined };
export type HostEffect = Effect | Tagged<"start_dispute", { start: DisputeStart }> | Tagged<"send", { message: AccountMessage }>;
export type OutboxEntry = { readonly id: Hash; readonly effect: HostEffect };
export type HostTx =
  | { readonly layer: "account"; readonly tx: WireAccountTx } | { readonly layer: "frame"; readonly input: AccountInput } | { readonly layer: "pool"; readonly tx: LendingTx } | { readonly layer: "j"; readonly tx: JOp }
  | { readonly layer: "ladder"; readonly tx: LadderTx } | { readonly layer: "entity"; readonly tx: EntityRouteTx } | { readonly layer: "input"; readonly input: HostInput } | { readonly layer: "receipt"; readonly id: Hash };
export type Host = { readonly self: EntityId; readonly account: AccountReplica; readonly pool: LendingPool; readonly j: JState; readonly ladder: ReadonlyMap<string, RatioRecord>; readonly height: bigint; readonly frameHash: RuntimeFrameHash; readonly outbox: readonly OutboxEntry[] };
export type Stamped = { readonly tx: HostTx; readonly ctx: HostCtx };
export type RuntimeFrameRecord = { readonly protocolVersion: number; readonly height: bigint; readonly timestamp: bigint; readonly previousFrameHash: RuntimeFrameHash; readonly previousHostRoot: HostRoot; readonly inputRefs: readonly Stamped[]; readonly postHostRoot: HostRoot; readonly outboxRefs: readonly Hash[] };
export type RecoverFrame = { readonly record: RuntimeFrameRecord; readonly inputs: readonly Stamped[] };
export type Commit = { readonly frame: RecoverFrame; readonly host: Host; readonly effects: readonly OutboxEntry[] };
export type HostError = BodyError | Tagged<"unsigned" | "chain" | "root" | "version" | "reserve" | "status" | "recipient"> | Tagged<"candidate", { cause: AccountReplicaError }>;
export type HostStep = Step<Host, HostEffect>;
export const PROTOCOL_VERSION = 2;
export const emptyPool = (assetId: TokenId, jurisdictionId: string): LendingPool => ({ assetId, jurisdictionId, availablePrincipal: 0n, lentPrincipal: 0n, borrowedPrincipal: 0n, accruedInterest: 0n, offers: new Map(), loans: new Map() });
export const genesisHost = (self: EntityId, account: AccountReplica, pool: LendingPool): Result<Host, AccountReplicaError> =>
  map(partyOf(replicaId(account), self), () => ({ self, account, pool, j: { reserves: new Map(), escrow: new Map() }, ladder: new Map(), height: 0n, frameHash: ZERO_HASH as RuntimeFrameHash, outbox: [] }));
type Balances<K> = ReadonlyMap<K, ReadonlyMap<TokenId, bigint>>;
const shiftBalance = <K>(outer: Balances<K>, key: K, tk: TokenId, delta: bigint): Result<Balances<K>, HostError> => {
  const row = outer.get(key) ?? new Map<TokenId, bigint>();
  if ((row.get(tk) ?? 0n) + delta < 0n) return err({ _tag: "reserve" });
  const inner = bump(row, tk, delta);
  return ok(inner.size === 0 ? mapDelete(outer, key) : mapSet(outer, key, inner));
};
const escrowKey = (entity: EntityId, counterparty: EntityId): string => `${entity}|${counterparty}`;
export const applyJ = (j: JState, op: JOp, self: EntityId): Result<JState, HostError> => {
  if (op.amount <= 0n) return err({ _tag: "non_positive_payment" });
  const reserve = (key: EntityId, tk: TokenId, by: bigint) => (s: JState): Result<JState, HostError> => map(shiftBalance(s.reserves, key, tk, by), (reserves) => ({ ...s, reserves }));
  const escrow = (counterparty: EntityId, tk: TokenId, by: bigint) => (s: JState): Result<JState, HostError> => map(shiftBalance(s.escrow, escrowKey(self, counterparty), tk, by), (escrow) => ({ ...s, escrow }));
  const via = (...steps: readonly ((s: JState) => Result<JState, HostError>)[]): Result<JState, HostError> => foldResult(steps, j, (s, f) => f(s));
  return matchBy("type", op, {
    r2r: (x) => via(reserve(self, x.tokenId, -x.amount), reserve(x.toEntity, x.tokenId, x.amount)),
    r2c: (x) => via(reserve(self, x.tokenId, -x.amount), escrow(x.counterparty, x.tokenId, x.amount)),
    c2r: (x) => via(escrow(x.counterparty, x.tokenId, -x.amount), reserve(self, x.tokenId, x.amount)),
    et2r: (x) => via(reserve(self, x.internalTokenId, x.amount)),
    r2et: (x) => via(reserve(self, x.tokenId, -x.amount)),
  });
};
const closeLoan = (pool: LendingPool, loan: LoanPosition, status: LoanStatus): LendingPool => ({
  ...pool, availablePrincipal: pool.availablePrincipal + loan.principal, lentPrincipal: pool.lentPrincipal - loan.principal, borrowedPrincipal: pool.borrowedPrincipal - loan.principal, loans: mapSet(pool.loans, loan.id, { ...loan, status }),
});
export const applyLending = (pool: LendingPool, tx: LendingTx, ctx: HostCtx): Result<LendingPool, HostError> => {
  const nowS = ctx.timestamp / 1000n;
  return matchBy("type", tx, {
    lending_fund: (x) => {
      if (x.principal <= 0n || x.termSeconds <= 0n || x.annualRatePpm < 0n) return err({ _tag: "non_positive_payment" });
      if (pool.offers.has(x.id)) return err({ _tag: "duplicate" });
      const offer: LendingOffer = { id: x.id, lenderAccountId: x.lenderAccountId, assetId: pool.assetId, principal: x.principal, termSeconds: x.termSeconds, annualRatePpm: x.annualRatePpm, status: "open" };
      return ok({ ...pool, availablePrincipal: pool.availablePrincipal + x.principal, offers: mapSet(pool.offers, x.id, offer) });
    },
    lending_borrow_request: (x) => {
      const open = pool.offers.get(x.offerId);
      if (open === undefined || open.status !== "open") return err({ _tag: "missing" });
      if (pool.loans.has(x.loanId)) return err({ _tag: "duplicate" });
      if (pool.availablePrincipal < open.principal) return err({ _tag: "insufficient_capacity", available: pool.availablePrincipal, requested: open.principal });
      const loan: LoanPosition = { id: x.loanId, borrowerAccountId: x.borrowerAccountId, lenderAccountId: open.lenderAccountId, hubEntityId: x.hubEntityId, assetId: pool.assetId, principal: open.principal, interestDue: 0n, openedAt: nowS, maturesAt: nowS + open.termSeconds, status: "active" };
      return ok({ ...pool, availablePrincipal: pool.availablePrincipal - open.principal, lentPrincipal: pool.lentPrincipal + open.principal, borrowedPrincipal: pool.borrowedPrincipal + open.principal, offers: mapSet(pool.offers, open.id, { ...open, status: "matched" }), loans: mapSet(pool.loans, loan.id, loan) });
    },
    lending_repay: (x) => { const loan = pool.loans.get(x.loanId); return loan === undefined || loan.status !== "active" ? err({ _tag: "missing" }) : ok(closeLoan(pool, loan, "repaid")); },
    lending_close_request: (x) => {
      const open = pool.offers.get(x.id);
      if (open !== undefined && open.status === "open") return ok({ ...pool, availablePrincipal: pool.availablePrincipal - open.principal, offers: mapSet(pool.offers, open.id, { ...open, status: "cancelled" }) });
      const loan = pool.loans.get(x.id);
      return loan === undefined || loan.status !== "active" ? err({ _tag: "status" }) : ok(closeLoan(pool, loan, "cancelled"));
    },
  });
};
const ladderKey = (tx: LadderTx): string => `${tx.revealer}|${tx.counter}|${tx.ladderHash}|${tx.targetRole ? "t" : "s"}`;
const admitTx = (host: Host, tx: WireAccountTx, ctx: HostCtx): Result<HostStep, AccountReplicaError> => map(admitAt(host.account, [tx], host.self, { timestamp: ctx.timestamp, jHeight: ctx.jHeight }), (account) => step({ ...host, account }));
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
  account: (i) => admitTx(host, i.tx, ctx),
  frame: (i) => {
    const delivery: Delivery = ctx.from === undefined ? { _tag: "local" } : { _tag: "received", from: ctx.from }, door: DoorContext = { verify, self: host.self, now: ctx.timestamp };
    return accountStep(host, disputeUnsafe(host.account, applyDelivered(host.account, i.input, delivery, door), door));
  },
  pool: (i) => map(applyLending(host.pool, i.tx, ctx), (pool) => step({ ...host, pool })),
  j: (i) => map(applyJ(host.j, i.tx, host.self), (j) => step({ ...host, j })),
  ladder: (i) => { const key = ladderKey(i.tx); return map(revealSlot(host.ladder.get(key), i.tx), (slot) => step({ ...host, ladder: mapSet(host.ladder, key, slot) })); },
  entity: (i) => chain(routeEntity(i.tx, host.self, replicaId(host.account)), (routed) => admitTx(host, routed, ctx)),
  input: (i) => matchBy("kind", i.input, {
    dispute: () => accountStep(host, applyAccountInput(host.account, { kind: "freeze" }, { verify, self: host.self, now: ctx.timestamp })),
    board_hanko_refresh: () => err({ _tag: "unchosen", hole: "board_hanko_refresh" }), leaderTimeoutVote: () => err({ _tag: "unchosen", hole: "leader_timeout_vote" }),
  }),

  receipt: (i) => ok(step({ ...host, outbox: host.outbox.filter((e) => e.id !== i.id) })),
});
type DisputeRecord = { readonly phase: "preparing"; readonly evidence: FrameEvidence | undefined; readonly unready: StartRefusal } | { readonly phase: "disputed"; readonly evidence: FrameEvidence | undefined; readonly start: DisputeStart };
const disputeRecord = (a: AccountReplica): DisputeRecord | undefined => match(a, {
  open: () => undefined, proposed: () => undefined, received: () => undefined,
  preparing: ({ evidence, unready }) => ({ phase: "preparing", evidence, unready }), disputed: ({ evidence, start }) => ({ phase: "disputed", evidence, start }),
});
export const hostRoot = (h: Host): HostRoot => keccakUtf8(canon({ account: accountSnapshot(h.account.state), dispute: disputeRecord(h.account), pool: h.pool, j: h.j, ladder: h.ladder, outbox: h.outbox.map((e) => e.id) })) as HostRoot;
export const hashFrame = (record: RuntimeFrameRecord): RuntimeFrameHash => keccakUtf8(canon(record)) as RuntimeFrameHash;
const foldStamped = strictFold<Host, Stamped, Verify, HostEffect, AccountReplicaError | HostError>((h, stamped, verify) => applyHost(h, stamped.tx, stamped.ctx, verify));
const outputId = (height: bigint, ordinal: number, effect: HostEffect): Hash => keccakUtf8(canon({ height, ordinal, effect }));
const messageOf = (e: HostEffect): AccountMessage | null => match(e, { send: (x) => x.message, forward_secret: () => null, start_dispute: () => null });
/** An ACK already riding on an ack_frame in the same batch is not sent again on its own. */
const carriedOnce = (effects: readonly HostEffect[]): readonly HostEffect[] => {
  const carried = new Set(effects.flatMap((e) => { const m = messageOf(e); return m === null ? [] : matchBy("kind", m, { ack: () => [], ack_frame: (f) => (f.ack === null ? [] : [canon(f.ack)]) }); }));
  return effects.filter((e) => { const m = messageOf(e); return m === null ? true : matchBy("kind", m, { ack: (a) => !carried.has(canon(ackOf(a))), ack_frame: () => true }); });
};
type Advanced = { readonly record: RuntimeFrameRecord; readonly host: Host; readonly created: readonly OutboxEntry[] };
const advance = (host: Host, previousHostRoot: HostRoot, inputs: readonly Stamped[], timestamp: bigint, verify: Verify): Result<Advanced, AccountReplicaError | HostError> => map(foldStamped(host, inputs, verify), (folded) => {
  const height = host.height + 1n, created = carriedOnce(folded.effects).map((effect, ordinal) => ({ id: outputId(height, ordinal, effect), effect }));
  const after: Host = { ...folded.state, height, outbox: [...folded.state.outbox, ...created] };
  const record: RuntimeFrameRecord = { protocolVersion: PROTOCOL_VERSION, height, timestamp, previousFrameHash: host.frameHash, previousHostRoot, inputRefs: inputs, postHostRoot: hostRoot(after), outboxRefs: created.map((e) => e.id) };
  return { record, host: { ...after, frameHash: hashFrame(record) }, created };
});
export const commitFrame = (host: Host, inputs: readonly Stamped[], nowMs: bigint, verify: Verify): Result<Commit, AccountReplicaError | HostError> =>
  map(advance(host, hostRoot(host), inputs, nowMs, verify), (next) => ({ frame: { record: next.record, inputs }, host: next.host, effects: next.created }));
export type Recovery = { readonly host: Host; readonly pending: readonly OutboxEntry[]; readonly effects: readonly OutboxEntry[] };
export const recover = (graph: Host, frames: readonly RecoverFrame[], outbox: readonly OutboxEntry[], verify: Verify): Result<Recovery, AccountReplicaError | HostError> => {
  if (frames.some((f) => f.record.protocolVersion !== PROTOCOL_VERSION)) return err({ _tag: "version" });
  return chain(mapErr(restoreAccount(graph.account, graph.self, verify), (cause): HostError => ({ _tag: "candidate", cause })), (account) => {
    const start: Host = { ...graph, account };
    type HostReplayed = { readonly host: Host; readonly root: HostRoot; readonly effects: readonly OutboxEntry[] };
    return chain(foldResult(frames, { host: start, root: hostRoot(start), effects: [] } as HostReplayed, ({ host, root, effects }, frame): Result<HostReplayed, AccountReplicaError | HostError> => {
      const r = frame.record;
      if (r.previousFrameHash !== host.frameHash || r.height !== host.height + 1n || r.previousHostRoot !== root || canon(frame.inputs) !== canon(r.inputRefs)) return err({ _tag: "chain" });
      return chain(advance(host, root, frame.inputs, r.timestamp, verify), (next) => (hashFrame(next.record) === hashFrame(r) && canon(next.record.outboxRefs) === canon(r.outboxRefs) ? ok({ host: next.host, root: r.postHostRoot, effects: [...effects, ...next.created] }) : err({ _tag: "root" })));
    }), ({ host, effects }) => {
      /** og outbox-payload.ts: rows are ordered `(height, index)`; order is part of the digest, never a multiset. */
      return canon(outbox) !== canon(host.outbox) ? err({ _tag: "chain" }) : ok({ host, pending: host.outbox, effects });
    });
  });
};

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
