import { expect, test } from 'bun:test';
import { Wallet } from 'ethers';
import {
  buildStewardTxs,
  readStewardAnswer,
  readStewardPin,
  recordStewardAnswer,
  signStewardRequest,
  verifyStewardLink,
  writeStewardPin,
  type StewardPin,
  type StewardRequestBody,
} from '../../../frontend/src/lib/governance/steward-request';
import { stewardSheet } from '../../../frontend/src/lib/governance/steward-sheet';
import type { SignSheetSource } from '../../../frontend/src/lib/components/Entity/core/sign-sheet';

const steward = new Wallet('0x' + '11'.repeat(32));
const intruder = new Wallet('0x' + '22'.repeat(32));
const person = '0x' + 'aa'.repeat(32);
const stewardEntity = '0x' + 'bb'.repeat(32);
const bob = '0x' + '0b'.repeat(32);
const now = 1_800_000_000_000;

const pin: StewardPin = { stewardEntityId: stewardEntity, stewardSigner: steward.address.toLowerCase(), label: 'Ledger', pinnedAt: now - 1 };
const body = (overrides: Partial<StewardRequestBody> = {}): StewardRequestBody => ({
  domain: 'xln-steward-request',
  v: 1,
  entityId: person,
  stewardEntityId: stewardEntity,
  stewardSigner: steward.address.toLowerCase(),
  nonce: 'a1b2c3d4e5f60718',
  createdAt: now - 1_000,
  expiresAt: now + 2 * 60 * 60 * 1000,
  facts: [{ kind: 'credit-limit', counterparty: bob, tokenId: 1, amount: '500000000' }],
  note: 'Bob is covering the chalet deposits this week.',
  ...overrides,
});
const context = { entityId: person, pin, now };
const source: SignSheetSource = {
  token: () => ({ symbol: 'USDC', decimals: 6 }),
  hasAccount: entityId => entityId === bob,
  extendedCreditLimit: () => 100_000_000n,
  sendCapacity: () => 50_000_000n,
  offdelta: () => 0n,
};

test('a request signed by the pinned steward verifies, and the sheet shows the batch Sign sends', async () => {
  const link = await signStewardRequest(body(), steward);
  const verified = verifyStewardLink(`#${link}`, context);
  if (!verified.ok) throw new Error(verified.reason);
  const { sheet, txs } = stewardSheet(verified.request, pin, source, now);
  expect(txs).toEqual(buildStewardTxs(verified.request.body));
  expect(txs).toEqual([{ type: 'extendCredit', data: { counterpartyEntityId: bob, tokenId: 1, amount: 500_000_000n } }]);
  expect(sheet.requester).toBe('Ledger');
  expect(sheet.origin).toBe('Signed by your pinned steward · Expires in 2 h');
  expect(sheet.facts[0]?.verb).toBe('Let 0x0b0b…0b0b owe you up to');
  expect(sheet.primaryLabel).toBe('Hold to raise to 500.00 USDC');
  expect(sheet.note).toBe('Bob is covering the chalet deposits this week.');
  expect(sheet.terms.find(([key]) => key === 'tx 1')?.[1]).toContain('extendCredit');
});

test('a payment fact becomes a direct payment through the Account with its recipient', async () => {
  const verified = verifyStewardLink(await signStewardRequest(body({ facts: [{ kind: 'pay', to: bob, tokenId: 1, amount: '42500000' }] }), steward), context);
  if (!verified.ok) throw new Error(verified.reason);
  expect(buildStewardTxs(verified.request.body)).toEqual([{
    type: 'directPayment',
    data: { targetEntityId: bob, tokenId: 1, amount: 42_500_000n, route: [person, bob], deliveryMode: 'direct' },
  }]);
});

test('nothing is read until the signature over the exact text matches the pinned steward', async () => {
  expect(verifyStewardLink(await signStewardRequest(body(), steward), { ...context, pin: null })).toEqual({ ok: false, reason: 'no-pin' });
  expect(verifyStewardLink(await signStewardRequest(body({ stewardSigner: intruder.address.toLowerCase() }), intruder), context)).toEqual({ ok: false, reason: 'wrong-signer' });
  // One changed digit in the signed text breaks the signature.
  const link = await signStewardRequest(body(), steward);
  const [prefixed, signature] = link.split('.');
  const text = Buffer.from(prefixed!.slice('steward/'.length).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
  const forged = Buffer.from(text.replace('500000000', '900000000')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  expect(verifyStewardLink(`steward/${forged}.${signature}`, context)).toEqual({ ok: false, reason: 'wrong-signer' });
});

test('the signed fields bound where and when a request applies', async () => {
  expect(verifyStewardLink(await signStewardRequest(body({ entityId: bob }), steward), context)).toEqual({ ok: false, reason: 'wrong-entity' });
  expect(verifyStewardLink(await signStewardRequest(body({ createdAt: now - 3_000, expiresAt: now - 1 }), steward), context)).toEqual({ ok: false, reason: 'expired' });
  expect(verifyStewardLink(await signStewardRequest(body({ stewardEntityId: bob }), steward), context)).toEqual({ ok: false, reason: 'wrong-signer' });
});

test('only the closed set of facts is accepted; anything else is refused whole', async () => {
  const unknown = { ...body(), facts: [{ kind: 'board-handover', to: bob, tokenId: 1, amount: '1' }] } as unknown as StewardRequestBody;
  expect(verifyStewardLink(await signStewardRequest(unknown, steward), context)).toEqual({ ok: false, reason: 'unsupported-fact' });
  const extraKey = { ...body(), facts: [{ kind: 'pay', to: bob, tokenId: 1, amount: '1', route: [] }] } as unknown as StewardRequestBody;
  expect(verifyStewardLink(await signStewardRequest(extraKey, steward), context)).toEqual({ ok: false, reason: 'unsupported-fact' });
  const extraField = { ...body(), runtimeTxs: [] } as unknown as StewardRequestBody;
  expect(verifyStewardLink(await signStewardRequest(extraField, steward), context)).toEqual({ ok: false, reason: 'malformed' });
  const huge = body({ note: 'x'.repeat(600) });
  expect(verifyStewardLink(await signStewardRequest(huge, steward), context)).toEqual({ ok: false, reason: 'malformed' });
  expect(verifyStewardLink('steward/not-a-request', context)).toEqual({ ok: false, reason: 'malformed' });
});

test('the pin and the answer record are wallet-local, and a broken store refuses instead of admitting', () => {
  const memory = new Map<string, string>();
  const store = { getItem: (key: string) => memory.get(key) ?? null, setItem: (key: string, value: string) => void memory.set(key, value), removeItem: (key: string) => void memory.delete(key) };
  expect(readStewardPin(store, person)).toBeNull();
  writeStewardPin(store, person, pin);
  expect(readStewardPin(store, person)).toEqual(pin);
  expect(() => writeStewardPin(store, person, { ...pin, stewardSigner: 'nope' })).toThrow('STEWARD_PIN_SIGNER_INVALID');
  const broken = { getItem: () => { throw new Error('denied'); }, setItem: () => {}, removeItem: () => {} };
  expect(readStewardPin(broken, person)).toBeNull();
  recordStewardAnswer(store, person, { nonce: 'a1b2c3d4e5f60718', choice: 'declined', at: now });
  expect(readStewardAnswer(store, person, 'a1b2c3d4e5f60718')?.choice).toBe('declined');
  writeStewardPin(store, person, null);
  expect(readStewardPin(store, person)).toBeNull();
});
