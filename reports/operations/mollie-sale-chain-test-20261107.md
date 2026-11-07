# Runbook — première vente TEST intégrale (Mollie test → téléchargement vérifié)

**Date :** 2026-11-07 · **Établi par :** agent opencode (instruction ChatGPT, mission P0 « MOLLIE VALIDÉ → PREMIÈRE VENTE LIVRABLE »)
**Statut :** runbook documentaire. **Ce runbook n'exécute aucune de ces opérations** : chaque étape sensible est une action propriétaire explicite (secrets, déploiement, merge, checkout).
**Règle du projet :** ne jamais annoncer « prêt à vendre » tant qu'un paiement traversant TOUTE la chaîne n'aboutit pas à une livraison vérifiée. Ne jamais activer la production automatiquement.

---

## 1. État vérifié au 2026-11-07 (sondes HTTP et code, lecture seule)

| Contrôle | Résultat mesuré | Preuve |
|---|---|---|
| `GET https://api.bot-wow.com/api/config` | **200** `{"product":"bot-wow-lifetime","priceEur":20,"currency":"eur","bitcoin":{"enabled":true,"address":null}}` | sonde du 2026-11-07 |
| `GET /health` | **200** | sonde du 2026-11-07 |
| `GET /api/download` (sans jeton) | **400** `missing_token` (aucun octet servi) | sonde du 2026-11-07 |
| Redirections canoniques du parcours | `/buy.html`→308→`/buy` 200 ; `/success.html`→308→`/success` **200** ; `/cancel.html`→308→`/cancel` **200** ; `/fr/success` **200** ; `/fr/cancel` **200** ; `/docs/install.html`→308→`/docs/install` **200** | sondes du 2026-11-07 |
| Chaîne complète dans le Worker | client Mollie → paiement 20,00 EUR verrouillé serveur → webhook vérifié via l'API Mollie (statut, montant, devise, produit) → idempotence atomique `payment:<id>` → commande → licence (2 activations max) → jeton de téléchargement (10 max, 30 j) → e-mail Resend → journal `deliveries` (anti-doublon, reprise) → activation → stream R2 clé `casinobabe-fishing-<semver>.zip` (garde de clé stricte) | `worker/index.js` revu ligne à ligne le 2026-11-07 |
| Scénarios webhook couverts par tests locaux | payé, échec, annulé, expiré, remboursement/contestation (révocation), rejeu (aucune seconde licence/e-mail), signature invalide (401), garde 409 sous `RELEASE_STATUS≠confirmed` (aucun appel Mollie) | `npm test` vertical le 2026-11-07 (27 suites, EXITCODE=0) |
| Artefact R2 | `casinobabe-fishing-1.2.0.zip` livré tel quel ; hash live revérifié par le lock `20261107-r2-provenance` (PR #124, aveca) : `1c132f36…BBA4F`, 1 387 543 octets. **Nuance documentée :** la reconstruction depuis un checkout propre du runtime donne un autre SHA (`4FB2D1C1…`, 1 385 603 o) — l'artefact servi n'est pas reproductible octet-pour-octet ; à arbitrer par le propriétaire avant toute vente (provenance/légende de l'artefact). | verrous `agents/locks.md` + PR #124 |

Le checkout public reste **fermé** (`RELEASE_STATUS=pending`, 409 `delivery_unverified`). PR #138 (drapeau `CHECKOUT_PUBLIC`) reste un brouillon non fusionné : second verrou, non actif.

## 2. Ce que seul le propriétaire peut faire (hors dépôt, jamais dans git ni dans un rapport)

### 2.1 Identifier le type de credential et le lier au profil

Le cloud ne peut pas le faire sans lire le secret : le script `scripts/verify-mollie-profile.mjs` (cette PR) interroge Mollie en lecture et **n'imprime jamais la clé** (mêmes chemins d'erreur), jamais en CI.

```powershell
# terminal local du proprietaire uniquement
$env:MOLLIE_API_KEY    = "<valeur existe deja, ne jamais copier dans un fichier versionne>"
$env:MOLLIE_PROFILE_ID = "<placeholder actuel ou pfl_ reel : uniquement necessaire pour un jeton organisation>"
node scripts/verify-mollie-profile.mjs --expect-pfl pfl_L84sQNbb4i
```

Résultats attendus : `credential type: api_key_test | api_key_live | organization_token` puis le profil réellement lié, avec la correspondance à `pfl_L84sQNbb4i` (profil BOT-WOW validé ; ne jamais réutiliser `pfl_t8KCk4Cm2C` — Sargasses). Si `mollie_http_401` : la clé n'est pas celle du profil validé → corriger avant tout test.

### 2.2 Déclarer le webhook sur le profil BOT-WOW

