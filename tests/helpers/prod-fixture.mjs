/**
 * prod-fixture.mjs — jeu de données synthétiques reproduisant la base
 * `botwow-production` telle qu'elle est **réellement** aujourd'hui.
 *
 * SCHEMA : appliquer par les MIGRATIONS RÉELLES du dépôt
 * (`migrations/production/0001…0004_reconcile_order_ids.sql`), dans l'ordre.
 * La migration `0004` a déjà été appliquée en production : `orders.id` et
 * `webhook_events.id` sont donc `TEXT PRIMARY KEY`, et `licenses.order_id`
 * est `TEXT REFERENCES orders(id)`. C'est le schéma OBSERVÉ, pas un schéma
 * supposé — l'appliquer depuis les fichiers de migration garantit que le
 * fixture ne peut pas diverger du vrai schéma.
 *
 * Jusqu'au 2026-11-08, ce fichier reproduisait l'ANCIEN schéma INTEGER
 * (`orders.id INTEGER`, alias de rowid) et le test de régression en tirait
 * des échecs « attendus », ce qui rendait la CI verte sans rien prouver.
 *
 * DONNÉES : 14 commandes, 5 licences, 11 e-mails, 5 événements de webhook,
 * 0 activation, 0 livraison en attente — aucune donnée réelle : adresses en
 * `@example.com`, aucun identifiant Mollie ou Bitcoin authentique, aucune clé
 * de licence exploitable.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS = join(HERE, '..', '..', 'migrations', 'production');

/** Migrations de production, dans l'ordre numérique. */
export function migrationFiles() {
  return readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort();
}

/**
 * Applique le schéma de production RÉEL : les migrations du dépôt, dans
 * l'ordre, y compris `0004_reconcile_order_ids.sql` qui fait passer les
 * identifiants de commande en TEXT.
 */
export function applyProdSchema(db) {
  for (const f of migrationFiles()) {
    db.exec(readFileSync(join(MIGRATIONS, f), 'utf8'));
  }
}

/**
 * Applique UNIQUEMENT les migrations AVANT `0004`, c'est-à-dire l'état
 * historique de la base : `orders.id INTEGER` (alias de rowid).
 *
 * Sert exclusivement à `tests/d1-order-id-migration.test.mjs`, qui doit
 * prouver l'effet de `0004` — donc partir de l'état d'avant. La production
 * a déjà appliqué `0004` : cet état n'existe plus en vrai.
 */
export function applyProdSchemaPreMigration(db) {
  for (const f of migrationFiles()) {
    if (f.startsWith('0004_')) break;
    db.exec(readFileSync(join(MIGRATIONS, f), 'utf8'));
  }
}

/** Identifiants de commande : TEXTE, comme les insère le Worker. */
function orderRows(t) {
  return [
    ['ord_tr_SYN01', 'mollie', 'tr_SYN01', 'client1@example.com', 2000, 'eur', 'paid', t(20)],
    ['ord_tr_SYN02', 'mollie', 'tr_SYN02', 'client2@example.com', 2000, 'eur', 'paid', t(18)],
    ['ord_tr_SYN03', 'mollie', 'tr_SYN03', 'client3@example.com', 2000, 'eur', 'paid', t(15)],
    ['ord_tr_SYN04', 'mollie', 'tr_SYN04', 'client4@example.com', 2000, 'eur', 'failed', t(12)],
    ['ord_bitcoin_manual_BTC-AAAA1111', 'bitcoin_manual', 'BTC-AAAA1111', 'client5@example.com', 2000, 'eur', 'pending_payment', t(9)],
    ['ord_tr_SYN06', 'mollie', 'tr_SYN06', 'client6@example.com', 2000, 'eur', 'paid', t(8)],
    ['ord_tr_SYN07', 'mollie', 'tr_SYN07', 'client7@example.com', 2000, 'eur', 'canceled', t(7)],
    ['ord_tr_SYN08', 'mollie', 'tr_SYN08', 'client8@example.com', 2000, 'eur', 'paid', t(6)],
    ['ord_bitcoin_manual_BTC-BBBB2222', 'bitcoin_manual', 'BTC-BBBB2222', 'client9@example.com', 2000, 'eur', 'paid', t(5)],
    ['ord_free_SYN10', 'free', 'free_ab12cd', 'client10@example.com', 0, 'eur', 'free', t(4)],
    ['ord_tr_SYN11', 'mollie', 'tr_SYN11', 'client11@example.com', 2000, 'eur', 'expired', t(3)],
    ['ord_tr_SYN12', 'mollie', 'tr_SYN12', 'client12@example.com', 2000, 'eur', 'paid', t(2)],
    ['ord_bitcoin_manual_BTC-CCCC3333', 'bitcoin_manual', 'BTC-CCCC3333', 'client13@example.com', 2000, 'eur', 'pending_payment', t(1)],
    ['ord_tr_SYN14', 'mollie', 'tr_SYN14', 'client14@example.com', 2000, 'eur', 'paid', t(0)],
  ];
}

