# PRODUCT.md — BOT-WOW

> Contexte produit capturé par `/impeccable init`. Contient **uniquement des
> faits confirmés** par le dépôt et les documents existants. Aucune invention.

## Platform

`web`.

Site **statique** (HTML/CSS/JS vanilla, sans framework ni bundler applicatif),
publié sur GitHub Pages / Cloudflare Pages (`bot-wow.com`), plus un Worker
Cloudflare séparé (`api.bot-wow.com`) pour le paiement, les licences et la
télémétrie. Aucun lockfile npm applicatif : les dépendances npm sont
uniquement des outils de test/dev.

## Stack

- HTML / CSS / JS vanilla, modules ES, aucun framework.
- CSS en fichiers séparés (`assets/*.css`), variables CSS de thème.
- Build : `node scripts/build-site.mjs _site` (copie + stamp des assets).
- Tests : scripts Node maison (`npm test`), `node --experimental-sqlite`
  pour les suites SQLite.
- Publication : GitHub Pages via `.github/workflows/pages.yml` sur push
  `main` ; Worker Cloudflare séparé (`wrangler deploy`, non automatisé ici).
- Langues publiées : **EN** (défaut) et **FR** (sous `/fr/`).

## Product

BOT-WOW est un **bot de pêche pour World of Warcraft Classic** qui fonctionne
par **lecture d'écran (pixel)** — aucune injection ni lecture mémoire.

### Ce que le produit fait

- Détecte le flotteur et l'ombre à l'écran, mémorise les spots de pêche
  productifs, enchaîne des rondes optimisées entre plusieurs spots.
- Livré avec un **addon** (`Casinobae Addon`) et un **manifeste SHA-256** par
  fichier.
- Carte de spots **versionnée, exportable/importable** (JSON), dédupliquée.
- Modes de ronde : `prudent`, `equilibre`, `exploration` (ce dernier signale
  explicitement les segments non mesurés).
- Démonstration navigateur réelle : carte SVG interactive, données
  explicitement marquées **simulées**.

### Version et modules (état réel)

- Version du produit : **1.2.0**.
- Registre `assets/modules.json` : 8 modules —
  `fish` **available** ; `inventory`, `navigate`, `recovery` **development** ;
  `clients`, `follower`, `grind`, `scripting` **planned**.
- La page `/modules.html` présente ce registre comme « honest module
  ledger » : ce qui est livré, en développement, planifié. **Cette honnêteté
  est un élément de confiance central, à préserver.**

## Users

**Public principal :** joueur de WoW Classic qui veut comprendre exactement ce
qu'il achète avant de payer — ce que fait le bot, ce qui est livré, dans
quelles conditions, et comment l'essayer.

**Situation d'usage :** arrive sur le site depuis une recherche ou une
communauté, puis veut (1) voir le produit fonctionner, (2) vérifier ce qui est
inclus et ce qui ne l'est pas, (3) comprendre le prix et la livraison,
(4) obtenir le produit.

**Contrainte de confiance centrale :** ce public est sceptique.

## Offer

- **Prix : 20,00 €** (EUR), paiement unique, licence à vie. Aucun abonnement,
  aucun module caché.
- Mises à jour de la branche 1.x incluses.
- **Activation : 1 machine**, relance de licence sur demande.
- Rails de paiement : **Mollie** (carte) — montant et devise **fixés côté
  serveur** — et **Bitcoin manuel** (validation administrateur).
- Livraison : e-mail contenant la clé de licence et le lien de téléchargement.
- Compatibilité annoncée : WoW Retail (The War Within), Classic Era, Season of
  Discovery, et la majorité des serveurs privés. **Windows 10 / 11,
  Python 3.11+.**

## Constraints — Honnêteté (non négociable)

Ces éléments sont **des preuves de confiance**, pas des frictions à décorer :

- **L'automatisation enfreint les CGU de Blizzard** et peut entraîner une
  suspension ou un bannissement. Aucun outil ne peut l'empêcher. Cet
  avertissement doit rester **visible et clair**.
- La lecture pixel « réduit l'empreinte technique mais ne garantit rien ».
- Pas de remboursement automatique sur le rail Bitcoin ; chaque cas est examiné.
- Les modules `planned` ne sont pas livrés et ne doivent pas être présentés
  comme disponibles.
- **Interdiction absolue de fabriquer** : avis clients, nombres d'utilisateurs,
  compteurs, preuve sociale, benchmarks non sourcés, résultats mesurés non
  fournis par le produit.

## Assets réels disponibles

- Une **vraie capture** du produit : `assets/evidence/fishing-real-capture.jpg`
  (+ `.webp`), légendée « Lushwater Oasis · 76 KB · instrumented session ».
- Carte de démonstration : `assets/demo-map.json` (données simulées).
- Aucune photo de personne, aucun logo partenaire, aucun visuel fournisseur.

## Evidence

- Le Worker (`worker/index.js`) valide le montant, la devise et le produit
  côté serveur avant de créer le paiement ; il relit l'état réel du paiement
  via l'API Mollie dans le webhook.
- Idempotence du webhook portée par l'index UNIQUE sur `webhook_events(id)`.
