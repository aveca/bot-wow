#!/usr/bin/env node
/**
 * release-availability.test.mjs — garde-fou commercial.
 *
 * Probleme demontre : le site vend la v1.2.0 alors que le paquet de
 * telechargement correspondant n'est pas verifiable dans R2 (issue #18,
 * PR #26). Les pages de vente ne doivent donc PAS promettre de livraison
 * immediate ni presenter v1.2.0 comme une version confirmee.
 *
 * Ce test est un garde-fou statique : il lit le code publie, pas R2.
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

const EN_CLAIM = /Delivered\s+<b>by email<\/b>\s+in minutes/i;
const FR_CLAIM = /Livré\s+<b>par e-mail<\/b>\s+en quelques minutes/i;

for (const [page, file, claimRe] of [
  ['buy.html', 'buy.html', EN_CLAIM],
  ['fr/buy.html', 'fr/buy.html', FR_CLAIM],
]) {
  const html = read(file);
  // Les retours a la ligne du HTML ne sont pas significatifs : on compare
  // sur une version a espaces normalises.
  const flat = html.replace(/\s+/g, ' ');
  check(`${page} : avis de disponibilite present`,
    /id="release-availability-notice"/.test(html) && /role="alert"/.test(html));
  check(`${page} : avis place AVANT le formulaire d'achat`,
    html.indexOf('id="release-availability-notice"') < html.indexOf('id="buyForm"'));
  check(`${page} : aucune promesse de livraison immediate`, !claimRe.test(html));
  check(`${page} : v1.2.0 non presente comme une version confirmee`,
    !/<b>v1\.2\.0<\/b>\s*current release/i.test(html) && !/<b>v1\.2\.0<\/b>\s*version actuelle/i.test(html));
  check(`${page} : invitation a contacter le support avant paiement`,
    /do not purchase until delivery is confirmed|n'achetez pas tant que la livraison n'est pas confirmée/i.test(flat));
  check(`${page} : le vrai formulaire de checkout est conserve`,
    /id="buyForm"/.test(html) && /id="buyBtn"/.test(html) && /id="buyErr"/.test(html));
  check(`${page} : prix 20,00 EUR inchange`,
    /20,00\s*€/.test(html));
  check(`${page} : CTAs instrumentes pour la mesure`,
    (html.match(/data-cta-id="buy-/g) || []).length >= 3);
}


for (const [page, file, forbiddenClaim, blockedLabel] of [
  ['index.html', 'index.html', /Card payments via Mollie|Card payment is live through Mollie|Payment by <b[^>]*>Mollie<\/b>/i, /delivery not confirmed/i],
  ['fr/index.html', 'fr/index.html', /Paiement par carte via Mollie|Le paiement par carte fonctionne via Mollie|Paiement par <b[^>]*>Mollie<\/b>/i, /livraison à confirmer/i],
]) {
  const html = read(file);
  const flat = html.replace(/\s+/g, ' ');
  const button = (html.match(/<button\b[^>]*id="buyBtn"[^>]*disabled[^>]*>[\s\S]*?<\/button>/i) || [])[0] || '';
  check(page + ' : avis de livraison présent avant le formulaire',
    html.indexOf('id="release-availability-notice"') >= 0 &&
    html.indexOf('id="release-availability-notice"') < html.indexOf('id="buyForm"'));
  check(page + ' : bouton de checkout réellement désactivé', !!button);
  check(page + ' : libellé du bouton explique le blocage', blockedLabel.test(button));
  check(page + ' : aucun message ne prétend que Mollie est actuellement actif',
    !forbiddenClaim.test(flat));
}

console.log(failures === 0 ? '\nRELEASE AVAILABILITY : OK' : `\nRELEASE AVAILABILITY : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
