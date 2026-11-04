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

| provider | status | n | montant nominal | **encaissé ?** |
|---|---|---|---|---|
| `mollie` | failed | 11 | 220,00 € | **0,00 €** — les 11 paiements sont `status=expired`, `paidAt=null`, `method=null` |
| `bitcoin_manual` | **paid** | **5** | **100,00 €** | **0,00 €** — données de test (adresse BTC *placeholder*, txid de test) |
| `bitcoin_manual` | pending_payment | 8 | 160,00 € | **0,00 €** — jamais payés (aucun txid) |
| `bitcoin_manual` | rejected | 1 | 20,00 € | **0,00 €** |
| **Total** | | **25** | **500,00 €** | **0,00 €** |

> ⚠️ **Correction de ce rapport (2026-11-04T16:55Z).** Une version
> antérieure de ce tableau attribuait les 11 commandes `failed` à
> `bitcoin_manual`. C’est **faux** : elles sont de provider **`mollie`**
> (vérifié par `SELECT provider, status, COUNT(*) … GROUP BY provider,
> status`). Le montant nominal total (500,00 €) **n’est pas du revenu** :
> voir la colonne « encaissé ? » et le §3bis.

**Les 5 commandes « paid » ne sont pas des ventes :**

- provider = `bitcoin_manual` (pas Mollie), toutes les 5 le **2026-10-04 entre 01:01 et 02:30** ;
- **le domaine e-mail des 5 commandes est `example.com`** — donnée de test ;
- **[V] preuve supplémentaire (2026-11-04T16:45Z)** : les 5 commandes portent
  la **même adresse BTC littéralement
  `bc1qadminbotwowpaymentaddressplaceholder123456…`** et des txid de test
  (`test-txid-12345`, `test-real-txid-12345`, `e2e-test-txid-001`) ;
  aucune transaction réelle n’a pu transiter.

| Table | État |
|---|---|
| `licenses` | 5 lignes, `status='active'`, **toutes issues de ces commandes de test** |
| `activations` | **0 ligne** |
| `downloads` | 5 jetons |
| `deliveries` | 0 ligne |
| `botwow_emails` | 12 lignes — **toutes des adresses de test** (`@example.com`, `probe…`) → **0 abonné réel** |
| `webhook_events` | 16 lignes — **dont 5 sans aucune commande associée** (voir B12) |
| **Mollie** | **11 paiements créés, 11 expirés non payés** — `checkout_created` = 6, `checkout_failed` = 6 (27/10) |

### ➜ Chiffre d'affaires réel confirmé : **0,00 €**

**0 client payeur, 0 commande payée par un client, 0 licence activée, 0 email
client envoyé.** Les 100 € « paid » sont des données de test ; les 220 € de
paiements Mollie ont **expiré sans être réglés**. **BOT-WOW n'est pas rentable
et ne peut pas être déclaré tel** : il n'existe aucune base commerciale.
Aucune conclusion de rentabilité n'est possible sur ce jeu de données.

---

## 3bis. Ce que les données D1 disent du chemin de paiement (2026-11-04T16:45Z–17:05Z)

Cinq faits **nouveaux**, tous vérifiés en lecture seule sur la base D1 de
production et l’API Cloudflare. Ils changent le diagnostic du checkout.

### 3bis.1 Les 11 paiements Mollie n’ont pas « échoué » : ils ont **expiré impayés**

**[V]** Extraction du statut Mollie stocké dans `orders.metadata` (le Worker y
enregistre l’objet de paiement reçu de l’API) :

```sql
SELECT id, json_extract(metadata,'$.mollie.status')  AS st,
       json_extract(metadata,'$.mollie.mode')    AS mode,
       json_extract(metadata,'$.mollie.method')  AS meth,
       json_extract(metadata,'$.mollie.paidAt')  AS paidAt
FROM orders WHERE provider='mollie';
```

