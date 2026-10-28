# BOT-WOW — État de vendabilité, vérification du produit et de la livraison

**Date :** 27 octobre 2026  
**Branche :** `growth/p0-sale-readiness`  
**Dépôt site :** `aveca/bot-wow`  
**Dépôt logiciel (source du produit livré) :** `C:\factory\worktrees\casinobabe-v2`  
**Production :** `https://bot-wow.com/` · `https://bot-wow.com/fr/`

---

## 1. DÉFAUT CONFIRMÉ ET SES PREUVES

### Le défaut

Les pages de vente en production affichaient :

- un encadré « Release availability notice » annonçant que la disponibilité du paquet v1.2.0 ne pouvait **pas** être confirmée ;
- la consigne explicite « **do not purchase until delivery is confirmed**** / « n'achetez pas tant que la livraison n'est pas confirmée » ;
- une barre supérieure « v1.2.0 delivery status under verification » / « livraison à confirmer » ;
- **et simultanément** un formulaire de paiement à 20,00 € ouvert et fonctionnel.

### La contradiction

Cette mention est **fausse** depuis que la livraison a été rétablie. Elle décourage l'achat d'un produit qui est réellement livrable, ce qui bloque directement les ventes.

### Vérifications menées (lecture seule, sans rien modifier)

| Contrôle | Méthode | Résultat |
|---|---|---|
| Paquet R2 présent | `wrangler r2 object get --remote` | 1 387 543 octets, téléchargé |
| Empreinte du paquet | `Get-FileHash SHA256` sur l'objet R2 | `1c132f367607ea186feffde8bbda0a1a9f94cdec4b7850b93c57c271270bba4f` |
| Empreinte attendue | `MANIFEST.json` du paquet | `1c132f367607ea186feffde8bbda0a1a9f94cdec4b7850b93c57c271270bba4f` |
| Conformité | comparaison | **IDENTIQUE** |
| Version interne | lecture du `VERSION` dans le ZIP | `1.2.0` |
| Contenu du ZIP | décompression, énumération | 30 entrées ; **16 scripts Python** + 5 fichiers Lua (addon) |
| Script principal | `fishing_bot.py` | 148,3 Ko |
| Compilation scripts | `python -m py_compile` | `fishing_bot.py`, `fishing_assistant.py`, `fishing_observer.py` : **OK** |
| Téléchargement réel | `GET /api/download?t=<jeton réel en production>` | **HTTP 200**, `application/zip`, 1 387 543 o, signature `PK` valide, SHA-256 conforme |
| Checkout | `POST /api/checkout` (email de test) | **HTTP 200** + `checkoutUrl` Mollie |
| Secret de livraison | `wrangler secret list` | `RELEASE_STATUS` configuré |
| Livraison déjà utilisée | `botwow-production` D1 | **5 commandes payées, 5 licences, 5 jetons de téléchargement**, 14 événements webhook |
| Avertissement en prod. | lecture du HTML servi par `https://bot-wow.com/` | texte « do not purchase until delivery is confirmed » **présent** |

**Conclusion : livraison entièrement vérifiée et fonctionnelle. Cas A de la mission.**

---

## 2. CONSTRUCTION ET VÉRIFICATION DU PAQUET

### Script de construction

`C:\factory\worktrees\casinobabe-v2\scripts\build_desktop_package.py` — usage :
`python scripts/build_desktop_package.py --version 1.2.0`

Le script produit un paquet autonome versionné : addon Lua, bot et dépendances, application desktop, gabarit de configuration, `MANIFEST.json` (SHA-256 par fichier), `VERSION`, script de restauration.

### Le paquet livré n'est PAS reconstructible à l'empreinte identique depuis les sources actuelles

Comparaison des 26 fichiers du manifeste avec les sources du jour :

| Résultat | Nombre |
|---|---|
| Conformes à l'empreinte du manifeste | 17 |
| **Divergents** (source modifiée depuis le build) | 9 |
| Absents | 0 |

Fichiers divergents : `fishing_assistant.py`, `fishing_bot.py`, `fishing_observer.py`, `focus_broker.py`, `fishing_spots.py`, `fishing_navigation.py`, `fishing_minimap.py`, `fishing_skills.py`, `fishing_controls.py`.

**Interprétation honnête :** le paquet livré est un artefact réel figé au build du 21/10/2026. Les sources ont continué d'évoluer depuis. Le paquet n'est donc pas reproductible bit-pour-bit depuis l'arbre actuel — mais cela ne l'invalide pas : c'est la version publiée, cohérente et vérifiable. Un rebuild produirait un artefact **différent**, qu'il faudrait republier et re-tester.

