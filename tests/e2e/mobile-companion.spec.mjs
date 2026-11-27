/**
 * mobile-companion.spec.mjs — QA navigateur reelle du compagnon mobile PWA
 * (page neuve `docs/mobile/`, issue #225).
 *
 * POURQUOI CE FICHIER :
 *   `npm test` ne couvre pas le runtime navigateur d'une page qui n'existait
 *   pas. Ces tests-la prouvent, dans un vrai Chromium, ce que la mission #225
 *   exige : 4 largeurs de telephone, zones sures, manifeste + icones reels,
 *   service worker qui rend la page HORS LIGNE sans inventer de contenu, et
 *   accessibilite (lien d'evitement, libelles, annonces aria-live).
 *
 * CE QU'ILS NE FONT PAS :
 *   - ils ne simulent aucun paiement, aucune licence, aucune installation
 *     reelle sur telephone (Apple ne se pilote pas ici) ;
 *   - ils n'affirment rien que le DOM ne montre pas : chaque etat verifie
 *     est un etat que la page assume (ex. « No answer » quand l'API echoue).
 *
 * URL testee : `/docs/mobile/` (servee par scripts/serve.mjs depuis `_site`,
 * donc apres `node scripts/build-site.mjs _site`, comme les autres specs).
 */
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

const PAGE = '/docs/mobile/';
const artifactDir = path.join(process.cwd(), 'artifacts', 'ui');

// Largeurs exigees par #225 : 320 (Android entree de gamme), 375/390 (iPhone),
// 430 (grand telephone Android).
const VIEWPORTS = [
  { name: 'w320', width: 320, height: 568 },
  { name: 'w375', width: 375, height: 667 },
  { name: 'w390', width: 390, height: 844 },
  { name: 'w430', width: 430, height: 932 },
];

function collectPageErrors(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(String(error.message || error)));
  return errors;
}

async function captureScreenshot(page, testInfo, name) {
  fs.mkdirSync(artifactDir, { recursive: true });
  await page.screenshot({
    path: path.join(artifactDir, `${name}-${testInfo.project.name}.png`),
    fullPage: true,
    animations: 'disabled',
  });
}

async function expectNoHorizontalOverflow(page) {
  const dimensions = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
  }));
  // +1 : une rotation de sous-pixel ne doit pas faire echouer la QA.
  expect(dimensions.documentWidth).toBeLessThanOrEqual(dimensions.viewportWidth + 1);
}

/** L'API de statut est distante : on la neutralise pour rendre le test
 *  deterministe, en injectant la forme EXACTE renvoyee par /api/config
 *  (verifiee en production le 2026-11-27 : contactEmail, offers 900/2900). */
async function stubStatusApi(page, { ok = true } = {}) {
  await page.route('**/api.bot-wow.com/api/config', async (route) => {
    if (!ok) return route.abort('failed');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        contactEmail: 'support@bot-wow.com',
        product: 'bot-wow-lifetime',
        priceEur: 20,
        currency: 'eur',
        automationForSale: false,
        offers: [
          { priceKey: 'planner', amount: 900, currency: 'eur' },
          { priceKey: 'studio', amount: 2900, currency: 'eur' },
        ],
      }),
    });
  });
}

/* ------------------------------------------------------------------ *
 * 1. Rendu sur les quatre largeurs de telephone
 * ------------------------------------------------------------------ */
for (const vp of VIEWPORTS) {
  test(`mobile companion: ${vp.name} renders without horizontal overflow`, async ({ page }, testInfo) => {
    const errors = collectPageErrors(page);
    await stubStatusApi(page);
    await page.setViewportSize({ width: vp.width, height: vp.height });

    const response = await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
    expect(response && response.status()).toBe(200);

    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Spots and route' })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await captureScreenshot(page, testInfo, `mobile-companion-${vp.name}`);
    expect(errors).toEqual([]);
  });
}

/* ------------------------------------------------------------------ *
 * 2. Zones sures : la page les declare et le navigateur les resout
 * ------------------------------------------------------------------ */
