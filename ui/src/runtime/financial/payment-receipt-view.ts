import type { RuntimeActivityEvent } from '@xln/core/api/public/runtime-module';

/** Terminal events name adjacent accounts. They do not certify an end recipient. */
export function paymentReceiptFacts(name: string, data: Record<string, unknown>) {
  const sent = name === 'HtlcFinalized';
  const counterparty = String((sent ? data['toEntity'] : data['fromEntity']) ?? '').trim().toLowerCase();
  const token = Number(data['tokenId']);
  const tokenId = data['tokenId'] !== undefined && Number.isSafeInteger(token) && token > 0 ? token : null;
  const rawAmount = String(data['amount'] ?? '');
  const amount = /^\d+$/.test(rawAmount) ? BigInt(rawAmount) : null;
  return { sent, counterparty, tokenId, amount };
}

/** The committed initiation binds the actual recipient to this exact hashlock. */
export function originatedRecipient(events: readonly RuntimeActivityEvent[], entityId: string, hash: string): string | null {
  if (!hash) return null;
  const matches = events.filter(event => event.source === 'runtime_log' && event.rawType === 'HtlcInitiated' &&
    event.direction === 'out' && event.entityId?.toLowerCase() === entityId.toLowerCase() && event.hash?.toLowerCase() === hash.toLowerCase());
  const recipients = new Set(matches.map(event => event.counterpartyId?.toLowerCase()).filter((value): value is string => Boolean(value)));
  if (recipients.size > 1) throw new Error('PAYMENT_RECIPIENT_EVIDENCE_CONFLICT');
  return recipients.values().next().value ?? null;
}
