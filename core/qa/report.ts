import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { basename, join, resolve } from 'node:path';
import { Database } from 'bun:sqlite';
import { compareStableText, safeStringify } from '../protocol/serialization';
import { DISPLAY } from '../config/constants';
import {
  assertQaSeveritySignal,
  makeQaSeveritySignal,
  normalizeQaSeveritySignal,
  type QaSeveritySignal,
} from './severity';
import {
  qaRunTestCategory,
  qaTestCategoryFromTags,
} from './test-categories';
import type { QaCandidateIdentity } from './candidate';
import { assertQaCandidateIdentity } from './candidate';
import {
  QA_HISTORY_DB_PATH,
  QA_PHASE_WATERFALL_ORDER,
  type QaArtifactKind,
  type QaArtifactSensitivity,
  type QaBenchmarkComparison,
  type QaBenchmarkMetricDelta,
  type QaBenchmarkStatus,
  type QaBrowserHealthSummary,
  type QaBrowserIssue,
  type QaBrowserIssueSeverity,
  type QaBrowserIssueType,
  type QaFailureClass,
  type QaPhaseKey,
  type QaPhaseTimings,
  type QaRunManifest,
  type QaRunManifestDraft,
  type QaRunTestCategory,
  type QaRunTimingSummary,
  type QaShardFailureInput,
  type QaShardManifest,
  type QaShardManifestDraft,
  type QaSlowStep,
  type QaTestCategory,
} from './report-types';

export * from './report-types';

const QA_BROWSER_ISSUE_TYPES = new Set<QaBrowserIssueType>(['console', 'pageerror', 'requestfailed', 'http']);
const QA_BROWSER_ISSUE_SEVERITIES = new Set<QaBrowserIssueSeverity>(['error', 'warning']);

const asNullableString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

const QA_SECRET_LABEL_PATTERN = String.raw`(?:authorization|x-xln-qa-token|xln_qa_read_token|xln_qa_admin_token|adminToken|readToken|accessToken|refreshToken|privateKey|private_key|mnemonic|authSeed|auth_seed|seed|apiKey|api_key|secret|token)`;
const QA_SECRET_QUOTED_FIELD_PATTERN = new RegExp(
  String.raw`(["']${QA_SECRET_LABEL_PATTERN}["']\s*:\s*)(["'])(.*?)\2`,
  'gi',
);
const QA_SECRET_QUOTED_VALUE_PATTERN = new RegExp(
  String.raw`\b(${QA_SECRET_LABEL_PATTERN}\s*[:=]\s*)(["'])(.*?)\2`,
  'gi',
);
const QA_SECRET_BARE_VALUE_PATTERN = new RegExp(
  String.raw`\b(${QA_SECRET_LABEL_PATTERN}\s*[:=]\s*)[^"'\s,;)}\]]+`,
  'gi',
);

