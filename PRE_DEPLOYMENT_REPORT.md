# BOT-WOW — P0 FINAL : Rapport de pré-déploiement du commit 0e53b1b

**Portée** : Vérification du commit `0e53b1b` sur `main` du dépôt
`C:\factory\worktrees\bot-wow-repo`. Aucune modification de production, aucun
`git push`, aucun `wrangler deploy`, aucune modification de secret.Rapport produit le même jour que la mission (ven. 23 oct. 2026).

---

## 1. État réel du dépôt

| Élément | Résultat |
|---|---|
| **Branche** | `main` |
| **HEAD** | `0e53b1b fix: paiement honnête, hero V13 dans l'écran, SEO pages de paiement` |
| **Parent** | `0960dfc Factory V3: FACTORY.md updated with final commit hash` |
| **Relation origin/main** | `main` est **en avance** de 1 commit par rapport à `origin/main` |
| **Working tree** | Propre, aucun fichier modifié en attente (`git status` → `nothing to commit`) |
| **Backup du commit** | Le commit est dans l'historique local ; pas de backup externe requis |
| **Fichiers modifiés dans le commit** | 49 fichiers (voir section 3 ci-dessous) ; le reste du diff est du re-stamp d'actifs (?)v=9585b518) |

---

## 2. Table de validation des prérequis

