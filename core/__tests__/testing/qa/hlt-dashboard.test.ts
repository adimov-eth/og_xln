import { describe, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';

import {
  paymentCardFromReport,
  publishHltDashboardPerfFromWorkDir,
  publishHltDashboardReport,
  readHltDashboardSnapshot,
} from '../../../qa/hlt/hlt-dashboard';
import { parseHltDashboardConfig, previewHltDashboard } from '../../../qa/hlt/hlt-dashboard-preview';
import { summarizeRuntimePerfLines } from '../../../scripts/operations/benchmark/analyze-runtime-perf';
import { safeStringify } from '../../../protocol/serialization';

const SAMPLE_PAYMENT = {
  schema: 'xln-hlt-payment-load-v1',
  engine: 'rust',
  mode: 'payments',
  runId: 'hlt-dashboard-test',
  completionAuthority: 'committed_entity_metrics_and_bilateral_runtime_quiescence',
  configuredUsers: 1000,
  configuredRounds: 20,
  cadenceMs: 1000,
  senders: 1000,
  receivers: 1000,
  tokenId: 1,
  amount: '1000',
  offeredPaymentRate: 1000,
  submittedPayments: 20000,
  deliveredPayments: 20000,
  enqueueAckElapsedMs: 70,
  sourceDispatchFinishedElapsedMs: 60,
  sourceAllAckedElapsedMs: 70,
  commandObservedElapsedMs: 70,
  deliveredElapsedMs: 6699,
  drainCompleteElapsedMs: 7000,
  deliveredTps: 20000 * 1000 / 6699,
  hubCompletedPaymentsBefore: 50,
  hubCompletedPaymentsAfter: 20050,
  hubAcceptedPaymentsBefore: 40,
  hubAcceptedPaymentsAfter: 20040,
  hubIngressElapsedMs: 5000,
  settlementSamples: [
    { elapsedMs: 5000, runtimeHeight: 310, acceptedPayments: 20000, completedPayments: 18000, paybookOpen: 2000 },
    { elapsedMs: 6699, runtimeHeight: 313, acceptedPayments: 20000, completedPayments: 20000, paybookOpen: 0 },
  ],
  roundSubmissionLagMs: Array.from({ length: 20000 }, () => 1),
  laneQuiescence: {
    runtimes: 1000,
    openHubPeers: 1000,
    pendingRuntimeWork: 0,
    pendingAccountFrames: 0,
    accountMempoolTxs: 0,
  },
  walBytesBefore: 13268608,
  walBytesAfter: 29856693,
  hubDurableBefore: {
    height: 299,
    canonicalStateHash: '0x74e7727ece297d62bc8082d662385a6d92c412c38dfb0420c2483017ebc3c845',
  },
  hubDurableAfter: {
    height: 313,
    canonicalStateHash: '0x35eecd38bd0a40efc6431d181b1d0dd09d05916cc53e8fa9c0d16a33723ae817',
  },
  environment: {
    disputeHankos: 'always', hubWalSync: true, lanePersistence: false, laneWalSync: false,
    laneNice: 0, cryptoPoolWorkers: 'default', cryptoSignWorkers: 'default', accountWorkers: 4,
  },
};

describe('hlt dashboard preview', () => {
  test('200 sovereign users all offer one payment per second on one hub', () => {
    const preview = previewHltDashboard(parseHltDashboardConfig(new URLSearchParams({
      users: '200',
      runtimesPerProcess: '40',
      rate: '1',
      duration: '10',
      mix: '1:1',
      hubs: 'H1',
      mode: 'payments',
    })));
    expect(preview.daemons).toBe(5);
    expect(preview.offeredPayPerSecond).toBe(200);
    expect(preview.offeredSwapPerSecond).toBe(0);
    expect(preview.config.mix).toBe('0:1');
    expect(preview.hubShare.workerSingleHubPct).toBe(100);
    expect(preview.hubShare.workerMultiHubPct).toBe(0);
    expect(preview.isolatedCommand).toContain('XLN_HLT_RUNTIMES_PER_PROCESS=40');
    expect(preview.warning).toContain('8082');
  });

  test('mixed 1000 users at 1 action/s offer 1000 pay/s and 1000 swap/s', () => {
    const preview = previewHltDashboard(parseHltDashboardConfig(new URLSearchParams({
      users: '1000',
      runtimesPerProcess: '40',
      rate: '1',
      duration: '1',
      mix: '0:1',
      hubs: 'H1',
      mode: 'mixed',
    })));
    expect(preview.config.mix).toBe('1:1');
    expect(preview.offeredPayPerSecond).toBe(1000);
    expect(preview.offeredSwapPerSecond).toBe(1000);
    expect(preview.paymentLanes).toBe(1000);
    expect(preview.swapLanes).toBe(500);
    expect(preview.isolatedCommand).toContain('XLN_LOCAL_PROD_SMOKE_SWAP_LOAD_MODE=mixed');
  });

  test('cross-j on two hubs is 100% multi-hub path', () => {
    const preview = previewHltDashboard(parseHltDashboardConfig(new URLSearchParams({
      users: '8',
      runtimesPerProcess: '2',
      hubs: 'H1,H2',
      mode: 'cross',
    })));
    expect(preview.hubShare.routing).toBe('cross_j_path');
    expect(preview.hubShare.workerMultiHubPct).toBe(100);
    expect(preview.daemons).toBe(4);
  });
});

describe('hlt dashboard snapshot', () => {
  test('payment card derives hub frames and pays/frame', () => {
    const card = paymentCardFromReport(SAMPLE_PAYMENT);
    expect(card.hubFrames).toBe(14);
    expect(card.paymentsPerFrame).toBeCloseTo(20000 / 14);
    expect(card.deliveredTps).toBeCloseTo(2985.52, 2);
  });

  test('publishes payment + perf tail for the dashboard', () => {
    const root = mkdtempSync(join(tmpdir(), 'xln-hlt-dash-'));
    const workDir = mkdtempSync(join(tmpdir(), 'xln-hlt-work-'));
    writeFileSync(
      join(workDir, 'server.log'),
      '[H1] [INFO][runtime] process.profile {"elapsedMs":12,"phases":[{"name":"apply","ms":12}]}\n',
    );
    publishHltDashboardReport('payment', { ...SAMPLE_PAYMENT, runId: basename(workDir) }, root);
    publishHltDashboardPerfFromWorkDir(workDir, root);
    const paymentArtifact = JSON.parse(readFileSync(join(root, '.logs/qa/hlt/latest-payment.json'), 'utf8')) as {
      runId?: string;
    };
    const perfArtifact = JSON.parse(readFileSync(join(root, '.logs/qa/hlt/latest-perf.json'), 'utf8')) as {
      runId?: string;
    };
    expect(paymentArtifact.runId).toBe(basename(workDir));
    expect(perfArtifact.runId).toBe(paymentArtifact.runId);
    const snapshot = readHltDashboardSnapshot(root);
    expect(snapshot.payment?.deliveredTps).toBeCloseTo(2985.52, 2);
    expect(snapshot.perf.parsedProfiles).toBe(1);
    expect(snapshot.hubPerf[0]?.hubLabel).toBe('H1');
    // cpuTps = delivered payments per second of hub process CPU
    // (qa/hlt/hlt-dashboard.ts hubPerfFromRows); the profile line above reports
    // 12 ms of runtime.process.total for H1.
    expect(snapshot.hubPerf[0]?.cpuTps).toBeCloseTo(SAMPLE_PAYMENT.deliveredPayments * 1_000 / 12);
  });

  test('replay card carries the parity gate engine ladder', () => {
    const root = mkdtempSync(join(tmpdir(), 'xln-hlt-dash-'));
    const replays = join(root, '.logs/qa/hlt/replays');
    mkdirSync(replays, { recursive: true });
    const trial = {
      offeredTps: null, frames: 73, accountInputs: 18304, accountTxs: 18304, outboxEnvelopes: 14009,
      elapsedMs: 8753.9, cpuMs: 4713.9, accountInputTps: 2090.9, accountTxTps: 3883.4, cpuAccountTxTps: 3883.4,
      finalHeight: 81, finalPendingOutbox: 1, equivalent: true,
    };
    writeFileSync(join(replays, '1-parity.json'), safeStringify({
      schema: 'xln-hlt-hub-replay-report-v1',
      createdAt: 1,
      recordingManifestHash: `0x${'ab'.repeat(32)}`,
      mode: 'max',
      trials: [
        { ...trial, engine: 'ts', workers: 1 },
        { ...trial, engine: 'rust', workers: 8 },
        trial,
      ],
    }));
    const snapshot = readHltDashboardSnapshot(root);
    expect(snapshot.replay?.trials.map(row => [row.engine, row.workers])).toEqual([['ts', 1], ['rust', 8], [null, null]]);
    writeFileSync(join(replays, '2-parity.json'), safeStringify({
      schema: 'xln-hlt-hub-replay-report-v1', createdAt: 2, recordingManifestHash: `0x${'ab'.repeat(32)}`, mode: 'max',
      trials: [{ ...trial, engine: 'go', workers: 1 }],
    }));
    expect(() => readHltDashboardSnapshot(root)).toThrow('HLT_REPLAY_TRIAL_ENGINE_INVALID:0');
  });
});

test('summarizeRuntimePerfLines is isolated from later calls', () => {
  const first = summarizeRuntimePerfLines([
    '[H1] [INFO][runtime] process.profile {"elapsedMs":10,"phases":[{"name":"apply","ms":10}]}',
  ]);
  const second = summarizeRuntimePerfLines([]);
  expect(first.parsedProfiles).toBe(1);
  expect(second.parsedProfiles).toBe(0);
  expect(second.rows).toEqual([]);
});
