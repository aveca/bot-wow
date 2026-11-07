#!/usr/bin/env node
/**
 * The legal draft names the real product and price, and leaves every
 * unknown company fact marked A COMPLETER. It must not invent an identity.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pages = [
  'legal/terms.html',
  'legal/privacy.html',
  'legal/refund.html',
  'legal/mentions.html',
  'legal/fr/terms.html',
  'legal/fr/privacy.html',
  'legal/fr/refund.html',
  'legal/fr/mentions.html',
];
let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
}

console.log('=== BROUILLON JURIDIQUE ===');
for (const rel of pages) {
  const html = fs.readFileSync(path.join(root, rel), 'utf8');
  check(rel + ' existe', html.length > 500);
  check(rel + ' marque les trous', html.includes('A COMPLETER'));
  check(rel + ' nomme le produit', html.includes('bot-wow-lifetime'));
  check(rel + ' garde le prix de reference', /20\.00 EUR|20,00 EUR/.test(html));
  check(rel + ' n invente pas un SIRET', !/\b\d{3}\s?\d{3}\s?\d{3}\s?\d{5}\b/.test(html));
  check(rel + ' ne pretend pas que l offre est en vente', !/currently on sale|offre actuellement en vente/i.test(html));
}
const terms = fs.readFileSync(path.join(root, 'legal/terms.html'), 'utf8');
const termsFr = fs.readFileSync(path.join(root, 'legal/fr/terms.html'), 'utf8');
check('les CGV parlent du contenu numerique', /digital content/i.test(terms));
check('les CGV disent que le checkout est ferme', /checkout stays closed/i.test(terms));
check('CGV EN : pas d affiliation Blizzard', /neither affiliated with nor endorsed by Blizzard Entertainment/i.test(terms));
check('CGV EN : risque de sanction de compte', /Account sanctions, including suspension or closure, are possible/i.test(terms));
check('CGV EN : pas de promesse de non-detection', /do not promise that the software will not be detected/i.test(terms));
check('CGV FR : pas d affiliation Blizzard', /ni affilié, ni approuvé par Blizzard Entertainment/i.test(termsFr));
check('CGV FR : risque de sanction de compte', /sanctions de compte, y compris une suspension ou une fermeture, sont possibles/i.test(termsFr));
check('CGV FR : pas de promesse de non-detection', /ne promettent pas que le logiciel ne sera pas détecté/i.test(termsFr));

console.log(failures === 0 ? '\nBROUILLON JURIDIQUE : OK' : `\nBROUILLON JURIDIQUE : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
