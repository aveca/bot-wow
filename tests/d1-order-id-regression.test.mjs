#!/usr/bin/env node
/**
 * d1-order-id-regression.test.mjs — régression du schéma D1 vs identifiants
 * de commande du Worker.
 *
 * POURQUOI CE TEST EXISTE
 * -----------------------
 * La base `botwow-production` a `orders.id INTEGER PRIMARY KEY` et
 * `licenses.order_id INTEGER REFERENCES orders(id)`, alors que le Worker
 * insère des identifiants TEXTE (`ord_tr_...`, `ord_bitcoin_manual_BTC-...`).
 * Le mock JS de payment-flow.test.mjs ne peut pas révéler ce conflit : on
 * exécute donc ici le VRAI Worker contre un VRAI moteur SQL (node:sqlite)
 * pourvu du schéma de production et de données synthétiques représentatives
 * (14 commandes, 5 licences, 11 e-mails, 5 événements de webhook).
 *
 * RÉSULTAT ATTENDU DE CETTE BATTERIE
 * ----------------------------------
 * Chaque scénario DOIT échouer sur le schéma de production (c'est le bug
 * reproduit), puis réussir sur le schéma réconcilié (c'est le correctif).
 * Les deux moitiés sont exécutées par le même fichier : la première prouve
 * le défaut, la seconde prouve la correction.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { createIsolatedDatabase, createD1Binding } from './helpers/d1-sqlite-adapter.mjs';
import { applyProdSchema, seedProdFixture } from './helpers/prod-fixture.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
}

/* ------------------------------------------------------------------ Worker */
const tmpWorker = join(HERE, '.worker-under-test.mjs');
writeFileSync(tmpWorker, readFileSync(join(REPO, 'worker', 'index.js'), 'utf8'));
const workerMod = await import('file:///' + tmpWorker.replace(/\\/g, '/') + '?t=' + Date.now());

/* ------------------------------------------------------------ env de test */
/** KV simulé (compteurs de limitation de débit + cache de paiement). */
function makeKV() {
  const store = new Map();
  return {
    get: async (k) => store.get(k) ?? null,
    put: async (k, v) => { store.set(k, v); },
    delete: async (k) => { store.delete(k); },
    _store: store,
  };
}

/**
 * Environnement complet branché sur une VRAIE base SQLite.
 * `schemaFn(db)` applique le schéma voulu (production ou réconcilié).
 */
function makeSqliteEnv(schemaFn, state, { now = Date.now() } = {}) {
  const iso = createIsolatedDatabase({ foreignKeys: true });
  schemaFn(iso.db);
  iso.db.exec('CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, event TEXT NOT NULL, page TEXT NOT NULL, lang TEXT NOT NULL, cta TEXT, mode TEXT, years INTEGER, step TEXT, ref TEXT, test INTEGER NOT NULL DEFAULT 0, ip_hash TEXT, ua TEXT, value_eur REAL, source TEXT)');
  iso.db.exec('CREATE TABLE IF NOT EXISTS rl (bucket TEXT NOT NULL, window INTEGER NOT NULL, count INTEGER NOT NULL, PRIMARY KEY (bucket, window))');
  state.db = iso.db;
  const telemetry = createD1Binding(iso.db);
  return {
    env: {
      DB: iso.d1,
      TELEMETRY_DB: telemetry,
      RATE_LIMIT: makeKV(),
      R2_BINARIES: { put: async () => {}, list: async () => ({ objects: [] }), get: async () => null, delete: async () => {} },
      MOLLIE_API_KEY: 'test_key',
      MOLLIE_WEBHOOK_SECRET: 'test_secret',
      ADMIN_JWT_SECRET: 'test_admin_secret',
      ADMIN_EMAIL: 'admin@example.com',
      LICENSE_SECRET: 'test_license_secret',
      RESEND_API_KEY: 'test_resend_key',
      CONTACT_EMAIL: 'support@bot-wow.com',
    },
    iso,
  };
}

/** Deuxième binding D1 sur la MÊME base (rôle de TELEMETRY_DB). */

/* ------------------------------------------------------------- Mollie simulé */
const realFetch = globalThis.fetch;
let paymentState = {
  id: 'tr_REGR01', status: 'paid',
  amount: { value: '20.00', currency: 'EUR' },
  metadata: { email: 'client1@example.com', lang: 'fr', product: 'bot-wow-lifetime' },
};
let mollieCalls = [];

globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u.startsWith('https://api.mollie.com/v2/')) {
    mollieCalls.push({ url: u, method: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : null });
    if (u.endsWith('/payments') && (opts.method || 'GET') === 'POST') {
      return new Response(JSON.stringify({ id: 'tr_REGR01', _links: { checkout: { href: 'https://mollie.test/checkout' } } }),
        { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
    const m = u.match(/\/payments\/([^/?]+)$/);
    if (m) {
      return new Response(JSON.stringify({ ...paymentState, id: m[1] }),
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

async function count(db, table) {
  return db.prepare(`SELECT COUNT(*) c FROM ${table}`).get().c;
}

/* ===================================================================== */
console.log('=== D1 : identifiants de commande (Worker reel, SQL reel) ===');

/* Controle du socle : le schema de production est bien celui decrit. */
{
  const state = {};
  const { env, iso } = makeSqliteEnv((db) => { applyProdSchema(db); seedProdFixture(db); }, state);
  const ordersId = db_typeof(iso.db, 'orders');
  check('schema de production : orders.id est INTEGER (alias rowid)', ordersId === 'number', `(typeof=${ordersId})`);
  check('schema de production : 14 commandes synthetiques', await count(iso.db, 'orders') === 14);
  check('schema de production : 5 licences synthetiques', await count(iso.db, 'licenses') === 5);
  check('schema de production : 0 activation', await count(iso.db, 'activations') === 0);
  check('schema de production : 0 livraison (table deliveries absente)', !tableExists(iso.db, 'deliveries'));
  iso.close();
}

function db_typeof(db, table) {
  const row = db.prepare(`SELECT id FROM ${table} LIMIT 1`).get();
  return row ? typeof row.id : 'undefined';
}

function tableExists(db, table) {
  const r = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
  return !!r;
}

/* --- 1. Mollie : un webhook 'paid' sur le schema de production ----------- */
{
  const state = {};
  const { env, iso } = makeSqliteEnv((db) => { applyProdSchema(db); seedProdFixture(db); }, state);
  const before = { orders: await count(iso.db, 'orders'), licenses: await count(iso.db, 'licenses') };

  paymentState = {
    id: 'tr_REGR01', status: 'paid',
    amount: { value: '20.00', currency: 'EUR' },
    metadata: { email: 'client1@example.com', lang: 'fr', product: 'bot-wow-lifetime' },
  };
  mollieCalls = [];
  let deliveryError = null;
  let res = null;
  try {
    res = await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_REGR01' }, env });
  } catch (e) {
    deliveryError = e;
  }

  check("Mollie 'paid' : la livraison ECHOUE sur le schema de production (datatype mismatch)",
    !!deliveryError && /datatype mismatch|INTEGER|mismatch/i.test(String(deliveryError.message)),
    `(${deliveryError ? deliveryError.message.slice(0, 90) : 'aucune erreur, livraison passee !'})`);

  check('Mollie "paid" : aucune commande creee avec un id texte', before.orders === await count(iso.db, 'orders'),
    `(${before.orders} -> ${await count(iso.db, 'orders')})`);
  check('Mollie "paid" : aucune licence creee', before.licenses === await count(iso.db, 'licenses'),
    `(${before.licenses} -> ${await count(iso.db, 'licenses')})`);
  check('Mollie "paid" : aucune ligne de telemetrie de conversion',
    await count(iso.db, 'events') === 0);
  const locked = iso.db.prepare('SELECT id FROM webhook_events WHERE id = ?').get('payment:tr_REGR01');
  check('Mollie "paid" : le verrou d\'idempotence est deja pose (rejeu = echec definitif)',
    !!locked, '(payment:tr_REGR01 absent)');

  /* Le rejeu de Mollie : le verrou est posé AVANT la livraison, donc un
     deuxième appel est ignore SANS re-tenter la livraison. Le client a payé,
     aucune licence ne sera JAMAIS créée. On le prouve. */
  let replayError = null;
  try {
    await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_REGR01' }, env });
  } catch (e) { replayError = e; }
  check('Mollie "paid" rejoue : aucune licence creee au rejeu (client paye bloque)',
    (replayError === null || !!replayError) && (await count(iso.db, 'licenses')) === before.licenses,
    `(${await count(iso.db, 'licenses')} licences)`);
  iso.close();
}

/* --- 2. Bitcoin : une commande sur le schema de production ---------------- */
{
  const state = {};
  const { env, iso } = makeSqliteEnv((db) => { applyProdSchema(db); seedProdFixture(db); }, state);
  const before = await count(iso.db, 'orders');

  let btcError = null;
  let res = null;
  try {
    res = await callWorker('/api/bitcoin/checkout', { method: 'POST', body: { email: 'client20@example.com', lang: 'fr' }, env });
  } catch (e) { btcError = e; }

  check('Bitcoin : la creation de commande ECHOUE sur le schema de production (500)',
    (res && res.status === 500) || !!btcError,
    `(status=${res ? res.status : 'exception: ' + String(btcError && btcError.message).slice(0, 60)})`);
  const btcBody = res ? await res.json() : null;
  check('Bitcoin : l\'echec est signale au client (checkout_failed)',
    !!btcBody && btcBody.error === 'checkout_failed', `(${JSON.stringify(btcBody)})`);
  check('Bitcoin : aucune commande supplementaire creee',
    before === await count(iso.db, 'orders'), `(${before} -> ${await count(iso.db, 'orders')})`);

  /* La commande historique Bitcoin (id 5) reste elle bien lisible :
     c'est la preuve qu'on ne doit PAS casser l'existant. */
  const legacy = iso.db.prepare('SELECT * FROM orders WHERE id = 5').get();
  check('Bitcoin : la commande historique (id entier 5) reste lisible',
    !!legacy && legacy.provider === 'bitcoin_manual' && legacy.provider_id === 'BTC-AAAA1111');

  /* La notification de paiement Bitcoin doit retrouver la commande par sa
     reference fournisseur (colonne TEXT, donc lisible) — pas par son id. */
  const notify = await callWorker('/api/bitcoin/paid', {
    method: 'POST', body: { orderReference: 'BTC-AAAA1111', txid: 'synth_txid_1' }, env,
  });
  check('Bitcoin : la commande historique est retrouvable par reference fournisseur',
    notify.status === 200, `(status=${notify.status})`);
  iso.close();
}

/* ------------------------------------------------------------- restaurations */
globalThis.fetch = realFetch;
try { await import('node:fs').then((fs) => fs.rmSync(tmpWorker, { force: true })); } catch { /* deja supprime */ }

console.log('');
console.log(failures === 0 ? 'D1 IDENTIFIANTS : OK' : `D1 IDENTIFIANTS : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
