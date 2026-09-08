/**
 * A runtime serves more than one entity — boot alone creates one per active
 * jurisdiction — and until now the wallet could only ever open the first. The
 * switcher makes the others reachable and re-points every screen at the one
 * that was picked.
 */
import { expect, test } from '@playwright/test';
import { enterStack } from './stack';

const entityRow = (entityId: string): string => `[data-testid="entity-switcher-entity"][data-entity-id="${entityId}"]`;

test.describe('entity switcher', () => {
	test('opens another entity of the same runtime from Home and the palette', { tag: '@functional' }, async ({ page }) => {
		const wallet = await enterStack(page);

		const trigger = page.getByTestId('entity-switcher-trigger');
		await expect(trigger).toHaveAttribute('data-entity-id', wallet.entityId);

		await trigger.click();
		const rows = page.getByTestId('entity-switcher-entity');
		// The dev stack runs two jurisdictions, so boot created two entities this runtime can sign for.
		await expect(rows).toHaveCount(2, { timeout: 30_000 });
		const ids = await rows.evaluateAll(nodes => nodes.map(node => node.getAttribute('data-entity-id') ?? ''));
		expect(ids).toContain(wallet.entityId);
		const other = ids.find(id => id !== wallet.entityId) ?? '';
		expect(other).toMatch(/^0x[0-9a-f]{64}$/);

		await page.locator(entityRow(other)).click();

		// Home re-points: the switcher and the entity id Home publishes both follow.
		await expect(trigger).toHaveAttribute('data-entity-id', other, { timeout: 30_000 });
		await expect(page.getByTestId('home-entity-id')).toHaveText(other);

		// So does a screen that is not Home: Sovereignty reads the same active entity.
		await page.getByTestId('nav-manage').locator('visible=true').first().click();
		await page.getByTestId('manage-sovereignty').click();
		await expect(page.getByTestId('sovereignty-keys')).toContainText(`${other.slice(0, 10)}…${other.slice(-6)}`);
		await page.getByTestId('back').click();

		// The palette offers the same switch and lands back on Home.
		await page.getByTestId('nav-home').locator('visible=true').first().click();
		await page.keyboard.press('Control+k');
		await page.getByTestId('palette-input').fill('switch to');
		await expect(page.getByTestId('palette-entity')).toHaveCount(2);
		await page.getByTestId('palette-entity').last().click();
		await expect(page.getByTestId('home-total')).toBeVisible({ timeout: 30_000 });
		await expect(trigger).toHaveAttribute('data-entity-id', /^0x[0-9a-f]{64}$/);
	});
});
