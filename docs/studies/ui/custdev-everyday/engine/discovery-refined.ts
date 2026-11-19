import { formatUsd, microToUsd, settledCashOf } from './fixtures.ts';
import type { LoadedSurfaceSpec, WalletFixtureState } from '../types.ts';

interface RefinedActionSpec {
  action: string;
  args: string;
  quote?: string;
  note?: string;
}

const REFINED_ACTIONS: readonly RefinedActionSpec[] = [
  { action: 'pay', args: '{ to: string, amount_usd: number }', quote: '(quote-pay to amount_usd)', note: 'Check (quote-pay ...) first to verify fee cap and settled Cash.' },
  { action: 'cash-out', args: '{ amount_usd: number }', quote: '(quote-cash-out amount_usd)' },
  { action: 'request-link', args: '{ amount_usd: number, to?: string, note?: string }', note: 'Create a shareable payment request link.' },
  { action: 'split-bill', args: '{ person: string, total_usd: number, note?: string, friend_share_usd?: number, your_share_usd?: number }', note: 'Human friends only from (friends).' },
  { action: 'settle-up', args: '{ person: string }', note: 'Settle what you owe a human friend from (friends).' },
  { action: 'add-savings', args: '{ amount_usd: number, accept_risk: true }', note: 'Requires explicit accept_risk: true after reading (savings).' },
  { action: 'move-to-cash', args: '{ amount_usd: number }' },
  { action: 'approve-request', args: '{ request_id: string }', note: 'Inspect id and deltas via (pending-requests) first.' },
  { action: 'reject-request', args: '{ request_id: string }', note: 'Reject deceptive or unwanted requests from (pending-requests).' },
  { action: 'export-backup', args: '{}' },
  { action: 'wait-settlement', args: '{}' },
  { action: 'reload-wallet', args: '{}' },
  { action: 'clear-test-data', args: '{}' },
];

const EXTERNAL_ALIASES = new Set([
  'external-request', 'external-requests', 'requests', 'pending-requests',
  'pending-request', 'pending', 'request', 'checkout',
]);

const RECOVERY_ALIASES = new Set(['settings', 'recovery', 'safety', 'backup']);

export function renderFriends(s: WalletFixtureState) {
  return s.peers
    .filter(p => !p.isHub)
    .map(p => ({
      id: p.id,
      name: p.label,
      'balance-usd': microToUsd(p.signedMicroUsd),
      status:
        p.signedMicroUsd > 0n
          ? `${p.label} owes you ${formatUsd(p.signedMicroUsd)}`
          : p.signedMicroUsd < 0n
            ? `You owe ${p.label} ${formatUsd(-p.signedMicroUsd)}`
            : 'All settled up',
    }));
}

export function renderCashRefined(s: WalletFixtureState, spec: LoadedSurfaceSpec) {
  const cashUsd = microToUsd(settledCashOf(s));
  const arrivingUsd = microToUsd(s.arrivingMicroUsd);
  const transitRule = spec.defaults.find(d => d.id === 'bounded-hub-transit-buffer');
  const arrivingFig = spec.figures['arriving-cash'];
  const autoSettle = spec.autopilots['auto-settle-incoming'];
  return {
    'cash-usd': cashUsd,
    'cash-formatted': formatUsd(settledCashOf(s)),
    'arriving-usd': arrivingUsd,
    'arriving-formatted': arrivingUsd > 0 ? `+${formatUsd(s.arrivingMicroUsd)} arriving · finishing...` : '$0.00',
    'arriving-status': arrivingUsd > 0
      ? (autoSettle?.recoveryNote ?? 'Payment still finishing — we will keep retrying automatically.')
      : 'No incoming payments finishing.',
    'transit-policy': transitRule?.value ?? '$250 transit cap · $1 immediate auto-settle',
    note: spec.terms.cash?.note ?? 'Your money, ready to spend or cash out anytime.',
    ...(arrivingFig ? { 'arriving-note': arrivingFig.meaning } : {}),
  };
}

