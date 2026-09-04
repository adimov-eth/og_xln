/**
 * E2E swap coverage for the wallet UI: the hub's book is open by default, a
 * level fills the ticket, and taking it commits a swap on the bilateral
 * account. The sandbox merchant makes a two-sided WETH/USDC market on boot.
 */
import { expect, test, type Page } from '@playwright/test';
import { enterStack } from './stack';

const BOOT_TIMEOUT = 180_000;
const CONSENSUS_TIMEOUT = 60_000;


test.describe('wallet UI swap', () => {
	test('shows the hub book, fills the ticket from a level and takes it', { tag: '@functional' }, async ({ page }) => {
		const pageErrors: string[] = [];
		page.on('pageerror', error => pageErrors.push(error.message));

		await enterStack(page);
		await page.getByTestId('home-swap').click();

		// The book renders once for phones and once for the desktop aside; take the one on screen.
		const book = page.getByTestId('orderbook').locator('visible=true').first();
		await expect(book).toBeVisible({ timeout: CONSENSUS_TIMEOUT });
		await expect(book).toHaveAttribute('data-status', 'live', { timeout: CONSENSUS_TIMEOUT });
		const asks = book.locator('.bk-row.ask');
		const bids = book.locator('.bk-row.bid');
		await expect(asks).toHaveCount(3, { timeout: CONSENSUS_TIMEOUT });
		await expect(bids).toHaveCount(3);

		// Asks render best price last (nearest the spread); the best ask is 2,510 USDC per WETH.
		const bestAsk = asks.last();
		await expect(bestAsk.locator('.bk-price')).toHaveText('2,510.0000');
		await bestAsk.click();

		const give = page.getByTestId('swap-give');
		const want = page.getByTestId('swap-want');
		await expect(give).toHaveValue('1255');
		await expect(want).toHaveValue('0.5');

		const submit = page.getByTestId('swap-submit');
		await expect(submit).toBeEnabled({ timeout: CONSENSUS_TIMEOUT });
		await submit.click();

		// The taker's order matches the resting ask; the level leaves the book and WETH arrives.
		await expect(asks).toHaveCount(2, { timeout: CONSENSUS_TIMEOUT });
		await page.getByRole('link', { name: 'Home' }).first().click();
		await expect(page.getByTestId('token-row-WETH')).toBeVisible({ timeout: CONSENSUS_TIMEOUT });
		// 1 WETH sits on-chain in the signer wallet; the swap adds 0.5 on the hub account.
		await expect(page.getByTestId('token-net-WETH')).toContainText('1.50', { timeout: CONSENSUS_TIMEOUT });

		expect(pageErrors, 'no uncaught browser errors during the flow').toEqual([]);
	});
});
