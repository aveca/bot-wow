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
    /id="release-availability-notice"/.test(html) && /role="status"/.test(html));
  check(`${page} : mention « testé en conditions réelles »`,
    /id="before-buying"/.test(html) && /Tested in real conditions|Testé en conditions réelles/i.test(html));
  check(`${page} : avis de disponibilité présent et formulaire de paiement exposé`,
    html.includes('id="release-availability-notice"') &&
    /id="buyForm"/.test(html) && /id="buyBtn"/.test(html) && /type="email"/i.test(html));
  check(`${page} : aucune promesse de livraison immediate`, !claimRe.test(html));
  check(`${page} : v1.2.0 non presente comme une version confirmee`,
    !/<b>v1\.2\.0<\/b>\s*current release/i.test(html) && !/<b>v1\.2\.0<\/b>\s*version actuelle/i.test(html));
  check(`${page} : ton neutre sur le type de serveur`,
    /Tested in real conditions|Testé en conditions réelles/i.test(flat) &&
    !/not official Blizzard|serveurs officiels/i.test(flat));
  check(`${page} : formulaire d'achat exposé`,
    /id="buyForm"/.test(html) && /id="buyBtn"/.test(html));
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
  check(page + ' : formulaire d’achat présent',
    /id="buyForm"/.test(html) && /id="buyBtn"/.test(html));
  check(page + ' : le paiement est proposé',
    /Pay 20,00 €|Payer 20,00 €/.test(html));
  check(page + ' : aucun message ne prétend que Mollie est actuellement actif',
    !forbiddenClaim.test(flat));
}


for (const [file, lang] of [['index.html', 'en'], ['fr/index.html', 'fr'], ['buy.html', 'en'], ['fr/buy.html', 'fr']]) {
  const html = read(file);
  const flat = html.replace(/\s+/g, ' ');
  check(file + ' : la page présente une offre à 20 €, testée en conditions réelles',
    /20,00\s*€/.test(flat) && /tested in real conditions|testé en conditions réelles/i.test(flat));
  check(file + ' : aucune procédure de lancement présentée comme disponible',
    !/Unzip the package|paste your licence key|press F9|Décompressez le paquet|collez votre clé de licence|appuyez sur F9/i.test(flat));
  check(file + ' : aucune promesse de remboursement dans le marketing',
    !/Refundable:|Remboursable\s*:/i.test(flat));
  check(file + ' : aucune promesse de licence, activation ou livraison disponible',
    !/The bot itself is paid|Le bot lui-même est payant|activation on one machine|activation sur une machine|delivered by email|livré par e-mail/i.test(flat));
}

