#!/usr/bin/env node
/**
 * funnel-events.test.mjs — le client emet-il les evenements de mesure exiges
 * par le schema de l'entonnoir (landing/demo/compatibilite) ?
 *
 * Execute le VRAI assets/analytics.js dans un bac a sable Node (vm), sans
 * reseau, et verifie :
 *   - /compatibility.html (EN + FR) -> evenement `compatibility_view` ;
 *   - /demo.html          (EN + FR) -> evenement `demo_open` ;
 *   - un clic sur un mode du planificateur -> `demo_interaction` (+ planner_mode).
 *
 * Aucun appel reseau : navigator.sendBeacon est simule et capture.
 * Ces evenements ne sont PAS des conversions : seule la confirmation de
 * paiement cote Worker en etablit une.
 */
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';

const client = await readFile(new URL('../assets/analytics.js', import.meta.url), 'utf8');
let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures++; console.log(`  FAIL ${name} ${detail}`); }
}

/* Charge analytics.js pour un chemin donne et renvoie { sent, clickHandlers }
   pour pouvoir simuler une interaction. */
function load({ pathname, lang = 'en', search = '' }) {
  const sent = [];               // promesses de JSON.parse des payloads envoyes
  const rawSent = [];
  const clickHandlers = [];
  const store = new Map();
  const sessionStorage = {
    getItem(key) { return store.has(key) ? store.get(key) : null; },
    setItem(key, value) { store.set(key, value); },
  };
  const window = {
    BOTWOW_TRACK_ENDPOINT: '/api/track',
    doNotTrack: '0',
    addEventListener() {},      // pagehide : sans effet ici
  };
  const document = {
    documentElement: { lang },
    readyState: 'complete',
    referrer: '',
    addEventListener(type, fn) { if (type === 'click') clickHandlers.push(fn); },
    querySelector() { return null; },
  };
  const navigator = {
    doNotTrack: '0',
    sendBeacon(_url, blob) { rawSent.push(blob); sent.push(blob.text()); return true; },
  };
  const location = { pathname, hostname: 'bot-wow.com', search };
  runInNewContext(client, {
    window, document, navigator, location, sessionStorage,
    Blob, Date, Math, JSON, Object, String, Number, RegExp, console,
  });
  return { sent, rawSent, clickHandlers };
}

const eventsSent = (run) => Promise.all(run.sent).then((list) => list.map((t) => JSON.parse(t).event));

console.log('=== ENTONNOIR : evenements de mesure emis par le client ===');

/* 1. Affichage de la matrice de compatibilite (EN + FR). */
for (const [lang, path] of [['en', '/compatibility.html'], ['fr', '/fr/compatibility.html']]) {
  const run = load({ pathname: path, lang });
  const events = await eventsSent(run);
  check(`compatibility page (${lang}) emet compatibility_view`, events.includes('compatibility_view'),
    `(emis: ${events.join(', ')})`);
}

/* 2. Affichage de la demo (EN + FR) et PAS de compatibility_view sur la home. */
for (const [lang, path] of [['en', '/demo.html'], ['fr', '/fr/demo.html']]) {
  const run = load({ pathname: path, lang });
  const events = await eventsSent(run);
  check(`demo page (${lang}) emet demo_open`, events.includes('demo_open'),
    `(emis: ${events.join(', ')})`);
}
{
  const run = load({ pathname: '/', lang: 'en' });
  const events = await eventsSent(run);
  check(`la home n'emet ni demo_open ni compatibility_view`,
    !events.includes('demo_open') && !events.includes('compatibility_view'),
    `(emis: ${events.join(', ')})`);
  check(`la home emis page_view`, events.includes('page_view'), `(emis: ${events.join(', ')})`);
}

/* 3. Clic sur un mode du planificateur -> demo_interaction (+ planner_mode). */
{
  const run = load({ pathname: '/demo.html', lang: 'en' });
  const modeBtn = { getAttribute: (n) => (n === 'data-mode' ? 'equilibre' : null) };
  const fakeEvent = {
    target: {
      closest(sel) {
        if (sel === '#plannerModes button[data-mode]') return modeBtn;
        return null; // pas un [data-track], pas un .own-switch, pas un buy CTA
      },
    },
  };
  // Dispatcher a chaque ecouteur 'click' enregistre (comme le ferait le DOM).
  for (const handler of run.clickHandlers) handler(fakeEvent);
  const events = await eventsSent(run);
  check(`un clic planificateur emet demo_interaction`, events.includes('demo_interaction'),
    `(emis: ${events.join(', ')})`);
  check(`un clic planificateur emet aussi planner_mode (detail conserve)`,
    events.includes('planner_mode'), `(emis: ${events.join(', ')})`);
  const payloads = await Promise.all(run.sent).then((l) => l.map((t) => JSON.parse(t)));
  const di = payloads.find((p) => p.event === 'demo_interaction');
  check(`demo_interaction porte le mode choisi en cta`, !!di && di.props && di.props.cta === 'equilibre',
    `(${di ? JSON.stringify(di.props) : 'absent'})`);
}

console.log(failures === 0 ? '\nENTONNOIR : OK' : `\nENTONNOIR : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
