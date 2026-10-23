#!/usr/bin/env node
/**
 * validate-d1-order-ids.mjs — validation reproductible de la coherence des
 * identifiants de commande entre le code du Worker, les migrations et le
 * schema de production.
 *
 * Aucune base distante n'est touchee : tout se deroule sur des bases isolees
 * en memoire. Ce script prouve, en une seule commande :
 *   1. le schema de production (INTEGER) et le schema reconcilie (TEXT) sont
 *      tous les deux decrits, et la migration les convertit sans perte ;
 *   2. les identifiants texte et numeriques restent accessibles apres
 *      conversion (anciennes commandes ET nouvelles) ;
 *   3. les migrations sont separees par base ;
 *   4. le code du Worker n'utilise plus de generation numerique (MAX(id)+1)
 *      sur un chemin de livraison ACTIF.
 *
 * Usage : npm run validate:d1-order-ids
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createIsolatedDatabase } from '../tests/helpers/d1-sqlite-adapter.mjs';
import { applyProdSchema, seedProdFixture } from '../tests/helpers/prod-fixture.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, '..');
const FIXED_NOW = 1_700_000_000_000;

let failures = 0;
function check(name, ok, detail = '') {
  if (ok) console.log(`  ok   ${name}`);
  else { failures += 1; console.log(`  FAIL ${name} ${detail}`); }
}

function applyMigration(db, sql) {
  db.exec('BEGIN');
  try {
    db.exec(sql);
    db.exec('COMMIT');
  } catch (error) {
    try { db.exec('ROLLBACK'); } catch { /* transaction already rolled back */ }
    throw error;
  }
}

console.log('=== VALIDATION D1 : identifiants de commande (base isolee) ===');

/* --- 1. separation des migrations par base -------------------------------- */
const PAYMENT_TABLES = ['orders', 'licenses', 'activations', 'downloads', 'webhook_events', 'mollie_customers', 'deliveries', 'admin_sessions', 'botwow_emails'];
const prodDir = join(REPO, 'migrations', 'production');
const analyticsDir = join(REPO, 'migrations', 'analytics');

check('migrations/production existe', existsSync(prodDir));
check('migrations/analytics existe', existsSync(analyticsDir));
check('migrations/production : 4 migrations metier', readdirSync(prodDir).filter((f) => f.endsWith('.sql')).length === 4);
check('migrations/analytics : 2 migrations de telemetrie', readdirSync(analyticsDir).filter((f) => f.endsWith('.sql')).length === 2);

for (const f of readdirSync(analyticsDir).filter((f) => f.endsWith('.sql'))) {
  const content = readFileSync(join(analyticsDir, f), 'utf8');
  const banned = PAYMENT_TABLES.filter((t) => new RegExp(`CREATE TABLE(\\s+IF NOT EXISTS)?\\s+${t}\\b`, 'i').test(content));
  check(`migrations/analytics/${f} : aucune table de paiement`, banned.length === 0, `(${banned.join(', ')})`);
}

/* --- 2. la migration convertit sans perte, sur base isolee ---------------- */
const MIGRATION = readFileSync(join(prodDir, '0004_reconcile_order_ids.sql'), 'utf8');
const iso = createIsolatedDatabase({ foreignKeys: true });
applyProdSchema(iso.db);
seedProdFixture(iso.db, { now: FIXED_NOW });

const before = {
  orders: iso.db.prepare('SELECT COUNT(*) c FROM orders').get().c,
  licenses: iso.db.prepare('SELECT COUNT(*) c FROM licenses').get().c,
};

let migError = null;
try { applyMigration(iso.db, MIGRATION); } catch (e) { migError = e; }
check('migration 0004 : application sans erreur sur base isolee', !migError,
  migError ? `(${migError.message.slice(0, 100)})` : '');

