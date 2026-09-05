/**
 * What the tour itself may do: nothing on the user's behalf. The only action
 * here is the counterparty's, the shop paying a bill the user wrote, and it
 * goes through the same planner and submit path as any payment.
 */
import { getTokenMeta } from '../runtime/format';
import { requestFaucet } from '../runtime/financial/external';
import { getAdapter } from '../runtime/adapter';
import { counterpartyFeePolicy } from '../runtime/financial/manage';
import type { WalletView } from '../runtime/views';

const USDC = 1;

/** Whole USDC in the token's own decimals (6 on every xln jurisdiction so far). */

export const TOUR_FAUCET_USD = 100;
export const TOUR_PAY_USD = 25;
export const TOUR_MOVE_USD = 100;
export const TOUR_INVOICE_USD = 40;

export function demoHub(wallet: WalletView) {
	return wallet.accounts.find(account => account.isHub) ?? null;
}

/** The hub settles the bill the user just wrote: a real inbound payment over the network's faucet. */
export async function tourInvoicePaid(wallet: WalletView): Promise<void> {
	const hub = demoHub(wallet);
	if (!hub) throw new Error('No hub account to pay the invoice from');
	await requestFaucet('offchain', {
		entityId: wallet.entityId,
		signerId: wallet.signerId,
		runtimeId: getAdapter()?.runtimeId ?? '',
		hubEntityId: hub.counterpartyId,
		tokenId: USDC,
		tokenSymbol: getTokenMeta(USDC).symbol,
		amount: String(TOUR_INVOICE_USD),
	});
}

/** The hub's committed fee policy for USDC on our account, or null when it has not published one. */
export function tourCollateralPolicy(wallet: WalletView) {
	const hub = demoHub(wallet);
	return hub ? counterpartyFeePolicy(hub.doc, hub.isLeft, USDC) : null;
}
