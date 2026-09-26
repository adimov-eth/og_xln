import { describe, expect, test } from "bun:test";
// Runtime transport, scheduling and events, each run against live og (core/runtime, core/entity, core/account).
import { applyRuntimeTx as ogApplyRuntimeTx } from "../../core/runtime/tx/tx-handlers.ts";
import { computeCanonicalEntityConsensusStateHash } from "../../core/entity/consensus/state-root.ts";
import { encodeBoard, hashBoard } from "../../core/entity/factory.ts";
import {
  applyRuntimeTx, createRuntime, entityRootOf, replicaKey,
  type EntityId, type ImportConfig, type JReplica, type Runtime, type RuntimeTx,
} from "../xln.ts";
import { aliceAddr, bobAddr, unwrap } from "../xln_run.ts";

let seed = 71;
const rng = (): number => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const ri = (n: number): number => Math.floor(rng() * n);
const pick = <T>(xs: readonly T[]): T => xs[ri(xs.length)] as T;
const rwCode = (r: { readonly ok: boolean; readonly error?: unknown }): string | null => {
  if (r.ok) return null;
  const e = r.error as { _tag: string; code?: string };
  return String(e.code ?? e._tag).split(":")[0] ?? "";
};
const ogCode = (e: unknown): string => String((e as Error).message).split(":")[0] ?? "";
/** A tree deep copy (Bun's structuredClone mis-decodes repeated references). */
const treeClone = <T>(v: T): T => {
  if (v === null || typeof v !== "object") return v;
  if (v instanceof Uint8Array) return new Uint8Array(v) as T;
  if (v instanceof Map) return new Map([...v].map(([k, x]) => [treeClone(k), treeClone(x)])) as T;
  if (v instanceof Set) return new Set([...v].map(treeClone)) as T;
  if (Array.isArray(v)) return v.map(treeClone) as T;
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, treeClone(x)])) as T;
};
type OgEnv = { state: { jReplicas: Map<string, unknown>; eReplicas: Map<string, unknown>; timestamp: number; height: number }; infrastructure: Record<string, unknown>; activeJurisdiction?: string };
const ogEnv = (): OgEnv => ({ state: { jReplicas: new Map(), eReplicas: new Map(), timestamp: 1_700_000_000_000, height: 0 }, infrastructure: {} });
const runOg = async (env: OgEnv, tx: unknown): Promise<string | null> => {
  try { await ogApplyRuntimeTx(env as never, treeClone(tx) as never, { isReplay: true }); return null; } catch (e) { return ogCode(e); }
};

// ---- R2-6b / RG-1: the importReplica genesis replica (og buildGenesisReplica) ----
const SEED = "0x" + "5e".repeat(64);
describe("runtime-final: importReplica genesis (og tx-handlers.ts buildGenesisReplica)", () => {
  test("MATCH (randomized): profile name, swap pairs, crontab and position -- the genesis Entity root equals og computeCanonicalEntityConsensusStateHash", async () => {
    let imported = 0;
    for (let run = 0; run < 24; run++) {
      const env = ogEnv();
      const name = pick(["Local", "Tron", "rpc2", "Base"]), chainId = pick([31337, 31338, 8453]);
      const replica = { name, blockNumber: 0n, stateRoot: null, mempool: [], blockDelayMs: 300, lastBlockTimestamp: 0, position: { x: 0, y: 50, z: 0 }, rpcs: ["http://rpc.example/"], chainId,
        entityProviderDeploymentBlock: pick([1, 9]), contracts: { depository: "0x5fbdb2315678afecb367f032d93f642f64180aa3", entityProvider: "0xe7f1725e7734ce288f8367e1bb143e90bb3f0512", account: "0x" + "12".repeat(20), deltaTransformer: "0x" + "34".repeat(20) } };
      env.state.jReplicas.set(name, treeClone(replica));
      let rt: Runtime = { ...createRuntime([treeClone(replica) as unknown as JReplica]), timestamp: 1_700_000_000_000n };
      const config = { mode: "proposer-based", threshold: 1n, validators: [aliceAddr, bobAddr], shares: { [aliceAddr]: 1n, [bobAddr]: 1n }, jurisdiction: { name } } as unknown as ImportConfig;
      const entityId = hashBoard(encodeBoard(config as never)).toLowerCase();
      const profileName = pick<string | undefined>([undefined, "", "  ", " Hub One ", "alice"]);
      const position = pick<unknown>([undefined, { x: 1, y: 2, z: 3 }, { x: 1, y: 2, z: 3, jurisdiction: "Other" }]);
      const tx = { type: "importReplica", entityId, signerId: aliceAddr, data: { config, isProposer: true, entitySeed: SEED, ...(profileName === undefined ? {} : { profileName }), ...(position === undefined ? {} : { position }) } } as unknown as RuntimeTx;
      const og = await runOg(env, tx);
      const rw = applyRuntimeTx(rt, tx, { replay: true });
      expect(rwCode(rw)).toBe(og);
      if (!rw.ok) continue;
      rt = rw.value;
      imported++;
      const ogReplica = env.state.eReplicas.get(`${entityId}:${aliceAddr.toLowerCase()}`) as { state: unknown; position?: unknown } | undefined;
      const mine = rt.entities.get(replicaKey(entityId as EntityId, aliceAddr));
      if (ogReplica === undefined || mine === undefined) throw new Error("replica missing");
      expect(unwrap(entityRootOf(mine.state, mine.accountReplicas))).toBe(computeCanonicalEntityConsensusStateHash(ogReplica.state as never));
      expect(rt.replicaLocal.get(replicaKey(entityId as EntityId, aliceAddr))?.position ?? null).toEqual((ogReplica.position ?? null) as never);
      // The sibling validator joins the same genesis Entity.
      const bobPosition = pick<unknown>([undefined, { x: 4, y: 5, z: 6 }]);
      const bobTx = { type: "importReplica", entityId, signerId: bobAddr, data: { config, isProposer: false, entitySeed: SEED, ...(bobPosition === undefined ? {} : { position: bobPosition }) } } as unknown as RuntimeTx;
      expect(rwCode(applyRuntimeTx(rt, bobTx, { replay: true }))).toBe(await runOg(env, bobTx));
      rt = unwrap(applyRuntimeTx(rt, bobTx, { replay: true }));
      const ogBob = env.state.eReplicas.get(`${entityId}:${bobAddr.toLowerCase()}`) as { state: unknown; position?: unknown };
      const bob = rt.entities.get(replicaKey(entityId as EntityId, bobAddr));
      if (bob === undefined) throw new Error("replica missing");
      expect(unwrap(entityRootOf(bob.state, bob.accountReplicas))).toBe(computeCanonicalEntityConsensusStateHash(ogBob.state as never));
      expect(rt.replicaLocal.get(replicaKey(entityId as EntityId, bobAddr))?.position ?? null).toEqual((ogBob.position ?? null) as never);
    }
    expect(imported).toBeGreaterThan(20);
  });
});
