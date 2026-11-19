import { expect, type Page } from '@playwright/test';
import type { RuntimeAdapterViewFrame, XLNModule } from '../../core/api/public/runtime-module';
import type { RuntimeAdapter } from '../../core/api/runtime-adapter/types';
import type { RuntimeReplica } from '../../core/runtime/types';
import type { AccountLendingCovenant } from '../../core/types/account';
import { deriveDelta } from '../../core/account/utils';
import { lendingExitAmount } from '../../core/protocol/dispute/lending-covenant';

function resolvePageApiUrl(page: Page, path: string): string {
  const current = page.url();
  return /^https?:\/\//i.test(current) ? new URL(path, new URL(current).origin).href : path;
}

export type WalletKind = 'react' | 'svelte';

export type EverydayIdentity = {
  runtimeId: string;
  entityId: string;
  signerId: string;
  jurisdiction: string;
  primaryHubId: string | null;
};

export type EverydayHubAccountSnapshot = {
  peerId: string;
  outCollateral: string;
  outPeerCredit: string;
  inOwnCredit: string;
  ownCreditLimit: string;
  peerCreditLimit: string;
  pending: boolean;
  mempool: number;
};

export type EverydayFriendAccountSnapshot = EverydayHubAccountSnapshot;

export type EverydayRuntimeSnapshot = {
  entityId: string;
  signerId: string;
  jurisdiction: string;
  primaryHubId: string | null;
  reserveUsdc: string;
  savingsUsdc: string;
  hubAccounts: EverydayHubAccountSnapshot[];
  friendAccounts: EverydayFriendAccountSnapshot[];
};

type ReactDebugWindow = Window & {
  __xln?: {
    adapter: () => RuntimeAdapter | null;
    env: () => RuntimeReplica | null;
    xln: () => Promise<XLNModule>;
    store: { getState: () => { activeEntityId: string | null; activeVaultId: string | null } };
  };
};

type SvelteDebugWindow = Window & {
  __xln?: {
    liveRuntimeSnapshot?: RuntimeReplica;
  };
};

const BOOT_TIMEOUT = 60_000;
const BANNED_EVERYDAY_COPY = ['Without collateral', 'Cover it', 'Confirmed frame #', 'Frame #'] as const;

export function everydayEntryUrl(wallet: WalletKind): string {
  if (wallet === 'svelte') {
    return process.env['SVELTE_E2E_BASE_URL'] ?? 'http://localhost:8081/app';
  }
  const raw = process.env['UI_E2E_BASE_URL'] ?? process.env['PW_BASE_URL'] ?? 'http://localhost:5183/';
  const normalized = raw.endsWith('/') ? raw : `${raw}/`;
  return new URL('./', normalized).href;
}

export function attachEverydayWatchers(page: Page): { errors: string[]; httpErrors: string[] } {
  const errors: string[] = [];
  const httpErrors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400) {
      httpErrors.push(`${response.status()} ${response.request().method()} ${new URL(response.url()).pathname}`);
    }
  });
  return { errors, httpErrors };
}

export function parseUsdText(text: string): number {
  const cleaned = text.replace(/,/g, '');
  const match = cleaned.match(/-?\d+(?:\.\d+)?/);
  if (!match) throw new Error(`USD_TEXT_UNPARSEABLE:${JSON.stringify(text)}`);
  return Number(match[0]);
}

export async function waitForEverydayShell(page: Page): Promise<void> {
  await expect(page.getByTestId('nav-cash').locator('visible=true').first()).toBeVisible({ timeout: BOOT_TIMEOUT });
  const contextEl = page.getByTestId('context-current').first();
  await expect(contextEl).toHaveAttribute('data-runtime-id', /^0x[0-9a-f]{40}$/i, { timeout: BOOT_TIMEOUT });
  await expect(contextEl).toHaveAttribute('data-entity-id', /^0x[0-9a-f]{64}$/i, { timeout: BOOT_TIMEOUT });
}

export async function openEverydayWallet(page: Page, wallet: WalletKind): Promise<EverydayIdentity> {
  await page.goto(everydayEntryUrl(wallet));
  const openLabel = wallet === 'react' ? 'Open a test wallet' : 'Open test wallet';
  await page.getByRole('button', { name: openLabel, exact: true }).click();
  await waitForEverydayShell(page);
  await expect
    .poll(
      async () => {
        const snap = await readEverydaySnapshot(page, wallet);
        const hub = snap.hubAccounts[0];
        return Boolean(hub && !hub.pending && hub.mempool === 0 && BigInt(hub.peerCreditLimit) > 0n);
      },
      { timeout: BOOT_TIMEOUT },
    )
    .toBe(true);
  return readEverydayIdentity(page, wallet);
}

