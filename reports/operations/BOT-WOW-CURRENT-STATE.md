# BOT-WOW — État courant Factory V3 (2026-10-28)

**Dépôt :** https://github.com/aveca/bot-wow  
**Branche :** `main`  
**SHA actuel de main :** `7d6cc4e` (après `git pull --ff-only`, vérifié localement)  
**PR #54 :** **MERGED** sur main (SHA `ff55666` de la branche, merge commit dans `7d6cc4e`)  
**Dernière mise à jour de ce document :** 2026-10-28 (post-merge PR #54)

---

## 1. État des vérifications (directement observées)

| Élément | Valeur | Preuve |
|---------|--------|--------|
| SHA de `main` | `7d6cc4e` | `git log main -1`, `git pull --ff-only` depuis origin |
| PR #54 | MERGED | `gh pr view 54` : state=MERGED, headRefOid=`ff55666` |
| Checks CI sur PR #54 | `validate` SUCCESS, `ui-quality` SUCCESS, `GitGuardian` SUCCESS | Runs 40654318060, 40654318065, GitGuardian |
| Tests Playwright e2e | 156 passés | 6 suites : demo-quality, accessibility, checkout-flow, responsive, i18n, visual-inspection |
| `node scripts/validate.mjs` | PASS | Exécuté localement |
| `node tests/link-check.test.mjs` | OK | 44 pages, aucun lien mort, aucune ancre morte |
| `node tests/release-availability.test.mjs` | OK | Garde-fou présent sur buy.html et fr/buy.html |

---

## 2. Corrections UI/UX appliquées (PR #54, dans main)

| Fichier | Correction | État |
|---------|-----------|------|
| `buy.html` | Skip link, `id="hero"`, `aria-describedby` email, bouton désactivé, message checkout-bloqué | ✅ |
| `fr/buy.html` | Même chose en FR | ✅ |
| `index.html` | Bouton d'achat désactivé, message `.checkout-blocked`, `aria-describedby` | ✅ |
| `fr/index.html` | Même chose en FR, lien légal `../legal/fr/*` corrigé | ✅ |
| `compare.html` | **Défaut critique corrigé** : bouton d'achat était activé → désactivé, `.checkout-blocked` ajouté, `aria-describedby` | ✅ |
| `fr/compare.html` | Même chose en FR, lien légal `../legal/fr/terms.html` corrigé | ✅ |
| `assets/app.js` | `aria-invalid` géré sur validation email, focus automatique sur le champ | ✅ |
| `tests/e2e/visual-inspection.spec.mjs` | 26 nouveaux tests d'inspection visuelle (styles calculés, overflow, état boutons) | ✅ |

**Garde-fou commercial maintenu :** le checkout est désactivé sur toutes les pages de vente (buy.html, fr/buy.html, index.html, fr/index.html, compare.html, fr/compare.html). Aucun paiement n'a été activé. L'ouverture commerciale reste une décision distincte nécessitant autorisation explicite.

---

## 3. Archive v1.2.0 — État vérifié (P0.7)

| Élément | Valeur | Statut |
|---------|--------|--------|
| Objet R2 | `botwow-binaries/casinobabe-fishing-1.2.0.zip` | ✅ Présent, téléchargé avec succès via `wrangler r2 object get --remote` |
| SHA-256 R2 | `1c132f367607ea186feffde8bbda0a1a9f94cdec4b7850b93c57c271270bba4f` | ✅ Identique à l'archive locale |
| Taille | 1 387 543 octets | ✅ Correspond |
| VERSION | 1.2.0 | ✅ |
| MANIFEST.json | 15 fichiers avec SHA-256 individuels | ✅ Présent localement |

**État R2 :** `PRESENT_VERIFIED`. La présence de l'objet ne prouve pas à elle seule le fulfillment Mollie complet.

---

## 4. Secrets Cloudflare — Inventaire sans exposition

Les noms de binding suivants sont présents comme `secret_text` (valeurs non lues, non exposées) :
`MOLLIE_API_KEY`, `RESEND_API_KEY`, `MOLLIE_WEBHOOK_SECRET`, `ADMIN_JWT_SECRET`, `ADMIN_EMAIL`, `CONTACT_EMAIL`, `LICENSE_SECRET`, `EXPORT_TOKEN`, `ADMIN_PASSWORD_HASH`, `RELEASE_STATUS`, `MOLLIE_PROFILE_ID`.

**Aucune modification de secret n'a été effectuée.** Aucune valeur de secret n'a été affichée ni journalisée.

---

## 5. Code du téléchargement — État

Le Worker `botwow-api` dans main tente `env2.R2_OBJECT_KEY`, puis `casinobabe-fishing-1.2.0.zip`, puis `Casinobabe-v1.0.38.zip` (repli historique). Retourne `404 file_not_found` si aucun objet n'est disponible. **Aucun déploiement Worker n'a été effectué dans cette mission.**

PR #19 (branche `fix/download-artifact-integrity-20261023`, HEAD `0a1a6a5`) existe et propose d'interdire le repli vers l'archive historique — non fusionnée, à réconcilier séparément.

---

## 6. Protocole obligatoire au début de chaque session (AGENTS.md)

1. Lire `reports/operations/BOT-WOW-CURRENT-STATE.md` comme snapshot persistant.
2. Ne pas redemander de reconfigurer Cloudflare à chaque session.
3. Ne pas recréer de secrets parce que leurs valeurs sont masquées.
4. Ne pas créer `ADMIN_PASSWORD` (binding observé : `ADMIN_PASSWORD_HASH`).
5. Ne pas lancer `wrangler secret put`, modifier un secret/binding, ou déployer Worker/Pages sans preuve précise et autorisation explicite.
6. Ne pas prétendre qu'un changement est en production parce qu'il est dans une branche/PR.
7. Pour les changements de téléchargement, examiner en priorité PR #19.
8. R2, mutations de production, paiements/emails réels : prohibés sans autorisation explicite.
9. Après chaque mission, mettre à jour ce document avec date, preuves, commit, liens, bloqueurs, prochaine action. Publier sur GitHub.

---

## 7. Prochaine action directement exécutable

**Immédiatement (sans autorisation) :** Aucune mutation de production n'est autorisée. Le code de la PR #54 est mergé dans main (`7d6cc4e`) et vérifié par CI.

**Après autorisation humaine explicite :**
1. Déployer le Worker `botwow-api` (`wrangler deploy` depuis main) — avec rollback vérifiable.
2. Vérifier le déploiement Pages automatiquement déclenché sur main.
3. Lever le garde-fou commercial (décision distincte, nécessite autorisation séparée).

**Blocage restant :** Aucune autorisation de déploiement ni d'ouverture commerciale n'a été obtenue. Le garde-fou commercial reste actif.

---

## 8. Session 2026-11-27 — correctif assets `.git/`

**PR :** PR créée depuis la branche `fix/assetsignore-git-20261127-main` (base `main` `2edd74be83f272672b303ccdb316d52137109076`) — PR #230 d'origine a été fermée : sa base incluait 9 commits de la mission `revenue/early-access-monthly-499` (mélange de missions interdit par AGENTS.md).
**Commit :** voir la PR (1 fichier, +7 lignes)
**Déployé :** non. Aucun déploiement Worker ni Pages ; aucun secret modifié ; aucun paiement testé.

### Faits directement vérifiés (outils : wrangler 4.127.1, git, docs Cloudflare)

| Fait | Preuve |
|---|---|
| `[assets] directory = "./"` (racine du dépôt) dans `wrangler.toml` | lecture fichier |
| `.git` local = **69,2 MiB**, pack unique **68,3 MiB** | mesure disque (`os.walk`) |
| Wrangler lisait bien le `.git` comme asset : `wrangler dev` échouait | `C:\factory-service\logs\bot_wow_api.log`, 2026-11-27 18:10 et 18:12 UTC : `Asset too large ... pack-c49b8139...pack 68.3 MiB` |
| Limite produit : **25 MiB par fichier d'asset** (inchangée, toutes offres) | doc Cloudflare (changelog 2025-09-04) |
| Mécanisme d'exclusion officiel = `.assetsignore` (style gitignore) | doc Cloudflare, framework-guides/automatic-configuration |
| AVANT : `npx wrangler deploy --dry-run` → `Read 1123 files` puis **erreur** `Asset too large` | exécution réelle, session du 2026-11-27 |
| APRÈS : même commande → `Read 1127 files`, build valide, `Total Upload: 258.86 KiB / gzip: 63.79 KiB`, `--dry-run: exiting now` | exécution réelle, même machine, même poste |
| `wrangler deploy --dry-run` ne publie rien (build + validation, aucun appel API, aucune credential) | doc Cloudflare (cf/projects) |
| Workflows CI : `pages.yml` / `validate.yml` = push `main` ; `ui-quality.yml` = PR vers `main` | lecture `.github/workflows/*.yml` — push d'une branche feature ne déploie rien |
| `git diff --check` : propre | exécution |
| Untracked `artifacts/ui/*` (15 fichiers) et `test-results/` : **préservés, non commités** | `git status` |

### Effet secondaire du défaut (risque réel)

Le pack contenait **l'intégralité de l'historique git du dépôt** : sans l'exclusion, il aurait été servi comme asset statique public dès qu'un déploiement aurait franchi le contrôle de taille.

### Observations non corrigées (hors périmètre de cette PR)

- `test-results/` et `artifacts/` (sorties locales de tests Playwright) restent candidats à une exclusion d'assets — non bloquants, à traiter si le besoin est démontré.
- `wrangler 4.127.1` local vs `4.169.0` disponible (message wrangler).

**Prochaine action :** faire tourner `validate.yml` + `ui-quality.yml` sur la PR ; après merge autorisé seulement, vérifier en production que `wrangler dev`/`deploy` ne reprennent pas ce blocage.