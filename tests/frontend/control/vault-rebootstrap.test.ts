import { expect, mock, test } from 'bun:test';
import {
  clearRetiredTestnetRebootstrap,
  deriveAddress,
  derivePrivateKey,
  hasRetiredTestnetRebootstrap,
} from '../../../frontend/src/lib/stores/vault/vault-recovery';
import { generateLazyEntityIdPreview } from '../../../frontend/src/lib/utils/identity/lazyEntityId';
import { createEmptyEnv } from '../../../core/runtime';
import { markRetiredTestnetRebootstrapRuntimes } from '../../../frontend/src/lib/utils/control/resetEverything';

test('vaultStore enforces fail-closed loadEnvFromDB, preserves rebootstrap marker on mid-import failure, clears it after success, and locks cleanly', async () => {
  const prevStorage = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  const prevFetch = globalThis.fetch;
  const storageMap = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    writable: true,
    value: {
      getItem: (k: string) => storageMap.get(k) ?? null,
      setItem: (k: string, v: string) => { storageMap.set(k, v); },
      removeItem: (k: string) => { storageMap.delete(k); },
    },
  });

  const seed = 'test test test test test test test test test test test junk';
  const runtimeId = deriveAddress(seed, 0).toLowerCase();
  const signer1 = deriveAddress(seed, 1).toLowerCase();
  const entityId = String(generateLazyEntityIdPreview([signer1], 1n)).toLowerCase();
  const contractAddr = `0x${'11'.repeat(20)}`;
  const jurisdictionsPayload = {
    jurisdictions: {
      Local: {
        name: 'Local',
        chainId: 31_337,
        rpc: 'http://127.0.0.1:8545',
        blockTimeMs: 1_000,
        entityProviderDeploymentBlock: 1,
        primary: true,
        contracts: {
          account: contractAddr,
          depository: contractAddr,
          entityProvider: contractAddr,
          deltaTransformer: contractAddr,
        },
      },
    },
  };
  globalThis.fetch = (async () => new Response(JSON.stringify(jurisdictionsPayload), { status: 200 })) as unknown as typeof fetch;

  let loadEnvFn: () => Promise<ReturnType<typeof createEmptyEnv> | null> = async () => null;
  let failImportJ = false;
  let createEmptyCalls = 0;
  const persistedFrames = new Map<number, { height: number; runtimeInput: unknown }>();

  const fakeXln = {
    registerSignerKey: () => {},
    clearSignerKeys: () => {},
    generateLazyEntityId: generateLazyEntityIdPreview,
    deriveAddress,
    derivePrivateKey,
    createEmptyEnv: (s: string) => {
      createEmptyCalls += 1;
      const env = createEmptyEnv(s);
      env.infrastructure = { ...(env.infrastructure ?? {}), loopActive: true, persistencePaused: false, persistenceQuiescing: false } as never;
      return env;
    },
    loadEnvFromDB: async () => loadEnvFn(),
    resumeRuntimeAfterPersistenceQuiesce: () => {},
    startP2P: () => {},
    getP2P: () => ({ isConnected: () => true, isConnecting: () => false }),
    startRuntimeLoop: () => {},
    waitForRuntimeProcessingIdle: async () => true,
    safeStringify: (v: unknown) => JSON.stringify(v),
    readPersistedStorageFrameRecord: async (_env: unknown, height: number) => persistedFrames.get(height) ?? null,
    readPersistedStorageHead: async () => ({ latestHeight: Math.max(0, ...persistedFrames.keys()) }),
    stopJurisdictionWatchersAndWait: async () => {},
    waitForRuntimeWorkDrained: async () => true,
    stopRuntimeLoopAndWait: async () => true,
    stopP2PAndWait: async () => {},
    importEntity: (data: unknown) => ({ type: 'importEntity', data }),
    enqueueRuntimeInput: (env: ReturnType<typeof createEmptyEnv>, input: { runtimeTxs?: Array<{ type: string; data?: Record<string, unknown> }> }) => {
      for (const tx of input.runtimeTxs ?? []) {
        if (tx.type === 'importJ') {
          if (failImportJ) throw new Error('IMPORT_J_BOOM');
          env.state.jReplicas.set('Local', {
            name: 'Local',
            chainId: 31_337,
            blockTimeMs: 1_000,
            entityProviderDeploymentBlock: 1,
            contracts: jurisdictionsPayload.jurisdictions.Local.contracts,
          } as never);
          env.infrastructure = { ...(env.infrastructure ?? {}), adapters: new Map([['Local', {}]]) } as never;
        }
        if (tx.type === 'importEntity') {
          env.state.eReplicas.set(`${entityId}:${signer1}`, {
            entityId,
            signerId: signer1,
            mempool: [],
            state: { accounts: new Map(), config: { jurisdiction: { name: 'Local', chainId: 31_337 } } },
          } as never);
        }
      }
      env.state.height += 1;
      persistedFrames.set(env.state.height, { height: env.state.height, runtimeInput: input });
    },
  };

  mock.module('../../../frontend/src/lib/stores/bootstrap/xlnRuntimeLoader', () => ({
    getXLN: async () => fakeXln,
    xlnInstance: { subscribe: () => () => {}, set: () => {}, update: () => {} },
  }));

  try {
    const { runtimesState, vaultOperations } = await import('../../../frontend/src/lib/stores/vault/vaultStore');
    const seedRuntime = () => {
      const rt = {
        id: runtimeId,
        label: 'Test',
        seed,
        signers: [{ address: signer1, name: 'Signer 1', entityId, index: 1, jurisdiction: 'Local' }],
        activeSignerIndex: 0,
        createdAt: 1,
        loginType: 'manual' as const,
      };
      const persisted = {
        id: runtimeId,
        label: 'Test',
        signers: rt.signers,
        activeSignerIndex: 0,
        createdAt: 1,
        loginType: 'manual' as const,
      };
      storageMap.set('xln-vaults', JSON.stringify({ runtimes: { [runtimeId]: persisted }, activeRuntimeId: runtimeId }));
      runtimesState.set({ runtimes: { [runtimeId]: rt }, activeRuntimeId: runtimeId });
    };
    seedRuntime();

    // 1. Corrupted DB error MUST throw even when rebootstrap marker is present
    markRetiredTestnetRebootstrapRuntimes();
    expect(hasRetiredTestnetRebootstrap(runtimeId)).toBe(true);
    loadEnvFn = async () => { throw new Error('IDB_CORRUPT'); };
    await expect(vaultOperations.prepareRuntimeForAdapterSwitch(runtimeId)).rejects.toThrow('Runtime restore failed');
    expect(createEmptyCalls).toBe(0);
    expect(hasRetiredTestnetRebootstrap(runtimeId)).toBe(true);

    // 2. Missing local env WITHOUT marker MUST fail-closed without bootstrapping fresh env
    clearRetiredTestnetRebootstrap(runtimeId);
    loadEnvFn = async () => null;
    await expect(vaultOperations.prepareRuntimeForAdapterSwitch(runtimeId)).rejects.toThrow('persisted env missing');
    expect(createEmptyCalls).toBe(0);

    // 3. Mid-import failure with marker MUST preserve the marker for retry
    markRetiredTestnetRebootstrapRuntimes();
    failImportJ = true;
    await expect(vaultOperations.prepareRuntimeForAdapterSwitch(runtimeId)).rejects.toThrow('IMPORT_J_BOOM');
    expect(createEmptyCalls).toBe(1);
    expect(hasRetiredTestnetRebootstrap(runtimeId)).toBe(true);

    // 4. Clean rebootstrap clears the marker ONLY after import completes
    failImportJ = false;
    const prepared = await vaultOperations.prepareRuntimeForAdapterSwitch(runtimeId);
    expect(prepared).toBe(runtimeId);
    expect(createEmptyCalls).toBe(2);
    expect(hasRetiredTestnetRebootstrap(runtimeId)).toBe(false);

    // 5. lockRuntime wipes seed and rejects subsequent adapter switch as RUNTIME_LOCKED
    await vaultOperations.lockRuntime(runtimeId);
    await expect(vaultOperations.prepareRuntimeForAdapterSwitch(runtimeId)).rejects.toThrow(`RUNTIME_LOCKED:${runtimeId}`);
  } finally {
    globalThis.fetch = prevFetch;
    if (prevStorage) Object.defineProperty(globalThis, 'localStorage', prevStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
