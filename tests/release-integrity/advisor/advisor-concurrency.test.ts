import { afterEach, expect, test } from 'bun:test';
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { digest } from '../../../tools/advisor/packet';
import { runProcess } from '../../../tools/advisor/execution/process';
import { readEvents, writeEvent } from '../../../tools/advisor/store';
import type { Evaluation, Result, Run } from '../../../tools/advisor/types';

const directories: string[] = [];
const temp = (): string => {
  const directory = mkdtempSync(join(tmpdir(), 'advisor-concurrent-test-'));
  directories.push(directory);
  return directory;
};
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});
const storeModule = resolve(import.meta.dir, '../../../tools/advisor/store.ts');
const packetModule = resolve(import.meta.dir, '../../../tools/advisor/packet.ts');
const run: Run = {
  schemaVersion: 1,
  kind: 'run',
  id: 'concurrency',
  project: 'local-storage-test',
  task: 'review',
  sourceSha: 'a'.repeat(40),
  harness: 'pi',
  provider: 'openrouter',
  model: 'vendor/model',
  family: 'vendor',
  effort: null,
  timeoutMs: 1000,
  question: 'Local storage test only; no provider or model is called.',
  evidence: [{ path: 'proof.txt', sha256: digest('proof') }],
  recordedAt: '2026-09-05T00:00:00.000Z',
  candidateHash: digest('candidate'),
  promptHash: digest('prompt'),
};
const answer = JSON.stringify({ verdict: 'UNVERIFIED', answer: 'Local storage test input.', references: [] });
const result: Result = {
  schemaVersion: 1,
  kind: 'result',
  id: `${run.id}.result`,
  runId: run.id,
  recordedAt: '2026-09-05T00:00:01.000Z',
  harnessVersion: '0.84.4',
  servedProvider: null,
  status: 'completed',
  elapsedMs: 1,
  exitCode: 0,
  costUsd: null,
  response: answer,
  responseHash: digest(answer),
  stdoutHash: digest(answer),
  stderrHash: digest(''),
  error: null,
};
const rating: Evaluation = {
  schemaVersion: 1,
  kind: 'evaluation',
  id: 'evaluation',
  runId: run.id,
  recordedAt: '2026-09-05T00:00:02.000Z',
  responseHash: result.responseHash,
  judge: 'other/model',
  judgeFamily: 'other',
  adjudicator: 'local/independent',
  status: 'verified',
  criteria: { correctness: 500, relevance: 500, actionability: 500, evidence: 500 },
  evidence: [{ path: 'proof.txt', sha256: digest('proof') }],
  rationale: 'Local storage test evidence only; no model response is being graded.',
  supersedes: null,
};

const concurrentRatings = (root: string, evaluation: Evaluation) =>
  Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      runProcess({
        command: process.execPath,
        args: [
          '-e',
          `import {recordEvaluation} from ${JSON.stringify(storeModule)};
      const input=JSON.parse(await Bun.stdin.text());
      try{recordEvaluation(input.root,input.evaluation);console.log('accepted');}
      catch(error){console.error(String(error));process.exitCode=1;}`,
        ],
        cwd: root,
        timeoutMs: 5000,
        input: JSON.stringify({ root, evaluation: { ...evaluation, id: `${evaluation.id}-${index}` } }),
      }),
    ),
  );

test('real simultaneous judges publish one evaluation and one correction without corrupting history', async () => {
  const root = temp();
  writeEvent(root, run);
  writeEvent(root, result);
  // Actual file hashing widens the former read-check-write race without substituting the filesystem.
  const proof = Buffer.alloc(32_000_000, 97);
  writeFileSync(join(root, 'proof.txt'), proof);
  const evaluation: Evaluation = { ...rating, evidence: [{ path: 'proof.txt', sha256: digest(proof) }] };
  const outcomes = await concurrentRatings(root, evaluation);
  expect(outcomes.filter(outcome => outcome.exitCode === 0)).toHaveLength(1);
  expect(outcomes.filter(outcome => outcome.stderr.includes('DUPLICATE_JUDGE_EVALUATION'))).toHaveLength(7);
  const events = readEvents(root);
  const accepted = events.find(event => event.kind === 'evaluation');
  if (!accepted) throw new Error('Accepted evaluation missing');
  const correction: Evaluation = {
    ...evaluation,
    id: 'correction',
    supersedes: accepted.id,
    recordedAt: '2026-09-05T00:00:03.000Z',
  };
  const corrections = await concurrentRatings(root, correction);
  expect(corrections.filter(outcome => outcome.exitCode === 0)).toHaveLength(1);
  expect(corrections.filter(outcome => outcome.stderr.includes('SUPERSEDES_FORK_REJECTED'))).toHaveLength(7);
  expect(readEvents(root)).toHaveLength(4);
  expect(readdirSync(join(root, 'agents/evidence')).every(name => name.endsWith('.json'))).toBe(true);
}, 10_000);

test('live readers only see complete event JSON during real concurrent publication', async () => {
  const root = temp();
  for (let index = 0; index < 24; index++) writeEvent(root, { ...run, id: `publication-${index}` });
  let finished = false;
  const writer = runProcess({
    command: process.execPath,
    args: [
      '-e',
      `import {writeEvent} from ${JSON.stringify(storeModule)};
      import {digest} from ${JSON.stringify(packetModule)};
      const {root,result}=JSON.parse(await Bun.stdin.text());
      const response=JSON.stringify({verdict:'UNVERIFIED',answer:'a'.repeat(900000),references:[]});
      for(let index=0;index<24;index++)writeEvent(root,{...result,id:'publication-'+index+'.result',
        runId:'publication-'+index,response,responseHash:digest(response)});`,
    ],
    cwd: root,
    timeoutMs: 5000,
    input: JSON.stringify({ root, result }),
  }).then(outcome => {
    finished = true;
    return outcome;
  });
  let reads = 0;
  let failure: unknown;
  while (!finished) {
    try {
      readEvents(root);
      reads++;
    } catch (error) {
      failure = error;
      break;
    }
    await Bun.sleep(0);
  }
  const outcome = await writer;
  expect(failure).toBeUndefined();
  expect(outcome.exitCode).toBe(0);
  expect(reads).toBeGreaterThan(0);
  expect(readEvents(root)).toHaveLength(48);
  expect(readdirSync(join(root, 'agents/evidence')).every(name => name.endsWith('.json'))).toBe(true);
}, 10_000);

test('concurrent publication of the same event ID preserves exactly one complete original', async () => {
  const root = temp();
  const outcomes = await Promise.all(
    Array.from({ length: 8 }, (_, index) =>
      runProcess({
        command: process.execPath,
        args: [
          '-e',
          `import {writeEvent} from ${JSON.stringify(storeModule)};
      const input=JSON.parse(await Bun.stdin.text());
      try{writeEvent(input.root,input.run);}catch(error){console.error(String(error));process.exitCode=1;}`,
        ],
        cwd: root,
        timeoutMs: 3000,
        input: JSON.stringify({ root, run: { ...run, question: `writer-${index}` } }),
      }),
    ),
  );
  expect(outcomes.filter(outcome => outcome.exitCode === 0)).toHaveLength(1);
  expect(outcomes.filter(outcome => outcome.stderr.includes('EEXIST'))).toHaveLength(7);
  const events = readEvents(root);
  expect(events).toHaveLength(1);
  expect(events[0]?.kind === 'run' && events[0].question.startsWith('writer-')).toBe(true);
  expect(readdirSync(join(root, 'agents/evidence'))).toEqual([`${run.id}.json`]);
});
