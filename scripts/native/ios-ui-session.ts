import { join, dirname, resolve } from 'node:path';
import { cpSync, readdirSync, unlinkSync } from 'node:fs';

/** Run the installed SwiftUI screens against the same isolated live stand as the WebKit probes. */
export async function runIosUiSession(
  data: string,
  invoice: string | null,
  mode: 'payment' | 'swap' | 'default' | 'order' | 'tower',
): Promise<number> {
  const products = resolve(process.env.XLN_IOS_UI_PRODUCTS ?? '/tmp/xln-ios-ui-derived/Build/Products');
  const device = process.env.XLN_IOS_UI_DEVICE ?? '59209751-39EB-4274-AF6C-A88DE1099CAD';
  const language = process.env.XLN_UI_LANGUAGE ?? 'en';
  if (language !== 'en' && language !== 'ru') throw new Error(`IOS_UI_LANGUAGE_INVALID:${language}`);
  const network: unknown = await Bun.file(
    join(products, 'Debug-iphonesimulator/App.app/public/native-network.json'),
  ).json();
  if (
    !network ||
    typeof network !== 'object' ||
    !('apiBase' in network) ||
    network.apiBase !== 'http://127.0.0.1:8082' ||
    !('recoveryUrl' in network) ||
    network.recoveryUrl !== 'http://127.0.0.1:9100'
  )
    throw new Error('IOS_UI_TEST_REQUIRES_LOCAL_BUILD');
  const restoreDevice = process.env.XLN_IOS_RESTORE_DEVICE;
  if (mode === 'tower') {
    if (!restoreDevice || restoreDevice === device) throw new Error('IOS_RESTORE_REQUIRES_CLEAN_SECOND_DEVICE');
    const listed = Bun.spawnSync(['xcrun', 'simctl', 'listapps', restoreDevice]);
    if (listed.exitCode !== 0) throw new Error(`IOS_RESTORE_DEVICE_QUERY_FAILED:${listed.stderr.toString()}`);
    const parsed = Bun.spawnSync(['plutil', '-convert', 'json', '-o', '-', '-'], { stdin: listed.stdout });
    if (parsed.exitCode !== 0) throw new Error('IOS_RESTORE_DEVICE_APPS_INVALID');
    const apps: unknown = JSON.parse(parsed.stdout.toString());
    if (!apps || typeof apps !== 'object' || 'finance.xln.wallet' in apps)
      throw new Error('IOS_RESTORE_DEVICE_NOT_FRESH');
    console.log('IOS_RESTORE_CLEAN_DEVICE', restoreDevice);
  }
  const manifests = readdirSync(products).filter(name => name.endsWith('.xctestrun'));
  if (manifests.length !== 1) throw new Error(`IOS_UI_TEST_MANIFEST_COUNT:${manifests.length}`);
  const manifest = join(products, manifests[0]!);
  const copy = join(dirname(manifest), 'custody-payment.xctestrun');
  cpSync(manifest, copy);
  const locale = Bun.spawnSync([
    'plutil',
    '-insert',
    'AppUITests.EnvironmentVariables.XLN_UI_LANGUAGE',
    '-string',
    language,
    copy,
  ]);
  if (locale.exitCode !== 0) throw new Error(`IOS_UI_TEST_LANGUAGE_FAILED:${locale.stderr.toString()}`);
  // The variable belongs to XCTest, never to the wallet's runtime or financial path.
  if (invoice !== null) {
    const inject = Bun.spawnSync([
      'plutil',
      '-insert',
      'AppUITests.EnvironmentVariables.XLN_UI_INVOICE',
      '-string',
      invoice,
      copy,
    ]);
    if (inject.exitCode !== 0) throw new Error(`IOS_UI_TEST_INVOICE_FAILED:${inject.stderr.toString()}`);
  }
  if (mode === 'tower') {
    const name = 'ios-' + crypto.randomUUID();
    const inject = Bun.spawnSync([
      'plutil',
      '-insert',
      'AppUITests.EnvironmentVariables.XLN_UI_WALLET_NAME',
      '-string',
      name,
      copy,
    ]);
    if (inject.exitCode !== 0) throw new Error('IOS_RESTORE_NAME_INJECTION_FAILED');
  }
  const testName = {
    payment: 'testCustodyInvoicePayment',
    swap: 'testMarketSwap',
    default: 'testDefaultBrainvault',
    order: 'testOrderbookLimitBuy',
    tower: 'testPaymentBackup',
  }[mode];
  const runTest = async (testName: string, device: string, artifact: string): Promise<number> => {
    const recording = Bun.spawn(
      ['xcrun', 'simctl', 'io', device, 'recordVideo', '--codec=h264', join(data, `${artifact}.mp4`)],
      { stdout: 'inherit', stderr: 'inherit' },
    );
    try {
      const test = Bun.spawn(
        [
          'xcodebuild',
          'test-without-building',
          '-xctestrun',
          copy,
          '-destination',
          `platform=iOS Simulator,id=${device}`,
          '-parallel-testing-enabled',
          'NO',
          `-only-testing:AppUITests/PaymentUITests/${testName}`,
          '-maximum-concurrent-test-simulator-destinations',
          '1',
          '-resultBundlePath',
          join(data, `${artifact}.xcresult`),
          '-collect-test-diagnostics',
          'never',
          '-test-timeouts-enabled',
          'YES',
          '-default-test-execution-time-allowance',
          '150',
          '-maximum-test-execution-time-allowance',
          '150',
        ],
        { stdout: 'inherit', stderr: 'inherit' },
      );
      return await test.exited;
    } finally {
      recording.kill('SIGINT');
      const code = await recording.exited;
      if (code !== 0) console.error('IOS_UI_VIDEO_EXIT', code);
    }
  };
  try {
    const first = await runTest(testName, device, 'payment');
    if (first !== 0 || mode !== 'tower') return first;
    if (!restoreDevice) throw new Error('IOS_RESTORE_DEVICE_MISSING');
    return await runTest('testTowerRestore', restoreDevice, 'restore');
  } finally {
    unlinkSync(copy);
  }
}
