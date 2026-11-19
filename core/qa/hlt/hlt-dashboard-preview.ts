/**
 * Pure HLT dashboard plan: population, offered rates, hub routing honesty,
 * and the isolated smoke command. Nothing here starts a Runtime.
 */

import { requireBoundaryInteger } from '../../protocol/boundary-validation';
import {
  buildHltPlan,
  HLT_DEFAULT_PAYMENT_AMOUNT_RANGE,
  parseHltLabels,
  parseHltMix,
} from '../../scripts/operations/hlt/economy';

const HLT_DASHBOARD_MODES = ['payments', 'same', 'mixed', 'cross'] as const;
type HltDashboardMode = (typeof HLT_DASHBOARD_MODES)[number];

export type HltDashboardConfig = Readonly<{
  users: number;
  runtimesPerProcess: number;
  ratePerUserPerSecond: number;
  durationSeconds: number;
  mix: string;
  hubs: string;
  marketMakers: string;
  mode: HltDashboardMode;
  profile: boolean;
  /** Per-payment amount is drawn uniformly (deterministically) from [min,max]. */
  paymentAmountMin: bigint;
  paymentAmountMax: bigint;
}>;

const HLT_DASHBOARD_DEFAULTS: HltDashboardConfig = {
  users: 200,
  runtimesPerProcess: 200,
  ratePerUserPerSecond: 1,
  durationSeconds: 10,
  mix: '0:1',
  hubs: 'H1',
  marketMakers: 'MM',
  mode: 'payments',
  profile: true,
  paymentAmountMin: HLT_DEFAULT_PAYMENT_AMOUNT_RANGE.min,
  paymentAmountMax: HLT_DEFAULT_PAYMENT_AMOUNT_RANGE.max,
};

type HltHubShare = Readonly<{
  hubCount: number;
  evenSharePct: number;
  workerSingleHubPct: number;
  workerMultiHubPct: number;
  routing: 'pin_first_hub' | 'cross_j_path';
  note: string;
}>;

export type HltDashboardPreview = Readonly<{
  config: HltDashboardConfig;
  daemons: number;
  rounds: number;
  cadenceMs: number;
  paymentLanes: number;
  swapLanes: number;
  offeredPayPerSecond: number;
  offeredSwapPerSecond: number;
  offeredOrderPerSecond: number;
  hubShare: HltHubShare;
  isolatedCommand: string;
  warning: string;
}>;

type HltLedgerEngine = 'ts' | 'rust';

export type HltLedgerRun = Readonly<{
  at: string;
  commit: string;
  headline: string;
  detail: string;
  users: number;
  paymentsTps: number;
  swapsTps: number;
  status: 'green' | 'red';
  /** Which H1 engine produced the number; rows recorded before the Rust port are TS. */
  engine: HltLedgerEngine;
}>;

export type HltPaymentCard = Readonly<{
  deliveredTps: number;
  offeredRate: number;
  submittedPayments: number;
  acceptedPayments: number;
  completedPayments: number;
  drainedPayments: number;
  sourceDispatchP95Ms: number;
  sourceDispatchMaxMs: number;
  sourceAckMaxMs: number;
  deliveredPayments: number;
  elapsedMs: number;
  users: number;
  senders: number;
  hubFrames: number;
  paymentsPerFrame: number;
  walDeltaBytes: number;
  heightBefore: number;
  heightAfter: number;
}>;

export type HltSwapCard = Readonly<{
  matchedTps: number;
  fullySettledTps: number;
  offeredSwapRate: number;
  submitted: number;
  matched: number;
  sourceDispatchP95Ms: number;
  sourceDispatchMaxMs: number;
  sourceAckMaxMs: number;
  matchedElapsedMs: number;
  fullySettledElapsedMs: number;
  users: number;
  hubFrames: number;
}>;

export type HltHubPerfCard = Readonly<{
  hubLabel: string;
  processCount: number;
  processAvgMs: number;
  processTotalMs: number;
  cpuTps: number | null;
}>;

