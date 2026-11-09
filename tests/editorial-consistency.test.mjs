#!/usr/bin/env node
/**
 * editorial-consistency.test.mjs — garde-fou de coherence editoriale (#161).
 *
 * PROBLEME DEMONTRE : les pages publiques se contredisaient. La FAQ disait
 * correctement qu'aucun produit n'est propose, tandis que l'accueil et /buy
 * affichaient encore un prix de 20 EUR, des descriptions de fonctionnalites
 * presentees comme livrees et une reference a un paiement carte " live ".
 * Le titre FR de la FAQ etait identique au titre EN (non traduit), les pages
 * 404 n'avaient aucune meta description, et les conditions de vente
 * presentaient 20 EUR comme un prix payable.
 *
 * CE QUE CE TEST VERIFIE (source statique, aucun reseau) :
 *   1. la verite editoriale unique est presente sur TOUTES les pages
 *      principales : aucun produit offert, paiement ferme, demo simulee ;
 *   2. aucun prix n'est presente comme actuellement payable, sur aucune page
 *      privee ou publique (y compris juridique et donnees structurees) ;
 *   3. aucune affirmation de paiement actif (Mollie, carte, Bitcoin) ;
 *   4. aucune promesse interdite (indetectable, anti-ban, garantie) ;
 *   5. parite EN/FR : titres, descriptions, OG, hreflang, lang ;
 *   6. la demo est explicitement qualifiee de simulation ;
 *   7. les 404 portent une meta description.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FILES, DIRS } from '../scripts/build-site.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
};

/* ---------------------------------------------------- pages publiees */
const pages = [];
for (const f of FILES) if (f.endsWith('.html') && fs.existsSync(path.join(REPO, f))) pages.push(f);
for (const d of DIRS) {
  const base = path.join(REPO, d);
  if (!fs.existsSync(base)) continue;
  (function walk(dir, rel = '') {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) walk(path.join(dir, e.name), r);
      else if (e.name.endsWith('.html')) pages.push(`${d}/${r}`.replace(/\\/g, '/'));
    }
  })(base);
}
pages.sort();
console.log('=== COHERENCE EDITORIALE (aucune vente, aucun paiement) ===');

