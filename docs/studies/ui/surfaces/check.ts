// Validator, perspective checker, cold-pack bundler, and zero-dep TS emitter for xln UI Scheme specs (v2).

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import {
  arrival,
  type Claim,
  CREDIT_RISK_VERBS,
  KERNEL_ONLY_VERBS,
  PLUMBING_VERBS,
  type StateId,
  type TermCopy,
  uiSpecCapability,
} from './dsl.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_REPO_ROOT = resolve(HERE, '../../../..');
export const DEFAULT_SCM_FILES = [
  join(HERE, 'base.scm'),
  join(HERE, 'everyday.scm'),
  join(HERE, 'personal.scm'),
  join(HERE, 'pro.scm'),
  join(HERE, 'programs.scm'),
  join(HERE, 'forks.scm'),
];

interface FigureNode { kind: 'figure'; id: string; term: string; meaning: Claim; source: string }
interface VerbNode { kind: 'verb'; id: string; layer: 'entity' | 'account' | 'local'; tx: string; summary: Claim }
interface LegacyScreenNode {
  kind: 'legacy-screen'; file: string; disposition: string; into: string[]; why: Claim; sources: string[];
}
interface SigningSheetNode {
  kind: 'signing-sheet'; id: string; delivery: 'inline-quiet' | 'interrupt-sheet';
  covers: string[]; shows: string[]; feeBefore: boolean;
  survival?: Claim; warns: Claim[]; why: Claim; sources: string[];
}
interface AutopilotNode {
  kind: 'autopilot'; id: string; verbs: string[];
  trigger: Claim; behavior: Claim; fallback: Claim; sources: string[];
}
interface DefaultRuleNode {
  kind: 'default-rule'; id: string; value: string; riskBearer: 'user' | 'peer' | 'none';
  consent: Claim; why: Claim; sources: string[];
}
interface ScreenNode {
  kind: 'screen'; id: string; purpose: Claim; headline: string; figures: string[]; bars: string[];
  actions: string[]; mode: string; visibleIn: Record<StateId, boolean>; maxWords: number;
  why?: Claim; sources: string[];
}
interface FlowNode {
  kind: 'flow'; id: string; verb: string; before: Claim; pending: Claim; done: Claim; failed: Claim;
  why?: Claim; sources: string[];
}
interface SurfaceNode {
  kind: 'surface'; id: string;
  posture: 'human-everyday' | 'operator-desk' | 'legacy-bucket-baseline';
  who: Claim; entry: string; modes: string[];
  terms: Record<string, TermCopy>; defaults: DefaultRuleNode[]; autopilots: AutopilotNode[];
  screens: ScreenNode[]; flows: FlowNode[]; doors: string[]; why: Claim; sources: string[];
}
interface XlnAppNode {
  kind: 'xln-app'; id: string; appKind: 'embedded' | 'external' | 'steward' | 'hostile-test';
  render: 'fixed' | 'generative'; audience: Claim; reads: string[]; requests: string[];
  claimShown: Claim; screens: ScreenNode[]; flows: FlowNode[]; why: Claim; sources: string[];
}
interface StoryNode {
  kind: 'story'; id: string; surface: string; given: StateId; steps: string[];
  outcome: Claim; why: Claim; sources: string[];
}
interface ForkNode {
  kind: 'fork'; id: string; status: 'open' | 'closed';
  decider: 'maintainer' | 'person' | 'measurement' | 'code';
  question: string; affects: string[]; options: Record<string, string>; current: string;
  why: Claim; sources: string[]; closedBy?: string; evidence?: Claim;
}
interface CritiqueNode {
  kind: 'critique'; id: string; author: string; target: string;
  stance: 'agree' | 'object' | 'amend'; why: Claim; sources: string[];
}
type SpecNode =
  | FigureNode | VerbNode | LegacyScreenNode | SigningSheetNode
  | SurfaceNode | XlnAppNode | StoryNode | ForkNode | CritiqueNode;

export interface ValidationOptions {
  perspectiveOnly?: boolean;
}

export interface ValidationResult {
  errors: string[];
  figures: FigureNode[];
  verbs: VerbNode[];
  legacyScreens: LegacyScreenNode[];
  signingSheets: SigningSheetNode[];
  surfaces: SurfaceNode[];
  apps: XlnAppNode[];
  stories: StoryNode[];
  forks: ForkNode[];
  critiques: CritiqueNode[];
  basisCounts: Record<string, number>;
}

const FORBIDDEN_GLOSSARY_RE = /\b(?:channel|channels|wave|waves|round|rounds|receipt|receipts|delivery sequence)\b/iu;
const EVERYDAY_PLUMBING_JARGON_RE =
  /\b(?:collateral|unbacked|uncollateralized|counterparty|credit ceiling|credit limit|ondelta|offdelta|r2c|r2r|r2e|htlc|hanko|jurisdiction|depository|co-signed|frame|lane|lanes|watchtower|dispute window|reserve)\b/iu;

function loadRepoIndex(repoRoot: string) {
  const typeFields = new Map<string, Set<string>>();
  for (const rel of [
    'ui/src/runtime/views.ts',
    'core/types/account.ts',
    'frontend/src/lib/everyday/everyday-projection.ts',
  ]) {
    const src = readFileSync(join(repoRoot, rel), 'utf8');
    const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true);
    sf.forEachChild(node => {
      if (ts.isTypeAliasDeclaration(node) || ts.isInterfaceDeclaration(node)) {
        const props = new Set<string>();
        const visit = (n: ts.Node) => {
          if (ts.isPropertySignature(n) && n.name) props.add(n.name.getText(sf));
          ts.forEachChild(n, visit);
        };
        visit(node);
        typeFields.set(node.name.text, props);
      }
    });
  }

  const collectTxTags = (rel: string): Set<string> => {
    const src = readFileSync(join(repoRoot, rel), 'utf8');
    const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true);
    const tags = new Set<string>();
    const visit = (n: ts.Node) => {
      if (
        ts.isPropertySignature(n) &&
        n.name.getText(sf) === 'type' &&
        n.type &&
        ts.isLiteralTypeNode(n.type) &&
        ts.isStringLiteral(n.type.literal)
      ) {
        tags.add(n.type.literal.text);
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
    return tags;
  };

  const entityTxs = collectTxTags('core/types/entity-tx.ts');
  const accountTxs = collectTxTags('core/types/account.ts');
  const screenFilesOnDisk = readdirSync(join(repoRoot, 'ui/src/screens'))
    .filter(name => name.endsWith('.tsx'))
    .sort();
  const fileTextCache = new Map<string, string>();
  const readRepoFile = (cleanRel: string): string | null => {
    if (fileTextCache.has(cleanRel)) return fileTextCache.get(cleanRel)!;
    const abs = join(repoRoot, cleanRel);
    if (!existsSync(abs)) return null;
    const text = readFileSync(abs, 'utf8');
    fileTextCache.set(cleanRel, text);
    return text;
  };

  return { typeFields, entityTxs, accountTxs, screenFilesOnDisk, readRepoFile };
}

