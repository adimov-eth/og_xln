import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'bun:test';
import { dispatchAction } from './engine/actions.ts';
import { createDiscoverySession } from './engine/discovery.ts';
import { parseJsonTurnCalls, runDetachedCli } from './drivers/driver-helpers.ts';
import { createFixtureState, settledCashOf, usd } from './engine/fixtures.ts';
import { dispatchToolCall, runEpisode } from './engine/loop.ts';
import { assertLocalProxyOrApprovedUrl, HERMES_DRIVERS } from './drivers/runners.ts';
import { getScenario, SCENARIOS } from './engine/scenarios.ts';
import { createScriptedDriver } from './drivers/scripted.ts';
import { loadSurfaceSpec } from './engine/surface-spec.ts';
import { rebuildReport } from './run.ts';
import type { EpisodeResult, LoadedSurfaceSpec, ModelDriver } from './types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

function withRefinedSignals(base: LoadedSurfaceSpec): LoadedSurfaceSpec {
  const supported = new Set(base.supportedActions);
  supported.add('request-link');
  return { ...base, mode: 'refined', supportedActions: supported };
}

describe('custdev-everyday eval harness', () => {
  test('Arrival Scheme Discovery REPL persists (define ...) across turns, stays isolated per episode, and reads live state', async () => {
    const spec = await loadSurfaceSpec('baseline');
    let state = createFixtureState('E1a_pay_across_buckets', 'baseline');
    const sessionA = createDiscoverySession(() => state, spec);
    const sessionB = createDiscoverySession(() => state, spec);

    const defRes = await sessionA.evalExpr('(define (available) (cash))');
    expect(defRes.outcome.success).toBe(true);
    expect(defRes.defines).toEqual(['(define (available) (cash))']);

    const callA = await sessionA.evalExpr('(available)');
    expect(callA.outcome.success).toBe(true);
    expect((callA.outcome.data as Record<string, unknown>)['cash-usd']).toBe(120);

    // Session B is isolated and cannot see session A's define
    const callB = await sessionB.evalExpr('(available)');
    expect(callB.outcome.success).toBe(false);
    expect(callB.outcome.phantomCategory).toBe('eval');

    // Mutate state and confirm sessionA re-evaluates live state (never stale cache)
    const paid = dispatchAction(state, spec, 'pay', { to: 'CornerCoffee', amount_usd: 65 });
    expect(paid.outcome.success).toBe(true);
    state = paid.state;

    const callAAfter = await sessionA.evalExpr('(available)');
    expect(callAAfter.outcome.success).toBe(true);
    expect((callAAfter.outcome.data as Record<string, unknown>)['cash-usd']).toBe(54.95);
  });

  test('classifies all 6 phantom categories deterministically', async () => {
    const spec = await loadSurfaceSpec('baseline');
    let state = createFixtureState('E2_friends_split_and_settle', 'baseline');
    const discovery = createDiscoverySession(() => state, spec);
    const ctx = { getState: () => state, setState: (s: typeof state) => { state = s; }, discovery, spec };

    // 1. unknown_action (tool name + baseline missing request-link + plumbing move-r2c)
    const uTool = await dispatchToolCall({ id: '1', name: 'click_button', argumentsRaw: '{}', parsedArgs: { intent: 'tap' } }, ctx);
    expect(uTool.outcome.phantomCategory).toBe('unknown_action');

    const uAct = await dispatchToolCall({ id: '2', name: 'act', argumentsRaw: '{}', parsedArgs: { intent: 'request', action: 'request-link', args: { amount_usd: 25 } } }, ctx);
    expect(uAct.outcome.phantomCategory).toBe('unknown_action');

    const uPlumb = await dispatchToolCall({ id: '3', name: 'act', argumentsRaw: '{}', parsedArgs: { intent: 'move', action: 'move-r2c', args: {} } }, ctx);
    expect(uPlumb.outcome.phantomCategory).toBe('unknown_action');

    // 2. validation (missing intent, stringified args, bad arg type)
    const vIntent = await dispatchToolCall({ id: '4', name: 'discover', argumentsRaw: '{}', parsedArgs: { expr: '(cash)' } }, ctx);
    expect(vIntent.outcome.phantomCategory).toBe('validation');

    const vStrArgs = await dispatchToolCall({ id: '5', name: 'act', argumentsRaw: '{}', parsedArgs: { intent: 'pay', action: 'pay', args: '{"to":"Sam","amount_usd":5}' } }, ctx);
    expect(vStrArgs.outcome.phantomCategory).toBe('validation');

    // 3. eval (unbound Scheme symbol & unknown screen)
    const eUnbound = await dispatchToolCall({ id: '6', name: 'discover', argumentsRaw: '{}', parsedArgs: { intent: 'check', expr: '(cover)' } }, ctx);
    expect(eUnbound.outcome.phantomCategory).toBe('eval');

    const eScreen = await dispatchToolCall({ id: '7', name: 'discover', argumentsRaw: '{}', parsedArgs: { intent: 'desk', expr: "(screen 'desk)" } }, ctx);
    expect(eScreen.outcome.phantomCategory).toBe('eval');

    // 4. parse (unterminated Scheme & malformed tool JSON & prose JSON-turn)
    const pScheme = await dispatchToolCall({ id: '8', name: 'discover', argumentsRaw: '{}', parsedArgs: { intent: 'bad', expr: '(cash' } }, ctx);
    expect(pScheme.outcome.phantomCategory).toBe('parse');

    const pToolJson = await dispatchToolCall({ id: '9', name: 'act', argumentsRaw: '{bad', parseError: 'Invalid JSON arguments' }, ctx);
    expect(pToolJson.outcome.phantomCategory).toBe('parse');
    expect(parseJsonTurnCalls('Sorry I cannot do that.')).toBeNull();

    // 5. runtime (settle-up on H1 hub rail, savings without accept_risk, fee above cap)
    const rHub = await dispatchToolCall({ id: '10', name: 'act', argumentsRaw: '{}', parsedArgs: { intent: 'settle hub', action: 'settle-up', args: { person: 'H1' } } }, ctx);
    expect(rHub.outcome.phantomCategory).toBe('runtime');

    const rConsent = await dispatchToolCall({ id: '11', name: 'act', argumentsRaw: '{}', parsedArgs: { intent: 'save', action: 'add-savings', args: { amount_usd: 10 } } }, ctx);
    expect(rConsent.outcome.phantomCategory).toBe('runtime');

    // 6. timeout (driver timeout recorded as timeout phantom in runEpisode)
    const timeoutDriver: ModelDriver = {
      id: 'mock-timeout',
      lineage: 'mock',
      lane: 'scripted',
      protocol: 'native-tools',
      tier: 'dry',
      nextTurn: async () => { throw new Error('TIMEOUT after 60000ms'); },
    };
    const epTimeout = await runEpisode({ driver: timeoutDriver, scenario: getScenario('E1a_pay_across_buckets'), spec, skipPostMortem: true });
    expect(epTimeout.transportError).toBeUndefined();
    expect(epTimeout.phantoms.filter(p => p.category === 'timeout').map(p => p.actionOrExpr)).toEqual(['turn', 'comprehension']);
    expect(epTimeout.passed).toBe(false);

    // Wrapped Hermes AbortSignal.timeout message classifies as timeout, not transportError
    const wrappedTimeoutDriver: ModelDriver = {
      ...timeoutDriver,
      id: 'mock-hermes-timeout',
      nextTurn: async ({ expectJsonAction }) => {
        if (expectJsonAction) throw new Error('google/gemini-2.5-pro: The operation timed out.');
        return { kind: 'text', text: '1. unknown\n2. unknown\n3. unknown', latencyMs: 1 };
      },
    };
    const epWrapped = await runEpisode({ driver: wrappedTimeoutDriver, scenario: getScenario('E1a_pay_across_buckets'), spec, skipPostMortem: true });
    expect(epWrapped.transportError).toBeUndefined();
    expect(epWrapped.phantoms.some(p => p.category === 'timeout')).toBe(true);

    const doneCall = [{ id: '1', name: 'done', argumentsRaw: '{}', parsedArgs: { intent: 'done', summary: 'ok' } }];
    const compErrDriver: ModelDriver = {
      ...timeoutDriver,
      id: 'mock-comp-err',
      nextTurn: async ({ expectJsonAction }) => expectJsonAction
        ? { kind: 'tool_calls', calls: doneCall, assistantMessage: { role: 'assistant', content: '' }, latencyMs: 1 }
        : Promise.reject(new Error('HTTP 500: down')),
    };
    const epCompErr = await runEpisode({ driver: compErrDriver, scenario: getScenario('E1a_pay_across_buckets'), spec, skipPostMortem: true });
    expect(epCompErr.transportError).toBe('Comprehension step failed: HTTP 500: down');
  });

  test('enforces unhappy path invariants: fee cap, L1 sweep rejection atomicity, offline hub arriving, and gas=0 boundary', async () => {
    const baseSpec = await loadSurfaceSpec('baseline');
    const refinedSpec = withRefinedSignals(baseSpec);

    // E1b: fee $3.50 > $2.00 cap
    const s1b = createFixtureState('E1b_pay_fee_above_cap', 'baseline');
    const res1b = dispatchAction(s1b, baseSpec, 'pay', { to: 'CornerCoffee', amount_usd: 25 });
    expect(res1b.outcome.success).toBe(false);
    expect(res1b.outcome.phantomCategory).toBe('runtime');
    expect(settledCashOf(res1b.state)).toBe(usd(120));

    // E1c: mid-sweep L1 reject preserves all 3 internal buckets after reload
    const s1c = createFixtureState('E1c_pay_l1_reject_reload', 'baseline');
    const res1c = dispatchAction(s1c, baseSpec, 'pay', { to: 'CornerCoffee', amount_usd: 50 });
    expect(res1c.outcome.success).toBe(false);
    expect(res1c.outcome.phantomCategory).toBe('runtime');
    expect(res1c.state.onchainMicroUsd).toBe(usd(90));
    expect(res1c.state.reserveMicroUsd).toBe(usd(10));
    expect(res1c.state.securedMicroUsd).toBe(usd(20));

    // E3b: offline hub keeps funds in arriving and refuses $10 pay
    const s3b = createFixtureState('E3b_offline_hub_keeps_arriving', 'baseline');
    const wait3b = dispatchAction(s3b, baseSpec, 'wait-settlement', {});
    expect(settledCashOf(wait3b.state)).toBe(0n);
    expect(wait3b.state.arrivingMicroUsd).toBe(usd(50));
    const pay3b = dispatchAction(wait3b.state, baseSpec, 'pay', { to: 'CornerCoffee', amount_usd: 10 });
    expect(pay3b.outcome.success).toBe(false);
    expect(pay3b.outcome.phantomCategory).toBe('runtime');

    // quote-pay / quote-cash-out reject non-positive amounts without leaking request-link
    const discS3a = createDiscoverySession(() => createFixtureState('E3a_newcomer_arriving_and_request', 'baseline'), baseSpec);
    for (const expr of ['(quote-pay "Maya" -25)', '(quote-pay "Maya" 0)', '(quote-cash-out -10)', '(quote-cash-out 0)']) {
      const q = await discS3a.evalExpr(expr);
      expect(q.outcome.success).toBe(false);
      expect(q.outcome.error).not.toContain('request-link');
    }

    // E6: baseline omits 0 ETH gas boundary while refined surfaces it
    const s6Base = createFixtureState('E6_offline_recovery_zero_gas', 'baseline');
    const discBase = await createDiscoverySession(() => s6Base, baseSpec).evalExpr('(activity)');
    expect(JSON.stringify(discBase.outcome.data)).not.toContain('0 ETH');

    const s6Ref = createFixtureState('E6_offline_recovery_zero_gas', 'refined');
    const discRef = await createDiscoverySession(() => s6Ref, refinedSpec).evalExpr('(activity)');
    expect(JSON.stringify(discRef.outcome.data)).toContain('0 ETH');
  });

  test('scripted smoke exposes baseline request-link gap + post-mortem and passes 10/10 when request-link is enabled', async () => {
    const baseSpec = await loadSurfaceSpec('baseline');
    const refinedSpec = withRefinedSignals(baseSpec);
    const driver = createScriptedDriver();

    const baseResults = [];
    for (const sc of SCENARIOS) baseResults.push(await runEpisode({ driver, scenario: sc, spec: baseSpec }));
    expect(baseResults.filter(r => r.passed)).toHaveLength(9);
    const e3aBase = baseResults.find(r => r.scenarioId === 'E3a_newcomer_arriving_and_request')!;
    expect(e3aBase.passed).toBe(false);
    expect(e3aBase.phantoms.some(p => p.category === 'unknown_action' && p.actionOrExpr === 'request-link')).toBe(true);
    expect(e3aBase.postMortem).toBeDefined();

    const refinedResults = [];
    for (const sc of SCENARIOS) refinedResults.push(await runEpisode({ driver, scenario: sc, spec: refinedSpec }));
    expect(refinedResults.filter(r => r.passed)).toHaveLength(10);
    const nonE1cPhantoms = refinedResults.filter(r => r.scenarioId !== 'E1c_pay_l1_reject_reload')
      .reduce((acc, r) => acc + r.phantoms.length, 0);
    expect(nonE1cPhantoms).toBe(0);
    expect(refinedResults.find(r => r.scenarioId === 'E1c_pay_l1_reject_reload')?.phantoms).toHaveLength(1);
  });

  test('enforces proxy guard, parses fenced + trailing-backslash JSON turns, and handles missing CLI binary cleanly', async () => {
    const blocked = `https://${['open', 'router', '.ai'].join('')}/api/v1`;
    expect(() => assertLocalProxyOrApprovedUrl(blocked)).toThrow(/FORBIDDEN_ENDPOINT/);
    expect(() => assertLocalProxyOrApprovedUrl('https://api.example.com/v1')).toThrow(/FORBIDDEN_ENDPOINT/);
    const fenced = '```json\n{"tool":"discover","intent":"check cash","expr":"(cash)"}\n```';
    const parsed = parseJsonTurnCalls(fenced);
    expect(parsed).not.toBeNull();
    expect(parsed![0]!.name).toBe('discover');
    expect(parsed![0]!.parsedArgs).toEqual({ intent: 'check cash', expr: '(cash)' });

    const actParsed = parseJsonTurnCalls('{"tool":"act","intent":"pay","action":"pay","args":{"to":"CornerCoffee","amount_usd":65}}');
    expect(actParsed).not.toBeNull();
    expect(actParsed![0]!.parsedArgs).toEqual({ intent: 'pay', action: 'pay', args: { to: 'CornerCoffee', amount_usd: 65 } });

    const escapedSlash = parseJsonTurnCalls('{"tool":"done","intent":"test","summary":"path\\\\"}');
    expect(escapedSlash).not.toBeNull();
    expect(escapedSlash![0]!.parsedArgs).toEqual({ intent: 'test', summary: 'path\\' });

    const proseWrapped = parseJsonTurnCalls('Result:\n{"tool":"done","intent":"test","summary":"path\\\\"}\nDone.');
    expect(proseWrapped).not.toBeNull();
    expect(proseWrapped![0]!.parsedArgs).toEqual({ intent: 'test', summary: 'path\\' });

    const missing = await runDetachedCli('nonexistent-binary-xyz', [], 5000);
    expect(missing.exitCode).toBe(127);

    const srv = Bun.serve({
      port: 0,
      fetch: () => new Response(new ReadableStream({ start: c => c.enqueue(new TextEncoder().encode('{"choices":[')) }), { status: 200 }),
    });
    const origFetch = globalThis.fetch;
    globalThis.fetch = ((_u, init) => origFetch(`http://127.0.0.1:${srv.port}`, { ...init, signal: AbortSignal.timeout(25) })) as typeof fetch;
    try {
      await expect(HERMES_DRIVERS[0]!.nextTurn({ systemPrompt: 's', messages: [{ role: 'user', content: 'hi' }], expectJsonAction: true })).rejects.toThrow(/TIMEOUT after 45000ms/);
    } finally {
      globalThis.fetch = origFetch;
      srv.stop(true);
    }
  });

  test('rebuildReport isolates --tag=baseline into runDir without overwriting curated baseline-report.md', () => {
    const reportPath = join(HERE, 'baseline-report.md');
    const sha = () => createHash('sha256').update(readFileSync(reportPath)).digest('hex');
    const before = sha();
    const tmp = mkdtempSync(join(tmpdir(), 'custdev-report-iso-'));
    try {
      const epDest = join(tmp, 'baseline', 'episodes');
      mkdirSync(epDest, { recursive: true });
      const srcDir = join(HERE, 'runs', 'baseline', 'episodes');
      const firstEp = readdirSync(srcDir).filter(f => f.endsWith('.json')).sort()[0]!;
      copyFileSync(join(srcDir, firstEp), join(epDest, firstEp));
      rebuildReport(['--tag=baseline'], tmp);
      for (const f of ['report.md', 'summary.json', 'phantoms.json', 'postmortems.md']) expect(existsSync(join(tmp, 'baseline', f))).toBe(true);
      expect(sha()).toBe(before);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('reconciles baseline-surface-snapshot.json and runs/baseline/ episodes with curated baseline-report.md', async () => {
    const baseSpec = await loadSurfaceSpec('baseline');
    const snap = JSON.parse(readFileSync(join(HERE, 'baseline-surface-snapshot.json'), 'utf8')) as { capturedAt: string };
    expect(snap.capturedAt).toBe('2026-11-18T23:38:00Z');
    expect(Object.keys(baseSpec.screens)).toEqual(['home', 'people', 'earn', 'activity']);
    expect('request-link' in baseSpec.flows).toBe(false);
    expect(baseSpec.supportedActions.has('request-link')).toBe(false);

    const epDir = join(HERE, 'runs', 'baseline', 'episodes');
    const eps = readdirSync(epDir).filter(f => f.endsWith('.json')).sort().map(f => JSON.parse(readFileSync(join(epDir, f), 'utf8')) as EpisodeResult);
    expect(eps).toHaveLength(110);
    const summary = JSON.parse(readFileSync(join(HERE, 'runs', 'baseline', 'summary.json'), 'utf8'));
    const phantoms = JSON.parse(readFileSync(join(HERE, 'runs', 'baseline', 'phantoms.json'), 'utf8'));
    expect(summary.totalEpisodes).toBe(110);
    expect(summary.passedEpisodes).toBe(eps.filter(e => e.passed).length);
    expect(summary.statePassedEpisodes).toBe(eps.filter(e => e.statePassed).length);
    expect(summary.comprehensionPassedEpisodes).toBe(eps.filter(e => e.comprehension.passed).length);
    expect(summary.transportErrors).toBe(0);
    expect(summary.totalPhantoms).toBe(eps.reduce((acc, e) => acc + e.phantoms.length, 0));
    expect(Object.values(summary.phantomCountsByCategory as Record<string, number>).reduce((a, b) => a + b, 0)).toBe(summary.totalPhantoms);
    expect(summary.crossModelPhantomCount).toBe(phantoms.filter((p: { isCrossModel: boolean }) => p.isCrossModel).length);

    const reportMd = readFileSync(join(HERE, 'baseline-report.md'), 'utf8');
    expect(reportMd).toContain(`${summary.passedEpisodes}/${summary.totalEpisodes}`);
    expect(reportMd).toContain(`**${summary.totalPhantoms}**`);
    expect(reportMd).toContain('## 4. Top Cross-Model Phantoms & Phase 7 Post-Mortem Insights');
    expect(reportMd).toContain('## 5. Concrete Recommendations for M2b (Phase 1 Spec + Surface Refinement)');
  });
});
