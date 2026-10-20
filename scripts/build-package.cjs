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
 * Usage :
 *   node scripts/build-package.cjs --source <dossier> --version 1.2.0 \
 *        [--out dist] [--notes <fichier>]
 */
'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
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

function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error(`Source introuvable : ${SOURCE}`);
    process.exit(1);
  }
  const pkgDir = path.join(OUT, `casinobabe-fishing-${VERSION}`);
  const stage = path.join(pkgDir, 'package');
  fs.rmSync(pkgDir, { recursive: true, force: true });
  fs.mkdirSync(path.join(stage, 'scripts'), { recursive: true });

  const manifest = { name: 'casinobabe-fishing', version: VERSION, builtAt: new Date().toISOString(), files: {} };
  const copy = (rel, destRel) => {
    const from = path.join(SOURCE, rel);
    if (!fs.existsSync(from)) return false;
    const to = path.join(stage, destRel);
    fs.mkdirSync(path.dirname(to), { recursive: true });
    const buf = fs.readFileSync(from);
    fs.writeFileSync(to, buf);
    manifest.files[destRel] = { sha256: sha256(buf), bytes: buf.length, source: rel };
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
  };

  // 4. notes de version + documentation
  const docSrc = path.join(REPO_ROOT, 'distribution', 'INSTALL.md');
  if (fs.existsSync(docSrc)) {
    const buf = fs.readFileSync(docSrc);
    fs.writeFileSync(path.join(stage, 'INSTALL.md'), buf);
    manifest.files['INSTALL.md'] = { sha256: sha256(buf), bytes: buf.length, source: 'distribution/INSTALL.md' };
  }
  if (NOTES && fs.existsSync(NOTES)) {
    const buf = fs.readFileSync(NOTES);
    fs.writeFileSync(path.join(pkgDir, 'RELEASE-NOTES.md'), buf);
  }

  // 5. controle final : aucune donnee client dans le paquet
  const staged = walk(stage);
  const bad = staged.filter((f) => /(^|\/)(state|reports|logs)\//.test(f) || /mem-.*\.jsonl$/.test(f));
  if (bad.length) {
    console.error('Donnees de session detectees dans le paquet : ' + bad.join(', '));
    process.exit(1);
  }

  fs.writeFileSync(path.join(pkgDir, 'MANIFEST.json'), JSON.stringify(manifest, null, 2) + '\n');
  fs.writeFileSync(path.join(pkgDir, 'VERSION'), VERSION + '\n');

  // 6. archive
  const zip = path.join(OUT, `casinobabe-fishing-${VERSION}.zip`);
  fs.rmSync(zip, { force: true });
  try {
    execFileSync('powershell', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-Command',
      `Compress-Archive -Path '${path.join(pkgDir, '*')}' -DestinationPath '${zip}' -Force`,
    ], { stdio: 'inherit' });
  } catch (e) {
    console.error("Compression impossible (PowerShell/Compress-Archive) : " + e.message);
    process.exit(1);
  }

  console.log(`Paquet construit : ${zip}`);
  console.log(`  version   : ${VERSION}`);
  console.log(`  addon     : ${addonCount} fichier(s)`);
  console.log(`  bot       : ${botCount} script(s)`);
  console.log(`  manifeste : ${Object.keys(manifest.files).length} entree(s) (sha256)`);
}

main();
