import { afterEach, expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEvaluation, parseEvent, parseJob } from '../../../tools/advisor/decode';
import { buildPacket, digest } from '../../../tools/advisor/packet';
import { harnessCommand } from '../../../tools/advisor/execution/harness';
import { parseOutput } from '../../../tools/advisor/output';
import { exactPiModel, isolatedOpenCode } from '../../../tools/advisor/execution/preflight';
import { computeStats } from '../../../tools/advisor/stats';
import { readEvents, recordEvaluation, validateLinks, writeEvent } from '../../../tools/advisor/store';
import type { Evaluation, Job, Result, Run } from '../../../tools/advisor/types';

const directories: string[] = [];
const temp = (): string => {
  const path = mkdtempSync(join(tmpdir(), 'advisor-test-'));
  directories.push(path);
  return path;
};
afterEach(() => {
  for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true });
});
const answer = JSON.stringify({
  verdict: 'ANSWER',
  answer: 'The change requires a focused recovery test.',
  references: ['source.txt:1'],
});
const job: Job = {
  schemaVersion: 1,
  id: 'bounded-review',
  project: 'example',
  task: 'review',
  sourceSha: 'a'.repeat(40),
  harness: 'pi',
  provider: 'openrouter',
  model: 'vendor/exact-model-1',
  family: 'vendor',
  effort: null,
  timeoutMs: 1000,
  question: 'Can this recovery transition lose an output?',
  evidence: [{ path: 'source.txt', sha256: digest('source') }],
};
const run: Run = {
  ...job,
  kind: 'run',
  recordedAt: '2026-09-05T00:00:00.000Z',
  candidateHash: digest('candidate'),
  promptHash: digest('prompt'),
};
const result: Result = {
  schemaVersion: 1,
  kind: 'result',
  id: `${run.id}.result`,
  runId: run.id,
  recordedAt: '2026-09-05T00:00:01.000Z',
  harnessVersion: '0.84.4',
  servedProvider: null,
  status: 'completed',
  elapsedMs: 500,
  exitCode: 0,
  costUsd: null,
  response: answer,
  responseHash: digest(answer),
  stdoutHash: digest('stdout'),
  stderrHash: digest(''),
  error: null,
};
const evaluation: Evaluation = {
  schemaVersion: 1,
  kind: 'evaluation',
  id: 'review-rating',
  runId: run.id,
  recordedAt: '2026-09-05T00:00:02.000Z',
  responseHash: result.responseHash,
  judge: 'other/exact-model',
  judgeFamily: 'other',
  adjudicator: 'local/primary',
  status: 'verified',
  criteria: { correctness: 800, relevance: 900, actionability: 800, evidence: 700 },
  evidence: [{ path: 'verification.txt', sha256: digest('observed local result') }],
  rationale: 'The independent local result supports the concrete claim.',
  supersedes: null,
};

test('job decoder rejects unsafe paths, unbounded work and guessed defaults', () => {
  expect(parseJob(job)).toEqual(job);
  expect(parseJob({ ...job, timeoutMs: 1_200_000 }).timeoutMs).toBe(1_200_000);
  for (const invalid of [
    { ...job, timeoutMs: 1_200_001 },
    { ...job, timeoutMs: NaN },
    { ...job, id: '../escape' },
    { ...job, sourceSha: 'main' },
    { ...job, model: '--auto' },
    { ...job, provider: 'a/b' },
    { ...job, extra: true },
    { ...job, effort: 'automatic' },
    { ...job, evidence: [] },
    { ...job, evidence: [...job.evidence, ...job.evidence] },
    { ...job, evidence: [{ path: '../secret', sha256: digest('x') }] },
    { ...job, evidence: [{ path: '/etc/passwd', sha256: digest('x') }] },
    { ...job, evidence: [{ path: 'safe', sha256: 'not-a-digest' }] },
  ])
    expect(() => parseJob(invalid)).toThrow();
  const { timeoutMs: omitted, ...missing } = job;
  expect(omitted).toBe(1000);
  expect(() => parseJob(missing)).toThrow('EXACT_KEYS');
});

