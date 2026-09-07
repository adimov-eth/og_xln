import type { PaymentDeliveryMode } from '@xln/core/api/public/runtime-module';

/** Navigation state only: this request never authorizes a payment or a Move. */
export type PaymentDraft = Readonly<{
	entityId: string;
	to: string;
	amount: string;
	tokenId: number;
	description: string;
	deliveryMode: PaymentDeliveryMode;
}>;

export type PaymentFunding = Readonly<{
	draft: PaymentDraft;
	accountId: string;
	requiredCapacity: bigint;
}>;

const entityId = (value: string | null): value is string => /^0x[0-9a-f]{64}$/.test(value ?? '');
export const paymentMode = (value: string | null): PaymentDeliveryMode =>
	value === 'direct' || value === 'async' || value === 'trusted' ? value : 'instant';

export function paymentReviewHref(draft: PaymentDraft): string {
	const params = new URLSearchParams({
		to: draft.to,
		amount: draft.amount,
		token: String(draft.tokenId),
		desc: draft.description,
		mode: draft.deliveryMode,
	});
	return `/pay?${params}`;
}

export function paymentFundingHref(
	funding: PaymentFunding,
	from: 'reserve' | 'external',
	depositAmount: string,
): string {
	const { draft } = funding;
	const params = new URLSearchParams({
		from,
		to: 'account',
		account: funding.accountId,
		token: String(draft.tokenId),
		amount: depositAmount,
		payEntity: draft.entityId,
		payTo: draft.to,
		payAmount: draft.amount,
		payDesc: draft.description,
		payMode: draft.deliveryMode,
		payRequired: String(funding.requiredCapacity),
	});
	return `/move?${params}`;
}

export function readPaymentFunding(params: URLSearchParams): PaymentFunding | null {
	if (!params.has('payEntity')) return null;
	const owner = params.get('payEntity');
	const to = params.get('payTo');
	const accountId = params.get('account');
	const tokenId = Number(params.get('token'));
	const required = params.get('payRequired') ?? '';
	const amount = params.get('payAmount') ?? '';
	if (
		!entityId(owner) ||
		!entityId(to) ||
		!entityId(accountId) ||
		!Number.isSafeInteger(tokenId) ||
		tokenId <= 0 ||
		!/^[1-9][0-9]*$/.test(required) ||
		!/^(?:0|[1-9][0-9]*)(?:\.[0-9]+)?$/.test(amount)
	) {
		throw new Error('Invalid saved payment. Return to Pay and review the amount.');
	}
	return {
		accountId,
		requiredCapacity: BigInt(required),
		draft: {
			entityId: owner,
			to,
			amount,
			tokenId,
			description: params.get('payDesc') ?? '',
			deliveryMode: paymentMode(params.get('payMode')),
		},
	};
}
