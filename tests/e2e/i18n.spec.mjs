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
  await expect(page.locator('h1')).toContainText('A fishing companion');
  await expect(page.locator('#early-access-status')).toContainText('Not available to purchase');
  await expect(page.locator('.plans-grid .price-card')).toHaveCount(3);

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
  await expect(page.locator('h1')).toContainText('Un compagnon de pêche');
  await expect(page.locator('#early-access-status')).toContainText('Achat indisponible');
  await expect(page.locator('.plans-grid .price-card')).toHaveCount(3);

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

test('i18n: proposed monthly plans and terms are consistent on EN and FR', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);

  for (const path of ['/buy.html', '/fr/buy.html']) {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(response && response.ok()).toBeTruthy();

    await expect(page.locator('.plans-grid .price-card')).toHaveCount(3);
    await expect(page.locator('.plans-grid')).toContainText('4,99 €');
    await expect(page.locator('.plans-grid')).toContainText('7,99 €');
    await expect(page.locator('.plans-grid')).toContainText('9,99 €');
    await expect(page.locator('#early-access-status')).toBeVisible();
  }
  expect(errors).toEqual([]);
});
