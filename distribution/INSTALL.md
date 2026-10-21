# Installation du bot de pêche Casinobabe

Version du paquet : `<VERSION>` (cf. `VERSION` et `MANIFEST.json`).

Ce paquet est autonome : il ne dépend d'aucun dépôt de développement ni
d'aucun identifiant interne. Il contient l'addon, le bot Python et la
documentation d'installation.

---

## 1. Contenu du paquet

```
package/
  addon/Casinobabe/        -> à copier dans <WoW>\Interface\AddOns\Casinobabe
  scripts/fishing_*.py     -> le bot (Python 3.11+)
  scripts/focus_broker.py
  config.example.json      -> gabarit de configuration
  INSTALL.md               -> ce document
MANIFEST.json              -> SHA-256 de chaque fichier (intégrité)
VERSION                    -> version du paquet
RELEASE-NOTES.md           -> notes de version
```

## 2. Prérequis

| Élément | Exigence |
|---|---|
| Windows | 10 ou 11 (64 bits) |
| Python | 3.11 ou plus récent (`python --version`) |
| WoW | Classic (anniversaire ou classique) **et** le client en jeu |
| Ecran | résolution native, le client visible (le bot lit la fenêtre) |

Le bot ne fonctionne **pas** en WoW Retail ni sur un serveur ≠ celui pour
lequel le bot a été réglé : la détection est calibrée sur un client
Classic specific (couleurs d'eau, taille de la minicarte).

## 3. Installation

1. Décompressez l'archive dans un dossier de votre choix (par exemple
   `C:\Casinobabe\`).
2. Copiez `package\addon\Casinobabe` dans
   `<WoW>\Interface\AddOns\Casinobabe`
   (`<WoW>` = le dossier d'installation du client, par exemple
   `C:\Program Files (x86)\World of Warcraft\_anniversary_`).
3. Copiez `package\config.example.json` vers
   `<dossier du bot>\state\fishing-bot-config.json` et ajustez les valeurs.
4. Vérifiez l'intégrité du paquet avec `MANIFEST.json` (SHA-256) avant de
   lancer : un fichier modifié doit être réinstallé.

## 4. Configuration initiale

Les clés importantes de `state\fishing-bot-config.json` :

| Clé | Défaut | Rôle |
|---|---|---|
| `clickAfterBiteMs` | `450` | délai entre la détection de la morsure et le clic. Mesuré : le taux de premier clic réussi monte de 18 % (150 ms) à 43 % (450 ms) sur des échantillons de 17–23 morsures. |
| `castKey` | `2` | touche de lancer. |
| `applyBait` | `true` | ré-applique l'appât toutes les `baitRefreshSec`. |
| `waterRatioMin` | `0.4` | garde « pas d'eau, pas de lancer » (mesuré : oasis 0,71 · rive 0,46 · arène 0,37 · ville 0,03). |
| `manualSuspendMaxSec` | `900` | arrêt propre si le joueur reprend la souris. |

**Le bot ne clique jamais pendant une interaction humaine** : si la souris
bouge, il suspend ses entrées (`CLICK_DEFERRED`) et attend.

## 5. Lancement

```
python scripts\fishing_bot.py --cli
```

L'arrêt propre se fait avec **F9** (la fenêtre du jeu doit avoir le focus) :
le bot journalise `EMERGENCY_STOP` et libère son verrou, ce qui permet de
le relancer sans processus fantôme.

Ne lancez jamais deux instances : le verrou `state\fishing-bot.pid` refuse
la seconde (et le second s'arrête aussitôt).

## 6. Mise à jour

1. Arrêtez le bot (F9) et vérifiez que le processus est terminé.
2. Remplacez le contenu de `addon\Casinobabe` et de `scripts\` par ceux de
   la nouvelle version.
3. Conservez `state\` (vos cartes, votre mémoire, votre configuration) :
   elle est versionnée et migrée par le bot.
4. Relancez, puis vérifiez dans `reports\fishing-bot-log.jsonl` que la
   version chargée correspond au paquet.

## 7. Récupération après une mise à jour ratée

* **Le bot ne démarre pas** : les erreurs sont dans
  `logs\fishing-bot-cli.err.log`. Vérifiez la version de Python (3.11+).
* **Le client refuse l'addon** : le dossier `Interface\AddOns\Casinobabe`
  doit contenir `Casinobabe.toc` ; un `.toc` mal nommé empêche le chargement.
* **Le bot tourne mais ne pêche pas** : vérifiez `reports\fishing-bot-log.jsonl`
  (état `WAITING_FOR_BITE`, `BOT_CRASH`, `MANUAL_SUSPEND`). Si le bot est en
  `MANUAL_SUSPEND`, c'est que la souris a bougé : il reprendra tout seul.
* **Restauration complète** : conservez `state\`, réinstallez l'addon et les
  scripts, et remettez votre `fishing-bot-config.json` d'origine : le bot
  repart avec une mémoire vide mais fonctionnelle.

## 8. Licence et droits

L'activation du logiciel se fait avec une **clé de licence** au format
`BOTWOW-XXXXX-XXXXX-XXXXX-XXXXX-XXXXX` :

* la clé est activée sur une machine (`/api/claim` puis `/api/activate`) ;
* une activation reste liée à une machine (empreinte) ;
* les fonctions payantes sont controlees **cote serveur** : le bot vérifie
  son entitlement aupres de l'API avant de fonctionner.

Aucun secret de paiement n'est contenu dans le paquet : la verification des
droits se fait via l'API, avec une cle publique cote client.

## 9. Journalisation et donnees

* `reports\fishing-bot-log.jsonl` : journal d'evenements (une ligne JSON par
  evenement) — c'est la source des mesures.
* `state\mem-*.jsonl` : memoire des sessions et des observations.
* `state\fishing-spots.json` : carte des bancs (V2).

Ces fichiers restent sur votre machine ; rien n'est envoye ailleurs que
l'API de licence.
