import { expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  applyQaRunSeverity,
  assertQaReleaseRunSeverity,
  assertQaRunCandidateBinding,
  classifyQaArtifactSensitivity,
  classifyQaShardFailure,
  compareQaBenchmarkRuns,
  formatQaRunIdUtc,
  QA_HISTORY_DB_PATH,
  QA_RUN_MANIFEST_VERSION,
  redactQaSecretText,
  recordQaRunHistory,
  type QaRunManifest,
} from '../../../qa/report';
import { buildQaCandidateIdentity } from '../../../qa/candidate';

const deleteQaHistoryRows = (runIds: string[]): void => {
  if (runIds.length === 0) return;
  if (!existsSync(QA_HISTORY_DB_PATH)) return;
  const db = new Database(QA_HISTORY_DB_PATH);
  try {
    const hasTable = db.query(`
      SELECT name
      FROM sqlite_master
      WHERE type = 'table' AND name = 'qa_runs'
      LIMIT 1
    `).get();
    if (!hasTable) return;
    for (const runId of runIds) {
      db.query(`DELETE FROM qa_runs WHERE run_id = $runId`).run({ $runId: runId });
    }
  } finally {
    db.close();
  }
};

const benchmarkRun = (
  runId: string,
  totalMs: number,
  playwrightMs: number,
  codeHash = 'same-code',
  gitHead = 'same-head',
  peakLoad1 = 1,
): QaRunManifest => applyQaRunSeverity({
  manifestVersion: 2,
  runId,
  createdAt: Date.UTC(2026, 5, 23),
  completedAt: Date.UTC(2026, 5, 23, 0, 0, 1),
  status: 'passed',
  totalMs,
  code: {
    gitHead,
    gitBranch: 'codex/qa',
    gitStatus: '',
    dirty: false,
    codeHash,
    computedAt: Date.UTC(2026, 5, 23),
    trackedFileCount: 1,
    trackedBytes: 1,
  },
  perf: {
    sampleCount: 1,
    avgLoad1: 1,
    peakLoad1,
    minFreeMemBytes: 1024,
    maxRunnerRssBytes: 2048,
    maxChildCpuPct: 20,
    maxChildRssKb: 4096,
    samples: [],
  },
  totalShards: 1,
  passedShards: 1,
  failedShards: 0,
  args: {
    pwProject: 'chromium',
    pwFiles: ['tests/e2e-qa-cockpit.spec.ts'],
  },
  shards: [{
    shard: 0,
    status: 'passed',
    durationMs: totalMs,
    handle: 'qa cockpit',
    description: null,
    scenario: null,
    target: 'tests/e2e-qa-cockpit.spec.ts',
    title: 'plays recorded scenario videos',
    requireMarketMaker: false,
    logRelativePath: null,
    logTail: null,
    error: null,
    failureClass: null,
    phaseMs: {
      preflight: 0,
      anvilBoot: 0,
      apiBoot: 100,
      apiHealthy: 100,
      viteBoot: 100,
      playwright: playwrightMs,
    },
    timelineSteps: [],
    slowSteps: [],
    artifacts: [],
    hasVideo: false,
    hasTrace: false,
  }],
} as QaRunManifest);

const asCurrentQaRun = (run: QaRunManifest): QaRunManifest => {
  const gitHead = createHash('sha1').update(String(run.code?.gitHead ?? run.runId)).digest('hex');
  const codeHash = createHash('sha256').update(String(run.code?.codeHash ?? run.runId)).digest('hex');
  const gateConfig = { schemaVersion: 1, fixtureRunId: run.runId };
  const candidate = buildQaCandidateIdentity({ gitHead, codeHash, gateConfig });
  return applyQaRunSeverity({
    ...run,
    manifestVersion: QA_RUN_MANIFEST_VERSION,
    candidate,
    gateConfig,
    code: {
      ...run.code!,
      gitHead,
      codeHash,
    },
    shards: run.shards.map(shard => ({
      ...shard,
      candidateId: candidate.candidateId,
      gateConfigHash: candidate.gateConfigHash,
    })),
  });
};

test('qa severity never reports a fail-fast cancelled shard as passed', () => {
  const passed = benchmarkRun('cancelled-shard', 1_000, 800);
  const normalizedShard = passed.shards[0];
  if (!normalizedShard) throw new Error('TEST_QA_SHARD_REQUIRED');
  const {
    severity: _severity,
    reason: _reason,
    since: _since,
    owner: _owner,
    evidence: _evidence,
    ...rawShard
  } = normalizedShard;
  const cancelled = applyQaRunSeverity({
    ...passed,
    status: 'unknown',
    passedShards: 0,
    shards: [{ ...rawShard, status: 'cancelled' }],
  });

  expect(cancelled.shards[0]?.severity).toBe('UNKNOWN');
  expect(cancelled.shards[0]?.reason).toContain('cancelled after another shard failed');
});

