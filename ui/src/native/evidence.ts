import type { RuntimeAdapterFrameReceiptResponse } from '@xln/core/api/runtime-adapter/types';
import type { PersistedRuntimeActivityPage } from '@xln/core/storage/queries/history';
import { walletOrders } from './history';
import type { WalletView } from '../runtime/views';
import { requireAdapter } from '../runtime/adapter';

/** Read-only export of durable receipts and exact balances for simulator acceptance. Never exports keys or HTLC secrets. */
export async function walletEvidence(wallet: WalletView) {
  const adapter = requireAdapter();
  const height = wallet.frame!.height;
  const payments: Array<Record<string, unknown>> = [];
  const history = await adapter.read<PersistedRuntimeActivityPage>('activity', {
    entityId: wallet.entityId, limit: 1, scanLimit: 1,
  });
  // A recovered checkpoint cannot recreate receipts from before its retained
  // WAL. Export that boundary explicitly instead of requesting missing frames.
  let from = Math.max(1, history.availableFromHeight, history.unavailableThroughHeight + 1);
  while (from <= height) {
    const to = Math.min(height, from + 499);
    const page = await adapter.read<RuntimeAdapterFrameReceiptResponse>('frame-receipts', {
      entityId: wallet.entityId,
      fromHeight: from,
      toHeight: to,
      limit: 500,
      eventNames: ['HtlcInitiated', 'HtlcFinalized'],
    });
    if (page.toHeight < from || page.toHeight > to) throw new Error('Receipt cursor did not advance.');
    for (const receipt of page.receipts)
      for (const log of receipt.logs) {
        if ((log.entityId ?? log.data?.['entityId']) !== wallet.entityId) continue;
        const data = log.data ?? {};
        payments.push({
          event: log.message,
          height: receipt.height,
          amount: data['amount'] == null ? null : String(data['amount']),
          senderAmount: data['senderAmount'] == null ? null : String(data['senderAmount']),
          fee: data['fee'] == null ? null : String(data['fee']),
          hashlock: data['hashlock'],
        });
      }
    from = page.toHeight + 1;
  }
  const orders = await Promise.all(wallet.accounts.map(account => walletOrders(wallet, account.counterpartyId, null)));
  return {
    orders,
    entityId: wallet.entityId,
    height,
    history: { availability: history.availability, availableFromHeight: history.availableFromHeight,
      unavailableThroughHeight: history.unavailableThroughHeight },
    payments,
    tokens: wallet.totals.map(token => ({ tokenId: token.tokenId, net: token.net.toString() })),
    accounts: wallet.accounts.map(account => ({
      id: account.counterpartyId,
      height: account.frameHeight,
      root: account.doc.currentFrame.accountStateRoot,
      pending: Boolean(account.doc.pendingFrame),
      mempool: account.doc.mempoolCount,
      offers: account.doc.state.swapOffers.size,
    })),
  };
}
