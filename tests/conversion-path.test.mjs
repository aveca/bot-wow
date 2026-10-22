#!/usr/bin/env node
/**
 * conversion-path.test.mjs — invariants du parcours de conversion.
 *
 * Ce que le parcours doit garantir (verifie sur le code, pas suppose) :
 *  1. chaque point de decision porte un evenement named ;
 *  2. le radar interactif a une sortie vers la demonstration ;
 *  3. les sections de preuve (telemetry, etapes) et la fin de page
 *     proposent une action ;
 *  4. le formulaire d'achat est present, avec email + validation ;
 *  5. la liste d'attente reste proposee en repli ;
 *  6. l'instrumentation ne transporte AUCUNE donnee personnelle ;
 *  7. les evenements documentes sont bien ceux emis.
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

console.log('=== PARCOURS DE CONVERSION (invariants) ===');

for (const file of ['index.html', 'fr/index.html', 'compare.html', 'fr/compare.html']) {
  const t = read(file);
  const label = file;

  // 1. Instrumentation presente sur les CTA cles
  const tracked = [...t.matchAll(/data-track="([a-z_]+)"[^>]*data-cta-id="([a-z0-9-]+)"/g)];
  check(`${label} : CTA instrumentes (>= 4)`, tracked.length >= 4, `(trouve ${tracked.length})`);
  for (const [, ev, id] of tracked) {
    check(`${label} : evenement "${ev}" sur cta "${id}"`, ev === 'cta_click');
  }

  // 2. Aucun identifiant ni email dans les attributs de suivi
  const pii = [...t.matchAll(/data-(?:track|cta-id)="([^"]*)"/g)].filter(([, v]) => /@|mailto|user|email|name/i.test(v));
  check(`${label} : aucune donnee personnelle dans le suivi`, pii.length === 0, `(trouve ${pii.map((m) => m[1]).join(', ')})`);

  // 3. Cibles des CTA : uniquement des pages du site
  const badHref = [...t.matchAll(/<a[^>]+class="[^"]*btn[^"]*"[^>]+href="([^"]+)"/g)]
    .map(([, h]) => h)
    .filter((h) => /^[a-z]+:\/\//i.test(h) && !/^(mailto:|https:\/\/bot-wow\.com)/.test(h));
  check(`${label} : aucun CTA vers un domaine tiers`, badHref.length === 0, `(trouve ${badHref.join(', ')})`);
}

// 4. Parcours hero -> demonstration -> comparaison -> achat (accueil EN)
{
  const t = read('index.html');
  check('accueil : CTA hero vers la demonstration', /href="\.\/demo\.html"[^>]*data-cta-id="hero-demo"/.test(t));
  check('accueil : CTA hero vers l\'offre', /href="#buy"[^>]*data-cta-id="hero-offer"/.test(t));
  check('accueil : sortie du radar vers la demonstration', /class="radar-next-link" href="\.\/demo\.html"/.test(t));
  check('accueil : CTA apres la telemetry', /data-cta-id="telemetry-demo"/.test(t));
  check('accueil : CTA apres les etapes', /data-cta-id="steps-demo"/.test(t));
  check('accueil : CTA final en fin de page', /id="final"[\s\S]{0,900}data-cta-id="final-buy"/.test(t));
  check('accueil : formulaire d\'achat present', /<form id="buyForm"/.test(t));
  check('accueil : champ email du formulaire', /id="email"[^>]*type="email"/.test(t));
  check('accueil : bouton de paiement present', /id="buyBtn"/.test(t));
  check('accueil : liste d\'attente proposee en repli', /data-waitlist/.test(t));
}

// 5. Comparaison : la formule BOT-WOW mene au checkout, le calculateur est instrumente
{
  const t = read('compare.html');
  check('compare : CTA de la formule BOT-WOW', /data-cta-id="formula-ours-buy"/.test(t));
  check('compare : CTA de paiement final', /data-cta-id="compare-buy"/.test(t));
  check('compare : calculateur de cout present', /id="ownership"/.test(t));
  check('compare : source et date des prix citees', /pixelwowbot\.com/.test(t) && /2026-10-22/.test(t));
  check('compare : aucun prix de concurrent invente (30 / 90 jours absent)', !/30 \/ 90/.test(t));
}

// 6. Instrumentation : module present, charge, et evenements documentes
{
  const app = read('assets/app.js');
  check('app.js charge le module d\'instrumentation', /import '\.\/analytics\.js/.test(app));
  const an = read('assets/analytics.js');
  // Les evenements declenches par une interaction (mode, horizon, checkout)
  // sont emis par le module ; cta_click vient des attributs data-track.
  for (const ev of ['planner_mode', 'ownership_view', 'checkout_start']) {
    check(`evenement "${ev}" emis par le module`, an.includes(`'${ev}'`));
  }
  const htmlAll = ['index.html', 'compare.html', 'fr/index.html', 'fr/compare.html'].map(read).join('\n');
  check('evenement "cta_click" present sur les CTA', htmlAll.includes('data-track="cta_click"'));
  check('instrumentation : aucune donnee personnelle collectee',
    !/send\([^)]*email/i.test(an) && !/props\.email/.test(an));
  check('instrumentation : silence par defaut (aucun point de collecte en dur)', !/https?:\/\/[a-z0-9.-]+\/api\//i.test(an));
  check('instrumentation : point de collecte configurable', /botwow-track-endpoint|BOTWOW_TRACK_ENDPOINT/.test(an));
  check('instrumentation : evenements consultables en memoire', /__botwowEvents/.test(an));
}

// 7. Le prix reste unique et verifie
{
  const t = read('index.html');
  const prices = [...new Set([...t.matchAll(/(\d+[.,]\d\d\s?€|€\s?\d+[.,]\d\d)/g)].map((m) => m[0].replace(/\s/g, ' ')))];
  check('accueil : un seul prix annonce', prices.length <= 2, `(prix : ${prices.join(', ')})`);
  check('accueil : prix de 20 EUR present', /20,00\s?€/.test(t));
}

console.log(failures === 0 ? '\nPARCOURS DE CONVERSION : OK' : `\nPARCOURS DE CONVERSION : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
