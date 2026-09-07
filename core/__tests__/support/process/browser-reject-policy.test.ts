import { afterAll, expect, test } from 'bun:test';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { runInNewContext } from 'node:vm';
import { safeStringify } from '../../../protocol/serialization';

const directory = mkdtempSync(join(tmpdir(), 'xln-browser-policy-'));
const modulePath = resolve(import.meta.dir, '../../../support/process/runtime-process.ts');
const entry = join(directory, 'entry.ts');
writeFileSync(entry, `
import { isProductionRuntime, rejectFailFast, nodeProcess, runtimeIsBrowser, runtimeProcessEnv } from ${safeStringify(modulePath)};
globalThis.policy = { isProductionRuntime, rejectFailFast, nodeProcess, runtimeIsBrowser, runtimeProcessEnv };
`);
afterAll(() => rmSync(directory, { recursive: true, force: true }));

type Policy = {
  isProductionRuntime: boolean;
  rejectFailFast: () => boolean;
  nodeProcess: unknown;
  runtimeIsBrowser: boolean;
  runtimeProcessEnv: Record<string, string>;
};

const bundle = async (mode: string): Promise<string> => {
  const result = await Bun.build({
    entrypoints: [entry], target: 'browser', minify: true,
    define: { 'process.env.NODE_ENV': safeStringify(mode) },
  });
  expect(result.success).toBe(true);
  return result.outputs[0]!.text();
};

for (const surface of ['page', 'worker']) {
  test(`${surface}: production drops remote rejects, development fails fast, overrides win`, async () => {
    for (const mode of ['production', 'development']) {
      const context: { policy?: Policy; window?: object } = surface === 'page' ? { window: {} } : {};
      runInNewContext(await bundle(mode), context);
      const policy = context.policy!;
      expect(policy.runtimeIsBrowser).toBe(true);
      expect(policy.nodeProcess).toBeUndefined();
      expect(policy.isProductionRuntime).toBe(mode === 'production');
      expect(policy.rejectFailFast()).toBe(mode !== 'production');
      policy.runtimeProcessEnv['XLN_REJECT_FAIL_FAST'] = '1';
      expect(policy.rejectFailFast()).toBe(true);
      policy.runtimeProcessEnv['XLN_REJECT_FAIL_FAST'] = 'off';
      expect(policy.rejectFailFast()).toBe(false);
    }
  });
}

test('existing Node process and runtime environment remain authoritative', async () => {
  const process = globalThis.process;
  const context: { policy?: Policy; process: typeof process } = { process };
  runInNewContext(await bundle('production'), context);
  expect(context.process).toBe(process);
  expect(context.policy!.nodeProcess).toBe(process);
  expect(context.policy!.runtimeProcessEnv).toBe(process.env);
  expect(context.policy!.isProductionRuntime).toBe(process.env['NODE_ENV'] === 'production');
});
