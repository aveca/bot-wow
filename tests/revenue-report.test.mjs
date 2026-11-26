#!/usr/bin/env node
/** Tests synthétiques du rapport revenue : migrations réelles, SQLite read-only,
 * D1 Wrangler simulé. Aucun accès réseau, aucune requête production, aucun paiement.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import {
  buildReport,
  createRemoteQuery,
  main,
  parseWranglerRows,
} from '../scripts/revenue-report.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'botwow-revenue-report-'));
const productionPath = path.join(temp, 'production.sqlite');
const analyticsPath = path.join(temp, 'analytics.sqlite');
const now = Date.now();

function apply(db, relativePaths) {
  for (const relativePath of relativePaths) {
    db.exec(fs.readFileSync(path.join(ROOT, relativePath), 'utf8'));
  }
}

try {
  const production = new DatabaseSync(productionPath);
  apply(production, [
    'migrations/production/0002_botwow_licenses.sql',
    'migrations/production/0003_botwow_payment_integrity.sql',
  ]);
  const insertOrder = production.prepare(`
    INSERT INTO orders (id, provider, provider_id, email, amount, currency, status, metadata, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, 'eur', ?, ?, ?, ?)
  `);
  const orders = [
    ['ord_stripe_confirmed', 'stripe', 'cs_confirmed', 'private-one@example.test', 2000, 'paid', '{"product":"planner"}'],
    ['ord_stripe_unverified', 'stripe', 'cs_unverified', 'private-two@example.test', 2900, 'paid', '{"product":"studio"}'],
    ['ord_stripe_usd_confirmed', 'stripe', 'cs_usd', 'private-usd@example.test', 1000, 'paid', '{"product":"planner"}'],
    ['ord_manual_paid', 'bitcoin_manual', 'manual-ref', 'private-three@example.test', 2000, 'paid', '{"product":"planner"}'],
    ['ord_mollie_failed', 'mollie', 'tr_failed', 'private-four@example.test', 2000, 'failed', '{"product":"planner"}'],
    ['ord_stripe_rejected', 'stripe', 'cs_rejected', 'private-five@example.test', 2000, 'rejected', '{"product":"planner"}'],
    ['ord_stripe_refunded', 'stripe', 'cs_refunded', 'private-six@example.test', 2900, 'refunded', '{"product":"studio"}'],
  ];
  for (const [id, provider, providerId, email, amount, status, metadata] of orders) {
    insertOrder.run(id, provider, providerId, email, amount, status, metadata, now - 1000, now - 1000);
  }
  production.prepare("UPDATE orders SET currency = 'usd' WHERE id = 'ord_stripe_usd_confirmed'").run();
  production.prepare('INSERT INTO webhook_events (id, provider, processed_at) VALUES (?, ?, ?)')
    .run('payment:cs_confirmed', 'stripe', now);
  production.prepare('INSERT INTO webhook_events (id, provider, processed_at) VALUES (?, ?, ?)')
    .run('payment:cs_usd', 'stripe', now);
  production.prepare('INSERT INTO webhook_events (id, provider, processed_at) VALUES (?, ?, ?)')
    .run('payment:cs_unverified', 'mollie', now);
  production.prepare('INSERT INTO webhook_events (id, provider, processed_at) VALUES (?, ?, ?)')
    .run('payment:manual-ref', 'bitcoin_manual', now);
  const insertLicense = production.prepare(`
    INSERT INTO licenses (key, order_id, email, lang, status, max_activations, created_at, updated_at)
    VALUES (?, ?, ?, ?, 'active', 1, ?, ?)
  `);
  insertLicense.run('SECRET-LICENSE-1', 'ord_stripe_confirmed', 'private-one@example.test', 'en', now, now);
  // Two license rows for one provider-confirmed order must still count as one order.
  insertLicense.run('SECRET-LICENSE-2', 'ord_stripe_confirmed', 'private-one@example.test', 'en', now, now);
  production.prepare(`
    INSERT INTO downloads (token, license_id, expires_at, count, max_count, created_at)
    VALUES (?, 1, ?, 2, 3, ?)
  `).run('SECRET-DOWNLOAD-TOKEN', now + 86400000, now);
  production.prepare(`
    INSERT INTO activations (license_id, machine_id, ip, user_agent, activated_at, last_seen_at)
    VALUES (1, ?, ?, ?, ?, ?)
  `).run('SECRET-MACHINE-ID', '192.0.2.10', 'private-agent', now, now);
  production.prepare(`
    INSERT INTO deliveries (email, subject, body, kind, status, created_at, sent_at)
    VALUES (?, 'subject', 'private body', 'delivery', 'sent', ?, ?)
  `).run('private-one@example.test', now, now);
  production.prepare(`
    INSERT INTO deliveries (email, subject, body, kind, status, created_at)
    VALUES (?, 'subject', 'private body', 'delivery', 'pending', ?)
  `).run('private-two@example.test', now);
  production.close();

  const analytics = new DatabaseSync(analyticsPath);
  apply(analytics, [
    'migrations/analytics/0001_telemetry_events.sql',
    'migrations/analytics/0003_telemetry_journey_id.sql',
  ]);
  const insertEvent = analytics.prepare(`
    INSERT INTO events (ts, event, page, lang, cta, step, test, source, journey_id)
    VALUES (?, ?, ?, 'en', ?, ?, ?, ?, ?)
  `);
  insertEvent.run(now - 86400000, 'page_view', '/', null, null, 0, 'organic', 'journey-1');
  insertEvent.run(now - 86000000, 'cta_click', '/demo', 'demo-primary', null, 0, 'organic', 'journey-1');
  insertEvent.run(now - 85000000, 'checkout_requested', '/buy', 'buy-planner', 'checkout_requested', 0, 'private-source@example.test', null);
  insertEvent.run(now - 84000000, 'page_view', '/fr/', null, null, 0, 'direct', null);
  insertEvent.run(now - 83000000, 'payment_confirmed', '/api/stripe-webhook', null, 'payment_confirmed', 1, 'test', 'test-journey');
  analytics.close();

  const productionRO = new DatabaseSync(productionPath, { readOnly: true });
  assert.throws(() => productionRO.exec('CREATE TABLE should_not_exist (id INTEGER)'), /readonly|read-only/i);
  const analyticsRO = new DatabaseSync(analyticsPath, { readOnly: true });
  const report = buildReport({
    productionQuery: (sql) => productionRO.prepare(sql).all(),
    analyticsQuery: (sql) => analyticsRO.prepare(sql).all(),
  });
  productionRO.close();
  analyticsRO.close();

  assert.equal(report.funnel.commandesCreees, 7);
  assert.equal(report.funnel.commandesStatutPaid, 4);
  assert.equal(report.funnel.paiementsConfirmesParWebhook, 2);
  assert.deepEqual(report.funnel.montantsConfirmesParDevise, [
    { currency: 'EUR', count: 1, cents: 2000 },
    { currency: 'USD', count: 1, cents: 1000 },
  ]);
  assert.equal(report.funnel.statutsPaidManuelsNonVerifies, 1);
  assert.deepEqual(report.funnel.montantsStatutPaidManuelNonVerifiesParDevise, [
    { currency: 'EUR', count: 1, cents: 2000 },
  ]);
  assert.equal(report.funnel.statutsPaidNonVerifies, 2);
  assert.deepEqual(report.funnel.montantsStatutPaidNonVerifiesParDevise, [
    { currency: 'EUR', count: 2, cents: 4900 },
  ]);
  assert.equal(report.funnel.commandesRejetees, 1);
  assert.equal(report.funnel.commandesEchoueesOuRejetees, 2);
  assert.equal(report.funnel.commandesRemboursees, 1);
  assert.deepEqual(report.parLangue, [
    { lang: 'en', licenses: 2, providerConfirmedPaidOrders: 1 },
  ]);
  assert.equal(report.funnel.licencesDelivrees, 2);
  assert.equal(report.funnel.activations, 1);
  assert.equal(report.funnel.livraisonsMarqueesEnvoyees, 1);
  assert.equal(report.funnel.livraisonsEnAttenteDeRejeu, 1);

  assert.equal(report.telemetry.events, 4);
  assert.equal(report.telemetry.journeysDistincts, 1);
  assert.equal(report.telemetry.eventsSansJourneyId, 2);
  assert.equal(report.telemetry.pageViews, 2);
  assert.equal(report.telemetry.ctaClicks, 1);
  assert.equal(report.telemetry.checkoutRequested, 1);
  assert.equal(report.telemetry.paymentConfirmed, 0, 'test=1 must be excluded');
  assert.equal(report.telemetry.byCtaAndCheckout.length, 2);

  const serialized = JSON.stringify(report);
  for (const secret of [
    'private-one@example.test', 'private-usd@example.test', 'SECRET-LICENSE-1', 'SECRET-DOWNLOAD-TOKEN',
    'SECRET-MACHINE-ID', '192.0.2.10', 'private-agent', 'private body', 'private-source@example.test',
  ]) assert.equal(serialized.includes(secret), false, `PII/secret leaked: ${secret}`);

  assert.throws(() => buildReport({
    productionQuery: () => { throw new Error('no such table: orders'); },
    analyticsQuery: () => [],
  }), /no such table: orders/);

  const badDbPath = path.join(temp, 'empty.sqlite');
  new DatabaseSync(badDbPath).close();
  let failClosedError = '';
  const failClosedCode = main([badDbPath, '--json'], {}, {
    stdout: () => {},
    stderr: (value) => { failClosedError += value; },
  });
  assert.equal(failClosedCode, 1);
  assert.match(failClosedError, /aucune valeur zéro de repli/);

  assert.deepEqual(parseWranglerRows(JSON.stringify({
    success: true,
    results: [{ success: true, results: [{ count: 7 }] }],
    errors: [],
  })), [{ count: 7 }]);
  assert.throws(() => parseWranglerRows('not-json'), /sortie non JSON/);
  assert.throws(() => parseWranglerRows(JSON.stringify({ success: false, errors: [{ message: 'denied' }] })), /erreur D1/);

  const remoteCalls = [];
  const fakeRunner = (_bin, args) => {
    const database = args[args.indexOf('execute') + 1];
    const sql = args[args.indexOf('--command') + 1];
    assert.equal(args.includes('--remote'), true);
    assert.equal(args.includes('--json'), true);
    assert.equal(args.includes('--no-install'), true);
    assert.match(sql, /^SELECT\b/i);
    assert.equal(sql.includes(';'), false);
    remoteCalls.push(database);
    const rows = sql.includes('COUNT(*) AS count FROM orders')
      ? [{ count: 1 }]
      : [];
    return JSON.stringify({ success: true, results: [{ success: true, results: rows }], errors: [] });
  };
  let remoteOutput = '';
  const remoteCode = main(['botwow-production', '--remote', '--confirm', '--json'], {
    CLOUDFLARE_ACCOUNT_ID: 'synthetic-account-only',
  }, {
    runWrangler: fakeRunner,
    stdout: (value) => { remoteOutput = value; },
    stderr: (value) => { throw new Error(value); },
  });
  assert.equal(remoteCode, 0);
  assert.equal(JSON.parse(remoteOutput).funnel.commandesCreees, 1);
  assert.equal(remoteCalls.includes('botwow-production'), true);
  assert.equal(remoteCalls.includes('botwow-analytics'), true);

  let callsWithoutConfirm = 0;
  const noConfirmCode = main(['botwow-production', '--remote', '--json'], {
    CLOUDFLARE_ACCOUNT_ID: 'synthetic-account-only',
  }, {
    runWrangler: () => { callsWithoutConfirm += 1; return '{}'; },
    stdout: () => {}, stderr: () => {},
  });
  assert.equal(noConfirmCode, 2);
  assert.equal(callsWithoutConfirm, 0);

  const noAccountCode = main(['botwow-production', '--remote', '--confirm', '--json'], {}, {
    runWrangler: () => { callsWithoutConfirm += 1; return '{}'; },
    stdout: () => {}, stderr: () => {},
  });
  assert.equal(noAccountCode, 2);
  assert.equal(callsWithoutConfirm, 0);

  assert.throws(() => createRemoteQuery('unapproved-db'), /Base distante non autorisée/);
  assert.throws(() => createRemoteQuery('botwow-production')('DELETE FROM orders'), /seul un SELECT unique/);

  console.log('revenue-report: PASS — local read-only, fail-closed SQL, webhook reconciliation, manual-paid separation, aggregate telemetry, Wrangler remote mocked; 0 production queries.');
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
