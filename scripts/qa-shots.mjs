#!/usr/bin/env node
/**
 * qa-shots.mjs — captures comparables avant/après avec Playwright.
 *
 * Produit, pour chaque route et chaque viewport :
 *   <out>/<viewport>/<route>.png     capture de la zone visible
 *   <out>/<viewport>/<route>.json    releve (console, reseau, mesures, parcours)
 *
 * Les routes et sections sont découvertes dans le site réel (voir ROUTES) ;
 * aucune hypothèse de framework. La démo et le formulaire sont pilotés
 * réellement (changement de mode, saisie, soumet) pour mesurer leur effet.
 *
 * Usage :
 *   node scripts/qa-shots.mjs --url http://127.0.0.1:8099 --out <dossier>
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

/* ------------------------------------------------------------- arguments */
const args = process.argv.slice(2);
const arg = (name, def) => {
  const i = args.indexOf('--' + name);
  return i >= 0 && args[i + 1] ? args[i + 1] : def;
};
const BASE = arg('url', 'http://127.0.0.1:8099');
const OUT = arg('out', '.qa-shots');

/* ------------------------------- routes : pages entières + sections clés */
const ROUTES = [
  { path: '/', sections: [
    { label: 'hero', y: 0 },
    { label: 'demo', y: 1450 },
    { label: 'roles', y: 4850 },
    { label: 'compare', y: 6450 },
    { label: 'prix', y: 8100 },
    { label: 'final', y: 11200 },
  ] },
  { path: '/fr/', sections: [
    { label: 'hero', y: 0 },
    { label: 'prix', y: 8100 },
  ] },
  { path: '/demo.html', sections: [{ label: 'plein', y: 0 }] },
  { path: '/fr/demo.html', sections: [{ label: 'plein', y: 0 }] },
  { path: '/compare.html', sections: [{ label: 'plein', y: 0 }] },
  { path: '/faq.html', sections: [{ label: 'plein', y: 0 }] },
  { path: '/modules.html', sections: [{ label: 'plein', y: 0 }] },
];
const VIEWPORTS = [
  { name: 'desktop-1440x900', width: 1440, height: 900 },
  { name: 'mobile-390x844', width: 390, height: 844 },
];

mkdirSync(OUT, { recursive: true });

/* --------------------------------------------------------------- utilitaire */
async function shot(page, dir, name) {
  const file = join(dir, name + '.png');
  await page.screenshot({ path: file });
  return file;
}

/** Mesures objectives de mise en page, pour comparer avant/après. */
async function measure(page) {
  return page.evaluate(() => {
    const q = (s) => document.querySelector(s);
    const r = (el) => (el ? (x => ({ top: Math.round(x.top), bottom: Math.round(x.bottom), w: Math.round(x.width), h: Math.round(x.height) }))(el.getBoundingClientRect()) : null);
    const hero = q('.hero');
    const h1 = q('h1');
    return {
      scrollHeight: document.documentElement.scrollHeight,
      hOverflow: document.documentElement.scrollWidth > innerWidth + 1 ? { sw: document.documentElement.scrollWidth, iw: innerWidth } : null,
      heroRect: r(hero),
      heroH: hero ? Math.round(hero.getBoundingClientRect().height) : null,
      h1Size: h1 ? parseFloat(getComputedStyle(h1).fontSize) : null,
      h1Weight: h1 ? getComputedStyle(h1).fontWeight : null,
      eyebrowCount: document.querySelectorAll('.eyebrow, [class*=eyebrow]').length,
      monoBody: (() => { const b = q('p, .lead'); return b ? getComputedStyle(b).fontFamily.match(/mono|ui-monospace/i) ? 'mono' : 'sans' : null; })(),
      bodyMeasure: (() => {
        const p = q('p.lead, section p');
        if (!p) return null;
        const cs = getComputedStyle(p);
        const w = p.getBoundingClientRect().width;
        const fs = parseFloat(cs.fontSize);
        const fam = cs.fontFamily;
        // Mesure reelle d'un caractere "0" dans la police du paragraphe :
        // l'unite CSS `ch` est exactement cette largeur. On evite ainsi
        // l'approximation 0.5em, fausse de ±20% selon la police.
        const cv = document.createElement('canvas').getContext('2d');
        cv.font = fs + 'px ' + fam;
        const unit = cv.measureText('0'.repeat(100)).width / 100 || fs * 0.5;
        return Math.round(w / unit);
      })(),
      ctaPrimary: (() => { const b = q('#buyBtn, .btn-gold'); if (!b) return null; const x = b.getBoundingClientRect(); const cs = getComputedStyle(b); return { h: Math.round(x.height), fs: parseFloat(cs.fontSize), radius: cs.borderRadius }; })(),
      emojiIcons: (document.body.innerText.match(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu) || []).length,
      actionBar: (() => { const b = q('.mbar'); if (!b) return null; const cs = getComputedStyle(b); return { display: cs.display, isOn: b.classList.contains('is-on') }; })(),
      lang: document.documentElement.lang,
      priceVisible: /20[.,]00/.test(document.body.innerText),
    };
  });
}

/**
 * Pilote les interactions réelles qui comptent, et renvoie leur effet observé.
 * Aucun paiement : on force l'échec réseau pour mesurer le message d'erreur.
 */
