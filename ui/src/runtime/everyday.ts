import type { TokenDecimals } from '@xln/core/account/tx/units';
import type { EverydayExternalRow } from '@xln/frontend/lib/everyday/everyday-autopilot';
import type { EverydayWalletProjection } from '@xln/frontend/lib/everyday/everyday-projection';
import {
  parseWalletPostureParam,
  readWalletPosture,
  subscribeWalletPosture,
  writeWalletPosture,
  type WalletPosture,
} from '@xln/frontend/lib/everyday/wallet-posture';
import { formatMoney } from './format';

let latchedSearchMode: WalletPosture | null = null;
const postureListeners = new Set<() => void>();

const notifyPostureListeners = (): void => {
  for (const listener of postureListeners) listener();
};

export const parseModeParam = parseWalletPostureParam;

export function latchPostureFromSearch(search?: string): WalletPosture | null {
  const mode = parseModeParam(search);
  if (mode !== null && latchedSearchMode !== mode) {
    latchedSearchMode = mode;
    notifyPostureListeners();
  }
  return mode;
}

export function resetLatchedPosture(): void {
  if (latchedSearchMode === null) return;
  latchedSearchMode = null;
  notifyPostureListeners();
}

export function resolveEffectivePosture(search?: string): WalletPosture {
  const explicit = parseModeParam(search);
  if (explicit !== null) return explicit;
  if (latchedSearchMode !== null) return latchedSearchMode;
  return readWalletPosture('');
}

export function setPersistedWalletPosture(posture: WalletPosture): void {
  latchedSearchMode = null;
  writeWalletPosture(posture);
}

export function subscribeEffectivePosture(listener: () => void): () => void {
  postureListeners.add(listener);
  const unsubscribeBase = subscribeWalletPosture(() => listener());
  return () => {
    postureListeners.delete(listener);
    unsubscribeBase();
  };
}

export function withPostureQuery(to: string, search?: string): string {
  const mode = parseModeParam(search) ?? latchedSearchMode;
  if (mode === null) return to;
  const hashIndex = to.indexOf('#');
  const base = hashIndex >= 0 ? to.slice(0, hashIndex) : to;
  const hash = hashIndex >= 0 ? to.slice(hashIndex) : '';
  const queryIndex = base.indexOf('?');
  const pathname = queryIndex >= 0 ? base.slice(0, queryIndex) : base;
  const params = new URLSearchParams(queryIndex >= 0 ? base.slice(queryIndex + 1) : '');
  if (!params.has('mode')) params.set('mode', mode);
  const query = params.toString();
  return `${pathname}${query ? `?${query}` : ''}${hash}`;
}

export function stripModeParam(search: string): string {
  const normalized = search.startsWith('?') ? search.slice(1) : search;
  const params = new URLSearchParams(normalized);
  if (!params.has('mode')) return search;
  params.delete('mode');
  const next = params.toString();
  return next ? `?${next}` : '';
}

export type ExternalBalanceInputRow = {
  address: string;
  tokenId: number;
  balance: bigint;
  allowance: bigint | null;
  error?: string;
};

export function toEverydayExternalRows(
  rows: readonly ExternalBalanceInputRow[] | null | undefined,
): EverydayExternalRow[] {
  if (!rows) return [];
  return rows
    .filter(row => !row.error)
    .map(row => ({
      tokenAddress: row.address,
      tokenId: row.tokenId,
      balance: row.balance,
      allowance: row.allowance,
    }));
}

export function emptyEverydayProjection(
  entityId: string | null,
  primaryTokenId = 1,
): EverydayWalletProjection {
  const normalized = String(entityId || '').trim().toLowerCase();
  const primary = {
    cash: 0n,
    arriving: 0n,
    savings: 0n,
    friendTabs: [],
    friendsOweYou: 0n,
    youOweFriends: 0n,
  };
  return {
    entityId: normalized,
    signerId: null,
    jurisdiction: null,
    primaryTokenId,
    primary,
    byToken: new Map([[primaryTokenId, { tokenId: primaryTokenId, ...primary }]]),
    friendTabs: [],
    hubAccounts: [],
    disputes: [],
    primaryHubId: null,
    hasZeroL1Gas: false,
  };
}

export function formatEverydayAmount(
  amount: bigint,
  meta: { symbol: string; decimals: TokenDecimals },
  usdStable: boolean,
): string {
  const formatted = formatMoney(amount, meta.decimals);
  return usdStable ? `$${formatted}` : `${formatted} ${meta.symbol}`;
}