/** Licences synthétiques : `order_id` pointe sur les identifiants TEXTE. */
function licenseRows(t) {
  return [
    [1, 'BOTWOW-AAAAA-BBBBB-CCCCC-DDDDD-EEEEE', 'ord_tr_SYN01', 'client1@example.com', 'fr', 'active', 2, t(20)],
    [2, 'BOTWOW-FFFFF-GGGGG-HHHHH-IIIII-JJJJJ', 'ord_tr_SYN03', 'client3@example.com', 'en', 'active', 2, t(15)],
    [3, 'BOTWOW-KKKKK-LLLLL-MMMMM-NNNNN-OOOOO', 'ord_tr_SYN06', 'client6@example.com', 'fr', 'active', 2, t(8)],
    [4, 'BOTWOW-PPPPP-QQQQQ-RRRRR-SSSSS-TTTTT', 'ord_tr_SYN08', 'client8@example.com', 'en', 'active', 2, t(6)],
    // commande Bitcoin livrée manuellement par l'administration
    [5, 'BOTWOW-UUUUU-VVVVV-WWWWW-XXXXX-YYYYY', 'ord_bitcoin_manual_BTC-BBBB2222', 'client9@example.com', 'fr', 'active', 2, t(5)],
  ];
}

/**
 * Variante HISTORIQUE du jeu de donnees : identifiants de commande de FORME
 * NUMERIQUE (`'1'`...`'14'`), tels que la migration `0004` les convertit en
 * `ord_legacy_<valeur>`.
 *
 * POURQUOI DES CHAINES ET PAS DES ENTIERS : le DDL porte `orders.id TEXT
 * PRIMARY KEY` depuis la migration `0002`, et l'affinite TEXT de SQLite
 * convertit tout entier insere en texte. Un identifiant « numerique » est
 * donc stocke sous forme de texte. C'est precisement ce que detecte la
 * branche `CAST(id AS TEXT) GLOB '[0-9]*'` de `0004`. Serv UNIQUEMENT a
 * `tests/d1-order-id-migration.test.mjs`. Aucune donnee reelle.
 */
function legacyOrderRows(t) {
  return [['1', 'mollie', 'tr_SYN01', 'client1@example.com', 2000, 'eur', 'paid', t(20)],
    ['2', 'mollie', 'tr_SYN02', 'client2@example.com', 2000, 'eur', 'paid', t(18)],
    ['3', 'mollie', 'tr_SYN03', 'client3@example.com', 2000, 'eur', 'paid', t(15)],
    ['4', 'mollie', 'tr_SYN04', 'client4@example.com', 2000, 'eur', 'failed', t(12)],
    ['5', 'bitcoin_manual', 'BTC-AAAA1111', 'client5@example.com', 2000, 'eur', 'pending_payment', t(9)],
    ['6', 'mollie', 'tr_SYN06', 'client6@example.com', 2000, 'eur', 'paid', t(8)],
    ['7', 'mollie', 'tr_SYN07', 'client7@example.com', 2000, 'eur', 'canceled', t(7)],
    ['8', 'mollie', 'tr_SYN08', 'client8@example.com', 2000, 'eur', 'paid', t(6)],
    ['9', 'bitcoin_manual', 'BTC-BBBB2222', 'client9@example.com', 2000, 'eur', 'paid', t(5)],
    ['10', 'free', 'free_ab12cd', 'client10@example.com', 0, 'eur', 'free', t(4)],
    ['11', 'mollie', 'tr_SYN11', 'client11@example.com', 2000, 'eur', 'expired', t(3)],
    ['12', 'mollie', 'tr_SYN12', 'client12@example.com', 2000, 'eur', 'paid', t(2)],
    ['13', 'bitcoin_manual', 'BTC-CCCC3333', 'client13@example.com', 2000, 'eur', 'pending_payment', t(1)],
    ['14', 'mollie', 'tr_SYN14', 'client14@example.com', 2000, 'eur', 'paid', t(0)]];
}

function legacyLicenseRows(t) {
  return [
    [1, 'BOTWOW-AAAAA-BBBBB-CCCCC-DDDDD-EEEEE', '1', 'client1@example.com', 'fr', 'active', 2, t(20)],
    [2, 'BOTWOW-FFFFF-GGGGG-HHHHH-IIIII-JJJJJ', '3', 'client3@example.com', 'en', 'active', 2, t(15)],
    [3, 'BOTWOW-KKKKK-LLLLL-MMMMM-NNNNN-OOOOO', '6', 'client6@example.com', 'fr', 'active', 2, t(8)],
    [4, 'BOTWOW-PPPPP-QQQQQ-RRRRR-SSSSS-TTTTT', '8', 'client8@example.com', 'en', 'active', 2, t(6)],
    [5, 'BOTWOW-UUUUU-VVVVV-WWWWW-XXXXX-YYYYY', '9', 'client9@example.com', 'fr', 'active', 2, t(5)],
  ];
}

