import { CRITERIA } from './types';
import type { Evaluation, Event, Result, Run, Task } from './types';

const average = (values: readonly number[]): number | null =>
  values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : null;
const median = (values: readonly number[]): number | null => {
  const sorted = [...values].sort((a, b) => a - b);
  if (!sorted.length) return null;
  const upper = sorted[Math.floor(sorted.length / 2)];
  if (upper === undefined) throw new Error('ADVISOR_MEDIAN_INVALID');
  if (sorted.length % 2) return upper;
  const lower = sorted[sorted.length / 2 - 1];
  if (lower === undefined) throw new Error('ADVISOR_MEDIAN_INVALID');
  return (lower + upper) / 2;
};
const runQuality = (run: Run, evaluations: readonly Evaluation[]): number | null => {
  const superseded = new Set(evaluations.flatMap(row => (row.supersedes === null ? [] : [row.supersedes])));
  const verified = evaluations.filter(
    row => row.runId === run.id && row.status === 'verified' && !superseded.has(row.id),
  );
  return average(verified.map(row => average(CRITERIA.map(key => row.criteria[key])) ?? 0));
};

const summarize = (runs: readonly Run[], results: ReadonlyMap<string, Result>, evaluations: readonly Evaluation[]) => {
  const finished = runs.flatMap(run => {
    const result = results.get(run.id);
    return result ? [result] : [];
  });
  const completed = finished.filter(result => result.status === 'completed');
  const quality = runs.flatMap(run => {
    if (results.get(run.id)?.status !== 'completed') return [];
    const score = runQuality(run, evaluations);
    return score === null ? [] : [score];
  });
  const costs = finished.flatMap(row => (row.costUsd === null ? [] : [row.costUsd]));
  return {
    attempts: runs.length,
    completed: completed.length,
    pending: runs.length - finished.length,
    failed: finished.length - completed.length,
    completionRate: Math.round((1000 * completed.length) / runs.length) / 10,
    qualityScore: average(quality),
    qualitySamples: quality.length,
    medianCompletedMs: median(completed.map(row => row.elapsedMs)),
    reportedCostUsd: costs.length ? costs.reduce((sum, value) => sum + value, 0) : null,
    costSamples: costs.length,
  };
};

export const computeStats = (events: readonly Event[], task?: Task) => {
  const runs = events.filter(
    (event): event is Run => event.kind === 'run' && (task === undefined || event.task === task),
  );
  const results = new Map(
    events.filter((event): event is Result => event.kind === 'result').map(row => [row.runId, row]),
  );
  const evaluations = events.filter((event): event is Evaluation => event.kind === 'evaluation');
  const groups = new Map<string, Run[]>();
  for (const run of runs) {
    const key = JSON.stringify([
      run.project,
      run.task,
      run.harness,
      results.get(run.id)?.harnessVersion ?? null,
      run.provider,
      run.model,
      run.family,
      run.effort,
    ]);
    groups.set(key, [...(groups.get(key) ?? []), run]);
  }
  return [...groups.values()]
    .map(group => {
      const run = group[0];
      if (!run) throw new Error('ADVISOR_EMPTY_GROUP');
      return {
        project: run.project,
        task: run.task,
        harness: run.harness,
        harnessVersion: results.get(run.id)?.harnessVersion ?? null,
        provider: run.provider,
        model: run.model,
        family: run.family,
        effort: run.effort,
        ...summarize(group, results, evaluations),
      };
    })
    .sort((a, b) => (b.qualityScore ?? -1) - (a.qualityScore ?? -1) || a.model.localeCompare(b.model));
};
