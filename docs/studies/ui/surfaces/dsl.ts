// Frozen v2 Arrival DSL for xln Wallet Kernel, Signing Sheets, Surfaces, XLN Programs, Stories & Forks.
// Arrival is used strictly as a compact declarative specification language (zero runtime UI dependency).

import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { resolve } from 'node:path';

type ArrivalModule = typeof import('@here.build/arrival');

async function loadArrival(): Promise<ArrivalModule> {
  const candidates = [
    process.env.ARRIVAL_DIST,
    '@here.build/arrival',
    '@inhuman.tools/arrival',
    resolve(homedir(), 'inhuman/arrival/packages/arrival/dist/index.js'),
    resolve(homedir(), 'desk/node_modules/@inhuman.tools/arrival/dist/index.js'),
  ].filter((entry): entry is string => Boolean(entry));

  for (const spec of candidates) {
    if (spec.startsWith('/') && !existsSync(spec)) continue;
    try {
      return (await import(spec)) as ArrivalModule;
    } catch {
      continue;
    }
  }
  throw new Error(
    'ARRIVAL_NOT_FOUND: install @here.build/arrival or set ARRIVAL_DIST=/path/to/arrival/dist/index.js',
  );
}

export const arrival = await loadArrival();
const { EnvCapability } = arrival;

export type ClaimBasis = 'as-is' | 'cited-code' | 'canon' | 'sweep' | 'person' | 'guess' | 'undecided';

export interface Claim {
  kind: 'claim';
  basis: ClaimBasis;
  ref: string;
  text: string;
}

export interface TermCopy {
  kind: 'term-copy';
  label: Claim;
  note?: Claim;
  noteWhen: 'always' | 'non-zero';
}

export type StateId = 'empty' | 'uncovered' | 'partlyCovered' | 'disputed';

export interface StateSnapshot {
  secured: number;
  risk: number;
  owed: number;
  onchain: number;
  reserve: number;
  disputed: boolean;
  hubs: number;
}

export const CANONICAL_STATES: Record<StateId, StateSnapshot> = {
  empty: { secured: 0, risk: 0, owed: 0, onchain: 0, reserve: 0, disputed: false, hubs: 0 },
  uncovered: { secured: 0, risk: 100, owed: 0, onchain: 0, reserve: 0, disputed: false, hubs: 1 },
  partlyCovered: { secured: 45, risk: 55, owed: 0, onchain: 10, reserve: 0, disputed: false, hubs: 1 },
  disputed: { secured: 45, risk: 55, owed: 0, onchain: 0, reserve: 0, disputed: true, hubs: 1 },
};

const ALL_VISIBLE: Record<StateId, boolean> = {
  empty: true,
  uncovered: true,
  partlyCovered: true,
  disputed: true,
};

export const SIGNING_SHOW_FIELDS = [
  'human-summary',
  'delta-secured',
  'delta-unbacked-risk',
  'delta-credit-limit',
  'delta-owed',
  'fee-exact',
  'fee-ceiling',
  'counterparty',
  'expiry-deadline',
  'program-origin',
] as const;

export const KERNEL_ONLY_VERBS = new Set([
  'unilateral-exit',
  'finalize-dispute',
  'export-backup',
  'reset-testnet',
]);

export const PLUMBING_VERBS = new Set([
  'move-r2c',
  'move-r2r',
  'rebalance-policy',
  'request-cover',
  'set-hub-credit',
  'set-bank-rates',
  'propose-multisig',
  'vote-multisig',
]);

export const CREDIT_RISK_VERBS = new Set([
  'extend-peer-tab',
  'set-hub-credit',
  'deposit-savings',
]);

