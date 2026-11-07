# Pont Factory V3 multi-dépôt — BOT-WOW

Ce répertoire installe dans **BOT-WOW** le pont multi-dépôt de Factory V3, porté
depuis `aveca/sargagame` (PR #1349, merge commit
`87702066a79c03ff930500a2bad524df58c1f6f7`, fichier
`scripts/autopilot/multi-repo-bridge.cjs`).

## Ce que le pont fait

Il prolonge le pont `bridge.cjs` de Factory V3 pour deux dépôts **autorisés** :

| Règle | Comportement |
|---|---|
| **Allowlist fermée** | seuls `aveca/bot-wow` et `aveca/sargagame` sont lus ; tout autre dépôt est rejeté, jamais exécuté |
| **Routage par dépôt local** | le dépôt local est déduit du remote `origin` (ou de `AUTOPILOT_LOCAL_REPO`) ; un checkout Git sans origin valide ou avec un dépôt hors allowlist échoue ; seul un répertoire hors Git utilise le repli BOT-WOW ; une mission distante est journalisée, jamais enfilée localement et jamais publiée sur le dépôt distant |
| **Déduplication** | clé canonique `chatgpt-issue|<dépôt>|<issue>|<task_id>` + clé historique `chatgpt-issue|<issue>|<task_id>` + `task_id` seul : une mission déjà importée (y compris par `bridge.cjs`) n'est jamais réimportée |
| **Statuts corrélés** | statuts de cycle de vie publiés uniquement sur les issues BOT-WOW ; `aveca/sargagame` est strictement en lecture seule |
| **Garde-fous** | `humanGate` ou `moneyPath` ⇒ mission **jamais** exécutée automatiquement (statut `blocked`) ; contrat de mission vérifié champ par champ, écart signalé et jamais silencieusement comblé |
| **Aucun runner cloud** | module CLI du runner Factory V3 existant : aucune API LLM payante, aucun service externe |

## Adaptations BOT-WOW (et seulement celles-là)

1. `DEFAULT_LOCAL_REPO = 'aveca/bot-wow'` — utilisé uniquement si le
   répertoire n'est pas un checkout Git.
2. Dans un checkout Git, un origin absent, illisible, non-GitHub ou hors
   allowlist provoque un **échec explicite** : aucun fallback vers BOT-WOW.
3. Les dépendances `lib/common.cjs` et `lib/memory.cjs` sont portées en local,
   en sous-ensemble strict de ce que le pont utilise (pas de runner autopilot
   complet inventé).
4. `ensureDirs` est injectable : les tests n'écrivent aucun dossier dans le
   dépôt (comportement de production inchangé).
5. La publication de statuts ou commentaires sur le dépôt distant est
   **désactivée en permanence** dans BOT-WOW. Les anciens flags CLI/env sont
   acceptés pour compatibilité mais ne peuvent pas réactiver l'écriture.

La mémoire locale du runner vit dans `.ai/autopilot/` (ignoré par git) :
`queue.json`, `opportunities/`, `runs/`, `decisions/`.

## Commandes

```bash
# 1. Test déterministe du pont (sans réseau, sans écriture)
npm run test:autopilot

# 2. Dry-run : ce que le runner importerait, SANS rien importer
npm run autopilot:bridge:dry

# 3. Import réel (queue locale + statuts sur les issues BOT-WOW uniquement)
# Sargagame est toujours lu en lecture seule, sans commentaire ni statut distant.
npm run autopilot:bridge

# 4. Publier un statut de cycle de vie
node scripts/autopilot/multi-repo-bridge.cjs --status started --repo aveca/bot-wow --issue 142 --task <TASK_ID>
```

## Démarrage du runner BOT-WOW

1. `npm ci` (dépendances de développement) puis `npm run validate` et `npm test`.
2. Vérifier l'accès GitHub : `gh auth status` doit voir `aveca/bot-wow` (lecture
   des issues) et `aveca/sargagame` (lecture seule, pour le routage).
3. Contrôler le dépôt local reconnu :
   `node scripts/autopilot/multi-repo-bridge.cjs --dry` → la sortie doit afficher
   `local=aveca/bot-wow`.
4. Dry-run : les missions BOT-WOW (#141, #142, #143) doivent apparaître en
   `wouldImport`, les missions Sargagame en `wouldRelay`, et aucune écriture
   ne doit avoir eu lieu.
5. Import réel : `npm run autopilot:bridge`. Les statuts ne sont publiés que
   sur les issues BOT-WOW ; aucune écriture n'est faite dans Sargagame. Le
   runner ne traite ensuite que la queue locale.

## Garanties vérifiables

- `tests/autopilot/multi-repo-bridge.test.cjs` : contrat, allowlist, empreintes,
  idempotence locale (clé canonique, clé historique, id seul), rejet d'un dépôt
  hors allowlist et d'un `repository_full_name` incohérent, routage strict,
  lecture seule distante même après deux passages, `humanGate` bloqué, dry-run
  sans écriture, échec de publication compté, détection fail-closed du remote
  et fallback uniquement hors checkout Git.
- Aucun appel réseau dans les tests : `gh` est injecté.

## Ce que ce pont ne fait PAS

- Il n'exécute aucune mission tout seul : il prépare la queue locale et publie
  les statuts. L'exécution reste le fait du runner Factory V3.
- Il ne lit aucun dépôt hors de l'allowlist.
- Il ne publie aucun statut sur un dépôt non autorisé (une tentative lève une
  erreur explicite).
