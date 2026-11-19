import { arrival } from '../../surfaces/dsl.ts';
import {
  renderActionsRefined,
  renderActivityRefined,
  renderCashRefined,
  renderFriends,
  renderHelpRefined,
  renderSavingsRefined,
  renderScreenRefined,
} from './discovery-refined.ts';
import { formatUsd, microToUsd, settledCashOf } from './fixtures.ts';
import type { LoadedSurfaceSpec, PhantomCategory, ToolOutcome, WalletFixtureState } from '../types.ts';

const { ArrivalError, EnvCapability, LexicalScope, exec, symbol, z } = arrival;

export interface DiscoverySession {
  evalExpr: (expr: string) => Promise<{ outcome: ToolOutcome; defines: string[] }>;
  allDefines: () => string[];
}

function classifySchemeError(err: unknown): PhantomCategory {
  if (!(err instanceof Error)) return 'eval';
  if (err.name === 'AbortError' || err.name === 'TimeoutError' || /budget exceeded/i.test(err.message)) {
    return 'timeout';
  }
  const ctorName = err.constructor?.name ?? '';
  if (/ParseError|Unterminated/i.test(err.name) || /ParseError|Unterminated/i.test(ctorName) || /^(?:Parser|Reader):|unterminated|eof/i.test(err.message)) {
    return 'parse';
  }
  if (err instanceof ArrivalError || /UnboundVariable|EvalError|ArrivalError/i.test(err.name)) {
    return 'eval';
  }
  return 'eval';
}

function extractDefineForms(expr: string): string[] {
  const defines: string[] = [];
  let depth = 0;
  let start = -1;
  let inString = false;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === '"' && expr[i - 1] !== '\\') inString = !inString;
    if (inString) continue;
    if (ch === '(') {
      if (depth === 0) start = i;
      depth++;
    } else if (ch === ')') {
      depth--;
      if (depth === 0 && start >= 0) {
        const form = expr.slice(start, i + 1).trim();
        if (/^\(\s*define\b/i.test(form)) defines.push(form);
        start = -1;
      }
    }
  }
  return defines;
}

function renderCash(s: WalletFixtureState, spec: LoadedSurfaceSpec) {
  if (spec.mode === 'refined') return renderCashRefined(s, spec);
  const cashUsd = microToUsd(settledCashOf(s));
  const arrivingUsd = microToUsd(s.arrivingMicroUsd);
  return {
    'cash-usd': cashUsd,
    'cash-formatted': formatUsd(settledCashOf(s)),
    note: spec.terms.cash?.note ?? 'Your money, ready to spend or cash out anytime.',
    ...(arrivingUsd > 0 ? { 'incoming-status': spec.autopilots['auto-settle-incoming']?.recoveryNote ?? 'Payment still finishing.' } : {}),
  };
}

function renderSavings(s: WalletFixtureState, spec: LoadedSurfaceSpec) {
  if (spec.mode === 'refined') return renderSavingsRefined(s, spec);
  return {
    'balance-usd': microToUsd(s.savingsMicroUsd),
    'balance-formatted': formatUsd(s.savingsMicroUsd),
    apy: s.savingsApy,
    'consent-accepted': s.savingsRiskConsented,
    note: spec.terms.savings?.note ?? 'Earning interest separately from your Cash.',
  };
}

function renderActivity(s: WalletFixtureState, spec: LoadedSurfaceSpec) {
  if (spec.mode === 'refined') return renderActivityRefined(s, spec);
  const shield = spec.autopilots['auto-recovery-shield'];
  const baseStatus = s.hubOnline
    ? 'Protected · automatic backup & watchtower ready'
    : shield?.recoveryNote ?? 'Provider offline — protection active.';
  return {
    entries: s.activity.map(a => ({ id: a.id, summary: a.summary, kind: a.kind, 'amount-usd': microToUsd(a.amountMicroUsd) })),
    'hub-online': s.hubOnline,
    'dispute-active': s.disputeActive,
    'tower-enrolled': s.towerEnrolled,
    'backup-exported': s.backupExported,
    'protection-status': baseStatus,
  };
}

