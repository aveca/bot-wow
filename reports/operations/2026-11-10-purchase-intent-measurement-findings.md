# Mesure de l'intention d'achat — bilan de mission et défaut vivant

**Date :** 2026-11-10
**Dépôt :** `aveca/bot-wow` — branche de publication : `docs/purchase-intent-measurement-findings-20261110`
**Contexte :** travail de l'agent Grok Bot du 27/10/2026 (« mesurer les CTA d'achat invisibles »),
poursuivi et cloturé ici.

---

## 1. Mission du 27/10/2026 — ce qui a été fait (VÉRIFIÉ DIRECTEMENT)

**Défaut d'origine (rapporté, mission Grok Bot du 27/10) :** trois liens d'achat réels
(`href` → `#buy`) n'émettaient aucun `checkout_requested` : `demo-offer` (demo.html),
`buy-hero-primary` (buy.html), `formula-ours-buy` (compare.html), EN + FR. Preuve par les
données de production (D1, lecture seule) : les événements `checkout_requested` ne
portaient que `hero-offer`, `final-buy` et `nav-buy`.

**Correctif et garde-fous livrés** (branche `fix/buy-cta-measure-20261027`, commit
`cb32333`, PR <https://github.com/aveca/bot-wow/pull/175>) :

| Élément | État |
|---|---|
| `assets/analytics.js` | Sélecteur `checkout_requested` élargi de 8 à 11 CTA (ajout des trois identifiants) |
| `tests/buy-cta-coverage.test.mjs` | Garde-fou : déduit les CTA d'achat réels du HTML servi et vérifie que chacun est mesuré ; exclut les CTA de démo/navigation. Câblé dans `npm test` |
| `tests/e2e/buy-cta-measure.spec.mjs` | Preuve navigateur : les trois CTA corrigés émettent `checkout_requested` ; `hero-demo` ne l'émet pas |
| `package.json` | `test:cta-coverage` + intégration à `npm test` |
| Stamp de cache | `f5e17402`, recalculé par `node scripts/versionne-assets.mjs` (51 fichiers) et vérifié égal à l'empreinte réelle des assets |
| `reports/growth/2026-10-27-bot-wow-sale-readiness.md` | Corrections : échappements unicode littéraux (`\u2019`, `\u00e9`) produits par un script one-shot, phrase dupliquée, chiffres du funnel recalculés (chute étape 3 → 4 : 85,2 % → 76,9 %, 26 intentions → 6 checkouts) |

**Contrôles exécutés sur cet état :** `npm test` 18 suites OK · `npm run validate` PASS ·
`npm run audit:css` OK · `npx playwright test` **74 passed** (dont les 8 nouveaux) ·
stamp vérifié = empreinte réelle des assets modifiés.

## 2. Pourquoi ce correctif n'est pas fusionnable aujourd'hui (VÉRIFIÉ DIRECTEMENT)

La PR #175 était basée sur un commit local **jamais poussé** (`d041665`), à 150 commits
derrière `main` : elle était `CONFLICTING` et aurait déversé cinq jours de travail
étranger dans `main`. Surtout, **sa prémisse a disparu** :

- **PR #172 fusionnée le 2026-11-10T00:18:55Z** (« vitrine arcade, médias et CTA, achat
  toujours fermé ») a réécrit les CTG des pages de vente.
- Inventaire direct des liens `#buy` sur `origin/main` (HTML servi) :

| Page | Liens vers `#buy` (`data-cta-id`) |
|---|---|
| `index.html`, `fr/index.html` | `nav-buy`, `hero-status`, `final-status`, `mbar-status` |
| `buy.html`, `fr/buy.html` | `nav-status`, `buy-status-primary`, `mbar-status` |
| `ab/{a,b}/buy.html`, `ab/{a,b}/fr/buy.html` | `nav-buy`, `buy-hero-primary`, `mbar-buy` (artefacts A/B isolés) |

- `demo-offer` et `formula-ours-buy` **n'existent plus** sur les pages réelles ;
  `buy-hero-primary` ne survit que dans les artefacts A/B.
- `buy.html` affiche `<div id="purchase-unavailable" class="checkout-blocked">` :
  aucun formulaire de paiement, aucun champ e-mail.

Les trois identifiants ajoutés par la mission du 27/10 seraient donc des **entrées
mortes** dans le sélecteur. La PR #175 est fermée comme « dépassée par l'état de
`main` » ; la branche et le commit `cb32333` restent sur GitHub, rien n'est supprimé.

## 3. Défaut vivant trouvé — NON corrigé (scope actif ailleurs)

**Fait (VÉRIFIÉ DIRECTEMENT) :** le sélecteur `checkout_requested` de
`assets/analytics.js` sur `main` mesure huit identifiants :
`hero-offer`, `mbar-buy`, `final-buy`, `compare-buy`, `journey-fish-buy`,
`journey-licence-buy`, `steps-buy`, `nav-buy`.

| Identifiant mesuré | Existe dans le HTML servi comme lien `#buy` ? |
|---|---|
| `hero-offer` | non (remplacé par `hero-status`) |
| `mbar-buy` | non (remplacé par `mbar-status`) |
| `final-buy` | non (remplacé par `final-status`) |
| `compare-buy` | non |
| `journey-fish-buy` | non |
| `journey-licence-buy` | non |
| `steps-buy` | non |
| **`nav-buy`** | **oui — `index.html` et `fr/index.html`** |

L'élément concerné est, sur `main` :

```html
<a class="btn btn-gold" href="#buy" data-track="cta_click" data-cta-id="nav-buy">Purchase unavailable</a>
```

