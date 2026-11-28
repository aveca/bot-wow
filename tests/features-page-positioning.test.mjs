import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(here, '../fr/features.html'), 'utf8')
  .replace(String.fromCharCode(0xFEFF), '');

const includes = (value, message) => assert.ok(html.includes(value), message);

includes('<html lang="fr">', 'la page doit rester déclarée en français');
includes('<title>Fonctionnalités BOT-WOW — itinéraires et marge</title>', 'title localisé et orienté fonctionnalités');
includes('Planifiez vos spots de pêche, ordonnez un itinéraire et calculez une marge avec vos propres prix.', 'description utile et localisée');
includes('Démo sur données simulées, sans connexion ni automatisation du jeu.', 'description honnête sur la démo et le périmètre');
includes('<link rel="canonical" href="https://bot-wow.com/fr/features.html">', 'canonical FR conservé');
includes('<link rel="alternate" hreflang="en" href="https://bot-wow.com/features.html">', 'alternate EN conservé');
includes('<meta property="og:title"', 'Open Graph title présent');
includes('<meta property="og:description"', 'Open Graph description présente');
assert.equal(html.split('<h1').length - 1, 1, 'un seul H1');
includes('données simulées', 'la démo est explicitement décrite comme simulée');
includes('ne se connecte pas au jeu', 'absence de connexion au jeu explicitée');
includes('ne récupère pas de prix de marché', 'source des prix explicitée');
includes('jusqu’à 40 spots', 'capacité Studio cohérente avec la fiche produit');
includes('href="./demo.html"', 'lien vers la démo conservé');
includes('href="./buy.html"', 'lien vers les offres conservé');
includes('Planner 9,00 € et Studio 29,00 € en paiement unique', 'prix existants inchangés');

for (const staleClaim of [
  'L’assistant, lui, lit la fenêtre du jeu.',
  'Il parcourt la ronde',
  'Retour après une mort',
  'Odométrie sur la minicarte',
  'Testé en conditions réelles',
  'une licence à vie',
  'Assistant de pêche 1.2.0'
]) {
  assert.equal(html.includes(staleClaim), false, 'ancienne promesse ou description legacy absente : ' + staleClaim);
}

console.log('FR FEATURES POSITIONING: PASS — metadata, canonical, hreflang, one H1, factual feature scope, CTA and legacy-claim regression checks.');
