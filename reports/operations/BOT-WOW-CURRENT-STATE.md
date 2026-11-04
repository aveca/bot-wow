# BOT-WOW — État courant Factory V3

**Dernière mise à jour : 2026-11-04T17:14Z** — revalidation de main, Cloudflare Pages, Worker, D1 et parcours public après PR #79 ; réconciliation du chiffre d'affaires dans la PR #80.

---

## 0.0.1 — Snapshot opérationnel vérifié, 2026-11-04T17:14Z

### GitHub et livraison Pages

| Élément | État vérifié |
|---|---|
| Dépôt | `aveca/bot-wow` uniquement |
| `main` | `657921ea892130019e2eb17518d8bc36e6a2c60d` |
| PR #79 | fusionnée le 2026-11-04T16:50:27Z ; correction des huit surfaces d'achat EN/FR et variantes A/B |
| Cloudflare Pages | déploiement production `68191ea2-542a-44e7-bb32-3e9705c316e0`, créé à 16:50:29Z, étape `deploy=success`, commit source = SHA de main ci-dessus |
| PR #80 | ouverte, documentation revenue + présent snapshot ; CI du HEAD précédent : Validate et UI quality SUCCESS |
| PR #78 | ouverte, documentation opérationnelle ; CI SUCCESS ; branche basée sur l'ancien main `595e7acd`, aucune fusion effectuée |
| PR #77 | draft/open ; CI SUCCESS ; correctif de transport `profileId` uniquement, pas une séparation de profil/compte |
| PR #66 | draft/open ; pivot conformité non automatisant non décidé |

Le workflow Pages ignore `reports/**` : ce snapshot documentaire ne doit pas provoquer un nouveau déploiement applicatif. Aucun merge sur main n'est effectué ici.

### Pages publiques — source et vérification live à distinguer

- Le déploiement Cloudflare Pages du commit `657921e` est directement confirmé SUCCESS.
- Le code de main ne contient plus de badge Mollie actif, de promesse de redirection Mollie ni de promesse de livraison e-mail déjà certifiée sur les huit surfaces EN/FR et A/B. Les tests `release-availability.test.mjs` et `ab-variants.test.mjs` couvrent ces interdictions ; la recherche du dépôt pour les anciennes chaînes de paiement actif ne retourne aucun résultat.
- La lecture textuelle web disponible de la homepage et de `/buy` retourne toutefois encore des fragments anciens (« Payment by Mollie », redirection Mollie, paiement prétendument actif) alors que le source et le commit déployé les ont supprimés. Cette lecture peut être un cache/index périmé ; **l'HTML réellement servi après GET no-cache / navigateur n'est pas encore départagé**. Ne pas modifier de nouveau le code avant cette vérification directe.
- Le message de sécurité actuel reste : checkout désactivé, livraison v1.2.0 non confirmée, ne pas payer.

### Worker et intégrations

- Worker de production : `botwow-api`. Dernier événement de déploiement observé : 2026-10-27T07:46:28Z ; aucune version Worker liée au commit main du 04/11 n'a été déployée.
- La version de code observée dans le rapport revenue est la version #49 du 27/10, sans annotation `commit_sha` rattachable au dépôt.
- Les noms de bindings `MOLLIE_API_KEY`, `MOLLIE_PROFILE_ID`, `MOLLIE_WEBHOOK_SECRET`, `RELEASE_STATUS` et `RESEND_API_KEY` sont présents dans les paramètres Worker. **Leurs valeurs sont masquées et leur validité n'est pas démontrée** par leur seule présence.
- Les objets Mollie historiques de BOT-WOW portent un profil partagé/non dédié à BOT-WOW. La PR #77 corrige le transport conditionnel de `profileId`, mais ne crée ni ne prouve un profil BOT-WOW séparé. **Ne pas réutiliser ce profil pour encaisser BOT-WOW.**
- Le code de main garde `RELEASE_STATUS` en échec fermé par défaut (`pending`) et refuse le checkout tant que le statut serveur n'est pas explicitement `confirmed`. Aucune valeur secrète n'a été lue ou modifiée.

