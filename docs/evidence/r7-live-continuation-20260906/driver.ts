import { spawn, spawnSync, type ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import { chmodSync, cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { Level } from '/Users/zigota/xln/node_modules/level';
import { safeParse, safeStringify } from '/Users/zigota/xln/core/protocol/serialization';
import { deriveSignerAddressSync } from '/Users/zigota/xln/core/account/crypto';
import { canonicalEntitySeed } from '/Users/zigota/xln/core/runtime/registration/entity-creation';
import { deriveEntityEncryptionPrivateKey } from '/Users/zigota/xln/core/runtime/registration/entity-creation/crypto';
import { deriveManagedEntityIdentity } from '/Users/zigota/xln/core/orchestrator/daemon-control';
import { assertRustHubBinaryFresh, buildRustHubProcessPlan } from '/Users/zigota/xln/core/orchestrator/process/hub-engine-plan';
import { acquireLocalTestPortLease, assertLocalTestPortsFree, stripAmbientLocalStackEnv, type LocalTestPortLease } from '/Users/zigota/xln/core/scripts/e2e/harness/local-test-port-lease';
import { stopProcessGroup } from '/Users/zigota/xln/core/scripts/e2e/runners/process-group';
import { readStandLockHolder, STAND_LOCK_TOKEN_ENV, STAND_LOCK_DISABLE_ENV, standLockRoot } from '/Users/zigota/xln/tools/stand-lock';
import { readStorageHead, readStorageFrameRecord } from '/Users/zigota/xln/core/storage/read/read';
import { readEntityStorageLayout } from '/Users/zigota/xln/core/storage/schema/entity/layout';
import { keyLiveEntity } from '/Users/zigota/xln/core/storage/keys';
import { readRuntimeOutputRows } from '/Users/zigota/xln/core/storage/wal/outbox-payload';
import { decodeRuntimeMachineGraphLeaves } from '/Users/zigota/xln/core/storage/wal/runtime-machine-graph';
import { computeStorageFrameHash } from '/Users/zigota/xln/core/storage/hashes';
import { computeCanonicalRuntimeStateHash } from '/Users/zigota/xln/core/storage/canonical-hash';
import { copyBoundAuthorityWal } from '/Users/zigota/xln/core/scripts/operations/hlt/replay/source-binding';
import { readHltHubRecordingManifest } from '/Users/zigota/xln/core/scripts/operations/hlt/replay/recording';

const repo = '/Users/zigota/xln';
const replay = '/tmp/xln-cross-j-parity-r7-20260905';
const recording = '/tmp/xln-cross-j-wal-r7-20260905';
const prepared = '/tmp/xln-r7-live-continuation-prep-20260906';
const sourceNative = join(replay, 'rust-canonical-expiry-r13-w1-20260906-native');
const sourceWal = join(replay, 'source-wal');
const sourceReport = join(replay, 'rust-canonical-expiry-r13-w1-20260906.log');
const started = performance.now();
const deadline = started + 160_000;
process.chdir(repo);
process.umask(0o077);
mkdirSync(prepared, { recursive: true, mode: 0o700 });
const runRoot = mkdtempSync(join(prepared, 'run-'));
const evidence: Record<string, unknown> = { sourceNative, sourceWal, runRoot, schema: 'xln-r7-live-continuation-v1' };
const save = (name: string, value: unknown) => writeFileSync(join(runRoot, name), `${safeStringify(value, 2)}\n`, { mode: 0o600 });
const record = (value: unknown, code: string): Record<string, any> => {
  assert(value && typeof value === 'object' && !Array.isArray(value), code);
  return value as Record<string, any>;
};
const children: { name: string; process: ChildProcess; exited: Promise<void>; exit: number | null; stdout: string; stderr: string }[] = [];
let lease: LocalTestPortLease | undefined;
let stopped = false;
let stopPromise: Promise<void> | undefined;
let fatal: Error | undefined;

const assertGrant = () => {
  assert.notEqual(process.env[STAND_LOCK_DISABLE_ENV], '1', 'R7_LIVE_LOCK_DISABLED');
  const holder = readStandLockHolder(standLockRoot(), 0);
  assert(holder && holder.token === process.env[STAND_LOCK_TOKEN_ENV], 'R7_LIVE_ROOT_STAND_GRANT_REQUIRED');
  process.kill(holder.pid, 0);
};
const treeHash = (root: string): string => {
  const hash = createHash('sha256');
  const walk = (path: string, relative = '') => {
    for (const name of readdirSync(path).sort()) {
      const absolute = join(path, name);
      const key = join(relative, name);
      if (statSync(absolute).isDirectory()) walk(absolute, key);
      else { hash.update(key); hash.update(readFileSync(absolute)); }
    }
  };
  walk(root);
  return hash.digest('hex');
};
const assertStoppedSource = (path: string) => {
  const result = spawnSync('lsof', ['-t', '+D', path], { encoding: 'utf8', timeout: 5_000 });
  if (result.error) throw result.error;
  assert(result.status === 0 || result.status === 1, 'R7_LIVE_SOURCE_LSOF_FAILED');
  assert.equal(result.stdout.trim(), '', 'R7_LIVE_SOURCE_IN_USE');
};
const check = () => {
  assertGrant();
  if (fatal) throw fatal;
  assert(!stopped && performance.now() < deadline, 'R7_LIVE_BUDGET_EXHAUSTED');
  const earlyExit = children.find(child => child.exit !== null);
  assert(!earlyExit, `R7_LIVE_CHILD_EXIT:${earlyExit?.name}:${earlyExit?.exit}`);
};
const stop = (): Promise<void> => stopPromise ??= (async () => {
  stopped = true;
  const outcomes: Record<string, unknown>[] = [];
  for (const child of [...children].reverse()) {
    try {
      await stopProcessGroup({ pid: child.process.pid!, termTimeoutMs: 2_000, killTimeoutMs: 2_000, timeoutError: `R7_LIVE_GROUP_ALIVE:${child.name}` });
      await child.exited;
      outcomes.push({ name: child.name, pid: child.process.pid, exit: child.exit, groupGone: true });
    } catch (error) {
      outcomes.push({ name: child.name, pid: child.process.pid, groupGone: false });
      fatal ??= error instanceof Error ? error : new Error(String(error));
    }
  }
  if (lease) {
    try { assertLocalTestPortsFree(lease.ports); } catch (error) { fatal ??= error as Error; }
    lease.release();
  }
  save('cleanup.json', outcomes);
})();
for (const signal of ['SIGTERM', 'SIGINT'] as const) process.once(signal, () => {
  fatal = new Error(`R7_LIVE_SIGNAL:${signal}`);
  void stop().then(() => process.exit(1));
});
const watchdog = setTimeout(() => {
  fatal = new Error('R7_LIVE_BUDGET_EXHAUSTED');
  void stop();
}, 160_000);
const start = (name: string, command: string, args: readonly string[], extraEnv: NodeJS.ProcessEnv = {}) => {
  check();
  const child = spawn(command, [...args], {
    cwd: repo, detached: true, stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...stripAmbientLocalStackEnv(process.env), ...extraEnv, XLN_STORAGE_WAL_SYNC: '1' },
  });
  assert(child.pid, `R7_LIVE_SPAWN:${name}`);
  const entry = { name, process: child, exit: null as number | null, stdout: '', stderr: '', exited: Promise.resolve() };
  entry.exited = new Promise(resolve => {
    child.once('error', error => { fatal = error; });
    child.once('close', code => { entry.exit = code ?? -1; resolve(); });
  });
  child.stdout!.on('data', data => { entry.stdout += data.toString(); writeFileSync(join(runRoot, `${name}.stdout.log`), entry.stdout, { mode: 0o600 }); });
  child.stderr!.on('data', data => { entry.stderr += data.toString(); writeFileSync(join(runRoot, `${name}.stderr.log`), entry.stderr, { mode: 0o600 }); });
  children.push(entry);
  save('owned-processes.json', children.map(item => ({ name: item.name, pid: item.process.pid })));
  return entry;
};
const waitFor = async <T>(label: string, read: () => Promise<T | null>, ms = 20_000): Promise<T> => {
  const until = Math.min(deadline, performance.now() + ms);
  while (performance.now() < until) {
    check();
    const value = await read();
    if (value !== null) return value;
    await Bun.sleep(40);
  }
  throw new Error(`R7_LIVE_WAIT:${label}`);
};
const json = async (url: string, init?: RequestInit) => {
  check();
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(5_000) });
  const value = record(safeParse(await response.text()), 'R7_LIVE_HTTP_JSON');
  assert(response.ok, `R7_LIVE_HTTP:${response.status}:${String(value.error ?? value.code ?? '')}`);
  return value;
};
const rpcReady = async (port: number, chainId: number) => waitFor(`rpc-${chainId}`, async () => {
  try {
    const value = await json(`http://127.0.0.1:${port}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'eth_chainId', params: [] }) });
    assert.equal(value.result, `0x${chainId.toString(16)}`, 'R7_LIVE_CHAIN_ID');
    return value.result;
  } catch (error) {
    if (error instanceof TypeError && /connect|fetch/i.test(error.message)) return null;
    if ((error as { code?: string }).code === 'ConnectionRefused') return null;
    throw error;
  }
}, 5_000);
const openDb = async (path: string) => {
  assert(path.startsWith(`${runRoot}/`), 'R7_LIVE_ONLY_COPY_DB');
  const db = new Level<Buffer, Buffer>(path, { keyEncoding: 'binary', valueEncoding: 'buffer', createIfMissing: false });
  try { await db.open(); } catch (error) {
    throw new Error(`R7_LIVE_DB_OPEN:${path}:${String((error as Error & { cause?: Error }).cause?.message ?? (error as Error).message)}`, { cause: error });
  }
  return db;
};
const frame = async (db: any, height: number) => {
  const value = await readStorageFrameRecord(db, height);
  assert(value, `R7_LIVE_FRAME_MISSING:${height}`);
  assert.equal(computeStorageFrameHash(value), value.frameHash, `R7_LIVE_FRAME_HASH:${height}`);
  if (height === 90) assert(value.canonicalEntityHashes && value.canonicalStateHash, 'R7_LIVE_H90_ROOTS');
  if (value.canonicalEntityHashes || value.canonicalStateHash) {
    assert(value.canonicalEntityHashes && value.canonicalStateHash, `R7_LIVE_PARTIAL_ROOTS:${height}`);
    assert.equal(computeCanonicalRuntimeStateHash(value.height, value.timestamp, value.canonicalEntityHashes), value.canonicalStateHash, 'R7_LIVE_RUNTIME_ROOT');
  }
  return value;
};
const roots = (value: any) => ({ height: value.height, frameHash: value.frameHash, prevFrameHash: value.prevFrameHash, canonicalStateHash: value.canonicalStateHash, canonicalEntityHashes: value.canonicalEntityHashes, postStateHash: value.postStateHash });

try {
  assertGrant();
  const binary = assertRustHubBinaryFresh(repo, process.env.XLN_RSCORE_BINARY);
  assertStoppedSource(sourceNative);
  assertStoppedSource(sourceWal);
  const sourceHashes = { native: treeHash(sourceNative), wal: treeHash(sourceWal) };
  const nativeDb = join(runRoot, 'h1', 'rscore-native');
  const walDb = join(runRoot, 'ts-wal');
  mkdirSync(join(runRoot, 'h1'), { mode: 0o700 });
  cpSync(sourceNative, nativeDb, { recursive: true, errorOnExist: true });
  const runtimeSeed = readFileSync(join(replay, 'runtime.seed'), 'utf8').trim();
  const manifest = readHltHubRecordingManifest(join(replay, 'recording-native-import.json'));
  await copyBoundAuthorityWal(sourceWal, walDb, manifest.source.binding, runtimeSeed);
  assert.equal(treeHash(nativeDb), sourceHashes.native, 'R7_LIVE_NATIVE_COPY');
  assert.equal(treeHash(walDb), sourceHashes.wal, 'R7_LIVE_WAL_COPY');

  const identity = deriveManagedEntityIdentity({ name: 'H1', seed: runtimeSeed, signerLabel: 'h1-hub' });
  const runtimeId = deriveSignerAddressSync(runtimeSeed, '1').toLowerCase();
  const runtimeSeedFile = join(runRoot, 'h1', 'runtime.seed');
  const entityKeyFile = join(runRoot, 'h1', 'entity-encryption.key');
  writeFileSync(runtimeSeedFile, `${runtimeSeed}\n`, { mode: 0o600 });
  writeFileSync(entityKeyFile, `${deriveEntityEncryptionPrivateKey(Buffer.from(canonicalEntitySeed(runtimeSeed).slice(2), 'hex'), identity.entityId)}\n`, { mode: 0o600 });

  const reportLine = readFileSync(sourceReport, 'utf8').trim().split('\n').at(-1)!;
  const report = record(safeParse(reportLine), 'R7_LIVE_REPLAY_REPORT');
  assert.equal(report.frames, 67);
  assert.equal(report.runtimeRootsCompared, 68);
  const accountsRoots = record(report.accountsRoots, 'R7_LIVE_ACCOUNTS_ROOTS');
  assert.equal(Object.keys(accountsRoots).length, 2);
  const tsReport = record(safeParse(readFileSync('/tmp/xln-cross-j-parity-r7-20260906-1633/ts-w1.json', 'utf8')), 'R7_LIVE_TS_REPORT');
  assert.equal(tsReport.trials[0].finalHeight, 90);
  const tsReportedFinalPendingOutbox = tsReport.trials[0].finalPendingOutbox;
  const native = await openDb(nativeDb);
  const wal = await openDb(walDb);
  let sourceFrame: Awaited<ReturnType<typeof frame>>;
  let policy: Record<string, any>;
  let initialOutputs: unknown[];
  const routes = new Map<string, { targetEntityId: string; targetRuntimeId: string; targetSignerId: string; websocketUrl: null }>();
  try {
    const head = await readStorageHead(native);
    assert(head && head.latestHeight === 90, 'R7_LIVE_NATIVE_HEAD_90');
    sourceFrame = await frame(native, 90);
    assert.deepEqual(roots(sourceFrame), roots(await frame(wal, 90)), 'R7_LIVE_TS_NATIVE_H90');
    const outputBinding = { count: sourceFrame.runtimeOutputCount, digest: sourceFrame.runtimeOutputsDigest };
    initialOutputs = await readRuntimeOutputRows(native, 90, outputBinding);
    assert.deepEqual(initialOutputs, await readRuntimeOutputRows(wal, 90, outputBinding), 'R7_LIVE_TS_NATIVE_H90_OUTPUTS');
    const entity = await readEntityStorageLayout(native, identity.entityId, keyLiveEntity(identity.entityId));
    assert(entity, 'R7_LIVE_PRIMARY_ENTITY');
    policy = record(entity.doc.hubRebalanceConfig, 'R7_LIVE_POLICY');
    assert.equal(policy.swapTakerFeeBps, 1, 'R7_LIVE_SOURCE_SWAP_FEE');
    for (let height = 23; height <= 90; height++) {
      const stored = await frame(wal, height);
      const outputs = await readRuntimeOutputRows(wal, height, { count: stored.runtimeOutputCount, digest: stored.runtimeOutputsDigest });
      for (const output of outputs) {
        if (!output.runtimeId) continue;
        const route = { targetEntityId: output.entityId.toLowerCase(), targetRuntimeId: output.runtimeId.toLowerCase(), targetSignerId: output.signerId, websocketUrl: null };
        assert(route.targetSignerId, 'R7_LIVE_ROUTE_SIGNER');
        if (routes.has(route.targetEntityId)) assert.deepEqual(routes.get(route.targetEntityId), route, 'R7_LIVE_ROUTE_CONFLICT');
        routes.set(route.targetEntityId, route);
      }
    }
    evidence.source = { ...roots(sourceFrame), runtimeId, primaryEntityId: identity.entityId, accountsRoots, sourceHashes, tsReportedFinalPendingOutbox, h90OutputCount: initialOutputs.length, h90OutputsDigest: sourceFrame.runtimeOutputsDigest };
    save('source-evidence.json', evidence.source);
  } finally { await native.close(); await wal.close(); }

  const checkpoint = record(safeParse(readFileSync(join(recording, 'hlt-h1-base-snapshot.json.concrete-checkpoint.json'), 'utf8')), 'R7_LIVE_CHECKPOINT');
  const machine = decodeRuntimeMachineGraphLeaves(checkpoint.runtimeMachineLeaves.map(([path, value]: [string, string]) => ({ pathBytes: Buffer.from(path.slice(2), 'hex'), valueBytes: Buffer.from(value.slice(2), 'hex') })), { rootHash: checkpoint.rootHash, leafCount: checkpoint.leafCount });
  assert.equal(machine.runtimeId, runtimeId);
  assert(Array.isArray(machine.jReplicas) && machine.jReplicas.length === 2, 'R7_LIVE_TWO_J');
  const jurisdictions = machine.jReplicas.map(([name, replica]: [string, Record<string, any>]) => {
    const rpc = new URL(replica.rpcs[0]);
    assert(['localhost', '127.0.0.1'].includes(rpc.hostname) && rpc.protocol === 'http:', 'R7_LIVE_LOCAL_J_ONLY');
    assert([31337, 31338].includes(replica.chainId), 'R7_LIVE_LOCAL_CHAIN_ONLY');
    return { name, chainId: replica.chainId, port: Number(rpc.port), rpc: rpc.href };
  }).sort((a: any, b: any) => a.chainId - b.chainId);
  assert.deepEqual(jurisdictions.map((j: any) => j.chainId), [31337, 31338]);
  const base = jurisdictions[0].port;
  assert.equal(jurisdictions[1].port, base + 1, 'R7_LIVE_RECORDED_RPC_LAYOUT');
  lease = await acquireLocalTestPortLease({ requiredOffsets: [0, 1, 10, 12], slotBases: [base], timeoutMs: 1_000 });
  const routesFile = join(runRoot, 'h1', 'entity-routes.json');
  writeFileSync(routesFile, `${safeStringify([...routes.values()])}\n`, { mode: 0o600 });
  save('jurisdictions.json', jurisdictions);
  const anvil = Bun.which('anvil');
  assert(anvil, 'R7_LIVE_ANVIL_BINARY');
  for (const jurisdiction of jurisdictions) {
    const name = jurisdiction.chainId === 31337 ? 'anvil' : 'anvil2';
    const snapshot = join(recording, `${name}-state.json`);
    assert(existsSync(snapshot), `R7_LIVE_SNAPSHOT:${name}`);
    const state = join(runRoot, `${name}-state.json`);
    cpSync(snapshot, state, { errorOnExist: true });
    chmodSync(state, 0o600);
    const tmp = join(runRoot, `${name}-tmp`);
    mkdirSync(tmp, { mode: 0o700 });
    start(name, anvil, ['--host', '127.0.0.1', '--port', String(jurisdiction.port), '--chain-id', String(jurisdiction.chainId), '--quiet', '--mixed-mining', '--block-time', '10', '--block-gas-limit', '60000000', '--code-size-limit', '65536', '--prune-history', '128', '--state', state, '--state-interval', '60'], { TMPDIR: tmp, FOUNDRY_DIR: join(tmp, 'foundry') });
    await rpcReady(jurisdiction.port, jurisdiction.chainId);
  }
  const plan = buildRustHubProcessPlan({ name: 'H1', apiHost: '127.0.0.1', apiPort: base + 10, directHost: '127.0.0.1', directPort: base + 12, dbPath: join(runRoot, 'h1'), runtimeSeedFile, entityKeyFile, routesFile, genesisFile: join(runRoot, 'unused-genesis.json'), jurisdictionsPath: join(recording, 'prod-mesh', 'jurisdictions.json'), runtimeSignerLabel: '1', entitySignerLabel: 'h1-hub', primaryEntityId: identity.entityId, workers: 4, binary });
  const live = start('native', plan.executable, plan.args);
  const initial = await waitFor('initial-native-frame', async () => {
    for (const line of live.stdout.split('\n')) {
      if (!line.startsWith('{') || !line.endsWith('}')) continue;
      const value = record(safeParse(line), 'R7_LIVE_STDOUT_JSON');
      if (value.status === 'ready' || value.status === 'j_catchup') return value;
    }
    return null;
  });
  assert.equal(initial.height, 90, 'R7_LIVE_INITIAL_HEIGHT');
  assert.equal(initial.runtimeId, runtimeId, 'R7_LIVE_INITIAL_RUNTIME');
  assert.equal(initial.runtimeFrameHash, sourceFrame!.frameHash, 'R7_LIVE_INITIAL_LINEAGE');
  assert.equal(initial.accountsRoot, accountsRoots[`${identity.entityId}:${identity.signerId}`], 'R7_LIVE_INITIAL_ACCOUNTS');
  evidence.initial = initial;
  save('initial-live.json', initial);
  const api = `http://127.0.0.1:${base + 10}`;
  const before = await waitFor('j-catchup', async () => { const value = await json(`${api}/api/info`); return value.deliveryReady === true ? value : null; });
  const profileBefore = await json(`${api}/api/gossip/profile?entityId=${identity.entityId}`);
  const preFee = record(record(profileBefore.profile, 'R7_LIVE_PROFILE_BEFORE').metadata, 'R7_LIVE_METADATA_BEFORE').swapTakerFeeBps;
  assert.equal(preFee, 1, 'R7_LIVE_PROFILE_INITIAL_FEE');
  save('before-command.json', { info: before, profile: profileBefore });
  const commandId = 'r7-live-continuation-set-hub-config';
  const data = { ...policy!, swapTakerFeeBps: 2 };
  const entityInputs = [{ entityId: identity.entityId, signerId: identity.signerId, entityTxs: [{ type: 'setHubConfig', data }] }];
  const committed = await json(`${api}/api/control/runtime/entity-inputs`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: safeStringify({ commandId, entityInputs }) });
  assert.equal(committed.ok, true);
  assert.equal(committed.commandId, commandId);
  assert(Number.isSafeInteger(committed.height) && committed.height > before.height, 'R7_LIVE_NEW_COMMIT_HEIGHT');
  const profileAfter = await json(`${api}/api/gossip/profile?entityId=${identity.entityId}`);
  assert.equal(record(record(profileAfter.profile, 'R7_LIVE_PROFILE_AFTER').metadata, 'R7_LIVE_METADATA_AFTER').swapTakerFeeBps, 2, 'R7_LIVE_POLICY_NOT_APPLIED');
  const after = await json(`${api}/api/info`);
  assert(after.height >= committed.height);
  const metrics = await json(`${api}/api/metrics`);
  save('after-command.json', { info: after, committed, profile: profileAfter, metrics });
  // The restored h90 root is checked above. Real J catch-up can settle earlier
  // work before readiness; this command must preserve the ready pre-command root.
  assert.equal(after.accountsRoot, before.accountsRoot, 'R7_LIVE_POLICY_CHANGED_ACCOUNTS');
  evidence.command = { type: 'setHubConfig', previousSwapTakerFeeBps: 1, nextSwapTakerFeeBps: 2, height: committed.height };
  await stop();
  if (fatal) throw fatal;
  const finalDb = await openDb(nativeDb);
  try {
    assert.deepEqual(await readRuntimeOutputRows(finalDb, 90, { count: sourceFrame!.runtimeOutputCount, digest: sourceFrame!.runtimeOutputsDigest }), initialOutputs!, 'R7_LIVE_H90_OUTBOX_MUTATED');
    let previousHash = sourceFrame!.frameHash;
    const continuation = [];
    for (let height = 91; height <= committed.height; height++) {
      const next = await frame(finalDb, height);
      assert.equal(next.prevFrameHash, previousHash, `R7_LIVE_CONTINUATION_LINEAGE:${height}`);
      previousHash = next.frameHash;
      continuation.push(roots(next));
      if (height === committed.height) {
        const matching = next.runtimeInput.entityInputs.filter(input => input.entityId === identity.entityId).flatMap(input => input.entityTxs ?? []).filter(tx => tx.type === 'setHubConfig');
        assert.equal(matching.length, 1, 'R7_LIVE_COMMITTED_COMMAND_COUNT');
        assert.deepEqual(matching[0]!.data, data, 'R7_LIVE_COMMITTED_COMMAND_BYTES');
      }
    }
    save('continuation-roots.json', continuation);
    evidence.final = { height: committed.height, frameHash: previousHash, lineageLinksVerified: continuation.length };
  } finally { await finalDb.close(); }
  assert.deepEqual({ native: treeHash(sourceNative), wal: treeHash(sourceWal) }, sourceHashes, 'R7_LIVE_SOURCE_MUTATED');
  evidence.elapsedMs = Math.round(performance.now() - started);
  evidence.status = 'passed';
  save('result.json', evidence);
  console.log(safeStringify({ status: 'passed', initialHeight: 90, committedHeight: committed.height, elapsedMs: evidence.elapsedMs, artifact: runRoot }));
} catch (error) {
  evidence.status = 'failed';
  evidence.error = error instanceof Error ? { message: error.message, stack: error.stack } : { message: String(error) };
  save('result.json', evidence);
  console.error(safeStringify({ status: 'failed', error: error instanceof Error ? error.message : String(error), artifact: runRoot }));
  process.exitCode = 1;
} finally {
  clearTimeout(watchdog);
  await stop();
  if (fatal) { save('cleanup-error.json', { error: fatal.message }); process.exitCode = 1; }
}
