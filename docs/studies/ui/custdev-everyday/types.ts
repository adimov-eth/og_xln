export type SpecMode = 'baseline' | 'refined';

export type PhantomCategory =
  | 'unknown_action'
  | 'validation'
  | 'eval'
  | 'parse'
  | 'runtime'
  | 'timeout';

export const PHANTOM_CATEGORIES: readonly PhantomCategory[] = [
  'unknown_action',
  'validation',
  'eval',
  'parse',
  'runtime',
  'timeout',
] as const;

export type ScenarioId =
  | 'E1a_pay_across_buckets'
  | 'E1b_pay_fee_above_cap'
  | 'E1c_pay_l1_reject_reload'
  | 'E2_friends_split_and_settle'
  | 'E3a_newcomer_arriving_and_request'
  | 'E3b_offline_hub_keeps_arriving'
  | 'E4_savings_optin_consent'
  | 'E5a_external_checkout_approve'
  | 'E5b_external_bait_reject'
  | 'E6_offline_recovery_zero_gas';

export interface PeerTabState {
  id: string;
  label: string;
  isHub: boolean;
  /** Positive means peer owes user; negative means user owes peer (micro-USD). */
  signedMicroUsd: bigint;
  peerCreditLimitMicroUsd: bigint;
  ownCreditLimitMicroUsd: bigint;
  note?: string;
}

export interface ExternalRequestItem {
  id: string;
  kind: 'cash-spend' | 'open-friend-tab' | 'savings-deposit' | 'escalate-pro';
  origin: string;
  appClaim: string;
  counterparty: string;
  amountMicroUsd: bigint;
  feeMicroUsd: bigint;
  creditLimitDeltaMicroUsd: bigint;
  unbackedDeltaMicroUsd: bigint;
  expiry: string;
  status: 'pending' | 'approved' | 'rejected';
}

export interface ActivityEntry {
  id: string;
  summary: string;
  kind: 'payment' | 'split' | 'settle' | 'savings' | 'arriving' | 'recovery' | 'request';
  amountMicroUsd: bigint;
}

export interface RequestLinkItem {
  id: string;
  recipientHint: string;
  amountMicroUsd: bigint;
  note: string;
  url: string;
}

export interface WalletFixtureState {
  specMode: SpecMode;
  onchainMicroUsd: bigint;
  reserveMicroUsd: bigint;
  securedMicroUsd: bigint;
  arrivingMicroUsd: bigint;
  savingsMicroUsd: bigint;
  savingsApy: string;
  savingsRiskConsented: boolean;
  maxFeeMicroUsd: bigint;
  quotedFeeMicroUsd: bigint;
  autoSettleFeeMicroUsd: bigint;
  hubOnline: boolean;
  l1SweepBehavior: 'succeed' | 'reject';
  nativeGasWei: bigint;
  disputeActive: boolean;
  disputeStartedByUs: boolean;
  towerEnrolled: boolean;
  backupExported: boolean;
  reloadedAfterFailure: boolean;
  l1SweepAttempted: boolean;
  peers: PeerTabState[];
  externalRequests: ExternalRequestItem[];
  requestLinks: RequestLinkItem[];
  activity: ActivityEntry[];
}

export interface ToolCallInput {
  tool: string;
  intent?: unknown;
  args: Record<string, unknown>;
  rawText?: string;
}

export interface ToolOutcome {
  success: boolean;
  data?: unknown;
  error?: string;
  phantomCategory?: PhantomCategory;
}

export interface PhantomRecord {
  episodeId: string;
  scenarioId: ScenarioId;
  modelId: string;
  lineage: string;
  specMode: SpecMode;
  turn: number;
  tool: string;
  actionOrExpr: string;
  intent: string;
  category: PhantomCategory;
  error: string;
}

export interface TraceRecord {
  turn: number;
  tool: string;
  intent: string;
  args: Record<string, unknown>;
  outcome: ToolOutcome;
  latencyMs: number;
  definesRecorded: string[];
}

export interface PostMortemRecord {
  prompt: string;
  response: string;
  latencyMs: number;
}

export interface ComprehensionScore {
  passed: boolean;
  checks: Record<string, boolean>;
  rawAnswers: string;
}

export interface EpisodeResult {
  episodeId: string;
  scenarioId: ScenarioId;
  modelId: string;
  lineage: string;
  specMode: SpecMode;
  passed: boolean;
  statePassed: boolean;
  comprehension: ComprehensionScore;
  turns: number;
  phantoms: PhantomRecord[];
  defines: string[];
  traces: TraceRecord[];
  postMortem?: PostMortemRecord;
  transportError?: string;
  durationMs: number;
  finalSummary: string;
}

export interface SurfaceTermSpec {
  text: string;
  note: string | null;
  noteWhen: string;
}

export interface SurfaceScreenSpec {
  id: string;
  purpose: string;
  headline: string;
  figures: string[];
  actions: string[];
  maxWords: number;
}

export interface SurfaceFlowSpec {
  id: string;
  verb: string;
  before: string;
  pending: string;
  done: string;
  failed: string;
}

export interface SurfaceAutopilotSpec {
  id: string;
  verbs: string[];
  trigger: string;
  behavior: string;
  recoveryNote: string;
}

export interface LoadedSurfaceSpec {
  mode: SpecMode;
  terms: Record<string, SurfaceTermSpec>;
  screens: Record<string, SurfaceScreenSpec>;
  flows: Record<string, SurfaceFlowSpec>;
  autopilots: Record<string, SurfaceAutopilotSpec>;
  defaults: Array<{ id: string; value: string; riskBearer: string; consent: string }>;
  figures: Record<string, { id: string; term: string; meaning: string; source: string }>;
  sheets: {
    inline: { delivery: string; shows: string[]; feeBefore: boolean; warns: string[] };
    external: { delivery: string; shows: string[]; feeBefore: boolean; survival: string | null; warns: string[] };
  };
  supportedActions: Set<string>;
}

export type DriverProtocol = 'native-tools' | 'json-turn';
export type DriverLane = 'hermes' | 'claude-cli' | 'grok-cli' | 'scripted';

export interface DriverMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  tool_call_id?: string;
  name?: string;
  tool_calls?: Array<{
    id: string;
    type: 'function';
    function: { name: string; arguments: string };
  }>;
}

export interface DriverToolCall {
  id: string;
  name: string;
  argumentsRaw: string;
  parsedArgs?: Record<string, unknown>;
  parseError?: string;
}

export type DriverTurnResult =
  | {
      kind: 'tool_calls';
      calls: DriverToolCall[];
      assistantMessage: DriverMessage;
      latencyMs: number;
    }
  | {
      kind: 'text';
      text: string;
      latencyMs: number;
    };

export interface ModelDriver {
  id: string;
  lineage: string;
  lane: DriverLane;
  protocol: DriverProtocol;
  tier: 'fast' | 'frontier' | 'dry';
  nextTurn: (params: {
    systemPrompt: string;
    messages: DriverMessage[];
    tools?: unknown[];
    expectJsonAction: boolean;
  }) => Promise<DriverTurnResult>;
}
