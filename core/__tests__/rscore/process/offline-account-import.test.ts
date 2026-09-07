import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Level } from 'level';

import { deriveSignerAddressSync } from '../../../account/crypto';
import { generateLazyEntityId } from '../../../entity/factory';
import { commitEntityFrameCandidateState } from '../../../entity/state-clone';
import { safeStringify } from '../../../protocol/serialization';
import {
  closeInfraDb,
  closeRuntimeDb,
  createEmptyEnv,
  getRuntimeStorageDb,
  getRuntimeWalDb,
  saveEnvToDB,
} from '../../../runtime';
import { applyRuntimeStorageChanges } from '../../../runtime/observability/env-events';
import { importOfflineCheckpointAccounts } from '../../../scripts/operations/hlt/replay/import/offline-account-import';
import { exportConcreteCheckpointSource } from '../../../storage/read/concrete-checkpoint-source';
import { resolveDbPath } from '../../../storage/runtime-db-path';
import { loadRscoreCheckpoint } from '../../../storage/schema/rscore/checkpoint';
import { addReplica, entity, makeJurisdiction, makeState } from '../../helpers/cross-j';

const BINARY = join(import.meta.dir, '../../../../rscore/target/release/xlnrs');
const bytes = (value: string): Buffer => Buffer.from(value.slice(2), 'hex');

test('offline Account import preserves the signed source and restores both owner forests in real Rust', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'xln-offline-import-test-'));
  const seed = `offline import fixture ${directory}`;
  const env = createEmptyEnv(seed);
  env.runtimeId = deriveSignerAddressSync(seed, '1').toLowerCase();
  env.dbNamespace = env.runtimeId;
  env.quietRuntimeLogs = true;
  env.runtimeConfig = { ...env.runtimeConfig, storage: { materializePeriodFrames: 1, snapshotPeriodFrames: 1 } };
  const chainId = 31337;
  const jurisdiction = makeJurisdiction('offline-import', chainId, '11', '12');
  env.state.jReplicas.set(jurisdiction.name, {
    name: jurisdiction.name,
    chainId,
    blockNumber: 0n,
    stateRoot: null,
    mempool: [],
    blockDelayMs: 0,
    lastBlockTimestamp: 0,
    position: { x: 0, y: 0, z: 0 },
    rpcs: [jurisdiction.address],
    contracts: {
      depository: jurisdiction.depositoryAddress,
      entityProvider: jurisdiction.entityProviderAddress,
      account: `0x${'98'.repeat(20)}`,
      deltaTransformer: `0x${'99'.repeat(20)}`,
    },
  });
  const expectedRoots = new Map<string, string>();
  const importedDb = new Level<Buffer, Buffer>(join(directory, 'imported'), {
    keyEncoding: 'buffer',
    valueEncoding: 'buffer',
  });
  try {
    for (const label of ['h1-hub', `h1-hub:${jurisdiction.name}`]) {
      const signer = deriveSignerAddressSync(seed, label).toLowerCase();
      const owner = generateLazyEntityId([signer], 1n).toLowerCase();
      const state = commitEntityFrameCandidateState(makeState(owner, signer, jurisdiction, entity('cd')));
      addReplica(env, state, signer);
      applyRuntimeStorageChanges(env, [
        { family: 'entity', entityId: owner },
        { family: 'account', entityId: owner, counterpartyId: entity('cd') },
      ]);
      expectedRoots.set(owner, state.accounts.rootHash());
    }
    env.state.height = 1;
    env.state.timestamp = 1000;
    await saveEnvToDB(env, { runtimeTxs: [], entityInputs: [] }, [], new Map());
    const source = await exportConcreteCheckpointSource(env, {
      getStorageDb: getRuntimeStorageDb,
      getRuntimeWalDb,
    });
    const original = safeStringify(source);
    const options = { binaryPath: BINARY, runtimeSeed: seed, entitySignerLabel: 'h1-hub' };
    const imported = await importOfflineCheckpointAccounts(source, options);
    expect(safeStringify(source)).toBe(original);
    expect({ ...imported, stateRows: source.stateRows }).toEqual(source);
    expect(imported.stateRows.filter(([key]) => !/^0x1[789]/.test(key))).toEqual(
      source.stateRows.filter(([key]) => !key.startsWith('0x17')),
    );
    expect(imported.stateRows.filter(([key]) => key.startsWith('0x18'))).toHaveLength(2);
    await importedDb.open();
    await importedDb.batch(
      imported.stateRows.map(([key, value]) => ({
        type: 'put' as const,
        key: bytes(key),
        value: bytes(value),
      })),
    );
    for (const [owner, root] of expectedRoots) {
      const checkpoint = await loadRscoreCheckpoint(importedDb, owner);
      if (!checkpoint) throw new Error('TEST_IMPORTED_CHECKPOINT_MISSING');
      expect(`0x${Buffer.from(checkpoint.restoreToken[2]).toString('hex')}`).toBe(root);
      expect(checkpoint.restoreToken[4]).toBe(1);
    }
    await expect(importOfflineCheckpointAccounts(imported, options)).rejects.toThrow(
      'HLT_OFFLINE_IMPORT_ALREADY_NATIVE',
    );
  } finally {
    await importedDb.close();
    await closeRuntimeDb(env);
    await closeInfraDb(env);
    for (const suffix of ['', '-wal', '-storage-current', '-storage-previous', '-infra', '-events', '-history-views']) {
      rmSync(`${resolveDbPath(env)}${suffix}`, { recursive: true, force: true });
    }
    rmSync(directory, { recursive: true, force: true });
  }
});
