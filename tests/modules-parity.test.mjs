#!/usr/bin/env node
/**
 * modules-parity.test.mjs — PARITE entre assets/modules.json (affiché sur le
 * site) et le registre Python canonique (Casinobabe / scripts/botwow_modules.py).
 *
 * Pourquoi : la page "Module ledger" du site affiche des statuts de produit.
 * Si le JSON du site et le registre divergent, le site ment sur ce qui est
 * réellement disponible. Ce test vérifie aussi la cohérence de version avec
 * version.txt (le registre et le site doivent raconter la même release).
 *
 * Le test est SKIPPED (et non en échec) si Python ou le dépôt bot est absent :
 * il n'invalide pas la CI d'une machine sans le dépôt Casinobabe.
 * Override d'emplacement : BOTWOW_MODULES_PY.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const JSON_PATH = join(REPO, 'assets', 'modules.json');
const VERSION_PATH = join(REPO, 'version.txt');

const DEFAULT_PY =
  'C:\\Users\\user\\Documents\\GitHub\\Casinobabe\\scripts\\botwow_modules.py';
const PY = process.env.BOTWOW_MODULES_PY || DEFAULT_PY;

function pass(name, detail = '') {
  console.log(`PASS ${name}${detail ? ' — ' + detail : ''}`);
}
function fail(name, detail = '') {
  console.log(`FAIL ${name}${detail ? ' — ' + detail : ''}`);
  process.exitCode = 1;
}

if (!existsSync(PY)) {
  console.log(`SKIP modules-parity — registre Python absent (${PY}). Définir BOTWOW_MODULES_PY.`);
  process.exit(0);
}

let py = 'python';
try {
  execFileSync('python', ['--version'], { stdio: 'ignore' });
} catch {
  py = 'py';
  try {
    execFileSync('py', ['--version'], { stdio: 'ignore' });
  } catch {
    console.log('SKIP modules-parity — aucun interpréteur Python disponible.');
    process.exit(0);
  }
}

// 1) le registre Python génère exactement les octets du JSON du site
// (via --export vers un fichier temporaire : stdout subirait la traduction
// CRLF de la console Windows, ce qui n'est pas ce que le site consomme)
const TMP = join(REPO, 'tests', '.modules-regen.tmp.json');
try {
  execFileSync(py, [PY, '--export', TMP], {
    cwd: REPO,
    env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
  });
  const regen = readFileSync(TMP, 'utf8');
  if (!existsSync(JSON_PATH)) {
    fail('modules.json présent sur le site', JSON_PATH);
  } else {
    const onDisk = readFileSync(JSON_PATH, 'utf8');
    /* Comparaison insensible aux fins de ligne : sur Windows, git
       convertit LF -> CRLF au checkout (core.autocrlf), si bien que le
       meme fichier commite differedait en octets. Le contenu reste
       compare octet par octet. */
    const norm = (s) => s.replace(/\r\n/g, '\n');
    if (norm(regen) === norm(onDisk)) {
      pass('parité registre Python ↔ assets/modules.json (octets)');
    } else {
      fail('parité registre Python ↔ assets/modules.json',
        'régénérer : python "' + PY + '" --export assets/modules.json');
    }
  }
} catch (e) {
  fail('registre: exécution du générateur', String(e.message).slice(0, 200));
} finally {
  try {
    rmSync(TMP);
  } catch {}
}

// 2) JSON structurellement valide + statuts légaux
try {
  const rec = JSON.parse(readFileSync(JSON_PATH, 'utf8'));
  const legal = new Set(['available', 'development', 'planned']);
  const bad = rec.modules.filter((m) => !legal.has(m.status));
  if (bad.length === 0) pass('modules.json: statuts légaux', `${rec.modules.length} modules`);
  else fail('modules.json: statuts légaux', bad.map((m) => m.id).join(','));

  const ids = rec.modules.map((m) => m.id);
  if (new Set(ids).size === ids.length) pass('modules.json: ids uniques', ids.join(','));
  else fail('modules.json: ids uniques');

  const planned = rec.modules.filter((m) => m.status === 'planned');
  if (planned.every((m) => !m.shipped.en.length && !m.shipped.fr.length)) {
    pass('modules.json: planned sans contenu livré', planned.map((m) => m.id).join(','));
  } else {
    fail('modules.json: un module "planned" revendique du contenu livré');
  }

  // 3) version du registre == version.txt du site
  if (existsSync(VERSION_PATH)) {
    const siteVersion = readFileSync(VERSION_PATH, 'utf8').trim();
    if (rec.version === siteVersion) pass('version registre = version.txt', siteVersion);
    else fail('version registre ≠ version.txt', `registre=${rec.version} site=${siteVersion}`);
  } else {
    fail('version.txt présent', VERSION_PATH);
  }
} catch (e) {
  fail('modules.json: parse', String(e.message).slice(0, 200));
}

if (process.exitCode) {
  console.log('---- modules-parity: ÉCHEC ----');
} else {
  console.log('---- modules-parity: OK ----');
}
