#!/usr/bin/env bun
/**
 * Re-sign the published release catalog after a Hanko wire-format change.
 *
 * The Foundation attests to an envelope — version, source commit, code snapshot
 * root, frozen-core root, generated-at — and the Hanko is only the proof that
 * carries it. When the Hanko claim encoding changes, every previously published
 * proof stops decoding and the whole catalog reads as unverified, even though
 * nothing about what was attested has changed. This re-issues the proof and
 * refuses to touch a snapshot whose envelope would move by a single field.
 *
 * Requires the Foundation private keys, which live outside the repository.
 *
 *   bun tools/release-resign.ts --keys=~/.config/xln/foundation-release-keys.json
 */
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';

import {
  computeReleaseEnvelopeHash,
  isCanonicalFoundationBoard,
  signReleaseEnvelope,
  verifyReleaseSnapshot,
  type FoundationReleaseBoard,
} from '../frontend/src/lib/releases/release-signature.ts';
import { writeManifest } from './release-snapshot/render.ts';
import type { FoundationReleaseKeys } from './release-snapshot/sign.ts';
import type { ReleaseSnapshot } from './release-snapshot/types.ts';

const flag = (name: string, fallback: string): string =>
  process.argv.find(arg => arg.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
const dryRun = process.argv.includes('--dry-run');
const boardPath = resolve(flag('board', 'foundation-release-board.json'));
const keysPath = resolve(flag('keys', `${homedir()}/.config/xln/foundation-release-keys.json`));
const releasesDir = resolve(flag('releases-dir', 'docs/releases'));
const dataDir = join(releasesDir, 'data');

const board = JSON.parse(readFileSync(boardPath, 'utf8')) as FoundationReleaseBoard;
// --board picks which copy of the trusted board to read, never a replacement
// trust root; a supplied board would restore the self-signed-board attack.
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
    console.log(`ok        ${snapshot.release.version}`);
    continue;
  }
  const envelope = previous.envelope;
  // The envelope is the attested claim. Re-signing may only re-encode the
  // proof: if the hash moves, something other than the wire format changed and
  // this tool must not paper over it.
  if (computeReleaseEnvelopeHash(envelope) !== previous.envelopeHash.toLowerCase()) {
    throw new Error(`RELEASE_ENVELOPE_HASH_MOVED:${path}`);
  }
  const attestation = signReleaseEnvelope(envelope, board, keys.privateKeys);
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
