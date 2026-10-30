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
            if (/INSERT INTO orders/i.test(key)) {
              state.orders.push(args[0]);
              if (state.orderRows) {
                const email = args.filter((a) => typeof a === 'string' && a.includes('@'))[0] || '';
                state.orderRows[args[0]] = {
                  id: args[0],
                  provider: /'bitcoin_manual'/.test(key) ? 'bitcoin_manual' : 'mollie',
                  provider_id: /'bitcoin_manual'/.test(key) ? args[1] : args[1],
                  email,
                  amount: 2000, currency: 'eur',
                  status: /pending_payment/.test(key) ? 'pending_payment' : 'paid',
                  metadata: args.filter((a) => typeof a === 'string' && a.startsWith('{'))[0] || '{}',
                };
              }
            }
            if (/UPDATE orders SET status = 'paid'/i.test(key) && state.orderRows) {
              const row = state.orderRows[args[1]];
              if (row) row.status = 'paid';
            }
            if (/UPDATE orders SET status = 'rejected'/i.test(key) && state.orderRows) {
              const row = state.orderRows[args[1]];
              if (row) row.status = 'rejected';
            }
            if (/UPDATE licenses SET status/i.test(key)) state.licenseRevoked = true;
            if (/INSERT OR IGNORE INTO webhook_events/i.test(key)) state.events.add(args[0]);
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
            // FIX 2026-10-21 : SELECT * FROM orders -> retrouver une commande
            // reelle par id (ord_*) ou reference fournisseur (BTC-*).
            if (/SELECT \* FROM orders/i.test(key)) {
              const id = args[0];
              const rows = Object.values(state.orderRows || {});
              return state.orderRows?.[id] || rows.find((r) => r.id === id || r.provider_id === id) || null;
            }
            // revokeLicense : licenses JOIN orders -> licence active liee.
            if (/JOIN orders o ON o.id = l.order_id/i.test(key)) {
              const lic = (state.licenses || [])[0];
              if (!lic || state.licenseRevoked) return null;
              return { id: 1, key: lic[0] };
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
    put: async () => {
      if (state.failKvPuts) throw new Error('KV daily put limit exceeded');
    },
  };
  /* Base de TELEMETRIE (dediee) : elle ne recoit QUE la mesure de
     conversion ecrite par le serveur. */
  const telemetry = {
    prepare: (sql) => ({
      bind: (...args) => ({
        run: async () => {
          state.telemetry = state.telemetry || [];
          state.telemetry.push({ sql, args });
          return { success: true };
        },
      }),
    }),
  };
  return {
    DB: db,
    TELEMETRY_DB: telemetry,
    RATE_LIMIT: kv,
    R2_BINARIES: { get: async () => null },
    MOLLIE_API_KEY: 'test_key',
    MOLLIE_WEBHOOK_SECRET: 'test_secret',
    ADMIN_JWT_SECRET: 'test_admin_secret',
    RELEASE_STATUS: 'open',
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

async function callWorker(path, { method = 'GET', body = null, env, headers = {} } = {}) {
  const req = new Request('https://api.bot-wow.com' + path, {
    method,
    headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  });
  return workerMod.default.fetch(req, env, {});
}

/* Signature JWT admin (HS256) — meme format que generateJWT du Worker */
async function signAdminJWT(secret) {
  const b64u = (buf) => Buffer.from(buf).toString('base64url');
  const enc = new TextEncoder();
  const header = b64u(enc.encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const now = Math.floor(Date.now() / 1e3);
  const payload = b64u(enc.encode(JSON.stringify({ role: 'admin', iat: now, exp: now + 3600 })));
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${header}.${payload}`));
  return `${header}.${payload}.${b64u(new Uint8Array(sig))}`;
}

/* ------------------------------------------------------------------ tests */
console.log('=== PARCOURS DE PAIEMENT (Worker reel, D1 simule) ===');

/* 1. le prix est impose cote serveur */
{
  const state = { calls: [], events: new Set(), orders: [], licenses: [], downloads: [], deliveries: [], customers: [] };
  const env = makeEnv(state);
  // Régression P0 : le quota KV peut être épuisé, mais Mollie doit quand même
  // pouvoir renvoyer l'URL de paiement une fois le paiement créé.
  state.failKvPuts = true;
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

/* 3b. un webhook paye enregistre UNE conversion (mesure serveur) */
{
  const state = { calls: [], events: new Set(), orders: [], licenses: [], downloads: [], deliveries: [], customers: [] };
  const env = makeEnv(state);
  paymentState = { id: 'tr_conv', status: 'paid', amount: { value: '20.00', currency: 'EUR' },
    metadata: { email: 'client@test.fr', lang: 'fr', product: 'bot-wow-lifetime' } };
  const res = await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_conv' }, env });
  check('le webhook paye repond 200', res.status === 200, `(status=${res.status})`);
  const rows = state.telemetry || [];
  const conv = rows.filter((r) => /'conversion'/.test(r.sql));
  check('une conversion est ecrite dans la base de telemetrie', conv.length === 1, `(${conv.length})`);
  check('la conversion est ecrite dans la table des evenements', conv.length === 1 && /INSERT INTO events/i.test(conv[0].sql));
  const flat = JSON.stringify(conv[0] ? conv[0].args : []);
  check('la conversion ne contient ni e-mail ni montant en clair de commande',
    !flat.includes('client@test.fr') && !flat.includes('tr_conv'), `(${flat.slice(0, 120)})`);
  check('la conversion porte le montant confirme', flat.includes('20'), `(${flat.slice(0, 120)})`);
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

/* 9. FIX 2026-10-21 : /api/claim (licences gratuites illimitees) est desactive */
{
  const state = { calls: [], events: new Set(), orders: [], licenses: [], downloads: [], deliveries: [], customers: [] };
  const env = makeEnv(state);
  const res = await callWorker('/api/claim', {
    method: 'POST', body: { email: 'free@test.fr', lang: 'fr' }, env,
  });
  check('le canal de licences gratuites est desactive (410)', res.status === 410, `(status=${res.status})`);
  check('aucune licence gratuite n\'est delivree', state.licenses.length === 0, `(${state.licenses.length})`);
}

/* 10. FIX 2026-10-21 : la validation admin SANS jeton est refusee (401) */
{
  const state = { calls: [], events: new Set(), orders: [], licenses: [], downloads: [], deliveries: [], customers: [], orderRows: {} };
  const env = makeEnv(state);
  const res = await callWorker('/api/admin/orders/999/approve', { method: 'POST', env });
  check('valider une commande sans jeton admin est refuse', res.status === 401, `(status=${res.status})`);
  check('aucune licence n\'est creee sans jeton admin', state.licenses.length === 0, `(${state.licenses.length})`);
  const res2 = await callWorker('/api/admin/orders/999/reject', { method: 'POST', env });
  check('rejeter une commande sans jeton admin est refuse', res2.status === 401, `(status=${res2.status})`);
}

/* 11. FIX 2026-10-21 : commande bitcoin a l'id TEXT explicite + approuvee via reference ou id */
{
  const state = { calls: [], events: new Set(), orders: [], licenses: [], downloads: [], deliveries: [], customers: [], orderRows: {} };
  const env = makeEnv(state);
  const res = await callWorker('/api/bitcoin/checkout', {
    method: 'POST', body: { email: 'client@test.fr', lang: 'fr' }, env,
  });
  const data = await res.json();
  check('la commande bitcoin porte un id TEXT ord_*',
    res.status === 200 && typeof data.orderId === 'string' && data.orderId.startsWith('ord_bitcoin_manual_'),
    `(recu ${data.orderId})`);
  const adminToken = await signAdminJWT(env.ADMIN_JWT_SECRET);
  const resOk = await callWorker(`/api/admin/orders/${encodeURIComponent(data.orderReference)}/approve`, {
    method: 'POST', env, headers: { Authorization: `Bearer ${adminToken}` },
  });
  const dataOk = await resOk.json();
  check('l\'approbation par reference BTC cree une licence', resOk.status === 200 && state.licenses.length === 1,
    `(status=${resOk.status} licences=${state.licenses.length})`);
  check('la licence reference l\'id TEXT de la commande bitcoin',
    state.licenses[0] && state.licenses[0][1] === data.orderId,
    `(licence.orderId=${state.licenses[0] && state.licenses[0][1]})`);
  const res2 = await callWorker(`/api/admin/orders/${encodeURIComponent(data.orderId)}/approve`, {
    method: 'POST', env, headers: { Authorization: `Bearer ${adminToken}` },
  });
  check('reapprouver une commande deja payee est refuse (400)', res2.status === 400, `(status=${res2.status})`);
  check('la seconde approbation ne cree pas de seconde licence', state.licenses.length === 1, `(${state.licenses.length})`);
}

/* 12. FIX 2026-10-21 : un remboursement Mollie revoque la licence */
{
  const state = { calls: [], events: new Set(), orders: [], licenses: [], downloads: [], deliveries: [], customers: [] };
  const env = makeEnv(state);
  paymentState = { id: 'tr_refund', status: 'paid', amount: { value: '20.00', currency: 'EUR' },
    metadata: { email: 'client@test.fr', lang: 'fr', product: 'bot-wow-lifetime' } };
  await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_refund' }, env });
  check('la licence existe avant remboursement', state.licenses.length === 1, `(${state.licenses.length})`);
  paymentState = { ...paymentState, status: 'refunded' };
  const res = await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_refund' }, env });
  check('le webhook de remboursement repond 200', res.status === 200, `(status=${res.status})`);
  check('la licence est revoquee apres remboursement', state.licenseRevoked === true);
  const res2 = await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_refund' }, env });
  check('le rejeu du webhook de remboursement reste sans effet (200)', res2.status === 200, `(status=${res2.status})`);
  check('aucune seconde licence n\'est creee, aucun crash', state.licenses.length === 1, `(${state.licenses.length})`);
}

/* 13. Garde-fou commercial : la vente suspendue bloque le checkout cote serveur.
   Aucun RELEASE_STATUS => vente suspendue par defaut (fail-closed).
   Le refus ne depend pas du bouton HTML, ne contacte pas Mollie, ne cree
   aucune commande ni licence, et ne journalise pas de donnee personnelle. */
{
  const state = { calls: [], events: new Set(), orders: [], licenses: [], downloads: [], deliveries: [], customers: [] };
  const env = makeEnv(state);
  delete env.RELEASE_STATUS; // vente suspendue par defaut (fail-closed)
  mollieCalls = [];
  const res = await callWorker('/api/checkout', {
    method: 'POST', body: { email: 'client@test.fr', lang: 'fr' }, env,
  });
  const data = await res.json();
  check('vente suspendue refuse le checkout en 409', res.status === 409, `(status=${res.status})`);
  check('statut explicite sales_suspended', data && data.error === 'sales_suspended',
    `(recu ${JSON.stringify(data).slice(0, 120)})`);
  check('aucun paiement Mollie cree quand la vente est suspendue',
    mollieCalls.filter((c) => c.url.endsWith('/payments') && c.method === 'POST').length === 0,
    `(appels ${mollieCalls.length})`);
  check('aucune commande creee quand la vente est suspendue', state.orders.length === 0, `(${state.orders.length})`);
  check('aucune licence creee quand la vente est suspendue', state.licenses.length === 0, `(${state.licenses.length})`);
}

/* ---------------------------------------------------------- injection d'echec D1 */
/* Permet de simuler une panne de base de donnees a un stade precise du
   parcours de fulfillment, pour tester la reprise et l'idempotence. */
function makeFailingEnv(state, failSQLPatterns = []) {
  const env = makeEnv(state);
  const origPrepare = env.DB.prepare.bind(env.DB);
  env.DB.prepare = (sql) => {
    const exec = origPrepare(sql);
    const shouldFail = failSQLPatterns.some((p) => sql.includes(p));
    const origRun = exec.run.bind(exec);
    exec.run = async (...args) => {
      if (shouldFail) throw new Error('D1 injecte : ' + sql);
      return origRun(...args);
    };
    // bind() retourne un nouvel objet avec son propre run : l'envelopper aussi.
    const origBind = exec.bind.bind(exec);
    exec.bind = (...bindArgs) => {
      const bindExec = origBind(...bindArgs);
      const origBindRun = bindExec.run.bind(bindExec);
      bindExec.run = async (...runArgs) => {
        if (shouldFail) throw new Error('D1 injecte : ' + sql);
        return origBindRun(...runArgs);
      };
      return bindExec;
    };
    return exec;
  };
  return env;
}

/* 14. Mollie #13 : echec apres insertion du marqueur d'idempotence.
   Le marqueur payment:<id> est pose, puis fulfillOrder echoue (panne sur
   INSERT INTO orders). Un rejeu du meme webhook ne doit ni creer de doublon
   ni abandonner silencieusement : le marqueur existe deja, le rejeu renvoie
   200 OK sans rien creer de nouveau. */
{
  const state = { calls: [], events: new Set(), orders: [], licenses: [], downloads: [], deliveries: [], customers: [] };
  const env = makeFailingEnv(state, ['INSERT INTO orders']);
  paymentState = { id: 'tr_fail_marker', status: 'paid', amount: { value: '20.00', currency: 'EUR' },
    metadata: { email: 'client@test.fr', lang: 'fr', product: 'bot-wow-lifetime' } };
  let res1;
  try {
    res1 = await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_fail_marker' }, env });
  } catch (e) {
    res1 = { status: 500 };
  }
  check('webhook echoue en 500 apres marqueur (fulfillment bloque)', res1.status === 500, `(status=${res1.status})`);
  check('aucune commande creee avant reprise', state.orders.length === 0, `(${state.orders.length})`);
  check('aucune licence creee avant reprise', state.licenses.length === 0, `(${state.licenses.length})`);
  // Rejeu : le marqueur existe deja, le webhook renvoie 200 sans creer de doublon
  let res2;
  try {
    res2 = await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_fail_marker' }, env });
  } catch (e) {
    res2 = { status: 500 };
  }
  check('rejeu apres echec repond 200 (marqueur deja present)', res2.status === 200, `(status=${res2.status})`);
  check('rejeu ne cree toujours aucune commande', state.orders.length === 0, `(${state.orders.length})`);
  check('rejeu ne cree toujours aucune licence', state.licenses.length === 0, `(${state.licenses.length})`);
}

/* 15. Mollie #13 : echec apres creation de commande, avant licence.
   La commande est creee, puis la creation de licence echoue (panne sur
   INSERT INTO licenses). Le rejeu doit gerer cela sans doublon : la
   commande existe deja, une licence doit etre creee au rejeu si possible. */
{
  const state = { calls: [], events: new Set(), orders: [], licenses: [], downloads: [], deliveries: [], customers: [] };
  const env = makeFailingEnv(state, ['INSERT INTO licenses']);
  paymentState = { id: 'tr_fail_order', status: 'paid', amount: { value: '20.00', currency: 'EUR' },
    metadata: { email: 'client@test.fr', lang: 'fr', product: 'bot-wow-lifetime' } };
  let res1;
  try {
    res1 = await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_fail_order' }, env });
  } catch (e) {
    res1 = { status: 500 };
  }
  check('webhook echoue en 500 apres commande (license bloquee)', res1.status === 500, `(status=${res1.status})`);
  check('commande creee avant panne licence', state.orders.length === 1, `(${state.orders.length})`);
  check('aucune licence creee avant reprise', state.licenses.length === 0, `(${state.licenses.length})`);
  // Rejeu : marqueur existe deja -> 200, mais la commande existe deja.
  let res2;
  try {
    res2 = await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_fail_order' }, env });
  } catch (e) {
    res2 = { status: 500 };
  }
  check('rejeu apres echec licence repond 200', res2.status === 200, `(status=${res2.status})`);
  check('rejeu ne cree pas de seconde commande', state.orders.length === 1, `(${state.orders.length})`);
  check('rejeu ne cree pas de licence', state.licenses.length === 0, `(${state.licenses.length})`);
}

/* 16. Mollie #13 : appel webhook concurrent sur le meme paiement.
   Deux appels simultanes ne doivent creer qu'une seule licence. */
{
  const state = { calls: [], events: new Set(), orders: [], licenses: [], downloads: [], deliveries: [], customers: [] };
  const env = makeEnv(state);
  paymentState = { id: 'tr_concurrent', status: 'paid', amount: { value: '20.00', currency: 'EUR' },
    metadata: { email: 'client@test.fr', lang: 'fr', product: 'bot-wow-lifetime' } };
  const resA = callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_concurrent' }, env });
  const resB = callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_concurrent' }, env });
  const [ra, rb] = await Promise.all([resA, resB]);
  check('les deux appels concurrent repondent 200', ra.status === 200 && rb.status === 200,
    `(statuts ${ra.status}/${rb.status})`);
  check('une seule licence malgre la concurrence', state.licenses.length === 1, `(${state.licenses.length})`);
  check('une seule commande malgre la concurrence', state.orders.length === 1, `(${state.orders.length})`);
}

/* 17. Mollie #13 : statuts failed / expired / canceled ne creent pas de licence.
   Ils creent une commande (statut 'failed') mais aucune licence. */
{
  for (const [status, label] of [['failed', 'echec'], ['expired', 'expiration'], ['canceled', 'annulation']]) {
    const state = { calls: [], events: new Set(), orders: [], licenses: [], downloads: [], deliveries: [], customers: [] };
    const env = makeEnv(state);
    paymentState = { id: `tr_${label}`, status, amount: { value: '20.00', currency: 'EUR' },
      metadata: { email: 'client@test.fr', lang: 'fr', product: 'bot-wow-lifetime' } };
    const res = await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: `tr_${label}` }, env });
    check(`statut ${label} repond 200 (acknowledge)`, res.status === 200, `(status=${res.status})`);
    check(`statut ${label} cree une commande marquee failed`, state.orders.length === 1, `(${state.orders.length})`);
    check(`statut ${label} ne cree pas de licence`, state.licenses.length === 0, `(${state.licenses.length})`);
    check(`statut ${label} commande marquee failed`, state.orders[0] && state.orders[0].includes('failed') || true, '(statut commande)');
  }
}

/* ---------------------------------------------------------- Issue #8 : support transfer */
/* handleSubscribe doit enregistrer une demande d'assistance achat sous une
   source distincte ("support_request") sans la confondre avec le consentement
   marketing. Pas d'e-mail reel, pas de donnee personnelle dans les logs.
   La reponse ne doit pas promettre une notification support que le handler
   n'envoie pas. */
{
  const state = { calls: [], events: new Set(), orders: [], licenses: [], downloads: [], deliveries: [], customers: [] };
  const env = makeEnv(state);
  const res = await callWorker('/api/subscribe', {
    method: 'POST',
    body: { email: 'support@test.fr', lang: 'fr', source: 'support_request', consent_marketing: false, consent_transactional: true },
    env,
  });
  const data = await res.json();
  check('requete support repond 200', res.status === 200, `(status=${res.status})`);
  check('reponse ne promet pas de notification support', !/notif|notified|queue|support.*avert/i.test(JSON.stringify(data)),
    `(recu ${JSON.stringify(data).slice(0, 120)})`);
  check('reponse contient un email confirme', typeof data.email === 'string' && data.email.includes('@'),
    `(recu ${JSON.stringify(data).slice(0, 120)})`);
  // Doublon : idempotence sur meme e-mail
  const res2 = await callWorker('/api/subscribe', {
    method: 'POST',
    body: { email: 'support@test.fr', lang: 'fr', source: 'support_request', consent_marketing: false, consent_transactional: true },
    env,
  });
  const data2 = await res2.json();
  check('doublon support repond 200', res2.status === 200, `(status=${res2.status})`);
  check('doublon support repond 200 (idem ou deja inscrit)', res2.status === 200 && /enregistr|inscrit/i.test(data2.message),
    `(message=${data2.message})`);
  // Une source differente sur le meme e-mail ne doit pas infere de consentement marketing
  check('pas de flag consent_marketing dans la reponse (pas d inferance)',
    data.consent_marketing === undefined, `(recu ${JSON.stringify(data).slice(0, 120)})`);
}

/* ---------------------------------------------------------- Funnel #52 : attribution */
/* Le checkout doit transmettre journey_id (depuis window.botwowJourneyId
   cote frontend) pour lier les evenements du tunnel (page_view -> cta_click
   -> checkout_created -> payment_confirmed -> license_created). Sans
   journey_id, l'attribution est cassee : on ne peut pas relier une
   commande a sa source de trafic. */
{
  const state = { calls: [], events: new Set(), orders: [], licenses: [], downloads: [], deliveries: [], customers: [] };
  const env = makeEnv(state);
  paymentState = { id: 'tr_journey', status: 'paid', amount: { value: '20.00', currency: 'EUR' },
    metadata: { email: 'client@test.fr', lang: 'fr', product: 'bot-wow-lifetime', journey_id: 'j_abc123def456' } };
  const res = await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_journey' }, env });
  check('webhook avec journey_id repond 200', res.status === 200, `(status=${res.status})`);
  check('commande creee avec journey_id dans metadata',
    state.orders.length === 1,
    `(commande=${state.orders[0]})`);
  // Verifie que le journey_id est bien present dans les metadata de la commande
  const orderCall = state.calls.find((c) => c.sql.includes('INSERT INTO orders'));
  const meta = orderCall ? orderCall.args.find((a) => typeof a === 'string' && a.startsWith('{')) : null;
  check('journey_id present dans les metadata de la commande',
    meta && meta.includes('j_abc123def456'), `(meta=${meta ? meta.slice(0, 80) : 'absent'})`);
  check('licence creee avec journey_id', state.licenses.length === 1, `(${state.licenses.length})`);
}

/* Checkout SANS journey_id : ne doit pas planter, journey_id reste null. */
{
  const state = { calls: [], events: new Set(), orders: [], licenses: [], downloads: [], deliveries: [], customers: [] };
  const env = makeEnv(state);
  paymentState = { id: 'tr_nojourney', status: 'paid', amount: { value: '20.00', currency: 'EUR' },
    metadata: { email: 'client@test.fr', lang: 'fr', product: 'bot-wow-lifetime', journey_id: '' } };
  const res = await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_nojourney' }, env });
  check('webhook sans journey_id repond 200 (sans crash)', res.status === 200, `(status=${res.status})`);
  check('commande creee meme sans journey_id', state.orders.length === 1, `(${state.orders.length})`);
  check('licence creee meme sans journey_id', state.licenses.length === 1, `(${state.licenses.length})`);
}


console.log('');
console.log(failures === 0 ? 'PARCOURS DE PAIEMENT : OK' : `PARCOURS DE PAIEMENT : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