| Résultat | Valeur | Sur les 11 commandes |
|---|---|---|
| `st` (statut Mollie) | `expired` | **11 / 11** |
| `mode` | `live` | 11 / 11 |
| `meth` (moyen de paiement) | `null` | **11 / 11** |
| `paidAt` | `null` | **11 / 11** |

**Conséquence : le tunnel technique de création de paiement fonctionne** (les
11 objets ont un id `tr_…`, un lien de checkout, une expiration). **Ce n’est
pas un 6/6 « échec technique »** : les 6 événements `checkout_failed`
correspondent au **webhook `payment.expired`** qui marque la commande
`failed`. Aucun acheteur n’a **choisi ni finalisé un moyen de paiement**
(`method=null`), et les 11 paiements ont expiré (~16 min après création).

> ⚠️ **Ce que cela ne dit pas** : rien ne prouve qu’un acheteur réel a vu la
> page de paiement Mollie. L’absence de `method` est compatible avec (a) une
> page de paiement jamais affichée (casse front), (b) un abandon, (c) un
> test. La preuve existante est **trop petite** (11 sessions, toutes avec des
> adresses de test) pour conclure.

### 3bis.2 ⚠️ Le checkout BOT-WOW encaisse dans le compte Mollie de **Sargasses**

**[V] Fait le plus grave de cette section.** Les 11 paiements BOT-WOW
portent, dans leur `metadata` stocké par notre propre Worker :

```json
"profileId": "pfl_t8KCk4Cm2C",
"_links": { "dashboard": { "href": "https://my.mollie.com/dashboard/org_19554425/payments/tr_…" } }
```

**[V] Vérification indépendante que `pfl_t8KCk4Cm2C` est le profil
SARGASSES** (dépôt `aveca/sargagame`) :

| Fichier | Ligne | Contenu |
|---|---|---|
| `public/api/mollie-config.example.php` | 9 | `'profile_id' => 'pfl_t8KCk4Cm2C'` |
| `scripts/write-mollie-config.cjs` | 49 | `'profile_id' => 'pfl_t8KCk4Cm2C'` |
| `src/Sargasses_PROD.jsx` | 1778 | `export const MOLLIE_PROFILE="pfl_t8KCk4Cm2C"` |

→ Les deux produits partagent **le même profil et la même organisation
Mollie** (`org_19554425`). Trois conséquences, toutes actionnables :

1. **Attribution de revenu cassée** : un euro encaissé par BOT-WOW atterrit
   dans le compte Mollie de Sargasses. Toute mesure de revenu Sargasses
   lisant l’API Mollie peut **compter un paiement BOT-WOW** (et l’inverse).
   C’est une contamination croisée des deux moteurs.
2. **Pas de profil BOT-WOW** : il n’existe aucun profil BOT-WOW dans cette
   organisation. Le secret `MOLLIE_PROFILE_ID` du Worker `botwow-api` pointe
   donc vers celui d’un autre produit.
3. **Le défaut `profileId` de la PR #77** (« handle Mollie profileId by
   credential type ») ne corrige que le *transport* du paramètre ; il ne
   corrige pas la **séparation des comptes**. Il faut un **profil (et une
   clé) BOT-WOW dédiés** avant tout paiement réel.

### 3bis.3 Cinq webhooks Mollie traités **sans aucune commande** (22–23/10)

**[V]** Jointure `webhook_events ⋈ orders` sur `provider_id` :

| `webhook_events.id` | traité le | commande associée |
|---|---|---|
| `payment:tr_JFZR2mwem3mWGiZABtUYJ` | 2026-10-22T01:17Z | **aucune** |
| `payment:tr_777iJfuzjSjiEGw6CtUYJ` | 2026-10-22T01:17Z | **aucune** |
| `payment:tr_t5bjC3XBWhS6sYfKLtUYJ` | 2026-10-22T01:17Z | **aucune** |
| `payment:tr_w4XUfy6iFGuGQvDVatUYJ` | 2026-10-22T01:20Z | **aucune** |
| `payment:tr_VkYWAAHCLXKYvFn77TXYJ` | 2026-10-23T01:01Z | **aucune** |

