import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  type EpisodeResult,
  PHANTOM_CATEGORIES,
  type PhantomCategory,
  type PhantomRecord,
  type ScenarioId,
} from '../types.ts';

export interface PhantomAggregate {
  key: string;
  category: PhantomCategory;
  actionOrExpr: string;
  count: number;
  models: string[];
  lineages: string[];
  isCrossModel: boolean;
  scenarios: ScenarioId[];
  sampleIntent: string;
  sampleError: string;
}

export interface SweepSummary {
  tag: string;
  specMode: string;
  generatedAt: string;
  totalEpisodes: number;
  passedEpisodes: number;
  statePassedEpisodes: number;
  comprehensionPassedEpisodes: number;
  transportErrors: number;
  totalPhantoms: number;
  phantomCountsByCategory: Record<PhantomCategory, number>;
  crossModelPhantomCount: number;
  byModel: Array<{
    modelId: string;
    lineage: string;
    episodes: number;
    passed: number;
    statePassed: number;
    comprehensionPassed: number;
    avgTurns: number;
    phantoms: number;
    byCategory: Record<PhantomCategory, number>;
    defines: number;
    transportErrors: number;
  }>;
  byScenario: Array<{
    scenarioId: ScenarioId;
    episodes: number;
    passed: number;
    statePassed: number;
    comprehensionPassed: number;
    phantoms: number;
    byCategory: Record<PhantomCategory, number>;
  }>;
}

function emptyCategoryMap(): Record<PhantomCategory, number> {
  return {
    unknown_action: 0,
    validation: 0,
    eval: 0,
    parse: 0,
    runtime: 0,
    timeout: 0,
  };
}

export function sanitizeSlug(s: string): string {
  return s.replace(/[^a-z0-9._-]+/gi, '_');
}

export function writeEpisodeTrace(runDir: string, ep: EpisodeResult): string {
  const epDir = join(runDir, 'episodes');
  mkdirSync(epDir, { recursive: true });
  const filePath = join(epDir, `${ep.scenarioId}--${sanitizeSlug(ep.modelId)}.json`);
  writeFileSync(filePath, JSON.stringify(ep, null, 2) + '\n', 'utf8');
  return filePath;
}

export function aggregatePhantoms(episodes: readonly EpisodeResult[]): PhantomAggregate[] {
  const groups = new Map<string, PhantomRecord[]>();
  for (const ep of episodes) {
    for (const p of ep.phantoms) {
      const target = p.actionOrExpr.slice(0, 64);
      const key = `${p.category}::${target}`;
      const list = groups.get(key) ?? [];
      list.push(p);
      groups.set(key, list);
    }
  }
  const out: PhantomAggregate[] = [];
  for (const [key, list] of groups.entries()) {
    const first = list[0]!;
    const models = [...new Set(list.map(x => x.modelId))].sort();
    const lineages = [...new Set(list.map(x => x.lineage))].sort();
    const scenarios = [...new Set(list.map(x => x.scenarioId))].sort() as ScenarioId[];
    out.push({
      key,
      category: first.category,
      actionOrExpr: first.actionOrExpr,
      count: list.length,
      models,
      lineages,
      isCrossModel: lineages.length >= 2,
      scenarios,
      sampleIntent: first.intent,
      sampleError: first.error,
    });
  }
  return out.sort((a, b) => b.count - a.count || b.lineages.length - a.lineages.length);
}

export function buildSweepSummary(
  tag: string,
  specMode: string,
  episodes: readonly EpisodeResult[],
  phantoms: readonly PhantomAggregate[],
): SweepSummary {
  const globalCats = emptyCategoryMap();
  const modelMap = new Map<string, EpisodeResult[]>();
  const scenMap = new Map<ScenarioId, EpisodeResult[]>();

  for (const ep of episodes) {
    for (const p of ep.phantoms) globalCats[p.category]++;
    const ml = modelMap.get(ep.modelId) ?? [];
    ml.push(ep);
    modelMap.set(ep.modelId, ml);
    const sl = scenMap.get(ep.scenarioId) ?? [];
    sl.push(ep);
    scenMap.set(ep.scenarioId, sl);
  }

  const byModel = [...modelMap.entries()].map(([modelId, eps]) => {
    const byCategory = emptyCategoryMap();
    let phantomsTotal = 0;
    let definesTotal = 0;
    let turnsTotal = 0;
    for (const ep of eps) {
      turnsTotal += ep.turns;
      definesTotal += ep.defines.length;
      phantomsTotal += ep.phantoms.length;
      for (const p of ep.phantoms) byCategory[p.category]++;
    }
    return {
      modelId,
      lineage: eps[0]!.lineage,
      episodes: eps.length,
      passed: eps.filter(e => e.passed).length,
      statePassed: eps.filter(e => e.statePassed).length,
      comprehensionPassed: eps.filter(e => e.comprehension.passed).length,
      avgTurns: Number((turnsTotal / Math.max(1, eps.length)).toFixed(2)),
      phantoms: phantomsTotal,
      byCategory,
      defines: definesTotal,
      transportErrors: eps.filter(e => Boolean(e.transportError)).length,
    };
  });

  const byScenario = [...scenMap.entries()].map(([scenarioId, eps]) => {
    const byCategory = emptyCategoryMap();
    let phantomsTotal = 0;
    for (const ep of eps) {
      phantomsTotal += ep.phantoms.length;
      for (const p of ep.phantoms) byCategory[p.category]++;
    }
    return {
      scenarioId,
      episodes: eps.length,
      passed: eps.filter(e => e.passed).length,
      statePassed: eps.filter(e => e.statePassed).length,
      comprehensionPassed: eps.filter(e => e.comprehension.passed).length,
      phantoms: phantomsTotal,
      byCategory,
    };
  });

  return {
    tag,
    specMode,
    generatedAt: new Date().toISOString(),
    totalEpisodes: episodes.length,
    passedEpisodes: episodes.filter(e => e.passed).length,
    statePassedEpisodes: episodes.filter(e => e.statePassed).length,
    comprehensionPassedEpisodes: episodes.filter(e => e.comprehension.passed).length,
    transportErrors: episodes.filter(e => Boolean(e.transportError)).length,
    totalPhantoms: episodes.reduce((acc, e) => acc + e.phantoms.length, 0),
    phantomCountsByCategory: globalCats,
    crossModelPhantomCount: phantoms.filter(p => p.isCrossModel).length,
    byModel,
    byScenario,
  };
}

