import { expect, test } from 'bun:test';
import { recoverAddress } from 'ethers';
import { clearSignerKeys, deriveSignerAddressSync, signDigest } from '../../../account/crypto';
import { decodeStartupSigners } from '../../../api/server/startup-signers';
import {
  buildCrossLoadStartupSignerLabels,
  crossLoadSignerLabels,
  deriveManagedSignerInventory,
} from '../../../orchestrator/mesh/mesh-seeds';
import { safeStringify } from '../../../protocol/serialization';
import { closeInfraDb, closeRuntimeDb, main } from '../../../runtime';

test('Custody startup installs the exact indexed cross-swap owners before recovery', async () => {
  const runtimeSeed = 'custody-indexed-startup-regression:runtime';
  const custodySeed = 'custody-indexed-startup-regression';
  const labels = buildCrossLoadStartupSignerLabels(2);
  expect(labels).toEqual([
    'production-load-source-0', 'production-load-target-0',
    'production-load-source-1', 'production-load-target-1',
  ]);
  expect(labels).toEqual([...crossLoadSignerLabels(0), ...crossLoadSignerLabels(1)]);
  const inventory = deriveManagedSignerInventory(custodySeed, labels);
  const digest = `0x${'73'.repeat(32)}`;
  clearSignerKeys(runtimeSeed);
  try {
    // Registration under the old unsuffixed labels cannot authorize these EOAs.
    for (const owner of inventory) {
      const signer = deriveSignerAddressSync(owner.seed, owner.label).toLowerCase();
      expect(() => signDigest(runtimeSeed, signer, digest)).toThrow('MISSING_SIGNER_KEY');
    }
    const env = await main(runtimeSeed, {
      localSigners: decodeStartupSigners(safeStringify(inventory)),
    });
    try {
      for (const owner of inventory) {
        const signer = deriveSignerAddressSync(owner.seed, owner.label).toLowerCase();
        expect(recoverAddress(digest, signDigest(runtimeSeed, signer, digest)).toLowerCase()).toBe(signer);
      }
    } finally {
      await closeRuntimeDb(env);
      await closeInfraDb(env);
    }
  } finally {
    clearSignerKeys(runtimeSeed);
  }
});

test('Custody startup rejects unbounded or fractional cohort inventories', () => {
  for (const count of [0, -1, 1.5, Number.NaN, 128]) {
    expect(() => buildCrossLoadStartupSignerLabels(count)).toThrow('PRODUCTION_SWAP_LOAD_COHORT_COUNT_INVALID');
  }
});
