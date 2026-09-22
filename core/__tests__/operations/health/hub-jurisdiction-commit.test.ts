import { afterEach, expect, test } from 'bun:test';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { closeInfraDb, closeRuntimeDb, createEmptyEnv, enqueueRuntimeInput, registerRuntimeFrameCommitCallback } from '../../../runtime';
import { dbRootPath } from '../../../runtime/replica/platform';
import { importJurisdiction } from '../../../orchestrator/hub/node/import-jurisdiction';
import type { JurisdictionConfig } from '../../../orchestrator/hub/node/hub-node-types';
import type { RuntimeReplica } from '../../../runtime/types';
import { createJAdapter, type JAdapter } from '../../../jurisdiction/adapter';
import { attachLiveJAdapter } from '../../../runtime/j-submit/live-jadapters';
import { createTestJReplica } from '../../helpers/j-replica';

const runtimes: RuntimeReplica[] = [];
const adapters: JAdapter[] = [];
// The real in-process EVM deploys contracts and executes the post-WAL adapter
// path; this focused waiter regression makes no RPC/Tron acceptance claim.
const restoredRuntime = async (): Promise<{ env: RuntimeReplica; config: JurisdictionConfig }> => {
  const adapter = await createJAdapter({ mode: 'browservm', chainId: 31337 });
  adapters.push(adapter);
  const config: JurisdictionConfig = {
    name: 'Testnet', chainId: adapter.chainId, rpc: 'http://localhost:8545',
    entityProviderDeploymentBlock: 1, blockTimeMs: 1000, contracts: adapter.addresses,
  };
  const env = createEmptyEnv(`hub-jurisdiction-commit:${crypto.randomUUID()}`, 1);
  env.state.jReplicas.set(config.name, createTestJReplica({
    name: config.name, chainId: config.chainId, rpcs: [config.rpc],
    contracts: config.contracts, entityProviderDeploymentBlock: 1,
  }));
  const replica = env.state.jReplicas.get(config.name)!;
  replica.stateRoot = await adapter.captureStateRoot!();
  attachLiveJAdapter(env, config.name, adapter);
  runtimes.push(env);
  return { env, config };
};

afterEach(async () => {
  for (const adapter of adapters.splice(0)) await adapter.close();
  for (const env of runtimes.splice(0)) {
    await closeRuntimeDb(env);
    await closeInfraDb(env);
    if (!env.dbNamespace) throw new Error('TEST_NAMESPACE_MISSING');
    const base = join(dbRootPath, env.dbNamespace);
    for (const suffix of ['', '-storage-current', '-storage-previous', '-wal', '-events', '-infra']) {
      rmSync(`${base}${suffix}`, { recursive: true, force: true });
    }
  }
});

test('a committed importJ does not require unrelated ingress to become idle', async () => {
  const { env, config } = await restoredRuntime();
  const before = env.state.height;
  const off = registerRuntimeFrameCommitCallback(env, () => {
    enqueueRuntimeInput(env, {
      runtimeTxs: [{ type: 'importJ', data: {
        name: config.name, chainId: config.chainId, ticker: 'OTHER',
        rpcs: [config.rpc], contracts: config.contracts,
        entityProviderDeploymentBlock: 1, blockTimeMs: 1000,
      } }], entityInputs: [],
    });
  });
  try {
    await importJurisdiction(env, config);
    expect(env.state.height).toBeGreaterThan(before);
    expect(env.runtimeMempool.runtimeTxs).toHaveLength(1);
  } finally { off(); }
  expect(env.infrastructure?.runtimeFrameCommitCallbacks?.size ?? 0).toBe(0);
}, 15000);

test('an existing jurisdiction cannot bypass conflicting importJ validation', async () => {
  const { env, config } = await restoredRuntime();
  await expect(importJurisdiction(env, { ...config, chainId: 31338 }))
    .rejects.toThrow('IMPORT_J_EXISTING_CHAIN_CONFLICT');
  expect(env.infrastructure?.runtimeFrameCommitCallbacks?.size ?? 0).toBe(0);
});
