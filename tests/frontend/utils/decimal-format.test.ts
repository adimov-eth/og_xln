import { describe, expect, test } from 'bun:test';
import { formatDecimal } from '../../../frontend/src/lib/utils/format';
import { formatTokenAmount, formatTokenInputAmount } from '../../../frontend/src/lib/components/Entity/assets/entity-asset-values';
import { formatMicroscopeTokenAmount } from '../../../frontend/src/lib/components/Rcpan/microscope/model/microscope-tokens';
import { formatLedgerAmount } from '../../../frontend/src/lib/network3d/timeline/presentationStage';
import { formatUsd, formatSignedUsd } from '../../../frontend/src/lib/components/Everyday/everyday-runtime';
import { formatAmount, formatLimit, formatMoney, formatSigned } from '../../../ui/src/runtime/format';
import { asTokenDecimals } from '../../../core/account/tx/units';

/** Digit-by-digit bigint references: the arithmetic the Intl-backed formatters replaced. */
const split = (amount: bigint, decimals: number) => {
  const abs = amount < 0n ? -amount : amount;
  const base = 10n ** BigInt(decimals);
  return { negative: amount < 0n, abs, base, whole: abs / base, fraction: (abs % base).toString().padStart(decimals, '0') };
};
const group = (value: bigint): string => value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

const refTruncated = (amount: bigint, decimals: number, max: number, minus: string): string => {
  const { negative, whole, fraction } = split(amount, decimals);
  const digits = fraction.slice(0, Math.min(decimals, max)).replace(/0+$/, '');
  return `${negative ? minus : ''}${group(whole)}${digits ? `.${digits}` : ''}`;
};
const refInput = (amount: bigint, decimals: number): string => {
  if (amount <= 0n) return '';
  const { whole, fraction } = split(amount, decimals);
  const digits = fraction.replace(/0+$/, '');
  return digits ? `${whole}.${digits}` : whole.toString();
};
const refRounded = (abs: bigint, decimals: number, places: number): { whole: bigint; digits: string } => {
  const keep = Math.min(decimals, places);
  const unit = 10n ** BigInt(decimals - keep);
  const scaled = decimals > keep ? (abs + unit / 2n) / unit : abs;
  const base = 10n ** BigInt(keep);
  return { whole: scaled / base, digits: (scaled % base).toString().padStart(keep, '0').padEnd(places, '0') };
};
const refSubUnit = (abs: bigint, decimals: number, fraction: number): number =>
  abs > 0n && abs < 10n ** BigInt(decimals) ? Math.max(fraction, Math.min(decimals, 6)) : fraction;
const refMoney = (amount: bigint, decimals: number, fraction: number): string => {
  const abs = amount < 0n ? -amount : amount;
  const sign = amount < 0n ? '−' : '';
  const places = refSubUnit(abs, decimals, fraction);
  const { whole, digits } = refRounded(abs, decimals, places);
  // The replaced code printed a dangling "0." here when fraction was 0; the Intl port prints "0".
  if (places > fraction) return `${sign}${group(whole)}.${digits.replace(new RegExp(`0{1,${places - fraction}}$`), '')}`.replace(/\.$/, '');
  return fraction > 0 && decimals > 0 ? `${sign}${group(whole)}.${digits}` : `${sign}${group(whole)}`;
};
const refLimit = (amount: bigint, decimals: number, fraction: number): string => {
  const places = refSubUnit(amount, decimals, fraction);
  const unit = 10n ** BigInt(Math.max(0, decimals - places));
  return refMoney(amount - (amount % unit), decimals, fraction);
};
const refUsd = (raw: bigint, decimals: number): string => {
  const { negative, abs, base, whole, fraction } = split(raw, decimals);
  const cents = decimals >= 2 ? fraction.slice(0, 2) : fraction.padEnd(2, '0');
  const extra = abs > 0n && abs < base / 100n ? fraction.slice(0, Math.min(decimals, 4)).replace(/0+$/, '') : '';
  return `${negative ? '−' : ''}$${group(whole)}.${extra || cents}`;
};

