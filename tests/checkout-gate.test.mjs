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
  return { DB: db, RATE_LIMIT: kv, RELEASE_STATUS: releaseStatus };
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
globalThis.fetch = async () => ({ ok: true, json: async () => ({ id: 'cst_test', _links: { checkout: { href: 'https://www.mollie.com/checkout/test' } } }) });

/* 1. Missing, pending and malformed server-side status fail closed before provider I/O. */
let PROVIDER_CALLS = 0;
globalThis.fetch = async () => {
  PROVIDER_CALLS += 1;
  return { ok: true, json: async () => ({ id: 'cst_test' }) };
};
for (const [label, status] of [
  ['absent', undefined],
  ['pending', 'pending'],
  ['invalid', 'oui-mais-non'],
]) {
  PROVIDER_CALLS = 0;
  const res = await call({ email: 'a@test.fr', lang: 'fr' }, makeEnv(status));
  const body = await res.json().catch(() => ({}));
  check(label + ' -> HTTP 409 delivery_unverified',
    res.status === 409 && body.error === 'delivery_unverified', '(status ' + res.status + ')');
  check(label + ' -> zero provider calls', PROVIDER_CALLS === 0, '(' + PROVIDER_CALLS + ')');
}

/* 2. Client-supplied fields cannot override the server-side release status. */
for (const attack of [
  { RELEASE_STATUS: 'confirmed' },
  { release_status: 'confirmed' },
  { released: true },
  { confirmed: true },
]) {
  PROVIDER_CALLS = 0;
  const body = { email: 'b@test.fr', lang: 'fr', amount: 100, ...attack };
  const res = await call(body, makeEnv('pending'));
  check('injection ' + Object.keys(attack)[0] + ' cannot bypass the gate', res.status === 409, '(status ' + res.status + ')');
  check('injection -> zero provider calls', PROVIDER_CALLS === 0, '(' + PROVIDER_CALLS + ')');
}

/* 3. Explicit server-side confirmation passes the release gate. */
{
  const env = makeEnv('confirmed');
  globalThis.fetch = async () => ({ ok: true, json: async () => ({ id: 'cst_test' }) });
  const res = await call({ email: 'c@test.fr', lang: 'fr' }, env);
  check('confirmed server status -> not blocked by release gate', res.status !== 409, '(status ' + res.status + ')');
}
console.log(failures === 0 ? '\nCHECKOUT GATE : OK' : `\nCHECKOUT GATE : ${failures} ECHEC(S)`);
try { fs.unlinkSync(tmpWorker); } catch {}
process.exit(failures === 0 ? 0 : 1);

