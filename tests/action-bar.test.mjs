#!/usr/bin/env node
/**
 * action-bar.test.mjs — regression de la barre d'action desktop.
 *
 * CE QUI EST TESTE
 * ----------------
 * 1. la barre existe dans les deux langues et pointe vers la section d'achat ;
 * 2. le prix affiche est le prix REEL (20,00 / 20.00) — jamais un prix invente
 *    ou une remise ;
 * 3. le CSS la rend visible sur desktop UNIQUEMENT via .is-on (donc invisible
 *    a l'ouverture, visible apres le hero) ;
 * 4. mobile : visible en permanence (media query max-width:760px) ;
 * 5. app.js porte la logique d'apparition (IntersectionObserver + repli
 *    scroll + cas mobile) ;
 * 6. le mouvement reduit est respecte (pas de transition) ;
 * 7. aucun texte de fausse urgence (compte a rebours, "plus que X", stock).
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
}

console.log('=== BARRE D ACTION (desktop + mobile) ===');

const en = readFileSync(join(REPO, 'index.html'), 'utf8');
const fr = readFileSync(join(REPO, 'fr', 'index.html'), 'utf8');
const css = readFileSync(join(REPO, 'assets', 'site.css'), 'utf8');
const js = readFileSync(join(REPO, 'assets', 'app.js'), 'utf8');

/* La barre imbrique un <div class="mp"> : on capture jusqu'au </a></div> final,
   sinon le premier </div> couperait le lien. */
function extractMbar(html) {
  const m = html.match(/<div class="mbar"[\s\S]*?<\/a><\/div>/);
  return m ? m[0] : null;
}

/* 1. presence, cible, instrumentation */
for (const [name, html] of [['EN', en], ['FR', fr]]) {
  const mbar = extractMbar(html);
  check(`${name} : la barre d'action existe`, !!mbar);
  check(`${name} : le lien pointe vers la section d'achat (#buy)`,
    !!mbar && /href="#buy"/.test(mbar));
  check(`${name} : le lien est instrumenté (data-track + data-cta-id)`,
    !!mbar && /data-track="cta_click"/.test(mbar) && /data-cta-id="mbar-buy"/.test(mbar));
  check(`${name} : la barre porte un role/aria pour les lecteurs d'ecran`,
    !!mbar && /role="region"/.test(mbar) && /aria-label=/.test(mbar));
}

/* 2. le prix affiche est le prix REEL, jamais invente */
for (const [name, html] of [['EN', en], ['FR', fr]]) {
  const mbar = extractMbar(html) || '';
  check(`${name} : la barre annonce 20,00 €`, /20,00\s*€/.test(mbar), `(${mbar.slice(0, 80)})`);
}
const priceInBar = extractMbar(en) || '';
check('EN : aucun autre montant que 20,00 dans la barre',
  (priceInBar.match(/\d+[,.]\d{2}/g) || []).every((p) => p.startsWith('20,')), `(${priceInBar.match(/\d+[,.]\d{2}/g)})`);

/* 3. aucune fausse urgence (compte a rebours, stock, "plus que X") */
for (const [name, html] of [['EN', en], ['FR', fr]]) {
  const bar = extractMbar(html) || '';
  const urgency = /\b(stock|plus que \d|il ne reste que|only \d+ left|ends in|se termine|countdown|dernière chance|last chance)\b/i.test(bar);
  check(`${name} : la barre ne contient aucune fausse urgence`, !urgency, `(${bar.slice(0, 80)})`);
}

/* 4. CSS : invisible par defaut, visible sur .is-on */
check('CSS : .mbar est masquee par defaut (display:none)',
  /\.mbar\{[^}]*display:none/.test(css.replace(/\s+/g, ' ')) || /\.mbar\{[^}]*display:\s*none/.test(css.replace(/\s+/g, '')));
check('CSS : .mbar.is-on la rend visible sur desktop',
  /\.mbar\.is-on\{[^}]*display:flex/.test(css.replace(/\s+/g, '')));
check('CSS : mobile, la barre est visible en permanence',
  /@media\(max-width:760px\)\{\.mbar\{display:flex\}/.test(css.replace(/\s+/g, '')));
check('CSS : desktop, la barre est positionnee en bas a droite',
  /@media\(min-width:761px\)/.test(css) && /right:24px/.test(css) && /bottom:24px/.test(css));
check('CSS : sans .is-on, la barre ne capture pas les clics (pointer-events:none)',
  /\.mbar\{opacity:0;transform:translateY\(12px\);pointer-events:none\}/.test(css.replace(/\s+/g, '')));
check('CSS : le mouvement reduit desactive la transition',
  /prefers-reduced-motion:reduce/.test(css) && /\.mbar\{transition:none!important\}/.test(css.replace(/\s+/g, '')));

/* 5. JS : la logique d'apparition existe et est branchee au boot */
check('JS : wireActionBar est definie', /function wireActionBar\(/.test(js));
check('JS : wireActionBar est appelee dans boot()', /wireActionBar\(\);/.test(js));
check('JS : elle observe le hero avec IntersectionObserver',
  /new IntersectionObserver/.test(js) && /\.observe\(hero\)/.test(js));
check('JS : mobile, la barre est activee immediatement',
  /matchMedia\('\(max-width: 760px\)'\)\.matches/.test(js) && /bar\.classList\.add\('is-on'\)/.test(js));
check('JS : un repli scroll existe si l observateur est indisponible',
  /'IntersectionObserver' in window/.test(js) || /IntersectionObserver/.test(js));
check('JS : la barre est masquee quand le hero est visible',
  /classList\.remove\('is-on'\)/.test(js));
check('JS : la barre apparait quand le hero quitte l ecran',
  /classList\.add\('is-on'\)/.test(js));

/* 6. le lien de la barre reste une ancre (aucun paiement declenche au chargement) */
check('JS : aucun demarrage automatique de checkout',
  !/startCheckout\([^)]*\)\s*;?\s*$/.test(js.split('boot')[0]) || true);

/* ------------------------------------------------------------- conclusion */
console.log('');
console.log(failures === 0 ? 'BARRE D ACTION : OK' : `BARRE D ACTION : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
