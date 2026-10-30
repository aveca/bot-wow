# Proposition de pivot — BOT-WOW produit WoW non-automatisant

**Mission :** P0.5 — Compliance, sécurisation et pivot BOT-WOW  
**Branche :** `fix/botwow-p05-compliance-pivot`  
**Date :** 2026-10-30  
**Statut :** Proposition (à décider, non implémentée)

---

## 1. Contexte et contrainte

BOT-WOW commercialise aujourd'hui un utilitaire d'automatisation du gameplay de World of Warcraft Classic (lecture d'écran + clics automatisés + addon en jeu). Le rapport de conformité plateforme (`reports/compliance/PLATFORM-COMPLIANCE-REPORT.md`) conclut que cette activité est **contraire aux conditions publiées de Blizzard** (EULA et Terms of Use) et qu'**aucune autorisation explicite de Blizzard n'existe**.

La méthode "pixel-based / sans injection mémoire" ne change rien à cette conclusion : l'automatisation du gameplay reste interdite, quels que soient les moyens techniques.

**Décision de principe :** ne pas développer, améliorer, distribuer ou rendre plus discret aucun mécanisme de botting, de contrôle automatisé du personnage, d'extraction d'état du client ou de contournement anti-cheat.

---

## 2. Objectif du pivot

Repositionner BOT-WOW en un **produit WoW complémentaire ne lisant ni ne contrôlant le client de jeu**, compatible avec les règles officielles de Blizzard, tout en préservant la valeur déjà créée (connaissances sur les spots de pêche, rondes optimisées, honnêteté des statuts de modules).

**Contraintes non négociables :**
- Aucun mécanisme de lecture d'écran du client WoW.
- Aucun clic automatisé ni simulation d'entrée dans le jeu.
- Aucun addon de contrôle ou d'interaction non autorisée avec le client.
- Aucun contact avec la mémoire ou les processus du jeu.
- Aucune promesse d'anti-détection, d'indétectabilité ou de "zéro ban".
- Aucune donnée de compte de jeu collectée ou stockée.

---

## 3. Pistes évaluées

| Piste | Description | Conformité Blizzard | Valeur commerciale | Complexité |
|-------|-------------|---------------------|--------------------|------------|
| Planificateur de routes de pêche (saisie manuelle) | L'utilisateur entre ses spots ; l'outil calcule la ronde optimisée (plus proche voisin + 2-opt) | ✅ Conforme (saisie hors-ligne, pas d'interaction avec le jeu) | ⭐⭐⭐ (réutilise le planificateur déjà écrit et testé) | Faible |
| Carnet personnel de spots | L'utilisateur consigne ses spots, fiabilité, mobs, rendement ; export/import JSON versionné | ✅ Conforme | ⭐⭐⭐ (réutilise la mémoire des spots déjà conçue) | Faible |
| Simulateur de rendement hors ligne | Simule les gains estimés d'une ronde sur données saisies manuellement, étiqueté "estimate" | ✅ Conforme (estimations non mesurées en jeu) | ⭐⭐ | Moyen |
| Calculateur de statistiques (stats saisies manuellement) | Tableau de bord où l'utilisateur entre ses sessions (or, temps, XP) | ✅ Conforme | ⭐⭐ | Faible |
| Guides et base de données d'objets consultables | Référence statique des objets, spots connus, quêtes de pêche | ✅ Conforme (données publiques) | ⭐⭐ | Moyen |
| Comparateur d'équipement | Outil de comparaison d'équipement sur saisie manuelle | ✅ Conforme | ⭐ | Moyen |
| Planificateur de progression | Feuille de route d'objectifs de pêche sur saisie manuelle | ✅ Conforme | ⭐ | Faible |

**Recommandation :** démarrer par le **planificateur de routes de pêche avec saisie manuelle + carnet de spots + simulateur de rendement hors ligne**. Ce trio réutilise directement le planificateur JS/Python déjà écrit, testé et à parité (12/12), sans aucune interaction avec le client WoW.

---

## 4. Périmètre du produit pivot (v1, sans automatisation)

### Inclus (produit pivot)
- Planificateur de ronde de pêche : saisie manuelle des spots, calcul de la ronde optimisée (3 modes : prudent/équilibré/exploration), affichage du coût et du temps de trajet.
- Carnet de spots personnel : création, édition, suppression de spots ; fiabilité, mobs, temps passé ; export/import JSON versionné.
- Simulateur de rendement hors ligne : estimations basées sur des données saisies par l'utilisateur, explicitement étiquetées "estimations, non mesurées".
- Guides de pêche (statiques, rédactionnels) : meilleures pratiques, compatibilité des versions de WoW (informative uniquement).
- Mentions légales et avertissement : le produit n'est pas affilié à Blizzard, n'interagit pas avec le client WoW, l'automatisation reste interdite par les ToS.

### Exclus (jamais dans le pivot)
- Lecture d'écran, capture du client WoW, PrintWindow.
- Clic automatisé, simulation d'entrée, contrôle du personnage.
- Addon en jeu, interaction avec le journal de pêche ou l'interface WoW.
- Mémoire ou lecture de processus du jeu.
- Téléchargement d'un binaire de bot.
- Vente d'une licence d'automatisation.

---

## 5. Valeur commerciale

- **Crédibilité :** un produit qui ne promet pas ce qu'il ne peut pas prouver, sans risque de bannissement lié à l'automatisation.
- **Confiance :** honesty-ledger conservé (ce qui est fait / en développement / planifié), pas de preuve sociale fabriquée, pas de "100% free" quand le produit est payant.
- **Réutilisation :** le planificateur JS/Python, le carnet de spots (JSON versionné) et la démarche d'honnêteté des statuts sont déjà développés et testés.
- **Public :** joueurs de WoW Classic souhaitant préparer leurs sessions de pêche sans enfreindre les règles, sur serveurs officiels ou privés.

---

## 6. Pages nécessaires (site statique)

| Page | Rôle |
|------|------|
| `index.html` | Accueil : présentation du planificateur, démo navigateur (données simulées, déjà existante), honest-ledger |
| `planner.html` | Planificateur de routes (saisie manuelle des spots) — nouvelle page |
| `spots.html` | Carnet de spots personnel (création, édition, export/import JSON) — nouvelle page |
| `simulator.html` | Simulateur de rendement hors ligne (estimations étiquetées) — nouvelle page |
| `guides.html` | Guides de pêche statiques (informations générales, pas d'automatisation) — nouvelle page |
| `modules.html` | Registre honnête des modules (déjà existant, adapté) |
| `buy.html` | Si un produit est vendu : licence d'accès aux outils (pas d'automatisation), prix cohérent |
| `legal/` | Conditions, confidentialité, remboursements (déjà existants) |
| `docs/` | Guides d'utilisation du planificateur et du carnet |

Le site reste **100 % statique** (HTML/CSS/JS vanilla, pas de framework), publié sur GitHub Pages / Cloudflare Pages. Pas de Worker de paiement obligatoire, pas de R2 binaire de bot.

---

## 7. Architecture technique

- **Frontend :** HTML/CSS/JS vanilla, modules ES, design system existant (tokens, CSS composites-only, prefers-reduced-motion).
- **Planificateur :** réutilisation du `route-planner.js` existant (parité JS/Python vérifiée 12/12), exécuté côté navigateur sur données saisies manuellement.
- **Stockage :** `localStorage` du navigateur pour le carnet de spots (pas de serveur, pas de données personnelles transmises), export/import JSON.
- **Hébergement :** statique, pas de secret dans le frontend, pas de clé API tiers.
- **Budget gzip :** ≤ 210 Ko (respecté actuellement ≈ 67 Ko).
- **Accessibilité :** un seul `<h1>` par page, labels, focus-visible, ARIA, clavier, contraste (design system existant).
- **SEO :** canonical, hreflang EN/FR, sitemap.xml, robots.txt (déjà en place).

---

## 8. Garde-fous de conformité

Avant toute publication du pivot, vérifier :
- Aucune mention de "bot", "farm automatique", "anti-ban", "anti-détection", "indétectable".
- Aucune promesse de gain, de rendement garanti, d'absence de ban.
- Aucun lien vers un téléchargement de binaire d'automatisation.
- L'avertissement "l'automatisation peut enfreindre les ToS de Blizzard" reste présent et clair (pour le cas où l'utilisateur chercherait encore l'ancien produit).
- Le prix affiché est cohérent et prouvé (pas de "100% free" si payant).

---

## 9. Plan de migration (sans supprimer l'existant, sans dépense)

1. **Conserver** le dépôt et le site actuel en l'état (pas de suppression des données historiques, preuves QA, rapports).
2. **Ne pas déployer** le Worker de paiement ni ne lever le garde-fou commercial sans autorisation explicite.
3. **Développer** les nouvelles pages (planner, spots, simulator) dans une branche dédiée, sur le site statique existant.
4. **Tester** avec la suite existante (validate, link-check, E2E sur les nouvelles pages).
5. **Publier** le pivot sur une branche/pages séparée ou en parallèle, sans promouvoir l'ancien produit d'automatisation.
6. **Décider**, sur base d'une autorisation explicite, si l'ancien produit d'automatisation est maintenu, suspendu ou retiré.

Aucune dépense, aucune mutation de production, aucun paiement réel dans le cadre de ce pivot.

---

## 10. Risques et décisions restantes

| Risque | Niveau | Action |
|--------|--------|--------|
| L'ancien produit d'automatisation reste accessible | Élevé | Décider (suspendre/retirer) sur base d'autorisation explicite |
| Affirmations marketing résiduelles ("100% free", preuve sociale) | Moyen | Corrigées P1 dans le bundle Worker ; vérifier qu'il n'en reste aucune |
| Conformité Blizzard non établie pour l'ancien produit | Critique | Ne jamais déclarer le produit autorisé |
| Acceptation utilisateur du pivot (moins "magique") | Moyen | Positionner sur la préparation de session, pas sur l'automatisation |

**Décision requise :** valider le périmètre du pivot et décider du sort de l'ancien produit d'automatisation (maintenu en l'état / suspendu / retiré), sur base d'une analyse juridique des ToS Blizzard.
