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

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth
  }));
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
}

/* ─────────────────────────────
   RESPONSIVE — viewports
   ───────────────────────────── */

const viewports = [
  { name: 'mobile', width: 390, height: 844, isMobile: true },
  { name: 'iphone-se', width: 375, height: 667, isMobile: true },
  { name: 'ipad', width: 768, height: 1024, isMobile: false },
  { name: 'desktop', width: 1440, height: 900, isMobile: false },
  { name: 'desktop-wide', width: 1920, height: 1080, isMobile: false },
];

for (const vp of viewports) {
  test(`responsive: buy.html renders without horizontal overflow on ${vp.name}`, async ({ page }, testInfo) => {
    const errors = collectPageErrors(page);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const response = await page.goto('/buy.html', { waitUntil: 'domcontentloaded' });
    expect(response && response.ok()).toBeTruthy();

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.price-card--offer')).toBeVisible();
    await expect(page.locator('#buyForm')).toHaveCount(0);
    await expect(page.locator('#buyBtn')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    await captureScreenshot(page, testInfo, `responsive-buy-${vp.name}`);
    expect(errors).toEqual([]);
  });

  test(`responsive: fr/buy.html renders without horizontal overflow on ${vp.name}`, async ({ page }, testInfo) => {
    const errors = collectPageErrors(page);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const response = await page.goto('/fr/buy.html', { waitUntil: 'domcontentloaded' });
    expect(response && response.ok()).toBeTruthy();

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.locator('.price-card--offer')).toBeVisible();
    await expect(page.locator('#buyForm')).toHaveCount(0);
    await expect(page.locator('#buyBtn')).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    await captureScreenshot(page, testInfo, `responsive-buy-fr-${vp.name}`);
    expect(errors).toEqual([]);
  });

  test(`responsive: index.html renders without horizontal overflow on ${vp.name}`, async ({ page }, testInfo) => {
    const errors = collectPageErrors(page);
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
    expect(response && response.ok()).toBeTruthy();

    await expect(page.locator('h1')).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await captureScreenshot(page, testInfo, `responsive-index-${vp.name}`);
    expect(errors).toEqual([]);
  });
}

/* ─────────────────────────────
   RESPONSIVE — mobile navigation
   ───────────────────────────── */

test('responsive: mobile nav hides nav-links and shows lang switcher', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto('/buy.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();

  // Sur mobile, les liens de nav sont caches (CSS @media max-width:900px)
  const navLinks = page.locator('.nav-links');
  await expect(navLinks).toBeHidden();

  // Le switcher de langue reste accessible
  await expect(page.locator('.langs')).toBeVisible();

  await captureScreenshot(page, testInfo, 'responsive-mobile-nav');
  expect(errors).toEqual([]);
});

/* ─────────────────────────────
   RESPONSIVE — price card
   ───────────────────────────── */

test('responsive: beta reservation price card is visible on all viewports', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);

  for (const vp of viewports.slice(0, 3)) { // mobile, iphone-se, ipad
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const response = await page.goto('/buy.html', { waitUntil: 'domcontentloaded' });
    expect(response && response.ok()).toBeTruthy();

    await expect(page.locator('.price-card--offer')).toBeVisible();
    await expect(page.locator('.price-card--offer a[data-cta-id="waitlist"]')).toHaveAttribute('href', /mailto:support@bot-wow.com/);
    await expect(page.locator('.price-card--offer')).toContainText(/No paid offer|Aucune offre payante/i);
    await expect(page.locator('#buyForm')).toHaveCount(0);
    await expect(page.locator('#buyBtn')).toHaveCount(0);
    await expect(page.locator('input[type="email"]')).toHaveCount(0);

    await captureScreenshot(page, testInfo, `responsive-blocked-${vp.name}`);
  }
  expect(errors).toEqual([]);
});

/* ─────────────────────────────
   P0.56 — Responsive coverage for the secondary EN/FR routes.
   Mission viewports: 320 · 375 · 391 · 430 · 768 · 1280.
   Each secondary route must render without horizontal overflow and expose a
   neutral purchase-status link — never an immediate-purchase CTA.
   ───────────────────────────── */

const p056Viewports = [
  { name: '320', width: 320, height: 568 },
  { name: '375', width: 375, height: 667 },
  { name: '391', width: 391, height: 844 },
  { name: '430', width: 430, height: 932 },
  { name: '768', width: 768, height: 1024 },
  { name: '1280', width: 1280, height: 800 },
];