test('qa benchmark comparison flags sharp runtime deltas', () => {
  const baseline = benchmarkRun('baseline', 1000, 800);
  const slower = compareQaBenchmarkRuns(benchmarkRun('slower', 1300, 1100, 'new-code', 'new-head'), baseline);
  expect(slower.status).toBe('slower');
  expect(slower.sameCodeHash).toBe(false);
  expect(slower.sameGitHead).toBe(false);
  expect(slower.metrics.find(metric => metric.metric === 'totalMs')?.deltaPct).toBe(30);
  expect(slower.likelyCauses).toContain('code hash changed');

  const faster = compareQaBenchmarkRuns(benchmarkRun('faster', 700, 550), baseline);
  expect(faster.status).toBe('faster');
  expect(faster.metrics.find(metric => metric.metric === 'totalMs')?.deltaPct).toBe(-30);

  const lowerLoadOnly = compareQaBenchmarkRuns(benchmarkRun('lower-load', 1010, 805, 'same-code', 'same-head', 0.4), baseline);
  expect(lowerLoadOnly.status).toBe('ok');
  expect(lowerLoadOnly.metrics.find(metric => metric.metric === 'peakLoad1')?.verdict).toBe('faster');
  expect(lowerLoadOnly.reason).toContain('Timing within thresholds');

  const higherHostLoadOnly = compareQaBenchmarkRuns(benchmarkRun('higher-host-load', 1000, 800, 'same-code', 'same-head', 3), baseline);
  expect(higherHostLoadOnly.status).toBe('ok');
  expect(higherHostLoadOnly.metrics.find(metric => metric.metric === 'peakLoad1')?.verdict).toBe('slower');
  expect(higherHostLoadOnly.reason).toContain('host load');
  expect(higherHostLoadOnly.likelyCauses).toContain('host load increased without app timing regression');
});

test('qa severity model normalizes unannotated runs and gates release manifests', () => {
  const unannotated = benchmarkRun('severity-unannotated', 1000, 800);
  expect(unannotated.severity).toBe('OK');
  expect(unannotated.reason).toBe('QA run is green');
  expect(unannotated.shards[0]?.severity).toBe('OK');
  expect(unannotated.browserHealth?.severity).toBe('OK');

  const degraded = compareQaBenchmarkRuns(benchmarkRun('severity-slower', 1300, 1100), unannotated);
  expect(degraded.severity).toBe('DEGRADED');
  expect(degraded.reason).toContain('% vs severity-unannotated');

  const missingSeverity = { ...unannotated, manifestVersion: 3 } as Record<string, unknown>;
  delete missingSeverity['severity'];
  expect(() => assertQaReleaseRunSeverity(missingSeverity as QaRunManifest)).toThrow('QA_RUN_SEVERITY_REQUIRED');

  const missingReason = { ...unannotated, manifestVersion: 3 } as Record<string, unknown>;
  delete missingReason['reason'];
  expect(() => assertQaReleaseRunSeverity(missingReason as QaRunManifest)).toThrow('QA_RUN_REASON_REQUIRED');

  const current = asCurrentQaRun(benchmarkRun('candidate-bound', 1000, 800));
  expect(() => assertQaRunCandidateBinding(current)).not.toThrow();
  expect(() => assertQaRunCandidateBinding({
    ...current,
    shards: [{ ...current.shards[0]!, candidateId: '0'.repeat(64) }],
  })).toThrow('QA_SHARD_CANDIDATE_MISMATCH');
});

test('qa run id formatter uses UTC fields', () => {
  expect(formatQaRunIdUtc(Date.UTC(2026, 5, 23, 0, 1, 2, 3))).toBe('20260623-000102-003');
  expect(formatQaRunIdUtc(Date.UTC(2026, 5, 23, 23, 59, 59, 999))).toBe('20260623-235959-999');
});

test('qa shard failure classifier maps operator failure classes', () => {
  expect(classifyQaShardFailure({
    status: 'failed',
    error: 'Timeout 5000ms exceeded',
  })).toBe('timeout');
  expect(classifyQaShardFailure({
    status: 'failed',
    logTail: 'Expected: 1\nReceived: 2',
  })).toBe('assertion');
  expect(classifyQaShardFailure({
    status: 'failed',
    browserIssues: [{
      type: 'http',
      severity: 'error',
      message: 'HTTP 502 from runtime API',
      url: 'http://127.0.0.1:8080/health',
      method: 'GET',
      status: 502,
      testId: 'health',
      timestamp: Date.UTC(2026, 5, 23),
    }],
  })).toBe('infra');
  expect(classifyQaShardFailure({
    status: 'passed',
    logTail: 'Timeout 5000ms exceeded',
  })).toBeNull();
});

