#!/usr/bin/env node
/**
 * canonical-package-digest.test.mjs — l'empreinte canonique d'un paquet est
 * stable, et l'integrite du MANIFEST.json est verifiee.
 *
 * Deterministe : aucun reseau, aucune ecriture hors dossier temporaire.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const TOOL = join(REPO, 'scripts', 'canonical-package-digest.mjs');

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
}

/**
 * L'outil sort en code 1 quand l'integrite est rompue : on capture donc
 * stdout ET le code de sortie, sans lever d'exception.
 */
function runTool(dir, args = ['--json']) {
  const res = spawnSync(process.execPath, [TOOL, dir, ...args], { encoding: 'utf8' });
  let json = null;
  if (args.includes('--json')) {
    try { json = JSON.parse(res.stdout || ''); } catch (_) { json = null; }
  }
  return { status: res.status, stdout: res.stdout || '', stderr: res.stderr || '', json };
}

const tmp = mkdtempSync(join(tmpdir(), 'botwow-canon-'));
try {
  const A = join(tmp, 'a');
  const B = join(tmp, 'b');
  mkdirSync(join(A, 'scripts'), { recursive: true });
  writeFileSync(join(A, 'VERSION'), '1.2.0\n');
  writeFileSync(join(A, 'scripts', 'fishing_bot.py'), 'print("bot")\n');
  writeFileSync(join(A, 'scripts', 'fishing_observer.py'), 'print("obs")\n');
  const sha = (rel) => createHash('sha256').update(readFileSync(join(A, rel))).digest('hex');
  writeFileSync(join(A, 'MANIFEST.json'), JSON.stringify({
    name: 'casinobabe-fishing',
    version: '1.2.0',
    files: {
      'VERSION': { sha256: sha('VERSION'), bytes: 6 },
      'scripts/fishing_bot.py': { sha256: sha('scripts/fishing_bot.py'), bytes: 13 },
      'scripts/fishing_observer.py': { sha256: sha('scripts/fishing_observer.py'), bytes: 13 },
    },
  }, null, 2) + '\n');

  const runA = runTool(A);
  const outA = runA.json;
  check('sortie JSON exploitable', !!outA, runA.stderr);
  check('treeDigest present', /^[0-9a-f]{64}$/.test(outA.treeDigest), outA.treeDigest);
  check('fichiers comptes', outA.files === 4, String(outA.files));
  check('octets comptes', outA.bytes > 0, String(outA.bytes));
  check('manifest detecte', outA.manifestPresent === true && outA.manifestFiles === 3);
  check('aucun ecart d\'integrite', outA.mismatches.length === 0, outA.mismatches.join(', '));
  check('aucun fichier declare manquant', outA.missing.length === 0, outA.missing.join(', '));
  check('aucun fichier hors manifeste', outA.undeclared.length === 0, outA.undeclared.join(', '));
  check('MANIFEST.json n\'est pas signale hors manifeste', !outA.undeclared.includes('MANIFEST.json'), outA.undeclared.join(', '));
  check('code de sortie 0 quand tout est intact', runA.status === 0, String(runA.status));

  // Copie byte-identique, chemin different => meme empreinte.
  cpSync(A, B, { recursive: true });
  const runB = runTool(B);
  check('meme contenu, chemin different => meme treeDigest', outA.treeDigest === runB.json.treeDigest);
  check('meme contenu => meme nombre de fichiers', outA.files === runB.json.files);

  // Un octet modifie => empreinte differente + ecart d'integrite.
  writeFileSync(join(B, 'scripts', 'fishing_bot.py'), 'print("BOT")\n');
  const runC = runTool(B);
  check('contenu modifie => treeDigest different', outA.treeDigest !== runC.json.treeDigest);
  check('contenu modifie => ecart d\'integrite detecte', runC.json.mismatches.includes('scripts/fishing_bot.py'), runC.json.mismatches.join(', '));
  check('code de sortie 1 quand l\'integrite est rompue', runC.status === 1, String(runC.status));

  // Un fichier present mais absent du manifeste est signale (sans erreur).
  writeFileSync(join(B, 'scripts', 'extra.ps1'), 'x\n');
  const runD = runTool(B);
  check('fichier hors manifeste signale', runD.json.undeclared.includes('scripts/extra.ps1'), runD.json.undeclared.join(', '));

  // Un fichier declare mais absent du paquet est signale comme manquant.
  const C = join(tmp, 'c');
  cpSync(A, C, { recursive: true });
  rmSync(join(C, 'scripts', 'fishing_observer.py'));
  const runE = runTool(C);
  check('fichier declare absent du paquet signale', runE.json.missing.includes('scripts/fishing_observer.py'), runE.json.missing.join(', '));
  check('code de sortie 1 quand un fichier declare manque', runE.status === 1, String(runE.status));

  // Sortie texte : les mesures doivent etre lisibles.
  const runText = runTool(A, []);
  check('sortie texte : treeDigest', /treeDigest\s+:\s+[0-9a-f]{64}/.test(runText.stdout), runText.stdout);
  check('sortie texte : integrite ok', /integrite\s+:\s+ok/.test(runText.stdout), runText.stdout);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log('');
console.log(failures === 0 ? 'CANONICAL DIGEST : OK' : `CANONICAL DIGEST : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
