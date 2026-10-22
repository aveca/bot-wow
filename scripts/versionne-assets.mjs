/* versionne-assets.mjs — stamp de version sur toutes les URLs d'assets.
 *
 * POURQUOI : Cloudflare sert les assets par cle de cache (URL + query).
 * Deux deploiements qui modifient un asset mais gardent le MEME stamp
 * laissent le navigateur (et le cache edge) servir l'ANCIEN fichier :
 * observe en production, app.js?v=20261022 etait encore la version
 * d'avant (import analytics.js absent), et le module d'instrumentation
 * n'etait donc jamais charge.
 *
 * Le stamp est donc CALCULE : date du jour + empreinte du contenu des
 * assets (stamp lui-meme retire avant hachage, pour eviter la boucle
 * "le stamp change le contenu qui change le stamp"). Toute modif d'un
 * asset produit donc une nouvelle cle de cache, automatiquement.
 *
 * Usage : node scripts/versionne-assets.mjs [stamp force]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Fichiers servis au navigateur, versionnes.
const ASSETS = ['style.css', 'site.css', 'app.js', 'demo.js', 'route-planner.js', 'analytics.js', 'favicon.svg', 'variant-a.css', 'variant-b.css', 'variant-c.css'];
const STAMP_RE = /\?v=[0-9a-zA-Z._-]+/g;

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'backups' || e.name === '_site' || e.name === '.wrangler') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

/* Empreinte de TOUS les assets publies (arborescence assets/ complete),
   stamp retire avant hachage : stable quel que soit le stamp courant, et
   change des que le CONTENU d'un asset change. Couvre donc aussi les
   feuilles de style : un changement de CSS seul doit produire une
   nouvelle cle de cache. */
export function assetFingerprint(root = ROOT) {
  const h = crypto.createHash('sha256');
  const base = path.join(root, 'assets');
  const files = [];
  (function walk(dir, rel = '') {
    let entries = [];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p, r);
      else if (e.isFile()) files.push([r, p]);
    }
  })(base);
  for (const [rel, p] of files) {
    h.update(rel);
    /* Les fins de ligne sont normalisees (CRLF -> LF) : git convertit les
       fins de ligne selon la plate-forme (core.autocrlf), donc le meme
       contenu committe n'a pas les memes octets sur Windows et sur Linux.
       Sans cette normalisation, le stamp calcule par le build differedait
       de celui du HTML versionne dans les sources, et le controle
       "stamp a jour" echouait a tort. */
    h.update(fs.readFileSync(p, 'utf8').replace(STAMP_RE, '').replace(/\r\n/g, '\n'));
  }
  return h.digest('hex').slice(0, 8);
}

export function computeStamp(root = ROOT) {
  const day = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  return `${day}-${assetFingerprint(root)}`;
}

// Stamp force ou automatique.
const forced = process.argv[2];

/**
 * Applique le stamp aux fichiers HTML, a style.css et aux modules ES
 * d'un repertoire donne. Exporte pour que le build puisse versionner
 * l'artefact publie sans toucher aux sources.
 */
export function applyStamp(dir, stamp) {
  let changed = 0;

  // 1. HTML : assets/X -> assets/X?v=STAMP
  for (const file of walk(dir)) {
    const rel = path.relative(dir, file);
    let t = fs.readFileSync(file, 'utf8');
    const before = t;
    for (const a of ASSETS) {
      const esc = a.replace(/\./g, '\\.');
      t = t.replace(new RegExp(`((?:\\.\\./|\\./)?assets/${esc})\\?v=[0-9a-zA-Z._-]+`, 'g'), `$1?v=${stamp}`);
      t = t.replace(new RegExp(`((?:\\.\\./|\\./)?assets/${esc})(["'\\s>])`, 'g'), `$1?v=${stamp}$2`);
    }
    if (t !== before) {
      fs.writeFileSync(file, t, 'utf8');
      changed++;
      if (dir === ROOT) console.log(`  versionne : ${rel}`);
    }
  }

  // 2. style.css : les @import pointent sur un fichier local (relatif a assets/)
  {
    const p = path.join(dir, 'assets', 'style.css');
    if (fs.existsSync(p)) {
      let t = fs.readFileSync(p, 'utf8');
      const before = t;
      t = t.replace(/@import url\("([^"]+)"\)(?!;?\s*\*\/)/g, (m, url) => {
        if (STAMP_RE.test(url)) return `@import url("${url.replace(STAMP_RE, '?v=' + stamp)}")`;
        return `@import url("${url}?v=${stamp}")`;
      });
      if (t !== before) { fs.writeFileSync(p, t, 'utf8'); changed++; if (dir === ROOT) console.log('  versionne : assets/style.css'); }
    }
  }

  // 3. modules ES : import depuis un fichier local
  for (const name of ['app.js', 'demo.js']) {
    const p = path.join(dir, 'assets', name);
    if (!fs.existsSync(p)) continue;
    let t = fs.readFileSync(p, 'utf8');
    const before = t;
    t = t.replace(/(from|import)\s+'(\.\/[a-z0-9-]+\.js)(\?v=[0-9a-zA-Z._-]+)?'/g,
      (m, kw, url) => `${kw} '${url}?v=${stamp}'`);
    if (t !== before) { fs.writeFileSync(p, t, 'utf8'); changed++; if (dir === ROOT) console.log(`  versionne : assets/${name}`); }
  }

  return changed;
}

/* Execute le versionnage seulement en appel direct : le module reste
   importable par le build (qui versionne l'artefact, pas les sources). */
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const STAMP = forced || computeStamp();
  console.log('stamp :', STAMP);
  const changed = applyStamp(ROOT, STAMP);
  console.log(`\n${changed} fichier(s) versionne(s) — stamp v=${STAMP}`);
}
