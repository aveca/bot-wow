# Plan de réouverture du checkout — brouillon, non exécuté

Le code de la PR ajoute un second verrou. `POST /api/checkout` ne crée un paiement que si les deux sont vrais :

1. `RELEASE_STATUS` vaut exactement `confirmed` (verrou déjà en production).
2. `CHECKOUT_PUBLIC` vaut exactement `enabled`.

Toute autre valeur, ou l'absence du binding, répond `409 checkout_closed` après le contrôle de livraison, et n'appelle pas Mollie. Le corps de la requête ne peut pas allumer ce flag. `PRICE_TABLE` reste 2000 centimes EUR pour `bot-wow-lifetime`.

Cette PR est un brouillon. Elle ne se déploie pas et ne se fusionne pas tant que les trois conditions suivantes ne sont pas acceptées :

- textes juridiques revus (PR #137) ;
- provenance du paquet acceptée (PR #124, hash live `1c132f367607ea186feffde8bbda0a1a9f94cdec4b7850b93c57c271270bba4f`) ;
- profil Mollie BOT-WOW dédié renseigné dans le secret `MOLLIE_PROFILE_ID` (PR #90, qui reste brouillon).

## Plan de test, à lancer seulement après ces trois conditions

1. Créer une clé API **test_** sur le profil BOT-WOW dédié. Ne pas la commiter.
2. Déployer une version de Worker qui n'est pas le trafic de production, avec `CHECKOUT_PUBLIC=enabled`, `RELEASE_STATUS=confirmed`, et cette clé test. Le prix reste 20,00 EUR.
3. `POST /api/checkout` avec une adresse de test contrôlée. Payer avec une carte de test Mollie. Vérifier le webhook, une licence, et un téléchargement dont le SHA-256 est celui de l'objet servi.
4. Remettre `CHECKOUT_PUBLIC` absent sur cette version.
5. Ensuite seulement, un achat réel de 20,00 EUR sur le profil live, vers une boîte contrôlée, suivi d'un remboursement Mollie du même paiement. Ne pas laisser le flag allumé après ce contrôle.
6. Rollback : redéployer la version de production précédente (`054cd158-4be2-42f8-92a6-ff9c4f059079` au 2026-11-07) ou retirer le binding `CHECKOUT_PUBLIC`.

Aucun de ces paiements n'est lancé par cette PR.