test('packet comes from the exact commit even while main files change', () => {
  const root = temp();
  const git = (args: string[]): string => {
    const output = spawnSync('git', args, { cwd: root, encoding: 'utf8', timeout: 2000 });
    if (output.status !== 0) throw new Error(output.stderr);
    return output.stdout.trim();
  };
  git(['init', '--initial-branch=main']);
  writeFileSync(join(root, 'source.txt'), 'source');
  git(['add', 'source.txt']);
  git(['-c', 'user.name=Advisor test', '-c', 'user.email=advisor@example.invalid', 'commit', '-m', 'snapshot']);
  const pinned = { ...job, sourceSha: git(['rev-parse', 'HEAD']) };
  writeFileSync(join(root, 'source.txt'), 'concurrently edited source');
  const packet = buildPacket(root, pinned);
  expect(packet.prompt).toContain('"content":"source"');
  expect(packet.prompt).not.toContain('concurrently edited');
  expect(() => buildPacket(root, { ...pinned, evidence: [{ path: 'source.txt', sha256: digest('wrong') }] })).toThrow(
    'EVIDENCE_HASH_MISMATCH',
  );
});

test('both adapters disable model tools, automatic resumption and repository context', () => {
  const directory = temp();
  const pi = harnessCommand(job, directory);
  for (const option of ['--no-tools', '--no-extensions', '--no-context-files', '--no-session', '--no-approve']) {
    expect(pi.args).toContain(option);
  }
  expect(pi.args).not.toContain('--continue');
  expect(pi.args).toContain(job.model);
  const opencode = harnessCommand({ ...job, harness: 'opencode' }, directory);
  expect(opencode.args).toContain('--pure');
  expect(opencode.args).not.toContain('--auto');
  expect(opencode.args).not.toContain('--session');
  expect(opencode.env['OPENCODE_PERMISSION']).toBe('{"*":"deny"}');
  expect(opencode.env['XDG_CONFIG_HOME']).toBe(join(directory, 'config'));
  expect(opencode.env['OPENCODE_CONFIG_CONTENT']).toContain('"permission":{"*":"deny"}');
});

test('preflight rejects fuzzy model matches and permissions added outside our override', () => {
  expect(exactPiModel('openrouter vendor/exact-model-1 128K 16K yes no', job)).toBe(true);
  expect(exactPiModel('openrouter vendor/exact-model-1-latest 128K 16K yes no', job)).toBe(false);
  expect(exactPiModel('other vendor/exact-model-1 128K 16K yes no', job)).toBe(false);
  const config = {
    permission: { '*': 'deny' },
    agent: { advisor: { mode: 'primary', permission: { '*': 'deny' } } },
    plugin: [],
    mcp: {},
    share: 'disabled',
  };
  expect(isolatedOpenCode(JSON.stringify(config))).toBe(true);
  expect(isolatedOpenCode(JSON.stringify({ ...config, permission: { '*': 'deny', bash: 'allow' } }))).toBe(false);
  expect(isolatedOpenCode(JSON.stringify({ ...config, mcp: { unexpected: { enabled: true } } }))).toBe(false);
  expect(isolatedOpenCode(JSON.stringify({ ...config, plugin: ['unexpected'] }))).toBe(false);
});

const piEvents = (overrides: Record<string, unknown> = {}): string =>
  [
    {
      type: 'message_end',
      message: {
        role: 'assistant',
        stopReason: 'stop',
        model: job.model,
        provider: job.provider,
        content: [{ type: 'text', text: answer }],
        usage: { cost: { total: 0.012 } },
        ...overrides,
      },
    },
    { type: 'agent_end' },
  ]
    .map(row => JSON.stringify(row))
    .join('\n');

test('structured final responses reject incomplete output, tool calls and silent model changes', () => {
  expect(parseOutput('pi', piEvents(), job)).toEqual({ text: answer, costUsd: 0.012 });
  for (const change of [
    { stopReason: 'error' },
    { stopReason: 'length' },
    { model: 'substitute' },
    { content: [{ type: 'toolCall', name: 'bash' }] },
  ]) {
    expect(() => parseOutput('pi', piEvents(change), job)).toThrow();
  }
  const complete = [
    { type: 'text', part: { text: answer } },
    { type: 'step_finish', part: { reason: 'stop', cost: 0.01 } },
  ];
  expect(parseOutput('opencode', complete.map(row => JSON.stringify(row)).join('\n'), job).costUsd).toBe(0.01);
  expect(() => parseOutput('opencode', JSON.stringify(complete[0]), job)).toThrow('INCOMPLETE');
  expect(() =>
    parseOutput('pi', piEvents({ content: [{ type: 'text', text: 'PASS, all tests passed' }] }), job),
  ).toThrow();
});

