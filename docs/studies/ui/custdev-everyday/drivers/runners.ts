import { rmSync } from 'node:fs';
import {
  LANE_SEMAPHORES,
  parseJsonTurnCalls,
  renderTranscriptPrompt,
  runDetachedCli,
  Semaphore,
  withTransportRetry,
} from './driver-helpers.ts';
import type { DriverMessage, DriverToolCall, ModelDriver } from '../types.ts';

export const HERMES_BASE_URL = process.env.XLN_HERMES_BASE_URL ?? 'http://127.0.0.1:8645/v1';

const BLOCKED_RELAY_HOST = ['open', 'router', '.ai'].join('');

export function assertLocalProxyOrApprovedUrl(url: string): void {
  const parsed = new URL(url);
  if (parsed.hostname.toLowerCase().includes(BLOCKED_RELAY_HOST)) {
    throw new Error(`FORBIDDEN_ENDPOINT: external relay host rejected (${parsed.hostname})`);
  }
  if (parsed.hostname !== '127.0.0.1' && parsed.hostname !== 'localhost') {
    throw new Error(`FORBIDDEN_ENDPOINT: non-loopback proxy host rejected (${parsed.hostname})`);
  }
}

assertLocalProxyOrApprovedUrl(HERMES_BASE_URL);

const MODEL_SEMAPHORES = new Map<string, Semaphore>();
function modelSem(id: string): Semaphore {
  let s = MODEL_SEMAPHORES.get(id);
  if (!s) {
    s = new Semaphore(2);
    MODEL_SEMAPHORES.set(id, s);
  }
  return s;
}

function parseToolCallsFromChoice(rawCalls: Array<{ id: string; function: { name: string; arguments: string } }>): DriverToolCall[] {
  return rawCalls.map(tc => {
    try {
      const parsed = JSON.parse(tc.function.arguments || '{}') as unknown;
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return { id: tc.id, name: tc.function.name, argumentsRaw: tc.function.arguments, parseError: 'Tool arguments must be a JSON object.' };
      }
      return { id: tc.id, name: tc.function.name, argumentsRaw: tc.function.arguments, parsedArgs: parsed as Record<string, unknown> };
    } catch (err) {
      return {
        id: tc.id,
        name: tc.function.name,
        argumentsRaw: tc.function.arguments,
        parseError: `Invalid JSON arguments: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  });
}

function createHermesDriver(model: string, lineage: string, tier: 'fast' | 'frontier'): ModelDriver {
  return {
    id: model,
    lineage,
    lane: 'hermes',
    protocol: 'native-tools',
    tier,
    nextTurn: ({ systemPrompt, messages, tools, expectJsonAction }) =>
      LANE_SEMAPHORES.hermes.run(() =>
        modelSem(model).run(() =>
          withTransportRetry(async () => {
            assertLocalProxyOrApprovedUrl(HERMES_BASE_URL);
            const t0 = performance.now();
            const fullMsgs: DriverMessage[] = messages[0]?.role === 'system' ? [...messages] : [{ role: 'system', content: systemPrompt }, ...messages];
            const payload: Record<string, unknown> = {
              model,
              messages: fullMsgs,
              temperature: 0.2,
              max_tokens: 2500,
              reasoning: { effort: 'low', exclude: true },
            };
            if (expectJsonAction && tools && tools.length > 0) {
              payload.tools = tools;
              payload.tool_choice = 'auto';
            }
            let res: Response;
            let rawText: string;
            try {
              res = await fetch(`${HERMES_BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify(payload),
                signal: AbortSignal.timeout(45_000),
              });
              rawText = await res.text();
            } catch (err) {
              if (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) {
                throw new Error('TIMEOUT after 45000ms');
              }
              throw err;
            }
            let json: {
              choices?: Array<{ message?: { content?: string | null; tool_calls?: Array<{ id: string; type: 'function'; function: { name: string; arguments: string } }> } }>;
              error?: { message?: string };
            } | null = null;
            try {
              json = JSON.parse(rawText);
            } catch {}
            if (!res.ok || json?.error) {
              throw new Error(`HTTP ${res.status}: ${json?.error?.message ?? (rawText.trim().slice(0, 200) || 'proxy error')}`);
            }
            if (!json) throw new Error(`HTTP ${res.status}: invalid JSON from proxy`);
            const latencyMs = Math.round(performance.now() - t0);
            const msg = json.choices?.[0]?.message;
            if (!msg) throw new Error('Empty choices from Hermes proxy');
            if (msg.tool_calls && msg.tool_calls.length > 0) {
              return {
                kind: 'tool_calls',
                calls: parseToolCallsFromChoice(msg.tool_calls),
                assistantMessage: { role: 'assistant', content: msg.content ?? '', tool_calls: msg.tool_calls },
                latencyMs,
              };
            }
            const text = (msg.content ?? '').trim();
            if (expectJsonAction) {
              const parsed = parseJsonTurnCalls(text);
              if (parsed) return { kind: 'tool_calls', calls: parsed, assistantMessage: { role: 'assistant', content: text }, latencyMs };
            }
            return { kind: 'text', text, latencyMs };
          }, model),
        ),
      ),
  };
}

