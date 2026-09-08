import { CopyId } from '../CopyId';
import { useAdapterRead } from '../../runtime/hooks';
import type { AccountFrame } from '@xln/core/types/account';
export function FrameHistory({ entityId, counterpartyId }: { entityId: string; counterpartyId: string }) {
	const path = entityId && counterpartyId ? `entity/${entityId}/account/${counterpartyId}/frames` : null;
	const read = useAdapterRead<AccountFrame[]>(path, { limit: 25 });
	const frames = [...(read.data ?? [])].reverse();

	if (read.error) return <p className="note" style={{ color: 'var(--dispute)' }}>{read.error}</p>;
	if (read.loading && frames.length === 0) return <p className="note">Reading the signed pages…</p>;
	if (frames.length === 0) return <p className="note">No page has been co-signed on this account yet.</p>;

	return (
		<div data-testid="account-frames">
			{frames.map((frame, index) => (
				<div key={`${frame.height}-${frame.accountStateRoot}`} className={`row${index === 0 ? ' first' : ''}`} data-testid="account-frame-row">
					<div className="rt">
						<span className="tx">
							<span className="t num">
								Page {frame.height} · {frame.accountTxs.length} {frame.accountTxs.length === 1 ? 'action' : 'actions'}
							</span>
							<span className="s">
								{frame.accountTxs.length > 0
									? [...new Set(frame.accountTxs.map(tx => String(tx.type).replace(/_/g, ' ')))].join(', ')
									: 'no action, a clock or a countersignature'}
							</span>
						</span>
						<span className="r">
							<CopyId value={frame.accountStateRoot} label="Account state root" />
						</span>
					</div>
				</div>
			))}
		</div>
	);
}
