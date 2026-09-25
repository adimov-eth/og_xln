

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
  dispute: { open: ["preparing", "disputed"], proposed: ["preparing", "disputed"], received: ["preparing", "disputed"], preparing: ["preparing", "disputed"], disputed: ["disputed"] },
} as const;
export const EntityTransition = { txs: { open: ["proposed"] }, precommit: { proposed: ["open", "proposed"] } } as const;


export const AccountTxNames = ["add_delta", "set_credit_limit", "payment", "htlc_lock", "htlc_resolve", "htlc_timeout", "swap_offer", "swap_cancel", "swap_resolve", "settle_transition",
  "j_event_claim", "cross_pull_lock", "cross_pull_close", "deposit_to_custody", "withdraw_from_custody", "hub_custody_debit", "set_rebalance_policy", "rebalance_request",
  "rebalance_quote", "rebalance_accept", "deposit_collateral", "subcontract_propose", "subcontract_approve", "subcontract_reject", "subcontract_resolve_propose", "subcontract_resolve_approve"] as const;
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
    ["commitments", { locksRoot: root("locks"), pullsRoot: root("pulls"), swapOffersRoot: root("swapOffers"), subcontractsRoot: root("subcontracts"), lendingIntentsRoot: root("lendingIntents") }],
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
export const MAX_PAYMENT_AMOUNT = (1n << 128n) - 1n;
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
/** Unchecked move: releases of prior holds (htlc resolve, swap give, subcontract effects). */
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
  | Tagged<"not_hub" | "quote_expired" | "quote_mismatch" | "no_policy" | "policy_bound" | "no_quote" | "duplicate" | "missing" | "not_maker" | "expired_offer" | "below_min_fill" | "before_deadline" | "preimage" | "pending_full" | "not_counterparty" | "bad_allowance" | "index" | "too_many_rows">
  | Tagged<"token_id", { tokenId: string }>
  | Tagged<"unchosen", { hole: Hole }>;
export type FoldCtx = { readonly byLeft: boolean; readonly nowMs: bigint; readonly jHeight: bigint; readonly accountHeight: bigint };
export type HubSide = "left" | "right" | null;
export type Effect = Tagged<"forward_secret", { hashlock: Hash; secret: string }> | Tagged<"queue_r2c", { tokenId: TokenId; amount: bigint }>;
const QUOTE_WINDOW_MS = 300_000n, MAX_PENDING = 16, MAX_ROWS = 128;
export type HtlcLock = { readonly lockId: string; readonly hashlock: Hash; readonly timelock: bigint; readonly revealBeforeHeight: bigint; readonly amount: bigint; readonly tokenId: TokenId; readonly senderIsLeft: boolean; readonly createdHeight: bigint; readonly createdTimestamp: bigint; readonly encryptedPackage?: string | undefined };
export type SwapOffer = { readonly offerId: string; readonly giveTokenId: TokenId; readonly giveAmount: bigint; readonly wantTokenId: TokenId; readonly wantAmount: bigint; readonly minFillRatio: number; readonly expiresAtHeight: bigint; readonly makerIsLeft: boolean };
export type RebalancePolicy = { readonly softLimit: bigint; readonly hardLimit: bigint; readonly maxAcceptableFee: bigint };
export type RebalanceQuote = { readonly quoteId: bigint; readonly tokenId: TokenId; readonly amount: bigint; readonly feeTokenId: TokenId; readonly feeAmount: bigint; readonly accepted: boolean };
export type Allowance = { readonly deltaIndex: number; readonly leftAllowance: bigint; readonly rightAllowance: bigint };
export type ClauseBody = { readonly transformerAddress: string; readonly encodedBatch: string; readonly allowances: readonly Allowance[]; readonly initcode: string; readonly codeHash: Hash; readonly solcMeta: string; readonly sourceHash: Hash; readonly expiresAt?: bigint | undefined };
export type Clause = ClauseBody & { readonly proposerIsLeft: boolean };
export type ClauseId = string;
export type DeltaEffect = { readonly tokenId: TokenId; readonly offdelta: bigint };
export type Resolution = { readonly args: string; readonly effects: readonly DeltaEffect[]; readonly proposerIsLeft: boolean };
export type ClauseState = Tagged<"pending" | "live", { clause: Clause }> | Tagged<"resolving", { clause: Clause; resolution: Resolution }>;
export type CustodyDebit = { readonly tokenId: TokenId; readonly amount: bigint; readonly reason: string; readonly referenceId?: string | undefined };
export type JObservation = { readonly jHeight: bigint; readonly jBlockHash: Hash; readonly events: readonly AccountSettlement[]; readonly observedAt: bigint };
export type JClaimProof = { readonly version: 1; readonly nodes: readonly [] };
export type ClaimRow = { readonly onLeft: boolean; readonly jHeight: bigint; readonly jBlockHash: string; readonly eventsHash: string };
export type AccountBody = {
  readonly account: AccountState; readonly terms: AccountTerms; readonly hub: HubSide; readonly custody: ReadonlyMap<TokenId, bigint>; readonly locks: ReadonlyMap<string, HtlcLock>;
  readonly offers: ReadonlyMap<string, SwapOffer>; readonly policy: ReadonlyMap<TokenId, RebalancePolicy>; readonly clauses: ReadonlyMap<ClauseId, ClauseState>; readonly debits: readonly CustodyDebit[];
  readonly quote?: RebalanceQuote | undefined; readonly request?: { readonly tokenId: TokenId; readonly targetAmount: bigint } | undefined; readonly leftJ?: JObservation | undefined; readonly rightJ?: JObservation | undefined; readonly claimRows?: readonly ClaimRow[] | undefined; readonly finalizedJHeight: bigint;
  readonly settlement?: { readonly revision: number; readonly workspaceHash: string; readonly settlementHash: string } | undefined;
};
export type AccountStep<E extends Effect = Effect> = Step<AccountBody, E>;
type BodyStep<E extends Effect = never> = Result<AccountStep<E>, BodyError>;
export type DepositFee = Tagged<"none"> | Tagged<"quote", { quoteId: bigint; tokenId: TokenId; amount: bigint }>;
export type AccountTx =
  | { readonly type: "add_delta"; readonly tokenId: TokenId }
  | { readonly type: "set_credit_limit"; readonly tokenId: TokenId; readonly limit: bigint }
  | { readonly type: "payment"; readonly tokenId: TokenId; readonly amount: bigint }
  | { readonly type: "htlc_lock"; readonly lockId: string; readonly hashlock: Hash; readonly timelock: bigint; readonly revealBeforeHeight: bigint; readonly amount: bigint; readonly tokenId: TokenId; readonly encryptedPackage?: string | undefined }
  | { readonly type: "htlc_resolve"; readonly lockId: string; readonly secret: string }
  | { readonly type: "htlc_timeout"; readonly lockId: string }
  | { readonly type: "swap_offer"; readonly offerId: string; readonly giveTokenId: TokenId; readonly giveAmount: bigint; readonly wantTokenId: TokenId; readonly wantAmount: bigint; readonly minFillRatio: number; readonly expiresAtHeight: bigint }
  | { readonly type: "swap_cancel"; readonly offerId: string }
  | { readonly type: "swap_resolve"; readonly offerId: string; readonly fillRatio: number; readonly cancelRemainder: boolean }
  | { readonly type: "deposit_to_custody"; readonly tokenId: TokenId; readonly amount: bigint }
  | { readonly type: "withdraw_from_custody"; readonly tokenId: TokenId; readonly amount: bigint }
  | { readonly type: "hub_custody_debit"; readonly tokenId: TokenId; readonly amount: bigint; readonly reason: string; readonly referenceId?: string | undefined }
  | { readonly type: "set_rebalance_policy"; readonly tokenId: TokenId; readonly softLimit: bigint; readonly hardLimit: bigint; readonly maxAcceptableFee: bigint }
  | { readonly type: "rebalance_request"; readonly tokenId: TokenId; readonly targetAmount: bigint }
  | { readonly type: "rebalance_quote"; readonly tokenId: TokenId; readonly amount: bigint; readonly feeTokenId: TokenId; readonly feeAmount: bigint }
  | { readonly type: "rebalance_accept"; readonly quoteId: bigint }
  | { readonly type: "deposit_collateral"; readonly tokenId: TokenId; readonly amount: bigint; readonly fee: DepositFee }
  | { readonly type: "subcontract_propose"; readonly id: string; readonly clause: ClauseBody }
  | { readonly type: "subcontract_approve"; readonly id: string }
  | { readonly type: "subcontract_reject"; readonly id: string }
  | { readonly type: "subcontract_resolve_approve"; readonly id: string }
  | { readonly type: "subcontract_resolve_propose"; readonly id: string; readonly args: string; readonly effects: readonly DeltaEffect[] }
  | { readonly type: "cross_pull_lock" }
  | { readonly type: "cross_pull_close"; readonly orderId: string; readonly amount: bigint; readonly ratio: number; readonly proofRatio: number; readonly leg: bigint; readonly binaryHash: Hash; readonly hubAuthored: boolean }
  | { readonly type: "j_event_claim"; readonly jHeight: bigint; readonly jBlockHash: Hash; readonly events: readonly AccountSettlement[]; readonly observedAt: bigint; readonly leftProof?: JClaimProof | undefined; readonly rightProof?: JClaimProof | undefined }
  | { readonly type: "settle_transition"; readonly kind: "hanko"; readonly revision: number; readonly workspaceHash: string; readonly settlementNonce: number; readonly settlementHash: string; readonly settlementHanko: string; readonly postProof: { readonly nonce: number; readonly proposerIsLeft: boolean; readonly proofBodyHash: string; readonly disputeHash: string; readonly hanko: string } };