export type HltReplayTrialCard = Readonly<{
  offeredTps: number | null;
  /** Replay engine and Account worker count when the report came from the TS/Rust parity gate. */
  engine: 'ts' | 'rust' | null;
  workers: number | null;
  frames: number;
  accountInputs: number;
  accountTxs: number;
  outboxEnvelopes: number;
  elapsedMs: number;
  cpuMs: number;
  accountInputTps: number;
  accountTxTps: number;
  cpuAccountTxTps: number;
  finalHeight: number;
  finalPendingOutbox: number;
  equivalent: true;
}>;

export type HltReplayCard = Readonly<{
  createdAt: number;
  recordingManifestHash: string;
  mode: 'max' | 'fixed' | 'sweep';
  trials: readonly HltReplayTrialCard[];
}>;

const requireMax = (value: number, maximum: number, code: string): number => {
  if (value > maximum) throw new Error(`${code}:${value}:${maximum}`);
  return value;
};

const parsePositiveBigintParam = (raw: string | null, defaultValue: bigint, code: string): bigint => {
  if (raw === null) return defaultValue;
  let value: bigint;
  try {
    value = BigInt(raw);
  } catch {
    throw new Error(`${code}:${raw}`);
  }
  if (value <= 0n) throw new Error(`${code}:${raw}`);
  return value;
};

const mixForMode = (mode: HltDashboardMode, mix: string): string => {
  if (mode === 'payments') return '0:1';
  if (mode === 'same') return '1:0';
  if (mode === 'mixed') return '1:1';
  return mix;
};

export const parseHltDashboardConfig = (params: URLSearchParams): HltDashboardConfig => {
  const defaults = HLT_DASHBOARD_DEFAULTS;
  const modeRaw = params.get('mode') ?? defaults.mode;
  if (modeRaw !== 'payments' && modeRaw !== 'same' && modeRaw !== 'mixed' && modeRaw !== 'cross') {
    throw new Error(`HLT_DASHBOARD_MODE_INVALID:${modeRaw}`);
  }
  const profileRaw = params.get('profile');
  const users = requireMax(
    requireBoundaryInteger(Number(params.get('users') ?? defaults.users), 'HLT_DASHBOARD_USERS_INVALID', 2),
    4_096,
    'HLT_DASHBOARD_USERS_TOO_HIGH',
  );
  const runtimesPerProcess = requireMax(
    requireBoundaryInteger(
      Number(params.get('runtimesPerProcess') ?? defaults.runtimesPerProcess),
      'HLT_DASHBOARD_RUNTIMES_PER_PROCESS_INVALID',
      1,
    ),
    1_000,
    'HLT_DASHBOARD_RUNTIMES_PER_PROCESS_TOO_HIGH',
  );
  const ratePerUserPerSecond = requireMax(
    requireBoundaryInteger(
      Number(params.get('rate') ?? defaults.ratePerUserPerSecond),
      'HLT_DASHBOARD_RATE_INVALID',
      1,
    ),
    1_000,
    'HLT_DASHBOARD_RATE_TOO_HIGH',
  );
  const durationSeconds = requireMax(
    requireBoundaryInteger(
      Number(params.get('duration') ?? defaults.durationSeconds),
      'HLT_DASHBOARD_DURATION_INVALID',
      1,
    ),
    3_600,
    'HLT_DASHBOARD_DURATION_TOO_HIGH',
  );
  const paymentAmountMin = parsePositiveBigintParam(
    params.get('paymentMin'), defaults.paymentAmountMin, 'HLT_DASHBOARD_PAYMENT_AMOUNT_MIN_INVALID',
  );
  const paymentAmountMax = parsePositiveBigintParam(
    params.get('paymentMax'), defaults.paymentAmountMax, 'HLT_DASHBOARD_PAYMENT_AMOUNT_MAX_INVALID',
  );
  if (paymentAmountMax < paymentAmountMin) {
    throw new Error(`HLT_DASHBOARD_PAYMENT_AMOUNT_RANGE_INVALID:${paymentAmountMin}:${paymentAmountMax}`);
  }
  return {
    users,
    runtimesPerProcess,
    ratePerUserPerSecond,
    durationSeconds,
    mix: params.get('mix') ?? defaults.mix,
    hubs: params.get('hubs') ?? defaults.hubs,
    marketMakers: params.get('marketMakers') ?? defaults.marketMakers,
    mode: modeRaw,
    profile: profileRaw === null ? defaults.profile : profileRaw === '1' || profileRaw === 'true',
    paymentAmountMin,
    paymentAmountMax,
  };
};

