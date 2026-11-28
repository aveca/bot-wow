import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const here = path.dirname(fileURLToPath(import.meta.url));
const html = readFileSync(path.join(here, '../fr/features.html'), 'utf8').replace(/^\\uFEFF/, '');

assert.match(html, /<html lang="fr">/, 'la page doit rester déclarée en français');
assert.match(html, /<title>Fonctionnalités BOT-WOW — itinéraires et marge<\\/title>/, 'title localisé et orienté fonctionnalités');
assert.match(html, /name="description" content="[^"]*spots de pêche[^"]*itinéraire[^"]*marge[^"]*données simulées[^"]*automatisation du jeu/i, 'description localisée, factuelle et utile');
assert.match(html, /rel="canonical" href="https:\\/\\/bot-wow\\.com\\/fr\\/features\\.html"/, 'canonical FR conservé');
assert.match(html, /hreflang="en" href="https:\\/\\/bot-wow\\.com\\/features\\.html"/, 'alternate EN conservé');
assert.match(html, /property="og:title"/, 'Open Graph title présent');
assert.match(html, /property="og:description"/, 'Open Graph description présente');
assert.equal((html.match(/<h1\\b/gi) || []).length, 1, 'un seul H1');
assert.match(html, /données simulées/i, 'la démo est explicitement décrite comme simulée');
assert.match(html, /ne se connecte pas au jeu/i, 'absence de connexion au jeu explicitée');
assert.match(html, /ne récupère pas de prix de marché/i, 'source des prix explicitée');
assert.match(html, /jusqu’à 40 spots/i, 'capacité Studio cohérente avec la fiche produit');
assert.match(html, /href="\\.\\/demo\\.html"/, 'lien vers la démo conservé');
assert.match(html, /href="\\.\\/buy\\.html"/, 'lien vers les offres conservé');
assert.match(html, /Planner 9,00 € et Studio 29,00 € en paiement unique/, 'prix existants inchangés');

for (const staleClaim of [
  /lit la fenêtre du jeu/i,
  /Il parcourt la ronde/i,
  /Retour après une mort/i,
  /Odométrie sur la minicarte/i,
  /Testé en conditions réelles/i,
  /licence à vie/i,
  /Assistant de pêche 1\\.2\\.0/i
]) {
  assert.doesNotMatch(html, staleClaim, 'une ancienne promesse d’automatisation ou de licence ne doit pas subsister');
}

console.log('FR FEATURES POSITIONING: PASS — metadata, canonical, hreflang, one H1, factual feature scope, CTA and legacy-claim regression checks.');
