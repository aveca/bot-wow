import fs from 'node:fs';
const files = ['compare.html', 'fr/compare.html'];
for (const f of files) {
  const t = fs.readFileSync(f, 'utf8');
  const chk = (label, needle) => console.log('  ' + label.padEnd(14), needle ? 'OK' : 'MANQUE');
  console.log(f);
  chk('ownership', t.includes('id="ownership"'));
  chk('own-switch', t.includes('own-switch'));
  chk('19,99 / 19.99', t.includes('19,99') || t.includes('19.99'));
  chk('2 sessions', t.includes('2 sessions'));
  const ninety = (t.match(/90 (days|jours)/g) || []).length;
  chk('0 mention "90 j"', ninety === 0 ? 'OK' : 'IL EN RESTE ' + ninety);
  chk('source+date', t.includes('2026-10-22') || t.includes('22/10/2026'));
}
