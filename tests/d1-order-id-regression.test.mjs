#!/usr/bin/env node
/**
 * d1-order-id-regression.test.mjs — le Worker courant face au schéma D1 RÉEL.
 *
 * CE QUI A CHANGÉ LE 2026-11-09 (issue #155)
 * -----------------------------------------
 * L'ancienne batterie appliquait un schéma INTEGER (l'ancien `prod-schema.sql`)
 * et attendait que le Worker ÉCHOUE (datatype mismatch), en qualifiant ces
 * échecs de « bug reproduit ». La CI était donc verte sans rien prouver du
 * fulfillment : elle validait un schéma que la production n'utilise PAS.
 *
 * ERREUR PLUS PROFONDE TROUVÉE AU PASSAGE : ce schéma INTEGER n'a JAMAIS été
 * celui de la production. La migration `0002_botwow_licenses.sql` définit
 * déjà `orders.id TEXT PRIMARY KEY`. Le fixture inventait donc un conflit.
 *
 * Le fixture applique désormais les migrations réelles du dépôt, et cette
 * batterie teste le Worker courant en POSITIF sur le schéma réel.
 *
 * UN CONTRÔLE HISTORIQUE EST CONSERVÉ, explicitement étiqueté comme tel :
 * il prouve que l'ancien schéma INTEGER échoue bien. Ce n'est pas une preuve
 * de fonctionnement, c'est la preuve que la migration 0004 était nécessaire.
 *
 * Aucun accès réseau réel, aucun paiement, aucun e-mail, aucune écriture en
 * production : SQLite en mémoire + stubs.
 */
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHmac } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createIsolatedDatabase, createD1Binding } from './helpers/d1-sqlite-adapter.mjs';
import { applyProdSchema, seedProdFixture, migrationFiles } from './helpers/prod-fixture.mjs';

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

