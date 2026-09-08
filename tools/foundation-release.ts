#!/usr/bin/env bun

import { randomBytes } from 'node:crypto';
import { chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { ethers } from 'ethers';

import {
  computeReleaseEnvelopeHash,
  createFoundationReleaseBoard,
  isCanonicalFoundationBoard,
  signReleaseEnvelope,
  verifyReleaseSnapshot,
  type FoundationReleaseBoard,
} from '../frontend/src/lib/releases/release-signature.ts';
import { writeManifest } from './release-snapshot/render.ts';
import type { FoundationReleaseKeys } from './release-snapshot/sign.ts';
import type { ReleaseSnapshot } from './release-snapshot/types.ts';
import {
  assertReleaseSourceContainedInPublishedRef,
  assertReleaseTagBindsSource,
} from './release-snapshot/source-policy.ts';

const command = process.argv[2];
const value = (name: string, defaultValue: string): string =>
  resolve(process.argv.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3) || defaultValue);
const boardPath = value('board', 'foundation-release-board.json');
const keysPath = value('keys', `${homedir()}/.config/xln/foundation-release-keys.json`);

if (command === 'init') {
  if (existsSync(boardPath) || existsSync(keysPath)) throw new Error('FOUNDATION_RELEASE_KEYS_ALREADY_EXIST');
  const privateKeys = Array.from({ length: 3 }, () => ethers.hexlify(randomBytes(32)));
  const addresses = privateKeys.map((privateKey) => ethers.computeAddress(new ethers.SigningKey(privateKey).publicKey));
  const board = createFoundationReleaseBoard(addresses, 2);
  const keys: FoundationReleaseKeys = { schemaVersion: 1, boardHash: board.boardHash, privateKeys };
  mkdirSync(dirname(keysPath), { recursive: true, mode: 0o700 });
  writeFileSync(keysPath, `${JSON.stringify(keys, null, 2)}\n`, { mode: 0o600 });
  chmodSync(keysPath, 0o600);
  writeFileSync(boardPath, `${JSON.stringify(board, null, 2)}\n`);
  console.log(`Foundation release board initialized: ${board.entityId}`);
  console.log(`Private keys stored outside repository: ${keysPath}`);
  process.exit(0);
}

if (command === 'resign') {
  // The Foundation attests to an envelope; the Hanko only carries it. When the
  // Hanko claim encoding changes, every published proof stops decoding and the
  // whole catalog reads as unverified even though nothing attested has moved.
  // This re-issues the proof and refuses any snapshot whose envelope hash shifts.
  const releasesDir = value('releases-dir', 'docs/releases');
  const dataDir = join(releasesDir, 'data');
  const dryRun = process.argv.includes('--dry-run');
  const board = JSON.parse(readFileSync(boardPath, 'utf8')) as FoundationReleaseBoard;
  // --board picks which copy of the trusted board to read, never a replacement
  // trust root; accepting a supplied board restores the self-signed-board attack.
  if (!isCanonicalFoundationBoard(board)) throw new Error(`FOUNDATION_RELEASE_BOARD_NOT_TRUSTED:${boardPath}`);
  const keys = JSON.parse(readFileSync(keysPath, 'utf8')) as FoundationReleaseKeys;
  if (keys.schemaVersion !== 1 || keys.boardHash.toLowerCase() !== board.boardHash.toLowerCase()) {
    throw new Error('RELEASE_SIGNING_KEY_BOARD_MISMATCH');
  }
  const names = readdirSync(dataDir).filter(name => /^\d+\.\d+\.\d+\.json$/.test(name)).sort();
  if (!names.length) throw new Error(`RELEASE_CATALOG_EMPTY:${dataDir}`);
  let resigned = 0;
  let alreadyValid = 0;
  for (const name of names) {
    const path = join(dataDir, name);
    const snapshot = JSON.parse(readFileSync(path, 'utf8')) as ReleaseSnapshot;
    const previous = snapshot.attestation;
    if (!previous) throw new Error(`RELEASE_ATTESTATION_MISSING:${path}`);
    if (verifyReleaseSnapshot(snapshot, board)) {
      alreadyValid += 1;
      continue;
    }
    if (computeReleaseEnvelopeHash(previous.envelope) !== previous.envelopeHash.toLowerCase()) {
      throw new Error(`RELEASE_ENVELOPE_HASH_MOVED:${path}`);
    }
    const attestation = signReleaseEnvelope(previous.envelope, board, keys.privateKeys);
    if (attestation.envelopeHash.toLowerCase() !== previous.envelopeHash.toLowerCase()) {
      throw new Error(`RELEASE_ENVELOPE_HASH_MOVED:${path}`);
    }
    snapshot.attestation = attestation;
    if (!verifyReleaseSnapshot(snapshot, board)) throw new Error(`RELEASE_ATTESTATION_STILL_INVALID:${path}`);
    if (!dryRun) writeFileSync(path, `${JSON.stringify(snapshot, null, 2)}\n`);
    resigned += 1;
    console.log(`re-signed ${snapshot.release.version} ${attestation.envelopeHash}`);
  }
  if (!dryRun && resigned > 0) writeManifest(releasesDir);
  console.log(`${resigned} re-signed, ${alreadyValid} already valid${dryRun ? ' (dry run, nothing written)' : ''}`);
  process.exit(0);
}

if (command === 'verify' || command === 'publish-check') {
  const snapshotPath = value('snapshot', `docs/releases/data/${readFileSync('VERSION', 'utf8').trim()}.json`);
  const board = JSON.parse(readFileSync(boardPath, 'utf8')) as FoundationReleaseBoard;
  // --board selects the expected copy, not a replacement trust root. Accepting any supplied
  // board would restore the self-signed-board attack this verifier exists to prevent.
  if (!isCanonicalFoundationBoard(board)) throw new Error(`FOUNDATION_RELEASE_BOARD_NOT_TRUSTED:${boardPath}`);
  const snapshot = JSON.parse(readFileSync(snapshotPath, 'utf8')) as ReleaseSnapshot;
  const valid = verifyReleaseSnapshot(snapshot, board);
  if (!snapshot.attestation) {
    throw new Error(`RELEASE_ATTESTATION_MISSING:${snapshotPath}`);
  }
  if (!valid) throw new Error(`RELEASE_ATTESTATION_INVALID:${snapshotPath}`);
  if (command === 'publish-check') {
    assertReleaseSourceContainedInPublishedRef(process.cwd(), snapshot.release.sourceCommit);
    assertReleaseTagBindsSource(process.cwd(), snapshot.release.version, snapshot.release.sourceCommit);
    console.log(`Release tag binds source: v${snapshot.release.version} ${snapshot.release.sourceCommit}`);
  }
  console.log(`Foundation Hanko verified: ${snapshot.release.version} ${snapshot.attestation.envelopeHash}`);
  process.exit(0);
}

throw new Error('Usage: bun tools/foundation-release.ts <init|verify|publish-check|resign> [--board=path] [--keys=path] [--snapshot=path] [--releases-dir=path] [--dry-run]');
