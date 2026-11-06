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


## P0.34 — production revalidation and payment readiness — 2026-11-05T01:49Z

### GitHub
- Current `main`: `218f0ebba5563e386151bc9d8f6e96c506547c33` (PR #88 merged).
- PR #71 is **MERGED** (`2026-11-04T08:57:50Z`, merge commit `084e2bd3785526835e678f70b77699a8f838d16a`); the older P0.5/checkout-gate PR is not an open blocker.
- Relevant open drafts: PR #87 (Mollie credential-specific `profileId` fix, head `c39157d5180752f03af9900fe7a5517dc576f591`) and PR #89 (this operational snapshot). PR #87 is now **diverged from current main**: 2 commits ahead and 1 behind, merge base `3786bcec`; its green CI is on the old base and it must be rebased/revalidated before any future merge.
- PR #87 Validate and UI/Playwright both completed SUCCESS on head `c39157d`. PR #89 Validate and UI/Playwright both completed SUCCESS on its prior head `b881f58`; the latest documentation-only commit `d66e357` did not trigger new workflows under the repository's path filters. No production Worker change is implied.
- PR #19 is CLOSED/MERGED; its versioned-R2-only download behavior is already part of main. Do not create a competing duplicate fix.
- Branch search returned 79 branches over the completed pagination; many are historical. The repository currently has 17 open PRs in the latest search result.

### Cloudflare production
- Latest Pages production deployment: `54aacb90-1cce-4055-b2ab-f2241afc4792`, created `2026-11-05T00:47:14Z`, branch `main`, commit `218f0ebba5563e386151bc9d8f6e96c506547c33`, deploy stage SUCCESS. Aliases: `bot-wow.com` and `www.bot-wow.com`.
- Worker `botwow-api`: latest deployment still `36227a4d-00e7-4c9f-94e0-0913b29049bc`, 100% version `c3dcc842-c422-42d3-9828-405f30d70b5f` (v50), created `2026-10-27T07:46:28Z`. No new Worker deployment.
- Worker settings expose binding names including `MOLLIE_API_KEY`, `MOLLIE_PROFILE_ID`, `MOLLIE_WEBHOOK_SECRET`, `RELEASE_STATUS` and `RESEND_API_KEY` as `secret_text`. Secret values are intentionally unavailable; binding presence does not prove credential validity or the configured profile's ownership.
- No secret, binding, Worker, Pages configuration, D1, R2, checkout or payment mutation was performed.

### Public site
- A fresh web extraction of `https://bot-wow.com/buy` (crawled today) shows €20, intended v1.2.0 scope, package/delivery unverified and checkout unavailable/disabled. It still returns an older platform-warning sentence (“play on servers where it is allowed”).
- Current main sources `buy.html` (blob `94e63a535ae757df8a19e85f8f9e7efe16a1eccc`) and `fr/buy.html` (blob `9202d0a3fe311445721891521f1c204cd8d2a12e`) contain the newer explicit “no Blizzard authorization is claimed or documented / do not use with Blizzard-operated services” notice and disabled checkout.
- The web reader could not retrieve `/fr/buy` or the deployment-specific `pages.dev` URL in this check. No raw HTTP response headers (CF-Cache-Status, Age, ETag) were obtained. Therefore the difference between current source and the extracted custom-domain copy remains unresolved; do not assert a cache cause or purge anything.

### D1 production — read-only, fresh query
Every D1 query returned `changed_db=false` and `rows_written=0`.
- Orders: 25 total — Bitcoin manual `paid=5` (test-domain rows), `pending_payment=8`, `rejected=1`; Mollie `failed=11`.
- Fulfillment: licenses 5; download tokens 5; delivery receipts 0; activations 0.
- Webhooks: 16 total; 11 matched to orders using `webhook_events.id = 'payment:' || orders.provider_id`; 5 unmatched.
- No production delivery record exists in `deliveries`. The five Bitcoin `paid` rows are test data and are not sales. No commercial payment is verified; confirmed revenue remains €0.00.

### Analytics production — events, not users/sessions
Filter `test=0`:
- `page_view=1,668` (latest `2026-11-05T00:56:00.633Z`).
- `journey_view=659` (latest `2026-11-05T00:55:57.485Z`).
- `cta_click=48` (latest `2026-11-04T02:47:00.736Z`).
- `checkout_requested=29`, `checkout_start=4`, `checkout_created=6`, `checkout_failed=6`, `planner_mode=1`.
- No grouped `payment_confirmed`, `conversion`, `delivery_sent`, `activation` or `delivery_failed` events were returned.
- These are event counts, not unique visitors or sessions.

### Worker / delivery code
- Current main `worker/index.js` contains `resumeFulfillment` and the redacted email/admin logs.
- Main still appends `MOLLIE_PROFILE_ID` whenever a caller requests it; PR #87 contains the credential-type-aware fix (omit for standard `test_*/live_*` API keys, include for organization/OAuth credentials). PR #87 is still DRAFT; do not merge/deploy until the dedicated BOT-WOW profile/credential and explicit production authorization are in place.
- Main `generateLicenseKey2` still uses `Math.random()`; this is a security-hardening candidate, not changed in this cycle because it requires a separate security review/authorization.
- `RESEND_API_KEY` binding name is present, but its value and validity are not observable here. The delivery code records a pending receipt when Resend rejects/fails; production currently has zero delivery rows and no verified real paid order. Do not claim the key is invalid without a permitted, controlled provider check.

### Commercial and compliance decision
- The public offer remains €20 lifetime, but checkout is disabled because delivery is not certified.
- Current offer says one-machine activation; Worker default and licence creation use `max_activations=2`. This entitlement mismatch remains unresolved; do not silently change the backend or sales copy.
- The current product automates WoW gameplay and the public disclosure says no Blizzard authorization is claimed/documented and not to use it with Blizzard-operated services. Do not run paid acquisition or represent the automated bot as authorized. A manual WoW planner is not automatically outside the EULA because software that facilitates gameplay may also be restricted.
- No payment, customer email, D1/R2 write, Worker deployment, checkout change, price change or campaign was performed.

### Next actions
1. Keep checkout closed; do not market the automated bot for Blizzard-operated services.
2. Resolve the commercial/legal product scope before any sale campaign; validate any game-independent alternative's distinct demand before building it.
3. Obtain a dedicated BOT-WOW Mollie profile and credential through the account operator; never reuse another product's profile. Then review/authorize PR #87 separately.
4. Certify the Resend sender/key with a controlled test destination only after explicit authorization; do not infer validity from the binding name.
5. Resolve the one-machine versus two-activation entitlement.
6. Prepare, but do not deploy, the Worker update/rollback until payment routing and post-payment fulfillment are authorized and verified.


---

# P0.35 — live surface and production revalidation — 2026-11-05T01:58Z

## GitHub
- Current `main`: `218f0ebba5563e386151bc9d8f6e96c506547c33` (PR #88 merged).
- PR #89 remains OPEN/DRAFT, based directly on this main; head `07913e6a3c149d204db194f307fd7d1840fc6cc2`, five commits ahead, zero behind, one documentation file changed.
- PR #89 Validate and UI/Playwright runs on the recorded head completed SUCCESS. The combined commit-status endpoint returns no status rows; use the workflow-run results, not an empty status list, as the CI evidence.
- PR #87 remains OPEN/DRAFT at `c39157d5180752f03af9900fe7a5517dc576f591`, based on old `3786bcec`; comparison with current main is 2 ahead / 1 behind. Its green Validate/UI runs are for the old base. Do not merge it as-is; recreate/rebase and rerun CI before review.
- PR #66 remains OPEN/DRAFT and is not a release approval.

## Cloudflare Pages — current production deployment
- Production deployment `54aacb90-1cce-4055-b2ab-f2241afc4792`, created `2026-11-05T00:47:14Z`, branch `main`, commit `218f0eb`.
- Build and deploy stages both SUCCESS; deploy ended `2026-11-05T00:47:40Z`.
- Aliases: `https://bot-wow.com` and `https://www.bot-wow.com`; both custom-domain records report active.
- The deployment manifest includes `/fr/buy.html`. This confirms the file was part of the deployed artifact, not which HTML a particular edge returned.
- Worker `botwow-api` is still 100% on version 50 (`c3dcc842-c422-42d3-9828-405f30d70b5f`), deployment `36227a4d-00e7-4c9f-94e0-0913b29049bc`, created `2026-10-27T07:46:28Z`. No Worker deployment or binding/secret change occurred.

## Public live extraction — newly observed EN/FR inconsistency
- Apex `/buy` now returns the explicit disclosure that no Blizzard authorization is claimed/documented and says not to use BOT-WOW with Blizzard-operated services; it also says the v1.2.0 package/delivery is unverified and checkout is unavailable. Price remains €20 lifetime.
- Apex homepage returns the same explicit no-authorization warning and keeps delivery unverified.
- `/fr/buy.html` redirects to `/fr/buy`, but the current web extraction still returns the older wording “Jouez sur des serveurs où c'est autorisé” and does not show the new explicit no-Blizzard-authorization disclosure.
- `www.bot-wow.com/` still extracts an older homepage copy referring to private servers as the reference environment and using a softer server-terms warning.
- Current GitHub main `fr/buy.html` and `fr/index.html` contain the explicit no-authorization / do-not-use-with-Blizzard-services wording. Thus the extracted public FR/www content differs from current source despite the successful Pages deployment.
- No raw HTTP headers (`CF-Cache-Status`, `Age`, `ETag`) were available from the web reader, and the deployment-specific `pages.dev` URL could not be opened by that reader. The cause (edge cache, alias routing, or reader snapshot) is **not established**. Do not claim a cache fault and do not purge Cloudflare or alter DNS/redirect rules without the required authorization.
- The apex EN surface is the only live surface in this check where the current explicit disclosure was directly observed. Keep the discrepancy open until a real no-cache HTTP/browser request verifies FR and www.

## D1 production — read-only refresh
Every query returned `changed_db=false` and `rows_written=0`.
- Orders: `bitcoin_manual/paid=5` (all previously identified test-domain rows), `bitcoin_manual/pending_payment=8`, `bitcoin_manual/rejected=1`, `mollie/failed=11`; 25 total.
- Fulfillment counts: licenses 5, download tokens 5, deliveries 0, activations 0, webhooks 16, email records 12. No new delivery or activation is demonstrated.
- Analytics event counts with `test='0'`: `page_view=1674` (latest `2026-11-05T01:55:30.399Z`), `journey_view=662` (latest `01:55:26.997Z`), `cta_click=48`, `checkout_requested=29`, `checkout_start=4`, `checkout_created=6`, `checkout_failed=6`, `planner_mode=1`. No `payment_confirmed`, `conversion`, `delivery_sent`, `delivery_failed` or `activation` event was returned.
- These are event counts, not unique visitors or sessions. New page/journey events arrived; the purchase-intent and checkout event totals did not change.

## Mollie and revenue
- `ListProfiles` still returns one verified profile only: `pfl_t8KCk4Cm2C`, website `sargasses-martinique.com`. No BOT-WOW-dedicated profile is visible. Never reuse this profile for BOT-WOW.
- Do not re-query the 16 previously verified payment IDs unless D1 references change. Their prior result remains 16/16 expired; this cycle did not query the other product's global payment register.
- The five Bitcoin `paid` rows are test data, not commercial sales. No real paid BOT-WOW order is verified.
- Confirmed commercial revenue remains **€0.00**; deliveries 0; activations 0.

## Product / entitlement blockers
- Public EN/FR purchase pages state one-machine activation. Current Worker code uses `DEFAULT_MAX_ACTIVATIONS = 2` and writes `max_activations=2` for newly fulfilled licenses. This is an unresolved entitlement mismatch; do not silently change the rule or sales copy.
- `generateLicenseKey2()` in the current Worker source still uses `Math.random()`. This is a security-hardening issue, but no security/payment code was changed in this documentation cycle. Prepare it separately with cryptographic RNG and regression tests; do not deploy without authorization.
- The product remains a gameplay-automating bot. Blizzard's official EULA §1.C.2 prohibits creating, using, offering, promoting, advertising, making available and/or distributing unauthorized bots or software that facilitates gameplay. No authorization is documented for BOT-WOW. Do not market it for Blizzard-operated services. Third-party technical compatibility is not proof of authorization.
- Official sources: [Blizzard EULA](https://www.blizzard.com/en-us/legal/simple/bfbbb648-bcc6-4b78-a5c7-e2fe20c135df/blizzard-end-user-license-agreement) and [Anti-Cheating Agreement](https://www.blizzard.com/en-us/legal/simple/cd5930c0-2784-420c-a23d-1e0d6ff8599b/anti-cheating-agreement).

## Decision / next action
1. Keep checkout closed.
2. Obtain a dedicated BOT-WOW Mollie profile and credential through the account operator; do not use the Sargasses profile.
3. Rebase/recreate PR #87 on current main and rerun CI; keep it draft until the dedicated profile/credential type and production authorization are confirmed.
4. Obtain a real no-cache HTTP/browser capture of apex, FR and www with response headers; only then decide whether a cache/alias fix is needed. No purge, DNS or redirect change yet.
5. Resolve the one-machine/two-activation entitlement before reopening sales.
6. Keep the automated bot unmarketed for Blizzard-operated services unless authorization is documented.

No price, checkout, payment, secret, binding, Worker, D1, R2, customer email, DNS, Cloudflare rule, or production configuration was changed in this P0.35 documentation refresh.


---

# P0.36 — revalidation live, D1, Mollie et état des PR — 2026-11-05T02:10Z

## GitHub — état exact
- Dépôt : `aveca/bot-wow`, branche par défaut `main`.
- `main` : `218f0ebba5563e386151bc9d8f6e96c506547c33` (`fix(copy): clarify platform compliance and payment availability`).
- Inventaire API : 83 branches sur la page retournée (83 au total dans cette réponse) et 17 PR ouvertes.
- PR #90 : OPEN / DRAFT, base `main`, head `1f61a451d962fd9d8f3a8464acbdfca25e283032`, 2 fichiers. Correctif Mollie API-key vs organisation/OAuth. Checks du HEAD : Validate run `41952467280` SUCCESS ; UI/Playwright run `41952467153` SUCCESS. La PR reste non fusionnée et non déployée.
- PR #89 : OPEN / DRAFT, branche documentaire courante. Checks du head précédent `109689d268e1d70e65bb77ecb34b568f95507da2` : Validate `41952738455` SUCCESS ; UI/Playwright `41952738486` SUCCESS. Le présent addendum crée un nouveau HEAD et doit recevoir ses propres checks.
- PR #66 reste OPEN / DRAFT et non mergeable ; sa description confirme que le pivot conformité n'est pas une autorisation ni une release.
- Les PR historiques ouvertes (#81, #67, #65, #64, #53, #52, #61, #60, #56, #55, #49, #47, #45, #30) n'ont pas été fusionnées ni fermées dans ce cycle.

## Cloudflare Pages — état de production
- Projet `bot-wow`, branche de production `main`, build `node scripts/build-site.mjs _site`.
- Déploiement de production confirmé : `54aacb90-1cce-4055-b2ab-f2241afc4792`, commit `218f0ebba5563e386151bc9d8f6e96c506547c33`, build et deploy SUCCESS, terminé le `2026-11-05T00:47:40Z`.
- Domaines personnalisés `bot-wow.com` et `www.bot-wow.com` : tous deux `active`.
- Le déploiement le plus récent listé par l'API est un preview documentaire `9b272742-bbbd-4c7e-b972-6cf9979bee28`, marqué `is_skipped=true`, raison `preview_deployments_disabled`. Il ne remplace pas la production.
- Vérification web fraîche : `https://bot-wow.com/buy` affiche le prix 20 €, la livraison v1.2.0 non vérifiée, le checkout désactivé et l'avertissement explicite qu'aucune autorisation Blizzard n'est revendiquée/documentée et qu'il ne faut pas utiliser BOT-WOW avec les services exploités par Blizzard.
- Vérification web fraîche : `https://bot-wow.com/fr/buy.html` redirige vers `/fr/buy` et présente le même avertissement, le même prix et le checkout indisponible.
- Le lecteur web n'a pas pu ouvrir les variantes `www`; les deux enregistrements de domaines restent actifs dans Pages, mais le contenu www n'est pas certifié par une requête HTTP brute dans ce cycle.
- Les anciens chemins SEO `/wow-gold-bot` et `www.../undetected-wow-bot` retournent 404 lors de l'ouverture directe. Les résultats de recherche encore visibles sont des indexations historiques, pas une preuve que ces pages sont actuellement servies. Ne pas recréer ces anciennes promesses de gold farming/anti-détection.

## Worker — état et garde
- Worker `botwow-api` : version 50 à 100 %, version ID `c3dcc842-c422-42d3-9828-405f30d70b5f`, déploiement `36227a4d-00e7-4c9f-94e0-0913b29049bc`, créé le `2026-10-27T07:46:28Z`. Aucun nouveau déploiement.
- Le source main `worker/index.js` (blob `725d98e4595b27aa60e88758ecac20c711a38b6b`) déclare `RELEASE_STATUS = "pending"` et `handleCheckout` retourne HTTP 409 `delivery_unverified` si le statut runtime n'est pas explicitement `confirmed`.
- Le code main contient `resumeFulfillment`; `generateLicenseKey2()` utilise encore `Math.random()`. Le bundle v50 n'a pas été téléchargé à nouveau pendant ce cycle ; la comparaison directe précédente de P0.31 reste l'évidence antérieure que v50 ne contient pas le chemin de reprise actuel. La valeur runtime du binding `RELEASE_STATUS` n'est pas lisible et n'est pas inférée.
- Aucun secret, binding, Worker, route, règle Cloudflare ou déploiement n'a été modifié.

## Mollie — profil dédié toujours absent
- Lecture seule `ListProfiles` : un seul profil vérifié, `pfl_t8KCk4Cm2C`, site `https://sargasses-martinique.com/`.
- Aucun profil BOT-WOW dédié visible. Ne jamais réutiliser ce profil.
- PR #90 traite le paramètre `profileId` selon le type de credential, mais ne crée pas le profil ni les credentials BOT-WOW. Ne pas merger/déployer sans profil dédié, type de credential confirmé et autorisation explicite.
- Les 16 IDs de paiement BOT-WOW avaient été vérifiés individuellement lors de P0.30 : 16/16 expirés. Ils n'ont pas été interrogés de nouveau ici ; aucun registre global de l'autre profil n'a été consulté.

## D1 production — lecture seule
Toutes les requêtes de ce relevé ont renvoyé `changed_db=false` et `rows_written=0`.
- Commandes : `bitcoin_manual/paid=5`, `bitcoin_manual/pending_payment=8`, `bitcoin_manual/rejected=1`, `mollie/failed=11` (25 commandes au total).
- Les cinq lignes Bitcoin `paid` sont des données de test `@example.com` et sont exclues du revenu commercial. Les 11 commandes Mollie sont `failed`; aucune commande BOT-WOW `paid` n'est démontrée.
- Licences 5 ; jetons de téléchargement 5 ; activations 0 ; livraisons 0 ; webhooks 16 ; enregistrements `botwow_emails` 12.
- Les comptages de licences/jetons ne prouvent ni téléchargement effectif ni livraison client. Aucun email client ni paiement n'a été créé.

## Analytics production — événements, pas utilisateurs uniques
Base `botwow-analytics`, filtre `test=0` :
- `page_view=1684`, dernier événement `2026-11-05T02:06:56Z`.
- `journey_view=667`.
- `cta_click=48` (dernier timestamp inchangé depuis le relevé antérieur du 2026-11-04).
- `checkout_requested=29`, `checkout_start=4`, `checkout_created=6`, `checkout_failed=6`, `planner_mode=1`.
- Aucun événement groupé `payment_confirmed`, `conversion`, `delivery_sent`, `delivery_failed` ou `activation`.
- Ce sont des événements bruts, pas des visiteurs ou sessions uniques. Les pages vues et journeys ont augmenté ; les événements d'intention et de checkout n'ont pas progressé.

## Revenu et décision commerciale
- Revenu commercial BOT-WOW confirmé dans les commandes vérifiées : **0,00 €**. Aucune vente payée ni livraison client démontrée.
- Prix public inchangé : 20 €.
- Checkout public : indisponible/désactivé ; la source Worker main conserve une garde fail-closed par défaut. La valeur du binding runtime n'est pas observable.
- La page décrit toujours un bot qui automatise le gameplay. L'EULA officielle Blizzard §1.C.2 interdit notamment d'offrir, promouvoir, distribuer ou mettre à disposition des bots non autorisés et des logiciels qui facilitent le gameplay : https://www.blizzard.com/en-us/legal/bfbbb648-bcc6-4b78-a5c7-e2fe20c135df/blizzard-end-user-license-agreement
- Aucune autorisation Blizzard n'est documentée. Ne pas promouvoir ni vendre ce produit pour les services Blizzard. Un planificateur WoW manuel n'est pas automatiquement exempté de la clause « facilitates gameplay ».
- `AGENTS.md` interdit le déploiement Worker/Pages, les modifications de secrets/bindings, les écritures D1/R2, les paiements et emails réels sans autorisation explicite. Respecter ces limites.
- Aucun prix, checkout, secret, binding, paiement, email, D1, R2, Worker, DNS, règle Cloudflare ou production n'a été modifié dans P0.36.

## Prochaine action classée
1. **P0 — décision sur le périmètre commercial autorisé** : ne pas commercialiser le bot automatisant le gameplay sans autorisation documentée ; évaluer seulement une offre réellement indépendante du jeu et valider sa demande avant développement.
2. **P0 — paiement** : obtenir un profil Mollie BOT-WOW dédié via l'opérateur du compte ; garder PR #90 draft et attendre autorisation avant toute intégration/déploiement.
3. **P0 — livraison** : après autorisation, certifier Resend, webhook, licence, téléchargement et activation dans un environnement contrôlé ; préparer rollback Worker v50.
4. **P1 — sécurité** : préparer séparément le remplacement de `Math.random()` pour les clés de licence par un RNG cryptographique avec tests, sans déploiement non autorisé.
5. **P1 — entitlements** : résoudre l'écart « une machine » vs `max_activations=2` avant toute vente.
6. **P2 — acquisition** : ne pas acheter de trafic ; les volumes actuels ne démontrent aucune progression d'intention de paiement.


---

# P0.36b — contrôle du domaine www et des redirections — 2026-11-05T02:16Z

## Observation publique comparée
- `https://bot-wow.com/fr/` (ouvert directement) affiche la version actuelle : certains builds tiers sont utilisés pour les tests techniques, cela ne constitue pas une autorisation ; la section de risque précise qu'aucune autorisation Blizzard n'est revendiquée/documentée et qu'il ne faut pas utiliser BOT-WOW avec les services exploités par Blizzard.
- `https://www.bot-wow.com/fr/` (ouvert directement) retourne encore une ancienne copie : « Les serveurs privés sont notre environnement de référence », formule plus permissive, et un avertissement de risque générique. L'extraction `www` n'est donc pas cohérente avec l'apex lors de cette observation.
- `https://www.bot-wow.com/` retourne une copie EN avec le nouvel avertissement explicite.
- `/wow-gold-bot` et `/undetected-wow-bot` ont répondu 404 lors des ouvertures directes. Les résultats de recherche historiques ne sont pas des pages live confirmées.

## Cloudflare — état DNS et règles, lecture seule
- Zone `bot-wow.com` : DNS `www.bot-wow.com` = CNAME `bot-wow.pages.dev`, `proxied=true`, TTL automatique.
- Pages : `bot-wow.com` et `www.bot-wow.com` sont deux custom domains actifs du même projet `bot-wow`.
- Liste des rulesets de zone : aucun ruleset `http_request_dynamic_redirect` présent.
- GET de l'entrypoint `http_request_dynamic_redirect` retourne 404 `could not find entrypoint ruleset`. Il n'existe donc pas actuellement de règle Single Redirect www→apex dans cette phase.
- Les commentaires du fichier `_redirects` et la branche historique `fix/www-alias-redirect-20261104` documentent déjà que Cloudflare Pages `_redirects` ne sait pas cibler un hostname. Cette branche est divergée de main (1 commit ahead / 39 behind) et ne doit pas être réutilisée telle quelle.

## Diagnostic et action requise
- Fait vérifié : le contenu extrait de `www/fr/` diffère de `bot-wow.com/fr/` ; la configuration DNS maintient `www` comme alias Pages distinct ; aucune règle de redirection de zone n'est configurée.
- Cause exacte non prouvée : sans GET HTTP brut depuis un navigateur/terminal avec headers `CF-Cache-Status`, `Age`, `ETag`, `Last-Modified`, il est impossible de distinguer une copie edge périmée d'une autre réponse d'origine/alias. Ne pas affirmer « cache » comme cause.
- Remédiation à préparer, mais non appliquée : créer une Cloudflare Single Redirect au niveau de la zone, source `https://www.bot-wow.com/*`, destination `https://bot-wow.com/:splat`, statut 301, conservation de la query string ; vérifier la non-boucle et les chemins FR/EN ; seulement après validation, envisager le retrait de `www.bot-wow.com` des custom domains Pages.
- Cette modification de production (Redirect Rules / domaine Pages) nécessite une autorisation explicite. Aucun DNS, ruleset, domaine Pages, cache ou déploiement n'a été modifié.

## Priorité
Traiter la consolidation www→apex comme P0 de cohérence et de conformité avant acquisition : une version www/fr plus ancienne peut exposer des avertissements insuffisants même si l'apex est à jour.


---

# P0.36c — consentement des contacts BOT-WOW — 2026-11-05T02:18Z

Lecture seule de `botwow-production.botwow_emails`, agrégation uniquement, aucune adresse lue :
- 12 lignes au total, toutes avec `status='subscribed'` mais `confirmed_at IS NULL` et `unsubscribed_at IS NULL`.
- Source `newsletter` : 6 lignes avec `consent_marketing=1` et `consent_transactional=1` ; 3 lignes avec les deux consentements à 0.
- Sources `diag` et `diag2` : 2 lignes marquées marketing=1 mais non confirmées ; ne pas les traiter comme prospects.
- Source `test` : 1 ligne marquée avec consentements, à exclure.
- Aucun enregistrement ne dispose d'un `confirmed_at` renseigné. Le simple flag de consentement ne prouve pas l'opt-in confirmé.

Toutes les requêtes ont renvoyé `changed_db=false`, `rows_written=0`.
Décision : **aucun email marketing ou transactionnel ne doit être envoyé à partir de cette table tant que le flux de confirmation et les destinataires confirmés ne sont pas démontrés**. Aucun envoi effectué.


---

# P0.37 — revalidation live, D1 et décision commerciale — 2026-11-05T03:13Z

## GitHub — état confirmé
- Branche par défaut : `main`, dernier commit observé `218f0ebba5563e386151bc9d8f6e96c506547c33`.
- PR #89 (ce rapport) : OPEN / DRAFT / mergeable ; HEAD `96dffc1cba22fd04f50f6d1758bb2a419c3df1c9`. Les workflows Validate (`41953975395`) et UI quality / Playwright (`41953975557`) sont maintenant tous deux SUCCESS sur ce HEAD.
- PR #90 : OPEN / DRAFT / mergeable ; HEAD `1f61a451d962fd9d8f3a8464acbdfca25e283032`, 2 fichiers (`worker/index.js`, `tests/payment-flow.test.mjs`). Validate (`41952467280`) et UI quality / Playwright (`41952467153`) sont SUCCESS. Ne pas merger/déployer : le profil Mollie BOT-WOW dédié est absent et le changement touche au chemin de paiement.
- PR #66 demeure OPEN / DRAFT ; son contenu porte un garde-fou et une proposition de pivot, pas une autorisation commerciale.
- La recherche de branches a retourné les branches connues du dépôt, dont plusieurs anciennes branches divergées. Ne pas réutiliser telles quelles `fix/www-alias-redirect-20261104` (1 commit ahead / 39 behind), `p0/prepare-checkout-reopen-20261104` (1 ahead / 20 behind) ni les branches de refonte du checkout/revenue fortement divergées.

## Cloudflare Pages et site public — revalidation qui remplace P0.36b
- Projet Pages `bot-wow`, branche de production `main`, build `node scripts/build-site.mjs _site`.
- Déploiement canonique de production : `54aacb90-1cce-4055-b2ab-f2241afc4792`, commit `218f0ebba5563e386151bc9d8f6e96c506547c33`, statut deploy SUCCESS. Le dernier objet listé comme déploiement est un preview documentaire `5debcc4e`, marqué `is_skipped=true` avec `preview_deployments_disabled` ; il ne remplace pas la production.
- Domaines Pages : `bot-wow.com` et `www.bot-wow.com` actifs. DNS `www.bot-wow.com` = CNAME `bot-wow.pages.dev`, proxied=true.
- **Nouvelle vérification web du 2026-11-05 : la discordance de contenu www/fr décrite en P0.36b n'est plus reproductible dans les pages consultées.** `https://bot-wow.com/`, `https://www.bot-wow.com/`, `https://bot-wow.com/fr`, `https://bot-wow.com/buy`, `https://bot-wow.com/fr/buy.html`, `https://www.bot-wow.com/buy.html` et `https://www.bot-wow.com/fr` présentent désormais les mêmes avertissements de conformité et la même indisponibilité du checkout. Les pages d'achat EN/FR indiquent le prix 20 €, livraison v1.2.0 non confirmée, formulaire désactivé et absence d'autorisation Blizzard documentée.
- Limite : l'outil web ne fournit pas les en-têtes HTTP bruts (CF-Cache-Status, Age, ETag, Last-Modified). La cohérence du contenu visible est vérifiée, mais la réponse edge/origine n'est pas certifiée par curl/Playwright dans ce cycle.
- La zone n'a toujours aucun entrypoint `http_request_dynamic_redirect` (GET renvoie 404 `could not find entrypoint ruleset`). Il n'y a donc pas de 301 www→apex. **Ce n'est plus un P0 de conformité puisque le contenu public consulté est cohérent ; cela reste une amélioration SEO/canonicalisation P1.** Ne pas créer la règle ni retirer le domaine Pages sans autorisation explicite prévue par `AGENTS.md`.
- Références publiques : `https://bot-wow.com/`, `https://bot-wow.com/fr`, `https://bot-wow.com/buy`, `https://bot-wow.com/fr/buy.html`, `https://www.bot-wow.com/`, `https://www.bot-wow.com/fr`, `https://www.bot-wow.com/buy.html`.

## Worker et code source
- Production `botwow-api` : version 50 à 100 %, version ID `c3dcc842-c422-42d3-9828-405f30d70b5f`, déploiement `36227a4d-00e7-4c9f-94e0-0913b29049bc`. Aucun nouveau déploiement.
- Source main `worker/index.js`, blob `725d98e4595b27aa60e88758ecac20c711a38b6b` : `RELEASE_STATUS = "pending"` par défaut ; `handleCheckout` retourne 409 `delivery_unverified` si le statut runtime n'est pas explicitement `confirmed`. La valeur runtime du binding n'est pas visible et n'est pas inférée.
- Source main contient `resumeFulfillment`. La comparaison directe précédente de P0.31 reste la preuve que le bundle v50 ne l'inclut pas ; le bundle n'a pas été re-téléchargé pendant P0.37.
- Défaut de sécurité confirmé dans la source main : les deux fonctions `generateLicenseKey()` et `generateLicenseKey2()` utilisent encore `Math.random()`. Le remplacement par `crypto.getRandomValues()` doit être préparé dans une PR sécurité séparée avec tests, mais n'a pas été modifié ici.
- Écart d'entitlement confirmé : `DEFAULT_MAX_ACTIVATIONS = 2` et les insertions de licences fixent `max_activations=2`, alors que `PRODUCT.md` et les pages EN/FR annoncent une activation sur une machine. Ne pas changer silencieusement cette règle ; clarifier la politique avant toute vente.

## Mollie — lecture seule
- `ListProfiles` retourne un seul profil : `pfl_t8KCk4Cm2C`, site `https://sargasses-martinique.com/`. Aucun profil BOT-WOW dédié visible.
- Ne jamais utiliser le profil Sargasses pour BOT-WOW. Aucun paiement n'a été créé.
- Les 16 paiements Mollie BOT-WOW avaient été vérifiés individuellement dans P0.30 (16/16 expirés) ; pas de nouvel appel sur ces mêmes IDs dans P0.37.

## D1 production et analytics — lecture seule
Toutes les requêtes D1 de ce cycle ont renvoyé `changed_db=false` et `rows_written=0`.
- Commandes inchangées : `bitcoin_manual/paid=5`, `bitcoin_manual/pending_payment=8`, `bitcoin_manual/rejected=1`, `mollie/failed=11` (25 au total). Les cinq lignes Bitcoin `paid` sont les données de test `@example.com`, pas des ventes.
- Licences 5 ; jetons de téléchargement 5 ; livraisons 0 ; activations 0 ; webhooks 16 ; contacts `botwow_emails` 12.
- Contacts : 0/12 avec `confirmed_at` renseigné. Aucun envoi marketing/transactionnel depuis cette table.
- Analytics `test=0`, comptages d'événements (pas utilisateurs/sessions uniques) : `page_view=1694`, `journey_view=672`, `cta_click=48`, `checkout_requested=29`, `checkout_start=4`, `checkout_created=6`, `checkout_failed=6`, `planner_mode=1`. Aucun `payment_confirmed`, `conversion`, `delivery_sent` ou `activation`.
- Dernier `page_view` : `2026-11-05 02:18:43 UTC`; dernier `journey_view` : `02:18:40 UTC`. Dernier `cta_click` et `checkout_requested` : `2026-11-04 02:47:00 UTC`. Dernier `checkout_created` : `2026-10-27 23:07:01 UTC`; dernier `checkout_failed` : `2026-10-27 23:23:17 UTC`.
- Sources observées : `direct` représente 1 075 page views et 568 journeys ; `reddit` 8 page views / 8 journeys ; `yt` 8/8 ; `discord` 6/6 ; `forum` 3/3 ; `google` 1/1 ; les autres événements ont des sources nulles ou `other`. Ce sont des événements bruts, pas des personnes uniques. L'attribution qualifiée reste faible et/ou incomplète ; ne pas acheter de trafic.

## Revenu, conformité et décision
- Revenu commercial BOT-WOW vérifié : **0,00 €** ; aucune vente payée et aucune livraison client démontrée. Prix public observé : 20 € ; checkout toujours fermé.
- Le site dit désormais clairement qu'aucune autorisation Blizzard n'est revendiquée/documentée et déconseille l'utilisation sur les services Blizzard. L'EULA officielle §1.C.2 interdit notamment d'offrir, promouvoir, mettre à disposition ou distribuer des bots non autorisés et des logiciels qui facilitent le gameplay : https://www.blizzard.com/en-us/legal/bfbbb648-bcc6-4b78-a5c7-e2fe20c135df/blizzard-end-user-license-agreement (dernière révision indiquée : 2024-03-21).
- Ne pas commercialiser ni promouvoir l'automatisation du gameplay pour les services Blizzard sans autorisation documentée. La compatibilité technique avec un serveur tiers n'est pas une autorisation générale.
- Aucune modification de prix, checkout, credential, secret, binding, paiement, email, D1/R2, Worker, DNS, ruleset, domaine Pages, cache ou production.

## Prochaine action classée
1. **P0 — périmètre commercial autorisé** : obtenir une autorisation écrite applicable ou définir une offre réellement indépendante du gameplay ; valider la demande avant de développer ou promouvoir.
2. **P0 — paiement/livraison** : profil Mollie BOT-WOW dédié + credential dédié, puis test contrôlé et certification du webhook, de la licence, du mail, du téléchargement et de l'activation ; garder #90 draft et le checkout fermé jusque-là.
3. **P1 — sécurité** : préparer une PR isolée pour le RNG cryptographique des clés de licence ; ne pas déployer sans validation.
4. **P1 — entitlements** : résoudre la contradiction une machine / deux activations.
5. **P1 — SEO** : la consolidation 301 www→apex est optionnelle désormais que le contenu consulté est cohérent ; la préparer séparément avec rollback, sans modifier Cloudflare sans autorisation.
6. **P2 — acquisition** : aucun achat média ; améliorer l'attribution organique seulement après validation d'une offre commercialisable.



---

# P0.41 — Revalidation production, sécurité et cohérence de l'offre — 2026-11-05T06:13Z

## GitHub

- Dépôt : `aveca/bot-wow`.
- `main` : `218f0ebba5563e386151bc9d8f6e96c506547c33`.
- Branches : 83 ; PR ouvertes : 17.
- PR #89 : OPEN / DRAFT / mergeable ; HEAD documentaire `793a8ee6d4204fe994d8acadf0d457577899b96a`. Validate et UI quality/Playwright SUCCESS sur ce SHA.
- PR #90 : OPEN / DRAFT ; HEAD `1f61a451d962fd9d8f3a8464acbdfca25e283032`. Validate et UI quality/Playwright SUCCESS. Le correctif distingue API Keys Mollie et tokens organisationnels ; aucun profil BOT-WOW dédié n'est disponible.
- PR #60 : OPEN / DRAFT, diverged, 8 commits ahead / 76 behind main.
- PR #61 : OPEN / DRAFT, diverged, 13 ahead / 71 behind main.
- Ne pas réutiliser les branches #60/#61 sans reprise minimale sur main actuel et nouvelle CI : elles sont trop anciennes.
- Issues #91, #92, #59 et #13 restent ouvertes. Commentaires de revalidation publiés :
  - #92 : `6651223056` — contradictions exactes Modules/PRODUCT et lacunes de tests.
  - #91 : `6651223572` — le lecteur web retourne maintenant 404 pour quatre routes ; le GET no-cache Factory reste nécessaire pour arbitrer le conflit avec les anciens 200.
  - #59 : `6651240028` — preuve fraîche des logs sensibles dans le Worker actif et état divergé des PR de redaction.
  - #13 : `6651240811` — état actuel du retry et des webhooks orphelins.

## Pages publiques et Pages

- Production Pages : déploiement `54aacb90-1cce-4055-b2ab-f2241afc4792`, commit `218f0eb`, stage deploy SUCCESS, créé le 2026-11-05T00:47:14Z.
- Domaines apex et www associés au même projet.
- `https://bot-wow.com/`, `/buy`, `/fr/buy.html` et `/compatibility.html` consultés : prix affiché 20 €, achat indisponible, paquet v1.2.0 non vérifié, aucun délai de livraison promis, avertissement explicite d'absence d'autorisation Blizzard et de ne pas utiliser les services Blizzard.
- La matrice live indique Classic 1.13 testé ; serveur tiers = test technique uniquement, sans autorisation implicite ; TBC/WotLK/Live non testés/non pris en charge ; combat/BG/quêtes hors périmètre.
- La lecture web des pages `/modules.html` et `/fr/modules.html` échoue dans cet outil. Le défaut source est toutefois confirmé sur main et les deux fichiers sont inclus dans l'artefact Pages.

## Contradictions source confirmées sur main

- `modules.html` (blob `505b07e19770e31fe3edfa7b1b24d65950db6c24`) : `v1.2.0 current release`, `Payment handled by Mollie`, et pêche présentée comme disponible/payée par licence.
- `fr/modules.html` (blob `eca26d528ee61f122ac77b63d40518fb8e91a9bf`) : `v1.2.0 version actuelle`, `Paiement pris en charge par Mollie`, et pêche présentée comme disponible/couverte par la licence.
- `PRODUCT.md` (blob `541766ab8e2a37db59acca98862a6f63a3b2f485`) : annonce Mollie et Bitcoin comme rails de l'offre, e-mail comme livraison, et compatibilité Retail / Classic Era / SoD / majorité des serveurs privés.
- `compatibility.html` (blob `00bd0d178b09e041a1dddbccf94aa4d029ffc8ed`) est plus restrictif : Classic 1.13 testé ; serveur tiers en test technique seulement ; TBC/WotLK/Live non pris en charge.
- `tests/release-availability.test.mjs` couvre homepage, buy, variantes, FAQ et conformité, mais pas Modules ni PRODUCT.md. `tests/modules-parity.test.mjs` valide surtout le JSON du registre et peut être SKIP si le dépôt Python externe est absent.
- Issue #92 contient maintenant les preuves et critères de régression.

## Worker de production — lecture seule

- Worker `botwow-api`, déploiement `36227a4d-00e7-4c9f-94e0-0913b29049bc`, version ID `c3dcc842-c422-42d3-9828-405f30d70b5f`, 100 % du trafic.
- Le script actif téléchargé via l'API Cloudflare ne contient pas `resumeFulfillment`.
- Le bundle actif contient deux appels `Math.random()` pour la génération de clés.
- Le bundle actif journalise encore des e-mails, clés de licence et URL de téléchargement tokenisées dans les helpers legacy, ainsi que des données sensibles dans les notifications et logs de fulfillment.
- Le `main` actuel contient `resumeFulfillment` et des helpers de logs expurgés, mais le chemin de rejet checkout journalise encore la valeur brute `body.amount`.
- PR #60/#61 contiennent des travaux historiques utiles mais sont fortement en retard ; ne pas merger telles quelles.
- Aucun déploiement Worker ni modification de secret/binding. Les changements sécurité et le déploiement attendent l'autorisation explicite requise.

## D1 production — lecture seule

- `bitcoin_manual/paid` : 5, toutes `@example.com` (tests, pas des ventes).
- `bitcoin_manual/pending_payment` : 8.
- `bitcoin_manual/rejected` : 1.
- `mollie/failed` : 11.
- Licences : 5 ; jetons de téléchargement : 5 ; livraisons : 0 ; activations : 0.
- Webhooks : 16 ; marqueurs sans commande correspondante : 5.
- Contacts : 12 ; `confirmed_at IS NOT NULL` : 0.
- Toutes les requêtes ont `changed_db=false`, `rows_written=0`.

## Analytics — événements test=0, pas des utilisateurs uniques

- `page_view` : 1 708 ; dernier événement 2026-11-05T05:52:03Z.
- `journey_view` : 674 ; dernier événement 2026-11-05T03:18:31Z.
- `cta_click` : 48 ; dernier événement 2026-11-04T02:47:00Z.
- `checkout_requested` : 29 ; dernier événement 2026-11-04T02:47:00Z.
- `checkout_start` : 4 ; `checkout_created` : 6 ; `checkout_failed` : 6 (derniers événements le 2026-10-27).
- Aucun événement enregistré `payment_confirmed`, `conversion`, `delivery_sent` ou `activation`.
- Les pages vues continuent d'augmenter, mais aucun nouveau CTA n'est enregistré depuis le 2026-11-04T02:47Z.

## Mollie et revenus

- `ListProfiles` retourne un seul profil vérifié, associé à `sargasses-martinique.com`. Aucun profil BOT-WOW dédié ; ne jamais réutiliser celui d'une autre activité.
- Ventes commerciales payées vérifiées : **0**.
- Revenu commercial confirmé : **0,00 €**.
- Les cinq lignes `paid` sont des commandes de test `@example.com`; aucun paiement commercial n'est démontré.
- Checkout public toujours fermé ; aucune livraison client ni activation démontrée.

## Décision et prochaine action

1. P0 : corriger #92 sur une branche dédiée — Modules EN/FR, PRODUCT.md, tests de disponibilité — puis CI et vérification live après merge autorisé.
2. P0 sécurité : préparer sur main actuel une correction CSPRNG des clés et une redaction du log `body.amount`, avec tests synthétiques ; ne pas merger/déployer sans autorisation.
3. P0 livraison : préparer le déploiement Worker actuel avec preuve de bundle et rollback vers v50 ; ne pas déployer tant que l'autorisation de production n'est pas donnée.
4. P0 conformité : ne pas promouvoir le bot automatisant le gameplay pour les services Blizzard sans autorisation documentée.
5. Ne pas ajouter de redirections anciennes sur la seule base de snapshots ou d'erreurs du lecteur web ; refaire un GET HTTP brut no-cache depuis Factory.

Aucun prix, checkout, paiement, email, secret, binding, D1, R2, DNS, cache, Worker ou production n'a été modifié dans cette revalidation.


---

# P0.42 — R2 list/get discrepancy after documentation merge — 2026-11-05T06:25Z

## Main / production baseline

- Main after PR #89 documentation merge: `25aa9b2033b152a09385c070f405c0e433810017`.
- PR #89 merged by squash; only `reports/operations/BOT-WOW-CURRENT-STATE.md` changed.
- PR #89 Validate and UI quality/Playwright both succeeded on documentation HEAD `e9bedc3bd6ea7e3033fcb9d3d1322aa38c986e8c`.
- Cloudflare Pages production deployment for the merge: `37878628-ded4-4e7d-a80f-1fcaa5571d33`, commit `25aa9b2`, build and deploy SUCCESS. Apex and www aliases active.
- Post-deploy checks of homepage, EN buy, FR buy and compatibility confirm the existing content remains unchanged: price 20 €, checkout unavailable, package delivery unverified, no delivery time promised, and explicit Blizzard platform warning.

## R2 artifact recheck — read-only

Bucket `botwow-binaries`, List Objects returns:
- `casinababe-fishing-1.2.0.zip` — 1,387,543 bytes; ETag `d9d7ab22ec076873b8fed656a53460bc`; last modified `2026-10-27T06:31:06.784Z`.
- `Casinababe-v1.0.38.zip` — 1,229,709 bytes; ETag `b3f54aed8a36547f454c65420684ddc0`; last modified `2026-10-04T01:27:26.941Z`.

Direct R2 API Get Object attempts with `cf-r2-jurisdiction: default` returned HTTP 404 / Cloudflare code 10007, “The specified key does not exist”, for both listed keys. The list/get discrepancy means the object listing alone does not prove the object is readable by the Worker. This integration could not retrieve current object bytes or recompute the SHA-256 in this pass.

Historical verification on 2026-10-28 recorded the v1.2.0 ZIP SHA-256 `1c132f367607ea186feffde8bbda0a1a9f94cdec4b7850b93c57c271270bba4f`, 30 ZIP entries, 26 manifest files, and zero size/hash/CRC mismatches. That is historical evidence, not a fresh byte-level retrieval on 2026-11-05.

The current source provenance and self-contained installation onboarding remain unresolved: issue #18 records that the package cannot be reproducibly rebuilt from the current main source paths and the archive lacks a self-contained dependency/install guide.

## Decision

- Keep the purchase form closed and the release-delivery notice in place.
- Do not describe the fishing module as “available and paid for by licence” until the current R2 object is readable, its bytes/hash/manifest are revalidated, source provenance is reproducible, and post-payment fulfillment is certified.
- Factory must test an independent, already-authorized R2 read path (existing Worker binding or existing S3 credentials only); do not create credentials, deploy a temporary Worker, upload/replace/delete an object, or expose secrets.
- Issue #18 and #92 now contain this evidence and acceptance criteria.
- No R2 write, D1 write, payment, email, secret/binding change, Worker deployment, or price/checkout change occurred.


---

# P0.43 — public module truth and commercial record — 2026-11-05T09:20Z

## Baseline and delivery

- BOT-WOW main at the start of this cycle: `3bb17af9ddfe1cc149e8e55245c05717308d68c7`.
- Branch: `fix/p0.40-modules-product-truth-20261105`.
- Code/content commit: `cd6b972441c1925839654762935636ebc02155c7`.
- Product-context and status-label commit: `d931572b0b3c4672fe54ed3f627887721ea68475`.
- PR #94: https://github.com/aveca/bot-wow/pull/94 — open, not merged; base `main`, head `d931572b0b3c4672fe54ed3f627887721ea68475`.
- The initial PR revision changed six files; the current expanded PR revision changes ten files: `modules.html`, `fr/modules.html`, `PRODUCT.md`, `index.html`, `fr/index.html`, `buy.html`, `fr/buy.html`, `tests/release-availability.test.mjs`, `tests/e2e/demo-quality.spec.mjs`, and this operational report.

## Directly verified source findings

- `assets/modules.json` contains 8 entries: `fish` is marked `available`, three modules are `development` and four are `planned`.
- The fish registry references `scripts/fishing_bot.py` and `scripts/fishing_memory.py`; GitHub Contents API returned 404 for both on current main. The referenced `tests/fishing_bot_test.py`, `tests/run-fishing-harness.mjs`, and optional external `Casinababe/scripts/botwow_modules.py` path are also absent from this repository. The parity test can SKIP when that external source is not configured.
- R2 List Objects returns the v1.2.0 object, but the tested Get Object path returns HTTP 404 / Cloudflare code 10007. Current bytes and SHA-256 are not revalidated. Historical hash data remains historical only.
- Modules EN/FR source previously presented Mollie as active, v1.2.0 as current, and Fishing as shipped/available under licence. The buy pages continue to state checkout closed and delivery unverified. The PR now distinguishes internal registry status from commercial release and removes purchase CTAs from Modules.
- The public module pages now explicitly state that no Blizzard authorization is claimed/documented and advise against use on Blizzard-operated services. This is a disclosure correction, not a legal opinion or permission to market the automation.

## Production and commercial baseline

- Latest Pages production deployment known in this cycle: deployment `845e3e10-e05a-4a68-805a-65971a61add5`, source commit `3bb17af9ddfe1cc149e8e55245c05717308d68c7`, SUCCESS. PR #94 is not deployed; live pages remain the main version until an authorized merge/deploy.
- Worker `botwow-api` remains version 50; no Worker deployment was performed.
- Mollie ListProfiles returned no BOT-WOW profile; an unrelated profile was not reused. PR #90 remains open/draft and does not open checkout.
- D1 production, read-only: 5 Bitcoin `paid` test rows with `example.com` addresses, 8 pending, 1 rejected, 11 Mollie failed; 5 licences, 5 download tokens, 0 deliveries, 0 activations, 16 webhook events, 12 email records and 0 confirmed contacts. These rows do not prove a commercial sale.
- Analytics D1, `test=0`: 1,726 page views, 680 journey views, 48 CTA clicks, 29 checkout requests, 4 checkout starts, 6 checkout created, 6 checkout failed; no payment-confirmed, conversion, delivery or activation events.
- D1 requests were read-only; `changed_db=false`, `rows_written=0`.
- Commercial sales verified: 0. Revenue confirmed: €0.00. Checkout remains closed.

## Validation and limits

- No local Factory environment is connected to this automation runtime, so local npm commands were not run. The new regression assertions are in the PR; GitHub Actions results must be checked on the PR head before any merge decision.
- No price, checkout, payment, secret, binding, D1, R2, Worker, DNS, email, cache or production change was made.
- Repository AGENTS.md explicitly prohibits merging to the default branch or deploying production without explicit authorization. Keep PR #94 open until CI is green and the required authorization is present.

## Next action

- Verify all PR #94 checks on its latest head. Fix any failing regression assertion in the same branch. Do not merge or deploy. After CI is green, retain the PR for review and prioritize recovery of a reproducible, readable release artifact and independent payment/fulfillment readiness.


---

# P0.44 — live purchase-copy reconciliation and CI repair — 2026-11-05T09:45Z

## New public evidence

- The live /buy page was re-opened through the web reader on 2026-11-05. It still described the fishing add-on as shipped with a SHA-256 manifest per file and promised activation on one machine, while separately saying checkout is unavailable and package delivery is unverified. The homepage still repeated the one-machine / licence-resend promise. These are public copy defects, not evidence of a delivered archive or an operational entitlement policy.
- Main source confirms the same claims in buy.html, fr/buy.html, index.html and fr/index.html.
- Backend licenses.max_activations defaults to 2. The meaning and policy are not reconciled with the public one-machine wording. No entitlement rule was changed.

## PR #94 — expanded correction

- Branch: fix/p0.40-modules-product-truth-20261105.
- Current head at this report: 1b3a030759a7e814ce09e511c8898eb17dc74c61.
- PR: https://github.com/aveca/bot-wow/pull/94 — OPEN, not merged, base main at 3bb17af9ddfe1cc149e8e55245c05717308d68c7.
- Ten changed files: Modules EN/FR, Buy EN/FR, homepage EN/FR, PRODUCT.md, release-availability tests, responsive E2E test, and this report.
- Buy EN/FR now describes add-on presence and per-file manifest as unverified, removes the public Casinobabe addon component label, and states that machine limits/licence re-sending are not confirmed.
- Homepage EN/FR removes the one-machine and re-send promises while entitlement configuration is unresolved.
- Modules EN/FR distinguish internal registry labels from commercial availability, remove Mollie as an active payment claim, and link to purchase status rather than presenting an active purchase CTA.
- PRODUCT.md distinguishes intended terms, code integration, operational payment, registry status and verified delivery.

## CI and fixes

- Initial PR head 113194e021392765181515a2115981101b8d307e: Validate SUCCESS; UI quality failed on mobile because the test selected a hidden desktop navigation duplicate. Fixed by selecting a visible purchase-status link in tests/e2e/demo-quality.spec.mjs.
- Head 8d0ebc0a31bd98b16d48430deef02d28eb3ee815: Validate failed on one stale Licence re-sent on request if you reinstall claim in the homepage; the other new availability assertions passed. That final claim was corrected in index.html.
- Current head 1b3a030759a7e814ce09e511c8898eb17dc74c61: Validate Bot-Wow SUCCESS; UI quality / Playwright was still IN PROGRESS when this addendum was written. Do not merge until both required workflows are SUCCESS on the exact latest head.
- No local Factory runtime is connected to this automation session; no local npm test result is claimed.

## Production and commercial recheck

- Cloudflare Pages production remains deployment 845e3e10-e05a-4a68-805a-65971a61add5, source main commit 3bb17af9ddfe1cc149e8e55245c05717308d68c7, deploy SUCCESS. The PR branch preview is skipped because preview deployments are disabled. PR #94 has not been deployed.
- Worker botwow-api remains version 50, version ID c3dcc842-c422-42d3-9828-405f30d70b5f, deployment 36227a4d-00e7-4c9f-94e0-0913b29049bc, 100% traffic. No Worker deployment.
- Mollie ListProfiles returned one profile not belonging to BOT-WOW. No BOT-WOW profile exists in the returned list; do not reuse another activity's profile.
- D1 production, read-only: orders bitcoin_manual/paid=5, bitcoin_manual/pending_payment=8, bitcoin_manual/rejected=1, mollie/failed=11; all five paid rows are @example.com test rows; commercial paid rows with non-example addresses = 0. Licences 5; downloads 5; deliveries 0; activations 0; webhook events 16, of which 5 have no matching Mollie order; email records 12, confirmed 0.
- Analytics D1, events with test=0: page views 1,750; journeys 692; CTA clicks 48; checkout requests 29; checkout starts 4; checkout created 6; checkout failed 6; no payment-confirmed, conversion, delivery-sent or activation events. Last page view: 2026-11-05T09:40:31Z; last journey: 09:40:27Z; last CTA and checkout request: 2026-11-04T02:47:00Z. These are event counts, not unique users.
- All D1 queries returned changed_db=false and rows_written=0.
- Commercial paid sales verified: 0. Revenue confirmed: €0.00. Checkout remains closed.

## Next action

1. Wait for UI quality / Playwright to finish on the exact current PR #94 head. If it fails, fix only the demonstrated regression and rerun CI.
2. Once all required checks are SUCCESS and the head is unchanged, merge PR #94 by squash under the user's standing authorization for reversible, non-sensitive static changes; the prior production deployment 845e3e10-e05a-4a68-805a-65971a61add5 is the rollback reference.
3. Verify Cloudflare Pages production and EN/FR homepage, Modules and Buy pages after merge. Do not change checkout, price, Worker, payment credentials, D1/R2, email or platform-compliance scope.
4. Keep the checkout closed until package provenance/readability, authorization scope, dedicated payment profile and end-to-end fulfillment are independently verified.


## P0.44 follow-up — homepage naming consistency — 2026-11-05T09:44Z

- The homepage EN/FR still named the fishing add-on after a separate product brand, even though the offer is BOT-WOW. The intended component remains unverified, so the public copy now calls it a fishing add-on and explicitly says its presence in the current archive is unverified.
- The homepage EN/FR changes are in commits 391c454d6d70907dabef6b41bea9b9ca6948c7ca and b52c76684559b77ad9aa60ce1c5142d9148cf149. Regression coverage was added in b90792236f67acc82954b81ecea24360c2e5e774.
- The branch head immediately before this report append was b90792236f67acc82954b81ecea24360c2e5e774. Validate and UI quality workflows were queued/in progress; no result is claimed here.
- No product, price, checkout, payment, Worker, D1, R2, DNS, cache or email configuration was changed.


## P0.44 follow-up — remove residual machine-bound wording — 2026-11-05T09:44Z

- The homepage EN/FR still said the licence was tied to the user's machine, which could imply a confirmed machine entitlement. It now says activation limits remain under verification. No entitlement or backend rule was changed.
- Page commits: index.html bdfe8a9886ed9763ad2ad617eb0ae8d50a96cb6f; fr/index.html 74b7e9e25c970b1adf69443fc0127964cda048a7. Regression-test commit: 2afc9e4bd1d97c0be7e47a057243071f6564775d.
- Branch head immediately before this report append: 2afc9e4bd1d97c0be7e47a057243071f6564775d. CI for this exact head had not yet appeared when this note was written.


## P0.44 final copy check — package contents on homepage — 2026-11-05T09:45Z

- Final review found one remaining unqualified homepage bullet claiming the add-on and packaged build included a SHA-256 manifest. It now states that these are intended components and the current archive/manifest are not verified.
- Page commit: 4c354a566c67ee2f48dfcbc4af8bb1a534974909. Regression-test commit: 408f6595ec626c2e1a797269767f503b26ebddbb.
- Branch head immediately before this report append: 408f6595ec626c2e1a797269767f503b26ebddbb. CI for this exact head had not yet appeared when this note was written.


---

# P0.48 — fresh PR, live funnel and payment revalidation — 2026-11-05T14:08Z

## GitHub state

- Repository: `aveca/bot-wow`; default branch `main`.
- Main HEAD: `3bb17af9ddfe1cc149e8e55245c05717308d68c7`.
- PRs open at this check: 17.
- PR #71 is already merged (merge SHA `084e2bd3785526835e678f70b77699a8f838d16a`); no further unblock action is needed there.
- PR #94 remains OPEN, not merged, base `main`, head `3a2c7a408ca174b6266b92f2e1624343e758a600`, 24 commits ahead / 0 behind, 10 changed files.
- PR #94 Validate run `42004943834`: SUCCESS.
- PR #94 UI Quality run `42004943771`: FAILURE; job `127169532730`, 156 passed / 2 failed.
- Playwright failures: Modules EN at 391px viewport has document scrollWidth 481px; Modules FR at 391px has scrollWidth 534px. The PR changed-file list does not include `assets/components.css`; no CSS correction is present in this HEAD.
- PR #90 remains OPEN / DRAFT and diverged from main: 2 ahead / 2 behind, merge base `218f0ebba5563e386151bc9d8f6e96c506547c33`.
- PR #66 remains OPEN / DRAFT and diverged: 3 ahead / 42 behind. Do not merge this stale branch.

## PR #94 branch copy gaps

The branch still contains:
- `fr/index.html`: “Licence réexpédiée sur demande si vous réinstallez”.
- `docs/license.html`: one-machine entitlement claims.
- `faq.html`: “one machine per licence”.
- `fr/faq.html`: lost-key resend promise.

`tests/release-availability.test.mjs` does not cover the licence documentation or the two FAQ files; its French homepage resend pattern does not match “Licence réexpédiée”. These are confirmed regression-test gaps. A comment with exact evidence was updated on PR #94 (comment `6660138552`).

## Public production — live pages inspected 2026-11-05

- Pages production deployment: `845e3e10-e05a-4a68-805a-65971a61add5`, commit `3bb17af9ddfe1cc149e8e55245c05717308d68c7`, deploy SUCCESS at `2026-11-05T06:30:21Z`.
- EN home `https://bot-wow.com/` still shows machine-bound licence / resend copy and purchase CTAs while stating delivery is unverified.
- FR home `https://bot-wow.com/fr/` still shows “Licence réexpédiée sur demande” and machine-bound wording while stating delivery is unverified.
- EN Buy `https://bot-wow.com/buy` still claims the Casinobabe add-on is shipped with a per-file SHA-256 manifest and one-machine activation; the same page says delivery is unverified and checkout unavailable.
- FR Buy `https://bot-wow.com/fr/buy` contains the same contradictions.
- EN Modules `https://bot-wow.com/modules` still says “v1.2.0 current release”, “Payment handled by Mollie”, and fishing is available/paid by licence; its footer uses “within the rules of the server you play on”.
- FR Modules `https://bot-wow.com/fr/modules` still says “v1.2.0 version actuelle”, “Paiement pris en charge par Mollie”, and fishing is available/couvert par la licence; its footer uses equivalent server-rules wording.
- These are live-production facts. PR #94 changes are not deployed.

## Cloudflare Worker and source

- Active Worker `botwow-api`: version 50, version ID `c3dcc842-c422-42d3-9828-405f30d70b5f`, deployment `36227a4d-00e7-4c9f-94e0-0913b29049bc`, 100% traffic, created `2026-10-27T07:46:28Z`.
- Current `main/worker/index.js` still contains two `Math.random()` uses in licence-key generation, logs raw `body.amount` on the rejected-client-amount path, and defaults `RELEASE_STATUS` to `pending`.
- Current main source includes `resumeFulfillment`; that does not prove the active v50 bundle contains it. No Worker deployment occurred.

## D1 production — read-only, 2026-11-05 14:08Z

All queries returned `changed_db=false`, `rows_written=0`.

- Orders: Bitcoin manual / paid 5; Bitcoin manual / pending_payment 8; Bitcoin manual / rejected 1; Mollie / failed 11.
- All 5 paid Bitcoin rows have email domain `example.com`; they are test data, not commercial sales.
- The 8 pending rows comprise 7 Gmail and 1 example.com domain; pending is not revenue.
- The 11 failed Mollie rows comprise 10 `bot-wow.fr` and 1 `test.fr` domain.
- Licences: 5 active, each configured with `max_activations=2`; this does not establish a two-device contractual entitlement.
- Deliveries: 0 rows. Activations: 0. Webhook records: 16.
- Email contacts: 12; confirmed: 0. No email was sent.

## Analytics D1 — read-only, test=0

- `page_view`: 1,780; latest `2026-11-05T13:37:50.348Z`.
- `journey_view`: 706; latest `2026-11-05T13:32:19.951Z`.
- `cta_click`: 48; latest `2026-11-04T02:47:00.736Z`.
- `checkout_requested`: 29; latest `2026-11-04T02:47:00.719Z`.
- `checkout_start`: 4; `checkout_created`: 6; `checkout_failed`: 6.
- No `payment_confirmed`, `conversion`, `delivery_sent`, or `activation` events were returned.
- These are event counts, not unique visitors or sessions.

## Mollie — read-only

- `ListProfiles` returns one verified profile on a different domain; no BOT-WOW-specific profile is present.
- Do not reuse another activity's profile. No payment was created.

## Platform scope

- Official Blizzard EULA search result (current page, last revised 2024-03-21) §1.C.2 explicitly includes creating, using, offering, promoting, advertising, making available and distributing unauthorized bots and software that changes/facilitates gameplay.
- Official Anti-Cheating Agreement describes unauthorized third-party software that enables/facilitates botting or gameplay.
- No applicable authorization is documented for BOT-WOW. This is a platform-contract risk assessment, not legal advice.
- The manual WoW-specific planner proposed in PR #66 is not automatically a compliant safe harbour; a genuinely game-agnostic, non-client-interacting product would need separate scope and demand validation. A comment was added to PR #66 (comment `6660159108`).

## Commercial decision

- Commercial paid sales verified: **0**.
- Commercial revenue confirmed: **€0.00**.
- Checkout remains unavailable publicly; do not open it.
- Do not promote the current gameplay-automation offer for Blizzard-operated services without applicable authorization.
- No price, checkout rule, payment, email, secret, binding, D1/R2, Worker, DNS, cache, or production mutation occurred in this run.
- R2 bytes were not re-requested because the last documented authorized Get path returned 404 / code 10007 and no new read credential/path became available; historical SHA remains historical, not a fresh verification.

## Next action

1. Finish PR #94: instrument the two mobile overflow failures, correct the real overflowing element, and extend copy tests to licence docs + FAQs + all public Modules claims.
2. Keep PR #94 unmerged until Validate and UI Quality both pass on the same SHA.
3. After the static PR is safe to ship, decide whether to pause the legacy bot offer or pursue a genuinely game-agnostic fishing-planner pivot; do not label the existing WoW-specific manual planner compliant.
4. Only revisit R2/Mollie/payment once there is a commercially authorized, deliverable product scope.

No local Factory/npm/Playwright execution is claimed in this connector-only run.


---

# P0.49 — targeted copy, licence and responsive corrections — 2026-11-05T15:55Z

## GitHub / PR
- Main remains `3bb17af9ddfe1cc149e8e55245c05717308d68c7`.
- PR #94 remains OPEN, base main, branch `fix/p0.40-modules-product-truth-20261105`; latest known head after this report update: `0b8370cfe861ada7d95cdb2b2b5357b6f488a270`.
- PR #94 contains 15 changed files; no merge occurred.
- PR #71 remains merged (merge SHA `084e2bd3785526835e678f70b77699a8f838d16a`).

## Changes made on PR #94 branch through GitHub contents API
- `fr/index.html`: removed the unverified French licence re-send promise and replaced it with an explicit non-confirmation.
- `docs/license.html` and `docs/fr/license.html`: removed one-machine, fingerprint, machine-change, reactivation and key-re-send guarantees; now state that activation/recovery terms are unverified and checkout is closed.
- `faq.html` and `fr/faq.html`: removed one-machine entitlement and guaranteed key resend; the €20 amount is described only as the intended price, not as an available offer.
- `tests/release-availability.test.mjs`: added regression assertions for both licence documents, both FAQs and the French homepage.
- `assets/components.css`: added a narrow-screen layout for the Modules status bands: wrap the badge/descriptor, hide only the decorative divider, and allow the descriptor to wrap.
- `tests/e2e/demo-quality.spec.mjs`: the overflow assertion now includes the top overflowing DOM elements in its failure message; the viewport threshold remains unchanged.

## CI findings and correction
- Previous run on head `491132fb06fc1bfdd780ce437acc08e7b3590413`: Validate and UI Quality both failed.
- Exact Validate/UI failure: `SyntaxError: Identifier 'licenceTruthCases' has already been declared` in `tests/release-availability.test.mjs`.
- Cause: the same regression block was appended twice. The duplicate block was removed in commit `0b8370cfe861ada7d95cdb2b2b5357b6f488a270`.
- The latest CI run for the corrected head had not appeared at the time of this report. The earlier Playwright overflow evidence remains 156 passed / 2 failed at 391px (EN scrollWidth 481px; FR 534px). The new CSS fix is not yet certified until the new UI workflow passes.
- No local Factory/npm execution is claimed; CI is the actual test runner used in this connector-only cycle.

## Production / Pages
- Latest Cloudflare Pages production deployment remains `845e3e10-e05a-4a68-805a-65971a61add5`, source main commit `3bb17af9ddfe1cc149e8e55245c05717308d68c7`, deploy SUCCESS at `2026-11-05T06:30:21Z`.
- PR #94 is not deployed.
- A fresh web crawl of `https://bot-wow.com/buy` still shows the old add-on/manifest and one-machine/key-resend claims while the checkout notice says delivery is unverified and checkout is unavailable. The crawler output is not a raw HTTP/header capture; source and Pages deployment evidence remain authoritative for deployment identity.
- The public buy page explicitly says not to purchase until delivery is confirmed; no checkout was attempted.

## Worker / integrations
- Active Worker `botwow-api` remains version 50, version ID `c3dcc842-c422-42d3-9828-405f30d70b5f`, 100% traffic. No Worker deployment.
- Mollie `ListProfiles`: one verified profile exists on a non-BOT-WOW domain; no BOT-WOW-specific profile. No payment created.

## D1 production — fresh read-only query
- Every query returned `changed_db=false`, `rows_written=0`.
- Orders: Bitcoin manual paid 5 (all test-domain); pending 8 (7 other-domain, 1 test-domain); rejected 1 (test-domain); Mollie failed 11 (10 other-domain, 1 test-domain).
- Licences: 5 active, each `max_activations=2`; this does not establish a two-device entitlement.
- Deliveries: 0 rows. Activations: 0. Webhook records: 16.
- Email contacts: 12; confirmed: 0. No email was sent.

## Analytics — fresh read-only query, test=0
- `page_view`: 1,789; latest timestamp `1793892111648` ms.
- `journey_view`: 711; latest timestamp `1793892111653` ms.
- `cta_click`: 48; last recorded `2026-11-04T02:47:00.736Z`.
- `checkout_requested`: 29; `checkout_start`: 4; `checkout_created`: 6; `checkout_failed`: 6.
- No `payment_confirmed`, `conversion`, `delivery_sent` or `activation` events.
- These are event counts, not unique visitors or sessions.

## Commercial status
- Verified commercial paid sales: **0**.
- Confirmed commercial revenue: **€0.00**.
- Checkout remains closed. No price, checkout rule, payment, email, secret, binding, Worker, DNS, D1/R2 or production mutation occurred.
- No applicable authorization for distributing/promoting the current gameplay-automation product is documented. This is a platform-contract risk, not a legal opinion.
- Next: inspect CI for head `0b8370c`; fix any test failures; confirm whether the mobile band CSS resolves the two overflow cases; only then consider static merge/deployment under the existing policy and rollback. Keep checkout and Worker untouched.


---

# P0.49 — merge and Pages deployment closure — 2026-11-05T16:00Z

## Merge and CI
- PR #94 was squash-merged at `2026-11-05T15:58:10Z`.
- PR head: `63b4e707935e0e6589745154d140aa3daac892eb`.
- Merge commit / new main: `6bae1bbf200bff8fbcab7637162b6dc2f587bb08`.
- PR #94: CLOSED / MERGED; 15 files changed.
- GitHub Actions on the exact PR head: Validate Bot-Wow run `42059527469` SUCCESS; UI Quality run `42059527342` SUCCESS.
- Playwright: **158 passed**; both `modules-en` and `modules-fr` passed. Release-availability regression output: `RELEASE AVAILABILITY : OK`.
- An intermediate CI failure on `491132f` was a duplicate `licenceTruthCases` declaration; the duplicate was removed in `0b8370c` before the successful final run.

## Merged changes
- EN/FR homepage, Buy, Modules, FAQ and licence documentation now distinguish intended scope from verified package/payment/delivery availability.
- Removed unverified one-machine, activation, reactivation and key-resend promises from the affected pages and documentation.
- The €20 amount remains the intended price only; no price was changed and no purchase is available.
- Modules status bands wrap on narrow screens; Playwright now reports overflowing DOM elements on any future failure.
- Regression tests cover the EN/FR licence documents, FAQs and French homepage.
- No Worker, payment logic, checkout rule, secret, binding, D1/R2 object, email, DNS or price mutation.

## Cloudflare Pages deployment
- Production deployment: `376230c1-b8e2-4d7b-8ada-f368b0f6e6d3` (`376230c1`).
- Source commit: `6bae1bbf200bff8fbcab7637162b6dc2f587bb08`.
- Build and deploy stages: SUCCESS; completed `2026-11-05T15:58:35.140784Z`.
- Previous successful deployment retained for rollback: `845e3e10-e05a-4a68-805a-65971a61add5`.
- Content verification limitation: a fresh web crawl of `https://bot-wow.com/buy.html` still returned the older add-on / one-machine / licence-resend copy while also showing checkout unavailable. Direct no-cache fetch attempts from the connector runtime returned HTTP 403, and the Pages preview host was inaccessible to the web reader. Therefore deployment identity and build success are verified, but exact edge-served HTML after propagation is **not yet independently verified**. Do not claim every public page's text is confirmed live until a browser/HTTP check succeeds.

## Fresh commercial snapshot (read-only)
- Orders: 5 Bitcoin `paid`, all test-domain; 8 Bitcoin `pending_payment`; 1 Bitcoin `rejected`; 11 Mollie `failed`.
- Licences: 5 active, `max_activations=2`; this is not proof of a two-device entitlement.
- Deliveries: 0; activations: 0; webhook records: 16; contacts: 12, confirmed: 0.
- D1 reads: all `changed_db=false`, `rows_written=0`.
- Analytics `test=0`: 1,789 page views; 711 journey views; 48 CTA clicks; 29 checkout requests; 4 starts; 6 created; 6 failed; no payment-confirmed, conversion, delivery-sent or activation events. Latest page/journey events: `2026-11-05T15:21:51Z`.
- Mollie `ListProfiles`: one verified profile on a non-BOT-WOW domain; no dedicated BOT-WOW profile.

## Final commercial state
- Commercial paid sales verified: **0**.
- Confirmed revenue: **€0.00**.
- Checkout remains closed. Worker `botwow-api` remains v50; no Worker deployment.
- No documented authorization for commercial distribution of the current gameplay-automation scope. This is a platform-contract risk, not a legal opinion.
- Next action: verify exact edge-served EN/FR pages through a real browser/HTTP path; then resolve the commercial scope and package provenance before any payment work. Keep checkout closed.


---

# P0.50 — truthful availability across the public EN/FR funnel (2026-11-05)

## GitHub snapshot
- Default branch: `main` at `b7d9cc77508b1a5d7a131ac664b240739a3be66d`.
- PR #94 is merged; merge SHA `6bae1bbf200bff8fbcab7637162b6dc2f587bb08`.
- PR #95: `https://github.com/aveca/bot-wow/pull/95`, branch `fix/p0.50-homepage-purchase-status-20261105`.
- Code head before this report-only commit: `7ce88d66529c16fe0f9734afdef3025499fde235`.
- PR #95 is OPEN and mergeable; no merge performed in this snapshot.
- Validate run `42066782919`: SUCCESS on code head `7ce88d66529c16fe0f9734afdef3025499fde235`.
- UI Quality run `42066776057`: pending/in progress at snapshot time on the same code head. Do not merge until UI Quality succeeds on the final PR head.

## Changes in PR #95
- Home, Buy and Comparison pages EN/FR now use availability/status CTAs rather than immediate buy-now labels while checkout is closed.
- The €20 amount remains unchanged and is labelled as a documented target price, not a currently purchasable offer.
- Comparison pages no longer claim an active Mollie profile, a one-machine activation promise, a licence resend, or a shipped module; the comparison calculator is explicitly illustrative.
- Comparison copy states that third-party technical compatibility is not authorization and that no Blizzard authorization is claimed or documented.
- Modules status links use secondary styling rather than the purchase-gold treatment.
- All six Home/Buy/Comparison forms clarify that no email is submitted while checkout is closed.
- The form's existing disabled-button guard remains unchanged; Playwright coverage now checks that pressing Enter cannot submit while closed.
- Status CTA IDs are distinct from purchase-intent IDs so availability checks remain `cta_click`, not `checkout_requested`.
- Static regression tests cover Home, Buy, Comparison and Modules EN/FR; Playwright covers status navigation and closed-form submission.

## Verification and production
- GitHub Validate passed on the code head above. UI Quality had not completed at snapshot time.
- No local Factory runner was available in this execution; no local npm/Playwright run is claimed.
- Production Pages remains deployment `33468888-aee7-40d5-9ba6-c92a42204e68`, source commit `b7d9cc77508b1a5d7a131ac664b240739a3be66d`, SUCCESS.
- Branch preview deployment is skipped because preview deployments are disabled. PR #95 is not live.
- Previous production deployment `33468888-aee7-40d5-9ba6-c92a42204e68` is the rollback target until a new production deployment is confirmed.
- Worker `botwow-api` remains version 50, version ID `c3dcc842-c422-42d3-9828-405f30d70b5f`, 100% traffic. No Worker deployment or configuration mutation.

## Fresh read-only commercial snapshot
- Orders: 5 Bitcoin `paid`, all `@example.com`; 8 Bitcoin `pending_payment`; 1 Bitcoin `rejected`; 11 Mollie `failed`.
- Paid orders outside the test domain: 0. These five paid rows are test data, not sales.
- Licences: 5 active; configured activation slots total 10. This does not establish a two-device entitlement.
- Downloads: 5; deliveries: 0; activations: 0; webhook events: 16.
- Contacts: 12; confirmed: 0.
- All production D1 reads: `changed_db=false`, `rows_written=0`.
- Analytics `test=0`: 1,804 page views; 719 journey views; 48 CTA clicks; 29 checkout requests; 4 checkout starts; 6 checkout created; 6 checkout failed; 0 payment-confirmed, conversion, delivery-sent or activation events.
- Latest page-view event: `2026-11-05T16:33:46Z`. Latest CTA click remains `2026-11-04T02:47:00Z`.
- Mollie ListProfiles returned no dedicated BOT-WOW profile. No payment was created.

## Remaining blockers and next action
- Confirm UI Quality on the final PR #95 head. If green, inspect the final diff, squash-merge the static reversible changes under the existing deployment authorization, then verify the new Cloudflare Pages production deployment and every affected EN/FR URL. If red, fix only the failing assertion or page defect.
- Do not open checkout or change payment rules. Package R2 Get last returned HTTP 404 / 10007; no new authorized retrieval path was established in this cycle. Package provenance remains unverified.
- No applicable authorization for the current gameplay-automation scope is documented. Keep checkout closed pending a defensible commercial scope or applicable authorization.
- Confirmed commercial paid sales: **0**. Confirmed revenue: **€0.00**.


---

# P0.51 — mobile status-navigation regression corrected; CI green — 2026-11-05

## GitHub / PR #95
- Repository: `aveca/bot-wow`; default branch remains `main` at `b7d9cc77508b1a5d7a131ac664b240739a3be66d`.
- PR #95: `https://github.com/aveca/bot-wow/pull/95`; branch `fix/p0.50-homepage-purchase-status-20261105`; base `main`; latest tested head before this report-only update: `b5b4f18d5682ad89ceefcfcbbd4d2146c072c001`.
- PR #95 remains OPEN, non-draft, mergeable; no merge or production deployment occurred in this snapshot.
- Current PR diff: 13 files; Home/Buy/Comparison EN/FR purchase-status copy, Modules status styling, regression tests and this report. No Worker/payment/backend file changed.
- 86 branch names were returned by the current branch search (cursor indicates branch search pagination); 17 open PRs were returned. Relevant open PRs: #95, #90 (draft Mollie credential routing), #66 (draft compliance/pivot). PR #71 is already merged and is not an outstanding task.

## CI — exact tested SHA
- Earlier UI run `42067255815` failed with 162 passed / 2 failed. Both failures were the same assertion on mobile EN/FR Buy pages: the test expected `nav-status` to be visible at 391px.
- Root cause confirmed in existing `assets/site.css`: `@media(max-width:520px){.nav-right .btn{display:none}}`. The header CTA is intentionally hidden in the compact mobile header; the hero status CTA remains visible.
- Targeted test-only correction in `tests/e2e/demo-quality.spec.mjs`, commit `b5b4f18d5682ad89ceefcfcbbd4d2146c072c001`: assert the nav link is attached; expect it hidden at viewport widths <=520px and visible above that breakpoint; continue requiring the hero status CTA visible at every viewport.
- Validate run `42079166109`: SUCCESS on the exact tested SHA.
- UI Quality run `42079166107`: SUCCESS on the exact tested SHA.
- Real-browser Playwright: **164 passed, 0 failed**. Both EN and FR blocked-purchase tests pass in desktop and mobile projects.
- CI logs also report the optional Python planner check skipped because `ModuleNotFoundError: No module named 'fishing_spots'`. This does not fail the static/UI workflow, but Python runtime parity was not independently validated by this CI run.
- No local Factory/npm/Playwright execution is claimed; the evidence above is from GitHub Actions.

## Public production / Pages
- Cloudflare Pages project `bot-wow`: production branch `main`; preview deployment setting `none`; build command `node scripts/build-site.mjs _site`, output `_site`.
- Latest production deployment remains `33468888-aee7-40d5-9ba6-c92a42204e68`, source commit `b7d9cc77508b1a5d7a131ac664b240739a3be66d`, build/deploy SUCCESS. The latest PR branch preview is skipped because preview deployments are disabled.
- Public crawl still sees the old main content, as expected while PR #95 is unmerged: homepage still contains buy/lifetime claims; Buy EN still shows the old add-on/manifest, one-machine, key-resend and email-for-key copy; comparison EN still displays Mollie/lifetime/server-rules claims. References: `https://bot-wow.com/`, `https://bot-wow.com/buy.html`, `https://bot-wow.com/compare.html`. This is a production/source-version gap, not evidence that PR #95 failed to build.
- No Pages deployment, cache purge or DNS mutation occurred in this snapshot. Rollback reference remains deployment `33468888-aee7-40d5-9ba6-c92a42204e68` until a newer production deployment is confirmed.

## Worker / payment integrations
- Active Worker `botwow-api`: deployment `36227a4d-00e7-4c9f-94e0-0913b29049bc`, version `c3dcc842-c422-42d3-9828-405f30d70b5f`, 100% traffic; unchanged.
- Mollie `ListProfiles` returned one verified profile on `https://sargasses-martinique.com/`; no BOT-WOW-specific profile is visible. Never reuse the other activity's profile. No payment was created.

## D1 production — read-only, 2026-11-05
- All queries: `changed_db=false`, `rows_written=0`.
- Orders: Bitcoin manual `paid=5`, `pending_payment=8`, `rejected=1`; Mollie `failed=11`.
- All five `paid` rows use `example.com`; they are test records, not customer sales. Their stored amount sum is 10,000 minor units, also not revenue.
- Licences: 5; all five have `max_activations=2` (not proof of a two-device entitlement). Downloads: 5. Deliveries: 0. Activations: 0. Webhook records: 16. Email contacts: 12; confirmed: 0.
- No email sent, no payment created, no production data written.

## Analytics D1 — read-only, `test=0`
- `page_view=1,818` (latest `2026-11-05T16:45:19.687Z`).
- `journey_view=726` (latest `2026-11-05T16:45:16.779Z`).
- `cta_click=48`; latest remains `2026-11-04T02:47:00.736Z`.
- `checkout_requested=29`; `checkout_start=4`; `checkout_created=6`; `checkout_failed=6`.
- No `payment_confirmed`, `conversion`, `delivery_sent` or `activation` events.
- These are event counts, not unique visitors or sessions. Page/journey events increased; purchase intent did not.

## Commercial / compliance decision
- Verified commercial paid sales: **0**.
- Confirmed commercial revenue: **€0.00**.
- Public checkout remains closed. No dedicated BOT-WOW payment profile; no delivery or activation records.
- No applicable authorization for the current gameplay-automation scope is documented. Do not promote or sell that scope on Blizzard-operated services; a manual WoW-specific planner is not automatically a safe harbour.
- No price, checkout rule, payment, email, secret, binding, D1/R2 object, Worker, DNS, cache or production mutation occurred.

## Next action
1. Re-check CI after this report commit on the new final PR head; require Validate and UI Quality green on that same SHA.
2. Review the complete PR #95 diff, then merge/deploy only under the user's standing authorization for reversible static changes with a verified rollback. Do not open checkout.
3. After any Pages deployment, verify the exact source commit and all EN/FR Home, Buy, Comparison and Modules pages through a live HTTP/browser path. Preview deployments are disabled.
4. Resolve the commercial/platform scope and authentic package delivery before any payment work. Keep Worker v50 untouched until a separate authorized security/deployment task.


---

# P0.52 — PR #95 merged, Pages deployment and live funnel revalidation — 2026-11-05T18:57Z

## GitHub
- Repository: `aveca/bot-wow`; default branch `main`.
- PR #95 was squash-merged at `2026-11-05T18:55:44Z`.
- Merge SHA / new main: `573cc1298223980eade0be67f5aba45af6716787`.
- PR head: `f7c9ce5e32c60dc564f9ccf4ea9fdb4bd6c30696`.
- Validate run `42079682256`: SUCCESS on the exact final PR head.
- UI Quality run `42079682316`: SUCCESS on the exact final PR head; Playwright log confirms **164 passed, 0 failed**.
- PR #95 changed 13 files. No Worker, payment logic, price, checkout rule, secret, binding, D1/R2 object or email behavior was changed.
- Open PR count after merge: 16. Relevant remaining PRs: #90 (draft Mollie credential routing), #66 (draft compliance/pivot); #71 and #94 are already merged.

## Cloudflare Pages
- Canonical production deployment: `9f9e0e84-60dc-4d64-9b70-e01ab1ec40fc`.
- Source branch: `main`; source commit: `573cc1298223980eade0be67f5aba45af6716787`.
- Build SUCCESS; deploy SUCCESS at `2026-11-05T18:56:26Z`.
- Production URL: `https://9f9e0e84.bot-wow.pages.dev`.
- Previous deployment retained for rollback: `33468888-aee7-40d5-9ba6-c92a42204e68`.
- Worker remains separate and unchanged.

## Public crawl after deployment
- Fresh web-reader output shows the new purchase-status copy on EN homepage, FR homepage, EN Buy, EN Modules and FR Modules.
- The reader still returns old copy on FR Buy and EN/FR Comparison, including old buy/lifetime/Mollie labels. GitHub `main` source for all three files contains the new status copy and the successful Pages deployment identifies the exact merge SHA. The web reader does not expose raw response headers or a reliable cache-bypass path here; therefore the cause may be crawler cache or route/edge propagation and is **not yet determined**. Do not claim all public routes are independently verified live.
- The deployment-specific `pages.dev` host was not readable by the web reader. No cache purge or DNS change was attempted.

## New residual homepage defect found in the merged source
- `index.html` and `fr/index.html` still contained the journey tab labels “Automate my fishing” / “Automatiser ma pêche”, plus a comparison row claiming “€20 lifetime — no renewal” / “20 € à vie — pas de renouvellement”.
- These strings conflict with the current unavailable status and unnecessarily present the gameplay-automation action as an active CTA.
- A targeted follow-up branch `fix/p0.52-homepage-residual-offer-claims-20261105` replaces them with neutral scope-discovery labels and a target-price/unavailable statement, and adds static regression assertions. No product behavior or checkout logic is changed.

## D1 production — read-only
- All queries returned `changed_db=false`, `rows_written=0`.
- Orders: Bitcoin manual `paid=5`, `pending_payment=8`, `rejected=1`; Mollie `failed=11`.
- Paid non-test rows: **0**; all five `paid` rows use `@example.com`.
- Licences: 5; downloads: 5; deliveries: 0; activations: 0; webhook records: 16.
- Email contacts: 12; confirmed: 0. No email was sent and no database row was written.

## Analytics D1 — read-only, test=0
- `page_view=1,826`; `journey_view=730`; `cta_click=48`.
- `checkout_requested=29`; `checkout_start=4`; `checkout_created=6`; `checkout_failed=6`.
- No payment-confirmed, conversion, delivery-sent or activation events.
- These are event counts, not unique visitors or sessions.

## Payment and Worker integrations
- Mollie `ListProfiles`: one verified profile on a different domain; no BOT-WOW-specific profile. Do not reuse another activity's profile. No payment was created.
- Active `botwow-api` remains Worker version 50, version ID `c3dcc842-c422-42d3-9828-405f30d70b5f`, 100% traffic. No Worker deployment.

## Commercial and platform scope
- Commercial paid sales verified: **0**.
- Confirmed commercial revenue: **€0.00**.
- Checkout remains closed; no package delivery or activation is recorded.
- No applicable authorization for the current gameplay-automation scope is documented. Do not promote or sell it for Blizzard-operated services; third-party technical compatibility is not authorization.
- No payment, email, price, checkout, secret, binding, Worker, D1/R2, DNS or cache mutation occurred in this run.

## Next action
1. Finish the targeted homepage residual-copy PR and validate it on GitHub Actions.
2. Use Factory's real browser/HTTP tooling to verify all eight EN/FR routes against the new Pages deployment, including response status, final URL, ETag, Age, Cache-Control and CF-Cache-Status. Resolve the FR Buy and Comparison crawler discrepancy only after identifying cache vs route behavior.
3. Keep checkout closed until commercial scope, package provenance, dedicated payment profile and end-to-end fulfillment are independently verified.


## P0.52 PR publication — 2026-11-05T19:01Z

- Follow-up PR: [#96 — remove residual unavailable-offer claims from homepage](https://github.com/aveca/bot-wow/pull/96).
- Branch: `fix/p0.52-homepage-residual-offer-claims-20261105`; code/report head before this publication note: `ddb963a9fd314dc4671403dc11fc919a0694ba35`.
- PR #96 currently contains 8 commits and 4 changed files: EN/FR homepage, release-availability regression tests, and this operational report.
- No local Factory/npm result is claimed. Require Validate and UI Quality/Playwright SUCCESS on the exact final head before merge.
- Static merge/deploy remains permitted only with the standing reversible-change authorization, verified rollback and no checkout/payment/Worker mutation.


---

# P0.54 — residual purchase CTAs and unsupported delivery claims found on secondary routes — 2026-11-05T20:27Z

## GitHub / Pages baseline
- Repository: `aveca/bot-wow`; exact `main`: `0bba14dffbfb239f7368ff632d084a5a6449bc12`.
- PR #96 is merged into this main. The latest Pages production deployment is `ea59f77e-4fbe-42ea-b9e5-e5d22f94569c`, created `2026-11-05T19:36:35Z`; build and deploy stages both SUCCESS. Its source branch is `main` and source commit exactly matches `0bba14dffbfb239f7368ff632d084a5a6449bc12`.
- Pages project `bot-wow`: production branch `main`; build `node scripts/build-site.mjs _site`; output `_site`; build cache disabled; preview deployments disabled. Both custom domains `bot-wow.com` and `www.bot-wow.com` are ACTIVE and aliases of the same deployment.
- Previous production deployment retained as rollback: `9f9e0e84-60dc-4d64-9b70-e01ab1ec40fc`.
- Public live checks on 2026-11-05 show the current status copy on Home EN/FR, Buy EN/FR, Compare EN/FR and Modules EN/FR. The reader resolves `buy.html` to `/buy` and `fr/buy.html` to `/fr/buy`; both forms state checkout unavailable and are disabled. Compare pages label €20 as a target price and purchase unavailable. Modules pages state that the internal registry is not proof of a downloadable product. Public references: https://www.bot-wow.com/ ; https://bot-wow.com/buy.html ; https://bot-wow.com/fr/buy.html ; https://bot-wow.com/compare.html ; https://bot-wow.com/fr/compare.html ; https://bot-wow.com/modules.html ; https://bot-wow.com/fr/modules.html .
- Direct public homepage crawl on www and apex is now consistent with the merged status copy. Earlier stale search-index excerpts are not proof of a current live route mismatch; no cache purge or DNS change was attempted.

## Newly verified residual copy defects in current main
These are source-level facts on the exact main SHA, not assumptions about crawler cache:

- `demo.html` and `fr/demo.html`: header CTA still says Buy/Acheter; demo-close CTA says “Get the lifetime licence — €20” / “Prendre la licence à vie — 20 €”; mobile bar still says “One-time · lifetime licence” / “Paiement unique · licence à vie”; intro says to inspect the planner “before you buy”.
- `features.html` and `fr/features.html`: header Buy/Acheter CTA remains. The licence/delivery feature still states machine-locked keys, a manual Bitcoin rail and Mollie card checkout, despite the current closed checkout and absence of a dedicated BOT-WOW Mollie profile.
- `getting-started.html` and `fr/getting-started.html`: header Buy/Acheter CTA remains; the page promises a post-payment ZIP and licence key, one-machine activation and key re-sending. Those entitlements and delivery are not verified.
- `fishing.html`, `fr/fishing.html`, `faq.html`, `fr/faq.html`, `compatibility.html`, `fr/compatibility.html`, `roadmap.html`, `fr/roadmap.html`: header Buy/Acheter CTA remains and points to the obsolete `#offre` anchor rather than the purchase-status route.
- `success.html` and `fr/success.html`: header Buy/Acheter CTA remains; FR page title says “Commande confirmée”; both pages describe licence-key and download-link email delivery even though no verified delivery exists. The English body correctly warns that the page alone does not confirm payment, but the title/next-step copy still overstates the state.
- `docs/install.html`, `docs/fr/install.html`, `docs/license.html`, `docs/fr/license.html`, `docs/index.html`, `docs/fr/index.html`: header Buy/Acheter CTA remains and points to the obsolete `#offre` anchor.

## Persistent tracker
- Created GitHub issue [#97 — align all secondary EN/FR routes with closed checkout and unverified delivery](https://github.com/aveca/bot-wow/issues/97).
- Required scope: neutral purchase-status links across all affected pages; remove unsupported Mollie/Bitcoin/machine-lock/lifetime/email-delivery promises; make getting-started and success pages explicitly conditional; extend `tests/release-availability.test.mjs` to scan the complete affected EN/FR route set.
- The issue is static copy + regression tests only. No checkout, payment, price, Worker, secrets, bindings, D1/R2, email, DNS, cache or production payment changes.

## D1 production — read-only, 2026-11-05T20:20Z
- All SQL statements were SELECT-only; every result reported `changed_db=false` and `rows_written=0`.
- Orders: Bitcoin manual `paid=5` (stored sum 10,000 minor units), `pending_payment=8`, `rejected=1`; Mollie `failed=11`.
- Paid non-test orders: **0**; all five paid rows use `@example.com`. Do not count their stored amounts as revenue.
- Licences: 5 (all active); total configured activation slots 10, but this does not prove a customer entitlement. Activations: 0.
- Deliveries: 0 rows. Webhook event records: 16. Email contacts: 12; confirmed: 0; marketing-consent flag count: 9. No email was sent and no production row was written.
- No customer payment or commercial sale is confirmed.

## Analytics D1 — read-only, `test=0`, 2026-11-05T20:20Z
- `page_view=1,840`; latest page event `2026-11-05T19:38:27.389Z`.
- `journey_view=737`; latest `2026-11-05T19:38:24.483Z`.
- `cta_click=48`; latest `2026-11-04T02:47:00.736Z`.
- `checkout_requested=29`; `checkout_start=4`; `checkout_created=6`; `checkout_failed=6`.
- No `payment_confirmed`, `conversion`, `delivery_sent` or `activation` events.
- These are event counts, not unique users or sessions. Page/journey views increased; no new CTA click is recorded after the previous snapshot.

## Worker / Mollie
- Active Worker `botwow-api`: latest deployment `36227a4d-00e7-4c9f-94e0-0913b29049bc`, version `c3dcc842-c422-42d3-9828-405f30d70b5f`, 100% traffic; no new deployment.
- Mollie profile listing still shows no BOT-WOW-specific profile. Do not reuse a profile from another activity. No payment was created.
- PR #90 remains DRAFT and is based on stale main `218f0eb`; PR #66 remains DRAFT and non-mergeable against an older base. Neither is ready to merge or deploy.

## Commercial decision
- Verified commercial paid sales: **0**.
- Confirmed commercial revenue: **€0.00**.
- Public checkout remains closed. No verified customer package delivery or activation.
- No applicable authorization for the current WoW gameplay-automation scope is documented. Do not promote or sell that scope for Blizzard-operated services. Third-party technical compatibility is not authorization.
- No payment, email, price, checkout, Worker, secret, binding, D1/R2, DNS, cache or production mutation occurred in this cycle.

## Next action
1. Execute issue #97 on a dedicated branch in the local Factory/OpenCode environment: correct the residual EN/FR buy CTAs and unsupported payment/delivery/activation copy on all listed routes, and extend the existing release-availability test.
2. Run `npm run validate`, `npm test`, `npm run test:e2e`, `node scripts/build-site.mjs _site` and `git diff --check` for real; require Validate and UI Quality green on the exact final SHA.
3. Merge/deploy only the reversible static copy/test change after full diff inspection and green CI; verify the Pages source commit and all affected live routes. No checkout, payment or Worker change.
4. Keep the commercial decision at NO-GO until the product scope is authorized, package provenance is reproducible, a dedicated payment profile exists, and post-payment delivery is independently verified.


---

# P0.55 — deployed Worker v50 diverges from main; email delivery remains a stub — 2026-11-05T20:34Z

## Active Worker / custom domain — directly verified
- Worker: `botwow-api`; active deployment `36227a4d-00e7-4c9f-94e0-0913b29049bc`; version ID `c3dcc842-c422-42d3-9828-405f30d70b5f`; 100% traffic.
- Custom domain `api.bot-wow.com` is enabled in production and mapped to service `botwow-api`.
- Downloaded deployed Worker script read-only. It contains a legacy `handleLanding` handler for GET requests outside `/api/`, including generated SEO routes `/bot-wow-gold`, `/bot-wow-classic`, `/best-wow-bot`, `/bot-wow-gratuit`. Embedded EN/FR strings still promote automated gold/XP/items/battlegrounds, a lifetime €20 Bitcoin licence, private-server compatibility and “humanized” behavior.
- The browser/web reader could not retrieve the API hostname, so the exact response body of those paths was not independently browser-verified. The enabled custom-domain mapping plus the deployed fetch-handler code prove that non-API GET requests are routed to this Worker handler.
- Current `main/worker/index.js` (blob `725d98e4595b27aa60e88758ecac20c711a38b6b`) no longer contains `handleLanding`; active Worker v50 is materially stale relative to main.

## Download artifact discrepancy
- Deployed v50 tries the configured `R2_OBJECT_KEY`, then `casinobabe-fishing-1.2.0.zip`, then falls back to `Casinobabe-v1.0.38.zip`.
- Its response `Content-Disposition` is always `Casinobabe-v1.0.38.zip`, even when another candidate is selected.
- Current main source has already removed fallback behavior: it validates a single configured versioned key and returns `artifact_unavailable` when that object is missing. That safer code is not deployed to v50.
- No R2 object read or mutation occurred in this cycle; actual archive existence and SHA-256 remain unverified.

## Delivery email — implementation exists; live send remains unverified
- The legacy helper named `sendDeliveryEmail` is a log-only stub, but it is not the active delivery path.
- Both current `main/worker/index.js` and the deployed v50 bundle contain `sendDeliveryEmail2` and `sendEmail2`; the latter issues a POST to `https://api.resend.com/emails` when `RESEND_API_KEY` is configured.
- Active Worker settings expose the `RESEND_API_KEY` secret binding name and `MAIL_FROM` sender setting. Secret values remain masked and were not read, printed or changed.
- Webhook and resend paths call `sendDeliveryEmail2`. The presence of code and a binding does not prove a successful provider send.
- D1 SELECT-only shows 0 delivery rows; there are also 0 verified non-test paid orders. This proves no recorded delivery, not that email sending is unimplemented. No test email was sent.
- Correct status: delivery-email implementation is present; effective credential validity and a successful production send remain unverified.

## Effective checkout gate — unknown, not assumed closed server-side
- Worker settings contain a `RELEASE_STATUS` `secret_text` binding. The value is masked and was not read or exposed.
- Deployed code defaults to `pending`, but `env.RELEASE_STATUS` overrides the default; `confirmed` permits checkout creation.
- The effective value cannot be verified through the read-only settings endpoint. No valid checkout request was sent because it could create a real payment.
- Public Pages checkout UI is closed, but that alone does not prove the Worker-side gate's effective value.

## Mollie
- `ListProfiles`: one profile only; no BOT-WOW-specific profile.
- `ListWebhooks`: one live webhook only, targeting a different domain; no BOT-WOW webhook was returned.
- Worker secret binding names exist, but masked values do not prove correct profile/webhook configuration. Do not reuse another activity's profile.

## Persistent tracker / safety
- Created issue [#99 — reconcile stale Worker, remove legacy landing route and verify fail-closed delivery](https://github.com/aveca/bot-wow/issues/99).
- Required work: prepare a focused Worker PR to remove the legacy landing handler, preserve current-main single-artifact behavior, remove old-version fallback, fix download-quota ordering, and add regression tests. Document the missing email provider without enabling sends.
- No Worker deployment, secret change, payment, valid checkout probe, email, D1 write, R2 read/write, DNS or cache mutation occurred.
- Worker deployment, secret changes, payment rules and email sending remain blocked pending explicit authorization. Keep the public checkout closed.

## Updated next priorities
1. P0 — issue #99: prepare/test Worker source reconciliation; do not deploy or change secrets.
2. P0 — issue #97: remove residual purchase CTAs and unsupported payment/delivery claims across secondary EN/FR pages.
3. P1 — verify the exact package bytes/version/SHA through an authorized R2 read path.
4. P1 — obtain a dedicated BOT-WOW Mollie profile and webhook only after the product scope is authorized and fulfillment is ready.
5. P1 — implement delivery email only after a separately authorized, controlled test-send procedure.



---

# P0.56 — fresh verification corrects the email finding and reconfirms production state — 2026-11-05T21:53Z

## GitHub / PR state
- Exact `main` remains `0bba14dffbfb239f7368ff632d084a5a6449bc12`; no newer main commit was returned.
- PR #98 changes only this operational report. Its head `c2b58ca7ad1fa1ef1e618d058d6ddd1fc3477059` has Validate run `42104599878` SUCCESS and UI Quality run `42104599841` SUCCESS on the same SHA.
- Issues #97 and #99 remain open. PR #90 and #66 remain drafts; neither was merged.

## Cloudflare production
- Pages production deployment remains `ea59f77e-4fbe-42ea-b9e5-e5d22f94569c`, source commit `0bba14dffbfb239f7368ff632d084a5a6449bc12`, deploy stage SUCCESS. No new Pages deployment occurred.
- Worker `botwow-api` remains version 50, version ID `c3dcc842-c422-42d3-9828-405f30d70b5f`, deployment `36227a4d-00e7-4c9f-94e0-0913b29049bc`, 100% traffic. Its custom domain `api.bot-wow.com` is enabled.
- Read-only Worker settings show binding names `RELEASE_STATUS` and `RESEND_API_KEY` as secret_text, plus `MAIL_FROM` and `R2_OBJECT_KEY=casinobabe-fishing-1.2.0.zip`. No secret value was read or exposed.
- Downloaded active Worker script read-only. It still contains `handleLanding` and legacy SEO routes. Its download candidate list contains the configured object, `casinababe-fishing-1.2.0.zip`, and `Casinababe-v1.0.38.zip`; the response filename is hard-coded to the v1.0.38 name. This confirms the stale fallback/filename defect in v50. Current main has the single configured-object path and uses the actual object key as the response filename.

## Important correction — email implementation
- The previous P0.55 report incorrectly concluded that delivery email was not implemented by inspecting only the legacy `sendDeliveryEmail` stub.
- Current main and deployed v50 also contain the active `sendDeliveryEmail2` → `sendEmail2` path. `sendEmail2` POSTs to Resend's `/emails` endpoint when `RESEND_API_KEY` is configured.
- Worker settings expose the secret binding name `RESEND_API_KEY`; its value is masked and was not read or changed. The source contains a real provider integration, but credential validity and successful production sending are not verified.
- The active webhook/resend paths call `sendDeliveryEmail2`, not the legacy stub. D1 currently records 0 delivery rows and 0 verified non-test paid orders. No test email was sent.
- Correct conclusion: email delivery code exists; a real successful delivery is not evidenced. Do not describe the provider integration as absent.

## Read-only production data — 2026-11-05T21:53Z
- D1 production queries were SELECT-only; every query reported `changed_db=false` and `rows_written=0`.
- Orders: Bitcoin manual `paid=5` (all five emails are `@example.com`, amount sum 10,000 minor units is test data), `pending_payment=8`, `rejected=1`; Mollie `failed=11`. Paid non-test orders: 0; paid non-test amount: 0.
- Licences: 5 active; downloads: 5; deliveries: 0; activations: 0; webhook events: 16.
- Email table `botwow_emails`: 12 rows, 0 confirmed, 9 marketing-consent flags, 7 transactional-consent flags. No email was sent during this check.
- Analytics events with `test=0`: page_view 1,856; journey_view 739; cta_click 48; checkout_requested 29; checkout_start 4; checkout_created 6; checkout_failed 6. No payment_confirmed, conversion, delivery_sent or activation events. These are event counts, not unique visitors.

## Mollie
- Live `ListProfiles`: one verified profile for `https://sargasses-martinique.com/`; no BOT-WOW-specific profile.
- Live `ListWebhooks`: one enabled webhook targeting `https://sargasses-martinique.com/api/mollie-webhook.php`; no BOT-WOW webhook.
- No payment was created and no other activity's profile was reused.

## Live site limitation
- Direct web-reader opens for the eight secondary routes failed in this run. Source-level copy defects remain confirmed by the current main files; live HTTP body and headers for those routes were not independently retrieved. Do not claim live correction.

## Safety / commercial state
- `RELEASE_STATUS` is a masked secret binding. Code defaults to `pending` and allows checkout only when the effective value is exactly `confirmed`; the effective value remains unknown. No valid checkout probe was sent.
- Public checkout remains closed. Verified commercial sales: 0. Confirmed commercial revenue: €0.00.
- No Worker deploy, secret change, payment, email send, D1/R2 mutation, DNS change or cache purge occurred.

## Next action
1. Correct this report and issue #99 so the email integration is accurately described.
2. Execute issue #97 as a static EN/FR copy/test PR; keep checkout and Worker unchanged.
3. Prepare, but do not deploy, a Worker reconciliation for the confirmed legacy landing and old-archive fallback. Worker deployment requires separate explicit authorization.
4. Verify package bytes/provenance and the effective release gate through authorized non-disclosing paths before any sales enablement.


---

# P0.58 — 320px documentation overflow fixed; PR #100 revalidated; primary-route claims still open — 2026-11-05T23:33Z

## GitHub / PR #100
- Current `main`: `a4bb4572079ba939df05e87a221ccaddea1e08b2`.
- PR #100 remains OPEN, base SHA matches main, mergeable=true. Branch: `fix/p0.54-secondary-route-status-copy-20261105`.
- Latest code head before this report update: `9656c544a53b898665f5a7530827959bfa69bb5b`; 12 commits, 40 changed files. Static copy/tests only.
- Validate run `42129873947`: SUCCESS on that head.
- UI Quality run `42129873965`: IN PROGRESS at the latest check; do not merge until it completes green on the exact final head.
- Previous UI Quality run `42127563795` completed with 422 PASS and 6 FAIL. All six failures were the 320px overflow assertion for `/docs/index.html`, `/docs/fr/index.html`, and `/docs/fr/install.html` in desktop and mobile projects. Recorded document widths were 335px, 335px and 342px against 321px allowed.
- Root cause: long 40px documentation heading words exceed the 320px content width. This is a real responsive defect, not a stale assertion.
- Corrective commits added `.docs-archive` to the four archived documentation index/install pages and a scoped `@media(max-width:360px)` rule in `assets/components.css` reducing the archived-page heading to 30–34px with safe wrapping. The overflow assertion was not weakened.
- PR comment with exact failure and fix: https://github.com/aveca/bot-wow/pull/100#issuecomment-6672278374

## Cloudflare Pages — read-only verification
- Project `bot-wow`, production branch `main`, build `node scripts/build-site.mjs _site`, output `_site`; Git source is `aveca/bot-wow`; preview setting reports `none`.
- Latest production deployment remains `321aeb92-5a58-4e83-a80a-293038c1d610`, source `a4bb4572079ba939df05e87a221ccaddea1e08b2`; queued, initialize, clone, build and deploy stages all SUCCESS.
- `bot-wow.com` and `www.bot-wow.com` domains are ACTIVE.
- PR branch preview deployment records exist but show stage `idle`; they are not production deployments. PR #100 has not been merged and its changes are not live.
- Rollback remains `321aeb92-5a58-4e83-a80a-293038c1d610`.
- No Pages production mutation occurred during this run.

## Public routes — fresh web-reader check
- Home `https://bot-wow.com/` and Buy `https://bot-wow.com/buy.html` were readable.
- Both state that purchase/delivery are unavailable. However, the live primary pages still describe the intended gameplay-automation product, measured bot behavior, an operational unzip/key/F9 installation step, a 14-day refund promise tied to activation, and an installation guide. The Buy page continues to describe intended package entitlements and delivery as unverified.
- These claims are still in current main source; PR #100 covers secondary routes, not Home/Buy. This is not a cache discrepancy: the Pages production source is exactly current main.
- Created issue #102: https://github.com/aveca/bot-wow/issues/102 to align Home/Buy EN/FR with closed checkout and unverified commercial scope. Legal document bodies remain excluded; issue #101 still requires owner/legal approval.
- Features and docs/install direct web-reader opens returned internal errors in this run; no live claim is made for those routes. Source changes in PR #100 remain pending.

## Production D1 — read-only
- Queries used SELECT-only statements/batch. Every returned query reports `changed_db=false`, `rows_written=0`.
- Orders: Bitcoin manual `paid=5` (all test-domain records; amount sum is test data), `pending_payment=8`, `rejected=1`; Mollie `failed=11`.
- Paid non-test orders: `0`; paid non-test amount: `0`.
- Licences: 5; deliveries: 0; activations: 0; webhook events: 16; email contacts: 12; confirmed contacts: 0.
- These test orders/licence rows do not prove a commercial sale or delivery.

## Analytics D1 — read-only, test=0
- `page_view=1,897`; latest recorded page event `2026-11-05T23:31:49.716Z`.
- `journey_view=760`; latest `2026-11-05T23:31:49.737Z`.
- `cta_click=48`; latest `2026-11-04T02:47:00.736Z`.
- `checkout_requested=29`; `checkout_start=4`; `checkout_created=6`; `checkout_failed=6`.
- No `payment_confirmed`, `conversion`, `delivery_sent` or `activation` events.
- Counts are events, not unique visitors or sessions.

## Mollie / Worker
- Live `ListProfiles`: one verified profile for `https://sargasses-martinique.com/`; no BOT-WOW-specific profile.
- Live `ListWebhooks`: one enabled live webhook to `https://sargasses-martinique.com/api/mollie-webhook.php`; no BOT-WOW webhook.
- No Mollie payment was created; no profile from another activity was reused.
- Worker `botwow-api` remains deployment `36227a4d-00e7-4c9f-94e0-0913b29049bc`, version ID `c3dcc842-c422-42d3-9828-405f30d70b5f`, 100% traffic.
- Binding names include `RELEASE_STATUS`, `MOLLIE_API_KEY`, `MOLLIE_PROFILE_ID`, `MOLLIE_WEBHOOK_SECRET`, `RESEND_API_KEY`; secret values were not read. `MAIL_FROM` is `BOT-WOW <licences@bot-wow.com>`; `R2_OBJECT_KEY` is `casinobabe-fishing-1.2.0.zip`.
- The effective `RELEASE_STATUS` value remains unknown. Do not probe it with a valid checkout request.
- Resend integration code exists (`sendDeliveryEmail2` → `sendEmail2`), but successful delivery and credential validity are unverified. No email was sent.
- Issue #99 title/body were corrected to reflect that the Resend integration exists; only successful production delivery remains unverified.

## Commercial state / safety
- Verified commercial sales: **0**. Confirmed commercial revenue: **€0.00**.
- Public checkout UI is closed. Effective Worker-side gate remains unknown; do not assume the UI proves the secret value.
- No applicable authorization for the current gameplay-automation scope is documented. Do not promote or sell this scope for Blizzard-operated services.
- No price, checkout, payment, secret, binding, Worker, D1/R2, email, DNS, cache or production setting was changed. No campaign or paid traffic.

## Next action
1. Wait for UI Quality run `42129873965` and require SUCCESS on the exact final PR #100 head; inspect any new failures rather than weakening tests.
2. If green, inspect the complete diff and merge the reversible static PR #100; verify the automatic Pages production deployment source SHA and the changed routes.
3. Execute issue #102 as a separate static EN/FR PR for Home/Buy copy; do not change legal bodies from issue #101.
4. Keep checkout closed until the product scope is authorized, the exact package bytes/provenance are verified, a dedicated BOT-WOW payment profile/webhook exists, and end-to-end fulfillment is proven.
5. Keep Worker v50 reconciliation separate and do not deploy Worker or change secrets without specific authorization.

---

# P0.56 — Secondary EN/FR routes merged and live; Worker fulfillment reconciled (PR #100 merged, PR #103 open) — 2026-11-06T00:25Z

## Mission
P0.56 — secondary routes (closed checkout / unverified release) + Worker fulfillment reconciliation. Scope: BOT-WOW only. Static pages only for the deployable part; Worker prepared but **not deployed**.

## GitHub / merge
- `main` before: `a4bb4572079ba939df05e87a221ccaddea1e08b2`. `main` after: `f95868421e994db46c5cd2fdfbb0f3d8d74f2516`.
- **PR #100 MERGED** 2026-11-06T00:22:08Z (squash), branch `fix/p0.54-secondary-route-status-copy-20261105`, head `0ba3395e7c51cec3e2a1d5577b51c2f79306441c`. 41 files changed (+418 / -431). Closes issue #97.
- PR #100 final CI on the exact head `0ba3395`: **Validate SUCCESS** (run `42132869946`) and **UI Quality SUCCESS** (run `42132870177`), GitGuardian pass. Both green on the same SHA before merge.
- **PR #103 OPEN** (not merged, not deployed): `fix/p0.56-worker-fulfillment-reconciliation-20261105`, head `462e13609454521a8525962321b1f8f336146db2`, base `main` @ `a4bb457`. Validate SUCCESS (run `42136060489`), UI Quality SUCCESS (run `42136060542`), GitGuardian pass. Closes issue #99 when merged.

## Static changes merged (PR #100)
- 22 mission routes EN/FR (`demo`, `features`, `fishing`, `faq`, `getting-started`, `compatibility`, `roadmap`, `success`, `docs/install`, `docs/license`, `docs/index`) + `cancel`, `404`, `docs/changelog`, `docs/known-issues` and the legal **navigation** CTAs: no active Buy/Acheter header, all CTAs point to the purchase-status page, no `href="#offre"`, no lifetime-licence claim, no active Mollie/Bitcoin/machine-lock claim, no guaranteed delivery / activation / delivery-email, no payment confirmation on visit, platform warnings preserved.
- Two real defects found and fixed by the new coverage: `.callout` is a flex container, so the status link added inside the installation-unavailable callouts became a non-wrapping flex item and pushed the document past the viewport at 320px (361px on `fr/getting-started.html`); `success.html` / `fr/success.html` had no `<h1>` at all.
- One CI-only defect: the 40px heading word “Documentation” measures 332px against the 286px usable at 320px under the CI runner's fallback font metrics. Fixed with a scoped `@media(max-width:360px)` rule on the archived documentation pages (`body.docs-archive`) — the assertion was not weakened.
- Regression coverage: `tests/e2e/responsive.spec.mjs` now covers the 22 secondary routes at 320 / 375 / 391 / 430 / 768 / 1280 (264 assertions) plus a **deterministic no-webfont guard** (44 assertions) that blocks `fonts.googleapis.com` / `fonts.gstatic.com` before load, so the CI-only failure can no longer pass locally. `tests/release-availability.test.mjs` extended to 36 EN/FR routes.
- Legal document **bodies** deliberately unchanged pending owner/legal approval (issue #101). `ab/` variants are not published (`build-site.mjs` excludes them).

## Local verification (real runs)
- `npm run validate` → exit 0 · `node scripts/versionne-assets.mjs` → 51 files stamped · `npm test` → exit 0 · `npm run audit:css` → exit 0 · `node scripts/build-site.mjs _site` → exit 0 · `git diff --check` → exit 0.
- Playwright (`node node_modules/@playwright/test/cli.js test`): **472 passed / 0 failed** (342 in `tests/e2e/responsive.spec.mjs` alone). Note: `npm run test:e2e` is not usable as-is under npm/PowerShell on this machine; the Playwright CLI is the equivalent command used by CI.
- The mechanical `versionne-assets` stamp resync is **not** committed (same convention as PR #95, #96, #100): CI regenerates it before the test and build steps.

## Cloudflare Pages — production
- Automatic deploy after the merge: deployment **`af45d9ec-729a-45e3-9562-ab34ebc7fc71`**, branch `main`, **source `f95868421e994db46c5cd2fdfbb0f3d8d74f2516`** (matches the merge commit).
- Rollback targets still reachable: `321aeb92-5a58-4e83-a80a-293038c1d610` (source `a4bb457`) and the mission target `ea59f77e-4fbe-42ea-b9e5-e5d22f94569c` (source `0bba14d`).
- No Pages production mutation other than the automatic post-merge deploy.

## Live verification (read-only GET on https://bot-wow.com, 2026-11-06T00:24Z)
- **34 of the 36 affected routes are compliant**: HTTP 200 after the Pages `.html` → extensionless 308 (canonical URLs `/demo`, `/docs/install`, `/fr/success`, …), a valid purchase-status link present, and none of the eight commercial assertions (no immediate-purchase CTA, no lifetime licence, no active Mollie, no guaranteed delivery / activation / delivery-email, no payment confirmation on visit, no `#offre`).
- The **2 remaining exceptions are `legal/terms.html` and `legal/fr/terms.html`**: their bodies still describe the licence key + download link sent by email and one-machine activation. This is the known and intentional freeze (issue #101, owner/legal approval required); PR #100 changed only their navigation. **Not a regression.**
- Home / Buy EN/FR were out of scope for PR #100 and are tracked in issue #102.

## Worker / fulfillment (PR #103, prepared only — NOT deployed)
- Deployed Worker `botwow-api` is **still version 50** (`c3dcc842-c422-42d3-9828-405f30d70b5f`, deployment `36227a4d-00e7-4c9f-94e0-0913b29049bc`), created 2026-10-27T07:46:28Z. No new deployment, no secret change, no binding change.
- Read-only GET probes (2026-11-06T00:10Z) confirm the deployed Worker is **stale**: `/bot-wow-gold` and `/best-wow-bot` still return HTTP 200 legacy marketing HTML (16 765 bytes), as do `/bot-wow-classic`, `/bot-wow-gratuit`, `/de/`, `/en/`, `/ru/`. `main` already answers 308 to the canonical site on all of them.
- `main` also already removed the `Casinobabe-v1.0.38.zip` fallback (PR #19), reserves the download quota **only after** the configured artifact is found, and serves `Content-Disposition` = the exact served object key. PR #103 makes these guarantees executable with `tests/worker-fulfillment-reconciliation.test.mjs` (legacy routes, no older-archive fallback, quota ordering, filename, `429 limit_reached`, fail-closed email) and removes the dead `sendDeliveryEmail` log-only stub.
- The v50 bundle body is **not retrievable** with the available Cloudflare OAuth token (the version content endpoint returns metadata JSON only): the gap is established by observed HTTP behavior, not by reading the bundle.

## RELEASE_STATUS / payment / email state
- `RELEASE_STATUS` (`secret_text`) exists; its value is **masked, unknown and never revealed**. The Worker is treated as **fail-closed**; no valid checkout request was attempted.
- `/api/config` exposes **no availability state** — live body: `{"contactEmail":"support@bot-wow.com","product":"bot-wow-lifetime","priceEur":20,"currency":"eur","bitcoin":{"enabled":true,"address":null}}`. There is no `releaseStatus` / `available` field, so the effective release gate cannot be read from the public API.
- Residual reported, **not changed**: `/api/config` still publishes `bitcoin.enabled: true` with a null address, which contradicts the closed-checkout message on the site. Nothing in the front-end consumes `config.bitcoin`. It is a payment-rail decision outside issue #99 and left for an explicit owner decision.
- Email: the Resend integration (`sendDeliveryEmail2` → `sendEmail2`) exists in both `main` and v50; `RESEND_API_KEY` is present as a masked `secret_text`; **credential validity and any successful production delivery remain unverified**. Without the key the path is fail-closed (delivery recorded `pending` for replay). No email was sent, tested or enabled.
- Mollie / D1 / analytics were **not re-audited** in this cycle (no demonstrated change); see the P0.58 addendum above for the read-only snapshot of 2026-11-05T23:33Z (no BOT-WOW profile, one live webhook on another domain, 0 paid non-test orders, 0 deliveries, 0 activations, no `payment_confirmed` / `delivery_sent` / `activation` events).

## Commercial state / safety
- Verified commercial sales: **0**. Confirmed commercial revenue: **0,00 €**.
- No price, checkout, payment, secret, binding, Worker, D1/R2, email, DNS, cache or production setting was changed. No campaign or paid traffic. No archive was fabricated.

## Blockers
1. Deployed Worker v50 still serves legacy marketing pages — reconciling production requires a **Worker deployment with explicit authorization** (checklist in `reports/operations/BOT-WOW-WORKER-RECONCILIATION-P0.56.md`).
2. `RELEASE_STATUS` effective value unknown → fail-closed; `/api/config` exposes no availability state.
3. Delivery artifact unverified: no provenance, no SHA-256, no content inspection, no confirmed compatibility → delivery stays `503 artifact_unavailable`.
4. No dedicated BOT-WOW Mollie profile and no BOT-WOW webhook.
5. Legal bodies EN/FR still describe a delivered licence key and one-machine activation (issue #101).
6. Home / Buy EN/FR still describe the intended gameplay-automation product (issue #102).

## Next action
1. Review and merge PR #103 (Worker reconciliation) — green, no deployment; a Worker deploy itself needs a separate explicit authorization after the checklist is executed.
2. Execute issue #102 (Home/Buy EN/FR) as a separate static PR; leave the legal bodies of issue #101 untouched.
3. Verify the exact R2 artifact bytes / provenance / SHA-256 and the effective release gate through authorized non-disclosing paths before any sales enablement.
4. Decide explicitly on the `/api/config` `bitcoin.enabled` residual before the checkout is ever reopened.

### Prompt complet du cycle suivant

```
MISSION BOT-WOW P0.59
LIVRAISON REELLE + PORTE DE RELEASE VERIFIEE

REPOSITORY:
https://github.com/aveca/bot-wow

SCOPE:
BOT-WOW uniquement.

MAIN:
f95868421e994db46c5cd2fdfbb0f3d8d74f2516

PRs:
#100 (statique, mergée 2026-11-06T00:22:08Z, merge f958684)
#103 (Worker, ouverte, verte, NON déployée, head 462e136)

TRACKERS:
Issue #97 — routes secondaires (clos)
Issue #99 — Worker et fulfillment
Issue #101 — corps des pages légales (approbation propriétaire/juridique)
Issue #102 — Home/Buy EN/FR

================================================
PHASE 1 — REPRISE
================================================
Lire :
AGENTS.md
PRODUCT.md
reports/operations/BOT-WOW-CURRENT-STATE.md

Vérifier :
- main SHA ;
- PR #103 (état, CI, diff complet) ;
- dernières Pages (production af45d9ec, rollback 321aeb92 et ea59f77e) ;
- état Worker botwow-api (toujours v50 ?).

Préserver tout changement local.
Ne pas recommencer les audits D1/Mollie sans évolution démontrable.

================================================
PHASE 2 — PR #103 : REVUE ET FUSION (SANS DEPLOIEMENT)
================================================
- Inspecter le diff complet de PR #103 (4 fichiers).
- Vérifier que la suite tests/worker-fulfillment-reconciliation.test.mjs
  couvre : aucune route marketing legacy, aucun repli archive ancienne,
  quota réservé après artefact trouvé, Content-Disposition = clé exacte,
  fournisseur d'e-mail fail-closed.
- Fusionner PR #103 si et seulement si la CI est verte sur le SHA final.
- NE PAS deployer le Worker. NE PAS toucher aux secrets ni aux bindings.
- NE PAS ouvrir le checkout. Aucun paiement, aucun e-mail, aucune écriture
  D1/R2.

================================================
PHASE 3 — PHASE 3 STATIQUE : ISSUE #102 (HOME / BUY EN+FR)
================================================
Créer une branche dédiée depuis main, sur le modèle de PR #100.

Objectifs :
- plus aucun header Buy/Acheter actif ;
- plus de CTA d'achat immédiat ; tout pointe vers la page de statut ;
- aucune description du produit comme « produit d'automatisation de jeu »
  disponible ou autorisé ;
- aucune promesse de licence à vie, de clé, de téléchargement, de
  livraison ou d'activation ;
- le guide d'installation ne doit plus présenter l'installation comme
  disponible ;
- conserver l'avertissement de plateforme et l'avertissement Blizzard ;
- corps des pages légales : NE PAS TOUCHER (issue #101).

Tests :
- étendre tests/release-availability.test.mjs à Home/Buy EN+FR ;
- étendre la couverture responsive aux viewports 320/375/391/430/768/1280.

Exécuter réellement :
npm run validate
node scripts/versionne-assets.mjs
npm test
npm run audit:css
node scripts/build-site.mjs _site
node node_modules/@playwright/test/cli.js test
git diff --check

================================================
PHASE 4 — PR STATIQUE #102
================================================
- commit ciblé, push, PR inspectable ;
- exiger Validate SUCCESS ET UI Quality SUCCESS sur le MÊME SHA ;
- inspecter le diff complet ;
- fusionner selon la politique de livraison statique réversible ;
- rollback Pages de référence : ea59f77e-4fbe-42ea-b9e5-e5d22f94569c ;
- vérifier le déploiement automatique (source = SHA de fusion) ;
- re-vérifier en live toutes les pages concernées.

================================================
PHASE 5 — PORTE DE RELEASE (LECTURE SEULE, SANS CHECKOUT)
================================================
- vérifier le RELEASE_STATUS effectif via un chemin Cloudflare autorisé
  SANS jamais afficher la valeur ; sinon fail-closed ;
- décider explicitement du résidu /api/config bitcoin.enabled:true ;
- ne jamais tenter de checkout valide ; aucun paiement de test.

================================================
PHASE 6 — PREUVE DE L'ARTEFACT
================================================
- obtenir un chemin de lecture R2 AUTORISÉ ;
- consigner : provenance, version exacte, SHA-256, contenu inspecté,
  compatibilité confirmée ;
- NE PAS fabriquer d'archive ; NE PAS écrire dans R2 ;
- si la preuve est impossible, documenter le blocage et laisser
  artifact_unavailable en place.

================================================
PHASE 7 — EMAIL
================================================
- ne PAS activer l'envoi ;
- documenter l'absence de procédure de test-send autorisée ;
- exiger : procédure de test-send, destinataire de test, preuve de
  réception, rejouabilité — avant tout envoi réel.

================================================
GARDE-FOUS
================================================
NE PAS :
- modifier prix ;
- ouvrir checkout ;
- créer paiement ;
- modifier secrets ou bindings ;
- déployer le Worker sans autorisation spécifique ;
- écrire D1 ou R2 ;
- envoyer email ;
- modifier DNS ;
- purger cache ;
- acheter du trafic ;
- promouvoir un bot non autorisé ;
- fusionner PR #66 ou #90 sans audit spécifique ;
- modifier les corps des pages légales sans approbation (issue #101) ;
- travailler sur un autre produit.

================================================
RAPPORT FINAL
================================================
1. MAIN SHA
2. BRANCH
3. COMMITS
4. PR STATIQUE
5. PR WORKER
6. VALIDATE
7. PLAYWRIGHT
8. TEST COUNT
9. HOME EN/FR
10. DEMO EN/FR
11. FEATURES EN/FR
12. GETTING STARTED EN/FR
13. SUCCESS EN/FR
14. DOCS EN/FR
15. PAGES DEPLOYMENT
16. LIVE VERIFICATION
17. WORKER VERSION
18. WORKER SOURCE DIFF
19. RELEASE_STATUS STATE
20. MOLLIE
21. WEBHOOK
22. D1
23. ANALYTICS
24. PACKAGE SHA256
25. EMAIL DELIVERY
26. SALES
27. REVENUE
28. BLOCKERS
29. NEXT PRIORITY

Actualiser :
reports/operations/BOT-WOW-CURRENT-STATE.md

Terminer par le prompt complet du cycle suivant.
```

---

# P0.56 bis — CORRECTION : un commit documentaire declenche quand meme un rebuild Cloudflare Pages — 2026-11-06T00:38Z

## Ce qui etait ecrit (et qui etait faux)
La PR #104 (documentation seule, `reports/operations/BOT-WOW-CURRENT-STATE.md`) affirmait : « Documentation only: `reports/**` is in the Pages `paths-ignore`, so no Pages deployment is triggered. »

## Etat reel verifie
- Le workflow **GitHub Actions** `pages.yml` a bien ete **ignore** pour `2b0dd14` : aucun run Actions n'existe pour ce SHA (dernier run Pages = `42136308539`, SHA `f958684`). Le `paths-ignore: reports/**` fonctionne pour Actions.
- Mais le projet Cloudflare Pages `bot-wow` a **sa propre integration Git** : `wrangler pages project list` -> `bot-wow ... Git Provider: Yes`. Un push sur `main` y declenche un build automatiquement, **sans consulter le `paths-ignore` d'Actions**.
- Consequence observee : production **`e1892843-d91c-4b11-b853-57a1cbf68a12`**, branche `main`, **source `2b0dd14`**, statut Active. Le site a donc ete reconstruit et republie alors que la PR ne touchait que de la documentation.
- **Contenu publie inchange** : `reports/**` est exclu de l'artefact par `build-site.mjs` (liste DENY), le fingerprint des assets reste `b4232c44` (`?v=b4232c44` en ligne), donc l'artefact servi est equivalent.
- **Revérification live après ce rebuild** : les 10 preuves de la section precedente sont toujours vertes (`<h1>` success EN/FR, callout encapsulé EN/FR, `body.docs-archive` sur docs index EN/FR + install, regle `.docs-archive .panel h1` <=360px dans `assets/components.css` servi, stamp unique `b4232c44`) et la compliance reste de **34/36 routes**, les 2 memes exceptions `legal/terms` EN/FR (issue #101).

## Consequence operationnelle
- L'hypothese du depot « un commit documentaire ne declenche pas de deploiement applicatif » est **fausse du cote Cloudflare** : elle ne vaut que pour le workflow Actions. Deux chemins de deploiement coexistent (Actions + integration Git Cloudflare), donc un merge sur `main` peut produire un ou deux deploiements.
- Pour la suite : ne pas deduire « doc-only = pas de deploiement » ; **verifier systematiquement** avec `wrangler pages deployment list --project-name bot-wow` et controler le `source` du deploiement avant d'annoncer un etat de production.
- Rollbacks toujours disponibles : `af45d9ec` (source `f958684`), `321aeb92` (source `a4bb457`), `ea59f77e` (source `0bba14d`).
- Aucun autre changement : pas de prix, checkout, paiement, Worker, secret, binding, D1/R2, e-mail, DNS ni cache. Le site n'a pas ete modifie, seul son artefact a ete reconstruite a l'identique.


---

# P0.60 — état vérifié depuis ChatGPT, 2026-11-06T01:04Z

## GitHub
- Base de la branche de travail : `main` à `21c2e3ef9d164e45e42323a39a9a3cbf983d370e`.
- PR #100 est fusionnée.
- PR #107 : `fix/p0.60-primary-routes-status-only-20261106`, correction Home/Buy EN/FR, lien `#offre` conservé, tests de disponibilité, artefact et funnel mis à jour.
- Code de pages et de tests avant ce rapport : `dc0b173310978fa8463a9979d6ea215e60f33565`.
- Validate a passé sur le commit précédent `d2e15194908774c91b406a61cf16c45b00d0d048`; UI Quality doit être verte sur le SHA final avant toute fusion. Les premiers échecs ont révélé et conduit à corriger les assertions de comparaison, les ancres historiques, les CTA du parcours et deux regex de test.
- PR #103 reste ouverte, CI verte sur son SHA `462e13609454521a8525962321b1f8f336146db2`, mais sa base documentée est ancienne (`a4bb457)); aucun déploiement Worker.

## Changements Home/Buy en attente de fusion
- Remplacement des pages principales EN/FR par un statut de projet : aucun produit, paquet, licence, activation, livraison ou support commercial actuellement proposé.
- La démo est explicitement une simulation navigateur, sans connexion au jeu ni contrôle du gameplay.
- Le montant de 20 € est conservé uniquement comme prix cible historique, pas comme prix de vente.
- Instructions historiques d'installation et promesses de remboursement/livraison supprimées du marketing.
- Avertissement Blizzard et lien vers l'accord anti-triche officiel conservés ; aucune autorisation n'est revendiquée.
- Corps des documents juridiques non modifiés ; issue #101 reste ouverte.
- Checkout toujours désactivé ; aucun événement de paiement ou d'envoi déclenché.

## Pages Cloudflare
- Dernier déploiement de production observé : `ff13930a-4c97-441a-a828-2b1818e9e6b3`, source `21c2e3ef9d164e45e42323a39a9a3cbf983d370e`, statut success.
- Déploiement précédent/rollback : `e1892843-d91c-4b11-b853-57a1cbf68a12`, source `2b0dd1491dded9035116eebc85f005295fc3ba65`.
- PR #107 n'est pas déployée. La production ne doit être considérée corrigée qu'après merge, déploiement Cloudflare confirmé et vérification HTTP du domaine.

## D1 — lecture seule, 2026-11-06
- `botwow-production` : 5 commandes `bitcoin_manual/paid`, toutes de test (`@example.com)); 0 commande payée hors domaine de test; 8 pending; 1 rejected; 11 Mollie failed.
- 5 licences actives, 5 téléchargements, 0 livraison, 0 activation, 16 webhooks (dernier traité le 2026-10-27).
- `botwow-analytics`, `test=0) : 1 957 page_view; 787 journey_view; 48 cta_click; 29 checkout_requested; 6 checkout_failed; 6 checkout_created; 4 checkout_start; aucun payment_confirmed, delivery_sent ou activation.
- Toutes les requêtes D1 étaient SELECT/PRAGMA : `changed_db=false`, `rows_written=0`.

## État commercial
- Ventes commerciales payées vérifiées : **0**.
- Revenu commercial confirmé : **0,00 €**.
- Profil Mollie BOT-WOW dédié et webhook BOT-WOW : non vérifiés/absents au dernier relevé.
- Livraison email réelle : non démontrée. Resend existe dans le code, mais aucun envoi n'a été effectué.
- Worker `botwow-api` v50 : inchangé et non déployé. `RELEASE_STATUS` reste masqué/inconnu, traité fail-closed.
- Aucun prix, checkout, paiement, secret, binding, Worker, D1/R2, email, DNS, cache ou dépense modifié.

## Prochaine action réelle
1. Attendre Validate et UI Quality SUCCESS sur le même SHA final de PR #107.
2. Revoir le diff final, fusionner la PR statique si les deux contrôles sont verts et le rollback Pages disponible.
3. Vérifier le déploiement Cloudflare (source SHA = merge SHA), puis contrôler le contenu HTTP réel sur Home/Buy EN/FR.
4. Ensuite seulement, reprendre la réconciliation Worker #103 et la preuve de l'artefact ; aucun checkout ni promotion avant résolution du périmètre autorisé et de la livraison.


---

# P0.59 — Revalidation live complète (apex + www), PR #100 déjà fusionnée, Worker préparé sans déploiement — 2026-11-06T01:35Z

## Correction de la base de référence (le prompt P0.59 était périmé)
- `main` au **démarrage** de la mission : `21c2e3ef9d164e45e42323a39a9a3cbf983d370e` (PR #105, documentaire) — **pas** `a4bb457`. `main` à la **fin** de la mission : `6fd1f5e45c4c0f6b66912d3b987bc84074d2a21a` (PR #108, documentation), après PR #109 `0f86536` (correctif `<h1>` cancel) et PR #107 `b2de2a6` (P0.60, statut-only des pages primaires).
- **Fusions réalisées pendant ce cycle** (3, dans cet ordre) : PR #109 `0f86536` (2026-11-06T01:53:00Z, correctif `<h1>` cancel EN/FR, 3 fichiers +4) → PR #107 `b2de2a6` (P0.60, fusionnée par la mission concurrente pendant ce cycle) → PR #108 `6fd1f5e` (2026-11-06T02:41:17Z, documentation, 1 fichier +493). PR #100 : **MERGED** le `2026-11-06T00:22:08Z`, merge SHA `f95868421e994db46c5cd2fdfbb0f3d8d74f2516`, 41 fichiers (+418/−431). Aucune fusion n'a été refaite : il n'existe pas de « merge SHA P0.59 » distinct pour PR #100.
- Run UI Quality `42120739142` : le prompt le donnait « IN PROGRESS ». Le run réel est **`completed/success`** sur le SHA exact `938b9723f5956ecd9822e863f6dc98a38a1ba5ef`, terminé le `2026-11-05T22:23:11Z`, **164 tests passés**. Validate `42120739193` : `completed/success`, même SHA. Aucun défaut à corriger, aucun test désactivé.
- Production au démarrage : `ff13930a-4c97-441a-a828-2b1818e9e6b3`, source `21c2e3e`. Rollbacks disponibles : `321aeb92` (`a4bb457`), `ea59f77e` (`0bba14d`), `af45d9ec` (`f958684`), `e1892843` (`2b0dd14`).

## Phase 2 — Playwright, CI et tests locaux réels
- CI `42120739142` (sha `938b972`) : **success**, 164 tests passés.
- CI `42132870177` (sha `0ba3395`, tête finale de la branche) : **success**, 472 tests passés.
- Validate sur `main` : `42136308793` (`f958684`), `42137687790` (`2b0dd14`), `42138548404` (`21c2e3e`) — tous **success**.
- Chaîne locale rejouée sur `main` = `21c2e3e` (worktree `botwow-p059`) :
  - `npm run validate` → **PASS** (exit 0).
  - `node scripts/versionne-assets.mjs` → 51 fichiers, stamp `b4232c44`.
  - `npm test` → **exit 0** (26 suites, migrations D1 incluses).
  - `npm run audit:css` → **exit 0** (12 feuilles, 50 tokens, 0 token non défini).
  - `node scripts/build-site.mjs _site` → **exit 0**, artefact 24 entrées, stamp `b4232c44`, aucun fichier interdit.
  - `node node_modules/@playwright/test/cli.js test` → **472 passed / 0 failed** (1.5 m), exit 0.
  - `git diff --check` → **exit 0**.
- Le resync `versionne-assets` est **mécanique et non committé** (convention du dépôt) : le diff se limite à `?v=cb3925b6` → `?v=b4232c44`, 0 ligne hors stamp.

## Phase 3 — Inspection des 38 fichiers de PR #100
- `git show --name-only f958684` confirme les 38 fichiers : 22 pages EN/FR secondaires, `assets/components.css`, 6 pages juridiques (navigation seule), `reports/operations/BOT-WOW-CURRENT-STATE.md`, et 3 tests.
- `legal/*.html` et `legal/fr/*.html` : **corps inchangés**, seules 2 lignes de navigation par fichier ont changé (`../#offre` → `../buy.html` + `data-track="cta_click" data-cta-id="purchase-status"`). Diff = 4 lignes par fichier, 6 fichiers, +12/−12.
- `index.html`, `fr/index.html`, `buy.html`, `fr/buy.html` sont **hors périmètre de PR #100** (ils viennent de PR #90 / PR #52). Home/Buy ont donc été vérifiés séparément en Phase 7.

## Phase 7 — HTTP live, 40 routes × 2 domaines = 80 chargements
Script : `botwow-p059-live-final.mjs` (GET seul ; ni paiement, ni checkout, ni POST, ni purge de cache).
- **HTTP 200 : 80/80.**
- **Apex vs `www` : octets identiques sur les 40 routes** (comparaison `Content-Length`/corps après redirections).
- **Stamp servi unique et identique sur les deux domaines : `?v=b4232c44`** — exactement le fingerprint calculé par `versionne-assets` sur `main`. La homepage lue par l'outil web précédent était un ancien snapshot : **ce n'est pas un problème de cache**, le contenu servi correspond au `main` fusionné.
- Redirections : Pages (Automatic HTML Extensions) renvoie **308** de `/x.html` vers `/x`. `www.bot-wow.com` est servi directement (pas de redirection de zone) : les deux hôtes portent le même contenu.
- Conformité commerciale : aucune route ne présente de CTA Buy/Acheter immédiat, de licence à vie disponible, de Mollie actif, de livraison garantie, d’activation garantie, d’e-mail de livraison garanti, ni de page success comme preuve de paiement.
- **Suivi du statut d’achat** : `assets/analytics.js` n’émet `checkout_requested` que pour les identifiants `hero-offer`, `mbar-buy`, `final-buy`, `compare-buy`, `nav-buy`, `journey-fish-buy`, `journey-licence-buy`, `steps-buy`. **Aucune** occurrence de ces identifiants sur les 40 routes live ; les CTA de statut (`hero-status`, `nav-status`, `buy-status-primary`, `mbar-status`, `purchase-status`, `formula-ours-status`) sont tous tracés en `cta_click`. **Consulter le statut ne génère jamais `checkout_requested`.**
- Exceptions connues (4) : `legal/terms` EN/FR × 2 domaines. Les corps juridiques promettent encore l’envoi de la licence et du lien par e-mail et l’activation sur une machine. **Hors périmètre de PR #100**, corps gelés par l’issue #101, approbation propriétaire/juridique requise. Non corrigé.
- **Rejeu après le déploiement du correctif P0.59** (déploiement `c8c05ca3`, source `0f86536`) : les 80 chargements ont été rejoués et donnent **les mêmes résultats** — 80/80 HTTP 200, stamp `b4232c44` sur les deux domaines, apex et `www` octets identiques, mêmes 4 exceptions `legal/terms` et les 4 écarts `#offre` de Buy EN/FR (P0.60). Le correctif `<h1>` n'introduit **aucune** régression commerciale et **aucun** changement de stamp.
- **Rejeu final après le déploiement P0.60** (déploiement `155a9b9e`, source `b2de2a6`) : **80/80 HTTP 200**, **0 échec dur**, **4 exceptions connues** (`legal/terms` EN/FR × 2 domaines, issue #101), stamp `b4232c44` sur les deux domaines, apex et `www` **octets identiques** sur les 40 routes. Les 4 écarts `#offre` de Buy EN/FR ont disparu ; l'ancre `#offre` restante sur Home est un alias **valide** (`id="offre"` présent) et **instrumenté** (`data-track="cta_click" data-cta-id="offer-status"`, libellé « Offer status — unavailable » / « Statut de l'offre — indisponible »), donc **pas** un résidu.
- **Rejeu final après le déploiement post-PR #108** (déploiement `64cfe9f8`, source `6fd1f5e`) : **80/80 HTTP 200**, **0 échec dur**, **4 exceptions connues** (`legal/terms` EN/FR × 2 domaines), stamp `b4232c44` sur les deux domaines, apex et `www` **octets identiques** sur les 40 routes. Audit `<h1>` refait : **0 route sans `<h1>`** sur les 40 routes. Le merge documentaire n'a changé **rien** au contenu servi (stamp identique, octets identiques), ce qui confirme une nouvelle fois le comportement « P0.56 bis ».

## Phase 7 — Défauts nouveaux trouvés
1. **Buy EN/FR conserve un lien de navigation vers l’ancre legacy `#offre`** (`href="./#offre"` / `href="../#offre"`, libellé « Pricing » / « Tarifs »), non instrumenté. Le lien **fonctionne** (la Home porte un alias `id="offre"` explicite, commentaire dans le source), mais il conserve le motif d'ancre précédent la PR #100 et ne produit aucun événement `cta_click`. **RÉSOLU par P0.60** (PR #107, `b2de2a6`) : Buy ne contient plus que des liens `#buy` tracés (`nav-status`, `buy-status-primary`, `mbar-status`) et plus aucun `id="offre"`. **Vérifié en direct** sur `bot-wow.com` et `www.bot-wow.com`.
2. **Liens de statut d’achat non instrumentés** en lien de prose et en navigation de pied de page : Home EN/FR (2 liens de pied de page vers `#buy`), getting-started, roadmap, success, docs/index, docs/install, cancel EN/FR. Ce sont des liens textuels secondaires, pas les CTA : les boutons de statut sont bien tracés. Impact limité à la **couverture de mesure** (`cta_click` sous-compté), pas à l'exactitude commerciale. **RÉSOLU pour Home et Buy par P0.60** (0 lien non tracé). Restent des liens de prose non instrumentés sur les routes secondaires de PR #100 (getting-started, roadmap, success, docs/index, docs/install, cancel) : **observation de couverture de mesure**, pas un défaut commercial — à trancher au prochain cycle.
3. **`cancel.html` et `fr/cancel.html` n'avaient aucun `<h1>`** — **défaut prouvé et corrigé dans ce cycle**, voir la section « Correctif P0.59 » ci-dessous. Audit `<h1>` sur les 40 routes EN/FR : **2 routes sans `<h1>` avant, 0 après**.

## Correctif P0.59 — `<h1>` manquant sur cancel EN/FR (PR #109, fusionnée)
- **Défaut prouvé** : un audit de présence de `<h1>` sur les 40 routes EN/FR publiques a montré que **seules** `cancel.html` et `fr/cancel.html` n'en avaient pas. PR #100 avait déjà corrigé le même manque sur la page jumelle `success.html` / `fr/success.html` (« missing `<h1>` added on success EN/FR ») mais a oublié `cancel`. Le manque n'avait jamais été détecté parce que `tests/e2e/responsive.spec.mjs` asserte `expect(page.locator('h1')).toBeVisible()` pour chaque route de sa liste `p056Routes` — et **`cancel.html` / `fr/cancel.html` n'y étaient pas**.
- **Correctif** : `cancel.html` → `<h1>Payment outcome <span class="grad">— not confirmed here</span></h1>` ; `fr/cancel.html` → `<h1>Résultat du paiement <span class="grad">— non confirmé ici</span></h1>`, placés comme sur `success.html` (juste après le lien de retour, avant le callout de statut). Le libellé reste **fidèle** : la page indique déjà que la visite « ne vérifie pas si un débit a eu lieu » et « ne prouve ni une annulation, ni un paiement, ni une livraison » ; le titre affirme un **résultat non confirmé** et n'affirme jamais une annulation, un remboursement ou un paiement. Il diffère volontairement de `success.html` : les deux URL peuvent être ouvertes après une tentative de paiement et ne doivent pas partager un `<h1>` identique.
- **Couverture de non-régression** : `/cancel.html` et `/fr/cancel.html` ajoutés à `p056Routes` (22 → 24 routes).
- **CI** : Validate `42146232112` **success**, UI Quality `42146232054` **success**, GitGuardian **pass** — même SHA `17800019f90b0da242bb7ed54ec84ea3458721d5`. PR **#109** fusionnée en squash le `2026-11-06T01:53:00Z`, merge SHA **`0f86536e65cb14116b63ae1ae2678c3b6bc8230c`**, 3 fichiers, **+4 lignes**.
- **Chaîne locale sur la branche du correctif** : `npm run validate` PASS ; `versionne-assets` 51 fichiers stamp `b4232c44` ; `npm test` exit 0 ; `npm run audit:css` exit 0 ; `build-site` exit 0 ; **Playwright 500 passed / 0 failed** (472 avant, +28 = 2 routes × (6 viewports + 1 garde sans webfont) × 2 projets) ; `git diff --check` exit 0.
- **Vérification live après déploiement** : `https://bot-wow.com/cancel` → `<h1>` « Payment outcome — not confirmed here » ; `https://bot-wow.com/fr/cancel` → « Résultat du paiement — non confirmé ici » ; idem sur `www.bot-wow.com`. Audit `<h1>` refait sur les 40 routes : **0 route sans `<h1>`**. Stamp servi **inchangé** (`?v=b4232c44`) : la modification porte sur du balisage de page, pas sur un asset.

## Phase 8 — Worker `botwow-api` : préparation seulement, **AUCUN DÉPLOIEMENT**
- État live (lecture seule) : version **50**, version ID `c3dcc842-c422-42d3-9828-405f30d70b5f`, deployment `36227a4d-00e7-4c9f-94e0-0913b29049bc` créé le `2026-10-27T07:46:28Z`, annotation `workers/triggered_by: secret` (ré-upload déclenché par un changement de secret, **pas** par un déploiement du correctif du 2026-11-04).
- **Confirmation de fin de cycle** (sonde GET lecture seule du `2026-11-06T02:43Z`, après les trois fusions) : le Worker live est **inchangé** — `/` 200 (39 298 o, marqueur legacy), `/bot-wow-gold` 200 (16 705 o, legacy), `/best-wow-bot` 200 (16 705 o, legacy), `/bot-wow-classic` et `/bot-wow-gratuit` 200 (16 732 o), `/de/` 200 (16 573 o), `/en/` 200 (16 569 o), `/ru/` 200 (16 574 o) ; `/health` 200 `{"status":"ok",...,"version":"1.0.0"}` ; `/api/config` 200 (140 o) ; `/api/mollie-webhook` 404 (endpoint POST uniquement). **Aucun déploiement Worker n'a été effectué pendant ce cycle.**
- Écarts v50 vs `main`, établis par comportement HTTP observé :
  - v50 sert encore du **HTML marketing legacy** en HTTP 200 sur `/bot-wow-gold` (16 705 o), `/best-wow-bot` (16 705 o), `/bot-wow-classic`, `/bot-wow-gratuit`, `/de/`, `/en/`, `/ru/` (≈16 570 o), et `/` (39 298 o).
  - `main` ne contient plus `handleLanding` (commentaire « legacy landing generator REMOVED 2026-11-04 ») et impose une **redirection 308 vers `https://bot-wow.com`** via `redirectToCanonicalSite()`, sans jamais rendre de HTML marketing.
- Invariants vérifiés **sur le source de `main`** :
  - *Suppression landing legacy* : `handleLanding` absent, aucune route SEO legacy dans le code.
  - *Suppression des fallbacks archives* : « Serve only the configured release » ; aucune archive `Casinobabe-v1.0.38` ni `v1.0.38.zip` en repli.
  - *Content-Disposition* : `attachment; filename="<clé R2 exacte>"`.
  - *Cohérence R2_OBJECT_KEY* : binding `plain_text` = `casinobabe-fishing-1.2.0.zip`, conforme au garde `^casinobabe-fishing-\d+\.\d+\.\d+\.zip$` ; **une seule** lecture `R2_BINARIES.get(objectKey)` ; la réservation de quota (`count < max_count`) n'a lieu **qu'après** avoir trouvé l'artefact ; clé absente ou format invalide → HTTP 503 `artifact_unavailable`, R2 jamais interrogé, **aucun quota réservé**.
  - *Chemin e-mail* : le chemin actif est `sendDeliveryEmail2` → `sendEmail2` → `https://api.resend.com/emails`. Le helper historique `sendDeliveryEmail` (console.log seul) **n'a aucun appelant** sur `main` — il est du code mort, distinct du chemin actif. Sans `RESEND_API_KEY`, l'envoi échoue explicitement et la livraison est **consignée en base pour rejeu** (`deliveries`, statut `pending`, type `delivery`).
  - *Idempotence et reprise webhook* : verrouillés par `tests/delivery-replay.test.mjs` (inclus dans `npm test`, exit 0) — rejeu → 200, **une seule** licence, **un seul** jeton de téléchargement, **un seul** e-mail, une seule commande ; e-mail en échec puis rejeu → licence unique, reçu passé à `sent` ; activation → aucun doublon.
- **PR #103** (`fix/p0.56-worker-fulfillment-reconciliation-20261105`, HEAD `462e13609454521a8525962321b1f8f336146db2`) : **OPEN**, `MERGEABLE` / `CLEAN`, non fusionnée, **non déployée**. CI verte sur ce HEAD : Validate `42136060489` **success**, UI Quality `42136060542` **success**. Rejeu local de `tests/worker-fulfillment-reconciliation.test.mjs` sur `462e136` → **OK, exit 0** (4 sections : aucune route marketing legacy, invariants de source, runtime du téléchargement, fournisseur e-mail fail-closed).
- Diff `worker/index.js` de PR #103 : **11 lignes**, suppression du seul stub `sendDeliveryEmail` (+8/−3). Le chemin actif n'est pas touché. `package.json` : `test:worker-reconciliation` ajouté et la suite branchée sur `npm test`.
- **Défaut confirmé sur PR #103** : `tests/worker-fulfillment-reconciliation.test.mjs` écrit `tests/.worker-under-test.mjs` (126 925 o) et **ne le supprime pas** — fichier résiduel confirmé après exécution. Correction demandée dans la revue : `os.tmpdir()` ou `unlinkSync` en `finally`.
- Synchronisation demandée dans la revue : `main...PR103` est **diverged, ahead_by=1, behind_by=3** au moment de l'inspection (merge-base `a4bb457`) → rebase sur le `main` courant + rerun des deux workflows requis sur le HEAD exact.

## Phase 9 — Revenus : réutilisation du snapshot, pas de nouvelle requête
- Aucune évolution de production ni nouvelle écriture D1/R2 depuis la revalidation P0.59 bis du `2026-11-06T00:42Z` (`docs/p0.59-live-revalidation-20261106`, commit `e4ff57d`, requêtes **SELECT uniquement**, `changed_db=false`, `rows_written=0`). Conformément à la consigne, les requêtes **n'ont pas été répétées**.
- État repris (2026-11-06T00:42Z) : payées 5 (domaines `example.com`), pending 8, rejected 1, Mollie failed 11, **payées hors test 0**, licences 5, téléchargements 5, livraisons 0, activations 0, `webhook_events` 16, contacts e-mail 12, confirmées 0.
- Analytics `test=0` : 1 944 `page_view`, 781 `journey_view`, 48 `cta_click`, 29 `checkout_requested`, 4 `checkout_start`, 6 `checkout_created`, 6 `checkout_failed`, **0** `payment_confirmed`, **0** conversion, **0** delivery, **0** activation. (Les compteurs `page_view`/`journey_view` du prompt — 1 872 / 747 — sont un état antérieur ; les compteurs métier sont identiques.)
- Mollie : un profil vérifié existant mais **domaine différent de BOT-WOW**, **aucun profil BOT-WOW** ; un webhook actif mais **URL sur un autre domaine**, **aucun webhook BOT-WOW**. Aucun paiement créé, aucun profil externe réutilisé.

## Other bindings / dépendances
- Bindings Worker lus **par nom et par type uniquement**, aucune valeur de secret lue : `RELEASE_STATUS` (`secret_text`, valeur masquée → statut effectif inconnu, **fail-closed**), `RESEND_API_KEY` (`secret_text`, présence ≠ validité), `MOLLIE_API_KEY` / `MOLLIE_PROFILE_ID` / `MOLLIE_WEBHOOK_SECRET` (`secret_text`), `R2_BINARIES` (r2), `DB` + `TELEMETRY_DB` (d1), `RATE_LIMIT` (kv), `ASSETS`. Valeurs `plain_text` : `ENVIRONMENT=production`, `MAIL_FROM=BOT-WOW <licences@bot-wow.com>`, `R2_OBJECT_KEY=casinobabe-fishing-1.2.0.zip`.
- `GET /api/config` (live, v50) : `{"contactEmail":"support@bot-wow.com","product":"bot-wow-lifetime","priceEur":20,"currency":"eur","bitcoin":{"enabled":true,"address":null}}` — **aucun champ de disponibilité**. `bitcoin.enabled=true` avec `address=null` reste un signal résiduel ; c'est une décision de rail de paiement hors périmètre de l'issue #99 et **aucun front-end ne consomme `config.bitcoin`** → signalé, **inchangé**.
- `GET /health` : 200 `{"status":"ok",...,"version":"1.0.0"}` (version de contrat API, pas la version du Worker). `GET /api/mollie-webhook` : 404 (endpoint POST uniquement) — aucune requête de paiement n'a été émise.
- SHA-256 de l'archive : **conforme** (`1c132f367607ea186feffde8bbda0a1a9f94cdec4b7850b93c57c271270bba4f`, 1 387 543 o, 30 entrées ZIP, `VERSION` et `MANIFEST.json` présents) — preuve P0.7 du 2026-10-28, `reports/operations/2026-10-28-p0.7-r2-sha256-verification.md`. Le **contenu** de `VERSION`/`MANIFEST.json` et la **compatibilité** ne sont pas validés.

## Cloudflare Pages — état vérifié
- Projet `bot-wow` : `production_branch=main`, `build_command=node scripts/build-site.mjs _site`, `destination_dir=_site`, source Git `github` (`aveca/bot-wow`).
- Déploiement canonique : `64cfe9f8-3670-48a3-8660-f3d68eb19824`, environnement `production`, branche `main`, `deployment_trigger=github:push`, commit source **`6fd1f5e45c4c0f6b66912d3b987bc84074d2a21a`** (= merge SHA de PR #108), créé le `2026-11-06T02:41:18Z`, étape `deploy` **SUCCESS** (`02:41:28Z` → `02:41:33Z`). Ce déploiement est celui **produit par la fusion de PR #108 lui-même** (cf. « Règle permanente » ci-dessous). Déploiements antérieurs toujours disponibles en rollback : `155a9b9e` (source `b2de2a6`, PR #107), `c8c05ca3` (source `0f86536`, PR #109), `ff13930a` (source `21c2e3e`), `e1892843` (`2b0dd14`), `af45d9ec` (`f958684`), `321aeb92` (`a4bb457`).
- **Règle permanente (à appliquer à chaque cycle)** : l'intégration Git Cloudflare Pages déclenche un rebuild **sur tout push sur `main`, y compris un merge documentaire** (P0.56 bis). Le deployment ID consigné ci-dessus est donc **par construction le rebuild produit par le merge du présent document** ; le merge suivant produira un nouveau deployment ID. **Ne jamais déduire le deployment canonique de ce document** — le lire systématiquement en direct :
  `wrangler pages deployment list --project-name bot-wow --environment production`
  puis contrôler que le `source` du deployment canonique **égale** le SHA de `main`. Les assertions **stables** (celles qui doivent rester vraies quel que soit l'ID du rebuild) sont : `source du deployment == SHA de main`, `stamp servi == b4232c44`, `contenu identique entre apex et www`, `80/80 HTTP 200`.
- `preview_deployment_setting = "none"` : les previews sont **désactivés** au niveau du projet. Vingt déploiements `preview` existent néanmoins sur la branche `fix/p0.60-primary-routes-status-only-20261106` (créés entre `00:57:13Z` et `01:04:51Z` le 2026-11-06, `deployment_trigger=github:push`), antérieurement à la fusion de PR #107 ; ils appartiennent à la mission P0.60, pas à ce cycle. Aucun preview n'a été créé par ce cycle.
- Correspondance main ↔ deployment ↔ contenu servi : `main` `6fd1f5e` → deployment `64cfe9f8` (source `6fd1f5e`) → contenu servi avec stamp `b4232c44`, identique à `versionne-assets` calculé sur ce même `main`, et identique entre apex et `www`. Les trois niveaux concordent.
- **Mécanique du stamp** : `scripts/build-site.mjs` importe `computeStamp`/`applyStamp` de `scripts/versionne-assets.mjs` et applique le stamp **à l'artefact construit**, pas à la source. La source commitée conserve `?v=cb3925b6` ; l'artefact publié porte `?v=b4232c44`, dérivé du **contenu des assets**. Conséquence : une modification de balisage HTML **sans** changement d'asset laisse le stamp inchangé, et le resync mécanique n'a pas à être committé (convention du dépôt respectée).

## Phase 7 bis — Vérification live après la fusion de P0.60 (PR #107, `b2de2a6`)
- PR #107 (`fix/p0.60-primary-routes-status-only-20261106`) a été fusionnée en squash pendant ce cycle : `main` = **`b2de2a6`**. Déploiement Pages automatique : **`155a9b9e-202c-4bad-a78e-92d3cb7164b1`**, source `b2de2a6`.
- Contenu servi après déploiement (relevé direct sur le HTML live) :
  - Home EN H1 = **« BOT-WOW project status »** / Home FR H1 = **« BOT-WOW statut du projet »**.
  - Buy EN H1 = **« Purchase unavailable »** / Buy FR H1 = **« Achat indisponible »**.
  - Buy EN/FR : plus aucun `id="offre"`, plus aucun `href` vers `#offre` ; uniquement 3 liens `#buy` tracés (`nav-status`, `buy-status-primary`, `mbar-status`).
  - Home EN/FR : l'ancre `#offre` restante est un **alias valide et instrumenté** (`id="offre"` présent, `data-track="cta_click" data-cta-id="offer-status"`, libellé « Offer status — unavailable » / « Statut de l'offre — indisponible ») → **pas** un résidu de lien mort.
- Balayage live complet rejoué sur ce déploiement : **80/80 HTTP 200, 0 échec dur, 4 exceptions connues** (`legal/terms` EN/FR × 2 domaines, issue #101), stamp `?v=b4232c44` sur les deux domaines, apex et `www` **octets identiques** sur les 40 routes.
- Aucun `checkout_requested` n'est déclenché par une consultation de statut : aucun des identifiants whitelistés (`hero-offer`, `mbar-buy`, `final-buy`, `compare-buy`, `nav-buy`, `journey-fish-buy`, `journey-licence-buy`, `steps-buy`) n'apparaît dans le HTML servi des 40 routes.
- Le stamp est resté **`b4232c44`** : P0.60 n'a modifié **aucun** asset (diff = 4 pages HTML + 6 fichiers de test + 1 rapport, 12 fichiers, +467/−1576) ; le stamp étant dérivé du **contenu des assets**, il reste donc identique — aucune dérive de cache-busting.

## Conformité et garde-fous
- Aucune autorisation applicable documentée pour l'automatisation de gameplay sur des services Blizzard. **NO-GO commercial** pour le bot actuel : ni promotion, ni distribution, ni mise en avant.
- Les corps des documents juridiques (issue #101) restent inchangés.
- Garde-fous respectés sur ce cycle : pas de modification de prix, pas d'ouverture de checkout, aucun paiement, aucun profil Mollie créé ou réutilisé, aucun secret ni binding modifié, `RELEASE_STATUS` inchangé, **aucun déploiement Worker**, aucune écriture D1/R2, aucun e-mail envoyé, aucun changement DNS, **aucune purge de cache**, aucun achat de trafic, aucune modification des conditions juridiques, aucun travail sur un autre dépôt.
- Seules modifications applicatives du dépôt imputables à ce cycle : PR #109 (`cancel.html`, `fr/cancel.html`, `tests/e2e/responsive.spec.mjs`, +4 lignes). PR #107 (P0.60) a été fusionnée en parallèle par la mission concurrente. PR #108 et ce document de clôture sont **de la documentation** (`reports/operations/BOT-WOW-CURRENT-STATE.md`). Rappel P0.56 bis : un merge documentaire déclenche **quand même** un rebuild Cloudflare Pages via l'intégration Git ; l'artefact est reconstruit **à l'identique** (stamp `b4232c44`, octets apex == www), rollback `155a9b9e` disponible.

## Blocages (état à la fin du cycle)
1. **Issue #102 — RÉSOLU** par PR #107 (P0.60, `b2de2a6`) : Home EN/FR et Buy EN/FR sont désormais « status-only ». Vérifié en direct : Home H1 = « BOT-WOW project status » / « BOT-WOW statut du projet » ; Buy H1 = « Purchase unavailable » / « Achat indisponible » ; plus aucune instruction d'installation/lancement, plus aucune promesse paquet/licence/activation/mise à jour/remboursement/livraison ; plus aucun lien legacy `#offre` sur Buy ; avertissement Blizzard conservé ; corps juridiques intacts.
2. **Issue #101 — OUVERT** : corps de `legal/terms` EN/FR non conformes aux assertions commerciales (promesse d'envoi de la licence et du lien par e-mail, activation sur une machine) ; **gelés**, approbation propriétaire/juridique requise. Seul écart résiduel du balayage live (4 chargements sur 80).
3. **Issue #99 — OUVERT** : Worker v50 non déployé : écart landing legacy / fallbacks archives / stub e-mail mort ; PR #103 ouverte, non fusionnée, non déployée ; **autorisation de déploiement explicite requise**.
4. **Provenance de l'artefact** : SHA-256 conforme et archive ZIP cohérente, mais **contenu de `VERSION`/`MANIFEST.json` et compatibilité non validés** ; aucun chemin de lecture R2 autorisé pour re-vérifier.
5. **`RELEASE_STATUS`** : secret masqué, valeur effective inconnue → comportement fail-closed ; validité de `RESEND_API_KEY` et des identifiants Mollie non vérifiable sans les exposer.
6. **PR #103** : correction du fichier temporaire résiduel (`tests/.worker-under-test.mjs`, 126 925 o) + rebase sur `b2de2a6` + rerun CI requis avant toute décision de fusion.
7. **Couverture de mesure (non bloquant)** : les liens de statut en prose des routes secondaires de PR #100 (`getting-started`, `roadmap`, `success`, `docs/index`, `docs/install`, `cancel` EN/FR) ne sont pas instrumentés en `cta_click`. Les CTA boutons le sont. Impact : `cta_click` sous-compté, **aucune** inexactitude commerciale.
8. **`/api/config` (live v50)** : `bitcoin: { enabled: true, address: null }` — rail de paiement résiduel annoncé sans adresse. Hors périmètre de l'issue #99 ; **aucun front-end ne consomme `config.bitcoin`** ; signalé, inchangé.

## Action suivante (une seule)
**P0 : préparer la fusion et le déploiement du Worker `botwow-api` (issue #99) — PR #103** — depuis `main` = `b2de2a6` : (1) supprimer le fichier temporaire résiduel `tests/.worker-under-test.mjs` (écriture dans `os.tmpdir()` ou `unlinkSync` en `finally`) ; (2) rebaser PR #103 sur `b2de2a6` ; (3) rerun Validate + UI Quality sur le HEAD exact ; (4) inspecter le diff final (attendu : suppression du seul stub mort `sendDeliveryEmail`, 11 lignes, chemin actif `sendDeliveryEmail2 -> sendEmail2 -> Resend` intact) ; (5) **fusionner en squash puis déployer uniquement si le propriétaire donne l'autorisation explicite de déploiement** — le déploiement est aujourd'hui interdit par défaut ; (6) après déploiement, re-vérifier en direct que `/bot-wow-gold`, `/best-wow-bot`, `/bot-wow-classic`, `/bot-wow-gratuit`, `/de/`, `/en/`, `/ru/` répondent **308 vers `https://bot-wow.com`** et ne rendent plus de HTML marketing, que `/health` et `/api/config` restent stables, sans déclencher de checkout, de paiement ni d'e-mail. Aucun checkout, aucun paiement, aucun profil Mollie, aucun secret modifié.
### Prompt complet du cycle suivant (P0.61)

```text
MISSION BOT-WOW P0.61
LIVE REVALIDATION AFTER P0.60 + WORKER DEPLOYMENT DECISION

REPOSITORY:
https://github.com/aveca/bot-wow

PRODUCT:
BOT-WOW uniquement.

MAIN:
verifier le SHA reel de main au demarrage
(attendu apres P0.59 : fusion de la PR #109 "fix(a11y): restore the
missing h1 on the EN/FR cancel pages" puis de la PR #108
"docs(operations): record P0.59 live revalidation on apex and www" ;
si la PR #107 (P0.60) a ete fusionnee entre-temps, partir de ce SHA).

PR #107:
fix/p0.60-primary-routes-status-only-20261106
PR #108:
docs/p0.59-live-verification-20261106
PR #109:
fix/p0.59-cancel-h1-20261106
PR #103 (Worker, preparation seule):
fix/p0.56-worker-fulfillment-reconciliation-20261105

ISSUES:
#99  Worker v50 / fulfillment (PR #103)
#101 corps des documents juridiques figes
#102 Home/Buy : pages primaires a rendre "status-only"

LATEST VALIDATE:
a verifier sur le SHA de main courant

LATEST UI QUALITY:
a verifier sur le SHA de main courant

LATEST PRODUCTION:
a verifier avec
wrangler pages deployment list --project-name bot-wow --environment production

ROLLBACK:
a verifier ; dernier rollback connu : 321aeb92-5a58-4e83-a80a-293038c1d610
(source a4bb457). Conserver au moins un rollback anterieur a chaque merge.

==================================================
PHASE 1 — REPRISE
==================================================

Lire :
AGENTS.md
PRODUCT.md
reports/operations/BOT-WOW-CURRENT-STATE.md

Verifier et consigner :
- main SHA reel ;
- branche et HEAD ;
- etat de chaque PR (#107, #108, #109, #103) : ouverte / fusionnee, merge SHA ;
- commentaires et revues ;
- derniers commits ;
- derniers workflows (Validate + UI Quality) ;
- Cloudflare production : deployment ID, source commit, statut Build et Deploy ;
- regle de preview : preview_deployment_setting du projet Pages (attendu "none").

Preserver les modifications existantes.
Ne pas refaire les audits deja termines.
Correction de reference : le prompt P0.59 etait perime (main etait
21c2e3e, PR #100 deja fusionnee en f958684, run UI Quality 42120739142
en realite "success" sur 938b972 et non "in progress"). Verifier
toujours l'etat reel avant d'agir.

==================================================
PHASE 2 — VERIFIER LES CORRECTIFS P0.59 ET P0.60
==================================================

Correctifs P0.59 deja fusionnes, a confirmer en production :
- PR #109 : <h1> "Payment outcome — not confirmed here" (EN) et
  "Resultat du paiement — non confirme ici" (FR) sur /cancel et /fr/cancel ;
- couverture de non-regression : /cancel.html et /fr/cancel.html dans
  p056Routes de tests/e2e/responsive.spec.mjs (24 routes, +28 tests).

Verifier sur le site live :
- presence du h1 sur /cancel et /fr/cancel ;
- absence de debordement horizontal a 320/375/391/430/768/1280 ;
- aucune assertion commerciale nouvelle.

Correctifs P0.60 (PR #107) a confirmer s'ils sont merges :
- Home EN/FR et Buy EN/FR en "status-only" : hero operationnel
  remplace, instructions d'installation/lancement supprimees, promesses
  paquet/licence/activation/mise a jour/remboursement/livraison retirees,
  prix cible 20 EUR conserve comme reference historique non payable,
  avertissement Blizzard conserve ;
- Buy EN/FR : plus aucun lien de navigation vers l'ancre legacy #offre ;
- Home EN/FR : plus aucun lien de statut en prose ou en pied de page
  non trace (data-track="cta_click" + data-cta-id).

Si un element n'est pas corrige, le corriger sur la branche dediee,
ajouter la couverture de test correspondante, ne jamais desactiver un
test.

==================================================
PHASE 3 — INSPECTION DU DIFF
==================================================

Inspecter le diff reel de chaque PR concernee avant toute decision de
fusion :
- nombre de fichiers, lignes ajoutees/supprimees ;
- presence de toute modification hors perimetre (prix, checkout,
  Worker, secrets, bindings, D1/R2, e-mail, DNS, corps juridiques) ;
- texte des pages secondaires et primaires EN/FR.

Criteres de conformite a revérifier sur toutes les routes :
- aucun CTA Buy/Acheter immediat ;
- aucun achat a vie presente comme disponible ;
- aucun Mollie actif annonce ;
- aucune livraison garantie ;
- aucune activation garantie ;
- aucune procedure d'installation presentee comme disponible ;
- aucune page success consideree comme preuve de paiement ;
- CTA purchase-status correctement trace (data-track + data-cta-id) ;
- aucun checkout_requested genere par consultation du statut ;
- corps des documents juridiques inchanges (issue #101).

==================================================
PHASE 4 — TESTS LOCAUX
==================================================

Si Factory dispose de l'environnement :

npm run validate
node scripts/versionne-assets.mjs
npm test
npm run audit:css
node scripts/build-site.mjs _site
node node_modules/@playwright/test/cli.js test
git diff --check

Executer reellement.
Ne pas inventer de resultats locaux.
Note : npm run test:e2e est casse sous npm/PowerShell en local ; utiliser
node node_modules/@playwright/test/cli.js test.
Reference attendue au demarrage : 500 tests passes / 0 echecs.
Ne jamais committer le resync mecanique de versionne-assets (convention
du depot) : seul le contenu du artefact compte.

==================================================
PHASE 5 — MERGE
==================================================

Si, pour chaque PR :
- Validate SUCCESS ;
- UI Quality SUCCESS ;
- meme SHA pour les deux checks ;
- PR mergeable ;
- diff inspecte ;
- rollback disponible ;

Fusionner en squash. Un seul merge par PR, dans l'ordre :
1. PR #109 (correctif a11y) si elle ne l'est pas deja ;
2. PR #107 (P0.60) si elle est verte et son diff a ete inspecte ;
3. PR #108 (documentation) en dernier.

Enregistrer chaque merge SHA.
Ne jamais contourner branch protection, checks GitHub ou AGENTS.md.
Rappel : un merge documentaire declenche quand meme un rebuild Cloudflare
Pages via l'integration Git (P0.56 bis). Verifier le deploiement
resultant, ne pas le supposer.

==================================================
PHASE 6 — CLOUDFLARE PAGES
==================================================

Projet :
bot-wow

Apres chaque fusion :
attendre le deploiement automatique ;
verifier deployment ID, source commit, Build SUCCESS, Deploy SUCCESS ;
verifier que le source commit du deploiement correspond au main fusionne ;
verifier le stamp servi (?v=...) : il doit rester stable si aucun asset
n'a change (le stamp est derive du contenu des assets et applique par
build-site.mjs sur l'artefact, pas sur la source).

Rollback :
conserver au moins un deploiement de production anterieur.

Preview deployments :
desactives (preview_deployment_setting = "none").
Ne pas creer de preview manuellement.
Si des previews apparaissent, documenter leur origine (branche
concurrente) sans les utiliser comme source de verite.

==================================================
PHASE 7 — LIVE HTTP
==================================================

Tester les 40 routes EN/FR (36 de
tests/release-availability.test.mjs + Home, Buy EN/FR).

Priorite :
Home
Buy
Demo
Features
Getting Started
Success
Cancel
Documentation
Compatibility
FAQ
Roadmap

Pour chaque route :
- HTTP status ;
- URL finale ;
- contenu reel ;
- CTA ;
- lien purchase-status ;
- presence d'au moins un <h1> ;
- absence de promesse d'achat ;
- absence de livraison garantie ;
- conformite du texte.

Tester :
bot-wow.com
www.bot-wow.com

Comparer :
main SHA fusionne
Pages deployment source SHA
contenu reellement servi
stamp servi

Ne pas attribuer une anomalie au cache sans preuve HTTP.
Ne pas purger Cloudflare.
Verifier explicitement que consulter le statut d'achat n'emmet pas
checkout_requested (comparer la liste des identifiants de CTA de
analytics.js avec ceux presents dans le HTML servi).

==================================================
PHASE 8 — WORKER
==================================================

Worker :
botwow-api

Version :
50

Version ID :
c3dcc842-c422-42d3-9828-405f30d70b5f

Deployment :
36227a4d-00e7-4c9f-94e0-0913b29049bc

Constat P0.59 : la v50 sert encore du HTML marketing legacy sur
/bot-wow-gold, /best-wow-bot, /bot-wow-classic, /bot-wow-gratuit,
/de/, /en/, /ru/ et /, alors que main ne rend plus de HTML marketing et
redirige en 308 vers https://bot-wow.com.

Travail de preparation a faire :
- PR #103 : supprimer le stub mort sendDeliveryEmail (aucun appelant sur
  main ; ne pas le confondre avec le chemin actif
  sendDeliveryEmail2 -> sendEmail2 -> Resend) ;
- PR #103 : corriger le fichier temporaire residuel
  tests/.worker-under-test.mjs (os.tmpdir() ou unlinkSync en finally) ;
- PR #103 : rebaser sur le main courant et rerun Validate + UI Quality
  sur le HEAD exact ;
- verifier sur le source : suppression landing legacy, suppression des
  fallbacks archives (Casinobabe-v1.0.38, v1.0.38.zip), Content-Disposition
  = cle R2 exacte, coherence R2_OBJECT_KEY, reservation de quota
  seulement apres finding de l'artefact, idempotence, livraison email,
  reprise webhook.

Ne pas deployer le Worker sans autorisation explicite du proprietaire.
Si l'autorisation est donnee dans ce cycle, deployer la version resultante,
puis re-verifier en direct :
- /bot-wow-gold, /best-wow-bot, /bot-wow-classic, /bot-wow-gratuit,
  /de/, /en/, /ru/ doivent repondre 308 vers https://bot-wow.com et ne
  plus rendre de HTML marketing ;
- /health et /api/config doivent rester stables ;
- aucune requete de checkout, aucun paiement, aucune e-mail.

==================================================
PHASE 9 — REVENUS
==================================================

Dernier D1 (SELECT uniquement, 2026-11-06T00:42Z) :
Paid 5 (example.com) / Pending 8 / Rejected 1 / Mollie failed 11
Paid non-test 0 / Licences 5 / Downloads 5 / Deliveries 0 / Activations 0
Webhooks 16 / Contacts 12 / Confirmed 0
Analytics : 1944 page views, 781 journey views, 48 CTA clicks,
29 checkout requested, 4 checkout starts, 6 checkout created,
6 checkout failed, 0 payment confirmed, 0 conversion, 0 delivery,
0 activation.

Ne repeter les requetes que si une nouvelle evolution ou un changement
de production le justifie (par exemple un deploiement Worker, une
creation de profil Mollie ou un e-mail reelement envoye).
Toute requete doit etre en lecture seule : changed_db=false,
rows_written=0. Ne jamais creer de paiement, de licence, de contact ni
de webhook.

==================================================
GARDE-FOUS
==================================================

NE PAS :
- modifier prix;
- ouvrir checkout;
- creer paiement;
- creer profil Mollie;
- reutiliser un profil d'une autre activite;
- modifier secrets;
- modifier RELEASE_STATUS;
- deployer le Worker sans autorisation explicite;
- ecrire D1;
- ecrire R2;
- envoyer emails;
- modifier DNS;
- purger cache;
- acheter trafic;
- modifier conditions juridiques;
- promouvoir le bot sans autorisation applicable;
- travailler sur un autre depot;
- committer le resync mecanique de versionne-assets;
- committer artifacts/ ni test-results/.

==================================================
RAPPORT FINAL
==================================================

1. MAIN SHA
2. PR107
3. PR108
4. PR109
5. PR103
6. MERGE SHA(s)
7. VALIDATE
8. UI QUALITY
9. PLAYWRIGHT COUNT
10. TESTS LOCAUX
11. FILES MODIFIED
12. HOME EN/FR
13. DEMO EN/FR
14. FEATURES EN/FR
15. GETTING STARTED EN/FR
16. SUCCESS EN/FR
17. CANCEL EN/FR
18. DOCS EN/FR
19. LIVE HTTP
20. CLOUDFLARE DEPLOYMENT
21. ROLLBACK
22. WORKER
23. RELEASE_STATUS
24. RESEND
25. MOLLIE
26. D1
27. ANALYTICS
28. PACKAGE SHA256
29. SALES
30. REVENUE
31. DELIVERY / ACTIVATIONS
32. COMPLIANCE / BLOCKERS / NEXT PRIORITY

Actualiser :
reports/operations/BOT-WOW-CURRENT-STATE.md

Terminer par le prompt complet du cycle suivant.
```