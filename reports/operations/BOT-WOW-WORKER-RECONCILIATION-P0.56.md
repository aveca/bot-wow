# BOT-WOW — Reconciliation Worker / fulfillment (P0.56, mission P0.55/P0.56)

**Statut de ce document : preparation uniquement. Aucun deploiement Worker, aucun changement de secret, aucun binding, aucune ecriture D1/R2, aucun e-mail, aucun paiement.**

- **Depot :** https://github.com/aveca/bot-wow
- **Tracker :** issue #99 — P0.55 — reconcile stale Worker; verify email delivery and fail-closed checkout
- **Branche :** `fix/p0.56-worker-fulfillment-reconciliation-20261105`
- **Base :** `origin/main` @ `a4bb457` (`docs(operations): update BOT-WOW current state P0.56`)
- **Worker concerne :** `botwow-api` (script), domaine personnalise `api.bot-wow.com`
- **Version deployee observee :** 50 — version ID `c3dcc842-c422-42d3-9828-405f30d70b5f`, deployment `36227a4d-00e7-4c9f-94e0-0913b29049bc`, creee le 2026-10-27T07:46:28Z, source « Secret Change »
- **Fichier source :** `worker/index.js` (blob `main` = `725d98e4595b27aa60e88758ecac20c711a38b6b`)

---

## 1. Comparaison `main` vs Worker v50 deploye

Toutes les lignes « deploye » ci-dessous sont **directement verifiees** par sondes HTTP GET en lecture seule sur `https://api.bot-wow.com` le 2026-11-06T00:10Z, ou par lecture de la source `main` dans ce depot.

