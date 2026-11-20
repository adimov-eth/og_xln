import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import type { RuntimeReplica } from '../../core/runtime/types';
import { gotoProWallet } from './wallet-ui';

// A localhost testnet reset rebuilds the wallet. A rebuild that skips a signer's network, or is
// interrupted partway, must be finished on the next open, never left as "Strict restore failed".
const APP = process.env['SVELTE_E2E_BASE_URL'] ?? 'http://localhost:8081/app';
const STRICT_FAILURE = /Strict restore failed/;
const REBUILD_MARKER = 'xln-retired-testnet-rebootstrap';

type VaultSigner = { jurisdiction?: string; entityId?: string };

const vaultSigners = (page: Page): Promise<VaultSigner[]> => page.evaluate(() => {
  const vaults = JSON.parse(localStorage.getItem('xln-vaults') || '{}') as { runtimes?: Record<string, { signers?: VaultSigner[] }> };
  return Object.values(vaults.runtimes ?? {})[0]?.signers ?? [];
});

async function openTwoSignerWallet(context: BrowserContext): Promise<Page> {
  const page = await context.newPage();
  await gotoProWallet(page, APP);
  await page.getByRole('button', { name: 'Open test wallet', exact: true }).click();
  await expect.poll(async () => (await vaultSigners(page)).filter(signer => signer.entityId).length, { timeout: 90_000 })
    .toBeGreaterThanOrEqual(2);
  await expect(page.getByTestId('context-current')).toBeVisible({ timeout: 60_000 });
  return page;
}

/** Force the disposable-testnet reset on the next load. */
const retireNetworkVersion = (page: Page): Promise<void> =>
  page.evaluate(() => localStorage.setItem('xln-deploy-version', 'v1-retired-by-test'));

async function expectEverySignerRestored(context: BrowserContext): Promise<void> {
  const page = await context.newPage();
  await gotoProWallet(page, APP);
  await expect(page.getByTestId('context-current')).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText(STRICT_FAILURE)).toHaveCount(0);
  const signers = await vaultSigners(page);
  await expect.poll(() => page.evaluate((entityIds: string[]) => {
    const env = (window as unknown as { __xln: { liveRuntimeSnapshot: RuntimeReplica } }).__xln.liveRuntimeSnapshot;
    const present = new Set([...env.state.eReplicas.values()].map(replica => String(replica.entityId).toLowerCase()));
    return entityIds.every(entityId => present.has(entityId.toLowerCase()));
  }, signers.map(signer => String(signer.entityId))), { timeout: 60_000 }).toBe(true);
  // The rebuild is finished only when the marker that relaxes the strict check is gone.
  await expect.poll(() => page.evaluate(key => localStorage.getItem(key), REBUILD_MARKER), { timeout: 60_000 }).toBeNull();
}

test('a rebuild that ran while a secondary network was missing finishes on the next open', { tag: '@resilience' }, async ({ browser }) => {
  test.setTimeout(240_000);
  const context = await browser.newContext();
  const page = await openTwoSignerWallet(context);
  await context.route(/\/api\/jurisdictions/, async route => {
    const response = await route.fetch();
    const payload = await response.json() as { jurisdictions: Record<string, unknown> };
    const [primary] = Object.keys(payload.jurisdictions);
    if (!primary) throw new Error('E2E_PRIMARY_JURISDICTION_MISSING');
    await route.fulfill({ response, json: { ...payload, jurisdictions: { [primary]: payload.jurisdictions[primary] } } });
  });
  await retireNetworkVersion(page);
  await page.reload();
  await expect(page.getByTestId('context-current')).toBeVisible({ timeout: 90_000 });
  await page.close();
  await context.unroute(/\/api\/jurisdictions/);
  await expectEverySignerRestored(context);
  await context.close();
});

for (const closeAfterMs of [1_500, 4_000, 8_000]) {
  test(`a rebuild closed ${closeAfterMs}ms in finishes on the next open`, { tag: '@resilience' }, async ({ browser }) => {
    test.setTimeout(240_000);
    const context = await browser.newContext();
    const page = await openTwoSignerWallet(context);
    await retireNetworkVersion(page);
    await page.reload();
    await page.waitForTimeout(closeAfterMs);
    const midRebuild = await page.evaluate(key => localStorage.getItem(key) !== null, REBUILD_MARKER).catch(() => false);
    test.info().annotations.push({ type: 'closed', description: midRebuild ? 'mid-rebuild' : 'after the rebuild finished' });
    await page.close({ runBeforeUnload: false });
    await expectEverySignerRestored(context);
    await context.close();
  });
}
