# BOT-WOW — état partagé

**Ajout 2026-11-13 — pages d’achat EN/FR/ES alignées.** `/buy.html`, `/fr/buy.html` et `/es/buy.html` ouvrent les Payment Links LIVE Planner et Studio. Les textes « rien en vente » et la liste d’attente sont retirés en EN, FR et ES. Le webhook refuse une signature absente ou invalide avec 400. Le propriétaire redéploie le Worker. Branche `cursor/live-offer-copy-bd31`.

**Ajout 2026-11-13 — liens LIVE enregistrés, Worker déployé par le propriétaire après la fusion de la PR #200 (`ca9e08c`).** Planner 9,00 EUR : https://buy.stripe.com/4gM4gB62W4749MO78C63K01 (`plink_1UbIoJRnrMmUAHDtGYXfbz3m`, `price_1UbIoARnrMmUAHDtUOiNMeir`, `price_key=planner`). Studio 29,00 EUR : https://buy.stripe.com/eVqdRb8b4dHE6AC50u63K02 (`plink_1UbIoKRnrMmUAHDtQnO7HFRk`, `price_1UbIoBRnrMmUAHDtY4JprzB1`, `price_key=studio`). Les URL sont dans `assets/payment-links.js`. Le webhook lit `price_key` sur la session, puis sur `payment_intent.metadata`, puis déduit l’offre du `payment_link`. Le lien historique n’a pas été modifié. Le Worker n’est pas déployé : tant qu’il ne l’est pas, un paiement LIVE n’envoie pas la clé. Catalogue : `reports/operations/2026-11-13-stripe-catalog.md`. PR https://github.com/aveca/bot-wow/pull/200.

**Ajout 2026-11-13 — compagnon web conforme, deux paiements uniques.** Le client qui capture la fenêtre et envoie des clics n’est plus promu (EULA Blizzard §1.C.2). Le site vend BOT-WOW Planner à 9,00 EUR et BOT-WOW Studio à 29,00 EUR, une fois. Le webhook signé (`STRIPE_WEBHOOK_SECRET` seul) accorde la clé et l’e-mail ; un remboursement ou un litige révoque. Aucune clé secrète Stripe n’est requise. Le Payment Link historique n’a pas été modifié dans Stripe et le site le refuse.

**Ajout 2026-11-12 — licence Payment Link.** `checkout.session.completed` délivre aussi une licence si la session vient du Payment Link `plink_1UaG0TRnrMmUAHDtXMyagAIa`, du prix `price_1UaG0TRnrMmUAHDtO3r6xVq4`, ou de `metadata.product` `BOT-WOW`. L'e-mail est lu dans `metadata.email`, puis `customer_details.email`, puis `customer_email`. Les boutons publics restent le Payment Link : les pages n'ont pas de formulaire `/api/checkout`. Le Worker n'est pas déployé par cette correction.

**Ajout 2026-11-12 — vitrine multilingue.** Anglais reste à `/`. Sous-chemins `/fr/`, `/de/`, `/es/`, `/pt-br/`, `/ru/`, `/it/`, `/pl/` pour l'accueil, l'achat, les fonctions, la fiche, la FAQ et les pages légales. `hreflang` + `x-default` vers l'anglais, sitemap avec `xhtml:link`, sélecteur de langue, bannière de suggestion sans redirection. Le lien Stripe `https://buy.stripe.com/00wbJ3gHAdHEf78fF863K00` reste sur chaque accueil et chaque page d'achat. `worker/index.js` envoie `locale` Stripe (`pt` et `pt-br` → `pt-BR`). Le Worker n'est pas déployé.

**Ajout 2026-11-12 — achat ouvert.** Le lien Stripe `https://buy.stripe.com/00wbJ3gHAdHEf78fF863K00` reste le bouton public « Reserve beta — €20 ». `POST /api/checkout` crée aussi une Checkout Session Stripe et n'est plus bloqué par `RELEASE_STATUS`. Le Worker n'est pas déployé par cette fusion.

