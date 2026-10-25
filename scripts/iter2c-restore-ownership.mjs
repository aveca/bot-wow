/* Restaure integralement le bloc "cost of ownership" : on decoupe la
   version commitee entre <div class="ownership"> et <div class="verdict">,
   sans regex imbriquee (le bloc contient des div imbriques). */
import fs from 'node:fs';
import { execSync } from 'node:child_process';

for (const file of ['compare.html', 'fr/compare.html']) {
  const head = execSync(`git show HEAD:${file}`, { encoding: 'utf8', maxBuffer: 20e6 });
  const start = head.indexOf('    <div class="ownership"');
  const end = head.indexOf('    <div class="verdict">');
  if (start < 0 || end < 0 || end <= start) { console.log(`  [introuvable dans HEAD] ${file}`); continue; }
  const block = head.slice(start, end);

  let t = fs.readFileSync(file, 'utf8');
  // On retire l éventuel bloc tronque deja present
  const s2 = t.indexOf('    <div class="ownership"');
  const e2 = t.indexOf('    <div class="verdict">');
  if (s2 >= 0 && e2 > s2) t = t.slice(0, s2) + t.slice(e2);
  const anchor = '    <div class="verdict">';
  t = t.replace(anchor, block + anchor);
  fs.writeFileSync(file, t, 'utf8');
  console.log(`${file} : bloc ownership restaure (${block.length} car.)`);
}
