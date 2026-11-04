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

## 7. Conformité et éligibilité commerciale

- La page d'achat publique avertit explicitement que l'automatisation enfreint les conditions Blizzard et peut entraîner suspension ou bannissement.
- La PR #66, toujours ouverte en draft, contient un audit interne daté du 2026-10-29 qui classe le produit actuel (lecture d'écran + clics automatisés + addon) comme contraire aux conditions publiées de Blizzard, sans autorisation explicite identifiée.
- Cette branche propose un pivot non-automatisant : planificateur de routes à saisie manuelle, carnet de spots et simulateur hors ligne, sans lecture d'écran, clics automatisés, addon de contrôle ni interaction avec le client. Ce pivot n'est pas implémenté ou fusionné.
- Ce rapport est une source interne, pas un avis juridique ni une décision de Blizzard. Ne pas promouvoir le bot auprès des joueurs de serveurs officiels tant que le périmètre d'autorisation n'est pas résolu ; toute utilisation sur serveur privé doit respecter les règles explicites de ce serveur.

## 8. Prochaine priorité classée

| Priorité | Action | Impact | Effort | Condition |
|---|---|---|---|---|
| P0 | Préparer puis exécuter un test contrôlé paiement → webhook → licence → e-mail → téléchargement | Critique | Moyen | Autorisation explicite pour le test Mollie, l'e-mail vers une boîte contrôlée et le déploiement Worker |
| P0 | Déployer le Worker de #71 avec rollback documenté, puis vérifier le gate serveur | Critique | Moyen | Autorisation explicite de déploiement |
| P1 | Vérifier la télémétrie serveur de PR #67 après validation du déploiement Worker | Élevé | Faible à moyen | Ne pas passer devant la preuve de livraison |
| P2 | Reprendre SEO et acquisition qualifiée une fois le paiement et la livraison prouvés | Élevé | Moyen | Checkout commercial réellement prêt |

**Décision de ce cycle :** pas de réouverture du checkout et pas de déploiement Worker. Le prochain progrès commercial utile est la preuve contrôlée de livraison de bout en bout, avec les autorisations requises ; optimiser le trafic avant cela risquerait seulement d'envoyer davantage de visiteurs vers une offre indisponible.


## 9. Revalidation complémentaire — 2026-11-04T16:48:26.613Z

### GitHub et CI

- `main` reste à `595e7acd85996512d404a3f4b2b278ea2c4bfe35` ; aucun changement applicatif n'a été fusionné.
- PR #77 (`p0.24/unblock-first-sale`) : correction conditionnelle Mollie et tests API Key / jeton organisation. HEAD courant au moment du contrôle : `502da4efb0f4b05a05ff560396160b929e68073c`. Les deux exécutions précédentes ont échoué sur un défaut du mock de test qui cherchait une URL finissant par `/payments` alors que le jeton organisation ajoute `?profileId=...`. Le matcher a été corrigé pour examiner le chemin URL. Les nouveaux checks de ce HEAD ne sont pas encore disponibles ; PR toujours en draft, non fusionnée.
- PR #79 (`fix/checkout-copy-honesty-20261104`) : ajout de corrections des meta descriptions SEO sur les six pages d'achat EN/FR (pages principales et variantes A/B), plus six assertions empêchant de promettre une livraison e-mail non certifiée. HEAD `85f6af3948f399881c6dea027a1d6a02b6c2a057` : Validate Bot-Wow **success** (run 41870619388) ; UI quality encore en cours (run 41870619101). PR ouverte, non fusionnée.
- PR #78 : les deux workflows du HEAD précédent `d0270bade3a6ccd88fc85891967d931ea6424b22` étaient verts ; cette mise à jour documentaire déclenchera ses propres contrôles.

### Mollie — séparation de profils : constat critique confirmé

