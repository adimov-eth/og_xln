import { cpSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { nativeRecoveryUrl } from '../../ui/src/native/recovery-address';

const root = path.resolve(import.meta.dir, '../..');
const ui = path.join(root, 'ui');
const artifact = path.join(ui, 'native-dist');
const resources = path.join(root, 'frontend/ios/App/App/public');

/** The iOS target bundles the same runtime with a headless projection host; all visible UI is SwiftUI. */
export function buildIosRuntime(reuse = false): void {
  const apiBase = process.env.XLN_UI_STACK_ORIGIN || 'https://xln.finance';
  const endpoint = new URL(apiBase);
  const recoveryUrl = nativeRecoveryUrl(apiBase, process.env.VITE_XLN_WATCHTOWER_URL);
  if (
    endpoint.username ||
    endpoint.password ||
    endpoint.search ||
    endpoint.hash ||
    endpoint.pathname !== '/' ||
    (endpoint.protocol !== 'https:' &&
      !(endpoint.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(endpoint.hostname)))
  ) {
    throw new Error('IOS_NETWORK_ORIGIN_INVALID');
  }
  if (!reuse) {
    const env = { ...process.env, XLN_UI_STACK_ORIGIN: apiBase, VITE_XLN_WATCHTOWER_URL: recoveryUrl };
    for (const cmd of [
      ['bun', 'run', 'runtime:bundle'],
      ['bunx', 'vite', 'build', '--mode', 'ios'],
    ]) {
      const result = Bun.spawnSync(cmd, { cwd: ui, env, stdout: 'inherit', stderr: 'inherit' });
      if (result.exitCode !== 0) throw new Error(`IOS_RUNTIME_BUILD_FAILED:${cmd.join(' ')}:${result.exitCode}`);
    }
    writeFileSync(path.join(artifact, 'native-network.json'), JSON.stringify({ apiBase: env.XLN_UI_STACK_ORIGIN, recoveryUrl }));
  }
  for (const file of ['index.html', 'runtime.js', 'account-worker.js', 'native-network.json']) {
    if (!existsSync(path.join(artifact, file))) throw new Error(`IOS_RUNTIME_ARTIFACT_MISSING:${file}`);
  }
  const network = JSON.parse(readFileSync(path.join(artifact, 'native-network.json'), 'utf8'));
  if (network.apiBase !== apiBase || network.recoveryUrl !== recoveryUrl) throw new Error('IOS_RUNTIME_NETWORK_MISMATCH: rebuild for the selected network');
  rmSync(resources, { recursive: true, force: true });
  cpSync(artifact, resources, { recursive: true });
  // SwiftUI owns system bars, keyboard avoidance and launch presentation on iOS.
  // These web UI plugins resize the root controller and obscure native controls.
  const configPath = path.join(resources, '../capacitor.config.json');
  const config = JSON.parse(readFileSync(configPath, 'utf8'));
  config.packageClassList = config.packageClassList.filter(
    (name: string) => !['StatusBarPlugin', 'KeyboardPlugin', 'SplashScreenPlugin'].includes(name),
  );
  writeFileSync(configPath, JSON.stringify(config, null, 2));
  console.log(`iOS runtime resources: ${resources}`);
}

if (import.meta.main) buildIosRuntime(process.argv.includes('--no-build'));
