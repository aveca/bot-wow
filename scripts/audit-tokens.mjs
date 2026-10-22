/* Audit : tokens CSS utilises mais non definis (var(--x) sans definition).
   Detecte les regressions silencieuses liees a un changement de palette.
   Usage : node scripts/audit-tokens.mjs */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());
const cssFiles = ['assets/site.css', 'assets/theme.css', 'assets/hero.css', 'assets/compare.css'];

const defined = new Set();
for (const cf of cssFiles) {
  const fp = path.join(root, cf);
  if (!fs.existsSync(fp)) continue;
  const css = fs.readFileSync(fp, 'utf8');
  for (const m of css.matchAll(/(--[\w-]+)\s*:/g)) defined.add(m[1]);
}

const rows = [];
for (const cf of cssFiles) {
  const fp = path.join(root, cf);
  if (!fs.existsSync(fp)) continue;
  const css = fs.readFileSync(fp, 'utf8');
  const used = new Map();
  for (const m of css.matchAll(/var\((--[\w-]+)/g)) {
    if (!used.has(m[1])) used.set(m[1], 0);
    used.set(m[1], used.get(m[1]) + 1);
  }
  for (const [tok, n] of used) {
    if (!defined.has(tok)) rows.push({ file: cf, token: tok, n });
  }
}
rows.sort((a, b) => b.n - a.n);
console.log(`Tokens definis : ${defined.size}`);
console.log(`Tokens utilises MAIS NON DEFINIS : ${rows.length}`);
for (const r of rows) console.log(`  ${r.file.padEnd(20)} var(${r.token}) x${r.n}`);
