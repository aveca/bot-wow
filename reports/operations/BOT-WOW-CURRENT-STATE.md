# BOT-WOW — État opérationnel persistant

**Version :** 1.0  
**Dernière consolidation fondée sur des vérifications directes :** 28 octobre 2026  
**Dépôt :** `aveca/bot-wow`  
**But :** permettre à une nouvelle session IA de reprendre le travail sans redemander les mêmes configurations et sans répéter les diagnostics terminés.

> Ce document est un instantané horodaté, pas une vérité permanente. Au démarrage d’une session, vérifier uniquement les éléments qui peuvent avoir changé et ceux requis pour la prochaine action. Ne jamais remplacer une observation directe par une supposition.

## 1. Décisions immédiates pour les agents

1. **Ne pas redemander de reconfigurer Cloudflare à chaque session.** Lire d’abord les sections ci-dessous, le code courant et les liens GitHub.
2. **Ne pas recréer de secrets parce que leurs valeurs sont masquées.** Un nom de binding présent n’établit pas que sa valeur est fonctionnelle, mais l’inverse — une valeur non lisible — ne prouve pas que le secret est absent.
3. **Ne pas créer `ADMIN_PASSWORD` sur la seule base d’un ancien rapport.** Le binding observé et utilisé par le code examiné est `ADMIN_PASSWORD_HASH`.
4. **Ne pas lancer `wrangler secret put`, remplacer un secret ou changer un binding sans preuve précise et autorisation explicite.**
5. **Ne pas fusionner une PR de code ni déployer un Worker/Pages en production sans autorisation explicite.**
6. **Ne jamais confondre un correctif dans une branche/PR avec du code déjà déployé.** Le déploiement doit être vérifié directement via Cloudflare après autorisation.
7. Ne pas refaire P0 à P0.7 au complet. Reprendre à la première action réellement inachevée.
8. Avant d’écrire un nouveau correctif de téléchargement, examiner en priorité la PR #19 ; ne pas créer un doublon.
9. Après chaque mission, mettre à jour ce document avec la date, les preuves, le commit, les liens et l’action suivante. Publier la mise à jour sur GitHub, pas uniquement sur le disque local.

## 2. État Cloudflare directement observé

**Compte :** `abf2b92cf718313567b4b38eb9dda17f`  
**Worker :** `botwow-api`  
**Objet R2 attendu :** `botwow-binaries/casinobabe-fishing-1.2.0.zip`

Lors du contrôle direct de l’API Cloudflare le 28 octobre 2026 :
- `GET /accounts/{account_id}/workers/scripts/botwow-api/settings` répondait HTTP 200.
- Le Worker avait notamment les bindings `R2_BINARIES` (bucket `botwow-binaries`), `R2_OBJECT_KEY`, `RATE_LIMIT`, `DB` et `TELEMETRY_DB`.
- Les noms de bindings suivants étaient répertoriés comme `secret_text` : `ADMIN_EMAIL`, `ADMIN_JWT_SECRET`, `ADMIN_PASSWORD_HASH`, `CONTACT_EMAIL`, `EXPORT_TOKEN`, `LICENSE_SECRET`, `MOLLIE_API_KEY`, `MOLLIE_PROFILE_ID`, `MOLLIE_WEBHOOK_SECRET`, `RELEASE_STATUS` et `RESEND_API_KEY`.
- La métadonnée du script indiquait une dernière modification le `2026-10-27T07:46:02.74279Z` et un déploiement via Wrangler.
- Les valeurs secrètes ne sont pas lisibles à partir de cette vérification. Leur fonctionnement réel n’a pas été établi par le seul listing des bindings.

### Contradiction entre configuration et rapports

Le `wrangler.toml` dans `main` contient des commentaires indiquant que plusieurs paramètres/secrets sont à configurer, alors que la liste des bindings du Worker Cloudflare indique que leurs noms sont présents. **Ne pas suivre aveuglément les anciens commentaires du TOML ni réécrire les secrets.** D’abord comparer les besoins du code déployé, les bindings réels et les résultats non destructifs.

Dernier constat de code de production directement récupéré via l’API Cloudflare : le Worker contenait encore le comportement de repli vers l’archive historique, le retour `404 file_not_found` et le nom de fichier historique codé en dur (détails ci-dessous). L’API a démontré l’état observé à cette date ; une nouvelle session doit contrôler l’état uniquement avant l’action de production envisagée.

