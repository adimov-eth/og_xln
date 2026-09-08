import { expect, test } from '@playwright/test';
import type { RuntimeReplica } from '../../core/api/public/runtime-module';
import { enterStack } from './stack';

test('fresh Entity imports during RPC catch-up retain a contiguous chain prefix', { tag: '@resilience' }, async ({ page, request }) => {
	test.setTimeout(90_000);
	const rpc = async (method: string, params: unknown[] = []): Promise<unknown> => {
		const response = await request.post('/rpc', { data: { jsonrpc: '2.0', id: 1, method, params } });
		expect(response.ok()).toBe(true);
		const body = await response.json();
		expect(body.error).toBeUndefined();
		return body.result;
	};
	// Several authenticated pages must finish while the wallet imports its
	// entities. A short fresh chain did not expose the missing-prefix deadlock.
	const head = Number(BigInt(String(await rpc('eth_blockNumber'))));
	if (head < 1_024) {
		expect(await rpc('eth_chainId'), 'mining is restricted to the local dev chain').toBe('0x7a69');
		await rpc('anvil_mine', [`0x${(1_024 - head).toString(16)}`]);
	}
	const target = Number(BigInt(String(await rpc('eth_blockNumber'))));
	expect(target).toBeGreaterThanOrEqual(1_024);
	const started = performance.now();
	await enterStack(page);
	expect(performance.now() - started, 'fresh wallet opens within its chain-scan budget').toBeLessThan(60_000);
	const histories = await page.evaluate(() => {
		const debug = (window as Window & { __xln?: { env(): RuntimeReplica | null } }).__xln;
		const env = debug?.env();
		if (!env) throw new Error('CATCHUP_RUNTIME_MISSING');
		return [...env.state.eReplicas.values()].map(replica => {
			const history = replica.jHistory;
			if (!history) throw new Error('CATCHUP_HISTORY_MISSING');
			let contiguous = Number(replica.state.lastFinalizedJHeight);
			while (history.blockHashes.has(contiguous + 1)) contiguous += 1;
			return { chainId: replica.state.config.jurisdiction?.chainId, contiguous, scanned: history.scannedThroughHeight };
		});
	});
	const primary = histories.filter(history => history.chainId === 31_337);
	expect(primary.length).toBeGreaterThan(0);
	for (const history of primary) {
		expect(history.contiguous).toBeGreaterThanOrEqual(target);
		expect(history.contiguous).toBe(history.scanned);
	}
	await test.info().attach('catchup-prefix', { body: JSON.stringify({ target, histories }), contentType: 'application/json' });
});
