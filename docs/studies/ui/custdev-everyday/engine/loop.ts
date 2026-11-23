import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { dispatchAction } from './actions.ts';
import { sanitizeSlug, writeEpisodeTrace, writeSweepArtifacts } from './collector.ts';
import { createDiscoverySession, type DiscoverySession } from './discovery.ts';
import { createFixtureState } from './fixtures.ts';
import { runPostMortem, writePostMortemsMarkdown } from './postmortem.ts';
import { getScenario, SCENARIOS, type ScenarioDef } from './scenarios.ts';
import { loadSurfaceSpec } from './surface-spec.ts';
import { buildSystemPrompt, EVERYDAY_OPENAI_TOOLS } from '../drivers/tool-schemas.ts';
import type {
  DriverMessage,
  DriverToolCall,
  EpisodeResult,
  LoadedSurfaceSpec,
  ModelDriver,
  PhantomCategory,
  PhantomRecord,
  SpecMode,
  ToolOutcome,
  TraceRecord,
  WalletFixtureState,
} from '../types.ts';

const MAX_TURNS = 10;

function isTimeoutError(err: unknown, msg: string): boolean {
  return (
    (err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')) ||
    /TIMEOUT|timed out|AbortError|TimeoutError|ETIMEDOUT/i.test(msg)
  );
}

export async function dispatchToolCall(
  call: DriverToolCall,
  ctx: {
    getState: () => WalletFixtureState;
    setState: (s: WalletFixtureState) => void;
    discovery: DiscoverySession;
    spec: LoadedSurfaceSpec;
  },
): Promise<{ outcome: ToolOutcome; defines: string[]; finished: boolean; summary?: string; intent: string; actionOrExpr: string }> {
  if (call.parseError) {
    return {
      outcome: { success: false, error: call.parseError, phantomCategory: 'parse' },
      defines: [],
      finished: false,
      intent: '',
      actionOrExpr: call.name,
    };
  }
  const args = call.parsedArgs ?? {};
  const intent = typeof args.intent === 'string' ? args.intent.trim() : '';
  if (!intent) {
    return {
      outcome: { success: false, error: 'Missing non-empty public "intent" string.', phantomCategory: 'validation' },
      defines: [],
      finished: false,
      intent: '',
      actionOrExpr: call.name === 'act' ? String(args.action ?? 'act') : String(args.expr ?? call.name),
    };
  }
  if (call.name === 'discover') {
    const expr = args.expr;
    if (typeof expr !== 'string') {
      return {
        outcome: { success: false, error: 'discover requires string field "expr".', phantomCategory: 'validation' },
        defines: [],
        finished: false,
        intent,
        actionOrExpr: 'discover',
      };
    }
    const res = await ctx.discovery.evalExpr(expr);
    return { outcome: res.outcome, defines: res.defines, finished: false, intent, actionOrExpr: expr.slice(0, 80) };
  }
  if (call.name === 'act') {
    const { state: nextState, outcome } = dispatchAction(ctx.getState(), ctx.spec, args.action, args.args);
    ctx.setState(nextState);
    return { outcome, defines: [], finished: false, intent, actionOrExpr: String(args.action ?? 'act') };
  }
  if (call.name === 'done') {
    const summary = typeof args.summary === 'string' ? args.summary : '';
    return { outcome: { success: true, data: { done: true, summary } }, defines: [], finished: true, summary, intent, actionOrExpr: 'done' };
  }
  return {
    outcome: { success: false, error: `Unknown tool '${call.name}'. Use discover, act, or done.`, phantomCategory: 'unknown_action' },
    defines: [],
    finished: false,
    intent,
    actionOrExpr: call.name,
  };
}

function makePhantom(
  epId: string,
  scenarioId: ScenarioDef['id'],
  driver: ModelDriver,
  specMode: SpecMode,
  turn: number,
  tool: string,
  actionOrExpr: string,
  intent: string,
  category: PhantomCategory,
  error: string,
): PhantomRecord {
  return { episodeId: epId, scenarioId, modelId: driver.id, lineage: driver.lineage, specMode, turn, tool, actionOrExpr, intent, category, error };
}

export async function runEpisode(params: {
  driver: ModelDriver;
  scenario: ScenarioDef;
  spec: LoadedSurfaceSpec;
  skipPostMortem?: boolean;
}): Promise<EpisodeResult> {
  const { driver, scenario, spec } = params;
  const episodeId = `${scenario.id}--${driver.id}--${spec.mode}`;
  const t0 = performance.now();
  let state = createFixtureState(scenario.id, spec.mode);
  const discovery = createDiscoverySession(() => state, spec);
  const sysPrompt = buildSystemPrompt(driver.protocol);
  const messages: DriverMessage[] = [
    { role: 'user', content: `Task: ${scenario.task}` },
  ];
  const traces: TraceRecord[] = [];
  const phantoms: PhantomRecord[] = [];
  let finished = false;
  let finalSummary = '';
  let transportError: string | undefined;

  for (let turn = 1; turn <= MAX_TURNS && !finished; turn++) {
    let reply;
    try {
      reply = await driver.nextTurn({
        systemPrompt: sysPrompt,
        messages,
        tools: driver.protocol === 'native-tools' ? EVERYDAY_OPENAI_TOOLS : undefined,
        expectJsonAction: true,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isTimeoutError(err, msg)) {
        phantoms.push(makePhantom(episodeId, scenario.id, driver, spec.mode, turn, 'driver', 'turn', '', 'timeout', msg));
      } else {
        transportError = msg;
      }
      break;
    }

    if (reply.kind === 'text') {
      const err = 'Expected a structured tool call (discover, act, or done), got plain text.';
      phantoms.push(makePhantom(episodeId, scenario.id, driver, spec.mode, turn, 'driver', 'text-reply', '', 'parse', err));
      traces.push({ turn, tool: 'text', intent: '', args: { raw: reply.text.slice(0, 120) }, outcome: { success: false, error: err, phantomCategory: 'parse' }, latencyMs: reply.latencyMs, definesRecorded: [] });
      messages.push({ role: 'assistant', content: reply.text });
      messages.push({ role: 'user', content: `${err} Call discover, act, or done.` });
      continue;
    }

    messages.push(reply.assistantMessage);
    const toolReplies: string[] = [];
    for (const call of reply.calls) {
      const res = await dispatchToolCall(call, {
        getState: () => state,
        setState: s => { state = s; },
        discovery,
        spec,
      });
      traces.push({
        turn,
        tool: call.name,
        intent: res.intent,
        args: call.parsedArgs ?? { raw: call.argumentsRaw },
        outcome: res.outcome,
        latencyMs: reply.latencyMs,
        definesRecorded: res.defines,
      });
      if (!res.outcome.success && res.outcome.phantomCategory) {
        phantoms.push(
          makePhantom(episodeId, scenario.id, driver, spec.mode, turn, call.name, res.actionOrExpr, res.intent, res.outcome.phantomCategory, res.outcome.error ?? 'error'),
        );
      }
      const payloadStr = JSON.stringify(res.outcome.success ? res.outcome.data : { error: res.outcome.error, category: res.outcome.phantomCategory });
      if (driver.protocol === 'native-tools') {
        messages.push({ role: 'tool', tool_call_id: call.id, name: call.name, content: payloadStr });
      } else {
        toolReplies.push(`[TOOL RESULT ${call.name}] ${payloadStr}`);
      }
      if (res.finished) {
        finished = true;
        finalSummary = res.summary ?? '';
      }
    }
    if (driver.protocol === 'json-turn' && !finished && toolReplies.length > 0) {
      messages.push({ role: 'user', content: toolReplies.join('\n') });
    }
  }

  let rawAnswers = '';
  if (!transportError) {
    try {
      const qPrompt = `Now answer from memory in 3 numbered lines (1, 2, 3), one short sentence each:\n${scenario.questions.join('\n')}`;
      messages.push({ role: 'user', content: qPrompt });
      const ansTurn = await driver.nextTurn({ systemPrompt: sysPrompt, messages, expectJsonAction: false });
      rawAnswers = ansTurn.kind === 'text' ? ansTurn.text : JSON.stringify(ansTurn.calls);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (isTimeoutError(err, msg)) {
        phantoms.push(makePhantom(episodeId, scenario.id, driver, spec.mode, traces.length + 1, 'driver', 'comprehension', '', 'timeout', msg));
      } else {
        transportError = `Comprehension step failed: ${msg}`;
      }
    }
  }

  const statePassed = scenario.verifyState(state, traces);
  const comprehension = scenario.scoreAnswers(rawAnswers);
  const passed = !transportError && statePassed && comprehension.passed;

  let postMortem;
  if (!params.skipPostMortem && !transportError && (phantoms.length > 0 || !passed)) {
    try {
      postMortem = await runPostMortem(driver, scenario, traces, passed, comprehension.checks);
    } catch {}
  }

  return {
    episodeId,
    scenarioId: scenario.id,
    modelId: driver.id,
    lineage: driver.lineage,
    specMode: spec.mode,
    passed,
    statePassed,
    comprehension,
    turns: traces.length,
    phantoms,
    defines: discovery.allDefines(),
    traces,
    ...(postMortem ? { postMortem } : {}),
    ...(transportError ? { transportError } : {}),
    durationMs: Math.round(performance.now() - t0),
    finalSummary,
  };
}

export async function runSweep(params: {
  drivers: readonly ModelDriver[];
  scenarios?: readonly ScenarioDef[];
  specMode: SpecMode;
  runDir: string;
  tag: string;
  resume?: boolean;
  onEpisode?: (ep: EpisodeResult) => void;
}): Promise<EpisodeResult[]> {
  const spec = await loadSurfaceSpec(params.specMode);
  const scenarios = params.scenarios ?? SCENARIOS;
  const allByDriver = await Promise.all(
    params.drivers.map(async driver => {
      const list: EpisodeResult[] = [];
      for (const scenario of scenarios) {
        const epPath = join(params.runDir, 'episodes', `${scenario.id}--${sanitizeSlug(driver.id)}.json`);
        if (params.resume && existsSync(epPath)) {
          const cached = JSON.parse(readFileSync(epPath, 'utf8')) as EpisodeResult;
          if (!cached.transportError) {
            list.push(cached);
            continue;
          }
        }
        const ep = await runEpisode({ driver, scenario, spec });
        writeEpisodeTrace(params.runDir, ep);
        params.onEpisode?.(ep);
        list.push(ep);
      }
      return list;
    }),
  );
  const episodes = allByDriver.flat();
  writeSweepArtifacts(params.runDir, params.tag, params.specMode, episodes);
  writePostMortemsMarkdown(params.runDir, episodes);
  return episodes;
}
