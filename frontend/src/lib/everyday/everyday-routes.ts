import { createDefaultDelta } from '@xln/core/account/state/delta';
import type {
  Delta,
  DerivedDelta,
  PaymentDeliveryMode,
  RuntimeAdapterViewFrame,
} from '@xln/core/api/public/runtime-module';
import type { EverydaySendRoute } from './everyday-autopilot';
import { isAccountDisputed } from './everyday-policy';

export type EverydayRouteQuery = {
  sourceEntityId: string;
  targetEntityId: string;
  tokenId: number;
  amount: bigint;
  fundingAccountId?: string;
};

export type FetchEverydayRoutesFn<TRoute extends EverydaySendRoute = EverydaySendRoute> = (
  query: EverydayRouteQuery,
) => Promise<readonly TRoute[]>;

const norm = (value: unknown): string => String(value || '').trim().toLowerCase();

export const isNoRouteError = (failure: unknown): boolean => {
  const code =
    failure instanceof Error && 'code' in failure && typeof failure.code === 'string'
      ? failure.code
      : '';
  const message = failure instanceof Error ? failure.message : String(failure);
  return code === 'E_NOT_FOUND' || /not.?found|no payment route/i.test(message);
};

export const resolveEverydayDeliveryMode = (
  route: Pick<EverydaySendRoute, 'path'>,
): PaymentDeliveryMode => (route.path.length === 2 ? 'direct' : 'instant');

export function sortEverydayRoutes<TRoute extends EverydaySendRoute>(
  routes: readonly TRoute[],
): TRoute[] {
  return [...routes].sort((a, b) => {
    const feeDiff = a.totalFee - b.totalFee;
    if (feeDiff !== 0n) return feeDiff < 0n ? -1 : 1;
    const hopDiff = a.path.length - b.path.length;
    if (hopDiff !== 0) return hopDiff;
    const debitDiff = a.senderAmount - b.senderAmount;
    return debitDiff < 0n ? -1 : debitDiff > 0n ? 1 : 0;
  });
}

/** Synthesizes a fee-free 2-hop bilateral route when a non-disputed friend tab has capacity. */
export function findDirectBilateralRoute(params: {
  frame: RuntimeAdapterViewFrame | null | undefined;
  entityId: string;
  targetEntityId: string;
  tokenId: number;
  amount: bigint;
  deriveDeltaFn: (delta: Delta, isLeft: boolean) => DerivedDelta;
}): EverydaySendRoute | null {
  if (params.amount <= 0n || !params.frame?.activeEntity) return null;
  const self = norm(params.entityId);
  const target = norm(params.targetEntityId);
  if (!self || !target || self === target) return null;
  const isHub = params.frame.entities.some(
    entity => norm(entity.entityId) === target && entity.isHub === true,
  );
  if (isHub) return null;
  const doc = params.frame.activeEntity.accounts.items.find(
    item =>
      (norm(item.state.leftEntity) === self && norm(item.state.rightEntity) === target) ||
      (norm(item.state.rightEntity) === self && norm(item.state.leftEntity) === target),
  );
  if (!doc || isAccountDisputed(doc)) return null;
  const derived = params.deriveDeltaFn(
    doc.state.deltas.get(params.tokenId) ?? createDefaultDelta(params.tokenId),
    norm(doc.state.leftEntity) === self,
  );
  if (derived.outCapacity < params.amount) return null;
  return {
    path: [self, target],
    totalFee: 0n,
    senderAmount: params.amount,
    recipientAmount: params.amount,
  };
}

/**
 * Quotes existing routes first; if none are returned (empty list or E_NOT_FOUND)
 * and `canFundFromHub` is true with a primary hub, retries with `fundingAccountId`.
 */
export async function quoteEverydayRoutes<TRoute extends EverydaySendRoute>(params: {
  sourceEntityId: string;
  targetEntityId: string;
  tokenId: number;
  amount: bigint;
  primaryHubId: string | null;
  canFundFromHub: boolean;
  fetchRoutes: FetchEverydayRoutesFn<TRoute>;
}): Promise<{ routes: TRoute[]; fundedByHub: boolean }> {
  const baseQuery: EverydayRouteQuery = {
    sourceEntityId: params.sourceEntityId,
    targetEntityId: params.targetEntityId,
    tokenId: params.tokenId,
    amount: params.amount,
  };
  const canRetryWithHub = Boolean(params.primaryHubId && params.canFundFromHub);
  try {
    const routes = sortEverydayRoutes(await params.fetchRoutes(baseQuery));
    if (routes.length > 0 || !canRetryWithHub) return { routes, fundedByHub: false };
    const funded = sortEverydayRoutes(
      await params.fetchRoutes({ ...baseQuery, fundingAccountId: params.primaryHubId! }),
    );
    return { routes: funded, fundedByHub: true };
  } catch (failure) {
    if (!canRetryWithHub || !isNoRouteError(failure)) throw failure;
    const funded = sortEverydayRoutes(
      await params.fetchRoutes({ ...baseQuery, fundingAccountId: params.primaryHubId! }),
    );
    return { routes: funded, fundedByHub: true };
  }
}

/**
 * Resolves a route that actually clears a friend tab: direct bilateral first,
 * then atomic self-cycle `[self, hub, friend, self]`. Never substitutes a plain
 * `[self, hub, friend]` payment because that would leave the bilateral debt open.
 */
export async function quoteSettleTabRoute<TRoute extends EverydaySendRoute = EverydaySendRoute>(params: {
  frame: RuntimeAdapterViewFrame | null | undefined;
  entityId: string;
  targetEntityId: string;
  tokenId: number;
  amount: bigint;
  primaryHubId: string | null;
  deriveDeltaFn: (delta: Delta, isLeft: boolean) => DerivedDelta;
  fetchRoutes: FetchEverydayRoutesFn<TRoute>;
  prepareCycleRoutes?: (() => Promise<void>) | undefined;
  noPathMessage?: string | undefined;
}): Promise<{ route: EverydaySendRoute; deliveryMode: PaymentDeliveryMode; targetEntityId: string }> {
  const direct = findDirectBilateralRoute({
    frame: params.frame,
    entityId: params.entityId,
    targetEntityId: params.targetEntityId,
    tokenId: params.tokenId,
    amount: params.amount,
    deriveDeltaFn: params.deriveDeltaFn,
  });
  const self = norm(params.entityId);
  const target = norm(params.targetEntityId);
  if (direct) {
    return { route: direct, deliveryMode: 'direct', targetEntityId: target };
  }
  await params.prepareCycleRoutes?.();
  if (params.primaryHubId) {
    try {
      const cycleRoutes = sortEverydayRoutes(
        await params.fetchRoutes({
          sourceEntityId: params.entityId,
          targetEntityId: params.entityId,
          tokenId: params.tokenId,
          amount: params.amount,
          fundingAccountId: params.primaryHubId,
        }),
      );
      const cycle = cycleRoutes.find(
        route => route.path.length >= 4 && norm(route.path[route.path.length - 2]) === target,
      );
      if (cycle) {
        return {
          route: cycle,
          deliveryMode: 'instant',
          targetEntityId: norm(cycle.path[cycle.path.length - 1]) || self,
        };
      }
    } catch (failure) {
      if (!isNoRouteError(failure)) throw failure;
    }
  }
  throw new Error(params.noPathMessage ?? 'No settlement path is available for this tab right now.');
}
