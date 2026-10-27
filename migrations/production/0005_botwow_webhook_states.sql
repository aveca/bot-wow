-- Migration 0005 : etats du traitement des webhooks Mollie + reprise de livraison
--
-- Objectif : eliminer le risque qu'un marqueur de webhook ecrit AVANT la
-- fulfillment rende un paiement confirme impossible a livrer apres une panne.
--
-- Contexte (issue #13) : le code actuel inserait la ligne
-- `webhook_events(id)` (verrou d'unicite) avant d'appeler fulfillOrder. Si
-- fulfillOrder echappait en cours de route (commande creee, licence manquante,
-- ou e-mail non envoye), le webhook etait deja marque "traite" : un rejeul
-- retournait 200 sans reprendre la livraison, et le client restait sans
-- cle de licence.
--
-- Cette migration ajoute une table `payment_states` qui distingue explicitement
-- "recu" / "en cours" / "termine" / "echec reprisable" / "echec permanent",
-- associee a une cle d'idempotence stable par paiement. La table `deliveries`
-- (deja creee par 0003/0004) sert de journal pour le retry de l'e-mail de
-- livraison.
--
-- Toutes les operations sont idempotentes (IF NOT EXISTS) et non destructives :
-- aucune donnee n'est supprimee ni modifiee. A tester sur une base D1 temporaire,
-- jamais appliquee en production dans le cadre de cette mission.

CREATE TABLE IF NOT EXISTS payment_states (
  id          TEXT PRIMARY KEY,   -- "payment:<mollie_payment_id>", cle d'idempotence stable
  provider    TEXT NOT NULL DEFAULT 'mollie',
  status      TEXT NOT NULL DEFAULT 'received', -- received | processing | completed | retryable_failure | permanent_failure
  attempt     INTEGER NOT NULL DEFAULT 0,
  last_error  TEXT,
  updated_at  INTEGER NOT NULL,
  created_at  INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_payment_states_status
  ON payment_states(status, updated_at);

CREATE INDEX IF NOT EXISTS idx_payment_states_provider
  ON payment_states(provider, id);
