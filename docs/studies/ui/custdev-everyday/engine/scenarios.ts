import { settledCashOf, usd } from './fixtures.ts';
import type { ComprehensionScore, ScenarioId, TraceRecord, WalletFixtureState } from '../types.ts';

export interface ScenarioDef {
  id: ScenarioId;
  flowLabel: string;
  task: string;
  happyPathHint: string;
  questions: [string, string, string];
  verifyState: (state: WalletFixtureState, traces: TraceRecord[]) => boolean;
  scoreAnswers: (raw: string) => ComprehensionScore;
}

function extractLines(raw: string): [string, string, string] {
  const line = (n: number): string =>
    (raw.match(new RegExp(`(?:^|\\n)\\s*\\**${n}[.):]\\**\\s*([^\\n]+)`))?.[1] ?? '').toLowerCase();
  return [line(1), line(2), line(3)];
}

function makeScore(raw: string, checks: Record<string, boolean>): ComprehensionScore {
  const passed = Object.values(checks).every(Boolean);
  return { passed, checks, rawAnswers: raw };
}

export const SCENARIOS: readonly ScenarioDef[] = [
  {
    id: 'E1a_pay_across_buckets',
    flowLabel: 'Flow 1: 1-tap inline Pay across hidden buckets',
    task: 'Pay CornerCoffee $65.00 for supplies. Check what it will cost before paying, then send it.',
    happyPathHint: 'discover("(quote-pay \\"CornerCoffee\\" 65)") then act("pay", { to: "CornerCoffee", amount_usd: 65 }) then done().',
    questions: [
      '1. What fee was shown for sending $65.00?',
      '2. How much Cash do you have left now?',
      '3. Did you have to manually move funds between internal wallet buckets before paying?',
    ],
    verifyState: s => settledCashOf(s) === usd(54.95) && s.activity.some(a => a.kind === 'payment' && a.summary.includes('CornerCoffee')),
    scoreAnswers: raw => {
      const [q1, q2, q3] = extractLines(raw);
      return makeScore(raw, {
        q1Fee: /0\.05|5 cents/.test(q1),
        q2Cash: /54\.95/.test(q2),
        q3NoManualMove: /\b(no|not|automatic|automatically|one tap|1-tap|didn't)\b/.test(q3),
      });
    },
  },
  {
    id: 'E1b_pay_fee_above_cap',
    flowLabel: 'Flow 1 (Unhappy): Hub fee above maxAcceptableFee',
    task: 'Try to pay CornerCoffee $25.00. If the fee is unusually high or blocked by your safety limit, do not force it—tell me what happened.',
    happyPathHint: 'discover("(quote-pay \\"CornerCoffee\\" 25)") to inspect the $3.50 fee vs $2.00 cap, verify Cash stays $120.00, then done().',
    questions: [
      '1. Why was the $25.00 payment blocked or unsafe to send?',
      '2. What was the quoted fee vs your safety limit?',
      '3. How much Cash is in your wallet now?',
    ],
    verifyState: s => settledCashOf(s) === usd(120),
    scoreAnswers: raw => {
      const [q1, q2, q3] = extractLines(raw);
      return makeScore(raw, {
        q1FeeBlocked: /\b(fee|limit|cap|high|exceed|blocked)\b/.test(q1),
        q2Numbers: /3\.50/.test(q2) && /2(\.00)?/.test(q2),
        q3CashIntact: /120(\.00)?/.test(q3),
      });
    },
  },
  {
    id: 'E1c_pay_l1_reject_reload',
    flowLabel: 'Flow 1 (Unhappy): Mid-sweep L1 rejection & reload',
    task: 'Pay CornerCoffee $50.00. If something goes wrong while moving your funds, reload and check your Cash again to verify whether your money is safe.',
    happyPathHint: 'act("pay", { to: "CornerCoffee", amount_usd: 50 }), then act("reload-wallet"), discover("(cash)"), then done().',
    questions: [
      '1. Did the $50.00 payment go through?',
      '2. After reloading, how much Cash do you have?',
      '3. Was any money lost or stuck mid-way?',
    ],
    verifyState: s => settledCashOf(s) === usd(120) && s.l1SweepAttempted && s.reloadedAfterFailure,
    scoreAnswers: raw => {
      const [q1, q2, q3] = extractLines(raw);
      return makeScore(raw, {
        q1Failed: /\b(no|not|failed|rejected|didn't|did not)\b/.test(q1),
        q2CashIntact: /120(\.00)?/.test(q2),
        q3NoLoss: /\b(no|not|safe|untouched|intact)\b/.test(q3),
      });
    },
  },
  {
    id: 'E2_friends_split_and_settle',
    flowLabel: 'Flow 2: Friends & tabs split + 1-tap Settle up',
    task: 'Split an $80.00 dinner 50/50 with Jamie (note: Tacos), and pay back what you owe Sam.',
    happyPathHint: 'discover("(friends)"), act("split-bill", { person: "Jamie", total_usd: 80, note: "Tacos" }), act("settle-up", { person: "Sam" }), then done().',
    questions: [
      '1. After splitting dinner, how much does Jamie owe you?',
      '2. What is your tab balance with Sam now?',
      '3. How much Cash do you have left?',
    ],
    verifyState: s => {
      const jamie = s.peers.find(p => p.id === 'jamie');
      const sam = s.peers.find(p => p.id === 'sam');
      return Boolean(jamie && jamie.signedMicroUsd === usd(40) && sam && sam.signedMicroUsd === 0n && settledCashOf(s) === usd(165));
    },
    scoreAnswers: raw => {
      const [q1, q2, q3] = extractLines(raw);
      return makeScore(raw, {
        q1Jamie: /40(\.00)?/.test(q1),
        q2SamZero: /0(\.00)?|\bsettled\b|\bnothing\b/.test(q2),
        q3Cash: /165(\.00)?/.test(q3),
      });
    },
  },
  {
    id: 'E3a_newcomer_arriving_and_request',
    flowLabel: 'Flow 3: $0 newcomer arriving auto-settle + request link',
    task: 'You just installed the wallet. Check how much Cash you can spend right now, wait for any incoming payment to finish settling, and then create a $25.00 payment request link for Maya.',
    happyPathHint: 'discover("(cash)"), act("wait-settlement"), act("request-link", { amount_usd: 25, to: "Maya" }), then done().',
    questions: [
      '1. Before waiting, how much settled Cash could you spend right away?',
      '2. After the incoming payment finished settling, how much Cash did you have?',
      '3. Were you able to create the $25.00 payment request link?',
    ],
    verifyState: s => settledCashOf(s) === usd(49.95) && s.arrivingMicroUsd === 0n && s.requestLinks.some(r => r.amountMicroUsd === usd(25)),
    scoreAnswers: raw => {
      const [q1, q2, q3] = extractLines(raw);
      return makeScore(raw, {
        q1ZeroInitially: /0(\.00)?|\bnone\b|\bnothing\b/.test(q1),
        q2Settled: /49\.95/.test(q2),
        q3Link: /\b(yes|created|generated)\b/.test(q3),
      });
    },
  },
  {
    id: 'E3b_offline_hub_keeps_arriving',
    flowLabel: 'Flow 3 (Unhappy): Offline hub keeps funds in arriving',
    task: 'Check your incoming $50.00 payment and wait to see if it finishes. Verify whether you can pay CornerCoffee $10.00 now, and explain why.',
    happyPathHint: 'discover("(cash)"), act("wait-settlement"), discover("(quote-pay \\"CornerCoffee\\" 10)") or observe $0 Cash while $50 stays arriving, then done().',
    questions: [
      '1. After waiting, how much settled Cash can you spend right now?',
      '2. Where is the $50.00 incoming payment right now?',
      '3. Why could it not settle into Cash yet?',
    ],
    verifyState: s => settledCashOf(s) === 0n && s.arrivingMicroUsd === usd(50),
    scoreAnswers: raw => {
      const [q1, q2, q3] = extractLines(raw);
      return makeScore(raw, {
        q1StillZero: /0(\.00)?|\bnone\b|\bnothing\b/.test(q1),
        q2Arriving: /\b(arriving|incoming|pending|finishing|transit)\b/.test(q2),
        q3HubOffline: /\b(offline|unavailable|unreachable|down|provider|hub)\b/.test(q3),
      });
    },
  },
  {
    id: 'E4_savings_optin_consent',
    flowLabel: 'Flow 4: Opt-in Savings separation + plain-English consent',
    task: 'Check Savings terms, then move $150.00 into Savings to earn interest after accepting what Savings means compared to Cash.',
    happyPathHint: 'discover("(savings)"), act("add-savings", { amount_usd: 150, accept_risk: true }), then done().',
    questions: [
      '1. How much is in Savings and how much is left in Cash?',
      '2. How is Savings risk different from Cash?',
      '3. Did Savings require explicit consent before moving money?',
    ],
    verifyState: s => settledCashOf(s) === usd(350) && s.savingsMicroUsd === usd(150) && s.savingsRiskConsented,
    scoreAnswers: raw => {
      const [q1, q2, q3] = extractLines(raw);
      return makeScore(raw, {
        q1Balances: /150(\.00)?/.test(q1) && /350(\.00)?/.test(q1),
        q2Risk: /\b(lent|interest|not protected|counterparty|unprotected|risk|separate)\b/.test(q2),
        q3Consent: /\b(yes|explicit|accept|consent)\b/.test(q3),
      });
    },
  },
  {
    id: 'E5a_external_checkout_approve',
    flowLabel: 'Flow 5a: Legitimate external /#pay/... request sheet',
    task: 'You tapped an external payment link from CornerCoffee. Review the pending request sheet and decide whether to approve it.',
    happyPathHint: 'discover("(pending-requests)"), act("approve-request", { request_id: "req_cornercoffee" }), then done().',
    questions: [
      '1. Which origin/site requested the payment and what was the fee?',
      '2. Did you approve or reject it?',
      '3. What is your remaining Cash?',
    ],
    verifyState: s => {
      const req = s.externalRequests.find(r => r.id === 'req_cornercoffee');
      return Boolean(req?.status === 'approved' && settledCashOf(s) === usd(94.95));
    },
    scoreAnswers: raw => {
      const [q1, q2, q3] = extractLines(raw);
      return makeScore(raw, {
        q1OriginFee: /cornercoffee/.test(q1) && /0\.05/.test(q1),
        q2Approved: /\bapprove/.test(q2),
        q3Cash: /94\.95/.test(q3),
      });
    },
  },
  {
    id: 'E5b_external_bait_reject',
    flowLabel: 'Flow 5b: Deceptive external reward bait rejection',
    task: 'An external site popped up offering a $50 welcome reward. Inspect the wallet request sheet carefully and decide whether to approve or reject it.',
    happyPathHint: 'discover("(pending-requests)"), notice +$10,000 credit/unbacked risk, act("reject-request", { request_id: "req_promohub_bait" }), then done().',
    questions: [
      '1. What hidden exposure or credit limit did the request actually ask for?',
      '2. Did you approve or reject it?',
      '3. Is your $120.00 Cash untouched?',
    ],
    verifyState: s => {
      const req = s.externalRequests.find(r => r.id === 'req_promohub_bait');
      return Boolean(req?.status === 'rejected' && settledCashOf(s) === usd(120));
    },
    scoreAnswers: raw => {
      const [q1, q2, q3] = extractLines(raw);
      return makeScore(raw, {
        q1TenK: /10[,.]?000/.test(q1),
        q2Rejected: /\breject/.test(q2),
        q3Intact: /\b(yes|untouched|120)\b/.test(q3),
      });
    },
  },
  {
    id: 'E6_offline_recovery_zero_gas',
    flowLabel: 'Flow 6: Offline provider recovery & honest L1 gas=0 boundary',
    task: 'Your payment provider went offline. Check Activity and your protection status, export your encrypted backup if needed, and report honestly whether your money is moving back automatically right now or if network gas is needed.',
    happyPathHint: 'discover("(activity)"), act("export-backup", {}), then done() noting 0 L1 gas blocks a fresh user-initiated exit even though the watchtower guards stale claims.',
    questions: [
      '1. Did you export an encrypted backup?',
      '2. How much native network (L1) gas does this wallet currently have?',
      '3. Can a fresh user-initiated on-chain withdrawal run right now with 0 gas, or what happens?',
    ],
    verifyState: s => s.backupExported,
    scoreAnswers: raw => {
      const [q1, q2, q3] = extractLines(raw);
      return makeScore(raw, {
        q1Backup: /\b(yes|exported)\b/.test(q1),
        q2ZeroGas: /0(\.0+)?\s*(eth|gas|wei)?\b|\bzero\b|\bno (network |l1 )?gas\b/.test(q2),
        q3HonestGas: /\b(cannot|can't|no|needs?|require[sd]?|gas|tower|watchtower|stale)\b/.test(q3) && !/\bautomatically moving back with no action\b/.test(q3),
      });
    },
  },
];

export function getScenario(id: ScenarioId): ScenarioDef {
  const found = SCENARIOS.find(s => s.id === id);
  if (!found) throw new Error(`Unknown scenario: ${id}`);
  return found;
}
