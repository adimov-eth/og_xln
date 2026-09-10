import { expect, test } from '@playwright/test';
import type { RuntimeReplica } from '../../core/api/public/runtime-module';

// Capture compact scan evidence without recording every historical RPC payload.
test.use({ trace: 'off', video: 'off' });

test('guided demo reaches Home and receives test funds on the running chain', { tag: '@resilience' }, async ({ page }, info) => {
	test.setTimeout(57_000);
	page.on('console', message => {
		if (message.type() === 'error') console.error('DEMO_BROWSER_ERROR', message.text());
	});
	console.log('DEMO_STAGE navigate');
	await page.goto('/', { waitUntil: 'domcontentloaded', timeout: 10_000 });
	console.log('DEMO_STAGE start');
	const startedAt = Date.now();
	await page.getByTestId('gate-learn').click({ timeout: 10_000 });
	console.log('DEMO_STAGE syncing');
	try {
		await expect(page.getByTestId('home-total')).toBeVisible({ timeout: 55_000 });
		console.log('DEMO_HOME_ELAPSED_MS', Date.now() - startedAt);
		await page.getByTestId('home-faucet').click();
		await expect(page.getByTestId('test-money-status')).toHaveText('100 USDC received');
		await expect(page.getByTestId('token-net-USDC')).toContainText('100');
		await expect(page).toHaveURL(/\/$/);
		console.log('DEMO_FUNDED_ELAPSED_MS', Date.now() - startedAt);
	} finally {
		const evidence = await page.evaluate(() => {
			const debug = (window as Window & { __xln?: {
				env(): RuntimeReplica | null;
			} }).__xln;
			const env = debug?.env();
			if (!debug || !env) return { runtimeAvailable: false };
			const statuses = [...env.state.eReplicas].map(([key, replica]) => ({
				key, height: replica.state.height,
				finalized: replica.state.lastFinalizedJHeight,
				scanned: replica.jHistory?.scannedThroughHeight,
				headerCount: replica.jHistory?.blockHashes.size,
				pending: replica.mempool.length,
				certified: replica.jPrefixRound?.certificate?.selected.scannedThroughHeight,
			}));
			return { height: env.state.height, statuses };
		});
		await info.attach('chain-sync-status', { body: JSON.stringify(evidence), contentType: 'application/json' });
		console.log('DEMO_CHAIN_SYNC_STATUS', JSON.stringify(evidence));
	}
});
