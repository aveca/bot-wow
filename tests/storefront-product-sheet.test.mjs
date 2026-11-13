#!/usr/bin/env node
/** Current BOT-WOW companion storefront contract.
 * The paid product is a browser companion, not the former game-control client.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FILES } from '../scripts/build-site.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log('  ok   ' + name);
  else { failures += 1; console.log('  FAIL ' + name + ' ' + detail); }
};
const PAGES = [
  ['product.html','en'],['fr/product.html','fr'],['de/product.html','de'],
  ['es/product.html','es'],['pt-br/product.html','pt-BR'],['ru/product.html','ru'],
  ['it/product.html','it'],['pl/product.html','pl'],
];
const URLS = [
  'https://bot-wow.com/product.html','https://bot-wow.com/fr/product.html',
  'https://bot-wow.com/de/product.html','https://bot-wow.com/es/product.html',
  'https://bot-wow.com/pt-br/product.html','https://bot-wow.com/ru/product.html',
  'https://bot-wow.com/it/product.html','https://bot-wow.com/pl/product.html',
];
const OLD = /Fishing Assistant 1\\.2\\.0|v1\\.2\\.0|beta reservation|réservation bêta|reserva de la beta|Beta-Reservierung|20,00\\s*€|no module is distributed to customers today|aucun module n'est distribué aux clients aujourd'hui|Classic 1\\.13|interface 20506|257418c/i;

console.log('=== CURRENT COMPANION STOREFRONT ===');
check('build-site publishes product.html', FILES.includes('product.html'));
const sitemap = read('sitemap.xml');
for (const url of URLS) check('sitemap includes ' + url, sitemap.includes('<loc>' + url + '</loc>'));
const companion = read('companion.html');
check('companion implements the 4 / 12 / 40 spot tiers', /FREE\\s*=\\s*4/.test(companion) && /PLANNER\\s*=\\s*12/.test(companion) && /STUDIO\\s*=\\s*40/.test(companion));
check('companion uses user-entered margin inputs', /sell\\s*−\\s*buy|sell\\s*-\\s*buy/.test(companion) && /count/.test(companion));
check('companion key gate is present', /key-form/.test(companion) && /Check key/.test(companion));

for (const [file,lang] of PAGES) {
  const html = read(file);
  check(file + ' declares language ' + lang, new RegExp('<html lang="' + lang + '">').test(html));
  check(file + ' has one H1', (html.match(/<h1[\\s>]/g) || []).length === 1);
  check(file + ' has title and description', /<title>[^<]+<\\/title>/.test(html) && /<meta name="description" content="[^"]+"/.test(html));
  check(file + ' has canonical', html.includes('<link rel="canonical" href="https://bot-wow.com/' + (file==='product.html'?'':file.replace('product.html','')) + 'product.html">'));
  check(file + ' includes all language alternates', URLS.every((u) => html.includes(u)) && html.includes('hreflang="x-default"'));
  check(file + ' shows Free 4 / Planner 12 / Studio 40',
    /data-plan="free" data-spot-cap="4" data-price-eur="0"/.test(html) &&
    /data-plan="planner" data-spot-cap="12" data-price-eur="9"/.test(html) &&
    /data-plan="studio" data-spot-cap="40" data-price-eur="29"/.test(html));
  check(file + ' documents the manual margin formula', /data-formula="\\(sell-buy\\)\\*count"/.test(html) && /sell − buy/.test(html));
  check(file + ' links to the live companion', /href="https:\\/\\/bot-wow\\.com\\/companion\\.html"/.test(html));
  check(file + ' links to its localised buy page', html.includes('href="https://bot-wow.com/' + (file==='product.html'?'':file.replace('product.html','')) + 'buy.html"'));
  check(file + ' is clear about no game control and no live prices', /does not connect|ne se connect pas|no se conecta|verbindet sich nicht|não se conecta|не подключается|non si collega|nie łączy/i.test(html) && /live|direct|en direct|en vivo|Live-Auktionshaus|ao vivo|актуальн|tempo reale|aktualnych/i.test(html));
  check(file + ' is clear that no downloadable package is offered', /no downloadable package|aucun paquet téléchargeable|kein Downloadpaket|paquete descargable|pacote para download|скачиваемый пакет|pacchetto scaricabile|pakiet do pobrania/i.test(html));
  check(file + ' removes legacy product and beta claims', !OLD.test(html));
  check(file + ' does not collect email addresses', !/type="email"|id="buyForm"/i.test(html));
  const ids = [...html.matchAll(/data-track="cta_click"[^>]*data-cta-id="([a-z0-9-]+)"/g)].map((m) => m[1]);
  check(file + ' has unique instrumented CTA ids', ids.length >= 4 && new Set(ids).size === ids.length);
}
for (const [file,href] of [['demo.html','./companion.html'],['fr/demo.html','../companion.html']]) {
  const html = read(file);
  check(file + ' links directly to the live companion', html.includes('href="' + href + '"') && /data-cta-id="demo-live-companion"/.test(html));
  check(file + ' removes the stale commercial-availability disclaimer', !/does not establish a verified package|ne prouve ni l’existence d’un paquet vérifié/i.test(html));
}
for (const [file] of [['buy.html'],['fr/buy.html']]) {
  const html = read(file);
  check(file + ' retains the current Planner and Studio offers', /9,00\\s*€/.test(html) && /29,00\\s*€/.test(html) && /buy\\.stripe\\.com/.test(html));
  check(file + ' links to the product sheet', html.includes('product.html'));
}
if (failures) {
  console.error('CURRENT COMPANION STOREFRONT FAILED: ' + failures);
  process.exit(1);
}
console.log('CURRENT COMPANION STOREFRONT PASS');
