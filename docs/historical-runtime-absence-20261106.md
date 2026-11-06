# Inventaire des sources historiques Gold / PvP / XP — BOT-WOW

**Mission :** BOTWOW-HISTORICAL-RUNTIME-REFS-20261106 (issue #127)  
**Branche :** `p0/historical-runtime-20261106` (depuis `main` = `ba720c0`)  
**Dépôt exclusif :** aveca/bot-wow (lecture seule des refs et worktrees)  
**Statut :** preuve d'absence documentée — aucun runtime Gold / PvP / XP n'existe dans ce dépôt

---

## 1. Inventaire des sources inspectées

| Source | Portée | Résultat |
|---|---|---|
| Toutes les branches locales et distantes | 40+ branches (voir `git branch -a`) | Aucune ne contient de runtime bot |
| Tout l'historique des commits | 915 commits (`git log --all --oneline`) | Aucun commit n'ajoute de code Gold/PvP/XP exécutable |
| Tags | Aucun tag n'existe | N/A |
| Fichiers de code source ajoutés (`diff-filter=A`) | Extensions `.py .lua .cpp .cs .java .go` | **Aucun fichier jamais ajouté** (vide) |
| Archives binaires ajoutées (`.zip .tar .gz .7z .rar .exe .msi .dll .so`) | Aucun fichier | **Aucune archive jamais ajoutée** |
| Worktree local séparé (`bot-wow-repo`, branche `fix/botwow-conformance-delivery`) | Copie du même dépôt bot-wow | Même contenu, laissé intact (non modifié) |

---

## 2. Runtime identifié : ABSENT

Aucun runtime Gold farming, combat/PvP, leveling/XP n'existe dans `aveca/bot-wow`, à l'état actuel ni dans aucun commit de son historique.

**Preuves :**

| Preuve | Détail |
|---|---|
| Aucun fichier de langage de bot | `git log --all --diff-filter=A -- '*.py' '*.lua' '*.cpp' '*.cs'` → vide (jamais ajouté) |
| Aucun fichier d'archive/paket | `git log --all --diff-filter=A -- '*.zip' '*.tar' '*.gz' '*.7z' '*.rar' '*.exe'` → vide |
| Texte d'honnêteté sur `buy.html` (variantes A/B) | *« No combat, XP farming, quests or battleground automation. Those are planned, with no release date. »* |
| Anciennes pages marketing legacy (claims Gold/XP/items/BG) | Routes `/bot-wow-gold`, `/best-wow-bot`, `/bot-wow-classic` → aujourd'hui 308 vers le site canonique ; plus de générateur `handleLanding` dans le worker (test `worker-fulfillment-reconciliation` vert). Ce sont des **pages marketing supprimées**, pas du code exécutable. |
| Registre `assets/modules.json` | `grind` (combat rotations) = `planned`, « Design phase only… No implementation shipped » ; `follower` (quest/XP) = `planned`, « Not committed » ; `scripting` = `planned`, « Design phase only » ; `fish` = `available` (uniquement l'assistant pêche, dont le code `fishing_bot.py` est **absent de ce dépôt**, résidant dans le dépôt séparé `aveca/Casinababe`, hors périmètre de cette mission). |

---

## 3. Distinction : claims marketing vs fonctions exécutables

| Élément | Nature | Statut |
|---|---|---|
| Claims « Gold, XP, items & battlegrounds en automatique » (anciennes pages landing) | Copy marketing, supprimé | **Pas de code associé** ; jamais de livrable |
| Claims « Tous les modules (Gold, XP, Item, BG) » | Copy marketing | **Pas d'implémentation** |
| `buy.html` : « No combat, XP farming, quests or battleground automation » | Texte d'honnêteté actuel | Confirme l'absence |
| `modules.json` : grind/follower/scripting | Registre de statut interne | `planned`, non engagé, pas de date |

Aucun de ces éléments n'est une fonction exécutable. Aucun label UI, nom de fichier, transaction de mini-casino (`btn-gold` est une classe CSS pour la démo simulée) ni documentation n'est présenté comme une fonction de gameplay disponible.

---

## 4. Tests et preuves d'exécution

| Élément | Statut |
|---|---|
| Paquet reproductible | **N/A** — aucun code à packager, aucun SHA-256 de paquet à générer |
| Tests d'exécution Gold/PvP/XP | **N/A** — aucun test n'existe (pas de code) |
| Tests existants dans le dépôt | `npm test` (24 suites vertes) couvre le site statique, le Worker de paiement, la compatibilité datée, les liens, la conversion — aucun test Gold/PvP/XP car ce code n'existe pas |

---

## 5. Blocages précis (dépendent du propriétaire)

1. **Runtime Gold/PvP/XP manquant** : ce code n'a jamais existé dans `aveca/bot-wow`. S'il existe, il réside dans un autre dépôt (hors périmètre de cette mission) ou n'a jamais été développé.
2. **Fichiers référencés absents** : `assets/modules.json` pointe vers `scripts/fishing_bot.py`, `scripts/fishing_memory.py`, `scripts/inventory_vendor.py`, `scripts/recovery_state_machine.py` — **aucun de ces fichiers n'est présent dans `bot-wow`** (ils sont dans le dépôt séparé `aveca/Casinababe`, non consulté ici par contrainte).
3. **Aucune compatibilité serveur datée** (matrice `compat.json` : tout `not_tested` / `historical_unverified`).
4. **Checkout fermé** (`RELEASE_STATUS != "confirmed"`), aucun profil Mollie dédié BOT-WOW, 0 livraison / 0 activation en production.

---

## 6. Prochaine étape vers une livraison commerciale vérifiable

Le propriétaire doit :
1. Fournir le runtime source Gold/PvP/XP (ou confirmer qu'il n'existe pas et que le produit se limite à l'assistant pêche).
2. Si le runtime est fourni : le placer dans `aveca/bot-wow`, le faire passer par des tests d'exécution réels, générer un paquet reproductible avec manifeste SHA-256, le distribuer via R2, et ouvrir le checkout seulement après autorisation explicite.

---

## 7. Règles respectées

- Aucun merge de PR #123 / #124 / #126 (toutes laissées ouvertes).
- Aucune modification de `main`, du checkout, des prix, de Mollie, des webhooks, du Worker.
- Aucun secret, binding, D1, R2 touché.
- Aucun paiement réel, aucun email client, aucun déploiement de production.
- Aucun contenu casino/label UI présenté comme fonctionnalité de gameplay.
- Aucune affirmation de compatibilité ou de fonctionnalité non démontrée.

---

**Conclusion :** le véritable produit historique complet (Gold + PvP + XP) n'est pas identifiable dans `aveca/bot-wow`. Il n'y a que des claims marketing supprimés et un registre qui classe ces fonctions comme « planifiées, non implémentées ». Le seul runtime reproductible identifié dans ce périmètre est l'assistant pêche (décrit dans PR #124, dépôt `aveca/Casinababe`).
