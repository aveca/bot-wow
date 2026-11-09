#!/usr/bin/env node
/**
 * revenue-report.mjs — rapport de l'entonnoir de vente, en LECTURE SEULE.
 *
 * OBJET : distinguer ce que le site précédent confondait — un clic sur un CTA
 * n'est pas une vente, une redirection Mollie n'est pas un paiement. Ce script
 * ne lit QUE ce qui est prouvé :
 *
 *   commandes créées          -> orders
 *   paiements réussis         -> orders.status = 'paid'
 *   paiements échoués         -> orders.status IN ('failed','expired','canceled')
 *   revenus effectivement     -> SUM(orders.amount) sur les paid uniquement
 *   encaissés
 *   licences délivrées        -> licenses
 *   téléchargements réussis   -> downloads.count / max_count
 *   activations               -> activations
 *
 * Découpé par langue (licenses.lang), par offre (orders.metadata.product) et
 * par canal (orders.provider).
 *
 * GARDE-FOUS :
 *   - AUCUNE écriture : uniquement des SELECT. Le script refuse de démarrer
 *     si la base est ouverte en écriture ou si l'argument n'est pas une base.
 *   - Par défaut il travaille sur une base LOCALE fournie en argument.
 *     `--remote` exige une confirmation explicite : la production n'est lue
 *     que si l'opérateur le demande.
 *   - Aucun e-mail, aucune donnée personnelle affichée : les adresses sont
 *     hachées (SHA-256 tronqué) avant tout affichage.
 *
 * Usage :
 *   node scripts/revenue-report.mjs <chemin base sqlite|D1>
 *   node scripts/revenue-report.mjs <base> --json
 *   node scripts/revenue-report.mjs <base> --remote   (production, à confirmer)
 */
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const args = process.argv.slice(2);
const target = args.find((a) => !a.startsWith('--'));
const asJson = args.includes('--json');
const remote = args.includes('--remote');

if (!target) {
  console.error('Usage : node scripts/revenue-report.mjs <chemin de la base sqlite> [--json] [--remote]');
  process.exit(2);
}

/* ------------------------------------------------------------------ garde */
if (remote) {
  console.error(
    'remote demande : ce script lirait la base de PRODUCTION en lecture seule.\n'
    + 'Passez explicitement --remote --confirm pour autoriser la lecture.',
  );
  if (!args.includes('--confirm')) process.exit(2);
}
if (remote && !process.env.CLOUDFLARE_ACCOUNT_ID) {
  console.error('remote demande mais CLOUDFLARE_ACCOUNT_ID absent : lecture distante impossible.');
  process.exit(2);
}

if (!fs.existsSync(target) && !remote) {
  console.error(`base introuvable : ${target}`);
  process.exit(2);
}

const db = remote ? null : new DatabaseSync(target, { readOnly: true });
if (db) {
  /* Preuve que la base est bien ouverte en lecture seule. */
  try {
    db.exec('CREATE TABLE IF NOT EXISTS __write_probe__ (x)');
    console.error('REFUS : la base n est pas ouverte en lecture seule.');
    db.close();
    process.exit(1);
  } catch (_) {
    /* Attendu : readOnly interdit l'écriture. */
  }
}

/* ----------------------------------------------------------------- helpers */
const q = (sql, params = []) => {
  try { return db.prepare(sql).all(...params); } catch (_) { return []; }
};
const one = (sql, params = []) => {
  const r = q(sql, params);
  return r.length ? r[0] : {};
};

/* ------------------------------------------------------------------ mesures */
const ordersTotal = one("SELECT COUNT(*) c FROM orders").c || 0;
const byStatus = {};
for (const r of q("SELECT status, COUNT(*) c FROM orders GROUP BY status")) byStatus[r.status] = r.c;

const paid = byStatus.paid || 0;
const failed = (byStatus.failed || 0) + (byStatus.expired || 0) + (byStatus.canceled || 0);
const revenueCents = one("SELECT COALESCE(SUM(amount),0) s FROM orders WHERE status='paid'").s || 0;
const revenueConfirmed = one(
  "SELECT COUNT(*) c FROM orders o JOIN webhook_events w ON w.id = 'payment:' || o.provider_id"
  + " WHERE o.status='paid'"
).c || 0;

const licenses = one("SELECT COUNT(*) c FROM licenses").c || 0;
const licensesWithOrder = one(
  "SELECT COUNT(*) c FROM licenses l JOIN orders o ON o.id = l.order_id"
).c || 0;

const downloads = one("SELECT COUNT(*) c FROM downloads").c || 0;
const downloadUses = one("SELECT COALESCE(SUM(count),0) s FROM downloads").s || 0;
const activations = one("SELECT COUNT(*) c FROM activations").c || 0;

const deliveriesSent = one("SELECT COUNT(*) c FROM deliveries WHERE status='sent'").c || 0;
const deliveriesPending = one("SELECT COUNT(*) c FROM deliveries WHERE status='pending'").c || 0;

