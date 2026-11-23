import { Glob } from 'bun';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

type Pattern = { re: RegExp; label: string };

type Rule = {
  id: string;
  title: string;
  /** Globs relative to cwd. A glob-free entry is a single file that must exist. */
  roots: string[];
  /** Scan `git ls-files` entries matching `roots` instead of walking the disk. */
  tracked?: boolean;
  /** Path fragments matched against `/<repo-relative path>`. */
  exclude?: string[];
  excludePrefix?: string[];
  skipDts?: boolean;
  skipComments?: boolean;
  /** Lines containing this marker are exempt. */
  lineMarker?: string;
  /** Report at most one pattern per line. */
  firstMatchOnly?: boolean;
  patterns?: Pattern[];
  /** Exact `file:label` exemptions. */
  allow?: Set<string>;
  /** Exact file plus literal line substring exemptions. */
  allowLine?: ReadonlyArray<readonly [file: string, substring: string]>;
  maxLines?: number;
};

const SOURCE_EXT = '{ts,tsx,js,jsx,svelte}';
const GENERATED = ['/node_modules/', '/dist/', '/test-results/', '/frontend/static/', '/core/typechain/', '/.logs/'];

const WEAK_COLLECTION_ROOTS = [
  'agents', 'ai', 'brainvault', 'cli', 'custody', 'design', 'e2e', 'frontend/src', 'jurisdictions',
  'native', 'ops', 'packages', 'release', 'core', 'scripts', 'tests', 'tools', 'types', 'ui/src',
];

const LEGACY_ROOTS = [
  '.github', 'cli', 'custody', 'frontend/src', 'jurisdictions', 'native', 'ops', 'packages',
  'release', 'core', 'scripts', 'tests', 'tools', 'ui/src',
];
const LEGACY_EXT = '{ts,tsx,js,jsx,cjs,mjs,svelte,sol,sh,py,json,jsonc,yml,yaml}';

