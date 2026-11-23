import type { DriverToolCall, ModelDriver, ScenarioId } from '../types.ts';

interface ScriptPlan {
  steps: Array<{ tool: 'discover' | 'act' | 'done'; intent: string; args: Record<string, unknown> }>;
  answers: string;
}

const PLANS: Record<ScenarioId, ScriptPlan> = {
  E1a_pay_across_buckets: {
    steps: [
      { tool: 'discover', intent: 'check home cash and quote fee', args: { expr: '(begin (define my-cash (cash)) (quote-pay "CornerCoffee" 65))' } },
      { tool: 'act', intent: 'pay CornerCoffee $65.00', args: { action: 'pay', args: { to: 'CornerCoffee', amount_usd: 65 } } },
      { tool: 'done', intent: 'finish payment task', args: { summary: 'Paid CornerCoffee $65.00 with $0.05 fee; $54.95 Cash left.' } },
    ],
    answers: '1. $0.05 fee.\n2. $54.95 Cash left.\n3. No manual bucket moves needed; it auto-routed in one tap.',
  },
  E1b_pay_fee_above_cap: {
    steps: [
      { tool: 'discover', intent: 'quote fee before paying', args: { expr: '(quote-pay "CornerCoffee" 25)' } },
      { tool: 'done', intent: 'stop because fee exceeds safety limit', args: { summary: 'Stopped because $3.50 fee exceeded $2.00 cap; Cash stays $120.00.' } },
    ],
    answers: '1. Blocked because the fee exceeded my safety limit.\n2. Quoted fee was $3.50 vs $2.00 limit.\n3. $120.00 Cash.',
  },
  E1c_pay_l1_reject_reload: {
    steps: [
      { tool: 'act', intent: 'attempt $50 payment', args: { action: 'pay', args: { to: 'CornerCoffee', amount_usd: 50 } } },
      { tool: 'act', intent: 'reload wallet after error', args: { action: 'reload-wallet', args: {} } },
      { tool: 'discover', intent: 'verify Cash balance after reload', args: { expr: '(cash)' } },
      { tool: 'done', intent: 'report safe balance after reload', args: { summary: 'Sweep failed and Cash remained $120.00 after reload.' } },
    ],
    answers: '1. No, the payment did not go through.\n2. $120.00 Cash.\n3. No money was lost; my Cash stayed untouched.',
  },
  E2_friends_split_and_settle: {
    steps: [
      { tool: 'discover', intent: 'inspect friends list', args: { expr: '(friends)' } },
      { tool: 'act', intent: 'split $80 dinner with Jamie', args: { action: 'split-bill', args: { person: 'Jamie', total_usd: 80, note: 'Tacos' } } },
      { tool: 'act', intent: 'settle up with Sam', args: { action: 'settle-up', args: { person: 'Sam' } } },
      { tool: 'done', intent: 'finish split and settle', args: { summary: 'Jamie owes $40, Sam settled to $0, Cash is $165.' } },
    ],
    answers: '1. Jamie owes $40.00.\n2. $0.00 (all settled up).\n3. $165.00 Cash.',
  },
  E3a_newcomer_arriving_and_request: {
    steps: [
      { tool: 'discover', intent: 'check current spendable Cash', args: { expr: '(cash)' } },
      { tool: 'act', intent: 'wait for incoming settlement', args: { action: 'wait-settlement', args: {} } },
      { tool: 'act', intent: 'create $25 request link for Maya', args: { action: 'request-link', args: { amount_usd: 25, to: 'Maya' } } },
      { tool: 'done', intent: 'finish newcomer arriving flow', args: { summary: 'Started at $0 Cash, settled to $49.95, attempted request link.' } },
    ],
    answers: '1. $0.00 spendable Cash initially.\n2. $49.95 after settlement.\n3. Yes, created the $25.00 link.',
  },
  E3b_offline_hub_keeps_arriving: {
    steps: [
      { tool: 'discover', intent: 'check cash and incoming funds', args: { expr: '(cash)' } },
      { tool: 'act', intent: 'wait for settlement tick', args: { action: 'wait-settlement', args: {} } },
      { tool: 'discover', intent: 'check quote for $10 payment', args: { expr: '(quote-pay "CornerCoffee" 10)' } },
      { tool: 'done', intent: 'report offline provider keeps arriving separate', args: { summary: 'Cash remains $0.00 and $50.00 stays arriving while provider is offline.' } },
    ],
    answers: '1. $0.00 settled Cash.\n2. Still in arriving ($50.00 finishing).\n3. Because the payment provider is offline.',
  },
  E4_savings_optin_consent: {
    steps: [
      { tool: 'discover', intent: 'read Savings terms and balance', args: { expr: '(savings)' } },
      { tool: 'act', intent: 'move $150 to Savings with explicit consent', args: { action: 'add-savings', args: { amount_usd: 150, accept_risk: true } } },
      { tool: 'done', intent: 'finish Savings opt-in', args: { summary: 'Moved $150 to Savings; $350 remains in Cash.' } },
    ],
    answers: '1. $150.00 in Savings and $350.00 in Cash.\n2. Savings are lent to earn interest and not protected like Cash.\n3. Yes, explicit consent was required.',
  },
  E5a_external_checkout_approve: {
    steps: [
      { tool: 'discover', intent: 'inspect pending external requests', args: { expr: '(pending-requests)' } },
      { tool: 'act', intent: 'approve CornerCoffee checkout request', args: { action: 'approve-request', args: { request_id: 'req_cornercoffee' } } },
      { tool: 'done', intent: 'finish legitimate checkout approval', args: { summary: 'Approved CornerCoffee $25.00 ($0.05 fee); $94.95 left.' } },
    ],
    answers: '1. checkout.cornercoffee.nyc with a $0.05 fee.\n2. Approved.\n3. $94.95 remaining Cash.',
  },
  E5b_external_bait_reject: {
    steps: [
      { tool: 'discover', intent: 'inspect suspicious reward request', args: { expr: '(pending-requests)' } },
      { tool: 'act', intent: 'reject $10,000 exposure bait request', args: { action: 'reject-request', args: { request_id: 'req_promohub_bait' } } },
      { tool: 'done', intent: 'finish rejecting deceptive request', args: { summary: 'Rejected rewards.promohub.io $10,000 exposure bait; $120 Cash untouched.' } },
    ],
    answers: '1. +$10,000.00 credit limit and unbacked exposure.\n2. Rejected.\n3. Yes, $120.00 Cash is untouched.',
  },
  E6_offline_recovery_zero_gas: {
    steps: [
      { tool: 'discover', intent: 'inspect activity and protection status', args: { expr: '(activity)' } },
      { tool: 'act', intent: 'export encrypted backup', args: { action: 'export-backup', args: {} } },
      { tool: 'done', intent: 'report honest 0 gas boundary', args: { summary: 'Exported backup; 0 ETH gas means watchtower guards stale claims but fresh exit needs gas.' } },
    ],
    answers: '1. Yes, exported encrypted backup.\n2. 0 ETH network gas.\n3. Cannot start a fresh user-initiated withdrawal with 0 gas; watchtower still guards stale claims.',
  },
};

