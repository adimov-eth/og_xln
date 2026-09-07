import type { RuntimeAdapter, RuntimeAdapterSendResult, RuntimeInput } from '@xln/core/api/public/runtime-module';

type Observation = Readonly<{
  adapter: Pick<RuntimeAdapter, 'send'>;
  input: RuntimeInput;
  command: Readonly<{ commandId: string; commandSequence: number }>;
  isCurrent: () => boolean;
  accepted: (height: number) => Promise<void> | void;
  timeoutMs?: number;
  pollMs?: number;
}>;

const assertCurrent = (observation: Observation, expired: boolean): void => {
  if (expired) throw new Error('REMOTE_RUNTIME_COMMAND_OBSERVATION_TIMEOUT');
  if (!observation.isCurrent()) throw new Error('REMOTE_RUNTIME_COMMAND_OBSERVATION_SUPERSEDED');
};

const pollCommand = async (
  observation: Observation,
  expired: () => boolean,
): Promise<RuntimeAdapterSendResult> => {
  const input = structuredClone(observation.input);
  const command = { ...observation.command };
  let first = true;
  for (;;) {
    assertCurrent(observation, expired());
    // Retry the exact authenticated command. Only its committed lane frontier
    // can acknowledge it; an unrelated Runtime frame cannot prove acceptance.
    const result = await observation.adapter.send(input, command);
    assertCurrent(observation, expired());
    if (result.commandSequence !== command.commandSequence || !Number.isSafeInteger(result.height) || result.height < 0 ||
      (result.status !== 'pending' && result.status !== 'observed')) throw new Error('REMOTE_RUNTIME_COMMAND_OBSERVATION_INVALID');
    if (first) await observation.accepted(result.height);
    assertCurrent(observation, expired());
    first = false;
    if (result.status === 'observed') return result;
    await delay(observation.pollMs ?? 100);
  }
};

const delay = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

export const waitForObservedRemoteCommand = async (observation: Observation): Promise<RuntimeAdapterSendResult> => {
  let expired = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      expired = true;
      reject(new Error('REMOTE_RUNTIME_COMMAND_OBSERVATION_TIMEOUT'));
    }, observation.timeoutMs ?? 5_000);
  });
  try {
    return await Promise.race([pollCommand(observation, () => expired), deadline]);
  } finally {
    expired = true;
    if (timer !== undefined) clearTimeout(timer);
  }
};