const p056Routes = [
  { path: '/demo.html', statusHref: './buy.html', lang: 'en' },
  { path: '/fr/demo.html', statusHref: './buy.html', lang: 'fr' },
  { path: '/features.html', statusHref: './buy.html', lang: 'en' },
  { path: '/fr/features.html', statusHref: './buy.html', lang: 'fr' },
  { path: '/fishing.html', statusHref: './buy.html', lang: 'en' },
  { path: '/fr/fishing.html', statusHref: './buy.html', lang: 'fr' },
  { path: '/faq.html', statusHref: './buy.html', lang: 'en' },
  { path: '/fr/faq.html', statusHref: './buy.html', lang: 'fr' },
  { path: '/getting-started.html', statusHref: './buy.html', lang: 'en' },
  { path: '/fr/getting-started.html', statusHref: './buy.html', lang: 'fr' },
  { path: '/compatibility.html', statusHref: './buy.html', lang: 'en' },
  { path: '/fr/compatibility.html', statusHref: './buy.html', lang: 'fr' },
  { path: '/roadmap.html', statusHref: './buy.html', lang: 'en' },
  { path: '/fr/roadmap.html', statusHref: './buy.html', lang: 'fr' },
  { path: '/success.html', statusHref: './buy.html', lang: 'en' },
  { path: '/fr/success.html', statusHref: './buy.html', lang: 'fr' },
  { path: '/cancel.html', statusHref: './buy.html', lang: 'en' },
  { path: '/fr/cancel.html', statusHref: './buy.html', lang: 'fr' },
  { path: '/docs/install.html', statusHref: '../buy.html', lang: 'en' },
  { path: '/docs/fr/install.html', statusHref: '../../fr/buy.html', lang: 'fr' },
  { path: '/docs/license.html', statusHref: '../buy.html', lang: 'en' },
  { path: '/docs/fr/license.html', statusHref: '../../fr/buy.html', lang: 'fr' },
  { path: '/docs/index.html', statusHref: '../buy.html', lang: 'en' },
  { path: '/docs/fr/index.html', statusHref: '../../fr/buy.html', lang: 'fr' },
];

const p056StaleCta = /Buy — €20\.00|Acheter — 20,00 €|Get the lifetime licence|Prendre la licence à vie|Buy licence|Acheter la licence/i;

for (const route of p056Routes) {
  for (const vp of p056Viewports) {
    test(`responsive: ${route.path} is honest and overflow-free at ${vp.width}px`, async ({ page }, testInfo) => {
      const errors = collectPageErrors(page);
      await page.setViewportSize({ width: vp.width, height: vp.height });
      const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
      expect(response && response.ok()).toBeTruthy();

      await expect(page.locator('h1')).toBeVisible();
      await expectNoHorizontalOverflow(page);

      // Aucun CTA d'achat immédiat résiduel sur la page servie.
      const html = await page.content();
      expect(p056StaleCta.test(html), `stale purchase CTA on ${route.path}`).toBe(false);

      // Un lien de statut valide est disponible dans la page.
      const statusLinks = page.locator(`a[href="${route.statusHref}"]`);
      expect(await statusLinks.count(), `no purchase-status link on ${route.path}`).toBeGreaterThan(0);

      await captureScreenshot(page, testInfo, `p056-${route.path.replace(/[/.]/g, '-')}-${vp.width}w`);
      expect(errors).toEqual([]);
    });
  }
}

/* ─────────────────────────────
   P0.56 — Deterministic narrow-viewport guard (no webfont).
   The webfont Sora is loaded from Google Fonts. Until it arrives — or when
   the request is blocked — the browser lays the page out with the system
   fallback, whose glyphs are wider. On Linux CI runners this made the
   word "Documentation" (332px at 40px) wider than the 286px of usable
   width at 320px, so the document scrolled horizontally and this suite
   failed on a defect no local run could reproduce.

   Blocking the webfont makes that state deterministic everywhere: the
   layout must not overflow with the FALLBACK font either.
   ───────────────────────────── */

for (const route of p056Routes) {
  test(`responsive: ${route.path} does not overflow at 320px without the webfont`, async ({ page }) => {
    await page.route('**://fonts.googleapis.com/**', route => route.abort());
    await page.route('**://fonts.gstatic.com/**', route => route.abort());
    await page.setViewportSize({ width: 320, height: 568 });
    const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    expect(response && response.ok()).toBeTruthy();

    await expect(page.locator('h1')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  });
}