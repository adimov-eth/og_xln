import type {
  RuntimeAdapter,
  RuntimeAdapterActivityPage,
  RuntimeAdapterReadQuery,
} from '@xln/core/api/runtime-adapter/types';
import { dedupeRuntimeActivityEvents } from '@xln/core/api/public/activity-history';

/** One volatile UI page per query. Committed history stays authoritative in RAdapter. */
export function createActivityPageReader(query: RuntimeAdapterReadQuery = {}) {
  let cached: RuntimeAdapterActivityPage | null = null;
  let tail: Promise<unknown> = Promise.resolve();
  const scanLimit = Math.max(1, Math.min(1000, Math.floor(Number(query.scanLimit ?? 100))));
  const read = async (adapter: Pick<RuntimeAdapter, 'read'>, height: number): Promise<RuntimeAdapterActivityPage> => {
    const previous = cached;
    if (previous && (query.beforeHeight !== undefined || height === previous.toHeight)) return previous;
    const delta = previous ? height - previous.toHeight : 0;
    const incremental = previous !== null && delta > 0 && delta < scanLimit;
    const page = await adapter.read<RuntimeAdapterActivityPage>('activity', {
      ...query,
      beforeHeight: query.beforeHeight ?? height,
      scanLimit: incremental ? delta : scanLimit,
    });
    if (!incremental || !previous) return (cached = page);
    let fromHeight = Math.max(previous.fromHeight, page.toHeight - scanLimit + 1);
    const events = dedupeRuntimeActivityEvents(
      [...page.events, ...previous.events].filter(event => event.height >= fromHeight),
    ).slice(0, page.limit);
    if (events.length === page.limit) fromHeight = Math.max(fromHeight, events[events.length - 1]!.height);
    return (cached = {
      ...page,
      fromHeight,
      scanLimit,
      scannedFrames: page.toHeight - fromHeight + 1,
      nextBeforeHeight: fromHeight === previous.fromHeight ? previous.nextBeforeHeight : fromHeight - 1,
      events,
      returned: events.length,
    });
  };
  return (adapter: Pick<RuntimeAdapter, 'read'>, height: number): Promise<RuntimeAdapterActivityPage> => {
    // A burst of onChange frames queues deltas, never overlapping full history scans.
    const next = tail.then(() => read(adapter, height));
    tail = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  };
}
