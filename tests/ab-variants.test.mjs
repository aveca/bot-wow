#!/usr/bin/env node
/**
 * ab-variants.test.mjs - garde-fous des 4 variantes A/B de la page de vente.
 * Couvre les 4 defauts de la revue : chemins d'assets, coherence de
 * disponibilite, absence de garantie de resultats, maintien du checkout.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
};

const VARIANTS = [
  { f: 'ab/a/buy.html', depth: 2 },
  { f: 'ab/a/fr/buy.html', depth: 3 },
  { f: 'ab/b/buy.html', depth: 2 },
  { f: 'ab/b/fr/buy.html', depth: 3 },
];
const up = (d) => '../'.repeat(d);
const strip = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[œ]/g, 'oe').toLowerCase();

for (const v of VARIANTS) {
  const html = read(v.f);
  const flat = html.replace(/\s+/g, ' ');
  const tag = v.f;
  const stray = [...html.matchAll(/(?:href|src|srcset)="([^"]+)"/g)].map(m => m[1])
    .filter(u => /^\.{1,2}\/assets\//.test(u));
  check(`${tag} : aucun raccourci d'asset`, stray.length === 0, stray.slice(0, 2).join(' '));
  const good = [...html.matchAll(/(?:href|src|srcset)="([^"]+)"/g)].map(m => m[1])
    .filter(u => /assets\//.test(u));
  check(`${tag} : profondeur correcte (${good.length} assets)`,
    good.every(u => u.startsWith(up(v.depth) + 'assets/')),
    good.filter(u => !u.startsWith(up(v.depth) + 'assets/')).slice(0, 2).join(' '));
  check(`${tag} : feuille site.css chargee`, html.includes(`${up(v.depth)}assets/site.css`));
  check(`${tag} : app.js charge`, html.includes(`${up(v.depth)}assets/app.js`));
  check(`${tag} : capture reelle (.jpg) chargee`, html.includes(`${up(v.depth)}assets/evidence/fishing-real-capture.jpg`));
  check(`${tag} : capture reelle (.webp) chargee`, html.includes(`${up(v.depth)}assets/evidence/fishing-real-capture.webp`));
}

/* --- B. coherence disponibilite ---------------------------------- */
for (const v of VARIANTS) {
  const s = strip(read(v.f));
  check(`${v.f} : pas d'affirmation << tout est livre et fonctionne maintenant >>`,
    !/everything below is delivered and working now|tout ce qui suit est livre et fonctionne maintenant/i.test(s));
  check(`${v.f} : mentionne la non-verification du paquet`,
    /not currently verified|n'est pas verifiee|pas verifiee/i.test(s));
  check(`${v.f} : avis de disponibilite AVANT le formulaire`,
    read(v.f).indexOf('id="release-availability-notice"') < read(v.f).indexOf('id="buyForm"'));
}

/* --- C. aucune garantie de resultats ------------------------------ */
for (const v of VARIANTS) {
  const s = strip(read(v.f));
  // une garantie positive serait « results are guaranteed » ; « ne garantit
  // rien » / « cannot guarantee » sont des negations legitimes.
  check(`${v.f} : aucune promesse de resultats identiques`,
    !/same results|memes resultats/i.test(s) &&
    !/(?:is|are|est|sont)\s+guarantee?d?|we guarantee|nous garantissons/i.test(s));
  check(`${v.f} : langage de rythme (pas de resultat garanti)`,
    /rhythm|rythme|routine|spots/i.test(s));
}

/* --- D. checkout, prix, avis, CTA, risque de ban ------------------ */
for (const v of VARIANTS) {
  const html = read(v.f);
  const flat = html.replace(/\s+/g, ' ');
  check(`${v.f} : vrai formulaire de checkout`,
    /id="buyForm"/.test(html) && /id="email"/.test(html) && /id="buyBtn"/.test(html) && /id="buyErr"/.test(html));
  check(`${v.f} : prix 20,00 EUR inchange`, /20,00\s*€|20\.00/.test(html));
  check(`${v.f} : CTA instrumentes (>=3)`, (html.match(/data-cta-id="buy-/g) || []).length >= 3);
  check(`${v.f} : risque de bannissement mentionne`,
    /terms of service|conditions d.utilisation/i.test(flat));
  check(`${v.f} : mouvement spot-a-spot en validation`,
    /validation|en validation|not yet|pas encore/i.test(flat));
  check(`${v.f} : pas de preuve sociale fabriquee`,
    !/joined by|customers trust|\d+\s*(users|clients|pêcheurs|pechers)|only \d+ left|hurry|stock epuise/i.test(flat));
  check(`${v.f} : aucune promesse de livraison immediate`,
    !/Delivered\s+<b>by email<\/b>\s+in minutes|Livré\s+<b>par e-mail<\/b>\s+en quelques minutes/i.test(flat));
}

console.log(failures === 0 ? '\nAB VARIANTS : OK' : `\nAB VARIANTS : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);


