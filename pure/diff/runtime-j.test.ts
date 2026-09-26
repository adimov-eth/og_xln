import { describe, expect, test } from "bun:test";
// og Runtime J subsystems (core/runtime/j-submit, core/runtime/registration, core/jurisdiction), each run against live og.
import { applyRuntimeTx as ogApplyRuntimeTx } from "../../core/runtime/tx/tx-handlers.ts";
import { buildJurisdictionImportRequestHash } from "../../core/runtime/j-submit/jurisdiction-import.ts";
import { buildReplayVerifiableRuntimePostStateView } from "../../core/storage/wal/snapshot.ts";
import { computeRuntimePostStateComponentDigests } from "../../core/storage/hashes.ts";
import { encodeBoard, hashBoard } from "../../core/entity/factory.ts";
import { buildJSubmitAttemptId, registerPendingCommittedJOutbox, splitJOutboxForDurableSubmit } from "../../core/runtime/j-submit/j-submit-state.ts";
import { assertProposeAccountsNowTxAuthorized } from "../../core/runtime/mempool/propose-accounts-now.ts";
import {
  applyRuntime, applyRuntimeTx, createEntity, createRuntime, initJBatch, jSubmitAttemptId, jurisdictionImportRequestHash, replicaKey, runtimeComponentDigests, runtimeView, stableJson,
  type Binary, type EntityId, type EntityReplica, type EntityTx, type ImportConfig, type JInput, type Runtime, type RuntimeTx,
} from "../xln.ts";
import { ALICE, TERMS, aliceAddr, bobAddr, unwrap, verifiers } from "../xln_run.ts";

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
/** A tree deep copy. Bun's structuredClone mis-decodes repeated references (a shared array came back as 1n, a shared object as its sibling), so harness snapshots never share. */
const treeClone = <T>(v: T): T => {
  if (v === null || typeof v !== "object") return v;
  if (v instanceof Uint8Array) return new Uint8Array(v) as T;
  if (v instanceof Map) return new Map([...v].map(([k, x]) => [treeClone(k), treeClone(x)])) as T;
  if (v instanceof Set) return new Set([...v].map(treeClone)) as T;
  if (Array.isArray(v)) return v.map(treeClone) as T;
  return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, treeClone(x)])) as T;
};

