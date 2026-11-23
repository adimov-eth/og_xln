import { formatUsd, microToUsd, settledCashOf, usd } from './fixtures.ts';
import type { LoadedSurfaceSpec, ToolOutcome, WalletFixtureState } from '../types.ts';

function fail(phantomCategory: ToolOutcome['phantomCategory'], error: string): ToolOutcome {
  return { success: false, error, phantomCategory };
}

function ok(data: unknown): ToolOutcome {
  return { success: true, data };
}

function readNum(args: Record<string, unknown>, key: string): number | null {
  const v = args[key];
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null;
}

function readStr(args: Record<string, unknown>, key: string): string | null {
  const v = args[key];
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

function debitCashBuckets(s: WalletFixtureState, totalMicro: bigint): WalletFixtureState {
  let remaining = totalMicro;
  const takeSecured = remaining <= s.securedMicroUsd ? remaining : s.securedMicroUsd;
  remaining -= takeSecured;
  const takeReserve = remaining <= s.reserveMicroUsd ? remaining : s.reserveMicroUsd;
  remaining -= takeReserve;
  const takeOnchain = remaining <= s.onchainMicroUsd ? remaining : s.onchainMicroUsd;
  return {
    ...s,
    securedMicroUsd: s.securedMicroUsd - takeSecured,
    reserveMicroUsd: s.reserveMicroUsd - takeReserve,
    onchainMicroUsd: s.onchainMicroUsd - takeOnchain,
  };
}

function handlePay(s: WalletFixtureState, args: Record<string, unknown>): { state: WalletFixtureState; outcome: ToolOutcome } {
  const to = readStr(args, 'to') ?? readStr(args, 'recipient');
  const amountUsd = readNum(args, 'amount_usd') ?? readNum(args, 'amount');
  if (!to || amountUsd === null) {
    return { state: s, outcome: fail('validation', 'pay requires { to: string, amount_usd: positive number }.') };
  }
  const amountMicro = usd(amountUsd);
  const feeMicro = s.quotedFeeMicroUsd;
  if (feeMicro > s.maxFeeMicroUsd) {
    return {
      state: s,
      outcome: fail('runtime', `Fee ${formatUsd(feeMicro)} exceeds maxAcceptableFee ${formatUsd(s.maxFeeMicroUsd)} — payment blocked; Cash untouched.`),
    };
  }
  const totalMicro = amountMicro + feeMicro;
  const cashMicro = settledCashOf(s);
  if (cashMicro < totalMicro) {
    const msg = s.arrivingMicroUsd > 0n
      ? `Insufficient settled Cash (${formatUsd(cashMicro)}); ${formatUsd(s.arrivingMicroUsd)} is still arriving.`
      : `Insufficient Cash (${formatUsd(cashMicro)}) for ${formatUsd(totalMicro)}.`;
    return { state: s, outcome: fail('runtime', msg) };
  }
  const needsL1Sweep = amountMicro > s.securedMicroUsd + s.reserveMicroUsd;
  if (needsL1Sweep && s.l1SweepBehavior === 'reject') {
    const next = { ...s, l1SweepAttempted: true };
    return { state: next, outcome: fail('runtime', 'Auto-route L1 sweep rejected — your Cash was not touched.') };
  }
  const debited = debitCashBuckets(s, totalMicro);
  const next: WalletFixtureState = {
    ...debited,
    activity: [
      { id: `act-${s.activity.length + 1}`, summary: `Paid ${to} ${formatUsd(amountMicro)} (fee ${formatUsd(feeMicro)})`, kind: 'payment', amountMicroUsd: amountMicro },
      ...s.activity,
    ],
  };
  return {
    state: next,
    outcome: ok({ status: 'Sent', to, 'amount-usd': amountUsd, 'fee-usd': microToUsd(feeMicro), 'remaining-cash-usd': microToUsd(settledCashOf(next)) }),
  };
}

function handleCashOut(s: WalletFixtureState, args: Record<string, unknown>): { state: WalletFixtureState; outcome: ToolOutcome } {
  const amountUsd = readNum(args, 'amount_usd') ?? readNum(args, 'amount');
  if (amountUsd === null) return { state: s, outcome: fail('validation', 'cash-out requires { amount_usd: positive number }.') };
  const amountMicro = usd(amountUsd);
  if (settledCashOf(s) < amountMicro) {
    return { state: s, outcome: fail('runtime', `Insufficient Cash (${formatUsd(settledCashOf(s))}) for cash out.`) };
  }
  const next = debitCashBuckets(s, amountMicro);
  return { state: next, outcome: ok({ status: 'Cashed out', 'amount-usd': amountUsd, 'remaining-cash-usd': microToUsd(settledCashOf(next)) }) };
}

function handleSplitBill(s: WalletFixtureState, args: Record<string, unknown>): { state: WalletFixtureState; outcome: ToolOutcome } {
  const person = readStr(args, 'person') ?? readStr(args, 'friend');
  const totalUsd = readNum(args, 'total_usd') ?? readNum(args, 'amount_usd');
  if (!person || totalUsd === null) {
    return { state: s, outcome: fail('validation', 'split-bill requires { person: string, total_usd: positive number }.') };
  }
  const peer = s.peers.find(p => p.id.toLowerCase() === person.toLowerCase() || p.label.toLowerCase() === person.toLowerCase());
  if (!peer) return { state: s, outcome: fail('eval', `Unknown friend '${person}'.`) };
  if (peer.isHub) return { state: s, outcome: fail('runtime', `'${peer.label}' is a background payment rail, not a friend tab.`) };

  const customShare = readNum(args, 'friend_share_usd');
  const yourShare = readNum(args, 'your_share_usd');
  const shareUsd = customShare ?? (yourShare !== null ? totalUsd - yourShare : totalUsd / 2);
  if (shareUsd <= 0) return { state: s, outcome: fail('validation', 'Friend share must be positive.') };

  const shareMicro = usd(shareUsd);
  const note = readStr(args, 'note') ?? 'Shared bill';
  const nextPeers = s.peers.map(p => (p.id === peer.id ? { ...p, signedMicroUsd: p.signedMicroUsd + shareMicro, note } : p));
  const next: WalletFixtureState = {
    ...s,
    peers: nextPeers,
    activity: [{ id: `act-${s.activity.length + 1}`, summary: `Split ${formatUsd(usd(totalUsd))} with ${peer.label} (${note})`, kind: 'split', amountMicroUsd: shareMicro }, ...s.activity],
  };
  const updated = nextPeers.find(p => p.id === peer.id)!;
  return { state: next, outcome: ok({ status: 'Added to tab', friend: peer.label, 'friend-balance-usd': microToUsd(updated.signedMicroUsd) }) };
}

function handleSettleUp(s: WalletFixtureState, args: Record<string, unknown>): { state: WalletFixtureState; outcome: ToolOutcome } {
  const person = readStr(args, 'person') ?? readStr(args, 'friend');
  if (!person) return { state: s, outcome: fail('validation', 'settle-up requires { person: string }.') };
  const peer = s.peers.find(p => p.id.toLowerCase() === person.toLowerCase() || p.label.toLowerCase() === person.toLowerCase());
  if (!peer) return { state: s, outcome: fail('eval', `Unknown friend '${person}'.`) };
  if (peer.isHub) return { state: s, outcome: fail('runtime', `'${peer.label}' is a payment hub rail, not a friend tab.`) };
  if (peer.signedMicroUsd >= 0n) {
    return { state: s, outcome: fail('runtime', `You do not owe ${peer.label} anything right now.`) };
  }
  const owedMicro = -peer.signedMicroUsd;
  if (settledCashOf(s) < owedMicro) {
    return { state: s, outcome: fail('runtime', `Insufficient Cash (${formatUsd(settledCashOf(s))}) to settle ${formatUsd(owedMicro)}.`) };
  }
  const debited = debitCashBuckets(s, owedMicro);
  const next: WalletFixtureState = {
    ...debited,
    peers: debited.peers.map(p => (p.id === peer.id ? { ...p, signedMicroUsd: 0n } : p)),
    activity: [{ id: `act-${s.activity.length + 1}`, summary: `Settled up ${formatUsd(owedMicro)} with ${peer.label}`, kind: 'settle', amountMicroUsd: owedMicro }, ...s.activity],
  };
  return { state: next, outcome: ok({ status: 'All settled up', friend: peer.label, 'paid-usd': microToUsd(owedMicro), 'remaining-cash-usd': microToUsd(settledCashOf(next)) }) };
}

function handleAddSavings(s: WalletFixtureState, args: Record<string, unknown>): { state: WalletFixtureState; outcome: ToolOutcome } {
  const amountUsd = readNum(args, 'amount_usd') ?? readNum(args, 'amount');
  if (amountUsd === null) return { state: s, outcome: fail('validation', 'add-savings requires { amount_usd: positive number, accept_risk: true }.') };
  if (args.accept_risk !== true) {
    return { state: s, outcome: fail('runtime', 'Savings require explicit consent (accept_risk: true): Savings are lent to earn interest and are not protected like Cash.') };
  }
  const amountMicro = usd(amountUsd);
  if (settledCashOf(s) < amountMicro) return { state: s, outcome: fail('runtime', 'Insufficient Cash for Savings deposit.') };
  const debited = debitCashBuckets(s, amountMicro);
  const next: WalletFixtureState = {
    ...debited,
    savingsMicroUsd: debited.savingsMicroUsd + amountMicro,
    savingsRiskConsented: true,
    activity: [{ id: `act-${s.activity.length + 1}`, summary: `Moved ${formatUsd(amountMicro)} to Savings`, kind: 'savings', amountMicroUsd: amountMicro }, ...s.activity],
  };
  return { state: next, outcome: ok({ status: 'Earning interest in Savings', 'savings-usd': microToUsd(next.savingsMicroUsd), 'cash-usd': microToUsd(settledCashOf(next)) }) };
}

function handleMoveToCash(s: WalletFixtureState, args: Record<string, unknown>): { state: WalletFixtureState; outcome: ToolOutcome } {
  const amountUsd = readNum(args, 'amount_usd') ?? readNum(args, 'amount');
  if (amountUsd === null) return { state: s, outcome: fail('validation', 'move-to-cash requires { amount_usd: positive number }.') };
  const amountMicro = usd(amountUsd);
  if (s.savingsMicroUsd < amountMicro) return { state: s, outcome: fail('runtime', 'Insufficient Savings balance.') };
  const next: WalletFixtureState = {
    ...s,
    savingsMicroUsd: s.savingsMicroUsd - amountMicro,
    reserveMicroUsd: s.reserveMicroUsd + amountMicro,
  };
  return { state: next, outcome: ok({ status: 'Back in Cash', 'savings-usd': microToUsd(next.savingsMicroUsd), 'cash-usd': microToUsd(settledCashOf(next)) }) };
}

function handleExternalRequest(
  s: WalletFixtureState,
  args: Record<string, unknown>,
  approve: boolean,
): { state: WalletFixtureState; outcome: ToolOutcome } {
  const reqId = readStr(args, 'request_id') ?? readStr(args, 'id');
  if (!reqId) return { state: s, outcome: fail('validation', 'Requires { request_id: string }.') };
  const req = s.externalRequests.find(r => r.id === reqId);
  if (!req) return { state: s, outcome: fail('eval', `Unknown external request '${reqId}'.`) };
  if (req.status !== 'pending') return { state: s, outcome: fail('runtime', `Request '${reqId}' is already ${req.status}.`) };

  if (!approve) {
    const next = { ...s, externalRequests: s.externalRequests.map(r => (r.id === reqId ? { ...r, status: 'rejected' as const } : r)) };
    return { state: next, outcome: ok({ status: 'Rejected', request_id: reqId, origin: req.origin }) };
  }
  const totalMicro = req.amountMicroUsd + req.feeMicroUsd;
  if (settledCashOf(s) < totalMicro) return { state: s, outcome: fail('runtime', 'Insufficient Cash for external request.') };
  const debited = debitCashBuckets(s, totalMicro);
  const next: WalletFixtureState = {
    ...debited,
    externalRequests: debited.externalRequests.map(r => (r.id === reqId ? { ...r, status: 'approved' as const } : r)),
    activity: [{ id: `act-${s.activity.length + 1}`, summary: `Approved ${req.origin}: ${req.appClaim}`, kind: 'payment', amountMicroUsd: req.amountMicroUsd }, ...s.activity],
  };
  return { state: next, outcome: ok({ status: 'Approved', request_id: reqId, 'remaining-cash-usd': microToUsd(settledCashOf(next)) }) };
}

function handleRequestLink(s: WalletFixtureState, args: Record<string, unknown>): { state: WalletFixtureState; outcome: ToolOutcome } {
  const amountUsd = readNum(args, 'amount_usd') ?? readNum(args, 'amount');
  if (amountUsd === null) return { state: s, outcome: fail('validation', 'request-link requires { amount_usd: positive number, to?: string }.') };
  const recipient = readStr(args, 'to') ?? readStr(args, 'person') ?? 'anyone';
  const note = readStr(args, 'note') ?? '';
  const id = `reqlink-${s.requestLinks.length + 1}`;
  const url = `https://xln.app/#pay/everyday/${id}?amount=${amountUsd.toFixed(2)}`;
  const next: WalletFixtureState = {
    ...s,
    requestLinks: [...s.requestLinks, { id, recipientHint: recipient, amountMicroUsd: usd(amountUsd), note, url }],
    activity: [{ id: `act-${s.activity.length + 1}`, summary: `Created ${formatUsd(usd(amountUsd))} request link for ${recipient}`, kind: 'request', amountMicroUsd: usd(amountUsd) }, ...s.activity],
  };
  return { state: next, outcome: ok({ status: 'Request link ready', id, url, 'amount-usd': amountUsd, for: recipient }) };
}

function handleWaitSettlement(s: WalletFixtureState): { state: WalletFixtureState; outcome: ToolOutcome } {
  if (s.arrivingMicroUsd === 0n) {
    return { state: s, outcome: ok({ status: 'Nothing arriving', 'cash-usd': microToUsd(settledCashOf(s)), 'arriving-usd': 0 }) };
  }
  if (!s.hubOnline) {
    return {
      state: s,
      outcome: ok({
        status: 'Still finishing — payment provider is offline; arriving funds kept separate from Cash.',
        'cash-usd': microToUsd(settledCashOf(s)),
        'arriving-usd': microToUsd(s.arrivingMicroUsd),
      }),
    };
  }
  const settled = s.arrivingMicroUsd - s.autoSettleFeeMicroUsd;
  const next: WalletFixtureState = {
    ...s,
    arrivingMicroUsd: 0n,
    securedMicroUsd: s.securedMicroUsd + settled,
    activity: [{ id: `act-${s.activity.length + 1}`, summary: `Incoming ${formatUsd(settled)} settled into Cash (fee ${formatUsd(s.autoSettleFeeMicroUsd)})`, kind: 'payment', amountMicroUsd: settled }, ...s.activity],
  };
  return { state: next, outcome: ok({ status: 'Settled into Cash', 'cash-usd': microToUsd(settledCashOf(next)), 'arriving-usd': 0, 'fee-usd': microToUsd(s.autoSettleFeeMicroUsd) }) };
}

export function dispatchAction(
  state: WalletFixtureState,
  spec: LoadedSurfaceSpec,
  action: unknown,
  argsRaw: unknown,
): { state: WalletFixtureState; outcome: ToolOutcome } {
  if (typeof action !== 'string' || !action.trim()) {
    return { state, outcome: fail('validation', 'act requires non-empty string field "action".') };
  }
  const verb = action.trim();
  if (!spec.supportedActions.has(verb)) {
    return {
      state,
      outcome: fail('unknown_action', `Unknown action '${verb}'. Available actions: ${[...spec.supportedActions].join(', ')}`),
    };
  }
  if (typeof argsRaw === 'string') {
    return { state, outcome: fail('validation', 'args must be an object, not a JSON-encoded string.') };
  }
  const args = argsRaw && typeof argsRaw === 'object' && !Array.isArray(argsRaw) ? (argsRaw as Record<string, unknown>) : {};

  switch (verb) {
    case 'pay': return handlePay(state, args);
    case 'cash-out': return handleCashOut(state, args);
    case 'split-bill': return handleSplitBill(state, args);
    case 'settle-up': return handleSettleUp(state, args);
    case 'add-savings': return handleAddSavings(state, args);
    case 'move-to-cash': return handleMoveToCash(state, args);
    case 'approve-request': return handleExternalRequest(state, args, true);
    case 'reject-request': return handleExternalRequest(state, args, false);
    case 'request-link': return handleRequestLink(state, args);
    case 'wait-settlement': return handleWaitSettlement(state);
    case 'export-backup':
      return { state: { ...state, backupExported: true }, outcome: ok({ status: 'Encrypted backup exported', 'native-gas-wei': state.nativeGasWei.toString() }) };
    case 'reload-wallet':
      return { state: { ...state, reloadedAfterFailure: true }, outcome: ok({ status: 'Reloaded', 'cash-usd': microToUsd(settledCashOf(state)), 'arriving-usd': microToUsd(state.arrivingMicroUsd) }) };
    case 'clear-test-data':
      return { state: { ...state, activity: [], requestLinks: [] }, outcome: ok({ status: 'Test data cleared; login kept.' }) };
    default:
      return { state, outcome: fail('unknown_action', `Unknown action '${verb}'.`) };
  }
}
