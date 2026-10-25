# Déploiement BOT-WOW

Ce document décrit ce qui est **automatisé**, ce qui doit être fait **manuellement**
par un administrateur, et ce qui **n'a pas pu être vérifié** dans l'environnement de
développement.

---

## 1. Deux déploiements distincts

| Cible | Commande | Ce qu'elle publie |
|---|---|---|
| **Site public** (bot-wow.com) | le workflow `.github/workflows/pages.yml` (au push sur `main`) | le contenu statique : `index.html`, `demo.html`, `docs/`, `legal/`, `assets/` |
| **API** (api.bot-wow.com) | `wrangler deploy` | le Worker `worker/index.js` (Cloudflare Worker + D1 + KV + R2) |

Le site et l'API sont **indépendants** : la démo fonctionne sans l'API ✓ (elle est
100 % statique), et l'API sert le checkout, les licences et les téléchargements.

> **FIX 2026-10-23** — l'exposition du domaine `api.bot-wow.com` utilise
> désormais la forme **documentée** `[[routes]]` + `custom_domain = true`
> (l'ancienne clé `domains` n'était pas reconnue et provoquait un
> avertissement à chaque commande Wrangler). Vérification sans déploiement :
> `wrangler deploy --dry-run --outdir <dossier temporaire>`.

---

## 2. Secrets à configurer (Cloudflare) — JAMAIS dans le dépôt

```bash
wrangler secret put MOLLIE_API_KEY        # clé API Mollie (test ou live)
wrangler secret put MOLLIE_WEBHOOK_SECRET # secret de signature des webhooks (optionnel)
wrangler secret put RESEND_API_KEY        # envoi des e-mails de livraison
wrangler secret put ADMIN_PASSWORD        # accès aux routes /api/admin/*
```

| Secret | Rôle | Conséquence de son absence |
|---|---|---|
| `MOLLIE_API_KEY` | créer le paiement et **relire** le paiement dans le webhook | le checkout échoue (`checkout_failed`) |
| `MOLLIE_WEBHOOK_SECRET` | vérification **supplémentaire** de la signature du webhook | le webhook fonctionne quand même (l'état du paiement est relu via l'API) |
| `RESEND_API_KEY` | envoi du e-mail de licence | la commande est **conservée** en base (table `deliveries`, statut `pending`) et peut être rejouée ; **aucune licence n'est perdue** |
| `ADMIN_PASSWORD` | routes d'administration | l'administration est inaccessible |

Variables (non secrètes, dans `wrangler.toml`) : `ENVIRONMENT = "production"`,
`R2_OBJECT_KEY = "casinobabe-fishing-1.2.0.zip"`, `MAIL_FROM`.

---

## 3. Bases de données D1 (deux bases, deux jeux de migrations)

> **FIX 2026-10-23** — les migrations étaient auparavant toutes dans
> `migrations/`, ce qui faisait proposer à Wrangler l'application des
> migrations **métier** (orders, licences, e-mails) à la base de
> **télémétrie**. Chaque base a désormais son propre répertoire, déclaré
> explicitement dans `wrangler.toml` (`migrations_dir`).

| Base | Rôle | Répertoire | Contenu |
|---|---|---|---|
| `botwow-production` | commandes, licences, téléchargements, webhooks | `migrations/production/` | `0001` e-mails · `0002` licences · `0003` intégrité de paiement · `0004` réconciliation des identifiants |
| `botwow-analytics` | télémétrie de parcours **uniquement** | `migrations/analytics/` | `0001` table `events` · `0002` table `rl` |

Vérification en lecture seule (aucune écriture) :

```bash
wrangler d1 migrations list botwow-production   # 0001..0004 (metier)
wrangler d1 migrations list botwow-analytics    # 0001..0002 (telemetrie)
```

### Procédure d'application (après SAUVEGARDE)

