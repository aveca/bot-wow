#!/usr/bin/env node
/**
 * buy-cta-coverage.test.mjs — couverture de la mesure d'intention d'achat.
 *
 * Defaut corrige le 27 octobre 2026 : le CTA de la demo (`demo-offer`)
 * etait absent de la liste des CTA mesures comme `checkout_requested`
 * dans assets/analytics.js. Ses clics n'etaient donc JAMAIS comptes comme
 * une intention d'achat, ce qui rendait invisible la conversion de la
 * demo — le point d'entree naturel d'une campagne d'acquisition.
 *
 * Preuve du defaut (production D1, lecture seule) : les evenements
 * `checkout_requested` ne portaient que les pas `hero-offer`, `final-buy`
 * et `nav-buy`.
 *
 * Regle objective : un lien d'achat est un lien dont le href mene a la
 * section d'achat (#buy). La liste est deduite du HTML des pages reelles,
 * elle n'est jamais inventee. Chaque CTA ainsi trouve doit figurer dans
 * le selecteur `checkout_requested` de analytics.js.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
}

const PAGES = [
  'index.html', 'buy.html', 'compare.html', 'demo.html',
  'fr/index.html', 'fr/buy.html', 'fr/compare.html', 'fr/demo.html',
];

/* 1. Deduire les CTA d'achat reels depuis le HTML servi. */
const found = new Map();
for (const p of PAGES) {
  let html;
  try { html = read(p); } catch { continue; }
  for (const m of html.matchAll(/<a\s([^>]*?)>/g)) {
    const attrs = m[1];
    const href = (attrs.match(/href="([^"]*)"/) || [])[1] || '';
    const cta = (attrs.match(/data-cta-id="([^"]*)"/) || [])[1];
    if (!cta) continue;
    if (/#buy(\?|$|["#])/.test(href)) found.set(cta, p);
  }
}

/* 2. Lire la liste des CTA mesures comme intention d'achat.
      analytics.js contient plusieurs listeners `closest()` : on prend le
      DERNIER qui precede l'emission de `checkout_requested`, c'est-a-dire
      celui du listener qui l'emet. */
const an = read('assets/analytics.js');
const idx = an.indexOf("track('checkout_requested'");
const scope = idx >= 0 ? an.slice(Math.max(0, idx - 6000), idx) : '';
const allListeners = [...scope.matchAll(/ev\.target\.closest\('([^']*)'\)/g)];
const listener = allListeners.length ? allListeners[allListeners.length - 1][1] : '';
const measured = [...listener.matchAll(/data-cta-id="([^"]*)"/g)].map((m) => m[1]);

check('assets/analytics.js declare un selecteur checkout_requested',
  listener.includes('hero-offer'), '(selecteur introuvable)');
check('au moins 8 CTA d\'achat sont mesures',
  measured.length >= 8, `(${measured.length})`);

/* 3. Chaque CTA d'achat reel doit etre mesure. */
check('des CTA d\'achat sont detectes dans les pages',
  found.size >= 5, `(${found.size})`);
for (const [cta, page] of found) {
  check(`CTA d'achat "${cta}" mesure comme intention (${page})`,
    measured.includes(cta), `(absent du selecteur checkout_requested)`);
}

/* 4. Aucun CTA de demonstration/navigation ne doit etre compte comme
      une intention d'achat : cela gonflerait artificiellement le taux. */
const NON_BUY = /^(hero-demo|final-demo|telemetry-demo|telemetry-compare|radar-demo|journey-demo-open|journey-fish-demo|steps-demo|demo-modules|demo-open|compare-cta)$/;
const falsePositives = measured.filter((c) => NON_BUY.test(c));
check('aucun CTA de demo/navigation compte comme intention d\'achat',
  falsePositives.length === 0, `(${falsePositives.join(', ')})`);

console.log(failures === 0
  ? `\nCOUVERTURE DES CTA D'ACHAT : OK (${found.size} CTA reels, ${measured.length} mesures)`
  : `\nCOUVERTURE DES CTA D'ACHAT : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);

