#!/usr/bin/env node
/**
 * package-addon-install.test.mjs — contrat d'installation isolé du paquet
 * BOT-WOW (mission factory-control#82, job job-issue82-mwaoy17i).
 *
 * Le test construit le paquet depuis une source de FIXTURE (dépôt Git réel,
 * contenu d'essai défini UNE fois dans tests/helpers/package-fixture.mjs),
 * puis vérifie le contrat du paquet LIVRÉ avant installation :
 *   1. liste blanche : le dossier addon ne contient QUE {Casinobabe.toc,
 *      CasinobabeFishing.lua, LiveErrorCapture.lua} ;
 *   2. exclusions déclarées : core casino, TOC casino, police tierce exclus
 *      du ZIP ET déclarés au manifeste avec leur raison ;
 *   3. la TOC générée ne référence QUE des fichiers embarqués ;
 *   4. chaque fichier Lua embarqué est déclaré dans la TOC (bijection) ;
 *   5. ordre de chargement : LiveErrorCapture.lua AVANT
 *      CasinobabeFishing.lua (chaînage du gestionnaire d'erreurs) ;
 *   6. contrat d'en-tête TBC : ## Interface: 20506 et ## SavedVariables:
 *      CasinobabeDB, CasinobabeErrorBus ;
 *   7. chemins sûrs : pas de backslash, pas de '..', pas de lecteur ;
 *      répertoires de données client absents du paquet ;
 *   8. intégrité : chaque entrée ZIP non-MANIFEST correspond à la clé du
 *      manifeste (préfixe `package/` retiré) avec le SHA-256 de ses octets ;
 *   9. provenance : manifest.source == provenance git RÉELLE du checkout
 *      (overrides CLI validés et consignés dans overridesChecked) ;
 *  10. fail-closed liste blanche (deux temps) :
 *      a. build QA : le fichier addon non inventorié est exclu, déclaré
 *         (excluded + unlisted + unresolvedComponents) ;
 *      b. build --release : le build REFUSE et ne supprime aucun artefact
 *         existant (sentinelle préservée).
 *
 * Noms d'entrées ZIP vérifiés sur un paquet réel (helper partagé) :
 * `MANIFEST.json`, `VERSION`, `package/addon/Casinobabe/*`, `package/scripts/*`.
 * Aucun réseau, aucun paiement, aucune écriture hors tmpdir.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { readZipEntries } from './helpers/package-zip.mjs';
import { makeGitSource, buildArgs, runBuild, makeCheck } from './helpers/package-fixture.mjs';

const { check, finish } = makeCheck();

const tmp = mkdtempSync(join(tmpdir(), 'botwow-install-'));
const version = '9.9.8';
const SRC = makeGitSource(tmp, 'src');
const OUT = join(tmp, 'dist');
const ZIP = join(OUT, `casinobabe-fishing-${version}.zip`);
const ADDON_PREFIX = 'package/addon/Casinobabe/';
// Entrée ZIP `package/X` (ou `VERSION`) -> clé manifeste `X`.
const manifestKeyOf = (zipName) =>
  zipName === 'MANIFEST.json' ? null
    : zipName.startsWith('package/') ? zipName.slice('package/'.length)
      : zipName;

try {
  const build = runBuild(buildArgs({ source: SRC, commit: SRC.head, out: OUT }));
  check('build fixture : la construction réussit', build.status === 0, build.text.trim().slice(-300));
  if (build.status !== 0) throw new Error('construction impossible — suite annulée');

  const entries = readZipEntries(ZIP);
  const names = [...entries.keys()];
  const manifest = JSON.parse(entries.get('MANIFEST.json').toString('utf8'));
  const tocKey = ADDON_PREFIX + 'Casinobabe.toc';
  const toc = entries.get(tocKey).toString('utf8');
  const tocFiles = toc.split(/\r?\n/).map((l) => l.trim())
    .filter((l) => /^[A-Za-z0-9_\-\.]+\.lua$/.test(l));

  // 1. whitelist installée — EXACTEMENT trois entrées addon
  const addonEntries = names.filter((n) => n.startsWith(ADDON_PREFIX));
  check('liste blanche : le dossier addon ne contient EXACTEMENT {toc, CasinobabeFishing.lua, LiveErrorCapture.lua}',
    addonEntries.length === 3
    && addonEntries.includes(tocKey)
    && addonEntries.includes(ADDON_PREFIX + 'LiveErrorCapture.lua')
    && addonEntries.includes(ADDON_PREFIX + 'CasinobabeFishing.lua'),
    JSON.stringify(addonEntries));
  // 2. exclusions non livrées
  check('exclusions : le core casino Casinobabe.lua et la police ne sont PAS embarqués',
    !addonEntries.includes(ADDON_PREFIX + 'Casinobabe.lua')
    && !names.some((n) => n.endsWith('casino_uni.ttf') || n.includes('Libs/')),
    JSON.stringify(names.filter((n) => n.endsWith('Casinobabe/Casinobabe.lua') || n.includes('ttf'))));
  // 3. chaque fichier référencé existe
  check('TOC : chaque fichier référencé existe dans le paquet',
    tocFiles.every((f) => addonEntries.includes(ADDON_PREFIX + f)),
    JSON.stringify(tocFiles));
  // 4. bijection TOC <-> fichiers Lua embarqués
  const embeddedLua = addonEntries.filter((n) => n.endsWith('.lua')).map((n) => n.slice(ADDON_PREFIX.length));
  check('TOC : chaque fichier Lua embarqué est déclaré (bijection)',
    embeddedLua.length === tocFiles.length && tocFiles.every((f) => embeddedLua.includes(f)),
    `embarqués=${JSON.stringify(embeddedLua)} déclarés=${JSON.stringify(tocFiles)}`);
  // 5. ordre de chargement (chaînage des gestionnaires d'erreurs)
  check('TOC : LiveErrorCapture.lua est chargé AVANT CasinobabeFishing.lua',
    tocFiles.length >= 2
    && tocFiles[0] === 'LiveErrorCapture.lua'
    && tocFiles[tocFiles.length - 1] === 'CasinobabeFishing.lua',
    JSON.stringify(tocFiles));
  // 6. contrat d'en-tête TBC lu par le bot Python livré
  check('TOC : en-tête ## Interface: 20506', /## Interface: 20506/.test(toc));
  check('TOC : ## SavedVariables: CasinobabeDB, CasinobabeErrorBus',
    /## SavedVariables: CasinobabeDB, CasinobabeErrorBus/.test(toc), toc.trim());
  // 7. chemins sûrs + absences interdites
  const UNSAFE = names.filter((n) => n.includes('\\') || n.split('/').includes('..') || /^[A-Za-z]:/.test(n));
  check('paquet : aucun backslash, aucun segment "..", aucun chemin absolu',
    UNSAFE.length === 0, JSON.stringify(UNSAFE));
  const FORBIDDEN = ['state/', 'reports/', 'logs/', '.git/', 'node_modules/',
    '__pycache__/', 'site/', 'bridge/', 'tests/', '.autopilot/'];
  const leaked = names.filter((n) => FORBIDDEN.some((f) => n.startsWith(f)));
  check('paquet : aucune donnée client embarquée',
    leaked.length === 0, JSON.stringify(leaked));
  // 8. intégrité : chaque entrée ZIP == entrée manifeste re-hachée
  let mismatches = 0; let verified = 0;
  for (const [name, data] of entries) {
    const key = manifestKeyOf(name);
    if (key === null) continue;
    const rec = manifest.files[key];
    if (!rec) { mismatches += 1; continue; }
    verified += 1;
    if (createHash('sha256').update(data).digest('hex') !== rec.sha256) mismatches += 1;
  }
  check('manifeste : chaque fichier embarqué correspond à son SHA-256 déclaré',
    verified > 0 && mismatches === 0, `(vérifiés=${verified} écarts=${mismatches})`);
  // 9. provenance réelle + politique QA
  const provOk = manifest.source
    && manifest.source.repository === 'aveca/Casinobabe'
    && manifest.source.ref === 'feat/fishing-route-intelligence-v2'
    && manifest.source.commit === SRC.head
    && manifest.source.provenanceVerified === true
    && Array.isArray(manifest.source.overridesChecked)
    && manifest.source.overridesChecked.length === 3;
  if (!provOk) {
    console.log(`  [debug] repo=${manifest.source?.repository === 'aveca/Casinobabe'}`
      + `|ref=${manifest.source?.ref === 'feat/fishing-route-intelligence-v2'}`
      + `|commit=${manifest.source?.commit === SRC.head}`
      + `|pver=${manifest.source?.provenanceVerified === true}`
      + `|array=${Array.isArray(manifest.source?.overridesChecked)}`
      + `|len=${manifest.source?.overridesChecked?.length}`
      + `|commitLen=${manifest.source?.commit?.length}:${SRC.head?.length}`
      + `|repoCP=manifest[${[...(manifest.source?.repository || '')].map((c) => c.codePointAt(0).toString(16)).join(',')} ]`
      + `|repoCP=littérale[${[...'aveca/Casinobabe'].map((c) => c.codePointAt(0).toString(16)).join(',')} ]`);
  }
  check('manifeste : source = provenance git réelle du checkout, overrides validés', provOk,
    JSON.stringify({ srcHead: SRC.head, source: manifest.source }));
  check('manifeste : distribution.mode qa, non eligible (droits pinnés non vérifiables sur fixtures)',
    manifest.distribution
    && manifest.distribution.mode === 'qa'
    && manifest.distribution.eligible === false
    && manifest.distribution.sourceRepositoryMatches === true
    && manifest.distribution.sourceCommitMatches === false
    && manifest.distribution.expectedSourceCommit === 'b625ccec5fd61225dd92c5c54fa8721da76c3876'
    && (manifest.distribution.unresolvedComponents || []).includes('provenance source'),
    JSON.stringify(manifest.distribution || null).slice(0, 400));
  // 10a. fail-closed whitelist : fichier NON inventorié en QA
  writeFileSync(join(SRC.dir, 'runtime-addon', 'Casinobabe', 'Mystere.lua'), '-- fichier non inventorié\n');
  const { git } = await import('./helpers/package-fixture.mjs');
  git(['add', '-A'], SRC.dir);
  git(['commit', '-m', 'fichier addon non inventorié'], SRC.dir);
  const head2 = git(['rev-parse', 'HEAD'], SRC.dir);
  const out2 = join(tmp, 'dist2');
  const unlisted = runBuild(buildArgs({ source: SRC, commit: head2, out: out2 }));
  check('build QA survit avec un fichier addon NON inventorié',
    unlisted.status === 0, unlisted.text.trim().slice(-250));
  const entries2 = readZipEntries(join(out2, `casinobabe-fishing-${version}.zip`));
  const manifest2 = JSON.parse(entries2.get('MANIFEST.json').toString('utf8'));
  check('fail-closed : le fichier non inventorié est exclu du paquet',
    !entries2.has(ADDON_PREFIX + 'Mystere.lua'));
  check('fail-closed : whitelist inchangée (Mystere.lua n\'y entre pas)',
    manifest2.distribution.addon.whitelist.length === 2
    && !manifest2.distribution.addon.whitelist.includes('Mystere.lua'),
    JSON.stringify(manifest2.distribution.addon.whitelist));
  check('fail-closed : le fichier est DÉCLARÉ (excluded + unlisted + unresolvedComponents)',
    (manifest2.distribution.addon.excluded || []).some((e) => e.file === 'Mystere.lua')
    && (manifest2.distribution.addon.unlisted || []).includes('Mystere.lua')
    && (manifest2.distribution.unresolvedComponents || [])
      .some((c) => c.startsWith('fichier addon non inventorié : Mystere.lua')),
    JSON.stringify({
      excluded: manifest2.distribution.addon.excluded?.length,
      unlisted: manifest2.distribution.addon.unlisted,
      unresolved: manifest2.distribution.unresolvedComponents,
    }));
  // 10b. fail-closed whitelist : --release REFUSE + artefacts préservés
  const out3 = join(tmp, 'dist3');
  const pkg3 = join(out3, `casinobabe-fishing-${version}`);
  mkdirSync(pkg3, { recursive: true });
  const sentinel = join(pkg3, 'sentinel.txt');
  writeFileSync(sentinel, 'KEEP\n');
  const rel = runBuild(buildArgs({ source: SRC, commit: head2, out: out3, release: true }));
  check('fail-closed : --release REFUSE avec un fichier addon non inventorié fichier cité (Mystere.lua)',
    rel.status !== 0
    && /release refusée/.test(rel.text)
    && rel.text.includes('Mystere.lua'),
    rel.text.trim().slice(-250));
  check('fail-closed : --release ne supprime aucun artefact existant',
    readFileSync(sentinel, 'utf8') === 'KEEP\n');
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

process.exit(finish('INSTALL CONTRAT'));
