import { safeStringify } from '@xln/core/protocol/serialization';
import type { EntityTx } from '@xln/core/types/entity-tx';
import { proposalTxFact, type ProposalFact } from './proposal-facts';

/**
 * The sign sheet as data both wallets render, for one batch the person may sign.
 *
 * Every fact, row and button is read from the batch the wallet will send; the sheet never sees
 * a second copy. The requester's own words are kept apart as `note` and never feed a fact, a
 * row or a button. Counterparties appear as shortened keys: no name the counterparty gave itself.
 */

export type SignSheetToken = Readonly<{ symbol: string; decimals: number }>;

export type SignSheetSource = Readonly<{
  /** Token display metadata; null leaves the amount in raw units with the token number. */
  token: (tokenId: number) => SignSheetToken | null;
  /** Whether this Entity has an account with the counterparty. */
  hasAccount: (counterpartyEntityId: string) => boolean;
  /** The signed limit on what the counterparty may owe this Entity; null when there is no signed account frame. */
  extendedCreditLimit: (counterpartyEntityId: string, tokenId: number) => bigint | null;
  /** What this Entity can send through that Account now; null when there is no signed account frame. */
  sendCapacity: (counterpartyEntityId: string, tokenId: number) => bigint | null;
  /** The Account's committed off-chain delta; null when there is no signed account frame. */
  offdelta: (counterpartyEntityId: string, tokenId: number) => bigint | null;
}>;

type SignSheetAccount<Delta> = Readonly<{
  currentFrame?: Readonly<{ height: number }> | null;
  state: Readonly<{ deltas: ReadonlyMap<number, Delta> }>;
}>;

/**
 * The source both wallets build from their Entity replica. The extended limit is the signed one:
 * an account with no committed frame has none, and the sheet says so instead of guessing.
 */
export const signSheetSourceFromAccounts = <Delta extends Readonly<{ offdelta: bigint }>>(
  entityId: string,
  accounts: ReadonlyMap<string, SignSheetAccount<Delta>>,
  deps: Readonly<{
    token: SignSheetSource['token'];
    deriveDelta: (delta: Delta, isLeft: boolean) => Readonly<{ peerCreditLimit: bigint; outCapacity: bigint }>;
  }>,
): SignSheetSource => {
  const self = entityId.trim().toLowerCase();
  const byCounterparty = new Map([...accounts].map(([key, account]) => [key.trim().toLowerCase(), account]));
  const signedDelta = (counterparty: string, tokenId: number): Delta | null => {
    const account = byCounterparty.get(counterparty.trim().toLowerCase());
    if (!account || !account.currentFrame || account.currentFrame.height <= 0) return null;
    return account.state.deltas.get(tokenId) ?? null;
  };
  const derived = (counterparty: string, tokenId: number) => {
    const delta = signedDelta(counterparty, tokenId);
    return delta === null ? null : deps.deriveDelta(delta, self < counterparty.trim().toLowerCase());
  };
  return {
    token: deps.token,
    hasAccount: counterparty => byCounterparty.has(counterparty.trim().toLowerCase()),
    extendedCreditLimit: (counterparty, tokenId) => derived(counterparty, tokenId)?.peerCreditLimit ?? null,
    sendCapacity: (counterparty, tokenId) => derived(counterparty, tokenId)?.outCapacity ?? null,
    offdelta: (counterparty, tokenId) => signedDelta(counterparty, tokenId)?.offdelta ?? null,
  };
};

export type SignSheetParty = Readonly<{ entityId: string; fingerprint: string; hasAccount: boolean }>;

export type SignSheetFact = Readonly<{
  verb: string;
  /** Formatted amount, or null when the fact carries none. */
  amount: string | null;
  preposition: 'to' | 'with' | null;
  party: SignSheetParty | null;
}>;

export type SignSheetRow = Readonly<{ label: string; was: string; now: string; tone: 'risk' | 'plain' }>;

export type SignSheetHoldReason = 'raises-exposure' | 'no-account' | 'unmodelled' | 'several';

export type SignSheetView = Readonly<{
  /** The request's identity: its nonce. */
  id: string;
  /** Who asks, as the person labelled them when pinning, else a shortened key. */
  requester: string;
  /** One line on where this came from and until when it can be signed. */
  origin: string;
  /** One per transaction, in batch order. */
  facts: readonly SignSheetFact[];
  rows: readonly SignSheetRow[];
  /** One plain sentence when the change raises what this Entity could lose. */
  consequence: string | null;
  /** Steel notices: facts about the counterparty that the person should see before signing. */
  notices: readonly string[];
  /** The requester's own words. Untrusted: render as plain text under its label. */
  note: string | null;
  hold: Readonly<{ required: boolean; reasons: readonly SignSheetHoldReason[]; hint: string | null }>;
  /** Why Sign is not offered: a change that cannot commit is not something to sign. */
  blocked: string | null;
  primaryLabel: string;
  /** The keyboard and assistive-technology path: the first activation arms, the second signs. */
  armedLabel: string;
  terms: ReadonlyArray<readonly [string, string]>;
}>;