const hubShareFor = (mode: HltDashboardMode, hubCount: number): HltHubShare => {
  const evenSharePct = Math.round((100 / hubCount) * 10) / 10;
  if (mode === 'cross') {
    return {
      hubCount,
      evenSharePct,
      workerSingleHubPct: hubCount >= 2 ? 0 : 100,
      workerMultiHubPct: hubCount >= 2 ? 100 : 0,
      routing: 'cross_j_path',
      note: 'Cross-j swaps traverse 2+ hubs by definition. A one-hub mesh cannot run this mode.',
    };
  }
  return {
    hubCount,
    evenSharePct,
    workerSingleHubPct: 100,
    workerMultiHubPct: 0,
    routing: 'pin_first_hub',
    note: 'Payment, same-J, and mixed workers pin hubLabels[0]. Extra labels describe mesh topology, not a traffic split.',
  };
};

const isolatedCommand = (config: HltDashboardConfig): string => {
  const mix = mixForMode(config.mode, config.mix);
  const profileVars = config.profile
    ? ['XLN_RUNTIME_PROCESS_PROFILE=1', 'XLN_ENTITY_FRAME_PROFILE=1']
    : [];
  return [
    `XLN_LOCAL_PROD_SMOKE_DIR=/tmp/xln-hlt-${config.users}`,
    `XLN_HLT_USERS=${config.users}`,
    `XLN_HLT_RUNTIMES_PER_PROCESS=${config.runtimesPerProcess}`,
    `XLN_HLT_MIX=${mix}`,
    `XLN_HLT_RATE_PER_USER=${config.ratePerUserPerSecond}`,
    `XLN_HLT_DURATION_S=${config.durationSeconds}`,
    `XLN_HLT_HUBS=${config.hubs}`,
    `XLN_HLT_MARKET_MAKERS=${config.marketMakers}`,
    `XLN_HLT_PAYMENT_AMOUNT_MIN=${config.paymentAmountMin}`,
    `XLN_HLT_PAYMENT_AMOUNT_MAX=${config.paymentAmountMax}`,
    'XLN_LOCAL_PROD_SMOKE_SWAP_LOAD_SMOKE=1',
    `XLN_LOCAL_PROD_SMOKE_SWAP_LOAD_MODE=${config.mode}`,
    ...profileVars,
    'bun core/scripts/operations/hlt/build-chains.ts',
  ].join(' \\\n');
};

export const previewHltDashboard = (config: HltDashboardConfig): HltDashboardPreview => {
  const mix = mixForMode(config.mode, config.mix);
  const plan = buildHltPlan({
    users: config.users,
    ratePerUserPerSecond: config.ratePerUserPerSecond,
    durationSeconds: config.durationSeconds,
    mix: parseHltMix(mix),
    baseTokenId: 2,
    quoteTokenId: 1,
    hubLabels: parseHltLabels(config.hubs, 'HLT_DASHBOARD_HUBS_INVALID'),
    marketMakerLabels: parseHltLabels(config.marketMakers, 'HLT_DASHBOARD_MM_INVALID'),
    paymentAmountRange: { min: config.paymentAmountMin, max: config.paymentAmountMax },
  });
  return {
    config: { ...config, mix },
    daemons: Math.ceil(config.users / config.runtimesPerProcess),
    rounds: plan.rounds,
    cadenceMs: plan.cadenceMs,
    paymentLanes: plan.paymentLanes,
    swapLanes: plan.swapLanes,
    offeredPayPerSecond: plan.offeredPaymentRatePerSecond,
    offeredSwapPerSecond: plan.offeredSwapOrderRatePerSecond,
    offeredOrderPerSecond: plan.offeredOrderRatePerSecond,
    hubShare: hubShareFor(config.mode, plan.economy.hubLabels.length),
    isolatedCommand: isolatedCommand({ ...config, mix }),
    warning: 'Smoke leases its own ports. It does not attach to the live hub-node on 8082.',
  };
};
