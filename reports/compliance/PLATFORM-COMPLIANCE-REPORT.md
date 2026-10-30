# PLATFORM-COMPLIANCE-REPORT.md — BOT-WOW

**Produit :** BOT-WOW (bot de pêche World of Warcraft Classic, lecture d'écran/pixel)
**Site :** https://bot-wow.com/
**Dépôt :** https://github.com/aveca/bot-wow.git
**Branche d'audit :** `fix/botwow-autonomous-qa-20261029`
**Date :** 2026-10-29
**Statut global :** **CONTRARIE AUX CONDITIONS PUBLIÉES** (voir classification ci-dessous). Aucune autorisation explicite de Blizzard n'a été trouvée.

---

## 1. Méthode et sources consultées

Sources prioritaires officielles Blizzard (consultées en lecture seule, sans reverse engineering) :

- https://www.blizzard.com/en-us/legal/
- https://www.blizzard.com/en-us/legal/bfbbb648-bcc6-4b78-a5c7-e2fe20c135df/blizzard-end-user-license-agreement
- https://news.blizzard.com/

Aucune rétro-ingénierie du système anti-cheat n'a été effectuée. Aucun contournement n'a été développé. Aucun mécanisme de détection ou de dissimulation n'a été modifié.

---

## 2. Ce que fait le produit (constat factuel, dépôt)

BOT-WOW est un utilitaire Windows (Python 3.11+) qui, selon le dépôt :

- Lit l'écran du client WoW (PrintWindow / capture d'arrière-plan, analyse HSV du flotteur de pêche) — **pas d'injection mémoire, pas de lecture de processus** (docs, features.html, bundle i18n du Worker).
- Mémorise les spots de pêche, calcule des rondes optimisées (plus proche voisin + 2-opt), clique sur la morsure (clics par messages de fenêtre).
- Est livré avec un addon en jeu (`Casinobabe Addon`) qui « garde le journal de pêche visible » et « effectue simulé aucune saisie d'entrée » (features.html : « The addon deliberately performs no input simulation »).
- Modules en développement : déplacement spot-à-spot (odométrie minimap), inventaire/vendeur, récupération après mort. Modules planifiés : autres clients (TBC/WotLK/Retail), follower, grind, scripting (assets/modules.json).
- Commercialisé : licence à vie 20 €, livrée par e-mail, activation 1 machine.

---

## 3. Positions officielles Blizzard (synthèse, sans citer de valeur secrète)

### 3.1 End User License Agreement (EULA) — Blizzard

L'EULA de Blizzard interdit notamment :

- L'utilisation de **robots, bots, ou tout autre moyen automatisé** pour jouer ou interagir avec le jeu.
- L'utilisation de **logiciels tiers** qui interagissent avec le client de jeu, lisent la mémoire du jeu, ou automatisent le gameplay.
- La **modification du client** ou l'interception des communications entre le client et les serveurs Blizzard.
- La **distribution commerciale** d'outils destinés à contourner les règles du jeu.

### 3.2 Conditions d'utilisation (Terms of Use)

Les Conditions d'utilisation de Blizzard interdisent l'automatisation du gameplay et l'utilisation de programmes tiers non autorisés. L'utilisation d'un bot peut entraîner la **suspension ou le bannissement définitif du compte**.

### 3.3 Communications Blizzard (news.blizzard.com)

Blizzard communique régulièrement sur la lutte contre les bots et l'automatisation non autorisée dans World of Warcraft.

---

## 4. Classification des fonctionnalités de BOT-WOW

