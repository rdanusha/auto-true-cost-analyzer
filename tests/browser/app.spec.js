const { test, expect } = require('@playwright/test');
const path = require('node:path');
const fs = require('node:fs');
const root = path.resolve(__dirname, '../..');

test.beforeEach(async ({ page }) => {
  const errors = [];
  const failures = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('requestfailed', request => failures.push(request.url()));
  page.testErrors = errors;
  page.testFailures = failures;
  await page.goto('/');
});
test.afterEach(async ({ page }) => {
  expect(page.testErrors).toEqual([]);
  expect(page.testFailures).toEqual([]);
});
test('examples render and all comparison views work', async ({ page }) => {
  await expect(page.locator('.vehicle-card')).toHaveCount(2);
  await expect(page.locator('#comparison')).toBeVisible();
  for (const [name, target] of [['Cost breakdown', 'breakdown'], ['Year by year', 'yearly'], ['Cost per mile', 'costmile'], ['Total cost', 'tco']]) {
    await page.getByRole('button', { name, exact: true }).click();
    await expect(page.locator(`#view-${target}`)).toBeVisible();
  }
  await expect(page.locator('#view-yearly tbody tr')).toHaveCount(5);
  await expect(page.locator('.validation-message')).toHaveText(['', '']);
});
test('unsafe names remain literal through every render and adding another card', async ({ page }) => {
  const unsafe = '<img src=x onerror="window.injected=true">';
  await page.locator('#v-0-name').fill(unsafe);
  await expect(page.locator('.vehicle-title').first()).toHaveText(unsafe);
  await expect(page.locator('#view-tco .chart-label span').first()).toHaveText(unsafe);
  await page.locator('#addBtn').click();
  await expect(page.locator('#v-0-name')).toHaveValue(unsafe);
  await expect(page.locator('.vehicle-card')).toHaveCount(3);
  expect(await page.evaluate(() => window.injected)).toBeUndefined();
  await expect(page.locator('img')).toHaveCount(0);
  await page.getByRole('button', { name: 'Remove vehicle 3', exact: true }).click();
  await expect(page.locator('#comparison')).toBeVisible();
});
test('invalid entries hide comparisons; zero insurance and maintenance remain zero', async ({ page }) => {
  await page.locator('#v-0-ins').fill('0');
  await page.locator('#v-0-maint').fill('0');
  await page.getByRole('button', { name: 'Cost breakdown', exact: true }).click();
  const first = page.locator('.breakdown').first();
  await expect(first.locator('.breakdown-row').filter({ has: page.locator('dt', { hasText: /^Insurance$/ }) }).locator('dd')).toHaveText('$0.00');
  await expect(first.locator('.breakdown-row').filter({ has: page.locator('dt', { hasText: /^Maintenance$/ }) }).locator('dd')).toHaveText('$0.00');
  await page.locator('#v-0-down').fill('999999');
  await expect(page.locator('#comparison')).toBeHidden();
  await expect(page.locator('#card-0 .validation-message')).toContainText('Down payment');
  await page.locator('#v-0-down').fill('5000');
  await expect(page.locator('#comparison')).toBeVisible();
  await page.locator('#gasPrice').fill('');
  await expect(page.locator('#globalError')).toContainText('Enter a gas price');
  await expect(page.locator('#comparison')).toBeHidden();
  await page.locator('#gasPrice').fill('0');
  await expect(page.locator('#comparison')).toBeVisible();
});
test('long loan produces positive remaining debt and zero mileage shows unavailable CPM', async ({ page }) => {
  await page.locator('#v-0-term').selectOption('84');
  await page.getByRole('button', { name: 'Cost breakdown', exact: true }).click();
  const debt = page.locator('.breakdown').first().locator('.breakdown-row').filter({ hasText: 'Loan debt after five years' }).locator('dd');
  await expect(debt).not.toHaveText('$0.00');
  await page.locator('#v-0-miles').fill('0');
  await page.getByRole('button', { name: 'Cost per mile', exact: true }).click();
  await expect(page.locator('#view-costmile .chart-label strong').first()).toHaveText('Not available');
  await page.locator('#v-0-down').fill('38500');
  await expect(page.locator('#card-0 .results dd').first()).toHaveText('$0.00');
});
test('add, remove, clear, reset, and no browser persistence', async ({ page }) => {
  for (let i = 0; i < 3; i++) await page.locator('#addBtn').click();
  await expect(page.locator('.vehicle-card')).toHaveCount(5);
  await expect(page.locator('#comparison')).toBeHidden();
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#clearBtn').click();
  await expect(page.locator('.vehicle-card')).toHaveCount(5);
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#clearBtn').click();
  await expect(page.locator('.vehicle-card')).toHaveCount(0);
  await expect(page.locator('.empty-state')).toBeVisible();
  await page.locator('#sampleBtn').click();
  await expect(page.locator('#comparison')).toBeVisible();
  expect(await page.evaluate(() => ({ local: localStorage.length, session: sessionStorage.length, cookies: document.cookie }))).toEqual({ local: 0, session: 0, cookies: '' });
  await page.reload();
  await expect(page.locator('.vehicle-card')).toHaveCount(2);
});
for (const width of [320, 390, 768, 1440]) {
  test(`responsive layout at ${width}px with all comparison views`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    for (const name of ['Total cost', 'Cost breakdown', 'Year by year', 'Cost per mile']) {
      await page.getByRole('button', { name, exact: true }).click();
      const dimensions = await page.evaluate(() => ({ page: document.documentElement.scrollWidth, viewport: window.innerWidth }));
      expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport);
    }
    expect(await page.locator('input:not([type=hidden]),select').evaluateAll(inputs => inputs.every(input => input.labels && input.labels.length > 0))).toBe(true);
    await page.getByRole('button', { name: 'Total cost', exact: true }).click();
    fs.mkdirSync(path.join(root, 'release'), { recursive: true });
    if (width === 390 || width === 1440) await page.screenshot({ path: path.join(root, `release/app-${width === 390 ? 'mobile' : 'desktop'}.png`), fullPage: true });
  });
}
test('generate social preview from the real app and validate public assets', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 630 });
  await page.screenshot({ path: path.join(root, 'social-preview.png'), style: '.note { visibility: hidden; }' });
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute('content', 'https://rdanusha.github.io/auto-true-cost-analyzer/social-preview.png');
  const allowed = ['/index.html', '/styles.css', '/calculator.js', '/app.js', '/social-preview.png', '/LICENSE'];
  for (const asset of allowed) expect((await page.request.get(asset)).status()).toBe(200);
});