let cachedIndex: { root: string; data: ReturnType<typeof loadRepoIndex> } | null = null;
function getRepoIndex(repoRoot: string) {
  if (!cachedIndex || cachedIndex.root !== repoRoot) {
    cachedIndex = { root: repoRoot, data: loadRepoIndex(repoRoot) };
  }
  return cachedIndex.data;
}

function createNoteSink() {
  const lines: string[] = [];
  return {
    push(line: string): void {
      if (!lines.includes(line)) lines.push(line);
    },
    drain(): readonly string[] {
      const out = lines.slice();
      lines.length = 0;
      return out;
    },
  };
}

export async function evaluateSources(
  sources: Array<{ name: string; code: string }>,
  repoRoot = DEFAULT_REPO_ROOT,
  opts: ValidationOptions = {},
): Promise<ValidationResult> {
  const scope = arrival.LexicalScope.fresh('xln-ui-spec');
  const nodes: SpecNode[] = [];
  for (const { name, code } of sources) {
    const notes = createNoteSink();
    const out = await arrival.exec(code, {
      capabilities: [uiSpecCapability],
      scope,
      staticValidation: 'on',
      notes,
    });
    const drainedNotes = notes.drain();
    if (drainedNotes.length > 0) {
      throw new Error(`UNKNOWN_KWARGS in ${name}:\n${drainedNotes.join('\n')}`);
    }
    for (const item of out) {
      if (item && typeof item === 'object' && 'kind' in item) nodes.push(item as SpecNode);
    }
  }

  const figures = nodes.filter((n): n is FigureNode => n.kind === 'figure');
  const verbs = nodes.filter((n): n is VerbNode => n.kind === 'verb');
  const legacyScreens = nodes.filter((n): n is LegacyScreenNode => n.kind === 'legacy-screen');
  const signingSheets = nodes.filter((n): n is SigningSheetNode => n.kind === 'signing-sheet');
  const surfaces = nodes.filter((n): n is SurfaceNode => n.kind === 'surface');
  const apps = nodes.filter((n): n is XlnAppNode => n.kind === 'xln-app');
  const stories = nodes.filter((n): n is StoryNode => n.kind === 'story');
  const forks = nodes.filter((n): n is ForkNode => n.kind === 'fork');
  const critiques = nodes.filter((n): n is CritiqueNode => n.kind === 'critique');

  const errors: string[] = [];
  const basisCounts: Record<string, number> = {};
  const index = getRepoIndex(repoRoot);

  const figureIds = new Set(figures.map(f => f.id));
  const verbMap = new Map(verbs.map(v => [v.id, v]));
  const forkMap = new Map(forks.map(f => [f.id, f]));
  const screenAddresses = new Set<string>();
  const allAddresses = new Set<string>([
    ...figureIds,
    ...verbMap.keys(),
    ...forkMap.keys(),
    ...signingSheets.map(sh => sh.id),
    ...apps.map(a => a.id),
    ...apps.map(a => `app/${a.id}`),
  ]);

  for (const s of surfaces) {
    allAddresses.add(s.id);
    for (const sc of s.screens) {
      const addr = `${s.id}/${sc.id}`;
      screenAddresses.add(addr);
      allAddresses.add(addr);
    }
    for (const fl of s.flows) allAddresses.add(`${s.id}/${fl.id}`);
    for (const d of s.defaults) allAddresses.add(`${s.id}/${d.id}`);
    for (const ap of s.autopilots) allAddresses.add(`${s.id}/${ap.id}`);
  }
  for (const st of stories) allAddresses.add(`story/${st.id}`);

  const checkSourceRef = (ctx: string, srcRef: string) => {
    if (srcRef.startsWith('fork:')) {
      const fid = srcRef.slice(5);
      if (!opts.perspectiveOnly && !forkMap.has(fid)) {
        errors.push(`${ctx}: unknown fork reference '${srcRef}'`);
      }
      return;
    }
    const cleanPath = srcRef.split('#')[0] ?? '';
    if (!cleanPath || !existsSync(join(repoRoot, cleanPath))) {
      errors.push(`${ctx}: cited path does not exist '${srcRef}'`);
    }
  };

  const checkClaim = (
    ctx: string,
    claim: Claim | undefined,
    claimOpts: { allowUndecided?: boolean; userFacing?: boolean; everydayHuman?: boolean } = {},
  ) => {
    if (!claim) return;
    basisCounts[claim.basis] = (basisCounts[claim.basis] ?? 0) + 1;
    if (claim.basis === 'undecided') {
      if (!claimOpts.allowUndecided) errors.push(`${ctx}: (undecided '${claim.ref}) only allowed on :who`);
      if (!opts.perspectiveOnly && !forkMap.has(claim.ref)) {
        errors.push(`${ctx}: undecided references unknown fork '${claim.ref}'`);
      }
      return;
    }
    if (!claim.text.trim()) errors.push(`${ctx}: empty claim text`);
    if (claim.basis === 'as-is') {
      const cleanPath = claim.ref.split(':')[0]?.split('#')[0] ?? '';
      const fileContent = cleanPath ? index.readRepoFile(cleanPath) : null;
      if (!fileContent) {
        errors.push(`${ctx}: (as-is '${claim.ref}' ...) cited file does not exist`);
      } else if (!fileContent.includes(claim.text)) {
        errors.push(`${ctx}: (as-is '${claim.ref}' ${JSON.stringify(claim.text)}) not found verbatim in ${cleanPath}`);
      }
    }
    if ((claim.basis === 'cited-code' || claim.basis === 'canon') && claim.ref) {
      checkSourceRef(ctx, claim.ref);
    }
    if (claimOpts.userFacing) {
      const bad = claim.text.match(FORBIDDEN_GLOSSARY_RE);
      if (bad) errors.push(`${ctx}: uses forbidden glossary synonym '${bad[0]}' in ${JSON.stringify(claim.text)}`);
    }
    if (claimOpts.everydayHuman) {
      const jargon = claim.text.match(EVERYDAY_PLUMBING_JARGON_RE);
      if (jargon) {
        errors.push(
          `${ctx}: leaks protocol/plumbing jargon '${jargon[0]}' onto human-everyday surface in ${JSON.stringify(claim.text)}`,
        );
      }
    }
  };

  // Law 1 & 2: Base figures and verbs resolve against real AST symbols
  for (const fig of figures) {
    checkClaim(`figure/${fig.id}`, fig.meaning);
    if (!fig.term.trim()) errors.push(`figure/${fig.id}: missing :term key`);
    const [typeName, propName] = fig.source.split('.');
    const props = typeName ? index.typeFields.get(typeName) : undefined;
    if (!typeName || !propName || !props?.has(propName)) {
      errors.push(
        `figure/${fig.id}: :source '${fig.source}' not found in WalletView/TokenTotals/AccountView/DerivedDelta/EverydayProjection`,
      );
    }
  }

  for (const v of verbs) {
    checkClaim(`verb/${v.id}`, v.summary);
    if (v.layer === 'entity' && !index.entityTxs.has(v.tx)) {
      errors.push(`verb/${v.id}: EntityTx '${v.tx}' not found in core/types/entity-tx.ts`);
    } else if (v.layer === 'account' && !index.accountTxs.has(v.tx)) {
      errors.push(`verb/${v.id}: AccountTx '${v.tx}' not found in core/types/account.ts`);
    } else if (v.layer === 'local' && !v.tx.startsWith('local')) {
      errors.push(`verb/${v.id}: local wallet verb :tx must start with 'local' (got '${v.tx}')`);
    }
  }

  // Law 3: Signing-sheet invariants
  const coveredVerbs = new Set<string>();
  for (const sh of signingSheets) {
    if (sh.delivery === 'interrupt-sheet' && !sh.survival) {
      errors.push(`signing-sheet/${sh.id}: :delivery 'interrupt-sheet requires non-empty :survival`);
    }
    checkClaim(`signing-sheet/${sh.id}:survival`, sh.survival, { userFacing: true });
    checkClaim(`signing-sheet/${sh.id}:why`, sh.why);
    for (const w of sh.warns) checkClaim(`signing-sheet/${sh.id}:warn`, w, { userFacing: true });
    for (const sRef of sh.sources) checkSourceRef(`signing-sheet/${sh.id}`, sRef);
    const showSet = new Set(sh.shows);
    if (!sh.feeBefore || (!showSet.has('fee-exact') && !showSet.has('fee-ceiling'))) {
      errors.push(`signing-sheet/${sh.id}: must set :fee-before #t and include 'fee-exact or 'fee-ceiling in :shows`);
    }
    const coversCreditRisk = sh.covers.some(v => CREDIT_RISK_VERBS.has(v));
    if (
      sh.delivery === 'interrupt-sheet' &&
      coversCreditRisk &&
      !showSet.has('delta-credit-limit') &&
      !showSet.has('delta-unbacked-risk') &&
      !showSet.has('human-summary')
    ) {
      errors.push(
        `signing-sheet/${sh.id}: covers credit-risk verbs but omits 'delta-credit-limit / 'delta-unbacked-risk / 'human-summary in :shows`,
      );
    }
    for (const v of sh.covers) {
      if (!verbMap.has(v)) errors.push(`signing-sheet/${sh.id}: unknown verb '${v}' in :covers`);
      coveredVerbs.add(v);
    }
  }

  // Law 4: Legacy screen mapping (checked in full-repo mode)
  if (!opts.perspectiveOnly) {
    const mappedFiles = new Set(legacyScreens.map(ls => ls.file));
    for (const diskFile of index.screenFilesOnDisk) {
      if (!mappedFiles.has(diskFile)) errors.push(`legacy-screen: unmapped screen file ui/src/screens/${diskFile}`);
    }
    for (const ls of legacyScreens) {
      if (!index.screenFilesOnDisk.includes(ls.file)) {
        errors.push(`legacy-screen/${ls.file}: file does not exist in ui/src/screens/`);
      }
      checkClaim(`legacy-screen/${ls.file}`, ls.why);
      for (const sRef of ls.sources) checkSourceRef(`legacy-screen/${ls.file}`, sRef);
      if (ls.disposition !== 'unavailable' && ls.into.length === 0) {
        errors.push(`legacy-screen/${ls.file}: non-unavailable screen must list at least one :into target`);
      }
      for (const target of ls.into) {
        if (!screenAddresses.has(target)) errors.push(`legacy-screen/${ls.file}: unknown target screen '${target}'`);
      }
    }
  }

  // Law 5-8: Surfaces, autopilots, doors, terms, signing-sheet coverage, and disputed-state recovery
  const usedVerbsAcrossSurfaces = new Set<string>();
  for (const s of surfaces) {
    const isEveryday = s.posture === 'human-everyday';
    checkClaim(`surface/${s.id}:who`, s.who, { allowUndecided: true });
    checkClaim(`surface/${s.id}:why`, s.why);
    for (const sRef of s.sources) checkSourceRef(`surface/${s.id}`, sRef);

    for (const [termKey, termCopy] of Object.entries(s.terms)) {
      checkClaim(`surface/${s.id}:term/${termKey}:label`, termCopy.label, { userFacing: true, everydayHuman: isEveryday });
      checkClaim(`surface/${s.id}:term/${termKey}:note`, termCopy.note, { userFacing: true, everydayHuman: isEveryday });
    }
    for (const d of s.defaults) {
      checkClaim(`surface/${s.id}:default/${d.id}:consent`, d.consent, { userFacing: true, everydayHuman: isEveryday });
      checkClaim(`surface/${s.id}:default/${d.id}:why`, d.why);
      for (const sRef of d.sources) checkSourceRef(`surface/${s.id}:default/${d.id}`, sRef);
      if (d.riskBearer === 'user' && !d.consent.text.trim()) {
        errors.push(`surface/${s.id}:default/${d.id}: user-risk default requires non-empty :consent`);
      }
    }

    let autopilotCoversExit = false;
    for (const ap of s.autopilots) {
      allAddresses.add(`${s.id}/${ap.id}`);
      checkClaim(`surface/${s.id}:autopilot/${ap.id}:trigger`, ap.trigger);
      checkClaim(`surface/${s.id}:autopilot/${ap.id}:behavior`, ap.behavior);
      checkClaim(`surface/${s.id}:autopilot/${ap.id}:fallback`, ap.fallback, { userFacing: true, everydayHuman: isEveryday });
      for (const sRef of ap.sources) checkSourceRef(`surface/${s.id}:autopilot/${ap.id}`, sRef);
      if (ap.verbs.length === 0) {
        errors.push(`surface/${s.id}:autopilot/${ap.id}: :verbs must not be empty`);
      }
      for (const v of ap.verbs) {
        if (!verbMap.has(v)) errors.push(`surface/${s.id}:autopilot/${ap.id}: unknown verb '${v}'`);
        usedVerbsAcrossSurfaces.add(v);
        if (v === 'unilateral-exit') autopilotCoversExit = true;
      }
    }

    const doorSet = new Set(s.doors);
    for (const doorVerb of s.doors) {
      if (!verbMap.has(doorVerb)) errors.push(`surface/${s.id}:door: unknown verb '${doorVerb}'`);
    }

    const flowMap = new Map(s.flows.map(f => [f.id, f]));
    for (const fl of s.flows) {
      if (!verbMap.has(fl.verb)) errors.push(`surface/${s.id}:flow/${fl.id}: unknown verb '${fl.verb}'`);
      if (doorSet.has(fl.verb)) {
        errors.push(`surface/${s.id}:flow/${fl.id}: invokes doored verb '${fl.verb}'`);
      }
      if (isEveryday && PLUMBING_VERBS.has(fl.verb)) {
        errors.push(
          `surface/${s.id}:flow/${fl.id}: everyday posture forbids manual plumbing button '${fl.verb}'; absorb via (autopilot ...) or :doors`,
        );
      }
      if (!coveredVerbs.has(fl.verb)) {
        errors.push(`surface/${s.id}:flow/${fl.id}: verb '${fl.verb}' is not covered by any (signing-sheet ...)`);
      }
      usedVerbsAcrossSurfaces.add(fl.verb);
      checkClaim(`surface/${s.id}:flow/${fl.id}:before`, fl.before, { userFacing: true, everydayHuman: isEveryday });
      checkClaim(`surface/${s.id}:flow/${fl.id}:pending`, fl.pending, { userFacing: true, everydayHuman: isEveryday });
      checkClaim(`surface/${s.id}:flow/${fl.id}:done`, fl.done, { userFacing: true, everydayHuman: isEveryday });
      checkClaim(`surface/${s.id}:flow/${fl.id}:failed`, fl.failed, { userFacing: true, everydayHuman: isEveryday });
      checkClaim(`surface/${s.id}:flow/${fl.id}:why`, fl.why);
      for (const sRef of fl.sources) checkSourceRef(`surface/${s.id}:flow/${fl.id}`, sRef);
    }

    const screenMap = new Map(s.screens.map(sc => [sc.id, sc]));
    if (!screenMap.has(s.entry)) errors.push(`surface/${s.id}: :entry '${s.entry}' is not a declared screen`);

    let disputedExitReachable = false;
    let hasVisibleDisputedScreen = false;
    for (const sc of s.screens) {
      if (sc.visibleIn.disputed) hasVisibleDisputedScreen = true;
      checkClaim(`surface/${s.id}:screen/${sc.id}:purpose`, sc.purpose, { userFacing: true, everydayHuman: isEveryday });
      checkClaim(`surface/${s.id}:screen/${sc.id}:why`, sc.why);
      for (const sRef of sc.sources) checkSourceRef(`surface/${s.id}:screen/${sc.id}`, sRef);

      if (isEveryday && sc.bars.length > 0) {
        errors.push(`surface/${s.id}:screen/${sc.id}: everyday posture forbids channel/capacity :bars`);
      }

      const words = sc.purpose.text.trim().split(/\s+/u).filter(Boolean).length;
      if (words > sc.maxWords) {
        errors.push(`surface/${s.id}:screen/${sc.id}: purpose (${words} words) exceeds :max-words (${sc.maxWords})`);
      }
      if (!figureIds.has(sc.headline)) {
        errors.push(`surface/${s.id}:screen/${sc.id}: unknown :headline figure '${sc.headline}'`);
      }
      for (const fig of [...sc.figures, ...sc.bars]) {
        if (!figureIds.has(fig)) errors.push(`surface/${s.id}:screen/${sc.id}: unknown figure '${fig}'`);
      }
      for (const act of sc.actions) {
        const fl = flowMap.get(act);
        if (!fl) errors.push(`surface/${s.id}:screen/${sc.id}: unknown flow '${act}'`);
        else if (sc.visibleIn.disputed && fl.verb === 'unilateral-exit') disputedExitReachable = true;
      }
    }
    if (!disputedExitReachable && !(isEveryday && autopilotCoversExit && hasVisibleDisputedScreen)) {
      errors.push(`surface/${s.id}: unilateral-exit is not reachable on any visible screen in 'disputed' state`);
    }
  }

  // Law 9: XLN Programs (xln-app) & Generative UI kernel boundary
  for (const app of apps) {
    const isHostile = app.appKind === 'hostile-test';
    checkClaim(`xln-app/${app.id}:audience`, app.audience);
    checkClaim(`xln-app/${app.id}:claim-shown`, app.claimShown, { userFacing: !isHostile });
    checkClaim(`xln-app/${app.id}:why`, app.why);
    for (const sRef of app.sources) checkSourceRef(`xln-app/${app.id}`, sRef);
    for (const fig of app.reads) {
      if (!figureIds.has(fig)) errors.push(`xln-app/${app.id}: unknown :reads figure '${fig}'`);
    }
    if (app.requests.length === 0) {
      errors.push(`xln-app/${app.id}: :requests must name at least one verb`);
    }
    for (const reqVerb of app.requests) {
      if (!verbMap.has(reqVerb)) {
        errors.push(`xln-app/${app.id}: unknown :requests verb '${reqVerb}'`);
      }
      if (app.render === 'generative' && KERNEL_ONLY_VERBS.has(reqVerb)) {
        errors.push(
          `xln-app/${app.id}: :render 'generative Program cannot own Kernel-only verb '${reqVerb}'`,
        );
      }
      if (!isHostile && !coveredVerbs.has(reqVerb)) {
        errors.push(
          `xln-app/${app.id}: requested verb '${reqVerb}' is not guarded by any (signing-sheet ...)`,
        );
      }
      usedVerbsAcrossSurfaces.add(reqVerb);
    }
  }

  if (!opts.perspectiveOnly) {
    for (const v of verbs) {
      if (!usedVerbsAcrossSurfaces.has(v.id)) {
        errors.push(`verb/${v.id}: orphaned base verb not exposed on any surface or xln-app`);
      }
    }
  }

  // Law 10: User stories step reachability in :given state
  const surfaceById = new Map(surfaces.map(s => [s.id, s]));
  const appById = new Map(apps.map(a => [a.id, a]));
  for (const st of stories) {
    checkClaim(`story/${st.id}:outcome`, st.outcome);
    checkClaim(`story/${st.id}:why`, st.why);
    for (const sRef of st.sources) checkSourceRef(`story/${st.id}`, sRef);
    const surf = surfaceById.get(st.surface);
    const appTarget = appById.get(st.surface);
    if (!surf && !appTarget) {
      errors.push(`story/${st.id}: unknown :surface or xln-app '${st.surface}'`);
      continue;
    }
    if (st.steps.length === 0) errors.push(`story/${st.id}: :steps must not be empty`);
    if (surf) {
      const screenMap = new Map(surf.screens.map(sc => [sc.id, sc]));
      const flowMap = new Map(surf.flows.map(fl => [fl.id, fl]));
      for (const step of st.steps) {
        const sc = screenMap.get(step);
        if (sc) {
          if (!sc.visibleIn[st.given]) {
            errors.push(`story/${st.id}: screen '${step}' is not visible in state '${st.given}'`);
          }
          continue;
        }
        const fl = flowMap.get(step);
        if (!fl) {
          errors.push(`story/${st.id}: step '${step}' is neither a screen nor a flow in '${st.surface}'`);
          continue;
        }
        const reachableOnVisibleScreen = surf.screens.some(
          candidate => candidate.visibleIn[st.given] && candidate.actions.includes(step),
        );
        if (!reachableOnVisibleScreen) {
          errors.push(`story/${st.id}: flow '${step}' is not reachable on any visible screen in state '${st.given}'`);
        }
      }
    }
  }

  // Law 11: Fork closure authority & critique targets
  for (const fk of forks) {
    checkClaim(`fork/${fk.id}:why`, fk.why);
    for (const sRef of fk.sources) checkSourceRef(`fork/${fk.id}`, sRef);
    if (!(fk.current in fk.options)) {
      errors.push(`fork/${fk.id}: :current '${fk.current}' is not a key in :options`);
    }
    for (const target of fk.affects) {
      if (!allAddresses.has(target)) errors.push(`fork/${fk.id}: :affects references unknown node '${target}'`);
    }
    if (fk.status === 'closed') {
      if (!fk.closedBy?.trim() || !fk.evidence) {
        errors.push(`fork/${fk.id}: closed fork requires both :closed-by and :evidence`);
      } else {
        checkClaim(`fork/${fk.id}:evidence`, fk.evidence);
        const allowedBasis: Record<ForkNode['decider'], ReadonlySet<string>> = {
          maintainer: new Set(['canon']),
          person: new Set(['person']),
          measurement: new Set(['sweep', 'person']),
          code: new Set(['cited-code', 'canon']),
        };
        if (!allowedBasis[fk.decider].has(fk.evidence.basis)) {
          errors.push(
            `fork/${fk.id}: decider '${fk.decider}' cannot be closed with '${fk.evidence.basis}' evidence`,
          );
        }
      }
    }
  }

  for (const cr of critiques) {
    checkClaim(`critique/${cr.id}:why`, cr.why);
    for (const sRef of cr.sources) checkSourceRef(`critique/${cr.id}`, sRef);
    if (!allAddresses.has(cr.target)) {
      errors.push(`critique/${cr.id}: :target '${cr.target}' does not match any declared node`);
    }
  }

  return {
    errors,
    figures,
    verbs,
    legacyScreens,
    signingSheets,
    surfaces,
    apps,
    stories,
    forks,
    critiques,
    basisCounts,
  };
}

