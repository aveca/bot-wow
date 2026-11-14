#!/usr/bin/env node
/**
 * tests/payment-mode.test.mjs — distinguer un paiement REEL d'un paiement
 * de TEST dans la mesure de conversion.
 *
 * PROBLEME MESURE (2026-11-04) :
 *   La table `events` comporte une colonne `test` ("1 : evenement de test
 *   (exclu des stats)"), mais le Worker l'ecrivait TOUJOURS a 0, y compris
 *   pour `conversion` (qui porte `value_eur`). Un paiement Mollie de mode
 *   "test" etait donc comptabilise comme du chiffre d'affaires reel.
 *   De plus, `value_eur` etait renseigne meme pour un test : une somme
 *   naive (SUM(value_eur)) ne pouvait pas distinguer les deux.
 *
 * CORRECTION VERIFIEE ICI :
 *   - mode "live" (ou mode absent) -> test=0, value_eur = montant ;
 *   - mode "test"                  -> test=1, value_eur = NULL.
 *
 * Regle fail-safe : seul un mode explicitement "test" est marque test=1.
 * Un mode absent est traite comme un paiement REEL (on ne perd jamais une
 * vente mesuree).
 *
 * Aucun paiement reel : Mollie est simule par un `fetch` intercepte.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
}

const tmpWorker = join(HERE, '.worker-under-test.mjs');
writeFileSync(tmpWorker, readFileSync(join(REPO, 'worker', 'index.js'), 'utf8'));
const workerMod = await import('file:///' + tmpWorker.replace(/\\/g, '/') + '?t=' + Date.now());

/* --------------------------------------------------------------- Mollie */
const realFetch = globalThis.fetch;
let paymentState = null;
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u.startsWith('https://api.stripe.com/v1/checkout/sessions/')) {
    const ps = paymentState || {};
    const cents = Math.round(parseFloat(ps.amount && ps.amount.value || '0') * 100);
    return new Response(JSON.stringify({
      id: ps.id,
      payment_status: ps.status === 'paid' ? 'paid' : 'unpaid',
      amount_total: cents,
      currency: String(ps.amount && ps.amount.currency || 'eur').toLowerCase(),
      livemode: ps.mode !== 'test',
      metadata: ps.metadata || {},
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return realFetch(url, opts);
};

/* --------------------------------------------------------------- D1 sim */
function makeEnv(state) {
  const db = {
    prepare(sql) {
      const key = sql.replace(/\s+/g, ' ').trim();
      const exec = {
        bind: (...args) => ({
          run: async () => {
            state.calls.push({ sql: key, args });
            if (/INSERT INTO webhook_events/i.test(key)) {
              if (state.events.has(args[0])) throw new Error('UNIQUE constraint failed: webhook_events.id');
              state.events.add(args[0]);
            }
            return { meta: { last_row_id: state.events.size } };
          },
          first: async () => { state.calls.push({ sql: key, args }); return null; },
          all: async () => [],
        }),
        run: async () => ({ meta: { last_row_id: 0 } }),
        first: async () => null,
        all: async () => [],
      };
      return exec;
    },
    batch: async () => [],
  };
  const telemetry = {
    prepare(sql) {
      return {
        bind: (...args) => ({
          run: async () => {
            state.telemetry.push({ sql: sql.replace(/\s+/g, ' ').trim(), args });
            return { success: true };
          },
        }),
      };
    },
  };
  return {
    DB: db,
    TELEMETRY_DB: telemetry,
    RATE_LIMIT: { get: async () => null, put: async () => {} },
    R2_BINARIES: { get: async () => null },
    STRIPE_SECRET_KEY: 'sk_test_unit',
    STRIPE_WEBHOOK_SECRET: 'whsec_test',
    RESEND_API_KEY: '', // pas de secret : la livraison part en "pending"
    ADMIN_JWT_SECRET: 'test_admin_secret',
    LICENSE_SECRET: 'test_license_secret',
    state,
  };
}

/* ---------------------------------------------------------- lecture even. */
function eventRows(state, name) {
  return (state.telemetry || []).filter((r) => /INSERT INTO events/i.test(r.sql) && r.args && r.args[1] === name);
}
/* La ligne `conversion` est ecrite avec un SQL different : on la repere a
   son INSERT (event en dur dans la chaine). */
function conversionRows(state) {
  return (state.telemetry || []).filter((r) => /'conversion'/.test(r.sql));
}
function funnelEventTestFlag(state, name) {
  const rows = eventRows(state, name);
  if (!rows.length) return undefined;
  return rows[0].args[9];
}
function conversionTestFlag(state) {
  const rows = conversionRows(state);
  if (!rows.length) return undefined;
  return rows[0].args[3];
}
function conversionValue(state) {
  const rows = conversionRows(state);
  if (!rows.length) return undefined;
  return rows[0].args[4];
}

async function runWebhook(mode) {
  const state = { calls: [], events: new Set(), telemetry: [] };
  const env = makeEnv(state);
  paymentState = {
    id: 'tr_mode',
    status: 'paid',
    amount: { value: '20.00', currency: 'EUR' },
    metadata: { email: 'client@test.fr', lang: 'fr', product: 'bot-wow-lifetime' },
  };
  if (mode !== undefined) paymentState.mode = mode;
  const payload = JSON.stringify({ id: 'evt_mode', type: 'checkout.session.completed', data: { object: { id: 'tr_mode' } } });
  const t = Math.floor(Date.now() / 1000);
  const sig = createHmac('sha256', env.STRIPE_WEBHOOK_SECRET).update(t + '.' + payload).digest('hex');
  const req = new Request('https://api.bot-wow.com/api/stripe-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Stripe-Signature': 't=' + t + ',v1=' + sig },
    body: payload,
  });
  const res = await workerMod.default.fetch(req, env, {});
  return { res, state };
}

console.log('=== MODE DE PAIEMENT : reel vs test ===');

/* ----- 1. paiement explicitement "live" ----- */
{
  const { res, state } = await runWebhook('live');
  check('webhook "live" repond 200', res.status === 200, `(status=${res.status})`);
  check('"live" : conversion marquee test=0', conversionTestFlag(state) === 0, `(test=${conversionTestFlag(state)})`);
  check('"live" : le montant est conserve', conversionValue(state) === 20, `(value_eur=${conversionValue(state)})`);
  check('"live" : payment_confirmed test=0', funnelEventTestFlag(state, 'payment_confirmed') === 0);
  check('"live" : license_created test=0', funnelEventTestFlag(state, 'license_created') === 0);
}

/* ----- 2. paiement explicitement "test" ----- */
{
  const { res, state } = await runWebhook('test');
  check('webhook "test" repond 200', res.status === 200, `(status=${res.status})`);
  check('"test" : conversion marquee test=1', conversionTestFlag(state) === 1, `(test=${conversionTestFlag(state)})`);
  check('"test" : value_eur reste NULL (jamais de revenu)', conversionValue(state) === null, `(value_eur=${conversionValue(state)})`);
  check('"test" : payment_confirmed test=1', funnelEventTestFlag(state, 'payment_confirmed') === 1);
  check('"test" : license_created test=1', funnelEventTestFlag(state, 'license_created') === 1);
}

/* ----- 3. mode absent : fail-safe, traite comme un paiement reel ----- */
{
  const { res, state } = await runWebhook(undefined);
  check('webhook sans mode repond 200', res.status === 200, `(status=${res.status})`);
  check('sans mode : conversion test=0 (fail-safe)', conversionTestFlag(state) === 0, `(test=${conversionTestFlag(state)})`);
  check('sans mode : le montant est conserve', conversionValue(state) === 20, `(value_eur=${conversionValue(state)})`);
}

/* ----- 4. le drapeau "test" existe bien dans le schema D1 ----- */
{
  const schema = readFileSync(join(REPO, 'migrations', 'analytics', '0001_telemetry_events.sql'), 'utf8');
  check('la colonne test existe dans le schema analytics', /test\s+INTEGER\s+NOT NULL\s+DEFAULT 0/.test(schema));
  check('la colonne value_eur existe dans le schema analytics', /value_eur\s+REAL/.test(schema));
}

console.log('');
console.log(failures === 0 ? 'MODE DE PAIEMENT : OK' : `MODE DE PAIEMENT : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
