import { spawn } from 'node:child_process';
import type { DriverLane, DriverMessage, DriverToolCall } from '../types.ts';

export const ENRICHED_PATH = `${process.env.HOME ?? ''}/.bun/bin:/opt/homebrew/bin:${process.env.HOME ?? ''}/.local/bin:${process.env.PATH ?? ''}`;

export class Semaphore {
  private active = 0;
  private readonly queue: Array<() => void> = [];
  constructor(private readonly max: number) {}

  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) {
      await new Promise<void>(resolve => this.queue.push(resolve));
    }
    this.active++;
    try {
      return await fn();
    } finally {
      this.active--;
      const next = this.queue.shift();
      if (next) next();
    }
  }
}

export const LANE_SEMAPHORES: Record<DriverLane, Semaphore> = {
  hermes: new Semaphore(4),
  'claude-cli': new Semaphore(2),
  'grok-cli': new Semaphore(1),
  scripted: new Semaphore(8),
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function withTransportRetry<T>(fn: () => Promise<T>, label: string): Promise<T> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      const msg = err instanceof Error ? err.message : String(err);
      const retryable = /HTTP (?:429|500|502|503|504)|ECONNRESET|ETIMEDOUT|fetch failed|403 Forbidden/i.test(msg);
      if (!retryable || attempt === 2) break;
      await sleep((attempt + 1) * 1500);
    }
  }
  throw new Error(`${label}: ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`);
}

export function extractBalancedJson(raw: string): string | null {
  const stripped = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  try {
    const whole = JSON.parse(stripped);
    if (whole && typeof whole === 'object') return stripped;
  } catch {}
  const start = stripped.search(/[\{\[]/);
  if (start < 0) return null;
  const open = stripped[start];
  const close = open === '{' ? '}' : ']';
  let depth = 0;
  let inStr = false;
  let escaped = false;
  for (let i = start; i < stripped.length; i++) {
    const ch = stripped[i];
    if (inStr) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') { inStr = true; continue; }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return stripped.slice(start, i + 1);
    }
  }
  return null;
}

const isPlainObj = (v: unknown): v is Record<string, unknown> =>
  Boolean(v && typeof v === 'object' && !Array.isArray(v));

function normalizeJsonCall(obj: Record<string, unknown>, index: number): DriverToolCall | null {
  const tool = typeof obj.tool === 'string' ? obj.tool : typeof obj.name === 'string' ? obj.name : null;
  if (!tool) return null;
  const topArgs: Record<string, unknown> = {};
  if (obj.intent !== undefined) topArgs.intent = obj.intent;
  if (tool === 'discover') {
    topArgs.expr = obj.expr ?? (isPlainObj(obj.args) ? obj.args.expr : undefined);
  } else if (tool === 'act') {
    topArgs.action = obj.action ?? (isPlainObj(obj.args) ? obj.args.action : undefined);
    if (obj.args !== undefined) topArgs.args = obj.args;
    else if (obj.params !== undefined) topArgs.args = obj.params;
    else {
      const rest = Object.fromEntries(Object.entries(obj).filter(([k]) => !['tool', 'name', 'intent', 'action'].includes(k)));
      if (Object.keys(rest).length > 0) topArgs.args = rest;
    }
  } else if (tool === 'done') {
    topArgs.summary = obj.summary ?? (isPlainObj(obj.args) ? obj.args.summary : undefined);
  } else if (isPlainObj(obj.args)) {
    Object.assign(topArgs, obj.args);
  }
  return { id: `json_call_${index}`, name: tool, argumentsRaw: JSON.stringify(topArgs), parsedArgs: topArgs };
}

export function parseJsonTurnCalls(raw: string): DriverToolCall[] | null {
  const snippet = extractBalancedJson(raw);
  if (!snippet) return null;
  try {
    const parsed = JSON.parse(snippet) as unknown;
    const arr = Array.isArray(parsed) ? parsed : [parsed];
    const calls: DriverToolCall[] = [];
    for (let i = 0; i < arr.length; i++) {
      const item = arr[i];
      if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
      const call = normalizeJsonCall(item as Record<string, unknown>, i);
      if (!call) return null;
      calls.push(call);
    }
    return calls.length > 0 ? calls : null;
  } catch {
    return null;
  }
}

export function renderTranscriptPrompt(messages: readonly DriverMessage[], expectJsonAction: boolean): string {
  const body = messages
    .filter(m => m.role !== 'system')
    .map(m => `[${m.role.toUpperCase()}]\n${m.content}`)
    .join('\n\n');
  if (!expectJsonAction) return body;
  return `${body}\n\nReply with ONLY one valid JSON object matching {"tool":"discover"|"act"|"done","intent":"...", ...} (no markdown prose).`;
}

export function runDetachedCli(
  cmd: string,
  args: string[],
  timeoutMs: number,
  stdinText?: string,
): Promise<{ stdout: string; stderr: string; exitCode: number | null; timedOut: boolean }> {
  return new Promise(resolve => {
    const child = spawn(cmd, args, {
      cwd: '/tmp',
      detached: true,
      env: { ...process.env, PATH: ENRICHED_PATH },
      stdio: [stdinText !== undefined ? 'pipe' : 'ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    let timedOut = false;
    let settled = false;
    let killTimer: ReturnType<typeof setTimeout> | undefined;
    const finish = (exitCode: number | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (killTimer) clearTimeout(killTimer);
      resolve({ stdout, stderr, exitCode, timedOut });
    };
    child.stdout?.on('data', chunk => { stdout += String(chunk); });
    child.stderr?.on('data', chunk => { stderr += String(chunk); });
    const timer = setTimeout(() => {
      timedOut = true;
      if (child.pid) {
        try { process.kill(-child.pid, 'SIGTERM'); } catch {}
        killTimer = setTimeout(() => {
          if (child.pid) {
            try { process.kill(-child.pid, 'SIGKILL'); } catch {}
          }
        }, 500);
        killTimer.unref?.();
      }
    }, timeoutMs);
    child.on('error', err => {
      stderr = stderr ? `${stderr}\n${err.message}` : err.message;
      finish(127);
    });
    child.on('close', exitCode => finish(exitCode));
    if (stdinText !== undefined && child.stdin) {
      child.stdin.on('error', () => {});
      child.stdin.write(stdinText);
      child.stdin.end();
    }
  });
}
