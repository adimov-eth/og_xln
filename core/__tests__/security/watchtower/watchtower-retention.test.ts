import { buildTowerAppointmentOwnerMessage } from '../../../storage/recovery/bundle/crypto';
import { serializeTaggedJson, safeStringify } from '../../../protocol/serialization';
import { handleTowerAppointment, handleTowerRestore } from '../../../watchtower/http';
import { extractEncryptedRecoveryBundles } from '../../../storage/recovery/discovery/candidates';
import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { keccak256, toUtf8Bytes, Wallet } from 'ethers';
import type { TowerAppointmentV1 } from '../../../storage/recovery/bundle/types';
import { createWatchtowerStore } from '../../../watchtower/store';
import {
  createWatchtowerStoreContext, closeWatchtowerStore, readLookup, lookupKeyFor, deleteExpiredLookups,
} from '../../../watchtower/store/db';
import { upsertAppointment, WatchtowerAppointmentNotRetainedError } from '../../../watchtower/store/appointments';

const owner = new Wallet(`0x${'11'.repeat(32)}`);
const lookupKey = keccak256(toUtf8Bytes('retention-regression'));
const appointment = async (height: number, slot: number, signedAt: number): Promise<TowerAppointmentV1> => {
  const runtimeId = owner.address.toLowerCase();
  const bundle: TowerAppointmentV1['bundle'] = {
    version: 1,
    runtimeId,
    lookupKey,
    height,
    createdAt: signedAt,
    bundleHash: keccak256(toUtf8Bytes(`bundle:${height}`)),
    iv: '0x1234',
    ciphertext: '0xabcd',
  };
  const signature = await owner.signMessage(
    buildTowerAppointmentOwnerMessage(runtimeId, 'blind_backup', lookupKey, slot, bundle, signedAt, undefined),
  );
  return {
    type: 'tower_appointment',
    version: 1,
    towerMode: 'blind_backup',
    lookupKey,
    slot,
    bundle,
    ownerProof: { runtimeId, signedAt, signature },
  };
};

