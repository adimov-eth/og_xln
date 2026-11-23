/** External wall clock for orchestration and diagnostics, never consensus. */
export const getWallClockMs = (): number => Math.round(performance.timeOrigin + performance.now());

/** Monotonic clock for measuring infrastructure latency. */
export const getPerfMs = (): number => performance.now();

/** Bound a promise that cannot be aborted; abortable I/O takes AbortSignal.timeout instead. */
export const raceTimeout = async <T>(
  promise: Promise<T>,
  timeoutMs: number,
  onTimeout: () => Error,
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(onTimeout()), timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
};
