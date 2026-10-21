# CHECKLIST DE MISE EN PRODUCTION — BOT-WOW

Liste **exécutable et ordonnée**. Chaque étape indique : préconditions,
commandes exactes, vérification, et retour arrière.
Aucun secret n'est demandé, affiché ni stocké dans ce document : les secrets
se posent via `wrangler secret put` (invite masquée).

État au 2026-10-21 : les étapes 1 à 4 sont **vérifiées** (tests automatisés,
site publié), les étapes 5 à 9 exigent un accès administrateur.

---

## Étape 0 — Préconditions (à vérifier avant toute action)

```bash
# 1. Outillage
node --version          # >= 20
npm --version
npx wrangler --version # Cloudflare CLI authentifie sur le compte

# 2. Compte Cloudflare : acces a bot-wow (Workers, D1, KV, R2, Pages)
wrangler whoami

# 3. Etat du depot
git fetch origin
git log --oneline -1 origin/feat/botwow-saas-commercialization
```

- [ ] `wrangler whoami` renvoie le bon compte
- [ ] la branche `feat/botwow-saas-commercialization` est à jour et sa CI est verte
- [ ] un **compte de test** (adresse e-mail de test) est prêt pour la commande
      d'essai (étape 8) — ne jamais utiliser l'adresse d'un client réel

---

## Étape 1 — Sauvegarde de la base D1 (OBLIGATOIRE, avant toute migration)

```bash
wrangler d1 export botwow-production \
  --output backup-$(date +%Y%m%d-%H%M%S).sql
ls -lh backup-*.sql
```

**Vérification** : le fichier existe et n'est pas vide.
**Retour arrière** : `wrangler d1 execute botwow-production --file=backup-<date>.sql`
(la restauration remplace le contenu de la base : à faire sur une base vide
d'abord pour valider la commande).

- [ ] sauvegarde faite, fichier > 0 octet

---

## Étape 2 — Inspection du schéma réel AVANT migration

```bash
wrangler d1 execute botwow-production --command \
  "SELECT name, sql FROM sqlite_master WHERE type='table' ORDER BY name" --json
```

Comparer avec `migrations/0002_botwow_licenses.sql` et
`migrations/0003_botwow_payment_integrity.sql` :
- les tables `orders`, `licenses`, `activations`, `downloads`, `webhook_events`,
  `mollie_customers` existent-elles déjà ?
- `orders.id` est-elle TEXT ? `licenses.order_id` référence-t-elle `orders(id)` ?
- y a-t-il des lignes `orders.id IS NULL` (lLegacy) ?
- `webhook_events.id` a-t-elle une contrainte UNIQUE ?

```bash
wrangler d1 execute botwow-production --command \
  "SELECT COUNT(*) AS commandes_sans_id FROM orders WHERE id IS NULL OR id=''" --json
wrangler d1 execute botwow-production --command \
  "SELECT COUNT(*) AS licences_orphelines FROM licenses l LEFT JOIN orders o ON o.id=l.order_id WHERE o.id IS NULL" --json
```

**Si les données diffèrent du schéma supposé** : ne pas appliquer la migration
avant d'avoir ajusté `0003` (elle est idempotente, mais sa clause de
réparation suppose `id = 'ord_' || provider || '_' || provider_id`).

- [ ] schéma comparé et consigné dans le rapport de déploiement
- [ ] commandes d'inventaire exécutées et sorties conservées

---

## Étape 3 — Application des migrations

```bash
wrangler d1 execute botwow-production --file=migrations/0001_botwow_emails.sql
wrangler d1 execute botwow-production --file=migrations/0002_botwow_licenses.sql
wrangler d1 execute botwow-production --file=migrations/0003_botwow_payment_integrity.sql
```

**Vérification** :