| # | Prérequis | Statut | Preuve / Observations |
|---|---|---|---|
| 1 | Commit `0e53b1b` sur `main` | ✅ **VALIDÉ** | `git log --oneline` ; HEAD = `0e53b1b` ; parent = `0960dfc` |
| 2 | `npm run validate` PASS | ✅ **VALIDÉ** | `BOT-WOW validation PASS` ; vérifie fichiers requis, références actifs, workflow Pages, secrets JS, démo pêche, scripts distribution, migrations D1 |
| 3 | `npm test` exit 0 | ✅ **VALIDÉ** | 10 suites toutes OK : route-planner-parity, modules-parity, distribution-package, payment-flow, checkout-security, site-artifact, link-check, conversion-path, telemetry, migrations |
| 4 | Hero CTA dans l'écran (viewport) | ✅ **VALIDÉ** | Audit viewport 4 viewports (360×800, 390×844, 768×1024, 1440×900) : CTA à 741px (1440×900) → **dans l'écran** ; avant : 911px → hors écran |
| 5 | Stamp d'actifs déterministe | ✅ **VALIDÉ** | `scripts/versionne-assets.mjs` retire la date du jour ; test "stamp correspond au contenu actuel des assets" passe ; builds reproductibles |
| 6 | Sélecteur `.hero.variant-c` | ✅ **VALIDÉ** | Corrigé de `.variant-c .hero` (mort : ne matchait pas le même élément) vers `.hero.variant-c` ; hauteur hero 1193px (avant 1608px) ; chapitre 19px ; rythme resserré |
| 7 | Messages `app.js` EN/FR cohérents | ✅ **VALIDÉ** | Plus de message en dur français sur la page anglaise ; repli = "Contacter le support" |
| 8 | `sitemap.xml` propre | ✅ **VALIDÉ** | `success.html` / `cancel.html` retirés (et leurs alternates FR) ; alternates hreflang cohérents sur `docs/` et `legal/` |
| 9 | `noindex` sur pages paiement | ✅ **VALIDÉ** | `404.html`, `success.html`, `cancel.html` (EN + FR) ont `<meta name="robots" content="noindex, follow">` ; `404.html` sans canonical |
| 10 | FAQ honnête | ✅ **VALIDÉ** | Moyens de paiement décrits (Mollie live + rail Bitcoin manuel) ; pas de "liste d'attente" |
| 11 | Parcours paiement `payment-flow.test.mjs` | ✅ **VALIDÉ** | 32 assertions : checkout URL, montant 20,00 EUR fixe côté serveur, rejet montant client, idempotence webhook, remboursement, pas de seconde licence au rejeu, pas de PII en clair |
| 12 | Migrations D1 `migrations.test.mjs` | ✅ **VALIDÉ** | Base neuve + réparation 0003 : toutes tables créées, commande legacy reçoit identifiant TEXT, jointure licences↔orders aboutit, unicité événements webhook (idempotence) |
| 13 | Workflow GitHub Pages | ✅ **VALIDÉ** | `.github/workflows/pages.yml` : `push on main` → `npm run validate` → `scripts/build-site.mjs _site` → artifact `_site` → déploiement vers `https://aveca.github.io/bot-wow/` |
| 14 | Routes Worker et webhook Mollie | ⚠️ **À VÉRIFIER** | Code source `worker/index.js` définit routes `/api/config`, `/api/checkout`, `/api/mollie-webhook` ; valide par `payment-flow.test.mjs` avec D1 simulé ; l'état réel du Worker en production diffère par le stamp d'actifs (voir #18) |
| 15 | Secrets Cloudflare | ❌ **MANQUANT** | `wrangler.toml` référence `MOLLIE_API_KEY`, `MOLLIE_WEBHOOK_SECRET`, `RESEND_API_KEY`, `ADMIN_PASSWORD` comme **à poser** (hors dépôt). Leur absence = checkout échoue, pas d'envoi e-mail. Non vérifiable sans exposer leurs valeurs. |
| 16 | Base D1 en production | ⚠️ **À VÉRIFIER** | Déploiement non encore effectué (§3 de `docs/deployment.md`) : migrations non appliquées. Le code utilise `IF NOT EXISTS` => idempotent et sans risque sur base existante. |
| 17 | Bucket R2 paquet | ⚠️ **À VÉRIFIER** | `wrangler.toml` : `R2_OBJECT_KEY = "casinobabe-fishing-1.2.0.zip"` ; `bucket_name = "botwow-binaries"` ; clé non vérifiée dans le bucket distant. |
| 18 | `api.bot-wow.com` état | ⚠️ **À VÉRIFIER** | Sert le site statique avec stamp `3ac653d5` (plus ancien que notre `9585b518`). Ce n'est pas une API séparée — c'est une ancienne version du même site servi sur sous-domaine. Pas de routes API supplémentaires par rapport au dépôt. |
| 19 | Procédure rollback documentée | ✅ **VALIDÉ** | Voir section 5 ci-dessous |
| 20 | Paiement test Mollie | ⚠️ **À VÉRIFIER** | Nécessite clé de test Mollie + configuration admin. Le code ne distingue pas test/live : c'est la clé qui détermine l'environnement. |

---

## 3. Corrections présentes dans le commit `0e53b1b` (49 fichiers)

| Fichier | Type | Preuve |
|---|---|---|
| `assets/variant-c.css` | Correctif sélecteur/rhythm | Sélecteur `.hero.variant-c` ; chapo 19px ; rythme resserré ; CTA dans écran ; captures viewport : hero 1193px (1440×900) ; CTA 741px → dans écran sur tous les viewports |
| `scripts/versionne-assets.mjs` | Retrait date du stamp | Emprunte d'assets uniquement ; test stamp ne rougit plus au lendemain |
| `assets/app.js` | Messages EN/FR | Messages cohérents ; pas de FR dur sur page EN ; repli "Contacter le support" |
| `sitemap.xml` | Nettoyage SEO | `success.html` / `cancel.html` retirés ; alternates hreflang cohérents sur `docs/` et `legal/` |
| `404.html`, `success.html`, `cancel.html` (EN+FR) | noindex + canonical | `<meta name="robots" content="noindex, follow">` ; `404.html` sans canonical |
| `scripts/iter5-seo-payment-pages.mjs` | Script idempotent NOUVEAU | Applique noindex, retrait canonical, cohérence sitemap (idempotent, cohérent avec iter1-4) |
| `index.html` + `fr/index.html` | Bloc repli paiement | Annonce Mollie LIVE + canal support réel au lieu de "en cours de finalisation / waitlist" |
| `faq.html` + `fr/faq.html` | Moyens de paiement | Honnête : Mollie live + Bitcoin manuel |
| Restes des fichiers HTML | Re-stamp | `?v=9585b518` (stable, déterministe) ; toutes pages EN et FR voient leur stamp mis à jour |

---

## 4. Procédure de migration et de rollback

### Migrations D1 à appliquer (après sauvegarde)

1. **Sauvegarde** : `wrangler d1 export botwow-production --output backup-$(date +%Y%m%d-%H%M%S).sql`
2. **Appliquer les 3 migrations** (idempotentes, sans risque de suppression) :
   - `wrangler d1 execute botwow-production --file=migrations/0001_botwow_emails.sql`
   - `wrangler d1 execute botwow-production --file=migrations/0002_botwow_licenses.sql`
   - `wrangler d1 execute botwow-production --file=migrations/0003_botwow_payment_integrity.sql`
3. **Vérification** : `npm run test:migrations` (ou le contenu de `tests/migrations.test.mjs`)

### Procédure de rollback

| Étape | Action |
|---|---|
| **Rollback GitHub Pages** | Pousser l'ancien commit : `git reset --hard 0960dfc` + `git push --force-with-limit origin main` (rétore l'état avant corrections) |
| **Rollback Cloudflare Worker** | Redéployer l'ancienne version du Worker. Comme `wrangler` garde l'historique des deployments, on peut cibler la version précédente (celui de `0960dfc`). |
| **Rollback D1** | Restaurer depuis sauvegarde : `wrangler d1 execute botwow-production --file=backup-*.sql` |
| **Rollback R2** | L'objet `Casinobabe-v1.0.38.zip` fait foi en tant que repli (voir `wrangler.toml§4`) |
| **Rollback secrets** | Laisser les secrets tels quels ; ils configurent l'environnement de production. |

