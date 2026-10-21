#!/usr/bin/env node
/**
 * payment-flow.test.mjs — test de regression du parcours de paiement.
 *
 * On appelle le VRAI Worker (worker/index.js) avec un D1 simule et un
 * `fetch` intercepte pour Mollie. Cela verifie les points qui font perdre de
 * l'argent ou des clients :
 *
 *  1. le prix est impose par le serveur (un montant demande par le
 *     navigateur est refuse) ;
 *  2. les URL de redirection / annulation / webhook sont canoniques (pas
 *     ouvertes a une redirection libre depuis le navigateur) ;
 *  3. un webhook `paid` cree UNE licence ;
 *  4. un webhook de montant different ne cree AUCUNE licence ;
 *  5. un webhook rejoue (doublon) ne cree PAS de seconde licence ;
 *  6. un webhook sans identifiant de paiement est rejete.
 */
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
}

/* ---------------------------------------------------------- environnement */
function makeEnv(state) {
  const db = {
    prepare(sql) {
      const key = sql.replace(/\s+/g, ' ').trim();
      const exec = {
        bind: (...args) => ({
          run: async () => {
            state.calls.push({ sql: key, args });
            if (/INSERT INTO webhook_events/i.test(key)) {
              if (state.events.has(args[0])) {
                throw new Error('UNIQUE constraint failed: webhook_events.id');
              }
              state.events.add(args[0]);
            }
            if (/INSERT INTO orders/i.test(key)) state.orders.push(args[0]);
            if (/INSERT INTO licenses/i.test(key)) state.licenses.push(args);
            if (/INSERT INTO downloads/i.test(key)) state.downloads.push(args);
            if (/INSERT INTO deliveries/i.test(key)) state.deliveries.push(args);
            if (/INSERT INTO mollie_customers/i.test(key)) state.customers.push(args);
            return { meta: { last_row_id: state.orders.length } };
          },
          first: async () => {
            state.calls.push({ sql: key, args });
            if (/FROM mollie_customers/i.test(key)) return null;
            if (/FROM webhook_events/i.test(key)) {
              return state.events.has(args[0]) ? { id: args[0] } : null;
            }
            return null;
          },
          all: async () => [],
        }),
        run: async () => { state.calls.push({ sql: key }); return { meta: { last_row_id: 0 } }; },
        first: async () => null,
        all: async () => [],
      };
      return exec;
    },
    batch: async (stmts) => { await Promise.all(stmts.map((s) => s.run())); return []; },
  };
  const kv = {
    get: async () => null,
    put: async () => {},
  };
  return {
    DB: db,
    RATE_LIMIT: kv,
    R2_BINARIES: { get: async () => null },
    MOLLIE_API_KEY: 'test_key',
    MOLLIE_WEBHOOK_SECRET: 'test_secret',
    state,
  };
}

/* --------------------------------------------------------------- Worker */
// Le Worker est charge comme module ESM depuis une copie temporaire : le
// bundle n'exporte que son `fetch` (aucune dependance externe hors
// node:crypto / node:events).
const tmpWorker = join(HERE, '.worker-under-test.mjs');
writeFileSync(tmpWorker, readFileSync(join(REPO, 'worker', 'index.js'), 'utf8'));
const workerMod = await import('file:///' + tmpWorker.replace(/\\/g, '/') + '?t=' + Date.now());

/* ----------------------------------------------------------- fetch simule */
const realFetch = globalThis.fetch;
let mollieCalls = [];
let paymentState = { id: 'tr_test', status: 'paid', amount: { value: '20.00', currency: 'EUR' },
  metadata: { email: 'client@test.fr', lang: 'fr', product: 'bot-wow-lifetime' } };

globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u.startsWith('https://api.mollie.com/v2/')) {
    mollieCalls.push({ url: u, method: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : null });
    if (u.endsWith('/payments') && (opts.method || 'GET') === 'POST') {
      return new Response(JSON.stringify({ id: 'tr_test', _links: { checkout: { href: 'https://mollie.test/checkout' } } }),
        { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
    if (/\/payments\/tr_/.test(u)) {
      const id = u.split('/').pop();
      return new Response(JSON.stringify({ ...paymentState, id }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (u.endsWith('/customers')) {
      return new Response(JSON.stringify({ id: 'cst_test' }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return realFetch(url, opts);
};

async function callWorker(path, { method = 'GET', body = null, env } = {}) {
  const req = new Request('https://api.bot-wow.com' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return workerMod.default.fetch(req, env, {});
}

/* ------------------------------------------------------------------ tests */
console.log('=== PARCOURS DE PAIEMENT (Worker reel, D1 simule) ===');

/* 1. le prix est impose cote serveur */
{
  const state = { calls: [], events: new Set(), orders: [], licenses: [], downloads: [], deliveries: [], customers: [] };
  const env = makeEnv(state);
  mollieCalls = [];
  const res = await callWorker('/api/checkout', {
    method: 'POST', body: { email: 'client@test.fr', lang: 'fr' }, env,
  });
  const data = await res.json();
  check('le checkout renvoie une URL de paiement', res.status === 200 && !!data.checkoutUrl,
    `(status=${res.status} ${JSON.stringify(data).slice(0, 120)})`);
  const payment = mollieCalls.find((c) => c.url.endsWith('/payments') && c.method === 'POST');
  check('le montant envoyé a Mollie est 20,00 EUR (fixe par le serveur)',
    payment && payment.body.amount.value === '20.00' && payment.body.amount.currency === 'EUR',
    `(recu ${JSON.stringify(payment && payment.body.amount)})`);
  check('la redirection est canonique (pas une URL fournie par le navigateur)',
    payment && payment.body.redirectUrl === 'https://bot-wow.com/success.html',
    `(recu ${payment && payment.body.redirectUrl})`);
  check('l\'URL d\'annulation est canonique',
    payment && payment.body.cancelUrl === 'https://bot-wow.com/cancel.html',
    `(recu ${payment && payment.body.cancelUrl})`);
  check('l\'URL de webhook est canonique',
    payment && payment.body.webhookUrl === 'https://api.bot-wow.com/api/mollie-webhook',
    `(recu ${payment && payment.body.webhookUrl})`);
  check('le produit est verrouille (bot-wow-lifetime)',
    payment && payment.body.metadata.product === 'bot-wow-lifetime');
}

/* 2. un montant impose par le navigateur est refuse */
{
  const state = { calls: [], events: new Set(), orders: [], licenses: [], downloads: [], deliveries: [], customers: [] };
  const env = makeEnv(state);
  mollieCalls = [];
  const res = await callWorker('/api/checkout', {
    method: 'POST', body: { email: 'client@test.fr', amount: 100, currency: 'USD' }, env,
  });
  check('un montant different de la reference est refuse', res.status === 400,
    `(status=${res.status})`);
  check('aucun paiement n\'est cree pour un montant refuse',
    !mollieCalls.some((c) => c.url.endsWith('/payments') && c.method === 'POST'));
}

/* 3. un webhook paye cree UNE licence */
{
  const state = { calls: [], events: new Set(), orders: [], licenses: [], downloads: [], deliveries: [], customers: [] };
  const env = makeEnv(state);
  paymentState = { id: 'tr_test', status: 'paid', amount: { value: '20.00', currency: 'EUR' },
    metadata: { email: 'client@test.fr', lang: 'fr', product: 'bot-wow-lifetime' } };
  const res = await callWorker('/api/mollie-webhook', {
    method: 'POST', body: { id: 'tr_test' }, env,
  });
  check('le webhook repond 200', res.status === 200, `(status=${res.status})`);
  check('une licence est creee', state.licenses.length === 1, `(${state.licenses.length})`);
  check('la commande porte un identifiant TEXT', typeof state.orders[0] === 'string' && state.orders[0].startsWith('ord_'),
    `(${state.orders[0]})`);
  check('la licence reference la meme commande', state.licenses[0] && state.licenses[0][1] === state.orders[0],
    `(licence=${state.licenses[0] && state.licenses[0][1]} commande=${state.orders[0]})`);
  check('un jeton de telechargement est cree', state.downloads.length === 1, `(${state.downloads.length})`);
}

/* 4. un webhook rejoue ne cree PAS de seconde licence */
{
  const state = { calls: [], events: new Set(), orders: [], licenses: [], downloads: [], deliveries: [], customers: [] };
  const env = makeEnv(state);
  paymentState = { id: 'tr_test', status: 'paid', amount: { value: '20.00', currency: 'EUR' },
    metadata: { email: 'client@test.fr', lang: 'fr', product: 'bot-wow-lifetime' } };
  await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_test' }, env });
  const after1 = state.licenses.length;
  const res2 = await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_test' }, env });
  check('le webhook rejoue ne cree pas de seconde licence',
    after1 === 1 && state.licenses.length === 1, `(${after1} -> ${state.licenses.length})`);
  check('le webhook rejoue repond 200', res2.status === 200, `(status=${res2.status})`);
}

/* 5. un montant different cote Mollie ne cree aucune licence */
{
  const state = { calls: [], events: new Set(), orders: [], licenses: [], downloads: [], deliveries: [], customers: [] };
  const env = makeEnv(state);
  paymentState = { id: 'tr_test', status: 'paid', amount: { value: '1.00', currency: 'EUR' },
    metadata: { email: 'client@test.fr', lang: 'fr', product: 'bot-wow-lifetime' } };
  const res = await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_test' }, env });
  check('un paiement au mauvais montant ne cree aucune licence', state.licenses.length === 0,
    `(${state.licenses.length})`);
  check('un paiement au mauvais montant est refuse', res.status === 400, `(status=${res.status})`);
}

/* 6. un paiement non paye ne cree aucune licence */
{
  const state = { calls: [], events: new Set(), orders: [], licenses: [], downloads: [], deliveries: [], customers: [] };
  const env = makeEnv(state);
  paymentState = { id: 'tr_test', status: 'open', amount: { value: '20.00', currency: 'EUR' },
    metadata: { email: 'client@test.fr', lang: 'fr', product: 'bot-wow-lifetime' } };
  await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_test' }, env });
  check('un paiement non paye ne cree aucune licence', state.licenses.length === 0, `(${state.licenses.length})`);
}

/* 7. un webhook sans identifiant est rejete */
{
  const state = { calls: [], events: new Set(), orders: [], licenses: [], downloads: [], deliveries: [], customers: [] };
  const env = makeEnv(state);
  const res = await callWorker('/api/mollie-webhook', { method: 'POST', body: { foo: 'bar' }, env });
  check('un webhook sans identifiant de paiement est rejete', res.status === 400, `(status=${res.status})`);
  check('aucune licence n\'est creee sans identifiant', state.licenses.length === 0);
}

/* 8. le format classique (x-www-form-urlencoded) est accepte */
{
  const state = { calls: [], events: new Set(), orders: [], licenses: [], downloads: [], deliveries: [], customers: [] };
  const env = makeEnv(state);
  paymentState = { id: 'tr_form', status: 'paid', amount: { value: '20.00', currency: 'EUR' },
    metadata: { email: 'client@test.fr', lang: 'fr', product: 'bot-wow-lifetime' } };
  const req = new Request('https://api.bot-wow.com/api/mollie-webhook', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'id=tr_form',
  });
  const res = await workerMod.default.fetch(req, env, {});
  check('le webhook au format classique (id=tr_xxx) est traite',
    res.status === 200 && state.licenses.length === 1,
    `(status=${res.status} licences=${state.licenses.length})`);
}

globalThis.fetch = realFetch;
rmSync(tmpWorker, { force: true });

console.log('');
console.log(failures === 0 ? 'PARCOURS DE PAIEMENT : OK' : `PARCOURS DE PAIEMENT : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
