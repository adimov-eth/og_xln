import { existsSync, mkdirSync, readdirSync, readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import type { Evaluation, Event, Run } from './types';
import { parseEvent } from './decode';
import { digest } from './packet';
import { fail } from './values';
import { publishJson, withEvaluationLock } from './publication';

const eventDirectory = (root: string): string => join(root, 'agents/evidence');
export const readJson = (path: string): unknown => {
  const content = readFileSync(path);
  if (content.byteLength > 2_000_000) return fail('JSON_SIZE_LIMIT');
  return JSON.parse(content.toString());
};
export const readEvents = (root: string): readonly Event[] => {
  const directory = eventDirectory(root);
  if (!existsSync(directory)) return [];
  const events = readdirSync(directory)
    .filter(name => name.endsWith('.json'))
    .sort()
    .map(name => {
      const event = parseEvent(readJson(join(directory, name)));
      if (`${event.id}.json` !== name) return fail('EVENT_FILENAME_MISMATCH');
      return event;
    });
  events.forEach(event => validateLinks(event, events));
  return events;
};

export const writeEvent = (root: string, input: Event): string => {
  const event = parseEvent(input);
  const directory = eventDirectory(root);
  mkdirSync(directory, { recursive: true });
  const path = join(directory, `${event.id}.json`);
  publishJson(path, `${JSON.stringify(event, null, 2)}\n`);
  return path;
};

const linkedRun = (event: Evaluation | Extract<Event, { kind: 'result' }>, events: readonly Event[]): Run => {
  const run = events.find(candidate => candidate.id === event.runId);
  if (!run || run.kind !== 'run') return fail('RUN_REFERENCE_MISSING');
  return run;
};

const validateEvaluation = (event: Evaluation, run: Run, events: readonly Event[]): void => {
  const result = events.find(candidate => candidate.kind === 'result' && candidate.runId === run.id);
  if (!result || result.kind !== 'result' || result.status !== 'completed')
    return fail('EVALUATION_REQUIRES_COMPLETED_RUN');
  if (event.responseHash !== result.responseHash) return fail('EVALUATION_RESPONSE_MISMATCH');
  const author = `${run.provider}/${run.model}`;
  if (event.judge === author || event.adjudicator === author) return fail('AUTHOR_CANNOT_JUDGE_OWN_RESPONSE');
  const prior = events.filter(
    (candidate): candidate is Evaluation =>
      candidate.kind === 'evaluation' &&
      candidate.runId === run.id &&
      candidate.judge === event.judge &&
      candidate.id !== event.id,
  );
  if (event.supersedes === null) {
    if (prior.some(candidate => candidate.supersedes === null)) fail('DUPLICATE_JUDGE_EVALUATION');
    return;
  }
  const previous = prior.find(candidate => candidate.id === event.supersedes);
  if (!previous || previous.judgeFamily !== event.judgeFamily) return fail('SUPERSEDES_REFERENCE_INVALID');
  if (Date.parse(previous.recordedAt) >= Date.parse(event.recordedAt)) return fail('SUPERSEDES_TIME_INVALID');
  if (prior.some(candidate => candidate.supersedes === event.supersedes)) fail('SUPERSEDES_FORK_REJECTED');
};

export const validateLinks = (event: Event, events: readonly Event[]): void => {
  if (event.kind === 'run') return;
  const run = linkedRun(event, events);
  if (Date.parse(event.recordedAt) < Date.parse(run.recordedAt)) fail('EVENT_PRECEDES_RUN');
  if (event.kind === 'evaluation') return validateEvaluation(event, run, events);
  if (event.id !== `${run.id}.result` || digest(event.response) !== event.responseHash) fail('RESULT_BINDING_INVALID');
};

/** A verified rating requires a local artifact digest; the named adjudicator owns its meaning. */
export const recordEvaluation = (root: string, event: Evaluation): string => {
  for (const entry of event.evidence) {
    const path = realpathSync(resolve(root, entry.path));
    const inside = relative(realpathSync(root), path);
    if (inside.startsWith('..') || isAbsolute(inside)) fail('EVIDENCE_PATH_ESCAPES_PROJECT');
    if (digest(readFileSync(path)) !== entry.sha256) fail('EVALUATION_EVIDENCE_HASH_MISMATCH');
  }
  return withEvaluationLock(eventDirectory(root), () => {
    validateLinks(event, readEvents(root));
    return writeEvent(root, event);
  });
};
