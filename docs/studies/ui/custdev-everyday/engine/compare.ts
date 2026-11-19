import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { PhantomAggregate, SweepSummary } from './collector.ts';
import { type EpisodeResult, PHANTOM_CATEGORIES, type PhantomCategory, type ScenarioId } from '../types.ts';

const DEFAULT_RUNS_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'runs');

export interface MetricDelta { baseline: number; refined: number; delta: number; }

export interface PhantomComparisonRow {
  key: string; category: PhantomCategory; actionOrExpr: string;
  baselineCount: number; refinedCount: number; delta: number;
  baselineLineages: number; refinedLineages: number;
}

export interface MatchedCohortModelRow {
  modelId: string; baselineErrors: number; refinedErrors: number; matchedPairs: number;
  matchedBasePassed: number; matchedRefPassed: number;
  matchedBasePhantoms: number; matchedRefPhantoms: number;
  excludedBasePhantoms: number; excludedRefPhantoms: number;
}

export interface MatchedCohortMetrics {
  matchedPairs: number; excludedErrorPairs: number; unmatchedBaselineOnly: number; unmatchedRefinedOnly: number;
  passed: MetricDelta; statePassed: MetricDelta; comprehensionPassed: MetricDelta; phantoms: MetricDelta;
  passRateBaselinePct: number; passRateRefinedPct: number; passRateDeltaPp: number;
  isolatedModels: MatchedCohortModelRow[];
}

export interface ComparisonMetrics {
  baselineTag: string; refinedTag: string; generatedAt: string;
  overall: {
    totalEpisodes: MetricDelta; passedEpisodes: MetricDelta; statePassedEpisodes: MetricDelta;
    comprehensionPassedEpisodes: MetricDelta; totalPhantoms: MetricDelta;
    crossModelPhantomCount: MetricDelta; transportErrors: MetricDelta;
    passRateBaselinePct: number; passRateRefinedPct: number; passRateDeltaPp: number;
  };
  matchedCohort: MatchedCohortMetrics | null;
  categories: Array<{ category: PhantomCategory } & MetricDelta>;
  scenarios: Array<{
    scenarioId: ScenarioId; baselinePassed: number; baselineEpisodes: number;
    refinedPassed: number; refinedEpisodes: number; baselinePhantoms: number; refinedPhantoms: number; phantomDelta: number;
  }>;
  models: Array<{
    modelId: string; lineage: string; baselinePassed: number; baselineEpisodes: number;
    refinedPassed: number; refinedEpisodes: number; baselineAvgTurns: number; refinedAvgTurns: number;
    baselinePhantoms: number; refinedPhantoms: number; baselineTransportErrors: number; refinedTransportErrors: number;
    phantomDelta: number | null; matchedPairs: number | null; matchedPhantomDelta: number | null;
  }>;
  eliminatedCrossModel: PhantomComparisonRow[];
  reducedCrossModel: PhantomComparisonRow[];
  residualOrNew: PhantomComparisonRow[];
}

const deltaOf = (baseline: number, refined: number): MetricDelta => ({ baseline, refined, delta: refined - baseline });
const pct = (num: number, den: number): number => (den === 0 ? 0 : Number(((num / den) * 100).toFixed(1)));
const fmtSigned = (n: number): string => (n > 0 ? `+${n}` : `${n}`);
const esc = (s: string): string => s.replace(/\|/g, '/');
const mdTable = (headers: readonly string[], align: readonly string[], rows: readonly string[][]): string[] => [
  `| ${headers.join(' | ')} |`,
  `|${align.join('|')}|`,
  ...rows.map(r => `| ${r.join(' | ')} |`),
];

