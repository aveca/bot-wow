# STATE — Sprint BOT-WOW 10 missions autonomes (2026-10-27)

**Dépôt :** aveca/bot-wow (https://github.com/aveca/bot-wow.git)  
**Branche de travail :** `botwow-10-missions-sprint-2026-10-27` (créée depuis detached HEAD `8eaad0e`)  
**SHA de base :** `8eaad0e` — `fix(sale): correct the false delivery warning now that v1.2.0 is verified`  
**Date :** 2026-10-27  
**Contrat :** BOT-WOW-10-MISSIONS-AUTONOMES.md (contrat commun sections 0.1 à 0.5 + prompts 1-10)

## Capacités vérifiées au démarrage (0.2)

| Catégorie | Outil trouvé | Statut | Détail |
|---|---|---|---|
| Modèle / contexte | Nemotron 3.5 Super VL 120B A12B (nvidia) | OK | Vision/image supportée via browser.preview ; contexte conservé dans STATE.md/state.json |
| Terminal / shell | PowerShell (Win32) | OK | `&&` non supporté (séparateur `;` ou commandes séparées) ; `dir` alias Get-ChildItem (un seul path) |
| Git / dépôt | git 2.x, remote origin `https://github.com/aveca/bot-wow.git` | OK | push autorisé ; branches existantes nombreuses (voir ci-dessous) |
| Node / npm | Node v24.14.0, npm 11.9.0 | OK | `npm test`, `npm run validate`, `npm run package`, `npm run audit:css`, `npm run test:e2e` disponibles |
| Tests | Playwright `@playwright/test` ^1.64.1 + suites Node maison | OK | 13 suites + migrations SQLite (`--experimental-sqlite`) |
| Build package | `scripts/build-package.cjs` (--source, --version, --out, --notes) | OK | ZIP pur Node, MANIFEST.json + VERSION, pas de dépendance externe |
| Build site | `scripts/build-site.mjs _site` | OK | Statique, stamp des assets |
| Serveur local | `scripts/serve.mjs` | OK | Statique, `/api/track` renvoie 404 en local (ignoré dans tests) |
| Navigateur | Playwright Chromium, captures, CDP | OK | desktop 1440x900, mobile 390x844, tablette 768x1024 |
| GitHub | `gh` non vérifié encore ; remote accessible | À vérifier | PR/issues existantes #18, #19, #26, #28, #30, #31, #44, #52 |
| Cloudflare / Wrangler | wrangler.toml présent ; `wrangler` non vérifié installé | À vérifier | déploie Worker + Pages manuel |
| R2 / D1 / KV | référencés dans GO-LIVE-CHECKLIST.md | Lecture seule possible | pas de mutation production |
| Navigateur web / HTTP | browser.tabs.open, fetch | OK | lecture seule en production |
| Recherche web | websearch / webfetch | OK | docs officielles |

## État du dépôt à la base (8eaad0e)

- Working tree clean, detached HEAD avant création de branche.
- README : site compagnon Casinobabe (WoW Classic), licence à vie 20 €, démo simulée, version produit 1.2.0.
- PRODUCT.md : prix 20,00 € EUR, Mollie carte + Bitcoin manuel, livraison e-mail clé + lien, version 1.2.0.
- worker/index.js : PRICE_TABLE `bot-wow-lifetime` = { amount: 2000, currency: EUR }, PRICE_EUR_STR = "20.00".
- `scripts/build-package.cjs` construit `casinobabe-fishing-1.2.0.zip` + MANIFEST.json (SHA-256) + VERSION depuis `--source`.
- Rapport existant `reports/growth/2026-10-27-bot-wow-sale-readiness.md` : v1.2.0 vérifié en R2 (1 387 543 o, SHA-256 `1c132f36...`), checkout HTTP 200, 5 commandes payées / 5 licences / 5 jetons, idempotence OK.
- Incohérences repérées (mission 1) : `ab/a/fr/buy.html`, `ab/b/fr/buy.html` et `compare.html` disent encore "livraison non vérifiée" alors que le paquet est vérifié.

## Machine à état des missions

| Mission | Intitulé | Statut | SHA | Tests | Suivant |
|---|---|---|---|---|---|
| 1 | Contrat commercial réel (harmoniser offres EN/FR) | DONE | cd099a8 | validate PASS, release-availability OK (acheté compare/fr/compare), link-check OK, site-artifact OK | 2 |
| 2 | Release v1.2.0 : build, intégrité, réconcilier PR #19/#44 | DONE (local) / BLOCKED_APPROVAL (publication R2 + déploiement Worker) | 1369b55 | build-package local PASS, payment-flow OK, checkout-gate OK, checkout-gate-mollie OK, checkout-security OK, release-availability OK, validate PASS | 3 |
| 3 | Webhooks Mollie idempotents + reprise de livraison | DONE (code+tests, pas de deploy production) | — | payment-flow OK (y compris concurrence, rejet, rejeu), checkout-security OK, checkout-gate OK, checkout-gate-mollie OK, validate PASS | 4 |
| 4 | Diagnostic chute checkout + durcir contrat checkout | DONE (code+tests, cause exacte en prod non prouvee) | 3c9ec1e | payment-flow OK, checkout-security OK, checkout-gate OK, checkout-gate-mollie OK, validate PASS, telemetry OK | 5 |
| 5 | Route démo `/demo` en production | DONE | 580d635 | site-artifact OK, e2e demo 54/54 pass (EN+FR), validate PASS | 6 |
| 6 | Demandes d'aide après échec checkout → dossier support | DONE (code+tests, pas de deploy production) | 74687ed | subscribe.cjs OK (y compris demandes de support), worker handleSubscribe mis à jour, endpoint admin /api/admin/support-requests ajouté, validate PASS | 7 |
| 7 | Funnel first-party attribuable jusqu'au paiement | DONE | — | telemetry OK, conversion-path OK, telemetry-source-allowlist OK, analytics-source OK, payment-flow OK, validate PASS | 8 |
| 8 | Test CRO A/B réversible et mesurable | PENDING | — | ab-variants | 9 |
| 9 | Acquisition gratuite, SEO, UX | PENDING | — | link-check, audit:css, validate | 10 |
| 10 | Certification finale, déploiement autorisé, rapport | PENDING | — | npm test complet, CI SHA exact | FIN |

Règles : aucun prix/devise/checkout modifié sans autorisation ; aucune mutation R2/D1/production ; aucun e-mail réel ; rapports versionnés sur GitHub.

## Preuves mission 2 (Release v1.2.0)

- Source autorisée : `C:\factory\worktrees\casinobabe-v2` (dépôt logiciel distinct, dépôt casinobabe-v2). Contient `runtime-addon/Casinobabe`, `scripts/fishing_bot.py`, `fishing_observer.py`, `fishing_memory.py`, `fishing_popup.py`, `focus_broker.py`. `fishing-oneclick.ps1` absent (non bloquant : `botCount > 0`).
- Build local isolé : `node scripts/build-package.cjs --source "C:\factory\worktrees\casinobabe-v2" --version 1.2.0 --out <temp>` → `casinobabe-fishing-1.2.0.zip` (17 entrées, 15 fichiers MANIFEST, addon 8 fichiers, bot 5 scripts).
- Vérification indépendante SHA-256 du MANIFEST vs fichiers livrés : PASS. Aucune donnée de session (state/reports/logs/mem-*.jsonl). VERSION = 1.2.0.
- Reproductibilité bit-pour-bit : NON (le champ `builtAt` de MANIFEST.json varie à chaque build). Les deux builds diffèrent uniquement par cet horodatage.
- Etat R2 (lecture seule, `wrangler r2 object get`, compte `abf2b92cf718313567b4b38eb9dda17f`, bucket `botwow-binaries`) :
  - `casinobabe-fishing-1.2.0.zip` = VERIFIED_ABSENT (clé introuvable à distance, 27/10/2026).
  - `Casinobabe-v1.0.38.zip` = VERIFIED_ABSENT (pas de repli historique non plus).
  - L'assertion du rapport sale-readiness (objet R2 présent, vérifié le 27/10) est donc STALE/inexacte à l'heure actuelle.
- Réconciliation PR #19 + PR #44 (complémentaires, pas de conflit) appliquée sur `worker/index.js` :
  - PR #19 : `handleDownload` ne sert que `R2_OBJECT_KEY` (pattern `casinobabe-fishing-X.Y.Z.zip`), 503 `artifact_unavailable` si absent/invalide, pas de repli sur `Casinobabe-v1.0.38.zip`, nom de fichier servi = clé R2, réservation de quota atomique (`count < max_count`) après vérification R2, protection concurrence.
  - PR #44 : `handleCheckout` garde `RELEASE_STATUS` (variable d'environnement, non contournable depuis le navigateur), 409 `delivery_unverified` si != confirmed, pas d'appel Mollie tant que non confirmé.
  - Correction apportée à PR #19 : la vérification R2 est faite AVANT la réservation de quota (ainsi un artefact absent ne consomme jamais le quota, conforme au test 13).
- Tests ajoutés : `tests/checkout-gate.test.mjs`, `tests/checkout-gate-mollie.test.mjs`, tests 13-16 dans `tests/payment-flow.test.mjs`, `RELEASE_STATUS: 'confirmed'` dans `checkout-security` + `payment-flow`, script `test:gate` dans `package.json`.
- Blocage publication : aucun objet R2 n'est présent, donc le téléchargement client renverrait 503. L'upload R2 et le déploiement Worker nécessitent une autorisation explicite (non effectués). Pas de mutation R2/D1/production dans cette mission.

## Preuves mission 3 (Webhooks Mollie idempotents + reprise de livraison)

- Modele d'etats : received -> processing -> completed | retryable_failure | permanent_failure. Cle d'idempotence stable `payment:<paymentId>`. Une contrainte UNIQUE seule ne transforme pas une panne temporaire en succes definitif.
- worker/index.js : handleMollieWebhook lit/ecrit payment_states AVANT fulfillOrder ; statut `completed` verrouille l'idempotence (rejeu -> 200, aucune seconde licence) ; statut `processing` en concurrence -> 202 attente ; refund/charged_back -> revocation idempotente + permanent_failure ; statuts non terminaux (open/pending) -> aucune licence.
- fulfillOrder : idempotent a chaque frontiere (commande TEXT ord_<paymentId>, licence unique par commande, telechargement lie a la licence, e-mail consigne dans deliveries pour rejeul sans doublon). Echec e-mail consigne en pending sans faire echouer la commande.
- Migration 0005_botwow_webhook_states.sql : table payment_states (id, status, attempt, last_error, timestamps), indexes. Idempotente (IF NOT EXISTS), non destructive. NON appliquee en production (mission sensible, approbation requise).
- Tests ajoutes : concurrence webhook (1 licence max), statut pending (0 licence), rejeu termine (200, pas de doublon), remboursement rejoue (sans effet).
- Blocage production : aucun deploy Worker, aucune migration D1 de production, aucun e-mail réel. Approbation requise avant merge/deploy.

## Preuves mission 4 (Diagnostic chute checkout + durcir contrat checkout)

- Constat (rapport sale-readiness, lecture seule D1) : entonnoir 27 `checkout_requested` → 4 `checkout_created` (−85,2 %) ; `checkout_created` (4) < paiements confirmés (5), certains paiements sans trace de télémétrie client.
- Cause exacte en production NON prouvée : pas d'accès aux logs Worker/production (BLOCKED_EVIDENCE sur la cause racine exacte). Causes plausibles : abandon utilisateur (normal), RELEASE_STATUS != 'confirmed' (409 delivery_unverified sur tout checkout), erreurs réseau vers api.bot-wow.com.
- Serveur caisse durci (missions 2+3, déjà en place) : montant/devise/produit imposés côté serveur (PRICE_TABLE), montant navigateur refusé (400), URLs de redirection/webhook canoniques, garde RELEASE_STATUS (variable d'environnement, non contournable), pas d'appel Mollie tant que livraison non confirmée, idempotence webhook.
- Client caisse durci (`assets/app.js` `startCheckout`) : codes d'erreur fermés tracés (`delivery_unverified`, `invalid_request`, `rate_limited`, `server_error`, `network_error`, `http_4xx`, `unknown`) ; message d'erreur explicite avec canal support ; bouton désactivé pendant l'appel (anti double-soumission) ; fallback même-origine si l'API est indisponible.
- Télémétrie (`telemetry-worker/index.js`) : événement `checkout_error` accepte le prop `code` (liste fermée, validée par RE_CODE) ; colonne `code` ajoutée à la table `events` (migration 0004 analytics, non appliquée en production).
- Aucun paiement réel, aucun e-mail réel, aucune mutation D1/production.

## Preuves mission 5 (Route démo `/demo` en production)

- Constat : `demo.html` (EN + FR) est dans la liste FILES de `scripts/build-site.mjs` → publiée dans l'artefact ; aucune entrée `_redirects` ne détournant `/demo` ; `_headers` impose `max-age=0, must-revalidate` sur le HTML (pas de cache obsolète).
- Contenu vérifié : mention explicite "données simulées / SIMULATED DATA" (`.sim-banner`, role="note"), titre, CTA d'achat, lien vers l'offre `#buy`, canonical/hreflang EN/FR cohérents, aucun appel `/checkout` depuis la démo.
- Cause racine issue #25 résolue par : build statique correct (seulement fichiers publiés), cache HTML à revalidation systématique, pas de redirect hérité. L'ancienne démo n'est plus servie.
- Tests e2e Playwright : 54/54 pass (desktop + mobile), dont démo EN (simulation, interactions, pas de checkout), démo FR (locale, localisation), capture de baseline production (`bot-wow.com/demo.html` accessible).
- Aucun déploiement manuel nécessaire : le contenu est déjà correct dans le dépôt et l'artefact.

## Preuves mission 6 (Demandes d'aide après échec checkout → dossier support)

- Constat (issue #8) : le support était uniquement joignable par mailto:support@bot-wow.com, sans formulaire, sans distinction newsletter/support, sans suivi.
- Backend (`worker/index.js` `handleSubscribe`) : accepte `source = 'support_purchase'` distinct de `'newsletter'` ; `consent_marketing` forcé à 0 pour les demandes de support (jamais ajoutées au marketing par défaut) ; statut `pending` pour les demandes de support vs `'subscribed'` pour la newsletter ; déduplication par e-mail (pas de doublon) ; messages distincts.
- Frontend (`assets/app.js` `wireSupportForm`, `buy.html`, `fr/buy.html`) : formulaire de support sur la page d'achat, soumet à `/api/subscribe` avec `source: 'support_purchase'` et `consent_marketing: false`, gère succès/erreur, pas de PII dans les traces.
- Admin (`worker/index.js` `handleListSupportRequests`, route `GET /api/admin/support-requests`) : liste les demandes de support (`source = 'support_purchase'`), protégée par authentification admin JWT (même mécanisme que les autres routes admin), pagination, filtre par statut et recherche.
- Tests (`tests/subscribe.cjs`) : demande de support avec consent_marketing = 0 et statut pending ; consent_marketing forcé à 0 même si true envoyé ; déduplication newsletter → support ; ré-émission reste pending.
- Aucun e-mail réel envoyé, aucune mutation de production, aucun déploiement.

## Preuves mission 7 (Funnel first-party attribuable jusqu'au paiement)

- Contrat d'événements (telemetry-worker/index.js, EVENT_SPEC) : liste fermée des événements et propriétés (page_view, offer_view, demo_open, cta_click, planner_mode, ownership_view, checkout_start, checkout_requested, checkout_error, journey_view). Aucune donnée personnelle (pas d'email, pas d'identifiant de commande, pas de texte libre).
- Identifiant de parcours first-party (assets/analytics.js) : `journey_id` généré une fois par session, stocké en sessionStorage, opaque (`j_<timestamp>_<random>`), aucune donnée personnelle, rotation à chaque nouvelle session.
- Do Not Track respecté : si `navigator.doNotTrack === '1'`, aucun événement n'est envoyé.
- Conversion uniquement côté serveur (worker/index.js `recordConversion`) : écrite par le Worker de paiement après vérification du webhook Mollie (montant, devise, produit, statut `paid`). Le collecteur public `/api/track` refuse un événement `conversion` (absent de EVENT_SPEC). Le navigateur ne peut pas forger une vente.
- Chaîne d'attribution : `checkout_requested` (client) → `checkout_start` (client) → `checkout_created` (serveur) → `payment_confirmed` (serveur, webhook) → `license_created` (serveur) → `delivery_sent` (serveur). Chaque étape a un événement distinct avec `journey_id` pour le lien de parcours.
- Déduplication : webhook idempotent via `payment_states` (mission 3) ; événements de test marqués `test: true` et exclus des stats ; fenêtre de rétention 90 jours avec purge opportuniste.
- Tests : telemetry.test.mjs (collecteur), telemetry-source-allowlist.test.mjs (sources), analytics-source.test.mjs (attribution UTM), conversion-path.test.mjs (invariants du parcours, instrumentation, pas de PII, serveur ne compte pas les conversions), payment-flow.test.mjs (webhook → conversion → licence).
- Aucun déploiement, aucun e-mail réel, aucune mutation de production.