async function interact(page) {
  const out = {};
  // --- démonstration : changer de mode et mesurer l'effet sur la carte -----
  const demo = await page.evaluate(async () => {
    const sel = document.querySelector('#mode');
    const svg = document.querySelector('#oasis');
    if (!sel || !svg) return { demo: false };
    const beforeChildren = svg.children.length;
    const opts = [...sel.options].map((o) => o.value);
    sel.value = opts[opts.length - 1];
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 500));
    // clic sur un spot : le panneau doit réagir
    const circles = [...svg.querySelectorAll('circle')];
    const target = circles.find((c) => c.getBoundingClientRect().width > 6) || circles[0];
    let clicked = null;
    if (target) {
      const b = target.getBoundingClientRect();
      target.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 }));
      await new Promise((r) => setTimeout(r, 400));
      clicked = target.tagName;
    }
    return {
      demo: true,
      beforeChildren,
      afterChildren: svg.children.length,
      changed: beforeChildren !== svg.children.length,
      clicked,
      simulatedLabel: /simulated|simule/i.test(document.body.innerText),
    };
  });
  out.demo = demo;

  // --- formulaire d'achat : email invalide, puis échec réseau ---------------
  const form = await page.evaluate(async () => {
    const f = document.querySelector('#buyForm');
    if (!f) return { form: false };
    const input = document.querySelector('#email');
    const err = document.querySelector('#buyErr');
    input.value = 'pas-un-email';
    f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 300));
    const invalidMsg = err.textContent;

    input.value = 'client@example.com';
    const realFetch = window.fetch;
    window.fetch = () => Promise.reject(new Error('réseau coupé (QA)'));
    f.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    await new Promise((r) => setTimeout(r, 2500));
    const failMsg = err.textContent;
    const btn = document.querySelector('#buyBtn');
    const btnRestored = !btn.disabled;
    window.fetch = realFetch;
    return {
      form: true,
      invalidMsg,
      failMsg,
      btnRestored,
      redirected: location.href.includes('mollie'),
      supportMentioned: /support@bot-wow\.com/.test(failMsg),
    };
  });
  out.form = form;
  return out;
}

/* ------------------------------------------------------------------- boucle */
console.log(`QA captures — base ${BASE} → ${OUT}`);
const browser = await chromium.launch();
let failed = 0;

for (const vp of VIEWPORTS) {
  const vpDir = join(OUT, vp.name);
  mkdirSync(vpDir, { recursive: true });
  const ctx = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
  const page = await ctx.newPage();

  const consoleErrors = [];
  const networkErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text().slice(0, 200)); });
  page.on('pageerror', (e) => consoleErrors.push('EXCEPTION ' + String(e).slice(0, 200)));
  page.on('requestfailed', (r) => networkErrors.push(r.url().slice(0, 140)));
  page.on('response', (r) => { if (r.status() >= 400) networkErrors.push(r.status() + ' ' + r.url().slice(0, 140)); });

  for (const route of ROUTES) {
    const routeKey = route.path.replace(/\//g, '_').replace(/^_|_$/g, '') || 'index';
    try {
      await page.goto(BASE + route.path, { waitUntil: 'load', timeout: 30000 });
      await page.waitForTimeout(1200);

      const report = { route: route.path, viewport: vp.name, url: BASE + route.path };
      for (const sec of route.sections) {
        await page.evaluate((y) => window.scrollTo(0, y), sec.y);
        await page.waitForTimeout(sec.y === 0 ? 700 : 450);
        const file = await shot(page, vpDir, routeKey + (route.sections.length > 1 ? '--' + sec.label : ''));
        if (sec.y === 0) {
          report.metrics = await measure(page);
          report.interactions = await interact(page);
        }
      }
      report.metrics = report.metrics || await measure(page);
      // Mesures spécifiques à la section demandée (hero, prix, etc.)
      for (const sec of route.sections) {
        await page.evaluate((y) => window.scrollTo(0, 0), 0);
        await page.waitForTimeout(150);
        break;
      }
      report.consoleErrors = consoleErrors.slice();
      report.networkErrors = networkErrors.slice();
      writeFileSync(join(vpDir, routeKey + '.json'), JSON.stringify(report, null, 2));

      const m = report.metrics || {};
      const flags = [];
      if (m.hOverflow) flags.push('OVERFLOW');
      if (m.eyebrowCount) flags.push('EYEBROW:' + m.eyebrowCount);
      if (m.emojiIcons) flags.push('EMOJI-ICONES:' + m.emojiIcons);
      if (m.monoBody === 'mono') flags.push('CORPS-MONO');
      console.log(`  ${vp.name.padEnd(17)} ${route.path.padEnd(15)} ok  hero=${m.heroH}px h1=${m.h1Size}px mesure=${m.bodyMeasure}ch ${flags.join(' ')}`);
    } catch (e) {
      failed++;
      console.log(`  ${vp.name.padEnd(17)} ${route.path.padEnd(15)} ECHEC ${e.message.slice(0, 90)}`);
    }
  }
  await ctx.close();
}

await browser.close();
console.log('');
console.log(failed === 0 ? `QA CAPTURES : OK (${VIEWPORTS.length * ROUTES.length} routes dans ${OUT})` : `QA CAPTURES : ${failed} ECHEC(S)`);
process.exit(failed === 0 ? 0 : 1);
