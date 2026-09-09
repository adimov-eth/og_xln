import { expect, test } from 'bun:test';
import { encryptPasswordVault, decryptPasswordVault } from '../../../frontend/src/lib/security/passwordVault';

const password = 'same-as-brainvault-is-allowed';
const seed = 'local-wallet-secret-test-vector';
test('password vault roundtrips and randomizes encryption without storing the seed', async () => {
  const first = await encryptPasswordVault('wallet-1', seed, password);
  const second = await encryptPasswordVault('wallet-1', seed, password);
  expect(first).not.toBe(second);
  expect(first).not.toContain(seed);
  expect(await decryptPasswordVault('wallet-1', first, password)).toBe(seed);
});
test('password vault rejects wrong passwords, another wallet and modified ciphertext', async () => {
  const raw = await encryptPasswordVault('wallet-1', seed, password);
  await expect(decryptPasswordVault('wallet-1', raw, 'wrong-password')).rejects.toThrow();
  await expect(decryptPasswordVault('wallet-2', raw, password)).rejects.toThrow();
  const record = JSON.parse(raw);
  record.ciphertext = (record.ciphertext[0] === 'A' ? 'B' : 'A') + record.ciphertext.slice(1);
  await expect(decryptPasswordVault('wallet-1', JSON.stringify(record), password)).rejects.toThrow();
});
test('password vault rejects unknown formats and short enrollment passwords', async () => {
  await expect(decryptPasswordVault('wallet-1', '{"version":2}', password)).rejects.toThrow();
  await expect(encryptPasswordVault('wallet-1', seed, 'short')).rejects.toThrow();
});
