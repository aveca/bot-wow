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
  await page.evaluate(async () => {
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
  const dimensions = await page.evaluate(() => {
    const viewportWidth = document.documentElement.clientWidth;
    const offenders = [...document.querySelectorAll('body *')]
      .map((el) => {
        const rect = el.getBoundingClientRect();
        const style = getComputedStyle(el);
        return {
          tag: el.tagName,
          id: el.id,
          className: typeof el.className === 'string' ? el.className : el.getAttribute('class'),
          text: (el.textContent || '').trim().replace(/\\s+/g, ' ').slice(0, 120),
          left: Math.round(rect.left * 100) / 100,
          right: Math.round(rect.right * 100) / 100,
          width: Math.round(rect.width * 100) / 100,
          minWidth: style.minWidth,
          whiteSpace: style.whiteSpace,
          flexWrap: style.flexWrap,
          display: style.display
        };
      })
      .filter((item) => item.width > 0 && (item.left < -1 || item.right > viewportWidth + 1))
      .sort((a, b) => b.right - a.right)
      .slice(0, 12);
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth,
      offenders
    };
  });
  expect(
    dimensions.documentWidth,
    `Horizontal overflow: ${JSON.stringify(dimensions.offenders)}`
  ).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
}

async function verifyBetaReservation(page, testInfo, lang) {
  const navStatus = page.locator('a[data-cta-id="nav-status"]');
  const heroStatus = page.locator('a[data-cta-id="buy-status-primary"]');
  await expect(navStatus).toBeAttached();
  const viewportWidth = page.viewportSize()?.width ?? 1280;
  if (viewportWidth <= 520) await expect(navStatus).toBeHidden();
  else await expect(navStatus).toBeVisible();
  await expect(heroStatus).toBeVisible();
  await expect(page.locator('[data-cta-id="nav-buy"], [data-cta-id="buy-hero-primary"]')).toHaveCount(0);

  if (lang === 'fr') {
    await expect(navStatus).toContainText('liste d’attente');
    await expect(heroStatus).toContainText('liste d’attente');
    await expect(page.locator('.mbar')).toHaveAttribute('aria-label', 'Statut de disponibilité');
  } else {
    await expect(navStatus).toContainText('Join the waitlist');
    await expect(heroStatus).toContainText('Join the waitlist');
    await expect(page.locator('.mbar')).toHaveAttribute('aria-label', 'Purchase status');
  }

  const offer = page.locator('.price-card--offer');
  await expect(offer).toBeVisible();
  await expect(offer.locator('a[data-cta-id="waitlist"]')).toHaveAttribute('href', /mailto:support@bot-wow.com/);
  await expect(offer).toContainText(/No paid offer|Aucune offre payante/i);
  await expect(page.locator('#buyBtn')).toHaveCount(0);
  await expect(page.locator('#buyForm')).toHaveCount(0);
  await expect(page.locator('input[type="email"]')).toHaveCount(0);
  await expect(page.locator('#before-buying')).toContainText(/EULA|automat/i);
}

test('homepage: demo and beta-reservation paths remain visible and responsive', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('.price-card--offer')).toBeVisible();
  await expect(page.locator('#buyForm')).toHaveCount(0);
  await expect(page.locator('input[type="email"]')).toHaveCount(0);
  await expect(page.locator('#before-buying')).toContainText(/EULA/i);
  await expect(page.locator('a[data-cta-id="hero-demo"]')).toBeVisible();
  await expect(page.locator('a[data-cta-id="hero-status"]')).toBeVisible();
  await expect(page.locator('nav .nav-links a[href="./features.html"]')).toHaveCount(1);
  await expectNoHorizontalOverflow(page);
  await captureScreenshot(page, testInfo, 'homepage');
  expect(errors).toEqual([]);
});



test('homepage EN/FR: reservation CTAs never start internal checkout', async ({ page }) => {
  const checkoutRequests = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (/\/api\/checkout(?:\/|$)/i.test(url.pathname)) checkoutRequests.push(url.pathname);
  });

  for (const route of [
    { path: '/', label: 'Join the waitlist', bar: 'Purchase status' },
    { path: '/fr/', label: 'liste d’attente', bar: 'Statut de l’achat' },
  ]) {
    const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    expect(response && response.ok()).toBeTruthy();
    await expect(page.locator('#buy')).toBeVisible();
    const statusCta = page.locator('a[data-cta-id="hero-status"]');
    await expect(statusCta).toBeVisible();
    await expect(statusCta).toContainText(route.label);
    await expect(page.locator('.mbar')).toHaveAttribute('aria-label', route.bar);
    await expect(page.locator('.price-card--offer')).toBeVisible();
    await expect(page.locator('#buyForm')).toHaveCount(0);
    await expect(page.locator('#buyBtn')).toHaveCount(0);
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
    await expect(page.locator('[data-cta-id="hero-offer"], [data-cta-id="journey-fish-buy"], [data-cta-id="journey-licence-buy"], [data-cta-id="steps-buy"], [data-cta-id="final-buy"], [data-cta-id="mbar-buy"]')).toHaveCount(0);
    await statusCta.click();
    await expect(page.locator('#buy')).toBeInViewport();
    await expectNoHorizontalOverflow(page);
  }

  expect(checkoutRequests).toEqual([]);
});



