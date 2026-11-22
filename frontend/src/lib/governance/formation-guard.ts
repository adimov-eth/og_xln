/**
 * A board seat this wallet holds, beside a seat held by another wallet, halts both runtimes:
 * a runtime that holds one seat of an Entity treats every message for that Entity as local
 * (core/runtime/delivery/plan.ts ROUTE_LOCAL_SIGNER_MISMATCH), and no route to another runtime's
 * seat exists. Until it does, Formation refuses such a board instead of creating it.
 */
export const SPLIT_BOARD_REFUSAL =
  'A board with a signer from another wallet cannot run yet: both wallets would stop. Use only signers from this wallet.';

export const splitBoardRefusal = (
  members: readonly Readonly<{ name: string }>[],
  isLocalSigner: (address: string) => boolean,
): string | null => {
  const names = members.map(member => member.name.trim().toLowerCase());
  const local = names.filter(isLocalSigner);
  return local.length > 0 && local.length < names.length ? SPLIT_BOARD_REFUSAL : null;
};
