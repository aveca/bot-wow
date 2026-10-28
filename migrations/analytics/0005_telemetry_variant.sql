-- Migration 0005 (base botwow-analytics): colonne variante A/B.
--
-- Ajoute une colonne nullable `variant` ('a' | 'b') pour l'exposition a
-- une variante A/B. Aucune donnee personnelle, pas de texte libre :
-- la valeur est issue d'une assignation stable cote client.
--
-- Additive : conserve les lignes existantes. Non appliquee en production
-- sans approbation explicite (migration de base D1).

ALTER TABLE events ADD COLUMN variant TEXT;

CREATE INDEX IF NOT EXISTS idx_events_variant ON events(variant);
