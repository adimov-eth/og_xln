// Checker for the from-scratch wallet design. Usage:
//   bun docs/studies/ui/wallets/check.ts                 whole spec
//   bun docs/studies/ui/wallets/check.ts --only a.scm …  ground files plus the named files;
//                                                        references to files not loaded are warnings
import { execFileSync } from 'node:child_process';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';
import { arrival, walletDesign, type Claim, type Node } from './lang.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(HERE, '../../../..');
const GROUND = ['protocol.scm', 'canon.scm', 'direction.scm'];
const OLD_WALLET = /\b(?:ui|frontend)\/(?:src|tests)\b|docs\/studies\/ui\/surfaces\b/u;

const walk = (dir: string): string[] =>
  existsSync(dir)
    ? readdirSync(dir).sort().flatMap(name => {
        const path = join(dir, name);
        return statSync(path).isDirectory() ? walk(path) : name.endsWith('.scm') ? [path] : [];
      })
    : [];

function specFiles(): string[] {
  const ground = GROUND.map(name => join(HERE, name)).filter(existsSync);
  const rest = walk(HERE).filter(path => !ground.includes(path));
  const rank = (path: string) => {
    const rel = relative(HERE, path);
    return rel === 'kernel.scm' ? 0 : rel === 'apps.scm' ? 1 : rel.startsWith('surfaces/') ? 2 : rel.startsWith('talk/') ? 4 : 3;
  };
  return [...ground, ...rest.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b))];
}