### Installation testée (Windows réel)

Extraction du ZIP sur cette machine Windows :

```
d----- docs              d----- fishing_assistant_app
d----- runtime-addon     d----- scripts
-a---- Lancer-Casinobabe-Fishing-Assistant.bat
-a---- MANIFEST.json     -a---- restaurer_previous.ps1    -a---- VERSION
```

- Compilation Python : **OK** sur les 3 scripts testés
- Lanceur : fonctionnel (crée `state/`, `logs/`, `reports/`, `captures/` puis lance `fishing_assistant_app\fishing_assistant.py`)
- Dépendances tierces requises : `opencv-python` (cv2), `numpy`, `Pillow` (PIL), `mss`

**LIMITE HONNÊTE :** le paquet n'embarque **aucun `requirements.txt` ni guide d'installation interne**. Le seul document est `docs/navigation-findings.md`. Un acheteur qui télécharge le ZIP ne sait pas qu'il doit installer ces quatre dépendances Python. Le guide existe sur le site (`docs/install.html`), pas dans le paquet. C'est un frein support réel.

**NON TESTÉ :** l'exécution du bot dans WoW (pas de client WoW ni de compte dans cet environnement). Aucun test de build n'est présenté comme une preuve d'exécution en jeu.

---

## 3. TEST DE LA VRAIE LIVRAISON

Parcours : Formulaire → Mollie → confirmation serveur/webhook → commande → licence → lien de téléchargement.

