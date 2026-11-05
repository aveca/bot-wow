# BOT-WOW — État courant Factory V3

**Dernière mise à jour de ce document : 2026-11-04T23:48Z** (revalidation P0.32 — GitHub, Pages, Mollie, D1, Analytics et alias www) (PR #78 et #80 fusionnées — CA BOT-WOW corrigé à 0,00 €, chemin de paiement réel mesuré, R18 fermé côté Sargasses)

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

---

# Revalidation P0.29 — live funnel + purchase-copy contradiction — 2026-11-04T20:36Z

## GitHub / CI
- `main` remains `83553e39d8d12c06f75d3f5ffee8f97109d8eec8`.
- Repository census after this cycle's branch/PR creation: 77 branches and 18 open PRs. PR #71 is merged; #83 and #84 are open; #77 and #66 remain drafts; #67 remains open. Historical PRs were not reopened.
- Before this addendum, PR #83 head `7b349b23ac68aa5d658fa546a85884b267886414` had Validate and UI-quality workflows SUCCESS. Updating this document triggers fresh checks; their new results are pending.
- No merge to `main` was performed.

## Production Pages / public purchase page
- Latest production Pages deployment remains `afa6e83a-de94-4d4e-a118-8c61f61bb11a`, commit `83553e39d8d12c06f75d3f5ffee8f97109d8eec8`, deploy stage SUCCESS at `2026-11-04T18:28:42Z`; aliases include `bot-wow.com` and `www.bot-wow.com`.
- The latest PR #83 preview deployment is skipped because preview deployments are disabled; it is not production.
- Direct public extraction of `https://bot-wow.com/buy` shows the checkout is disabled and delivery is explicitly unconfirmed. It also exposes a contradictory sentence: **“Everything below is delivered and working now.”** and the heading “What ships today, exactly”, despite the same page saying the v1.2.0 package is not verified and telling visitors not to purchase.
- Direct public retrieval of `/fr/buy.html` redirects to `/fr/buy` and confirms the same contradiction: “Ce qui est livré aujourd'hui, exactement” / “Tout ce qui suit est livré et fonctionne maintenant”, followed by a notice that the v1.2.0 archive is unverified. The live EN and FR homepages also repeat “ships today” / “livre aujourd'hui” claims and describe the package as delivered while their top release notices say the product scope is intended, not a confirmed download.
- PR #84 (`fix/buy-copy-scope-disclosure-20261104`) corrects the EN/FR purchase pages and homepages and adds regression assertions. Initial purchase-page-only head `3de440aced62f23b00586bece5665cfe4d574762` passed Validate and UI-quality/Playwright (runs `41908880388`, `41908880589`). Expanded head `baba6d95087643e0e2257e0575e20f48ce821229` correctly failed the new regression test because one repeated French offer bullet still claimed a delivered package; that remaining duplicate was fixed in head `070da205053d0ba0c3b76c797c90ab22246fbdcc`. Corrected head CI is now green: Validate run `41909760819` SUCCESS and UI-quality/real-browser run `41909760921` SUCCESS. PR #84 remains open, not merged or deployed. No production copy was changed.

## Cloudflare D1 — fresh read-only queries
All queries were SELECT only; Cloudflare reported `changed_db=false` and `rows_written=0`.
- `orders`: 25 total — Bitcoin manual `paid=5`, `pending_payment=8`, `rejected=1`; Mollie `failed=11`.
- `licenses=5`; `downloads=5` (download tokens recorded, not proof that files were downloaded); `activations=0`; `deliveries=0`; `webhook_events=16`; `botwow_emails=12`.
- Correct webhook join `webhook_events.id = 'payment:' || orders.provider_id`: 11 matched, 5 unmatched.
- Nested Mollie metadata: 11/11 have provider status `expired`, mode `live`, no payment method, no `paidAt`, and one distinct profile ID.
- Read-only Mollie `ListProfiles` still returns exactly one verified profile, `pfl_t8KCk4Cm2C`, associated with `sargasses-martinique.com`; no dedicated BOT-WOW profile is visible. It must not be reused for BOT-WOW.
- Application/D1-confirmed commercial revenue remains **€0.00**. The independent Mollie payment ledger was not queried; no payment was inferred from D1 alone.

## Analytics — latest production event census
Fresh read-only query of `botwow-analytics.events`, split by `test`:
- `page_view`: 1,566 production; 15 test.
- `journey_view`: 604 production; 6 test.
- `cta_click`: 48 production; 8 test.
- `checkout_requested`: 29 production; 2 test.
- `checkout_start=4`, `checkout_created=6`, `checkout_failed=6`, `planner_mode=1` (all production).
- `payment_confirmed`, `conversion`, `delivery_sent`, and `activation` remain absent from the grouped event result.
These are event counts, not unique visitors or sessions. Do not mix test events into commercial metrics.

## Worker / payments
- Active Worker deployment remains `36227a4d-00e7-4c9f-94e0-0913b29049bc`, version 50, created `2026-10-27T07:46:28Z`, with no `workers/commit_sha` annotation.
- The P0.28 addendum above remains the source of the direct deployed-bundle comparison: production version 50 has the release guard but is behind current `main` for `resumeFulfillment` and the legacy download fallback. Current `main:worker/index.js` includes the newer replay path. No Worker deployment or POST test was performed.
- No checkout was reopened, no payment was created, no credential or binding was changed, and no customer email was sent.

## Decision
1. Correct the contradictory purchase-page copy and add a regression test (safe, reversible, code-only PR).
2. Keep the checkout blocked until a dedicated BOT-WOW Mollie profile/credential and a verified fulfillment artifact exist.
3. Keep acquisition for the automated bot paused until the Blizzard compliance decision / non-automating product pivot is resolved.


## PR #66 — safety review and pivot opportunity — 2026-11-04T20:48Z

- PR #66 remains a 63-file draft and is **not safe to merge as-is**. Its purchase-page patch changes the v1.2.0 hero to “current release, download package verified” and promises email delivery after payment, while live EN/FR pages and production D1 still show release delivery unverified, 11 Mollie orders expired, and zero deliveries.
- Its stated Worker gate uses `RELEASE_STATUS=open` to allow checkout. This must not be enabled before a verified artifact, dedicated BOT-WOW Mollie profile/credential, and end-to-end fulfillment proof exist.
- Added a blocking review comment to PR #66 (comment ID `6641733281`) documenting these production contradictions and asking that the PR remain draft.
- The pivot proposal `reports/compliance/PIVOT_NON_AUTOMATISANT.md` is a useful starting point: manual fishing-route planner, personal spot notebook, and offline yield simulator; no game-client reads, clicks, addon, process access, or bot binary. It is still a proposal, not an implemented or legally certified product. The next safe product-development step is a separate, non-deployed prototype of the manual planner, followed by a small demand test; do not market it as Blizzard-approved without legal review.


---

# P0.29 — vérification live et QA de la correction commerciale — 2026-11-04T21:12Z

## GitHub — état vérifié

- `main` : `83553e39d8d12c06f75d3f5ffee8f97109d8eec8` (inchangé pendant ce cycle).
- 77 branches retournées par la recherche de branches (aucune page supplémentaire).
- 18 PR ouvertes.
- PR #83 reste ouverte, documentation opérationnelle.
- PR #84 reste ouverte, non fusionnée : correction de cinq fichiers de copie EN/FR et tests.
- PR #66 et #77 restent en draft ; aucune modification de leurs règles de vente ou de paiement.

PR #84 :
- Premier HEAD validé : `070da205053d0ba0c3b76c797c90ab22246fbdcc`.
- Validate Bot-Wow : SUCCESS, run `41909760819`.
- UI quality / Playwright / build / screenshots : SUCCESS, run `41909760921`.
- Revue Codex automatique non terminée, la limite d'utilisation du service de revue a été atteinte ; ce n'est pas un résultat de test applicatif.
- Revue manuelle de la nouvelle assertion de test : deux motifs regex de la page d'accueil étaient sur-échappés et le contrôle de périmètre prévu était trop permissif. Corrections poussées sur la même branche :
  - `1c0074c739ebdae293e5aa7e24aad6ce13d7fbfb` : corrige les échappements des assertions.
  - `b05c7a9a40b0ef0f6269e824025101e66dffcf02` : exige explicitement le texte de périmètre prévu.
- Run UI quality du HEAD `b05c7a9` : `41913862099`, PENDING au dernier contrôle. Aucun résultat vert n'est encore revendiqué pour ce dernier HEAD.
- La PR est mergeable au dernier contrôle, mais reste non fusionnée.

## Site public — défaut commercial toujours live

Vérification web du 2026-11-04 :
- Accueil EN : l'avertissement indique que le paquet v1.2.0 n'est pas vérifié, mais le texte continue d'affirmer que la pêche « ships today ».
- Achat EN : l'avis demande de ne pas acheter avant confirmation de livraison, mais le bloc « What ships today » affirme encore que tout est livré et fonctionne.
- Prix affiché : 20,00 €.
- Checkout : indisponible, formulaire/bouton désactivé, aucun paiement lancé.
- La page FR /fr/buy n'a pas pu être lue par l'outil web pendant ce cycle ; son état live n'est pas confirmé.

La PR #84 corrige précisément ces contradictions sur les quatre pages EN/FR. Aucun déploiement ni changement de production n'a eu lieu.

Configuration Cloudflare Pages relue en lecture seule :
- Projet `bot-wow`, branche de production `main`.
- Déploiements de production activés ; previews désactivées (`preview_deployment_setting=none`).
- Dernier déploiement production : `afa6e83a-de94-4d4e-a118-8c61f61bb11a`, commit `83553e39d8d12c06f75d3f5ffee8f97109d8eec8`, statut `success`, terminé le 2026-11-04T18:28:42Z.
- Une fusion de PR #84 sur `main` déclenchera donc le déploiement de production Pages. Le rollback applicatif est possible par revert du commit de merge, suivi d'une nouvelle vérification live.

## D1 production — lecture seule du 2026-11-04

Les requêtes ont été exécutées via l'API Cloudflare D1 sur `botwow-production`. Toutes ont retourné `changed_db=false` et `rows_written=0`.

- Commandes : 25 au total.
  - Bitcoin manuel : 5 `paid` (les 5 adresses sont `@example.com`), 8 `pending_payment`, 1 `rejected`.
  - Mollie : 11 `failed`.
- Licences : 5.
- Jetons de téléchargement : 5 (cela ne prouve pas un téléchargement).
- Activations : 0.
- Livraisons : 0.
- Webhooks : 16 ; jointure correcte `webhook_events.id = 'payment:' || orders.provider_id` : 11 associés, 5 sans commande.
- Aucun paiement commercial réel n'est démontré par ces données. CA commercial confirmé dans D1 : **0,00 €**.

## Analytics production — événements, pas visiteurs uniques

D1 `botwow-analytics`, `test=0`, au dernier relevé :
- `page_view` : 1 593
- `journey_view` : 621
- `cta_click` : 48
- `checkout_requested` : 29
- `checkout_start` : 4
- `checkout_created` : 6
- `checkout_failed` : 6
- `planner_mode` : 1
- Aucun événement `payment_confirmed`, `conversion`, `delivery_sent` ou `activation` dans les résultats agrégés.

Ce sont des événements bruts filtrés sur `test=0`, pas des sessions ou utilisateurs uniques.

## Mollie — profil

La lecture seule `ListProfiles` retourne un seul profil vérifié :
- `pfl_t8KCk4Cm2C`
- Site associé : `https://sargasses-martinique.com/`

Aucun profil BOT-WOW dédié n'est visible. Ne pas réutiliser ce profil. Aucun registre de paiements Mollie n'a été interrogé et aucun paiement n'a été créé.

## Worker

L'API Cloudflare confirme que le dernier déploiement listé de `botwow-api` est :
- Deployment : `36227a4d-00e7-4c9f-94e0-0913b29049bc`
- Version : `c3dcc842-c422-42d3-9828-405f30d70b5f`
- Créé le 2026-10-27T07:46:28Z.

L'endpoint de contenu du Worker n'a pas fourni de bundle lisible via le connecteur Cloudflare durant ce cycle. Les marqueurs de code détaillés consignés dans la section P0.28 de cette PR restent des preuves antérieures ; ils ne sont pas revendiqués comme revérifiés aujourd'hui. Aucun déploiement Worker n'a eu lieu.

## Conformité — précision importante sur le pivot

La page officielle actuelle de l'EULA Blizzard, section 1.C.2, interdit notamment les bots non autorisés et les logiciels utilisables avec la plateforme qui changent ou facilitent le gameplay. Source : https://www.blizzard.com/en-us/legal/bfbbb648-bcc6-4b78-a5c7-e2fe20c135df/blizzard-end-user-license-agreement

Conséquence : un planificateur explicitement conçu pour optimiser des rondes WoW ne peut pas être présenté comme « conforme » ou « sûr » simplement parce qu'il ne clique pas. Le pivot manuel WoW reste juridiquement non confirmé. Toute nouvelle offre doit être évaluée au regard de cette clause avant d'être commercialisée ; ne pas revendiquer une approbation Blizzard.

## Décisions et prochaine action

1. Terminer les contrôles CI sur le HEAD `b05c7a9` de PR #84. Si tous passent, intégrer la correction de copie par le processus autorisé et vérifier le site live.
2. Garder le checkout fermé tant que le profil de paiement BOT-WOW, la livraison, le webhook, l'email et l'activation ne sont pas prouvés.
3. Ne pas lancer le prototype de planificateur WoW comme pivot prétendument conforme ; d'abord cadrer un produit réellement indépendant du gameplay Blizzard ou obtenir une validation écrite.
4. Ne pas compter les cinq commandes Bitcoin de test comme ventes.


---

# P0.29 — intégration de PR #84 et vérification du déploiement — 2026-11-04T21:17Z

## PR #84 intégrée

- PR #84 fusionnée par squash après validation complète du HEAD `b05c7a9a40b0ef0f6269e824025101e66dffcf02`.
- Commit de merge / nouveau `main` : `9986fb635659981ba64945af71297a30b41d4e0e`.
- PR : https://github.com/aveca/bot-wow/pull/84
- Checks du HEAD avant merge :
  - Validate Bot-Wow : SUCCESS, run `41913862013`.
  - UI quality / Playwright / captures : SUCCESS, run `41913862099`.
  - GitGuardian Security Checks : SUCCESS.
- Portée : cinq fichiers de copie et tests, aucune modification des prix, du checkout ou des paiements.

## Déploiement Cloudflare Pages

- Projet `bot-wow`, branche `main`.
- Déploiement : `d0c68582-ac24-448b-9f94-0e3ee2f0fc0c`.
- Commit : `9986fb635659981ba64945af71297a30b41d4e0e`.
- URL de déploiement : https://d0c68582.bot-wow.pages.dev
- Dernière étape `deploy` : SUCCESS, terminée le 2026-11-04T21:17:11Z.
- Workflow GitHub Pages `41914592024` était encore `in_progress` au dernier contrôle ; `Validate Bot-Wow` sur le commit de merge `41914591679` : SUCCESS.

## Vérification live — limite constatée

Après le succès Cloudflare Pages, le lecteur web a encore renvoyé sur `bot-wow.com` les anciens textes « What ships today, exactly » / « Everything below is delivered and working now », ainsi que l'ancien texte français de livraison. Les URLs uniques `pages.dev` et les requêtes cache-buster n'ont pas pu être ouvertes par le lecteur web. Aucun en-tête `CF-Cache-Status`, `Age` ou ETag n'a été obtenu.

Il est donc **confirmé que le déploiement Pages du commit 9986fb est SUCCESS**, mais il n'est **pas confirmé que les quatre domaines/surfaces publiques servent déjà le nouvel HTML**. L'extraction web peut être périmée ; ne pas purger le cache ni prétendre à une vérification live réussie sans une requête HTTP directe non cachée.

Contrôle supplémentaire du contenu source sur `main` après le merge, via l'API GitHub :
- `index.html`, `fr/index.html`, `buy.html`, `fr/buy.html` : anciennes affirmations de livraison absentes sur les quatre fichiers.
- Anciennes affirmations Mollie actives absentes sur les quatre fichiers.
- `buyBtn` désactivé sur les quatre fichiers.
- Déclaration explicite du périmètre prévu présente sur les quatre fichiers.

Le code publié sur `main` est donc cohérent ; seule la réponse HTTP live du domaine personnalisé reste à confirmer indépendamment de l'extraction web.

## Conséquences commerciales inchangées

- Prix public : 20 €.
- Checkout public toujours désactivé ; aucune transaction créée.
- D1 production : 25 commandes, dont 5 commandes Bitcoin de test `paid` sur `@example.com`, 8 pending, 1 rejected, 11 Mollie failed ; 5 licences, 5 jetons, 0 activation, 0 livraison ; 16 webhooks dont 5 sans commande.
- D1 commercialement confirmé : 0,00 €.
- Profil Mollie visible : un seul profil vérifié lié à `sargasses-martinique.com`, aucun profil BOT-WOW dédié visible.
- Worker `botwow-api` : dernier déploiement listé le 27/10 ; aucune mise à jour Worker réalisée.

## Décision suivante

1. Obtenir une vraie vérification HTTP no-cache du HTML sur `bot-wow.com` et `www.bot-wow.com` après le déploiement, sans purge non autorisée.
2. Garder le checkout fermé jusqu'à séparation du profil Mollie et preuve complète paiement → webhook → livraison → activation.
3. Ne pas commercialiser un planificateur WoW manuel comme conforme : la clause EULA sur les logiciels qui facilitent le gameplay reste un risque non résolu.


---

# P0.30 — réconciliation externe des 16 paiements Mollie et mesures fraîches — 2026-11-04T22:23Z

## GitHub et branches

- `main` confirmé : `9986fb635659981ba64945af71297a30b41d4e0e`, commit de merge PR #84 du 2026-11-04T21:16:47Z.
- PR #84 : MERGED.
- PR #83 : OPEN, branche `docs/p0.27-live-revalidation-20261104-1835z`, HEAD `2fc2024aaf07ef940386ca0320bd39e3f0e35f1e`, base SHA observé `83553e39d8d12c06f75d3f5ffee8f97109d8eec8`, mergeable. Les trois checks de ce HEAD sont SUCCESS : Validate, UI quality/Playwright et GitGuardian.
- Inventaire GitHub : 77 branches retournées après pagination terminée ; 17 PR ouvertes au relevé. Les branches historiques ne sont pas toutes des branches de travail actives.
- Checks du commit main `9986fb` : Validate SUCCESS ; GitHub Pages deploy SUCCESS (run `41914592024`) ; Cloudflare Pages SUCCESS (deployment `d0c68582-ac24-448b-9f94-0e3ee2f0fc0c`).

## Sources commerciales sur main

Lecture GitHub directe des quatre sources :
- `buy.html` blob `f47707aa76324303bcb31d99c185fd6ef34f561f`
- `index.html` blob `f6647635e69aaac1696523b30a624ccf6b3f39b6`
- `fr/buy.html` blob `4a7a33d01bfe0a38d067ab37ab643a5a510de290`
- `fr/index.html` blob `33e92838d10444a436328d1b2acb1b39e5be65d6`

Sur les quatre sources, les anciennes formulations « Everything below is delivered and working now », « What ships today, exactly », « ships today » et « livre aujourd'hui » sont absentes. Les marqueurs `checkout-blocked` et le bouton désactivé sont présents. Les formulations de livraison non confirmée sont présentes.

## Cloudflare Pages — production et preview

Lecture API Cloudflare :
- Projet `bot-wow`, branche de production `main`.
- Domaines `bot-wow.com` et `www.bot-wow.com` : statut `active`.
- Dernier déploiement PRODUCTION : `d0c68582-ac24-448b-9f94-0e3ee2f0fc0c`, commit `9986fb`, stage `deploy=success`, terminé à `2026-11-04T21:17:11.902Z`.
- La tentative de preview liée à la branche PR #83 (`df70095e`) est explicitement ignorée avec `preview_deployments_disabled` ; ce n'est pas un déploiement de production.
- Le lecteur web a encore extrait l'ancien bloc « What ships today, exactly » sur `/buy`, alors que la source main et le déploiement Pages sont à jour. Les URLs avec cache-buster et le sous-domaine pages.dev n'ont pas pu être lus par cet outil. Aucun en-tête HTTP `CF-Cache-Status`, `Age` ou ETag n'a été obtenu. **La réponse HTTP d'origine reste donc non vérifiée** : ne pas conclure à un cache ou à une régression de déploiement, et ne pas purger le cache sans autorisation.

## D1 production — relevé en lecture seule

Requêtes via l'API Cloudflare D1, base `botwow-production`. Chaque requête a retourné `changed_db=false` et `rows_written=0`.

Commandes :
- `bitcoin_manual/paid` : 5 (100 € nominaux, données de test `@example.com`).
- `bitcoin_manual/pending_payment` : 8 (160 € nominaux).
- `bitcoin_manual/rejected` : 1 (20 € nominaux).
- `mollie/failed` : 11 (220 € nominaux).
- Total : 25 commandes ; les montants nominaux ne sont pas du revenu.

Comptages :
- licences 5 ; jetons `downloads` 5 ; livraisons `deliveries` 0 ; activations 0 ; webhooks 16 ; `botwow_emails` 12.
- Les 5 licences et les 5 jetons correspondent aux commandes Bitcoin de test déjà identifiées ; un jeton n'est pas une preuve de téléchargement.
- Webhooks non associés à une commande avec la jointure `webhook_events.id = 'payment:' || orders.provider_id` : 5.
- Agrégation des domaines d'e-mail : 11 `example.com`, 1 autre domaine. Cette dernière ligne n'est pas une preuve de client ou de paiement ; aucune adresse n'est reproduite.

## Mollie — vérification externe des 16 IDs connus

`ListProfiles` retourne toujours un seul profil vérifié : `pfl_t8KCk4Cm2C`, site `sargasses-martinique.com`. Aucun profil BOT-WOW dédié n'est visible.

Nouveauté P0.30 : les 11 `provider_id` Mollie présents dans `orders` ET les 5 IDs de webhook sans commande ont été interrogés individuellement via `GetPayment` en lecture seule, sans rechercher le registre global du profil Sargasses.

Résultat sur les 16 objets Mollie référencés par BOT-WOW :
- 16/16 `status=expired`.
- 16/16 montant `20.00`.
- 16/16 `method=null` et `paidAt=null`.
- 16/16 rattachés au profil `pfl_t8KCk4Cm2C`.
- Aucun de ces 16 paiements n'est payé ; les cinq webhooks orphelins ne cachent donc pas de paiement payé parmi les IDs vérifiés.

La recherche globale des paiements du profil Sargasses n'a volontairement pas été effectuée : ce profil n'appartient pas à BOT-WOW et ne doit pas être utilisé pour attribuer des ventes BOT-WOW. La vérification couvre exactement les 16 IDs retrouvés dans D1, pas tout le compte Mollie.

**Revenu commercial confirmé parmi les commandes et paiements BOT-WOW vérifiés : 0,00 €.**

## Analytics production — relevé frais

Base `botwow-analytics`, filtre `test='0'`, comptages d'événements (pas d'utilisateurs ni de sessions uniques) :
- `page_view` 1 609
- `journey_view` 629
- `cta_click` 48
- `checkout_requested` 29
- `checkout_start` 4
- `checkout_created` 6
- `checkout_failed` 6
- `planner_mode` 1
- aucun événement observé `payment_confirmed`, `conversion`, `delivery_sent` ou `activation`.
- Dernier événement `test=0` : `2026-11-04T21:22:34Z` (page view). Aucun nouvel événement de paiement n'apparaît dans l'agrégation.

