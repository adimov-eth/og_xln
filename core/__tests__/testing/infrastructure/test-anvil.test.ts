import { expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { text } from 'node:stream/consumers';
import { safeStringify } from '../../../protocol/serialization';
import { cleanupTestProcesses, spawnTestProcess } from '../../helpers/process/test-process';

const helperPath = resolve(import.meta.dir, '../../helpers/process/test-anvil.ts');

const pidAlive = (pid: number): boolean => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') throw error;
    return false;
  }
};

// The watchdog polls once a second; under heavy swap a round can take seconds.
const eventually = async (check: () => boolean, error: string): Promise<void> => {
  const deadline = performance.now() + 15_000;
  while (!check()) {
    if (performance.now() > deadline) throw new Error(error);
    await Bun.sleep(50);
  }
};

// Anvil only writes anvil-state-* once more than ~500 blocks of history exist,
// so the fixture mines 600 and records the directory before it ends. A failing
// test without a stop call and a SIGKILLed runner fire no hooks at all.
test.each(['stop', 'failure', 'timeout', 'SIGINT', 'SIGKILL'] as const)(
  'test Anvil leaves no process or state cache after %s',
  async outcome => {
    const root = mkdtempSync(join(tmpdir(), 'xln-test-anvil-lifecycle-'));
    const fixtureTmp = join(root, 'tmp');
    mkdirSync(fixtureTmp);
    const fixturePath = join(root, 'anvil.test.ts');
    const evidencePath = join(root, 'evidence.json');
    writeFileSync(
      fixturePath,
      [
        "import { test } from 'bun:test';",
        "import { readdirSync, writeFileSync } from 'node:fs';",
        "import { tmpdir } from 'node:os';",
        "import { join } from 'node:path';",
        `import { spawnTestAnvil, stopTestAnvil } from ${safeStringify(helperPath)};`,
        "test('anvil', async () => {",
        "const child = spawnTestAnvil(['--host', '127.0.0.1', '--port', '0']);",
        'const port = await new Promise((resolve, reject) => {',
        "  child.on('exit', code => reject(new Error(`ANVIL_START_FAILED:${code}`)));",
        "  child.stdout.on('data', chunk => { const match = /Listening on 127\\.0\\.0\\.1:(\\d+)/.exec(chunk.toString()); if (match) resolve(match[1]); });",
        '});',
        "await fetch(`http://127.0.0.1:${port}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'anvil_mine', params: ['0x258'] }) });",
        "const [cache] = readdirSync(tmpdir()).filter(name => name.startsWith('xln-test-anvil-'));",
        "const stateDirs = readdirSync(join(tmpdir(), cache)).filter(name => name.startsWith('anvil-state-'));",
        `writeFileSync(${safeStringify(evidencePath)}, JSON.stringify({ pid: child.pid, stateDirs }));`,
        ...(outcome === 'stop' ? ['await stopTestAnvil(child);'] : []),
        ...(outcome === 'failure' ? ["throw new Error('EXPECTED_TEST_FAILURE');"] : []),
        // bun kills what a timed-out test spawned; the cache must still go.
        ...(outcome === 'timeout' ? ['await new Promise(() => {});'] : []),
        ...(outcome === 'SIGINT' || outcome === 'SIGKILL'
          ? [`process.kill(process.pid, '${outcome}'); await new Promise(() => {});`]
          : []),
        `}, ${outcome === 'timeout' ? 5_000 : 20_000});`,
      ].join('\n'),
    );
    try {
      const runner = spawnTestProcess(process.execPath, ['test', '--timeout', '180000', fixturePath], {
        env: { ...process.env, TMPDIR: fixtureTmp },
      });
      const output = Promise.all([text(runner.stdout), text(runner.stderr)]);
      const ended = await new Promise<string>((done, reject) => {
        runner.once('error', reject);
        runner.once('exit', (code, signal) => done(signal ?? String(code)));
      });
      const [, stderr] = await output;
      const expected = { stop: '0', failure: '1', timeout: '1', SIGINT: 'SIGINT', SIGKILL: 'SIGKILL' }[outcome];
      expect({ ended, stderr: ended === expected ? '' : stderr }).toEqual({ ended: expected, stderr: '' });
      const evidence = JSON.parse(readFileSync(evidencePath, 'utf8')) as { pid: number; stateDirs: string[] };
      expect(evidence.stateDirs.length).toBe(1);
      await eventually(() => !pidAlive(evidence.pid), `TEST_ANVIL_SURVIVED:pid=${evidence.pid}`);
      await eventually(
        () => readdirSync(fixtureTmp).every(name => !name.startsWith('xln-test-anvil-')),
        'TEST_ANVIL_CACHE_SURVIVED',
      );
    } finally {
      await cleanupTestProcesses();
      rmSync(root, { recursive: true, force: true });
    }
  },
  60_000,
);