function renderPendingRequests(s: WalletFixtureState, spec: LoadedSurfaceSpec) {
  return s.externalRequests
    .filter(r => r.status === 'pending')
    .map(r => ({
      id: r.id,
      delivery: spec.sheets.external.delivery,
      origin: r.origin,
      'app-claim': r.appClaim,
      counterparty: r.counterparty,
      'amount-usd': microToUsd(r.amountMicroUsd),
      'fee-usd': microToUsd(r.feeMicroUsd),
      'credit-limit-delta-usd': microToUsd(r.creditLimitDeltaMicroUsd),
      'unbacked-delta-usd': microToUsd(r.unbackedDeltaMicroUsd),
      expiry: r.expiry,
      survival: spec.sheets.external.survival,
      warns: spec.sheets.external.warns,
    }));
}

function renderQuotePay(s: WalletFixtureState, recipient: string, amountUsd: number) {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
    throw new Error('quote-pay requires a positive amount (> 0).');
  }
  const amountMicro = BigInt(Math.round(amountUsd * 1_000_000));
  const feeMicro = s.quotedFeeMicroUsd;
  const totalMicro = amountMicro + feeMicro;
  const cashMicro = settledCashOf(s);
  const withinFeeCap = feeMicro <= s.maxFeeMicroUsd;
  const hasCash = cashMicro >= totalMicro;
  let reason = 'Ready for 1-tap inline Pay across your Cash.';
  if (!withinFeeCap) {
    reason = `Fee ${formatUsd(feeMicro)} exceeds your safety cap of ${formatUsd(s.maxFeeMicroUsd)}.`;
  } else if (!hasCash) {
    reason = s.arrivingMicroUsd > 0n
      ? `Insufficient settled Cash (${formatUsd(cashMicro)}); ${formatUsd(s.arrivingMicroUsd)} is still arriving.`
      : `Insufficient Cash (${formatUsd(cashMicro)}) for ${formatUsd(totalMicro)} total.`;
  }
  return {
    recipient,
    'amount-usd': amountUsd,
    'fee-usd': microToUsd(feeMicro),
    'max-fee-usd': microToUsd(s.maxFeeMicroUsd),
    'within-fee-cap': withinFeeCap,
    'can-complete': withinFeeCap && hasCash,
    'inline-preview': `${recipient} · ${formatUsd(amountMicro)} + ${formatUsd(feeMicro)} fee`,
    reason,
  };
}

function renderScreen(id: string, s: WalletFixtureState, spec: LoadedSurfaceSpec) {
  if (spec.mode === 'refined') return renderScreenRefined(id, s, spec);
  const sc = spec.screens[id];
  if (!sc) {
    const valid = [...Object.keys(spec.screens), 'external-request', 'settings'].join(', ');
    throw new Error(`Unknown screen '${id}'. Available screens: ${valid}`);
  }
  const labels = sc.actions.map(a => spec.flows[a]?.before ?? a);
  if (id === 'home') {
    return { id: sc.id, purpose: sc.purpose, cash: renderCash(s, spec), buttons: labels, 'pending-external-requests': s.externalRequests.filter(r => r.status === 'pending').length };
  }
  if (id === 'people') return { id: sc.id, purpose: sc.purpose, friends: renderFriends(s), buttons: labels };
  if (id === 'earn') return { id: sc.id, purpose: sc.purpose, savings: renderSavings(s, spec), cash: renderCash(s, spec), buttons: labels };
  return { id: sc.id, purpose: sc.purpose, activity: renderActivity(s, spec), buttons: labels };
}

