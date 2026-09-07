/**
 * The wallet's financial end-to-end test, played as the guided tour.
 *
 * One live stack, one narrative, one wallet. Every action is performed through
 * the real control the ring points at — no mocks, real hubs, a real chain over
 * RPC — and every step that can move money is measured before and after against
 * the committed frame and, where the step touches the chain, against the
 * Depository itself.
 *
 * THE CONSERVATION INVARIANT, asserted after every single step
 * ------------------------------------------------------------
 * For each token t, with the wallet's Account against its hub:
 *
 *     ownValue(t)  = outCollateral(t) + outPeerCredit(t) − inOwnCredit(t)
 *     value(t)     = reserve(t) + ownValue(t)
 *
 * and across any step S:
 *
 *     value(t)ᵃᶠᵗᵉʳ − value(t)ᵇᵉᶠᵒʳᵉ = grant(t,S) − spend(t,S) + settle(t,S)
 *
 * where the only non-zero terms in the whole run are:
 *   grant  — the hub's off-chain faucet payment (exactly the amount requested),
 *            the invoice the shop pays back, and the on-chain reserve faucet;
 *   spend  — the payment's committed senderAmount (amount + fee), each swap
 *            fill's given leg, and the hub's published collateral fee;
 *   settle — the dispute payout, which converts collateral into reserve and
 *            writes off exactly the uncollateralized promise
 *            (outPeerCredit − inOwnCredit).
 *
 * Every other step — reading, quizzes, granting a credit limit, moving reserve
 * into collateral — must leave value(t) bit-identical. Nothing may be created
 * or destroyed anywhere else.
 */
import { expect, test, type Locator, type Page } from '@playwright/test';
import { formatUnits, parseUnits, ZeroHash } from 'ethers';
import { safeStringify } from '../../core/protocol/serialization';
import { readCommittedPayment } from './payment-evidence';
import {
	depositoryOf,
	openTourChain,
	readChainMoney,
	readTourState,
	readTourSwapFills,
	settledTourState,
	tourDisputeWindow,
	tourToken,
	HUB_RESPONSE_SECONDS,
	TOUR_TOKENS,
	USDC,
	USER_RESPONSE_SECONDS,
	WETH,
	type DebugWindow,
	type TourSnapshot,
} from './tour-evidence';

const BOOT_TIMEOUT = 30_000;
const STEP_TIMEOUT = 20_000;
const MONEY_TIMEOUT = 30_000;
/** The tour's own amounts, from ui/src/tour/actions.ts. They are the test's expectations, not a copy of the UI. */
const TOUR_PAY = parseUnits('25', 6);
const TOUR_INVOICE_USD = '40';
const TRADES_TO_MAKE = 3;
/** The wallet renders money to cents; a quote is "the same money" when it is within half of one. */
const HALF_CENT = 5_000n;
const displayed = (text: string): bigint => parseUnits(text.replace(/[^0-9.]/g, ''), 6);

async function currentStep(tour: Locator): Promise<string> {
	return (await tour.isVisible().catch(() => false)) ? (await tour.getAttribute('data-step')) ?? '' : 'closed';
}

async function untilNot(tour: Locator, step: string): Promise<string> {
	await expect.poll(() => currentStep(tour), { timeout: STEP_TIMEOUT }).not.toBe(step);
	return currentStep(tour);
}

