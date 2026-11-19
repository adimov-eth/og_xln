import type { RuntimeActivityEvent, RuntimeAdapterEntitySummary, RuntimeAdapterViewFrame } from '@xln/core/api/public/runtime-module';
import { walletMovements, type Movement } from '../../../../../ui/src/runtime/financial/movement-projection';
import { formatUsd } from './everyday-runtime';

export type EverydayActivityRow = {
  id: string;
  title: string;
  subtitle: string;
  amountText: string;
};

const shortPeer = (id: string): string => `${id.slice(0, 6)}…${id.slice(-4)}`;

function formatMovementTime(timestamp: number, now: number): string {
  if (!Number.isFinite(timestamp) || timestamp <= 0) return 'Recent';
  const at = new Date(timestamp);
  const today = new Date(now);
  const sameDay = at.toDateString() === today.toDateString();
  if (sameDay) return at.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false });
  return at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function movementTitle(movement: Movement): string {
  if (movement.tone === 'failed') return 'Payment failed';
  if (movement.tone === 'inflight') return 'Payment pending';
  return movement.title;
}

function movementAmountText(movement: Movement, decimals: number): string {
  if (movement.amount === null) return '';
  const sign = movement.tone === 'failed' || movement.tone === 'inflight'
    ? ''
    : movement.direction === 'out'
      ? '−'
      : movement.direction === 'in'
        ? '+'
        : '';
  return `${sign}${formatUsd(movement.amount, decimals)}`;
}

export function projectEverydayActivityRows(params: {
  events: readonly RuntimeActivityEvent[];
  entityId: string;
  accountIds: readonly string[];
  entities: readonly RuntimeAdapterEntitySummary[];
  decimals: number;
  now?: number;
}): EverydayActivityRow[] {
  const labels = new Map(params.entities.map(e => [e.entityId.toLowerCase(), e.label?.trim() || '']));
  const now = params.now ?? Date.now();
  return walletMovements([...params.events], params.entityId, params.accountIds)
    .filter(movement => movement.kind === 'payment')
    .map(movement => {
      const partyId = movement.counterpartyId?.toLowerCase() ?? '';
      const name = partyId ? (labels.get(partyId) || shortPeer(partyId)) : '';
      const party = name ? (movement.direction === 'in' ? `From ${name}` : `${movement.hopOnly ? 'Through' : 'To'} ${name}`) : '';
      const time = formatMovementTime(movement.timestamp, now);
      return {
        id: movement.id,
        title: movementTitle(movement),
        subtitle: [party, time].filter(Boolean).join(' · '),
        amountText: movementAmountText(movement, params.decimals),
      };
    });
}

export function buildEverydayActivityRows(
  events: readonly RuntimeActivityEvent[],
  entityId: string,
  frame: RuntimeAdapterViewFrame | null,
  decimals: number,
): EverydayActivityRow[] {
  const self = entityId.toLowerCase();
  const accountIds = (frame?.activeEntity?.accounts.items ?? []).map(a =>
    a.state.leftEntity.toLowerCase() === self ? a.state.rightEntity.toLowerCase() : a.state.leftEntity.toLowerCase(),
  );
  return projectEverydayActivityRows({
    events,
    entityId: self,
    accountIds,
    entities: frame?.entities ?? [],
    decimals,
  });
}
