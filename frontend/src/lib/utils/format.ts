/**
 * Format utilities for XLN frontend
 */

/**
 * Shorten an Ethereum-style address to "0xabc...def" format
 * @param address Full address (0x + 40 hex chars)
 * @param prefixLen Number of chars after 0x to show at start (default 3)
 * @param suffixLen Number of chars to show at end (default 3)
 */
export function shortAddress(address: string, prefixLen = 3, suffixLen = 3): string {
  if (!address || address.length < 10) return address;
  if (!address.startsWith('0x')) return address;

  return `${address.slice(0, 2 + prefixLen)}...${address.slice(-suffixLen)}`;
}

/**
 * Format entity ID for display (full ID, no truncation)
 * @param entityId Full entity ID (0x + 64 hex chars)
 */
export function formatEntityId(entityId: string): string {
  return entityId || '';
}

export type DecimalFormatOptions = {
  /** Fraction digits always printed. */
  min?: number;
  /** Fraction digits kept; the rest is truncated or rounded away. */
  max: number;
  rounding?: 'trunc' | 'halfExpand';
  grouping?: boolean;
  /** 'auto' keeps the minus on an amount that rounds to zero; 'negative' drops it. */
  sign?: 'auto' | 'negative';
};

// The ES2023 string overload of format() exists at runtime; the configured lib only types the number one.
declare global {
  namespace Intl {
    interface NumberFormat {
      format(value: string): string;
    }
  }
}

const formatters = new Map<string, Intl.NumberFormat>();

/** Exact bigint-decimal formatting: the amount reaches Intl as a decimal string, never as a Number. */
export function formatDecimal(amount: bigint, decimals: number, options: DecimalFormatOptions): string {
  const { max, rounding = 'trunc', grouping = true, sign = 'auto' } = options;
  const min = Math.min(options.min ?? 0, max);
  const key = `${min}|${max}|${rounding}|${grouping}|${sign}`;
  let formatter = formatters.get(key);
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: min,
      maximumFractionDigits: max,
      roundingMode: rounding,
      useGrouping: grouping,
      signDisplay: sign,
    });
    formatters.set(key, formatter);
  }
  return formatter.format(`${amount}e-${decimals}`);
}
