import { expect, test } from '@playwright/test';
import { enterStack, readWalletCheckpoint, reopenStack } from './stack';

test(
  'same wallet restores its original Runtime and Account heads after reload without funding',
  { tag: '@functional' },
  async ({ page }) => {
    test.setTimeout(60_000);
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => {
      if (message.type() === 'error') console.log(`BROWSER_ERROR: ${message.text()}`);
    });
    const wallet = await enterStack(page);
    await expect
      .poll(
        async () => {
          const value = await readWalletCheckpoint(page);
          return (
            value.latestHeight >= 2 &&
            value.accounts.length > 0 &&
            value.accounts.every(account => !account.pending && account.mempool === 0)
          );
        },
        { timeout: 15_000 },
      )
      .toBe(true);
    const before = await readWalletCheckpoint(page);
    const rendered = await page.getByTestId('home-total').innerText();
    console.log(
      `RECOVERY_BEFORE runtime=${before.runtimeId} entity=${before.entityId} height=${before.frame.height} root=${before.frame.postStateHash}`,
    );
    await page.reload({ waitUntil: 'domcontentloaded' });
    await reopenStack(page, wallet);
    const restored = await readWalletCheckpoint(page, before.frame.height);
    expect(restored.latestHeight).toBeGreaterThanOrEqual(before.latestHeight);
    expect(restored.frame).toEqual(before.frame);
    expect(restored.accounts).toEqual(before.accounts);
    const current = await readWalletCheckpoint(page);
    expect(
      current.accounts.map(account => ({
        leftEntity: account.leftEntity,
        rightEntity: account.rightEntity,
        balances: account.balances,
      })),
    ).toEqual(
      before.accounts.map(account => ({
        leftEntity: account.leftEntity,
        rightEntity: account.rightEntity,
        balances: account.balances,
      })),
    );
    await expect(page.getByTestId('home-total')).toHaveText(rendered);
    expect(errors).toEqual([]);
    console.log(
      `RECOVERY_RESTORED runtime=${restored.runtimeId} entity=${restored.entityId} originalHeight=${restored.frame.height} currentHeight=${restored.latestHeight}`,
    );
  },
);
