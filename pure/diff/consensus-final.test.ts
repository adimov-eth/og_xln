// consensus-final: Entity/Account consensus, admission, boards, orderbook and wire shapes (final wave). Every test runs og (core/ at 566c850) live.
import { describe, expect, test } from "bun:test";
import { x25519 } from "@noble/curves/ed25519";
import { assertEntityEncryptionKeypair } from "../../core/protocol/htlc/multi-recipient.ts";
import { requireEntityEncryptionPrivateKey } from "../../core/entity/auth/crypto.ts";
import {
  applyEntityInput, createEntity, entityId, quorumBoardHash,
  type Address, type EntityId, type EntityInput, type EntityTx,
} from "../xln.ts";
import { TERMS, aliceAddr, unwrap, verifiers } from "../xln_run.ts";

const prng = (seed: number) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const rng = prng(0xc0_f1a1);
const ri = (n: number) => Math.floor(rng() * n);
const pick = <X,>(xs: readonly X[]): X => xs[ri(xs.length)] as X;
const hex32 = (): string => "0x" + Array.from({ length: 32 }, () => ri(256).toString(16).padStart(2, "0")).join("");
const pubOf = (priv: string): string => "0x" + Buffer.from(x25519.getPublicKey(Buffer.from(priv.slice(2), "hex"))).toString("hex");
const ogRun = <T,>(f: () => T): { ok: true; value: T } | { ok: false; code: string } => { try { return { ok: true, value: f() }; } catch (e) { return { ok: false, code: (e as Error).message }; } };
const lazyEntity = (signer: Address): EntityId => unwrap(entityId(quorumBoardHash({ _tag: "teaching", threshold: 1n, members: new Map([[signer, { shares: 1n }]]) })));

describe("consensus-final: the Entity encryption keypair on every frame (cross-j.md row 48)", () => {
  test("MATCH (og requireEntityEncryptionPrivateKey + assertEntityEncryptionKeypair): 200 random frames with no HTLC tx -- a missing, wrong, or malformed key refuses the proposal with og's error", () => {
    const seen = new Map<string, number>();
    for (let i = 0; i < 200; i++) {
      const priv = hex32(), variant = pick(["ok", "ok", "missing", "wrong", "badPub", "zeroPriv", "shortPriv"] as const);
      const pub = variant === "badPub" ? "0x12" : pubOf(priv);
      const given = variant === "missing" ? undefined : variant === "wrong" ? hex32() : variant === "zeroPriv" ? `0x${"00".repeat(32)}` : variant === "shortPriv" ? "0x1234" : priv;
      const id = lazyEntity(aliceAddr);
      const r = unwrap(createEntity({ id, jurisdiction: TERMS.domain, threshold: 1n, members: new Map([[aliceAddr, { shares: 1n }]]), committed: { entityEncryptionPublicKey: pub } }));
      // og: the key comes from the Runtime's key store (requireEntityEncryptionPrivateKey), then the pair is checked whatever the frame holds
      const og = ogRun(() => {
        const key = requireEntityEncryptionPrivateKey({ infrastructure: { entityEncryptionPrivateKeys: new Map(given === undefined ? [] : [[id, given]]) } } as never, id);
        assertEntityEncryptionKeypair(pub, key);
      });
      const chat: EntityTx = { type: "chat", data: { from: aliceAddr.toLowerCase(), message: `m${i}` } };
      const input: EntityInput = { kind: "txs", timestamp: 1n, txs: [chat] };
      const rw = applyEntityInput(r, input, { ...verifiers, self: id, signerId: aliceAddr, ...(given === undefined ? {} : { htlc: { profiles: [], encryptionPrivateKey: given } }) });
      expect([variant, rw.ok]).toEqual([variant, og.ok]);
      if (!og.ok && !rw.ok) expect((rw.error as { reason?: string }).reason).toBe(og.code);
      seen.set(`${variant}:${og.ok}`, (seen.get(`${variant}:${og.ok}`) ?? 0) + 1);
    }
    for (const k of ["ok:true", "missing:false", "wrong:false", "badPub:false", "zeroPriv:false", "shortPriv:false"]) expect(seen.get(k) ?? 0).toBeGreaterThan(0);
  });
});
