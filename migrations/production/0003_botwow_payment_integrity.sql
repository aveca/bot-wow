-- Migration 0003 : botwow_payment_integrity
--
-- Objectif : reparer les donnees deja stockees et garantir les contraintes
-- dont dependent le parcours de paiement (commande -> licence -> telechargement).
--
-- Constats (audit du 2026-10-21) :
--  * les tables existaient en production mais n'etaient decrites par aucune
--    migration (c'est l'objet de la 0002) ;
--  * le code de livraison inserait une commande SANS `id` (colonne TEXT
--    PRIMARY KEY => NULL) puis faisait pointer la licence sur
--    `meta.last_row_id` (un nombre) : la jointure orders <-> licenses ne
--    pouvait donc jamais aboutir ;
--  * `webhook_events.id` n'avait pas de contrainte UNIQUE exploitable dans
--    certaines bases : l'idempotence du webhook reposait sur un
--    SELECT suivi d'un INSERT (fenetre de course) ;
--  * aucune table `deliveries` : la livraison e-mail ne pouvait etre
--    consignee pour un rejeu.
--
-- TOUTES les operations ci-dessous sont idempotentes et non destructives :
-- aucune donnee n'est supprimee, les lignes concernees sont completees.

-- 1. Identifiants de commande manquants (lignes creees sans `id`)
UPDATE orders
   SET id = 'ord_' || provider || '_' || COALESCE(provider_id, rowid)
 WHERE id IS NULL OR id = '';

-- 2. Licences dont `order_id` pointait sur l'ancien rowid numérique
UPDATE licenses
   SET order_id = (SELECT o.id FROM orders o WHERE o.rowid = licenses.order_id)
 WHERE order_id IS NOT NULL
   AND order_id NOT LIKE 'ord_%'
   AND EXISTS (SELECT 1 FROM orders o WHERE o.rowid = licenses.order_id);

-- 3. Contrainte d'unicité des événements de webhook (idempotence)
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_id
  ON webhook_events(id);

-- 4. Journal des livraisons (rejeu si l'envoi a échoué)
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

-- 5. Index utiles aux listes d'administration
CREATE INDEX IF NOT EXISTS idx_orders_email ON orders(email);
CREATE INDEX IF NOT EXISTS idx_orders_provider_id ON orders(provider, provider_id);
CREATE INDEX IF NOT EXISTS idx_licenses_email ON licenses(email);
