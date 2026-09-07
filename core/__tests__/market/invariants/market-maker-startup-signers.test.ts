import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { recoverAddress } from 'ethers';
import { buildLocalMarketMakerSignerLabels } from '../../../orchestrator/market-maker/node/mm-node-core';
import { resetMeshJurisdictionsCache } from '../../../orchestrator/mesh/mesh-jurisdictions';
import { clearSignerKeys, deriveSignerAddressSync, signDigest } from '../../../account/crypto';
import { closeInfraDb, closeRuntimeDb, main } from '../../../runtime';
import { safeStringify } from '../../../protocol/serialization';

test('MM startup registers primary and secondary pair-shard EOAs before recovery', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'xln-mm-startup-signers-'));
  const previousPath = process.env['XLN_JURISDICTIONS_PATH'];
  const previousPrimaryOnly = process.env['XLN_MESH_PRIMARY_JURISDICTION_ONLY'];
  const seed = 'mm-startup-pair-shard-signer-regression';
  const stack = (name: string, chainId: number, rpc: string) => ({
    name, chainId, rpc, blockTimeMs: 1000, entityProviderDeploymentBlock: 1,
    explorer: '', currency: 'TEST', status: 'active',
    contracts: {
      entityProvider: `0x${'11'.repeat(20)}`, depository: `0x${'22'.repeat(20)}`,
      account: `0x${'33'.repeat(20)}`, deltaTransformer: `0x${'44'.repeat(20)}`,
    },
  });
  await Bun.write(join(directory, 'jurisdictions.json'), safeStringify({
    version: '1', lastUpdated: '2026-09-05T00:00:00.000Z',
    jurisdictions: {
      primary: stack('Primary', 31337, '/rpc'),
      tron: stack('Secondary', 31338, '/rpc2'),
    },
    defaults: { timeout: 60, retryAttempts: 3, gasLimit: 10000000 },
  }));
  process.env['XLN_JURISDICTIONS_PATH'] = join(directory, 'jurisdictions.json');
  process.env['XLN_MESH_PRIMARY_JURISDICTION_ONLY'] = '0';
  resetMeshJurisdictionsCache();
  clearSignerKeys(seed);
  try {
    const labels = buildLocalMarketMakerSignerLabels();
    expect(labels).toEqual([
      'mm-1', 'mm-1:pair:2', 'mm-1:pair:3',
      'mm-1:Secondary', 'mm-1:Secondary:pair:2', 'mm-1:Secondary:pair:3',
    ]);
    const env = await main(seed, { localSigners: labels.map(label => ({ label })) });
    try {
      const digest = `0x${'55'.repeat(32)}`;
      for (const label of labels) {
        const signer = deriveSignerAddressSync(seed, label).toLowerCase();
        expect(recoverAddress(digest, signDigest(seed, signer, digest)).toLowerCase()).toBe(signer);
      }
    } finally {
      await closeRuntimeDb(env);
      await closeInfraDb(env);
    }
  } finally {
    clearSignerKeys(seed);
    if (previousPath === undefined) delete process.env['XLN_JURISDICTIONS_PATH'];
    else process.env['XLN_JURISDICTIONS_PATH'] = previousPath;
    if (previousPrimaryOnly === undefined) delete process.env['XLN_MESH_PRIMARY_JURISDICTION_ONLY'];
    else process.env['XLN_MESH_PRIMARY_JURISDICTION_ONLY'] = previousPrimaryOnly;
    resetMeshJurisdictionsCache();
    rmSync(directory, { recursive: true, force: true });
  }
});
