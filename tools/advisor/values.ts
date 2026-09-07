/** Exact, bounded decoding for human-authored jobs and immutable event files. */
import type { Evidence } from './types';

export class AdvisorError extends Error {}
export const fail = (reason: string): never => {
  throw new AdvisorError(`ADVISOR_${reason}`);
};
export const object = (value: unknown): Record<string, unknown> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('OBJECT_REQUIRED');
  return value as Record<string, unknown>;
};
export const exact = (value: unknown, keys: readonly string[]): Record<string, unknown> => {
  const row = object(value);
  if (Object.keys(row).length !== keys.length || keys.some(key => !Object.hasOwn(row, key))) {
    return fail('EXACT_KEYS_REQUIRED');
  }
  return row;
};
export const string = (value: unknown, maximum = 1000): string => {
  if (typeof value !== 'string' || !value.trim() || value.length > maximum || value.includes('\0')) {
    return fail('STRING_REQUIRED');
  }
  return value;
};
export const pattern = (value: unknown, expression: RegExp): string => {
  const text = string(value);
  return expression.test(text) ? text : fail('STRING_FORMAT_INVALID');
};
export const id = (value: unknown): string => pattern(value, /^[a-z0-9][a-z0-9.-]{0,119}$/);
export const hash = (value: unknown): string => pattern(value, /^sha256:[a-f0-9]{64}$/);
export const integer = (value: unknown, min = 0, max = Number.MAX_SAFE_INTEGER): number => {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= min && value <= max
    ? value
    : fail('INTEGER_RANGE_INVALID');
};
export const choice = <T extends string>(value: unknown, choices: readonly T[]): T => {
  if (typeof value !== 'string' || !choices.includes(value as T)) return fail('CHOICE_INVALID');
  return value as T;
};
export const timestamp = (value: unknown): string => {
  const text = string(value);
  if (!Number.isFinite(Date.parse(text)) || new Date(text).toISOString() !== text) return fail('TIMESTAMP_INVALID');
  return text;
};
export const nullable = <T>(value: unknown, decode: (value: unknown) => T): T | null => {
  return value === null ? null : decode(value);
};
const relativePath = (value: unknown): string => {
  const text = string(value, 500);
  if (
    text.startsWith('/') ||
    text.includes('\\') ||
    text.split('/').some(part => !part || part === '.' || part === '..')
  ) {
    return fail('RELATIVE_PATH_REQUIRED');
  }
  return text;
};
export const evidence = (value: unknown): readonly Evidence[] => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 32) return fail('EVIDENCE_REQUIRED');
  const rows = value.map(item => {
    const row = exact(item, ['path', 'sha256']);
    return { path: relativePath(row['path']), sha256: hash(row['sha256']) };
  });
  if (new Set(rows.map(row => row.path)).size !== rows.length) return fail('EVIDENCE_DUPLICATE');
  return rows;
};
