#!/usr/bin/env node
/**
 * build-package.cjs — construit un PAQUET VERSIONNE distribuable du bot de
 * peche (Casinobabe Fishing).
 *
 * Objectif : un client doit pouvoir installer le logiciel sans acces aux
 * depots de developpement ni a nos identifiants. Le paquet contient donc :
 *   - l'addon Lua (runtime-addon/Casinobabe) a copier dans Interface/AddOns ;
 *   - le bot Python (scripts/fishing_*.py, scripts/focus_broker.py) ;
 *   - un gabarit de configuration ;
 *   - un MANIFEST.json avec le SHA-256 de chaque fichier (verification
 *     d'integrite et detection de sabotage a l'installation).
 *
 * REGLE ABSOLUE : aucune donnee client (state/, reports/, logs/, mem-*.jsonl)
 * ne doit se retrouver dans le paquet. Le script echoue explicitement s'il
 * en trouve.
 *
 * REPRODUCTIBILITE (2026-11-07) : deux constructions du meme commit source
 * doivent produire le MEME SHA-256. Trois sources de non-determinisme ont ete
 * supprimees :
 *   1. `builtAt` etait l'heure de la machine -> il vaut maintenant
 *      SOURCE_DATE_EPOCH, sinon la date de commit de la source, sinon null ;
 *   2. le tri des fichiers utilisait `localeCompare`, qui depend de la
 *      locale -> tri byte-stable ;
 *   3. le manifeste est ecrit avec des cles triees.
 * L'archive ZIP utilise deja une date fixe (1996-01-01) et des entrees
 * triees. Le manifeste porte en plus la PROVENANCE de la source
 * (depot, ref, commit) pour que l'artefact soit auto-documentant.
 *
 * Usage :
 *   node scripts/build-package.cjs --source <dossier> --version 1.2.0 \
 *        [--out dist] [--notes <fichier>] \
 *        [--source-repo <owner/repo>] [--source-ref <ref>] [--source-commit <sha>]
 */
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { execFileSync } = require('node:child_process');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i >= 0 && process.argv[i + 1]) return process.argv[i + 1];
  return def;
}

/**
 * Erreur d'integrite : le build doit ECHOUER, jamais livrer un paquet douteux.
 */
class IntegrityError extends Error {}

/**
 * Verifie qu'un chemin est un FICHIER REGULIER (ni lien symbolique, ni
 * repertoire, ni fifo/socket/device) et que sa cible reelle reste
 * STRICTEMENT sous `root`.
 *
 * POURQUOI : `readdirSync(..., { withFileTypes: true })` ne suit PAS les liens
 * symboliques — un `Dirent` de lien symbolique a `isDirectory() === false` et
 * `isFile() === false`. Un pointeur vers un repertoire etait donc pousse comme
 * « fichier » puis lu par `readFileSync` (plantage EISDIR). Pire : un lien vers
 * un FICHIER etait lu normalement, et le contenu d'un fichier EXTERIEUR a la
 * source se retrouvait dans le paquet livre au client, declare au manifeste
 * comme s'il venait de la source. Le paquet devenait falsifiable.
 *
 * On refuse donc explicitement tout lien symbolique AVANT toute lecture, et on
 * confronte le realpath a la racine autorisee.
 */
function assertRegularFileInside(full, root, relForMessage) {
  let st;
  try {
    st = fs.lstatSync(full);
  } catch (e) {
    throw new IntegrityError(`chemin illisible : ${relForMessage} (${e.code || e.message})`);
  }
  if (st.isSymbolicLink()) {
    throw new IntegrityError(
      `lien symbolique refuse : ${relForMessage} (les liens ne sont jamais livres)`,
    );
  }
  if (!st.isFile()) {
    throw new IntegrityError(
      `entree non reguliere refusee : ${relForMessage} (${st.isDirectory() ? 'repertoire' : 'type special'})`,
    );
  }
  const real = fs.realpathSync(full);
  const realRoot = fs.realpathSync(root);
  const rel = path.relative(realRoot, real);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new IntegrityError(
      `cible hors de la source : ${relForMessage} -> ${real} (racine autorisee ${realRoot})`,
    );
  }
}

