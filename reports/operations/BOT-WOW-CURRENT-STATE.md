## CI final revalidation — 2026-10-28 14:27 UTC

- [PR #60](https://github.com/aveca/bot-wow/pull/60) remains a draft, unmerged and undeployed.
- On code/report SHA `9da21b041892e238382be6f5543ce5d0df69d4bf`, [Validate run 40705954062](https://github.com/aveca/bot-wow/actions/runs/40705954062) and [UI quality run 40705954016](https://github.com/aveca/bot-wow/actions/runs/40705954016) both completed successfully.
- Validate logs show the synthetic webhook/redaction assertions, mocked Resend request, and provider-error redaction assertions passing. The earlier failed runs on SHA `a4907e27ced7629bc578a35b4fe9d725b7136e4e` were superseded after restoring the redacted conversion-telemetry diagnostic expected by an existing static invariant.
- This follow-up note is documentation-only; do not amend it merely to include its own resulting SHA. Check the branch head and its checks directly after this update.
- No real payment, email, production D1/R2 mutation, secret change, or Worker deployment occurred. P0 Mollie idempotency/recoverable fulfillment remains unresolved; PR #60 must not be merged/deployed without explicit approval because it changes the transactional resend path.

---

## Revalidation opérationnelle — 2026-10-28 14:25 UTC (PR #60)

- **Code / branche :** préparation du correctif sur `fix/p0.15-worker-log-redaction`. SHA du code et des tests avant cette note : `23744eb04c76147496a1c540f076dc81df89c312`. Ne pas créer de boucle de commits pour inscrire le SHA de ce propre rapport ; vérifier le HEAD effectif et les checks directement sur GitHub.
- **PR dédiée :** [#60 — redaction des logs Worker et test du renvoi transactionnel](https://github.com/aveca/bot-wow/pull/60), brouillon ouvert, pas fusionné ni déployé.
- **Correctifs préparés :** suppression des emails, clés de licence, tokens/URLs tokenisées, identifiants de paiement et corps d'erreur fournisseur dans les logs sensibles ; le helper de renvoi utilise le même chemin transactionnel que la livraison normale. Les notifications administratives restent explicitement non configurées, sans fausse promesse.
- **Preuve CI :** [Validate run 40705689059](https://github.com/aveca/bot-wow/actions/runs/40705689059) est **success** sur le SHA `23744eb04c76147496a1c540f076dc81df89c312`. Les logs confirment que `tests/worker-log-redaction.test.mjs` passe : le webhook synthétique, l'absence de PII/clé/token dans les logs, le renvoi avec Resend mocké et l'expurgation d'erreurs sont vérifiés. Un run précédent sur le SHA antérieur a échoué sur une assertion statique de `conversion-path.test.mjs`; le message a été rétabli en version expurgée, puis Validate a réussi.
- **Qualité UI :** [UI quality run 40705689035](https://github.com/aveca/bot-wow/actions/runs/40705689035) était encore en cours au dernier contrôle ; ne pas déclarer tous les checks verts avant son résultat final.
- **Garde-fous :** aucun paiement, e-mail réel, mutation D1/R2, secret ou déploiement Worker n'a été effectué. La PR change le chemin de renvoi ; ne pas fusionner/déployer sans autorisation explicite.
- **P0 restant :** issue #13 — le marqueur webhook est écrit avant fulfillment et le retry peut répondre 200 sans reprendre un état incomplet ; la file `deliveries` n'a pas de consommateur de reprise démontré. Le funnel, le blocage UI, le téléchargement, le support et la cohérence du quota d'activation restent des tâches séparées.

---

## Revalidation opérationnelle — 2026-10-28 11:12 UTC

- **Git / CI :** le HEAD de `main` est le commit documentaire `fe985fb169c31a302c2e1df14a12d081e8d382a3`. Les workflows `validate` [40672287285](https://github.com/aveca/bot-wow/actions/runs/40672287285) et `deploy` [40672287533](https://github.com/aveca/bot-wow/actions/runs/40672287533) sont verts sur ce SHA. Le code du Worker n'a pas été modifié par ces commits documentaires.
- **PR #53 :** HEAD `8eaad0ed87de21f96f4401ea34ccb7ada72d97c1`, checks `validate`, `ui-quality` et GitGuardian réussis. La revue reste bloquée par des contradictions non couvertes : `buy.html` et `fr/buy.html` disent encore « delivery to be confirmed » / « livraison à confirmer », alors que l'encadré affirme la livraison vérifiée ; le test de vendabilité ne couvre que les pages d'accueil EN/FR.
- **Nouvelle preuve support/renvoi :** dans le Worker déployé et `main/worker/index.js`, `handleResend()` appelle le helper historique `sendDeliveryEmail()`, qui journalise l'adresse, la clé et l'URL avec token au lieu d'envoyer un e-mail. La promesse « a re-send procedure exists » de la PR #53 n'est donc pas étayée. Le risque est suivi par [issue #59](https://github.com/aveca/bot-wow/issues/59), et la revalidation est publiée dans [la discussion de la PR #53](https://github.com/aveca/bot-wow/pull/53#issuecomment-6467544938).
- **État Worker / R2 lu via Cloudflare :** `botwow-api` n'a pas été redéployé ; dernier déploiement observé le 2026-10-27 à 07:46:28 UTC. Le code déployé conserve `RELEASE_STATUS = "pending"` comme valeur de repli, mais la valeur effective du binding secret n'a pas été lue. Le bucket `botwow-binaries` contient `casinobabe-fishing-1.2.0.zip` (1 387 543 octets) et l'ancien `Casinobabe-v1.0.38.zip` (1 229 709 octets). La présence de l'objet ne prouve pas à elle seule le fulfillment Mollie.
- **D1 production — SELECT seulement :** 11 commandes Mollie `failed`, 0 `paid`; 5 commandes `bitcoin_manual` `paid`, 8 `pending_payment`, 1 `rejected`; 16 marqueurs webhook Mollie ; 0 ligne `deliveries`; 5 licences actives ; 5 tokens de téléchargement. Les cinq paiements payés sont Bitcoin manuel. `changed_db=false`, `rows_written=0`. Aucun paiement externe perdu n'est déduit.
- **Analytics — SELECT seulement, depuis 2026-10-22T06:30:36.792Z :** `page_view=1187`, `journey_view=393`, `cta_click=41`, `checkout_requested=26`, `checkout_created=6`, `checkout_failed=6`, `checkout_start=4`. Les 26 demandes ont `journey_id`, aucun des 6 `checkout_created` ou 6 `checkout_failed` n'en a. Dernier événement observé : `2026-10-28T10:28:56.772Z`. Ce sont des événements, pas des visiteurs uniques ; `checkout_created` n'est pas une vente.
- **Live public :** la page d'accueil relue le 2026-10-28 indique toujours « delivery status under verification » / « do not purchase until delivery is confirmed » tout en affichant un CTA et un formulaire « Pay €20.00 » actifs ([capture textuelle live](https://bot-wow.com/)). La démo reste interactive avec données simulées.
- **Décision suivante :** ne fusionner ni PR #53 ni PR #54 pour l'instant. Corriger d'abord les logs sensibles et le renvoi, rendre le webhook/fulfillment Mollie récupérable, puis réévaluer les claims de vente. Aucun checkout réel, paiement, e-mail, mutation D1, modification de secret ou déploiement Worker n'a été effectué pendant cette passe.

---

# Revalidation opérationnelle — 2026-10-28 10:20 UTC

**Vérification directe de cette passe ; ce bloc complète l'instantané historique ci-dessous.** Les valeurs de secrets n'ont pas été lues. Les requêtes D1 étaient uniquement des SELECT : `changed_db=false`, `rows_written=0`.

## État actuel et nouvelles preuves

- **Dernier commit de code de référence :** `cf11b36aa14ab9c723d991096c146c490917a85b`. Le snapshot courant a ensuite été publié par le commit documentaire `6e36064c9523498c27b69e49a52a84ebf98bf0d7`. Aucun changement de code produit n'a été ajouté dans cette mise à jour ; pour le HEAD Git exact, consulter [main](https://github.com/aveca/bot-wow/commits/main).
- **Cloudflare Pages :** le déploiement `22669ad5-5973-4d62-a4ac-ccb5a6c013c3` sur `cf11b36` a terminé `success` à **09:43:26 UTC**. Le déploiement documentaire `3b1be295-8300-435b-b78a-59af09836d2f` sur `6e36064` a échoué pendant `clone_repo` avec `RPC failed; curl 16 Error in the HTTP2 framing layer` / `fatal: early EOF`. La relance autorisée `65b5aa43-a923-46b5-b6f9-a976467d9629` a terminé `success` à **10:27:03 UTC**. Le live a été rechargé après cette réussite ; l'avertissement de livraison et le CTA/formulaire de paiement actifs sont toujours présents. Ces déploiements sont documentaires et ne contiennent aucun correctif commercial.
- **GitHub Actions du commit documentaire :** le job `validate` du run [40665576781](https://github.com/aveca/bot-wow/actions/runs/40665576781) et le job `deploy` du run [40665576702](https://github.com/aveca/bot-wow/actions/runs/40665576702) sont terminés avec succès.
- **Worker botwow-api :** dernier déploiement observé par l'API Cloudflare le **2026-10-27 07:46:28 UTC**, version `c3dcc842-c422-42d3-9828-405f30d70b5f`, 100 %. Aucun déploiement Worker n'a eu lieu dans cette passe. Les valeurs effectives des secrets restent inconnues.
- **Production publique :** la page d'accueil affiche encore l'avertissement « do not purchase until delivery is confirmed » tout en présentant un CTA et un formulaire « Pay €20.00 » actifs. La correction UI reste dans la PR #54, pas dans main/live.
- **PR #54 :** ouverte, non fusionnée et non déployée. Dernier HEAD vérifié dans les commentaires : `ff556668b6376cb9fb9985ca812cda25aac13441`. Comparaison directe `main...botwow-p0-ui-ux-2026-10-28` : 26 commits en avance, 3 en retard. Les runs [Validate 40654318060](https://github.com/aveca/bot-wow/actions/runs/40654318060) et [UI quality 40654318065](https://github.com/aveca/bot-wow/actions/runs/40654318065) sont verts sur le HEAD rapporté ; ils ne prouvent pas l'absence de requêtes réseau sur tous les parcours.
- **PR #53 :** toujours ouverte. Un commentaire de supervision a été ajouté le 28 octobre : [réconciliation vente/prix/livraison](https://github.com/aveca/bot-wow/pull/53#issuecomment-6466488311). Ne pas fusionner pour réactiver la vente tant que le conflit avec #54, la provenance du paquet et le Worker réellement déployé ne sont pas réconciliés.
- **Issue #59 sécurité :** ouverte. Le code source et le bundle Worker observé contiennent encore des chemins de logs qui exposent potentiellement email, clé de licence et URL de téléchargement/token. C'est un risque au niveau du code, pas une preuve que des logs clients ont été consultés. Aucun log historique contenant des données personnelles n'a été lu.
- **Release R2 v1.2.0 / issue #18 :** l'empreinte globale documentée reste `1c132f367607ea186feffde8bbda0a1a9f94cdec4b7850b93c57c271270bba4f`, taille 1 387 543 octets. Le contenu de `VERSION`, les CRC/hashes individuels du manifeste et la provenance reproductible restent à certifier. Ne pas confondre la preuve SHA-256 globale avec une certification complète du paquet.
- **Worker de livraison :** le code déployé observé conserve le fallback vers `Casinobabe-v1.0.38.zip` et le nom de fichier historique. Les PR #19 et #44 sont les candidates existantes à réconcilier ; ne pas créer un correctif concurrent avant leur inspection.
- **D1 botwow-production (lecture seule) :** commandes Mollie `failed=11`, `paid=0`; commandes `bitcoin_manual` : `paid=5`, `pending_payment=8`, `rejected=1`; 16 marqueurs webhook Mollie ; 0 ligne `deliveries` ; 5 licences `active` ; 5 téléchargements. Les cinq commandes payées sont Bitcoin manuel, pas Mollie. Ces nombres ne prouvent pas qu'un paiement Mollie externe a été encaissé ou perdu.
- **D1 botwow-analytics (lecture seule) :** `page_view=1179`, `journey_view=389`, `cta_click=41`, `checkout_requested=26`, `checkout_created=6`, `checkout_failed=6`, `checkout_start=4`, `conversion=0`, `payment_confirmed=0`. Tous les 26 `checkout_requested` ont `journey_id`, aucun des 6 `checkout_created` ou 6 `checkout_failed` n'en a. Dernier événement observé : `2026-10-28T09:37:58.580Z`. Ce sont des événements, pas des visiteurs uniques. Le fallback d'INSERT dans `emitFunnelEvent()` après toute erreur reste une cause plausible, pas une cause racine démontrée.
- **Offre/support :** `PRODUCT.md` annonce une activation sur une machine ; le Worker crée les licences avec `max_activations=2`. Ne pas choisir la politique commerciale sans approbation. `handleSubscribe()` ne démontre toujours pas la création/transmission d'un dossier support durable.
- **Démo :** issue #25 fermée ; ne pas la rouvrir sans régression nouvellement prouvée.

## Prochaine action prioritaire

1. Préparer une PR ciblée pour expurger les logs sensibles et ajouter des tests capturant `console.log/warn/error` ; aucun déploiement ni rotation de secret.
2. Préparer une PR séparée pour rendre les webhooks Mollie et le fulfillment récupérables après échec partiel, avec tests de concurrence/retry sur fixtures ; aucun paiement, e-mail ou D1 de production.
3. Réconcilier la PR #54 avec main, remplacer les CTA d'achat résiduels, nettoyer les PNG suivis et ajouter des assertions réseau prouvant zéro checkout/redirection Mollie lorsque bloqué. Ne pas fusionner/déployer le checkout sans autorisation.
4. Réconcilier #19/#44 et compléter la certification du manifeste/provenance avant toute réactivation de la vente.
5. Traiter support et attribution dans des PR distinctes. Ne jamais traiter `checkout_created` comme une vente confirmée.

Cette mise à jour ne modifie aucun code de paiement, Worker, secret ou donnée de production. Elle n'enregistre pas son propre SHA ; consulter l'historique Git pour l'identifiant du commit documentaire qui la publiera.

---

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
