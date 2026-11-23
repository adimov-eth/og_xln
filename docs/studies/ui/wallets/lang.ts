// Arrival vocabulary for designing xln wallets from scratch.
// Decisions come first. Structure (surfaces, screens, flows, kernel, apps) must name the
// decisions it follows from. The only ground is the protocol, repository canon, and what the
// people who own the direction said. Nothing here may bind to an existing wallet's source.

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
  throw new Error('ARRIVAL_NOT_FOUND: install @here.build/arrival or set ARRIVAL_DIST');
}

export const arrival = await loadArrival();
const { EnvCapability } = arrival;

export type Basis = 'guess' | 'protocol' | 'canon' | 'evidence' | 'said';
export interface Claim { kind: 'claim'; basis: Basis; ref: string; text: string }

export const DECIDERS = ['user', 'maintainer', 'person-evidence', 'protocol'] as const;
export const RISK_ON = ['holder', 'counterparty', 'nobody'] as const;
export const STANCES = ['accept', 'reject', 'amend'] as const;

export interface Figure { kind: 'figure'; id: string; core: string; means: Claim }
export interface Tx { kind: 'tx'; id: string; core: string; does: Claim }
export interface Law { kind: 'law'; id: string; source: string; quote: string; means: string }
export interface Constraint { kind: 'constraint'; id: string; source: string; quote: string; binds: string }
export interface Said { kind: 'said'; id: string; who: string; on: string; quote: string; takenAs: string }
export interface Job { kind: 'job'; id: string; wants: Claim }
export interface Person { kind: 'person'; id: string; is: Claim; cameFor: Claim; cannot: Claim[]; jobs: Job[] }
export interface Decision {
  kind: 'decision'; id: string; question: string; options: Record<string, string>;
  forces: Record<string, string[]>; depends: string[]; decider: (typeof DECIDERS)[number];
  leaning: string; because: Claim; changesIf: string; status: 'open' | 'settled'; settledBy?: string;
}
export interface Surface { kind: 'surface'; id: string; for: string; first: string; because: string[] }
export interface Screen { kind: 'screen'; id: string; in: string; answers: string; shows: string[]; offers: string[]; because: string[] }
export interface Flow { kind: 'flow'; id: string; in: string; job?: string; signs: string[]; uses: string[]; ends: Claim; because: string[] }
export interface Need { kind: 'need'; id: string; of: string; wants: Claim; because: string[] }
export interface Capability { kind: 'capability'; id: string; gives: Claim; meets: string[]; signs: string[]; because: string[] }
export interface App { kind: 'app'; id: string; for: string[]; through: string[]; does: Claim; because: string[] }
export interface Default { kind: 'default'; id: string; in: string; value: string; riskOn: (typeof RISK_ON)[number]; because: string[] }
export interface Gap { kind: 'gap'; id: string; job: string; why: Claim }
export interface Position { kind: 'position'; id: string; by: string; on: string; for: string; because: Claim }
export interface Objection { kind: 'objection'; id: string; by: string; to: string; lens: string; claim: Claim }
export interface Reply { kind: 'reply'; id: string; by: string; to: string; stance: (typeof STANCES)[number]; because: Claim }

export type Node =
  | Figure | Tx | Law | Constraint | Said | Person | Decision | Surface | Screen | Flow
  | Need | Capability | App | Default | Gap | Position | Objection | Reply;

