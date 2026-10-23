#!/usr/bin/env node
/**
 * d1-order-id-migration.test.mjs — validation de la migration de
 * reconciliation des identifiants de commande sur une base ISOLEE.
 *
 * On ne touche JAMAIS une base distante : la migration est appliquee a une
 * copie en memoire pourvue du schema de production et des donnees
 * synthetiques (14 commandes, 5 licences, 11 e-mails, 5 evenements de
 * webhook, 0 activation, 0 livraison).
 *
 * Ce que ce test doit prouver :
 *   1. aucune donnee n'est perdue (comptes avant/apres identiques) ;
 *   2. les associations commande <-> licence historiques survivent ;
 *   3. les identifiants deviennent TEXT et les anciens entiers sont convertis
 *      en `ord_legacy_<valeur>` ;
 *   4. la migration est IDEMPOTENTE (rejouer ne double pas le prefixe) ;
 *   5. apres migration, le VRAI Worker livre une licence (webhook Mollie
 *      paye) et cree une commande Bitcoin ;
 *   6. les cles etrangeres et index uniques sont en place et fonctionnels.
 */
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createIsolatedDatabase } from './helpers/d1-sqlite-adapter.mjs';
import { applyProdSchema, seedProdFixture } from './helpers/prod-fixture.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const FIXED_NOW = 1_700_000_000_000;

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
}

function applyMigration(db, sql) {
  // D1 applies each migration atomically. Emulate that implicit transaction
  // locally so PRAGMA defer_foreign_keys has the same scope as production.
  db.exec('BEGIN');
  try {
    db.exec(sql);
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch { /* transaction already rolled back */ }
    throw error;
  }
}

const MIGRATION = readFileSync(
  join(REPO, 'migrations', 'production', '0004_reconcile_order_ids.sql'), 'utf8'
);

/* ===================================================================== */
console.log('=== MIGRATION 0004 : reconciliation (base isolee, SQL reel) ===');

const iso = createIsolatedDatabase({ foreignKeys: true });
const db = iso.db;
applyProdSchema(db);
seedProdFixture(db, { now: FIXED_NOW });

// The live DB currently has zero activations, but add one synthetic child row
// so the migration test proves ON DELETE CASCADE cannot silently erase them.
db.prepare(
  'INSERT INTO activations (license_id, machine_id, ip, user_agent, activated_at, last_seen_at) VALUES (?,?,?,?,?,?)'
).run(1, 'synthetic-machine-preserve-cascade', '192.0.2.1', 'migration-test', FIXED_NOW, FIXED_NOW);

/* --- etat AVANT ---------------------------------------------------------- */
const before = {
  orders: db.prepare('SELECT COUNT(*) c FROM orders').get().c,
  licenses: db.prepare('SELECT COUNT(*) c FROM licenses').get().c,
  downloads: db.prepare('SELECT COUNT(*) c FROM downloads').get().c,
  activations: db.prepare('SELECT COUNT(*) c FROM activations').get().c,
  emails: db.prepare('SELECT COUNT(*) c FROM botwow_emails').get().c,
  events: db.prepare('SELECT COUNT(*) c FROM webhook_events').get().c,
};
check('avant migration : 14 commandes', before.orders === 14, `(${before.orders})`);
check('avant migration : 5 licences', before.licenses === 5, `(${before.licenses})`);
check('avant migration : 5 jetons de téléchargement', before.downloads === 5, `(${before.downloads})`);
check('avant migration : activation synthetic pour tester ON DELETE CASCADE', before.activations === 1, `(${before.activations})`);
check('avant migration : orders.id est INTEGER', typeof db.prepare('SELECT id FROM orders LIMIT 1').get().id === 'number');
check('avant migration : licenses.order_id est INTEGER',
  typeof db.prepare('SELECT order_id FROM licenses LIMIT 1').get().order_id === 'number');

/* --- application --------------------------------------------------------- */
let migrationError = null;
try {
  applyMigration(db, MIGRATION);
} catch (e) { migrationError = e; }
check('la migration 0004 s-applique sans erreur', !migrationError,
  migrationError ? `(${migrationError.message.slice(0, 120)})` : '');

