#!/usr/bin/env node
/**
 * tests/funnel-dedup.test.mjs — les evenements de parcours sont
 * DEDUPLIQUES.
 *
 * PROBLEME MESURE (2026-11-04) :
 *   La table D1 `events` n'a AUCUNE contrainte d'unicite (`id INTEGER
 *   PRIMARY KEY AUTOINCREMENT` + index non uniques). Cote navigateur,
 *   assets/analytics.js emettait un evenement a chaque clic, a chaque
 *   chargement de page et a chaque rejeu de tampon : un double-clic, un
 *   double `pagehide`, un retry de beacon gonflerait le tunnel. Le taux
 *   "intent -> checkout" etait donc inexploitable.
 *
 * CORRECTION VERIFIEE ICI (comportement reel, analytics.js execute dans un
 * sandbox DOM minimal) :
 *   - un meme evenement, meme page, meme identifiant : UNE seule emission ;
 *   - deux CTA differents : deux emissions ;
 *   - deux pages differentes : deux emissions (sinon `page_view` ne
 *     compterait qu'une fois par session et le trafic multi-pages
 *     disparaitrait) ;
 *   - `?telemetry_dedup=0` desactive la deduplication (echappatoire QA).
 *
 * Aucun appel reseau : `navigator.sendBeacon` est simule.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
}

const analyticsSrc = readFileSync(join(REPO, 'assets', 'analytics.js'), 'utf8');

/**
 * Execute analytics.js dans un contexte DOM minimal et renvoie un
 * controleur : `sent` contient les payloads emis, `track` l'API publique.
 */
function boot(pathname = '/buy.html', search = '') {
  const sent = [];
  const sandbox = {
    console,
    navigator: {
      doNotTrack: null,
      // sendBeacon(url, body) : le corps est le DEUXIEME argument.
      sendBeacon: (url, blob) => { sent.push(JSON.parse(blob.parts[0])); return true; },
    },
    location: { pathname, search, hostname: 'bot-wow.com', href: 'https://bot-wow.com' + pathname },
    document: {
      readyState: 'complete',
      documentElement: { lang: 'en' },
      referrer: '',
      addEventListener: () => {},
      querySelector: () => null,
    },
    sessionStorage: {
      _v: {},
      getItem(k) { return this._v[k] ?? null; },
      setItem(k, v) { this._v[k] = String(v); },
    },
    Blob: class { constructor(parts) { this.parts = parts; } },
    Date,
    Math,
    JSON,
    Object,
    String,
    Number,
    RegExp,
    URLSearchParams,
  };
  sandbox.window = sandbox;
  sandbox.window.addEventListener = () => {};
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(analyticsSrc, sandbox);
  return { sent, sandbox };
}

function countEvents(sent, name) {
  return sent.filter((p) => p.event === name).length;
}

console.log('=== DEDUPLICATION DES EVENEMENTS DE PARCOURS ===');

/* ----- 1. un meme evenement n'est emis qu'une fois ----- */
{
  const { sent, sandbox } = boot();
  sent.length = 0; // on ignore le page_view de chargement
  sandbox.botwowTrack('cta_click', { cta: 'nav-buy', step: 'buy' });
  sandbox.botwowTrack('cta_click', { cta: 'nav-buy', step: 'buy' });
  sandbox.botwowTrack('cta_click', { cta: 'nav-buy', step: 'buy' });
  check('un clic repete sur le meme CTA n\'est emis qu\'une fois', countEvents(sent, 'cta_click') === 1, `(emis=${countEvents(sent, 'cta_click')})`);
}

/* ----- 2. deux CTA differents comptent deux fois ----- */
{
  const { sent, sandbox } = boot();
  sent.length = 0;
  sandbox.botwowTrack('checkout_requested', { step: 'nav-buy' });
  sandbox.botwowTrack('checkout_requested', { step: 'mbar-buy' });
  check('deux CTA differents sont comptes separement', countEvents(sent, 'checkout_requested') === 2, `(emis=${countEvents(sent, 'checkout_requested')})`);
}

/* ----- 3. la page fait partie de la cle ----- */
{
  // Le `page_view` de chargement est deja emis au demarrage : on ne le
  // compte pas comme un rejet, il est le premier des deux.
  const { sent, sandbox } = boot('/buy.html');
  check('le page_view de chargement est emis', countEvents(sent, 'page_view') === 1, `(emis=${countEvents(sent, 'page_view')})`);
  sandbox.botwowTrack('page_view', { step: 'load' }); // meme page : dedupe
  sandbox.location.pathname = '/index.html';
  sandbox.botwowTrack('page_view', { step: 'load' }); // page differente : compte
  check('deux pages differentes sont comptees separement', countEvents(sent, 'page_view') === 2, `(emis=${countEvents(sent, 'page_view')})`);
}

/* ----- 4. meme page rechargee : une seule emission ----- */
{
  const { sent, sandbox } = boot('/buy.html');
  sandbox.botwowTrack('page_view', { step: 'load' });
  sandbox.botwowTrack('page_view', { step: 'load' });
  check('un rechargement de la meme page n\'est compte qu\'une fois', countEvents(sent, 'page_view') === 1, `(emis=${countEvents(sent, 'page_view')})`);
}

/* ----- 5. l'echappatoire QA existe ----- */
{
  const { sent, sandbox } = boot('/buy.html', '?telemetry_dedup=0');
  sent.length = 0;
  sandbox.botwowTrack('cta_click', { cta: 'nav-buy', step: 'buy' });
  sandbox.botwowTrack('cta_click', { cta: 'nav-buy', step: 'buy' });
  check('?telemetry_dedup=0 desactive la deduplication', countEvents(sent, 'cta_click') === 2, `(emis=${countEvents(sent, 'cta_click')})`);
}

/* ----- 6. la deduplication ne touche pas le schema envoye ----- */
{
  const { sent, sandbox } = boot();
  sent.length = 0;
  sandbox.botwowTrack('cta_click', { cta: 'nav-buy', step: 'buy' });
  const p = sent[0];
  check('le payload conserve son schema (v, event, page, lang, props)', !!(p && p.v === 1 && p.event === 'cta_click' && p.page && p.lang && p.props));
  check('le payload conserve le journey_id', !!(p && p.props && p.props.journey_id));
}

/* ----- 7. le schema des evenements cote serveur reste fermee ----- */
{
  const telemetryWorker = readFileSync(join(REPO, 'telemetry-worker', 'index.js'), 'utf8');
  check('le point de collecte refuse encore un evenement inconnu', /if \(!spec\) return null;/.test(telemetryWorker));
}

console.log('');
console.log(failures === 0 ? 'DEDUPLICATION : OK' : `DEDUPLICATION : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