```bash
wrangler d1 execute botwow-production --command \
  "SELECT COUNT(*) AS commandes_sans_id FROM orders WHERE id IS NULL OR id=''" --json   # attendu 0
wrangler d1 execute botwow-production --command \
  "SELECT COUNT(*) AS licences_orphelines FROM licenses l LEFT JOIN orders o ON o.id=l.order_id WHERE o.id IS NULL" --json  # attendu 0
wrangler d1 execute botwow-production --command \
  "SELECT name FROM sqlite_master WHERE type='table' AND name='deliveries'" --json   # attendu deliveries
```

**Retour arrière** : étape 1 (restauration de la sauvegarde).

- [ ] les trois migrations appliquées sans erreur
- [ ] commandes sans identifiant = 0
- [ ] licences orphelines = 0

---

## Étape 4 — Secrets (jamais en clair dans un dépôt)

```bash
wrangler secret put MOLLIE_API_KEY        # cle API Mollie (mode TEST d'abord)
wrangler secret put RESEND_API_KEY        # envoi des e-mails de livraison
wrangler secret put ADMIN_PASSWORD        # routes /api/admin/*
# optionnel :
wrangler secret put MOLLIE_WEBHOOK_SECRET # verification HMAC supplementaire
wrangler secret put MOLLIE_PROFILE_ID
```

**Vérification** : `wrangler secret list` affiche les NOMS (jamais les
valeurs). Aucun secret ne doit apparaître dans `git log`, un message de
commit, une PR ou une capture d'écran.

- [ ] secrets posés, noms visibles, valeurs jamais écrites ailleurs

---

## Étape 5 — Déploiement du Worker

```bash
npm ci --ignore-scripts
npm run validate     # pages, liens, promesses, migrations
npm test             # parite, distribution, PAIEMENT, migrations
wrangler deploy --dry-run     # verifie le build SANS publier
wrangler deploy
```

**Vérification immédiate** :

```bash
curl -s https://api.bot-wow.com/api/config     # priceEur 20, product bot-wow-lifetime
```

- [ ] `npm test` vert (dont `test:payment` : 21/21)
- [ ] `wrangler deploy` réussi
- [ ] `/api/config` répond avec le bon produit et le bon prix

---

## Étape 6 — Objet de distribution dans R2

```bash
# 1. Construire le paquet depuis le depot Casinobabe (branche de release)
node scripts/build-package.cjs --source <chemin Casinobabe> --version 1.2.0
#    -> dist/casinobabe-fishing-1.2.0/casinobabe-fishing-1.2.0.zip

# 2. Verifier le manifeste
python - <<'PY'
import json,hashlib,os
d=r"dist/casinobabe-fishing-1.2.0"
m=json.load(open(os.path.join(d,"MANIFEST.json")))
bad=[]
for rel,info in m["files"].items():
    p=os.path.join(d,"package",rel)
    h=hashlib.sha256(open(p,"rb").read()).hexdigest()
    if h!=info["sha256"]: bad.append(rel)
print("fichiers verifies:",len(m["files"]),"| non conformes:",bad)
PY

# 3. Televerser
wrangler r2 object put botwow-binaries/casinobabe-fishing-1.2.0.zip \
  --file dist/casinobabe-fishing-1.2.0/casinobabe-fishing-1.2.0.zip
```

**Vérification** : le download ne doit renvoyer QUE si la licence est active,
le jeton valide, non expiré et sous quota (le code le contrôle déjà).

- [ ] ZIP construit, manifeste 100 % conforme
- [ ] objet R2 présent
- [ ] aucun fichier de session (`state/`, `reports/`, `logs/`) dans le ZIP

---

## Étape 7 — Déclaration du webhook chez Mollie

