/**
 * prod-fixture.mjs — jeu de données synthétiques reproduisant la base
 * `botwow-production` (bilan d'audit du 2026-10-23, confirmé) :
 *
 *   orders          : 14 commandes (identifiants ENTIERS 1..14)
 *   licenses        : 5 licences
 *   botwow_emails   : 11 inscriptions
 *   webhook_events  : 5 événements déjà traités
 *   activations     : 0
 *   deliveries      : 0
 *
 * Mélange repris de la production : paiements Mollie payés, quelques échecs,
 * une commande Bitcoin en attente de validation, et une licence ancienne dont
 * `order_id` pointe encore sur le rowid numérique.
 *
 * AUCUNE donnée réelle : e-mails en @example.com, aucun identifiant Mollie ou
 * Bitcoin authentique, aucune clé de licence exploitable.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

export function applyProdSchema(db) {
  db.exec(readFileSync(join(HERE, 'prod-schema.sql'), 'utf8'));
}

/** Ordres synthétiques. ids ENTIERS (1..14) — coeur du problème. */
function orderRows(t) {
  return [
    [1, 'mollie', 'tr_SYN01', 'client1@example.com', 2000, 'eur', 'paid', t(20)],
    [2, 'mollie', 'tr_SYN02', 'client2@example.com', 2000, 'eur', 'paid', t(18)],
    [3, 'mollie', 'tr_SYN03', 'client3@example.com', 2000, 'eur', 'paid', t(15)],
    [4, 'mollie', 'tr_SYN04', 'client4@example.com', 2000, 'eur', 'failed', t(12)],
    [5, 'bitcoin_manual', 'BTC-AAAA1111', 'client5@example.com', 2000, 'eur', 'pending_payment', t(9)],
    [6, 'mollie', 'tr_SYN06', 'client6@example.com', 2000, 'eur', 'paid', t(8)],
    [7, 'mollie', 'tr_SYN07', 'client7@example.com', 2000, 'eur', 'canceled', t(7)],
    [8, 'mollie', 'tr_SYN08', 'client8@example.com', 2000, 'eur', 'paid', t(6)],
    [9, 'bitcoin_manual', 'BTC-BBBB2222', 'client9@example.com', 2000, 'eur', 'paid', t(5)],
    [10, 'free', 'free_ab12cd', 'client10@example.com', 0, 'eur', 'free', t(4)],
    [11, 'mollie', 'tr_SYN11', 'client11@example.com', 2000, 'eur', 'expired', t(3)],
    [12, 'mollie', 'tr_SYN12', 'client12@example.com', 2000, 'eur', 'paid', t(2)],
    [13, 'bitcoin_manual', 'BTC-CCCC3333', 'client13@example.com', 2000, 'eur', 'pending_payment', t(1)],
    [14, 'mollie', 'tr_SYN14', 'client14@example.com', 2000, 'eur', 'paid', t(0)],
  ];
}

/** Licences synthétiques : 5 lignes pointant sur des order_id ENTIERS. */
function licenseRows(t) {
  // Tokens and expiry belong to downloads in the live production schema.
  return [
    [1, 'BOTWOW-AAAAA-BBBBB-CCCCC-DDDDD-EEEEE', 1, 'client1@example.com', 'fr', 'active', 2, t(20)],
    [2, 'BOTWOW-FFFFF-GGGGG-HHHHH-IIIII-JJJJJ', 3, 'client3@example.com', 'en', 'active', 2, t(15)],
    [3, 'BOTWOW-KKKKK-LLLLL-MMMMM-NNNNN-OOOOO', 6, 'client6@example.com', 'fr', 'active', 2, t(8)],
    [4, 'BOTWOW-PPPPP-QQQQQ-RRRRR-SSSSS-TTTTT', 8, 'client8@example.com', 'en', 'active', 2, t(6)],
    // commande Bitcoin (id 9) livrée manuellement par l'administration
    [5, 'BOTWOW-UUUUU-VVVVV-WWWWW-XXXXX-YYYYY', 9, 'client9@example.com', 'fr', 'active', 2, t(5)],
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
