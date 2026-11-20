#!/usr/bin/env node
/**
 * funnel-abandonment.test.mjs — détection d'abandon d'entonnoir.
 *
 * Vérifie que :
 *   1. checkout_abandoned est documenté dans analytics.js ;
 *   2. le code de détection d'abandon est présent (pagehide après
 *      checkout_requested / checkout_start) ;
 *   3. aucune donnée personnelle n'est transportée ;
 *   4. en simulation : checkout_requested puis pagehide émettent
 *      checkout_abandoned.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runInNewContext } from 'node:vm';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
}

console.log("=== ENTONNOIR : DETECTION D'ABANDON ===");

const an = read('assets/analytics.js');

// 1. Documentation : checkout_abandoned présent dans le schéma
check(
  'checkout_abandoned documenté dans analytics.js',
  /checkout_abandoned/.test(an)
);

// 2. Variables de suivi du dernier événement
check(
  'variable LAST_EVENT déclarée',
  /var LAST_EVENT\s*=\s*null/.test(an)
);
check(
  'variable LAST_STEP déclarée',
  /var LAST_STEP\s*=\s*''/.test(an)
);

// 3. track() met à jour LAST_EVENT / LAST_STEP
check(
  'track met à jour LAST_EVENT',
  /LAST_EVENT\s*=\s*event/.test(an)
);
check(
  'track met à jour LAST_STEP',
  /LAST_STEP\s*=\s*\(props\s*&&\s*props\.step\)/.test(an)
);

// 4. pagehide détecte l'abandon avant le flush
check(
  'pagehide vérifie checkout_requested/checkout_start',
  /LAST_EVENT\s*===\s*'checkout_requested'\s*\|\|\s*LAST_EVENT\s*===\s*'checkout_start'/.test(an)
);
check(
  'pagehide émet checkout_abandoned',
  /track\('checkout_abandoned'/.test(an)
);
check(
  'pagehide appelle ensuite botwowTrackFlush',
  /window\.botwowTrackFlush\(\)/.test(an)
);

// 5. Pas de donnée personnelle dans l'abandon
const pii = [...an.matchAll(/checkout_abandoned[\s\S]{0,200}?\}/g)]
  .some((m) => /@|email|user|name|order/.test(m[0]));
check(
  'checkout_abandoned sans donnée personnelle',
  !pii
);

// 6. Simulation : checkout_requested puis pagehide -> checkout_abandoné
{
  const sent = [];
  const store = new Map();
  const sessionStorage = {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, value); }
  };
  const listeners = { click: [], pagehide: [] };
  const window = {
    BOTWOW_TRACK_ENDPOINT: '/api/track',
    doNotTrack: '0',
    addEventListener(type, handler) {
      if (type === 'pagehide') listeners.pagehide.push(handler);
      else if (type === 'click') listeners.click.push(handler);
    }
  };
  const document = {
    documentElement: { lang: 'en' },
    readyState: 'complete',
    referrer: '',
    addEventListener() {},
    querySelector() { return null; }
  };
  const navigator = {
    doNotTrack: '0',
    sendBeacon(_url, blob) { sent.push(blob.text()); return true; }
  };
  // Blob minimal : .text() retourne le corps de la requete de maniere
  // synchrone pour le test (sendBeacon recoit un objet Blob).
  function FakeBlob(parts) { this.parts = parts; }
  FakeBlob.prototype.text = function () { return this.parts.join(''); };

  const location = { search: '', pathname: '/buy.html', hostname: 'bot-wow.com' };
  runInNewContext(an, {
    window, document, navigator, location, sessionStorage,
    Blob: FakeBlob, Date, Math, JSON, Object, String, Number, RegExp, console
  });

  // Simule un clic sur un CTA d'achat : appelle directement l'API exposee
  window.botwowTrack('checkout_requested', { step: 'planner-buy' });

  // Simule la sortie de page (pagehide) : l'utilisateur quitte sans retour
  for (const handler of listeners.pagehide) handler({});

  const bodies = await Promise.all(sent);
  const events = bodies.map(b => JSON.parse(b).event);
  check(
    'simulation : checkout_requested émis',
    events.includes('checkout_requested'),
    `(${events.join(', ')})`
  );
  check(
    'simulation : checkout_abandoné émis après pagehide',
    events.includes('checkout_abandoned'),
    `(${events.join(', ')})`
  );
  // L'abandon doit venir après la demande de checkout
  const idxRequested = events.indexOf('checkout_requested');
  const idxAbandoned = events.indexOf('checkout_abandoned');
  check(
    'simulation : abandon après la demande (pas avant)',
    idxRequested >= 0 && idxAbandoned > idxRequested,
    `(requested@${idxRequested}, abandoned@${idxAbandoned})`
  );
}

console.log(failures === 0 ? '\nENTONNOIR ABANDON : OK' : `\nENTONNOIR ABANDON : ${failures} ÉCHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
