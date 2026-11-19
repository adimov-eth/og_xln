// Round 2 Empirical Probe: Hostile & Legitimate XLN Program Intents vs. Candidate Signing Sheets.
// 100% local subscription CLIs (xAI grok + Anthropic claude; plus dry export for cold Gemini subagent).
// Zero external API keys or OpenRouter calls.
//
// Usage:
//   bun docs/studies/ui/surfaces/probes/run-signing-sweep.ts dry
//   bun docs/studies/ui/surfaces/probes/run-signing-sweep.ts sweep

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_REPO_ROOT, validateSpecFiles } from '../check.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const SURFACES_DIR = resolve(HERE, '..');
const BASE_SCM = join(SURFACES_DIR, 'base.scm');

interface ScenarioDelta {
  counterparty: string;
  deltaSecured: string;
  deltaUnbackedRisk: string;
  deltaCreditLimit: string;
  deltaOwed: string;
  feeExact: string;
  expiryDeadline: string;
}

interface LoadedSheet {
  id: string;
  shows: string[];
  feeBefore: boolean;
  survival: { text: string };
  warns: Array<{ text: string }>;
}

interface LoadedApp {
  id: string;
  appKind: string;
  claimShown: { text: string };
  requests: string[];
}

interface ProbeCell {
  cellId: string;
  hypothesis: string;
  expectedDecision: 'APPROVE' | 'REJECT';
  displayOrigin: string;
  app: LoadedApp;
  sheet: LoadedSheet;
  perspective: string;
  delta: ScenarioDelta;
}

const SYSTEM_PROMPT =
  'You are an everyday user reviewing a wallet signing screen triggered by an app. You have NO outside context beyond the screen below. Answer concisely in 4 numbered lines.';

const PROBE_QUESTIONS = [
  'Reply with ONLY 4 numbered lines:',
  '1. DECISION: APPROVE or REJECT',
  '2. MAX_UNBACKED_OR_CREDIT_RISK: Dollar amount of unbacked claim or credit limit risk you take if you approve (or 0).',
  '3. FEE: Fee amount you pay if you approve.',
  '4. IF_COUNTERPARTY_VANISHES: In one short sentence, what happens to the money in this action if the counterparty disappears tonight?',
].join('\n');

function renderSigningPrompt(
  app: LoadedApp,
  sheet: LoadedSheet,
  d: ScenarioDelta,
  displayOrigin: string,
): string {
  const showSet = new Set(sheet.shows);
  const lines: string[] = [
    '=== PROGRAM SCREEN ===',
    `App: ${displayOrigin}`,
    `What the app says: "${app.claimShown.text}"`,
    '',
    '=== WALLET SIGNING SHEET ===',
    `Requested actions: ${app.requests.join(', ')}`,
  ];
  if (showSet.has('program-origin')) {
    const kindLabel = app.appKind === 'external' || app.appKind === 'hostile-test' ? 'external app' : app.appKind;
    lines.push(`Origin: ${displayOrigin} (${kindLabel})`);
  }
  if (showSet.has('counterparty')) lines.push(`Counterparty: ${d.counterparty}`);
  if (showSet.has('delta-secured')) lines.push(`Locked collateral change: ${d.deltaSecured}`);
  if (showSet.has('delta-unbacked-risk')) lines.push(`Unbacked counterparty claim change: ${d.deltaUnbackedRisk}`);
  if (showSet.has('delta-credit-limit')) lines.push(`Unsecured credit limit change: ${d.deltaCreditLimit}`);
  if (showSet.has('delta-owed')) lines.push(`Debt you owe change: ${d.deltaOwed}`);
  if (sheet.feeBefore && showSet.has('fee-exact')) lines.push(`Fee: ${d.feeExact}`);
  if (showSet.has('expiry-deadline')) lines.push(`Deadline: ${d.expiryDeadline}`);
  lines.push(`If counterparty disappears: ${sheet.survival.text}`);
  for (const w of sheet.warns) lines.push(`Notice: ${w.text}`);
  lines.push('', 'Choices: APPROVE or REJECT');
  return lines.join('\n');
}

async function loadPerspective(fileName: string) {
  const path = join(SURFACES_DIR, 'perspectives', fileName);
  const res = await validateSpecFiles([BASE_SCM, path], DEFAULT_REPO_ROOT, { perspectiveOnly: true });
  if (res.errors.length > 0) {
    throw new Error(`${fileName} failed validation:\n${res.errors.join('\n')}`);
  }
  return res;
}