export async function validateSpecFiles(
  files = DEFAULT_SCM_FILES,
  repoRoot = DEFAULT_REPO_ROOT,
  opts: ValidationOptions = {},
): Promise<ValidationResult> {
  const roundsDir = join(dirname(files[0] ?? HERE), 'rounds');
  const roundFiles =
    !opts.perspectiveOnly && existsSync(roundsDir)
      ? readdirSync(roundsDir)
          .filter(f => f.endsWith('.scm'))
          .sort()
          .map(f => join(roundsDir, f))
      : [];
  const allFiles = [...files, ...roundFiles];
  const sources = allFiles.map(file => ({ name: file, code: readFileSync(file, 'utf8') }));
  return evaluateSources(sources, repoRoot, opts);
}

export function renderTypeScriptModule(res: ValidationResult): string {
  const figureTerms = Object.fromEntries(res.figures.map(f => [f.id, f.term]));
  const surfacesPayload = Object.fromEntries(
    res.surfaces.map(s => [
      s.id,
      {
        posture: s.posture,
        entry: s.entry,
        modes: s.modes,
        terms: Object.fromEntries(
          Object.entries(s.terms).map(([k, tc]) => [
            k,
            {
              text: tc.label.text,
              basis: tc.label.basis,
              note: tc.note?.text ?? null,
              noteWhen: tc.noteWhen,
            },
          ]),
        ),
        autopilots: Object.fromEntries(
          s.autopilots.map(ap => [
            ap.id,
            {
              verbs: ap.verbs,
              trigger: ap.trigger.text,
              behavior: ap.behavior.text,
              fallback: ap.fallback.text,
            },
          ]),
        ),
        flows: Object.fromEntries(
          s.flows.map(fl => [
            fl.id,
            {
              verb: fl.verb,
              before: { text: fl.before.text, basis: fl.before.basis },
              pending: { text: fl.pending.text, basis: fl.pending.basis },
              done: { text: fl.done.text, basis: fl.done.basis },
              failed: { text: fl.failed.text, basis: fl.failed.basis },
            },
          ]),
        ),
        screens: s.screens.map(sc => sc.id),
        doors: s.doors,
      },
    ]),
  );
  const signingSheetsPayload = Object.fromEntries(
    res.signingSheets.map(sh => [
      sh.id,
      {
        delivery: sh.delivery,
        covers: sh.covers,
        shows: sh.shows,
        feeBefore: sh.feeBefore,
        survival: sh.survival?.text ?? null,
        warns: sh.warns.map(w => w.text),
      },
    ]),
  );
  const appsPayload = Object.fromEntries(
    res.apps.map(a => [
      a.id,
      {
        kind: a.appKind,
        render: a.render,
        reads: a.reads,
        requests: a.requests,
        claimShown: a.claimShown.text,
      },
    ]),
  );
  return [
    '// AUTO-GENERATED from docs/studies/ui/surfaces/*.scm — DO NOT EDIT MANUALLY.',
    '// Zero runtime dependencies; importable by both React (ui/src) and Svelte (frontend/src/lib).',
    '',
    `export const FIGURE_TERMS = ${JSON.stringify(figureTerms, null, 2)} as const;`,
    '',
    `export const SIGNING_SHEETS = ${JSON.stringify(signingSheetsPayload, null, 2)} as const;`,
    '',
    `export const XLN_APPS = ${JSON.stringify(appsPayload, null, 2)} as const;`,
    '',
    `export const SURFACES = ${JSON.stringify(surfacesPayload, null, 2)} as const;`,
    '',
    'export type SurfaceId = keyof typeof SURFACES;',
    '',
  ].join('\n');
}