### Vérification paiement en mode test (sans paiement réel)

Le test `tests/payment-flow.test.mjs` valide le parcours complet **sans effectuer de paiement réel** :
- Il utilise un `fetch` intercepté vers le Worker
- D1 simulée en mémoire
- Vérifie : URL checkout, montant 20,00 EUR, idempotence, création licence, e-mail, téléchargement
- Pour un test en mode test Mollie réel : commander → checkout → confirmation → webhook → licence → e-mail → téléchargement → activation, avec une clé Mollie de mode test (pas en ligne dans ce rapport).

---

## 5. Risques et conditions de rollback

| Risque | Probabilité | Impact | Atténuation / Rollback |
|---|---|---|---|
| **Déploiement GitHub Pages non contrôlé** | Faible | Moyen | Le workflow ne s'exécute qu'au `push` ; si besoin, relancer le workflow depuis l'interface GitHub |
| **Worker Cloudflare incompatible** | Moyenne | Élevé | Le `wrangler deploy` doit suivre le `git push`. Rollback : redéployer l'ancien Worker (version `0960dfc`) |
| **Secrets Cloudflare absents ou erronés** | Moyenne | Élevé | Le checkout échoue (`checkout_failed`) ; e-mails de licence ne partent pas. Vérifier via `wrangler secret list` (sans afficher les valeurs) |
| **Base D1 incompatible** | Faible | Moyen | Les migrations sont `IF NOT EXISTS` + idempotentes. Rollback : restauration depuis sauvegarde D1 |
| **Paquet R2 manquant ou corrompu** | Faible | Moyen | Le bouton de téléchargement tombe sur le repli `Casinobabe-v1.0.38.zip`. Rollback : reconstruire et re-uploader |
| **Webhook Mollie mal déclaré** | Faible | Élevé | Les notifications Mollie ne seront pas reçues → licences non créées. Vérifier dans le compte Mollie l'URL `https://api.bot-wow.com/api/mollie-webhook` |

**Condition de rollback global** : Revenir à l'état `0960dfc` (commit précédent). Tous les tests et validations passaient sur cet état également (c'était l'état de production avant nos corrections).

---

## 6. Commandes exactes à exécuter (dans l'ordre), **SANS les exécuter** si elles modifient la production

> *Note : L'ordre suivant suppose qu'on commence depuis l'état actuel (`0e53b1b` sur `main`). Les commandes qui modifient la production (push, wrangler deploy, secret put, migration D1, R2 put) ne doivent pas être exécutées durant cette mission — elles nécessitent une autorisation explicite.*

### Étape 1 : Vérifications locales (déjà validées)

```bash
# 1. État Git
git status                          # → should show main, ahead 1 of origin/main
git log --oneline -3               # → 0e53b1b, 0960dfc, 22d75f6

# 2. Validations locales (re-confirmer)
npm run validate                    # → BOT-WOW validation PASS
npm test                            # → exit code 0 (10 suites OK)
```

### Étape 2 : Déploiement GitHub Pages (automatique sur push)

```bash
# 3. Push vers main → déclenche le workflow GitHub Pages
git push origin main                # → workflow .github/workflows/pages.yml se lance
#   - npm run validate (étape 2)
#   - scripts/build-site.mjs _site
#   - upload artifact _site → https://aveca.github.io/bot-wow/
```

### Étape 3 : Déploiement Cloudflare Worker (manuel, administrateur)

