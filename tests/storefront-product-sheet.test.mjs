#!/usr/bin/env node
/**
 * storefront-product-sheet.test.mjs — garde-fou de la fiche produit (#142).
 *
 * CONTEXTE
 * ---------
 * Le site BOT-WOW propose une reservation beta unique de 20 € ; le paquet n'est
 * pas encore distribue et la licence complete n'est pas disponible. Une "fiche
 * produit" type PixelBuddy risquerait de devenir une page de vente mensongere :
 * statut des modules transforme en "disponible", reservation presentee comme
 * une licence, licence oubliee, provenance cachee.
 *
 * CE QUE CE TEST VERIFIE (sur le code source, pas sur R2 ni sur un navigateur)
 * ---------------------------------------------------------------------------
 *  1. parite structurelle EN / FR (memes sections, memes modules, meme ordre) ;
 *  2. parite du registre : chaque module de assets/modules.json porte le bon
 *     data-module-status, le bon titre, le bon resume et le bon libelle de
 *     statut ; aucun module invente, aucun module oublie ;
 *  3. reserve commerciale : chaque module affiche en plus un pilier rouge
 *     "non distribue" ;
 *  4. reserve clients : la fiche ne pretend PAS qu'un client autre que Classic
 *     1.13 est teste — l'etat vient de assets/compat.json ;
 *  5. honnete commerciale : aucune promesse d'indetectabilite, d'anti-ban,
 *     de garantie, aucun faux avis, aucun compteur d'utilisateurs, aucun
 *     moyen de paiement ;
 *  6. honnete licence + provenance : les deux empreintes sont publiees, le
 *     manque de droits de redistribution est dit ;
 *  7. paiement sur la page d'achat : aucun formulaire, aucun POST, aucun champ
 *     e-mail sur la fiche produit elle-meme ;
 *  8. cablage : sitemap, scripts/build-site.mjs, scripts/validate.mjs et les
 *     pages d'entree (buy / features EN+FR) pointent vers la fiche ;
 *  9. liens et ancres internes de la fiche : aucun lien mort ;
 * 10. accessibilite de base et instrumentation des CTA.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FILES } from '../scripts/build-site.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
};

/* Normalisation : le HTML peut encoder les entities, la typographie peut
 * differer entre les pages du site. On compare le CONTENU, pas la ponctuation. */
