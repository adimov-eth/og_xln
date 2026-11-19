import { expect, test } from 'bun:test';
import { resolve } from 'node:path';

const REPO_ROOT = resolve(import.meta.dir, '../../..');

function runAdapterScript(code: string) {
  const proc = Bun.spawnSync([process.execPath, '-e', code], {
    cwd: REPO_ROOT,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const stdout = proc.stdout.toString();
  const stderr = proc.stderr.toString();
  if (proc.exitCode !== 0) {
    throw new Error(`Subprocess failed (${proc.exitCode}):\nSTDOUT:\n${stdout}\nSTDERR:\n${stderr}`);
  }
  return JSON.parse(stdout.trim()) as Record<string, unknown>;
}

const preamble = (hostname: string) => `
  const ls = new Map();
  const ss = new Map();
  globalThis.__XLN_UI_DIAGNOSTICS__ = true;
  globalThis.localStorage = {
    getItem: k => ls.get(k) ?? null,
    setItem: (k, v) => ls.set(k, v),
    removeItem: k => ls.delete(k),
  };
  globalThis.sessionStorage = {
    getItem: k => ss.get(k) ?? null,
    setItem: (k, v) => ss.set(k, v),
    removeItem: k => ss.delete(k),
  };
  globalThis.window = {
    location: { hostname: ${JSON.stringify(hostname)}, origin: 'http://${hostname}:8080', pathname: '/ui/', search: '' },
    addEventListener: () => {},
    removeEventListener: () => {},
    history: { state: null, replaceState: () => {} },
  };
  globalThis.document = {
    documentElement: { dataset: {}, setAttribute: () => {}, style: { setProperty: () => {}, removeProperty: () => {} } },
    createElement: () => ({}),
    head: { appendChild: () => {} },
  };
  globalThis.navigator = { locks: { request: async (_n, a, b) => (typeof a === 'function' ? a({}) : b({})) } };
`;

test('adapter merges onto pre-existing non-writable window.__xln without throwing and preserves lazy getters & localhost-only commandJournal', () => {
  const merged = runAdapterScript(`
    ${preamble('localhost')}
    const { registerDebugSurface } = await import('./frontend/src/lib/utils/runtime/debugSurface.ts');
    // Force DEV check for debugSurface in Bun by registering on window.__xln directly as debugSurface does
    const root = {};
    Object.defineProperty(window, '__xln', { configurable: true, enumerable: false, value: root });
    Object.defineProperty(root, 'commands', { configurable: true, enumerable: true, get: () => 'commands-ok' });
    await import('./ui/src/runtime/adapter.ts');
    console.log(JSON.stringify({
      commands: window.__xln.commands,
      hasAdapter: typeof window.__xln.adapter === 'function',
      hasEnv: typeof window.__xln.env === 'function',
      hasXln: typeof window.__xln.xln === 'function',
      hasStore: Boolean(window.__xln.store),
      runtimeConnectivity: window.__xln.runtimeConnectivity,
      hasCommandJournal: Boolean(window.__xln.commandJournal),
      enumerable: Object.getOwnPropertyDescriptor(window, '__xln')?.enumerable,
    }));
  `);
  expect(merged).toEqual({
    commands: 'commands-ok',
    hasAdapter: true,
    hasEnv: true,
    hasXln: true,
    hasStore: true,
    runtimeConnectivity: null,
    hasCommandJournal: true,
    enumerable: false,
  });

  const publicHost = runAdapterScript(`
    ${preamble('xln.finance')}
    await import('./ui/src/runtime/adapter.ts');
    console.log(JSON.stringify({
      hasAdapter: typeof window.__xln?.adapter === 'function',
      hasCommandJournal: Boolean(window.__xln?.commandJournal),
      enumerable: Object.getOwnPropertyDescriptor(window, '__xln')?.enumerable,
    }));
  `);
  expect(publicHost).toEqual({
    hasAdapter: true,
    hasCommandJournal: false,
    enumerable: false,
  });
});

test('runtimeConnectivity validates malformed config and lockEmbeddedRuntime deduplicates, wipes seed on failure, and keeps failed close latch', () => {
  const result = runAdapterScript(`
    import { mock } from 'bun:test';
    ${preamble('localhost')}
    let clearCalls = 0;
    let closeCalls = 0;
    let failClose = true;
    const fakeEnv = {
      runtimeId: '',
      runtimeSeed: 'secret-seed',
      infrastructure: {
        p2p: { matchesIdentity: () => true, isConnected: () => true, getRelayClientCount: () => 1 },
        lastP2PConfig: { signerId: '0x1', relayUrls: 'bad' },
      },
      state: { eReplicas: new Map() },
    };
    mock.module('./frontend/src/lib/security/runtimeSession.ts', () => ({
      closeRuntimeSession: async () => {
        closeCalls += 1;
        if (failClose) throw new Error('DRAIN_FAILED');
      },
      suspendRuntimeActivity: async () => {},
    }));
    mock.module('./ui/src/runtime/xln-loader.ts', () => ({
      getXLN: async () => ({
        clearSignerKeys: () => { clearCalls += 1; },
        EmbeddedRuntimeAdapter: class {
          constructor(cfg) { this.cfg = cfg; }
          onChange() { return () => {}; }
          onStatus() { return () => {}; }
          connect(c) { return this.cfg.main(c?.seed); }
          disconnect() {}
          mode = 'embedded';
          runtimeId = '0x' + '11'.repeat(20);
          status = 'connected';
          currentHeight = 1;
          nextCommandSequence = 1;
          commandLaneKind = 'local';
          authLevel = 'owner';
          commandReady = true;
          commandReadyReason = null;
          read = async () => null;
        },
        main: async () => fakeEnv,
        attachRuntimeLifecycle: () => {},
      }),
      peekXLN: () => null,
    }));
    const adapterMod = await import('./ui/src/runtime/adapter.ts');
    await adapterMod.connectEmbedded('secret-seed', '0x' + '11'.repeat(20));

    let missingIdErr = '';
    try { void window.__xln.runtimeConnectivity; } catch (e) { missingIdErr = e.message; }
    fakeEnv.runtimeId = '0x' + '11'.repeat(20);
    let badRelayErr = '';
    try { void window.__xln.runtimeConnectivity; } catch (e) { badRelayErr = e.message; }

    const p1 = adapterMod.lockEmbeddedRuntime();
    const p2 = adapterMod.lockEmbeddedRuntime();
    const samePromise = p1 === p2;
    let lockErr = '';
    try { await p1; } catch (e) { lockErr = e.message; }

    // Failed close retains rejected closing promise so connectEmbedded cannot launch a second runtime
    let secondConnectErr = '';
    try { await adapterMod.connectEmbedded('other-seed', '0x' + '22'.repeat(20)); } catch (e) { secondConnectErr = e.message; }

    console.log(JSON.stringify({
      missingIdErr,
      badRelayErr,
      samePromise,
      closeCalls,
      clearCalls,
      seedAfterLock: fakeEnv.runtimeSeed === undefined,
      lockErr,
      secondConnectErr,
    }));
    process.exit(0);
  `);
  expect(result).toEqual({
    missingIdErr: 'RUNTIME_CONNECTIVITY_IDENTITY_MISSING',
    badRelayErr: 'RUNTIME_CONNECTIVITY_RELAY_CONFIG_MISSING',
    samePromise: true,
    closeCalls: 1,
    clearCalls: 1,
    seedAfterLock: true,
    lockErr: 'DRAIN_FAILED',
    secondConnectErr: 'DRAIN_FAILED',
  });
});
