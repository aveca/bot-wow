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
  // Full-page screenshots do not scroll the viewport; reveal-on-scroll elements
  // can otherwise remain at opacity:0 and make a healthy page look broken.
  await page.evaluate(async () => {
    // Override the site's smooth scroll for deterministic screenshot setup.
    document.documentElement.style.setProperty('scroll-behavior', 'auto', 'important');
    document.body.style.setProperty('scroll-behavior', 'auto', 'important');
    const step = Math.max(320, Math.floor(window.innerHeight * 0.72));
    const total = Math.max(document.documentElement.scrollHeight, document.body.scrollHeight);
    for (let y = 0; y < total; y += step) {
      window.scrollTo(0, y);
      await new Promise((resolve) => setTimeout(resolve, 70));
    }
    window.scrollTo(0, 0);
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    await document.fonts.ready;
    await new Promise((resolve) => setTimeout(resolve, 180));
  });
  await page.waitForFunction(() => window.scrollY === 0, null, { timeout: 1500 });
  // Keep a true viewport capture for above-the-fold review and a full-page
  // capture for continuity; fixed/sticky controls are easier to judge in the viewport.
  await page.waitForFunction(() =>
    [...document.querySelectorAll('.js .reveal')].every((el) => el.classList.contains('is-in')),
    null,
    { timeout: 6000 }
  );
  await page.screenshot({
    path: path.join(artifactDir, name + '-viewport-' + testInfo.project.name + '.png'),
    fullPage: false,
    animations: 'disabled'
  });
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
  await expect(page.locator('#release-availability-notice')).toBeVisible();
  await expect(page.locator('#release-availability-notice')).toContainText('do not purchase until delivery is confirmed');
  await expect(page.locator('a[data-cta-id="hero-demo"]')).toBeVisible();
  await expect(page.locator('a[data-cta-id="hero-offer"]')).toBeVisible();
  await expect(page.locator('nav .nav-links a[href="./features.html"]')).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
  await captureScreenshot(page, testInfo, 'homepage');
  expect(errors).toEqual([]);
});

test('P0: purchase blocked when delivery not confirmed', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);

  // buy.html : bouton de paiement desactive, message de blocage visible
  const response = await page.goto('/buy.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();
  const buyBtn = page.locator('#buyBtn');
  await expect(buyBtn).toBeDisabled();
  await expect(page.locator('.checkout-blocked')).toBeVisible();
  await expect(page.locator('#release-availability-notice')).toContainText('do not purchase until delivery is confirmed');

  // index.html : CTA navigation pointe vers la demo, pas vers le checkout
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('a[data-cta-id="nav-demo"]')).toBeAttached();
  await expect(page.locator('nav .nav-links a[href="#buy"]')).toHaveCount(0);
  await expect(page.locator('#release-availability-notice')).toContainText('do not purchase until delivery is confirmed');

  // Soumission du formulaire bloquee (meme via Enter)
  await page.fill('#email', 'test@example.com');
  await page.press('#email', 'Enter');
  await expect(page.locator('#buyErr')).not.toContainText('redirect');
  await expect(page.locator('#buyOk')).not.toContainText('redirect');

  await captureScreenshot(page, testInfo, 'purchase-blocked');
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
  const mobileOffer = page.locator('.demo-mobile-offer');
  if ((page.viewportSize()?.width ?? 1440) <= 640) {
    await expect(mobileOffer).toBeVisible();
    await expect(mobileOffer.locator('a')).toHaveAttribute('href', './#buy');
    await expect(mobileOffer).toContainText('€20.00');
  } else {
    await expect(mobileOffer).toBeHidden();
  }
  await expect(page.locator('a[href="./#features"]')).toHaveCount(0);

  await expect(page.locator('#m-spots')).not.toHaveText('–', { timeout: 10000 });
  await expect(page.locator('#oasis .node')).not.toHaveCount(0);
  const timelineColumns = await page.locator('#steps').evaluate((element) =>
    getComputedStyle(element).gridTemplateColumns.trim().split(/\s+/).filter(Boolean).length
  );
  expect(timelineColumns).toBe(1);
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
  const mobileOffer = page.locator('.demo-mobile-offer');
  if ((page.viewportSize()?.width ?? 1440) <= 640) {
    await expect(mobileOffer).toBeVisible();
    await expect(mobileOffer.locator('a')).toHaveAttribute('href', './#buy');
    await expect(mobileOffer).toContainText('20,00 €');
  } else {
    await expect(mobileOffer).toBeHidden();
  }
  await expect(page.locator('a[href="../#offre"]')).toHaveCount(0);
  await expect(page.locator('a[href="../#features"]')).toHaveCount(0);
  await expect(page.locator('#m-spots')).not.toHaveText('–', { timeout: 10000 });
  await expectNoHorizontalOverflow(page);
  await captureScreenshot(page, testInfo, 'demo-fr');
  expect(errors).toEqual([]);
});


