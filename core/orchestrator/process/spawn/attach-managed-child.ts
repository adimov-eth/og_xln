import type { ChildProcess } from 'node:child_process';
import type { HubChild, ManagedRuntimeSpec, MarketMakerChild } from '../../orchestrator-types';
import {
  flushPrefixedLogChunk,
  pushChildLogLines,
  type PrefixLogState,
  writePrefixedLogChunk,
} from '../child-log-buffer';
import {
  selectChildFailureReason,
  shouldCaptureUnexpectedChildExit,
  type ChildFailureObservation,
} from '../child-recovery-policy';
import type { createManagedRuntimeLeaseManager } from '../managed-runtime-leases';

type ManagedChild = HubChild | MarketMakerChild;

export type AttachManagedChildDeps<C extends ManagedChild> = {
  logPrefix: string;
  role: ChildFailureObservation['role'];
  describeUnexpectedExit(code: number | null, signal: NodeJS.Signals | null): string;
  managedRuntimeLeases: ReturnType<typeof createManagedRuntimeLeaseManager>;
  captureManagedChildErrorLine(child: C, line: string): void;
  consumeControlledStop(pid: number | null | undefined): boolean;
  isOrchestratorShutdownStarted(): boolean;
  handleUnexpectedFailure(observation: ChildFailureObservation): void;
};

export const attachManagedChildProcess = <C extends ManagedChild>(
  child: C,
  proc: ChildProcess,
  spec: ManagedRuntimeSpec,
  deps: AttachManagedChildDeps<C>,
): void => {
  const stdoutLabel = `[${deps.logPrefix}]`;
  const stderrLabel = `[${deps.logPrefix}:err]`;
  const stdoutPrefixState: PrefixLogState = { pending: '' };
  const stderrPrefixState: PrefixLogState = { pending: '' };
  const captureErrorLine = (line: string): void => deps.captureManagedChildErrorLine(child, line);
  proc.stdout?.on('data', chunk => {
    pushChildLogLines(child.recentStdout, chunk);
    writePrefixedLogChunk(process.stdout, stdoutLabel, stdoutPrefixState, chunk);
  });
  proc.stderr?.on('data', chunk => {
    pushChildLogLines(child.recentStderr, chunk);
    writePrefixedLogChunk(process.stderr, stderrLabel, stderrPrefixState, chunk, captureErrorLine);
  });
  proc.once('exit', (code, signal) => {
    flushPrefixedLogChunk(process.stdout, stdoutLabel, stdoutPrefixState);
    flushPrefixedLogChunk(process.stderr, stderrLabel, stderrPrefixState, captureErrorLine);
    const pid = proc.pid ?? null;
    const controlledStop = deps.consumeControlledStop(pid);
    const isCurrentProc = child.proc === proc;
    deps.managedRuntimeLeases.removeLease(spec, pid);
    if (isCurrentProc) {
      child.exitedAt = Date.now();
      child.exitCode = code ?? null;
      child.exitSignal = signal ?? null;
    }
    if (shouldCaptureUnexpectedChildExit(controlledStop, deps.isOrchestratorShutdownStarted(), isCurrentProc)) {
      deps.handleUnexpectedFailure({
        role: deps.role,
        name: child.name,
        code: code ?? null,
        signal: signal ?? null,
        reason: selectChildFailureReason(
          child.recentStderr,
          child.recentStdout,
          deps.describeUnexpectedExit(code ?? null, signal ?? null),
          signal ?? null,
        ),
      });
    }
  });
};
