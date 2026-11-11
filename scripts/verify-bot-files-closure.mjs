#!/usr/bin/env node
/**
 * verify-bot-files-closure.mjs — la liste des scripts Python du MANIFEST
 * d'un paquet construit doit être EXACTEMENT la fermeture des imports locaux
 * du bot livré (BFS depuis scripts/fishing_bot.py, y compris les imports
 * indentés try/except « jamais bloquants » : un module optionnel reste
 * requis pour que le paquet soit complet).
 *
 * POURQUOI : le builder copie une liste déclarée (BOT_FILES). Si la source
 * ajoute un import local non répertorié, le paquet part incomplet ; si la
 * liste contient un module devenu inutilisé, le paquet embarque du mort.
 * Ce script refuse les deux cas, dans les deux sens (différences listées).
 *
 * Usage :
 *   node scripts/verify-bot-files-closure.mjs \
 *     --manifest <chemin MANIFEST.json> --scripts-dir <checkout source>/scripts
 * Options : --root <module racine, défaut fishing_bot>
 *
 * Ne suit que les modules PRÉSENTS localement (stdlib/cv2/numpy/win32/…
 * ignorés). Sortie : PASS ou les différences exactes, exit 1.
 */
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, basename } from 'node:path';

function arg(name, def = null) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return def;
}

const manifestPath = arg('manifest');
const scriptsDir = arg('scripts-dir');
const root = arg('root', 'fishing_bot');
if (!manifestPath || !scriptsDir || !existsSync(manifestPath) || !existsSync(scriptsDir)) {
  console.error('usage: node scripts/verify-bot-files-closure.mjs --manifest <MANIFEST.json> --scripts-dir <dir> [--root fishing_bot]');
  process.exit(2);
}

/* --- 1. Scripts déclarés au manifeste --- */
const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const declared = Object.keys(manifest.files || {})
  .filter((k) => /^scripts\/[A-Za-z0-9_]+\.py$/.test(k))
  .map((k) => basename(k, '.py'))
  .sort();

/* --- 2. Fermeture BFS des imports locaux du checkout source --- */
const localModules = new Set(
  readdirSync(scriptsDir)
    .filter((f) => f.endsWith('.py'))
    .map((f) => basename(f, '.py')),
);

function localRefsFrom(source) {
  // Les commentaires en fin de ligne cassaient l'ancienne ancre de fin ; on
  // les retire avant le matching des imports (contenu string uniquement).
  const code = source.replace(/#[^\n]*/g, '');
  const found = new Set();
  for (const m of code.matchAll(/(?:^|\n)[ \t]*from\s+([A-Za-z_][A-Za-z0-9_.]*)\s+import/g)) {
    found.add(m[1].split('.')[0]);
  }
  for (const m of code.matchAll(/(?:^|\n)[ \t]*import\s+([A-Za-z_][A-Za-z0-9_,\s.]+?)(?=\s+as\b|[,=\s\n]|$)/g)) {
    for (const part of m[1].split(',')) {
      const modName = part.trim().split(/\s+as\s+/)[0].trim();
      if (modName) found.add(modName.split('.')[0]);
    }
  }
  return [...found];
}

const seen = new Set();
const queue = [root];
while (queue.length) {
  const mod = queue.pop();
  if (seen.has(mod)) continue;
  seen.add(mod);
  const file = join(scriptsDir, `${mod}.py`);
  if (!existsSync(file)) continue;
  for (const ref of localRefsFrom(readFileSync(file, 'utf8'))) {
    if (localModules.has(ref)) queue.push(ref);
  }
}

const closure = [...seen].sort();

/* --- 3. Égalité stricte, différences des deux sens --- */
const declaredSet = new Set(declared);
const closureSet = new Set(closure);
const missingFromPackage = closure.filter((m) => !declaredSet.has(m)); // importé mais non livré
const deadInPackage = declared.filter((m) => !closureSet.has(m) && m !== root); // livré mais non requis
const rootMissing = !declaredSet.has(root);

if (missingFromPackage.length || deadInPackage.length || rootMissing) {
  console.error('BOT FILES CLOSURE: FAIL');
  if (rootMissing) console.error(`  racine absente du manifeste : scripts/${root}.py`);
  if (missingFromPackage.length) {
    console.error(`  importés par la fermeture mais ABSENTS du paquet (${missingFromPackage.length}) :`);
    missingFromPackage.forEach((m) => console.error(`    - scripts/${m}.py`));
  }
  if (deadInPackage.length) {
    console.error(`  embarqués mais NON requis par la fermeture (${deadInPackage.length}) :`);
    deadInPackage.forEach((m) => console.error(`    - scripts/${m}.py`));
  }
  console.error(`manifeste : ${declared.length} scripts ; fermeture BFS depuis ${root} : ${closure.length} modules`);
  process.exit(1);
}

console.log(`BOT FILES CLOSURE: PASS (${declared.length} scripts = fermeture BFS de ${closure.length} modules depuis scripts/${root}.py)`);
console.log(closure.map((m) => `scripts/${m}.py`).join('\n'));