test('qa failure fixtures classify browser, log, and network failures', () => {
  const at = Date.UTC(2026, 5, 23);
  const browserIssue = (
    type: 'console' | 'pageerror' | 'requestfailed' | 'http',
    message: string,
    extra: { status?: number | null; url?: string | null; method?: string | null } = {},
  ) => ({
    type,
    severity: 'error' as const,
    message,
    url: extra.url ?? 'https://localhost:8080/qa',
    method: extra.method ?? 'GET',
    status: extra.status ?? null,
    testId: `fixture:${type}`,
    timestamp: at,
  });

  expect(classifyQaShardFailure({
    status: 'failed',
    browserIssues: [browserIssue('console', 'Expected: 1 Received: 2')],
  })).toBe('assertion');
  expect(classifyQaShardFailure({
    status: 'failed',
    browserIssues: [browserIssue('pageerror', 'Unhandled app exception')],
  })).toBe('crash');
  expect(classifyQaShardFailure({
    status: 'failed',
    browserIssues: [browserIssue('requestfailed', 'net::ERR_CONNECTION_REFUSED')],
  })).toBe('infra');
  expect(classifyQaShardFailure({
    status: 'failed',
    browserIssues: [browserIssue('http', 'HTTP 502', { status: 502, url: 'https://localhost:8080/api/health' })],
  })).toBe('infra');
  expect(classifyQaShardFailure({
    status: 'failed',
    logTail: 'E2E_FATAL_RUNTIME_LOG runtime crashed',
  })).toBe('crash');
});

test('qa secret redactor masks runtime tokens and labeled secrets', () => {
  const raw = [
    'Authorization: Bearer bearer-secret-123456789',
    'x-xln-qa-token: qa-secret-token-123456',
    'remote=xlnra1.remote-secret-token',
    'link=/wallet?runtime-import=encoded-secret&readToken=read-secret',
    'rpc=https://user:password@example.invalid/rpc',
    'PRIVATE_KEY=0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'mnemonic="abandon abandon abandon secret"',
    '{"adminToken":"json-admin-token-123456"}',
  ].join('\n');
  const redacted = redactQaSecretText(raw);

  for (const secret of [
    'bearer-secret-123456789',
    'qa-secret-token-123456',
    'remote-secret-token',
    'encoded-secret',
    'read-secret',
    'user:password',
    '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    'abandon abandon abandon secret',
    'json-admin-token-123456',
  ]) {
    expect(redacted).not.toContain(secret);
  }
  expect(redacted).toContain('[REDACTED]');
});

test('qa artifact sensitivity classifier separates public cues from secret-bearing files', () => {
  expect(classifyQaArtifactSensitivity({
    name: 'video.webm',
    relativePath: 'test-results-shard-1/wallet/video.webm',
    kind: 'video',
    contentType: 'video/webm',
  })).toBe('internal');
  expect(classifyQaArtifactSensitivity({
    name: 'state.png',
    relativePath: 'ux-gallery/desktop/state.png',
    kind: 'image',
    contentType: 'image/png',
  })).toBe('internal');
  expect(classifyQaArtifactSensitivity({
    name: 'cues.vtt',
    relativePath: 'test-results-shard-1/wallet/qa-cues/cues.vtt',
    kind: 'text',
    contentType: 'text/vtt; charset=utf-8',
  })).toBe('public');
  expect(classifyQaArtifactSensitivity({
    name: 'trace.zip',
    relativePath: 'test-results-shard-1/wallet/trace.zip',
    kind: 'trace',
    contentType: 'application/zip',
  })).toBe('secret-bearing');
  expect(classifyQaArtifactSensitivity({
    name: 'manifest.json',
    relativePath: 'manifest.json',
    kind: 'json',
    contentType: 'application/json',
  })).toBe('secret-bearing');
});

test('qa history stores sample-stripped manifest json', () => {
  const runId = '20260623-000126-780';
  deleteQaHistoryRows([runId]);
  try {
    const sample = {
      ts: Date.UTC(2026, 5, 23, 0, 1, 26),
      load1: 1.5,
      load5: 1.25,
      load15: 1.1,
      freeMemBytes: 900_000_000,
      totalMemBytes: 1_800_000_000,
      runnerRssBytes: 123_000_000,
      children: [],
    };
    const base = benchmarkRun(runId, 2345, 1200);
    const perf = { ...base.perf!, samples: [sample] };
    const run: QaRunManifest = {
      ...base,
      perf,
      shards: [{
        ...base.shards[0]!,
        perf,
      }],
    };
    recordQaRunHistory(run, resolve(process.cwd(), '.logs', 'e2e-parallel', runId));

    const db = new Database(QA_HISTORY_DB_PATH);
    try {
      const row = db.query(`SELECT manifest_json, forensic_json FROM qa_runs WHERE run_id = $runId`).get({ $runId: runId }) as {
        manifest_json?: string;
        forensic_json?: string;
      } | null;
      expect(typeof row?.manifest_json).toBe('string');
      const stored = JSON.parse(row!.manifest_json!) as QaRunManifest;
      expect(stored.perf?.sampleCount).toBe(1);
      expect(stored.perf?.samples).toEqual([]);
      expect(stored.shards[0]?.perf?.sampleCount).toBe(1);
      expect(stored.shards[0]?.perf?.samples).toEqual([]);
      const forensic = String(row?.forensic_json || '');
      expect(forensic).toContain(`"runId":"${runId}"`);
      expect(forensic).not.toContain('logTail');
      expect(forensic).not.toContain('artifacts');
      expect(forensic).not.toContain('samples');
      expect(forensic).not.toContain('seed');
    } finally {
      db.close();
    }
  } finally {
    deleteQaHistoryRows([runId]);
  }
});
