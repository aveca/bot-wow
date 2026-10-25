/* iter5-seo-payment-pages.mjs — SEO : les pages de résultat de paiement ne
   doivent pas être indexées.

   PROBLÈME MESURÉ (2026-10-23) : sitemap.xml listait `success.html` et
   `cancel.html` ; ces pages ne portaient AUCUN `meta robots` ; elles sont
   liées depuis toute la navigation (« Acheter », barre d'action mobile).
   Elles étaient donc proposées à l'indexation, susceptibles d'apparaître
   dans les résultats de recherche à la place de la page d'offre.
   `404.html` déclarait en outre une URL canonique vers elle-même, sans
   aucun sens sur une page d'erreur.

   Corrections (idempotent) :
     1. `noindex, follow` sur les pages de résultat de paiement et la 404
        (EN + FR) : les liens qui y mènent restent suivis, la page n'est pas
        indexée.
     2. Retrait du canonical/hreflang de `404.html` et `fr/404.html`.
     3. `sitemap.xml` : retrait de `success.html` / `cancel.html` (et leurs
        alternates FR), et ajout des alternates hreflang manquants sur les
        entrées docs/ et legal/ (les pages les déclarent déjà ; le sitemap
        doit être cohérent).

   Usage : node scripts/iter5-seo-payment-pages.mjs
*/
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://bot-wow.com';
const ROBOTS = '<meta name="robots" content="noindex, follow">';

const NOINDEX = [
  'success.html', 'cancel.html', '404.html',
  'fr/success.html', 'fr/cancel.html', 'fr/404.html',
];

/* page canonique => équivalent dans l'autre langue (hreflang). */
const ALT = {
  '': 'fr/', 'fr/': '',
  'features.html': 'fr/features.html', 'fr/features.html': 'features.html',
  'fishing.html': 'fr/fishing.html', 'fr/fishing.html': 'fishing.html',
  'demo.html': 'fr/demo.html', 'fr/demo.html': 'demo.html',
  'getting-started.html': 'fr/getting-started.html',
  'fr/getting-started.html': 'getting-started.html',
  'compatibility.html': 'fr/compatibility.html',
  'fr/compatibility.html': 'compatibility.html',
  'roadmap.html': 'fr/roadmap.html', 'fr/roadmap.html': 'roadmap.html',
  'modules.html': 'fr/modules.html', 'fr/modules.html': 'modules.html',
  'compare.html': 'fr/compare.html', 'fr/compare.html': 'compare.html',
  'faq.html': 'fr/faq.html', 'fr/faq.html': 'faq.html',
  'index.html': 'fr/index.html', 'fr/index.html': 'index.html',
  'docs/install.html': 'docs/fr/install.html',
  'docs/fr/install.html': 'docs/install.html',
  'docs/legal/terms.html': 'docs/fr/legal/terms.html',
  'docs/fr/legal/terms.html': 'docs/legal/terms.html',
  'docs/install.html': 'docs/fr/install.html',
  'docs/fr/install.html': 'docs/install.html',
  'docs/known-issues.html': 'docs/fr/known-issues.html',
  'docs/fr/known-issues.html': 'docs/known-issues.html',
  'docs/license.html': 'docs/fr/license.html',
  'docs/fr/license.html': 'docs/license.html',
  'docs/changelog.html': 'docs/fr/changelog.html',
  'docs/fr/changelog.html': 'docs/changelog.html',
};

function read(p) { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
function write(p, t) { fs.writeFileSync(path.join(ROOT, p), t, 'utf8'); }

function addRobots(html) {
  if (/<meta name="robots"/i.test(html)) return html;
  const headEnd = html.indexOf('</head>');
  if (headEnd === -1) return html;
  return html.slice(0, headEnd) + '\n' + ROBOTS + '\n' + html.slice(headEnd);
}

function removeCanonicalAndHreflang(html) {
  return html
    .replace(/<link rel="canonical"[^>]*>\s*/gi, '')
    .replace(/<link rel="alternate" hreflang="[^"]*"[^>]*>\s*/gi, '');
}

let changes = 0;

/* -------- 1. noindex,follow sur les pages de résultat de paiement + 404 --- */
for (const p of NOINDEX) {
  let html = read(p);
  const before = html;
  html = addRobots(html);
  if (p === '404.html' || p === 'fr/404.html') {
    html = removeCanonicalAndHreflang(html);
  }
  if (html !== before) { write(p, html); changes++; console.log('  maj : ' + p); }
}

/* -------- 2. sitemap.xml : cohérence langue et retrait des pages paiement -- */
let sm = read('sitemap.xml');

// 2a. supprimer toutes les entrées dont l'URL est une page de résultat de paiement
const payRe = /<url>[\s\S]*?<\/url>/g;
sm = sm.replace(payRe, (block) => {
  for (const p of NOINDEX) {
    if (block.includes(`<loc>${SITE}/${p}</loc>`)) return '';
  }
  return block;
});

// 2b. ajouter l'alternate hreflang manquant sur les entrées docs/ et legal/
const rootName = (u) => u.replace(`${SITE}/`, '');
for (const [page, frPage] of Object.entries(ALT)) {
  const enLoc = `${SITE}/${page}`;
  const frLoc = `${SITE}/${frPage}`;
  if (!sm.includes(`<loc>${enLoc}</loc>`)) continue;
  // si l'entrée existe déjà avec cet alternate, on saute
  const enBlockIdx = sm.indexOf(`<loc>${enLoc}</loc>`);
  const blockEnd = sm.indexOf('</url>', enBlockIdx);
  const block = sm.slice(enBlockIdx, blockEnd);
  if (block.includes(`hreflang="${frPage.split('/').pop() ? '' : 'fr'}"`)) continue;
  // Insérer un xhtml:link juste avant </url> de l'entrée en cours
  const lang = frPage.startsWith('fr/') ? 'fr' : 'en';
  const alt = `    <xhtml:link rel="alternate" hreflang="${lang}" href="${frLoc}"/>`;
  sm = sm.slice(0, blockEnd) + '\n' + alt + sm.slice(blockEnd);
}

if (sm !== read('sitemap.xml')) { write('sitemap.xml', sm); changes++; console.log('  maj : sitemap.xml'); }

console.log('\n' + changes + ' fichier(s) modifié(s).');