const DECIMALS = [0, 1, 2, 6, 8, 18];
const rawAmounts = (decimals: number): bigint[] => {
  const unit = 10n ** BigInt(decimals);
  const base = [0n, 1n, 5n, 9n, 49n, 50n, 99n, 994n, 995n, 999n, 1000n, 15000n, 1234567n, 987654321n, unit - 1n, unit, unit + 1n, 5n * unit / 1000n, 159n * unit / 10000n, 999n * unit / 1000n, 123456789012345678901234567890n, 10n ** 30n, 10n ** 30n + 1n, 10n ** 30n - 1n, 999999999999999999999999999999n, 5n * unit / 1000n + 1n, 5n * unit / 100n];
  return [...base, ...base.filter(value => value > 0n).map(value => -value)];
};
const cases = DECIMALS.flatMap(decimals => rawAmounts(decimals).map(amount => ({ decimals, amount })));

describe('formatDecimal', () => {
  test('keeps every digit of 18-decimal and 10^30 values', () => {
    expect(formatDecimal(123456789012345678901234567890n, 18, { max: 18, grouping: false })).toBe('123456789012.34567890123456789');
    expect(formatDecimal(10n ** 30n, 18, { max: 4 })).toBe('1,000,000,000,000');
    expect(formatDecimal(10n ** 30n + 1n, 0, { max: 0 })).toBe('1,000,000,000,000,000,000,000,000,000,001');
    expect(formatDecimal(-1999n, 3, { min: 2, max: 2, rounding: 'halfExpand' })).toBe('-2.00');
  });

  test('sign display decides the minus on an amount that rounds to zero', () => {
    expect(formatDecimal(-1n, 6, { max: 4 })).toBe('-0');
    expect(formatDecimal(-1n, 6, { max: 4, sign: 'negative' })).toBe('0');
  });
});

describe('ported bigint formatters match digit-by-digit references', () => {
  test('formatTokenAmount', () => {
    for (const { decimals, amount } of cases) {
      for (const precision of [0, 2, 4, 18]) {
        expect(formatTokenAmount(amount, decimals, precision)).toBe(refTruncated(amount, decimals, precision, '-'));
      }
    }
  });
  test('formatTokenInputAmount', () => {
    for (const { decimals, amount } of cases) expect(formatTokenInputAmount(amount, decimals)).toBe(refInput(amount, decimals));
  });
  test('formatMicroscopeTokenAmount', () => {
    for (const { decimals, amount } of cases) {
      for (const max of [2, 3, 6]) {
        const token = { decimals } as Parameters<typeof formatMicroscopeTokenAmount>[0];
        expect(formatMicroscopeTokenAmount(token, amount, max)).toBe(refTruncated(amount, decimals, max, '-'));
      }
    }
  });
  test('formatLedgerAmount', () => {
    for (const { decimals, amount } of cases) {
      const token = { decimals } as Parameters<typeof formatLedgerAmount>[1];
      expect(formatLedgerAmount(amount, token)).toBe(refTruncated(amount, decimals, decimals, '−'));
    }
  });
  test('formatUsd and formatSignedUsd', () => {
    for (const { decimals, amount } of cases) {
      expect(formatUsd(amount, decimals)).toBe(refUsd(amount, decimals));
      expect(formatSignedUsd(amount, decimals)).toBe(amount > 0n ? `+${refUsd(amount, decimals)}` : amount < 0n ? refUsd(amount, decimals) : '$0.00');
    }
  });
  test('ui formatAmount, formatMoney, formatLimit, formatSigned', () => {
    for (const { decimals, amount } of cases) {
      const d = asTokenDecimals(decimals);
      for (const max of [2, 6]) expect(formatAmount(amount, d, max)).toBe(refTruncated(amount, decimals, max, '−'));
      for (const fraction of [0, 2, 4]) {
        expect(formatMoney(amount, d, fraction)).toBe(refMoney(amount, decimals, fraction));
        expect(formatLimit(amount, d, fraction)).toBe(refLimit(amount, decimals, fraction));
        const abs = amount < 0n ? -amount : amount;
        const body = refMoney(abs, decimals, fraction);
        expect(formatSigned(amount, d, fraction)).toBe(amount > 0n ? `+${body}` : amount < 0n ? `−${body}` : body);
      }
    }
  });
});