if (migrationError) {
  iso.close();
  console.log('\nMIGRATION 0004 : 1 ECHEC(S)');
  process.exit(1);
}

/* --- etat APRES : rien de perdu ------------------------------------------ */
const after = {
  orders: db.prepare('SELECT COUNT(*) c FROM orders').get().c,
  licenses: db.prepare('SELECT COUNT(*) c FROM licenses').get().c,
  downloads: db.prepare('SELECT COUNT(*) c FROM downloads').get().c,
  activations: db.prepare('SELECT COUNT(*) c FROM activations').get().c,
  emails: db.prepare('SELECT COUNT(*) c FROM botwow_emails').get().c,
  events: db.prepare('SELECT COUNT(*) c FROM webhook_events').get().c,
};
check('apres migration : 14 commandes conservees', after.orders === before.orders,
  `(${before.orders} -> ${after.orders})`);
check('apres migration : 5 licences conservees', after.licenses === before.licenses,
  `(${before.licenses} -> ${after.licenses})`);
check('apres migration : 5 jetons de téléchargement conservés', after.downloads === before.downloads,
  `(${before.downloads} -> ${after.downloads})`);
check('apres migration : activations conservees malgré ON DELETE CASCADE', after.activations === before.activations,
  `(${before.activations} -> ${after.activations})`);
const activationPreserved = db.prepare(
  'SELECT id, license_id, machine_id FROM activations WHERE machine_id = ?'
).get('synthetic-machine-preserve-cascade');
check('apres migration : activation synthetic conservee avec sa licence', !!activationPreserved &&
  activationPreserved.license_id === 1, JSON.stringify(activationPreserved || {}));
const downloadOrphans = db.prepare('SELECT COUNT(*) c FROM downloads d LEFT JOIN licenses l ON l.id = d.license_id WHERE l.id IS NULL').get().c;
check('apres migration : aucun téléchargement orphelin', downloadOrphans === 0, `(${downloadOrphans})`);
check('apres migration : les cinq jetons retrouvent leur licence', db.prepare('SELECT COUNT(*) c FROM downloads d JOIN licenses l ON l.id = d.license_id').get().c === 5);
check('apres migration : 11 inscriptions conservees', after.emails === before.emails,
  `(${before.emails} -> ${after.emails})`);
check('apres migration : 5 evenements de webhook conserves', after.events === before.events,
  `(${before.events} -> ${after.events})`);

/* --- etat APRES : associations historiques -------------------------------- */
const orphans = db.prepare(
  `SELECT COUNT(*) c FROM licenses l LEFT JOIN orders o ON o.id = l.order_id WHERE o.id IS NULL`
).get().c;
check('apres migration : aucune licence orpheline (jointure aboutit)', orphans === 0, `(${orphans})`);

const joined = db.prepare(
  `SELECT l.key AS license_key, o.provider_id AS ref
     FROM licenses l JOIN orders o ON o.id = l.order_id ORDER BY l.id`
).all();
check('apres migration : les 5 licences retrouvent leur commande', joined.length === 5, `(${joined.length})`);
check('apres migration : la reference fournisseur est preservee',
  joined.length === 5 && joined[0].ref === 'tr_SYN01', `(${joined[0] && joined[0].ref})`);

check('apres migration : orders.id est desormais TEXT',
  typeof db.prepare('SELECT id FROM orders LIMIT 1').get().id === 'string');
check('apres migration : licenses.order_id est desormais TEXT',
  typeof db.prepare('SELECT order_id FROM licenses LIMIT 1').get().order_id === 'string');

const stillNumeric = db.prepare("SELECT COUNT(*) c FROM orders WHERE CAST(id AS TEXT) GLOB '[0-9]*'").get().c;
check('apres migration : plus aucun id de commande numerique', stillNumeric === 0, `(${stillNumeric})`);
const numericRefs = db.prepare("SELECT COUNT(*) c FROM licenses WHERE order_id IS NOT NULL AND CAST(order_id AS TEXT) GLOB '[0-9]*'").get().c;
check('apres migration : plus aucune reference de licence numerique', numericRefs === 0, `(${numericRefs})`);
const legacy = db.prepare("SELECT COUNT(*) c FROM orders WHERE id LIKE 'ord_legacy_%'").get().c;
check('apres migration : les 14 identifiants historiques sont convertis', legacy === 14, `(${legacy})`);

