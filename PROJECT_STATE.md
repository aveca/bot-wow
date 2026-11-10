# BOT-WOW — état partagé

**Ajout 2026-11-10 — mesure de l'intention d'achat : bilan + défaut vivant.** Le
travail de l'agent Grok Bot du 27/10/2026 (trois CTA d'achat invisibles dans
`checkout_requested`) est terminé et prouvé localement — 18 suites `npm test` OK,
74 tests navigateur OK, stamp recalculé et vérifié — mais **non fusionnable** : la PR
#175 était basée sur un commit local jamais poussé (`d041665`, 150 commits derrière
`main`, `CONFLICTING`) et sa prémisse a disparu avec PR #172 (fusionnée
2026-11-10T00:18:55Z, achat toujours fermé). **Défaut vivant vérifié sur `main` :**
`nav-buy` — bouton doré « Purchase unavailable » de `index.html` / `fr/index.html` —
est encore mesuré comme `checkout_requested` alors que aucune boutique n'est ouverte,
et sept identifiants du sélecteur ne correspondent plus à aucun élément servi. **Non
corrigé ici : le scope `checkout-flag-draft` est actif.** Détail, preuves et règle
proposée : `reports/operations/2026-11-10-purchase-intent-measurement-findings.md`.
Prochaine action : le propriétaire du scope checkout tranche la définition d'une
« intention d'achat » (§4 du rapport), puis corrige le sélecteur.
**CI de `main` (VÉRIFIÉ DIRECTEMENT, 2026-11-10) :** `ui-quality` est rouge sur 38
tests e2e (458 passés) qui portent sur le formulaire de paiement, le texte des pages
d'achat et l'état « achat bloqué » : échecs reproductibles sur `origin/main` seul,
donc antérieurs à toute PR de documentation — scope `checkout`/`storefront` actif.

**Ajout 2026-11-10 — checkout rouvert dans le code, usage serveurs privés.** Branche `cursor/pixel-visual-redesign-0da7`, PR https://github.com/aveca/bot-wow/pull/172. Le Worker n’exige plus `RELEASE_STATUS=confirmed` pour `POST /api/checkout`. Le prix reste 20,00 EUR fixé serveur. Les pages d’accueil, d’achat, la FAQ, la fiche et les conditions disent : testé et destiné aux serveurs privés, pas aux serveurs officiels Blizzard. Vérifié localement avec Mollie simulé : un e-mail valide reçoit une `checkoutUrl`. Le Worker de production n’a pas été redéployé dans ce cycle.

**Relevé : 2026-11-07T16:00Z.** Les faits ci-dessous sont directement vérifiés dans ce cycle, sauf mention contraire. Les rapports antérieurs à cette heure ne sont pas une preuve.

**Ajout 2026-11-07T23:05Z — cycle « paquet reproductible »** : voir la section
« Paquet runtime — provenance et reproductibilité ». Mesures directes de ce
cycle ; rapport `reports/operations/2026-11-07-runtime-provenance-reproducible-package.md`.
Aucune écriture R2, aucun checkout rouvert, aucun prix modifié.

Dépôt : https://github.com/aveca/bot-wow
PR de ce relevé : https://github.com/aveca/bot-wow/pull/129 (branche `cursor/commercial-truth-agent-state-0086`)
Production : https://bot-wow.com/
Hôte canonique : `https://bot-wow.com` (confirmé par les `link rel="canonical"`, `CANONICAL_SITE` du Worker, et la Redirect Rule de zone).

## Verite courante

| Élément | Valeur | Preuve |
|---|---|---|
| Branche par défaut | `main` | `git` / GitHub |
| HEAD au début du cycle | `ba720c0fce69f4121d5c5b0aa4a168ceac931b70` | `git rev-parse HEAD` |
| CI de ce SHA | Validate `42210842281` SUCCESS ; Deploy GitHub Pages `42210842318` SUCCESS | GitHub Actions |
| Pages production | déploiement `e1fe25a3-9032-48c5-a5ba-b2433cfc41eb`, source `ba720c0fce69f4121d5c5b0aa4a168ceac931b70`, stage deploy SUCCESS, 2026-11-06T11:31:08Z | API Cloudflare, lecture seule |
| Worker `botwow-api` | déploiement `6ca34fa3-198a-44b8-a6ed-300e7db37f99`, 2026-11-06T14:48:17Z, 100 % sur la version `054cd158-4be2-42f8-92a6-ff9c4f059079`, annotation « Production rollout HEAD suit les lectures GET, main 017882a ». Source `worker/index.js` de `main` `017882a2ba29239801b4e0e6641a54872c4285a3`, SHA-256 `10891fbd347418fbeeb7fa0697345736e239ff28f27de96e43707bec8aebace7`, 123 472 octets. Les 18 bindings de production sont hérités par nom et type. | API Cloudflare + sondes HTTP 14:48:30Z |
| Écart Worker / `main` | Le Worker en service porte le routeur HEAD de `017882a`. Le déploiement précédent `6aecab2d-6545-4c76-a6b3-cfb089372884` (version `1513595c-6a53-4575-b013-9979b696dce3`) reste le retour arrière immédiat. L'identifiant Pages après le merge de la PR #129 n'a pas été relu dans ce déploiement Worker. | API Cloudflare + `git rev-parse origin/main` |

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

