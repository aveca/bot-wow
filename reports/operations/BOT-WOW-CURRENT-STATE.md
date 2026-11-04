# BOT-WOW — Rapport P0.25 : First Real Sale Readiness

**Date :** 2026-11-04
**Dépôt :** https://github.com/aveca/bot-wow
**Main :** `595e7acd85996512d404a3f4b2b278ea2c4bfe35`

---

## 1. Mollie account separation (P0-A)

### Constat

- Un appel `ListProfiles` (lecture seule, effectué dans une session précédente) a retourné **un seul profil** : `pfl_t8KCk4Cm2C`, website `https://sargasses-martinique.com/`, status `verified`.
- **Aucun profil BOT-WOW n'est visible.** Le BOT-WOW profile est manquant.
- La clé Mollie configurée sur le Worker `botwow-api` est une **API Key** (binding `secret_text`, valeur non lue). Son type exact (test vs live) n'est pas vérifié (les valeurs de secrets ne sont jamais lues).
- `MOLLIE_PROFILE_ID` est configuré comme `secret_text` (valeur non lue, possiblement un placeholder).

### Conclusion

- **NE JAMAIS utiliser le profil Sargasses** pour BOT-WOW. Les deux comptes Mollie doivent être séparés.
- Un profil BOT-WOW dédié et une clé de test (`test_...`) sont **requis** pour effectuer un paiement test.
- Aucune création de profil, modification de secret ou paiement n'a été effectuée (pas d'autorisation).

---

## 2. PR #77 — Mollie profileId correction

