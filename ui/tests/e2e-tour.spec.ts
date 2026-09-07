/**
 * E2E for the guided tour on the live stack, played the way a person would:
 * every action and every navigation is done through the real controls the
 * ring points at. The tour must release each step from the runtime's state
 * (real hubs, real chain over RPC, no mocks) and finish.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import type { RuntimeAdapterViewFrame } from '../../core/api/public/runtime-module';
import type { RuntimeAdapter } from '../../core/api/runtime-adapter/types';

const BOOT_TIMEOUT = 20_000;
const STEP_TIMEOUT = 20_000;

const readDisputeConfirmation = (page: Page) => page.evaluate(async () => {
	const debug = (window as Window & { __xln?: { adapter: () => RuntimeAdapter | null; store: { getState: () => { activeEntityId: string | null } } } }).__xln;
	if (!debug) throw new Error('Wallet diagnostics unavailable');
	const adapter = debug.adapter();
	const entityId = debug.store.getState().activeEntityId;
	if (!adapter || !entityId) throw new Error('Tutorial owner unavailable');
	const frame = await adapter.read<RuntimeAdapterViewFrame>('view-frame', { entityId });
	if (!frame.activeEntity) throw new Error('Tutorial committed Entity unavailable');
	const accounts = frame.activeEntity.accounts.items;
	const batch = frame.activeEntity.core.jBatchState;
	return {
		active: accounts.some(account => account.activeDispute?.observedOnChain === true),
		height: frame.height,
		accounts: accounts.map(account => ({ status: account.status, dispute: Boolean(account.activeDispute), pending: Boolean(account.pendingFrame) })),
		draftStarts: batch?.batch.disputeStarts.length ?? 0,
		sent: batch?.sentBatch ? { txHash: batch.sentBatch.txHash, terminalFailure: batch.sentBatch.terminalFailure } : null,
	};
});

async function currentStep(tour: Locator): Promise<string> {
	return (await tour.isVisible().catch(() => false)) ? (await tour.getAttribute('data-step')) ?? '' : 'closed';
}

async function untilNot(tour: Locator, step: string): Promise<string> {
	await expect.poll(() => currentStep(tour), { timeout: STEP_TIMEOUT }).not.toBe(step);
	return currentStep(tour);
}

/** Follow the ring: press whatever the tour points at until it points at one of `wanted`. */
async function followTo(page: Page, tour: Locator, ...wanted: string[]): Promise<string> {
	await expect.poll(() => tour.getAttribute('data-target'), { timeout: 20_000 }).not.toBe('');
	for (let hops = 0; hops < 6; hops += 1) {
		const target = (await tour.getAttribute('data-target')) ?? '';
		if (wanted.includes(target)) return target;
		if (!target) throw new Error(`tour points at nothing while heading to ${wanted.join('|')}`);
		await page.getByTestId(target).locator('visible=true').first().click({ timeout: 15_000 });
		await expect.poll(() => tour.getAttribute('data-target'), { timeout: 20_000 }).not.toBe(target);
	}
	throw new Error(`could not reach ${wanted.join('|')}`);
}

/**
 * The consent panel: when a receipt exceeds the line granted to the hub, the
 * wallet asks how much of the hub's promise to accept. The person slides to
 * pure credit and extends the limit; the panel leaves once the hub countersigns.
 */
async function grantCapacity(page: Page): Promise<boolean> {
	const spectrum = page.getByTestId('receive-spectrum');
	if (!(await spectrum.isVisible().catch(() => false))) return false;
	// Pure credit: the preset button works with touch emulation too, where End on the slider does not.
	await page.getByRole('button', { name: '0% collateral', exact: true }).click();
	const confirm = page.getByTestId('receive-spectrum-confirm');
	await expect(confirm).toBeEnabled({ timeout: 10_000 });
	await confirm.click();
	await expect(spectrum).toHaveCount(0, { timeout: 60_000 });
	return true;
}

async function answerQuiz(page: Page): Promise<void> {
	const options = page.getByTestId('tour-quiz-option');
	const count = await options.count();
	for (let position = 0; position < count; position += 1) {
		await options.nth(position).click();
		if (await page.getByTestId('tour-next').isEnabled()) break;
	}
	await page.getByTestId('tour-next').click();
}

