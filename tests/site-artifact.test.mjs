#!/usr/bin/env node
/**
 * site-artifact.test.mjs — l'artefact publie ne doit contenir ni code
 * source, ni dependances, ni donnees de deploiement.
 *
 * Contexte : le domaine public a ete expose (worker/index.js,
 * package.json) parce que le projet Cloudflare Pages publiait la racine
 * du depot. Ce test verrouille l'invariant : l'artefact construit par
 * scripts/build-site.mjs ne contient que le site statique, et le build
 * ECHOUE si un fichier interdit y reapparait.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { denied, build, scanForbidden, FILES } from '../scripts/build-site.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
function dirname(p) { return path.dirname(p); }

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
}

console.log('=== ARTEFACT DU SITE (aucune fuite de source) ===');

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'botwow-artifact-'));
const { out } = build(tmp);

// 1. Aucun fichier interdit dans l'artefact
const found = [];
(function walk(dir, rel = '') {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (denied(r)) { found.push(r); continue; }
    if (e.isDirectory()) walk(path.join(dir, e.name), r);
  }
})(out);
check('aucun fichier interdit dans l\'artefact', found.length === 0, `(trouve : ${found.join(', ')})`);

// 2. Les fichiers sensibles ne sont pas distribues
for (const f of ['worker/index.js', 'package.json', 'package-lock.json', 'wrangler.toml',
  'scripts/build-site.mjs', 'tests/payment-flow.test.mjs']) {
  check(`absent de l'artefact : ${f}`, !fs.existsSync(path.join(out, f)));
}

// 3. Les pages publiques sont bien presentes
for (const f of ['index.html', 'compare.html', 'modules.html', 'demo.html', 'features.html',
  'fishing.html', 'faq.html', 'success.html', 'cancel.html', '404.html',
  'robots.txt', 'sitemap.xml', 'version.txt',
  'fr/index.html', 'fr/compare.html', 'fr/modules.html']) {
  check(`present dans l'artefact : ${f}`, fs.existsSync(path.join(out, f)));
}

// 4. Les protections sont conservees
for (const f of ['_headers', '_redirects']) {
  check(`protection conservee : ${f}`, fs.existsSync(path.join(out, f)));
}
const redirects = fs.readFileSync(path.join(out, '_redirects'), 'utf8');
for (const p of ['/worker/*', '/package.json', '/scripts/*', '/tests/*', '/migrations/*']) {
  check(`_redirects couvre ${p}`, redirects.includes(p));
}
const headers = fs.readFileSync(path.join(out, '_headers'), 'utf8');
check('_headers impose no-store sur /worker/*', /\/worker\/\*[\s\S]{0,120}no-store/.test(headers));

// 5. Le garde-fou : (a) un fichier interdit place dans un repertoire publie
//    est filtre a la copie ; (b) le scan final detecte une fuite.
{
  const probe = path.join(REPO, 'assets', '__leak-probe__.mjs');
  fs.writeFileSync(probe, '// probe de securite\n');
  try {
    const probeOut = fs.mkdtempSync(path.join(os.tmpdir(), 'botwow-probe-'));
    const { out: probeSite } = build(probeOut);
    check('un fichier interdit place dans assets/ est filtre a la copie',
      !fs.existsSync(path.join(probeSite, 'assets', '__leak-probe__.mjs')));
    fs.rmSync(probeOut, { recursive: true, force: true });
  } finally {
    fs.rmSync(probe, { force: true });
  }

  // Le scan final doit detecter une fuite introduite apres la copie.
  const leakDir = fs.mkdtempSync(path.join(os.tmpdir(), 'botwow-leak-'));
  fs.mkdirSync(path.join(leakDir, 'worker'), { recursive: true });
  fs.writeFileSync(path.join(leakDir, 'worker', 'index.js'), '// fuite\n');
  fs.writeFileSync(path.join(leakDir, 'package.json'), '{}');
  const detected = scanForbidden(leakDir);
  check('le scan final detecte une fuite sous worker/',
    detected.some((d) => d === 'worker' || d.startsWith('worker/')), `(detecte : ${detected.join(', ')})`);
  check('le scan final detecte un package.json qui aurait fuite',
    detected.some((d) => d === 'package.json'), `(detecte : ${detected.join(', ')})`);
  fs.rmSync(leakDir, { recursive: true, force: true });
}

// 6. Le build est idempotent et reproductible
{
  const out2 = fs.mkdtempSync(path.join(os.tmpdir(), 'botwow-artifact2-'));
  build(out2);
  const a = fs.readdirSync(out).sort().join(',');
  const b = fs.readdirSync(out2).sort().join(',');
  check('deux builds produisent la meme racine', a === b);
  fs.rmSync(out2, { recursive: true, force: true });
}

fs.rmSync(tmp, { recursive: true, force: true });

console.log(failures === 0 ? '\nARTEFACT DU SITE : OK' : `\nARTEFACT DU SITE : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