const POV_SPECS: Record<string, { file: string; title: string; mandate: string }> = {
  'p1-consumer': {
    file: 'docs/studies/ui/surfaces/perspectives/p1-consumer.scm',
    title: 'POV 1 — Zero-Plumbing Consumer Radical (Apple Pay + Splitwise)',
    mandate: [
      'Optimize ruthlessly for everyday non-operator people and households.',
      '- Hide XLN internal storage buckets (EOA, Contract Reserve, Collateral, Unbacked Credit) from routine daily screens.',
      '- Make the Base Wallet tiny (entry screen, activity, safety/unilateral-exit, and one rock-solid `(signing-sheet ...)`).',
      '- Model everyday workflows—Pay/Request Link, Household/Friend Tab (`Splitwise`), Merchant Checkout, Instant Convert, and Simple Savings—as clean user stories and `(xln-app ...)` Programs (using `:render \'generative` only where ephemeral calculators/splits genuinely beat fixed UI).',
      '- Show honestly when and how counterparty risk consent surfaces without turning Screen 1 into an accounting ledger.',
    ].join('\n'),
  },
  'p2-sovereign': {
    file: 'docs/studies/ui/surfaces/perspectives/p2-sovereign.scm',
    title: 'POV 2 — Sovereign Risk-Truth & Consent Radical',
    mandate: [
      'Refuse to hide counterparty IOU risk, fee deductions, or unilateral exit behind smooth consumer abstractions.',
      '- Author the definitive `(signing-sheet ...)` protecting user keys against confusing or deceptive XLN Programs.',
      '- Encode `todo.md`\'s single-capacity-bar + on-by-default `Pro` toggle baseline at full strength (`:bars` + `:modes`), and compare it directly against a tiny Wallet Kernel + external XLN Programs.',
      '- Ground every claim in `AS-IS.md` and `AS-IS-SCREENS.md`, ensuring `unilateral-exit` is always reachable in `disputed` state.',
    ].join('\n'),
  },
  'p3-commercial': {
    file: 'docs/studies/ui/surfaces/perspectives/p3-commercial.scm',
    title: 'POV 3 — Commercial, OTC, Corridor & Hub-Operator Radical',
    mandate: [
      'Treat retail Venmo-clones as a trap; optimize for the commercial operators in `todo.md` (OTC desks, market makers, payout corridors, freight/supplier meshes, and hub operators).',
      '- Design `Pro` (`Desk` multi-lane cockpit, `r2c`/`r2r`/`r2e` reserve management, rebalance policies, multi-signer `Hanko` boards) plus high-value commercial `(xln-app ...)` Programs: **OTC Deal-Signing Room**, **B2B Netting Tab**, **Cross-J RFQ**, and **Hub Lending Facility**.',
      '- Keep signing fast and batch/threshold-aware without losing exact `deriveDelta` risk visibility.',
    ].join('\n'),
  },
  'p4-steward-redteam': {
    file: 'docs/studies/ui/surfaces/perspectives/p4-steward-redteam.scm',
    title: 'POV 4 — Autonomous Steward Programs + Adversarial Red-Team',
    mandate: [
      'Own two fronts: delegated machine/policy Programs AND hostile red-team Programs trying to defeat the Wallet signing sheet.',
      '- Author 3 `:kind \'steward` / `:render \'generative` Programs where a user signs a bounded policy/mandate (`mppx`/`x402` API spend budget, auto-cover above threshold, scheduled payout/payroll) + end-to-end `(story ...)` flows.',
      '- Author 4 `:kind \'hostile-test` attack `(xln-app ...)` entries (`disguised-10k-credit-reward`, `unbacked-swap-bait`, `hidden-fee-drain`, `stalled-hub-trap`) whose `:claim-shown` lures the user while `:requests` triggers dangerous base verbs—Plus the Wallet `(signing-sheet ...)` rules designed to catch all 4.',
    ].join('\n'),
  },
};