// Sales pages stay neutral on server type. The third-party notice lives on the terms page.
for (const [file, neutral] of [
  ['index.html', /tested in real conditions/i],
  ['fr/index.html', /testé en conditions réelles/i],
  ['buy.html', /tested in real conditions/i],
  ['fr/buy.html', /testé en conditions réelles/i],
  ['faq.html', /tested in real conditions/i],
  ['fr/faq.html', /testé en conditions réelles/i],
  ['features.html', /tested in real conditions/i],
  ['fr/features.html', /testé en conditions réelles/i],
]) {
  const flat = read(file).replace(/\s+/g, ' ');
  check(file + ' : testé en conditions réelles', neutral.test(flat));
  check(file + ' : pas de restriction de type de serveur',
    !/not official Blizzard|serveurs officiels|private servers only|serveurs privés seulement/i.test(flat));
  check(file + ' : aucun terme de contournement ou promesse de détection',
    !/bypass|contournement|Warden|indétectable|undetectable|anti-ban|anti-cheat\\s*(?:bypass|evasion)|anti-triche\\s*(?:contournement|évitement)/i.test(flat));
}
for (const [file, notice, footer] of [
  ['compatibility.html', /Intended for private servers, not official Blizzard servers\. The rules of each server apply\./i, /BOT-WOW is neither affiliated with nor endorsed by Blizzard Entertainment\. World of Warcraft is a trademark of Blizzard Entertainment\./i],
  ['fr/compatibility.html', /Destiné aux serveurs privés, pas aux serveurs officiels Blizzard\. Les règles de chaque serveur s'appliquent\./i, /BOT-WOW n'est ni affilié, ni approuvé par Blizzard Entertainment\. World of Warcraft est une marque de Blizzard Entertainment\./i],
  ['modules.html', /Intended for private servers, not official Blizzard servers\. The rules of each server apply\./i, /BOT-WOW is neither affiliated with nor endorsed by Blizzard Entertainment\. World of Warcraft is a trademark of Blizzard Entertainment\./i],
  ['fr/modules.html', /Destiné aux serveurs privés, pas aux serveurs officiels Blizzard\. Les règles de chaque serveur s'appliquent\./i, /BOT-WOW n'est ni affilié, ni approuvé par Blizzard Entertainment\. World of Warcraft est une marque de Blizzard Entertainment\./i],
]) {
  const flat = read(file).replace(/\s+/g, ' ');
  check(file + ' : mention exacte des serveurs privés', notice.test(flat));
  check(file + ' : non-affiliation et marque', footer.test(flat));
  // A legal anti-cheating warning is allowed; evasion, bypass and detection promises are not.
  check(file + ' : aucun terme de contournement ou promesse de détection',
    !/bypass|contournement|Warden|indétectable|undetectable|anti-ban|anti-cheat\\s*(?:bypass|evasion)|anti-triche\\s*(?:contournement|évitement)/i.test(flat));
}
// The comparison page must not present historical BOT-WOW features as a current offer.
for (const [file, neutral] of [
  ['compare.html', /tested in real conditions/i],
  ['fr/compare.html', /testé en conditions réelles/i],
]) {
  const flat = read(file).replace(/\s+/g, ' ');
  check(file + ' : comparaison générique en vente', neutral.test(flat) && /20,00\s*€/.test(flat));
  check(file + ' : aucun vendeur nommé', !/pixelwowbot\.com|PixelBuddy/i.test(flat));
  check(file + ' : aucune ancienne promesse runtime BOT-WOW',
    !/308 ms|308\s*ms|12\/12|Persistent spot memory|Mémoire persistante des spots|build du bot de pêche v1\.2\.0/i.test(flat));
}

