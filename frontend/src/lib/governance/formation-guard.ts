/**
 * Formation imports one seat: the one this wallet signs with. A runtime counts a seat as local only
 * when it holds that seat's replica (core/runtime/loop/loop-identity.ts), so every other seat of the
 * board is remote, whether its key belongs to another wallet or to this one. A runtime holding one
 * seat treats every message for that Entity as local (core/runtime/delivery/plan.ts
 * ROUTE_LOCAL_SIGNER_MISMATCH), and no route to another seat exists, so the runtime halts. Until it
 * does, Formation refuses a board with more than one signer when this wallet sits on it.
 */
export const SPLIT_BOARD_REFUSAL =
  'A board with more than one signer cannot run yet: this wallet would stop. Use a board with only your signer.';

export const splitBoardRefusal = (
  members: readonly Readonly<{ name: string }>[],
  isLocalSigner: (address: string) => boolean,
): string | null => {
  const names = members.map(member => member.name.trim().toLowerCase());
  return names.length > 1 && names.some(isLocalSigner) ? SPLIT_BOARD_REFUSAL : null;
};