const norm = (text: string) => text.replace(/\s+/gu, ' ').trim();
function readCommitted(rel: string): string | null {
  try {
    return execFileSync('git', ['show', `HEAD:${rel}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
  } catch {
    return null;
  }
}

function coreIndex() {
  const fields = new Map<string, Set<string>>();
  const txTypes = new Set<string>();
  for (const rel of ['core/types/account.ts', 'core/types/entity-tx.ts']) {
    const src = readFileSync(join(ROOT, rel), 'utf8');
    for (const match of src.matchAll(/type:\s*'([A-Za-z0-9_]+)'/gu)) txTypes.add(match[1]!);
    const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true);
    sf.forEachChild(node => {
      if (!ts.isInterfaceDeclaration(node) && !ts.isTypeAliasDeclaration(node)) return;
      const props = new Set<string>();
      const visit = (n: ts.Node) => {
        if (ts.isPropertySignature(n) && n.name) props.add(n.name.getText(sf));
        ts.forEachChild(n, visit);
      };
      visit(node);
      fields.set(node.name.text, props);
    });
  }
  return { fields, txTypes };
}

type Loaded = { file: string; node: Node };

async function load(files: string[]): Promise<{ loaded: Loaded[]; errors: string[] }> {
  const scope = arrival.LexicalScope.fresh('xln-wallet-design');
  const loaded: Loaded[] = [];
  const errors: string[] = [];
  for (const path of files) {
    const file = relative(HERE, path);
    const code = readFileSync(path, 'utf8');
    const old = code.split('\n').findIndex(line => OLD_WALLET.test(line));
    if (old >= 0) errors.push(`${file}:${old + 1}: names an existing wallet's source or the earlier spec; this spec binds only to the protocol`);
    const notes: string[] = [];
    try {
      const out = await arrival.exec(code, { capabilities: [walletDesign], scope, staticValidation: 'on', notes });
      if (notes.length > 0) errors.push(`${file}: unknown keywords: ${notes.join('; ')}`);
      for (const item of out) if (item && typeof item === 'object' && 'kind' in item && 'id' in item) loaded.push({ file, node: item as Node });
    } catch (error) {
      errors.push(`${file}: does not evaluate: ${String(error instanceof Error ? error.message : error).slice(0, 600)}`);
    }
  }
  return { loaded, errors };
}

const args = process.argv.slice(2);
const onlyIdx = args.indexOf('--only');
const partial = onlyIdx >= 0;
const files = partial
  ? [...GROUND.map(name => join(HERE, name)).filter(existsSync), ...args.slice(onlyIdx + 1).filter(a => a.endsWith('.scm')).map(a => resolve(process.cwd(), a))]
  : specFiles();
const { loaded, errors } = await load([...new Set(files)]);
const warnings: string[] = [];
const core = coreIndex();

const byId = new Map<string, Loaded>();
for (const entry of loaded) {
  const seen = byId.get(entry.node.id);
  if (seen) errors.push(`${entry.file}: id '${entry.node.id}' is already used in ${seen.file}`);
  else byId.set(entry.node.id, entry);
}
// Jobs live inside persons; give them ids too.
const jobs = new Map<string, string>();
for (const { node } of loaded) if (node.kind === 'person') for (const job of node.jobs) jobs.set(job.id, node.id);

const kindOf = (id: string) => byId.get(id)?.node.kind ?? (jobs.has(id) ? 'job' : undefined);
const missing = (where: string, id: string, want: string) => {
  const message = `${where}: '${id}' is not a declared ${want}`;
  if (partial) warnings.push(message);
  else errors.push(message);
};
const ref = (where: string, id: string, ...kinds: string[]) => {
  const kind = id === 'kernel' ? 'kernel' : kindOf(id);
  if (!kind) missing(where, id, kinds.join(' or '));
  else if (!kinds.includes(kind)) errors.push(`${where}: '${id}' is a ${kind}, expected ${kinds.join(' or ')}`);
};

const basis: Record<string, number> = {};
function claim(where: string, c: Claim) {
  basis[c.basis] = (basis[c.basis] ?? 0) + 1;
  if (!c.text.trim()) errors.push(`${where}: empty sentence`);
  if (c.basis === 'protocol') {
    if (!/^(?:core|jurisdictions|docs\/core)\//u.test(c.ref)) errors.push(`${where}: (protocol "${c.ref}" …) must cite core/, jurisdictions/ or docs/core/`);
    else if (!existsSync(join(ROOT, c.ref))) errors.push(`${where}: cited path does not exist: ${c.ref}`);
  } else if (c.basis === 'evidence') {
    if (!/^docs\/(?:studies|evidence)\//u.test(c.ref)) errors.push(`${where}: (evidence "${c.ref}" …) must cite docs/studies/ or docs/evidence/`);
    else if (!existsSync(join(ROOT, c.ref))) errors.push(`${where}: cited path does not exist: ${c.ref}`);
  } else if (c.basis === 'canon') ref(where, c.ref, 'constraint', 'law');
  else if (c.basis === 'said') ref(where, c.ref, 'said');
}
const because = (where: string, list: string[]) => {
  if (list.length === 0) errors.push(`${where}: :because is empty; structure must follow from at least one decision`);
  for (const id of list) ref(where, id, 'decision');
};
const quoted = (where: string, source: string, quote: string, allowed: RegExp) => {
  if (!allowed.test(source)) return errors.push(`${where}: source '${source}' is outside what this form may cite`);
  // Rules are read at the committed version: an uncommitted edit is not canon.
  const text = /^(?:AGENTS\.md|todo\.md|docs\/[^/]+\.md)$/u.test(source) ? readCommitted(source) : existsSync(join(ROOT, source)) ? readFileSync(join(ROOT, source), 'utf8') : null;
  if (text === null) return errors.push(`${where}: source does not exist: ${source}`);
  if (norm(quote).length < 12) errors.push(`${where}: quote is too short to verify`);
  else if (!norm(text).includes(norm(quote))) errors.push(`${where}: quote not found verbatim in ${source}`);
  return undefined;
};
const owner = (where: string, id: string) => ref(where, id, 'surface', 'app', 'kernel');

for (const { file, node } of loaded) {
  const at = `${file}: ${node.kind} '${node.id}'`;
  switch (node.kind) {
    case 'figure': {
      const [type, field] = node.core.split('.');
      if (!type || !field || !core.fields.get(type)?.has(field)) errors.push(`${at}: :core '${node.core}' is not a field of a type in core/types/account.ts or entity-tx.ts`);
      claim(at, node.means);
      break;
    }
    case 'tx':
      if (!core.txTypes.has(node.core)) errors.push(`${at}: :core '${node.core}' is not a transaction type in core/types`);
      claim(at, node.does);
      break;
    case 'law':
      quoted(at, node.source, node.quote, /^(?:core|jurisdictions|docs\/core)\//u);
      break;
    case 'constraint':
      quoted(at, node.source, node.quote, /^(?:AGENTS\.md|todo\.md|docs\/(?!studies\/)[^/]+\.md)$/u);
      break;
    case 'said':
      if (norm(node.quote).length < 12) errors.push(`${at}: quote is too short`);
      break;
    case 'person':
      claim(at, node.is);
      claim(at, node.cameFor);
      node.cannot.forEach(c => claim(at, c));
      if (node.jobs.length === 0) errors.push(`${at}: has no jobs`);
      node.jobs.forEach(job => claim(`${at} job '${job.id}'`, job.wants));
      break;
    case 'decision': {
      const options = Object.keys(node.options);
      if (options.length < 2) errors.push(`${at}: needs at least two options`);
      if (!options.includes(node.leaning)) errors.push(`${at}: :leaning '${node.leaning}' is not one of its options`);
      for (const [option, forced] of Object.entries(node.forces)) {
        if (!options.includes(option)) errors.push(`${at}: :forces names unknown option '${option}'`);
        forced.forEach(id => ref(`${at} :forces`, id, 'decision'));
      }
      node.depends.forEach(id => ref(`${at} :depends`, id, 'decision'));
      if (norm(node.changesIf).length < 12) errors.push(`${at}: :changes-if must say what observation would change it`);
      if (node.status === 'settled' && !node.settledBy) errors.push(`${at}: settled without :settled-by`);
      if (node.status === 'settled' && node.decider !== 'protocol' && !/^(?:user|maintainer):/u.test(node.settledBy ?? '')) {
        errors.push(`${at}: only the user or the maintainer settles this; write :settled-by "user: <date>" or "maintainer: <date>"`);
      }
      claim(at, node.because);
      break;
    }
    case 'surface':
      ref(at, node.for, 'person');
      ref(at, node.first, 'screen');
      because(at, node.because);
      break;
    case 'screen':
      owner(at, node.in);
      if (node.answers.trim().split(/\s+/u).length > 20 || !node.answers.trim().endsWith('?')) errors.push(`${at}: :answers must be one question of at most 20 words`);
      node.shows.forEach(id => ref(at, id, 'figure'));
      node.offers.forEach(id => ref(at, id, 'flow'));
      because(at, node.because);
      break;
    case 'flow':
      owner(at, node.in);
      if (node.job) ref(at, node.job, 'job');
      node.signs.forEach(id => ref(at, id, 'tx'));
      node.uses.forEach(id => ref(at, id, 'capability'));
      claim(at, node.ends);
      because(at, node.because);
      break;
    case 'need':
      ref(at, node.of, 'surface', 'app');
      claim(at, node.wants);
      because(at, node.because);
      break;
    case 'capability':
      claim(at, node.gives);
      node.meets.forEach(id => ref(at, id, 'need'));
      node.signs.forEach(id => ref(at, id, 'tx'));
      because(at, node.because);
      break;
    case 'app':
      node.for.forEach(id => ref(at, id, 'person'));
      node.through.forEach(id => ref(at, id, 'capability'));
      claim(at, node.does);
      because(at, node.because);
      break;
    case 'default':
      owner(at, node.in);
      because(at, node.because);
      break;
    case 'gap':
      ref(at, node.job, 'job');
      claim(at, node.why);
      break;
    case 'position': {
      ref(at, node.on, 'decision');
      const target = byId.get(node.on)?.node;
      if (target?.kind === 'decision' && !(node.for in target.options)) errors.push(`${at}: '${node.for}' is not an option of '${node.on}'`);
      claim(at, node.because);
      break;
    }
    case 'objection':
      if (!byId.has(node.to) && !jobs.has(node.to)) missing(at, node.to, 'node');
      claim(at, node.claim);
      break;
    case 'reply':
      ref(at, node.to, 'objection');
      claim(at, node.because);
      break;
  }
}

const all = <K extends Node['kind']>(kind: K) => loaded.map(l => l.node).filter((n): n is Extract<Node, { kind: K }> => n.kind === kind);
const decisions = all('decision');

// Dependencies must not loop.
const depends = new Map(decisions.map(d => [d.id, d.depends.filter(id => kindOf(id) === 'decision')]));
const order: string[] = [];
const state = new Map<string, 1 | 2>();
const visit = (id: string, trail: string[]): void => {
  if (state.get(id) === 2) return;
  if (state.get(id) === 1) return void errors.push(`decisions depend on each other in a loop: ${[...trail, id].join(' → ')}`);
  state.set(id, 1);
  for (const next of depends.get(id) ?? []) visit(next, [...trail, id]);
  state.set(id, 2);
  order.push(id);
};
decisions.forEach(d => visit(d.id, []));

if (!partial) {
  // One surface per person, one person per surface.
  const surfaces = all('surface');
  for (const person of all('person')) {
    const mine = surfaces.filter(s => s.for === person.id);
    if (mine.length !== 1) errors.push(`person '${person.id}': has ${mine.length} surfaces, expected exactly 1`);
  }
  // Every job is served by a flow or declared a gap.
  const served = new Set(all('flow').map(f => f.job).filter(Boolean));
  const gaps = new Set(all('gap').map(g => g.job));
  for (const [job, person] of jobs) if (!served.has(job) && !gaps.has(job)) errors.push(`job '${job}' of '${person}': no flow serves it and no gap explains why`);
  // Every need is met.
  const met = new Set(all('capability').flatMap(c => c.meets));
  for (const need of all('need')) if (!met.has(need.id)) errors.push(`need '${need.id}' of '${need.of}': no kernel capability meets it`);
  // Every decision is used by something, or argued over.
  const used = new Set<string>();
  for (const { node } of loaded) if ('because' in node && Array.isArray(node.because)) node.because.forEach(id => used.add(id));
  decisions.forEach(d => { d.depends.forEach(id => used.add(id)); Object.values(d.forces).flat().forEach(id => used.add(id)); });
  all('position').forEach(p => used.add(p.on));
  for (const d of decisions) if (!used.has(d.id)) warnings.push(`decision '${d.id}': nothing follows from it`);
}

const replied = new Set(all('reply').map(r => r.to));
const unanswered = all('objection').filter(o => !replied.has(o.id));
const count = (kind: Node['kind']) => all(kind).length;
const provisional = decisions.filter(d => d.status === 'settled' && /provisional/u.test(d.settledBy ?? ''));
const open = order.filter(id => decisions.find(d => d.id === id)?.status === 'open');

if (args.includes('--json')) {
  const fileOf = new Map(loaded.map(l => [l.node.id, l.file]));
  console.log(JSON.stringify(order.map(id => decisions.find(d => d.id === id)!).map(d => ({
    id: d.id, file: fileOf.get(d.id), decider: d.decider, status: d.status, depends: d.depends,
    options: Object.keys(d.options), leaning: d.leaning, question: d.question, rests: d.because.basis,
  }))));
  process.exit(errors.length > 0 ? 1 : 0);
}
console.log(`WALLET DESIGN CHECK${partial ? ' (partial)' : ''}: ${errors.length === 0 ? 'VALID' : `FAILED (${errors.length})`}`);
console.log(
  `ground: ${count('figure')} figures · ${count('tx')} txs · ${count('law')} laws · ${count('constraint')} constraints · ${count('said')} said\n` +
    `design: ${count('person')} persons · ${jobs.size} jobs · ${decisions.length} decisions (${open.length} open, ${provisional.length} settled provisionally) · ${count('surface')} surfaces · ${count('screen')} screens · ${count('flow')} flows · ${count('need')} needs · ${count('capability')} capabilities · ${count('app')} apps · ${count('default')} defaults · ${count('gap')} gaps\n` +
    `talk: ${count('position')} positions · ${count('objection')} objections (${unanswered.length} unanswered) · ${count('reply')} replies\n` +
    `sentences rest on: ${Object.entries(basis).map(([k, v]) => `${k}=${v}`).join(' · ') || 'nothing yet'}`,
);
if (args.includes('--decisions')) {
  console.log('\nOpen decisions, dependencies first:');
  for (const id of open) {
    const d = decisions.find(x => x.id === id)!;
    console.log(`  ${d.id} [${d.decider}] leaning ${d.leaning}${d.depends.length ? ` (after ${d.depends.join(', ')})` : ''}\n    ${d.question}`);
  }
}
if (provisional.length > 0 && args.includes('--decisions')) {
  console.log('\nSettled provisionally (a maintainer decision waits for his answer):');
  for (const d of provisional) console.log(`  ${d.id} → ${d.leaning}${d.decider === 'maintainer' ? '  [his]' : ''}`);
}
if (unanswered.length > 0 && args.includes('--decisions')) {
  console.log('\nUnanswered objections:');
  for (const o of unanswered) console.log(`  ${o.id} → ${o.to} [${o.lens}] ${o.claim.text.slice(0, 140)}`);
}
for (const w of warnings) console.log(`  ~ ${w}`);
for (const e of errors) console.log(`  ! ${e}`);
process.exit(errors.length > 0 ? 1 : 0);
