# BOT-WOW — état partagé

**Relevé : 2026-11-06T14:17Z.** Les faits ci-dessous sont directement vérifiés dans ce cycle, sauf mention contraire. Les rapports antérieurs à cette heure ne sont pas une preuve.

Dépôt : https://github.com/aveca/bot-wow
Production : https://bot-wow.com/
Hôte canonique : `https://bot-wow.com` (confirmé par les `link rel="canonical"`, `CANONICAL_SITE` du Worker, et la Redirect Rule de zone).

## Verite courante

| Élément | Valeur | Preuve |
|---|---|---|
| Branche par défaut | `main` | `git` / GitHub |
| HEAD au début du cycle | `ba720c0fce69f4121d5c5b0aa4a168ceac931b70` | `git rev-parse HEAD` |
| CI de ce SHA | Validate `42210842281` SUCCESS ; Deploy GitHub Pages `42210842318` SUCCESS | GitHub Actions |
| Pages production | déploiement `e1fe25a3-9032-48c5-a5ba-b2433cfc41eb`, source `ba720c0fce69f4121d5c5b0aa4a168ceac931b70`, stage deploy SUCCESS, 2026-11-06T11:31:08Z | API Cloudflare, lecture seule |
| Worker `botwow-api` | déploiement `6aecab2d-6545-4c76-a6b3-cfb089372884`, 2026-11-06T09:16:54Z, 100 % sur la version `1513595c-6a53-4575-b013-9979b696dce3`, annotation « Production rollout BOT-WOW PR #103 fulfillment reconciliation » | API Cloudflare, lecture seule |
| Écart Worker / `main` | `worker/index.js` n'a pas changé depuis `8744a3e2bbaec449e16548f89117a05f0d7f20dc`, ancêtre de HEAD. Le comportement HTTP live (308, `/health`, `/api/config`) correspond à ce source | `git log` + sondes HTTP |

Le Worker v50 (`c3dcc842-c422-42d3-9828-405f30d70b5f`, 2026-10-27) n'est plus la version qui reçoit le trafic. Les sections de `reports/operations/BOT-WOW-CURRENT-STATE.md` qui le présentent comme déployé sont périmées.

## Achat ferme

La page publique est une posture de conformité volontaire, pas une panne d'affichage.

Directement vérifié par GET le 2026-11-06T14:15Z sur `https://bot-wow.com/` et `https://bot-wow.com/buy` (et `/fr/buy`) :

- titre « project status » / « purchase unavailable » ;
- « Purchase unavailable » et « Achat indisponible » ;
- « €20.00 » libellé « documented target price · historical only, no offer available » ;
- démo « simulated » ;
- paquet « not verified » ;
- marqueur `checkout-blocked` ;
- aucun formulaire de paiement, aucun champ e-mail.

Ce cycle ne rouvre pas le CTA ni le checkout. `PRICE_TABLE` reste 2000 EUR. Aucun prix n'est modifié.

Pourquoi la vente reste fermée :

