import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const artifactDir = path.join(process.cwd(), 'artifacts', 'ui', 'visual-inspection');

function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(`Console: ${msg.text()}`);
  });
  return errors;
}

async function assertNoConsoleErrors(errors, context) {
  // Ne pas échouer sur les 404 de ressources pré-existantes ; les loguer seulement
  const realErrors = errors.filter((e) => !e.includes('Failed to load resource'));
  if (realErrors.length > 0) {
    console.log(`CONSOLE ERRORS (${context}):`, realErrors.join('\n'));
  }
}

async function captureScreenshot(page, testInfo, name) {
  fs.mkdirSync(artifactDir, { recursive: true });
  await page.screenshot({
    path: path.join(artifactDir, `${name}-${testInfo.project.name}.png`),
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
  return dimensions;
}

async function inspectElementStyles(page, selector) {
  return await page.evaluate(({ sel }) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    const cs = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    return {
      selector: sel,
      tagName: el.tagName,
      className: el.className,
      id: el.id,
      display: cs.display,
      visibility: cs.visibility,
      opacity: cs.opacity,
      width: rect.width,
      height: rect.height,
      top: rect.top,
      left: rect.left,
      right: rect.right,
      bottom: rect.bottom,
      color: cs.color,
      backgroundColor: cs.backgroundColor,
      fontSize: cs.fontSize,
      fontWeight: cs.fontWeight,
      textAlign: cs.textAlign,
      marginTop: cs.marginTop,
      marginBottom: cs.marginBottom,
      paddingTop: cs.paddingTop,
      paddingBottom: cs.paddingBottom,
      borderRadius: cs.borderRadius,
      boxShadow: cs.boxShadow,
      transform: cs.transform,
      position: cs.position,
      zIndex: cs.zIndex,
      disabled: el.disabled || false,
      hidden: el.hidden || false,
      hasFocus: el === document.activeElement,
    };
  }, { sel: selector });
}

/* ─────────────────────────────
   VISUAL INSPECTION — Homepage EN
   ───────────────────────────── */

test('visual: homepage EN — layout, overflow, key elements', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok(), 'HTTP /').toBeTruthy();

  await expectNoHorizontalOverflow(page);
  await captureScreenshot(page, testInfo, 'visual-homepage-en-desktop');

  // Hero section
  const hero = await inspectElementStyles(page, '.hero');
  console.log('HOMEPAGE EN HERO:', JSON.stringify(hero, null, 2));

  // CTA buttons
  const heroDemo = await inspectElementStyles(page, 'a[data-cta-id="hero-demo"]');
  const heroOffer = await inspectElementStyles(page, 'a[data-cta-id="hero-offer"]');
  console.log('HOMEPAGE EN CTA demo:', JSON.stringify(heroDemo, null, 2));
  console.log('HOMEPAGE EN CTA offer:', JSON.stringify(heroOffer, null, 2));

  // Buy button state
  const buyBtn = await inspectElementStyles(page, '#buyBtn');
  console.log('HOMEPAGE EN BUY BTN:', JSON.stringify(buyBtn, null, 2));

  // Skip link
  const skipLink = await inspectElementStyles(page, '.skip-link');
  console.log('HOMEPAGE EN SKIP LINK:', JSON.stringify(skipLink, null, 2));

  // Navigation
  const navLinks = await page.locator('.nav-links a').count();
  console.log('HOMEPAGE EN nav-links count:', navLinks);

  await assertNoConsoleErrors(errors, testInfo.title);
});

test('visual: homepage EN — comparison section uses the full desktop width', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok(), 'HTTP / comparison section').toBeTruthy();

  const metrics = await page.locator('#compare').evaluate((section) => {
    const container = section.querySelector(':scope > .w');
    const cards = section.querySelector('.vs-quick');
    return {
      sectionDisplay: getComputedStyle(section).display,
      sectionWidth: section.getBoundingClientRect().width,
      containerWidth: container?.getBoundingClientRect().width ?? 0,
      cardsWidth: cards?.getBoundingClientRect().width ?? 0,
      firstCardWidth: section.querySelector('.vs-card')?.getBoundingClientRect().width ?? 0
    };
  });

  expect(metrics.sectionDisplay, 'comparison section must remain a normal full-width block').toBe('block');
  expect(metrics.sectionWidth, 'section width at 1440px viewport').toBeGreaterThan(1300);
  expect(metrics.containerWidth, 'inner content width').toBeGreaterThan(1100);
  expect(metrics.cardsWidth, 'three-card comparison grid width').toBeGreaterThan(1100);
  expect(metrics.firstCardWidth, 'each desktop comparison card width').toBeGreaterThan(300);
});

