import { expect, test } from '@playwright/test';

test('Svelte account status survives committed runtime refreshes', { tag: '@functional' }, async ({ browser }) => {
  test.setTimeout(55_000);
  const context = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await context.newPage();
  try {
    const { HDNodeWallet } = await import('ethers');
    const { gotoApp, createRuntimeIdentity } = await import('../../utils/e2e-demo-users');
    const { waitForNamedHubs } = await import('../../utils/e2e-baseline');
    const { connectRuntimeToHub } = await import('../../utils/e2e-connect');
    const phrase = HDNodeWallet.createRandom().mnemonic!.phrase;
    await gotoApp(page, { appBaseUrl: 'https://localhost:8080' });
    const identity = await createRuntimeIdentity(page, 'State audit', phrase);
    const hubs = await waitForNamedHubs(page, ['h1'], { apiBaseUrl: 'https://localhost:8080' });
    await connectRuntimeToHub(page, identity, hubs.h1!);
    await expect(page.getByTestId('account-status-indicator').first()).toBeVisible();
    await expect(page.locator(`[data-testid="hub-discovery-card"][data-hub-entity-id="${hubs.h1}"]`)).toHaveAttribute(
      'data-connection-state',
      'open',
    );
    const observed = await page.evaluate(async () => {
      const sample = () => ({
        accounts: Array.from(document.querySelectorAll('[data-testid="account-status-indicator"]'), element => ({
          text: element.textContent?.trim(),
          status: element.className,
        })),
        hubs: Array.from(document.querySelectorAll('[data-testid="hub-discovery-card"]'), element => ({
          id: element.getAttribute('data-hub-entity-id'),
          state: element.getAttribute('data-connection-state'),
        })),
      });
      const live = window as typeof window & { isolatedEnv: { state: { height: number } } };
      const firstHeight = live.isolatedEnv.state.height;
      const first = sample();
      const states: string[] = [JSON.stringify(first)];
      const observer = new MutationObserver(() => states.push(JSON.stringify(sample())));
      observer.observe(document.body, { subtree: true, attributes: true, childList: true, characterData: true });
      await new Promise(resolve => setTimeout(resolve, 3_000));
      observer.disconnect();
      return {
        samples: states.length,
        firstHeight,
        lastHeight: live.isolatedEnv.state.height,
        states: [...new Set(states)],
      };
    });
    console.log(`SVELTE_STATE_OBSERVATION ${JSON.stringify(observed)}`);
    expect(observed.lastHeight).toBeGreaterThan(observed.firstHeight);
    expect(observed.states).toHaveLength(1);
  } finally {
    await context.close();
  }
});
