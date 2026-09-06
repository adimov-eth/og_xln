import { expect, type Page } from '@playwright/test';
import { HDNodeWallet } from 'ethers';

export const BOOT_TIMEOUT = 180_000;

/** Enter the wallet on the running stack with a fresh phrase; the account with the stack hub must exist on our side. */
export async function enterStack(page: Page): Promise<void> {
	await page.goto('/');
	const stack = page.getByTestId('gate-stack');
	await expect(stack).toHaveAttribute('data-state', 'online', { timeout: 20_000 });
	await page.getByRole('button', { name: /Import a phrase/ }).click();
	const phrase = HDNodeWallet.createRandom().mnemonic?.phrase ?? '';
	await page.locator('textarea').fill(phrase);
	await page.locator('button[type="submit"]').click();
	await expect(page.getByTestId('home-total')).toBeVisible({ timeout: BOOT_TIMEOUT });
	await expect(page.getByTestId('account-row').first()).toBeVisible({ timeout: 90_000 });
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
