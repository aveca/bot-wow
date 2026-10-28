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

## 7. Supervision complémentaire — 2026-10-28 09:34 UTC

Cette section complète l'instantané P0.7 après le merge documentaire de la PR #58. Base examinée avant cette mise à jour : `main` à `21d09d22e18031bf4a5351b63cbf58162a15c463`. Cette mise à jour est documentaire ; elle ne modifie aucun Worker, paiement, binding ou donnée de production.

### État des branches et de la production

- PR #58 est fusionnée au commit `21d09d22e18031bf4a5351b63cbf58162a15c463`. Les workflows Validate et UI quality étaient verts sur son HEAD ; la revue Codex n'a pas abouti car la limite d'utilisation du service de revue était atteinte. Le contenu fusionné est documentaire (`AGENTS.md` et ce fichier).
- Cloudflare Pages a déployé ce commit documentaire avec succès : déploiement `64a4b4db-4bf0-4b2b-8c18-dac11601fb9a`, étape `deploy` réussie à `2026-10-28T09:32:08Z`. Le déploiement ne contient pas de correctif de checkout ou Worker.
- PR #54 reste ouverte et non déployée : HEAD `ff556668b6376cb9fb9985ca812cda25aac13441`. Les runs Validate `40654318060` et UI quality `40654318065` sont verts sur ce SHA. La comparaison effectuée après le merge #58 indiquait 26 commits en avance et 2 en retard sur `main`; refaire la comparaison après tout changement de base.
- Le diff de la PR #54 contient 200 fichiers, dont 178 captures PNG suivies. L'artefact UI `12800594733` fait 112 538 622 octets. Les tests actuels ne couvrent pas tous les CTA des pages compare/A-B et ne démontrent pas par interception réseau l'absence de requête `/api/checkout` et de redirection Mollie.

### Défaut UI public toujours ouvert

- Après le déploiement documentaire, la page publique `https://bot-wow.com/` affiche toujours l'avertissement de livraison non vérifiée et un formulaire actif `Pay €20.00`. La source `main/index.html` et `main/fr/index.html` contient encore un bouton `#buyBtn` sans attribut `disabled` ; la PR #54 désactive ces boutons uniquement dans sa branche candidate.
- Sur le HEAD de la PR #54, des CTA d'achat restent dans `index.html`, `fr/index.html`, `compare.html`, `fr/compare.html` et les quatre variantes A/B. Ils pointent vers `#buy` et conservent des libellés/Styles de vente, même lorsque le formulaire est désactivé.
- `/demo.html` redirige actuellement vers `/demo`, qui présente le planificateur interactif et marque les données comme simulées. L'issue #25 peut rester fermée tant qu'aucune nouvelle régression n'est observée.

### P0 sécurité — issue #59

- Le code source `main/worker/index.js` (blob `d2fa2a0943a75374c61cceb5d07ee035d350ee1c`) et le bundle Worker récupéré en lecture seule contiennent plusieurs chemins qui journalisent des informations sensibles : `sendDeliveryEmail()` journalise e-mail, clé et URL avec token ; `sendAdminNotification2()` journalise e-mail et clé ; `fulfillOrder()` journalise l'e-mail et la clé ; `sendEmail2()` journalise le destinataire. Ce sont des chemins de code vérifiés, pas la preuve qu'un client a été exposé. Aucun log client de production n'a été lu.
- L'issue #59 est ouverte. Préparer une PR ciblée avec logs redacted et tests capturant `console.log/warn/error`. Aucun déploiement de sécurité, rotation de secret ou opération de confinement sans autorisation.

### Mollie, téléchargement et attribution

- D1 production en lecture seule : 11 commandes Mollie `failed`, 0 `paid`; 5 commandes Bitcoin manuel `paid`, 8 `pending_payment`, 1 `rejected`; 16 marqueurs `webhook_events`, dont 5 orphelins ; 0 ligne `deliveries`; 5 licences actives et 5 téléchargements. Les requêtes ont confirmé `changed_db=false` et `rows_written=0`. Aucun connecteur Mollie en lecture seule n'est disponible pour confirmer les paiements externes.
- Le Worker déployé insère `payment:<paymentId>` avant `fulfillOrder()` et retourne `200 OK` sur conflit unique sans reprendre un traitement incomplet. La table `deliveries` n'a pas de consommateur de reprise dans le bundle observé. L'issue #13 reste ouverte.
- Le Worker déployé a une garde `RELEASE_STATUS` (valeur de repli `pending`) ; le nom du binding secret est présent, mais sa valeur n'a pas été lue. Le code `main/worker/index.js` n'a pas cette garde. Le code déployé conserve le fallback vers `Casinobabe-v1.0.38.zip` et le nom HTTP historique ; les PR #19 et #44 restent ouvertes.
- La PR #57 documente un SHA-256 calculé sur les octets R2 (`1c132f367607ea186feffde8bbda0a1a9f94cdec4b7850b93c57c271270bba4f`, 1 387 543 octets). Cette preuve est documentée mais les CRC/contenus de chaque entrée, les hash individuels du manifeste et la provenance reproductible restent à certifier ; l'issue #18 reste ouverte.
- Analytics D1, événements `test=0` : 1 175 `page_view`, 387 `journey_view`, 41 `cta_click`, 26 `checkout_requested`, 6 `checkout_created`, 6 `checkout_failed`, 4 `checkout_start`, 0 `conversion` et 0 `payment_confirmed`, fenêtre `2026-10-22T06:30:36.792Z` à `2026-10-28T09:32:54.616Z`. Les 26 `checkout_requested` ont un `journey_id`, mais aucun des 6 `checkout_created` ni `checkout_failed` n'en a. `emitFunnelEvent()` tente une insertion complète puis supprime `journey_id` après n'importe quelle erreur ; cause plausible, à reproduire avant correction.

### Offre et support

- `PRODUCT.md` annonce une activation sur une machine, tandis que le Worker crée les licences avec `max_activations=2`. Ne pas choisir la règle commerciale ni changer le prix de 20 € sans approbation.
- L'issue #8 reste ouverte : `handleSubscribe()` enregistre une adresse dans `botwow_emails` avec source par défaut `newsletter`, sans preuve d'un dossier support durable ni d'une notification effectivement transmise. Préparer une voie support distincte et testée avec mocks uniquement.

### Prochaine action

1. Corriger les logs sensibles dans une PR de sécurité, avec tests de non-divulgation.
2. Préparer séparément l'idempotence et la reprise Mollie après échec partiel.
3. Réconcilier la PR #54 avec `main`, remplacer les CTA compare/A-B par démo/support, ajouter assertions réseau et réduire les PNG suivis.
4. Corriger le fallback de téléchargement dans la branche existante #19/#44, sans modifier R2 ni déployer.
5. Diagnostiquer la vraie erreur Analytics avant de modifier l'attribution ; préparer le handoff support dans une PR distincte.

Limites : cette session a accès au connecteur GitHub et aux lectures Cloudflare (Worker, bindings par noms/types, Pages, R2, D1). Aucun shell/worktree Factory local n'était exposé ; aucun test Playwright local, checkout live, paiement, e-mail, secret ou mutation D1 n'a été exécuté.
