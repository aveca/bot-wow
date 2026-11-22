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
  "assets/og-image.png",
  "robots.txt",
  "sitemap.xml",
  ".github/workflows/pages.yml"
];

const failures = [];
for (const file of required) {
  if (!fs.existsSync(path.join(root, file))) failures.push(`missing: ${file}`);
}

const index = fs.readFileSync(path.join(root, "index.html"), "utf8");
const app = fs.readFileSync(path.join(root, "assets/app.js"), "utf8");
const workflow = fs.readFileSync(path.join(root, ".github/workflows/pages.yml"), "utf8");
const sitemap = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");

for (const asset of ["./assets/style.css", "./assets/app.js"]) {
  if (!index.includes(asset)) failures.push(`index missing asset reference: ${asset}`);
}

const ogImageUrl = "https://bot-wow.com/assets/og-image.png";
if (!index.includes(`<meta property="og:image" content="${ogImageUrl}">`)) {
  failures.push("Open Graph image URL missing or incorrect");
}
if (!index.includes(`<meta name="twitter:image" content="${ogImageUrl}">`)) {
  failures.push("Twitter image URL missing or incorrect");
}
if (!index.includes('<meta property="og:image:width" content="1200">')
  || !index.includes('<meta property="og:image:height" content="630">')) {
  failures.push("Open Graph image dimensions missing");
}

const imagePath = path.join(root, "assets/og-image.png");
if (fs.existsSync(imagePath)) {
  const image = fs.readFileSync(imagePath);
  const pngSignature = "89504e470d0a1a0a";
  if (image.subarray(0, 8).toString("hex") !== pngSignature) {
    failures.push("Open Graph asset is not a valid PNG");
  } else if (image.readUInt32BE(16) !== 1200 || image.readUInt32BE(20) !== 630) {
    failures.push("Open Graph PNG must be 1200x630");
  }
}

if (!/<loc>https:\/\/bot-wow\.com\/<\/loc>/.test(sitemap)) {
  failures.push("sitemap must include the canonical homepage");
}
if (/<loc>[^<]*\/404\.html<\/loc>/i.test(sitemap)) {
  failures.push("sitemap must not include the 404 page");
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
console.log("Checked required files, social image metadata and PNG dimensions, canonical sitemap, Pages workflow, frontend secret patterns, and JavaScript syntax.");
