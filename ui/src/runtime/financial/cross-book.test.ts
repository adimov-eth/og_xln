import { expect, test } from 'bun:test';
import { crossBookMarket } from './cross-book';
import { pickBookLevel } from './orderbook-quote';

const source = { jurisdiction: `stack:31338:0x${'11'.repeat(20)}`, tokenId: 2, hubId: `0x${'aa'.repeat(32)}` };
const target = { jurisdiction: `stack:31337:0x${'22'.repeat(20)}`, tokenId: 1, hubId: `0x${'bb'.repeat(32)}` };

test('a reversed Cross market keeps the venue and book owner while reversing the takeable side', () => {
  const forward = crossBookMarket(source, target);
  const reverse = crossBookMarket(target, source);
  expect(forward).toEqual({
    pairId: `cross:${source.jurisdiction}:2/${target.jurisdiction}:1`,
    hubId: target.hubId,
    baseTokenId: 2,
    quoteTokenId: 1,
    sourceIsBase: true,
  });
  expect(reverse).toEqual({ ...forward, sourceIsBase: false });
  const sameToken = crossBookMarket({ ...source, tokenId: 1 }, target);
  expect(sameToken.pairId).toBe(`cross:${target.jurisdiction}:1/${source.jurisdiction}:1`);
  expect(sameToken.sourceIsBase).toBe(false);
  expect(sameToken.hubId).toBe(target.hubId);
});

test('Cross wrong-side pick is a no-op; the takeable bid preserves WETH18 to USDC6 exact units', () => {
  const input = {
    level: { priceTicks: 24_900_000n, size: 20_000_000_000_000_000n },
    baseDecimals: 18,
    quoteDecimals: 6,
    capacity: 10_000_000_000_000_000n,
    crossSourceIsBase: true,
  };
  expect(pickBookLevel({ ...input, side: 'ask' })).toBeNull();
  expect(pickBookLevel({ ...input, side: 'bid' })).toEqual({ give: 10_000_000_000_000_000n, want: 24_900_000n });
  expect(pickBookLevel({ ...input, side: 'bid', capacity: 0n })).toBeNull();
  expect(pickBookLevel({ ...input, side: 'bid', level: { ...input.level, priceTicks: 0n } })).toBeNull();
});

test('Cross takeable ask bounds the source quote capacity without inverting price or target units', () => {
  const input = {
    level: { priceTicks: 25_000_000n, size: 20_000_000_000_000_000n },
    baseDecimals: 18,
    quoteDecimals: 6,
    capacity: 25_000_000n,
    crossSourceIsBase: false,
  };
  expect(pickBookLevel({ ...input, side: 'bid' })).toBeNull();
  expect(pickBookLevel({ ...input, side: 'ask' })).toEqual({ give: 25_000_000n, want: 10_000_000_000_000_000n });
  expect(pickBookLevel({ ...input, side: 'ask', capacity: 100_000_000n })).toEqual({
    give: 50_000_000n,
    want: 20_000_000_000_000_000n,
  });
});

test('a pick prices an amount already typed and never raises it', () => {
  // 10.2 WETH offered at 2,500.5000 USDC; 44.895502 USDC spendable.
  const input = {
    side: 'ask' as const,
    level: { priceTicks: 25_005_000n, size: 10_200_000_000_000_000_000n },
    baseDecimals: 18,
    quoteDecimals: 6,
    capacity: 44_895_502n,
    crossSourceIsBase: false,
  };
  // No amount typed: the ticket fills to everything spendable, as before.
  expect(pickBookLevel(input)?.give).toBe(44_895_502n);
  // 20 USDC typed: it stays 20 USDC and the level only supplies the price.
  expect(pickBookLevel({ ...input, typedGive: 20_000_000n })).toEqual({
    give: 20_000_000n,
    want: 7_998_400_319_936_012n,
  });
  // A typed amount above capacity or above the level is still bounded.
  expect(pickBookLevel({ ...input, typedGive: 50_000_000n })?.give).toBe(44_895_502n);
  // Same-network pick (no Cross direction, capacity unknown): bounded by the level's own cost.
  const { crossSourceIsBase: _cross, ...sameNetwork } = input;
  expect(pickBookLevel({ ...sameNetwork, capacity: 0n, typedGive: 30_000_000_000n })?.give).toBe(25_505_100_000n);
  expect(pickBookLevel({ ...input, typedGive: 0n })?.give).toBe(44_895_502n);
});
