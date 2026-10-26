const fs = require('fs');
const files = ['ab/a/buy.html','ab/a/fr/buy.html','ab/b/buy.html','ab/b/fr/buy.html'];
let bad = 0;
const ok = (m) => console.log('  ok   ' + m);
const ko = (m) => { console.log('  FAIL ' + m); bad++; };
for (const f of files) {
  const html = fs.readFileSync(f, 'utf8');
  const flat = html.replace(/\s+/g, ' ');
  console.log('== ' + f);
  const has = /id="release-availability-notice"/.test(html) && /role="alert"/.test(html);
  const before = html.indexOf('id="release-availability-notice"') > -1 &&
                 html.indexOf('id="release-availability-notice"') < html.indexOf('id="buyForm"');
  const noPromise = !/Delivered\s+<b>by email<\/b>\s+in minutes/i.test(flat) &&
                    !/Livré\s+<b>par e-mail<\/b>\s+en quelques minutes/i.test(flat);
  const noClaim = !/<b>v1\.2\.0<\/b>\s*(current release|version actuelle)/i.test(flat);
  const support = /do not purchase until delivery is confirmed|n'achetez pas tant que la livraison n'est pas confirmée/i.test(flat);
  const form = /id="buyForm"/.test(html) && /id="buyBtn"/.test(html) && /id="buyErr"/.test(html);
  const price = /20,00\s*€|20\.00/.test(html);
  const ctas = (html.match(/data-cta-id="buy-/g) || []).length >= 3;
  const ban = /terms of service|conditions d.utilisation/i.test(html);
  const profils = (html.match(/class="price-tag"/g) || []).length >= 4;
  if (has) ok('avis disponibilite'); else ko('avis disponibilite');
  if (before) ok('avis AVANT formulaire'); else ko('avis AVANT formulaire');
  if (noPromise) ok('aucune promesse immediate'); else ko('aucune promesse immediate');
  if (noClaim) ok('v1.2.0 non confirmee'); else ko('v1.2.0 non confirmee');
  if (support) ok('contact support avant paiement'); else ko('contact support avant paiement');
  if (form) ok('formulaire checkout reel'); else ko('formulaire checkout reel');
  if (price) ok('prix inchange'); else ko('prix inchange');
  if (ctas) ok('CTA instrumentes'); else ko('CTA instrumentes');
  if (ban) ok('risque ban mentionne'); else ko('risque ban mentionne');
  if (profils) ok('blocs profils'); else ko('blocs profils');
}
console.log(bad === 0 ? '\nAB PAGES : OK' : `\nAB PAGES : ${bad} ECHEC(S)`);
process.exit(bad === 0 ? 0 : 1);
