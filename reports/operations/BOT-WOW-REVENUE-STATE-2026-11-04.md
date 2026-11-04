# BOT-WOW — État du moteur de revenue (2026-11-04)

**Dépôt :** https://github.com/aveca/bot-wow
**Branche de travail :** `revenue/offre-unique-funnel-dedup-20261104`
**Base :** `origin/main` @ `2edd74b`
**Périmètre :** audit de l'architecture d'offres, du tunnel, de l'instrumentation
et du chiffre d'affaires **réellement encaissé**, puis corrections ciblées.

> Convention de preuve (AGENTS.md) :
> **[V]** = directement vérifié (outil + sortie citée) ·
> **[R]** = rapporté par une mission antérieure (lien fourni) ·
> **[N]** = non encore vérifié.
> Aucune offre n'est déclarée rentable : les données commerciales sont
> insuffisantes (voir §3).

---

## 1. Architecture d'offres validée — ONE CORE OFFER

### 1.1 Décision

**Une démo navigateur gratuite + UNE licence payante unique à 20,00 €.**
Aucun forfait mensuel, aucun palier, aucun abonnement.

**Justification factuelle :** `assets/modules.json` déclare **un seul module
`available`** (`fish`) ; `inventory`, `navigate` et `recovery` sont
`development` ; `clients`, `follower`, `grind`, `scripting` sont `planned`.
Le produit livré est donc un bot de pêche : c'est exactement la condition
énoncée par la mission pour ne pas multiplier les forfaits.

### 1.2 Cohérence du prix — VÉRIFIÉE, CONFORME

| Source | Valeur | Preuve |
|---|---|---|
| `buy.html` / `fr/buy.html` | « €20.00 » / « 20,00 € », « une fois — aucun renouvellement » | `buy.html:62,131,138,155` · `fr/buy.html:63,153,160,176` |
| `index.html` / `fr/index.html` | « €20.00 », « €20 once. Then it is yours. » | `index.html:80,253,441,459` |
| `compare.html` / `fr/compare.html` | « 20,00 € · EUR · once », « €20 one-time licence » | `compare.html:84,474,481,502` |
| `legal/terms.html` | « €20.00 incl. tax, one-time payment » | `legal/terms.html:46` |
| Worker — source de vérité | `PRICE_TABLE = { "bot-wow-lifetime": { amount: 2000, currency: "EUR" } }` | `worker/index.js` |
| `/api/config` (production) | `{"product":"bot-wow-lifetime","priceEur":20,"currency":"eur",...}` | GET `https://api.bot-wow.com/api/config` le 2026-11-04 |
| Checkout | Le montant client est **ignoré** ; un montant différent est refusé en 400 (`invalid_amount`) | `handleCheckout` |
| Webhook | Montant + devise + produit **re-vérifiés** contre `PRICE_TABLE` ; sinon 400 | `handleMollieWebhook` |

