# BOT-WOW P0.9 — Revue indépendante, correction des preuves et PR #44

**Date :** 27 octobre 2026  
**Dépôt :** `C:\factory\worktrees\bot-wow-repo` → `aveca/bot-wow` (GitHub)  
**Branche :** `fix/p0-checkout-delivery-gate-20261027`  
**PR :** #44 — `https://github.com/aveca/bot-wow/pull/44`

---

## 1. État Git vérifié

| Élément | Avant | Après |
|---|---|---|
| HEAD local initial | `1e13b980e725d680390642d58933d699bb9140fa` | `9aa589f280f31ac8eefc3f312c40a0508e743202` |
| HEAD distant PR | `1e13b980...` | `9aa589f2...` (confirmé via `git rev-parse origin/...`) |
| Branche | `fix/p0-checkout-delivery-gate-20261027` | idem |
| Remote | `origin` → `github.com/aveca/bot-wow.git` | idem |
| Working tree final | — | **Propre** (0 fichier modifié/non suivi) |
| `git diff --check` | — | Propre (seul avertissement fin de ligne LF→CRLF, non bloquant) |

---

## 2. PR #44 — Métadonnées vérifiées

| Propriété | Valeur |
|---|---|
| Numéro | **#44** |
| URL | `https://github.com/aveca/bot-wow/pull/44` |
| État | **OPEN** |
| Mergeable | **MERGEABLE** |
| Base | `main` (`aec0e6b`) |
| Head (avant) | `1e13b98` |
| Head (après) | `9aa589f` |

### CI sur le commit final `9aa589f`

| Workflow | Résultat |
|---|---|
| `validate` | **pass** (9 s) |
| `ui-quality` | **pass** (1 min 29 s) |
| `GitGuardian Security Checks` | **pass** (1 s) |

---

## 3. DÉFAUT REPRODUIT ET CORRIGÉ — Fausse preuve dans `tests/checkout-gate-mollie.test.mjs`

### 3.1 Localisation exacte

Fichier `tests/checkout-gate-mollie.test.mjs`, section « 4. Le prix reste inchange », ancienne ligne 110 :

```javascript
const amountOk = MOLLIE_CALLS.length === 0 || true; // aucun paiement reel en test
check('aucun prix modifie (montant attendu 2000 centimes cote serveur)', amountOk);
```

**Nature du défaut :** assertion tautologique. `X || true` vaut toujours `true`, indépendamment de `MOLLIE_CALLS.length`. Le test affichait donc « ok » sans rien vérifier : une **fausse preuve** d'intégrité du prix.

**Défaut secondaire (même section 3, ancienne ligne 103) :**
```javascript
check('confirmed -> les appels Mollie restent simules', MOLLIE_CALLS.every(...));
```
`.every()` sur un tableau **vide** retourne `true` : la aussi, aucune preuve réelle qu'un appel Mollie avait lieu.

---

## 4. CORRECTIF APPLIQUÉ

### 4.1 Source de vérité du tarif (non inventée)

Le montant attendu est **lu dans le code livré**, pas deviné :

`worker/index.js` ligne 2462-2464 :
```javascript
var PRICE_TABLE = {
  "bot-wow-lifetime": { amount: 2000, currency: "EUR", description: "BOT-WOW - Accès à vie" }
};
```
Le paiement envoyé à Mollie (`createMolliePayment`, ligne 2887-2899) transmet `amount: { value: (2000/100).toFixed(2), currency: "EUR" }` = **`{ value: "20.00", currency: "EUR" }`**.

Le test extrait désormais `PRICE_TABLE` par regex depuis `worker/index.js` et en déduit `EXPECTED_CENTS`, `EXPECTED_CURRENCY`, `EXPECTED_VALUE`. Si la source devient introuvable, le test **échoue explicitement** (exit 1).

### 4.2 Capture du corps des requêtes

Le mock réseau enregistre maintenant `{ url, method, body }` (corps JSON parsé), et renvoie des réponses conformes à l'API Mollie :
- `POST /customers` → `{ id: "cst_simulated" }`
- `POST /payments` → `{ id: "tr_simulated", _links: { checkout: { href: "https://www.mollie.com/checkout/simulated" } } }`

Aucun appel réseau réel : toute URL `mollie.com` est interceptée.

### 4.3 Assertions réelles ajoutées (remplacement de la tautologie)

| Vérification | Assertion |
|---|---|
| Livraison confirmée → parcours complet | statut 200, `paymentId` présent, `checkoutUrl` Mollie valide |
| Mollie réellement appelé | ≥1 appel `/customers`, **exactement 1** `POST /payments` |
| Montant conforme | `body.amount.value === EXPECTED_VALUE` (`"20.00"`) |
| Devise conforme | `body.amount.currency === EXPECTED_CURRENCY` (`"EUR"`) |
| Produit verrouillé | `body.metadata.product === "bot-wow-lifetime"` |
| Montant injecté par le navigateur ignoré | requête avec `amount: 100` → le corps envoyé à Mollie reste `20.00` |

