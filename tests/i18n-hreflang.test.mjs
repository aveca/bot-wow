#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log('  ok   ' + name);
  else { failures += 1; console.log('  FAIL ' + name + ' ' + detail); }
};
const STRIPE = 'https://buy.stripe.com/00wbJ3gHAdHEf78fF863K00';
const WAITLIST = 'mailto:support@bot-wow.com';
const pages = [
  ['index.html', 'en', 'https://bot-wow.com/'],
  ['de/index.html', 'de', 'https://bot-wow.com/de/'],
  ['es/index.html', 'es', 'https://bot-wow.com/es/'],
  ['pt-br/index.html', 'pt-BR', 'https://bot-wow.com/pt-br/'],
  ['ru/index.html', 'ru', 'https://bot-wow.com/ru/'],
  ['it/index.html', 'it', 'https://bot-wow.com/it/'],
  ['pl/index.html', 'pl', 'https://bot-wow.com/pl/'],
  ['fr/index.html', 'fr', 'https://bot-wow.com/fr/'],
];
for (const [file, lang, canon] of pages) {
  const html = read(file);
  check(file + ' lang', html.includes(`<html lang="${lang}">`));
  check(file + ' canonical', html.includes(`rel="canonical" href="${canon}"`));
  check(file + ' x-default', /hreflang="x-default" href="https:\/\/bot-wow\.com\/"/.test(html));
  check(file + ' hreflang de', html.includes('hreflang="de" href="https://bot-wow.com/de/"'));
  check(file + ' no stripe payment link', !html.includes(STRIPE));
  check(file + ' waitlist mail', html.includes(WAITLIST));
  check(file + ' no redirect script', !/window\.location\s*=/.test(html));
  check(file + ' switcher', html.includes('class="langs"') && html.includes('lang="pt-BR"'));
}
const terms = read('legal/de/terms.html');
check('de terms third-party risk', /eigenes Risiko|Drittanbieter/.test(terms));
const worker = read('worker/index.js');
check('worker accepts it and pt-br', worker.includes('"pt-br"') && worker.includes('"it"') && worker.includes('"pl"'));
check('worker sets stripe locale', worker.includes('body.set("locale", stripeLocale(params.lang))'));
const sitemap = read('sitemap.xml');
check('sitemap pt-BR home', sitemap.includes('hreflang="pt-BR" href="https://bot-wow.com/pt-br/"'));
check('robots sitemap', read('robots.txt').includes('Sitemap: https://bot-wow.com/sitemap.xml'));
console.log(failures ? `\nI18N : ${failures} ECHEC(S)` : '\nI18N : OK');
process.exit(failures ? 1 : 0);