| Point | Worker v50 deploye (2026-10-27) | `main` (`a4bb457`) | Statut |
|---|---|---|---|
| Generateur de landing marketing | present (`handleLanding`) | absent | **ECART** — resolu dans `main`, non deploye |
| Route `/bot-wow-gold` | HTTP 200, HTML marketing legacy (16 765 octets) | 308 vers `https://bot-wow.com` | **ECART** |
| Route `/best-wow-bot` | HTTP 200, HTML marketing legacy (16 765 octets) | 308 vers `https://bot-wow.com` | **ECART** |
| Routes `/bot-wow-classic`, `/bot-wow-gratuit`, `/de/`, `/en/`, `/ru/` | HTTP 200, HTML marketing localise | 308 vers `https://bot-wow.com` | **ECART** |
| Repli sur une archive historique | candidats `R2_OBJECT_KEY` puis `Casinobabe-v1.0.38.zip` | aucun repli | **ECART** — resolu dans `main` (PR #19, merge `cb47155f`) |
| Nom de fichier servi | toujours `Casinobabe-v1.0.38.zip`, meme si un autre candidat est choisi | `Content-Disposition` = cle exacte de l'objet servi | **ECART** |
| Cle d'artefact unique + `artifact_unavailable` | non | oui (regex `^casinobabe-fishing-\d+\.\d+\.\d+\.zip$`) | resolu dans `main` |
| Ordre de reservation du quota | non verifie dans le bundle deploye | artefact trouve **puis** quota reserve | resolu dans `main` |
| Chemin e-mail `sendDeliveryEmail2` -> `sendEmail2` -> Resend | present | present | aligne |
| Helper `sendDeliveryEmail` (log seul) | present | present (code mort) | **corrige dans cette PR** (supprime) |

Commits de `main` qui expliquent l'ecart (tous anterieurs a la v50 deployee ? **non** — ils sont posterieurs) :

- `1e13b98` / PR #19 (`cb47155f`) — suppression du repli archive + integrite de l'artefact ;
- `e2a9338` (PR #70) — suppression de `handleLanding` et de l'offre multi ;
- `f7f9904` — livraison reprenable et observable ;
- `2a025a4` — renvoi de licence reellement operationnel ;
- `0b8cbef` — un seul recu de livraison par licence.

> Le bundle v50 est donc **anterieur** a ces correctifs : il est structurellement en retard sur `main`, ce que confirment les sondes live. Aucun acces au corps du bundle v50 via l'API Cloudflare n'a ete obtenu (l'endpoint `.../versions/{id}/content` ne renvoie que les metadonnees JSON avec le token OAuth disponible) : l'ecart est donc etabli par **comportement HTTP observe**, pas par lecture du bundle.

## 2. Ce que `main` garantit deja (verifie par test executable)

Ces garanties sont dans `main` **avant** cette PR ; elles sont desormais verrouillees par une suite de non-regression dediee.

| Garantie | Preuve |
|---|---|
| Aucune route marketing legacy sur l'hote API (308 canonique, aucun HTML) | `tests/legacy-landing.test.mjs` + `tests/worker-fulfillment-reconciliation.test.mjs` |
| Une seule lecture d'objet R2, cle unique `R2_OBJECT_KEY` | test source (1 lecture) + runtime |
| Aucun repli sur une archive historique | test source (`Casinobabe-v1.0.38`, `v1.0.38.zip` absents) + runtime (cle historique -> 503, R2 jamais interroge) |
| Artefact absent -> `503 artifact_unavailable`, **quota non consomme** | runtime : `quotaReservations === 0` |
| Quota reserve **apres** avoir trouve l'artefact | runtime : ordre `r2-get` puis `quota-reserve` ; source : ordre des indices |
| Reservation atomique (`count < max_count`) -> `429 limit_reached` sans servir de ZIP | runtime : `changes = 0` -> 429, `Content-Type` JSON |
| `Content-Disposition` = cle exacte de l'objet servi | runtime : `attachment; filename="casinobabe-fishing-1.2.0.zip"` |
| Fournisseur d'e-mail unique (Resend), fail-closed | source + runtime : sans `RESEND_API_KEY`, aucun appel sortant, livraison consignee `pending` pour rejeu |

## 3. Changements de cette PR

1. **`worker/index.js`** — suppression du helper mort `sendDeliveryEmail` (fonction qui ne faisait qu'un `console.log`, **jamais appelee** : les chemins webhook et resend utilisent `sendDeliveryEmail2`). Sa presence laissait croire a un chemin d'envoi fonctionnel ; un futur appel aurait perdu le message du client sans trace. Aucun comportement de production n'est modifie : la fonction n'etait pas appelee.
2. **`tests/worker-fulfillment-reconciliation.test.mjs`** (nouveau) — suite de non-regression : 10 routes legacy (runtime), 15 invariants de source, 5 scenarios runtime de telechargement (artefact absent / present / cle historique invalide / cle absente / quota epuise), 5 assertions sur le fournisseur d'e-mail fail-closed.
3. **`package.json`** — la suite est branchee dans `npm test` et exposee via `npm run test:worker-reconciliation`.
4. **Ce document** (`reports/operations/`).

## 4. Etat du fournisseur d'e-mail (absence a documenter)

- Le code d'envoi existe et est le seul chemin actif : `sendDeliveryEmail2` -> `sendEmail2` -> `POST https://api.resend.com/emails`.
- Le binding `RESEND_API_KEY` (secret) **existe** dans les reglages du Worker deploye (nom lisible, **valeur masquee, jamais lue ni affichee**) ; `MAIL_FROM` est present comme reglage.
- **Absence de fournisseur verifiee :** la validite effective de la cle n'est pas verifiee, et aucun envoi de production n'est confirme. La D1 ne contient aucune ligne de livraison (0 livraison, 0 activation d'apres le dernier audit SELECT-only).
- Le comportement est **fail-closed** : sans cle, `sendEmail2` renvoie `{ sent: false, reason: "aucun secret RESEND_API_KEY configure" }`, la commande reste en base et la livraison est consignee en `pending` pour rejeu. Aucun client n'est toldu qu'un e-mail a ete envoye.
- **Aucun envoi n'a ete active, teste ou declenche par cette mission.** Un test d'envoi reel exige une procedure de test-send explicitement autorisee (absente a ce jour).

## 5. Etat de `RELEASE_STATUS` (secret masque)

- Le binding `RELEASE_STATUS` (`secret_text`) **existe** dans le Worker deploye ; sa valeur est masquee. Elle n'a pas ete lue, devoilee ni devinee.
- Le code lit `env.RELEASE_STATUS` et retombe sur `pending` par defaut ; une valeur `confirmed` en environnement autoriserait `handleCheckout`.
- **`/api/config` n'expose aucun etat de disponibilite** : la reponse live est `{"contactEmail":...,"product":"bot-wow-lifetime","priceEur":20,"currency":"eur","bitcoin":{"enabled":true,"address":null}}` — ni `releaseStatus`, ni `available`, ni `releaseAvailable`.
- Le statut effectif reste donc **inconnu** : le Worker est traite comme **fail-closed** et aucune requete de checkout valide n'a ete tentee (elle aurait pu creer un vrai paiement Mollie).

### Residu signale, hors perimetre de l'issue #99

`/api/config` publie encore `bitcoin: { enabled: true, address: null }`. Le drapeau « enabled » sans adresse contredit l'etat « checkout ferme / Bitcoin non disponible » publie sur le site (P0.54) et rien ne le consomme cote front (`assets/*.js` ne lit pas `config.bitcoin`). **Ce n'est pas modifie dans cette PR** : c'est une decision produit sur un moyen de paiement, hors du perimetre de l'issue #99 et soumise a autorisation explicite. A traiter au prochain cycle.

## 6. Checklist de deploiement (a executer SOUS AUTORISATION EXPLICITE)

Aucune de ces etapes n'a ete executee. Elles sont ordonnees : ne pas passer a l'etape suivante sans l'etape precedente.

1. **Statut de release** — verifier le `RELEASE_STATUS` effectif via un chemin Cloudflare autorise (console / CLI cote operateur) **sans afficher la valeur**. Si le statut ne peut pas etre verifie, le Worker reste fail-closed et le checkout public reste ferme.
2. **Paiement** — valider l'existence d'un profil Mollie dedie BOT-WOW et d'un webhook ciblant `api.bot-wow.com` avant toute ouverture de checkout (le listing ne montre aujourd'hui aucun profil BOT-WOW et un seul webhook actif sur un autre domaine).
3. **Artefact** — lire l'objet R2 configure (`casinobabe-fishing-1.2.0.zip`) via un chemin de lecture autorise et consigner : provenance, version exacte, **SHA-256**, contenu inspecte, compatibilite confirmee. **Ne pas fabriquer d'archive.** Si l'artefact n'est pas verifiable, la livraison reste `503 artifact_unavailable`.
4. **E-mail** — n'implementer/tester un envoi qu'apres existence d'une procedure de test-send explicitement autorisee (envoi de test, destinataire de test, preuve de reception, rejouabilite).
5. **Deploiement** — `wrangler deploy` sur `botwow-api`, puis **verification directe du comportement deploye** : `GET /bot-wow-gold` -> 308, `GET /bot-wow-classic` -> 308, `GET /de/` -> 308, `GET /api/config` -> JSON, `GET /health` -> 200. Un deploiement n'est pas « en production » parce qu'il existe dans une branche.
6. **Rollback** — versions precedent listees via `wrangler versions list --name botwow-api` ; une version stable avec `has_preview` et un tag de commit est preferable a une version « Secret Change ».

## 7. Bloqueurs

- Artefact R2 : provenance, SHA-256, version exacte et compatibilite **non verifies** (aucun chemin de lecture R2 autorise dans cette mission).
- `RELEASE_STATUS` effectif : **inconnu** (valeur masquee) -> fail-closed.
- Validite des credentials (`RESEND_API_KEY`, `MOLLIE_API_KEY`, `MOLLIE_PROFILE_ID`, `MOLLIE_WEBHOOK_SECRET`) : **non verifiee** (noms de bindings presents, valeurs masquees).
- Profil Mollie BOT-WOW et webhook dedie : **absents** des listings read-only.
- Deploiement du Worker : **interdit sans autorisation specifique**.

## 8. Perimetre respecte

- Aucun deploiement Worker, aucun `wrangler secret put`, aucun binding modifie, aucune ecriture D1/R2, aucun e-mail, aucun paiement, aucune creation de checkout, aucune revelation de secret, aucune purge de cache, aucune modification DNS, aucun changement de prix.
- La PR est **separee** de la PR statique Pages (`fix/p0.54-secondary-route-status-copy-20261105`, PR #100) : aucun melange de deploiement.
- Note : `worker/index.js` et `tests/` declenchent le workflow Pages a la fusion sur `main` (`pages.yml` ignore `reports/**` et `AGENTS.md` uniquement) ; l'artefact Pages reste identique (le repertoire `worker/` est exclu de la publication), mais un deploiement Pages sans changement de contenu sera declenche.
