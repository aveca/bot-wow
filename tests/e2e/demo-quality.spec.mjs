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
  await page.evaluate(() => document.fonts.ready.then(() => true));
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

test('homepage: primary demo and purchase paths remain visible and responsive', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('a[data-cta-id="hero-demo"]')).toBeVisible();
  await expect(page.locator('a[data-cta-id="hero-offer"]')).toBeVisible();
  await expect(page.locator('nav .nav-links a[href="./features.html"]')).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
  await captureScreenshot(page, testInfo, 'homepage');
  expect(errors).toEqual([]);
});

test('English demo: simulation disclosure, interactions and purchase handoff work', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  const checkoutRequests = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (url.pathname.includes('/checkout') || url.pathname.includes('/api/payments')) {
      checkoutRequests.push(url.pathname);
    }
  });

  const response = await page.goto('/demo.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();
  await expect(page.locator('#demo-title')).toHaveText('Explore the route planner.');
  await expect(page.locator('.sim-banner')).toContainText('SIMULATED DATA');
  await expect(page.locator('.sim-banner')).toContainText('does not control the game client');
  await expect(page.locator('nav a[data-cta-id="nav-buy"]')).toHaveAttribute('href', './#buy');
  await expect(page.locator('nav .langs a[lang="fr"]')).toHaveAttribute('href', './fr/demo.html');
  await expect(page.locator('a[href="./#features"]')).toHaveCount(0);

  await expect(page.locator('#m-spots')).not.toHaveText('–', { timeout: 10000 });
  await expect(page.locator('#oasis .node')).not.toHaveCount(0);
  await captureScreenshot(page, testInfo, 'demo-en');
  await expectNoHorizontalOverflow(page);

  await page.locator('#oasis circle[style*="cursor:pointer"]').first().click();
  await expect(page.locator('#spotPanel table.metrics')).toHaveCount(1);
  await page.locator('#mode').selectOption('exploration');
  await page.locator('#maxspots').evaluate((element) => {
    element.value = '3';
    element.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect(page.locator('#maxspotsv')).toHaveText('3');
  const renderedSteps = await page.locator('#steps li').count();
  expect(renderedSteps).toBeGreaterThan(0);
  expect(renderedSteps).toBeLessThanOrEqual(3);
  expect(checkoutRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test('French demo: locale stays French and all key navigation targets are localised', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  const response = await page.goto('/fr/demo.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.locator('#demo-title')).toHaveText('Explorez le planificateur de ronde.');
  await expect(page.locator('.sim-banner')).toContainText('DONNÉES SIMULÉES');
  await expect(page.locator('.sim-banner')).toContainText('ne démontre pas le déplacement automatique');
  await expect(page.locator('nav .langs a[lang="en"]')).toHaveAttribute('href', '../demo.html');
  await expect(page.locator('nav .langs a[lang="fr"]')).toHaveAttribute('href', './demo.html');
  await expect(page.locator('nav a[data-cta-id="nav-buy"]')).toHaveAttribute('href', './#buy');
  await expect(page.locator('a[href="../#offre"]')).toHaveCount(0);
  await expect(page.locator('a[href="../#features"]')).toHaveCount(0);
  await expect(page.locator('#m-spots')).not.toHaveText('–', { timeout: 10000 });
  await expectNoHorizontalOverflow(page);
  await captureScreenshot(page, testInfo, 'demo-fr');
  expect(errors).toEqual([]);
});

test('capture current public demo as a visual comparison baseline when reachable', async ({ page }, testInfo) => {
  try {
    const response = await page.goto('https://bot-wow.com/demo.html', {
      waitUntil: 'domcontentloaded',
      timeout: 12000
    });
    if (!response || !response.ok()) {
      test.info().annotations.push({
        type: 'baseline',
        description: 'Public baseline not captured: the production URL did not return a successful response.'
      });
      return;
    }
    await expect(page.locator('h1')).toBeVisible({ timeout: 5000 });
    await captureScreenshot(page, testInfo, 'production-demo-baseline');
  } catch (error) {
    test.info().annotations.push({
      type: 'baseline',
      description: 'Public baseline capture was unavailable: ' + String(error).slice(0, 180)
    });
  }
});
