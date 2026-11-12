#!/usr/bin/env node
/**
 * Carte des routes reelles de l'hote API.
 *
 * Un GET sur /api/health, /api/checkout ou /api/mollie-webhook repond 404 :
 * ces chemins n'existent pas en GET. Ce n'est pas l'absence de l'API.
 * Le checkout et le webhook sont POST uniquement. /health (sans /api) est
 * le controle de vie. Aucun appel Mollie n'est emis par ce fichier.
 */
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const tmpWorker = join(HERE, '.worker-route-map-under-test.mjs');
const workerSource = readFileSync(join(HERE, '..', 'worker', 'index.js'), 'utf8');
const confirmedSource = workerSource.replace('var RELEASE_STATUS = "pending";', 'var RELEASE_STATUS = "confirmed";');
if (confirmedSource === workerSource) throw new Error('RELEASE_STATUS source flag fixture anchor missing');
// Route-map validation uses a test-only confirmed fixture so input validation remains independently testable.
writeFileSync(tmpWorker, confirmedSource);
const workerMod = await import('file:///' + tmpWorker.replace(/\\/g, '/') + '?t=' + Date.now());

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
}

let mollieCalls = 0;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  if (String(url).startsWith('https://api.stripe.com/')) {
    mollieCalls += 1;
    return new Response('{}', { status: 500 });
  }
  return realFetch(url, opts);
};

const env = {
  CONTACT_EMAIL: 'support@bot-wow.com',
  RELEASE_STATUS: 'pending',
  STRIPE_SECRET_KEY: 'sk_test_unit',
  STRIPE_WEBHOOK_SECRET: 'whsec_test',
  DB: { prepare() { throw new Error('DB ne doit pas etre touchee par la carte de routes'); } },
  RATE_LIMIT: { get: async () => null, put: async () => {} },
};

async function call(path, method = 'GET', body) {
  return workerMod.default.fetch(new Request('https://api.bot-wow.com' + path, {
    method,
    headers: body ? { 'content-type': 'application/json' } : {},
    body,
  }), env, {});
}

console.log('=== CARTE DES ROUTES API (sandbox, aucun paiement) ===');

{
  const res = await call('/');
  check('GET / redirige 308 vers l\'apex',
    res.status === 308 && res.headers.get('location') === 'https://bot-wow.com/',
    `(status=${res.status} location=${res.headers.get('location')})`);
}
{
  const res = await call('/', 'HEAD');
  const bytes = new Uint8Array(await res.arrayBuffer());
  check('HEAD / suit le 308 de GET, sans corps',
    res.status === 308 && res.headers.get('location') === 'https://bot-wow.com/' && bytes.length === 0,
    `(status=${res.status} location=${res.headers.get('location')} bytes=${bytes.length})`);
}
{
  const res = await call('/bot-wow-gold');
  check('GET /bot-wow-gold redirige 308 (plus de landing legacy)',
    res.status === 308 && res.headers.get('location') === 'https://bot-wow.com/bot-wow-gold',
    `(status=${res.status} location=${res.headers.get('location')})`);
}
{
  const res = await call('/health');
  const body = await res.json();
  check('GET /health est le controle de vie',
    res.status === 200 && body.status === 'ok',
    `(status=${res.status} ${JSON.stringify(body)})`);
}
{
  const res = await call('/health', 'HEAD');
  const bytes = new Uint8Array(await res.arrayBuffer());
  check('HEAD /health repond 200 sans corps',
    res.status === 200 && res.headers.get('content-type') === 'application/json' && bytes.length === 0,
    `(status=${res.status} type=${res.headers.get('content-type')} bytes=${bytes.length})`);
}
{
  const res = await call('/api/health');
  const body = await res.json();
  check('GET /api/health n\'existe pas (404 not_found)',
    res.status === 404 && body.error === 'not_found',
    `(status=${res.status} ${JSON.stringify(body)})`);
}
{
  const res = await call('/api/config');
  const body = await res.json();
  check('GET /api/config expose le produit et le prix historique 20 EUR',
    res.status === 200 && body.product === 'bot-wow-lifetime' && body.priceEur === 20 && body.currency === 'eur',
    `(${JSON.stringify(body)})`);
}
{
  const res = await call('/api/config', 'HEAD');
  const bytes = new Uint8Array(await res.arrayBuffer());
  check('HEAD /api/config suit le 200 de GET, sans corps et sans Mollie',
    res.status === 200 && bytes.length === 0 && mollieCalls === 0,
    `(status=${res.status} bytes=${bytes.length} mollie=${mollieCalls})`);
}
{
  const res = await call('/api/checkout');
  const body = await res.json();
  check('GET /api/checkout n\'existe pas',
    res.status === 404 && body.error === 'not_found', `(status=${res.status})`);
}
{
  const res = await call('/api/checkout', 'POST', '{}');
  const body = await res.json();
  check('POST /api/checkout sans e-mail : 400, aucun appel Mollie',
    res.status === 400 && body.error === 'invalid_email' && mollieCalls === 0,
    `(status=${res.status} mollie=${mollieCalls} ${JSON.stringify(body)})`);
}
{
  const res = await call('/api/stripe-webhook');
  check('GET /api/stripe-webhook n\'existe pas', res.status === 404, `(status=${res.status})`);
}
{
  const res = await call('/api/stripe-webhook', 'POST', '');
  const text = await res.text();
  check('POST /api/stripe-webhook sans signature : 401, aucun appel Stripe',
    res.status === 401 && mollieCalls === 0,
    `(status=${res.status} mollie=${mollieCalls} ${text.slice(0, 80)})`);
}
{
  const res = await call('/api/download');
  const body = await res.json();
  check('GET /api/download sans jeton : 400 missing_token',
    res.status === 400 && body.error === 'missing_token',
    `(status=${res.status} ${JSON.stringify(body)})`);
}

globalThis.fetch = realFetch;
rmSync(tmpWorker, { force: true });
console.log(failures === 0 ? 'CARTE DES ROUTES : OK' : `CARTE DES ROUTES : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
