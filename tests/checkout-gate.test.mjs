#!/usr/bin/env node
/**
 * checkout-gate.test.mjs — le checkout public est ouvert.
 *
 * POST /api/checkout crée une Checkout Session Stripe. RELEASE_STATUS ne
 * bloque plus la vente. Le montant reste celui de PRICE_TABLE.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
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
    prepare() {
      return { bind: () => ({
        run: async () => ({ meta: { last_row_id: 0 } }),
        first: async () => null,
        all: async () => [],
      }) };
    },
    batch: async () => [],
  };
  return {
    DB: db,
    RATE_LIMIT: kv,
    RELEASE_STATUS: releaseStatus,
    STRIPE_SECRET_KEY: 'sk_test_unit',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
  };
}

function call(body, env, ip) {
  const req = new Request('https://api.bot-wow.com/api/checkout', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': ip || '203.0.113.10' },
    body: JSON.stringify(body),
  });
  return workerMod.default.fetch(req, env, {});
}

console.log('=== CHECKOUT OUVERT : SESSION STRIPE ===');

let STRIPE_CALLS = 0;
globalThis.fetch = async (url) => {
  if (String(url).includes('api.stripe.com')) {
    STRIPE_CALLS += 1;
    return new Response(JSON.stringify({
      id: 'cs_open',
      url: 'https://checkout.stripe.com/c/pay/cs_open',
      expires_at: Math.floor(Date.now() / 1000) + 1800,
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  return new Response('{}', { status: 500 });
};

for (const [label, status] of [
  ['absent', undefined],
  ['pending', 'pending'],
  ['confirmed', 'confirmed'],
]) {
  STRIPE_CALLS = 0;
  const res = await call({ email: 'a@test.fr', lang: 'fr' }, makeEnv(status));
  const body = await res.json().catch(() => ({}));
  check(label + ' -> 200 et une URL Stripe',
    res.status === 200 && /checkout\.stripe\.com/.test(body.checkoutUrl || ''),
    `(status ${res.status} url ${body.checkoutUrl})`);
  check(label + ' -> un appel Stripe', STRIPE_CALLS === 1, `(${STRIPE_CALLS})`);
}

{
  const res = await call({ email: 'b@test.fr', lang: 'fr', amount: 100, RELEASE_STATUS: 'pending' }, makeEnv('pending'));
  const body = await res.json().catch(() => ({}));
  check('un montant navigateur différent est refusé', res.status === 400 && body.error === 'invalid_amount', `(status ${res.status})`);
}

console.log(failures === 0 ? '\nCHECKOUT GATE : OK' : `\nCHECKOUT GATE : ${failures} ECHEC(S)`);
try { fs.unlinkSync(tmpWorker); } catch {}
process.exit(failures === 0 ? 0 : 1);