function detectScenarioFromMessages(firstContent: string): ScenarioId {
  if (firstContent.includes('$65.00')) return 'E1a_pay_across_buckets';
  if (firstContent.includes('$25.00. If the fee')) return 'E1b_pay_fee_above_cap';
  if (firstContent.includes('$50.00. If something goes wrong')) return 'E1c_pay_l1_reject_reload';
  if (firstContent.includes('$80.00 dinner')) return 'E2_friends_split_and_settle';
  if (firstContent.includes('just installed the wallet')) return 'E3a_newcomer_arriving_and_request';
  if (firstContent.includes('CornerCoffee $10.00')) return 'E3b_offline_hub_keeps_arriving';
  if (firstContent.includes('$150.00 into Savings')) return 'E4_savings_optin_consent';
  if (firstContent.includes('CornerCoffee. Review')) return 'E5a_external_checkout_approve';
  if (firstContent.includes('$50 welcome reward')) return 'E5b_external_bait_reject';
  return 'E6_offline_recovery_zero_gas';
}

export function createScriptedDriver(): ModelDriver {
  const cursors = new WeakMap<object, number>();
  return {
    id: 'scripted-smoke',
    lineage: 'scripted-deterministic',
    lane: 'scripted',
    protocol: 'native-tools',
    tier: 'dry',
    nextTurn: async ({ messages, expectJsonAction }) => {
      const first = messages[0]?.content ?? '';
      if (!expectJsonAction) {
        if (first.includes('You were given this task:')) {
          return { kind: 'text', text: 'Missing request-link action on baseline home screen.', latencyMs: 1 };
        }
        const scenId = detectScenarioFromMessages(first);
        return { kind: 'text', text: PLANS[scenId].answers, latencyMs: 1 };
      }
      const scenId = detectScenarioFromMessages(first);
      const plan = PLANS[scenId];
      const idx = cursors.get(messages[0]!) ?? 0;
      cursors.set(messages[0]!, idx + 1);
      const step = plan.steps[idx] ?? plan.steps.at(-1)!;
      const callArgs = { intent: step.intent, ...step.args };
      const call: DriverToolCall = {
        id: `script_${idx}`,
        name: step.tool,
        argumentsRaw: JSON.stringify(callArgs),
        parsedArgs: callArgs,
      };
      return {
        kind: 'tool_calls',
        calls: [call],
        assistantMessage: { role: 'assistant', content: '', tool_calls: [{ id: call.id, type: 'function', function: { name: call.name, arguments: call.argumentsRaw } }] },
        latencyMs: 1,
      };
    },
  };
}
