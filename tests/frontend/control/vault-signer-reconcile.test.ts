import { expect, mock, test } from 'bun:test';
import { deriveAddress, derivePrivateKey } from '../../../frontend/src/lib/stores/vault/vault-recovery';
import { generateLazyEntityIdPreview } from '../../../frontend/src/lib/utils/identity/lazyEntityId';
import { createEmptyEnv } from '../../../core/runtime';

// Restore reconciles a signer's stored entity id with the restored env before the strict check,
// and writes the vault only after that check passes. A stored id whose entity was restored is kept,
// even when it is not the lazy id; a failed restore leaves the vault exactly as it was.
test('restore keeps a present stored entity id, adopts the lazy id only when it is the one restored, and never rewrites the vault on failure', async () => {
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
  const lazyEntityId = String(generateLazyEntityIdPreview([signer1], 1n)).toLowerCase();
  const otherEntityId = `0x${'ab'.repeat(32)}`;
  const strangerEntityId = `0x${'cd'.repeat(32)}`;
  const contractAddr = `0x${'11'.repeat(20)}`;
  const contracts = { account: contractAddr, depository: contractAddr, entityProvider: contractAddr, deltaTransformer: contractAddr };
  const jurisdictionsPayload = {
    jurisdictions: {
      Local: { name: 'Local', chainId: 31_337, rpc: 'http://127.0.0.1:8545', blockTimeMs: 1_000, entityProviderDeploymentBlock: 1, primary: true, contracts },
    },
  };
  globalThis.fetch = (async () => new Response(JSON.stringify(jurisdictionsPayload), { status: 200 })) as unknown as typeof fetch;

  /** A restored env on the Local network holding exactly one entity for signer1. */
  const restoredEnvWith = (entityId: string) => {
    const env = createEmptyEnv(seed);
    env.state.height = 3;
    env.state.jReplicas.set('Local', { name: 'Local', chainId: 31_337, blockTimeMs: 1_000, entityProviderDeploymentBlock: 1, contracts } as never);
    env.state.eReplicas.set(`${entityId}:${signer1}`, {
      entityId,
      signerId: signer1,
      mempool: [],
      state: { accounts: new Map(), config: { jurisdiction: { name: 'Local', chainId: 31_337 } } },
    } as never);
    env.infrastructure = { ...(env.infrastructure ?? {}), loopActive: true, persistencePaused: false, persistenceQuiescing: false, adapters: new Map([['Local', {}]]) } as never;
    return env;
  };
  let loadEnvFn: () => Promise<ReturnType<typeof createEmptyEnv> | null> = async () => null;
  const persistedFrames = new Map<number, { height: number; runtimeInput: unknown }>();

  const fakeXln = {
    registerSignerKey: () => {},
    clearSignerKeys: () => {},
    generateLazyEntityId: generateLazyEntityIdPreview,
    deriveAddress,
    derivePrivateKey,
    createEmptyEnv: (s: string) => createEmptyEnv(s),
    loadEnvFromDB: async () => loadEnvFn(),
    resumeRuntimeAfterPersistenceQuiesce: () => {},
    startP2P: () => {},
    getP2P: () => ({ isConnected: () => true, isConnecting: () => false }),
    startRuntimeLoop: () => {},
    waitForRuntimeProcessingIdle: async () => true,
    safeStringify: (v: unknown) => JSON.stringify(v),
    readPersistedStorageFrameRecord: async (_env: unknown, height: number) => persistedFrames.get(height) ?? null,
    readPersistedStorageHead: async () => ({ latestHeight: Math.max(3, ...persistedFrames.keys()) }),
    stopJurisdictionWatchersAndWait: async () => {},
    waitForRuntimeWorkDrained: async () => true,
    stopRuntimeLoopAndWait: async () => true,
    stopP2PAndWait: async () => {},
    importEntity: (data: unknown) => ({ type: 'importEntity', data }),
    // Every queued input lands in the next saved frame, as the runtime loop would do.
    enqueueRuntimeInput: (env: ReturnType<typeof createEmptyEnv>, input: unknown) => {
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
    const { runtimes } = await import('../../../frontend/src/lib/stores/runtimeStore');
    const seedVault = (storedEntityId: string) => {
      // Each case opens from storage, not from the env a previous case left in memory.
      runtimes.set(new Map());
      const signers = [{ address: signer1, name: 'Signer 1', entityId: storedEntityId, index: 1, jurisdiction: 'Local' }];
      const persisted = { id: runtimeId, label: 'Test', signers, activeSignerIndex: 0, createdAt: 1, loginType: 'manual' as const };
      storageMap.set('xln-vaults', JSON.stringify({ runtimes: { [runtimeId]: persisted }, activeRuntimeId: runtimeId }));
      runtimesState.set({
        runtimes: { [runtimeId]: { ...persisted, seed, signers: signers.map(signer => ({ ...signer })) } },
        activeRuntimeId: runtimeId,
      });
    };
    const storedEntityId = (): string => {
      const vaults = JSON.parse(storageMap.get('xln-vaults') ?? '{}') as { runtimes: Record<string, { signers: Array<{ entityId: string }> }> };
      return String(vaults.runtimes[runtimeId]?.signers[0]?.entityId);
    };

    // 1. A stored id that is not the lazy id, whose entity was restored, is kept.
    seedVault(otherEntityId);
    persistedFrames.clear();
    loadEnvFn = async () => restoredEnvWith(otherEntityId);
    expect(await vaultOperations.prepareRuntimeForAdapterSwitch(runtimeId)).toBe(runtimeId);
    expect(storedEntityId()).toBe(otherEntityId);

    // 2. A stored id that is absent while the lazy entity was restored moves to the lazy id.
    seedVault(otherEntityId);
    persistedFrames.clear();
    loadEnvFn = async () => restoredEnvWith(lazyEntityId);
    expect(await vaultOperations.prepareRuntimeForAdapterSwitch(runtimeId)).toBe(runtimeId);
    expect(storedEntityId()).toBe(lazyEntityId);

    // 3. Neither present: the strict check fails on the stored id and the vault is untouched.
    seedVault(otherEntityId);
    loadEnvFn = async () => restoredEnvWith(strangerEntityId);
    await expect(vaultOperations.prepareRuntimeForAdapterSwitch(runtimeId)).rejects.toThrow('missing restored entity');
    expect(storedEntityId()).toBe(otherEntityId);
  } finally {
    globalThis.fetch = prevFetch;
    if (prevStorage) Object.defineProperty(globalThis, 'localStorage', prevStorage);
    else Reflect.deleteProperty(globalThis, 'localStorage');
  }
});
