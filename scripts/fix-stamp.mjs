import fs from 'node:fs';
import path from 'node:path';

const stamp = '20261022-8422e7a8';
const oldStamp = '20261022-3ac653d5';
const root = process.cwd();

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name === '.git' || e.name === '_site' || e.name === '.wrangler') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (e.name.endsWith('.html')) out.push(p);
  }
  return out;
}

const htmlFiles = walk(root);
let changed = 0;
for (const p of htmlFiles) {
  let t = fs.readFileSync(p, 'utf8');
  const before = t;
  t = t.replace(new RegExp(oldStamp, 'g'), stamp);
  if (t !== before) {
    fs.writeFileSync(p, t, 'utf8');
    changed++;
    console.log('updated:', path.relative(root, p));
  }
}
console.log(changed + ' fichier(s) mis a jour');
