-- BOT-WOW — telemetrie de parcours, premiere partie.
--
-- Principes :
--  - aucune donnee personnelle : ni email, ni nom, ni identifiant de commande ;
--  - pas de texte libre : les proprietes sont une liste fermee cote serveur ;
--  - l'IP n'est jamais stockee en clair : seul un hash salé est conserve,
--    et uniquement s'il sert a la limitation de debit ;
--  - retention courte et purge automatique.
--
-- Les conversions reelles (un achat confirme) ne sont PAS issues de cette
-- table : elles viennent du webhook Mollie, cote Worker de paiement.

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
  ip_hash   TEXT,                      -- hash sale de l'IP (anti-abus)
  ua        TEXT,                      -- famille d agent, <= 80 caracteres
  value_eur REAL,                      -- montant confirme (conversion uniquement)
  source    TEXT                       -- origine (mollie pour une conversion)
);

CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_event ON events(event);
CREATE INDEX IF NOT EXISTS idx_events_test ON events(test, ref);

-- Limitation de debit : un compteur par seau et par fenetre d une minute.
CREATE TABLE IF NOT EXISTS rl (
  bucket TEXT    NOT NULL,
  window INTEGER NOT NULL,
  count  INTEGER NOT NULL,
  PRIMARY KEY (bucket, window)
);
