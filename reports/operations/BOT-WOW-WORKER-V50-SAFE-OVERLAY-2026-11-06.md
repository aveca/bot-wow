# BOT-WOW — baseline v50 et overlay non financier (2026-11-06)

## Baseline de rollback capturée

- Worker : `botwow-api`
- Version v50 : `c3dcc842-c422-42d3-9828-405f30d70b5f`
- Créée : `2026-10-27T07:46:28.277198Z`
- Déploiement v50 antérieur : `36227a4d-00e7-4c9f-94e0-0913b29049bc`, 100 %
- Source exacte récupérée par `GET /accounts/{account_id}/workers/scripts/botwow-api/content/v2`, partie multipart `index.js`
- Taille : 263 966 octets
- SHA-256 : `aa8cf2bdd3c890d1b72ec19af3c13cd15384ce901bbfc598e55e43513a806ba8`
- Copie durable : `reports/operations/baselines/botwow-api-v50-2026-10-27.index.js`
- Manifeste : `reports/operations/baselines/botwow-api-v50-2026-10-27.manifest.json`
- Branche baseline : `ops/worker-v50-baseline-20261106`

La version v50 reste dans l'historique Cloudflare. L'API de déploiement accepte un tableau `versions: [{version_id, percentage}]`, donc une restauration à 100 % de v50 est techniquement préparée. Aucun rollback n'a été exécuté.

## Incident observé pendant ce cycle : v51 est maintenant en production

Les lectures Cloudflare effectuées au début du cycle montraient v50 à 100 %. Une lecture ultérieure, toujours GET seule, a révélé :

- v51 : `1513595c-6a53-4575-b013-9979b696dce3`
- Créée : `2026-11-06T09:16:45.389985Z`
- Déploiement : `6aecab2d-6545-4c76-a6b3-cfb089372884`
- Mise à 100 % : `2026-11-06T09:16:54.384421Z`
- Annotation : `Deploy BOT-WOW PR #103 fulfillment reconciliation`
- Commit annoté : `8744a3e2bbaec449e16548f89117a05f0d7f20dc`

Je n'ai effectué aucune écriture Cloudflare dans ce cycle : uniquement GET. Le contenu courant récupéré via `content/v2` est exactement identique, octet pour octet, au `worker/index.js` de `main` (122 920 octets). Le déploiement v51 est donc extérieur aux opérations effectuées ici / concurrent.

## Vérification comparative v50 → v51

Comparaison exacte des fonctions extraites du bundle v50 sauvegardé et du contenu v51 :

| Fonction / zone | Identique ? |
|---|---:|
| `handleCheckout` | NON |
| `handleMollieWebhook` | NON |
| `handleBitcoinCheckout` | NON |
| `handleBitcoinPaidNotification` | NON |
| `createMolliePayment` / `fetchMolliePayment` / `mollieFetch` | NON |
| `handleAdminApproveOrder` / `handleAdminRejectOrder` | NON |
| `handleActivate` | NON |
| `handleResend` / `sendDeliveryEmail2` | NON |
| `sendDeliveryEmail` | présente en v50, absente en v51 |
| `verifyMollieSignature` | OUI |
| `PRICE_TABLE` | même valeur sémantique : 2 000 EUR |
| Routes API checkout / Mollie / Bitcoin | mêmes déclarations de routes |

Le garde `RELEASE_STATUS` reste présent dans `handleCheckout`, mais la valeur effective du secret est masquée et n'a pas été lue. Les noms/types des bindings et les variables non secrètes observées (D1, KV, R2, `ENVIRONMENT`, `MAIL_FROM`, `R2_OBJECT_KEY`) sont inchangés. Les valeurs des secrets ne sont pas vérifiables.

**Conséquence :** v51 n'est pas une simple suppression de helper. Il remplace plusieurs chemins de traitement paiement/webhook/fulfillment et le chemin de renvoi d'e-mail. Cela confirme que le déploiement global de `main` ne respectait pas le périmètre restreint demandé. Aucun paiement, webhook réel ou e-mail client n'a été simulé ou envoyé ici.

Autre point précis : en v50, `handleResend` appelle réellement `sendDeliveryEmail`. Le helper n'est donc pas mort dans le bundle live v50. Le supprimer sans modifier aussi `handleResend` casserait ce chemin ; modifier `handleResend` vers Resend changerait le comportement e-mail. L'overlay ne touche donc ni l'un ni l'autre.

## Overlay non financier préparé

Branche candidate : `ops/worker-v50-nonfinancial-overlay-20261106`

Fichier de patch maintenable : `worker/patches/botwow-api-v50-nonfinancial-overlay.json`

Il applique uniquement :
1. `handleDownload` : clé R2 configurée uniquement, existence vérifiée avant réservation, réservation atomique `count < max_count`, nom de fichier dérivé de l'objet réellement servi ;
2. suppression de l'ancien générateur landing et redirection 308 vers `https://bot-wow.com`.

Le test candidat reconstruit le Worker depuis le bundle v50, compare les 110 fonctions préservées, les déclarations `PRICE_TABLE`, `RATE_LIMITS`, `RELEASE_STATUS`, et toutes les déclarations de routes API. Il exécute aussi les suites paiement, sécurité et fulfillment sur le candidat avec fetch/D1/R2 simulés uniquement.

## Décision opérationnelle

- Ne pas redéployer `main` en bloc.
- Ne pas modifier les secrets, les bindings, les prix, le checkout, les webhooks ou les données D1/R2.
- Le rollback v50 est préparé et son endpoint Cloudflare est identifié, mais aucune mutation de production n'a été effectuée par ce cycle.
- L'overlay doit passer les tests réels sur son SHA exact avant toute décision. Les tests des chemins paiement v50 sont susceptibles de révéler les écarts d'idempotence déjà constatés ; toute incompatibilité bloque le déploiement.
- Les probes HTTP publiques n'ont pas pu être lues via l'outil Web (API inaccessible). Aucun test réel de paiement ou d'e-mail n'a été tenté.
