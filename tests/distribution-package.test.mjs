#!/usr/bin/env node
/**
 * distribution-package.test.mjs — verifie que le paquet distribuable est
 * complet, integre et qu'il ne contient AUCUNE donnee de session client.
 *
 * Le test construit un paquet depuis une source de FAKE (mini-jarbier) : il ne
 * depend pas du depot de developpement et ne publie rien.
 *
 * AJOUT 2026-11-08 (issue #151 / mission #144) — garde-fous d'integrite :
 * la source de test est un VRAI depot Git, pour que la provenance CLI puisse
 * etre confrontee au checkout reel. Tests negatifs ajoutes :
 *   - lien symbolique fichier / repertoire / cible exterieure a la source ;
 *   - provenance falsifiee (depot, ref, commit) ou non falsifiable ;
 *   - override VALIDE (prefixe court du HEAD reel) accepte.
 * Une source non Git ne peut plus certifier une provenance fournie par CLI.
 */
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const BUILD = join(REPO, 'scripts', 'build-package.cjs');
const DIGEST_TOOL = join(REPO, 'scripts', 'canonical-package-digest.mjs');

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
}

function readZipEntries(zipPath) {
  const zip = readFileSync(zipPath);
  const entries = new Map();
  let offset = 0;
  while (offset + 30 <= zip.length && zip.readUInt32LE(offset) === 0x04034b50) {
    const method = zip.readUInt16LE(offset + 8);
    const compressedSize = zip.readUInt32LE(offset + 18);
    const uncompressedSize = zip.readUInt32LE(offset + 22);
    const nameLength = zip.readUInt16LE(offset + 26);
    const extraLength = zip.readUInt16LE(offset + 28);
    const nameStart = offset + 30;
    const name = zip.toString('utf8', nameStart, nameStart + nameLength);
    const dataStart = nameStart + nameLength + extraLength;
    const compressed = zip.subarray(dataStart, dataStart + compressedSize);
    const data = method === 0 ? Buffer.from(compressed)
      : method === 8 ? inflateRawSync(compressed)
        : (() => { throw new Error('ZIP compression method unsupported: ' + method); })();
    if (data.length !== uncompressedSize) throw new Error('ZIP entry size mismatch: ' + name);
    entries.set(name, data);
    offset = dataStart + compressedSize;
  }
  return entries;
}

function git(args, cwd) {
  return execFileSync('git', args, {
    cwd, encoding: 'utf8', timeout: 20000, windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      GIT_AUTHOR_NAME: 'test', GIT_AUTHOR_EMAIL: 'test@example.invalid',
      GIT_COMMITTER_NAME: 'test', GIT_COMMITTER_EMAIL: 'test@example.invalid',
    },
  }).trim();
}

/** Mini-jarbier de test : addon + bot, plus des donnees client a exclure. */
function seedSource(dir) {
  mkdirSync(join(dir, 'runtime-addon', 'Casinobabe'), { recursive: true });
  mkdirSync(join(dir, 'scripts'), { recursive: true });
  mkdirSync(join(dir, 'state'), { recursive: true });
  writeFileSync(join(dir, 'runtime-addon', 'Casinobabe', 'Casinobabe.toc'), '## Interface: 20506\nCasinobabe.lua\n');
  writeFileSync(join(dir, 'runtime-addon', 'Casinobabe', 'Casinobabe.lua'), '-- addon\n');
  writeFileSync(join(dir, 'scripts', 'fishing_bot.py'), 'print("bot")\n');
  writeFileSync(join(dir, 'scripts', 'fishing_observer.py'), 'print("obs")\n');
  writeFileSync(join(dir, 'state', 'fishing-bot.pid'), '12345\n');
  writeFileSync(join(dir, 'state', 'mem-actions.jsonl'), '{"secret":1}\n');
  mkdirSync(join(dir, 'reports'), { recursive: true });
  writeFileSync(join(dir, 'reports', 'fishing-bot-log.jsonl'), '{"leak":true}\n');
}

/**
 * Source de test en depot Git REEL : provenance verifiable.
 * Retourne { dir, head, branch }.
 */
function makeGitSource(tmp, name) {
  const dir = join(tmp, name);
  seedSource(dir);
  git(['init', '-b', 'feat/fishing-route-intelligence-v2'], dir);
  git(['remote', 'add', 'origin', 'https://github.com/aveca/Casinobabe.git'], dir);
  git(['add', '-A'], dir);
  git(['commit', '-m', 'source de test'], dir);
  return { dir, head: git(['rev-parse', 'HEAD'], dir), branch: 'feat/fishing-route-intelligence-v2' };
}

