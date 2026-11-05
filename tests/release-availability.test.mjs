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
  check(`${page} : aucun badge ne suggère un paiement Mollie actif`,
    !/Payment by <b[^>]*>Mollie<\/b>|Paiement par <b[^>]*>Mollie<\/b>/i.test(flat));
  check(`${page} : aucune redirection Mollie n’est promise`,
    !/you are redirected to Mollie|vous êtes redirigé vers Mollie/i.test(flat));
  check(`${page} : aucun e-mail de livraison n’est présenté comme déjà certifié`,
    !/licence key and the download link are sent by email|la clé de licence et le lien de téléchargement sont envoyés par e-mail/i.test(flat));
}

for (const [page, file] of [
  ['buy.html', 'buy.html'],
  ['fr/buy.html', 'fr/buy.html'],
  ['AB A buy.html', 'ab/a/buy.html'],
  ['AB A fr/buy.html', 'ab/a/fr/buy.html'],
  ['AB B buy.html', 'ab/b/buy.html'],
  ['AB B fr/buy.html', 'ab/b/fr/buy.html'],
]) {
  const html = read(file);
  const meta = (html.match(/<meta\s+(?:name|property)="(?:description|og:description)"[^>]*>/gi) || []).join(' ');
  check(`${page} : les meta SEO ne promettent pas de livraison e-mail`,
    !/delivered by email|sent by email|livr(?:é|ée) par e-mail|envoyé par e-mail/i.test(meta));
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


for (const [page, file, oldClaim, newDisclosure, newHeading] of [
  ['buy.html', 'buy.html',
    /Everything below is delivered and working now/i,
    /The list below describes the intended product scope; package availability and delivery are not yet verified/i,
    /What the intended v1\.2\.0 build includes/i],
  ['fr/buy.html', 'fr/buy.html',
    /Tout ce qui suit est livré et fonctionne maintenant/i,
    /La liste ci-dessous décrit le périmètre prévu du produit ; la disponibilité du paquet et sa livraison ne sont pas encore vérifiées/i,
    /Périmètre prévu du build v1\.2\.0/i],
]) {
  const html = read(file);
  const flat = html.replace(/\s+/g, ' ');
  check(`${page} : aucune affirmation de livraison déjà vérifiée`, !oldClaim.test(flat));
  check(`${page} : périmètre explicitement présenté comme prévu et non vérifié`,
    newDisclosure.test(flat) && newHeading.test(flat));
}

for (const [page, file, oldClaims, newScope] of [
  ['index.html', 'index.html',
    /The one role BOT-WOW ships today|Fishing ships today|BOT-WOW ships one role|1 shipped \+ 3 in development|packaged build, delivered with a SHA-256 manifest/i,
    /The intended v1\.2\.0 scope is one role: fishing/i],
  ['fr/index.html', 'fr/index.html',
    /Le seul rôle que BOT-WOW livre aujourd'hui|La pêche livre aujourd'hui|BOT-WOW livre un seul rôle|1 livré \+ 3 en développement|paquet de livraison, avec un manifeste SHA-256/i,
    /Le périmètre prévu de la v1\.2\.0 couvre un seul rôle : la pêche/i],
]) {
  const html = read(file);
  const flat = html.replace(/\\s+/g, ' ');
  check(`${page} : aucune affirmation que le produit est déjà livré`, !oldClaims.test(flat));
  check(`${page} : périmètre prévu et disponibilité non vérifiée clairement indiqués`, newScope.test(flat));
}


 

for (const file of ['fr/index.html', 'fr/buy.html', 'fr/compatibility.html', 'fr/faq.html']) {
  const html = read(file);
  check(file + ' : référence Blizzard localisée en français',
    /blizzard\.com\/fr-fr\/legal\/cd5930c0-2784-420c-a23d-1e0d6ff8599b\/charte-anti-triche/i.test(html));
  check(file + ' : aucune référence Blizzard anglaise sur la page FR',
    !/blizzard\.com\/en-us\/legal\/cd5930c0-2784-420c-a23d-1e0d6ff8599b\/anti-cheating-agreement/i.test(html));
}

// Platform compliance: technical compatibility is not authorization.
const platformDisclosureFiles = [
  ['index.html', /Anti-Cheating Agreement/, /no Blizzard authorization/i, /Do not use it with Blizzard-operated services/i],
  ['buy.html', /Anti-Cheating Agreement/, /no Blizzard authorization/i, /Do not use it with Blizzard-operated services/i],
  ['compatibility.html', /Anti-Cheating Agreement/, /no Blizzard authorization/i, /Do not use it with Blizzard-operated services/i],
  ['faq.html', /Anti-Cheating Agreement/, /no Blizzard authorization/i, /Do not use it with Blizzard-operated services/i],
  ['fr/index.html', /accord anti-triche de Blizzard/i, /aucune autorisation de Blizzard/i, /Ne l'utilisez pas avec les services exploités par Blizzard/i],
  ['fr/buy.html', /accord anti-triche de Blizzard/i, /aucune autorisation de Blizzard/i, /Ne l'utilisez pas avec les services exploités par Blizzard/i],
  ['fr/compatibility.html', /accord anti-triche de Blizzard/i, /aucune autorisation de Blizzard/i, /Ne l'utilisez pas avec les services exploités par Blizzard/i],
  ['fr/faq.html', /accord anti-triche de Blizzard/i, /aucune autorisation de Blizzard/i, /Ne l'utilisez pas avec les services exploités par Blizzard/i],
];
for (const [file, agreement, noAuthorization, noBlizzardServices] of platformDisclosureFiles) {
  const html = read(file);
  const flat = html.replace(/\s+/g, ' ');
  check(file + ' : référence à l’accord anti-triche', agreement.test(flat));
  check(file + ' : absence d’autorisation Blizzard clairement indiquée', noAuthorization.test(flat));
  check(file + ' : avertissement contre l’utilisation sur les services Blizzard', noBlizzardServices.test(flat));
  check(file + ' : aucune invitation à utiliser le bot dans les règles du serveur',
    !/within the rules of the server you play on|dans le respect des règles du serveur sur lequel vous jouez|Play on servers where it is allowed|Jouez sur des serveurs où c'est autorisé/i.test(flat));
}
for (const [file, unavailable] of [
  ['faq.html', /Card checkout is currently unavailable/i],
  ['fr/faq.html', /paiement par carte est actuellement indisponible/i],
]) {
  const flat = read(file).replace(/\s+/g, ' ');
  check(file + ' : les moyens de paiement ne sont pas présentés comme actifs', unavailable.test(flat));
  check(file + ' : aucune affirmation de checkout Mollie actif',
    !/Card payments through Mollie's checkout|La carte via le checkout de Mollie/i.test(flat));
}

// Public module pages must distinguish internal registry status from commercial availability.
for (const [file, unavailable, noMollie, noSafeHarbour, noAuthorization, noBlizzardUse] of [
  ['modules.html', /delivery unverified|distribution unverified|package provenance/i, /Mollie/i, /within the rules of the server you play on/i, /No Blizzard authorization is claimed or documented/i, /Do not use BOT-WOW with Blizzard-operated services/i],
  ['fr/modules.html', /livraison non vérifiée|distribution non vérifiée|provenance/i, /Mollie/i, /dans le respect des règles du serveur sur lequel vous jouez/i, /Aucune autorisation de Blizzard n'est revendiquée ni documentée/i, /N'utilisez pas BOT-WOW avec les services exploités par Blizzard/i],
]) {
  const html = read(file);
  const flat = html.replace(/\s+/g, ' ');
  check(file + ' : disponibilité commerciale non vérifiée et paiement fermé', unavailable.test(flat) && /checkout fermé|checkout closed|paiement fermé/i.test(flat));
  check(file + ' : Mollie non présenté comme moyen actif', !noMollie.test(flat));
  check(file + ' : aucune formulation de safe-harbour serveur', !noSafeHarbour.test(flat));
  check(file + ' : absence d’autorisation Blizzard clairement indiquée', noAuthorization.test(flat));
  check(file + ' : avertissement explicite contre les services Blizzard', noBlizzardUse.test(flat));
  check(file + ' : lien vers le statut d’achat plutôt que CTA d’achat', /href="\.\/buy\.html"/.test(html) && /Purchase status|Statut de l'achat/i.test(flat));
  check(file + ' : aucune confusion avec un autre produit', !/Casinababe/i.test(flat));
}
const moduleRegistry = JSON.parse(read('assets/modules.json'));
const fishRegistry = moduleRegistry.modules.find((m) => m.id === 'fish');
if (fishRegistry) {
  const missingFishPaths = (fishRegistry.files || []).filter((p) => !fs.existsSync(path.join(REPO, p)));
  if (missingFishPaths.length) {
    for (const file of ['modules.html', 'fr/modules.html']) {
      const flat = read(file).replace(/\s+/g, ' ');
      check(file + ' : absence des sources du registre signalée', /source(?:\/test)? paths.*absent from this repository snapshot|chemins source\/tests? référencés.*absents de cette version du dépôt/i.test(flat));
    }
  }
}
const productTruth = read('PRODUCT.md');
const productFlat = productTruth.replace(/\s+/g, ' ');
check('PRODUCT.md : checkout déclaré fermé', /checkout public est \*\*fermé\*\*/i.test(productFlat));
check('PRODUCT.md : profil Mollie BOT-WOW dédié absent', /aucun profil Mollie BOT-WOW dédié/i.test(productFlat));
check('PRODUCT.md : livraison non certifiée', /livraison en production n'est pas certifiée/i.test(productFlat));
check('PRODUCT.md : compatibilité limitée à Classic 1.13', /WoW Classic 1\.13 testé/i.test(productFlat) && !/majorité des serveurs privés|WoW Retail \(The War Within\)|Season of Discovery/i.test(productFlat));
check('PRODUCT.md : compatibilité tierce ne vaut pas autorisation', /sans autorisation implicite/i.test(productFlat));
check('PRODUCT.md : règle d’activation contradictoire documentée', /défaut de configuration à 2 activations/i.test(productFlat));


// Public offer copy must not claim an unverified archive component or entitlement.
for (const [file, componentDisclosure, activationDisclosure, staleComponent, staleActivation] of [
  ['buy.html',
    /presence in the current v1\.2\.0 archive and its per-file SHA-256 manifest have not been verified/i,
    /Activation terms under verification/i,
    /The Casinobabe addon|shipped with a SHA-256 manifest per file/i,
    /Activation on one machine|One machine activation|A licence activates on one machine/i],
  ['fr/buy.html',
    /présence dans l'archive v1\.2\.0 actuelle et son manifeste SHA-256 par fichier ne sont pas vérifiés/i,
    /Conditions d'activation en cours de vérification/i,
    /L'addon Casinobabe|livré avec un manifeste SHA-256 par fichier/i,
    /Activation sur une machine|Une activation sur une machine|Une licence active une machine/i],
]) {
  const flat = read(file).replace(/\s+/g, ' ');
  check(file + ' : composant d’archive et manifeste non vérifiés', componentDisclosure.test(flat));
  check(file + ' : aucun nom de produit tiers présenté comme composant livré', !staleComponent.test(flat));
  check(file + ' : entitlement machine explicitement non confirmé', activationDisclosure.test(flat));
  check(file + ' : aucune promesse de limite machine non réconciliée', !staleActivation.test(flat));
}
for (const [file, disclosure, stale] of [
  ['index.html',
    /Activation terms are under verification; machine limits and licence re-sends are not currently confirmed/i,
    /Activation on one machine|One machine activation|licence re-sent on request/i],
  ['fr/index.html',
    /Les conditions d'activation sont en cours de vérification ; les limites de machines et le renvoi de licence ne sont pas encore confirmés/i,
    /Activation sur une machine|Une activation sur une machine|clé réexpédiée sur demande/i],
]) {
  const flat = read(file).replace(/\s+/g, ' ');
  check(file + ' : conditions d’activation non confirmées', disclosure.test(flat));
  check(file + ' : aucune promesse de machine non réconciliée', !stale.test(flat));
}


for (const [file, staleLabel] of [
  ['index.html', /The Casin[oa]babe addon/i],
  ['fr/index.html', /L'addon Casin[oa]babe/i],
]) {
  check(file + ' : aucune étiquette de composant sous un autre nom de produit', !staleLabel.test(read(file)));
}


for (const [file, staleMachineBinding] of [
  ['index.html', /licence is tied to your machine, not to a date/i],
  ['fr/index.html', /licence est liée à votre machine, pas à une date/i],
]) {
  check(file + ' : aucun entitlement machine présenté comme confirmé', !staleMachineBinding.test(read(file)));
}


check('index.html : le contenu de l’archive et son manifeste restent explicitement non vérifiés',
  /current archive and its SHA-256 manifest are not verified/i.test(read('index.html')) &&
  !/The addon and the packaged build, with a SHA-256 manifest/i.test(read('index.html')));



// Licence and FAQ claims must remain aligned with the currently unverified
// activation, recovery and delivery state. Cover both language variants and
// the standalone licence documentation.
const licenceTruthCases = [
  ['docs/license.html', /Activation terms are under verification/i, /public checkout is closed/i,
    /The licence covers one machine|One licence = one active machine|machine fingerprint is recorded|old activation can be revoked|license keys are re-sent by support on request/i],
  ['docs/fr/license.html', /Les conditions d'activation sont en cours de vérification/i, /checkout public est fermé/i,
    /La licence porte sur une machine|Une licence = une machine active|empreinte de la machine est enregistrée|ancienne activation peut être révoquée|clé peut être renvoyée par le support/i],
  ['faq.html', /offer is not currently available for purchase/i, /Activation limits are not confirmed/i,
    /one machine per licence|no seat limits beyond one machine|license keys are re-sent by support on request/i],
  ['fr/faq.html', /offre n'est pas actuellement disponible à l'achat/i, /limites d'activation ne sont pas confirmées/i,
    /une machine par licence|pas de limite de postes au-delà d'une machine|clé perdue peut être renvoyée par le support/i],
];
for (const [file, availability, activation, stale] of licenceTruthCases) {
  const flat = read(file).replace(/\\s+/g, ' ');
  check(file + ' : disponibilité commerciale explicitement fermée', availability.test(flat));
  check(file + ' : conditions d’activation explicitement non confirmées', activation.test(flat));
  check(file + ' : aucune ancienne promesse machine ou de renvoi de clé', !stale.test(flat));
}
const frHomeCopy = read('fr/index.html').replace(/\\s+/g, ' ');
check('fr/index.html : renvoi de licence explicitement non confirmé',
  /modalités de récupération ou de renvoi d'une licence ne sont pas confirmées/i.test(frHomeCopy));
check('fr/index.html : aucune promesse de licence réexpédiée sur demande',
  !/(?:clé|licence) réexpédiée sur demande/i.test(frHomeCopy));



// Licence and FAQ claims must remain aligned with the currently unverified
// activation, recovery and delivery state. Cover both language variants and
// the standalone licence documentation.
console.log(failures === 0 ? '\nRELEASE AVAILABILITY : OK' : `\nRELEASE AVAILABILITY : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
