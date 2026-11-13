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
  check(`${page} : aucune offre payante, liste d'attente, pas de Payment Link`,
    /mailto:support@bot-wow.com/.test(html) && /No paid offer|Aucune offre payante/i.test(flat) && !/buy\.stripe\.com/.test(html));
  check(`${page} : l'automatisation est refusée avant tout contact`,
    /id="before-buying"/.test(html) && /EULA/i.test(flat));
  check(`${page} : pas de formulaire ni de lien Stripe`,
    !/id="buyForm"|id="buyBtn"|type="email"|buy\.stripe\.com/i.test(html));
  check(`${page} : aucune promesse de livraison immediate`, !claimRe.test(html));
  check(`${page} : v1.2.0 non presente comme une version confirmee`,
    !/<b>v1\.2\.0<\/b>\s*current release/i.test(html) && !/<b>v1\.2\.0<\/b>\s*version actuelle/i.test(html));
  check(`${page} : l'EULA interdit l'automatisation, y compris sur serveurs privés`,
    /EULA/i.test(flat) && /private servers|serveurs privés/i.test(flat));
  check(`${page} : aucun formulaire ni champ e-mail`,
    !/id="buyForm"|id="buyBtn"|type="email"/i.test(html));
  check(`${page} : aucun prix de vente affiché`,
    !/20,00\s*€/.test(html) && !/buy\.stripe\.com/.test(html));
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
  check(page + ' : liste d’attente sans formulaire et sans Payment Link',
    /mailto:support@bot-wow.com/.test(html) &&
    /No paid offer|Aucune offre payante/i.test(flat) &&
    !/buy\.stripe\.com|id="buyForm"|id="buyBtn"|type="email"/i.test(html));
  check(page + ' : aucun message ne prétend que Mollie est actuellement actif',
    !forbiddenClaim.test(flat));
}


for (const [file, lang] of [['index.html', 'en'], ['fr/index.html', 'fr'], ['buy.html', 'en'], ['fr/buy.html', 'fr']]) {
  const html = read(file);
  const flat = html.replace(/\s+/g, ' ');
  check(file + ' : aucune offre payante, l’automatisation reste interdite',
    /No paid offer|Aucune offre payante/i.test(flat) && /EULA/i.test(flat) && !/buy\.stripe\.com/.test(flat));
  check(file + ' : aucune procédure de lancement présentée comme disponible',
    !/Unzip the package|paste your licence key|press F9|Décompressez le paquet|collez votre clé de licence|appuyez sur F9/i.test(flat));
  check(file + ' : aucune promesse de remboursement dans le marketing',
    !/Refundable:|Remboursable\s*:/i.test(flat));
  check(file + ' : aucune promesse de licence, activation ou livraison disponible',
    !/The bot itself is paid|Le bot lui-même est payant|activation on one machine|activation sur une machine|delivered by email|livré par e-mail/i.test(flat));
}

