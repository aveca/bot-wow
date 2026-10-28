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
    await expect(page.locator('#buyBtn')).toBeAttached();
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
    await expect(page.locator('#buyBtn')).toBeAttached();
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

test('responsive: price card shows blocked state on all viewports', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);

  for (const vp of viewports.slice(0, 3)) { // mobile, iphone-se, ipad
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const response = await page.goto('/buy.html', { waitUntil: 'domcontentloaded' });
    expect(response && response.ok()).toBeTruthy();

    await expect(page.locator('.checkout-blocked')).toBeVisible();
    await expect(page.locator('#release-availability-notice')).toBeVisible();
    await expect(page.locator('#buyBtn')).toBeDisabled();

    await captureScreenshot(page, testInfo, `responsive-blocked-${vp.name}`);
  }
  expect(errors).toEqual([]);
});