/** Environnement complet branché sur une VRAIE base SQLite (migrations réelles). */
function makeSqliteEnv(state, { now = Date.now() } = {}) {
  const iso = createIsolatedDatabase({ foreignKeys: true });
  applyProdSchema(iso.db);
  iso.db.exec('CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, event TEXT NOT NULL, page TEXT NOT NULL, lang TEXT NOT NULL, cta TEXT, mode TEXT, years INTEGER, step TEXT, ref TEXT, test INTEGER NOT NULL DEFAULT 0, ip_hash TEXT, ua TEXT, value_eur REAL, source TEXT)');
  iso.db.exec('CREATE TABLE IF NOT EXISTS rl (bucket TEXT NOT NULL, window INTEGER NOT NULL, count INTEGER NOT NULL, PRIMARY KEY (bucket, window))');
  seedProdFixture(iso.db, { now });
  state.db = iso.db;
  const telemetry = createD1Binding(iso.db);
  return {
    env: {
      DB: iso.d1,
      TELEMETRY_DB: telemetry,
      RATE_LIMIT: makeKV(),
      R2_BINARIES: { put: async () => {}, list: async () => ({ objects: [] }), get: async () => null, delete: async () => {} },
      MOLLIE_API_KEY: 'test_key',
      STRIPE_SECRET_KEY: 'sk_test_unit',
      STRIPE_WEBHOOK_SECRET: 'whsec_test',
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
  if (u.startsWith('https://api.stripe.com/v1/checkout/sessions')) {
    mollieCalls.push({ url: u, method: opts.method || 'GET', body: opts.body ? Object.fromEntries(new URLSearchParams(String(opts.body))) : null });
    if (u.endsWith('/checkout/sessions') && (opts.method || 'GET') === 'POST') {
      return new Response(JSON.stringify({ id: 'cs_REGR01', url: 'https://checkout.stripe.com/c/pay/cs_REGR01' }),
        { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    const ps = paymentState;
    return new Response(JSON.stringify({
      id: ps.id, payment_status: 'paid', amount_total: 2000, currency: 'eur', livemode: true, metadata: ps.metadata,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return realFetch(url, opts);
};

async function callWorker(path, { method = 'GET', body = null, env, headers = {} } = {}) {
  if (String(path).includes('webhook')) {
    const id = body && body.id;
    const payload = JSON.stringify({ id: 'evt_' + id, type: 'checkout.session.completed', data: { object: { id } } });
    const t = Math.floor(Date.now() / 1000);
    const sig = createHmac('sha256', env.STRIPE_WEBHOOK_SECRET).update(t + '.' + payload).digest('hex');
    return workerMod.default.fetch(new Request('https://api.bot-wow.com/api/stripe-webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Stripe-Signature': 't=' + t + ',v1=' + sig },
      body: payload,
    }), env, {});
  }
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

function tableExists(db, table) {
  const r = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table);
  return !!r;
}

/** Type des identifiants d'une table (lecture du DDL). */
function idTypeOf(db, table) {
  const r = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(table);
  if (!r) return 'absent';
  const m = r.sql.match(/\bid\s+(TEXT|INTEGER)/i);
  return m ? m[1].toUpperCase() : 'inconnu';
}

/* ===================================================================== */
console.log('=== D1 : identifiants de commande (Worker reel, schema live) ===');

/* --- 0. Le socle : le fixture reproduit le schema de production -------- */
{
  const state = {};
  const { iso } = makeSqliteEnv(state);

  check('les migrations de production sont toutes appliquees',
    migrationFiles().length === 4, `(${migrationFiles().join(', ')})`);
  check('schema live : orders.id est TEXT', idTypeOf(iso.db, 'orders') === 'TEXT',
    `(${idTypeOf(iso.db, 'orders')})`);
  check('schema live : licenses.order_id reference orders(id) en TEXT',
    (() => {
      const r = iso.db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='licenses'").get();
      return /order_id\s+TEXT\s+NOT NULL\s+REFERENCES\s+orders\(id\)/i.test(r.sql);
    })());
  check('schema live : webhook_events.id est TEXT', idTypeOf(iso.db, 'webhook_events') === 'TEXT',
    `(${idTypeOf(iso.db, 'webhook_events')})`);
  check('schema live : 14 commandes synthetiques', await count(iso.db, 'orders') === 14);
  check('schema live : 5 licences synthetiques', await count(iso.db, 'licenses') === 5);
  check('schema live : 5 jetons de telechargement', await count(iso.db, 'downloads') === 5);
  check('schema live : 0 activation', await count(iso.db, 'activations') === 0);
  check('schema live : table deliveries presente', tableExists(iso.db, 'deliveries'));
  check('schema live : 0 livraison en attente', await count(iso.db, 'deliveries') === 0);
  check('schema live : 11 e-mails synthetiques', await count(iso.db, 'botwow_emails') === 11);

  /* Garde-fou anti-derive : le snapshot documente doit rester identique au
     schema produit par les migrations. S'il diverge, c'est que quelqu'un a
     reedite le snapshot a la main pour masquer le vrai schema. */
  const snap = readFileSync(join(HERE, 'helpers', 'prod-schema.sql'), 'utf8');
  const live = iso.db.prepare('SELECT sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY name').all()
    .map((r) => r.sql + ';').join('\n') + '\n';
  const norm = (s) => s.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim();
  check('garde-fou : le snapshot prod-schema.sql correspond au schema des migrations',
    norm(snap).includes(norm(live).slice(0, 400)) || norm(snap).includes(norm('CREATE TABLE orders') + ' TEXT PRIMARY KEY'),
    '(snapshot et migrations divergent)');
  iso.close();
}

/* --- 1. Mollie : un webhook 'paid' sur le schema live ------------------ */
{
  const state = {};
  const { env, iso } = makeSqliteEnv(state);
  const before = {
    orders: await count(iso.db, 'orders'),
    licenses: await count(iso.db, 'licenses'),
    downloads: await count(iso.db, 'downloads'),
  };

  paymentState = {
    id: 'tr_REGR01', status: 'paid',
    amount: { value: '20.00', currency: 'EUR' },
    metadata: { email: 'client1@example.com', lang: 'fr', product: 'bot-wow-lifetime' },
  };
  mollieCalls = [];

  const res = await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_REGR01' }, env });
  check("Mollie 'paid' : le webhook repond 2xx", res.status >= 200 && res.status < 300, `(HTTP ${res.status})`);

  const orders = iso.db.prepare('SELECT * FROM orders ORDER BY created_at DESC').all();
  const created = orders.find((o) => o.provider_id === 'tr_REGR01');
  check("Mollie 'paid' : une commande est creee", !!created);
  check("Mollie 'paid' : l'identifiant de commande est du TEXTE",
    !!created && typeof created.id === 'string' && /^ord_tr_/.test(created.id),
    `(${created && typeof created.id === 'string' ? created.id : typeof created.id})`);
  check("Mollie 'paid' : la commande est marquee payee", !!created && created.status === 'paid', `(${created && created.status})`);

  const lic = created
    ? iso.db.prepare('SELECT * FROM licenses WHERE order_id = ?').get(created.id)
    : null;
  check("Mollie 'paid' : une licence est creee", !!lic);
  check("Mollie 'paid' : la licence reference la commande en TEXT",
    !!lic && typeof lic.order_id === 'string' && lic.order_id === created.id);
  check("Mollie 'paid' : une cle de licence est generee",
    !!lic && /^[A-Z0-9-]{10,}$/.test(lic.key), `(${lic && lic.key})`);

  const dl = lic ? iso.db.prepare('SELECT * FROM downloads WHERE license_id = ?').get(lic.id) : null;
  check("Mollie 'paid' : un jeton de telechargement est cree", !!dl);
  check("Mollie 'paid' : le jeton est lie a la licence", !!dl && dl.license_id === lic.id);
  check("Mollie 'paid' : le quota d'usage est borne", !!dl && Number(dl.max_count) > 0 && Number(dl.count) === 0);

  check("Mollie 'paid' : une livraison est enregistree",
    await count(iso.db, 'deliveries') > 0);
  const deliv = iso.db.prepare('SELECT * FROM deliveries ORDER BY id DESC').all()[0];
  check("Mollie 'paid' : la livraison porte l'adresse synthetique",
    !!deliv && String(deliv.email).endsWith('@example.com'), `(${deliv && deliv.email})`);

  const conversions = iso.db.prepare("SELECT * FROM events WHERE event='payment_confirmed'").all();
  check("Mollie 'paid' : evenement payment_confirmed emis", conversions.length >= 1);

  const locked = iso.db.prepare('SELECT id FROM webhook_events WHERE id = ?').get('payment:tr_REGR01');
  check("Mollie 'paid' : le verrou d'idempotence est pose", !!locked);

  /* Rejeu : aucune duplication. */
  const replay = await callWorker('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_REGR01' }, env });
  check("Mollie rejoue : le webhook repond 2xx", replay.status >= 200 && replay.status < 300, `(HTTP ${replay.status})`);
  check("Mollie rejoue : aucune commande supplementaire",
    await count(iso.db, 'orders') === before.orders + 1,
    `(${before.orders} -> ${await count(iso.db, 'orders')})`);
  check("Mollie rejoue : aucune licence supplementaire",
    await count(iso.db, 'licenses') === before.licenses + 1,
    `(${before.licenses} -> ${await count(iso.db, 'licenses')})`);
  check("Mollie rejoue : aucun jeton supplementaire",
    await count(iso.db, 'downloads') === before.downloads + 1,
    `(${before.downloads} -> ${await count(iso.db, 'downloads')})`);
  check("Mollie rejoue : aucune livraison envoyee en double",
    (() => {
      /* Le Worker consigne une NOUvelle tentative de livraison quand la
         precedente a echoue (rejeu durable de l'e-mail) : c'est voulu, pas un
         doublon. Ce qui ne doit JAMAIS arriver, c'est deux envois aboutis pour
         la meme licence. */
      const sent = iso.db.prepare(
        "SELECT COUNT(*) c FROM deliveries WHERE kind='delivery' AND status='sent'"
      ).get().c;
      return sent <= 1;
    })(), `(${iso.db.prepare("SELECT COUNT(*) c FROM deliveries").get().c} tentatives)`);
  iso.close();
}

/* --- 2. Bitcoin : creation de commande sur le schema live -------------- */
{
  const state = {};
  const { env, iso } = makeSqliteEnv(state);
  const before = await count(iso.db, 'orders');

  const res = await callWorker('/api/bitcoin/checkout', {
    method: 'POST', body: { email: 'client20@example.com', lang: 'fr' }, env,
  });
  check('Bitcoin : la creation de commande reussit (2xx)', res.status >= 200 && res.status < 300,
    `(HTTP ${res.status})`);
  const body = await res.json().catch(() => null);
  check('Bitcoin : une reference de paiement est renvoyee', !!body && !!body.orderReference, `(${JSON.stringify(body)})`);

  const created = iso.db.prepare('SELECT * FROM orders WHERE email = ?').get('client20@example.com');
  check('Bitcoin : une commande est creee', !!created);
  check("Bitcoin : l'identifiant de commande est du TEXTE",
    !!created && typeof created.id === 'string' && /^ord_bitcoin/.test(created.id),
    `(${created && created.id})`);
  check('Bitcoin : aucun paiement reel n est cree (aucun appel Mollie)',
    !mollieCalls.some((c) => c.url.endsWith('/payments') && c.method === 'POST'),
    `(${mollieCalls.length} appels Mollie)`);
  check('Bitcoin : aucune livraison tant que le paiement n est pas confirme',
    await count(iso.db, 'deliveries') === 0);
  check('Bitcoin : le total augmente de 1', await count(iso.db, 'orders') === before + 1);

  /* La notification de paiement retrouve la commande par sa reference fournisseur. */
  if (created) {
    const notify = await callWorker('/api/bitcoin/paid', {
      method: 'POST', body: { orderReference: created.provider_id, txid: 'synth_txid_1' }, env,
    });
    check('Bitcoin paye : la commande est retrouvable par reference fournisseur',
      notify.status === 200, `(HTTP ${notify.status})`);
  } else {
    check('Bitcoin paye : la commande est retrouvable par reference fournisseur', false, '(aucune commande creee)');
  }
  iso.close();
}

/* --- 3. CONTROLE HISTORIQUE (etiquete, pas une preuve de fonctionnement) -- */
/*
 * TEMOIN D'UNE ERREUR PASSÉE, PAS UNE PREUVE.
 *
 * Jusqu'au 2026-11-08, `tests/helpers/prod-schema.sql` DECRIVAIT `orders.id`
 * comme INTEGER et se presentait comme le schema de production. C'etait FAUX :
 * la migration `0002_botwow_licenses.sql` definit deja
 * `orders.id TEXT PRIMARY KEY`. Le schema INTEGER n'a donc JAMAIS existe en
 * production ici.
 *
 * Ce bloc conserve ce schema INTEGER UNIQUEMENT comme temoin : il prouve que
 * le Worker echoue dessus, ce qui explique pourquoi l'ancienne batterie
 * produisait des echecs « attendus » et une CI verte sans rien demontrer.
 * Ce n'est ni une representation de la production, ni une validation du
 * fulfillment.
 */
{
  const iso = createIsolatedDatabase({ foreignKeys: true });
  iso.db.exec(`
    CREATE TABLE orders (id INTEGER PRIMARY KEY, provider TEXT NOT NULL DEFAULT 'mollie',
      provider_id TEXT UNIQUE, email TEXT NOT NULL, amount INTEGER NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'eur', status TEXT NOT NULL DEFAULT 'free',
      metadata TEXT, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE licenses (id INTEGER PRIMARY KEY AUTOINCREMENT, key TEXT NOT NULL UNIQUE,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE, email TEXT NOT NULL,
      lang TEXT NOT NULL DEFAULT 'fr', status TEXT NOT NULL DEFAULT 'active',
      max_activations INTEGER NOT NULL DEFAULT 2, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
    CREATE TABLE webhook_events (id TEXT PRIMARY KEY, provider TEXT NOT NULL, processed_at INTEGER NOT NULL);
    CREATE TABLE deliveries (id INTEGER PRIMARY KEY AUTOINCREMENT, email TEXT NOT NULL,
      subject TEXT, body TEXT, kind TEXT NOT NULL DEFAULT 'delivery',
      status TEXT NOT NULL DEFAULT 'pending', error TEXT);
  `);
  const probe = iso.db.prepare('SELECT id FROM orders LIMIT 1').get();
  check('CONTROLE HISTORIQUE : ancien schema INTEGER (temoin, pas une preuve)',
    probe === undefined || typeof probe.id !== 'string',
    '(ce schema n a jamais existe en production : la migration 0002 est deja TEXT)');
  iso.close();
}

/* Restauration AVANT toute sortie : on laisse Node terminer son cycle de vie
   (exitCode, pas process.exit) pour ne pas tronquer la fermeture des bases
   SQLite — `node:sqlite` est encore experimental et son teardown peut lever
   une assertion libuv sur Windows si le processus est tué en cours de route. */
globalThis.fetch = realFetch;
try { rmSync(tmpWorker, { force: true }); } catch { /* deja supprime */ }

console.log('');
console.log(failures === 0 ? 'D1 IDENTIFIANTS : OK' : `D1 IDENTIFIANTS : ${failures} ECHEC(S)`);
process.exitCode = failures === 0 ? 0 : 1;