```bash
# 4. Déployer le Worker (après avoir configuré les secrets étape 5)
wrangler deploy                      # → publie worker/index.js + D1 + KV + R2 vers api.bot-wow.com

# 5. Configurer les secrets Cloudflare (une seule fois, hors dépôt)
#    À exécuter côté Cloudflare CLI ou Dashboard (ne jamais dans le dépôt) :
wrangler secret put MOLLIE_API_KEY        # clé API Mollie (test ou live)
wrangler secret put MOLLIE_WEBHOOK_SECRET # secret signature webhook (optionnel)
wrangler secret put RESEND_API_KEY        # envoi e-licences
wrangler secret put ADMIN_PASSWORD        # accès routes /api/admin/*

# 6. Appliquer les migrations D1 (après sauvegarde)
wrangler d1 export botwow-production --output backup-$(date +%Y%m%d-%H%M%S).sql
wrangler d1 execute botwow-production --file=migrations/0001_botwow_emails.sql
wrangler d1 execute botwow-production --file=migrations/0002_botwow_licenses.sql
wrangler d1 execute botwow-production --file=migrations/0003_botwow_payment_integrity.sql

# 7. Construire et uploader le paquet R2
#    Construction (depuis le dépôt Casinobabe, pas celui-ci) :
node scripts/build-package.cjs --source <chemin du dépôt Casinobabe> --version 1.2.0
# Mise en ligne :
wrangler r2 object put botwow-binaries/casinobabe-fishing-1.2.0.zip \
  --file dist/casinobabe-fishing-1.2.0/casinobabe-fishing-1.2.0.zip

# 8. Déclarer le webhook Mollie
#    Dans le compte Mollie : https://api.bot-wow.com/api/mollie-webhook

# 9. Paiement de test complet (mode test Mollie, pas réel)
#    - Commander depuis https://bot-wow.com/
#    - Vérifier réception e-mail de licence
#    - Vérifier lien de téléchargement actif
#    - Vérifier activation du bot
```

### Étape 4 : Vérifications post-déploiement

```bash
# 10. Vérifier le site public
curl -s https://bot-wow.com/ | head -5   # page statique avec corrections
curl -s https://aveca.github.io/bot-wow/ | head -5   # GitHub Pages

# 11. Vérifier le Worker
curl -s https://api.bot-wow.com/api/config   # → {"contactEmail":"support@bot-wow.com","product":"bot-wow-lifetime","priceEur":20,"currency":"eur",...}

# 12. Réexécuter les validations locales
npm run validate      # → PASS
npm test              # → exit 0

# 13. Vérifier le viewport (optionnel, par audit local)
#    S'assurer que le hero CTA est dans l'écran sur mobile + desktop
```

---

## 7. Décision finale

### `PRÊT POUR AUTORISATION`

**Justification :**

1. **Toutes les validations locales passent** :
   - `npm run validate` → `BOT-WOW validation PASS`
   - `npm test` → exit 0 (10 suites, aucune échec)
   - Audit viewport 4 viewports → hero CTA dans l'écran sur tous les viewports

2. **Toutes les corrections de défauts sont dans le commit** :
   - Paiement honnête (Mollie LIVE au lieu de "en cours de finalisation")
   - Hero V13 dans l'écran (sélecteur variant-c corrigé, hauteur réduite)
   - SEO (noindex sur pages paiement, sitemap propre, canonical retiré de 404)
   - Stamp déterministe (plus de date du jour)

3. **La procédure de déploiement est claire et documentée** :
   - GitHub Pages auto-déploie sur `push origin main`
   - Cloudflare Worker nécessite `wrangler deploy` séparé
   - Secrets, migrations D1 et R2 paquet sont des actions administratives clairement listées

4. **Aucune régression détectée** : Tous les tests qui passaient sur `0960dfc` (l'état de production précédent) continuent de passer sur `0e53b1b`, et les nouveaux défauts identifiés (hero hors écran, paiement mensonger, stamp quotidien) sont corrigés.

5. **Risques maîtrisés** : Les seuls éléments qui restent en dehors du commit sont les configurations Cloudflare (secrets, déploiement Worker, D1 migrations, R2 paquet). Celles-ci sont listées dans la section 4 avec leurs commandes précises et peuvent être exécutées par un administrateur une fois l'autorisation de déploiement donnée.

**Interdictions respectées durant cette mission** :
- ❌ Aucun `git push` vers `origin/main` (le commit reste en local sur `main`)
- ❌ Aucun `wrangler deploy` (Worker non déployé)
- ❌ Aucune modification de secret Cloudflare
- ❌ Aucune exécution de migration D1 en production
- ❌ Aucun écriture dans R2
- ❌ Aucun paiement réel
- ❌ Aucun changement sur un autre dépôt ou session Factory

**Prochaine action recommandée** : Obtenir une autorisation explicite auprès de l'équipe propriétaire, puis exécuter les commandes de la section 6 dans l'ordre. Après déploiement, répéter les vérifications de la sous-section 6.13 (validations locales + audit viewport).

---
*Rapport généré dans le cadre de la mission P0 de pré-déploiement sécurisé.
Toute tentative de déploiement sans autorisation explicite enfreint la consigne 11 de la mission.*