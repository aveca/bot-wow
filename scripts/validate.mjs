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
  "docs/index.html", "docs/install.html", "docs/changelog.html",
  "docs/known-issues.html", "docs/license.html",
  "docs/fr/index.html", "docs/fr/install.html", "docs/fr/changelog.html",
  "docs/fr/known-issues.html", "docs/fr/license.html",
  "legal/terms.html", "legal/privacy.html", "legal/refund.html",
  "legal/fr/terms.html", "legal/fr/privacy.html", "legal/fr/refund.html",
  "fr/index.html", "fr/demo.html", "fr/success.html", "fr/cancel.html",
  "fr/404.html", "fr/features.html", "fr/fishing.html",
  "fr/getting-started.html", "fr/compatibility.html", "fr/roadmap.html",
  "fr/faq.html",
  "assets/favicon.svg", "robots.txt", "sitemap.xml",
];
for (const file of PUBLIC_PAGES) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing page: ${file}`);
}

// Chaque lien interne de la page d'accueil doit pointer vers un fichier
// existant (une page morte est un obstacle a l'achat).
const home = fs.readFileSync(path.join(root, "index.html"), "utf8");
const hrefs = [...home.matchAll(/href="([^"#][^"]*)"/g)].map((m) => m[1]);
for (const href of new Set(hrefs)) {
  if (/^(https?:|mailto:)/.test(href)) continue;
  const target = href.split("#")[0].replace(/^\.\//, "");
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
for (const file of ["migrations/0001_botwow_emails.sql", "migrations/0002_botwow_licenses.sql"]) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing: ${file}`);
}
if (fs.existsSync(path.join(root, "migrations/0002_botwow_licenses.sql"))) {
  const mig = fs.readFileSync(path.join(root, "migrations/0002_botwow_licenses.sql"), "utf8");
  for (const t of ["orders", "licenses", "activations", "downloads", "webhook_events", "mollie_customers"]) {
    if (!new RegExp(`CREATE TABLE IF NOT EXISTS ${t}\\b`, "i").test(mig)) {
      failures.push(`migration 0002 missing table: ${t}`);
    }
  }
}

if (failures.length) {
  console.error("BOT-WOW validation FAILED");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
}

console.log("BOT-WOW validation PASS");
console.log("Checked required files, asset references, Pages workflow, frontend secret patterns, JavaScript syntax, "
  + "the fishing demo (simulated map + contract), the distribution scripts and the D1 migrations.");
