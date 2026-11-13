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
  {file:'product.html',lang:'en',buy:'https://bot-wow.com/buy.html',interfaceNote:'Companion interface currently in English.',noGame:'It does not connect to World of Warcraft',noLive:'live Auction House prices',noDownload:'no downloadable package is offered'},
  {file:'fr/product.html',lang:'fr',buy:'https://bot-wow.com/fr/buy.html',interfaceNote:'Interface du compagnon est actuellement en anglais.',noGame:'Il ne se connecte pas à World of Warcraft',noLive:'prix en direct de l’hôtel des ventes',noDownload:'aucun paquet téléchargeable n’est proposé'},
  {file:'de/product.html',lang:'de',buy:'https://bot-wow.com/product.html',checkoutNote:'Der Kaufabschluss ist derzeit auf Englisch, Französisch und Spanisch verfügbar. Diese Seite führt zu den aktuellen Kaufoptionen auf Englisch.',interfaceNote:'Die Begleiter-Oberfläche ist derzeit auf Englisch.',noGame:'Es verbindet sich nicht mit World of Warcraft',noLive:'Live-Auktionshauspreise',noDownload:'ein Downloadpaket wird nicht angeboten'},
  {file:'es/product.html',lang:'es',buy:'https://bot-wow.com/es/buy.html',interfaceNote:'La interfaz del compañero está actualmente en inglés.',noGame:'No se conecta a World of Warcraft',noLive:'precios en directo de la casa de subastas',noDownload:'no se ofrece un paquete descargable'},
  {file:'pt-br/product.html',lang:'pt-BR',buy:'https://bot-wow.com/product.html',checkoutNote:'O checkout está disponível atualmente em inglês, francês e espanhol. Esta página leva às opções atuais em inglês.',interfaceNote:'A interface do companheiro está atualmente em inglês.',noGame:'Não se conecta ao World of Warcraft',noLive:'preços ao vivo da Casa de Leilões',noDownload:'nenhum pacote para download é oferecido'},
  {file:'ru/product.html',lang:'ru',buy:'https://bot-wow.com/product.html',checkoutNote:'Покупка сейчас доступна на английском, французском и испанском. Эта страница ведёт к актуальным вариантам покупки на английском.',interfaceNote:'Интерфейс помощника пока доступен на английском.',noGame:'Он не подключается к World of Warcraft',noLive:'актуальные цены аукциона',noDownload:'скачиваемый пакет не предлагается'},
  {file:'it/product.html',lang:'it',buy:'https://bot-wow.com/product.html',checkoutNote:'Il checkout è attualmente disponibile in inglese, francese e spagnolo. Questa pagina porta alle opzioni di acquisto aggiornate in inglese.',interfaceNote:'L’interfaccia del compagno è attualmente in inglese.',noGame:'Non si collega a World of Warcraft',noLive:'prezzi in tempo reale della casa d’aste',noDownload:'non viene offerto un pacchetto scaricabile'},
  {file:'pl/product.html',lang:'pl',buy:'https://bot-wow.com/product.html',checkoutNote:'Płatność jest obecnie dostępna po angielsku, francusku i hiszpańsku. Ta strona prowadzi do aktualnych opcji zakupu po angielsku.',interfaceNote:'Interfejs towarzysza jest obecnie po angielsku.',noGame:'Nie łączy się z World of Warcraft',noLive:'aktualnych cen z domu aukcyjnego',noDownload:'pakiet do pobrania nie jest oferowany'},
];
const URLS = [
  'https://bot-wow.com/product.html','https://bot-wow.com/fr/product.html',
  'https://bot-wow.com/de/product.html','https://bot-wow.com/es/product.html',
  'https://bot-wow.com/pt-br/product.html','https://bot-wow.com/ru/product.html',
  'https://bot-wow.com/it/product.html','https://bot-wow.com/pl/product.html',
];
const OLD = ['Fishing Assistant 1.2.0','v1.2.0','beta reservation','réservation bêta','reserva de la beta','Beta-Reservierung','20,00 €','no module is distributed to customers today',"aucun module n'est distribué aux clients aujourd'hui",'Classic 1.13','interface 20506','257418c'];

