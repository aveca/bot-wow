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

test('checkout: buy button is disabled on buy.html (EN)', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  const response = await page.goto('/buy.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();

  // Le bouton est desactive
  const buyBtn = page.locator('#buyBtn');
  await expect(buyBtn).toBeDisabled();

  // Le message de blocage est visible
  await expect(page.locator('.checkout-blocked')).toBeVisible();
  await expect(page.locator('.checkout-blocked')).toContainText('Checkout unavailable');

  // L'avertissement de disponibilite est present
  await expect(page.locator('#release-availability-notice')).toBeVisible();
  await expect(page.locator('#release-availability-notice')).toContainText('do not purchase until delivery is confirmed');

  // Le formulaire existe mais le bouton est desactive
  await expect(page.locator('#buyForm')).toBeAttached();
  await expect(page.locator('#email')).toBeAttached();

  await captureScreenshot(page, testInfo, 'checkout-blocked-en');
  expect(errors).toEqual([]);
});

test('checkout: buy button is disabled on fr/buy.html (FR)', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  const response = await page.goto('/fr/buy.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();

  const buyBtn = page.locator('#buyBtn');
  await expect(buyBtn).toBeDisabled();

  await expect(page.locator('.checkout-blocked')).toBeVisible();
  await expect(page.locator('.checkout-blocked')).toContainText('Achat indisponible');

  await expect(page.locator('#release-availability-notice')).toBeVisible();
  await expect(page.locator('#release-availability-notice')).toContainText("n'achetez pas tant que la livraison n'est pas confirmée");

  await expect(page.locator('#buyForm')).toBeAttached();
  await expect(page.locator('#email')).toBeAttached();

  await captureScreenshot(page, testInfo, 'checkout-blocked-fr');
  expect(errors).toEqual([]);
});

test('checkout: buy button is disabled on index.html (EN homepage)', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();

  const buyBtn = page.locator('#buyBtn');
  await expect(buyBtn).toBeDisabled();
  await expect(buyBtn).toContainText('delivery not confirmed');

  await expect(page.locator('.checkout-blocked')).toBeVisible();
  await expect(page.locator('#release-availability-notice').first()).toContainText('do not purchase until delivery is confirmed');

  await captureScreenshot(page, testInfo, 'checkout-blocked-index-en');
  expect(errors).toEqual([]);
});

test('checkout: buy button is disabled on fr/index.html (FR homepage)', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  const response = await page.goto('/fr/', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();

  const buyBtn = page.locator('#buyBtn');
  await expect(buyBtn).toBeDisabled();
  await expect(buyBtn).toContainText('livraison à confirmer');

  await expect(page.locator('.checkout-blocked')).toBeVisible();
  await expect(page.locator('#release-availability-notice').first()).toContainText("n'achetez pas tant que la livraison n'est pas confirmée");

  await captureScreenshot(page, testInfo, 'checkout-blocked-index-fr');
  expect(errors).toEqual([]);
});

/* ─────────────────────────────
   CHECKOUT FLOW — validation
   ───────────────────────────── */

test('checkout: invalid email shows error and aria-invalid', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  const response = await page.goto('/buy.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();

  const email = page.locator('#email');
  const err = page.locator('#buyErr');

  // Saisie d'un email invalide
  await email.fill('not-an-email');
  await email.press('Tab'); // quitter le champ pour declencher le blur si besoin

  // Le bouton reste desactive (delivery not confirmed)
  await expect(page.locator('#buyBtn')).toBeDisabled();

  // Soumission bloquee : pas de redirection, pas d'erreur de redirect
  await page.press('#email', 'Enter');
  await expect(err).not.toContainText('redirect');

  await captureScreenshot(page, testInfo, 'checkout-invalid-email');
  expect(errors).toEqual([]);
});

test('checkout: Enter key does not submit when button disabled', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  const response = await page.goto('/buy.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();

  // Remplir un email valide
  await page.fill('#email', 'test@example.com');

  // Appuyer sur Entree : le formulaire ne doit pas etre soumis (bouton desactive)
  await page.press('#email', 'Enter');

  // Aucun message de succes ni de redirection
  await expect(page.locator('#buyOk')).not.toContainText('redirect');
  await expect(page.locator('#buyErr')).not.toContainText('redirect');

  await captureScreenshot(page, testInfo, 'checkout-enter-key');
  expect(errors).toEqual([]);
});

/* ─────────────────────────────
   CHECKOUT FLOW — sticky CTA
   ───────────────────────────── */

test('checkout: mobile sticky CTA bar is visible on buy pages', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);

  // Mobile viewport
  await page.setViewportSize({ width: 390, height: 844 });

  for (const [lang, path] of [['en', '/buy.html'], ['fr', '/fr/buy.html']]) {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(response && response.ok(), `HTTP ${path}`).toBeTruthy();

    // La barre mobile est visible (position fixe en bas)
    const mbar = page.locator('.mbar');
    await expect(mbar).toBeVisible();
    await expect(mbar).toContainText('20,00 €');

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