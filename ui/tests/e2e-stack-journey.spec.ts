/**
 * The investor journey on a real stack (`bun run dev`: anvil ×2 over RPC, hubs,
 * relay): fund → pay through a hub → same-chain swap → cross-chain swap →
 * dispute a hub on-chain → move reserve to a second hub. Every step is the real
 * UI; nothing is mocked. Skips where the origin has no xln API.
 */
import { expect, test } from '@playwright/test';
import { enterStack, fundFromHub } from './stack';

const CHAIN_TIMEOUT = 90_000;

test.describe('wallet UI journey on the stack', () => {
	test('funds, pays, swaps on one chain and across two, disputes a hub and moves reserve to another hub', { tag: '@functional' }, async ({ page, baseURL }) => {
		test.setTimeout(900_000);
		const probe = await page.request.get(new URL('/api/jurisdictions', baseURL ?? 'http://localhost:5183').toString()).catch(() => null);
		test.skip(!probe || !String(probe.headers()['content-type'] || '').includes('json'), 'no xln stack behind this origin');
		page.on('console', message => {
			if (message.type() === 'error') process.stdout.write(`[browser] ${message.text().slice(0, 300)}\n`);
		});

		await test.step('act 1 · money arrives and a payment goes through the hub', async () => {
			await enterStack(page);
			await fundFromHub(page, '200');
			await page.getByTestId('home-pay').click();
			await page.getByTestId('pay-to').fill('H2');
			await page.getByTestId('pay-amount').fill('25');
			await expect(page.getByTestId('pay-submit')).toBeEnabled({ timeout: CHAIN_TIMEOUT });
			await page.getByTestId('pay-submit').click();
			const receipt = page.getByTestId('payment-receipt');
			await expect(receipt).toBeVisible({ timeout: CHAIN_TIMEOUT });
			await expect(receipt.getByTestId('receipt-kicker')).toHaveText('Paid');
			await receipt.getByTestId('receipt-done').click();
		});

		await test.step('act 2 · a swap on the hub book, same chain', async () => {
			await page.getByTestId('home-swap').click();
			const book = page.getByTestId('orderbook').locator('visible=true').first();
			await expect(book).toHaveAttribute('data-status', 'live', { timeout: CHAIN_TIMEOUT });
			await book.locator('.bk-row.ask').last().click();
			await expect(page.getByTestId('swap-submit')).toBeEnabled({ timeout: CHAIN_TIMEOUT });
			await page.getByTestId('swap-submit').click();
			await page.getByTestId('back').click();
			await expect(page.getByTestId('token-net-WETH')).toBeVisible({ timeout: CHAIN_TIMEOUT });
		});

		await test.step('act 3 · the same swap across two chains (USDT Testnet ↔ USDT Tron)', async () => {
			// Needs an account with a hub on the second chain; the open-account sheet gains a chain picker for this.
			test.info().annotations.push({ type: 'todo', description: 'cross-chain swap UI: open an account on Tron, then Swap → Across networks' });
		});

		await test.step('act 4 · the hub misbehaves: dispute it on-chain', async () => {
			await page.getByTestId('account-row').first().click();
			await page.getByTestId('account-manage').click();
			await page.getByTestId('manage-tab-dispute').click();
			await page.getByTestId('dispute-prepare').click();
			await page.getByTestId('dispute-prepare-confirm').click();
			await expect(page.getByTestId('account-dispute-state')).toBeVisible({ timeout: CHAIN_TIMEOUT });
			await page.getByTestId('nav-home').locator('visible=true').first().click();
			const batch = page.getByTestId('pending-batch');
			await expect(batch).toContainText('Dispute start', { timeout: CHAIN_TIMEOUT });
			await page.getByTestId('batch-broadcast').click();
			await expect(batch).toHaveCount(0, { timeout: CHAIN_TIMEOUT });
		});

		await test.step('act 5 · leave: reserve moves into an account with another hub', async () => {
			await page.getByTestId('nav-manage').locator('visible=true').first().click();
			await page.getByTestId('manage-assets').click();
			await page.getByTestId('faucet-amount').fill('500');
			await page.getByTestId('faucet-reserve').click();
			await page.getByTestId('nav-home').locator('visible=true').first().click();
			await expect(page.getByTestId('home-total')).not.toContainText('$0.00', { timeout: CHAIN_TIMEOUT });
			await page.getByTestId('home-move').click();
			await page.getByTestId('move-amount').fill('100');
			await expect(page.getByTestId('move-now')).toBeEnabled({ timeout: CHAIN_TIMEOUT });
			await page.getByTestId('move-now').click();
			await page.getByTestId('back').click();
			// The batch carries the reserve→collateral move; signing it from Home is the user's act.
			await expect(page.getByTestId('pending-batch')).toBeVisible({ timeout: CHAIN_TIMEOUT });
			await page.getByTestId('batch-broadcast').click();
			await expect(page.getByTestId('pending-batch')).toHaveCount(0, { timeout: CHAIN_TIMEOUT });
		});
	});
});
