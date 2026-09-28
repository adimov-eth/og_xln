// The module map of the split: which layer each top-level declaration of the monolithic xln.ts calls home.
//
// A layer is a module: base <- account <- entity <- runtime. Imports only point left (downward). A declaration's
// home is a ceiling, not a verdict: split/split.ts moves it down to the lowest layer that uses it, so a helper an
// Account needs lives in account even when its section is an Entity one. Every such move is listed in
// split/moves.txt, the generated record reviewers read.
//
// The map is written in declaration names, never line numbers, so it survives edits to xln.ts. The split fails
// when a name below no longer exists, and names the entry to fix.

export type Layer = "base" | "account" | "entity" | "runtime";
export const LAYERS: readonly Layer[] = ["base", "account", "entity", "runtime"];

/**
 * Runs of declarations in file order: each entry names the first declaration of a run, which lasts until the next
 * entry. The comment after each entry is the section header the run starts at, when it starts at one.
 */
export const RUNS: readonly (readonly [string, Layer])[] = [
  ["__brand", "base"], // vocabulary, matching, grammars, layers, collections, canonical text, hex, ABI, signatures, RLP
  ["CommittedDelta", "account"], // the committed Account state and its commitment root; the Account frame hash
  ["JAllowance", "entity"], // Depository batch, J events, calldata decoding, J-event derivations, the J batch
  ["Word", "entity"], // Depository digests
  ["HALF_ORDER", "entity"], // Hanko
  ["MAX_FILL", "entity"], // the cross-jurisdiction kernel: fill ratios, hash ladder, route, market, policy, clones
  ["SignedProofBodyPull", "account"], // pull registry settlement, account deltas, terms, body, HTLC locks
  ["OnionError", "entity"], // the HTLC onion, sealing, layer codec
  ["HTLC_TIMELOCK_DELTA_MS", "account"], // deadlines
  ["HtlcEnvelopeContext", "entity"], // building the onion, quoting, the gossip graph and route finder
  ["SwapOffer", "account"], // account body and txs, J claims, settlement, swaps, rebalance, lending, pulls,
  //                           the Account tx dispatcher and validator, og failure text, committed view, proofs,
  //                           Account consensus and disputes
  ["MemberVerify", "entity"], // quorum, EntityState, EntityTx, Entity frames, the binary codec, the Entity root
  ["EncryptionKey", "entity"], // og's smaller sections .. the J prefix inside Entity consensus
  ["JInput", "runtime"], // the Runtime model: its inputs, J replicas, J imports and submit journals, Runtime itself
  ["MAX_RUNTIME_INPUT_RUNTIME_TXS", "runtime"], // og runtime/frame/intake, tx handlers, J import registry, watcher
  ["ENTITY_J_SUBMIT_RETRY_MS", "runtime"], // J submit and EntityProvider action submit state
  ["JRec", "entity"], // J observation, the Entity's J finality and certified range, J events, the per-frame J prefix,
  //                     board handover, registration receipts and intents
  ["replicaDeadline", "runtime"], // due wakes
  ["normalizeRuntimeId", "runtime"], // cross-j atomic admission, the R -> E -> A cascade, WAL, network outbox
  ["JOp", "entity"], // the one-Account Host
  ["TowerModeV1", "runtime"], // watchtower
  ["BookSide", "entity"], // the order book, hub book, cross-j hub book, book owner, clear, cross-j followups
];

/**
 * Anchors: the domain model each layer is named after. An anchor never moves, and it lifts every declaration that
 * uses it to at least its layer; when a lower layer also uses such a declaration, the split fails and names the chain.
 */
export const PINS: Readonly<Record<string, Layer>> = {
  AccountReplica: "account",
  EntityState: "entity",
  EntityReplica: "entity",
  Runtime: "runtime",
};