export async function reopenEverydayWallet(page: Page, wallet: WalletKind): Promise<EverydayIdentity> {
  await page.reload();
  if (wallet === 'react') {
    const continueBtn = page.getByRole('button', { name: 'Continue', exact: true });
    const navCash = page.getByTestId('nav-cash').locator('visible=true');
    await continueBtn.or(navCash).first().waitFor({ state: 'visible', timeout: BOOT_TIMEOUT });
    if (await continueBtn.isVisible().catch(() => false)) {
      await continueBtn.click();
    }
  }
  await waitForEverydayShell(page);
  return readEverydayIdentity(page, wallet);
}

export async function readEverydayIdentity(page: Page, wallet: WalletKind): Promise<EverydayIdentity> {
  const contextEl = page.getByTestId('context-current').first();
  const runtimeId = await contextEl.getAttribute('data-runtime-id');
  const entityId = await contextEl.getAttribute('data-entity-id');
  if (!runtimeId || !entityId) throw new Error('EVERYDAY_CONTEXT_IDENTITY_MISSING');
  const snapshot = await readEverydaySnapshot(page, wallet);
  return {
    runtimeId,
    entityId,
    signerId: snapshot.signerId,
    jurisdiction: snapshot.jurisdiction,
    primaryHubId: snapshot.primaryHubId,
  };
}