export const fingerprint = (value: string): string => {
  const text = value.trim().toLowerCase();
  return text.length > 14 ? `${text.slice(0, 6)}…${text.slice(-4)}` : text;
};

const groupThousands = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

/** Exact amount in token units, always with cents, never rounded. An unknown token stays in raw units. */
export const formatSignSheetAmount = (amount: bigint, tokenId: number, token: SignSheetToken | null): string => {
  if (!token) return `${groupThousands(amount.toString())} units of token ${tokenId}`;
  const negative = amount < 0n;
  const raw = (negative ? -amount : amount).toString().padStart(token.decimals + 1, '0');
  const whole = raw.slice(0, raw.length - token.decimals) || '0';
  const fraction = raw.slice(raw.length - token.decimals).replace(/0+$/, '').padEnd(Math.min(2, token.decimals), '0');
  const text = fraction ? `${groupThousands(whole)}.${fraction}` : groupThousands(whole);
  return `${negative ? '-' : ''}${text} ${token.symbol}`;
};

/** "Expires in 2 h", from the signed expiry. */
export const formatExpiry = (expiresAt: number, now: number): string => {
  const left = expiresAt - now;
  if (left <= 0) return 'Expired';
  const minutes = Math.ceil(left / 60_000);
  if (minutes < 60) return `Expires in ${minutes} min`;
  const hours = Math.round(minutes / 60);
  return hours < 48 ? `Expires in ${hours} h` : `Expires in ${Math.round(hours / 24)} days`;
};

const holdHints: Record<SignSheetHoldReason, string> = {
  several: 'This signs several changes at once: hold for one second.',
  unmodelled: 'Part of this cannot be shown as a plain fact. Read the exact terms, then hold for one second.',
  'raises-exposure': 'This raises what you could lose: hold for one second.',
  'no-account': 'You have no account with this key: hold for one second.',
};

type FactReading = {
  fact: SignSheetFact;
  rows: SignSheetRow[];
  consequence: string | null;
  notices: string[];
  holds: SignSheetHoldReason[];
  action: string;
  blocked: string | null;
};

const party = (entityId: string, source: SignSheetSource): SignSheetParty => ({
  entityId,
  fingerprint: fingerprint(entityId),
  hasAccount: source.hasAccount(entityId),
});

const noAccountNotice = 'You have no account with this key.';

const readFact = (fact: ProposalFact, source: SignSheetSource): FactReading => {
  const amountOf = (amount: bigint, tokenId: number) => formatSignSheetAmount(amount, tokenId, source.token(tokenId));
  switch (fact.kind) {
    case 'pay':
    case 'pay-locked': {
      const to = party(fact.counterpartyEntityId, source);
      const amount = amountOf(fact.amount, fact.tokenId);
      const notices = to.hasAccount ? [] : [noAccountNotice];
      const rows: SignSheetRow[] = [];
      let blocked: string | null = null;
      if (fact.kind === 'pay') {
        // The batch runs against the state at commit time: a payment the Account cannot carry
        // then fails and nothing moves, so the sheet shows the exact room before the press.
        const via = fact.viaEntityId;
        const capacity = source.sendCapacity(via, fact.tokenId);
        const label = via === to.entityId ? `You can send to ${to.fingerprint}` : `You can send through ${fingerprint(via)}`;
        if (capacity === null) {
          blocked = 'There is no signed account to send this through, so there is nothing to sign yet.';
        } else if (capacity < fact.amount) {
          rows.push({ label, was: amountOf(capacity, fact.tokenId), now: 'not enough', tone: 'plain' });
          blocked = 'This account cannot carry this payment now, so there is nothing to sign yet.';
        } else {
          rows.push({ label, was: amountOf(capacity, fact.tokenId), now: amountOf(capacity - fact.amount, fact.tokenId), tone: 'plain' });
        }
      } else {
        notices.push(`Your side is debited at most ${amountOf(fact.maxSenderDebit, fact.tokenId)}, fees included.`);
      }
      return {
        fact: { verb: 'Pay', amount, preposition: 'to', party: to },
        rows,
        consequence: null,
        notices,
        holds: to.hasAccount ? [] : ['no-account'],
        action: `pay ${amount}`,
        blocked,
      };
    }
    case 'credit-limit': {
      const to = party(fact.counterpartyEntityId, source);
      const was = source.extendedCreditLimit(fact.counterpartyEntityId, fact.tokenId);
      const now = amountOf(fact.amount, fact.tokenId);
      const raises = was === null || fact.amount > was;
      return {
        fact: { verb: `Let ${to.fingerprint} owe you up to`, amount: now, preposition: null, party: to },
        rows: [{ label: `${to.fingerprint} can owe you`, was: was === null ? 'no signed limit' : amountOf(was, fact.tokenId), now, tone: 'risk' }],
        consequence: raises ? `If ${to.fingerprint} never pays, you could lose up to ${now}.` : null,
        notices: to.hasAccount ? [] : [noAccountNotice],
        holds: raises ? ['raises-exposure'] : [],
        action: raises ? `raise to ${now}` : `lower to ${now}`,
        blocked: null,
      };
    }
    case 'open-account':
    case 'other':
      return {
        fact: { verb: `Change not shown here: ${fact.kind === 'other' ? fact.txType : 'openAccount'}`, amount: null, preposition: null, party: null },
        rows: [],
        consequence: null,
        notices: [],
        holds: ['unmodelled'],
        action: 'sign',
        blocked: null,
      };
  }
};

