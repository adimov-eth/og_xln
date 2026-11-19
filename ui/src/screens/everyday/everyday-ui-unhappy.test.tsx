import { afterAll, afterEach, expect, spyOn, test } from 'bun:test';
import { createDefaultDelta } from '@xln/core/account/state/delta';
import { asTokenDecimals } from '@xln/core/account/tx/units';
import { asTokenId } from '@xln/core/protocol/units';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { emptyEverydayProjection } from '../../runtime/everyday';
import type { WalletView } from '../../runtime/views';

const restoreGlobals: Array<() => void> = [];
const ensureGlobal = (key: string, value: unknown) => {
  if (key in globalThis && (globalThis as Record<string, unknown>)[key] !== undefined) return;
  const prev = Object.getOwnPropertyDescriptor(globalThis, key);
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  restoreGlobals.push(() => {
    if (prev) Object.defineProperty(globalThis, key, prev);
    else Reflect.deleteProperty(globalThis, key);
  });
};

const lsMap = new Map<string, string>();
ensureGlobal('localStorage', {
  getItem: (k: string) => lsMap.get(k) ?? null,
  setItem: (k: string, v: string) => { lsMap.set(k, v); },
  removeItem: (k: string) => { lsMap.delete(k); },
});
ensureGlobal('window', {
  location: { hostname: 'localhost', origin: 'http://localhost:8080', pathname: '/ui/', search: '' },
  addEventListener: () => {},
  removeEventListener: () => {},
  history: { state: null, replaceState: () => {} },
});
ensureGlobal('document', {
  documentElement: { dataset: {}, setAttribute: () => {}, style: { setProperty: () => {}, removeProperty: () => {} } },
  createElement: () => ({}),
  head: { appendChild: () => {} },
});

const { ExternalRequestSheet } = await import('../../components/everyday/ExternalRequestSheet');
const { EverydaySavings } = await import('./EverydaySavings');
const { bankOfferFor, previewSavingsRisk } = await import('../../runtime/financial/lending');
const storeMod = await import('../../runtime/store');
const useEverydayMod = await import('../../runtime/use-everyday-wallet');

const SELF = `0x${'11'.repeat(32)}`;
const HUB = `0x${'22'.repeat(32)}`;
const FRIEND = `0x${'33'.repeat(32)}`;
const SIGNER = `0x${'44'.repeat(20)}`;
const DEPOSITORY = `0x${'55'.repeat(20)}`;

const makeWallet = (isHubFriend = false): WalletView =>
  ({
    entityId: SELF,
    signerId: SIGNER,
    jurisdiction: 'Local',
    frameHeight: 1,
    frame: null,
    hubs: new Set([HUB]),
    names: new Map([[FRIEND, 'Alice'], [HUB, 'Hub']]),
    summaries: [{ entityId: FRIEND, label: 'Alice', isHub: isHubFriend, height: 1, signerId: SIGNER }],
    accounts: [],
  }) as unknown as WalletView;

const spies: Array<{ mockRestore: () => void }> = [];
afterEach(() => {
  while (spies.length > 0) spies.pop()?.mockRestore();
});
afterAll(() => {
  while (restoreGlobals.length > 0) restoreGlobals.pop()?.();
});

const isMockedStore = typeof storeMod.useApp !== 'function' || typeof storeMod.useApp.setState !== 'function';

const stubAppAndWallet = (opts?: { commandReady?: boolean }) => {
  const prevState = storeMod.useApp.getState();
  storeMod.useApp.setState({
    activeEntityId: SELF,
    selectedTokenId: asTokenId(1),
    externalWallet: null,
    commandReady: opts?.commandReady ?? true,
    tokenCatalog: [{ tokenId: asTokenId(1), symbol: 'USDC', name: 'USD Coin', decimals: asTokenDecimals(6) }],
  });
  spies.push({ mockRestore: () => storeMod.useApp.setState(prevState, true) });
  const proj = emptyEverydayProjection(SELF, 1);
  proj.primaryHubId = HUB;
  proj.primary.cash = 50_000_000n;
  proj.byToken.set(1, { tokenId: 1, cash: 50_000_000n, arriving: 0n, savings: 0n, friendsOweYou: 0n, youOweFriends: 0n });
  spies.push(
    spyOn(useEverydayMod, 'useEverydayWallet').mockReturnValue({
      wallet: makeWallet(false),
      projection: proj,
      hubRebalance: null,
      shield: { category: 'local-only', summary: 'Backups stay on this device only.' },
    }),
  );
};

