#!/usr/bin/env node
/**
 * third-party-notices-shipped.test.mjs — le paquet LIVRE les notices
 * d'attribution qu'il doit livrer.
 *
 * PROBLEME DEMONTRE : le builder déterministe copiait l'addon, les scripts et
 * INSTALL.md, mais PAS les notices d'attribution. Or le paquet embarque la
 * police DejaVu Sans, dont la licence (Bitstream Vera + Arev) impose que
 * « l'avis de copyright et la permission soient inclus dans toutes les
 * copies ». Distribuer l'archive sans ce document violerait la licence, et
 * aucun client ne pourrait vérifier la conformité.
 *
 * CE QUE CE TEST VERIFIE (aucun réseau, aucun upload) :
 *   1. le paquet construit CONTIENT THIRD_PARTY_NOTICES.md ;
 *   2. ce fichier est DÉCLARÉ au manifeste avec un hash et une taille justes ;
 *   3. le build ÉCHOUE si le document d'attribution est absent ;
 *   4. chaque composant tiers embarqué est nommé dans le document livré.
 */
import { spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync, readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const BUILD = join(REPO, 'scripts', 'build-package.cjs');

let failures = 0;
const check = (name, ok, detail = '') => {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
};

/* Source de test minimale mais réaliste : addon + scripts.
   Modele du vrai depot source : l'unique fichier addon livre l'interface
   casino, mais la LISTE BLANCHE BOT-WOW ne garde que le module de peche. */
function makeSource(dir) {
  mkdirSync(join(dir, 'runtime-addon', 'Casinobabe'), { recursive: true });
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  writeFileSync(join(dir, 'runtime-addon', 'Casinobabe', 'Casinobabe.toc'), '## Interface: 20506\n');
  writeFileSync(join(dir, 'runtime-addon', 'Casinobabe', 'Casinobabe.lua'), '-- addon\n');
  // Liste blanche BOT-WOW : les deux seuls fichiers addon livres.
  writeFileSync(join(dir, 'runtime-addon', 'Casinobabe', 'LiveErrorCapture.lua'), '-- addon\n');
  writeFileSync(join(dir, 'runtime-addon', 'Casinobabe', 'CasinobabeFishing.lua'), '-- addon\n');
  writeFileSync(join(dir, 'scripts', 'fishing_bot.py'), 'print("bot")\n');
  writeFileSync(join(dir, 'scripts', 'fishing_observer.py'), 'print("obs")\n');
}

function runBuild(builder, args) {
  const r = spawnSync(process.execPath, [builder, ...args], { encoding: 'utf8' });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

const tmp = mkdtempSync(join(tmpdir(), 'botwow-notices-'));
try {
  const src = join(tmp, 'src');
  makeSource(src);

  /* --- 1. le paquet contient le document d'attribution ------------------ */
  const out = join(tmp, 'out');
  const build = runBuild(BUILD, ['--source', src, '--version', '9.9.9', '--out', out]);
  check('le build reussit quand les notices sont presentes', build.status === 0,
    build.stderr.trim().slice(0, 200));

  const pkgDir = join(out, 'casinobabe-fishing-9.9.9');
  const stageNotices = join(pkgDir, 'package', 'THIRD_PARTY_NOTICES.md');
  check('le paquet LIVRE THIRD_PARTY_NOTICES.md', existsSync(stageNotices));

  if (existsSync(stageNotices)) {
    /* --- 2. il est declaré au manifeste, hash et taille justes ---------- */
    const manifest = JSON.parse(readFileSync(join(pkgDir, 'MANIFEST.json'), 'utf8'));
    const entry = manifest.files['THIRD_PARTY_NOTICES.md'];
    check('THIRD_PARTY_NOTICES.md est declare au manifeste', !!entry, JSON.stringify(Object.keys(manifest.files)));
    if (entry) {
      const buf = readFileSync(stageNotices);
      const h = createHash('sha256').update(buf).digest('hex');
      check('le hash declare correspond au fichier livre', entry.sha256 === h, `${entry.sha256} != ${h}`);
      check('la taille declaree correspond au fichier livre', entry.bytes === buf.length, `${entry.bytes} != ${buf.length}`);
      check('le fichier est marque eol LF', entry.eol === 'LF');
      check('la source du fichier est documentee',
        /THIRD_PARTY_NOTICES\.md$/.test(String(entry.source || '')), String(entry.source));
    }

    /* --- 4. chaque composant tiers concerne est traite ------------------ */
    /* 2026-11-10 : la liste blanche du addon n'embarque PLUS de composant
       tiers (DejaVu Sans, LibStub, LibDBIcon-1.0, background.tga sont exclus).
       Le document livre doit malgre tout nommer chaque composant qu'il
       mentionne et dire lequel est embarque, exclu, ou seulement declare :
       un lecteur doit pouvoir verifier la conformite sans autre source. */
    const text = readFileSync(stageNotices, 'utf8');
    for (const comp of [
      'wasmoon-lua5.1',         // dependance declaree
      'lodash',                 // dependance transitive
    ]) {
      check(`le document livre nomme ${comp}`, text.includes(comp));
    }
    for (const comp of [
      'DejaVu Sans',            // media/casino_uni.ttf
      'LibStub',                // Libs/LibStub/LibStub.lua
      'LibDBIcon-1.0',          // Libs/LibDBIcon-1.0/LibDBIcon-1.0.lua
      'background.tga',         // media/background.tga
    ]) {
      check(`le document livre nomme ${comp} et declare sa non-livraison`,
        text.includes(comp) && /liste blanche/i.test(text));
    }
    /* Le texte de licence doit etre dans le document LIVRE, pas seulement
       dans le depot : c'est l'obligation. */
    check('le document livre contient l avis de copyright de la police',
      /Bitstream/i.test(text) && /Tavmjong Bah/i.test(text));
    check('le document livre interdit la redistribution des non-etablis',
      /Ne pas redistribuer/.test(text));
  }

  /* --- 3. le build ECHOUE sans le document ------------------------------ */
  /* On reproduit un depot BOT-WOW incomplet : copie du builder + d'une
     source, SANS distribution/THIRD_PARTY_NOTICES.md. */
  const fakeRoot = join(tmp, 'fake-root');
  mkdirSync(join(fakeRoot, 'scripts'), { recursive: true });
  mkdirSync(join(fakeRoot, 'distribution'), { recursive: true });
  mkdirSync(join(fakeRoot, 'tests', 'helpers'), { recursive: true });
  const builderSrc = readFileSync(BUILD, 'utf8');
  writeFileSync(join(fakeRoot, 'scripts', 'build-package.cjs'), builderSrc);
  /* INSTALL.md et requirements.txt présents, mais PAS les notices : le build doit refuser. */
  writeFileSync(join(fakeRoot, 'distribution', 'INSTALL.md'), '# install\n');
  writeFileSync(join(fakeRoot, 'distribution', 'requirements.txt'), 'numpy>=1.26,<3\n');
  const src2 = join(tmp, 'src2');
  makeSource(src2);
  const noNotices = runBuild(
    join(fakeRoot, 'scripts', 'build-package.cjs'),
    ['--source', src2, '--version', '9.9.9', '--out', join(tmp, 'out2')],
  );
  check('le build ECHOUE sans le document d attribution',
    noNotices.status !== 0 && noNotices.status !== null,
    `(exit ${noNotices.status}) ${noNotices.stderr.slice(0, 120)}`);
  check('le message d echec nomme le fichier manquant',
    /THIRD_PARTY_NOTICES\.md/.test(noNotices.stderr + noNotices.stdout));
  check('le message d echec explique pourquoi (composants tiers)',
    /DejaVu|LibDBIcon|LibStub|notices/i.test(noNotices.stderr + noNotices.stdout));
  check('aucun paquet n est produit sans les notices',
    !existsSync(join(tmp, 'out2', 'casinobabe-fishing-9.9.9.zip')));

  /* Le depot réel doit, lui, avoir le document (sinon son build est casse). */
  check('le depot BOT-WOW fournit bien distribution/THIRD_PARTY_NOTICES.md',
    existsSync(join(REPO, 'distribution', 'THIRD_PARTY_NOTICES.md')));
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log('');
console.log(failures === 0 ? 'NOTICES LIVREES : OK' : `NOTICES LIVREES : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
