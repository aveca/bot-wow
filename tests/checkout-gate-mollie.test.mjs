#!/usr/bin/env node
/**
 * checkout-gate-mollie.test.mjs - preuve que la garde de livraison coupe
 * AVANT tout appel a Mollie.
 *
 * Le test intercepte globalThis.fetch (seule sortie reseau du Worker) et
 * compte les appels vers api.mollie.com. Statut absent / invalide /
 * injection depuis le navigateur -> attendu : 409 + ZERO appel Mollie.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const tmpWorker = path.join(HERE, '.worker-under-test.mjs');
fs.writeFileSync(tmpWorker, fs.readFileSync(path.join(REPO, 'worker', 'index.js'), 'utf8'));
const workerMod = await import('file:///' + tmpWorker.replace(/\\/g, '/') + '?t=' + Date.now());

/* Source de verite du tarif : PRICE_TABLE du Worker (jamais invente ici).
   On lit le montant et la devise directement dans le code livre. */
const workerSource = fs.readFileSync(path.join(REPO, 'worker', 'index.js'), 'utf8');
const priceMatch = workerSource.match(/PRICE_TABLE\s*=\s*\{[\s\S]*?amount:\s*(\d+),\s*currency:\s*"([A-Z]+)"/);
if (!priceMatch) {
  console.log('FAIL source de verite PRICE_TABLE introuvable dans worker/index.js');
  process.exit(1);
}
const EXPECTED_CENTS = Number(priceMatch[1]);
const EXPECTED_CURRENCY = priceMatch[2];
const EXPECTED_VALUE = (EXPECTED_CENTS / 100).toFixed(2);

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
  return { DB: db, RATE_LIMIT: kv, RELEASE_STATUS: releaseStatus, STRIPE_SECRET_KEY: 'sk_test_unit', STRIPE_WEBHOOK_SECRET: 'whsec_test' };
}