test('mobile companion: safe areas are declared and resolved', async ({ page }) => {
  await stubStatusApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });

  // viewport-fit=cover est obligatoire pour que env() ne vaille pas 0 partout.
  const viewport = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(viewport).toContain('viewport-fit=cover');

  // Les variables existent et se resolvent (une valeur en px, pas vide/invalide).
  const resolved = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const read = (name) => cs.getPropertyValue(name).trim();
    return { top: read('--safe-top'), bottom: read('--safe-bottom'), tap: read('--tap') };
  });
  expect(resolved.top).toMatch(/px$/);
  expect(resolved.bottom).toMatch(/px$/);
  expect(Number.parseFloat(resolved.tap)).toBeGreaterThanOrEqual(44);

  // La feuille inline les consomme reellement (sinon la declaration est morte).
  // Regex et non includes() : la regle porte une valeur de repli
  // env(safe-area-inset-top, 0px), donc la parenthese fermante n'est pas
  // immediatement apres le nom.
  const usesEnv = await page.evaluate(() => {
    const blocks = [...document.querySelectorAll('style')].map((s) => s.textContent).join('\n');
    return /env\(safe-area-inset-top/.test(blocks)
      && /env\(safe-area-inset-bottom/.test(blocks);
  });
  expect(usesEnv).toBe(true);
});

/* ------------------------------------------------------------------ *
 * 3. Manifeste et icones : reels, joignables, conformes
 * ------------------------------------------------------------------ */
test('mobile companion: manifest and icon files are real and reachable', async ({ page, request }) => {
  await stubStatusApi(page);
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });

  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBe('./manifest.webmanifest');

  const res = await request.get(new URL(href, 'http://127.0.0.1:8099/docs/mobile/').toString());
  expect(res.status()).toBe(200);
  const manifest = await res.json();

  expect(manifest.name).toBe('BOT-WOW mobile companion');
  expect(manifest.short_name.length).toBeGreaterThan(0);
  expect(manifest.start_url).toBe('./');
  expect(manifest.scope).toBe('./');
  expect(manifest.display).toBe('standalone');
  expect(manifest.theme_color).toBe('#06070a');
  expect(manifest.lang).toBe('en');
  // Installable : au moins une icone 192 et une 512 (regle Chrome/Android).
  const sizes = manifest.icons.map((i) => i.sizes);
  expect(sizes).toContain('192x192');
  expect(sizes).toContain('512x512');
  expect(manifest.icons.some((i) => i.purpose === 'maskable')).toBe(true);

  // Chaque icone annoncee est bien servie, et c'est un PNG.
  for (const icon of manifest.icons) {
    const r = await request.get(new URL(icon.src, 'http://127.0.0.1:8099/docs/mobile/').toString());
    expect(r.status(), `icone ${icon.src}`).toBe(200);
    expect(r.headers()['content-type']).toContain('image/png');
  }

  // L'icone Apple (hors manifeste, attachee par le <head>) existe aussi.
  const appleHref = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  const apple = await request.get(new URL(appleHref, 'http://127.0.0.1:8099/docs/mobile/').toString());
  expect(apple.status()).toBe(200);
});

/* ------------------------------------------------------------------ *
 * 4. Service worker : enregistre, puis rend la page hors ligne
 * ------------------------------------------------------------------ */
test('mobile companion: service worker serves the page offline, honestly', async ({ page, context }) => {
  const errors = collectPageErrors(page);
  await stubStatusApi(page);
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });

  const registration = await page.evaluate(async () => {
    const reg = await navigator.serviceWorker.ready;
    return { scope: reg.scope, active: Boolean(reg.active) };
  });
  expect(registration.active).toBe(true);
  expect(registration.scope).toContain('/docs/mobile/');

  // Rechargement en ligne : le worker controle desormais la page.
  await page.reload({ waitUntil: 'domcontentloaded' });
  const controlled = await page.evaluate(() => Boolean(navigator.serviceWorker.controller));
  expect(controlled).toBe(true);

  // Reseau coupe : la vraie page sort du cache, avec ses vrais champs.
  await context.setOffline(true);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('h1')).toBeVisible();
  await expect(page.locator('#spot-name')).toBeVisible();
  await expect(page.locator('#offline')).toBeVisible();
  await expectNoHorizontalOverflow(page);
  await captureScreenshot(page, { project: { name: 'offline' } }, 'mobile-companion-offline');
  await context.setOffline(false);

  expect(errors).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * 5. Statut du service : relit l'API, et dit la verite quand elle echoue
 * ------------------------------------------------------------------ */
test('mobile companion: status box reports the API answer', async ({ page }) => {
  await stubStatusApi(page, { ok: true });
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#k-api')).toHaveText(/^Answered /);
  await expect(page.locator('#k-api')).toHaveClass(/ok/);
  await expect(page.locator('#k-api-detail')).toContainText('support@bot-wow.com');
});

