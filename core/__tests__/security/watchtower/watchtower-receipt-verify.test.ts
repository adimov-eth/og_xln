import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { keccak256, toUtf8Bytes, Wallet } from 'ethers';
import { buildTowerAppointmentOwnerMessage, verifyTowerReceipt } from '../../../storage/recovery/bundle/crypto';
import type { TowerAppointmentV1 } from '../../../storage/recovery/bundle/types';
import { createWatchtowerStore } from '../../../watchtower/store';

const owner = new Wallet(`0x${'11'.repeat(32)}`);
const lookupKey = keccak256(toUtf8Bytes('receipt-verify'));
const runtimeId = owner.address.toLowerCase();

const appointment = async (height: number): Promise<TowerAppointmentV1> => {
  const signedAt = Date.now();
  const bundle: TowerAppointmentV1['bundle'] = {
    version: 1, runtimeId, lookupKey, height, createdAt: signedAt,
    bundleHash: keccak256(toUtf8Bytes(`bundle:${height}`)), iv: '0x1234', ciphertext: '0xabcd',
  };
  const signature = await owner.signMessage(
    buildTowerAppointmentOwnerMessage(runtimeId, 'blind_backup', lookupKey, 0, bundle, signedAt, undefined),
  );
  return { type: 'tower_appointment', version: 1, towerMode: 'blind_backup', lookupKey, slot: 0, bundle, ownerProof: { runtimeId, signedAt, signature } };
};

test('a receipt counts only when the tower key signed it and it names what was uploaded', async () => {
  const root = mkdtempSync(join(tmpdir(), 'xln-tower-receipt-'));
  const store = createWatchtowerStore({ dbPath: join(root, 'db') });
  try {
    const sent = await appointment(42);
    const receipt = await store.upsertAppointment(sent);
    const uploaded = { lookupKey, runtimeId, height: 42, bundleHash: sent.bundle.bundleHash };

    expect(verifyTowerReceipt(receipt, store.signerAddress, uploaded)).toBe(receipt);

    // A different key, a receipt for another height or bundle, or a missing signature are not backups.
    const otherTower = new Wallet(`0x${'22'.repeat(32)}`).address;
    expect(() => verifyTowerReceipt(receipt, otherTower, uploaded)).toThrow('TOWER_RECEIPT_SIGNER_MISMATCH');
    expect(() => verifyTowerReceipt(receipt, store.signerAddress, { ...uploaded, height: 43 })).toThrow('TOWER_RECEIPT_HEIGHT_MISMATCH');
    expect(() => verifyTowerReceipt(receipt, store.signerAddress, { ...uploaded, bundleHash: keccak256(toUtf8Bytes('other')) })).toThrow('TOWER_RECEIPT_BUNDLE_MISMATCH');
    expect(() => verifyTowerReceipt({ ...receipt, height: 43 }, store.signerAddress, { ...uploaded, height: 43 })).toThrow('TOWER_RECEIPT_SIGNER_MISMATCH');
    expect(() => verifyTowerReceipt({ ...receipt, towerSignature: undefined }, store.signerAddress, uploaded)).toThrow('TOWER_RECEIPT_UNSIGNED');
    expect(() => verifyTowerReceipt(null, store.signerAddress, uploaded)).toThrow('TOWER_RECEIPT_MISSING');
    expect(() => verifyTowerReceipt(receipt, '', uploaded)).toThrow('TOWER_RECEIPT_SIGNER_UNKNOWN');
  } finally {
    await store.close();
    rmSync(root, { recursive: true, force: true });
  }
});