const RULES: Rule[] = [
  {
    id: 'weak-collections',
    title: 'Forbidden weak collection usage detected. Use persisted state or explicit lifecycle cleanup.',
    roots: WEAK_COLLECTION_ROOTS.map(root => `${root}/**/*.${SOURCE_EXT}`),
    skipDts: true,
    exclude: [
      ...GENERATED,
      '/frontend/build/',
      '/packages/npm/xlnfinance/app/',
      '/playwright-report/',
      '/jurisdictions/artifacts/',
      '/jurisdictions/cache/',
      '/jurisdictions/lib/',
      '/native/target/',
    ],
    patterns: [{ re: new RegExp(`\\b${'Weak'}(?:Map|Set)\\b`), label: 'weak-collection' }],
  },
  {
    id: 'manual-delta-math',
    title: 'Manual delta math detected. Use deriveDelta() instead.',
    roots: ['tests', 'core/scenarios', 'frontend/src/lib/components/Entity'].map(root => `${root}/**/*.${SOURCE_EXT}`),
    skipDts: true,
    exclude: GENERATED,
    lineMarker: 'DELTA_MATH_ALLOWED',
    firstMatchOnly: true,
    patterns: [
      { re: /\bondelta\s*\+\s*offdelta\b/, label: 'manual-total-delta' },
      { re: /\boffdelta\s*\+\s*ondelta\b/, label: 'manual-total-delta' },
    ],
  },
  {
    id: 'active-infra',
    title: 'State-machine layer must not actively call infra/jadapter:',
    roots: [
      'core/entity/tx/apply.ts',
      'core/entity/tx/j-events.ts',
      'core/entity/tx/handlers/dispute/index.ts',
      'core/entity/tx/handlers/dispute/shared.ts',
      'core/entity/tx/handlers/dispute/start.ts',
      'core/entity/tx/handlers/dispute/start-admission.ts',
      'core/entity/tx/handlers/dispute/start-evidence.ts',
      'core/entity/tx/handlers/dispute/start-hanko.ts',
      'core/entity/tx/handlers/dispute/finalize.ts',
      'core/entity/tx/handlers/dispute/finalize-admission.ts',
      'core/entity/tx/handlers/dispute/finalize-proof.ts',
      'core/entity/tx/handlers/j-batch/j-broadcast.ts',
      'core/account/consensus/index.ts',
      'core/entity/consensus/leader/certificates.ts',
      'core/entity/consensus/j-prefix/prefix-round.ts',
      'core/entity/consensus/state-quota.ts',
      'core/entity/consensus/input/consensus.ts',
      'core/entity/consensus/frame/application.ts',
      'core/runtime/j-submit/j-submit.ts',
    ],
    patterns: [
      { re: /\.getAccountInfo\s*\(/, label: 'jadapter.getAccountInfo' },
      { re: /\.getEntityNonce\s*\(/, label: 'jadapter.getEntityNonce' },
      { re: /\.hasProcessedBatch\s*\(/, label: 'jadapter.hasProcessedBatch' },
      { re: /\.defaultDisputeDelay\s*\(/, label: 'depository.defaultDisputeDelay' },
      { re: /\._collaterals\s*\(/, label: 'depository._collaterals' },
      { re: /\.provider\.getBlockNumber\s*\(/, label: 'provider.getBlockNumber' },
      { re: /\.processBlock\s*\(/, label: 'jadapter.processBlock' },
    ],
  },
  {
    id: 'determinism',
    title: 'RJEA determinism guard failed. Use env.timestamp / deterministic seeds only.',
    roots: ['core/account', 'core/entity', 'core/lendbook', 'core/jurisdiction/machine', 'core/runtime/frame']
      .map(root => `${root}/**/*.{ts,tsx,js,jsx}`),
    skipDts: true,
    skipComments: true,
    exclude: ['/__tests__/', '/typechain/'],
    patterns: [
      { re: /\bDate\.now\s*\(/, label: 'Date.now' },
      { re: /\bnew\s+Date\s*\(/, label: 'new Date' },
      { re: /\bMath\.random\s*\(/, label: 'Math.random' },
      { re: /\bperformance\.now\s*\(/, label: 'performance.now' },
      { re: /\bsetTimeout\s*\(/, label: 'setTimeout' },
      { re: /\bsetInterval\s*\(/, label: 'setInterval' },
      { re: /\brandomBytes\s*\(/, label: 'randomBytes' },
      { re: /\brandomUUID\s*\(/, label: 'randomUUID' },
      { re: /\bgetRandomValues\s*\(/, label: 'getRandomValues' },
    ],
    // These calls operate only on the live replica envelope or external ingress;
    // none contributes bytes to Runtime, Entity, Account, or Jurisdiction state.
    // Keep every exception exact so adding another nondeterministic call fails CI.
    allow: new Set([
      'core/paybook/payment-admission.ts:getRandomValues',
      'core/runtime/frame/process-profile.ts:Date.now',
      'core/runtime/frame/lifecycle/start.ts:Date.now',
    ]),
  },
  {
    id: 'frontend-file-size',
    title: 'Source file-size invariant failed: max 3000 lines per handwritten file.',
    roots: ['core', 'frontend/src', 'tests', 'scripts', 'jurisdictions'].map(root => `${root}/**/*.{svelte,ts,tsx,js,cjs,mjs,css,sol,sh}`),
    skipDts: true,
    // Foundry installs third-party Solidity sources under jurisdictions/lib. They
    // are dependencies, not handwritten xln code.
    exclude: ['/node_modules/', '/artifacts/', '/cache/', '/typechain-types/', '/build/', '/.svelte-kit/', '/jurisdictions/lib/'],
    maxLines: 3000,
  },
  {
    id: 'english-source',
    title: 'English-only source invariant failed:',
    roots: ['**/*.{cjs,js,json,md,mjs,py,sol,svelte,ts,tsx}'],
    tracked: true,
    // Authorized Russian publications live below docs/ru/. External projects keep
    // their own source-language policy.
    excludePrefix: ['docs/ru/', '.archive/', 'ai/', 'brainvault/'],
    patterns: [{ re: /[\u0400-\u04FF]/u, label: 'cyrillic' }],
    // Multilingual product data and dated owner reports. Keep this list exact: a
    // directory-wide exemption would let Russian comments leak into source code.
    allow: new Set([
      'docs/evidence/improvement-loop-20260918/quorum-result-02.json',
      'docs/evidence/improvement-loop-20260918/quorum-result-06.json',
      'docs/evidence/improvement-loop-20260918/quorum-result-07.json',
      'docs/evidence/improvement-loop-20260918/quorum-result-11.json',
      'docs/evidence/improvement-loop-20260918/quorum-result.json',
      'docs/evidence/ios-ux-20260918/quorum-result.json',
      'docs/ios-e2e-video-2026-09-13.md',
      'docs/ios-native-plan.md',
      'docs/ios-storage-recovery-2026-09-13.md',
      'docs/three-hub-stage-2026-09-13.md',
      'docs/xln-gtm-review-2026-09-13.md',
      'frontend/src/lib/ai/xln-guide-context.ts',
      // Bundled browser runtime: compressed BIP39 tables decode as Cyrillic.
      // Source of truth is brainvault/.
      'ui/public/runtime.js',
    ].map(file => `${file}:cyrillic`)),
  },
  {
    // XLN is pre-mainnet: a word like "legacy" or "backwards compatible" is a
    // second code path consensus does not exercise, or a silent reader that
    // accepts state the canonical producer never writes. The vocabulary is banned
    // and every genuine exception is named exactly in allowLine.
    id: 'no-legacy',
    title: 'NO_LEGACY_VIOLATION: first-party source may not carry compatibility vocabulary.\n'
      + 'Delete the second code path, or add an exact allowance with a reason.',
    roots: LEGACY_ROOTS.map(root => `${root}/**/*.${LEGACY_EXT}`),
    firstMatchOnly: true,
    exclude: [
      '/generated/', '/node_modules/', '/artifacts/', '/typechain/', '/cache/', '/dist/', '/build/', '/target/',
      '/forge-out/', '/build-tron/', '/jurisdictions/lib/', '/static/', '/packages/npm/xlnfinance/app/',
      // Immutable historical evidence records the names that existed at release time.
      '/docs/releases/data/',
      '/audits/evidence/',
      // These checkers necessarily name the words they forbid.
      'core/scripts/checks/policy/check-text-rules.ts',
      'core/scripts/checks/architecture/check-canonical-vocabulary.ts',
      'core/scripts/checks/consensus/check-canonical-identity-scan.ts',
      'core/scripts/checks/consensus/check-failure-taxonomy-scan.ts',
      'core/scripts/checks/contracts/check-onchain-hanko-ast.ts',
      'core/scripts/checks/consensus/check-consensus-hanko-scan.ts',
    ],
    patterns: [
      { re: /legacy/i, label: 'legacy' },
      { re: /deprecated/i, label: 'deprecated' },
      { re: /fallback/i, label: 'fallback' },
      { re: /backward\s?compat/i, label: 'backward-compat' },
      { re: /backwards\s?compat/i, label: 'backwards-compat' },
      { re: /compatibility alias/i, label: 'compatibility-alias' },
      // An optional field justified by the age of the data it reads is a
      // compatibility reader wearing a comment.
      { re: /older (?:data|scenario|record|run|client)/i, label: 'older-data' },
      // Anything kept *for* compatibility is kept for no live reason.
      { re: /(?:kept|retained|preserved) for [a-z ]*compat/i, label: 'kept-for-compat' },
      { re: /for (?:caller|callsite|call-site|consumer|client) compat/i, label: 'for-caller-compat' },
      // A numbered in-house domain or API implies a retained predecessor. There is
      // one canonical producer/reader; testnet cutovers replace it atomically.
      { re: /xln:[^'"\s]+:v[2-9]\b/i, label: 'versioned-domain' },
      { re: /\b(?:const|function|class|interface|type)\s+\w+(?:V|v)[2-9]\b/, label: 'versioned-identifier' },
      { re: /['"`][^'"`\n]*\/v[2-9](?:\/|[?'"`])/i, label: 'versioned-route' },
      // Retired pre-mainnet surfaces are checked here so compatibility has one gate.
      { re: /\bprocessJBlockEvents\b/, label: 'retired-surface' },
      { re: /\bevms\s*:/, label: 'retired-surface' },
      { re: /\.evms\b/, label: 'retired-surface' },
    ],
    allowLine: [
      ['jurisdictions/external/weth9.json', '"type": "fallback"'],
      ['jurisdictions/external/wtrx.json', '"type": "fallback"'],
      ['frontend/svelte.config.js', "fallback: 'index.html'"],
      ['core/__tests__/development/frontend/frontend-check-output.test.ts', "fallback: 'index.html'"],
      ['core/jurisdiction/adapter/browservm/browservm-provider.ts', 'createLegacyTx'],
      ['jurisdictions/scripts/verify/verify-public-stack.ts', 'https://sourcify.dev/server/v2/'],
    ],
  },
];

const isCommentLine = (line: string): boolean => {
  const trimmed = line.trim();
  return trimmed.length === 0 || trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*');
};

const listFiles = (rule: Rule): string[] => {
  const files = new Set<string>();
  if (rule.tracked) {
    const matchers = rule.roots.map(root => new Glob(root));
    const tracked = execFileSync('git', ['ls-files'], { encoding: 'utf8', maxBuffer: 1 << 28 }).split(/\r?\n/u);
    for (const file of tracked) {
      if (file && matchers.some(matcher => matcher.match(file)) && existsSync(file)) files.add(file);
    }
    return [...files];
  }
  for (const root of rule.roots) {
    if (!/[*{]/.test(root)) {
      if (!existsSync(root)) throw new Error(`TEXT_RULE_ROOT_MISSING rule=${rule.id} root=${root}`);
      files.add(root);
      continue;
    }
    for (const file of new Glob(root).scanSync({ dot: true, onlyFiles: true })) files.add(file);
  }
  return [...files];
};

const isScanned = (rule: Rule, file: string): boolean =>
  !(rule.skipDts && file.endsWith('.d.ts'))
  && !rule.exclude?.some(fragment => `/${file}`.includes(fragment))
  && !rule.excludePrefix?.some(prefix => file.startsWith(prefix));

const lineFindings = (rule: Rule, file: string, lines: string[]): string[] => {
  const findings: string[] = [];
  lines.forEach((line, index) => {
    if (rule.skipComments && isCommentLine(line)) return;
    if (rule.lineMarker && line.includes(rule.lineMarker)) return;
    for (const { re, label } of rule.patterns ?? []) {
      if (!re.test(line)) continue;
      if (rule.allow?.has(`${file}:${label}`)) continue;
      if (rule.allowLine?.some(([allowedFile, substring]) => allowedFile === file && line.includes(substring))) continue;
      findings.push(`- ${file}:${index + 1} [${label}] ${line.trim()}`);
      if (rule.firstMatchOnly) return;
    }
  });
  return findings;
};

export const runTextRule = (id: string): boolean => {
  const rule = RULES.find(candidate => candidate.id === id);
  if (!rule) throw new Error(`TEXT_RULE_UNKNOWN id=${id} known=${RULES.map(candidate => candidate.id).join(',')}`);
  const files = listFiles(rule).filter(file => isScanned(rule, file)).sort();
  const findings: string[] = [];
  const oversized: Array<{ file: string; lines: number }> = [];
  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    const lines = text.split('\n');
    if (lines.at(-1) === '') lines.pop();
    if (rule.maxLines !== undefined && lines.length > rule.maxLines) oversized.push({ file, lines: lines.length });
    findings.push(...lineFindings(rule, file, lines));
  }
  oversized.sort((a, b) => b.lines - a.lines || (a.file < b.file ? -1 : 1));
  findings.push(...oversized.map(({ file, lines }) => `- ${file}: ${lines} lines`));
  if (findings.length > 0) {
    console.error(`${rule.title}\n${findings.join('\n')}`);
    return false;
  }
  console.log(`TEXT_RULE_OK rule=${rule.id} files=${files.length}`);
  return true;
};

if (import.meta.main) {
  const ids = process.argv.slice(2).flatMap(argument => (argument.startsWith('--rule=') ? [argument.slice('--rule='.length)] : []));
  if (ids.length === 0 || ids.length !== process.argv.length - 2) {
    throw new Error(`Usage: bun check-text-rules.ts --rule=<id> [--rule=<id>...]; ids: ${RULES.map(rule => rule.id).join(', ')}`);
  }
  process.exit(ids.map(runTextRule).every(Boolean) ? 0 : 1);
}
