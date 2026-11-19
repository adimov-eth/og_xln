/**
 * XLN Logging System
 *
 * Structured logging controlled by XLN_LOG_LEVEL, XLN_LOG_SCOPES, XLN_LOG_FORMAT.
 *
 * @license AGPL-3.0
 * Copyright (C) 2025 XLN Finance
 */

import { safeStringify } from '../protocol/serialization';
import { redactTelemetryValue } from './telemetry-redaction';

// Log levels for structured logging
type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error';

export type StructuredLogFields = Record<string, unknown>;

export type StructuredLogEvent = StructuredLogFields & {
  ts: string;
  level: LogLevel;
  scope: string;
  message: string;
};

type StructuredLogSink = (event: StructuredLogEvent) => void;
const structuredLogSinks = new Set<StructuredLogSink>();

export const registerStructuredLogSink = (sink: StructuredLogSink): (() => void) => {
  structuredLogSinks.add(sink);
  return () => structuredLogSinks.delete(sink);
};

const LOG_LEVEL_ORDER: Record<LogLevel, number> = {
  trace: 0,
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

type StructuredLogRuntime = {
  level: LogLevel;
  scopes: ReadonlySet<string> | null;
  json: boolean;
  warnStdout: boolean;
};

let structuredLogRuntimeKey = '';
let structuredLogRuntime: StructuredLogRuntime | null = null;

const parseLogLevel = (raw: string): LogLevel => {
  const normalized = raw.trim().toLowerCase();
  if (normalized === 'trace' || normalized === 'debug' || normalized === 'info' || normalized === 'warn' || normalized === 'error') {
    return normalized;
  }
  return 'info';
};

const parseLogScopes = (raw: string): ReadonlySet<string> | null => {
  const scopes = raw.trim().toLowerCase().split(',').map(scope => scope.trim()).filter(Boolean);
  return scopes.length > 0 ? new Set(scopes) : null;
};

const readStructuredLogRuntime = (): StructuredLogRuntime => {
  const key = `${process.env['XLN_LOG_LEVEL'] ?? ''}\n${process.env['XLN_LOG_SCOPES'] ?? ''}\n${process.env['XLN_LOG_FORMAT'] ?? ''}\n${process.env['XLN_LOG_WARN_STDOUT'] ?? ''}`;
  if (structuredLogRuntime && structuredLogRuntimeKey === key) return structuredLogRuntime;
  structuredLogRuntime = {
    level: parseLogLevel(process.env['XLN_LOG_LEVEL'] || 'info'),
    scopes: parseLogScopes(process.env['XLN_LOG_SCOPES'] || ''),
    json: process.env['XLN_LOG_FORMAT'] === 'json',
    warnStdout: process.env['XLN_LOG_WARN_STDOUT'] === '1',
  };
  structuredLogRuntimeKey = key;
  return structuredLogRuntime;
};

const scopeAllowed = (scope: string, scopes: ReadonlySet<string> | null): boolean => {
  if (!scopes) return true;
  const normalized = String(scope || '').trim().toLowerCase();
  if (scopes.has(normalized)) return true;
  const [root] = normalized.split(/[.:]/);
  return Boolean(root && scopes.has(root));
};

const canEmitStructuredLog = (level: LogLevel, scope: string): boolean => {
  const runtime = readStructuredLogRuntime();
  return LOG_LEVEL_ORDER[level] >= LOG_LEVEL_ORDER[runtime.level] && scopeAllowed(scope, runtime.scopes);
};

export const shortId = (value: unknown, chars = 4): string => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.startsWith('0x') && text.length > 2 + chars) return text.slice(-chars);
  return text.length > chars ? text.slice(-chars) : text;
};

export const shortHash = (value: unknown, head = 10): string => {
  const text = String(value || '').trim();
  if (!text) return '';
  if (text.length <= head + 2) return text;
  return `${text.slice(0, head)}..`;
};

export const shortOrder = (value: unknown, chars = 10): string => {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length > chars ? text.slice(-chars) : text;
};

export const formatAmount = (value: unknown): string => {
  if (typeof value === 'bigint') return value.toString();
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'NaN';
  return String(value ?? '');
};

const emitStructuredLog = (
  level: LogLevel,
  scope: string,
  message: string,
  fields: StructuredLogFields = {},
): void => {
  if (!canEmitStructuredLog(level, scope)) return;
  const runtime = readStructuredLogRuntime();
  const redactedFields = redactTelemetryValue(fields) as StructuredLogFields;
  const redactedMessage = redactTelemetryValue(message) as string;
  const payload: StructuredLogEvent = {
    ...redactedFields,
    ts: new Date().toISOString(),
    level,
    scope,
    message: redactedMessage,
  };
  for (const sink of structuredLogSinks) sink(payload);
  const line = runtime.json
    ? safeStringify(payload)
    : `[${level.toUpperCase()}][${scope}] ${redactedMessage}${Object.keys(redactedFields).length ? ` ${safeStringify(redactedFields)}` : ''}`;
  if (level === 'error') console.error(line);
  else if (level === 'warn') {
    const warnSink = runtime.warnStdout ? console.log : console.warn;
    warnSink(line);
  }
  else console.log(line);
};

export const createStructuredLogger = (scope: string, baseFields: StructuredLogFields = {}) => {
  const at = (level: LogLevel) => (message: string, fields: StructuredLogFields = {}): void => {
    if (!canEmitStructuredLog(level, scope)) return;
    emitStructuredLog(level, scope, message, { ...baseFields, ...fields });
  };
  return { trace: at('trace'), debug: at('debug'), info: at('info'), warn: at('warn'), error: at('error') };
};
