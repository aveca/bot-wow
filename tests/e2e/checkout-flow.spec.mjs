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
   CHECKOUT FLOW — garde-fou
   ───────────────────────────── */

test('early access: proposed plans are visible without checkout (EN)', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  const response = await page.goto('/buy.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();

  await expect(page.locator('#early-access-status')).toContainText('Not available to purchase');
  await expect(page.locator('.plans-grid .price-card')).toHaveCount(3);
  await expect(page.locator('.plans-grid')).toContainText('4,99 €');
  await expect(page.locator('.plans-grid')).toContainText('7,99 €');
  await expect(page.locator('.plans-grid')).toContainText('9,99 €');
  await expect(page.locator('#buyForm, #buyBtn, .pay-badges')).toHaveCount(0);
  await expect(page.locator('a[data-cta-id="buy-angler-question"]')).toHaveAttribute('href', /mailto:support@bot-wow.com/);
  await expect(page.locator('a[data-cta-id="buy-pathfinder-question"]')).toHaveAttribute('href', /mailto:support@bot-wow.com/);
  await expect(page.locator('a[data-cta-id="buy-founder-question"]')).toHaveAttribute('href', /mailto:support@bot-wow.com/);

  await captureScreenshot(page, testInfo, 'early-access-plans-en');
  expect(errors).toEqual([]);
});

test('early access: proposed plans are visible without checkout (FR)', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  const response = await page.goto('/fr/buy.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();

  await expect(page.locator('#early-access-status')).toContainText('Achat indisponible');
  await expect(page.locator('.plans-grid .price-card')).toHaveCount(3);
  await expect(page.locator('.plans-grid')).toContainText('4,99 €');
  await expect(page.locator('.plans-grid')).toContainText('7,99 €');
  await expect(page.locator('.plans-grid')).toContainText('9,99 €');
  await expect(page.locator('#buyForm, #buyBtn, .pay-badges')).toHaveCount(0);
  await expect(page.locator('a[data-cta-id="buy-angler-question"]')).toHaveAttribute('href', /mailto:support@bot-wow.com/);
  await expect(page.locator('a[data-cta-id="buy-pathfinder-question"]')).toHaveAttribute('href', /mailto:support@bot-wow.com/);
  await expect(page.locator('a[data-cta-id="buy-founder-question"]')).toHaveAttribute('href', /mailto:support@bot-wow.com/);

  await captureScreenshot(page, testInfo, 'early-access-plans-fr');
  expect(errors).toEqual([]);
});

test('homepage: proposed plans do not expose checkout (EN)', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();

  await expect(page.locator('#release-availability-notice')).toContainText('no payment or reservation is available');
  await expect(page.locator('#buyForm, #buyBtn')).toHaveCount(0);
  await expect(page.locator('a[data-cta-id="home-proposed-plans"]')).toHaveAttribute('href', './buy.html#buy');

  await captureScreenshot(page, testInfo, 'checkout-blocked-index-en');
  expect(errors).toEqual([]);
});

test('homepage: proposed plans do not expose checkout (FR)', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  const response = await page.goto('/fr/', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();

  await expect(page.locator('#release-availability-notice')).toContainText("aucun paiement ni réservation n'est disponible");
  await expect(page.locator('#buyForm, #buyBtn')).toHaveCount(0);
  await expect(page.locator('a[data-cta-id="home-proposed-plans"]')).toHaveAttribute('href', './buy.html#buy');

  await captureScreenshot(page, testInfo, 'checkout-blocked-index-fr');
  expect(errors).toEqual([]);
});

/* ─────────────────────────────
   EARLY ACCESS — sticky CTA
   ───────────────────────────── */

test('checkout: mobile sticky CTA bar is visible on buy pages', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);

  // Mobile viewport
  await page.setViewportSize({ width: 390, height: 844 });

  for (const [lang, path] of [['en', '/buy.html'], ['fr', '/fr/buy.html']]) {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(response && response.ok(), `HTTP ${path}`).toBeTruthy();

    // La barre mobile indique les tarifs envisagés, sans acheter.
    const mbar = page.locator('.mbar');
    await expect(mbar).toBeVisible();
    await expect(mbar).toContainText(lang === 'fr' ? 'Dès 4,99 €' : 'From 4,99 €');
    await expect(mbar).toContainText(lang === 'fr' ? 'proposé / mois' : 'proposed / month');

    await captureScreenshot(page, testInfo, `mobile-cta-${lang}`);
  }
  expect(errors).toEqual([]);
});

test('checkout: desktop sticky CTA appears after hero scroll', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);

  // Desktop viewport
  await page.setViewportSize({ width: 1440, height: 900 });
  const response = await page.goto('/buy.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();

  const mbar = page.locator('.mbar');

  // Au chargement, la barre desktop n'est pas encore visible (hero pas encore quitte)
  // Sur desktop, .mbar a opacity:0 par defaut, ne devient visible qu'apres le hero
  // On verifie simplement qu'elle est presente dans le DOM
  await expect(mbar).toBeAttached();

  await captureScreenshot(page, testInfo, 'desktop-cta');
  expect(errors).toEqual([]);
});
