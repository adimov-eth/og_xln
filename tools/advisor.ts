#!/usr/bin/env bun
/** One packet-only second-opinion CLI for every harness. See docs/agent-workflow.md. */
import { resolve } from 'node:path';
import { ask } from './advisor/ask';
import { parseEvaluation, parseJob } from './advisor/decode';
import { computeStats } from './advisor/stats';
import { readEvents, readJson, recordEvaluation } from './advisor/store';
import { TASKS } from './advisor/types';
import { choice, fail } from './advisor/values';

const usage =
  'bun tools/advisor.ts ask <job.json> | record <evaluation.json> | stats [--task code|spec|architecture|design|review|debug]';

const main = async (args: readonly string[]): Promise<void> => {
  const root = process.cwd();
  const command = args[0];
  if (args.length === 0 || command === '--help') {
    console.log(usage);
    return;
  }
  if (command === 'stats') {
    if (args.length !== 1 && !(args.length === 3 && args[1] === '--task')) fail('STATS_ARGUMENTS_INVALID');
    const task = args.length === 1 ? undefined : choice(args[2], TASKS);
    console.log(
      JSON.stringify(
        {
          rows: computeStats(readEvents(root), task),
          note: 'Quality uses independently adjudicated response usefulness. Peer opinions and failed runs do not enter quality. Cost is harness-reported; served provider may be unavailable. No Elo is inferred.',
        },
        null,
        2,
      ),
    );
    return;
  }
  const file = args[1];
  if (args.length !== 2 || !file) return fail('COMMAND_ARGUMENTS_INVALID');
  const input = readJson(resolve(root, file));
  if (command === 'record') {
    console.log(JSON.stringify({ path: recordEvaluation(root, parseEvaluation(input)) }));
    return;
  }
  if (command !== 'ask') fail('COMMAND_UNKNOWN');
  const result = await ask(root, parseJob(input));
  console.log(JSON.stringify(result, null, 2));
  if (result.status !== 'completed') process.exitCode = 1;
};

if (import.meta.main) await main(process.argv.slice(2));