export const redactQaSecretText = (value: string): string => {
  const secret = '[REDACTED]';
  return value
    .replace(/\b((?:https?|wss?):\/\/)[^\s/@:]+:[^\s/@]+@/gi, `$1${secret}@`)
    .replace(/\b(Bearer\s+)[A-Za-z0-9._~+/=-]{8,}/gi, `$1${secret}`)
    .replace(/\bxlnra1\.[A-Za-z0-9._~+/=-]+/g, `xlnra1.${secret}`)
    .replace(
      /([?&#](?:runtime-import|remote-runtimes|xlnRemoteRuntimes|token|adminToken|readToken|access_token|refresh_token|privateKey|mnemonic|seed|secret)=)[^&#\s"')]+/gi,
      `$1${secret}`,
    )
    .replace(QA_SECRET_QUOTED_FIELD_PATTERN, (_match, prefix: string, quote: string) => `${prefix}${quote}${secret}${quote}`)
    .replace(QA_SECRET_QUOTED_VALUE_PATTERN, (_match, prefix: string, quote: string) => `${prefix}${quote}${secret}${quote}`)
    .replace(QA_SECRET_BARE_VALUE_PATTERN, `$1${secret}`);
};

export const classifyQaArtifactSensitivity = (artifact: {
  name?: string | null;
  relativePath?: string | null;
  kind?: QaArtifactKind | null;
  contentType?: string | null;
}): QaArtifactSensitivity => {
  const name = String(artifact.name || '').toLowerCase();
  const relativePath = String(artifact.relativePath || '').replace(/\\/g, '/').toLowerCase();
  const kind = artifact.kind ?? detectArtifactKind(name || basename(relativePath));
  const contentType = String(artifact.contentType || '').toLowerCase();
  if (
    relativePath.endsWith('/qa-cues/cues.vtt') ||
    relativePath.endsWith('/qa-cues/cues.json') ||
    name === 'cues.vtt' ||
    name === 'cues.json'
  ) {
    return 'public';
  }
  if (kind === 'trace' || kind === 'archive') return 'secret-bearing';
  if (kind === 'text' || kind === 'json') return 'secret-bearing';
  if (contentType.startsWith('text/') || contentType.startsWith('application/json')) return 'secret-bearing';
  if (kind === 'video' || kind === 'image') return 'internal';
  return 'internal';
};

const asFiniteNumber = (value: unknown): number | null => {
  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(numeric) ? numeric : null;
};

const trimIssueMessage = (value: unknown): string => {
  const message = typeof value === 'string' ? value.trim() : String(value ?? '').trim();
  return message.slice(0, 2_000);
};

const normalizeQaBrowserIssue = (value: unknown): QaBrowserIssue | null => {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const rawType = record['type'];
  const rawSeverity = record['severity'];
  const message = trimIssueMessage(record['message']);
  const timestamp = asFiniteNumber(record['timestamp']) ?? Date.now();
  if (!QA_BROWSER_ISSUE_TYPES.has(rawType as QaBrowserIssueType) || !message) return null;
  return {
    type: rawType as QaBrowserIssueType,
    severity: QA_BROWSER_ISSUE_SEVERITIES.has(rawSeverity as QaBrowserIssueSeverity)
      ? rawSeverity as QaBrowserIssueSeverity
      : 'error',
    message,
    url: asNullableString(record['url']),
    method: asNullableString(record['method']),
    status: asFiniteNumber(record['status']),
    testId: asNullableString(record['testId']),
    timestamp,
  };
};

export const normalizeQaBrowserIssues = (value: unknown): QaBrowserIssue[] => {
  if (!Array.isArray(value)) return [];
  return value.map(normalizeQaBrowserIssue).filter((item): item is QaBrowserIssue => Boolean(item));
};

const qaSeveritySince = (defaultValue: number, values: readonly unknown[]): number => {
  const timestamps = values
    .map(asFiniteNumber)
    .filter((value): value is number => value !== null && value >= 0);
  return timestamps.length > 0 ? Math.min(...timestamps) : Math.max(0, defaultValue);
};

const qaBrowserHealthSeverity = (
  summary: Omit<QaBrowserHealthSummary, keyof QaSeveritySignal>,
  since: number,
): QaSeveritySignal => {
  if (summary.errorCount > 0) {
    return makeQaSeveritySignal({
      severity: 'FAIL',
      reason: `${summary.errorCount} browser error(s) captured`,
      since,
      owner: 'browser',
      evidence: [
        { label: 'errors', value: summary.errorCount },
        { label: 'warnings', value: summary.warningCount },
        { label: 'network failures', value: summary.networkFailureCount },
        { label: 'http errors', value: summary.httpErrorCount },
      ],
    });
  }
  if (summary.warningCount > 0) {
    return makeQaSeveritySignal({
      severity: 'WARN',
      reason: `${summary.warningCount} browser warning(s) captured`,
      since,
      owner: 'browser',
      evidence: [
        { label: 'warnings', value: summary.warningCount },
        { label: 'http warnings', value: summary.httpErrorCount },
      ],
    });
  }
  return makeQaSeveritySignal({
    severity: 'OK',
    reason: 'Browser event stream is clean',
    since,
    owner: 'browser',
    evidence: [{ label: 'issues', value: 0 }],
  });
};

const normalizeQaBrowserHealthSummary = (
  value: QaBrowserHealthSummary,
  since: number,
): QaBrowserHealthSummary => {
  const summary = {
    issueCount: Number(value.issueCount || 0),
    errorCount: Number(value.errorCount || 0),
    warningCount: Number(value.warningCount || 0),
    networkFailureCount: Number(value.networkFailureCount || 0),
    httpErrorCount: Number(value.httpErrorCount || 0),
  };
  return {
    ...summary,
    ...normalizeQaSeveritySignal(value, qaBrowserHealthSeverity(summary, since)),
  };
};

export const summarizeQaBrowserIssues = (issues: readonly QaBrowserIssue[], since = 0): QaBrowserHealthSummary => {
  // Expected negative-path evidence stays in the run manifest for audit/debug,
  // but a test-scoped allowBrowserIssue rule must not poison the strict release
  // gate. The global Playwright fixture adds this tag only after matching the
  // issue type, severity, message, and current test id.
  const unexpectedIssues = issues.filter(issue => !issue.message.startsWith('[expected] '));
  const summary = {
    issueCount: unexpectedIssues.length,
    errorCount: unexpectedIssues.filter(issue => issue.severity === 'error').length,
    warningCount: unexpectedIssues.filter(issue => issue.severity === 'warning').length,
    networkFailureCount: unexpectedIssues.filter(issue => issue.type === 'requestfailed').length,
    httpErrorCount: unexpectedIssues.filter(issue => issue.type === 'http').length,
  };
  return {
    ...summary,
    ...qaBrowserHealthSeverity(summary, qaSeveritySince(since, issues.map(issue => issue.timestamp))),
  };
};

export const summarizeQaRunBrowserHealth = (
  run: { shards: readonly Pick<QaShardManifest, 'browserIssues'>[] },
): QaBrowserHealthSummary =>
  summarizeQaBrowserIssues(run.shards.flatMap(shard => normalizeQaBrowserIssues(shard.browserIssues)));

const classifyQaFailureText = (value: string): QaFailureClass | null => {
  const lower = value.toLowerCase();
  if (!lower.trim()) return null;
  if (lower.includes('timeout') || lower.includes('timed out') || lower.includes('timeoutexceeded')) return 'timeout';
  if (
    lower.includes('e2e_fatal_runtime_log') ||
    lower.includes('fatal runtime') ||
    lower.includes('segmentation fault') ||
    lower.includes('page crashed') ||
    lower.includes('sigsegv')
  ) return 'crash';
  if (lower.includes('unauthorized') || lower.includes('forbidden') || lower.includes('token') || lower.includes('secret') || lower.includes('cors')) return 'security';
  if (lower.includes('flake') || lower.includes('retry')) return 'flake';
  if (
    lower.includes('health') ||
    lower.includes('anvil') ||
    lower.includes('vite') ||
    lower.includes('boot') ||
    lower.includes('spawn') ||
    lower.includes('econnrefused') ||
    lower.includes('net::') ||
    lower.includes('request failed') ||
    lower.includes('http 5')
  ) return 'infra';
  if (lower.includes('expect(') || lower.includes('expected:') || lower.includes('assert') || lower.includes('matcherresult')) return 'assertion';
  return null;
};

export const classifyQaShardFailure = (options: {
  status: QaShardManifest['status'];
  error?: string | null;
  logTail?: string | null;
  browserIssues?: QaBrowserIssue[];
}): QaFailureClass | null => {
  if (options.status !== 'failed') return null;
  const browserIssues = normalizeQaBrowserIssues(options.browserIssues);
  const textClass = classifyQaFailureText([
    options.error ?? '',
    options.logTail ?? '',
    ...browserIssues.map(issue => `${issue.type} ${issue.status ?? ''} ${issue.message} ${issue.url ?? ''}`),
  ].join('\n'));
  if (textClass) return textClass;
  if (browserIssues.some(issue => issue.type === 'requestfailed' || issue.type === 'http')) return 'infra';
  if (browserIssues.some(issue => issue.type === 'pageerror')) return 'crash';
  return 'unknown';
};

export const summarizeQaFailureClasses = (shards: readonly QaShardFailureInput[]): QaFailureClass[] =>
  Array.from(new Set(shards.flatMap(shard => classifyQaShardFailure(shard) ?? []))).sort(compareStableText);

const buildQaShardSeveritySignal = (shard: {
  status: QaShardManifest['status'];
  shard: number;
  handle?: string | null;
  title?: string | null;
  target?: string | null;
  error?: string | null;
  failureClass?: QaFailureClass | null;
  browserHealth?: QaBrowserHealthSummary | null;
  durationMs?: number | null;
}, since: number): QaSeveritySignal => {
  const label = shard.handle || shard.title || shard.target || `shard-${shard.shard}`;
  const evidence = [
    { label: 'shard', value: shard.shard },
    ...(shard.durationMs !== null && shard.durationMs !== undefined ? [{ label: 'duration', value: shard.durationMs, unit: 'ms' }] : []),
    ...(shard.failureClass ? [{ label: 'failure class', value: shard.failureClass }] : []),
    ...(shard.browserHealth?.issueCount ? [{ label: 'browser issues', value: shard.browserHealth.issueCount }] : []),
  ];
  if (shard.status === 'failed') {
    return makeQaSeveritySignal({
      severity: 'FAIL',
      reason: `${label} failed${shard.failureClass ? ` (${shard.failureClass})` : ''}`,
      since,
      owner: 'qa-shard',
      evidence,
    });
  }
  if (shard.status === 'cancelled') {
    return makeQaSeveritySignal({
      severity: 'UNKNOWN',
      reason: `${label} was cancelled after another shard failed`,
      since,
      owner: 'qa-shard',
      evidence,
    });
  }
  if (shard.status === 'unknown') {
    return makeQaSeveritySignal({
      severity: 'UNKNOWN',
      reason: `${label} did not report a final status`,
      since,
      owner: 'qa-shard',
      evidence,
    });
  }
  if (shard.browserHealth?.severity === 'FAIL') {
    return makeQaSeveritySignal({
      severity: 'FAIL',
      reason: `${label} has blocking browser errors`,
      since: shard.browserHealth.since,
      owner: 'qa-shard',
      evidence,
    });
  }
  if (shard.browserHealth?.severity === 'WARN') {
    return makeQaSeveritySignal({
      severity: 'WARN',
      reason: `${label} has browser warnings`,
      since: shard.browserHealth.since,
      owner: 'qa-shard',
      evidence,
    });
  }
  return makeQaSeveritySignal({
    severity: 'OK',
    reason: `${label} passed`,
    since,
    owner: 'qa-shard',
    evidence,
  });
};

const buildQaBenchmarkSeveritySignal = (
  benchmark: Pick<QaBenchmarkComparison, 'status' | 'reason' | 'metrics' | 'suiteLabel'>,
  since: number,
): QaSeveritySignal => {
  const evidence = [
    { label: 'suite', value: benchmark.suiteLabel },
    ...benchmark.metrics
      .filter(metric => metric.verdict !== 'ok')
      .slice(0, 6)
      .map(metric => ({ label: metric.label, value: metric.deltaPct, unit: 'percent' })),
  ];
  if (benchmark.status === 'slower' || benchmark.status === 'mixed') {
    return makeQaSeveritySignal({
      severity: 'DEGRADED',
      reason: benchmark.reason || 'Benchmark regression detected',
      since,
      owner: 'benchmark',
      evidence,
    });
  }
  if (benchmark.status === 'insufficient') {
    return makeQaSeveritySignal({
      severity: 'UNKNOWN',
      reason: benchmark.reason || 'Benchmark has no comparable baseline',
      since,
      owner: 'benchmark',
      evidence,
    });
  }
  return makeQaSeveritySignal({
    severity: 'OK',
    reason: benchmark.reason || 'Benchmark is within thresholds',
    since,
    owner: 'benchmark',
    evidence,
  });
};

const buildQaRunSeveritySignal = (run: Pick<QaRunManifest,
  'runId' | 'createdAt' | 'status' | 'failedShards' | 'totalShards' | 'browserHealth' | 'benchmark' | 'code' | 'failureClasses'
>): QaSeveritySignal => {
  const evidence = [
    { label: 'run', value: run.runId },
    { label: 'failed shards', value: run.failedShards },
    { label: 'total shards', value: run.totalShards },
    ...(run.failureClasses?.length ? [{ label: 'failure classes', value: run.failureClasses.join(',') }] : []),
    ...(run.browserHealth?.issueCount ? [{ label: 'browser issues', value: run.browserHealth.issueCount }] : []),
    ...(run.benchmark ? [{ label: 'benchmark', value: run.benchmark.status }] : []),
    ...(run.code?.gitHead ? [{ label: 'git head', value: run.code.gitHead.slice(0, DISPLAY.SHORT_HASH_HEX_CHARS) }] : []),
    ...(run.code?.codeHash ? [{ label: 'code hash', value: run.code.codeHash.slice(0, DISPLAY.SHORT_HASH_HEX_CHARS) }] : []),
  ];
  if (run.status === 'failed' || run.failedShards > 0 || run.browserHealth?.severity === 'FAIL') {
    return makeQaSeveritySignal({
      severity: 'FAIL',
      reason: run.failedShards > 0
        ? `${run.failedShards}/${run.totalShards} shard(s) failed`
        : run.browserHealth?.reason || 'QA run failed',
      since: run.createdAt,
      owner: 'qa',
      evidence,
    });
  }
  if (run.status === 'unknown') {
    return makeQaSeveritySignal({
      severity: 'UNKNOWN',
      reason: 'QA run status is unknown',
      since: run.createdAt,
      owner: 'qa',
      evidence,
    });
  }
  if (run.benchmark?.severity === 'DEGRADED' || run.code?.dirty) {
    return makeQaSeveritySignal({
      severity: 'DEGRADED',
      reason: run.code?.dirty ? 'Worktree was dirty during QA run' : run.benchmark?.reason || 'QA benchmark degraded',
      since: run.createdAt,
      owner: 'qa',
      evidence,
    });
  }
  if (run.browserHealth?.severity === 'WARN') {
    return makeQaSeveritySignal({
      severity: 'WARN',
      reason: run.browserHealth.reason,
      since: run.browserHealth.since,
      owner: 'qa',
      evidence,
    });
  }
  return makeQaSeveritySignal({
    severity: 'OK',
    reason: 'QA run is green',
    since: run.createdAt,
    owner: 'qa',
    evidence,
  });
};

export const formatQaRunIdUtc = (timestamp: number): string => {
  const d = new Date(timestamp);
  const p2 = (n: number): string => String(n).padStart(2, '0');
  const p3 = (n: number): string => String(n).padStart(3, '0');
  return [
    `${d.getUTCFullYear()}${p2(d.getUTCMonth() + 1)}${p2(d.getUTCDate())}`,
    `${p2(d.getUTCHours())}${p2(d.getUTCMinutes())}${p2(d.getUTCSeconds())}`,
    p3(d.getUTCMilliseconds()),
  ].join('-');
};

const normalizeSuiteText = (value: unknown): string =>
  String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim();

const runShardIdentity = (shard: QaShardManifest): string =>
  [
    normalizeSuiteText(shard.target),
    normalizeSuiteText(shard.title),
    normalizeSuiteText(shard.handle),
  ].filter(Boolean).join('::') || `shard-${shard.shard}`;

const explicitRunTestCategory = (value: unknown): QaRunTestCategory | null =>
  value === 'functional' || value === 'resilience' || value === 'mixed' || value === 'unknown'
    ? value
    : null;

const deriveQaRunTestCategory = (
  run: Pick<QaRunManifest, 'testCategory' | 'args' | 'shards'>,
): QaRunTestCategory => {
  const explicit = explicitRunTestCategory(run.testCategory);
  if (explicit) return explicit;
  const shardCategories = run.shards.map((shard) =>
    shard.testCategory ?? qaTestCategoryFromTags(shard.tags ?? []));
  if (shardCategories.length > 0 && shardCategories.every(Boolean)) {
    return qaRunTestCategory(shardCategories as QaTestCategory[]);
  }
  const args = run.args ?? {};
  const argCategory = explicitRunTestCategory(args['qaCategory'] ?? args['testCategory']);
  if (argCategory === 'functional' || argCategory === 'resilience') return argCategory;
  const grep = normalizeSuiteText(args['pwGrep']);
  if (grep === '@functional') return 'functional';
  if (grep === '@resilience') return 'resilience';
  return 'unknown';
};

const qaRunSuiteKey = (run: Pick<QaRunManifest, 'testCategory' | 'args' | 'shards'>): string => {
  const args = run.args ?? {};
  const source = {
    pwProject: normalizeSuiteText(args['pwProject']),
    pwGrep: normalizeSuiteText(args['pwGrep']),
    pwFiles: Array.isArray(args['pwFiles'])
      ? args['pwFiles'].map(normalizeSuiteText).sort(compareStableText)
      : normalizeSuiteText(args['pwFiles']),
    testCategory: deriveQaRunTestCategory(run),
    shards: run.shards.map(runShardIdentity).sort(compareStableText),
  };
  return createHash('sha256').update(JSON.stringify(source)).digest('hex').slice(0, 24);
};

const qaRunSuiteLabel = (run: Pick<QaRunManifest, 'testCategory' | 'args' | 'shards'>): string => {
  const testCategory = deriveQaRunTestCategory(run);
  const prefix = testCategory === 'unknown' ? '' : `${testCategory} · `;
  if (run.shards.length === 1) {
    const shard = run.shards[0]!;
    const label = normalizeSuiteText(shard.handle) || normalizeSuiteText(shard.title) || normalizeSuiteText(shard.target) || 'single shard';
    return `${prefix}${label}`;
  }
  const args = run.args ?? {};
  const pwGrep = normalizeSuiteText(args['pwGrep']);
  if (pwGrep) return `${prefix}grep:${pwGrep}`;
  const pwFiles = Array.isArray(args['pwFiles']) ? args['pwFiles'].map(normalizeSuiteText).filter(Boolean) : [];
  if (pwFiles.length > 0) return `${prefix}${pwFiles.length === 1 ? pwFiles[0]! : `${pwFiles.length} files`}`;
  return `${prefix}${run.shards.length} shards`;
};

const percentile95 = (values: number[]): number | null => {
  const sorted = values.filter(value => Number.isFinite(value)).sort((a, b) => a - b);
  if (sorted.length === 0) return null;
  const index = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * 0.95) - 1));
  return Math.round(sorted[index]! * 100) / 100;
};