for (const [file, onSale] of [
  ['faq.html', /lifetime licence/i],
  ['fr/faq.html', /licence à vie/i],
]) {
  const flat = read(file).replace(/\s+/g, ' ');
  check(file + ' : la FAQ décrit la licence en vente', onSale.test(flat) && /20,00/.test(flat));
  check(file + ' : aucune affirmation de checkout Mollie actif',
    !/Card payments through Mollie's checkout|La carte via le checkout de Mollie/i.test(flat));
  check(file + ' : pas de projet historique ni de paiement fermé',
    !/historical project|projet historique|checkout is closed|checkout est fermé|No BOT-WOW product is currently offered|Aucun produit BOT-WOW n'est actuellement proposé/i.test(flat));
}

// FAQ pages sell the implemented runtime and do not revive the closed-checkout story.
for (const [file, features] of [
  ['faq.html', /fishes, remembers the schools, plans the round/i],
  ['fr/faq.html', /pêche, mémorise les bancs, prépare la ronde/i],
]) {
  const flat = read(file).replace(/\s+/g, ' ');
  check(file + ' : les fonctions implémentées sont décrites', features.test(flat));
  check(file + ' : la démo navigateur reste une prévisualisation',
    /simulated data|données simulées/i.test(flat));
  check(file + ' : pas d’interdiction de paiement',
    !/Do not send payment|N'envoyez aucun paiement/i.test(flat));
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


// Primary purchase pages must not describe historical scope as a current deliverable.
for (const [file, lang] of [['buy.html', 'en'], ['fr/buy.html', 'fr']]) {
  const flat = read(file).replace(/\s+/g, ' ');
  check(file + ' : l’offre décrit la pêche, testée en conditions réelles',
    /fishing|pêche/i.test(flat) && /tested in real conditions|testé en conditions réelles/i.test(flat));
  check(file + ' : le formulaire d’achat est présent',
    /id="buyForm"/.test(read(file)));
  check(file + ' : aucune promesse de machine ou de livraison',
    !/Activation on one machine|Activation sur une machine|delivered by email|livré par e-mail/i.test(flat));
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


check('index.html : la vente ne décrit pas une procédure d’installation',
  !/Unzip the package|paste your licence key|press F9/i.test(read('index.html')));


// Licence and FAQ claims must remain aligned with the currently unverified
// activation, recovery and delivery state. Cover both language variants and
// the standalone licence documentation.
const licenceTruthCases = [
  ['docs/license.html', /Activation terms are under verification/i, /public checkout is closed/i,
    /The licence covers one machine|One licence = one active machine|machine fingerprint is recorded|old activation can be revoked|license keys are re-sent by support on request/i],
  ['docs/fr/license.html', /Les conditions d'activation sont en cours de vérification/i, /checkout public est fermé/i,
    /La licence porte sur une machine|Une licence = une machine active|empreinte de la machine est enregistrée|ancienne activation peut être révoquée|clé peut être renvoyée par le support/i],
];
for (const [file, availability, activation, stale] of licenceTruthCases) {
  const flat = read(file).replace(/\s+/g, ' ');
  check(file + ' : disponibilité commerciale explicitement fermée', availability.test(flat));
  check(file + ' : conditions d’activation explicitement non confirmées', activation.test(flat));
  check(file + ' : aucune ancienne promesse machine ou de renvoi de clé', !stale.test(flat));
}
const frHomeCopy = read('fr/index.html').replace(/\s+/g, ' ');
check('fr/index.html : la vente ne décrit pas une procédure d’installation',
  !/Décompressez le paquet|collez votre clé de licence|appuyez sur F9/i.test(frHomeCopy));


// Licence and FAQ claims must remain aligned with the currently unverified
// activation, recovery and delivery state. Cover both language variants and
// the standalone licence documentation.


// Homepage purchase CTAs must report availability, never imply that checkout
// is currently open. The target price remains visible as a target, not a buy-now offer.
const homepagePurchaseStatusCases = [
  {
    file: 'index.html',
    hero: /data-cta-id="hero-status"[^>]*>Buy the lifetime licence<\/a>/i,
    bar: /aria-label="Buy the licence"[\s\S]*?data-cta-id="mbar-status">Buy<\/a>/i,
    targetPrice: /20,00 €/i,
    allowedStatusLabel: /buy|20,00/i,
  },
  {
    file: 'fr/index.html',
    hero: /data-cta-id="hero-status"[^>]*>Acheter la licence à vie<\/a>/i,
    bar: /aria-label="Acheter la licence"[\s\S]*?data-cta-id="mbar-status">Acheter<\/a>/i,
    targetPrice: /20,00 €/i,
    allowedStatusLabel: /acheter|20,00/i,
  },
];
for (const item of homepagePurchaseStatusCases) {
  const html = read(item.file);
  const statusLinks = [...html.matchAll(/<a\b[^>]*href="#buy"[^>]*>([\s\S]*?)<\/a>/gi)];
  const labels = statusLinks.map((match) => match[1].replace(/<[^>]*>/g, '').trim());
  check(item.file + ' : CTA principal de statut présent', item.hero.test(html));
  check(item.file + ' : barre mobile annonce le statut, pas un achat', item.bar.test(html));
  check(item.file + ' : prix explicitement présenté comme cible', item.targetPrice.test(html));
  check(item.file + ' : les liens vers l’achat sont uniquement des liens de statut',
    statusLinks.length >= 2 && labels.every((label) => item.allowedStatusLabel.test(label)));
  check(item.file + ' : anciens identifiants de CTA d’achat supprimés',
    !/(?:hero-offer|journey-fish-buy|journey-licence-buy|steps-buy|final-buy|mbar-buy)/i.test(html));
  check(item.file + ' : aucun lien footer ne prétend ouvrir un achat',
    !/<a\b[^>]*href="\.\/buy\.html"[^>]*>(?:Buy the licence|Acheter la licence)/i.test(html));
}

// The standalone Buy routes are currently status pages, not purchasable offers.
const purchaseStatusPageCases = [
  {
    file: 'buy.html',
    title: /<title>Buy BOT-WOW/i,
    nav: /data-cta-id="nav-status"[^>]*>Buy · 20,00 €<\/a>/i,
    hero: /data-cta-id="buy-status-primary"[^>]*>Pay 20,00 €<\/a>/i,
    bar: /aria-label="Buy"[\s\S]*?20,00 €/i,
    targetPrice: /20,00 €/i,
  },
  {
    file: 'fr/buy.html',
    title: /<title>Acheter BOT-WOW/i,
    nav: /data-cta-id="nav-status"[^>]*>Acheter · 20,00 €<\/a>/i,
    hero: /data-cta-id="buy-status-primary"[^>]*>Payer 20,00 €<\/a>/i,
    bar: /aria-label="Acheter"[\s\S]*?20,00 €/i,
    targetPrice: /20,00 €/i,
  },
];
for (const item of purchaseStatusPageCases) {
  const html = read(item.file);
  check(item.file + ' : titre SEO décrit un statut, pas un achat ouvert', item.title.test(html));
  check(item.file + ' : CTA de navigation décrit la disponibilité', item.nav.test(html));
  check(item.file + ' : CTA principal décrit la disponibilité', item.hero.test(html));
  check(item.file + ' : barre persistante annonce le statut et le prix cible', item.bar.test(html));
  check(item.file + ' : 20 € est présenté comme prix cible historique', item.targetPrice.test(html));
  check(item.file + ' : anciens identifiants de CTA d’achat supprimés',
    !/(?:nav-buy|buy-hero-primary)/i.test(html));
}


// Comparison pages must show a real status route, historical pricing only,
// and the legal boundary without implying a live purchase or delivery.
for (const item of [
  {
    file: 'compare.html',
    cta: /href="\.\/buy\.html"[^>]*data-cta-id="compare-status">Buy · 20,00 €<\/a>/i,
    bar: /data-cta-id="mbar-status">Buy<\/a>/i,
    target: /20,00 €/i,
    scope: /tested in real conditions/i,
  },
  {
    file: 'fr/compare.html',
    cta: /href="\.\/buy\.html"[^>]*data-cta-id="compare-status">Acheter · 20,00 €<\/a>/i,
    bar: /data-cta-id="mbar-status">Acheter<\/a>/i,
    target: /20,00 €/i,
    scope: /testé en conditions réelles/i,
  },
]) {
  const html = read(item.file);
  check(item.file + ' : CTA principal vers le statut d’achat', item.cta.test(html));
  check(item.file + ' : barre mobile = statut, pas achat', item.bar.test(html));
  check(item.file + ' : prix explicitement historique, pas une offre', item.target.test(html));
  check(item.file + ' : aucun ancien CTA d’achat', !/(?:formula-ours-buy|mbar-buy)/i.test(html));
  check(item.file + ' : aucun fournisseur Mollie présenté comme actif', !/Mollie/i.test(html));
  check(item.file + ' : aucune promesse de machine ou renvoi de licence',
    !/Activation on one machine|Activation sur une machine|licence re-send on request|renvoi de licence sur demande/i.test(html));
  check(item.file + ' : aucun addon attribué à Casinababe',
    !/Casinababe addon|addon Casinababe/i.test(html));
  check(item.file + ' : aucune livraison présentée comme déjà expédiée',
    !/1 shipped \+ 3 in development|1 livré \+ 3 en développement/i.test(html));
  check(item.file + ' : avertissement d’autorisation présent', item.scope.test(html));
}
for (const file of ['modules.html', 'fr/modules.html']) {
  const html = read(file);
  check(file + ' : CTA de statut sans style d’achat immédiat',
    /<a class="btn btn-ghost"[^>]*href="\.\/buy\.html">(?:Purchase status|Statut de l'achat)<\/a>/.test(html));
}



// Closed checkout pages must not expose a fake email field or disabled payment form.
for (const file of ['compare.html', 'fr/compare.html']) {
  const html = read(file);
  const fr = file.startsWith('fr/');
  check(file + ' : la comparaison ne contient pas le formulaire de paiement',
    !/id="buyForm"/.test(html));
}
for (const file of ['index.html', 'fr/index.html', 'buy.html', 'fr/buy.html']) {
  const html = read(file);
  check(file + ' : le formulaire de paiement est exposé',
    /id="buyForm"/.test(html) && /id="buyBtn"/.test(html) && /type="email"/i.test(html));
}


// Home pages must present a project status and simulated demo, not a gameplay-automation offer.
for (const item of [
  {
    file: 'index.html',
    hero: /<h1 class="hero__title">[\s\S]*?Read the window/i,
    notice: /tested in real conditions/i,
    price: /20,00 €/i,
    forbidden: /Unzip the package|paste your licence key|press F9|Automate my fishing|Refundable:/i,
  },
  {
    file: 'fr/index.html',
    hero: /<h1 class="hero__title">[\s\S]*?Lire la fenêtre/i,
    notice: /testé en conditions réelles/i,
    price: /20,00 €/i,
    forbidden: /Décompressez le paquet|collez votre clé de licence|appuyez sur F9|Automatiser ma pêche|Remboursable\s*:/i,
  },
]) {
  const html = read(item.file);
  check(item.file + ' : titre principal annonce le statut du projet', item.hero.test(html));
  check(item.file + ' : avis indique qu’aucun produit n’est disponible', item.notice.test(html));
  check(item.file + ' : prix conservé comme cible historique', item.price.test(html));
  check(item.file + ' : aucune instruction d’automatisation ni promesse de remboursement', !item.forbidden.test(html));
  check(item.file + ' : CTA démo et statut présents', /data-cta-id="hero-demo"/i.test(html) && /data-cta-id="hero-status"/i.test(html));
}

// Secondary EN/FR routes must describe status, not an available purchase or install.
const secondaryStatusRoutes = [
  ['demo.html', './buy.html'],
  ['fr/demo.html', './buy.html'],
  ['features.html', './buy.html'],
  ['fr/features.html', './buy.html'],
  ['getting-started.html', './buy.html'],
  ['fr/getting-started.html', './buy.html'],
  ['fishing.html', './buy.html'],
  ['fr/fishing.html', './buy.html'],
  ['faq.html', './buy.html'],
  ['fr/faq.html', './buy.html'],
  ['compatibility.html', './buy.html'],
  ['fr/compatibility.html', './buy.html'],
  ['roadmap.html', './buy.html'],
  ['fr/roadmap.html', './buy.html'],
  ['success.html', './buy.html'],
  ['fr/success.html', './buy.html'],
  ['docs/install.html', '../buy.html'],
  ['docs/fr/install.html', '../../fr/buy.html'],
  ['docs/license.html', '../buy.html'],
  ['docs/fr/license.html', '../../fr/buy.html'],
  ['docs/index.html', '../buy.html'],
  ['docs/fr/index.html', '../../fr/buy.html'],
];
for (const [file, statusHref] of secondaryStatusRoutes) {
  const html = read(file);
  check(file + ' : aucun ancien lien #offre/#buy', !/href=["'][^"']*#(?:offre|buy)/i.test(html));
  check(file + ' : lien vers la page de statut', html.includes('href="' + statusHref + '"'));
  check(file + ' : aucun CTA d’achat immédiat résiduel',
    !/Buy — €20\.00|Acheter — 20,00 €|Get the lifetime licence|Prendre la licence à vie|Buy licence|Acheter la licence/i.test(html));
}
for (const [file, forbidden] of [
  ['demo.html', /lifetime licence|before you buy|One-time · lifetime|Buy licence/i],
  ['fr/demo.html', /licence à vie|avant d’acheter|Paiement unique · licence à vie|Acheter la licence/i],
  ['features.html', /Mollie|Bitcoin|Machine-locked licence keys/i],
  ['fr/features.html', /Mollie|Bitcoin|Clés verrouillées à une machine/i],
  ['getting-started.html', /python scripts\/fishing_bot\.py|clickAfterBiteMs|After payment you receive|Your key activates on one machine/i],
  ['fr/getting-started.html', /python scripts\/fishing_bot\.py|clickAfterBiteMs|Après le paiement, vous recevez|Votre clé s’active sur une machine/i],
  ['success.html', /Thank you — your order is in|You receive an email with your|licence key.*download link/i],
  ['fr/success.html', /Commande confirmée|Vous recevez par e-mail votre|clé de licence.*lien de téléchargement/i],
  ['docs/install.html', /python scripts\/fishing_bot\.py|clickAfterBiteMs|Casinababe\.toc|pip install opencv/i],
  ['docs/fr/install.html', /python scripts\/fishing_bot\.py|clickAfterBiteMs|Casinababe\.toc|pip install opencv/i],
]) {
  const html = read(file);
  check(file + ' : anciennes promesses ou instructions non disponibles supprimées', !forbidden.test(html));
}


for (const [file, forbidden] of [
  ['roadmap.html', /Live now — v1\.2\.0|machine activation|manual bitcoin rail|Farm your/i],
  ['fr/roadmap.html', /En place aujourd'hui — v1\.2\.0|activation par machine|rail bitcoin manuel|farm d'XP/i],
  ['docs/index.html', /Everything you need to install, use|Prerequisites, addon, configuration, first run/i],
  ['docs/fr/index.html', /Tout ce qu'il faut pour installer, utiliser|Prérequis, addon, configuration, lancement/i],
]) {
  const html = read(file);
  check(file + ' : page archivée sans promesse de release ou d’installation', !forbidden.test(html));
}


const additionalStatusRoutes = [
  ['cancel.html', './buy.html'],
  ['fr/cancel.html', './buy.html'],
  ['docs/changelog.html', '../buy.html'],
  ['docs/fr/changelog.html', '../../fr/buy.html'],
  ['docs/known-issues.html', '../buy.html'],
  ['docs/fr/known-issues.html', '../../fr/buy.html'],
  ['404.html', './buy.html'],
  ['fr/404.html', './buy.html'],
  ['legal/terms.html', '../buy.html'],
  ['legal/fr/terms.html', '../../fr/buy.html'],
  ['legal/privacy.html', '../buy.html'],
  ['legal/fr/privacy.html', '../../fr/buy.html'],
  ['legal/refund.html', '../buy.html'],
  ['legal/fr/refund.html', '../../fr/buy.html'],
];
for (const [file, statusHref] of additionalStatusRoutes) {
  const html = read(file);
  check(file + ' : aucun ancien lien commercial #offre/#buy', !/href=["'][^"']*#(?:offre|buy)/i.test(html));
  check(file + ' : lien vers la page de statut', html.includes('href="' + statusHref + '"'));
  check(file + ' : aucun CTA Buy/Acheter à 20 €', !/Buy — €20\.00|Acheter — 20,00 €|Buy now|Acheter maintenant/i.test(html));
}
for (const [file, forbidden] of [
  ['cancel.html', /Payment cancelled\.|Nothing was charged|Back to the offer/i],
  ['fr/cancel.html', /Paiement annulé\.|Rien n'a été débité|Revenir à l'offre/i],
  ['404.html', /Use automation software responsibly and within the rules/i],
  ['fr/404.html', /Utilisez les logiciels d'automatisation de manière responsable/i],
]) {
  const html = read(file);
  check(file + ' : ne présente pas une annulation ou une autorisation non vérifiée', !forbidden.test(html));
}

console.log(failures === 0 ? '\nRELEASE AVAILABILITY : OK' : `\nRELEASE AVAILABILITY : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