/** Meme garde pour les repertoires parcourus. */
function assertDirectoryInside(full, root, relForMessage) {
  let st;
  try {
    st = fs.lstatSync(full);
  } catch (e) {
    throw new IntegrityError(`chemin illisible : ${relForMessage} (${e.code || e.message})`);
  }
  if (st.isSymbolicLink()) {
    throw new IntegrityError(
      `lien symbolique (repertoire) refuse : ${relForMessage} (les liens ne sont jamais livres)`,
    );
  }
  if (!st.isDirectory()) {
    throw new IntegrityError(`entree non repertoire refusee : ${relForMessage}`);
  }
  const real = fs.realpathSync(full);
  const realRoot = fs.realpathSync(root);
  const rel = path.relative(realRoot, real);
  if (rel.startsWith('..') || path.isAbsolute(rel)) {
    throw new IntegrityError(
      `cible hors de la source : ${relForMessage} -> ${real} (racine autorisee ${realRoot})`,
    );
  }
}

const SOURCE = path.resolve(arg('source', process.cwd()));
const VERSION = arg('version', '0.0.0');
const OUT = path.resolve(arg('out', path.join(process.cwd(), 'dist')));
const NOTES = arg('notes', null);
const REPO_ROOT = path.resolve(__dirname, '..');

/** Fichiers du bot Python livre au client. */
const BOT_FILES = [
  // Entry point + every local module imported by the runtime (directly or
  // through the recovery/navigation helpers). Missing modules silently
  // disabled death recovery and navigation in the previous package.
  'scripts/fishing_bot.py',
  'scripts/fishing_observer.py',
  'scripts/fishing_memory.py',
  'scripts/fishing_popup.py',
  'scripts/focus_broker.py',
  'scripts/fishing_process.py',
  'scripts/fishing_map.py',
  'scripts/fishing_controls.py',
  'scripts/fishing_client.py',
  'scripts/fishing_recovery.py',
  'scripts/fishing_safety.py',
  'scripts/fishing_navigation.py',
  'scripts/fishing_minimap.py',
  'scripts/fishing_spots.py',
];

/** Repertoires exclus (donnees de session, journaux, memoire). */
const FORBIDDEN = [
  'state', 'reports', 'logs', '.git', 'node_modules', '__pycache__',
  '.autopilot', 'bridge', 'site', 'tests',
];

/**
 * Parcours de la source. REFUSE tout lien symbolique (fichier ou repertoire)
 * AVANT toute lecture, et confirme que chaque cible reelle reste sous `base`.
 * Un lien vers un repertoire serait sinon pousse comme « fichier » (un Dirent
 * de lien n'est ni `isDirectory()` ni `isFile()`) puis lu par `readFileSync`.
 */
function walk(dir, base = dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') && e.name !== '.gitignore') continue;
    const full = path.join(dir, e.name);
    const rel = path.relative(base, full).replace(/\\/g, '/');
    if (FORBIDDEN.includes(rel.split('/')[0])) continue;
    if (e.isSymbolicLink()) {
      throw new IntegrityError(
        `lien symbolique refuse dans la source : ${rel} (les liens ne sont jamais livres)`,
      );
    }
    if (e.isDirectory()) {
      assertDirectoryInside(full, base, rel);
      walk(full, base, acc);
    } else if (e.isFile()) {
      assertRegularFileInside(full, base, rel);
      acc.push(rel);
    } else {
      throw new IntegrityError(`entree non reguliere refusee dans la source : ${rel}`);
    }
  }
  return acc;
}

/** Variante defensive pour l'arborescence deja mise en scene (staging). */
function walkStrict(dir, base = dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    const rel = path.relative(base, full).replace(/\\/g, '/');
    if (e.isSymbolicLink()) {
      throw new IntegrityError(`lien symbolique refuse dans le paquet : ${rel}`);
    }
    if (e.isDirectory()) walkStrict(full, base, acc);
    else if (e.isFile()) acc.push(full);
    else throw new IntegrityError(`entree non reguliere refusee dans le paquet : ${rel}`);
  }
  return acc;
}


