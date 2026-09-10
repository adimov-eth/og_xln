import type { FrameLogEntry } from '../../types/logging';
import { RuntimeAdapterError } from './errors';
import type { RuntimeAdapterFrameReceiptResponse, RuntimeAdapterReadQuery } from './types';

type ReceiptSource = {
  latestHeight(): Promise<number>;
  journal(height: number): Promise<{ timestamp: number; logs: FrameLogEntry[] } | null>;
};

const receiptRange = (latestHeight: number, query: RuntimeAdapterReadQuery) => {
  const fromHeight = Math.max(1, Math.floor(Number(query.fromHeight ?? 1)));
  const requestedToHeight = Math.max(fromHeight, Math.floor(Number(query.toHeight ?? latestHeight)));
  const toHeight = latestHeight > 0 ? Math.min(latestHeight, requestedToHeight) : 0;
  const limit = Math.max(1, Math.min(500, Math.floor(Number(query.limit ?? 200))));
  const pageToHeight = toHeight >= fromHeight ? Math.min(toHeight, fromHeight + limit - 1) : 0;
  return { fromHeight, toHeight, pageToHeight };
};

const receiptFilter = (query: RuntimeAdapterReadQuery) => {
  const entityId = String(query.entityId || '')
    .trim()
    .toLowerCase();
  if (entityId && !/^0x[0-9a-f]{64}$/.test(entityId)) {
    throw new RuntimeAdapterError('E_BAD_QUERY', 'frame receipt entityId must be a 32-byte entity id');
  }
  const names = query.eventNames;
  const eventNames = new Set(
    (Array.isArray(names) ? names : typeof names === 'string' ? names.split(',') : [])
      .map(entry => entry.trim())
      .filter(Boolean),
  );
  return {
    active: Boolean(entityId || eventNames.size > 0),
    matches: (log: FrameLogEntry): boolean => {
      if (eventNames.size > 0 && !eventNames.has(log.message)) return false;
      if (!entityId) return true;
      return (
        String(log.entityId ?? log.data?.['entityId'] ?? '')
          .trim()
          .toLowerCase() === entityId
      );
    },
  };
};

/** Called inside the RAdapter committed-read lease in both embedded and remote mode. */
export const readRuntimeFrameReceipts = async (
  source: ReceiptSource,
  query: RuntimeAdapterReadQuery = {},
): Promise<RuntimeAdapterFrameReceiptResponse> => {
  const range = receiptRange(await source.latestHeight(), query);
  const filter = receiptFilter(query);
  const receipts: RuntimeAdapterFrameReceiptResponse['receipts'] = [];
  for (let height = range.fromHeight; height <= range.pageToHeight; height += 1) {
    const activity = await source.journal(height);
    if (!activity) {
      throw new RuntimeAdapterError(
        'E_NOT_FOUND',
        `frame receipt history is unavailable for contiguous range ${range.fromHeight}-${range.pageToHeight}`,
      );
    }
    const logs = activity.logs.filter(filter.matches);
    if (!filter.active || logs.length > 0) receipts.push({ height, timestamp: activity.timestamp, logs });
  }
  // An idle reader keeps the durable head watermark instead of rewinding to zero.
  const toHeight = range.pageToHeight > 0 ? range.pageToHeight : range.toHeight;
  return { fromHeight: range.fromHeight, toHeight, returned: receipts.length, receipts };
};