- `ListProfiles` retourne un seul profil vérifié, dont le site est `https://sargasses-martinique.com/`. Aucun profil BOT-WOW n'est visible dans la liste.
- Les 11 identifiants de paiement Mollie présents dans D1 ont été lus individuellement via `GetPayment` (lecture seule, mode live). **Les 11 objets sont tous rattachés à ce profil Sargasses**, chacun de 20,00 EUR et au statut `expired`. Aucun n'est `paid`; aucun mode de paiement n'est renseigné sur ces objets expirés.
- Il s'agit donc d'un routage croisé confirmé : les tentatives de paiement enregistrées pour BOT-WOW ont été créées sous le profil Mollie de Sargasses. Cela ne prouve pas que ce routage est la cause technique des expirations ; la cause d'expiration reste non établie.
- Les bindings Worker `MOLLIE_API_KEY` et `MOLLIE_PROFILE_ID` existent par nom, mais leurs valeurs sont masquées. Le type exact du credential BOT-WOW (API Key vs Advanced/OAuth token) n'est donc pas vérifié.
- Documentation officielle Mollie : une API Key est liée à son profil et ne doit pas recevoir `profileId`; un Advanced access token ou OAuth/Organization token doit recevoir `profileId`. PR #77 a été ajustée pour demander le profil au helper sur création et lecture webhook ; le helper l'omet uniquement pour les clés préfixées `test_` ou `live_`. Les tests couvrent les deux branches.
- **Garde-fou :** ne jamais réutiliser le profil Sargasses pour BOT-WOW. Ne créer aucun profil, ne changer aucun secret et ne lancer aucun paiement sans autorisation explicite. Préparer un profil BOT-WOW indépendant et une clé de test dédiée.

### D1 — chiffres réinterrogés

Commandes `orders` :

| Fournisseur / statut | Nombre | Détail |
|---|---:|---|
| Mollie / failed | 11 | 20,00 EUR chacune ; mode live ; statut fournisseur `expired` ; toutes rattachées au profil Sargasses |
| bitcoin_manual / paid | 5 | 100,00 EUR de données de test, domaine e-mail `example.com` ; non comptabilisées comme ventes |
| bitcoin_manual / pending_payment | 8 | 7 domaine `gmail.com`, 1 `example.com` |
| bitcoin_manual / rejected | 1 | Donnée de test `example.com` |

- Licences actives : 5 (liées aux commandes de test déjà identifiées).
- `deliveries` : 0 ligne ; `activations` : 0 ligne.
- Revenu commercial confirmé : **0,00 EUR**.

Funnel D1 (`test=0), comptage d'événements et non de visiteurs uniques :

| Événement | Nombre |
|---|---:|
| page_view | 1 524 |
| journey_view | 581 |
| cta_click | 48 |
| checkout_requested | 29 |
| checkout_start | 4 |
| checkout_created | 6 |
| checkout_failed | 6 |
| payment_confirmed / conversion / delivery_sent / activation | 0 |

### Site public — contradiction toujours live

La lecture publique de `https://bot-wow.com/` et `https://bot-wow.com/buy` retourne les anciennes pages de `main`. La page d'achat affiche bien « Checkout unavailable » et un bouton désactivé, mais conserve aussi « Payment by Mollie », « you are redirected to Mollie » et « Card payment is live through Mollie ». PR #79 corrige ces affirmations dans le code de branche, mais n'est pas encore fusionnée ni déployée. Les meta descriptions qui promettaient « delivered by email / livrée par e-mail » ont également été corrigées dans cette PR.

### Opérations effectuées et limites

- Lectures seules sur GitHub, Cloudflare D1, Worker metadata, Mollie profiles/payments et site public.
- Modifications uniquement sur les branches de PR #77, #79 et #78 ; aucun changement sur `main`.
- Aucun paiement créé, aucun e-mail envoyé, aucune modification de secret, aucun déploiement Worker/Pages, aucune écriture D1/R2.

### Prochaine priorité

1. **P0 — Séparer le compte marchand :** obtenir un profil Mollie BOT-WOW distinct et une clé API de test dédiée. Bloqué par l'absence de profil BOT-WOW et l'autorisation nécessaire pour créer/configurer un profil et des secrets.
2. **P0 — Valider PR #77 :** attendre les checks du HEAD `502da4e`; corriger toute régression avant revue. Ne pas fusionner ou déployer le code paiement sans autorisation.
3. **P0 — Valider PR #79 :** attendre UI quality sur le HEAD `85f6af3`, puis faire relire les pages et les six meta descriptions. Ne pas présenter le checkout comme disponible.
4. **P1 — Conformité produit :** reprendre la PR #66 et son MVP non-automatisant avant acquisition de joueurs.
