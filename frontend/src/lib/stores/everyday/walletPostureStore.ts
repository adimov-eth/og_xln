import type { Readable } from 'svelte/store';
import { replaceState } from '$app/navigation';
import {
  parseWalletPostureParam,
  readWalletPosture,
  subscribeWalletPosture,
  writeWalletPosture,
  type WalletPosture,
} from '#lib/everyday/wallet-posture.ts';

export type { WalletPosture };

const subscribers = new Set<(value: WalletPosture) => void>();
let stopExternalSubscription: (() => void) | null = null;
let currentPosture: WalletPosture = readWalletPosture();

const publishPosture = (next: WalletPosture): void => {
  if (next === currentPosture) return;
  currentPosture = next;
  for (const listener of subscribers) listener(currentPosture);
};

export const walletPosture: Readable<WalletPosture> = {
  subscribe(run) {
    currentPosture = readWalletPosture();
    subscribers.add(run);
    if (subscribers.size === 1) {
      stopExternalSubscription = subscribeWalletPosture(publishPosture);
    }
    run(currentPosture);
    return () => {
      subscribers.delete(run);
      if (subscribers.size === 0) {
        stopExternalSubscription?.();
        stopExternalSubscription = null;
      }
    };
  },
};

export function resolveEffectivePosture(storePosture: WalletPosture, search = ''): WalletPosture {
  return parseWalletPostureParam(search) ?? storePosture;
}

export function setWalletPosture(next: WalletPosture): void {
  if (typeof window !== 'undefined') {
    const url = new URL(window.location.href);
    const currentParam = url.searchParams.get('mode')?.trim().toLowerCase();
    if (url.searchParams.has('mode') && currentParam !== next) {
      url.searchParams.delete('mode');
      const cleaned = `${url.pathname}${url.search}${url.hash}`;
      try {
        replaceState(cleaned, window.history.state ?? {});
      } catch {
        window.history.replaceState(window.history.state, '', cleaned);
      }
    }
  }
  writeWalletPosture(next);
}
