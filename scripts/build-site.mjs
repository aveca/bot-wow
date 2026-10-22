/* build-site.mjs — assemble le site statique publie.
 *
 * PROBLEME CORRIGE (2026-10-22) : le projet Cloudflare Pages "bot-wow"
 * (qui sert le domaine bot-wow.com) avait un build command VIDE et un
 * output directory a la RACINE du depot : il publiait donc le code du
 * Worker (worker/index.js, 230 Ko), package.json, wrangler.toml et les
 * migrations SQL. Le domaine exposait le code source et les secrets de
 * deploiement.
 *
 * Ce script construit un artefact _site/ qui ne contient QUE le site
 * statique : aucune source, aucun secret, aucune migration.
 *
 * Usage : node scripts/build-site.mjs [dossier sortie]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(ROOT, process.argv[2] || '_site');

/* Fichiers racine publies. */
const FILES = [
  'index.html', 'demo.html', 'compare.html', 'modules.html', 'features.html',
  'fishing.html', 'getting-started.html', 'compatibility.html', 'roadmap.html',
  'faq.html', 'success.html', 'cancel.html', '404.html',
  'robots.txt', 'sitemap.xml', 'version.txt', '.nojekyll', '_headers',
];

/* Repertoires publies recursivement. */
const DIRS = ['assets', 'docs', 'legal', 'fr'];

/* Motifs de fichiers JAMAIS publies (meme s'ils se trouvaient dans un
   repertoire publie) : secrets, sources, migrations, sauvegardes. */
const DENY = [
  /\.env(\.|$)/i,
  /(^|\/)\.wrangler(\/|$)/i,
  /(^|\/)backups?(\/|$)/i,
  /(^|\/)worker(\/|$)/i,
  /(^|\/)migrations?(\/|$)/i,
  /(^|\/)scripts(\/|$)/i,
  /(^|\/)tests?(\/|$)/i,
  /(^|\/)node_modules(\/|$)/i,
  /\.(map|ts|sql|py|mjs|cjs)$/i,
  /(^|\/)package(-lock)?\.json$/i,
  /(^|\/)wrangler\.toml$/i,
  /(^|\/)README/i,
  /(^|\/)SECURITY/i,
];

function denied(rel) {
  const p = rel.replace(/\\/g, '/');
  return DENY.some((re) => re.test(p));
}

function copyDir(src, dest, rel = '') {
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const childRel = rel ? `${rel}/${entry.name}` : entry.name;
    if (denied(childRel)) continue;
    const from = path.join(src, entry.name);
    const to = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(to, { recursive: true });
      copyDir(from, to, childRel);
    } else if (entry.isFile()) {
      fs.mkdirSync(path.dirname(to), { recursive: true });
      fs.copyFileSync(from, to);
    }
  }
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

let count = 0;
for (const f of FILES) {
  const from = path.join(ROOT, f);
  if (!fs.existsSync(from)) { console.log(`  ignore (absent) : ${f}`); continue; }
  fs.copyFileSync(from, path.join(OUT, f));
  count++;
}
for (const d of DIRS) {
  const from = path.join(ROOT, d);
  if (!fs.existsSync(from)) { console.log(`  ignore (absent) : ${d}/`); continue; }
  copyDir(from, path.join(OUT, d));
  count++;
}

const listed = fs.readdirSync(OUT).sort();
console.log(`Artefact construit : ${path.relative(ROOT, OUT)}/`);
console.log(`  ${count} entree(s) de premier niveau`);
console.log(`  racine : ${listed.join(', ')}`);

/* Controle de securite : rien d'interdit ne doit se trouver dans
   l'artefact. Verifie, ne suppose pas. */
const bad = [];
(function walk(dir, rel = '') {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (denied(r)) { bad.push(r); continue; }
    if (e.isDirectory()) walk(path.join(dir, e.name), r);
  }
})(OUT);
if (bad.length) {
  console.error(`\nECHEC : ${bad.length} fichier(s) interdit(s) dans l'artefact : ${bad.join(', ')}`);
  process.exit(1);
}
console.log('  securite : aucun fichier interdit dans l\'artefact');
