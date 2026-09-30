// Entities that each run their own Runtime, and so their own clock: a Runtime's clock never runs behind itself, so two
// Entities in one Runtime can never disagree about the time. A delivered input is stamped by the receiver's clock.
import { NOW, unwrap } from "../xln_run.ts";
import { applyRuntime, convertOutput, runtimeWake, stampArrival, type EntityId, type RoutedEntityInput, type Runtime } from "../xln.ts";

/** The Runtimes by name, and which one each Entity lives in. */
export type World = { readonly runtimes: ReadonlyMap<string, Runtime>; readonly home: ReadonlyMap<EntityId, string> };
/** The local time of each Entity (Entities of one Runtime share it). */
export type Clocks = ReadonlyMap<EntityId, bigint>;
/** The context one Runtime frame runs under (verifiers and HTLC infrastructure). */
export type Context = () => object;

export const runtimeOf = (w: World, id: EntityId): Runtime => w.runtimes.get(w.home.get(id)!)!;
export const arrivesAt = (clocks: Clocks, input: RoutedEntityInput): RoutedEntityInput =>
  stampArrival(input, clocks.get(input.entityId)!);
export const withRuntime = (w: World, id: EntityId, rt: Runtime): World =>
  ({ ...w, runtimes: new Map([...w.runtimes, [w.home.get(id)!, rt]]) });
export const allAt = (ids: readonly EntityId[], t: bigint): Clocks => new Map(ids.map((id): [EntityId, bigint] => [id, t]));

export type Stepped =
  | { readonly ok: true; readonly world: World; readonly routed: readonly RoutedEntityInput[] }
  | { readonly ok: false; readonly error: unknown };
type Applied = Extract<ReturnType<typeof applyRuntime>, { readonly ok: true }>["value"];
/** The inputs a frame's outbox routes: an empty self-addressed one is dropped, a message is converted for its receiver. */
const routedFrom = (w: World, out: Applied, source: EntityId, clock: bigint): readonly RoutedEntityInput[] =>
  out.outbox.flatMap((o) =>
    "input" in o && o.input.kind === "txs" && o.input.txs.length === 0 && o.to === source
      ? []
      : [unwrap(convertOutput("input" in o ? out.runtime : runtimeOf(w, o.to), o, source, clock))]);
/** One Runtime frame of the Entity the input addresses: the new world and the inputs its outbox routes. */
export const step = (context: Context, w: World, input: RoutedEntityInput): Stepped => {
  const rt = runtimeOf(w, input.entityId);
  const out = applyRuntime(rt, { runtimeTxs: [], entityInputs: [input] }, context() as never);
  if (!out.ok) return { ok: false, error: out.error };
  const clock = input.input.kind === "txs" ? input.input.timestamp : NOW;
  return { ok: true, world: withRuntime(w, input.entityId, out.value.runtime), routed: routedFrom(w, out.value, input.entityId, clock) };
};
/** A Runtime's timer tick at `now`: the wakes due by then (an expired lock's timeout among them) run as one frame. */
export const tick = (context: Context, w: World, home: string, now: bigint): Stepped => {
  const rt = w.runtimes.get(home)!;
  const wake = runtimeWake(rt, Number(now));
  const out = applyRuntime(rt, wake.input, { ...context(), local: wake.local } as never);
  if (!out.ok) return { ok: false, error: out.error };
  const resident = [...w.home].find(([, h]) => h === home)![0];
  return {
    ok: true,
    world: { ...w, runtimes: new Map([...w.runtimes, [home, out.value.runtime]]) },
    routed: routedFrom(w, out.value, resident, now),
  };
};
export type Settled = {
  readonly world: World;
  readonly refused: readonly unknown[];
  /** The inputs `hold` kept back in transit, in order. */
  readonly held: readonly RoutedEntityInput[];
};
/** Whether an input is kept in transit instead of delivered. */
export type Hold = (input: RoutedEntityInput) => boolean;
const never: Hold = () => false;
/**
 * Frames run until no input is left; every delivery is stamped with the receiver's clock. An input `hold` keeps back
 * stays in transit and is returned. The refusal that stopped it, if any.
 */
export const settle = (
  context: Context, w: World, queue: readonly RoutedEntityInput[], clocks: Clocks, hold: Hold = never,
): Settled => {
  const [head, ...rest] = queue;
  if (head === undefined) return { world: w, refused: [], held: [] };
  if (hold(head)) {
    const later = settle(context, w, rest, clocks, hold);
    return { ...later, held: [head, ...later.held] };
  }
  const done = step(context, w, head);
  if (!done.ok) return { world: w, refused: [done.error], held: [] };
  return settle(context, done.world, [...rest, ...done.routed.map((r) => arrivesAt(clocks, r))], clocks, hold);
};
