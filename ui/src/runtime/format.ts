import { asTokenDecimals, type TokenDecimals } from '@xln/core/account/tx/units';
import { formatDecimal } from '../../../frontend/src/lib/utils/format';
/** Token glyph for the round icon: currency sign where one exists, first letter otherwise. */
export function tokenGlyph(symbol: string): string {
	const upper = symbol.toUpperCase();
	if (upper === 'USDC' || upper === 'USDT') return '$';
	if (upper === 'WETH' || upper === 'ETH') return 'Ξ';
	return upper.slice(0, 1) || '?';
}

const minus = (text: string): string => (text.startsWith('-') ? `\u2212${text.slice(1)}` : text);

/** "12,480.2" grouped integer part, trailing zeros trimmed, never exponent. */
export function formatAmount(amount: bigint, decimals: TokenDecimals, maxFraction = 6): string {
	return minus(formatDecimal(amount, decimals, { max: maxFraction }));
}

/** Places for an amount below one whole token: cents would print 0.005 WETH as 0.01. */
function subUnitPlaces(abs: bigint, decimals: TokenDecimals, fraction: number): number {
	return abs > 0n && abs < 10n ** BigInt(decimals) ? Math.max(fraction, Math.min(decimals, 6)) : fraction;
}

export function formatMoney(amount: bigint, decimals: TokenDecimals, fraction = 2): string {
	const places = subUnitPlaces(amount < 0n ? -amount : amount, decimals, fraction);
	return minus(formatDecimal(amount, decimals, decimals > 0 ? { min: fraction, max: places, rounding: 'halfExpand' } : { max: 0, rounding: 'halfExpand' }));
}

/**
 * A limit never overstates what is available: it rounds toward zero. Below one whole
 * token it keeps six places, so 0.0159 WETH does not read as 0.01.
 */
export function formatLimit(amount: bigint, decimals: TokenDecimals, fraction = 2): string {
	const places = subUnitPlaces(amount, decimals, fraction);
	return minus(formatDecimal(amount, decimals, decimals > 0 ? { min: fraction, max: places, sign: 'negative' } : { max: 0, sign: 'negative' }));
}

/** Signed money: "+230.00" / "−120.00" / "0.00". */
export function formatSigned(amount: bigint, decimals: TokenDecimals, fraction = 2): string {
	const body = formatMoney(amount < 0n ? -amount : amount, decimals, fraction);
	return amount > 0n ? `+${body}` : amount < 0n ? `−${body}` : body;
}

export function formatUsd(value: number): string {
	const abs = Math.abs(value);
	const sign = value < 0 ? '−' : '';
	return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function parseAmount(input: string, decimals: TokenDecimals): bigint {
	// No comma stripping: "1,5" meant 1.5 to many users and parsed as 15.
	const text = input.trim();
	if (!/^\d*(\.\d*)?$/.test(text) || text === '' || text === '.') {
		throw new Error('Enter a valid amount');
	}
	const [wholeText = '0', fractionText = ''] = text.split('.');
	if (fractionText.length > decimals) {
		throw new Error(`Too many decimal places (max ${decimals})`);
	}
	const whole = BigInt(wholeText || '0');
	const fraction = BigInt((fractionText || '').padEnd(decimals, '0') || '0');
	return whole * 10n ** BigInt(decimals) + fraction;
}

/** Exact input text for a bigint amount: "730.5" (no grouping, no trailing zeros). */
export function amountInputText(value: bigint, decimals: TokenDecimals): string {
	const base = 10n ** BigInt(decimals);
	const whole = value / base;
	const fraction = (value % base).toString().padStart(decimals, '0').replace(/0+$/, '');
	return fraction ? `${whole}.${fraction}` : whole.toString();
}

export function shortId(value: string, head = 6, tail = 4): string {
	const text = String(value || '');
	if (text.length <= head + tail + 1) return text;
	return `${text.slice(0, head)}…${text.slice(-tail)}`;
}

const relativeTime = new Intl.RelativeTimeFormat('en', { style: 'short', numeric: 'auto' });

export function timeAgo(timestamp: number): string {
	const minutes = Math.floor(Math.max(0, Date.now() - timestamp) / 60_000);
	if (minutes < 1) return relativeTime.format(0, 'second');
	if (minutes < 60) return relativeTime.format(-minutes, 'minute');
	const hours = Math.floor(minutes / 60);
	return hours < 24 ? relativeTime.format(-hours, 'hour') : relativeTime.format(-Math.floor(hours / 24), 'day');
}

export function formatClock(timestamp: number): string {
	return new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}

/** Orderbook prices have four fixed decimal places. */
export const PRICE_DECIMALS = asTokenDecimals(4);