function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

/** Extensions texte : leurs fins de ligne sont normalisees (LF) dans le paquet. */
const TEXT_EXTENSIONS = new Set(['.py', '.lua', '.md', '.toc', '.json', '.ps1', '.txt', '.cfg', '.ini']);

/**
 * Normalise les fins de ligne d'un fichier texte (CRLF -> LF).
 * Le contenu livre est alors identique a celui du blob Git, quel que soit le
 * `core.autocrlf` du poste qui a construit le paquet : sans cela, le meme
 * commit produit deux SHA-256 differents (mesure : 3046DEAB... en LF contre
 * AAC97DB3... en CRLF, sur le meme poste).
 */
function normalizeText(buf) {
  let crlf = 0;
  for (let i = 1; i < buf.length; i++) {
    if (buf[i] === 0x0a && buf[i - 1] === 0x0d) crlf++;
  }
  if (!crlf) return { buf, normalized: false };
  const out = Buffer.allocUnsafe(buf.length - crlf);
  let j = 0;
  for (let i = 0; i < buf.length; i++) {
    if (buf[i] === 0x0d && buf[i + 1] === 0x0a) continue;
    out[j++] = buf[i];
  }
  return { buf: out.subarray(0, j), normalized: true };
}

/**
 * Provenance Git de la source, lue dans le checkout source.
 * Renvoie null quand la source n'est pas un depot Git : le build doit rester
 * possible, mais la provenance sera alors declaree comme inconnue.
 */
