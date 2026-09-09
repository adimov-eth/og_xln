import { expect, test } from '@playwright/test';
import { enterStack, LOCAL_PASSWORD } from './stack';

test(
  'a second copy of a wallet cannot replace its live connection or offer payments',
  { tag: '@functional' },
  async ({ page, browser }) => {
    test.setTimeout(60_000);
    const wallet = await enterStack(page);
    console.log('original wallet ready');
    const other = await browser.newContext({ baseURL: test.info().project.use.baseURL });
    try {
      const duplicate = await other.newPage();
      await duplicate.goto('/');
      await duplicate.getByRole('button', { name: /Restore a wallet/ }).click();
      await duplicate.locator('textarea').fill(wallet.phrase);
      await duplicate.locator('button[type="submit"]').click();
      await duplicate.getByLabel('Password', { exact: true }).fill(LOCAL_PASSWORD);
      await duplicate.getByLabel('Confirm password', { exact: true }).fill(LOCAL_PASSWORD);
      await duplicate.getByRole('button', { name: 'Save and open', exact: true }).click();
      await expect
        .poll(
          () =>
            duplicate.evaluate(() => {
              const debug = (
                window as Window & { __xln?: { env: () => { infrastructure?: { halted?: boolean } } | null } }
              ).__xln;
              return debug?.env()?.infrastructure?.halted;
            }),
          { timeout: 25_000 },
        )
        .toBe(true);
      console.log('duplicate halted');
      for (const [name, target] of [
        ['original', page],
        ['duplicate', duplicate],
      ] as const) {
        console.log(
          name,
          await target.evaluate(() => {
            const debug = (
              window as Window & {
                __xln?: {
                  env: () => { infrastructure?: { halted?: boolean; fatalDebugPayload?: { message?: string } } } | null;
                };
              }
            ).__xln;
            const state = debug?.env()?.infrastructure;
            return { halted: state?.halted, error: state?.fatalDebugPayload?.message };
          }),
        );
      }
      await expect(duplicate.locator('[data-testid=home-faucet]:enabled')).toHaveCount(0);
      await expect(duplicate.getByText('Ready to send', { exact: true })).toHaveCount(0);
      await expect(duplicate.getByText(/This wallet is already open elsewhere/)).toBeVisible({ timeout: 5000 });
      // The first writer must still process money: rejecting the duplicate must
      // not close its authenticated session or disturb its Account FIFO.
      await expect(page.getByTestId('home-faucet')).toBeEnabled({ timeout: 2000 });
      await page.getByTestId('home-faucet').click();
      await expect(page.getByTestId('test-money-status')).toContainText('100 USDC received', { timeout: 15_000 });
      await expect(page.getByTestId('token-net-USDC')).toContainText('100');
    } finally {
      await other.close();
    }
  },
);
