/** Development evidence only: these records never grant protocol or release authority. */
export const TASKS = ['code', 'spec', 'architecture', 'design', 'review', 'debug'] as const;
export const CRITERIA = ['correctness', 'relevance', 'actionability', 'evidence'] as const;
export type Task = (typeof TASKS)[number];
export type Harness = 'pi' | 'opencode';
export type Evidence = Readonly<{ path: string; sha256: string }>;
export type Job = Readonly<{
  schemaVersion: 1;
  id: string;
  project: string;
  task: Task;
  sourceSha: string;
  harness: Harness;
  provider: string;
  model: string;
  family: string;
  effort: string | null;
  timeoutMs: number;
  question: string;
  evidence: readonly Evidence[];
}>;
export type Run = Job &
  Readonly<{
    kind: 'run';
    recordedAt: string;
    candidateHash: string;
    promptHash: string;
  }>;
export type Result = Readonly<{
  schemaVersion: 1;
  kind: 'result';
  id: string;
  runId: string;
  recordedAt: string;
  harnessVersion: string | null;
  servedProvider: string | null;
  status: 'completed' | 'failed' | 'timeout' | 'invalid_response';
  elapsedMs: number;
  exitCode: number | null;
  costUsd: number | null;
  response: string;
  responseHash: string;
  stdoutHash: string;
  stderrHash: string;
  error: string | null;
}>;
export type Evaluation = Readonly<{
  schemaVersion: 1;
  kind: 'evaluation';
  id: string;
  runId: string;
  recordedAt: string;
  responseHash: string;
  judge: string;
  judgeFamily: string;
  adjudicator: string | null;
  status: 'provisional' | 'verified';
  criteria: Readonly<Record<(typeof CRITERIA)[number], number>>;
  evidence: readonly Evidence[];
  rationale: string;
  supersedes: string | null;
}>;
export type Event = Run | Result | Evaluation;
