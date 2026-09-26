import { describe, expect, test } from "bun:test";
// og Runtime J subsystems (core/runtime/j-submit, core/runtime/registration, core/jurisdiction), each run against live og.
import { applyRuntimeTx as ogApplyRuntimeTx } from "../../core/runtime/tx/tx-handlers.ts";
import { buildJurisdictionImportRequestHash } from "../../core/runtime/j-submit/jurisdiction-import.ts";
import { buildReplayVerifiableRuntimePostStateView } from "../../core/storage/wal/snapshot.ts";
import { computeRuntimePostStateComponentDigests } from "../../core/storage/hashes.ts";
import { encodeBoard, hashBoard } from "../../core/entity/factory.ts";
import {
  applyRuntimeTx, createRuntime, jurisdictionImportRequestHash, replicaKey, runtimeComponentDigests, runtimeView,
  type EntityId, type ImportConfig, type Runtime, type RuntimeTx,
} from "../xln.ts";
import { aliceAddr, bobAddr, unwrap } from "../xln_run.ts";

let seed = 29;
const rng = (): number => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const ri = (n: number): number => Math.floor(rng() * n);
const pick = <T>(xs: readonly T[]): T => xs[ri(xs.length)] as T;
const hex = (bytes: number): string => `0x${Array.from({ length: bytes * 2 }, () => "0123456789abcdef"[ri(16)]).join("")}`;
const rwCode = (r: { readonly ok: boolean; readonly error?: unknown }): string | null => {
  if (r.ok) return null;
  const e = r.error as { _tag: string; code?: string };
  return String(e.code ?? e._tag).split(":")[0] ?? "";
};
const ogCode = (e: unknown): string => String((e as Error).message).split(":")[0] ?? "";

// ---- a live og RuntimeReplica next to a rewrite Runtime ----
type OgEnv = { state: { jReplicas: Map<string, unknown>; eReplicas: Map<string, unknown>; timestamp: number; height: number }; infrastructure: Record<string, unknown>; runtimeId?: string; activeJurisdiction?: string; browserVMState?: unknown };
const ogEnv = (): OgEnv => ({ state: { jReplicas: new Map(), eReplicas: new Map(), timestamp: 1_700_000_000_000, height: 0 }, infrastructure: {} });
const runOg = async (env: OgEnv, tx: unknown): Promise<string | null> => {
  try { await ogApplyRuntimeTx(env as never, structuredClone(tx) as never, { isReplay: true }); return null; } catch (e) { return ogCode(e); }
};
const ogDigests = (env: OgEnv): unknown => computeRuntimePostStateComponentDigests(buildReplayVerifiableRuntimePostStateView(env as never));
const rwDigests = (rt: Runtime): unknown => unwrap(runtimeComponentDigests(runtimeView(rt)));
type Pair = { env: OgEnv; rt: Runtime };
const newPair = (): Pair => ({ env: ogEnv(), rt: { ...createRuntime(), timestamp: 1_700_000_000_000n } });
/** Apply one RuntimeTx to both; the accept/reject decision and the post-state component digests must agree. */
const both = async (p: Pair, tx: RuntimeTx): Promise<string | null> => {
  const og = await runOg(p.env, tx);
  const rw = applyRuntimeTx(p.rt, tx, { replay: true });
  expect(rwCode(rw)).toBe(og);
  if (rw.ok) p.rt = rw.value;
  expect(rwDigests(p.rt)).toEqual(ogDigests(p.env) as never);
  return og;
};

