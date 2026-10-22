/* versionne-assets.mjs — ajoute un stamp de version aux URLs d'assets.
 *
 * POURQUOI : Cloudflare Pages sert les assets par manifeste. Un fichier
 * qui existait deja dans un deploiement precedent peut rester resolu vers
 * l'ancien asset (cache/manifeste perime) alors qu'un fichier nouveau
 * est servi frais. Consequence observee en production : hero.css et
 * app.js restaient a l'ancienne version alors que premium.css etait a
 * jour -> le hero n'avait ni les boutons de mode, ni le balayage, ni le
 * ledger.
 *
 * Le stamp change la cle de cache : chaque URL d'asset devient unique
 * pour un jeu de fichiers donne. Le site est statique, donc un stamp par
 * livraison suffit.
 *
 * Usage : node scripts/versionne-assets.mjs [stamp]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const STAMP = process.argv[2] || new Date().toISOString().slice(0, 10).replace(/-/g, '');

// Fichiers servis au navigateur, versionnes.
const ASSETS = ['style.css', 'site.css', 'app.js', 'demo.js', 'route-planner.js', 'favicon.svg'];

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'backups' || e.name === '_site' || e.name === '.wrangler') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

let changed = 0;
const stampRe = new RegExp(`\\?v=[0-9a-zA-Z._-]+`);

// 1. HTML : assets/X -> assets/X?v=STAMP
for (const file of walk(ROOT)) {
  const rel = path.relative(ROOT, file);
  let t = fs.readFileSync(file, 'utf8');
  const before = t;
  for (const a of ASSETS) {
    // Reference deja versionnee ? On remplace le stamp existant.
    t = t.replace(new RegExp(`((?:\\.\\./|\\./)?assets/${a.replace('.', '\\.')})\\?v=[0-9a-zA-Z._-]+`, 'g'), `$1?v=${STAMP}`);
    // Reference sans stamp.
    t = t.replace(new RegExp(`((?:\\.\\./|\\./)?assets/${a.replace('.', '\\.')})(["'\\s>])`, 'g'), `$1?v=${STAMP}$2`);
  }
  if (t !== before) {
    fs.writeFileSync(file, t, 'utf8');
    changed++;
    console.log(`  versionne : ${rel}`);
  }
}

// 2. style.css : les @import pointent sur un fichier local (relatif a assets/)
{
  const p = path.join(ROOT, 'assets', 'style.css');
  let t = fs.readFileSync(p, 'utf8');
  const before = t;
  t = t.replace(/@import url\("([^"]+)"\)(?!;?\s*\*\/)/g, (m, url) => {
    if (stampRe.test(url)) return `@import url("${url.replace(stampRe, '?v=' + STAMP)}")`;
    return `@import url("${url}?v=${STAMP}")`;
  });
  if (t !== before) { fs.writeFileSync(p, t, 'utf8'); changed++; console.log('  versionne : assets/style.css'); }
}

// 3. modules ES : import depuis un fichier local
for (const name of ['app.js', 'demo.js']) {
  const p = path.join(ROOT, 'assets', name);
  if (!fs.existsSync(p)) continue;
  let t = fs.readFileSync(p, 'utf8');
  const before = t;
  t = t.replace(/from '(\.\/[a-z0-9-]+\.js)'/g, (m, url) =>
    stampRe.test(url) ? `from '${url.replace(stampRe, '?v=' + STAMP)}'` : `from '${url}?v=${STAMP}'`);
  if (t !== before) { fs.writeFileSync(p, t, 'utf8'); changed++; console.log(`  versionne : assets/${name}`); }
}

console.log(`\n${changed} fichier(s) versionne(s) — stamp v=${STAMP}`);
