export const EVERYDAY_COPY = {
  terms: {
    cash: { label: 'Cash', note: 'Your money, ready to spend or cash out anytime.' },
    arriving: { label: 'Arriving', note: 'Finishing automatically before it joins your Cash.' },
    people: { label: 'Friends & tabs', note: 'Shared bills and tabs with people you know.' },
    owed: { label: 'You owe', note: 'Settle up in one tap whenever you are ready.' },
    savings: {
      label: 'Savings',
      note: 'Lent to earn interest — not protected like Cash; separate from Cash and requires explicit consent.',
    },
  },
  flows: {
    pay: { before: 'Pay', pending: 'Sending...', done: 'Sent', failed: 'Not sent — your Cash is untouched.' },
    requestLink: {
      before: 'Request',
      pending: 'Creating request link...',
      done: 'Request link ready to share',
      failed: 'Could not create request link.',
    },
    settleTab: {
      before: 'Settle up',
      pending: 'Settling tab...',
      done: 'All settled up',
      failed: 'Could not reach them — tab unchanged.',
    },
    splitTab: {
      before: 'Split a bill',
      pending: 'Sharing split...',
      done: 'Added to tab',
      failed: 'Split cancelled.',
    },
    cashOut: {
      before: 'Cash out',
      pending: 'Sending to your account...',
      done: 'Cashed out',
      failed: 'Cash out cancelled — balance unchanged.',
    },
    saveIn: {
      before: 'Add to Savings',
      pending: 'Moving to Savings...',
      done: 'Earning interest in Savings',
      failed: 'Stayed in Cash.',
    },
    saveOut: {
      before: 'Move to Cash',
      pending: 'Moving back to Cash...',
      done: 'Back in Cash',
      failed: 'Still in Savings — safe to retry.',
    },
    resetDemo: {
      before: 'Clear test data',
      pending: 'Clearing test data...',
      done: 'Test data cleared; login kept.',
      failed: 'Nothing changed.',
    },
  },
  externalRequestSheet: {
    survival: 'Completed payments are final; shared tabs stay between you and the person you named.',
    warns: ['Only open a tab with someone you actually know and trust.'],
  },
} as const;

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

export type SplitMoneyDisplay = {
  readonly major: string;
  readonly minor: string;
  readonly suffix: string;
};

/**
 * Splits a formatted money string (`$99.89`, `1.25 ETH`) into whole, fractional,
 * and trailing-unit spans so UI surfaces can render raised tabular cents while
 * keeping `innerText` identical to the original formatted string.
 */
export function splitMoneyDisplay(formatted: string): SplitMoneyDisplay {
  const match = formatted.match(/^([^\d.]*[\d,]+)(\.\d+)(.*)$/);
  if (!match) return { major: formatted, minor: '', suffix: '' };
  return { major: match[1] ?? formatted, minor: match[2] ?? '', suffix: match[3] ?? '' };
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
