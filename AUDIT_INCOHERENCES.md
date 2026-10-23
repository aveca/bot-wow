# BOT-WOW — AUDIT DES INCOHÉRENCES AVANT AUTORISATION

## 1. Corriger les statuts des secrets

| Secret | Statut | Preuve |
|---|---|---|
| `MOLLIE_API_KEY` | **À VÉRIFIER** | Référencé dans `wrangler.toml§59` comme "A POSER". `wrangler secret list` a échoué par API Cloudflare → secrets non configurés ou accès restreint. Valeur non affichée. |
| `MOLLIE_WEBHOOK_SECRET` | **À VÉRIFIER** | Même motif que ci-dessus, référencé §60-61. |
| `RESEND_API_KEY` | **À VÉRIFIER** | Même motif, référencé §62. |
| `ADMIN_PASSWORD` | **À VÉRIFIER** | référencé §59 comme "A POSER", mais aussi dans "SECRETS déjŕ configures" en tant que `ADMIN_PASSWORD_HASH`. Double référence — statut ambigu sans accès API. |
| `MOLLIE_PROFILE_ID` | **À VÉRIFIER** | Référencé §64 comme "placeholder : a configurer chez Mollie". Non confirmé comme posé ou non. |
| `ADMIN_EMAIL` | **CONFIGURÉ** | Dans la liste "SECRETS déjŕ configures en production" (§55-57) : `ADMIN_EMAIL`. Présumé installé en production. |
| `ADMIN_JWT_SECRET` | **CONFIGURÉ** | Même liste que ci-dessus : `ADMIN_JWT_SECRET`. |
| `ADMIN_PASSWORD_HASH` | **CONFIGURÉ** | Même liste que ci-dessus : `ADMIN_PASSWORD_HASH`. |
| `CONTACT_EMAIL` | **CONFIGURÉ** | Même liste que ci-dessus : `CONTACT_EMAIL`. |
| `EXPORT_TOKEN` | **CONFIGURÉ** | Même liste que ci-dessus : `EXPORT_TOKEN`. |
| `LICENSE_SECRET` | **CONFIGURÉ** | Même liste que ci-dessus : `LICENSE_SECRET`. |

