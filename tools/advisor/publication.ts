import { randomUUID } from 'node:crypto';
import { closeSync, fsyncSync, linkSync, mkdirSync, openSync, rmdirSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fail } from './values';

const syncDirectory = (directory: string): void => {
  const descriptor = openSync(directory, 'r');
  try {
    fsyncSync(descriptor);
  } finally {
    closeSync(descriptor);
  }
};

/** Readers may open a final filename immediately: publish only a complete, fsynced inode. */
export const publishJson = (path: string, content: string): void => {
  const directory = dirname(path);
  const pending = join(directory, `.${process.pid}-${randomUUID()}.pending`);
  const descriptor = openSync(pending, 'wx', 0o600);
  try {
    try {
      writeFileSync(descriptor, content);
      fsyncSync(descriptor);
    } finally {
      closeSync(descriptor);
    }
    // A hard link is atomic and rejects an existing destination, unlike overwrite-capable rename.
    linkSync(pending, path);
    syncDirectory(directory);
    syncDirectory(dirname(directory));
  } finally {
    unlinkSync(pending);
    syncDirectory(directory);
  }
};

const acquireLock = (lock: string): void => {
  const deadline = performance.now() + 2000;
  const sleeper = new Int32Array(new SharedArrayBuffer(4));
  while (true) {
    try {
      mkdirSync(lock);
      return;
    } catch (error) {
      if (!(error instanceof Error && 'code' in error && error.code === 'EEXIST')) throw error;
      if (performance.now() >= deadline) return fail(`EVALUATION_LOCK_BUSY:${lock}`);
      Atomics.wait(sleeper, 0, 0, 5);
    }
  }
};

/** Only local validation/publication holds this mutex; provider calls and artifact hashing never do. */
export const withEvaluationLock = <T>(directory: string, action: () => T): T => {
  mkdirSync(directory, { recursive: true });
  const lock = join(directory, '.evaluation-lock');
  const owner = join(lock, `${process.pid}-${randomUUID()}.owner`);
  acquireLock(lock);
  try {
    writeFileSync(owner, `pid=${process.pid}\n`, { flag: 'wx', mode: 0o600 });
    try {
      return action();
    } finally {
      unlinkSync(owner);
    }
  } finally {
    rmdirSync(lock);
  }
};
