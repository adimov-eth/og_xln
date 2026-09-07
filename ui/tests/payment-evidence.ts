import type { Page } from '@playwright/test';
import type { RuntimeAdapterViewFrame, RuntimeReplica, XLNModule } from '../../core/api/public/runtime-module';
import type { RuntimeAdapter } from '../../core/api/runtime-adapter/types';
import type { FrameLogEntry } from '../../core/types/logging';

/** The embedded receipt monitor reads these same persisted activity journals. */
export async function readCommittedPayment(page: Page, entityId: string, fromHeight: number) {
  return page.evaluate(async ({ owner, from }) => {
    const debug = (window as Window & {
      __xln?: { adapter: () => RuntimeAdapter | null; env: () => RuntimeReplica | null; xln: () => Promise<XLNModule> };
    }).__xln;
    const adapter = debug?.adapter();
    const runtime = debug?.env();
    if (!debug || !adapter || !runtime) throw new Error('Embedded payment receipts unavailable');
    const frame = await adapter.read<RuntimeAdapterViewFrame>('view-frame', { entityId: owner });
    if (frame.height - from > 500) throw new Error('Payment fixture exceeds receipt range');
    const xln = await debug.xln();
    const logs: FrameLogEntry[] = [];
    for (let height = from; height <= frame.height; height += 1) {
      const journal = await xln.readPersistedRuntimeActivityJournal(runtime, height);
      if (!journal) throw new Error(`Payment journal unavailable: ${height}`);
      logs.push(...(journal.logs ?? []));
    }
    const owned = logs.filter(log => (log.entityId ?? log.data?.['entityId']) === owner);
    const started = owned.filter(log => log.message === 'HtlcInitiated');
    const finalized = owned.filter(log => log.message === 'HtlcFinalized');
    if (started.length !== 1 || finalized.length !== 1)
      throw new Error(`Expected one started/finalized payment: ${started.length}/${finalized.length}`);
    const data = started[0]?.data;
    const terminal = finalized[0]?.data;
    if (!data || !terminal || typeof data['hashlock'] !== 'string' || terminal['hashlock'] !== data['hashlock'])
      throw new Error('Payment terminal hash does not match its initiation');
    for (const key of ['amount', 'senderAmount', 'fee']) {
      if (typeof data[key] !== 'string' || !/^\d+$/.test(data[key])) throw new Error(`Invalid committed payment ${key}`);
    }
    return { amount: String(data['amount']), senderAmount: String(data['senderAmount']), fee: String(data['fee']), hashlock: data['hashlock'] };
  }, { owner: entityId, from: fromHeight });
}
