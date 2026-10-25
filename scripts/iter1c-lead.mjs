/* Iter 1c : le <br> du hero conduit (.lead) se battait avec le retour
   naturel de la ligne : 184 px pour 6 lignes. On laisse le texte
  choisir ses lignes. La nav passe de 97 a ~73 px de hauteur. */
import fs from 'node:fs';

const FIX = {
  'index.html': [
    [`        Measured float detection, <b>persistent spot memory</b> and optimised<br>
        rounds that chain fishing spots together — plus an honest module ledger<br>
        showing exactly what ships, what's in development, and what's planned.`,
      `        Measured float detection, <b>persistent spot memory</b> and optimised rounds that chain
        fishing spots together — plus an honest module ledger showing exactly what ships,
        what is in development, and what is planned.`],
  ],
  'fr/index.html': [
    [`        Détection mesurée du flotteur, <b>mémoire persistante des spots</b> et rondes<br>
        optimisées qui enchaînent les bancs — plus un registre de modules honnête qui<br>
        montre exactement ce qui livre, ce qui est en développement et ce qui est planifié.`,
      `        Détection mesurée du flotteur, <b>mémoire persistante des spots</b> et rondes optimisées
        qui enchaînent les bancs — plus un registre de modules honnête qui montre exactement
        ce qui livre, ce qui est en développement et ce qui est planifié.`],
  ],
};

let total = 0;
for (const [file, pairs] of Object.entries(FIX)) {
  let t = fs.readFileSync(file, 'utf8');
  let n = 0;
  for (const [from, to] of pairs) {
    if (t.includes(from)) { t = t.split(from).join(to); n++; }
    else console.log(`  [absent] ${file}`);
  }
  fs.writeFileSync(file, t, 'utf8');
  console.log(`${file} : ${n}/${pairs.length}`);
  total += n;
}
console.log('total :', total);