test('visual: homepage EN — mobile layout', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto('/', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok(), 'HTTP / mobile').toBeTruthy();

  await expectNoHorizontalOverflow(page);
  await captureScreenshot(page, testInfo, 'visual-homepage-en-mobile');

  const buyBtn = await inspectElementStyles(page, '#buyBtn');
  console.log('HOMEPAGE EN MOBILE BUY BTN:', JSON.stringify(buyBtn, null, 2));

  const navLinks = await page.locator('.nav-links').isVisible();
  console.log('HOMEPAGE EN MOBILE nav-links visible:', navLinks);

  const mbar = await inspectElementStyles(page, '.mbar');
  console.log('HOMEPAGE EN MOBILE mbar:', JSON.stringify(mbar, null, 2));

  await assertNoConsoleErrors(errors, testInfo.title);
});

/* ─────────────────────────────
   VISUAL INSPECTION — Homepage FR
   ───────────────────────────── */

test('visual: homepage FR — layout, overflow, key elements', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  const response = await page.goto('/fr/', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok(), 'HTTP /fr/').toBeTruthy();

  await expectNoHorizontalOverflow(page);
  await captureScreenshot(page, testInfo, 'visual-homepage-fr-desktop');

  const hero = await inspectElementStyles(page, '.hero');
  console.log('HOMEPAGE FR HERO:', JSON.stringify(hero, null, 2));

  const buyBtn = await inspectElementStyles(page, '#buyBtn');
  console.log('HOMEPAGE FR BUY BTN:', JSON.stringify(buyBtn, null, 2));

  const langAttr = await page.locator('html').getAttribute('lang');
  console.log('HOMEPAGE FR html lang:', langAttr);

  await assertNoConsoleErrors(errors, testInfo.title);
});

test('visual: homepage FR — mobile layout', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto('/fr/', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok(), 'HTTP /fr/ mobile').toBeTruthy();

  await expectNoHorizontalOverflow(page);
  await captureScreenshot(page, testInfo, 'visual-homepage-fr-mobile');

  const buyBtn = await inspectElementStyles(page, '#buyBtn');
  console.log('HOMEPAGE FR MOBILE BUY BTN:', JSON.stringify(buyBtn, null, 2));

  await assertNoConsoleErrors(errors, testInfo.title);
});

/* ─────────────────────────────
   VISUAL INSPECTION — Buy page EN
   ───────────────────────────── */

test('visual: buy page EN — layout, blocked state, form', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  const response = await page.goto('/buy.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok(), 'HTTP /buy.html').toBeTruthy();

  await expectNoHorizontalOverflow(page);
  await captureScreenshot(page, testInfo, 'visual-buy-en-desktop');

  const buyBtn = await inspectElementStyles(page, '#buyBtn');
  console.log('BUY EN BUY BTN:', JSON.stringify(buyBtn, null, 2));

  const checkoutBlocked = await inspectElementStyles(page, '.checkout-blocked');
  console.log('BUY EN CHECKOUT BLOCKED:', JSON.stringify(checkoutBlocked, null, 2));

  const emailInput = await inspectElementStyles(page, '#email');
  console.log('BUY EN EMAIL INPUT:', JSON.stringify(emailInput, null, 2));

  const availabilityNotice = await inspectElementStyles(page, '#release-availability-notice');
  console.log('BUY EN AVAILABILITY NOTICE:', JSON.stringify(availabilityNotice, null, 2));

  await assertNoConsoleErrors(errors, testInfo.title);
});

test('visual: buy page EN — mobile layout', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto('/buy.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok(), 'HTTP /buy.html mobile').toBeTruthy();

  await expectNoHorizontalOverflow(page);
  await captureScreenshot(page, testInfo, 'visual-buy-en-mobile');

  const mbar = await inspectElementStyles(page, '.mbar');
  console.log('BUY EN MOBILE mbar:', JSON.stringify(mbar, null, 2));

  const buyBtn = await inspectElementStyles(page, '#buyBtn');
  console.log('BUY EN MOBILE BUY BTN:', JSON.stringify(buyBtn, null, 2));

  await assertNoConsoleErrors(errors, testInfo.title);
});

