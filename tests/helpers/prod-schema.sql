-- Schéma D1 de PRODUCTION observé (audit 2026-10-21 / reconfirmé 2026-10-23).
--
-- CE FICHIER N'EST PAS UNE MIGRATION À APPLIQUER EN PRODUCTION.
-- Il reproduit le schéma réel de la base `botwow-production` afin que les
-- tests puissent prouver, sur un vrai moteur SQL, l'incompatibilité entre :
--   * `orders.id`          INTEGER PRIMARY KEY  (alias de rowid)
--   * `licenses.order_id`  INTEGER REFERENCES orders(id)
-- et le code du Worker, qui insère des identifiants TEXTE
-- (`ord_tr_...`, `ord_bitcoin_manual_BTC-...`) dans ces deux colonnes.
--
-- Différence avec `migrations/0002_botwow_licenses.sql` : ce dernier déclare
-- `orders.id TEXT PRIMARY KEY` et `licenses.order_id TEXT REFERENCES
-- orders(id)`. Comme il utilise `CREATE TABLE IF NOT EXISTS`, il NE convertit
-- pas les tables déjà présentes en production : le schéma reste INTEGER et
-- le Worker échoue à chaque livraison.

CREATE TABLE orders (
  id           INTEGER PRIMARY KEY,            -- alias de rowid : 1..N
  provider     TEXT NOT NULL DEFAULT 'mollie',
  provider_id  TEXT UNIQUE,
  email        TEXT NOT NULL,
  amount       INTEGER NOT NULL DEFAULT 0,
  currency     TEXT NOT NULL DEFAULT 'eur',
  status       TEXT NOT NULL DEFAULT 'free',
  metadata     TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

-- Live production has no licenses.token or licenses.expires_at; the
-- download token/expiration are stored in downloads.
CREATE TABLE licenses (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  key             TEXT NOT NULL UNIQUE,
  order_id        INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  lang            TEXT NOT NULL DEFAULT 'fr',
  status          TEXT NOT NULL DEFAULT 'active',
  max_activations INTEGER NOT NULL DEFAULT 2,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE TABLE activations (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  license_id   INTEGER NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  machine_id   TEXT NOT NULL,
  ip           TEXT,
  user_agent   TEXT,
  activated_at INTEGER NOT NULL,
  last_seen_at INTEGER
);

-- UNIQUE index present en production (cree a la main, hors migration) : c'est
-- lui qui assure l'idempotence des activations machine/licence.
CREATE UNIQUE INDEX idx_activations_license_machine
  ON activations(license_id, machine_id);
CREATE INDEX idx_activations_last_seen ON activations(last_seen_at);
CREATE INDEX idx_activations_license_id ON activations(license_id);

CREATE TABLE downloads (
  token       TEXT PRIMARY KEY,
  license_id  INTEGER NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,
  count       INTEGER NOT NULL DEFAULT 0,
  max_count   INTEGER NOT NULL DEFAULT 10,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_downloads_license ON downloads(license_id);
CREATE INDEX idx_downloads_license_id ON downloads(license_id);
CREATE INDEX idx_downloads_expires_at ON downloads(expires_at);

CREATE TABLE webhook_events (
  id           TEXT PRIMARY KEY,
  provider     TEXT NOT NULL,
  processed_at INTEGER NOT NULL
);

CREATE TABLE mollie_customers (
  id         TEXT PRIMARY KEY,
  email      TEXT UNIQUE NOT NULL,
  locale     TEXT DEFAULT 'fr',
  metadata   TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

-- These tables already exist in the currently observed production database.
-- Their live schemas are intentionally represented here, including the
-- historical rate_limit shape (id, bucket, ts), not the alternative schema
-- a later CREATE TABLE IF NOT EXISTS might declare for a fresh database.
CREATE TABLE admin_sessions (
  id         TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  ip         TEXT,
  user_agent TEXT
);

CREATE TABLE deliveries (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT NOT NULL,
  subject    TEXT,
  body       TEXT,
  kind       TEXT NOT NULL DEFAULT 'delivery',
  status     TEXT NOT NULL DEFAULT 'pending',
  error      TEXT,
  created_at INTEGER NOT NULL,
  sent_at    INTEGER
);

CREATE TABLE rate_limit (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  bucket  TEXT NOT NULL,
  ts      INTEGER NOT NULL
);

CREATE TABLE botwow_emails (
  id                    INTEGER PRIMARY KEY AUTOINCREMENT,
  email                 TEXT NOT NULL UNIQUE,
  source                TEXT NOT NULL DEFAULT 'newsletter',
  consent_marketing     INTEGER NOT NULL DEFAULT 0,
  consent_transactional INTEGER NOT NULL DEFAULT 0,
  subscribed_at         INTEGER NOT NULL,
  unsubscribed_at       INTEGER,
  status                TEXT NOT NULL DEFAULT 'subscribed',
  ip                    TEXT,
  user_agent            TEXT,
  confirm_token         TEXT,
  unsubscribe_token     TEXT,
  confirmed_at          INTEGER
);

-- This fixture mirrors the live D1 schema observed on 2026-10-23,
-- including tables that migration 0004 must leave intact when they already
-- exist. The migration uses CREATE TABLE IF NOT EXISTS for fresh databases.
