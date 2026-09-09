import { expect, test } from '@playwright/test';
import { enterStack } from './stack';

test('committed refreshes keep the wallet and empty activity mounted', { tag: '@functional' }, async ({ page }) => {
  test.setTimeout(50_000);
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await enterStack(page);
  await expect(page.getByTestId('home-total')).toBeVisible();
  await expect(
    page
      .getByRole('button', { name: 'View earlier activity', exact: true })
      .or(page.getByText('Your payments and swaps will appear here.', { exact: true })),
  ).toBeVisible();
  const samples = await page.evaluate(async () => {
    const states: string[] = [];
    const runtime = (window as typeof window & { __xln?: { adapter: () => { currentHeight: number } | null } }).__xln;
    if (!runtime?.adapter()) throw new Error('Runtime diagnostics unavailable');
    const firstHeight = runtime.adapter()!.currentHeight;
    const read = () => {
      const accounts = document.querySelector('[data-testid="home-accounts"]');
      const activity = document.querySelector('[aria-label="Recent activity"]');
      states.push(
        JSON.stringify({
          total: document.querySelector('[data-testid="home-total"]')?.textContent,
          accounts: accounts?.textContent,
          activity: activity?.textContent,
        }),
      );
    };
    const observer = new MutationObserver(read);
    observer.observe(document.querySelector('main')!, { subtree: true, childList: true, characterData: true });
    read();
    await new Promise(resolve => setTimeout(resolve, 3_000));
    observer.disconnect();
    return {
      samples: states.length,
      firstHeight,
      lastHeight: runtime.adapter()!.currentHeight,
      states: [...new Set(states)],
    };
  });
  console.log(`WALLET_STATE_OBSERVATION ${JSON.stringify(samples)}`);
  expect(samples.lastHeight).toBeGreaterThan(samples.firstHeight);
  expect(samples.states).toHaveLength(1);
  expect(errors).toEqual([]);
});
