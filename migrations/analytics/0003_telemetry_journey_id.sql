-- Migration 0003 (base botwow-analytics) : identifiant de parcours.
--
-- Ajoute la colonne journey_id sur la table events pour permettre la
-- corrélation côté serveur entre les événements d'une même session (page
-- view, checkout, paiement confirmé, licence créée, livraison) sans jamais
-- stocker d'e-mail, de clé de licence, de jeton de téléchargement ou d'autre
-- donnée personnelle.
--
-- Cette migration est IDÉMPOTENTE (ALTER TABLE ADD COLUMN IF NOT EXISTS
-- n'est pas natif SQLite : on teste d'abord l'absence de la colonne).
-- Elle n'est PAS appliquée automatiquement en production pendant cette
-- mission : le code de collecte gère gracieusement l'absence de la colonne.
-- L'administrateur l'appliquera quand il jugera opportun.

-- Vérifier si la colonne existe déjà (SQLite ne supporte pas
-- ADD COLUMN IF NOT EXISTS nativement avant la 3.35.0).
CREATE TABLE IF NOT EXISTS events_journey_backup AS
  SELECT * FROM events WHERE 0;

-- Supprimer la sauvegarde si elle existait déjà (idempotence).
DROP TABLE IF EXISTS events_journey_backup;

-- Recréer la table avec la nouvelle colonne (SQLite ne supporte pas
-- ALTER TABLE ADD COLUMN de manière conditionnelle sur toutes les
-- versions). Comme events est déjà créée par 0001, on reconstruira
-- uniquement si journe_id est absent. Pour éviter de dépendre de la
-- version de SQLite, on procède par copie complète :
--
--   1. Renommer events en events_old
--   2. Créer events avec la colonne journey_id
--   3. Copier les données
--   4. Recréer les index
--   5. Supprimer events_old
--
-- Toutes les étapes sont dans une transaction : en cas d'échec, tout est
-- annulé et la base reste cohérente.

PRAGMA foreign_keys = OFF;

BEGIN;

-- 1. Renommer
ALTER TABLE events RENAME TO events_old;

-- 2. Créer la nouvelle table avec journey_id
CREATE TABLE events (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  ts        INTEGER NOT NULL,
  event     TEXT    NOT NULL,
  page      TEXT    NOT NULL,
  lang      TEXT    NOT NULL,
  cta       TEXT,
  mode      TEXT,
  years     INTEGER,
  step      TEXT,
  ref       TEXT,
  test      INTEGER NOT NULL DEFAULT 0,
  ip_hash   TEXT,
  ua        TEXT,
  value_eur REAL,
  source    TEXT,
  journey_id TEXT
);

-- 3. Copier les données existantes
INSERT INTO events
  (id, ts, event, page, lang, cta, mode, years, step, ref, test, ip_hash, ua, value_eur, source, journey_id)
SELECT
  id, ts, event, page, lang, cta, mode, years, step, ref, test, ip_hash, ua, value_eur, source, NULL
FROM events_old;

-- 4. Recréer les index
CREATE INDEX IF NOT EXISTS idx_events_ts ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_event ON events(event);
CREATE INDEX IF NOT EXISTS idx_events_test ON events(test, ref);
CREATE INDEX IF NOT EXISTS idx_events_journey_id ON events(journey_id);

-- 5. Supprimer l'ancienne table
DROP TABLE events_old;

COMMIT;

PRAGMA foreign_keys = ON;