if (isMockedStore && process.env['XLN_UNHAPPY_ISOLATED'] !== '1') {
  test('ExternalRequestSheet and EverydaySavings unhappy paths (isolated store)', () => {
    const proc = Bun.spawnSync([process.execPath, 'test', import.meta.filename], {
      env: { ...process.env, XLN_UNHAPPY_ISOLATED: '1' },
      stdout: 'pipe',
      stderr: 'pipe',
    });
    if (proc.exitCode !== 0) {
      throw new Error(`Isolated test failed:\n${proc.stdout.toString()}\n${proc.stderr.toString()}`);
    }
    expect(proc.exitCode).toBe(0);
  });
} else {
test('ExternalRequestSheet renders malformed URI %ZZ safely, handles invalid invoice, swap escalation, and disabled savings consent', () => {
  stubAppAndWallet({ commandReady: false });

  const invalidHtml = renderToStaticMarkup(
    <MemoryRouter>
      <ExternalRequestSheet rawInvoice="not-an-xln-invoice" onClose={() => {}} />
    </MemoryRouter>,
  );
  expect(invalidHtml).toContain('role="alert"');

  // Malformed %ZZ in #pay/... does not crash readTxTypeParam and renders clean alert
  const malformedPctHtml = renderToStaticMarkup(
    <MemoryRouter>
      <ExternalRequestSheet rawInvoice={`https://xln.finance/#pay/${FRIEND}%ZZ?txType=swap`} onClose={() => {}} />
    </MemoryRouter>,
  );
  expect(malformedPctHtml).toContain('role="alert"');

  const swapHtml = renderToStaticMarkup(
    <MemoryRouter>
      <ExternalRequestSheet rawInvoice={`https://xln.finance/#pay/${FRIEND}?txType=swap`} onClose={() => {}} />
    </MemoryRouter>,
  );
  expect(swapHtml).toContain('data-testid="external-request-escalate"');
  expect(swapHtml).toContain('data-testid="external-request-open-pro"');

  // Savings deposit starts with unchecked consent and disabled confirm button
  const savingsHtml = renderToStaticMarkup(
    <MemoryRouter>
      <ExternalRequestSheet rawInvoice={`https://xln.finance/#pay/${HUB}?amount=10&txType=lendingOffer`} onClose={() => {}} />
    </MemoryRouter>,
  );
  expect(savingsHtml).toContain('data-testid="external-savings-consent"');
  expect(savingsHtml).toContain('data-testid="external-request-confirm"');
  expect(savingsHtml).toContain('disabled=""');
});

test('EverydaySavings renders unavailable notice when terms are absent/expired and bankOfferFor/previewSavingsRisk enforce fail-closed rules', () => {
  stubAppAndWallet();

  const html = renderToStaticMarkup(
    <MemoryRouter>
      <EverydaySavings />
    </MemoryRouter>,
  );
  expect(html).toContain('data-testid="everyday-savings-balance"');
  expect(html).toContain('Available Cash: $50.00');
  expect(html).toContain("Savings isn&#x27;t offered right now. Your Cash is safe.");
  expect(html).not.toContain('data-testid="everyday-savings-add"');

  const domain = { chainId: 31_337, depositoryAddress: DEPOSITORY };
  const expiredTerm = {
    chainId: 31_337,
    depositoryAddress: DEPOSITORY,
    tokenId: 1,
    termId: 'demand' as const,
    savingsInterestBps: 500,
    loanInterestBps: 800,
    loanLateMs: 0,
    expiresAt: 1_000,
  };
  expect(bankOfferFor([expiredTerm], domain, 1, 'demand', 2_000)).toEqual({ kind: 'not-lending' });
  expect(bankOfferFor([], domain, 1, 'demand', 500)).toEqual({ kind: 'none' });

  const missingRiskHub = {
    doc: {
      lendingRisk: new Map(),
      state: { deltas: new Map([[1, createDefaultDelta(1)]]) },
    },
    isLeft: true,
  };
  expect(previewSavingsRisk(missingRiskHub, 1, '10', '500', asTokenDecimals(6))).toEqual({
    ok: false,
    error: 'Bank risk projection is unavailable',
  });
});
}