/** Follow the ring: press whatever the tour points at until it points at one of `wanted`. */
async function followTo(page: Page, tour: Locator, ...wanted: string[]): Promise<string> {
	await expect.poll(() => tour.getAttribute('data-target'), { timeout: STEP_TIMEOUT }).not.toBe('');
	for (let hops = 0; hops < 6; hops += 1) {
		const target = (await tour.getAttribute('data-target')) ?? '';
		if (wanted.includes(target)) return target;
		if (!target) throw new Error(`tour points at nothing while heading to ${wanted.join('|')}`);
		await page.getByTestId(target).locator('visible=true').first().click({ timeout: 15_000 });
		await expect.poll(() => tour.getAttribute('data-target'), { timeout: STEP_TIMEOUT }).not.toBe(target);
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

/** The hub Account this whole tour is about, read from the wallet's own committed view. */
const readTourHub = (page: Page) =>
	page.evaluate(async () => {
		const debug = (window as DebugWindow).__xln;
		const adapter = debug?.adapter();
		const entityId = debug?.store.getState().activeEntityId;
		if (!debug || !adapter || !entityId) throw new Error('Tour hub owner unavailable');
		const frame = await adapter.read<{ activeEntity: { accounts: { items: { state: { leftEntity: string; rightEntity: string } }[] } } | null }>(
			'view-frame',
			{ entityId },
		);
		const account = frame.activeEntity?.accounts.items[0];
		if (!account) throw new Error('Tour hub Account unavailable');
		const hubId = account.state.leftEntity === entityId ? account.state.rightEntity : account.state.leftEntity;
		return { entityId, hubId };
	});

test.describe('wallet UI guided tour', () => {
	test(
		'a person walks the whole tour on the live stack and every dollar is accounted for',
		{ tag: '@functional' },
		async ({ page }, testInfo) => {
			// A real run is ~25 s. The headroom is for the settlement step alone: it
			// waits out a signed dispute window on the chain and the deadline hook
			// that answers it, whose own polls are worth 150 s in the worst case.
			test.setTimeout(300_000);
			const pageErrors: string[] = [];
			page.on('pageerror', error => pageErrors.push(error.message));
			// A halted runtime looks like a stuck tour; the browser console names the invariant that halted it.
			page.on('console', message => {
				if (message.type() === 'error') process.stdout.write(`[browser] ${message.text().slice(0, 400)}\n`);
			});
			/** Every faucet grant the tour asked for, so a grant can be asserted against what was requested. */
			const faucets: { kind: string; amount: string }[] = [];
			page.on('request', request => {
				if (request.method() !== 'POST') return;
				const match = /^\/api\/faucet\/(erc20|gas|reserve|offchain)$/.exec(new URL(request.url()).pathname);
				if (!match?.[1]) return;
				const body: unknown = request.postDataJSON();
				if (!body || typeof body !== 'object' || !('amount' in body)) throw new Error('Faucet request amount missing');
				faucets.push({ kind: match[1], amount: String(body.amount) });
			});
			const lastFaucet = (kind: string): string => {
				const row = faucets.filter(entry => entry.kind === kind).at(-1);
				if (!row) throw new Error(`No ${kind} faucet grant was requested`);
				return row.amount;
			};

			const startedAt = Date.now();
			const elapsed = (): string => `+${Math.round((Date.now() - startedAt) / 1000)}s`;
			const timings: { step: string; ms: number }[] = [];

			// The dispute payout is settled by the chain; the deadline hook that
			// submits it reads this page's clock, so both must be movable.
			await page.clock.install();
			const { provider } = await openTourChain(page);
			try {
				await page.goto('/');
				await expect(page.getByTestId('gate-stack')).toHaveAttribute('data-state', 'online', { timeout: BOOT_TIMEOUT });
				await page.getByTestId('gate-learn').click();
				await expect(page.getByTestId('home-total')).toBeVisible({ timeout: BOOT_TIMEOUT });
				const tour = page.getByTestId('tour');
				await expect(tour).toHaveAttribute('data-step', 'welcome', { timeout: STEP_TIMEOUT });
				await expect(page.locator('.tour-scrim')).toHaveCount(0);
				// The tour never presses anything for the user.
				await expect(page.getByTestId('tour-auto')).toHaveCount(0);

				const { entityId, hubId } = await readTourHub(page);
				if (!/^0x[0-9a-f]{64}$/.test(hubId)) throw new Error('Tour hub identity is invalid');
				const genesis = await settledTourState(page, hubId, 'genesis', MONEY_TIMEOUT);
				const chainAtStart = await readChainMoney(provider, genesis.depository, entityId, hubId, USDC);
				const fromBlock = await provider.getBlockNumber();
				// A brand new wallet owns nothing anywhere: the run's whole ledger starts at zero.
				for (const tokenId of TOUR_TOKENS) {
					const token = tourToken(genesis, tokenId);
					expect(token, `genesis token ${tokenId}`).toMatchObject({ reserve: 0n, collateral: 0n, offdelta: 0n, ownValue: 0n, value: 0n });
				}
				expect(chainAtStart.reserve).toBe(0n);
				expect(chainAtStart.collateral).toBe(0n);
				expect(chainAtStart.disputeHash).toBe(ZeroHash);
				expect(genesis.batch).toEqual({ draftOperations: 0, disputeStarts: 0, disputeFinalizations: 0, sent: false });
				/**
				 * The wallet opened this Account against a hub during boot, and the
				 * response clocks it chose are signed in for the Account's whole life.
				 * They must be the protocol's role-aware pair: a day for the person,
				 * an hour for the hub. Applying the person's default to both sides —
				 * the flat 24h/24h this test exists to forbid — would hand the hub 24×
				 * the window it is owed, and the chain would enforce that mistake.
				 */
				const openedWindow = tourDisputeWindow(genesis);
				expect(
					{ own: openedWindow.own, hub: openedWindow.peer },
					'the hub Account was opened on the role-aware window, not a flat user default on both sides',
				).toEqual({ own: USER_RESPONSE_SECONDS, hub: HUB_RESPONSE_SECONDS });
				console.log(`TOUR OPEN WINDOW own=${openedWindow.own}s hub=${openedWindow.peer}s total=${openedWindow.total}s`);

				/** The running ledger: value(t) the invariant says the wallet must hold right now. */
				const expectedValue = new Map<number, bigint>(TOUR_TOKENS.map(tokenId => [tokenId, 0n]));
				const grant = (tokenId: number, amount: bigint): void => {
					expectedValue.set(tokenId, (expectedValue.get(tokenId) ?? 0n) + amount);
				};
				const conserved = (label: string, state: TourSnapshot): void => {
					for (const tokenId of TOUR_TOKENS) {
						expect(
							tourToken(state, tokenId).value,
							`${label}: value(${tokenId}) = reserve + ownValue must be exactly the ledger`,
						).toBe(expectedValue.get(tokenId));
					}
				};
				/** A step that must not move money at all: every token, every component. */
				const untouched = (label: string, before: TourSnapshot, after: TourSnapshot): void => {
					conserved(label, after);
					for (const tokenId of TOUR_TOKENS) {
						const [was, now] = [tourToken(before, tokenId), tourToken(after, tokenId)];
						expect({ reserve: now.reserve, collateral: now.collateral, offdelta: now.offdelta, ownValue: now.ownValue }, `${label}: token ${tokenId} untouched`)
							.toEqual({ reserve: was.reserve, collateral: was.collateral, offdelta: was.offdelta, ownValue: was.ownValue });
					}
				};
				/** The hub paying us moves the shared delta in our favour by exactly `amount`. */
				const credited = (label: string, before: TourSnapshot, after: TourSnapshot, tokenId: number, amount: bigint): void => {
					const [was, now] = [tourToken(before, tokenId), tourToken(after, tokenId)];
					expect(now.ownValue - was.ownValue, `${label}: ownValue moved by exactly the amount`).toBe(amount);
					expect(now.offdelta - was.offdelta, `${label}: offdelta moved by exactly the amount`).toBe(after.isLeft ? amount : -amount);
					expect(now.reserve, `${label}: an off-chain payment never touches the reserve`).toBe(was.reserve);
					expect(now.collateral, `${label}: an off-chain payment never touches collateral`).toBe(was.collateral);
				};

				const evidence: Record<string, unknown> = {};
				let disputed: TourSnapshot | null = null;
				const visited: string[] = [];
				let step = 'welcome';
				for (let guard = 0; guard < 60 && step !== 'closed'; guard += 1) {
					const current = step;
					visited.push(current);
					const stepStarted = Date.now();
					process.stdout.write(`[tour] ${current} ${elapsed()}\n`);
					step = await test.step(`tour:${current}`, async () => {
						const before = await settledTourState(page, hubId, `${current}:before`, MONEY_TIMEOUT);
						conserved(`${current}:before`, before);
						switch (current) {
							case 'quiz-colors':
							case 'quiz-hub-dark': {
								await answerQuiz(page);
								untouched(current, before, await settledTourState(page, hubId, current, MONEY_TIMEOUT));
								break;
							}
							case 'keys': {
								await followTo(page, tour, 'home-sovereignty');
								await page.getByTestId('home-sovereignty').click();
								untouched(current, before, await settledTourState(page, hubId, current, MONEY_TIMEOUT));
								break;
							}
							case 'credit': {
								await followTo(page, tour, 'receive-spectrum-slider', 'receive-spectrum-confirm');
								expect(await grantCapacity(page), 'the consent panel is up on Assets').toBe(true);
								const after = await settledTourState(page, hubId, current, MONEY_TIMEOUT);
								// Granting a line changes what the hub *may* owe, never what it owes.
								untouched(current, before, after);
								const line = tourToken(after, USDC);
								expect(line.peerCreditLimit, 'the granted line grew').toBeGreaterThan(tourToken(before, USDC).peerCreditLimit);
								expect(line.inCapacity, 'the line covers the faucet the tour is about to ask for').toBeGreaterThanOrEqual(parseUnits('100', 6));
								expect(after.accountHeight, 'a countersigned limit is a committed Account frame').toBeGreaterThan(before.accountHeight);
								evidence.credit = { limit: line.peerCreditLimit.toString(), inCapacity: line.inCapacity.toString() };
								break;
							}
							case 'faucet': {
								await followTo(page, tour, 'faucet-offchain');
								await expect(page.getByTestId('faucet-offchain')).toBeEnabled({ timeout: MONEY_TIMEOUT });
								const requested = parseUnits(await page.getByTestId('faucet-amount').inputValue(), 6);
								await page.getByTestId('faucet-offchain').click();
								await expect
									.poll(async () => tourToken(await readTourState(page, hubId), USDC).ownValue, { timeout: MONEY_TIMEOUT })
									.toBe(tourToken(before, USDC).ownValue + requested);
								const after = await settledTourState(page, hubId, current, MONEY_TIMEOUT);
								expect(parseUnits(lastFaucet('offchain'), 6), 'the grant asked for is the amount on screen').toBe(requested);
								grant(USDC, requested);
								credited(current, before, after, USDC, requested);
								conserved(current, after);
								expect(after.locks, 'the hub payment left no open lock').toBe(0);
								evidence.faucet = { requested: requested.toString(), value: tourToken(after, USDC).value.toString() };
								break;
							}
							case 'pay': {
								await followTo(page, tour, 'pay-to');
								await page.getByTestId('pay-to').click();
								await page.getByTestId('pay-suggestion-H2').first().click();
								await page.getByTestId('pay-amount').fill('25');
								await expect(page.getByTestId('pay-submit')).toBeEnabled({ timeout: STEP_TIMEOUT });
								const quote = page.getByTestId('pay-quote');
								const sender = await quote.getAttribute('data-sender-amount');
								const recipient = await quote.getAttribute('data-recipient-amount');
								const fee = await quote.getAttribute('data-fee-amount');
								if (!sender || !recipient || !fee) throw new Error('The wallet showed no exact payment quote');
								expect(BigInt(recipient), 'the shop is quoted exactly the typed amount').toBe(TOUR_PAY);
								expect(BigInt(sender), 'the quote debits the amount plus the fee it showed').toBe(TOUR_PAY + BigInt(fee));
								await page.getByTestId('pay-submit').click();
								await expect(page.getByTestId('receipt-kicker')).toHaveText('Paid', { timeout: MONEY_TIMEOUT });
								// The signed initiation, not the screen, says what actually left.
								const committed = await readCommittedPayment(page, entityId, before.runtimeHeight);
								expect(committed.amount).toBe(recipient);
								expect(BigInt(committed.senderAmount)).toBe(BigInt(committed.amount) + BigInt(committed.fee));
								expect(BigInt(committed.senderAmount), 'the debit never exceeds the authorized quote').toBeLessThanOrEqual(BigInt(sender));
								const debit = BigInt(committed.senderAmount);
								await expect
									.poll(async () => tourToken(await readTourState(page, hubId), USDC).ownValue, { timeout: MONEY_TIMEOUT })
									.toBe(tourToken(before, USDC).ownValue - debit);
								const after = await settledTourState(page, hubId, current, MONEY_TIMEOUT);
								grant(USDC, -debit);
								credited(current, before, after, USDC, -debit);
								conserved(current, after);
								expect(after.locks, 'the hash lock is released, not left hanging').toBe(0);
								evidence.payment = { quote: { sender, recipient, fee }, committed };
								break;
							}
							case 'receipt': {
								await expect(page.getByTestId('tour-next')).toBeEnabled({ timeout: STEP_TIMEOUT });
								if (await page.getByTestId('receipt-done').isVisible().catch(() => false))
									await page.getByTestId('receipt-done').click();
								await page.getByTestId('tour-next').click();
								untouched(current, before, await settledTourState(page, hubId, current, MONEY_TIMEOUT));
								break;
							}
							case 'receive': {
								await followTo(page, tour, 'receive-amount');
								await page.getByTestId('receive-amount').fill(TOUR_INVOICE_USD);
								// The bill may exceed the line granted so far; the ring then moves to the consent panel.
								await expect
									.poll(() => tour.getAttribute('data-target'), { timeout: 10_000 })
									.not.toBe('receive-amount')
									.catch(() => undefined);
								await grantCapacity(page);
								const invoice = parseUnits(TOUR_INVOICE_USD, 6);
								await expect
									.poll(async () => tourToken(await readTourState(page, hubId), USDC).ownValue, { timeout: MONEY_TIMEOUT })
									.toBe(tourToken(before, USDC).ownValue + invoice);
								const after = await settledTourState(page, hubId, current, MONEY_TIMEOUT);
								expect(parseUnits(lastFaucet('offchain'), 6), 'the shop paid exactly the bill that was written').toBe(invoice);
								grant(USDC, invoice);
								credited(current, before, after, USDC, invoice);
								conserved(current, after);
								evidence.invoice = { amount: invoice.toString(), value: tourToken(after, USDC).value.toString() };
								break;
							}
							case 'onchain': {
								await followTo(page, tour, 'faucet-gas', 'faucet-reserve');
								if ((await tour.getAttribute('data-target')) === 'faucet-gas') {
									// Both faucets share one busy latch; the gas grant must land before the reserve is asked for.
									const gasCall = page.waitForResponse(row => new URL(row.url()).pathname === '/api/faucet/gas' && row.request().method() === 'POST');
									await page.getByTestId('faucet-gas').click();
									const gas = await gasCall;
									expect(gas.ok(), `the gas faucet answered ${gas.status()}`).toBe(true);
									await expect(page.getByTestId('faucet-gas')).toBeEnabled({ timeout: MONEY_TIMEOUT });
									await expect.poll(() => tour.getAttribute('data-target'), { timeout: MONEY_TIMEOUT }).toBe('faucet-reserve');
								}
								await expect(page.getByTestId('faucet-reserve')).toBeEnabled({ timeout: MONEY_TIMEOUT });
								const requested = parseUnits(await page.getByTestId('faucet-amount').inputValue(), 6);
								const reserveCall = page.waitForResponse(row => new URL(row.url()).pathname === '/api/faucet/reserve' && row.request().method() === 'POST');
								await page.getByTestId('faucet-reserve').click();
								const granted = await reserveCall;
								expect(granted.ok(), `the reserve faucet answered ${granted.status()}`).toBe(true);
								expect(parseUnits(lastFaucet('reserve'), 6), 'the reserve grant is the amount on screen').toBe(requested);
								// The grant is on-chain: the wallet must pick it up from the event it watches for.
								await expect
									.poll(async () => tourToken(await readTourState(page, hubId), USDC).reserve, { timeout: MONEY_TIMEOUT })
									.toBe(tourToken(before, USDC).reserve + requested);
								const after = await settledTourState(page, hubId, current, MONEY_TIMEOUT);
								grant(USDC, requested);
								conserved(current, after);
								// A reserve grant is on-chain money: the Depository must agree, to the unit.
								const chain = await readChainMoney(provider, after.depository, entityId, hubId, USDC);
								expect(chain.reserve, 'the Depository holds exactly the reserve the wallet shows').toBe(tourToken(after, USDC).reserve);
								expect(chain.collateral, 'a reserve grant posts no collateral').toBe(tourToken(after, USDC).collateral);
								expect(tourToken(after, USDC).ownValue, 'a reserve grant never touches the Account').toBe(tourToken(before, USDC).ownValue);
								evidence.reserveFaucet = { requested: requested.toString(), chainReserve: chain.reserve.toString() };
								break;
							}
							case 'move': {
								// Reserve → Account are the defaults; the ring goes straight to the amount when they already hold.
								await followTo(page, tour, 'move-amount');
								const amount = parseUnits('100', 6);
								await page.getByTestId('move-amount').fill('100');
								await expect(page.getByTestId('move-now')).toBeEnabled({ timeout: MONEY_TIMEOUT });
								await page.getByTestId('move-now').click();
								await expect
									.poll(async () => tourToken(await readTourState(page, hubId), USDC).collateral, { timeout: MONEY_TIMEOUT })
									.toBe(tourToken(before, USDC).collateral + amount);
								const after = await settledTourState(page, hubId, current, MONEY_TIMEOUT);
								const [was, now] = [tourToken(before, USDC), tourToken(after, USDC)];
								// Crossing the reserve↔collateral boundary creates nothing: value is conserved exactly.
								expect(now.reserve, 'the reserve paid for the collateral').toBe(was.reserve - amount);
								expect(now.collateral, 'the Account gained exactly that collateral').toBe(was.collateral + amount);
								expect(now.ownValue, 'our own value grew by the collateral we posted').toBe(was.ownValue + amount);
								expect(now.offdelta, 'moving collateral settles nothing between the parties').toBe(was.offdelta);
								conserved(current, after);
								expect(after.accountHeight).toBeGreaterThan(before.accountHeight);
								expect(after.accountRoot).not.toBe(before.accountRoot);
								expect(after.runtimeHeight).toBeGreaterThan(before.runtimeHeight);
								expect(after.runtimeRoot).not.toBe(before.runtimeRoot);
								expect(after.batch, 'the batch is broadcast, not left as a draft').toEqual({ draftOperations: 0, disputeStarts: 0, disputeFinalizations: 0, sent: false });
								const chain = await readChainMoney(provider, after.depository, entityId, hubId, USDC);
								expect(chain.reserve, 'the chain debited the reserve').toBe(now.reserve);
								expect(chain.collateral, 'the chain holds the collateral the Account claims').toBe(now.collateral);
								evidence.move = { reserve: now.reserve.toString(), collateral: now.collateral.toString(), chain: chain.collateral.toString() };
								break;
							}
							case 'rebalance': {
								await followTo(page, tour, 'account-manage');
								await page.getByTestId('account-manage').click();
								// The hub collateralizes what it owes uncovered; the hint names that amount.
								await expect(page.getByTestId('tour-hint')).toContainText(/Type \d+\./, { timeout: STEP_TIMEOUT });
								const ask = /Type (\d+)\./.exec((await page.getByTestId('tour-hint').textContent()) ?? '')?.[1] ?? '1';
								const gross = parseUnits(ask, 6);
								await page.getByTestId('collateral-amount').fill(ask);
								const quotedFee = await page.locator('.kv').filter({ hasText: 'Fee on this request' }).first().locator('.v').innerText();
								const quotedNet = await page.locator('.kv').filter({ hasText: 'Collateral you get' }).first().locator('.v').innerText();
								await expect(page.getByTestId('collateral-request')).toBeEnabled({ timeout: STEP_TIMEOUT });
								await page.getByTestId('collateral-request').click();
								await expect
									.poll(async () => tourToken(await readTourState(page, hubId), USDC).collateral, { timeout: MONEY_TIMEOUT })
									.toBeGreaterThan(tourToken(before, USDC).collateral);
								const after = await settledTourState(page, hubId, current, MONEY_TIMEOUT);
								const [was, now] = [tourToken(before, USDC), tourToken(after, USDC)];
								const fee = was.value - now.value;
								const posted = now.collateral - was.collateral;
								// The hub posts the gross minus its published fee and keeps the fee: nothing else moves.
								expect(posted - (now.value - was.value), 'posted collateral + fee taken = the gross that was asked for').toBe(gross);
								expect(fee, 'the fee is what the wallet quoted, not more').toBeGreaterThanOrEqual(0n);
								// The quote is rendered to cents; it must name the same money, to that precision.
								expect(displayed(quotedFee) - fee, `the quoted fee ${quotedFee} is the fee actually taken (${formatUnits(fee, 6)})`).toBeLessThanOrEqual(HALF_CENT);
								expect(fee - displayed(quotedFee), `the quoted fee ${quotedFee} is the fee actually taken (${formatUnits(fee, 6)})`).toBeLessThanOrEqual(HALF_CENT);
								expect(displayed(quotedNet) - posted, `the quoted collateral ${quotedNet} is what was posted (${formatUnits(posted, 6)})`).toBeLessThanOrEqual(HALF_CENT);
								expect(posted - displayed(quotedNet), `the quoted collateral ${quotedNet} is what was posted (${formatUnits(posted, 6)})`).toBeLessThanOrEqual(HALF_CENT);
								expect(now.reserve, 'the hub posts from its own reserve, never ours').toBe(was.reserve);
								grant(USDC, -fee);
								conserved(current, after);
								const chain = await readChainMoney(provider, after.depository, entityId, hubId, USDC);
								expect(chain.collateral, 'the chain holds the collateral the hub claims to have posted').toBe(now.collateral);
								evidence.rebalance = { gross: gross.toString(), fee: fee.toString(), posted: posted.toString(), quotedFee, quotedNet };
								break;
							}
							case 'trade': {
								await followTo(page, tour, 'orderbook');
								const fills: unknown[] = [];
								for (let index = 0; index < TRADES_TO_MAKE; index += 1) {
									const side = index === 1 ? 'bid' : 'ask';
									const start = await settledTourState(page, hubId, `${current}:fill${index}:before`, MONEY_TIMEOUT);
									await takeLevel(page, side);
									await expect
										.poll(async () => (await readTourState(page, hubId)).accountHeight, { timeout: MONEY_TIMEOUT })
										.toBeGreaterThan(start.accountHeight);
									const done = await settledTourState(page, hubId, `${current}:fill${index}`, MONEY_TIMEOUT);
									const signed = await readTourSwapFills(page, hubId, start.accountHeight, done.accountHeight);
									expect(signed, `${current}: fill ${index} is one signed swap_resolve`).toHaveLength(1);
									const fill = signed[0];
									if (!fill) throw new Error('Tour signed fill missing');
									// The fee is taken from the leg that arrives; the other leg is the one that left.
									const received = fill.feeTokenId === WETH ? WETH : USDC;
									const given = received === WETH ? USDC : WETH;
									const gain = BigInt(fill.want) - BigInt(fill.fee);
									const loss = BigInt(fill.give);
									expect(loss, `${current}: fill ${index} gave something`).toBeGreaterThan(0n);
									expect(gain, `${current}: fill ${index} received something after the hub's fee`).toBeGreaterThan(0n);
									expect(
										tourToken(done, received).ownValue - tourToken(start, received).ownValue,
										`${current}: fill ${index} credited exactly want − fee of token ${received}`,
									).toBe(gain);
									expect(
										tourToken(done, given).ownValue - tourToken(start, given).ownValue,
										`${current}: fill ${index} debited exactly the given leg of token ${given}`,
									).toBe(-loss);
									expect(tourToken(done, received).reserve, 'a bilateral fill never touches the reserve').toBe(tourToken(start, received).reserve);
									expect(tourToken(done, given).reserve, 'a bilateral fill never touches the reserve').toBe(tourToken(start, given).reserve);
									expect(done.offers, 'the fill left no resting offer behind').toBe(0);
									grant(received, gain);
									grant(given, -loss);
									conserved(`${current}:fill${index}`, done);
									fills.push({ index, side, ...fill });
									if (index < TRADES_TO_MAKE - 1)
										await expect(page.getByTestId('tour-count')).toContainText(`${index + 1} / ${TRADES_TO_MAKE}`, { timeout: STEP_TIMEOUT });
								}
								evidence.trades = fills;
								break;
							}
							case 'dispute': {
								await followTo(page, tour, 'account-manage');
								await page.getByTestId('account-manage').click();
								await page.getByTestId('manage-tab-dispute').click();
								await page.getByTestId('dispute-prepare').click();
								await page.getByTestId('dispute-prepare-confirm').click();
								await expect
									.poll(async () => (await readTourState(page, hubId)).batch.disputeStarts, { timeout: MONEY_TIMEOUT })
									.toBe(1);
								const after = await settledTourState(page, hubId, current, MONEY_TIMEOUT);
								// Freezing an Account and drafting its proof moves no money at all.
								untouched(current, before, after);
								expect(after.offers, 'preparing a dispute pulls every open order').toBe(0);
								expect(after.batch.sent, 'the draft still needs the person to sign it').toBe(false);
								const chain = await readChainMoney(provider, after.depository, entityId, hubId, USDC);
								expect(chain.disputeHash, 'nothing reached the chain before the person signed').toBe(ZeroHash);
								break;
							}
							case 'dispute-batch': {
								await followTo(page, tour, 'batch-broadcast');
								await expect(page.getByTestId('batch-broadcast')).toBeEnabled({ timeout: STEP_TIMEOUT });
								await page.getByTestId('batch-broadcast').click();
								await expect
									.poll(async () => (await readTourState(page, hubId)).dispute?.observedOnChain === true, { timeout: MONEY_TIMEOUT })
									.toBe(true);
								const after = await settledTourState(page, hubId, current, MONEY_TIMEOUT);
								// Starting a dispute is a claim, not a payout: the money is still exactly where it was.
								untouched(current, before, after);
								const active = after.dispute;
								if (!active) throw new Error('The observed dispute disappeared');
								expect(active.startedByLeft).toBe(after.isLeft);
								const contract = depositoryOf(provider, after.depository);
								const starts = await contract.queryFilter(contract.filters.DisputeStarted(entityId, hubId), fromBlock);
								expect(starts, 'exactly one DisputeStarted, from us').toHaveLength(1);
								const start = starts[0];
								if (!start) throw new Error('DisputeStarted receipt unavailable');
								expect(start.args.proofbodyHash, 'the chain recorded the proof the wallet holds').toBe(active.initialProofbodyHash);
								expect(Number(start.args.nonce)).toBe(active.initialNonce);
								expect(Number(start.args.disputeTimeout)).toBe(active.disputeTimeout);
								expect(start.args.disputeTimeout).toBe(start.args.disputeStartTimestamp + start.args.leftResponseSeconds + start.args.rightResponseSeconds);
								// The chain enforces exactly the pair the Account signed at open, still role-aware.
								expect(
									{ leftResponseSeconds: Number(start.args.leftResponseSeconds), rightResponseSeconds: Number(start.args.rightResponseSeconds) },
									'the chain runs the window signed into the Account',
								).toEqual(after.disputeConfig);
								const disputedWindow = tourDisputeWindow(after);
								expect(
									{ own: disputedWindow.own, hub: disputedWindow.peer },
									'the enforced window is still a day for the person and an hour for the hub',
								).toEqual({ own: USER_RESPONSE_SECONDS, hub: HUB_RESPONSE_SECONDS });
								expect((await start.getTransactionReceipt()).status).toBe(1);
								const chain = await readChainMoney(provider, after.depository, entityId, hubId, USDC);
								expect(chain.disputeHash, 'the chain now holds a dispute').not.toBe(ZeroHash);
								expect(chain.reserve, 'starting a dispute pays nobody yet').toBe(tourToken(after, USDC).reserve);
								expect(chain.collateral, 'starting a dispute releases no collateral yet').toBe(tourToken(after, USDC).collateral);
								disputed = after;
								evidence.disputeStart = {
									txHash: start.transactionHash,
									nonce: Number(start.args.nonce),
									disputeStartTimestamp: Number(start.args.disputeStartTimestamp),
									disputeTimeout: Number(start.args.disputeTimeout),
									// The signed per-account window; a hub side defaults to one hour, a user side to a day.
									leftResponseSeconds: Number(start.args.leftResponseSeconds),
									rightResponseSeconds: Number(start.args.rightResponseSeconds),
									proofbodyHash: start.args.proofbodyHash,
								};
								console.log(
									`TOUR DISPUTE WINDOW left=${start.args.leftResponseSeconds}s right=${start.args.rightResponseSeconds}s total=${start.args.leftResponseSeconds + start.args.rightResponseSeconds}s`,
								);
								break;
							}
							default: {
								// A read step: walk to where the ring points, then turn the page.
								await expect.poll(() => tour.getAttribute('data-target'), { timeout: STEP_TIMEOUT }).not.toBe('');
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
								expect(turned, `turned the page on ${current}`).toBe(true);
								// Reading must never move money.
								untouched(current, before, await settledTourState(page, hubId, current, MONEY_TIMEOUT));
							}
						}
						return untilNot(tour, current);
					});
					timings.push({ step: current, ms: Date.now() - stepStarted });
				}

				console.log('TOUR STEPS:', visited.join(' → '));
				expect(visited).toEqual(
					expect.arrayContaining([
						'credit', 'faucet', 'pay', 'receive', 'onchain', 'move', 'trade', 'quiz-hub-dark', 'dispute', 'dispute-batch', 'watchtower', 'finish',
					]),
				);
				expect(step).toBe('closed');
				await page.getByTestId('nav-settings').locator('visible=true').first().click({ timeout: 15_000 });
				await expect(page.getByText('Finished once.')).toBeVisible({ timeout: 15_000 });

				// The owner's question: after a dispute, does the money actually come back?
				await test.step('settlement:dispute-payout', async () => {
					const settlementStarted = Date.now();
					if (!disputed) throw new Error('The tour never started a dispute');
					const active = disputed.dispute;
					if (!active) throw new Error('The disputed snapshot carries no dispute');
					// A frozen, disputed Account must not move money on its own while the
					// window runs; the hub may still post collateral against what it owes,
					// which converts promise into guarantee without changing what we hold.
					const preSettle = await settledTourState(page, hubId, 'pre-settlement', MONEY_TIMEOUT);
					conserved('pre-settlement', preSettle);
					expect(preSettle.dispute?.observedOnChain, 'the dispute is still the live one').toBe(true);
					// Our whole claim, and the part of it that no collateral covers.
					const shortfall = new Map<number, bigint>(
						TOUR_TOKENS.map(tokenId => {
							const token = tourToken(preSettle, tokenId);
							expect(token.ownValue, `settlement: token ${tokenId} — this tour only ever ends up a creditor`).toBeGreaterThanOrEqual(0n);
							return [tokenId, token.ownValue - token.outCollateral];
						}),
					);
					evidence.settlementInput = {
						isLeft: preSettle.isLeft,
						tokens: TOUR_TOKENS.map(id => tourToken(preSettle, id)),
						chain: await Promise.all(TOUR_TOKENS.map(id => readChainMoney(provider, preSettle.depository, entityId, hubId, id))),
					};
					const deadline = active.disputeTimeout + 1;
					const head = await provider.getBlock('latest');
					if (!head) throw new Error('Sandbox chain head unavailable');
					/**
					 * The sandbox clock only ever moves forward, and every run's shift
					 * is permanent, so the tour advances the exact remainder of the
					 * window this Account actually signed and not one second more. That
					 * remainder is bounded by the committed pair: with the role-aware
					 * 86400 + 3600 it is at most 90001 s, where a flat 24h on both sides
					 * would burn 172801 s of sandbox time on every single run.
					 */
					const signedWindow = tourDisputeWindow(preSettle);
					expect(
						{ own: signedWindow.own, hub: signedWindow.peer },
						'the window being waited out is the role-aware one',
					).toEqual({ own: USER_RESPONSE_SECONDS, hub: HUB_RESPONSE_SECONDS });
					const advance = Math.max(0, deadline - head.timestamp);
					expect(advance, 'the chain clock moves by no more than the signed window plus the one second past it').toBeLessThanOrEqual(signedWindow.total + 1);
					if (advance > 0) {
						// The response window must actually elapse on the chain that enforces it.
						await provider.send('evm_increaseTime', [advance]);
						await provider.send('evm_mine', []);
					}
					const moved = await provider.getBlock('latest');
					expect(moved?.timestamp ?? 0, 'the chain is past the signed response window').toBeGreaterThanOrEqual(deadline);
					console.log(`TOUR SETTLEMENT WINDOW deadline=${deadline} chainBefore=${head.timestamp} chainAfter=${moved?.timestamp ?? 0} advanced=${advance}s signed=${signedWindow.total}s`);
					// The finalize is submitted by the deadline hook, which reads this page's clock.
					await page.clock.pauseAt(await page.evaluate(() => Date.now() + 1000));
					const host = await page.evaluate(() => Math.round(performance.timeOrigin + performance.now()));
					try {
						if (host < deadline * 1000) await page.clock.fastForward(deadline * 1000 - host);
					} finally {
						await page.clock.resume();
					}
					// A remaining draft still needs the person's signature; the canonical scheduler may have sent it already.
					await expect
						.poll(async () => {
							const now = await readTourState(page, hubId);
							return now.dispute === null || now.batch.sent || now.batch.disputeFinalizations > 0;
						}, { timeout: 60_000, intervals: [250, 500, 1000] })
						.toBe(true);
					const pendingDraft = await readTourState(page, hubId);
					if (pendingDraft.dispute !== null && pendingDraft.batch.disputeFinalizations > 0 && !pendingDraft.batch.sent) {
						await page.getByTestId('nav-home').locator('visible=true').first().click();
						await expect(page.getByTestId('pending-batch')).toContainText('Dispute finalize', { timeout: 30_000 });
						await page.getByTestId('batch-broadcast').click();
					}
					await expect
						.poll(async () => {
							const now = await readTourState(page, hubId);
							return { dispute: now.dispute, collateral: tourToken(now, USDC).collateral };
						}, { timeout: 90_000, intervals: [250, 500, 1000] })
						.toEqual({ dispute: null, collateral: 0n });
					const settled = await settledTourState(page, hubId, 'settlement', MONEY_TIMEOUT);
					const contract = depositoryOf(provider, settled.depository);
					const finalizations = (
						await Promise.all([
							contract.queryFilter(contract.filters.DisputeFinalized(entityId, hubId), fromBlock),
							contract.queryFilter(contract.filters.DisputeFinalized(hubId, entityId), fromBlock),
						])
					).flat();
					expect(finalizations, 'exactly one finalization settled this account').toHaveLength(1);
					const finalization = finalizations[0];
					if (!finalization) throw new Error('DisputeFinalized receipt unavailable');
					const receipt = await finalization.getTransactionReceipt();
					expect(receipt.status).toBe(1);
					expect(finalization.args.finalProofbodyHash, 'the chain settled the very page the wallet started with').toBe(active.initialProofbodyHash);
					expect(finalization.args.nonce).toBe(BigInt(active.initialNonce));

					const beforeFinal = receipt.blockNumber - 1;
					const payouts: Record<number, string> = {};
					for (const tokenId of TOUR_TOKENS) {
						const was = tourToken(preSettle, tokenId);
						const now = tourToken(settled, tokenId);
						// Nothing may slip in between the snapshot the payout is predicted
						// from and the block that pays it out.
						const held = await readChainMoney(provider, settled.depository, entityId, hubId, tokenId, beforeFinal);
						expect(held.collateral, `settlement: token ${tokenId} collateral was unchanged right up to the payout block`).toBe(was.collateral);
						expect(held.reserve, `settlement: token ${tokenId} reserve was unchanged right up to the payout block`).toBe(was.reserve);
						/**
						 * Depository._applyAccountDelta, exactly: our collateral share is
						 * paid straight into our reserve, and the promise beyond it is a
						 * shortfall the debtor covers out of its own on-chain reserve.
						 * Only what the debtor's reserve cannot cover becomes a debt
						 * claim, and only that part leaves the wallet's balance sheet.
						 */
						const owed = shortfall.get(tokenId) ?? 0n;
						const covered = owed < held.peerReserve ? owed : held.peerReserve;
						const expectedPayout = was.outCollateral + covered;
						const uncovered = owed - covered;
						payouts[tokenId] = expectedPayout.toString();
						// THE ANSWER: every enforceable unit lands back in the reserve, exactly.
						expect(now.reserve, `settlement: token ${tokenId} reserve = reserve + our collateral + the promise the hub's reserve covered`).toBe(was.reserve + expectedPayout);
						expect(now.collateral, `settlement: token ${tokenId} collateral is released`).toBe(0n);
						expect(now.offdelta, `settlement: token ${tokenId} account is squared off`).toBe(0n);
						expect(now.ownValue, `settlement: token ${tokenId} closed account owes nothing`).toBe(0n);
						// The only value that may vanish in the whole run: a promise the debtor could not cover.
						expectedValue.set(tokenId, (expectedValue.get(tokenId) ?? 0n) - uncovered);
						const paid = await readChainMoney(provider, settled.depository, entityId, hubId, tokenId, receipt.blockNumber);
						expect(paid.reserve, `settlement: the Depository paid token ${tokenId} into our reserve in the finalization block itself`).toBe(was.reserve + expectedPayout);
						expect(paid.collateral, `settlement: the Depository released token ${tokenId} collateral`).toBe(0n);
						expect(paid.disputeHash).toBe(ZeroHash);
						expect(paid.nonce, 'the settled account carries the next nonce').toBe(BigInt(active.initialNonce) + 1n);
						// Double entry: the hub keeps the collateral that was its share and pays the promise out of its reserve.
						expect(paid.peerReserve, `settlement: token ${tokenId} the hub's reserve funded exactly the promise it made`)
							.toBe(held.peerReserve + was.inCollateral - covered);
						const chain = await readChainMoney(provider, settled.depository, entityId, hubId, tokenId);
						expect(chain.reserve, `settlement: the wallet shows exactly the token ${tokenId} reserve the chain holds`).toBe(now.reserve);
						if (expectedPayout > 0n) {
							const updates = await contract.queryFilter(
								contract.filters.ReserveUpdated(entityId, tokenId),
								receipt.blockNumber,
								receipt.blockNumber,
							);
							expect(
								updates.filter(event => event.transactionHash === receipt.hash).map(event => event.args.newBalance).at(-1),
								`settlement: token ${tokenId} was paid out in the finalization itself`,
							).toBe(was.reserve + expectedPayout);
						}
					}
					conserved('settlement', settled);
					expect(settled.status, 'the account is closed after the dispute').toBe('disputed');
					evidence.settlement = {
						finalizeTx: receipt.hash,
						payout: payouts,
						shortfall: Object.fromEntries([...shortfall].map(([id, value]) => [id, value.toString()])),
						reserves: Object.fromEntries(TOUR_TOKENS.map(id => [id, tourToken(settled, id).reserve.toString()])),
					};
					console.log('TOUR SETTLEMENT PAYOUT', safeStringify({ payouts, tx: receipt.hash }));
					timings.push({ step: 'settlement', ms: Date.now() - settlementStarted });
				});

				console.log('TOUR TIMINGS:', timings.map(row => `${row.step}=${(row.ms / 1000).toFixed(1)}s`).join(' '));
				await testInfo.attach('tour-money', { body: safeStringify({ entityId, hubId, visited, timings, evidence }), contentType: 'application/json' });
				expect(pageErrors, 'no uncaught browser errors during the flow').toEqual([]);
			} finally {
				provider.destroy();
			}
		},
	);
});
