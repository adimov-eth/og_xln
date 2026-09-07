import { CRITERIA, TASKS } from './types';
import type { Evaluation, Event, Job, Result, Run } from './types';
import * as v from './values';

const JOB_KEYS = [
  'schemaVersion',
  'id',
  'project',
  'task',
  'sourceSha',
  'harness',
  'provider',
  'model',
  'family',
  'effort',
  'timeoutMs',
  'question',
  'evidence',
] as const;
const token = (value: unknown): string => v.pattern(value, /^[a-zA-Z0-9][a-zA-Z0-9._/-]{0,199}$/);
const version = (value: unknown): 1 => (v.integer(value, 1, 1) === 1 ? 1 : v.fail('VERSION_INVALID'));

export const parseJob = (value: unknown): Job => {
  const row = v.exact(value, JOB_KEYS);
  if (v.id(row['id']).length > 100) return v.fail('JOB_ID_TOO_LONG');
  const harness = v.choice(row['harness'], ['pi', 'opencode']);
  const effort = v.nullable(row['effort'], token);
  if (harness === 'pi' && effort !== null) {
    v.choice(effort, ['off', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max']);
  }
  return {
    schemaVersion: version(row['schemaVersion']),
    id: v.id(row['id']),
    project: v.id(row['project']),
    task: v.choice(row['task'], TASKS),
    sourceSha: v.pattern(row['sourceSha'], /^[a-f0-9]{40}$/),
    harness,
    provider: v.pattern(row['provider'], /^[a-z0-9][a-z0-9-]{0,79}$/),
    model: token(row['model']),
    family: v.id(row['family']),
    effort,
    // Owner-approved external quorum budget: up to 20 minutes, not the local stand's 30 seconds.
    timeoutMs: v.integer(row['timeoutMs'], 100, 1_200_000),
    question: v.string(row['question'], 32_000),
    evidence: v.evidence(row['evidence']),
  };
};

const parseRun = (value: unknown): Run => {
  const row = v.exact(value, [...JOB_KEYS, 'kind', 'recordedAt', 'candidateHash', 'promptHash']);
  const job = parseJob(Object.fromEntries(JOB_KEYS.map(key => [key, row[key]])));
  return {
    ...job,
    kind: 'run',
    recordedAt: v.timestamp(row['recordedAt']),
    candidateHash: v.hash(row['candidateHash']),
    promptHash: v.hash(row['promptHash']),
  };
};

const cost = (value: unknown): number => {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : v.fail('COST_INVALID');
};

const response = (value: unknown): string => {
  if (typeof value !== 'string' || value.length > 1_000_000) return v.fail('RESPONSE_INVALID');
  return value;
};

const parseResult = (value: unknown): Result => {
  const row = v.exact(value, [
    'schemaVersion',
    'kind',
    'id',
    'runId',
    'recordedAt',
    'harnessVersion',
    'servedProvider',
    'status',
    'elapsedMs',
    'exitCode',
    'costUsd',
    'response',
    'responseHash',
    'stdoutHash',
    'stderrHash',
    'error',
  ]);
  const result: Result = {
    schemaVersion: version(row['schemaVersion']),
    kind: 'result',
    id: v.id(row['id']),
    runId: v.id(row['runId']),
    recordedAt: v.timestamp(row['recordedAt']),
    harnessVersion: v.nullable(row['harnessVersion'], token),
    servedProvider: v.nullable(row['servedProvider'], token),
    status: v.choice(row['status'], ['completed', 'failed', 'timeout', 'invalid_response']),
    elapsedMs: v.integer(row['elapsedMs']),
    exitCode: v.nullable(row['exitCode'], value => v.integer(value, 0, 255)),
    costUsd: v.nullable(row['costUsd'], cost),
    response: response(row['response']),
    responseHash: v.hash(row['responseHash']),
    stdoutHash: v.hash(row['stdoutHash']),
    stderrHash: v.hash(row['stderrHash']),
    error: v.nullable(row['error'], v.string),
  };
  if (result.status === 'completed' && (!result.response.trim() || result.error !== null || result.exitCode !== 0)) {
    return v.fail('COMPLETED_RESULT_INVALID');
  }
  if (result.status !== 'completed' && result.error === null) return v.fail('FAILED_RESULT_ERROR_REQUIRED');
  return result;
};

export const parseEvaluation = (value: unknown): Evaluation => {
  const row = v.exact(value, [
    'schemaVersion',
    'kind',
    'id',
    'runId',
    'recordedAt',
    'responseHash',
    'judge',
    'judgeFamily',
    'adjudicator',
    'status',
    'criteria',
    'evidence',
    'rationale',
    'supersedes',
  ]);
  v.choice(row['kind'], ['evaluation']);
  const criteria = v.exact(row['criteria'], CRITERIA);
  const status = v.choice(row['status'], ['provisional', 'verified']);
  const adjudicator = v.nullable(row['adjudicator'], token);
  const judge = token(row['judge']);
  if ((status === 'verified') !== (adjudicator !== null)) return v.fail('ADJUDICATION_REQUIRED');
  if (judge === adjudicator) return v.fail('SELF_ADJUDICATION_REJECTED');
  return {
    schemaVersion: version(row['schemaVersion']),
    kind: 'evaluation',
    id: v.id(row['id']),
    runId: v.id(row['runId']),
    recordedAt: v.timestamp(row['recordedAt']),
    responseHash: v.hash(row['responseHash']),
    judge,
    judgeFamily: v.id(row['judgeFamily']),
    adjudicator,
    status,
    criteria: {
      correctness: v.integer(criteria['correctness'], 0, 1000),
      relevance: v.integer(criteria['relevance'], 0, 1000),
      actionability: v.integer(criteria['actionability'], 0, 1000),
      evidence: v.integer(criteria['evidence'], 0, 1000),
    },
    evidence: v.evidence(row['evidence']),
    rationale: v.string(row['rationale'], 8000),
    supersedes: v.nullable(row['supersedes'], v.id),
  };
};

export const parseEvent = (value: unknown): Event => {
  const row = v.object(value);
  switch (row['kind']) {
    case 'run':
      return parseRun(value);
    case 'result':
      return parseResult(value);
    case 'evaluation':
      return parseEvaluation(value);
    default:
      return v.fail('EVENT_KIND_INVALID');
  }
};
