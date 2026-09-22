import { describe, expect, test } from 'bun:test';
import { requireBackupCapacity } from './backup-size';

describe('encrypted recovery capacity admission', () => {
  test('rejects the observed oversized snapshot with both byte counts', () => {
    expect(() => requireBackupCapacity(26_205_317, 4_194_304))
      .toThrow('RECOVERY_BACKUP_TOO_LARGE:bytes=26205317:max=4194304');
  });
  test('leaves exact-capacity admission to the tower envelope quota', () => {
    expect(() => requireBackupCapacity(4_194_304, 4_194_304)).not.toThrow();
    expect(() => requireBackupCapacity(4_194_305, 4_194_304)).toThrow('RECOVERY_BACKUP_TOO_LARGE');
  });
  test('missing or invalid service limits are not unlimited storage', () => {
    for (const maximum of [0, -1, NaN, Infinity, 1.5])
      expect(() => requireBackupCapacity(100, maximum)).toThrow('valid storage limit');
  });
});
