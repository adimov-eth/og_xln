import { scheduler } from 'node:timers/promises';

export type StopProcessGroupOptions = Readonly<{
  pid: number;
  signal?: NodeJS.Signals;
  termTimeoutMs: number;
  killTimeoutMs: number;
  timeoutError: string;
  onEscalate?: () => void;
}>;

const processGroupIsAlive = (pid: number): boolean => {
  try {
    process.kill(-pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
    if ((error as NodeJS.ErrnoException).code === 'EPERM') return true;
    throw error;
  }
};

export const signalProcessGroup = (pid: number, signal: NodeJS.Signals): boolean => {
  try {
    process.kill(-pid, signal);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
    throw new Error(`PROCESS_GROUP_SIGNAL_FAILED:pid=${pid}:signal=${signal}`, { cause: error });
  }
};

const waitForProcessGroupExit = async (pid: number, timeoutMs: number): Promise<boolean> => {
  const deadline = performance.now() + timeoutMs;
  while (performance.now() < deadline) {
    if (!processGroupIsAlive(pid)) return true;
    await scheduler.wait(25);
  }
  return !processGroupIsAlive(pid);
};

const signalAndWaitForProcessGroupExit = async (
  pid: number, signal: NodeJS.Signals, timeoutMs: number,
): Promise<boolean> => {
  try {
    if (!signalProcessGroup(pid, signal)) return true;
  } catch (error) {
    if (!(error instanceof Error && error.cause instanceof Error
      && 'code' in error.cause && error.cause.code === 'EPERM')) throw error;
    // Darwin can deny signals while exited group members await reaping. Only
    // ESRCH proves the whole owned group is gone; EPERM still counts as alive.
    if (await waitForProcessGroupExit(pid, timeoutMs)) return true;
    throw error;
  }
  return waitForProcessGroupExit(pid, timeoutMs);
};

export const stopProcessGroup = async (options: StopProcessGroupOptions): Promise<void> => {
  if (await signalAndWaitForProcessGroupExit(options.pid, options.signal ?? 'SIGTERM', options.termTimeoutMs)) return;
  options.onEscalate?.();
  if (await signalAndWaitForProcessGroupExit(options.pid, 'SIGKILL', options.killTimeoutMs)) return;
  throw new Error(options.timeoutError);
};