const sample = db.prepare('SELECT * FROM orders WHERE id = ?').get('ord_legacy_9');
check('apres migration : la commande Bitcoin historique est intacte',
  !!sample && sample.provider === 'bitcoin_manual' && sample.provider_id === 'BTC-BBBB2222'
    && sample.status === 'paid' && sample.email === 'client9@example.com',
  sample ? `(${sample.provider}/${sample.provider_id}/${sample.status})` : '(absente)');

for (const t of ['deliveries', 'rate_limit', 'admin_sessions']) {
  const r = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(t);
  check(`apres migration : la table ${t} existe`, !!r);
}

const uniqWebhook = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name=?").get('idx_webhook_events_id');
check('apres migration : index UNIQUE idx_webhook_events_id present', !!uniqWebhook);
const activationIndex = db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name=?").get('idx_activations_license_machine');
check('apres migration : index UNIQUE idx_activations_license_machine present', !!activationIndex);
const fkProblems = db.prepare('PRAGMA foreign_key_check').all();
check('apres migration : aucune violation de clé étrangère', fkProblems.length === 0, JSON.stringify(fkProblems.slice(0, 3)));
let uniqueEnforced = false;
try {
  db.prepare("INSERT INTO webhook_events (id, provider, processed_at) VALUES (?,?,?)").run('payment:tr_SYN01', 'mollie', 1);
} catch (e) { uniqueEnforced = /UNIQUE|constraint/i.test(String(e.message)); }
check('apres migration : l\'unicite des evenements de webhook est appliquee', uniqueEnforced);

/* --- idempotence : rejouer la migration ne doit rien casser --------------- */
let replayError = null;
try { applyMigration(db, MIGRATION); } catch (e) { replayError = e; }
check('migration rejouee : aucune erreur', !replayError,
  replayError ? `(${replayError.message.slice(0, 120)})` : '');
const doublePrefix = db.prepare("SELECT COUNT(*) c FROM orders WHERE id LIKE 'ord_legacy_ord_legacy_%'").get().c;
check('migration rejouee : aucun prefixe double (idempotence reelle)', doublePrefix === 0, `(${doublePrefix})`);
const orphanAfterReplay = db.prepare(
  'SELECT COUNT(*) c FROM licenses l LEFT JOIN orders o ON o.id = l.order_id WHERE o.id IS NULL'
).get().c;
check('migration rejouee : aucune licence orpheline', orphanAfterReplay === 0, `(${orphanAfterReplay})`);
const countsAfterReplay = {
  orders: db.prepare('SELECT COUNT(*) c FROM orders').get().c,
  licenses: db.prepare('SELECT COUNT(*) c FROM licenses').get().c,
};
check('migration rejouee : comptes inchanges',
  countsAfterReplay.orders === before.orders && countsAfterReplay.licenses === before.licenses,
  `(orders ${countsAfterReplay.orders}, licences ${countsAfterReplay.licenses})`);

iso.close();

/* ===================================================================== */
console.log('');
console.log('=== APRES MIGRATION : le vrai Worker doit livrer ===');

/* On repart d'une base migree fraiche pour executer le Worker. */
const iso2 = createIsolatedDatabase({ foreignKeys: true });
applyProdSchema(iso2.db);
seedProdFixture(iso2.db, { now: FIXED_NOW });
applyMigration(iso2.db, MIGRATION);
iso2.db.exec('CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, event TEXT NOT NULL, page TEXT NOT NULL, lang TEXT NOT NULL, cta TEXT, mode TEXT, years INTEGER, step TEXT, ref TEXT, test INTEGER NOT NULL DEFAULT 0, ip_hash TEXT, ua TEXT, value_eur REAL, source TEXT)');
iso2.db.exec('CREATE TABLE IF NOT EXISTS rl (bucket TEXT NOT NULL, window INTEGER NOT NULL, count INTEGER NOT NULL, PRIMARY KEY (bucket, window))');

