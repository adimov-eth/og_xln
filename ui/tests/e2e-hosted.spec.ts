/**
 * The wallet resolves to the stack that serves it, like the SvelteKit app:
 * /api/jurisdictions → importJ over RPC, /relay → gossip, /api/hubs → an
 * account with the real hub. Runs against `bun run dev` (UI_E2E_BASE_URL=
 * http://localhost:5183) or any origin with an xln API; requires a live stack.
 */
import { expect, test } from '@playwright/test';
import { HDNodeWallet } from 'ethers';
import { importStackPhraseUi } from './stack';

const BOOT_TIMEOUT = 30_000;
/** A fresh phrase every run: the stack remembers accounts, a re-imported old phrase would replay a stale height. */
const PHRASE = HDNodeWallet.createRandom().mnemonic?.phrase ?? '';

test.describe('wallet UI on a hosted stack', () => {
	test('imports a phrase and opens an account with the stack hub', { tag: '@functional' }, async ({ page, baseURL }) => {
		test.setTimeout(60_000);
		const probe = await page.request.get(new URL('/api/jurisdictions', baseURL ?? 'http://localhost:5183').toString());
		expect(probe.ok(), 'live xln stack required').toBe(true);
		expect(probe.headers()['content-type']).toContain('json');

		const pageErrors: string[] = [];
		page.on('pageerror', error => pageErrors.push(error.message));
		page.on('console', message => {
			if (message.type() === 'error') process.stdout.write(`[browser] ${message.text().slice(0, 300)}\n`);
		});

		await page.goto('/');
		const stack = page.getByTestId('gate-stack');
		await expect(stack).toHaveAttribute('data-state', 'online', { timeout: 20_000 });
		await expect(stack).toContainText('Connected');

		await importStackPhraseUi(page, PHRASE);
		await expect(page.getByTestId('home-total')).toBeVisible({ timeout: BOOT_TIMEOUT });

		// The account with the stack hub exists on our side once the hub answered over the relay.
		const hubRow = page.getByTestId('account-row').first();
		await expect(hubRow).toBeVisible({ timeout: 15_000 });
		await hubRow.click();
		const connectedHub = new URL(page.url()).pathname.split('/accounts/')[1];
		expect(connectedHub).toMatch(/^0x[0-9a-f]{64}$/);
		const response = await page.request.get('/api/hubs');
		expect(response.ok()).toBe(true);
		const { hubs } = await response.json();
		expect(hubs.map((hub: { entityId: string }) => hub.entityId)).toContain(connectedHub);
		expect(pageErrors, 'no uncaught browser errors during the flow').toEqual([]);
	});
});
