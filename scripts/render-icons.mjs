/* render-icons.mjs — rend les PNG de la PWA depuis icons/icon.svg.
 *
 * POURQUOI : le manifeste et l'installabilite iOS exigent des PNG reels
 * (Safari ignore les icones SVG pour apple-touch-icon, et Chrome exige
 * 192 px et 512 px). Plutot que de committer des binaires sans provenance,
 * la source est un SVG versionne et les PNG sont regenerables.
 *
 * Usage : node scripts/render-icons.mjs
 * Dependance : @playwright/test (devDependency deja presente pour la QA).
 * Ce script n'est Jamais publie : scripts/ est exclu de l'artefact
 * (scripts/build-site.mjs, motifs DENY).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
/* Source : icons/icon.svg, jamais publiée (icons/ n'est pas dans DIRS).
   Sortie : docs/mobile/icons/, publiée telle quelle par scripts/build-site.mjs
   (le manifeste référence ces PNG). */
const SVG_SOURCE = path.join(ROOT, 'icons', 'icon.svg');
const ICONS = path.join(ROOT, 'docs', 'mobile', 'icons');
const SVG = fs.readFileSync(SVG_SOURCE, 'utf8');
fs.mkdirSync(ICONS, { recursive: true });

/* Variante pleine grandeur (usage `any`) et variante rentree dans la zone
   sure (usage `maskable` : Chrome peut rogner l'icone jusqu'a un cercle de
   80 % du cote, le motif est donc reduit a 78 % et recentre). */
function page(svg, size) {
  return `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style>
${svg.replace('<svg ', `<svg width="${size}" height="${size}" `)}`;
}

const maskable = (size) => `<!doctype html><meta charset="utf-8">
<style>html,body{margin:0;padding:0;background:transparent}svg{display:block}</style>
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
<g transform="translate(256 256) scale(0.78) translate(-256 -256)">
${SVG.replace(/^<\?xml[^>]*>\s*/,'').replace(/<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '')}
</g></svg>`;

const jobs = [
  { file: 'icon-192.png', size: 192, body: page(SVG, 192) },
  { file: 'icon-512.png', size: 512, body: page(SVG, 512) },
  { file: 'icon-maskable-512.png', size: 512, body: maskable(512) },
  { file: 'apple-touch-icon.png', size: 180, body: page(SVG, 180) },
];

const browser = await chromium.launch();
for (const job of jobs) {
  const pg = await browser.newPage({ viewport: { width: job.size, height: job.size }, deviceScaleFactor: 1 });
  await pg.setContent(job.body);
  await pg.waitForTimeout(60);
  await pg.locator('svg').screenshot({ path: path.join(ICONS, job.file), omitBackground: false });
  await pg.close();
  const bytes = fs.statSync(path.join(ICONS, job.file)).size;
  console.log(`  ${job.file} — ${job.size}x${job.size}, ${bytes} octets`);
}
await browser.close();
console.log('icones rendues depuis icons/icon.svg');