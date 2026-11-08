# Runbook — première vente TEST intégrale (Mollie test → téléchargement vérifié)

**Date :** 2026-11-07 · **Établi par :** agent opencode (instruction ChatGPT, mission P0 « MOLLIE VALIDÉ → PREMIÈRE VENTE LIVRABLE »)
**Statut :** préparation documentaire uniquement. Ce runbook n'autorise ni paiement, ni remboursement, ni e-mail, ni changement de secret, ni déploiement.
**Garde absolu :** `RELEASE_STATUS` reste `pending` en production. Ne jamais le passer à `confirmed` sur le Worker public pour réaliser ce test. Un POST de sonde sur le checkout public peut écrire dans le rate-limit KV même s'il répond 409 ; ne pas l'utiliser comme test « lecture seule ».
**Précondition d'exécution future :** environnement isolé non public avec Worker, D1, R2 et credential Mollie `test_` distincts. Si cet environnement n'existe pas, arrêter la procédure : ne pas substituer la production.
**Règle du projet :** ne jamais annoncer « prêt à vendre » tant qu'un paiement traversant TOUTE la chaîne n'aboutit pas à une livraison vérifiée. Aucun test de paiement ou d'e-mail ne sera lancé avant validation finale explicite.

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

## 3. Procédure de test — environnement isolé uniquement

**Aucune des commandes ci-dessous ne doit viser `api.bot-wow.com` ou le Worker de production.**
Avant toute exécution future, vérifier séparément :
- Worker de staging distinct, avec URL non publique et configuration connue ;
- D1 de test et bucket R2 de test, sans binding vers les ressources de production ;
- credential Mollie `test_` lié au profil BOT-WOW confirmé ;
- `RELEASE_STATUS` propre au staging, sans modifier la valeur de production ;
- fournisseur d'e-mail simulé/sink. Aucun e-mail client ; l'envoi vers une boîte propriétaire nécessite une approbation distincte.

| # | Étape préparatoire | Action autorisée lors d'une future exécution isolée | Preuve attendue |
|---|---|---|---|
| 0 | Vérifier l'isolation | Confirmer l'URL du Worker de staging, les IDs D1/R2 de test et l'absence de bindings de production | inventaire daté, sans secret |
| 1 | Vérifier le credential | Exécuter `scripts/verify-mollie-profile.mjs --expect-pfl pfl_L84sQNbb4i` dans l'environnement propriétaire prévu, avec credential test uniquement | type de credential et profil public correspondant ; aucun secret affiché |
| 2 | Vérifier le garde staging | Confirmer que le garde staging est fermé avant le test ; ne pas toucher à `RELEASE_STATUS` en production | réponse de refus sur l'URL staging |
| 3 | Autoriser la charge test | Attendre l'approbation finale explicite avant toute création de paiement test ; plafond préparé : 1,00 EUR, mode test Mollie uniquement | approbation datée, montant et profil confirmés |
| 4 | Créer le paiement test | Uniquement via le checkout staging avec credential `test_` | identifiant de paiement de test et URL de checkout staging |
| 5 | Vérifier le webhook | Recevoir le webhook staging et relire l'état du paiement auprès de Mollie | paiement test confirmé côté serveur, montant/devise/produit vérifiés |
| 6 | Vérifier le fulfillment | Générer une commande synthétique à ID texte, une licence et un jeton de téléchargement | une seule commande/licence ; état de livraison explicite |
| 7 | Vérifier l'objet | Télécharger depuis le bucket R2 de test via le lien staging et calculer taille + SHA-256 | ZIP complet, hash comparé au build reproductible |
| 8 | Vérifier l'activation | Activer deux machines synthétiques puis tenter une troisième | deux activations acceptées, troisième refusée |
| 9 | Vérifier l'idempotence | Rejouer le même webhook de test | aucune seconde licence ni seconde livraison |
| 10 | Vérifier les erreurs | Tester signature invalide, paiement refusé/annulé/expiré et jeton révoqué dans le staging | aucun fulfillment pour les paiements non payés ; téléchargement révoqué refusé |
| 11 | Vérifier les traces | SELECT uniquement sur la D1 de staging ; aucun SELECT de lignes client en production | état cohérent, événements test exclus du revenu |
| 12 | Terminer | Révoquer la licence de test, fermer le garde staging et conserver les preuves | staging fermé ; production inchangée |

**Remboursement :** même en mode test, ne créer un remboursement qu'après approbation explicite distincte.  
**E-mail :** aucun e-mail ne part pendant cette préparation. Le test d'e-mail ne peut utiliser qu'un sink ou une boîte appartenant au propriétaire, après approbation explicite.

## 4. Critères de réussite et de non-commercialisation

Un test staging réussi exige des preuves datées de :
1. paiement Mollie en mode test, sans encaissement réel ;
2. webhook traité une seule fois et commande persistée avec ID texte ;
3. licence et jeton créés sans doublon ;
4. téléchargement R2 complet dont la taille et le SHA-256 correspondent à l'artefact attendu ;
5. activation et limites vérifiées ;
6. e-mail simulé/sink ou preuve séparée approuvée, sans client réel.

Un test staging réussi **n'est pas une vente** et ne prouve pas que la production peut encaisser. Le passage commercial exige encore les droits de redistribution, un artefact autorisé et reproductible, la compatibilité datée, les méthodes LIVE Mollie réellement activées, le fulfillment de production validé et une autorisation finale.

La production doit rester fermée pendant toute cette préparation : `RELEASE_STATUS=pending`, aucun POST de checkout de sonde, aucun paiement, aucun remboursement, aucun e-mail et aucun déploiement Worker.


## 5. Bloquants persistants (indépendants de cette chaîne)

| Bloquant | État |
|---|---|
| Artefact servi non reproduit depuis un checkout propre (SHA 4FB2D1C1 ≠ 1C132F36) + 2 exécutables hors manifeste (`Lancer-Casinababe-Fishing-Assistant.bat`, `restaurer_previous.ps1`) jamais revus ni lancés | arbitrage propriétaire (lock `r2-provenance`, PR #124) |
| Mentions légales : champs « À COMPLÉTER » · identité marchande absente | PR #137 (draft, lock `legal-draft`) + issue #101 — **ne pas inventer** |
| Compatibilité serveurs datée | `assets/compat.json` : tout `not_tested` / `historical_unverified` |
| Parcours mobile/compte prouvé réel | 0 livraison, 0 activation en production à ce jour |

---

*Historique d'exécution : aucune écriture R2, aucun secret modifié, aucun déploiement, aucun paiement réel, aucun e-mail envoyé. Sondes HTTP lectures pures + POST de sonde sur /api/checkout (rate-limit interne, jamais de paiement).*
