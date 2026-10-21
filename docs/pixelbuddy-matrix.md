# Matrice comparative — PixelBuddy / REA vs Casinobabe

Complément de `docs/competitive-analysis-2026-10.md` (analyse de marché).
Objet : établir **ce qui est confirmé, ce qui est inféré, ce qui est inconnu**
sur PixelBuddy, et ce que Casinobabe sait faire aujourd'hui.

---

## 0. État de l'analyse inverse (REA) — ce qui n'a PAS été fait

| Prérequis de l'analyse REA | État | Conséquence |
|---|---|---|
| Copie **légale** de PixelBuddy sur la machine | **Absente** (recherche sur `C:\factory`, `Documents`, `Downloads` : aucun binaire, aucun dossier `PixelBuddy` — seul `pixelmatch` (npm, sans rapport) a été trouvé) | L'analyse des composants, interfaces, fichiers et comportements **n'a pas été réalisée** |
| Autorisation d'analyser ce logiciel | **Non obtenue** | idem |
| Outil d'analyse inverse (REA) présent | **Non installé** (aucun exécutable `rea*` trouvé) | idem |

**Aucun téléchargement, aucune extraction, aucun contournement de protection
n'a été tenté ni tentera.** L'analyse REA reste **conditionnelle** : elle ne
démarrera que si une copie obtenue légalement est fournie **et** l'analyse
expressément autorisée.

**Ce qui est urgent pour l'analyse REA, le jour où elle est possible :**

1. Copie légale dans un dossier de travail isolé (jamais dans un dépôt) ;
2. inventaire : exécutables, DLL, fichiers de configuration, service(s) ;
3. identification des **interfaces** : comment le bot lit-il l'écran ? quel
   format d'addon ? comment envoie-t-il les entrées ? quel protocole de
   licence ?
4. observation des **comportements** : ce qu'il écrit dans le WTF du client,
   ce qu'il laisse sur le disque, ce qu'il réseau ;
5. uniquement ensuite, comparaison avec Casinobabe et **réimplémentation
   indépendante** des fonctionnalités utiles (aucune copie de code
   propriétaire).

## 1. Matrice des capacités

Légende : **[C]** confirmé par une source publique lue le 2026-10-21 ·
**[I]** inféré (déduit de la documentation, non vérifié en exécution) ·
**[?]** inconnu · **[Cas]** capacité Casinobabe mesurée dans notre dépôt.

