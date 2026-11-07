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

const SOURCE = path.resolve(arg('source', process.cwd()));
const VERSION = arg('version', '0.0.0');
const OUT = path.resolve(arg('out', path.join(process.cwd(), 'dist')));
const NOTES = arg('notes', null);
const REPO_ROOT = path.resolve(__dirname, '..');

/** Fichiers du bot Python livre au client. */
const BOT_FILES = [
  'scripts/fishing_bot.py',
  'scripts/fishing_observer.py',
  'scripts/fishing_memory.py',
  'scripts/fishing_popup.py',
  'scripts/focus_broker.py',
  'scripts/fishing-oneclick.ps1',
];

/** Repertoires exclus (donnees de session, journaux, memoire). */
const FORBIDDEN = [
  'state', 'reports', 'logs', '.git', 'node_modules', '__pycache__',
  '.autopilot', 'bridge', 'site', 'tests',
];

function walk(dir, base = dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') && e.name !== '.gitignore') continue;
    const full = path.join(dir, e.name);
    const rel = path.relative(base, full).replace(/\\/g, '/');
    if (FORBIDDEN.includes(rel.split('/')[0])) continue;
    if (e.isDirectory()) walk(full, base, acc);
    else acc.push(rel);
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
      if (e.isDirectory()) walk(full, base);
      else entries.push(full);
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

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Source introuvable : ${SOURCE}`);
    process.exit(1);
  }
  const pkgDir = path.join(OUT, `casinobabe-fishing-${VERSION}`);
  const stage = path.join(pkgDir, 'package');
  fs.rmSync(pkgDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(stage, 'scripts'), { recursive: true });

  const manifest = { name: 'casinobabe-fishing', version: VERSION, builtAt: null, source: null, files: {} };

  // Provenance de la source : arguments CLI (priorite) sinon checkout Git.
  const git = gitInfo(SOURCE);
  const provenance = {
    repository: arg('source-repo', git ? git.repository : '') || null,
    ref: arg('source-ref', git ? git.ref : '') || null,
    commit: arg('source-commit', git ? git.commit : '') || null,
    commitDate: git ? git.commitDate : null,
  };
  manifest.source = (provenance.repository || provenance.ref || provenance.commit) ? provenance : null;
  manifest.builtAt = resolveBuiltAt(SOURCE, provenance);

  const copy = (rel, destRel) => {
    const from = path.join(SOURCE, rel);
    if (!fs.existsSync(from)) return false;
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
  const addonDir = path.join(SOURCE, 'runtime-addon', 'Casinobabe');
  let addonCount = 0;
  if (fs.existsSync(addonDir)) {
    for (const rel of walk(addonDir)) {
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
}

main();