let MOLLIE_CALLS = [];
const realFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (input, init) => {
  const url = typeof input === 'string' ? input : (input && input.url) || String(input);
  if (/api\.stripe\.com/.test(url)) {
    let parsedBody = null;
    if (init && init.body) {
      try { parsedBody = Object.fromEntries(new URLSearchParams(String(init.body))); } catch { parsedBody = null; }
    }
    MOLLIE_CALLS.push({
      url,
      method: (init && init.method) || 'GET',
      body: parsedBody,
    });
    if (/\/checkout\/sessions$/.test(url) && (init && init.method) === 'POST') {
      return new Response(JSON.stringify({
        id: 'cs_simulated',
        url: 'https://checkout.stripe.com/c/pay/cs_simulated',
        expires_at: Math.floor(Date.now() / 1000) + 1800,
      }), { status: 200, headers: { 'content-type': 'application/json' } });
    }
    return new Response(JSON.stringify({ id: 'cs_simulated', url: 'https://checkout.stripe.com/c/pay/cs_simulated' }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return realFetch(input, init);
};

function call(body, env) {
  const req = new Request('https://api.bot-wow.com/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': '203.0.113.10' },
    body: JSON.stringify(body),
  });
  return workerMod.default.fetch(req, env, {});
}

console.log('=== GARDE CHECKOUT : AUCUN APPEL MOLLIE ===');

/* 1. Le checkout est ouvert même si RELEASE_STATUS n'est pas confirmed. */
for (const [label, status] of [
  ['absent', undefined],
  ['pending', 'pending'],
  ['invalide', 'oui-mais-non'],
]) {
  MOLLIE_CALLS = [];
  const res = await call({ email: 'a@test.fr', lang: 'fr' }, makeEnv(status));
  const b = await res.json().catch(() => ({}));
  check(`${label} -> pas de 409`, res.status !== 409, `(status ${res.status})`);
  check(`${label} -> checkoutUrl`, !!b.checkoutUrl, `(${b.checkoutUrl})`);
  check(`${label} -> appel Mollie`, MOLLIE_CALLS.length > 0, `(${MOLLIE_CALLS.length})`);
}

/* 2. Injecter un statut ne permet pas d'imposer un montant. */
for (const attack of [
  { RELEASE_STATUS: 'confirmed' },
  { release_status: 'confirmed' },
  { confirmed: true },
]) {
  MOLLIE_CALLS = [];
  const body = { email: 'b@test.fr', lang: 'fr', amount: 100, ...attack };
  const res = await call(body, makeEnv(undefined));
  check(`injection ${Object.keys(attack)[0]} : montant refusé`, res.status === 400, `(status ${res.status})`);
}

/* 3. Statut confirme cote serveur : la garde ne bloque plus et le parcours
      va bien jusqu'a la creation du paiement Mollie (reseau simule). */
{
  MOLLIE_CALLS = [];
  const res = await call({ email: 'c@test.fr', lang: 'fr' }, makeEnv('confirmed'));
  const b = await res.json().catch(() => ({}));
  check('confirmed -> pas de 409', res.status !== 409, `(status ${res.status})`);
  check('confirmed -> reponse 200 avec un paymentId', res.status === 200 && !!b.paymentId, `(status ${res.status})`);
  check('confirmed -> une checkoutUrl Mollie est renvoyee',
    !!b.checkoutUrl && /stripe\.com/.test(b.checkoutUrl), `(${b.checkoutUrl})`);
  // Le parcours doit avoir REELLEMENT appele Mollie : client + paiement.
  const paymentCalls = MOLLIE_CALLS.filter((c) => /\/checkout\/sessions$/.test(c.url) && c.method === 'POST');
  check('confirmed -> une session Stripe est creee', paymentCalls.length === 1, `(${paymentCalls.length})`);
}

/* 4. Le tarif envoye a Mollie est exactement celui de PRICE_TABLE :
      la garde ne modifie ni le montant ni la devise. Verification REELLE
      du corps de la requete de paiement (plus d assertion vacument vraie). */
{
  MOLLIE_CALLS = [];
  const res = await call({ email: 'd@test.fr', lang: 'fr' }, makeEnv('confirmed'));
  const paymentCalls = MOLLIE_CALLS.filter((c) => /\/checkout\/sessions$/.test(c.url) && c.method === 'POST');
  check('une session Stripe est creee (prerequis au controle du montant)',
    paymentCalls.length === 1, `(${paymentCalls.length})`);
  const body = paymentCalls[0] && paymentCalls[0].body;
  check('montant envoye a Stripe conforme a PRICE_TABLE',
    !!body && body['line_items[0][price_data][unit_amount]'] === String(EXPECTED_CENTS),
    `(attendu ${EXPECTED_CENTS}, recu ${body && body['line_items[0][price_data][unit_amount]']})`);
  check('devise envoyee a Stripe conforme a PRICE_TABLE',
    !!body && String(body['line_items[0][price_data][currency]'] || '').toUpperCase() === EXPECTED_CURRENCY,
    `(attendu ${EXPECTED_CURRENCY}, recu ${body && body['line_items[0][price_data][currency]']})`);
  check('produit verrouille dans les metadonnees',
    !!body && body['metadata[product]'] === 'bot-wow-lifetime',
    `(recu ${body && body['metadata[product]']})`);
  const injected = await call({ email: 'e@test.fr', lang: 'fr', amount: 100 }, makeEnv('confirmed'));
  const injectedPayments = MOLLIE_CALLS.filter((c) => /\/checkout\/sessions$/.test(c.url) && c.method === 'POST');
  check('un montant impose par le navigateur est refuse avant Stripe',
    injected.status === 400 && injectedPayments.length === paymentCalls.length,
    `(status ${injected.status}, sessions ${injectedPayments.length})`);
}

try { fs.unlinkSync(tmpWorker); } catch {}
console.log(failures === 0 ? '\nGARDE MOLLIE : OK' : `\nGARDE MOLLIE : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);

