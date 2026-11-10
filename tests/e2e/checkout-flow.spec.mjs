import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const artifactDir = path.join(process.cwd(), 'artifacts', 'ui');

async function captureScreenshot(page, testInfo, name) {
  fs.mkdirSync(artifactDir, { recursive: true });
  await page.screenshot({
    path: path.join(artifactDir, name + '-' + testInfo.project.name + '.png'),
    fullPage: true,
    animations: 'disabled'
  });
}

for (const [lang, route, unavailable] of [
  ['en', '/buy.html', 'Purchase unavailable'],
  ['fr', '/fr/buy.html', 'Achat indisponible'],
  ['home-en', '/', 'Purchase unavailable'],
  ['home-fr', '/fr/', 'Achat indisponible'],
]) {
  test('purchase unavailable: no payment form or email collection (' + lang + ')', async ({ page }, testInfo) => {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response && response.ok(), route).toBeTruthy();
    await expect(page.locator('#purchase-unavailable')).toBeVisible();
    await expect(page.locator('#buyForm')).toHaveCount(0);
    await expect(page.locator('#buyBtn')).toHaveCount(0);
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
    await expect(page.locator('#purchase-unavailable')).toContainText(unavailable);
    await captureScreenshot(page, testInfo, 'purchase-unavailable-' + lang);
  });
}

test('purchase status navigation never calls checkout', async ({ page }) => {
  const checkoutRequests = [];
  page.on('request', request => {
    if (request.url().includes('/api/checkout')) checkoutRequests.push(request.url());
  });
  const response = await page.goto('/buy.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();
  await expect(page.locator('#purchase-unavailable')).toBeVisible();
  const statusLink = page.locator('a[data-cta-id="buy-status-primary"]');
  if (await statusLink.count()) await statusLink.click();
  expect(checkoutRequests).toEqual([]);
});

test('purchase status: mobile sticky bar stays visible without a payment CTA', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [lang, route, label] of [['en', '/buy.html', 'Purchase unavailable'], ['fr', '/fr/buy.html', 'Achat indisponible']]) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response && response.ok(), route).toBeTruthy();
    const mbar = page.locator('.mbar');
    await expect(mbar).toBeVisible();
    await expect(mbar).toContainText(label);
    await captureScreenshot(page, testInfo, 'mobile-status-' + lang);
  }
});

test('purchase status: desktop sticky bar remains attached', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const response = await page.goto('/buy.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();
  await expect(page.locator('.mbar')).toBeAttached();
  await expect(page.locator('.mbar')).toContainText('Purchase unavailable');
  await captureScreenshot(page, testInfo, 'desktop-status');
});