**Audit exhaustif des prix du dépôt :** aucun autre prix BOT-WOW n'existe.
Les occurrences de « 19.99 » présentes dans `compare.html`, `fr/compare.html`
et `assets/app.js` sont le **tarif du concurrent PixelBuddy**, sourcé et daté
dans `docs/pixelbuddy-matrix.md` — ce ne sont pas nos prix.
Les prix « 4,99 / 7,99 / 9,99 » de la branche `revenue/early-access-monthly-499-20261104`
(PR #69) ont été **abandonnés** : ils contredisaient la décision ONE CORE OFFER.

### 1.3 Pages et variantes legacy contradictoires — CORRIGÉES

**[V] Mesuré en production le 2026-11-04 :** `https://api.bot-wow.com/de/`
renvoyait **HTTP 200** avec une page marketing obsolète contenant :

- « anti-detection » (promesse explicitement interdite par `modules.json` → `never`) ;
- « Farm your WoW gold », « 100% free », « Get BOT-WOW free », « Lifetime access — Free » ;
- un JSON-LD `SoftwareApplication` avec `"offers":{"price":"0"}` ;
- un `hreflang` sur 6 langues avec **fr en racine** — alors que le site réel est **EN en racine, FR sous `/fr/`** ;
- un sitemap legacy `bot-wow-gold`, `best-wow-bot`, `bot-wow-gratuit`.

Mêmes constats sur `/en/`, `/es/`, `/pt/`, `/ru/`.
(`/` et `/fr/` renvoyaient le contenu correct : le code déployé différait du dépôt sur ce point.)

**Correction appliquée** (`worker/index.js`) : le générateur legacy
(`src/i18n/*.json` + `src/i18n/index.ts` + `src/web.ts`, 2 010 + 408 lignes)
est **supprimé**. L'hôte API n'est plus un hôte marketing : toute route
non-API répond désormais **308 → `https://bot-wow.com/<chemin>`**.
Taille du Worker : **244 178 → 116 431 octets**. Aucune promesse interdite
ne subsiste dans l'artefact déployé (vérifié par `tests/legacy-landing.test.mjs`).

### 1.4 www et redirections

**[V]** `https://www.bot-wow.com/` et `https://bot-wow.com/` renvoyaient
**tous deux 200** avec un contenu **identique** (40 340 octets). Le canonical
déclaratif pointait vers l'apex, mais **aucune redirection HTTP n'existait**.

**Correction :** règle 301 `www.bot-wow.com/* → bot-wow.com/:splat` ajoutée
dans `_redirects`. Cloudflare Pages l'applique ; **GitHub Pages n'applique pas
`_redirects`** — le www y reste servi en 200 (limite documentée, §6).

### 1.5 Contradiction de garantie restante — NON corrigée (décision requise)

**[V]** `buy.html:216` / `fr/buy.html:215` : « A licence activates on one machine. »
Mais le Worker applique `DEFAULT_MAX_ACTIVATIONS = 2` et `faq.html:59` revendique
« no seat limits ». **Le code et la copie ne disent pas la même chose.**
Corriger l'un ou l'autre change la garantie commerciale et le texte légal :
**décision fondateur requise**, non prise dans cette passe.

---

## 2. Funnel complet et état RÉEL de l'instrumentation

### 2.1 Architecture du tunnel

```
page SEO / accueil
  └─ page_view          [client]  D1 analytics
  └─ offer_view         [client]  (section #pricing au viewport)
  └─ demo_open          [client]  (/demo.html)
  └─ cta_click          [client]  data-track
  └─ checkout_requested [client]  clic CTA d'achat  (INTENTION, pas une vente)
  └─ checkout_start     [client]  soumission buyForm
        │
        ▼  POST /api/checkout  (serveur)
  └─ checkout_created   [serveur]  paiement Mollie créé
  └─ checkout_failed    [serveur]  échec de création
        │
        ▼  POST /api/mollie-webhook  (serveur, paiement re-vérifié via l'API)
  └─ payment_confirmed  [serveur]  ← seule source de conversion
  └─ license_created    [serveur]
  └─ delivery_sent      [serveur]  / delivery_failed [serveur]
  └─ conversion         [serveur]  (porte value_eur = montant encaissé)
        │
        ▼  POST /api/activate  (client desktop)
  └─ activation         [serveur]  ← PREMIÈRE activation sur une machine
```

### 2.2 Mesures relevées en production (D1 `botwow-analytics`)

**[V]** `SELECT event, test, COUNT(*), MIN/MAX(ts) FROM events GROUP BY event, test` :

| Événement | test=0 | test=1 | Période | Statut |
|---|---|---|---|---|
| `page_view` | 1 432 | 15 | 22/10 → 04/11 | mesuré |
| `journey_view` | 531 | 6 | 22/10 → 04/11 | mesuré |
| `cta_click` | 48 | 8 | 22/10 → 04/11 | mesuré |
| `checkout_requested` | 29 | 2 | 26/10 → 04/11 | mesuré |
| `checkout_start` | 4 | 0 | 23/10 → 27/10 | mesuré |
| `checkout_created` | 6 | 0 | 27/10 | mesuré (serveur) |
| `checkout_failed` | 6 | 0 | 27/10 | mesuré (serveur) |
| `planner_mode` | 1 | 0 | 23/10 | mesuré |
| `demo_open` | **0** | 0 | — | **absent** |
| `offer_view` | **0** | 0 | — | **absent** |
| `ownership_view` | **0** | 0 | — | **absent** |
| `conversion` | **0** | 0 | — | **absent** |
| `payment_confirmed` | **0** | 0 | — | **absent** |
| `license_created` | **0** | 0 | — | **absent** |
| `delivery_sent` / `delivery_failed` | **0** | 0 | — | **absent** |
| `activation` | **0** | 0 | — | **absent (table `activations` vide : 0 ligne)** |

**Lecture honnête :** le tunnel est mesuré **jusqu'à `checkout_created` /
`checkout_failed` uniquement** (et seulement sur une seule journée, le
27/10). **Tout ce qui suit le checkout n'a jamais été mesuré** — parce
qu'aucun paiement Mollie n'a abouti. `demo_open` et `offer_view` sont
émis par le code mais n'ont **aucune ligne** : à investiguer (voir §5).

### 2.3 Défauts d'instrumentation corrigés dans cette passe

| Défaut | Mesure | Correction |
|---|---|---|
| **Aucune déduplication** | `events` n'a qu'un `id INTEGER PRIMARY KEY AUTOINCREMENT` et des index **non uniques** : un double-clic, un double `pagehide` ou un retry de beacon gonflerait le tunnel | Déduplication **côté client** dans `assets/analytics.js` : clé `event \| page \| cta \| step \| mode \| years`, une occurrence par session. `?telemetry_dedup=0` pour la QA. La page entre dans la clé, sinon `page_view` ne compterait qu'une fois par session et le trafic multi-pages disparaîtrait. |
| **Test indistinguishable du réel** | La colonne `test` existait mais le Worker l'écrivait **toujours à 0**, y compris pour `conversion` qui porte `value_eur` | Le webhook lit `payment.mode` (Mollie : `live` \| `test`). Règle **fail-safe** : seul `mode === "test"` est marqué `test=1`, et **`value_eur` reste `NULL`** pour un test — une somme naïve ne peut donc jamais compter un test comme du revenu. |
| **Activation invisible** | `handleActivate` n'émettait aucun événement ; `activations` = 0 ligne | Émission serveur `activation` (une seule fois par machine, `ref` = id de la ligne d'activation). Dernière étape du tunnel désormais mesurable. |
| **Logs du Worker exposés** | `console.log("Order fulfilled: ... -> ${email} (${licenseKey})")` : **e-mail client + clé de licence en clair dans les logs** | Reprise du correctif de la PR #69 (non mergé) : 9 sites de log expurgés. |
| **Test de tunnel cassé et non exécuté** | `tests/funnel.test.mjs` appelait un helper inexistant (`callWorker` vs `call`) → **8 échecs** ; le fichier n'était **pas dans `npm test`** | Helper renommé, mock D1 corrigé (`bind()` sans `first`), indices de licence/commande corrigés, assertion globale isolée. **36 assertions passent.** Le fichier est désormais dans `npm test`, avec 3 nouveaux fichiers de test. |

