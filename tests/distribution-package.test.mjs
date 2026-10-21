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
try {
  const out = execFileSync('node', [
    join(REPO, 'scripts', 'build-package.cjs'),
    '--source', SRC, '--version', '9.9.9', '--out', OUT,
  ], { encoding: 'utf8' });
  console.log(out.trim().split('\n').map((l) => '    ' + l).join('\n'));

  const pkgDir = join(OUT, 'casinobabe-fishing-9.9.9');
  check('le dossier du paquet existe', existsSync(pkgDir));
  check('l\'archive zip est produite', existsSync(join(OUT, 'casinobabe-fishing-9.9.9.zip')));
  check('le fichier VERSION est present', existsSync(join(pkgDir, 'VERSION')));

  const manifest = JSON.parse(readFileSync(join(pkgDir, 'MANIFEST.json'), 'utf8'));
  check('le manifeste porte la version', manifest.version === '9.9.9');
  check('le manifeste liste des fichiers', Object.keys(manifest.files).length >= 3);

  // integrite : le sha256 du manifeste correspond au fichier livre
  let integrityOk = true;
  for (const [rel, info] of Object.entries(manifest.files)) {
    const p = join(pkgDir, 'package', rel);
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
} finally {
  rmSync(tmp, { recursive: true, force: true });
}

console.log('');
console.log(failures === 0 ? 'DISTRIBUTION : OK' : `DISTRIBUTION : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