const ENTITIES = { amp: String.fromCharCode(38), lt: String.fromCharCode(60), gt: String.fromCharCode(62), quot: String.fromCharCode(34), apos: String.fromCharCode(39), nbsp: String.fromCharCode(32), '#39': String.fromCharCode(39) };
function decodeEntities(s) {
  return String(s).replace(/&([a-z]+|#39);/g, (m, name) => ENTITIES[name] ?? m);
}
function norm(s) {
  return decodeEntities(String(s))
    .replace(/[\u2018\u2019]/g, String.fromCharCode(39))
    .replace(/[\u201C\u201D]/g, String.fromCharCode(34))
    .replace(/\s+/g, String.fromCharCode(32))
    .trim();
}
const stripTags = (s) => norm(String(s).replace(/<[^>]*>/g, ' '));

console.log('=== FICHE PRODUIT (#142) : parite, honnetete, cablage ===');

const registry = JSON.parse(read('assets/modules.json'));
const compat = JSON.parse(read('assets/compat.json'));

const PAGES = [
  { file: 'product.html', lang: 'en', hrefPrefix: './' },
  { file: 'fr/product.html', lang: 'fr', hrefPrefix: '../' },
];

/* Registre de reference pour la fiche. */
const REGISTRY_IDS = registry.modules.map((m) => m.id);
const STATUSES = registry.statuses || {};

/* 1 — parite structurelle EN / FR ---------------------------------------- */
const perLang = {};
for (const p of PAGES) {
  const html = read(p.file);
  const ids = [...html.matchAll(/data-module-id="([^"]+)"/g)].map((m) => m[1]);
  const sections = [...html.matchAll(/<section[^>]*\sid="([^"]+)"/g)].map((m) => m[1]);
  check(`${p.file} : declare la langue "${p.lang}"`, new RegExp(`<html lang="${p.lang}">`).test(html));
  check(`${p.file} : un seul h1`, (html.match(/<h1[\s>]/g) || []).length === 1);
  check(`${p.file} : lien d'evitement present`, /class="skip-link" href="#hero"/.test(html));
  check(`${p.file} : ancre #hero presente`, /<section[^>]*id="hero"/.test(html));
  check(`${p.file} : title et description non vides`,
    /<title>[^<]+<\/title>/.test(html) && /<meta name="description" content="[^"]+"/.test(html));
  check(`${p.file} : canonical + variantes de langue`,
    new RegExp(`<link rel="canonical" href="https://bot-wow\\.com/${p.lang === 'fr' ? 'fr/' : ''}product\\.html">`).test(html) &&
    /<link rel="alternate" hreflang="en" href="https:\/\/bot-wow\.com\/product\.html">/.test(html) &&
    /<link rel="alternate" hreflang="fr" href="https:\/\/bot-wow\.com\/fr\/product\.html">/.test(html));
  check(`${p.file} : les modules du registre sont presents, dans l'ordre, et aucun de plus`,
    JSON.stringify(ids) === JSON.stringify(REGISTRY_IDS),
    `(page : ${ids.join(',')} | registre : ${REGISTRY_IDS.join(',')})`);
  check(`${p.file} : sections attendues presentes`,
    ['hero', 'what-it-is', 'modules', 'package', 'audit', 'availability', 'questions']
      .every((s) => sections.includes(s)), `(${sections.join(',')})`);
  check(`${p.file} : chaque section porte un titre`,
    (html.match(/<section[\s\S]*?<\/section>/g) || [])
      .every((s) => /<h[12][\s>]/.test(s)));
  check(`${p.file} : la nav marque la page courante`,
    /<a href="\.\/product\.html" aria-current="page">/.test(html));
  check(`${p.file} : barre mobile presente et etiquettee`,
    /<div class="mbar" role="region" aria-label="(Purchase status|Statut de disponibilité)">/.test(html));
  perLang[p.lang] = { html, ids, sections };
}
check('EN / FR : memes sections, meme ordre',
  JSON.stringify(perLang.en.sections) === JSON.stringify(perLang.fr.sections),
  `(${perLang.en.sections.join(',')} | ${perLang.fr.sections.join(',')})`);

/* 2 + 3 — parite du registre et reserve commerciale ---------------------- */
for (const p of PAGES) {
  const html = perLang[p.lang].html;
  for (const mod of registry.modules) {
    const label = STATUSES[mod.status]?.[p.lang] || '';
    const rowRe = new RegExp(
      `<div class="modrow" data-module-id="${mod.id}" data-module-status="${mod.status}">([\\s\\S]*?)\\n    </div>`,
    );
    const row = (html.match(rowRe) || ['', ''])[1];
    check(`${p.file} : module "${mod.id}" — ligne presente avec le statut du registre`,
      row.length > 0, `(data-module-status attendu : ${mod.status})`);
    if (!row) continue;
    const rowText = stripTags(row);
    check(`${p.file} : module "${mod.id}" — titre identique au registre`,
      rowText.includes(norm(mod.title[p.lang])),
      `(attendu : ${norm(mod.title[p.lang])})`);
    check(`${p.file} : module "${mod.id}" — resume identique au registre`,
      rowText.includes(norm(mod.summary[p.lang])),
      `(attendu : ${norm(mod.summary[p.lang]).slice(0, 80)})`);
    check(`${p.file} : module "${mod.id}" — libelle de statut du registre (${label})`,
      rowText.includes(norm(label)), `(attendu : ${label})`);
    check(`${p.file} : module "${mod.id}" — reserve commerciale "non distribue"`,
      p.lang === 'en'
        ? /not distributed|not in a customer release/i.test(rowText)
        : /non distribu|absent d'une release client/i.test(rowText));
  }
  /* La fiche doit dire, en clair, qu'aucun module n'est distribue. */
  const flat = stripTags(html);
  check(`${p.file} : la page declare qu'aucun module n'est distribue`,
    p.lang === 'en'
      ? /no module is distributed to customers today/i.test(flat)
      : /aucun module n'est distribué aux clients aujourd'hui/i.test(flat));
}

/* 4 — reserve clients, pilotee par assets/compat.json --------------------- */
{
  const classic = compat.records.find((r) => r.id === 'classic-era');
  check('compat.json : Classic Era n\'a ni serveur ni date de test',
    classic && classic.server === null && classic.test_date === null,
    `(statut : ${classic?.status})`);
  check('compat.json : Classic Era est "historical_unverified"',
    classic && classic.status === 'historical_unverified');
  const en = stripTags(perLang.en.html);
  const fr = stripTags(perLang.fr.html);
  check('product.html : la fiche reprend le statut public "historical, unverified"',
    /historical, unverified/i.test(en));
  check('fr/product.html : la fiche reprend le statut public "historique, non vérifié"',
    /historique, non vérifié/i.test(fr));
  check('product.html : la fiche renvoie vers la matrice de compatibilité',
    /href="\.\/compatibility\.html"/.test(perLang.en.html));
  check('fr/product.html : la fiche renvoie vers la matrice de compatibilité',
    /href="\.\/compatibility\.html"/.test(perLang.fr.html));
  check('product.html : aucune version serveur n\'est affirmee comme confirmee',
    !/no version is confirmed|version confirmed|supported server/i.test(en) || /no version is confirmed/i.test(en));
  check('product.html : aucun client autre que Classic 1.13 n\'est presente comme teste',
    !/retail[^.]{0,80}(supported|tested|available|confirmed|offered)/i.test(en) &&
    !/(supported|tested|available|confirmed|offered)[^.]{0,80}retail/i.test(en));
  check('fr/product.html : aucun client autre que Classic 1.13 n\'est presente comme teste',
    !/retail[^.]{0,80}(pris en charge|teste|disponible|confirmé|proposé)/i.test(fr) &&
    !/(pris en charge|testé|disponible|confirmé|proposé)[^.]{0,80}retail/i.test(fr));
}

/* 5 — honnete commerciale ----------------------------------------------- */
for (const p of PAGES) {
  const flat = stripTags(perLang[p.lang].html);
  check(`${p.file} : aucune promesse d'indetectabilite ou d'anti-ban`,
    !/undetectable|indétectable|anti-?ban|anti-?triche|safe from sanctions|à l'abri de sanctions/i.test(flat));
  check(`${p.file} : aucune garantie ni urgence artificielle`,
    !/\bguarantee[ds]?\b|\bgaranti[ei]?[se]?s?\b|24\/7|sans risque|no risk/i.test(flat));
  check(`${p.file} : aucun faux avis, note ou temoignage`,
    !/\breviews?\b|\bavis d'un client|\btestimonials?\b|\btémoignages?\b|\b[45](?:[.,]\d)?\s*\/\s*5\b|\bstars?\b|\bnotations?\b/i.test(flat));
  check(`${p.file} : aucun compteur d'utilisateurs invente`,
    !/\b\d[\d\s.,]*\s*(users|players|customers|joueurs|clients|utilisateurs)\b/i.test(flat));
  check(`${p.file} : aucun prestataire de paiement alternatif non autorise`,
    !/\bMollie\b|\bBitcoin\b|\bPayPal\b|\bcredit card\b|\bcarte bancaire\b|\bcarte de crédit\b/i.test(flat));
  check(`${p.file} : pas de promesse de garantie de disponibilite`,
    !/available now|disponible maintenant|download now|téléchargez maintenant/i.test(flat));
  check(`${p.file} : la lecture memoire et l'injection sont explicitement refusees`,
    /reading memory or injecting into the game process are permanent refusals/i.test(flat) ||
    /la lecture mémoire et l'injection dans le processus du jeu sont des refus permanents/i.test(flat));
  check(`${p.file} : la fiche ne presente pas la peche comme le produit complet`,
    /one product, eight modules|un produit, huit modules/i.test(flat));
  check(`${p.file} : la licence et l'activation ne sont pas vendues`,
    !/licence key included|clé de licence incluse|activation included|activation incluse/i.test(flat));
}

/* 6 — licence et provenance --------------------------------------------- */
const PROVENANCE = {
  repo: 'aveca/Casinobabe',
  commit: '257418c9a0c2c489a01226e8065ac9c8eaded954',
  reproducible: '526E5CBDF12B0DFC9E474AE5CF26E68CAB42B9904E31279ADF0A57E7DA074D90',
  live: '1C132F367607EA186FEFFDE8BBDA0A1A9F94CDEC4B7850B93C57C271270BBA4F',
  digest: '79dc1ccaf3564d40e40bb3180602ead52ac529f68724f89ca05d6751e092b2f4',
};
for (const p of PAGES) {
  const flat = stripTags(perLang[p.lang].html);
  check(`${p.file} : depot source identifie`, flat.includes(PROVENANCE.repo));
  check(`${p.file} : commit source complet publie`, flat.includes(PROVENANCE.commit));
  check(`${p.file} : SHA-256 du paquet reproductible publie`, flat.includes(PROVENANCE.reproducible));
  check(`${p.file} : empreinte canonique publiee`, flat.includes(PROVENANCE.digest));
  check(`${p.file} : l'artefact de livraison configure est publie (et signale non reproductible)`,
    flat.includes(PROVENANCE.live) && /not reproducible|non reproductible/i.test(flat));
  check(`${p.file} : les droits confirmés par le propriétaire sont dits`,
    p.lang === 'en'
      ? /redistribution rights were confirmed by the owner/i.test(flat)
      : /droits de redistribution ont été confirmés par le propriétaire/i.test(flat));
  check(`${p.file} : aucune licence distribution n'est inventee`,
    !/MIT licence|licence MIT|Apache-2\.0|GPL/i.test(flat));
}

/* 7 — paiement sur la page d'achat, jamais sur la fiche ------------------ */
for (const p of PAGES) {
  const html = perLang[p.lang].html;
  check(`${p.file} : le paiement se fait sur la page d'achat, pas sur la fiche`,
    !/<form\b/i.test(html) && !/id="buyForm"|id="buyBtn"/i.test(html));
  check(`${p.file} : aucune requete POST`, !/method="post"|method='post'|fetch\([^)]*method:\s*['"]post/i.test(html));
  check(`${p.file} : la fiche elle-même ne collecte pas d'e-mail`, !/type="email"/i.test(html));
  check(`${p.file} : le prix de reservation 20,00 EUR est explicite`,
    /20,00\s?€/.test(html) && /20,00 €/.test(html) &&
    (p.lang === 'en' ? /beta reservation/i.test(stripTags(html)) : /réservation bêta/i.test(stripTags(html))));
  check(`${p.file} : serveurs privés explicites`,
    /private servers|serveurs privés/i.test(html));
  check(`${p.file} : aucun CTA ne pointe vers un paiement`,
    !/<a[^>]+href="[^"]*(?:checkout|payment|payer|paiement)[^"]*"/i.test(html));
}

/* 7b — reservation beta active, livraison et remboursement ---------------- */
for (const p of PAGES) {
  const html = perLang[p.lang].html;
  const flat = stripTags(html);
  const en = p.lang === 'en';
  check(p.file + ' : la reservation beta de 20 € est clairement ouverte',
    en ? /beta reservation is open on the buy page/i.test(flat) : /réservation bêta ouverte sur la page d'achat/i.test(flat));
  check(p.file + " : le CTA renvoie vers la page d'achat",
    html.includes('href="./buy.html"') && (en ? flat.includes('Reserve beta — €20') : flat.includes('Réserver la bêta — 20 €')));
  check(p.file + ' : aucun téléchargement immediat ni activation promis',
    en ? /no immediate download|does not include an immediate download/i.test(flat) : /pas de téléchargement immédiat|ni téléchargement immédiat/i.test(flat));
  check(p.file + ' : livraison manuelle apres validation finale annoncee',
    en ? /delivery is manual by email after final validation|manual delivery after final validation/i.test(flat) : /livraison est manuelle après validation finale|livraison manuelle après validation finale/i.test(flat));
  check(p.file + ' : remboursement integral si livraison impossible annonce',
    en ? /fully refunded if delivery is impossible/i.test(flat) : /intégralement remboursée/i.test(flat));
  check(p.file + ' : aucun prix historique presente comme offre',
    !flat.includes('historical target price') && !flat.includes('not an offer') && !flat.includes('prix cible historique') && !flat.includes('pas une offre') && !flat.includes('licence de pêche à vie'));
}
{
  const enTerms = read('legal/terms.html');
  const frTerms = read('legal/fr/terms.html');
  check('legal/terms.html : description SEO de la reservation beta',
    enTerms.includes('beta reservation') && !enTerms.includes('lifetime fishing licence'));
  check('legal/fr/terms.html : description SEO de la reservation beta',
    frTerms.includes('réservation bêta') && !frTerms.includes('licence de pêche à vie'));
}
/* 7c — coherence des autres langues de la fiche -------------------------- */
const LOCALIZED_PRODUCT_PAGES = [
  { file: 'de/product.html', keyword: 'reservierung', price: 'Beta-Reservierung · 20,00 €' },
  { file: 'es/product.html', keyword: 'reserva', price: 'Reserva de la beta · 20,00 €' },
  { file: 'pt-br/product.html', keyword: 'reserva', price: 'Reserva da beta · 20,00 €' },
  { file: 'ru/product.html', keyword: 'резервирование', price: 'Бронь беты · 20,00 €' },
  { file: 'it/product.html', keyword: 'prenotazione', price: 'Prenotazione beta · 20,00 €' },
  { file: 'pl/product.html', keyword: 'rezerwacja', price: 'Rezerwacja bety · 20,00 €' },
];
for (const p of LOCALIZED_PRODUCT_PAGES) {
  const html = read(p.file);
  const descriptionLine = html.split('\n').find((line) => line.includes('<meta name="description"')) || '';
  check(p.file + ' : description SEO annonce la reservation beta',
    descriptionLine.toLowerCase().includes(p.keyword) && descriptionLine.includes('20')) ;
  check(p.file + ' : aucun prix de licence a vie dans la fiche',
    !html.includes('Lifetime · 20,00 €') && !descriptionLine.toLowerCase().includes('lifetime'));
  check(p.file + ' : le prix affiche est libelle comme reservation beta',
    html.includes(p.price));
}

/* 8 — cablage : sitemap, build, validate, pages d'entree ------------------ */
check('scripts/build-site.mjs : product.html est publie',
  FILES.includes('product.html'));
check('scripts/validate.mjs : product.html est une page publique',
  /"product\.html"/.test(read('scripts/validate.mjs')));
check('scripts/validate.mjs : fr/product.html est une page publique',
  /"fr\/product\.html"/.test(read('scripts/validate.mjs')));
{
  const sitemap = read('sitemap.xml');
  check('sitemap.xml : les deux variantes de la fiche sont declarees',
    /<loc>https:\/\/bot-wow\.com\/product\.html<\/loc>/.test(sitemap) &&
    /<loc>https:\/\/bot-wow\.com\/fr\/product\.html<\/loc>/.test(sitemap));
  check('sitemap.xml : les variantes de langue sont croisees',
    /hreflang="fr" href="https:\/\/bot-wow\.com\/fr\/product\.html"/.test(sitemap) &&
    /hreflang="en" href="https:\/\/bot-wow\.com\/product\.html"/.test(sitemap));
}
for (const [file, target, forbiddenAnchors] of [
  ['buy.html', './product.html', '#offre'],
  ['fr/buy.html', './product.html', '#offre'],
  ['features.html', './product.html', '#offre|#buy'],
  ['fr/features.html', './product.html', '#offre|#buy'],
]) {
  const html = read(file);
  check(`${file} : renvoie vers la fiche produit`, html.includes(`href="${target}"`));
  check(`${file} : le lien de statut d'achat reste present`,
    /href="\.\/buy\.html"/.test(html) || /href="#buy"/.test(html));
  check(`${file} : aucune ancre commerciale morte (${forbiddenAnchors})`,
    !new RegExp(`href=["'][^"']*${forbiddenAnchors}`, 'i').test(html));
}

/* 9 — liens et ancres internes de la fiche -------------------------------- */
{
  const pages = [];
  for (const f of FILES) {
    if (f.endsWith('.html') && fs.existsSync(path.join(REPO, f))) pages.push(f);
  }
  for (const d of ['fr', 'docs', 'legal']) {
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
  const anchorMap = new Map();
  for (const p of pages) {
    const html = fs.readFileSync(path.join(REPO, p), 'utf8');
    const ids = new Set();
    for (const m of html.matchAll(/\sid="([^"]+)"/g)) ids.add(m[1]);
    for (const m of html.matchAll(/\sname="([^"]+)"/g)) ids.add(m[1]);
    anchorMap.set(p, ids);
  }
  const resolve = (from, raw) => {
    const dir = path.posix.dirname(from);
    const target = raw.split('?')[0];
    let key = path.posix.normalize(path.posix.join(dir, target));
    if (!key || key === '.') key = 'index.html';
    else {
      const abs = path.join(REPO, key);
      if (fs.existsSync(abs) && fs.statSync(abs).isDirectory()) key = path.posix.join(key, 'index.html');
      else if (!fs.existsSync(abs) && fs.existsSync(path.join(REPO, key + '.html'))) key += '.html';
      else if (!fs.existsSync(abs) && fs.existsSync(path.join(REPO, key, 'index.html'))) key = path.posix.join(key, 'index.html');
    }
    return key;
  };
  for (const p of PAGES) {
    const broken = [];
    for (const m of perLang[p.lang].html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
      const raw = m[1].trim();
      if (!raw || /^(https?:|mailto:|tel:|data:|javascript:)/i.test(raw)) continue;
      const [rawTarget, anchor] = raw.split('#');
      const target = rawTarget.split('?')[0];
      if (target === '') {
        if (anchor && !anchorMap.get(p.file).has(anchor)) broken.push(raw);
        continue;
      }
      const key = resolve(p.file, target);
      if (!fs.existsSync(path.join(REPO, key))) { broken.push(raw); continue; }
      if (anchor) {
        const ids = anchorMap.get(key);
        if (ids && !ids.has(anchor)) broken.push(raw);
      }
    }
    check(`${p.file} : aucun lien ni ancre interne mort`, broken.length === 0, `(${broken.join(' | ')})`);
  }
}

/* 10 — accessibilite et instrumentation ---------------------------------- */
for (const p of PAGES) {
  const html = perLang[p.lang].html;
  check(`${p.file} : le tableau d'audit a un thead et des th`,
    /<table class="vs">\s*<thead>/.test(html) && /<th[^>]*>/.test(html));
  check(`${p.file} : les questions utilisent details/summary`,
    /<details class="qa"><summary>/.test(html));
  check(`${p.file} : aucune image sans alternative`,
    !/<img\b(?![^>]*\balt=)/i.test(html));
  check(`${p.file} : les CTA sont instrumentes avec un evenement nomme`,
    /data-track="cta_click"/.test(html));
  const tracked = [...html.matchAll(/data-track="([a-z_]+)"[^>]*data-cta-id="([a-z0-9-]+)"/g)];
  check(`${p.file} : tous les evenements sont "cta_click"`,
    tracked.length > 0 && tracked.every(([, ev]) => ev === 'cta_click'));
  check(`${p.file} : identifiants de CTA en minuscules, sans espace`,
    tracked.every(([, , id]) => /^[a-z0-9-]+$/.test(id)));
  check(`${p.file} : aucune donnee personnelle dans le suivi`,
    ![...html.matchAll(/data-(?:track|cta-id)="([^"]*)"/g)]
      .some(([, v]) => /@|mailto|user|email|name/i.test(v)));
  check(`${p.file} : aucun CTA vers un domaine tiers`,
    ![...html.matchAll(/<a[^>]+class="[^"]*btn[^"]*"[^>]+href="([^"]+)"/g)]
      .some(([, h]) => /^[a-z]+:\/\//i.test(h) && !/^mailto:/i.test(h)));
  check(`${p.file} : la fiche renvoie vers le statut d'achat`,
    /href="\.\/buy\.html"/.test(html));
}

console.log(failures === 0 ? '\nFICHE PRODUIT : OK' : `\nFICHE PRODUIT : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
