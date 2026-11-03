# BOT-WOW — Moteur de revenu v1 : preuve de livraison + mesure de l'entonnoir (2026-11-03)

**Mission :** moteur de croissance/CRO/SEO/revenu. Priorité n°1 = *prouver que la livraison fonctionne* (le client reçoit réellement le produit payé) **sans paiement réel**. Si la livraison n'est pas garantie → checkout maintenu verrouillé + rapport de correction/validation préparé.
**État Git de départ (confirmé) :** `origin/main` = `2edd74b`. Branche de travail dédiée : `growth/revenue-engine-v1` (base `2edd74b`).

Légende : **[V]** = directement vérifié (outil/lien) · **[R]** = rapporté par une mission antérieure (lien rapport) · **[NV]** = non vérifié.

---

## 1. Priorité n°1 — la livraison de bout en bout n'est PAS garantie

| Étape du parcours | Résultat | Statut |
|---|---|---|
| Paiement Mollie → commande enregistrée (serveur) | amount/currency lus côté serveur, idempotence webhook, gestion remboursement/chargeback, BTC | **[V]** `node tests/payment-flow.test.mjs` PASS |
| Commande payée → licence créée | licence créée même si l'e-mail échoue | **[V]** `npm test` (payment-flow + migrations) |
| Commande payée → **e-mail de livraison** envoyé | **ÉCHOUE sans `RESEND_API_KEY` valide** | **[V]** log de test `[EMAIL] Envoi impossible (aucun secret RESEND_API_KEY configure) - livraison consignee en base pour rejeu` |
| Commandes payées réelles en production → **e-mails livrés** | `deliveries=0` pour 5 commandes payées (5 licences, 0 livraison) | **[R]** rapport P0.22 / [PR #65](https://github.com/aveca/bot-wow/pull/65) |
| Client payant reçoit-il le produit ? | **NON GARANTI.** Un client payé en production n'obtient pas son archive par e-mail. | conclusion |

**Conclusion livraison :** RIEN NE PROUVE, en production, qu'un client payant reçoive son produit. Le chemin code (paiement→licence) fonctionne ; le **pas e-mail échoue** et le téléchargement direct comporte des défauts. Conformément à la consigne, **le checkout reste verrouillé** et **aucune promesse de disponibilité n'est faite**.

---

## 2. Bloqueurs exacts de la livraison (à lever, autorisation requise)

### B1 — E-mail transactionnel non validé en production
- Le Worker journalise la livraison en base « pour rejeu » quand l'envoi échoue ; en production `RESEND_API_KEY` n'est pas opérationnel → `deliveries=0`.
- **[R]** `wrangler.toml` porte encore un commentaire périmé annonçant `RESEND_API_KEY` « ABSENT ».
- Action nécessaire : valider un `RESEND_API_KEY` fonctionnel + déclencher le rejeu des livraisons consignées. **Hors périmètre sans autorisation explicite.**

### B2 — Défauts du Worker de téléchargement (`worker/index.js`, `handleDownload`, `main`)
**[V]** vérifié cette session, lignes 2310–2340 :
1. Repli **silencieux** vers l'archive historique : `R2_OBJECT_KEY` → `casinobabe-fishing-1.2.0.zip` → `Casinobabe-v1.0.38.zip`. Si les deux premiers objets manquent, un paquet **périmé** peut être servi comme « version courante ».
2. `Content-Disposition` **codé en dur** sur `Casinobabe-v1.0.38.zip` quel que soit l'objet réellement livré (mauvais nom de fichier).
3. `404 file_not_found` indistingable d'un `503 artifact_unavailable` (artefact manquant = défaut serveur, pas ressource trouvée).
4. Aucune porte côté serveur `RELEASE_STATUS`/`delivery_unverified` avant téléchargement.

**Correction déjà préparée : [PR #19](https://github.com/aveca/bot-wow/pull/19)** (« never deliver a stale R2 package as the current release »). Conformément à AGENTS #7, elle **n'est pas dupliquée** ici.

### B3 — Aucune porte serveur « livraison vérifiée »
Le Worker de paiement ne conditionne pas le checkout à un état de livraison/annonce vérifié. À ajouter (lié à B1+B2), **décision d'autorisation séparée**.

---

## 3. Écarts de mesure de l'entonnoir fermés (cette livraison)

Schéma de l'entonnoir de la mission : `landing_view, demo_open, demo_interaction, compatibility_view, buy_intent, buy_click, checkout_started, payment_confirmed, delivery_success, refund`.
- `payment_confirmed`, `delivery_success`, `refund` : mesurés **côté serveur** (Worker de paiement/D1) — hors de cette PR.
- `demo_interaction` et `compatibility_view` : **non mesurés côté client** avant cette PR. → comblés.

**Changements (branche `growth/revenue-engine-v1`, commit `e0dd64a`, [PR #67](https://github.com/aveca/bot-wow/pull/67)) :**
- `assets/analytics.js` : émet `compatibility_view` (pages compat EN/FR) et `demo_interaction` (choix réel du mode du planificateur). `planner_mode` conservé comme signal détaillé.
- `telemetry-worker/index.js` : `compatibility_view` + `demo_interaction` ajoutés à la liste d'autorisation `EVENT_SPEC` (parité client/serveur).
- `tests/telemetry.test.mjs` (§9) : parité client↔serveur.
- `tests/funnel-events.test.mjs` (nouveau) : vérifie les émissions **réelles** en vm ; la home n'émet ni `demo_open` ni `compatibility_view`.
- `package.json` : `funnel-events.test.mjs` intégré à la chaîne de tests.
- **Aucun compteur inventé** : chaque événement = une action réelle. Aucun chiffre d'audience/vente/avis n'est fabriqué.

**Limite de mesure :** `compatibility_view`/`demo_interaction` ne sont **stockés** côté serveur qu'après un **déploiement du Worker de télémetrie** (déploiement séparé). En l'état, ce worker déployé ignore ces événements (aucune casse, aucune perte des événements existants). Déploiement = **autorisation requise**.

---

## 4. Fuites commerciales / honnêteté (état vérifié)

**[R]** par audits P0–P0.22 + **[V]** lectures ciblées cette session : le site est honnête.
- Aucun faux chiffre de joueurs/ventes/avis.
- Allégations « anti-détection » explicitement **démenties** (features/modules/roadmap).
- Produit cadré honnêtement sur WoW Classic 1.13 (Retail/Mac « non testé »).
- Pages d'achat EN/FR **verrouillées** (bouton désactivé, `.checkout-blocked`, message de disponibilité). Aucun paiement activé.
- **Aucun nouveau défaut d'honnêteté trouvé.**

---

## 5. Actions autorisées-requises pour rétablir la vente (SÉQUENCÉES, hors mission autonome)

1. Valider/déployer `RESEND_API_KEY` (B1) + rejouer les livraisons consignées.
2. Merger **[PR #19](https://github.com/aveca/bot-wow/pull/19)** (B2) puis déployer le Worker `botwow-api`, rollback vérifiable.
3. Ajouter la porte serveur `RELEASE_STATUS`/`delivery_unverified` (B3).
4. **Prouver** la livraison de bout en bout (e-mail réel reçu + téléchargement OK + nom de fichier correct) avant de lever le verrou commercial.
5. Autoriser le déploiement du **Worker de télémetrie** pour activer la mesure des nouveaux événements.
6. Décision distincte : merger [PR #67](https://github.com/aveca/bot-wow/pull/67) et Pages.

**Aucune de ces étapes n'est franchie ici.** Chacune exige une autorisation explicite.

---

## 6. Conformité

Aucun déploiement Worker/Pages · aucune mutation R2 · aucune modification de secret · aucun paiement/e-mail réel · aucun changement au checkout, prix ou clés de licence · `ADMIN_PASSWORD` non recréé (binding observé `ADMIN_PASSWORD_HASH`). Succès CI ≠ artefact/production correct : rien n'est affirmé « en production ».

---

## 7. Données absentes (DATA ABSENTE)

- Conversions réelles issues de la nouvelle télémétrie live : **DATA ABSENTE** (worker de télémétrie non déployé avec les nouveaux événements).
- Taux de délivrabilité e-mail en production : **DATA ABSENTE** (`deliveries=0` rapporté P0.22 ; aucune métrique de rejeu mesurée).
- Téléchargements directs et noms de fichiers réellement servis en production : **DATA ABSENTE** (non mesurés).
