# BOT-WOW — P0 « preuve de livraison » — Rapport final (2026-11-04)

**Mission :** restaurer un chemin d'achat réel en prouvant que le paquet v1.2.0 peut être livré après paiement, vérifier la chaîne Mollie → licence → livraison, préparer (sans activer) la réouverture commerciale, mesurer l'entonnoir réel.

**Dépôt :** https://github.com/aveca/bot-wow
**Branche de travail :** `p0/delivery-proof-20261104` (base `origin/main` = `2edd74be83f272672b303ccdb316d52137109076`)
**Auteur de la mission :** OpenCode (exécution locale) — **AUCUNE mutation de production, AUCUN paiement réel, AUCUN e-mail réel.**

**Standard de preuve appliqué :** chaque fait est étiqueté
`directement vérifié` (avec outil / lien) · `rapporté mission antérieure` (lien) · `non encore vérifié`.

---

## 1. Blocage commercial constaté — et les fichiers qui l'expriment

### 1.1 Blocage vérifié en production (directement vérifié — 2026-11-04)

| Page | État constaté | Preuve |
|-------|---------------|--------|
| `https://bot-wow.com/buy` | 200 — formulaire `buyForm` présent, **bouton désactivé** | HTML récupéré : `<button ... id="buyBtn" disabled><span class="btn-text">Pay €20.00 — delivery not confirmed</span></button>` |
| `https://bot-wow.com/fr/buy` | 200 — **bouton désactivé** | `<button ... id="buyBtn" disabled><span class="btn-text">Payer 20,00 € — livraison à confirmer</span></button>` |
| `https://bot-wow.com/` | 200 — CTA désactivé | mention « delivery status under verification » |
| `https://bot-wow.com/fr/` | 200 — CTA désactivé | mention « livraison à confirmer » |

Messages publics (verbatim, directement vérifiés) :

- EN : « Checkout unavailable. The v1.2.0 delivery is not confirmed yet, so the purchase form is disabled. You can still try the browser demo or email support with any question. »
- FR : « Achat indisponible. La livraison du paquet v1.2.0 n'est pas confirmée, le formulaire de paiement est désactivé. Vous pouvez essayer la démo navigateur ou écrire au support pour toute question. »

**Ces avertissements publics n'ont PAS été supprimés.** Ils sont exacts : la livraison n'a jamais été prouvée en production (voir § 3 et § 5).

### 1.2 Fichiers qui portent ce blocage

| Fichier | Rôle |
|---------|------|
| `buy.html`, `fr/buy.html` | pages d'achat : bouton `buyBtn` `disabled` + encart `.checkout-blocked` |
| `index.html`, `fr/index.html`, `compare.html`, `fr/compare.html` | CTA d'achat désactivés sur les pages de vente |
| `worker/index.js` (route `/api/checkout`) | garde serveur `RELEASE_STATUS` → `409 delivery_unverified` **avant tout appel Mollie** |

---

## 2. État des PR #67 et #68 (directement vérifié via `gh`, 2026-11-04)

| PR | Titre | État | SHA de tête | CI | Mergeable |
|----|-------|------|-------------|----|-----------|
| **#67** | `feat(telemetry): mesurer compatibility_view et demo_interaction (entonnoir CRO)` | **OPEN** | `e0dd64a0e995f687b0c58ea8fdd36108a618c31b` | `validate` SUCCESS · `ui-quality` SUCCESS · `GitGuardian` SUCCESS | MERGEABLE / CLEAN |
| **#68** | `docs(operations): rapport livraison + mesure entonnoir 2026-11-03` | **OPEN** | `3f2c332a01ca751a6c41504c6fabc7e6ea3a3ddf` | `validate` SUCCESS · `ui-quality` SUCCESS · `GitGuardian` SUCCESS | MERGEABLE / CLEAN |

**Point d'attention (non résolu par cette mission) :** PR #68 fusionnée sur `main` **déclenche le déploiement Pages** (workflow `pages.yml` sur push `main`), alors qu'elle ne contient que de la documentation. C'est la raison de l'exclusion `reports/**` ajoutée dans ce branche (§ 7.5) : un commit documentaire ne doit pas redéployer le site. **La réorganisation de la CI de déploiement reste à faire par une PR dédiée — non faite ici.**