test('event creation is exclusive and corrupted history fails loudly', () => {
  const root = temp();
  const path = writeEvent(root, run);
  expect(() => writeEvent(root, { ...run, question: 'overwrite' })).toThrow();
  expect(readEvents(root)).toEqual([run]);
  writeFileSync(path, '{broken');
  expect(() => readEvents(root)).toThrow();
});

test('evaluation binds a completed response and local evidence, with independent adjudication', () => {
  const root = temp();
  writeEvent(root, run);
  writeEvent(root, result);
  writeFileSync(join(root, 'verification.txt'), 'observed local result');
  expect(() => recordEvaluation(root, { ...evaluation, responseHash: digest('different') })).toThrow(
    'RESPONSE_MISMATCH',
  );
  expect(() => recordEvaluation(root, { ...evaluation, judge: `${run.provider}/${run.model}` })).toThrow(
    'OWN_RESPONSE',
  );
  expect(() => parseEvaluation({ ...evaluation, adjudicator: evaluation.judge })).toThrow('SELF_ADJUDICATION');
  expect(() => parseEvaluation({ ...evaluation, criteria: { ...evaluation.criteria, correctness: 1001 } })).toThrow();
  recordEvaluation(root, evaluation);
  expect(readEvents(root)).toHaveLength(3);
  expect(() => recordEvaluation(root, { ...evaluation, id: 'duplicate-rating' })).toThrow('DUPLICATE_JUDGE');
  const failed: Result = { ...result, status: 'failed', error: 'quota', exitCode: 1 };
  expect(() => validateLinks(evaluation, [run, failed])).toThrow('COMPLETED_RUN');
});

test('evidence symlinks cannot escape the project and changed evidence cannot be blessed', () => {
  const root = temp(),
    outside = temp();
  writeEvent(root, run);
  writeEvent(root, result);
  writeFileSync(join(outside, 'result.txt'), 'observed local result');
  symlinkSync(join(outside, 'result.txt'), join(root, 'verification.txt'));
  expect(() => recordEvaluation(root, evaluation)).toThrow('ESCAPES_PROJECT');
  rmSync(join(root, 'verification.txt'));
  writeFileSync(join(root, 'verification.txt'), 'different observed result');
  expect(() => recordEvaluation(root, evaluation)).toThrow('EVIDENCE_HASH_MISMATCH');
});

test('stats exclude peer opinions and failed runs from quality but retain availability and unknown cost', () => {
  const secondRun: Run = { ...run, id: 'timed-out' };
  const failed: Result = {
    ...result,
    id: 'timed-out.result',
    runId: secondRun.id,
    status: 'timeout',
    error: 'wall_timeout',
    exitCode: null,
    elapsedMs: 1000,
  };
  const provisional: Evaluation = { ...evaluation, status: 'provisional', adjudicator: null };
  expect(computeStats([run, result, provisional])[0]?.qualityScore).toBeNull();
  const stats = computeStats([run, result, secondRun, failed, evaluation]);
  expect(stats[0]).toMatchObject({
    attempts: 2,
    completed: 1,
    failed: 1,
    completionRate: 50,
    qualityScore: 800,
    qualitySamples: 1,
    medianCompletedMs: 500,
    reportedCostUsd: null,
  });
  expect(computeStats([run, result, evaluation], 'design')).toEqual([]);
});

test('an append-only correction supersedes a score without counting the response twice', () => {
  const correction: Evaluation = {
    ...evaluation,
    id: 'corrected-rating',
    supersedes: evaluation.id,
    recordedAt: '2026-09-05T00:00:03.000Z',
    criteria: { correctness: 400, relevance: 400, actionability: 400, evidence: 400 },
  };
  const events = [run, result, evaluation, correction];
  events.forEach(event => validateLinks(event, events));
  expect(computeStats(events)[0]).toMatchObject({ qualityScore: 400, qualitySamples: 1 });
  expect(() => validateLinks({ ...correction, id: 'forked-rating' }, events)).toThrow('FORK_REJECTED');
  expect(() => parseEvent({ ...result, response: '' })).toThrow('COMPLETED_RESULT_INVALID');
});

test('history rejects a falsified response digest and filename identity', () => {
  expect(() => validateLinks({ ...result, responseHash: digest('wrong') }, [run])).toThrow('RESULT_BINDING');
  const root = temp();
  const path = writeEvent(root, run);
  mkdirSync(join(root, 'agents/evidence/extra'), { recursive: true });
  writeFileSync(join(root, 'agents/evidence/wrong-name.json'), readFileSync(path));
  expect(() => readEvents(root)).toThrow('FILENAME_MISMATCH');
});
