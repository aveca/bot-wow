/* Audit : classes utilisees dans le HTML mais non definies dans le CSS.
   Detecte les regressions de layout introduites par une refonte de theme.
   Usage : node scripts/audit-classes.mjs */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
function walkCss(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'backups', '.wrangler'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walkCss(p, out);
    else if (e.name.endsWith('.css')) out.push(path.relative(root, p));
  }
  return out;
}
const cssFiles = walkCss(path.join(root, 'assets'));

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === 'backups' || e.name === '.wrangler') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

// 1. classes definies dans le CSS
const defined = new Set();
for (const cf of cssFiles) {
  const fp = path.join(root, cf);
  if (!fs.existsSync(fp)) continue;
  const css = fs.readFileSync(fp, 'utf8');
  for (const m of css.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) defined.add(m[1]);
}

// 2. classes utilisees dans le HTML
const htmlFiles = walk(root);
const used = new Map(); // classe -> Set(fichiers)
for (const hf of htmlFiles) {
  const html = fs.readFileSync(hf, 'utf8');
  const rel = path.relative(root, hf);
  // Include embedded style blocks; otherwise valid page-specific selectors
  // appear to be missing simply because they do not live in a separate file.
  for (const block of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    for (const m of block[1].matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) defined.add(m[1]);
  }
  for (const m of html.matchAll(/class="([^"]+)"/g)) {
    for (const c of m[1].split(/\s+/)) {
      if (!c) continue;
      if (!used.has(c)) used.set(c, new Set());
      used.get(c).add(rel);
    }
  }
}

// 3. rapport
const missing = [];
for (const [c, files] of used) {
  if (defined.has(c)) continue;
  missing.push({ cls: c, files: [...files].slice(0, 3), n: files.size });
}
missing.sort((a, b) => b.n - a.n);

console.log(`Pages analysees : ${htmlFiles.length}`);
console.log(`Classes CSS definies : ${defined.size}`);
console.log(`Classes utilisees : ${used.size}`);
console.log(`\nCLASSES UTILISEES MAIS NON DEFINIES : ${missing.length}`);
for (const m of missing) {
  console.log(`  .${m.cls.padEnd(22)} x${String(m.n).padEnd(3)} ${m.files.join(', ')}`);
}
