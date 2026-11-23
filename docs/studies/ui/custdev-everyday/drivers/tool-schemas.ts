const INTENT_DESC = "What you're trying to accomplish. Shown to collaborating users in the studio UI.";

export const EVERYDAY_OPENAI_TOOLS = [
  {
    type: 'function',
    function: {
      name: 'discover',
      description:
        'Read-only Scheme REPL to inspect the wallet UI, balances, quotes, friends, savings, activity, or pending requests. Call (help) to list symbols. You can also use (define ...) helpers across turns.',
      parameters: {
        type: 'object',
        properties: {
          intent: { type: 'string', description: INTENT_DESC },
          expr: { type: 'string', description: 'Scheme expression to evaluate, e.g. "(screen \'home)" or "(cash)" or "(help)".' },
        },
        required: ['intent', 'expr'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'act',
      description: 'Execute an Everyday wallet action. Inspect available actions via discover("(actions)") first.',
      parameters: {
        type: 'object',
        properties: {
          intent: { type: 'string', description: INTENT_DESC },
          action: {
            type: 'string',
            description:
              'Action verb name, e.g. pay, cash-out, split-bill, settle-up, add-savings, move-to-cash, approve-request, reject-request, export-backup, wait-settlement, reload-wallet.',
          },
          args: { type: 'object', description: 'Action arguments object (e.g. { "to": "CornerCoffee", "amount_usd": 65 }).' },
        },
        required: ['intent', 'action'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'done',
      description: 'Finish the task after completing all steps (or confirming why a task cannot proceed safely).',
      parameters: {
        type: 'object',
        properties: {
          intent: { type: 'string', description: INTENT_DESC },
          summary: { type: 'string', description: 'Concise summary of what happened and the final wallet state.' },
        },
        required: ['intent', 'summary'],
      },
    },
  },
];

export function buildSystemPrompt(protocol: 'native-tools' | 'json-turn'): string {
  const base = [
    'You are an everyday person using the XLN Everyday wallet.',
    'You MUST execute inspections and actions using the provided tools (discover, act, done).',
    'Never claim an action succeeded unless a tool result confirmed it.',
    'Every tool call MUST include a clear non-empty "intent" string explaining what you are trying to accomplish.',
    'Start by inspecting with discover (e.g. "(help)", "(screen \'home)", "(cash)", "(actions)") before acting.',
  ];
  if (protocol === 'json-turn') {
    base.push(
      'Reply with ONLY one JSON object per turn:',
      '- {"tool":"discover","intent":"...","expr":"(cash)"}',
      '- {"tool":"act","intent":"...","action":"pay","args":{"to":"CornerCoffee","amount_usd":65}}',
      '- {"tool":"done","intent":"...","summary":"..."}',
    );
  }
  return base.join('\n');
}
