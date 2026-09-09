import { useState } from 'react';
import { isAccountTxKindAvailable } from '@xln/core/account/tx/admission-policy';
import type { LendingPool } from '../runtime/financial/lending';
import type { WalletView } from '../runtime/views';
import { sendEntityTxs } from '../runtime/tx';
import { useApp } from '../runtime/store';
import { amountInputText, formatMoney, getTokenMeta } from '../runtime/format';
import { counterpartyFeePolicy } from '../runtime/financial/manage';
import { ReceiveCapacity } from './ReceiveCapacity';

/** Only the lender receives a close payout. Borrowing itself grants outbound credit. */
export function LendingClose({
	pool,
	wallet,
	onSubmitted,
}: {
	pool: LendingPool;
	wallet: WalletView;
	onSubmitted: () => void;
}) {
	const [busy, setBusy] = useState(false);
	const toast = useApp(s => s.toast);
	const closeAvailable = isAccountTxKindAvailable('lending_close_request');
	const account = wallet.accounts.find(entry => entry.counterpartyId === pool.hubEntityId.toLowerCase());
	if (
		pool.status !== 'open' ||
		pool.borrowedAmount !== 0n ||
		!account ||
		pool.lenderEntityId.toLowerCase() !== wallet.entityId
	)
		return null;
	const available = account.tokens.find(token => token.tokenId === pool.tokenId)?.derived.inCapacity ?? 0n;
	const meta = getTokenMeta(pool.tokenId);
	const tariff = counterpartyFeePolicy(account.doc, account.isLeft, pool.tokenId);
	const close = async () => {
		if (!closeAvailable) { toast('Lending is unavailable in this release', 'danger'); return; }
		if (busy || account.disputed || available < pool.availableAmount || !wallet.signerId) return;
		setBusy(true);
		try {
			await sendEntityTxs(wallet.entityId, wallet.signerId, [
				{ type: 'lendingClosePosition', data: { hubEntityId: pool.hubEntityId, positionId: pool.positionId } },
			]);
			toast('Close requested. The payout appears after the account confirms it.');
			onSubmitted();
		} catch (error) {
			toast(error instanceof Error ? error.message : String(error), 'danger');
		} finally {
			setBusy(false);
		}
	};
	return (
		<div className="stack" style={{ marginBottom: 12 }}>
			{!closeAvailable ? <p className="note">Lending is unavailable in this release. This position remains unchanged.</p> : null}
			{pool.availableAmount > 0n ? (
				<ReceiveCapacity
					account={account.doc.state}
					ownerEntityId={wallet.entityId}
					signerId={wallet.signerId}
					counterpartyEntityId={account.counterpartyId}
					accountLabel={account.label}
					jurisdiction={wallet.jurisdiction}
					tokenId={pool.tokenId}
					requiredAmount={pool.availableAmount}
					disabled={!closeAvailable || busy || account.disputed}
				/>
			) : null}
			<p className="note" data-testid="lending-close-tariff" data-policy-version={tariff?.policyVersion}
				data-base={tariff?.baseFee.toString()} data-gas={tariff?.gasFee.toString()} data-bps={tariff?.liquidityFeeBps.toString()}>
				{tariff ? `${account.label} collateral tariff: ${amountInputText(tariff.baseFee, meta.decimals)} ${meta.symbol} base + ${amountInputText(tariff.gasFee, meta.decimals)} ${meta.symbol} gas + ${tariff.liquidityFeeBps} bps.` : 'Collateral tariff unavailable; this does not mean zero fees.'}
				{' '}Applies if your account automatically requests collateral after the payout; deducted from your balance.
			</p>
			<button
				type="button"
				className="btn ghost"
				disabled={!closeAvailable || busy || account.disputed || available < pool.availableAmount || !wallet.signerId}
				onClick={() => void close()}
				data-testid="lending-close"
			>
				{busy ? 'Closing…' : `Close & receive ${formatMoney(pool.availableAmount, meta.decimals)} ${meta.symbol}`}
			</button>
		</div>
	);
}