const tmpWorker = join(HERE, '.worker-under-test.mjs');
writeFileSync(tmpWorker, readFileSync(join(REPO, 'worker', 'index.js'), 'utf8'));
const workerMod = await import('file:///' + tmpWorker.replace(/\\/g, '/') + '?t=' + Date.now());

const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  /* AUCUN appel reseau reel : l'envoi d'e-mail est simule (la cle de test
     n'a pas de valeur, et aucun e-mail ne doit partir pendant un test). */
  if (u.startsWith('https://api.resend.com/')) {
    return new Response(JSON.stringify({ id: 'email_simule' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  if (u.startsWith('https://api.mollie.com/v2/')) {
    if (u.endsWith('/payments') && (opts.method || 'GET') === 'POST') {
      return new Response(JSON.stringify({ id: 'tr_AFTER01', _links: { checkout: { href: 'https://mollie.test/checkout' } } }),
        { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
    const m = u.match(/\/payments\/([^/?]+)$/);
    if (m) {
      return new Response(JSON.stringify({
        id: m[1], status: 'paid', amount: { value: '20.00', currency: 'EUR' },
        metadata: { email: 'client30@example.com', lang: 'fr', product: 'bot-wow-lifetime' },
      }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    }
    if (u.endsWith('/customers')) {
      return new Response(JSON.stringify({ id: 'cst_test' }), { status: 201, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  return realFetch(url, opts);
};

/* KV simule (la limitation de debit doit laisser passer les appels de test) */
const kvStore = new Map();
const env = {
  DB: iso2.d1,
  TELEMETRY_DB: iso2.d1,
  RATE_LIMIT: { get: async (k) => kvStore.get(k) ?? null, put: async (k, v) => { kvStore.set(k, v); } },
  R2_BINARIES: { put: async () => {}, list: async () => ({ objects: [] }), get: async () => null, delete: async () => {} },
  MOLLIE_API_KEY: 'test_key',
  ADMIN_JWT_SECRET: 'test_admin_secret',
  LICENSE_SECRET: 'test_license_secret',
  CONTACT_EMAIL: 'support@bot-wow.com',
  RESEND_API_KEY: 'test_resend_key',
};

async function call(path, { method = 'GET', body = null } = {}) {
  const req = new Request('https://api.bot-wow.com' + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  return workerMod.default.fetch(req, env, {});
}

/* --- Mollie 'paid' : la livraison doit REUSSIR ---------------------------- */
{
  const res = await call('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_AFTER01' } });
  check('post-migration : le webhook Mollie paye repond 200', res.status === 200, `(status=${res.status})`);
  const order = iso2.db.prepare('SELECT * FROM orders WHERE provider_id = ?').get('tr_AFTER01');
  check('post-migration : la commande est creee avec un id texte (ord_*)',
    !!order && order.id.startsWith('ord_'), `(${order && order.id})`);
  check('post-migration : la commande est payee', !!order && order.status === 'paid');
  const lic = order ? iso2.db.prepare('SELECT * FROM licenses WHERE order_id = ?').get(order.id) : null;
  check('post-migration : la licence reference la commande', !!lic && lic.order_id === order.id);
  check('post-migration : une seule licence pour ce paiement',
    order && iso2.db.prepare('SELECT COUNT(*) c FROM licenses WHERE order_id = ?').get(order.id).c === 1);
  const dl = lic ? iso2.db.prepare('SELECT COUNT(*) c FROM downloads WHERE license_id = ?').get(lic.id).c : 0;
  check('post-migration : un jeton de telechargement est cree', dl === 1, `(${dl})`);
  /* `deliveries` n'est renseignée qu'en cas d'echec d'envoi (rejeu possible).
     Si l'envoi reussit, il n'y a rien a rejouer : on le verifie explicitement. */
  const deliveriesOk = iso2.db.prepare('SELECT COUNT(*) c FROM deliveries').get().c;
  check('post-migration : envoi reussi -> aucune livraison en attente de rejeu',
    deliveriesOk === 0, `(${deliveriesOk})`);

  /* le rejeu ne doit PAS creer de seconde licence (idempotence preservee) */
  const res2 = await call('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_AFTER01' } });
  const total = iso2.db.prepare('SELECT COUNT(*) c FROM licenses WHERE order_id = ?').get(order.id).c;
  check('post-migration : le webhook rejoue ne cree pas de seconde licence', total === 1, `(${total})`);
  check('post-migration : le webhook rejoue repond 200', res2.status === 200, `(status=${res2.status})`);
}

/* --- echec d'envoi : la livraison doit etre consignee pour rejeu ---------- */
{
  const savedEnv = { ...env };
  env.RESEND_API_KEY = undefined; /* echec volontaire de l'envoi */
  const res = await call('/api/mollie-webhook', { method: 'POST', body: { id: 'tr_AFTER02' } });
  Object.assign(env, savedEnv);
  check('post-migration : webhook paye malgre un envoi en echec', res.status === 200, `(status=${res.status})`);
  const delivery = iso2.db.prepare("SELECT * FROM deliveries WHERE status = 'pending' ORDER BY id DESC LIMIT 1").get();
  check('post-migration : la livraison en echec est consignee dans deliveries',
    !!delivery && delivery.email === 'client30@example.com', `(${JSON.stringify(delivery || {}).slice(0, 90)})`);
  const lic = iso2.db.prepare("SELECT * FROM licenses l JOIN orders o ON o.id = l.order_id WHERE o.provider_id = 'tr_AFTER02'").get();
  check('post-migration : la licence est creee meme si l-e-mail echoue', !!lic,
    '(la licence ne doit JAMAIS dependre de l-envoi)');
}

/* --- Bitcoin : la creation de commande doit REUSSIR ----------------------- */
{
  const res = await call('/api/bitcoin/checkout', { method: 'POST', body: { email: 'client40@example.com', lang: 'fr' } });
  check('post-migration : le checkout Bitcoin repond 200', res.status === 200, `(status=${res.status})`);
  const data = res.status === 200 ? await res.json() : null;
  check('post-migration : la commande Bitcoin porte un id texte',
    !!data && data.orderId.startsWith('ord_bitcoin_manual_'), `(${data && data.orderId})`);
  const row = data ? iso2.db.prepare('SELECT * FROM orders WHERE id = ?').get(data.orderId) : null;
  check('post-migration : la commande Bitcoin est en attente de paiement',
    !!row && row.status === 'pending_payment' && row.provider_id === data.orderReference,
    `(${row && row.status})`);

  /* l'approbation administrative doit creer la licence sur cette commande */
  const approve = await call(`/api/admin/orders/${data.orderId}/approve`, { method: 'POST' });
  check('post-migration : approbation admin refusee sans authentification (401)',
    approve.status === 401, `(status=${approve.status})`);
}

/* --- les 14 commandes et 5 licences historiques restent exploitables ------ */
{
  const hist = iso2.db.prepare(
    "SELECT COUNT(*) c FROM orders o JOIN licenses l ON l.order_id = o.id WHERE o.id LIKE 'ord_legacy_%'"
  ).get().c;
  check('post-migration : les licences historiques restent jointes a leur commande',
    hist === 5, `(${hist} jointures ord_legacy_*)`);
  const legacy = iso2.db.prepare("SELECT COUNT(*) c FROM orders WHERE id LIKE 'ord_legacy_%'").get().c;
  check('post-migration : les 14 commandes historiques sont toujours la', legacy === 14, `(${legacy})`);
  /* les commandes creees pendant ce test s'ajoutent, sans rien ecraser :
     14 historiques + 2 paiements Mollie simules + 1 commande Bitcoin */
  const total = iso2.db.prepare('SELECT COUNT(*) c FROM orders').get().c;
  check('post-migration : les 3 commandes de test s-ajoutent aux 14 historiques',
    total === 17, `(${total})`);
}

/* --- cloture -------------------------------------------------------------- */
globalThis.fetch = realFetch;
try { rmSync(tmpWorker, { force: true }); } catch { /* deja supprime */ }
iso2.close();

console.log('');
console.log(failures === 0 ? 'MIGRATION 0004 : OK' : `MIGRATION 0004 : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
