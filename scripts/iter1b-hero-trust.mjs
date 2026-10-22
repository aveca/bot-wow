/* Iter 1b : supprime la ligne .hero-trust, qui dupliquait les trois
   benefices juste au-dessus (meme contenu, moins bien redige).
   Gain : ~60px dans le hero (le CTA principal repasse au-dessus de la
   ligne de flottaison) et une section de moins a repetition. */
import fs from 'node:fs';

const BLOCKS = {
  'index.html': [`      <div class="hero-trust">
        <span><svg class="ico" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10l4 4 8-8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg> Detection calibrated on real captures</span>
        <span><svg class="ico" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10l4 4 8-8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg> Memory with export / import</span>
        <span><svg class="ico" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10l4 4 8-8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg> One single lifetime price</span>
      </div>
`, ''],
  'fr/index.html': [`      <div class="hero-trust">
        <span><svg class="ico" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10l4 4 8-8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg> Détection calibrée sur captures réelles</span>
        <span><svg class="ico" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10l4 4 8-8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg> Mémoire avec export / import</span>
        <span><svg class="ico" viewBox="0 0 20 20" aria-hidden="true"><path d="M5 10l4 4 8-8" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/></svg> Un seul prix à vie</span>
      </div>
`, ''],
};

let total = 0;
for (const [file, pairs] of Object.entries(BLOCKS)) {
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