| Fonctionnalité | Classification | Justification |
|---|---|---|
| Lecture d'écran du client WoW (détection flotteur, capture PrintWindow) | **CONTRARIE AUX CONDITIONS PUBLIÉES** | Interagit avec le client de jeu pour en extraire l'état de jeu en temps réel, dans le but d'automatiser une action de jeu (pêche). L'EULA interdit les logiciels tiers interagissant avec le client. |
| Clic automatisé sur la morsure (messages de fenêtre) | **CONTRARIE AUX CONDITIONS PUBLIÉES** | Automatisation d'entrées de jeu (input simulation sur le client WoW). Interdit par l'EULA et les ToS. |
| Mémorisation de spots et calcul de rondes optimisées | **CONTRARIE AUX CONDITIONS PUBLIÉES** | Composant du cycle d'automatisation du gameplay (pêche assistée en boucle). |
| Déplacement spot-à-spot (odométrie minimap, en développement) | **CONTRARIE AUX CONDITIONS PUBLIÉES** | Automatisation du déplacement du personnage dans le jeu. |
| Combat IA, rotations de classe, interruptions, CC (en développement/planifié) | **CONTRARIE AUX CONDITIONS PUBLIÉES** | Automatisation du combat — clairement interdite. |
| Addon en jeu (`Casinobabe Addon`) | **CONTRARIE AUX CONDITIONS PUBLIÉES** | S'installe dans le client WoW et interagit avec l'interface de jeu, même s'il prétend ne pas simuler d'entrées. |
| Distribution commerciale (vente de licence 20 €) | **CONTRARIE AUX CONDITIONS PUBLIÉES** | Monétisation d'un outil d'automatisation de gameplay interdit. |
| Affirmation « pas d'injection mémoire » comme gage de licéité | **CONTRARIE AUX CONDITIONS PUBLIÉES** | L'absence d'injection mémoire ne rend pas l'automatisation autorisée. La lecture d'écran + clics automatisés reste une automatisation de gameplay prohibée. |
| Mention « anti-détection pixel-based » (bundle i18n Worker, pl2/pl3) | **CONTRARIE AUX CONDITIONS PUBLIÉES** | Promesse d'indétection / anti-détection d'un outil d'automatisation. Interdit et démenti par features.html lui-même (« No automation tool is undetectable »). |
| Avertissement risque de bannissement (q1/a1, riskMap, footer, terms) | **AUTORISATION DOCUMENTÉE (mention de risque)** | Mention honnête et conforme à l'attente de Blizzard : l'automatisation peut entraîner le bannissement. À conserver. |
| Démo navigateur (données simulées, ne contrôle pas le client) | **CONFORMITÉ NON ÉTABLIE / NON APPLICABLE** | Élément marketing du site, pas d'interaction avec le client WoW. Non concerné par l'interdiction, mais ne rend pas le produit autorisé. |
| Mentions légales, politique de remboursement, conditions de vente | **CONFORMITÉ NON ÉTABLIE** | Documents contractuels du site, non liés à l'autorisation Blizzard. |

---

## 5. Conclusions

### 5.1 Aucun élément ne permet de déclarer BOT-WOW autorisé

Aucune autorisation explicite de Blizzard n'a été trouvée dans les sources consultées. Au contraire, le produit (automatisation du gameplay de WoW via lecture d'écran et clics automatisés, distribution commerciale) est **contraire aux conditions publiées** de Blizzard (EULA et Terms of Use).

### 5.2 La distinction « pixel-based vs mémoire » est sans effet sur la licéité

Le site affirme à juste titre que la lecture d'écran « réduit l'empreinte technique mais ne garantit rien » et que « aucun outil ne peut empêcher un bannissement ». Cependant, cette nuance technique ne change pas le classement : **l'automatisation du gameplay reste interdite, qu'elle utilise de l'injection mémoire ou de la lecture d'écran.**

### 5.3 Incohérences internes à corriger (non liées à l'interdiction, mais à la crédibilité)

- Le bundle i18n du Worker contient « Anti-detection pixel-based » (pl2, pl3) alors que `features.html` débrouille explicitement l'indétectabilité. À supprimer pour cohérence.
- Le bundle i18n du Worker affiche « 100% free » (EN/DE/ES/PT/RU) alors que le produit est payant (20 €). À aligner.
- Le bundle i18n du Worker annonce la compatibilité Retail/SoD alors que la FAQ et le registre disent que seul Classic 1.13 est testé. À aligner.

---

## 6. Recommandations

1. **Ne jamais déclarer BOT-WOW autorisé par Blizzard.** Aucune preuve n'existe.
2. **Conserver et renforcer l'avertissement de risque de bannissement** (déjà présent et cohérent).
3. **Supprimer toute promesse d'anti-détection / d'indétectabilité** du bundle Worker et des pages.
4. **Aligner les revendications de compatibilité (WoW versions) avec le périmètre réellement testé** (Classic 1.13) ou fournir une preuve.
5. **Envisager l'étude de migration produit non-automatisant** (voir reports/qa et PISTE D'ÉVOLUTION PRODUIT de la mission) : calculateur de builds, optimiseur de talents, guides interactifs, simulateur offline de rotations, base de données d'objets — aucun de ces outils ne doit interagir avec le client de jeu.

---

## 7. Mentions légales liées

Le site inclut une mention de non-affiliation : *« Not affiliated with, endorsed by, or connected to Blizzard Entertainment. World of Warcraft is a trademark of Blizzard Entertainment. »* Cette mention est présente et cohérente, mais elle ne vaut pas autorisation d'automatiser le gameplay.

---

**Décision requise :** Le produit, tel que présenté et vendu, est **contraire aux conditions publiées de Blizzard**. Toute poursuite de la commercialisation de la fonctionnalité d'automatisation de gameplay relève d'une décision de l'éditeur du produit, assumant le risque de non-conformité aux ToS/EULA de Blizzard. Cette mission ne développe, n'améliore et ne rend plus discret aucun mécanisme de botting ni de contournement.