const capitalize = (text: string): string => text.charAt(0).toUpperCase() + text.slice(1);

export type SignSheetRequest = Readonly<{
  id: string;
  requester: string;
  origin: string;
  txs: readonly EntityTx[];
  note: string | null;
  terms: ReadonlyArray<readonly [string, string]>;
}>;

/** The sheet for one batch. `request.txs` is the exact batch the wallet sends on Sign. */
export const buildSignSheet = (request: SignSheetRequest, source: SignSheetSource): SignSheetView => {
  const readings = request.txs.map(tx => readFact(proposalTxFact(tx), source));
  const reasons = new Set<SignSheetHoldReason>(readings.flatMap(reading => reading.holds));
  if (readings.length > 1) reasons.add('several');
  const ordered = (['several', 'unmodelled', 'raises-exposure', 'no-account'] as const).filter(reason => reasons.has(reason));
  const required = ordered.length > 0;
  const action = readings.length === 1 ? readings[0]!.action : `sign ${readings.length} changes`;
  const consequences = readings.map(reading => reading.consequence).filter((line): line is string => line !== null);
  return {
    id: request.id,
    requester: request.requester,
    origin: request.origin,
    facts: readings.map(reading => reading.fact),
    rows: readings.flatMap(reading => reading.rows),
    consequence: consequences.length > 0 ? consequences.join(' ') : null,
    notices: [...new Set(readings.flatMap(reading => reading.notices))],
    note: request.note,
    hold: { required, reasons: ordered, hint: required ? holdHints[ordered[0]!] : null },
    blocked: readings.find(reading => reading.blocked !== null)?.blocked ?? null,
    primaryLabel: required ? `Hold to ${action}` : capitalize(action),
    armedLabel: `Press again to ${action}`,
    terms: [...request.terms, ...request.txs.map((tx, index) => [`tx ${index + 1}`, `${tx.type} ${safeStringify(tx.data)}`] as const)],
  };
};

/** What committed state must show before the sheet may say a change happened. */
export type SignSheetBaseline = ReadonlyArray<bigint | null>;

export const captureSignBaseline = (txs: readonly EntityTx[], source: SignSheetSource): SignSheetBaseline =>
  txs.map(tx => (tx.type === 'directPayment' ? source.offdelta(tx.data.route[1] ?? tx.data.targetEntityId, tx.data.tokenId) : null));

/**
 * Read from committed state, never from the send returning. A credit change is done when the
 * signed limit equals the requested one; a direct payment is done when the Account's committed
 * delta moved by exactly its amount.
 */
export const batchCommitted = (txs: readonly EntityTx[], baseline: SignSheetBaseline, source: SignSheetSource): boolean =>
  txs.every((tx, index) => {
    if (tx.type === 'extendCredit') return source.extendedCreditLimit(tx.data.counterpartyEntityId, tx.data.tokenId) === tx.data.amount;
    if (tx.type === 'directPayment') {
      const before = baseline[index];
      const after = source.offdelta(tx.data.route[1] ?? tx.data.targetEntityId, tx.data.tokenId);
      if (before === null || before === undefined || after === null) return false;
      const moved = after - before;
      return moved === tx.data.amount || moved === -tx.data.amount;
    }
    return false;
  });