const qaRunChildCpuP95 = (run: Pick<QaRunManifest, 'perf'>): number | null =>
  percentile95((run.perf?.samples ?? []).flatMap(sample => sample.children.map(child => child.cpuPct)));

type BenchmarkMetricSnapshot = {
  metric: string;
  label: string;
  unit: QaBenchmarkMetricDelta['unit'];
  value: number | null;
  thresholdPct: number;
};

const finiteMetric = (
  metric: string,
  label: string,
  unit: QaBenchmarkMetricDelta['unit'],
  value: unknown,
  thresholdPct: number,
): BenchmarkMetricSnapshot => ({
  metric,
  label,
  unit,
  value: typeof value === 'number' && Number.isFinite(value) ? value : null,
  thresholdPct,
});

const averagePhaseMs = (run: QaRunManifest, key: keyof QaPhaseTimings): number | null => {
  const values = run.shards
    .map(shard => shard.phaseMs?.[key])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const p95PhaseMs = (run: QaRunManifest, key: QaPhaseKey): number | null =>
  percentile95(run.shards
    .map(shard => shard.phaseMs?.[key])
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value)));

const summarizeQaRunPhaseP95 = (run: QaRunManifest): QaPhaseTimings | null => {
  const entries = QA_PHASE_WATERFALL_ORDER.map((key): [QaPhaseKey, number | null] => [key, p95PhaseMs(run, key)]);
  if (entries.some(([, value]) => value === null)) return null;
  return Object.fromEntries(entries) as QaPhaseTimings;
};

