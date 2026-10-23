-- Migration 0004: convert order identifiers to TEXT and reconcile live D1.
--
-- IMPORTANT: production has cascading foreign keys:
--   licenses.order_id -> orders.id ON DELETE CASCADE
--   activations.license_id -> licenses.id ON DELETE CASCADE
--   downloads.license_id -> licenses.id ON DELETE CASCADE
-- Dropping a parent table before preserving AND removing every dependent table
-- can delete license/activation/download rows. Snapshot all dependent data to
-- tables without foreign keys, remove children first, then rebuild parents and
-- restore every row with its original primary key.
--
-- D1 applies each migration transactionally. Do not toggle PRAGMA foreign_keys
-- inside that implicit transaction; defer checks until all tables are rebuilt.
PRAGMA defer_foreign_keys = ON;

-- 1. Snapshot every dependent row before any destructive DDL.
CREATE TABLE licenses_preserved (
  id              INTEGER PRIMARY KEY,
  key             TEXT NOT NULL UNIQUE,
  order_id        TEXT NOT NULL,
  email           TEXT NOT NULL,
  lang            TEXT NOT NULL DEFAULT 'fr',
  status          TEXT NOT NULL DEFAULT 'active',
  max_activations INTEGER NOT NULL DEFAULT 2,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

INSERT INTO licenses_preserved
  (id, key, order_id, email, lang, status, max_activations, created_at, updated_at)
SELECT
  id, key,
  CASE
    WHEN CAST(order_id AS TEXT) GLOB '[0-9]*' THEN 'ord_legacy_' || CAST(order_id AS TEXT)
    ELSE CAST(order_id AS TEXT)
  END,
  email, lang, status, max_activations, created_at, updated_at
FROM licenses;

CREATE TABLE activations_preserved (
  id            INTEGER PRIMARY KEY,
  license_id    INTEGER NOT NULL,
  machine_id    TEXT NOT NULL,
  ip            TEXT,
  user_agent    TEXT,
  activated_at  INTEGER NOT NULL,
  last_seen_at  INTEGER
);

INSERT INTO activations_preserved
  (id, license_id, machine_id, ip, user_agent, activated_at, last_seen_at)
SELECT id, license_id, machine_id, ip, user_agent, activated_at, last_seen_at
FROM activations;

CREATE TABLE downloads_preserved (
  token       TEXT PRIMARY KEY,
  license_id  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  count       INTEGER NOT NULL DEFAULT 0,
  max_count   INTEGER NOT NULL DEFAULT 10,
  created_at  INTEGER NOT NULL
);

INSERT INTO downloads_preserved
  (token, license_id, expires_at, count, max_count, created_at)
SELECT token, license_id, expires_at, count, max_count, created_at
FROM downloads;

-- 2. Build the replacement orders table while the original is still readable.
-- Preserve provider uniqueness and all business columns.
CREATE TABLE orders_reconciled (
  id           TEXT PRIMARY KEY,
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

INSERT INTO orders_reconciled
  (id, provider, provider_id, email, amount, currency, status, metadata, created_at, updated_at)
SELECT
  CASE
    WHEN CAST(id AS TEXT) GLOB '[0-9]*' THEN 'ord_legacy_' || CAST(id AS TEXT)
    ELSE CAST(id AS TEXT)
  END,
  provider, provider_id, email, amount, currency, status, metadata, created_at, updated_at
FROM orders;

-- These production views reference the tables being rebuilt. Drop them before
-- DDL so the API's schema validator never observes a temporarily missing table;
-- they are recreated with the same definitions after all tables are restored.
DROP VIEW IF EXISTS v_admin_orders;
DROP VIEW IF EXISTS v_active_licenses;

-- Drop child tables before their parents to prevent ON DELETE CASCADE data loss.
DROP TABLE downloads;
DROP TABLE activations;
DROP TABLE licenses;
DROP TABLE orders;
ALTER TABLE orders_reconciled RENAME TO orders;

CREATE INDEX IF NOT EXISTS idx_orders_provider ON orders(provider, provider_id);
CREATE INDEX IF NOT EXISTS idx_orders_provider_id ON orders(provider_id);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON orders(created_at);

-- 3. Restore licenses with TEXT order references; preserve license IDs and keys.
CREATE TABLE licenses (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  key             TEXT NOT NULL UNIQUE,
  order_id        TEXT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,
  lang            TEXT NOT NULL DEFAULT 'fr',
  status          TEXT NOT NULL DEFAULT 'active',
  max_activations INTEGER NOT NULL DEFAULT 2,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

INSERT INTO licenses
  (id, key, order_id, email, lang, status, max_activations, created_at, updated_at)
SELECT id, key, order_id, email, lang, status, max_activations, created_at, updated_at
FROM licenses_preserved;

DROP TABLE licenses_preserved;

CREATE INDEX IF NOT EXISTS idx_licenses_email ON licenses(email);
CREATE INDEX IF NOT EXISTS idx_licenses_key ON licenses(key);
CREATE INDEX IF NOT EXISTS idx_licenses_order ON licenses(order_id);
CREATE INDEX IF NOT EXISTS idx_licenses_order_id ON licenses(order_id);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);

-- 4. Restore activations with original IDs and cascading license relation.
CREATE TABLE activations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  license_id    INTEGER NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  machine_id    TEXT NOT NULL,
  ip            TEXT,
  user_agent    TEXT,
  activated_at  INTEGER NOT NULL,
  last_seen_at  INTEGER
);

INSERT INTO activations
  (id, license_id, machine_id, ip, user_agent, activated_at, last_seen_at)
SELECT id, license_id, machine_id, ip, user_agent, activated_at, last_seen_at
FROM activations_preserved;

DROP TABLE activations_preserved;

CREATE INDEX IF NOT EXISTS idx_activations_last_seen ON activations(last_seen_at);
CREATE INDEX IF NOT EXISTS idx_activations_license_id ON activations(license_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_activations_license_machine
  ON activations(license_id, machine_id);

-- 5. Restore download tokens before transaction commit and relink to licenses.
CREATE TABLE downloads (
  token       TEXT PRIMARY KEY,
  license_id  INTEGER NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,
  count       INTEGER NOT NULL DEFAULT 0,
  max_count   INTEGER NOT NULL DEFAULT 10,
  created_at  INTEGER NOT NULL
);

INSERT INTO downloads
  (token, license_id, expires_at, count, max_count, created_at)
SELECT token, license_id, expires_at, count, max_count, created_at
FROM downloads_preserved;

DROP TABLE downloads_preserved;

CREATE INDEX IF NOT EXISTS idx_downloads_license ON downloads(license_id);
CREATE INDEX IF NOT EXISTS idx_downloads_license_id ON downloads(license_id);
CREATE INDEX IF NOT EXISTS idx_downloads_expires_at ON downloads(expires_at);

-- 6. Support tables are already present in live production. IF NOT EXISTS adds
-- them on a clean database and leaves existing live versions intact.
CREATE TABLE IF NOT EXISTS deliveries (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT NOT NULL,
  subject     TEXT,
  body        TEXT,
  kind        TEXT NOT NULL DEFAULT 'delivery',
  status      TEXT NOT NULL DEFAULT 'pending',
  error       TEXT,
  created_at  INTEGER NOT NULL,
  sent_at     INTEGER
);
CREATE INDEX IF NOT EXISTS idx_deliveries_status ON deliveries(status, created_at);

CREATE TABLE IF NOT EXISTS rate_limit (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  bucket  TEXT NOT NULL,
  ts      INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rate_limit_bucket_ts ON rate_limit(bucket, ts);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id          TEXT PRIMARY KEY,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  ip          TEXT,
  user_agent  TEXT
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_expires ON admin_sessions(expires_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_id ON webhook_events(id);

-- 7. Restore the two production administration views that reference the
-- rebuilt tables. IF NOT EXISTS also allows this migration on fresh databases.
CREATE VIEW IF NOT EXISTS v_admin_orders AS
SELECT
  o.id,
  o.provider,
  o.provider_id,
  o.email,
  o.amount,
  o.currency,
  o.status,
  o.created_at,
  l.key AS license_key,
  l.lang AS license_lang,
  l.status AS license_status,
  l.max_activations,
  (SELECT COUNT(*) FROM activations a WHERE a.license_id = l.id) AS activation_count,
  (SELECT COUNT(*) FROM downloads d WHERE d.license_id = l.id) AS download_count,
  (SELECT MAX(d.count) FROM downloads d WHERE d.license_id = l.id) AS max_downloads_used
FROM orders o
LEFT JOIN licenses l ON l.order_id = o.id
ORDER BY o.created_at DESC;

CREATE VIEW IF NOT EXISTS v_active_licenses AS
SELECT
  l.id,
  l.key,
  l.email,
  l.lang,
  l.max_activations,
  l.created_at,
  (SELECT COUNT(*) FROM activations a WHERE a.license_id = l.id) AS activations_used,
  (SELECT COUNT(*) FROM downloads d WHERE d.license_id = l.id) AS download_links,
  (SELECT SUM(d.count) FROM downloads d WHERE d.license_id = l.id) AS total_downloads
FROM licenses l
WHERE l.status = 'active'
ORDER BY l.created_at DESC;

-- Reset deferred-check mode before D1 commits this migration batch.
PRAGMA defer_foreign_keys = OFF;
