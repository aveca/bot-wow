import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const artifactDir = path.join(process.cwd(), 'artifacts', 'ui');

function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

async function captureScreenshot(page, testInfo, name) {
  fs.mkdirSync(artifactDir, { recursive: true });
  await page.screenshot({
    path: path.join(artifactDir, name + '-' + testInfo.project.name + '.png'),
    fullPage: true,
    animations: 'disabled'
  });
}

test('checkout open: email form on buy page (EN)', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  const response = await page.goto('/buy.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();
  await expect(page.locator('#buyForm')).toBeVisible();
  await expect(page.locator('#buyBtn')).toBeEnabled();
  await expect(page.locator('#email')).toBeVisible();
  await expect(page.locator('#before-buying')).toContainText(/tested in real conditions/i);
  await captureScreenshot(page, testInfo, 'checkout-open-en');
  expect(errors).toEqual([]);
});

test('checkout open: email form on buy page (FR)', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  const response = await page.goto('/fr/buy.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();
  await expect(page.locator('#buyForm')).toBeVisible();
  await expect(page.locator('#buyBtn')).toBeEnabled();
  await expect(page.locator('#before-buying')).toContainText(/testé en conditions réelles/i);
  await captureScreenshot(page, testInfo, 'checkout-open-fr');
  expect(errors).toEqual([]);
});

test('checkout open: home pages expose the payment form (EN/FR)', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  for (const [lang, route] of [['en', '/'], ['fr', '/fr/']]) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response && response.ok(), route).toBeTruthy();
    await expect(page.locator('#buyForm')).toBeVisible();
    await expect(page.locator('#buyBtn')).toBeEnabled();
    await captureScreenshot(page, testInfo, 'checkout-open-home-' + lang);
  }
  expect(errors).toEqual([]);
});

test('purchase unavailable: comparison pages expose no payment form (EN/FR)', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  for (const [lang, route] of [['en', '/compare.html'], ['fr', '/fr/compare.html']]) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response && response.ok(), route).toBeTruthy();
    await expect(page.locator('#buyForm')).toHaveCount(0);
    await expect(page.locator('#buyBtn')).toHaveCount(0);
    await captureScreenshot(page, testInfo, 'checkout-unavailable-compare-' + lang);
  }
  expect(errors).toEqual([]);
});

test('purchase unavailable: status navigation cannot call checkout', async ({ page }) => {
  const checkoutRequests = [];
  page.on('request', request => {
    if (request.url().includes('/api/checkout')) checkoutRequests.push(request.url());
  });
  const response = await page.goto('/buy.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();
  await expect(page.locator('#buyForm')).toBeVisible();
  await page.locator('a[data-cta-id="buy-status-primary"]').click();
  expect(checkoutRequests).toEqual([]);
});

test('checkout: mobile sticky status bar remains visible on buy pages', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });

  for (const [lang, route] of [['en', '/buy.html'], ['fr', '/fr/buy.html']]) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response && response.ok(), 'HTTP ' + route).toBeTruthy();
    const mbar = page.locator('.mbar');
    await expect(mbar).toBeVisible();
    await expect(mbar).toContainText('20,00 €');
    await captureScreenshot(page, testInfo, 'mobile-status-' + lang);
  }
  expect(errors).toEqual([]);
});

test('checkout: desktop sticky status bar remains attached after hero', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  const response = await page.goto('/buy.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();
  await expect(page.locator('.mbar')).toBeAttached();
  await captureScreenshot(page, testInfo, 'desktop-status');
  expect(errors).toEqual([]);
});
