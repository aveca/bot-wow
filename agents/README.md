# Agents BOT-WOW — état partagé

GitHub est la seule source commune. Ce dépôt ne donne accès à aucune tâche interne ChatGPT, Grok ou Factory. Les agents (Cursor, Grok Bot, tâches récurrentes, OpenCode, Factory V3) lisent ces fichiers avant de commencer et y publient le résultat avant de terminer.

## Lire avant de commencer

1. `PROJECT_STATE.md`
2. `agents/locks.md`, `agents/tasks.md`, `agents/blockers.md`
3. Les pull requests ouvertes dont les fichiers touchent `agents/locks.md`

Ne pas démarrer un `scope` déjà `active` et non expiré, ni dans `agents/locks.md` de `main`, ni dans une autre PR ouverte. `node scripts/check-agent-state.mjs` vérifie le format. En CI de pull request, le workflow Validate relance ce script avec `CHECK_OPEN_PR_LOCKS=1`.

## Publier à la fin

Mettre à jour, dans la même branche :

- `PROJECT_STATE.md` (vérité datée, preuves, une prochaine action)
- le registre concerné (`tasks`, `blockers`, `decisions`, `deployments`, `test-results`)
- `agents/locks.md` : passer le verrou à `done` ou `released`, avec le lien du commit ou de la PR dans `result`

## Verrou

Table de `agents/locks.md` :

| colonne | sens |
|---|---|
| id | identifiant stable `[a-z0-9-]` |
| scope | jetons séparés par des virgules |
| agent | nom de l'agent et identifiant d'exécution |
| branch | branche de travail |
| status | `active`, `done` ou `released` |
| expires | date ISO-8601. Un verrou `active` expiré ne bloque plus |
| result | lien ou résumé. Jamais de secret |

Poser le verrou `active` dans la PR avant le gros du travail. Un scope `active` non expiré en double fait échouer la vérification.

## Publication

`scripts/build-site.mjs` ne publie ni `PROJECT_STATE.md` ni `agents/`. Ne pas les déplacer sous `docs/`, `assets/`, `fr/` ou `legal/`.

## Interdit sans autorisation explicite du propriétaire

Prix, checkout public, profil ou compte Mollie, secrets, déploiement Worker, écriture D1 ou R2, e-mail réel, DNS, suppression de données.
