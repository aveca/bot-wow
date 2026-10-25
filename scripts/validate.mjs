import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const required = [
  "index.html",
  "404.html",
  ".nojekyll",
  "assets/style.css",
  "assets/app.js",
  ".github/workflows/pages.yml"
];

const failures = [];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing: ${file}`);
}

const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "assets/app.js"), "utf8");
const workflow = fs.readFileSync(path.join(root, ".github/workflows/pages.yml"), "utf8");

for (const asset of ["./assets/style.css", "./assets/app.js"]) {
  if (!index.includes(asset)) failures.push(`index missing asset reference: ${asset}`);
}

if (!workflow.includes("actions/deploy-pages@v4")) failures.push("Pages deploy action missing");
if (!workflow.includes("actions/upload-pages-artifact@v3")) failures.push("Pages artifact action missing");
if (/sk-[A-Za-z0-9_-]{20,}|ghp_[A-Za-z0-9]{20,}|password\\s*[:=]/i.test(index + app)) {
  failures.push("possible secret/credential pattern detected in frontend");
}

const syntax = spawnSync(process.execPath, ["--check", "assets/app.js"], { encoding: "utf8" });
if (syntax.status !== 0) failures.push("assets/app.js syntax check failed");

// --- Demonstration de peche (chantier B) ---------------------------------
for (const file of ["demo.html", "assets/demo.js", "assets/route-planner.js", "assets/demo-map.json"]) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing: ${file}`);
}
if (fs.existsSync(path.join(root, "demo.html"))) {
  const demo = fs.readFileSync(path.join(root, "demo.html"), "utf8");
  // La demonstration doit dependre de la carte simulee, jamais d'une session WoW.
  if (!demo.includes("./assets/demo.js")) failures.push("demo.html missing assets/demo.js");
  if (!/simul/i.test(demo)) failures.push("demo.html must state that the data is simulated");
  for (const asset of ["./assets/demo.js", "./assets/style.css"]) {
    if (!demo.includes(asset)) failures.push(`demo.html missing asset reference: ${asset}`);
  }
}
if (fs.existsSync(path.join(root, "assets/demo-map.json"))) {
  const map = JSON.parse(fs.readFileSync(path.join(root, "assets/demo-map.json"), "utf8"));
  if (map.simulated !== true) failures.push("assets/demo-map.json must be flagged as simulated");
  if (!Array.isArray(map.spots) || !map.spots.length) failures.push("assets/demo-map.json has no spot");
  // Le contrat de la carte : sans 'observations', le consommateur ne peut pas
  // distinguer un banc confirme d'un candidat.
  if (!map.spots.every((s) => typeof s.observations === "number")) {
    failures.push("assets/demo-map.json spots must carry 'observations'");
  }
}
for (const file of ["assets/demo.js", "assets/route-planner.js", "scripts/build-package.cjs", "assets/app.js"]) {
  const s = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (s.status !== 0) failures.push(`${file} syntax check failed`);
}

