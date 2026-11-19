/* Garde-fou : la page de positionnement manuel reste sans paiement.
 * Anti-récurrence : toute introduction d'un moyen de paiement, d'un prix,
 * d'un formulaire de paiement ou d'un CTA de checkout sur cette page échoue.
 * Les mots « aucun paiement / aucun prix / aucun checkout » dans la bannière
 * sont autorisés : seuls les mécanismes réels sont interdits.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FILES } from '../scripts/build-site.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const page = fs.readFileSync(path.join(ROOT, 'positionnement.html'), 'utf8');

assert.ok(FILES.includes('positionnement.html'), 'la page doit être dans la liste blanche du build');

for (const lang of ['var FR=', 'var EN=', 'var ES=']) {
  assert.ok(page.includes(lang), `dictionnaire manquant : ${lang}`);
}

const forbidden = [
  /buy\.stripe\.com/i,
  /\/api\/checkout/i,
  /mollie/i,
  /paypal/i,
  /priceEur/i,
  /bot-wow-lifetime/i,
  /\b9,00\s?€\b/,
  /\b29,00\s?€\b/,
  /type=["']?(?:credit|card|number)["']?/i,
  /action=["'][^"']*(?:checkout|payment|pay)/i,
];
for (const re of forbidden) {
  assert.ok(!re.test(page), `la page de positionnement contient un mécanisme interdit : ${re}`);
}

assert.match(page, /AUCUN PAIEMENT, AUCUN PRIX, AUCUN CHECKOUT/i, 'bannière d absence de paiement manquante');
assert.match(page, /aucune donnée n'est transmise/i, 'la page doit préciser l absence de transmission');
assert.match(page, /not transmitted/i, 'la version EN doit préciser l absence de transmission');
assert.match(page, /no se transmite/i, 'la version ES doit préciser l absence de transmission');

console.log('POSITIONNEMENT SANS PAIEMENT : OK');
