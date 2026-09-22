import { expect, test } from 'bun:test';
import { discoverRuntimeRecoveryCandidates } from '@xln/core/storage/recovery/discovery';
import { fetchTowerRecoveryBundles, towerHasRecoveryBundle } from '@xln/core/storage/recovery/discovery/tower-http';

const seed = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';
const tower = { url: 'http://127.0.0.1:9100' };
const lookupKey = `0x${'00'.repeat(32)}`;

test('cancelled discovery rejects before asking any source', async () => {
  const reason = new Error('owner cancelled recovery');
  await expect(discoverRuntimeRecoveryCandidates(seed, {
    towers: [tower], signal: AbortSignal.abort(reason),
  })).rejects.toBe(reason);
});

test('cancelling an in-flight tower lookup is not an empty or failed candidate', async () => {
  const controller = new AbortController();
  const reason = new Error('cancel lookup in flight');
  const pending = discoverRuntimeRecoveryCandidates(seed, { towers: [tower], signal: controller.signal });
  controller.abort(reason);
  await expect(pending).rejects.toBe(reason);
});

test('both lookup and bundle download honor the same cancellation signal', async () => {
  const reason = new Error('cancel tower transfer');
  const signal = AbortSignal.abort(reason);
  await expect(towerHasRecoveryBundle(tower, lookupKey, undefined, signal)).rejects.toBe(reason);
  await expect(fetchTowerRecoveryBundles(tower, lookupKey, undefined, signal)).rejects.toBe(reason);
});