export function renderSavingsRefined(s: WalletFixtureState, spec: LoadedSurfaceSpec) {
  const rawNote = spec.terms.savings?.note ?? 'Lent to earn interest — NOT protected like Cash.';
  const normalized = rawNote.replace(/\bnot protected like Cash\b/i, 'NOT protected like Cash');
  const note = normalized.includes('accept_risk')
    ? normalized
    : `${normalized} Explicit accept_risk: true required.`;
  return {
    'balance-usd': microToUsd(s.savingsMicroUsd),
    'balance-formatted': formatUsd(s.savingsMicroUsd),
    apy: s.savingsApy,
    'consent-accepted': s.savingsRiskConsented,
    'consent-required': !s.savingsRiskConsented,
    'required-consent-param': { accept_risk: true },
    note,
  };
}

export function renderActivityRefined(s: WalletFixtureState, spec: LoadedSurfaceSpec) {
  const shield = spec.autopilots['auto-recovery-shield'];
  const onlineStatus = 'Protected · automatic backup & recovery service ready';
  const zeroGasStatus =
    'Recovery service guards against stale provider claims automatically, while starting a fresh user-initiated withdrawal requires network gas (0 ETH available).';
  const offlineStatus =
    s.nativeGasWei === 0n
      ? zeroGasStatus
      : (shield?.recoveryNote ?? 'Provider offline — automatic protection active.');
  return {
    entries: s.activity.map(a => ({ id: a.id, summary: a.summary, kind: a.kind, 'amount-usd': microToUsd(a.amountMicroUsd) })),
    'hub-online': s.hubOnline,
    'dispute-active': s.disputeActive,
    'tower-enrolled': s.towerEnrolled,
    'backup-exported': s.backupExported,
    'protection-status': s.hubOnline ? onlineStatus : offlineStatus,
    'native-gas-wei': s.nativeGasWei.toString(),
    'native-gas-eth': s.nativeGasWei === 0n ? '0 ETH' : `${s.nativeGasWei.toString()} wei`,
    ...(shield ? { 'recovery-shield-policy': shield.recoveryNote } : {}),
  };
}

export function renderScreenRefined(id: string, s: WalletFixtureState, spec: LoadedSurfaceSpec) {
  const sc = spec.screens[id];
  if (!sc) {
    const valid = Object.keys(spec.screens).join(', ');
    if (EXTERNAL_ALIASES.has(id)) {
      throw new Error(`No '${id}' screen. Inspect external links with (pending-requests) and use act('approve-request'|'reject-request', { request_id }). Available screens: ${valid}`);
    }
    if (id === 'savings') {
      throw new Error(`Unknown screen 'savings'. Use (screen 'earn) or (savings). Available screens: ${valid}`);
    }
    if (id === 'friends') {
      throw new Error(`Unknown screen 'friends'. Use (screen 'people) or (friends). Available screens: ${valid}`);
    }
    if (RECOVERY_ALIASES.has(id)) {
      throw new Error(`No '${id}' screen. Backup and recovery status live in (screen 'activity) or (activity); export backup with act('export-backup', {}). Available screens: ${valid}`);
    }
    if (spec.supportedActions.has(id)) {
      throw new Error(`'${id}' is an act() action, not a screen. Run (help '${id}) or (actions '${id}). Available screens: ${valid}`);
    }
    throw new Error(`Unknown screen '${id}'. Available screens: ${valid}`);
  }
  const labels = sc.actions.map(a => spec.flows[a]?.before ?? a);
  if (id === 'home') {
    const pending = s.externalRequests.filter(r => r.status === 'pending').length;
    return {
      id: sc.id,
      purpose: sc.purpose,
      cash: renderCashRefined(s, spec),
      buttons: labels,
      'pending-external-requests': pending,
      ...(pending > 0 ? { 'pending-requests-hint': 'Call (pending-requests) to inspect external request sheets.' } : {}),
    };
  }
  if (id === 'people') {
    return {
      id: sc.id,
      purpose: sc.purpose,
      friends: renderFriends(s),
      buttons: labels,
      'split-hint': 'Use split-bill { person, total_usd, note? } or settle-up { person }.',
    };
  }
  if (id === 'earn') {
    return { id: sc.id, purpose: sc.purpose, savings: renderSavingsRefined(s, spec), cash: renderCashRefined(s, spec), buttons: labels };
  }
  return { id: sc.id, purpose: sc.purpose, activity: renderActivityRefined(s, spec), buttons: labels };
}