**Ajout 2026-11-11 — correction CI de la PR #195 (cause racine unique pour deux checks) :** `validate` et `ui-quality` échouaient sur **la même** assertion de `tests/agent-state-locks.test.mjs` (`AssertionError [ERR_ASSERTION]: l'ancien algorithme (scope seul) aurait signale des conflits — 1`). Cause racine prouvée : la section 6 du test lisait `Date.now()` (3 fois) et exigeait `legacyConflicts >= 5`, c'est-à-dire un seuil codé en dur, égal au nombre de verrous actifs **du jour**. La libération des 6 verrous expirés (commit `41516ae`) a fait tomber ce nombre à 1 : c'est le **test** qui a cassé, pas le code de production. Aucun contrôle n'a été désactivé, aucun autre test n'a été touché, aucun seuil n'a été supprimé.

Correction (commit `2c5cc166a524efe2b492c092bd9ee815a32bb4a0`, branche `factory/corrections-20261111`) : le scénario d'identité est construit par `buildIdentityScenario()` à partir d'une ligne **réelle** de `agents/locks.md`, normalisée en verrou actif non expiré, avec l'instant de référence figé `NOW` (2026-11-07T12:00:00Z) que l'en-tête du fichier prévoyait déjà. L'invariant prouvé est « l'ancien algorithme scope-seul produit **au moins un** faux positif » (`>= 1`), pas « il y en a 5 ». Contrôles cumulés : **36 → 43**.

**Bombe à retardement neutralisée au passage** : l'ancien test exigeait aussi `assert.ok(firstActive)`, c'est-à-dire la présence d'un verrou actif non expiré dans le fichier réel. `p0-payment-prep` expire le 2026-11-12 → le CI serait retombé le lendemain, avec la même cause racine. Preuve par bac à sable isolé (3 états du fichier de verrous × ancien test de `HEAD` vs nouveau test) : **ancien test FAIL 3/3, nouveau test PASS 3/3**. Test de mutation : réintroduire `Date.now()` → FAIL (garde-fou de la section 8) ; réintroduire le seuil codé en dur `>= 5` → FAIL.

Fichiers modifiés : `tests/agent-state-locks.test.mjs` seul (hors documents). Aucun code de production, aucun prix, aucun checkout, aucun secret, aucun binding, aucun déploiement, aucune donnée supprimée, aucune redistribution. Verrou `p0-payment-prep` non repris. PR #195 toujours ouverte, non mergée.

**CI VALIDÉE sur le SHA exact `9f94ffa39d865530b1ed488c35a3638ac2c6e022`** (commit de publication des registres, qui contient le correctif `2c5cc166a524efe2b492c092bd9ee815a32bb4a0`) : `validate` **success** (run `43065917581`, 25 s), `ui-quality` **success** (run `43065917655`, 4 min 44 s ; log : `AGENT STATE LOCKS: OK (43 contrôles)`), `package-candidate` **pass** (17 s), GitGuardian **pass**. Preuve complète et note anti-récurrence publiées sur la PR : https://github.com/aveca/bot-wow/pull/195#issuecomment-6802518356

**Ajout 2026-11-11 — décision propriétaire de réservation bêta :** le Payment Link Stripe LIVE existant est autorisé pour une réservation unique de 20 €, remboursable intégralement si BOT-WOW ne peut pas être livré. Ce n'est ni une licence activée ni un téléchargement immédiat ; livraison manuelle uniquement après validation finale. PR #188 fusionnée, déploiement Cloudflare Pages production confirmé sur `bot-wow.com` et `www.bot-wow.com` (commit `77e354b`). Au contrôle Stripe du 11/11 : 0 paiement confirmé, 6 sessions Checkout ouvertes et non payées, sans e-mail client. Les événements D1 sur 24 h : 49 vues accueil, 49 démos, 11 vues des pages d'achat, 0 clic CTA enregistré. Le profil fiscal Stripe est `pending` et la description de l'activité reste à aligner ; ne pas inventer l'identité légale du vendeur.

