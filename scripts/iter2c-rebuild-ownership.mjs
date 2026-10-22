/* Reconstitue le bloc ownership depuis HEAD, par arithmetique d index
   (aucune regex imbriquee). Le bloc complet remplace tout ce qui se
   trouve entre la premiere occurrence de <div class="ownership"> et la
   premiere <div class="verdict">. */
import fs from 'node:fs';
import { execSync } from 'node:child_process';

const MARK = '<div class="ownership" id="ownership"';
const VERDICT = '    <div class="verdict">';

for (const file of ['compare.html', 'fr/compare.html']) {
  const head = execSync(`git show HEAD:${file}`, { encoding: 'utf8', maxBuffer: 20e6 });
  const hs = head.indexOf(MARK);
  const he = head.indexOf(VERDICT);
  if (hs < 0 || he < 0 || he <= hs) { console.log(`  [introuvable dans HEAD] ${file}`); continue; }
  const block = head.slice(hs, he);

  let t = fs.readFileSync(file, 'utf8');
  const s = t.indexOf(MARK);
  const e = t.indexOf(VERDICT);
  if (s < 0 || e < 0 || e <= s) { console.log(`  [introuvable dans ${file}]`); continue; }
  t = t.slice(0, s) + block + t.slice(e);
  fs.writeFileSync(file, t, 'utf8');
  const count = (t.match(/<div class="ownership" id="ownership"/g) || []).length;
  const cells = (t.match(/ownership-cell/g) || []).length;
  console.log(`${file} : bloc reconstruit (${block.length} car.) | occurrences=${count} | cellules=${cells}`);
}
