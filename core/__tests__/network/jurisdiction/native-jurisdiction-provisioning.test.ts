import { expect, test } from 'bun:test';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { safeStringify } from '../../../protocol/serialization';
import {
  deployRpc2JurisdictionStack,
  parseShardJurisdictions,
  resetLocalAnvilChains,
} from '../../../orchestrator/j-select/jurisdictions';

const native = {
  name: 'Native TVM',
  mode: 'tron',
  chainId: 1_208_511_695,
  rpc: '/rpc2',
  tronFullHost: 'http://127.0.0.1:19090',
  tronSolidityHost: 'http://127.0.0.1:19091',
  blockTimeMs: 3_000,
  entityProviderDeploymentBlock: 25,
  contracts: {
    account: '0x2306e668264f76ce0925b345565118e096b9e5f7',
    depository: '0x51c6eea257ec7ae26ef93db6d24bdf6dea642e16',
    entityProvider: '0xab6abc55418b5bcb067cf909725500fe08a125dc',
    deltaTransformer: '0x7d5c7d5ccdc41bd45f4171138d7f21aafc1ae692',
  },
  tokenRegistry: [{
    symbol: 'USDT', name: 'Native test token', tokenId: 1, decimals: 6, tokenType: 0,
    externalTokenId: '0', address: '0x6c4e1ee99c5a44cb5dfa612bb807d5de3fa440cc',
  }],
};

test('native shard transport survives canonical parsing with its own deployed addresses', () => {
  const config = { jurisdictions: { tron: native } };
  expect(parseShardJurisdictions(safeStringify(config), 'NATIVE').jurisdictions?.['tron']).toEqual(native);
  expect(() => parseShardJurisdictions(safeStringify({ jurisdictions: {
    tron: { ...native, mode: 'rpc' },
  } }), 'NATIVE')).toThrow('TRON_HOST_WITHOUT_TRON_MODE');
});

test('configured native RPC is never sent an Anvil reset', async () => {
  const root = await mkdtemp(join(tmpdir(), 'xln-native-reset-boundary-'));
  const shardJurisdictionsPath = join(root, 'jurisdictions.json');
  try {
    await writeFile(shardJurisdictionsPath, safeStringify({ jurisdictions: { tron: native } }));
    // This real closed socket makes any accidental network call fail. The
    // configured native chain is outside the Anvil reset authority entirely.
    await resetLocalAnvilChains({ shardJurisdictionsPath, rpc2Url: 'http://127.0.0.1:1' });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test('native provisioning rejects incomplete operator metadata before any RPC or deployment', async () => {
  const root = await mkdtemp(join(tmpdir(), 'xln-native-provision-boundary-'));
  const shardJurisdictionsPath = join(root, 'jurisdictions.json');
  try {
    for (const [field, error] of [
      ['chainId', 'RPC2_NATIVE_CHAIN_ID_MISSING'],
      ['contracts', 'RPC2_NATIVE_CONFIGURED_CONTRACTS_INVALID'],
      ['entityProviderDeploymentBlock', 'RPC2_NATIVE_CONFIGURED_ENTITY_PROVIDER_DEPLOYMENT_BLOCK_INVALID'],
      ['tokenRegistry', 'RPC2_NATIVE_CONFIGURED_TOKEN_REGISTRY_MISSING'],
    ]) {
      const entry: Record<string, unknown> = { ...native };
      if (!field || !error) throw new Error('NATIVE_PROVISION_CASE_MISSING');
      delete entry[field];
      await writeFile(shardJurisdictionsPath, safeStringify({ jurisdictions: { tron: entry } }));
      await expect(deployRpc2JurisdictionStack({
        shardJurisdictionsPath, rpc2Url: 'http://127.0.0.1:1',
      })).rejects.toThrow(error);
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