const addr = (): string => hex(20);
const contractsOf = (): Record<string, string> => ({ depository: addr(), entityProvider: addr(), account: addr(), deltaTransformer: addr() });
const mangleContracts = (c: Record<string, string>): unknown => pick<unknown>([
  c, c, c, undefined, { ...c, account: undefined }, { ...c, depository: `0x${"00".repeat(20)}` }, { ...c, entityProvider: "0x1234" },
  { ...c, depository: (c["depository"] ?? "").toUpperCase().replace("0X", "0x") }, { ...c, deltaTransformer: `0xAb${(c["deltaTransformer"] ?? "").slice(4)}` },
  { ...c, account: (c["account"] ?? "").slice(2) },
]);
const randomRequest = (names: readonly string[]): Record<string, unknown> => {
  if (rng() < 0.55) {
    // Well-formed: a BrowserVM stack or one RPC stack with its full contracts and deployment block.
    const rpc = rng() < 0.5;
    return {
      name: pick(names), ticker: pick(["eth", "ETH"]), chainId: pick([31337, 8453]), rpcs: rpc ? [pick(["http://rpc.example:8545", "https://rpc.example/x"])] : [],
      ...(rpc ? { contracts: contractsOf(), entityProviderDeploymentBlock: pick([1, 7]) } : rng() < 0.5 ? { contracts: contractsOf() } : {}),
      ...(rng() < 0.3 ? { blockTimeMs: 12_000 } : {}), ...(rpc && rng() < 0.3 ? { rpcPolicy: "single" } : {}),
    };
  }
  const rpcs = pick<unknown>([[], [], ["http://rpc.example:8545"], ["https://rpc.example/x"], ["ws://rpc.example"], ["not a url"], ["http://a.example", "http://a.example"], ["http://a.example", "http://b.example"], [""], "http://x"]);
  const rpcBacked = Array.isArray(rpcs) && rpcs.length > 0;
  return {
    name: pick([...names, ...names, "", "x".repeat(129), ` ${names[0]} `]), ticker: pick(["eth", "ETH", "usd", "", "x".repeat(17)]),
    chainId: pick<unknown>([31337, 31337, 1, 8453, 0, -1, 1.5, "8453"]), rpcs,
    ...(rng() < (rpcBacked ? 0.85 : 0.2) ? { contracts: mangleContracts(contractsOf()) } : {}),
    ...(rng() < (rpcBacked ? 0.85 : 0.15) ? { entityProviderDeploymentBlock: pick<unknown>([1, 7, 100, 0, 2.5]) } : {}),
    ...(rng() < 0.3 ? { blockTimeMs: pick<unknown>([1000, 12_000, 0, -5, 1.5]) } : {}),
    ...(rng() < 0.2 ? { startAtCurrentBlock: pick<unknown>([true, false, "yes"]) } : {}),
    ...(rng() < 0.25 ? { rpcPolicy: pick<unknown>(["single", "failover", { mode: "quorum", min: 1 }, { mode: "quorum", min: 5 }, "other", null]) } : {}),
    ...(rng() < 0.1 ? { tokens: pick<unknown>([[], [{ symbol: "X", decimals: 18 }]]) } : {}),
  };
};
/** A result for a pending og import, mostly well-formed, sometimes answering the wrong intent or carrying bad fields. */
const randomResult = (pending: { importId: string; requestHash: string; request: Record<string, unknown> }): Record<string, unknown> => {
  const r = pending.request, browser = (r["rpcs"] as unknown[]).length === 0;
  const contracts = (r["contracts"] as Record<string, string> | undefined) ?? contractsOf();
  const token = (id: number): Record<string, unknown> => ({ symbol: "T", name: "Token", address: addr(), decimals: 18, tokenId: id, tokenType: 0, externalTokenId: 0n });
  const base: Record<string, unknown> = {
    importId: pending.importId, requestHash: pending.requestHash, name: r["name"], chainId: r["chainId"], ticker: r["ticker"], rpcs: r["rpcs"],
    ...(r["blockTimeMs"] !== undefined ? { blockTimeMs: r["blockTimeMs"] } : {}),
    blockNumber: pick(["0", "0", "12", "01", "-1", "x"]), stateRoot: browser ? pick([hex(32), hex(32), "0x12", null]) : pick([null, null, null, hex(32)]),
    watcherConfirmationDepth: pick<unknown>([0, 0, 2, -1, 1.5]), tokenRegistry: pick<unknown>([[], [], [token(2), token(1)], [token(1), token(1)], [{ ...token(1), tokenType: 3 }], [{ ...token(1), decimals: 256 }], [{ ...token(1), address: "0x12" }]]),
    entityProviderDeploymentBlock: pick<unknown>([r["entityProviderDeploymentBlock"] ?? 1, r["entityProviderDeploymentBlock"] ?? 1, 0]),
    contracts: pick<unknown>([contracts, contracts, contracts, contractsOf(), { ...contracts, account: undefined }]),
    ...(browser ? (rng() < 0.9 ? { browserVMState: { stateRoot: hex(32), trieData: [[hex(32), hex(8)]], nonce: 1 } } : {}) : rng() < 0.1 ? { browserVMState: { stateRoot: hex(32) } } : {}),
    ...(rng() < 0.1 ? { watcherReceiptCommitment: pick(["tron-rpc-attested", "other"]) } : {}),
  };
  if (rng() < 0.5) {
    const { watcherReceiptCommitment: _, ...rest } = base;
    return {
      ...rest, blockNumber: pick(["0", "12"]), stateRoot: browser ? hex(32) : null, watcherConfirmationDepth: pick([0, 2]), tokenRegistry: pick([[], [token(2), token(1)]]),
      entityProviderDeploymentBlock: r["entityProviderDeploymentBlock"] ?? 1, contracts,
      ...(browser ? { browserVMState: { stateRoot: hex(32), trieData: [[hex(32), hex(8)]], nonce: 1 } } : { browserVMState: undefined }),
    };
  }
  return pick([base, base, base, base, { ...base, importId: hex(32) }, { ...base, ticker: "OTHER" }, { ...base, rpcs: ["http://other.example/"] }]);
};

