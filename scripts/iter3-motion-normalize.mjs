/* Iter 3 : normalisation du systeme de mouvement.
   1. `$list` : litteral non developpe -> declarations transition INVALIDES
      (donc mortes) dans compare.css, components.css, hero.css, theme.css.
   2. easings `ease` heritee de site.css -> token --ease-out (coherence).
   3. la barre du ledger animait `width` -> `transform` (compose).
   4. reduced-motion : `transition-property` explicitement neutralise
      (sinon la regle globale.duration cree 468 transitions `all`). */
import fs from 'node:fs';

const LIST = 'color, background-color, border-color, box-shadow, opacity, transform';
const files = ['assets/theme.css', 'assets/hero.css', 'assets/compare.css', 'assets/components.css', 'assets/premium.css', 'assets/motion.css', 'assets/site.css'];

for (const f of files) {
  let t = fs.readFileSync(f, 'utf8');
  const before = t;
  // 1. $list -> liste explicite
  t = t.replace(/transition:\$list\s+([\.\d]+m?s)\s+var\(--ease-out\)/g, `transition:${LIST} $1 var(--ease-out)`);
  t = t.replace(/\$list/g, LIST);
  // 2. ease heritee -> token
  t = t.replace(/transition:([^;{}]*?)\s(\.16s|\.2s|\.15s|\.18s|\.3s|\.45s|\.6s)\s+ease\b/g,
    (m, props, dur) => `transition:${props} ${dur} var(--ease-out)`);
  // 3. largeur de barre -> transform
  t = t.replace(/\.ledger-bar > span\{([^}]*?)transition:width \.5s ease\}/,
    '.ledger-bar > span{$1transition:transform .5s var(--ease-out)}');
  if (t !== before) {
    fs.writeFileSync(f, t, 'utf8');
    console.log(`  ${f} : normalise`);
  }
}

// 4. reduced-motion : plus de transition-property implicite
{
  const f = 'assets/motion.css';
  let t = fs.readFileSync(f, 'utf8');
  const from = `    transition-duration:0.01ms !important;`;
  const to = `    transition-duration:0.01ms !important;
    transition-property:none !important;`;
  if (t.includes(from) && !t.includes('transition-property:none !important')) {
    t = t.replace(from, to);
    fs.writeFileSync(f, t, 'utf8');
    console.log('  assets/motion.css : reduced-motion strengthen');
  }
}
console.log('termine');
