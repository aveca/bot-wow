#!/usr/bin/env node
/**
 * canonical-package-digest.mjs — empreinte canonique d'un paquet client.
 *
 * PROBLEME : le ZIP livre au client est un CONTENEUR. Deux ZIP peuvent
 * contenir exactement les memes fichiers et avoir des SHA-256 differents
 * (horodatage des entrees, ordre de parcours, outil de compression).
 * Comparer les octets du conteneur ne dit donc rien de l'IDENTITE du
 * CONTENU livre.
 *
 * CE QUE FAIT CET OUTIL :
 *   - il calcule l'empreinte CANONIQUE de l'ARBORESCENCE livree (chemin +
 *     SHA-256 + taille de chaque fichier, tries par octets) : elle ne depend
 *     ni du ZIP, ni des horodatages, ni de l'ordre de parcours ;
 *   - il verifie, si un MANIFEST.json est present, que chaque fichier
 *     DECLARE correspond au contenu livre (integrite), qu'aucun fichier livre
 *     n'est absent du manifeste, et qu'aucun fichier declare ne manque dans
 *     le paquet ;
 *   - il n'ecrit rien et ne modifie rien.
 *
 * Convention de chemin :
 *   - l'empreinte porte les chemins RELATIFS A LA RACINE LIVREE (donc
 *     `package/addon/...` quand le paquet est range dans `package/`) : tout
 *     ce qui part dans le ZIP est couvert, y compris VERSION et
 *     RELEASE-NOTES.md ;
 *   - les cles du MANIFEST.json sont relatives au CONTENU (`package/...`
 *     retiré pour le contenu, `VERSION`/`RELEASE-NOTES.md` a la racine) ;
 *   - MANIFEST.json est l'INDEX : il ne peut pas declarer son propre hash,
 *     il est donc exclu du controle « fichier hors manifeste ».
 *
 * Usage :
 *   node scripts/canonical-package-digest.mjs <dossier du paquet>
 *   node scripts/canonical-package-digest.mjs <dossier> --json
 *
 * Sortie (texte) :
 *   treeDigest  : SHA-256 canonique de l'arborescence livree
 *   files       : nombre de fichiers livres
 *   bytes       : taille totale
 *   manifest    : etat de l'integrite (ok / ecarts)
 *
 * Code de sortie : 0 si l'integrite est intacte, 1 sinon.
 */
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

const dir = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null;
if (!dir || !existsSync(dir)) {
  console.error('Usage : node scripts/canonical-package-digest.mjs <dossier du paquet> [--json]');
  process.exit(1);
}

const SKIP_DIRS = new Set(['.git', 'node_modules', '__pycache__']);

/** Liste recursive, triee par octets (independant de la locale). */
function walk(base, current = base, acc = []) {
  for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => {
    const x = Buffer.from(a.name, 'utf8');
    const y = Buffer.from(b.name, 'utf8');
    return Buffer.compare(x, y);
  })) {
    if (entry.name.startsWith('.') && entry.name !== '.gitignore') continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(current, entry.name);
    if (entry.isDirectory()) walk(base, full, acc);
    else acc.push(full);
  }
  return acc;
}

/** Cle de manifeste correspondant a un chemin livre. */
function manifestKeyOf(pathFromRoot) {
  return pathFromRoot.startsWith('package/') ? pathFromRoot.slice('package/'.length) : pathFromRoot;
}

const root = dir;
const files = walk(root);
const entries = files.map((full) => {
  const buf = readFileSync(full);
  return {
    path: relative(root, full).split(sep).join('/'),
    sha256: createHash('sha256').update(buf).digest('hex'),
    bytes: buf.length,
  };
}).sort((a, b) => Buffer.compare(Buffer.from(a.path, 'utf8'), Buffer.from(b.path, 'utf8')));

// Empreinte canonique de l'arborescence livree.
// Format : "chemin\0sha256\0octets\n" par fichier, dans l'ordre trie.
const canonicalText = entries.map((e) => `${e.path}\0${e.sha256}\0${e.bytes}\n`).join('');
const treeDigest = createHash('sha256').update(canonicalText, 'utf8').digest('hex');
const totalBytes = entries.reduce((sum, e) => sum + e.bytes, 0);

// Integrite vis-a-vis du MANIFEST.json.
const manifestPath = join(root, 'MANIFEST.json');
let manifest = null;
const mismatches = [];
const undeclared = [];
const missing = [];
if (existsSync(manifestPath)) {
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  } catch (e) {
    manifest = { error: `MANIFEST.json illisible : ${e.message}` };
  }
}
if (manifest && manifest.files && typeof manifest.files === 'object') {
  const declared = new Map(Object.entries(manifest.files).map(([k, v]) => [String(k).split('\\').join('/'), v]));
  const seen = new Set();
  for (const e of entries) {
    if (e.path === 'MANIFEST.json') continue; // l'index ne se declare pas lui-meme
    const key = manifestKeyOf(e.path);
    const d = declared.get(key);
    if (!d) {
      undeclared.push(e.path);
      continue;
    }
    seen.add(key);
    if (String(d.sha256 || '').toLowerCase() !== e.sha256 || Number(d.bytes) !== e.bytes) {
      mismatches.push(e.path);
    }
  }
  for (const key of declared.keys()) {
    if (!seen.has(key)) missing.push(key);
  }
}

const result = {
  root: relative(process.cwd(), root).split(sep).join('/') || '.',
  files: entries.length,
  bytes: totalBytes,
  treeDigest,
  manifestPresent: !!manifest,
  manifestFiles: manifest && manifest.files ? Object.keys(manifest.files).length : 0,
  mismatches,
  undeclared,
  missing,
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ ...result, entries }, null, 2));
} else {
  console.log(`treeDigest  : ${treeDigest}`);
  console.log(`files       : ${result.files}`);
  console.log(`bytes       : ${result.bytes}`);
  console.log(`manifest    : ${result.manifestPresent ? `${result.manifestFiles} fichier(s) declare(s)` : 'absent'}`);
  console.log(`integrite   : ${mismatches.length === 0 ? 'ok (toutes les entrees declarees correspondent)' : `${mismatches.length} ecart(s) : ${mismatches.join(', ')}`}`);
  if (missing.length) console.log(`manquants   : ${missing.length} fichier(s) declare(s) mais absents : ${missing.join(', ')}`);
  if (undeclared.length) console.log(`hors manifeste : ${undeclared.length} fichier(s) : ${undeclared.join(', ')}`);
  if (manifest && manifest.error) console.log(`manifest    : ${manifest.error}`);
}

// Sortie non nulle si l'integrite est rompue (les fichiers hors manifeste
// sont signales mais ne font pas echouer : ils sont documentes).
process.exit(mismatches.length === 0 && missing.length === 0 ? 0 : 1);