if (!migError) {
  const after = {
    orders: iso.db.prepare('SELECT COUNT(*) c FROM orders').get().c,
    licenses: iso.db.prepare('SELECT COUNT(*) c FROM licenses').get().c,
  };
  check('migration 0004 : aucune commande perdue', before.orders === after.orders, `(${before.orders} -> ${after.orders})`);
  check('migration 0004 : aucune licence perdue', before.licenses === after.licenses, `(${before.licenses} -> ${after.licenses})`);
  const numeric = iso.db.prepare("SELECT COUNT(*) c FROM orders WHERE CAST(id AS TEXT) GLOB '[0-9]*'").get().c;
  check('migration 0004 : tous les identifiants de commande sont du texte', numeric === 0, `(${numeric})`);
  const numericRef = iso.db.prepare("SELECT COUNT(*) c FROM licenses WHERE order_id IS NOT NULL AND CAST(order_id AS TEXT) GLOB '[0-9]*'").get().c;
  check('migration 0004 : toutes les references de licence sont du texte', numericRef === 0, `(${numericRef})`);
  const orphans = iso.db.prepare('SELECT COUNT(*) c FROM licenses l LEFT JOIN orders o ON o.id = l.order_id WHERE o.id IS NULL').get().c;
  check('migration 0004 : aucune licence orpheline', orphans === 0, `(${orphans})`);

  /* Les DEUX formes d'identifiant doivent rester accessibles. */
  const byLegacy = iso.db.prepare('SELECT * FROM orders WHERE id = ?').get('ord_legacy_9');
  check('identifiant converti (ord_legacy_9) : commande retrouvee', !!byLegacy);
  check('identifiant converti : champs metier preserves',
    !!byLegacy && byLegacy.provider === 'bitcoin_manual' && byLegacy.provider_id === 'BTC-BBBB2222'
      && byLegacy.email === 'client9@example.com',
    `(${byLegacy ? byLegacy.provider_id : 'absente'})`);
  const byText = iso.db.prepare('SELECT COUNT(*) c FROM orders WHERE id GLOB \'ord_*\'').get().c;
  check('identifiant texte (ord_*) : commandes retrouvables', byText === before.orders, `(${byText})`);
  const byReference = iso.db.prepare("SELECT COUNT(*) c FROM orders WHERE provider_id GLOB 'BTC-*'").get().c;
  check('reference fournisseur (BTC-*) : commandes retrouvables', byReference === 3, `(${byReference})`);

  /* Idempotence reelle : rejouer ne double pas le prefixe. */
  let replayError = null;
  try { applyMigration(iso.db, MIGRATION); } catch (e) { replayError = e; }
  check('migration 0004 rejouee : aucune erreur', !replayError);
  const doubled = iso.db.prepare("SELECT COUNT(*) c FROM orders WHERE id LIKE 'ord_legacy_ord_legacy_%'").get().c;
  check('migration 0004 rejouee : aucun prefixe double', doubled === 0, `(${doubled})`);
}

iso.close();

/* --- 3. le Worker ne doit plus generer d'identifiant numerique ACTIF ------ */
const workerRaw = readFileSync(join(REPO, 'worker', 'index.js'), 'utf8');
// On ignore les commentaires de ligne : un commentaire qui DOCUMENTE
// l'ancien comportement n'est pas une utilisation du comportement.
const worker = workerRaw.replace(/^\s*\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
const maxIdUses = worker.match(/COALESCE\s*\(\s*MAX\s*\(\s*id\s*\)/g) || [];
check('Worker : aucune generation MAX(id)+1 sur un chemin de livraison ACTIF',
  maxIdUses.length === 0, `(${maxIdUses.length} occurrence(s) restante(s))`);

/* Chaque parcours de creation de commande doit fournir un id TEXTE.
   On analyse par FONCTION (le bundle esbuild encadre chaque fonction par
   `__name(...)`) : une fenetre glissante ne verrait pas une variable
   intermediaire comme `const orderId = ...` dans fulfillOrder. */
const fns = worker.split(/__name\(/).slice(1);
const orderFns = fns.filter((f) => /INSERT INTO orders/i.test(f));
const orderFnsWithTextId = orderFns.filter((f) => /ord_/.test(f));
check('Worker : chaque creation de commande porte un identifiant texte ord_*',
  orderFns.length > 0 && orderFnsWithTextId.length === orderFns.length,
  `(${orderFnsWithTextId.length}/${orderFns.length} fonctions)`);

/* --- 4. separation declaree dans wrangler.toml --------------------------- */
const cfg = readFileSync(join(REPO, 'wrangler.toml'), 'utf8');
check('wrangler.toml : migrations_dir production declare', cfg.includes('migrations_dir = "migrations/production"'));
check('wrangler.toml : migrations_dir analytics declare', cfg.includes('migrations_dir = "migrations/analytics"'));
check('wrangler.toml : plus de cle [[domains]] non reconnue', !/\[\[domains\]\]/.test(cfg));
check('wrangler.toml : route Custom Domain documentee',
  /\[\[routes\]\][\s\S]{0,200}pattern\s*=\s*"api\.bot-wow\.com"/.test(cfg)
  && /custom_domain\s*=\s*true/.test(cfg));

/* --------------------------------------------------------------- conclusion */
console.log('');
if (failures === 0) {
  console.log('VALIDATION D1 : OK');
  process.exit(0);
}
console.error(`VALIDATION D1 : ${failures} ECHEC(S)`);
process.exit(1);