**[V]** `mollie_customers` contient pour ces sessions **2 clients avec des
adresses personnelles** (adresses non reproduites ici : le dépôt est public) —
ces paiements ont donc été créés avec de vraies adresses, et **leur sort n’est
enregistré nulle part**. Le webhook a été « traité » (ligne
`webhook_events`) mais aucune commande n’a été écrite : le paiement est
**invisible**. Statut Mollie de ces 5 paiements : **non vérifié** (la clé
API n’est pas accessible en lecture depuis l’environnement ; une vérification
Mollie en lecture seule est demandée en §7 action 1).

### 3bis.4 Le code du Worker **déployé** n’est pas versionné dans le dépôt

**[V]** API Cloudflare — Worker `botwow-api` :

| Fait | Valeur |
|---|---|
| `script_tag` de production | `20f5821adfeb465cae177120c9015f8f` |
| `modified_on` | **2026-10-27T07:46:02Z** |
| Dernière version de code | n° 49 `87900aa9…` (2026-10-27T07:46:00Z) |
| Annotations de cette version | **aucune** (`workers/commit_sha` **absent**) |
| Version n° 48 (23/10) | tag `bot-wow-kv-quota-20261023`, `commit_sha=83047d19…` |
| Le tag est-il un commit du dépôt ? | **NON** — `git cat-file -t 20f5821a…` → *not a valid object name* |
| Le tag est-il un blob du dépôt ? | **NON** |
| Blob du `worker/index.js` de `main` | `725d98e4…` ≠ tag de production |

→ **La version en production n’est rattachable à aucun commit.** Elle a été
chargée par `wrangler` (`last_deployed_from: wrangler`) **sans**
`commit_sha`, contrairement à la version précédente. C’est **exactement la
même cause structurelle que le Worker `sg-payments` de Sargasses** (voir
`reports/sargagame/REVENUE-STATE-2026-11-04.md` §2bis) : **le chemin de
paiement n’est ni vérifié ni versionné.**

### 3bis.5 Funnel complet, et le point où il s’arrête

**[V]** Census de la table `events` (D1 `botwow-analytics`, remote) :

| Événement | Total | Depuis le 2026-10-28 | Commentaire |
|---|---:|---:|---|
| `page_view` | 1 539 | 531 | trafic entrant |
| `journey_view` | 587 | 286 | |
| `cta_click` | 56 | 7 | |
| `checkout_requested` | 31 | **3** | clic sur un CTA d’achat (non testé) |
| `checkout_start` | 4 | **0** | soumission du formulaire d’achat |
| `checkout_created` | 6 | **0** | paiement créé par le Worker |
| `checkout_failed` | 6 | **0** | webhook `payment.expired` |
| `checkout_error` | **0** | 0 | **jamais émis** — le client n’a jamais echoqué d’échec d’appel API |
| `payment_confirmed`, `conversion`, `delivery_sent`, `activation`, `demo_open`, `offer_view` | **0** | 0 | maillons non atteints |

**[V]** Les 3 intentions d’achat restantes ont eu lieu le
**2026-10-29**, le **2026-11-02** et le **2026-11-04T02:47Z** (avec un
`journey_id` réel, `test=0`). **Aucune n’a produit de `checkout_start`** :
le clic s’arrête avant le formulaire.

**Deux lectures possibles, non départageables avec 3 observations :**
(a) friction d’interface (le formulaire n’est pas atteint/visible) ;
(b) abandon normal après le clic (l’offre à 20 € demande de llok email).
**Ce que l’on peut affirmer sans se tromper :** avec 531 pages vues sur
8 jours et **0** checkout démarré, **le volume est le premier frein
numérique**, avant tout diagnostic de paiement.

---

## 4. Blocages de conversion (classés par impact)

