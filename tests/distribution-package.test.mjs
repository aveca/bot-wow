#!/usr/bin/env node
/**
 * distribution-package.test.mjs — verifie que le paquet distribuable est
 * complet, integre et qu'il ne contient AUCUNE donnee de session client.
 *
 * Le test construit un paquet depuis une source de FAKE (mini-jarbier) : il ne
 * depend pas du depot de developpement et ne publie rien.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
}

// --- source de test ---------------------------------------------------------
const tmp = mkdtempSync(join(tmpdir(), 'botwow-pkg-'));
const SRC = join(tmp, 'src');
mkdirSync(join(SRC, 'runtime-addon', 'Casinobabe'), { recursive: true });
mkdirSync(join(SRC, 'scripts'), { recursive: true });
mkdirSync(join(SRC, 'state'), { recursive: true });
writeFileSync(join(SRC, 'runtime-addon', 'Casinobabe', 'Casinobabe.toc'), '## Interface: 20506\n');
writeFileSync(join(SRC, 'runtime-addon', 'Casinobabe', 'Casinobabe.lua'), '-- addon\n');
writeFileSync(join(SRC, 'scripts', 'fishing_bot.py'), 'print("bot")\n');
writeFileSync(join(SRC, 'scripts', 'fishing_observer.py'), 'print("obs")\n');
// donnees client qui ne doivent JAMAIS etre empaquetees
writeFileSync(join(SRC, 'state', 'fishing-bot.pid'), '12345\n');
writeFileSync(join(SRC, 'state', 'mem-actions.jsonl'), '{"secret":1}\n');
mkdirSync(join(SRC, 'reports'), { recursive: true });
writeFileSync(join(SRC, 'reports', 'fishing-bot-log.jsonl'), '{"leak":true}\n');

const OUT = join(tmp, 'dist');
const buildArgs = [
  join(REPO, 'scripts', 'build-package.cjs'),
  '--source', SRC, '--version', '9.9.9',
  '--source-repo', 'aveca/Casinobabe',
  '--source-ref', 'feat/fishing-route-intelligence-v2',
  '--source-commit', '0123456789abcdef0123456789abcdef01234567',
];
const buildEnv = { ...process.env, SOURCE_DATE_EPOCH: '1794009600' }; // 2026-11-07T00:00:00Z
try {
  const out = execFileSync('node', [...buildArgs, '--out', OUT], { encoding: 'utf8', env: buildEnv });
  console.log(out.trim().split('\n').map((l) => '    ' + l).join('\n'));

  const pkgDir = join(OUT, 'casinobabe-fishing-9.9.9');
  check('le dossier du paquet existe', existsSync(pkgDir));
  check('l\'archive zip est produite', existsSync(join(OUT, 'casinobabe-fishing-9.9.9.zip')));
  check('le fichier VERSION est present', existsSync(join(pkgDir, 'VERSION')));

  const manifest = JSON.parse(readFileSync(join(pkgDir, 'MANIFEST.json'), 'utf8'));
  check('le manifeste porte la version', manifest.version === '9.9.9');
  check('le manifeste liste des fichiers', Object.keys(manifest.files).length >= 3);

  // integrite : le sha256 du manifeste correspond au fichier livre.
  // Les cles du manifeste sont relatives au CONTENU (`package/...`), sauf les
  // fichiers generes a la racine du paquet (VERSION, RELEASE-NOTES.md).
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

  // l'addon et le bot sont bien la
  check('l\'addon est livre', staged.some((f) => f.endsWith('Casinobabe.toc')));
  check('le bot est livre', staged.some((f) => f.endsWith('fishing_bot.py')));
  check('la documentation d\'installation est livree', staged.includes('INSTALL.md'));
  check('le gabarit de configuration est livre', staged.includes('config.example.json'));

  // ── Provenance dans le manifeste ─────────────────────────────────────────
  check('le manifeste porte la provenance de la source', !!manifest.source, JSON.stringify(manifest.source));
  check('le manifeste porte le commit source', manifest.source?.commit === '0123456789abcdef0123456789abcdef01234567', JSON.stringify(manifest.source));
  check('le manifeste porte le depot source', manifest.source?.repository === 'aveca/Casinobabe');
  check('le manifeste porte la ref source', manifest.source?.ref === 'feat/fishing-route-intelligence-v2');
  check(
    'builtAt est deterministe (SOURCE_DATE_EPOCH)',
    manifest.builtAt === '2026-11-07T00:00:00.000Z',
    String(manifest.builtAt),
  );
  check(
    'les cles du manifeste sont triees',
    JSON.stringify(Object.keys(manifest.files)) === JSON.stringify([...Object.keys(manifest.files)].sort()),
  );

  // ── REPRODUCTIBILITE : deux builds du meme source = meme SHA-256 ─────────
  const OUT2 = join(tmp, 'dist2');
  execFileSync('node', [...buildArgs, '--out', OUT2], { encoding: 'utf8', env: buildEnv });
  const zip1 = readFileSync(join(OUT, 'casinobabe-fishing-9.9.9.zip'));
  const zip2 = readFileSync(join(OUT2, 'casinobabe-fishing-9.9.9.zip'));
  const sha1 = createHash('sha256').update(zip1).digest('hex');
  const sha2 = createHash('sha256').update(zip2).digest('hex');
  check('deux builds du meme source donnent le meme SHA-256', sha1 === sha2, `${sha1} != ${sha2}`);
  check('les deux archives sont identiques octet pour octet', zip1.equals(zip2));
  console.log(`    sha256 reproductible : ${sha1}`);

  // ── EMPREINTE CANONIQUE (identite du CONTENU, pas du ZIP) ───────────────
  const DIGEST_TOOL = join(REPO, 'scripts', 'canonical-package-digest.mjs');
  const digestOf = (dir) => JSON.parse(execFileSync(
    process.execPath,
    [DIGEST_TOOL, dir, '--json'],
    { encoding: 'utf8' },
  ));
  const d1 = digestOf(pkgDir);
  const d2 = digestOf(join(OUT2, 'casinobabe-fishing-9.9.9'));
  check('le paquet construit est integre (MANIFEST.json)', d1.mismatches.length === 0, d1.mismatches.join(', '));
  check('aucun fichier declare ne manque dans le paquet', d1.missing.length === 0, d1.missing.join(', '));
  check('aucun fichier livre n\'est hors manifeste', d1.undeclared.length === 0, d1.undeclared.join(', '));
  check('les deux builds ont la meme empreinte canonique', d1.treeDigest === d2.treeDigest, `${d1.treeDigest} != ${d2.treeDigest}`);
  console.log(`    treeDigest canonique : ${d1.treeDigest}`);

  // ── Le checkout NE DOIT PAS changer le SHA-256 (CRLF vs LF) ──────────────
  const SRC_CRLF = join(tmp, 'src-crlf');
  mkdirSync(join(SRC_CRLF, 'runtime-addon', 'Casinobabe'), { recursive: true });
  mkdirSync(join(SRC_CRLF, 'scripts'), { recursive: true });
  writeFileSync(join(SRC_CRLF, 'runtime-addon', 'Casinobabe', 'Casinobabe.toc'), '## Interface: 20506\r\n');
  writeFileSync(join(SRC_CRLF, 'runtime-addon', 'Casinobabe', 'Casinobabe.lua'), '-- addon\r\n');
  writeFileSync(join(SRC_CRLF, 'scripts', 'fishing_bot.py'), 'print("bot")\r\n');
  writeFileSync(join(SRC_CRLF, 'scripts', 'fishing_observer.py'), 'print("obs")\r\n');
  const OUT3 = join(tmp, 'dist3');
  execFileSync('node', [
    ...buildArgs.map((a) => (a === SRC ? SRC_CRLF : a)),
    '--out', OUT3,
  ], { encoding: 'utf8', env: buildEnv });
  const zip3 = readFileSync(join(OUT3, 'casinobabe-fishing-9.9.9.zip'));
  const sha3 = createHash('sha256').update(zip3).digest('hex');
  check('un checkout CRLF donne le meme SHA-256 qu\'un checkout LF', sha3 === sha1, `${sha3} != ${sha1}`);
  console.log(`    sha256 checkout CRLF : ${sha3}`);
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log('');
console.log(failures === 0 ? 'DISTRIBUTION : OK' : `DISTRIBUTION : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