export type TxOf<K extends AccountTx["type"]> = Extract<AccountTx, { readonly type: K }>;
type DepositWire = { readonly type: "deposit_collateral"; readonly tokenId: TokenId; readonly amount: bigint; readonly rebalanceQuoteId?: bigint | undefined; readonly rebalanceFeeTokenId?: TokenId | undefined; readonly rebalanceFeeAmount?: bigint | undefined; readonly fee?: undefined };
export type WireAccountTx = AccountTx | DepositWire;
type WireTxOf<K extends AccountTx["type"]> = Extract<WireAccountTx, { readonly type: K }>;
const depositTx = (tx: TxOf<"deposit_collateral"> | DepositWire): Result<TxOf<"deposit_collateral">, BodyError> => {
  if (tx.fee !== undefined) return ok(tx);
  const { rebalanceQuoteId: quoteId, rebalanceFeeTokenId: tokenId, rebalanceFeeAmount: amount } = tx;
  const fee: Result<DepositFee, BodyError> = quoteId === undefined ? ok({ _tag: "none" }) : tokenId === undefined || amount === undefined ? err({ _tag: "quote_mismatch" }) : ok({ _tag: "quote", quoteId, tokenId, amount });
  return map(fee, (f) => ({ type: tx.type, tokenId: tx.tokenId, amount: tx.amount, fee: f }));
};
const depositWire = (tx: TxOf<"deposit_collateral"> | DepositWire): DepositWire => {
  if (tx.fee === undefined) return tx;
  const { fee, ...rest } = tx;
  return match(fee, { none: () => rest, quote: (q) => ({ ...rest, rebalanceQuoteId: q.quoteId, rebalanceFeeTokenId: q.tokenId, rebalanceFeeAmount: q.amount }) });
};
const same = <X>(x: X): X => x;
export const wireOf = (tx: WireAccountTx): WireAccountTx => matchBy<"type", WireAccountTx, WireAccountTx>("type", tx, { ...total(AccountTxNames, same), deposit_collateral: depositWire });
type Author = "bilateral" | "hub" | "unchosen";
export type KindRow = { readonly author: Author; readonly l0: boolean; readonly repeatable: boolean; readonly effects: readonly Effect["_tag"][] };
const kind = <R extends KindRow>(author: Author, l0: boolean, repeatable: boolean, effects: readonly Effect["_tag"][] = []): R => ({ author, l0, repeatable, effects }) as R;
export const AccountKinds = {
  add_delta: kind("bilateral", true, false), set_credit_limit: kind("bilateral", true, false), payment: kind("bilateral", true, true),
  htlc_lock: kind("bilateral", false, false), htlc_resolve: kind("bilateral", false, false, ["forward_secret"]), htlc_timeout: kind("bilateral", false, false),
  swap_offer: kind("bilateral", false, false), swap_cancel: kind("bilateral", false, false), swap_resolve: kind("hub", false, false),
  settle_transition: kind("bilateral", false, false),
  deposit_to_custody: kind("bilateral", false, false), withdraw_from_custody: kind("bilateral", false, false), hub_custody_debit: kind("hub", false, false),
  set_rebalance_policy: kind("bilateral", false, false), rebalance_request: kind("bilateral", false, false), rebalance_quote: kind("bilateral", false, false), rebalance_accept: kind("bilateral", false, false),
  deposit_collateral: kind("bilateral", false, false, ["queue_r2c"]), subcontract_propose: kind("bilateral", false, false), subcontract_approve: kind("bilateral", false, false), subcontract_reject: kind("bilateral", false, false),
  subcontract_resolve_propose: kind("bilateral", false, false), subcontract_resolve_approve: kind("bilateral", false, false), cross_pull_lock: kind("unchosen", false, false), cross_pull_close: kind("unchosen", false, false),
  j_event_claim: kind("bilateral", false, false),
} as const satisfies Kinds<AccountTx["type"], KindRow>;
export type L0Tx = TxOf<"add_delta" | "set_credit_limit" | "payment">;
export type EffectOf<K extends AccountTx["type"]> = K extends "htlc_resolve" ? Of<Effect, "forward_secret"> : K extends "deposit_collateral" ? Of<Effect, "queue_r2c"> : never;
export const isL0Tx = (tx: WireAccountTx): tx is L0Tx => arm(AccountKinds, tx.type).l0;
export const genesisAccountBody = (account: AccountState, terms: AccountTerms, hub: HubSide = null): AccountBody => ({ account, terms, hub, custody: new Map(), locks: new Map(), offers: new Map(), policy: new Map(), clauses: new Map(), debits: [], finalizedJHeight: 0n });
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
  chain(positive(amount), () => chain(offdeltaChange(byLeft, amount), (by) => map(updateDelta(a.account, tk, (d) => move(d, by, holds(a, tk, byLeft))), (s) => putState(a, s))));