### D1 production — lecture seule, aucun changement écrit

Requêtes Cloudflare D1 en lecture seule ; réponses : `changed_db=false`, `rows_written=0`.

| Mesure | Résultat |
|---|---:|
| Commandes | 25 |
| `bitcoin_manual / paid` | 5 lignes, 100,00 € nominaux — données de test (`@example.com`, TXID de test et adresse BTC placeholder) |
| `bitcoin_manual / pending_payment` | 8 lignes, 160,00 € nominaux |
| `bitcoin_manual / rejected` | 1 ligne, 20,00 € nominaux |
| `mollie / failed` | 11 lignes, 220,00 € nominaux ; statut Mollie `expired` sur 11/11, mode `live`, `method=null`, `paidAt=null` |
| Licences | 5, toutes reliées aux 5 commandes Bitcoin de test |
| Activations | 0 |
| Livraisons enregistrées / envoyées | 0 / 0 |
| Webhooks | 16 traités ; 11 reliés à une commande après normalisation de l'identifiant `payment:`, 5 sans commande associée |
| Revenu réellement encaissé et confirmé | **0,00 €** |

Les 100,00 € des cinq lignes `paid` ne sont pas du revenu : les cinq adresses e-mail sont des données `example.com`, les références de transaction sont des valeurs de test et l'adresse BTC est un placeholder. Les 11 paiements Mollie ont expiré sans moyen de paiement ni date de règlement. Aucun paiement réel n'est prouvé.

### Funnel — D1 Analytics, depuis le 2026-10-22, `test=0`

| Événement | Nombre |
|---|---:|
| `page_view` | 1 554 |
| `journey_view` | 596 |
| `cta_click` | 48 |
| `checkout_requested` | 29 |
| `checkout_start` | 4 |
| `checkout_created` | 6 |
| `checkout_failed` | 6 |
| `payment_confirmed`, `conversion`, `delivery_sent`, `activation` | 0 |

Ces valeurs sont des volumes d'événements, pas des visiteurs uniques ni des ventes. Les six événements `checkout_failed` sont historiques et associés à des paiements Mollie expirés ; ils ne prouvent pas six paiements techniques rejetés.

### Décision et prochain verrou

**Checkout maintenu fermé. Revenu confirmé : 0,00 €.** La priorité n'est pas d'acheter du trafic : elle est de séparer le compte/profil Mollie BOT-WOW, de certifier l'artefact v1.2.0 et la livraison post-paiement, puis d'obtenir une autorisation explicite pour un test de paiement de bout en bout. Aucune création de paiement, aucun e-mail, aucune modification de secret, aucun changement de prix et aucun déploiement Worker n'ont été effectués.

Le produit automatise des actions dans WoW ; le risque de non-conformité aux conditions de Blizzard est explicite dans les pages publiques et `PRODUCT.md`. La décision de conformité/pivot documentée dans la PR #66 doit rester visible avant toute accélération commerciale.

---


