import { expect, test } from 'bun:test';
import { createRequire } from 'node:module';
import { ethers } from 'ethers';
import { buildSingleSignerHanko } from '../../../hanko/batch';

const { buildFoundationTokenListing } = createRequire(import.meta.url)(
  '../../../../jurisdictions/scripts/foundation-hanko.cjs',
);

test('deployment Foundation token listing uses the canonical four-field Hanko envelope', () => {
  const privateKey = '11'.repeat(32);
  const listing = buildFoundationTokenListing(ethers, {
    chainId: 1_208_511_695,
    entityProviderAddress: '0xab6abc55418b5bcb067cf909725500fe08a125dc',
    foundationNonce: 0n,
    depository: '0x51c6eea257ec7ae26ef93db6d24bdf6dea642e16',
    tokenType: 0,
    contractAddress: '0x6c4e1ee99c5a44cb5dfa612bb807d5de3fa440cc',
    externalTokenId: 0,
    privateKey,
  });
  // Native TVM reverted before signer recovery because the retired three-field
  // deployment encoding omitted memberSignatures required by HankoVerifier.
  expect(listing.actionNonce).toBe(1n);
  expect(listing.hankoData).toBe(buildSingleSignerHanko(
    ethers.zeroPadValue('0x01', 32), listing.actionHash, `0x${privateKey}`,
  ));
});
