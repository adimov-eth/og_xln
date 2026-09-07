import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPacket, digest } from './packet';
import { harnessCommand } from './execution/harness';
import { runProcess } from './execution/process';
import type { ProcessResult } from './execution/process';
import { parseOutput } from './output';
import { preflightArgs, validatePreflight } from './execution/preflight';
import { readEvents, validateLinks, writeEvent } from './store';
import type { Job, Result, Run } from './types';
import { AdvisorError, fail } from './values';

const resultFromProcess = (run: Run, processResult: ProcessResult, harnessVersion: string | null): Result => {
  const base = {
    schemaVersion: 1 as const,
    kind: 'result' as const,
    id: `${run.id}.result`,
    runId: run.id,
    recordedAt: new Date().toISOString(),
    harnessVersion,
    servedProvider: null,
    elapsedMs: processResult.elapsedMs,
    exitCode: processResult.exitCode,
    costUsd: null,
    response: '',
    responseHash: digest(''),
    stdoutHash: digest(processResult.stdout),
    stderrHash: digest(processResult.stderr),
  };
  if (processResult.timedOut) return { ...base, status: 'timeout', error: 'wall_timeout' };
  if (processResult.error || processResult.exitCode !== 0) {
    return { ...base, status: 'failed', error: processResult.error ?? `exit_${processResult.exitCode}` };
  }
  try {
    const response = parseOutput(run.harness, processResult.stdout, run);
    return {
      ...base,
      status: 'completed',
      error: null,
      costUsd: response.costUsd,
      response: response.text,
      responseHash: digest(response.text),
    };
  } catch (error) {
    if (!(error instanceof AdvisorError || error instanceof SyntaxError)) throw error;
    return {
      ...base,
      status: 'invalid_response',
      error: error instanceof AdvisorError ? error.message : 'final_response_json_invalid',
    };
  }
};

const execute = async (run: Run, prompt: string, directory: string): Promise<Result> => {
  const started = performance.now();
  const command = harnessCommand(run, directory);
  const version = await runProcess({
    ...command,
    args: ['--version'],
    cwd: directory,
    timeoutMs: Math.min(run.timeoutMs, 2000),
  });
  if (
    version.exitCode !== 0 ||
    version.error ||
    version.timedOut ||
    !/^\d+\.\d+\.\d+(?:[-.a-zA-Z0-9]+)?\s*$/.test(version.stdout)
  ) {
    return resultFromProcess(run, { ...version, error: 'harness_version_unavailable' }, null);
  }
  let remaining = run.timeoutMs - Math.ceil(performance.now() - started);
  if (remaining <= 0) return resultFromProcess(run, { ...version, timedOut: true }, version.stdout.trim());
  const preflight = await runProcess({ ...command, args: preflightArgs(run), cwd: directory, timeoutMs: remaining });
  const valid =
    preflight.exitCode === 0 && !preflight.error && !preflight.timedOut && validatePreflight(preflight.stdout, run);
  if (!valid)
    return resultFromProcess(
      run,
      { ...preflight, error: 'harness_preflight_failed', elapsedMs: Math.round(performance.now() - started) },
      version.stdout.trim(),
    );
  remaining = run.timeoutMs - Math.ceil(performance.now() - started);
  if (remaining <= 0) return resultFromProcess(run, { ...preflight, timedOut: true }, version.stdout.trim());
  const output = await runProcess({ ...command, cwd: directory, timeoutMs: remaining, input: prompt });
  return resultFromProcess(
    run,
    { ...output, elapsedMs: Math.round(performance.now() - started) },
    version.stdout.trim(),
  );
};

export const ask = async (root: string, job: Job): Promise<Result> => {
  const existing = readEvents(root);
  if (existing.some(event => event.id === job.id || event.id === `${job.id}.result`)) return fail('RUN_ID_EXISTS');
  const packet = buildPacket(root, job);
  const run: Run = {
    ...job,
    kind: 'run',
    recordedAt: new Date().toISOString(),
    candidateHash: packet.candidateHash,
    promptHash: digest(packet.prompt),
  };
  const directory = mkdtempSync(join(tmpdir(), 'project-advisor-'));
  try {
    // Build and validate the isolated harness settings before recording an accepted run.
    harnessCommand(run, directory);
    writeEvent(root, run);
    const result = await execute(run, packet.prompt, directory);
    validateLinks(result, [...existing, run]);
    writeEvent(root, result);
    return result;
  } finally {
    rmSync(directory, { recursive: true });
  }
};
