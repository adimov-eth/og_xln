// consensus-final: Entity/Account consensus, admission, boards, orderbook and wire shapes (final wave). Every test runs og (core/ at 566c850) live.
import { describe, expect, test } from "bun:test";
import { x25519 } from "@noble/curves/ed25519";
import { ethers } from "ethers";
import { assertEntityEncryptionKeypair } from "../../core/protocol/htlc/multi-recipient.ts";
import { requireEntityEncryptionPrivateKey } from "../../core/entity/auth/crypto.ts";
import { computeEntityProfileHash } from "../../core/entity/profile/profile-descriptor.ts";
import {
  accountId as rwAccountId, applyEntityInput, createEntity, entityId, entityProfileHash, foldTxs, genesisReplica, parseEvmTx, quorumBoardHash,
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

describe("consensus-final: the profile descriptor is re-certified by the frame (og entity/profile/profile-descriptor.ts)", () => {
  test("MATCH (og computeEntityProfileHash): 150 random Entities with pinned and unpinned Accounts, hub configs, jurisdictions, and over 100 pinned rows", () => {
    const tiers = [0n, 999n, 1000n, 5_000n, 12_345n, 10n ** 18n] as const;
    for (let i = 0; i < 150; i++) {
      const id = hex32(), many = i % 25 === 0, count = many ? 101 + ri(6) : ri(6);
      const jc = pick([undefined, { name: "  Anvil ", entityProviderAddress: "0xAbCdEf0000000000000000000000000000000001" }, { name: "", entityProviderAddress: "0x" + "22".repeat(20) }]);
      const hub = pick([undefined, { routingFeePPM: ri(500), baseFee: BigInt(ri(9)), policyVersion: 1, rebalanceLiquidityFeeBps: BigInt(ri(50)), rebalanceGasFee: 7n, hubName: pick(["", "H1"]), ...(rng() < 0.5 ? { swapTakerFeeBps: ri(30), rebalanceBaseFee: 3n, rebalanceTimeoutMs: 60_000 } : {}) }]);
      const profile = { name: pick(["", " Hub A ", "b"]), isHub: rng() < 0.5, avatar: pick(["", "a.png"]), bio: "", website: pick(["", "https://x"]), ...(rng() < 0.3 ? { entityKind: "business", sectors: pick([[], ["finance"]]) } : {}) };
      const key = pick([undefined, pubOf(hex32())]);
      const replicas = new Map<string, unknown>(), ogAccounts = new Map<string, unknown>();
      for (let a = 0; a < count; a++) {
        const peer = hex32(), aid = unwrap(rwAccountId(id as EntityId, peer as EntityId)), pinned = many || rng() < 0.7;
        const deltas = new Map<number, Record<string, bigint | number>>();
        for (let t = 0, n = ri(4); t < n; t++) {
          const tk = pick([1, 2, 3, 10, 7]);
          deltas.set(tk, { tokenId: tk, collateral: pick(tiers), ondelta: pick(tiers) - pick(tiers), offdelta: pick(tiers) - pick(tiers), leftCreditLimit: pick(tiers), rightCreditLimit: pick(tiers) });
        }
        const g = unwrap(genesisReplica(aid, TERMS)) as unknown as { state: { account: { deltas: unknown } } };
        replicas.set(peer, { ...g, state: { ...g.state, account: { ...g.state.account, deltas } }, ...(pinned ? { publicPinned: true } : {}) });
        ogAccounts.set(peer, { ...(pinned ? { publicPinned: true } : {}), state: { leftEntity: aid.left, rightEntity: aid.right, domain: TERMS.domain,
          deltas: new Map([...deltas].map(([tk, d]) => [tk, { ...d, leftAllowance: 0n, rightAllowance: 0n, leftHold: 0n, rightHold: 0n }])) } });
      }
      const r = unwrap(createEntity({ id: id as EntityId, jurisdiction: TERMS.domain, threshold: 1n, members: new Map([[aliceAddr, { shares: 1n }]]), ...(jc === undefined ? {} : { jurisdictionConfig: jc }),
        committed: { profile, ...(hub === undefined ? {} : { hubRebalanceConfig: hub }), ...(key === undefined ? {} : { entityEncryptionPublicKey: key }) } as never }));
      const og = computeEntityProfileHash({ entityId: id, entityEncryptionPublicKey: key ?? "", profile, hubRebalanceConfig: hub, accounts: ogAccounts,
        config: { jurisdiction: jc === undefined ? undefined : { chainId: TERMS.domain.chainId, depositoryAddress: TERMS.domain.depositoryAddress, ...jc } } } as never);
      expect([i, unwrap(entityProfileHash(r.state, replicas as never))]).toEqual([i, og]);
    }
  });
  test("MATCH (og appendFinalProfileHash / buildChangedEntityProfileHashToSign): the genesis frame always signs the profile hash; later frames only when the descriptor changed", () => {
    const id = lazyEntity(aliceAddr), ctx = { verify: verifiers.verify, timestamp: 5n };
    const r = unwrap(createEntity({ id, jurisdiction: TERMS.domain, threshold: 1n, members: new Map([[aliceAddr, { shares: 1n }]]), committed: { profile: { name: "A", isHub: false, avatar: "", bio: "", website: "" } } as never }));
    const ogHashOf = (profile: unknown): string => computeEntityProfileHash({ entityId: id, entityEncryptionPublicKey: "", profile, accounts: new Map(), config: {} } as never);
    const chat = (n: number): EntityTx => ({ type: "chat", data: { from: aliceAddr.toLowerCase(), message: `m${n}` } });
    const profilesOf = (s: typeof r.state, txs: readonly EntityTx[]) => { const f = unwrap(foldTxs(s, new Map(), txs, ctx)); return { state: f.draft.state, profiles: (f.draft.hashes ?? []).filter((h) => h.type === "profile") }; };
    const genesis = profilesOf(r.state, [chat(0)]);
    const h0 = ogHashOf({ name: "A", isHub: false, avatar: "", bio: "", website: "" });
    expect(genesis.profiles).toEqual([{ hash: h0, type: "profile", context: `profile:${h0}` }]);
    const later = { ...genesis.state, height: 1n };
    expect(profilesOf(later, [chat(1)]).profiles).toEqual([]);
    const renamed = profilesOf(later, [{ type: "profile-update", data: { profile: { entityId: id, name: " B ", bio: "hi" } } } as EntityTx]);
    const h1 = ogHashOf(renamed.state.committed["profile"]);
    expect(h1).not.toBe(h0);
    expect(renamed.profiles).toEqual([{ hash: h1, type: "profile", context: `profile:${h1}` }]);
  });
});

describe("consensus-final: ethers v6 Transaction.from for blob (type 3) and set-code (type 4) transactions (entity-j.md EJ-R4)", () => {
  const erng = prng(0x3_4e_4);
  const eri = (n: number) => Math.floor(erng() * n);
  const epick = <X,>(xs: readonly X[]): X => xs[eri(xs.length)] as X;
  const ehex = (bytes: number): string => `0x${Array.from({ length: bytes * 2 }, () => "0123456789abcdef"[eri(16)]).join("")}`;
  const wallets = [1, 2].map((i) => new ethers.Wallet(`0x${String(i).padStart(2, "0").repeat(32)}`));
  const versioned = (): string => `0x01${ehex(31).slice(2)}`;
  /** A random signed type 3 (bare, EIP-4844 sidecar or EIP-7594 sidecar) or type 4 transaction, serialized by ethers. */
  const signed = (): string => {
    const type = epick([3, 3, 4, 4]);
    const tx = ethers.Transaction.from({
      type, chainId: epick([1n, 31337n, 8453n]), nonce: epick([0, 1, 300, 70_000]), gasLimit: 21_000n + BigInt(eri(500_000)), to: epick([ehex(20), ehex(20)]),
      value: epick([0n, 1n, 10n ** 18n]), data: epick(["0x", ehex(4 + eri(40))]), maxPriorityFeePerGas: BigInt(eri(3)) * 1_000_000_000n, maxFeePerGas: 3_000_000_000n + BigInt(eri(1000)),
      ...(eri(3) === 0 ? { accessList: [{ address: ehex(20), storageKeys: Array.from({ length: eri(3) }, () => ehex(32)) }] } : {}),
      ...(type === 3 ? { maxFeePerBlobGas: BigInt(eri(1_000_000)), blobVersionedHashes: Array.from({ length: 1 + eri(3) }, versioned) } : {}),
      ...(type === 4 ? { authorizationList: Array.from({ length: eri(3) }, () => ({ address: ehex(20), nonce: BigInt(eri(1000)), chainId: epick([0n, 1n, 31337n]), signature: epick(wallets).signingKey.sign(ehex(32)) })) } : {}),
    });
    if (type === 3 && eri(2) === 0) {
      const eip7594 = eri(2) === 0, n = 1 + eri(2);
      if (eip7594) tx.blobWrapperVersion = 1;
      tx.blobs = Array.from({ length: n }, () => ({ data: ehex(1 + eri(64)), commitment: ehex(48), proof: eip7594 ? ehex(128 * 2) : ehex(48) }));
    }
    tx.signature = epick(wallets).signingKey.sign(tx.unsignedHash);
    return tx.serialized;
  };
  type F = string | F[];
  const be = (n: bigint): string => (n === 0n ? "0x" : ethers.toBeHex(n));
  const arr = (x: F | undefined): F[] => (Array.isArray(x) ? x : []);
  const big = (h: F | undefined): bigint => (typeof h !== "string" || h === "0x" ? 0n : BigInt(h));
  /** One structural mutation of a type 3/4 transaction: its fields, its sidecar, its authorizations, or its raw bytes. */
  const mutate = (raw: string): string => {
    const bytes = ethers.getBytes(raw);
    const flip = (): string => { const b = new Uint8Array(bytes); b[eri(b.length)] ^= 1 << eri(8); return ethers.hexlify(b); };
    let decoded: F;
    try { decoded = ethers.decodeRlp(bytes.slice(1)) as F; } catch { return flip(); }
    if (!Array.isArray(decoded)) return flip();
    const wrapped = Array.isArray(decoded[0]), outer = decoded as F[], fields = [...(wrapped ? (outer[0] as F[]) : outer)];
    const encode = (fs: F[], wrap: F[] | null = wrapped ? [...outer] : null): string => ethers.concat([bytes.slice(0, 1), ethers.encodeRlp((wrap === null ? fs : [fs, ...wrap.slice(1)]) as never)]);
    const set = (i: number, v: F): string => { const fs = [...fields]; fs[i] = v; return encode(fs); };
    const type = bytes[0], sig = fields.length - 3, auths = type === 4 && Array.isArray(fields[9]) && Array.isArray((fields[9] as F[])[0]) ? (fields[9] as F[]) : [];
    const setAuth = (j: number, v: F): string => { const a = [...auths], row = [...(a[0] as F[])]; row[j] = v; a[0] = row; return set(9, a); };
    switch (eri(22)) {
      case 0: return flip();
      case 1: return ethers.hexlify(bytes.slice(0, Math.max(1, bytes.length - 1 - eri(4))));
      case 2: return set(5, "0x");
      case 3: return set(5, epick([ehex(19), ehex(21)]));
      case 4: return type === 3 ? set(10, [...arr(fields[10]), epick([ehex(31), ehex(33), [ehex(32)]])]) : set(9, epick(["0x", [[ehex(20)]], [["0x01", ehex(20), "0x", "0x", "0x01", "0x01", "0x"]]]));
      case 5: return type === 3 ? set(10, epick(["0x", ehex(32)])) : auths.length > 0 ? setAuth(1, epick(["0x", ehex(19), [ehex(20)]])) : set(9, [["0x01", ehex(20), "0x", "0x", ehex(32), ehex(32)]]);
      case 6: return type === 3 ? set(9, epick([ehex(33), "0x00", "0x0001"])) : auths.length > 0 ? setAuth(3, epick(["0x02", "0x", "0x01", "0x0001"])) : encode(fields);
      case 7: return auths.length > 0 ? setAuth(5, be(big((auths[0] as F[])[5]) | (1n << 255n))) : set(sig + 2, be(big(fields[sig + 2]) | (1n << 255n)));
      case 8: return auths.length > 0 ? setAuth(4, epick(["0x", ehex(33), `0x00${ehex(32).slice(2)}`])) : encode(fields);
      case 9: return set(sig, epick(["0x02", "0x00", "0x01", "0x", "0x0001"]));
      case 10: return set(sig + 1, epick(["0x", ehex(33)]));
      case 11: return set(sig + 2, "0x");
      case 12: { const fs = [...fields]; fs[2] = be(big(fields[3]) + 1n); return encode(fs); }
      case 13: return encode(fields.slice(0, sig));
      case 14: return encode(eri(2) === 0 ? [...fields, "0x"] : fields.slice(0, -1));
      case 15: return set(8, epick([[[ehex(20), [ehex(31)]]], [[ehex(19), []]], [ehex(20)]]));
      case 16: if (wrapped) { const w = [...outer]; w[1] = epick(["0x02", "0x", "0x0001", [ehex(1)]]); return encode(fields, w); } return encode(fields, [fields, [ehex(4)], [ehex(48)], [ehex(48)]]);
      case 17: if (wrapped) { const w = [...outer], k = 1 + eri(w.length - 1); w[k] = epick([[], [...arr(w[k]), ehex(48)], "0x"]); return encode(fields, w); } return encode(fields, [fields, "0x01", [ehex(4)], [ehex(48)], Array.from({ length: 128 }, () => ehex(2))]);
      case 18: if (wrapped) { const w = [...outer], k = w.length - 3; w[k] = [[ehex(2)]]; return encode(fields, w); } return set(1, `0x00${fields[1] === "0x" ? "" : (fields[1] as string).slice(2)}`);
      case 19: return ethers.concat([epick(["0x03", "0x04"]), bytes.slice(1)]);
      case 20: return set(0, "0x");
      default: return set(7, [fields[7] as F]);
    }
  };
  const ethersView = (raw: string): unknown => {
    try {
      const t = ethers.Transaction.from(raw), hash = t.hash;
      let from: string | null;
      try { from = t.from?.toLowerCase() ?? null; } catch { from = "ERR"; }
      return { type: t.type, hash, from, chainId: t.chainId, nonce: t.nonce, to: t.to?.toLowerCase() ?? null, value: t.value, data: t.data.toLowerCase() };
    } catch { return "REFUSED"; }
  };
  const rewriteView = (raw: string): unknown => {
    const r = parseEvmTx(raw);
    if (!r.ok) return "REFUSED";
    const t = r.value;
    return { type: t.type, hash: t.hash, from: t.from === null ? null : t.from.ok ? t.from.value : "ERR", chainId: t.chainId, nonce: t.nonce, to: t.to, value: t.value, data: t.data };
  };
  test("MATCH (randomized): 1500 signed type 3 (bare, 4844 and 7594 sidecars) and type 4 transactions and their mutations -- same refusal, hash, sender, chain, nonce, to, value, data", () => {
    const seen = { accepted3: 0, accepted4: 0, sidecar: 0, refused: 0 };
    for (let i = 0; i < 1500; i++) {
      let raw = signed();
      if (ethers.decodeRlp(ethers.getBytes(raw).slice(1)).length < 6) seen.sidecar++;
      for (let m = eri(3); m > 0; m--) raw = mutate(raw);
      const og = ethersView(raw);
      expect([i, raw, rewriteView(raw)]).toEqual([i, raw, og] as never);
      if (og === "REFUSED") seen.refused++; else if ((og as { type: number }).type === 3) seen.accepted3++; else seen.accepted4++;
    }
    expect(seen.accepted3).toBeGreaterThan(150);
    expect(seen.accepted4).toBeGreaterThan(150);
    expect(seen.sidecar).toBeGreaterThan(150);
    expect(seen.refused).toBeGreaterThan(300);
  }, 120_000);
});
