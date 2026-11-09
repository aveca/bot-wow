-- SCHEMA DE PRODUCTION REEL (snapshot)
--
-- Ce fichier est un INSTANTANE du schema produit par les migrations reelles du
-- depot, appliquees dans l ordre :
--   migrations/production/0001_botwow_emails.sql
--   migrations/production/0002_botwow_licenses.sql
--   migrations/production/0003_botwow_payment_integrity.sql
--   migrations/production/0004_reconcile_order_ids.sql
--
-- Il est genere depuis sqlite_master APRES application de ces quatre migrations.
-- Il ne sert PAS a construire la base des tests : tests/helpers/prod-fixture.mjs
-- applique directement les migrations, afin que le fixture ne puisse jamais
-- diverger du vrai schema. Ce snapshot n a donc qu un role documentaire ET de
-- garde-fou : tests/d1-order-id-regression.test.mjs verifie qu il est identique
-- au schema issu des migrations.
--
-- POINT CLE (migration 0004, deja appliquee en production) :
--   orders.id          TEXT PRIMARY KEY
--   licenses.order_id  TEXT NOT NULL REFERENCES orders(id)
--   webhook_events.id  TEXT PRIMARY KEY
-- Le Worker insere des identifiants de commande TEXTE (ord_tr_...,
-- ord_bitcoin_manual_...) : c est desormais le schema attendu, pas un conflit.
--
-- Jusqu au 2026-11-08, ce fichier decrivait l ANCIEN schema INTEGER, et le test
-- de regression en tirait des echecs "attendus" : la CI etait verte sans rien prouver.
--
-- Genere le 2026-11-09.
CREATE TABLE activations (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  license_id    INTEGER NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  machine_id    TEXT NOT NULL,
  ip            TEXT,
  user_agent    TEXT,
  activated_at  INTEGER NOT NULL,
  last_seen_at  INTEGER
);
CREATE TABLE admin_sessions (
  id          TEXT PRIMARY KEY,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL,
  ip          TEXT,
  user_agent  TEXT
);
CREATE TABLE botwow_emails (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  source TEXT NOT NULL DEFAULT 'newsletter',
  consent_marketing INTEGER NOT NULL DEFAULT 0,
  consent_transactional INTEGER NOT NULL DEFAULT 0,
  subscribed_at INTEGER NOT NULL,
  unsubscribed_at INTEGER,
  status TEXT NOT NULL DEFAULT 'subscribed',
  ip TEXT,
  user_agent TEXT
);
CREATE TABLE deliveries (
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
CREATE TABLE downloads (
  token       TEXT PRIMARY KEY,
  license_id  INTEGER NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
  expires_at  INTEGER NOT NULL,
  count       INTEGER NOT NULL DEFAULT 0,
  max_count   INTEGER NOT NULL DEFAULT 10,
  created_at  INTEGER NOT NULL
);
CREATE INDEX idx_activations_last_seen ON activations(last_seen_at);
CREATE INDEX idx_activations_license_id ON activations(license_id);
CREATE UNIQUE INDEX idx_activations_license_machine
  ON activations(license_id, machine_id);
CREATE INDEX idx_admin_sessions_expires ON admin_sessions(expires_at);
CREATE INDEX idx_botwow_emails_email ON botwow_emails(email);
CREATE INDEX idx_botwow_emails_status ON botwow_emails(status);
CREATE INDEX idx_botwow_emails_subscribed_at ON botwow_emails(subscribed_at);
CREATE INDEX idx_deliveries_status ON deliveries(status, created_at);
CREATE INDEX idx_downloads_expires_at ON downloads(expires_at);
CREATE INDEX idx_downloads_license ON downloads(license_id);
CREATE INDEX idx_downloads_license_id ON downloads(license_id);
CREATE INDEX idx_licenses_email ON licenses(email);
CREATE INDEX idx_licenses_key ON licenses(key);
CREATE INDEX idx_licenses_order ON licenses(order_id);
CREATE INDEX idx_licenses_order_id ON licenses(order_id);
CREATE INDEX idx_licenses_status ON licenses(status);
CREATE INDEX idx_mollie_customers_email ON mollie_customers(email);
CREATE INDEX idx_orders_created ON orders(created_at);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_email ON orders(email);
CREATE INDEX idx_orders_provider ON orders(provider, provider_id);
CREATE INDEX idx_orders_provider_id ON orders(provider_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_rate_limit_bucket_ts ON rate_limit(bucket, ts);
CREATE UNIQUE INDEX idx_webhook_events_id
  ON webhook_events(id);
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
CREATE TABLE mollie_customers (
  id         TEXT PRIMARY KEY,             -- id client Mollie
  email      TEXT NOT NULL,
  locale     TEXT NOT NULL DEFAULT 'fr',
  metadata   TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE TABLE "orders" (
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
CREATE TABLE rate_limit (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  bucket  TEXT NOT NULL,
  ts      INTEGER NOT NULL
);
CREATE TABLE sqlite_sequence(name,seq);
CREATE VIEW v_active_licenses AS
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
CREATE VIEW v_admin_orders AS
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
CREATE TABLE webhook_events (
  id           TEXT PRIMARY KEY,           -- <type>:<paymentId>
  provider     TEXT NOT NULL,
  processed_at INTEGER NOT NULL
);