function computeMatchedCohort(
  baseEps: readonly EpisodeResult[],
  refEps: readonly EpisodeResult[],
): { cohort: MatchedCohortMetrics; byModel: Map<string, MatchedCohortModelRow> } {
  const key = (e: EpisodeResult) => `${e.scenarioId}::${e.modelId}`;
  const bMap = new Map(baseEps.map(e => [key(e), e]));
  const rMap = new Map(refEps.map(e => [key(e), e]));
  const byModel = new Map<string, MatchedCohortModelRow>();
  const rowOf = (modelId: string): MatchedCohortModelRow => {
    let row = byModel.get(modelId);
    if (!row) {
      row = { modelId, baselineErrors: 0, refinedErrors: 0, matchedPairs: 0, matchedBasePassed: 0, matchedRefPassed: 0, matchedBasePhantoms: 0, matchedRefPhantoms: 0, excludedBasePhantoms: 0, excludedRefPhantoms: 0 };
      byModel.set(modelId, row);
    }
    return row;
  };
  let matchedPairs = 0, excludedErrorPairs = 0, unmatchedBaselineOnly = 0, unmatchedRefinedOnly = 0;
  let bPass = 0, rPass = 0, bState = 0, rState = 0, bComp = 0, rComp = 0, bPh = 0, rPh = 0;
  for (const [k, b] of bMap) {
    const r = rMap.get(k);
    if (!r) { unmatchedBaselineOnly++; continue; }
    const m = rowOf(b.modelId);
    if (b.transportError || r.transportError) {
      excludedErrorPairs++;
      if (b.transportError) m.baselineErrors++;
      if (r.transportError) m.refinedErrors++;
      m.excludedBasePhantoms += b.phantoms.length;
      m.excludedRefPhantoms += r.phantoms.length;
      continue;
    }
    matchedPairs++; m.matchedPairs++;
    if (b.passed) { bPass++; m.matchedBasePassed++; }
    if (r.passed) { rPass++; m.matchedRefPassed++; }
    if (b.statePassed) bState++;
    if (r.statePassed) rState++;
    if (b.comprehension.passed) bComp++;
    if (r.comprehension.passed) rComp++;
    bPh += b.phantoms.length; rPh += r.phantoms.length;
    m.matchedBasePhantoms += b.phantoms.length; m.matchedRefPhantoms += r.phantoms.length;
  }
  for (const k of rMap.keys()) if (!bMap.has(k)) unmatchedRefinedOnly++;
  const passRateBaselinePct = pct(bPass, matchedPairs), passRateRefinedPct = pct(rPass, matchedPairs);
  return {
    byModel,
    cohort: {
      matchedPairs, excludedErrorPairs, unmatchedBaselineOnly, unmatchedRefinedOnly,
      passed: deltaOf(bPass, rPass), statePassed: deltaOf(bState, rState),
      comprehensionPassed: deltaOf(bComp, rComp), phantoms: deltaOf(bPh, rPh),
      passRateBaselinePct, passRateRefinedPct,
      passRateDeltaPp: Number((passRateRefinedPct - passRateBaselinePct).toFixed(1)),
      isolatedModels: [...byModel.values()].filter(m => m.baselineErrors > 0 || m.refinedErrors > 0).sort((a, b) => a.modelId.localeCompare(b.modelId)),
    },
  };
}