const strip = (h) => h
  .replace(/<script[\s\S]*?<\/script>/gi, ' ')
  .replace(/<style[\s\S]*?<\/style>/gi, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&#039;|&apos;/g, "'")
  .replace(/\s+/g, ' ');

/* ------------------------------------------------- 1. verite editoriale */
const TRUTH_PAGES = ['index.html', 'fr/index.html', 'buy.html', 'fr/buy.html',
  'faq.html', 'fr/faq.html', 'product.html', 'fr/product.html',
  'modules.html', 'fr/modules.html', 'compare.html', 'fr/compare.html',
  'features.html', 'fr/features.html', 'compatibility.html', 'fr/compatibility.html',
  'demo.html', 'fr/demo.html'];

const NO_SALE = /no (?:current )?(?:product|offer).{0,80}(?:offered|available)|not (?:currently )?offered for sale|purchase unavailable|no BOT-WOW product is currently offered|aucun produit .{0,60}(?:propos|offert)|n'est actuellement pas propos|achat indisponible|non commercialis|not for sale/i;
const NO_PAYMENT = /no payment can be (?:started|made)|aucun paiement ne peut|checkout is closed|checkout ferm|paiement ferm/i;
/* "simulation" (EN) comme "simulées" (FR) : /simul/ couvre les deux. */
const SIMULATED = /simul/i;
const NO_GAME = /does not connect|ne se connecte pas|no live gameplay|aucun jeu en direct|no game connection|ne contrôle aucun personnage|does not .{0,20}control a game/i;

for (const p of TRUTH_PAGES) {
  if (!pages.includes(p)) continue;
  const t = strip(read(p));
  check(`${p} : verite editoriale presente (aucune vente)`, NO_SALE.test(t) || NO_PAYMENT.test(t));
}

/* ------------------------------------------------- 2. aucun prix payable */
/* Un prix n'est acceptable que s'il est EXPLICITEMENT qualifie d'historique
   dans la meme zone de texte. */
const PRICE = /(?:EUR\s?20(?:[.,]00)?|20(?:[.,]00)?\s?(?:EUR|EUR))/i;
const HISTORICAL = /historique|historical|cible document|documented target|not an offer|pas une offre|no offer|aucune offre|r[ée]f[ée]rence historique|historical reference/i;
for (const p of pages) {
  const t = strip(read(p));
  const m = t.match(PRICE);
  if (!m) continue;
  const around = t.slice(Math.max(0, m.index - 220), m.index + 220);
  check(`${p} : tout prix affiche est qualifie d'historique`, HISTORICAL.test(around),
    `"${around.slice(0, 130).trim()}"`);
}

for (const p of ['legal/terms.html', 'legal/fr/terms.html']) {
  if (!pages.includes(p)) continue;
  const t = strip(read(p));
  const m = t.match(PRICE);
  if (!m) continue;
  const around = t.slice(Math.max(0, m.index - 40), m.index + 340);
  check(`${p} : le prix est explicitement une reference historique, pas une offre`,
    /r[ée]f[ée]rence historique|historical reference/i.test(around), `"${around.slice(0, 120).trim()}"`);
}

/* Les clauses de vente restent visibles uniquement comme archive historique. */
for (const p of ['legal/terms.html', 'legal/fr/terms.html']) {
  if (!pages.includes(p)) continue;
  const t = strip(read(p));
  const archived = p.includes('/fr/')
    ? /archive historique uniquement.*ne constituent pas des conditions commerciales ou contractuelles actuelles/i
    : /historical archive only.*not current commercial or contractual terms/i;
  check(`${p} : conditions clairement marquees comme archive non contractuelle`, archived.test(t));
  check(`${p} : aucune affirmation que l'offre est actuellement commercialisee`,
    !/page describes the offer currently on sale|page décrit l'offre actuellement commercialisée/i.test(t));
}

/* Les donnees structurees ne doivent jamais porter un prix actif. */
for (const p of pages) {
  const h = read(p);
  for (const m of h.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {
    let j = null;
    try { j = JSON.parse(m[1]); } catch { j = null; }
    if (!j) continue;
    const s = JSON.stringify(j);
    check(`${p} : donnees structurees sans prix actif`,
      !/"price"\s*:\s*"?20/i.test(s) && !/"availability"\s*:\s*"InStock"/i.test(s),
      s.slice(0, 100));
  }
}

/* ------------------------------------------------- 3. aucun paiement actif */
const ACTIVE_PAYMENT = [
  ['Mollie actif', /Payment by <b[^>]*>Mollie<\/b>|Paiement par <b[^>]*>Mollie<\/b>/i],
  ['carte live', /card\s+payment\s+is\s+live|paiement\s+par\s+carte\s+est\s+(?:live|actif|fonctionne)|carte\s+bancaire\s+(?:live|active|fonctionne)/i],
  ['Bitcoin live', /Bitcoin\s+(?:payment|checkout)\s+is\s+(?:live|available)|paiement\s+Bitcoin\s+(?:est\s+)?(?:actif|disponible)/i],
  ['redirection Mollie promise', /redirect(?:ed)?\s+to\s+Mollie|redirig\w*\s+vers\s+Mollie/i],
  ['livraison email en minutes', /(?:delivered|livr\w*)\s*(?:<[^>]*>)?\s*(?:by email|par e-?mail)\s+in minutes|livr\w*\s+par e-?mail\s+en quelques minutes/i],
];
for (const p of pages) {
  const flat = read(p).replace(/\s+/g, ' ');
  for (const [name, re] of ACTIVE_PAYMENT) {
    check(`${p} : aucun paiement presente comme actif (${name})`, !re.test(flat));
  }
}

/* ------------------------------------------------- 4. promesses interdites */
/* "anti-triche" apparait légitimement quand on AVERTIT que l'accord
   anti-triche de Blizzard interdit les logiciels tiers non autorisés. Ce qui
   est interdit, c'est de PRE TENDRE que notre logiciel y échappe. On vérifie
   donc le contexte : pas de promesse d'indétectabilité ni de mise en cause de
   l'anti-triche comme contournée. */
const FORBIDDEN = [
  ['indetectable', /undetectable|ind[ée]tectable/i],
  ['anti-ban / protection de compte', /anti-?ban|ban-?proof|safe\s+from\s+sanctions|[àa] l'abri de sanctions/i],
  ['garantie inconditionnelle', /100\s*%\s*(?:safe|s[ûu]r|guaranteed)|garanti\s+sans\s+risque|guaranteed\s+safe/i],
  ['temoignage / note client', /[★⭐]|\b[0-9](?:[.,][0-9])?\s*\/\s*5\b|\bnot\w*\s+client\b|\bverified\s+by\s+\d+\s+users\b/i],
];
for (const p of pages) {
  const flat = read(p).replace(/\s+/g, ' ');
  for (const [name, re] of FORBIDDEN) {
    const m = flat.match(re);
    check(`${p} : aucune promesse interdite (${name})`, !m,
      m ? `"${flat.slice(Math.max(0, m.index - 60), m.index + 80).trim()}"` : '');
  }
  /* "anti-triche" : acceptable seulement comme AVERTissement. */
  if (/anti-?triche|anti-?cheat/i.test(flat)) {
    const ok = /accord|agreement|charte|interdit|forbidden|forbids/i.test(flat);
    check(`${p} : "anti-triche" n'est utilise qu comme avertissement`, ok);
  }
}

/* ------------------------------------------------- 5. parite EN/FR */
const metaOf = (h, re) => (h.match(re) || [])[1] || '';
for (const p of pages) {
  const isFr = /^fr\//.test(p) || /\/fr\//.test(p);
  if (!isFr) continue;
  const en = p.replace(/^fr\//, '').replace(/\/fr\//, '/');
  if (!pages.includes(en)) continue;
  const frH = read(p);
  const enH = read(en);
  const frTitle = metaOf(frH, /<title>([\s\S]*?)<\/title>/i);
  const enTitle = metaOf(enH, /<title>([\s\S]*?)<\/title>/i);
  check(`${p} : titre non identique a sa version EN`, !!frTitle && !!enTitle && frTitle !== enTitle,
    `(FR "${frTitle}" == EN "${enTitle}")`);
  const frDesc = metaOf(frH, /<meta name="description" content="([^"]*)"/i);
  const enDesc = metaOf(enH, /<meta name="description" content="([^"]*)"/i);
  check(`${p} : meta description non identique a sa version EN`, !!frDesc && !!enDesc && frDesc !== enDesc);
  const frOg = metaOf(frH, /<meta property="og:title" content="([^"]*)"/i);
  const enOg = metaOf(enH, /<meta property="og:title" content="([^"]*)"/i);
  if (enOg) check(`${p} : og:title non identique a sa version EN`, !!frOg && frOg !== enOg);
  const frLang = metaOf(frH, /<html[^>]*lang="([^"]+)"/i);
  check(`${p} : langue fr declaree`, frLang === 'fr', `(${frLang})`);
}

