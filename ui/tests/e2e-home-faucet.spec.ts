import { expect, test } from '@playwright/test';
import { enterStack, readWalletCheckpoint, reopenStack } from './stack';

test(
  'one Home click receives 100 USDC without leaving Home; funds survive reload',
  { tag: '@functional' },
  async ({ page }) => {
    test.setTimeout(60_000);
    const wallet = await enterStack(page);
    // Observe idle persistence on the real two-chain stand before the economic action.
    await page.waitForTimeout(2_000);
    const idleBefore = await readWalletCheckpoint(page);
    await page.waitForTimeout(8_000);
    const idleAfter = await readWalletCheckpoint(page);
    const idleFrames = idleAfter.latestHeight - idleBefore.latestHeight;
    console.log(`IDLE: ${idleFrames} Runtime frames / 8 seconds`);
    expect(idleFrames, 'at most one periodic scan checkpoint per chain, not one per poll').toBeLessThanOrEqual(2);
    expect(idleAfter.accounts.map(a => a.balances)).toEqual(idleBefore.accounts.map(a => a.balances));
    await page.getByTestId('home-faucet').click();
    await expect(page.getByTestId('test-money-status')).toContainText('100 USDC received', { timeout: 30_000 });
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByTestId('token-net-USDC')).toContainText('100');
    await expect(page.getByText('liveness', { exact: true })).toHaveCount(0);
    await expect(page.getByText('proposeAccountsNow', { exact: true })).toHaveCount(0);
    const funded = await readWalletCheckpoint(page);
    await page.screenshot({ path: 'tests/test-results/home-funded.png', fullPage: true });
    await page.reload();
    await reopenStack(page, wallet);
    await expect(page.getByTestId('token-net-USDC')).toContainText('100');
    const restored = await readWalletCheckpoint(page);
    expect(restored.accounts.map(a => a.balances)).toEqual(funded.accounts.map(a => a.balances));
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: 'tests/test-results/home-mobile.png', fullPage: true });
  },
);