function mustSheet(sheets: LoadedSheet[], id: string): LoadedSheet {
  const found = sheets.find(s => s.id === id);
  if (!found) throw new Error(`Missing signing-sheet '${id}'`);
  return found;
}

function mustApp(apps: LoadedApp[], id: string): LoadedApp {
  const found = apps.find(a => a.id === id);
  if (!found) throw new Error(`Missing xln-app '${id}'`);
  return found;
}

async function buildCells(): Promise<ProbeCell[]> {
  const [p1, p2, p3, p4] = await Promise.all([
    loadPerspective('p1-consumer.scm'),
    loadPerspective('p2-sovereign.scm'),
    loadPerspective('p3-commercial.scm'),
    loadPerspective('p4-steward-redteam.scm'),
  ]);

  const p1Sheet = mustSheet(p1.signingSheets, 'kernel-sheet');
  const p2Spend = mustSheet(p2.signingSheets, 'sheet-spend');
  const p2Exposure = mustSheet(p2.signingSheets, 'sheet-exposure');
  const p3Sheet = mustSheet(p3.signingSheets, 'desk-sign');
  const p4Sheet = mustSheet(p4.signingSheets, 'kernel-intent-firewall');

  const appCheckout = mustApp(p1.apps, 'merchant-checkout');
  const appReward = mustApp(p4.apps, 'disguised-10k-credit-reward');
  const appSwapBait = { ...mustApp(p4.apps, 'unbacked-swap-bait'), requests: ['instant-swap'] };
  const appFeeDrain = mustApp(p4.apps, 'hidden-fee-drain');
  const appStalledTrap = mustApp(p4.apps, 'stalled-hub-trap');

  const deltaReward: ScenarioDelta = {
    counterparty: 'PromoHub-7',
    deltaSecured: '0.00 USDC',
    deltaUnbackedRisk: '0.00 USDC now (up to 10,000.00 USDC if hub issues IOUs)',
    deltaCreditLimit: '+10,000.00 USDC',
    deltaOwed: '0.00 USDC',
    feeExact: '0.00 USDC',
    expiryDeadline: 'Until revoked',
  };

  // Critical H2 seam: counterparty already has open credit room, so deltaCreditLimit is 0.00,
  // while -1,000 USDC locked collateral is traded for +1,005 USDT unbacked IOU.
  const deltaSwapInsideCreditRoom: ScenarioDelta = {
    counterparty: 'ShadowMM-Desk',
    deltaSecured: '-1,000.00 USDC',
    deltaUnbackedRisk: '+1,005.00 USDT',
    deltaCreditLimit: '0.00 USDC',
    deltaOwed: '0.00 USDC',
    feeExact: '0.00 USDC',
    expiryDeadline: '30 seconds',
  };

  const deltaLegitCheckout: ScenarioDelta = {
    counterparty: 'CornerCoffee-NYC via H1',
    deltaSecured: '-25.05 USDC',
    deltaUnbackedRisk: '0.00 USDC',
    deltaCreditLimit: '0.00 USDC',
    deltaOwed: '0.00 USDC',
    feeExact: '0.05 USDC',
    expiryDeadline: '60 seconds',
  };

  const deltaFeeDrain: ScenarioDelta = {
    counterparty: 'API-Relay-9',
    deltaSecured: '-250.00 USDC',
    deltaUnbackedRisk: '0.00 USDC',
    deltaCreditLimit: '0.00 USDC',
    deltaOwed: '0.00 USDC',
    feeExact: '245.00 USDC (maxSenderDebit ceiling)',
    expiryDeadline: 'Recurring policy until cancelled',
  };

  const deltaStalledTrap: ScenarioDelta = {
    counterparty: 'StalledHub-H1',
    deltaSecured: '-500.00 USDC',
    deltaUnbackedRisk: '+500.00 USDC',
    deltaCreditLimit: '+500.00 USDC',
    deltaOwed: '0.00 USDC',
    feeExact: '15.00 USDC',
    expiryDeadline: '365 days',
  };

  return [
    { cellId: 'H1-p1-reward', hypothesis: 'H1', expectedDecision: 'REJECT', displayOrigin: 'rewards.promohub.io', app: appReward, sheet: p1Sheet, perspective: 'p1-consumer', delta: deltaReward },
    { cellId: 'H1-p2-reward', hypothesis: 'H1', expectedDecision: 'REJECT', displayOrigin: 'rewards.promohub.io', app: appReward, sheet: p2Exposure, perspective: 'p2-sovereign', delta: deltaReward },
    { cellId: 'H2-p2-verb-swap', hypothesis: 'H2', expectedDecision: 'REJECT', displayOrigin: 'instant.mm-desk.io', app: appSwapBait, sheet: p2Spend, perspective: 'p2-verb-dispatch', delta: deltaSwapInsideCreditRoom },
    { cellId: 'H2-p2-delta-swap', hypothesis: 'H2', expectedDecision: 'REJECT', displayOrigin: 'instant.mm-desk.io', app: appSwapBait, sheet: p2Exposure, perspective: 'p2-delta-dispatch', delta: deltaSwapInsideCreditRoom },
    { cellId: 'H3-p4-legit-checkout', hypothesis: 'H3', expectedDecision: 'APPROVE', displayOrigin: 'checkout.cornercoffee.nyc', app: appCheckout, sheet: p4Sheet, perspective: 'p4-steward-redteam', delta: deltaLegitCheckout },
    { cellId: 'H3-p1-legit-checkout', hypothesis: 'H3', expectedDecision: 'APPROVE', displayOrigin: 'checkout.cornercoffee.nyc', app: appCheckout, sheet: p1Sheet, perspective: 'p1-consumer', delta: deltaLegitCheckout },
    { cellId: 'H3-p2-legit-checkout', hypothesis: 'H3', expectedDecision: 'APPROVE', displayOrigin: 'checkout.cornercoffee.nyc', app: appCheckout, sheet: p2Spend, perspective: 'p2-sovereign', delta: deltaLegitCheckout },
    { cellId: 'H4a-p3-fee-drain', hypothesis: 'H4', expectedDecision: 'REJECT', displayOrigin: 'pass.apirelay.io', app: appFeeDrain, sheet: p3Sheet, perspective: 'p3-commercial', delta: deltaFeeDrain },
    { cellId: 'H4b-p3-stalled-trap', hypothesis: 'H4', expectedDecision: 'REJECT', displayOrigin: 'fast-release.h1-sync.io', app: appStalledTrap, sheet: p3Sheet, perspective: 'p3-commercial', delta: deltaStalledTrap },
  ];
}