function gitInfo(dir) {
  const run = (args) => {
    try {
      return execFileSync('git', args, {
        cwd: dir, encoding: 'utf8', timeout: 15000, windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim();
    } catch (_) {
      return '';
    }
  };
  const commit = run(['rev-parse', 'HEAD']);
  if (!commit) return null;
  let repository = '';
  const url = run(['config', '--get', 'remote.origin.url']);
  const m = url.match(/github\.com[:/]+([^/]+)\/([^/\s]+?)(?:\.git)?$/);
  if (m) repository = `${m[1]}/${m[2]}`;
  const commitDate = run(['show', '-s', '--format=%cI', 'HEAD']);
  let ref = run(['rev-parse', '--abbrev-ref', 'HEAD']);
  if (!ref || ref === 'HEAD') ref = run(['name-rev', '--name-only', 'HEAD']);
  // HEAD detache : `name-rev` renvoie remotes/origin/<branche> → on garde la
  // branche lisible.
  ref = ref.replace(/^remotes\/origin\//, '');
  return { repository, ref, commit, commitDate: commitDate || null };
}

/**
 * Horodatage de build DETERMINISTE.
 * Ordre : SOURCE_DATE_EPOCH (norme reproductible-builds), sinon la date de
 * commit de la source, sinon null. L'heure de la machine n'est JAMAIS
 * utilisee : elle changeait le SHA-256 a chaque construction.
 */
function resolveBuiltAt(source, provenance) {
  const epoch = process.env.SOURCE_DATE_EPOCH;
  if (epoch !== undefined && epoch !== '') {
    const seconds = Number(epoch);
    if (Number.isFinite(seconds)) return new Date(seconds * 1000).toISOString();
  }
  if (provenance && provenance.commitDate) {
    const d = new Date(provenance.commitDate);
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

/** Tri byte-stable : `localeCompare` depend de la locale de la machine. */
function byName(a, b) {
  const x = Buffer.from(a.name, 'utf8');
  const y = Buffer.from(b.name, 'utf8');
  return Buffer.compare(x, y);
}

/**
 * Ecrit une archive ZIP en pur Node (deflate brut, CRC-32 calcule).
 * Pourquoi : le build ne doit dependre ni de PowerShell (absent sur les
 * runners Linux de la CI) ni d'un paquet npm : le paquet doit se construire
 * partout, y compris en CI.
 */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0 ^ -1;
  for (let i = 0; i < buf.length; i++) c = (c >>> 8) ^ CRC_TABLE[(c ^ buf[i]) & 0xff];
  return (c ^ -1) >>> 0;
}

function zipDirectory(dir, outFile, prefix = '') {
  const entries = [];
  (function walk(d, base = d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true }).sort(byName)) {
      const full = path.join(d, e.name);
      const rel = path.relative(base, full).replace(/\\/g, '/');
      if (e.isSymbolicLink()) {
        throw new IntegrityError(`lien symbolique refuse a l'archivage : ${rel}`);
      }
      if (e.isDirectory()) walk(full, base);
      else if (e.isFile()) entries.push(full);
      else throw new IntegrityError(`entree non reguliere refusee a l'archivage : ${rel}`);
    }
  })(dir);

  const chunks = [];
  const central = [];
  let offset = 0;
  for (const file of entries) {
    const name = (prefix + path.relative(dir, file)).replace(/\\/g, '/');
    const raw = fs.readFileSync(file);
    const deflated = zlib.deflateRawSync(raw, { level: 9 });
    const useDeflate = deflated.length < raw.length;
    const data = useDeflate ? deflated : raw;
    const method = useDeflate ? 8 : 0;
    const crc = crc32(raw);
    const nameBuf = Buffer.from(name, 'utf8');

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);           // version needed
    local.writeUInt16LE(0x0800, 6);       // flag : nom de fichier en UTF-8
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(0, 10);           // heure
    local.writeUInt16LE(0x21, 12);        // date (1996-01-01) : reproductible
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(data.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(nameBuf.length, 26);
    local.writeUInt16LE(0, 28);
    chunks.push(local, nameBuf, data);

    const cd = Buffer.alloc(46);
    cd.writeUInt32LE(0x02014b50, 0);
    cd.writeUInt16LE(20, 4);
    cd.writeUInt16LE(20, 6);
    cd.writeUInt16LE(0x0800, 8);
    cd.writeUInt16LE(method, 10);
    cd.writeUInt16LE(0, 12);
    cd.writeUInt16LE(0x21, 14);
    cd.writeUInt32LE(crc, 16);
    cd.writeUInt32LE(data.length, 20);
    cd.writeUInt32LE(raw.length, 24);
    cd.writeUInt16LE(nameBuf.length, 28);
    cd.writeUInt16LE(0, 30);
    cd.writeUInt16LE(0, 32);
    cd.writeUInt16LE(0, 34);
    cd.writeUInt16LE(0, 36);
    cd.writeUInt32LE(0, 38);
    cd.writeUInt32LE(offset, 42);
    central.push(Buffer.concat([cd, nameBuf]));

    offset += local.length + nameBuf.length + data.length;
  }

  const cdBuf = Buffer.concat(central);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cdBuf.length, 12);
  end.writeUInt32LE(offset, 16);
  end.writeUInt16LE(0, 20);
  fs.writeFileSync(outFile, Buffer.concat([...chunks, cdBuf, end]));
  return entries.length;
}

/**
 * Composants explicitement NON ÉTABLIS dans distribution/THIRD_PARTY_NOTICES.md.
 * Le builder refuse leur présence, même si les notices sont bien copiées :
 * une notice n'accorde aucun droit de redistribution.
 *
 * Retirer un nom de cette liste exige une preuve de licence/provenance ou un
 * remplacement original vérifié et documenté. Le contrôle par nom est
 * volontairement conservateur pour éviter un contournement par changement de
 * contenu tout en gardant le même chemin d'addon.
 */
