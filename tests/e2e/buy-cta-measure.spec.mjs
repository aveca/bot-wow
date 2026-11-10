import { test, expect } from '@playwright/test';

/* Preuve NAVIGATEUR que les CTA d'achat qui n'etaient PAS mesures le
   27/10/2026 (demo-offer, buy-hero-primary, formula-ours-buy) emettent
   desormais un evenement `checkout_requested`.

   analytics.js envoie via `navigator.sendBeacon` un corps de type Blob :
   Playwright n'en expose pas le postData. On remplace donc sendBeacon
   AVANT le chargement des scripts de la page et on capture le JSON
   reellement emis par le code de production. Rien n'est invente.

   Le serveur local etant statique, les requetes vers /api/track echouent
   (404) : c'est sans importance ici, on mesure ce qui est EMIS. */

const CASES = [
  { label: 'demo (point d entree acquisition)', path: '/demo.html', cta: 'demo-offer' },
  { label: 'buy (EN)', path: '/buy.html', cta: 'buy-hero-primary' },
  { label: 'compare (comparaison)', path: '/compare.html', cta: 'formula-ours-buy' },
];

const NON_BUY = [{ path: '/', cta: 'hero-demo' }];

/* Capture le JSON emis vers /api/track, quel que soit le transport. */
async function installCapture(page) {
  await page.addInitScript(() => {
    /* Persistance en sessionStorage : un clic peut declencher une
       navigation (hero-demo -> demo.html), et les evenements emis juste
       avant doivent rester lisibles apres. Aucun impact sur la mesure
       reelle : c'est un harnais de test. */
    let store = [];
    try { store = JSON.parse(sessionStorage.getItem('__tracked') || '[]'); } catch { /* vide */ }
    window.__tracked = store;
    const save = () => {
      try { sessionStorage.setItem('__tracked', JSON.stringify(window.__tracked)); } catch { /* indisponible */ }
    };
    const push = (url, textPromise) => {
      textPromise.then((t) => {
        window.__tracked.push({ url: String(url), text: t });
        save();
      }).catch(() => {});
    };
    const origBeacon = navigator.sendBeacon && navigator.sendBeacon.bind(navigator);
    navigator.sendBeacon = function (url, data) {
      if (String(url).includes('/api/track')) {
        const t = (data && typeof data.text === 'function')
          ? data.text() : Promise.resolve(String(data));
        push(url, t);
      }
      return origBeacon ? origBeacon(url, data) : true;
    };
    const origFetch = window.fetch && window.fetch.bind(window);
    window.fetch = function (input, init) {
      if (String(input).includes('/api/track') && init && init.body) {
        push(input, Promise.resolve(String(init.body)));
      }
      return origFetch ? origFetch(input, init) : Promise.resolve();
    };
  });
}

async function readTracked(page) {
  return page.evaluate(async () => {
    let list = [];
    try { list = JSON.parse(sessionStorage.getItem('__tracked') || '[]'); } catch { /* vide */ }
    const out = [];
    for (const t of list) {
      try { out.push(JSON.parse(t.text)); } catch { /* ignore */ }
    }
    return out;
  });
}

/* Certains CTA mènent à une autre page (hero-demo -> demo.html). La
   navigation détruit la page avant que le Blob du beacon ne soit lu
   (asynchrone). On neutralise donc la DESTINATION dans le harnais :
   analytics.js ne lit jamais le href pour émettre ses événements, la
   mesure produite est donc identique. */
async function freezeNavigation(page, cta) {
  await page.evaluate((id) => {
    const a = document.querySelector(`a[data-cta-id="${id}"]`);
    if (a) {
      a.setAttribute('href', '#noop');
      a.addEventListener('click', (e) => e.preventDefault(), { once: true });
    }
  }, cta);
}

for (const c of CASES) {
  test(`clic sur le CTA d'achat "${c.cta}" emet checkout_requested (${c.label})`, async ({ page }) => {
    await installCapture(page);
    await page.goto('http://127.0.0.1:8099' + c.path, { waitUntil: 'domcontentloaded' });

    const btn = page.locator(`a[data-cta-id="${c.cta}"]`).first();
    expect(await btn.count(), `CTA ${c.cta} present sur ${c.path}`).toBeGreaterThan(0);
    await expect(btn).toBeVisible();
    await freezeNavigation(page, c.cta);

    await btn.click();
    await page.waitForTimeout(600);

    const events = await readTracked(page);
    const emitted = events.map((e) => e.event);
    const requested = events.filter((e) => e.event === 'checkout_requested');
    expect(requested.length,
      `aucun checkout_requested emis par ${c.cta}; emis: ${JSON.stringify(emitted)}`,
    ).toBeGreaterThan(0);
    expect(requested.some((e) => e.props && e.props.step === c.cta),
      `le pas emis n'est pas ${c.cta} (recu: ${JSON.stringify(requested.map((e) => e.props && e.props.step))})`,
    ).toBe(true);
  });
}

/* 2. Un CTA de demo ne doit PAS etre compte comme intention d'achat,
      mais son clic reste mesure (on ne perd pas la donnee). */
for (const nb of NON_BUY) {
  test(`clic sur le CTA de demo "${nb.cta}" N'emet PAS checkout_requested`, async ({ page }) => {
    await installCapture(page);
    await page.goto('http://127.0.0.1:8099' + nb.path, { waitUntil: 'domcontentloaded' });

    const btn = page.locator(`a[data-cta-id="${nb.cta}"]`).first();
    expect(await btn.count(), `CTA ${nb.cta} present sur ${nb.path}`).toBeGreaterThan(0);
    await freezeNavigation(page, nb.cta);
    await btn.click();
    await page.waitForTimeout(600);

    const events = await readTracked(page);
    expect(events.some((e) => e.event === 'checkout_requested'),
      `un checkout_requested a ete emis par le CTA de demo ${nb.cta}`).toBe(false);
    expect(events.some((e) => e.event === 'cta_click' && e.props && e.props.cta === nb.cta),
      `le clic ${nb.cta} n'est plus mesure du tout`).toBe(true);
  });
}