Dans le compte Mollie (mode **Test** d'abord) :
`https://api.bot-wow.com/api/mollie-webhook`

Protocole : **webhook classique de la Payments API** (POST avec `id=tr_xxx`).
Le serveur relit le paiement via l'API et décide sur l'état réel
(`paid` + montant 2 000 EUR + devise EUR + produit `bot-wow-lifetime`).

- [ ] URL déclarée, mode Test
- [ ] aucune donnée de carte stockée par BOT-WOW

---

## Étape 8 — Paiement de bout en bout (MODE TEST, compte de test)

Chaîne à vérifier **complètement** :

1. `/api/checkout` renvoie une `checkoutUrl` Mollie (montant 20,00 EUR côté
   serveur — un montant différent doit être **refusé**) ;
2. paiement effectué sur la page Mollie de test ;
3. le webhook arrive, la commande est `paid`, **une** licence et **un** jeton
   sont créés ;
4. **l'e-mail de livraison arrive** (clé + lien + guide) ;
5. le lien de téléchargement sert **le bon ZIP** ;
6. la licence s'active sur une machine ;
7. **un rejeu du webhook** (renvoyer la même notification) ne crée **pas** une
   seconde licence ;
8. un paiement au **mauvais montant** ne crée aucune licence.

- [ ] les 8 points vérifiés, preuves capturées (captures d'écran, journal)
- [ ] `deliveries` ne contient aucune ligne `pending` (ou elles sont
      rejouées)

---

## Étape 9 — Bascule du domaine et mise en ligne

```bash
# 1. Fusionner la PR #3 (la politique de l'environnement github-pages
#    n'autorise que 'main' : le domaine personnalisé suit 'main')
#    -> fusion FAITE PAR UN HUMAIN apres relecture du diff

# 2. Verifier la publication
curl -sI https://bot-wow.com/ | head -1
curl -s https://bot-wow.com/demo.html | grep -c "simul"     # bandeau "simule"
curl -s https://bot-wow.com/worker/index.js -o /dev/null -w "%{http_code}\n"  # attendu 404
```

- [ ] `bot-wow.com` sert la nouvelle page
- [ ] `/demo.html` accessible, bandeau « données simulées » présent
- [ ] `worker/`, `migrations/`, `package.json` : **404** (non publiés)
- [ ] Lighthouse (navigateur) : accessibilité ≥ 0,95, 0 erreur console

---

## Étape 10 — Passage en mode LIVE (Mollie)

Dans le compte Mollie : remplacer la clé de test par la clé **live** (secret
Cloudflare), puis rejouer l'étape 8 sur un compte de test. Ne jamais basculer
avant que le test (étape 8) soit vert.

- [ ] étape 8 rejouée en live, 8/8
- [ ] `ENVIRONMENT = "production"` (déjà le cas dans `wrangler.toml`)

---

## Repli en cas de problème

| Symptôme | Action | Effet |
|---|---|---|
| Migration cassante | restaurer la sauvegarde D1 (étape 1) | base revenue à l'état d'avant |
| Worker instable | `wrangler rollback` | redeploy de la version précédente |
| Paquet erroné en R2 | téléverser la version précédente sous le même nom | les nouveaux téléchargements repartent sur la bonne version |
| E-mails non reçus | vérifier `RESEND_API_KEY` puis rejouer les lignes `pending` de `deliveries` | aucune vente perdue ni dupliquée |
| Montant / produit faux | corriger `PRICE_TABLE` dans `worker/index.js` et redéployer | le serveur reste maître du prix |
| Domaine indisponible | rejouer le workflow Pages sur `main` | republication en quelques minutes |
| Fuite de secret | `wrangler secret put` avec une **nouvelle** valeur, puis rotation chez le fournisseur | l'ancienne valeur est invalidée |

## Ce qui reste à faire par un administrateur (récapitulatif)

1. Étapes 0 à 1 (prérequis, sauvegarde) ;
2. Étapes 2 à 3 (inspection du schéma réel, migrations) ;
3. Étape 4 (secrets) ;
4. Étapes 5 à 7 (déploiement Worker, R2, webhook) ;
5. Étape 8 (paiement de test complet) ;
6. Étape 9 (fusion de la PR #3, vérification du domaine) ;
7. Étape 10 (bascule live).