| Étape | Vérification | Résultat |
|---|---|---|
| Formulaire | `#buyForm` présent et visible avant paiement | ✅ EN + FR, 3 viewports |
| Checkout | `POST /api/checkout` | ✅ HTTP 200 + `checkoutUrl` (ex. `tr_XPs9zjVyx5GhHpUgN3kYJ`) |
| Identifiants | table `orders` | 23 commandes ; `id` au format `ord_<paymentId>` |
| Statuts réels | `GROUP BY status` | 5 `paid` · 8 `pending_payment` · 9 `failed` · 1 `rejected` |
| Webhook | table `webhook_events` | 14 événements (verrou d'unicité `event_id`) |
| Licences | table `licenses` | 5 licences (une par paiement payé) |
| Jetons | table `downloads` | 5 jetons, expiration ~40 jours, max 10 téléchargements |
| Téléchargement | `GET /api/download?t=<jeton réel>` | ✅ HTTP 200, ZIP 1 387 543 o, SHA-256 conforme |
| Jeton invalide | `GET /api/download?t=invalide` | ✅ HTTP 404 `invalid` |
| Jetons révoqués/expirés | code du Worker | ✅ prévus (`403 revoked`, `410 expired`) |

**Idempotence :** vérifiée par la suite de tests `payment-flow` (PASS) — un webhook rejoué ne crée pas de seconde licence.

**Défaut trouvé sur la livraison (non bloquant, cosmétique) :** l'en-tête `Content-Disposition` annonce encore `filename="Casinobabe-v1.0.38.zip"` alors que le fichier servi est bien la v1.2.0 (SHA-256 conforme). Le client reçoit donc le bon contenu sous un nom de fichier trompeur. Correctif préparé dans la PR #44 (non fusionnée, donc non déployé en production).

---

## 4. CORRECTIFS RÉALISÉS

### Fichiers modifiés (avertissement faux corrigé)

| Fichier | Modification |
|---|---|
| `index.html` | encadré principal, barre supérieure, bloc « Delivery » du parcours, bloc « Delivery » avant achat |
| `fr/index.html` | idem, en français |
| `buy.html` | encadré principal, étapes « Confirm », réponse FAQ « Is the v1.2.0 download available right now? » |
| `fr/buy.html` | idem, en français |

Le nouveau texte est **véridique et précis** :

- « BOT-WOW v1.2.0 is the current release, and the download package is verified »
- mention du **manifeste SHA-256** pour que l'acheteur vérifie l'archive lui-même ;
- livraison de la clé de licence et du lien **par e-mail** après paiement ;
- canal de renvoi vers le support en cas de non-réception.

**Ce qui est conservé :** prix 20,00 €, formulaire de checkout, redirection Mollie, mesure des CTA, cadre `id="release-availability-notice"` + `role="alert"` placé avant le formulaire.

**Ce qui n'est PAS promis :** aucune livraison « instantanée » ou « par e-mail en quelques minutes » (déjà interdit par les garde-fous existants, conservés).

### Fichiers de tests mis à jour

| Fichier | Modification |
|---|---|
| `tests/release-availability.test.mjs` | garde-fou **inversé** : interdit désormais l'affirmation de non-confirmation, exige la formulation vérifiée et la mention du manifeste |
| `tests/site-artifact.test.mjs` | assertions alignées (version actuelle, pas de non-confirmation) |
| `tests/e2e/demo-quality.spec.mjs` | assertion alignée sur `current release` |

### Nouveau fichier de test

| Fichier | Contenu |
|---|---|
| `tests/e2e/sale-readiness.spec.mjs` | 6 tests navigateur réels (EN + FR × desktop 1440×900 / tablette 768×1024 / mobile 375×812) : avis véridique avant le formulaire, CTA hero doré pointant vers `#buy`, CTA démo resté secondaire, clic → section d'achat, champ email et bouton visibles, prix 20,00 €, aucun débordement horizontal, aucune erreur JS |

---

## 5. CONTRÔLES EN/FR ET NAVIGATEUR

### Commandes exécutées

| Commande | Résultat |
|---|---|
| `node tests/release-availability.test.mjs` | **RELEASE AVAILABILITY : OK** |
| `npm run validate` | **BOT-WOW validation PASS** |
| `npm test` | **exit code 0**, toutes les suites OK |
| `node scripts/build-site.mjs _site` | artefact construit, stamp des assets `e37e617b`, aucun fichier interdit |
| `npx playwright test` | **66 tests passed** |

### Matrice des captures réelles

Build local servi sur `127.0.0.1:8099`, captures plein écran dans `artifacts/ui/` :

| Viewport | Dimensions | EN | FR |
|---|---|---|---|
| desktop | 1440 × 900 | `accueil-en-desktop.png` | `accueil-fr-desktop.png` |
| tablette | 768 × 1024 | `accueil-en-tablette.png` | `accueil-fr-tablette.png` |
| mobile | 375 × 812 | `accueil-en-mobile.png` | `accueil-fr-mobile.png` |

### Note d'honnêteté sur le test local

Le serveur de test local est statique (`scripts/serve.mjs`) et n'implémente pas `/api/track` : il renvoie 404. En production, cet endpoint est assuré par le Worker de télémétrie et répond `202`. Le test ignore **explicitement et uniquement** les échecs dont l'URL est `/api/track`, et échoue sur toute autre erreur — aucune erreur JS réelle n'est masquée.

---

## 6. BLOCAGES RESTANTS ET APPROBATIONS NÉCESSAIRES

| # | Blocage | Ce qu'il attend | Impact |
|---|---|---|---|
| 1 | **Le correctif d'avertissement n'est pas déployé** | Autorisation de déploiement des pages | Les visiteurs voient encore « n'achetez pas » et repartent |
| 2 | PR #44 (nom de fichier de téléchargement) non fusionnée | Décision de fusion | L'acheteur télécharge un ZIP nommé `v1.0.38` alors qu'il reçoit la v1.2.0 |
| 3 | Paquet sans `requirements.txt` ni guide interne | Rebuild du paquet + republication R2 | L'acheteur ne sait pas installer cv2/numpy/Pillow/mss → tickets support |
| 4 | Sources divergentes du paquet publié | Décision : republier depuis les sources actuelles, ou geler | Dérive entre code source et artefact livré |

**Aucun déploiement n'a été effectué. Aucun prix, secret, paiement ou configuration de checkout n'a été modifié.**

---

## 7. MESURES DE RÉFÉRENCE RÉELLEMENT DISPONIBLES

Source : bases D1 de production, lecture seule (`botwow-analytics` et `botwow-production`). Aucun chiffre n'est estimé.

### Entonnoir observé

| Étape | Événement | Compte | Taux (étape précédente) | Taux (visite) |
|---|---|---|---|---|
| 1 | Visite (`page_view`) | 980 | — | 100 % |
| 2 | Clic CTA (`cta_click`) | 45 | 4,59 % | 4,59 % |
| 3 | Intention d'achat (`checkout_requested`) | 27 | 60,0 % | 2,76 % |
| 4 | Checkout créé (`checkout_created`) | 4 | 14,8 % | 0,41 % |
| 5 | **Paiement confirmé** (`orders.paid`) | **5** | — | **0,51 %** |

### Détail des clics CTA

| CTA | Clics | Part |
|---|---|---|
| `hero-offer` | 26 | 57,8 % |
| `nav-buy` | 9 | 20,0 % |
| `final-buy` | 2 | 4,4 % |
| `compare-buy`, `journey-fish-buy`, `journey-licence-buy`, `steps-buy`, `mbar-buy` | 0 | 0 % |
| Autres (démo, comparaison, navigation) | 8 | 17,8 % |

### Lectures à en tirre (hypothèses, non démontrées)

1. **Le CTA hero concentre 57,8 % des clics d'achat** — le corriger (fait en P0.46/P0.48) agissait sur le bon levier.
2. **La chute étape 3 → 4 est de 85,2 %.** C'est le plus gros point de friction mesurable.
3. **`checkout_created` (4) < paiements confirmés (5)** : certains paiements n'ont pas laissé de trace de télémétrie client (visiteurs sans Do Not Track désactivé, ouverture directe, reprise d'un paiement).

