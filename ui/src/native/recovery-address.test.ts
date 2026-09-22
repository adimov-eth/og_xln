import { expect, test } from 'bun:test';
import { nativeRecoveryUrl } from './recovery-address';

test('the installed wallet uses the xln recovery service without user configuration', () => {
  expect(nativeRecoveryUrl('https://xln.finance')).toBe('https://xln.finance');
  expect(nativeRecoveryUrl('https://stage.xln.finance', '')).toBe('https://xln.finance');
});

test('a local build uses the dev stand rather than looking for test wallets in production', () => {
  expect(nativeRecoveryUrl('http://127.0.0.1:8082')).toBe('http://127.0.0.1:9100');
  expect(nativeRecoveryUrl('http://localhost:8082')).toBe('http://127.0.0.1:9100');
});

test('operator build configuration is normalized and supports an explicit local stand port', () => {
  expect(nativeRecoveryUrl('https://xln.finance', 'https://tower.xln.finance/')).toBe('https://tower.xln.finance');
  expect(nativeRecoveryUrl('http://127.0.0.1:8082', 'http://127.0.0.1:9200/')).toBe('http://127.0.0.1:9200');
});

test('recovery configuration rejects insecure public endpoints and embedded credentials', () => {
  for (const address of ['http://tower.xln.finance', 'http://127.0.0.1:9100', 'https://user:pass@xln.finance', 'https://xln.finance/?key=value', 'https://xln.finance/#fragment', 'file:///tmp/backup']) {
    expect(() => nativeRecoveryUrl('https://xln.finance', address)).toThrow('IOS_RECOVERY_ORIGIN_INVALID');
  }
});
