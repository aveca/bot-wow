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
 * FAIL-CLOSED (2026-11-08) : le code de sortie 0 ne peut plus etre obtenu
 * « faute de preuve du contraire ». Sortie non nulle des que l'integrite n'est
 * PAS etablie : MANIFEST.json absent, MANIFEST.json illisible ou sans table
 * `files`, fichier declare manquant, hash ou taille divergente, ou fichier
 * livre absent du manifeste. Auparavant, un paquet SANS manifeste sortait en
 * code 0 : l'outil paraissait valider un artefact qu'il n'avait pas pu
 * verifier.
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
 * Code de sortie : 0 UNIQUEMENT si l'integrite est etablie, 1 sinon.
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

/** Liste recursive, triee par octets (independant de la locale).
 *  Un lien symbolique est refuse : lire sa cible ferait entrer dans l'empreinte
 *  un contenu qui n'est pas celui livre. */
function walk(base, current = base, acc = []) {
  for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => {
    const x = Buffer.from(a.name, 'utf8');
    const y = Buffer.from(b.name, 'utf8');
    return Buffer.compare(x, y);
  })) {
    if (entry.name.startsWith('.') && entry.name !== '.gitignore') continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    const full = join(current, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`lien symbolique refuse : ${relative(base, full).split(sep).join('/')}`);
    }
    if (entry.isDirectory()) walk(base, full, acc);
    else if (entry.isFile()) acc.push(full);
    else throw new Error(`entree non reguliere refusee : ${relative(base, full).split(sep).join('/')}`);
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
//
// REGLE FAIL-CLOSED : l'outil ne rend PAS un code 0 « faute de preuve du
// contraire ». Sans manifeste, avec un manifeste illisible, avec un fichier
// livre hors manifeste, l'integrite n'est PAS etablie — donc le code de sortie
// est non nul. Un code 0 ne peut plus signifier « je n'ai pas pu verifier ».
const manifestPath = join(root, 'MANIFEST.json');
let manifest = null;
let manifestError = null;
const mismatches = [];
const undeclared = [];
const missing = [];
if (!existsSync(manifestPath)) {
  manifestError = 'MANIFEST.json absent : l\'integrite du paquet ne peut pas etre etablie';
} else {
  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
      manifestError = 'MANIFEST.json n\'est pas un objet JSON';
      manifest = null;
    } else if (!manifest.files || typeof manifest.files !== 'object' || Array.isArray(manifest.files)) {
      manifestError = 'MANIFEST.json sans table files exploitable';
      manifest = null;
    }
  } catch (e) {
    manifest = null;
    manifestError = `MANIFEST.json illisible : ${e.message}`;
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
  manifestError,
  mismatches,
  undeclared,
  missing,
  // Vrai seulement quand le manifeste existe, est lisible, et que chaque
  // fichier livre est declare avec le bon contenu ET que chaque fichier
  // declare est present. C'est la seule condition d'un code de sortie 0.
  integrityEstablished: !manifestError && mismatches.length === 0
    && missing.length === 0 && undeclared.length === 0,
};

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ ...result, entries }, null, 2));
} else {
  console.log(`treeDigest  : ${treeDigest}`);
  console.log(`files       : ${result.files}`);
  console.log(`bytes       : ${result.bytes}`);
  console.log(`manifest    : ${manifestError ? manifestError : (result.manifestPresent ? `${result.manifestFiles} fichier(s) declare(s)` : 'absent')}`);
  console.log(`integrite   : ${result.integrityEstablished ? 'ok (toutes les entrees declarees correspondent)' : 'NON ETABLIE'}`);
  if (mismatches.length) console.log(`  ecarts     : ${mismatches.length} (${mismatches.join(', ')})`);
  if (missing.length) console.log(`manquants   : ${missing.length} fichier(s) declare(s) mais absents : ${missing.join(', ')}`);
  if (undeclared.length) console.log(`hors manifeste : ${undeclared.length} fichier(s) : ${undeclared.join(', ')}`);
}

// FAIL-CLOSED : integrite non etablie => code de sortie non nul.
process.exit(result.integrityEstablished ? 0 : 1);