console.log('=== CURRENT COMPANION STOREFRONT ===');
check('build-site publishes product.html', FILES.includes('product.html'));
const sitemap = read('sitemap.xml');
for (const url of URLS) check('sitemap includes ' + url, sitemap.includes('<loc>' + url + '</loc>'));
const companion = read('companion.html');
check('companion implements the 4 / 12 / 40 spot tiers', companion.includes('const FREE = 4, PLANNER = 12, STUDIO = 40;'));
check('companion uses the user-entered margin formula', companion.includes('(sell − buy) × count'));
check('companion key gate is present', companion.includes('id="key-form"'));

for (const p of PAGES) {
  const html = read(p.file);
  const canonical = 'https://bot-wow.com/' + (p.file === 'product.html' ? '' : p.file.replace('product.html','')) + 'product.html';
  check(p.file + ' declares language ' + p.lang, html.includes('<html lang="' + p.lang + '">'));
  check(p.file + ' has one H1', (html.match(/<h1[> ]/g) || []).length === 1);
  check(p.file + ' has title and description', html.includes('<title>') && html.includes('</title>') && html.includes('<meta name="description" content="'));
  check(p.file + ' has canonical', html.includes('<link rel="canonical" href="' + canonical + '">'));
  check(p.file + ' includes all language alternates', URLS.every((u) => html.includes(u)) && html.includes('hreflang="x-default"'));
  check(p.file + ' shows Free 4 / Planner 12 / Studio 40',
    html.includes('data-plan="free" data-spot-cap="4" data-price-eur="0"') &&
    html.includes('data-plan="planner" data-spot-cap="12" data-price-eur="9"') &&
    html.includes('data-plan="studio" data-spot-cap="40" data-price-eur="29"'));
  check(p.file + ' documents the manual margin formula', html.includes('data-formula="(sell-buy)*count"') && html.includes('sell − buy'));
  check(p.file + ' links to the live companion', html.includes('href="https://bot-wow.com/companion.html"'));
  check(p.file + ' routes to a supported purchase page', html.includes('href="' + p.buy + '"'));
  check(p.file + ' discloses the companion UI language', html.includes(p.interfaceNote));
  check(p.file + ' is clear about no game connection', html.includes(p.noGame));
  check(p.file + ' is clear about no live market prices', html.includes(p.noLive));
  check(p.file + ' is clear that no downloadable package is offered', html.includes(p.noDownload));
  check(p.file + ' removes legacy product and beta claims', !OLD.some((s) => html.toLowerCase().includes(s.toLowerCase())));
  check(p.file + ' does not collect email addresses', !html.includes('type="email"') && !html.includes('id="buyForm"'));
  check(p.file + ' does not bypass the current Stripe buy page', !html.includes('buy.stripe.com'));
  const ids = [...html.matchAll(/data-track="cta_click"[^>]*data-cta-id="([a-z0-9-]+)"/g)].map((m) => m[1]);
  check(p.file + ' loads analytics and language scripts', html.includes('assets/app.js?v=91f5f0fa') && html.includes('assets/lang-suggest.js?v=91f5f0fa'));
  check(p.file + ' has unique instrumented CTA ids', ids.length >= 4 && new Set(ids).size === ids.length);
}
for (const [file,href] of [['demo.html','./companion.html'],['fr/demo.html','../companion.html']]) {
  const html = read(file);
  check(file + ' links directly to the live companion', html.includes('href="' + href + '"') && html.includes('data-cta-id="demo-live-companion"'));
  check(file + ' removes the stale commercial-availability disclaimer',
    !html.includes('does not establish a verified package') && !html.includes('ne prouve ni l’existence d’un paquet vérifié'));
}
for (const file of ['buy.html','fr/buy.html']) {
  const html = read(file);
  check(file + ' retains current Planner and Studio checkout links',
    html.includes('9,00 €') && html.includes('29,00 €') && html.includes('buy.stripe.com'));
  check(file + ' links to the current product sheet', html.includes('product.html'));
}
if (failures) {
  console.error('CURRENT COMPANION STOREFRONT FAILED: ' + failures);
  process.exit(1);
}
console.log('CURRENT COMPANION STOREFRONT PASS');
