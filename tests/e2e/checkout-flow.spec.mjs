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

for (const [lang, route, reservationLabel] of [
  ['en', '/buy.html', 'beta reservation'],
  ['fr', '/fr/buy.html', 'réservation bêta'],
  ['home-en', '/', 'beta reservation'],
  ['home-fr', '/fr/', 'réservation bêta'],
]) {
  test('beta reservation: Stripe offer is visible without local email collection (' + lang + ')', async ({ page }, testInfo) => {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response && response.ok(), route).toBeTruthy();
    await expect(page.locator('.price-card--offer').first()).toBeVisible();
    await expect(page.locator('body')).toContainText('9,00 €');
    await expect(page.locator('body')).toContainText('29,00 €');
    await expect(page.locator('a[data-price-key="planner"]').first()).toBeVisible();
    await expect(page.locator('#buyForm')).toHaveCount(0);
    await expect(page.locator('#buyBtn')).toHaveCount(0);
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
    await captureScreenshot(page, testInfo, 'beta-reservation-' + lang);
  });
}

test('reservation page navigation never calls internal checkout', async ({ page }) => {
  const checkoutRequests = [];
  page.on('request', request => {
    if (request.url().includes('/api/checkout')) checkoutRequests.push(request.url());
  });
  const response = await page.goto('/buy.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();
  await expect(page.locator('.price-card--offer')).toBeVisible();
  const statusLink = page.locator('a[data-cta-id="buy-status-primary"]');
  if (await statusLink.count()) await statusLink.click();
  expect(checkoutRequests).toEqual([]);
});

test('reservation: mobile sticky bar remains visible with price and delivery terms', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const [lang, route, label] of [['en', '/buy.html', 'beta reservation'], ['fr', '/fr/buy.html', 'réservation bêta']]) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response && response.ok(), route).toBeTruthy();
    const mbar = page.locator('.mbar');
    await expect(mbar).toBeVisible();
    await expect(mbar).toContainText('9,00 €');
    await expect(mbar).toContainText(/Planner/i);
    await captureScreenshot(page, testInfo, 'mobile-status-' + lang);
  }
});

test('reservation: desktop sticky bar remains attached', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const response = await page.goto('/buy.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();
  await expect(page.locator('.mbar')).toBeAttached();
  await expect(page.locator('.mbar')).toContainText('9,00 €');
  await expect(page.locator('.mbar')).toContainText(/Planner/i);
  await captureScreenshot(page, testInfo, 'desktop-status');
});