function createClaudeCliDriver(id: string, modelFlag: string | null, tier: 'fast' | 'frontier'): ModelDriver {
  return {
    id,
    lineage: modelFlag ? `anthropic-claude-${modelFlag}` : 'anthropic-claude-sonnet',
    lane: 'claude-cli',
    protocol: 'json-turn',
    tier,
    nextTurn: ({ systemPrompt, messages, expectJsonAction }) =>
      LANE_SEMAPHORES['claude-cli'].run(() =>
        withTransportRetry(async () => {
          const t0 = performance.now();
          const args = [
            '-p',
            ...(modelFlag ? ['--model', modelFlag] : []),
            '--output-format', 'json',
            '--strict-mcp-config',
            '--mcp-config', '{"mcpServers":{}}',
            '--setting-sources', 'user',
            '--disallowedTools', 'Bash', 'Read', 'Edit', 'Write', 'Glob', 'Grep', 'LS', 'WebFetch', 'WebSearch', 'NotebookEdit', 'TodoWrite',
            '--system-prompt', systemPrompt,
          ];
          const res = await runDetachedCli('claude', args, 45_000, renderTranscriptPrompt(messages, expectJsonAction));
          const latencyMs = Math.round(performance.now() - t0);
          if (res.timedOut) throw new Error('TIMEOUT after 45000ms');
          if (res.exitCode !== 0) throw new Error(`CLI exit ${res.exitCode}: ${res.stderr.trim() || res.stdout.trim()}`);
          let text = res.stdout.trim();
          let parsedEnv: { result?: string; is_error?: boolean } | null = null;
          try {
            parsedEnv = JSON.parse(text) as { result?: string; is_error?: boolean };
          } catch {}
          if (parsedEnv?.is_error) throw new Error(parsedEnv.result ?? 'claude CLI error');
          if (typeof parsedEnv?.result === 'string') text = parsedEnv.result.trim();
          if (expectJsonAction) {
            const calls = parseJsonTurnCalls(text);
            if (calls) return { kind: 'tool_calls', calls, assistantMessage: { role: 'assistant', content: text }, latencyMs };
          }
          return { kind: 'text', text, latencyMs };
        }, id),
      ),
  };
}

let grokSeq = 0;
function createGrokCliDriver(model: string, tier: 'fast' | 'frontier'): ModelDriver {
  return {
    id: model,
    lineage: `xai-${model}`,
    lane: 'grok-cli',
    protocol: 'json-turn',
    tier,
    nextTurn: ({ systemPrompt, messages, expectJsonAction }) =>
      LANE_SEMAPHORES['grok-cli'].run(() =>
        withTransportRetry(async () => {
          const t0 = performance.now();
          const sock = `/tmp/grok-custdev-${process.pid}-${++grokSeq}.sock`;
          const args = [
            '-m', model,
            '--disable-web-search',
            '--tools', '',
            '--no-subagents',
            '--no-plan',
            '--reasoning-effort', 'low',
            '--output-format', 'json',
            '--leader-socket', sock,
            '--system-prompt-override', systemPrompt,
            '-p', renderTranscriptPrompt(messages, expectJsonAction),
          ];
          try {
            const res = await runDetachedCli('grok', args, 90_000);
            const latencyMs = Math.round(performance.now() - t0);
            if (res.timedOut) throw new Error('TIMEOUT after 90000ms');
            if (res.exitCode !== 0) throw new Error(`CLI exit ${res.exitCode}: ${res.stderr.trim() || res.stdout.trim()}`);
            let text = res.stdout.trim();
            try {
              const env = JSON.parse(text) as { text?: string };
              if (typeof env.text === 'string') text = env.text.trim();
            } catch {}
            if (expectJsonAction) {
              const calls = parseJsonTurnCalls(text);
              if (calls) return { kind: 'tool_calls', calls, assistantMessage: { role: 'assistant', content: text }, latencyMs };
            }
            return { kind: 'text', text, latencyMs };
          } finally {
            try { rmSync(sock, { force: true }); } catch {}
          }
        }, model),
      ),
  };
}

export const HERMES_DRIVERS: readonly ModelDriver[] = [
  createHermesDriver('google/gemini-3.1-flash-lite-preview', 'google-gemini-3.1-flash-lite', 'fast'),
  createHermesDriver('google/gemini-2.5-flash', 'google-gemini-2.5-flash', 'fast'),
  createHermesDriver('google/gemini-2.5-pro', 'google-gemini-2.5-pro', 'frontier'),
  createHermesDriver('openai/gpt-6.2-astra', 'openai-gpt-6.2', 'frontier'),
  createHermesDriver('anthropic/claude-fable-5.2', 'anthropic-claude-fable-5.2', 'frontier'),
  createHermesDriver('qwen/qwen3.7-flash', 'qwen-3.7', 'fast'),
  createHermesDriver('meta-llama/llama-4-scout', 'meta-llama-4', 'fast'),
];

export const CLI_DRIVERS: readonly ModelDriver[] = [
  createClaudeCliDriver('claude-haiku', 'haiku', 'fast'),
  createClaudeCliDriver('claude-sonnet', null, 'frontier'),
  createGrokCliDriver('grok-4.7-build-fast', 'fast'),
  createGrokCliDriver('grok-4.7', 'frontier'),
];

export const ALL_DRIVERS: readonly ModelDriver[] = [...HERMES_DRIVERS, ...CLI_DRIVERS];

export function selectDrivers(tier: string, modelsFilter?: string): readonly ModelDriver[] {
  if (modelsFilter) {
    const wanted = new Set(modelsFilter.split(',').map(s => s.trim()).filter(Boolean));
    return ALL_DRIVERS.filter(d => wanted.has(d.id));
  }
  if (tier === 'fast') return ALL_DRIVERS.filter(d => d.tier === 'fast');
  if (tier === 'proxy') return HERMES_DRIVERS;
  if (tier === 'cli') return CLI_DRIVERS;
  return ALL_DRIVERS;
}