Le 2026-11-06T14:22Z, avant ce déploiement, `HEAD /` et `HEAD /health` répondaient **404** JSON. Le Worker déployé à 14:48:17Z est celui de `main` `017882a` (PR #129). Mesures directes à 14:48:30Z, User-Agent navigateur :

| Requête | Résultat |
|---|---|
| `GET /` | **308**, `location: https://bot-wow.com/`, corps 0 octet |
| `HEAD /` | **308**, `location: https://bot-wow.com/`, corps 0 octet |
| `GET /health` | **200**, `application/json`, 72 octets, `status=ok`, `version=1.0.0` |
| `HEAD /health` | **200**, `application/json`, corps 0 octet |
| `GET /api/config` | **200**, `priceEur=20`, `product=bot-wow-lifetime`, `currency=eur` |
| `HEAD /api/config` | **200**, `application/json`, corps 0 octet |

`/api/v1/*` reste introuvable : il n'y a pas d'API v1. `https://bot-wow.com/checkout` en **404** est attendu : il n'y a pas de page checkout.

`www` au 2026-11-06T14:22:37Z répond encore **301** vers l'apex. La branche `fix/www-alias-redirect-20261104` ne contient que le retrait des règles `_redirects` déjà inopérantes. Ne pas rouvrir ce chantier.

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

## Paquet runtime — provenance et reproductibilité (2026-11-07T23:05Z)

Directement vérifié dans ce cycle (builds locaux, comparaison octet par octet) :

| Constat | Valeur |
|---|---|
| Paquet **reproductible au bit** | SHA-256 `F8138F3C52EB2498114AD5BCD3988DB39A105BD4B757646BF1C2B7548DA79781`, 1 344 366 octets, 17 entrées ZIP, 16 entrées de manifeste — **identique** sur 4 builds (LF, LF, CRLF, LF restauré) |
| Empreinte canonique du **contenu** | `f69be8b34f74b2df68a177e0210b9bd73f6c99452c9279c291f2961173c90a53` (17 fichiers, 3 004 035 octets) — via `scripts/canonical-package-digest.mjs` |
| Build python d'origine | **non reproductible** : 2 builds de la même source → `D225E63F…` puis `9FC19FEE…` (champ `builtAt`) |
| Provenance inscrite | `aveca/Casinobabe` @ `257418c9a0c2…`, branche `feat/fishing-route-intelligence-v2`, `builtAt = 2026-10-22T02:18:01.000Z` |
| Intégrité manifeste ↔ contenu livré | `ok` — 0 écart, 0 fichier hors manifeste, 0 fichier déclaré manquant |
| Objet R2 **live** (`1C132F36…`, 1 387 543 o, 30 entrées) | **non reproductible** : 20 fichiers identiques à `257418c`, **6 différents**, **3 hors manifeste** (`Lancer-Casinobabe-Fishing-Assistant.bat`, `restaurer_previous.ps1`, `VERSION`) |
| Licence de la source | **aucune** (`LICENSE`/`COPYING`/`NOTICE` absents, `license: null`) → droits de redistribution **non documentés** |
| Périmètre du runtime | **pêche uniquement** — aucun runtime Gold/PvP/XP (`docs/historical-runtime-absence-20261106.md`) |

Deux conséquences directes pour la posture publique :

1. Le paquet « not verified » affiché sur les pages d'achat peut désormais être
   remplacé par une référence **reproductible et vérifiable** (`F8138F3C…`) —
   mais seulement si le propriétaire autorise l'écriture R2, et seulement en
   acceptant que les 2 exécutables hors manifeste disparaissent du paquet livré.
2. Tant que la **licence** n'est pas explicite, la redistribution n'est pas
   justifiée : le checkout reste fermé.

## www

- 2026-11-06T14:15:35Z : `https://www.bot-wow.com/` et l'apex répondaient tous les deux **200**, même titre, canonical apex. Directement vérifié.
- Une Redirect Rule de zone, activée, `last_updated` **2026-11-06T14:16:56Z**, expression `(http.host eq "www.bot-wow.com")`, cible `concat("https://bot-wow.com", http.request.uri.path)`, 301, query conservée. Ce cycle ne l'a pas créée et ne la modifie pas.
- 2026-11-06T14:17:33Z : `www` répond **301** vers l'apex (`/`, `/buy`, `/fr/?utm=test`, et `http://www`). L'apex reste **200**. L'alias Pages `www.bot-wow.com` est toujours attaché : la règle de zone prime.
- `_redirects` ne peut pas faire cette redirection (limitation Pages, déjà mesurée). Ne pas ajouter une seconde redirection dans le dépôt tant que la règle de zone répond 301.

## Qui travaille sur quoi

Relevé GitHub du 2026-11-08. Auteur des PR ouvertes récentes : `aveca` (Coco). Ne pas ouvrir un second chantier sur le même scope.

| Sujet | Où | Décision |
|---|---|---|
| État du déploiement Worker HEAD | #130, déjà fusionnée (`9499d5d`) | rien à rebaser |
| Absence du runtime Gold/PvP/XP | #128, déjà fusionnée (`f502029`) | rien à rebaser |
| Copie du paquet historique sur les pages d'achat | #132, déjà fusionnée (`a843c13`) | ne pas réécrire `buy.html` |
| Copie d'accueil archive EN/FR | #133, ouverte, CI verte | ne pas éditer `index.html` / `fr/index.html` |
| Diagnostic d'offre | #135, ouverte | ne pas choisir le produit à vendre ici |
| Preuve runtime et hash R2 | #124, **fusionnée** le 2026-11-07T15:59Z (base de `runtime/INTEGRATION.md`) | le scope `r2-provenance` reste verrouillé jusqu'au 2026-11-10 par `p0/runtime-integration-20261106` ; ce cycle prend un **scope distinct** (`runtime-package-reproducibility`), aucune écriture R2 |
| Dry-run multi-dépôt | #126 | le README de la PR dit de ne pas la fusionner ; elle contredit #124 sur la présence R2 |
| Honnêteté commerciale large | #123, en conflit | périmée par #132, #133 et le chantier juridique dédié |
| Overlay Worker v50 | #114, brouillon, en conflit | v50 n'a plus le trafic ; production = version `054cd158` |
| Pivot checkout d'octobre | #66, brouillon, en conflit | remplacé par une PR brouillon à flag, non fusionnée |
| `profileId` Mollie | #90, brouillon, mergeable | reste brouillon ; il ne manque que l'identifiant fourni par le propriétaire |
| Fiche produit PixelBuddy-style (#142) | branche `p0/storefront-product-sheet-20261107`, PR #154 ouverte (non mergée), CI verte sur SHA `8fcf6c5` | `product.html` + `fr/product.html` écrites ; `npm test` + `npm run validate` vertes ; QA navigateur faite ; preuve de provenance publiée ; preuve commentée sur issue #142 ; en attente de fusion (décision propriétaire) |

## Fiche produit — cycle #142 (2026-11-08)

Branche : `p0/storefront-product-sheet-20261107` (base `origin/main` @ `9a01a50`).
- Pages écrites : `product.html` (EN), `fr/product.html` (FR) — réutilisent les classes CSS existantes uniquement, aucun changement d'asset, l'estampille `?v=560cff9a` reste valide.
- Câblage : `sitemap.xml` (variantes EN/FR), `scripts/build-site.mjs` (FILES), `scripts/validate.mjs` (PUBLIC_PAGES) ; liens depuis `buy.html`, `fr/buy.html`, `features.html`, `fr/features.html` (corps + liste footer), CTA uniquement vers `./buy.html`, pas d'ancres `#offre`/`#buy`, pas de Mollie/Bitcoin sur les pages features.
- Garde-fou : `tests/storefront-product-sheet.test.mjs` (parité EN/FR, parité registre `assets/modules.json` titres/statuts/summaries, pilier "non distribué", compat `historical_unverified`, interdits `undetectable`/`anti-ban`/Retail, pas de formulaire/POST/email, licence + non-reproductibilité, provenance `F8138F3C…` / `1C132F36…`, liens + ancres, sitemap/build/validate, a11y de base) — câblé dans `npm test`.
- QA navigateur : serveurs locaux before/after, captures 1440×900 + 390×844, pas de débordement, pas de cible < 44 px introduite, contraste WCAG OK sur les éléments introduits, `prefers-reduced-motion` respecté, seule erreur console = `POST /api/track` 501 pré-existante au server Python.
- Résultats : `npm test` exit 0 (`FICHE PRODUIT : OK`), `npm run validate` exit 0, `git diff --check` exit 0, `CHECK_OPEN_PR_LOCKS=1 node scripts/check-agent-state.mjs` → `AGENT STATE : OK`.

Prochaine action (de ce cycle) : TERMINEE — branche commitee (`8fcf6c5`), poussee, PR #154 ouverte, CI verte sur le SHA exact, commentaire de preuve publie sur l'issue #142 avec le task_id `BOTWOW-PIXELBUDDY-STYLE-STOREFRONT-READINESS-20261107` (<https://github.com/aveca/bot-wow/issues/142#issuecomment-6719109423>). Le checkout reste fermé : pas de paiement, pas de Mollie, pas d'e-mail.

## Prochaine action (globale)

Le checkout public reste fermé. La vente n'attend plus une décision unique : les textes juridiques, la provenance R2 et le profil Mollie dédié avancent en parallèle, et la réouverture ne se fusionne qu'après ces trois-là. La PR #90 reste le seul correctif de credential Mollie.

**Cycle du 2026-11-07T23:05Z — une seule action pour le propriétaire :**
expliciter les **droits de redistribution** du runtime `aveca/Casinobabe`
(aucune licence dans la source : `B-licence`), puis décider — ou refuser — le
remplacement de l'artefact R2 live par le paquet reproductible `F8138F3C…`
(`B-r2-live`). Sans réponse écrite, aucune vente du runtime ne peut être
justifiée et le checkout reste fermé.
