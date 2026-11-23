import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const repoRoot = resolve(import.meta.dir, '../../../../..');
const packageJson = JSON.parse(readFileSync(join(repoRoot, 'package.json'), 'utf8')) as {
  scripts: Record<string, string>;
};
const parallelGateNames = (scriptName: string): string[] =>
  (packageJson.scripts[scriptName] ?? '').trim().split(/\s+/).slice(2);
const srcGateNames = (): string[] => parallelGateNames('check:src');

describe('full check orchestration', () => {
  test('runs short gates before parallel TypeScript, frontend, and React wallet gates', () => {
    expect(packageJson.scripts['check']).toBe('bun run check:short && bun run check:long');
    expect(parallelGateNames('check:long')).toEqual(['check:src', 'check:frontend', 'check:ui-types']);
    expect(packageJson.scripts['check:ui-types']).toBe('cd ui && bun run check');
    const uiPackage = JSON.parse(readFileSync(join(repoRoot, 'ui/package.json'), 'utf8'));
    expect(uiPackage.scripts.check).toBe('tsc --noEmit -p tsconfig.json --checkers 4');
    expect(srcGateNames()[0]).toBe('soundcheck:fast');
    expect(packageJson.scripts['soundcheck:fast']).toStartWith('bun tools/run-parallel-checks.ts ');
    expect(packageJson.scripts['soundcheck']).toBe(packageJson.scripts['soundcheck:fast']);
    expect(srcGateNames().filter(name => name.startsWith('rscore:'))).toEqual([]);
    expect(packageJson.scripts['check:src:parallel']).toBeUndefined();
  });

  test('parallel runner preserves child failure output and stops siblings', () => {
    const runner = readFileSync(join(repoRoot, 'tools/run-parallel-checks.ts'), 'utf8');
    expect(runner).toContain("stdout: 'inherit'");
    expect(runner).toContain("stderr: 'inherit'");
    expect(runner).toContain('if (exitCode !== 0) stopChildren()');
    expect(runner).toContain("child.kill('SIGTERM')");
    expect(runner).toContain('if (failed) process.exit(failed.exitCode || 1)');
  });
});

describe('FinTS negative-type gate registration', () => {
  test('type fixtures and brand minting run inside the runtime contract type check', () => {
    const script = packageJson.scripts['check:runtime-contract-types'] ?? '';
    expect(script).toContain('tsc -p tsconfig.runtime-contract-tests.json');
    expect(script).toContain('bun core/scripts/checks/fints/check-brand-minting.ts');
    expect(packageJson.scripts['check:fints-negative-types']).toBe('bun run check:runtime-contract-types');
    expect(srcGateNames()).toContain('check:runtime-contract-types');

    const tsconfig = JSON.parse(readFileSync(join(repoRoot, 'tsconfig.runtime-contract-tests.json'), 'utf8')) as {
      files: string[];
    };
    const fixtureRoot = join(repoRoot, 'core/__tests__/types/fints');
    const fixtures = [...new Bun.Glob('**/*.{positive,negative,widened}.ts').scanSync({ cwd: fixtureRoot })]
      .map(file => `core/__tests__/types/fints/${file}`)
      .sort();
    expect(fixtures.length).toBeGreaterThan(0);
    expect(tsconfig.files.filter(file => file.startsWith('core/__tests__/types/fints/')).sort()).toEqual(fixtures);
  });

  test('every negative fixture line carries an expect-error directive', () => {
    const fixtureRoot = join(repoRoot, 'core/__tests__/types/fints');
    for (const file of new Bun.Glob('**/*.negative.ts').scanSync({ cwd: fixtureRoot })) {
      expect(readFileSync(join(fixtureRoot, file), 'utf8')).toContain('@ts-expect-error');
    }
  });
});