### 4.4 Ce qui est supprimé

- `const amountOk = MOLLIE_CALLS.length === 0 || true;` (tautologie)
- `.every()` sur tableau vide (faux positif)

**Aucune modification** du prix, des routes de paiement, des secrets ou du comportement de production.

---

## 5. COMMANDES EXÉCUTÉES — RÉSULTATS RÉELS

| # | Commande | Code de sortie | Résultat |
|---|---|---|---|
| 1 | `npm run validate` | **0** | BOT-WOW validation **PASS** |
| 2 | `npm run test:gate` | **0** (test) | `CHECKOUT GATE : OK` (10 checks) + `GARDE MOLLIE : OK` (**25 checks**, 0 échec) |
| 3 | `node tests/checkout-gate-mollie.test.mjs` | **0** (test) | 25/25 ok |
| 4 | `npm test` (suite complète) | **0** (test) | **18/18 suites OK** |

Note : `node ... 2>&1` renvoie un code 1 côté PowerShell à cause des `console.warn/error` écrits sur stderr par le Worker (ex. « Checkout refuse : livraison non confirmee »). Ce sont des **journaux attendus**, pas des échecs de test : chaque suite se termine par `: OK` / `GARDE MOLLIE : OK`.

### Détail des 25 vérifications `GARDE MOLLIE`

| Groupe | Vérifications |
|---|---|
| Statuts non confirmés (absent / pending / invalide) | `409` + `delivery_unverified` + **0 appel Mollie** (×3) |
| Injection navigateur (`RELEASE_STATUS`, `release_status`, `confirmed`) | refusée `409` + **0 appel Mollie** (×3) |
| Statut confirmé serveur | pas de 409, 200 + `paymentId`, `checkoutUrl` Mollie, client créé, 1 paiement créé |
| Intégrité du prix | montant `20.00`, devise `EUR`, produit verrouillé |
| Montant injecté par le navigateur | ignoré (reste le tarif serveur) |

---

## 6. REVUE DE SÉCURITÉ CIBLÉE

### 6.1 Garde du checkout (`worker/index.js` lignes 2501-2522)

