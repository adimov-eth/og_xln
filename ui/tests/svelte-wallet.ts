import { expect, type Page } from '@playwright/test';
import type { RuntimeReplica } from '../../core/runtime/types';
import { deriveDelta } from '../../core/account/utils';
import { gotoProWallet } from './wallet-ui';

export async function accountMoney(page: Page) {
  const owner = await page.getByTestId('context-current').getAttribute('data-entity-id');
  if (!owner) throw new Error('SVELTE_OWNER_MISSING');
  const data = await page.evaluate(entityId => {
    const env = (window as unknown as { __xln: { liveRuntimeSnapshot: RuntimeReplica } }).__xln.liveRuntimeSnapshot;
    const entity = [...env.state.eReplicas.values()].find(item => item.entityId === entityId);
    const entry = entity && [...entity.state.accounts.entries()][0];
    if (!entry) throw new Error('SVELTE_ACCOUNT_MISSING');
    const [hubId, account] = entry;
    const delta = account.state.deltas.get(1);
    if (!delta) throw new Error('SVELTE_USDC_MISSING');
    return { ownerId: entityId, hubId, tokenId: 1, delta, isLeft: account.state.leftEntity === entityId, pending: Boolean(account.pendingFrame) };
  }, owner);
  const balance = deriveDelta(data.delta, data.isLeft);
  return { ...data, owned: balance.outCollateral + balance.outPeerCredit - balance.inOwnCredit };
}

export async function openSvelteWallet(page: Page) {
  await gotoProWallet(page, process.env['SVELTE_E2E_BASE_URL'] ?? 'http://localhost:8081/app');
  await page.getByRole('button', { name: 'Open test wallet', exact: true }).click();
  await expect(page.getByTestId('context-current')).toBeVisible({ timeout: 60_000 });
  await page.getByRole('button', { name: 'Accounts', exact: true }).click();
  await page.getByTestId('hub-discovery-card').filter({ hasText: 'H1' }).getByTestId('hub-connect-button').click();
  await expect(page.getByTestId('account-preview').first()).toBeVisible();
  await expect
    .poll(async () => {
      const owner = await page.getByTestId('context-current').getAttribute('data-entity-id');
      if (!owner) return false;
      return page.evaluate(entityId => {
        const env = (window as unknown as { __xln: { liveRuntimeSnapshot: RuntimeReplica } }).__xln.liveRuntimeSnapshot;
        const entity = [...env.state.eReplicas.values()].find(item => item.entityId === entityId);
        const entry = entity && [...entity.state.accounts.entries()][0];
        if (!entry) return false;
        const [, account] = entry;
        return Boolean(account.state.deltas.get(1)) && !account.pendingFrame;
      }, owner);
    }, { timeout: 15_000 })
    .toBe(true);
}
