-- Migration 0002: botwow_licenses (commandes, licences, activations, telechargements)
--
-- POURQUOI CE FICHIER EXISTE : les tables utilisees par le Worker
-- (licenses, activations, downloads, orders, webhook_events,
-- mollie_customers) avaient ete creees a la main en production : elles
-- n'etaient presentes dans AUCUNE migration du depot. Consequence : un
-- environnement neuf (preprod, CI, reconstruction) n'etait pas reproductible,
-- et la migration 0001 seule ne suffisait pas.
--
-- Le schema ci-dessous est RECONSTITUIT a partir des requetes reelles du
-- Worker (worker/index.js) : les noms de colonnes et les types sont alignes
-- sur ce que le code lit et ecrit.
--
-- IMPORTANT : toutes les tables sont creees en IF NOT EXISTS : la migration
-- est idempotente et sans risque sur la base de production, ou ces tables
-- existent deja.

CREATE TABLE IF NOT EXISTS orders (
  id           TEXT PRIMARY KEY,
  provider     TEXT NOT NULL,              -- mollie | bitcoin_manual | free
  provider_id  TEXT,                      -- reference chez le prestataire
  email        TEXT NOT NULL,
  amount       INTEGER NOT NULL DEFAULT 0,-- centimes
  currency     TEXT NOT NULL DEFAULT 'eur',
  status       TEXT NOT NULL,              -- pending_payment | paid | failed | rejected | free
  metadata     TEXT,                       -- JSON libre
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_orders_provider ON orders(provider, provider_id);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

CREATE TABLE IF NOT EXISTS licenses (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  key             TEXT NOT NULL UNIQUE,    -- BOTWOW-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX
  order_id        TEXT REFERENCES orders(id),
  email           TEXT NOT NULL,
  lang            TEXT NOT NULL DEFAULT 'fr',
  status          TEXT NOT NULL DEFAULT 'active', -- active | revoked | expired
  token           TEXT UNIQUE,             -- jeton de controle du bot
  max_activations INTEGER NOT NULL DEFAULT 1,
  expires_at      INTEGER,                 -- timestamp ms (NULL = illimite)
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_licenses_email ON licenses(email);
CREATE INDEX IF NOT EXISTS idx_licenses_order ON licenses(order_id);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);

CREATE TABLE IF NOT EXISTS activations (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  license_id   INTEGER NOT NULL REFERENCES licenses(id),
  machine_id   TEXT NOT NULL,              -- empreinte de la machine
  ip           TEXT,
  user_agent   TEXT,
  activated_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);

-- une activation par machine et par licence
CREATE UNIQUE INDEX IF NOT EXISTS idx_activations_license_machine
  ON activations(license_id, machine_id);

CREATE TABLE IF NOT EXISTS downloads (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  token       TEXT NOT NULL UNIQUE,
  license_id  INTEGER NOT NULL REFERENCES licenses(id),
  expires_at  INTEGER NOT NULL,            -- timestamp ms
  count       INTEGER NOT NULL DEFAULT 0,  -- telechargements effectues
  max_count   INTEGER NOT NULL DEFAULT 3,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_downloads_license ON downloads(license_id);

-- Idempotence du webhook : un evenement traite n'est jamais rejoue.
CREATE TABLE IF NOT EXISTS webhook_events (
  id           TEXT PRIMARY KEY,           -- <type>:<paymentId>
  provider     TEXT NOT NULL,
  processed_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS mollie_customers (
  id         TEXT PRIMARY KEY,             -- id client Mollie
  email      TEXT NOT NULL,
  locale     TEXT NOT NULL DEFAULT 'fr',
  metadata   TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_mollie_customers_email ON mollie_customers(email);