async function takeLevel(page: Page, side: 'ask' | 'bid'): Promise<void> {
	const book = page.getByTestId('orderbook').locator('visible=true').first();
	await expect(book).toHaveAttribute('data-status', 'live', { timeout: STEP_TIMEOUT });
	const rows = book.locator(`.bk-row.${side}`);
	await expect(rows.first()).toBeVisible({ timeout: STEP_TIMEOUT });
	await (side === 'ask' ? rows.last() : rows.first()).click();
	await grantCapacity(page);
	const submit = page.getByTestId('swap-submit');
	await expect(submit).toBeEnabled({ timeout: STEP_TIMEOUT });
	await submit.click();
}

test.describe('wallet UI guided tour', () => {
	test('a person walks the whole tour on the live stack with the real controls', { tag: '@functional' }, async ({ page }) => {
		test.setTimeout(50_000);
		const pageErrors: string[] = [];
		page.on('pageerror', error => pageErrors.push(error.message));
		// A halted runtime looks like a stuck tour; the browser console names the invariant that halted it.
		page.on('console', message => {
			if (message.type() === 'error') process.stdout.write(`[browser] ${message.text().slice(0, 400)}\n`);
		});

		const startedAt = Date.now();
		const elapsed = (): string => `+${Math.round((Date.now() - startedAt) / 1000)}s`;
		await page.goto('/');
		await expect(page.getByTestId('gate-stack')).toHaveAttribute('data-state', 'online', { timeout: 20_000 });
		await page.getByTestId('gate-learn').click();
		await expect(page.getByTestId('home-total')).toBeVisible({ timeout: BOOT_TIMEOUT });
		const tour = page.getByTestId('tour');
		await expect(tour).toHaveAttribute('data-step', 'welcome', { timeout: STEP_TIMEOUT });
		await expect(page.locator('.tour-scrim')).toHaveCount(0);
		// The tour never presses anything for the user.
		await expect(page.getByTestId('tour-auto')).toHaveCount(0);

		const visited: string[] = [];
		let step = 'welcome';
		for (let guard = 0; guard < 50 && step !== 'closed'; guard += 1) {
			visited.push(step);
			process.stdout.write(`[tour] ${step} ${elapsed()}\n`);
			switch (step) {
				case 'quiz-colors':
				case 'quiz-hub-dark':
					await answerQuiz(page);
					break;
				case 'keys':
					await followTo(page, tour, 'home-sovereignty');
					await page.getByTestId('home-sovereignty').click();
					break;
				case 'credit':
					await followTo(page, tour, 'receive-spectrum-slider', 'receive-spectrum-confirm');
					expect(await grantCapacity(page), 'the consent panel is up on Assets').toBe(true);
					break;
				case 'faucet':
					await followTo(page, tour, 'faucet-offchain');
					await expect(page.getByTestId('faucet-offchain')).toBeEnabled({ timeout: 30_000 });
					await page.getByTestId('faucet-offchain').click();
					break;
				case 'pay':
					await followTo(page, tour, 'pay-to');
					await page.getByTestId('pay-to').click();
					await page.getByTestId('pay-suggestion-H2').first().click();
					await page.getByTestId('pay-amount').fill('25');
					await expect(page.getByTestId('pay-submit')).toBeEnabled({ timeout: STEP_TIMEOUT });
					await page.getByTestId('pay-submit').click();
					break;
				case 'receipt':
					await expect(page.getByTestId('tour-next')).toBeEnabled({ timeout: STEP_TIMEOUT });
					if (await page.getByTestId('receipt-done').isVisible().catch(() => false)) await page.getByTestId('receipt-done').click();
					await page.getByTestId('tour-next').click();
					break;
				case 'receive':
					await followTo(page, tour, 'receive-amount');
					await page.getByTestId('receive-amount').fill('40');
					// The bill may exceed the line granted so far; the ring then moves to the consent panel.
					await expect.poll(() => tour.getAttribute('data-target'), { timeout: 10_000 }).not.toBe('receive-amount').catch(() => undefined);
					await grantCapacity(page);
					break;
				case 'onchain':
					await followTo(page, tour, 'faucet-gas', 'faucet-reserve');
					if ((await tour.getAttribute('data-target')) === 'faucet-gas') {
						await page.getByTestId('faucet-gas').click();
						await expect.poll(() => tour.getAttribute('data-target'), { timeout: STEP_TIMEOUT }).toBe('faucet-reserve');
					}
					await expect(page.getByTestId('faucet-reserve')).toBeEnabled({ timeout: 30_000 });
					await page.getByTestId('faucet-reserve').click();
					break;
				case 'move':
					// Reserve → Account are the defaults; the ring goes straight to the amount when they already hold.
					await followTo(page, tour, 'move-amount');
					await page.getByTestId('move-amount').fill('100');
					await expect(page.getByTestId('move-now')).toBeEnabled({ timeout: 30_000 });
					await page.getByTestId('move-now').click();
					break;
				case 'rebalance': {
					await followTo(page, tour, 'account-manage');
					await page.getByTestId('account-manage').click();
					// The hub collateralizes what it owes uncovered; the hint names that amount.
					await expect(page.getByTestId('tour-hint')).toContainText(/Type \d+\./, { timeout: 20_000 });
					const ask = /Type (\d+)\./.exec((await page.getByTestId('tour-hint').textContent()) ?? '')?.[1] ?? '1';
					await page.getByTestId('collateral-amount').fill(ask);
					await expect(page.getByTestId('collateral-request')).toBeEnabled({ timeout: STEP_TIMEOUT });
					await page.getByTestId('collateral-request').click();
					break;
				}
				case 'trade': {
					await followTo(page, tour, 'orderbook');
					await takeLevel(page, 'ask');
					await expect(page.getByTestId('tour-count')).toContainText('1 / 3', { timeout: STEP_TIMEOUT });
					await takeLevel(page, 'bid');
					await expect(page.getByTestId('tour-count')).toContainText('2 / 3', { timeout: STEP_TIMEOUT });
					await takeLevel(page, 'ask');
					break;
				}
				case 'dispute':
					await followTo(page, tour, 'account-manage');
					await page.getByTestId('account-manage').click();
					await page.getByTestId('manage-tab-dispute').click();
					await page.getByTestId('dispute-prepare').click();
					await page.getByTestId('dispute-prepare-confirm').click();
					break;
				case 'dispute-batch':
					await followTo(page, tour, 'batch-broadcast');
					await expect(page.getByTestId('batch-broadcast')).toBeEnabled({ timeout: STEP_TIMEOUT });
					await page.getByTestId('batch-broadcast').click();
					await expect.poll(() => readDisputeConfirmation(page), { timeout: STEP_TIMEOUT }).toMatchObject({ active: true });
					break;
				default: {
					// A read step: walk to where the ring points, then turn the page.
					await expect.poll(() => tour.getAttribute('data-target'), { timeout: 20_000 }).not.toBe('');
					let turned = false;
					for (let attempt = 0; attempt < 3 && !turned; attempt += 1) {
						for (let hops = 0; hops < 6 && !(await page.getByTestId('tour-next').isEnabled()); hops += 1) {
							const target = (await tour.getAttribute('data-target')) ?? '';
							if (!target) break;
							const control = page.getByTestId(target).locator('visible=true').first();
							if (!(await control.isVisible().catch(() => false))) {
								await page.waitForTimeout(400);
								continue;
							}
							await control.click({ timeout: 15_000 });
							await page.waitForTimeout(400);
						}
						await expect(page.getByTestId('tour-next')).toBeEnabled({ timeout: STEP_TIMEOUT });
						// Next may flick off again while the page settles; walk the ring once more instead of hanging on the click.
						turned = await page
							.getByTestId('tour-next')
							.click({ timeout: 10_000 })
							.then(() => true)
							.catch(() => false);
					}
					expect(turned, `turned the page on ${step}`).toBe(true);
				}
			}
			step = await untilNot(tour, step);
		}

		console.log('TOUR STEPS:', visited.join(' → '));
		expect(visited).toEqual(
			expect.arrayContaining(['credit', 'faucet', 'pay', 'receive', 'onchain', 'move', 'trade', 'quiz-hub-dark', 'dispute', 'dispute-batch', 'watchtower', 'finish']),
		);
		expect(step).toBe('closed');
		await page.getByTestId('nav-settings').locator('visible=true').first().click({ timeout: 15_000 });
		await expect(page.getByText('Finished once.')).toBeVisible({ timeout: 15_000 });
		expect(pageErrors, 'no uncaught browser errors during the flow').toEqual([]);
	});
});