function emailRows(t) {
  return [
    [1, 'client1@example.com', 'newsletter', t(20)],
    [2, 'client2@example.com', 'newsletter', t(19)],
    [3, 'client3@example.com', 'hero-waitlist', t(18)],
    [4, 'client4@example.com', 'newsletter', t(16)],
    [5, 'client5@example.com', 'newsletter', t(14)],
    [6, 'client6@example.com', 'newsletter', t(13)],
    [7, 'client7@example.com', 'hero-waitlist', t(11)],
    [8, 'client8@example.com', 'newsletter', t(10)],
    [9, 'client9@example.com', 'newsletter', t(6)],
    [10, 'client10@example.com', 'newsletter', t(4)],
    [11, 'client11@example.com', 'hero-waitlist', t(2)],
  ];
}

function eventRows(t) {
  return [
    ['payment:tr_SYN01', 'mollie', t(20)],
    ['payment:tr_SYN02', 'mollie', t(18)],
    ['payment:tr_SYN03', 'mollie', t(15)],
    ['payment:tr_SYN04', 'mollie', t(12)],
    ['payment:tr_SYN08', 'mollie', t(6)],
  ];
}

/** Insère les données synthétiques dans une base déjà pourvue du schéma. */
export function seedProdFixture(db, { now = Date.now() } = {}) {
  const day = 864e5;
  const t = (n) => now - n * day;

  const insOrder = db.prepare(
    'INSERT INTO orders (id, provider, provider_id, email, amount, currency, status, metadata, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
  );
  for (const r of orderRows(t)) {
    insOrder.run(r[0], r[1], r[2], r[3], r[4], r[5], r[6], JSON.stringify({ product: 'bot-wow-lifetime', synthetic: true }), r[7], r[7]);
  }

  const insLicense = db.prepare(
    'INSERT INTO licenses (id, key, order_id, email, lang, status, max_activations, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)'
  );
  for (const r of licenseRows(t)) {
    insLicense.run(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[7]);
  }

  // Jetons de téléchargement, liés aux licences par identifiant entier.
  const insDownload = db.prepare(
    'INSERT INTO downloads (token, license_id, expires_at, count, max_count, created_at) VALUES (?,?,?,?,?,?)'
  );
  for (const [licenseId, ageDays] of [[1, 20], [2, 18], [3, 15], [4, 8], [5, 5]]) {
    insDownload.run(`dl_syn${licenseId}`, licenseId, t(0) + 30 * 864e5, 0, 10, t(ageDays));
  }

  const insEmail = db.prepare(
    'INSERT INTO botwow_emails (id, email, source, consent_marketing, consent_transactional, subscribed_at, status) VALUES (?,?,?,?,?,?,?)'
  );
  for (const r of emailRows(t)) {
    insEmail.run(r[0], r[1], r[2], 0, 1, r[3], 'subscribed');
  }

  const insEvent = db.prepare('INSERT INTO webhook_events (id, provider, processed_at) VALUES (?,?,?)');
  for (const r of eventRows(t)) {
    insEvent.run(r[0], r[1], r[2]);
  }
}

/**
 * Variante HISTORIQUE du seed : commandes et licences porteuses
 * d'identifiants ENTIERS, c'est-à-dire l'état d'avant `0004`. Sert UNIQUEMENT
 * à `tests/d1-order-id-migration.test.mjs`.
 */
export function seedLegacyFixture(db, { now = Date.now() } = {}) {
  const day = 864e5;
  const t = (n) => now - n * day;

  const insOrder = db.prepare(
    'INSERT INTO orders (id, provider, provider_id, email, amount, currency, status, metadata, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?)'
  );
  for (const r of legacyOrderRows(t)) {
    insOrder.run(r[0], r[1], r[2], r[3], r[4], r[5], r[6], JSON.stringify({ product: 'bot-wow-lifetime', synthetic: true }), r[7], r[7]);
  }

  const insLicense = db.prepare(
    'INSERT INTO licenses (id, key, order_id, email, lang, status, max_activations, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?)'
  );
  for (const r of legacyLicenseRows(t)) {
    insLicense.run(r[0], r[1], r[2], r[3], r[4], r[5], r[6], r[7], r[7]);
  }

  const insDownload = db.prepare(
    'INSERT INTO downloads (token, license_id, expires_at, count, max_count, created_at) VALUES (?,?,?,?,?,?)'
  );
  for (const [licenseId, ageDays] of [[1, 20], [2, 18], [3, 15], [4, 8], [5, 5]]) {
    insDownload.run(`dl_syn${licenseId}`, licenseId, t(0) + 30 * 864e5, 0, 10, t(ageDays));
  }

  const insEmail = db.prepare(
    'INSERT INTO botwow_emails (id, email, source, consent_marketing, consent_transactional, subscribed_at, status) VALUES (?,?,?,?,?,?,?)'
  );
  for (const r of emailRows(t)) {
    insEmail.run(r[0], r[1], r[2], 0, 1, r[3], 'subscribed');
  }

  const insEvent = db.prepare('INSERT INTO webhook_events (id, provider, processed_at) VALUES (?,?,?)');
  for (const r of eventRows(t)) {
    insEvent.run(r[0], r[1], r[2]);
  }
}