// Sales pages use the requested neutral private-server scope and non-affiliation statement.
for (const [file, notice, footer] of [
  ['index.html', /EULA prohibits bots that automate game control/i, /BOT-WOW is neither affiliated with nor endorsed by Blizzard Entertainment\. World of Warcraft is a trademark of Blizzard Entertainment\./i],
  ['fr/index.html', /EULA de Blizzard interdit les bots qui automatisent le contrôle du jeu/i, /World of Warcraft est une marque de Blizzard Entertainment\./i],
  ['buy.html', /EULA prohibits bots that automate game control/i, /BOT-WOW is neither affiliated with nor endorsed by Blizzard Entertainment\. World of Warcraft is a trademark of Blizzard Entertainment\./i],
  ['fr/buy.html', /EULA de Blizzard interdit les bots qui automatisent le contrôle du jeu/i, /World of Warcraft est une marque de Blizzard Entertainment\./i],
  ['faq.html', /Nowhere as a bot/i, /BOT-WOW is neither affiliated with nor endorsed by Blizzard Entertainment\. World of Warcraft is a trademark of Blizzard Entertainment\./i],
  ['fr/faq.html', /Aucune offre payante|n’est pas proposé|n'est pas proposé/i, /Blizzard Entertainment/i],
  ['compatibility.html', /Intended for private servers, not official Blizzard servers\. The rules of each server apply\./i, /BOT-WOW is neither affiliated with nor endorsed by Blizzard Entertainment\. World of Warcraft is a trademark of Blizzard Entertainment\./i],
  ['fr/compatibility.html', /Destiné aux serveurs privés, pas aux serveurs officiels Blizzard\. Les règles de chaque serveur s'appliquent\./i, /BOT-WOW n'est ni affilié, ni approuvé par Blizzard Entertainment\. World of Warcraft est une marque de Blizzard Entertainment\./i],
  ['compare.html', /Use BOT-WOW only on private servers whose published rules expressly permit fishing automation/i, /BOT-WOW is neither affiliated with nor endorsed by Blizzard Entertainment\. World of Warcraft is a trademark of Blizzard Entertainment\./i],
  ['fr/compare.html', /Utilisez BOT-WOW uniquement sur des serveurs privés dont les règles publiées autorisent explicitement l’automatisation de la pêche/i, /BOT-WOW n'est ni affilié, ni approuvé par Blizzard Entertainment\. World of Warcraft est une marque de Blizzard Entertainment\./i],
  ['features.html', /No paid offer|Information only/i, /not for sale|No paid offer/i],
  ['fr/features.html', /Aucune offre payante|n'est pas en vente|n’est pas en vente/i, /Blizzard|attente/i],
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
for (const [file, noOffer, sourceLink] of [
  ['compare.html', /private servers/i, /pixelwowbot\.com/],
  ['fr/compare.html', /serveurs privés/i, /pixelwowbot\.com/],
]) {
  const flat = read(file).replace(/\s+/g, ' ');
  check(file + ' : offre serveurs privés visible', noOffer.test(flat));
  check(file + ' : sources publiques du concurrent citées', sourceLink.test(flat));
  check(file + ' : aucune ancienne promesse runtime BOT-WOW',
    !/308 ms|308\s*ms|12\/12|Persistent spot memory|Mémoire persistante des spots|build du bot de pêche v1\.2\.0/i.test(flat));
}

for (const [file, unavailable] of [
  ['faq.html', /does not start a payment/i],
  ['fr/faq.html', /ne lance pas de paiement|Aucune offre payante/i],
]) {
  const flat = read(file).replace(/\s+/g, ' ');
  check(file + ' : les moyens de paiement ne sont pas présentés comme actifs', unavailable.test(flat) && !/Stripe is the current payment method|Stripe est le moyen de paiement actuel/i.test(flat));
  check(file + ' : aucune affirmation de checkout Mollie actif',
    !/Card payments through Mollie's checkout|La carte via le checkout de Mollie/i.test(flat));
}

// FAQ pages must describe the current project, not the historical bot as a sellable or verified runtime.
for (const [file, unavailable, simulated, staleClaims] of [
  ['faq.html', /No paid offer is open/i, /simulated data/i, /It fishes, the way a careful human would|the bot itself is a paid product|A refund can be requested within 14 days|Selected third-party builds have been used/i],
  ['fr/faq.html', /Aucune offre payante/i, /données simulées|simulé/i, /Il pêche, comme un humain soigneux|Le bot lui-même est un produit payant|Un remboursement peut être demandé dans les 14 jours|Certains builds tiers ont servi aux tests techniques/i],
]) {
  const flat = read(file).replace(/\s+/g, ' ');
  check(file + ' : réservation bêta et livraison manuelle annoncées dès la FAQ', unavailable.test(flat));
  check(file + ' : démo explicitement simulée et sans intégration de jeu', simulated.test(flat));
  check(file + ' : aucune capacité runtime, compatibilité ou promesse de remboursement historique présentée comme actuelle', !staleClaims.test(flat));
  check(file + ' : aucun paiement Stripe n’est présenté comme le moyen actuel', !/Stripe is the current payment method|Stripe est le moyen de paiement actuel/i.test(flat));
  const expectedFooter = file === 'faq.html'
    ? 'No paid offer.'
    : 'Aucune offre payante';
  const archivedInstallLabel = file === 'faq.html'
    ? 'Archived installation notes (not current instructions)'
    : 'Notes d’installation archivées (instructions non actuelles)';
  check(file + ' : pied de page cohérent avec le statut historique', flat.includes(expectedFooter));
  check(file + ' : anciennes affirmations de produit actuel retirées du pied de page',
    !/Fishing assistant for WoW Classic|Assistant de pêche pour WoW Classic/i.test(flat));
  check(file + ' : les notes d’installation sont explicitement archivées', flat.includes(archivedInstallLabel));
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
check('PRODUCT.md : l’offre payante est retirée, le Payment Link n’est pas une vente ouverte', /aucune offre payante/i.test(productFlat) && /Payment Link Stripe/.test(productFlat) && /n’est plus promu|n'est plus promu/i.test(productFlat));
check('PRODUCT.md : profil Mollie BOT-WOW dédié absent', /aucun profil Mollie BOT-WOW dédié/i.test(productFlat));
check('PRODUCT.md : livraison logicielle non certifiée', /Livraison éventuelle : manuelle/.test(productFlat) && /Release commercial du logiciel : toujours bloqué/.test(productFlat));
check('PRODUCT.md : compatibilité limitée à Classic 1.13', /WoW Classic 1\.13 testé/i.test(productFlat) && !/majorité des serveurs privés|WoW Retail \(The War Within\)|Season of Discovery/i.test(productFlat));
check('PRODUCT.md : compatibilité tierce ne vaut pas autorisation', /sans autorisation implicite/i.test(productFlat));
check('PRODUCT.md : règle d’activation contradictoire documentée', /défaut de configuration à 2 activations/i.test(productFlat));


// Primary purchase pages must not describe historical scope as a current deliverable.
for (const [file, lang] of [['buy.html', 'en'], ['fr/buy.html', 'fr']]) {
  const flat = read(file).replace(/\s+/g, ' ');
  check(file + ' : l’offre concerne la pêche sur serveurs privés',
    /fishing|pêche/i.test(flat) && /private servers|serveurs privés/i.test(flat));
  check(file + ' : aucun formulaire ou champ e-mail public',
    !/id="buyForm"|id="buyBtn"|type="email"/i.test(read(file)));
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
  ['faq.html', /No paid offer is open/i, /Activation limits are not relevant/i,
    /one machine per licence|no seat limits beyond one machine|license keys are re-sent by support on request/i],
  ['fr/faq.html', /Aucune offre payante/i, /Aucune offre payante/i,
    /une machine par licence|pas de limite de postes au-delà d'une machine|clé perdue peut être renvoyée par le support/i],
];
for (const [file, availability, activation, stale] of licenceTruthCases) {
  const flat = read(file).replace(/\s+/g, ' ');
  check(file + ' : réservation bêta explicitement annoncée', availability.test(flat));
  check(file + ' : conditions d’activation explicitement non confirmées', activation.test(flat));
  check(file + ' : aucune ancienne promesse machine ou de renvoi de clé', !stale.test(flat));
}
const frHomeCopy = read('fr/index.html').replace(/\s+/g, ' ');
check('fr/index.html : la vente ne décrit pas une procédure d’installation',
  !/Décompressez le paquet|collez votre clé de licence|appuyez sur F9/i.test(frHomeCopy));


// Licence and FAQ claims must remain aligned with the currently unverified
// activation, recovery and delivery state. Cover both language variants and
// the standalone licence documentation.


// Homepage purchase CTAs offer a beta reservation with manual delivery.
const homepagePurchaseStatusCases = [
  {
    file: 'index.html',
    hero: /data-cta-id="hero-status"[^>]*>Join the waitlist<\/a>/i,
    bar: /aria-label="Purchase status"[\s\S]*?data-cta-id="mbar-status">See the offers<\/a>/i,
    targetPrice: /9,00 €/i,
    allowedStatusLabel: /waitlist|offers|Planner|Studio/i,
  },
  {
    file: 'fr/index.html',
    hero: /data-cta-id="hero-status"[^>]*>Rejoindre la liste d’attente<\/a>/i,
    bar: /aria-label="Statut de l’achat"[\s\S]*?data-cta-id="mbar-status">Voir les offres<\/a>/i,
    targetPrice: /9,00 €/i,
    allowedStatusLabel: /attente|offres|Planner|Studio/i,
  },
];
for (const item of homepagePurchaseStatusCases) {
  const html = read(item.file);
  const statusLinks = [...html.matchAll(/<a\b[^>]*href="#buy"[^>]*>([\s\S]*?)<\/a>/gi)];
  const labels = statusLinks.map((match) => match[1].replace(/<[^>]*>/g, '').trim());
  check(item.file + ' : CTA principal de statut présent', item.hero.test(html));
  check(item.file + ' : barre mobile propose la réservation bêta', item.bar.test(html));
  check(item.file + ' : prix de réservation 20 € visible', item.targetPrice.test(html));
  check(item.file + ' : les liens vers l’achat sont uniquement des liens de statut',
    statusLinks.length >= 2 && labels.every((label) => item.allowedStatusLabel.test(label)));
  check(item.file + ' : anciens identifiants de CTA d’achat supprimés',
    !/(?:hero-offer|journey-fish-buy|journey-licence-buy|steps-buy|final-buy|mbar-buy)/i.test(html));
  check(item.file + ' : aucun lien footer ne prétend ouvrir un achat',
    !/<a\b[^>]*href="\.\/buy\.html"[^>]*>(?:Buy the licence|Acheter la licence)/i.test(html));
}

// The standalone Buy routes offer a beta reservation with manual delivery.
const purchaseStatusPageCases = [
  {
    file: 'buy.html',
    title: /<title>BOT-WOW — Waitlist, no paid offer/i,
    nav: /data-cta-id="nav-status"[^>]*>Join the waitlist<\/a>/i,
    hero: /data-cta-id="buy-status-primary"[^>]*>Join the waitlist<\/a>/i,
    bar: /aria-label="Purchase status"[\s\S]*?See the offers/i,
    targetPrice: /No paid offer/i,
  },
  {
    file: 'fr/buy.html',
    title: /<title>BOT-WOW — Liste d’attente, aucune offre payante/i,
    nav: /data-cta-id="nav-status"[^>]*>Rejoindre la liste d’attente<\/a>/i,
    hero: /data-cta-id="buy-status-primary"[^>]*>Rejoindre la liste d’attente<\/a>/i,
    bar: /aria-label="Statut de disponibilité"[\s\S]*?Voir les offres/i,
    targetPrice: /Aucune offre payante/i,
  },
];
for (const item of purchaseStatusPageCases) {
  const html = read(item.file);
  check(item.file + ' : titre SEO décrit la réservation bêta', item.title.test(html));
  check(item.file + ' : CTA de navigation propose la réservation bêta', item.nav.test(html));
  check(item.file + ' : CTA principal propose la réservation bêta', item.hero.test(html));
  check(item.file + ' : barre persistante propose la réservation', item.bar.test(html));
  check(item.file + ' : prix de réservation 20 € visible', item.targetPrice.test(html));
  check(item.file + ' : anciens identifiants de CTA d’achat supprimés',
    !/(?:nav-buy|buy-hero-primary)/i.test(html));
}


// Comparison pages must show a real status route, historical pricing only,
// and the legal boundary without implying a live purchase or delivery.
for (const item of [
  {
    file: 'compare.html',
    cta: /href="\.\/buy\.html"[^>]*data-cta-id="compare-reserve">Join the waitlist<\/a>/i,
    bar: /data-cta-id="mbar-reserve">Join the waitlist<\/a>/i,
    target: /No paid offer is open/i,
    scope: /No Blizzard authorization is claimed or documented/i,
  },
  {
    file: 'fr/compare.html',
    cta: /href="\.\/buy\.html"[^>]*data-cta-id="compare-reserve">Rejoindre la liste d’attente<\/a>/i,
    bar: /data-cta-id="mbar-reserve">Rejoindre la liste d’attente<\/a>/i,
    target: /Aucune offre payante/i,
    scope: /Aucune autorisation de Blizzard n'est revendiquée ni documentée/i,
  },
]) {
  const html = read(item.file);
  check(item.file + ' : CTA principal vers le statut d’achat', item.cta.test(html));
  check(item.file + ' : barre mobile = statut, pas achat', item.bar.test(html));
  check(item.file + ' : prix explicitement une réservation bêta, pas une licence immédiate', item.target.test(html));
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



// Search previews and structured data must describe the beta reservation accurately.
for (const file of ['index.html', 'fr/index.html', 'buy.html', 'fr/buy.html']) {
  const html = read(file);
  const head = html.slice(0, html.indexOf('</head>'));
  check(file + ' : aperçu social décrit correctement l’offre bêta',
    /<meta property="og:type" content="website">/.test(head) &&
    /No paid offer|Aucune offre payante|pas de paiement/i.test(head));
  check(file + ' : aucun prix ou offre dans les données structurées',
    !/"@type"\s*:\s*"Offer"|"offers"\s*:/i.test(head) &&
    !/"@type"\s*:\s*"Product"/i.test(head) &&
    /"@type"\s*:\s*"WebPage"/i.test(head));
}
for (const [file, noPaymentClaim, noPriceQuestion] of [
  ['index.html', /After the payment provider confirms|licence key and the download link are sent by email/i, /What do I get for 20,00 €\?/i],
  ['fr/index.html', /Après confirmation du paiement|la clé de licence et le lien de téléchargement sont envoyés par e-mail/i, /Qu’est-ce que j’ai pour 20,00 €\?/i],
]) {
  const html = read(file);
  check(file + ' : aucune promesse de livraison après paiement', !noPaymentClaim.test(html));
  check(file + ' : aucune FAQ ne promet une licence immédiate à 20 €', !noPriceQuestion.test(html));
  check(file + ' : le héros affiche le prix d’entrée', /hero__price-value">9,00 €/i.test(html));
  check(file + ' : démo explicitement simulée', /simulated data|données simulées/i.test(html));
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
  check(file + ' : aucun formulaire de paiement ni collecte d’e-mail',
    !/id="buyForm"|id="buyBtn"|type="email"|buy\.stripe\.com/i.test(html) &&
    /mailto:support@bot-wow.com/.test(html));
}


// Home pages must present a project status and simulated demo, not a gameplay-automation offer.
for (const item of [
  {
    file: 'index.html',
    hero: /<h1 class="hero__title">[\s\S]*?Note the spot/i,
    notice: /EULA/i,
    price: /9,00 €/i,
    forbidden: /Unzip the package|paste your licence key|press F9|Automate my fishing|Refundable:/i,
  },
  {
    file: 'fr/index.html',
    hero: /<h1 class="hero__title">[\s\S]*?Noter le spot/i,
    notice: /EULA/i,
    price: /9,00 €/i,
    forbidden: /Décompressez le paquet|collez votre clé de licence|appuyez sur F9|Automatiser ma pêche|Remboursable\s*:/i,
  },
]) {
  const html = read(item.file);
  check(item.file + ' : titre principal annonce le statut du projet', item.hero.test(html));
  check(item.file + ' : avis indique le périmètre serveurs privés', item.notice.test(html));
  check(item.file + ' : prix de réservation 20 € affiché', item.price.test(html));
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
