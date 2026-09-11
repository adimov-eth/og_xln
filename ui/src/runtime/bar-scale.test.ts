import { expect, test } from 'bun:test';
import { niceUsdPerPx } from './bar-scale';

test('growing balances reduce every bar by the same scale', () => {
  expect(niceUsdPerPx(10_000, 500)).toBe(20);
  expect(niceUsdPerPx(20_000, 500)).toBe(50);
});
test('a narrower track refits the same balance', () => {
  expect(niceUsdPerPx(10_000, 300)).toBe(50);
  expect(niceUsdPerPx(10_000, 500)).toBe(20);
});
test('large balances cannot hit the manual scale ceiling and run off screen', () => {
  const scale = niceUsdPerPx(1_000_000, 300);
  expect(scale).toBe(5_000);
  expect(1_000_000 / scale).toBeLessThanOrEqual(300);
});
