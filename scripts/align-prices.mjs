/* Aligne les prix cites sur compare.html / fr/compare.html avec les
   montants PUBLIES releves sur pixelwowbot.com/#pricing le 2026-10-22 :
     - Essai  : EUR 1.99 / 48 h, 2 sessions max
     - Farming Pack : EUR 19.99 / 30 jours (renouvellement)
     - A la carte : a partir de EUR 6.99 / 30 jours
   Suppression de la mention "90 jours" qui n'a pas pu etre verifiee. */
import fs from 'node:fs';

const REPL = {
  'compare.html': [
    ['<div class="formula-price"><b>30 / 90 days</b><span>per term</span></div>',
      '<div class="formula-price"><b>€19.99</b><span>per 30 days</span></div>'],
    ['<p class="formula-note">Subscription terms, renewed. The exact price is not published on the pages we read.</p>',
      '<p class="formula-note">Published price: €19.99 per 30 days, renewed. Read on their pricing page, 2026-10-22.</p>'],
    ['<div class="formula-price"><b>1,99 €</b><span>for 48 h</span></div>',
      '<div class="formula-price"><b>€1.99</b><span>for 48 h</span></div>'],
    ['<p class="formula-note">A paid trial before any commitment.</p>',
      '<p class="formula-note">Every role for 48 h, 2 sessions max.</p>'],
    ['<td data-label="PixelBuddy">30 / 90 days</td>',
      '<td data-label="PixelBuddy">€19.99 / 30 days</td>'],
    ['<td data-label="PixelBuddy">1,99 €</td>',
      '<td data-label="PixelBuddy">€1.99 (2 sessions max)</td>'],
    ['<td data-label="PixelBuddy">subscription</td>',
      '<td data-label="PixelBuddy">€19.99 / 30 days, renewed</td>'],
  ],
  'fr/compare.html': [
    ['<div class="formula-price"><b>30 / 90 jours</b><span>par période</span></div>',
      '<div class="formula-price"><b>19,99 €</b><span>par 30 jours</span></div>'],
    ['<p class="formula-note">Durée d\'abonnement, renouvelable. Le prix exact n\'est pas publié sur les pages que nous avons lues.</p>',
      '<p class="formula-note">Prix publié : 19,99 € par 30 jours, renouvelable. Lu sur leur page tarifaire, le 22/10/2026.</p>'],
    ['<p class="formula-note">Un essai payant avant tout engagement.</p>',
      '<p class="formula-note">Tous les rôles pendant 48 h, 2 sessions maximum.</p>'],
    ['<td data-label="PixelBuddy">30 / 90 jours</td>',
      '<td data-label="PixelBuddy">19,99 € / 30 jours</td>'],
    ['<td data-label="PixelBuddy">1,99 €</td>',
      '<td data-label="PixelBuddy">1,99 € (2 sessions max)</td>'],
    ['<td data-label="PixelBuddy">abonnement</td>',
      '<td data-label="PixelBuddy">19,99 € / 30 jours, renouvelable</td>'],
  ],
};

let changed = 0;
for (const [file, pairs] of Object.entries(REPL)) {
  let t = fs.readFileSync(file, 'utf8');
  let n = 0;
  for (const [from, to] of pairs) {
    if (t.includes(from)) { t = t.split(from).join(to); n++; }
    else console.log(`  [absent] ${file}: ${from.slice(0, 60)}...`);
  }
  fs.writeFileSync(file, t, 'utf8');
  console.log(`${file} : ${n} remplacement(s)`);
  changed += n;
}
// Verifie qu'il ne reste aucune mention de "90 days" / "90 jours"
for (const file of Object.keys(REPL)) {
  const t = fs.readFileSync(file, 'utf8');
  const left = (t.match(/90 (days|jours)/g) || []).length;
  console.log(`${file} : mentions restantes de "90 jours" = ${left}`);
}
console.log(`\ntotal : ${changed} remplacement(s)`);
