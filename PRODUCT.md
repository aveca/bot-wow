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

### Registre technique et preuve de livraison

- La version `1.2.0` est la version cible mentionnée par le registre ; elle n'est **pas** une release téléchargeable vérifiée.
- `assets/modules.json` contient 8 entrées : `fish` est marqué `available` par le registre interne ; `inventory`, `navigate`, `recovery` sont marqués `development` ; `clients`, `follower`, `grind`, `scripting` sont marqués `planned`.
- Le statut `available` est une étiquette du registre, pas une preuve de disponibilité commerciale. Les chemins référencés par le module pêche (`scripts/fishing_bot.py`, `scripts/fishing_memory.py`, `tests/fishing_bot_test.py`, `tests/run-fishing-harness.mjs`) sont absents de ce dépôt sur `main`.
- Le test de parité facultatif référence `Casinababe/scripts/botwow_modules.py`, chemin externe absent de ce dépôt ; il peut se terminer en `SKIP` si la source Python externe n'est pas configurée. BOT-WOW reste le produit ; cette référence externe n'est pas un second produit.
- Le bucket R2 liste un objet v1.2.0, mais l'API Cloudflare `Get Object` a retourné HTTP 404 / code 10007 le 2026-11-05. Les octets actuels, leur SHA-256 et leur provenance ne sont donc pas revalidés.
- En conséquence, le site et ce document doivent décrire le module comme un statut de registre interne, pas comme un paquet disponible, achetable ou livrable.
## Offer — intended terms, not purchasable

- Prix cible documenté : **20,00 €** (EUR), paiement unique, licence à vie ; ce montant n'est pas une invitation à payer actuellement.
- Le checkout public est **fermé** et le bouton d'achat est désactivé. Aucune vente BOT-WOW ne doit être engagée tant que le paquet et la livraison ne sont pas certifiés.
- Conditions d'entitlement prévues : activation sur 1 machine ; le backend comporte toutefois un défaut de cohérence documenté avec un défaut de configuration à 2 activations. Ne pas promettre cette règle avant résolution.
- Le code contient des chemins d'intégration Mollie et Bitcoin manuel, mais aucun moyen de paiement BOT-WOW n'est actuellement certifié opérationnel. Aucun profil Mollie BOT-WOW dédié n'est disponible ; ne jamais réutiliser un profil d'une autre activité.
- Livraison prévue : e-mail contenant une clé de licence et un lien de téléchargement. La livraison en production n'est pas certifiée ; le dernier relevé D1 du 2026-11-05 montre 0 livraison et 0 activation.
- Compatibilité vérifiée dans la matrice : WoW Classic 1.13 testé ; environnement de serveur tiers utilisé pour des tests techniques uniquement, sans autorisation implicite. TBC, WotLK et Live ne sont pas testés / pas pris en charge ; macOS et Linux ne sont pas pris en charge. Windows 10/11 et Python 3.11+ sont les prérequis publiés.
## Constraints — Honnêteté (non négociable)

Ces éléments sont **des preuves de confiance**, pas des frictions à décorer :

- BOT-WOW automatise le gameplay. L'accord anti-triche de Blizzard interdit les logiciels tiers non autorisés qui permettent le botting ou facilitent le gameplay. Aucune autorisation de Blizzard n'est revendiquée ni documentée ; ne pas utiliser BOT-WOW avec les services exploités par Blizzard.
- La compatibilité technique avec un serveur tiers ne vaut pas autorisation et ne résout pas les restrictions éventuelles d'autres ayants droit ou de la loi.
- La lecture d'écran ne confère aucune autorisation et ne prévient pas les sanctions. Aucune promesse d'indétectabilité, d'anti-ban ou de compte protégé n'est acceptable.
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

## Evidence and current operational state — 2026-11-05

- Le source Worker (`worker/index.js`) contient une validation serveur du montant, de la devise et du produit, ainsi qu'un traitement webhook Mollie. Cela ne prouve pas que la configuration de production soit opérationnelle.
- Le Worker de production `botwow-api` est toujours sur la version 50 (déploiement du 2026-10-27) ; le `main` actuel contient des correctifs qui ne sont pas dans ce runtime. Aucun déploiement Worker n'a été effectué pendant cette revalidation.
- L'API Mollie retourne un profil non lié à BOT-WOW ; aucun profil dédié BOT-WOW n'est visible. La PR #90 reste en draft et n'ouvre pas le checkout.
- D1 production, lecture seule le 2026-11-05 : 5 commandes Bitcoin marquées `paid` utilisent des adresses `example.com` (données de test), 8 commandes `pending_payment`, 1 `rejected`, 11 Mollie `failed` ; 5 licences, 5 jetons de téléchargement, 0 livraison, 0 activation, 16 événements webhook et 12 enregistrements email dont 0 confirmé. Aucune de ces lignes ne prouve une vente commerciale.
- Analytics D1, événements `test=0` : 1 726 `page_view`, 680 `journey_view`, 48 `cta_click`, 29 `checkout_requested`, 4 `checkout_start`, 6 `checkout_created`, 6 `checkout_failed` ; aucun événement de paiement confirmé, conversion, livraison ou activation.
- Les requêtes D1 étaient en lecture seule : `changed_db=false`, `rows_written=0`.
- Le site doit conserver le checkout fermé jusqu'à preuve du paquet lisible, de sa provenance reproductible, du profil de paiement indépendant et de la livraison de bout en bout.