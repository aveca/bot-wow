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

BOT-WOW est décrit publiquement comme un outil d'automatisation de pêche pour WoW Classic 1.13, fondé sur la lecture d'écran et des messages de fenêtre. Les sources runtime référencées par le registre ne sont pas présentes dans ce dépôt sur `main` ; le fonctionnement complet n'est donc pas reproductible indépendamment depuis ce dépôt.

### Ce que le registre et les pages décrivent — non revalidé comme paquet livrable

- Détection du flotteur, mémoire de spots, planification de rondes, mode arrière-plan et arrêt F9 sont des capacités rapportées par le registre interne, pas des fonctionnalités actuellement certifiées dans un paquet téléchargeable.
- Un add-on runtime apparaît dans l'historique technique sous le nom `Casinababe Addon`. C'est une référence de composant, pas un produit distinct ; sa présence dans l'archive v1.2.0 actuelle n'est pas vérifiée.
- Le manifeste SHA-256 est décrit dans la documentation, mais l'archive actuelle n'est pas lisible via l'API R2 testée et ses octets n'ont pas été revalidés.
- La démo navigateur est une carte SVG interactive avec des données explicitement simulées ; elle ne prouve pas le fonctionnement du runtime.

### Registre technique et preuve de livraison

- La version `1.2.0` est la version cible mentionnée par le registre ; elle n'est **pas** une release téléchargeable vérifiée.
- `assets/modules.json` contient 8 entrées : `fish` est marqué `available` par le registre interne ; `inventory`, `navigate`, `recovery` sont marqués `development` ; `clients`, `follower`, `grind`, `scripting` sont marqués `planned`.
- Le statut `available` est une étiquette du registre, pas une preuve de disponibilité commerciale. Les chemins référencés par le module pêche (`scripts/fishing_bot.py`, `scripts/fishing_memory.py`, `tests/fishing_bot_test.py`, `tests/run-fishing-harness.mjs`) sont absents de ce dépôt sur `main`.
- Le test de parité facultatif référence `Casinababe/scripts/botwow_modules.py`, chemin externe absent de ce dépôt ; il peut se terminer en `SKIP` si la source Python externe n'est pas configurée. BOT-WOW reste le produit ; cette référence externe n'est pas un second produit.
- Le bucket R2 liste un objet v1.2.0, mais l'API Cloudflare `Get Object` a retourné HTTP 404 / code 10007 le 2026-11-05. Les octets actuels, leur SHA-256 et leur provenance ne sont donc pas revalidés.
- En conséquence, le site et ce document doivent décrire le module comme un statut de registre interne, pas comme un paquet disponible, achetable ou livrable.

## Users — hypothèse de cible, non validée commercialement

Le profil historiquement visé est un utilisateur de WoW Classic 1.13 qui cherche un assistant de pêche. Cette cible n'est pas validée par des ventes et ne doit pas être activement sollicitée tant que le périmètre contractuel autorisé n'est pas établi.

## Offer — intended terms, not purchasable

- Prix cible documenté : **20,00 €** (EUR), paiement unique, licence à vie ; ce montant n'est pas une invitation à payer actuellement.
- Le checkout public est **fermé** et le bouton d'achat est désactivé. Aucune vente BOT-WOW ne doit être engagée tant que le paquet et la livraison ne sont pas certifiés.
- Conditions d'entitlement prévues : activation sur 1 machine ; le backend comporte toutefois un défaut de cohérence documenté avec un défaut de configuration à 2 activations. Ne pas promettre cette règle avant résolution.
- Le code contient des chemins d'intégration Mollie et Bitcoin manuel, mais aucun moyen de paiement BOT-WOW n'est actuellement certifié opérationnel. Aucun profil Mollie BOT-WOW dédié n'est disponible ; ne jamais réutiliser un profil d'une autre activité.
- Livraison prévue : e-mail contenant une clé de licence et un lien de téléchargement. La livraison en production n'est pas certifiée ; le dernier relevé D1 du 2026-11-05 montre 0 livraison et 0 activation.
- Compatibilité vérifiée dans la matrice : WoW Classic 1.13 testé ; environnement de serveur tiers utilisé pour des tests techniques uniquement, sans autorisation implicite. TBC, WotLK et Live ne sont pas testés / pas pris en charge ; macOS et Linux ne sont pas pris en charge. Windows 10/11 et Python 3.11+ sont les prérequis publiés.

## Constraints — Honnêteté et règles de plateforme (non négociable)

- BOT-WOW automatise le gameplay. L'accord anti-triche de Blizzard interdit les logiciels tiers non autorisés qui permettent le botting ou facilitent le gameplay. Aucune autorisation de Blizzard n'est revendiquée ni documentée ; ne pas utiliser BOT-WOW avec les services exploités par Blizzard.
- La compatibilité technique avec un serveur tiers ne vaut pas autorisation et ne résout pas les restrictions éventuelles d'autres ayants droit ou de la loi.
- La lecture d'écran ne confère aucune autorisation et ne prévient pas les sanctions. Aucune promesse d'indétectabilité, d'anti-ban ou de compte protégé n'est acceptable.
- Les modules `planned` ne sont pas livrés et ne doivent pas être présentés comme disponibles.
- Ne jamais fabriquer des avis clients, nombres d'utilisateurs, compteurs, preuves sociales, benchmarks ou résultats mesurés non sourcés.
- Ne pas ouvrir le checkout, créer des paiements, envoyer des emails ou lancer de campagnes tant que la disponibilité du paquet, l'autorisation commerciale et la livraison ne sont pas établies.


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