describe("runtime-j: the J import registry (og runtime/j-submit/jurisdiction-import.ts)", () => {
  test("MATCH: the importJ request hash is og buildJurisdictionImportRequestHash over the normalized request", () => {
    let hashed = 0;
    for (let i = 0; i < 300; i++) {
      const req = randomRequest(["Local", "Base"]);
      let og: string | null = null, ogErr: string | null = null;
      try { og = buildJurisdictionImportRequestHash(structuredClone(req) as never); } catch (e) { ogErr = ogCode(e); }
      const rw = jurisdictionImportRequestHash(req as never);
      expect(rwCode(rw)).toBe(ogErr);
      if (rw.ok) { expect(rw.value).toBe(og ?? ""); hashed++; }
    }
    expect(hashed).toBeGreaterThan(30);
  });

  test("MATCH (randomized): importJ / completeImportJ / advanceJWatcherCursor sequences -- same decisions, same post-state component digests", async () => {
    let accepted = 0, installed = 0, cursors = 0;
    for (let run = 0; run < 60; run++) {
      const p = newPair(), names = pick([["Local"], ["Local", "Base"], ["Local", "Base", "Arb"]]);
      for (let step = 0; step < 14; step++) {
        const pending = [...((p.env.infrastructure["pendingJurisdictionImports"] as Map<string, never> | undefined)?.values() ?? [])];
        const replicas = [...p.env.state.jReplicas.values()] as { contracts?: { depository?: string }; chainId?: number; blockNumber: bigint }[];
        const roll = rng();
        if (roll < 0.45 || (pending.length === 0 && replicas.length === 0)) {
          if ((await both(p, { type: "importJ", data: randomRequest(names) } as never)) === null) accepted++;
        } else if (roll < 0.8 && pending.length > 0) {
          const before = p.env.state.jReplicas.size;
          await both(p, { type: "completeImportJ", data: randomResult(pick(pending)) } as never);
          if (p.env.state.jReplicas.size > before) installed++;
        } else if (roll < 0.9 && replicas.length > 0) {
          // A result replayed after its intent completed (og IMPORT_J_RESULT_STALE / existing-replica match).
          await both(p, { type: "completeImportJ", data: randomResult({ importId: hex(32), requestHash: hex(32), request: { name: pick(names), chainId: 31337, ticker: "ETH", rpcs: [] } }) } as never);
        } else {
          const target = replicas.length > 0 ? pick(replicas) : undefined;
          const data = {
            depositoryAddress: pick<unknown>([target?.contracts?.depository, target?.contracts?.depository?.toUpperCase().replace("0X", "0x"), addr(), undefined, ""]),
            chainId: pick<unknown>([target?.chainId, target?.chainId, 1, undefined, 0]), blockNumber: pick<unknown>([ri(50), ri(50), 0, -1, 2.5]),
          };
          if ((await both(p, { type: "advanceJWatcherCursor", data } as never)) === null) cursors++;
        }
      }
      expect(p.rt.activeJurisdiction).toBe(p.env.activeJurisdiction);
    }
    expect(accepted).toBeGreaterThan(40);
    expect(installed).toBeGreaterThan(10);
    expect(cursors).toBeGreaterThan(5);
  });
});

