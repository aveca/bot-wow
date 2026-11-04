# BOT-WOW — État courant Factory V3

**Dernière mise à jour de ce document : 2026-11-04T18:20Z** (PR #78 et #80 fusionnées — CA BOT-WOW corrigé à 0,00 €, chemin de paiement réel mesuré, R18 fermé côté Sargasses)

---

# 0. État au 2026-11-04 — Mission revenue (ONE CORE OFFER)

**Dépôt :** https://github.com/aveca/bot-wow
**Branche de travail :** `docs/current-state-r18-closed-20261104` (base `origin/main` @ `db1a35e3`)
**PRs mergées :** https://github.com/aveca/bot-wow/pull/70 · /71 · /73 · /74 · /75 · /76 · /77 · /78 · /79 · /80
**Rapport d'évidence :** `reports/operations/BOT-WOW-REVENUE-STATE-2026-11-04.md`
**Rapport livraison :** `reports/operations/2026-11-04-p0-delivery-proof.md`

## 0.0 Revérification du 2026-11-04T13:21Z (après les merges des PR #71, #73, #74 et #75)

| Élément | Valeur | Statut |
|---|---|---|
| `main` | `33becbf3` (merge PR #75, 2026-11-04T12:05:55Z) | MERGED |
| PR #71 | « P0 — preuve de livraison v1.2.0 + garde + reprise idempotente » (`worker/index.js` **+185 / −72**, `tests/delivery-replay.test.mjs` 41 contrôles, intégration PR #19 + PR #44) | MERGED |
| PR #73 | « retirer les règles www mortes et documenter la remediation zone-level » | MERGED (`dfc11582`, 08:18:44Z) |
| GitHub Pages (PR #71) | deployment `7542044619` (sha `084e2bd`) | **success** — en ligne |
| GitHub Pages (PR #73) | deployment `7541341864` (sha `dfc11582`) | **success** — en ligne |
| GitHub Pages (PR #70) | deployment `7540967184` (sha `e2a93384`) | **success** — en ligne |
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
| `595e7acd` | merge PR #76 — réconciliation documentaire après les merges #73/#74/#75 |

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
| GitHub Pages workflow | Le filtre `paths-ignore: reports/**` empêche le workflow GitHub Pages de traiter les commits documentaires ; sur PR #76, Validate et UI quality sont **success**. |
| Cloudflare Pages (domaine public) | Déploiement `d9d79ad7-0d35-4bf4-a5db-8fae45f5de77`, commit `595e7acd`, stage `deploy` **success** le 2026-11-04T13:42:52Z — déclenché par `github:push`. Le filtre du workflow GitHub Pages ne s'applique pas à l'intégration Cloudflare Pages. |
| Schéma D1 | à jour (migrations `0001`→`0004` appliquées le 23/10, `0003` analytics incluse) — risque de schéma écarté |
| Checkout réel | **inchangé et non réactivé** (bloqué côté interface, PR #54) |
| Secrets | **aucune modification** ; `MOLLIE_PROFILE_ID` est présent mais `createMolliePayment` n'envoie **jamais** `profileId` |

## 0.7 Bloqueurs

- **B1** — Checkout Mollie : la relecture D1 du 2026-11-04T14:36Z trouve **11 commandes failed**, toutes avec statut fournisseur `expired` ; aucune preuve de paiement. La cause initiale de l'expiration reste non établie.
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

**P0 — preuve de paiement et de livraison** : les 11 commandes Mollie `failed/expired` n'expliquent pas à elles seules la cause initiale. Préparer un test contrôlé de bout en bout, puis le déploiement du Worker de #71 avec rollback ; paiement test, e-mail vers une boîte contrôlée et déploiement exigent une autorisation explicite. Voir les preuves D1 et Cloudflare du §0.9.

**P0 — conformité produit** : PR #66 contient un audit et une proposition de pivot non-automatisant ; la commercialisation du bot de gameplay ne doit pas être promue auprès des joueurs de serveurs officiels tant que le périmètre d'autorisation n'est pas résolu.

> Aucune offre n'est déclarée rentable : les données commerciales
> sont insuffisantes (0,00 € encaissés, 0 client réel).

---


## 0.9 Réconciliation live du 2026-11-04T14:36Z

### GitHub et CI
- `main` = `595e7acd85996512d404a3f4b2b278ea2c4bfe35` (PR #76 fusionnée).
- PR #71 et PR #76 sont fusionnées ; PR #19 est fusionnée via #71.
- CI de la PR #76 sur HEAD `3c4d984cea8a94fd34f94eb5fedbb3c1bfb4009f` : Validate Bot-Wow run `41838459326` **success** ; UI quality run `41838459418` **success**.

### Cloudflare — preuve indépendante
- **Cloudflare Pages `bot-wow`** : deployment `d9d79ad7-0d35-4bf4-a5db-8fae45f5de77`, créé à `13:42:32.659Z`, stage deploy **success** à `13:42:52.505Z`, déclencheur `github:push`, commit `595e7acd`.
- **Important :** `paths-ignore: reports/**` dans `.github/workflows/pages.yml` ne filtre que le workflow GitHub Actions Pages. Il ne filtre pas l'intégration GitHub → Cloudflare Pages ; un commit documentaire sur main peut donc encore déployer Cloudflare Pages.
- **Worker `botwow-api`** : version active observée `c3dcc842-c422-42d3-9828-405f30d70b5f` (version 50), déployée le `2026-10-27T07:46:28.277Z`, tag `20f5821adfeb465cae177120c9015f8f`. Aucun déploiement postérieur à PR #71. Les bindings `RELEASE_STATUS`, `MOLLIE_PROFILE_ID` et `RESEND_API_KEY` sont présents par nom, mais leurs valeurs restent masquées et non vérifiées.

### D1 — commandes et livraison (lecture seule)
- `orders` : **11** Mollie `failed`, toutes avec `metadata.mollie.status = expired` ; **5** `bitcoin_manual/paid` sur adresses `example.com` ; 7 `bitcoin_manual/pending_payment` sur autres domaines ; 1 pending et 1 rejected sur `example.com`.
- Jointure `orders → licenses` : les **5 licences** actives sont toutes liées aux 5 commandes manuelles de test `example.com`. Aucun autre groupe ne possède de licence.
- `deliveries` : **0 ligne** ; `activations` : **0 ligne**.
- **Ventes clients payées : 0 ; revenu réel confirmé : 0,00 €.**

### D1 — funnel
Comptes d'événements `test=0`, non assimilables à des visiteurs ou sessions uniques :
- `page_view` 1 490 (dernier : `2026-11-04T14:27:26.550Z`) ; `journey_view` 563 (14:27:26.548Z).
- `cta_click` 48 (dernier : `2026-11-04T02:47:00.736Z`) ; `checkout_requested` 29 (02:47:00.719Z).
- `checkout_start` 4 (dernier : 27/10 01:49:23Z) ; `checkout_created` 6 (27/10 23:07:01Z) ; `checkout_failed` 6 (27/10 23:23:17Z).
- Aucun événement `payment_confirmed`, `conversion`, `delivery_sent`, `delivery_failed` ou `activation` dans le regroupement courant.

**Interprétation :** les 29 `checkout_requested` sont des intentions client, pas des paiements. Les événements serveur de checkout n'ont plus bougé depuis le 27 octobre ; aucun paiement confirmé ni fulfillment n'est mesuré.

### Conformité plateforme — risque commercial P0
- La page d'achat publique avertit explicitement que l'automatisation enfreint les conditions Blizzard et peut entraîner suspension ou bannissement.
- La PR #66 est toujours ouverte en draft et contient le rapport de conformité du 2026-10-29 ainsi qu'une proposition de pivot non-automatisant : planificateur à saisie manuelle, carnet de spots et simulateur hors ligne, sans lecture d'écran, clic automatisé ni addon de contrôle.
- Cette conclusion est un audit interne, pas un avis juridique ni une décision de Blizzard. Aucune autorisation explicite n'est identifiée dans le rapport ; le pivot n'est pas implémenté.
- Ne pas promouvoir l'automatisation sur les serveurs officiels. Avant acquisition, décider entre une autorisation documentée pour un environnement qui permet explicitement l'automatisation et le pivot non-automatisant.

### Vérification publique et décision
- `/buy` et `/fr/buy` affichent le blocage de disponibilité ; le formulaire est présenté comme indisponible.
- Les quatre sources de vente `index.html`, `fr/index.html`, `buy.html`, `fr/buy.html` ont le bloc de disponibilité et `buyBtn disabled`.
- Aucun POST checkout, paiement, e-mail, changement de secret, écriture D1/R2 ou déploiement Worker n'a été effectué.
- Le gate serveur de PR #71 est dans main mais pas encore livré sur le Worker de production.

**Prochaine action P0 :** préparer un test contrôlé de bout en bout (paiement Mollie, webhook, licence, e-mail vers une boîte contrôlée, téléchargement), puis déployer le Worker avec rollback. Ces actions touchent aux paiements, e-mails et à la production : elles restent en attente d'une autorisation explicite. Ne pas rouvrir le checkout avant cette preuve.

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

---

# Latest revalidation — 2026-11-04T15:26Z

Latest evidence is recorded in [`2026-11-04-live-revalidation-1526z.md`](./2026-11-04-live-revalidation-1526z.md).

- `main` remains `595e7acd85996512d404a3f4b2b278ea2c4bfe35`.
- PR #77 is open/draft at `e25781fd0d10f0bffedaca982fdf4ed5bd74313a`; both GitHub Actions workflows passed on that exact head. It fixes the Mollie API-key `profileId` defect in code but is not deployed.
- PR #79 is open at `6a447b2c3e034dd8a298fa7c94c4675e5d9324c4`; it removes false Mollie-live/redirect claims from all eight purchase surfaces and adds regression tests. No CI run was available on its latest head at this timestamp; do not merge until checks pass.
- Cloudflare Pages production remains deployment `d9d79ad7` from `main@595e7acd`; preview deployments are disabled. Worker `botwow-api` remains on deployment `36227a4d` from 2026-10-27; PR #77 is not live.
- D1 read-only evidence: 11 Mollie failed orders; 5 paid `bitcoin_manual` test orders; 0 confirmed customer sales, €0.00 real revenue, 0 deliveries, 0 activations. Funnel: 1,508 live page views, 573 journeys, 48 CTA clicks, 29 checkout requests, 6 checkout-created and 6 checkout-failed events; no payment-confirmed or conversion events.
- Live EN/FR homepages and buy pages still contain Mollie availability/redirect claims while checkout is disabled. PR #79 corrects this, but is not live.
- PR #66 compliance/pivot decision remains open. Do not spend on acquisition or market the current automation to official-server players until platform compliance is resolved.

**Next action:** review PR #77; run the complete validation and browser suite on PR #79's exact head; keep the Worker deployment and checkout reopening gated on explicit authorization and a controlled end-to-end fulfillment test.


---

# Addendum — Mollie profile separation and CI — 2026-11-04T15:30Z

- Read-only Mollie `ListProfiles` returned exactly one verified profile: `pfl_t8KCk4Cm2C`, website `https://sargasses-martinique.com/`. No BOT-WOW profile was visible. **Never reuse the Sargasses profile or its API key for BOT-WOW.** The hidden Worker `MOLLIE_API_KEY` value/profile association remains unknown.
- A dedicated BOT-WOW Mollie profile and test API key are required before any test payment. No payment-list query was made because the Mollie connector requires the user to confirm the profile before profile-scoped payment searches.
- PR #77 remains draft/open and its two workflows passed on `e25781fd0d10f0bffedaca982fdf4ed5bd74313a`; the new API-key/profileId assertions are visible as passing in the test log.
- PR #79 latest head is now `e75101c83f70dba9ee9d26b177b723f27db12b80`. Validate SUCCESS (41858094767); UI quality still IN_PROGRESS (41858094806). The previous failure from a stale homepage section class was corrected by rebuilding the two homepage files from current main and applying only the copy changes. Latest validation passes the site-artifact, release-availability and A/B-variant tests.
- PR #78 docs branch: Validate SUCCESS (41857931194); UI quality still IN_PROGRESS (41857931055).
- D1 confirms no customer payment, payment-confirmed event, delivery or activation. Mollie's payment ledger was not independently reconciled; the `€0.00` value is application/D1-confirmed revenue only.

**Next action:** wait for PR #79 and PR #78 UI quality runs to finish; then review the copy PR. Separately obtain explicit confirmation for a dedicated BOT-WOW Mollie profile and test key before any payment test or Worker deployment.


---

# CI closeout — 2026-11-04T15:32Z

- PR #79 latest head `e75101c83f70dba9ee9d26b177b723f27db12b80`: both workflows SUCCESS; Playwright 158 passed, 0 failed (runs 41858094767 and 41858094806). Ready for review, not merged or deployed.
- PR #77 latest head `e25781fd0d10f0bffedaca982fdf4ed5bd74313a`: Validate and UI quality SUCCESS (runs 41857130935 and 41857130846); API-key `profileId` regression assertions passed.
- PR #78 documentation head `15e552678ce8d0aa8bde43ab835c25aad4eb4314`: Validate SUCCESS (41858615131); UI quality still IN_PROGRESS (41858615189).
- Merging PR #79 would trigger Cloudflare Pages production deployment; no merge/deployment was performed under the repository's explicit production gate.


# Mise à jour opérationnelle — 2026-11-04T16:48:26.613Z

- **main** : `595e7acd85996512d404a3f4b2b278ea2c4bfe35`, inchangé.
- **Routage Mollie** : les 11 paiements Mollie historiques BOT-WOW ont été relus individuellement ; tous sont expirés et rattachés au profil dont le site enregistré est `sargasses-martinique.com`. Aucun profil BOT-WOW n'est visible dans `ListProfiles`. Ne jamais réutiliser ce profil pour BOT-WOW. La cause des expirations n'est pas établie.
- **Credential** : les bindings `MOLLIE_API_KEY` et `MOLLIE_PROFILE_ID` existent, valeurs masquées ; type de credential non vérifié. PR #77 adapte le code pour API Key (sans `profileId`) et Advanced/OAuth (avec `profileId`) et ajoute des tests pour les deux cas. HEAD courant `502da4e`, checks à revalider après correction du mock URL.
- **PR #79** : six meta descriptions EN/FR des pages d'achat principales et A/B ne promettent plus une livraison e-mail non certifiée ; six assertions ajoutées. HEAD `85f6af3`, Validate success, UI quality en cours. Non fusionnée.
- **D1** : Mollie failed=11 (mode live, provider status expired, profil Sargasses) ; bitcoin_manual paid=5 (example.com, tests), pending=8, rejected=1 ; deliveries=0 ; activations=0 ; CA commercial confirmé=0 EUR. Funnel test=0 : page_view=1524, journey_view=581, cta_click=48, checkout_requested=29, checkout_start=4, checkout_created=6, checkout_failed=6 ; payment_confirmed/conversion/delivery/activation=0.
- **Production** : la page publique montre toujours l'ancien texte Mollie contradictoire ; PR #79 n'est pas déployée. Worker botwow-api version 50, déploiement 2026-10-27 ; bindings secrets présents par nom seulement.
- **Garde-fous** : aucun profil créé, secret modifié, paiement/e-mail envoyé, checkout rouvert ou déploiement effectué. Aucun changement sur main.
- **Prochaine action** : profil BOT-WOW indépendant + clé de test dédiée (autorisation requise), puis test contrôlé end-to-end après validation du code et des permissions.


- **Conformité officielle** : l'EULA Blizzard (révision du 21/03/2024) interdit la création, l'offre, la promotion et la distribution de bots non autorisés, définis comme des logiciels contrôlant automatiquement un jeu/personnage. Le comportement public de BOT-WOW (lecture du flotteur + clic automatisé) est donc un risque direct pour la commercialisation sur le service officiel. Référence : https://www.blizzard.com/en-us/legal/08b946df-660a-40e4-a072-1fbde65173b1/blizzard-end-user-license-agreement. Priorité à la PR #66 et à une offre non-automatisante ; pas d'acquisition ciblant les joueurs des serveurs officiels sans autorisation explicite.


# Livraison statique et état final — 2026-11-04T16:52:07.707Z

- **main** : `657921ea892130019e2eb17518d8bc36e6a2c60d` après squash de PR #79.
- **PR #79** : fusionnée ; Validate + UI quality/navigateur réel verts sur HEAD `85f6af3`. Cloudflare Pages production deployment `68191ea2-542a-44e7-bb32-3e9705c316e0` sur commit `657921e`, build et deploy success à 16:51:02Z. Changements de copie/SEO uniquement ; checkout toujours fermé.
- **Domaine public** : la lecture web après déploiement a encore exposé l'ancien texte Mollie ; cache du crawler possible, HTTP direct indépendant non disponible. Ne pas prétendre que la copie est visiblement à jour tant qu'une vérification sans cache n'est pas faite.
- **PR #77** : HEAD `502da4e`, Validate et UI quality/navigateur réel verts. Toujours draft ; aucun merge/déploiement Worker. API Key et Advanced/OAuth sont gérés distinctement par le code, mais profil BOT-WOW dédié toujours absent.
- **Mollie** : les 11 paiements live historiques BOT-WOW sont expirés et rattachés au seul profil visible, celui de `sargasses-martinique.com`. Ne jamais le réutiliser pour BOT-WOW. Revenu commercial confirmé : 0 EUR.
- **Conformité** : commentaire ajouté à PR #66 avec lien vers l'EULA officielle Blizzard (révision 21/03/2024) qui interdit les bots non autorisés ; pivot non-automatisant prioritaire.
- **Worker** : version 50 du 27/10, inchangée. Aucun secret modifié, paiement créé, e-mail envoyé, checkout ouvert ou déploiement Worker effectué.
- **Prochaine action** : profil Mollie BOT-WOW distinct + clé de test dédiée, puis test contrôlé paiement → webhook → licence → e-mail → téléchargement → activation après autorisation.


---

# État final de la mission revenue — 2026-11-04T18:20Z

## GitHub

| Élément | Valeur |
|---|---|
| `main` | `db1a35e366091d372ac34778f4a3c27e4bb7a291` (merge PR #78) |
| **PR #78** — revalidation live Cloudflare + D1 | **MERGED** 2026-11-04T17:19:41Z → `db1a35e3` |
| **PR #80** — correction du CA + §3bis (chemin de paiement réel) | **MERGED** 2026-11-04T17:19:38Z → `a3499d7` |
| **PR #79** — honnêteté de la copie sur 8 surfaces d'achat | **MERGED** 2026-11-04T16:50:27Z → `657921e` |
| **PR #77** — `profileId` selon le type d'identifiants | **DRAFT maintenu** — décision argumentée en commentaire |

CI sur le SHA exact de #80 : `validate` **success** (`41873795380`), `ui-quality` **success** (`41873795611`), GitGuardian **pass**.

> Les deux merges documentaires (#78, #80) n'ont déclenché que **« Validate Bot-Wow »** (`41876516746`, `41876526860`) — **zéro** déploiement Pages, conformément à `paths-ignore: reports/**`.

## Production — revérifiée en lecture seule

- **Worker `botwow-api`** : **inchangé** — tag `20f5821adfeb465cae177120c9015f8f`, version de code n° 49 (2026-10-27T07:46:00Z) **sans annotation `commit_sha`**. Ce tag n'est **ni un commit ni un blob** du dépôt (`git cat-file -t` → *not a valid object name*).
- **D1 `botwow-production`** (remote, via l'API Cloudflare — **13 tables**) : 25 commandes = 11 `mollie/failed` + 5 `bitcoin_manual/paid` (tests) + 8 `pending_payment` + 1 `rejected` ; **licences 5 · downloads 5 · activations 0 · deliveries 0** ; `webhook_events` 16 dont **5 sans commande** ; `botwow_emails` 12, toutes `@example.com`.
- **Statut Mollie réel** (extrait de `orders.metadata`) : les 11 paiements sont `status=expired`, `mode=live`, **`method=null`**, **`paidAt=null`** → **personne n'a finalisé un moyen de paiement**.
- **Pages** : `/buy` → marqueur `checkout-blocked` présent, bouton `disabled`, **20,00 €**, **aucune** mention « Mollie disponible / redirect » (PR #79 en ligne).

## Vérité revenue

**Chiffre d'affaires confirmé : 0,00 €.** 0 client payeur, 0 licence activée, 0 livraison, 0 email client. Les 5 commandes `paid` portent la même adresse BTC littéralement `bc1qadminbotwowpaymentaddressplaceholder123456…` et des txid de test (`test-txid-12345`, `test-real-txid-12345`, `e2e-test-txid-001`). Les 220 € de paiements Mollie ont **expiré sans être réglés**.

> **Note de méthode** : une lecture antérieure via `wrangler d1 execute` **sans `--remote`** avait retourné la base **locale** (miniflare). Toutes les valeurs ci-dessus proviennent de l'**API Cloudflare** (`POST /accounts/{id}/d1/database/{uuid}/query`) et sont reproductibles.

## Funnel (D1 `botwow-analytics`, remote)

| Événement | Total | Depuis le 2026-10-28 |
|---|---:|---:|
| `page_view` | 1 539 | 531 |
| `journey_view` | 587 | 286 |
| `cta_click` | 56 | 7 |
| `checkout_requested` | 31 | **3** |
| `checkout_start` | 4 | **0** |
| `checkout_created` | 6 | 0 |
| `checkout_failed` | 6 | 0 |
| `checkout_error` | **0** | 0 |
| `payment_confirmed` / `conversion` / `delivery_sent` / `activation` / `demo_open` / `offer_view` | **0** | 0 |

Les 3 intentions restantes (29/10, 02/11, **04/11 02:47Z**) s'arrêtent au clic : **aucun** `checkout_start`, **aucun** `checkout_error`. Avec 531 pages vues sur 8 jours et 0 checkout démarré, **le volume est le premier frein numérique** — avant tout diagnostic de paiement.

## Blocages (détail complet : `BOT-WOW-REVENUE-STATE-2026-11-04.md` §4)

| # | Blocage | Autorisation requise |
|---|---|---|
| **B1** | Le checkout n'a jamais encaissé — **personne n'a finalisé un paiement** (ce n'est pas une panne technique) | Oui (test de paiement réel) |
| **B2** | Aucune base commerciale : 0 client payeur ; 6 `pending_payment` portent une adresse personnelle | Non (business) |
| **B12** | **5 webhooks Mollie traités sans commande** (dont 2 sessions avec adresses personnelles) → paiement invisible | Oui (lecture seule API Mollie) |
| **B13** | ⚠️ **Le checkout encaisse dans l'organisation Mollie de Sargasses** (`pfl_t8KCk4Cm2C`, `org_19554425`) | Oui (profil + clé dédiés) |
| **B14** | Le code de production n'est rattachable à **aucun commit** | Oui (redéploiement versionné) |
| **B15** | Volume quasi nul | Non (business) |
| **B8** | Garantie d'activation incohérente (« 1 machine » vs `max_activations=2` vs « no seat limits ») | Oui (décision) |

## Côté Sargasses — R18 est fermé pour la mesure

La PR Sargasses **#1277** (`df01afd9`, MERGED 2026-11-04T18:01:55Z) **scope désormais le tracker MRR sur les enregistrements attribués à Sargasses** : un paiement BOT-WOW payé ne sera plus compté comme revenu Sargasses. Vérifié par exécution (20/20 cas + calcul end-to-end reproduisant 38,96 € / 17,98 $).

> Cela corrige **l'attribution de la mesure**, pas **la destination de l'argent** : le checkout BOT-WOW dépose toujours dans le compte Sargasses (B13). La séparation physique des comptes reste la seule solution structurelle.

## Garde-fous — rien de ce qui suit n'a été fait

Aucun prix, montant, remboursement, débit, email client, secret, binding, checkout rouvert, paiement créé ni déploiement Worker modifié. Le checkout **réel n'a pas été réactivé** : il reste bloqué côté interface (PR #54) et le Worker n'a reçu aucun déblocage.

## Prochaine action (une seule)

**Séparer et versionner le chemin de paiement** — profil Mollie BOT-WOW **dédié** + clé **dédiée**, puis redéploiement du Worker avec `commit_sha` — **autorisation explicite requise**. Sans cela, même une vente réussie produirait une mesure de revenu **non attribuable** et un rollback non reproductible.

Puis, dans le même lot autorisé : la **lecture seule des 5 paiements sans commande** (B12) et le **test de bout en bout** dans le profil dédié.


---

# Revalidation live P0.27 — 2026-11-04T18:35Z

## GitHub / CI

- `main` exact : `83553e39d8d12c06f75d3f5ffee8f97109d8eec8`.
- PR #82 merged at 18:28:17Z; its main-branch validation run `41887483474` is **success**. PR #82 validation and UI-quality runs `41886708472` / `41886708571` are both **success**.
- PR #71 is already merged; it is no longer an open PR to unblock.
- PR #77 remains **open / draft**, head `077de609f6746e780ff17912cacc22c6e62be834`. Both checks on that head are success (`41871913824`, `41871913926`), but comparison against current main is **7 commits ahead / 4 behind** and the PR is not mergeable. Do not merge or rebase it until the dedicated BOT-WOW Mollie profile/credential question is resolved.
- PR #66 remains draft (compliance/pivot); #67 and #81 remain open. Repository currently has 75 branches and 16 open PRs; most are historical branches and are not candidates for this P0.

## Cloudflare Pages

- Latest production deployment: `afa6e83a-de94-4d4e-a118-8c61f61bb11a`, created 18:28:19Z and deployed successfully at 18:28:42Z.
- Deployed commit: `83553e39d8d12c06f75d3f5ffee8f97109d8eec8`; production aliases include `bot-wow.com` and `www.bot-wow.com`.
- This deployment was triggered by the documentation-only merge of PR #82. Cloudflare Pages project settings currently show `path_includes=["*"]` and `path_excludes=[]`; GitHub Actions `paths-ignore` does not suppress the independent Cloudflare Pages Git integration. No Pages project setting was changed in this revalidation.

## Public purchase pages

- English `/buy` extraction now shows `Checkout temporarily unavailable`, a disabled purchase flow with delivery unconfirmed, and no Mollie payment/redirect promise.
- French `/fr/buy` extraction still returns the older Mollie badge and redirect instructions. However, current `main` source `fr/buy.html` contains `Paiement temporairement indisponible` and `Paiement suspendu`, with no Mollie badge or redirect claim; the build script recursively publishes the `fr/` directory, and `tests/release-availability.test.mjs` checks this source page.
- This is an unresolved live-extraction/source discrepancy, not proof that the current deployed French HTML is wrong: a direct uncached HTTP fetch was unavailable in this environment. No cache purge or speculative code edit was performed.

## Production Worker — critical divergence

- Active Worker: `botwow-api`, version **50**, version ID `c3dcc842-c422-42d3-9828-405f30d70b5f`, created `2026-10-27T07:46:28Z`; active deployment ID `36227a4d-00e7-4c9f-94e0-0913b29049bc`.
- Version 50 has no `workers/commit_sha` annotation. Its active bundle does not contain the current-main guard markers `RELEASE_STATUS`, `delivery_unverified`, or `sales_suspended`; the current `main:worker/index.js` does contain the fail-closed checkout guard (409 unless release status is `confirmed`, lines 485–498).
- The deployed version metadata lists secret binding names `RELEASE_STATUS` and `MOLLIE_PROFILE_ID`, but a binding name does not prove the deployed code reads it or that its value is valid.
- Therefore the public form is blocked, but the server-side checkout guard present on main is **not proven deployed**. A direct POST might bypass the UI gate; it was deliberately **not tested** because payment/checkout POSTs are prohibited without explicit authorization.
- No Worker deployment, secret/binding change, payment creation, webhook POST, or checkout change was made.

## Mollie account separation

- Read-only `ListProfiles` returned exactly one visible verified profile: `pfl_t8KCk4Cm2C`, website `https://sargasses-martinique.com/`. No BOT-WOW profile is visible.
- Production D1 confirms all 11 Mollie orders reference that same profile ID. All 11 have `status=expired`, `mode=live`, `method=null`, and `paidAt=null`.
- Never reuse this Sargasses profile for BOT-WOW. No payment search by profile, payment creation, profile creation, or credential change was performed.

## D1 production — read-only recheck

- Orders by provider/status: Bitcoin manual `paid=5`, `pending_payment=8`, `rejected=1`; Mollie `failed=11`.
- The five Bitcoin-manual paid rows all use `@example.com` addresses; four have placeholder BTC addresses and three have test TXIDs. They are not accepted as commercial revenue.
- Current table counts: orders 25; licenses 5; downloads 5; activations 0; deliveries 0; webhook_events 16; botwow_emails 12.
- Confirmed commercial revenue remains **0.00 EUR**. All D1 queries were read-only (`changed_db=false`, `rows_written=0`).

## Funnel — corrected test split

Current production analytics counts, explicitly filtered to `test=0`:

| Event | Total |
|---|---:|
| `page_view` | 1,560 |
| `journey_view` | 601 |
| `cta_click` | 48 |
| `checkout_requested` | 29 |
| `checkout_start` | 4 |
| `checkout_created` | 6 |
| `checkout_failed` | 6 |
| `checkout_error` | 0 |
| `payment_confirmed` / `conversion` / `delivery_sent` / `activation` | 0 |

Since 2026-10-28T00:00:00Z: 555 page views, 300 journey views, 7 CTA clicks, 3 checkout requests, and **0 checkout starts**.

The test-only rows currently include 8 `cta_click` and 2 `checkout_requested` events. The prior report's totals of 56 and 31 for those two events equal test=0 + test=1; the corrected commercial funnel is **48 / 29**. Do not mix test traffic into sales conversion metrics. These are event counts, not unique visitors or sessions.

## Decision / next action

1. Obtain explicit authorization to create a **dedicated BOT-WOW Mollie profile and credential**; do not use the Sargasses profile.
2. Obtain explicit authorization for a versioned production Worker deployment from current main, after a non-production validation and with rollback to version 50 documented. The release must include the fail-closed `RELEASE_STATUS` guard and a `workers/commit_sha` annotation.
3. Only after those prerequisites, run an explicitly authorized test-mode end-to-end validation: checkout → Mollie webhook → paid order → licence → email → download → activation. No live payment is part of this revalidation.
4. Keep commercial acquisition for the automated bot paused until the Blizzard compliance decision is resolved; prioritize a non-automating route-planner pivot before making claims or promoting use on official Blizzard services.

## Inertie

No price changes, checkout reopening, payment rules changed, real payments, customer emails, secret/binding changes, D1/R2 writes, Worker/Pages configuration changes, or production Worker deployment.


---

# Correction P0.28 — deployed Worker bundle and revenue recheck — 2026-11-04T19:17Z

This addendum supersedes the incorrect P0.27 statement that the active Worker bundle lacked the server-side checkout guard. The actual deployed script content was fetched directly from Cloudflare; this is stronger evidence than inferring code from the version date.

## Worker — exact deployed-code comparison

Cloudflare read-only API confirms:

- Active deployment: `36227a4d-00e7-4c9f-94e0-0913b29049bc`.
- Active version: **50**, ID `c3dcc842-c422-42d3-9828-405f30d70b5f`, created `2026-10-27T07:46:28Z`.
- Version 50 has no `workers/commit_sha` annotation.
- Binding names include `RELEASE_STATUS` and `MOLLIE_PROFILE_ID`; secret values remain masked.

Direct `GET /workers/scripts/botwow-api/content/v2` inspection of the active bundle found:

- **Present:** `RELEASE_STATUS`, `delivery_unverified`, and the guard that rejects checkout unless the effective release status is exactly `confirmed`. The compiled default is `pending`.
- **Absent:** `resumeFulfillment`, which is present in current `main:worker/index.js`.
- **Still present:** legacy download fallback `Casinobabe-v1.0.38.zip`, removed from current `main:worker/index.js`.
- The active bundle contains delivery-queue writes, but that alone does not prove the newer replay/idempotency flow from PR #71 is deployed.

**Correction:** the server-side checkout guard code is present in production version 50. The previous claim that the guard markers were absent is withdrawn. However, the actual secret value controlling the gate is not readable, so the effective runtime setting is not independently verified. No checkout POST was sent. The deployed Worker is still behind current main for the newer fulfillment replay and legacy-download-fallback corrections; its code is also not tied to a Git commit SHA.

No Worker deployment, secret change, payment, webhook POST, email, or checkout mutation was performed.

## D1 production — corrected joins and current counts

All statements below are from read-only Cloudflare D1 API queries; every query reported `changed_db=false` and `rows_written=0`.

| Table / state | Current count |
|---|---:|
| orders | 25 |
| licenses | 5 |
| downloads (tokens recorded, not proof of completed downloads) | 5 |
| activations | 0 |
| deliveries | 0 |
| webhook_events | 16 |
| botwow_emails | 12 |

Order states remain:

- `bitcoin_manual/paid`: 5; all five use `@example.com` addresses, and four contain placeholder metadata. These are not accepted as commercial sales.
- `bitcoin_manual/pending_payment`: 8.
- `bitcoin_manual/rejected`: 1.
- `mollie/failed`: 11; all 11 have provider status `expired`, amount EUR 20, profile `pfl_t8KCk4Cm2C`, `method=null`, and `paidAt=null`.

**Webhook join correction:** `webhook_events.id` is stored as `payment:<paymentId>`, not as the raw Mollie payment ID. The correct read-only join is `webhook_events.id = 'payment:' || orders.provider_id`. It yields **11 matched and 5 unmatched** webhook events. The earlier raw-ID join that yielded 16 unmatched rows was incorrect; the five unmatched events remain unresolved.

Email-table correction: 11 of 12 `botwow_emails` rows use `@example.com`; the remaining row's commercial relevance is unknown. It is not treated as evidence of a customer. No paid order has a non-`example.com` address.

Application/D1-confirmed commercial revenue remains **€0.00**. Mollie's independent payment ledger was not queried: the connected Mollie action requires explicit confirmation of a profile ID before profile-scoped payment searches. No profile was assumed or confirmed.

## Analytics — latest read-only snapshot

The analytics database contains 2,291 total events (2,260 with `test=0`); latest observed event timestamp: `2026-11-04T18:46:32Z`.

Production event counts (`test=0)):

| Event | Count |
|---|---:|
| `page_view` | 1,564 |
| `journey_view` | 602 |
| `cta_click` | 48 |
| `checkout_requested` | 29 |
| `checkout_start` | 4 |
| `checkout_created` | 6 |
| `checkout_failed` | 6 |
| `planner_mode` | 1 |
| `payment_confirmed`, `conversion`, `delivery_sent`, `activation` | 0 |

These are event counts, not unique people or sessions. There is no verified paid conversion.

## Public site and compliance

- Current public English `/buy` page says checkout is temporarily unavailable, the purchase form is disabled, delivery is unconfirmed, and users should not pay until delivery is confirmed.
- The web reader could not retrieve `/fr/buy` in this pass; French live state is therefore **not reverified**.
- The live English page still describes an automated WoW fishing bot. Blizzard's EULA, last revised 21 March 2024, defines unauthorized bots as software enabling automated control of a Game/character and prohibits creating, using, offering, promoting, advertising, making available, or distributing them. No Blizzard authorization has been identified. Do not market the automation to official Blizzard-service players while this remains unresolved. This is a platform-terms risk assessment, not legal advice. Official source: https://www.blizzard.com/en-us/legal/08b946df-660a-40e4-a072-1fbde65173b1/blizzard-end-user-license-agreement

## GitHub / CI

- `main`: `83553e39d8d12c06f75d3f5ffee8f97109d8eec8`.
- PR #71 is merged; PR #82 is merged.
- PR #83 remains open. Its Validate and UI-quality workflows passed on the original head; this addendum is a new documentation commit and must receive fresh CI.
- PR #77 remains open/draft and non-mergeable; its two reported checks passed on head `077de609f6746e780ff17912cacc22c6e62be834`. Do not merge a stale/conflicting branch.
- PR #66 remains open/draft for compliance and pivot review.

## Next actions, ranked

1. **P0 — compliance decision / product scope:** keep acquisition paused for the automated client-control product on official Blizzard services. Review the non-automating alternative in PR #66, but do not assume that a WoW-specific planner is automatically compliant; it must not control the client or make unsupported compliance claims, and its intended use needs review.
2. **P0 — payment separation:** obtain a dedicated BOT-WOW Mollie profile and credential. The only profile currently visible is the Sargasses profile; never reuse it. No Mollie payment search or profile-scoped ledger reconciliation was performed.
3. **P0 — fulfillment release:** prepare a versioned Worker package from current main that includes `resumeFulfillment` and removes the legacy fallback; include `workers/commit_sha`, a tested non-production plan, and rollback to version 50. Production deployment remains prohibited until explicit authorization under `AGENTS.md`.
4. Keep the public checkout closed until the compliance decision, dedicated payment routing, and end-to-end fulfillment proof are complete.

No prices, checkout rules, secrets, bindings, D1/R2 data, payments, emails, Worker deployments, Pages settings, or production content were changed in this revalidation.
