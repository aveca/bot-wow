# BOT-WOW — revalidation live GitHub, Cloudflare et D1

**Contrôle :** 2026-11-04T14:36Z  
**Dépôt :** aveca/bot-wow  
**Branche main observée :** 595e7acd85996512d404a3f4b2b278ea2c4bfe35  
**Nature :** lectures seules (GitHub, Cloudflare, pages publiques et D1). Aucun paiement, e-mail, changement de secret, écriture D1/R2, déploiement Worker ou réouverture du checkout.

## 1. GitHub — état confirmé

- `main` pointe sur `595e7acd85996512d404a3f4b2b278ea2c4bfe35`, commit documentaire issu de la PR #76.
- PR #71 est fusionnée : elle intègre le correctif d'intégrité du téléchargement (#19), la garde serveur de livraison et la reprise idempotente.
- PR #76 est fusionnée. Sur son HEAD `3c4d984cea8a94fd34f94eb5fedbb3c1bfb4009f`, les workflows GitHub Actions sont verts :
  - Validate Bot-Wow — run 41838459326 — success.
  - UI quality and visual evidence — run 41838459418 — success.
- PR #19 est fermée/fusionnée dans le cadre de #71.
- PR #67 reste ouverte : instrumentation `compatibility_view` / `demo_interaction`, non déployée côté Worker de télémétrie.
- PR #62, #65 et #66 restent ouvertes (certaines en draft) ; elles ne doivent pas être fusionnées à l'aveugle sur leur ancien état de base.

## 2. Cloudflare — séparation Pages / Worker

### Pages

Le projet Cloudflare Pages `bot-wow` a effectué un déploiement de production après le push GitHub de la PR #76 :

- Deployment : `d9d79ad7-0d35-4bf4-a5db-8fae45f5de77`
- Créé : 2026-11-04T13:42:32.659Z
- Fin du stage deploy : 2026-11-04T13:42:52.505Z — **success**
- Déclencheur : `github:push`
- Commit source : `595e7acd85996512d404a3f4b2b278ea2c4bfe35`

**Correction opérationnelle :** le `paths-ignore: reports/**` de `.github/workflows/pages.yml` ne contrôle que le workflow GitHub Actions Pages. Il n'empêche pas le déclenchement GitHub → Cloudflare Pages. Les commits documentaires sur main peuvent donc encore provoquer un déploiement Cloudflare Pages. Le précédent rapport qui disait « zéro déploiement Pages » ne décrivait que le workflow GitHub Pages, pas le projet Cloudflare Pages du domaine public.

### Worker API

- Worker : `botwow-api`
- Dernière version active observée : `c3dcc842-c422-42d3-9828-405f30d70b5f` (version 50).
- Déploiement : 2026-10-27T07:46:28.277Z.
- Tag : `20f5821adfeb465cae177120c9015f8f`.
- Aucune version Worker postérieure à PR #71 n'a été observée.

Les bindings `RELEASE_STATUS`, `MOLLIE_PROFILE_ID` et `RESEND_API_KEY` sont présents par nom. Leurs valeurs sont masquées ; leur présence ne prouve ni leur validité ni que le code récent est déployé. Le code de main issu de #71 n'est donc pas considéré comme livré sur le Worker de production.

## 3. Site public — parcours d'achat

Lecture des pages publiques :

- `https://bot-wow.com/buy` : avis de disponibilité, mention « Checkout unavailable », formulaire présenté comme désactivé.
- `https://bot-wow.com/fr/buy` : avis « Achat indisponible », livraison non confirmée, formulaire présenté comme désactivé.
- Les sources actuelles de `index.html`, `fr/index.html`, `buy.html` et `fr/buy.html` contiennent toutes le bloc de disponibilité et le bouton `buyBtn` avec l'attribut `disabled`.

Le prix affiché reste 20,00 €. Aucun prix n'a été modifié. Aucun POST de checkout n'a été envoyé et aucun paiement test ou réel n'a été déclenché.

## 4. D1 — commandes et revenus réels

Requêtes SQL exclusivement en lecture seule sur les bases Cloudflare D1 `botwow-production` et `botwow-analytics`.

### Commandes de production

Agrégation de `orders` par fournisseur, statut, montant, devise et classe de domaine e-mail (aucune adresse individuelle restituée) :