const DSL_CHEATSHEET = `## Arrival Scheme UI DSL v2 Reference (Exact Syntax)

Allowed forms (do NOT redefine figures or verbs from \`base.scm\`; reference them by symbol like \`'secured-receivable\` or \`'send-routed\`):

\`\`\`scheme
;; Provenance wrappers (REQUIRED on claims — bare strings are rejected!):
(guess "Proposed copy or design rationale")
(as-is "ui/src/components/home/BalanceDetails.tsx" "Without collateral") ; MUST exist verbatim in that exact file!
(from-code "ui/src/screens/Lending.tsx" "Summary grounded in cited file")
(canon "AGENTS.md" "Rule from AGENTS.md or todo.md")

;; Optional term with subtitle note:
(term-copy
  :label     (guess "On hub tab")
  :note      (guess "Owed by the hub; not locked on-chain.")
  :note-when 'non-zero) ; 'always | 'non-zero

;; 1. Universal Signing Sheet (MUST cover every verb used by your surface flows and non-hostile xln-apps!):
;; Allowed :shows symbols: 'delta-secured 'delta-unbacked-risk 'delta-credit-limit 'delta-owed 'fee-exact 'counterparty 'expiry-deadline 'program-origin
(signing-sheet 'my-signing-sheet
  :covers     ['send-routed 'send-direct 'request-cover 'extend-peer-tab 'unilateral-exit 'finalize-dispute]
  :shows      ['program-origin 'counterparty 'delta-secured 'delta-unbacked-risk 'delta-credit-limit 'fee-exact]
  :fee-before #t
  :survival   (guess "Plain sentence stating what survives on-chain if the counterparty disappears.")
  :warns      [(guess "Warning shown when extending unbacked credit.")]
  :why        (guess "Why this sheet is structured this way.")
  :sources    ["docs/studies/ui/surfaces/AS-IS.md"])

;; 2. Wallet Surface (MUST include at least one screen visible in 'disputed state with a flow invoking 'unilateral-exit!):
(surface 'my-wallet
  :who      (guess "Target user of this surface")
  :entry    'home
  :modes    ['always] ; optional: 'always | 'pro-only | 'personal-only
  :terms    {:secured (guess "Locked on-chain") :unbacked (term-copy :label (guess "Unbacked") :note (guess "Owed by counterparty"))}
  :defaults [(default-rule 'hub-credit :value "0 USDC" :risk-bearer 'user :consent (guess "Explicit prompt") :why (guess "Reason") :sources ["docs/studies/ui/surfaces/AS-IS.md"])]
  :screens  [
    (screen 'home
      :purpose   (guess "Under 45 words describing screen purpose.")
      :headline  'secured-receivable
      :figures   ['secured-receivable 'unbacked-exposure]
      :bars      ['secured-receivable 'unbacked-exposure] ; optional composite visual bar
      :actions   ['pay 'cover 'exit]
      :when      (lambda (s) (or (:disputed s) (>= (:secured s) 0))) ; optional predicate over {:secured :risk :owed :onchain :reserve :disputed :hubs}
      :max-words 45
      :why       (guess "Rationale")
      :sources   ["docs/studies/ui/surfaces/AS-IS.md"])
  ]
  :flows    [
    (flow 'pay   :verb 'send-routed     :before (guess "Pay")      :pending (guess "Sending...") :done (guess "Paid.")      :failed (guess "Unchanged."))
    (flow 'cover :verb 'request-cover   :before (guess "Lock it")  :pending (guess "Locking...") :done (guess "Locked.")    :failed (guess "Unchanged."))
    (flow 'exit  :verb 'unilateral-exit :before (guess "Withdraw") :pending (guess "Exiting...") :done (guess "Submitted.") :failed (guess "Safe to retry."))
  ]
  :doors    ['place-limit-order 'set-bank-rates]
  :why      (guess "Why this surface boundary holds.")
  :sources  ["docs/studies/ui/surfaces/BRIEF.md"])

;; 3. XLN Program (Client App proposing intents to the Wallet signing-sheet):
;; :kind is 'embedded | 'external | 'steward | 'hostile-test
;; :render is 'fixed | 'generative (NOTE: 'generative CANNOT request 'unilateral-exit, 'finalize-dispute, 'export-backup, or 'reset-testnet!)
(xln-app 'my-program
  :kind        'external
  :render      'fixed
  :audience    (guess "Who opens this Program")
  :reads       ['send-capacity 'secured-receivable]
  :requests    ['send-routed 'request-cover]
  :claim-shown (guess "What the Program UI tells the user it is doing")
  :why         (guess "Why this lives as a Program rather than a permanent Wallet tab")
  :sources     ["docs/studies/ui/surfaces/BRIEF.md"])

;; 4. End-to-End User Story (:given is 'empty | 'uncovered | 'partlyCovered | 'disputed; :steps are screen/flow IDs in :surface):
(story 'my-journey
  :surface 'my-wallet
  :given   'uncovered
  :steps   ['home 'cover]
  :outcome (guess "User state after completing steps")
  :why     (guess "Why this flow matters")
  :sources ["docs/studies/ui/surfaces/AS-IS.md"])
\`\`\`
`;

