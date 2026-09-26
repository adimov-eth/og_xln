// consensus-final: Entity/Account consensus, admission, boards, orderbook and wire shapes (final wave). Every test runs og (core/ at 566c850) live.
import { describe, expect, test } from "bun:test";
import { x25519 } from "@noble/curves/ed25519";
import { assertEntityEncryptionKeypair } from "../../core/protocol/htlc/multi-recipient.ts";
import { requireEntityEncryptionPrivateKey } from "../../core/entity/auth/crypto.ts";
import { computeEntityProfileHash } from "../../core/entity/profile/profile-descriptor.ts";
import {
  accountId as rwAccountId, applyEntityInput, createEntity, entityId, entityProfileHash, foldTxs, genesisReplica, quorumBoardHash,
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
