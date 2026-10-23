-- Migration 0001 (base botwow-analytics) : table des evenements de parcours.
--
-- Conforme a scripts/telemetry-schema.sql : aucune donnee personnelle
-- (ni e-mail, ni identifiant de commande), pas de texte libre, IP jamais
-- stockee en clair, retention courte et purge automatique.
--
-- Les conversions reelles (achat confirme) ne viennent PAS de cette table :
-- elles sont ecrites par le webhook Mollie cote Worker de paiement.
--
-- CETTE MIGRATION EST DESTINEE A LA BASE `botwow-analytics` UNIQUEMENT
-- (voir wrangler.toml : binding TELEMETRY_DB, migrations_dir dedie).

CREATE TABLE IF NOT EXISTS events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        INTEGER NOT NULL,          -- horodatage reception (epoch ms)
  event     TEXT    NOT NULL,          -- nom d evenement (liste blanche serveur)
  page      TEXT    NOT NULL,          -- chemin de page (ex: /, /compare)
  lang      TEXT    NOT NULL,          -- 'en' | 'fr'
  cta       TEXT,                      -- identifiant du CTA (cta_click)
  mode      TEXT,                      -- mode du planificateur (planner_mode)
  years     INTEGER,                   -- horizon (ownership_view)
  step      TEXT,                      -- etape du parcours
  ref       TEXT,                      -- correlation (evenements de test)
  test      INTEGER NOT NULL DEFAULT 0,-- 1 : evenement de test (exclu des stats)
  ip_hash   TEXT,                      -- hash sale de l IP (anti-abus)
  ua        TEXT,                      -- famille d agent, <= 80 caracteres
  value_eur REAL,                      -- montant confirme (conversion uniquement)
  source    TEXT                       -- origine (mollie pour une conversion)
);

CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_event ON events(event);
CREATE INDEX IF NOT EXISTS idx_events_test ON events(test, ref);
