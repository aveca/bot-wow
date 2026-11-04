# BOT-WOW — État courant Factory V3

**Dernière mise à jour de ce document : 2026-11-04T11:10Z** (revérification
post-merge PR #71 — preuve de livraison v1.2.0)

---

# 0. État au 2026-11-04 — Mission revenue (ONE CORE OFFER)

**Dépôt :** https://github.com/aveca/bot-wow
**Branche de travail :** `docs/current-state-refresh-20261104` (base `origin/main` @ `084e2bd`)
**PRs mergées :** https://github.com/aveca/bot-wow/pull/70 · https://github.com/aveca/bot-wow/pull/71 · https://github.com/aveca/bot-wow/pull/73
**Rapport d'évidence :** `reports/operations/BOT-WOW-REVENUE-STATE-2026-11-04.md`
**Rapport livraison :** `reports/operations/2026-11-04-p0-delivery-proof.md`

## 0.0 Revérification du 2026-11-04T11:10Z (après le merge de la PR #71)

| Élément | Valeur | Statut |
|---|---|---|
| `main` | `084e2bd` (merge PR #71, 2026-11-04T08:57:50Z) | MERGED |
| PR #71 | « P0 — preuve de livraison v1.2.0 + garde + reprise idempotente » (`worker/index.js` **+185 / −72**, `tests/delivery-replay.test.mjs` 41 contrôles, intégration PR #19 + PR #44) | MERGED |
| PR #73 | « retirer les règles www mortes et documenter la remediation zone-level » | MERGED (`dfc11582`, 08:18:44Z) |
| Pages (PR #71) | deployment `7542044619` (sha `084e2bd`) | **success** — en ligne |
| Pages (PR #73) | deployment `7541341864` (sha `dfc11582`) | **success** — en ligne |
| Pages (PR #70) | deployment `7540967184` (sha `e2a93384`) | **success** — en ligne |
| **Worker `botwow-api`** | tag `20f5821adfeb465cae177120c9015f8f`, `modified_on = 2026-10-27T07:46:02Z` | **NON REDÉPLOYÉ** — le code Worker de #70, #71 et #73 n'est pas en production |

### Mesures live du 2026-11-04T11:10Z (directement vérifiées)

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

### Garde-fou commercial — vérifié ACTIF en production le 2026-11-04T11:10Z

Contrôle du HTML servi par `https://bot-wow.com/buy` et `https://bot-wow.com/fr/buy`
(lecture seule) :

| Contrôle | `/buy` | `/fr/buy` |
|---|---|---|
| Marqueur `checkout-blocked` présent | **oui** | **oui** |
| Bouton d'achat `disabled` | **oui** | **oui** |
| Prix affiché 20 € | **oui** | **oui** |
| Aucun palier (4,99 / 7,99 / 9,99) | **oui** | **oui** |
| Aucune mention d'abonnement | **oui** | **oui** — « **Pas d'abonnement**, pas de module caché, pas de renouvellement surprise » |

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
2. Règle **301 `www` → apex** dans `_redirects` (GitHub Pages n'applique
   pas `_redirects` : le `www` y reste en 200 — limite documentée).
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
| Pages (`main`) | `main` = `084e2bd` — déploiement Pages `7542044619` **success** (09:00:28Z) |
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