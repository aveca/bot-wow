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

// 3b. La disponibilité du paquet doit être annoncée honnêtement avant l'achat.
const enHome = fs.readFileSync(path.join(out, 'index.html'), 'utf8');
const frHome = fs.readFileSync(path.join(out, 'fr/index.html'), 'utf8');
check('EN : la homepage expose le statut du projet et retire les comparaisons commerciales non vérifiées',
  /<section class="pad" id="project-scope">/.test(enHome) &&
  !/<section class="pad compare(?:-section)?" id="compare">/.test(enHome));
check('FR : la homepage expose le statut du projet et retire les comparaisons commerciales non vérifiées',
  /<section class="pad" id="project-scope">/.test(frHome) &&
  !/<section class="pad compare(?:-section)?" id="compare">/.test(frHome));
const enNoticeAt = enHome.indexOf('id="release-availability-notice"');
const frNoticeAt = frHome.indexOf('id="release-availability-notice"');
check('EN : avertissement de disponibilité présent et formulaire d\'achat absent',
  enNoticeAt >= 0 &&
  !/id="buyForm"|id="buyBtn"|id="email"|type="email"/i.test(enHome) &&
  /do not purchase until delivery is confirmed/i.test(enHome));
check('FR : avertissement de disponibilité présent et formulaire d\'achat absent',
  frNoticeAt >= 0 &&
  !/id="buyForm"|id="buyBtn"|id="email"|type="email"/i.test(frHome) &&
  /N’achetez pas : aucune livraison n’est actuellement proposée\./i.test(frHome));
check('EN : aucune promesse de livraison immédiate par e-mail',
  !/Immediately by email:\s*download link/i.test(enHome));
check('FR : aucune promesse de livraison immédiate par e-mail',
  !/Immédiatement par e-mail\s*:\s*lien de téléchargement et clé de licence/i.test(frHome));
check('EN : le badge ne présente plus v1.2.0 comme une version disponible',
  !/<b>v1\.2\.0<\/b>\s*current release/i.test(enHome));
check('FR : le badge distingue l’archive historique et la livraison non vérifiée',
  /<b>v1\.2\.0<\/b>\s*archive historique · livraison non vérifiée/i.test(frHome));
check('FR : l’avertissement ne suggère pas une livraison future',
  /N’achetez pas : aucune livraison n’est actuellement proposée\./i.test(frHome));
check('FR : ancien avertissement ambigu supprimé',
  !/n'achetez pas tant que la livraison n'est pas confirmée/i.test(frHome));
 
// 3c. Les pages d'achat FR/EN décrivent correctement l'absence de paquet client.
const enBuy = fs.readFileSync(path.join(out, 'buy.html'), 'utf8');
const frBuy = fs.readFileSync(path.join(out, 'fr/buy.html'), 'utf8');
check('EN buy : statut du paquet client grammatical et indisponible',
  /<b>No current client package<\/b> is verified or available/.test(enBuy) &&
  !/No release<\/b> client package not verified/i.test(enBuy));
check('FR buy : statut du paquet client grammatical et indisponible',
  /<b>Aucun paquet client actuel<\/b> n’est disponible ni vérifié/.test(frBuy) &&
  !/Aucune release<\/b> paquet client non vérifié/i.test(frBuy));
check('FR buy : avertissement de non-livraison explicite et cohérent',
  /N’achetez pas : aucune livraison n’est actuellement proposée\./.test(frBuy) &&
  !/n'achetez pas tant que la livraison n'est pas confirmée/i.test(frBuy));


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
