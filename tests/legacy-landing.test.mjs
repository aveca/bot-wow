#!/usr/bin/env node
/**
 * tests/legacy-landing.test.mjs — l'hote API ne doit plus servir de page
 * marketing contradictoire.
 *
 * CONTEXTE MESURE (2026-11-04, production) :
 *   https://api.bot-wow.com/de/  -> HTTP 200, HTML contenant
 *     - « anti-detection »
 *     - « Farm your WoW gold »
 *     - « 100% free » / « Get BOT-WOW free »
 *     - JSON-LD SoftwareApplication avec "offers":{"price":"0"}
 *   Meme constat sur /en/, /es/, /pt/, /ru/.
 *
 * Ces contenus contredisaient l'offre unique payante (20 EUR) et le registre
 * de modules (seul `fish` est `available`, les promesses d'indetectabilite
 * sont explicitement interdites). Le test verrouille la correction :
 * toute requete GET non-API sur l'hote API redirige (308) vers l'URL
 * canonique unique, et le code source ne contient plus aucune de ces
 * promesses.
 *
 * Aucun paiement, aucun e-mail, aucun appel a un service tiers.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
}

const workerSrc = readFileSync(join(REPO, 'worker', 'index.js'), 'utf8');
const tmpWorker = join(HERE, '.worker-under-test.mjs');
writeFileSync(tmpWorker, workerSrc);
const workerMod = await import('file:///' + tmpWorker.replace(/\\/g, '/') + '?t=' + Date.now());

/* Les anciennes routes localisationnees que le generateur legacy servait. */
const LEGACY_PATHS = ['/', '/de/', '/en/', '/es/', '/pt/', '/ru/', '/de/index.html'];

/* Promesses interdites : ne doivent plus exister dans le Worker deploye. */
const FORBIDDEN = [
  ['anti-detection', 'promesse d\'indetectabilite'],
  ['"price":"0"', 'JSON-LD prix 0'],
  ['Farm your', 'promesse de farm de l\'or'],
  ['100% free', 'promesse gratuite'],
  ['Get BOT-WOW free', 'promesse gratuite'],
  ['Free lifetime access', 'promesse gratuite'],
  ['handleLanding(', 'appel au generateur legacy'],
];

console.log('=== OFFRE UNIQUE : aucune page legacy contradictoire ===');

/* ----- 1. Le code source ne contient plus les promesses interdites ----- */
for (const [needle, label] of FORBIDDEN) {
  check(`le Worker ne contient plus « ${label} » (${needle})`, !workerSrc.includes(needle));
}

/* ----- 2. Toute route non-API redirige vers le site canonique ----- */
for (const path of LEGACY_PATHS) {
  const req = new Request('https://api.bot-wow.com' + path, { method: 'GET' });
  const res = await workerMod.default.fetch(req, {}, {});
  const location = res.headers.get('location') || '';
  check(`GET ${path} redirige (308)`, res.status === 308, `(status=${res.status})`);
  check(`GET ${path} cible le site canonique`, location.startsWith('https://bot-wow.com'), `(location=${location})`);
  const body = res.status === 308 ? '' : await res.text();
  check(`GET ${path} ne rend aucun HTML marketing`, !/anti-detection|Farm your|100% free/i.test(body));
}

/* ----- 3. Les routes API restent intactes (pas de regression) ----- */
{
  const env = {
    DB: { prepare: () => ({ bind: () => ({ run: async () => ({ meta: { last_row_id: 0 } }), first: async () => null, all: async () => [] }), run: async () => ({ meta: { last_row_id: 0 } }), first: async () => null, all: async () => [] }) },
    RATE_LIMIT: { get: async () => null, put: async () => {} },
  };
  const res = await workerMod.default.fetch(new Request('https://api.bot-wow.com/api/config', { method: 'GET' }), env, {});
  check('/api/config repond toujours 200', res.status === 200, `(status=${res.status})`);
  const data = await res.json();
  check('/api/config annonce toujours 20 EUR', data.priceEur === 20, `(priceEur=${data.priceEur})`);
  check('/api/config annonce le produit unique', data.product === 'bot-wow-lifetime', `(product=${data.product})`);
}

/* ----- 4. Le prix serveur reste aligne sur le prix affiche ----- */
{
  const m = workerSrc.match(/PRICE_TABLE\s*=\s*\{[\s\S]{0,200}?amount:\s*(\d+),\s*currency:\s*"([A-Z]+)"/);
  check('PRICE_TABLE est toujours a 2000 centimes', !!m && m[1] === '2000', `(trouve=${m ? m[1] : 'aucun'})`);
  check('PRICE_TABLE reste en EUR', !!m && m[2] === 'EUR', `(devise=${m ? m[2] : 'aucune'})`);
}

/* ----- 5. Une seule offre payante cote Worker (pas de forfaits articiels) ----- */
{
  const tableMatch = workerSrc.match(/PRICE_TABLE\s*=\s*\{([\s\S]*?)\n\};/);
  // On compte les CLES d'offre ("id": { ... }), pas les chaines (la
  // description et la devise sont aussi entre guillemets).
  const keys = tableMatch ? (tableMatch[1].match(/^\s*"[^"]+"\s*:\s*\{/gm) || []) : [];
  check('PRICE_TABLE ne contient qu\'une seule offre', keys.length === 1, `(offres=${keys.length})`);
}

console.log('');
console.log(failures === 0 ? 'OFFRE UNIQUE : OK' : `OFFRE UNIQUE : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