/* ------------------------------------------------- 6. demo simulee */
for (const p of ['index.html', 'fr/index.html', 'demo.html', 'fr/demo.html', 'buy.html', 'fr/buy.html']) {
  if (!pages.includes(p)) continue;
  const t = strip(read(p));
  check(`${p} : la demo est explicitement qualifiee de simulation`, /simul/i.test(t));
  check(`${p} : la demo est dite sans connexion au jeu`, NO_GAME.test(t));
}

/* ------------------------------------------------- 7. meta description 404 */
for (const p of ['404.html', 'fr/404.html']) {
  if (!pages.includes(p)) continue;
  const h = read(p);
  check(`${p} : meta description presente`, !!metaOf(h, /<meta name="description" content="([^"]*)"/i));
  check(`${p} : meta robots noindex (page 404 non indexable)`,
    /<meta name="robots" content="noindex"/i.test(h));
}

/* ------------------------------------------------- 8. protection du code */
{
  const worker = read('worker/index.js');
  check('le Worker refuse le checkout tant que RELEASE_STATUS n est pas confirmed',
    /RELEASE_STATUS/.test(worker) && /delivery_unverified/.test(worker));
}

console.log('');
console.log(failures === 0 ? 'COHERENCE EDITORIALE : OK' : `COHERENCE EDITORIALE : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