test('tower refuses an excluded low-height appointment without replacing the signed receipt', async () => {
  const root = mkdtempSync(join(tmpdir(), 'xln-tower-retention-'));
  const store = createWatchtowerStore({ dbPath: join(root, 'db'), maxBundlesPerLookupKey: 2 });
  try {
    await store.upsertAppointment(await appointment(20, 0, 100));
    const latest = await store.upsertAppointment(await appointment(30, 1, 101));
    await expect(store.upsertAppointment(await appointment(10, 2, 102))).rejects.toBeInstanceOf(
      WatchtowerAppointmentNotRetainedError,
    );
    expect(await store.getLatestReceipt(lookupKey)).toEqual(latest);
    expect((await store.getLatest(lookupKey))!.bundles.map(bundle => bundle.height)).toEqual([30]);
    await expect(store.upsertAppointment(await appointment(40, 2, 103))).resolves.toMatchObject({
      height: 40,
      sequence: 3,
    });
  } finally {
    await store.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('a later-signed lower height cannot replace an acknowledged same-slot appointment', async () => {
  const root = mkdtempSync(join(tmpdir(), 'xln-tower-regression-'));
  const store = createWatchtowerStore({ dbPath: join(root, 'db') });
  try {
    const acked = await store.upsertAppointment(await appointment(30, 0, 100));
    // A second tab or device on the same seed, with an older tip, signs later.
    await expect(store.upsertAppointment(await appointment(20, 0, 101))).rejects.toThrow(
      'TOWER_APPOINTMENT_HEIGHT_REGRESSION:30:20',
    );
    expect(await store.getLatestReceipt(lookupKey)).toEqual(acked);
    expect((await store.getLatest(lookupKey))!.bundles.map(bundle => bundle.height)).toEqual([30]);
    // The same height re-uploaded later, and a higher height, still replace it.
    await expect(store.upsertAppointment(await appointment(30, 0, 102))).resolves.toMatchObject({ height: 30 });
    await expect(store.upsertAppointment(await appointment(31, 0, 103))).resolves.toMatchObject({ height: 31 });
  } finally {
    await store.close();
    rmSync(root, { recursive: true, force: true });
  }
});

test('an owner-signed replaceSlot lets a rebuild replace the slot at a lower height; an unsigned flag is refused', async () => {
  const root = mkdtempSync(join(tmpdir(), 'xln-tower-replace-'));
  const store = createWatchtowerStore({ dbPath: join(root, 'db') });
  const put = async (body: unknown) => (await handleTowerAppointment(
    new Request('http://tower/api/tower/appointment', { method: 'PUT', body: serializeTaggedJson(body), headers: { 'content-type': 'application/json' } }),
    store,
  )).json() as Promise<{ ok: boolean; error?: string; receipt?: { height: number } }>;
  const signedReplace = async (height: number, signedAt: number, signFlag: boolean): Promise<TowerAppointmentV1> => {
    const base = await appointment(height, 0, signedAt);
    const signature = await owner.signMessage(buildTowerAppointmentOwnerMessage(
      base.ownerProof.runtimeId, 'blind_backup', lookupKey, 0, base.bundle, signedAt, undefined, signFlag,
    ));
    return { ...base, replaceSlot: true, ownerProof: { ...base.ownerProof, signature } };
  };
  try {
    const now = Date.now();
    expect((await put(await appointment(30, 0, now))).receipt?.height).toBe(30);
    // The flag in the body without the owner's signature over it fails verification.
    const forged = await put(await signedReplace(5, now + 1, false));
    expect(forged.ok).toBe(false);
    expect(forged.error).toContain('TOWER_APPOINTMENT_SIGNATURE_INVALID');
    // Signed consent replaces the slot; restore then serves the rebuilt height.
    expect((await put(await signedReplace(5, now + 2, true))).receipt?.height).toBe(5);
    expect((await store.getLatest(lookupKey))!.bundles.map(bundle => bundle.height)).toEqual([5]);
  } finally {
    await store.close();
    rmSync(root, { recursive: true, force: true });
  }
});

for (const [oldTtl, newTtl] of [
  [120_000, 60_000],
  [60_000, 120_000],
] as const) {
  test(`pruning honors signed expiry after TTL changes from ${oldTtl} to ${newTtl}`, async () => {
    const root = mkdtempSync(join(tmpdir(), 'xln-tower-expiry-'));
    const dbPath = join(root, 'db');
    let now = 1_000_000;
    let store = createWatchtowerStore({ dbPath, receiptTtlMs: oldTtl, now: () => now });
    try {
      const receipt = await store.upsertAppointment(await appointment(1, 0, now));
      await store.close();
      store = createWatchtowerStore({ dbPath, receiptTtlMs: newTtl, now: () => now });
      if (oldTtl > newTtl) {
        now += 1_000;
        const shorter = await store.upsertAppointment(await appointment(2, 1, now));
        now = shorter.expiresAt + 1;
        expect(await store.pruneExpired()).toEqual({ deleted: 0 });
      }
      now = receipt.expiresAt;
      expect(await store.pruneExpired()).toEqual({ deleted: 0 });
      expect(await store.getLatest(lookupKey)).not.toBeNull();
      now += 1;
      expect(await store.pruneExpired()).toEqual({ deleted: 1 });
      expect(await store.getLatest(lookupKey)).toBeNull();
    } finally {
      await store.close();
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test('restore HTTP handler returns only the canonical bundles array', async () => {
  const root = mkdtempSync(join(tmpdir(), 'xln-tower-response-'));
  const store = createWatchtowerStore({ dbPath: join(root, 'db') });
  try {
    const uploaded = await appointment(10, 0, 100);
    await store.upsertAppointment(uploaded);
    const response = await handleTowerRestore(
      new Request('https://tower.example/api/tower/restore', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: safeStringify({ lookupKey }),
      }),
      store,
    );
    expect(response.status).toBe(200);
    const payload = await response.json();
    expect(payload).not.toHaveProperty('bundle');
    expect(extractEncryptedRecoveryBundles(payload)).toEqual([uploaded.bundle]);
    expect(() => extractEncryptedRecoveryBundles({ bundle: uploaded.bundle }))
      .toThrow('RECOVERY_BACKUP_BUNDLES_INVALID');
  } finally {
    await store.close();
    rmSync(root, { recursive: true, force: true });
  }
});

for (const expiresAt of [undefined, null]) {
  test(`omitted/null receipt expiry promises zero lifetime: ${expiresAt}`, async () => {
    const root = mkdtempSync(join(tmpdir(), 'xln-tower-no-expiry-'));
    const context = createWatchtowerStoreContext({ dbPath: join(root, 'db'), maxLookupKeys: 1 });
    try {
      await upsertAppointment(context, await appointment(1, 0, 100));
      const doc = (await readLookup(context, lookupKey))!;
      const receipts = doc.receipts.map(({ expiresAt: _expiry, ...receipt }) =>
        expiresAt === undefined ? receipt : { ...receipt, expiresAt });
      await context.db.put(lookupKeyFor(lookupKey), serializeTaggedJson({ ...doc, receipts }));
      expect((await readLookup(context, lookupKey))!.receipts[0]!.expiresAt).toBe(0);
      expect(await deleteExpiredLookups(context, 1)).toBe(1);
      expect(await readLookup(context, lookupKey)).toBeNull();
      await expect(upsertAppointment(context, await appointment(2, 0, 101))).resolves.toMatchObject({ height: 2 });
    } finally {
      await closeWatchtowerStore(context);
      rmSync(root, { recursive: true, force: true });
    }
  });
}

test('short-TTL tail rollover pins the snapshot receipt beyond the newest-N limit', async () => {
  const root = mkdtempSync(join(tmpdir(), 'xln-tower-rollover-'));
  const dbPath = join(root, 'db');
  let now = 1_000_000;
  let context = createWatchtowerStoreContext({ dbPath, maxBundlesPerLookupKey: 3, receiptTtlMs: 300_000, now: () => now });
  try {
    const snapshot = await upsertAppointment(context, await appointment(1, 0, now));
    await closeWatchtowerStore(context);
    context = createWatchtowerStoreContext({ dbPath, maxBundlesPerLookupKey: 3, receiptTtlMs: 60_000, now: () => now });
    for (let height = 2; height <= 8; height++) {
      now += 1_000;
      const tail = await appointment(height, 0, now);
      tail.bundle.kind = 'journal_tail';
      tail.bundle.baseRuntimeHeight = 1;
      tail.ownerProof.signature = await owner.signMessage(buildTowerAppointmentOwnerMessage(
        owner.address.toLowerCase(), 'blind_backup', lookupKey, 0, tail.bundle, now, undefined));
      await upsertAppointment(context, tail);
    }
    const doc = (await readLookup(context, lookupKey))!;
    expect(doc.receipts).toHaveLength(3);
    expect(doc.receipts[0]!.height).toBe(8);
    expect(doc.receipts).toContainEqual(snapshot);
    expect(doc.bundles.some(entry => entry.bundle.height === 1)).toBe(true);
    now += 60_001;
    expect(await deleteExpiredLookups(context, now)).toBe(0);
    await closeWatchtowerStore(context);
    context = createWatchtowerStoreContext({ dbPath, now: () => now });
    expect(await deleteExpiredLookups(context, snapshot.expiresAt!)).toBe(0);
    expect(await deleteExpiredLookups(context, snapshot.expiresAt! + 1)).toBe(1);
  } finally {
    await closeWatchtowerStore(context);
    rmSync(root, { recursive: true, force: true });
  }
});