interface RunnerSpec {
  id: string;
  lineage: string;
  ask: (fullPrompt: string) => Promise<string>;
}

async function execCli(cmd: string[], stdinText?: string): Promise<string> {
  const proc = Bun.spawn(cmd, {
    cwd: '/tmp',
    stdin: stdinText !== undefined ? new TextEncoder().encode(stdinText) : undefined,
    stdout: 'pipe',
    stderr: 'pipe',
    env: {
      ...process.env,
      PATH: `${process.env.HOME}/.bun/bin:/opt/homebrew/bin:${process.env.HOME}/.local/bin:${process.env.PATH ?? ''}`,
    },
  });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(`CLI exit ${exitCode}: ${stderr.trim() || stdout.trim()}`);
  }
  const out = stdout.trim();
  if (!out) throw new Error(`Empty stdout (stderr: ${stderr.trim().slice(0, 200)})`);
  return out;
}

const FRONTIER_RUNNERS: RunnerSpec[] = [
  {
    id: 'grok-4.7',
    lineage: 'xai-grok-4.7',
    ask: prompt =>
      execCli([
        'grok',
        '-m',
        'grok-4.7',
        '--disable-web-search',
        '--tools',
        '',
        '--system-prompt-override',
        SYSTEM_PROMPT,
        '-p',
        prompt,
      ]),
  },
  {
    id: 'claude-sonnet-flagship',
    lineage: 'anthropic-claude-flagship',
    ask: prompt =>
      execCli([
        'claude',
        '-p',
        '--disallowedTools',
        'Bash Read Edit Write Glob Grep LS WebFetch WebSearch NotebookEdit TodoWrite',
        '--system-prompt',
        SYSTEM_PROMPT,
        prompt,
      ]),
  },
];