function buildCapability(getState: () => WalletFixtureState, spec: LoadedSurfaceSpec) {
  const isRefined = spec.mode === 'refined';
  return EnvCapability.define('xln/everyday-discovery', {
    symbols: () => ({
      screens: symbol.rosetta`screens: List available wallet screens`(
        { input: [], output: [z.dynamic], provenance: 'source' },
        () => Object.values(spec.screens).map(sc => ({ id: sc.id, purpose: sc.purpose })),
      ),
      screen: symbol.rosetta`screen: Render an Everyday screen ('home 'people 'earn 'activity)`(
        { input: [z.foldName], output: [z.dynamic], provenance: 'source' },
        id => renderScreen(id, getState(), spec),
      ),
      cash: symbol.rosetta`cash: Read unified spendable Cash (and arriving status)`(
        { input: [], output: [z.dynamic], provenance: 'source' },
        () => renderCash(getState(), spec),
      ),
      'quote-pay': symbol.rosetta`quote-pay: Preview inline fee and feasibility for paying a recipient`(
        { input: [z.string, z.number], output: [z.dynamic], provenance: 'source' },
        (recipient, amountUsd) => renderQuotePay(getState(), recipient, amountUsd),
      ),
      'quote-cash-out': symbol.rosetta`quote-cash-out: Preview fee and feasibility for Cash out`(
        { input: [z.number], output: [z.dynamic], provenance: 'source' },
        amountUsd => {
          if (!Number.isFinite(amountUsd) || amountUsd <= 0) {
            throw new Error('quote-cash-out requires a positive amount (> 0).');
          }
          const cashMicro = settledCashOf(getState());
          return { 'amount-usd': amountUsd, 'fee-usd': 0, 'can-complete': cashMicro >= BigInt(Math.round(amountUsd * 1_000_000)), 'cash-usd': microToUsd(cashMicro) };
        },
      ),
      friends: symbol.rosetta`friends: List human friend tabs (excluding payment hubs)`(
        { input: [], output: [z.dynamic], provenance: 'source' },
        () => renderFriends(getState()),
      ),
      savings: symbol.rosetta`savings: Read opt-in Savings balance, APY, and risk notice`(
        { input: [], output: [z.dynamic], provenance: 'source' },
        () => renderSavings(getState(), spec),
      ),
      activity: symbol.rosetta`activity: Read recent activity and automatic recovery protection status`(
        { input: [], output: [z.dynamic], provenance: 'source' },
        () => renderActivity(getState(), spec),
      ),
      'pending-requests': symbol.rosetta`pending-requests: Inspect external /#pay/... request interrupt sheets`(
        { input: [], output: [z.dynamic], provenance: 'source' },
        () => renderPendingRequests(getState(), spec),
      ),
      terms: symbol.rosetta`terms: Read canonical Everyday surface terminology`(
        { input: [], output: [z.dynamic], provenance: 'source' },
        () => spec.terms,
      ),
      actions: isRefined
        ? symbol.rosetta`actions: List available act() verbs with arg schemas (optional verb filter)`(
            { input: [], inputRest: z.union([z.foldName, z.string]), output: [z.dynamic], provenance: 'source' },
            (...verbs: string[]) => renderActionsRefined(spec, verbs[0]),
          )
        : symbol.rosetta`actions: List available act() verbs on this surface`(
            { input: [], output: [z.dynamic], provenance: 'source' },
            () => [...spec.supportedActions],
          ),
      help: isRefined
        ? symbol.rosetta`help: Show available Scheme discovery functions or help for a topic/action`(
            { input: [], inputRest: z.union([z.foldName, z.string, z.procedure()]), output: [z.dynamic], provenance: 'source' },
            (...topics: Array<string | ((...args: unknown[]) => unknown)>) => renderHelpRefined(spec, topics[0]),
          )
        : symbol.rosetta`help: Show available Scheme discovery functions`(
            { input: [], output: [z.dynamic], provenance: 'source' },
            () => [
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
            ],
          ),
    }),
  });
}

export function createDiscoverySession(getState: () => WalletFixtureState, spec: LoadedSurfaceSpec): DiscoverySession {
  const scope = LexicalScope.fresh('everyday-discovery');
  const cap = buildCapability(getState, spec);
  const recordedDefines: string[] = [];

  return {
    allDefines: () => [...recordedDefines],
    evalExpr: async (expr: string) => {
      if (!expr.trim()) {
        return { outcome: { success: false, error: 'Empty Scheme expression.', phantomCategory: 'validation' }, defines: [] };
      }
      try {
        const results = await exec(expr, { capabilities: [cap], scope, budgetMs: 5000, signal: AbortSignal.timeout(5000) });
        const newDefines = extractDefineForms(expr);
        recordedDefines.push(...newDefines);
        return { outcome: { success: true, data: results.at(-1) ?? null }, defines: newDefines };
      } catch (err) {
        return {
          outcome: { success: false, error: err instanceof Error ? err.message : String(err), phantomCategory: classifySchemeError(err) },
          defines: [],
        };
      }
    },
  };
}
