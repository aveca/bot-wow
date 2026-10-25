/* Ajoute les CTA contextuels du parcours et l'instrumentation
   (data-track) sur l'accueil et la page de comparaison, EN et FR.
   Encodage UTF-8 preserve. */
import fs from 'node:fs';

const TRACK = (id) => `data-track="cta_click" data-cta-id="${id}"`;

const PATCHES = {
  'index.html': [
    // CTA hero
    ['<a class="btn btn-gold btn-lg" href="./demo.html">Try the browser demo</a>',
      `<a class="btn btn-gold btn-lg" href="./demo.html" ${TRACK('hero-demo')}>Try the browser demo</a>`],
    ['<a class="btn btn-ghost btn-lg" href="#buy">See the offer</a>',
      `<a class="btn btn-ghost btn-lg" href="#buy" ${TRACK('hero-offer')}>See the offer</a>`],
    // CTA nav
    ['<a class="btn btn-gold" style="padding:10px 18px;font-size:13.5px" href="#buy">Buy — €20.00</a>',
      `<a class="btn btn-gold" style="padding:10px 18px;font-size:13.5px" href="#buy" ${TRACK('nav-buy')}>Buy — €20.00</a>`],
    // Sortie contextuelle du radar (le panneau interactif n'avait aucun lien)
    ['      <div class="radar-foot">\n        <div class="radar-stat"><span class="k">spots</span>',
      `      <div class="radar-next">\n        <span class="radar-next-t">Same planner, same rules — run it yourself</span>\n        <a class="radar-next-link" href="./demo.html" ${TRACK('radar-demo')}>Open this round in the demo →</a>\n      </div>\n      <div class="radar-foot">\n        <div class="radar-stat"><span class="k">spots</span>`],
    // CTA apres la telemetry
    ['    <p class="honest-note">Measured on our own instrumented runs and offline test suites. Estimated values are always labelled as estimates.</p>',
      `    <p class="honest-note">Measured on our own instrumented runs and offline test suites. Estimated values are always labelled as estimates.</p>\n    <div class="cta-row">\n      <a class="btn btn-gold" href="./demo.html" ${TRACK('telemetry-demo')}>Try the demo — 2 min, no account</a>\n      <a class="btn btn-ghost" href="./compare.html" ${TRACK('telemetry-compare')}>Compare the offers</a>\n    </div>`],
    // CTA apres les etapes
    ['      <div class="step">\n        <div class="step-num">03</div>\n        <h3>Optimise</h3>\n        <p>The route planner chains spots by cost and distance. Verified 12 / 12 against the Python reference.</p>\n      </div>\n    </div>',
      `      <div class="step">\n        <div class="step-num">03</div>\n        <h3>Optimise</h3>\n        <p>The route planner chains spots by cost and distance. Verified 12 / 12 against the Python reference.</p>\n      </div>\n    </div>\n    <div class="cta-row">\n      <a class="btn btn-gold" href="./demo.html" ${TRACK('steps-demo')}>See it run on a real map</a>\n      <a class="btn btn-ghost" href="#buy" ${TRACK('steps-buy')}>Get the licence — €20</a>\n    </div>`],
    // CTA final
    ['<a class="btn btn-gold btn-lg" href="#buy">Buy — €20.00</a>\n      <a class="btn btn-ghost btn-lg" href="./demo.html">Try the demo</a>',
      `<a class="btn btn-gold btn-lg" href="#buy" ${TRACK('final-buy')}>Buy — €20.00</a>\n      <a class="btn btn-ghost btn-lg" href="./demo.html" ${TRACK('final-demo')}>Try the demo</a>`],
  ],
  'fr/index.html': [
    ['<a class="btn btn-gold btn-lg" href="./demo.html">Essayer la démo navigateur</a>',
      `<a class="btn btn-gold btn-lg" href="./demo.html" ${TRACK('hero-demo')}>Essayer la démo navigateur</a>`],
    ['<a class="btn btn-ghost btn-lg" href="#buy">Voir l\'offre</a>',
      `<a class="btn btn-ghost btn-lg" href="#buy" ${TRACK('hero-offer')}>Voir l'offre</a>`],
    ['<a class="btn btn-gold" style="padding:10px 18px;font-size:13.5px" href="#buy">Acheter — 20,00 €</a>',
      `<a class="btn btn-gold" style="padding:10px 18px;font-size:13.5px" href="#buy" ${TRACK('nav-buy')}>Acheter — 20,00 €</a>`],
    ['      <div class="radar-foot">\n        <div class="radar-stat"><span class="k">bancs</span>',
      `      <div class="radar-next">\n        <span class="radar-next-t">Même planificateur, mêmes règles — essayez-le</span>\n        <a class="radar-next-link" href="./demo.html" ${TRACK('radar-demo')}>Ouvrir cette ronde dans la démo →</a>\n      </div>\n      <div class="radar-foot">\n        <div class="radar-stat"><span class="k">bancs</span>`],
    ['    <p class="honest-note">Mesuré sur nos propres exécutions instrumentées et nos suites de tests hors-ligne. Les valeurs estimées sont toujours étiquetées comme estimations.</p>',
      `    <p class="honest-note">Mesuré sur nos propres exécutions instrumentées et nos suites de tests hors-ligne. Les valeurs estimées sont toujours étiquetées comme estimations.</p>\n    <div class="cta-row">\n      <a class="btn btn-gold" href="./demo.html" ${TRACK('telemetry-demo')}>Essayer la démo — 2 min, sans compte</a>\n      <a class="btn btn-ghost" href="./compare.html" ${TRACK('telemetry-compare')}>Comparer les offres</a>\n    </div>`],
    ['      <div class="step">\n        <div class="step-num">03</div>\n        <h3>Optimiser</h3>\n        <p>Le planificateur de rondes enchaîne les spots par coût et distance. Vérifié 12 / 12 par rapport à la référence Python.</p>\n      </div>\n    </div>',
      `      <div class="step">\n        <div class="step-num">03</div>\n        <h3>Optimiser</h3>\n        <p>Le planificateur de rondes enchaîne les spots par coût et distance. Vérifié 12 / 12 par rapport à la référence Python.</p>\n      </div>\n    </div>\n    <div class="cta-row">\n      <a class="btn btn-gold" href="./demo.html" ${TRACK('steps-demo')}>Voir le planificateur sur une vraie carte</a>\n      <a class="btn btn-ghost" href="#buy" ${TRACK('steps-buy')}>Prendre la licence — 20 €</a>\n    </div>`],
    ['<a class="btn btn-gold btn-lg" href="#buy">Acheter — 20,00 €</a>\n      <a class="btn btn-ghost btn-lg" href="./demo.html">Essayer la démo</a>',
      `<a class="btn btn-gold btn-lg" href="#buy" ${TRACK('final-buy')}>Acheter — 20,00 €</a>\n      <a class="btn btnhost btn-lg" href="./demo.html" ${TRACK('final-demo')}>Essayer la démo</a>`.replace('btnhost', 'btn-ghost')],
  ],
  'compare.html': [
    ['<a class="btn btn-gold" href="#buy">Buy — €20.00</a>\n        <a class="btn btn-ghost" href="./compatibility.html">Read compatibility</a>',
      `<a class="btn btn-gold" href="#buy" ${TRACK('formula-ours-buy')}>Buy — €20.00</a>\n        <a class="btn btn-ghost" href="./compatibility.html" ${TRACK('formula-compat')}>Read compatibility</a>`],
    ['<a class="btn btn-ghost" href="./demo.html">Try our free demo</a>',
      `<a class="btn btn-ghost" href="./demo.html" ${TRACK('formula-trial-demo')}>Try our free demo</a>`],
    ['<p class="center mt"><a class="btn btn-gold" href="#buy">Buy — €20.00</a></p>',
      `<p class="center mt"><a class="btn btn-gold" href="#buy" ${TRACK('compare-buy')}>Buy — €20.00</a></p>`],
  ],
  'fr/compare.html': [
    ['<a class="btn btn-gold" href="#buy">Acheter — 20,00 €</a>\n        <a class="btn btn-ghost" href="./compatibility.html">Lire la compatibilité</a>',
      `<a class="btn btn-gold" href="#buy" ${TRACK('formula-ours-buy')}>Acheter — 20,00 €</a>\n        <a class="btn btn-ghost" href="./compatibility.html" ${TRACK('formula-compat')}>Lire la compatibilité</a>`],
    ['<a class="btn btn-ghost" href="./demo.html">Essayer notre démo gratuite</a>',
      `<a class="btn btn-ghost" href="./demo.html" ${TRACK('formula-trial-demo')}>Essayer notre démo gratuite</a>`],
    ['<p class="center mt"><a class="btn btn-ghost" href="./demo.html">Essayer d\'abord la démo navigateur</a></p>',
      `<p class="center mt"><a class="btn btn-ghost" href="./demo.html" ${TRACK('compare-demo')}>Essayer d'abord la démo navigateur</a></p>`],
  ],
};

let total = 0;
for (const [file, pairs] of Object.entries(PATCHES)) {
  let t = fs.readFileSync(file, 'utf8');
  let n = 0;
  for (const [from, to] of pairs) {
    if (t.includes(from)) { t = t.split(from).join(to); n++; }
    else console.log(`  [absent] ${file} : ${from.slice(0, 58).replace(/\n/g, ' ')}...`);
  }
  fs.writeFileSync(file, t, 'utf8');
  console.log(`${file} : ${n}/${pairs.length} remplacement(s)`);
  total += n;
}
console.log(`\ntotal : ${total} remplacement(s)`);