const tmp = mkdtempSync(join(tmpdir(), 'botwow-pkg-'));
const SRC = makeGitSource(tmp, 'src');
const OUT = join(tmp, 'dist');
const buildEnv = { ...process.env, SOURCE_DATE_EPOCH: '1794009600' }; // 2026-11-07T00:00:00Z

/** Build synchrone qui rend {status, stdout, stderr} sans lever d'exception. */
function runBuild(args) {
  const r = spawnSync(process.execPath, [BUILD, ...args], { encoding: 'utf8', env: buildEnv });
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

/**
 * Remplace la valeur d'une option deja presente, ou l'ajoute.
 * INDISPENSABLE : `arg()` du builder retient la PREMIERE occurrence d'un
 * drapeau. Ajouter un second `--source-commit` en fin de liste serait
 * silencieusement ignore, et un test de provenance falsifiee passerait au
 * vert sans rien tester.
 */
function withArg(args, flag, value) {
  const out = [...args];
  const i = out.indexOf(`--${flag}`);
  if (i >= 0) { out[i + 1] = value; return out; }
  out.push(`--${flag}`, value);
  return out;
}

/** Verifie qu'un build ECHOUE et que le message contient `pattern`. */
function expectBuildFailure(name, args, pattern) {
  const r = runBuild(args);
  const text = r.stdout + '\n' + r.stderr;
  const ok = r.status !== 0 && r.status !== null
    && (!pattern || pattern.test(text));
  check(name, ok, `(exit ${r.status}) ${text.trim().slice(-200)}`);
  return r;
}

const baseArgs = [
  '--source', SRC.dir, '--version', '9.9.9',
  '--source-repo', 'aveca/Casinobabe',
  '--source-ref', SRC.branch,
  '--source-commit', SRC.head,
];

try {
  // ── 1. BUILD VALIDE (source git reelle, provenance falsifiable) ──────────
  const first = runBuild([...baseArgs, '--out', OUT]);
  check('le build reussi sur la source de test', first.status === 0, first.stderr.trim().slice(0, 300));
  console.log(first.stdout.trim().split('\n').map((l) => '    ' + l).join('\n'));

  const pkgDir = join(OUT, 'casinobabe-fishing-9.9.9');
  check('le dossier du paquet existe', existsSync(pkgDir));
  check('l\'archive zip est produite', existsSync(join(OUT, 'casinobabe-fishing-9.9.9.zip')));
  check('le fichier VERSION est present', existsSync(join(pkgDir, 'VERSION')));

  const manifest = JSON.parse(readFileSync(join(pkgDir, 'MANIFEST.json'), 'utf8'));
  check('le manifeste porte la version', manifest.version === '9.9.9');
  check('le manifeste liste des fichiers', Object.keys(manifest.files).length >= 3);

  // integrite : le sha256 du manifeste correspond au fichier livre.
  let integrityOk = true;
  for (const [rel, info] of Object.entries(manifest.files)) {
    const inPackage = join(pkgDir, 'package', rel);
    const atRoot = join(pkgDir, rel);
    const p = existsSync(inPackage) ? inPackage : atRoot;
    if (!existsSync(p)) { integrityOk = false; break; }
    const h = createHash('sha256').update(readFileSync(p)).digest('hex');
    if (h !== info.sha256) { integrityOk = false; break; }
  }
  check('tous les sha256 du manifeste correspondent aux fichiers livres', integrityOk);

  // aucune donnee client
  const staged = [];
  (function walk(d, base = d) {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const full = join(d, e.name);
      if (e.isDirectory()) walk(full, base);
      else staged.push(full.slice(base.length + 1).replace(/\\/g, '/'));
    }
  })(join(pkgDir, 'package'));
  check('aucun fichier de session dans le paquet',
    !staged.some((f) => /(^|\/)(state|reports|logs)\//.test(f) || /mem-.*\.jsonl$/.test(f)),
    staged.filter((f) => /state|reports|mem-/.test(f)).join(', '));

  check('l\'addon est livre', staged.some((f) => f.endsWith('Casinobabe.toc')));
  check('le bot est livre', staged.some((f) => f.endsWith('fishing_bot.py')));

  // Installation depuis le ZIP réellement produit, dans un faux dossier WoW isolé.
  const zipEntries = readZipEntries(join(OUT, 'casinobabe-fishing-9.9.9.zip'));
  const fakeWow = join(tmp, 'fake-wow');
  const installedAddon = join(fakeWow, 'Interface', 'AddOns', 'Casinobabe');
  const addonPrefix = 'package/addon/Casinobabe/';
  for (const [entryName, bytes] of zipEntries) {
    if (!entryName.startsWith(addonPrefix)) continue;
    const relative = entryName.slice(addonPrefix.length);
    if (!relative || relative.split('/').includes('..') || relative.startsWith('/')) {
      throw new Error('Chemin addon dangereux dans le ZIP : ' + entryName);
    }
    const target = join(installedAddon, ...relative.split('/'));
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
  }
  const tocPath = join(installedAddon, 'Casinobabe.toc');
  const toc = readFileSync(tocPath, 'utf8');
  const tocEntries = toc.split(/\\r?\\n/).map((line) => line.trim())
    .filter((line) => line && !line.startsWith('#'));
  check('installation simulée : le ZIP contient des fichiers addon', [...zipEntries.keys()].some((name) => name.startsWith(addonPrefix)));
  check('installation simulée : le dossier AddOns/Casinobabe est créé', existsSync(installedAddon));
  check('installation simulée : le manifeste WoW .toc est présent', existsSync(tocPath));
  check('activation simulée : chaque fichier déclaré par le .toc existe',
    tocEntries.every((entry) => existsSync(join(installedAddon, entry))),
    tocEntries.filter((entry) => !existsSync(join(installedAddon, entry))).join(', '));
  check('activation simulée : le .toc référence au moins un fichier Lua',
    tocEntries.some((entry) => entry.toLowerCase().endsWith('.lua')), tocEntries.join(', '));
  check('la documentation d\'installation est livree', staged.includes('INSTALL.md'));
  check('le gabarit de configuration est livre', staged.includes('config.example.json'));

  // ── Provenance : confrontee au checkout reel, et marquee comme telle ────
  check('le manifeste porte la provenance de la source', !!manifest.source, JSON.stringify(manifest.source));
  check('le manifeste porte le commit source reel', manifest.source?.commit === SRC.head, String(manifest.source?.commit));
  check('le manifeste porte le depot source', manifest.source?.repository === 'aveca/Casinobabe');
  check('le manifeste porte la ref source', manifest.source?.ref === SRC.branch);
  check('la provenance est marquee verifiee contre le checkout reel',
    manifest.source?.provenanceVerified === true, JSON.stringify(manifest.source));
  check(
    'builtAt est deterministe (SOURCE_DATE_EPOCH)',
    manifest.builtAt === '2026-11-07T00:00:00.000Z',
    String(manifest.builtAt),
  );
  check(
    'les cles du manifeste sont triees',
    JSON.stringify(Object.keys(manifest.files)) === JSON.stringify([...Object.keys(manifest.files)].sort()),
  );

  // ── 2. REPRODUCTIBILITE ────────────────────────────────────────────────
  const OUT2 = join(tmp, 'dist2');
  const second = runBuild([...baseArgs, '--out', OUT2]);
  check('le second build reussi', second.status === 0, second.stderr.trim().slice(0, 200));
  const zip1 = readFileSync(join(OUT, 'casinobabe-fishing-9.9.9.zip'));
  const zip2 = readFileSync(join(OUT2, 'casinobabe-fishing-9.9.9.zip'));
  const sha1 = createHash('sha256').update(zip1).digest('hex');
  const sha2 = createHash('sha256').update(zip2).digest('hex');
  check('deux builds du meme source donnent le meme SHA-256', sha1 === sha2, `${sha1} != ${sha2}`);
  check('les deux archives sont identiques octet pour octet', zip1.equals(zip2));
  console.log(`    sha256 reproductible : ${sha1}`);

  // ── 3. EMPREINTE CANONIQUE ─────────────────────────────────────────────
  const digestOf = (dir) => JSON.parse(execFileSync(
    process.execPath, [DIGEST_TOOL, dir, '--json'], { encoding: 'utf8' },
  ));
  const d1 = digestOf(pkgDir);
  const d2 = digestOf(join(OUT2, 'casinobabe-fishing-9.9.9'));
  check('l\'integrite du paquet est ETABLIE (fail-closed)', d1.integrityEstablished === true,
    JSON.stringify({ m: d1.mismatches, u: d1.undeclared, x: d1.missing, e: d1.manifestError }));
  check('aucun fichier declare ne manque dans le paquet', d1.missing.length === 0, d1.missing.join(', '));
  check('aucun fichier livre n\'est hors manifeste', d1.undeclared.length === 0, d1.undeclared.join(', '));
  check('les deux builds ont la meme empreinte canonique', d1.treeDigest === d2.treeDigest, `${d1.treeDigest} != ${d2.treeDigest}`);
  console.log(`    treeDigest canonique : ${d1.treeDigest}`);

  // ── 4. INVARIANCE CRLF / LF ────────────────────────────────────────────
  // Meme contenu, memes provenance, seules les fins de ligne changent : la
  // source CRLF est donc aussi un depot git (provenance falsifiable), sinon
  // le manifeste differe par sa provenance et non par ses fins de ligne.
  const SRC_CRLF = join(tmp, 'src-crlf');
  mkdirSync(join(SRC_CRLF, 'runtime-addon', 'Casinobabe'), { recursive: true });
  mkdirSync(join(SRC_CRLF, 'scripts'), { recursive: true });
  writeFileSync(join(SRC_CRLF, 'runtime-addon', 'Casinobabe', 'Casinobabe.toc'), '## Interface: 20506\r\n');
  writeFileSync(join(SRC_CRLF, 'runtime-addon', 'Casinobabe', 'Casinobabe.lua'), '-- addon\r\n');
  writeFileSync(join(SRC_CRLF, 'scripts', 'fishing_bot.py'), 'print("bot")\r\n');
  writeFileSync(join(SRC_CRLF, 'scripts', 'fishing_observer.py'), 'print("obs")\r\n');
  git(['init', '-b', SRC.branch], SRC_CRLF);
  git(['remote', 'add', 'origin', 'https://github.com/aveca/Casinobabe.git'], SRC_CRLF);
  git(['add', '-A'], SRC_CRLF);
  git(['commit', '-m', 'version CRLF'], SRC_CRLF);
  const crlfHead = git(['rev-parse', 'HEAD'], SRC_CRLF);
  const OUT3 = join(tmp, 'dist3');
  // Le commit local differe (autre depot) : on aligne la provenance sur le
  // HEAD reel de la source CRLF. builtAt reste fixe (SOURCE_DATE_EPOCH).
  const crlfArgs = withArg(withArg(
    baseArgs.map((a) => (a === SRC.dir ? SRC_CRLF : a === SRC.head ? crlfHead : a)),
    'source-commit', crlfHead,
  ), 'out', OUT3);
  const crlfBuild = runBuild(crlfArgs);
  check('la source CRLF en depot git se construit', crlfBuild.status === 0, crlfBuild.stderr.trim().slice(0, 300));

  // L'invariant n'est PAS « meme ZIP » : les deux sources sont deux commits
  // Git distincts, donc leur manifeste porte un `source.commit` different (le
  // ZIP doit d'ailleurs differer). L'invariant verifiable est que le CONTENU
  // LIVRE est normalise en LF des la copie : les octets livres sont alors
  // identiques quel que soit le `core.autocrlf` du poste.
  const pkgCrlf = join(OUT3, 'casinobabe-fishing-9.9.9');
  for (const rel of ['package/scripts/fishing_bot.py', 'package/scripts/fishing_observer.py',
    'package/addon/Casinobabe/Casinobabe.toc', 'package/addon/Casinobabe/Casinobabe.lua']) {
    const a = readFileSync(join(pkgDir, rel));
    const b = readFileSync(join(pkgCrlf, rel));
    check(`fins de ligne normalisees : ${rel}`, a.equals(b), `${a.length} vs ${b.length} octets`);
  }
  check('aucun CRLF ne subsiste dans le contenu livre',
    !readFileSync(join(pkgCrlf, 'package', 'scripts', 'fishing_bot.py')).includes(0x0d));
  const mCrlf = JSON.parse(readFileSync(join(pkgCrlf, 'MANIFEST.json'), 'utf8'));
  check('le manifeste CRLF declare la meme politique de fins de ligne',
    mCrlf.files['scripts/fishing_bot.py'].eol === manifest.files['scripts/fishing_bot.py'].eol,
    `${mCrlf.files['scripts/fishing_bot.py'].eol} vs ${manifest.files['scripts/fishing_bot.py'].eol}`);


  // ── 5. TESTS NEGATIFS : LIENS SYMBOLIQUES ──────────────────────────────
  {
    // (a) lien symbolique FICHIER dans la source : le contenu pointe ne doit
    //     JAMAIS entrer dans le paquet.
    const s = makeGitSource(tmp, 'src-link-file');
    writeFileSync(join(tmp, 'externe.txt'), 'contenu hors de la source\n');
    symlinkSync(join(tmp, 'externe.txt'), join(s.dir, 'runtime-addon', 'Casinobabe', 'Evil.lua'), 'file');
    expectBuildFailure(
      'lien symbolique fichier refuse (build echoue)',
      [...baseArgs.map((a) => (a === SRC.dir ? s.dir : a === SRC.head ? s.head : a)), '--out', join(tmp, 'd-link-file')],
      /lien symbolique/i,
    );

    // (b) lien symbolique REPERTOIRE : il ne doit pas etre parcouru.
    const s2 = makeGitSource(tmp, 'src-link-dir');
    mkdirSync(join(tmp, 'externe-dir'), { recursive: true });
    writeFileSync(join(tmp, 'externe-dir', 'secret.lua'), 'secret\n');
    symlinkSync(join(tmp, 'externe-dir'), join(s2.dir, 'runtime-addon', 'Casinobabe', 'Linked'), 'dir');
    expectBuildFailure(
      'lien symbolique repertoire refuse (build echoue)',
      [...baseArgs.map((a) => (a === SRC.dir ? s2.dir : a === SRC.head ? s2.head : a)), '--out', join(tmp, 'd-link-dir')],
      /lien symbolique/i,
    );

    // (c) cible EXTERIEURE a SOURCE (fichier regululier hors lignee) : le
    // (c) cible EXTERIEURE a SOURCE : le controle de realpath doit refuser
    //     tout ce qui sort de la racine autorisee, et surtout AUCUNE archive
    //     ne doit etre produite quand l'integrite echoue.
    const s3 = makeGitSource(tmp, 'src-outside');
    const outside = join(tmp, 'dehors');
    mkdirSync(outside, { recursive: true });
    writeFileSync(join(outside, 'fishing_bot.py'), 'print("exterieur")\n');
    symlinkSync(join(outside, 'fishing_bot.py'),
      join(s3.dir, 'runtime-addon', 'Casinobabe', 'fishing_bot.py'), 'file');
    const outOutside = join(tmp, 'd-outside');
    expectBuildFailure(
      'lien vers une cible exterieure refuse (build echoue)',
      [...baseArgs.map((a) => (a === SRC.dir ? s3.dir : a === SRC.head ? s3.head : a)),
       '--out', outOutside],
      /lien symbolique|hors de la source/i,
    );
    check('aucune archive produite apres un refus d integrite',
      !existsSync(join(outOutside, 'casinobabe-fishing-9.9.9.zip')),
      'le zip existe malgre le refus');
  }

  // === 6. TESTS NEGATIFS : PROVENANCE FALSIFIABLE ===
  {
    expectBuildFailure(
      'commit source falsifie refuse',
      withArg(withArg(baseArgs, 'source-commit', 'deadbeefdeadbeefdeadbeefdeadbeefdeadbeef'),
        'out', join(tmp, 'd-fake-commit')),
      /ne correspond pas au HEAD reel/i,
    );
    expectBuildFailure(
      'depot source falsifie refuse',
      withArg(withArg(baseArgs, 'source-repo', 'quelquun/autre-depot'),
        'out', join(tmp, 'd-fake-repo')),
      /ne correspond pas a la valeur reelle/i,
    );
    expectBuildFailure(
      'ref source falsifiee refusee',
      withArg(withArg(baseArgs, 'source-ref', 'branche-inexistante'),
        'out', join(tmp, 'd-fake-ref')),
      /ne correspond pas a la valeur reelle/i,
    );

    // Source NON git + override : la provenance ne peut pas etre prouvee.
    const plain = join(tmp, 'src-plain');
    seedSource(plain);
    expectBuildFailure(
      'override de provenance sur une source sans depot git refuse',
      ['--source', plain, '--version', '9.9.9',
        '--source-repo', 'aveca/Casinobabe',
        '--source-ref', 'x', '--source-commit', SRC.head,
        '--out', join(tmp, 'd-nogit')],
      /provenance reelle est illisible/i,
    );

    // Sans depot git ET sans override : le build se fait, la provenance est
    // declaree inconnue (rien n'est certifie).
    const plain2 = join(tmp, 'src-plain2');
    seedSource(plain2);
    const r = runBuild(['--source', plain2, '--version', '9.9.9', '--out', join(tmp, 'd-nogit2')]);
    check('source sans depot git : build accepte, provenance inconnue', r.status === 0, r.stderr.trim().slice(0, 200));
    if (r.status === 0) {
      const m = JSON.parse(readFileSync(join(join(tmp, 'd-nogit2'), 'casinobabe-fishing-9.9.9', 'MANIFEST.json'), 'utf8'));
      check('aucune provenance certifiee sans depot git', m.source == null, JSON.stringify(m.source));
    }

    // Override VALIDE : prefixe court du HEAD reel.
    const ok = runBuild([
      ...baseArgs.map((a) => (a === SRC.head ? SRC.head.slice(0, 12) : a)),
      '--out', join(tmp, 'd-short-sha'),
    ]);
    check('prefixe court du HEAD reel accepte', ok.status === 0, ok.stderr.trim().slice(0, 200));
    if (ok.status === 0) {
      const m = JSON.parse(readFileSync(join(join(tmp, 'd-short-sha'), 'casinobabe-fishing-9.9.9', 'MANIFEST.json'), 'utf8'));
      check('le manifeste porte quand meme le commit complet reel', m.source?.commit === SRC.head, String(m.source?.commit));
      check('la provenance courte est marquee verifiee', m.source?.provenanceVerified === true);
    }
  }
  // ── 7. COMPOSANTS SANS DROITS ÉTABLIS : REFUS FAIL-CLOSED ───────────────
  {
    const restricted = makeGitSource(tmp, 'src-unverified-addon-components');
    mkdirSync(join(restricted.dir, 'runtime-addon', 'Casinobabe', 'Libs', 'LibDBIcon-1.0'), { recursive: true });
    mkdirSync(join(restricted.dir, 'runtime-addon', 'Casinobabe', 'media'), { recursive: true });
    writeFileSync(
      join(restricted.dir, 'runtime-addon', 'Casinobabe', 'Libs', 'LibDBIcon-1.0', 'LibDBIcon-1.0.lua'),
      '-- fixture: adaptation tierce sans licence établie\\n',
    );
    writeFileSync(
      join(restricted.dir, 'runtime-addon', 'Casinobabe', 'media', 'background.tga'),
      Buffer.from('fixture texture sans provenance'),
    );
    git(['add', '-A'], restricted.dir);
    git(['commit', '-m', 'add restricted addon component fixtures'], restricted.dir);
    restricted.head = git(['rev-parse', 'HEAD'], restricted.dir);

    const restrictedOut = join(tmp, 'dist-unverified-components');
    const previousPackageDir = join(restrictedOut, 'casinobabe-fishing-9.9.9');
    mkdirSync(previousPackageDir, { recursive: true });
    writeFileSync(join(previousPackageDir, 'previous-manifest-marker.txt'), 'keep-existing-package');
    const previousArchive = join(restrictedOut, 'casinobabe-fishing-9.9.9.zip');
    writeFileSync(previousArchive, 'keep-existing-archive');
    const restrictedArgs = baseArgs.map((a) => (
      a === SRC.dir ? restricted.dir : a === SRC.head ? restricted.head : a
    ));
    const result = expectBuildFailure(
      'composants non certifiés : le build échoue',
      [...restrictedArgs, '--out', restrictedOut],
      /composants addon non certifiés refusés/i,
    );
    const output = result.stdout + '\\n' + result.stderr;
    check('LibDBIcon-1.0 est explicitement bloqué', output.includes('LibDBIcon-1.0.lua'));
    check('background.tga est explicitement bloqué', output.includes('background.tga'));
    check(
      'aucune archive ZIP n’est produite après le refus juridique',
      !existsSync(join(restrictedOut, 'casinobabe-fishing-9.9.9.zip')),
    );
    check(
      'le préflight conserve le dossier du package précédent',
      existsSync(join(previousPackageDir, 'previous-manifest-marker.txt')),
    );
    check(
      'le préflight conserve les octets de l’archive précédente',
      readFileSync(previousArchive, 'utf8') === 'keep-existing-archive',
    );
  }

} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log('');
console.log(failures === 0 ? 'DISTRIBUTION : OK' : `DISTRIBUTION : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