export function renderSummaryMarkdown(summary: SweepSummary, phantoms: readonly PhantomAggregate[], episodes: readonly EpisodeResult[]): string {
  const lines: string[] = [
    `# Custdev-Everyday Report (${summary.tag} · spec=${summary.specMode})`,
    '',
    `Generated: ${summary.generatedAt}`,
    '',
    '## Overall Metrics',
    `- Episodes passed: **${summary.passedEpisodes}/${summary.totalEpisodes}** (state: ${summary.statePassedEpisodes}/${summary.totalEpisodes}, comprehension: ${summary.comprehensionPassedEpisodes}/${summary.totalEpisodes})`,
    `- Total phantoms: **${summary.totalPhantoms}** (${summary.crossModelPhantomCount} cross-model patterns)`,
    `- Transport errors: ${summary.transportErrors}`,
    `- Phantom categories: ${PHANTOM_CATEGORIES.map(c => `${c}=${summary.phantomCountsByCategory[c]}`).join(', ')}`,
    '',
    '## Per-Model Completion & Phantoms',
    '| Model | Lineage | Pass | State | Comp | Avg Turns | Phantoms | unknown_action | validation | eval | parse | runtime | timeout | TransportErr |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|',
    ...summary.byModel.map(
      m =>
        `| ${m.modelId} | ${m.lineage} | ${m.passed}/${m.episodes} | ${m.statePassed}/${m.episodes} | ${m.comprehensionPassed}/${m.episodes} | ${m.avgTurns} | ${m.phantoms} | ${m.byCategory.unknown_action} | ${m.byCategory.validation} | ${m.byCategory.eval} | ${m.byCategory.parse} | ${m.byCategory.runtime} | ${m.byCategory.timeout} | ${m.transportErrors} |`,
    ),
    '',
    '## Per-Episode Completion',
    '| Scenario | Pass | State | Comp | Phantoms | Breakdown |',
    '|---|---:|---:|---:|---:|---|',
    ...summary.byScenario.map(
      s =>
        `| ${s.scenarioId} | ${s.passed}/${s.episodes} | ${s.statePassed}/${s.episodes} | ${s.comprehensionPassed}/${s.episodes} | ${s.phantoms} | ${PHANTOM_CATEGORIES.filter(c => s.byCategory[c] > 0).map(c => `${c}:${s.byCategory[c]}`).join(', ') || 'none'} |`,
    ),
    '',
    '## Top Phantom Patterns (Sorted by Frequency)',
    '| Count | Cross-Model | Lineages | Category | Action / Expr | Sample Error |',
    '|---:|---|---:|---|---|---|',
    ...phantoms.slice(0, 30).map(
      p =>
        `| ${p.count} | ${p.isCrossModel ? 'YES' : 'no'} | ${p.lineages.length} | ${p.category} | \`${p.actionOrExpr.replace(/\|/g, '/')}\` | ${p.sampleError.replace(/\n/g, ' ').slice(0, 90)} |`,
    ),
    '',
    '## Sample Post-Mortems',
  ];

  const withPm = episodes.filter(e => e.postMortem).slice(0, 12);
  if (withPm.length === 0) {
    lines.push('No post-mortems triggered.');
  } else {
    for (const ep of withPm) {
      lines.push(`### ${ep.scenarioId} — ${ep.modelId} (passed=${ep.passed}, phantoms=${ep.phantoms.length})`);
      lines.push(ep.postMortem!.response.trim());
      lines.push('');
    }
  }
  return lines.join('\n') + '\n';
}

export function writeSweepArtifacts(
  runDir: string,
  tag: string,
  specMode: string,
  episodes: readonly EpisodeResult[],
): { summary: SweepSummary; phantoms: PhantomAggregate[] } {
  mkdirSync(runDir, { recursive: true });
  const phantoms = aggregatePhantoms(episodes);
  const summary = buildSweepSummary(tag, specMode, episodes, phantoms);
  writeFileSync(join(runDir, 'phantoms.json'), JSON.stringify(phantoms, null, 2) + '\n', 'utf8');
  writeFileSync(join(runDir, 'summary.json'), JSON.stringify(summary, null, 2) + '\n', 'utf8');
  writeFileSync(join(runDir, 'report.md'), renderSummaryMarkdown(summary, phantoms, episodes), 'utf8');
  return { summary, phantoms };
}