// ---- a live og RuntimeReplica next to a rewrite Runtime ----
type OgEnv = { state: { jReplicas: Map<string, unknown>; eReplicas: Map<string, unknown>; timestamp: number; height: number }; infrastructure: Record<string, unknown>; runtimeId?: string; activeJurisdiction?: string; browserVMState?: unknown };
const ogEnv = (): OgEnv => ({ state: { jReplicas: new Map(), eReplicas: new Map(), timestamp: 1_700_000_000_000, height: 0 }, infrastructure: {} });
const runOg = async (env: OgEnv, tx: unknown): Promise<string | null> => {
  try { await ogApplyRuntimeTx(env as never, treeClone(tx) as never, { isReplay: true }); return null; } catch (e) { return ogCode(e); }
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
      try { og = buildJurisdictionImportRequestHash(treeClone(req) as never); } catch (e) { ogErr = ogCode(e); }
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
        p.env.state.jReplicas.set(s.name, keep ? treeClone(replica) : { ...treeClone(replica), contracts: undefined, chainId: undefined });
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

// ---- the J submit ledger (og runtime/j-submit/j-submit-state.ts + j-submit-result.ts), each step one og Runtime frame ----
type OgFrame = { code: string | null; jOutbox: unknown[]; retries: unknown[] };
/** og applyRuntimeTransactions + applyPreparedRuntimeFrame for one RuntimeTx: its J outputs split, durable ones registered; a failed frame leaves env as it was. */
const ogFrame = async (env: OgEnv, tx: unknown): Promise<OgFrame> => {
  const snapshot = treeClone(env);
  try {
    const out = await ogApplyRuntimeTx(env as never, treeClone(tx) as never, { isReplay: true });
    const split = splitJOutboxForDurableSubmit(out as never);
    registerPendingCommittedJOutbox(env as never, split.durable);
    return { code: null, jOutbox: [...((env.infrastructure["pendingCommittedJOutbox"] as unknown[] | undefined) ?? []), ...split.maintenance], retries: split.retries };
  } catch (e) {
    Object.assign(env, snapshot);
    return { code: ogCode(e), jOutbox: [], retries: [] };
  }
};
const rwFrame = (p: Pair, tx: RuntimeTx, now: number): { code: string | null; jOutbox: readonly JInput[]; retries: readonly RuntimeTx[] } => {
  const r = applyRuntime(p.rt, { runtimeTxs: [tx], entityInputs: [], timestamp: BigInt(now) }, { ...verifiers, replay: true });
  if (!r.ok) return { code: rwCode(r), jOutbox: [], retries: [] };
  p.rt = r.value.runtime;
  return { code: null, jOutbox: r.value.jOutbox, retries: r.value.queuedRetries };
};

describe("runtime-j: the J submit ledger (og j-submit-state.ts / j-submit-result.ts)", () => {
  test("MATCH (randomized): retryJSubmit / recordJSubmitResult frames -- same decisions, J outbox, pending attempts, replica ledgers and post-state digests", async () => {
    const E = ALICE.toLowerCase(), A = aliceAddr.toLowerCase(), B = bobAddr.toLowerCase();
    let retried = 0, recorded = 0;
    for (let run = 0; run < 40; run++) {
      const p = newPair();
      const base = unwrap(createEntity({ id: ALICE, jurisdiction: TERMS.domain, threshold: 1n, members: new Map([[aliceAddr, { shares: 1n }], [bobAddr, { shares: 1n }]]), signerId: aliceAddr }));
      const signers = [A, B];
      const hashes = [hex(32), hex(32)];
      let batchHash = hashes[0] ?? "", nonce = 1 + ri(3), generation = 1 + ri(2), leader = pick([A, A, B]), terminal = false, now = 1_700_000_000_000;
      const witnessed = new Set<string>();
      const sync = (): void => {
        const sentBatch = { batch: initJBatch().batch, batchHash, encodedBatch: "0x1234", entityNonce: nonce, firstSubmittedAt: 0, lastSubmittedAt: 0, submitAttempts: 0, ...(terminal ? { terminalFailure: { message: "consumed", failedAt: 1 } } : {}) };
        const jBatchState = { ...initJBatch(), sentBatch, broadcastCount: generation, status: "sent" };
        const witness = new Map([...witnessed].map((h) => [h, { hanko: `0x${"ab".repeat(40)}`, type: "jBatch" as const, entityHeight: 1, createdAt: 1 }]));
        for (const s of signers) {
          const ogKey = `${E}:${s}`, prior = p.env.state.eReplicas.get(ogKey) as { jSubmitState?: unknown } | undefined;
          p.env.state.eReplicas.set(ogKey, {
            entityId: E, signerId: s, hankoWitness: treeClone(witness), ...(prior?.jSubmitState ? { jSubmitState: prior.jSubmitState } : {}),
            state: { entityId: E, config: { validators: signers, shares: { [A]: 1n, [B]: 1n } }, leaderState: { activeValidatorId: leader, view: 0, changedAtHeight: 0 }, jBatchState: treeClone(jBatchState) },
          });
          const key = replicaKey(ALICE, s);
          const mine = { ...base, signerId: s === A ? aliceAddr : bobAddr, state: { ...base.state, leaderState: { activeValidatorId: leader, view: 0, changedAtHeight: 0 }, committed: { ...base.state.committed, jBatchState: jBatchState as unknown as Binary } } } as EntityReplica;
          const local = p.rt.replicaLocal.get(key) ?? {};
          p.rt = { ...p.rt, entities: new Map([...p.rt.entities, [key, mine]]), replicaLocal: new Map([...p.rt.replicaLocal, [key, { ...local, hankoWitness: witness }]]) };
        }
      };
      if (rng() < 0.9) witnessed.add(batchHash);
      sync();
      let lastResult: Record<string, unknown> | undefined;
      for (let step = 0; step < 16; step++) {
        const roll = rng();
        let tx: Record<string, unknown> | undefined;
        if (roll < 0.35) {
          tx = { type: "retryJSubmit", data: {
            entityId: pick([E, E, E, E.toUpperCase().replace("0X", "0x"), hex(32)]), signerId: pick([leader, leader, leader, A, B, leader.toUpperCase().replace("0X", "0x")]), jurisdictionName: pick(["Local", "Local", "local"]),
            batchHash: pick([batchHash, batchHash, batchHash, hex(32)]), entityNonce: pick([nonce, nonce, nonce, nonce + 1]), batchGeneration: pick([generation, generation, generation, generation + 1]),
            ...(rng() < 0.2 ? { feeOverrides: { gasBumpBps: 125 } } : {}),
          } };
        } else if (roll < 0.7) {
          const pending = ((p.env.infrastructure["pendingCommittedJOutbox"] ?? []) as { jurisdictionName: string; jTxs: { entityId: string; data: Record<string, unknown> }[] }[]).flatMap((i) => i.jTxs.map((t) => ({ j: i.jurisdictionName, t })));
          const target = pending.length > 0 && rng() < 0.85 ? pick(pending) : undefined;
          if (target === undefined && lastResult !== undefined && rng() < 0.6) {
            tx = { type: "recordJSubmitResult", data: rng() < 0.5 ? lastResult : { ...lastResult, message: "different" } };
          } else if (target !== undefined) {
            const a = target.t.data["runtimeSubmitAttempt"] as { attemptId: string; attemptNumber: number; attemptedAt: number; batchGeneration: number };
            const outcome = pick(["submitted", "eventBarrier", "transientFailure", "terminalFailure", "reconciled", "bogus"]);
            const failing = outcome === "transientFailure" || outcome === "terminalFailure";
            const message = failing ? pick(["nonce too low", "rpc down"]) : undefined;
            const data: Record<string, unknown> = {
              entityId: target.t.entityId, signerId: String(target.t.data["signerId"]), jurisdictionName: target.j, batchHash: String(target.t.data["batchHash"]), entityNonce: Number(target.t.data["entityNonce"]),
              batchGeneration: a.batchGeneration, attemptId: a.attemptId, attemptNumber: a.attemptNumber, attemptedAt: a.attemptedAt, outcome,
              ...(message !== undefined ? { message } : {}), ...(failing && rng() < 0.5 ? { adapterFailure: { category: pick(["transient", "terminal"]), code: "RPC", message: pick([message, "other"]) } } : {}),
              ...(outcome === "submitted" && rng() < 0.7 ? { txHash: hex(32) } : {}),
            };
            const corrupt = rng();
            if (corrupt < 0.1) data["attemptedAt"] = a.attemptedAt + 1;
            else if (corrupt < 0.15) data["attemptId"] = hex(32);
            else if (corrupt < 0.2) data["entityNonce"] = -1;
            tx = { type: "recordJSubmitResult", data };
          }
        } else if (roll < 0.8) {
          now += pick([0, 1_000, 61_000]);
        } else if (roll < 0.9) {
          // The chain retires / replaces the sealed batch (og JEvent), the leader changes, or the witness is lost.
          const change = rng();
          if (change < 0.4) { batchHash = hashes[1] ?? ""; generation += 1; if (rng() < 0.8) witnessed.add(batchHash); }
          else if (change < 0.6) terminal = !terminal;
          else if (change < 0.8) leader = leader === A ? B : A;
          else witnessed.clear();
          sync();
        } else {
          witnessed.add(batchHash);
          sync();
        }
        if (tx === undefined) continue;
        p.env.state.timestamp = now;
        const og = await ogFrame(p.env, tx);
        const rw = rwFrame(p, tx as unknown as RuntimeTx, now);
        expect(rw.code).toBe(og.code);
        if (og.code !== null) continue;
        if (tx["type"] === "recordJSubmitResult") { recorded++; lastResult = tx["data"] as Record<string, unknown>; } else if (og.jOutbox.length > 0) retried++;
        expect(stableJson(rw.jOutbox)).toBe(stableJson(og.jOutbox));
        expect(stableJson(rw.retries)).toBe(stableJson(og.retries));
        for (const s of signers) {
          const ogLocal = (p.env.state.eReplicas.get(`${E}:${s}`) as { jSubmitState?: unknown }).jSubmitState;
          expect(stableJson(p.rt.replicaLocal.get(replicaKey(ALICE, s))?.jSubmitState)).toBe(stableJson(ogLocal));
        }
        expect(rwDigests(p.rt)).toEqual(ogDigests(p.env) as never);
      }
    }
    expect(retried).toBeGreaterThan(20);
    expect(recorded).toBeGreaterThan(20);
  });

  test("MATCH: the J submit attempt id is og buildJSubmitAttemptId (signer / jurisdiction / generation scoped)", () => {
    for (let i = 0; i < 200; i++) {
      const id = { jurisdictionName: pick(["Local", " local ", ""]), entityId: pick([hex(32), ""]), signerId: pick([addr(), addr().toUpperCase().replace("0X", "0x"), ""]), entityNonce: pick([0, 3, -1, 1.5]), batchGeneration: pick([1, 2, 0]), batchHash: pick([hex(32), ""]), attemptNumber: pick([1, 7, 0]) };
      let og: string | null = null, ogErr: string | null = null;
      try { og = buildJSubmitAttemptId(id); } catch (e) { ogErr = ogCode(e); }
      const rw = jSubmitAttemptId(id);
      expect(rwCode(rw)).toBe(ogErr);
      if (rw.ok) expect(rw.value).toBe(og ?? "");
    }
  });
});

// ---- og runtime/mempool/propose-accounts-now.ts assertProposeAccountsNowTxAuthorized, run by og admission.ts for every EntityInput tx ----
describe("runtime-j: proposeAccountsNow ingress (og propose-accounts-now.ts)", () => {
  test("MATCH (randomized): an unmarked proposeAccountsNow outside replay refuses the whole Runtime frame; a local mark or replay admits it", () => {
    const LOCAL = Symbol.for("xln.runtime.propose-accounts-now.local");
    let refused = 0, admitted = 0;
    for (let i = 0; i < 200; i++) {
      const replay = rng() < 0.3;
      const txs: EntityTx[] = Array.from({ length: 1 + ri(3) }, () => (rng() < 0.5
        ? { type: "proposeAccountsNow", data: { version: 1, proposerSignerId: aliceAddr, counterparties: [hex(32)] } }
        : { type: "chat", data: { from: aliceAddr, message: "hi" } }) as unknown as EntityTx);
      const marked = txs.filter(() => rng() < 0.5);
      for (const tx of marked) Object.defineProperty(tx, LOCAL, { value: true, enumerable: false });
      let og: string | null = null;
      try { for (const tx of txs) assertProposeAccountsNowTxAuthorized(tx as never, replay); } catch (e) { og = ogCode(e); }
      const rw = applyRuntime(createRuntime(), { runtimeTxs: [], entityInputs: [{ entityId: ALICE, signerId: aliceAddr, input: { kind: "txs", timestamp: 1n, txs } }] }, { ...verifiers, replay, local: new Set(marked) });
      const code = rw.ok ? null : rwCode(rw);
      expect(code === "PROPOSE_ACCOUNTS_NOW_EXTERNAL_INGRESS_REJECTED" ? code : null).toBe(og);
      if (og === null) admitted++; else refused++;
    }
    expect(refused).toBeGreaterThan(30);
    expect(admitted).toBeGreaterThan(30);
  });
});
