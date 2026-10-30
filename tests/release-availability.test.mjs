#!/usr/bin/env node
/**
 * release-availability.test.mjs — garde-fou commercial.
 *
 * Historique : ce test a ete ecrit quand le paquet de telechargement
 * correspondant a la v1.2.0 n'etait PAS verifiable dans R2 (issue #18,
 * PR #26). Les pages de vente devaient alors refuser de promettre une
 * livraison immediate et afficher un avis de non-confirmation.
 *
 * ETAT AU 27 OCTOBRE 2026 : le defaut d'origine est RESOLU et verifie.
 *   - l'objet R2 `casinobabe-fishing-1.2.0.zip` existe (1 387 543 octets) ;
 *   - son SHA-256 est `1c132f367607ea186feffde8bbda0a1a9f94cdec4b7850b93c57c271270bba4f`,
 *     conforme au MANIFEST.json du paquet ;
 *   - le paquet contient le runtime complet (16 scripts Python + addon Lua) ;
 *   - un telechargement reel via /api/download retourne HTTP 200 et le
 *     ZIP attendu (signature PK, SHA-256identique) ;
 *   - le checkout retourne HTTP 200 avec une URL Mollie ;
 *   - 5 commandes payees, 5 licences et 5 jetons de telechargement prouvent
 *     que le parcours est utilise en production.
 *
 * Ce test est desormais un garde-fou INVERSE : les pages ne doivent plus
 * affirmer que la livraison n'est pas confirmee (ce qui est faux et bloque
 * les ventes), mais elles ne doivent pas non plus prometre une livraison
 * instantanee. Le reste des invariants (formulaire, prix, mesure) est
 * inchange.
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

/* Promesses de livraison instantanee : toujours interdites, quel que soit
   l'etat de la livraison. Une livraison par e-mail n'est pas instantanee. */
const EN_CLAIM = /Delivered\s+<b>by email<\/b>\s+in minutes/i;
const FR_CLAIM = /Livré\s+<b>par e-mail<\/b>\s+en quelques minutes/i;

/* Affirmations de NON-confirmation : desormais fausses, donc interdites. */
const EN_UNVERIFIED = /cannot (?:currently )?verify|do not purchase until delivery is confirmed/i;
const FR_UNVERIFIED = /ne pouvons pas confirmer|n'achetez pas tant que/i;

/* Formulations veridiques exigees (une par langue). */
const EN_VERIFIED = /current release/i;
const FR_VERIFIED = /version actuelle/i;

for (const [page, file, claimRe, unverifiedRe, verifiedRe] of [
  ['buy.html', 'buy.html', EN_CLAIM, EN_UNVERIFIED, EN_VERIFIED],
  ['fr/buy.html', 'fr/buy.html', FR_CLAIM, FR_UNVERIFIED, FR_VERIFIED],
]) {
  const html = read(file);
  // Les retours a la ligne du HTML ne sont pas significatifs : on compare
  // sur une version a espaces normalises.
  const flat = html.replace(/\s+/g, ' ');

  check(`${page} : avis de livraison present`,
    /id="release-availability-notice"/.test(html) && /role="alert"/.test(html));
  check(`${page} : avis place AVANT le formulaire d'achat`,
    html.indexOf('id="release-availability-notice"') < html.indexOf('id="buyForm"'));
  check(`${page} : aucune promesse de livraison instantanee`, !claimRe.test(html));
  check(`${page} : aucune affirmation de livraison NON confirmee`,
    !unverifiedRe.test(flat),
    `(le paquet v1.2.0 est verifie en R2 le 27/10/2026)`);
  check(`${page} : livraison presentee comme verifiee`,
    verifiedRe.test(flat));
  check(`${page} : le manifeste SHA-256 est mentionne`,
    /SHA-256/i.test(flat));
  check(`${page} : le vrai formulaire de checkout est conserve`,
    /id="buyForm"/.test(html) && /id="buyBtn"/.test(html) && /id="buyErr"/.test(html));
  check(`${page} : prix 20,00 EUR inchange`,
    /20,00\s*€/.test(html));
  check(`${page} : aucun reste 'delivery to be confirmed' / 'livraison à confirmer' (contradiction avec l'avis vérifié)`,
    !/delivery to be confirmed/i.test(flat) && !/livraison à confirmer/i.test(flat));
  check(`${page} : héros cohérent 'version actuelle vérifiée'`,
    (/fr\//.test(file)
      ? /version actuelle/i.test(flat) && /vérifi/i.test(flat)
      : /current release/i.test(flat) && /verified/i.test(flat)),
    `(héros doit annoncer la version actuelle vérifiée, pas une livraison non confirmée)`);
  check(`${page} : CTAs instrumentes pour la mesure`,
    (html.match(/data-cta-id="buy-/g) || []).length >= 3);
  check(`${page} : canal de support accessible`,
    /mailto:support@bot-wow\.com/.test(html));
}

console.log(failures === 0 ? '\nRELEASE AVAILABILITY : OK' : `\nRELEASE AVAILABILITY : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);