export const walletDesign = EnvCapability.define('xln/wallet-design', {
  symbols: (symbol, z) => {
    const lit = <const S extends string>(value: S) =>
      z.codec(z.string, z.literal(value), { decode: () => value, encode: s => s });
    const choice = <const T extends readonly [string, ...string[]]>(values: T) =>
      z.codec(z.foldName, z.enum(values), { decode: s => s as T[number], encode: s => s });
    const ids = z.vector(z.foldName);

    const ClaimSchema = z.dict({
      kind: lit('claim'),
      basis: choice(['guess', 'protocol', 'canon', 'evidence', 'said']),
      ref: z.string,
      text: z.string,
    });
    const JobSchema = z.dict({ kind: lit('job'), id: z.string, wants: ClaimSchema });
    const S = {
      figure: z.dict({ kind: lit('figure'), id: z.string, core: z.string, means: ClaimSchema }),
      tx: z.dict({ kind: lit('tx'), id: z.string, core: z.string, does: ClaimSchema }),
      law: z.dict({ kind: lit('law'), id: z.string, source: z.string, quote: z.string, means: z.string }),
      constraint: z.dict({ kind: lit('constraint'), id: z.string, source: z.string, quote: z.string, binds: z.string }),
      said: z.dict({ kind: lit('said'), id: z.string, who: z.string, on: z.string, quote: z.string, takenAs: z.string }),
      person: z.dict({ kind: lit('person'), id: z.string, is: ClaimSchema, cameFor: ClaimSchema, cannot: z.vector(ClaimSchema), jobs: z.vector(JobSchema) }),
      decision: z.dict({
        kind: lit('decision'), id: z.string, question: z.string, options: z.dictRecord(z.foldName, z.string),
        forces: z.dictRecord(z.foldName, ids), depends: ids, decider: choice(DECIDERS), leaning: z.string,
        because: ClaimSchema, changesIf: z.string, status: choice(['open', 'settled']), settledBy: z.string.optional(),
      }),
      surface: z.dict({ kind: lit('surface'), id: z.string, for: z.string, first: z.string, because: ids }),
      screen: z.dict({ kind: lit('screen'), id: z.string, in: z.string, answers: z.string, shows: ids, offers: ids, because: ids }),
      flow: z.dict({ kind: lit('flow'), id: z.string, in: z.string, job: z.string.optional(), signs: ids, uses: ids, ends: ClaimSchema, because: ids }),
      need: z.dict({ kind: lit('need'), id: z.string, of: z.string, wants: ClaimSchema, because: ids }),
      capability: z.dict({ kind: lit('capability'), id: z.string, gives: ClaimSchema, meets: ids, signs: ids, because: ids }),
      app: z.dict({ kind: lit('app'), id: z.string, for: ids, through: ids, does: ClaimSchema, because: ids }),
      default: z.dict({ kind: lit('default'), id: z.string, in: z.string, value: z.string, riskOn: choice(RISK_ON), because: ids }),
      gap: z.dict({ kind: lit('gap'), id: z.string, job: z.string, why: ClaimSchema }),
      position: z.dict({ kind: lit('position'), id: z.string, by: z.string, on: z.string, for: z.string, because: ClaimSchema }),
      objection: z.dict({ kind: lit('objection'), id: z.string, by: z.string, to: z.string, lens: z.string, claim: ClaimSchema }),
      reply: z.dict({ kind: lit('reply'), id: z.string, by: z.string, to: z.string, stance: choice(STANCES), because: ClaimSchema }),
    };
    const node = (kind: keyof typeof S) => S[kind];
    const claim = (basis: Basis, ref: string, text: string): Claim => ({ kind: 'claim', basis, ref, text });

    return {
      // ── What a sentence rests on ───────────────────────────────────────────
      guess: symbol.rosetta`guess: A proposal nobody has checked`(
        { input: [z.string], output: [ClaimSchema], provenance: 'source' },
        text => claim('guess', '', text),
      ),
      protocol: symbol.rosetta`protocol: A claim about what the protocol does, citing a path under core/, jurisdictions/ or docs/core/`(
        { input: [z.string, z.string], output: [ClaimSchema], provenance: 'source' },
        (ref, text) => claim('protocol', ref, text),
      ),
      canon: symbol.rosetta`canon: A claim resting on a constraint or law declared in this spec, by id`(
        { input: [z.foldName, z.string], output: [ClaimSchema], provenance: 'source' },
        (ref, text) => claim('canon', ref, text),
      ),
      evidence: symbol.rosetta`evidence: A claim resting on a recorded observation under docs/studies/ or docs/evidence/`(
        { input: [z.string, z.string], output: [ClaimSchema], provenance: 'source' },
        (ref, text) => claim('evidence', ref, text),
      ),
      'as-said': symbol.rosetta`as-said: A claim resting on a (said ...) form in this spec, by id`(
        { input: [z.foldName, z.string], output: [ClaimSchema], provenance: 'source' },
        (ref, text) => claim('said', ref, text),
      ),

      // ── Ground: the protocol, the rules, the direction ─────────────────────
      figure: symbol.rosetta`figure: A number the protocol can state, bound to a field of a core type`(
        { input: [z.foldName], inputRest: { core: z.string, means: ClaimSchema }, output: [node('figure')], provenance: 'pipe' },
        (id, kw) => ({ kind: 'figure' as const, id, core: kw.core, means: kw.means }),
      ),
      tx: symbol.rosetta`tx: A transaction the protocol accepts, bound to a core transaction type`(
        { input: [z.foldName], inputRest: { core: z.string, does: ClaimSchema }, output: [node('tx')], provenance: 'pipe' },
        (id, kw) => ({ kind: 'tx' as const, id, core: kw.core, does: kw.does }),
      ),
      law: symbol.rosetta`law: Something the protocol guarantees or refuses, quoted verbatim from its source`(
        { input: [z.foldName], inputRest: { source: z.string, quote: z.string, means: z.string }, output: [node('law')], provenance: 'pipe' },
        (id, kw) => ({ kind: 'law' as const, id, source: kw.source, quote: kw.quote, means: kw.means }),
      ),
      constraint: symbol.rosetta`constraint: A repository rule that binds a new frontend, quoted verbatim`(
        { input: [z.foldName], inputRest: { source: z.string, quote: z.string, binds: z.string }, output: [node('constraint')], provenance: 'pipe' },
        (id, kw) => ({ kind: 'constraint' as const, id, source: kw.source, quote: kw.quote, binds: kw.binds }),
      ),
      said: symbol.rosetta`said: Direction given in words by someone who owns it`(
        { input: [z.foldName], inputRest: { who: z.string, on: z.string, quote: z.string, 'taken-as': z.string }, output: [node('said')], provenance: 'pipe' },
        (id, kw) => ({ kind: 'said' as const, id, who: kw.who, on: kw.on, quote: kw.quote, takenAs: kw['taken-as'] }),
      ),

      // ── People ─────────────────────────────────────────────────────────────
      job: symbol.rosetta`job: One thing a person came to get done, in their words`(
        { input: [z.foldName], inputRest: { wants: ClaimSchema }, output: [JobSchema], provenance: 'pipe' },
        (id, kw) => ({ kind: 'job' as const, id, wants: kw.wants }),
      ),
      person: symbol.rosetta`person: Who a surface is for`(
        {
          input: [z.foldName],
          inputRest: { is: ClaimSchema, 'came-for': ClaimSchema, cannot: z.vector(ClaimSchema), jobs: z.vector(JobSchema) },
          output: [node('person')],
          provenance: 'pipe',
        },
        (id, kw) => ({ kind: 'person' as const, id, is: kw.is, cameFor: kw['came-for'], cannot: kw.cannot, jobs: kw.jobs }),
      ),

      // ── Decisions: the spine ───────────────────────────────────────────────
      decision: symbol.rosetta`decision: A structural choice, its options, what each forces, who decides, and what would change it`(
        {
          input: [z.foldName],
          inputRest: {
            question: z.string,
            options: z.dictRecord(z.foldName, z.string),
            forces: z.dictRecord(z.foldName, ids).optional(),
            depends: ids.optional(),
            decider: choice(DECIDERS),
            leaning: z.foldName,
            because: ClaimSchema,
            'changes-if': z.string,
            status: choice(['open', 'settled']).optional(),
            'settled-by': z.string.optional(),
          },
          output: [node('decision')],
          provenance: 'pipe',
        },
        (id, kw) => ({
          kind: 'decision' as const,
          id,
          question: kw.question,
          options: kw.options,
          forces: kw.forces ?? {},
          depends: kw.depends ?? [],
          decider: kw.decider,
          leaning: kw.leaning,
          because: kw.because,
          changesIf: kw['changes-if'],
          status: kw.status ?? 'open',
          ...(kw['settled-by'] ? { settledBy: kw['settled-by'] } : {}),
        }),
      ),

      // ── Structure: every form names the decisions it follows from ──────────
      surface: symbol.rosetta`surface: One wallet face, for exactly one person`(
        { input: [z.foldName], inputRest: { for: z.foldName, first: z.foldName, because: ids }, output: [node('surface')], provenance: 'pipe' },
        (id, kw) => ({ kind: 'surface' as const, id, for: kw.for, first: kw.first, because: kw.because }),
      ),
      screen: symbol.rosetta`screen: One place, answering one question the person has`(
        {
          input: [z.foldName],
          inputRest: { in: z.foldName, answers: z.string, shows: ids, offers: ids, because: ids },
          output: [node('screen')],
          provenance: 'pipe',
        },
        (id, kw) => ({ kind: 'screen' as const, id, in: kw.in, answers: kw.answers, shows: kw.shows, offers: kw.offers, because: kw.because }),
      ),
      flow: symbol.rosetta`flow: One job done, from intent to what the person knows afterwards`(
        {
          input: [z.foldName],
          inputRest: { in: z.foldName, job: z.foldName.optional(), signs: ids, uses: ids.optional(), ends: ClaimSchema, because: ids },
          output: [node('flow')],
          provenance: 'pipe',
        },
        (id, kw) => ({
          kind: 'flow' as const, id, in: kw.in, ...(kw.job ? { job: kw.job } : {}),
          signs: kw.signs, uses: kw.uses ?? [], ends: kw.ends, because: kw.because,
        }),
      ),
      need: symbol.rosetta`need: Something a surface or app requires from the kernel`(
        { input: [z.foldName], inputRest: { of: z.foldName, wants: ClaimSchema, because: ids }, output: [node('need')], provenance: 'pipe' },
        (id, kw) => ({ kind: 'need' as const, id, of: kw.of, wants: kw.wants, because: kw.because }),
      ),
      capability: symbol.rosetta`capability: Something the kernel provides to every surface and app`(
        {
          input: [z.foldName],
          inputRest: { gives: ClaimSchema, meets: ids, signs: ids.optional(), because: ids },
          output: [node('capability')],
          provenance: 'pipe',
        },
        (id, kw) => ({ kind: 'capability' as const, id, gives: kw.gives, meets: kw.meets, signs: kw.signs ?? [], because: kw.because }),
      ),
      app: symbol.rosetta`app: A program that works through the kernel and is not part of it`(
        { input: [z.foldName], inputRest: { for: ids, through: ids, does: ClaimSchema, because: ids }, output: [node('app')], provenance: 'pipe' },
        (id, kw) => ({ kind: 'app' as const, id, for: kw.for, through: kw.through, does: kw.does, because: kw.because }),
      ),
      default: symbol.rosetta`default: A choice made for the person before they choose`(
        {
          input: [z.foldName],
          inputRest: { in: z.foldName, value: z.string, 'risk-on': choice(RISK_ON), because: ids },
          output: [node('default')],
          provenance: 'pipe',
        },
        (id, kw) => ({ kind: 'default' as const, id, in: kw.in, value: kw.value, riskOn: kw['risk-on'], because: kw.because }),
      ),
      gap: symbol.rosetta`gap: A job deliberately left unserved, with the reason`(
        { input: [z.foldName], inputRest: { job: z.foldName, why: ClaimSchema }, output: [node('gap')], provenance: 'pipe' },
        (id, kw) => ({ kind: 'gap' as const, id, job: kw.job, why: kw.why }),
      ),

      // ── The conversation ───────────────────────────────────────────────────
      position: symbol.rosetta`position: Someone argues for one option of a decision`(
        { input: [z.foldName], inputRest: { by: z.string, on: z.foldName, for: z.foldName, because: ClaimSchema }, output: [node('position')], provenance: 'pipe' },
        (id, kw) => ({ kind: 'position' as const, id, by: kw.by, on: kw.on, for: kw.for, because: kw.because }),
      ),
      objection: symbol.rosetta`objection: Someone says a node is wrong, and why`(
        { input: [z.foldName], inputRest: { by: z.string, to: z.foldName, lens: z.string, claim: ClaimSchema }, output: [node('objection')], provenance: 'pipe' },
        (id, kw) => ({ kind: 'objection' as const, id, by: kw.by, to: kw.to, lens: kw.lens, claim: kw.claim }),
      ),
      reply: symbol.rosetta`reply: The answer to an objection`(
        { input: [z.foldName], inputRest: { by: z.string, to: z.foldName, stance: choice(STANCES), because: ClaimSchema }, output: [node('reply')], provenance: 'pipe' },
        (id, kw) => ({ kind: 'reply' as const, id, by: kw.by, to: kw.to, stance: kw.stance, because: kw.because }),
      ),
    };
  },
});
