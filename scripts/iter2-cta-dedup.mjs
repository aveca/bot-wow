/* Iter 2 : supprime le CTA "Buy" redondant place juste au-dessus du
   formulaire d achat (qui porte deja son propre bouton de paiement) :
   sur /compare, cinq boutons "Buy" se concurrencent. */
import fs from 'node:fs';

const P = {
  'compare.html': [
    [`    <p class="center mt"><a class="btn btn-ghost" href="./demo.html" data-track="cta_click" data-cta-id="compare-demo">Try the browser demo first</a></p>
    <p class="center mt"><a class="btn btn-gold" href="#buy" data-track="cta_click" data-cta-id="compare-buy">Buy — €20.00</a></p>`,
      `    <p class="center mt"><a class="btn btn-ghost" href="./demo.html" data-track="cta_click" data-cta-id="compare-demo">Try the browser demo first</a></p>`],
  ],
  'fr/compare.html': [
    [`    <p class="center mt"><a class="btn btn-ghost" href="./demo.html" data-track="cta_click" data-cta-id="compare-demo">Essayer d'abord la démo navigateur</a></p>
    <p class="center mt"><a class="btn btn-gold" href="#buy" data-track="cta_click" data-cta-id="compare-buy">Acheter — 20,00 €</a></p>`,
      `    <p class="center mt"><a class="btn btn-ghost" href="./demo.html" data-track="cta_click" data-cta-id="compare-demo">Essayer d'abord la démo navigateur</a></p>`],
  ],
};

let total = 0;
for (const [file, pairs] of Object.entries(P)) {
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
