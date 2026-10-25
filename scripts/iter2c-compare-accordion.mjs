/* Iter 2c : le comparateur en cartes empilees faisait 14 670 px sur
   mobile. Chaque theme devient un <details> (accordéon natif, accessible,
   sans JavaScript) : sur mobile on n ouvre que le premier theme au
   chargement ; sur desktop tous restent deployes (attribut `open`).
   Le contenu des 26 lignes est strictement inchange. */
import fs from 'node:fs';

const FILE = { 'compare.html': 'en', 'fr/compare.html': 'fr' };

for (const [file] of Object.entries(FILE)) {
  let t = fs.readFileSync(file, 'utf8');
  const m = t.match(/<div class="cmptable">([\s\S]*?)<\/div>\s*\n\s*<div class="verdict">/);
  if (!m) { console.log(`  [absent] ${file} : bloc cmptable`); continue; }
  const block = m[1];
  const tm = block.match(/<table class="vs">([\s\S]*?)<\/table>/);
  if (!tm) { console.log(`  [absent] ${file} : table`); continue; }
  const thead = tm[1].match(/<thead>([\s\S]*?)<\/thead>/)[1];
  const tbody = tm[1].match(/<tbody>([\s\S]*?)<\/tbody>/)[1];

  // Decoupe le tbody par groupes
  const parts = tbody.split(/<tr class="vs-group">/).filter((p) => p.trim());
  const groups = [];
  for (const p of parts) {
    const g = p.match(/<td colspan="4"><span>([\s\S]*?)<\/span><\/td><\/tr>([\s\S]*)/);
    if (!g) continue;
    groups.push({ title: g[1].trim(), rows: g[2] });
  }
  if (!groups.length) { console.log(`  [absent] ${file} : groupes`); continue; }

  const blocks = groups.map((g, i) => {
    const rows = g.rows.replace(/<tr class="vs-group">[\s\S]*$/, '').trim();
    return `      <details class="cmp-group"${i === 0 ? ' open' : ''}>
        <summary><span class="cmp-group-title">${g.title}</span><span class="cmp-group-count">${(rows.match(/<tr>/g) || []).length} criteria</span></summary>
        <div class="cmp-group-body">
          <table class="vs">
            <thead>${thead}</thead>
            <tbody>
              ${rows}
            </tbody>
          </table>
        </div>
      </details>`;
  }).join('\n');

  const newBlock = `<div class="cmptable">\n${blocks}\n    `;
  t = t.replace(m[0], newBlock + '</div>\n    <div class="verdict">');
  fs.writeFileSync(file, t, 'utf8');
  console.log(`${file} : ${groups.length} groupes en <details> (${groups.map((g) => g.title).join(' | ')})`);
}