export function buildComparison(
  baselineSummary: SweepSummary,
  baselinePhantoms: readonly PhantomAggregate[],
  refinedSummary: SweepSummary,
  refinedPhantoms: readonly PhantomAggregate[],
  opts: { baselineEpisodes?: readonly EpisodeResult[]; refinedEpisodes?: readonly EpisodeResult[] } = {},
): ComparisonMetrics {
  const matched = opts.baselineEpisodes && opts.refinedEpisodes ? computeMatchedCohort(opts.baselineEpisodes, opts.refinedEpisodes) : null;
  const categories = PHANTOM_CATEGORIES.map(category => ({
    category, ...deltaOf(baselineSummary.phantomCountsByCategory[category] ?? 0, refinedSummary.phantomCountsByCategory[category] ?? 0),
  }));
  const refScenMap = new Map(refinedSummary.byScenario.map(s => [s.scenarioId, s]));
  const baseScenMap = new Map(baselineSummary.byScenario.map(s => [s.scenarioId, s]));
  const scenarios = [...new Set([...baseScenMap.keys(), ...refScenMap.keys()])].map(scenarioId => {
    const b = baseScenMap.get(scenarioId), r = refScenMap.get(scenarioId), bp = b?.phantoms ?? 0, rp = r?.phantoms ?? 0;
    return { scenarioId, baselinePassed: b?.passed ?? 0, baselineEpisodes: b?.episodes ?? 0, refinedPassed: r?.passed ?? 0, refinedEpisodes: r?.episodes ?? 0, baselinePhantoms: bp, refinedPhantoms: rp, phantomDelta: rp - bp };
  });
  const baseModelMap = new Map(baselineSummary.byModel.map(m => [m.modelId, m]));
  const refModelMap = new Map(refinedSummary.byModel.map(m => [m.modelId, m]));
  const models = [...new Set([...baseModelMap.keys(), ...refModelMap.keys()])].map(modelId => {
    const b = baseModelMap.get(modelId), r = refModelMap.get(modelId), mc = matched?.byModel.get(modelId);
    const bEp = b?.episodes ?? 0, rEp = r?.episodes ?? 0, bp = b?.phantoms ?? 0, rp = r?.phantoms ?? 0;
    const bErr = b?.transportErrors ?? 0, rErr = r?.transportErrors ?? 0;
    return {
      modelId, lineage: r?.lineage ?? b?.lineage ?? 'unknown',
      baselinePassed: b?.passed ?? 0, baselineEpisodes: bEp, refinedPassed: r?.passed ?? 0, refinedEpisodes: rEp,
      baselineAvgTurns: b?.avgTurns ?? 0, refinedAvgTurns: r?.avgTurns ?? 0,
      baselinePhantoms: bp, refinedPhantoms: rp, baselineTransportErrors: bErr, refinedTransportErrors: rErr,
      phantomDelta: bEp === rEp && bErr === 0 && rErr === 0 ? rp - bp : null,
      matchedPairs: mc ? mc.matchedPairs : null,
      matchedPhantomDelta: mc && mc.matchedPairs > 0 ? mc.matchedRefPhantoms - mc.matchedBasePhantoms : null,
    };
  });
  const basePhantomMap = new Map(baselinePhantoms.map(p => [p.key, p]));
  const refPhantomMap = new Map(refinedPhantoms.map(p => [p.key, p]));
  const rows: PhantomComparisonRow[] = [...new Set([...basePhantomMap.keys(), ...refPhantomMap.keys()])].map(key => {
    const b = basePhantomMap.get(key), r = refPhantomMap.get(key), bc = b?.count ?? 0, rc = r?.count ?? 0;
    return { key, category: (r ?? b)!.category, actionOrExpr: (r ?? b)!.actionOrExpr, baselineCount: bc, refinedCount: rc, delta: rc - bc, baselineLineages: b?.lineages.length ?? 0, refinedLineages: r?.lineages.length ?? 0 };
  });
  const passRateBaselinePct = pct(baselineSummary.passedEpisodes, baselineSummary.totalEpisodes);
  const passRateRefinedPct = pct(refinedSummary.passedEpisodes, refinedSummary.totalEpisodes);
  return {
    baselineTag: baselineSummary.tag, refinedTag: refinedSummary.tag, generatedAt: new Date().toISOString(),
    overall: {
      totalEpisodes: deltaOf(baselineSummary.totalEpisodes, refinedSummary.totalEpisodes),
      passedEpisodes: deltaOf(baselineSummary.passedEpisodes, refinedSummary.passedEpisodes),
      statePassedEpisodes: deltaOf(baselineSummary.statePassedEpisodes, refinedSummary.statePassedEpisodes),
      comprehensionPassedEpisodes: deltaOf(baselineSummary.comprehensionPassedEpisodes, refinedSummary.comprehensionPassedEpisodes),
      totalPhantoms: deltaOf(baselineSummary.totalPhantoms, refinedSummary.totalPhantoms),
      crossModelPhantomCount: deltaOf(baselineSummary.crossModelPhantomCount, refinedSummary.crossModelPhantomCount),
      transportErrors: deltaOf(baselineSummary.transportErrors, refinedSummary.transportErrors),
      passRateBaselinePct, passRateRefinedPct,
      passRateDeltaPp: Number((passRateRefinedPct - passRateBaselinePct).toFixed(1)),
    },
    matchedCohort: matched?.cohort ?? null, categories, scenarios, models,
    eliminatedCrossModel: rows.filter(r => (basePhantomMap.get(r.key)?.isCrossModel ?? false) && r.refinedCount === 0).sort((a, b) => b.baselineCount - a.baselineCount),
    reducedCrossModel: rows.filter(r => (basePhantomMap.get(r.key)?.isCrossModel ?? false) && r.refinedCount > 0 && r.delta < 0).sort((a, b) => a.delta - b.delta || b.baselineCount - a.baselineCount),
    residualOrNew: rows.filter(r => r.refinedCount > 0).sort((a, b) => b.refinedCount - a.refinedCount || a.delta - b.delta || b.baselineCount - a.baselineCount || a.key.localeCompare(b.key)),
  };
}

