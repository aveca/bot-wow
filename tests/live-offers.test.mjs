#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PLANNER = 'https://buy.stripe.com/4gM4gB62W4749MO78C63K01';
const STUDIO = 'https://buy.stripe.com/eVqdRb8b4dHE6AC50u63K02';
const BUY = ['buy.html', 'fr/buy.html', 'es/buy.html'];
const SKIP = new Set(['node_modules', '.git', '_site', 'artifacts', 'backups', 'tests', 'reports']);

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log('  ok   ' + name);
  else { failures += 1; console.log('  FAIL ' + name + (detail ? ' ' + detail : '')); }
};

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (entry.name.endsWith('.html')) out.push(full);
  }
  return out;
}

for (const file of BUY) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  check(file + ' : lien LIVE Planner', html.includes(PLANNER));
  check(file + ' : lien LIVE Studio', html.includes(STUDIO));
  check(file + ' : ancre #planner', /id="planner"/.test(html));
  check(file + ' : ancre #studio', /id="studio"/.test(html));
  check(file + ' : pas de mailto de liste d’attente', !/subject=BOT-WOW%20(liste|waitlist|offers)/i.test(html));
}

const frHome = fs.readFileSync(path.join(ROOT, 'fr/index.html'), 'utf8');
check('fr/index.html : retire l’ancien statut indisponible', !/Pas encore en vente|pas de prix, pas de paiement|Il n’existe pas de produit conforme livrable/i.test(frHome));
check('fr/index.html : affiche Planner et Studio avec leurs prix', /Planner/.test(frHome) && /Studio/.test(frHome) && frHome.includes('9,00 €') && frHome.includes('29,00 €'));
check('fr/index.html : CTA vers les offres', frHome.includes('href="./buy.html"') && frHome.includes('data-cta-id="fr-home-offers"'));

const FAQ = ['faq.html', 'fr/faq.html', 'es/faq.html'];
const CURRENT_PAGES = ['es/index.html', 'es/buy.html'];
const LEGACY_AUTOMATION_COPY = /Windows fishing assistant|assistant de pêche Windows|asistente de pesca en Windows|Leer la ventana|Clic como mensaje de ventana|Probado en condiciones reales/i;
const RESERVATION_COPY = /reservation|review|réservation|vérification|reserva|revisión/i;

for (const file of FAQ) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  check(file + ' : description du companion actuel', /browser companion|compagnon dans le navigateur|compañero en el navegador/i.test(html));
  check(file + ' : prix Planner et Studio', html.includes('9,00 €') && html.includes('29,00 €'));
  check(file + ' : réservation et livraison après revue', RESERVATION_COPY.test(html));
  check(file + ' : aucune ancienne automatisation de jeu', !LEGACY_AUTOMATION_COPY.test(html));
}

for (const file of CURRENT_PAGES) {
  const html = fs.readFileSync(path.join(ROOT, file), 'utf8');
  check(file + ' : offre Planner/Studio', /Planner/.test(html) && /Studio/.test(html));
  check(file + ' : réservation et livraison après revue', RESERVATION_COPY.test(html));
  check(file + ' : aucune ancienne automatisation de jeu', !LEGACY_AUTOMATION_COPY.test(html));
}

for (const full of walk(ROOT)) {
  const rel = path.relative(ROOT, full);
  const html = fs.readFileSync(full, 'utf8');
  const flat = html.toLowerCase();
  check(rel + ' : pas de « no paid offer »', !flat.includes('no paid offer'));
  check(rel + ' : pas de « waitlist »', !flat.includes('waitlist'));
}

console.log(failures ? `\nOFFRES LIVE : ${failures} ECHEC(S)` : '\nOFFRES LIVE : OK');
process.exit(failures ? 1 : 0);