**Dernière mise à jour de ce document : 2026-11-04T13:21Z** (revérification
post-merge PR #71, #73, #74 et #75 — preuve de livraison v1.2.0 + garde commercial)

---

# 0. État au 2026-11-04 — Mission revenue (ONE CORE OFFER)

**Dépôt :** https://github.com/aveca/bot-wow
**Branche de travail :** `docs/current-state-final-20261104` (base `origin/main` @ `33becbf3`)
**PRs mergées :** https://github.com/aveca/bot-wow/pull/70 · https://github.com/aveca/bot-wow/pull/71 · https://github.com/aveca/bot-wow/pull/73 · https://github.com/aveca/bot-wow/pull/74 · https://github.com/aveca/bot-wow/pull/75
**Rapport d'évidence :** `reports/operations/BOT-WOW-REVENUE-STATE-2026-11-04.md`
**Rapport livraison :** `reports/operations/2026-11-04-p0-delivery-proof.md`

## 0.0 Revérification du 2026-11-04T13:21Z (après les merges des PR #71, #73, #74 et #75)

| Élément | Valeur | Statut |
|---|---|---|
| `main` | `33becbf3` (merge PR #75, 2026-11-04T12:05:55Z) | MERGED |
| PR #71 | « P0 — preuve de livraison v1.2.0 + garde + reprise idempotente » (`worker/index.js` **+185 / −72**, `tests/delivery-replay.test.mjs` 41 contrôles, intégration PR #19 + PR #44) | MERGED |
| PR #73 | « retirer les règles www mortes et documenter la remediation zone-level » | MERGED (`dfc11582`, 08:18:44Z) |
| Pages (PR #71) | deployment `7542044619` (sha `084e2bd`) | **success** — en ligne |
| Pages (PR #73) | deployment `7541341864` (sha `dfc11582`) | **success** — en ligne |
| Pages (PR #70) | deployment `7540967184` (sha `e2a93384`) | **success** — en ligne |
| PR #74 | « rafraîchir l'état courant après le merge de la PR #71 » — `reports/**` ajouté au `paths-ignore` de `pages.yml` | MERGED (`5fcaebe`, 11:34:39Z) |
| PR #75 | « consigner la vérification du garde-fou commercial en production » | MERGED (`33becbf3`, 12:05:55Z) |
| **Worker `botwow-api`** | tag `20f5821adfeb465cae177120c9015f8f`, `modified_on = 2026-10-27T07:46:02Z` | **NON REDÉPLOYÉ** — le code Worker de #70, #71 et #73 n'est pas en production |

### Mesures live du 2026-11-04T13:21:12Z (directement vérifiées, lecture seule)

| Requête | Résultat mesuré |
|---|---|
| `GET https://bot-wow.com/` | **200**, stamp d'assets `cb3925b6` |
| `GET https://bot-wow.com/buy.html` | **308** → `/buy` |
| `GET https://bot-wow.com/fr/buy.html` | **308** → `/fr/buy` |
| `GET https://bot-wow.com/worker/index.js` | **404** — code source non exposé |
| `GET https://bot-wow.com/package.json` | **404** |
| `GET https://api.bot-wow.com/api/config` | **200** — `{"product":"bot-wow-lifetime","priceEur":20,"currency":"eur",...}` — **prix inchangé** |
| `GET https://api.bot-wow.com/de/` | **200 + contenu legacy** — **attendu** : le Worker n'a pas été redéployé |
| `GET https://api.bot-wow.com/` | **200** (racine Worker) |
| `GET https://www.bot-wow.com/` | **200** — redirection `www` → apex **toujours inopérante** (B11) |

### Garde-fou commercial — vérifié ACTIF en production le 2026-11-04T13:21:12Z

Contrôle du HTML servi par `https://bot-wow.com/buy` et `https://bot-wow.com/fr/buy`
(lecture seule) :

| Contrôle | `/buy` | `/fr/buy` |
|---|---|---|
| Marqueur `checkout-blocked` présent | **oui** | **oui** |
| Bouton d'achat `disabled` | **oui** | **oui** |
| Prix affiché 20 € | **oui** | **oui** |
| Aucun palier (4,99 / 7,99 / 9,99) | **oui** | **oui** |
| Aucune mention positive d'abonnement | **oui** | **oui** |
| Négation explicite de l'abonnement | « **No subscription**, no hidden modules, no surprise renewal » + « one-time payment · no renewal, ever » | « **Pas d'abonnement**, pas de module caché, pas de renouvellement surprise » + « paiement unique · aucun renouvellement, jamais » |
| Mention « licence à vie » | « lifetime licence » | « Licence à vie » |

→ **ONE CORE OFFER tient en production** (une seule licence à 20 €, paiement
unique, aucun abonnement) et **le checkout réel reste bloqué**. Aucun paiement
n'a été créé, aucun email client envoyé.

> Rappel de méthode : l'API ne vit **pas** sous `bot-wow.com/api/` (le dépôt
> `bot-wow.com` n'a aucun dossier `api/` — `assets/app.js` le documente : « vérifie :
> /api/config sur bot-wow.com renvoie 404 »). L'API est servie par le Worker sur
> `api.bot-wow.com`. Vérifier `bot-wow.com/api/config` donne un **404 attendu** et
> ne doit pas être lu comme une régression.

## 0.1 Commits

| SHA | Contenu |
|---|---|
| `34b8ac8` | `fix(revenue): offre unique, tunnel dedupplique, reel/test distingue` — code + tests + redirection www + déduplication + events test/live + activation + logs expurgés |
| `cbcbf3b` | `docs(report): etat du moteur de revenue BOT-WOW au 2026-11-04` |
| `e2a93384` | merge PR #70 — ONE CORE OFFER, tunnel dedup, réel/test, activation, logs expurgés |
| `084e2bd` | merge PR #71 — preuve de livraison v1.2.0, garde `RELEASE_STATUS` (409), reprise idempotente, journal `deliveries`, `license_activated`, renvoi opérationnel |
| `dfc11582` | merge PR #73 — retrait des règles `_redirects` `www` mortes, remédiation zone-level documentée |
| `5fcaebe` | merge PR #74 — `reports/**` ajouté au `paths-ignore` de `pages.yml` (les commits documentaires ne redéploient plus Pages) |
| `33becbf3` | merge PR #75 — vérification du garde-fou commercial consignée dans l'état courant |

## 0.2 Décisions structurantes

- **ONE CORE OFFER** : démo navigateur gratuite + **une seule** licence à
  **20,00 €** (`PRICE_TABLE` 2000 EUR, `/api/config` `priceEur: 20`).
  Aucun forfait, aucun palier, aucun abonnement.
- **PR #69 supersedée** : ses 3 forfaits mensuels (4,99 / 7,99 / 9,99)
  violaient ONE CORE OFFER. Seul son correctif de **redaction des logs** a
  été repris (9 sites).
- **Prix inchangé** : aucune modification de prix n'a été faite (pas de
  donnée commerciale pour justifier 20 € → autre valeur).

## 0.3 Faits vérifiés (production, 2026-11-04)

| Constat | Preuve |
|---|---|
| `api.bot-wow.com/{de,en,es,pt,ru}/` servait une landing legacy contradictoire en **HTTP 200** (« anti-detection », « Farm your WoW gold », « 100% free », JSON-LD `"price":"0"`) | curl production |
| `www.bot-wow.com` et `bot-wow.com` renvoyaient **tous deux 200**, contenu identique (40 340 octets) | curl production |
| **Chiffre d'affaires réel = 0,00 €** | D1 `botwow-production` : les 5 commandes `paid` sont `bitcoin_manual` sur `@example.com` (tests) ; 0 activation ; 0 livraison ; checkout Mollie **6/6 en échec** (27/10) |
| Tunnel mesuré **jusqu'à `checkout_created` / `checkout_failed` seulement** | D1 `botwow-analytics` : `demo_open`, `offer_view`, `payment_confirmed`, `license_created`, `delivery_sent`, `activation` = **0 ligne** |

## 0.4 Corrections apportées (code, non déployées)

1. Générateur de landing legacy **supprimé** ; l'hôte API redirige **308**
   vers `https://bot-wow.com/<chemin>` (routes `/api/*` et `/health`
   intactes). Worker : 244 178 → 116 431 octets.
2. Règle **301 `www` → apex** dans `_redirects` (PR #70) — **montée comme
   inopérante** : Cloudflare Pages n'applique pas les redirections par domaine.
   La PR #73 a donc **retiré** ces règles et documenté la remédiation
   **zone-level** (cf. B11).
3. **Déduplication du tunnel** côté client (`assets/analytics.js`), clé
   `event|page|cta|step|mode|years`, échappatoire `?telemetry_dedup=0`.
4. **Réel / test distingués** (fail-safe) : `payment.mode === "test"` ⇒
   `test = 1` **et** `value_eur = NULL`.
5. Événement serveur **`activation`** (la dernière étape du funnel n'était
   pas mesurée).
6. **Logs du Worker expurgés** (e-mail client et clé de licence).
7. `tests/funnel.test.mjs` **réparé** et branché dans `npm test`
   (8 échecs → 0) ; 3 nouveaux fichiers de test.

## 0.5 Tests (exécution locale réelle, 2026-11-04)

| Commande | Résultat |
|---|---|
| `npm test` | **exit 0** — 21 suites (4 suites de tunnel : 36 + 34 + 15 + 9 assertions) |
| `npm run validate` | **exit 0** |
| `node scripts/versionne-assets.mjs` | exit 0, idempotent, stamp `cb3925b6`, 0 fichier versionné |
| `git diff --check` | PASS |

## 0.6 Production — état

| Élément | Valeur |
|---|---|
| Worker **déployé** | tag `20f5821adfeb465cae177120c9015f8f` (`modified_on 2026-10-27T07:46:02Z`) — **inchangé**, **cible de rollback** |
| Worker **PR #70 / #71 / #73** | **NON déployé** — un déploiement exige une autorisation explicite (AGENTS.md §5) et embarquerait le delta non revu du 22/10 → 27/10 (+103 / −112 lignes) |
| Pages (`main`) | `main` = `33becbf3` — dernier déploiement Pages `7542044619` (sha `084e2bd`) **success** (09:00:28Z). Les merges #74 et #75 (documentaires) n'ont déclenché **que** `Validate Bot-Wow` — **zéro** déploiement Pages |
| Schéma D1 | à jour (migrations `0001`→`0004` appliquées le 23/10, `0003` analytics incluse) — risque de schéma écarté |
| Checkout réel | **inchangé et non réactivé** (bloqué côté interface, PR #54) |
| Secrets | **aucune modification** ; `MOLLIE_PROFILE_ID` est présent mais `createMolliePayment` n'envoie **jamais** `profileId` |

## 0.7 Bloqueurs

- **B1** — Checkout Mollie **6/6 en échec** : bloqueur total (0 € possible).
  Le `createMolliePayment` n'envoie pas `profileId`. **La cause exacte exige
  de créer un vrai paiement Mollie → autorisation explicite requise.**
- **B8** — `buy.html` dit « activates on one machine », le Worker applique
  `DEFAULT_MAX_ACTIVATIONS = 2`, la FAQ dit « no seat limits » :
  **décision commerciale requise** (non tranchée).
- **B9** — Le checkout n'est bloqué que côté interface ; un POST direct
  reste possible tant que le Worker n'est pas gardé.
- **B10** — `demo_open` / `offer_view` : 0 ligne malgré un code émetteur
  (cause non établie).
- **B11** — `www.bot-wow.com` sert encore en **200** (contenu identique à
  l'apex). Les règles `_redirects` de la PR #70 étaient **inopérantes**
  (Cloudflare Pages n'applique pas les redirections par domaine) : elles ont
  été **retirées** par la PR #73. **Remédiation = niveau zone Cloudflare**
  (Single Redirect `www` → apex + DNS proxied + retrait de l'alias Pages)
  → **autorisation explicite requise** (AGENTS.md §5).

## 0.8 Prochaine action (une seule)

**Diagnostic du checkout Mollie (B1)** : établir la cause des 6 échecs du
27/10 et débloquer le paiement — action de paiement réel, **autorisation
explicite requise**. Tout le reste est déjà code, testé et mergé
(#70, #71, #73) : Pages est à jour ; il reste le **déploiement Worker**, qui
exige la même autorisation. Une seconde action, sans impact commercial, est
**B11** (redirection `www` → apex au niveau zone Cloudflare).

> Aucune offre n'est déclarée rentable : les données commerciales
> sont insuffisantes (0,00 € encaissés, 0 client réel).

---

# Historique — snapshot du 2026-10-28 (PR #54 mergée)

**Branche :** `main` — **SHA de main :** `7d6cc4e` (après `git pull --ff-only`, vérifié localement)
**PR #54 :** **MERGED** sur main (SHA `ff55666` de la branche, merge commit dans `7d6cc4e`)

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