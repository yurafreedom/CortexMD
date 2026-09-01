import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import accessibilityFixture from '../fixtures/accessibility/current-axe.json';

async function useSafeBrowserFixtures(page: Page) {
  await page.addInitScript(() => {
    localStorage.clear();
  });

  await page.route('**/brain.glb', async (route) => {
    await route.fulfill({
      status: 404,
      contentType: 'application/octet-stream',
      body: '',
    });
  });

  await page.route('**/api/profile/presets', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ data: [] }),
    });
  });
}

async function openSchemeSelection(page: Page) {
  await page.locator('.catalog-toggle-btn').click();
  await expect(page.locator('.scheme-modal-content .dsearch')).toBeVisible();
}

function importantViolationIds(result: Awaited<ReturnType<AxeBuilder['analyze']>>) {
  return result.violations
    .filter((violation) => violation.impact === 'critical' || violation.impact === 'serious')
    .map((violation) => `${violation.impact}:${violation.id}`)
    .sort();
}

test.beforeEach(async ({ page }) => {
  await useSafeBrowserFixtures(page);
});

test('dashboard loads and currently requests the 3D asset eagerly', async ({ page }) => {
  const brainResponse = page.waitForResponse((response) => response.url().endsWith('/brain.glb'));
  await page.goto('/');
  await expect(page.getByText('CortexMD')).toBeVisible();
  await expect(page.locator('#cv canvas')).toBeVisible();
  expect((await brainResponse).status()).toBe(404);
});

test('scheme lifecycle adds, updates, persists, and removes a drug', async ({ page }) => {
  await page.goto('/');
  await openSchemeSelection(page);

  const modal = page.locator('.scheme-modal-content');
  await modal.locator('.dsearch').fill('sertraline');
  await modal.getByText('Zoloft', { exact: true }).click();

  const doseInput = modal.locator('input[type="number"]');
  await expect(doseInput).toHaveValue('100');
  await doseInput.fill('150');
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('cortexmd_scheme') ?? '{}').sertraline)).toBe(150);

  await doseInput.locator('..').locator('..').getByRole('button').click();
  await expect(modal.locator('input[type="number"]')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => localStorage.getItem('cortexmd_scheme'))).toBe('{}');
});

test('critical sigma and glutamate overlays open and close', async ({ page }) => {
  await page.goto('/');

  await page.locator('.hb', { hasText: 'σ1' }).click();
  await expect(page.getByText(/Клеточный уровень/)).toBeVisible();
  await page.locator('.s1close').click();
  await expect(page.getByText(/Клеточный уровень/)).toBeHidden();

  await page.locator('.hb', { hasText: 'Glu' }).click();
  await expect(page.getByText('Глутаматная система')).toBeVisible();
  await page.getByRole('button', { name: 'Открыть полный каскад' }).click();
  await expect(page.getByText('Глутаматный каскад нейропластичности')).toBeVisible();
  await page.locator('span').filter({ hasText: /^×$/ }).click();
  await expect(page.getByText('Глутаматный каскад нейропластичности')).toBeHidden();
});

test('current 3D marker pick opens the existing region popup', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const brainResponse = page.waitForResponse((response) => response.url().endsWith('/brain.glb'));
  await page.goto('/');
  expect((await brainResponse).status()).toBe(404);

  const canvas = page.locator('#cv canvas');
  await expect.poll(() => canvas.evaluate((element) => (element as HTMLCanvasElement).width)).toBeGreaterThan(0);
  const box = await canvas.boundingBox();
  expect(box).not.toBeNull();

  // dlPFC projected through the current fixed camera at [0.15, 0.45, 0.35].
  const marker = { x: box!.x + box!.width * 0.4012, y: box!.y + box!.height * 0.3109 };
  await page.mouse.move(marker.x, marker.y);
  await expect.poll(() => page.evaluate(() => document.body.style.cursor)).toBe('pointer');
  await page.mouse.click(marker.x, marker.y);
  await expect(page.locator('.zone-popup-title')).toHaveText('Дорсолатеральная ПФК');
  await page.locator('.zone-popup-close').click();
  await expect(page.locator('.zone-popup-title')).toBeHidden();
});

test('authenticated preset API behavior is isolated behind a safe browser fixture', async ({ page }) => {
  let presetRequests = 0;
  await page.unroute('**/api/profile/presets');
  await page.route('**/api/profile/presets', async (route) => {
    presetRequests += 1;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        data: [{ id: 'fixture-preset', name: 'Fixture Preset', drugs: { sertraline: 100 }, created_at: '2026-08-31T00:00:00Z' }],
      }),
    });
  });
  await page.goto('/');
  await openSchemeSelection(page);
  await expect(page.getByText('Fixture Preset')).toBeVisible();
  expect(presetRequests).toBe(1);
});

test('scoped axe checks freeze current critical/serious findings', async ({ page }, testInfo) => {
  await page.goto('/');
  const leftPanel = await new AxeBuilder({ page }).include('#lp').analyze();
  await testInfo.attach('axe-left-panel.json', {
    body: JSON.stringify(leftPanel, null, 2),
    contentType: 'application/json',
  });
  expect(importantViolationIds(leftPanel)).toEqual(accessibilityFixture.leftPanelCriticalOrSerious);

  await openSchemeSelection(page);
  const schemeModal = await new AxeBuilder({ page }).include('.scheme-modal-content').analyze();
  await testInfo.attach('axe-scheme-modal.json', {
    body: JSON.stringify(schemeModal, null, 2),
    contentType: 'application/json',
  });
  expect(importantViolationIds(schemeModal)).toEqual(accessibilityFixture.schemeModalCriticalOrSerious);
});
