-- Migration 0004 (base botwow-analytics): code d'erreur pour checkout_error.
--
-- Ajoute une colonne nullable `code` pour stocker le code d'erreur ferme
-- renvoye par le checkout (delivery_unverified, invalid_request,
-- rate_limited, server_error, network_error, http_4xx, unknown). Aucune
-- donnee personnelle, pas de texte libre : le code est issu d'une liste
-- fermee validee par le Worker de telemetrie.
--
-- Additive : conserve les lignes existantes. Non appliquee en production
-- sans approbation explicite (migration de base D1).

ALTER TABLE events ADD COLUMN code TEXT;

CREATE INDEX IF NOT EXISTS idx_events_code ON events(code);