```bash
# 1. Sauvegarde AVANT toute migration
wrangler d1 export botwow-production --output backup-$(date +%Y%m%d-%H%M%S).sql

# 2. Base de production (metier et paiement) — 4 migrations, idempotentes
wrangler d1 execute botwow-production --file=migrations/production/0001_botwow_emails.sql
wrangler d1 execute botwow-production --file=migrations/production/0002_botwow_licenses.sql
wrangler d1 execute botwow-production --file=migrations/production/0003_botwow_payment_integrity.sql
wrangler d1 execute botwow-production --file=migrations/production/0004_reconcile_order_ids.sql

# 3. Base de telemetrie (SEPAREE) — 2 migrations
wrangler d1 execute botwow-analytics --file=migrations/analytics/0001_telemetry_events.sql
wrangler d1 execute botwow-analytics --file=migrations/analytics/0002_telemetry_rl.sql

# 4. Restauration en cas de probleme
wrangler d1 execute botwow-production --file=backup-20260101-000000.sql
```

**Restauration testée** : la migration `0003` répare les données historiques
(commandes sans identifiant, licences pointant sur l'ancien `rowid`) et la
jointure `orders ↔ licenses` redevient exploitable.
Vérification automatisée : `npm run test:migrations`.

### 3.1 Migration de réconciliation des identifiants (`production/0004`)

**Pourquoi elle existe** : la base de production a `orders.id INTEGER PRIMARY
KEY` (alias de `rowid`) et `licenses.order_id INTEGER`, alors que le Worker
insère des identifiants **texte** (`ord_tr_…`, `ord_bitcoin_manual_BTC-…`).
Mesuré sur un vrai moteur SQL (`tests/d1-order-id-regression.test.mjs`) :

- webhook Mollie `paid` → `datatype mismatch`, **aucune licence créée**, et le
  verrou d'idempotence déjà posé interdit tout rejeu utile ;
- checkout Bitcoin → `500 checkout_failed`, aucune commande créée.

La migration `0002` ne peut pas corriger cela : elle déclare un schéma TEXT
mais utilise `CREATE TABLE IF NOT EXISTS`, qui **ne convertit pas** une table
déjà présente.

**Ce que fait `0004`** (reconstruction, pas réécriture) :

1. recrée `orders` avec `id TEXT PRIMARY KEY` et convertit les identifiants
   historiques en `ord_legacy_<valeur>` (seules les valeurs encore numériques
   sont touchées → **idempotent**) ;
2. recrée `licenses` avec `order_id TEXT REFERENCES orders(id)` et fait
   suivre les 5 références historiques ;
3. crée les tables attendues par le Worker mais absentes de la base :
   `deliveries`, `rate_limit`, `admin_sessions` ;
4. crée l'index `UNIQUE` sur `webhook_events(id)` — **c'est lui** qui porte
   l'idempotence du webhook, pas `MOLLIE_WEBHOOK_SECRET` (qui n'est qu'une
   vérification de signature supplémentaire et optionnelle).

**Vérifications à faire APRÈS application** (lecture seule) :

```sql
SELECT COUNT(*) FROM orders;                                   -- 14 (inchangé)
SELECT COUNT(*) FROM licenses;                                 -- 5  (inchangé)
SELECT COUNT(*) FROM licenses l
  LEFT JOIN orders o ON o.id = l.order_id WHERE o.id IS NULL;  -- 0 orphelin
SELECT id FROM orders WHERE id GLOB '[0-9]*';                  -- (vide)
```

**Preuve automatisée** : `npm run test:d1-order-ids` reconstruit la base sur
une copie isolée pourvue des données synthétiques (14 commandes, 5 licences,
11 e-mails, 5 événements de webhook) et vérifie la conservation, la jointure,
l'idempotence, puis fait vivre le **vrai Worker** (livraison Mollie, commande
Bitcoin) sur le schéma réconcilié.

> ⚠️ **La migration n'a pas été appliquée sur la base de production** depuis
> cet environnement (accès `wrangler` non disponible). La procédure ci-dessus
> est prête mais **doit être exécutée par un administrateur** après la
> sauvegarde.

