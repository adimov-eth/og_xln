import type { RuntimeReplica } from '../types';

type RuntimeDeliveryInfrastructure = NonNullable<RuntimeReplica['infrastructure']>;

/**
 * One canonical question for the committed network outbox: can this Runtime
 * hand bytes to `runtimeId` right now? The Runtime writer uses it to decide
 * whether a retained output is drainable work; delivery uses it to report a
 * retained output that no readiness edge can ever wake.
 */
export const canDeliverCommittedOutput = (
  state: RuntimeDeliveryInfrastructure,
  runtimeId: string,
): boolean =>
  state.canDeliverEntityInputs
    ? state.canDeliverEntityInputs(runtimeId)
    // `canDeliver` is an optional member of the P2P dispatch contract: a
    // Runtime without that capability can never prove a peer is ready.
    : state.p2p?.canDeliver?.(runtimeId) === true;
