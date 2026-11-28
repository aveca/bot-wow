# Agent instructions — BOT-WOW

Before doing any work in this repository, read `PROJECT_STATE.md`, `agents/locks.md`, and `reports/operations/BOT-WOW-CURRENT-STATE.md`.

Do not start a task scope that is `active` and unexpired in `agents/locks.md` or in another open pull request. Publish the result in `PROJECT_STATE.md` and `agents/` before finishing. GitHub is the shared source of truth. See `agents/README.md`.

## Session-resumption rules

1. Treat the current-state document as a persistent, dated operational snapshot. Check its linked GitHub PRs and refresh only facts that may have changed or are required for the current task.
2. Do not ask the user to repeat context or redo completed P0–P0.7 diagnostics when reports and proof links already exist.
3. Do not reconfigure Cloudflare secrets merely because the secret values are masked. The presence of a `secret_text` binding name and the functional validity of its value are different questions.
4. Never create `ADMIN_PASSWORD` without evidence that the current code requires it; the observed admin binding is `ADMIN_PASSWORD_HASH`.
5. Do not run `wrangler secret put`, modify secrets/bindings, or deploy Worker/Pages without evidence of a specific defect and explicit user authorization.
6. Do not claim that a change is in production because it exists in a branch or PR. Verify deployed code directly through Cloudflare after an authorized deployment.
7. For download delivery changes, inspect the existing [PR #19](https://github.com/aveca/bot-wow/pull/19) before making edits. Avoid duplicate competing fixes.
8. Keep R2 release-object mutations, production changes, and real payment/email actions prohibited unless the user explicitly authorizes a specific action.
9. At task completion, update the current-state document with dated evidence, exact commit IDs, report/PR links, remaining blockers, and one next action. Publish the update to GitHub, not only to local disk.
10. If the current-state file is missing from the starting branch, look for its open documentation PR or branch before asking the user to reconstruct the context.

## Evidence standard

Label facts as one of: directly verified (with link/tool result), reported in an earlier mission (with report link), or not yet verified. Never treat hidden secret values as proof of absent secrets; never treat a successful CI run as proof that an artifact or production deployment is correct.


## ChatGPT ↔ OpenCode : protocole de collaboration

Ce protocole complète les consignes spécifiques du dépôt ; il ne les remplace pas. Les règles de sécurité, produit et runtime propres au projet restent prioritaires.

### Responsabilités
- **ChatGPT** pilote : inspecte les éléments publiés sur GitHub, fixe les objectifs et critères d'acceptation, puis contrôle le diff et la CI.
- **OpenCode** exécute localement : code, terminal, tests, navigateur, YouTube, extensions et outils réellement disponibles.
- **GitHub** conserve la vérité partagée : commits poussés, branches, PR, rapports et Actions.
- **L'utilisateur** transmet le prompt à OpenCode puis son rapport à ChatGPT ; ne lui délègue pas l'analyse technique ni les validations ordinaires.

### Cycle
1. Vérifier remote, dépôt, branche, SHA et `git status --short`.
2. Lire ces consignes ainsi que les fichiers d'état pertinents. Éviter les audits répétés.
3. Définir une tâche cohérente, un périmètre précis et un résultat mesurable.
4. Préserver tout changement local préexistant ; ne jamais l'écraser ni le nettoyer.
5. Travailler sur une branche dédiée pour le code applicatif.
6. Lancer les tests pertinents, inspecter le diff complet et `git diff --check`.
7. Si les contrôles passent, commit ciblé et push de la branche. Pas de push direct sur la branche par défaut pour du code applicatif ordinaire.
8. Ne donner une URL de PR qu'après confirmation de sa création.

### Rapport obligatoire
```text
MISSION: <nom court>
REPOSITORY: <owner/repo>
BRANCH: <branche>
COMMIT: <SHA complet ou aucun>
PUSH: oui/non
MODIFICATIONS: <résumé + fichiers>
TESTS: <commandes exactes + résultats réels>
CI: <URL + statut, ou non déclenchée>
TESTS LOCAUX RÉELS: <faits + résultats>
NON VÉRIFIÉ: <limites, ou aucun>
BLOCAGE: oui/non — <raison>
```

### Boucle de contrôle
À réception du rapport, ChatGPT vérifie le commit, le diff réel et les résultats CI sur GitHub, puis renvoie le prompt correctif ou la mission suivante. Le rapport seul n'est pas une preuve. Ne demander aucune validation ordinaire à l'utilisateur.

### Efficacité et sécurité
- Modification minimale ; pas de refonte ni dépendance sans justification.
- Après deux échecs d'une approche, changer de méthode ou signaler le blocage.
- Séparer unit tests, intégration, navigateur/runtime réel et production. Une simulation n'est jamais une preuve réelle.
- Ne jamais inventer de résultats, métriques ou fonctionnalités.
- Pas de force-push, réécriture d'historique, suppression de données ou exposition de secrets.
- Les règles locales concernant paiements, données, sécurité et production priment.
- Pas de migration destructive, merge sur branche par défaut ou déploiement de production sans autorisation explicite.
- Un commit documentaire ne doit pas déclencher un déploiement applicatif inutile : utiliser `paths-ignore: ['AGENTS.md']` dans les workflows de déploiement concernés, sans désactiver la CI utile.


## Mandatory correction and anti-recurrence standard

For every task: inspect prior issues/PRs/reports first; prove the current root cause; implement the smallest authorized correction; add a regression test; run relevant tests and inspect the full diff; report exact commands, exit codes, commit SHA and CI on that SHA; then verify the actual live URL/API or runtime. If live verification is unavailable, mark NON VÉRIFIÉ. A report, dispatch, build or green CI alone never closes a task.

Publish an actionable anti-recurrence note for the responsible agents (symptom, proven cause, exact fix, regression test, guardrail and links). Never claim an agent handoff without a posted message or confirmed receipt. Reuse existing issues/PRs; do not duplicate work. Keep CORRIGÉ, TESTÉ, CI VALIDÉE, DÉPLOYÉ, LIVE VÉRIFIÉ and BLOQUÉ as separate evidence-backed statuses. Never bypass a delivery policy, legal/payment/security gate or human approval. A failed/blocked task remains blocked until the underlying gate is corrected through its authorized process.


---

## MANDAT COMMERCIAL PRIORITAIRE — référence au 2026-11-11

Cette section est une décision produit explicite du fondateur. Elle prime sur les anciens objectifs, tableaux de bord, rapports et hypothèses commerciales contradictoires.

### Périmètre actif
- **BOT-WOW** : https://bot-wow.com/
- **Sargasses / Sargagame** : réseau de sites de prévision sargasses et offres B2C/B2B.
- Tous les autres projets et dépôts sont hors périmètre commercial actif, sauf demande explicite ultérieure du fondateur. Les dépôts Factory/orchestration ne servent qu'à exécuter et superviser le travail de ces deux produits.

### Référence de revenus — ZÉRO
- La référence commerciale actuelle est **0 € de ventes attribuables aux parcours des sites depuis plusieurs mois**.
- Les anciens paiements réglés directement avec des clients en dehors du site sont exclus : ils ne constituent PAS des ventes générées par le projet/site et ne doivent jamais être réintégrés au chiffre d'affaires, au funnel, aux taux de conversion ou aux objectifs.
- Ne pas rouvrir les investigations de ces anciens paiements, ne pas tenter de récupérer ces transactions comme ventes du site et ne pas relancer ces anciens clients au titre de cette décision.
- Les paiements TEST, simulations, démonstrations, tentatives expirées/annulées/échouées, commandes non encaissées et simples clics/intentions ne sont jamais des ventes.
- Ne jamais déduire un encaissement réel du seul fait qu'une requête a été lancée avec `testmode=false`. Vérifier le mode et les preuves de transaction disponibles.
- Une vente n'est comptabilisée que si elle est nouvelle, attribuable au parcours commercial du site, réellement encaissée en environnement LIVE et confirmée par une preuve fiable. Séparer les devises ; déduire remboursements/annulations lorsqu'ils sont vérifiés. Si l'attribution ou le mode est incertain, classer NON VÉRIFIÉ et ne pas compter.

### Objectif et ordre de priorité
**Objectif absolu : réaliser le plus rapidement possible de nouvelles ventes réelles et des encaissements pour BOT-WOW et Sargasses/Sargagame.**
1. Chercher et corriger d'abord les blocages prouvés empêchant une vente, un paiement ou la livraison d'une nouvelle commande.
2. Prioriser acquisition qualifiée, offres et messages commerciaux véridiques, CTA, conversion, relance autorisée de prospects récents identifiés, rétention et preuve de livraison.
3. Préférer les actions rapides, mesurables, à faible coût et directement reliées à une vente.
4. Les audits répétitifs, refontes décoratives, métriques de vanité et développements sans lien démontré avec l'acquisition, la conversion ou la livraison passent après les actions commerciales.
5. À chaque mission, expliciter le résultat commercial visé, la preuve attendue et la mesure disponible. Ne jamais inventer trafic, prospects, ventes, attribution ou KPI.

### Garde-fous
- Ne jamais utiliser de données TEST comme preuve de vente LIVE.
- Ne pas modifier prix, checkout, configuration de paiement, webhooks, licences, secrets, migrations, DNS, remboursements, transferts, dépenses ou infrastructure critique sans autorisation spécifique préalable.
- Les communications commerciales autorisées doivent rester ciblées, véridiques, conformes aux règles applicables et adressées à des prospects identifiés ; aucun envoi massif ni spam.
- Ne jamais annoncer une vente, livraison, correction, fusion ou mise en production sans preuve correspondante.
- Reprendre l'état confirmé le plus récent et éviter de répéter un contrôle déjà conclu sans nouvel élément.

### Reporting obligatoire
Afficher séparément :
- **VENTES SITE LIVE CONFIRMÉES** : nombre et montant encaissé, devise par devise, période et preuve.
- **TEST / SIMULATION** : séparé, jamais additionné aux ventes.
- **HORS PÉRIMÈTRE** : paiements manuels historiques, exclus des résultats.
- **NON VÉRIFIÉ** : toute transaction dont le mode, l'attribution ou l'encaissement n'est pas prouvé.
- **PROCHAINE ACTION COMMERCIALE** : action concrète la plus rapide susceptible de produire une nouvelle vente.

Ne jamais présenter le montant brut des tentatives de paiement comme du chiffre d'affaires. Le zéro commercial est le point de départ à améliorer, pas une raison de fabriquer des ventes ou des métriques.
