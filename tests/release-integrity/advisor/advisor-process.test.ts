import { expect, test } from 'bun:test';
import { runProcess } from '../../../tools/advisor/execution/process';

test('a real child receives literal arguments and stdin without shell expansion', async () => {
  const literal = '$(touch /tmp/advisor-must-not-exist) `whoami` $HOME';
  const result = await runProcess({
    command: process.execPath,
    args: ['-e', 'console.log(JSON.stringify({arg:process.argv[1],stdin:await Bun.stdin.text()}))', literal],
    cwd: process.cwd(),
    timeoutMs: 2000,
    input: 'bounded evidence packet',
  });
  expect(result.exitCode).toBe(0);
  expect(result.timedOut).toBe(false);
  expect(JSON.parse(result.stdout)).toEqual({ arg: literal, stdin: 'bounded evidence packet' });
});

test('a real nonzero child is preserved as failure evidence', async () => {
  const result = await runProcess({
    command: process.execPath,
    args: ['-e', 'console.error("failure evidence");process.exit(7)'],
    cwd: process.cwd(),
    timeoutMs: 2000,
  });
  expect(result.exitCode).toBe(7);
  expect(result.stderr).toContain('failure evidence');
});

test('deadline kills the entire real process group including inherited-pipe children', async () => {
  const code =
    'const child=Bun.spawn([process.execPath,"-e","setInterval(()=>{},10000)"],{stdout:"inherit",stderr:"inherit"});' +
    'console.log(child.pid);setInterval(()=>{},10000);';
  const result = await runProcess({
    command: process.execPath,
    args: ['-e', code],
    cwd: process.cwd(),
    timeoutMs: 300,
  });
  expect(result.timedOut).toBe(true);
  expect(result.elapsedMs).toBeLessThan(1500);
  const pid = Number(result.stdout.trim());
  expect(Number.isSafeInteger(pid) && pid > 0).toBe(true);
  const child = await runProcess({
    command: 'ps',
    args: ['-p', String(pid), '-o', 'stat='],
    cwd: process.cwd(),
    timeoutMs: 2000,
  });
  expect(child.stdout.trim() === '' || child.stdout.trim().startsWith('Z')).toBe(true);
});

test('a local CLI version probe uses the bounded process path without calling a model', async () => {
  const result = await runProcess({
    command: process.execPath,
    args: ['--version'],
    cwd: process.cwd(),
    timeoutMs: 2000,
  });
  expect(result.exitCode).toBe(0);
  expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+/);
});
