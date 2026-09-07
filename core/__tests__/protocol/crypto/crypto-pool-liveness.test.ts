import { expect, test } from 'bun:test';
import { safeStringify } from '../../../protocol/serialization';

const moduleUrl = new URL('../../../protocol/crypto/crypto-pool.ts', import.meta.url).href;
const runChild = (body: string) => Bun.spawnSync({
  cmd: [process.execPath, '--eval', `
    import { configureCryptoPoolEntry, signDigestsBatchOnPool, recoverAddressesBatch } from ${safeStringify(moduleUrl)};
    import { computeAddress, hexlify, recoverAddress } from 'ethers';
    configureCryptoPoolEntry(new URL(${safeStringify(moduleUrl)}));
    async function run() { ${body} }
    // Match a daemon entry before its HTTP server owns a live event-loop handle.
    // Awaiting run at module scope would conceal premature worker unref.
    run().catch(error => { console.error(error); process.exitCode = 1; });
  `],
  cwd: process.cwd(),
  env: { ...process.env, XLN_CRYPTO_SIGN_WORKERS: '1', XLN_CRYPTO_POOL_WORKERS: '1' },
  stdout: 'pipe',
  stderr: 'pipe',
  timeout: 5_000,
});

test('crypto jobs keep startup alive until every signature and recovered address completes, then release idle workers', () => {
  const child = runChild(`
    const key = new Uint8Array(32).fill(1);
    const digest = new Uint8Array(32).fill(2);
    const many = new Uint8Array(32 * 16).fill(3);
    const expected = computeAddress(hexlify(key)).toLowerCase();
    const [single, batch] = await Promise.all([
      signDigestsBatchOnPool(key, digest), signDigestsBatchOnPool(key, many),
    ]);
    if (!single || single.length !== 65 || !batch || batch.length !== 16 * 65) throw Error('SIGN_JOB_INCOMPLETE');
    if (recoverAddress(hexlify(digest), hexlify(single)).toLowerCase() !== expected) throw Error('SIGNER_MISMATCH');
    const records = new Uint8Array(16 * 97);
    for (let index = 0; index < 16; index++) {
      records.set(many.subarray(index * 32, (index + 1) * 32), index * 97);
      records.set(batch.subarray(index * 65, (index + 1) * 65), index * 97 + 32);
    }
    const addresses = await recoverAddressesBatch(records);
    if (!addresses || addresses.length !== 16 * 20) throw Error('RECOVER_JOB_INCOMPLETE');
    for (let index = 0; index < 16; index++) {
      if (hexlify(addresses.subarray(index * 20, (index + 1) * 20)) !== expected) throw Error('RECOVERED_SIGNER_MISMATCH');
    }
    console.log('CRYPTO_JOBS_COMPLETE signatures=17 recovered=16');
  `);
  expect(child.exitCode, child.stderr.toString()).toBe(0);
  expect(child.stdout.toString()).toContain('CRYPTO_JOBS_COMPLETE signatures=17 recovered=16');
  expect(child.stderr.toString()).toBe('');
});

test('a failed crypto worker settles pending jobs and releases its process references', () => {
  const child = runChild(`
    const digest = new Uint8Array(32).fill(2);
    const results = await Promise.all([
      signDigestsBatchOnPool(new Uint8Array(32), digest),
      signDigestsBatchOnPool(new Uint8Array(32), digest),
    ]);
    if (results.some(result => result !== null)) throw Error('FAILED_WORKER_RESULT_INVALID');
    console.log('CRYPTO_FAILED_JOBS_SETTLED count=2');
  `);
  expect(child.exitCode, child.stderr.toString()).toBe(0);
  expect(child.stdout.toString()).toContain('CRYPTO_FAILED_JOBS_SETTLED count=2');
});
