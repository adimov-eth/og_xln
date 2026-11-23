import { expect, test } from 'bun:test';
import { acceptedInvoiceJurisdictions, classifyExternalRequest, resolveHubTarget } from '../../../frontend/src/lib/everyday/external-request';

const DEPOSITORY = `0x${'cd'.repeat(20)}`;

test('an invoice may name the wallet jurisdiction, its stack id, or a catalog alias of the same stack', () => {
  const catalog = {
    jurisdictions: {
      arrakis: { chainId: 31337, contracts: { depository: DEPOSITORY.toUpperCase().replace('0X', '0x') } },
      wakanda: { chainId: 31337, contracts: { depository: `0x${'ef'.repeat(20)}` } },
      other: { chainId: 1, contracts: { depository: DEPOSITORY } },
    },
  };
  const local = { name: 'Local', chainId: 31337, depositoryAddress: DEPOSITORY };
  expect(acceptedInvoiceJurisdictions(local, catalog).sort()).toEqual(['Local', 'arrakis', `stack:31337:${DEPOSITORY}`].sort());
  expect(acceptedInvoiceJurisdictions(local, null).sort()).toEqual(['Local', `stack:31337:${DEPOSITORY}`].sort());
  expect(acceptedInvoiceJurisdictions(null, catalog)).toEqual([]);
});

const invoice = { targetEntityId: `0x${'ab'.repeat(32)}`, amount: '10', description: '' };

test('an entity the wallet does not know is not treated as a friend', () => {
  expect(resolveHubTarget(false, undefined)).toBeUndefined();
  expect(resolveHubTarget(false, { isHub: undefined })).toBeUndefined();
  expect(resolveHubTarget(false, { isHub: false })).toBe(false);
  expect(resolveHubTarget(true, undefined)).toBe(true);
  expect(resolveHubTarget(false, { isHub: true })).toBe(true);
});

test('a credit request from an unknown entity goes to Pro, not to "Open tab"', () => {
  const unknown = classifyExternalRequest({ invoice, txType: 'extendCredit', isHubTarget: resolveHubTarget(false, undefined) });
  expect(unknown.kind).toBe('escalate-pro');
  const friend = classifyExternalRequest({ invoice, txType: 'extendCredit', isHubTarget: resolveHubTarget(false, { isHub: false }) });
  expect(friend.kind).toBe('open-friend-tab');
});