function renderMatchedCohortSection(m: ComparisonMetrics): string[] {
  const mc = m.matchedCohort, o = m.overall;
  if (!mc) {
    const hasSkew = o.transportErrors.baseline > 0 || o.transportErrors.refined > 0 || o.totalEpisodes.baseline !== o.totalEpisodes.refined || m.models.some(x => x.baselineEpisodes !== x.refinedEpisodes);
    return ['## Matched Non-Error Cohort', hasSkew
      ? `Episode files unavailable; raw totals include unmatched/error skew (baseline=${o.totalEpisodes.baseline}, transportErrors=${o.transportErrors.baseline}; refined=${o.totalEpisodes.refined}, transportErrors=${o.transportErrors.refined}).`
      : `Episode files unavailable; denominators match (${o.totalEpisodes.baseline} episodes, 0 transport errors).`];
  }
  const lines = [
    '## Matched Non-Error Cohort',
    `Matched non-error pairs (\`transportError == null\` in both runs): **${mc.matchedPairs}** (excluded transport-error pairs: **${mc.excludedErrorPairs}**; unmatched pairs: ${mc.unmatchedBaselineOnly} baseline-only, ${mc.unmatchedRefinedOnly} refined-only).`,
    '', ...mdTable(['Metric', 'Baseline', 'Refined', 'Delta'], ['---', '---:', '---:', '---:'], [
      ['Episodes Passed', `${mc.passed.baseline}/${mc.matchedPairs} (${mc.passRateBaselinePct}%)`, `${mc.passed.refined}/${mc.matchedPairs} (${mc.passRateRefinedPct}%)`, `${fmtSigned(mc.passed.delta)} (${fmtSigned(mc.passRateDeltaPp)}pp)`],
      ['State Passed', `${mc.statePassed.baseline}/${mc.matchedPairs}`, `${mc.statePassed.refined}/${mc.matchedPairs}`, fmtSigned(mc.statePassed.delta)],
      ['Comprehension Passed', `${mc.comprehensionPassed.baseline}/${mc.matchedPairs}`, `${mc.comprehensionPassed.refined}/${mc.matchedPairs}`, fmtSigned(mc.comprehensionPassed.delta)],
      ['Phantoms', `${mc.phantoms.baseline}`, `${mc.phantoms.refined}`, fmtSigned(mc.phantoms.delta)],
    ]),
  ];
  if (mc.isolatedModels.length > 0) {
    lines.push('', '### Transport-Error Isolation (Excluded from Matched Cohort)', ...mdTable(
      ['Model', 'Base Err', 'Ref Err', 'Matched Pairs', 'Matched Pass', 'Matched Phantoms', 'Excluded Phantoms (B -> R)'],
      ['---', '---:', '---:', '---:', '---:', '---:', '---:'],
      mc.isolatedModels.map(im => [im.modelId, `${im.baselineErrors}`, `${im.refinedErrors}`, `${im.matchedPairs}`, `${im.matchedBasePassed}/${im.matchedPairs} -> ${im.matchedRefPassed}/${im.matchedPairs}`, `${im.matchedBasePhantoms} -> ${im.matchedRefPhantoms} (${fmtSigned(im.matchedRefPhantoms - im.matchedBasePhantoms)})`, `${im.excludedBasePhantoms} -> ${im.excludedRefPhantoms}`]),
    ));
  }
  return lines;
}

