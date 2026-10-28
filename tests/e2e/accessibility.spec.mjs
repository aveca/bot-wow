import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const artifactDir = path.join(process.cwd(), 'artifacts', 'ui');

async function captureScreenshot(page, testInfo, name) {
  fs.mkdirSync(artifactDir, { recursive: true });
  await page.screenshot({
    path: path.join(artifactDir, name + '-' + testInfo.project.name + '.png'),
    fullPage: true,
    animations: 'disabled'
  });
}

function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

/* ─────────────────────────────
   ACCESSIBILITÉ — skip link
   ───────────────────────────── */

test('accessibility: skip link present and focusable on buy pages (EN + FR)', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);

  for (const [lang, path] of [['en', '/buy.html'], ['fr', '/fr/buy.html']]) {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(response && response.ok(), `HTTP ${path}`).toBeTruthy();

    // Le skip link existe
    const skip = page.locator('.skip-link');
    await expect(skip).toBeAttached();

    // Le skip link existe et pointe vers le contenu principal
    await expect(skip).toHaveAttribute('href', '#hero');

    // Le skip link est focusable (au clavier)
    await skip.focus();
    await expect(skip).toBeFocused();

    await captureScreenshot(page, testInfo, `skip-link-${lang}`);
  }
  expect(errors).toEqual([]);
});

/* ─────────────────────────────
   ACCESSIBILITÉ — focus-visible
   ───────────────────────────── */

test('accessibility: focus-visible outline on interactive elements', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);

  for (const path of ['/buy.html', '/fr/buy.html', '/index.html', '/fr/']) {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(response && response.ok(), `HTTP ${path}`).toBeTruthy();

    // Le champ email a une classe pm-input et un outline :focus-visible dans le CSS
    const email = page.locator('#email');
    await expect(email).toBeAttached();

    // Au focus clavier, l'anneau or apparait (pas outline:none sur :focus-visible)
    await email.focus();
    const focusStyle = await email.evaluate((el) => {
      const cs = getComputedStyle(el);
      return { outline: cs.outline, outlineColor: cs.outlineColor, outlineOffset: cs.outlineOffset };
    });
    expect(focusStyle.outline).not.toBe('none');
    expect(focusStyle.outlineOffset).not.toBe('0px');

    await captureScreenshot(page, testInfo, `focus-visible-${path.replace(/\//g, '-')}`);
  }
  expect(errors).toEqual([]);
});

/* ─────────────────────────────
   ACCESSIBILITÉ — labels + ARIA
   ───────────────────────────── */

test('accessibility: email input has label and aria-describedby', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);

  for (const path of ['/buy.html', '/fr/buy.html', '/index.html', '/fr/']) {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(response && response.ok(), `HTTP ${path}`).toBeTruthy();

    const email = page.locator('#email');
    await expect(email).toBeAttached();

    // L'input a un type email
    await expect(email).toHaveAttribute('type', 'email');

    // Un label est associe (for="email")
    await expect(page.locator('label[for="email"]')).toBeAttached();

    // aria-describedby pointe vers les messages d'erreur/succès
    await expect(email).toHaveAttribute('aria-describedby', /buyErr/);
    await expect(email).toHaveAttribute('aria-describedby', /buyOk/);

    await captureScreenshot(page, testInfo, `aria-email-${path.replace(/\//g, '-')}`);
  }
  expect(errors).toEqual([]);
});

/* ─────────────────────────────
   ACCESSIBILITÉ — pas d'IDs dupliqués
   ───────────────────────────── */

test('accessibility: no duplicate IDs on buy pages', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);

  for (const [lang, path] of [['en', '/buy.html'], ['fr', '/fr/buy.html']]) {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(response && response.ok(), `HTTP ${path}`).toBeTruthy();

    // Verifie qu'il n'y a qu'un seul element avec chaque ID critique
    const duplicateIds = await page.evaluate(() => {
      const ids = {};
      const all = document.querySelectorAll('[id]');
      for (const el of all) {
        const id = el.id;
        if (!id) continue;
        ids[id] = (ids[id] || 0) + 1;
      }
      const dups = {};
      for (const [id, count] of Object.entries(ids)) {
        if (count > 1) dups[id] = count;
      }
      return dups;
    });
    expect(duplicateIds).toEqual({}, `${path} should have no duplicate IDs, found: ${JSON.stringify(duplicateIds)}`);
  }
  expect(errors).toEqual([]);
});

/* ─────────────────────────────
   ACCESSIBILITÉ — attribut lang
   ───────────────────────────── */

test('accessibility: html lang attribute matches page language', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);

  for (const [lang, path] of [['en', '/buy.html'], ['fr', '/fr/buy.html'], ['en', '/index.html'], ['fr', '/fr/']]) {
    const response = await page.goto(path, { waitUntil: 'domcontentloaded' });
    expect(response && response.ok(), `HTTP ${path}`).toBeTruthy();
    await expect(page.locator('html')).toHaveAttribute('lang', lang);
  }
  expect(errors).toEqual([]);
});

/* ─────────────────────────────
   ACCESSIBILITÉ — FAQ details/summary
   ───────────────────────────── */

test('accessibility: FAQ details/summary are keyboard accessible', async ({ page }, testInfo) => {
  const errors = collectPageErrors(page);
  const response = await page.goto('/buy.html', { waitUntil: 'domcontentloaded' });
  expect(response && response.ok()).toBeTruthy();

  const firstSummary = page.locator('.qa summary').first();
  await expect(firstSummary).toBeAttached();

  // Le details est referme par defaut
  const firstDetails = page.locator('.qa').first();
  await expect(firstDetails).not.toHaveAttribute('open');

  await captureScreenshot(page, testInfo, 'faq-accessibility');
  expect(errors).toEqual([]);
});