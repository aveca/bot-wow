/* Iter 1d : la navigation de 9 liens se repliait sur deux lignes (121 px de
   hauteur) et concurrençait les CTA. On garde les 5 entrees primaries ;
   les autres restent accessibles dans le pied de page. */
import fs from 'node:fs';

const NAV = {
  'index.html': [
    [`      <a href="./modules.html">Modules</a>
      <a href="./compare.html">Versus</a>
      <a href="./features.html">Features</a>
      <a href="./demo.html">Demo</a>
      <a href="./getting-started.html">Getting started</a>
      <a href="./compatibility.html">Compatibility</a>
      <a href="./roadmap.html">Roadmap</a>
      <a href="./faq.html">FAQ</a>
      <a href="./docs/index.html">Docs</a>`,
      `      <a href="./modules.html">Modules</a>
      <a href="./compare.html">Versus</a>
      <a href="./demo.html">Demo</a>
      <a href="./features.html">Features</a>
      <a href="./faq.html">FAQ</a>`],
  ],
  'fr/index.html': [
    [`      <a href="./modules.html">Modules</a>
      <a href="./compare.html">Versus</a>
      <a href="./features.html">Fonctionnalités</a>
      <a href="./demo.html">Démo</a>
      <a href="./getting-started.html">Premiers pas</a>
      <a href="./compatibility.html">Compatibilité</a>
      <a href="./roadmap.html">Feuille de route</a>
      <a href="./faq.html">FAQ</a>
      <a href="../docs/index.html">Docs</a>`,
      `      <a href="./modules.html">Modules</a>
      <a href="./compare.html">Versus</a>
      <a href="./demo.html">Démo</a>
      <a href="./features.html">Fonctionnalités</a>
      <a href="./faq.html">FAQ</a>`],
  ],
};

let total = 0;
for (const [file, pairs] of Object.entries(NAV)) {
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