**Ajout 2026-11-11 — libération des 6 verrous expirés + PR #195 :** Les 6 verrous `agents/locks.md` dont `expires` = 2026-11-10T00:00:00Z sont passés en `done` (legal-draft, r2-provenance, mollie-prep, checkout-flag, homepage-copy, package-reproducibility). Même mise à jour dans `agents/tasks.md`. Commit `41516ae` sur branche `factory/corrections-20261111` (base `origin/main` `2cc3d58`), poussé sur origin. PR #195 ouverte (`factory/corrections-20261111` → `main`), état OPEN, mergeable : https://github.com/aveca/bot-wow/pull/195. Aucun scope actif n'est repris. Aucun code, secret, binding ou déploiement modifié. `node scripts/check-agent-state.mjs` → AGENT STATE : OK.

**Ajout 2026-11-11 — mission P0 « packaging BOT-WOW livrable » : les trois PR du paquet sont fusionnées, `main` est cohérent, couverture de livraison restituée, nouveau paquet réel mesuré.**
Ordre de fusion imposé par la cohérence documentaire : **#179 (code + vérificateur client) AVANT #185 (guide)**, car le guide documente `package/verify-package.py` qui n'existait pas avant #179.

| PR | Objet | Fusion squash dans `main` | Horodatage UTC |
|---|---|---|---|
| [#179](https://github.com/aveca/bot-wow/pull/179) | Vérificateur d'intégrité côté client (`distribution/verify-package.py`, embarqué dans `package/`), SHA-256, inventaire ZIP, refus des chemins dangereux et des symlinks, refus d'un paquet QA par défaut | `aa02ad3caf8423b1ab32b1392b07aa3e82c377b0` | 2026-11-11T00:39:36Z |
| [#185](https://github.com/aveca/bot-wow/pull/185) | Guide d'installation réconcilié (conflit résolu sur `distribution/INSTALL.md` après #179) | `4a3b657a8d059abc378762cd9f87daa5de30e93c` | 2026-11-11T00:51:39Z |
| [#186](https://github.com/aveca/bot-wow/pull/186) | Couverture de livraison réelle restituée (nouvelle branche depuis `main`, jamais la branche fermée) | `0774272320a0f811d7cba56cd8def120497d7f6d` | 2026-11-11T01:05:37Z |

**PR #182** : fermée sans fusion par le propriétaire. Son contenu utile est repris par #184 (code), #185 (documents) et #179 (vérificateur). Sa fermeture avait fait disparaître de `main` deux protections qui n'existaient nulle part ailleurs ; elles sont restituées par la PR #186, sur une branche **neuve créée depuis `main`** (`p0/package-delivery-coverage-20261111`), conformément à la consigne de ne jamais réutiliser `p0/package-whitelist-toc-20261110`.

**Nouvelle mesure du paquet réel (build depuis `main` final `0774272`)** : deux builds indépendants sur la source épinglée `aveca/Casinobabe@b625ccec5fd61225dd92c5c54fa8721da76c3876` donnent un ZIP **byte-identique**, SHA-256 `7d48c2496c83bbdf12e2beac6aab42d5ba66b7fb3bb65725c746b1c10d89f335`, 180 805 octets, 26 entrées ZIP / 25 au manifeste (2 fichiers liste blanche + TOC générée + 16 scripts Python + 3 documents + `verify-package.py` + `config.example.json` + `requirements.txt` + `VERSION` + `MANIFEST.json`), 3 fichiers du dossier addon source déclarés exclus, provenance vérifiée contre le checkout réel.
**Pourquoi cette mesure diffère de `14beafc7…` (176 903 o)** : le builder livré dans `main` embarque désormais `package/verify-package.py` (apporté par #179) et le déclare au manifeste. L'archive ne peut donc plus être identique à l'ancienne. Aucune réécriture d'historique : la nouvelle valeur est publiée telle quelle, l'ancienne reste dans les rapports datés.

**Vérifications réelles du nouveau paquet, toutes vertes** :
- `scripts/verify-package-archive.cjs` → `PACKAGE ARCHIVE: PASS` (version `1.2.2-rc.1`, source `aveca/Casinobabe@b625ccec…`, 26 entrées, 25 fichiers manifeste, 180 805 o, SHA-256 `7d48c249…`).
- `scripts/verify-bot-files-closure.mjs` → PASS (16 scripts = fermeture BFS = `BOT_FILES`).
- Extraction réelle puis `py -3 package/verify-package.py --allow-qa` → « PACKAGE INTEGRITY OK — QA ONLY; not authorized for customer distribution (unresolved rights: 2) ». Sans `--allow-qa` → **refus** (exit 1) : `QA-only package; refusing installation without --allow-qa`.
- Droits du candidat : `mode = qa`, `eligible = false`, provenance exacte, `unresolvedComponents = ["Code original Casinobabe","Police DejaVu Sans"]`.
- `--release` contre la vraie source épinglée : **REFUSÉ** (exit 1) — « release refusée : 2 exigence(s) non satisfaite(s) (Code original Casinobabe, Police DejaVu Sans) ; aucun artefact existant ne sera supprimé et aucune archive ne sera produite ». Sentinelles préservées (`KEEP PACKAGE`, ZIP de 8 o intact).
- Inventaire ZIP contrôlé : aucun `Casinobabe.lua`, aucun `LibStub`, aucun `LibDBIcon`, aucun `.ttf`, aucun `.tga`.

**Blocages inchangés (aucun ouvert, aucune protection supprimée)** :
- Les conditions de licence client ne sont pas publiées : `--release` échoue toujours sur « Code original Casinobabe ». C'est le comportement fail-closed voulu ; seulement un build **QA** est possible.
- **Non vérifié** : exécution dans un véritable client WoW autorisé. Les tests Lua 5.1 + mock WoW prouvent le chargement réel des octets, pas l'activation côté client Blizzard.

Rapport détaillé : `reports/operations/2026-11-11-package-merge-and-delivery-restitution.md`.

**Ajout 2026-11-11 — audit sessions sargagame :** Heartbeat `scripts/automation/data/factory-heartbeat-watch-seen.json` périmé (`sig: stale|2026-08-05`, `at: 2026-08-05T02:41:41.633Z`). Événement autopilot P1 `.autopilot/events/AUTOPILOT_FACTORY_EVENT-agent-handoff-claim-status-line-not-found.json` (2026-10-07T11:50:34Z) : claim task échouée, exécution/PR sautée. 4 autres événements P1 en octobre 2026 (automerge-default-assertion 2026-10-03, paid-funnel-e2e 2026-10-05, smoke-token-verification 2026-10-07, support-inbox-imap-auth 2026-10-07 avec human_gate=true). NEXT_SESSION.md sargagame-main daté 2026-07-30 (périmé) ; NEXT_SESSION.md sargagame-seo1408 daté 2026-11-11 (à jour). Aucun fichier de registre/heartbeat/claim OpenCode dans les deux worktrees sargagame. `.ai/current_state.md` dernière mise à jour 2026-11-04 (SLA satellite 900 min).

**Ajout 2026-11-11 — priorisation travail revenus (évaluation en lecture seule, aucune modification autorisée) :** BOT-WOW : 0 paiement confirmé au contrôle Stripe LIVE 2026-11-11, 6 sessions Checkout ouvertes/non payées sans e-mail client, 0 clic CTA sur 24h (B-revenue). Sargagame : money-path Mollie active (caisse EUR MQ/GP + USD florida/puntacana/rivieramaya), Stripe legacy lecture seule ; P0-001 `webhook_secret` commenté dans `mollie-config.php` (fail-open) ; P2-001/002/03 in_progress ; 6 régions (MQ, GP, florida, puntacana, rivieramaya live ; barbados préparé non live avec résidus Stripe à purger). Verrou `p0-payment-prep` active jusqu'au 2026-11-12 — ce scope n'est pas repris.

**Ajout 2026-11-11 — cycle bridge autopilot + correction CI ui-quality :**

- **Bridge multi-dépôt (P1 — consommation de .ai/autopilot/queue.json)** : branche `bridge-clean` créée depuis `main` (dc1fb69), 3 commits uniquement bridge (0cf5168, 9b3ec95, afa5852), poussée sur origin. PR #194 ouverte (`bridge-clean` → `main`, https://github.com/aveca/bot-wow/pull/194), remplaçant l'ancienne PR #193 sur `bridge-queue-consumption` (fermée). Fonctionnalités : verrou interprocessus (fichier `.ai/autopilot/queue.lock`, ouverture `wx` exclusive, révocation orphelin par PID mort/TTL), `--consume` persiste le claim via `saveQueue` avant retour, `--watch` polling continu + exécution + ACK auto + publication sur issue GitHub, blocage humanGate/moneyPath. Tests : 17 nouveaux checks, 0 échec. E2E CLI réel vérifié : claim persisté sur disque, `--ack` complète la tâche, 2 consommateurs concurrents réclament des tâches distinctes, reprise après crash (verrou orphelin récupéré). Aucun merge ni déploiement sans autorisation explicite. Ancienne branche `bridge-queue-consumption` abandonnée (héritait de `cro-conversion-fixes` / PR #192). Aucune écriture R2, aucun secret modifié, aucun déploiement effectué.

- **PR #192 — échec Chromium ui-quality** : cause racine prouvée par les logs du check-run 130590490177 (runner `ubuntu-24.04`, `Temporary failure resolving 'azure.archive.ubuntu.com'`, puis `E: Failed to fetch` sur security.ubuntu.com). L'option `--with-deps` de `npx playwright install --with-deps chromium` déclenche `apt-get` qui échoue sur ce DNS mirror. Ce n'est pas un problème de code. Correctif : `npx playwright install chromium` (sans `--with-deps`), commit `1802d69` sur `cro-conversion-fixes`, poussé sur origin. CI relancée sur `1802d69` : tous les checks verts — `validate`, `package-candidate`, `GitGuardian Security Checks`, `ui-quality` (tous `success`). Logs : `C:\Users\user\AppData\Local\Temp\opencode\pr192-job-logs.txt` (445 KB, UTF-16).

**Ajout 2026-11-10 — issue factory-control#82 : candidat Fishing Assistant minimal (liste blanche + tests installation/activation).**
Branche `factory/issue82-mwaoy17i`, PR https://github.com/aveca/bot-wow/pull/184 (**revue uniquement — aucune fusion, aucun déploiement**).
Source runtime lue SEULE sur le commit épinglé `aveca/Casinababe@b625ccec5fd61225dd92c5c54fa8721da76c3876` (lecture seule, jamais modifiée).
Fermeture vérifiée sur ces octets : Lua — 20 appels `G()` du module pêche = API WoW uniquement, aucun symbole du core casino, ordre TOC `[LiveErrorCapture.lua, CasinobabeFishing.lua]` nécessaire (chaînage des gestionnaires d'erreurs) ; Python — fermeture BFS = 16 modules = `BOT_FILES` exactement.
Builder : liste blanche addon + TOC BOT-WOW générée (Interface 20506, SavedVariables `CasinobabeDB, CasinobabeErrorBus`), exclusions déclarées au manifeste, fail-closed sur fichier non inventorié ; correction d'un bug TDZ (`unresolvedRights` poussé avant déclaration) exposé par les nouveaux tests.
Tests nouveaux : contrat d'installation (19 contrôles), activation Lua 5.1 réelle (wasmoon + mock WoW ; octets réels via `BOTWOW_PACKAGE_FIXTURE`, sinon SKIP visible jamais compté), script `verify-bot-files-closure.mjs` câblé CI (MANIFEST == fermeture BFS, 16=16 sur la source épinglée).
Preuves locales : double-build byte-identique `14beafc73c9b840c4b8f7c525032047a9186435ba5a3950814efc522c26f5ade` (176 903 octets, 25 entrées / 24 SHA-256 manifeste — `verify-package-archive` PASS), `--release` REFUSÉ (sentinelles préservées), fulfillment réel (delivery-replay) SHA-256 livré exact, `npm run validate` PASS, `npm test` PASS.
**Correction 2026-11-10 (mesure réelle)** : la mesure publiée initialement `48818ceb…` (176 892 octets) n'est PAS reproductible avec le builder livré — deux builds indépendants redonnent `14beafc7…` (176 903 octets). Aucune variante d'un seul champ ne reproduit `48818ceb…` (`builtAt=null` → 176 916 octets ; `commitDate=null` → 176 897 octets) : l'ancienne valeur vient d'un état antérieur du builder. Le builder livré est déterministe (les deux builds sont byte-identiques) ; les preuves publiées sont donc corrigées sur la mesure réelle. Pas de réécriture d'historique : le message du commit `880ae28` conserve l'ancienne valeur, la correction est portée par un commit documentaire dédié.
La vente reste fermée : aucun paiement/prix/checkout/Worker/secret/R2 modifié. Rapport : `reports/operations/2026-11-10-issue82-minimal-package.md`.

**Correction 2026-11-10 — mesure de l'intention d'achat.** Le bouton de statut
`nav-buy` était encore inclus dans le sélecteur `checkout_requested`, alors qu'il
affiche « Purchase unavailable ». Les deux pages d'accueil EN/FR utilisent désormais
l'identifiant neutre `nav-status` : le clic reste mesuré comme `cta_click`, sans
être compté comme intention de checkout. Le test exécute le vrai script Analytics
et vérifie le HTML des deux langues. Aucun script d'analytics, checkout, paiement,
Worker ou prix n'a été modifié. Le rapport historique est conservé dans
`reports/operations/2026-11-10-purchase-intent-measurement-findings.md`.

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

**Prochaine action (cycle 2026-11-11) :**

1. **PR #195** : `validate` et `ui-quality` corrigés à la racine (commit `2c5cc166a524efe2b492c092bd9ee815a32bb4a0` — test des verrous rendu indépendant de l'heure et du cycle de vie des verrous). Vérifier les checks GitHub sur le SHA exact, puis attendre/revoir la PR `factory/corrections-20261111` → `main` (OPEN, mergeable). Ne pas merger sans décision propriétaire explicite.
2. **Sargagame sessions** : heartbeat périmé depuis 2026-08-05, événement autopilot P1 claim-status-line-not-found (2026-10-07), NEXT_SESSION.md sargagame-main périmé (2026-07-30). Aucune modification de secret/binding/déploiement sans autorisation.
3. **Revenus (évaluation seule)** : BOT-WOW 0 paiement confirmé + 6 sessions Stripe ouvertes (B-revenue) ; Sargagame P0-001 webhook_secret fail-open, P2-001/002/03 in_progress, 6 régions. Verrou `p0-payment-prep` active jusqu'au 2026-11-12 — ce scope n'est pas repris.
4. **Décision propriétaire bloquante** : droits de redistribution `aveca/Casinobabe` et conditions de licence client (B-licence, B-release-terms). `--release` refusé tant que ces deux exigences ne sont pas satisfaites.

Le paquet est construit, reproductible et vérifiable ; il ne manque plus que la décision propriétaire sur les droits de redistribution et les conditions de licence client. Un test d'activation dans un vrai client WoW autorisé reste à faire, hors de ce dépôt.
