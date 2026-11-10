#!/usr/bin/env node
/** Vérifie le verrou de release sur le seul inventaire du candidat courant.
 * Les statuts historiques des anciennes archives R2 ne doivent pas bloquer
 * le candidat, mais les conditions client et une provenance non prouvée bloquent. */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const BUILDER = join(REPO, 'scripts', 'build-package.cjs');
const tmp = mkdtempSync(join(tmpdir(), 'botwow-release-gate-'));
let failures = 0;
const check = (name, ok, detail = '') => {
  console.log(`  ${ok ? 'ok' : 'FAIL'} ${name}${ok ? '' : ` — ${detail}`}`);
  if (!ok) failures++;
};

function seedSource(dir) {
  mkdirSync(join(dir, 'runtime-addon', 'Casinobabe'), { recursive: true });
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  writeFileSync(join(dir, 'runtime-addon', 'Casinababe', 'Casinababe.toc'), '## Interface: 20506\n');
  writeFileSync(join(dir, 'runtime-addon', 'Casinababe', 'Casinababe.lua'), '-- fixture\n');
  writeFileSync(join(dir, 'scripts', 'fishing_bot.py'), 'print("fixture")\n');
}

function run(args) {
  const result = spawnSync(process.execPath, [BUILDER, ...args], { encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout || '', stderr: result.stderr || '' };
}

try {
  const source = join(tmp, 'source');
  seedSource(source);

  const qaOut = join(tmp, 'qa');
  const qa = run(['--source', source, '--version', '0.0.1', '--out', qaOut]);
  check('le build QA reste possible pour validation interne', qa.status === 0,
    (qa.stderr || qa.stdout).slice(-500));

  if (qa.status === 0) {
    const manifestPath = join(qaOut, 'casinobabe-fishing-0.0.1', 'MANIFEST.json');
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
    const unresolved = manifest.distribution?.unresolvedComponents || [];
    check('le manifeste marque explicitement le build comme QA',
      manifest.distribution?.mode === 'qa');
    check('le manifeste interdit la distribution tant que les conditions client sont ouvertes',
      manifest.distribution?.eligible === false && unresolved.includes('Code original Casinobabe'),
      JSON.stringify(manifest.distribution));
    check('la provenance non Git du fixture reste explicitement bloquante',
      unresolved.includes('provenance source') && manifest.distribution?.sourceCommitMatches === false);
    check('les composants historiques exclus ne sont pas comptés comme dépendances du candidat',
      !unresolved.includes('LibStub / LibDBIcon-1.0 / background.tga'));
    check('le commit source de référence est conservé dans le manifeste',
      manifest.distribution?.expectedSourceCommit === 'b625ccec5fd61225dd92c5c54fa8721da76c3876');
  }

  const releaseOut = join(tmp, 'release');
  const releasePackageDir = join(releaseOut, 'casinobabe-fishing-0.0.1');
  const releaseZip = join(releaseOut, 'casinobabe-fishing-0.0.1.zip');
  mkdirSync(releasePackageDir, { recursive: true });
  writeFileSync(join(releasePackageDir, 'sentinel.txt'), 'KEEP PACKAGE\n');
  writeFileSync(releaseZip, 'KEEP ZIP\n');

  const release = run(['--source', source, '--version', '0.0.1', '--out', releaseOut, '--release']);
  const output = release.stdout + '\n' + release.stderr;
  check('le build release échoue sur les droits client non finalisés',
    release.status !== 0 && /release refusée/.test(output) && /Code original Casinobabe/.test(output),
    output.slice(-500));
  check('le refus de release ne supprime ni ne remplace un artefact existant',
    readFileSync(join(releasePackageDir, 'sentinel.txt'), 'utf8') === 'KEEP PACKAGE\n'
      && readFileSync(releaseZip, 'utf8') === 'KEEP ZIP\n');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log(failures === 0 ? 'PACKAGE RELEASE RIGHTS GATE : OK' : `PACKAGE RELEASE RIGHTS GATE : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