export function renderComparisonMarkdown(m: ComparisonMetrics): string {
  const o = m.overall;
  const modelDelta = (x: ComparisonMetrics['models'][number]): string =>
    x.phantomDelta !== null ? fmtSigned(x.phantomDelta) : x.matchedPhantomDelta !== null && x.matchedPairs !== null ? `excluded (matched ${x.matchedPairs}: ${fmtSigned(x.matchedPhantomDelta)})` : 'excluded';
  const modelNote = (x: ComparisonMetrics['models'][number]): string => {
    const parts: string[] = [];
    if (x.baselineTransportErrors > 0 || x.refinedTransportErrors > 0) parts.push(`err B=${x.baselineTransportErrors}/R=${x.refinedTransportErrors}`);
    if (x.baselineEpisodes !== x.refinedEpisodes) parts.push(`unmatched ${x.baselineEpisodes}v${x.refinedEpisodes}`);
    if (parts.length > 0 && x.matchedPairs !== null) parts.push(`matched=${x.matchedPairs}`);
    return parts.join(', ') || 'ok';
  };
  return [
    `# Custdev-Everyday Comparison (${m.baselineTag} vs ${m.refinedTag})`, '', `Generated: ${m.generatedAt}`, '',
    '## Overall Deltas', ...mdTable(['Metric', 'Baseline', 'Refined', 'Delta'], ['---', '---:', '---:', '---:'], [
      ['Episodes Passed', `${o.passedEpisodes.baseline}/${o.totalEpisodes.baseline} (${o.passRateBaselinePct}%)`, `${o.passedEpisodes.refined}/${o.totalEpisodes.refined} (${o.passRateRefinedPct}%)`, `${fmtSigned(o.passedEpisodes.delta)} (${fmtSigned(o.passRateDeltaPp)}pp)`],
      ['State Passed', `${o.statePassedEpisodes.baseline}/${o.totalEpisodes.baseline}`, `${o.statePassedEpisodes.refined}/${o.totalEpisodes.refined}`, fmtSigned(o.statePassedEpisodes.delta)],
      ['Comprehension Passed', `${o.comprehensionPassedEpisodes.baseline}/${o.totalEpisodes.baseline}`, `${o.comprehensionPassedEpisodes.refined}/${o.totalEpisodes.refined}`, fmtSigned(o.comprehensionPassedEpisodes.delta)],
      ['Total Phantoms', `${o.totalPhantoms.baseline}`, `${o.totalPhantoms.refined}`, fmtSigned(o.totalPhantoms.delta)],
      ['Cross-Model Patterns', `${o.crossModelPhantomCount.baseline}`, `${o.crossModelPhantomCount.refined}`, fmtSigned(o.crossModelPhantomCount.delta)],
      ['Transport Errors', `${o.transportErrors.baseline}`, `${o.transportErrors.refined}`, fmtSigned(o.transportErrors.delta)],
    ]),
    '', ...renderMatchedCohortSection(m), '',
    '## Phantom Categories', ...mdTable(['Category', 'Baseline', 'Refined', 'Delta'], ['---', '---:', '---:', '---:'], m.categories.map(c => [c.category, `${c.baseline}`, `${c.refined}`, fmtSigned(c.delta)])),
    '', '## Per-Scenario Deltas', ...mdTable(['Scenario', 'Baseline Pass', 'Refined Pass', 'Base Phantoms', 'Refined Phantoms', 'Delta'], ['---', '---:', '---:', '---:', '---:', '---:'], m.scenarios.map(s => [s.scenarioId, `${s.baselinePassed}/${s.baselineEpisodes}`, `${s.refinedPassed}/${s.refinedEpisodes}`, `${s.baselinePhantoms}`, `${s.refinedPhantoms}`, fmtSigned(s.phantomDelta)])),
    '', '## Per-Model Deltas', ...mdTable(['Model', 'Lineage', 'Base Pass', 'Refined Pass', 'Base Avg Turns', 'Refined Avg Turns', 'Base Phantoms', 'Refined Phantoms', 'Delta', 'Cohort / Errors'], ['---', '---', '---:', '---:', '---:', '---:', '---:', '---:', '---:', '---'], m.models.map(x => [x.modelId, x.lineage, `${x.baselinePassed}/${x.baselineEpisodes}`, `${x.refinedPassed}/${x.refinedEpisodes}`, `${x.baselineAvgTurns}`, `${x.refinedAvgTurns}`, `${x.baselinePhantoms}`, `${x.refinedPhantoms}`, modelDelta(x), modelNote(x)])),
    '', '## Eliminated Cross-Model Phantoms', ...(m.eliminatedCrossModel.length === 0 ? ['None.'] : mdTable(['Category', 'Action / Expr', 'Baseline Count', 'Lineages', 'Refined Count'], ['---', '---', '---:', '---:', '---:'], m.eliminatedCrossModel.slice(0, 20).map(r => [r.category, `\`${esc(r.actionOrExpr)}\``, `${r.baselineCount}`, `${r.baselineLineages}`, '0']))),
    '', '## Reduced Cross-Model Phantoms', ...(m.reducedCrossModel.length === 0 ? ['None.'] : mdTable(['Category', 'Action / Expr', 'Baseline', 'Refined', 'Delta', 'Lineages (Base -> Ref)'], ['---', '---', '---:', '---:', '---:', '---:'], m.reducedCrossModel.map(r => [r.category, `\`${esc(r.actionOrExpr)}\``, `${r.baselineCount}`, `${r.refinedCount}`, fmtSigned(r.delta), `${r.baselineLineages} -> ${r.refinedLineages}`]))),
    '', '## Residual & New Phantoms', ...(m.residualOrNew.length === 0 ? ['Zero residual phantoms.'] : mdTable(['Category', 'Action / Expr', 'Baseline', 'Refined', 'Delta'], ['---', '---', '---:', '---:', '---:'], m.residualOrNew.slice(0, 20).map(r => [r.category, `\`${esc(r.actionOrExpr)}\``, `${r.baselineCount}`, `${r.refinedCount}`, fmtSigned(r.delta)]))),
  ].join('\n') + '\n';
}