| Fournisseur | Statut local | Statut fournisseur | Classe e-mail | Nombre |
|---|---|---|---|---:|
| Mollie | failed | expired | autre domaine | 11 |
| bitcoin_manual | paid | — | example.com (test) | 5 |
| bitcoin_manual | pending_payment | — | autre domaine | 7 |
| bitcoin_manual | pending_payment | — | example.com (test) | 1 |
| bitcoin_manual | rejected | — | example.com (test) | 1 |

Les 11 commandes Mollie échouées portent toutes le statut fournisseur `expired`. Cela ne prouve pas la cause initiale de l'expiration. Les 5 commandes marquées `paid` sont toutes associées à des adresses de test `example.com`.

**Ventes réelles payées confirmées : 0. Revenu réel encaissé confirmé : 0,00 €.**  
Aucune commande Mollie payée n'apparaît dans l'agrégation.

### Livraison et activation

- Licences : 5 actives.
- Activations : 0.
- Lignes dans `deliveries` : 0.

Les 5 licences correspondent aux commandes manuelles de test déjà identifiées ; elles ne constituent pas des ventes clients.

## 5. D1 — funnel observé

Événements `test=0` (comptes d'événements, **pas** de visiteurs ou sessions uniques) :

| Événement | Nombre | Dernier événement observé |
|---|---:|---|
| page_view | 1 490 | 2026-11-04T14:27:26.550Z |
| journey_view | 563 | 2026-11-04T14:27:26.548Z |
| cta_click | 48 | 2026-11-04T02:47:00.736Z |
| checkout_requested | 29 | 2026-11-04T02:47:00.719Z |
| checkout_start | 4 | 2026-10-27T01:49:23.154Z |
| checkout_created | 6 | 2026-10-27T23:07:01.087Z |
| checkout_failed | 6 | 2026-10-27T23:23:17.733Z |

Aucun événement `payment_confirmed`, `conversion`, `delivery_sent`, `delivery_failed` ou `activation` n'est présent dans le regroupement courant.

**Interprétation :** il existe des signaux d'intention (48 clics CTA, 29 `checkout_requested`), dont le dernier le 4 novembre à 02:47Z, mais aucun démarrage de checkout enregistré après le 27 octobre. Un `checkout_requested` est une intention mesurée côté client, pas un paiement ni une vente. Le formulaire public étant désactivé, ces signaux ne prouvent pas qu'un visiteur puisse payer.

## 6. Blocages P0 et décision

1. **Checkout :** fermé sur le site. Le code de garde serveur fusionné dans #71 n'est pas encore livré sur le Worker de production.
2. **Mollie :** 11 commandes locales `failed`, statut fournisseur `expired`; aucune preuve de paiement encaissé. La cause exacte n'est pas déduite de ce seul statut.
3. **Fulfillment :** zéro ligne `deliveries`, zéro activation ; l'envoi e-mail et le téléchargement après paiement ne sont pas prouvés en production.
4. **Mesure :** les événements post-paiement sont absents ; les événements de checkout serveur n'ont plus été observés depuis le 27 octobre.
5. **Cloudflare Pages :** les commits documentaires sur main déclenchent encore le projet Pages via l'intégration GitHub, malgré le filtre du workflow GitHub Actions.

Aucune modification de paiement/checkout, aucun déploiement Worker, aucune écriture D1/R2, aucun changement de secret, aucun e-mail et aucun paiement n'ont été effectués pendant ce contrôle.

## 7. Prochaine priorité classée

| Priorité | Action | Impact | Effort | Condition |
|---|---|---|---|---|
| P0 | Préparer puis exécuter un test contrôlé paiement → webhook → licence → e-mail → téléchargement | Critique | Moyen | Autorisation explicite pour le test Mollie, l'e-mail vers une boîte contrôlée et le déploiement Worker |
| P0 | Déployer le Worker de #71 avec rollback documenté, puis vérifier le gate serveur | Critique | Moyen | Autorisation explicite de déploiement |
| P1 | Vérifier la télémétrie serveur de PR #67 après validation du déploiement Worker | Élevé | Faible à moyen | Ne pas passer devant la preuve de livraison |
| P2 | Reprendre SEO et acquisition qualifiée une fois le paiement et la livraison prouvés | Élevé | Moyen | Checkout commercial réellement prêt |

**Décision de ce cycle :** pas de réouverture du checkout et pas de déploiement Worker. Le prochain progrès commercial utile est la preuve contrôlée de livraison de bout en bout, avec les autorisations requises ; optimiser le trafic avant cela risquerait seulement d'envoyer davantage de visiteurs vers une offre indisponible.
