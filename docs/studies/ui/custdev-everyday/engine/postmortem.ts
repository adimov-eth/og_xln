import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ScenarioDef } from './scenarios.ts';
import type { DriverMessage, EpisodeResult, ModelDriver, PostMortemRecord, TraceRecord } from '../types.ts';

export function buildPostMortemPrompt(
  scenario: ScenarioDef,
  traces: readonly TraceRecord[],
  passed: boolean,
  comprehensionChecks: Record<string, boolean>,
): string {
  const traceLines = traces.map(t => {
    const res = t.outcome.success
      ? `OK: ${JSON.stringify(t.outcome.data).slice(0, 180)}`
      : `ERROR (${t.outcome.phantomCategory}): ${t.outcome.error}`;
    return `Turn ${t.turn}: ${t.tool}(intent=${JSON.stringify(t.intent)}, args=${JSON.stringify(t.args)}) -> ${res}`;
  });
  const statusNote = passed
    ? 'Note: you finished the task, but hit tool/surface errors along the way.'
    : `Note: task verification failed (comprehension=${JSON.stringify(comprehensionChecks)}).`;

  return [
    `You were given this task: "${scenario.task}"`,
    statusNote,
    'Here is what you tried:',
    ...(traceLines.length > 0 ? traceLines : ['(no tool calls recorded)']),
    'Here is what would have worked:',
    scenario.happyPathHint,
    'What made it hard to find the working approach? Be concrete about naming, missing cues, or misleading labels.',
  ].join('\n');
}

export async function runPostMortem(
  driver: ModelDriver,
  scenario: ScenarioDef,
  traces: readonly TraceRecord[],
  passed: boolean,
  comprehensionChecks: Record<string, boolean>,
): Promise<PostMortemRecord> {
  const prompt = buildPostMortemPrompt(scenario, traces, passed, comprehensionChecks);
  const messages: DriverMessage[] = [
    {
      role: 'system',
      content: 'You are reviewing a wallet interface you just used. Give concise, concrete feedback on naming, missing cues, or misleading labels.',
    },
    { role: 'user', content: prompt },
  ];
  const turn = await driver.nextTurn({
    systemPrompt: messages[0]!.content,
    messages,
    expectJsonAction: false,
  });
  const response = turn.kind === 'text' ? turn.text : JSON.stringify(turn.calls);
  return { prompt, response, latencyMs: turn.latencyMs };
}

export function writePostMortemsMarkdown(runDir: string, episodes: readonly EpisodeResult[]): string {
  mkdirSync(runDir, { recursive: true });
  const withPm = episodes.filter(e => e.postMortem);
  const lines: string[] = [
    '# Phase 7 Post-Mortem Transcripts',
    '',
    `Total post-mortems recorded: ${withPm.length} / ${episodes.length} episodes.`,
    '',
  ];
  for (const ep of withPm) {
    lines.push(`## ${ep.scenarioId} — ${ep.modelId} (passed=${ep.passed}, phantoms=${ep.phantoms.length})`);
    lines.push('```text');
    lines.push(ep.postMortem!.prompt);
    lines.push('```');
    lines.push('**Model feedback:**');
    lines.push(ep.postMortem!.response.trim());
    lines.push('');
  }
  const outPath = join(runDir, 'postmortems.md');
  writeFileSync(outPath, lines.join('\n') + '\n', 'utf8');
  return outPath;
}
