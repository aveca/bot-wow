#!/usr/bin/env node
/**
 * release-availability.test.mjs — commercial truth guard.
 * The v1.2.0 package is not verified in the download store (issue #18,
 * PRs #26/#28). Every known direct purchase form must disclose that fact.
 * Static assertions inspect repository HTML; they do not query production R2.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log('  ok   ' + name);
  else { failures += 1; console.log('  FAIL ' + name + ' ' + detail); }
};

const pages = [
  { page: 'buy.html', file: 'buy.html', deliveryClaim: /Delivered\s+<b>by email<\/b>\s+in minutes/i },
  { page: 'fr/buy.html', file: 'fr/buy.html', deliveryClaim: /Livré\s+<b>par e-mail<\/b>\s+en quelques minutes/i },
  { page: 'compare.html', file: 'compare.html', deliveryClaim: /€20,\s*delivered by email/i },
  { page: 'fr/compare.html', file: 'fr/compare.html', deliveryClaim: /20\s*€,\s*livrés par e-mail/i },
];

for (const { page, file, deliveryClaim } of pages) {
  const html = read(file);
  const flat = html.replace(/\s+/g, ' ');
  const noticeIndex = html.indexOf('id="release-availability-notice"');
  const formIndex = html.indexOf('id="buyForm"');

  check(page + ' : avis de disponibilité accessible présent',
    noticeIndex >= 0 && /role="alert"/.test(html.slice(noticeIndex, noticeIndex + 250)));
  check(page + " : avis placé avant le formulaire d'achat",
    noticeIndex >= 0 && formIndex > noticeIndex);
  check(page + ' : aucune promesse de livraison immédiate', !deliveryClaim.test(flat));
  check(page + " : v1.2.0 n'est pas étiquetée comme version actuelle",
    !/<b>v1\.2\.0<\/b>\s*current release/i.test(html) &&
    !/<b>v1\.2\.0<\/b>\s*version actuelle/i.test(html));
  check(page + " : le support est proposé avant paiement tant que la livraison n'est pas confirmée",
    /do not purchase until delivery is confirmed|n'achetez pas tant que la livraison n'est pas confirmée/i.test(flat));
  check(page + ' : le vrai formulaire de checkout est conservé',
    /id="buyForm"/.test(html) && /id="buyBtn"/.test(html) && /id="buyErr"/.test(html));
  check(page + ' : prix 20,00 EUR inchangé', /20,00\s*€/.test(html));
  check(page + ' : les CTA restent instrumentés',
    (html.match(/data-cta-id=/g) || []).length >= 3);
}

console.log(failures === 0 ? '\nRELEASE AVAILABILITY : OK' : '\nRELEASE AVAILABILITY : ' + failures + ' ECHEC(S)');
process.exit(failures === 0 ? 0 : 1);
