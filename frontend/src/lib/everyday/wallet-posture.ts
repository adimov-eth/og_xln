export type WalletPosture = 'everyday' | 'pro';

export const WALLET_POSTURE_STORAGE_KEY = 'xln-wallet-posture';

const listeners = new Set<(posture: WalletPosture) => void>();

export function parseWalletPostureParam(search?: string): WalletPosture | null {
  const raw =
    search !== undefined
      ? search
      : typeof window !== 'undefined'
        ? window.location.search
        : '';
  if (!raw) return null;
  const normalized = raw.startsWith('?') ? raw.slice(1) : raw;
  const mode = new URLSearchParams(normalized).get('mode')?.trim().toLowerCase();
  if (mode === 'pro') return 'pro';
  if (mode === 'everyday') return 'everyday';
  return null;
}

export function readWalletPosture(search?: string): WalletPosture {
  const paramMode = parseWalletPostureParam(search);
  if (paramMode !== null) return paramMode;
  if (typeof localStorage !== 'undefined') {
    try {
      if (localStorage.getItem(WALLET_POSTURE_STORAGE_KEY) === 'pro') return 'pro';
    } catch {
      // Storage may be unavailable in restricted contexts; default remains everyday.
    }
  }
  return 'everyday';
}

export function writeWalletPosture(posture: WalletPosture): void {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(WALLET_POSTURE_STORAGE_KEY, posture);
  }
  const effective = readWalletPosture();
  for (const listener of listeners) {
    listener(effective);
  }
}

export function subscribeWalletPosture(listener: (posture: WalletPosture) => void): () => void {
  listeners.add(listener);
  if (typeof window === 'undefined') {
    return () => {
      listeners.delete(listener);
    };
  }
  const onStorage = (event: StorageEvent): void => {
    if (event.key === null || event.key === WALLET_POSTURE_STORAGE_KEY) {
      listener(readWalletPosture());
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}
