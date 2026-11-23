import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, test } from 'bun:test';
import { createScriptedDriver } from './drivers/scripted.ts';
import { writeEpisodeTrace, writeSweepArtifacts } from './engine/collector.ts';
import { compareRuns } from './engine/compare.ts';
import { createDiscoverySession } from './engine/discovery.ts';
import { createFixtureState } from './engine/fixtures.ts';
import { runSweep } from './engine/loop.ts';
import { loadSurfaceSpec } from './engine/surface-spec.ts';
import type { EpisodeResult } from './types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

describe('custdev-everyday refined surface & comparison', () => {
  test('preserves baseline discovery contracts identically', async () => {
    const baseSpec = await loadSurfaceSpec('baseline');
    expect(baseSpec.supportedActions.has('request-link')).toBe(false);
    const state = createFixtureState('E5a_external_checkout_approve', 'baseline');
    const disc = createDiscoverySession(() => state, baseSpec);

    const acts = await disc.evalExpr('(actions)');
    expect(acts.outcome.success).toBe(true);
    expect(Array.isArray(acts.outcome.data)).toBe(true);
    expect((acts.outcome.data as string[])).not.toContain('request-link');

    const helpPay = await disc.evalExpr("(help 'pay)");
    expect(helpPay.outcome.success).toBe(false);
    expect(helpPay.outcome.phantomCategory).toBe('eval');

    const badScreen = await disc.evalExpr("(screen 'external-request)");
    expect(badScreen.outcome.success).toBe(false);
    expect(badScreen.outcome.error).toContain('external-request, settings');
  });

  test('loads refined spec directly from updated everyday.scm & base.scm', async () => {
    const spec = await loadSurfaceSpec('refined');
    expect(spec.mode).toBe('refined');
    expect(spec.supportedActions.has('request-link')).toBe(true);
    expect(spec.screens.home?.actions).toContain('request-link');
    expect(spec.screens.home?.figures).toContain('arriving-cash');
    expect(spec.defaults.some(d => d.id === 'bounded-hub-transit-buffer')).toBe(true);
  });

  test('refined (screen ...) eliminates external-request/settings ghosts and redirects aliases', async () => {
    const spec = await loadSurfaceSpec('refined');
    const state = createFixtureState('E5a_external_checkout_approve', 'refined');
    const disc = createDiscoverySession(() => state, spec);

    for (const alias of ['external-request', 'requests', 'pending-requests', 'pending', 'request']) {
      const res = await disc.evalExpr(`(screen '${alias})`);
      expect(res.outcome.success).toBe(false);
      expect(res.outcome.phantomCategory).toBe('eval');
      expect(res.outcome.error).toContain('Available screens: home, people, earn, activity');
      expect(res.outcome.error).not.toContain('Available screens: home, people, earn, activity, external-request');
      expect(res.outcome.error).toContain('(pending-requests)');
    }

    const sav = await disc.evalExpr("(screen 'savings)");
    expect(sav.outcome.success).toBe(false);
    expect(sav.outcome.error).toContain("(screen 'earn)");

    const fr = await disc.evalExpr("(screen 'friends)");
    expect(fr.outcome.success).toBe(false);
    expect(fr.outcome.error).toContain("(screen 'people)");

    const cfg = await disc.evalExpr("(screen 'settings)");
    expect(cfg.outcome.success).toBe(false);
    expect(cfg.outcome.error).toContain("(screen 'activity)");

    const home = await disc.evalExpr("(screen 'home)");
    expect(home.outcome.success).toBe(true);
    const homeData = home.outcome.data as { buttons: string[]; cash: Record<string, unknown>; 'pending-requests-hint'?: string };
    expect(homeData.buttons).toContain('Request');
    expect(homeData.cash['transit-policy']).toBe('$250 transit cap · $1 immediate auto-settle');
    expect(homeData['pending-requests-hint']).toContain('(pending-requests)');
  });

  test('refined (actions ...) and (help ...) accept optional args and expose exact schemas', async () => {
    const spec = await loadSurfaceSpec('refined');
    const state = createFixtureState('E2_friends_split_and_settle', 'refined');
    const disc = createDiscoverySession(() => state, spec);

    const allActs = await disc.evalExpr('(actions)');
    expect(allActs.outcome.success).toBe(true);
    const list = (allActs.outcome.data as { actions: Array<{ action: string; args: string; quote?: string }> }).actions;
    expect(list).toHaveLength(13);
    expect(list.find(a => a.action === 'pay')?.quote).toContain('quote-pay');
    expect(list.find(a => a.action === 'split-bill')?.args).toContain('total_usd');
    expect(list.find(a => a.action === 'add-savings')?.args).toContain('accept_risk: true');

    const single = await disc.evalExpr("(actions 'split-bill)");
    expect(single.outcome.success).toBe(true);
    expect((single.outcome.data as { action: string }).action).toBe('split-bill');

    const strSingle = await disc.evalExpr('(actions "pay")');
    expect(strSingle.outcome.success).toBe(true);
    expect((strSingle.outcome.data as { action: string }).action).toBe('pay');

    const badAct = await disc.evalExpr("(actions 'nonexistent)");
    expect(badAct.outcome.success).toBe(false);

    for (const expr of [
      '(help)',
      "(help 'pay)",
      '(help "pay")',
      "(help 'split-bill)",
      "(help 'screen)",
      '(help screen)',
      "(help 'unknown-topic)",
    ]) {
      const h = await disc.evalExpr(expr);
      expect(h.outcome.success).toBe(true);
    }
  });

  test('refined disclosures: E3a arriving separation, E4 savings consent, and E6 gas-honest recovery without watchtower jargon', async () => {
    const spec = await loadSurfaceSpec('refined');

    const s3a = createFixtureState('E3a_newcomer_arriving_and_request', 'refined');
    const cash3a = await createDiscoverySession(() => s3a, spec).evalExpr('(cash)');
    expect(cash3a.outcome.success).toBe(true);
    expect((cash3a.outcome.data as Record<string, unknown>)['cash-usd']).toBe(0);
    expect((cash3a.outcome.data as Record<string, unknown>)['arriving-usd']).toBe(50);

    const s4 = createFixtureState('E4_savings_optin_consent', 'refined');
    const disc4 = createDiscoverySession(() => s4, spec);
    const sav4 = await disc4.evalExpr('(savings)');
    expect(sav4.outcome.success).toBe(true);
    const savData = sav4.outcome.data as Record<string, unknown>;
    expect(savData['required-consent-param']).toEqual({ accept_risk: true });
    expect(String(savData.note)).toContain('NOT protected like Cash');

    const s6 = createFixtureState('E6_offline_recovery_zero_gas', 'refined');
    const act6 = await createDiscoverySession(() => s6, spec).evalExpr('(activity)');
    expect(act6.outcome.success).toBe(true);
    const actText = JSON.stringify(act6.outcome.data);
    expect(actText).toContain('0 ETH');
    expect(actText.toLowerCase()).toContain('recovery service');
    expect(actText.toLowerCase()).not.toContain('watchtower');
  });

  test('refined scripted dry-run passes 10/10 with only the expected E1c L1-reject phantom', async () => {
    const tmp = mkdtempSync(join(tmpdir(), 'custdev-refined-dry-'));
    try {
      const episodes = await runSweep({
        drivers: [createScriptedDriver()],
        specMode: 'refined',
        runDir: tmp,
        tag: 'dry-refined',
      });
      expect(episodes.filter(e => e.passed)).toHaveLength(10);
      const nonE1c = episodes.filter(e => e.scenarioId !== 'E1c_pay_l1_reject_reload').reduce((n, e) => n + e.phantoms.length, 0);
      expect(nonE1c).toBe(0);
      expect(episodes.find(e => e.scenarioId === 'E1c_pay_l1_reject_reload')?.phantoms).toHaveLength(1);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('compareRuns builds comparison.md with deltas without touching baseline-report.md', () => {
    const reportPath = join(HERE, 'baseline-report.md');
    const shaBefore = createHash('sha256').update(readFileSync(reportPath)).digest('hex');
    const tmp = mkdtempSync(join(tmpdir(), 'custdev-compare-'));
    try {
      const baseEps: EpisodeResult[] = [
        mkTestEp('E3a_newcomer_arriving_and_request', 'm1', 'lin-a', false, [
          mkPhantom('E3a_newcomer_arriving_and_request', 'm1', 'lin-a', 'baseline', 'unknown_action', 'request-link'),
          mkPhantom('E3a_newcomer_arriving_and_request', 'm2', 'lin-b', 'baseline', 'unknown_action', 'request-link'),
        ]),
      ];
      const refEps: EpisodeResult[] = [mkTestEp('E3a_newcomer_arriving_and_request', 'm1', 'lin-a', true, [])];
      mkdirSync(join(tmp, 'baseline'), { recursive: true });
      mkdirSync(join(tmp, 'refined'), { recursive: true });
      writeSweepArtifacts(join(tmp, 'baseline'), 'baseline', 'baseline', baseEps);
      writeSweepArtifacts(join(tmp, 'refined'), 'refined', 'refined', refEps);
      writeFileSync(join(tmp, 'baseline', 'sentinel.txt'), 'untouched', 'utf8');

      const { outPath, metrics } = compareRuns({ runsRoot: tmp });
      expect(metrics.overall.passedEpisodes.delta).toBe(1);
      expect(metrics.overall.totalPhantoms.delta).toBe(-2);
      expect(metrics.eliminatedCrossModel.map(r => r.actionOrExpr)).toContain('request-link');
      const md = readFileSync(outPath, 'utf8');
      expect(md).toContain('## Eliminated Cross-Model Phantoms');
      expect(md).toContain('`request-link`');
      expect(readFileSync(join(tmp, 'baseline', 'sentinel.txt'), 'utf8')).toBe('untouched');
      expect(createHash('sha256').update(readFileSync(reportPath)).digest('hex')).toBe(shaBefore);
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('compareRuns renders reducedCrossModel and ranks reductions ahead of >20 single-model +1 items', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'custdev-reduced-'));
    try {
      const s = 'E2_friends_split_and_settle';
      const baseSplit = Array.from({ length: 10 }, (_, i) => mkPhantom(s, i < 5 ? 'm1' : 'm2', i < 5 ? 'lin-a' : 'lin-b', 'baseline', 'validation', 'split-bill'));
      const baseReq = Array.from({ length: 4 }, (_, i) => mkPhantom(s, i < 2 ? 'm1' : 'm2', i < 2 ? 'lin-a' : 'lin-b', 'baseline', 'eval', "(screen 'requests)"));
      const new1Offs = Array.from({ length: 25 }, (_, i) => mkPhantom(s, 'm1', 'lin-a', 'refined', 'eval', `(new-1off-${String(i).padStart(2, '0')})`));
      const baseEps = [mkTestEp(s, 'm1', 'lin-a', false, [...baseSplit, ...baseReq])];
      const refEps = [mkTestEp(s, 'm1', 'lin-a', true, [
        mkPhantom(s, 'm1', 'lin-a', 'refined', 'validation', 'split-bill'),
        mkPhantom(s, 'm1', 'lin-a', 'refined', 'eval', "(screen 'requests)"),
        ...new1Offs,
      ])];
      writeSweepArtifacts(join(tmp, 'baseline'), 'baseline', 'baseline', baseEps);
      writeSweepArtifacts(join(tmp, 'refined'), 'refined', 'refined', refEps);

      const { outPath, metrics } = compareRuns({ runsRoot: tmp });
      expect(metrics.reducedCrossModel.map(r => r.key)).toEqual(['validation::split-bill', "eval::(screen 'requests)"]);
      const md = readFileSync(outPath, 'utf8');
      expect(md).toContain('## Reduced Cross-Model Phantoms');
      expect(md).toContain('| validation | `split-bill` | 10 | 1 | -9 | 2 -> 1 |');
      expect(md).toContain("| eval | `(screen 'requests)` | 4 | 1 | -3 | 2 -> 1 |");
      const resSection = md.split('## Residual & New Phantoms')[1] ?? '';
      expect(resSection).toContain('`split-bill`');
      expect(resSection.indexOf('`split-bill`')).toBeLessThan(resSection.indexOf('`new-1off-00`') === -1 ? Infinity : resSection.indexOf('`new-1off-00`'));
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });

  test('compareRuns isolates transportError episodes and unmatched denominators in matched non-error cohort', () => {
    const tmp = mkdtempSync(join(tmpdir(), 'custdev-cohort-'));
    try {
      const b1 = mkTestEp('E1a_pay_across_buckets', 'm1', 'lin-a', true, []);
      const b2 = mkTestEp('E1b_pay_fee_above_cap', 'm1', 'lin-a', false, [
        mkPhantom('E1b_pay_fee_above_cap', 'm1', 'lin-a', 'baseline', 'runtime', 'pay'),
        mkPhantom('E1b_pay_fee_above_cap', 'm1', 'lin-a', 'baseline', 'runtime', 'pay'),
        mkPhantom('E1b_pay_fee_above_cap', 'm1', 'lin-a', 'baseline', 'eval', '(cash)'),
      ]);
      const b3 = mkTestEp('E1c_pay_l1_reject_reload', 'm1', 'lin-a', false, [
        mkPhantom('E1c_pay_l1_reject_reload', 'm1', 'lin-a', 'baseline', 'runtime', 'pay'),
        mkPhantom('E1c_pay_l1_reject_reload', 'm1', 'lin-a', 'baseline', 'runtime', 'pay'),
        mkPhantom('E1c_pay_l1_reject_reload', 'm1', 'lin-a', 'baseline', 'runtime', 'pay'),
        mkPhantom('E1c_pay_l1_reject_reload', 'm1', 'lin-a', 'baseline', 'runtime', 'pay'),
      ]);
      const b4 = mkTestEp('E1a_pay_across_buckets', 'm2', 'lin-b', false, [
        mkPhantom('E1a_pay_across_buckets', 'm2', 'lin-b', 'baseline', 'eval', '(cash)'),
        mkPhantom('E1a_pay_across_buckets', 'm2', 'lin-b', 'baseline', 'eval', '(cash)'),
      ]);
      const r1 = mkTestEp('E1a_pay_across_buckets', 'm1', 'lin-a', true, []);
      const r2 = mkTestEp('E1b_pay_fee_above_cap', 'm1', 'lin-a', true, []);
      const r3 = { ...mkTestEp('E1c_pay_l1_reject_reload', 'm1', 'lin-a', false, []), transportError: 'HTTP 402 exhausted' };

      const baseEps = [b1, b2, b3, b4];
      const refEps = [r1, r2, r3];
      for (const ep of baseEps) writeEpisodeTrace(join(tmp, 'baseline'), ep);
      for (const ep of refEps) writeEpisodeTrace(join(tmp, 'refined'), ep);
      writeSweepArtifacts(join(tmp, 'baseline'), 'baseline', 'baseline', baseEps);
      writeSweepArtifacts(join(tmp, 'refined'), 'refined', 'refined', refEps);

      const { outPath, metrics } = compareRuns({ runsRoot: tmp });
      expect(metrics.matchedCohort?.matchedPairs).toBe(2);
      expect(metrics.matchedCohort?.excludedErrorPairs).toBe(1);
      expect(metrics.matchedCohort?.unmatchedBaselineOnly).toBe(1);
      expect(metrics.matchedCohort?.passed).toEqual({ baseline: 1, refined: 2, delta: 1 });
      expect(metrics.matchedCohort?.passRateDeltaPp).toBe(50);
      expect(metrics.matchedCohort?.phantoms).toEqual({ baseline: 3, refined: 0, delta: -3 });
      expect(metrics.models.find(m => m.modelId === 'm1')?.phantomDelta).toBeNull();
      expect(metrics.models.find(m => m.modelId === 'm1')?.matchedPhantomDelta).toBe(-3);
      expect(metrics.models.find(m => m.modelId === 'm2')?.phantomDelta).toBeNull();
      const md = readFileSync(outPath, 'utf8');
      expect(md).toContain('## Matched Non-Error Cohort');
      expect(md).toContain('| Episodes Passed | 1/2 (50%) | 2/2 (100%) | +1 (+50pp) |');
      expect(md).toContain('### Transport-Error Isolation (Excluded from Matched Cohort)');
      expect(md).toContain('excluded (matched 2: -3)');
      expect(md).toContain('unmatched 1v0');
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  });
});

function mkPhantom(scenarioId: EpisodeResult['scenarioId'], modelId: string, lineage: string, specMode: EpisodeResult['specMode'], category: EpisodeResult['phantoms'][number]['category'], actionOrExpr: string): EpisodeResult['phantoms'][number] {
  return { episodeId: `${scenarioId}--${modelId}`, scenarioId, modelId, lineage, specMode, turn: 1, tool: 'act', actionOrExpr, intent: 'test', category, error: 'err' };
}

function mkTestEp(id: EpisodeResult['scenarioId'], modelId: string, lineage: string, passed: boolean, phantoms: EpisodeResult['phantoms']): EpisodeResult {
  return {
    episodeId: `${id}--${modelId}`, scenarioId: id, modelId, lineage, specMode: passed ? 'refined' : 'baseline',
    passed, statePassed: passed, comprehension: { passed, checks: { ok: passed }, rawAnswers: '' },
    turns: passed ? 2 : 5, phantoms, defines: [], traces: [], durationMs: 10, finalSummary: 'ok',
  };
}