function assertNoUnverifiedAddonComponents(files) {
  const blockedNames = new Set(['libdbicon-1.0.lua', 'background.tga']);
  const blocked = files
    .map((rel) => rel.replace(/\\/g, '/'))
    .filter((rel) => blockedNames.has(path.posix.basename(rel).toLowerCase()))
    .sort();
  if (blocked.length) {
    throw new IntegrityError(
      'composants addon non certifiés refusés : ' + blocked.join(', ')
      + '. Voir distribution/THIRD_PARTY_NOTICES.md ; aucune archive ne doit être produite.',
    );
  }
}

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Source introuvable : ${SOURCE}`);
    process.exit(1);
  }
  // Préflight juridique avant toute suppression ou écriture d'un artefact existant.
  const addonDir = path.join(SOURCE, 'runtime-addon', 'Casinobabe');
  const addonFiles = fs.existsSync(addonDir) ? walk(addonDir) : [];
  assertNoUnverifiedAddonComponents(addonFiles);

  const pkgDir = path.join(OUT, `casinobabe-fishing-${VERSION}`);
  const stage = path.join(pkgDir, 'package');
  fs.rmSync(pkgDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(stage, 'scripts'), { recursive: true });

  const manifest = { name: 'casinobabe-fishing', version: VERSION, builtAt: null, source: null, files: {} };

  // Provenance de la source.
  //
  // REGLE : une valeur fournie par la ligne de commande n'est JAMAIS certifiee
  // telle quelle. Elle est confrontee au checkout reel (remote origin, ref
  // resolue, HEAD). Si elle ne peut pas etre prouvee, le build ECHOUE : un
  // manifeste portant une provenance falsifiee ferait croire a un artefact
  // auto-documentant alors qu'il ne demontre rien.
  const git = gitInfo(SOURCE);
  const provenanceVerified = !!git;
  const provenance = {
    repository: git ? git.repository : null,
    ref: git ? git.ref : null,
    commit: git ? git.commit : null,
    commitDate: git ? git.commitDate : null,
  };
  const overrides = [];
  for (const [flag, field] of [
    ['source-repo', 'repository'],
    ['source-ref', 'ref'],
    ['source-commit', 'commit'],
  ]) {
    const value = arg(flag, null);
    if (!value) continue;
    overrides.push({ flag, field, value });
    const actual = provenance[field];
    if (!actual) {
      throw new IntegrityError(
        `--${flag} fourni mais la provenance reelle est illisible dans ${SOURCE} : `
        + 'override refuse (il ne peut pas etre prouve)',
      );
    }
    if (field === 'commit') {
      // Une reference courte est acceptee si c'est un prefixe du HEAD reel,
      // d'au moins 7 caracteres (sinon l'ambiguite est trop grande).
      const a = String(value).toLowerCase();
      const b = String(actual).toLowerCase();
      const prefixOk = a.length >= 7 && b.startsWith(a);
      if (a !== b && !prefixOk) {
        throw new IntegrityError(
          `--${flag} ${value} ne correspond pas au HEAD reel ${actual} : override refuse`,
        );
      }
    } else if (String(value) !== String(actual)) {
      throw new IntegrityError(
        `--${flag} ${value} ne correspond pas a la valeur reelle ${actual} : override refuse`,
      );
    }
  }
  if (!provenanceVerified && overrides.length === 0) {
    // Sans depot Git ni override, la provenance est declaree INCONNUE : le
    // paquet reste constructible, mais rien n'est certifie.
    provenance.repository = null;
    provenance.ref = null;
    provenance.commit = null;
    provenance.commitDate = null;
  }
  provenance.overridesChecked = overrides.map((o) => o.flag);
  manifest.source = (provenance.repository || provenance.ref || provenance.commit) ? provenance : null;
  // `provenanceVerified` dit au consommateur du manifeste si les valeurs ont
  // ete confrontees au checkout reel. Il n'est ecrit que quand elles l'ont ete.
  if (manifest.source && provenanceVerified) manifest.source.provenanceVerified = true;
  manifest.builtAt = resolveBuiltAt(SOURCE, provenance);

  const copy = (rel, destRel) => {
    const from = path.join(SOURCE, rel);
    if (!fs.existsSync(from)) return false;
    // Garde d'integrite AVANT toute lecture : jamais de lien symbolique, et la
    // cible reelle doit rester strictement sous SOURCE. Sans ce controle, un
    // lien place dans la source ferait entrer dans le paquet livre un contenu
    // exterieur, declare au manifeste comme provenant de la source.
    assertRegularFileInside(from, SOURCE, rel.replace(/\\/g, '/'));
    // Les cles du manifeste utilisent ALWAYS des separateurs POSIX : le
    // manifeste doit etre identique quelle que soit la machine qui a
    // construit le paquet (Windows ou Linux).
    const key = destRel.replace(/\\/g, '/');
    const to = path.join(stage, key);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    const raw = fs.readFileSync(from);
    const ext = path.extname(from).toLowerCase();
    let buf = raw;
    let normalized = false;
    if (TEXT_EXTENSIONS.has(ext)) {
      const res = normalizeText(raw);
      buf = res.buf;
      normalized = res.normalized;
    }
    fs.writeFileSync(to, buf);
    manifest.files[key] = { sha256: sha256(buf), bytes: buf.length, source: rel.replace(/\\/g, '/') };
    // Politique de fins de ligne declaree de facon STABLE : le manifeste
    // doit etre identique que le checkout source soit en LF ou en CRLF.
    if (TEXT_EXTENSIONS.has(ext)) manifest.files[key].eol = 'LF';
    return true;
  };

  // 1. l'addon
  let addonCount = 0;
  if (addonFiles.length) {
    for (const rel of addonFiles) {
      if (copy(path.join('runtime-addon', 'Casinobabe', rel), path.join('addon', 'Casinobabe', rel))) addonCount++;
    }
  }
  if (!addonCount) {
    console.error('Aucun addon trouve dans runtime-addon/Casinobabe : paquet incomplet.');
    process.exit(1);
  }

  // 2. le bot
  let botCount = 0;
  for (const rel of BOT_FILES) if (copy(rel, rel.replace(/^scripts[\\/]/, 'scripts/'))) botCount++;
  if (!botCount) {
    console.error('Aucun script du bot trouve : paquet incomplet.');
    process.exit(1);
  }

  // 3. configuration initiale
  const cfg = {
    clickAfterBiteMs: 450,
    castKey: '2',
    applyBait: true,
    baitRefreshSec: 600,
    manualSuspendMaxSec: 900,
    waterRatioMin: 0.4,
    clickConfirmRetrySec: 1.0,
    clickConfirmTimeoutSec: 6.0,
  };
  fs.writeFileSync(path.join(stage, 'config.example.json'), JSON.stringify(cfg, null, 2) + '\n');
  manifest.files['config.example.json'] = {
    sha256: sha256(fs.readFileSync(path.join(stage, 'config.example.json'))),
    bytes: fs.statSync(path.join(stage, 'config.example.json')).size,
    source: '(genere)',
    eol: 'LF',
  };

  // 4. notes de version + documentation
  const docSrc = path.join(REPO_ROOT, 'distribution', 'INSTALL.md');
  if (fs.existsSync(docSrc)) {
    const res = normalizeText(fs.readFileSync(docSrc));
    const buf = res.buf;
    fs.writeFileSync(path.join(stage, 'INSTALL.md'), buf);
    manifest.files['INSTALL.md'] = { sha256: sha256(buf), bytes: buf.length, source: 'distribution/INSTALL.md', eol: 'LF' };
  }
  /* OBLIGATION DE LICENCE, PAS UNE OPTION.
     Le runtime actuel embarque la police DejaVu Sans (media/casino_uni.ttf).
     Sa licence Bitstream Vera + Arev exige que l'avis de copyright et la
     permission accompagnent chaque copie. LibStub, LibDBIcon-1.0 et
     background.tga ont été retirés du runtime candidat ; les anciennes
     archives R2 restent historiques et ne sont pas une source de build.
     Le document d'attribution est livré et déclaré au manifeste. Sans notice,
     le build échoue plutôt que de produire un paquet non conforme. */
  const noticeSrc = path.join(REPO_ROOT, 'distribution', 'THIRD_PARTY_NOTICES.md');
  if (!fs.existsSync(noticeSrc)) {
    console.error(
      'distribution/THIRD_PARTY_NOTICES.md est absent : la police DejaVu Sans '
      + 'embarquée exige ses avis de licence. Paquet NON construit.',
    );
    process.exit(1);
  }
  {
    const res = normalizeText(fs.readFileSync(noticeSrc));
    const buf = res.buf;
    fs.writeFileSync(path.join(stage, 'THIRD_PARTY_NOTICES.md'), buf);
    manifest.files['THIRD_PARTY_NOTICES.md'] = {
      sha256: sha256(buf),
      bytes: buf.length,
      source: 'distribution/THIRD_PARTY_NOTICES.md',
      eol: 'LF',
    };
  }
  if (NOTES && fs.existsSync(NOTES)) {
    const res = normalizeText(fs.readFileSync(NOTES));
    const buf = res.buf;
    fs.writeFileSync(path.join(pkgDir, 'RELEASE-NOTES.md'), buf);
    manifest.files['RELEASE-NOTES.md'] = { sha256: sha256(buf), bytes: buf.length, source: '(genere)', eol: 'LF' };
  }

  // 5. controle final : aucune donnee client dans le paquet
  const staged = walk(stage);
  const bad = staged.filter((f) => /(^|\/)(state|reports|logs)\//.test(f) || /mem-.*\.jsonl$/.test(f));
  if (bad.length) {
    console.error('Donnees de session detectees dans le paquet : ' + bad.join(', '));
    process.exit(1);
  }

  // Le fichier VERSION est ecrit AVANT le manifeste et declare comme les
  // autres : le manifeste couvre ainsi TOUS les fichiers livres, sauf
  // MANIFEST.json lui-meme (un index ne peut pas contenir son propre hash).
  const versionBuf = Buffer.from(VERSION + '\n', 'utf8');
  fs.writeFileSync(path.join(pkgDir, 'VERSION'), versionBuf);
  manifest.files['VERSION'] = { sha256: sha256(versionBuf), bytes: versionBuf.length, source: '(genere)', eol: 'LF' };

  // Cles triees : le manifeste ne doit pas dependre de l'ordre de copie.
  const sortedFiles = {};
  for (const key of Object.keys(manifest.files).sort()) sortedFiles[key] = manifest.files[key];
  manifest.files = sortedFiles;

  fs.writeFileSync(path.join(pkgDir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');

  // 6. archive (ZIP ecrit en pur Node : portable, sans dependance externe)
  const zip = path.join(OUT, `casinobabe-fishing-${VERSION}.zip`);
  fs.rmSync(zip, { force: true });
  const count = zipDirectory(pkgDir, zip);

  console.log(`Paquet construit : ${zip}`);
  console.log(`  version   : ${VERSION}`);
  console.log(`  source    : ${manifest.source ? `${manifest.source.repository || '?'}@${(manifest.source.commit || '?').slice(0, 12)} (${manifest.source.ref || '?'})` : 'provenance inconnue'}`);
  console.log(`  builtAt   : ${manifest.builtAt || '(non horodate : SOURCE_DATE_EPOCH / date de commit absente)'}`);
  console.log(`  addon     : ${addonCount} fichier(s)`);
  console.log(`  bot       : ${botCount} script(s)`);
  console.log(`  archive   : ${count} entree(s)`);
  console.log(`  manifeste : ${Object.keys(manifest.files).length} entree(s) (sha256)`);
  console.log(`  provenance: ${manifest.source ? (manifest.source.provenanceVerified ? 'verifiee contre le checkout reel' : 'NON verifiable') : 'inconnue'}`);
}

/* Un paquet dont l'integrite ou la provenance ne peut pas etre prouvee ne doit
 * JAMAIS etre livre : le build echoue avec un message clair et un code non
 * nul, plutot qu'un artefact douteux accompagne d'une pile d'appels. */
try {
  main();
} catch (e) {
  if (e instanceof IntegrityError) {
    console.error(`ECHEC D'INTEGRITE — paquet non construit : ${e.message}`);
    process.exit(1);
  }
  throw e;
}
