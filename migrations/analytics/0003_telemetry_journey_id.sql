-- Migration 0003 (base botwow-analytics): identifiant de parcours.
--
-- Ajoute une colonne nullable pour corréler les événements d'une même
-- session sans stocker d'e-mail, de clé de licence ni de jeton.
--
-- Migration standard Wrangler/D1, exécutée une seule fois et suivie dans
-- d1_migrations. Cette modification est additive : elle conserve les lignes
-- existantes et les index actuels. Ne pas reconstruire la table events.
--
-- Wrangler/D1 enregistre les migrations appliquées dans d1_migrations.
-- Ne relancer pas manuellement cette instruction après son application :
-- ALTER TABLE ADD COLUMN n'est pas idempotent en cas de ré-exécution.

ALTER TABLE events ADD COLUMN journey_id TEXT;

CREATE INDEX IF NOT EXISTS idx_events_journey_id ON events(journey_id);