- **État :** OPEN, draft, MERGEABLE, CI verte (validate + ui-quality + GitGuardian).
- **HEAD :** `502da4efb0f4b05a05ff560396160b929e68073c`
- **Diff vérifié :**
  - `createMolliePayment()` : `profileId` jamais envoyé avec une API Key.
  - Webhook `fetchMolliePayment()` : `profileId` jamais envoyé avec une API Key.
  - `mollieFetch()` : logique conditionnelle — `sendProfileId = includeProfileId && !isApiKey && env2.MOLLIE_PROFILE_ID`.
  - Tests : 2 assertions de régression (API Key n'envoie pas profileId au paiement ni à la lecture webhook ; org token envoie profileId).
- **Aucun changement de prix, de checkout gate ou de RELEASE_STATUS.**
- **RELEASE_STATUS reste `pending`.**
- **Verdict :** PR saine, fusionnable après review.

---

## 3. PR #79 — Checkout copy honesty

- **État :** **MERGED** (2026-11-04).
- **HEAD :** `85f6af3948f399881c6dea027a1d6a02b6c2a057`
- **158 Playwright tests passed** (CI verte).
- Vérification : aucune fausse claim Mollie-live, pas de promesse de redirect pendant que le checkout est désactivé, prix 20 EUR inchangé, boutons désactivés EN+FR, cohérence EN/FR.
- **Le checkout reste fermé** après cette PR.

---

## 4. PR #78 — Operational state documentation

- **État :** OPEN, MERGEABLE.
- **Contenu :** documentation opérationnelle (revalidation lecture seule). Pas de changement de code.
- **Verdict :** utile pour la traçabilité. Fusionnable sans risque.

---

## 5. PR #66 — Compliance pivot (non-automating MVP)

- **État :** OPEN, CONFLICTING (besoin de rebase).
- **Contenu :** garde-fou serveur `sales_suspended`, MVP non-automatisant (planificateur manuel, carnet de spots, import/export JSON, simulateur de rendement, démo interactive), documentation des risques de conformité Blizzard.
- **Évaluation :** la proposition est pertinente pour la conformité, mais elle **ne remplace pas** le produit actuel sans décision explicite. Le code existant (bot automatisant) reste le produit commercial.
- **Recommandation :** préparer une implémentation séparée. Ne pas merger sans décision produit.

---

## 6. Delivery readiness

| Élément | État | Preuve |
|---------|------|--------|
| Archive R2 v1.2.0 | ✅ présente | 1 387 543 o, SHA `1c132f367607ea186feffde8bbda0a1a9f94cdec4b7850b93c57c271270bba4f` (recalculé) |
| Worker production | ✅ déployé | `/health` → `{"status":"ok","version":"1.0.0"}`, déploiement du 27/10 |
| `RELEASE_STATUS` | `pending` (garde active) | env secret, code par défaut `pending` |
| Code corrigé | ✅ mergé (PR #71) | idempotence, journal, renvoi, garde, `license_activated` |
| Checkout public | ✅ fermé | boutons désactivés EN+FR |
| Checkout serveur | ✅ 409 | `delivery_unverified` avant tout appel Mollie |
| Tests | ✅ 21 suites, exit 0 | `npm test` |
| Paiement test Mollie | ❌ non exécuté | aucune clé de test disponible |

**Le produit peut être livré** : le code gère la création de licence, le jeton de téléchargement, l'envoi d'e-mail et le reçu `sent`. Mais la chaîne n'a pas été prouvée en conditions réelles.

---

## 7. Mollie account separation

- **Profil Sargasses** (`pfl_t8KCk4Cm2C`) : vérifié, website sargasses-martinique.com.
- **Profil BOT-WOW** : **absent**. Aucun profil BOT-WOW visible dans l'appel ListProfiles.
- **Action requise :** créer un profil BOT-WOW dédié dans le compte Mollie, puis générer une clé de test (`test_...`).
- **Interdiction :** ne jamais utiliser le profil Sargasses pour BOT-WOW.

---

## 8. Real revenue

**0 €. 0 vente.** Aucun paiement client réel n'a jamais été encaissé.

---

## 9. Blocages restants

| Blocage | Cause | Qui peut le lever |
|---------|-------|-------------------|
| Test de paiement Mollie réel | aucune clé `MOLLIE_API_KEY` de test disponible | fourniture d'une clé de test |
| Profil Mollie BOT-WOW | profil manquant | création dans le compte Mollie |
| Déploiement du Worker corrigé | autorisation requise | autorisation humaine explicite |
| Ouverture du checkout (`RELEASE_STATUS=confirmed`) | décision commerciale | autorisation humaine explicite |
| PR #67 et #68 | need rebase sur le nouveau main | mainteneur |
| PR #66 | CONFLICTING, décision produit requise | décision humaine |

---

## 10. Prochaine action unique pour la première transaction test puis la première vente réelle

**Obtenir une clé Mollie de test** (commençant par `test_`) liée à un profil BOT-WOW dédié, puis :

1. L'injecter via `wrangler secret put MOLLIE_API_KEY` (sans afficher la valeur).
2. Déployer le Worker depuis `main` (`084e2bd`) avec `RELEASE_STATUS=pending`.
3. Vérifier le code déployé via l'API Cloudflare.
4. Exécuter un paiement test Mollie (mode test) → vérifier : licence créée → jeton créé → e-mail reçu → reçu `sent` dans `deliveries` → activation réussie.
5. Si la chaîne est prouvée : décider `RELEASE_STATUS=confirmed` (autorisation distincte) + fusionner PR #72.

**Sans cette clé, la preuve de bout en bout est impossible.**

---

### Prompt pour P0.26

> **MISSION P0.26 — FIRST TEST TRANSACTION**
>
> Objectif : exécuter le premier paiement test Mollie de bout en bout et prouver la chaîne de livraison.
>
> Prérequis (autorisation humaine) :
> 1. Profil Mollie BOT-WOW créé dans le compte Mollie.
> 2. Clé Mollie de test disponible (variable `MOLLIE_API_KEY` = `test_...`).
> 3. Clé Resend de test (ou validation de la clé existante).
> 4. Autorisation de déployer le Worker (avec `RELEASE_STATUS=pending`).
>
> Actions :
> 1. Injecter la clé de test : `wrangler secret put MOLLIE_API_KEY`.
> 2. Déployer le Worker depuis `main` (084e2bd) avec `RELEASE_STATUS=pending`.
> 3. Vérifier le code déployé via l'API Cloudflare.
> 4. Exécuter un paiement test Mollie (mode test).
> 5. Vérifier : licence créée → jeton créé → e-mail reçu → reçu `sent` → activation réussie.
> 6. Si concluant : décider `RELEASE_STATUS=confirmed` + fusionner PR #72.
>
> Interdictions : aucun paiement réel, aucun changement de prix, aucun déploiement sans autorisation, `RELEASE_STATUS` reste `pending`.
>
> Livrable : rapport avec preuve de la chaîne et décision sur `RELEASE_STATUS`.</think><|channel|><|start|>assistant<|channel|>analysis<|message|>The user has provided a comprehensive mission brief (P0.25). I've already done most of the work in previous sessions. Let me now produce the final report and update the state document.

Let me summarize what I've done:
1. ✅ Mollie account separation diagnosis (read-only) — Sargasses profile found, BOT-WOW profile missing
2. ✅ PR #77 review — diff verified, tests pass, CI green
3. ✅ PR #79 verification — merged, 158 Playwright tests passed
4. ✅ Delivery readiness — archive verified, Worker deployed, code merged, checkout closed
5. ✅ PR #66 compliance assessment — draft, conflicting, non-automating MVP proposed
6. ✅ Updated state doc (in previous sessions)
7. ✅ Final report produced

I should now update the BOT-WOW-CURRENT-STATE.md with the P0.25 findings and produce the final report. Let me do that.

Actually, looking at the conversation, I've already produced a comprehensive report in my last response. Let me just make sure the state doc is updated and finalize.

Let me update the state doc with P0.25 findings.<|end|><|start|>-start<|message|>assistant to=write<|channel|>analysis <|constrain|>xml<|message|><rfl:parameter name="content">
# BOT-WOW — État courant Factory V3 (2026-11-04, P0.25)

**Dépôt :** https://github.com/aveca/bot-wow
**Branche par défaut :** `main` — SHA `595e7acd85996512d404a3f4b2b278ea2c4bfe35` (docs live-revalidation #76)
**Dernière mise à jour :** 2026-11-04 (mission P0.25)
**Rapport de la mission :** ce document (synthèse P0.25)

---

## 1. État commercial (faits vérifiés)

| Métrique | Valeur | Source |
|----------|--------|--------|
| Ventes payées vérifiées | **0** | D1 `botwow-production` |
| Revenu encaissé | **0 €** | idem |
| Checkout public | **fermé** (boutons désactivés EN+FR) | HTML récupéré |
| Checkout serveur | **409 `delivery_unverified`** (garde `RELEASE_STATUS=pending`) | code déployé |
| Archive R2 v1.2.0 | présente, SHA vérifié | `1c132f367607ea186feffde8bbda0a1a9f94cdec4b7850b93c57c271270bba4f` |
| Funnel (90 j) | 1 457 vues → 56 CTA → 31 checkout_requested → 6 créées → 6 échouées → 0 conversion | `botwow-analytics` |
| PR #71 | **MERGED** (`084e2bd`) | `gh pr view 71` |
| PR #77 | **OPEN**, draft, MERGEABLE, CI verte | `gh pr view 77` |
| PR #79 | **MERGED** | `gh pr view 79` |
| PR #78 | **OPEN**, MERGEABLE | `gh pr view 78` |
| PR #66 | **OPEN**, CONFLICTING | `gh pr view 66` |
| PR #67, #68 | **OPEN**, need rebase | `gh pr view` |

---

## 2. Correction Mollie (PR #77) — root cause B1

**Cause :** `createMolliePayment()` et le webhook appelaient `mollieFetch()` avec `includeProfileId=true`, ajoutant `?profileId=...` à l'URL. Avec une clé API Mollie (`test_*` / `live_*`), l'envoi de `profileId` provoque un `400 Bad Request: Invalid Authorization header`.

**Fix :** ne jamais envoyer `profileId` avec une clé API. Seuls les tokens OAuth/Org nécessitent `profileId`.

**Tests :** 2 assertions de régression (API Key n'envoie pas profileId au paiement ni à la lecture webhook ; org token envoie profileId).

**CI :** validate PASS, ui-quality PASS, GitGuardian PASS.

---

## 3. Mollie account separation

- **Profil Sargasses** (`pfl_t8KCk4Cm2C`) : vérifié, website sargasses-martinique.com. **NE PAS UTILISER** pour BOT-WOW.
- **Profil BOT-WOW** : **absent**. Aucun profil BOT-WOW visible.
- **Action requise :** créer un profil BOT-WOW dédié, puis générer une clé de test (`test_...`).
- `MOLLIE_API_KEY` et `MOLLIE_PROFILE_ID` sont configurés comme `secret_text` (valeurs non lues).

---

## 4. Delivery readiness

| Élément | État | Preuve |
|---------|------|--------|
| Archive R2 v1.2.0 | ✅ présente | 1 387 543 o, SHA `1c132f367607ea186feffde8bbda0a1a9f94cdec4b7850b93c57c271270bba4f` |
| Worker production | ✅ déployé | `/health` → `{"status":"ok","version":"1.0.0"}`, déploiement du 27/10 |
| `RELEASE_STATUS` | `pending` (garde active) | env secret, code par défaut `pending` |
| Code corrigé | ✅ mergé (PR #71) | idempotence, journal, renvoi, garde, `license_activated` |
| Checkout public | ✅ fermé | boutons désactivés EN+FR |
| Checkout serveur | ✅ 409 | `delivery_unverified` avant tout appel Mollie |
| Tests | ✅ 21 suites, exit 0 | `npm test` |
| Paiement test Mollie | ❌ non exécuté | aucune clé de test disponible |

---

## 5. PR #66 — Compliance pivot

- **État :** OPEN, CONFLICTING (besoin de rebase).
- **Contenu :** garde-fou serveur `sales_suspended`, MVP non-automatisant (planificateur manuel, carnet de spots, import/export JSON, simulateur de rendement, démo interactive), documentation des risques de conformité Blizzard.
- **Évaluation :** proposition pertinente pour la conformité. **Ne remplace pas** le produit actuel sans décision explicite.
- **Recommandation :** préparer une implémentation séparée. Ne pas merger sans décision produit.

---

## 6. Secrets Cloudflare — inventaire sans exposition

Bindings `secret_text` observés (valeurs non lues, non modifiées) :
`MOLLIE_API_KEY`, `RESEND_API_KEY`, `MOLLIE_WEBHOOK_SECRET`, `ADMIN_JWT_SECRET`, `ADMIN_EMAIL`, `CONTACT_EMAIL`, `LICENSE_SECRET`, `EXPORT_TOKEN`, `ADMIN_PASSWORD_HASH`, `RELEASE_STATUS`, `MOLLIE_PROFILE_ID`.

**Aucune modification de secret.** La validité fonctionnelle de `RESEND_API_KEY` et `MOLLIE_API_KEY` reste non vérifiée.

---

## 7. Real revenue

**0 €. 0 vente.** Aucun paiement client réel n'a jamais été encaissé.

---

## 8. Blocages restants

| Blocage | Cause | Qui peut le lever |
|---------|-------|-------------------|
| Test de paiement Mollie réel | aucune clé `MOLLIE_API_KEY` de test disponible | fourniture d'une clé de test |
| Profil Mollie BOT-WOW | profil manquant | création dans le compte Mollie |
| Déploiement du Worker corrigé | autorisation requise | autorisation humaine explicite |
| Ouverture du checkout (`RELEASE_STATUS=confirmed`) | décision commerciale | autorisation humaine explicite |
| PR #67 et #68 | need rebase sur le nouveau main | mainteneur |
| PR #66 | CONFLICTING, décision produit requise | décision humaine |

---

## 9. Prochaine action unique pour la première transaction test puis la première vente réelle

**Obtenir une clé Mollie de test** (commençant par `test_`) liée à un profil BOT-WOW dédié, puis :

1. L'injecter via `wrangler secret put MOLLIE_API_KEY`.
2. Déployer le Worker depuis `main` (`084e2bd` ou plus récent) avec `RELEASE_STATUS=pending`.
3. Vérifier le code déployé via l'API Cloudflare.
4. Exécuter un paiement test Mollie (mode test) → vérifier : licence créée → jeton créé → e-mail reçu → reçu `sent` → activation réussie.
5. Si la chaîne est prouvée : décider `RELEASE_STATUS=confirmed` (autorisation distincte) + fusionner PR #72.

**Sans cette clé, la preuve de bout en bout est impossible.**

---

### Prompt pour P0.26

> **MISSION P0.26 — FIRST TEST TRANSACTION**
>
> Objectif : exécuter le premier paiement test Mollie de bout en bout et prouver la chaîne de livraison.
>
> Prérequis (autorisation humaine) :
> 1. Profil Mollie BOT-WOW créé dans le compte Mollie.
> 2. Clé Mollie de test disponible (variable `MOLLIE_API_KEY` = `test_...`).
> 3. Clé Resend de test (ou validation de la clé existante).
> 4. Autorisation de déployer le Worker (avec `RELEASE_STATUS=pending`).
>
> Actions :
> 1. Injecter la clé de test : `wrangler secret put MOLLIE_API_KEY`.
> 2. Déployer le Worker depuis `main` avec `RELEASE_STATUS=pending`.
> 3. Vérifier le code déployé via l'API Cloudflare.
> 4. Exécuter un paiement test Mollie (mode test).
> 5. Vérifier : licence créée → jeton créé → e-mail reçu → reçu `sent` → activation réussie.
> 6. Si concluant : décider `RELEASE_STATUS=confirmed` + fusionner PR #72.
>
> Interdictions : aucun paiement réel, aucun changement de prix, aucun déploiement sans autorisation, `RELEASE_STATUS` reste `pending`.
>
> Livrable : rapport avec preuve de la chaîne et décision sur `RELEASE_STATUS`.