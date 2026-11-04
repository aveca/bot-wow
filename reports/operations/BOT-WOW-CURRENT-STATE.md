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

## 8. Revenue Factory — suivi du 2026-11-04

**PR suivie :** [#69 — BOT-WOW monthly Early Access tiers + sales redesign](https://github.com/aveca/bot-wow/pull/69)
**Branche :** `revenue/early-access-monthly-499-20261104`
**Dernier SHA publié avant ce suivi :** `ce746010ed6b7aa2f14bbf9f5edc4a6492b405da`
**Commit d'implémentation local :** `5ccb1e231e5f20bc15c1e506aa88fce4068f8caa`
**État production vérifié :** aucun déploiement n'a été déclenché par cette mission.

### Preuves fraîches et limites

- R2 `casinobabe-fishing-1.2.0.zip` téléchargé en lecture seule avec Wrangler 4.127.1 : 1 387 543 octets, SHA-256 `1c132f367607ea186feffde8bbda0a1a9f94cdec4b7850b93c57c271270bba4f`, ZIP valide avec 30 entrées, aucun chemin dangereux et 26/26 hashes/tailles du manifeste corrects. Version annoncée : 1.2.0.
- Extraction propre en répertoire temporaire sur Windows 11 Home build 26300; Python 3.14.4 `compileall` réussi. Aucun lancement de l'application, installation dans WoW ou activation n'a été exécuté; pas de VM Windows 10 disponible. L'installation et l'activation réelles restent non vérifiées.
- Les GET de production de `/buy.html` et `/fr/buy.html` répondent 200 avec l'ancien prix ponctuel de 20 € et un bouton désactivé. L'API publique `/api/config` conserve `bot-wow-lifetime`, `priceEur=20`, `currency=eur`. Les quatre anciennes routes `/ab/.../buy.html` répondent 404 en production. La PR ajoute des redirections vers les pages Early Access fermées; ce changement n'est pas publié.
- Le contrat du Worker dans la branche exige `RELEASE_STATUS=confirmed` et échoue fermé par défaut; tests couvrent `pending`, `open` et l'absence avant tout appel Mollie ou insertion de commande. La valeur du secret de production n'a pas été lue.
- Le flux d'achat appelle Resend et conserve l'ID provider uniquement en mémoire; la table `deliveries` ne documente que les échecs. La route historique `/api/resend` est un stub log-only. `script-settings` Cloudflare a retourné `observability: null`; aucun résultat provider historique ne peut être confirmé depuis cette session. Aucun e-mail n'a été envoyé.
- Les quatre observations de revue Codex sont traitées dans la conception (§15.1–15.4); le re-review sur `ce74601` était terminé sans finding non résolu. La logique abonnement/reprise des webhooks/chargeback demeure une conception à implémenter et tester en Mollie TEST avant toute ouverture. Ahrefs ne permettait pas les requêtes avec le plan connecté; Search Console BOT-WOW n'est pas connecté.

### État commercial et suite

Les tarifs mensuels proposés sont affichés comme indisponibles, sans formulaire, collecte d'e-mail, réservation ou checkout. Le prix API de 20 € ponctuel est inchangé. Aucun paiement, remboursement, envoi d'e-mail, modification de secret/binding, migration D1/R2 ou déploiement n'a eu lieu. Les tests locaux et les modifications de cette branche doivent encore passer CI et une revue Codex sur le nouveau SHA.

**Prochaine action :** publier la branche et faire tourner CI/revue sur son SHA final; garder la caisse live fermée tant que l'installation Windows, l'activation, le fulfillment Resend et les tests récurrents n'ont pas de preuve vérifiable.
