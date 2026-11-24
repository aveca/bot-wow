#!/usr/bin/env node
/**
 * revenue-report.mjs — rapport de l'entonnoir BOT-WOW, strictement en lecture seule.
 *
 * Les statuts `paid` ne sont pas tous des paiements encaissés : les lignes
 * `bitcoin_manual` restent des déclarations manuelles. Le montant confirmé
 * par webhook est calculé séparément et ne constitue pas une preuve bancaire
 * de règlement.
 *
 * Local :
 *   node --experimental-sqlite scripts/revenue-report.mjs ./botwow-production.sqlite --telemetry-db ./botwow-analytics.sqlite --json
 * Remote (opt-in explicite, jamais exécuté par les tests/CI) :
 *   CLOUDFLARE_ACCOUNT_ID=... node --experimental-sqlite scripts/revenue-report.mjs botwow-production --remote --confirm --json
 *
 * Le mode distant utilise uniquement `wrangler d1 execute --remote --json`
 * avec des SELECT internes allowlistés. Aucune SQL fournie par l'utilisateur.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PRODUCTION_DB = 'botwow-production';
const ANALYTICS_DB = 'botwow-analytics';
const READ_ONLY_DATABASES = new Set([PRODUCTION_DB, ANALYTICS_DB]);

function assertSelectOnly(sql) {
  const normalized = String(sql).trim();
  if (!/^SELECT\b/i.test(normalized) || normalized.includes(';')) {
    throw new Error('Requête distante refusée : seul un SELECT unique est autorisé.');
  }
}

export function parseWranglerRows(stdout) {
  let parsed;
  try {
    parsed = JSON.parse(String(stdout).trim());
  } catch {
    throw new Error('Wrangler a renvoyé une sortie non JSON ; rapport distant interrompu.');
  }

  const topErrors = Array.isArray(parsed?.errors) ? parsed.errors : [];
  if (parsed?.success === false || topErrors.length) {
    throw new Error('Wrangler a signalé une erreur D1 ; aucun zéro synthétique ne sera produit.');
  }

  let first;
  if (Array.isArray(parsed)) first = parsed[0];
  else if (Array.isArray(parsed?.result)) first = parsed.result[0];
  else first = parsed;

  if (!first || first.success === false || (Array.isArray(first.errors) && first.errors.length)) {
    throw new Error('Wrangler n’a pas retourné un jeu de résultats D1 valide.');
  }
  if (Array.isArray(first.results)) {
    const nested = first.results[0];
    if (nested && Array.isArray(nested.results)) {
      if (nested.success === false || (Array.isArray(nested.errors) && nested.errors.length)) {
        throw new Error('Wrangler a signalé une erreur dans le résultat D1.');
      }
      return nested.results;
    }
    return first.results;
  }
  if (Array.isArray(first.result?.results)) return first.result.results;
  throw new Error('Format JSON Wrangler inattendu : tableau `results` absent.');
}

export function createRemoteQuery(databaseName, {
  runner = execFileSync,
  wranglerBin = process.env.WRANGLER_BIN || 'npx',
  cwd = ROOT,
} = {}) {
  if (!READ_ONLY_DATABASES.has(databaseName)) {
    throw new Error(`Base distante non autorisée : ${databaseName}`);
  }

  return (sql) => {
    assertSelectOnly(sql);
    const prefixArgs = /(^|[\/])npx(?:\.cmd)?$/i.test(wranglerBin)
      ? ['--no-install', 'wrangler']
      : [];
    const args = [
      ...prefixArgs,
      'd1', 'execute', databaseName,
      '--remote', '--json', '--command', String(sql).trim(),
    ];
    const stdout = runner(wranglerBin, args, {
      cwd,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 4 * 1024 * 1024,
    });
    return parseWranglerRows(stdout);
  };
}

const CONFIRMED_PAYMENT = `
  o.status = 'paid'
  AND o.provider IN ('stripe', 'mollie')
  AND o.provider_id IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM webhook_events w
    WHERE w.id = 'payment:' || o.provider_id
      AND w.provider = o.provider
  )
`;

function rows(query, sql) {
  const result = query(sql);
  if (!Array.isArray(result)) throw new Error('La requête SQL n’a pas retourné de lignes exploitables.');
  return result.map((row) => ({ ...row }));
}

function one(query, sql) {
  return rows(query, sql)[0] || {};
}

export function buildReport({ productionQuery, analyticsQuery, source = 'SQLite locale (lecture seule)' }) {
  if (typeof productionQuery !== 'function' || typeof analyticsQuery !== 'function') {
    throw new Error('Sources SQL absentes : le rapport refuse de fabriquer des zéros.');
  }

  const ordersTotal = Number(one(productionQuery, 'SELECT COUNT(*) AS count FROM orders').count || 0);
  const byStatusRows = rows(productionQuery, 'SELECT status, COUNT(*) AS count FROM orders GROUP BY status ORDER BY status');
  const byStatus = Object.fromEntries(byStatusRows.map((row) => [row.status, Number(row.count || 0)]));
  const providerConfirmedByCurrency = rows(productionQuery, `
    SELECT UPPER(COALESCE(o.currency, '?')) AS currency,
      COUNT(*) AS count, COALESCE(SUM(o.amount), 0) AS cents
    FROM orders o
    WHERE ${CONFIRMED_PAYMENT}
    GROUP BY UPPER(COALESCE(o.currency, '?')) ORDER BY currency
  `);
  const manualPaidByCurrency = rows(productionQuery, `
    SELECT UPPER(COALESCE(currency, '?')) AS currency,
      COUNT(*) AS count, COALESCE(SUM(amount), 0) AS cents
    FROM orders
    WHERE status = 'paid' AND provider = 'bitcoin_manual'
    GROUP BY UPPER(COALESCE(currency, '?')) ORDER BY currency
  `);
  const unverifiedPaidByCurrency = rows(productionQuery, `
    SELECT UPPER(COALESCE(o.currency, '?')) AS currency,
      COUNT(*) AS count, COALESCE(SUM(o.amount), 0) AS cents
    FROM orders o
    WHERE o.status = 'paid' AND NOT (${CONFIRMED_PAYMENT})
    GROUP BY UPPER(COALESCE(o.currency, '?')) ORDER BY currency
  `);
  const sumCount = (items) => items.reduce((total, row) => total + Number(row.count || 0), 0);

  const licenses = Number(one(productionQuery, 'SELECT COUNT(*) AS count FROM licenses').count || 0);
  const licensesWithOrder = Number(one(productionQuery, `
    SELECT COUNT(*) AS count FROM licenses l JOIN orders o ON o.id = l.order_id
  `).count || 0);
  const downloads = one(productionQuery, `
    SELECT COUNT(*) AS count, COALESCE(SUM(count), 0) AS uses FROM downloads
  `);
  const activations = Number(one(productionQuery, 'SELECT COUNT(*) AS count FROM activations').count || 0);
  const deliveryRows = rows(productionQuery, 'SELECT status, COUNT(*) AS count FROM deliveries GROUP BY status ORDER BY status');
  const deliveries = Object.fromEntries(deliveryRows.map((row) => [row.status, Number(row.count || 0)]));

  const byChannelRows = rows(productionQuery, `
    SELECT
      o.provider,
      UPPER(COALESCE(o.currency, '?')) AS currency,
      COUNT(*) AS orders,
      SUM(CASE WHEN o.status = 'paid' THEN 1 ELSE 0 END) AS paidStatus,
      SUM(CASE WHEN ${CONFIRMED_PAYMENT} THEN 1 ELSE 0 END) AS providerConfirmed,
      SUM(CASE WHEN o.status = 'paid' AND o.provider = 'bitcoin_manual' THEN 1 ELSE 0 END) AS manualPaid,
      COALESCE(SUM(CASE WHEN ${CONFIRMED_PAYMENT} THEN o.amount ELSE 0 END), 0) AS confirmedCents
    FROM orders o
    GROUP BY o.provider, UPPER(COALESCE(o.currency, '?'))
    ORDER BY orders DESC
  `);
  const byOfferRows = rows(productionQuery, `
    SELECT
      CASE
        WHEN json_valid(metadata) AND json_extract(metadata, '$.product') GLOB '*[^A-Za-z0-9_-]*' THEN '(other)'
        WHEN json_valid(metadata) THEN COALESCE(substr(json_extract(metadata, '$.product'), 1, 40), '(inconnu)')
        ELSE '(inconnu)'
      END AS product,
      UPPER(COALESCE(o.currency, '?')) AS currency,
      COUNT(*) AS orders,
      SUM(CASE WHEN status = 'paid' THEN 1 ELSE 0 END) AS paidStatus,
      SUM(CASE WHEN ${CONFIRMED_PAYMENT} THEN 1 ELSE 0 END) AS providerConfirmed,
      COALESCE(SUM(CASE WHEN ${CONFIRMED_PAYMENT} THEN amount ELSE 0 END), 0) AS confirmedCents
    FROM orders o
    GROUP BY product, UPPER(COALESCE(o.currency, '?'))
    ORDER BY orders DESC
  `);
  const byLangRows = rows(productionQuery, `
    SELECT
      COALESCE(l.lang, '(aucune)') AS lang,
      COUNT(*) AS licenses,
      SUM(CASE WHEN ${CONFIRMED_PAYMENT} THEN 1 ELSE 0 END) AS providerConfirmedPaidOrders
    FROM licenses l
    LEFT JOIN orders o ON o.id = l.order_id
    GROUP BY l.lang
    ORDER BY licenses DESC
  `);

  const telemetryTotals = one(analyticsQuery, `
    SELECT
      COUNT(*) AS events,
      COUNT(DISTINCT journey_id) AS journeys,
      SUM(CASE WHEN journey_id IS NULL OR journey_id = '' THEN 1 ELSE 0 END) AS missingJourneyEvents
    FROM events
    WHERE test = 0 AND ts >= (unixepoch('now') - 7 * 86400) * 1000
  `);
  const telemetryByEvent = rows(analyticsQuery, `
    SELECT
      CASE WHEN event GLOB '*[^A-Za-z0-9_-]*' THEN '(other)' ELSE substr(event, 1, 40) END AS event,
      COUNT(*) AS events,
      COUNT(DISTINCT journey_id) AS journeys,
      SUM(CASE WHEN journey_id IS NULL OR journey_id = '' THEN 1 ELSE 0 END) AS missingJourneyEvents
    FROM events
    WHERE test = 0 AND ts >= (unixepoch('now') - 7 * 86400) * 1000
    GROUP BY event
    ORDER BY events DESC
  `);
  const telemetryByCta = rows(analyticsQuery, `
    SELECT
      CASE WHEN event GLOB '*[^A-Za-z0-9_-]*' THEN '(other)' ELSE substr(event, 1, 40) END AS event,
      CASE WHEN page LIKE '%?%' OR page LIKE '%@%' THEN '(other)' ELSE substr(page, 1, 80) END AS page,
      CASE WHEN cta IS NULL THEN '(aucun)'
        WHEN cta GLOB '*[^A-Za-z0-9_-]*' THEN '(other)' ELSE substr(cta, 1, 40) END AS cta,
      COUNT(*) AS events,
      COUNT(DISTINCT journey_id) AS journeys
    FROM events
    WHERE test = 0
      AND ts >= (unixepoch('now') - 7 * 86400) * 1000
      AND (cta IS NOT NULL OR event LIKE 'checkout_%' OR event LIKE 'payment_%')
    GROUP BY event, page, cta
    ORDER BY events DESC
    LIMIT 50
  `);
  const telemetryBySource = rows(analyticsQuery, `
    SELECT CASE WHEN source IS NULL OR source = '' THEN '(inconnu)'
      WHEN source GLOB '*[^A-Za-z0-9_-]*' THEN '(other)' ELSE substr(source, 1, 40) END AS source,
      COUNT(*) AS events, COUNT(DISTINCT journey_id) AS journeys
    FROM events
    WHERE test = 0 AND ts >= (unixepoch('now') - 7 * 86400) * 1000
    GROUP BY source ORDER BY events DESC
  `);
  const telemetryByLang = rows(analyticsQuery, `
    SELECT CASE WHEN lang IS NULL OR lang = '' THEN '(inconnu)'
      WHEN lang GLOB '*[^A-Za-z0-9_-]*' THEN '(other)' ELSE substr(lang, 1, 20) END AS lang,
      COUNT(*) AS events, COUNT(DISTINCT journey_id) AS journeys
    FROM events
    WHERE test = 0 AND ts >= (unixepoch('now') - 7 * 86400) * 1000
    GROUP BY lang ORDER BY events DESC
  `);
  const eventCount = (name) => Number(telemetryByEvent.find((row) => row.event === name)?.events || 0);

  const failedOrRejected = (byStatus.failed || 0) + (byStatus.expired || 0)
    + (byStatus.canceled || 0) + (byStatus.rejected || 0);

  return {
    generatedAt: new Date().toISOString(),
    source,
    funnel: {
      commandesCreees: ordersTotal,
      commandesParStatut: byStatus,
      commandesStatutPaid: byStatus.paid || 0,
      commandesEchoueesOuRejetees: failedOrRejected,
      commandesRejetees: byStatus.rejected || 0,
      commandesRemboursees: byStatus.refunded || 0,
      paiementsConfirmesParWebhook: sumCount(providerConfirmedByCurrency),
      montantsConfirmesParDevise: providerConfirmedByCurrency,
      statutsPaidManuelsNonVerifies: sumCount(manualPaidByCurrency),
      montantsStatutPaidManuelNonVerifiesParDevise: manualPaidByCurrency,
      statutsPaidNonVerifies: sumCount(unverifiedPaidByCurrency),
      montantsStatutPaidNonVerifiesParDevise: unverifiedPaidByCurrency,
      licencesDelivrees: licenses,
      licencesJointesAUneCommande: licensesWithOrder,
      jetonsTelechargement: Number(downloads.count || 0),
      usagesTelechargement: Number(downloads.uses || 0),
      activations,
      livraisonsMarqueesEnvoyees: deliveries.sent || 0,
      livraisonsEnAttenteDeRejeu: deliveries.pending || 0,
      livraisonsParStatut: deliveries,
    },
    telemetry: {
      windowDays: 7,
      events: Number(telemetryTotals.events || 0),
      journeysDistincts: Number(telemetryTotals.journeys || 0),
      eventsSansJourneyId: Number(telemetryTotals.missingJourneyEvents || 0),
      pageViews: eventCount('page_view'),
      ctaClicks: eventCount('cta_click'),
      checkoutRequested: eventCount('checkout_requested'),
      checkoutStart: eventCount('checkout_start'),
      checkoutCreated: eventCount('checkout_created'),
      checkoutFailed: eventCount('checkout_failed'),
      checkoutExpired: eventCount('checkout_expired'),
      paymentConfirmed: eventCount('payment_confirmed'),
      paymentSuccess: eventCount('payment_success'),
      byEvent: telemetryByEvent,
      byCtaAndCheckout: telemetryByCta,
      bySource: telemetryBySource,
      byLang: telemetryByLang,
      attributionLimitations: 'Le schéma D1 ne stocke pas de domaine ni de device ; aucune attribution n’est inventée.',
    },
    parCanal: byChannelRows,
    parOffre: byOfferRows,
    parLangue: byLangRows,
    gardeFou: {
      ecriture: 'aucune (SQLite readOnly / Wrangler SELECT uniquement)',
      donneesPersonnelles: 'aucune donnée personnelle ou ligne brute affichée',
      statutPaidManuel: 'bitcoin_manual n’est jamais compté comme paiement confirmé',
      revenu: 'webhook fournisseur confirmé ; ne prouve pas à lui seul le règlement bancaire',
      livraison: 'une ligne deliveries ne prouve pas la réception en boîte mail',
      telemetry: 'un événement n’est pas une personne ; journey_id n’est pas nécessairement un visiteur unique',
    },
  };
}

export function renderHuman(report) {
  const f = report.funnel;
  const t = report.telemetry;
  const formatAmounts = (items) => items.length
    ? items.map((row) => `${row.currency} ${(Number(row.cents || 0) / 100).toFixed(2)} (${row.count} paiements)`).join('; ')
    : 'aucun';
  const lines = [
    '=== BOT-WOW — RAPPORT REVENUE (LECTURE SEULE) ===',
    `source                         : ${report.source}`,
    `commandes creees               : ${f.commandesCreees}`,
    `statuts paid (pas du cash prouve): ${f.commandesStatutPaid}`,
    `paiements confirmes par webhook: ${f.paiementsConfirmesParWebhook}`,
    `montants confirmes par webhook: ${formatAmounts(f.montantsConfirmesParDevise)} (pas une preuve bancaire)`,
    `statuts paid manuels non verifies: ${f.statutsPaidManuelsNonVerifies} (${formatAmounts(f.montantsStatutPaidManuelNonVerifiesParDevise)})`,
    `statuts paid non verifies      : ${f.statutsPaidNonVerifies} (${formatAmounts(f.montantsStatutPaidNonVerifiesParDevise)})`,
    `commandes echouees/rejetees    : ${f.commandesEchoueesOuRejetees} (rejetees: ${f.commandesRejetees})`,
    `licences / commandes liees     : ${f.licencesDelivrees} / ${f.licencesJointesAUneCommande}`,
    `activations                   : ${f.activations}`,
    `livraisons marquees envoyees  : ${f.livraisonsMarqueesEnvoyees} (${f.livraisonsEnAttenteDeRejeu} en attente)`,
    '',
    `--- telemetry ${t.windowDays} jours (test=0) ---`,
    `evenements                    : ${t.events}`,
    `journeys distincts             : ${t.journeysDistincts} (pas des personnes)`,
    `evenements sans journey_id     : ${t.eventsSansJourneyId}`,
    `page_view / cta_click          : ${t.pageViews} / ${t.ctaClicks}`,
    `checkout_requested/start      : ${t.checkoutRequested} / ${t.checkoutStart}`,
    `checkout_created/failed       : ${t.checkoutCreated} / ${t.checkoutFailed}`,
    `payment_confirmed/success     : ${t.paymentConfirmed} / ${t.paymentSuccess}`,
    '',
    'NB : un statut paid manuel, un clic, une demande checkout ou un événement analytics ne sont pas une vente confirmée.',
  ];
  return lines.join('\n');
}

function parseArgs(argv) {
  const parsed = { target: null, telemetryDbPath: null, json: false, remote: false, confirm: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--json') parsed.json = true;
    else if (arg === '--remote') parsed.remote = true;
    else if (arg === '--confirm') parsed.confirm = true;
    else if (arg === '--telemetry-db') {
      parsed.telemetryDbPath = argv[i + 1];
      if (!parsed.telemetryDbPath || parsed.telemetryDbPath.startsWith('--')) {
        throw new Error('--telemetry-db exige un chemin de base SQLite.');
      }
      i += 1;
    } else if (arg.startsWith('--')) {
      throw new Error(`Option inconnue : ${arg}`);
    } else if (!parsed.target) parsed.target = arg;
    else throw new Error(`Argument inattendu : ${arg}`);
  }
  return parsed;
}

export function main(argv = process.argv.slice(2), env = process.env, deps = {}) {
  const stdout = deps.stdout || ((value) => console.log(value));
  const stderr = deps.stderr || ((value) => console.error(value));
  const Database = deps.DatabaseSync || DatabaseSync;
  try {
    const args = parseArgs(argv);
    if (!args.target) {
      stderr('Usage : node scripts/revenue-report.mjs <sqlite|botwow-production> [--telemetry-db <sqlite>] [--json] [--remote --confirm]');
      return 2;
    }
    if (args.confirm && !args.remote) {
      stderr('--confirm n’est autorisé qu’avec --remote.');
      return 2;
    }

    let report;
    if (args.remote) {
      if (!args.confirm) {
        stderr('REFUS : le mode distant exige simultanément --remote --confirm.');
        return 2;
      }
      if (!env.CLOUDFLARE_ACCOUNT_ID) {
        stderr('REFUS : CLOUDFLARE_ACCOUNT_ID absent ; aucune requête distante lancée.');
        return 2;
      }
      if (args.target !== PRODUCTION_DB || args.telemetryDbPath) {
        stderr(`REFUS : cible distante attendue = ${PRODUCTION_DB} ; la télémétrie est lue depuis ${ANALYTICS_DB}.`);
        return 2;
      }
      const runner = deps.runWrangler || execFileSync;
      const productionQuery = createRemoteQuery(PRODUCTION_DB, { runner, wranglerBin: env.WRANGLER_BIN || 'npx' });
      const analyticsQuery = createRemoteQuery(ANALYTICS_DB, { runner, wranglerBin: env.WRANGLER_BIN || 'npx' });
      report = buildReport({
        productionQuery,
        analyticsQuery,
        source: 'D1 botwow-production + botwow-analytics (lecture seule via Wrangler)',
      });
    } else {
      if (!fs.existsSync(args.target)) {
        stderr(`Base SQLite introuvable : ${args.target}`);
        return 2;
      }
      const telemetryPath = args.telemetryDbPath || args.target;
      if (!fs.existsSync(telemetryPath)) {
        stderr(`Base telemetry SQLite introuvable : ${telemetryPath}`);
        return 2;
      }
      const productionDb = new Database(args.target, { readOnly: true });
      const analyticsDb = telemetryPath === args.target
        ? productionDb
        : new Database(telemetryPath, { readOnly: true });
      try {
        report = buildReport({
          productionQuery: (sql) => productionDb.prepare(sql).all(),
          analyticsQuery: (sql) => analyticsDb.prepare(sql).all(),
          source: 'SQLite locale (lecture seule)',
        });
      } finally {
        if (analyticsDb !== productionDb) analyticsDb.close();
        productionDb.close();
      }
    }

    stdout(args.json ? JSON.stringify(report, null, 2) : renderHuman(report));
    return 0;
  } catch (error) {
    stderr(`ERREUR — rapport interrompu, aucune valeur zéro de repli : ${String(error?.message || error)}`);
    return 1;
  }
}

const invokedPath = process.argv[1] ? path.resolve(process.argv[1]) : '';
if (invokedPath && invokedPath === path.resolve(fileURLToPath(import.meta.url))) {
  process.exitCode = main();
}