---

## 3. État du paquet v1.2.0 (directement vérifié)

### 3.1 Archive R2 — vérifiée de façon indépendante

| Élément | Valeur | Méthode |
|---------|--------|---------|
| Objet R2 | `botwow-binaries/casinobabe-fishing-1.2.0.zip` | `wrangler r2 object get --remote` (lecture seule) |
| Taille | **1 387 543 octets** | `Get-Item` |
| SHA-256 | **`1c132f367607ea186feffde8bbda0a1a9f94cdec4b7850b93c57c271270bba4f`** | `Get-FileHash` (recalculé sur la copie téléchargée) |
| Entrées | **30** (scripts `.py` du bot, add-on Lua runtime, `MANIFEST.json`, `VERSION`) | ouverture ZIP |
| `VERSION` | `1.2.0` | contenu de l'archive |

**Conclusion :** l'archive existe et est intacte. **Sa présence ne prouve pas la livraison** : c'est précisément ce que la mission devait établir.

### 3.2 Le code de téléchargement en production était dangereux (directement vérifié)

Le code **déployé** du Worker `botwow-api` (déploiement du 27/10, lu via l'API Cloudflare) contenait un repli vers l'archive historique `Casinobabe-v1.0.38.zip` et servait l'archive configurée **sans vérifier sa présence**. Un client pouvait donc recevoir un paquet obsolète, ou consommer son quota de téléchargement pour une archive absente.

**Corrigé par l'intégration de PR #19** dans cette branche (`cb47155`) : seule la clé versionnée `R2_OBJECT_KEY` est servie, absence → `503 artifact_unavailable`, quota réservé **atomiquement et après** confirmation de l'artefact.

---

## 4. Tests exécutés (résultats réels, non déclaratifs)

### 4.1 Suite complète

```
npm test        → exit 0   (21 suites)
npm run validate → exit 0   (BOT-WOW validation PASS)
git diff --check → exit 0
```

Chaîne `npm test` **élargie** dans cette branche (les nouvelles suites sont désormais exécutées en CI, elles ne l'étaient pas) :

| Suite | Rôle | Avant | Après |
|-------|------|-------|-------|
| `tests/funnel.test.mjs` | intégrité de l'entonnoir | **CRASHAIT** (helper `callWorker` absent, mock D1 sans `.bind().first()`, variable `res` inexistante) → **exclu de la CI** | réparé, **33 contrôles**, intégré à `npm test` |
| `tests/checkout-gate.test.mjs` (PR #44) | garde serveur | importé | dans `npm test` |
| `tests/checkout-gate-mollie.test.mjs` (PR #44) | garde + **zéro appel Mollie** | importé | dans `npm test` |
| `tests/delivery-replay.test.mjs` | **reprise de livraison** (nouveau) | — | **41 contrôles**, dans `npm test` |

### 4.2 Ce que prouve `tests/delivery-replay.test.mjs` (nouveau, sur le **vrai** Worker)

1. Livraison interrompue après le verrou → le **rejeu du webhook la complète** (1 licence, 1 jeton, 1 e-mail, 1 reçu `sent`).
2. Rejeu après livraison réussie → **ni doublon de licence, ni doublon de jeton, ni second e-mail**.
3. E-mail en échec → le rejeu le renvoie et le reçu passe de `pending` à `sent` (plus rien « à rejouer »).
4. Paiement `failed` → aucune licence, aucun e-mail.
5. Remboursement → licence révoquée, commande `refunded`.
6. Activation → l'événement `license_activated` est émis (dernier maillon du parcours, non instrumenté jusqu'ici).
7. Garde de livraison → `409 delivery_unverified`, **zéro appel Mollie**, zéro commande.
8. Renvoi client (`/api/resend`) → **un vrai e-mail part**, contenant la licence et le lien ; réponse neutre ; aucune licence en double ; reçu unique.
9. Route admin → `401` sans authentification, aucun e-mail ; contrôles statiques : plus d'URL de staging, plus de faux « would be sent », renvoi branché sur l'envoyeur réel et sur l'URL de production.
10. Unicité du reçu : `COUNT(*) WHERE status='sent'` compte les **licences livrées**, pas les e-mails.

### 4.3 Aucun test n'a touché la production

Tous les appels Mollie et Resend sont **simulés** dans les tests. Aucun paiement, aucun e-mail, aucune écriture D1 distante n'a été effectué par la suite de tests.

---

## 5. Résultats Mollie en mode test

### 5.1 Ce qui a pu être fait — **NON EXÉCUTÉ**

> **Un test de paiement Mollie réel en mode test n'a PAS été exécuté.** Aucune clé `MOLLIE_API_KEY` de test n'est disponible localement (pas de `.dev.vars`, pas de clé dans le dépôt, les valeurs de secrets de production ne sont jamais lues). **Ce point reste bloqué** et doit être traité avec une clé de test dédiée, hors production.
>
> Les seuls contrôles Mollie existants sont **simulés** (fetch intercepté) : ce sont des tests déterministes, **pas** une preuve de bout en bout.

### 5.2 Ce que les données de production révèlent (lecture seule, `wrangler d1 execute --remote`)

| Constat | Valeur | Conséquence |
|---------|--------|-------------|
| Commandes Mollie | **11**, toutes en statut `failed` | aucune n'a abouti |
| Domaines e-mail des commandes Mollie | `@bot-wow.fr` ×10, `@test.fr` ×1 | **ce sont des tests internes**, pas des clients |
| Commandes `paid` | 5 | **provider = `bitcoin_manual`**, e-mails `@example.com` → **fixtures de test** |
| Licences créées | 5, toutes `order_id = ord_legacy_*` | créées par le parcours Bitcoin historique, **jamais par Mollie** |
| **`deliveries`** | **0 ligne** | **aucune livraison n'a jamais été enregistrée** |
| `webhook_events` | 16 (`payment:tr_*`) | idempotence exercée, mais **toutes sur des paiements échoués** |
| `activations` | 0 | aucune licence activée |

### 5.3 Conclusion factuelle — correction d'un chiffre antérieur erroné

> **Aucun paiement client réel n'a jamais été encaissé. Revenu réel : 0 €. Livraisons réelles : 0.**
>
> Le « 100 € encaissés » que mentionnaient des rapports antérieurs était un **faux positif** : 5 commandes `paid` à 20 € issues de fixtures `@example.com` en `bitcoin_manual`, et 11 commandes Mollie toutes échouées avec des e-mails de test internes.
>
> *Ce chiffre erroné était un signal dangerous : il pouvait faire conclure que le tunnel de vente fonctionnait.*

### 5.4 Entonnoir réel (base `botwow-analytics`, rétention 90 j, historique complet depuis le 22/10)

| Étape | Compte | Taux |
|-------|--------|------|
| `page_view` | **1 457** | 100 % |
| `journey_view` | 543 | 37 % |
| `cta_click` | 56 | 3,8 % |
| `checkout_requested` | 31 | 2,1 % |
| `checkout_created` | 6 | 0,41 % |
| `checkout_failed` | **6** | **100 % des créations** |
| `checkout_start` | 4 | 0,27 % |
| `planner_mode` | 1 | 0,07 % |
| `payment_confirmed` | **0** | 0 % |
| `license_created` | **0** | 0 % |
| `delivery_sent` | **0** | 0 % |
| `license_activated` | **0** (n'existait pas avant cette mission) | 0 % |

**Lecture :** 31 intentions d'achat, 6 créations de paiement, **6 échecs, 0 conversion**. La perception « ça se vend » des rapports antérieurs est contredite par les chiffres réels. La réouverture n'est justifiée que si la livraison est prouvée, pas par un tunnel affichant 0 vente.

---

## 6. État du webhook et de l'idempotence

### 6.1 Le défaut commercial (directement vérifié dans le code de production)

Le verrou d'idempotence (`webhook_events.id`, PK unique) était posé **AVANT** la livraison. Toute panne survenue après ce verrou (panne D1, e-mail, réseau) rendait le rejeu **définitivement ignoré** : le client avait payé et ne recevait **jamais** sa licence. Le test `d1-order-id-regression.test.mjs` documentait ce comportement noirci : « *le verrou d'idempotence est déjà posé (rejeu = échec définitif)* ».

### 6.2 Correction apportée (branche `p0/delivery-proof-20261104`)

| Élément | Avant | Après |
|---------|-------|-------|
| Rejeu du webhook | ignoré si le verrou existe | **reprend la livraison** et ne rejoue que le maillon manquant (commande / licence / jeton / e-mail) |
| `fulfillOrder` | recréait commande, licence, jeton | **idempotent** : 1 commande par paiement, 1 licence par commande, 1 jeton par licence ; le rejeu **réutilise** la licence existante |
| Échec de la reprise | — | l'erreur **remonte** : Mollie reprogramme la notification, la vente n'est pas perdue |
| Table `deliveries` | alimentée **uniquement en cas d'échec** | **journal de livraison** : `pending` = à rejouer, `sent` = preuve durable ; **un reçu unique par licence** |
| Renvoi client `/api/resend` | appelait un helper qui **faisait seulement logger** l'envoi | **vrai envoi** (mode `force`), réponse neutre |
| Renvoi admin `/api/admin/licenses/resend` | idem + **URL de staging** (`botwow-api-staging.m4ngo.workers.dev`) | **vrai envoi** + URL de **production** (`api.bot-wow.com`) ; `502` si l'envoi échoue |
| Mesure `license_activated` | absente | **émise** à l'activation (référence tronquée et irréversible, aucune donnée personnelle) |

Les deux faux helpers (`sendDeliveryEmail`, `sendAdminNotification`, qui ne faisaient que `console.log`) ont été **supprimés** : conserver un « envoyer » accessible par erreur est un risque commercial.

### 6.3 Schéma — aucune migration requise

`PRAGMA table_info(deliveries)` sur `botwow-production` : les colonnes `kind`, `status`, `error`, `created_at`, **`sent_at`** existent déjà. `orders.id` et `licenses.order_id` sont `TEXT`, `webhook_events.id` est `TEXT` PK unique. **Aucun DDL, aucune migration, aucun changement de schéma dans cette branche.**

---

## 7. Changements apportés — SHA et PR

### 7.1 Commits de la branche `p0/delivery-proof-20261104`

| SHA | Commit | Nature |
|-----|--------|--------|
| `913cab1` | `chore(assets): regenerer le stamp des assets (main etait perime)` | `main` avait un cache-buster obsolète → `npm test` échouait en local (la CI le masquait en régénérant **avant** les tests) |
| `cb47155` | `Merge PR #19 : integrite de l'archive livree` | intégration du correctif canonique (pas de repli archive obsolète, `503`, quota atomique) |
| `90c97bf` | `Merge PR #44 : garde de livraison cote serveur` | intégration de la garde `RELEASE_STATUS` (409 avant tout encaissement) |
| `f7f9904` | `fix(worker): rendre la livraison reprenable et observable` | reprise idempotente, journal de livraison, `license_activated`, réparation du test funnel |
| `2a025a4` | `fix(worker): rendre le renvoi de licence reellement operationnel` | vrai envoi client + admin, URL de production, suppression des faux helpers |
| `0b8cbef` | `fix(worker): un seul recu de livraison par licence` | unicité du reçu → comptage fiable des clients livrés |

**Fichiers modifiés :** `worker/index.js`, `tests/delivery-replay.test.mjs` (nouveau), `tests/funnel.test.mjs` (réparé), `tests/d1-order-id-migration.test.mjs`, `package.json`, `.github/workflows/pages.yml` (`reports/**` en `paths-ignore`).

### 7.2 Corrections de code apportées **hors** de la mission (signalées)

- `main` (SHA `2edd74b`) ne contenait **pas** la garde `RELEASE_STATUS`, alors qu'elle **est déployée en production**. Tout déploiement issu de `main` aurait **supprimé** la garde et rouvert l'encaissement sans contrôle — régression commerciale silencieuse. Corrigé par `90c97bf`.
- Le code **déployé** sert le Worker `botwow-api` (`wrangler.toml`), pas `bot-wow` (commentaire existant dans `wrangler.toml`).

### 7.3 PRs réutilisées plutôt que dupliquées (conformément à `AGENTS.md` règle 7)

PR **#19** (`fix/download-artifact-integrity-20261023`) et PR **#44** (`fix/p0-checkout-delivery-gate-20261027`) ont été **intégrées** (merge commits), pas réimplémentées. Elles restent ouvertes sur GitHub : **leur fermeture après merge est une action à faire par le mainteneur.**

### 7.4 PRs explicitement NON reprises

| PR | Raison du refus |
|----|-----------------|
| `fix/botwow-conformance-delivery` (branche non fusionnée) | son copy réécrit l'avertissement public en « verified… a re-send procedure exists » — **non soutenu** : la procédure de ré-envoi n'existait pas (log-only) et aucune licence Mollie n'a jamais été créée. Ce copy a été **corrigé à la source** dans `2a025a4` plutôt que repris tel quel. |
| #69 (Early Access) | pricing/checkout : hors périmètre de cette mission, checkout fermé |
| #65, #66 | hors périmètre ; #66 propose une alternative à un correctif déjà présent sur `main` |

### 7.5 Exécution de la CI

`.github/workflows/pages.yml` : ajout de `reports/**` dans `paths-ignore` → **un commit documentaire ne déclenche plus de déploiement Pages inutile** (règle explicite d'`AGENTS.md`). La CI utile (`validate`, `npm test`, `audit:css`) reste active.

---

## 8. Résultats CI

| Contrôle | Commande | Résultat |
|----------|----------|----------|
| Suite de tests | `npm test` | **exit 0** — 21 suites |
| Validation statique | `npm run validate` | **exit 0** — `BOT-WOW validation PASS` |
| Syntaxe Worker | `node --check worker/index.js` | **exit 0** |
| Chargement Worker | `import('./worker/index.js')` | OK — `default.fetch` exporté |
| Intégrité du diff | `git diff --check` | **exit 0** (aucun whitespace cassé) |
| **CI GitHub (PR)** | `gh pr checks` | **non déclenchée à la date de rédaction** : la branche n'était pas encore poussée. La PR est créée en § 9 ; l'état CI est rapporté dans le message de fin de mission. |

**Rappel de norme :** une CI verte ne prouve ni la correction de l'artefact, ni le bon déploiement en production. La preuve de production reste à produire après un déploiement autorisé (§ 10).

---

## 9. « Prêt à déployer » — périmètre exact

**Ce qui est prêt, testés localement, sans aucune mutation de production :**

1. Le Worker `botwow-api` de cette branche corrige la chaîne complète : garde serveur, intégrité de l'artefact, livraison idempotente et reprenable, preuve de livraison durable, renvoi réellement opérationnel, mesure `license_activated`.
2. Aucune migration de base, aucun changement de binding, aucun changement de secret, aucun changement de prix, aucune modification du checkout actif.
3. Les avertissements publics de non-livraison **restent en place** (ils sont exacts).
4. Séquence de déploiement proposée, **non exécutée** : merge de la PR → `wrangler deploy` (Worker `botwow-api`, avec rollback identifié) → vérification du code déployé via l'API Cloudflare → contrôle que la garde répond toujours `409` → **et seulement ensuite** discussion sur `RELEASE_STATUS`.

**Ce qui n'est PAS prêt / n'a pas été fait :**

- Aucun test de paiement Mollie **réel** en mode test (clé de test absente) → la chaîne de bout en bout n'est **pas** prouvée en conditions réelles.
- L'interface d'administration n'existe pas dans ce dépôt : le renvoi admin n'est vérifié que par le code du Worker et par test automatisé, pas par un parcours d'interface.
- La réorganisation de la CI de déploiement (PR #68 déclenche Pages) reste à faire.

---

## 10. En attente d'autorisation explicite

**Aucune de ces actions n'a été effectuée.** Elles exigent une autorisation humaine distincte, comme le impose `AGENTS.md` (règles 5 et 8).

| # | Action | Portée | Autorisation requise |
|---|--------|--------|----------------------|
| 1 | Déployer le Worker `botwow-api` depuis cette branche | production, réversible via le version précédent | **OUI** |
| 2 | Ouvrir le checkout (`RELEASE_STATUS=confirmed`) | **encaissement réel** | **OUI — décision commerciale séparée** |
| 3 | Modifier un secret / binding (`RESEND_API_KEY`, `MOLLIE_API_KEY`) | production | **OUI** (et non justifié à ce stade) |
| 4 | Écrire dans R2 / D1 de production | production | **OUI** |
| 5 | Effectuer un paiement test Mollie réel (mode test) | nécessite une clé de test | **OUI** (fourniture de la clé) |
| 6 | Modifier le prix, le plan, ou tout moyen de paiement | commercial | **OUI** |

### 10.1 Règle commerciale maintenue

> **Aucun bouton d'achat ne doit être réactivé tant que le produit payé n'est pas livrable.** La réouverture prepared (copy EN/FR exact + formulaire réactivé) est préparée sur une **branche séparée, en PR brouillon, non fusionnée** (§ 10.3), en attente d'une décision explicite.

### 10.2 Ordre recommandé

1. Merger la PR de cette mission (§ 7).
2. Déployer le Worker **avec la garde toujours à `pending`** → le checkout reste fermé, on vérifie que la branche en production livre bien (un paiement test § 10.3 — étape 5).
3. Une fois le paiement test concluant (licence + e-mail + reçu `sent` constats), **et seulement alors**, décider de `RELEASE_STATUS=confirmed` et de la réouverture du checkout.

### 10.3 Réouverture commerciale — préparée, non activée

- Branche dédiée : `p0/prepare-checkout-reopen-20261104` (**brouillon, non fusionnée, non déployée**).
- Contenu : copie EN/FR exact, formulaire d'achat réactivé, avertissements de livraison **conservés et reformulés** (« le paiement est disponible, la licence est livrée par e-mail » — pas de promesse de garantie supplémentaire), prix inchangé (20 EUR).
- Elle **ne suffit pas** à rouvrir la vente : la garde serveur `RELEASE_STATUS` doit aussi passer à `confirmed` (autorisation distincte). Le formulaire réactivé sans la garde renverrait un `409` — le prepared change et l'autorisation de déploiement restent séparés.

---

## 11. Ce qui reste bloqué, et par qui

| Blocage | Cause | Qui peut le lever |
|---------|-------|-------------------|
| Test de paiement Mollie réel | aucune clé `MOLLIE_API_KEY` de test disponible | fourniture d'une clé de test |
| Déploiement du Worker corrigé | autorisation requise | autorisation humaine explicite |
| Ouverture du checkout | décision commerciale | autorisation humaine explicite |
| Fermeture des PR #19 / #44 après merge | action de maintenance | mainteneur |
| CI : PR #68 déclenche un déploiement Pages | réorganisation non faite dans cette mission | PR dédiée |

---

## 12. Preuves brutes (reproductibles)

Toutes les commandes ci-dessous sont **en lecture seule** sur la production :

```bash
# Archive R2 (lecture seule)
wrangler r2 object get "botwow-binaries/casinobabe-fishing-1.2.0.zip" --file <copie> --remote
Get-FileHash <copie> -Algorithm SHA256     # 1c132f367607ea186feffde8bbda0a1a9f94cdec4b7850b93c57c271270bba4f

# Base de production (lecture seule)
wrangler d1 execute botwow-production --remote --command "SELECT status, COUNT(*) n FROM orders GROUP BY status"
wrangler d1 execute botwow-production --remote --command "SELECT COUNT(*) n FROM deliveries"
wrangler d1 execute botwow-production --remote --command "PRAGMA table_info(deliveries)"

# Telemetrie / entonnoir (lecture seule)
wrangler d1 execute botwow-analytics --remote --command "SELECT event, COUNT(*) n FROM events GROUP BY event"

# Code reellement deploye
# -> lu via l'API Cloudflare (workers_get_worker_code), 264 034 octets
#    contient webhook_events, la garde RELEASE_STATUS, le repli legacy (corrige ici)
```

**État du Worker au 2026-11-04 :** déploiement du 27/10, `/health` → `{"status":"ok","version":"1.0.0"}`, `/api/config` → prix 20 EUR. **Le code corrigé de cette mission n'est PAS en production.**

---

*Rapport produit par OpenCode le 2026-11-04. Aucun paiement réel, aucun e-mail réel, aucun changement de production. Les faits non vérifiables sans autorisation sont explicitement étiquetés « non encore vérifié ».*
