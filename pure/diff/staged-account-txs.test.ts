// Account txs an Entity frame stages, through the runtime loop (og processRuntime vs the rewrite). og's Account stage
// (rscore/authority/entity-stage.ts executeAccountInput) records every enqueue an Entity tx returns and admits it only
// after the frame's txs, so a later tx in the same frame still reads the Account's mempool without it. A settle_execute
// behind another settle_execute on the same Account therefore passes og's SETTLEMENT_TRANSITION_ALREADY_PENDING guard
// (settle.ts:654), and admission drops its duplicate submit. A transition already in the Account's frame is pending
// for real: the rejection evicts the whole signed command (application.ts applyRegularEntityTx, start.ts
// buildEntityProposalEvictingRejected), so its nonce does not advance.
import { describe, expect, test } from "bun:test";
import { HUB, openWorld, type World } from "./world.ts";
import type { EntityTx } from "../xln.ts";

const A = 0;
const tx = (type: string, data: unknown): EntityTx => ({ type, data }) as unknown as EntityTx;
type OgWorkspace = { readonly status: string };
type OgAccount = {
  readonly state?: { readonly settlementWorkspace?: OgWorkspace };
  readonly pendingFrame?: { readonly accountTxs: readonly { readonly type: string }[] };
};
type OgNonces = { readonly entityCommandNonces?: { readonly bySigner: ReadonlyMap<string, { readonly nonce: bigint }> } };
const workspace = (w: World): string | undefined =>
  (w.ogAccount(A, HUB) as OgAccount | undefined)?.state?.settlementWorkspace?.status;
const pendingKinds = (w: World): readonly string[] =>
  ((w.ogAccount(A, HUB) as OgAccount | undefined)?.pendingFrame?.accountTxs ?? []).map((t) => t.type);
/** A's one signer's last committed command nonce in og. */
const commandNonce = (w: World): bigint | undefined =>
  [...((w.ogState(A) as OgNonces | undefined)?.entityCommandNonces?.bySigner.values() ?? [])][0]?.nonce;
const clean = async (w: World, users: Parameters<World["lane"]["tick"]>[1] = []): Promise<void> => {
  expect(await w.lane.tick([], users)).toEqual([]);
};
const execute = (w: World): EntityTx => tx("settle_execute", { counterpartyEntityId: w.ids[HUB] });
/**
 * A proposes an r2c to the hub (A executes it); the hub signs it on its own, and once both sides commit A holds a
 * ready_to_submit workspace.
 */
const ready = async (w: World): Promise<void> => {
  const [imports, opens] = w.importAll();
  expect(await w.lane.tick(imports, [])).toEqual([]);
  await clean(w, opens);
  await w.chain.debugFundReservesBatch(w.ids.map((entityId) => ({ entityId, tokenId: 1, amount: 10n ** 9n })));
  await clean(w);
  const ops = [{ type: "r2c", tokenId: 1, amount: 100n }];
  await clean(w, [w.user(A, [tx("settle_propose", { counterpartyEntityId: w.ids[HUB], ops, memo: "staged" })])]);
  await Array.from({ length: 4 }).reduce<Promise<void>>((prev) => prev.then(() => clean(w)), Promise.resolve());
  expect(workspace(w)).toBe("ready_to_submit");
  expect(pendingKinds(w)).toEqual([]);
};

describe("Account txs staged by an Entity frame, og processRuntime vs the rewrite", () => {
  test("MATCH (og entity-stage admissionRequests): a second settle_execute in the same command reads the Account without the first one's submit", async () => {
    const w = await openWorld(0x57a9ed, "staged-execute");
    try {
      await ready(w);
      const before = commandNonce(w);
      await clean(w, [w.user(A, [execute(w), execute(w)])]);
      // og applied the command: its nonce advanced, and the Account proposes one submit
      expect(commandNonce(w)).toBe((before ?? 0n) + 1n);
      expect(pendingKinds(w)).toEqual(["settle_transition"]);
      expect(w.coverage.haltTexts).toEqual([]);
    } finally {
      await w.close();
    }
  }, 600_000);

  test("MATCH (og rejectFailure SETTLEMENT_TRANSITION_ALREADY_PENDING): a submit in the Account's frame evicts the whole command", async () => {
    const w = await openWorld(0x57a9ee, "pending-execute");
    try {
      await ready(w);
      await clean(w, [w.user(A, [execute(w)])]);
      expect(pendingKinds(w)).toEqual(["settle_transition"]);
      const before = commandNonce(w);
      const note = tx("chatMessage", { message: "staged", timestamp: Number(w.lane.runtime().timestamp) });
      await clean(w, [w.user(A, [note, execute(w)])]);
      expect(commandNonce(w)).toBe(before);
      expect(w.coverage.haltTexts).toEqual([]);
    } finally {
      await w.close();
    }
  }, 600_000);
});