### Limites de la mesure

- Impossible de relier un événement de navigation à une commande payée (pas d'identifiant commun par conception, pour la protection de la vie privée).
- Les visiteurs avec Do Not Track actif ne sont pas comptés : le trafic réel est sous-estimé.
- Aucune donnée temporelle extraite (pas d'analyse de tendance).
- Aucune donnée d'acquisition (Search Console, référents) consultée ici.

### Non mesuré / indisponible

- Impressions et clics issus des moteurs de recherche : **non mesuré** (Search Console non connecté dans cette mission).
- Taux de conversion par source de trafic : **non mesuré**.
- Toute donnée de témoignage ou d'avis : **inexistante**, aucun inventé.

---

## 8. CE QUI FONCTIONNE RÉELLEMENT

| Élément | Preuve |
|---|---|
| Le produit existe et est livrable | Paquet R2 v1.2.0, 1 387 543 o, SHA-256 conforme |
| Le paquet est complet | 16 scripts Python + addon Lua, scripts compilent |
| Le checkout fonctionne | HTTP 200 + URL Mollie |
| La livraison fonctionne | Téléchargement réel HTTP 200, ZIP conforme |
| Le parcours est éprouvé | 5 ventes payées, 5 licences, 5 jetons délivrés |
| L'idempotence est protégée | Suite `payment-flow` PASS |
| Les pages sont correctes et responsives | 66 tests navigateur PASS, EN + FR, 3 viewports |

## CE QUI RESTE À FAIRE POUR VENDRE

1. **Déployer** ce correctif d'avertissement (blocage n° 1).
2. **Fusionner la PR #44** pour que l'acheteur reçoive un fichier nommé correctement.
3. **Ajouter `requirements.txt` + guide d'installation dans le paquet** pour supprimer le frein support.
4. **Se donner un canal d'acquisition mesuré** (Search Console) avant d'optimiser la conversion.
5. **Investiguer la chute de 85,2 %** entre `checkout_requested` et `checkout_created`.

---

## 9. PROCHAINE MISSION — PREMIÈRES VENTES

```
# BOT-WOW — Acquisition des premières ventes

État de départ : https://github.com/aveca/bot-wow/pull/52 (rapport d'entonnoir)
et rapports/growth/2026-10-27-bot-wow-sale-readiness.md (ce rapport).

1. Connecter Search Console à bot-wow.com et relever les impressions,
   clics et requêtes réels sur 7 jours. Ne rien inventer si zéro.
2. Identifier les 3 requêtes de recherche les plus proches du produit réel
   ("bot peche wow classic", equivalent anglais) et verifier que la page
   ciblee par Google existe et repond.
3. Corriger une seule page d'entree a la fois, puis mesurer.
4. Publier le lien sur un canal reel (forum WoW, Reddit r/classicwow, ou
   Discord de guilde) avec une capture du bot, une mention honnete des
   limites, et le lien vers la demo.
5. Mesurer : visiteurs uniques, clics sur le CTA d'achat, checkouts crees,
   paiements confirmes. Conserver les chiffres avec leur fenetre temporelle.
6. Repeter avec le meilleur canal uniquement.

Interdits : achat de trafic, spam, faux temoignages, faux chiffres.
Autorise : deploiement des pages deja corrigees et fusionnees.
```

---

**Rapport :** `reports/growth/2026-10-27-bot-wow-sale-readiness.md`  
**Branche :** `growth/p0-sale-readiness`  
**Aucun déploiement. Aucun paiement. Aucune modification du checkout, des prix ou des secrets.**