### 2.4 Ce qui n'est toujours pas mesuré

- **Activation réelle** : l'événement est en place côté Worker, mais il faut
  un client qui s'active pour le alimenter. `activations` = 0 ligne ⇒ **aucun
  client n'a jamais utilisé le produit** (cohérent avec §3).
- **Remboursements / contestations** : le code revoke bien la licence
  (`revokeLicense` sur `refunded` / `charged_back`), mais **aucun événement
  de revocation** n'est écrit : un remboursement serait invisible dans le tunnel.
- **Abandon de checkout** : `checkout_created` sans `payment_confirmed` est
  la seule signature d'un abandon ; il faut une requête de réconciliation
  quotidienne pour le calculer (non fait ici).

---

## 3. Chiffre d'affaires CONFIRMÉ

**[V] Source : D1 `botwow-production` (remote), requête directe du 2026-11-04.**

```sql
SELECT provider, status, COUNT(*), SUM(amount) FROM orders GROUP BY provider, status;
```

| provider | status | n | montant |
|---|---|---|---|
| `bitcoin_manual` | **paid** | **5** | **100,00 €** |
| `bitcoin_manual` | pending_payment | 8 | 160,00 € |
| `bitcoin_manual` | failed | 11 | 220,00 € |
| `bitcoin_manual` | rejected | 1 | 20,00 € |

