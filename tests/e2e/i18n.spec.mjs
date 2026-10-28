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

/* ─────────────────────────────
   I18N — EN vs FR buy pages
   ───────────────────────────── */

test('i18n: EN buy page uses English text', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  const response = await page.goto('/buy.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();

  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.locator('h1')).toContainText('The fishing bot');
  await expect(page.locator('#buyBtn')).toContainText('delivery not confirmed');
  await expect(page.locator('.checkout-blocked')).toContainText('Checkout unavailable');
  await expect(page.locator('#release-availability-notice')).toContainText('do not purchase until delivery is confirmed');

  // Les liens legaux pointent vers /legal/ (pas /legal/fr/)
  await expect(page.locator('a[href="./legal/terms.html"]').first()).toBeAttached();
  await expect(page.locator('a[href="./legal/refund.html"]').first()).toBeAttached();
  await expect(page.locator('a[href="./legal/privacy.html"]').first()).toBeAttached();

  await captureScreenshot(page, testInfo, 'i18n-en-buy');
  expect(errors).toEqual([]);
});

test('i18n: FR buy page uses French text', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  const response = await page.goto('/fr/buy.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();

  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.locator('h1')).toContainText('Le bot de pêche');
  await expect(page.locator('#buyBtn')).toContainText('livraison à confirmer');
  await expect(page.locator('.checkout-blocked')).toContainText('Achat indisponible');
  await expect(page.locator('#release-availability-notice')).toContainText("n'achetez pas tant que la livraison n'est pas confirmée");

  // Les liens legaux FR pointent vers /legal/fr/ (pas /legal/)
  await expect(page.locator('a[href="../legal/fr/terms.html"]').first()).toBeAttached();
  await expect(page.locator('a[href="../legal/fr/refund.html"]').first()).toBeAttached();
  await expect(page.locator('a[href="../legal/fr/privacy.html"]').first()).toBeAttached();

  await captureScreenshot(page, testInfo, 'i18n-fr-buy');
  expect(errors).toEqual([]);
});

/* ─────────────────────────────
   I18N — language switcher
   ───────────────────────────── */

test('i18n: language switcher links are correct on buy pages', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);

  // Sur buy.html (EN), le lien FR pointe vers fr/buy.html
  await page.goto('/buy.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.langs a[href="./fr/buy.html"]')).toBeAttached();
  await expect(page.locator('.langs a.on')).toHaveText('EN');

  // Sur fr/buy.html (FR), le lien EN pointe vers ../buy.html
  await page.goto('/fr/buy.html', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.langs a[href="../buy.html"]')).toBeAttached();
  await expect(page.locator('.langs a.on')).toHaveText('FR');

  await captureScreenshot(page, testInfo, 'i18n-lang-switcher');
  expect(errors).toEqual([]);
});

/* ─────────────────────────────
   I18N — price consistency
   ───────────────────────────── */

test('i18n: price is 20,00 EUR on both EN and FR', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);

  for (const path of ['/buy.html', '/fr/buy.html']) {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(response && response.ok()).toBeTruthy();

    await expect(page.locator('.price-card .amt b')).toContainText('20,00 €');
  }
  expect(errors).toEqual([]);
});