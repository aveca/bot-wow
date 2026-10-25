/* Audit: CSS custom properties used without a definition across the shipped stylesheet set. */
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(process.cwd());

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'backups', '.wrangler'].includes(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const cssFiles = walk(path.join(root, 'assets')).filter((p) => p.endsWith('.css'));
const htmlFiles = walk(root).filter((p) => p.endsWith('.html'));
const sources = cssFiles.map((p) => ({ file: path.relative(root, p), content: fs.readFileSync(p, 'utf8') }));

// Account for inline styles so the audit reflects the entire rendered site.
for (const p of htmlFiles) {
  const html = fs.readFileSync(p, 'utf8');
  let styleIndex = 0;
  for (const m of html.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) {
    styleIndex += 1;
    sources.push({ file: `${path.relative(root, p)}#style-${styleIndex}`, content: m[1] });
  }
}

const defined = new Set();
for (const source of sources) {
  for (const m of source.content.matchAll(/(--[\w-]+)\s*:/g)) defined.add(m[1]);
}

const rows = [];
for (const source of sources) {
  const used = new Map();
  // A fallback in var(--token, fallback) is safe even if the token has no global definition.
  for (const m of source.content.matchAll(/var\((--[\w-]+)(\s*,[^)]*)?\)/g)) {
    if (!defined.has(m[1]) && !m[2]) used.set(m[1], (used.get(m[1]) || 0) + 1);
  }
  for (const [token, count] of used) rows.push({ file: source.file, token, count });
}
rows.sort((a, b) => b.count - a.count);
console.log(`Stylesheets analyzed: ${cssFiles.length}; inline style blocks: ${sources.length - cssFiles.length}`);
console.log(`Defined tokens: ${defined.size}`);
console.log(`Tokens used but not defined: ${rows.length}`);
for (const row of rows) console.log(`  ${row.file.padEnd(32)} var(${row.token}) x${row.count}`);
if (rows.length) process.exitCode = 1;
