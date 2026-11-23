import { expect, test } from 'bun:test';
import { SPLIT_BOARD_REFUSAL, splitBoardRefusal } from '../../../frontend/src/lib/governance/formation-guard';

const mine = '0x' + 'aa'.repeat(20);
const alsoMine = '0x' + 'ab'.repeat(20);
const theirs = '0x' + 'bb'.repeat(20);
const local = (address: string) => address === mine || address === alsoMine;

test('a board mixing this wallet\'s seat with another wallet\'s is refused', () => {
  expect(splitBoardRefusal([{ name: mine }, { name: theirs.toUpperCase().replace('0X', '0x') }], local)).toBe(SPLIT_BOARD_REFUSAL);
});

test('two of this wallet\'s own signers are refused too: Formation imports only one seat', () => {
  expect(splitBoardRefusal([{ name: mine }, { name: alsoMine }], local)).toBe(SPLIT_BOARD_REFUSAL);
});

test('a one-signer board of this wallet, or a board it does not sit on, is allowed', () => {
  expect(splitBoardRefusal([{ name: mine }], local)).toBeNull();
  // A registered board this wallet does not sit on is never imported here, so nothing halts.
  expect(splitBoardRefusal([{ name: theirs }, { name: '0x' + 'cc'.repeat(20) }], local)).toBeNull();
});
