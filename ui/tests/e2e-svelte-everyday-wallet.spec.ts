import { test } from '@playwright/test';
import {
  runEverydayCaseE1,
  runEverydayCaseE2,
  runEverydayCaseE3,
  runEverydayCaseE4,
  runEverydayCaseE5,
  runEverydayCaseE6,
  runEverydayCaseE7,
  runEverydayCaseE8,
  runEverydayCaseE9,
  runEverydayCaseE10,
} from './everyday-wallet-scenarios';

test.describe('Svelte Everyday wallet opaque-box parity suite', () => {
  test('E1: default Everyday posture, calm 4-tab chrome and 48x48 touch targets', { tag: '@functional' }, async ({ page }) => {
    test.setTimeout(90_000);
    await runEverydayCaseE1(page, 'svelte');
  });

  test('E2: $0 newcomer arriving float stays separate from Cash until auto-settled', { tag: '@functional' }, async ({ page }) => {
    test.setTimeout(120_000);
    await runEverydayCaseE2(page, 'svelte');
  });

  test('E3: 1-tap inline Pay across hidden internal buckets with 0-gas guard and zero modal', { tag: '@functional' }, async ({ page, browser }) => {
    test.setTimeout(150_000);
    await runEverydayCaseE3(page, browser, 'svelte');
  });

  test('E4: Pay unhappy paths (insufficient settled cash, invalid amount, unknown peer)', { tag: '@functional' }, async ({ page }) => {
    test.setTimeout(120_000);
    await runEverydayCaseE4(page, 'svelte');
  });

  test('E5: Friends & tabs bill split (!isHub only) and 1-tap Settle up', { tag: '@functional' }, async ({ page, browser }) => {
    test.setTimeout(150_000);
    await runEverydayCaseE5(page, browser, 'svelte');
  });

  test('E6: Opt-in Savings stays separate from Cash and enforces risk consent', { tag: '@functional' }, async ({ page }) => {
    test.setTimeout(150_000);
    await runEverydayCaseE6(page, 'svelte');
  });

  test('E7: External /#pay/... interrupt sheet vs disguised credit-bait escalation', { tag: '@functional' }, async ({ page, browser }) => {
    test.setTimeout(150_000);
    await runEverydayCaseE7(page, browser, 'svelte');
  });

  test('E8: Activity calm timeline hides plumbing and surfaces 0 ETH L1 gas recovery notice', { tag: '@functional' }, async ({ page, browser }) => {
    test.setTimeout(120_000);
    await runEverydayCaseE8(page, browser, 'svelte');
  });

  test('E9: Cash out to external EOA with 0-gas, bad-address and over-balance guards', { tag: '@functional' }, async ({ page }) => {
    test.setTimeout(150_000);
    await runEverydayCaseE9(page, 'svelte');
  });

  test('E10: Settings Pro toggle round-trip, backup status and key-preserving Clear test data', { tag: '@functional' }, async ({ page }) => {
    test.setTimeout(150_000);
    await runEverydayCaseE10(page, 'svelte');
  });
});