export const uiSpecCapability = EnvCapability.define('xln/ui-spec', {
  symbols: (symbol, z) => {
    const lit = <const S extends string>(value: S) =>
      z.codec(z.string, z.literal(value), {
        decode: () => value,
        encode: s => s,
      });

    const choice = <const T extends readonly [string, ...string[]]>(values: T) =>
      z.codec(z.foldName, z.enum(values), {
        decode: s => s as T[number],
        encode: s => s,
      });

    const StateSchema = z.dict({
      secured: z.integer,
      risk: z.integer,
      owed: z.integer,
      onchain: z.integer,
      reserve: z.integer,
      disputed: z.boolean,
      hubs: z.integer,
    });

    const VisibleInSchema = z.dict({
      empty: z.boolean,
      uncovered: z.boolean,
      partlyCovered: z.boolean,
      disputed: z.boolean,
    });

    const ClaimSchema = z.dict({
      kind: lit('claim'),
      basis: choice(['as-is', 'cited-code', 'canon', 'sweep', 'person', 'guess', 'undecided']),
      ref: z.string,
      text: z.string,
    });

    const TermCopySchema = z.dict({
      kind: lit('term-copy'),
      label: ClaimSchema,
      note: ClaimSchema.optional(),
      noteWhen: choice(['always', 'non-zero']),
    });

    const TermInputSchema = z.union([ClaimSchema, TermCopySchema]);

    const FigureSchema = z.dict({
      kind: lit('figure'),
      id: z.string,
      term: z.string,
      meaning: ClaimSchema,
      source: z.string,
    });

    const VerbSchema = z.dict({
      kind: lit('verb'),
      id: z.string,
      layer: choice(['entity', 'account', 'local']),
      tx: z.string,
      summary: ClaimSchema,
    });

    const LegacyScreenSchema = z.dict({
      kind: lit('legacy-screen'),
      file: z.string,
      disposition: choice(['keep', 'split', 'move', 'shared-shell', 'unavailable']),
      into: z.vector(z.foldName),
      why: ClaimSchema,
      sources: z.vector(z.string),
    });

    const DefaultRuleSchema = z.dict({
      kind: lit('default-rule'),
      id: z.string,
      value: z.string,
      riskBearer: choice(['user', 'peer', 'none']),
      consent: ClaimSchema,
      why: ClaimSchema,
      sources: z.vector(z.string),
    });

    const ScreenSchema = z.dict({
      kind: lit('screen'),
      id: z.string,
      purpose: ClaimSchema,
      headline: z.string,
      figures: z.vector(z.foldName),
      bars: z.vector(z.foldName),
      actions: z.vector(z.foldName),
      mode: choice(['always', 'pro-only', 'personal-only']),
      visibleIn: VisibleInSchema,
      maxWords: z.integer,
      why: ClaimSchema.optional(),
      sources: z.vector(z.string),
    });

    const FlowSchema = z.dict({
      kind: lit('flow'),
      id: z.string,
      verb: z.string,
      before: ClaimSchema,
      pending: ClaimSchema,
      done: ClaimSchema,
      failed: ClaimSchema,
      why: ClaimSchema.optional(),
      sources: z.vector(z.string),
    });

    const AutopilotSchema = z.dict({
      kind: lit('autopilot'),
      id: z.string,
      verbs: z.vector(z.foldName),
      trigger: ClaimSchema,
      behavior: ClaimSchema,
      fallback: ClaimSchema,
      sources: z.vector(z.string),
    });

    const SurfaceSchema = z.dict({
      kind: lit('surface'),
      id: z.string,
      posture: choice(['human-everyday', 'operator-desk', 'legacy-bucket-baseline']),
      who: ClaimSchema,
      entry: z.string,
      modes: z.vector(z.foldName),
      terms: z.dictRecord(z.foldName, TermCopySchema),
      defaults: z.vector(DefaultRuleSchema),
      autopilots: z.vector(AutopilotSchema),
      screens: z.vector(ScreenSchema),
      flows: z.vector(FlowSchema),
      doors: z.vector(z.foldName),
      why: ClaimSchema,
      sources: z.vector(z.string),
    });

    const SigningSheetSchema = z.dict({
      kind: lit('signing-sheet'),
      id: z.string,
      delivery: choice(['inline-quiet', 'interrupt-sheet']),
      covers: z.vector(z.foldName),
      shows: z.vector(choice(SIGNING_SHOW_FIELDS)),
      feeBefore: z.boolean,
      survival: ClaimSchema.optional(),
      warns: z.vector(ClaimSchema),
      why: ClaimSchema,
      sources: z.vector(z.string),
    });

    const StorySchema = z.dict({
      kind: lit('story'),
      id: z.string,
      surface: z.string,
      given: choice(['empty', 'uncovered', 'partlyCovered', 'disputed']),
      steps: z.vector(z.foldName),
      outcome: ClaimSchema,
      why: ClaimSchema,
      sources: z.vector(z.string),
    });

    const XlnAppSchema = z.dict({
      kind: lit('xln-app'),
      id: z.string,
      appKind: choice(['embedded', 'external', 'steward', 'hostile-test']),
      render: choice(['fixed', 'generative']),
      audience: ClaimSchema,
      reads: z.vector(z.foldName),
      requests: z.vector(z.foldName),
      claimShown: ClaimSchema,
      flows: z.vector(FlowSchema),
      screens: z.vector(ScreenSchema),
      why: ClaimSchema,
      sources: z.vector(z.string),
    });

    const ForkSchema = z.dict({
      kind: lit('fork'),
      id: z.string,
      status: choice(['open', 'closed']),
      decider: choice(['maintainer', 'person', 'measurement', 'code']),
      question: z.string,
      affects: z.vector(z.foldName),
      options: z.dictRecord(z.foldName, z.string),
      current: z.string,
      why: ClaimSchema,
      sources: z.vector(z.string),
      closedBy: z.string.optional(),
      evidence: ClaimSchema.optional(),
    });

    const CritiqueSchema = z.dict({
      kind: lit('critique'),
      id: z.string,
      author: z.string,
      target: z.string,
      stance: choice(['agree', 'object', 'amend']),
      why: ClaimSchema,
      sources: z.vector(z.string),
    });

    const claim = (basis: ClaimBasis, ref: string, text: string): Claim => ({
      kind: 'claim',
      basis,
      ref,
      text,
    });

    const normalizeTerm = (entry: Claim | TermCopy): TermCopy =>
      entry.kind === 'term-copy'
        ? entry
        : { kind: 'term-copy', label: entry, noteWhen: 'always' };

    return {
      // ── Epistemic Provenance Wrappers ──────────────────────────────────────
      'as-is': symbol.rosetta`as-is: Verbatim string verified against the exact cited source file`(
        { input: [z.string, z.string], output: [ClaimSchema], provenance: 'source' },
        (ref, text) => claim('as-is', ref, text),
      ),
      'from-code': symbol.rosetta`from-code: Prose claim citing an existing source path (path verified, prose unproved)`(
        { input: [z.string, z.string], output: [ClaimSchema], provenance: 'source' },
        (ref, text) => claim('cited-code', ref, text),
      ),
      canon: symbol.rosetta`canon: Claim grounded in an explicit repository rule or scope doc`(
        { input: [z.string, z.string], output: [ClaimSchema], provenance: 'source' },
        (ref, text) => claim('canon', ref, text),
      ),
      sweep: symbol.rosetta`sweep: Claim backed by an empirical model/custdev sweep log`(
        { input: [z.string, z.string], output: [ClaimSchema], provenance: 'source' },
        (ref, text) => claim('sweep', ref, text),
      ),
      person: symbol.rosetta`person: Claim backed by an unbriefed human participant observation`(
        { input: [z.string, z.string], output: [ClaimSchema], provenance: 'source' },
        (ref, text) => claim('person', ref, text),
      ),
      guess: symbol.rosetta`guess: Unverified design proposal or strawman wording open to challenge`(
        { input: [z.string], output: [ClaimSchema], provenance: 'source' },
        text => claim('guess', '', text),
      ),
      undecided: symbol.rosetta`undecided: Open slot explicitly deferred to a named fork`(
        { input: [z.foldName], output: [ClaimSchema], provenance: 'source' },
        forkId => claim('undecided', forkId, ''),
      ),
      'term-copy': symbol.rosetta`term-copy: Pair a primary term label with an optional explanatory subtitle/note`(
        {
          input: [],
          inputRest: {
            label: ClaimSchema,
            note: ClaimSchema.optional(),
            'note-when': choice(['always', 'non-zero']).optional(),
          },
          output: [TermCopySchema],
          provenance: 'pipe',
        },
        kw => ({
          kind: 'term-copy' as const,
          label: kw.label,
          ...(kw.note ? { note: kw.note } : {}),
          noteWhen: kw['note-when'] ?? 'always',
        }),
      ),

      // ── Base Domain Vocabulary ─────────────────────────────────────────────
      figure: symbol.rosetta`figure: Canonical number or view slice bound to a real runtime projection and term key`(
        {
          input: [z.foldName],
          inputRest: { term: z.foldName, meaning: ClaimSchema, source: z.string },
          output: [FigureSchema],
          provenance: 'pipe',
        },
        (id, kw) => ({ kind: 'figure' as const, id, term: kw.term, meaning: kw.meaning, source: kw.source }),
      ),
      verb: symbol.rosetta`verb: Canonical user/operator capability bound to an EntityTx, AccountTx, or local wallet op`(
        {
          input: [z.foldName],
          inputRest: {
            layer: choice(['entity', 'account', 'local']),
            tx: z.string,
            summary: ClaimSchema,
          },
          output: [VerbSchema],
          provenance: 'pipe',
        },
        (id, kw) => ({ kind: 'verb' as const, id, layer: kw.layer, tx: kw.tx, summary: kw.summary }),
      ),
      'legacy-screen': symbol.rosetta`legacy-screen: Map a file in ui/src/screens/*.tsx to its target surface disposition`(
        {
          input: [z.string],
          inputRest: {
            disposition: choice(['keep', 'split', 'move', 'shared-shell', 'unavailable']),
            into: z.vector(z.foldName),
            why: ClaimSchema,
            sources: z.vector(z.string).optional(),
          },
          output: [LegacyScreenSchema],
          provenance: 'pipe',
        },
        (file, kw) => ({
          kind: 'legacy-screen' as const,
          file,
          disposition: kw.disposition,
          into: kw.into,
          why: kw.why,
          sources: kw.sources ?? [],
        }),
      ),

      // ── Wallet Consent, Autopilot, Surfaces, Screens, Flows & XLN Programs ──
      'signing-sheet': symbol.rosetta`signing-sheet: Inline first-party preview or external/risk-crossing consent sheet`(
        {
          input: [z.foldName],
          inputRest: {
            delivery: choice(['inline-quiet', 'interrupt-sheet']).optional(),
            covers: z.vector(z.foldName),
            shows: z.vector(choice(SIGNING_SHOW_FIELDS)),
            'fee-before': z.boolean,
            survival: ClaimSchema.optional(),
            warns: z.vector(ClaimSchema).optional(),
            why: ClaimSchema,
            sources: z.vector(z.string),
          },
          output: [SigningSheetSchema],
          provenance: 'pipe',
        },
        (id, kw) => ({
          kind: 'signing-sheet' as const,
          id,
          delivery: kw.delivery ?? 'interrupt-sheet',
          covers: kw.covers,
          shows: kw.shows,
          feeBefore: kw['fee-before'],
          ...(kw.survival ? { survival: kw.survival } : {}),
          warns: kw.warns ?? [],
          why: kw.why,
          sources: kw.sources,
        }),
      ),
      autopilot: symbol.rosetta`autopilot: Invisible background wallet policy absorbing protocol plumbing for reliability`(
        {
          input: [z.foldName],
          inputRest: {
            verbs: z.vector(z.foldName),
            trigger: ClaimSchema,
            behavior: ClaimSchema,
            fallback: ClaimSchema,
            sources: z.vector(z.string).optional(),
          },
          output: [AutopilotSchema],
          provenance: 'pipe',
        },
        (id, kw) => ({
          kind: 'autopilot' as const,
          id,
          verbs: kw.verbs,
          trigger: kw.trigger,
          behavior: kw.behavior,
          fallback: kw.fallback,
          sources: kw.sources ?? [],
        }),
      ),
      'default-rule': symbol.rosetta`default-rule: Risk-bearing or UX default and its consent surface`(
        {
          input: [z.foldName],
          inputRest: {
            value: z.string,
            'risk-bearer': choice(['user', 'peer', 'none']),
            consent: ClaimSchema,
            why: ClaimSchema,
            sources: z.vector(z.string).optional(),
          },
          output: [DefaultRuleSchema],
          provenance: 'pipe',
        },
        (id, kw) => ({
          kind: 'default-rule' as const,
          id,
          value: kw.value,
          riskBearer: kw['risk-bearer'],
          consent: kw.consent,
          why: kw.why,
          sources: kw.sources ?? [],
        }),
      ),
      screen: symbol.rosetta`screen: One navigable screen in a surface or XLN Program with optional state predicate`(
        {
          input: [z.foldName],
          inputRest: {
            purpose: ClaimSchema,
            headline: z.foldName,
            figures: z.vector(z.foldName),
            bars: z.vector(z.foldName).optional(),
            actions: z.vector(z.foldName),
            mode: choice(['always', 'pro-only', 'personal-only']).optional(),
            when: z.procedure(StateSchema, z.boolean).optional(),
            'max-words': z.integer.optional(),
            why: ClaimSchema.optional(),
            sources: z.vector(z.string).optional(),
          },
          output: [ScreenSchema],
          provenance: 'pipe',
        },
        async (id, kw) => {
          let visibleIn: Record<StateId, boolean> = ALL_VISIBLE;
          if (kw.when) {
            visibleIn = {
              empty: Boolean(await kw.when(CANONICAL_STATES.empty)),
              uncovered: Boolean(await kw.when(CANONICAL_STATES.uncovered)),
              partlyCovered: Boolean(await kw.when(CANONICAL_STATES.partlyCovered)),
              disputed: Boolean(await kw.when(CANONICAL_STATES.disputed)),
            };
          }
          return {
            kind: 'screen' as const,
            id,
            purpose: kw.purpose,
            headline: kw.headline,
            figures: kw.figures,
            bars: kw.bars ?? [],
            actions: kw.actions,
            mode: kw.mode ?? 'always',
            visibleIn,
            maxWords: kw['max-words'] ?? 45,
            ...(kw.why ? { why: kw.why } : {}),
            sources: kw.sources ?? [],
          };
        },
      ),
      flow: symbol.rosetta`flow: 4-phase action lifecycle bound to a canonical base verb`(
        {
          input: [z.foldName],
          inputRest: {
            verb: z.foldName,
            before: ClaimSchema,
            pending: ClaimSchema,
            done: ClaimSchema,
            failed: ClaimSchema,
            why: ClaimSchema.optional(),
            sources: z.vector(z.string).optional(),
          },
          output: [FlowSchema],
          provenance: 'pipe',
        },
        (id, kw) => ({
          kind: 'flow' as const,
          id,
          verb: kw.verb,
          before: kw.before,
          pending: kw.pending,
          done: kw.done,
          failed: kw.failed,
          ...(kw.why ? { why: kw.why } : {}),
          sources: kw.sources ?? [],
        }),
      ),
      surface: symbol.rosetta`surface: Complete Wallet surface definition over shared xln base vocabulary`(
        {
          input: [z.foldName],
          inputRest: {
            posture: choice(['human-everyday', 'operator-desk', 'legacy-bucket-baseline']).optional(),
            who: ClaimSchema,
            entry: z.foldName,
            modes: z.vector(z.foldName).optional(),
            terms: z.dictRecord(z.foldName, TermInputSchema),
            defaults: z.vector(DefaultRuleSchema),
            autopilots: z.vector(AutopilotSchema).optional(),
            screens: z.vector(ScreenSchema),
            flows: z.vector(FlowSchema),
            doors: z.vector(z.foldName),
            why: ClaimSchema,
            sources: z.vector(z.string).optional(),
          },
          output: [SurfaceSchema],
          provenance: 'pipe',
        },
        (id, kw) => ({
          kind: 'surface' as const,
          id,
          posture: kw.posture ?? 'legacy-bucket-baseline',
          who: kw.who,
          entry: kw.entry,
          modes: kw.modes ?? ['always'],
          terms: Object.fromEntries(
            Object.entries(kw.terms).map(([k, v]) => [k, normalizeTerm(v)]),
          ),
          defaults: kw.defaults,
          autopilots: kw.autopilots ?? [],
          screens: kw.screens,
          flows: kw.flows,
          doors: kw.doors,
          why: kw.why,
          sources: kw.sources ?? [],
        }),
      ),
      'xln-app': symbol.rosetta`xln-app: Client XLN Program proposing intents to the Wallet Kernel signing sheet`(
        {
          input: [z.foldName],
          inputRest: {
            kind: choice(['embedded', 'external', 'steward', 'hostile-test']),
            render: choice(['fixed', 'generative']).optional(),
            audience: ClaimSchema,
            reads: z.vector(z.foldName),
            requests: z.vector(z.foldName),
            'claim-shown': ClaimSchema,
            screens: z.vector(ScreenSchema).optional(),
            flows: z.vector(FlowSchema).optional(),
            why: ClaimSchema,
            sources: z.vector(z.string),
          },
          output: [XlnAppSchema],
          provenance: 'pipe',
        },
        (id, kw) => ({
          kind: 'xln-app' as const,
          id,
          appKind: kw.kind,
          render: kw.render ?? 'fixed',
          audience: kw.audience,
          reads: kw.reads,
          requests: kw.requests,
          claimShown: kw['claim-shown'],
          screens: kw.screens ?? [],
          flows: kw.flows ?? [],
          why: kw.why,
          sources: kw.sources,
        }),
      ),
      story: symbol.rosetta`story: User journey linking starting state, ordered screen/flow steps, outcome, and rationale`(
        {
          input: [z.foldName],
          inputRest: {
            surface: z.foldName,
            given: choice(['empty', 'uncovered', 'partlyCovered', 'disputed']),
            steps: z.vector(z.foldName),
            outcome: ClaimSchema,
            why: ClaimSchema,
            sources: z.vector(z.string),
          },
          output: [StorySchema],
          provenance: 'pipe',
        },
        (id, kw) => ({
          kind: 'story' as const,
          id,
          surface: kw.surface,
          given: kw.given,
          steps: kw.steps,
          outcome: kw.outcome,
          why: kw.why,
          sources: kw.sources,
        }),
      ),

      // ── Forks & Multi-Round Critiques ──────────────────────────────────────
      fork: symbol.rosetta`fork: Explicit unresolved or evidence-closed design choice`(
        {
          input: [z.foldName],
          inputRest: {
            status: choice(['open', 'closed']),
            decider: choice(['maintainer', 'person', 'measurement', 'code']),
            question: z.string,
            affects: z.vector(z.foldName),
            options: z.dictRecord(z.foldName, z.string),
            current: z.foldName,
            why: ClaimSchema,
            sources: z.vector(z.string),
            'closed-by': z.string.optional(),
            evidence: ClaimSchema.optional(),
          },
          output: [ForkSchema],
          provenance: 'pipe',
        },
        (id, kw) => ({
          kind: 'fork' as const,
          id,
          status: kw.status,
          decider: kw.decider,
          question: kw.question,
          affects: kw.affects,
          options: kw.options,
          current: kw.current,
          why: kw.why,
          sources: kw.sources,
          ...(kw['closed-by'] ? { closedBy: kw['closed-by'] } : {}),
          ...(kw.evidence ? { evidence: kw.evidence } : {}),
        }),
      ),
      critique: symbol.rosetta`critique: Per-agent round feedback addressing a specific node id`(
        {
          input: [z.foldName],
          inputRest: {
            author: z.string,
            target: z.foldName,
            stance: choice(['agree', 'object', 'amend']),
            why: ClaimSchema,
            sources: z.vector(z.string),
          },
          output: [CritiqueSchema],
          provenance: 'pipe',
        },
        (id, kw) => ({
          kind: 'critique' as const,
          id,
          author: kw.author,
          target: kw.target,
          stance: kw.stance,
          why: kw.why,
          sources: kw.sources,
        }),
      ),
    };
  },
});