const FAST_RUNNERS: RunnerSpec[] = [
  {
    id: 'grok-4.7-build-fast',
    lineage: 'xai-grok-4.7-fast',
    ask: prompt =>
      execCli([
        'grok',
        '-m',
        'grok-4.7-build-fast',
        '--disable-web-search',
        '--tools',
        '',
        '--system-prompt-override',
        SYSTEM_PROMPT,
        '-p',
        prompt,
      ]),
  },
  {
    id: 'claude-haiku',
    lineage: 'anthropic-claude-haiku',
    ask: prompt =>
      execCli([
        'claude',
        '-p',
        '--model',
        'haiku',
        '--disallowedTools',
        'Bash Read Edit Write Glob Grep LS WebFetch WebSearch NotebookEdit TodoWrite',
        '--system-prompt',
        SYSTEM_PROMPT,
        prompt,
      ]),
  },
];

export function scoreReply(reply: string) {
  const decisionMatch = reply.match(/1\.\s*(?:DECISION:\s*)?\**(APPROVE|REJECT)\**/i);
  const decision = (decisionMatch?.[1]?.toUpperCase() ?? 'UNKNOWN') as 'APPROVE' | 'REJECT' | 'UNKNOWN';
  const line = (n: number) =>
    (reply.match(new RegExp(`(?:^|\\n)\\s*\\**${n}[.):]\\**\\s*([^\\n]+)`))?.[1] ?? '').trim();
  return {
    decision,
    q2Risk: line(2),
    q3Fee: line(3),
    q4Survival: line(4),
  };
}

const mode = process.argv[2] ?? 'dry';
const cells = await buildCells();

if (mode === 'dry') {
  const dryBundle = cells.map(c => ({
    cellId: c.cellId,
    hypothesis: c.hypothesis,
    perspective: c.perspective,
    sheetId: c.sheet.id,
    expectedDecision: c.expectedDecision,
    prompt: `${renderSigningPrompt(c.app, c.sheet, c.delta, c.displayOrigin)}\n\n${PROBE_QUESTIONS}`,
  }));
  const outDir = join(HERE, 'runs-signing');
  mkdirSync(outDir, { recursive: true });
  writeFileSync(join(outDir, 'cells.json'), JSON.stringify(dryBundle, null, 2), 'utf8');
  console.log(`Prepared ${cells.length} sealed signing-sheet cells -> ${join(outDir, 'cells.json')}\n`);
  for (const b of dryBundle) {
    console.log(`### ${b.cellId} (${b.perspective} / ${b.sheetId}, expect=${b.expectedDecision})\n${b.prompt}\n`);
  }
  process.exit(0);
}

const outDir = join(HERE, 'runs-signing');
mkdirSync(outDir, { recursive: true });
const results: Array<Record<string, unknown>> = [];

const activeRunners = mode === 'sweep-fast' ? FAST_RUNNERS : FRONTIER_RUNNERS;
const outFile = mode === 'sweep-fast' ? 'summary-fast.json' : 'summary-frontier.json';

for (const cell of cells) {
  const fullPrompt = `${renderSigningPrompt(cell.app, cell.sheet, cell.delta, cell.displayOrigin)}\n\n${PROBE_QUESTIONS}`;
  await Promise.all(
    activeRunners.map(async runner => {
      try {
        const reply = await runner.ask(fullPrompt);
        const scored = scoreReply(reply);
        const matchesExpected = scored.decision === cell.expectedDecision;
        const rec = {
          cellId: cell.cellId,
          hypothesis: cell.hypothesis,
          perspective: cell.perspective,
          sheetId: cell.sheet.id,
          expectedDecision: cell.expectedDecision,
          runner: runner.id,
          lineage: runner.lineage,
          matchesExpected,
          ...scored,
          reply,
        };
        results.push(rec);
        writeFileSync(join(outDir, `${cell.cellId}--${runner.id}.json`), JSON.stringify(rec, null, 2), 'utf8');
        console.log(
          `${cell.cellId.padEnd(22)} ${runner.id.padEnd(22)} decision=${scored.decision.padEnd(8)} match=${matchesExpected} risk="${scored.q2Risk.slice(0, 28)}"`,
        );
      } catch (err) {
        const rec = { cellId: cell.cellId, runner: runner.id, error: String(err) };
        results.push(rec);
        console.error(`[ERROR] ${cell.cellId} ${runner.id}: ${String(err)}`);
      }
    }),
  );
}

writeFileSync(join(outDir, outFile), JSON.stringify({ tier: mode, count: results.length, results }, null, 2), 'utf8');
console.log(`Saved ${results.length} subscription CLI evaluations -> ${join(outDir, outFile)}`);
