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

if (failures.length) {
  console.error("BOT-WOW validation FAILED");
  for (const f of failures) console.error(" - " + f);
  process.exit(1);
}

console.log("BOT-WOW validation PASS");
console.log("Checked required files, asset references, Pages workflow, frontend secret patterns, and JavaScript syntax.");
