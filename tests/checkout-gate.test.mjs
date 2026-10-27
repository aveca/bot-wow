#!/usr/bin/env node
/**
 * checkout-gate.test.mjs - la garde de livraison du checkout.
 *
 * Defaut couvert : la page dit « ne pas acheter tant que la livraison n'est
 * pas confirmee » mais /api/checkout encaissait quand meme. Le Worker refuse
 * maintenant tant que RELEASE_STATUS !== 'confirmed'.
 *
 * Point cle : l'etat est cote serveur. Un visiteur ne doit PAS pouvoir le
 * contourner en injectant un champ dans le corps de la requete.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
/* Meme mecanique que checkout-security : on copie le Worker puis on
   l'importe dynamiquement, pour qu'il s'execute comme un module ES. */
const tmpWorker = path.join(HERE, '.worker-under-test.mjs');
fs.writeFileSync(tmpWorker, fs.readFileSync(path.join(REPO, 'worker', 'index.js'), 'utf8'));
const workerMod = await import('file:///' + tmpWorker.replace(/\\/g, '/') + '?t=' + Date.now());

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
};

function makeEnv(releaseStatus) {
  const store = new Map();
  const kv = {
    get: async (k) => { const v = store.get(k); return v === undefined ? null : v; },
    put: async (k, v) => { store.set(k, v); },
    delete: async (k) => { store.delete(k); },
  };
  const db = {
    prepare(sql) {
      const key = sql.replace(/\s+/g, ' ').trim();
      return { bind: () => ({
        run: async () => ({ meta: { last_row_id: 0 } }),
        first: async () => (/FROM mollie_customers/i.test(key) ? null : null),
        all: async () => [],
      }) };
    },
    batch: async () => [],
  };
  return { DB: db, RATE_LIMIT: kv, RELEASE_STATUS: releaseStatus || 'pending' };
}

function call(body, env, ip) {
  const req = new Request('https://api.bot-wow.com/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip || '203.0.113.10' },
    body: JSON.stringify(body),
  });
  return workerMod.default.fetch(req, env, {});
}

console.log('=== GARDE DE LIVRAISON DU CHECKOUT ===');

/* 1. Livraison NON confirmee -> 409, aucun encaissement. */
{
  const res = await call({ email: 'a@test.fr', lang: 'fr' }, makeEnv('pending'));
  const b = await res.json();
  check('livraison pending -> 409', res.status === 409, `(status ${res.status})`);
  check('erreur delivery_unverified', b.error === 'delivery_unverified', `(${b.error})`);
  check('le message invite a contacter le support', /support/i.test(b.message || ''));
  check('Retry-After present', Number(res.headers.get('Retry-After')) > 0);
}

/* 2. Un visiteur NE PEUT PAS contourner la garde via le corps. */
for (const attack of [
  { RELEASE_STATUS: 'confirmed' },
  { release_status: 'confirmed' },
  { released: true },
  { confirmed: true },
]) {
  const body = { email: 'b@test.fr', lang: 'fr', ...attack };
  const res = await call(body, makeEnv('pending'));
  const b = await res.json();
  check(`contournement refuse (${Object.keys(attack)[0]})`,
    res.status === 409 && b.error === 'delivery_unverified', `(status ${res.status})`);
}

/* 3. Livraison confirmee -> le checkout fonctionne (pas de 409). */
{
  const env = makeEnv('confirmed');
  // Fetch simule : on n'a pas de vrai reseau, on verifie juste que la garde
  // ne bloque plus, i.e. que le code va jusqu'a l'appel Mollie.
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ id: 'cst_test' }) });
  const res = await call({ email: 'c@test.fr', lang: 'fr' }, env);
  check('livraison confirmed -> la garde ne bloque plus (pas de 409)',
    res.status !== 409, `(status ${res.status})`);
}

console.log(failures === 0 ? '\nCHECKOUT GATE : OK' : `\nCHECKOUT GATE : ${failures} ECHEC(S)`);
try { fs.unlinkSync(tmpWorker); } catch {}
process.exit(failures === 0 ? 0 : 1);