const averageShardMs = (run: QaRunManifest): number | null => {
  const values = run.shards
    .map(shard => shard.durationMs)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const maxShardMs = (run: QaRunManifest): number | null => {
  const values = run.shards
    .map(shard => shard.durationMs)
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  return values.length > 0 ? Math.max(...values) : null;
};

const averageBootstrapMs = (run: QaRunManifest): number | null => {
  const values = run.shards
    .map((shard): number | null => {
      const phase = shard.phaseMs;
      if (!phase) return null;
      return phase.preflight + phase.anvilBoot + phase.apiBoot + phase.apiHealthy + phase.viteBoot;
    })
    .filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

const summarizeQaRunTiming = (run: QaRunManifest): QaRunTimingSummary => ({
  avgShardMs: averageShardMs(run),
  maxShardMs: maxShardMs(run),
  bootstrapMs: averageBootstrapMs(run),
  apiHealthyMs: averagePhaseMs(run, 'apiHealthy'),
  playwrightMs: averagePhaseMs(run, 'playwright'),
  phaseP95: summarizeQaRunPhaseP95(run),
});

const benchmarkSnapshot = (run: QaRunManifest): BenchmarkMetricSnapshot[] => [
  finiteMetric('totalMs', 'wall time', 'ms', run.totalMs, 20),
  finiteMetric('avgShardMs', 'avg shard', 'ms', averageShardMs(run), 20),
  finiteMetric('phase.apiHealthy', 'health wait', 'ms', averagePhaseMs(run, 'apiHealthy'), 25),
  finiteMetric('phase.playwright', 'browser test', 'ms', averagePhaseMs(run, 'playwright'), 25),
  finiteMetric('phase.viteBoot', 'vite boot', 'ms', averagePhaseMs(run, 'viteBoot'), 30),
  finiteMetric('phase.apiBoot', 'api boot', 'ms', averagePhaseMs(run, 'apiBoot'), 30),
  finiteMetric('peakLoad1', 'peak load1', 'load', run.perf?.peakLoad1, 50),
  finiteMetric('maxChildCpuPct', 'max child CPU', 'percent', run.perf?.maxChildCpuPct, 40),
  finiteMetric('maxChildRssKb', 'max child RSS', 'kb', run.perf?.maxChildRssKb, 30),
];

export const compareQaBenchmarkRuns = (
  current: QaRunManifest,
  baseline: QaRunManifest | null,
): QaBenchmarkComparison => {
  const suiteKey = qaRunSuiteKey(current);
  const suiteLabel = qaRunSuiteLabel(current);
  if (!baseline) {
    const status = 'insufficient' as const;
    const reason = 'No previous comparable E2E run found.';
    return {
      ...buildQaBenchmarkSeveritySignal({ status, reason, metrics: [], suiteLabel }, current.createdAt),
      status: 'insufficient',
      suiteKey,
      suiteLabel,
      comparedRunId: null,
      comparedGitHead: null,
      comparedCodeHash: null,
      sameGitHead: null,
      sameCodeHash: null,
      reason,
      metrics: [],
      likelyCauses: [],
    };
  }

  const baselineByMetric = new Map(benchmarkSnapshot(baseline).map(item => [item.metric, item]));
  const metrics = benchmarkSnapshot(current).flatMap((item): QaBenchmarkMetricDelta[] => {
    const base = baselineByMetric.get(item.metric);
    if (item.value === null || !base || base.value === null || base.value <= 0) return [];
    const delta = item.value - base.value;
    const deltaPct = (delta / base.value) * 100;
    const verdict: QaBenchmarkMetricDelta['verdict'] =
      deltaPct >= item.thresholdPct ? 'slower' : deltaPct <= -item.thresholdPct ? 'faster' : 'ok';
    return [{
      metric: item.metric,
      label: item.label,
      unit: item.unit,
      current: Math.round(item.value * 100) / 100,
      baseline: Math.round(base.value * 100) / 100,
      delta: Math.round(delta * 100) / 100,
      deltaPct: Math.round(deltaPct * 100) / 100,
      thresholdPct: item.thresholdPct,
      verdict,
    }];
  });

  const slower = metrics.filter(metric => metric.verdict === 'slower').sort((a, b) => b.deltaPct - a.deltaPct);
  const blockingSlower = slower.filter(metric => metric.metric !== 'peakLoad1');
  const faster = metrics.filter(metric => metric.verdict === 'faster').sort((a, b) => a.deltaPct - b.deltaPct);
  const fasterTiming = faster.filter(metric => metric.unit === 'ms');
  const status: QaBenchmarkStatus =
    blockingSlower.length > 0 && fasterTiming.length > 0 ? 'mixed'
      : blockingSlower.length > 0 ? 'slower'
        : fasterTiming.length > 0 ? 'faster'
          : 'ok';
  const top = blockingSlower[0] ?? fasterTiming[0] ?? null;
  const hostLoadOnly = slower.length > 0 && blockingSlower.length === 0;
  const hostLoadDelta = slower.find(metric => metric.metric === 'peakLoad1') ?? null;
  const sameGitHead = current.code?.gitHead !== undefined && baseline.code?.gitHead !== undefined
    ? current.code.gitHead === baseline.code.gitHead
    : null;
  const sameCodeHash = current.code?.codeHash !== undefined && baseline.code?.codeHash !== undefined
    ? current.code.codeHash === baseline.code.codeHash
    : null;
  const likelyCauses = [
    ...(sameCodeHash === false ? ['code hash changed'] : []),
    ...(sameGitHead === false ? ['git HEAD changed'] : []),
    ...(current.code?.dirty ? ['current worktree is dirty'] : []),
    ...(hostLoadOnly ? ['host load increased without app timing regression'] : []),
    ...(top ? [`largest delta: ${top.label} ${top.deltaPct > 0 ? '+' : ''}${top.deltaPct}%`] : []),
  ];
  const reason = top
    ? `${top.label} ${top.deltaPct > 0 ? '+' : ''}${top.deltaPct}% vs ${baseline.runId}`
    : hostLoadOnly && hostLoadDelta
      ? `Timing within thresholds; host load ${hostLoadDelta.deltaPct > 0 ? '+' : ''}${hostLoadDelta.deltaPct}% vs ${baseline.runId}`
    : faster.length > 0
      ? `Timing within thresholds; resource usage improved vs ${baseline.runId}`
      : `Within thresholds vs ${baseline.runId}`;

  return {
    ...buildQaBenchmarkSeveritySignal({ status, reason, metrics, suiteLabel }, current.createdAt),
    status,
    suiteKey,
    suiteLabel,
    comparedRunId: baseline.runId,
    comparedGitHead: baseline.code?.gitHead ?? null,
    comparedCodeHash: baseline.code?.codeHash ?? null,
    sameGitHead,
    sameCodeHash,
    reason,
    metrics,
    likelyCauses,
  };
};

const normalizeQaShardSeverity = (shard: QaShardManifestDraft, since: number): QaShardManifest => {
  const defaultSignal = buildQaShardSeveritySignal(shard, since);
  return {
    ...shard,
    ...normalizeQaSeveritySignal(shard, defaultSignal),
  };
};

const normalizeQaBenchmarkSeverity = (
  benchmark: QaBenchmarkComparison | undefined,
  since: number,
): QaBenchmarkComparison | undefined => {
  if (!benchmark) return undefined;
  const defaultSignal = buildQaBenchmarkSeveritySignal(benchmark, since);
  return {
    ...benchmark,
    ...normalizeQaSeveritySignal(benchmark, defaultSignal),
  };
};

export const applyQaRunSeverity = (run: QaRunManifestDraft): QaRunManifest => {
  const since = run.createdAt;
  const shards = run.shards.map(shard => normalizeQaShardSeverity(shard, since));
  const browserHealth = normalizeQaBrowserHealthSummary(
    run.browserHealth ?? summarizeQaRunBrowserHealth({ shards }),
    since,
  );
  const benchmark = normalizeQaBenchmarkSeverity(run.benchmark, since);
  const failureClasses = run.failureClasses ?? summarizeQaFailureClasses(shards);
  const normalizedRun = {
    ...run,
    shards,
    browserHealth,
    ...(benchmark ? { benchmark } : {}),
    failureClasses,
  };
  return {
    ...normalizedRun,
    ...normalizeQaSeveritySignal(normalizedRun, buildQaRunSeveritySignal(normalizedRun)),
  };
};

export const assertQaReleaseRunSeverity = (run: QaRunManifest): void => {
  if (run.manifestVersion < 3) return;
  assertQaSeveritySignal(run, 'QA_RUN');
  for (const shard of run.shards) {
    assertQaSeveritySignal(shard, `QA_SHARD_${shard.shard}`);
  }
  if (run.benchmark) assertQaSeveritySignal(run.benchmark, 'QA_BENCHMARK');
  if (run.browserHealth) assertQaSeveritySignal(run.browserHealth, 'QA_BROWSER_HEALTH');
  if (run.manifestVersion < 4) return;
  const shardCategories = run.shards.map((shard) =>
    shard.testCategory ?? qaTestCategoryFromTags(shard.tags ?? []));
  if (shardCategories.some((category) => category === null)) {
    throw new Error('QA_RUN_TEST_CATEGORY_REQUIRED');
  }
  const derived = qaRunTestCategory(shardCategories as QaTestCategory[]);
  if (run.testCategory !== derived) throw new Error('QA_RUN_TEST_CATEGORY_MISMATCH');
  if (run.manifestVersion < 5) return;
  assertQaRunCandidateBinding(run);
};

export const assertQaRunCandidateBinding = (run: QaRunManifest): void => {
  if (run.manifestVersion < 5) return;
  const identity = assertQaCandidateHeaderBinding(run);
  for (const shard of run.shards) {
    if (
      shard.candidateId !== identity.candidateId ||
      shard.gateConfigHash !== identity.gateConfigHash
    ) {
      throw new Error(`QA_SHARD_CANDIDATE_MISMATCH:${shard.shard}`);
    }
  }
};

const assertQaCandidateHeaderBinding = (
  run: Pick<QaRunManifest, 'manifestVersion' | 'candidate' | 'gateConfig' | 'code'>,
): QaCandidateIdentity => {
  if (run.manifestVersion < 5) {
    throw new Error('QA_CANDIDATE_SCHEMA_UNSUPPORTED');
  }
  const identity = assertQaCandidateIdentity(run.candidate, run.gateConfig);
  if (
    run.code?.gitHead !== identity.gitHead ||
    run.code?.codeHash !== identity.codeHash
  ) {
    throw new Error('QA_CANDIDATE_CODE_FINGERPRINT_MISMATCH');
  }
  return identity;
};

const parseManifestJson = (value: unknown): QaRunManifest | null => {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const run = applyQaRunSeverity(JSON.parse(value) as QaRunManifest);
    assertQaRunCandidateBinding(run);
    return run;
  } catch {
    return null;
  }
};

const openQaHistoryDb = (): Database => {
  mkdirSync(resolve(process.cwd(), '.logs'), { recursive: true });
  const db = new Database(QA_HISTORY_DB_PATH);
  db.exec(`
    CREATE TABLE IF NOT EXISTS qa_runs (
      run_id TEXT PRIMARY KEY,
      created_at INTEGER NOT NULL,
      completed_at INTEGER,
      status TEXT NOT NULL,
      total_ms INTEGER,
      total_shards INTEGER NOT NULL,
      passed_shards INTEGER NOT NULL,
      failed_shards INTEGER NOT NULL,
      git_head TEXT,
      git_branch TEXT,
      dirty INTEGER NOT NULL DEFAULT 0,
      code_hash TEXT,
      avg_load1 REAL,
      peak_load1 REAL,
      max_child_cpu_pct REAL,
      max_child_rss_kb INTEGER,
      suite_key TEXT,
      benchmark_status TEXT,
      benchmark_delta_pct REAL,
      benchmark_compared_run_id TEXT,
      browser_issue_count INTEGER NOT NULL DEFAULT 0,
      browser_error_count INTEGER NOT NULL DEFAULT 0,
      browser_warning_count INTEGER NOT NULL DEFAULT 0,
      network_failure_count INTEGER NOT NULL DEFAULT 0,
      http_error_count INTEGER NOT NULL DEFAULT 0,
      child_cpu_p95_pct REAL,
      avg_shard_ms REAL,
      max_shard_ms REAL,
      bootstrap_ms REAL,
      api_healthy_ms REAL,
      playwright_ms REAL,
      phase_p95_preflight_ms REAL,
      phase_p95_anvil_boot_ms REAL,
      phase_p95_api_boot_ms REAL,
      phase_p95_api_healthy_ms REAL,
      phase_p95_vite_boot_ms REAL,
      phase_p95_playwright_ms REAL,
      logs_dir TEXT NOT NULL,
      manifest_json TEXT NOT NULL,
      forensic_json TEXT NOT NULL DEFAULT '{}'
    );
    CREATE INDEX IF NOT EXISTS qa_runs_created_at_idx ON qa_runs(created_at DESC);
    CREATE INDEX IF NOT EXISTS qa_runs_code_hash_idx ON qa_runs(code_hash);
    CREATE INDEX IF NOT EXISTS qa_runs_git_head_idx ON qa_runs(git_head);
  `);
  const columns = new Set((db.query(`PRAGMA table_info(qa_runs)`).all() as Array<Record<string, unknown>>).map(row => String(row['name'])));
  const addColumn = (name: string, ddl: string): void => {
    if (columns.has(name)) return;
    db.exec(`ALTER TABLE qa_runs ADD COLUMN ${name} ${ddl}`);
  };
  addColumn('suite_key', 'TEXT');
  addColumn('benchmark_status', 'TEXT');
  addColumn('benchmark_delta_pct', 'REAL');
  addColumn('benchmark_compared_run_id', 'TEXT');
  addColumn('browser_issue_count', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('browser_error_count', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('browser_warning_count', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('network_failure_count', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('http_error_count', 'INTEGER NOT NULL DEFAULT 0');
  addColumn('child_cpu_p95_pct', 'REAL');
  addColumn('avg_shard_ms', 'REAL');
  addColumn('max_shard_ms', 'REAL');
  addColumn('bootstrap_ms', 'REAL');
  addColumn('api_healthy_ms', 'REAL');
  addColumn('playwright_ms', 'REAL');
  addColumn('phase_p95_preflight_ms', 'REAL');
  addColumn('phase_p95_anvil_boot_ms', 'REAL');
  addColumn('phase_p95_api_boot_ms', 'REAL');
  addColumn('phase_p95_api_healthy_ms', 'REAL');
  addColumn('phase_p95_vite_boot_ms', 'REAL');
  addColumn('phase_p95_playwright_ms', 'REAL');
  addColumn('forensic_json', "TEXT NOT NULL DEFAULT '{}'");
  db.exec(`CREATE INDEX IF NOT EXISTS qa_runs_suite_key_idx ON qa_runs(suite_key, created_at DESC);`);
  return db;
};

const toNullableNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null;

const stripQaHistoryPerfSamples = (run: QaRunManifest): QaRunManifest => ({
  ...run,
  ...(run.perf ? { perf: { ...run.perf, samples: [] } } : {}),
  shards: run.shards.map(shard => ({
    ...shard,
    ...(shard.perf ? { perf: { ...shard.perf, samples: [] } } : {}),
  })),
});

const isQaRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const readQaForensicCommitment = (logsDir: string | undefined, shard: number): Record<string, unknown> | null => {
  if (!logsDir) return null;
  const path = join(logsDir, `shard-${shard}`, 'artifacts', 'playwright', 'failure-debug', 'health.json');
  if (!existsSync(path)) return null;
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));
  if (!isQaRecord(parsed)) throw new Error(`QA_FORENSIC_HEALTH_INVALID:${shard}`);
  const source = isQaRecord(parsed['source']) ? parsed['source'] : {};
  const bootstrap = isQaRecord(parsed['bootstrap']) ? parsed['bootstrap'] : {};
  return {
    runtimeHeight: typeof source['height'] === 'number' && Number.isSafeInteger(source['height']) ? source['height'] : null,
    runtimeStateHash: typeof bootstrap['runtimeStateHash'] === 'string' ? bootstrap['runtimeStateHash'] : null,
    entityStateHash: typeof bootstrap['entityStateHash'] === 'string' ? bootstrap['entityStateHash'] : null,
    restoredEntityStateHash: typeof bootstrap['restoredEntityStateHash'] === 'string' ? bootstrap['restoredEntityStateHash'] : null,
  };
};

const buildQaForensicManifest = (run: QaRunManifest, logsDir?: string): Record<string, unknown> => ({
  version: 1,
  runId: run.runId,
  status: run.status,
  createdAt: run.createdAt,
  completedAt: run.completedAt,
  candidate: run.candidate ?? null,
  code: run.code ? {
    gitHead: run.code.gitHead,
    codeHash: run.code.codeHash,
    buildInputHash: run.code.buildInputHash ?? null,
    dirty: run.code.dirty,
  } : null,
  shards: run.shards.map(shard => ({
    shard: shard.shard,
    status: shard.status,
    resultClass: shard.resultClass ?? null,
    target: shard.target,
    durationMs: shard.durationMs,
    commitment: readQaForensicCommitment(logsDir, shard.shard),
    failure: shard.failureCapsule ? {
      file: shard.failureCapsule.file,
      line: shard.failureCapsule.line,
      title: shard.failureCapsule.title,
      fingerprint: createHash('sha256')
        .update(`${shard.failureCapsule.file}\0${shard.failureCapsule.line}\0${shard.failureCapsule.title}\0${shard.failureCapsule.error}`, 'utf8')
        .digest('hex'),
    } : null,
  })),
});

export const recordQaRunHistory = (run: QaRunManifest, logsDir: string): void => {
  const normalizedRun = applyQaRunSeverity(run);
  assertQaReleaseRunSeverity(normalizedRun);
  const timing = summarizeQaRunTiming(normalizedRun);
  const browserHealth = normalizedRun.browserHealth ?? summarizeQaRunBrowserHealth(normalizedRun);
  const db = openQaHistoryDb();
  try {
    db.query(`
      INSERT INTO qa_runs (
        run_id,
        created_at,
        completed_at,
        status,
        total_ms,
        total_shards,
        passed_shards,
        failed_shards,
        git_head,
        git_branch,
        dirty,
        code_hash,
        avg_load1,
        peak_load1,
        max_child_cpu_pct,
        max_child_rss_kb,
        suite_key,
        benchmark_status,
        benchmark_delta_pct,
        benchmark_compared_run_id,
        browser_issue_count,
        browser_error_count,
        browser_warning_count,
        network_failure_count,
        http_error_count,
        child_cpu_p95_pct,
        avg_shard_ms,
        max_shard_ms,
        bootstrap_ms,
        api_healthy_ms,
        playwright_ms,
        phase_p95_preflight_ms,
        phase_p95_anvil_boot_ms,
        phase_p95_api_boot_ms,
        phase_p95_api_healthy_ms,
        phase_p95_vite_boot_ms,
        phase_p95_playwright_ms,
        logs_dir,
        manifest_json,
        forensic_json
      ) VALUES (
        $runId,
        $createdAt,
        $completedAt,
        $status,
        $totalMs,
        $totalShards,
        $passedShards,
        $failedShards,
        $gitHead,
        $gitBranch,
        $dirty,
        $codeHash,
        $avgLoad1,
        $peakLoad1,
        $maxChildCpuPct,
        $maxChildRssKb,
        $suiteKey,
        $benchmarkStatus,
        $benchmarkDeltaPct,
        $benchmarkComparedRunId,
        $browserIssueCount,
        $browserErrorCount,
        $browserWarningCount,
        $networkFailureCount,
        $httpErrorCount,
        $childCpuP95Pct,
        $avgShardMs,
        $maxShardMs,
        $bootstrapMs,
        $apiHealthyMs,
        $playwrightMs,
        $phaseP95PreflightMs,
        $phaseP95AnvilBootMs,
        $phaseP95ApiBootMs,
        $phaseP95ApiHealthyMs,
        $phaseP95ViteBootMs,
        $phaseP95PlaywrightMs,
        $logsDir,
        $manifestJson,
        $forensicJson
      )
      ON CONFLICT(run_id) DO UPDATE SET
        created_at = excluded.created_at,
        completed_at = excluded.completed_at,
        status = excluded.status,
        total_ms = excluded.total_ms,
        total_shards = excluded.total_shards,
        passed_shards = excluded.passed_shards,
        failed_shards = excluded.failed_shards,
        git_head = excluded.git_head,
        git_branch = excluded.git_branch,
        dirty = excluded.dirty,
        code_hash = excluded.code_hash,
        avg_load1 = excluded.avg_load1,
        peak_load1 = excluded.peak_load1,
        max_child_cpu_pct = excluded.max_child_cpu_pct,
        max_child_rss_kb = excluded.max_child_rss_kb,
        suite_key = excluded.suite_key,
        benchmark_status = excluded.benchmark_status,
        benchmark_delta_pct = excluded.benchmark_delta_pct,
        benchmark_compared_run_id = excluded.benchmark_compared_run_id,
        browser_issue_count = excluded.browser_issue_count,
        browser_error_count = excluded.browser_error_count,
        browser_warning_count = excluded.browser_warning_count,
        network_failure_count = excluded.network_failure_count,
        http_error_count = excluded.http_error_count,
        child_cpu_p95_pct = excluded.child_cpu_p95_pct,
        avg_shard_ms = excluded.avg_shard_ms,
        max_shard_ms = excluded.max_shard_ms,
        bootstrap_ms = excluded.bootstrap_ms,
        api_healthy_ms = excluded.api_healthy_ms,
        playwright_ms = excluded.playwright_ms,
        phase_p95_preflight_ms = excluded.phase_p95_preflight_ms,
        phase_p95_anvil_boot_ms = excluded.phase_p95_anvil_boot_ms,
        phase_p95_api_boot_ms = excluded.phase_p95_api_boot_ms,
        phase_p95_api_healthy_ms = excluded.phase_p95_api_healthy_ms,
        phase_p95_vite_boot_ms = excluded.phase_p95_vite_boot_ms,
        phase_p95_playwright_ms = excluded.phase_p95_playwright_ms,
        logs_dir = excluded.logs_dir,
        manifest_json = excluded.manifest_json,
        forensic_json = excluded.forensic_json
    `).run({
      $runId: normalizedRun.runId,
      $createdAt: normalizedRun.createdAt,
      $completedAt: normalizedRun.completedAt,
      $status: normalizedRun.status,
      $totalMs: normalizedRun.totalMs,
      $totalShards: normalizedRun.totalShards,
      $passedShards: normalizedRun.passedShards,
      $failedShards: normalizedRun.failedShards,
      $gitHead: normalizedRun.code?.gitHead ?? null,
      $gitBranch: normalizedRun.code?.gitBranch ?? null,
      $dirty: normalizedRun.code?.dirty ? 1 : 0,
      $codeHash: normalizedRun.code?.codeHash ?? null,
      $avgLoad1: toNullableNumber(normalizedRun.perf?.avgLoad1),
      $peakLoad1: toNullableNumber(normalizedRun.perf?.peakLoad1),
      $maxChildCpuPct: toNullableNumber(normalizedRun.perf?.maxChildCpuPct),
      $maxChildRssKb: toNullableNumber(normalizedRun.perf?.maxChildRssKb),
      $suiteKey: qaRunSuiteKey(normalizedRun),
      $benchmarkStatus: normalizedRun.benchmark?.status ?? null,
      $benchmarkDeltaPct: normalizedRun.benchmark?.metrics.find(metric => metric.metric === 'totalMs')?.deltaPct ?? null,
      $benchmarkComparedRunId: normalizedRun.benchmark?.comparedRunId ?? null,
      $browserIssueCount: browserHealth.issueCount,
      $browserErrorCount: browserHealth.errorCount,
      $browserWarningCount: browserHealth.warningCount,
      $networkFailureCount: browserHealth.networkFailureCount,
      $httpErrorCount: browserHealth.httpErrorCount,
      $childCpuP95Pct: qaRunChildCpuP95(normalizedRun),
      $avgShardMs: timing.avgShardMs,
      $maxShardMs: timing.maxShardMs,
      $bootstrapMs: timing.bootstrapMs,
      $apiHealthyMs: timing.apiHealthyMs,
      $playwrightMs: timing.playwrightMs,
      $phaseP95PreflightMs: timing.phaseP95?.preflight ?? null,
      $phaseP95AnvilBootMs: timing.phaseP95?.anvilBoot ?? null,
      $phaseP95ApiBootMs: timing.phaseP95?.apiBoot ?? null,
      $phaseP95ApiHealthyMs: timing.phaseP95?.apiHealthy ?? null,
      $phaseP95ViteBootMs: timing.phaseP95?.viteBoot ?? null,
      $phaseP95PlaywrightMs: timing.phaseP95?.playwright ?? null,
      $logsDir: logsDir,
      $manifestJson: JSON.stringify(stripQaHistoryPerfSamples(normalizedRun)),
      $forensicJson: safeStringify(buildQaForensicManifest(normalizedRun, logsDir)),
    });
  } finally {
    db.close();
  }
};

const findComparableQaBenchmarkRun = (run: QaRunManifest): QaRunManifest | null => {
  const db = openQaHistoryDb();
  try {
    const row = db.query(`
      SELECT manifest_json
      FROM qa_runs
      WHERE suite_key = $suiteKey
        AND run_id != $runId
        AND total_ms IS NOT NULL
        AND created_at < $createdAt
      ORDER BY created_at DESC
      LIMIT 1
    `).get({
      $suiteKey: qaRunSuiteKey(run),
      $runId: run.runId,
      $createdAt: run.createdAt,
    }) as Record<string, unknown> | null;
    const direct = parseManifestJson(row?.['manifest_json']);
    if (direct) return direct;
    return null;
  } finally {
    db.close();
  }
};

export const compareQaRunWithHistory = (run: QaRunManifest): QaBenchmarkComparison => {
  const baseline = findComparableQaBenchmarkRun(run);
  return compareQaBenchmarkRuns(run, baseline);
};

const detectArtifactKind = (name: string): QaArtifactKind => {
  const lower = name.toLowerCase();
  if (lower.endsWith('.webm')) return 'video';
  if (lower.endsWith('.png') || lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image';
  if (lower.endsWith('.zip')) return 'trace';
  if (lower.endsWith('.vtt')) return 'text';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.log') || lower.endsWith('.txt')) return 'text';
  if (lower.endsWith('.tar') || lower.endsWith('.gz')) return 'archive';
  return 'other';
};

const humanizeSlug = (value: string): string =>
  value
    .replace(/^e2e-/, '')
    .replace(/\.spec\.ts$/, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

const titleSlug = (title: string): string => {
  const cleaned = title
    .replace(/['"]/g, '')
    .replace(/->/g, ' to ')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
  const words = cleaned.split('-').filter(Boolean);
  return words.slice(0, 5).join('-') || 'case';
};

const parseTargetFile = (target: string | null | undefined): string => {
  const raw = String(target || '').trim();
  const match = raw.match(/^(.*?\.spec\.ts)(?::\d+)?/);
  return match?.[1] || raw;
};

const normalizedQaText = (target: string | null | undefined, title: string | null | undefined): string =>
  `${target || ''} ${title || ''}`
    .replace(/[_./:-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();

export const deriveQaTestHandle = (target: string | null | undefined, title: string | null | undefined): string => {
  const key = normalizedQaText(target, title);
  if (key.includes('dispute') && key.includes('lifecycle') && key.includes('reserve')) {
    return 'dispute.lifecycle-return';
  }
  if (key.includes('dispute') && key.includes('sign') && key.includes('broadcast')) {
    return 'dispute.sign-broadcast';
  }
  if (key.includes('payment') && key.includes('smoke')) {
    return 'payment.smoke';
  }
  if (key.includes('baseline') || key.includes('cold reset provisions')) {
    return 'baseline.mesh-reserves';
  }
  if (key.includes('connect')) {
    return 'wallet.connect';
  }
  const file = parseTargetFile(target);
  const suite = humanizeSlug(basename(file || 'e2e'));
  const titlePart = titleSlug(String(title || target || 'case'));
  return `${suite}.${titlePart}`;
};

export const deriveQaTestDescription = (
  target: string | null | undefined,
  title: string | null | undefined,
): string => {
  const key = normalizedQaText(target, title);
  if (key.includes('dispute') && key.includes('lifecycle') && key.includes('reserve')) {
    return 'Opens a disputed account, waits through the dispute window, finalizes it, and verifies that the reserve is returned.';
  }
  if (key.includes('dispute') && key.includes('sign') && key.includes('broadcast')) {
    return 'Builds a settlement workspace, signs the dispute batch, broadcasts it, and verifies that the hub accepts the result.';
  }
  if (key.includes('payment') && key.includes('smoke')) {
    return 'Creates users, opens the hub route, sends a payment, and verifies that the receipt path is usable.';
  }
  if (key.includes('baseline')) {
    return 'Starts an isolated stack, logs in, checks health, and confirms account opening reaches the first frame.';
  }
  if (key.includes('connect')) {
    return 'Checks that the browser wallet connects to the isolated runtime and reaches the account workspace.';
  }
  const text = String(title || target || '').trim();
  if (!text) return 'No test description recorded.';
  return `${text.charAt(0).toUpperCase()}${text.slice(1)}.`;
};

export const parseQaTimelineSteps = (text: string): QaSlowStep[] => {
  const out: QaSlowStep[] = [];
  const pendingTimingByLabel = new Map<string, number>();
  const cueRe = /^\[(E2E-CUE|MESH-CUE)\]\s+(.+?)\s+start=(\d+)ms\s+end=(\d+)ms\s+duration=(\d+)ms(?:\s.*)?$/;
  const timingRe = /^\[(E2E-TIMING|MESH-TIMING)\]\s+(.+?)\s+(\d+)ms(?:\s.*)?$/;
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim();
    const cue = cueRe.exec(line);
    if (cue) {
      const prefix = cue[1] === 'MESH-CUE' ? 'MESH-TIMING' : 'E2E-TIMING';
      const label = `${prefix}:${String(cue[2] || '').trim()}`;
      const startMs = Number(cue[3] || '0');
      const endMs = Number(cue[4] || '0');
      const ms = Number(cue[5] || '0');
      if (!label || !Number.isFinite(startMs) || !Number.isFinite(endMs) || !Number.isFinite(ms)) continue;
      const step = {
        label,
        ms: Math.max(0, Math.floor(ms)),
        startMs: Math.max(0, Math.floor(startMs)),
        endMs: Math.max(Math.max(0, Math.floor(startMs)), Math.floor(endMs)),
      };
      const pendingIndex = pendingTimingByLabel.get(label);
      if (pendingIndex !== undefined && out[pendingIndex]?.startMs === undefined) {
        out[pendingIndex] = step;
      } else {
        out.push(step);
      }
      pendingTimingByLabel.delete(label);
      continue;
    }

    const timing = timingRe.exec(line);
    if (!timing) continue;
    const label = `${String(timing[1] || '').trim()}:${String(timing[2] || '').trim()}`;
    const ms = Number(timing[3] || '0');
    if (!label || !Number.isFinite(ms)) continue;
    pendingTimingByLabel.set(label, out.length);
    out.push({ label, ms: Math.max(0, Math.floor(ms)) });
  }
  return out;
};