const commercialPages = [
  { name: 'modules-en', path: '/modules.html', lang: 'en' },
  { name: 'compare-en', path: '/compare.html', lang: 'en' },
  { name: 'features-en', path: '/features.html', lang: 'en' },
  { name: 'faq-en', path: '/faq.html', lang: 'en' },
  { name: 'modules-fr', path: '/fr/modules.html', lang: 'fr' },
  { name: 'compare-fr', path: '/fr/compare.html', lang: 'fr' },
  { name: 'features-fr', path: '/fr/features.html', lang: 'fr' },
  { name: 'faq-fr', path: '/fr/faq.html', lang: 'fr' }
];

for (const route of commercialPages) {
  test(`${route.name}: real browser, purchase path and responsive layout`, async ({ page }, testInfo) => {
    const errors = collectPageErrors(page);
    const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    expect(response && response.ok(), `HTTP response for ${route.path}`).toBeTruthy();
    await expect(page.locator('html')).toHaveAttribute('lang', route.lang);
    await expect(page.locator('h1').first()).toBeVisible();
    await expect(page.locator('nav .logo')).toBeVisible();
    await expect(page.locator('nav .logo-mark')).toHaveCount(1);
    await expect(page.locator('nav .mark')).toHaveCount(0);
    await expect(page.locator('.mark')).toHaveCount(0);
    await expect(page.locator('footer .logo-mark')).toHaveCount(1);
    // Navigation links collapse on mobile by design; validate their presence
    // without treating an intentionally hidden desktop menu as a UI defect.
    await expect(page.locator('nav .nav-links a').first()).toBeAttached();
    await expect(page.locator('a[href*="demo.html"]:visible').first()).toBeVisible();
    const purchasePaths = await page.locator('a[href*="#offre"], a[href*="#buy"]').count();
    expect(purchasePaths).toBeGreaterThan(0);
    await expectNoHorizontalOverflow(page);
    await captureScreenshot(page, testInfo, route.name);
    expect(errors, `JavaScript errors on ${route.path}`).toEqual([]);
  });
}


const legacyLogoRoutes = [
  { name: '404-en', path: '/404.html' },
  { name: 'cancel-en', path: '/cancel.html' },
  { name: 'compatibility-en', path: '/compatibility.html' },
  { name: 'fishing-en', path: '/fishing.html' },
  { name: 'getting-started-en', path: '/getting-started.html' },
  { name: 'roadmap-en', path: '/roadmap.html' },
  { name: 'success-en', path: '/success.html' },
  { name: '404-fr', path: '/fr/404.html' },
  { name: 'cancel-fr', path: '/fr/cancel.html' },
  { name: 'compatibility-fr', path: '/fr/compatibility.html' },
  { name: 'fishing-fr', path: '/fr/fishing.html' },
  { name: 'getting-started-fr', path: '/fr/getting-started.html' },
  { name: 'roadmap-fr', path: '/fr/roadmap.html' },
  { name: 'success-fr', path: '/fr/success.html' }
];

for (const route of legacyLogoRoutes) {
  test(`${route.name}: no legacy square W wordmark remains`, async ({ page }) => {
    await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.mark')).toHaveCount(0);
    await expect(page.locator('.logo-mark').first()).toBeAttached();
  });
}

test('capture current public homepage as a before-change visual baseline when reachable', async ({ page }, testInfo) => {
  try {
    const response = await page.goto('https://bot-wow.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 12000
    });
    if (!response || !response.ok()) {
      test.info().annotations.push({
        type: 'baseline',
        description: 'Public homepage baseline not captured: production did not return a successful response.'
      });
      return;
    }
    await expect(page.locator('h1')).toBeVisible({ timeout: 5000 });
    await captureScreenshot(page, testInfo, 'production-homepage-baseline');
  } catch (error) {
    test.info().annotations.push({
      type: 'baseline',
      description: 'Public homepage baseline capture was unavailable: ' + String(error).slice(0, 180)
    });
  }
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
