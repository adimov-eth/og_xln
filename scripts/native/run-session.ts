import { mkdtempSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { safeStringify } from '../../core/protocol/serialization';
import { readStandLockHolder, standLockCapacity, standLockRoot } from '../../tools/stand-lock';
import { acquireDevSingleton, runDevCommands } from '../dev/run-dev';
import { buildWalletPayHref } from '../../frontend/src/lib/utils/xlnInvoice';
import { runIosUiSession } from './ios-ui-session';

const root = resolve(import.meta.dir, '../..');
const token = process.env.XLN_STAND_LOCK_TOKEN;
const ownsStand = Array.from({ length: standLockCapacity() }, (_, slot) =>
  readStandLockHolder(standLockRoot(), slot)).some(holder => holder && holder.token === token);
if (!token || !ownsStand) throw new Error('NATIVE_SESSION_REQUIRES_STAND_LOCK');
if (process.platform !== 'darwin') throw new Error('NATIVE_SESSION_REQUIRES_MACOS');
const scenarioName = process.argv[2] ?? 'immediate-payment-lock.js';
const iosUi = scenarioName === 'ios-ui' || scenarioName === 'ios-ui-swap' || scenarioName === 'ios-ui-default' || scenarioName === 'ios-ui-order' || scenarioName === 'ios-ui-tower';
if (!iosUi && !/^(?:[a-z-]+\/)?[a-z-]+\.js$/.test(scenarioName)) throw new Error('NATIVE_SESSION_SCENARIO_INVALID');
const pauseMs = Number(process.argv[3] ?? '0');
if (!Number.isSafeInteger(pauseMs) || pauseMs < 0 || pauseMs > 10_000)
  throw new Error('NATIVE_SESSION_PEER_PAUSE_INVALID');
const source = iosUi ? '' : await Bun.file(join(import.meta.dir, 'tests', scenarioName)).text();
const data = mkdtempSync(join(tmpdir(), 'xln-native-session-'));
console.log('ISOLATED_DATA', data);

if (!iosUi) {
  const build = Bun.spawn([
    'xcrun', '--sdk', 'macosx', 'swiftc', join(import.meta.dir, 'tests/quote-session.swift'),
    join(root, 'frontend/ios/App/App/runtime/NativeSockets.swift'), '-o', join(data, 'probe'),
  ], { cwd: root, stdout: 'inherit', stderr: 'inherit' });
  if (await build.exited !== 0) throw new Error('NATIVE_SESSION_PROBE_BUILD_FAILED');
}

const lease = acquireDevSingleton();
const running = runDevCommands([
  ['bash', 'scripts/dev/prepare-start.sh'], ['bash', 'scripts/dev/run-dev.sh'],
], {
  ...process.env, XLN_DEV_DATA_ROOT: data, XLN_DEV_LOG_DIR: join(data, 'logs'),
  XLN_DEV_LAUNCHER_PORT: String(lease.port), XLN_DEV_LAUNCHER_TOKEN: lease.capability,
  XLN_HLT_ENGINE: 'ts', XLN_VITE_FORCE_HTTP: '1', XLN_DEV_SHUTDOWN_TIMEOUT_MS: '45000',
}, { cwd: root, termTimeoutMs: 50_000 });
let stopped = false;
void running.then(() => { stopped = true; });
let pausedPid: number | null = null;
let control: ReturnType<typeof Bun.serve> | null = null;
let resumeTimer: ReturnType<typeof setTimeout> | null = null;
const resumePeer = (): void => {
  if (pausedPid === null) return;
  process.kill(pausedPid, 'SIGCONT');
  console.log('REAL_PEER_RESUMED', pausedPid);
  pausedPid = null;
};
process.on('SIGTERM', resumePeer);
process.on('SIGINT', resumePeer);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const readHealth = async (): Promise<Record<string, unknown>> => {
  const response = await fetch('http://127.0.0.1:8082/api/health?full=1', { signal: AbortSignal.timeout(2000) });
  if (!response.ok) throw new Error(`NATIVE_SESSION_HEALTH_HTTP:${response.status}`);
  const health: unknown = await response.json();
  if (!isRecord(health) || typeof health.systemOk !== 'boolean') throw new Error('NATIVE_SESSION_HEALTH_INVALID');
  await Bun.write(join(data, 'health.json'), safeStringify(health, 2));
  return health;
};

async function custodyInvoice() {
  const response = await fetch('http://127.0.0.1:8087/api/me');
  if (!response.ok) throw new Error(`CUSTODY_INVOICE_HTTP:${response.status}`);
  const body: unknown = await response.json();
  const cookie = response.headers.get('set-cookie')?.split(';')[0];
  if (!isRecord(body) || !isRecord(body.session) || !isRecord(body.custody) || !cookie ||
    typeof body.session.userId !== 'string' || typeof body.custody.entityId !== 'string' ||
    typeof body.custody.jurisdictionId !== 'string') throw new Error('CUSTODY_INVOICE_INVALID');
  const userId = body.session.userId;
  const uri = buildWalletPayHref({ targetEntityId: body.custody.entityId, tokenId: 1,
    amount: '1.000001', recipientUserId: userId, jurisdictionId: body.custody.jurisdictionId,
    description: 'Native QR payment acceptance' });
  return { uri, userId, cookie };
}

async function verifyCustodyCredit(invoice: Awaited<ReturnType<typeof custodyInvoice>>) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    const response = await fetch('http://127.0.0.1:8087/api/me', { headers: { cookie: invoice.cookie } });
    if (!response.ok) throw new Error(`CUSTODY_RECEIPT_HTTP:${response.status}`);
    const body: unknown = await response.json();
    if (!isRecord(body) || !isRecord(body.session) || body.session.userId !== invoice.userId ||
      !Array.isArray(body.tokens)) throw new Error('CUSTODY_RECEIPT_INVALID');
    const token = body.tokens.find(row => isRecord(row) && row.tokenId === 1);
    if (isRecord(token) && token.amountMinor === '1000001') {
      console.log('NATIVE_QR_CUSTODY_CREDIT_CONFIRMED', safeStringify({ userId: invoice.userId, tokenId: 1, amount: token.amountMinor }));
      await Bun.write(join(data, 'custody-receipt.json'), safeStringify(body, 2));
      return;
    }
    await Bun.sleep(250);
  }
  throw new Error('CUSTODY_CREDIT_NOT_CONFIRMED');
}