test('mobile companion: status box says so when the API does not answer', async ({ page }) => {
  // Aucune lecture precedente en cache : la page doit annoncer l'absence de
  // reponse, pas afficher une etat invente.
  await stubStatusApi(page, { ok: false });
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('#k-api')).toHaveText('No answer');
  await expect(page.locator('#k-api')).toHaveClass(/away/);
  await expect(page.locator('#k-api-detail')).toContainText('did not answer');
});

/* ------------------------------------------------------------------ *
 * 6. Hologation du perimetre : pas de compte, pas de licence simulee
 * ------------------------------------------------------------------ */
test('mobile companion: no account, no licence, no game automation claimed', async ({ page }) => {
  await stubStatusApi(page);
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });

  const html = (await page.content()).toLowerCase();
  expect(html).not.toContain('no paid offer');
  expect(html).not.toContain('waitlist');
  // Aucune API de licence n'est documentee ni sure en production (mesure du
  // 2026-11-27 : POST /api/access -> 400 missing_key / invalid_json,
  // GET -> 404 not_found) : la page ne doit proposer aucun champ de cle.
  await expect(page.locator('#key-form')).toHaveCount(0);
  await expect(page.locator('input[type="password"]')).toHaveCount(0);
  await expect(page.getByText(/reads the game|automatically clicks|injects/i)).toHaveCount(0);

  // La page dit explicitement ce qu'elle ne fait pas.
  await expect(page.getByText(/does not read the game/i).first()).toBeVisible();
  await expect(page.locator('#k-key')).toHaveText('Not available');
});

/* ------------------------------------------------------------------ *
 * 7. Accessibilite : evitement, libelles, annonces, cibles tactiles
 * ------------------------------------------------------------------ */
test('mobile companion: accessibility basics hold', async ({ page }) => {
  await stubStatusApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });

  // Lien d'evitement : present, focalisable, pointe vers l'outil.
  await page.keyboard.press('Tab');
  const skip = page.locator('.skip-link');
  await expect(skip).toBeFocused();
  await expect(skip).toHaveAttribute('href', '#tool');

  // Chaque champ a un libelle (label[for] ou aria-label).
  const unlabelled = await page.evaluate(() =>
    [...document.querySelectorAll('input')]
      .filter((el) => !el.labels?.length && !el.getAttribute('aria-label'))
      .map((el) => el.id || el.name || 'sans-nom'));
  expect(unlabelled).toEqual([]);

  // Les zones d'annonce existent (role=status / aria-live).
  const live = await page.locator('[aria-live="polite"]').count();
  expect(live).toBeGreaterThanOrEqual(3);

  // Cibles tactiles : aucun bouton sous 44px de haut sur mobile.
  const tooSmall = await page.evaluate(() =>
    [...document.querySelectorAll('button')]
      .filter((b) => b.offsetParent !== null && b.getBoundingClientRect().height < 44)
      .map((b) => b.id || b.textContent.trim().slice(0, 24)));
  expect(tooSmall).toEqual([]);
});

/* ------------------------------------------------------------------ *
 * 8. Calculs locaux : route, marge, journal — sur l'appareil
 * ------------------------------------------------------------------ */
test('mobile companion: spots, margin and journal compute on the device', async ({ page }) => {
  await stubStatusApi(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(PAGE, { waitUntil: 'domcontentloaded' });

  // Deux spots : la route se reevalue et la distance totale s'affiche.
  await page.locator('#spot-name').fill('River');
  await page.locator('#spot-x').fill('0');
  await page.locator('#spot-y').fill('0');
  await page.getByRole('button', { name: 'Add spot' }).click();
  await page.locator('#spot-name').fill('Camp');
  await page.locator('#spot-x').fill('3');
  await page.locator('#spot-y').fill('4');
  await page.getByRole('button', { name: 'Add spot' }).click();

  await expect(page.locator('#route li')).toHaveCount(2);
  // 3-4-5 : la distance euclidienne entre les deux points vaut exactement 5.
  await expect(page.locator('#distance')).toContainText('5.00');

  // Marge : (sell - buy) x count, sur les nombres saisis.
  await page.locator('#m-label').fill('Ore');
  await page.locator('#m-buy').fill('10');
  await page.locator('#m-sell').fill('15');
  await page.locator('#m-count').fill('4');
  await page.getByRole('button', { name: 'Calculate' }).click();
  await expect(page.locator('#margin-out')).toContainText('20');

  // Journal : une note locale, aucune reponse serveur.
  await page.locator('#j-what').fill('Salmon');
  await page.locator('#j-count').fill('3');
  await page.getByRole('button', { name: 'Add note' }).click();
  await expect(page.locator('#journal li')).toHaveCount(1);
  await expect(page.locator('#journal-empty')).toBeHidden();
});