import { expect, test } from 'bun:test';

import { bootstrapHub } from '../../../scripts/bootstrap-hub';
import { createEmptyEnv, hasRuntimeWork } from '../../runtime';

test('hub bootstrap commits config once and preserves idempotence across repeated startup', async () => {
  const seed = 'hub-bootstrap-cadence-regression';
  const env = createEmptyEnv(seed);
  env.quietRuntimeLogs = true;
  env.scenarioMode = false;
  env.runtimeConfig = {
    minFrameDelayMs: 100,
    loopIntervalMs: 1,
    storage: { enabled: false },
  };
  env.activeJurisdiction = 'Cadence Testnet';
  env.state.jReplicas.set('Cadence Testnet', {
    name: 'Cadence Testnet',
    blockNumber: 0n,
    stateRoot: new Uint8Array(32),
    mempool: [],
    blockDelayMs: 0,
    blockTimeMs: 1_000,
    lastBlockTimestamp: 0,
    position: { x: 0, y: 0, z: 0 },
    contracts: {
      account: `0x${'11'.repeat(20)}`,
      depository: `0x${'22'.repeat(20)}`,
      entityProvider: `0x${'33'.repeat(20)}`,
      deltaTransformer: `0x${'44'.repeat(20)}`,
    },
    rpcs: ['http://127.0.0.1:18545'],
    chainId: 31337,
  });
  if (!env.infrastructure) throw new Error('TEST_RUNTIME_INFRASTRUCTURE_MISSING');
  env.infrastructure.lastFrameStartedAt = Date.now();

  const result = await bootstrapHub(env, {
    name: 'Cadence Hub',
    seed,
    signerId: 'hub-validator',
    routingFeePPM: 17,
  });

  if (!result) throw new Error('TEST_HUB_BOOTSTRAP_RESULT_MISSING');
  const replica = Array.from(env.state.eReplicas.entries())
    .find(([key]) => key.startsWith(`${result.entityId}:`))?.[1];
  expect(replica).toBeDefined();
  expect(replica?.state.hubRebalanceConfig?.routingFeePPM).toBe(17);
  expect(env.state.height).toBe(2);
  expect(hasRuntimeWork(env)).toBe(false);

  // Repeating startup must not sign another Entity frame: setHubConfig fans
  // rebalance_policy proposals out to existing Accounts before peers reconnect.
  const repeated = await bootstrapHub(env, {
    name: 'Cadence Hub', seed, signerId: 'hub-validator', routingFeePPM: 17,
  });
  expect(repeated).toEqual(result);
  expect(env.state.height).toBe(2);
  expect(hasRuntimeWork(env)).toBe(false);

  await bootstrapHub(env, {
    name: 'Cadence Hub', seed, signerId: 'hub-validator', routingFeePPM: 18,
    rebalanceLiquidityFeeBps: 2n,
  });
  const updated = env.state.eReplicas.get(`${result.entityId}:${result.signerId}`);
  expect(updated?.state.hubRebalanceConfig?.routingFeePPM).toBe(18);
  expect(updated?.state.hubRebalanceConfig?.rebalanceLiquidityFeeBps).toBe(2n);
  expect(updated?.state.hubRebalanceConfig?.policyVersion).toBe(2);
  expect(env.state.height).toBe(3);
  expect(hasRuntimeWork(env)).toBe(false);
});