1. Aucune autorisation de plateforme documentée pour distribuer l'automatisation de gameplay historique. Le site le dit.
2. Le paquet R2 `casinobabe-fishing-1.2.0.zip` existe (1 387 543 octets, etag `d9d7ab22ec076873b8fed656a53460bc`, lecture liste seule, 2026-11-06). La page le marque « not verified » : la provenance et les deux exécutables hors manifeste signalés par l'issue #18 ne sont pas revalidées dans ce cycle. Aucun octet n'a été téléchargé ni réécrit.
3. Profil Mollie BOT-WOW dédié : non revérifié dans ce cycle. Le relevé du 2026-11-04/05 (un seul profil, site Sargasses) reste une hypothèse tant qu'il n'est pas relu. Ne pas réutiliser un profil d'un autre produit. La PR brouillon #90 corrige l'envoi de `profileId` selon le type de credential ; elle n'est pas fusionnée et n'est pas redéployée ici.
4. Secrets présents par nom seulement (`MOLLIE_API_KEY`, `MOLLIE_PROFILE_ID`, `MOLLIE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `RELEASE_STATUS`, `ADMIN_PASSWORD_HASH`, et les autres listés dans le rapport de mission). Valeurs non lues. La présence d'un nom ne prouve pas qu'une clé Mollie ou Resend fonctionne.
5. `RELEASE_STATUS` est un secret. Le code sur `main` refuse le checkout avec HTTP 409 `delivery_unverified` tant que la valeur n'est pas exactement `confirmed`. La valeur effective en production n'est pas connue. Aucun POST avec e-mail n'a été envoyé.

## Routes API

Sondes GET/POST du 2026-11-06T14:15–14:16Z. Un HTTP 404 ici ne veut pas dire que l'API commerciale est absente.

| Requête | Résultat live | Lecture |
|---|---|---|
| `GET /` | **308** vers `https://bot-wow.com/` | plus de HTML marketing sur l'hôte API |
| `GET /bot-wow-gold`, `GET /de/` | **308** vers l'apex + le même chemin | landings legacy retirées du Worker en service |
| `GET /health` | **200** `{"status":"ok",...}` | contrôle de vie. Il n'y a pas de préfixe `/api` |
| `GET /api/health` | **404** `not_found` | route inexistante, CORS `https://bot-wow.com` |
| `GET /api/config` | **200** `product=bot-wow-lifetime`, `priceEur=20`, `currency=eur`, bitcoin address `null` | prix historique, pas une offre ouverte |
| `GET /api/checkout` | **404** | la route réelle est `POST /api/checkout` |
| `POST /api/checkout` corps `{}` | **400** `invalid_email` | la route existe. Aucun e-mail, aucun paiement créé |
| `GET /api/mollie-webhook` | **404** | la route réelle est `POST /api/mollie-webhook` |
| `GET /api/download` | **400** `missing_token` | la route existe et exige `?t=` |

Le même contrat est verrouillé sans réseau par `tests/api-route-map.test.mjs`.

## Livraison sandbox

Le chemin **production** webhook → PAID → licence → e-mail → téléchargement n'est pas prouvé. D1 `botwow-production`, SELECT seulement, `changed_db=false`, `rows_written=0`, 2026-11-06 :

| Groupe | Nombre | Montant (centimes) | Lignes `@example.com` |
|---|---|---|---|
| `bitcoin_manual` / `paid` | 5 | 10 000 | 5 |
| `bitcoin_manual` / `pending_payment` | 8 | 16 000 | 1 |
| `bitcoin_manual` / `rejected` | 1 | 2 000 | 1 |
| `mollie` / `failed` | 11 | 22 000 | 0 |

Payées hors domaine `example.com` : **0**. Montant : **0**. Licences actives : 5. Livraisons : **0**. Activations : **0**. Jetons de téléchargement : 5. Usages cumulés : 8. Webhooks enregistrés : 16.

Analytique `botwow-analytics`, `test=0` : `page_view` 2168 (dernier 2026-11-06T14:10:19Z), `journey_view` 799, `cta_click` 54 (dernier 2026-11-06T13:03:19Z), `checkout_requested` 29 (dernier 2026-11-04T02:47:00Z), `checkout_created` 6 et `checkout_failed` 6 (derniers le 2026-10-27), `checkout_start` 4, `planner_mode` 1. Aucune ligne `payment_confirmed`, `conversion`, `delivery_sent`, `delivery_failed` ou `activation`.

Le chemin **sandbox** est exécuté par `tests/delivery-replay.test.mjs` sur le Worker du dépôt, avec Mollie, Resend, D1 et R2 simulés : webhook `paid` → commande `paid` → une licence → un jeton → e-mail contenant ce jeton → `GET /api/download?t=` renvoie les octets de l'objet simulé sous le nom `casinobabe-fishing-1.2.0.zip`. Plafond, absence d'objet, clé invalide, expiration et révocation ne livrent pas d'octets et n'incrémentent pas le quota. Ce n'est pas un paiement réel.

## www

- 2026-11-06T14:15:35Z : `https://www.bot-wow.com/` et l'apex répondaient tous les deux **200**, même titre, canonical apex. Directement vérifié.
- Une Redirect Rule de zone, activée, `last_updated` **2026-11-06T14:16:56Z**, expression `(http.host eq "www.bot-wow.com")`, cible `concat("https://bot-wow.com", http.request.uri.path)`, 301, query conservée. Ce cycle ne l'a pas créée et ne la modifie pas.
- 2026-11-06T14:17:33Z : `www` répond **301** vers l'apex (`/`, `/buy`, `/fr/?utm=test`, et `http://www`). L'apex reste **200**. L'alias Pages `www.bot-wow.com` est toujours attaché : la règle de zone prime.
- `_redirects` ne peut pas faire cette redirection (limitation Pages, déjà mesurée). Ne pas ajouter une seconde redirection dans le dépôt tant que la règle de zone répond 301.

## Prochaine action

Une seule : décision du propriétaire sur le produit qui peut être vendu. Tant que la posture publique reste « projet historique, achat indisponible », le prochain travail utile n'est pas un CTA de paiement. Si une offre non automatisante est choisie, il faudra un profil Mollie BOT-WOW dédié, une valeur `RELEASE_STATUS` assumée, un paquet dont la provenance est acceptée, et un paiement de test vers une boîte contrôlée — chacun avec une autorisation explicite. La PR #90 reste le correctif de credential Mollie déjà ouvert ; ne pas en ouvrir un second.