const shifted = (a: AccountBody, tk: TokenId, by: bigint): AccountBody => putState(a, setDelta(a.account, shift(getDelta(a.account, tk), by)));
const custodyOf = (a: AccountBody, tk: TokenId): bigint => a.custody.get(tk) ?? 0n;
const fromCustody = (a: AccountBody, tk: TokenId, amount: bigint): Result<void, BodyError> => {
  const have = custodyOf(a, tk);
  return chain(positive(amount), () => guard(amount <= have, { _tag: "above_custody", have, requested: amount }));
};
const quoteWindow = (q: RebalanceQuote, nowMs: bigint): Result<void, BodyError> => {
  const expiry = q.quoteId + QUOTE_WINDOW_MS;
  return nowMs > expiry ? err({ _tag: "quote_expired" }) : nowMs === expiry ? err({ _tag: "unchosen", hole: "quote_last_ms" }) : ok(undefined);
};
const MISSING: Result<never, BodyError> = err({ _tag: "missing" });
const isPending = (s: ClauseState): boolean => match(s, { pending: () => true, live: () => false, resolving: () => false });
const byCounterparty = <X>(x: X, proposerIsLeft: boolean, byLeft: boolean): Result<X, BodyError> => (byLeft === proposerIsLeft ? err({ _tag: "not_counterparty" }) : ok(x));
const pendingOf = (a: AccountBody, id: ClauseId, byLeft: boolean): Result<Clause, BodyError> => {
  const s = a.clauses.get(id);
  return s === undefined ? MISSING : match<ClauseState, Result<Clause, BodyError>>(s, { pending: ({ clause }) => byCounterparty(clause, clause.proposerIsLeft, byLeft), live: () => MISSING, resolving: () => MISSING });
};
const resolutionOf = (a: AccountBody, id: ClauseId, byLeft: boolean): Result<Resolution, BodyError> => {
  const s = a.clauses.get(id);
  return s === undefined ? MISSING : match<ClauseState, Result<Resolution, BodyError>>(s, { pending: () => MISSING, live: () => MISSING, resolving: ({ resolution }) => byCounterparty(resolution, resolution.proposerIsLeft, byLeft) });
};
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
const rememberClaim = (rows: readonly ClaimRow[] | undefined, row: ClaimRow): Result<readonly ClaimRow[], ClaimError> => {
  const held = rows ?? [], prior = held.find((r) => r.onLeft === row.onLeft && r.jHeight === row.jHeight);
  return prior === undefined ? ok([...held, row]) : prior.jBlockHash === row.jBlockHash && prior.eventsHash === row.eventsHash ? ok(held) : err({ _tag: "claim_conflict" });
};
const claimJ = (a: AccountBody, tx: TxOf<"j_event_claim">, ctx: FoldCtx): BodyStep => chain(claimRowOf(tx, ctx.byLeft), (row) => chain(rememberClaim(a.claimRows, row), (claimRows) => {
  const obs: JObservation = { jHeight: tx.jHeight, jBlockHash: tx.jBlockHash, events: tx.events, observedAt: tx.observedAt };
  const stored: AccountBody = { ...(ctx.byLeft ? { ...a, leftJ: obs } : { ...a, rightJ: obs }), claimRows }, seen = at(a.leftJ, a.rightJ, other(ctx.byLeft));
  if (seen === undefined || seen.jHeight !== obs.jHeight || seen.jBlockHash !== obs.jBlockHash || canon(seen.events) !== canon(obs.events)) return ok(step(stored));
  const kept = claimRows.filter((r) => r.jHeight > obs.jHeight);
  const tokens = obs.events.filter((entry) => sameAccount(entry, stored.account.id)).flatMap((entry) => entry.tokens);
  return map(foldResult(tokens, stored.account, (s, tk): Result<AccountState, BodyError> => map(mapErr(tokenId(tk.tokenId.toString()), (): BodyError => ({ _tag: "index" })), (id) => setDelta(s, settle(getDelta(s, id), tk.collateral, tk.ondelta)))),
    (account) => step({ ...stored, account, claimRows: kept.length === 0 ? undefined : kept, leftJ: undefined, rightJ: undefined, finalizedJHeight: obs.jHeight }));
}));
type Arms = { readonly [K in AccountTx["type"]]: (tx: WireTxOf<K>) => BodyStep<EffectOf<K>> };
const applyArm = (a: AccountBody, tx: WireAccountTx, ctx: FoldCtx): BodyStep<Effect> => matchBy<"type", WireAccountTx, BodyStep<Effect>>("type", tx, {

  add_delta: (x) => ok(step(a.account.deltas.has(x.tokenId) ? a : putState(a, setDelta(a.account, zeroDelta(x.tokenId))))),
  set_credit_limit: (x) => map(updateDelta(a.account, x.tokenId, (d) => setCreditLimit(d, x.limit, ctx.byLeft)), (s) => step(putState(a, s))),
  payment: (x) => map(spend(a, x.tokenId, x.amount, ctx.byLeft), (b) => step(b)),
  htlc_lock: (x) => {
    if (a.locks.has(x.lockId) || [...a.locks.values()].some((l) => l.hashlock === x.hashlock)) return err({ _tag: "duplicate" });
    return map(checks(positive(x.amount), ensureRoom(a, x.tokenId, x.amount, ctx.byLeft)), () => step({ ...a, locks: mapSet(a.locks, x.lockId, {
      lockId: x.lockId, hashlock: x.hashlock, timelock: x.timelock, revealBeforeHeight: x.revealBeforeHeight, amount: x.amount, tokenId: x.tokenId,
      senderIsLeft: ctx.byLeft, createdHeight: ctx.accountHeight, createdTimestamp: ctx.nowMs, encryptedPackage: x.encryptedPackage,
    }) }));
  },
  htlc_resolve: (x) => {
    const live = a.locks.get(x.lockId);
    if (live === undefined) return MISSING;
    if (keccakUtf8(x.secret) !== live.hashlock) return err({ _tag: "preimage" });

    return map(offdeltaChange(live.senderIsLeft, live.amount), (by) => step({ ...shifted(a, live.tokenId, by), locks: mapDelete(a.locks, x.lockId) }, [{ _tag: "forward_secret", hashlock: live.hashlock, secret: x.secret }]));
  },
  htlc_timeout: (x) => {
    const live = a.locks.get(x.lockId);
    if (live === undefined) return MISSING;
    if (ctx.jHeight < live.revealBeforeHeight) return err({ _tag: "before_deadline" });
    if (ctx.jHeight === live.revealBeforeHeight) return err({ _tag: "unchosen", hole: "reveal_before_height" });
    return ok(step({ ...a, locks: mapDelete(a.locks, x.lockId) }));
  },
  swap_offer: (x) => {
    if (a.offers.has(x.offerId)) return err({ _tag: "duplicate" });
    if (x.giveAmount <= 0n || x.wantAmount <= 0n) return err({ _tag: "non_positive_payment" });
    if (!validRatio(x.minFillRatio)) return err({ _tag: "bad_ratio" });
    const offer: SwapOffer = { offerId: x.offerId, giveTokenId: x.giveTokenId, giveAmount: x.giveAmount, wantTokenId: x.wantTokenId, wantAmount: x.wantAmount, minFillRatio: x.minFillRatio, expiresAtHeight: x.expiresAtHeight, makerIsLeft: ctx.byLeft };
    return map(ensureRoom(a, offer.giveTokenId, offer.giveAmount, ctx.byLeft), () => step({ ...a, offers: mapSet(a.offers, x.offerId, offer) }));
  },
  swap_cancel: (x) => {
    const offer = a.offers.get(x.offerId);
    return offer === undefined ? MISSING : ctx.byLeft !== offer.makerIsLeft ? err({ _tag: "not_maker" }) : ok(step({ ...a, offers: mapDelete(a.offers, x.offerId) }));
  },
  swap_resolve: (x) => {
    const offer = a.offers.get(x.offerId);
    if (offer === undefined) return MISSING;
    if (ctx.accountHeight > offer.expiresAtHeight) return err({ _tag: "expired_offer" });
    if (!validRatio(x.fillRatio)) return err({ _tag: "bad_ratio" });
    if (x.fillRatio < offer.minFillRatio) return err({ _tag: "below_min_fill" });
    return chain(all({ give: floorRatio(offer.giveAmount, x.fillRatio), want: floorRatio(offer.wantAmount, x.fillRatio) }), ({ give, want }) => chain(give === 0n ? ok(0n) : offdeltaChange(offer.makerIsLeft, give), (giveBy) => {
      const released: AccountBody = { ...(give === 0n ? a : shifted(a, offer.giveTokenId, giveBy)), offers: mapDelete(a.offers, offer.offerId) };
      return map(want === 0n ? ok(released) : spend(released, offer.wantTokenId, want, !offer.makerIsLeft), (paid) =>
        x.cancelRemainder || x.fillRatio === MAX_FILL || offer.giveAmount === give ? step(paid)
        : step({ ...paid, offers: mapSet(paid.offers, offer.offerId, { ...offer, giveAmount: offer.giveAmount - give, wantAmount: offer.wantAmount - want }) }));
    }));
  },
  deposit_to_custody: (x) => map(spend(a, x.tokenId, x.amount, ctx.byLeft), (b) => step({ ...b, custody: bump(b.custody, x.tokenId, x.amount) })),
  withdraw_from_custody: (x) => chain(fromCustody(a, x.tokenId, x.amount), () => map(offdeltaChange(ctx.byLeft, x.amount), (by) => step({ ...shifted(a, x.tokenId, -by), custody: bump(a.custody, x.tokenId, -x.amount) }))),
  hub_custody_debit: (x) => map(fromCustody(a, x.tokenId, x.amount), () => step({ ...a, custody: bump(a.custody, x.tokenId, -x.amount), debits: [...a.debits, { tokenId: x.tokenId, amount: x.amount, reason: x.reason, referenceId: x.referenceId }] })),
  set_rebalance_policy: (x) => x.softLimit > x.hardLimit || x.maxAcceptableFee < 0n ? err({ _tag: "policy_bound" })
    : ok(step({ ...a, policy: mapSet(a.policy, x.tokenId, { softLimit: x.softLimit, hardLimit: x.hardLimit, maxAcceptableFee: x.maxAcceptableFee }) })),
  rebalance_request: (x) => {
    const policy = a.policy.get(x.tokenId);
    if (policy === undefined) return err({ _tag: "no_policy" });
    if (x.targetAmount <= 0n) return err({ _tag: "non_positive_payment" });
    return x.targetAmount > policy.hardLimit ? err({ _tag: "policy_bound" }) : ok(step({ ...a, request: { tokenId: x.tokenId, targetAmount: x.targetAmount } }));
  },
  rebalance_quote: (x) => {
    if (x.amount <= 0n || x.feeAmount < 0n) return err({ _tag: "non_positive_payment" });
    const policy = a.policy.get(x.tokenId);
    return ok(step({ ...a, quote: { quoteId: ctx.nowMs, tokenId: x.tokenId, amount: x.amount, feeTokenId: x.feeTokenId, feeAmount: x.feeAmount, accepted: policy !== undefined && x.feeAmount <= policy.maxAcceptableFee } }));
  },
  rebalance_accept: (x) => {
    if (a.quote === undefined) return err({ _tag: "no_quote" });
    if (a.quote.quoteId !== x.quoteId) return err({ _tag: "quote_mismatch" });
    const accepted: RebalanceQuote = { ...a.quote, accepted: true };
    return map(quoteWindow(a.quote, ctx.nowMs), () => step({ ...a, quote: accepted }));
  },
  deposit_collateral: (wire) => {
    if (wire.amount <= 0n) return err({ _tag: "non_positive_payment" });
    const effect: Of<Effect, "queue_r2c"> = { _tag: "queue_r2c", tokenId: wire.tokenId, amount: wire.amount };
    return chain(depositTx(wire), (x) => match(x.fee, {
      none: (): BodyStep<Of<Effect, "queue_r2c">> => ok(step(a, [effect])),
      quote: (fee): BodyStep<Of<Effect, "queue_r2c">> => {
        const q = a.quote;
        if (q === undefined || q.quoteId !== fee.quoteId || !q.accepted || q.feeTokenId !== fee.tokenId || q.feeAmount !== fee.amount) return err({ _tag: "quote_mismatch" });
        return chain(quoteWindow(q, ctx.nowMs), () => map(fee.amount === 0n ? ok(a) : spend(a, fee.tokenId, fee.amount, ctx.byLeft), (paid) => step({ ...paid, quote: undefined }, [effect])));
      },
    }));
  },
  subcontract_propose: (x) => {
    if ([...a.clauses.values()].filter(isPending).length >= MAX_PENDING) return err({ _tag: "pending_full" });
    if (a.clauses.has(x.id)) return err({ _tag: "duplicate" });
    if (!x.clause.allowances.every((r) => r.deltaIndex >= 0 && r.leftAllowance >= 0n && r.rightAllowance >= 0n)) return err({ _tag: "bad_allowance" });
    return ok(step({ ...a, clauses: mapSet(a.clauses, x.id, { _tag: "pending", clause: { ...x.clause, proposerIsLeft: ctx.byLeft } }) }));
  },
  subcontract_approve: (x) => chain(pendingOf(a, x.id, ctx.byLeft), (clause) => {
    const order = tokenOrder(a);
    return clause.allowances.some((r) => order[r.deltaIndex] === undefined) ? err({ _tag: "index" }) : ok(step({ ...a, clauses: mapSet(a.clauses, x.id, { _tag: "live", clause }) }));
  }),
  subcontract_reject: (x) => map(pendingOf(a, x.id, ctx.byLeft), () => step({ ...a, clauses: mapDelete(a.clauses, x.id) })),
  subcontract_resolve_propose: (x) => {
    const s = a.clauses.get(x.id), clause = s === undefined ? undefined : heldClause(s);
    return clause === undefined ? MISSING : ok(step({ ...a, clauses: mapSet(a.clauses, x.id, { _tag: "resolving", clause, resolution: { args: x.args, effects: x.effects, proposerIsLeft: ctx.byLeft } }) }));
  },
  subcontract_resolve_approve: (x) => map(resolutionOf(a, x.id, ctx.byLeft), (r) =>
    step({ ...putState(a, r.effects.reduce((s, e) => setDelta(s, shift(getDelta(s, e.tokenId), e.offdelta)), a.account)), clauses: mapDelete(a.clauses, x.id) })),
  cross_pull_lock: () => err({ _tag: "unchosen", hole: "cross_open" }),
  cross_pull_close: () => err({ _tag: "unchosen", hole: "cross_open" }),
  j_event_claim: (x) => claimJ(a, x, ctx),
  settle_transition: (x) => ok(step({ ...a, settlement: { revision: x.revision, workspaceHash: x.workspaceHash, settlementHash: x.settlementHash.toLowerCase() } })),
} satisfies Arms);
const one = (x: { readonly tokenId: TokenId }): readonly string[] => [x.tokenId], none = (): readonly string[] => [];
const namedTokens = (tx: WireAccountTx): readonly string[] => matchBy("type", tx, {
  add_delta: one, set_credit_limit: one, payment: one, htlc_lock: one, htlc_resolve: none, htlc_timeout: none, swap_offer: (x) => [x.giveTokenId, x.wantTokenId], swap_cancel: none, swap_resolve: none,
  deposit_to_custody: one, withdraw_from_custody: one, hub_custody_debit: one, set_rebalance_policy: one, rebalance_request: one, rebalance_quote: (x) => [x.tokenId, x.feeTokenId], rebalance_accept: none,
  deposit_collateral: one, subcontract_propose: none, subcontract_approve: none, subcontract_reject: none, subcontract_resolve_propose: (x) => x.effects.map((e) => e.tokenId), subcontract_resolve_approve: none,
  cross_pull_lock: none, cross_pull_close: none, j_event_claim: (x) => x.events.flatMap((row) => row.tokens.map((tk) => tk.tokenId.toString())), settle_transition: none,
});
const commits = (before: AccountBody, tx: WireAccountTx, next: AccountStep): BodyStep<Effect> =>
  chain(mapErr(prepareStep(before, next.state), uncommitted), () => map(mapErr(isL0Tx(tx) ? ok(undefined) : txRefusal(wireOf(tx)), uncommitted), () => next));
export const applyAccountBody: Layer<AccountBody, WireAccountTx, FoldCtx, Effect, BodyError> = (a, tx, ctx) => {
  const unfit = namedTokens(tx).find((n) => !tokenId(n).ok);
  if (unfit !== undefined) return err({ _tag: "token_id", tokenId: unfit });
  return chain(authorized(tx, a.hub, ctx.byLeft), () => chain(applyArm(a, tx, ctx), (next) => (next.state.account.deltas.size > MAX_ROWS ? err({ _tag: "too_many_rows" }) : commits(a, tx, next))));
};
export const accountSnapshot = (a: AccountBody): Required<Omit<AccountBody, "account">> & { readonly state: Hash } =>
  ({ state: hashAccountState(a.account), terms: a.terms, hub: a.hub, custody: a.custody, locks: a.locks, offers: a.offers, policy: a.policy, clauses: a.clauses, debits: a.debits, quote: a.quote, request: a.request, leftJ: a.leftJ, rightJ: a.rightJ, claimRows: a.claimRows, settlement: a.settlement, finalizedJHeight: a.finalizedJHeight });