export async function readEverydaySnapshot(page: Page, wallet: WalletKind): Promise<EverydayRuntimeSnapshot> {
  if (wallet === 'react') {
    return page.evaluate(async () => {
      const debug = (window as ReactDebugWindow).__xln;
      const adapter = debug?.adapter();
      if (!debug || !adapter) throw new Error('EVERYDAY_REACT_DIAGNOSTICS_UNAVAILABLE');
      const entityId = debug.store.getState().activeEntityId;
      if (!entityId) throw new Error('EVERYDAY_REACT_ENTITY_MISSING');
      const frame: RuntimeAdapterViewFrame = await adapter.read<RuntimeAdapterViewFrame>('view-frame', {
        entityId,
        accountsLimit: 100,
      });
      const active = frame.activeEntity;
      if (!active) throw new Error('EVERYDAY_REACT_ACTIVE_ENTITY_MISSING');
      const xln = await debug.xln();
      const hubSet = new Set(
        (frame.entities ?? []).filter(entry => entry.isHub === true).map(entry => entry.entityId.toLowerCase()),
      );
      const reserveUsdc = active.core.reserves?.get(1) ?? 0n;
      let savingsRaw = 0n;
      const hubAccounts: EverydayHubAccountSnapshot[] = [];
      const friendAccounts: EverydayFriendAccountSnapshot[] = [];
      for (const account of active.accounts.items) {
        const isLeft = account.state.leftEntity.toLowerCase() === entityId.toLowerCase();
        const peerId = (isLeft ? account.state.rightEntity : account.state.leftEntity).toLowerCase();
        for (const [tokenId, leftAmount] of account.lendingBalances ?? []) {
          if (tokenId === 1) savingsRaw += isLeft ? leftAmount : -leftAmount;
        }
        const delta = account.state.deltas.get(1);
        const derived = delta ? xln.deriveDelta(delta, isLeft) : null;
        const row: EverydayHubAccountSnapshot = {
          peerId,
          outCollateral: (derived?.outCollateral ?? 0n).toString(),
          outPeerCredit: (derived?.outPeerCredit ?? 0n).toString(),
          inOwnCredit: (derived?.inOwnCredit ?? 0n).toString(),
          ownCreditLimit: (derived?.ownCreditLimit ?? 0n).toString(),
          peerCreditLimit: (derived?.peerCreditLimit ?? 0n).toString(),
          pending: Boolean(account.pendingFrame),
          mempool: account.mempoolCount,
        };
        if (hubSet.has(peerId)) hubAccounts.push(row);
        else friendAccounts.push(row);
      }
      return {
        entityId,
        signerId: active.summary.signerId ?? active.core.signerId ?? '',
        jurisdiction: active.summary.jurisdiction?.name ?? active.core.config.jurisdiction?.name ?? 'Testnet',
        primaryHubId: hubAccounts[0]?.peerId ?? null,
        reserveUsdc: reserveUsdc.toString(),
        savingsUsdc: (savingsRaw > 0n ? savingsRaw : 0n).toString(),
        hubAccounts,
        friendAccounts,
      };
    });
  }

  const raw = await page.evaluate(() => {
    const runtime = (window as SvelteDebugWindow).__xln?.liveRuntimeSnapshot;
    const entityId = document.querySelector('[data-testid="context-current"]')?.getAttribute('data-entity-id');
    if (!runtime || !entityId) throw new Error('EVERYDAY_SVELTE_DIAGNOSTICS_UNAVAILABLE');
    const entity = [...runtime.state.eReplicas.values()].find(
      replica => replica.entityId.toLowerCase() === entityId.toLowerCase(),
    );
    if (!entity) throw new Error('EVERYDAY_SVELTE_ENTITY_MISSING');
    const hubIds = [...runtime.state.eReplicas.values()]
      .filter(replica => replica.state.profile?.isHub === true)
      .map(replica => replica.entityId.toLowerCase());
    const reserveUsdc = (entity.state.reserves.get(1) ?? 0n).toString();
    const accounts = [...entity.state.accounts.values()].map(account => ({
      leftEntity: account.state.leftEntity,
      rightEntity: account.state.rightEntity,
      delta: account.state.deltas.get(1) ?? null,
      disputeStartTimestamp: account.activeDispute?.disputeStartTimestamp,
      frameTimestamp: account.currentFrame.timestamp,
      lendingClaims: [...(account.state.subcontracts?.values() ?? [])].filter(
        (claim): claim is AccountLendingCovenant => 'kind' in claim && claim.tokenId === 1,
      ),
      pending: Boolean(account.pendingFrame),
      mempool: account.mempool.length,
    }));
    return {
      entityId,
      signerId: entity.signerId,
      jurisdiction: entity.state.config.jurisdiction?.name ?? 'Testnet',
      hubIds,
      reserveUsdc,
      accounts,
    };
  });

  const hubSet = new Set(raw.hubIds);
  if (hubSet.size === 0) {
    const response = await page.request.get(resolvePageApiUrl(page, '/api/hubs'));
    if (response.ok()) {
      const payload = (await response.json()) as { hubs?: Array<{ entityId?: string }> };
      for (const hub of payload.hubs ?? []) {
        if (hub.entityId) hubSet.add(hub.entityId.toLowerCase());
      }
    }
  }
  let savingsRaw = 0n;
  const hubAccounts: EverydayHubAccountSnapshot[] = [];
  const friendAccounts: EverydayFriendAccountSnapshot[] = [];
  for (const account of raw.accounts) {
    const isLeft = account.leftEntity.toLowerCase() === raw.entityId.toLowerCase();
    const peerId = (isLeft ? account.rightEntity : account.leftEntity).toLowerCase();
    const timestampMs =
      account.disputeStartTimestamp === undefined ? account.frameTimestamp : account.disputeStartTimestamp * 1_000;
    let lendingUsdc = 0n;
    for (const claim of account.lendingClaims) {
      const amount = lendingExitAmount(claim, timestampMs);
      lendingUsdc += claim.creditorIsLeft ? amount : -amount;
    }
    savingsRaw += isLeft ? lendingUsdc : -lendingUsdc;
    const derived = account.delta ? deriveDelta(account.delta, isLeft) : null;
    const row: EverydayHubAccountSnapshot = {
      peerId,
      outCollateral: (derived?.outCollateral ?? 0n).toString(),
      outPeerCredit: (derived?.outPeerCredit ?? 0n).toString(),
      inOwnCredit: (derived?.inOwnCredit ?? 0n).toString(),
      ownCreditLimit: (derived?.ownCreditLimit ?? 0n).toString(),
      peerCreditLimit: (derived?.peerCreditLimit ?? 0n).toString(),
      pending: account.pending,
      mempool: account.mempool,
    };
    if (hubSet.has(peerId)) hubAccounts.push(row);
    else friendAccounts.push(row);
  }
  return {
    entityId: raw.entityId,
    signerId: raw.signerId,
    jurisdiction: raw.jurisdiction,
    primaryHubId: hubAccounts[0]?.peerId ?? null,
    reserveUsdc: raw.reserveUsdc,
    savingsUsdc: (savingsRaw > 0n ? savingsRaw : 0n).toString(),
    hubAccounts,
    friendAccounts,
  };
}

export async function triggerFaucetApi(
  page: Page,
  kind: 'erc20' | 'gas' | 'reserve' | 'offchain',
  identity: EverydayIdentity,
  amount = '100',
): Promise<void> {
  let payload: Record<string, unknown>;
  switch (kind) {
    case 'erc20':
      payload = { userAddress: identity.signerId, tokenSymbol: 'USDC', amount, jurisdiction: identity.jurisdiction };
      break;
    case 'gas':
      payload = { userAddress: identity.signerId, jurisdiction: identity.jurisdiction };
      break;
    case 'reserve':
      payload = { userEntityId: identity.entityId, tokenId: 1, tokenSymbol: 'USDC', amount };
      break;
    case 'offchain':
      if (!identity.primaryHubId) throw new Error('EVERYDAY_HUB_ID_MISSING');
      payload = {
        userEntityId: identity.entityId,
        userRuntimeId: identity.runtimeId,
        hubEntityId: identity.primaryHubId,
        tokenId: 1,
        amount,
      };
      break;
  }
  const response = await page.request.post(resolvePageApiUrl(page, `/api/faucet/${kind}`), { data: payload });
  expect(response.ok(), `Faucet ${kind} failed: ${response.status()} ${await response.text()}`).toBe(true);
}