export function renderActionsRefined(spec: LoadedSurfaceSpec, filter?: string) {
  const items = REFINED_ACTIONS.filter(item => spec.supportedActions.has(item.action));
  if (filter && filter.trim()) {
    const key = filter.trim().toLowerCase();
    const match = items.find(i => i.action === key);
    if (!match) {
      throw new Error(`Unknown action '${filter}'. Available actions: ${items.map(i => i.action).join(', ')}`);
    }
    return match;
  }
  return { actions: items, note: 'Invoke via act(action, args) with a non-empty intent.' };
}

export function renderHelpRefined(spec: LoadedSurfaceSpec, topic?: string | ((...args: unknown[]) => unknown)) {
  if (topic === undefined) {
    return {
      discovery: [
        '(screens)',
        "(screen 'home) | (screen 'people) | (screen 'earn) | (screen 'activity)",
        '(cash)',
        '(quote-pay "CornerCoffee" 65)',
        '(quote-cash-out 50)',
        '(friends)',
        '(savings)',
        '(activity)',
        '(pending-requests)',
        '(terms)',
        '(actions)',
        "(actions 'pay)",
        "(help 'split-bill)",
      ],
      note: 'Preview fees/Cash with (quote-pay ...) or (quote-cash-out ...) before acting; inspect external links with (pending-requests).',
    };
  }
  if (typeof topic === 'function') {
    return {
      topic: 'discovery-function',
      usage: "Call (screen 'home), (screen 'people), (screen 'earn), or (screen 'activity). Use quoted symbols like (help 'pay) for action schemas.",
      availableScreens: Object.keys(spec.screens),
      availableActions: [...spec.supportedActions],
    };
  }
  const key = topic.trim().toLowerCase();
  if (spec.supportedActions.has(key)) return renderActionsRefined(spec, key);
  const topicHelp: Record<string, unknown> = {
    screen: { usage: "(screen 'home) | (screen 'people) | (screen 'earn) | (screen 'activity)", availableScreens: Object.keys(spec.screens) },
    screens: { usage: '(screens)', availableScreens: Object.keys(spec.screens) },
    quote: { usage: '(quote-pay "Recipient" amount_usd) | (quote-cash-out amount_usd)' },
    'quote-pay': { usage: '(quote-pay "Recipient" amount_usd)', checks: ['fee cap', 'settled Cash', 'inline preview'] },
    'quote-cash-out': { usage: '(quote-cash-out amount_usd)' },
    cash: { usage: '(cash)', separates: ['cash-usd', 'arriving-usd', 'transit-policy'] },
    arriving: { usage: '(cash) + act("wait-settlement", {})', note: 'Arriving float stays separate from Cash until settled.' },
    'arriving-cash': { usage: '(cash)', note: 'Arriving float stays separate from Cash until settled.' },
    friends: { usage: '(friends) then act("split-bill", ...) or act("settle-up", ...)' },
    people: { usage: "(screen 'people) or (friends)" },
    savings: { usage: '(savings) then act("add-savings", { amount_usd, accept_risk: true })' },
    earn: { usage: "(screen 'earn) or (savings)" },
    activity: { usage: "(screen 'activity) or (activity); export backup with act(\"export-backup\", {})" },
    recovery: { usage: '(activity)', note: 'Check native-gas-eth and recovery-shield-policy; export backup with act("export-backup", {}).' },
    backup: { usage: 'act("export-backup", {})' },
    pending: { usage: '(pending-requests) then act("approve-request"|"reject-request", { request_id })' },
    'pending-requests': { usage: '(pending-requests) then act("approve-request"|"reject-request", { request_id })' },
    requests: { usage: '(pending-requests)' },
    'external-request': { usage: '(pending-requests) — external links appear as request sheets, not screens.' },
    actions: { usage: '(actions) or (actions \'pay)', availableActions: [...spec.supportedActions] },
    terms: { usage: '(terms)' },
  };
  return topicHelp[key] ?? {
    topic: key,
    note: 'Topic not found; showing available screens and actions.',
    availableScreens: Object.keys(spec.screens),
    availableActions: [...spec.supportedActions],
  };
}