export function emitColdPacks(targetId = 'all', repoRoot = DEFAULT_REPO_ROOT): string[] {
  const packsDir = join(HERE, 'packs');
  mkdirSync(packsDir, { recursive: true });
  const brief = readFileSync(join(HERE, 'BRIEF.md'), 'utf8');
  const asIs = readFileSync(join(HERE, 'AS-IS.md'), 'utf8');
  const asIsScreens = readFileSync(join(HERE, 'AS-IS-SCREENS.md'), 'utf8');
  const baseScm = readFileSync(join(HERE, 'base.scm'), 'utf8');

  const ids = targetId === 'all' ? Object.keys(POV_SPECS) : [targetId];
  const written: string[] = [];
  for (const id of ids) {
    const spec = POV_SPECS[id];
    if (!spec) throw new Error(`Unknown POV id '${id}' (expected one of: ${Object.keys(POV_SPECS).join(', ')})`);
    const content = [
      `# Cold-Entry Prompt Pack: ${spec.title}`,
      '',
      '## Your Assignment',
      spec.mandate,
      '',
      `- **Output file:** \`${spec.file}\` (return ONLY valid Arrival Scheme code for this file, or write it directly if you have repo access and run \`bun docs/studies/ui/surfaces/check.ts --perspective ${spec.file}\` until green).`,
      '- **Anti-priming rule:** Do NOT read other files in `perspectives/`, `rounds/`, `personal.scm`, `pro.scm`, or `forks.scm`.',
      '',
      DSL_CHEATSHEET,
      '---',
      brief,
      '---',
      asIs,
      '---',
      asIsScreens,
      '---',
      '## Canonical `base.scm` (Already Loaded in Scope — Reference These Exact Figure & Verb IDs)',
      '```scheme',
      baseScm.trim(),
      '```',
      '',
    ].join('\n');
    const outFile = join(packsDir, `${id}.prompt.md`);
    writeFileSync(outFile, content, 'utf8');
    written.push(outFile);
  }
  void repoRoot;
  return written;
}