export async function readEverydayCashValue(page: Page): Promise<number> {
  const text = await page.getByTestId('everyday-cash').innerText();
  return parseUsdText(text);
}

export async function fundViaHomeFaucetAndSettle(page: Page, wallet: WalletKind): Promise<number> {
  await page.getByTestId('everyday-test-btn').click();
  await page.getByTestId('home-faucet').click();
  await page.getByTestId('nav-cash').locator('visible=true').first().click();
  await expect(page.getByTestId('everyday-arriving')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('everyday-arriving')).toHaveCount(0, { timeout: 45_000 });
  await expect
    .poll(async () => readEverydayCashValue(page), { timeout: 20_000 })
    .toBeGreaterThan(98);
  await expect
    .poll(
      async () => {
        const snap = await readEverydaySnapshot(page, wallet);
        return snap.hubAccounts.every(a => !a.pending && a.mempool === 0 && BigInt(a.outPeerCredit) === 0n);
      },
      { timeout: 20_000 },
    )
    .toBe(true);
  return readEverydayCashValue(page);
}

export async function assertEverydayPostureClean(page: Page): Promise<void> {
  expect(await page.evaluate(() => localStorage.getItem('xln-wallet-posture'))).not.toBe('pro');
  for (const nav of ['nav-cash', 'nav-friends', 'nav-savings', 'nav-activity', 'nav-settings']) {
    await expect(page.getByTestId(nav).locator('visible=true').first()).toBeVisible();
  }
  for (const proNav of ['nav-home', 'nav-manage', 'nav-move', 'nav-sovereignty']) {
    await expect(page.getByTestId(proNav)).toHaveCount(0);
  }
  await expect(page.locator('[data-testid*="bar"]:visible, .delta-bar:visible, .capacity-bar:visible')).toHaveCount(0);
  await expect(page.getByTestId('receive-spectrum')).toHaveCount(0);
  for (const banned of BANNED_EVERYDAY_COPY) {
    await expect(page.getByText(banned, { exact: false }).locator('visible=true')).toHaveCount(0);
  }
}

export async function assertTouchTargetsAccessible(
  page: Page,
  selectorGroups: readonly (readonly string[])[],
  iconOnlyTestIds: readonly string[] = [],
): Promise<void> {
  const iconSet = new Set(iconOnlyTestIds);
  const viewports = [
    { name: 'desktop', width: 1280, height: 860 },
    { name: 'mobile', width: 390, height: 844 },
  ] as const;
  for (const viewport of viewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    expect(overflow, `Horizontal overflow on ${viewport.name}`).toBe(false);
    for (const group of selectorGroups) {
      const boxes: Array<{ testId: string; x: number; y: number; width: number; height: number }> = [];
      for (const testId of group) {
        const locator = page.getByTestId(testId).locator('visible=true').first();
        if ((await locator.count()) === 0) continue;
        const box = await locator.boundingBox();
        if (!box) continue;
        expect(box.height, `${testId} height on ${viewport.name}`).toBeGreaterThanOrEqual(47.9);
        if (iconSet.has(testId)) {
          expect(box.width, `${testId} icon width on ${viewport.name}`).toBeGreaterThanOrEqual(47.9);
        }
        boxes.push({ testId, ...box });
      }
      const rows = [...boxes].sort((a, b) => a.y - b.y || a.x - b.x);
      for (let i = 0; i < rows.length; i++) {
        for (let j = i + 1; j < rows.length; j++) {
          const a = rows[i]!;
          const b = rows[j]!;
          if (Math.abs(a.y - b.y) < 12) {
            const left = a.x <= b.x ? a : b;
            const right = a.x <= b.x ? b : a;
            const gap = right.x - (left.x + left.width);
            expect(gap, `Horizontal gap ${left.testId} -> ${right.testId} on ${viewport.name}`).toBeGreaterThanOrEqual(
              7.5,
            );
          } else if (Math.abs(a.x - b.x) < 12) {
            const top = a.y <= b.y ? a : b;
            const bottom = a.y <= b.y ? b : a;
            const gap = bottom.y - (top.y + top.height);
            expect(gap, `Vertical gap ${top.testId} -> ${bottom.testId} on ${viewport.name}`).toBeGreaterThanOrEqual(
              7.5,
            );
          }
        }
      }
    }
  }
  await page.setViewportSize({ width: 1280, height: 860 });
}

export async function assertZeroDialogs(page: Page): Promise<void> {
  await expect(page.locator('[role="dialog"]:visible')).toHaveCount(0);
}
