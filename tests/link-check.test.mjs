#!/usr/bin/env node
/**
 * link-check.test.mjs — aucun lien interne mort.
 *
 * Constat V11 : 74 liens du site pointaient vers l'ancre "#offre" sur
 * l'accueil, ancre qui n'existait pas. Tous ces CTA ("Buy — 20 EUR",
 * "Pricing") ouvraient l'accueil SANS jamais amener a l'offre : le
 * parcours de conversion etait donc coupe au bon endroit.
 *
 * Ce test verifie, sur le code source :
 *   1. chaque lien vers un fichier existe ;
 *   2. chaque ancre "#id" existe dans la page cible ;
 *   3. les liens internes ne pointent pas vers un fichier absent de
 *      l'artefact publie.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FILES, DIRS } from '../scripts/build-site.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
}

console.log('=== LIENS INTERNES (aucun lien mort) ===');

/* Toutes les pages HTML publiees (memes entrees que l'artefact). */
const pages = [];
for (const f of FILES) {
  if (f.endsWith('.html') && fs.existsSync(path.join(REPO, f))) pages.push(f);
}
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

/* Ancres declarees par page. */
const anchors = new Map();
for (const p of pages) {
  const html = fs.readFileSync(path.join(REPO, p), 'utf8');
  const ids = new Set();
  for (const m of html.matchAll(/\sid="([^"]+)"/g)) ids.add(m[1]);
  for (const m of html.matchAll(/\sname="([^"]+)"/g)) ids.add(m[1]);
  anchors.set(p, ids);
}

/* Verifie qu'un chemin de page existe et retourne sa cle canonique. */
function pageKey(p) {
  return p.replace(/^\.\//, '').replace(/^\.\.\//, '').replace(/\\/g, '/');
}

const brokenFiles = [];
const brokenAnchors = [];

for (const p of pages) {
  const html = fs.readFileSync(path.join(REPO, p), 'utf8');
  const dir = path.posix.dirname(p);

  for (const m of html.matchAll(/\s(?:href|src)="([^"]+)"/g)) {
    const raw = m[1].trim();
    if (!raw) continue;
    if (/^(https?:|mailto:|tel:|data:|javascript:)/i.test(raw)) continue; // externes

    const [rawTarget, anchor] = raw.split('#');
    // on ignore la query string (?v=stamp) pour la resolution du fichier
    const target = rawTarget.split('?')[0];

    if (target === '') {
      // ancre dans la meme page
      if (anchor && !anchors.get(p).has(anchor)) {
        brokenAnchors.push(`${p} -> #${anchor}`);
      }
      continue;
    }

    // resout le chemin relatif
    const joined = path.posix.normalize(path.posix.join(dir, target));
    const key = pageKey(joined);
    const withIndex = key.endsWith('/') ? `${key}index.html` : key;
    const exists = fs.existsSync(path.join(REPO, withIndex))
      || fs.existsSync(path.join(REPO, key));

    if (!exists) {
      brokenFiles.push(`${p} -> ${raw}`);
      continue;
    }

    // ancre dans la page cible
    if (anchor) {
      const targetKey = withIndex;
      const ids = anchors.get(targetKey);
      if (ids && !ids.has(anchor)) {
        brokenAnchors.push(`${p} -> ${raw} (ancre #${anchor} absente de ${targetKey})`);
      }
    }
  }
}

check(`aucun lien vers un fichier inexistant (${pages.length} pages verifiees)`,
  brokenFiles.length === 0, `(${brokenFiles.length} : ${brokenFiles.slice(0, 6).join(' | ')})`);
check('aucune ancre interne morte', brokenAnchors.length === 0,
  `(${brokenAnchors.length} : ${brokenAnchors.slice(0, 6).join(' | ')})`);

/* L'ancre historique "#offre" doit exister sur les deux accueils : 74
   liens du site en dependent. */
for (const home of ['index.html', 'fr/index.html']) {
  const ids = anchors.get(home);
  check(`${home} : l'ancre #offre existe`, ids.has('offre'));
  check(`${home} : l'ancre #buy existe`, ids.has('buy'));
}

/* Les liens vers l'accueil depuis les autres pages doivent viser une
   ancre reellement presente. */
{
  const links = [];
  for (const p of pages) {
    const html = fs.readFileSync(path.join(REPO, p), 'utf8');
    for (const m of html.matchAll(/href="([^"]*#offre)"/g)) links.push(`${p} -> ${m[1]}`);
  }
  check('les liens "#offre" sont presents et ciblees', links.length > 0, `(${links.length} liens)`);
}

/* Sitemap: toutes les variantes hreflang doivent être des URL listées,
   et chaque paire linguistique doit se référencer dans les deux sens. */
{
  const sitemap = fs.readFileSync(path.join(REPO, 'sitemap.xml'), 'utf8');
  const entries = [...sitemap.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]);
  const parsed = entries.map((block) => {
    const loc = block.match(/<loc>([^<]+)<\/loc>/)?.[1];
    const alternates = [...block.matchAll(/<xhtml:link\b[^>]*hreflang="([^"]+)"[^>]*href="([^"]+)"[^>]*\/?>/g)]
      .map((m) => ({ lang: m[1], href: m[2] }));
    return { loc, alternates };
  });
  const locs = new Set(parsed.map((entry) => entry.loc).filter(Boolean));
  check('sitemap: chaque hreflang pointe vers une URL déclarée', parsed.every((entry) =>
    entry.loc && entry.alternates.length >= 2 && entry.alternates.every((alt) => locs.has(alt.href))));
  check('sitemap: variantes linguistiques réciproques', parsed.every((entry) =>
    entry.alternates.every((alt) => {
      const target = parsed.find((candidate) => candidate.loc === alt.href);
      return target && target.alternates.some((back) => back.href === entry.loc);
    })));
  check('sitemap: aucune URL loc dupliquée', locs.size === parsed.length);
}

console.log(failures === 0 ? '\nLIENS INTERNES : OK' : `\nLIENS INTERNES : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