| # | Blocage | Preuve | Impact | Traité ? |
|---|---|---|---|---|
| **B1** | **Le checkout n’a jamais encaissé** — non pas parce qu’il « échoue », mais parce que **personne n’a finalisé un paiement** : 11 paiements Mollie créés, 11 `expired`, `method=null`, `paidAt=null` | §3bis.1 (extraction du statut Mollie) | **Bloqueur total** : 0 € | **NON — autorisation requise** |
| **B2** | **Aucune base commerciale** : 25 commandes, **0 client payeur** ; 6 commandes `pending_payment` portent une adresse personnelle réelle (prospects qui n’ont jamais payé) ; `botwow_emails` = 12 lignes, toutes `@example.com` | D1 `botwow-production` | Aucun marché, aucune preuve de valeur | Non (business) |
| **B11** | `www.bot-wow.com` dupliqué sans redirection 301 (Cloudflare Pages n’applique pas `_redirects` par domaine) | HTTP 200 identique sur les deux hôtes | Signal de consolidation déclaratif seulement | **OUI** (code, PR #73) — remédiation **zone-level** |
| **B3** | Pages legacy live sur `api.bot-wow.com/{de,en,es,pt,ru}/` | HTTP 200 + contenu mesuré | Risque SEO + promesse « 0 € » en data structurée | **OUI** (code) — déploiement à confirmer |
| **B4** | `www` dupliqué sans redirection 301 — **couvert par B11** | HTTP 200 identique sur les deux hôtes | — | (idem B11) |
| **B5** | Tunnel non dédupliqué | Schéma `events` sans unicité | Taux d'intention inexploitables | **OUI** |
| **B6** | Test et réel indiscernables | `test` toujours à 0 | Revenu potentiellement faux | **OUI** |
| **B7** | Activation jamais mesurée | `activations` = 0 ligne | Dernière étape du tunnel invisible | **OUI** (code) |
| **B8** | « 1 machine » (pages) vs `max_activations=2` (code) vs « no seat limits » (FAQ) | §1.5 | Garantie incohérente | **NON — décision requise** |
| **B9** | Checkout bloqué côté interface (PR #54), pas côté Worker | Pages de vente : bouton désactivé | Un POST direct reste possible tant que le Worker n'est pas gardé | **NON — autorisation requise** |
| **B10** | `demo_open` et `offer_view` : 0 ligne malgré un code émetteur | D1 analytics | Deux étapes du tunnel invisibles | À investiguer |
| **B12** | **5 webhooks Mollie traités sans commande** (22–23/10, dont 2 avec adresses personnelles) → paiement invisible, sort inconnu | §3bis.3 (jointure `webhook_events ⋈ orders`) | **Argent possiblement encaissé sans aucune trace** ; impossible de rapprocher | **NON — vérification Mollie en lecture seule requise** |
| **B13** | ⚠️ **Le checkout BOT-WOW encaisse dans l’organisation Mollie de Sargasses** (`profileId pfl_t8KCk4Cm2C`, `org_19554425`) — aucun profil BOT-WOW n’existe | §3bis.2 (metadata D1 + dépôt `sargagame`) | **Contamination croisée des revenus** des deux moteurs ; attribution de revenu non fiable | **NON — décision commerciale + secrets** |
| **B14** | **Le code du Worker en production n’est rattachable à aucun commit** (tag `20f5821a…` absent du dépôt, version n° 49 sans `commit_sha`) | §3bis.4 (API Cloudflare) | On ne sait pas **quel code encaisse** ; rollback non reproductible | **NON — redéploiement versionné requis** |
| **B15** | **Volume quasi nul** : 531 pages vues / 8 j → 7 `cta_click` → 3 `checkout_requested` → **0** `checkout_start` | §3bis.5 (census `events`) | Le tunnel est **mesuré** mais vide ; aucun levier de conversion ne peut être validé dessus | Non (business) |

**Sur B1 — ce que l’on sait désormais (2026-11-04T16:45Z) :**
la création du paiement **fonctionne** (11 objets Mollie créés en mode
`live`, avec id, lien de checkout et expiration). Les 6 `checkout_failed` sont
des webhooks `payment.expired`. Le point de rupture mesuré est **après** la
création : aucun moyen de paiement n’a été choisi (`method=null`), donc
`paidAt=null` et encaissement 0,00 €. Restent deux causes **non départageables
sans un test contrôlé** : (a) la page de paiement Mollie n’a jamais été
affichée à l’acheteur (casse front : le `checkout_requested` le plus récent
est du 2026-11-04T02:47Z et n’a produit **ni** `checkout_start` **ni**
`checkout_error`), ou (b) abandon après le clic. **Reproduire exigerait de
créer un vrai objet de paiement Mollie — action de paiement qui exige une
autorisation explicite.** Ce diagnostic est donc laissé documenté, pas
contourné. **À traiter avant tout :** le profil Mollie partagé avec Sargasses
(B13) — payer dans le mauvais compte n’est pas un test, c’est un défaut de
séparation comptable.

---

## 5. Tests, commit, PR, production

### 5.1 Commits et PR

| Élément | Valeur |
|---|---|
| Branche | `docs/current-state-final-20261104` (base `origin/main` @ `33becbf3`) |
| **PR #70 — ONE CORE OFFER** | **MERGED** 2026-11-04T07:57:11Z — merge commit `e2a93384ff499b8364d2f78f4f0ec1d3dcfab26c` |
| **PR #71 — preuve de livraison v1.2.0** | **MERGED** 2026-11-04T08:57:50Z — merge commit `084e2bd` (`worker/index.js` **+185 / −72**) : garde `RELEASE_STATUS` (409 avant encaissement), reprise idempotente de la livraison, journal `deliveries`, mesure `license_activated`, renvoi opérationnel, intégration PR #19 + PR #44 |
| **PR #73 — redirections `www`** | **MERGED** 2026-11-04T08:18:44Z — merge commit `dfc11582` : retrait des règles `_redirects` `www` **inopérantes** (Cloudflare Pages n'applique pas les redirections par domaine), remédiation **zone-level** documentée |
| **PR #74 — `paths-ignore` `reports/**`** | **MERGED** 2026-11-04T11:34:39Z — merge commit `5fcaebe` : les commits documentaires ne déclenchent plus de déploiement Pages |
| **PR #75 — garde-fou commercial consigné** | **MERGED** 2026-11-04T12:05:55Z — merge commit `33becbf3` |
| **PR #76 — recalage de l’état courant** | **MERGED** 2026-11-04T13:16Z — merge commit `595e7acd85996512d404a3f4b2b278ea2c4bfe35` |
| **PR #77 — `profileId` selon le type d’identifiants** | **DRAFT**, non fusionnée, non déployée — correctif de **transport** du paramètre ; ne corrige **pas** la séparation des comptes Mollie (B13) |
| **PR #78 — revalidation live Cloudflare + D1** | **OUVERTE**, documentaire — recoupe mes mesures (0,00 €, 11 Mollie `failed`, 0 activation, 0 livraison) |
| **PR #79 — honnêteté de la copie d’achat EN/FR** | **OUVERTE** — 8 surfaces d’achat ; le checkout reste bloqué |
| **Ce document — correction du chiffre d’affaires** | PR de documentation : correction du tableau `provider`/`status` (§3), ajout du §3bis (statut Mollie réel, profil partagé Sargasses, 5 webhooks sans commande, code non versionné, census complet), reclassement B1/B2 et des actions |
| Tests ajoutés | `tests/legacy-landing.test.mjs` (34 assertions) · `tests/payment-mode.test.mjs` (15) · `tests/funnel-dedup.test.mjs` (9) · `tests/delivery-replay.test.mjs` (41, PR #71) |
| Tests réparés | `tests/funnel.test.mjs` — 36 assertions, **0 échec** (8 échecs avant, jamais exécuté par la CI) |

### 5.2 Contrôles locaux (exécution réelle)

| Commande | Résultat |
|---|---|
| `npm test` | **exit 0** — 21 suites, dont les 4 tests de tunnel |
| `npm run validate` | **exit 0** |
| `git diff --check` | PASS |

### 5.3 Déploiement — état vérifié le 2026-11-04T13:21:12Z

| Élément | Valeur | Statut |
|---|---|---|
| Pages (PR #70) | deployment `7540967184` (sha `e2a93384`) | **success** |
| Pages (PR #73) | deployment `7541341864` (sha `dfc11582`) | **success** |
| Pages (PR #71) | deployment `7542044619` (sha `084e2bd`) | **success** |
| **Worker `botwow-api`** | tag `20f5821adfeb465cae177120c9015f8f`, `modified_on 2026-10-27T07:46:02Z` | **NON REDÉPLOYÉ** — cible de rollback ; le code #70/#71/#73 n'est pas en production |

Mesures live du 2026-11-04T13:21:12Z (directement vérifiées) :

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

**Garde-fou commercial — vérifié ACTIF en production le 2026-11-04T13:21:12Z**
(lecture seule du HTML de `https://bot-wow.com/buy` et `https://bot-wow.com/fr/buy`) :

| Contrôle | `/buy` | `/fr/buy` |
|---|---|---|
| Marqueur `checkout-blocked` | **présent** | **présent** |
| Bouton d'achat `disabled` | **oui** | **oui** |
| Prix 20 € | **oui** | **oui** |
| Aucun palier (4,99 / 7,99 / 9,99) | **oui** | **oui** |
| Aucune mention positive d'abonnement | **oui** | **oui** |
| Négation explicite | « No subscription, no hidden modules, no surprise renewal » + « one-time payment · no renewal, ever » | « Pas d'abonnement, pas de module caché, pas de renouvellement surprise » + « paiement unique · aucun renouvellement, jamais » |

→ **ONE CORE OFFER tient en production** et **le checkout réel reste bloqué**.
Aucun paiement créé, aucun email client envoyé.

> L'API est servie par `api.bot-wow.com` (Worker) et **non** par
> `bot-wow.com/api/` — le dépôt `bot-wow.com` n'a aucun dossier `api/`, et
> `assets/app.js` documente que `/api/config` y renvoie 404. Un 404 sur
> `bot-wow.com/api/config` est donc **attendu**, pas une régression.

### 5.4 Correctif de trigger deploy (MERGED — PR #74)

PR #71 annonçait dans son corps « Exclut `reports/**` de `pages.yml`
(`paths-ignore`) » — **la modification n'a jamais été appliquée** : le
`pages.yml` mergé ne contenait que `AGENTS.md` et
`.github/workflows/pages.yml`. Un commit documentaire en `reports/**`
déclenchait donc **inutilement** un déploiement Pages.

**Correction appliquée et mergée (PR #74, `5fcaebe`, 2026-11-04T11:34:39Z) :**
`'reports/**'` ajouté au `paths-ignore` de `.github/workflows/pages.yml`. Aucun
workflow de CI utile n'est désactivé (`validate.yml` et `ui-quality.yml`
continuent de tourner sur `main`).

**Vérifié en production :** les merges documentaires #74 et #75 n'ont déclenché
**que** le workflow `Validate Bot-Wow` — **zéro** déploiement Pages. Le
déploiement Pages `7542044619` (sha `084e2bd`) reste le dernier en ligne.

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
  Les 11 paiements des 27/10 ont bien été créés par l’API Mollie (mode
  `live`), mais **aucun n’a été payé** : leur sort commercial est « expiré ».
- **[N]** Le statut Mollie des **5 paiements sans commande** (§3bis.3) n’a pas
  pu être consulté : la clé API n’est pas lisible depuis l’environnement.
  **Vérification Mollie en lecture seule à faire par un opérateur
  autorisé** — c’est la seule trace qui pourrait révéler un encaissement
  sans commande.
- **[N]** La **clé** Mollie du Worker `botwow-api` n’a pas pu être lue
  (secret). Ce qui est établi, c’est que le **profil** utilisé par le code
  (`pfl_t8KCk4Cm2C`) est celui de Sargasses (§3bis.2). Rattacher la clé au
  bon profil exige un opérateur autorisé.
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

> **Recalage du 2026-11-04T17:05Z.** Les trois actions ci-dessous ont été
> **remplacées** : la mesure du §3bis montre que le checkout **crée** bien les
> paiements (B1 n’est pas une panne technique) mais qu’il encaisse dans le
> **compte Mollie de Sargasses** (B13), que le code en production n’est
> **rattachable à aucun commit** (B14), et que le tunnel est **quasi vide**
> (B15). L’ordre suit donc **l’ordre des verrous**, pas celui de la
> confortabilité.

### 1) Séparer et versionner le chemin de paiement (B13 + B14)
**Potentiel : le plus élevé des trois moteurs BOT-WOW** (sans séparation des
comptes, un euro encaissé par BOT-WOW est **attribué au mauvais produit** —
c'est-à-dire que même une vente réussie produirait une **mesure de revenu
fiable**) · **Preuve : maximale et vérifiable** (`profileId pfl_t8KCk4Cm2C` +
`org_19554425` dans la metadata de nos propres commandes ; profil identique
confirmé dans 3 fichiers du dépôt `sargagame` ; version Worker n° 49 **sans**
`commit_sha` ; tag `20f5821a…` absent du dépôt) · **Effort : faible à moyen**
(profil + clé **BOT-WOW dédiés** côté Mollie, puis redéploiement du Worker
avec `commit_sha` — les deux sont des **autorisations** : secrets et
déploiement de production).

Décision à prendre : **(a)** créer un profil BOT-WOW dans l'organisation
Mollie et y lier une clé dédiée, ou **(b)** acter l'existence d'un compte
Mollie unique multi-produits et documenter une règle d'affectation des
revenus. **(a) est la seule option qui rende la mesure par produit
fiable.** Pendant ce temps : **ne pas activer le checkout réel**, et
**faire vérifier en lecture seule les 5 paiements sans commande** (B12).

### 2) Prouver un paiement de bout en bout (B1)
**Potentiel : élevé** (c'est le 0 € → 1 €) · **Preuve : forte** (11 paiements
créés en mode `live`, tous expirés non payés ; le tunnel client s'arrête à
`checkout_requested`) · **Effort : moyen** — 1 autorisation pour un paiement
réel **dans le profil BOT-WOW dédié** (donc après l'action 1), sur un
parcours complet (page de paiement affichée → moyen de paiement choisi →
webhook → licence → email → activation). Chaque étape doit être observée,
pas supposée.

### 3) Produire du volume qualifiant (B15)
**Potentiel : moyen mais non mesurable aujourd'hui** (531 pages vues / 8 j,
7 `cta_click`, 3 intentions, **0** checkout démarré : aucun levier de
conversion ne peut être validé sur un tunnel de 3 observations) ·
**Preuve : forte** (census `events` complet, §3bis.5) · **Effort : faible
techniquement / élevé commercialement** — trafic, SEO, ou communauté.
À condition de **ne pas acheter de trafic** avant la décision de conformité
(PR #66, Blizzard) : un achat de trafic sur le produit actuel serait
dépensé deux fois.

### En parallèle, sans urgence revenue
- **B8 — garantie d'activation** (« 1 machine » vs `max_activations=2` vs
  « no seat limits ») : 1 décision + copy + 1 constante. Coût faible,
  effet sur la confiance au moment de l'achat.
- **B12 — rapprochement des 5 paiements sans commande** : 1 lecture seule de
  l'API Mollie par un opérateur autorisé.
- **B4/B11 — `www` → apex** : redirection au niveau zone Cloudflare.

> **Rappel de doctrine :** aucune modification du checkout réel, des prix,
> des remboursements, des paiements ou des envois clients n'a été faite dans
> cette passe. Le checkout **réel n'a pas été réactivé** : il reste bloqué
> côté interface (PR #54) et le Worker n'a reçu aucun « déblocage ».