| Capacité | PixelBuddy | Source | Casinobabe | Preuve Casinobabe |
|---|---|---|---|---|
| Bot **externe** (pixels, pas d'injection) | ✔ annoncé explicitement | page produit | ✔ | `scripts/fishing_bot.py` : capture `PrintWindow`/OBS, entrées `WM_*` |
| Addon client (canal de données) | ✔ « custom addon » qui affiche des données encodées en haut à gauche | page produit | ✔ (mesure de l'addon, pas d'affichage) | `runtime-addon/Casinobabe/CasinobabeFishing.lua` |
| **Pêche** par IA (modèle entraîné) | ✔ annoncé | page produit | ✘ (détection classique par couleur) | `detect_bobber` / `detect_bobber_hybrid` |
| Mode arrière-plan (sans focus) | ✔ annoncé | page produit | ✔ **mesuré** | `send_key` / `send_mouse_click_wm` (WM_*, sans focus) |
| **Mémoire des spots** de pêche | **[?]** non documenté publiquement | — | ✔ **implémenté et testé** | `scripts/fishing_spots.py` (47/47) : déduplication, confirmation, fiabilité, historique, export/import |
| **Planification de routes** de pêche | **[?]** non documenté | — | ✔ **implémenté et testé** | `scripts/fishing_routes.py` : coût attendu, plus proche voisin + 2-opt, 3 modes (parité JS↔Python vérifiée) |
| **Déplacement automatique entre points** | ✔ « mesh navigation », profils/waypoints éditables | page produit | ⚠ **en cours** (mécanisme mesuré, arrivée non validée) | `docs/navigation-findings.md` (constats du 2026-10-21) |
| Navigation par **profils** éditables à la main | ✔ | captures de l'éditeur | ✘ (approche mémoire automatique) | — |
| Boutique de profils/rotations **gratuite** | ✔ | page produit | ✘ | — |
| Grinder / Gather / Rotation / Quester / Follower / Scripter | ✔ 8 rôles | page produit | ✘ **hors périmètre** (pêche) | — |
| Serveurs **privés** | ✘ **exclus** | FAQ (« Official WoW only ») | ✔ **cible principale** | session réelle sur serveur privé |
| Vanille/Classic/Live | ✔ | FAQ | ⚠ **Classic 1.13 testé** ; Retail/TBC/WotLK non testés | `state/fishing-bot-config.json` + tableau de compatibilité du site |
| 16 langues d'interface | ✔ | page produit | ✘ (français) | — |
| Pilotage par smartphone | ✔ | page produit | ✘ | — |
| Assistant d'installation (wizard) | ✔ | page produit | ✔ (guide + `INSTALL.md` + `config.example.json`) | `distribution/INSTALL.md` |
| Licence par machine | **[I]** (clé + activation, format non publié) | — | ✔ **implémenté et testé** | `worker/index.js` (`licenses`, `activations`) + `tests/payment-flow.test.mjs` |
| Essai payant 48 h | ✔ 1,99 € | page produit | ✔ **gratuit** (démo navigateur, sans compte) | `demo.html` + `assets/route-planner.js` |
| Abonnement | ✔ 30 j / 90 j | page produit | ✘ (licence à vie 20 €) | `wrangler.toml` + `PRICE_TABLE` |
| Vigilance anti-bannissement | ✔ **avertie explicitement** (« yes ») | FAQ | ✔ même position (avertissement sur le site) | `index.html` (section compatibilité) |
| Anti-virus | ✔ **averti** (peut être signalé) | FAQ | ✔ même honnêteté (le bot lit l'écran et envoie des touches) | `distribution/INSTALL.md` |

## 2. Faits / inférences / inconnues

**Faits vérifiés (lecture directe des pages, 2026-10-21)**
- prix d'entrée 1,99 € pour 48 h ; abonnements 30 j / 90 j par nombre de sessions ;
- 437 avis, note 4,56/5 ;
- 8 rôles, dont `Fish (AI)` ;
- « Official WoW only », « no private servers » ; max 3 sessions par IP ;
- risque de bannissement assumé et expliqué ;
- « This is not a plug & play bot », courbe d'apprentissage revendiquée.

**Inférences (déduites, non exécutées)**
- le « Fish (AI) » repose sur un modèle de vision entraîné (l'addon affiche
  « des données encodées en haut à gauche » → un canal pixel, pas mémoire) ;
- le « mesh navigation » est un système de profils + waypoints éditables ;
- la boutique de profils/community profiles est un élément central de
  rétention.

**Inconnues (à tester en essai réel, jamais devinées)**
- la **fiabilité mesurée** de la pêche (le seul avis critique lu mentionne
  « 10-20 % de réussite » — un avis, pas une mesure) ;
- la précision de la détection (résolution ? anti-aliasing ?) ;
- la qualité réelle du pathfinding (« pathing inconsistencies » lu dans un avis) ;
- la latence morsure→clic, la gestion de l'appât, la reconnaissance de l'addon ;
- le format de licence, la机械化 de l'activation, le mechanism de mise à jour.

## 3. Ce que nous pouvons reproduire chez nous (et l'avons fait)

| Fonctionnalité PixelBuddy | Notre équivalence | État |
|---|---|---|
| Bot externe, sans injection | capture d'écran + `WM_KEY*`/`WM_MOUSE*` | ✔ **mesuré** |
| Addon client | `CasinobabeFishing.lua` (journal de pêche, cibles, spots) | ✔ |
| Mode arrière-plan | envoi d'entrées sans focus | ✔ **mesuré** |
| Mémoire persistante des spots | `fishing_spots.py` (schéma versionné, migrations, sauvegardes) | ✔ **testé** |
| Planification de routes | `fishing_routes.py` (coût = temps + risque + probabilité d'échec ; 3 modes) | ✔ **testé**, parité JS↔Python |
| Licence par machine | Worker : `licenses` + `activations` + téléchargement limité | ✔ **testé** (simulation) |
| Essai | démo navigateur, sans compte, sans donnée simuléepresented comme mesurée | ✔ **publiée** |
| Grandeurs annoncées | **jamais** de nombre inventé ; les estimations sont étiquetées | ✔ |

**Non reproduit (hors périmètre ou non atteint)** : le rôle multi-fonctions, la
boutique de profils, le pilotage mobile, les 16 langues, la pêche « IA »,
la navigation par profil éditable.

## 4. Différenciation possible à court terme

1. **La mémoire des spots automatique** : PixelBuddy demande des profils
   faits main ; nous apprenons des spots tout seuls (c'est notre actif, à
   condition de valider l'arrivée en jeu).
2. **Les serveurs privés** : nous les visons, PixelBuddy les exclut.
3. **L'honnêteté mesurée** : nos chiffres viennent d'instruments (latence,
   taux de premier clic, journal par cycle) ; les siens sont des promesses.
4. **Un prix sans abonnement** (20 € à vie) et un **essai gratuit sans compte**.

## 5. Ce qu'il faudra pour une comparaison « REEL »

- une session d'essai PixelBuddy (48 h / 1,99 €) sur un compte de test
  **autorisé** : mesurerait la détection, le délai de morsure→clic, la
  fiabilité de la pêche, le pathfinding et l'expérience d'installation ;
- un relevé de trafic réseau (si le bot en fait) pour comprendre son
  canal de licence ;
- l'analyse des fichiers qu'il écrit dans le WTF (addon) — c'est par là que
  passe son canal de données.