function formatSummary(res: ValidationResult, label = 'XLN UI SPEC CHECK'): string {
  const lines: string[] = [];
  lines.push(
    `${label}: ${res.errors.length === 0 ? 'VALID STRUCTURE' : `FAILED (${res.errors.length} errors)`}`,
  );
  lines.push(
    `Inventory: ${res.figures.length} figures · ${res.verbs.length} verbs · ${res.signingSheets.length} signing-sheets · ${res.surfaces.length} surfaces · ${res.apps.length} xln-apps · ${res.stories.length} stories · ${res.forks.length} forks`,
  );
  const basisSummary = Object.entries(res.basisCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, n]) => (k === 'cited-code' ? `cited-code=${n} (path verified, prose unproved)` : `${k}=${n}`))
    .join(' · ');
  lines.push(`Provenance marks: ${basisSummary}`);
  for (const s of res.surfaces) {
    lines.push(
      `  - surface '${s.id}' (posture=${s.posture}, entry='${s.entry}', modes=[${s.modes.join(',')}], screens=${s.screens.length}, flows=${s.flows.length}, autopilots=${s.autopilots.length}, doors=${s.doors.length})`,
    );
  }
  for (const a of res.apps) {
    lines.push(
      `  - xln-app '${a.id}' (kind=${a.appKind}, render=${a.render}, reads=${a.reads.length}, requests=[${a.requests.join(',')}])`,
    );
  }
  if (res.forks.length > 0) {
    lines.push('Open forks:');
    for (const fk of res.forks.filter(f => f.status === 'open')) {
      lines.push(`  - [${fk.id}] decider=${fk.decider} current=${fk.current} :: ${fk.question}`);
    }
  }
  if (res.errors.length > 0) {
    lines.push('Errors:');
    for (const err of res.errors) lines.push(`  ! ${err}`);
  }
  return lines.join('\n');
}

