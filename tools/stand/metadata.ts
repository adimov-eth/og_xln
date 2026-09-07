import { dlopen, FFIType } from 'bun:ffi';
import { closeSync, mkdirSync, openSync } from 'node:fs';
import { join } from 'node:path';

const library = process.platform === 'darwin' ? '/usr/lib/libSystem.B.dylib'
  : process.platform === 'linux' ? 'libc.so.6' : null;
if (!library) throw new Error('STAND_LOCK_UNSUPPORTED_PLATFORM');
const native = dlopen(library, {
  flock: { args: [FFIType.i32, FFIType.i32], returns: FFIType.i32 },
});

/** Serialize metadata changes, including reaping and publication. Never unlink
 * this inode: replacing it would let two callers lock different files. The OS
 * drops the advisory lock when a crashed process closes its descriptors. */
export const withStandMetadata = <T>(root: string, operation: () => T): T => {
  mkdirSync(root, { recursive: true, mode: 0o700 });
  const fd = openSync(join(root, 'metadata.lock'), 'a', 0o600);
  try {
    const deadline = performance.now() + 2_000;
    while (native.symbols.flock(fd, 2 | 4) !== 0) {
      if (performance.now() >= deadline) throw new Error('STAND_LOCK_METADATA_UNAVAILABLE');
      Bun.sleepSync(5);
    }
    return operation();
  } finally {
    closeSync(fd);
  }
};