**Les 5 commandes « paid » ne sont pas des ventes :**

- provider = `bitcoin_manual` (pas Mollie), toutes les 5 le **2026-10-04 entre 01:01 et 02:30** ;
- **le domaine e-mail des 5 commandes est `example.com`** — donnée de test.

| Table | État |
|---|---|
| `licenses` | 5 lignes, `status='active'`, **toutes issues de ces commandes de test** |
| `activations` | **0 ligne** |
| `downloads` | 5 jetons, 8 téléchargements |
| `deliveries` | 0 ligne |
| `webhook_events` | 16 lignes |
| **Mollie** | **0 paiement réussi** — `checkout_created` = 6, `checkout_failed` = 6 (27/10) : **100 % d'échec** |

### ➜ Chiffre d'affaires réel confirmé : **0,00 €**

**0 client réel, 0 commande payée par un client, 0 licence activée.**
Les 100 € « paid » sont des données de test. **BOT-WOW n'est pas rentable et
ne peut pas être déclaré tel** : il n'existe aucune base commerciale.
Aucune conclusion de rentabilité n'est possible sur ce jeu de données.

---

## 4. Blocages de conversion (classés par impact)

| # | Blocage | Preuve | Impact | Traité ? |
|---|---|---|---|---|
| **B1** | **Checkout Mollie en échec systématique (6/6)** | D1 analytics : `checkout_created`=6, `checkout_failed`=6 | **Bloqueur total** : aucun euro ne peut entrer | **NON — autorisation requise** |
| **B2** | Aucune donnée client (commandes = `example.com`) | D1 `botwow-production` | Aucun marché, aucune preuve de valeur | Non (business) |
| **B3** | Pages legacy live sur `api.bot-wow.com/{de,en,es,pt,ru}/` | HTTP 200 + contenu mesuré | Risque SEO + promesse « 0 € » en data structurée | **OUI** (code) — déploiement à confirmer |
| **B4** | `www` dupliqué sans redirection 301 | HTTP 200 identique sur les deux hôtes | Signal de consolidation déclaratif seulement | **OUI** (code) |
| **B5** | Tunnel non dédupliqué | Schéma `events` sans unicité | Taux d'intention inexploitables | **OUI** |
| **B6** | Test et réel indiscernables | `test` toujours à 0 | Revenu potentiellement faux | **OUI** |
| **B7** | Activation jamais mesurée | `activations` = 0 ligne | Dernière étape du tunnel invisible | **OUI** (code) |
| **B8** | « 1 machine » (pages) vs `max_activations=2` (code) vs « no seat limits » (FAQ) | §1.5 | Garantie incohérente | **NON — décision requise** |
| **B9** | Checkout bloqué côté interface (PR #54), pas côté Worker | Pages de vente : bouton désactivé | Un POST direct reste possible tant que le Worker n'est pas gardé | **NON — autorisation requise** |
| **B10** | `demo_open` et `offer_view` : 0 ligne malgré un code émetteur | D1 analytics | Deux étapes du tunnel invisibles | À investiguer |

**Sur B1 — analyse du checkout (sans exécuter de paiement) :**
le secret `MOLLIE_API_KEY` est présent, `MOLLIE_PROFILE_ID` est présent, et
`MOLLIE_WEBHOOK_SECRET` est présent. Le `createMolliePayment` n'envoie
**jamais `profileId`** alors que `MOLLIE_PROFILE_ID` est configuré et que
son placeholder est documenté « à configurer chez Mollie ». Le code de
checkout envoie `customerId`, `amount`, `description`, `redirectUrl`,
`cancelUrl`, `webhookUrl`, `metadata`. **Sans appel à l'API Mollie (un
`POST /payments` réel), la cause exacte des 6 échecs n'est pas établie** :
`MOLLIE_PROFILE_ID` non configuré côté Mollie, clé en mode test sans
profil, ou erreur réseau. **Reproduire exigerait de créer un vrai objet de
paiement Mollie — action de paiement qui exige une autorisation explicite.**
Ce diagnostic est donc laissé documenté, pas contourné.