---

## 4. Objet R2 (le paquet livré au client)

Le bouton de téléchargement sert l'objet `R2_OBJECT_KEY`
(`casinobabe-fishing-1.2.0.zip`), avec repli sur `Casinobabe-v1.0.38.zip`.

```bash
# Construction du paquet (depuis le dépôt Casinobabe)
node scripts/build-package.cjs --source <chemin du dépôt Casinobabe> --version 1.2.0

# Mise en ligne dans le bucket
wrangler r2 object put botwow-binaries/casinobabe-fishing-1.2.0.zip \
  --file dist/casinobabe-fishing-1.2.0/casinobabe-fishing-1.2.0.zip
```

Le paquet contient l'addon, le bot et un `MANIFEST.json` (SHA-256 par fichier).
Aucune donnée de session (`state/`, `reports/`, `logs/`) ne peut y entrer : le
build échoue si c'est le cas.

---

## 5. Webhook Mollie

URL à déclarer dans le compte Mollie :

```
https://api.bot-wow.com/api/mollie-webhook
```

**Protocole utilisé :** webhook classique de la **Payments API**. Mollie envoie un
`POST` dont le corps contient `id=tr_xxx` ; le serveur relit le paiement via
l'API (`GET /v2/payments/{id}`) avec la clé serveur et décide sur l'**état
réel** :

| État du paiement | Action |
|---|---|
| `paid`, montant = 2 000 EUR, devise = EUR, produit = `bot-wow-lifetime` | une licence, un jeton de téléchargement, un e-mail |
| `paid` avec un autre montant / une autre devise / un autre produit | **refusé** (HTTP 400), aucune livraison |
| `failed`, `expired`, `canceled` | commande marquée « failed », aucune licence |
| `open`, `pending` | rien (la confirmation sera rappelée) |

**Idempotence :** l'insertion de l'événement (`webhook_events.id` =
`payment:<id>`) est atomique et sert de verrou → deux notifications simultanées
ne peuvent pas créer deux licences. Une notification rejouée répond `200` sans
rien créer.

---

## 6. Vérifications avant mise en production

```bash
npm run validate        # pages, liens internes, absence de promesse non prouvée, migrations présentes
npm test                # parité de la démo, intégrité du paquet, parcours de paiement, migrations
```

Le test `tests/payment-flow.test.mjs` appelle le **vrai Worker** avec un D1
simulé et un `fetch` intercepté : il vérifie le prix imposé par le serveur, les
URL canoniques, la création d'une licence, l'idempotence et le refus des
mauvais montants.

**Test en mode Test de Mollie** (à faire par un administrateur, avec une clé
de test) : commande → checkout → confirmation → webhook → licence → e-mail →
téléchargement → activation. Le Worker ne distingue pas test et live : c'est la
clé Mollie qui détermine l'environnement.

---

## 7. Ce qui reste à faire par un administrateur

1. Créer / configurer les secrets (§2).
2. Sauvegarder puis appliquer les migrations D1 (§3).
3. Construire et téléverser le paquet dans R2 (§4).
4. Déclarer l'URL du webhook chez Mollie (§5).
5. Faire un paiement de test complet (§6) et vérifier l'e-mail reçu.
6. Passer la clé Mollie en mode **live** (le passage en live se fait dans le
   compte Mollie, pas dans le code).
7. Vérifier que `ENVIRONMENT = "production"` et que `admin.bot-wow.com` est
   protégé.
8. **Appliquer `migrations/production/0004` AVANT de reprendre les paiements**
   (voir §3.1) : sans elle, chaque paiement Mollie échoue sur
   `datatype mismatch` et chaque checkout Bitcoin renvoie 500. Les commandes
   et licences historiques sont conservées, pas réécrites.
9. Contrôler après application : `npm run test:d1-order-ids` et
   `npm run validate:d1-order-ids` (tous deux sur base isolée, jamais la
   production).