export function compareRuns(opts: { baselineTag?: string; refinedTag?: string; runsRoot?: string; outPath?: string } = {}): { outPath: string; metrics: ComparisonMetrics } {
  const baselineTag = opts.baselineTag ?? 'baseline', refinedTag = opts.refinedTag ?? 'refined', runsRoot = opts.runsRoot ?? DEFAULT_RUNS_ROOT;
  const readJson = <T>(tag: string, file: string): T => {
    const p = join(runsRoot, tag, file);
    if (!existsSync(p)) throw new Error(`Missing run artifact: ${p}`);
    return JSON.parse(readFileSync(p, 'utf8')) as T;
  };
  const readEps = (tag: string): EpisodeResult[] | undefined => {
    const dir = join(runsRoot, tag, 'episodes');
    return existsSync(dir) ? readdirSync(dir).filter(f => f.endsWith('.json')).sort().map(f => JSON.parse(readFileSync(join(dir, f), 'utf8')) as EpisodeResult) : undefined;
  };
  const baseEps = readEps(baselineTag), refEps = readEps(refinedTag);
  const metrics = buildComparison(
    readJson<SweepSummary>(baselineTag, 'summary.json'), readJson<PhantomAggregate[]>(baselineTag, 'phantoms.json'),
    readJson<SweepSummary>(refinedTag, 'summary.json'), readJson<PhantomAggregate[]>(refinedTag, 'phantoms.json'),
    baseEps && refEps ? { baselineEpisodes: baseEps, refinedEpisodes: refEps } : {},
  );
  const outPath = opts.outPath ?? join(runsRoot, refinedTag, 'comparison.md');
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, renderComparisonMarkdown(metrics), 'utf8');
  return { outPath, metrics };
}
