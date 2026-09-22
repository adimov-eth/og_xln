import { chromium } from '../../../ui/node_modules/@playwright/test';
import { canonicalizeRuntimeWsAudience, deserializeWsMessage } from '../../../core/network/p2p/ws-protocol';

// Run under stand:run against the existing local stack. No server replacement,
// wallet import or signed hello: this checks the transport's first challenge.
const direct = 'ws://127.0.0.1:8082/relay';
const browserOrigin = 'http://localhost:5183';
const proxied = 'ws://localhost:5183/relay';
const binary = process.argv[2];
const output = process.argv[3];
if (!binary || !output) throw new Error('Usage: relay-audience.ts <compiled-swift-probe> <evidence.json>');

function audience(encoded: string): string {
  const message = deserializeWsMessage(Buffer.from(encoded.trim(), 'base64'));
  if (message.type !== 'hello_challenge' || !message.challenge || !message.audience) {
    throw new Error('RELAY_CHALLENGE_INVALID');
  }
  return message.audience;
}

const simulator = process.env['XLN_TEST_SIMULATOR_UDID'];
const nativeCommand = simulator ? ['xcrun', 'simctl', 'spawn', simulator, binary, direct] : [binary, direct];
const native = Bun.spawn(nativeCommand, { stdout: 'pipe', stderr: 'pipe' });
const [nativeOutput, nativeError, nativeExit] = await Promise.all([
  new Response(native.stdout).text(), new Response(native.stderr).text(), native.exited,
]);
if (nativeExit !== 0) throw new Error(`URLSESSION_PROBE_FAILED:${nativeExit}:${nativeError}`);
const nativeAudience = audience(nativeOutput);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  await page.goto(browserOrigin, { waitUntil: 'networkidle', timeout: 15_000 });
  async function browserAudience(url: string): Promise<string> {
    return audience(await page.evaluate(endpoint => new Promise<string>((resolve, reject) => {
      const socket = new WebSocket(endpoint);
      socket.binaryType = 'arraybuffer';
      const timer = setTimeout(() => { socket.close(); reject(new Error('RELAY_CHALLENGE_TIMEOUT')); }, 5_000);
      socket.onerror = () => { clearTimeout(timer); socket.close(); reject(new Error('RELAY_SOCKET_FAILED')); };
      socket.onmessage = event => {
        clearTimeout(timer);
        socket.close(1000, 'challenge-probe-complete');
        const bytes = typeof event.data === 'string' ? new TextEncoder().encode(event.data) : new Uint8Array(event.data);
        resolve(btoa(String.fromCharCode(...bytes)));
      };
    }), url));
  }
  const proxiedAudience = await browserAudience(proxied);
  const crossedAudience = await browserAudience(direct);
  const checks = [
    { transport: 'URLSession direct', expected: canonicalizeRuntimeWsAudience(direct), actual: nativeAudience, matches: true },
    { transport: 'Browser via its proxy', expected: canonicalizeRuntimeWsAudience(proxied), actual: proxiedAudience, matches: true },
    { transport: 'Browser direct with another Origin (negative control)', expected: canonicalizeRuntimeWsAudience(direct), actual: crossedAudience, matches: false },
  ];
  await Bun.write(output, JSON.stringify({ simulator: simulator ?? null, checks, scope: 'Initial challenge only; no authenticated wallet session or recovery proved.' }, null, 2));
  for (const check of checks) {
    if ((check.expected === check.actual) !== check.matches) throw new Error(`RELAY_AUDIENCE_UNEXPECTED:${JSON.stringify(check)}`);
  }
  console.log('Relay transport checks: 3/3 passed; URLSession + browser proxy match, crossed browser Origin reproduces mismatch.');
} finally { await browser.close(); }