// ---- importReplica binds its jurisdiction through the J replica registry (og requireBoundEntityConfig) ----
const SEED = "0x" + "5e".repeat(64);
describe("runtime-j: importReplica jurisdiction binding (og jurisdiction-runtime requireBoundEntityConfig)", () => {
  test("MATCH (randomized): the named / active / stack-ref J replica completes the config; unavailable, incomplete and conflicting stacks are refused", async () => {
    let imported = 0;
    for (let run = 0; run < 80; run++) {
      const p = newPair();
      const stacks = Array.from({ length: 1 + ri(2) }, (_, i) => ({ name: ["Local", "Base"][i] ?? "Local", chainId: pick([31337, 8453]), contracts: contractsOf() }));
      for (const s of stacks) {
        const replica = { name: s.name, blockNumber: 0n, stateRoot: null, mempool: [], blockDelayMs: 300, lastBlockTimestamp: 0, position: { x: 0, y: 50, z: 0 }, rpcs: ["http://rpc.example/"], chainId: s.chainId, entityProviderDeploymentBlock: 1, contracts: s.contracts };
        const keep = rng() < 0.85;
        p.env.state.jReplicas.set(s.name, keep ? structuredClone(replica) : { ...structuredClone(replica), contracts: undefined, chainId: undefined });
        p.rt = { ...p.rt, jReplicas: new Map([...p.rt.jReplicas, [s.name, keep ? replica : { ...replica, contracts: undefined, chainId: undefined }]]) };
      }
      if (rng() < 0.3) { p.env.activeJurisdiction = stacks[0]?.name ?? ""; p.rt = { ...p.rt, activeJurisdiction: stacks[0]?.name }; }
      const s = pick(stacks);
      const jurisdiction = pick<unknown>([
        { name: s.name },
        { name: s.name.toLowerCase() },
        { name: "Nowhere" },
        { name: "" },
        undefined,
        { name: s.name, chainId: s.chainId, depositoryAddress: s.contracts.depository, entityProviderAddress: s.contracts.entityProvider },
        { name: s.name, chainId: 99, depositoryAddress: addr(), entityProviderAddress: addr() },
        { name: `stack:${s.chainId}:${s.contracts.depository}` },
        { name: `stack:${s.chainId}:${addr()}` },
      ]);
      for (const signer of rng() < 0.5 ? [aliceAddr] : [aliceAddr, bobAddr]) {
        const validators = [aliceAddr, bobAddr];
        const config = { mode: "proposer-based", threshold: 1n, validators, shares: { [aliceAddr]: 1n, [bobAddr]: 1n }, ...(jurisdiction === undefined ? {} : { jurisdiction }) } as unknown as ImportConfig;
        const entityId = hashBoard(encodeBoard(config as never)).toLowerCase();
        const tx = { type: "importReplica", entityId, signerId: signer, data: { config, isProposer: signer === aliceAddr, entitySeed: SEED } } as unknown as RuntimeTx;
        const og = await runOg(p.env, tx);
        const rw = applyRuntimeTx(p.rt, tx, { replay: true });
        expect(rwCode(rw)).toBe(og);
        if (!rw.ok) continue;
        p.rt = rw.value;
        imported++;
        const ogReplica = [...p.env.state.eReplicas.values()].find((r) => (r as { signerId: string }).signerId.toLowerCase() === signer.toLowerCase()) as { state: { config: { jurisdiction: Record<string, unknown> } } };
        const bound = ogReplica.state.config.jurisdiction;
        const mine = p.rt.entities.get(replicaKey(entityId as EntityId, signer));
        expect(mine?.state.jurisdiction.depositoryAddress.toLowerCase()).toBe(String(bound["depositoryAddress"]).toLowerCase());
        expect(mine?.state.jurisdiction.chainId).toBe(bound["chainId"] as number);
        expect(mine?.state.jurisdictionConfig?.entityProviderAddress.toLowerCase()).toBe(String(bound["entityProviderAddress"]).toLowerCase());
        expect(mine?.state.jurisdictionConfig?.name).toBe(bound["name"] as string);
      }
    }
    expect(imported).toBeGreaterThan(40);
  });
});
