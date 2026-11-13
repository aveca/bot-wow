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
check('EN : aucune offre payante, pas de Payment Link',
  /No paid offer/i.test(enHome) && /mailto:support@bot-wow.com/.test(enHome) &&
  !/buy\.stripe\.com/.test(enHome));
check('FR : aucune offre payante, pas de Payment Link',
  /Aucune offre payante/i.test(frHome) && /mailto:support@bot-wow.com/.test(frHome) &&
  !/buy\.stripe\.com/.test(frHome));
check('EN : aucune promesse de livraison immédiate par e-mail',
  !/Immediately by email:\s*download link/i.test(enHome));
check('FR : aucune promesse de livraison immédiate par e-mail',
  !/Immédiatement par e-mail\s*:\s*lien de téléchargement et clé de licence/i.test(frHome));
check('EN : le badge ne présente plus v1.2.0 comme une version disponible',
  !/<b>v1\.2\.0<\/b>\s*current release/i.test(enHome));
check('EN : OG title no longer calls the active reservation a historical project', !/Historical project/.test(enHome));
check('FR : OG title no longer calls the active reservation a historical project', !/Projet historique/.test(frHome));
check('EN : homepage FAQ schema says there is no paid offer', /Can I buy it/.test(enHome) && /No paid offer is open/.test(enHome));
check('FR : homepage FAQ schema says there is no paid offer', /Puis-je l’acheter/.test(frHome) && /Aucune offre payante/.test(frHome));
check('EN : homepage refuses automation under the EULA', /EULA prohibits bots/i.test(enHome));
check('FR : homepage refuses automation under the EULA', /EULA de Blizzard interdit/i.test(frHome));
check('FR : homepage has no obsolete closed-sale answer', !/Aucune offre, aucun paiement/.test(frHome));
check('FR : serveurs privés dans le bandeau ou le corps',
  /serveurs privés/i.test(frHome));

// 3c. Les pages d'achat FR/EN décrivent correctement l'absence de paquet client.
const enBuy = fs.readFileSync(path.join(out, 'buy.html'), 'utf8');
const frBuy = fs.readFileSync(path.join(out, 'fr/buy.html'), 'utf8');
check('EN buy : liste d’attente sans Payment Link',
  /mailto:support@bot-wow.com/.test(enBuy) && /No paid offer/i.test(enBuy) && !/buy\.stripe\.com/.test(enBuy));
check('FR buy : liste d’attente sans Payment Link',
  /mailto:support@bot-wow.com/.test(frBuy) && /Aucune offre payante/i.test(frBuy) && !/buy\.stripe\.com/.test(frBuy));
check('FR buy : pas d’ancien avertissement de fermeture',
  !/n'achetez pas tant que la livraison n'est pas confirmée/i.test(frBuy));


// 3d. FAQ et comparaison doivent refléter l'offre bêta réellement payable.
const enFaq = fs.readFileSync(path.join(out, 'faq.html'), 'utf8');
const frFaq = fs.readFileSync(path.join(out, 'fr/faq.html'), 'utf8');
const enCompare = fs.readFileSync(path.join(out, 'compare.html'), 'utf8');
const frCompare = fs.readFileSync(path.join(out, 'fr/compare.html'), 'utf8');
check('EN FAQ : pas d’offre payante', /No paid offer/i.test(enFaq) && !/buy\.stripe\.com/.test(enFaq));
check('FR FAQ : pas d’offre payante', /Aucune offre payante/i.test(frFaq) && !/buy\.stripe\.com/.test(frFaq));
check('EN FAQ : aucun message de fermeture du checkout', !/No current sale is offered|checkout is closed|do not send payment/i.test(enFaq));
check('FR FAQ : aucun message de fermeture du checkout', !/Aucune vente actuelle n'est proposée|checkout est fermé|N'envoyez aucun paiement/i.test(frFaq));
check('EN comparaison : pas de vente Stripe', /No paid offer is open/.test(enCompare) && /Join the waitlist/.test(enCompare) && !/buy\.stripe\.com/.test(enCompare));
check('FR comparaison : pas de vente Stripe', /Aucune offre payante/.test(frCompare) && /liste d’attente/i.test(frCompare) && !/buy\.stripe\.com/.test(frCompare));
check('EN comparaison : aucun checkout fermé ou ancien prix cible', !/Checkout closed|No payment form is available|historical target only|No current sale/i.test(enCompare));
check('FR comparaison : aucun paiement fermé ou ancien prix cible', !/Paiement fermé|Aucun formulaire de paiement n'est disponible|ancien prix cible|Aucune vente actuelle/i.test(frCompare));

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