| Point | Constat |
|---|---|
| Priorité des variables | `env2.RELEASE_STATUS` (chaîne non vide) **avant** la valeur par défaut `"pending"` |
| Défaut fermé | absente / vide / invalide → `"pending"` → `409` |
| Lecture depuis le navigateur | **Aucune** : seule `env2` est lue ; `body.RELEASE_STATUS` est ignoré (prouvé par 3 tests d'injection) |
| Ordre des opérations | la garde est placée **après** validation email/montant et **avant** `getOrCreateMollieCustomer` / `createMolliePayment` → aucun effet de paiement possible |

### 6.2 `Content-Disposition` dynamique (`worker/index.js` ligne 2334)

| Point | Constat |
|---|---|
| Origine de `objectKey` | `env2.R2_OBJECT_KEY` (config serveur) puis deux constantes littérales : `"casinobabe-fishing-1.2.0.zip"`, `"Casinobae-v1.0.38.zip"` (lignes 2313-2317) |
| Provenance navigateur | **Aucune** : ni `request.url`, ni corps, ni en-tête ne alimente `objectKey` |
| Risque d'injection d'en-tête | **Nul** avec ces valeurs : aucune ne contient `"`, `;`, CR ou LF |
| Nom livré | correspond à l'objet R2 réellement sélectionné (`casinobabe-fishing-1.2.0.zip`) |

**Conclusion :** le passage de la constante figée à `${objectKey}` n'introduit pas de vecteur d'injection, car la valeur reste entièrement contrôlée par le serveur.

### 6.3 Téléchargement R2

| Contrôle | Comportement |
|---|---|
| Jeton absent | `400 missing_token` |
| Jeton invalide | `404 invalid` |
| Licence révoquée | `403 revoked` |
| Expiration | `410 expired` |
| Quota atteint | `429 limit_reached` |
| Objet R2 introuvable | `404 file_not_found` (protection explicite) |

### 6.4 Cohérence diff / rapport P0.8 / production

| Affirmation P0.8 | Vérification P0.9 |
|---|---|
| `Content-Disposition` dynamique | Confirmé dans le diff de la PR |
| `RELEASE_STATUS: 'confirmed'` dans les tests | Confirmé |
| Artefact R2 SHA-256 conforme | Vérifié en P0.8 (`1c132f36...`), non re-téléchargé en P0.9 (lecture seule, aucune mutation) |
| 18/18 suites | **Re-exécuté en P0.9 : confirmé** |
| « 15 vérifications test:gate » | Corrigé : `test:gate` fournit 10 + **25** = 35 checks après correctif |

**Écart relevé :** le rapport P0.8 annonçait `test:gate` = « 15/15 checks ». En réalité la suite combinée produit 35 vérifications, dont une était vacument vraie — désormais supprimée et remplacée par 25 vérifications réelles.

---

## 7. ÉTAT DE LA PRODUCTION

| Contrôle | Résultat (lecture seule, 27/10 19:39 UTC) |
|---|---|
| `GET https://api.bot-wow.com/health` | `200 {"status":"ok","version":"1.0.0"}` |

**Aucune mutation de production dans cette mission :**
- Aucun `wrangler deploy`
- Aucun `wrangler secret put`
- Aucun appel Mollie réel
- Aucune modification de prix, de routes de paiement ou de secrets

Seules des opérations Git locales + push de branche ont été effectuées.

---

## 8. COMMIT AJOUTÉ À LA PR #44

| Propriété | Valeur |
|---|---|
| SHA | `9aa589f280f31ac8eefc3f312c40a0508e743202` |
| Message | `test(bot-wow): replace tautological Mollie amount assertion with real verification` |
| Fichiers | **1 seul** : `tests/checkout-gate-mollie.test.mjs` (+68 / -7) |
| Push | `1e13b98..9aa589f` sur `fix/p0-checkout-delivery-gate-20261027` |
| PR | #44 mise à jour (même PR, aucun doublon) |
| CI après push | `validate` pass, `ui-quality` pass, `GitGuardian` pass |

### Fichiers du commit — contrôle

| Fichier | Attendu ? |
|---|---|
| `tests/checkout-gate-mollie.test.mjs` | oui |
| Secret / ZIP / fichier temporaire | aucun (`git status` propre) |
| Changement de prix ou de clé | aucun |

---

## 9. VERDICT FINAL

### **READY_FOR_REVIEW**

| Critère | État |
|---|---|
| HEAD initial et final documentés | `1e13b98` → `9aa589f` |
| PR et SHA distant vérifiés | PR #44, head `9aa589f2...` |
| Défaut reproduit et référencé fichier/ligne | tautologie ancienne ligne 110 |
| Changements et commit documentés | 1 fichier, SHA `9aa589f` |
| Commandes exécutées et résultats réels | validate PASS, test:gate 35 checks, npm test 18/18 |
| Preuves des tests négatifs du checkout | 409 + `delivery_unverified` sur 6 scénarios |
| Preuve de l'absence d'appels Mollie | `MOLLIE_CALLS.length === 0` sur tous les cas bloqués |
| Preuve de l'intégrité du montant | `20.00` / `EUR` lus depuis `PRICE_TABLE` et vérifiés dans le corps |
| Statut des workflows GitHub | 3/3 pass |
| Production non modifiée | confirmé (health 200, aucune mutation) |

---

## 10. RECOMMANDATION

### **Recommander la fusion de la PR #44** — sans l'exécuter

**Justification :**

1. **La preuve est maintenant réelle.** L'unique défaut de preuve identifié (assertion tautologique sur le montant Mollie) est corrigé. Le test lit `PRICE_TABLE` depuis `worker/index.js` et vérifie le corps effectivement envoyé : `value === "20.00"`, `currency === "EUR"`, `product === "bot-wow-lifetime"`.

2. **La garde est prouvée, pas seulement affirmée.** 6 scénarios négatifs (absent / pending / invalide + 3 injections navigateur) produisent `409 delivery_unverified` avec **zéro** appel Mollie, vérifié par interception de `fetch`.

3. **Aucun risque d'injection d'en-tête.** `objectKey` provient exclusivement de la configuration serveur ou de constantes littérales ; aucune valeur ne provient du navigateur.

4. **Aucune régression.** Les 18 suites de test passent, `validate` passe, et les 3 workflows GitHub sont verts sur le commit final.

5. **Production intacte.** Aucun déploiement, aucun secret modifié, aucun appel Mollie réel. Le risque d'une fusion est donc limité au périmètre du diff (nom de fichier de téléchargement + configuration de test).

**Réserve à connaître avant fusion :** ce PR ajoute la garde `RELEASE_STATUS` à `main`. Le Worker de production l'exécute déjà (déployé en P0.6 avec le secret `RELEASE_STATUS=confirmed`), mais fusionner ne redéploie rien par soi-même. Il faudra un `wrangler deploy` séparé pour aligner `main` sur la production — opération à autoriser explicitement le moment venu.

**Décision laissée au mainteneur :** fusionner ou non. Cette mission s'arrête au seuil de la fusion, comme demandé.

---

## 11. LIMITES DE VÉRIFICATION

| Limite | Détail |
|---|---|
| Artefact R2 non re-téléchargé | Vérifié en P0.8 (`1c132f36...`). P0.9 n'a fait que des lectures Git/API ; aucune mutation R2. |
| Parcours paiement réel non testé | Aucun paiement Mollie réel n'est autorisé ici. La preuve porte sur le **contrat** de la requête (corps, montant, statuts), pas sur une transaction bout-en-bout. |
| Code déployé ≠ `main` | Le Worker en production exécute la version déployée en P0.6, pas `main`. Un déploiement futur est nécessaire pour aligner. |

---

**Rapport final :** `C:\factory\reports\bot-wow\P0.9-PR44-REVIEW-27OCT.md`

**Action humaine requise :** décision de fusion de la PR #44 (non effectuée ici).