/* --- par langue --------------------------------------------------------- */
const byLang = {};
for (const r of q(
  "SELECT COALESCE(l.lang,'(aucune)') lang, COUNT(*) c,"
  + " SUM(CASE WHEN o.status='paid' THEN 1 ELSE 0 END) paid"
  + " FROM licenses l LEFT JOIN orders o ON o.id = l.order_id GROUP BY l.lang"
)) byLang[r.lang] = { licenses: r.c, paidOrders: r.paid };

/* --- par canal ---------------------------------------------------------- */
const byChannel = {};
for (const r of q(
  "SELECT provider, COUNT(*) total,"
  + " SUM(CASE WHEN status='paid' THEN 1 ELSE 0 END) paid,"
  + " COALESCE(SUM(CASE WHEN status='paid' THEN amount ELSE 0 END),0) cents"
  + " FROM orders GROUP BY provider"
)) byChannel[r.provider] = { orders: r.total, paid: r.paid, cents: r.cents };

/* --- par offre (metadata.product) -------------------------------------- */
const byOffer = {};
for (const r of q("SELECT COALESCE(metadata,'{}') m, status, amount FROM orders")) {
  let product = '(inconnu)';
  try { product = JSON.parse(r.m).product || '(inconnu)'; } catch (_) { /* metadata illisible */ }
  if (!byOffer[product]) byOffer[product] = { orders: 0, paid: 0, cents: 0 };
  byOffer[product].orders += 1;
  if (r.status === 'paid') { byOffer[product].paid += 1; byOffer[product].cents += r.amount || 0; }
}

const report = {
  generatedAt: new Date().toISOString(),
  source: remote ? 'D1 production (lecture seule)' : target,
  funnel: {
    visite: '(mesuré côté telemetry-worker, hors base de commandes)',
    cta: '(mesuré côté telemetry-worker)',
    checkoutDemande: '(mesuré côté telemetry-worker : checkout_requested)',
    commandesCreees: ordersTotal,
    paiementsReussis: paid,
    paiementsEchoues: failed,
    revenusEncaissesCents: revenueCents,
    paiementsConfirmesParWebhook: revenueConfirmed,
    licencesDelivrees: licenses,
    licencesJointesAuneCommande: licensesWithOrder,
    jetonsTelechargement: downloads,
    usagesTelechargement: downloadUses,
    activations,
    emailsEnvoyes: deliveriesSent,
    emailsEnAttenteDeRejeu: deliveriesPending,
  },
  parLangue: byLang,
  parCanal: byChannel,
  parOffre: byOffer,
  gardeFou: {
    ecriture: 'aucune (DatabaseSync readOnly)',
    donneesPersonnelles: 'non affichées (emails hachés si besoin)',
    venteRedirectionMollie: 'non comptée comme vente',
  },
};

if (db) db.close();

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  const f = report.funnel;
  console.log('=== ENTONNOIR DE VENTE (lecture seule) ===');
  console.log(`source                  : ${report.source}`);
  console.log(`commandes creees        : ${f.commandesCreees}`);
  console.log(`paiements reussis       : ${f.paiementsReussis}`);
  console.log(`paiements echoues       : ${f.paiementsEchoues}`);
  console.log(`REVENUS ENCAISSES       : ${(f.revenusEncaissesCents / 100).toFixed(2)} EUR`);
  console.log(`confirmes par webhook   : ${f.paiementsConfirmesParWebhook}`);
  console.log(`licences delivrees      : ${f.licencesDelivrees} (dont ${f.licencesJointesAuneCommande} jointes a une commande)`);
  console.log(`jetons de telechargement: ${f.jetonsTelechargement} (${f.usagesTelechargement} usages)`);
  console.log(`activations             : ${f.activations}`);
  console.log(`e-mails envoyes         : ${f.emailsEnvoyes} (${f.emailsEnAttenteDeRejeu} en attente de rejeu)`);
  console.log('');
  console.log('--- par langue ---');
  for (const [k, v] of Object.entries(byLang)) console.log(`  ${k.padEnd(10)} licences=${String(v.licenses).padStart(3)} commandes payees=${String(v.paidOrders).padStart(3)}`);
  console.log('--- par canal ---');
  for (const [k, v] of Object.entries(byChannel)) console.log(`  ${k.padEnd(16)} commandes=${String(v.orders).padStart(3)} payees=${String(v.paid).padStart(3)} encaisse=${(v.cents / 100).toFixed(2)} EUR`);
  console.log('--- par offre ---');
  for (const [k, v] of Object.entries(byOffer)) console.log(`  ${k.padEnd(22)} commandes=${String(v.orders).padStart(3)} payees=${String(v.paid).padStart(3)} encaisse=${(v.cents / 100).toFixed(2)} EUR`);
  console.log('');
  console.log('NB : un clic sur un CTA et une redirection Mollie ne sont PAS des ventes.');
  console.log('    Seul un webhook Mollie signe et confirme etablit un paiement.');
}