// --- Site public : pages liees, aucune page morte -------------------------
const PUBLIC_PAGES = [
  "index.html", "demo.html", "success.html", "cancel.html", "404.html",
  "features.html", "fishing.html", "getting-started.html",
  "compatibility.html", "roadmap.html", "faq.html",
  "modules.html", "compare.html",
  "docs/index.html", "docs/install.html", "docs/changelog.html",
  "docs/known-issues.html", "docs/license.html",
  "docs/fr/index.html", "docs/fr/install.html", "docs/fr/changelog.html",
  "docs/fr/known-issues.html", "docs/fr/license.html",
  "legal/terms.html", "legal/privacy.html", "legal/refund.html",
  "legal/fr/terms.html", "legal/fr/privacy.html", "legal/fr/refund.html",
  "fr/index.html", "fr/demo.html", "fr/success.html", "fr/cancel.html",
  "fr/404.html", "fr/features.html", "fr/fishing.html",
  "fr/getting-started.html", "fr/compatibility.html", "fr/roadmap.html",
  "fr/faq.html", "fr/modules.html",
  "fr/compare.html",
  "assets/favicon.svg", "robots.txt", "sitemap.xml",
];
for (const file of PUBLIC_PAGES) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing page: ${file}`);
}

// --- Registre des modules (source des statuts affichés) -------------------
if (fs.existsSync(path.join(root, "assets/modules.json"))) {
  const rec = JSON.parse(fs.readFileSync(path.join(root, "assets/modules.json"), "utf8"));
  const legal = new Set(["available", "development", "planned"]);
  if (!Array.isArray(rec.modules) || rec.modules.length === 0) {
    failures.push("assets/modules.json: aucun module");
  } else {
    const bad = rec.modules.filter((m) => !legal.has(m.status));
    if (bad.length) failures.push("assets/modules.json: statut illégal pour " + bad.map((m) => m.id).join(","));
    const ids = rec.modules.map((m) => m.id);
    if (new Set(ids).size !== ids.length) failures.push("assets/modules.json: ids dupliqués");
    // honnêteté : un module "planned" ne revendique rien de livré
    for (const m of rec.modules) {
      if (m.status === "planned" && ((m.shipped && m.shipped.en.length) || (m.shipped && m.shipped.fr.length))) {
        failures.push(`assets/modules.json: "${m.id}" est planned mais revendique du contenu livré`);
      }
      if (m.status === "available" && (!m.tests || !m.tests.length)) {
        failures.push(`assets/modules.json: "${m.id}" est available sans suite de tests`);
      }
    }
    // cohérence de version avec version.txt
    if (fs.existsSync(path.join(root, "version.txt"))) {
      const v = fs.readFileSync(path.join(root, "version.txt"), "utf8").trim();
      if (rec.version !== v) failures.push(`assets/modules.json: version ${rec.version} ≠ version.txt ${v}`);
    }
  }
  // la page modules doit être bilingue et référencer le registre
  for (const p of ["modules.html", "fr/modules.html"]) {
    if (fs.existsSync(path.join(root, p))) {
      const t = fs.readFileSync(path.join(root, p), "utf8");
      if (!t.includes("modules.json")) failures.push(`${p} doit citer la source modules.json`);
      if (!/st-(ok|dev|plan)/.test(t)) failures.push(`${p} doit afficher les pilules de statut`);
    }
  }
} else {
  failures.push("missing: assets/modules.json (registre des modules)");
}

// sitemap : les pages modules doivent y figurer
if (fs.existsSync(path.join(root, "sitemap.xml"))) {
  const sm = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
  for (const u of ["modules.html", "fr/modules.html"]) {
    if (!sm.includes(u)) failures.push(`sitemap.xml : URL manquante ${u}`);
  }
}

// Chaque lien interne de la page d'accueil doit pointer vers un fichier
// existant (une page morte est un obstacle a l'achat).
const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
const hrefs = [...home.matchAll(/href="([^"#][^"]*)"/g)].map((m) => m[1]);
for (const href of new Set(hrefs)) {
  if (/^(https?:|mailto:)/.test(href)) continue;
  const target = href.split("#")[0].split("?")[0].replace(/^\.\//, "");
  if (!target) continue;
  if (!fs.existsSync(path.join(root, target))) {
    failures.push(`lien interne mort dans index.html : ${href}`);
  }
}

// Aucune promesse non verifiee ne doit figurer dans les sections COMMERCIALES
// (hero, avantages, offre). Les sections de documentation et d'avertissement
// peuvent au contraire mentionner ces notions pour les mettre en sourdine.
const commercial = [
  home.slice(home.indexOf('<section class="hero">'), home.indexOf('<!-- ===') >= 0 ? home.indexOf('<!-- ===') : home.length),
  (home.split('id="offre"')[1] || '').split('</section>')[0],
].join('\n');
const forbidden = [/\bzero ban\b/i, /\bzéro ban\b/i, /24\/7/i, /garanti/i,
  /sans risque/i, /\bBG\b/, /Retail/i, /tous les niveaux/i, /\+\+ *joueurs/i,
  /zéro risque/i];
for (const re of forbidden) {
  if (re.test(commercial)) failures.push(`section commerciale : promesse a ne pas prouver : ${re}`);
}
// Le prix annonce doit correspondre a celui du serveur (20 EUR).
if (!home.includes("20,00 €")) failures.push("index.html : le prix de l'offre doit etre affiche (20,00 EUR)");

// --- Migrations D1 : le schema doit etre reproductible --------------------
// FIX 2026-10-23 : les migrations sont separees par base de donnees.
//   migrations/production : metier et paiement (botwow-production)
//   migrations/analytics  : telemetrie uniquement (botwow-analytics)
// Melanger les deux dans un meme repertoire faisait proposer a wrangler
// l'application des migrations metier sur la base de telemetrie.
const PROD_MIGRATIONS = [
  "migrations/production/0001_botwow_emails.sql",
  "migrations/production/0002_botwow_licenses.sql",
  "migrations/production/0003_botwow_payment_integrity.sql",
  "migrations/production/0004_reconcile_order_ids.sql",
];
for (const file of PROD_MIGRATIONS) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing: ${file}`);
}
if (fs.existsSync(path.join(root, "migrations/production/0002_botwow_licenses.sql"))) {
  const mig = fs.readFileSync(path.join(root, "migrations/production/0002_botwow_licenses.sql"), "utf8");

  for (const t of ["orders", "licenses", "activations", "downloads", "webhook_events", "mollie_customers"]) {
    if (!new RegExp(`CREATE TABLE IF NOT EXISTS ${t}\\b`, "i").test(mig)) {
      failures.push(`migration 0002 missing table: ${t}`);
    }
  }
}