Dans le tableau de bord Mollie du profil `pfl_L84sQNbb4i` : URL webhook = `https://api.bot-wow.com/api/mollie-webhook` (c'est la valeur canonique déjà envoyée à chaque création de paiement). Le webhook serveur **vérifie toujours** l'état réel en relisant le paiement via l'API (le champ signature `MOLLIE_WEBHOOK_SECRET` est facultatif et complémentaire).

### 2.3 Cohérence `MOLLIE_PROFILE_ID`

- Clé standard `test_`/`live_` : le binding est **ignoré** par le code (le profil est lié à la clé). Un placeholder périmé ne casse rien (test « leaked binding ignore »).
- Jeton d'organisation : le binding est **obligatoire** ; sans lui aucun appel Mollie (fail-closed, PR #90). Avec lui, `profileId` est transmis **dans le corps** de POST /payments (conformité doc Mollie — commit `49169a3` sur PR #90).
- Fusion de la PR #90 requise avant tout test réel (la version déployée actuelle peut casser la création de paiement avec la clé standard + placeholder — le défaut historique « checkout Mollie N/N en échec » du 2026-10-27 est de cette famille).

## 3. Chaîne TEST intégrale (clé `test_` standard recommandée)

Toutes les étapes ci-dessous opèrent en **mode test Mollie** : aucun euro réel en jeu, carte de test de la doc Mollie (« Testing their integration » de help.mollie.com — ne pas inventer de numéro ici). L'e-mail utilisé doit être **celui du propriétaire** : la livraison envoie un e-mail réel.

| # | Étape | Commande / action | Résultat attendu |
|---|---|---|---|
| 0 | Vérifier le garde fermé | `curl.exe -s -X POST https://api.bot-wow.com/api/checkout -H "Content-Type: application/json" -d "{\"email\":\"probe@example.com\",\"lang\":\"fr\"}"` | **409** `delivery_unverified`, aucun appel Mollie |
| 1 | Montrer la 409 → confirmer | Le propriétaire pose `RELEASE_STATUS=confirmed` (action secrets propriétaire, réversible — 2.4) | — |
| 2 | Créer le paiement test | même POST avec l'e-mail propriétaire | **200** `paymentId` (`tr_…`, mode test) + `checkoutUrl` |
| 3 | Payer | Page Mollie, carte de **test** (le refus et l'annulation sont testables de la même façon) | HTTP 200, accès page success |
| 4 | Webhook | Automatique depuis Mollie | commande `paid`, licence `BOTW-…`, jeton téléchargement, e-mail livré |
| 5 | **GET réel de l'objet R2** | ouvrir le lien `/api/download?t=…` reçu ; calculer `(Get-FileHash -Algorithm SHA256).Hash` et la taille | archive ZIP complète, taille/SHA à confronter à la référence (voir nuance §1 artefact) |
| 6 | Activation x2 + garde | `POST /api/activate` `{"key":"BOTW-…","machine_id":"testa"}` puis `"testb"`, puis `"testc"` | 3ᵉ : `max_activations` refusé |
| 7 | Webhook répété | rejouer le POST webhook du même `tr_…` | **200**, aucune seconde licence, aucun second e-mail |
| 8 | Webhook invalide | POST sans `id`, et `id` inexistant | 400 / toléré sans effet de bord |
| 9 | Remboursement test | créer un remboursement sur le paiement test (dashboard Mollie) | licence passée `revoked`, téléchargement suivant → **403** |
| 10 | Refusé / annulé / expiré | navigateur : carte refusée, abandon, attente expiration | commandes `failed`/`canceled`/`expired`, **aucune licence, aucun e-mail** |
| 11 | Lire les traces (lecture seule) | `npx wrangler d1 execute botwow-production --remote --command "SELECT provider,provider_id,status,amount,currency FROM orders ORDER BY created_at DESC LIMIT 10"` et sur `botwow-analytics` : `SELECT event,step,test FROM events ORDER BY ts DESC LIMIT 20` | commande test `mode=test` ⇒ `test=1` et **aucun euro de revenu** (`value_eur` NULL) comptabilisé |
| 12 | Poignée de fin | dashboard Mollie : 0 paiement live, 0 frais ; licence de test révoquée au besoin | — |
| 13 | **Remettre le garde** | `RELEASE_STATUS=pending` (propriétaire) + déploiement si besoin | POST checkout → **409** re-vérifié |

## 4. Règle de validation (critère « première vente »)

Le commerce ne peut être re-présenté comme prêt **que si les 4 preuves existent datées** :
1. email client réel (unique) contenant un lien de téléchargement ;
2. **GET réel de l'objet R2** : ZIP complet par ce lien (taille + SHA-256 mesurés sur le fichier reçu) ;
3. activation effective sur une machine + garde d'activations mesurée ;
4. dashboard Mollie et D1 prouvant mode test / 0 € encaissé.

Sans ces 4 preuves, la vitrine reste « status-only » (acheteur bloqué 409), quelles que soient les pages.

## 5. Bloquants persistants (indépendants de cette chaîne)

| Bloquant | État |
|---|---|
| Artefact servi non reproduit depuis un checkout propre (SHA 4FB2D1C1 ≠ 1C132F36) + 2 exécutables hors manifeste (`Lancer-Casinababe-Fishing-Assistant.bat`, `restaurer_previous.ps1`) jamais revus ni lancés | arbitrage propriétaire (lock `r2-provenance`, PR #124) |
| Mentions légales : champs « À COMPLÉTER » · identité marchande absente | PR #137 (draft, lock `legal-draft`) + issue #101 — **ne pas inventer** |
| Compatibilité serveurs datée | `assets/compat.json` : tout `not_tested` / `historical_unverified` |
| Parcours mobile/compte prouvé réel | 0 livraison, 0 activation en production à ce jour |

---

*Historique d'exécution : aucune écriture R2, aucun secret modifié, aucun déploiement, aucun paiement réel, aucun e-mail envoyé. Sondes HTTP lectures pures + POST de sonde sur /api/checkout (rate-limit interne, jamais de paiement).*