Toutes les requêtes D1 ci-dessus sont en lecture seule, `changed_db=false`, `rows_written=0`.

## Worker — état versionné

L'API Cloudflare confirme toujours le Worker `botwow-api` version 50 :
- version `c3dcc842-c422-42d3-9828-405f30d70b5f`
- déploiement `36227a4d-00e7-4c9f-94e0-0913b29049bc`
- créé le `2026-10-27T07:46:28.277Z`
- aucune annotation `workers/commit_sha` sur ce déploiement.
- les noms de bindings `MOLLIE_API_KEY`, `MOLLIE_PROFILE_ID`, `MOLLIE_WEBHOOK_SECRET`, `RELEASE_STATUS` et `RESEND_API_KEY` sont visibles ; leurs valeurs ne le sont pas et ne sont pas vérifiées.

Le fichier `worker/index.js` sur main a le blob SHA `725d98e4595b27aa60e88758ecac20c711a38b6b` et contient notamment `resumeFulfillment`, `RELEASE_STATUS` et `delivery_unverified`. Le connecteur Cloudflare a fourni les métadonnées de la version active mais pas son bundle source lisible ; **aucune comparaison binaire du code actif avec main n'est revendiquée**. Le Worker n'a pas été déployé.

## Décision et prochaine action

1. Ne pas rouvrir le checkout : livraison non certifiée et profil de paiement BOT-WOW absent.
2. Obtenir un profil Mollie BOT-WOW dédié et des credentials dédiés via l'opérateur du compte ; ne jamais utiliser le profil Sargasses.
3. Après confirmation du profil dédié et autorisation explicite, préparer un test contrôlé (paiement test, webhook, licence, e-mail de test, téléchargement, activation) puis déployer le Worker avec rollback.
4. Faire une vraie requête HTTP no-cache sur les quatre pages EN/FR depuis un environnement réseau navigateur/terminal pour trancher la discordance d'extraction ; aucune purge à ce stade.
5. Garder la commercialisation du bot automatisant le gameplay suspendue tant que le risque contractuel Blizzard n'est pas résolu.

