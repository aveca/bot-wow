# BOT-WOW — État courant Factory V3 (2026-11-04)

**Dépôt :** https://github.com/aveca/bot-wow
**Branche par défaut :** `main` — SHA `2edd74be83f272672b303ccdb316d52137109076` (`ci(pages): ignore agent instructions-only updates`)
**Dernière mise à jour de ce document :** **2026-11-04** (mission P0 « preuve de livraison »)
**Rapport de la mission :** [`reports/operations/2026-11-04-p0-delivery-proof.md`](./2026-11-04-p0-delivery-proof.md)

> Ce document est le snapshot opérationnel persistant. Il remplace le snapshot du 2026-10-28 (SHA `7d6cc4e`), dont les chiffres de commandes payées ont été **invalidés** par les vérifications du 2026-11-04 (voir § 2).

---

## 1. État des vérifications (directement observées le 2026-11-04)

| Élément | Valeur | Preuve |
|---------|--------|--------|
| SHA de `main` | `2edd74b` | `git log origin/main -1` |
| Branche de la mission P0 | `p0/delivery-proof-20261104` | 6 commits au-dessus de `main` |
| `npm test` (21 suites) | **exit 0** | exécuté localement, logs conservés |
| `npm run validate` | **exit 0** — `BOT-WOW validation PASS` | exécuté localement |
| `git diff --check` | exit 0 | exécuté localement |
| PR #67 | **OPEN**, `e0dd64a`, CI verte (validate / ui-quality / GitGuardian), MERGEABLE/CLEAN | `gh pr view 67` |
| PR #68 | **OPEN**, `3f2c332`, CI verte, MERGEABLE/CLEAN | `gh pr view 68` |
| Checkout public | **toujours fermé** (bouton désactivé EN + FR) | HTML de `/buy` et `/fr/buy` récupéré |

---

## 2. ⚠️ Correction d'un chiffre antérieur erroné (à lire avant tout reporting)

Le snapshot du 2026-10-28 et plusieurs rapports antérieurs laissaient entendre que des commandes étaient **payées**.

**Vérification du 2026-11-04 sur `botwow-production` (lecture seule) :**

| Affirmation antérieure | État réel vérifié |
|-----------------------|-------------------|
| « 5 commandes payées, 100 € encaissés » | 5 commandes `paid` — mais **provider `bitcoin_manual`**, e-mails `@example.com` → **fixtures de test**, aucun client |
| « le tunnel de paiement fonctionne » | 11 commandes Mollie, **toutes `failed`**, e-mails `@bot-wow.fr` (×10) et `@test.fr` (×1) → **tests internes** |
| « des licences ont été délivrées » | 5 licences, toutes `order_id = ord_legacy_*` (historique Bitcoin) → **jamais issues de Mollie** |

> **Aucun paiement client réel n'a jamais été encaissé. Revenu réel : 0 €. Livraisons (`deliveries`) : 0 ligne.**

**Règle :** ne jamais présenter `orders.status='paid'` comme une preuve de vente sans vérifier `provider`, `provider_id` et le domaine e-mail.

---

## 3. Archive v1.2.0 — vérifiée indépendamment

| Élément | Valeur | Statut |
|---------|--------|--------|
| Objet R2 | `botwow-binaries/casinobabe-fishing-1.2.0.zip` | ✅ présent (`wrangler r2 object get --remote`) |
| Taille | 1 387 543 octets | ✅ |
| SHA-256 | `1c132f367607ea186feffde8bbda0a1a9f94cdec4b7850b93c57c271270bba4f` | ✅ recalculé sur la copie téléchargée |
| Entrées | 30 (bot `.py`, add-on Lua, `MANIFEST.json`, `VERSION` = 1.2.0) | ✅ |

**Présence de l'archive ≠ livraison prouvée.** La livraison reste à prouver par un paiement test concluant.

---

## 4. Défauts corrigés dans la branche `p0/delivery-proof-20261104`

| Défaut | Où | Correctif | Commit |
|--------|-----|-----------|--------|
| Stamp des assets périmé sur `main` (CI le masquait) | 51 fichiers | régénération | `913cab1` |
| Repli vers l'archive obsolète `Casinobabe-v1.0.38.zip` ; quota consommé avant vérification de l'artefact | code **déployé** | intégration PR **#19** | `cb47155` |
| **Garde `RELEASE_STATUS` absente de `main` alors qu'elle est déployée en production** → un déploiement depuis `main` aurait supprimé la garde | `main` | intégration PR **#44** | `90c97bf` |
| Rejeu du webhook ignoré après le verrou → client payé sans licence, définitivement | `worker/index.js` | reprise idempotente de la livraison | `f7f9904` |
| `deliveries` alimentée seulement en cas d'échec → impossible de distinguer « licence créée » de « licence livrée » | `worker/index.js` | journal de livraison (`pending`/`sent`), **un reçu unique par licence** | `f7f9904`, `0b8cbef` |
| Renvoi client `/api/resend` **log-only** (aucun e-mail envoyé) | `worker/index.js` | vrai envoi (mode `force`), réponse neutre | `2a025a4` |
| Renvoi admin avec **URL de staging** (`botwow-api-staging.m4ngo.workers.dev`) + log-only | `worker/index.js` | vrai envoi + URL de production ; `502` si échec | `2a025a4` |
| `license_activated` non mesuré (dernier maillon du parcours) | `worker/index.js` | événement émis (référence irréversible, sans donnée personnelle) | `f7f9904` |
| `tests/funnel.test.mjs` **crashait** → hors de la chaîne CI | tests | réparé (33 contrôles) + réintégré à `npm test` | `f7f9904` |
| Un commit documentaire déclenchait un déploiement Pages | `.github/workflows/pages.yml` | `reports/**` en `paths-ignore` | `0b8cbef` (non commité à la date de cette ligne — voir § 7) |

