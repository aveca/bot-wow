/* Dedoublonne le bloc ownership : une seule occurrence complete
   (celle qui contient .ownership-grid). */
import fs from 'node:fs';

for (const file of ['compare.html', 'fr/compare.html']) {
  let t = fs.readFileSync(file, 'utf8');
  const marker = '<div class="ownership" id="ownership"';
  const idxs = [];
  let i = -1;
  while ((i = t.indexOf(marker, i + 1)) !== -1) idxs.push(i);
  if (idxs.length <= 1) { console.log(`${file} : ${idxs.length} bloc(s), rien a faire`); continue; }

  // Bloc complet = celui qui contient ownership-grid
  let keepStart = -1, keepEnd = -1;
  for (const s of idxs) {
    const e = t.indexOf('    <div class="verdict">', s);
    const seg = t.slice(s, e > s ? e : s + 4000);
    if (seg.includes('ownership-grid')) { keepStart = s; keepEnd = e; break; }
  }
  if (keepStart < 0) { console.log(`  [bloc complet introuvable] ${file}`); continue; }

  // Supprime toutes les occurrences SAU la complete (de la fin vers le debut)
  for (const s of idxs.slice().reverse()) {
    if (s === keepStart) continue;
    const e = t.indexOf('    <div class="verdict">', s);
    const end = e > s ? e : s + 200;
    t = t.slice(0, s) + t.slice(end);
  }
  fs.writeFileSync(file, t, 'utf8');
  const left = (t.match(/<div class="ownership" id="ownership"/g) || []).length;
  console.log(`${file} : ${idxs.length} blocs -> ${left}`);
}
