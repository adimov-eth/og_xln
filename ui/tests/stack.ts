import { expect, type Page } from '@playwright/test';
import { HDNodeWallet } from 'ethers';
import type { RuntimeAdapterViewFrame } from '../../core/api/public/runtime-module';
import type { StorageHead } from '../../core/storage/types';
import type { RuntimeAdapter } from '../../core/api/runtime-adapter/types';
import type { RuntimeAdapterFrameSummary } from '../../core/api/runtime-adapter/resolve';

export const BOOT_TIMEOUT = 180_000;

type DebugWindow = Window & {
  __xln?: {
    adapter: () => RuntimeAdapter | null;
    store: { getState: () => { activeEntityId: string | null; activeVaultId: string | null } };
  };
};

export type StackWallet = Readonly<{ phrase: string; runtimeId: string; entityId: string; vaultId: string }>;

/** Import through the public wallet UI, including production builds without diagnostics. */
export async function importStackPhraseUi(page: Page, phrase: string): Promise<void> {
  await expect(page.getByTestId('gate-stack')).toHaveAttribute('data-state', 'online', { timeout: 20_000 });
  await page.getByRole('button', { name: /Import a phrase/ }).click();
  await page.locator('textarea').fill(phrase);
  await page.locator('button[type="submit"]').click();
  // Surface the first recovery invariant immediately instead of timing out on Home.
  await expect(page.locator('[data-testid="nav-home"]:visible, .gate-error').first()).toBeVisible({ timeout: BOOT_TIMEOUT });
  const errors = await page.locator('.gate-error').allTextContents();
  if (errors.length > 0) throw new Error(`WALLET_BOOT_FAILED:${errors.join('\n')}`);
}

async function importStackPhrase(page: Page, phrase: string): Promise<Omit<StackWallet, 'phrase'>> {
  await importStackPhraseUi(page, phrase);
  return page.evaluate(() => {
    const debug = (window as DebugWindow).__xln;
    if (!debug) throw new Error('Wallet diagnostics unavailable');
    const adapter = debug.adapter();
    const { activeEntityId: entityId, activeVaultId: vaultId } = debug.store.getState();
    if (!adapter || !entityId || !vaultId) throw new Error('Wallet identity unavailable');
    return { runtimeId: adapter.runtimeId, entityId, vaultId };
  });
}

/** Enter the wallet on the running stack with a fresh phrase; the account with the stack hub must exist on our side. */
export async function enterStack(page: Page, providedPhrase?: string): Promise<StackWallet> {
  await page.goto('/');
  const phrase = providedPhrase ?? HDNodeWallet.createRandom().mnemonic?.phrase;
  if (!phrase) throw new Error('TEST_WALLET_MNEMONIC_MISSING');
  const identity = await importStackPhrase(page, phrase);
  await expect(page.getByTestId('account-row').first()).toBeVisible({ timeout: 90_000 });
  return { phrase, ...identity };
}

/** Unlock the same durable wallet after reload; never generate a replacement phrase or clear storage. */
export async function reopenStack(page: Page, wallet: StackWallet): Promise<void> {
  const identity = await importStackPhrase(page, wallet.phrase);
  expect(identity).toEqual({ runtimeId: wallet.runtimeId, entityId: wallet.entityId, vaultId: wallet.vaultId });
  await page.getByTestId('nav-home').locator('visible=true').first().click();
  await expect(page.getByTestId('home-total')).toBeVisible();
}

/** Read committed heads and exact integer balances through the wallet's existing adapter. */
export async function readWalletCheckpoint(page: Page, atHeight?: number) {
  return page.evaluate(async requestedHeight => {
    const debug = (window as DebugWindow).__xln;
    if (!debug) throw new Error('Wallet diagnostics unavailable');
    const adapter = debug.adapter();
    const { activeEntityId: entityId, activeVaultId: vaultId } = debug.store.getState();
    if (!adapter || !entityId || !vaultId) throw new Error('Wallet identity unavailable');
    const head = await adapter.read<StorageHead>('head');
    const height = requestedHeight ?? head.latestHeight;
    const frame = await adapter.read<RuntimeAdapterFrameSummary>(`frame/${height}`);
    const accounts = await adapter.read<{ items: NonNullable<RuntimeAdapterViewFrame['activeEntity']>['accounts']['items']; nextCursor: string | null }>(
      `entity/${entityId}/accounts`,
      { atHeight: height, accountsLimit: 100 },
    );
    if (accounts.nextCursor !== null) throw new Error('Recovery fixture exceeds one Account page');
    return {
      runtimeId: adapter.runtimeId,
      entityId,
      vaultId,
      latestHeight: head.latestHeight,
      frame: { height: frame.height, frameHash: frame.frameHash, postStateHash: frame.postStateHash },
      accounts: accounts.items
        .map(account => ({
          leftEntity: account.state.leftEntity,
          rightEntity: account.state.rightEntity,
          height: account.currentHeight,
          root: account.currentFrame.accountStateRoot,
          pending: Boolean(account.pendingFrame),
          mempool: account.mempoolCount,
          balances: Array.from(account.state.deltas, ([tokenId, delta]) => ({
            tokenId,
            collateral: delta.collateral.toString(),
            ondelta: delta.ondelta.toString(),
            offdelta: delta.offdelta.toString(),
            leftCreditLimit: delta.leftCreditLimit.toString(),
            rightCreditLimit: delta.rightCreditLimit.toString(),
          })).sort((left, right) => left.tokenId - right.tokenId),
        }))
        .sort((left, right) =>
          `${left.leftEntity}/${left.rightEntity}`.localeCompare(`${right.leftEntity}/${right.rightEntity}`),
        ),
    };
  }, atHeight);
}

/** Ask the stack hub to pay `amount` USDC over credit (the network faucet); Home then shows the USDC lane. */
export async function fundFromHub(page: Page, amount = '100'): Promise<void> {
  await page.getByTestId('nav-manage').locator('visible=true').first().click();
  await page.getByTestId('manage-assets').click();
  await page.getByTestId('faucet-amount').fill(amount);
  const spectrum = page.getByTestId('receive-spectrum');
  if (await spectrum.isVisible()) {
    await page.getByRole('button', { name: '0% collateral', exact: true }).click();
    await page.getByTestId('receive-spectrum-confirm').click();
    await expect(spectrum).toHaveCount(0, { timeout: 15_000 });
  }
  await expect(page.getByTestId('faucet-offchain')).toBeEnabled();
  await page.getByTestId('faucet-offchain').click();
  await page.getByTestId('nav-home').locator('visible=true').first().click();
  await expect(page.getByTestId('token-net-USDC')).toBeVisible({ timeout: 90_000 });
}
