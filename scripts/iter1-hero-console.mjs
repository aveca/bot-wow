/* Iter 1 : fusionne la capture reelle et le radar en UNE console instrument
   dans le hero, et unifie l'echelle typographique / les rayons / les
   animations de progression. Encodage UTF-8 preserve. */
import fs from 'node:fs';

const PATCH = {
  'index.html': [
    // 1. Retirer le bloc .visual de son emplacement actuel
    [`    <!-- Visuel à droite : capture réelle + radar intégré -->
    <div class="visual">
      <picture>
        <source type="image/webp" srcset="./assets/evidence/fishing-real-capture.webp">
        <img src="./assets/evidence/fishing-real-capture.jpg" alt="Real capture: Lushwater Oasis, instrumented session" loading="lazy" width="480" height="270">
      </picture>
      <div class="visual-caption">
        <span class="v-k">REAL CAPTURE</span>
        <span class="v-v">Lushwater Oasis · 76 KB · instrumented</span>
      </div>
    </div>

`, ''],
    // 2. Reinserer la capture DANS le panneau radar (une seule console)
    [`        <span class="live-pulse" aria-label="Simulated data"><span class="pulse-ring"></span>SIMULATED</span>
      </div>
      <div class="radar-body">`,
      `        <span class="live-pulse" aria-label="Simulated data"><span class="pulse-ring"></span>SIMULATED</span>
      </div>
      <div class="visual">
        <picture>
          <source type="image/webp" srcset="./assets/evidence/fishing-real-capture.webp">
          <img src="./assets/evidence/fishing-real-capture.jpg" alt="Real capture: Lushwater Oasis, instrumented session" loading="lazy" width="480" height="270">
        </picture>
        <div class="visual-caption">
          <span class="v-k">REAL CAPTURE</span>
          <span class="v-v">Lushwater Oasis · 76 KB · instrumented</span>
        </div>
      </div>
      <div class="radar-body">`],
  ],
  'fr/index.html': [
    [`    <!-- Visuel à droite : capture réelle + radar intégré -->
    <div class="visual">
      <picture>
        <source type="image/webp" srcset="../assets/evidence/fishing-real-capture.webp">
        <img src="../assets/evidence/fishing-real-capture.jpg" alt="Capture réelle : Lushwater Oasis, session instrumentée" loading="lazy" width="480" height="270">
      </picture>
      <div class="visual-caption">
        <span class="v-k">CAPTURE RÉELLE</span>
        <span class="v-v">Lushwater Oasis · 76 Ko · instrumentée</span>
      </div>
    </div>

`, ''],
    [`        <span class="live-pulse" aria-label="Données simulées"><span class="pulse-ring"></span>SIMULÉ</span>
      </div>
      <div class="radar-body">`,
      `        <span class="live-pulse" aria-label="Données simulées"><span class="pulse-ring"></span>SIMULÉ</span>
      </div>
      <div class="visual">
        <picture>
          <source type="image/webp" srcset="../assets/evidence/fishing-real-capture.webp">
          <img src="../assets/evidence/fishing-real-capture.jpg" alt="Capture réelle : Lushwater Oasis, session instrumentée" loading="lazy" width="480" height="270">
        </picture>
        <div class="visual-caption">
          <span class="v-k">CAPTURE RÉELLE</span>
          <span class="v-v">Lushwater Oasis · 76 Ko · instrumentée</span>
        </div>
      </div>
      <div class="radar-body">`],
  ],
};

let total = 0;
for (const [file, pairs] of Object.entries(PATCH)) {
  let t = fs.readFileSync(file, 'utf8');
  let n = 0;
  for (const [from, to] of pairs) {
    if (t.includes(from)) { t = t.split(from).join(to); n++; }
    else console.log(`  [absent] ${file} : ${from.slice(0, 60).replace(/\n/g, ' ')}`);
  }
  fs.writeFileSync(file, t, 'utf8');
  console.log(`${file} : ${n}/${pairs.length}`);
  total += n;
}
console.log('total :', total);