export type ViewError = CommitmentError | Tagged<"token_id", { tokenId: TokenId }> | ClaimError;
export type UncommittedReason = ViewError | FrameHashError | Tagged<"unsafe_number">;
export type Uncommitted = Tagged<"uncommitted", { reason: UncommittedReason }>;
export const uncommitted = (reason: UncommittedReason): Uncommitted => ({ _tag: "uncommitted", reason });
export const tokenNumber = (id: TokenId): Result<number, ViewError> => (tokenId(id).ok ? ok(Number(id)) : err({ _tag: "token_id", tokenId: id }));
export const tokenOrder = (b: AccountBody): readonly TokenId[] => [...b.account.deltas.keys()].sort((x, y) => Number(x) - Number(y));
export const heldClause = (s: ClauseState): Clause | undefined => match<ClauseState, Clause | undefined>(s, { pending: () => undefined, live: ({ clause }) => clause, resolving: ({ clause }) => clause });
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
  let order: readonly TokenId[] | undefined;
  for (const s of b.clauses.values()) for (const r of heldClause(s)?.allowances ?? []) {
    order ??= tokenOrder(b);
    const id = order[r.deltaIndex];
    if (id === undefined || !counted(id)) continue;
    const tot = on(id); tot.leftAllowance += r.leftAllowance; tot.rightAllowance += r.rightAllowance;
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
const clauseRow = (id: ClauseId, s: ClauseState): unknown => match(s, {
  pending: ({ clause }) => ({ stage: "pending", clause }), live: ({ clause }) => ({ stage: "live", clause, resolve: undefined }), resolving: ({ clause, resolution }) => ({ stage: "live", clause, resolve: { id, ...resolution } }),
});
const project = (b: AccountBody): Result<CommittedAccountState, ViewError> => {
  const height = b.finalizedJHeight;
  if (height < 0n || height > BigInt(Number.MAX_SAFE_INTEGER)) return err({ _tag: "bad_j_claims" });
  const keys = [...b.account.deltas.keys(), ...b.policy.keys(), ...(b.request === undefined ? [] : [b.request.tokenId]), ...(b.quote === undefined ? [] : [b.quote.tokenId])];
  return chain(traverse(keys, tokenNumber), () => chain(all({ left: pendingOn(b, true), right: pendingOn(b, false) }), ({ left, right }) => {
    const { terms } = b, hubRows = new Map<string, unknown>();
    for (const [tk, amount] of b.custody) hubRows.set(`custody:${tk}`, amount);
    b.debits.forEach((debit, i) => hubRows.set(`debit:${i}`, debit));
    if (b.hub !== null) hubRows.set("hub", b.hub);
    if (b.settlement !== undefined) hubRows.set("settlement", b.settlement.settlementHash);
    return ok({
      domain: terms.domain, leftEntity: b.account.id.left, rightEntity: b.account.id.right, watchSeed: terms.watchSeed, disputeConfig: terms.disputeConfig,
      jNonce: 0, lastFinalizedJHeight: Number(height), leftPendingJClaims: left, rightPendingJClaims: right,
      deltas: committedDeltas(b), locks: b.locks, pulls: new Map(), swapOffers: b.offers, subcontracts: new Map([...b.clauses].map(([id, s]) => [id, clauseRow(id, s)])), lendingIntents: hubRows,
      requestedRebalance: byToken(b.request === undefined ? [] : [[b.request.tokenId, b.request.targetAmount] as const]),
      requestedRebalanceFeeState: byToken(b.quote === undefined ? [] : [[b.quote.tokenId, b.quote] as const]), rebalanceFeePolicies: byToken(b.policy),
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
    payment: (p): WireTx => ({ type: "direct_payment", data: { tokenId: tk, amount: p.amount, route: [payee], fromEntityId: payer, toEntityId: payee, deliveryMode: "direct" } }),
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
export type AccountHead = Tagged<"genesis", { height: 0n; prevFrameHash: typeof GENESIS_LINK }> | Tagged<"installed", { height: bigint; prevFrameHash: string; certificate: HeadCertificate }>;
export type InstalledHead = Of<AccountHead, "installed">;
export const genesisAccountHead = (): AccountHead => ({ _tag: "genesis", height: 0n, prevFrameHash: GENESIS_LINK });
export type AccountAck = { readonly height: bigint; readonly frameHash: string; readonly frameHanko: Hanko; readonly disputeHanko?: DisputeHanko | undefined };
export const certifiedBy = (c: HeadCertificate, party: Party): { readonly own: Hanko; readonly peer: Hanko } => ({ own: at(c.left, c.right, party.left), peer: at(c.left, c.right, other(party.left)) });
export type FrameEvidence = { readonly cause: AccountReplicaError; readonly frame: AccountFrame; readonly frameHanko: Hanko };
export type AccountInput =
  | ({ readonly kind: "propose"; readonly frameHanko?: Hanko | undefined; readonly disputeHanko?: DisputeHanko | undefined } & FrameClock)
  | { readonly kind: "dispute"; readonly evidence?: FrameEvidence | undefined }
  | ({ readonly kind: "ack" } & AccountAck & AccountEnvelope)
  | ({ readonly kind: "ack_frame"; readonly ack: AccountAck | null; readonly frame: AccountFrame; readonly frameHanko: Hanko; readonly disputeHanko?: DisputeHanko | undefined } & AccountEnvelope);
export type AccountMessage = Extract<AccountInput, { readonly kind: "ack" | "ack_frame" }>;
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
type Frozen = Omit<AccountEnv, "mempool"> & { readonly mempool: readonly []; readonly evidence?: FrameEvidence | undefined };
export interface OpenAccount extends Tagged<"open", AccountEnv> {}
export interface ProposedAccount extends Tagged<"proposed", Held> {}
export interface ReceivedAccount extends Tagged<"received", Held & { disputeHanko: DisputeHanko | undefined }> {}
export interface PreparingAccount extends Tagged<"preparing", Frozen & { unready: StartRefusal }> {}
export interface DisputedAccount extends Tagged<"disputed", Frozen & { start: DisputeStart }> {}
export type FrozenAccount = PreparingAccount | DisputedAccount;
export type AccountReplica = OpenAccount | ProposedAccount | ReceivedAccount | FrozenAccount;
export const certifies = (verify: Verify, digest: string, hanko: Hanko, entity: EntityId): Result<void, Tagged<"invalid_hanko", { entity: EntityId }>> => guard(verify(digest, hanko, entity), { _tag: "invalid_hanko", entity });
export type DoorContext = { readonly verify: Verify; readonly self: EntityId; readonly now: bigint };
export type AccountContext = { readonly verify: Verify; readonly party: Party };
export type AckContext = AccountContext & { readonly delivery: Delivery };
export type ReceivedContext = AccountContext & { readonly from: EntityId };
export type InboundAccountContext = ReceivedContext & { readonly now: bigint };
export type CtxFor<I extends AccountInput> = I extends { kind: "ack_frame" } ? InboundAccountContext : I extends { kind: "ack" } ? AckContext : AccountContext;
export type AccountInputFor<E extends AccountEvent> = Extract<AccountInput, { readonly kind: E }>;
export type AccountGrammar = { readonly table: typeof AccountTransition; readonly replica: AccountReplica; readonly input: AccountInput; readonly ctx: { readonly [E in AccountEvent]: CtxFor<AccountInputFor<E>> }; readonly output: AccountOutput; readonly error: AccountReplicaError };
export type NextAccountPhase<S extends AccountPhase, E extends AccountEvent> = Next<AccountGrammar, S, E>;
export type AccountCases<E extends AccountEvent> = Cases<AccountGrammar, E>;
export type AccountApply<R extends AccountReplica = AccountReplica> = Apply<R, AccountOutput>;
export interface DisputeRequired extends Tagged<"dispute_required", FrameEvidence> {}
export type AccountReplicaError =
  | BodyError | DisputeError | EnvelopeError | DisputeRequired
  | Tagged<"already_proposed" | "empty_mempool" | "not_proposed" | "height_mismatch" | "hash_mismatch" | "frame_hash_mismatch" | "state_root_mismatch" | "empty_frame" | "ack_unmatched">
  | Tagged<"frame_structure", { field: "timestamp" | "jHeight" | "txs" | "accountStateRoot" | "future_timestamp" }>
  | Tagged<"invalid_hanko", { entity: EntityId }> | Tagged<"unknown_signer", { entity: EntityId }>
  | Tagged<"bad_account", { reason: "entity_id" | "same_entity" | TermsError["_tag"] }>
  | Tagged<"ack_conflict", { field: "frameHash" | "frameHanko" | "disputeHanko" | "height" }>
  | Tagged<"halt_runtime", { reason: "state_hash_after_verify" }> | Tagged<"mempool_full", { limit: number }> | Tagged<"frozen", { phase: FrozenAccount["_tag"] }>;
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

export type Preview = { readonly frame: AccountFrame; readonly draft: FrameFold; readonly frameProof: LocalProof; readonly dispute: DisputePlan };
export type ProposalPlan = Tagged<"frame", { preview: Preview }> | Tagged<"idle", { refused: AccountReplicaError }>;
export const planOpen = (r: OpenAccount, party: Party, clock: FrameClock): Result<ProposalPlan, AccountReplicaError> => {
  if (r.mempool.length === 0) return err({ _tag: "empty_mempool" });
  const height = r.head.height + 1n, folded = proposalFold(r.state, r.mempool, foldCtx({ height, ...clock }, party.left)), firstRefusal = folded.refused[0];
  if (folded.included.length === 0 && firstRefusal !== undefined) return ok({ _tag: "idle", refused: firstRefusal.error });
  return chain(commit(folded.state), ({ view, root }) => chain(stampClaims(folded.included, r.state.claimRows), (txs) => {
    const unhashed = { height, timestamp: clock.timestamp, jHeight: clock.jHeight, prevFrameHash: r.head.prevFrameHash, txs, accountStateRoot: root };
    return chain(frameStateHash(unhashed, replicaId(r), party.left), (stateHash) => chain(localProof(view), (frameProof) => map(proposalPlan(view, frameProof, r.dispute, party.left), (dispute): ProposalPlan =>
      ({ _tag: "frame", preview: { frame: { ...unhashed, stateHash }, draft: { state: folded.state, effects: folded.effects }, frameProof, dispute } }))));
  }));
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
type Dispute = AccountInputFor<"dispute">;
type Verb<R extends AccountReplica> = Result<AccountApply<R>, AccountReplicaError>;
const reopen = (r: AccountReplica, next: { readonly state: AccountBody; readonly head: AccountHead; readonly mempool: readonly WireAccountTx[]; readonly acknowledged?: AccountAck | undefined; readonly dispute?: DisputeWitnesses | undefined }): OpenAccount =>
  ({ _tag: "open", state: next.state, head: next.head, mempool: next.mempool, acknowledged: next.acknowledged ?? r.acknowledged, dispute: next.dispute ?? r.dispute });
const effectsOut = (effects: readonly Effect[]): readonly AccountOutput[] => effects.map((effect) => ({ kind: "effect", effect }));
type Replayed = { readonly draft: FrameFold; readonly view: CommittedAccountState };
const replay = (s: AccountBody, f: AccountFrame, byLeft: boolean): Result<Replayed, AccountReplicaError> =>
  chain(foldFrame(s, f, byLeft), (draft) => chain(commit(draft.state), ({ view, root }) => (root === f.accountStateRoot ? ok({ draft, view }) : err({ _tag: "state_root_mismatch" }))));
const frameStructure = (f: AccountFrame): Result<void, AccountReplicaError> => {
  const field = f.timestamp <= 0n ? "timestamp" : f.jHeight < 0n ? "jHeight" : f.txs.length > ACCOUNT_MEMPOOL_SIZE ? "txs" : !BYTES32.test(f.accountStateRoot) ? "accountStateRoot" : null;
  return field === null ? ok(undefined) : err({ _tag: "frame_structure", field });
};
export const receiverClock = (f: AccountFrame, now: bigint): Result<void, AccountReplicaError> => guard(f.timestamp - now <= ACCOUNT_NETWORK_ALLOWANCE_MS, { _tag: "frame_structure", field: "future_timestamp" });
type SignedPair = { readonly left: Hanko; readonly right: Hanko };
const signedBy = (party: Party, ours: Hanko, theirs: Hanko): SignedPair => ({ left: at(ours, theirs, party.left), right: at(ours, theirs, other(party.left)) });
const install = (r: ProposedAccount | ReceivedAccount, signed: SignedPair, after: { readonly dispute: DisputeWitnesses; readonly acknowledged?: AccountAck | undefined }): Step<OpenAccount, Effect> => {
  const { frame, draft } = r.candidate;
  return step(reopen(r, { state: draft.state, head: { _tag: "installed", height: frame.height, prevFrameHash: frame.stateHash, certificate: { parent: frame.prevFrameHash, ...signed } }, mempool: r.mempool, acknowledged: after.acknowledged, dispute: after.dispute }), draft.effects);
};
const residentAck = (r: OpenAccount): AccountAck | null => (r.acknowledged !== undefined && r.acknowledged.height === r.head.height ? r.acknowledged : null);
export const proposeOpen = (r: OpenAccount, input: Propose, ctx: AccountContext): Verb<OpenAccount | ProposedAccount> => chain(planOpen(r, ctx.party, { timestamp: input.timestamp, jHeight: input.jHeight }), (planned) => match(planned, {
  idle: ({ refused }): Verb<OpenAccount | ProposedAccount> => (input.frameHanko === undefined && input.disputeHanko === undefined ? ok(done({ ...r, mempool: [] })) : err(refused)),
  frame: ({ preview: { frame, draft, frameProof, dispute } }): Verb<OpenAccount | ProposedAccount> => {
    const frameHanko = input.frameHanko;
    if (frameHanko === undefined) return err({ _tag: "invalid_hanko", entity: ctx.party.self });

    return chain(checks(frameStructure(frame), certifies(ctx.verify, frame.stateHash, frameHanko, ctx.party.self)), () => map(settleLocal(dispute, input.disputeHanko, r.dispute, ctx.party.self, ctx.verify), ({ carried, witnesses }) => {
      const proposed: ProposedAccount = { ...r, _tag: "proposed", mempool: [], candidate: new Candidate(frame, frameHanko, frameProof, draft), dispute: witnesses };
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
    return map(priorAck, () => {
      const sent = r.acknowledged;
      if (sent !== undefined && sent.height === height) return done<R, AccountOutput>(r, [{ kind: "ack", ...sentBy(r, ctx.party), ...sent }]);
      const current = r.dispute.current;
      const rebuilt: AccountAck = { height, frameHash: head.prevFrameHash, frameHanko: certified.own, ...opt("disputeHanko", current !== undefined && current.proofNonce > 0 ? current : undefined) };
      return done<R, AccountOutput>({ ...r, acknowledged: rebuilt }, [{ kind: "ack", ...sentBy(r, ctx.party), ...rebuilt }]);
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
  const gates = checks(frameStructure(frame), receiverClock(frame, ctx.now),
    guard(frame.prevFrameHash === r.head.prevFrameHash, { _tag: "hash_mismatch" } as AccountReplicaError), guard(frame.height === r.head.height + 1n, { _tag: "height_mismatch" } as AccountReplicaError),
    certifies(ctx.verify, frame.stateHash, input.frameHanko, ctx.from));
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
const freeze = (r: AccountReplica, evidence: FrameEvidence | undefined, ctx: AccountContext): Verb<PreparingAccount | DisputedAccount> => {
  const { state, head, dispute: witnesses, acknowledged } = r, frozen = { state, head, mempool: [] as const, dispute: witnesses, acknowledged, evidence };
  const start = startOf(state, witnesses, ctx.party.peer, ctx.verify);
  if (!start.ok) return ok(done<PreparingAccount, AccountOutput>({ _tag: "preparing", ...frozen, unready: start.error }));
  return ok(done<DisputedAccount, AccountOutput>({ _tag: "disputed", ...frozen, start: start.value }, [{ kind: "start_dispute", start: start.value }]));
};
export const disputeLive = (r: OpenAccount | ProposedAccount | ReceivedAccount, input: Dispute, ctx: AccountContext): Verb<PreparingAccount | DisputedAccount> => freeze(r, input.evidence, ctx);
export const disputePreparing = (r: PreparingAccount, _input: Dispute, ctx: AccountContext): Verb<PreparingAccount | DisputedAccount> => freeze(r, r.evidence, ctx);
export const disputeDisputed = (r: DisputedAccount): Verb<DisputedAccount> => ok(done(r));
const checkAckFrame = (input: AckFrame, ctx: InboundAccountContext): Result<void, AccountReplicaError> =>
  input.frame.txs.length === 0 ? err({ _tag: "empty_frame" }) : ctx.from !== ctx.party.peer ? err({ _tag: "unknown_signer", entity: ctx.from }) : disputeShapes([input.disputeHanko, input.ack?.disputeHanko]);
const carriedWithoutFrame = (r: OpenAccount | ReceivedAccount, input: AckFrame, ctx: InboundAccountContext): Result<void, AccountReplicaError> =>
  input.ack === null ? ok(undefined) : map(headAck(r, input.ack, ctx, input.frame.height, input.ack.height), () => undefined);
const pastGates = <R extends AccountReplica, S extends AccountReplica>(r: R, input: AckFrame, ctx: InboundAccountContext, rest: () => Verb<S>): Verb<R | S> =>
  chain(checkAckFrame(input, ctx), () => match(replayGate(r, input, ctx), { answered: ({ result }): Verb<R | S> => result, continue: (): Verb<R | S> => rest() }));
const thenProposal = (acked: Verb<OpenAccount | ProposedAccount>, input: AckFrame, ctx: InboundAccountContext): Verb<OpenAccount | ProposedAccount | ReceivedAccount> => chain(acked, (a) =>
  map(match(a.replica, { open: (o): Verb<OpenAccount | ProposedAccount | ReceivedAccount> => proposalOnOpen(o, input, ctx), proposed: (p): Verb<OpenAccount | ProposedAccount | ReceivedAccount> => proposalOnProposed(p, input, ctx) }),
    (p) => ({ replica: p.replica, outputs: [...a.outputs, ...p.outputs] })));
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
export const dispute = accountVerb("dispute", { open: disputeLive, proposed: disputeLive, received: disputeLive, preparing: disputePreparing, disputed: disputeDisputed });


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
type Queued = { readonly replica: OpenAccount; readonly queued: readonly WireAccountTx[] };
const enqueue = (r: AccountReplica, txs: readonly WireAccountTx[]): Result<Queued, AccountReplicaError> => match(r, {
  open: (o) => {
    const queued = unqueued(txs, o.mempool);
    return o.mempool.length + queued.length > ACCOUNT_MEMPOOL_SIZE ? err({ _tag: "mempool_full", limit: ACCOUNT_MEMPOOL_SIZE }) : ok({ replica: { ...o, mempool: [...o.mempool, ...queued] }, queued });
  },
  proposed: () => err({ _tag: "already_proposed" }), received: () => err({ _tag: "already_proposed" }), preparing: () => err(frozenError("preparing")), disputed: () => err(frozenError("disputed")),
});
export const admit = (r: AccountReplica, txs: readonly WireAccountTx[]): Result<OpenAccount, AccountReplicaError> => map(enqueue(r, txs), (q) => q.replica);
export const admitAt = (r: AccountReplica, txs: readonly WireAccountTx[], self: EntityId, clock: FrameClock): Result<OpenAccount, AccountReplicaError> => chain(partyOf(replicaId(r), self), () =>
  chain(enqueue(r, txs), ({ replica: open, queued }) => map(admissionFold(open.mempool, queued.length, open.state, self, { height: open.head.height + 1n, ...clock }), () => open)));
const accountContext = (r: AccountReplica, ctx: DoorContext): Result<AccountContext, AccountReplicaError> => map(partyOf(replicaId(r), ctx.self), (party) => ({ verify: ctx.verify, party }));
export const applyAccountInput = (r: AccountReplica, input: AccountInput, ctx: DoorContext): Result<AccountApply, AccountReplicaError> => chain(accountContext(r, ctx), (c) => matchBy("kind", input, {
  propose: (i) => propose(r, i, c), dispute: (i) => dispute(r, i, c),
  ack: (i) => chain(checkEnvelope(replicaId(r), r.state.terms, i), (sender) => ack(r, i, { ...c, delivery: sender === c.party.self ? { _tag: "local" } : { _tag: "received", from: sender } })),
  ack_frame: (i) => chain(checkEnvelope(replicaId(r), r.state.terms, i), (sender) => ackFrame(r, i, { ...c, now: ctx.now, from: sender })),
}));
export const applyDelivered = (r: AccountReplica, input: AccountInput, delivery: Delivery, ctx: DoorContext): Result<AccountApply, AccountReplicaError> =>
  chain(matchBy("kind", input, {
    propose: (): Result<void, AccountReplicaError> => localOnly(delivery),
    dispute: (): Result<void, AccountReplicaError> => localOnly(delivery),
    ack: (m): Result<void, AccountReplicaError> => deliveredBy(m, ctx.self, delivery),
    ack_frame: (m): Result<void, AccountReplicaError> => deliveredBy(m, ctx.self, delivery),
  }), () => applyAccountInput(r, input, ctx));
export const disputeUnsafe = (r: AccountReplica, applied: Result<AccountApply, AccountReplicaError>, ctx: DoorContext): Result<AccountApply, AccountReplicaError> => {
  if (applied.ok) return applied;
  const evidence = evidenceOf(applied.error);
  return evidence === null ? applied : applyAccountInput(r, { kind: "dispute", evidence }, ctx);
};
export const restoreAccount = (r: AccountReplica, self: EntityId, verify: Verify): Result<AccountReplica, AccountReplicaError> => chain(partyOf(replicaId(r), self), (party) => {
  const restored = <R extends ProposedAccount | ReceivedAccount>(held: R): Result<AccountReplica, AccountReplicaError> => map(restoreCandidate(held, party, verify), (candidate) => ({ ...held, candidate }));
  const kept = (x: AccountReplica): Result<AccountReplica, AccountReplicaError> => ok(x);
  return match(r, { open: kept, proposed: restored, received: restored, preparing: kept, disputed: kept });
});


export type Head = { readonly height: bigint; readonly prevFrameHash: EntityFrameHash };
export const genesisHead = (): Head => ({ height: 0n, prevFrameHash: ZERO_HASH as EntityFrameHash });
export type MemberVerify = (h: Hash, sig: Signature, addr: Address) => boolean;
type Members = ReadonlyMap<Address, { readonly shares: bigint }>;
type TeachingQuorum = { readonly threshold: bigint; readonly members: Members };
type BoardQuorum = { readonly board: Board; readonly entityId: string };
export type Authority = Tagged<"teaching", TeachingQuorum> | Tagged<"board", BoardQuorum>;
export type Quorum = Authority & { readonly proposer: Address };
export type EntityState = { readonly id: EntityId; readonly quorum: Quorum; readonly jurisdiction: Domain; readonly accounts: ReadonlyMap<EntityId, AccountState> };
export type EntityTx = { readonly target: EntityId } & (
  | { readonly type: "openAccount"; readonly terms: AccountTerms } | { readonly type: "addDelta"; readonly tokenId: TokenId }
  | { readonly type: "extendCredit"; readonly tokenId: TokenId; readonly limit: bigint } | { readonly type: "pay"; readonly tokenId: TokenId; readonly amount: bigint }
  | ({ readonly type: "proposeAccount"; readonly frameHanko?: Hanko | undefined; readonly disputeHanko?: DisputeHanko | undefined } & FrameClock)
  | { readonly type: "accountInput"; readonly input: AccountMessage });
export type EntityOrigin = Delivery;
export type EntityFrame = Head & {
  readonly timestamp: bigint; readonly origin: EntityOrigin; readonly txs: readonly EntityTx[]; readonly stateHash: EntityStateHash;
  readonly events: readonly Binary[]; readonly stateRoot: string; readonly authorityRoot: string; readonly entityContext: EntityInfraContext;
};
export type OutputTx = Extract<EntityTx, { readonly type: "openAccount" | "accountInput" }>;
export type EntityOutput = { readonly to: EntityId; readonly tx: OutputTx };
export type EntityInput = { readonly kind: "txs"; readonly timestamp: bigint; readonly txs: readonly EntityTx[] } | { readonly kind: "precommit"; readonly signature: Signature };
export type EntityPhase = "open" | "proposed";
export type EntityEvent = EntityInput["kind"];
export type Folded = { readonly state: EntityState; readonly accountReplicas: ReadonlyMap<EntityId, AccountReplica> };
export type Draft = Folded & { readonly outputs: readonly EntityOutput[] };
type EntityEnv = Folded & { readonly head: Head; readonly mempool: readonly EntityTx[] };
export interface OpenEntity extends Tagged<"open", EntityEnv> {}
export interface ProposedEntity extends Tagged<"proposed", EntityEnv & { frame: EntityFrame; signatures: ReadonlyMap<Address, Signature>; draft: Draft }> {}
export type EntityReplica = OpenEntity | ProposedEntity;
export type EntityContext = { readonly verify: Verify; readonly verifyMember: MemberVerify; readonly self: EntityId; readonly signerId: Address; readonly from?: EntityId | undefined };
export type EntityFrameHashError = BinaryError | Tagged<"frame_clock", { readonly value: bigint }> | Tagged<"frame_root", { readonly value: string }> | Tagged<"frame_too_large">;
export type EntityError =
  | AccountReplicaError | EntityRootError | EntityFrameHashError
  | Tagged<"account_exists" | "no_such_account" | "create_ack_required" | "account_envelope", { target: EntityId }>
  | Tagged<"empty_input" | "self_account" | "bad_quorum" | "bad_jurisdiction" | "from_not_converted" | "not_l0"> | Tagged<"frame_timestamp_invalid", { timestamp: bigint }>
  | Tagged<"unknown_member" | "not_proposer" | "invalid_signature", { address: Address }>;
export type EntityGrammar = { readonly table: typeof EntityTransition; readonly replica: EntityReplica; readonly input: EntityInput; readonly ctx: { readonly [E in EntityEvent]: EntityContext }; readonly output: EntityOutput; readonly error: EntityError };
export type NextEntityPhase<S extends EntityPhase, E extends EntityEvent> = Next<EntityGrammar, S, E>;
type EntityApply<R extends EntityReplica = EntityReplica> = Apply<R, EntityOutput>;
export const encodeEntityTx = (tx: EntityTx): string => matchBy("type", tx, {
  openAccount: (x) => `o|${x.target}|${canon(x.terms)}`, addDelta: (x) => `d|${x.target}|${x.tokenId}`, extendCredit: (x) => `e|${x.target}|${x.tokenId}|${x.limit}`, pay: (x) => `p|${x.target}|${x.tokenId}|${x.amount}`,
  proposeAccount: (x) => `q|${x.target}|${canon({ timestamp: x.timestamp, jHeight: x.jHeight, frameHanko: x.frameHanko, disputeHanko: x.disputeHanko })}`,
  accountInput: (x) => `i|${x.target}|${matchBy("kind", x.input, { ack: (a) => `a|${canon(a)}`, ack_frame: (f) => `f|${canon(f)}` })}`,
});
export const encodeEntityState = (s: EntityState): string => canon({
  id: s.id,
  quorum: match(s.quorum, { teaching: (q) => ({ threshold: q.threshold, members: q.members }), board: (q) => ({ board: encodeBoardHash({ board: q.board }), entityId: q.entityId }) }),
  jurisdiction: s.jurisdiction, accounts: new Map([...s.accounts].map(([peer, a]) => [peer, hashAccountState(a)])),
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
  | { readonly [key: string]: Binary };
export type BinaryError = Tagged<"binary">;
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
export type EntityRootConfig = {
  readonly mode: "proposer-based" | "gossip-based";
  readonly threshold: bigint;
  readonly validators: readonly string[];
  readonly shares: Readonly<Record<string, bigint>>;
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
  const validators = config.validators.map(signerId);
  return validators.some((id) => id.length === 0) ? err({ _tag: "bad_config" }) : ok({ mode: config.mode, threshold: config.threshold, validators, shares });
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
export const entityStateRoot = (input: { readonly config: EntityRootConfig; readonly accounts: readonly EntityRootAccount[] }): Result<string, EntityRootError> =>
  chain(consensusConfig(input.config), (config) => chain(traverse(input.accounts, accountLeaf), (leaves): Result<string, EntityRootError> => {
    const seen = new Set<string>();
    for (const [key] of leaves) { const id = bytesToHex(key); if (seen.has(id)) return err({ _tag: "duplicate_account" }); seen.add(id); }
    const root = sealRadix(leaves.map(([key, digest]) => ({ nibbles: nibblesOf(key), key, digest })));
    const sections: readonly (readonly [string, Binary])[] = [
      ["accounts", { domain: "xln.entity.accounts.radix-merkle:binary", radix: 16, hashAlgorithm: "integrity", leafCount: leaves.length, root }],
      ["config", config],
      ["paybook", EMPTY_ENTITY_PAYBOOK],
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

const frameWord = (value: string): string => value.startsWith("0x") ? value.toLowerCase() : `0x${value.toLowerCase()}`;
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
const entityFrameTx = (tx: EntityTx): Result<EntityFrameTx, BinaryError> => map(binaryBody(matchBy("type", tx, {
  openAccount: (x) => ({ target: x.target, terms: x.terms }), addDelta: (x) => ({ target: x.target, tokenId: x.tokenId }),
  extendCredit: (x) => ({ target: x.target, tokenId: x.tokenId, limit: x.limit }), pay: (x) => ({ target: x.target, tokenId: x.tokenId, amount: x.amount }),
  proposeAccount: (x) => ({ target: x.target, timestamp: x.timestamp, jHeight: x.jHeight, ...opt("frameHanko", x.frameHanko), ...opt("disputeHanko", x.disputeHanko) }),
  accountInput: (x) => ({ target: x.target, input: x.input }),
})), (data) => ({ type: tx.type, data }));
export const hashEntityFrame = (f: EntityFrame): Result<EntityFrameHash, EntityFrameHashError> =>
  chain(frameNumber(f.height), (height) => chain(frameNumber(f.timestamp), (timestamp) => chain(traverse(f.txs, entityFrameTx), (txs) => map(entityFrameHash({
    prevFrameHash: frameWord(f.prevFrameHash), height, timestamp, txs, events: f.events, entityId: f.entityContext.entityId,
    stateRoot: f.stateRoot, authorityRoot: f.authorityRoot, entityContext: f.entityContext,
  }), (digest) => digest as EntityFrameHash))));
export const allowedProposer = (q: Quorum): Address => q.proposer;
const boardMembers = (board: Board): Members => new Map(board.entityIds.map((id, i) => [checksum(`0x${id.slice(-40)}`) as Address, { shares: BigInt(board.votingPowers[i] ?? 0) }]));
const membersOf = (a: Authority): Members => match(a, { teaching: (x) => x.members, board: (b) => boardMembers(b.board) });
const thresholdOf = (a: Authority): bigint => match(a, { teaching: (x) => x.threshold, board: (b) => BigInt(b.board.votingThreshold) });
const boardShaped = (a: Authority): boolean => match(a, {
  teaching: () => true,
  board: ({ board, entityId }) => WORD.test(entityId) && Number.isSafeInteger(board.votingThreshold) && board.entityIds.length === board.votingPowers.length
    && board.entityIds.every((id) => WORD.test(id) && isAddressId(id)) && board.votingPowers.every(Number.isSafeInteger) && boardMembers(board).size === board.entityIds.length,
});
const admitQuorum = (a: Authority): Result<Quorum, EntityError> => {
  if (!boardShaped(a)) return err({ _tag: "bad_quorum" });
  const members = membersOf(a), shares = [...members.values()].map((m) => m.shares), threshold = thresholdOf(a), proposer = [...members.keys()].sort(asc)[0];
  if (proposer === undefined || threshold < 1n || shares.some((n) => n < 1n) || threshold > shares.reduce((sum, n) => sum + n, 0n)) return err({ _tag: "bad_quorum" });
  return ok({ ...a, proposer });
};
const openEntity = (state: EntityState, head: Head, accountReplicas: ReadonlyMap<EntityId, AccountReplica>): OpenEntity => ({ _tag: "open", state, head, mempool: [], accountReplicas });
type EntitySeed = { readonly id: EntityId; readonly jurisdiction: Domain } & (TeachingQuorum | { readonly board: Board & { readonly entityId: string } });
export const createEntity = (p: EntitySeed): Result<OpenEntity, EntityError> => {
  const authority: Authority = "board" in p ? (({ entityId, ...board }) => ({ _tag: "board", board, entityId }))(p.board) : { _tag: "teaching", threshold: p.threshold, members: p.members };
  return chain(admitQuorum(authority), (quorum) => map(mapErr(domainOf(p.jurisdiction), (): EntityError => ({ _tag: "bad_jurisdiction" })), (jurisdiction) => openEntity({ id: p.id, quorum, jurisdiction, accounts: new Map() }, genesisHead(), new Map())));
};
const signedByMember = (q: Quorum, frameHash: Hash, sig: Signature, ctx: EntityContext): boolean =>
  match(q, { teaching: () => ctx.verifyMember(frameHash, sig, ctx.signerId), board: () => sameHex(recoverRawSigner(frameHash, sig) ?? undefined, ctx.signerId) });
const installs = (q: Quorum, frameHash: Hash, sigs: ReadonlyMap<Address, Signature>): boolean => match(q, {
  teaching: (x) => [...sigs.keys()].reduce((n, addr) => n + (x.members.get(addr)?.shares ?? 0n), 0n) >= x.threshold,
  board: ({ board, entityId }) => boardVotingPower(board, sigs) >= board.votingThreshold
    && unwrapOr(map(verifyHankoLocal(encodeBoardHanko({ ...board, entityId }, sigs), frameHash, { encodedBoard: encodeBoardBytes(board), entityId }), (v) => v.valid), () => false),
});
const parseOrigin = (txs: readonly EntityTx[], ctx: EntityContext): Result<EntityOrigin, EntityError> => {
  if (ctx.from === undefined) return ok({ _tag: "local" });
  const [tx] = txs;
  if (ctx.from === ctx.self || txs.length !== 1 || tx === undefined || tx.target !== ctx.from) return err({ _tag: "from_not_converted" });
  const emitted = matchBy("type", tx, { openAccount: () => true, accountInput: () => true, addDelta: () => false, extendCredit: () => false, pay: () => false, proposeAccount: () => false });
  return emitted ? ok({ _tag: "received", from: ctx.from }) : err({ _tag: "from_not_converted" });
};
const owesCreateAck = (child: AccountReplica): boolean => match(child, { open: () => false, proposed: () => false, received: () => true, preparing: () => false, disputed: () => false });
const isCreateAck = (tx: EntityTx, origin: EntityOrigin): boolean => matchBy("type", tx, {
  accountInput: (x) => match(origin, { local: () => matchBy("kind", x.input, { ack: () => true, ack_frame: () => false }), received: () => false }),
  openAccount: () => false, addDelta: () => false, extendCredit: () => false, pay: () => false, proposeAccount: () => false,
});
const parseCreateAcks = (txs: readonly EntityTx[], replicas: ReadonlyMap<EntityId, AccountReplica>, origin: EntityOrigin): Result<void, EntityError> => {
  const skipped = [...replicas].find(([peer, child]) => { if (!owesCreateAck(child)) return false; const first = txs.find((tx) => tx.target === peer); return first !== undefined && !isCreateAck(first, origin); });
  return skipped === undefined ? ok(undefined) : err({ _tag: "create_ack_required", target: skipped[0] });
};

type FoldContext = { readonly verify: Verify; readonly origin: EntityOrigin; readonly timestamp: bigint };
type Replicas = ReadonlyMap<EntityId, AccountReplica>;
const putChild = (state: EntityState, replicas: Replicas, peer: EntityId, child: AccountReplica): Folded => ({ state: { ...state, accounts: mapSet(state.accounts, peer, child.state.account) }, accountReplicas: mapSet(replicas, peer, child) });
const withChild = (replicas: Replicas, target: EntityId, f: (child: AccountReplica) => Result<Draft, EntityError>): Result<Draft, EntityError> => { const child = replicas.get(target); return child === undefined ? err({ _tag: "no_such_account", target }) : f(child); };
const routed = (state: EntityState, replicas: Replicas, target: EntityId, applied: Result<AccountApply, AccountReplicaError>): Result<Draft, EntityError> => chain(applied, (a) =>
  map(traverse(a.outputs, (o): Result<readonly AccountMessage[], EntityError> => matchBy("kind", o, { effect: () => err({ _tag: "not_l0" }), ack: (m) => ok([m]), ack_frame: (m) => ok([m]), start_dispute: () => ok([]) })),
    (messages) => ({ ...putChild(state, replicas, target, a.replica), outputs: messages.flat().map((input): EntityOutput => ({ to: target, tx: { type: "accountInput", target: state.id, input } })) })));
const L0_CLOCK = { timestamp: 0n, jHeight: 0n } as const;
const openChild = (state: EntityState, replicas: Replicas, tx: Extract<EntityTx, { type: "openAccount" }>, outputs: readonly EntityOutput[]): Result<Draft, EntityError> => {
  const id = accountId(state.id, tx.target);
  if (!id.ok) return err({ _tag: "self_account" });
  return chain(genesisReplica(id.value, tx.terms), (opened): Result<Draft, EntityError> => {
  if (canon(opened.state.terms.domain) !== canon(state.jurisdiction)) return err({ _tag: "domain_mismatch" });
  const existing = replicas.get(tx.target);
  if (existing === undefined) return ok({ ...putChild(state, replicas, tx.target, opened), outputs });
  return canon(existing.state.terms) === canon(opened.state.terms) ? ok({ state, accountReplicas: replicas, outputs: [] }) : err({ _tag: "account_exists", target: tx.target });
});
};
const foldTx = (state: EntityState, replicas: Replicas, tx: EntityTx, ctx: FoldContext): Result<Draft, EntityError> => {
  const delta = (accountTx: AccountTx): Result<Draft, EntityError> => withChild(replicas, tx.target, (child) => map(admitAt(child, [accountTx], state.id, L0_CLOCK), (admitted) => ({ ...putChild(state, replicas, tx.target, admitted), outputs: [] })));
  return matchBy("type", tx, {
    openAccount: (x) => x.target === state.id ? err({ _tag: "self_account" })
      : match(ctx.origin, { local: () => openChild(state, replicas, x, [{ to: x.target, tx: { type: "openAccount", target: state.id, terms: x.terms } }]), received: () => openChild(state, replicas, x, []) }),
    addDelta: (x) => delta({ type: "add_delta", tokenId: x.tokenId }),
    extendCredit: (x) => delta({ type: "set_credit_limit", tokenId: x.tokenId, limit: x.limit }),
    pay: (x) => delta({ type: "payment", tokenId: x.tokenId, amount: x.amount }),
    proposeAccount: (x) => withChild(replicas, x.target, (child) => chain(partyOf(replicaId(child), state.id), (party) =>
      routed(state, replicas, x.target, propose(child, { kind: "propose", frameHanko: x.frameHanko, disputeHanko: x.disputeHanko, timestamp: x.timestamp, jHeight: x.jHeight }, { verify: ctx.verify, party })))),
    accountInput: (x) => chain(deliveredBy(x.input, state.id, ctx.origin), () => {
      const door: DoorContext = { verify: ctx.verify, self: state.id, now: ctx.timestamp };
      const apply = (input: AccountMessage): Result<Draft, EntityError> => withChild(replicas, x.target, (child) => routed(state, replicas, x.target, disputeUnsafe(child, applyAccountInput(child, input, door), door)));
      return matchBy("kind", x.input, {
        ack: (i) => apply(i),
        ack_frame: (i) => match(ctx.origin, { local: (): Result<Draft, EntityError> => err({ _tag: "from_not_converted" }), received: () => (i.frame.txs.every(isL0Tx) ? apply(i) : err({ _tag: "not_l0" })) }),
      });
    }),
  });
};
export const foldTxs = (state: EntityState, replicas: Replicas, txs: readonly EntityTx[], ctx: FoldContext): Result<Draft, EntityError> =>
  map(strictFold<Folded, EntityTx, FoldContext, EntityOutput, EntityError>((pair, tx, c) => map(foldTx(pair.state, pair.accountReplicas, tx, c), (d) => step({ state: d.state, accountReplicas: d.accountReplicas }, d.outputs)))({ state, accountReplicas: replicas }, txs, ctx),
    ({ state: end, effects }) => ({ ...end, outputs: effects }));
const rootConfig = (quorum: Quorum): EntityRootConfig => {
  const members = [...membersOf(quorum)].map(([id, member]) => [signerId(id), member.shares] as const).sort(([left], [right]) => asc(left, right));
  return { mode: "proposer-based", threshold: thresholdOf(quorum), validators: members.map(([id]) => id), shares: Object.fromEntries(members) };
};
/** Empty rebalance shadow only. A policy, quote, or request has no radix root here. */
const installedAccount = (self: EntityId, peer: EntityId, child: AccountReplica): Result<EntityRootAccount, EntityError> => {
  const body = child.state;
  if (body.policy.size > 0 || body.quote !== undefined || body.request !== undefined) return err({ _tag: "account_envelope", target: peer });
  const status: EntityRootAccount["status"] = match(child, { open: () => "active", proposed: () => "active", received: () => "active", preparing: () => "dispute_preparing", disputed: () => "disputed" });
  const linked: Result<{ readonly height: number; readonly frame: string }, EntityFrameHashError> = match(child.head, { genesis: () => ok({ height: 0, frame: "" }), installed: (head) => map(frameNumber(head.height), (height) => ({ height, frame: head.prevFrameHash })) });
  return chain(linked, (link): Result<EntityRootAccount, EntityError> => chain(mapErr(committedView(body), (): EntityError => ({ _tag: "account_envelope", target: peer })), (state): Result<EntityRootAccount, EntityError> => ok({
    fromEntity: self, toEntity: peer, status, currentHeight: link.height, nextProofNonce: child.dispute.nextProofNonce, currentFrameHash: link.frame,
    pendingWithdrawals: ZERO_WORD, policyRoot: ZERO_WORD, submittedAtByTokenRoot: ZERO_WORD, state,
  })));
};
const draftRoot = (self: EntityId, quorum: Quorum, replicas: Replicas): Result<string, EntityError> =>
  chain(traverse([...replicas], ([peer, child]) => installedAccount(self, peer, child)), (accounts) => entityStateRoot({ config: rootConfig(quorum), accounts }));
const authorityRoot = (quorum: Quorum): Result<string, EntityRootError> => {
  const config = rootConfig(quorum), leader = config.validators[0];
  if (leader === undefined || leader.length === 0) return err({ _tag: "bad_config" });
  return chain(consensusConfig(config), (normalized) => map(encodeConsensus({
    domain: "xln.entity.frame-authority:binary",
    authority: { config: normalized, leaderState: { activeValidatorId: leader, view: 0, changedAtHeight: 0 } },
  }), (bytes) => bytesToHex(keccak_256(bytes))));
};
const proposedFrame = (head: Head, timestamp: bigint, origin: EntityOrigin, txs: readonly EntityTx[], draft: Draft, signer: Address): Result<EntityFrame, EntityError> => {
  const height = head.height + 1n;
  return chain(frameNumber(height), (heightNo) => chain(frameNumber(timestamp), () => chain(draftRoot(draft.state.id, draft.state.quorum, draft.accountReplicas), (stateRoot) =>
    chain(authorityRoot(draft.state.quorum), (root) => ok({
      height, prevFrameHash: head.prevFrameHash, timestamp, origin, txs, stateHash: hashEntityState(draft.state), events: [], stateRoot, authorityRoot: root,
      entityContext: {
        version: 1, proposerReplicaId: `${draft.state.id}:${signer}`, entityId: draft.state.id, proposerSignerId: signer,
        parentFrameHash: frameWord(head.prevFrameHash), height: heightNo, gossipProfiles: [], peerAssertions: [],
        htlc: { version: 1, entries: [], originated: [] },
      },
    })))));
};
export const applyTxsOpen = (r: OpenEntity, input: Extract<EntityInput, { kind: "txs" }>, ctx: EntityContext): Result<EntityApply<ProposedEntity>, EntityError> => chain(parseOrigin(input.txs, ctx), (origin) => {
  if (input.txs.length === 0) return err({ _tag: "empty_input" });
  if (ctx.signerId !== allowedProposer(r.state.quorum)) return err({ _tag: "not_proposer", address: ctx.signerId });

  if (input.timestamp < 0n || input.timestamp > BigInt(Number.MAX_SAFE_INTEGER)) return err({ _tag: "frame_timestamp_invalid", timestamp: input.timestamp });
  return chain(parseCreateAcks(input.txs, r.accountReplicas, origin), () => chain(foldTxs(r.state, r.accountReplicas, input.txs, { verify: ctx.verify, origin, timestamp: input.timestamp }), (draft) =>
    map(proposedFrame(r.head, input.timestamp, origin, input.txs, draft, ctx.signerId), (frame) => done<ProposedEntity, EntityOutput>({ ...r, _tag: "proposed", mempool: [], signatures: new Map(), draft, frame }))));
});
export const applyPrecommitProposed = (r: ProposedEntity, input: Extract<EntityInput, { kind: "precommit" }>, ctx: EntityContext): Result<EntityApply<OpenEntity | ProposedEntity>, EntityError> => {
  if (ctx.from !== undefined) return err({ _tag: "from_not_converted" });
  const quorum = r.state.quorum;
  return chain(hashEntityFrame(r.frame), (frameHash): Result<EntityApply<OpenEntity | ProposedEntity>, EntityError> => {
    if (!membersOf(quorum).has(ctx.signerId)) return err({ _tag: "unknown_member", address: ctx.signerId });
    if (!signedByMember(quorum, frameHash, input.signature, ctx)) return err({ _tag: "invalid_signature", address: ctx.signerId });
    const signatures = mapSet(r.signatures, ctx.signerId, input.signature);
    return ok(installs(quorum, frameHash, signatures)
      ? done<OpenEntity | ProposedEntity, EntityOutput>(openEntity(r.draft.state, { height: r.frame.height, prevFrameHash: frameHash }, r.draft.accountReplicas), r.draft.outputs)
      : done({ ...r, signatures }));
  });
};
const entityVerb = grammar<EntityGrammar>(EntityTransition);
const applyTxs = entityVerb("txs", { open: applyTxsOpen, proposed: { _tag: "already_proposed" } });
const applyPrecommit = entityVerb("precommit", { open: { _tag: "not_proposed" }, proposed: applyPrecommitProposed });
export const applyEntityInput = (r: EntityReplica, input: EntityInput, ctx: EntityContext): Result<EntityApply, EntityError> =>
  ctx.self !== r.state.id ? err({ _tag: "self_account" }) : matchBy("kind", input, { txs: (i) => applyTxs(r, i, ctx), precommit: (i) => applyPrecommit(r, i, ctx) });

export type Runtime = { readonly entities: ReadonlyMap<EntityId, EntityReplica> };
type RuntimeBase = { readonly entityId: EntityId; readonly signerId: Address; readonly input: EntityInput };
export type RuntimeInput = (RuntimeBase & { readonly kind: "create" }) | (RuntimeBase & { readonly kind: "receive"; readonly from: EntityId });
export type RuntimeError = EntityError | Tagged<"no_such_entity", { id: EntityId }>;
export type Verifiers = { readonly verify: Verify; readonly verifyMember: MemberVerify };
export const createRuntime = (): Runtime => ({ entities: new Map() });
export const spawn = (rt: Runtime, r: EntityReplica): Runtime => ({ entities: mapSet(rt.entities, r.state.id, r) });
export const convertOutput = (rt: Runtime, item: EntityOutput, from: EntityId, timestamp: bigint): Result<RuntimeInput, RuntimeError> => {
  const receiver = rt.entities.get(item.to);
  return receiver === undefined ? err({ _tag: "no_such_entity", id: item.to }) : ok({ kind: "receive", entityId: item.to, from, signerId: allowedProposer(receiver.state.quorum), input: { kind: "txs", timestamp, txs: [item.tx] } });
};
export const applyRuntime = (rt: Runtime, inputs: readonly RuntimeInput[], verifiers: Verifiers): { runtime: Runtime; outbox: readonly EntityOutput[]; rejected: readonly RuntimeError[] } => {
  type Out = { readonly outputs: readonly EntityOutput[]; readonly rejected: readonly RuntimeError[] };

  const refused = (error: RuntimeError, stop: boolean): StoreStep<EntityId, EntityReplica, Out> => ({ writes: [], out: { outputs: [], rejected: [error] }, stop });
  const { store, outs } = foldStore(rt.entities, inputs, (read, input): StoreStep<EntityId, EntityReplica, Out> => {
    const r = read(input.entityId);
    if (r === undefined) return refused({ _tag: "no_such_entity", id: input.entityId }, false);
    const applied = applyEntityInput(r, input.input, { self: input.entityId, signerId: input.signerId, ...verifiers, from: matchBy("kind", input, { create: () => undefined, receive: (i) => i.from }) });

    if (!applied.ok) return refused(applied.error, applied.error._tag === "halt_runtime");
    return { writes: [[input.entityId, applied.value.replica]], out: { outputs: applied.value.outputs, rejected: [] }, stop: false };
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
  | { readonly type: "placeSwapOffer"; readonly offerId: string; readonly giveTokenId: TokenId; readonly giveAmount: bigint; readonly wantTokenId: TokenId; readonly wantAmount: bigint; readonly minFillRatio: number; readonly expiresAtHeight: bigint }
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
    dispute: () => accountStep(host, applyAccountInput(host.account, { kind: "dispute" }, { verify, self: host.self, now: ctx.timestamp })),
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
const messageOf = (e: HostEffect): AccountMessage | null => match(e, { send: (x) => x.message, forward_secret: () => null, queue_r2c: () => null, start_dispute: () => null });
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
      const byId = (entries: readonly OutboxEntry[]): string => canon(sortedBy(entries, (e) => e.id));
      return byId(outbox) !== byId(host.outbox) ? err({ _tag: "chain" }) : ok({ host, pending: host.outbox, effects });
    });
  });
};

export type TowerReceiptV1 = { readonly type: "tower_receipt"; readonly towerId: string; readonly lookupKey: string; readonly slot: bigint; readonly height: bigint; readonly bundleHash: Hash; readonly storedAt: bigint; readonly expiresAt: bigint; readonly towerSignature: string };
export type AccountRecoveryBundleV1 = {
  readonly account: { readonly accountId: string; readonly jurisdictionId: string; readonly left: string; readonly right: string; readonly owner: string; readonly counterparty: string };
  readonly latestCommitted: { readonly height: bigint; readonly frameHash: Hash; readonly ownerFrameHanko: string; readonly counterpartyFrameHanko: string };
  readonly dispute: { readonly proofBodyHash: Hash; readonly nonce: bigint }; readonly bundleHash: Hash;
};
export type TowerMode = "blind_backup" | "delayed_last_resort";
export type LastResortPayload = { readonly triggerHint: string; readonly encryptedRemedy: string; readonly actionKind: "counter_dispute_only"; readonly appointmentSequence: bigint; readonly proofNonce: bigint; readonly proofBodyHash: Hash; readonly responseMode: "last_resort"; readonly lastResortWindowSeconds: bigint; readonly safetyMarginSeconds: bigint; readonly maxFeeToken?: TokenId | undefined; readonly feeBudget?: bigint | undefined };
export type TowerAppointmentV1 = { readonly type: "tower_appointment"; readonly towerMode: TowerMode; readonly lookupKey: string; readonly slot: bigint; readonly height: bigint; readonly bundleHash: Hash; readonly encryptedBundle: string; readonly ownerEntityId: string; readonly ownerHanko: string; readonly lastResortPayload?: LastResortPayload | undefined };
const whenSigned = <X>(x: X, ...hankos: readonly string[]): Result<X, HostError> => (hankos.every((h) => h.length > 0) ? ok(x) : err({ _tag: "unsigned" }));
export const acceptReceipt = (r: TowerReceiptV1): Result<TowerReceiptV1, HostError> => whenSigned(r, r.towerSignature);
export const acceptBundle = (b: AccountRecoveryBundleV1): Result<AccountRecoveryBundleV1, HostError> => whenSigned(b, b.latestCommitted.ownerFrameHanko, b.latestCommitted.counterpartyFrameHanko);
export const acceptAppointment = (a: TowerAppointmentV1): Result<TowerAppointmentV1, HostError> => whenSigned(a, a.ownerHanko);
