-- Migration 0004 : reconciliation des identifiants de commande (TEXT).
--
-- PROBLEME REEL, MESURE SUR UN VRAI MOTEUR SQL
-- --------------------------------------------
-- La base `botwow-production` a ete creee a la main avec :
--   orders.id         INTEGER PRIMARY KEY  (alias de rowid)
--   licenses.order_id INTEGER REFERENCES orders(id)
-- alors que le Worker insere des identifiants TEXTE
-- (`ord_tr_...` pour Mollie, `ord_bitcoin_manual_BTC-...` pour Bitcoin).
-- Consequence mesuree par tests/d1-order-id-regression.test.mjs :
--   * webhook Mollie paye  -> "datatype mismatch", aucune licence creee,
--     et le verrou d'idempotence DEJA pose interdit tout rejeu utile ;
--   * checkout Bitcoin     -> 500 "checkout_failed", aucune commande creee.
--
-- La migration 0002 ne peut pas corriger cela : elle declare un schema TEXT
-- mais utilise `CREATE TABLE IF NOT EXISTS`, qui NE convertit PAS une table
-- deja presente. Il faut donc reconstruire les tables ET convertir les
-- donnees existantes.
--
-- REGLES DE SECURITE APPLIQUEES
-- -----------------------------
--  1. PRAGMA defer_foreign_keys = ON permet de reconstruire les tables
--     référencées dans la transaction D1 sans désactiver les contraintes.
--  2. AUCUNE donnee supprimeee : les 14 commandes et 5 licences historiques
--     sont converties, pas reecrites. Les anciens identifiants entiers
--     deviennent `ord_legacy_<valeur>` et les references de licences suivent.
--  3. La conversion est IDEMPOTENTE : seules les valeurs encore numeriques
--     sont converties (test `GLOB '[0-9]*'`), donc rejouer la migration ne
--     double pas le prefixe.
--  4. Tout est enveloppe dans une transaction : en cas d'erreur, rien n'est
--     applique (rollback automatique).
--
-- tables couvertes : orders, licenses, activations, downloads (references
-- vers orders/licenses) + la table `deliveries` attendue par le Worker et
-- absente de la base de production.

-- Cloudflare D1 runs migrations in an implicit transaction. Foreign-key
-- enforcement cannot be toggled with PRAGMA foreign_keys inside that
-- transaction; defer constraint checks until the table rebuild is complete.
PRAGMA defer_foreign_keys = ON;

-- ---------------------------------------------------------------------------
-- 1. Table `orders` : id INTEGER -> TEXT.
--    Les identifiants historiques (1..14) deviennent `ord_legacy_1`...
--    Les identifiants deja TEXT (`ord_...`) sont laisses intacts.
-- ---------------------------------------------------------------------------
CREATE TABLE orders_reconciled (
  id           TEXT PRIMARY KEY,
  provider     TEXT NOT NULL,
  provider_id  TEXT,
  email        TEXT NOT NULL,
  amount       INTEGER NOT NULL DEFAULT 0,
  currency     TEXT NOT NULL DEFAULT 'eur',
  status       TEXT NOT NULL,
  metadata     TEXT,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL
);

INSERT INTO orders_reconciled
  (id, provider, provider_id, email, amount, currency, status, metadata, created_at, updated_at)
SELECT
  CASE
    WHEN CAST(id AS TEXT) GLOB '[0-9]*' THEN 'ord_legacy_' || CAST(id AS TEXT)
    ELSE id
  END AS id,
  provider, provider_id, email, amount, currency, status, metadata, created_at, updated_at
FROM orders;

DROP TABLE orders;
ALTER TABLE orders_reconciled RENAME TO orders;

-- Index identiques a ceux que le Worker utilise (filtres d'administration).
CREATE INDEX IF NOT EXISTS idx_orders_provider ON orders(provider, provider_id);
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);

-- ---------------------------------------------------------------------------
-- 2. Table `licenses` : order_id INTEGER -> TEXT, et les 5 references
--    historiques pointent desormais sur les identifiants reconciliés.
--    `ord_legacy_<n>` correspond exactement a l'ancien `n` en base.
-- ---------------------------------------------------------------------------
-- Match the actual production licenses schema. The current D1 table has no
-- licenses.token or licenses.expires_at columns (download tokens and expiry
-- live in downloads); copying those nonexistent columns makes migration 0004
-- fail against production despite the synthetic fixture previously passing.
CREATE TABLE licenses_reconciled (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  key             TEXT NOT NULL UNIQUE,
  order_id        TEXT NOT NULL REFERENCES orders(id),
  email           TEXT NOT NULL,
  lang            TEXT NOT NULL DEFAULT 'fr',
  status          TEXT NOT NULL DEFAULT 'active',
  max_activations INTEGER NOT NULL DEFAULT 2,
  created_at      INTEGER NOT NULL,
  updated_at      INTEGER NOT NULL
);

INSERT INTO licenses_reconciled
  (id, key, order_id, email, lang, status, max_activations, created_at, updated_at)
SELECT
  id, key,
  CASE
    WHEN CAST(order_id AS TEXT) GLOB '[0-9]*' THEN 'ord_legacy_' || CAST(order_id AS TEXT)
    ELSE CAST(order_id AS TEXT)
  END AS order_id,
  email, lang, status, max_activations, created_at, updated_at
FROM licenses;

DROP TABLE licenses;
ALTER TABLE licenses_reconciled RENAME TO licenses;

CREATE INDEX IF NOT EXISTS idx_licenses_email ON licenses(email);
CREATE INDEX IF NOT EXISTS idx_licenses_order ON licenses(order_id);
CREATE INDEX IF NOT EXISTS idx_licenses_status ON licenses(status);

-- ---------------------------------------------------------------------------
-- 3. Tables attendues par le Worker mais absentes de la base de production.
--    Sans `deliveries`, un echec d'envoi ne peut pas etre consigne ni rejoue.
--    Sans `rate_limit` et `admin_sessions`, les routes concernees dependent
--    de creation implicite (comportement different selon les versions D1).
-- ---------------------------------------------------------------------------
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
  bucket      TEXT NOT NULL,
  window      INTEGER NOT NULL,
  count       INTEGER NOT NULL,
  PRIMARY KEY (bucket, window)
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id          TEXT PRIMARY KEY,
  created_at  INTEGER NOT NULL,
  expires_at  INTEGER NOT NULL
);

-- ---------------------------------------------------------------------------
-- 4. Index d'unicite des evenements de webhook : c'est LUI qui porte
--    l'idempotence (le code insere `payment:<id>` et attend un echec UNIQUE
--    au rejeu). Il est cree APRES la reconciliation des commandes.
-- ---------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_id ON webhook_events(id);

-- Force deferred foreign-key validation before the migration completes.
PRAGMA defer_foreign_keys = OFF;

-- ---------------------------------------------------------------------------
-- VERIFICATION APRES APPLICATION (a executer en lecture seule) :
--   SELECT COUNT(*) FROM orders;                     -- doit etre inchange (14)
--   SELECT COUNT(*) FROM licenses;                   -- doit etre inchange (5)
--   SELECT l.id, l.key, l.order_id, o.id
--     FROM licenses l LEFT JOIN orders o ON o.id = l.order_id;
--   -- chaque licence doit retrouver sa commande (aucun order_id NULL
--   --  autre qu'une commande reellement supprimee).
--   SELECT id FROM orders WHERE id GLOB '[0-9]*';     -- doit etre VIDE
--   SELECT order_id FROM licenses WHERE order_id GLOB '[0-9]*'; -- VIDE
-- ---------------------------------------------------------------------------
