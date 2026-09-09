import { expect, test } from '@playwright/test';
import { enterStack } from './stack';

test('faucet commits update the balance without remounting wallet sections', { tag: '@functional' }, async ({ page }) => {
  test.setTimeout(50_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await enterStack(page);
  await expect(page.getByTestId('home-total')).toBeVisible();
  await expect(page.getByRole('region', { name: 'Recent activity', exact: true })).toBeVisible();
  await expect(page.getByTestId('home-accounts')).toBeVisible();
  await expect(page.getByTestId('home-faucet')).toBeEnabled();
  const observation = page.evaluate(async () => {
    const states: string[] = [];
    const runtime = (window as typeof window & { __xln?: { adapter: () => { currentHeight: number } | null } }).__xln;
    if (!runtime?.adapter()) throw new Error('Runtime diagnostics unavailable');
    const firstHeight = runtime.adapter()!.currentHeight;
    const accounts = document.querySelector('[data-testid="home-accounts"]');
    const activity = document.querySelector('[aria-label="Recent activity"]');
    const total = document.querySelector('[data-testid="home-total"]');
    if (!accounts || !activity || !total) throw new Error('Wallet sections unavailable');
    const retained = [accounts, activity, total, ...accounts.querySelectorAll('[data-testid="account-row"]')];
    const removed: string[] = [];
    const read = () => {
      states.push(
        JSON.stringify({
          total: document.querySelector('[data-testid="home-total"]')?.textContent,
          accountsMounted: accounts.isConnected,
          activityMounted: activity.isConnected,
        }),
      );
    };
    const observer = new MutationObserver(records => {
      for (const record of records) for (const node of record.removedNodes) {
        for (const retainedNode of retained) if (node === retainedNode || node.contains(retainedNode)) {
          removed.push(retainedNode.getAttribute('data-testid') ?? 'Recent activity');
        }
      }
      read();
    });
    observer.observe(document.querySelector('main')!, { subtree: true, childList: true, characterData: true });
    read();
    await new Promise(resolve => setTimeout(resolve, 5_000));
    observer.disconnect();
    return {
      samples: states.length,
      firstHeight,
      lastHeight: runtime.adapter()!.currentHeight,
      states: [...new Set(states)],
      removed,
    };
  });
  await page.getByTestId('home-faucet').click();
  await expect(page.getByTestId('home-total')).toHaveText('$100.00', { timeout: 15_000 });
  await expect(page.getByTestId('test-money-status')).toContainText('100 USDC received');
  await expect(page.getByTestId('token-net-USDC')).toHaveText('100.00');
  const samples = await observation;
  console.log(`WALLET_STATE_OBSERVATION ${JSON.stringify(samples)}`);
  expect(samples.lastHeight).toBeGreaterThan(samples.firstHeight);
  expect(samples.removed).toEqual([]);
  for (const state of samples.states) {
    const value = JSON.parse(state);
    expect(value).toMatchObject({ accountsMounted: true, activityMounted: true });
    expect(['$0.00', '$100.00']).toContain(value.total);
  }
  expect(JSON.parse(samples.states.at(-1)!)).toMatchObject({ total: '$100.00' });
  expect(errors).toEqual([]);
});