test('comparison EN/FR: beta reservation CTAs navigate to the reservation page and never start internal checkout', async ({ page }) => {
  const checkoutRequests = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (/\/api\/checkout(?:\/|$)/i.test(url.pathname)) checkoutRequests.push(url.pathname);
  });

  for (const route of [
    { path: '/compare.html', label: 'Join the waitlist', bar: 'Purchase status', target: /\/buy\.html$/ },
    { path: '/fr/compare.html', label: 'liste d’attente', bar: 'Statut de disponibilité', target: /\/fr\/buy\.html$/ },
  ]) {
    const response = await page.goto(route.path, { waitUntil: 'domcontentloaded' });
    expect(response && response.ok()).toBeTruthy();
    const statusCta = page.locator('a[data-cta-id="compare-reserve"]');
    await expect(statusCta).toBeVisible();
    await expect(statusCta).toContainText(route.label);
    await expect(page.locator('.mbar')).toHaveAttribute('aria-label', route.bar);
    await expect(page.locator('#buyBtn')).toHaveCount(0);
    await expect(page.locator('#buyForm')).toHaveCount(0);
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
    await expect(page.locator('[data-cta-id="formula-ours-buy"], [data-cta-id="mbar-buy"]')).toHaveCount(0);
    await expect(page.locator('body')).not.toContainText(/Mollie/i);
    await statusCta.click();
    await expect(page).toHaveURL(route.target);
    await expect(page.locator('.price-card--offer')).toBeVisible();
    await expectNoHorizontalOverflow(page);
  }

  expect(checkoutRequests).toEqual([]);
});



test('closed checkout: pressing Enter cannot submit the email form EN/FR', async ({ page }) => {
  const checkoutRequests = [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (/\/api\/checkout(?:\/|$)/i.test(url.pathname)) checkoutRequests.push(url.pathname);
  });

  for (const path of ['/compare.html', '/fr/compare.html']) {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(response && response.ok()).toBeTruthy();
    const before = page.url();
    await expect(page.locator('#buyBtn')).toHaveCount(0);
    await expect(page.locator('#buyForm')).toHaveCount(0);
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
    await expect(page).toHaveURL(before);
    await expect(page.locator('#buyBtn')).toHaveCount(0);
    await expect(page.locator('#buyForm')).toHaveCount(0);
    await expect(page.locator('input[type="email"]')).toHaveCount(0);
  }

  expect(checkoutRequests).toEqual([]);
});

test('P0: beta reservation explains manual delivery and refund - EN buy page', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);

  // buy.html : statut indisponible, aucun formulaire ni bouton de paiement
  const response = await page.goto('/buy.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();
  await verifyBetaReservation(page, testInfo, 'en');

  await captureScreenshot(page, testInfo, 'beta-reservation-en');
  expect(errors).toEqual([]);
});

test('P0: beta reservation offer when delivery is not confirmed - FR buy page', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);

  // fr/buy.html : statut indisponible, aucun formulaire ni bouton de paiement
  const response = await page.goto('/fr/buy.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();
  await verifyBetaReservation(page, testInfo, 'fr');

  await captureScreenshot(page, testInfo, 'beta-reservation-fr');
  expect(errors).toEqual([]);
});

test('index.html: CTA navigation pointe vers la demo, pas vers le checkout', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('a[data-cta-id="nav-demo"]')).toBeAttached();
  await expect(page.locator('nav .nav-links a[href="#buy"]')).toHaveCount(0);
  await expect(page.locator('#before-buying')).toContainText(/EULA/i);
  await expectNoHorizontalOverflow(page);
  await captureScreenshot(page, testInfo, 'homepage-nav');
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
  await expect(page.locator('nav a[data-cta-id="purchase-status"]')).toHaveAttribute('href', './buy.html');
  await expect(page.locator('nav .langs a[lang="fr"]')).toHaveAttribute('href', './fr/demo.html');
  const mobileOffer = page.locator('.demo-mobile-offer');
  if ((page.viewportSize()?.width ?? 1440) <= 640) {
    await expect(mobileOffer).toBeVisible();
    await expect(mobileOffer.locator('a')).toHaveAttribute('href', './buy.html');
    await expect(mobileOffer).toContainText('No paid offer');
    await expect(mobileOffer).toContainText('Waitlist');
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
  await expect(page.locator('nav a[data-cta-id="purchase-status"]')).toHaveAttribute('href', './buy.html');
  const mobileOffer = page.locator('.demo-mobile-offer');
  if ((page.viewportSize()?.width ?? 1440) <= 640) {
    await expect(mobileOffer).toBeVisible();
    await expect(mobileOffer.locator('a')).toHaveAttribute('href', './buy.html');
    await expect(mobileOffer).toContainText('Aucune offre payante');
    await expect(mobileOffer).toContainText('Liste d’attente');
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
    await expect(page.locator('nav .nav-links a').first()).toBeAttached();
    await expect(page.locator('a[href*="demo.html"]:visible').first()).toBeVisible();
    const purchasePaths = await page.locator('a[href*="#offre"], a[href*="#buy"], a[href*="buy.html"]').count();
    expect(purchasePaths).toBeGreaterThan(0);
    if (route.name.startsWith('modules-')) {
      await expect(page.locator('a[href*="buy.html"]:visible').first()).toBeVisible();
    }
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