---

## 5. Tests, commit, PR, production

### 5.1 Commits et PR

| Élément | Valeur |
|---|---|
| Branche | `docs/current-state-refresh-20261104` (base `origin/main` @ `084e2bd`) |
| **PR #70 — ONE CORE OFFER** | **MERGED** 2026-11-04T07:57:11Z — merge commit `e2a93384ff499b8364d2f78f4f0ec1d3dcfab26c` |
| **PR #71 — preuve de livraison v1.2.0** | **MERGED** 2026-11-04T08:57:50Z — merge commit `084e2bd` (`worker/index.js` **+185 / −72**) : garde `RELEASE_STATUS` (409 avant encaissement), reprise idempotente de la livraison, journal `deliveries`, mesure `license_activated`, renvoi opérationnel, intégration PR #19 + PR #44 |
| **PR #73 — redirections `www`** | **MERGED** 2026-11-04T08:18:44Z — merge commit `dfc11582` : retrait des règles `_redirects` `www` **inopérantes** (Cloudflare Pages n'applique pas les redirections par domaine), remédiation **zone-level** documentée |
| Tests ajoutés | `tests/legacy-landing.test.mjs` (34 assertions) · `tests/payment-mode.test.mjs` (15) · `tests/funnel-dedup.test.mjs` (9) · `tests/delivery-replay.test.mjs` (41, PR #71) |
| Tests réparés | `tests/funnel.test.mjs` — 36 assertions, **0 échec** (8 échecs avant, jamais exécuté par la CI) |

### 5.2 Contrôles locaux (exécution réelle)

| Commande | Résultat |
|---|---|
| `npm test` | **exit 0** — 21 suites, dont les 4 tests de tunnel |
| `npm run validate` | **exit 0** |
| `git diff --check` | PASS |

### 5.3 Déploiement — état vérifié le 2026-11-04T11:10Z

| Élément | Valeur | Statut |
|---|---|---|
| Pages (PR #70) | deployment `7540967184` (sha `e2a93384`) | **success** |
| Pages (PR #73) | deployment `7541341864` (sha `dfc11582`) | **success** |
| Pages (PR #71) | deployment `7542044619` (sha `084e2bd`) | **success** |
| **Worker `botwow-api`** | tag `20f5821adfeb465cae177120c9015f8f`, `modified_on 2026-10-27T07:46:02Z` | **NON REDÉPLOYÉ** — cible de rollback ; le code #70/#71/#73 n'est pas en production |

Mesures live du 2026-11-04T11:10Z (directement vérifiées) :

| Requête | Résultat |
|---|---|
| `GET https://bot-wow.com/` | **200**, stamp `cb3925b6` |
| `GET https://bot-wow.com/buy.html` | **308** → `/buy` |
| `GET https://bot-wow.com/fr/buy.html` | **308** → `/fr/buy` |
| `GET https://bot-wow.com/worker/index.js` | **404** |
| `GET https://bot-wow.com/package.json` | **404** |
| `GET https://api.bot-wow.com/api/config` | **200** — `priceEur: 20`, `product: bot-wow-lifetime` — **prix inchangé** |
| `GET https://api.bot-wow.com/de/` | **200** + legacy — **attendu** (Worker non redéployé) |
| `GET https://www.bot-wow.com/` | **200** — redirection `www` → apex **inopérante** (B11) |

> L'API est servie par `api.bot-wow.com` (Worker) et **non** par
> `bot-wow.com/api/` — le dépôt `bot-wow.com` n'a aucun dossier `api/`, et
> `assets/app.js` documente que `/api/config` y renvoie 404. Un 404 sur
> `bot-wow.com/api/config` est donc **attendu**, pas une régression.

### 5.4 Correctif de trigger deploy (appliqué dans cette branche)

PR #71 annonçait dans son corps « Exclut `reports/**` de `pages.yml`
(`paths-ignore`) » — **la modification n'a jamais été appliquée** : le
`pages.yml` mergé ne contenait que `AGENTS.md` et
`.github/workflows/pages.yml`. Un commit documentaire en `reports/**`
déclenchait donc **inutilement** un déploiement Pages.

**Correction appliquée :** `'reports/**'` ajouté au `paths-ignore` de
`.github/workflows/pages.yml`. Aucun workflow de CI utile n'est désactivé
(`validate.yml` et `ui-quality.yml` continuent de tourner sur `main`).

---

## 6. Limites explicites (ce qui n'est PAS vérifié)

- **[N]** Le code **déployé** du Worker diffère du dépôt : 10 versions
  uploads entre le 22/10 et le 27/10, dernière version active
  `c3dcc842-c422-42d3-9828-405f30d70b5f` (27/10 07:46). Le diff
  `worker/index.js` entre le 22/10 et `main` est de **+103 / −112 lignes**.
  Le schéma D1 production est à jour (migrations `0001`→`0004` appliquées
  le 23/10 ; `0003` analytics appliquée) : le risque de schéma est écarté.
- **[N]** Aucun paiement réel n'a été créé ni vérifié (ni checkout, ni
  webhook). Les tests Mollie sont **simulés** par interception de `fetch`.
- **[N]** Aucun e-mail n'a été envoyé. `RESEND_API_KEY` est présent comme
  secret ; la table `deliveries` ne conserve que les échecs : il n'existe
  **aucun reçu durable** de livraison.
- **[N]** Le `www` restera en 200 sur GitHub Pages (qui n'applique pas
  `_redirects`) tant qu'une redirection n'est pas configurée au niveau de
  l'hôte.
- **[N]** `demo_open` / `offer_view` à 0 ligne : cause non établie (page
  réellement visitée ? bloqueur d'`IntersectionObserver` ? collecte
  désactivée par Do Not Track ?).

---

## 7. Trois prochaines actions classées (revenu potentiel / preuves / effort)

| # | Action | Revenu potentiel | Preuves | Effort |
|---|---|---|---|---|
| **1** | **Diagnostiquer et débloquer le checkout Mollie** (cause des 6 échecs du 27/10 ; `profileId` jamais envoyé ; profil Mollie à confirmer). Nécessite une autorisation explicite : créer un vrai paiement. | **Décisif** : sans lui, 0 € quel que soit le reste | 6/6 échecs + secrets présents + code analysé | **Moyen** — 1 autorisation + 1 test contrôlé |
| **2** | **Décider la garantie d'activation** (1 machine vs 2) et aligner Worker, FAQ, pages et mentions légales | Indirect (confiance) : une garantie incohérente se voit au moment de l'achat | §1.5 — 3 sources contradictoires | **Faible** — 1 décision + copy + 1 constante |
| **3** | **Reconcilier le tunnel sur 28 jours** (abandons de checkout, remboursements, révocations, événements de revocation) et redémarrer le suivi `daily-metrics` équivalent | Indirect : rend le funnel exploitable et la preuve de revenu fiable | §2.2 (absences), §2.4 | **Moyen** — 1 script de réconciliation + 1 workflow |

> **Rappel de doctrine :** aucune modification du checkout réel, des prix,
> des remboursements, des paiements ou des envois clients n'a été faite dans
> cette passe. Le checkout **réel n'a pas été réactivé** : il reste bloqué
> côté interface (PR #54) et le Worker n'a reçu aucun « déblocage ».