## 3. Release R2 v1.2.0 — preuve P0.7

Rapport de preuve : [PR #57](https://github.com/aveca/bot-wow/pull/57)  
Objet : `botwow-binaries/casinobabe-fishing-1.2.0.zip`

| Contrôle | Résultat observé |
|---|---|
| Taille réelle lue dans R2 | `1 387 543` octets |
| SHA-256 calculé sur les octets réels via Worker temporaire | `1c132f367607ea186feffde8bbda0a1a9f94cdec4b7850b93c57c271270bba4f` |
| SHA-256 comparé à la référence | Correspondance exacte |
| Signature EOCD | Trouvée |
| Répertoire central ZIP | Lisible et cohérent selon le contrôle de structure effectué |
| Entrées du répertoire central | 30 |
| Entrée `VERSION` | Présente par nom |
| Entrée `MANIFEST.json` | Présente par nom |

Le connecteur MCP ne préservait pas les octets binaires, donc le SHA-256 a été calculé **dans Cloudflare**, avec `crypto.subtle.digest("SHA-256", bytes)` sur les octets retournés par la liaison R2. Le résultat a été récupéré via Workers Observability.

Le Worker temporaire, son consommateur de file et la file temporaire ont été supprimés, et l’API a confirmé leur absence après nettoyage. Aucun objet R2 ni Worker de production n’a été modifié pour ce contrôle.

### Limites de la preuve

La correspondance SHA-256 avec la référence est prouvée pour l’objet R2 observé. Le contrôle de structure a validé la présence de l’EOCD et la lisibilité du répertoire central ; il **n’a pas** décompressé et validé le contenu de chaque fichier, les CRC de chaque entrée, le contenu de `VERSION`, le JSON de `MANIFEST.json` ni les empreintes individuelles référencées par le manifeste. La provenance et la reproductibilité du build restent des contrôles séparés.

L’archive locale `reports/bot-wow/pkg/casinobabe-fishing-1.2.0.zip` a été signalée comme différente (1 346 120 octets, empreinte différente) et incomplète lors des analyses précédentes. Ne pas l’assimiler à l’objet présent dans R2.

## 4. Code du téléchargement : main, production et PR

### État de la branche `main` examiné

Fichier : [`worker/index.js` dans main](https://github.com/aveca/bot-wow/blob/main/worker/index.js)

Lors du contrôle direct du 28 octobre, le code présent dans `main` :
- tentait `env2.R2_OBJECT_KEY`, puis `casinobabe-fishing-1.2.0.zip`, puis `Casinobabe-v1.0.38.zip` (repli vers une ancienne archive) ;
- renvoyait `404 file_not_found` si aucun objet candidat n’était disponible ;
- codait `Casinobabe-v1.0.38.zip` en dur dans `Content-Disposition).

La récupération directe du script Worker Cloudflare confirmait le même comportement historique à ce moment-là. Donc le rapport qui affirme que les deux corrections sont déjà « en place » ne doit pas être interprété comme une preuve de déploiement.

### Correctif existant prioritaire

**PR #19 :** https://github.com/aveca/bot-wow/pull/19  
Branche : `fix/download-artifact-integrity-20261023`  
HEAD observé : `0a1a6a5d494a51018684027950688aeb0a8ac988`  
État lors du dernier contrôle : ouverte, non fusionnée.

Le code de cette PR a été examiné et comprend :
- l’interdiction de servir une archive historique de repli ;
- `503 artifact_unavailable` si la clé de release est invalide ou si l’objet attendu est absent ;
- la réservation atomique du quota avant livraison ;
- un nom de fichier dérivé de la clé d’objet versionnée.

Un workflow GitHub Actions associé à ce HEAD avait été signalé réussi antérieurement. Avant une décision, rafraîchir l’état réel du HEAD et les contrôles CI ; ne pas déduire le statut actuel d’une ancienne observation.

### PR commerciales encore à réconcilier

- [PR #53](https://github.com/aveca/bot-wow/pull/53) : annonce que la livraison est vérifiée et propose de retirer l’avertissement commercial.
- [PR #54](https://github.com/aveca/bot-wow/pull/54) : propose de bloquer le paiement tant que la livraison n’est pas confirmée.
- Au dernier contrôle, les deux étaient ouvertes/non fusionnées. Vérifier leur état actuel et décider d’une politique cohérente appuyée par des preuves. Une empreinte R2 correcte ne prouve pas à elle seule toute la chaîne de téléchargement, de licence et de livraison client.

### Autres rapports utiles

- [Synthèse P0 à P0.5 — PR #56](https://github.com/aveca/bot-wow/pull/56)
- [Vérification SHA-256 R2 — PR #57](https://github.com/aveca/bot-wow/pull/57)

## 5. Secrets : inventaire sans exposition

La liste ci-dessous décrit les noms de bindings observés, pas la validité de leurs valeurs :

| Binding | Observation au contrôle | Action permise par défaut |
|---|---|---|
| `MOLLIE_API_KEY` | Nom présent comme `secret_text` | Ne pas recréer ; diagnostic non destructif seulement si nécessaire |
| `MOLLIE_PROFILE_ID` | Nom présent comme `secret_text` | Vérifier son utilisation effective avant toute modification |
| `MOLLIE_WEBHOOK_SECRET` | Nom présent comme `secret_text` | Ne pas recréer ; vérifier le besoin et le comportement du webhook |
| `RESEND_API_KEY` | Nom présent comme `secret_text` | Ne pas recréer ; vérifier le chemin d’envoi dans le code |
| `ADMIN_PASSWORD_HASH` | Nom présent comme `secret_text` | Ne pas recréer ; c’est le binding observé/utilisé par le code admin |
| `ADMIN_PASSWORD` | Nom absent du listing, non identifié comme binding requis | Ne pas le créer sans preuve de besoin |

Ne jamais afficher ou écrire la valeur d’un secret dans un rapport. La simple présence d’un nom de binding ne certifie pas que la valeur fonctionne ; inversement, une valeur masquée ne prouve pas que le secret est absent. Toute modification de secret exige une preuve d’anomalie spécifique et une autorisation explicite.

## 6. Protocole obligatoire au début de chaque session

Les agents doivent suivre ce protocole avant de proposer une action :

1. Lire ce fichier et le fichier racine `AGENTS.md`.
2. Consulter les PR et les commits référencés ici ; détecter si elles ont évolué depuis l’instantané.
3. Pour les besoins Cloudflare, lire l’état réel par MCP en lecture seule : Worker, bindings (noms/types uniquement), configuration et code déployé pertinent.
4. Faire une comparaison ciblée avec ce document. Ne pas répéter un diagnostic qui n’a pas de raison nouvelle d’être repris.
5. Identifier la première tâche réellement inachevée et proposer/réaliser uniquement cette tâche.
6. Ne jamais demander à l’utilisateur de reconfigurer une ressource déjà présente sans preuve d’absence ou d’invalidité.
7. Conserver les secrets dans Cloudflare, les rapports et décisions dans GitHub ; n’inscrire aucune valeur sensible dans ce document.
8. À la fin d’une mission, publier ses preuves et mettre à jour ce document sur une branche/PR dédiée.

Si ce document n’est pas accessible dans la branche de départ, rechercher cette PR ou les branches de documentation avant de demander à l’utilisateur de répéter le contexte.

## 7. Prochaine action et conditions de sortie

### Priorité actuelle

1. Examiner la PR #19 au HEAD actuel : code exact, tests liés à la livraison, état CI et éventuelles divergences depuis l’instantané.
2. Réconcilier la politique de vente et de livraison des PR #53 et #54.
3. Compléter si nécessaire la vérification interne de `VERSION`, du contenu JSON de `MANIFEST.json` et des empreintes individuelles, sans modifier l’objet R2.
4. Documenter une recommandation de fusion. Le déploiement en production est une décision ultérieure et exige une autorisation explicite.

### Interdictions

- Ne pas exécuter `wrangler secret put` sans preuve et autorisation.
- Ne pas créer `ADMIN_PASSWORD` sur la seule base d’un rapport ancien.
- Ne pas fusionner une PR de code sans autorisation.
- Ne pas déployer Worker ou Pages sans autorisation.
- Ne pas uploader, remplacer ou supprimer l’archive R2.
- Ne pas déclencher de paiement ou d’e-mail réel.
- Ne pas déclarer le code « corrigé en production » sur la base d’une PR seulement.

**Résumé d’une ligne pour la reprise :** le SHA-256 de l’objet R2 correspond à la référence, mais le Worker de production observé conserve encore l’ancien repli/fichier/404 ; la PR #19 est le correctif prioritaire à réexaminer ; ne pas reconfigurer les secrets ni déployer automatiquement.
