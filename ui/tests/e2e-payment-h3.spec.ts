import { expect, test } from '@playwright/test';
import type { RuntimeReplica } from '../../core/api/public/runtime-module';
import { enterStack } from './stack';

test('a funded wallet pays H3 twice without leaving held funds', { tag: '@functional' }, async ({ page }) => {
  test.setTimeout(150_000);
  page.setDefaultTimeout(10_000);
  page.on('console', message => {
    if (message.type() === 'error' || message.type() === 'warning') console.log(message.text());
  });
  await enterStack(page);
  await page.getByTestId('home-faucet').click();
  await expect(page.getByTestId('test-money-status')).toContainText('100 USDC received', { timeout: 20_000 });
  console.log(
    'BEFORE',
    await page.evaluate(() => {
      const env = (window as Window & { __xln?: { env(): RuntimeReplica | null } }).__xln?.env();
      return [...(env?.state.eReplicas.values() ?? [])].map(r => ({
        entity: r.entityId,
        finalized: r.state.lastFinalizedJHeight,
        scanned: r.jHistory?.scannedThroughHeight,
      }));
    }),
  );
  for (let i = 0; i < 2; i++) {
    if (i === 1) {
      console.log('IDLE: waiting 90 seconds before the repeat payment');
      await page.waitForTimeout(90_000);
    }
    await page.getByTestId('home-pay').click();
    await page.getByTestId('pay-to').fill('H');
    console.log('recipient suggestions', await page.locator('.picker-option').allTextContents());
    await page.locator('[data-testid^=pay-suggestion-H3]').first().click();
    await page.getByTestId('pay-amount').fill('25');
    await expect(page.getByTestId('pay-submit')).toBeEnabled();
    await page.getByTestId('pay-submit').click();
    await expect(page.getByTestId('receipt-kicker')).toHaveText('Paid', { timeout: 15_000 });
    await page.getByTestId('receipt-done').click();
    await page.getByTestId('nav-home').locator('visible=true').first().click();
    await expect(page.getByTestId('home-balance-asset')).toHaveValue('1');
    await expect(page.getByTestId('home-total')).toHaveText(i === 0 ? '75' : '50');
  }
  await expect
    .poll(() =>
      page.evaluate(() => {
        const env = (window as Window & { __xln?: { env(): RuntimeReplica | null } }).__xln?.env();
        if (!env) throw new Error('Test wallet runtime is unavailable');
        return [...env.state.eReplicas.values()].reduce(
          (total, replica) =>
            total +
            [...replica.state.accounts.values()].reduce((count, account) => count + account.state.locks.size, 0),
          0,
        );
      }),
    )
    .toBe(0);
});