// --- Separation des migrations par base ---------------------------------
// La base de telemetrie ne doit JAMAIS recevoir de table de paiement.
const ANALYTICS_TABLES = ["events", "rl"];
const FORBIDDEN_IN_ANALYTICS = ["orders", "licenses", "activations", "downloads", "webhook_events", "mollie_customers", "deliveries", "admin_sessions", "botwow_emails"];
const analyticsDir = path.join(root, "migrations", "analytics");
if (!fs.existsSync(analyticsDir)) {
  failures.push("missing: migrations/analytics (migrations de telemetrie)");
} else {
  const analyticsFiles = fs.readdirSync(analyticsDir).filter((f) => f.endsWith(".sql"));
  if (analyticsFiles.length === 0) failures.push("migrations/analytics est vide");
  for (const f of analyticsFiles) {
    const content = fs.readFileSync(path.join(analyticsDir, f), "utf8");
    for (const t of FORBIDDEN_IN_ANALYTICS) {
      if (new RegExp(`CREATE TABLE(\\s+IF NOT EXISTS)?\\s+${t}\\b`, "i").test(content)) {
        failures.push(`migrations/analytics/${f} : table de paiement interdite (${t})`);
      }
    }
  }
  // Aucune table de paiement n'a ete trouvee (verification faite juste au
  // dessus). On passe a la verification d'ensemble des tables de telemetrie.
  // Les tables de telemetrie sont reparties sur PLUSIEURS fichiers
  // (0001 events, 0002 rl) : on verifie leur presence dans l'ENSEMBLE.
  const analyticsAll = analyticsFiles
    .map((f) => fs.readFileSync(path.join(analyticsDir, f), "utf8"))
    .join("\n");
  for (const t of ANALYTICS_TABLES) {
    if (!new RegExp(`CREATE TABLE(\\s+IF NOT EXISTS)?\\s+${t}\\b`, "i").test(analyticsAll)) {
      failures.push(`migrations/analytics : table de telemetrie attendue manquante (${t})`);
    }
  }
}
// Chaque base doit declarer son propre migrations_dir dans wrangler.toml.
if (fs.existsSync(path.join(root, "wrangler.toml"))) {
  const cfg = fs.readFileSync(path.join(root, "wrangler.toml"), "utf8");
  const m = cfg.match(/\[\[d1_databases\]\][\s\S]*?migrations_dir\s*=\s*"([^"]+)"/g) || [];
  if (m.length < 2) failures.push("wrangler.toml : chaque base D1 doit declarer migrations_dir");
  if (!cfg.includes("migrations/production")) failures.push("wrangler.toml : migrations_dir production manquant");
  if (!cfg.includes("migrations/analytics")) failures.push("wrangler.toml : migrations_dir analytics manquant");
}

if (failures.length) {
  console.error("BOT-WOW validation FAILED");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
}

console.log("BOT-WOW validation PASS");
console.log("Checked required files, asset references, Pages workflow, frontend secret patterns, JavaScript syntax, "
  + "the fishing demo (simulated map + contract), the distribution scripts and the D1 migrations.");