if (import.meta.main) {
  const args = process.argv.slice(2);

  const packIdx = args.indexOf('--pack');
  if (packIdx !== -1) {
    const target = args[packIdx + 1] ?? 'all';
    const files = emitColdPacks(target);
    for (const f of files) console.log(`Packed: ${f}`);
    process.exit(0);
  }

  const perspIdx = args.indexOf('--perspective');
  if (perspIdx !== -1) {
    const pFile = resolve(process.cwd(), args[perspIdx + 1] ?? '');
    const res = await validateSpecFiles([join(HERE, 'base.scm'), pFile], DEFAULT_REPO_ROOT, {
      perspectiveOnly: true,
    });
    console.log(formatSummary(res, `PERSPECTIVE CHECK (${pFile})`));
    if (res.errors.length > 0) process.exit(1);
    process.exit(0);
  }

  const res = await validateSpecFiles();
  console.log(formatSummary(res));
  if (res.errors.length > 0) process.exit(1);

  const emitIdx = args.indexOf('--emit');
  if (emitIdx !== -1) {
    const outPath = resolve(process.cwd(), args[emitIdx + 1] ?? join(HERE, 'surfaces.generated.ts'));
    writeFileSync(outPath, renderTypeScriptModule(res), 'utf8');
    console.log(`Emitted: ${outPath}`);
  }
  const checkEmitIdx = args.indexOf('--check-emit');
  if (checkEmitIdx !== -1) {
    const checkPath = resolve(process.cwd(), args[checkEmitIdx + 1] ?? join(HERE, 'surfaces.generated.ts'));
    const expected = renderTypeScriptModule(res);
    const actual = existsSync(checkPath) ? readFileSync(checkPath, 'utf8') : '';
    if (actual !== expected) {
      console.error(`EMIT_DRIFT: ${checkPath} is out of date; re-run with --emit`);
      process.exit(1);
    }
    console.log(`Emit check clean: ${checkPath}`);
  }
}
