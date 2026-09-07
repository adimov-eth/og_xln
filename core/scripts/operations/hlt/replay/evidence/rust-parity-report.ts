import {
  requireBoundaryInteger,
  requireBoundaryRecord,
  requireExactBoundaryKeys,
} from '../../../../../protocol/boundary-validation';

type AccountsRoots = Readonly<Record<string, string>>;

const decodeAccountsRoots = (value: unknown): AccountsRoots => {
  const code = 'HLT_MIXED_PARITY_RUST_REPORT_ACCOUNTS_ROOTS';
  const roots = requireBoundaryRecord(value, code);
  const entries = Object.entries(roots);
  if (entries.length === 0) throw new Error(`${code}_EMPTY`);
  return Object.fromEntries(
    entries.map(([key, root]) => {
      if (!/^0x[0-9a-f]{64}:0x[0-9a-f]{40}$/.test(key)) throw new Error(`${code}_KEY:${key}`);
      if (typeof root !== 'string' || !/^0x[0-9a-f]{64}$/.test(root)) throw new Error(`${code}_VALUE:${key}`);
      return [key, root] as const;
    }),
  );
};

/** Every replica owns a root: a second owner or signer cannot disappear behind the first. */
export const assertRustParityAccountsRootsEqual = (
  expected: AccountsRoots,
  actual: AccountsRoots,
  code: string,
): void => {
  requireExactBoundaryKeys(actual, Object.keys(expected), [], `${code}_KEYS`);
  for (const [key, root] of Object.entries(expected)) {
    if (actual[key] !== root) throw new Error(`${code}_VALUE:${key}:${root}:${actual[key]}`);
  }
};

export type RustParityReport = Readonly<{
  frames: number;
  ingress: number;
  egress: number;
  directPayments: number;
  effectDigestsCompared: number;
  eventDigestsCompared: number;
  localContinuationsCompared: number;
  outboxDigestsCompared: number;
  postStateHashesCompared: number;
  runtimeRootsCompared: number;
  accountsRoots: AccountsRoots;
}>;

export const decodeRustParityReport = (value: unknown): RustParityReport => {
  const report = requireBoundaryRecord(value, 'HLT_MIXED_PARITY_RUST_REPORT_INVALID');
  const count = (field: keyof Omit<RustParityReport, 'accountsRoots'>): number =>
    requireBoundaryInteger(report[field], `HLT_MIXED_PARITY_RUST_REPORT_${field}`);
  if (Object.hasOwn(report, 'accountsRoot')) throw new Error('HLT_MIXED_PARITY_RUST_REPORT_RETIRED_ACCOUNTS_ROOT');
  return {
    frames: count('frames'),
    ingress: count('ingress'),
    egress: count('egress'),
    directPayments: count('directPayments'),
    effectDigestsCompared: count('effectDigestsCompared'),
    eventDigestsCompared: count('eventDigestsCompared'),
    localContinuationsCompared: count('localContinuationsCompared'),
    outboxDigestsCompared: count('outboxDigestsCompared'),
    postStateHashesCompared: count('postStateHashesCompared'),
    runtimeRootsCompared: count('runtimeRootsCompared'),
    accountsRoots: decodeAccountsRoots(report['accountsRoots']),
  };
};