try {
  const deadline = Date.now() + 70_000;
  let health: Record<string, unknown> | null = null;
  let lastError: unknown = null;
  while (Date.now() < deadline && !stopped) {
    try {
      const candidate = await readHealth();
      const ui = await fetch('http://localhost:5183/native/index.html', { signal: AbortSignal.timeout(1500) });
      if (candidate.systemOk && ui.ok) { health = candidate; break; }
    } catch (error) { lastError = error; }
    await Bun.sleep(1000);
  }
  if (!health) throw new Error(`ISOLATED_STAND_NOT_READY:${data}`, { cause: lastError });
  console.log('ISOLATED_STAND_READY');
  const invoice = scenarioName === 'ios-ui' || scenarioName === 'ios-ui-tower' || scenarioName === 'payments/qr-payment.js' ? await custodyInvoice() : null;
  let prelude = invoice ? `window.xlnNativeTestInvoice = ${JSON.stringify(invoice.uri)};\n` : '';
  if (scenarioName === 'payments/recovery-recording.js')
    prelude += `window.xlnNativeWriterLockModule = ${JSON.stringify(`/@fs${root}/core/runtime/frame/lifecycle/writer-lock.ts`)};\n`;
  if (pauseMs > 0) {
    const hub = Array.isArray(health.hubs) ? health.hubs.find(hub => isRecord(hub) && hub.name === 'H1') : null;
    if (!isRecord(hub) || typeof hub.pid !== 'number' || !Number.isSafeInteger(hub.pid) || hub.pid <= 0 ||
      !hub.online || typeof hub.dbPath !== 'string' ||
      realpathSync(hub.dbPath) !== realpathSync(join(data, 'rdb/mesh/h1')))
      throw new Error('NATIVE_SESSION_OWNED_H1_PID_MISSING');
    const pid = hub.pid;
    const pausePath = `/pause/${crypto.randomUUID()}`;
    let used = false;
    control = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch(request) {
      if (request.method !== 'POST' || new URL(request.url).pathname !== pausePath || used)
        return new Response('Invalid pause request', { status: 400 });
      used = true;
      process.kill(pid, 'SIGSTOP');
      pausedPid = pid;
      console.log('REAL_PEER_PAUSED', pid, pauseMs);
      resumeTimer = setTimeout(resumePeer, pauseMs);
      return Response.json({ pauseMs, pid }, { headers: { 'Access-Control-Allow-Origin': 'http://localhost:5183' } });
    } });
    prelude = `window.xlnNativePeerPauseUrl = ${JSON.stringify(new URL(pausePath, control.url).href)};\n`;
  }
  await Bun.write(join(data, 'scenario.js'), prelude + source);
  const exitCode = iosUi ? await runIosUiSession(data, invoice ? invoice.uri : null, scenarioName === 'ios-ui-tower' ? 'tower' : scenarioName === 'ios-ui-default' ? 'default' : scenarioName === 'ios-ui-order' ? 'order' : invoice ? 'payment' : 'swap') : await Bun.spawn([join(data, 'probe'), join(data, 'scenario.js')], {
    cwd: root, stdout: 'inherit', stderr: 'inherit',
  }).exited;
  if (exitCode === 0 && invoice) await verifyCustodyCredit(invoice);
  const after = await readHealth();
  await Bun.write(join(data, 'after-health.json'), safeStringify(after, 2));
  console.log('AFTER_HEALTH', safeStringify({ systemOk: after.systemOk, failures: after.failures }));
  if (exitCode !== 0) throw new Error(`NATIVE_SESSION_PROBE_FAILED:${exitCode}`);
  if (!after.systemOk) throw new Error(`POST_PROBE_HUB_HEALTH_FAILED:${data}`);
} finally {
  if (resumeTimer) clearTimeout(resumeTimer);
  resumePeer();
  control?.stop(true);
  if (!stopped) process.kill(process.pid, 'SIGTERM');
  await running;
  lease.release();
  process.off('SIGTERM', resumePeer);
  process.off('SIGINT', resumePeer);
  console.log('ISOLATED_STAND_STOPPED', data);
}
