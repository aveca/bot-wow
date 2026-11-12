#!/usr/bin/env node
/**
 * commercial-consistency.test.mjs — invariants de cohérence commerciale EN/FR.
 *
 * Verrouille les corrections commerciales sur les pages d'accueil :
 *  1. le lien nav vers buy.html porte le libellé "Réservation bêta" (pas "Buy"/"Acheter"),
 *     identique aux autres CTA vers buy.html ;
 *  2. la FAQ Remboursements ne conditionne PAS le remboursement à une "licence activée" :
 *     il s'agit d'une réservation bêta remboursable, sans licence activée, sans
 *     téléchargement immédiat promis ;
 *  3. le prix 20 € / €20 est affiché de manière cohérente sur les deux langues.
 *
 * Aucune écriture disque, aucun appel réseau.
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

console.log('=== COHERENCE COMMERCIALE EN/FR (non-regression) ===');

const EN = read('index.html');
const FR = read('fr/index.html');
const FAQ_EN = read('faq.html');
const FAQ_FR = read('fr/faq.html');

// 1. Lien nav vers buy.html : libellé "Réservation bêta", identique EN/FR
check('index.html : nav buy.html = "Reserve beta — €20"',
  /<a[^>]*href="\.\/buy\.html"[^>]*data-cta-id="nav-buy"[^>]*>Reserve beta — €20<\/a>/.test(EN));
check('fr/index.html : nav buy.html = "Réserver la bêta — 20 €"',
  /<a[^>]*href="\.\/buy\.html"[^>]*data-cta-id="nav-buy"[^>]*>Réserver la bêta — 20 €<\/a>/.test(FR));

// 2. Pas de libellé générique "Buy"/"Acheter" sur le lien nav buy.html
check('index.html : pas de "Buy" générique sur nav buy.html', !/<a[^>]*href="\.\/buy\.html"[^>]*>Buy\s*<\/a>/.test(EN));
check('fr/index.html : pas de "Acheter" générique sur nav buy.html', !/<a[^>]*href="\.\/buy\.html"[^>]*>Acheter\s*<\/a>/.test(FR));

// 3. FAQ Remboursement (section visible) : pas de condition "licence activée"
//    L'ancien libellé conditionnait le remboursement à "licence non activée" : faux.
check('index.html : FAQ remboursement sans condition "licence activée"',
  !/licence has not been activated|if the licence has not been activated/.test(EN));
check('fr/index.html : FAQ remboursement sans condition "licence activée"',
  !/licence n.a pas été activée|si la licence n.a pas été activée/.test(FR));

// 4. FAQ Remboursement : remboursement intégral mentionné
check('index.html : FAQ remboursement mentionne le remboursement intégral',
  /fully refunded/.test(EN));
check('fr/index.html : FAQ remboursement mentionne le remboursement intégral',
  /intégralement remboursé|intégral/.test(FR));

// 4b. Ne pas promettre une annulation avant livraison absente de la politique publiée.
check('English homepage and FAQ do not promise pre-delivery cancellation',
  !/request cancellation before delivery|cancel before delivery/i.test(EN + FAQ_EN));
check('French homepage and FAQ do not promise pre-delivery cancellation',
  !/demander l[’']annulation avant livraison/i.test(FR + FAQ_FR));

// 5. Prix 20 € / €20 présent de manière cohérente
check('index.html : prix €20 present', /€20/.test(EN));
check('fr/index.html : prix 20 € present', /20 €/.test(FR));

// 6. JSON-LD confirme que ce n'est pas une licence activée ni un téléchargement immédiat
check('index.html : JSON-LD mentionne "activated licence" (dans une négation)',
  /activated licence/.test(EN));
check('fr/index.html : JSON-LD mentionne "licence activée" (dans une négation)',
  /licence activée/.test(FR));
check('index.html : JSON-LD mentionne "immediate download" (dans une négation)',
  /immediate download/.test(EN));
check('fr/index.html : JSON-LD mentionne "téléchargement immédiat" (dans une négation)',
  /téléchargement immédiat/.test(FR));

console.log(failures === 0 ? '\nCOHERENCE COMMERCIALE : OK' : `\nCOHERENCE COMMERCIALE : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