---

## 5. Code du téléchargement et garde de livraison — état réel

- **En production** (déploiement du 27/10, code lu via l'API Cloudflare) : la garde `RELEASE_STATUS` **est déployée** (`409 delivery_unverified` avant tout appel Mollie), mais le code servait encore l'archive historique en repli et ne vérifiait pas la présence de l'artefact.
- **Dans `main`** : ni la garde ni le correctif d'artefact n'étaient présents.
- **Dans la branche P0** : les deux sont integrated (`cb47155`, `90c97bf`) — l'intégrité de l'artefact et la garde serveur.
- **Aucun déploiement n'a été effectué par cette mission.**

---

## 6. Entonnoir réel (base `botwow-analytics`, historique complet depuis le 22/10)

`page_view` 1 457 → `journey_view` 543 → `cta_click` 56 → `checkout_requested` 31 → `checkout_created` 6 → `checkout_failed` **6** → `payment_confirmed` **0** → `license_created` **0** → `delivery_sent` **0** → `license_activated` **0**.

**6 créations de paiement, 6 échecs, 0 conversion.**

---

## 7. Commits de la mission P0

| SHA | Sujet |
|-----|-------|
| `913cab1` | chore(assets): régénérer le stamp des assets (main était périmé) |
| `cb47155` | Merge PR #19 : intégrité de l'archive livrée |
| `90c97bf` | Merge PR #44 : garde de livraison côté serveur (409 avant encaissement) |
| `f7f9904` | fix(worker): rendre la livraison reprenable et observable |
| `2a025a4` | fix(worker): rendre le renvoi de licence réellement opérationnel |
| `0b8cbef` | fix(worker): un seul reçu de livraison par licence |

*(Un commit supplémentaire `.github/workflows/pages.yml` (`reports/**` en `paths-ignore`) est ajouté au moment de la publication — voir le SHA final dans la PR.)*

---

## 8. Secrets Cloudflare — inventaire sans exposition

Bindings `secret_text` observés (valeurs **non lues**, non exposées, non modifiées) :
`MOLLIE_API_KEY`, `RESEND_API_KEY`, `MOLLIE_WEBHOOK_SECRET`, `ADMIN_JWT_SECRET`, `ADMIN_EMAIL`, `CONTACT_EMAIL`, `LICENSE_SECRET`, `EXPORT_TOKEN`, `ADMIN_PASSWORD_HASH`, `RELEASE_STATUS`, `MOLLIE_PROFILE_ID`.

**Aucune modification de secret, aucun `wrangler secret put`.** La validité fonctionnelle de `RESEND_API_KEY` reste **non vérifiée** (les valeurs de secrets ne sont jamais lues) — et `deliveries = 0` en production est cohérent avec un envoi qui n'aurait jamais abouti.

---

## 9. Blocages en cours

| Blocage | Cause | Qui peut le lever |
|---------|-------|-------------------|
| Test de paiement Mollie réel (mode test) | aucune clé `MOLLIE_API_KEY` de test disponible | fourniture d'une clé de test |
| Déploiement du Worker corrigé | autorisation requise (`AGENTS.md` règle 5) | autorisation humaine explicite |
| Ouverture du checkout (`RELEASE_STATUS=confirmed`) | décision commerciale | autorisation humaine explicite |
| Fermeture des PR #19 / #44 après merge | maintenance | mainteneur |
| PR #68 déclenche un déploiement Pages | réorganisation non faite | PR dédiée |

---

## 10. Prochaine action directement exécutable

**Immédiatement, sans autorisation :** merger la PR de la branche `p0/delivery-proof-20261104` (CI verte) — puis **s'arrêter**. Le Worker corrigé n'est pas en production tant que le déploiement n'est pas autorisé.

**Après autorisation humaine explicite, dans cet ordre :**
1. Déployer le Worker `botwow-api` **en gardant `RELEASE_STATUS=pending`** (le checkout reste donc fermé).
2. Vérifier le code déployé via l'API Cloudflare, et confirmer que le checkout répond toujours `409`.
3. Effectuer un paiement test Mollie (mode test) et constater : licence créée, jeton créé, e-mail reçu, **reçu `sent` dans `deliveries`**.
4. **Seulement alors**, décider de `RELEASE_STATUS=confirmed` et de la réouverture du checkout (PR préparée en brouillon, non fusionnée).

**Garde-fou commercial maintenu :** le checkout reste désactivé sur toutes les pages de vente et refusé côté serveur. Les avertissements publics de non-livraison **n'ont pas été supprimés** — ils sont exacts tant qu'aucun paiement test concluant n'est enregistré.

---

## 11. Rappel de protocole (inchangé)

1. Lire ce document comme snapshot persistant. 2. Ne pas redemander la reconfiguration Cloudflare.
3. Ne pas recréer de secrets parce que leurs valeurs sont masquées. 4. Ne pas créer `ADMIN_PASSWORD` (le binding est `ADMIN_PASSWORD_HASH`).
5. Pas de `wrangler secret put` ni de déploiement sans preuve précise **et autorisation explicite**.
6. Ne pas prétendre qu'un changement est en production parce qu'il est dans une branche ou une PR.
7. Pour le téléchargement, examiner PR #19 avant d'éditer. 8. R2, production, paiements/e-mails réels : prohibés sans autorisation.
9. Mettre à jour ce document en fin de mission et **publier sur GitHub**.
10. Un commit documentaire ne doit pas déclencher de déploiement applicatif (`paths-ignore`).
