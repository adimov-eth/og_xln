import { expect, test, type Browser, type Page } from '@playwright/test';
import { Wallet } from 'ethers';

const APP = process.env['SVELTE_E2E_BASE_URL'] ?? 'http://localhost:8081/app';
const PASSWORD = 'duplicate-session-password';
const OPEN_ELSEWHERE = 'This wallet is already open elsewhere. Close the other wallet before reopening here.';
const WAIT = { timeout: 60_000 };

async function enterSeed(page: Page, phrase: string): Promise<void> {
  await page.goto(APP);
  await page.getByRole('button', { name: 'Create or restore a personal wallet', exact: true }).click();
  await page.getByRole('tab', { name: 'Mnemonic', exact: true }).click();
  await page.getByLabel('Seed phrase').fill(phrase);
  await page.getByRole('button', { name: 'Continue with seed', exact: true }).click();
}

async function savePassword(page: Page): Promise<void> {
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD);
  await page.getByLabel('Confirm password', { exact: true }).fill(PASSWORD);
  await page.getByRole('button', { name: 'Save and open', exact: true }).click();
}

/** A new wallet, onboarded. With backup it stores encrypted Runtime backups at the official tower; without, it stays local. */
async function openOriginal(page: Page, phrase: string, backup: boolean): Promise<void> {
  await enterSeed(page, phrase);
  await savePassword(page);
  await page.locator('summary').filter({ hasText: 'Jurisdictions, initial hub and recovery services' }).click(WAIT);
  await page.getByRole('button', { name: backup ? /^Backup \+ disputer/ : /^Local only/ }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click(WAIT);
  await expect(page.getByTestId('everyday-shell')).toBeVisible(WAIT);
}

async function addTestCash(page: Page, cash: RegExp): Promise<void> {
  await page.getByTestId('everyday-test-btn').click();
  await expect(page.getByTestId('home-faucet')).toBeEnabled({ timeout: 30_000 });
  await page.getByTestId('home-faucet').click();
  await expect(page.getByRole('status').filter({ hasText: 'Sent $100.00 test cash' })).toBeVisible(WAIT);
  await page.getByTestId('nav-cash').click();
  await expect(page.getByTestId('everyday-cash')).toHaveText(cash, WAIT);
}

async function withTwoBrowsers(browser: Browser, run: (original: Page, duplicate: Page) => Promise<void>): Promise<void> {
  const originalContext = await browser.newContext();
  const duplicateContext = await browser.newContext();
  try {
    await run(await originalContext.newPage(), await duplicateContext.newPage());
  } finally {
    await originalContext.close();
    await duplicateContext.close();
  }
}

test(
  'a restored second Svelte copy says it is open elsewhere, offers no payments, and leaves the original working',
  { tag: '@functional' },
  async ({ browser }) => {
    test.setTimeout(420_000);
    const phrase = Wallet.createRandom().mnemonic!.phrase;
    await withTwoBrowsers(browser, async (original, duplicate) => {
      await openOriginal(original, phrase, true);
      await addTestCash(original, /^\$99\.\d\d$/);

      // The second device finds the tower backup and restores the same Runtime.
      const restore = duplicate.getByRole('button', { name: 'Restore selected backup', exact: true });
      await expect(async () => {
        await enterSeed(duplicate, phrase);
        await expect(duplicate.getByLabel('Password', { exact: true }).or(restore).first()).toBeVisible(WAIT);
        await expect(restore).toBeVisible({ timeout: 1_000 });
      }).toPass({ timeout: 180_000, intervals: [5_000] });
      await restore.click();
      await savePassword(duplicate);
      await expect(duplicate.getByTestId('everyday-shell')).toBeVisible(WAIT);

      // The relay keeps the first writer. The copy halts and must say why, not
      // promise that sending resumes or show a raw halt code.
      await expect(duplicate.getByTestId('everyday-halted')).toHaveText(OPEN_ELSEWHERE, WAIT);
      await expect(duplicate.getByText(/Sending resumes in a moment/)).toHaveCount(0);
      await expect(duplicate.getByText(/HALTED_REQUIRES_OPERATOR/)).toHaveCount(0);
      await duplicate.getByTestId('everyday-test-btn').click();
      await expect(duplicate.getByTestId('home-faucet')).toBeDisabled();
      await expect(duplicate.locator('[data-testid=home-faucet]:enabled')).toHaveCount(0);

      // Rejecting the copy must not close the original's session or disturb its Account FIFO.
      await expect(original.getByText(OPEN_ELSEWHERE, { exact: true })).toHaveCount(0);
      await addTestCash(original, /^\$199\.\d\d$/);
    });
  },
);

test(
  'a second Svelte copy without a backup says it is open elsewhere and cannot start',
  { tag: '@functional' },
  async ({ browser }) => {
    test.setTimeout(360_000);
    const phrase = Wallet.createRandom().mnemonic!.phrase;
    await withTwoBrowsers(browser, async (original, duplicate) => {
      await openOriginal(original, phrase, false);

      // No backup exists, so the copy creates the same Runtime and the relay rejects it,
      // either while the wallet is being created or on the setup screen.
      await enterSeed(duplicate, phrase);
      await savePassword(duplicate);
      await expect(duplicate.getByText(OPEN_ELSEWHERE, { exact: true })).toBeVisible(WAIT);
      const start = duplicate.getByRole('button', { name: 'Start', exact: true });
      if (await start.isVisible()) await expect(start).toBeDisabled();
      await expect(duplicate.getByText(/HALTED_REQUIRES_OPERATOR|LOCAL_RUNTIME_INPUT_COMMIT_TIMEOUT/)).toHaveCount(0);
      await expect(original.getByText(OPEN_ELSEWHERE, { exact: true })).toHaveCount(0);
    });
  },
);
