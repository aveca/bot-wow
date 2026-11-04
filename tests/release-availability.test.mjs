#!/usr/bin/env node
/** Static guard for the proposed Early Access pricing pages. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
};

for (const [page, file, unavailableText] of [
  ['buy.html', 'buy.html', 'not available to purchase'],
  ['fr/buy.html', 'fr/buy.html', 'Achat indisponible'],
]) {
  const html = read(file);
  const flat = html.replace(/\s+/g, ' ');
  check(`${page}: availability status is visible`,
    /id="early-access-status"/.test(html) && /role="status"/.test(html));
  check(`${page}: status says the plans are unavailable`, flat.toLowerCase().includes(unavailableText.toLowerCase()));
  check(`${page}: all three proposed monthly prices appear`,
    ['4,99 €', '7,99 €', '9,99 €'].every((price) => flat.includes(price)) && /\/ month|\/ mois/.test(flat));
  check(`${page}: no checkout form, payment button or Mollie claim`,
    !/id="buyForm"|id="buyBtn"|Mollie/i.test(html));
  check(`${page}: install and customer delivery remain disclosed`,
    /clean Windows install|installation Windows propre/i.test(flat) && /customer email delivery|e-mail client/i.test(flat));
  check(`${page}: plan entitlements are not presented as active`,
    /not implemented|pas implément/i.test(flat));
  check(`${page}: existing lifetime licences remain honoured`,
    /existing lifetime licences remain honoured|licences à vie déjà accordées restent honorées/i.test(flat));
  check(`${page}: old €20 lifetime offer is absent`,
    !/20,00\s*€/.test(flat) && !/€20(?:\.00)?\s*(?:once|lifetime)/i.test(flat));
  check(`${page}: plan CTAs remain instrumented`,
    (html.match(/data-cta-id="buy-/g) || []).length >= 4);
}

const redirects = read('_redirects');
for (const [source, target] of [
  ['/ab/a/buy.html', '/buy.html'],
  ['/ab/b/buy.html', '/buy.html'],
  ['/ab/a/fr/buy.html', '/fr/buy.html'],
  ['/ab/b/fr/buy.html', '/fr/buy.html'],
]) {
  const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  check(`${source}: legacy purchase entry redirects to unavailable Early Access`,
    new RegExp(`^${escaped}\\s+${target.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+301$`, 'm').test(redirects));
}

console.log(failures === 0 ? '\nEARLY ACCESS PRICING : OK' : `\nEARLY ACCESS PRICING : ${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
