import { expect, test } from 'bun:test';
import {
  assertRustParityAccountsRootsEqual,
  decodeRustParityReport,
} from '../../../../scripts/operations/hlt/replay/evidence/rust-parity-report';

const first = `0x${'11'.repeat(32)}:0x${'22'.repeat(20)}`;
const second = `0x${'33'.repeat(32)}:0x${'44'.repeat(20)}`;
const firstRoot = `0x${'aa'.repeat(32)}`;
const secondRoot = `0x${'bb'.repeat(32)}`;
const roots = { [first]: firstRoot, [second]: secondRoot };
const report = {
  frames: 2,
  ingress: 3,
  egress: 4,
  directPayments: 1,
  effectDigestsCompared: 2,
  eventDigestsCompared: 2,
  localContinuationsCompared: 2,
  outboxDigestsCompared: 2,
  postStateHashesCompared: 2,
  runtimeRootsCompared: 3,
  accountsRoots: roots,
};

test('Rust plural terminal report retains every Entity and signer Account root', () => {
  expect(decodeRustParityReport(report)).toEqual(report);
});

test('Rust terminal report rejects retired singular roots and empty or non-record root maps', () => {
  const { accountsRoots, ...counts } = report;
  expect(() => decodeRustParityReport({ ...counts, accountsRoot: firstRoot })).toThrow(
    'HLT_MIXED_PARITY_RUST_REPORT_RETIRED_ACCOUNTS_ROOT',
  );
  expect(() => decodeRustParityReport({ ...report, accountsRoot: firstRoot })).toThrow(
    'HLT_MIXED_PARITY_RUST_REPORT_RETIRED_ACCOUNTS_ROOT',
  );
  for (const invalid of [undefined, null, [], new Map(Object.entries(accountsRoots)), {}]) {
    expect(() => decodeRustParityReport({ ...report, accountsRoots: invalid })).toThrow(
      'HLT_MIXED_PARITY_RUST_REPORT_ACCOUNTS_ROOTS',
    );
  }
});

test('Rust terminal roots require canonical bytes32 Entity and address signer keys', () => {
  for (const key of [
    `0x${'11'.repeat(32)}`,
    `0x${'11'.repeat(32)}:h1-hub`,
    `0x${'11'.repeat(32)}:0x${'22'.repeat(32)}`,
    `0x${'AA'.repeat(32)}:0x${'22'.repeat(20)}`,
    `0x${'11'.repeat(32)}:0x${'BB'.repeat(20)}`,
    `${first}:extra`,
  ]) {
    expect(() => decodeRustParityReport({ ...report, accountsRoots: { [key]: firstRoot } })).toThrow(
      'HLT_MIXED_PARITY_RUST_REPORT_ACCOUNTS_ROOTS_KEY',
    );
  }
});

test('Rust terminal roots reject a malformed second root without accepting the first', () => {
  for (const value of [null, 1, '00'.repeat(32), `0x${'AA'.repeat(32)}`, `0x${'aa'.repeat(31)}`]) {
    expect(() => decodeRustParityReport({ ...report, accountsRoots: { ...roots, [second]: value } })).toThrow(
      `HLT_MIXED_PARITY_RUST_REPORT_ACCOUNTS_ROOTS_VALUE:${second}`,
    );
  }
});

test('terminal root comparison ignores object insertion order and compares both owners', () => {
  const expected = decodeRustParityReport(report).accountsRoots;
  const reordered = decodeRustParityReport({
    ...report,
    accountsRoots: { [second]: secondRoot, [first]: firstRoot },
  }).accountsRoots;
  expect(() => assertRustParityAccountsRootsEqual(expected, reordered, 'PARITY')).not.toThrow();
  expect(() => assertRustParityAccountsRootsEqual(expected, { ...roots, [second]: firstRoot }, 'PARITY')).toThrow(
    `PARITY_VALUE:${second}`,
  );
});

test('terminal root comparison rejects missing, extra and changed signer ownership', () => {
  const anotherSigner = `0x${'11'.repeat(32)}:0x${'55'.repeat(20)}`;
  for (const changed of [
    { [first]: firstRoot },
    { ...roots, [anotherSigner]: secondRoot },
    { [first]: firstRoot, [anotherSigner]: secondRoot },
  ]) {
    expect(() => assertRustParityAccountsRootsEqual(roots, changed, 'PARITY')).toThrow('PARITY_KEYS');
  }
  const sameEntity = { [first]: firstRoot, [anotherSigner]: secondRoot };
  expect(() =>
    assertRustParityAccountsRootsEqual(sameEntity, { ...sameEntity, [anotherSigner]: firstRoot }, 'PARITY'),
  ).toThrow(`PARITY_VALUE:${anotherSigner}`);
});
