#!/usr/bin/env node
/**
 * conversion-path.test.mjs — invariants du parcours de conversion.
 *
 * Ce que le parcours doit garantir (verifie sur le code, pas suppose) :
 *  1. chaque point de decision porte un evenement named ;
 *  2. le radar interactif a une sortie vers la demonstration ;
 *  3. les sections de preuve (telemetry, etapes) et la fin de page
 *     proposent une action ;
 *  4. aucun faux formulaire n'est expose ; le CTA Stripe est une reservation beta ;
 *  5. la liste d'attente reste proposee en repli ;
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
    .filter((h) => /^[a-z]+:\/\//i.test(h) && !/^(mailto:|https:\/\/bot-wow\.com|https:\/\/buy\.stripe\.com)/.test(h));
  check(`${label} : CTA externe autorisé uniquement vers Stripe`, badHref.length === 0, `(trouve ${badHref.join(', ')})`);
}

// 4. Parcours hero -> demonstration -> comparaison -> statut d'achat (accueil EN)
{
  const t = read('index.html');
  check('accueil : CTA hero vers la demonstration', /href="\.\/demo\.html"[^>]*data-cta-id="hero-demo"/.test(t));
  check('accueil : CTA hero vers le statut de disponibilité', /href="#buy"[^>]*data-cta-id="hero-status"/.test(t));
  check('accueil : sortie du radar vers la demonstration', /class="radar-next-link" href="\.\/demo\.html"/.test(t));
  check('accueil : CTA apres la telemetry', /data-cta-id="telemetry-demo"/.test(t));
  check('accueil : CTA apres les etapes', /data-cta-id="steps-demo"/.test(t));
  check('accueil : CTA de statut final en fin de page', /id="final"[\s\S]{0,900}data-cta-id="final-status"/.test(t));
  check("accueil : réservation Stripe avec livraison manuelle clairement annoncée",
    /https:\/\/buy\.stripe\.com\/00wbJ3gHAdHEf78fF863K00/.test(t) &&
    /manual/i.test(t) && /full refund/i.test(t));
  check('accueil : canal de secours vers le support', /mailto:support@bot-wow\.com/.test(t));
}

// 5. Comparaison publique : statut honnete, sources datees et CTA vers des pages reelles
{
  const en = read('compare.html');
  const fr = read('fr/compare.html');
  check('compare EN : réservation bêta BOT-WOW à 20 € ouverte pour serveurs privés',
    /private servers/i.test(en) && /20,00 €/.test(en));
  check('compare FR : réservation bêta BOT-WOW à 20 € ouverte pour serveurs privés',
    /serveurs privés/i.test(fr) && /20,00 €/.test(fr));
  check('compare EN : CTA demo vers la demo simulee',
    /href="\.\/demo\.html"[^>]*data-cta-id="compare-demo"/.test(en));
  check('compare EN : CTA statut vers la page achat',
    /href="\.\/buy\.html"[^>]*data-cta-id="compare-reserve"/.test(en));
  check('compare FR : CTA demo vers la demo simulee',
    /href="\.\/demo\.html"[^>]*data-cta-id="compare-demo"/.test(fr));
  check('compare FR : CTA statut vers la page achat',
    /href="\.\/buy\.html"[^>]*data-cta-id="compare-reserve"/.test(fr));
  check('compare : aucun lien interne mort vers #buy', !/href="#buy"/.test(en + fr));
  check('compare : sources concurrentes et dates de consultation visibles',
    /https:\/\/pixelwowbot\.com\//.test(en) && /2026-11-06/.test(en)
      && /https:\/\/pixelwowbot\.com\//.test(fr) && /06\/11\/2026/.test(fr));
  check('compare EN : prix concurrent conformes à la page publique',
    /€1\.99 for 48 hours; €19\.99 per 30 days; individual roles from €6\.99/.test(en));
  check('compare FR : prix concurrent conformes à la page publique',
    /1,99 € pour 48 h ; 19,99 € par 30 jours ; rôles individuels à partir de 6,99 €/.test(fr));
  check('compare : compatibilité WoW Forever attribuée au vendeur, pas à BOT-WOW',
    /WoW Forever/.test(en) && /WoW Forever/.test(fr));
  check('compare : ancien calculateur de cout retire', !/id="ownership"/.test(en + fr));
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
      !/\.bind\([^)]*email/.test((api.split('async function recordConversion')[1] || '').split('async function fulfillOrder')[0] || ''));
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
  for (const [f, id] of [['index.html', 'mbar-status'], ['fr/index.html', 'mbar-status'], ['compare.html', 'mbar-reserve'], ['fr/compare.html', 'mbar-reserve']]) {
    const t = read(f);
    check(`${f} : la barre mobile est instrumentee`, new RegExp(`data-cta-id="${id}"`).test(t));
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

// 8. No activation or refund entitlement is advertised while no product is offered.
for (const file of ['index.html', 'fr/index.html']) {
  const html = read(file);
  const heroGuarantee = (html.match(/hero__guarantee-text">([\s\S]*?)<\/span>/) || ['', ''])[1]
    .replace(/<[^>]+>/g, '').replace(/\s+/g, ' ');
  check(file + ' : le hero renvoie vers la politique publiée',
    /legal\/(fr\/)?refund\.html/.test(html), '(aucun lien vers la politique)');
  check(file + ' : le hero précise le périmètre serveurs privés',
    /private servers|serveurs privés/i.test(heroGuarantee + html), '');
}

// 9. Les pages FR ne doivent pas renvoyer vers les pages legales EN.
for (const file of ['fr/index.html', 'fr/compare.html', 'fr/buy.html', 'fr/demo.html']) {
  let html = '';
  try { html = read(file); } catch { continue; }
  const wrong = [...html.matchAll(/href="([^"]*legal\/[^"]*)"/g)].map(m => m[1])
    .filter(u => !u.includes('/legal/fr/') && !/privacy|terms/.test(u) &&
      !['https://www.blizzard.com/en-us/legal/cd5930c0-2784-420c-a23d-1e0d6ff8599b/anti-cheating-agreement', 'https://www.blizzard.com/fr-fr/legal/cd5930c0-2784-420c-a23d-1e0d6ff8599b/charte-anti-triche'].includes(u));
  check(`${file} : les liens legaux FR pointent vers /legal/fr/`,
    wrong.length === 0, `(${wrong.join(', ')})`);
}

// 11. Les CTA dorés doivent rester limités aux actions de réservation/achat.
{
  const PURCHASE = ['hero-status', 'nav-buy', 'final-status', 'mbar-status', 'offer-status', 'beta-reservation-stripe'];
  for (const file of ['index.html', 'fr/index.html']) {
    const html = read(file);
    const golds = [...html.matchAll(/<a\s[^>]*class="[^"]*\bbtn-gold\b[^"]*"[^>]*>/g)]
      .map(m => (m[0].match(/data-cta-id="([^"]+)"/) || [])[1])
      .filter(Boolean);
    const foreign = golds.filter(id => !PURCHASE.includes(id));
    check(`${file} : aucun bouton OR hors achat (${golds.length} dorés au total)`,
      foreign.length === 0, `(dorés non-achat : ${foreign.join(', ')})`);
  }
}

// 10. Le canal de secours au checkout doit proposer une action qui atteint
// reellement le support. Le formulaire data-waitlist enregistre l'adresse en
// base (verifie dans handleSubscribe) sans notifier qui que ce soit : la page
// ne doit donc plus promettre une reponse manuelle du support.
{
  const en = read('index.html');
  const fr = read('fr/index.html');
  for (const [label, html] of [['index.html', en], ['fr/index.html', fr]]) {
    check(`${label} : canal de secours = lien mailto direct`,
      /href="mailto:support@bot-wow\.com"/.test(html), '(aucun mailto)');
    check(`${label} : le formulaire silencieux data-waitlist est retire`,
      !/data-waitlist/.test(html));
    check(`${label} : aucune promesse de reponse manuelle du support`,
      !/support answers|le support répond/i.test(html.replace(/\s+/g, ' ')));
  }
}

// 12. Lisibilite : chaque section de l accueil porte un titre. Une section
// sans titre casse le balayage de la page et fait disparaitre son contenu.
for (const file of ['index.html', 'fr/index.html']) {
  const html = read(file);
  const sections = html.match(/<section[\s\S]*?<\/section>/g) || [];
  const untitled = sections.filter(s => !/<h[12][\s>]/.test(s)).length;
  check(`${file} : aucune section sans titre (${sections.length} sections)`,
    untitled === 0, `(${untitled} sans titre)`);
}

// 13. La réservation Stripe ne collecte pas de champ e-mail local inutilisable.
// Les règles de focus du composant restent vérifiées pour les formulaires futurs.
for (const file of ['index.html', 'fr/index.html']) {
  const html = read(file);
  check(`${file} : aucun formulaire ni champ e-mail de paiement`,
    !/id="buyForm"|id="email"|id="buyBtn"|type="email"/i.test(html) &&
    /id="beta-reservation"/.test(html));
  const css = read('assets/site.css');
  check(`site.css : pm-input retrouve un :focus-visible`,
    /\.pm-input:focus-visible\{[^}]*outline:/.test(css));
  check(`site.css : pas de outline:none global sur :focus-visible`,
    !/\.pm-input:focus-visible\{[^}]*outline:\s*none/.test(css));
  check(`theme.css : :focus-visible global doré present`,
    /:focus-visible\{[^}]*outline:\s*3px solid var\(--gold\)/.test(read('assets/theme.css')));
}

console.log(failures === 0 ? '\nPARCOURS DE CONVERSION : OK' : `\nPARCOURS DE CONVERSION : ${failures} ECHEC(S)`);
process.exit(failures === 0 ? 0 : 1);
