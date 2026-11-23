import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  inspectHubRebalanceStatus,
  type HubRebalanceInspection,
} from '@xln/frontend/lib/everyday/everyday-policy';
import {
  projectEverydayWallet,
  type EverydayDisputeNotice,
  type EverydayWalletProjection,
} from '@xln/frontend/lib/everyday/everyday-projection';
import {
  classifyRecoveryShieldState,
  type RecoveryShieldCategory,
} from '@xln/frontend/lib/everyday/everyday-recovery';
import { getOpenAccountRebalancePolicyData } from '@xln/frontend/lib/utils/onboarding/onboardingPreferences';
import type { WalletPosture } from '@xln/frontend/lib/everyday/wallet-posture';
import { asTokenId } from '@xln/core/protocol/units';
import {
  emptyEverydayProjection,
  formatEverydayAmount,
  latchPostureFromSearch,
  parseModeParam,
  resolveEffectivePosture,
  setPersistedWalletPosture,
  stripModeParam,
  subscribeEffectivePosture,
  withPostureQuery,
} from './everyday';
import { isUsdStable } from './financial/prices';
import {
  readRecoveryShieldStatus,
  subscribeRecoveryShieldStatus,
} from './recovery';
import { useApp } from './store';
import { getTokenMeta } from './token-meta';
import { useWallet, type WalletView } from './views';
import { peekXLN } from './xln-loader';

export function useWalletPosture(): {
  posture: WalletPosture;
  setPosture: (next: WalletPosture) => void;
  preserveModeTo: (to: string) => string;
} {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    latchPostureFromSearch(location.search);
  }, [location.search]);

  const posture = useSyncExternalStore<WalletPosture>(
    subscribeEffectivePosture,
    () => resolveEffectivePosture(location.search),
    () => 'everyday',
  );

  const setPosture = useCallback(
    (next: WalletPosture) => {
      setPersistedWalletPosture(next);
      if (parseModeParam(location.search) !== null) {
        void navigate(
          { pathname: location.pathname, search: stripModeParam(location.search) },
          { replace: true },
        );
      }
    },
    [location.pathname, location.search, navigate],
  );

  const preserveModeTo = useCallback(
    (to: string) => withPostureQuery(to, location.search),
    [location.search],
  );

  return { posture, setPosture, preserveModeTo };
}

export function useRecoveryShieldNotice(
  disputes: readonly Pick<EverydayDisputeNotice, 'needsL1GasForUnilateralExit'>[],
  hasZeroL1Gas: boolean,
): { category: RecoveryShieldCategory; summary: string } {
  const activeVaultId = useApp(state => state.activeVaultId);
  const shieldStatus = useSyncExternalStore(
    subscribeRecoveryShieldStatus,
    () => readRecoveryShieldStatus(activeVaultId),
    () => null,
  );
  return useMemo(
    () => classifyRecoveryShieldState({ shieldStatus, disputes, hasZeroL1Gas }),
    [shieldStatus, disputes, hasZeroL1Gas],
  );
}

export function formatEverydayMoney(amount: bigint, tokenId: number): string {
  const meta = getTokenMeta(tokenId);
  return formatEverydayAmount(amount, meta, isUsdStable(tokenId));
}

export function useEverydayWallet(
  entityId: string | null,
  tokenId?: number,
): {
  wallet: WalletView;
  projection: EverydayWalletProjection;
  hubRebalance: HubRebalanceInspection | null;
  shield: { category: RecoveryShieldCategory; summary: string };
} {
  const { posture } = useWalletPosture();
  const wallet = useWallet(entityId);
  const externalWallet = useApp(state => state.externalWallet);
  const selectedTokenId = useApp(state => state.selectedTokenId);
  const primaryTokenId = tokenId ?? selectedTokenId;
  const xln = peekXLN();

  const projection = useMemo<EverydayWalletProjection>(() => {
    if (!xln || !wallet.frame) return emptyEverydayProjection(entityId, primaryTokenId);
    return projectEverydayWallet({
      frame: wallet.frame,
      entityId: wallet.entityId,
      externalRows: externalWallet?.rows,
      nativeBalance: externalWallet?.native ?? null,
      primaryTokenId,
      deriveDeltaFn: xln.deriveDelta,
    });
  }, [xln, wallet.frame, wallet.entityId, entityId, externalWallet, primaryTokenId]);

  const hubRebalance = useMemo<HubRebalanceInspection | null>(() => {
    if (!xln || !projection.primaryHubId || projection.primary.arriving <= 0n) return null;
    const hub = wallet.accounts.find(
      account => account.counterpartyId === projection.primaryHubId,
    );
    if (!hub) return null;
    const policy = getOpenAccountRebalancePolicyData(asTokenId(primaryTokenId), posture);
    if (!policy) return null;
    return inspectHubRebalanceStatus({
      doc: hub.doc,
      isLeft: hub.isLeft,
      tokenId: primaryTokenId,
      policy: {
        r2cRequestSoftLimit: policy.r2cRequestSoftLimit,
        hardLimit: policy.hardLimit,
        maxAcceptableFee: policy.maxAcceptableFee,
      },
      deriveDeltaFn: xln.deriveDelta,
    });
  }, [xln, projection.primaryHubId, projection.primary.arriving, wallet.accounts, primaryTokenId, posture]);

  const shield = useRecoveryShieldNotice(projection.disputes, projection.hasZeroL1Gas);

  return { wallet, projection, hubRebalance, shield };
}
