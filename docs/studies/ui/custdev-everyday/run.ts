import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeSweepArtifacts } from './engine/collector.ts';
import { compareRuns } from './engine/compare.ts';
import { runSweep } from './engine/loop.ts';
import { writePostMortemsMarkdown } from './engine/postmortem.ts';
import { selectDrivers } from './drivers/runners.ts';
import { SCENARIOS } from './engine/scenarios.ts';
import { createScriptedDriver } from './drivers/scripted.ts';
import type { EpisodeResult, ScenarioId, SpecMode } from './types.ts';

const HERE = dirname(fileURLToPath(import.meta.url));

function parseFlag(args: readonly string[], name: string, fallbackVal: string): string {
  const prefix = `--${name}=`;
  const hit = args.find(a => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : fallbackVal;
}

function printEpisodeLine(ep: EpisodeResult): void {
  const status = ep.transportError ? `ERR(${ep.transportError.slice(0, 40)})` : ep.passed ? 'PASS' : 'FAIL';
  console.log(
    `${ep.scenarioId.padEnd(34)} ${ep.modelId.padEnd(36)} ${status.padEnd(6)} turns=${String(ep.turns).padEnd(3)} phantoms=${ep.phantoms.length} (${ep.durationMs}ms)`,
  );
}

async function runDry(specMode: SpecMode): Promise<void> {
  const runDir = join(HERE, 'runs', `dry-${specMode}`);
  const episodes = await runSweep({
    drivers: [createScriptedDriver()],
    specMode,
    runDir,
    tag: `dry-${specMode}`,
    onEpisode: printEpisodeLine,
  });
  const passed = episodes.filter(e => e.passed).length;
  const totalPhantoms = episodes.reduce((acc, e) => acc + e.phantoms.length, 0);
  console.log(`\nDry (${specMode}): ${passed}/${episodes.length} passed, totalPhantoms=${totalPhantoms}, artifacts=${runDir}`);
}

async function runLiveSweep(args: readonly string[]): Promise<void> {
  const tag = parseFlag(args, 'tag', 'baseline');
  const specMode = parseFlag(args, 'spec', tag === 'refined' ? 'refined' : 'baseline') as SpecMode;
  const tier = parseFlag(args, 'tier', 'full');
  const modelsFilter = parseFlag(args, 'models', '');
  const scenariosFilter = parseFlag(args, 'scenarios', '');
  const resume = args.includes('--resume');

  const drivers = selectDrivers(tier, modelsFilter || undefined);
  if (drivers.length === 0) throw new Error(`No drivers matched tier=${tier} models=${modelsFilter}`);

  const wantedScenarios = scenariosFilter
    ? SCENARIOS.filter(s => new Set(scenariosFilter.split(',')).has(s.id as ScenarioId))
    : SCENARIOS;
  if (wantedScenarios.length === 0) throw new Error(`No scenarios matched: ${scenariosFilter}`);

  const runsRoot = join(HERE, 'runs');
  const runDir = join(runsRoot, tag);
  mkdirSync(runDir, { recursive: true });
  console.log(`Starting sweep tag=${tag} spec=${specMode} tier=${tier} resume=${resume} drivers=${drivers.length} scenarios=${wantedScenarios.length} -> ${runDir}`);
  const episodes = await runSweep({
    drivers,
    scenarios: wantedScenarios,
    specMode,
    runDir,
    tag,
    resume,
    onEpisode: printEpisodeLine,
  });
  const passed = episodes.filter(e => e.passed).length;
  const totalPhantoms = episodes.reduce((acc, e) => acc + e.phantoms.length, 0);
  console.log(`\nSweep complete (${tag}): ${passed}/${episodes.length} passed, totalPhantoms=${totalPhantoms}`);
  if (tag !== 'baseline' && existsSync(join(runsRoot, 'baseline', 'summary.json'))) {
    const { outPath } = compareRuns({ baselineTag: 'baseline', refinedTag: tag, runsRoot });
    console.log(`Comparison written: ${outPath}`);
  }
}

export function rebuildReport(args: readonly string[], runsRoot = join(HERE, 'runs')): void {
  const tag = parseFlag(args, 'tag', 'baseline');
  const runDir = join(runsRoot, tag);
  const epDir = join(runDir, 'episodes');
  if (!existsSync(epDir)) throw new Error(`Missing episodes directory: ${epDir}`);
  const files = readdirSync(epDir).filter(f => f.endsWith('.json')).sort();
  const episodes = files.map(f => JSON.parse(readFileSync(join(epDir, f), 'utf8')) as EpisodeResult);
  const specMode = episodes[0]?.specMode ?? 'baseline';
  const { summary } = writeSweepArtifacts(runDir, tag, specMode, episodes);
  writePostMortemsMarkdown(runDir, episodes);
  console.log(`Rebuilt report for ${tag}: ${summary.passedEpisodes}/${summary.totalEpisodes} passed, ${summary.totalPhantoms} phantoms`);
}

async function main(): Promise<void> {
  const [cmd = 'dry', ...rest] = process.argv.slice(2);
  if (cmd === 'dry') {
    const spec = parseFlag(rest, 'spec', 'baseline') as SpecMode;
    await runDry(spec);
  } else if (cmd === 'sweep') {
    await runLiveSweep(rest);
  } else if (cmd === 'report') {
    rebuildReport(rest);
  } else if (cmd === 'compare') {
    const baselineTag = parseFlag(rest, 'baseline', 'baseline');
    const refinedTag = parseFlag(rest, 'refined', 'refined');
    const { outPath, metrics } = compareRuns({ baselineTag, refinedTag });
    console.log(
      `Comparison (${baselineTag} vs ${refinedTag}): pass ${metrics.overall.passedEpisodes.baseline}/${metrics.overall.totalEpisodes.baseline} -> ${metrics.overall.passedEpisodes.refined}/${metrics.overall.totalEpisodes.refined}, phantoms ${metrics.overall.totalPhantoms.baseline} -> ${metrics.overall.totalPhantoms.refined} (${outPath})`,
    );
  } else {
    console.error('Usage: bun run.ts <dry|sweep|report|compare> [--tag=baseline] [--spec=baseline|refined] [--tier=fast|full|proxy|cli]');
    process.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
