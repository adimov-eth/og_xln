import { afterEach, describe, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { safeStringify } from '../../../protocol/serialization';

import {
  clearJurisdictionsCache,
  getConfiguredOfficialFoundationSignerId,
  loadJurisdictions,
  loadJurisdictionsAsync,
  resolveJurisdictionTransport,
} from '../../../jurisdiction/adapter/kernel/jurisdiction-loader';

const tempRoots: string[] = [];

const captureConsole = async <T>(fn: () => T | Promise<T>): Promise<{ result: T; messages: unknown[][] }> => {
  const original = {
    log: console.log,
    warn: console.warn,
    error: console.error,
  };
  const messages: unknown[][] = [];
  console.log = (...args: unknown[]) => messages.push(args);
  console.warn = (...args: unknown[]) => messages.push(args);
  console.error = (...args: unknown[]) => messages.push(args);

  try {
    const result = await fn();
    return { result, messages };
  } finally {
    console.log = original.log;
    console.warn = original.warn;
    console.error = original.error;
  }
};

const useTempJurisdictionsPath = (filename = 'jurisdictions.json'): string => {
  const root = mkdtempSync(join(tmpdir(), 'xln-jurisdiction-loader-'));
  tempRoots.push(root);
  const path = join(root, filename);
  process.env['XLN_JURISDICTIONS_PATH'] = path;
  clearJurisdictionsCache();
  return path;
};

const loadConfiguredTransport = (
  transport: Record<string, unknown>,
  extraJurisdictions: Record<string, unknown> = {},
  rootMetadata: Record<string, unknown> = {},
) => {
  const path = useTempJurisdictionsPath();
  const jurisdiction = {
    name: 'Native TVM',
    chainId: 1208511695,
    blockTimeMs: 3000,
    rpc: 'http://127.0.0.1:18545/jsonrpc',
    explorer: '',
    currency: 'TRX',
    status: 'active',
    contracts: { depository: `0x${'a'.repeat(40)}`, entityProvider: `0x${'2'.repeat(40)}` },
    ...transport,
  };
  writeFileSync(
    path,
    safeStringify({
      version: '1',
      lastUpdated: '2026-09-05T00:00:00.000Z',
      jurisdictions: { native: jurisdiction, ...extraJurisdictions },
      defaults: { timeout: 30000, retryAttempts: 3, gasLimit: 1000000 },
      ...rootMetadata,
    }),
    'utf8',
  );
  return { expected: jurisdiction, actual: () => loadJurisdictions().jurisdictions['native'] };
};

afterEach(() => {
  delete process.env['XLN_JURISDICTIONS_PATH'];
  delete process.env['XLN_JURISDICTIONS_DEBUG'];
  clearJurisdictionsCache();
  for (const root of tempRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe('jurisdiction loader diagnostics', () => {
  test('uses structured logging without direct console output', () => {
    const source = readFileSync(join(process.cwd(), 'core/jurisdiction/adapter/kernel/jurisdiction-loader.ts'), 'utf8');

    expect(source).toContain("const jurisdictionLoaderLog = createStructuredLogger('runtime.jurisdiction_loader');");
    expect(source).toContain("logJurisdictionLoaderDebug('config_loaded'");
    expect(source).toContain("logJurisdictionLoaderDebug('cache_cleared'");
    expect(source).toContain('JURISDICTIONS_CONFIG_MISSING');
    expect(source).not.toContain('console.');
    expect(source).not.toContain('new Date()');
  });

  test('missing canonical config fails loud without logging', async () => {
    const path = useTempJurisdictionsPath();
    const { messages } = await captureConsole(async () => {
      expect(() => loadJurisdictions()).toThrow(
        `JURISDICTIONS_LOAD_FAILED:path=unknown:JURISDICTIONS_CONFIG_MISSING:path=${path}`,
      );
    });
    expect(messages).toEqual([]);
  });

  test('missing optional official trust root does not block community startup', () => {
    useTempJurisdictionsPath();

    expect(getConfiguredOfficialFoundationSignerId()).toBeUndefined();
  });

  test('invalid config fails loud with path-scoped load error', () => {
    const path = useTempJurisdictionsPath();
    writeFileSync(path, '{not-json', 'utf8');

    expect(() => loadJurisdictions()).toThrow(`JURISDICTIONS_LOAD_FAILED:path=${path}:`);
  });
});

describe('jurisdiction transport boundary', () => {
  test.each([true, false])('async canonical reader preserves browser metadata ephemeralTestnet=%s', async value => {
    loadConfiguredTransport({}, {}, { ephemeralTestnet: value });
    const data = await loadJurisdictionsAsync();
    expect(data.ephemeralTestnet).toBe(value);
    expect(data).toEqual(loadJurisdictions());
  });

  test.each(['true', 0, null])('canonical reader rejects non-boolean browser metadata: %j', async value => {
    loadConfiguredTransport({}, {}, { ephemeralTestnet: value });
    await expect(loadJurisdictionsAsync()).rejects.toThrow('JURISDICTIONS_EPHEMERAL_TESTNET_INVALID');
  });

  test('resolves native transport by exact chain and case-insensitive Depository identity', async () => {
    const transport = { mode: 'tron', tronFullHost: 'http://127.0.0.1:19090', tronSolidityHost: 'http://127.0.0.1:19091' };
    loadConfiguredTransport(transport);
    expect(await resolveJurisdictionTransport(1208511695, `0x${'A'.repeat(40)}`)).toEqual(transport);
    expect(await resolveJurisdictionTransport(1208511696, `0x${'a'.repeat(40)}`)).toBeUndefined();
    expect(await resolveJurisdictionTransport(1208511695, `0x${'b'.repeat(40)}`)).toBeUndefined();
  });

  test('does not invent a transport for an existing untagged jurisdiction', async () => {
    loadConfiguredTransport({});
    expect(await resolveJurisdictionTransport(1208511695, `0x${'a'.repeat(40)}`)).toEqual({});
  });

  test('rejects duplicate chain and Depository aliases instead of selecting first match', async () => {
    const configured = loadConfiguredTransport({ mode: 'tron', tronFullHost: 'http://127.0.0.1:19090' });
    loadConfiguredTransport({}, { alias: { ...configured.expected, name: 'Alias' } });
    await expect(resolveJurisdictionTransport(1208511695, `0x${'a'.repeat(40)}`))
      .rejects.toThrow('JURISDICTION_TRANSPORT_BINDING_AMBIGUOUS');
  });

  test('missing or invalid native configuration cannot become a transport miss', async () => {
    useTempJurisdictionsPath();
    await expect(resolveJurisdictionTransport(1208511695, `0x${'a'.repeat(40)}`))
      .rejects.toThrow('JURISDICTIONS_CONFIG_MISSING');
    loadConfiguredTransport({ mode: 'tron' });
    await expect(resolveJurisdictionTransport(1, `0x${'b'.repeat(40)}`))
      .rejects.toThrow('TRON_FULL_HOST_INVALID');
  });

  test('preserves explicit native TVM transport through the real config loader', () => {
    const configured = loadConfiguredTransport({
      mode: 'tron',
      tronFullHost: 'http://127.0.0.1:19090',
      tronSolidityHost: 'http://127.0.0.1:19091',
    });
    expect(configured.actual()).toEqual(configured.expected);
  });

  test.each([{}, { mode: 'rpc' }, { mode: 'tron', tronFullHost: 'https://api.trongrid.io' }])(
    'preserves absent, explicit RPC and single-host transport without injecting fields: %j',
    transport => {
      const configured = loadConfiguredTransport(transport);
      expect(configured.actual()).toEqual(configured.expected);
    },
  );

  test.each([
    { mode: 'anvil' },
    { mode: 'tron' },
    { tronFullHost: 'https://api.trongrid.io' },
    { mode: 'rpc', tronSolidityHost: 'http://127.0.0.1:19091' },
    { mode: 'tron', tronFullHost: 'file:///tmp/node' },
    { mode: 'tron', tronFullHost: 'https://user:secret@node.invalid' },
    { mode: 'tron', tronFullHost: 'http://node.invalid/#head' },
    { mode: 'tron', tronFullHost: 'http://node.invalid/#' },
    { mode: 'tron', tronFullHost: ' http://node.invalid/' },
    { mode: 'tron', tronFullHost: 'not-a-url' },
    { mode: 'tron', tronFullHost: 'http://node.invalid', tronSolidityHost: null },
    { mode: 'tron', tronFullHost: 'http://node.invalid', tronSolidityHost: 'ws://node.invalid' },
    { mode: 'tron', tronFullHost: 'http://node.invalid', tronSolidityHost: 'http://u:p@node.invalid' },
    { mode: 'tron', tronFullHost: 'http://node.invalid', tronSolidityHost: 'http://node.invalid/#head' },
  ])('rejects incomplete or unsafe transport before adapter construction: %j', transport => {
    const configured = loadConfiguredTransport(transport);
    expect(configured.actual).toThrow('JURISDICTIONS_LOAD_FAILED:');
  });
});
