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

async function expectNoPurchaseForm(page) {
  await expect(page.locator('#buyForm')).toHaveCount(0);
  await expect(page.locator('#buyBtn')).toHaveCount(0);
  await expect(page.locator('#email')).toHaveCount(0);
}

test('purchase unavailable: no email or payment form on buy page (EN)', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  const response = await page.goto('/buy.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();

  await expect(page.locator('.checkout-blocked')).toBeVisible();
  await expect(page.locator('.checkout-blocked')).toContainText('Purchase unavailable');
  await expect(page.locator('#release-availability-notice')).toBeVisible();
  await expect(page.locator('.pay-note')).toContainText('No payment form is available');
  await expectNoPurchaseForm(page);

  await captureScreenshot(page, testInfo, 'checkout-unavailable-en');
  expect(errors).toEqual([]);
});

test('purchase unavailable: no email or payment form on buy page (FR)', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  const response = await page.goto('/fr/buy.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();

  await expect(page.locator('.checkout-blocked')).toBeVisible();
  await expect(page.locator('.checkout-blocked')).toContainText('Achat indisponible');
  await expect(page.locator('#release-availability-notice')).toBeVisible();
  await expect(page.locator('.pay-note')).toContainText('Aucun formulaire de paiement');
  await expectNoPurchaseForm(page);

  await captureScreenshot(page, testInfo, 'checkout-unavailable-fr');
  expect(errors).toEqual([]);
});

test('purchase unavailable: home pages expose no payment form (EN/FR)', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  for (const [lang, route, notice] of [
    ['en', '/', /Do not purchase until delivery is confirmed/i],
    ['fr', '/fr/', /n'achetez pas tant que la livraison n'est pas confirmée/i]
  ]) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response && response.ok(), route).toBeTruthy();
    await expect(page.locator('#release-availability-notice').first()).toContainText(notice);
    await expectNoPurchaseForm(page);
    await captureScreenshot(page, testInfo, 'checkout-unavailable-home-' + lang);
  }
  expect(errors).toEqual([]);
});

test('purchase unavailable: comparison pages expose no payment form (EN/FR)', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  for (const [lang, route] of [['en', '/compare.html'], ['fr', '/fr/compare.html']]) {
    const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
    expect(response && response.ok(), route).toBeTruthy();
    await expectNoPurchaseForm(page);
    await expect(page.locator('.pay-note')).toContainText(
      lang === 'fr' ? 'Aucun formulaire de paiement' : 'No payment form is available'
    );
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
  await expectNoPurchaseForm(page);
  await page.locator('a[href="#buy"]').first().click();
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
