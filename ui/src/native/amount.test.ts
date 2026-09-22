import { describe, expect, test } from 'bun:test';
import { nativeAmountText } from './amount';

describe('native amount entry', () => {
  test('preserves exact fractional units in English and Russian', () => {
    expect(nativeAmountText('0.009997000200000001', '.')).toBe('0.009997000200000001');
    expect(nativeAmountText('0,009997000200000001', ',')).toBe('0.009997000200000001');
  });
  test('never silently interprets grouping or the other locale', () => {
    for (const value of ['1,000', '1 000', '1e3', '-1', '1.2.3', 'NaN', ''])
      expect(() => nativeAmountText(value, '.')).toThrow();
    expect(() => nativeAmountText('1.000', ',')).toThrow();
    expect(() => nativeAmountText('1', ':')).toThrow();
  });
});