Aucun prix, checkout, secret, binding, paiement, e-mail client, D1, R2, Worker ou production n'a été modifié pendant P0.30.


---

# P0.31 — intégrité du paquet v1.2.0 dans R2 — 2026-11-04T22:34Z

## Objet de release BOT-WOW

Lecture seule de l'objet configuré par le Worker BOT-WOW :
- Bucket : `botwow-binaries`
- Clé : `casinobabe-fishing-1.2.0.zip` (nom historique de l'archive BOT-WOW ; ne pas confondre avec un autre projet).
- Dernière modification R2 : `2026-10-27T06:31:06.784Z`.
- Taille : `1 387 543` octets.
- ETag R2 : `d9d7ab22ec076873b8fed656a53460bc` (métadonnée uniquement, pas utilisé comme SHA-256).

## Vérification cryptographique effectuée sur les octets réellement lus depuis R2

Le corps binaire a été lu directement par l'API R2 en mémoire, sans téléchargement client ni écriture. Le SHA-256 a été calculé sur les octets retournés :

`1c132f367607ea186feffde8bbda0a1a9f94cdec4b7850b93c57c271270bba4f`

Cette empreinte correspond exactement à la référence documentée dans `reports/operations/2026-10-28-p0.7-r2-sha256-verification.md`.

Structure ZIP :
- EOCD et répertoire central lisibles.
- 30 entrées ZIP.
- `VERSION` décompressé : `1.2.0`.
- `MANIFEST.json` décompressé : `version=1.2.0`, `builtAt=2026-10-21T00:42:58`.
- 26 fichiers répertoriés dans le manifeste.
- 26/26 fichiers présents ; SHA-256 et taille décompressée correspondent exactement au manifeste.
- 30/30 entrées ZIP décompressées ; CRC32 et tailles non compressées correspondent au répertoire central pour les 30 entrées.
- Aucun écart de hash ou de taille.

**Conclusion limitée mais positive : l'objet actuellement présent dans le bucket BOT-WOW est intègre par rapport à son manifeste interne et à l'empreinte SHA-256 de référence.**

## Limite de provenance — non résolue

Le manifeste indique un build daté du 2026-10-21. La recherche récursive de l'arbre GitHub `main` (`c11e84bcf59018a5020f3a64e335050eaf207941`) ne trouve pas les sources correspondantes du paquet (`scripts/fishing_bot.py`, `scripts/fishing_observer.py`, `runtime-addon/Casinobabe/Casinobabe.lua`, etc.). Le dépôt contient les pages et la logique Worker, mais pas ces sources de l'archive.

Donc :
- l'intégrité de l'archive R2 est vérifiée ;
- la présence de `VERSION` et `MANIFEST.json` est vérifiée ;
- la reproductibilité du paquet depuis le `main` actuel n'est pas démontrée ;
- la provenance des fichiers par rapport à un commit source BOT-WOW n'est pas démontrée ;
- aucune validation fonctionnelle du bot empaqueté n'a été exécutée dans ce cycle.

## Effet commercial

Ce contrôle lève uniquement le doute sur l'existence et l'intégrité interne de l'objet R2. Il ne certifie pas encore :
- le téléchargement via le Worker et un jeton client valide ;
- l'envoi réel de l'e-mail de livraison ;
- la création de licence après paiement confirmé ;
- l'activation client ;
- la conformité contractuelle du produit.

Le checkout reste fermé. Les 16 paiements Mollie BOT-WOW référencés dans D1 ont été vérifiés individuellement dans P0.30 : 16/16 expirés, aucun `paidAt`, aucun moyen de paiement, tous rattachés au profil Sargasses. Le revenu commercial confirmé reste `0,00 €`.

Aucun objet R2 n'a été modifié, aucun Worker déployé, aucun secret/binding modifié, aucun paiement créé, aucun e-mail envoyé, aucune écriture D1 effectuée.


## P0.31 — comparaison du bundle Worker actif avec main (même relevé)

L'API Cloudflare `GET /accounts/{account_id}/workers/scripts/botwow-api/content/v2` a maintenant fourni le bundle actif lisible (multipart, 264 215 octets de réponse).

Worker actif :
- version 50, version ID `c3dcc842-c422-42d3-9828-405f30d70b5f`
- déploiement `36227a4d-00e7-4c9f-94e0-0913b29049bc`, créé le 2026-10-27T07:46:28.277Z
- marqueurs présents : `RELEASE_STATUS`, `delivery_unverified`, `sendDeliveryEmail2`, `sendEmail2`, `MOLLIE_PROFILE_ID`
- marqueur absent : `resumeFulfillment`.

Comparaison fonctionnelle :
- Dans le bundle actif, `handleMollieWebhook` insère `payment:<id>` dans `webhook_events` avant `fulfillOrder`. Une notification dupliquée qui rencontre la contrainte UNIQUE retourne ensuite `200 OK` comme déjà traitée. Le bundle actif n'a pas de reprise de livraison après cet état.
- Dans `main` (`worker/index.js`, blob `725d98e4595b27aa60e88758ecac20c711a38b6b`), le code suit `alreadyLocked` et appelle `resumeFulfillment` sur un rejeu ; cette fonction vérifie commande, licence, jeton et reçu d'e-mail puis reprend les étapes manquantes.
- Donc le correctif de reprise présent dans main n'est pas dans le Worker de production version 50. **Si une livraison échoue après l'insertion du verrou webhook dans la version 50, le rejeu peut être ignoré sans reprise.** C'est un défaut P0 de livraison, pas une hypothèse.

Comparaison de journalisation :
- Le bundle actif journalise l'adresse e-mail dans le log d'acceptation Resend.
- Il journalise `email`, `key` et `amount` dans la notification admin.
- Il journalise `payment.id`, l'e-mail et la clé de licence après fulfillment.
- Le code main remplace ces logs par un identifiant de message fournisseur, `Paid order recorded` et l'identifiant de paiement uniquement.

Le bundle actif contient donc également des logs contenant des données personnelles et des clés de licence qui ont été redigés dans main.

**Décision :** préparer le déploiement du Worker main avec un rollback vers la version 50, mais ne pas déployer dans ce cycle. Le Worker est le chemin paiement/livraison de production ; sa mise à niveau exige la confirmation d'un profil Mollie BOT-WOW dédié et une autorisation explicite. Ne pas réutiliser le profil Sargasses. Aucun POST, paiement, secret, binding ou déploiement n'a été effectué.


---

# P0.32 — Réconciliation live et blocages commerciaux — 2026-11-04T23:48Z

## GitHub — état vérifié

- Dépôt : `aveca/bot-wow`.
- `main` : `3786bcec75a22a4a4af2c968c83ad39263cb7958` (merge PR #85).
- Arbre Git récursif : 443 entrées, non tronqué.
- Branches : 78.
- PR ouvertes : 17.
- PR #85 : MERGED ; son CI Validate + UI quality/Playwright est SUCCESS.
- Run Validate sur le SHA main : `41927264705`, SUCCESS.
- PR #81 : documentation ancienne, OPEN, non mergeable.
- PR #77 : OPEN/DRAFT, `mergeable_state=dirty`; 3 fichiers, dont `worker/index.js` et `tests/payment-flow.test.mjs`.
- PR #66 : OPEN/DRAFT, `mergeable_state=dirty`, 63 fichiers ; ne pas fusionner.
- PR #67 : OPEN, `mergeable_state=dirty`, 56 fichiers ; instrumentation historique à réconcilier avant toute intégration.

## Site public et Pages

Lecture web directe du domaine apex :
- `https://bot-wow.com/` : avertissement de livraison non vérifiée, prix unique 20 €, paiement unique, démo navigateur simulée.
- `https://bot-wow.com/buy` : checkout indiqué temporairement indisponible ; le texte dit explicitement de ne pas payer tant que la livraison n'est pas confirmée.
- `https://bot-wow.com/fr/buy.html` redirige vers `/fr/buy` et affiche le même état en français : 20,00 €, achat indisponible, livraison non confirmée.
- Aucune preuve de checkout fonctionnel ou de paiement n'est déduite de la présence du formulaire HTML.

Cloudflare Pages :
- Projet `bot-wow`.
- Déploiement production `5711fb21-f674-4bf2-9712-615a76ad4332`, commit `3786bcec75a22a4a4af2c968c83ad39263cb7958`, stage `deploy=success` à `2026-11-04T22:40:21Z`.
- Domaines personnalisés apex et www : tous deux actifs.
- Les previews sont désactivées.

### Alias www — blocage de canonicalisation

Lecture Cloudflare en lecture seule :
- DNS `www.bot-wow.com` : CNAME vers `bot-wow.pages.dev`, `proxied=true`.
- Le domaine www reste associé au projet Pages.
- Aucun ruleset de redirection dynamique `http_request_dynamic_redirect` n'existe sur la zone ; l'endpoint d'entrypoint renvoie 404.
- L'extraction web de `https://www.bot-wow.com/`, dont le crawl est daté de la semaine précédente, retourne une ancienne copie contenant encore des affirmations Mollie. Cette extraction n'est **pas** une preuve de la réponse d'origine actuelle : aucun GET no-cache ni en-tête CF-Cache-Status/Age/ETag n'a pu être obtenu dans cet environnement.

Action préparée, non exécutée : créer une règle Cloudflare Single Redirect `www.bot-wow.com/*` vers l'apex en conservant chemin et query string, puis vérifier le domaine. Cela nécessite l'autorisation explicite prévue par AGENTS.md ; ne pas modifier DNS/rulesets ni retirer l'alias Pages sans cette autorisation.

## Mollie — paiements BOT-WOW

- `ListProfiles` retourne un seul profil vérifié : `pfl_t8KCk4Cm2C`, associé à `sargasses-martinique.com`.
- Les 16 IDs Mollie référencés par les 11 commandes et 5 webhooks orphelins ont été relus individuellement via `GetPayment` en mode live, lecture seule.
- Résultat : 16/16 `expired`, 16/16 montant `20.00 EUR`, 16/16 `method=null`, 16/16 `profile_id=pfl_t8KCk4Cm2C`.
- Aucun profil BOT-WOW dédié n'est visible. Ne jamais utiliser le profil Sargasses pour BOT-WOW.

### Correction d'un diagnostic de code

Sur `main`, `createMolliePayment()` appelle `mollieFetch(..., true)` et `mollieFetch()` ajoute `profileId` dès que `MOLLIE_PROFILE_ID` est présent. Le code ne distingue donc pas encore une API Key Mollie (`test_*`/`live_*`) d'un token d'organisation.

La PR #77 contient une proposition de distinction par type de credential, mais elle est en draft et en conflit. Les 16 paiements historiques sont tous rattachés au profil Sargasses ; cela établit la contamination de profil, pas la cause exacte de leur expiration.

Les valeurs des secrets Cloudflare restent masquées. Le fait que les bindings existent ne prouve ni leur valeur ni leur validité.

## D1 production — lecture seule

Base `botwow-production` :
- `bitcoin_manual/paid` : 5, toutes liées à des adresses `@example.com` ; commandes de test, pas des ventes.
- `bitcoin_manual/pending_payment` : 8.
- `bitcoin_manual/rejected` : 1.
- `mollie/failed` : 11.
- Licences : 5, toutes liées aux 5 commandes Bitcoin de test.
- Jetons de téléchargement : 5 ; ils ne prouvent pas qu'un téléchargement a eu lieu.
- `deliveries` : 0 ligne.
- `activations` : 0 ligne.
- `webhook_events` : 16 ; jointure `w.id = 'payment:' || o.provider_id` : 5 événements sans commande associée.
- `botwow_emails` : 12 enregistrements, dont 11 adresses de test ; aucun n'établit une vente.

Base `botwow-analytics`, événements (pas des utilisateurs/sessions uniques) :
- `page_view` test=0 : 1 621 ; dernier événement `2026-11-04T22:39:12Z`.
- `journey_view` test=0 : 635 ; dernier `22:39:09Z`.
- `cta_click` test=0 : 48 ; dernier `02:47:00Z`.
- `checkout_requested` test=0 : 29 ; dernier `02:47:00Z`.
- `checkout_start` : 4 ; `checkout_created` : 6 ; `checkout_failed` : 6.
- Aucun événement `payment_confirmed`, `conversion`, `delivery_sent` ou `activation`.
- Les 235 page_view et 128 journey_view du 4 novembre sont des événements, pas des visiteurs uniques.

Toutes les requêtes D1 de ce relevé sont des SELECT/PRAGMA : `changed_db=false`, `rows_written=0`.

## Worker — état et divergence

- Worker actif `botwow-api` : version 50, ID `c3dcc842-c422-42d3-9828-405f30d70b5f`.
- Déploiement actif `36227a4d-00e7-4c9f-94e0-0913b29049bc`, créé le `2026-10-27T07:46:28.277Z`.
- Aucun nouveau déploiement depuis cette version ; aucune annotation `workers/commit_sha`.
- Les bindings `MOLLIE_API_KEY`, `MOLLIE_PROFILE_ID`, `MOLLIE_WEBHOOK_SECRET`, `RELEASE_STATUS` et `RESEND_API_KEY` existent par nom ; valeurs non visibles.
- Le source main contient `resumeFulfillment` et les logs redigés. La dernière comparaison directe du bundle actif, consignée dans P0.31, indiquait que la version 50 n'avait pas `resumeFulfillment` et journalisait encore e-mail/clé de licence. La version active est inchangée ; le bundle brut n'a pas pu être relu par le connecteur Cloudflare pendant P0.32, donc cette comparaison reste la dernière preuve disponible.
- Le statut effectif du secret `RELEASE_STATUS` n'est pas vérifié. Le checkout public reste fermé ; aucun POST n'a été envoyé.

## Sécurité et cohérence d'offre — nouveaux points

- Le source main génère les clés de licence avec `Math.random()`, alors que les jetons de téléchargement utilisent `crypto.getRandomValues()`. La génération des clés de licence devrait être durcie avec un CSPRNG et un test de régression. C'est un changement de sécurité : préparer le correctif dans une PR séparée, ne pas fusionner/déployer sans autorisation.
- `DEFAULT_MAX_ACTIVATIONS = 2` dans le Worker, tandis que les pages annoncent une activation sur une machine. Décision produit requise ; ne pas modifier silencieusement la limite ni la promesse.
- La commercialisation du bot automatisant le gameplay reste suspendue à une revue de conformité contractuelle. Ne pas supposer qu'un serveur privé ou un planificateur associé au gameplay est automatiquement autorisé.

## Chiffre d'affaires et décision

- Ventes commerciales payées et vérifiées : **0**.
- Revenu commercial confirmé : **0,00 €**.
- Aucun téléchargement client, e-mail client ou activation commerciale démontré.
- Checkout public toujours fermé.

## Une prochaine action prioritaire

Préparer un correctif Mollie minimal et isolé (distinction API Key vs token d'organisation, tests unitaires) sur une branche propre depuis ce main, en laissant la PR en draft. Ne pas le déployer et ne pas créer de paiement tant qu'un profil BOT-WOW dédié et une credential BOT-WOW ne sont pas disponibles. Ensuite seulement, préparer le test contrôlé de bout en bout et le déploiement Worker avec rollback, sous autorisation explicite.


---

# P0.33 — live funnel, platform-rules disclosure and clean Mollie successor — 2026-11-05

## Current baseline

Current `main` at the start of this cycle: `3786bcec75a22a4a4af2c968c83ad39263cb7958`.

### D1 production — read-only, 2026-11-05

Database query metadata confirms `changed_db=false` and `rows_written=0`.

Orders:
- `bitcoin_manual / paid`: 5 rows; all five email domains are `example.com` and are excluded as test data.
- `bitcoin_manual / pending_payment`: 8.
- `bitcoin_manual / rejected`: 1.
- `mollie / failed`: 11.
- Total orders: 25.

Fulfillment tables:
- Licenses: 5.
- Download tokens: 5.
- Deliveries: 0.
- Activations: 0.
- Webhook events: 16.
- Webhook events without an order match using `webhook_events.id = 'payment:' || orders.provider_id`: 5.
- Email records: 12.

**Commercial paid orders verified in D1: 0; confirmed commercial revenue: €0.00.** The five `paid` Bitcoin rows are test-domain records, not sales. A download token is not proof of a completed download or delivery.

Analytics (`test=0`, event counts, not unique visitors/sessions):
- `page_view`: 1,630; latest observed 2026-11-05 00:05:37 UTC.
- `journey_view`: 640.
- `cta_click`: 48; latest 2026-11-04 02:47:00 UTC.
- `checkout_requested`: 29.
- `checkout_start`: 4.
- `checkout_created`: 6.
- `checkout_failed`: 6.
- `planner_mode`: 1.
- No `payment_confirmed`, `conversion`, `delivery_sent` or `activation` events in the queried production aggregate.

### Mollie profile — read-only

Latest `ListProfiles` returns one verified profile associated with a different domain. No BOT-WOW-dedicated profile is visible. Do not reuse the returned profile or its credentials. The previously documented individual check of the 16 BOT-WOW-referenced Mollie IDs remains 16/16 expired; this cycle did not create a payment or query another product's global payment registry.

### Public site

Direct web reads of `https://bot-wow.com/`, `/buy`, and `https://www.bot-wow.com/` show:
- €20 one-time offer remains displayed.
- v1.2.0 delivery is explicitly unverified.
- Card checkout is unavailable and the purchase form is disabled.
- The English copy still said “play on servers where it is allowed” and described third-party servers as a reference environment; this could imply that operator permission is sufficient.
- The French `/fr/buy` page could not be retrieved by the web reader in this cycle. Its live HTML is therefore not confirmed.

No live HTTP no-cache headers were available from the web reader. Do not claim a cache or origin defect without a direct response.

## Platform-rules finding

The live product is described as software that reads the game screen and clicks on fishing bites. Blizzard's published Anti-Cheating Agreement states that unauthorized third-party programs for botting or changing/facilitating gameplay are a serious violation. The EULA page reports a revision date of 2024-03-21; the Anti-Cheating Agreement search result reports last updated 2016-02-03.

References:
- https://www.blizzard.com/en-us/legal/cd5930c0-2784-420c-a23d-1e0d6ff8599b/anti-cheating-agreement
- https://www.blizzard.com/en-us/legal/08b946df-660a-40e4-a072-1fbde65173b1/blizzard-end-user-license-agreement

This is a serious contractual/compliance blocker, not a legal opinion. BOT-WOW has no demonstrated Blizzard authorization. Do not promote the automated bot as permitted or safe. Technical compatibility with a third-party server does not itself establish authorization from Blizzard or other rights holders.

## New code PR — Mollie credential-specific profileId

PR #87: https://github.com/aveca/bot-wow/pull/87  
Branch: `fix/p0.33-mollie-profileid-main-20261104`  
Head: `c39157d5180752f03af9900fe7a5517dc576f591`.

This is a clean successor to conflicting draft PR #77, based on current main. It changes only:
- `worker/index.js`: omit `profileId` for standard `test_*` / `live_*` API keys; send it for organization/OAuth credentials.
- `tests/payment-flow.test.mjs`: regressions for test API key, live API key and organization token on payment creation and webhook retrieval.

GitHub Validate and UI quality workflows both succeeded. This is a payment-integration code change only on a draft PR; it is not merged or deployed. It does not solve the missing dedicated BOT-WOW profile or account separation. Keep it draft until the account operator confirms a dedicated profile/credential and explicitly authorizes a controlled payment test and production deployment.

Official Mollie references:
- https://docs.mollie.com/reference/authentication
- https://docs.mollie.com/reference/create-payment

## New public-copy PR — platform and payment disclosures

PR #88: https://github.com/aveca/bot-wow/pull/88  
Branch: `fix/p0.33-platform-compliance-copy-20261105`  
Head: `4f0f6427861c62c552ac033223775f28d7cc5fdf`.

Changes are limited to eight EN/FR pages and `tests/release-availability.test.mjs`:
- state clearly that BOT-WOW has no Blizzard authorization and must not be used with Blizzard-operated services;
- clarify that third-party technical compatibility is not authorization and operator permission alone is not sufficient evidence of rights-holder authorization;
- remove “play on servers where it is allowed” / “within the rules of the server” wording;
- replace “no network detection” with a technical-scope statement;
- correct the FAQ so it no longer claims Mollie card checkout and a manual Bitcoin lane are currently available.

At snapshot time, Validate and UI/Playwright workflows were still in progress. No local tests are claimed. This PR changes no price, checkout rule, Worker, credential, D1, R2, email or production configuration. If both workflows pass and the diff remains limited to these reversible copy/test changes, it is eligible for the repository's normal safe merge/deploy procedure with a Pages rollback available.

## Production changes

None in this cycle:
- no Worker deployment;
- no Pages deployment;
- no checkout/payment change;
- no secret or binding change;
- no D1 writes;
- no R2 writes;
- no payment creation;
- no customer email.

## Next action

Finish PR #88 CI and publish the corrected EN/FR disclosure if all checks pass; keep PR #87 and all payment/Worker production changes blocked until a dedicated BOT-WOW Mollie profile/credential and explicit production-test authorization exist. Do not start paid acquisition for the automated bot while the platform-rules blocker remains unresolved.


## P0.33 follow-up — CI correction, PR hygiene and production rollback evidence — 2026-11-05

- Current `main` remains `3786bcec75a22a4a4af2c968c83ad39263cb7958`; no production Worker or Pages change was made in this cycle.
- PR #77 is now closed as superseded by clean current-main PR #87. The closing comment points to #87 and explicitly warns against merging the conflicting historical branch.
- PR #87 head remains `c39157d5180752f03af9900fe7a5517dc576f591`. Validate and UI/Playwright both succeeded:
  - https://github.com/aveca/bot-wow/actions/runs/41942381755
  - https://github.com/aveca/bot-wow/actions/runs/41942381702
  It remains draft because it changes payment-integration code and BOT-WOW still has no dedicated Mollie profile/credential.
- PR #88 was corrected after its first CI run exposed two French legal-link allowlist failures. The French pages now use Blizzard's French Charte anti-triche URL; the conversion-path test allows only the exact official EN/FR Blizzard legal URLs. The authorization wording was also narrowed to “no authorization is claimed or documented” to avoid asserting facts outside the repository evidence.
- PR #88 latest head: `c3069f0f011f86f84c432daeb336a815bf53989e`. Validate succeeded on this head: https://github.com/aveca/bot-wow/actions/runs/41943517766. UI quality / real-browser Playwright was still in progress at the time of this update: https://github.com/aveca/bot-wow/actions/runs/41943517802. Do not merge until that run completes successfully.
- PR #88 scope remains eight EN/FR pages plus two static test files. No price, CTA checkout behavior, Worker, credentials, secrets, bindings, D1, R2 or email action is changed.
- Cloudflare Pages production before this PR: deployment `5711fb21-f674-4bf2-9712-615a76ad4332`, commit `3786bcec75a22a4a4af2c968c83ad39263cb7958`, aliases `bot-wow.com` and `www.bot-wow.com`. Cloudflare exposes a Pages deployment rollback endpoint; keep this deployment as the known-good rollback target if PR #88 is safely merged and the new production content fails verification.
- Worker `botwow-api` remains version 50 (`c3dcc842-c422-42d3-9828-405f30d70b5f`), 100% of the latest Worker deployment. No deployment or secret/binding mutation was made.
- Latest read-only D1 baseline remains 25 orders, 5 test-domain Bitcoin `paid` rows, 11 Mollie `failed`, 0 deliveries and 0 activations. Commercial paid sales remain 0; revenue remains €0.00. Latest analytics event totals are in the P0.33 section above.

### Next action

Finish PR #88 UI/Playwright on the exact latest head. If green, squash-merge the reversible copy/test correction and verify the resulting Pages production deployment plus EN/FR live pages. Keep PR #87 draft and the Worker untouched until a dedicated BOT-WOW Mollie profile/credential and explicit payment-production authorization exist.


### P0.33 final head correction — 2026-11-05

- PR #88 latest head is now `c3069f0f011f86f84c432daeb336a815bf53989e` (after localizing the Blizzard anti-cheating source link on all four French pages and qualifying the metadata wording as “not documented” rather than asserting an unverified absolute).
- Latest Validate run on this exact head: SUCCESS — https://github.com/aveca/bot-wow/actions/runs/41943517766.
- Latest UI quality run on this exact head: still IN_PROGRESS at the time of this note — https://github.com/aveca/bot-wow/actions/runs/41943517802. Its unit/integration tests, CSS audit, build and Chromium installation have passed; real-browser Playwright is the remaining step.
- Static branch inspection confirms the old “play on servers where it is allowed” / “within the rules of the server” wording is absent from all eight updated EN/FR pages. All eight now contain the platform warning; the four French pages link to Blizzard's French Charte anti-triche.
- PR #77 is closed; PR #87 is the clean draft successor and both its Validate and UI/Playwright workflows passed. No production payment change has been made.


### Additional offer inconsistency confirmed — activation allowance

Current `main` `worker/index.js` sets `DEFAULT_MAX_ACTIVATIONS = 2` (line 40), and both licence-creation paths persist `max_activations = 2` (current source around lines 806-809 and 1357-1361). The activation handler counts distinct `machine_id` rows for the licence and rejects only when the count reaches that stored maximum.

The public EN/FR buy pages still say “Activation on one machine” / “Activation sur une machine” and the FAQ says the licence activates on one machine.

This is a proven commercial-entitlement mismatch. Do not silently change the backend limit or the public offer copy. The product owner must decide whether the offer is one machine (then code must enforce one) or up to two distinct machine activations (then copy/terms must state the exact rule). No price or activation rule was changed in this cycle.


## P0.33 delivery result — PR #88 merged and Pages production deployment succeeded — 2026-11-05

- PR #88 was squash-merged after both required workflows passed on head `c3069f0f011f86f84c432daeb336a815bf53989e`.
  - Validate Bot-Wow SUCCESS: https://github.com/aveca/bot-wow/actions/runs/41943517766
  - UI quality, unit/integration, CSS audit, build and real-browser Playwright SUCCESS: https://github.com/aveca/bot-wow/actions/runs/41943517802
- Merge commit / current `main`: `218f0ebba5563e386151bc9d8f6e96c506547c33`.
- Cloudflare Pages production deployment: `54aacb90-1cce-4055-b2ab-f2241afc4792`, URL `https://54aacb90.bot-wow.pages.dev`, commit `218f0ebba5563e386151bc9d8f6e96c506547c33`, build SUCCESS, deploy SUCCESS, aliases assigned to `https://bot-wow.com` and `https://www.bot-wow.com`.
- Cloudflare's Pages rollback endpoint is available. The previous known-good production deployment was `5711fb21-f674-4bf2-9712-615a76ad4332`.
- Live HTML verification is **not complete**: the web reader continued to return a pre-merge crawl after the new deployment became active, then cache-buster requests failed to fetch. The container had no DNS/network access. No `CF-Cache-Status`, `Age` or ETag could be captured. Do not claim the new copy is confirmed at the origin until a real HTTP/browser request succeeds.
- PR #87 remains OPEN / DRAFT, with both CI workflows passing. It is a payment-integration code change and is not merged or deployed. No BOT-WOW-specific Mollie profile is visible.
- Worker `botwow-api` remains version 50; no Worker deployment, secret or binding change was made.
- D1 remained read-only; no new order/payment was created. Latest commercial baseline remains 0 verified paid sales and €0.00 confirmed revenue.
- The public/backend activation allowance mismatch is documented above; no entitlement rule or copy was changed.

### Next action

Verify the exact production HTML on `bot-wow.com` and `www.bot-wow.com` using a real no-cache HTTP/browser request and confirm the EN/FR disclosure is served. Then resolve the one-machine versus two-activation entitlement with the product owner before any checkout reopening. Keep all payment/Worker production changes blocked until a dedicated BOT-WOW Mollie profile/credential and explicit authorization exist.


### Commercial consequence of the Blizzard EULA

The current EULA's Section C.2 is broader than a ban on a player using a bot: it lists creating, using, offering, promoting, advertising, making available and/or distributing bots or other unauthorized code/software that changes or facilitates gameplay. This directly affects the proposed sale/marketing path, not only end-user use. No Blizzard authorization is documented in this repository. This remains a serious platform-contract risk; this is not a legal opinion.

Official source: https://www.blizzard.com/en-us/legal/08b946df-660a-40e4-a072-1fbde65173b1/blizzard-end-user-license-agreement

### Pivot-market caution

A generic outdoor fishing spot/route planner is not automatically a better commercial opportunity. Current public competitors already offer waypoint management, route planning and free tiers (for example FISHMARKS), while Lunkerr offers trip planning and saved spots on a low-cost subscription. Any game-independent BOT-WOW pivot must show a distinct wedge (e.g. genuinely local/offline, privacy-first, optimized multi-stop routes) and validate demand before changing the public offer or pricing.

Sources:
- https://fishmarks.com/
- https://www.lunkerr.com/
