import { describe, expect, test } from 'bun:test';
import { paymentFundingHref, paymentReviewHref, readPaymentFunding, type PaymentFunding } from './payment-funding';

const funding: PaymentFunding = {
	draft: {
		entityId: `0x${'1'.repeat(64)}`,
		to: `0x${'2'.repeat(64)}`,
		amount: '100.000001',
		tokenId: 1,
		description: 'invoice & route / ? #',
		deliveryMode: 'direct',
	},
	accountId: `0x${'3'.repeat(64)}`,
	requiredCapacity: 100000001n,
};

describe('saved payment navigation', () => {
	test('Move carries an exact decimal deposit and preserves the distinct payment draft', () => {
		const url = new URL(paymentFundingHref(funding, 'reserve', '25.000001'), 'http://localhost:8080');
		expect(url.pathname).toBe('/move');
		expect(url.searchParams.get('amount')).toBe('25.000001');
		expect(url.searchParams.get('to')).toBe('account');
		expect(readPaymentFunding(url.searchParams)).toEqual(funding);
		const review = new URL(paymentReviewHref(funding.draft), url);
		expect(review.pathname).toBe('/pay');
		expect(review.searchParams.get('amount')).toBe('100.000001');
		expect(review.searchParams.get('to')).toBe(funding.draft.to);
		expect(review.searchParams.get('desc')).toBe(funding.draft.description);
		expect(review.searchParams.get('mode')).toBe('direct');
		expect(review.searchParams.has('send')).toBe(false);
	});
	test('unknown or damaged funding context cannot mint a payment draft', () => {
		expect(readPaymentFunding(new URLSearchParams('from=reserve'))).toBeNull();
		const url = new URL(paymentFundingHref(funding, 'external', '25'), 'http://localhost:8080');
		for (const [field, value] of [
			['payEntity', 'https://attacker.test'],
			['payRequired', '-1'],
			['token', '1.5'],
			['payTo', 'javascript:send()'],
		] as const) {
			const params = new URLSearchParams(url.searchParams);
			params.set(field, value);
			expect(() => readPaymentFunding(params)).toThrow('Invalid saved payment');
		}
	});
});
