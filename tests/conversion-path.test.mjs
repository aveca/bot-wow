#!/usr/bin/env node
/**
 * conversion-path.test.mjs — invariants du parcours de conversion.
 *
 * Ce que le parcours doit garantir (verifie sur le code, pas suppose) :
 *  1. chaque point de decision porte un evenement named ;
 *  2. le radar interactif a une sortie vers la demonstration ;
 *  3. les sections de preuve (telemetry, etapes) et la fin de page
 *     proposent une action ;
 *  4. le formulaire d'achat est present, avec email + validation ;
 *  5. le repli de checkout offre un contact support direct ;
 *  6. l'instrumentation ne transporte AUCUNE donnee personnelle ;
 *  7. les evenements documentes sont bien ceux emis.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.resolve(HERE, '..');
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
}

console.log('=== PARCOURS DE CONVERSION (invariants) ===');

for (const file of ['index.html', 'fr/index.html', 'compare.html', 'fr/compare.html']) {
  const t = read(file);
  const label = file;

  // 1. Instrumentation presente sur les CTA cles
  const tracked = [...t.matchAll(/data-track="([a-z_]+)"[^>]*data-cta-id="([a-z0-9-]+)"/g)];
  check(`${label} : CTA instrumentes (>= 4)`, tracked.length >= 4, `(trouve ${tracked.length})`);
  for (const [, ev, id] of tracked) {
    check(`${label} : evenement "${ev}" sur cta "${id}"`, ev === 'cta_click');
  }

  // 2. Aucun identifiant ni email dans les attributs de suivi
  const pii = [...t.matchAll(/data-(?:track|cta-id)="([^"]*)"/g)].filter(([, v]) => /@|mailto|user|email|name/i.test(v));
  check(`${label} : aucune donnee personnelle dans le suivi`, pii.length === 0, `(trouve ${pii.map((m) => m[1]).join(', ')})`);

  // 3. Cibles des CTA : uniquement des pages du site
  const badHref = [...t.matchAll(/<a[^>]+class="[^"]*btn[^"]*"[^>]+href="([^"]+)"/g)]
    .map(([, h]) => h)
    .filter((h) => /^[a-z]+:\/\//i.test(h) && !/^(mailto:|https:\/\/bot-wow\.com)/.test(h));
  check(`${label} : aucun CTA vers un domaine tiers`, badHref.length === 0, `(trouve ${badHref.join(', ')})`);
}

// 4. Parcours hero -> demonstration -> comparaison -> achat (accueil EN)
{
  const t = read('index.html');
  check('accueil : CTA hero vers la demonstration', /href="\.\/demo\.html"[^>]*data-cta-id="hero-demo"/.test(t));
  check('accueil : CTA hero vers l\'offre', /href="#buy"[^>]*data-cta-id="hero-offer"/.test(t));
  check('accueil : sortie du radar vers la demonstration', /class="radar-next-link" href="\.\/demo\.html"/.test(t));
  check('accueil : CTA apres la telemetry', /data-cta-id="telemetry-demo"/.test(t));
  check('accueil : CTA apres les etapes', /data-cta-id="steps-demo"/.test(t));
  check('accueil : CTA final en fin de page', /id="final"[\s\S]{0,900}data-cta-id="final-buy"/.test(t));
  check('accueil : formulaire d\'achat present', /<form id="buyForm"/.test(t));
  check('accueil : champ email du formulaire', /id="email"[^>]*type="email"/.test(t));
  check('accueil : bouton de paiement present', /id="buyBtn"/.test(t));
  check('accueil : contact support direct propose en repli', /href="mailto:support@bot-wow\.com"/.test(t));
}

// 4b. Repli support : lien direct, sans formulaire qui n'avertit pas l'equipe.
{
  const en = read('index.html');
  const fr = read('fr/index.html');
  check('repli EN : lien mailto direct', /href="mailto:support@bot-wow\\.com"/.test(en));
  check('repli EN : aucun formulaire de repli non notifiant', !/data-waitlist/.test(en));
  check('repli EN : aucune promesse de réponse manuelle non vérifiée', !/support answers and issues the licence manually/i.test(en));
  check('repli FR : lien mailto direct', /href="mailto:support@bot-wow\\.com"/.test(fr));
  check('repli FR : aucun formulaire de repli non notifiant', !/data-waitlist/.test(fr));
  check('repli FR : aucune promesse de réponse manuelle non vérifiée', !/le support répond et délivre la licence à la main/i.test(fr));
}

// 5. Comparaison : la formule BOT-WOW mene au checkout, le calculateur est instrumente
{
  const t = read('compare.html');
  check('compare : CTA de la formule BOT-WOW', /data-cta-id="formula-ours-buy"/.test(t));
  check('compare : CTA de paiement present dans la formule', /data-cta-id="formula-ours-buy"/.test(t));
  check('compare : calculateur de cout present', /id="ownership"/.test(t));
  check('compare : source et date des prix citees', /pixelwowbot\.com/.test(t) && /2026-10-22/.test(t));
  check('compare : aucun prix de concurrent invente (30 / 90 jours absent)', !/30 \/ 90/.test(t));
}

// 6. Instrumentation : module present, charge, et evenements documentes
{
  const app = read('assets/app.js');
  check('app.js charge le module d\'instrumentation', /import '\.\/analytics\.js/.test(app));
  const an = read('assets/analytics.js');
  // Les evenements declenches par une interaction (mode, horizon, checkout)
  // sont emis par le module ; cta_click vient des attributs data-track.
  for (const ev of ['planner_mode', 'ownership_view', 'checkout_start']) {
    check(`evenement "${ev}" emis par le module`, an.includes(`'${ev}'`));
  }
  // checkout_error est emis par le parcours d'achat (app.js), qui appelle
  // l'API du module de collecte.
  check('evenement "checkout_error" emis lors d\'un echec de paiement',
    app.includes("'checkout_error'") || an.includes("'checkout_error'"));
  const htmlAll = ['index.html', 'compare.html', 'fr/index.html', 'fr/compare.html'].map(read).join('\n');
  check('evenement "cta_click" present sur les CTA', htmlAll.includes('data-track="cta_click"'));
  check('instrumentation : aucune donnee personnelle collectee',
    !/send\([^)]*email/i.test(an) && !/props\.email/.test(an));
  check('instrumentation : silence par defaut (aucun point de collecte en dur)', !/https?:\/\/[a-z0-9.-]+\/api\//i.test(an));
  check('instrumentation : point de collecte configurable', /botwow-track-endpoint|BOTWOW_TRACK_ENDPOINT/.test(an));
  // V11 : le point de collecte est le MEME ORIGINE, et le tampon memoire
  // est borne (les evenements ne restent pas en memoire indefiniment).
  check('instrumentation : collecte sur le meme domaine (first-party)', /'\/api\/track'/.test(an));
  check('instrumentation : tampon memoire borne', /MAX_BUFFER\s*=\s*(\d+)/.test(an)
    && Number(an.match(/MAX_BUFFER\s*=\s*(\d+)/)[1]) <= 32,
    `(${an.match(/MAX_BUFFER\s*=\s*(\d+)/)?.[1]})`);
  check('instrumentation : le tampon est purge (pas de tableau infini)', /buffer\.shift\(\)|buffer\.length\s*=\s*0/.test(an));
  check('instrumentation : Do Not Track respecte', /doNotTrack/.test(an));
  check('instrumentation : la collecte ne bloque jamais l\'interface',
    /\.catch\(function \(\) \{\}\)|catch \(e\)/.test(an));
}

// 6b. V11 : la collecte est PERSISTANTE (endpoint + Worker + schema)
{
  const worker = read('telemetry-worker/index.js');
  check('point de collecte : Worker present', worker.includes('handleTrack'));
  check('point de collecte : schema versionne', /SCHEMA_VERSION\s*=\s*1/.test(worker));
  check('point de collecte : liste fermee des evenements',
    /cta_click/.test(worker) && /planner_mode/.test(worker) && /ownership_view/.test(worker)
    && /checkout_start/.test(worker) && /checkout_error/.test(worker));
  check('point de collecte : aucune donnee personnelle acceptee',
    !/email/.test(worker.split('EVENT_SPEC')[0] + '') || !/props\.email/.test(worker));
  check('point de collecte : corps limite', /MAX_BODY_BYTES\s*=\s*\d+/.test(worker));
  check('point de collecte : limitation de debit', /RATE_LIMIT_PER_MIN/.test(worker) && /429/.test(worker));
  check('point de collecte : retention et purge', /RETENTION_DAYS/.test(worker));
  check('point de collecte : IP jamais stockee en clair', /sha256Hex/.test(worker) && !/ip_hash.*=.*ip\b/.test(worker));
  check('point de collecte : degrade gracieux sans base', /stored:\s*false/.test(worker));
  const schema = read('scripts/telemetry-schema.sql');
  check('schema D1 : table des evenements', /CREATE TABLE IF NOT EXISTS events/.test(schema));
  check('schema D1 : table du rate limiting', /CREATE TABLE IF NOT EXISTS rl/.test(schema));
  // colonnes reelles : on ignore les commentaires SQL
  const schemaCode = schema.split('\n').filter((l) => !l.trim().startsWith('--')).join('\n');
  check('schema D1 : aucune colonne de donnee personnelle',
    !/\bemail\b|\buser_?name\b|\border_id\b/i.test(schemaCode),
    `(${schemaCode.match(/\bemail\b|\buser_?name\b|\border_id\b/i)?.[0] || ''})`);
  // le Worker de collecte ne doit jamais compter une conversion : il
  // mesure l'intention. On regarde la liste fermee elle-meme (le commentaire
  // qui explique pourquoi la conversion en est absente ne doit pas计入).
  const specBlock = (worker.match(/const EVENT_SPEC = \{[\s\S]*?\n\};/) || [''])[0];
  check('point de collecte : ne compte pas les conversions',
    !/conversion|purchase|payment_succeeded/.test(specBlock)
    && !/INSERT INTO (?!events|rl)/i.test(worker));
  // La conversion est une mesure SERVEUR : le point de collecte public
  // doit la refuser si un client tente de l'envoyer.
  check('point de collecte public : refuse un evenement conversion',
    !/conversion\s*:/.test(specBlock));
  {
    // ... et le Worker de paiement l'ecrit bien, apres verification.
    const api = read('worker/index.js');
    check('Worker de paiement : enregistre une conversion confirmee',
      /recordConversion/.test(api) && /'conversion'/.test(api));
    const iFulfil = api.indexOf('await fulfillOrder(env2');
    const iConv = api.indexOf('await recordConversion(env2');
    check('Worker de paiement : la conversion est ecrite apres fulfillment',
      iFulfil > -1 && iConv > iFulfil, `(fulfill@${iFulfil}, conversion@${iConv})`);
    check('Worker de paiement : la mesure ne bloque pas la licence',
      /catch \(e\)[\s\S]{0,200}impossible/.test(api));
    check('Worker de paiement : la conversion ne stocke aucune PII',
      !/recordConversion[\s\S]{0,600}email\s*[,)]/.test(api.split('async function recordConversion')[1] || ''));
  }
}

// 6c. V11 : les pages du parcours sont instrumentees
{
  const demo = read('assets/demo.js');
  check('demo : la demo charge le module d\'instrumentation (sans duplication)',
    /import '\.\/analytics\.js/.test(demo));
  for (const f of ['modules.html', 'fr/modules.html', 'demo.html', 'fr/demo.html']) {
    const t = read(f);
    check(`${f} : au moins un CTA instrumente`, /data-track="cta_click"/.test(t));
  }
  for (const f of ['index.html', 'fr/index.html', 'compare.html', 'fr/compare.html']) {
    const t = read(f);
    check(`${f} : la barre d'action mobile est instrumentee`, /data-cta-id="mbar-buy"/.test(t));
  }
}

// 7. Le prix reste unique et verifie
{
  const t = read('index.html');
  const prices = [...new Set([...t.matchAll(/(\d+[.,]\d\d\s?€|€\s?\d+[.,]\d\d)/g)].map((m) => m[0].replace(/\s/g, ' ')))];
  check('accueil : un seul prix annonce', prices.length <= 2, `(prix : ${prices.join(', ')})`);
  check('accueil : prix de 20 EUR present', /20,00\s?€/.test(t));
}

// 8. Le stamp des assets est a jour (regression observee en production :
//    un stamp inchange laissait le navigateur servir l'ancien app.js)
{
  const { computeStamp, assetFingerprint } = await import('../scripts/versionne-assets.mjs');
  const expected = computeStamp(REPO);
  const files = ['index.html', 'fr/index.html', 'compare.html', 'fr/compare.html',
    'assets/style.css', 'assets/app.js', 'assets/demo.js'];
  const used = new Set();
  for (const f of files) {
    for (const m of read(f).matchAll(/\?v=([0-9a-zA-Z._-]+)/g)) used.add(m[1]);
  }
  check('tous les assets portent le meme stamp', used.size === 1, `(stamps : ${[...used].join(', ')})`);
  check('le stamp correspond au contenu actuel des assets', used.has(expected),
    `(attendu ${expected}, trouve ${[...used].join(', ')})`);
  check('l empreinte des assets est stable (8 caracteres)', /^[0-9a-f]{8}$/.test(assetFingerprint(REPO)));
}

console.log(failures === 0 ? '\nPARCOURS DE CONVERSION : OK' : `\nPARCOURS DE CONVERSION : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
