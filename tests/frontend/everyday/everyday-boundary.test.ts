import { describe, expect, test } from 'bun:test';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import {
  EVERYDAY_COPY,
  EVERYDAY_DESIGN_PREVIEW_STATES,
  splitMoneyDisplay,
} from '../../../frontend/src/lib/everyday/wallet-posture';

const REPO_ROOT = join(import.meta.dir, '../../..');

// Matches check.ts EVERYDAY_PLUMBING_JARGON_RE: regular-person copy never leaks protocol accounting.
const EVERYDAY_PLUMBING_JARGON_RE =
  /\b(collateral|unbacked|counterparty|credit ceiling|credit limit|ondelta|offdelta|r2c|r2r|r2e|htlc|hanko|jurisdiction|depository|co-signed|frame|lanes?|watchtower|dispute window|reserve)\b/i;

const EVERYDAY_UI_DIRS = [
  'ui/src/screens/everyday',
  'ui/src/components/everyday',
  'frontend/src/lib/components/Everyday',
] as const;

const FORBIDDEN_EVERYDAY_IMPORT_RE =
  /(?:docs\/studies\/|@xln\/surfaces|components\/Bars\b|DeltaBar\b|DeltaCapacityBar\b|BalanceDetails\b|CreditDetails\b|PaymentTopUp\b|screens\/(?:Move|Manage|Sovereignty)\b|EntityPanelTabs\b)/;

function collectStrings(value: unknown, path = 'EVERYDAY_COPY'): Array<{ path: string; text: string }> {
  if (typeof value === 'string') return [{ path, text: value }];
  if (Array.isArray(value)) return value.flatMap((entry, i) => collectStrings(entry, `${path}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, entry]) => collectStrings(entry, `${path}.${key}`));
  }
  return [];
}

function listSourceFiles(relDir: string): string[] {
  const absDir = join(REPO_ROOT, relDir);
  return readdirSync(absDir)
    .filter(name => /\.(ts|tsx|svelte)$/.test(name) && !name.includes('.test.'))
    .sort()
    .map(name => join(absDir, name));
}

describe('Everyday wallet production boundary (one-way study -> wallet)', () => {
  test('EVERYDAY_COPY and EVERYDAY_DESIGN_PREVIEW_STATES contain zero protocol/plumbing jargon', () => {
    const entries = [
      ...collectStrings(EVERYDAY_COPY),
      ...collectStrings(EVERYDAY_DESIGN_PREVIEW_STATES, 'EVERYDAY_DESIGN_PREVIEW_STATES'),
    ];
    expect(entries.length).toBeGreaterThanOrEqual(45);
    const violations = entries
      .map(entry => ({ ...entry, match: entry.text.match(EVERYDAY_PLUMBING_JARGON_RE)?.[0] ?? null }))
      .filter(entry => entry.match !== null);
    expect(violations).toEqual([]);
  });

  test('Everyday React and Svelte UI never import docs/studies, capacity bars, or manual plumbing screens', () => {
    const files = EVERYDAY_UI_DIRS.flatMap(listSourceFiles);
    expect(files.length).toBeGreaterThanOrEqual(15);
    const violations: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const match of source.matchAll(
        /(?:(?:import|export)\b[\s\S]*?\bfrom\s*|^\s*import\s+|import\s*\(\s*)['"]([^'"]+)['"]/gm,
      )) {
        const spec = match[1] ?? '';
        if (FORBIDDEN_EVERYDAY_IMPORT_RE.test(spec)) {
          violations.push(`${relative(REPO_ROOT, file)} -> ${spec}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  test('neither ui/ nor frontend/ imports anything from docs/studies/', () => {
    const prodRoots = ['ui/src', 'frontend/src'] as const;
    const violations: string[] = [];
    const walk = (absDir: string): void => {
      for (const entry of readdirSync(absDir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'build') continue;
        const next = join(absDir, entry.name);
        if (entry.isDirectory()) walk(next);
        else if (/\.(ts|tsx|svelte)$/.test(entry.name)) {
          const text = readFileSync(next, 'utf8');
          if (/(?:docs\/studies\/|@xln\/surfaces)/.test(text)) {
            violations.push(relative(REPO_ROOT, next));
          }
        }
      }
    };
    for (const root of prodRoots) walk(join(REPO_ROOT, root));
    expect(violations).toEqual([]);
  });

  test('splitMoneyDisplay splits dollars, cents, and unit suffixes without altering text', () => {
    expect(splitMoneyDisplay('$99.89')).toEqual({ major: '$99', minor: '.89', suffix: '' });
    expect(splitMoneyDisplay('$1,234.50')).toEqual({ major: '$1,234', minor: '.50', suffix: '' });
    expect(splitMoneyDisplay('1.25 ETH')).toEqual({ major: '1', minor: '.25', suffix: ' ETH' });
    expect(splitMoneyDisplay('$0')).toEqual({ major: '$0', minor: '', suffix: '' });
    for (const sample of ['$99.89', '$1,234.50', '1.25 ETH', '$0']) {
      const parts = splitMoneyDisplay(sample);
      expect(`${parts.major}${parts.minor}${parts.suffix}`).toBe(sample);
    }
  });

  test('semantic --credit token stays decoupled from interactive --accent', () => {
    const tokensCss = readFileSync(join(REPO_ROOT, 'ui/src/styles/tokens.css'), 'utf8');
    const designTs = readFileSync(join(REPO_ROOT, 'ui/src/runtime/design.ts'), 'utf8');
    expect(designTs).not.toContain("setProperty('--credit'");
    expect(tokensCss).not.toContain('--credit: #7a73ff');
    expect(tokensCss).not.toContain('--credit: #635bff');
  });
});