**Conséquence :** chaque clic sur ce bouton doré libellé « Purchase unavailable » émet
`checkout_requested`, c'est-à-dire une **intention d'achat sur une boutique fermée**.
En production (RAPPORTÉ, D1 `botwow-analytics` `test=0`, relevé du 2026-11-06,
PROJECT_STATE.md) : `checkout_requested` = **29 événements**, dernier le
**2026-11-04T02:47:00Z**, alors que l'achat public est fermé depuis le 28/10/2026 et
qu'aucun paiement réel n'existe. Au moins les clics `nav-buy` sont des faux positifs
par construction.

Sens inverse, également vérifié : les nouveaux CTG de statut (`hero-status`,
`final-status`, `mbar-status`, `nav-status`, `buy-status-primary`) **ne sont pas**
mesurés comme intention d'achat — comportement correct, ils mènent à un avis, pas à
un achat.

**Pourquoi ce n'est pas corrigé ici :** le périmètre « statut d'achat / réouverture du
checkout » est **actif et verrouillé** (`20261107-checkout-flag` — `checkout-flag-draft`,
PR brouillon ; `20261109-pixel-skin` livrée par PR #172 ; tâche
`BOTWOW-P0-REAL-PAYMENT-TEST-PREP-20261107`). Les règles du dépôt interdisent d'ouvrir
un second chantier sur un scope actif : le défaut est donc **publié**, pas corrigé.
Aucune modification de `assets/analytics.js`, des pages, des tests ou de
`package.json` n'est faite dans cette branche.

## 4. Règle proposée au propriétaire du scope (à reprendre quand il est libre)

Un lien d'achat = un `<a>` dont le `href` ouvre le **parcours d'achat actionnable**
(ancre `#buy` **avec** formulaire de paiement/e-mail présent), jamais un avis de statut.
Le garde-fou à deux sens, déduit du HTML servi :

1. tout lien d'achat actionnable figure dans le sélecteur `checkout_requested` ;
2. tout identifiant du sélecteur correspond à un tel lien (interdit les entrées mortes
   et les CTG de statut/navigation) ;
3. aucun CTA de démo/navigation n'est compté comme intention d'achat.

Aujourd'hui, `main` ne compte **aucun** lien d'achat actionnable : le sélecteur devrait
être vide de tout identifiant (exception faite de `nav-buy`, à retirer tant que l'achat
est fermé), et la mesure repartirait automatiquement dès la réouverture.

## 5. Éléments conservés de la mission du 27/10

| Fichier | Raison |
|---|---|
| `.gitignore` | `tests/.worker-download-delivery.mjs` : copie temporaire de Worker générée par `tests/download-delivery.test.mjs` (même règle que `tests/.worker-under-test.mjs`) |

Les requêtes SQL d'audit en lecture seule qui fondent les chiffres de la mission du
27/10 sont reproduites ci-dessous (aucune donnée client, aucun résultat copié). Elles
sont conservées localement sous `.audit/` pour rejeu, et **ne sont pas versionnées** :
`.gitignore` (lignes 27-29) exclut explicitement `.audit/` (« artefacts d'audit locaux
… jamais versionnés »). Le rapport versionné est donc le seul endroit publié.

```sql
-- Commandes par fournisseur et statut (montants, bornes, mode Mollie).
SELECT provider, status, COUNT(*) AS n, SUM(amount) AS cents,
       MIN(datetime(created_at/1000,'unixepoch')) AS first_seen,
       MAX(datetime(created_at/1000,'unixepoch')) AS last_seen,
       SUM(CASE WHEN instr(metadata, char(34)||'mode'||char(34)||':'||char(34)||'test') > 0 THEN 1 ELSE 0 END) AS mollie_test,
       SUM(CASE WHEN instr(metadata, char(34)||'mode'||char(34)||':'||char(34)||'live') > 0 THEN 1 ELSE 0 END) AS mollie_live
FROM orders GROUP BY provider, status ORDER BY provider, status;

-- Qualité des adresses e-mail des commandes (domaines distincts, adresses de test).
SELECT provider, status, COUNT(*) AS n,
   SUM(CASE WHEN instr(email, '@example.') > 0 OR instr(email,'@test') > 0 OR instr(email,'@localhost') > 0 THEN 1 ELSE 0 END) AS obvious_test,
   COUNT(DISTINCT substr(email, instr(email,'@')+1)) AS distinct_domains
FROM orders GROUP BY provider, status;
```

Le correctif, les deux tests, le stamp et les corrections de rapport du 27/10 restent
disponibles sur la branche `fix/buy-cta-measure-20261027` (commit `cb32333`) : rien
n'est supprimé, ils ne sont simplement plus l'état publié de `main`.

## 6. Prochaine action (une seule)

**Au propriétaire du scope checkout :** trancher ce qu'est une « intention d'achat »
aujourd'hui — clic sur un CTA de statut, ou clic sur un vrai parcours d'achat — puis
appliquer la règle du §4 au sélecteur `checkout_requested` (retirer `nav-buy` et les
sept identifiés morts tant que l'achat est fermé) et câbler le garde-fou correspondant.

---

**Aucun secret, aucun paiement, aucun e-mail, aucun déploiement, aucune écriture D1/R2,
aucune modification de `assets/`, des pages, des tests ou de `package.json` dans cette
branche.** Faits non revérifiés ici : les comptes D1 de production (§3, repris de
`PROJECT_STATE.md`), et le comportement du Worker déployé (non redéployé dans ce cycle).