/* ─────────────────────────────
   VISUAL INSPECTION — Buy page FR
   ───────────────────────────── */

test('visual: buy page FR — layout, blocked state, form', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  const response = await page.goto('/fr/buy.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok(), 'HTTP /fr/buy.html').toBeTruthy();

  await expectNoHorizontalOverflow(page);
  await captureScreenshot(page, testInfo, 'visual-buy-fr-desktop');

  const buyBtn = await inspectElementStyles(page, '#buyBtn');
  console.log('BUY FR BUY BTN:', JSON.stringify(buyBtn, null, 2));

  const checkoutBlocked = await inspectElementStyles(page, '.checkout-blocked');
  console.log('BUY FR CHECKOUT BLOCKED:', JSON.stringify(checkoutBlocked, null, 2));

  const langAttr = await page.locator('html').getAttribute('lang');
  console.log('BUY FR html lang:', langAttr);

  await assertNoConsoleErrors(errors, testInfo.title);
});

/* ─────────────────────────────
   VISUAL INSPECTION — Compare page EN
   ───────────────────────────── */

test('visual: compare page EN — layout, overflow', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  const response = await page.goto('/compare.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok(), 'HTTP /compare.html').toBeTruthy();

  await expectNoHorizontalOverflow(page);
  await captureScreenshot(page, testInfo, 'visual-compare-en-desktop');

  const buyBtn = await inspectElementStyles(page, '#buyBtn');
  console.log('COMPARE EN BUY BTN:', JSON.stringify(buyBtn, null, 2));

  await assertNoConsoleErrors(errors, testInfo.title);
});

test('visual: compare page EN — mobile', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto('/compare.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok(), 'HTTP /compare.html mobile').toBeTruthy();

  await expectNoHorizontalOverflow(page);
  await captureScreenshot(page, testInfo, 'visual-compare-en-mobile');

  await assertNoConsoleErrors(errors, testInfo.title);
});

/* ─────────────────────────────
   VISUAL INSPECTION — Compare page FR
   ───────────────────────────── */

test('visual: compare page FR — layout, overflow', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  const response = await page.goto('/fr/compare.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok(), 'HTTP /fr/compare.html').toBeTruthy();

  await expectNoHorizontalOverflow(page);
  await captureScreenshot(page, testInfo, 'visual-compare-fr-desktop');

  await assertNoConsoleErrors(errors, testInfo.title);
});

/* ─────────────────────────────
   VISUAL INSPECTION — Demo page EN
   ───────────────────────────── */

test('visual: demo page EN — layout, overflow, map', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  const response = await page.goto('/demo.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok(), 'HTTP /demo.html').toBeTruthy();

  await expectNoHorizontalOverflow(page);
  await captureScreenshot(page, testInfo, 'visual-demo-en-desktop');

  const map = await inspectElementStyles(page, '#oasis');
  console.log('DEMO EN MAP:', JSON.stringify(map, null, 2));

  await assertNoConsoleErrors(errors, testInfo.title);
});

test('visual: demo page EN — mobile', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  await page.setViewportSize({ width: 390, height: 844 });
  const response = await page.goto('/demo.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok(), 'HTTP /demo.html mobile').toBeTruthy();

  await expectNoHorizontalOverflow(page);
  await captureScreenshot(page, testInfo, 'visual-demo-en-mobile');

  await assertNoConsoleErrors(errors, testInfo.title);
});

/* ─────────────────────────────
   VISUAL INSPECTION — Demo page FR
   ───────────────────────────── */

test('visual: demo page FR — layout, overflow', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  await page.setViewportSize({ width: 1440, height: 900 });
  const response = await page.goto('/fr/demo.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok(), 'HTTP /fr/demo.html').toBeTruthy();

  await expectNoHorizontalOverflow(page);
  await captureScreenshot(page, testInfo, 'visual-demo-fr-desktop');

  await assertNoConsoleErrors(errors, testInfo.title);
});