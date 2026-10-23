-- Migration 0002 (base botwow-analytics) : limitation de debit par seau.
--
-- Un compteur par seau et par fenetre d une minute. La table est purgee
-- periodiquement par le Worker ; elle ne contient aucune donnee personnelle.

CREATE TABLE IF NOT EXISTS rl (
  bucket TEXT    NOT NULL,
  window INTEGER NOT NULL,
  count  INTEGER NOT NULL,
  PRIMARY KEY (bucket, window)
);