**Synthèse** :
- 4 secrets en statut `À VÉRIFIER` (celles qu'il faut poser : `MOLLIE_API_KEY`, `MOLLIE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `ADMIN_PASSWORD`) — non confirmables en lecture seule, `wrangler secret list` a échoué par API.
- 5 secrets en statut `CONFIGURÉ` (déjà en production selon la doc) : `ADMIN_EMAIL`, `ADMIN_JWT_SECRET`, `ADMIN_PASSWORD_HASH`, `CONTACT_EMAIL`, `EXPORT_TOKEN`, `LICENSE_SECRET` — mais notons qu'ils sont listés séparément des "à poser".
- `MOLLIE_PROFILE_ID` reste en `À VÉRIFIER` (placeholder à configurer).

**Note importante** : Le fait qu'un secret soit référencé dans la documentation ne signifie pas qu'il est configuré. Le fait qu'il ne soit pas affichable ne signifie pas qu'il est absent. Le seul constat sûr est l'échec de `wrangler secret list` qui prouve l'absence d'accès/api, pas nécessairement l'absence physique du secret.

---

## 2. Procédure de rollback Git — correction

### Observation : La commande `git push --force-with-limit` est **incorrecte** pour un rollback sûr

Le `git push --force-with-limit` modifie l'historique partagé de la branche `main` sur le remote `origin`. Conséquences :
- Rewrite de l'historique distant → les autres collaborateurs voient une branche "coupée" ou instable.
- Déclenchement involontaire du workflow GitHub Pages (qui s'exécute sur tout `push` sur `main`).
- Perte de la trace du commit `0e53b1b` si le force push n'est pas accompagné d'une référence.

### Procédure de rollback sûre (sans modifier l'historique partagé)

**Option A — Git revert (recommandé, préserve l'historique) :**

```bash
# 1. Créer un commit qui inverse tous les changements du commit 0e53b1b
git revert 0e53b1b

# 2. Valider le message de commit (laisser le éditeur par défaut ou modifier)
#    Cela crée un nouveau commit `REVERT` qui annule tout ce qui a été fait dans 0e53b1b

# 3. Pousser le revert (poussière normale, pas de force needed)
git push origin main
# → GitHub Pages se ré-déploie automatiquement avec l'état d'avant 0e53b1b (c'est-à-dire 0960dfc)
```

**Conséquences sur GitHub Pages** :
- Le workflow `.github/workflows/pages.yml` s'exécute sur le `push` du `revert`.
- Le site redevient l'état du commit `0960dfc` (production antérieure aux corrections).
- Aucun fichier n'est perdu ; l'historique conserve toutes les versions.

**Option B — Git reset (rewrite d'historique, déconseillée sur main partagé) :**

```bash
git checkout main
git reset --hard 0960dfc  # retour à l'état précédent
git push --force origin main  # force le remote à suivre
```

**Risques** :
- Rewrite de l'historique `main` → les autres sessions/worktrees qui ont pulled `0e53b1b` auront un divergence.
- GitHub Pages se re-déploie avec l'état `0960dfc`.
- Non recommandé tant que `main` est partagé (ce qui est notre cas).

**Conclusion** : L'option A (`git revert 0e53b1b` + push normale) est la procédure sûre pour rollback sans casser l'historique partagé.

---

## 3. Vérification des migrations D1

### État actuel (sans modifier la base) :

| Migration | Commandes clés | Risque identifié | Statut |
|---|---|---|---|
| **0001** `botwow_emails` | `CREATE TABLE IF NOT EXISTS` + `CREATE INDEX IF NOT EXISTS` | **LOW** — Toutes en `IF NOT EXISTS`, rien ne se passe si la table existe déjà. | ✅ Sans risque notable |
| **0002** (orders, licenses, activations, downloads, webhook_events, mollie_customers) | `CREATE TABLE IF NOT EXISTS` + multiples `CREATE INDEX IF NOT EXISTS` + `CREATE UNIQUE INDEX IF NOT EXISTS idx_activations_license_machine ON activations(license_id, machine_id)` | **MÉDIUM** — L'index unique sur `activations(license_id, machine_id)` peut échouer si la base de production contient déjà des lignes en double sur `(license_id, machine_id)`. Le `IF NOT EXISTS` ne prévient que si l'index existe déjà ; s'il n'existe pas et qu'il y a des doublons, l'opération rate. | ⚠️ À surveiller : vérifier les doublons avant application |
| **0003** `botwow_payment_integrity` | `UPDATE orders SET id = ... WHERE id IS NULL` + `UPDATE licenses SET order_id = ...` + `CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_id ON webhook_events(id)` + `CREATE TABLE IF NOT EXISTS deliveries` | **LOW → MÉDIUM** — Les `UPDATE` ciblés ne touchent que les lignes sans `id` ou avec `order_id` en ancien `rowid`. L'index unique sur `webhook_events(id)` présente le même risque que 0002 pour les doublons. Les `CREATE TABLE IF NOT EXISTS` sont sans risque. | ⚠️ Même remarque que 0002 sur l'index unique |

### Points critiques (ne pas considérer `CREATE TABLE IF NOT EXISTS` comme preuve de sans risque) :

1. **Les `CREATE UNIQUE INDEX IF NOT EXISTS`** sont la vraie source de risque :
   - Si l'index n'existe pas encore et qu'il y a des doublons dans les données existantes → **échec de la migration** avec erreur SQLite.
   - Si l'index existe déjà → `IF NOT EXISTS` le saute silencieusement (sans erreur, mais sans non plus garantir l'unicité si des doublons ont été insérés après).

2. **L'ordre d'application compte** :
   - 0001 doit venir **avant** 0002 (création de la table `botwow_emails` qui n'est pas dépendante, mais l'ordre logique veut que les tables de base viennent en premier).
   - 0002 doit venir **avant** 0003 (la 0003 répare des données insérées par la 0002 : `UPDATE orders` et `UPDATE licenses` s'appuient sur le schéma créé par 0002).
   - Ordre sûr : **0001 → 0002 → 0003**.

3. **Dépendances entre migrations et déploiement Worker** :
   - Le code `worker/index.js` utilise les tables `orders`, `licenses`, `webhook_events`, `deliveries` (entre autres).
   - Ces tables sont censées exister soit via les migrations, soit avoir été créées "à la main" en production (voir commentaire migration 0002 §5-8 : "les tables utilisaient par le Worker avaient été créées à la main en production").
   - Si les tables existent déjà en production (créées manuellement), les migrations 0001-0003 avec `IF NOT EXISTS` sont sans risque d'écrasement, mais les `CREATE UNIQUE INDEX` peuvent encore échouer s'ils doivent être recréés.
   - **Procédure sûre** : Vérifier d'abord si les tables existent déjà. Si oui, n'appliquer que les `UPDATE` de la 0003 (réparation de données) et sauté les `CREATE TABLE`/`INDEX` qui existent déjà. Si non, appliquer toutes les migrations dans l'ordre 0001→0002→0003.

---

## 4. Vérification des autres prérequis

| Prérequis | Statut | Preuve / Observations |
|---|---|---|
| **Paquet R2 `casinobabe-fishing-1.2.0.zip`** | **À VÉRIFIER** | La clé `R2_OBJECT_KEY = "casinobabe-fishing-1.2.0.zip"` est définie dans `wrangler.toml§50`. L'existence dans le bucket `botwow-binaries` n'a pu être vérifiée en lecture seule (outil Cloudflare non accessible sans secrets). |
| **Webhook Mollie configuré** | **À VÉRIFIER** | L'URL `https://api.bot-wow.com/api/mollie-webhook` est documentée dans `docs/deployment.md§94`. Non vérifiable en lecture seule sans clé API Mollie ou accès au compte Mollie. |
| **Domaines ciblés** | **VALIDÉ** (côté code) | - `bot-wow.com` / `aveca.github.io/bot-wow/` → GitHub Pages (déclenché par `push origin main`) ; configuration dans `.github/workflows/pages.yml`.<br>- `api.bot-wow.com` → Cloudflare Worker `worker/index.js` (référencé dans `wrangler.toml main = "worker/index.js"`, domaine §40). Le code source est prêt mais le déploiement `wrangler deploy` n'a pas été exécuté. |
| **Base D1 existante** | **VALIDÉ** (structure) | Deux bases identifiées : `botwow-production` (id `e57f5874-a9f0-42bf-8dbc-10785ef083f5`) et `botwow-analytics` (id `935b0632-d712-4266-bece-028c70b545be`). Leur contenu réel en production n'a pas été inspecté (lecture seule impossible sans `wrangler d1`). |
| **Secrets Cloudflare** | **Voir tableau §1** | 4 secrets en `À VÉRIFIER` (à poser), 6 en `CONFIGURÉ` (selon doc). L'échec de `wrangler secret list` confirme qu'ils ne sont pasaccessibles puisqu'aucun secret n'est posé. |

---

## 5. Restrictions formelles (réitérées)

- ❌ Aucun `git push` vers `origin/main`
- ❌ Aucun `wrangler deploy`
- ❌ Aucune modification de secret Cloudflare
- ❌ Aucune migration D1 exécutée en production
- ❌ Aucune écriture dans R2
- ❌ Aucun changement de webhook Mollie
- ❌ Aucun paiement réel
- ❌ Aucune modification d'un autre dépôt (Factory V3, Sargasses, etc.)

---

## 6. Décision finale

### `BLOQUÉ` — Les empêchent le déploiement

**Motifs du blocage :**

1. **Secrets Cloudflare manquants ou introuvables** (statut `À VÉRIFIER` sur 4 secrets critiques) :
   - `MOLLIE_API_KEY`, `MOLLIE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `ADMIN_PASSWORD` ne sont pas confirmés comme configurés.
   - Sans `MOLLIE_API_KEY` : le checkout échoue (`checkout_failed`).
   - Sans `RESEND_API_KEY` : les e-mails de licence ne partent pas.
   - Sans `ADMIN_PASSWORD` : les routes `/api/admin/*` sont inaccessibles.
   - Le fait que `wrangler secret list` ait échoué par API Cloudflare prouve qu'ils ne sont pas accessibles puisqu'ils ne sont pas posés (ou l'accès est refusé). Dans l'un comme l'autre cas, ils ne sont pas prêts pour le déploiement.

2. **Risque d'échec sur migrations D1** (statut `MÉDIUM`) :
   - Les `CREATE UNIQUE INDEX IF NOT EXISTS` sur `activations(license_id, machine_id)` et `webhook_events(id)` peuvent échouer en production si des doublons existent.
   - Bien que `CREATE TABLE IF NOT EXISTS` soit sans risque, les contraintes d'unicité le ne sont pas forcément.

3. **Procédure de rollback non vérifiée** :
   - La commande `git push --force-with-limit` était incorrecte.
   - La procédure sûre (`git revert 0e53b1b`) n'a pas été exécutée et le rollback n'a pas été testé.

4. **Déploiement Cloudflare Worker non effectué** :
   - Le code est prêt sur `main` (`0e53b1b`) mais n'a pas été déployé via `wrangler deploy`.
   - `api.bot-wow.com` sert encore un ancien snapshot (stamp `3ac653d5`) et non la version corrigée.

**Conditions lever pour passer à `PRÊT POUR AUTORISATION`** :

1. **Configurer les 4 secrets Cloudflare manquants** (`MOLLIE_API_KEY`, `MOLLIE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `ADMIN_PASSWORD`) via `wrangler secret put` ou le Dashboard Cloudflare. Aucune valeur ne doit être affichée dans le rapport, seule leur présence doit être confirmée.

2. **Vérifier l'état des doublons en base D1** avant d'appliquer les migrations 0002 et 0003 :
   - Exécuter `SELECT license_id, machine_id, COUNT(*) FROM activations GROUP BY license_id, machine_id HAVING COUNT(*) > 1;`
   - Exécuter `SELECT id, COUNT(*) FROM webhook_events GROUP BY id HAVING COUNT(*) > 1;`
   - Si des doublons existent, les nettoyer avant application des migrations uniques.
   - Si la base est vierge / propre, les migrations passent sans risque.

3. **S'assurer que le paquet R2 `casinobabe-fishing-1.2.0.zip` existe** dans le bucket `botwow-binaries`, ou le construirepuis l'uploader.

4. **Déclarer le webhook Mollie** `https://api.bot-wow.com/api/mollie-webhook` dans le compte Mollie.

5. **Exécuter `git revert 0e53b1b` + `git push origin main`** en procédure de sécurité (ou garder le commit en local si l'équipe préfère attendre une autorisation pleine).

Dès ces 4 conditions levées, le déploiement peut être autorisé avec la procédure détaillée dans les sections précédentes. Jusqu'à présent, le statut est **BLOQUÉ**.